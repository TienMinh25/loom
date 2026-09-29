package app

import (
	"context"
	"fmt"
	"io"

	"go.uber.org/fx"
)

type RuntimeServer interface {
	Serve(input io.Reader, output io.Writer) error
	Close() error
}

type Streams struct {
	Input  io.Reader
	Output io.Writer
	Errors io.Writer
}

type Runtime struct {
	server     RuntimeServer
	shutdowner fx.Shutdowner
	streams    Streams
}

func NewRuntime(
	lifecycle fx.Lifecycle,
	server RuntimeServer,
	shutdowner fx.Shutdowner,
	streams Streams,
) *Runtime {
	runtime := &Runtime{server: server, shutdowner: shutdowner, streams: streams}
	lifecycle.Append(fx.Hook{
		OnStart: func(context.Context) error {
			go runtime.serve()
			return nil
		},
		OnStop: func(context.Context) error {
			return runtime.server.Close()
		},
	})
	return runtime
}

func (runtime *Runtime) serve() {
	if err := runtime.server.Serve(runtime.streams.Input, runtime.streams.Output); err != nil {
		_, _ = fmt.Fprintln(runtime.streams.Errors, err)
		_ = runtime.shutdowner.Shutdown(fx.ExitCode(1))
		return
	}
	_ = runtime.shutdowner.Shutdown()
}
