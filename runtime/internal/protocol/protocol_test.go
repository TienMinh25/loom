package protocol

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"loom/runtime/internal/adapter/httpclient"
	"loom/runtime/internal/adapter/provider/openai"
	"loom/runtime/internal/agent"
)

type fakeModels struct {
	configured agent.ProviderConfig
	streamErr  error
}

func (models *fakeModels) Configure(config agent.ProviderConfig) error {
	models.configured = config
	return nil
}

func (models *fakeModels) RunWithApprovals(ctx context.Context, request agent.CompletionRequest, executor agent.ToolExecutor, broker agent.ApprovalBroker, onUpdate func(agent.StreamUpdate) error) error {
	if err := onUpdate(agent.StreamUpdate{Content: "streamed text"}); err != nil {
		return err
	}
	return models.streamErr
}

type channelWriter chan string

func (writer channelWriter) Write(content []byte) (int, error) {
	writer <- string(content)
	return len(content), nil
}

func TestWorkspaceRPCOpensListsReadsAndWritesWithinGrantedRoot(t *testing.T) {
	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, "src"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "src", "main.go"), []byte("package main"), 0o600); err != nil {
		t.Fatal(err)
	}
	server := NewServer(nil)
	t.Cleanup(func() { _ = server.Close() })

	opened := server.Handle(request("open", "workspace.open", map[string]string{"root": root}))
	if opened.Error != nil {
		t.Fatalf("workspace.open failed: %s", opened.Error.Message)
	}

	listed := server.Handle(request("list", "workspace.list", map[string]string{"path": "src"}))
	var entries []struct {
		Name string `json:"name"`
		Path string `json:"path"`
	}
	decodeResult(t, listed, &entries)
	if len(entries) != 1 || entries[0].Path != "src/main.go" {
		t.Fatalf("unexpected list result: %#v", entries)
	}

	read := server.Handle(request("read", "workspace.readFile", map[string]string{"path": "src/main.go"}))
	var readResult struct {
		Content string `json:"content"`
	}
	decodeResult(t, read, &readResult)
	if readResult.Content != "package main" {
		t.Fatalf("unexpected read result: %q", readResult.Content)
	}

	written := server.Handle(request("write", "workspace.writeFile", map[string]string{
		"path":    "src/main.go",
		"content": "package main\n\nfunc main() {}",
	}))
	if written.Error != nil {
		t.Fatalf("workspace.writeFile failed: %s", written.Error.Message)
	}
	content, err := os.ReadFile(filepath.Join(root, "src", "main.go"))
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "package main\n\nfunc main() {}" {
		t.Fatalf("unexpected written file: %q", content)
	}

	created := server.Handle(request("create", "workspace.createFile", map[string]string{"path": "src/new.go"}))
	if created.Error != nil {
		t.Fatalf("workspace.createFile failed: %s", created.Error.Message)
	}
	if _, err := os.Stat(filepath.Join(root, "src", "new.go")); err != nil {
		t.Fatalf("new workspace file was not created: %v", err)
	}
	renamed := server.Handle(request("rename-file", "workspace.rename", map[string]string{
		"from": "src/new.go",
		"to":   "src/renamed.go",
	}))
	if renamed.Error != nil {
		t.Fatalf("workspace.rename failed: %s", renamed.Error.Message)
	}
	if _, err := os.Stat(filepath.Join(root, "src", "renamed.go")); err != nil {
		t.Fatalf("renamed workspace file was not found: %v", err)
	}
	collision := server.Handle(request("rename-collision", "workspace.rename", map[string]string{
		"from": "src/renamed.go",
		"to":   "src/main.go",
	}))
	if collision.Error == nil {
		t.Fatal("workspace.rename must not replace an existing file")
	}
	if _, err := os.Stat(filepath.Join(root, "src", "renamed.go")); err != nil {
		t.Fatalf("rename collision removed the source file: %v", err)
	}
	escape := server.Handle(request("rename-escape", "workspace.rename", map[string]string{
		"from": "src/renamed.go",
		"to":   "../outside.go",
	}))
	if escape.Error == nil {
		t.Fatal("workspace.rename must reject paths outside the selected root")
	}
	duplicate := server.Handle(request("create-duplicate", "workspace.createFile", map[string]string{"path": "src/main.go"}))
	if duplicate.Error == nil {
		t.Fatal("workspace.createFile must not overwrite an existing file")
	}
	directory := server.Handle(request("mkdir", "workspace.createDirectory", map[string]string{"path": "src/components"}))
	if directory.Error != nil {
		t.Fatalf("workspace.createDirectory failed: %s", directory.Error.Message)
	}
	if err := os.WriteFile(filepath.Join(root, "src", "components", "child.go"), []byte("package child"), 0o600); err != nil {
		t.Fatal(err)
	}
	renamedDirectory := server.Handle(request("rename-directory", "workspace.rename", map[string]string{
		"from": "src/components",
		"to":   "src/ui",
	}))
	if renamedDirectory.Error != nil {
		t.Fatalf("workspace.rename directory failed: %s", renamedDirectory.Error.Message)
	}
	if _, err := os.Stat(filepath.Join(root, "src", "ui", "child.go")); err != nil {
		t.Fatalf("renamed directory did not preserve its contents: %v", err)
	}
	deleted := server.Handle(request("delete", "workspace.delete", map[string]string{"path": "src/ui"}))
	if deleted.Error != nil {
		t.Fatalf("workspace.delete failed: %s", deleted.Error.Message)
	}
	if _, err := os.Stat(filepath.Join(root, "src", "ui")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("deleted workspace directory stat error=%v", err)
	}
}

