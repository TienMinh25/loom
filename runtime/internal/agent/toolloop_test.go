package agent

import (
	"context"
	"encoding/json"
	"testing"
)

type sequenceProvider struct {
	responses []Completion
	requests  []CompletionRequest
}

func (provider *sequenceProvider) Complete(_ context.Context, request CompletionRequest) (Completion, error) {
	provider.requests = append(provider.requests, request)
	if len(provider.responses) == 0 {
		return Completion{Message: Message{Role: "assistant", Content: "Done"}}, nil
	}
	response := provider.responses[0]
	provider.responses = provider.responses[1:]
	return response, nil
}

type fakeExecutor struct{ calls []string }

func (provider *sequenceProvider) Stream(_ context.Context, request CompletionRequest, emit func(StreamUpdate) error) error {
	provider.requests = append(provider.requests, request)
	var completion Completion
	if len(provider.responses) > 0 {
		completion = provider.responses[0]
		provider.responses = provider.responses[1:]
	}
	for _, call := range completion.Message.ToolCalls {
		if err := emit(StreamUpdate{ID: completion.ID, Model: completion.Model, ToolCalls: []ToolCallDelta{{Index: 0, ID: call.ID, Type: call.Type, Name: call.Function.Name, Arguments: call.Function.Arguments}}}); err != nil {
			return err
		}
	}
	if completion.Message.Content != "" {
		first := len(completion.Message.Content) / 2
		if first == 0 {
			first = len(completion.Message.Content)
		}
		if err := emit(StreamUpdate{ID: completion.ID, Model: completion.Model, Content: completion.Message.Content[:first]}); err != nil {
			return err
		}
		if first < len(completion.Message.Content) {
			if err := emit(StreamUpdate{ID: completion.ID, Model: completion.Model, Content: completion.Message.Content[first:]}); err != nil {
				return err
			}
		}
	}
	return emit(StreamUpdate{ID: completion.ID, Model: completion.Model, FinishReason: completion.FinishReason, Done: true})
}

func (executor *fakeExecutor) Execute(_ context.Context, name string, args json.RawMessage) (string, error) {
	executor.calls = append(executor.calls, name+":"+string(args))
	return "file contents", nil
}

func TestToolLoopRequiresApprovalBeforeExecutingWorkspaceTools(t *testing.T) {
	provider := &sequenceProvider{responses: []Completion{{Message: Message{Role: "assistant", ToolCalls: []ToolCall{{ID: "call-1", Type: "function", Function: FunctionCall{Name: "workspace.readFile", Arguments: `{"path":"src/main.go"}`}}}}}}}
	executor := &fakeExecutor{}
	loop := NewToolLoop(provider, executor, func(context.Context, string, json.RawMessage) (bool, error) { return false, nil })
	err := loop.Run(context.Background(), CompletionRequest{Messages: []Message{{Role: "user", Content: "read source"}}}, func(StreamUpdate) error { return nil })
	if err != nil || len(executor.calls) != 0 || len(provider.requests) != 2 {
		t.Fatalf("err=%v, executed=%v", err, executor.calls)
	}
}

func TestToolLoopReturnsApprovalDenialToModelWithoutExecutingTool(t *testing.T) {
	provider := &sequenceProvider{responses: []Completion{
		{ID: "call", Model: "mock", Message: Message{Role: "assistant", ToolCalls: []ToolCall{{ID: "denied-call", Type: "function", Function: FunctionCall{Name: "workspace.writeFile", Arguments: `{"path":"main.go","content":"unsafe"}`}}}}},
		{ID: "final", Model: "mock", Message: Message{Role: "assistant", Content: "Understood, I did not change the file."}},
	}}
	executor := &fakeExecutor{}
	loop := NewToolLoop(provider, executor, func(context.Context, string, json.RawMessage) (bool, error) { return false, nil })
	var updates []StreamUpdate
	if err := loop.Run(context.Background(), CompletionRequest{Messages: []Message{{Role: "user", Content: "change it"}}}, func(value StreamUpdate) error { updates = append(updates, value); return nil }); err != nil {
		t.Fatal(err)
	}
	if len(executor.calls) != 0 || len(provider.requests) != 2 || len(provider.requests[1].Messages) != 3 || provider.requests[1].Messages[2].Content != `{"approved":false,"reason":"user rejected the action"}` || len(updates) < 2 || !updates[len(updates)-1].Done {
		t.Fatalf("tool calls=%v requests=%#v updates=%#v", executor.calls, provider.requests, updates)
	}
}

