/* ===== DOM ===== */
const stepPanels = {
    1: document.getElementById("step-1"),
    2: document.getElementById("step-2"),
    3: document.getElementById("step-3"),
    4: document.getElementById("step-4"),
    5: document.getElementById("step-5"),
    loading: document.getElementById("loading-panel"),
};

const stepIndicators = document.querySelectorAll(".stepper .step");
const stepConnectors = document.querySelectorAll(".stepper .step-connector");

const rubricText = document.getElementById("rubric-text");
const rubricFileInput = document.getElementById("rubric-file");
const rubricTextareaWrap = document.getElementById("rubric-textarea-wrap");
const rubricCharCount = document.getElementById("rubric-char-count");

const referenceText = document.getElementById("reference-text");
const referenceFileInput = document.getElementById("reference-file");
const referenceTextareaWrap = document.getElementById("reference-textarea-wrap");
const referenceCharCount = document.getElementById("reference-char-count");

const questionText = document.getElementById("question-text");
const questionCharCount = document.getElementById("question-char-count");

const dropZone = document.getElementById("drop-zone");
const studentFilesInput = document.getElementById("student-files");
const fileListEl = document.getElementById("file-list");
const fileCountBadge = document.getElementById("file-count-badge");

const btnGrade = document.getElementById("btn-grade");
const btnGradeLabel = document.getElementById("btn-grade-label");
const btnExportCsv = document.getElementById("btn-export-csv");
const btnGradeMore = document.getElementById("btn-grade-more");
const btnNewSession = document.getElementById("btn-new-session");

const loadingStatus = document.getElementById("loading-status");
const progressBarWrap = document.getElementById("progress-bar-wrap");
const progressBar = document.getElementById("progress-bar");

const summaryStats = document.getElementById("summary-stats");
const resultsContainer = document.getElementById("results-container");
const errorToast = document.getElementById("error-toast");
const errorMessage = document.getElementById("error-message");
const toastClose = document.getElementById("toast-close");

/* ===== State ===== */
let currentStep = 1;
let studentFiles = [];
let gradingResults = null;

/* ===== Navigation ===== */
function goToStep(num) {
    currentStep = num;
    Object.values(stepPanels).forEach((p) => p.classList.remove("active"));
    stepPanels[num]?.classList.add("active");

    stepIndicators.forEach((el) => {
        const s = parseInt(el.dataset.step);
        el.classList.remove("active", "completed");
        if (s === num) el.classList.add("active");
        else if (s < num) el.classList.add("completed");
    });

    stepConnectors.forEach((c) => {
        const after = parseInt(c.dataset.after);
        c.classList.toggle("filled", after < num);
    });

    if (num === 2) updateBannerRubric();
    if (num === 3) updateBannerSource();
    if (num === 4) {
        updateBannerReady();
        updateGradeButton();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

/* Clickable completed steps */
stepIndicators.forEach((el) => {
    el.addEventListener("click", () => {
        if (el.classList.contains("completed")) {
            goToStep(parseInt(el.dataset.step));
        }
    });
});

/* Generic back/goto buttons */
document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => goToStep(parseInt(btn.dataset.back)));
});
document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => goToStep(parseInt(btn.dataset.goto)));
});

/* ===== Toast ===== */
let toastTimer = null;
function showError(msg) {
    errorMessage.textContent = msg;
    errorToast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => errorToast.classList.add("hidden"), 8000);
}
toastClose.addEventListener("click", () => { errorToast.classList.add("hidden"); clearTimeout(toastTimer); });

/* ===== Textarea helpers ===== */
function autoGrow(ta) {
    ta.style.height = "auto";
    const min = parseInt(ta.rows) * 24 + 24;
    ta.style.height = Math.max(ta.scrollHeight, min) + "px";
}

function updateCharCount(ta, el) {
    const len = ta.value.trim().length;
    if (len === 0) { el.textContent = ""; ta.classList.remove("has-content"); }
    else {
        const w = ta.value.trim().split(/\s+/).length;
        el.textContent = `${w} word${w !== 1 ? "s" : ""}`;
        ta.classList.add("has-content");
    }
}

function wireTextarea(ta, countEl) {
    ta.addEventListener("input", () => { autoGrow(ta); updateCharCount(ta, countEl); });
}

wireTextarea(rubricText, rubricCharCount);
wireTextarea(referenceText, referenceCharCount);
wireTextarea(questionText, questionCharCount);

