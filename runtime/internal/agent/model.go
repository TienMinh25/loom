package agent

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
)

type Message struct {
	Role       string     `json:"role"`
	Content    string     `json:"content,omitempty"`
	Name       string     `json:"name,omitempty"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
}

type ToolCall struct {
	ID       string       `json:"id"`
	Type     string       `json:"type"`
	Function FunctionCall `json:"function"`
}

type FunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type ToolDefinition struct {
	Type     string             `json:"type"`
	Function FunctionDefinition `json:"function"`
}

type FunctionDefinition struct {
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Parameters  json.RawMessage `json:"parameters"`
}

type CompletionRequest struct {
	Model       string           `json:"model"`
	Messages    []Message        `json:"messages"`
	Tools       []ToolDefinition `json:"tools,omitempty"`
	ToolResults []ToolResult     `json:"toolResults,omitempty"`
	Temperature *float64         `json:"temperature,omitempty"`
}

type ToolResult struct {
	ToolCallID string `json:"tool_call_id"`
	Name       string `json:"name"`
	Content    string `json:"content"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens,omitempty"`
	CompletionTokens int `json:"completion_tokens,omitempty"`
	TotalTokens      int `json:"total_tokens,omitempty"`
}

type Completion struct {
	ID           string
	Model        string
	Message      Message
	FinishReason string
	Usage        Usage
}

type ToolCallDelta struct {
	Index     int
	ID        string
	Type      string
	Name      string
	Arguments string
}

type StreamUpdate struct {
	ID           string
	Model        string
	Content      string
	ToolCalls    []ToolCallDelta
	FinishReason string
	Usage        *Usage
	Done         bool
	Error        string
	Approval     *ApprovalRequest
}

type ModelProvider interface {
	Complete(ctx context.Context, request CompletionRequest) (Completion, error)
	Stream(ctx context.Context, request CompletionRequest, onUpdate func(StreamUpdate) error) error
}

type ToolRuntime interface {
	Run(ctx context.Context, request CompletionRequest, emit func(StreamUpdate) error) error
}

type ProviderConfig struct {
	BaseURL string `json:"baseUrl"`
	APIKey  string `json:"apiKey"`
	Model   string `json:"model"`
}

func (config ProviderConfig) Validate() error {
	if strings.TrimSpace(config.BaseURL) == "" {
		return errors.New("provider base URL is required")
	}
	if strings.TrimSpace(config.Model) == "" {
		return errors.New("provider model is required")
	}
	return nil
}

type ModelProviderFactory interface {
	New(config ProviderConfig) (ModelProvider, error)
}
