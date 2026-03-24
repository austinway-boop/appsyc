/* ===== DOM References ===== */
const stepPanels = {
    1: document.getElementById("step-1"),
    2: document.getElementById("step-2"),
    3: document.getElementById("step-3"),
    loading: document.getElementById("loading-panel"),
};

const stepIndicators = document.querySelectorAll(".stepper .step");
const stepConnectors = document.querySelectorAll(".stepper .step-connector");

const rubricText = document.getElementById("rubric-text");
const rubricFileInput = document.getElementById("rubric-file");
const rubricTextareaWrap = document.getElementById("rubric-textarea-wrap");
const rubricDropHint = document.getElementById("rubric-drop-hint");
const rubricCharCount = document.getElementById("rubric-char-count");

const questionText = document.getElementById("question-text");
const questionCharCount = document.getElementById("question-char-count");

const rubricBanner = document.getElementById("rubric-banner");
const rubricBannerDetail = document.getElementById("rubric-banner-detail");
const btnEditRubric = document.getElementById("btn-edit-rubric");

const dropZone = document.getElementById("drop-zone");
const studentFilesInput = document.getElementById("student-files");
const fileListEl = document.getElementById("file-list");
const fileCountBadge = document.getElementById("file-count-badge");

const btnNext1 = document.getElementById("btn-next-1");
const btnBack2 = document.getElementById("btn-back-2");
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

    if (num === 2) {
        updateRubricBanner();
        updateGradeButton();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ===== Clickable stepper ===== */
stepIndicators.forEach((el) => {
    el.addEventListener("click", () => {
        const target = parseInt(el.dataset.step);
        if (el.classList.contains("completed")) {
            goToStep(target);
        }
    });
});

/* ===== Toast ===== */
let toastTimer = null;
function showError(msg) {
    errorMessage.textContent = msg;
    errorToast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => errorToast.classList.add("hidden"), 8000);
}

toastClose.addEventListener("click", () => {
    errorToast.classList.add("hidden");
    clearTimeout(toastTimer);
});

/* ===== Auto-growing textareas ===== */
function autoGrow(textarea) {
    textarea.style.height = "auto";
    const minH = parseInt(textarea.rows) * 24 + 24;
    textarea.style.height = Math.max(textarea.scrollHeight, minH) + "px";
}

function updateCharCount(textarea, countEl) {
    const len = textarea.value.trim().length;
    if (len === 0) {
        countEl.textContent = "";
        textarea.classList.remove("has-content");
    } else {
        const words = textarea.value.trim().split(/\s+/).length;
        countEl.textContent = `${words} word${words !== 1 ? "s" : ""}`;
        textarea.classList.add("has-content");
    }
}

rubricText.addEventListener("input", () => {
    autoGrow(rubricText);
    updateCharCount(rubricText, rubricCharCount);
});

questionText.addEventListener("input", () => {
    autoGrow(questionText);
    updateCharCount(questionText, questionCharCount);
});

/* ===== Step 1: Rubric file drop on textarea ===== */
rubricTextareaWrap.addEventListener("dragover", (e) => {
    e.preventDefault();
    rubricTextareaWrap.classList.add("drag-over");
});

rubricTextareaWrap.addEventListener("dragleave", (e) => {
    if (!rubricTextareaWrap.contains(e.relatedTarget)) {
        rubricTextareaWrap.classList.remove("drag-over");
    }
});

rubricTextareaWrap.addEventListener("drop", (e) => {
    e.preventDefault();
    rubricTextareaWrap.classList.remove("drag-over");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        const ext = file.name.split(".").pop().toLowerCase();
        if (["txt", "md"].includes(ext)) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                rubricText.value = ev.target.result;
                autoGrow(rubricText);
                updateCharCount(rubricText, rubricCharCount);
            };
            reader.readAsText(file);
        } else if (["pdf", "docx"].includes(ext)) {
            const dt = new DataTransfer();
            dt.items.add(file);
            rubricFileInput.files = dt.files;
            rubricText.value = "";
            rubricText.placeholder = `File loaded: ${file.name}\n\nThe file will be processed on the server when grading begins.`;
            rubricText.classList.add("has-content");
            updateCharCount(rubricText, rubricCharCount);
            rubricCharCount.textContent = file.name;
        } else {
            showError("Rubric must be TXT, MD, PDF, or DOCX.");
        }
    }
});

/* ===== Step 1: Rubric file picker ===== */
rubricFileInput.addEventListener("change", () => {
    if (rubricFileInput.files.length > 0) {
        const file = rubricFileInput.files[0];
        const ext = file.name.split(".").pop().toLowerCase();
        if (["txt", "md"].includes(ext)) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                rubricText.value = ev.target.result;
                autoGrow(rubricText);
                updateCharCount(rubricText, rubricCharCount);
                rubricFileInput.value = "";
            };
            reader.readAsText(file);
        } else {
            rubricText.placeholder = `File loaded: ${file.name}\n\nThe file will be processed on the server when grading begins.`;
            rubricText.classList.add("has-content");
            rubricCharCount.textContent = file.name;
        }
    }
});

