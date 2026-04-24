/**
 * api.js
 * Handles all communication with the FORM Trainer backend API.
 * Falls back to local rule-based cues if the server is unreachable.
 */

window.TrainerAPI = (() => {
  // ─── Config ───────────────────────────────────────────────────────────────
  // Change this to your deployed backend URL in production
  const BASE_URL = null;

  let serverAvailable = true;   // set to false after first failed health check
  let lastCheckTime   = 0;
  const CHECK_INTERVAL = 30000; // re-check server every 30s

  // ─── Health Check ─────────────────────────────────────────────────────────
  async function checkHealth() {
  serverAvailable = false;
  return false;
}

  // ─── Get Feedback ─────────────────────────────────────────────────────────
  /**
   * Fetch an AI coaching cue from the backend.
   *
   * @param {object} payload
   * @param {string}   payload.exercise        — exercise ID (e.g. "squat")
   * @param {number}   payload.score           — overall form score 0–100
   * @param {object}   payload.metrics         — { head, spine, hips, core }
   * @param {string[]} payload.issues          — array of raw issue keys
   * @param {number}   [payload.reps]          — rep count so far
   * @param {number}   [payload.sessionSeconds]— seconds elapsed
   *
   * @returns {Promise<{ cue: string, score: number, level: string, fallback: boolean }>}
   */
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

  // ─── Local Fallback Cues ──────────────────────────────────────────────────
  /**
   * Rule-based fallback — used when the backend is unavailable.
   * Maps issue keys to human cues.
   */
  const CUE_MAP = {
    // Plank
    "cues.hips_low":   "Hips are dropping — squeeze your glutes and pull them up.",
    "cues.hips_high":  "Hips are too high — lower them to form a straight line.",
    "cues.head_up":    "Head down — look at the floor, not forward.",
    // Squat
    "cues.depth":      "Go deeper — get your thighs parallel to the ground.",
    "cues.knee_cave":  "Drive your knees out — don't let them collapse inward.",
    "cues.chest":      "Chest up — don't lean forward, stay tall.",
    // Push-Up
    "cues.hips":       "Brace your core — keep your body in a straight line.",
    "cues.elbows":     "Tuck your elbows — 45 degrees, not flared wide.",
    // Lunge
    "cues.knee_over":  "Step wider — knee should stay over your ankle.",
    "cues.torso_lean": "Torso is leaning — keep your back straight.",
    // Deadlift
    "cues.round_back": "Don't round your back — chest proud, neutral spine.",
    "cues.hips_high":  "Hips and chest rise together — don't shoot your hips up.",
    "cues.head":       "Neutral neck — don't crane your head up or down.",
    // Shoulder Press
    "cues.arch":       "Stop arching your back — brace that core.",
    "cues.lockout":    "Fully extend — press all the way to the top.",
    // Glute Bridge
    "cues.height":     "Drive your hips higher — squeeze those glutes.",
    "cues.squeeze":    "Hold at the top — really squeeze your glutes.",
    "cues.feet":       "Push through your heels, not your toes.",
    // Mountain Climber
    "cues.hips_up":    "Hips are rising — keep your core flat and tight.",
    // Jumping Jack
    "cues.arms":       "Raise your arms fully — all the way overhead.",
    "cues.land":       "Land softly on the balls of your feet.",
    // Lateral Raise
    "cues.swing":      "Stop swinging — slow it down and control the lift.",
    // Bicycle Crunch
    "cues.range":      "Extend that leg fully — full range of motion.",
    "cues.slow":       "Slow down — control beats speed every time.",
    // Generic good
    "cues.good":       "Great form. Stay tight and keep going.",
  };

  const GOOD_CUES = [
    "Perfect. Keep that form locked in.",
    "Solid. Stay tight and keep going.",
    "That's exactly right. Keep it up.",
    "Excellent form. Don't let it slip.",
  ];

  function _localFallback({ score, issues }) {
    let cue;

    if (score >= 80 || issues.length === 0) {
      cue = GOOD_CUES[Math.floor(Math.random() * GOOD_CUES.length)];
    } else {
      // Resolve first issue key to its cue text
      const firstKey = issues[0];
      cue = CUE_MAP[firstKey] || "Focus on your alignment and keep pushing.";
    }

    const level = score >= 75 ? "good" : score >= 50 ? "warn" : "bad";
    return { cue, score, level, fallback: true };
  }

  // ─── Public ───────────────────────────────────────────────────────────────
  return {
    getFeedback,
    checkHealth,
    setBaseUrl(url) { BASE_URL = url; },
    isServerAvailable() { return serverAvailable; },
  };
})();
