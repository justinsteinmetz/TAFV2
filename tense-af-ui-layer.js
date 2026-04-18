// ═══════════════════════════════════════════════════════════════
// TENSE AF — UI LAYER (v3)
//
// Renders the decision moment. Subscribes to cognitiveState.
// 
// Design:
//   - Question card reacts to state (scale, border, glow)
//   - Options locked dead-centre, thumb-zone friendly
//   - Touch-down = instant visual lock (via input layer CSS classes)
//   - Reveal appears AFTER commit, replaces options
//   - Phase changes subtly shift visual tone
// ═══════════════════════════════════════════════════════════════

class UILayer {
  constructor() {
    this.revealTimeout = null;
    this.nextTimeout = null;
  }

  init() {
    // Subscribe to cognitive state
    cognitiveState.subscribe((event, state) => this._onStateChange(event, state));
  }

  _onStateChange(event, state) {
    // UI reacts to cognitive state — never to audio or input directly
    const root = document.documentElement;
    
    // Continuous: hesitation, confidence, instability → CSS vars
    root.style.setProperty('--cog-hesitation', state.hesitation.toFixed(3));
    root.style.setProperty('--cog-confidence', state.confidence.toFixed(3));
    root.style.setProperty('--cog-instability', state.instability.toFixed(3));
    root.style.setProperty('--cog-phase', `"${state.phase}"`);
    
    // Binary class toggles for CSS animations
    document.body.classList.toggle('unstable', state.instability > 0.55);
    document.body.classList.toggle('hesitating', state.hesitation > 0.55);
    document.body.classList.toggle('confident', state.confidence > 0.7);
    
    // Phase changes → body class
    const phaseClasses = ['phase-entry', 'phase-stability', 'phase-pressure', 'phase-release'];
    phaseClasses.forEach(c => document.body.classList.remove(c));
    document.body.classList.add(`phase-${state.phase}`);
    
    // Event-specific UI reactions
    if (event === 'prompt-begin') {
      // Card settles back to idle
      this._setCardState('idle');
    }
    
    if (event === 'commit') {
      this._setCardState('committed');
    }
    
    if (event === 'reveal') {
      // Reveal already rendered by renderReveal — this just settles state
      if (state.alignment === 'aligned') {
        this._setCardState('aligned');
      } else {
        this._setCardState('misaligned');
      }
    }
  }

  _setCardState(s) {
    const card = document.querySelector('.q-card');
    if (!card) return;
    card.classList.remove('q-idle', 'q-committed', 'q-aligned', 'q-misaligned');
    card.classList.add(`q-${s}`);
  }

  // ─────────────────────────────────────
  // RENDER A NEW PROMPT
  // ─────────────────────────────────────
  renderPrompt(promptData) {
    const contextEl = document.getElementById('context');
    const promptEl = document.getElementById('prompt');
    const optionsEl = document.getElementById('options');
    const revealEl = document.getElementById('reveal');
    
    // Reset input layer for fresh prompt
    inputLayer.reset();
    
    if (contextEl) {
      contextEl.textContent = promptData.context || '';
      contextEl.style.display = promptData.context ? 'block' : 'none';
    }
    promptEl.textContent = promptData.prompt;
    revealEl.textContent = '';
    revealEl.className = 'reveal';
    
    // Clear and rebuild options
    optionsEl.innerHTML = '';
    optionsEl.style.opacity = '1';
    optionsEl.style.pointerEvents = 'auto';
    
    promptData.buttons.forEach(btn => {
      const buttonEl = document.createElement('button');
      buttonEl.className = 'option-btn';
      buttonEl.textContent = btn.label;
      buttonEl.dataset.type = btn.type;
      optionsEl.appendChild(buttonEl);
      
      // Attach input handling
      inputLayer.attachToButton(
        buttonEl,
        btn.type, // 'past' or 'perfect'
        (commitData) => this._onCommit(commitData)
      );
    });
    
    // Mark the prompt shown — starts decisionTime clock in inputLayer
    inputLayer.markPromptShown();
    
    // UI enters "idle" state
    this._setCardState('idle');
  }

