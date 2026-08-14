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
});

let previousScores = {};
let activeAnimationIds = new Set();
let completedDisqualifiedIds = new Set();
let timesUpTriggerCount = 0;
let timesUpTriggeredForCurrentRun = false;
let previousTimerSeconds = null;

// Pre-instantiated Time's Up audio element for zero-latency & browser policy unlocking
const timesUpAudio = new Audio('/assets/Time_up.mp3');
timesUpAudio.preload = 'auto';

let isAudioEngineUnlocked = false;
function primeAudioPlayback() {
  if (isAudioEngineUnlocked) return;
  isAudioEngineUnlocked = true;

  try {
    timesUpAudio.load();
    const p = timesUpAudio.play();
    if (p !== undefined) {
      p.then(() => {
        timesUpAudio.pause();
        timesUpAudio.currentTime = 0;
      }).catch(() => {
        // Will unlock on next user gesture
        isAudioEngineUnlocked = false;
      });
    }
  } catch (e) {
    isAudioEngineUnlocked = false;
  }
}

// Attach user unlock listeners across common interaction events
['click', 'touchstart', 'mousedown', 'keydown', 'wheel', 'scroll'].forEach((evt) => {
  window.addEventListener(evt, primeAudioPlayback, { passive: true });
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
  const activeEls = Array.from(document.querySelectorAll('.group-panel-wrapper:not(.phase3-flight)'));
  const firstPositions = new Map();

  activeEls.forEach((el) => {
    firstPositions.set(el.id, el.getBoundingClientRect());
  });

  updateDomCallback();

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
  const arena = document.getElementById('main-arena-section') || document.body;
  let container = document.getElementById('winner-coin-rain');
  if (!container) {
    container = document.createElement('div');
    container.className = 'winner-coin-rain-container';
    container.id = 'winner-coin-rain';
    arena.appendChild(container);
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

function getSpotlightTransform(groupId, spotlightedGroups, winnerGroupId) {
  const home = HOME_COORDINATES[groupId] || { x: 960, y: 330 };

  // Winner Priority Transform (Centering winning player cards at scale 1.50)
  if (winnerGroupId) {
    if (winnerGroupId === groupId) {
      return {
        tx: 960 - home.x,
        ty: 450 - home.y,
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

function renderDisplay(state, meta = {}) {
  const stage = document.getElementById('app-stage');
  const topRow = document.getElementById('groups-row-top');
  const bottomRow = document.getElementById('groups-row-bottom');
  const timerBadge = document.getElementById('hud-timer-badge');
  const groupsContainer = document.getElementById('groups-stage-container');

  if (!topRow || !bottomRow) return;

  // Handle Winner Celebration Backdrop inside app-stage (Stacking: Game UI -> 65% Backdrop -> Winner Group -> Winner Logo -> Coin Rain)
  let winnerBackdrop = document.getElementById('winner-celebration-backdrop');
  if (!winnerBackdrop && stage) {
    winnerBackdrop = document.createElement('div');
    winnerBackdrop.className = 'winner-celebration-backdrop';
    winnerBackdrop.id = 'winner-celebration-backdrop';
    stage.appendChild(winnerBackdrop);
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

  // Toggle theatrical spotlight backdrop dimmer (strictly based on spotlighted groups, independent of timer)
  const spotlightBackdrop = document.getElementById('spotlight-backdrop');
  const hasSpotlight = state.groups.some(g => g.isPopUp && !g.isDisqualified) && !state.winnerGroupId;
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

  const spotlightedGroups = activeGroups.filter(g => g.isPopUp);

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
    const isSpotlighted = Boolean(group.isPopUp);
    const isWinner = state.winnerGroupId === group.id;
    const transform = getSpotlightTransform(group.id, spotlightedGroups, state.winnerGroupId);

    groupWrapper.style.transform = `translate3d(${Math.round(transform.tx)}px, ${Math.round(transform.ty)}px, 0px) scale(${transform.scale})`;

    groupWrapper.classList.add(`team-${teamNum}`);
    groupWrapper.classList.toggle('is-popup', isSpotlighted);
    groupWrapper.classList.toggle('is-winner-group', isWinner);
    groupWrapper.classList.toggle('active-group', true);
    groupWrapper.classList.remove('phase1-breaking', 'phase2-tearing', 'phase3-flight');

    const renderPlayerCard = (player, slotClass) => `
      <div class="player-card-slot ${slotClass}">
        <img src="${player.image}" alt="${escapeHtml(player.name)}" class="player-card-img card-full-face" />
        <div class="card-shimmer-mask" aria-hidden="true">
          <div class="card-white-light-reflection"></div>
        </div>
        <div class="card-half card-half-left" aria-hidden="true">
          <img src="${player.image}" alt="" class="player-card-img" />
        </div>
        <div class="card-half card-half-right" aria-hidden="true">
          <img src="${player.image}" alt="" class="player-card-img" />
        </div>
      </div>
    `;

    const innerHTML = `
      <div class="team-container-frame" aria-hidden="true">
        <div class="team-container-base"></div>
        <div class="team-container-glow-mask">
          <div class="team-container-glow-beam"></div>
        </div>
        <div class="team-container-top-overlay"></div>
      </div>
      <div class="group-panel-container" id="group-container-${group.id}">
        ${renderPlayerCard(group.player1, 'slot-p1')}
        ${renderPlayerCard(group.player2, 'slot-p2')}

        <div class="group-score-pill" id="group-score-pill-${group.id}">
          <div class="score-pill-shader" id="score-shader-${group.id}"></div>
          <span class="group-name-text">${escapeHtml(group.name)}</span>
          <span class="score-led-value" id="score-led-${group.id}">${group.points}</span>
        </div>
      </div>
    `;

    // Exclude isPopUp and points from structureKey so DOM is persistent and never destroyed during spotlight
    const structureKey = `${group.name}_${group.player1.name}_${group.player2.name}_${group.player1.image}_${group.player2.image}`;
    if (groupWrapper.dataset.renderedStructure !== structureKey) {
      groupWrapper.innerHTML = innerHTML;
      groupWrapper.dataset.renderedStructure = structureKey;

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
              0.5
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
        winnerIcon.innerHTML = `<img src="/assets/WinnerIcon.png" alt="WINNERS" class="winner-icon-img" />`;
        groupWrapper.appendChild(winnerIcon);
      }
    } else {
      if (winnerIcon) {
        winnerIcon.remove();
      }
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
          // Sequence complete: Move into completed stack with smooth FLIP re-centering of remaining teams
          animateLayoutFlip(() => {
            if (groupWrapper && groupWrapper.parentElement) {
              groupWrapper.remove();
            }
            activeAnimationIds.delete(group.id);
            completedDisqualifiedIds.add(group.id);

            renderDisplay(gameStateStore.getState());
          });
        }, 1200);

      }, 1000);

    }, 600);
  });

  // Handle Timer Zoom Dynamics (Timer running only enlarges the timer badge, never shifts background/darkness)
  const isExpanded = Boolean(state.timer.isExpanded || state.timer.isRunning);
  if (timerBadge) timerBadge.classList.toggle('timer-expanded', isExpanded);

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

function triggerTimesUpSequence() {
  const isLeftToRight = timesUpTriggerCount % 2 === 0;
  timesUpTriggerCount++;

  // Play uploaded Time's Up sound effect synchronized with entrance
  try {
    timesUpAudio.pause();
    timesUpAudio.currentTime = 0;
    timesUpAudio.volume = 1.0;
    const playPromise = timesUpAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Direct audio play restricted, playing synthesizer fallback:', err);
        playZeroBuzzerSound();
      });
    }
  } catch (err) {
    console.warn('Audio playback error, playing synthesizer fallback:', err);
    playZeroBuzzerSound();
  }

  // Ambient green stage flash
  const stage = document.getElementById('app-stage');
  if (stage) {
    stage.classList.remove('timer-finished-flash');
    void stage.offsetWidth;
    stage.classList.add('timer-finished-flash');
    setTimeout(() => {
      stage.classList.remove('timer-finished-flash');
    }, 2500);
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
  img.src = '/assets/Times_up.png';
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