func TestWorkspaceCreateRootSelectsNewDirectoryAsActiveWorkspace(t *testing.T) {
	parent := t.TempDir()
	server := NewServer(nil)
	t.Cleanup(func() { _ = server.Close() })

	created := server.Handle(request("create", "workspace.createRoot", map[string]string{
		"parent": parent,
		"name":   "new-workspace",
	}))
	var root struct {
		Root string `json:"root"`
	}
	decodeResult(t, created, &root)
	if root.Root != filepath.Join(parent, "new-workspace") {
		t.Fatalf("unexpected new workspace root: %q", root.Root)
	}
	entries := server.Handle(request("list", "workspace.list", map[string]string{"path": "."}))
	var listed []any
	decodeResult(t, entries, &listed)
	if len(listed) != 0 {
		t.Fatalf("new workspace should start empty, got %#v", listed)
	}
}

func TestWorkspaceReadRPCReturnsFilesLargerThanTheFormerTwoMiBFrameLimit(t *testing.T) {
	root := t.TempDir()
	content := bytes.Repeat([]byte("x"), (2<<20)+1)
	if err := os.WriteFile(filepath.Join(root, "large.txt"), content, 0o600); err != nil {
		t.Fatal(err)
	}
	server := NewServer(nil)
	t.Cleanup(func() { _ = server.Close() })
	if response := server.Handle(request("open", "workspace.open", map[string]string{"root": root})); response.Error != nil {
		t.Fatal(response.Error.Message)
	}

	requestBytes, err := json.Marshal(request("read", "workspace.readFile", map[string]string{"path": "large.txt"}))
	if err != nil {
		t.Fatal(err)
	}
	var output bytes.Buffer
	if err := server.Serve(bytes.NewReader(append(requestBytes, '\n')), &output); err != nil {
		t.Fatal(err)
	}
	var response Response
	if err := json.Unmarshal(bytes.TrimSpace(output.Bytes()), &response); err != nil {
		t.Fatalf("decode large workspace response: %v", err)
	}
	var result struct {
		Content string `json:"content"`
	}
	decodeResult(t, response, &result)
	if result.Content != string(content) {
		t.Fatalf("large RPC response length=%d, want %d", len(result.Content), len(content))
	}
}

func TestOpeningWorkspaceDoesNotCancelFutureAgentRuns(t *testing.T) {
	server := NewServer(&fakeModels{})
	defer server.Close()
	response := server.Handle(request("open", "workspace.open", map[string]string{"root": t.TempDir()}))
	if response.Error != nil {
		t.Fatal(response.Error.Message)
	}
	ctx, cancel, err := server.startStream("run-after-open")
	if err != nil {
		t.Fatal(err)
	}
	defer cancel()
	select {
	case <-ctx.Done():
		t.Fatal("opening a workspace must not cancel the runtime context")
	default:
	}
}