  _onCommit(commitData) {
    // 1) Content layer evaluates
    const reveal = contentLayer.handleCommit(commitData);
    if (!reveal) return;
    
    // 2) Lock the buttons
    const optionsEl = document.getElementById('options');
    optionsEl.style.pointerEvents = 'none';
    
    // 3) Show chosen / not-chosen
    optionsEl.querySelectorAll('.option-btn').forEach(btn => {
      if (btn.dataset.type === commitData.choice) {
        btn.classList.add('option-chosen');
      } else {
        btn.classList.add('option-notchosen');
      }
    });
    
    // 4) Render reveal — fragment if withheld
    const revealEl = document.getElementById('reveal');
    revealEl.textContent = reveal.revealText;
    revealEl.classList.remove('reveal-aligned', 'reveal-misaligned', 'reveal-withheld');
    if (reveal.withheld) {
      revealEl.classList.add('reveal-withheld');
    } else {
      revealEl.classList.add(reveal.aligned ? 'reveal-aligned' : 'reveal-misaligned');
    }
    
    // 5) Finalise alignment
    clearTimeout(this.revealTimeout);
    this.revealTimeout = setTimeout(() => {
      contentLayer.finalizeAlignment(reveal.aligned);
    }, 300);
    
    // 5b) Check if a previously-withheld reveal can now be released
    // (player has stabilised — give earlier understanding back)
    setTimeout(() => {
      const release = contentLayer.checkResolutionRelease();
      if (release) {
        this._showResolutionRelease(release);
      }
    }, 1200);
    
    // 6) Pacing ties to cognitive state
    clearTimeout(this.nextTimeout);
    const conf = cognitiveState.confidence;
    const basePause = reveal.aligned ? 2200 : 2800;
    const withheldPause = reveal.withheld ? 600 : 0;
    const pauseMs = basePause + (1 - conf) * 1200 + withheldPause;
    this.nextTimeout = setTimeout(() => this.nextPrompt(), pauseMs);
  }

  // ─────────────────────────────────────
  // RESOLUTION RELEASE — a previously-withheld reveal returns
  // ─────────────────────────────────────
  _showResolutionRelease(releaseData) {
    // Briefly overlay the earlier reveal — "earned understanding"
    const revealEl = document.getElementById('reveal');
    if (!revealEl) return;
    
    // Prepend a marker so the player knows this is retrospective
    const originalText = revealEl.textContent;
    revealEl.innerHTML = 
      `<span style="opacity:0.55; font-size:0.85em;">earlier · </span>` +
      `<span style="color:#c9e5d0;">${releaseData.fullReveal}</span>`;
    
    // After a few seconds, restore the current reveal (if still on same screen)
    setTimeout(() => {
      if (revealEl.textContent.includes(releaseData.fullReveal)) {
        revealEl.textContent = originalText;
      }
    }, 2800);
  }

  _onCancel(cancelData) {
    // Accidental bounce — do nothing. Prompt stays.
    // Register as decision-loss for audio
    if (typeof audio !== 'undefined') {
      audio.onInputDecisionLoss();
    }
  }

  nextPrompt() {
    contentLayer.next();
    
    if (contentLayer.isComplete()) {
      this.renderEnd();
      return;
    }
    
    const promptData = contentLayer.preparePrompt();
    if (promptData) {
      this.renderPrompt(promptData);
    }
  }

  renderEnd() {
    // Navigate to end screen
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('end').classList.add('active');
    
    const state = cognitiveState;
    const aligned = state.recentAlignments.filter(a => a === 'aligned').length;
    const total = state.questionCount;
    
    document.getElementById('endSub').textContent = 
      `${aligned} / ${total} aligned · confidence ${Math.round(state.confidence * 100)}%`;
  }

  startGame() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('game').classList.add('active');
    
    cognitiveState.reset();
    contentLayer.loadItems(NODE_3_ITEMS);
    
    this.nextPrompt();
  }
}

const uiLayer = new UILayer();
