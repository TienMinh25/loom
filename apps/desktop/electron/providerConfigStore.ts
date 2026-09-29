import { readFile, writeFile } from "node:fs/promises";
import type { PathLike, WriteFileOptions } from "node:fs";

export type SecretStorage = {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
};

export type ProviderConfig = { baseUrl: string; apiKey: string; model: string };
type StoredProviderConfig = { baseUrl: string; encryptedApiKey: string; model: string };

export function createProviderConfigStore(
  path: string,
  storage: SecretStorage,
  file: {
    readFile(path: PathLike, encoding: "utf8"): Promise<string>;
    writeFile(path: PathLike, content: string, options?: WriteFileOptions): Promise<void>;
  } = { readFile, writeFile },
) {
  const save = async (config: ProviderConfig) => {
    if (!storage.isEncryptionAvailable()) {
      throw new Error("OS encryption is unavailable; provider credentials were not saved");
    }
    const stored: StoredProviderConfig = {
      baseUrl: config.baseUrl,
      model: config.model,
      encryptedApiKey: storage.encryptString(config.apiKey).toString("base64"),
    };
    await file.writeFile(path, JSON.stringify(stored), { mode: 0o600 });
  };

  const decryptStored = async (): Promise<ProviderConfig> => {
    const stored = JSON.parse(await file.readFile(path, "utf8")) as StoredProviderConfig;
    if (!storage.isEncryptionAvailable()) {
      throw new Error("OS encryption is unavailable; provider credentials cannot be loaded");
    }
    return {
      baseUrl: stored.baseUrl,
      model: stored.model,
      apiKey: storage.decryptString(Buffer.from(stored.encryptedApiKey, "base64")),
    };
  };

  return {
    async load(): Promise<Omit<ProviderConfig, "apiKey"> & { configured: boolean }> {
      try {
        const stored = JSON.parse(await file.readFile(path, "utf8")) as StoredProviderConfig;
        return { baseUrl: stored.baseUrl, model: stored.model, configured: true };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return { baseUrl: "", model: "", configured: false };
        }
        throw error;
      }
    },
    save,
    async configure(config: ProviderConfig, apply: (value: ProviderConfig) => Promise<unknown>) {
      await apply(config);
      await save(config);
    },
    async restore(apply: (value: ProviderConfig) => Promise<unknown>) {
      try {
        return await apply(await decryptStored());
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }
        throw error;
      }
    },
  };
}
