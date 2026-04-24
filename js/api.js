window.TrainerAPI = (() => {
  const BASE_URL = null;

  let serverAvailable = true;
  let lastCheckTime = 0;
  const CHECK_INTERVAL = 30000;

  async function checkHealth() {
    serverAvailable = false;
    return false;
  }

  async function getFeedback(payload) {
    const isAvailable = await checkHealth();

    if (!isAvailable) {
      return _localFallback(payload);
    }

    try {
      const res = await fetch(`${BASE_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      return data;

    } catch (err) {
      console.warn("[TrainerAPI] Fetch failed, using local fallback:", err.message);
      serverAvailable = false;
      return _localFallback(payload);
    }
  }

  const CUE_MAP = {
    "cues.hips_low": "Hips are dropping — squeeze your glutes and pull them up.",
    "cues.hips_high": "Hips are too high — lower them to form a straight line.",
    "cues.head_up": "Head down — look at the floor, not forward.",
    "cues.depth": "Go deeper — get your thighs parallel to the ground.",
    "cues.knee_cave": "Drive your knees out — don't let them collapse inward.",
    "cues.chest": "Chest up — don't lean forward, stay tall.",
    "cues.hips": "Brace your core — keep your body in a straight line.",
    "cues.elbows": "Tuck your elbows — 45 degrees, not flared wide.",
    "cues.knee_over": "Step wider — knee should stay over your ankle.",
    "cues.torso_lean": "Torso is leaning — keep your back straight.",
    "cues.round_back": "Don't round your back — chest proud, neutral spine.",
    "cues.hips_high": "Hips and chest rise together — don't shoot your hips up.",
    "cues.head": "Neutral neck — don't crane your head up or down.",
    "cues.arch": "Stop arching your back — brace that core.",
    "cues.lockout": "Fully extend — press all the way to the top.",
    "cues.height": "Drive your hips higher — squeeze those glutes.",
    "cues.squeeze": "Hold at the top — really squeeze your glutes.",
    "cues.feet": "Push through your heels, not your toes.",
    "cues.hips_up": "Hips are rising — keep your core flat and tight.",
    "cues.arms": "Raise your arms fully — all the way overhead.",
    "cues.land": "Land softly on the balls of your feet.",
    "cues.swing": "Stop swinging — slow it down and control the lift.",
    "cues.range": "Extend that leg fully — full range of motion.",
    "cues.slow": "Slow down — control beats speed every time.",
    "cues.good": "Great form. Stay tight and keep going.",
  };

  const GOOD_CUES = [
    "Perfect. Keep that form locked in.",
    "Solid. Stay tight and keep going.",
    "That's exactly right. Keep it up.",
    "Excellent form. Don't let it slip.",
  ];

  let lastGoodCueIndex = -1;

function _localFallback({ score, issues }) {
  const level = score >= 75 ? "good" : score >= 50 ? "warn" : "bad";
  let cue;

  if (issues.length > 0) {
    cue = CUE_MAP[issues[0]] || "Fix your alignment and keep going.";
  } else if (score >= 75) {
    // Rotate through good cues, never repeat the same one twice
    let idx;
    do { idx = Math.floor(Math.random() * GOOD_CUES.length); }
    while (idx === lastGoodCueIndex && GOOD_CUES.length > 1);
    lastGoodCueIndex = idx;
    cue = GOOD_CUES[idx];
  } else {
    cue = "Keep going — stay focused and tight.";
  }

  return { cue, score, level, fallback: true };
}

  return {
    getFeedback,
    checkHealth,
    setBaseUrl(url) { BASE_URL = url; },
    isServerAvailable() { return serverAvailable; },
  };
})();