func TestWorkspaceRPCRequiresVersionAndAnOpenedRoot(t *testing.T) {
	server := NewServer(nil)
	t.Cleanup(func() { _ = server.Close() })

	wrongVersion := Request{Version: Version + 1, ID: "bad-version", Method: "workspace.list"}
	response := server.Handle(wrongVersion)
	if response.Error == nil || response.ID != wrongVersion.ID {
		t.Fatalf("expected version error to preserve id: %#v", response)
	}

	noRoot := server.Handle(request("no-root", "workspace.list", map[string]string{"path": "."}))
	if noRoot.Error == nil {
		t.Fatal("expected workspace.list to require workspace.open")
	}
}

func TestWorkspaceGitBranchReportsNoGitAndCurrentBranch(t *testing.T) {
	server := NewServer(nil)
	defer server.Close()
	root := t.TempDir()
	if response := server.Handle(request("open-no-git", "workspace.open", map[string]string{"root": root})); response.Error != nil {
		t.Fatal(response.Error.Message)
	}
	response := server.Handle(request("git-status-no-git", "workspace.gitStatus", map[string]string{}))
	var status struct {
		IsGit  bool   `json:"isGit"`
		Branch string `json:"branch"`
	}
	decodeResult(t, response, &status)
	if status.IsGit || status.Branch != "" {
		t.Fatalf("no-git status=%#v", status)
	}

	if err := os.Mkdir(filepath.Join(root, ".git"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, ".git", "HEAD"), []byte("ref: refs/heads/feature/chat-ui\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	response = server.Handle(request("git-status", "workspace.gitStatus", map[string]string{}))
	decodeResult(t, response, &status)
	if !status.IsGit || status.Branch != "feature/chat-ui" {
		t.Fatalf("git status=%#v", status)
	}
}

func TestWorkspaceRPCRejectsOutOfRootWrite(t *testing.T) {
	root := t.TempDir()
	outside := filepath.Join(t.TempDir(), "outside.txt")
	if err := os.WriteFile(outside, []byte("safe"), 0o600); err != nil {
		t.Fatal(err)
	}
	server := NewServer(nil)
	t.Cleanup(func() { _ = server.Close() })
	if response := server.Handle(request("open", "workspace.open", map[string]string{"root": root})); response.Error != nil {
		t.Fatal(response.Error.Message)
	}

	response := server.Handle(request("write", "workspace.writeFile", map[string]string{
		"path":    "../" + filepath.Base(filepath.Dir(outside)) + "/outside.txt",
		"content": "unsafe",
	}))
	if response.Error == nil {
		t.Fatal("expected out-of-root write to fail")
	}
	content, err := os.ReadFile(outside)
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "safe" {
		t.Fatalf("outside file was modified: %q", content)
	}
}

func TestProviderConfigurationUsesTypedRuntimeBoundary(t *testing.T) {
	models := &fakeModels{}
	server := NewServer(models)
	config := agent.ProviderConfig{BaseURL: "https://gateway.example/v1", APIKey: "secret", Model: "model"}
	response := server.Handle(request("configure", "provider.configure", config))
	if response.Error != nil {
		t.Fatal(response.Error.Message)
	}
	if models.configured != config {
		t.Fatalf("configured = %#v", models.configured)
	}
	var result struct {
		Configured bool   `json:"configured"`
		Model      string `json:"model"`
	}
	decodeResult(t, response, &result)
	if !result.Configured || result.Model != config.Model {
		t.Fatalf("configuration result = %#v", result)
	}
}

func TestChatStreamWritesCorrelatedEventsAndCompletes(t *testing.T) {
	server := NewServer(&fakeModels{})
	input, inputWriter := io.Pipe()
	output := make(channelWriter, 2)
	serveResult := make(chan error, 1)
	go func() { serveResult <- server.Serve(input, output) }()

	encoded, err := json.Marshal(request("chat-1", "chat.stream", map[string]any{
		"runId": "run-1",
		"request": agent.CompletionRequest{
			Model:    "model",
			Messages: []agent.Message{{Role: "user", Content: "hello"}},
		},
	}))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := inputWriter.Write(append(encoded, '\n')); err != nil {
		t.Fatal(err)
	}

	var event Response
	select {
	case line := <-output:
		if err := json.Unmarshal(bytes.TrimSpace([]byte(line)), &event); err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("stream event was not written")
	}
	var update agent.StreamUpdate
	if event.ID != "chat-1" || event.Done || json.Unmarshal(event.Event, &update) != nil || update.Content != "streamed text" {
		t.Fatalf("unexpected stream event: %#v, update %#v", event, update)
	}
	var done Response
	select {
	case line := <-output:
		if err := json.Unmarshal(bytes.TrimSpace([]byte(line)), &done); err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("stream completion was not written")
	}
	if done.ID != "chat-1" || !done.Done {
		t.Fatalf("unexpected completion: %#v", done)
	}

	_ = inputWriter.Close()
	select {
	case err := <-serveResult:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("protocol server did not stop after stdin closed")
	}
}

func TestChatStreamReportsProviderErrorsAsTerminalResponses(t *testing.T) {
	server := NewServer(&fakeModels{streamErr: errors.New("upstream failed")})
	input, inputWriter := io.Pipe()
	output := make(channelWriter, 2)
	serveResult := make(chan error, 1)
	go func() { serveResult <- server.Serve(input, output) }()
	encoded, err := json.Marshal(request("chat-error", "chat.stream", map[string]any{
		"runId": "run-error", "request": agent.CompletionRequest{Messages: []agent.Message{{Role: "user", Content: "hello"}}},
	}))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := inputWriter.Write(append(encoded, '\n')); err != nil {
		t.Fatal(err)
	}
	var event Response
	if err := json.Unmarshal(bytes.TrimSpace([]byte(<-output)), &event); err != nil {
		t.Fatal(err)
	}
	var terminal Response
	if err := json.Unmarshal(bytes.TrimSpace([]byte(<-output)), &terminal); err != nil {
		t.Fatal(err)
	}
	if terminal.ID != "chat-error" || terminal.Error == nil || terminal.Error.Code != "provider_error" {
		t.Fatalf("unexpected terminal response: %#v", terminal)
	}
	if event.Event == nil {
		t.Fatal("provider delta event was not emitted before the error")
	}
	_ = inputWriter.Close()
	if err := <-serveResult; err != nil {
		t.Fatal(err)
	}
	if err := server.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestChatCancelInterruptsTheMatchingActiveRun(t *testing.T) {
	models := &blockingModels{started: make(chan struct{}), finished: make(chan struct{})}
	server := NewServer(models)
	input, inputWriter := io.Pipe()
	output := make(channelWriter, 8)
	serveResult := make(chan error, 1)
	go func() { serveResult <- server.Serve(input, output) }()
	streamRequest, _ := json.Marshal(request("chat-cancel", "chat.stream", map[string]any{
		"runId": "run-cancel", "request": agent.CompletionRequest{Messages: []agent.Message{{Role: "user", Content: "wait"}}},
	}))
	if _, err := inputWriter.Write(append(streamRequest, '\n')); err != nil {
		t.Fatal(err)
	}
	select {
	case <-models.started:
	case <-time.After(time.Second):
		t.Fatal("stream did not start")
	}
	cancelRequest, _ := json.Marshal(request("cancel-1", "chat.cancel", map[string]string{"runId": "run-cancel"}))
	if _, err := inputWriter.Write(append(cancelRequest, '\n')); err != nil {
		t.Fatal(err)
	}
	var cancelResponse Response
	deadline := time.After(time.Second)
	for cancelResponse.ID != "cancel-1" {
		select {
		case frame := <-output:
			var response Response
			if err := json.Unmarshal(bytes.TrimSpace([]byte(frame)), &response); err != nil {
				t.Fatal(err)
			}
			if response.ID == "cancel-1" {
				cancelResponse = response
			}
		case <-deadline:
			t.Fatal("cancel response was not emitted")
		}
	}
	var cancelResult struct {
		Cancelled bool `json:"cancelled"`
	}
	decodeResult(t, cancelResponse, &cancelResult)
	if !cancelResult.Cancelled {
		t.Fatal("expected matching run cancellation")
	}
	select {
	case <-models.finished:
	case <-time.After(time.Second):
		t.Fatal("model stream did not observe cancellation")
	}
	_ = inputWriter.Close()
	if err := <-serveResult; err != nil {
		t.Fatal(err)
	}
	if err := server.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestApprovalResponseResolvesPendingApprovalExactlyOnce(t *testing.T) {
	server := NewServer(&fakeModels{})
	decision := make(chan bool, 1)
	server.mu.Lock()
	server.approvals["approval-1"] = decision
	server.mu.Unlock()
	response := server.Handle(request("approval-response", "approval.respond", map[string]any{"approvalId": "approval-1", "approved": true}))
	var result struct {
		Accepted bool `json:"accepted"`
	}
	decodeResult(t, response, &result)
	if !result.Accepted || !<-decision {
		t.Fatal("approval response was not delivered")
	}
	second := server.Handle(request("approval-response-2", "approval.respond", map[string]any{"approvalId": "approval-1", "approved": true}))
	decodeResult(t, second, &result)
	if result.Accepted {
		t.Fatal("approval id must only be resolved once")
	}
}

func TestChatToolApprovalRoundTripWaitsBeforeStreamCompletes(t *testing.T) {
	models := &approvalModels{approvalSent: make(chan agent.ApprovalRequest, 1), decision: make(chan bool, 1)}
	server := NewServer(models)
	input, inputWriter := io.Pipe()
	output := make(channelWriter, 8)
	serveResult := make(chan error, 1)
	go func() { serveResult <- server.Serve(input, output) }()
	encoded, _ := json.Marshal(request("chat-approval", "chat.stream", map[string]any{
		"runId": "run-approval", "request": agent.CompletionRequest{Messages: []agent.Message{{Role: "user", Content: "write it"}}},
	}))
	if _, err := inputWriter.Write(append(encoded, '\n')); err != nil {
		t.Fatal(err)
	}
	select {
	case <-models.approvalSent:
	case <-time.After(time.Second):
		t.Fatal("approval event was not emitted")
	}
	var approvalFrame Response
	if err := json.Unmarshal(bytes.TrimSpace([]byte(<-output)), &approvalFrame); err != nil {
		t.Fatal(err)
	}
	var update agent.StreamUpdate
	if err := json.Unmarshal(approvalFrame.Event, &update); err != nil || update.Approval == nil || update.Approval.ID != "call-approval" {
		t.Fatalf("approval update=%#v err=%v", update, err)
	}
	select {
	case <-output:
		t.Fatal("stream completed before user approval")
	case <-time.After(25 * time.Millisecond):
	}
	responseBytes, _ := json.Marshal(request("approve-tool", "approval.respond", map[string]any{"approvalId": "call-approval", "approved": true}))
	if _, err := inputWriter.Write(append(responseBytes, '\n')); err != nil {
		t.Fatal(err)
	}
	frames := []Response{}
	for len(frames) < 2 {
		select {
		case line := <-output:
			var frame Response
			if err := json.Unmarshal(bytes.TrimSpace([]byte(line)), &frame); err != nil {
				t.Fatal(err)
			}
			if frame.ID == "chat-approval" {
				frames = append(frames, frame)
			}
		case <-time.After(time.Second):
			t.Fatal("approved tool stream did not finish")
		}
	}
	if !frames[1].Done {
		t.Fatalf("terminal frame=%#v", frames[1])
	}
	_ = inputWriter.Close()
	if err := <-serveResult; err != nil {
		t.Fatal(err)
	}
}

func TestOpenAICompatibleModelToolApprovalWritesOnlyAfterApproval(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "main.go"), []byte("old"), 0o600); err != nil {
		t.Fatal(err)
	}
	models := &openAIToolModels{test: t}
	provider, err := openai.New(openai.Config{BaseURL: models.serverURL(), APIKey: "test", Model: "mock"}, httpclient.NewClient(models.server.Client()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(models.server.Close)
	registry := agent.NewRegistry(&fixedFactory{provider: provider})
	if err := registry.Configure(agent.ProviderConfig{BaseURL: models.serverURL(), APIKey: "test", Model: "mock"}); err != nil {
		t.Fatal(err)
	}
	server := NewServer(registry)
	input, inputWriter := io.Pipe()
	output := make(channelWriter, 8)
	serveResult := make(chan error, 1)
	go func() { serveResult <- server.Serve(input, output) }()
	openWorkspace, _ := json.Marshal(request("open", "workspace.open", map[string]string{"root": root}))
	if _, err := inputWriter.Write(append(openWorkspace, '\n')); err != nil {
		t.Fatal(err)
	}
	var opened Response
	if err := json.Unmarshal(bytes.TrimSpace([]byte(<-output)), &opened); err != nil {
		t.Fatal(err)
	}
	if opened.Error != nil {
		t.Fatal(opened.Error.Message)
	}
	chat, _ := json.Marshal(request("chat-e2e", "chat.stream", map[string]any{"runId": "run-e2e", "request": agent.CompletionRequest{Messages: []agent.Message{{Role: "user", Content: "overwrite file"}}}}))
	if _, err := inputWriter.Write(append(chat, '\n')); err != nil {
		t.Fatal(err)
	}
	var approval Response
	for approval.Event == nil && approval.Error == nil {
		select {
		case line := <-output:
			var frame Response
			if err := json.Unmarshal(bytes.TrimSpace([]byte(line)), &frame); err != nil {
				t.Fatal(err)
			}
			if frame.ID == "chat-e2e" {
				approval = frame
			}
		case <-time.After(2 * time.Second):
			t.Fatal("chat did not produce an approval event")
		}
	}
	if approval.Error != nil {
		t.Fatalf("chat failed before tool approval: %s", approval.Error.Message)
	}
	var event agent.StreamUpdate
	if err := json.Unmarshal(approval.Event, &event); err != nil {
		t.Fatal(err)
	}
	if event.Approval == nil || event.Approval.ToolName != "workspace.writeFile" {
		t.Fatalf("approval=%#v", event)
	}
	content, err := os.ReadFile(filepath.Join(root, "main.go"))
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "old" {
		t.Fatalf("file changed before approval: %q", content)
	}
	decision, _ := json.Marshal(request("approve", "approval.respond", map[string]any{"approvalId": event.Approval.ID, "approved": true}))
	if _, err := inputWriter.Write(append(decision, '\n')); err != nil {
		t.Fatal(err)
	}
	terminal := false
	for !terminal {
		line := <-output
		var frame Response
		if err := json.Unmarshal(bytes.TrimSpace([]byte(line)), &frame); err != nil {
			t.Fatal(err)
		}
		if frame.ID == "chat-e2e" && frame.Done {
			terminal = true
		}
	}
	content, err = os.ReadFile(filepath.Join(root, "main.go"))
	if err != nil || string(content) != "new content" {
		t.Fatalf("post approval file content=%q err=%v", content, err)
	}
	_ = inputWriter.Close()
	if err := <-serveResult; err != nil {
		t.Fatal(err)
	}
	if err := server.Close(); err != nil {
		t.Fatal(err)
	}
}

type openAIToolModels struct {
	server *httptest.Server
	calls  int
	test   *testing.T
}

func (models *openAIToolModels) serverURL() string {
	if models.server == nil {
		models.server = httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			if request.Header.Get("Authorization") != "Bearer test" {
				models.test.Errorf("missing provider authorization")
			}
			var body struct {
				Tools []agent.ToolDefinition `json:"tools"`
			}
			if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
				models.test.Error(err)
			}
			if len(body.Tools) != 3 {
				models.test.Errorf("tools=%#v", body.Tools)
			}
			models.calls++
			writer.Header().Set("Content-Type", "text/event-stream")
			writer.WriteHeader(http.StatusOK)
			if models.calls == 1 {
				_, _ = writer.Write([]byte("data: {\"id\":\"tool-call\",\"model\":\"mock\",\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call-write\",\"type\":\"function\",\"function\":{\"name\":\"workspace.writeFile\",\"arguments\":\"{\\\"path\\\":\\\"main.go\\\",\\\"content\\\":\\\"new content\\\"}\"}}]},\"finish_reason\":\"tool_calls\"}]}\n\ndata: [DONE]\n\n"))
				return
			}
			_, _ = writer.Write([]byte("data: {\"id\":\"final\",\"model\":\"mock\",\"choices\":[{\"delta\":{\"content\":\"Updated \"},\"finish_reason\":null}]}\n\ndata: {\"id\":\"final\",\"model\":\"mock\",\"choices\":[{\"delta\":{\"content\":\"the file.\"},\"finish_reason\":null}]}\n\ndata: {\"id\":\"final\",\"model\":\"mock\",\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n"))
		}))
	}
	return models.server.URL
}
func (*openAIToolModels) Configure(agent.ProviderConfig) error { return nil }
func (*openAIToolModels) RunWithApprovals(context.Context, agent.CompletionRequest, agent.ToolExecutor, agent.ApprovalBroker, func(agent.StreamUpdate) error) error {
	return errors.New("registry should be used")
}

