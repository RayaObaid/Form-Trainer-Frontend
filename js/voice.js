window.VoiceCoach = (() => {
  let enabled     = true;
  let speaking    = false;
  let lastSpoken  = 0;
  let cooldownMs  = 2000;
  let voice       = null;
  const queue     = [];

  function loadVoices() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;

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

    if (!voice) {
      voice = voices.find(v => v.lang.startsWith("en")) || voices[0];
    }
  }

  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();

  function speak(text, opts = {}) {
  if (!enabled) return;
  if (!text || typeof text !== "string") return;

  // Always cancel what's playing and speak immediately
  window.speechSynthesis.cancel();
  queue.length = 0;
  speaking = false;

  _utterSpeak(text, opts);
}

  function _utterSpeak(text, opts = {}) {
    if (!("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);

    if (voice) utterance.voice = voice;

    utterance.rate   = opts.rate   ?? (opts.priority ? 1.05 : 0.95);
    utterance.pitch  = opts.pitch  ?? 1.0;
    utterance.volume = opts.volume ?? 1.0;
    utterance.lang   = "en-US";

    utterance.onstart = () => { speaking = true; };
    utterance.onend   = () => {
      speaking  = false;
      lastSpoken = Date.now();
      if (queue.length > 0) {
        const next = queue.shift();
        setTimeout(() => _utterSpeak(next.text, next.opts), 300);
      }
    };
    utterance.onerror  = () => { speaking = false; };

    lastSpoken = Date.now();
    window.speechSynthesis.speak(utterance);
  }

  function announceExercise(name) {
    speak(`Starting ${name}. Get into position.`, { rate: 0.9, volume: 1 });
  }

  function announceRep(count) {
    const milestones = { 5: "Five reps!", 10: "Ten!", 15: "Fifteen reps — keep going!", 20: "Twenty! Excellent work." };
    if (milestones[count]) speak(milestones[count], { rate: 1.05 });
  }

  function sayCoachingCue(cue, isUrgent = false) {
    if (!cue) return;
    const clean = cue.replace(/^["']|["']$/g, "").trim();
    speak(clean, { priority: isUrgent, rate: isUrgent ? 1.05 : 0.92 });
  }

  function sayGoodForm() {
    const affirmations = [
      "Perfect form. Keep it up.",
      "Looking great. Stay tight.",
      "That's it. Keep going.",
      "Excellent. Hold that position.",
    ];
    speak(affirmations[Math.floor(Math.random() * affirmations.length)]);
  }

  function sayGetInFrame() {
    speak("Step into frame.", { priority: true, rate: 0.95 });
  }

  function enable()  { enabled = true;  }
  function disable() { enabled = false; window.speechSynthesis.cancel(); queue.length = 0; }
  function toggle()  { enabled ? disable() : enable(); return enabled; }
  function isEnabled() { return enabled; }
  function setCooldown(ms) { cooldownMs = ms; }

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