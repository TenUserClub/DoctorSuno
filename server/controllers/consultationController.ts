// =============================================================================
// Consultation Controller
// =============================================================================
// Handlers for the consultation endpoints. Each handler orchestrates the
// relevant services and returns a standardised JSON response.
// =============================================================================

import { Request, Response, NextFunction } from "express";
import { transcribeAudio } from "../services/asrService";
import { generateMedicalSummary } from "../services/llmService";
import { sendEmailSummary } from "../services/mailgunService";
import { formatMedicalSummary } from "../utils/formatter";
import { SendSummaryRequest, ApiSuccessResponse, MedicalSummary } from "../types";

// ---------------------------------------------------------------------------
// POST /api/consultation/process
// ---------------------------------------------------------------------------

/**
 * processConsultation
 * --------------------
 * Accepts an audio file upload (field name: "audioBlob"), chains:
 *   1. ASR  → transcribe audio to text
 *   2. LLM  → extract structured MedicalSummary from transcript
 *
 * Returns the transcript and summary to the client.
 */
export async function processConsultation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Set a 5-minute timeout for this specific long-running request
  req.setTimeout(300000);
  try {
    // --- Validate that an audio file was uploaded ---
    const audioFile = req.file;
    if (!audioFile) {
      res.status(400).json({
        success: false,
        error: "No audio file provided. Upload a file under the field 'audioBlob'.",
      });
      return;
    }

    console.log(
      `[Controller] Received audio: ${audioFile.originalname} ` +
        `(${(audioFile.size / 1024).toFixed(1)} KB, ${audioFile.mimetype})`
    );

    // --- Step 1: Transcribe audio → text ---
    const transcript = await transcribeAudio(audioFile);
    console.log(
      `[Controller] Transcript (${transcript.length} chars): "${transcript.substring(0, 100)}…"`
    );

    // --- Step 2: Extract structured summary from transcript ---
    const summary = await generateMedicalSummary(transcript);
    
    // --- Step 3: Format the summary for display/sending ---
    const { text, html } = formatMedicalSummary(summary);

    // --- Return full results ---
    const response: ApiSuccessResponse<{
      actualTranscript: string;
      summary: MedicalSummary;
      formattedSummary: string;
      formattedHtml: string;
    }> = {
      success: true,
      data: { 
        actualTranscript: transcript, 
        summary, 
        formattedSummary: text,
        formattedHtml: html
      },
    };

    res.status(200).json(response);
  } catch (error) {
    // Delegate to the centralised error handler
    next(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/consultation/send
// ---------------------------------------------------------------------------

/**
 * sendSummary
 * ------------
 * Accepts a JSON body with { email, summary } and triggers an email
 * message via Mailgun.
 */
export async function sendSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, summary } = req.body as SendSummaryRequest;

    // --- Input validation ---
    if (!email || typeof email !== "string") {
      res.status(400).json({
        success: false,
        error: "Missing or invalid 'email'. Provide an email address.",
      });
      return;
    }

    if (!summary || typeof summary !== "string") {
      res.status(400).json({
        success: false,
        error: "Missing or invalid 'summary'. Provide a plain string to send.",
      });
      return;
    }

    console.log(`[Controller] Sending email summary to ${email}…`);

    // --- Dispatch the Email message (Multipart) ---
    const mailgunLog = await sendEmailSummary(email, summary, req.body.summaryHtml);

    res.status(200).json({
      success: true,
      data: { 
        message: "Email message sent successfully.",
        mailgunLog
      },
    });
  } catch (error) {
    next(error);
  }
}
