// =============================================================================
// Local / Node entry point
// =============================================================================
// Runs the shared API plus the static site and Swagger docs on one port.
// Cloudflare uses worker/index.ts instead; Vercel imports this file via api/.
// =============================================================================

import dotenv from "dotenv";

// Load environment variables BEFORE importing anything that depends on them
dotenv.config();

import express, { Request, Response } from "express";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { createApp } from "./app";
import swaggerDocument from "./openapi.json";

const PORT = parseInt(process.env.PORT || "8082", 10);
const publicDir = path.join(__dirname, "..", "public");

const app = createApp((app) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customSiteTitle: "Doctor Backend — API Docs",
    customCss: ".swagger-ui .topbar { display: none }",
  }));

  app.get("/index.html", (_req: Request, res: Response) => res.redirect(301, "/"));
  app.get(["/demo", "/demo/*splat"], (_req: Request, res: Response) => res.redirect(301, "/dashboard"));

  app.use(express.static(publicDir, { redirect: false }));

  app.get(["/dashboard", "/dashboard/*splat"], (_req: Request, res: Response) =>
    res.sendFile(path.join(publicDir, "dashboard", "index.html"))
  );
});

if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
  ┌──────────────────────────────────────────────┐
  │                                              │
  │   🏥  Doctor Backend is running              │
  │   📡  http://localhost:${PORT}                 │
  │   🩺  POST /api/consultation/process         │
  │   📱  POST /api/consultation/send            │
  │   💚  GET  /health                           │
  │   📖  GET  /api-docs                         │
  │                                              │
  └──────────────────────────────────────────────┘
    `);
  });
}

export default app;
