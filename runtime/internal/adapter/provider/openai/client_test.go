package openai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"loom/runtime/internal/adapter/httpclient"
	"loom/runtime/internal/agent"
)

func TestCompleteUsesOpenAICompatibleRequestAndMapsResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/v1/chat/completions" {
			t.Errorf("path = %q", request.URL.Path)
		}
		if request.Header.Get("Authorization") != "Bearer test-token" {
			t.Errorf("authorization header = %q", request.Header.Get("Authorization"))
		}
		var body struct {
			Model    string            `json:"model"`
			Messages []agent.Message   `json:"messages"`
			Tools    []json.RawMessage `json:"tools"`
		}
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Error(err)
		}
		if body.Model != "test-model" || len(body.Messages) != 1 || body.Messages[0].Content != "hello" {
			t.Errorf("unexpected request: %#v", body)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"id":"chat-1","model":"test-model","choices":[{"message":{"role":"assistant","content":"hello back"},"finish_reason":"stop"}],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`))
	}))
	defer server.Close()

	provider, err := New(Config{BaseURL: server.URL + "/v1/", APIKey: "test-token", Model: "test-model"}, httpclient.NewClient(server.Client()))
	if err != nil {
		t.Fatal(err)
	}
	completion, err := provider.Complete(context.Background(), agent.CompletionRequest{
		Messages: []agent.Message{{Role: "user", Content: "hello"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if completion.ID != "chat-1" || completion.Message.Content != "hello back" || completion.FinishReason != "stop" {
		t.Fatalf("unexpected completion: %#v", completion)
	}
	if completion.Usage.TotalTokens != 5 {
		t.Fatalf("unexpected usage: %#v", completion.Usage)
	}
}

func TestStreamMapsTextToolCallAndTerminalUpdates(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Accept") != "text/event-stream" {
			t.Errorf("Accept = %q", request.Header.Get("Accept"))
		}
		writer.Header().Set("Content-Type", "text/event-stream")
		_, _ = writer.Write([]byte("data: {\"id\":\"chat-2\",\"model\":\"test-model\",\"choices\":[{\"delta\":{\"content\":\"Hi\",\"tool_calls\":[{\"index\":0,\"id\":\"call-1\",\"type\":\"function\",\"function\":{\"name\":\"read_file\",\"arguments\":\"{\\\"path\\\":\"}}]},\"finish_reason\":null}]}\n\ndata: {\"id\":\"chat-2\",\"model\":\"test-model\",\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n"))
	}))
	defer server.Close()
	provider, err := New(Config{BaseURL: server.URL, Model: "test-model"}, httpclient.NewClient(server.Client()))
	if err != nil {
		t.Fatal(err)
	}
	var updates []agent.StreamUpdate
	err = provider.Stream(context.Background(), agent.CompletionRequest{
		Messages: []agent.Message{{Role: "user", Content: "read file"}},
	}, func(update agent.StreamUpdate) error {
		updates = append(updates, update)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(updates) != 2 || updates[0].Content != "Hi" || !updates[1].Done || updates[1].FinishReason != "stop" {
		t.Fatalf("unexpected stream updates: %#v", updates)
	}
	if len(updates[0].ToolCalls) != 1 || updates[0].ToolCalls[0].Name != "read_file" || updates[0].ToolCalls[0].Arguments != `{"path":` {
		t.Fatalf("unexpected tool call delta: %#v", updates[0].ToolCalls)
	}
}

func TestNewValidatesBaseURLAndModel(t *testing.T) {
	if _, err := New(Config{BaseURL: "file:///etc", Model: "test"}, httpclient.NewClient(nil)); err == nil {
		t.Fatal("expected invalid base URL to fail")
	}
	if _, err := New(Config{BaseURL: "https://example.test/", Model: ""}, httpclient.NewClient(nil)); err == nil {
		t.Fatal("expected default model to be required")
	}
	if _, err := New(Config{BaseURL: "https://example.test/", Model: "test"}, nil); err == nil || !strings.Contains(err.Error(), "HTTP client") {
		t.Fatalf("nil HTTP client error = %v", err)
	}
}
