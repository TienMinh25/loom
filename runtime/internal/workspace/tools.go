package workspace

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
)

type ToolExecutor struct{ workspace *Workspace }

func NewToolExecutor(workspace *Workspace) *ToolExecutor { return &ToolExecutor{workspace: workspace} }

func (executor *ToolExecutor) Execute(_ context.Context, name string, arguments json.RawMessage) (string, error) {
	if executor == nil || executor.workspace == nil {
		return "", errors.New("workspace is not open")
	}
	switch name {
	case "workspace.list":
		var params struct {
			Path string `json:"path"`
		}
		if err := decodeToolArguments(arguments, &params); err != nil {
			return "", err
		}
		entries, err := executor.workspace.List(params.Path)
		if err != nil {
			return "", err
		}
		encoded, err := json.Marshal(entries)
		return string(encoded), err
	case "workspace.readFile":
		var params struct {
			Path string `json:"path"`
		}
		if err := decodeToolArguments(arguments, &params); err != nil {
			return "", err
		}
		content, err := executor.workspace.ReadFile(params.Path)
		return string(content), err
	case "workspace.writeFile":
		var params struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		}
		if err := decodeToolArguments(arguments, &params); err != nil {
			return "", err
		}
		if err := executor.workspace.WriteFile(params.Path, []byte(params.Content)); err != nil {
			return "", err
		}
		return fmt.Sprintf("Wrote %s", params.Path), nil
	default:
		return "", fmt.Errorf("unsupported workspace tool %q", name)
	}
}

func decodeToolArguments(encoded json.RawMessage, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(encoded))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("invalid tool arguments: %w", err)
	}
	return nil
}
