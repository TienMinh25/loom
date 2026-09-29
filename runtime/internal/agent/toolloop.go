package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

var ErrApprovalRequired = errors.New("tool execution requires user approval")

type ToolExecutor interface {
	Execute(ctx context.Context, name string, arguments json.RawMessage) (string, error)
}

type ApprovalDecision func(context.Context, string, json.RawMessage) (bool, error)

type ApprovalRequest struct {
	ID        string          `json:"id"`
	ToolName  string          `json:"toolName"`
	Arguments json.RawMessage `json:"arguments"`
}

type ApprovalBroker interface {
	Request(ctx context.Context, approval ApprovalRequest) (bool, error)
}

type ToolLoop struct {
	provider ModelProvider
	executor ToolExecutor
	approve  ApprovalDecision
	broker   ApprovalBroker
	maxTurns int
}

func NewToolLoop(provider ModelProvider, executor ToolExecutor, approve ApprovalDecision) *ToolLoop {
	return &ToolLoop{provider: provider, executor: executor, approve: approve, maxTurns: 8}
}

func NewToolLoopWithBroker(provider ModelProvider, executor ToolExecutor, broker ApprovalBroker) *ToolLoop {
	return &ToolLoop{provider: provider, executor: executor, broker: broker, maxTurns: 8}
}

func (loop *ToolLoop) Run(ctx context.Context, request CompletionRequest, emit func(StreamUpdate) error) error {
	if loop == nil || loop.provider == nil || loop.executor == nil {
		return errors.New("tool loop dependencies are required")
	}
	if emit == nil {
		return errors.New("stream update handler is required")
	}
	if len(request.Tools) == 0 {
		request.Tools = workspaceToolDefinitions()
	}
	for turn := 0; turn < loop.maxTurns; turn++ {
		var completion StreamUpdate
		var message Message
		var content strings.Builder
		toolCalls := make(map[int]*ToolCall)
		err := loop.provider.Stream(ctx, request, func(update StreamUpdate) error {
			if completion.ID == "" {
				completion.ID = update.ID
				completion.Model = update.Model
			}
			if update.FinishReason != "" {
				completion.FinishReason = update.FinishReason
			}
			if update.Usage != nil {
				completion.Usage = update.Usage
			}
			if update.Content != "" {
				content.WriteString(update.Content)
				update.Done = false
				update.FinishReason = ""
				update.Usage = nil
				if err := emit(update); err != nil {
					return err
				}
			}
			for _, delta := range update.ToolCalls {
				call := toolCalls[delta.Index]
				if call == nil {
					call = &ToolCall{Type: delta.Type}
					toolCalls[delta.Index] = call
				}
				if delta.ID != "" {
					call.ID = delta.ID
				}
				if delta.Type != "" {
					call.Type = delta.Type
				}
				call.Function.Name += delta.Name
				call.Function.Arguments += delta.Arguments
			}
			return nil
		})
		if err != nil {
			return err
		}
		message = Message{Role: "assistant", Content: content.String()}
		for index := 0; index < len(toolCalls); index++ {
			call := toolCalls[index]
			if call == nil {
				return errors.New("provider returned non-contiguous tool call indexes")
			}
			message.ToolCalls = append(message.ToolCalls, *call)
		}
		if len(message.ToolCalls) == 0 {
			request.Messages = append(request.Messages, message)
			if completion.Usage != nil {
				return emit(StreamUpdate{ID: completion.ID, Model: completion.Model, FinishReason: completion.FinishReason, Usage: completion.Usage, Done: true})
			}
			return emit(StreamUpdate{ID: completion.ID, Model: completion.Model, FinishReason: completion.FinishReason, Done: true})
		}
		request.Messages = append(request.Messages, message)
		for _, call := range message.ToolCalls {
			arguments := json.RawMessage(call.Function.Arguments)
			if !json.Valid(arguments) {
				return fmt.Errorf("tool %s returned invalid JSON arguments", call.Function.Name)
			}
			var allowed bool
			if loop.broker != nil {
				approval := ApprovalRequest{ID: call.ID, ToolName: call.Function.Name, Arguments: arguments}
				if err := emit(StreamUpdate{Approval: &approval}); err != nil {
					return err
				}
				allowed, err = loop.broker.Request(ctx, approval)
			} else if loop.approve != nil {
				allowed, err = loop.approve(ctx, call.Function.Name, arguments)
			} else {
				return ErrApprovalRequired
			}
			if err != nil {
				return err
			}
			if !allowed {
				content := `{"approved":false,"reason":"user rejected the action"}`
				request.Messages = append(request.Messages, Message{Role: "tool", ToolCallID: call.ID, Name: call.Function.Name, Content: content})
				continue
			}
			content, err := loop.executor.Execute(ctx, call.Function.Name, arguments)
			if err != nil {
				return fmt.Errorf("execute tool %s: %w", call.Function.Name, err)
			}
			request.Messages = append(request.Messages, Message{Role: "tool", ToolCallID: call.ID, Name: call.Function.Name, Content: content})
		}
	}
	return errors.New("agent tool loop exceeded the maximum number of turns")
}

func workspaceToolDefinitions() []ToolDefinition {
	return []ToolDefinition{
		{Type: "function", Function: FunctionDefinition{Name: "workspace.list", Description: "List files and folders inside the open workspace.", Parameters: json.RawMessage(`{"type":"object","properties":{"path":{"type":"string","description":"Workspace-relative directory path"}},"required":["path"],"additionalProperties":false}`)}},
		{Type: "function", Function: FunctionDefinition{Name: "workspace.readFile", Description: "Read a UTF-8 text file inside the open workspace.", Parameters: json.RawMessage(`{"type":"object","properties":{"path":{"type":"string","description":"Workspace-relative file path"}},"required":["path"],"additionalProperties":false}`)}},
		{Type: "function", Function: FunctionDefinition{Name: "workspace.writeFile", Description: "Write a UTF-8 text file inside the open workspace. Always request user approval.", Parameters: json.RawMessage(`{"type":"object","properties":{"path":{"type":"string","description":"Workspace-relative file path"},"content":{"type":"string"}},"required":["path","content"],"additionalProperties":false}`)}},
	}
}
