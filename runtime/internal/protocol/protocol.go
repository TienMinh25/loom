package protocol

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sync"

	"loom/runtime/internal/agent"
	"loom/runtime/internal/workspace"
)

const Version = 1

const maxMessageSize = 128 << 20

type Request struct {
	Version int             `json:"version"`
	ID      string          `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type Response struct {
	Version int             `json:"version"`
	ID      string          `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Event   json.RawMessage `json:"event,omitempty"`
	Done    bool            `json:"done,omitempty"`
	Error   *RPCError       `json:"error,omitempty"`
}

type RPCError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type Server struct {
	workspace *workspace.Workspace
	models    ModelRuntime
	ctx       context.Context
	cancel    context.CancelFunc
	mu        sync.Mutex
	active    map[string]context.CancelFunc
	approvals map[string]chan bool
}

type ModelRuntime interface {
	Configure(config agent.ProviderConfig) error
	RunWithApprovals(ctx context.Context, request agent.CompletionRequest, executor agent.ToolExecutor, broker agent.ApprovalBroker, onUpdate func(agent.StreamUpdate) error) error
}

func NewServer(models ModelRuntime) *Server {
	ctx, cancel := context.WithCancel(context.Background())
	return &Server{models: models, ctx: ctx, cancel: cancel, active: make(map[string]context.CancelFunc), approvals: make(map[string]chan bool)}
}

func (server *Server) Close() error {
	server.cancelStreams()
	return server.closeWorkspace()
}

func (server *Server) closeWorkspace() error {
	if server.workspace == nil {
		return nil
	}
	err := server.workspace.Close()
	server.workspace = nil
	return err
}

