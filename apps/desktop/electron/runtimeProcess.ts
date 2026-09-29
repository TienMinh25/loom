import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { join } from "node:path";
import type { RuntimeTransport } from "./runtimeClient.js";
import { RuntimeClient } from "./runtimeClient.js";

export class ChildProcessTransport implements RuntimeTransport {
  private readonly child: ReturnType<typeof spawn>;
  private readonly lineReader;
  private readonly messageListeners = new Set<(message: string) => void>();
  private readonly exitListeners = new Set<(error: Error) => void>();
  private closed = false;
  private shutdownTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(child: ReturnType<typeof spawn>) {
    this.child = child;
    if (!child.stdin || !child.stdout || !child.stderr) {
      throw new Error("runtime process did not provide stdio pipes");
    }

    this.lineReader = createInterface({ input: child.stdout });
    this.lineReader.on("line", (message) => {
      for (const listener of this.messageListeners) {
        listener(message);
      }
    });
    child.stderr.resume();
    child.on("error", (error) => this.notifyExit(error));
    child.on("close", (code, signal) => {
      if (this.shutdownTimer) {
        clearTimeout(this.shutdownTimer);
        this.shutdownTimer = null;
      }
      if (!this.closed) {
        this.notifyExit(
          new Error(`runtime exited (code ${code ?? "none"}, signal ${signal ?? "none"})`),
        );
      }
    });
  }

  send(message: string) {
    if (this.closed || !this.child.stdin?.writable) {
      throw new Error("runtime process is not available");
    }
    this.child.stdin.write(`${message}\n`);
  }

  onMessage(listener: (message: string) => void) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onExit(listener: (error: Error) => void) {
    this.exitListeners.add(listener);
    return () => this.exitListeners.delete(listener);
  }

  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.lineReader.close();
    this.child.stdin?.end();
    this.shutdownTimer = setTimeout(() => {
      this.shutdownTimer = null;
      if (this.child.exitCode === null && this.child.signalCode === null) {
        this.child.kill();
      }
    }, 2000);
    this.shutdownTimer.unref();
  }

  private notifyExit(error: Error) {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const listener of this.exitListeners) {
      listener(error);
    }
  }
}

export function startRuntime(electronDirectory: string, packaged: boolean): RuntimeClient {
  const runtimeDirectory = join(electronDirectory, "../../runtime");
  const executableName = process.platform === "win32" ? "loom-runtime.exe" : "loom-runtime";
  const executablePath = packaged
    ? join(process.resourcesPath, "app.asar.unpacked", "dist-electron", executableName)
    : "go";
  const args = packaged ? [] : ["run", "./cmd/loom-runtime"];
  const child = spawn(executablePath, args, {
    cwd: packaged ? process.resourcesPath : runtimeDirectory,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  return new RuntimeClient(new ChildProcessTransport(child));
}
