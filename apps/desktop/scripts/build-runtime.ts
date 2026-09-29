import { mkdirSync } from "node:fs";
import { join } from "node:path";

const runtimeDirectory = join(import.meta.dirname, "../../runtime");
const outputDirectory = join(import.meta.dirname, "../dist-electron");
const executableName = process.platform === "win32" ? "loom-runtime.exe" : "loom-runtime";
mkdirSync(outputDirectory, { recursive: true });

const buildEnvironment = {
  ...process.env,
  CGO_ENABLED: "0",
  GOCACHE: join(runtimeDirectory, ".cache", "go-build"),
};
const icons = Bun.spawnSync(
  [
    "go",
    "run",
    "./cmd/loom-icon",
    "../apps/desktop/public/loom-avatar.png",
    "../apps/desktop/build-resources",
  ],
  {
    cwd: runtimeDirectory,
    env: buildEnvironment,
    stdout: "inherit",
    stderr: "inherit",
    windowsHide: true,
  },
);

if (icons.exitCode !== 0) {
  process.exitCode = icons.exitCode;
} else {
  const build = Bun.spawnSync(
    ["go", "build", "-o", join(outputDirectory, executableName), "./cmd/loom-runtime"],
    {
      cwd: runtimeDirectory,
      env: buildEnvironment,
      stdout: "inherit",
      stderr: "inherit",
      windowsHide: true,
    },
  );

  if (build.exitCode !== 0) {
    process.exitCode = build.exitCode;
  }
}