type fixedFactory struct{ provider agent.ModelProvider }

func (factory *fixedFactory) New(agent.ProviderConfig) (agent.ModelProvider, error) {
	return factory.provider, nil
}

type approvalModels struct {
	approvalSent chan agent.ApprovalRequest
	decision     chan bool
}

func (*approvalModels) Configure(agent.ProviderConfig) error { return nil }
func (models *approvalModels) RunWithApprovals(ctx context.Context, _ agent.CompletionRequest, _ agent.ToolExecutor, broker agent.ApprovalBroker, emit func(agent.StreamUpdate) error) error {
	approval := agent.ApprovalRequest{ID: "call-approval", ToolName: "workspace.writeFile", Arguments: json.RawMessage(`{"path":"main.go","content":"ok"}`)}
	models.approvalSent <- approval
	if err := emit(agent.StreamUpdate{Approval: &approval}); err != nil {
		return err
	}
	_, err := broker.Request(ctx, approval)
	if err != nil {
		return err
	}
	if err := emit(agent.StreamUpdate{Content: "saved"}); err != nil {
		return err
	}
	return nil
}

func TestChatStreamRejectsDuplicateActiveRunID(t *testing.T) {
	models := &blockingModels{started: make(chan struct{}), finished: make(chan struct{})}
	server := NewServer(models)
	input, inputWriter := io.Pipe()
	output := make(channelWriter, 4)
	serveResult := make(chan error, 1)
	go func() { serveResult <- server.Serve(input, output) }()
	requestBytes, _ := json.Marshal(request("chat-one", "chat.stream", map[string]any{
		"runId": "same-run", "request": agent.CompletionRequest{Messages: []agent.Message{{Role: "user", Content: "wait"}}},
	}))
	if _, err := inputWriter.Write(append(requestBytes, '\n')); err != nil {
		t.Fatal(err)
	}
	select {
	case <-models.started:
	case <-time.After(time.Second):
		t.Fatal("stream did not start")
	}
	requestBytes, _ = json.Marshal(request("chat-two", "chat.stream", map[string]any{
		"runId": "same-run", "request": agent.CompletionRequest{Messages: []agent.Message{{Role: "user", Content: "duplicate"}}},
	}))
	if _, err := inputWriter.Write(append(requestBytes, '\n')); err != nil {
		t.Fatal(err)
	}
	var duplicate Response
	deadline := time.After(time.Second)
	for duplicate.Error == nil {
		select {
		case line := <-output:
			var response Response
			if err := json.Unmarshal(bytes.TrimSpace([]byte(line)), &response); err != nil {
				t.Fatal(err)
			}
			if response.ID == "chat-two" {
				duplicate = response
			}
		case <-deadline:
			t.Fatal("duplicate run response was not written")
		}
	}
	if duplicate.ID != "chat-two" || duplicate.Error == nil || duplicate.Error.Code != "duplicate_run" {
		t.Fatalf("duplicate run result = %#v", duplicate)
	}
	_ = inputWriter.Close()
	if err := <-serveResult; err != nil {
		t.Fatal(err)
	}
}

