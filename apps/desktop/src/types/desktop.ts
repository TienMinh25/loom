import type { DesktopApi } from "../../shared/desktopApi";

declare global {
  interface Window {
    loomDesktop?: DesktopApi;
  }
}

export {};