func (server *Server) Handle(request Request) Response {
	response := Response{Version: Version, ID: request.ID}
	if request.Version != Version {
		return fail(response, "unsupported_version", "unsupported protocol version")
	}
	if request.ID == "" || request.Method == "" {
		return fail(response, "invalid_request", "request id and method are required")
	}

	switch request.Method {
	case "workspace.open":
		var params struct {
			Root string `json:"root"`
		}
		if err := decodeParams(request.Params, &params); err != nil {
			return fail(response, "invalid_params", err.Error())
		}
		opened, err := workspace.Open(params.Root)
		if err != nil {
			return fail(response, "workspace_error", err.Error())
		}
		if err := server.closeWorkspace(); err != nil {
			_ = opened.Close()
			return fail(response, "workspace_error", err.Error())
		}
		server.workspace = opened
		return result(response, struct {
			Root string `json:"root"`
		}{Root: opened.Name()})
	case "workspace.createRoot":
		var params struct {
			Parent string `json:"parent"`
			Name   string `json:"name"`
		}
		if err := decodeParams(request.Params, &params); err != nil {
			return fail(response, "invalid_params", err.Error())
		}
		created, err := workspace.CreateRoot(params.Parent, params.Name)
		if err != nil {
			return fail(response, "workspace_error", err.Error())
		}
		if err := server.closeWorkspace(); err != nil {
			_ = created.Close()
			return fail(response, "workspace_error", err.Error())
		}
		server.workspace = created
		return result(response, struct {
			Root string `json:"root"`
		}{Root: created.Name()})
	case "workspace.list", "workspace.readFile", "workspace.writeFile", "workspace.createFile", "workspace.createDirectory", "workspace.delete", "workspace.rename", "workspace.gitStatus":
		if server.workspace == nil {
			return fail(response, "workspace_not_open", "open a workspace before using workspace files")
		}
	case "provider.configure":
		if server.models == nil {
			return fail(response, "provider_unavailable", "model provider is not available")
		}
		var config agent.ProviderConfig
		if err := decodeParams(request.Params, &config); err != nil {
			return fail(response, "invalid_params", err.Error())
		}
		if err := server.models.Configure(config); err != nil {
			return fail(response, "provider_error", err.Error())
		}
		return result(response, struct {
			Configured bool   `json:"configured"`
			Model      string `json:"model"`
		}{Configured: true, Model: config.Model})
	case "chat.cancel":
		var params struct {
			RunID string `json:"runId"`
		}
		if err := decodeParams(request.Params, &params); err != nil {
			return fail(response, "invalid_params", err.Error())
		}
		cancelled := server.cancelStream(params.RunID)
		return result(response, struct {
			Cancelled bool `json:"cancelled"`
		}{Cancelled: cancelled})
	case "approval.respond":
		var params struct {
			ApprovalID string `json:"approvalId"`
			Approved   bool   `json:"approved"`
		}
		if err := decodeParams(request.Params, &params); err != nil {
			return fail(response, "invalid_params", err.Error())
		}
		return result(response, struct {
			Accepted bool `json:"accepted"`
		}{Accepted: server.Respond(params.ApprovalID, params.Approved)})
	case "chat.stream":
		return fail(response, "invalid_request", "chat.stream must use the streaming protocol")
	default:
		return fail(response, "method_not_found", "unsupported runtime method")
	}

	switch request.Method {
	case "workspace.gitStatus":
		isGit, branch, err := server.workspace.GitStatus()
		if err != nil {
			return fail(response, "workspace_error", err.Error())
		}
		return result(response, struct {
			IsGit  bool   `json:"isGit"`
			Branch string `json:"branch"`
		}{IsGit: isGit, Branch: branch})
	case "workspace.list":
		var params struct {
			Path string `json:"path"`
		}
		if err := decodeParams(request.Params, &params); err != nil {
			return fail(response, "invalid_params", err.Error())
		}
		entries, err := server.workspace.List(params.Path)
		if err != nil {
			return fail(response, "workspace_error", err.Error())
		}
		return result(response, entries)
	case "workspace.readFile":
		var params struct {
			Path string `json:"path"`
		}
		if err := decodeParams(request.Params, &params); err != nil {
			return fail(response, "invalid_params", err.Error())
		}
		content, err := server.workspace.ReadFile(params.Path)
		if err != nil {
			return fail(response, "workspace_error", err.Error())
		}
		return result(response, struct {
			Content string `json:"content"`
		}{Content: string(content)})
	case "workspace.writeFile":
		var params struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		}
		if err := decodeParams(request.Params, &params); err != nil {
			return fail(response, "invalid_params", err.Error())
		}
		if err := server.workspace.WriteFile(params.Path, []byte(params.Content)); err != nil {
			return fail(response, "workspace_error", err.Error())
		}
		return result(response, struct {
			Written bool `json:"written"`
		}{Written: true})
	case "workspace.createFile":
		var params struct {
			Path string `json:"path"`
		}
		if err := decodeParams(request.Params, &params); err != nil {
			return fail(response, "invalid_params", err.Error())
		}
		if err := server.workspace.CreateFile(params.Path); err != nil {
			return fail(response, "workspace_error", err.Error())
		}
		return result(response, struct {
			Created bool `json:"created"`
		}{Created: true})
	case "workspace.createDirectory":
		var params struct {
			Path string `json:"path"`
		}
		if err := decodeParams(request.Params, &params); err != nil {
			return fail(response, "invalid_params", err.Error())
		}
		if err := server.workspace.CreateDirectory(params.Path); err != nil {
			return fail(response, "workspace_error", err.Error())
		}
		return result(response, struct {
			Created bool `json:"created"`
		}{Created: true})
	case "workspace.delete":
		var params struct {
			Path string `json:"path"`
		}
		if err := decodeParams(request.Params, &params); err != nil {
			return fail(response, "invalid_params", err.Error())
		}
		if err := server.workspace.Delete(params.Path); err != nil {
			return fail(response, "workspace_error", err.Error())
		}
		return result(response, struct {
			Deleted bool `json:"deleted"`
		}{Deleted: true})
	case "workspace.rename":
		var params struct {
			From string `json:"from"`
			To   string `json:"to"`
		}
		if err := decodeParams(request.Params, &params); err != nil {
			return fail(response, "invalid_params", err.Error())
		}
		if err := server.workspace.Rename(params.From, params.To); err != nil {
			return fail(response, "workspace_error", err.Error())
		}
		return result(response, struct {
			Renamed bool `json:"renamed"`
		}{Renamed: true})
	default:
		return fail(response, "method_not_found", "unsupported runtime method")
	}
}

func (server *Server) Respond(id string, approved bool) bool {
	server.mu.Lock()
	decision, exists := server.approvals[id]
	if exists {
		delete(server.approvals, id)
	}
	server.mu.Unlock()
	if !exists {
		return false
	}
	decision <- approved
	return true
}

type approvalBroker struct{ server *Server }

func (broker approvalBroker) Request(ctx context.Context, approval agent.ApprovalRequest) (bool, error) {
	decision := make(chan bool, 1)
	broker.server.mu.Lock()
	if _, exists := broker.server.approvals[approval.ID]; exists {
		broker.server.mu.Unlock()
		return false, errors.New("approval id is already active")
	}
	broker.server.approvals[approval.ID] = decision
	broker.server.mu.Unlock()
	select {
	case approved := <-decision:
		return approved, nil
	case <-ctx.Done():
		broker.server.mu.Lock()
		delete(broker.server.approvals, approval.ID)
		broker.server.mu.Unlock()
		return false, ctx.Err()
	}
}

