// ═══════════════════════════════════════════════════════════════
// TENSE AF — GROOVE ENGINE v5
// 
// The system now holds a grudge, grants trust, and lets the player
// rise inside it.
// 
// Four axes of state:
//   integrity     — current pocket stability (can die)
//   damage        — persistent scars, slow decay, nonlinear in effect
//   lift          — earned rhythmic elevation (0 → 1)
//   virtuoso      — bass expressiveness unlocked by sustained control
// 
// Failure modes are now separate channels:
//   drift        (chaos + damage) — late, messy
//   misfire      (damage nonlinear) — absence, unreliable execution
//   collapse     (integrity × damage) — staggered, uneven silence
// 
// Rewards appear as removal of resistance:
//   earned tightness (feel.kickBase/snareBase tighten)
//   lift (double-time hat layer, gospel push, call-response)
//   chords (D'Angelo voicings, fragile, only at peak)
//   clap (replaces snare at full lift, communal energy)
// ═══════════════════════════════════════════════════════════════

class GrooveEngine {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.dest = destination;
    
    this.tempo = 88;
    this.step = 0;
    this.bar = 0;
    this.running = false;
    this.timer = null;
    
    // Feel — BASE values. Earned tightness reduces these multiplicatively.
    this.feelBase = {
      kickBase: 0.014,
      snareBase: 0.013,
      hatJitter: 0.018
    };
    this.feel = {
      kickBase: 0.014,
      snareBase: 0.013,
      hatJitter: 0.018
    };
    
    // Four state axes
    this.integrity = 1.0;
    this.damage = 0;
    this.lift = 0;           // 0-1, earned transcendence
    this.virtuoso = 0;       // 0-1, bass expressiveness
    
    // Trust window — buffer against damage after sustained confidence
    this.trustWindow = 0;
    
    // Behavioural memory
    this.alignedStreak = 0;  // tracked for lift/trust
    
    // Interaction state
    this.lastKickDrag = 0;
    this.dropCounter = 0;
    
    this.cogState = null;
    this.mode = 'idle';
    this.mode_cognitive = 'pattern';  // named cognitive mode, updated each bar
    this.landPending = false;
    this.bassEngine = null;
    
