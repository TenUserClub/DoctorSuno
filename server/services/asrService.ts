// =============================================================================
// ASR Service — Automatic Speech Recognition
// =============================================================================
// Responsible for converting doctor-patient audio conversations into text.
// Optimized for English-only conversations.
//
// Provider priority:
//   1. Groq (FREE) — runs Whisper large-v3-turbo, extremely fast
//
// Groq offers a generous free tier with no credit card required.
// Sign up at https://console.groq.com to get your free API key.
// =============================================================================

import axios from "axios";
import FormData from "form-data";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Groq Whisper endpoint (FREE tier) */
const GROQ_WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * transcribeAudio
 * ----------------
 * Accepts a Multer file object and returns the transcribed text.
 *
 * Strategy:
 *  1. Try Groq (FREE — runs Whisper large-v3-turbo).
 *
 * @param audioFile - The uploaded audio file from Multer
 * @returns The transcribed text as a plain string
 * @throws Error if the provider fails
 */
export async function transcribeAudio(
  audioFile: Express.Multer.File
): Promise<string> {
  // --- Attempt 1: Sarvam AI ---
  const sarvamKey = process.env.SARVAM_API_KEY;
  if (sarvamKey) {
    try {
      console.log("[ASR] Attempting transcription via Sarvam AI…");
      const transcript = await transcribeWithSarvam(audioFile, sarvamKey);
      console.log("[ASR] Sarvam AI transcription succeeded.");
      return transcript;
    } catch (error) {
      console.warn(
        "[ASR] Sarvam AI failed, falling back to Groq:",
        error instanceof Error ? error.message : error
      );
    }
  }

  // --- Attempt 2: Groq (FREE fallback) ---
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey !== "your_groq_api_key") {
    try {
      console.log("[ASR] Attempting transcription via Groq (free Whisper fallback)…");
      const transcript = await transcribeWithGroq(audioFile, groqKey);
      console.log("[ASR] Groq transcription succeeded.");
      return transcript;
    } catch (error) {
      console.error(
        "[ASR] Groq fallback failed:",
        error instanceof Error ? error.message : error
      );
    }
  }

  throw new Error(
    "All ASR providers failed. Check API keys and audio format."
  );
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Send audio to Groq's Whisper endpoint.
 * Groq runs whisper-large-v3-turbo for FREE and is OpenAI-compatible.
 * Supports Hindi, Hinglish, English, and 50+ other languages.
 *
 * Free tier: https://console.groq.com (no credit card needed)
 */
async function transcribeWithGroq(
  audioFile: Express.Multer.File,
  apiKey: string
): Promise<string> {
  const form = new FormData();

  form.append("file", audioFile.buffer, {
    filename: audioFile.originalname || "audio.wav",
    contentType: audioFile.mimetype || "audio/wav",
  });

  // whisper-large-v3-turbo is the fastest and best quality on Groq
  form.append("model", "whisper-large-v3-turbo");

  // Groq will auto-detect the language if not specified
  // form.append("language", "hi");

  // Plain text response format for simplicity
  form.append("response_format", "json");

  const response = await axios.post(GROQ_WHISPER_URL, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${apiKey}`,
    },
    timeout: 60_000, // 60 s generous timeout for long recordings
  });

  const transcript: string = response.data?.text;
  if (!transcript) {
    throw new Error("Groq Whisper API returned an empty transcript.");
  }

  return transcript;
}

/**
 * Send audio to Sarvam AI speech-to-text-translate BATCH endpoint.
 * This is optimized for LONG audio files (> 30s) and handles the full
 * asynchronous job lifecycle: Initialize -> Upload -> Start -> Poll -> Download.
 */
async function transcribeWithSarvam(
  audioFile: Express.Multer.File,
  apiKey: string
): Promise<string> {
  const BASE_URL = "https://api.sarvam.ai/speech-to-text/job/v1";
  const fileName = audioFile.originalname || "audio.wav";

  try {
    // 1. Initialize Job
    console.log("[ASR-Batch] Initializing job…");
    const initRes = await axios.post(BASE_URL, {
      job_parameters: {
        model: "saaras:v3",
        mode: "translate",
        with_timestamps: false
      }
    }, { headers: { "api-subscription-key": apiKey } });
    const jobId = initRes.data.job_id;
    console.log(`[ASR-Batch] Job ID: ${jobId}`);

    // 2. Get Upload URL
    const uploadRes = await axios.post(`${BASE_URL}/upload-files`, {
      job_id: jobId,
      files: [fileName]
    }, { headers: { "api-subscription-key": apiKey } });
    const uploadUrl = uploadRes.data.upload_urls[fileName].file_url;

    // 3. Upload file to Azure storage (standard PUT as BlockBlob)
    console.log("[ASR-Batch] Uploading audio…");
    await axios.put(uploadUrl, audioFile.buffer, {
      headers: {
        "x-ms-blob-type": "BlockBlob",
        "Content-Type": audioFile.mimetype || "audio/wav",
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    // 4. Start processing
    console.log("[ASR-Batch] Starting job…");
    await axios.post(`${BASE_URL}/${jobId}/start`, {}, {
      headers: { "api-subscription-key": apiKey }
    });

    // 5. Poll for completion
    let state = "Accepted";
    let finalStatus: any = null;
    const POLLING_INTERVAL = 3000;
    const MAX_POLLS = 100; // ~5 minutes max
    
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, POLLING_INTERVAL));
      const s = await axios.get(`${BASE_URL}/${jobId}/status`, {
        headers: { "api-subscription-key": apiKey }
      });
      state = s.data.job_state;
      console.log(`[ASR-Batch] Polling... State: ${state}`);
      
      if (state === "Completed" || state === "Failed") {
        finalStatus = s.data;
        break;
      }
    }

    if (state !== "Completed") {
      throw new Error(`Sarvam batch job ${state === "Failed" ? "failed" : "timed out"}. Check dashboard for details.`);
    }

    // 6. Get Download URL
    // We look for the output filename (usually 0.json for the first file)
    const outputFileName = finalStatus.job_details[0]?.outputs[0]?.file_name || "0.json";
    
    const dlRes = await axios.post(`${BASE_URL}/download-files`, {
      job_id: jobId,
      files: [outputFileName]
    }, { headers: { "api-subscription-key": apiKey } });
    
    const dlUrl = dlRes.data.download_urls[outputFileName].file_url;

    // 7. Retrieve transcription content
    const contentRes = await axios.get(dlUrl);
    
    // The format is usually { transcripts: [ { transcript: "..." } ] }
    const resData = contentRes.data;
    const transcript = resData.transcripts?.[0]?.transcript || 
                      resData.transcript; // Fallback to flat model

    if (!transcript) {
      console.error("[ASR-Batch] Raw result data:", resData);
      throw new Error("Sarvam batch result contained no transcript.");
    }

    return transcript;
  } catch (error: any) {
    const errorData = error.response?.data;
    console.error("[ASR-Batch] Error details:", errorData || error.message);
    throw new Error(`Sarvam Batch ASR fail: ${errorData?.detail || error.message}`);
  }
}