/* ===== File drop on textareas ===== */
function wireTextareaDrop(wrap, ta, fileInput, countEl, label) {
    wrap.addEventListener("dragover", (e) => { e.preventDefault(); wrap.classList.add("drag-over"); });
    wrap.addEventListener("dragleave", (e) => { if (!wrap.contains(e.relatedTarget)) wrap.classList.remove("drag-over"); });
    wrap.addEventListener("drop", (e) => {
        e.preventDefault();
        wrap.classList.remove("drag-over");
        const f = e.dataTransfer.files[0];
        if (!f) return;
        const ext = f.name.split(".").pop().toLowerCase();
        if (["txt", "md"].includes(ext)) {
            const reader = new FileReader();
            reader.onload = (ev) => { ta.value = ev.target.result; autoGrow(ta); updateCharCount(ta, countEl); };
            reader.readAsText(f);
        } else if (["pdf", "docx"].includes(ext)) {
            const dt = new DataTransfer(); dt.items.add(f); fileInput.files = dt.files;
            ta.value = ""; ta.placeholder = `File loaded: ${f.name}`; ta.classList.add("has-content");
            countEl.textContent = f.name;
        } else {
            showError(`${label} must be TXT, MD, PDF, or DOCX.`);
        }
    });
}

wireTextareaDrop(rubricTextareaWrap, rubricText, rubricFileInput, rubricCharCount, "Rubric");
wireTextareaDrop(referenceTextareaWrap, referenceText, referenceFileInput, referenceCharCount, "Reference material");

/* File picker for rubric & reference */
function wireFilePicker(fileInput, ta, countEl) {
    fileInput.addEventListener("change", () => {
        if (!fileInput.files.length) return;
        const f = fileInput.files[0];
        const ext = f.name.split(".").pop().toLowerCase();
        if (["txt", "md"].includes(ext)) {
            const reader = new FileReader();
            reader.onload = (ev) => { ta.value = ev.target.result; autoGrow(ta); updateCharCount(ta, countEl); fileInput.value = ""; };
            reader.readAsText(f);
        } else {
            ta.placeholder = `File loaded: ${f.name}`; ta.classList.add("has-content");
            countEl.textContent = f.name;
        }
    });
}

wireFilePicker(rubricFileInput, rubricText, rubricCharCount);
wireFilePicker(referenceFileInput, referenceText, referenceCharCount);

/* ===== Step transitions ===== */
document.getElementById("btn-next-1").addEventListener("click", () => {
    if (!rubricText.value.trim() && !rubricFileInput.files.length) {
        showError("Please paste or upload a scoring rubric."); rubricText.focus(); return;
    }
    goToStep(2);
});

document.getElementById("btn-next-2").addEventListener("click", () => {
    goToStep(3);
});

document.getElementById("btn-next-3").addEventListener("click", () => {
    if (!questionText.value.trim()) {
        showError("Please paste the FRQ questions."); questionText.focus(); return;
    }
    goToStep(4);
});

/* ===== Banners ===== */
function preview(text, maxLen) {
    const flat = text.replace(/\n/g, " ").trim();
    return flat.length > maxLen ? flat.substring(0, maxLen) + "..." : flat;
}

function updateBannerRubric() {
    const el = document.getElementById("banner-rubric-detail");
    const t = rubricText.value.trim();
    if (t) el.textContent = `\u2014 ${t.split(/\s+/).length} words: "${preview(t, 60)}"`;
    else if (rubricFileInput.files.length) el.textContent = `\u2014 ${rubricFileInput.files[0].name}`;
    else el.textContent = "";
}

function updateBannerSource() {
    const el = document.getElementById("banner-source-detail");
    const r = referenceText.value.trim();
    if (r) el.textContent = `\u2014 source: ${r.split(/\s+/).length} words`;
    else if (referenceFileInput.files.length) el.textContent = `\u2014 source: ${referenceFileInput.files[0].name}`;
    else el.textContent = `\u2014 no source material (rubric-only grading)`;
}

function updateBannerReady() {
    const el = document.getElementById("banner-ready-detail");
    const parts = [];
    const rt = rubricText.value.trim();
    parts.push(`rubric (${rt ? rt.split(/\s+/).length + " words" : rubricFileInput.files[0]?.name || "?"})`);
    const ref = referenceText.value.trim();
    if (ref || referenceFileInput.files.length) parts.push("source material");
    const qt = questionText.value.trim();
    if (qt) parts.push(`${qt.split(/\n/).filter(l => l.trim().match(/^\(?[A-Z]/)).length || "?"} question parts`);
    el.textContent = `\u2014 ${parts.join(", ")}`;
}