func (server *Server) Serve(input io.Reader, output io.Writer) error {
	scanner := bufio.NewScanner(input)
	scanner.Buffer(make([]byte, 64*1024), maxMessageSize)
	encoder := json.NewEncoder(output)
	var outputMu sync.Mutex
	write := func(response Response) error {
		outputMu.Lock()
		defer outputMu.Unlock()
		return encoder.Encode(response)
	}
	var streams sync.WaitGroup
	streamErrors := make(chan error, 1)
	for scanner.Scan() {
		var request Request
		if err := json.Unmarshal(scanner.Bytes(), &request); err != nil {
			response := fail(Response{Version: Version}, "invalid_json", "request must be one valid JSON object per line")
			if encodeErr := write(response); encodeErr != nil {
				return encodeErr
			}
			continue
		}
		if request.Method == "chat.stream" {
			if request.ID == "" {
				if err := write(fail(Response{Version: Version}, "invalid_request", "request id is required")); err != nil {
					server.cancelStreams()
					streams.Wait()
					return err
				}
				continue
			}
			streams.Add(1)
			go func(request Request) {
				defer streams.Done()
				if err := server.stream(request, write); err != nil {
					select {
					case streamErrors <- err:
					default:
					}
				}
			}(request)
			continue
		}
		if err := write(server.Handle(request)); err != nil {
			server.cancelStreams()
			streams.Wait()
			return err
		}
	}
	server.cancelStreams()
	streams.Wait()
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read runtime request: %w", err)
	}
	select {
	case err := <-streamErrors:
		return err
	default:
	}
	return nil
}

func (server *Server) stream(request Request, write func(Response) error) error {
	response := Response{Version: Version, ID: request.ID}
	if request.Version != Version {
		return write(fail(response, "unsupported_version", "unsupported protocol version"))
	}
	if request.ID == "" || request.Method == "" {
		return write(fail(response, "invalid_request", "request id and method are required"))
	}
	if server.models == nil {
		return write(fail(response, "provider_unavailable", "configure a model provider before starting a chat"))
	}
	var params struct {
		RunID   string                  `json:"runId"`
		Request agent.CompletionRequest `json:"request"`
	}
	if err := decodeParams(request.Params, &params); err != nil {
		return write(fail(response, "invalid_params", err.Error()))
	}
	if params.RunID == "" {
		return write(fail(response, "invalid_params", "run id is required"))
	}
	ctx, finish, err := server.startStream(params.RunID)
	if err != nil {
		return write(fail(response, "duplicate_run", err.Error()))
	}
	defer finish()
	var executor agent.ToolExecutor
	if server.workspace != nil {
		executor = workspace.NewToolExecutor(server.workspace)
	}
	if executor == nil && len(params.Request.Tools) > 0 {
		return write(fail(response, "workspace_not_open", "open a workspace before allowing agent tools"))
	}
	for _, message := range params.Request.Messages {
		if message.Role == "tool" || len(message.ToolCalls) > 0 {
			return write(fail(response, "invalid_params", "tool messages are managed by the runtime and cannot be supplied by the renderer"))
		}
	}
	emit := func(update agent.StreamUpdate) error {
		encoded, err := json.Marshal(update)
		if err != nil {
			return fmt.Errorf("encode chat event: %w", err)
		}
		return write(Response{Version: Version, ID: request.ID, Event: encoded})
	}
	err = server.models.RunWithApprovals(ctx, params.Request, executor, approvalBroker{server: server}, emit)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			encoded, _ := json.Marshal(agent.StreamUpdate{Done: true, Error: "Run cancelled"})
			if eventErr := write(Response{Version: Version, ID: request.ID, Event: encoded}); eventErr != nil {
				return eventErr
			}
			return write(Response{Version: Version, ID: request.ID, Done: true})
		}
		code := "provider_error"
		return write(fail(response, code, err.Error()))
	}
	return write(Response{Version: Version, ID: request.ID, Done: true})
}

func (server *Server) startStream(runID string) (context.Context, func(), error) {
	ctx, cancel := context.WithCancel(server.ctx)
	server.mu.Lock()
	if _, exists := server.active[runID]; exists {
		server.mu.Unlock()
		cancel()
		return nil, nil, errors.New("run id is already active")
	}
	server.active[runID] = cancel
	server.mu.Unlock()
	return ctx, func() {
		cancel()
		server.mu.Lock()
		delete(server.active, runID)
		server.mu.Unlock()
	}, nil
}

func (server *Server) cancelStream(runID string) bool {
	server.mu.Lock()
	cancel, exists := server.active[runID]
	server.mu.Unlock()
	if exists {
		cancel()
	}
	return exists
}

func (server *Server) cancelStreams() {
	server.cancel()
	server.mu.Lock()
	cancellations := make([]context.CancelFunc, 0, len(server.active))
	for _, cancel := range server.active {
		cancellations = append(cancellations, cancel)
	}
	server.mu.Unlock()
	for _, cancel := range cancellations {
		cancel()
	}
}

func decodeParams(encoded json.RawMessage, target any) error {
	if len(encoded) == 0 {
		return errors.New("params are required")
	}
	decoder := json.NewDecoder(bytes.NewReader(encoded))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	return nil
}

func result(response Response, value any) Response {
	encoded, err := json.Marshal(value)
	if err != nil {
		return fail(response, "internal_error", "could not encode runtime response")
	}
	response.Result = encoded
	return response
}

func fail(response Response, code string, message string) Response {
	response.Error = &RPCError{Code: code, Message: message}
	return response
}