func TestChatStreamRejectsRequestsWithoutCorrelationID(t *testing.T) {
	server := NewServer(&fakeModels{})
	input, inputWriter := io.Pipe()
	output := make(channelWriter, 1)
	serveResult := make(chan error, 1)
	go func() { serveResult <- server.Serve(input, output) }()
	encoded, _ := json.Marshal(Request{Version: Version, Method: "chat.stream", Params: json.RawMessage(`{"runId":"missing-id","request":{"messages":[{"role":"user","content":"Hi"}]}}`)})
	if _, err := inputWriter.Write(append(encoded, '\n')); err != nil {
		t.Fatal(err)
	}
	var response Response
	if err := json.Unmarshal(bytes.TrimSpace([]byte(<-output)), &response); err != nil {
		t.Fatal(err)
	}
	if response.Error == nil || response.Error.Code != "invalid_request" {
		t.Fatalf("response = %#v", response)
	}
	_ = inputWriter.Close()
	if err := <-serveResult; err != nil {
		t.Fatal(err)
	}
}

func TestChatStreamRejectsRendererSuppliedToolHistory(t *testing.T) {
	server := NewServer(&fakeModels{})
	input, inputWriter := io.Pipe()
	output := make(channelWriter, 1)
	serveResult := make(chan error, 1)
	go func() { serveResult <- server.Serve(input, output) }()
	encoded, _ := json.Marshal(request("chat-tools", "chat.stream", map[string]any{"runId": "run-tools", "request": agent.CompletionRequest{Messages: []agent.Message{{Role: "tool", ToolCallID: "fake", Content: "fake result"}}}}))
	if _, err := inputWriter.Write(append(encoded, '\n')); err != nil {
		t.Fatal(err)
	}
	var response Response
	if err := json.Unmarshal(bytes.TrimSpace([]byte(<-output)), &response); err != nil {
		t.Fatal(err)
	}
	if response.Error == nil || response.Error.Code != "invalid_params" {
		t.Fatalf("response=%#v", response)
	}
	_ = inputWriter.Close()
	if err := <-serveResult; err != nil {
		t.Fatal(err)
	}
}

