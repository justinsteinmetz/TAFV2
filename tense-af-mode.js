// ═══════════════════════════════════════════════════════════════
// TENSE AF — MODE LAYER
// 
// Infers a single named "mode" from cognitive state. The groove
// then responds to modes instead of scattered state checks.
// 
// Modes (priority order — first match wins):
//   escalation     — high damage, system is compounding punishment
//   contradiction  — high instability, pocket fighting itself  
//   exposure       — peak confidence, everything visible, tight
//   meta           — high lift, higher-order thinking, chords unlocked
//   deadpan        — neutral state, nothing earned yet, stripped
//   pattern        — default mid-state, loop confidence
// ═══════════════════════════════════════════════════════════════

function inferMode(state, groove) {
  const damage = groove ? groove.damage : 0;
  const lift = groove ? groove.lift : 0;
  const alignedStreak = groove ? groove.alignedStreak : 0;
  
  // Priority order: failure states outrank reward states
  if (damage > 0.5) return 'escalation';
  if (state.instability > 0.55) return 'contradiction';
  if (lift > 0.7) return 'meta';
  if (state.confidence > 0.8 && state.instability < 0.2) return 'exposure';
  if (alignedStreak === 0 && state.confidence < 0.5) return 'deadpan';
  return 'pattern';
}

// Expose
if (typeof window !== 'undefined') {
  window.inferMode = inferMode;
}
