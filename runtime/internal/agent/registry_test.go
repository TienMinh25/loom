package agent

import (
	"context"
	"errors"
	"testing"
)

type fakeProviderFactory struct {
	provider ModelProvider
	err      error
	configs  []ProviderConfig
}

func (factory *fakeProviderFactory) New(config ProviderConfig) (ModelProvider, error) {
	factory.configs = append(factory.configs, config)
	return factory.provider, factory.err
}

type fakeProvider struct {
	updates []StreamUpdate
}

func (provider *fakeProvider) Complete(context.Context, CompletionRequest) (Completion, error) {
	return Completion{}, nil
}

func (provider *fakeProvider) Stream(_ context.Context, _ CompletionRequest, onUpdate func(StreamUpdate) error) error {
	update := StreamUpdate{Content: "hello"}
	provider.updates = append(provider.updates, update)
	return onUpdate(update)
}

func TestRegistryRequiresConfiguredProvider(t *testing.T) {
	registry := NewRegistry(&fakeProviderFactory{})
	err := registry.Stream(context.Background(), CompletionRequest{}, func(StreamUpdate) error { return nil })
	if !errors.Is(err, ErrProviderNotConfigured) {
		t.Fatalf("error = %v, want provider-not-configured", err)
	}
}

func TestRegistryBuildsAndDelegatesToConfiguredProvider(t *testing.T) {
	provider := &fakeProvider{}
	factory := &fakeProviderFactory{provider: provider}
	registry := NewRegistry(factory)
	config := ProviderConfig{BaseURL: "https://gateway.example/v1", APIKey: "secret", Model: "model"}
	if err := registry.Configure(config); err != nil {
		t.Fatal(err)
	}
	var updates []StreamUpdate
	if err := registry.Stream(context.Background(), CompletionRequest{}, func(update StreamUpdate) error {
		updates = append(updates, update)
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if len(factory.configs) != 1 || factory.configs[0] != config {
		t.Fatalf("factory configs = %#v", factory.configs)
	}
	if len(provider.updates) != 1 || len(updates) != 1 || updates[0].Content != "hello" {
		t.Fatalf("provider updates = %#v; callback updates = %#v", provider.updates, updates)
	}
}

func TestRegistryRetainsLastGoodProviderWhenConfigurationFails(t *testing.T) {
	provider := &fakeProvider{}
	factory := &fakeProviderFactory{provider: provider}
	registry := NewRegistry(factory)
	if err := registry.Configure(ProviderConfig{BaseURL: "https://gateway.example/v1", Model: "model"}); err != nil {
		t.Fatal(err)
	}
	factory.err = errors.New("bad configuration")
	if err := registry.Configure(ProviderConfig{BaseURL: "file:///etc", Model: "bad"}); err == nil {
		t.Fatal("expected invalid configuration to fail")
	}
	if err := registry.Stream(context.Background(), CompletionRequest{}, func(StreamUpdate) error { return nil }); err != nil {
		t.Fatalf("last good provider was not retained: %v", err)
	}
}

func TestRegistryRejectsMissingProviderSettings(t *testing.T) {
	registry := NewRegistry(&fakeProviderFactory{provider: &fakeProvider{}})
	if err := registry.Configure(ProviderConfig{BaseURL: "https://example.test/v1"}); err == nil {
		t.Fatal("expected missing model to fail configuration")
	}
	if err := registry.Stream(context.Background(), CompletionRequest{}, func(StreamUpdate) error { return nil }); !errors.Is(err, ErrProviderNotConfigured) {
		t.Fatalf("provider after invalid configuration error = %v", err)
	}
}