/* ===== Step 1: Next ===== */
btnNext1.addEventListener("click", () => {
    const hasText = rubricText.value.trim().length > 0;
    const hasFile = rubricFileInput.files.length > 0;
    if (!hasText && !hasFile) {
        showError("Please paste a rubric or upload a rubric file before continuing.");
        rubricText.focus();
        return;
    }
    goToStep(2);
});

/* ===== Rubric banner on Step 2 ===== */
function updateRubricBanner() {
    const text = rubricText.value.trim();
    const hasFile = rubricFileInput.files.length > 0;
    if (text) {
        const words = text.split(/\s+/).length;
        const preview = text.substring(0, 80).replace(/\n/g, " ");
        rubricBannerDetail.textContent = `\u2014 ${words} words: "${preview}${text.length > 80 ? "..." : ""}"`;
    } else if (hasFile) {
        rubricBannerDetail.textContent = `\u2014 ${rubricFileInput.files[0].name}`;
    } else {
        rubricBannerDetail.textContent = "";
    }
}

btnEditRubric.addEventListener("click", () => goToStep(1));

/* ===== Step 2: Drag & Drop ===== */
dropZone.addEventListener("click", () => studentFilesInput.click());

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    addFiles(e.dataTransfer.files);
});

studentFilesInput.addEventListener("change", () => {
    addFiles(studentFilesInput.files);
    studentFilesInput.value = "";
});

const ALLOWED_EXTENSIONS = ["txt", "md", "pdf", "docx", "jpg", "jpeg", "png", "gif", "webp"];

function addFiles(fileList) {
    for (const f of fileList) {
        const ext = f.name.split(".").pop().toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            showError(`Unsupported file type: .${ext}`);
            continue;
        }
        const alreadyAdded = studentFiles.some((sf) => sf.name === f.name && sf.size === f.size);
        if (!alreadyAdded) {
            studentFiles.push(f);
        }
    }
    renderFileList();
    updateGradeButton();
}

function removeFile(index) {
    studentFiles.splice(index, 1);
    renderFileList();
    updateGradeButton();
}

function updateGradeButton() {
    const hasQuestion = questionText.value.trim().length > 0;
    const hasFiles = studentFiles.length > 0;
    btnGrade.disabled = !hasQuestion || !hasFiles;

    if (studentFiles.length === 0) {
        btnGradeLabel.textContent = "Grade Responses";
    } else {
        btnGradeLabel.textContent = `Grade ${studentFiles.length} Response${studentFiles.length > 1 ? "s" : ""}`;
    }

    if (studentFiles.length > 0) {
        fileCountBadge.textContent = studentFiles.length;
        fileCountBadge.classList.add("visible");
    } else {
        fileCountBadge.classList.remove("visible");
    }
}

questionText.addEventListener("input", updateGradeButton);

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
        const size = f.size < 1024 * 1024
            ? (f.size / 1024).toFixed(1) + " KB"
            : (f.size / (1024 * 1024)).toFixed(1) + " MB";

        const el = document.createElement("div");
        el.className = "file-item";
        el.innerHTML = `
            <span class="file-item-name">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>${escapeHtml(f.name)}</span>
            </span>
            <span class="file-item-right">
                <span class="file-item-size">${size}</span>
                <button class="file-item-remove" title="Remove">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </span>
        `;
        el.querySelector(".file-item-remove").addEventListener("click", (e) => {
            e.stopPropagation();
            removeFile(i);
        });
        fileListEl.appendChild(el);
    });
}

/* ===== Step 2: Back ===== */
btnBack2.addEventListener("click", () => goToStep(1));

/* ===== Grade ===== */
btnGrade.addEventListener("click", async () => {
    const question = questionText.value.trim();
    if (!question) {
        showError("Please enter the FRQ question/prompt.");
        questionText.focus();
        return;
    }
    if (studentFiles.length === 0) {
        showError("Please upload at least one student response file.");
        return;
    }

    Object.values(stepPanels).forEach((p) => p.classList.remove("active"));
    stepPanels.loading.classList.add("active");

    const total = studentFiles.length;
    loadingStatus.textContent = `Grading ${total} response${total > 1 ? "s" : ""}...`;
    progressBarWrap.style.display = "block";
    progressBar.style.width = "5%";

    const formData = new FormData();
    formData.append("rubric_text", rubricText.value.trim());
    formData.append("question_text", question);

    if (rubricFileInput.files.length > 0) {
        formData.append("rubric_file", rubricFileInput.files[0]);
    }

    studentFiles.forEach((f) => {
        formData.append("files[]", f);
    });

    const estimatedMs = total * 45000;
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(90, (elapsed / estimatedMs) * 90 + 5);
        progressBar.style.width = pct + "%";

        const studentIdx = Math.min(Math.floor(elapsed / 45000) + 1, total);
        const fileName = studentFiles[studentIdx - 1]?.name || "";
        loadingStatus.textContent = `Grading response ${studentIdx} of ${total}${fileName ? ": " + fileName : ""}...`;
    }, 2000);

    try {
        const resp = await fetch("/grade", {
            method: "POST",
            body: formData,
        });

        clearInterval(progressInterval);
        progressBar.style.width = "100%";

        const data = await resp.json();

        if (!resp.ok) {
            showError(data.error || "An error occurred while grading.");
            goToStep(2);
            return;
        }

        gradingResults = data.results;
        renderResults(gradingResults);
        goToStep(3);
    } catch (err) {
        clearInterval(progressInterval);
        showError("Network error: " + err.message);
        goToStep(2);
    }
});

