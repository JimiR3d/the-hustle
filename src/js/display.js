import { gameStateStore } from './state.js';

// Auto-scaling 1920x1080 stage fitting
function fitStageToWindow() {
  const stage = document.getElementById('app-stage');
  if (!stage) return;
  const targetWidth = 1920;
  const targetHeight = 1080;
  const scaleX = window.innerWidth / targetWidth;
  const scaleY = window.innerHeight / targetHeight;
  const scale = Math.min(scaleX, scaleY);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

window.addEventListener('resize', fitStageToWindow);
window.addEventListener('DOMContentLoaded', fitStageToWindow);

let previousScores = {};
let activeAnimationIds = new Set();
let completedDisqualifiedIds = new Set();
let hasFiredZeroFlash = false;

// Synthesize Spy Game Show Countdown Finish Alarm Sound via Web Audio API
function playZeroBuzzerSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.7, now);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    masterGain.connect(ctx.destination);

    // Sawtooth Low Brass Impact
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(90, now);
    osc1.frequency.exponentialRampToValueAtTime(45, now + 1.5);
    osc1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 1.8);

    // Square Wave Spy Beep Sequence
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(440, now);
    osc2.frequency.setValueAtTime(880, now + 0.15);
    osc2.frequency.setValueAtTime(440, now + 0.3);
    osc2.frequency.setValueAtTime(880, now + 0.45);
    osc2.connect(masterGain);
    osc2.start(now);
    osc2.stop(now + 1.8);
  } catch (err) {
    console.warn('Web Audio synthesis unavailable:', err);
  }
}

