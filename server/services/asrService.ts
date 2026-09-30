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

async function requestJson(url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, init);
  const body = await res.text();
  let data: any = body;
  try { data = body ? JSON.parse(body) : null; } catch { /* non-JSON body */ }
  if (!res.ok) {
    const detail = (data && typeof data === "object" && (data.detail || data.error?.message || data.message)) || body;
    throw new Error(`Request failed with status code ${res.status}${detail ? `: ${String(detail).slice(0, 200)}` : ""}`);
  }
  return data;
}

function jsonPost(url: string, apiKey: string, payload: unknown): Promise<any> {
  return requestJson(url, {
    method: "POST",
    headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

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
  form.append(
    "file",
    new Blob([audioFile.buffer], { type: audioFile.mimetype || "audio/wav" }),
    audioFile.originalname || "audio.wav"
  );
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "json");

  const data = await requestJson(GROQ_WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });

  const transcript: string = data?.text;
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
    const initRes = await jsonPost(BASE_URL, apiKey, {
      job_parameters: { model: "saaras:v3", mode: "translate", with_timestamps: false },
    });
    const jobId = initRes.job_id;
    console.log(`[ASR-Batch] Job ID: ${jobId}`);

    // 2. Get Upload URL
    const uploadRes = await jsonPost(`${BASE_URL}/upload-files`, apiKey, { job_id: jobId, files: [fileName] });
    const uploadUrl = uploadRes.upload_urls[fileName].file_url;

    // 3. Upload file to Azure storage (standard PUT as BlockBlob)
    console.log("[ASR-Batch] Uploading audio…");
    await requestJson(uploadUrl, {
      method: "PUT",
      headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": audioFile.mimetype || "audio/wav" },
      body: new Blob([audioFile.buffer]),
    });

    // 4. Start processing
    console.log("[ASR-Batch] Starting job…");
    await jsonPost(`${BASE_URL}/${jobId}/start`, apiKey, {});

    // 5. Poll for completion. Capped so a whole request stays under the
    // Workers free-plan limit of 50 outbound calls (6 fixed calls + polls).
    let state = "Accepted";
    let finalStatus: any = null;
    const MAX_POLLS = 36;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, Math.min(2000 + i * 1000, 8000)));
      const status = await requestJson(`${BASE_URL}/${jobId}/status`, {
        headers: { "api-subscription-key": apiKey },
      });
      state = status.job_state;
      console.log(`[ASR-Batch] Polling... State: ${state}`);

      if (state === "Completed" || state === "Failed") {
        finalStatus = status;
        break;
      }
    }

    if (state !== "Completed") {
      throw new Error(`Sarvam batch job ${state === "Failed" ? "failed" : "timed out"}. Check dashboard for details.`);
    }

    // 6. Get Download URL
    const outputFileName = finalStatus.job_details[0]?.outputs[0]?.file_name || "0.json";
    const dlRes = await jsonPost(`${BASE_URL}/download-files`, apiKey, { job_id: jobId, files: [outputFileName] });
    const dlUrl = dlRes.download_urls[outputFileName].file_url;

    // 7. Retrieve transcription content: { transcripts: [ { transcript: "..." } ] }
    const resData = await requestJson(dlUrl);
    const transcript = resData.transcripts?.[0]?.transcript || resData.transcript;

    if (!transcript) {
      console.error("[ASR-Batch] Raw result data:", resData);
      throw new Error("Sarvam batch result contained no transcript.");
    }

    return transcript;
  } catch (error: any) {
    console.error("[ASR-Batch] Error details:", error.message);
    throw new Error(`Sarvam Batch ASR fail: ${error.message}`);
  }
}
