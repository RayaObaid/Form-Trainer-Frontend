function getAngle(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.sqrt(ab.x**2 + ab.y**2) * Math.sqrt(cb.x**2 + cb.y**2);
  if (mag === 0) return 0;
  return Math.acos(Math.min(1, Math.max(-1, dot / mag))) * (180 / Math.PI);
}
function clamp(v) { return Math.min(100, Math.max(0, Math.round(v))); }
function lm(lms, i) { return lms[i]; }
function mid(a, b) { return { x:(a.x+b.x)/2, y:(a.y+b.y)/2, z:((a.z||0)+(b.z||0))/2 }; }
function proximityScore(value, target, tolerance) {
  return clamp(100 - (Math.abs(value - target) / tolerance) * 100);
}

const _repState = {};
function getRepState(id) {
  if (!_repState[id]) _repState[id] = { phase: "neutral", count: 0 };
  return _repState[id];
}
function resetRepState(id) { delete _repState[id]; }

const Analyzers = {

  plank(lms) {
    const nose = lm(lms,0);
    const midSh  = mid(lm(lms,11), lm(lms,12));
    const midHip = mid(lm(lms,23), lm(lms,24));
    const midAnk = mid(lm(lms,27), lm(lms,28));
    const bodyAngle   = getAngle(midSh, midHip, midAnk);
    const expectedHipY = (midSh.y + midAnk.y) / 2;
    const hipDev      = (midHip.y - expectedHipY) * 200;
    const headDev     = Math.abs(nose.y - midSh.y) * 150;
    const bodyScore   = proximityScore(bodyAngle, 180, 25);
    const hipScore    = clamp(100 - Math.abs(hipDev) * 3);
    const headScore   = clamp(100 - headDev * 1.5);
    const coreScore   = clamp((bodyScore + hipScore) / 2);
    const overall     = clamp(bodyScore*0.4 + hipScore*0.35 + headScore*0.15 + coreScore*0.1);
    const issues = [];
    if (hipScore < 65) issues.push(hipDev > 0 ? "cues.hips_low" : "cues.hips_high");
    if (headScore < 65) issues.push("cues.head_up");
    return { score:overall, metrics:{head:headScore,spine:bodyScore,hips:hipScore,core:coreScore}, issues, isGood:overall>=72, repSignal:false };
  },

  squat(lms) {
    const midSh  = mid(lm(lms,11), lm(lms,12));
    const lHip=lm(lms,23), rHip=lm(lms,24);
    const lKn=lm(lms,25),  rKn=lm(lms,26);
    const lAnk=lm(lms,27), rAnk=lm(lms,28);
    const midHip = mid(lHip, rHip);
    const avgKnee = (getAngle(lHip,lKn,lAnk) + getAngle(rHip,rKn,rAnk)) / 2;
    const torsoLean = Math.abs(midSh.x - midHip.x) * 150;
    const lCave = (lKn.x - lAnk.x) * 100;
    const rCave = (rAnk.x - rKn.x) * 100;
    const kneeCave = Math.max(0, (lCave + rCave) / 2);
    const depthScore = avgKnee < 100 ? 100 : avgKnee < 120 ? 95 : clamp(100-(avgKnee-120)*2.2);
    const torsoScore = clamp(100 - torsoLean*1.5);
    const kneeScore  = clamp(100 - kneeCave*2);
    const coreScore  = clamp((torsoScore+kneeScore)/2);
    const overall    = clamp(depthScore*0.35 + torsoScore*0.3 + kneeScore*0.25 + coreScore*0.1);
    const state = getRepState("squat"); let repSignal = false;
    if (avgKnee < 115) state.phase = "down";
    if (state.phase==="down" && avgKnee > 162) { state.phase="up"; state.count++; repSignal=true; }
    const issues = [];
    if (depthScore < 60) issues.push("cues.depth");
    if (kneeScore < 65)  issues.push("cues.knee_cave");
    if (torsoScore < 65) issues.push("cues.chest");
    return { score:overall, metrics:{head:80,spine:torsoScore,hips:depthScore,core:coreScore}, issues, isGood:overall>=72, repSignal };
  },

  pushup(lms) {
    const lSh=lm(lms,11), rSh=lm(lms,12);
    const lEl=lm(lms,13), rEl=lm(lms,14);
    const lWr=lm(lms,15), rWr=lm(lms,16);
    const midSh=mid(lSh,rSh), midHip=mid(lm(lms,23),lm(lms,24)), midAnk=mid(lm(lms,27),lm(lms,28));
    const avgElbow = (getAngle(lSh,lEl,lWr) + getAngle(rSh,rEl,rWr)) / 2;
    const bodyAngle = getAngle(midSh,midHip,midAnk);
    const hipDev = (midHip.y - ((midSh.y+midAnk.y)/2)) * 200;
    const elbowScore = avgElbow>150 ? clamp(100-(170-avgElbow)*2) : proximityScore(avgElbow,90,35);
    const bodyScore  = proximityScore(bodyAngle,180,22);
    const hipScore   = clamp(100 - Math.abs(hipDev)*2.5);
    const overall    = clamp(elbowScore*0.3 + bodyScore*0.45 + hipScore*0.25);
    const state = getRepState("pushup"); let repSignal = false;
    if (avgElbow < 105) state.phase = "down";
    if (state.phase==="down" && avgElbow > 155) { state.phase="up"; state.count++; repSignal=true; }
    const issues = [];
    if (hipScore < 65) issues.push("cues.hips");
    if (elbowScore < 55 && avgElbow > 130) issues.push("cues.depth");
    return { score:overall, metrics:{head:78,spine:bodyScore,hips:hipScore,core:elbowScore}, issues, isGood:overall>=72, repSignal };
  },

  lunge(lms) {
    const lSh=lm(lms,11), rSh=lm(lms,12);
    const lHip=lm(lms,23), rHip=lm(lms,24);
    const lKn=lm(lms,25),  rKn=lm(lms,26);
    const lAnk=lm(lms,27), rAnk=lm(lms,28);
    const midSh=mid(lSh,rSh), midHip=mid(lHip,rHip);
    const frontKnee = Math.min(getAngle(lHip,lKn,lAnk), getAngle(rHip,rKn,rAnk));
    const torsoLean = Math.abs(midSh.x - midHip.x) * 120;
    const hipLevel  = Math.abs(lHip.y - rHip.y) * 120;
    const kneeScore  = proximityScore(frontKnee, 90, 35);
    const torsoScore = clamp(100 - torsoLean*1.4);
    const hipScore   = clamp(100 - hipLevel*1.5);
    const overall    = clamp(kneeScore*0.4 + torsoScore*0.35 + hipScore*0.25);
    const state = getRepState("lunge"); let repSignal = false;
    if (frontKnee < 115) state.phase = "down";
    if (state.phase==="down" && frontKnee > 160) { state.phase="up"; state.count++; repSignal=true; }
    const issues = [];
    if (kneeScore < 60)  issues.push("cues.knee_over");
    if (torsoScore < 65) issues.push("cues.torso_lean");
    return { score:overall, metrics:{head:80,spine:torsoScore,hips:hipScore,core:kneeScore}, issues, isGood:overall>=72, repSignal };
  },

  deadlift(lms) {
    const nose=lm(lms,0);
    const midSh=mid(lm(lms,11),lm(lms,12)), midHip=mid(lm(lms,23),lm(lms,24));
    const midKn=mid(lm(lms,25),lm(lms,26)), midAnk=mid(lm(lms,27),lm(lms,28));
    const spineAngle = getAngle(midSh,midHip,midAnk);
    const hipHinge   = getAngle(midSh,midHip,midKn);
    const headDev    = Math.abs(nose.y - midSh.y) * 120;
    const spineScore = proximityScore(spineAngle,175,20);
    const hipScore   = clamp(hipHinge>100 ? 100-(hipHinge-160)*1.5 : 60);
    const headScore  = clamp(100 - headDev*1.2);
    const coreScore  = clamp((spineScore+hipScore)/2);
    const overall    = clamp(spineScore*0.45+hipScore*0.3+headScore*0.15+coreScore*0.1);
    const state = getRepState("deadlift"); let repSignal = false;
    if (spineAngle < 140) state.phase = "down";
    if (state.phase==="down" && spineAngle > 170) { state.phase="up"; state.count++; repSignal=true; }
    const issues = [];
    if (spineScore < 60) issues.push("cues.round_back");
    if (hipScore < 60)   issues.push("cues.hips_high");
    if (headScore < 65)  issues.push("cues.head");
    return { score:overall, metrics:{head:headScore,spine:spineScore,hips:hipScore,core:coreScore}, issues, isGood:overall>=72, repSignal };
  },

  shoulderpress(lms) {
    const nose=lm(lms,0);
    const lSh=lm(lms,11), rSh=lm(lms,12);
    const lEl=lm(lms,13), rEl=lm(lms,14);
    const lWr=lm(lms,15), rWr=lm(lms,16);
    const midSh=mid(lSh,rSh), midHip=mid(lm(lms,23),lm(lms,24));
    const avgAng = (getAngle(lSh,lEl,lWr) + getAngle(rSh,rEl,rWr)) / 2;
    const backArch = Math.abs(midSh.x - midHip.x) * 120;
    const headFwd  = Math.abs(nose.x - midSh.x) * 100;
    const armScore  = avgAng>150 ? clamp(100-(170-avgAng)*1.5) : clamp(avgAng*0.7);
    const coreScore = clamp(100 - backArch*1.8);
    const headScore = clamp(100 - headFwd*1.5);
    const overall   = clamp(armScore*0.45+coreScore*0.35+headScore*0.2);
    const state = getRepState("shoulderpress"); let repSignal = false;
    if (avgAng < 105) state.phase = "down";
    if (state.phase==="down" && avgAng > 155) { state.phase="up"; state.count++; repSignal=true; }
    const issues = [];
    if (coreScore < 65) issues.push("cues.arch");
    if (armScore < 65 && avgAng > 110) issues.push("cues.lockout");
    if (headScore < 65) issues.push("cues.head");
    return { score:overall, metrics:{head:headScore,spine:coreScore,hips:80,core:coreScore}, issues, isGood:overall>=72, repSignal };
  },

  glutebridge(lms) {
    const midSh=mid(lm(lms,11),lm(lms,12)), midHip=mid(lm(lms,23),lm(lms,24));
    const midKn=mid(lm(lms,25),lm(lms,26));
    const lHip=lm(lms,23), rHip=lm(lms,24);
    const hipRaise     = (midSh.y - midHip.y) * 200;
    const hipSymmetry = clamp(100 - Math.abs(lHip.y - rHip.y)*200);
    const heightScore = hipRaise>15 ? 100 : hipRaise>5 ? clamp(60+hipRaise*2.6) : clamp(50+hipRaise*2);
    const overall     = clamp(heightScore*0.65 + hipSymmetry*0.35);
    const state = getRepState("glutebridge"); let repSignal = false;
    if (hipRaise < 5) state.phase = "down";
    if (state.phase==="down" && hipRaise > 12) { state.phase="up"; state.count++; repSignal=true; }
    const issues = [];
    if (heightScore < 65) issues.push("cues.height");
    if (hipSymmetry < 65) issues.push("cues.squeeze");
    return { score:overall, metrics:{head:80,spine:hipSymmetry,hips:heightScore,core:hipSymmetry}, issues, isGood:overall>=70, repSignal };
  },

  mountainclimber(lms) {
    const midSh=mid(lm(lms,11),lm(lms,12)), midHip=mid(lm(lms,23),lm(lms,24)), midAnk=mid(lm(lms,27),lm(lms,28));
    const bodyAngle    = getAngle(midSh,midHip,midAnk);
    const expectedHipY = (midSh.y+midAnk.y)/2;
    const hipDev       = (midHip.y - expectedHipY)*200;
    const bodyScore    = proximityScore(bodyAngle,180,25);
    const hipScore     = clamp(100 - Math.abs(hipDev)*2.5);
    const overall      = clamp(bodyScore*0.55 + hipScore*0.45);
    const issues = [];
    if (hipScore < 60) issues.push("cues.hips_up");
    return { score:overall, metrics:{head:78,spine:bodyScore,hips:hipScore,core:bodyScore}, issues, isGood:overall>=68, repSignal:false };
  },

  jumpingjack(lms) {
    const lSh=lm(lms,11), rSh=lm(lms,12);
    const lEl=lm(lms,13), rEl=lm(lms,14);
    const lWr=lm(lms,15), rWr=lm(lms,16);
    const lAnk=lm(lms,27), rAnk=lm(lms,28);
    const lHip=lm(lms,23), rHip=lm(lms,24);

    const midSh  = mid(lSh,rSh);
    const midWr  = mid(lWr,rWr);
    const hipWidth = Math.max(Math.abs(lHip.x - rHip.x), 0.08);

    const wristAboveShoulder = midSh.y - midWr.y;
    const armSpread = Math.abs(lWr.x - rWr.x);
    const legSpread = Math.abs(lAnk.x - rAnk.x);

    let armScore;
    if (wristAboveShoulder > 0.18)      armScore = clamp(85 + armSpread*30);
    else if (wristAboveShoulder > 0.05) armScore = clamp(60 + (wristAboveShoulder-0.05)*400 + armSpread*20);
    else                                 armScore = clamp(20 + Math.max(0,wristAboveShoulder)*200 + armSpread*15);

    const normLeg  = legSpread / hipWidth;
    const legScore = normLeg>1.8 ? 100 : normLeg>1.2 ? clamp(60+(normLeg-1.2)*65) : clamp(normLeg*50);

    const overall = clamp(armScore*0.55 + legScore*0.45);

    const state = getRepState("jumpingjack"); let repSignal = false;
    if (wristAboveShoulder > 0.05 && legScore > 55) state.phase = "out";
    if (state.phase==="out" && wristAboveShoulder < 0 && legScore < 40) {
      state.phase="in"; state.count++; repSignal=true;
    }
    const issues = [];
    if (armScore < 65) issues.push("cues.arms");
    if (legScore < 55) issues.push("cues.land");
    return { score:overall, metrics:{head:80,spine:80,hips:legScore,core:armScore}, issues, isGood:overall>=68, repSignal };
  },

  burpee(lms) {
    const midSh=mid(lm(lms,11),lm(lms,12)), midHip=mid(lm(lms,23),lm(lms,24)), midAnk=mid(lm(lms,27),lm(lms,28));
    const bodyAngle = getAngle(midSh,midHip,midAnk);
    const hipDev    = (midHip.y - ((midSh.y+midAnk.y)/2))*200;
    const bodyScore = proximityScore(bodyAngle,180,25);
    const hipScore  = clamp(100 - Math.abs(hipDev)*2.5);
    const overall   = clamp(bodyScore*0.7 + hipScore*0.3);
    const issues = [];
    if (hipScore < 60) issues.push("cues.hips");
    return { score:overall, metrics:{head:78,spine:bodyScore,hips:hipScore,core:bodyScore}, issues, isGood:overall>=65, repSignal:false };
  },

  lateralraise(lms) {
    const lSh=lm(lms,11), rSh=lm(lms,12);
    const lEl=lm(lms,13), rEl=lm(lms,14);
    const midSh=mid(lSh,rSh), midEl=mid(lEl,rEl);
    const midHip=mid(lm(lms,23),lm(lms,24));
    const elbowRelToShoulder = midSh.y - midEl.y;
    const heightScore = elbowRelToShoulder > -0.02
      ? clamp(85 + elbowRelToShoulder*100)
      : clamp(85 + elbowRelToShoulder*200);
    const symm      = clamp(100 - Math.abs(lEl.y - rEl.y)*250);
    const sway      = Math.abs(midSh.x - midHip.x)*120;
    const swayScore = clamp(100 - sway*1.5);
    const overall   = clamp(heightScore*0.5 + symm*0.3 + swayScore*0.2);
    const state = getRepState("lateralraise"); let repSignal = false;
    if (elbowRelToShoulder < -0.1) state.phase = "down";
    if (state.phase==="down" && elbowRelToShoulder > -0.03) { state.phase="up"; state.count++; repSignal=true; }
    const issues = [];
    if (heightScore < 65) issues.push("cues.height");
    if (sway > 20)         issues.push("cues.swing");
    return { score:overall, metrics:{head:82,spine:swayScore,hips:80,core:swayScore}, issues, isGood:overall>=70, repSignal };
  },

  bicyclecrunch(lms) {
    const lSh=lm(lms,11), rSh=lm(lms,12);
    const lEl=lm(lms,13), rEl=lm(lms,14);
    const lKn=lm(lms,25), rKn=lm(lms,26);
    const midSh=mid(lSh,rSh), midHip=mid(lm(lms,23),lm(lms,24));
    const elbowRot  = Math.abs(lEl.x - rEl.x)*180;
    const kneeSprd  = Math.abs(lKn.x - rKn.x)*150;
    const shLift    = (midHip.y - midSh.y)*150;
    const rotScore  = clamp(elbowRot*1.2);
    const legScore  = clamp(kneeSprd*1.2);
    const liftScore = shLift>5 ? 100 : clamp(50+shLift*5);
    const overall   = clamp(rotScore*0.4 + legScore*0.35 + liftScore*0.25);
    const issues = [];
    if (legScore < 55)  issues.push("cues.range");
    if (rotScore < 55)  issues.push("cues.slow");
    return { score:overall, metrics:{head:72,spine:liftScore,hips:legScore,core:rotScore}, issues, isGood:overall>=65, repSignal:false };
  },
};

window.PoseAnalyzer = {
  analyze(analyzerKey, landmarks) {
    const fn = Analyzers[analyzerKey];
    if (!fn) {
      console.warn(`[PoseAnalyzer] No analyzer for: "${analyzerKey}"`);
      return { score:50, metrics:{head:50,spine:50,hips:50,core:50}, issues:[], isGood:false, repSignal:false };
    }
    try {
      return fn(landmarks);
    } catch(err) {
      console.error(`[PoseAnalyzer] Error in "${analyzerKey}":`, err);
      return { score:50, metrics:{head:50,spine:50,hips:50,core:50}, issues:[], isGood:false, repSignal:false };
    }
  },
  resetReps(analyzerKey) { resetRepState(analyzerKey); },
  getHelpers() { return { getAngle, clamp, lm, mid, proximityScore }; },
};