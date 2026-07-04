// =============================================================================
// Scribe — native integration of the docscribe feature
// -----------------------------------------------------------------------------
// Record or upload consultation audio → POST /api/consultation/process →
// editable, toggleable summary → email to patient via /api/consultation/send.
//
// The API is served from the SAME origin (Vercel serverless functions in /api).
// For local static previews (e.g. Live Server) set:
//   window.SCRIBE_API_BASE = "http://localhost:8000";  // or your deployed URL
// =============================================================================

(function () {
    "use strict";

    // Read lazily so it can be set from the browser console at any time.
    const apiBase = () => window.SCRIBE_API_BASE || "";

    // ---------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------
    const state = {
        status: "idle",          // idle | recording | paused | preview | processing | ready | error
        seconds: 0,
        timerInterval: null,
        mediaRecorder: null,
        chunks: [],
        stream: null,
        audioBlob: null,         // last recorded/uploaded audio (kept for retry)
        summary: null,           // { doctorName, patientName, patientAge, patientWeight, symptoms, diagnosis, prescription[] }
        transcript: "",
        edited: { symptoms: "", diagnosis: "", prescription: "" },
        selected: { symptoms: true, diagnosis: true, prescription: true },
    };

    // ---------------------------------------------------------------------
    // Elements
    // ---------------------------------------------------------------------
    const $ = (id) => document.getElementById(id);

    const els = {};
    const IDS = [
        "scribe-record-btn", "scribe-ping", "scribe-timer", "scribe-hint",
        "scribe-live-controls", "scribe-pause-btn", "scribe-pause-label",
        "scribe-preview", "scribe-audio-preview", "scribe-process-btn", "scribe-discard-btn",
        "scribe-upload", "scribe-copy-btn", "scribe-copy-label",
        "scribe-summary-idle", "scribe-summary-processing", "scribe-summary-error",
        "scribe-error-text", "scribe-retry-btn", "scribe-summary-ready",
        "scribe-details", "scribe-sections", "scribe-transcript-wrap", "scribe-transcript",
        "scribe-email", "scribe-send-btn", "scribe-share-error", "scribe-print-btn",
    ];

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------
    function esc(str) {
        const div = document.createElement("div");
        div.textContent = str == null ? "" : String(str);
        return div.innerHTML;
    }

    function formatTime(s) {
        const m = String(Math.floor(s / 60)).padStart(2, "0");
        const sec = String(s % 60).padStart(2, "0");
        return `${m}:${sec}`;
    }

    function startTimer() {
        stopTimer();
        state.timerInterval = setInterval(() => {
            state.seconds += 1;
            els["scribe-timer"].textContent = formatTime(state.seconds);
        }, 1000);
    }

    function stopTimer() {
        if (state.timerInterval) clearInterval(state.timerInterval);
        state.timerInterval = null;
    }

    // ---------------------------------------------------------------------
    // Recorder card rendering
    // ---------------------------------------------------------------------
    function renderRecorder() {
        const recording = state.status === "recording";
        const paused = state.status === "paused";
        const live = recording || paused;

        els["scribe-ping"].hidden = !recording;
        els["scribe-record-btn"].classList.toggle("recording", live);
        els["scribe-record-btn"].querySelector(".material-symbols-outlined").textContent =
            live ? "stop" : "mic";
        els["scribe-record-btn"].title = live ? "Stop recording" : "Start recording";

        els["scribe-timer"].hidden = !live;
        els["scribe-timer"].textContent = formatTime(state.seconds);

        els["scribe-live-controls"].hidden = !live;
        els["scribe-pause-label"].textContent = paused ? "Resume" : "Pause";
        els["scribe-pause-btn"].querySelector(".material-symbols-outlined").textContent =
            paused ? "play_arrow" : "pause";

        els["scribe-preview"].hidden = state.status !== "preview";

        const hint = els["scribe-hint"];
        hint.classList.toggle("recording", recording);
        if (recording) hint.textContent = "Recording in progress...";
        else if (paused) hint.textContent = "Recording paused";
        else if (state.status === "preview") hint.textContent = "Review your audio, then generate the summary";
        else if (state.status === "processing") hint.textContent = "Processing consultation...";
        else hint.textContent = "Tap the mic to start your session";
    }

    // ---------------------------------------------------------------------
    // Summary card rendering
    // ---------------------------------------------------------------------
    function showPanel(panel) {
        els["scribe-summary-idle"].hidden = panel !== "idle";
        els["scribe-summary-processing"].hidden = panel !== "processing";
        els["scribe-summary-error"].hidden = panel !== "error";
        els["scribe-summary-ready"].hidden = panel !== "ready";
        els["scribe-copy-btn"].hidden = panel !== "ready";
    }

    function renderDetails() {
        const s = state.summary;
        const box = els["scribe-details"];
        const items = [];
        if (s.doctorName) {
            const name = s.doctorName.startsWith("Dr.") ? s.doctorName : `Dr. ${s.doctorName}`;
            items.push(["Doctor", name]);
        }
        if (s.patientName) items.push(["Patient", s.patientName]);
        if (s.patientAge) items.push(["Age", s.patientAge]);
        if (s.patientWeight) items.push(["Weight", s.patientWeight]);

        box.hidden = items.length === 0;
        box.innerHTML = items.map(([label, value]) => `
            <div class="scribe-detail-item">
                <span class="scribe-detail-label">${esc(label)}</span>
                <span class="scribe-detail-value">${esc(value)}</span>
            </div>
        `).join("");
    }

    const SECTIONS = [
        { key: "symptoms", title: "Symptoms", icon: "stethoscope" },
        { key: "diagnosis", title: "Diagnosis", icon: "biotech" },
        { key: "prescription", title: "Prescription", icon: "pill" },
    ];

    function renderSections() {
        const container = els["scribe-sections"];
        container.innerHTML = SECTIONS.map(({ key, title, icon }) => {
            const on = state.selected[key];
            const lines = state.edited[key]
                .split("\n").map((l) => l.trim()).filter(Boolean);
            return `
                <div class="scribe-section ${on ? "" : "off"}" data-key="${key}">
                    <div class="scribe-section-inner">
                        <div class="scribe-section-head">
                            <span class="material-symbols-outlined">${icon}</span>
                            <h3>${title}</h3>
                            <button class="scribe-edit-btn" data-action="edit" title="Edit ${title}">
                                <span class="material-symbols-outlined">edit</span>
                            </button>
                            <button class="scribe-toggle ${on ? "on" : ""}" data-action="toggle"
                                role="switch" aria-checked="${on}" title="Include ${title} when sharing"></button>
                        </div>
                        <div class="scribe-section-body">
                            <ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function openEditor(sectionEl, key) {
        const body = sectionEl.querySelector(".scribe-section-body");
        const value = state.edited[key];
        const rows = Math.max(3, value.split("\n").length + 1);
        body.innerHTML = `
            <textarea rows="${rows}"></textarea>
            <div class="scribe-edit-actions">
                <button class="cancel" data-action="cancel-edit">Cancel</button>
                <button class="save" data-action="save-edit">Save</button>
            </div>
        `;
        const ta = body.querySelector("textarea");
        ta.value = value;
        ta.focus();
    }

    function renderReady() {
        renderDetails();
        renderSections();
        const t = (state.transcript || "").trim();
        els["scribe-transcript-wrap"].hidden = !t;
        els["scribe-transcript"].textContent = t;
        els["scribe-share-error"].hidden = true;
        showPanel("ready");
    }

    // ---------------------------------------------------------------------
    // Recording
    // ---------------------------------------------------------------------
    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.stream = stream;
            const mr = new MediaRecorder(stream);
            state.mediaRecorder = mr;
            state.chunks = [];

            mr.ondataavailable = (e) => { if (e.data.size > 0) state.chunks.push(e.data); };
            mr.onstop = () => {
                const blob = new Blob(state.chunks, { type: "audio/webm" });
                stream.getTracks().forEach((t) => t.stop());
                state.stream = null;
                enterPreview(blob);
            };

            mr.start();
            state.seconds = 0;
            state.status = "recording";
            startTimer();
            renderRecorder();
        } catch {
            alert("Microphone access is required to record consultations.");
        }
    }

    function stopRecording() {
        stopTimer();
        if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
            state.mediaRecorder.stop();
        }
    }

    function togglePause() {
        const mr = state.mediaRecorder;
        if (!mr) return;
        if (state.status === "recording") {
            mr.pause();
            state.status = "paused";
            stopTimer();
        } else if (state.status === "paused") {
            mr.resume();
            state.status = "recording";
            startTimer();
        }
        renderRecorder();
    }

    function enterPreview(blob) {
        state.audioBlob = blob;
        state.status = "preview";
        const audio = els["scribe-audio-preview"];
        if (audio.src) URL.revokeObjectURL(audio.src);
        audio.src = URL.createObjectURL(blob);
        renderRecorder();
    }

    function discard() {
        state.audioBlob = null;
        state.seconds = 0;
        state.status = "idle";
        const audio = els["scribe-audio-preview"];
        if (audio.src) { URL.revokeObjectURL(audio.src); audio.removeAttribute("src"); }
        renderRecorder();
    }

    // ---------------------------------------------------------------------
    // Processing
    // ---------------------------------------------------------------------
    async function processConsultation(blob) {
        state.status = "processing";
        renderRecorder();
        showPanel("processing");

        try {
            const formData = new FormData();
            formData.append("audioBlob", blob, blob.name || "recording.webm");

            const response = await fetch(`${apiBase()}/api/consultation/process`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server responded with ${response.status}`);
            }

            const { data } = await response.json();
            state.summary = data.summary;
            state.transcript = data.actualTranscript || "";
            state.edited.symptoms = data.summary.symptoms || "Not discussed";
            state.edited.diagnosis = data.summary.diagnosis || "Not discussed";
            state.edited.prescription =
                Array.isArray(data.summary.prescription) && data.summary.prescription.length > 0
                    ? data.summary.prescription
                        .map((p) => `${p.name} - ${p.dosage} (${p.instructions})`)
                        .join("\n")
                    : "Not discussed";
            state.selected = { symptoms: true, diagnosis: true, prescription: true };

            state.status = "ready";
            renderRecorder();
            renderReady();
        } catch (err) {
            console.error("Failed to process consultation:", err);
            state.status = "error";
            els["scribe-error-text"].textContent =
                (err && err.message) || "Something went wrong while processing your consultation.";
            renderRecorder();
            showPanel("error");
        }
    }

    // ---------------------------------------------------------------------
    // Share content builder (mirrors the backend formatter)
    // ---------------------------------------------------------------------
    function buildFilteredContent() {
        const s = state.summary;
        if (!s) return { text: "", html: "" };

        const textLines = ["🏥 Medical Consultation Summary", ""];
        const details = [];
        if (s.doctorName) details.push(`👨‍⚕️ Doctor: ${s.doctorName}`);
        if (s.patientName) details.push(`👤 Patient: ${s.patientName}`);
        if (s.patientAge) details.push(`⏳ Age: ${s.patientAge}`);
        if (s.patientWeight) details.push(`⚖️ Weight: ${s.patientWeight}`);
        if (details.length) textLines.push(...details, "");

        if (state.selected.symptoms) textLines.push("🔹 Symptoms:", state.edited.symptoms, "");
        if (state.selected.diagnosis) textLines.push("🔹 Diagnosis:", state.edited.diagnosis, "");
        if (state.selected.prescription) textLines.push("🔹 Prescription:", state.edited.prescription, "");

        textLines.push("---", "This summary was generated automatically. Please consult your doctor for any clarifications.");
        const text = textLines.join("\n");

        const detailRow = (emoji, label, value) =>
            `<p style="margin: 0 0 8px 0; font-weight: 500;"><span style="margin-right: 8px;">${emoji}</span> <strong>${label}:</strong>&nbsp;${esc(value)}</p>`;

        const detailsBlock = details.length
            ? `<div style="margin-bottom: 20px; background-color: #f0f4f8; padding: 12px; border-radius: 6px; border-left: 4px solid #3182ce;">
                ${s.doctorName ? detailRow("👨‍⚕️", "Doctor", s.doctorName) : ""}
                ${s.patientName ? detailRow("👤", "Patient", s.patientName) : ""}
                ${s.patientAge ? detailRow("⏳", "Age", s.patientAge) : ""}
                ${s.patientWeight ? detailRow("⚖️", "Weight", s.patientWeight) : ""}
              </div>`
            : "";

        const sectionBlock = (title, content) => `
            <div style="margin-bottom: 20px;">
                <h3 style="color: #4a5568; margin-bottom: 8px; font-size: 1.1em;">
                    <span style="margin-right: 8px;">🔹</span> ${title}
                </h3>
                <p style="background-color: #f7fafc; padding: 12px; border-radius: 6px; margin: 0;">${esc(content).replace(/\n/g, "<br/>")}</p>
            </div>`;

        const prescriptionBlock = state.selected.prescription
            ? `<div style="margin-bottom: 24px;">
                <h3 style="color: #4a5568; margin-bottom: 8px; font-size: 1.1em;">
                    <span style="margin-right: 8px;">🔹</span> Prescription
                </h3>
                <div style="background-color: #f7fafc; padding: 12px; border-radius: 6px; margin: 0;">
                    <ul style="margin: 0; padding-left: 20px;">
                        ${state.edited.prescription.split("\n").filter((l) => l.trim()).map((l) => `<li style="margin-bottom: 4px;">${esc(l)}</li>`).join("")}
                    </ul>
                </div>
              </div>`
            : "";

        const html = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; line-height: 1.6; color: #1a202c;">
                <h2 style="color: #2b6cb0; border-bottom: 2px solid #3182ce; padding-bottom: 12px; margin-top: 0;">
                    <span style="margin-right: 8px;">🏥</span> Medical Consultation Summary
                </h2>
                ${detailsBlock}
                ${state.selected.symptoms ? sectionBlock("Symptoms", state.edited.symptoms) : ""}
                ${state.selected.diagnosis ? sectionBlock("Diagnosis", state.edited.diagnosis) : ""}
                ${prescriptionBlock}
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">
                <p style="font-style: italic; color: #718096; font-size: 0.85em; text-align: center; margin: 0;">
                    This summary was generated automatically. Please consult your doctor for any clarifications.
                </p>
            </div>`;

        return { text, html };
    }

    // ---------------------------------------------------------------------
    // Share actions
    // ---------------------------------------------------------------------
    function anySelected() {
        return Object.values(state.selected).some(Boolean);
    }

    function showShareError(msg) {
        const el = els["scribe-share-error"];
        el.textContent = msg;
        el.hidden = !msg;
    }

    async function sendEmail() {
        if (!anySelected()) {
            showShareError("Please select at least one section to send.");
            return;
        }
        const email = els["scribe-email"].value.trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showShareError("Please enter a valid email address.");
            return;
        }
        showShareError("");

        const { text, html } = buildFilteredContent();
        if (!text) return;

        const btn = els["scribe-send-btn"];
        btn.disabled = true;
        btn.textContent = "Sending...";

        try {
            const response = await fetch(`${apiBase()}/api/consultation/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, summary: text, summaryHtml: html }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server responded with ${response.status}`);
            }
            btn.textContent = "✓ Sent";
            btn.classList.add("sent");
            setTimeout(() => {
                btn.textContent = "Send via Email";
                btn.classList.remove("sent");
                btn.disabled = false;
            }, 3000);
        } catch (err) {
            console.error("Failed to send email:", err);
            showShareError("Failed to send email. Please try again.");
            btn.textContent = "Send via Email";
            btn.disabled = false;
        }
    }

    async function copySummary() {
        if (!anySelected()) {
            showShareError("Please select at least one section to copy.");
            return;
        }
        const { text } = buildFilteredContent();
        try {
            await navigator.clipboard.writeText(text);
            els["scribe-copy-label"].textContent = "Copied!";
            setTimeout(() => { els["scribe-copy-label"].textContent = "Copy"; }, 2000);
        } catch {
            showShareError("Could not access the clipboard.");
        }
    }

    function printSummary() {
        if (!anySelected()) {
            showShareError("Please select at least one section to print.");
            return;
        }
        const { html } = buildFilteredContent();
        if (!html) return;

        const printWindow = window.open("", "_blank", "width=800,height=600");
        if (!printWindow) {
            alert("Please allow popups to print the summary.");
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Consultation Summary</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        padding: 40px;
                        background: white;
                        color: #1a202c;
                    }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                ${html}
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => { window.close(); }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    // ---------------------------------------------------------------------
    // Init
    // ---------------------------------------------------------------------
    document.addEventListener("DOMContentLoaded", () => {
        IDS.forEach((id) => { els[id] = $(id); });
        if (!els["scribe-record-btn"]) return; // scribe view not present

        // Recorder
        els["scribe-record-btn"].addEventListener("click", () => {
            if (state.status === "recording" || state.status === "paused") stopRecording();
            else if (state.status === "idle" || state.status === "preview" || state.status === "ready" || state.status === "error") startRecording();
        });

        els["scribe-pause-btn"].addEventListener("click", togglePause);
        els["scribe-process-btn"].addEventListener("click", () => {
            if (state.audioBlob) processConsultation(state.audioBlob);
        });
        els["scribe-discard-btn"].addEventListener("click", discard);
        els["scribe-retry-btn"].addEventListener("click", () => {
            if (state.audioBlob) processConsultation(state.audioBlob);
            else { state.status = "idle"; renderRecorder(); showPanel("idle"); }
        });

        // Upload
        els["scribe-upload"].addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) enterPreview(file);
            e.target.value = "";
        });

        // Section interactions (event delegation)
        els["scribe-sections"].addEventListener("click", (e) => {
            const actionEl = e.target.closest("[data-action]");
            if (!actionEl) return;
            const sectionEl = actionEl.closest(".scribe-section");
            const key = sectionEl.getAttribute("data-key");
            const action = actionEl.getAttribute("data-action");

            if (action === "toggle") {
                state.selected[key] = !state.selected[key];
                renderSections();
            } else if (action === "edit") {
                openEditor(sectionEl, key);
            } else if (action === "save-edit") {
                const ta = sectionEl.querySelector("textarea");
                if (ta) state.edited[key] = ta.value;
                renderSections();
            } else if (action === "cancel-edit") {
                renderSections();
            }
        });

        // Share
        els["scribe-send-btn"].addEventListener("click", sendEmail);
        els["scribe-copy-btn"].addEventListener("click", copySummary);
        els["scribe-print-btn"].addEventListener("click", printSummary);

        renderRecorder();
        showPanel("idle");
    });
})();
