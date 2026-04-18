// ═══════════════════════════════════════════════════════════════
// TENSE AF — AUDIO ENGINE v3
// 
// Discipline:
//   - Drums are DRY. No reverb on kick/snare/hats.
//   - No ambient pad. No wash. No Enigma.
//   - Only FX (scratches, ticks) have light reverb.
//   - Bass gets no reverb either — it's part of the pocket.
// 
// Subscribes to cognitiveState:
//   - 'commit'  → triggers LAND or RIDE based on choice+node
//   - 'reveal'  → aligned/misaligned feedback
// ═══════════════════════════════════════════════════════════════

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.running = false;
    this.nodes = {};
    this.groove = null;
    this.bass = null;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Master
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.3;
      
      // SOFT CLIP — driven by instability. Clean at 0, crunchy at 1.
      this.drive = this.ctx.createWaveShaper();
      this.drive.curve = this._makeDriveCurve(0);  // starts clean
      this.drive.oversample = '2x';
      this.drive.connect(this.master);
      this.driveAmount = 0;
      
      // Gentle glue compression
      this.masterComp = this.ctx.createDynamicsCompressor();
      this.masterComp.threshold.value = -14;
      this.masterComp.knee.value = 8;
      this.masterComp.ratio.value = 3;
      this.masterComp.attack.value = 0.005;
      this.masterComp.release.value = 0.1;
      this.masterComp.connect(this.drive);  // comp → drive → master
      this.master.connect(this.ctx.destination);
      
      // Light reverb — ONLY for FX bus, not drums
      this.reverb = this._buildReverb();
      this.reverb.output.connect(this.masterComp);
      
      // DRY drum bus — straight to compressor, no reverb
      this.nodes.drums = this.ctx.createGain();
      this.nodes.drums.connect(this.masterComp);
      
      // DRY bass bus — boosted for the fatter bass tone
      this.nodes.bass = this.ctx.createGain();
      this.nodes.bass.gain.value = 1.35;  // bass sits louder than drums
      this.nodes.bass.connect(this.masterComp);
      
      // FX bus — with reverb send
      this.nodes.fx = this.ctx.createGain();
      this.nodes.fx.connect(this.masterComp);
      const fxSend = this.ctx.createGain();
      fxSend.gain.value = 0.35;
      this.nodes.fx.connect(fxSend);
      fxSend.connect(this.reverb.input);
      
      // Initialise engines
      this.groove = new GrooveEngine(this.ctx, this.nodes.drums);
      this.bass = new BassEngine(this.ctx, this.nodes.bass);
      this.groove.bassEngine = this.bass;
      
      // Subscribe to cognitive state
      if (typeof cognitiveState !== 'undefined') {
        this.groove.cogState = cognitiveState;
        cognitiveState.subscribe((event, state) => this._onCogStateChange(event, state));
      }
      
      console.log('✓ AudioEngine v3 initialised (dry drums, no pad)');
    } catch (err) {
      console.error('AudioEngine init error:', err);
    }
  }

  _buildReverb() {
    const input = this.ctx.createGain();
    const output = this.ctx.createGain();
    output.gain.value = 0.45;
    
    const delayTimes = [0.029, 0.037, 0.041, 0.043];
    const decays = [0.62, 0.58, 0.55, 0.52];
    
    const pre = this.ctx.createDelay(0.1);
    pre.delayTime.value = 0.015;
    
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3800;
    lp.Q.value = 0.4;
    
    input.connect(pre);
    delayTimes.forEach((time, i) => {
      const d = this.ctx.createDelay(0.2);
      d.delayTime.value = time;
      const fb = this.ctx.createGain();
      fb.gain.value = decays[i];
      pre.connect(d);
      d.connect(fb);
      fb.connect(d);
      fb.connect(lp);
    });
    lp.connect(output);
    
    return { input, output };
  }

  _onCogStateChange(event, state) {
    // Audio subscribes to state changes and reacts accordingly.
    // This is the ONLY path from cognition to sound.
    
    // CONTINUOUS SONIC TEXTURE
    // Gain scales with confidence — confident play gets louder/fuller
    // Instability drives distortion — hesitation sounds broken
    if (this.master && this.ctx) {
      const targetGain = 0.22 + state.confidence * 0.14;
      this.master.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.3);
    }
    if (this.drive) {
      // Rebuild curve when driveAmount changes meaningfully OR every ~1s for drift
      const newDrive = state.instability;
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const timeForDrift = !this._lastCurveTime || (now - this._lastCurveTime) > 900;
      if (Math.abs(newDrive - this.driveAmount) > 0.08 || (newDrive > 0.15 && timeForDrift)) {
        this.driveAmount = newDrive;
        this.drive.curve = this._makeDriveCurve(newDrive);
        this._lastCurveTime = now;
      }
    }
    
    if (event === 'prompt-begin') {
      if (this.groove) this.groove.resetMode();
    }
    
    if (event === 'commit') {
      if (this.groove) this.groove.tick_sound();
    }
    
    if (event === 'reveal') {
      setTimeout(() => {
        if (this.groove) this.groove.resetMode();
      }, 2000);
    }
  }

  // WaveShaper curve — ASYMMETRIC soft clip with DRIFT.
  // Bias moves over real time (not just state), so distortion
  // wobbles slightly. Human perception notices movement more than state.
  _makeDriveCurve(amount) {
    const samples = 2048;
    const curve = new Float32Array(samples);
    const k = amount * amount * 40;
    // Time-varying bias — drifts even when amount is static
    const drift = Math.sin((typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.002) * 0.1;
    const bias = amount * (0.2 + drift);
    const normalize = Math.tanh(1 + k);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      if (amount < 0.01) {
        curve[i] = x;
      } else {
        curve[i] = Math.tanh((x + bias) * (1 + k)) / normalize;
      }
    }
    return curve;
  }

  start() {
    if (this.running) return;
    if (this.groove) this.groove.start();
    this.running = true;
  }

  stop() {
    if (this.groove) this.groove.stop();
    this.running = false;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (!this.master) return;
    if (this.muted) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      if (this.groove) this.groove.stop();
    } else {
      this.master.gain.setTargetAtTime(0.3, this.ctx.currentTime, 0.05);
      if (this.groove) this.groove.start();
    }
  }

  // ─────────────────────────────────────
  // TACTILE TICK on touch-down
  // ─────────────────────────────────────
  tick() {
    if (!this.ctx || this.muted || !this.groove) return;
    this.groove.tick_sound();
  }

  // ─────────────────────────────────────
  // LAND / RIDE triggers (called from content layer)
  // ─────────────────────────────────────
  land() {
    if (this.groove) this.groove.triggerLand();
  }
  
  ride() {
    if (this.groove) this.groove.triggerRide();
  }

  // ─────────────────────────────────────
  // MISALIGNMENT: groove stutters briefly
  // ─────────────────────────────────────
  stumble() {
    if (!this.ctx || this.muted || !this.groove) return;
    // Induce snare drift + temporarily cut kick
    this.groove.onDecisionLoss();
    this.groove.onDecisionLoss();
    this.groove.onDecisionLoss();
  }

  // ─────────────────────────────────────
  // Decision-loss (hesitation drift)
  // ─────────────────────────────────────
  onInputDecisionLoss() {
    if (this.groove) this.groove.onDecisionLoss();
  }

  // ─────────────────────────────────────
  // FX (optional reveals — scratches)
  // ─────────────────────────────────────
  scratch() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(340, t);
    o.frequency.linearRampToValueAtTime(110, t + 0.1);
    f.type = 'bandpass';
    f.frequency.value = 1400;
    f.Q.value = 2.5;
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(f);
    f.connect(g);
    g.connect(this.nodes.fx);
    o.start(t);
    o.stop(t + 0.15);
  }
}
