/**
 * app.js
 * Main application controller.
 * Coordinates MediaPipe pose detection, pose analysis, AI feedback, voice coaching, and UI updates.
 */

window.App = (() => {
  // ─── State ───────────────────────────────────────────────────────────────
  let selectedExercise = null;
  let pose             = null;
  let camera           = null;
  let stream           = null;

  let analysisActive   = false;
  let poseDetected     = false;
  let noPoseTimer      = null;

  let timerInterval    = null;
  let timerSeconds     = 0;
  let timerRunning     = false;

  let repCount         = 0;
  let lastFeedbackTime = 0;
  const FEEDBACK_INTERVAL = 5000; // ms between AI calls

  // ─── Initialization ───────────────────────────────────────────────────────
  function init() {
    UI.renderExerciseGrid(window.EXERCISES);
    console.log("[App] FORM Trainer initialized.");
  }

  // ─── Exercise Selection ───────────────────────────────────────────────────

  // Called directly from card onclick="window.App.selectExercise(...)"
  function selectExercise(id) {
    selectedExercise = window.EXERCISES.find(ex => ex.id === id);
    if (!selectedExercise) return;
    UI.selectExerciseCard(id);
    UI.setStartButtonState(true, selectedExercise.name);
  }

  function launchTrainer() {
    if (!selectedExercise) return;

    repCount         = 0;
    lastFeedbackTime = 0;

    PoseAnalyzer.resetReps(selectedExercise.analyzerKey);

    UI.showTrainerScreen(selectedExercise);
    UI.resetMetrics();
    UI.clearLog();
    UI.updateRepCircle(0);
    UI.setStatus("WAITING");

    initPose();

    // Announce exercise via voice
    VoiceCoach.announceExercise(selectedExercise.name);
  }

  function goBack() {
  stopSession();
  VoiceCoach.disable();              
  window.speechSynthesis.cancel();    
  setTimeout(() => VoiceCoach.enable(), 500);
  UI.showLandingScreen();
  UI.resetMetrics();
  UI.clearLog();
  UI.hideLiveCue();
  resetTimer();
}

  // ─── MediaPipe Setup ──────────────────────────────────────────────────────
  function initPose() {
    pose = new Pose({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity:        1,
      smoothLandmarks:        true,
      enableSegmentation:     false,
      minDetectionConfidence: 0.55,
      minTrackingConfidence:  0.55,
    });

    pose.onResults(onPoseResults);
  }

  function startCamera() {
    UI.hideCameraPrompt();
    UI.setStatus("CONNECTING");

    const video  = document.getElementById("videoElement");
    const canvas = document.getElementById("poseCanvas");

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      .then(mediaStream => {
        stream = mediaStream;
        video.srcObject = mediaStream;

        video.onloadedmetadata = () => {
          canvas.width  = video.videoWidth;
          canvas.height = video.videoHeight;

          camera = new Camera(video, {
            onFrame: async () => {
              if (pose) await pose.send({ image: video });
            },
            width: 1280, height: 720,
          });

          camera.start();
          analysisActive = true;
          UI.setStatus("LIVE", true);
          startTimer();
        };
      })
      .catch(err => {
        console.error("[App] Camera error:", err);
        UI.setStatus("CAMERA ERROR");
        document.getElementById("cameraPrompt").classList.remove("hidden");
        document.querySelector(".camera-prompt-sub").textContent =
          "Camera access was denied. Please allow camera permissions and try again.";
      });
  }

  function stopSession() {
    analysisActive = false;

    if (camera)  { camera.stop(); camera = null; }
    if (stream)  { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (pose)    { pose.close?.(); pose = null; }

    stopTimer();
    clearTimeout(noPoseTimer);
    noPoseTimer  = null;
    poseDetected = false;

    const video = document.getElementById("videoElement");
    if (video.srcObject) { video.srcObject = null; }

    const canvas = document.getElementById("poseCanvas");
    const ctx    = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ─── Pose Results Handler ─────────────────────────────────────────────────
  function onPoseResults(results) {
    if (!analysisActive) return;

    const canvas = document.getElementById("poseCanvas");
    const ctx    = canvas.getContext("2d");

    // Match canvas to video dimensions
    if (results.image) {
      canvas.width  = results.image.width  || canvas.width;
      canvas.height = results.image.height || canvas.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.poseLandmarks) {
      handleNoPose();
      return;
    }

    // Pose re-acquired
    if (!poseDetected) {
      poseDetected = true;
      clearTimeout(noPoseTimer);
      noPoseTimer = null;
      UI.showNoPose(false);
    }

    
    const midSh  = { y: (lms[11].y + lms[12].y) / 2 };
const midAnk = { y: (lms[27].y + lms[28].y) / 2 };
const heightRatio = Math.abs(midAnk.y - midSh.y);
const exercisesNeedingLowPosition = ["plank", "mountain-climber", "push-up", "burpee", "glute-bridge", "bicycle-crunch"];
if (exercisesNeedingLowPosition.includes(selectedExercise.id) && heightRatio > 0.35) {
  UI.showNoPose(false);
  document.getElementById("liveCueText").textContent = "Get into position on the floor";
  document.getElementById("liveCueText").classList.add("visible");
  return;
}

    // Draw skeleton
    drawConnectors(ctx, lms, POSE_CONNECTIONS, {
      color: "rgba(232,255,71,0.45)",
      lineWidth: 2.5,
    });
    drawLandmarks(ctx, lms, {
      color:     "rgba(255,255,255,0.85)",
      fillColor: "rgba(232,255,71,0.75)",
      lineWidth: 1,
      radius:    4,
    });

    // ── Analyze ──────────────────────────────────────────────────────────
    const result = PoseAnalyzer.analyze(selectedExercise.analyzerKey, lms);

    // ── Update UI ─────────────────────────────────────────────────────────
    UI.updateScoreCircle(result.score);
    UI.updateMetrics(result.metrics);

    // Rep counting
    if (result.repSignal) {
      repCount++;
      UI.updateRepCircle(repCount);
      VoiceCoach.announceRep(repCount);
    }

    // ── Throttled AI feedback ─────────────────────────────────────────────
    const now = Date.now();
    if (now - lastFeedbackTime >= FEEDBACK_INTERVAL) {
      lastFeedbackTime = now;
      fetchAndDeliverFeedback(result);
    }
  }

  // ─── No Pose Handler ──────────────────────────────────────────────────────
  function handleNoPose() {
    if (!noPoseTimer) {
      noPoseTimer = setTimeout(() => {
        UI.showNoPose(true);
        UI.hideLiveCue();
        poseDetected = false;
        noPoseTimer  = null;
        VoiceCoach.sayGetInFrame();
      }, 2000);
    }
  }

  // ─── Feedback Pipeline ────────────────────────────────────────────────────
  async function fetchAndDeliverFeedback(analysisResult) {
  if (!analysisActive) return;

  if (analysisResult.score > 85 && analysisResult.issues.length === 0 && repCount === 0 && timerSeconds < 8) return;

  UI.showThinking();

  const payload = {
    exercise:       selectedExercise.id,
    score:          analysisResult.score,
    metrics:        analysisResult.metrics,
    issues:         analysisResult.issues,
    reps:           repCount,
    sessionSeconds: timerSeconds,
  };

  try {
    const response = await TrainerAPI.getFeedback(payload);
    if (!analysisActive) return;

    const { cue, level } = response;
    UI.updateCueBox(cue, analysisResult.score, level);
    UI.showLiveCue(cue, level);
    UI.addLogEntry(cue, level);

    const isUrgent = level === "bad";
    VoiceCoach.sayCoachingCue(cue, isUrgent);

  } catch (err) {
    console.error("[App] Feedback error:", err);
  }
}

  // ─── Timer ────────────────────────────────────────────────────────────────
  function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    UI.setTimerButtonState(true);

    timerInterval = setInterval(() => {
      timerSeconds++;
      UI.updateTimerDisplay(timerSeconds);
    }, 1000);
  }

  function stopTimer() {
    timerRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
    UI.setTimerButtonState(false);
  }

  function toggleTimer() {
    timerRunning ? stopTimer() : startTimer();
  }

  function resetTimer() {
    stopTimer();
    timerSeconds = 0;
    UI.updateTimerDisplay(0);
  }

  // ─── Voice Toggle ─────────────────────────────────────────────────────────
  function toggleVoice() {
    const isNowEnabled = VoiceCoach.toggle();
    UI.setVoiceButtonState(isNowEnabled);
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  return {
    init,
    selectExercise,
    launchTrainer,
    goBack,
    startCamera,
    toggleTimer,
    resetTimer,
    toggleVoice,
  };
})();

// Boot
document.addEventListener("DOMContentLoaded", () => window.App.init());