func TestToolLoopExecutesApprovedToolAndReturnsTheFinalTurn(t *testing.T) {
	provider := &sequenceProvider{responses: []Completion{
		{ID: "call", Model: "mock", Message: Message{Role: "assistant", ToolCalls: []ToolCall{{ID: "call-1", Type: "function", Function: FunctionCall{Name: "workspace.readFile", Arguments: `{"path":"src/main.go"}`}}}}},
		{ID: "final", Model: "mock", FinishReason: "stop", Message: Message{Role: "assistant", Content: "The file defines main."}},
	}}
	executor := &fakeExecutor{}
	loop := NewToolLoop(provider, executor, func(context.Context, string, json.RawMessage) (bool, error) { return true, nil })
	var updates []StreamUpdate
	err := loop.Run(context.Background(), CompletionRequest{Messages: []Message{{Role: "user", Content: "summarize"}}}, func(update StreamUpdate) error { updates = append(updates, update); return nil })
	if err != nil {
		t.Fatal(err)
	}
	if len(executor.calls) != 1 || len(provider.requests) != 2 || len(provider.requests[1].Messages) != 3 {
		t.Fatalf("calls=%v requests=%#v", executor.calls, provider.requests)
	}
	if len(provider.requests[0].Tools) != 3 || provider.requests[0].Tools[2].Function.Name != "workspace.writeFile" {
		t.Fatalf("workspace tool definitions were not offered: %#v", provider.requests[0].Tools)
	}
	if len(updates) != 3 || updates[0].Content+updates[1].Content != "The file defines main." || !updates[2].Done {
		t.Fatalf("updates=%#v", updates)
	}
}

func TestToolLoopStreamsFinalTextAsItArrives(t *testing.T) {
	provider := &sequenceProvider{responses: []Completion{
		{ID: "final", Model: "mock", FinishReason: "stop", Message: Message{Role: "assistant", Content: "streamed answer"}},
	}}
	loop := NewToolLoop(provider, &fakeExecutor{}, func(context.Context, string, json.RawMessage) (bool, error) { return true, nil })
	var updates []StreamUpdate
	if err := loop.Run(context.Background(), CompletionRequest{Messages: []Message{{Role: "user", Content: "hello"}}}, func(update StreamUpdate) error {
		updates = append(updates, update)
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if len(updates) != 3 || updates[0].Content+updates[1].Content != "streamed answer" || !updates[2].Done {
		t.Fatalf("expected incremental text followed by terminal update, got %#v", updates)
	}
}

func TestToolLoopEmitsApprovalRequestThenAwaitsBrokerBeforeExecuting(t *testing.T) {
	provider := &sequenceProvider{responses: []Completion{
		{Message: Message{Role: "assistant", ToolCalls: []ToolCall{{ID: "call-write", Type: "function", Function: FunctionCall{Name: "workspace.writeFile", Arguments: `{"path":"src/main.go","content":"new"}`}}}}},
		{Message: Message{Role: "assistant", Content: "File updated"}},
	}}
	executor := &fakeExecutor{}
	broker := &fakeApprovalBroker{approved: true}
	loop := NewToolLoopWithBroker(provider, executor, broker)
	var updates []StreamUpdate
	err := loop.Run(context.Background(), CompletionRequest{Messages: []Message{{Role: "user", Content: "edit"}}}, func(update StreamUpdate) error { updates = append(updates, update); return nil })
	if err != nil {
		t.Fatal(err)
	}
	if len(updates) != 4 || updates[0].Approval == nil || updates[0].Approval.ToolName != "workspace.writeFile" || broker.request.ID != "call-write" || len(executor.calls) != 1 || !updates[3].Done {
		t.Fatalf("updates=%#v approval=%#v calls=%v", updates, broker.request, executor.calls)
	}
}

func TestRegistryStreamDelegatesToProviderStreamWithToolArguments(t *testing.T) {
	provider := &sequenceProvider{responses: []Completion{{Message: Message{Role: "assistant", Content: "response"}}}}
	registry := NewRegistry(&fakeProviderFactory{provider: provider})
	if err := registry.Configure(ProviderConfig{BaseURL: "https://example.test/v1", Model: "test"}); err != nil {
		t.Fatal(err)
	}
	var updates []StreamUpdate
	if err := registry.Stream(context.Background(), CompletionRequest{Messages: []Message{{Role: "user", Content: "read"}}}, func(value StreamUpdate) error { updates = append(updates, value); return nil }); err != nil {
		t.Fatal(err)
	}
	if len(updates) != 3 || updates[0].Content+updates[1].Content != "response" || !updates[2].Done {
		t.Fatalf("stream updates=%#v", updates)
	}
}

type fakeApprovalBroker struct {
	approved bool
	request  ApprovalRequest
}

func (broker *fakeApprovalBroker) Request(_ context.Context, request ApprovalRequest) (bool, error) {
	broker.request = request
	return broker.approved, nil
}