/* ===== Student files ===== */
dropZone.addEventListener("click", () => studentFilesInput.click());
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", (e) => { e.preventDefault(); dropZone.classList.remove("drag-over"); addFiles(e.dataTransfer.files); });
studentFilesInput.addEventListener("change", () => { addFiles(studentFilesInput.files); studentFilesInput.value = ""; });

const ALLOWED = ["txt", "md", "pdf", "docx", "jpg", "jpeg", "png", "gif", "webp"];

function addFiles(list) {
    for (const f of list) {
        const ext = f.name.split(".").pop().toLowerCase();
        if (!ALLOWED.includes(ext)) { showError(`Unsupported file type: .${ext}`); continue; }
        if (!studentFiles.some((sf) => sf.name === f.name && sf.size === f.size)) studentFiles.push(f);
    }
    renderFileList();
    updateGradeButton();
}

function removeFile(i) { studentFiles.splice(i, 1); renderFileList(); updateGradeButton(); }

function updateGradeButton() {
    btnGrade.disabled = studentFiles.length === 0;
    btnGradeLabel.textContent = studentFiles.length === 0
        ? "Grade Responses"
        : `Grade ${studentFiles.length} Response${studentFiles.length > 1 ? "s" : ""}`;
    if (studentFiles.length > 0) { fileCountBadge.textContent = studentFiles.length; fileCountBadge.classList.add("visible"); }
    else fileCountBadge.classList.remove("visible");
}

function renderFileList() {
    fileListEl.innerHTML = "";
    if (studentFiles.length > 0) {
        dropZone.classList.add("has-files");
        dropZone.querySelector("p").textContent = `${studentFiles.length} file${studentFiles.length > 1 ? "s" : ""} added \u2014 click or drop to add more`;
    } else {
        dropZone.classList.remove("has-files");
        dropZone.querySelector("p").textContent = "Drag & drop student files here";
    }
    studentFiles.forEach((f, i) => {
        const size = f.size < 1024 * 1024 ? (f.size / 1024).toFixed(1) + " KB" : (f.size / (1024 * 1024)).toFixed(1) + " MB";
        const el = document.createElement("div"); el.className = "file-item";
        el.innerHTML = `
            <span class="file-item-name"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>${esc(f.name)}</span></span>
            <span class="file-item-right"><span class="file-item-size">${size}</span><button class="file-item-remove" title="Remove"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span>`;
        el.querySelector(".file-item-remove").addEventListener("click", (e) => { e.stopPropagation(); removeFile(i); });
        fileListEl.appendChild(el);
    });
}

/* ===== Grade ===== */
btnGrade.addEventListener("click", async () => {
    if (studentFiles.length === 0) { showError("Upload at least one student response."); return; }

    Object.values(stepPanels).forEach((p) => p.classList.remove("active"));
    stepPanels.loading.classList.add("active");

    const total = studentFiles.length;
    loadingStatus.textContent = `Grading ${total} response${total > 1 ? "s" : ""}...`;
    progressBarWrap.style.display = "block";
    progressBar.style.width = "5%";

    const fd = new FormData();
    fd.append("rubric_text", rubricText.value.trim());
    fd.append("reference_text", referenceText.value.trim());
    fd.append("question_text", questionText.value.trim());
    if (rubricFileInput.files.length) fd.append("rubric_file", rubricFileInput.files[0]);
    if (referenceFileInput.files.length) fd.append("reference_file", referenceFileInput.files[0]);
    studentFiles.forEach((f) => fd.append("files[]", f));

    const est = total * 45000;
    const t0 = Date.now();
    const iv = setInterval(() => {
        const el = Date.now() - t0;
        progressBar.style.width = Math.min(90, el / est * 90 + 5) + "%";
        const idx = Math.min(Math.floor(el / 45000) + 1, total);
        const name = studentFiles[idx - 1]?.name || "";
        loadingStatus.textContent = `Grading response ${idx} of ${total}${name ? ": " + name : ""}...`;
    }, 2000);

    try {
        const resp = await fetch("/grade", { method: "POST", body: fd });
        clearInterval(iv);
        progressBar.style.width = "100%";
        const data = await resp.json();
        if (!resp.ok) { showError(data.error || "Grading error."); goToStep(4); return; }
        gradingResults = data.results;
        renderResults(gradingResults);
        goToStep(5);
    } catch (err) { clearInterval(iv); showError("Network error: " + err.message); goToStep(4); }
});

