/**
 * voice.js
 * Voice coaching engine using the Web Speech API (SpeechSynthesis).
 * Speaks coaching cues aloud so the user doesn't need to look at the screen.
 */

window.VoiceCoach = (() => {
  // ─── State ───────────────────────────────────────────────────────────────
  let enabled     = true;
  let speaking    = false;
  let lastSpoken  = 0;
  let cooldownMs  = 4000;       // minimum gap between spoken cues
  let voice       = null;       // preferred voice
  const queue     = [];         // pending cues

  // ─── Voice Selection ──────────────────────────────────────────────────────
  function loadVoices() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;

    // Priority list — pick the most natural-sounding available voice
    const preferred = [
      "Google US English",
      "Microsoft Aria Online (Natural) - English (United States)",
      "Microsoft Guy Online (Natural) - English (United States)",
      "Samantha",
      "Karen",
      "Daniel",
    ];

    for (const name of preferred) {
      const match = voices.find(v => v.name === name);
      if (match) { voice = match; break; }
    }

    // Fallback: first English voice
    if (!voice) {
      voice = voices.find(v => v.lang.startsWith("en")) || voices[0];
    }
  }

  // Voices load asynchronously in some browsers
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();

  // ─── Core Speak Function ───────────────────────────────────────────────────
  function speak(text, opts = {}) {
    if (!enabled) return;
    if (!text || typeof text !== "string") return;

    const now = Date.now();
    const gap = opts.priority ? 1500 : cooldownMs;

    // Cancel ongoing speech if this is a priority cue (bad form warning)
    if (opts.priority && speaking) {
      window.speechSynthesis.cancel();
      speaking = false;
    }

    if (now - lastSpoken < gap && !opts.priority) {
      // Not enough time has passed — queue it if it doesn't already match
      if (!queue.some(q => q.text === text)) {
        queue.push({ text, opts });
      }
      return;
    }

    _utterSpeak(text, opts);
  }

  function _utterSpeak(text, opts = {}) {
    if (!("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);

    if (voice) utterance.voice = voice;

    // Adjust delivery based on severity
    utterance.rate   = opts.rate   ?? (opts.priority ? 1.05 : 0.95);
    utterance.pitch  = opts.pitch  ?? 1.0;
    utterance.volume = opts.volume ?? 1.0;
    utterance.lang   = "en-US";

    utterance.onstart = () => { speaking = true; };
    utterance.onend   = () => {
      speaking  = false;
      lastSpoken = Date.now();
      // Process queue
      if (queue.length > 0) {
        const next = queue.shift();
        setTimeout(() => _utterSpeak(next.text, next.opts), 300);
      }
    };
    utterance.onerror  = () => { speaking = false; };

    lastSpoken = Date.now();
    window.speechSynthesis.speak(utterance);
  }

  // ─── Preset Cues ──────────────────────────────────────────────────────────

  /** Say the exercise name and a start cue when a session begins */
  function announceExercise(name) {
    speak(`Starting ${name}. Get into position.`, { rate: 0.9, volume: 1 });
  }

  /** Announce rep count milestone */
  function announceRep(count) {
    const milestones = { 5: "Five reps!", 10: "Ten!", 15: "Fifteen reps — keep going!", 20: "Twenty! Excellent work." };
    if (milestones[count]) speak(milestones[count], { rate: 1.05 });
  }

  /** Say a raw coaching cue from the AI or fallback */
  function sayCoachingCue(cue, isUrgent = false) {
    if (!cue) return;
    // Strip any leading/trailing quotes the model sometimes adds
    const clean = cue.replace(/^["']|["']$/g, "").trim();
    speak(clean, { priority: isUrgent, rate: isUrgent ? 1.05 : 0.92 });
  }

  /** Confirm good form */
  function sayGoodForm() {
    const affirmations = [
      "Perfect form. Keep it up.",
      "Looking great. Stay tight.",
      "That's it. Keep going.",
      "Excellent. Hold that position.",
    ];
    speak(affirmations[Math.floor(Math.random() * affirmations.length)]);
  }

  /** Alert when pose is lost */
  function sayGetInFrame() {
    speak("Step into frame.", { priority: true, rate: 0.95 });
  }

  // ─── Controls ─────────────────────────────────────────────────────────────

  function enable()  { enabled = true;  }
  function disable() { enabled = false; window.speechSynthesis.cancel(); queue.length = 0; }
  function toggle()  { enabled ? disable() : enable(); return enabled; }
  function isEnabled() { return enabled; }
  function setCooldown(ms) { cooldownMs = ms; }

  // ─── Public API ───────────────────────────────────────────────────────────
  return {
    speak,
    announceExercise,
    announceRep,
    sayCoachingCue,
    sayGoodForm,
    sayGetInFrame,
    enable,
    disable,
    toggle,
    isEnabled,
    setCooldown,
  };
})();