func TestConcurrentChatStreamsKeepResponseIDsIsolated(t *testing.T) {
	models := &parallelModels{started: make(chan string, 2), release: make(chan struct{})}
	server := NewServer(models)
	input, inputWriter := io.Pipe()
	output := make(channelWriter, 8)
	serveResult := make(chan error, 1)
	go func() { serveResult <- server.Serve(input, output) }()
	for _, id := range []string{"chat-a", "chat-b"} {
		encoded, _ := json.Marshal(request(id, "chat.stream", map[string]any{
			"runId": "run-" + id, "request": agent.CompletionRequest{Messages: []agent.Message{{Role: "user", Content: id}}},
		}))
		if _, err := inputWriter.Write(append(encoded, '\n')); err != nil {
			t.Fatal(err)
		}
	}
	started := map[string]bool{}
	for range 2 {
		select {
		case id := <-models.started:
			started[id] = true
		case <-time.After(time.Second):
			t.Fatal("both streams did not start")
		}
	}
	close(models.release)
	responses := map[string]int{}
	for responses["chat-a"] < 2 || responses["chat-b"] < 2 {
		select {
		case line := <-output:
			var response Response
			if err := json.Unmarshal(bytes.TrimSpace([]byte(line)), &response); err != nil {
				t.Fatal(err)
			}
			if response.ID != "chat-a" && response.ID != "chat-b" {
				t.Fatalf("unknown response id %q", response.ID)
			}
			responses[response.ID]++
		case <-time.After(time.Second):
			t.Fatal("expected two stream events and two terminal frames")
		}
	}
	if len(started) != 2 || responses["chat-a"] != 2 || responses["chat-b"] != 2 {
		t.Fatalf("started = %#v, responses = %#v", started, responses)
	}
	_ = inputWriter.Close()
	if err := <-serveResult; err != nil {
		t.Fatal(err)
	}
}