function renderDisplay(state, meta = {}) {
  const stage = document.getElementById('app-stage');
  const topRow = document.getElementById('groups-row-top');
  const bottomRow = document.getElementById('groups-row-bottom');
  const timerBadge = document.getElementById('hud-timer-badge');
  const groupsContainer = document.getElementById('groups-stage-container');

  if (!topRow || !bottomRow) return;

  // 1. Sync completed disqualified set with state FIRST (handles reset/restore)
  state.groups.forEach(g => {
    if (!g.isDisqualified) {
      completedDisqualifiedIds.delete(g.id);
      activeAnimationIds.delete(g.id);
    }
  });

  // 2. Active groups exclude completed disqualified teams AND in-flight animation teams
  const activeGroups = state.groups.filter(g => !g.isDisqualified && !completedDisqualifiedIds.has(g.id));
  const disqualifiedGroups = state.groups.filter(g => g.isDisqualified || completedDisqualifiedIds.has(g.id));

  // Render bottom-right mini-slots with completed disqualified teams
  renderDisqualifiedStack(disqualifiedGroups.filter(g => completedDisqualifiedIds.has(g.id)));

  // Clear obsolete elements from top & bottom rows ONLY if not animating or pending DQ animation
  const activeIds = new Set(activeGroups.map(g => g.id));
  const pendingDqIds = new Set(disqualifiedGroups.filter(g => g.isDisqualified && !completedDisqualifiedIds.has(g.id)).map(g => g.id));

  [topRow, bottomRow].forEach(row => {
    Array.from(row.children).forEach(child => {
      const id = child.id.replace('group-wrap-', '');
      if (!activeIds.has(id) && !activeAnimationIds.has(id) && !pendingDqIds.has(id)) {
        child.remove();
      }
    });
  });

  // Distribute active groups dynamically (up to 3 in top row, remaining in bottom row)
  const topActive = activeGroups.slice(0, 3);

  activeGroups.forEach((group) => {
    const isTopRow = topActive.some(g => g.id === group.id);
    const parentRow = isTopRow ? topRow : bottomRow;

    let groupWrapper = document.getElementById(`group-wrap-${group.id}`);

    const prevScore = previousScores[group.id];
    const scoreDelta = prevScore !== undefined ? group.points - prevScore : 0;
    const isScoreChanged = scoreDelta !== 0;

    previousScores[group.id] = group.points;

    const teamNum = group.id.replace('group-', '');
    if (!groupWrapper) {
      groupWrapper = document.createElement('div');
      groupWrapper.id = `group-wrap-${group.id}`;
      groupWrapper.className = `group-panel-wrapper active-group team-${teamNum}`;
      parentRow.appendChild(groupWrapper);
    } else if (groupWrapper.parentElement !== parentRow && !activeAnimationIds.has(group.id)) {
      parentRow.appendChild(groupWrapper);
    }

    groupWrapper.classList.add(`team-${teamNum}`);
    groupWrapper.classList.toggle('is-popup', Boolean(group.isPopUp));
    groupWrapper.classList.toggle('active-group', true);
    groupWrapper.classList.remove('phase1-breaking', 'phase2-tearing', 'phase3-flight');

    const renderPlayerCard = (player, slotClass) => `
      <div class="player-card-slot ${slotClass}">
        <div class="card-white-light-reflection" aria-hidden="true"></div>
        <div class="card-half card-half-left">
          <img src="${player.image}" alt="${escapeHtml(player.name)}" class="player-card-img" />
        </div>
        <div class="card-half card-half-right">
          <img src="${player.image}" alt="${escapeHtml(player.name)}" class="player-card-img" />
        </div>
      </div>
    `;

    const innerHTML = `
      <svg class="moving-border-svg" viewBox="0 0 430 340" preserveAspectRatio="none" aria-hidden="true">
        <rect class="moving-border-track" x="4" y="4" width="422" height="332" rx="28" ry="28" />
        <rect class="moving-border-line" x="4" y="4" width="422" height="332" rx="28" ry="28" />
      </svg>
      <div class="group-panel-container" id="group-container-${group.id}">
        ${renderPlayerCard(group.player1, 'slot-p1')}
        ${renderPlayerCard(group.player2, 'slot-p2')}

        <div class="group-score-pill" id="group-score-pill-${group.id}">
          <span class="group-name-text">${escapeHtml(group.name)}</span>
          <span class="score-led-value" id="score-led-${group.id}">${group.points}</span>
        </div>
      </div>
    `;

    const structureKey = `${group.name}_${group.player1.name}_${group.player2.name}_${group.isPopUp}`;
    if (groupWrapper.dataset.renderedStructure !== structureKey) {
      groupWrapper.innerHTML = innerHTML;
      groupWrapper.dataset.renderedStructure = structureKey;
    }

    const scoreLed = document.getElementById(`score-led-${group.id}`);
    if (scoreLed && scoreLed.textContent !== String(group.points)) {
      scoreLed.textContent = group.points;
    }

    if (isScoreChanged) {
      triggerPointAnimation(group.id, scoreDelta);
    }
  });

  // Handle Cinematic 3-Phase Disqualification Live Motion (2.8s Total)
  state.groups.forEach((group) => {
    if (!group.isDisqualified) return;

    // If already fully completed or currently animating, do not restart
    if (completedDisqualifiedIds.has(group.id) || activeAnimationIds.has(group.id)) {
      return;
    }

    let groupWrapper = document.getElementById(`group-wrap-${group.id}`);
    if (!groupWrapper) return;

    activeAnimationIds.add(group.id);

    // Calculate dynamic flight vector (--target-x, --target-y)
    const currentCompleted = Array.from(completedDisqualifiedIds);
    const targetIndex = currentCompleted.length;
    const targetSlot = document.getElementById(`dq-slot-${targetIndex < 5 ? targetIndex : 4}`);

    if (targetSlot) {
      const wrapRect = groupWrapper.getBoundingClientRect();
      const slotRect = targetSlot.getBoundingClientRect();
      const deltaX = slotRect.left - wrapRect.left;
      const deltaY = slotRect.top - wrapRect.top;

      groupWrapper.style.setProperty('--target-x', `${deltaX}px`);
      groupWrapper.style.setProperty('--target-y', `${deltaY}px`);
    }

    // Phase 1: Neon Red Flash Aura (0.6s)
    groupWrapper.classList.add('phase1-breaking');

    setTimeout(() => {
      // Phase 2: Slow Smooth Diagonal Card Tear Cut in Place (1.0s)
      if (groupWrapper) {
        groupWrapper.classList.remove('phase1-breaking');
        groupWrapper.classList.add('phase2-tearing');
      }

      setTimeout(() => {
        // Phase 3: Apple Genie Curved Flight Arc to Bottom Right (1.2s)
        if (groupWrapper) {
          groupWrapper.classList.remove('phase2-tearing');
          groupWrapper.classList.add('phase3-flight');
        }

        setTimeout(() => {
          // Sequence complete: Move into completed stack
          if (groupWrapper && groupWrapper.parentElement) {
            groupWrapper.remove();
          }
          activeAnimationIds.delete(group.id);
          completedDisqualifiedIds.add(group.id);

          renderDisplay(gameStateStore.getState());
        }, 1200);

      }, 1000);

    }, 600);
  });

  // Handle Timer Zoom Dynamics
  const isExpanded = Boolean(state.timer.isExpanded || state.timer.isRunning);
  if (timerBadge) timerBadge.classList.toggle('timer-expanded', isExpanded);
  if (groupsContainer) groupsContainer.classList.toggle('timer-shifted', isExpanded);

  // Trigger full-page green flash & Web Audio buzzer when timer hits 0
  if (state.timer.seconds === 0 && !hasFiredZeroFlash) {
    hasFiredZeroFlash = true;
    playZeroBuzzerSound();
    if (stage) {
      stage.classList.remove('timer-finished-flash');
      void stage.offsetWidth;
      stage.classList.add('timer-finished-flash');
      setTimeout(() => stage.classList.remove('timer-finished-flash'), 2600);
    }
  } else if (state.timer.seconds > 0) {
    hasFiredZeroFlash = false;
  }

  renderTimer(state.timer);
}