/* ===== Results Rendering ===== */
function renderResults(results) {
    summaryStats.innerHTML = "";
    resultsContainer.innerHTML = "";

    const totalStudents = results.length;
    const scores = results.map((r) => r.total_score || 0);
    const maxScores = results.map((r) => r.max_score || 7);
    const mean = scores.reduce((a, b) => a + b, 0) / totalStudents;
    const maxPossible = maxScores[0] || 7;
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);

    summaryStats.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${totalStudents}</div>
            <div class="stat-label">Responses</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${mean.toFixed(1)} / ${maxPossible}</div>
            <div class="stat-label">Mean Score</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${highest}</div>
            <div class="stat-label">Highest</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${lowest}</div>
            <div class="stat-label">Lowest</div>
        </div>
    `;

    results.forEach((r, idx) => {
        if (r.error && !r.parts?.length) {
            const errEl = document.createElement("div");
            errEl.className = "error-card";
            errEl.textContent = `${r.student_file}: ${r.error}`;
            resultsContainer.appendChild(errEl);
            return;
        }

        const score = r.total_score || 0;
        const max = r.max_score || 7;
        const pct = max > 0 ? score / max : 0;
        const scoreClass = pct >= 0.7 ? "score-high" : pct >= 0.4 ? "score-mid" : "score-low";

        const card = document.createElement("div");
        card.className = "student-card" + (idx === 0 ? " open" : "");

        let partsHtml = "";
        (r.parts || []).forEach((p) => {
            const earned = p.points_earned > 0;
            partsHtml += `
                <div class="part-row">
                    <div class="part-indicator ${earned ? "earned" : "not-earned"}">${earned ? p.points_earned : 0}</div>
                    <div class="part-details">
                        <div class="part-label">Part ${escapeHtml(p.part)} \u2014 ${p.points_earned}/${p.points_possible} pt${p.points_possible > 1 ? "s" : ""}</div>
                        <div class="part-justification">${escapeHtml(p.justification || "")}</div>
                    </div>
                </div>
            `;
        });

        card.innerHTML = `
            <div class="student-card-header">
                <div class="student-card-left">
                    <span class="student-card-filename">${escapeHtml(r.student_file || "Student " + (idx + 1))}</span>
                    <span class="student-card-score ${scoreClass}">${score} / ${max}</span>
                </div>
                <svg class="chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="student-card-body">
                ${partsHtml}
                ${r.overall_feedback ? `<div class="overall-feedback"><strong>Overall Feedback:</strong> ${escapeHtml(r.overall_feedback)}</div>` : ""}
            </div>
        `;

        card.querySelector(".student-card-header").addEventListener("click", () => {
            card.classList.toggle("open");
        });

        resultsContainer.appendChild(card);
    });
}

/* ===== Export CSV ===== */
btnExportCsv.addEventListener("click", async () => {
    if (!gradingResults) return;

    try {
        const resp = await fetch("/export-csv", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ results: gradingResults }),
        });

        if (!resp.ok) {
            showError("Failed to export CSV.");
            return;
        }

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "grading_results.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (err) {
        showError("Export failed: " + err.message);
    }
});

/* ===== Grade More (keep rubric, clear files) ===== */
btnGradeMore.addEventListener("click", () => {
    questionText.value = "";
    studentFiles = [];
    gradingResults = null;
    fileListEl.innerHTML = "";
    summaryStats.innerHTML = "";
    resultsContainer.innerHTML = "";
    updateCharCount(questionText, questionCharCount);
    autoGrow(questionText);
    goToStep(2);
});

/* ===== Start Over ===== */
btnNewSession.addEventListener("click", () => {
    rubricText.value = "";
    rubricText.placeholder = 'Paste the scoring guidelines here. Example:\n\nPart A (1 point): Identifies the research method used in the study...';
    rubricText.classList.remove("has-content");
    rubricFileInput.value = "";
    rubricCharCount.textContent = "";
    questionText.value = "";
    questionText.classList.remove("has-content");
    questionCharCount.textContent = "";
    studentFiles = [];
    gradingResults = null;
    fileListEl.innerHTML = "";
    summaryStats.innerHTML = "";
    resultsContainer.innerHTML = "";
    autoGrow(rubricText);
    autoGrow(questionText);
    goToStep(1);
});

/* ===== Helpers ===== */
function escapeHtml(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

/* ===== Init ===== */
updateGradeButton();
