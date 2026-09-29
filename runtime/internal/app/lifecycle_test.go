package app

import (
	"context"
	"errors"
	"io"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"go.uber.org/fx"
)

type fakeRuntimeServer struct {
	started  atomic.Bool
	closed   atomic.Bool
	serveErr error
}

func (server *fakeRuntimeServer) Serve(_ io.Reader, _ io.Writer) error {
	server.started.Store(true)
	return server.serveErr
}

func (server *fakeRuntimeServer) Close() error {
	server.closed.Store(true)
	return nil
}

func TestRuntimeServerRunsAndClosesWithFxLifecycle(t *testing.T) {
	server := &fakeRuntimeServer{}
	application := fx.New(
		fx.Provide(
			func() Streams {
				return Streams{Input: strings.NewReader(""), Output: io.Discard, Errors: io.Discard}
			},
			func() RuntimeServer { return server },
		),
		fx.Invoke(NewRuntime),
		fx.NopLogger,
	)
	if err := application.Err(); err != nil {
		t.Fatal(err)
	}

	shutdown := application.Wait()
	if err := application.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	deadline := time.After(time.Second)
	for !server.started.Load() {
		select {
		case <-deadline:
			t.Fatal("runtime server did not start")
		default:
			time.Sleep(time.Millisecond)
		}
	}
	select {
	case signal := <-shutdown:
		if signal.ExitCode != 0 {
			t.Fatalf("normal EOF exit code = %d, want 0", signal.ExitCode)
		}
	case <-time.After(time.Second):
		t.Fatal("runtime server did not request graceful shutdown at EOF")
	}

	if err := application.Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
	if !server.closed.Load() {
		t.Fatal("runtime server was not closed during Fx shutdown")
	}
}

func TestRuntimeServerUsesFailureExitCodeAndWritesErrorToStderr(t *testing.T) {
	server := &fakeRuntimeServer{serveErr: errors.New("runtime stream failed")}
	var stderr strings.Builder
	application := fx.New(
		fx.Provide(
			func() Streams {
				return Streams{Input: strings.NewReader(""), Output: io.Discard, Errors: &stderr}
			},
			func() RuntimeServer { return server },
		),
		fx.Invoke(NewRuntime),
		fx.NopLogger,
	)
	if err := application.Err(); err != nil {
		t.Fatal(err)
	}
	shutdown := application.Wait()
	if err := application.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	select {
	case signal := <-shutdown:
		if signal.ExitCode != 1 {
			t.Fatalf("failure exit code = %d, want 1", signal.ExitCode)
		}
	case <-time.After(time.Second):
		t.Fatal("runtime failure did not request process shutdown")
	}
	if !strings.Contains(stderr.String(), "runtime stream failed") {
		t.Fatalf("stderr = %q", stderr.String())
	}
	if err := application.Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
}
