// ═══════════════════════════════════════════════════════════════
// TENSE AF — CONTENT LAYER v3
// 
// The judgement layer. Holds a grudge, grants trust, withholds meaning.
// 
// Behavioural memory:
//   falseConfidenceStreak — fast + wrong compounds
//   unresolvedQueue — prompts whose reveal was withheld, given back later when earned
// 
// Consequences are graded, not binary.
// Resolution is a privilege, not a given.
// ═══════════════════════════════════════════════════════════════

class ContentLayer {
  constructor() {
    this.queue = [];
    this.currentIndex = 0;
    this.currentItem = null;
    this.currentDirection = null;
    this.currentOptionOrder = null;
    
    // Behavioural memory
    this.falseConfidenceStreak = 0;
    this.unresolvedQueue = [];  // {item, direction, choiceType, aligned}
  }

  loadItems(items) {
    this.queue = [...items];
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.currentIndex = 0;
    this.falseConfidenceStreak = 0;
    this.unresolvedQueue = [];
  }

  getCurrentItem() {
    if (this.currentIndex >= this.queue.length) return null;
    return this.queue[this.currentIndex];
  }

  preparePrompt() {
    const item = this.getCurrentItem();
    if (!item) return null;
    
    this.currentItem = item;
    
    // ─── DIRECTION ───
    const conf = cognitiveState.confidence;
    const qCount = cognitiveState.questionCount;
    
    if (qCount < 2) {
      // Clean entry alternation
      this.currentDirection = qCount % 2 === 0 ? 'land' : 'ride';
    } else if (qCount > 10) {
      // Late-game phase shift: less predictable, more confrontational
      this.currentDirection = Math.random() > 0.5 ? 'land' : 'ride';
    } else {
      // Mid-game: friction + pressure ramp
      const pressure = Math.min(0.1, qCount * 0.01);
      const bias = (this.currentDirection === 'ride' ? 0.05 : -0.05) + pressure;
      if (conf + bias > 0.62) {
        this.currentDirection = 'ride';
      } else {
        this.currentDirection = 'land';
      }
    }
    
    // Randomise button positions (spatial randomness is fine)
    const optionsInOrder = Math.random() > 0.5
      ? ['past', 'perfect']
      : ['perfect', 'past'];
    this.currentOptionOrder = optionsInOrder;
    
    const buttons = optionsInOrder.map(type => ({
      type,
      label: type === 'past' ? item.verbPast : item.verbPerfect
    }));
    
    cognitiveState.beginPrompt();
    
    return {
      id: item.id,
      context: item.context || '',
      prompt: item.prompt,
      buttons: buttons
    };
  }

  // ─────────────────────────────────────
  // COMMIT — evaluate, judge, maybe withhold
  // ─────────────────────────────────────
  handleCommit(commitData) {
    const item = this.currentItem;
    if (!item) return;
    
    const choiceType = commitData.choice;
    const direction = this.currentDirection;
    const decisionTime = commitData.decisionTime;
    
    cognitiveState.commitChoice({
      decisionTime: decisionTime,
      commitType: commitData.commitType,
      choice: choiceType
    });
    
    const aligned = (direction === 'land' && choiceType === 'past')
                 || (direction === 'ride' && choiceType === 'perfect');
    
    // ─── BEHAVIOURAL MEMORY ───
    // Fast-wrong compounds. Aligned answers slowly forgive.
    const fast = decisionTime !== null && decisionTime < 800;
    if (!aligned && fast) {
      this.falseConfidenceStreak++;
    } else if (aligned) {
      this.falseConfidenceStreak *= 0.5;  // slow forgiveness
      if (this.falseConfidenceStreak < 0.3) this.falseConfidenceStreak = 0;
    }
    
    // Forward streaks to groove for lift/trust calculation
    if (typeof audio !== 'undefined' && audio.groove) {
      if (aligned) audio.groove.onAligned();
      else audio.groove.onMisaligned();
    }
    
    // ─── AUDIO TRIGGERS ───
    if (typeof audio !== 'undefined') {
      if (direction === 'land') {
        audio.land();
      } else {
        audio.ride();
      }
      
      if (!aligned) {
        setTimeout(() => audio.stumble(), 400);
      }
      
      // ─── GRADED RECKLESSNESS ───
      // Linear interpolation: 200ms wrong = catastrophic, 1200ms wrong = forgiven
      if (!aligned && decisionTime !== null) {
        const speedFactor = Math.max(0, 1 - decisionTime / 1200);
        if (speedFactor > 0 && audio.groove) {
          // Trust window softens the blow
          const buffer = audio.groove.trustWindow > 0 ? 0.5 : 1.0;
          audio.groove.integrity = Math.max(0, audio.groove.integrity - 0.15 * speedFactor * buffer);
          audio.groove.damage = Math.min(1, audio.groove.damage + 0.10 * speedFactor * buffer);
          if (audio.groove.trustWindow > 0) audio.groove.trustWindow--;
        }
      }
      
      // ─── FALSE CONFIDENCE COMPOUND ───
      // Repeated arrogance compounds into groove damage
      if (this.falseConfidenceStreak > 0 && audio.groove) {
        audio.groove.damage = Math.min(1, 
          audio.groove.damage + this.falseConfidenceStreak * 0.04);
      }
    }
    
    // ─── WITHHELD RESOLUTION ───
    // If the player is unstable or has shown false confidence twice,
    // they don't get the reveal. They get ambiguity they caused.
    const instab = cognitiveState.instability;
    const withhold = instab > 0.75 || this.falseConfidenceStreak >= 2;
    
    let revealText;
    if (withhold) {
      // Partial fragment — or silence
      const fragment = item.reveals[direction].split('. ')[0];
      revealText = fragment + '…';
      // Queue this for release when trust is restored
      this.unresolvedQueue.push({
        item, direction, choiceType, aligned,
        fullReveal: item.reveals[direction]
      });
    } else {
      revealText = item.reveals[direction];
    }
    
    return {
      revealText,
      withheld: withhold,
      aligned,
      direction,
      choiceType,
      correctForm: direction === 'land' ? item.verbPast : item.verbPerfect
    };
  }

  // ─────────────────────────────────────
  // CHECK FOR RESOLUTION RELEASE
  // When player stabilises, give back one withheld reveal
  // ─────────────────────────────────────
  checkResolutionRelease() {
    if (this.unresolvedQueue.length === 0) return null;
    const conf = cognitiveState.confidence;
    const instab = cognitiveState.instability;
    if (conf > 0.75 && instab < 0.3) {
      const item = this.unresolvedQueue.shift();
      return item;
    }
    return null;
  }

  finalizeAlignment(aligned) {
    cognitiveState.setAlignment(aligned ? 'aligned' : 'misaligned');
  }

  next() {
    this.currentIndex++;
    this.currentItem = null;
    this.currentDirection = null;
  }

  isComplete() {
    return this.currentIndex >= this.queue.length;
  }

  getProgress() {
    return {
      current: this.currentIndex,
      total: this.queue.length,
      pct: this.queue.length ? (this.currentIndex / this.queue.length) * 100 : 0
    };
  }

  reset() {
    this.currentIndex = 0;
    this.currentItem = null;
    this.currentDirection = null;
    this.falseConfidenceStreak = 0;
    this.unresolvedQueue = [];
  }
}

const contentLayer = new ContentLayer();