type parallelModels struct {
	started chan string
	release chan struct{}
}

func (*parallelModels) Configure(agent.ProviderConfig) error { return nil }
func (models *parallelModels) RunWithApprovals(_ context.Context, request agent.CompletionRequest, _ agent.ToolExecutor, _ agent.ApprovalBroker, onUpdate func(agent.StreamUpdate) error) error {
	id := request.Messages[0].Content
	models.started <- id
	<-models.release
	return onUpdate(agent.StreamUpdate{Content: "reply to " + id})
}

type blockingModels struct {
	started  chan struct{}
	finished chan struct{}
}

func (*blockingModels) Configure(agent.ProviderConfig) error { return nil }
func (models *blockingModels) RunWithApprovals(ctx context.Context, _ agent.CompletionRequest, _ agent.ToolExecutor, _ agent.ApprovalBroker, _ func(agent.StreamUpdate) error) error {
	close(models.started)
	<-ctx.Done()
	close(models.finished)
	return ctx.Err()
}

func request(id string, method string, params any) Request {
	encodedParams, err := json.Marshal(params)
	if err != nil {
		panic(err)
	}
	return Request{Version: Version, ID: id, Method: method, Params: encodedParams}
}

func decodeResult(t *testing.T, response Response, result any) {
	t.Helper()
	if response.Error != nil {
		t.Fatalf("RPC call failed: %s", response.Error.Message)
	}
	if err := json.Unmarshal(response.Result, result); err != nil {
		t.Fatal(err)
	}
}
