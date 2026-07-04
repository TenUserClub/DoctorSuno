// =============================================================================
// Consultation Routes
// =============================================================================
// Defines the HTTP endpoints for the consultation feature and wires them
// to their respective controller handlers.
// =============================================================================

import { Router } from "express";
import multer from "multer";
import { processConsultation, sendSummary } from "../controllers/consultationController";

// ---------------------------------------------------------------------------
// Multer Configuration
// ---------------------------------------------------------------------------

/**
 * We use in-memory storage so the audio buffer is available directly on
 * req.file.buffer — no temp files to clean up.
 *
 * Limits:
 *  • 20 MB max file size — generous for typical consultation recordings
 *  • Only allow common audio MIME types
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
  },
  fileFilter: (_req, file, cb) => {
    // Accept common audio types (wav, mp3, mp4, ogg, webm, etc.)
    const allowedMimes = [
      "audio/wav",
      "audio/wave",
      "audio/x-wav",
      "audio/mpeg",
      "audio/mp3",
      "audio/mp4",
      "audio/ogg",
      "audio/webm",
      "audio/flac",
      "audio/x-m4a",
      "video/webm", // browsers often record audio as video/webm
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported audio format: ${file.mimetype}. ` +
            `Accepted: wav, mp3, mp4, ogg, webm, flac, m4a.`
        )
      );
    }
  },
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = Router();

/**
 * POST /api/consultation/process
 * --------------------------------
 * Upload an audio file (field: "audioBlob") → returns transcript + summary.
 */
router.post("/process", upload.single("audioBlob"), processConsultation);

/**
 * POST /api/consultation/send
 * -----------------------------
 * Send a medical summary via Email (Mailgun).
 * Body: { email: string, summary: string }
 */
router.post("/send", sendSummary);

export default router;
