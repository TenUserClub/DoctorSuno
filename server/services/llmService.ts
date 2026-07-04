// =============================================================================
// LLM Service — Medical Summary Generation
// =============================================================================
// Uses LLMs to extract structured medical information from a transcript.
//
// Provider priority:
//   1. Groq (FREE) — runs Llama 3 70B, extremely fast and cost-effective
//   2. OpenAI      — if configured (paid fallback)
//
// Key constraints:
//  • temperature: 0.0  — deterministic, no creative embellishment
//  • Strict system prompt — only outputs MedicalSummary JSON
//  • "Not discussed" for anything not explicitly stated
// =============================================================================

import OpenAI from "openai";
import { MedicalSummary } from "../types";

// ---------------------------------------------------------------------------
// Clients (initialised lazily)
// ---------------------------------------------------------------------------

let groqClient: OpenAI | null = null;
let openaiClient: OpenAI | null = null;

function getGroqClient(): OpenAI | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your_groq_api_key") return null;

  if (!groqClient) {
    groqClient = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return groqClient;
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "your_openai_api_key") return null;

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ---------------------------------------------------------------------------
// System Prompt (exact wording from requirements)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a strict, factual medical scribe. You only output structured JSON matching the MedicalSummary interface. You will receive a transcript of a doctor-patient conversation (which may be in English or an Indic language translated to English). Extract the following: doctorName (if mentioned), patientName (if mentioned), patientAge (if mentioned), patientWeight (if mentioned), Symptoms, Diagnosis, and Prescription in English. The Prescription should be an array of objects explicitly capturing the drug name, dosage (in mg, ml, etc), and instructions (frequency, duration). If a prescription is not discussed, output an empty array []. For all other missing fields, output "Not discussed". Do not infer or hallucinate.`;

function buildUserPrompt(transcript: string): string {
  return `Here is the doctor-patient conversation transcript:

<transcript>
${transcript}
</transcript>

Extract the medical summary and return ONLY valid JSON in this exact format:
{
  "doctorName": "...", /* or "Not discussed" */
  "patientName": "...", /* or "Not discussed" */
  "patientAge": "...", /* or "Not discussed" */
  "patientWeight": "...", /* or "Not discussed" */
  "symptoms": "...",
  "diagnosis": "...",
  "prescription": [
    {
      "name": "...",
      "dosage": "...", /* e.g., "500mg" */
      "instructions": "..." /* e.g., "3 times a day for 5 days" */
    }
  ] /* or [] if no prescription */
}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * generateMedicalSummary
 * -----------------------
 * Takes a plain-text transcript and returns a structured MedicalSummary.
 *
 * Strategy:
 *  1. Try Groq (FREE — Llama 3 70B).
 *  2. If Groq fails, fall back to OpenAI GPT-4o.
 */
export async function generateMedicalSummary(
  transcript: string
): Promise<MedicalSummary> {
  // --- Attempt 1: Groq (FREE) ---
  const groq = getGroqClient();
  if (groq) {
    try {
      console.log("[LLM] Attempting summary via Groq (Llama 3.3 70B Versatile)…");
      return await callLLM(groq, "llama-3.3-70b-versatile", transcript);
    } catch (error) {
      console.warn(
        "[LLM] Groq failed, falling back to OpenAI:",
        error instanceof Error ? error.message : error
      );
    }
  }

  // --- Attempt 2: OpenAI ---
  const openai = getOpenAIClient();
  if (openai) {
    try {
      console.log("[LLM] Attempting summary via OpenAI (GPT-4o)…");
      return await callLLM(openai, "gpt-4o", transcript);
    } catch (error) {
      console.error(
        "[LLM] OpenAI failed:",
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  throw new Error("No LLM provider configured or all providers failed.");
}

// ---------------------------------------------------------------------------
// Internal Helper
// ---------------------------------------------------------------------------

async function callLLM(
  client: OpenAI,
  model: string,
  transcript: string
): Promise<MedicalSummary> {
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(transcript) },
    ],
    max_tokens: 1024,
  });

  const rawContent = completion.choices[0]?.message?.content;
  if (!rawContent) throw new Error("LLM returned empty response.");

  const parsed = JSON.parse(rawContent);
  return {
    doctorName: typeof parsed.doctorName === "string" && parsed.doctorName !== "Not discussed" ? parsed.doctorName : undefined,
    patientName: typeof parsed.patientName === "string" && parsed.patientName !== "Not discussed" ? parsed.patientName : undefined,
    patientAge: typeof parsed.patientAge === "string" && parsed.patientAge !== "Not discussed" ? parsed.patientAge : undefined,
    patientWeight: typeof parsed.patientWeight === "string" && parsed.patientWeight !== "Not discussed" ? parsed.patientWeight : undefined,
    symptoms: typeof parsed.symptoms === "string" ? parsed.symptoms : "Not discussed",
    diagnosis: typeof parsed.diagnosis === "string" ? parsed.diagnosis : "Not discussed",
    prescription: Array.isArray(parsed.prescription) ? parsed.prescription : [],
  };
}
