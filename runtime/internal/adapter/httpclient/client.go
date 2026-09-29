package httpclient

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	maxResponseBytes = 16 << 20
	maxErrorBytes    = 4 << 10
	maxStreamLine    = 1 << 20
)

type HTTPDoer interface {
	Do(request *http.Request) (*http.Response, error)
}

type Client struct {
	doer HTTPDoer
}

type Request struct {
	Method  string
	URL     string
	Headers http.Header
	Body    any
}

type Response[T any] struct {
	StatusCode int
	Headers    http.Header
	Body       T
}

type ResponseInfo struct {
	StatusCode int
	Headers    http.Header
}

type Event struct {
	ID   string
	Type string
	Data string
}

type HTTPError struct {
	StatusCode int
	Body       string
}

func (httpError *HTTPError) Error() string {
	if httpError.Body == "" {
		return fmt.Sprintf("HTTP request failed with status %d", httpError.StatusCode)
	}
	return fmt.Sprintf("HTTP request failed with status %d: %s", httpError.StatusCode, httpError.Body)
}

func NewClient(doer HTTPDoer) *Client {
	if doer == nil {
		doer = newDefaultHTTPClient()
	}
	return &Client{doer: doer}
}

func DoJSON[ResponseBody any](
	ctx context.Context,
	client *Client,
	request Request,
) (Response[ResponseBody], error) {
	var empty Response[ResponseBody]
	doer, err := getDoer(client)
	if err != nil {
		return empty, err
	}
	httpRequest, err := newHTTPRequest(ctx, request)
	if err != nil {
		return empty, err
	}
	if httpRequest.Header.Get("Accept") == "" {
		httpRequest.Header.Set("Accept", "application/json")
	}
	response, err := doer.Do(httpRequest)
	if err != nil {
		return empty, fmt.Errorf("send HTTP request: %w", err)
	}
	defer response.Body.Close()

	body, err := readLimited(response.Body, maxResponseBytes)
	if err != nil {
		return empty, err
	}
	if !isSuccess(response.StatusCode) {
		return empty, newHTTPError(response.StatusCode, body)
	}
	result := Response[ResponseBody]{StatusCode: response.StatusCode, Headers: response.Header.Clone()}
	if len(bytes.TrimSpace(body)) == 0 {
		return result, nil
	}
	if err := json.Unmarshal(body, &result.Body); err != nil {
		return empty, fmt.Errorf("decode HTTP JSON response: %w", err)
	}
	return result, nil
}

func Stream(
	ctx context.Context,
	client *Client,
	request Request,
	handleEvent func(Event) error,
) (ResponseInfo, error) {
	var empty ResponseInfo
	if handleEvent == nil {
		return empty, errors.New("stream event handler is required")
	}
	doer, err := getDoer(client)
	if err != nil {
		return empty, err
	}
	httpRequest, err := newHTTPRequest(ctx, request)
	if err != nil {
		return empty, err
	}
	httpRequest.Header.Set("Accept", "text/event-stream")
	response, err := doer.Do(httpRequest)
	if err != nil {
		return empty, fmt.Errorf("send streaming HTTP request: %w", err)
	}
	defer response.Body.Close()
	if !isSuccess(response.StatusCode) {
		body, readErr := readLimited(response.Body, maxResponseBytes)
		if readErr != nil {
			return empty, readErr
		}
		return empty, newHTTPError(response.StatusCode, body)
	}
	mediaType, _, err := mime.ParseMediaType(response.Header.Get("Content-Type"))
	if err != nil || mediaType != "text/event-stream" {
		return empty, errors.New("streaming HTTP response must use text/event-stream")
	}

	if err := readEvents(response.Body, handleEvent); err != nil {
		return empty, err
	}
	return ResponseInfo{StatusCode: response.StatusCode, Headers: response.Header.Clone()}, nil
}

func getDoer(client *Client) (HTTPDoer, error) {
	if client == nil || client.doer == nil {
		return nil, errors.New("HTTP client is required")
	}
	return client.doer, nil
}

func newDefaultHTTPClient() *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			Proxy:                  http.ProxyFromEnvironment,
			MaxIdleConns:           100,
			MaxIdleConnsPerHost:    10,
			IdleConnTimeout:        90 * time.Second,
			TLSHandshakeTimeout:    10 * time.Second,
			ResponseHeaderTimeout:  30 * time.Second,
			ExpectContinueTimeout:  time.Second,
			ForceAttemptHTTP2:      true,
			DisableKeepAlives:      false,
			DisableCompression:     false,
			MaxResponseHeaderBytes: 1 << 20,
		},
	}
}

func newHTTPRequest(ctx context.Context, request Request) (*http.Request, error) {
	if request.Method == "" {
		return nil, errors.New("HTTP method is required")
	}
	parsedURL, err := url.ParseRequestURI(request.URL)
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") || parsedURL.Host == "" {
		return nil, errors.New("HTTP URL must be an absolute http or https URL")
	}
	var body io.Reader
	if request.Body != nil {
		encoded, err := json.Marshal(request.Body)
		if err != nil {
			return nil, fmt.Errorf("encode HTTP JSON request: %w", err)
		}
		body = bytes.NewReader(encoded)
	}
	httpRequest, err := http.NewRequestWithContext(ctx, request.Method, parsedURL.String(), body)
	if err != nil {
		return nil, fmt.Errorf("create HTTP request: %w", err)
	}
	httpRequest.Header = request.Headers.Clone()
	if httpRequest.Header == nil {
		httpRequest.Header = make(http.Header)
	}
	if request.Body != nil && httpRequest.Header.Get("Content-Type") == "" {
		httpRequest.Header.Set("Content-Type", "application/json")
	}
	return httpRequest, nil
}

func readLimited(reader io.Reader, limit int64) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil {
		return nil, fmt.Errorf("read HTTP response: %w", err)
	}
	if int64(len(body)) > limit {
		return nil, fmt.Errorf("HTTP response exceeds %d byte limit", limit)
	}
	return body, nil
}

func newHTTPError(status int, body []byte) *HTTPError {
	if len(body) > maxErrorBytes {
		body = body[:maxErrorBytes]
	}
	return &HTTPError{StatusCode: status, Body: strings.TrimSpace(string(body))}
}

func isSuccess(status int) bool {
	return status >= http.StatusOK && status < http.StatusMultipleChoices
}

func readEvents(reader io.Reader, handleEvent func(Event) error) error {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 64*1024), maxStreamLine)
	var event Event
	var dataLines []string
	dispatch := func() error {
		if len(dataLines) == 0 {
			event = Event{}
			return nil
		}
		event.Data = strings.Join(dataLines, "\n")
		if err := handleEvent(event); err != nil {
			return err
		}
		event = Event{}
		dataLines = dataLines[:0]
		return nil
	}

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			if err := dispatch(); err != nil {
				return err
			}
			continue
		}
		if strings.HasPrefix(line, ":") {
			continue
		}
		field, value, found := strings.Cut(line, ":")
		if !found {
			value = ""
		} else {
			value = strings.TrimPrefix(value, " ")
		}
		switch field {
		case "id":
			if !strings.ContainsRune(value, '\x00') {
				event.ID = value
			}
		case "event":
			event.Type = value
		case "data":
			dataLines = append(dataLines, value)
		}
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read streaming HTTP response: %w", err)
	}
	return nil
}
