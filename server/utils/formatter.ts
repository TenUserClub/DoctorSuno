import { MedicalSummary } from "../types";

/**
 * formatMedicalSummary
 * --------------------
 * Formats a structured MedicalSummary object into human-readable text and HTML.
 * Providing both versions helps with email deliverability.
 */
export function formatMedicalSummary(summary: MedicalSummary) {
  const text = [
    "🏥 Medical Consultation Summary",
    "",
    summary.doctorName ? `👨‍⚕️ Doctor: ${summary.doctorName}` : "",
    summary.patientName ? `👤 Patient: ${summary.patientName}` : "",
    summary.patientAge ? `⏳ Age: ${summary.patientAge}` : "",
    summary.patientWeight ? `⚖️ Weight: ${summary.patientWeight}` : "",
    (summary.doctorName || summary.patientName || summary.patientAge || summary.patientWeight) ? "" : undefined,
    "🔹 Symptoms:",
    summary.symptoms,
    "",
    "🔹 Diagnosis:",
    summary.diagnosis,
    "",
    "🔹 Prescription:",
    Array.isArray(summary.prescription) && summary.prescription.length > 0
      ? summary.prescription.map((p) => `• ${p.name} - ${p.dosage} (${p.instructions})`).join("\n")
      : "Not discussed",
    "",
    "---",
    "This summary was generated automatically. Please consult your doctor for any clarifications.",
  ].filter((line) => line !== undefined).join("\n");

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; line-height: 1.6; color: #1a202c;">
      <h2 style="color: #2b6cb0; border-bottom: 2px solid #3182ce; padding-bottom: 12px; margin-top: 0; display: flex; align-items: center;">
        <span style="margin-right: 8px;">🏥</span> Medical Consultation Summary
      </h2>

      ${summary.doctorName || summary.patientName || summary.patientAge || summary.patientWeight ? `
      <div style="margin-bottom: 20px; background-color: #f0f4f8; padding: 12px; border-radius: 6px; border-left: 4px solid #3182ce;">
        ${summary.doctorName ? `<p style="margin: 0 0 8px 0; font-weight: 500; display: flex; align-items: center;"><span style="margin-right: 8px;">👨‍⚕️</span> <strong>Doctor:</strong>&nbsp;${summary.doctorName}</p>` : ""}
        ${summary.patientName ? `<p style="margin: 0 0 8px 0; font-weight: 500; display: flex; align-items: center;"><span style="margin-right: 8px;">👤</span> <strong>Patient:</strong>&nbsp;${summary.patientName}</p>` : ""}
        ${summary.patientAge ? `<p style="margin: 0 0 8px 0; font-weight: 500; display: flex; align-items: center;"><span style="margin-right: 8px;">⏳</span> <strong>Age:</strong>&nbsp;${summary.patientAge}</p>` : ""}
        ${summary.patientWeight ? `<p style="margin: 0; font-weight: 500; display: flex; align-items: center;"><span style="margin-right: 8px;">⚖️</span> <strong>Weight:</strong>&nbsp;${summary.patientWeight}</p>` : ""}
      </div>
      ` : ""}
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: #4a5568; margin-bottom: 8px; font-size: 1.1em; display: flex; align-items: center;">
          <span style="margin-right: 8px;">🔹</span> Symptoms
        </h3>
        <p style="background-color: #f7fafc; padding: 12px; border-radius: 6px; margin: 0;">${summary.symptoms}</p>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #4a5568; margin-bottom: 8px; font-size: 1.1em; display: flex; align-items: center;">
          <span style="margin-right: 8px;">🔹</span> Diagnosis
        </h3>
        <p style="background-color: #f7fafc; padding: 12px; border-radius: 6px; margin: 0;">${summary.diagnosis}</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="color: #4a5568; margin-bottom: 8px; font-size: 1.1em; display: flex; align-items: center;">
          <span style="margin-right: 8px;">🔹</span> Prescription
        </h3>
        <div style="background-color: #f7fafc; padding: 12px; border-radius: 6px; margin: 0;">
          ${Array.isArray(summary.prescription) && summary.prescription.length > 0 
            ? `<ul style="margin: 0; padding-left: 20px;">
                ${summary.prescription.map(p => `<li style="margin-bottom: 4px;"><strong>${p.name}</strong> – ${p.dosage} <em>(${p.instructions})</em></li>`).join("")}
               </ul>` 
            : `<p style="margin: 0;">Not discussed</p>`}
        </div>
      </div>
      
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      <p style="font-style: italic; color: #718096; font-size: 0.85em; text-align: center; margin: 0;">
        This summary was generated automatically. Please consult your doctor for any clarifications.
      </p>
    </div>
  `;

  return { text, html };
}