/* ===== Results ===== */
function renderResults(results) {
    summaryStats.innerHTML = ""; resultsContainer.innerHTML = "";
    const n = results.length;
    const scores = results.map((r) => r.total_score || 0);
    const max = results[0]?.max_score || 7;
    const mean = scores.reduce((a, b) => a + b, 0) / n;

    summaryStats.innerHTML = `
        <div class="stat-card"><div class="stat-value">${n}</div><div class="stat-label">Responses</div></div>
        <div class="stat-card"><div class="stat-value">${mean.toFixed(1)} / ${max}</div><div class="stat-label">Mean Score</div></div>
        <div class="stat-card"><div class="stat-value">${Math.max(...scores)}</div><div class="stat-label">Highest</div></div>
        <div class="stat-card"><div class="stat-value">${Math.min(...scores)}</div><div class="stat-label">Lowest</div></div>`;

    results.forEach((r, idx) => {
        if (r.error && !r.parts?.length) {
            resultsContainer.insertAdjacentHTML("beforeend", `<div class="error-card">${esc(r.student_file)}: ${esc(r.error)}</div>`);
            return;
        }
        const sc = r.total_score || 0, mx = r.max_score || 7, pct = mx > 0 ? sc / mx : 0;
        const cls = pct >= 0.7 ? "score-high" : pct >= 0.4 ? "score-mid" : "score-low";

        let parts = "";
        (r.parts || []).forEach((p) => {
            const e = p.points_earned > 0;
            parts += `<div class="part-row"><div class="part-indicator ${e ? "earned" : "not-earned"}">${e ? p.points_earned : 0}</div><div class="part-details"><div class="part-label">Part ${esc(p.part)} \u2014 ${p.points_earned}/${p.points_possible} pt${p.points_possible > 1 ? "s" : ""}</div><div class="part-justification">${esc(p.justification || "")}</div></div></div>`;
        });

        const card = document.createElement("div");
        card.className = "student-card" + (idx === 0 ? " open" : "");
        card.innerHTML = `
            <div class="student-card-header">
                <div class="student-card-left">
                    <span class="student-card-filename">${esc(r.student_file || "Student " + (idx + 1))}</span>
                    <span class="student-card-score ${cls}">${sc} / ${mx}</span>
                </div>
                <svg class="chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="student-card-body">${parts}${r.overall_feedback ? `<div class="overall-feedback"><strong>Overall Feedback:</strong> ${esc(r.overall_feedback)}</div>` : ""}</div>`;
        card.querySelector(".student-card-header").addEventListener("click", () => card.classList.toggle("open"));
        resultsContainer.appendChild(card);
    });
}

/* ===== Export ===== */
btnExportCsv.addEventListener("click", async () => {
    if (!gradingResults) return;
    try {
        const r = await fetch("/export-csv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ results: gradingResults }) });
        if (!r.ok) { showError("Export failed."); return; }
        const b = await r.blob(), u = URL.createObjectURL(b), a = document.createElement("a");
        a.href = u; a.download = "grading_results.csv"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
    } catch (e) { showError("Export failed: " + e.message); }
});

/* Grade More = keep rubric + source + questions, clear files */
btnGradeMore.addEventListener("click", () => {
    studentFiles = []; gradingResults = null;
    fileListEl.innerHTML = ""; summaryStats.innerHTML = ""; resultsContainer.innerHTML = "";
    goToStep(4);
});

/* Start Over = full reset */
btnNewSession.addEventListener("click", () => {
    [rubricText, referenceText, questionText].forEach((ta) => { ta.value = ""; ta.classList.remove("has-content"); ta.style.height = ""; });
    [rubricFileInput, referenceFileInput].forEach((f) => { f.value = ""; });
    [rubricCharCount, referenceCharCount, questionCharCount].forEach((c) => { c.textContent = ""; });
    studentFiles = []; gradingResults = null;
    fileListEl.innerHTML = ""; summaryStats.innerHTML = ""; resultsContainer.innerHTML = "";
    goToStep(1);
});

/* ===== Helpers ===== */
function esc(s) { const d = document.createElement("div"); d.appendChild(document.createTextNode(s)); return d.innerHTML; }

/* Init */
updateGradeButton();
