// =============================================================================
// API application
// =============================================================================
// Shared by the local Node server (server/index.ts) and the Cloudflare Worker
// (worker/index.ts). Static files are served by the host, not by this app.
// =============================================================================

import express, { Express, Request, Response, NextFunction } from "express";
import cors, { CorsOptions } from "cors";
import consultationRoutes from "./routes/consultationRoutes";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:8000",
  "http://localhost:8082",
  "http://localhost:8787",
  "https://doctorsuno.com",
  "https://www.doctorsuno.com",
  "https://drsuno.com",
  "https://www.drsuno.com",
  "https://docscribe-eta.vercel.app",
];

function isAllowedOrigin(origin: string, host?: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  const { hostname, host: originHost } = new URL(origin);
  // Same-origin requests (the dashboard calling its own API) and preview deploys
  return originHost === host || /\.vercel\.app$/.test(hostname) || /\.workers\.dev$/.test(hostname);
}

/**
 * Builds the API app. `mountBeforeNotFound` lets the host add routes (static
 * files, docs) ahead of the JSON 404 handler.
 */
export function createApp(mountBeforeNotFound?: (app: Express) => void): Express {
  const app = express();

  app.use(
    cors((req, callback) => {
      const options: CorsOptions = {
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
      };
      const origin = req.headers.origin;
      if (!origin || isAllowedOrigin(origin, req.headers.host)) {
        callback(null, { ...options, origin: true });
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    })
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "doctor-backend",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/consultation", consultationRoutes);

  mountBeforeNotFound?.(app);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: "Route not found." });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("❌ Unhandled error:", err.message);
    console.error(err.stack);

    if (err.message.includes("Unsupported audio format")) {
      res.status(415).json({ success: false, error: err.message });
      return;
    }

    if (err.message.includes("File too large")) {
      res.status(413).json({ success: false, error: "File too large. Maximum upload size is 20 MB." });
      return;
    }

    const isDev = process.env.NODE_ENV !== "production";
    res.status(500).json({
      success: false,
      error: "Internal server error.",
      ...(isDev && { details: err.message }),
    });
  });

  return app;
}
