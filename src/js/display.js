import { gameStateStore } from './state.js';
import { liquidMetalFragmentShader, ShaderMount } from '@paper-design/shaders';
import { initParallax } from './parallax.js';
import gsap from 'gsap';

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
window.addEventListener('DOMContentLoaded', () => {
  fitStageToWindow();
  initParallax();
  document.getElementById('scroll-to-arena-btn')?.addEventListener('click', () => {
    gameStateStore.enterArena();
  });
});

function focusArena() {
  window.dispatchEvent(new CustomEvent('hustle-scroll-arena'));
}

function focusMainMenu() {
  window.dispatchEvent(new CustomEvent('hustle-scroll-main-menu'));
}

let previousScores = {};
let previousLeaderboardRanks = new Map();
let leaderboardMovementState = new Map();
let previousLeaderboardVisible = false;
let previousWinnerGroupId = null;
let previousArenaFocusNonce = gameStateStore.getState().arenaFocusNonce || 0;
let previousMainMenuFocusNonce = gameStateStore.getState().mainMenuFocusNonce || 0;
let previousCardsDealt = Boolean(gameStateStore.getState().arenaSetup?.cardsDealt);
let previousRosterCompleteNonce = gameStateStore.getState().arenaSetup?.rosterCompleteNonce || 0;
let rosterCelebrationTimer = null;
let dealStartTimer = null;
let activeDealTimeline = null;
const revealedPlayerSlots = new Set(
  gameStateStore.getState().groups.flatMap((group) => [
    group.player1?.isRevealed ? `${group.id}:player1` : null,
    group.player2?.isRevealed ? `${group.id}:player2` : null,
  ]).filter(Boolean),
);
let previousPresentationCueNonce = gameStateStore.getState().presentationCue?.nonce || 0;
let previousQuestionPromptNonce = gameStateStore.getState().questionPromptCard?.nonce || 0;
let activeAnimationIds = new Set();
let animatingSpotlightIds = new Set();
let completedDisqualifiedIds = new Set();
let timesUpTriggerCount = 0;
let timesUpTriggeredForCurrentRun = false;
let previousTimerSeconds = null;
let lastAudibleTimerTick = '';
let showSfxContext = null;
let leaderboardUpdateTimer = null;
let pendingAnimationSfxTimers = [];
let hasLeaderboardSnapshot = false;
let previousSpotlightIds = new Set(
  gameStateStore.getState().groups.filter((group) => group.isPopUp).map((group) => group.id)
);

const timesUpAudio = new Audio('/assets/Time_up.mp3');
timesUpAudio.preload = 'auto';
timesUpAudio.volume = 1.0;

function stopAllAudio() {
  try {
    timesUpAudio.pause();
    timesUpAudio.currentTime = 0;
  } catch (e) {}
}

['click', 'touchstart', 'mousedown', 'keydown'].forEach((evt) => {
  window.addEventListener(evt, () => getShowSfxContext(), { passive: true, once: true });
});

if (!window.shaderMounts) window.shaderMounts = new Map();

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

