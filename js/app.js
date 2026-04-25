window.App = (() => {
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
  let lastSpokenCue = "";
  let repCount         = 0;
  let lastFeedbackTime = 0;
  const FEEDBACK_INTERVAL = 3000;

  function init() {
    UI.renderExerciseGrid(window.EXERCISES);
    console.log("[App] FORM Trainer initialized.");
  }

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

  function initPose() {
    pose = new Pose({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity:          1,
      smoothLandmarks:          true,
      enableSegmentation:       false,
      minDetectionConfidence: 0.55,
      minTrackingConfidence:   0.55,
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
setTimeout(() => {
  analysisActive = true;
  UI.setStatus("LIVE", true);
  startTimer();
}, 1500);
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

  function onPoseResults(results) {
    if (!analysisActive) return;

    const canvas = document.getElementById("poseCanvas");
    const ctx    = canvas.getContext("2d");

    if (results.image) {
      canvas.width  = results.image.width  || canvas.width;
      canvas.height = results.image.height || canvas.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.poseLandmarks) {
      handleNoPose();
      return;
    }

    if (!poseDetected) {
      poseDetected = true;
      clearTimeout(noPoseTimer);
      noPoseTimer = null;
      UI.showNoPose(false);
    }

    const lms = results.poseLandmarks;

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

    const leftAnkleVis  = lms[27].visibility || 0;
    const rightAnkleVis = lms[28].visibility || 0;
    const leftKneeVis   = lms[25].visibility || 0;
    const rightKneeVis  = lms[26].visibility || 0;
    const lowerBodyVis  = (leftAnkleVis + rightAnkleVis + leftKneeVis + rightKneeVis) / 4;

    const needsFullBody = ["squat", "lunge", "deadlift", "shoulder-press", "lateral-raise", "jumping-jack", "burpee", "mountain-climber", "glute-bridge"];
    if (needsFullBody.includes(selectedExercise.id) && lowerBodyVis < 0.4) {
      UI.updateCueBox("Step back — full body needs to be visible", 0, "warn");
      return;
    }

    const result = PoseAnalyzer.analyze(selectedExercise.analyzerKey, lms);

    UI.updateScoreCircle(result.score);
    UI.updateMetrics(result.metrics);

    if (result.repSignal) {
      repCount++;
      UI.updateRepCircle(repCount);
      VoiceCoach.announceRep(repCount);
    }

    const now = Date.now();
    if (now - lastFeedbackTime >= FEEDBACK_INTERVAL) {
      lastFeedbackTime = now;
      fetchAndDeliverFeedback(result);
    }
  }

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

  async function fetchAndDeliverFeedback(analysisResult) {
    if (!analysisActive) return;
    if (timerSeconds < 3) return;

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

      if (cue === lastSpokenCue) return;
      lastSpokenCue = cue;

      UI.updateCueBox(cue, analysisResult.score, level);
      UI.showLiveCue(cue, level);
      UI.addLogEntry(cue, level);

      VoiceCoach.sayCoachingCue(cue, level === "bad");

    } catch (err) {
      console.error("[App] Feedback error:", err);
    }
  }

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

  function toggleVoice() {
    const isNowEnabled = VoiceCoach.toggle();
    UI.setVoiceButtonState(isNowEnabled);
  }

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

document.addEventListener("DOMContentLoaded", () => window.App.init());