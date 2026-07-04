// =============================================================================
// Types & Interfaces
// =============================================================================
// Central type definitions for the healthcare medical scribe application.
// All shared interfaces live here to ensure a single source of truth.
// =============================================================================

export interface PrescriptionItem {
  /** Name of the drug or treatment */
  name: string;

  /** Dosage amount (e.g., "500mg", "10ml") */
  dosage: string;

  /** Instructions for taking the medication (e.g., "3 times a day for 5 days") */
  instructions: string;
}

/**
 * MedicalSummary
 * ---------------
 * Represents the structured output extracted from a doctor-patient consultation.
 * Each field is a plain string — if a piece of information was not explicitly
 * discussed in the transcript, the LLM is instructed to return "Not discussed"
 * (except for arrays, which should be empty).
 */
export interface MedicalSummary {
  /** Doctor's name if mentioned in the conversation */
  doctorName?: string;

  /** Patient's name if mentioned in the conversation */
  patientName?: string;

  /** Patient's age if mentioned in the conversation */
  patientAge?: string;

  /** Patient's weight if mentioned in the conversation */
  patientWeight?: string;

  /** Patient-reported symptoms extracted from the conversation */
  symptoms: string;

  /** Doctor's diagnosis as stated in the conversation */
  diagnosis: string;

  /** Prescribed medications or treatments mentioned in the conversation */
  prescription: PrescriptionItem[];
}

/**
 * SendSummaryRequest
 * -------------------
 * Shape of the JSON body expected by the POST /api/consultation/send endpoint.
 */
export interface SendSummaryRequest {
  /** Recipient's email address */
  email: string;

  /** The plain text summary to deliver */
  summary: string;

  /** Optional HTML version for better deliverability/presentation */
  summaryHtml?: string;
}

/**
 * ApiErrorResponse
 * -----------------
 * Standardised error payload returned to the client when something goes wrong.
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: string;
}

/**
 * ApiSuccessResponse<T>
 * ----------------------
 * Generic wrapper for all successful API responses.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}
