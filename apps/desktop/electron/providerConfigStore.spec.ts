import { expect, test } from "bun:test";
import { createProviderConfigStore, type SecretStorage } from "./providerConfigStore";

test("provider config store persists an encrypted secret and only returns non-secret fields", async () => {
  let saved = "";
  const storage: SecretStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`encrypted:${value}`),
    decryptString: (value) => value.toString(),
  };
  const store = createProviderConfigStore("config.json", storage, {
    async readFile() {
      if (!saved) {
        throw Object.assign(new Error("missing"), { code: "ENOENT" });
      }
      return saved;
    },
    async writeFile(_path, content) {
      saved = String(content);
    },
  });

  await store.save({ baseUrl: "https://example.test/v1", apiKey: "secret", model: "model-a" });
  expect(saved).not.toContain("secret");
  expect(await store.load()).toEqual({
    baseUrl: "https://example.test/v1",
    model: "model-a",
    configured: true,
  });
  let applied: unknown;
  await store.restore(async (config) => {
    applied = config;
  });
  expect(applied).toEqual({
    baseUrl: "https://example.test/v1",
    apiKey: "encrypted:secret",
    model: "model-a",
  });
});

test("provider config store refuses to persist secrets when OS encryption is unavailable", async () => {
  const storage: SecretStorage = {
    isEncryptionAvailable: () => false,
    encryptString: (value) => Buffer.from(value),
    decryptString: (value) => value.toString(),
  };
  const store = createProviderConfigStore("config.json", storage, {
    async readFile() {
      throw new Error("unexpected read");
    },
    async writeFile() {
      throw new Error("unexpected write");
    },
  });

  await expect(
    store.save({ baseUrl: "https://example.test/v1", apiKey: "secret", model: "model-a" }),
  ).rejects.toThrow("OS encryption is unavailable");
});

test("provider config store only replaces saved configuration after provider setup succeeds", async () => {
  let saved = "old-config";
  const store = createProviderConfigStore(
    "config.json",
    {
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(value),
      decryptString: (value) => value.toString(),
    },
    {
      async readFile() {
        return saved;
      },
      async writeFile(_path, content) {
        saved = String(content);
      },
    },
  );
  await expect(
    store.configure({ baseUrl: "invalid", apiKey: "new-secret", model: "bad" }, async () => {
      throw new Error("provider rejected configuration");
    }),
  ).rejects.toThrow("provider rejected configuration");
  expect(saved).toBe("old-config");
});
