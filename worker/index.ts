// =============================================================================
// Cloudflare Worker entry point
// =============================================================================
// Static files in /public are served by Workers Static Assets. This Worker only
// runs for the API, /health and dashboard sub-routes (see wrangler.jsonc).
// =============================================================================

import { httpServerHandler } from "cloudflare:node";
import { createApp } from "../server/app";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const app = createApp();
app.listen(3000);
const api = httpServerHandler({ port: 3000 });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // /dashboard/<view> and /dashboard/transcriptions/<id> are client-side routes
    if (url.pathname.startsWith("/dashboard/")) {
      return env.ASSETS.fetch(new Request(new URL("/dashboard", url), request));
    }
    return api.fetch!(request as any, env, ctx);
  },
};
