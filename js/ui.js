/**
 * ui.js
 * All DOM updates, rendering, and visual feedback.
 * No business logic here — pure presentation layer.
 */

window.UI = (() => {
  // ─── Exercise Grid ────────────────────────────────────────────────────────
  function renderExerciseGrid(exercises, onSelect) {
    const grid = document.getElementById("exerciseGrid");
    grid.innerHTML = exercises.map(ex => `
      <div
        class="ex-card"
        id="card-${ex.id}"
        data-difficulty="${ex.difficulty}"
        onclick="window.App.selectExercise('${ex.id}')"
        role="button"
        tabindex="0"
        aria-label="${ex.name}, ${ex.difficulty} difficulty"
      >
        <span class="ex-icon">${ex.icon}</span>
        <div class="ex-name">${ex.name}</div>
        <div class="ex-muscle">${ex.muscle}</div>
        <span class="ex-diff ${ex.difficulty}">${ex.difficulty}</span>
      </div>
    `).join("");

    // Keyboard navigation
    grid.querySelectorAll(".ex-card").forEach(card => {
      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          card.click();
        }
      });
    });

    // Filter buttons
    document.querySelectorAll(".filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const filter = btn.dataset.filter;
        document.querySelectorAll(".ex-card").forEach(card => {
          card.classList.toggle("hidden", filter !== "all" && card.dataset.difficulty !== filter);
        });
      });
    });
  }

  function selectExerciseCard(id) {
    document.querySelectorAll(".ex-card").forEach(c => c.classList.remove("selected"));
    const card = document.getElementById(`card-${id}`);
    if (card) card.classList.add("selected");
  }

  function setStartButtonState(enabled, exerciseName) {
    const btn  = document.getElementById("startBtn");
    const hint = document.getElementById("startHint");
    btn.disabled = !enabled;
    if (enabled && exerciseName) {
      hint.textContent = `Ready to train ${exerciseName}`;
      hint.classList.add("hidden");
    } else {
      hint.textContent = "← Select an exercise to begin";
      hint.classList.remove("hidden");
    }
  }

  // ─── Screen Transitions ───────────────────────────────────────────────────
  function showTrainerScreen(exercise) {
    document.getElementById("screen-landing").classList.remove("active");
    document.getElementById("screen-trainer").classList.add("active");
    document.getElementById("headerIcon").textContent = exercise.icon;
    document.getElementById("headerName").textContent = exercise.name.toUpperCase();
    renderMetricsGrid(exercise.keyPoints || ["head", "spine", "hips", "core"]);
    renderGuide(exercise);
  }

  function showLandingScreen() {
    document.getElementById("screen-trainer").classList.remove("active");
    document.getElementById("screen-landing").classList.add("active");
    document.getElementById("cameraPrompt").classList.remove("hidden");
  }

  // ─── Camera Prompt ────────────────────────────────────────────────────────
  function hideCameraPrompt() {
    document.getElementById("cameraPrompt").classList.add("hidden");
  }

  // ─── Status Pill ─────────────────────────────────────────────────────────
  function setStatus(text, isLive = false) {
    document.getElementById("statusText").textContent = text;
    const pill = document.getElementById("statusPill");
    pill.className = "status-pill" + (isLive ? " live" : "");
  }

  // ─── Score Circle ─────────────────────────────────────────────────────────
  function updateScoreCircle(score) {
    const circle = document.getElementById("scoreCircle");
    const val    = document.getElementById("scoreVal");
    const level  = score >= 75 ? "good" : score >= 50 ? "warn" : "bad";
    val.textContent = score + "%";
    val.style.color = `var(--${level})`;
    circle.className = "score-circle " + level;
  }

  function updateRepCircle(count) {
    document.getElementById("repVal").textContent = count;
  }

  // ─── Live Cue Banner (on video) ───────────────────────────────────────────
  let cueBannerTimer = null;

  function showLiveCue(text, level = "warn") {
    const el = document.getElementById("liveCueText");
    el.textContent = text;
    el.className = `live-cue-text visible ${level}-cue`;

    clearTimeout(cueBannerTimer);
    cueBannerTimer = setTimeout(() => {
      el.classList.remove("visible");
    }, 5000);
  }

  function hideLiveCue() {
    const el = document.getElementById("liveCueText");
    el.classList.remove("visible");
  }

  // ─── Cue Box (panel) ──────────────────────────────────────────────────────
  function showThinking() {
    document.getElementById("cueText").innerHTML = `
      <div class="dots"><span></span><span></span><span></span></div>
    `;
    document.getElementById("cueLevel").textContent = "Analyzing...";
    document.getElementById("cueLevel").className = "cue-level";
    document.getElementById("cueIcon").textContent = "🔍";
    document.getElementById("cueIcon").className = "cue-icon";
    document.getElementById("cueBox").className = "cue-box";
  }

  function updateCueBox(cue, score, level) {
    const box   = document.getElementById("cueBox");
    const icon  = document.getElementById("cueIcon");
    const lvl   = document.getElementById("cueLevel");
    const text  = document.getElementById("cueText");
    const fill  = document.getElementById("cueScoreFill");
    const num   = document.getElementById("cueScoreNum");

    const LEVELS = {
      good: { icon: "✓", title: "GREAT FORM",  color: "var(--good)" },
      warn: { icon: "⚠", title: "NEEDS WORK",  color: "var(--warn)" },
      bad:  { icon: "✗", title: "FIX FORM",    color: "var(--bad)"  },
    };

    const config = LEVELS[level] || LEVELS.warn;

    box.className  = `cue-box ${level}`;
    icon.textContent = config.icon;
    icon.className = `cue-icon ${level}`;
    lvl.textContent = config.title;
    lvl.className  = `cue-level ${level}`;
    text.textContent = cue;

    fill.style.width = score + "%";
    fill.className   = `cue-score-fill ${level !== "good" ? level : ""}`;
    num.textContent  = score + "%";
    num.className    = `cue-score-num ${level !== "good" ? level : ""}`;
  }

  // ─── Metrics Grid ─────────────────────────────────────────────────────────
  const METRIC_LABELS = {
    head:  "HEAD",
    spine: "SPINE",
    hips:  "HIPS",
    core:  "CORE",
    knees: "KNEES",
    arms:  "ARMS",
  };

  function renderMetricsGrid(keys = ["head", "spine", "hips", "core"]) {
    const grid = document.getElementById("metricsGrid");
    grid.innerHTML = keys.map(k => `
      <div class="metric-item" id="metric-item-${k}">
        <div class="metric-name">${METRIC_LABELS[k] || k.toUpperCase()}</div>
        <div class="metric-val" id="metric-val-${k}">—</div>
        <div class="metric-bar"><div class="metric-bar-fill" id="metric-bar-${k}"></div></div>
      </div>
    `).join("");
  }

  function updateMetrics(metrics) {
    Object.entries(metrics).forEach(([key, val]) => {
      const level = val >= 75 ? "good" : val >= 50 ? "warn" : "bad";
      const label = val >= 75 ? "GOOD" : val >= 50 ? "FAIR" : "FIX";

      const valEl  = document.getElementById(`metric-val-${key}`);
      const barEl  = document.getElementById(`metric-bar-${key}`);
      const itemEl = document.getElementById(`metric-item-${key}`);

      if (valEl)  { valEl.textContent  = label; valEl.className  = `metric-val ${level}`; }
      if (barEl)  { barEl.style.width  = val + "%"; barEl.className = `metric-bar-fill ${level !== "good" ? level : ""}`; }
      if (itemEl) { itemEl.className   = `metric-item ${level}`; }
    });
  }

  function resetMetrics() {
    document.querySelectorAll(".metric-val").forEach(el => { el.textContent = "—"; el.className = "metric-val"; });
    document.querySelectorAll(".metric-bar-fill").forEach(el => { el.style.width = "0%"; el.className = "metric-bar-fill"; });
    document.querySelectorAll(".metric-item").forEach(el => { el.className = "metric-item"; });
  }

  // ─── Coaching Log ─────────────────────────────────────────────────────────
  function addLogEntry(text, level = "warn") {
    const container = document.getElementById("logList");
    const time = new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.innerHTML = `
      <div class="log-time">${time}</div>
      <div class="log-bubble ${level}">${escapeHtml(text)}</div>
    `;

    container.insertBefore(entry, container.firstChild);

    // Keep max 25 entries
    const entries = container.querySelectorAll(".log-entry");
    if (entries.length > 25) entries[entries.length - 1].remove();
  }

  function clearLog() {
    document.getElementById("logList").innerHTML = "";
  }

  // ─── Exercise Guide ───────────────────────────────────────────────────────
  function renderGuide(exercise) {
    const container = document.getElementById("guideContent");
    container.innerHTML = `
      <div class="guide-steps">
        ${exercise.guide.map((step, i) => `
          <div class="guide-step">
            <div class="step-num">${i + 1}</div>
            <div class="step-text">${escapeHtml(step)}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // ─── No-Pose Overlay ──────────────────────────────────────────────────────
  function showNoPose(visible) {
    document.getElementById("noPoseOverlay").classList.toggle("visible", visible);
  }

  // ─── Voice Toggle Button ──────────────────────────────────────────────────
  function setVoiceButtonState(isEnabled) {
    const btn   = document.getElementById("voiceToggle");
    const icon  = document.getElementById("voiceIcon");
    const label = document.getElementById("voiceLabel");
    icon.textContent  = isEnabled ? "🔊" : "🔇";
    label.textContent = isEnabled ? "VOICE ON" : "VOICE OFF";
    btn.classList.toggle("muted", !isEnabled);
  }

  // ─── Timer Display ────────────────────────────────────────────────────────
  function updateTimerDisplay(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    document.getElementById("timerDisplay").textContent = `${m}:${s}`;
  }

  function setTimerButtonState(isRunning) {
    document.getElementById("timerToggle").textContent = isRunning ? "⏸" : "▶";
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ─── Public ───────────────────────────────────────────────────────────────
  return {
    renderExerciseGrid,
    selectExerciseCard,
    setStartButtonState,
    showTrainerScreen,
    showLandingScreen,
    hideCameraPrompt,
    setStatus,
    updateScoreCircle,
    updateRepCircle,
    showLiveCue,
    hideLiveCue,
    showThinking,
    updateCueBox,
    renderMetricsGrid,
    updateMetrics,
    resetMetrics,
    addLogEntry,
    clearLog,
    renderGuide,
    showNoPose,
    setVoiceButtonState,
    updateTimerDisplay,
    setTimerButtonState,
  };
})();
