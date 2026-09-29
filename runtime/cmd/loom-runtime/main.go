package main

import (
	"os"

	"go.uber.org/fx"
	"loom/runtime/internal/app"
	"loom/runtime/internal/adapter/httpclient"
	"loom/runtime/internal/adapter/provider/openai"
	"loom/runtime/internal/agent"
	"loom/runtime/internal/protocol"
)

func main() {
	application := fx.New(
		fx.Provide(
			func() *httpclient.Client { return httpclient.NewClient(nil) },
			func(client *httpclient.Client) agent.ModelProviderFactory { return openai.NewFactory(client) },
			func(factory agent.ModelProviderFactory) *agent.Registry { return agent.NewRegistry(factory) },
			func(registry *agent.Registry) protocol.ModelRuntime { return registry },
			func(models protocol.ModelRuntime) app.RuntimeServer { return protocol.NewServer(models) },
			func() app.Streams {
				return app.Streams{Input: os.Stdin, Output: os.Stdout, Errors: os.Stderr}
			},
		),
		fx.Invoke(app.NewRuntime),
		fx.NopLogger,
	)
	if err := application.Err(); err != nil {
		_, _ = os.Stderr.WriteString(err.Error() + "\n")
		os.Exit(1)
	}
	application.Run()
	if err := application.Err(); err != nil {
		_, _ = os.Stderr.WriteString(err.Error() + "\n")
		os.Exit(1)
	}
}
