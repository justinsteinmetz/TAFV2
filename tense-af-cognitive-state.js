// ═══════════════════════════════════════════════════════════════
// TENSE AF — COGNITIVE STATE
// 
// The single source of truth. Every other layer SUBSCRIBES.
// No layer triggers another layer directly.
// 
// State shape:
//   decisionTime  — ms from prompt shown → touch down (hesitation signal)
//   commitType    — 'tap' or 'hold'
//   choice        — which option they chose ('A', 'B', 'C', 'D' or the value)
//   alignment     — 'aligned' / 'misaligned' (set AFTER reveal)
//   phase         — 'entry' | 'stability' | 'pressure' | 'release'
//   
// Derived (continuous):
//   hesitation    — rolling average of decisionTime (normalised 0-1)
//   confidence    — rolling average of fast+aligned answers (0-1)
//   instability   — rolling count of slow answers + misalignments (0-1)
// ═══════════════════════════════════════════════════════════════

class CognitiveState {
  constructor() {
    // Current question state
    this.decisionTime = null;
    this.commitType = null;
    this.choice = null;
    this.alignment = null;  // null until reveal evaluated
    
    // Session-level running state
    this.phase = 'entry';
    this.questionCount = 0;
    this.recentDecisionTimes = [];  // last 5
    this.recentAlignments = [];     // last 5
    
    // Derived cognitive values (0-1, smoothed)
    this.hesitation = 0;
    this.confidence = 0.4;  // start warm — not cold
    this.instability = 0;
    
    // Subscribers
    this.listeners = [];
  }

  // ─────────────────────────────────────
  // SUBSCRIPTION
  // Any layer can subscribe. Called on every change.
  // ─────────────────────────────────────
  subscribe(fn) {
    this.listeners.push(fn);
  }

  _notify(event) {
    this.listeners.forEach(fn => {
      try { fn(event, this); } catch (e) { console.error('subscriber error', e); }
    });
  }

  // ─────────────────────────────────────
  // WRITES — called from input + content layers
  // ─────────────────────────────────────

  beginPrompt() {
    this.decisionTime = null;
    this.commitType = null;
    this.choice = null;
    this.alignment = null;
    this._notify('prompt-begin');
  }

  commitChoice({ decisionTime, commitType, choice }) {
    this.decisionTime = decisionTime;
    this.commitType = commitType;
    this.choice = choice;
    this._updateDerived();
    this._notify('commit');
  }

  setAlignment(alignment) {
    this.alignment = alignment;  // 'aligned' | 'misaligned'
    this.recentAlignments.push(alignment);
    if (this.recentAlignments.length > 5) this.recentAlignments.shift();
    this._updateDerived();
    this.questionCount++;
    this._updatePhase();
    this._notify('reveal');
  }

  // ─────────────────────────────────────
  // DERIVED VALUES — smoothed, normalised
  // ─────────────────────────────────────
  _updateDerived() {
    // Track recent decision times
    if (this.decisionTime !== null) {
      this.recentDecisionTimes.push(this.decisionTime);
      if (this.recentDecisionTimes.length > 5) this.recentDecisionTimes.shift();
    }

    // HESITATION: normalised avg decision time (0ms = 0, 3000ms+ = 1)
    if (this.recentDecisionTimes.length > 0) {
      const avg = this.recentDecisionTimes.reduce((a,b)=>a+b,0) / this.recentDecisionTimes.length;
      const target = Math.min(1, Math.max(0, (avg - 400) / 2600));
      // Smooth toward target (lerp)
      this.hesitation += (target - this.hesitation) * 0.4;
    }

    // CONFIDENCE: recent aligned + fast
    if (this.recentAlignments.length > 0) {
      const alignedRatio = this.recentAlignments.filter(a => a === 'aligned').length / this.recentAlignments.length;
      // Fast = under 1200ms on avg
      const avgDT = this.recentDecisionTimes.length 
        ? this.recentDecisionTimes.reduce((a,b)=>a+b,0) / this.recentDecisionTimes.length 
        : 1500;
      const fastBonus = avgDT < 1200 ? 0.2 : 0;
      const target = Math.min(1, alignedRatio + fastBonus);
      this.confidence += (target - this.confidence) * 0.3;
    }

    // INSTABILITY: misalignments + slow decisions
    if (this.recentAlignments.length > 0) {
      const misalignedRatio = this.recentAlignments.filter(a => a === 'misaligned').length / this.recentAlignments.length;
      const slowBonus = this.hesitation > 0.6 ? 0.2 : 0;
      const target = Math.min(1, misalignedRatio + slowBonus);
      this.instability += (target - this.instability) * 0.35;
    }
  }

  // ─────────────────────────────────────
  // PHASE PROGRESSION — the session arc
  // ─────────────────────────────────────
  _updatePhase() {
    const q = this.questionCount;
    if (q <= 3) this.phase = 'entry';
    else if (q <= 6) this.phase = 'stability';
    else if (q <= 11) this.phase = 'pressure';
    else this.phase = 'release';
  }

  reset() {
    this.decisionTime = null;
    this.commitType = null;
    this.choice = null;
    this.alignment = null;
    this.phase = 'entry';
    this.questionCount = 0;
    this.recentDecisionTimes = [];
    this.recentAlignments = [];
    this.hesitation = 0;
    this.confidence = 0.4;
    this.instability = 0;
    this._notify('reset');
  }
}

const cognitiveState = new CognitiveState();
