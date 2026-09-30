// =============================================================================
// Scribe — native integration of the docscribe feature
// -----------------------------------------------------------------------------
// Record or upload consultation audio → POST /api/consultation/process →
// editable, toggleable note saved as a session in localStorage.
//
// The API is served from the SAME origin (Vercel serverless functions in /api).
// For local static previews (e.g. Live Server) set:
//   window.SCRIBE_API_BASE = "http://localhost:8000";  // or your deployed URL
// =============================================================================

(function () {
    "use strict";

    const apiBase = () => window.SCRIBE_API_BASE || "";
    const SESSIONS_KEY = "doctorsuno-scribe-v1";
    const DEMO_KEY = "doctorsuno-demo-v1";

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
        sessions: [],
        activeId: null,
    };

    const $ = (id) => document.getElementById(id);
    const els = {};
    const IDS = [
        "scribe-record-btn", "scribe-ping", "scribe-timer", "scribe-hint",
        "scribe-live-controls", "scribe-pause-btn", "scribe-pause-label",
        "scribe-preview", "scribe-audio-preview", "scribe-process-btn", "scribe-discard-btn",
        "scribe-upload", "scribe-upload-wrap", "scribe-copy-btn", "scribe-copy-label",
        "scribe-summary-idle", "scribe-summary-processing", "scribe-summary-error",
        "scribe-error-text", "scribe-retry-btn", "scribe-summary-ready",
        "scribe-details", "scribe-sections", "scribe-transcript-wrap", "scribe-transcript",
        "scribe-send-btn", "scribe-share-error", "scribe-share-success", "scribe-print-btn",
        "scribe-note-actions", "scribe-title", "scribe-meta", "scribe-sessions-list", "scribe-new-btn",
        "scribe-tab-note", "scribe-tab-transcript", "scribe-note-panel",
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

    function formatDate(iso) {
        return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    }

    function doctorLabel(name) {
        return `Dr. ${name.replace(/^(dr\.?|doctor)\s+/i, "")}`;
    }

    function readJSON(key) {
        try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    }

    function writeJSON(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: keep in memory */ }
    }

    function clinicInfo() {
        const clinic = (readJSON(DEMO_KEY) || {}).clinic || {};
        return {
            name: clinic.name || "DoctorSuno Primary Care",
            address: clinic.address || "123 Health Ave, Medical District",
            email: clinic.email || "contact@doctorsuno.com",
        };
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
    // Sessions (persisted)
    // ---------------------------------------------------------------------
    function loadSessions() {
        const saved = readJSON(SESSIONS_KEY);
        state.sessions = Array.isArray(saved?.sessions) ? saved.sessions : [];
        state.activeId = saved?.activeId ?? null;
    }

    function persistSessions() {
        writeJSON(SESSIONS_KEY, { sessions: state.sessions, activeId: state.activeId });
    }

    function activeSession() {
        return state.sessions.find((s) => s.id === state.activeId) || null;
    }

    function syncActiveSession() {
        const session = activeSession();
        if (!session) return;
        session.edited = { ...state.edited };
        session.selected = { ...state.selected };
        persistSessions();
        renderSessions();
    }

    function sessionTitle(session) {
        return session.summary?.patientName || "Consultation";
    }

    function renderSessions() {
        const list = els["scribe-sessions-list"];
        if (!state.sessions.length) {
            list.innerHTML = `<p class="sessions-empty">No sessions yet. Record or upload a consultation to create one.</p>`;
            return;
        }
        list.innerHTML = state.sessions.map((s) => `
            <div class="session-row ${s.id === state.activeId ? "active" : ""}">
                <button type="button" class="session-open" data-session="${s.id}" aria-current="${s.id === state.activeId}">
                    <strong>${esc(sessionTitle(s))}</strong>
                    <span class="session-meta">${esc(formatDate(s.createdAt))}</span>
                    <span class="session-snippet">${esc((s.edited?.diagnosis || "").split("\n")[0])}</span>
                </button>
                <button type="button" class="icon-btn sm session-delete" data-delete-session="${s.id}" aria-label="Delete session ${esc(sessionTitle(s))}">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        `).join("");
    }

    function openSession(id) {
        const session = state.sessions.find((s) => s.id === id);
        if (!session || state.status === "recording" || state.status === "paused" || state.status === "processing") return;
        state.activeId = id;
        state.summary = session.summary;
        state.transcript = session.transcript;
        state.edited = { ...session.edited };
        state.selected = { ...session.selected };
        state.status = "ready";
        persistSessions();
        renderSessions();
        renderRecorder();
        renderReady();
    }

    function newSession() {
        if (state.status === "recording" || state.status === "paused" || state.status === "processing") return;
        state.activeId = null;
        state.summary = null;
        state.transcript = "";
        persistSessions();
        discard();
        renderSessions();
        renderHeader();
        showPanel("idle");
    }

    function deleteSession(id) {
        state.sessions = state.sessions.filter((s) => s.id !== id);
        if (state.activeId === id) {
            newSession();
        } else {
            persistSessions();
            renderSessions();
        }
    }

    // ---------------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------------
    function renderRecorder() {
        const recording = state.status === "recording";
        const paused = state.status === "paused";
        const live = recording || paused;

        els["scribe-ping"].hidden = !recording;
        els["scribe-record-btn"].classList.toggle("recording", live);
        els["scribe-record-btn"].querySelector(".material-symbols-outlined").textContent = live ? "stop" : "mic";
        els["scribe-record-btn"].title = live ? "Stop recording" : "Start recording";

        els["scribe-timer"].hidden = !live;
        els["scribe-timer"].textContent = formatTime(state.seconds);

        els["scribe-live-controls"].hidden = !live;
        els["scribe-pause-label"].textContent = paused ? "Resume" : "Pause";
        els["scribe-pause-btn"].querySelector(".material-symbols-outlined").textContent = paused ? "play_arrow" : "pause";

        els["scribe-preview"].hidden = state.status !== "preview";
        els["scribe-upload-wrap"].hidden = live || state.status === "preview";

        const hint = els["scribe-hint"];
        hint.classList.toggle("recording", recording);
        if (recording) hint.textContent = "Recording in progress...";
        else if (paused) hint.textContent = "Recording paused";
        else if (state.status === "preview") hint.textContent = "Review your audio, then generate the summary";
        else if (state.status === "processing") hint.textContent = "Processing consultation...";
        else hint.textContent = "Tap the mic to start your session";
    }

    function renderHeader() {
        const session = activeSession();
        if (session && state.status === "ready") {
            els["scribe-title"].textContent = sessionTitle(session);
            const bits = [formatDate(session.createdAt)];
            if (session.summary?.doctorName) bits.push(doctorLabel(session.summary.doctorName));
            els["scribe-meta"].textContent = bits.join(" · ");
        } else {
            els["scribe-title"].textContent = "New consultation";
            els["scribe-meta"].textContent = "Record or upload the conversation to generate a note";
        }
    }

    function showPanel(panel) {
        els["scribe-summary-idle"].hidden = panel !== "idle";
        els["scribe-summary-processing"].hidden = panel !== "processing";
        els["scribe-summary-error"].hidden = panel !== "error";
        els["scribe-summary-ready"].hidden = panel !== "ready";
        els["scribe-note-actions"].hidden = panel !== "ready";
        if (panel !== "ready") {
            els["scribe-share-error"].hidden = true;
            els["scribe-share-success"].hidden = true;
        }
        renderHeader();
    }

    function renderDetails() {
        const s = state.summary;
        const box = els["scribe-details"];
        const items = [];
        if (s.doctorName) items.push(["Doctor", doctorLabel(s.doctorName)]);
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
        els["scribe-sections"].innerHTML = SECTIONS.map(({ key, title, icon }) => {
            const on = state.selected[key];
            const lines = state.edited[key].split("\n").map((l) => l.trim()).filter(Boolean);
            return `
                <div class="scribe-section ${on ? "" : "off"}" data-key="${key}">
                    <div class="scribe-section-head">
                        <span class="section-icon material-symbols-outlined">${icon}</span>
                        <h3>${title}</h3>
                        <button class="icon-btn sm" data-action="edit" title="Edit ${title}" aria-label="Edit ${title}">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <label class="include-toggle" title="Include ${title} when sharing">
                            <span>Include</span>
                            <button class="scribe-toggle ${on ? "on" : ""}" data-action="toggle"
                                role="switch" aria-checked="${on}" aria-label="Include ${title} when sharing"></button>
                        </label>
                    </div>
                    <div class="scribe-section-body">
                        <ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
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
            <textarea rows="${rows}" class="form-control"></textarea>
            <div class="scribe-edit-actions">
                <button class="btn-secondary-sm" data-action="cancel-edit">Cancel</button>
                <button class="btn-primary-sm" data-action="save-edit">Save</button>
            </div>
        `;
        const ta = body.querySelector("textarea");
        ta.value = value;
        ta.focus();
    }

    function selectTab(which) {
        const note = which === "note";
        els["scribe-tab-note"].setAttribute("aria-selected", String(note));
        els["scribe-tab-transcript"].setAttribute("aria-selected", String(!note));
        els["scribe-tab-note"].tabIndex = note ? 0 : -1;
        els["scribe-tab-transcript"].tabIndex = note ? -1 : 0;
        els["scribe-note-panel"].hidden = !note;
        els["scribe-transcript-wrap"].hidden = note;
    }

    function renderReady() {
        renderDetails();
        renderSections();
        const t = (state.transcript || "").trim();
        els["scribe-transcript"].textContent = t || "No transcript available for this session.";
        selectTab("note");
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
            state.status = "error";
            els["scribe-error-text"].textContent = "Microphone access is required to record consultations. Allow it in your browser, or upload audio instead.";
            renderRecorder();
            showPanel("error");
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
            state.edited = {
                symptoms: data.summary.symptoms || "Not discussed",
                diagnosis: data.summary.diagnosis || "Not discussed",
                prescription:
                    Array.isArray(data.summary.prescription) && data.summary.prescription.length > 0
                        ? data.summary.prescription.map((p) => `${p.name} - ${p.dosage} (${p.instructions})`).join("\n")
                        : "Not discussed",
            };
            state.selected = { symptoms: true, diagnosis: true, prescription: true };

            const session = {
                id: Date.now(),
                createdAt: new Date().toISOString(),
                summary: state.summary,
                transcript: state.transcript,
                edited: { ...state.edited },
                selected: { ...state.selected },
            };
            state.sessions.unshift(session);
            state.activeId = session.id;
            persistSessions();

            state.status = "ready";
            renderSessions();
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
    // Share content: plain text for copying, branded HTML for print/email
    // ---------------------------------------------------------------------
    function includedSections() {
        return SECTIONS.filter(({ key }) => state.selected[key]).map(({ key, title }) => ({
            key,
            title,
            lines: state.edited[key].split("\n").map((l) => l.trim()).filter(Boolean),
        }));
    }

    function detailPairs() {
        const s = state.summary;
        const pairs = [];
        if (s.doctorName) pairs.push(["Doctor", doctorLabel(s.doctorName)]);
        if (s.patientName) pairs.push(["Patient", s.patientName]);
        if (s.patientAge) pairs.push(["Age", s.patientAge]);
        if (s.patientWeight) pairs.push(["Weight", s.patientWeight]);
        return pairs;
    }

    function buildFilteredContent() {
        if (!state.summary) return { text: "", html: "" };
        const clinic = clinicInfo();
        const session = activeSession();
        const when = new Date(session?.createdAt || Date.now()).toLocaleString("en-IN", {
            day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit",
        });
        const pairs = detailPairs();
        const sections = includedSections();

        const text = [
            "Consultation Summary",
            `${clinic.name}, ${when}`,
            "",
            ...pairs.map(([k, v]) => `${k}: ${v}`),
            ...(pairs.length ? [""] : []),
            ...sections.flatMap(({ title, lines }) => [title, ...lines.map((l) => `- ${l}`), ""]),
            "This summary was generated automatically. Please consult your doctor for any clarifications.",
        ].join("\n");

        const C = { primary: "#5E4AD1", light: "#F3F0FF", text: "#1E293B", muted: "#64748B", border: "#E5E7EB" };
        const font = "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
        const label = `font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${C.muted};`;

        const detailCells = pairs.map(([k, v], i) => `
            <td style="padding:12px 16px;vertical-align:top;${i < pairs.length - 1 ? `border-right:1px solid ${C.border};` : ""}">
                <div style="${label}margin-bottom:4px;">${esc(k)}</div>
                <div style="font-size:15px;font-weight:600;color:${C.text};">${esc(v)}</div>
            </td>`).join("");

        const sectionHtml = sections.map(({ title, lines }) => `
            <div style="margin-top:28px;">
                <h2 style="margin:0 0 10px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${C.primary};">${esc(title)}</h2>
                <ul style="margin:0;padding:0 0 0 18px;font-size:15px;line-height:1.7;color:${C.text};">
                    ${lines.map((l) => `<li style="margin:0 0 4px;">${esc(l)}</li>`).join("")}
                </ul>
            </div>`).join("");

        const html = `
            <div style="font-family:${font};color:${C.text};max-width:720px;margin:0 auto;line-height:1.5;">
                <table role="presentation" style="width:100%;border-collapse:collapse;">
                    <tr>
                        <td style="vertical-align:top;">
                            <div style="font-size:20px;font-weight:600;letter-spacing:-0.02em;color:${C.primary};">DoctorSuno</div>
                            <div style="margin-top:4px;font-size:13px;color:${C.muted};">${esc(clinic.name)}</div>
                            <div style="font-size:13px;color:${C.muted};">${esc(clinic.address)}</div>
                            <div style="font-size:13px;color:${C.muted};">${esc(clinic.email)}</div>
                        </td>
                        <td style="vertical-align:top;text-align:right;">
                            <div style="font-size:18px;font-weight:600;letter-spacing:-0.01em;">Consultation Summary</div>
                            <div style="margin-top:4px;font-size:13px;color:${C.muted};">${esc(when)}</div>
                        </td>
                    </tr>
                </table>
                <div style="height:3px;background:${C.primary};border-radius:2px;margin:20px 0 24px;"></div>
                ${pairs.length ? `
                <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${C.border};border-radius:8px;background:${C.light};">
                    <tr>${detailCells}</tr>
                </table>` : ""}
                ${sectionHtml}
                <div style="margin-top:40px;padding-top:16px;border-top:1px solid ${C.border};font-size:12px;color:${C.muted};">
                    This summary was generated automatically. Please consult your doctor for any clarifications.
                </div>
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
        if (msg) els["scribe-share-success"].hidden = true;
    }

    async function sendEmail() {
        if (!anySelected()) {
            showShareError("Please select at least one section to send.");
            return;
        }
        showShareError("");
        els["scribe-share-success"].hidden = true;

        const { text } = buildFilteredContent();
        if (!text) return;

        const btn = els["scribe-send-btn"];
        const label = btn.querySelector(".scribe-send-label");
        btn.disabled = true;
        label.textContent = "Sending...";

        // TODO: demo mock — replace with POST ${apiBase()}/api/consultation/send
        // ({ email, summary: text, summaryHtml: html }) once email delivery is live,
        // using the patient's email from their record.
        await new Promise((resolve) => setTimeout(resolve, 800));

        const success = els["scribe-share-success"];
        success.textContent = "Consultation summary has been emailed to the patient.";
        success.hidden = false;
        label.textContent = "Sent";
        btn.classList.add("sent");
        setTimeout(() => {
            label.textContent = "Send via Email";
            btn.classList.remove("sent");
            btn.disabled = false;
        }, 3000);
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

        const printWindow = window.open("", "_blank", "width=860,height=900");
        if (!printWindow) {
            showShareError("Please allow pop-ups to print or save the summary.");
            return;
        }

        const title = `Consultation Summary - ${state.summary.patientName || "Patient"}`;
        printWindow.document.write(`<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <title>${esc(title)}</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
                <style>
                    @page { size: A4; margin: 18mm 16mm; }
                    body { margin: 0; padding: 40px; background: #FFFFFF; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                ${html}
                <script>
                    window.onload = function () {
                        (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
                            window.print();
                            setTimeout(function () { window.close(); }, 500);
                        });
                    };
                <\/script>
            </body>
            </html>`);
        printWindow.document.close();
    }

    // ---------------------------------------------------------------------
    // Init
    // ---------------------------------------------------------------------
    document.addEventListener("DOMContentLoaded", () => {
        IDS.forEach((id) => { els[id] = $(id); });
        if (!els["scribe-record-btn"]) return;

        els["scribe-record-btn"].addEventListener("click", () => {
            if (state.status === "recording" || state.status === "paused") stopRecording();
            else if (state.status === "idle" || state.status === "preview" || state.status === "error") startRecording();
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

        els["scribe-upload"].addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            e.target.value = "";
            if (!file) return;
            if (!/\.(mp3|wav|m4a|ogg|webm|flac)$/i.test(file.name)) {
                state.audioBlob = null;
                state.status = "error";
                els["scribe-error-text"].textContent =
                    "Please upload an audio file (MP3, WAV, M4A, OGG, WebM or FLAC).";
                renderRecorder();
                showPanel("error");
                return;
            }
            enterPreview(file);
        });

        els["scribe-sections"].addEventListener("click", (e) => {
            const actionEl = e.target.closest("[data-action]");
            if (!actionEl) return;
            e.preventDefault();
            const sectionEl = actionEl.closest(".scribe-section");
            const key = sectionEl.getAttribute("data-key");
            const action = actionEl.getAttribute("data-action");

            if (action === "toggle") {
                state.selected[key] = !state.selected[key];
                renderSections();
                syncActiveSession();
            } else if (action === "edit") {
                openEditor(sectionEl, key);
            } else if (action === "save-edit") {
                const ta = sectionEl.querySelector("textarea");
                if (ta) state.edited[key] = ta.value;
                renderSections();
                syncActiveSession();
            } else if (action === "cancel-edit") {
                renderSections();
            }
        });

        els["scribe-tab-note"].addEventListener("click", () => selectTab("note"));
        els["scribe-tab-transcript"].addEventListener("click", () => selectTab("transcript"));
        [els["scribe-tab-note"], els["scribe-tab-transcript"]].forEach((tab) => {
            tab.addEventListener("keydown", (e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                const next = tab === els["scribe-tab-note"] ? "transcript" : "note";
                selectTab(next);
                els[next === "note" ? "scribe-tab-note" : "scribe-tab-transcript"].focus();
            });
        });

        els["scribe-sessions-list"].addEventListener("click", (e) => {
            const del = e.target.closest("[data-delete-session]");
            if (del) { deleteSession(Number(del.getAttribute("data-delete-session"))); return; }
            const open = e.target.closest("[data-session]");
            if (open) openSession(Number(open.getAttribute("data-session")));
        });
        els["scribe-new-btn"].addEventListener("click", newSession);

        els["scribe-send-btn"].addEventListener("click", sendEmail);
        els["scribe-copy-btn"].addEventListener("click", copySummary);
        els["scribe-print-btn"].addEventListener("click", printSummary);

        loadSessions();
        renderSessions();
        renderRecorder();
        if (activeSession()) openSession(state.activeId);
        else showPanel("idle");
    });
})();
