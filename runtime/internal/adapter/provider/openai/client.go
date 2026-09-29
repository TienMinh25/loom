package openai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"loom/runtime/internal/adapter/httpclient"
	"loom/runtime/internal/agent"
)

type Config struct {
	BaseURL string
	APIKey  string
	Model   string
}

type Client struct {
	httpClient *httpclient.Client
	endpoint   string
	apiKey     string
	model      string
}

type Factory struct {
	httpClient *httpclient.Client
}

type chatRequest struct {
	Model       string                 `json:"model"`
	Messages    []agent.Message        `json:"messages"`
	Tools       []agent.ToolDefinition `json:"tools,omitempty"`
	Temperature *float64               `json:"temperature,omitempty"`
	Stream      bool                   `json:"stream,omitempty"`
}

type chatResponse struct {
	ID      string             `json:"id"`
	Model   string             `json:"model"`
	Choices []completionChoice `json:"choices"`
	Usage   agent.Usage        `json:"usage"`
}

type completionChoice struct {
	Message      agent.Message `json:"message"`
	FinishReason string        `json:"finish_reason"`
}

type streamChunk struct {
	ID      string         `json:"id"`
	Model   string         `json:"model"`
	Choices []streamChoice `json:"choices"`
	Usage   *agent.Usage   `json:"usage,omitempty"`
}

type streamChoice struct {
	Delta        messageDelta `json:"delta"`
	FinishReason *string      `json:"finish_reason"`
}

type messageDelta struct {
	Content   string          `json:"content"`
	ToolCalls []toolCallDelta `json:"tool_calls,omitempty"`
}

type toolCallDelta struct {
	Index    int               `json:"index"`
	ID       string            `json:"id,omitempty"`
	Type     string            `json:"type,omitempty"`
	Function functionCallDelta `json:"function"`
}

type functionCallDelta struct {
	Name      string `json:"name,omitempty"`
	Arguments string `json:"arguments,omitempty"`
}

func NewFactory(client *httpclient.Client) *Factory {
	return &Factory{httpClient: client}
}

func (factory *Factory) New(config agent.ProviderConfig) (agent.ModelProvider, error) {
	if factory == nil {
		return nil, errors.New("OpenAI-compatible provider factory is required")
	}
	return New(Config{BaseURL: config.BaseURL, APIKey: config.APIKey, Model: config.Model}, factory.httpClient)
}

func New(config Config, client *httpclient.Client) (*Client, error) {
	baseURL, err := url.Parse(strings.TrimSpace(config.BaseURL))
	if err != nil || (baseURL.Scheme != "http" && baseURL.Scheme != "https") || baseURL.Host == "" {
		return nil, errors.New("OpenAI-compatible base URL must be an absolute http or https URL")
	}
	if baseURL.RawQuery != "" || baseURL.Fragment != "" {
		return nil, errors.New("OpenAI-compatible base URL cannot contain a query or fragment")
	}
	model := strings.TrimSpace(config.Model)
	if model == "" {
		return nil, errors.New("default model is required")
	}
	if client == nil {
		return nil, errors.New("HTTP client is required")
	}
	baseURL.Path = strings.TrimRight(baseURL.Path, "/") + "/chat/completions"
	baseURL.RawPath = ""
	return &Client{
		httpClient: client,
		endpoint:   baseURL.String(),
		apiKey:     strings.TrimSpace(config.APIKey),
		model:      model,
	}, nil
}

func (client *Client) Complete(ctx context.Context, request agent.CompletionRequest) (agent.Completion, error) {
	payload, err := client.requestPayload(request, false)
	if err != nil {
		return agent.Completion{}, err
	}
	response, err := httpclient.DoJSON[chatResponse](ctx, client.httpClient, client.newRequest(payload))
	if err != nil {
		return agent.Completion{}, err
	}
	if len(response.Body.Choices) == 0 {
		return agent.Completion{}, errors.New("OpenAI-compatible response did not contain a choice")
	}
	choice := response.Body.Choices[0]
	return agent.Completion{
		ID:           response.Body.ID,
		Model:        response.Body.Model,
		Message:      choice.Message,
		FinishReason: choice.FinishReason,
		Usage:        response.Body.Usage,
	}, nil
}

func (client *Client) Stream(
	ctx context.Context,
	request agent.CompletionRequest,
	onUpdate func(agent.StreamUpdate) error,
) error {
	if onUpdate == nil {
		return errors.New("stream update handler is required")
	}
	payload, err := client.requestPayload(request, true)
	if err != nil {
		return err
	}
	_, err = httpclient.Stream(ctx, client.httpClient, client.newRequest(payload), func(event httpclient.Event) error {
		if event.Data == "[DONE]" {
			return nil
		}
		var chunk streamChunk
		if err := json.Unmarshal([]byte(event.Data), &chunk); err != nil {
			return fmt.Errorf("decode OpenAI-compatible stream event: %w", err)
		}
		if len(chunk.Choices) == 0 {
			if chunk.Usage != nil {
				return onUpdate(agent.StreamUpdate{ID: chunk.ID, Model: chunk.Model, Usage: chunk.Usage})
			}
			return nil
		}
		for _, choice := range chunk.Choices {
			update := agent.StreamUpdate{ID: chunk.ID, Model: chunk.Model, Content: choice.Delta.Content}
			for _, tool := range choice.Delta.ToolCalls {
				update.ToolCalls = append(update.ToolCalls, agent.ToolCallDelta{
					Index:     tool.Index,
					ID:        tool.ID,
					Type:      tool.Type,
					Name:      tool.Function.Name,
					Arguments: tool.Function.Arguments,
				})
			}
			if choice.FinishReason != nil {
				update.FinishReason = *choice.FinishReason
				update.Done = true
			}
			if chunk.Usage != nil {
				usage := *chunk.Usage
				update.Usage = &usage
			}
			if err := onUpdate(update); err != nil {
				return err
			}
		}
		return nil
	})
	return err
}

func (client *Client) requestPayload(request agent.CompletionRequest, stream bool) (chatRequest, error) {
	if len(request.Messages) == 0 {
		return chatRequest{}, errors.New("at least one chat message is required")
	}
	model := strings.TrimSpace(request.Model)
	if model == "" {
		model = client.model
	}
	return chatRequest{
		Model:       model,
		Messages:    request.Messages,
		Tools:       request.Tools,
		Temperature: request.Temperature,
		Stream:      stream,
	}, nil
}

func (client *Client) newRequest(payload chatRequest) httpclient.Request {
	headers := make(http.Header)
	if client.apiKey != "" {
		headers.Set("Authorization", "Bearer "+client.apiKey)
	}
	return httpclient.Request{
		Method:  http.MethodPost,
		URL:     client.endpoint,
		Headers: headers,
		Body:    payload,
	}
}
