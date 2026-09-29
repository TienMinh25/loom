package httpclient

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDoJSONEncodesRequestAndDecodesResponse(t *testing.T) {
	type input struct {
		Prompt string `json:"prompt"`
	}
	type output struct {
		Answer string `json:"answer"`
	}
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost {
			t.Errorf("method = %q, want POST", request.Method)
		}
		if request.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Content-Type = %q", request.Header.Get("Content-Type"))
		}
		var body input
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Error(err)
		}
		if body.Prompt != "hello" {
			t.Errorf("prompt = %q, want hello", body.Prompt)
		}
		writer.Header().Set("X-Request-ID", "req-123")
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"answer":"world"}`))
	}))
	defer server.Close()

	response, err := DoJSON[output](context.Background(), NewClient(server.Client()), Request{
		Method: http.MethodPost,
		URL:    server.URL,
		Body:   input{Prompt: "hello"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != http.StatusOK || response.Body.Answer != "world" {
		t.Fatalf("unexpected response: %#v", response)
	}
	if response.Headers.Get("X-Request-ID") != "req-123" {
		t.Fatalf("missing response headers: %#v", response.Headers)
	}
}

func TestDoJSONReturnsStructuredHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		http.Error(writer, `{"error":"unauthorized"}`, http.StatusUnauthorized)
	}))
	defer server.Close()

	_, err := DoJSON[struct{}](context.Background(), NewClient(server.Client()), Request{
		Method: http.MethodGet,
		URL:    server.URL,
	})
	var httpError *HTTPError
	if !errors.As(err, &httpError) || httpError.StatusCode != http.StatusUnauthorized {
		t.Fatalf("error = %v, want HTTP 401", err)
	}
}

func TestStreamParsesSSEEventsAndDoneSentinel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Accept") != "text/event-stream" {
			t.Errorf("Accept = %q, want text/event-stream", request.Header.Get("Accept"))
		}
		writer.Header().Set("Content-Type", "text/event-stream")
		_, _ = writer.Write([]byte("id: 7\nevent: delta\ndata: {\"text\":\"one\"}\ndata: {\"text\":\"two\"}\n\ndata: [DONE]\n\n"))
	}))
	defer server.Close()

	var events []Event
	meta, err := Stream(context.Background(), NewClient(server.Client()), Request{
		Method: http.MethodPost,
		URL:    server.URL,
		Body:   map[string]string{"prompt": "hello"},
	}, func(event Event) error {
		events = append(events, event)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if meta.StatusCode != http.StatusOK || len(events) != 2 {
		t.Fatalf("meta = %#v; events = %#v", meta, events)
	}
	if events[0].ID != "7" || events[0].Type != "delta" || events[0].Data != "{\"text\":\"one\"}\n{\"text\":\"two\"}" {
		t.Fatalf("unexpected event: %#v", events[0])
	}
	if events[1].Data != "[DONE]" {
		t.Fatalf("expected raw provider event data to remain intact: %#v", events[1])
	}
}

func TestStreamPropagatesHandlerFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "text/event-stream")
		_, _ = writer.Write([]byte("data: {\"text\":\"one\"}\n\n"))
	}))
	defer server.Close()
	wantErr := errors.New("consumer stopped")

	_, err := Stream(context.Background(), NewClient(server.Client()), Request{
		Method: http.MethodGet,
		URL:    server.URL,
	}, func(Event) error { return wantErr })
	if !errors.Is(err, wantErr) {
		t.Fatalf("error = %v, want handler error", err)
	}
}

func TestDoJSONRejectsResponseLargerThanLimit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write([]byte(strings.Repeat("x", maxResponseBytes+1)))
	}))
	defer server.Close()

	_, err := DoJSON[struct{}](context.Background(), NewClient(server.Client()), Request{
		Method: http.MethodGet,
		URL:    server.URL,
	})
	if err == nil || !strings.Contains(err.Error(), "response exceeds") {
		t.Fatalf("error = %v, want response size error", err)
	}
}

func TestDoJSONRequiresExplicitClientAndAbsoluteHTTPURL(t *testing.T) {
	_, err := DoJSON[struct{}](context.Background(), nil, Request{
		Method: http.MethodGet,
		URL:    "https://example.com",
	})
	if err == nil || !strings.Contains(err.Error(), "HTTP client is required") {
		t.Fatalf("nil client error = %v", err)
	}

	_, err = DoJSON[struct{}](context.Background(), NewClient(nil), Request{
		Method: http.MethodGet,
		URL:    "file:///etc/passwd",
	})
	if err == nil || !strings.Contains(err.Error(), "absolute http or https URL") {
		t.Fatalf("invalid URL error = %v", err)
	}
}
