// =============================================================================
// Vercel Serverless Entry Point
// =============================================================================
// All /api/* (and /health) requests are rewritten here via vercel.json.
// The Express app handles its own routing internally.
// =============================================================================

import app from "../server/index";

export default app;
