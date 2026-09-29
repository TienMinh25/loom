import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { spawn } from "node:child_process";
import { expect, mock, test } from "bun:test";
import { ChildProcessTransport } from "./runtimeProcess";

test("runtime transport closes stdin before forcing process termination", () => {
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: mock(() => true),
  });
  const transport = new ChildProcessTransport(child as unknown as ReturnType<typeof spawn>);

  transport.close();

  expect(child.stdin.writableEnded).toBe(true);
  expect(child.kill).not.toHaveBeenCalled();
  child.emit("close", 0, null);
});
