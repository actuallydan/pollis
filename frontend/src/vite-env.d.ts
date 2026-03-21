/// <reference types="vite/client" />

// Ambient fallback for @tauri-apps/plugin-notification.
// Remove this block once the package is installed via pnpm.
declare module "@tauri-apps/plugin-notification" {
  export type Permission = "granted" | "denied" | "default";
  export interface Options {
    title: string;
    body?: string;
    icon?: string;
  }
  export function isPermissionGranted(): Promise<boolean>;
  export function requestPermission(): Promise<Permission>;
  export function sendNotification(options: Options | string): void;
}
