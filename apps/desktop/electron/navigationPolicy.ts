import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function getTrustedRendererUrl(directory: string, isDevelopment: boolean) {
  return isDevelopment ? undefined : pathToFileURL(join(directory, "../dist/index.html")).href;
}

export function isTrustedRendererUrl(
  candidate: string,
  developmentServerUrl: string | undefined,
  packagedRendererUrl: string | undefined,
) {
  try {
    const candidateUrl = new URL(candidate);
    if (developmentServerUrl) {
      return candidateUrl.origin === new URL(developmentServerUrl).origin;
    }
    return packagedRendererUrl ? candidateUrl.href.split("#")[0] === packagedRendererUrl : false;
  } catch {
    return false;
  }
}
