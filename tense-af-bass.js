// ═══════════════════════════════════════════════════════════════
// TENSE AF — BASS ENGINE v6 (Zapp / G-funk)
// 
// Sound signatures:
//   - Square wave core (hollow, woody body — not saw)
//   - Pulse Width Modulation via subtle LFO on a second square
//   - Unison detune (two squares, slight offset — wider, richer)
//   - Portamento between consecutive notes (slides, not jumps)
//   - Resonant lowpass (aggressive Q) for filter sweep character
//   - Quick release (clear edge, not muddy)
//   - No sub oscillator — G-funk bass is MID-forward, vocal
// 
// Patterns kept from v5 (syncopated).
// ═══════════════════════════════════════════════════════════════

class BassEngine {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.dest = destination;
    this.rootFreq = 55;   // A1
    this.mode = 'idle';
    
    this.virtuoso = 0;
    this.lift = 0;
    
    // Track the last played frequency for portamento
    this.lastFreq = null;
    this.lastNoteEndTime = 0;
    
    // 16-step patterns — syncopated, funky
    this.patterns = {
      idle: [
        0,    null, null, null,    // beat 1: root
        null, null, 7,    null,    // & of 2: fifth push
        null, null, null, null,    // beat 3: rest
        0,    null, null, 10       // beat 4: root + 7th push into next bar
      ],
      ride: [
        0,    null, null, 7,       // beat 1: root, 16th push to 5
        null, 5,    null, null,    // 16th of 2: 4th (movement)
        3,    null, null, 7,       // beat 3: m3, & pushes to 5
        null, null, 7,    null     // & of 4: 5th (unresolved)
      ],
      land: [
        0,    null, null, null,
        null, null, null, null,
        null, null, null, null,
        null, null, null, null
      ]
    };
  }

  setMode(mode) {
    this.mode = mode;
  }

  tick(step, t, grooveMode, confidence = 0.5) {
    if (confidence < 0.15 && this.mode === 'idle') return;
    
    const pattern = this.patterns[this.mode] || this.patterns.idle;
    const interval = pattern[step];
    
    // Slight behind-the-beat pull — bass sits in pocket
    const pocket = 0.008 + Math.random() * 0.004;
    const independenceOffset = (Math.random() - 0.5) * 0.02 * this.virtuoso;
    const bt = t + pocket + independenceOffset;
    
    if (interval !== null && interval !== undefined) {
      const freq = this.rootFreq * Math.pow(2, interval / 12);
      
      // Portamento: if previous note was recent, slide from it
      const now = this.ctx.currentTime;
      const portamento = (this.lastFreq !== null && (now - this.lastNoteEndTime) < 0.15);
      const fromFreq = portamento ? this.lastFreq : null;
      
      if (this.mode === 'land' && step === 0) {
        this._playLandNote(freq, bt, fromFreq);
      } else if (this.mode === 'ride') {
        const isAnchor = step === 0;
        this._playRideNote(freq, bt, this.lift > 0.7, isAnchor, fromFreq);
      } else {
        const isAnchor = step === 0;
        this._playIdleNote(freq, bt, isAnchor, fromFreq);
      }
      
      this.lastFreq = freq;
    }
    
    // ─── VIRTUOSO LAYER ───
    if (this.virtuoso < 0.3) return;
    
    if (this.virtuoso > 0.5 && Math.random() > 0.78) {
      const semi = Math.random() > 0.5 ? 2 : -2;
      const freq = this.rootFreq * Math.pow(2, semi / 12);
      this._playPassingNote(freq, bt);
    }
    
    if (this.virtuoso > 0.7 && step === 5 && Math.random() > 0.7) {
      this._playBurst(bt);
    }
    
    if (this.virtuoso > 0.6 && this.mode === 'ride' && step === 14 && Math.random() > 0.6) {
      const freq = this.rootFreq * Math.pow(2, 3 / 12);
      this._playPassingNote(freq, bt);
    }
  }

  // ─────────────────────────────────────
  // CORE VOICE — two unison squares + resonant filter + PWM feel
  // Returns { oscs, filter, gain } for the caller to shape envelope
  // ─────────────────────────────────────
  _buildZappVoice(freq, t, fromFreq = null) {
    // Two squares with slight detune = Zapp unison width
    const sq1 = this.ctx.createOscillator();
    const sq2 = this.ctx.createOscillator();
    sq1.type = 'square';
    sq2.type = 'square';
    
    // Detune ±8 cents for unison width
    sq1.detune.value = -8 + (Math.random() - 0.5) * 3;
    sq2.detune.value = +8 + (Math.random() - 0.5) * 3;
    
    // Portamento: slide from previous frequency into this one
    if (fromFreq !== null && fromFreq !== freq) {
      sq1.frequency.setValueAtTime(fromFreq, t);
      sq1.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
      sq2.frequency.setValueAtTime(fromFreq, t);
      sq2.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
    } else {
      sq1.frequency.value = freq;
      sq2.frequency.value = freq;
    }
    
    // Gain staging per oscillator
    const g1 = this.ctx.createGain();
    const g2 = this.ctx.createGain();
    g1.gain.value = 0.5;
    g2.gain.value = 0.5;
    sq1.connect(g1);
    sq2.connect(g2);
    
    // Resonant lowpass — the G-funk filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    // Base cutoff — filter opens slightly on virtuoso
    const baseCutoff = 480 + freq * 0.6;  // tracks pitch lightly
    const virtuosoBoost = this.virtuoso * 200;
    filter.frequency.value = baseCutoff + virtuosoBoost;
    filter.Q.value = 6.5;  // aggressive resonance = the Zapp whistle
    
    // Mild filter movement — a quick open-close on each note (wah character)
    filter.frequency.setValueAtTime(baseCutoff + virtuosoBoost - 80, t);
    filter.frequency.linearRampToValueAtTime(baseCutoff + virtuosoBoost + 120, t + 0.03);
    filter.frequency.exponentialRampToValueAtTime(baseCutoff + virtuosoBoost - 40, t + 0.15);
    
    const outGain = this.ctx.createGain();
    
    g1.connect(filter);
    g2.connect(filter);
    filter.connect(outGain);
    outGain.connect(this.dest);
    
    return { sq1, sq2, outGain, filter };
  }

  // ─────────────────────────────────────
  // IDLE NOTE — Zapp voice, short release
  // ─────────────────────────────────────
  _playIdleNote(freq, t, isAnchor = false, fromFreq = null) {
    const { sq1, sq2, outGain } = this._buildZappVoice(freq, t, fromFreq);
    
    const peak = isAnchor ? 0.42 : 0.32;
    const decay = isAnchor ? 0.16 : 0.1;
    
    outGain.gain.setValueAtTime(0, t);
    outGain.gain.linearRampToValueAtTime(peak, t + 0.008);
    outGain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    
    sq1.start(t);
    sq1.stop(t + decay + 0.03);
    sq2.start(t);
    sq2.stop(t + decay + 0.03);
    
    this.lastNoteEndTime = t + decay;
  }

  // ─────────────────────────────────────
  // RIDE NOTE — forward motion, slightly brighter filter
  // ─────────────────────────────────────
  _playRideNote(freq, t, extended = false, isAnchor = false, fromFreq = null) {
    const { sq1, sq2, outGain, filter } = this._buildZappVoice(freq, t, fromFreq);
    
    // Ride gets brighter filter for momentum
    const baseCutoff = 560 + freq * 0.7 + this.virtuoso * 250;
    filter.frequency.setValueAtTime(baseCutoff - 80, t);
    filter.frequency.linearRampToValueAtTime(baseCutoff + 150, t + 0.04);
    filter.frequency.exponentialRampToValueAtTime(baseCutoff - 20, t + 0.2);
    
    const peak = extended ? 0.48 : (isAnchor ? 0.5 : 0.36);
    const decay = extended ? 0.26 : (isAnchor ? 0.18 : 0.12);
    
    outGain.gain.setValueAtTime(0, t);
    outGain.gain.linearRampToValueAtTime(peak, t + 0.008);
    outGain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    
    // Glide on extended notes — Thundercat whole-step bend
    if (extended && Math.random() > 0.6) {
      const glideTarget = freq * Math.pow(2, 2 / 12);
      sq1.frequency.cancelScheduledValues(t + 0.08);
      sq2.frequency.cancelScheduledValues(t + 0.08);
      sq1.frequency.linearRampToValueAtTime(glideTarget, t + 0.12);
      sq1.frequency.linearRampToValueAtTime(freq, t + 0.22);
      sq2.frequency.linearRampToValueAtTime(glideTarget, t + 0.12);
      sq2.frequency.linearRampToValueAtTime(freq, t + 0.22);
    }
    
    sq1.start(t);
    sq1.stop(t + decay + 0.05);
    sq2.start(t);
    sq2.stop(t + decay + 0.05);
    
    this.lastNoteEndTime = t + decay;
  }

  // ─────────────────────────────────────
  // LAND NOTE — held, weighty, filter stays open longer
  // ─────────────────────────────────────
  _playLandNote(freq, t, fromFreq = null) {
    const { sq1, sq2, outGain, filter } = this._buildZappVoice(freq, t, fromFreq);
    
    // Land gets the most resonant filter sweep — "this is it" moment
    const baseCutoff = 600 + freq * 0.5;
    filter.frequency.setValueAtTime(baseCutoff - 100, t);
    filter.frequency.linearRampToValueAtTime(baseCutoff + 200, t + 0.08);
    filter.frequency.exponentialRampToValueAtTime(baseCutoff - 50, t + 0.5);
    filter.Q.value = 7.5;  // a bit more resonance on the land
    
    outGain.gain.setValueAtTime(0, t);
    outGain.gain.linearRampToValueAtTime(0.6, t + 0.012);
    outGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    
    sq1.start(t);
    sq1.stop(t + 0.6);
    sq2.start(t);
    sq2.stop(t + 0.6);
    
    this.lastNoteEndTime = t + 0.55;
  }

  // ─────────────────────────────────────
  // PASSING NOTE — quick, articulated
  // ─────────────────────────────────────
  _playPassingNote(freq, t) {
    const { sq1, sq2, outGain, filter } = this._buildZappVoice(freq, t, null);
    
    // Brighter, snappier filter for passing tones
    filter.frequency.value = 700 + freq * 0.8;
    filter.Q.value = 5.0;
    
    outGain.gain.setValueAtTime(0, t);
    outGain.gain.linearRampToValueAtTime(0.3 * this.virtuoso, t + 0.005);
    outGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    
    sq1.start(t);
    sq1.stop(t + 0.1);
    sq2.start(t);
    sq2.stop(t + 0.1);
    
    this.lastNoteEndTime = t + 0.07;
  }

  _playBurst(t) {
    // Two quick notes close together — Thundercat signature
    const f1 = this.rootFreq;
    const f2 = this.rootFreq * Math.pow(2, 3 / 12);
    
    this._playPassingNote(f1, t);
    setTimeout(() => {
      if (this.ctx) this._playPassingNote(f2, this.ctx.currentTime + 0.005);
    }, 35);
  }
}
