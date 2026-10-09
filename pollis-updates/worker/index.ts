// Cloudflare Worker entry for updates.pollis.com — the Expo Updates server for
// the mobile app's over-the-air JS updates (#1250). All behaviour lives in
// protocol.ts (pure, node-testable); this file only binds it to workerd.
//
// Deliberately absent: logging of any kind, `request.cf`, and every
// client-identifying header. See tests/no-client-ip.test.ts.
import { handle, type UpdatesEnv } from "./protocol.ts";

interface Env extends UpdatesEnv {
  UPDATES: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env);
  },
} satisfies ExportedHandler<Env>;
