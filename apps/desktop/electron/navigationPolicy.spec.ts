import { expect, test } from "bun:test";
import { getTrustedRendererUrl, isTrustedRendererUrl } from "./navigationPolicy";

test("only permits renderer navigation within the app URL", () => {
  const packagedUrl = getTrustedRendererUrl("C:/apps/loom/dist-electron", false);
  expect(isTrustedRendererUrl(packagedUrl, undefined, packagedUrl)).toBe(true);
  expect(isTrustedRendererUrl("https://example.com", undefined, packagedUrl)).toBe(false);
  expect(
    isTrustedRendererUrl("http://127.0.0.1:5173/settings", "http://127.0.0.1:5173", packagedUrl),
  ).toBe(true);
  expect(isTrustedRendererUrl("http://127.0.0.1:5174/", "http://127.0.0.1:5173", packagedUrl)).toBe(
    false,
  );
});