    this._noiseBuffer = null;
    this._buildNoise();
  }

  _buildNoise() {
    const len = Math.floor(this.ctx.sampleRate * 0.3);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buf;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const interval = (60 / this.tempo / 4) * 1000;
    this.timer = setInterval(() => this.tick(), interval);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.running = false;
  }

  tick() {
    const now = this.ctx.currentTime;
    const t = now + 0.02;
    
    this._updateState();
    
    // Infer mode each bar (stable through the bar)
    if (this.step === 0 && this.cogState && typeof inferMode === 'function') {
      this.mode_cognitive = inferMode(this.cogState, this);
    }
    
    if (this.step === 0) {
      this.bar++;
      if (this.bar % 2 === 0) {
        this.feel.kickBase = this.feelBase.kickBase + 0.002;
      } else {
        this.feel.kickBase = this.feelBase.kickBase - 0.002;
      }
    }
    
    this.playStep(this.step, t);
    this.step = (this.step + 1) % 16;
  }

  // ─────────────────────────────────────
  // STATE UPDATE — integrity, damage, lift, virtuoso, trust window,
  // earned tightness
  // ─────────────────────────────────────
  _updateState() {
    if (!this.cogState) return;
    
    const conf = this.cogState.confidence;
    const instab = this.cogState.instability;
    
    // DAMAGE — slow-bleeding memory
    this.damage += instab * 0.012;
    this.damage *= 0.985;
    this.damage = Math.min(1.0, this.damage);
    
    // INTEGRITY
    let delta;
    if (instab > 0.5) {
      delta = -instab * 0.045 + conf * 0.006;
    } else if (conf > 0.7) {
      delta = 0.035 - this.damage * 0.012 - instab * 0.01;
    } else {
      delta = 0.006 - this.damage * 0.008 - instab * 0.02;
    }
    this.integrity += delta;
    this.integrity = Math.max(0.0, Math.min(1.0, this.integrity));
    
    // LIFT — earned transcendence
    // Rises only when confidence is high AND damage is low AND streak is strong
    if (conf > 0.85 && this.damage < 0.3 && this.alignedStreak >= 4) {
      this.lift = Math.min(1.0, this.lift + 0.04);
    } else {
      this.lift *= 0.97;
    }
    // FRAGILE: collapses fast on instability
    if (instab > 0.5) {
      this.lift *= 0.6;
    }
    
    // VIRTUOSO — bass expressiveness, requires high trust
    if (this.lift > 0.7 && this.integrity > 0.8 && this.damage < 0.3) {
      this.virtuoso = Math.min(1.0, this.virtuoso + 0.06);
    } else {
      this.virtuoso *= 0.9;
    }
    if (instab > 0.4) this.virtuoso *= 0.5;
    
    // EARNED TIGHTNESS — feel values tighten multiplicatively when trusted
    const tightness = Math.min(0.22, this.lift * 0.15 + (conf > 0.8 ? 0.07 : 0));
    this.feel.snareBase = this.feelBase.snareBase * (1 - tightness);
    this.feel.hatJitter = this.feelBase.hatJitter * (1 - tightness * 0.6);
    
    // Push bass engine
    if (this.bassEngine) {
      this.bassEngine.virtuoso = this.virtuoso;
      this.bassEngine.lift = this.lift;
    }
  }

  onCommit() {
    // Called from content layer on commit
    this.integrity = Math.min(1.0, this.integrity + 0.12);
  }

  // Called on aligned answer — feeds streak + trust
  onAligned() {
    this.alignedStreak++;
    // Trust window earned after sustained alignment
    if (this.alignedStreak >= 4) {
      this.trustWindow = 3;
    }
  }

  // Called on misaligned
  onMisaligned() {
    this.alignedStreak = 0;
    // Trust window evaporates immediately
    this.trustWindow = 0;
  }

  // ─────────────────────────────────────
  // KICK
  // ─────────────────────────────────────
  playKick(t, velocity = 1.0) {
    const kt = t;
    
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(190, kt);
    click.frequency.exponentialRampToValueAtTime(55, kt + 0.025);
    clickGain.gain.setValueAtTime(0.32 * velocity, kt);
    clickGain.gain.exponentialRampToValueAtTime(0.001, kt + 0.035);
    click.connect(clickGain);
    clickGain.connect(this.dest);
    click.start(kt);
    click.stop(kt + 0.04);
    
    const body = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(115, kt);
    body.frequency.exponentialRampToValueAtTime(42, kt + 0.13);
    bodyGain.gain.setValueAtTime(0.95 * velocity, kt);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, kt + 0.18);
    body.connect(bodyGain);
    bodyGain.connect(this.dest);
    body.start(kt);
    body.stop(kt + 0.2);
    
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(52, kt);
    sub.frequency.exponentialRampToValueAtTime(34, kt + 0.1);
    subGain.gain.setValueAtTime(0.55 * velocity, kt);
    subGain.gain.exponentialRampToValueAtTime(0.001, kt + 0.16);
    sub.connect(subGain);
    subGain.connect(this.dest);
    sub.start(kt);
    sub.stop(kt + 0.18);
  }

  // ─────────────────────────────────────
  // SNARE
  // ─────────────────────────────────────
  playSnare(t, velocity = 1.0, ghost = false) {
    const st = t;
    const v = ghost ? 0.25 * velocity : velocity;
    
    const tone = this.ctx.createOscillator();
    const toneGain = this.ctx.createGain();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(230, st);
    tone.frequency.exponentialRampToValueAtTime(95, st + 0.025);
    toneGain.gain.setValueAtTime(0.32 * v, st);
    toneGain.gain.exponentialRampToValueAtTime(0.001, st + 0.035);
    tone.connect(toneGain);
    toneGain.connect(this.dest);
    tone.start(st);
    tone.stop(st + 0.04);
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer;
    
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    hp.Q.value = 0.4;
    
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 0.8;
    
    const g = this.ctx.createGain();
    const decay = ghost ? 0.05 : 0.12;
    g.gain.setValueAtTime(0.62 * v, st);
    g.gain.exponentialRampToValueAtTime(0.001, st + decay);
    
    noise.connect(hp);
    hp.connect(bp);
    bp.connect(g);
    g.connect(this.dest);
    noise.start(st);
    noise.stop(st + decay + 0.02);
  }

  // ─────────────────────────────────────
  // CLAP — replaces snare at full lift. Late. Wide. Human.
  // The moment the groove stops being yours alone.
  // ─────────────────────────────────────
  playClap(t, velocity = 1.0) {
    // Three layered noise bursts with slight stereo offset, flam possible
    const baseDelay = 0;
    const layers = [
      { offset: 0, gain: 0.55 * velocity, decay: 0.04 },
      { offset: 0.006, gain: 0.48 * velocity, decay: 0.05 },
      { offset: 0.012, gain: 0.42 * velocity, decay: 0.06 }
    ];
    
    // Human flam — sometimes one of the three is an early pre-slap
    const flam = Math.random() > 0.6;
    if (flam) {
      layers[0].offset = -0.008;
      layers[0].gain *= 0.7;
    }
    
    layers.forEach((layer, i) => {
      const ct = t + layer.offset;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this._noiseBuffer;
      
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 900 + i * 100;
      hp.Q.value = 0.5;
      
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400 + i * 200;
      bp.Q.value = 1.2;
      
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(layer.gain, ct);
      g.gain.exponentialRampToValueAtTime(0.001, ct + layer.decay);
      
      noise.connect(hp);
      hp.connect(bp);
      bp.connect(g);
      g.connect(this.dest);
      noise.start(ct);
      noise.stop(ct + layer.decay + 0.02);
    });
  }

  // ─────────────────────────────────────
  // HAT
  // ─────────────────────────────────────
  playHat(t, velocity = 0.1, open = false) {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer;
    
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = open ? 6500 : 8000;
    hp.Q.value = 0.7;
    
    const g = this.ctx.createGain();
    const decay = open ? 0.12 : 0.022;
    g.gain.setValueAtTime(velocity, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    
    noise.connect(hp);
    hp.connect(g);
    g.connect(this.dest);
    noise.start(t);
    noise.stop(t + decay + 0.02);
  }

  // ─────────────────────────────────────
  // CHORD — D'Angelo voicing. Fragile. Earned. Blooms (staggered notes).
  // Rootless, clustered, detuned. Only appears at peak trust.
  // ─────────────────────────────────────
  playChord(t) {
    // Rootless m9 voicing — bass provides the root
    // Intervals from tonic A (110 Hz up an octave for body = 220):
    //   m3, 5, m7, 9 → [3, 7, 10, 14] semitones
    // Clustered variants: occasional +1 on middle note = "wrongness"
    const baseFreq = 220;  // A3
    const voicing = [3, 7, 10, 14];
    
    // Subtle micro-movement — occasionally shift one interval
    if (Math.random() > 0.6) {
      const idx = 1 + Math.floor(Math.random() * 2);
      voicing[idx] += Math.random() > 0.5 ? 1 : -1;
    }
    
    voicing.forEach((semi, i) => {
      const freq = baseFreq * Math.pow(2, semi / 12);
      // Stagger — chord blooms, doesn't hit
      const noteT = t + i * 0.004;
      
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const filt = this.ctx.createBiquadFilter();
      
      // Sine + triangle blend
      osc1.type = 'sine';
      osc2.type = 'triangle';
      
      // Per-note detune — imperfection
      const detune = (Math.random() - 0.5) * 8;
      osc1.frequency.value = freq;
      osc2.frequency.value = freq;
      osc1.detune.value = detune;
      osc2.detune.value = detune + (Math.random() - 0.5) * 5;
      
      // Filter the triangle slightly — soften top
      filt.type = 'lowpass';
      filt.frequency.value = 1800 + this.lift * 800;
      filt.Q.value = 0.4;
      
      // Short, soft attack; medium decay
      const vel = 0.08 * this.lift;
      g.gain.setValueAtTime(0, noteT);
      g.gain.linearRampToValueAtTime(vel, noteT + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, noteT + 0.9);
      
      osc1.connect(filt);
      osc2.connect(filt);
      filt.connect(g);
      g.connect(this.dest);
      
      osc1.start(noteT);
      osc1.stop(noteT + 1.0);
      osc2.start(noteT);
      osc2.stop(noteT + 1.0);
    });
  }

  // ─────────────────────────────────────
  // PLAY STEP — Dilla pocket with integrity + damage + lift
  // ─────────────────────────────────────
  playStep(step, t) {
    const conf = this.cogState ? this.cogState.confidence : 0.5;
    const instab = this.cogState ? this.cogState.instability : 0;
    const intg = this.integrity;
    const chaos = 1 - intg;
    const isSecondBar = this.bar % 2 === 0;
    const mode = this.mode_cognitive || 'pattern';
    
    // ─── MODE MODIFIERS ───
    // Mode is inferred from cognitive state each bar. Instead of scattered
    // state checks, the groove reads the mode name and adjusts behaviour.
    const modeDeadpan = mode === 'deadpan';
    const modePattern = mode === 'pattern';
    const modeMeta = mode === 'meta';
    const modeExposure = mode === 'exposure';
    const modeContradiction = mode === 'contradiction';
    
    // ─── COLLAPSE — staggered, respects scars ───
    if (instab > 0.7 && this.dropCounter === 0) {
      this.dropCounter = 4 + Math.floor(instab * 4);
    }
    if (this.dropCounter > 0) {
      this.dropCounter--;
      // Survival respects both integrity AND damage.
      // Fresh collapse = recoverable. Scarred collapse = brutal.
      const survival = intg * (1 - this.damage * 0.6);
      if (Math.random() > survival) return;
    }
    
    // ─── KICK ───
    // Gospel push — when lifted, kicks land slightly earlier
    const push = this.lift * 0.006;
    let kickDrag = this.feel.kickBase + (Math.random() - 0.5) * (0.006 + chaos * 0.020);
    kickDrag += this.damage * 0.018;
    kickDrag -= push;
    
    if (Math.random() > (0.88 - chaos * 0.2)) {
      kickDrag += 0.012;
    }
    
    const kt = t + kickDrag;
    
    // MISFIRE — NONLINEAR. Low damage barely audible, high damage betrays.
    const misfire = Math.pow(this.damage, 1.6) * 0.45;
    
    if (step === 0) {
      // Downbeat: usually sacred, but not guaranteed under heavy pressure
      if ((intg > 0.3 || Math.random() > 0.15) && Math.random() > misfire * 0.5) {
        this.playKick(kt, 1.0);
        this.lastKickDrag = kickDrag;
      }
    }
    
    if (step === 6 && Math.random() > (0.35 + chaos * 0.25) && Math.random() > misfire) {
      this.playKick(kt, 0.8);
      this.lastKickDrag = kickDrag;
    }
    
    if (step === 10 && Math.random() > (0.5 + chaos * 0.2) && Math.random() > misfire) {
      this.playKick(kt, 0.7);
      this.lastKickDrag = kickDrag;
    }
    
    // Ghost kick — only in healthy pocket
    if (step === 14 && conf > 0.6 && intg > 0.7 && Math.random() > 0.78) {
      this.playKick(kt, 0.5);
    }
    
    // ─── SNARE / CLAP — clap REPLACES snare at full lift ───
    const useClap = this.lift > 0.8 && this.integrity > 0.85 && this.damage < 0.25;
    
    if (step === 4 || step === 12) {
      const dropProbability = 0.22 + chaos * 0.15;
      
      if (Math.random() > dropProbability) {
        let snareLag = this.feel.snareBase + Math.random() * 0.008;
        
        if (this.lastKickDrag > 0.018) {
          snareLag *= 0.7;
        }
        
        if (Math.random() > 0.78) {
          snareLag += 0.015;
        }
        
        snareLag += chaos * 0.020;
        snareLag += this.damage * 0.022;
        
        if (intg < 0.4) {
          snareLag += 0.025;
        }
        
        // Contradiction mode: snare drifts extra late — pocket fights itself
        if (modeContradiction) {
          snareLag += 0.012;
        }
        
        const st = t + snareLag;
        
        if (useClap) {
          // Clap is LATE — additional 14-26ms on top
          const clapLag = 0.014 + Math.random() * 0.012;
          this.playClap(st + clapLag, 0.9);
        } else {
          this.playSnare(st, 0.95);
        }
      }
    }
    
    // Call-response snare at full lift — rare
    if (this.lift > 0.85 && step === 5 && Math.random() > 0.7) {
      this.playSnare(t + 0.004, 0.4, true);
    }
    
    // Ghost snare — healthy pocket only (deadpan strips them)
    if (!modeDeadpan && conf > 0.55 && intg > 0.6 && step % 4 === 3 && Math.random() > 0.68) {
      const ghostLag = 0.003 + Math.random() * 0.008;
      this.playSnare(t + ghostLag, 0.28, true);
    }
    
    // Phrasing break at high trust — remove expected snare
    let skipPhrasingHits = this.lift > 0.8 && this.bar % 4 === 3;
    
    // ─── HATS (base layer) ───
    let skipHats = false;
    if (isSecondBar && step < 8 && Math.random() > 0.55) skipHats = true;
    if (Math.random() > intg) skipHats = true;
    if (instab > 0.6) skipHats = true;
    
    if (!skipHats && step % 2 === 0) {
      if (Math.random() > 0.3) {
        const jitter = (Math.random() - 0.5) * (this.feel.hatJitter + chaos * 0.03);
        const ht = t + jitter;
        const velocity = 0.05 + Math.random() * 0.09;
        this.playHat(ht, velocity);
      }
    }
    
    // Open hat — rare breath
    if (step === 7 && conf > 0.65 && intg > 0.7 && Math.random() > 0.72) {
      this.playHat(t + 0.01, 0.12, true);
    }
    
    // ─── DOUBLE-TIME HAT LAYER (Lift state) ───
    // On every step (not every other) when lifted — forward motion
    if (this.lift > 0.6) {
      const jitter = (Math.random() - 0.5) * 0.01;
      const ht = t + jitter;
      const vel = 0.04 + this.lift * 0.06;
      // Only odd steps to avoid stacking with base hats at step % 2 === 0
      if (step % 2 === 1 && Math.random() > 0.25) {
        this.playHat(ht, vel);
      }
    }
    
    // ─── D'ANGELO CHORDS — rootless, fragile, earned ───
    // Meta mode lowers the gate — higher-order thinking unlocks harmony earlier
    const chordGate = modeMeta ? 0.6 : 0.75;
    if (step === 0 
        && this.lift > chordGate 
        && this.integrity > 0.8 
        && instab < 0.4
        && this.bar % 2 === 0 
        && Math.random() > 0.4) {
      const ct = t + 0.010 + Math.random() * 0.015;
      this.playChord(ct);
    }
    
    // ─── BASS ───
    if (this.bassEngine) {
      this.bassEngine.tick(step, t, this.mode, conf);
    }
    
    if (this.landPending && step === 0) {
      this._executeLand(t);
      this.landPending = false;
    }
  }

  // ─────────────────────────────────────
  // DECISION FEEDBACK
  // ─────────────────────────────────────
  triggerLand() {
    this.mode = 'land';
    this.landPending = true;
    if (this.bassEngine) this.bassEngine.setMode('land');
    this.onCommit();
  }
  
  _executeLand(t) {
    this.playKick(t - 0.005, 1.15);
  }
  
  triggerRide() {
    this.mode = 'ride';
    if (this.bassEngine) this.bassEngine.setMode('ride');
    this.onCommit();
  }
  
  resetMode() {
    this.mode = 'idle';
    if (this.bassEngine) this.bassEngine.setMode('idle');
  }
  
  tick_sound() {
    const t = this.ctx.currentTime + 0.005;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1800, t);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    o.connect(g);
    g.connect(this.dest);
    o.start(t);
    o.stop(t + 0.025);
  }
  
  onDecisionLoss() {
    this.integrity = Math.max(0.0, this.integrity - 0.05);
  }
}
