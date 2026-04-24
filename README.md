# FORM — AI Personal Trainer

A real-time AI-powered personal trainer that watches you exercise through your webcam, analyzes your body position frame by frame, and **talks to you** with live coaching cues

Built with MediaPipe for pose detection, the OpenAI API for natural coaching language, and the Web Speech API to actually speak the feedback out loud.

---

## What it does

You open the app, pick an exercise from the list, and start moving. The app opens your camera, draws a skeleton overlay on your body in real time, and starts analyzing your form. Every few seconds it sends your current position data to the backend, gets a coaching cue back from GPT, and reads it out loud through your speakers. Things like:

- *"Drive your knees out don't let them collapse inward."*
- *"Hips are dropping squeeze your glutes and pull them up."*
- *"Perfect. Stay tight and keep going."*

You also get a live form score on screen, per-body-part breakdowns (head, spine, hips, core), a rep counter that tracks automatically, a session timer, and a coaching log of everything said during the session.

---

## Exercises

12 exercises across beginner, intermediate, and advanced:

Plank · Squat · Push-Up · Lunge · Deadlift · Shoulder Press · Glute Bridge · Mountain Climber · Jumping Jack · Burpee · Lateral Raise · Bicycle Crunch

If you would like any other exercise, just message me and I will add it.
---

## Tech stack

| Layer | Technology |
|---|---|
| Pose tracking | MediaPipe Pose (runs in the browser via WebAssembly) |
| Voice coaching | Web Speech API (native browser, no dependency) |
| AI coaching language | OpenAI GPT-4o-mini |
| Backend | Node.js + Express |
| Frontend | Vanilla HTML, CSS, JavaScript — no framework, no build step |
| Security | Helmet, CORS, express-rate-limit |


## How it works

### Pose detection (client-side)

MediaPipe Pose runs entirely in the browser using WebAssembly. It processes each video frame and returns 33 body landmarks — every major joint — with x, y, z coordinates normalized between 0 and 1. No video data ever leaves the device for pose tracking. 

### Biomechanical analysis

`pose-analyzer.js` takes those 33 landmarks every frame and calculates the relevant joint angles using the dot product formula, then scores them against ideal ranges. A squat analyzer checks the knee angle (target 90 at depth), torso lean, and knee tracking. Each zone gets its own 0–100 score which feeds into an overall form score.

### Rep counting

Each analyzer uses a phase state machine. For example, squats: it tracks when the knee angle drops below 115 (down phase) and rises back above 162 (up phase). When that transition happens, that's one rep. Each exercise has its own thresholds tuned to what makes sense biomechanically.

### AI coaching

Every 5 seconds, the app sends the current form data to the backend: exercise name, scores, detected issues, rep count, session time. The backend calls GPT asking for a single cue of no more than 15 words, written to sound like a real trainer. The cue is displayed on screen, shown as a banner on the video, and spoken aloud.

### Voice coaching

`voice.js` wraps the Web Speech API. It picks the best available voice, manages a cue queue so nothing overlaps, and adjusts delivery speed based on urgency