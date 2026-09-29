package agent

import (
	"context"
	"errors"
	"sync"
)

var (
	ErrProviderNotConfigured = errors.New("model provider is not configured")
	ErrProviderFactoryNeeded = errors.New("model provider factory is required")
)

type Registry struct {
	factory  ModelProviderFactory
	mu       sync.RWMutex
	provider ModelProvider
}

func NewRegistry(factory ModelProviderFactory) *Registry {
	return &Registry{factory: factory}
}

func (registry *Registry) Configure(config ProviderConfig) error {
	if registry == nil || registry.factory == nil {
		return ErrProviderFactoryNeeded
	}
	if err := config.Validate(); err != nil {
		return err
	}
	provider, err := registry.factory.New(config)
	if err != nil {
		return err
	}
	if provider == nil {
		return ErrProviderNotConfigured
	}
	registry.mu.Lock()
	registry.provider = provider
	registry.mu.Unlock()
	return nil
}

func (registry *Registry) Complete(ctx context.Context, request CompletionRequest) (Completion, error) {
	provider, err := registry.current()
	if err != nil {
		return Completion{}, err
	}
	return provider.Complete(ctx, request)
}

func (registry *Registry) Stream(
	ctx context.Context,
	request CompletionRequest,
	onUpdate func(StreamUpdate) error,
) error {
	provider, err := registry.current()
	if err != nil {
		return err
	}
	return provider.Stream(ctx, request, onUpdate)
}

func (registry *Registry) Run(ctx context.Context, request CompletionRequest, executor ToolExecutor, approve ApprovalDecision, emit func(StreamUpdate) error) error {
	provider, err := registry.current()
	if err != nil {
		return err
	}
	return NewToolLoop(provider, executor, approve).Run(ctx, request, emit)
}

func (registry *Registry) RunWithApprovals(ctx context.Context, request CompletionRequest, executor ToolExecutor, broker ApprovalBroker, emit func(StreamUpdate) error) error {
	provider, err := registry.current()
	if err != nil {
		return err
	}
	return NewToolLoopWithBroker(provider, executor, broker).Run(ctx, request, emit)
}

func (registry *Registry) current() (ModelProvider, error) {
	if registry == nil {
		return nil, ErrProviderNotConfigured
	}
	registry.mu.RLock()
	provider := registry.provider
	registry.mu.RUnlock()
	if provider == nil {
		return nil, ErrProviderNotConfigured
	}
	return provider, nil
}