function animateLayoutFlip(updateDomCallback) {
  // Only measure and animate non-spotlighted active groups to avoid fighting with Spotlight mode
  const activeEls = Array.from(document.querySelectorAll('.group-panel-wrapper:not(.phase3-flight):not(.is-popup):not(.is-winner-group)'));
  const firstPositions = new Map();

  activeEls.forEach((el) => {
    firstPositions.set(el.id, el.getBoundingClientRect());
  });

  if (typeof updateDomCallback === 'function') {
    updateDomCallback();
  }

  requestAnimationFrame(() => {
    activeEls.forEach((el) => {
      const firstRect = firstPositions.get(el.id);
      if (!firstRect || !el.parentElement) return;

      const lastRect = el.getBoundingClientRect();
      const deltaX = firstRect.left - lastRect.left;
      const deltaY = firstRect.top - lastRect.top;

      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        // Invert: snap immediately to starting position without animation
        el.style.transition = 'none';
        el.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0px)`;

        // Force browser style recalculation
        void el.offsetWidth;

        // Play: animate smoothly with eased curve into the new position
        el.style.transition = 'transform 0.85s cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = 'translate3d(0px, 0px, 0px)';
      }
    });
  });
}

const HOME_COORDINATES = {
  'group-1': { x: 465, y: 330 },
  'group-2': { x: 960, y: 330 },
  'group-3': { x: 1455, y: 330 },
  'group-4': { x: 712.5, y: 710 },
  'group-5': { x: 1207.5, y: 710 }
};

function getGroupHomeCoordinates(groupId, state) {
  if (!state || !state.groups) {
    return HOME_COORDINATES[groupId] || { x: 960, y: 330 };
  }

  const active = state.groups.filter(g => !completedDisqualifiedIds.has(g.id));
  const isTopRow = groupId === 'group-1' || groupId === 'group-2' || groupId === 'group-3';
  const rowGroups = active.filter(g => {
    const top = g.id === 'group-1' || g.id === 'group-2' || g.id === 'group-3';
    return isTopRow ? top : !top;
  });

  const count = rowGroups.length;
  const index = rowGroups.findIndex(g => g.id === groupId);
  const y = isTopRow ? 330 : 710;

  if (index === -1 || count === 0) {
    return HOME_COORDINATES[groupId] || { x: 960, y };
  }

  const cardW = 430;
  const gap = 65;
  const totalWidth = count * cardW + (count - 1) * gap;
  const startX = (1920 - totalWidth) / 2;
  const x = startX + index * (cardW + gap) + cardW / 2;

  return { x, y };
}

// Continuous Coin Rain Celebration Engine
let coinRainInterval = null;
const COIN_TYPES = [
  { src: '/assets/coins/Coin3.png', minSize: 52, maxSize: 84 }, // 60% probability (Dominant 100% prominence)
  { src: '/assets/coins/Coin1.png', minSize: 36, maxSize: 60 }, // 20% probability (40% prominence)
  { src: '/assets/coins/Coin2.png', minSize: 36, maxSize: 60 }, // 20% probability (40% prominence)
];

function spawnSingleCelebrationCoin(container) {
  if (!container) return;
  const rand = Math.random();
  const coinData = rand < 0.60 ? COIN_TYPES[0] : rand < 0.80 ? COIN_TYPES[1] : COIN_TYPES[2];

  const coin = document.createElement('img');
  coin.src = coinData.src;
  coin.className = 'celebration-coin';

  const size = coinData.minSize + Math.random() * (coinData.maxSize - coinData.minSize);
  coin.style.width = `${Math.round(size)}px`;
  coin.style.height = 'auto';

  // Layer depth: 55% in front of cards (z-index 80), 25% in front of logo (z-index 85), 20% behind cards (z-index 55)
  const zRand = Math.random();
  coin.style.zIndex = zRand < 0.55 ? 80 : zRand < 0.80 ? 85 : 55;

  const startX = Math.random() * window.innerWidth;
  const startRotation = Math.random() * 360;
  const fallDuration = 2.2 + Math.random() * 2.2;
  const driftX = (Math.random() - 0.5) * 140;
  const spinZ = (Math.random() - 0.5) * 720;
  const spinY = (Math.random() - 0.5) * 720;

  container.appendChild(coin);

  gsap.fromTo(coin, {
    x: startX,
    y: -size - 20,
    rotation: startRotation,
    rotationY: 0,
    opacity: 0.9 + Math.random() * 0.1,
  }, {
    y: window.innerHeight + size + 50,
    x: startX + driftX,
    rotation: startRotation + spinZ,
    rotationY: spinY,
    duration: fallDuration,
    ease: 'none',
    onComplete: () => {
      coin.remove();
    }
  });
}

function startCoinRain() {
  if (coinRainInterval) return;
  let container = document.getElementById('winner-coin-rain');
  if (!container) {
    container = document.createElement('div');
    container.className = 'winner-coin-rain-container';
    container.id = 'winner-coin-rain';
    document.body.appendChild(container);
  }
  container.style.opacity = '1';

  // Initial burst
  for (let i = 0; i < 14; i++) {
    setTimeout(() => spawnSingleCelebrationCoin(container), i * 50);
  }

  coinRainInterval = setInterval(() => {
    const count = 1 + Math.floor(Math.random() * 3);
    for (let c = 0; c < count; c++) {
      spawnSingleCelebrationCoin(container);
    }
  }, 150);
}

function stopCoinRain() {
  if (coinRainInterval) {
    clearInterval(coinRainInterval);
    coinRainInterval = null;
  }
  const container = document.getElementById('winner-coin-rain');
  if (container) {
    gsap.to(container, {
      opacity: 0,
      duration: 0.5,
      onComplete: () => {
        container.remove();
      }
    });
  }
}

function getSpotlightTransform(groupId, spotlightedGroups, winnerGroupId, state) {
  const home = getGroupHomeCoordinates(groupId, state);

  // Winner Priority Transform (Centering winning player cards at scale 1.50)
  if (winnerGroupId) {
    if (winnerGroupId === groupId) {
      return {
        tx: 960 - home.x,
        ty: 460 - home.y,
        scale: 1.50
      };
    }
    return { tx: 0, ty: 0, scale: 1 };
  }

  const count = Math.min(spotlightedGroups.length, 3);
  const index = spotlightedGroups.findIndex(g => g.id === groupId);
  if (index === -1) {
    return { tx: 0, ty: 0, scale: 1 };
  }

  let targetX = 960;
  let targetY = 345;
  let scale = 1.20;

  if (count === 1) {
    targetX = 960;
    targetY = 345;
    scale = 1.20;
  } else if (count === 2) {
    targetX = index === 0 ? 690 : 1230;
    targetY = 345;
    scale = 1.10;
  } else if (count === 3) {
    targetX = index === 0 ? 465 : index === 1 ? 960 : 1455;
    targetY = 345;
    scale = 1.02;
  }

  return {
    tx: targetX - home.x,
    ty: targetY - home.y,
    scale
  };
}

function getShowSfxContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!showSfxContext || showSfxContext.state === 'closed') {
    showSfxContext = new AudioContextClass();
  }
  if (showSfxContext.state === 'suspended') {
    showSfxContext.resume().catch(() => {});
  }
  return showSfxContext;
}

function playScoreSfx(kind) {
  try {
    const ctx = getShowSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(kind === 'eliminated' ? 0.24 : 0.13, now + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'eliminated' ? 0.72 : 0.34));
    master.connect(ctx.destination);

    if (kind === 'added') {
      [0, 0.09].forEach((delay, index) => {
        const note = ctx.createOscillator();
        note.type = index === 0 ? 'sine' : 'triangle';
        note.frequency.setValueAtTime(index === 0 ? 660 : 990, now + delay);
        note.connect(master);
        note.start(now + delay);
        note.stop(now + 0.3);
      });
    } else if (kind === 'deducted') {
      const note = ctx.createOscillator();
      note.type = 'triangle';
      note.frequency.setValueAtTime(440, now);
      note.frequency.exponentialRampToValueAtTime(165, now + 0.3);
      note.connect(master);
      note.start(now);
      note.stop(now + 0.34);
    } else {
      const impact = ctx.createOscillator();
      impact.type = 'sawtooth';
      impact.frequency.setValueAtTime(150, now);
      impact.frequency.exponentialRampToValueAtTime(42, now + 0.68);
      impact.connect(master);
      impact.start(now);
      impact.stop(now + 0.72);

      const alarm = ctx.createOscillator();
      alarm.type = 'square';
      alarm.frequency.setValueAtTime(310, now);
      alarm.frequency.setValueAtTime(235, now + 0.16);
      alarm.frequency.setValueAtTime(170, now + 0.32);
      alarm.connect(master);
      alarm.start(now);
      alarm.stop(now + 0.54);
    }
  } catch (err) {
    console.warn('[Display Audio] Show sound unavailable:', err);
  }
}

function playTimerTick(seconds) {
  try {
    const ctx = getShowSfxContext();
    if (!ctx || !seconds) return;
    const now = ctx.currentTime;
    const beats = seconds > 30 ? 1 : seconds > 20 ? 2 : seconds > 10 ? 3 : 4;
    const spacing = 0.82 / beats;
    for (let index = 0; index < beats; index += 1) {
      const at = now + index * spacing;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(seconds <= 10 ? 1120 : 820, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.11 : 0.055, at + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.08);
    }
  } catch (err) {
    console.warn('[Display Audio] Timer tick unavailable:', err);
  }
}

function playSpotlightSfx(spotlightCount = 1) {
  try {
    const ctx = getShowSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const pitchMultiplier = 1 + (Math.max(1, Math.min(3, spotlightCount)) - 1) * 0.22;
    [330, 495, 740].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = now + index * 0.07;
      osc.type = index === 2 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(frequency * pitchMultiplier, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.36);
    });
  } catch (err) {
    console.warn('[Display Audio] Spotlight cue unavailable:', err);
  }
}

function playPresentationCueSfx(cue) {
  try {
    const ctx = getShowSfxContext();
    if (!ctx || !cue) return;
    const now = ctx.currentTime;
    const label = String(cue.label || '').toUpperCase();
    let notes;
    let waveform = 'triangle';

    if (cue.kind === 'round') {
      const roundNumber = Number(label.match(/\d+/)?.[0]) || 1;
      const base = 294 * (1 + (roundNumber - 1) * 0.08);
      notes = [base, base * 1.26, base * 1.5];
    } else if (label === 'MATCH') {
      notes = [440, 554, 659, 880];
    } else {
      notes = [392, 311, 233, 175];
      waveform = 'sawtooth';
    }

    notes.forEach((frequency, index) => {
      const at = now + index * (cue.kind === 'round' ? 0.13 : 0.1);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = waveform;
      osc.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(cue.kind === 'round' ? 0.12 : 0.1, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.3);
    });
  } catch (err) {
    console.warn('[Display Audio] Presentation cue unavailable:', err);
  }
}

function playCardFlipSfx(direction = 'in') {
  try {
    const ctx = getShowSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(direction === 'in' ? 180 : 260, now);
    snap.frequency.exponentialRampToValueAtTime(direction === 'in' ? 520 : 120, now + 0.12);
    snapGain.gain.setValueAtTime(0.0001, now);
    snapGain.gain.exponentialRampToValueAtTime(0.12, now + 0.025);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
    snap.connect(snapGain);
    snapGain.connect(ctx.destination);
    snap.start(now);
    snap.stop(now + 0.18);
  } catch (err) {
    console.warn('[Display Audio] Card flip cue unavailable:', err);
  }
}

function playLeaderboardUpdateSfx() {
  try {
    const ctx = getShowSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523, 659, 784, 1047].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = now + index * 0.11;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.1, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.22);
    });
  } catch (err) {
    console.warn('[Display Audio] Leaderboard cue unavailable:', err);
  }
}

function playAnimationSfx(kind, step = 0) {
  try {
    const ctx = getShowSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const tone = (frequency, start, duration, volume = 0.08, type = 'triangle', endFrequency = frequency) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, frequency), start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.018, duration * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    };

    if (kind === 'deal') {
      const pitch = 245 + Math.min(step, 9) * 18;
      tone(pitch, now, 0.1, 0.065, 'triangle', pitch * 1.35);
      tone(90, now, 0.075, 0.035, 'sine', 55);
    } else if (kind === 'scoreboard-pop') {
      const pitch = 310 + Math.min(step, 4) * 36;
      tone(82, now, 0.2, 0.07, 'sine', 48);
      tone(pitch, now + 0.025, 0.22, 0.075, 'triangle', pitch * 1.5);
    } else if (kind === 'leaderboard-in') {
      [220, 330, 494].forEach((frequency, index) => tone(frequency, now + index * 0.075, 0.34, 0.075, 'triangle', frequency * 1.32));
    } else if (kind === 'leaderboard-out') {
      [494, 330, 220].forEach((frequency, index) => tone(frequency, now + index * 0.055, 0.24, 0.055, 'sine', frequency * 0.72));
    } else if (kind === 'winner-in') {
      [392, 523, 659, 784, 1047].forEach((frequency, index) => tone(frequency, now + index * 0.105, 0.48, 0.1, index < 2 ? 'triangle' : 'sine', frequency * 1.03));
      tone(98, now, 0.85, 0.12, 'sine', 55);
    } else if (kind === 'winner-out') {
      [659, 494, 330].forEach((frequency, index) => tone(frequency, now + index * 0.075, 0.3, 0.06, 'triangle', frequency * 0.68));
    } else if (kind === 'scene-down') {
      tone(180, now, 0.62, 0.065, 'sine', 520);
      tone(70, now + 0.08, 0.52, 0.055, 'triangle', 150);
    } else if (kind === 'scene-up') {
      tone(520, now, 0.58, 0.06, 'sine', 180);
      tone(150, now + 0.06, 0.46, 0.045, 'triangle', 70);
    }
  } catch (err) {
    console.warn('[Display Audio] Animation cue unavailable:', err);
  }
}

function scheduleAnimationSfx(kind, step, delayMs) {
  const timerId = setTimeout(() => {
    pendingAnimationSfxTimers = pendingAnimationSfxTimers.filter((id) => id !== timerId);
    playAnimationSfx(kind, step);
  }, delayMs);
  pendingAnimationSfxTimers.push(timerId);
}

function clearPendingAnimationSfx() {
  pendingAnimationSfxTimers.forEach((timerId) => clearTimeout(timerId));
  pendingAnimationSfxTimers = [];
}

function getRankedGroups(groups) {
  const sortedGroups = [...groups].sort((a, b) => {
    if (a.isDisqualified !== b.isDisqualified) return a.isDisqualified ? 1 : -1;
    if (b.points !== a.points) return b.points - a.points;
    return a.id.localeCompare(b.id);
  });

  let previousPoints = null;
  let previousRank = 0;
  let eligibleIndex = 0;

  return sortedGroups.map((group) => {
    if (group.isDisqualified) return { group, rank: null };
    eligibleIndex += 1;
    if (group.points !== previousPoints) {
      previousRank = eligibleIndex;
      previousPoints = group.points;
    }
    return { group, rank: previousRank };
  });
}

function animateLeaderboardSwaps(list, previousOrder, nextOrder) {
  if (previousOrder.length !== nextOrder.length || previousOrder.some((id) => !nextOrder.includes(id))) return;

  const rows = new Map(
    [...list.querySelectorAll('.leaderboard-row')].map((row) => [row.dataset.groupId, row])
  );
  const finalIndexes = new Map(nextOrder.map((id, index) => [id, index]));
  const simulatedOrder = [...previousOrder];

  previousOrder.forEach((id, oldIndex) => {
    const row = rows.get(id);
    const finalIndex = finalIndexes.get(id);
    if (row && finalIndex != null) {
      gsap.set(row, { y: (oldIndex - finalIndex) * 112, scale: 1, zIndex: 1 });
    }
  });

  const timeline = gsap.timeline();
  let swapStep = 0;

  nextOrder.forEach((targetId, targetIndex) => {
    let currentIndex = simulatedOrder.indexOf(targetId);
    while (currentIndex > targetIndex) {
      const movingUpId = simulatedOrder[currentIndex];
      const movingDownId = simulatedOrder[currentIndex - 1];
      const movingUpRow = rows.get(movingUpId);
      const movingDownRow = rows.get(movingDownId);
      const startAt = swapStep * 0.62;

      [simulatedOrder[currentIndex - 1], simulatedOrder[currentIndex]] =
        [simulatedOrder[currentIndex], simulatedOrder[currentIndex - 1]];

      if (movingUpRow && movingDownRow) {
        timeline
          .to(movingUpRow, {
            y: ((currentIndex - 1) - finalIndexes.get(movingUpId)) * 112,
            scale: 1.025,
            zIndex: 10,
            duration: 0.54,
            ease: 'power2.inOut',
          }, startAt)
          .to(movingDownRow, {
            y: (currentIndex - finalIndexes.get(movingDownId)) * 112,
            scale: 0.985,
            zIndex: 8,
            duration: 0.54,
            ease: 'power2.inOut',
          }, startAt)
          .to([movingUpRow, movingDownRow], {
            scale: 1,
            zIndex: 1,
            duration: 0.12,
            ease: 'power1.out',
          }, startAt + 0.5);
      }

      currentIndex -= 1;
      swapStep += 1;
    }
  });
}

function renderLeaderboard(state, meta = {}) {
  const overlay = document.getElementById('leaderboard-overlay');
  const viewportBackdrop = document.getElementById('leaderboard-viewport-backdrop');
  const list = document.getElementById('leaderboard-list');
  const title = document.getElementById('leaderboard-title');
  const isVisible = Boolean(state.leaderboard?.isVisible && !state.winnerGroupId);

  if (!overlay || !list) return;

  overlay.classList.toggle('active', isVisible);
  if (viewportBackdrop) viewportBackdrop.classList.toggle('active', isVisible);
  overlay.setAttribute('aria-hidden', String(!isVisible));
  if (title) title.textContent = state.leaderboard?.title || 'CURRENT STANDINGS';
  // The hidden board keeps its last on-air snapshot. Rankings and movement are
  // recalculated only while the leaderboard is actually being shown.
  if (!isVisible) {
    if (leaderboardUpdateTimer) {
      clearTimeout(leaderboardUpdateTimer);
      leaderboardUpdateTimer = null;
    }
    if (hasLeaderboardSnapshot) return;
  }

  // Show the previous standings first, then reveal every score accumulated
  // during gameplay two seconds after the leaderboard is called on air.
  if (isVisible && meta.eventType === 'leaderboard_show') {
    if (leaderboardUpdateTimer) clearTimeout(leaderboardUpdateTimer);
    leaderboardUpdateTimer = setTimeout(() => {
      leaderboardUpdateTimer = null;
      renderLeaderboard(gameStateStore.getState(), { eventType: 'leaderboard_delayed_reveal' });
    }, 2000);
    return;
  }

  // Scores are recorded on the game board while the leaderboard retains its
  // last snapshot. They are picked up by the next delayed reveal above.
  if (meta.eventType === 'points_update') return;

  const nextRanks = new Map();
  const previousOrder = [...previousLeaderboardRanks.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);
  const rankedGroups = getRankedGroups(state.groups);
  list.innerHTML = '';

  rankedGroups.forEach(({ group, rank }, index) => {
    nextRanks.set(group.id, index);
    const previousIndex = previousLeaderboardRanks.get(group.id);
    const movement = previousIndex == null ? 0 : previousIndex - index;
    if (movement !== 0) {
      const expiresAt = Date.now() + 5200;
      leaderboardMovementState.set(group.id, { movement, expiresAt });
      setTimeout(() => {
        const currentMovement = leaderboardMovementState.get(group.id);
        if (currentMovement && currentMovement.expiresAt <= Date.now()) {
          leaderboardMovementState.delete(group.id);
          renderLeaderboard(gameStateStore.getState(), { eventType: 'leaderboard_movement_expire' });
        }
      }, 5250);
    }
    const movementRecord = leaderboardMovementState.get(group.id);
    const displayedMovement = movementRecord && movementRecord.expiresAt > Date.now() ? movementRecord.movement : 0;
    const isScoreEvent = meta.eventType === 'leaderboard_delayed_reveal';
    const row = document.createElement('article');

    row.className = `leaderboard-row ${group.isDisqualified ? 'is-disqualified' : ''} ${rank === 1 ? 'is-first' : ''}`;
    row.dataset.groupId = group.id;
    row.innerHTML = `
      <div class="leaderboard-rank">${group.isDisqualified ? 'DQ' : rank}</div>
      <div class="leaderboard-portraits" aria-hidden="true">
        <img src="${group.player1.image}" alt="" />
        <img src="${group.player2.image}" alt="" />
      </div>
      <div class="leaderboard-team">
        <span class="leaderboard-team-name">${escapeHtml(group.name)}</span>
        <span class="leaderboard-player-names">${escapeHtml(group.player1.name)} &amp; ${escapeHtml(group.player2.name)}</span>
      </div>
      <div class="leaderboard-movement ${displayedMovement > 0 ? 'up' : displayedMovement < 0 ? 'down' : ''}">
        ${displayedMovement > 0 ? `&#9650; ${displayedMovement}` : displayedMovement < 0 ? `&#9660; ${Math.abs(displayedMovement)}` : '&mdash;'}
      </div>
      <div class="leaderboard-points ${isScoreEvent ? 'is-changing' : ''}">
        <strong>${group.points}</strong><span>PTS</span>
      </div>
    `;
    list.appendChild(row);

    if (previousIndex == null) {
      gsap.fromTo(row, { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, delay: index * 0.07, ease: 'power3.out' });
    }
  });

  if (meta.eventType === 'leaderboard_delayed_reveal') {
    playLeaderboardUpdateSfx();
    animateLeaderboardSwaps(list, previousOrder, rankedGroups.map(({ group }) => group.id));
  }

  previousLeaderboardRanks = nextRanks;
  hasLeaderboardSnapshot = true;
}

function renderDisplay(state, meta = {}) {
  const stage = document.getElementById('app-stage');
  const topRow = document.getElementById('groups-row-top');
  const bottomRow = document.getElementById('groups-row-bottom');
  const timerBadge = document.getElementById('hud-timer-badge');

  if (!topRow || !bottomRow) return;

  const cardsDealt = Boolean(state.arenaSetup?.cardsDealt);
  const rosterCompleteNonce = state.arenaSetup?.rosterCompleteNonce || 0;
  const shouldCelebrateRoster = rosterCompleteNonce > previousRosterCompleteNonce;
  previousRosterCompleteNonce = rosterCompleteNonce;
  if (stage) {
    stage.classList.toggle('cards-not-dealt', !cardsDealt);
  }

  // Handle Full Reset Action
  if (meta && (meta.eventType === 'reset' || meta.eventType === 'clear_all_data')) {
    clearPendingAnimationSfx();
    if (rosterCelebrationTimer) clearTimeout(rosterCelebrationTimer);
    rosterCelebrationTimer = null;
    stage?.classList.remove('roster-complete-celebration');
    completedDisqualifiedIds.clear();
    activeAnimationIds.clear();
    animatingSpotlightIds.clear();
    previousScores = {};
    previousLeaderboardRanks.clear();
    leaderboardMovementState.clear();
    hasLeaderboardSnapshot = false;
    if (leaderboardUpdateTimer) {
      clearTimeout(leaderboardUpdateTimer);
      leaderboardUpdateTimer = null;
    }
    previousTimerSeconds = null;
    timesUpTriggeredForCurrentRun = false;
    stopAllAudio();
    stopCoinRain();

    const oldTimesUp = document.getElementById('times-up-overlay');
    if (oldTimesUp) oldTimesUp.remove();
  }

  const isLeaderboardVisible = Boolean(state.leaderboard?.isVisible && !state.winnerGroupId);
  if (isLeaderboardVisible && !previousLeaderboardVisible) {
    playAnimationSfx('leaderboard-in');
  } else if (!isLeaderboardVisible && previousLeaderboardVisible && !state.winnerGroupId) {
    playAnimationSfx('leaderboard-out');
  }
  renderLeaderboard(state, meta);
  renderIntermissionTimer(state.intermissionTimer);
  renderQuestionPromptCard(state.questionPromptCard, meta);

  if ((state.arenaFocusNonce || 0) > previousArenaFocusNonce) {
    focusArena();
  }
  previousArenaFocusNonce = state.arenaFocusNonce || 0;

  if ((state.mainMenuFocusNonce || 0) > previousMainMenuFocusNonce) {
    focusMainMenu();
  }
  previousMainMenuFocusNonce = state.mainMenuFocusNonce || 0;

  if ((state.presentationCue?.nonce || 0) > previousPresentationCueNonce) {
    triggerPresentationCue(state.presentationCue);
  }
  previousPresentationCueNonce = state.presentationCue?.nonce || 0;

  const winnerJustDeclared = Boolean(state.winnerGroupId && state.winnerGroupId !== previousWinnerGroupId);
  const winnerJustCleared = Boolean(!state.winnerGroupId && previousWinnerGroupId);
  if (winnerJustDeclared) playAnimationSfx('winner-in');
  if (winnerJustCleared) playAnimationSfx('winner-out');

  const shouldFocusArena =
    (isLeaderboardVisible && !previousLeaderboardVisible) ||
    (state.winnerGroupId && state.winnerGroupId !== previousWinnerGroupId);
  if (shouldFocusArena) {
    requestAnimationFrame(() => {
      focusArena();
    });
  }
  previousLeaderboardVisible = isLeaderboardVisible;
  previousWinnerGroupId = state.winnerGroupId;

  // Handle True Full-Viewport Winner Celebration Backdrop attached directly to document.body
  let winnerBackdrop = document.getElementById('winner-celebration-backdrop');
  if (!winnerBackdrop) {
    winnerBackdrop = document.createElement('div');
    winnerBackdrop.className = 'winner-celebration-backdrop';
    winnerBackdrop.id = 'winner-celebration-backdrop';
    document.body.appendChild(winnerBackdrop);
  }

  if (state.winnerGroupId) {
    if (winnerBackdrop) winnerBackdrop.classList.add('active');
    if (stage) stage.classList.add('has-winner');
    startCoinRain();
  } else {
    if (winnerBackdrop) winnerBackdrop.classList.remove('active');
    if (stage) stage.classList.remove('has-winner');
    stopCoinRain();
  }
  if (stage) stage.classList.toggle('has-leaderboard', isLeaderboardVisible);

  // 1. Sync completed disqualified set with state FIRST (handles reset/restore)
  state.groups.forEach(g => {
    if (!g.isDisqualified) {
      completedDisqualifiedIds.delete(g.id);
      activeAnimationIds.delete(g.id);
      animatingSpotlightIds.delete(g.id);
    }
  });

  // Pre-scan: If any team newly became disqualified while spotlighted, preserve its presence in animatingSpotlightIds
  state.groups.forEach(g => {
    if (g.isDisqualified && !completedDisqualifiedIds.has(g.id) && !activeAnimationIds.has(g.id)) {
      const el = document.getElementById(`group-wrap-${g.id}`);
      if (el && (el.classList.contains('is-popup') || g.isPopUp)) {
        animatingSpotlightIds.add(g.id);
      }
    }
  });

  // 2. Active groups include groups currently in DQ flight, but exclude completed DQ groups
  const activeGroups = state.groups.filter(g => !completedDisqualifiedIds.has(g.id));
  const disqualifiedGroups = state.groups.filter(g => g.isDisqualified || completedDisqualifiedIds.has(g.id));

  // Render bottom-right mini-slots with completed disqualified teams
  renderDisqualifiedStack(disqualifiedGroups.filter(g => completedDisqualifiedIds.has(g.id)));

  // Spotlighted groups: include groups currently in DQ flight so remaining spotlighted groups do NOT jump or fight animations
  const spotlightedGroups = state.groups.filter(g => (g.isPopUp || animatingSpotlightIds.has(g.id)) && !completedDisqualifiedIds.has(g.id));
  const presentationSpotlightedGroups = (state.winnerGroupId || isLeaderboardVisible) ? [] : spotlightedGroups;

  // Toggle theatrical spotlight backdrop dimmer (strictly based on spotlighted groups, independent of timer)
  const spotlightBackdrop = document.getElementById('spotlight-backdrop');
  const hasSpotlight = presentationSpotlightedGroups.length > 0;
  if (spotlightBackdrop) {
    spotlightBackdrop.classList.toggle('active', hasSpotlight);
  }
  if (stage) {
    stage.classList.toggle('has-spotlight', hasSpotlight);
  }

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

  // Fixed designated row mapping & slot ordering: Teams 1, 2, 3 in Top Row; Teams 4, 5 in Bottom Row
  activeGroups.forEach((group) => {
    const isTopRow = group.id === 'group-1' || group.id === 'group-2' || group.id === 'group-3';
    const parentRow = isTopRow ? topRow : bottomRow;

    let groupWrapper = document.getElementById(`group-wrap-${group.id}`);

    const prevScore = previousScores[group.id];
    const scoreDelta = prevScore !== undefined ? group.points - prevScore : 0;
    const isScoreChanged = scoreDelta !== 0;

    previousScores[group.id] = group.points;

    const teamNum = group.id.replace('group-', '');
    const targetIndex = parseInt(teamNum, 10);

    if (!groupWrapper) {
      groupWrapper = document.createElement('div');
      groupWrapper.id = `group-wrap-${group.id}`;
      groupWrapper.className = `group-panel-wrapper active-group team-${teamNum}`;
    }

    if (!activeAnimationIds.has(group.id) && groupWrapper.parentElement !== parentRow) {
      // Maintain exact numerical slot order (Slot 1, 2, 3 in Top Row; Slot 4, 5 in Bottom Row)
      const existingChildren = Array.from(parentRow.children).filter(c => c !== groupWrapper);
      const insertBeforeElement = existingChildren.find(child => {
        const childNum = parseInt(child.id.replace('group-wrap-group-', ''), 10);
        return childNum > targetIndex;
      });

      if (insertBeforeElement) {
        parentRow.insertBefore(groupWrapper, insertBeforeElement);
      } else {
        parentRow.appendChild(groupWrapper);
      }
    }

    // Dynamic smooth 3D spotlight or winner positioning
    const isSpotlighted = Boolean(
      !state.winnerGroupId &&
      !isLeaderboardVisible &&
      group.isPopUp &&
      !completedDisqualifiedIds.has(group.id)
    );
    const isWinner = state.winnerGroupId === group.id;
    const individualWinnerName = isWinner && state.winner?.type === 'player' ? state.winner.playerName : null;
    const transform = getSpotlightTransform(group.id, presentationSpotlightedGroups, state.winnerGroupId, state);

    if (!activeAnimationIds.has(group.id)) {
      groupWrapper.style.transform = `translate3d(${Math.round(transform.tx)}px, ${Math.round(transform.ty)}px, 0px) scale(${transform.scale})`;
    }

    groupWrapper.classList.add(`team-${teamNum}`);
    groupWrapper.classList.toggle('is-popup', isSpotlighted);
    groupWrapper.classList.toggle('is-winner-group', isWinner);
    groupWrapper.classList.toggle('is-individual-winner', Boolean(individualWinnerName));
    groupWrapper.classList.toggle('winner-player-p1', individualWinnerName === group.player1.name);
    groupWrapper.classList.toggle('winner-player-p2', individualWinnerName === group.player2.name);
    groupWrapper.classList.toggle('active-group', true);
    groupWrapper.classList.remove('phase1-breaking', 'phase2-tearing', 'phase3-flight');

    const renderPlayerCard = (player, slotClass, slotKey, dealOrder) => {
      const shimmerDuration = 7 + Math.random() * 9;
      const shimmerStyle = [
        `--shimmer-duration:${shimmerDuration.toFixed(2)}s`,
        `--shimmer-delay:${(-Math.random() * shimmerDuration).toFixed(2)}s`,
        `--shimmer-angle:${(14 + Math.random() * 16).toFixed(1)}deg`,
        `--shimmer-x:${(-28 + Math.random() * 56).toFixed(1)}%`,
      ].join(';');
      return `
      <div class="player-card-slot ${slotClass} ${player.isRevealed ? 'is-revealed' : ''}" data-player-slot="${slotKey}" data-deal-order="${dealOrder}">
        <img src="${player.image}" alt="${escapeHtml(player.name)}" class="player-card-img card-full-face" />
        <img src="/assets/cards/CardBack.webp" alt="" class="player-card-img player-card-back" aria-hidden="true" />
        <div class="card-shimmer-mask" aria-hidden="true">
          <div class="card-white-light-reflection" style="${shimmerStyle}"></div>
        </div>
        <div class="card-half card-half-left" aria-hidden="true">
          <img src="${player.image}" alt="" class="player-card-img" />
        </div>
        <div class="card-half card-half-right" aria-hidden="true">
          <img src="${player.image}" alt="" class="player-card-img" />
        </div>
      </div>
    `;
    };

    const innerHTML = `
      <div class="team-container-frame" aria-hidden="true">
        <div class="team-container-base"></div>
        <div class="team-container-glow-mask">
          <div class="team-container-glow-beam"></div>
        </div>
        <div class="team-container-top-overlay"></div>
      </div>
      <div class="group-panel-container" id="group-container-${group.id}">
        ${renderPlayerCard(group.player1, 'slot-p1', `${group.id}:player1`, teamNum - 1)}
        ${renderPlayerCard(group.player2, 'slot-p2', `${group.id}:player2`, teamNum + 4)}

        <div class="group-score-pill" id="group-score-pill-${group.id}" style="--score-pop-order:${teamNum - 1}">
          <div class="score-pill-shader" id="score-shader-${group.id}"></div>
          <span class="group-name-text">${escapeHtml(individualWinnerName || group.name)}</span>
          <span class="score-led-value" id="score-led-${group.id}">${group.points}</span>
        </div>
      </div>
    `;

    // Exclude isPopUp and points from structureKey so DOM is persistent and never destroyed during spotlight
    const structureKey = `${group.name}_${group.player1.name}_${group.player2.name}_${group.player1.image}_${group.player2.image}_${group.player1.isRevealed}_${group.player2.isRevealed}_${individualWinnerName || ''}`;
    if (groupWrapper.dataset.renderedStructure !== structureKey) {
      groupWrapper.innerHTML = innerHTML;
      groupWrapper.dataset.renderedStructure = structureKey;

      [group.player1, group.player2].forEach((player, slotIndex) => {
        const slotKey = `${group.id}:player${slotIndex + 1}`;
        if (player.isRevealed && !revealedPlayerSlots.has(slotKey)) {
          const slot = groupWrapper.querySelector(`[data-player-slot="${slotKey}"]`);
          slot?.classList.remove('is-revealed');
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              slot?.classList.add('is-revealed');
              playCardFlipSfx('in');
            });
          });
        }
        if (player.isRevealed) revealedPlayerSlots.add(slotKey);
        else revealedPlayerSlots.delete(slotKey);
      });

      // Mount Liquid Metal WebGL Shader from @paper-design/shaders
      requestAnimationFrame(() => {
        const shaderContainer = document.getElementById(`score-shader-${group.id}`);
        if (shaderContainer && window.shaderMounts && !window.shaderMounts.has(group.id)) {
          try {
            const mount = new ShaderMount(
              shaderContainer,
              liquidMetalFragmentShader,
              {
                u_repetition: 4,
                u_softness: 0.5,
                u_shiftRed: 0.3,
                u_shiftBlue: 0.3,
                u_distortion: 0,
                u_contour: 0,
                u_angle: 45,
                u_scale: 8,
                u_shape: 1,
                u_offsetX: 0.1,
                u_offsetY: -0.1,
              },
              undefined,
              0.4,
              teamNum * 0.65,
              1,
              3500
            );
            window.shaderMounts.set(group.id, mount);
          } catch (err) {
            console.warn('ShaderMount error:', err);
          }
        }
      });
    }

    const scoreLed = document.getElementById(`score-led-${group.id}`);
    if (scoreLed && scoreLed.textContent !== String(group.points)) {
      scoreLed.textContent = group.points;
    }

    if (isScoreChanged) {
      triggerPointAnimation(group.id, scoreDelta);
    }

    // Winner Icon Badge Overlay
    let winnerIcon = groupWrapper.querySelector('.winner-icon-overlay');
    if (isWinner) {
      if (!winnerIcon) {
        winnerIcon = document.createElement('div');
        winnerIcon.className = 'winner-icon-overlay';
        winnerIcon.innerHTML = `<img src="/assets/WinnerIcon.webp" alt="WINNERS" class="winner-icon-img" />`;
        groupWrapper.appendChild(winnerIcon);
      }
    } else {
      if (winnerIcon) {
        winnerIcon.remove();
      }
    }
  });

  // Handle Strictly Sequenced Disqualification Live Motion
  state.groups.forEach((group) => {
    if (!group.isDisqualified) return;

    // If already fully completed or currently animating, do not restart
    if (completedDisqualifiedIds.has(group.id) || activeAnimationIds.has(group.id)) {
      return;
    }

    let groupWrapper = document.getElementById(`group-wrap-${group.id}`);
    if (!groupWrapper) return;

    activeAnimationIds.add(group.id);
    playScoreSfx('eliminated');
    if (groupWrapper.classList.contains('is-popup') || group.isPopUp) {
      animatingSpotlightIds.add(group.id);
    }

    // Phase 1: Neon Red Flash Aura in place (0.6s)
    groupWrapper.classList.add('phase1-breaking');

    setTimeout(() => {
      // Phase 2: Slow Smooth Diagonal Card Tear Cut in Place (1.0s)
      if (groupWrapper) {
        groupWrapper.classList.remove('phase1-breaking');
        groupWrapper.classList.add('phase2-tearing');
      }

      setTimeout(() => {
        // Phase 3: Apple Genie Curved Flight Arc to Bottom Right (GSAP onComplete driven)
        if (groupWrapper) {
          groupWrapper.classList.remove('phase2-tearing');
          groupWrapper.classList.add('phase3-flight');

          const currentCompleted = Array.from(completedDisqualifiedIds);
          const targetIndex = currentCompleted.length;
          const targetSlot = document.getElementById(`dq-slot-${targetIndex < 5 ? targetIndex : 4}`);

          let deltaX = 600;
          let deltaY = 600;
          if (targetSlot) {
            const wrapRect = groupWrapper.getBoundingClientRect();
            const slotRect = targetSlot.getBoundingClientRect();
            deltaX = slotRect.left - wrapRect.left;
            deltaY = slotRect.top - wrapRect.top;
          }

          groupWrapper.style.transition = 'none';

          gsap.to(groupWrapper, {
            x: `+=${deltaX}`,
            y: `+=${deltaY}`,
            scale: 0.22,
            rotation: 24,
            opacity: 0.3,
            duration: 1.2,
            ease: 'power2.inOut',
            onComplete: () => {
              // Disqualified card has physically arrived and settled at the bottom mini-slot
              if (groupWrapper && groupWrapper.parentElement) {
                groupWrapper.remove();
              }
              activeAnimationIds.delete(group.id);
              animatingSpotlightIds.delete(group.id);
              completedDisqualifiedIds.add(group.id);

              const currentState = gameStateStore.getState();
              const targetG = currentState.groups.find(g => g.id === group.id);
              if (targetG) targetG.isPopUp = false;

              // Distinct visual beat (150ms) after arrival before remaining spotlighted teams rearrange
              setTimeout(() => {
                animateLayoutFlip(() => {
                  renderDisplay(currentState);
                });
              }, 150);
            }
          });
        }
      }, 1000);

    }, 600);
  });

  // Handle Timer Zoom Dynamics (Timer running only enlarges the timer badge, never shifts background/darkness)
  const isExpanded = Boolean(state.timer.isExpanded || state.timer.isRunning);
  if (timerBadge) timerBadge.classList.toggle('timer-expanded', isExpanded);

  renderTimer(state.timer);

  if (shouldCelebrateRoster) {
    requestAnimationFrame(playRosterCompleteCelebration);
  }

  if (cardsDealt && !previousCardsDealt) {
    scheduleOpeningCardDeal();
  } else if (!cardsDealt && previousCardsDealt) {
    cancelOpeningCardDeal();
  }
  previousCardsDealt = cardsDealt;
}

function playRosterCompleteCelebration() {
  const stage = document.getElementById('app-stage');
  if (!stage) return;
  if (rosterCelebrationTimer) clearTimeout(rosterCelebrationTimer);
  if (stage.classList.contains('cards-dealing') || stage.classList.contains('scoreboards-popping')) {
    rosterCelebrationTimer = setTimeout(() => {
      rosterCelebrationTimer = null;
      playRosterCompleteCelebration();
    }, 200);
    return;
  }
  stage.classList.remove('roster-complete-celebration');
  void stage.offsetWidth;
  stage.classList.add('roster-complete-celebration');
  playSpotlightSfx(5);
  rosterCelebrationTimer = setTimeout(() => {
    stage.classList.remove('roster-complete-celebration');
    rosterCelebrationTimer = null;
  }, 3000);
}

function cancelOpeningCardDeal() {
  if (dealStartTimer) clearTimeout(dealStartTimer);
  dealStartTimer = null;
  activeDealTimeline?.kill();
  activeDealTimeline = null;
  document.querySelectorAll('.opening-deal-card').forEach((card) => card.remove());
  const stage = document.getElementById('app-stage');
  stage?.classList.remove('cards-dealing');
  stage?.classList.remove('scoreboards-popping');
  stage?.querySelectorAll('.dealt-arrived').forEach((slot) => slot.classList.remove('dealt-arrived'));
}

function scheduleOpeningCardDeal() {
  cancelOpeningCardDeal();
  const stage = document.getElementById('app-stage');
  if (!stage) return;
  stage.classList.add('cards-dealing');

  dealStartTimer = setTimeout(() => {
    dealStartTimer = null;
    const slots = [...stage.querySelectorAll('[data-deal-order]')]
      .sort((a, b) => Number(a.dataset.dealOrder) - Number(b.dataset.dealOrder));
    const stageRect = stage.getBoundingClientRect();
    const stageScale = stageRect.width / 1920 || 1;
    const timeline = gsap.timeline({
      onComplete: () => {
        stage.classList.remove('cards-dealing');
        stage.querySelectorAll('.dealt-arrived').forEach((slot) => slot.classList.remove('dealt-arrived'));
        stage.classList.add('scoreboards-popping');
        for (let scoreIndex = 0; scoreIndex < 5; scoreIndex += 1) {
          scheduleAnimationSfx('scoreboard-pop', scoreIndex, scoreIndex * 115);
        }
        setTimeout(() => stage.classList.remove('scoreboards-popping'), 1500);
        activeDealTimeline = null;
      },
    });
    activeDealTimeline = timeline;

    slots.forEach((slot, index) => {
      const rect = slot.getBoundingClientRect();
      const card = document.createElement('img');
      card.src = '/assets/cards/CardBack.webp';
      card.alt = '';
      card.className = 'opening-deal-card';
      stage.appendChild(card);
      const targetX = (rect.left - stageRect.left) / stageScale;
      const targetY = (rect.top - stageRect.top) / stageScale;
      const targetWidth = rect.width / stageScale;
      const targetHeight = rect.height / stageScale;

      gsap.set(card, { x: 1900, y: 18, width: targetWidth, height: targetHeight, scale: 0.18, rotation: 10 });
      timeline.to(card, {
        x: targetX,
        y: targetY,
        scale: 1,
        rotation: index < 5 ? -4.5 : 4.5,
        duration: 0.62,
        ease: 'power2.out',
        onComplete: () => {
          slot.classList.add('dealt-arrived');
          playAnimationSfx('deal', index);
          card.remove();
        },
      }, index * 0.16);
    });
  }, 2100);
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

  playScoreSfx(delta > 0 ? 'added' : 'deducted');

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

function renderIntermissionTimer(timerState) {
  const clock = document.getElementById('intermission-clock');
  if (!clock || !timerState) return;
  const callout = clock.closest('.intermission-callout');
  const mins = String(Math.floor(timerState.seconds / 60)).padStart(2, '0');
  const secs = String(timerState.seconds % 60).padStart(2, '0');
  clock.textContent = `${mins}:${secs}`;
  clock.classList.toggle('is-running', timerState.isRunning);
  callout?.classList.toggle('is-active', Boolean(timerState.isRunning));
}

function renderQuestionPromptCard(cardState, meta = {}) {
  const overlay = document.getElementById('question-prompt-overlay');
  const backdrop = overlay?.querySelector('.question-prompt-backdrop');
  const card = document.getElementById('question-prompt-display-card');
  const image = document.getElementById('question-prompt-card-image');
  const text = document.getElementById('question-prompt-display-text');
  if (!overlay || !backdrop || !card || !image || !text) return;

  const isVisible = Boolean(cardState?.isVisible && cardState.text);
  const nonce = cardState?.nonce || 0;
  const shouldEnter = isVisible && (nonce !== previousQuestionPromptNonce || !overlay.classList.contains('active'));
  const shouldExit = !isVisible && overlay.classList.contains('active');
  previousQuestionPromptNonce = nonce;

  if (shouldEnter) {
    const type = cardState.type === 'prompt' ? 'prompt' : 'question';
    const cleanText = String(cardState.text || '').trim();
    image.src = type === 'prompt'
      ? '/assets/questions-prompts/PromptCard.webp'
      : '/assets/questions-prompts/QuestionCard.webp';
    image.alt = `${type} card`;
    text.textContent = cleanText;
    text.classList.toggle('is-long', cleanText.length > 120 && cleanText.length <= 220);
    text.classList.toggle('is-very-long', cleanText.length > 220);
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    gsap.killTweensOf([overlay, backdrop, card]);
    gsap.set(overlay, { opacity: 1 });
    gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.38, ease: 'power2.out' });
    gsap.fromTo(card, {
      x: 650,
      y: -360,
      scale: 0.06,
      rotationY: -105,
      rotationZ: 8,
      opacity: 0,
    }, {
      x: 0,
      y: 0,
      scale: 1,
      rotationY: 0,
      rotationZ: 0,
      opacity: 1,
      duration: 0.82,
      ease: 'back.out(1.25)',
    });
    playCardFlipSfx('in');
    focusArena();
  } else if (shouldExit) {
    gsap.killTweensOf([backdrop, card]);
    playCardFlipSfx('out');
    gsap.to(backdrop, { opacity: 0, duration: 0.42, ease: 'power2.in' });
    gsap.to(card, {
      x: 650,
      y: -360,
      scale: 0.06,
      rotationY: 105,
      rotationZ: -8,
      opacity: 0,
      duration: 0.68,
      ease: 'back.in(1.35)',
      onComplete: () => {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        gsap.set(overlay, { opacity: 0 });
        image.removeAttribute('src');
      },
    });
  }
}

function triggerPresentationCue(cue) {
  if (!cue?.label) return;
  playPresentationCueSfx(cue);
  document.getElementById('presentation-cue-overlay')?.remove();
  const arenaSection = document.getElementById('main-arena-section') || document.body;
  const container = document.createElement('div');
  container.id = 'presentation-cue-overlay';
  const cueTone = cue.label === 'MATCH' ? 'is-match' : cue.label === 'NO MATCH' ? 'is-no-match' : '';
  container.className = `presentation-cue-overlay cue-${cue.kind || 'round'} ${cueTone}`;
  container.innerHTML = `
    <div class="presentation-cue-backdrop"></div>
    <div class="presentation-cue-graphic">
      <span class="presentation-cue-kicker">THE HUSTLE</span>
      <strong>${escapeHtml(cue.label)}</strong>
      <span class="presentation-cue-rule"></span>
    </div>
  `;
  arenaSection.appendChild(container);
  focusArena();

  const backdrop = container.querySelector('.presentation-cue-backdrop');
  const graphic = container.querySelector('.presentation-cue-graphic');
  const isMatchCue = cue.kind === 'match';
  gsap.set(backdrop, { opacity: 0 });
  gsap.set(graphic, { opacity: 0, scale: isMatchCue ? 0.08 : 0.92, y: isMatchCue ? 0 : 28 });

  const timeline = gsap.timeline({ onComplete: () => container.remove() });
  timeline.to(backdrop, { opacity: 1, duration: 0.32, ease: 'power2.out' }, 0);
  if (isMatchCue) {
    timeline.to(graphic, { opacity: 1, scale: 1.14, duration: 0.55, ease: 'back.out(2.1)' }, 0.08)
      .to(graphic, { scale: 1, duration: 0.28, ease: 'power2.out' })
      .to(graphic, { scale: 1.04, duration: 0.75, ease: 'sine.inOut' })
      .to(graphic, { opacity: 0, scale: 0.55, duration: 0.38, ease: 'back.in(1.5)' });
  } else {
    timeline.to(graphic, { opacity: 1, scale: 1, y: 0, duration: 0.65, ease: 'power3.out' }, 0.08)
      .to(graphic, { opacity: 1, duration: 1.15 })
      .to(graphic, { opacity: 0, scale: 1.04, y: -20, duration: 0.55, ease: 'power2.in' });
  }
  timeline.to(backdrop, { opacity: 0, duration: 0.4, ease: 'power2.inOut' }, '-=0.35');
}

function triggerTimesUpSequence() {
  const isLeftToRight = timesUpTriggerCount % 2 === 0;
  timesUpTriggerCount++;

  // Keep the producer-provided Time Up cue separate from countdown ticking.
  try {
    timesUpAudio.pause();
    timesUpAudio.currentTime = 0;
    const playPromise = timesUpAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Time Up audio was blocked; using synthesized fallback:', err);
        playZeroBuzzerSound();
      });
    }
  } catch (err) {
    console.warn('Time Up audio unavailable; using synthesized fallback:', err);
    playZeroBuzzerSound();
  }

  // Remove any leftover Time's Up container
  const oldContainer = document.getElementById('times-up-overlay');
  if (oldContainer) oldContainer.remove();

  // Create temporary Time's Up animation container mounted to the Game Section
  const arenaSection = document.getElementById('main-arena-section') || document.body;
  const container = document.createElement('div');
  container.className = 'times-up-container';
  container.id = 'times-up-overlay';

  // 70% Dark Overlay over Game Section
  const backdrop = document.createElement('div');
  backdrop.className = 'times-up-backdrop';
  container.appendChild(backdrop);

  const img = document.createElement('img');
  img.src = '/assets/Times_up.webp';
  img.alt = "TIME'S UP";
  img.className = 'times-up-img';
  container.appendChild(img);
  arenaSection.appendChild(container);

  const startX = isLeftToRight ? -window.innerWidth * 1.3 : window.innerWidth * 1.3;
  const exitX = isLeftToRight ? window.innerWidth * 1.3 : -window.innerWidth * 1.3;

  // Initial State: Backdrop transparent, image offscreen + small + 100% sharp (no blur)
  gsap.set(backdrop, { opacity: 0 });
  gsap.set(img, {
    x: startX,
    scale: 0.12,
    opacity: 0,
  });

  const tl = gsap.timeline({
    onComplete: () => {
      container.remove();
    },
  });

  // Dark overlay quickly fades in to 70% darkness (~0.25s)
  tl.to(backdrop, {
    opacity: 1,
    duration: 0.25,
    ease: 'power2.out',
  }, 0);

  // Phase 1: FAST entrance moving toward center, rapidly scaling small -> moderate (100% sharp)
  tl.to(img, {
    x: isLeftToRight ? -window.innerWidth * 0.08 : window.innerWidth * 0.08,
    scale: 1.05,
    opacity: 1,
    duration: 0.45,
    ease: 'power3.out',
  }, 0)
  // Phase 2: DRAMATIC SLOW-DOWN near center (emphasis moment: crisp, sharp crystal-clear reading)
  .to(img, {
    x: isLeftToRight ? window.innerWidth * 0.06 : -window.innerWidth * 0.06,
    scale: 0.98,
    duration: 1.45,
    ease: 'power1.inOut',
  })
  // Phase 3: FAST EXIT acceleration toward opposite side, scaling moderate -> small (100% sharp)
  .to(img, {
    x: exitX,
    scale: 0.15,
    opacity: 0,
    duration: 0.55,
    ease: 'power3.in',
  });

  // Dark overlay smoothly fades back out as the logo finishes its exit
  tl.to(backdrop, {
    opacity: 0,
    duration: 0.35,
    ease: 'power2.inOut',
  }, '-=0.35');
}

function renderTimer(timerState) {
  const clockEl = document.getElementById('hud-clock');
  if (clockEl) {
    const mins = String(Math.floor(timerState.seconds / 60)).padStart(2, '0');
    const secs = String(timerState.seconds % 60).padStart(2, '0');
    clockEl.textContent = `${mins}:${secs}`;
  }

  const currentSecs = timerState.seconds;
  const timerBadge = document.getElementById('hud-timer-badge');
  timerBadge?.classList.toggle('is-urgent', Boolean(timerState.isRunning && currentSecs <= 30 && currentSecs > 0));

  // Re-arm when timer is set or reset above 0
  if (currentSecs > 0) {
    timesUpTriggeredForCurrentRun = false;
  }
  // Trigger ONLY when transitioning from > 0 to 0 (or when active countdown reaches 00:00)
  else if (currentSecs === 0 && !timesUpTriggeredForCurrentRun && previousTimerSeconds !== null && previousTimerSeconds > 0) {
    timesUpTriggeredForCurrentRun = true;
    triggerTimesUpSequence();
  }

  previousTimerSeconds = currentSecs;
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

function syncTimerLoop(state) {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  const gameRunning = state?.timer?.isRunning && state.timer.seconds > 0;
  const intermissionRunning = state?.intermissionTimer?.isRunning && state.intermissionTimer.seconds > 0;
  if (gameRunning || intermissionRunning) {
    timerInterval = setInterval(() => {
      const current = gameStateStore.getState();
      if (current.timer.isRunning && current.timer.seconds > 0) {
        gameStateStore.tickTimer();
      }
      if (current.intermissionTimer.isRunning && current.intermissionTimer.seconds > 0) {
        gameStateStore.tickIntermissionTimer();
      }
      if (!current.timer.isRunning && !current.intermissionTimer.isRunning) {
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
syncTimerLoop(gameStateStore.getState());

// Keep rendering the local timestamp-derived timer on every state update.
gameStateStore.onStateChange((state, meta) => {
  if (meta?.eventType === 'arena_focus') playAnimationSfx('scene-down');
  if (meta?.eventType === 'main_menu_focus') playAnimationSfx('scene-up');

  if (meta?.eventType === 'timer_tick') {
    renderTimer(state.timer);
    const tickKey = `${state.timer.targetEndTime || 'local'}:${state.timer.seconds}`;
    if (state.timer.isRunning && state.timer.seconds > 0 && tickKey !== lastAudibleTimerTick) {
      lastAudibleTimerTick = tickKey;
      playTimerTick(state.timer.seconds);
    }
    syncTimerLoop(state);
    return;
  }

  if (meta?.eventType === 'intermission_timer_tick') {
    renderIntermissionTimer(state.intermissionTimer);
    syncTimerLoop(state);
    return;
  }

  if (meta?.eventType === 'timer_update' || meta?.eventType === 'timer_duration') {
    lastAudibleTimerTick = '';
  }

  if (meta?.eventType === 'popup_toggle') {
    const newlySpotlighted = state.groups.some((group) => group.isPopUp && !previousSpotlightIds.has(group.id));
    if (newlySpotlighted) {
      const spotlightCount = state.groups.filter((group) => group.isPopUp && !group.isDisqualified).length;
      playSpotlightSfx(spotlightCount);
    }
  }
  previousSpotlightIds = new Set(state.groups.filter((group) => group.isPopUp).map((group) => group.id));
  renderDisplay(state, meta);
  syncTimerLoop(state);
});