function renderDisqualifiedStack(disqualifiedGroups) {
  for (let i = 0; i < 5; i++) {
    const slot = document.getElementById(`dq-slot-${i}`);
    if (!slot) continue;
    const dqGroup = disqualifiedGroups[i];

    if (dqGroup) {
      slot.classList.add('occupied');
      slot.innerHTML = `
        <div class="mini-card-pair-wrapper">
          <div class="mini-card-half left">
            <img src="${dqGroup.player1.image}" alt="${escapeHtml(dqGroup.player1.name)}" class="mini-player-img" />
          </div>
          <div class="mini-card-half right">
            <img src="${dqGroup.player2.image}" alt="${escapeHtml(dqGroup.player2.name)}" class="mini-player-img" />
          </div>
          <div class="mini-card-tear-line"></div>
          <span class="mini-dq-team-name">${escapeHtml(dqGroup.name)}</span>
        </div>
      `;
    } else {
      slot.classList.remove('occupied');
      slot.innerHTML = '';
    }
  }
}

function triggerPointAnimation(groupId, delta) {
  const container = document.getElementById(`group-container-${groupId}`);
  const scorePill = document.getElementById(`group-score-pill-${groupId}`);

  if (container) {
    const popup = document.createElement('div');
    const isPositive = delta > 0;
    popup.className = `score-delta-popup ${isPositive ? 'positive' : 'negative'}`;
    popup.textContent = isPositive ? `+${delta}` : `${delta}`;
    container.appendChild(popup);

    setTimeout(() => {
      popup.remove();
    }, 1300);
  }

  if (scorePill) {
    const pulseClass = delta > 0 ? 'pulse-green' : 'pulse-red';
    scorePill.classList.remove('pulse-green', 'pulse-red');
    void scorePill.offsetWidth;
    scorePill.classList.add(pulseClass);
    setTimeout(() => {
      scorePill.classList.remove('pulse-green', 'pulse-red');
    }, 1200);
  }
}

function renderTimer(timerState) {
  const clockEl = document.getElementById('hud-clock');
  if (!clockEl) return;
  const mins = String(Math.floor(timerState.seconds / 60)).padStart(2, '0');
  const secs = String(timerState.seconds % 60).padStart(2, '0');
  clockEl.textContent = `${mins}:${secs}`;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[m]));
}

// Robust Multi-Window Timer Interval Loop
let timerInterval = null;

function syncTimerLoop(timerState) {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  if (timerState && timerState.isRunning && timerState.seconds > 0) {
    timerInterval = setInterval(() => {
      const state = gameStateStore.getState();
      if (state.timer.isRunning && state.timer.seconds > 0) {
        gameStateStore.tickTimer();
      } else {
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
      }
    }, 1000);
  }
}

// Initialize Display
fitStageToWindow();
renderDisplay(gameStateStore.getState());
syncTimerLoop(gameStateStore.getState().timer);

// Ensure syncTimerLoop is called on EVERY state update
gameStateStore.onStateChange((state, meta) => {
  renderDisplay(state, meta);
  syncTimerLoop(state.timer);
});
