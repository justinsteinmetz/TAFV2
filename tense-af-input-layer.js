// ═══════════════════════════════════════════════════════════════
// TENSE AF — INPUT LAYER v2 (Bulletproof)
// 
// Rule: EVERY touch commits. No exceptions.
// No "accidental bounce" check. No cancel window.
// If the user touched a button, they meant it.
//
// Uses Pointer Events where available (unifies mouse + touch),
// falls back to touch/mouse events otherwise.
// ═══════════════════════════════════════════════════════════════

const REINFORCE_MS = 400;

class InputLayer {
  constructor() {
    this.activeButton = null;
    this.touchDownTime = null;
    this.promptShownTime = null;
    this.onCommitCallback = null;
    this.committed = false;
    this.reinforceTimer = null;
  }

  markPromptShown() {
    this.promptShownTime = performance.now();
  }

  attachToButton(button, choiceLabel, onCommit) {
    button.onclick = null;
    button.dataset.choice = choiceLabel;

    // Use Pointer Events if available (modern unified API)
    if (window.PointerEvent) {
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        // Capture so we never miss pointerup even if finger slides
        try { button.setPointerCapture(e.pointerId); } catch(_) {}
        this.startCommit(button, choiceLabel, onCommit);
      });

      button.addEventListener('pointerup', (e) => {
        e.preventDefault();
        this.endCommit(button);
      });

      button.addEventListener('pointercancel', () => {
        // Even on cancel, commit (the user touched it)
        this.endCommit(button);
      });
    } else {
      // Fallback: touch + mouse
      button.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.startCommit(button, choiceLabel, onCommit);
      }, { passive: false });

      button.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.endCommit(button);
      }, { passive: false });

      button.addEventListener('touchcancel', () => {
        this.endCommit(button);
      });

      button.addEventListener('mousedown', () => {
        if (this.activeButton) return;
        this.startCommit(button, choiceLabel, onCommit);
      });

      button.addEventListener('mouseup', () => {
        this.endCommit(button);
      });
    }
  }

  startCommit(button, choiceLabel, onCommit) {
    if (this.activeButton) return;
    if (this.committed) return;

    this.activeButton = button;
    this.touchDownTime = performance.now();
    this.committed = false;
    this.onCommitCallback = onCommit;

    // INSTANT visual lock
    button.classList.add('option-btn-locked');
    this._recedeOthers(button);

    // Audio tick
    if (typeof audio !== 'undefined' && audio.tick) {
      audio.tick();
    }

    // Haptic
    if (navigator.vibrate) navigator.vibrate(8);

    // Reinforce visual at 400ms
    this.reinforceTimer = setTimeout(() => {
      if (this.activeButton === button && !this.committed) {
        button.classList.add('option-btn-reinforced');
      }
    }, REINFORCE_MS);
  }

  endCommit(button) {
    if (this.activeButton !== button) return;
    if (this.committed) return;

    this.committed = true;
    clearTimeout(this.reinforceTimer);

    const holdDuration = performance.now() - this.touchDownTime;
    const decisionTime = this.promptShownTime
      ? this.touchDownTime - this.promptShownTime
      : null;

    const commitType = holdDuration < 250 ? 'tap' : 'hold';

    const commitCallback = this.onCommitCallback;
    const data = {
      decisionTime,
      holdDuration,
      commitType,
      choice: button.dataset.choice
    };

    // Leave "locked" class visible briefly for continuity, then clear
    setTimeout(() => {
      this._releaseButton(button);
      this._restoreOthers();
      this.activeButton = null;
      this.touchDownTime = null;
      this.onCommitCallback = null;
      this.reinforceTimer = null;
    }, 120);

    if (commitCallback) commitCallback(data);
  }

  _releaseButton(button) {
    button.classList.remove('option-btn-locked', 'option-btn-reinforced');
  }

  _recedeOthers(activeBtn) {
    const container = activeBtn.parentElement;
    if (!container) return;
    container.querySelectorAll('.option-btn').forEach(b => {
      if (b !== activeBtn) b.classList.add('option-btn-receded');
    });
  }

  _restoreOthers() {
    document.querySelectorAll('.option-btn-receded').forEach(b => {
      b.classList.remove('option-btn-receded');
    });
  }

  // Called by UI when moving to next prompt — reset committed flag
  reset() {
    this.committed = false;
    this.activeButton = null;
    this.touchDownTime = null;
    clearTimeout(this.reinforceTimer);
  }
}

const inputLayer = new InputLayer();
