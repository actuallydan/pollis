/**
 * Browser-side mock for @tauri-apps/api/event used when VITE_PLAYWRIGHT=true.
 * Returns a no-op unlisten function so useAblyRealtime doesn't error.
 */

type UnlistenFn = () => void;

export function listen(
  _event: string,
  _handler: (event: unknown) => void,
): Promise<UnlistenFn> {
  return Promise.resolve(() => {});
}

export function once(
  _event: string,
  _handler: (event: unknown) => void,
): Promise<UnlistenFn> {
  return Promise.resolve(() => {});
}

export function emit(_event: string, _payload?: unknown): Promise<void> {
  return Promise.resolve();
}
