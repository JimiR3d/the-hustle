import { gameStateStore, ALL_PLAYERS } from './state.js';

let pendingDisqualifyId = null;

// Persistent Countdown & Time's Up audio elements on Admin Panel
const timerStartAudio = new Audio('/assets/Timer_start.mp3');
timerStartAudio.preload = 'auto';
timerStartAudio.loop = true;

const timerSpeedUpAudio = new Audio('/assets/Timer_speedUp.mp3');
timerSpeedUpAudio.preload = 'auto';
timerSpeedUpAudio.loop = true;

const timesUpAudio = new Audio('/assets/Time_up.mp3');
timesUpAudio.preload = 'auto';

let currentAudioState = 'idle'; // 'idle' | 'start' | 'speedUp'
let isAudioEngineUnlocked = false;

function primeAudioPlayback() {
  if (isAudioEngineUnlocked) return;
  isAudioEngineUnlocked = true;

  [timerStartAudio, timerSpeedUpAudio, timesUpAudio].forEach((audio) => {
    try {
      audio.load();
      const p = audio.play();
      if (p !== undefined) {
        p.then(() => {
          audio.pause();
          audio.currentTime = 0;
        }).catch((err) => {
          console.warn('[Admin Audio] Priming deferred to user interaction:', err);
          isAudioEngineUnlocked = false;
        });
      }
    } catch (e) {
      isAudioEngineUnlocked = false;
    }
  });
}

['click', 'touchstart', 'mousedown', 'keydown'].forEach((evt) => {
  window.addEventListener(evt, primeAudioPlayback, { passive: true });
});

function syncTimerAudio(timerState) {
  const currentSecs = timerState ? timerState.seconds : 0;
  const isRunning = Boolean(timerState && timerState.isRunning && currentSecs > 0);

  if (!isRunning) {
    if (currentSecs === 0) {
      timerStartAudio.pause();
      timerStartAudio.currentTime = 0;
      timerSpeedUpAudio.pause();
      timerSpeedUpAudio.currentTime = 0;
      currentAudioState = 'idle';
    } else {
      timerStartAudio.pause();
      timerSpeedUpAudio.pause();
    }
    return;
  }

  // Running countdown
  if (currentSecs > 20) {
    if (currentAudioState !== 'start') {
      timerSpeedUpAudio.pause();
      timerSpeedUpAudio.currentTime = 0;
      timerStartAudio.currentTime = 0;
      currentAudioState = 'start';
    }
    if (timerStartAudio.paused) {
      const p = timerStartAudio.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.error('[Admin Audio] Timer_start.mp3 play blocked or failed:', err);
        });
      }
    }
  } else {
    // 0 < currentSecs <= 20
    if (currentAudioState !== 'speedUp') {
      timerStartAudio.pause();
      timerStartAudio.currentTime = 0;
      timerSpeedUpAudio.currentTime = 0;
      currentAudioState = 'speedUp';
    }
    if (timerSpeedUpAudio.paused) {
      const p = timerSpeedUpAudio.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.error('[Admin Audio] Timer_speedUp.mp3 play blocked or failed:', err);
        });
      }
    }
  }
}

function stopAllAudio() {
  [timerStartAudio, timerSpeedUpAudio, timesUpAudio].forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {}
  });
  currentAudioState = 'idle';
}

function renderAdminPanel(state) {
  const container = document.getElementById('competitors-list');
  const timerVal = document.getElementById('admin-timer-val');

  if (timerVal) {
    const mins = String(Math.floor(state.timer.seconds / 60)).padStart(2, '0');
    const secs = String(state.timer.seconds % 60).padStart(2, '0');
    timerVal.textContent = `${mins}:${secs}`;
  }

  if (!container) return;
  container.innerHTML = '';

  const playerOptionsHTML = (selectedName) => {
    return Object.keys(ALL_PLAYERS).map((name) => {
      const isSel = name.toLowerCase() === (selectedName || '').toLowerCase();
      return `<option value="${escapeHtml(name)}" ${isSel ? 'selected' : ''}>${escapeHtml(name)}</option>`;
    }).join('');
  };

  state.groups.forEach((group, index) => {
    const row = document.createElement('div');
    row.className = `competitor-row ${group.isPopUp ? 'is-popup' : ''} ${group.isDisqualified ? 'is-disqualified' : ''}`;
    
    row.innerHTML = `
      <div class="comp-info">
        <div class="comp-team-header">
          <span class="comp-team-label">GROUP ${index + 1} — ${escapeHtml(group.name)}</span>
        </div>
        <div class="player-select-group">
          <select class="player-select" data-id="${group.id}" data-slot="player1" ${group.isDisqualified ? 'disabled' : ''}>
            ${playerOptionsHTML(group.player1 ? group.player1.name : '')}
          </select>
          <span style="font-size: 11px; color: #ffd700;">&amp;</span>
          <select class="player-select" data-id="${group.id}" data-slot="player2" ${group.isDisqualified ? 'disabled' : ''}>
            ${playerOptionsHTML(group.player2 ? group.player2.name : '')}
          </select>
        </div>
      </div>

      <div class="points-control-group">
        <button class="quick-pts-btn sub" data-action="pts" data-id="${group.id}" data-delta="-5" ${group.isDisqualified ? 'disabled' : ''}>-5</button>
        <button class="quick-pts-btn sub" data-action="pts" data-id="${group.id}" data-delta="-1" ${group.isDisqualified ? 'disabled' : ''}>-1</button>
        <input 
          type="number" 
          class="pts-input" 
          value="${group.points}" 
          data-id="${group.id}"
          ${group.isDisqualified ? 'disabled' : ''} 
        />
        <button class="quick-pts-btn add" data-action="pts" data-id="${group.id}" data-delta="1" ${group.isDisqualified ? 'disabled' : ''}>+1</button>
        <button class="quick-pts-btn add" data-action="pts" data-id="${group.id}" data-delta="5" ${group.isDisqualified ? 'disabled' : ''}>+5</button>
      </div>

      <div class="row-actions-group">
        <button 
          class="btn btn-spotlight ${group.isPopUp ? 'active' : ''}" 
          data-action="spotlight" 
          data-id="${group.id}"
          ${group.isDisqualified ? 'disabled' : ''}
        >
          ${group.isPopUp ? '⭐ In Spotlight' : 'Spotlight'}
        </button>

        ${group.isDisqualified ? `
          <button class="btn btn-outline btn-sm" data-action="restore" data-id="${group.id}">
            🔄 Restore
          </button>
        ` : `
          <button class="btn btn-disqualify" data-action="disqualify-prompt" data-id="${group.id}">
            ❌ Disqualify
          </button>
        `}
      </div>
    `;

    container.appendChild(row);
  });

  // Toggle Winner Celebration controls
  const btnOpenWinner = document.getElementById('btn-open-winner-modal');
  const winnerActiveControls = document.getElementById('winner-active-controls');
  if (btnOpenWinner && winnerActiveControls) {
    if (state.winnerGroupId) {
      btnOpenWinner.style.display = 'none';
      winnerActiveControls.style.display = 'flex';
    } else {
      btnOpenWinner.style.display = 'inline-flex';
      winnerActiveControls.style.display = 'none';
    }
  }
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

// Global Event Listeners for Admin UI
function bindAdminEvents() {
  const container = document.getElementById('competitors-list');
  const modalBackdrop = document.getElementById('disqualify-modal');
  const modalCompName = document.getElementById('modal-group-name');
  const confirmDisqualifyBtn = document.getElementById('btn-confirm-disqualify');
  const cancelDisqualifyBtn = document.getElementById('btn-cancel-disqualify');

  // Launch Arena Window Button
  const btnLaunch = document.getElementById('btn-launch-display');
  if (btnLaunch) {
    btnLaunch.addEventListener('click', () => {
      window.open('index.html', '_blank', 'width=1920,height=1080');
    });
  }

  // Timer Controls (Start, Pause, Stop, Reset)
  const btnTimerStart = document.getElementById('btn-timer-start');
  const btnTimerPause = document.getElementById('btn-timer-pause');
  const btnTimerStop = document.getElementById('btn-timer-stop');
  const btnTimerReset = document.getElementById('btn-timer-reset');

  const btnSetCustomTimer = document.getElementById('btn-set-custom-timer');
  const inputCustomTimer = document.getElementById('input-custom-timer');

  if (btnTimerStart) {
    btnTimerStart.addEventListener('click', () => {
      primeAudioPlayback();
      const state = gameStateStore.getState();
      gameStateStore.updateTimer(state.timer.seconds, true);
      syncTimerAudio(gameStateStore.getState().timer);
    });
  }

  if (btnTimerPause) {
    btnTimerPause.addEventListener('click', () => {
      gameStateStore.pauseTimer();
      syncTimerAudio(gameStateStore.getState().timer);
    });
  }

  if (btnTimerStop) {
    btnTimerStop.addEventListener('click', () => {
      gameStateStore.stopTimer();
      syncTimerAudio(gameStateStore.getState().timer);
    });
  }

  if (btnTimerReset) {
    btnTimerReset.addEventListener('click', () => {
      gameStateStore.resetTimer();
      syncTimerAudio(gameStateStore.getState().timer);
    });
  }

  if (btnSetCustomTimer && inputCustomTimer) {
    btnSetCustomTimer.addEventListener('click', () => {
      const val = inputCustomTimer.value.trim();
      const parts = val.split(':');
      let totalSeconds = 300;

      if (parts.length === 2) {
        const mins = parseInt(parts[0], 10) || 0;
        const secs = parseInt(parts[1], 10) || 0;
        totalSeconds = mins * 60 + secs;
      } else if (parts.length === 1) {
        totalSeconds = (parseInt(parts[0], 10) || 0) * 60;
      }

      gameStateStore.setTimerDuration(totalSeconds);
    });
  }

  // Quick Preset Buttons (5m, 10m)
  document.addEventListener('click', (e) => {
    const btnPreset = e.target.closest('[data-action="preset-timer"]');
    if (btnPreset) {
      const secs = parseInt(btnPreset.dataset.seconds, 10) || 300;
      gameStateStore.setTimerDuration(secs);
      if (inputCustomTimer) {
        const mins = String(Math.floor(secs / 60)).padStart(2, '0');
        inputCustomTimer.value = `${mins}:00`;
      }
    }
  });

  // Reset All State
  const btnResetAll = document.getElementById('btn-reset-all');
  if (btnResetAll) {
    btnResetAll.addEventListener('click', () => {
      gameStateStore.resetAll();
    });
  }

  // Delegated events for competitor list
  if (container) {
    container.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      const id = target.dataset.id;

      if (action === 'pts') {
        const delta = parseInt(target.dataset.delta, 10);
        gameStateStore.updateGroupPoints(id, delta);
      } else if (action === 'spotlight') {
        gameStateStore.togglePopUp(id);
      } else if (action === 'disqualify-prompt') {
        const group = gameStateStore.getState().groups.find((g) => g.id === id);
        if (group) {
          pendingDisqualifyId = id;
          if (modalCompName) modalCompName.textContent = group.name;
          if (modalBackdrop) modalBackdrop.classList.add('open');
        }
      } else if (action === 'restore') {
        gameStateStore.restoreGroup(id);
      }
    });

    container.addEventListener('change', (e) => {
      if (e.target.classList.contains('pts-input')) {
        const id = e.target.dataset.id;
        gameStateStore.setGroupPoints(id, e.target.value);
      } else if (e.target.classList.contains('player-select')) {
        const id = e.target.dataset.id;
        const slot = e.target.dataset.slot;
        const newPlayerName = e.target.value;
        gameStateStore.updateGroupPlayer(id, slot, newPlayerName);
      }
    });
  }

  // Global Reset Spotlights Action
  const btnResetSpotlights = document.getElementById('btn-reset-spotlights');
  if (btnResetSpotlights) {
    btnResetSpotlights.addEventListener('click', () => {
      gameStateStore.resetSpotlights();
    });
  }

  // Disqualification Modal Actions
  if (cancelDisqualifyBtn) {
    cancelDisqualifyBtn.addEventListener('click', () => {
      pendingDisqualifyId = null;
      if (modalBackdrop) modalBackdrop.classList.remove('open');
    });
  }

  if (confirmDisqualifyBtn) {
    confirmDisqualifyBtn.addEventListener('click', () => {
      if (pendingDisqualifyId) {
        gameStateStore.disqualifyGroup(pendingDisqualifyId);
        pendingDisqualifyId = null;
        if (modalBackdrop) modalBackdrop.classList.remove('open');
      }
    });
  }

  // Winner Selection & Confirmation Flow
  const btnOpenWinnerModal = document.getElementById('btn-open-winner-modal');
  const btnEndWinner = document.getElementById('btn-end-winner');
  const winnerSelectModal = document.getElementById('winner-select-modal');
  const winnerConfirmModal = document.getElementById('winner-confirm-modal');
  const winnerOptionsList = document.getElementById('winner-options-list');
  const btnCancelWinnerSelect = document.getElementById('btn-cancel-winner-select');
  const btnProceedWinnerConfirm = document.getElementById('btn-proceed-winner-confirm');
  const btnCancelWinnerFinal = document.getElementById('btn-cancel-winner-final');
  const btnConfirmWinnerFinal = document.getElementById('btn-confirm-winner-final');
  const confirmWinnerTeamName = document.getElementById('confirm-winner-team-name');

  let selectedWinnerId = null;

  function renderWinnerOptions(state) {
    if (!winnerOptionsList) return;
    winnerOptionsList.innerHTML = '';

    // Filter ONLY non-disqualified eligible teams
    const eligibleGroups = state.groups.filter((g) => !g.isDisqualified);

    if (eligibleGroups.length === 0) {
      winnerOptionsList.innerHTML = '<div style="padding: 16px; color: #ff1744; text-align: center; font-weight: 700;">No eligible teams remaining!</div>';
      selectedWinnerId = null;
      if (btnProceedWinnerConfirm) btnProceedWinnerConfirm.disabled = true;
      return;
    }

    // Verify currently selected team is still eligible
    if (selectedWinnerId && !eligibleGroups.some((g) => g.id === selectedWinnerId)) {
      selectedWinnerId = null;
      if (btnProceedWinnerConfirm) btnProceedWinnerConfirm.disabled = true;
    }

    eligibleGroups.forEach((group) => {
      const opt = document.createElement('div');
      const isSelected = group.id === selectedWinnerId;
      opt.className = `winner-option-card ${isSelected ? 'selected' : ''}`;
      opt.dataset.id = group.id;
      opt.innerHTML = `
        <div>
          <div class="winner-opt-team-name">${escapeHtml(group.name)}</div>
          <div class="winner-opt-players">${escapeHtml(group.player1?.name || '')} &amp; ${escapeHtml(group.player2?.name || '')}</div>
        </div>
        <div class="winner-opt-score">${group.points} PTS</div>
      `;

      opt.addEventListener('click', () => {
        selectedWinnerId = group.id;
        Array.from(winnerOptionsList.children).forEach((c) => c.classList.remove('selected'));
        opt.classList.add('selected');
        if (btnProceedWinnerConfirm) btnProceedWinnerConfirm.disabled = false;
      });

      winnerOptionsList.appendChild(opt);
    });

    if (btnProceedWinnerConfirm) {
      btnProceedWinnerConfirm.disabled = !selectedWinnerId;
    }
  }

  if (btnOpenWinnerModal && winnerSelectModal) {
    btnOpenWinnerModal.addEventListener('click', () => {
      const state = gameStateStore.getState();
      selectedWinnerId = null;
      renderWinnerOptions(state);
      winnerSelectModal.classList.add('open');
    });
  }

  if (btnCancelWinnerSelect && winnerSelectModal) {
    btnCancelWinnerSelect.addEventListener('click', () => {
      selectedWinnerId = null;
      winnerSelectModal.classList.remove('open');
    });
  }

  if (btnProceedWinnerConfirm && winnerConfirmModal && winnerSelectModal) {
    btnProceedWinnerConfirm.addEventListener('click', () => {
      if (!selectedWinnerId) return;
      const state = gameStateStore.getState();
      const group = state.groups.find((g) => g.id === selectedWinnerId);
      if (!group || group.isDisqualified) {
        selectedWinnerId = null;
        renderWinnerOptions(state);
        return;
      }

      if (confirmWinnerTeamName) {
        confirmWinnerTeamName.textContent = group.name;
      }

      winnerSelectModal.classList.remove('open');
      winnerConfirmModal.classList.add('open');
    });
  }

  if (btnCancelWinnerFinal && winnerConfirmModal) {
    btnCancelWinnerFinal.addEventListener('click', () => {
      winnerConfirmModal.classList.remove('open');
      if (winnerSelectModal) winnerSelectModal.classList.add('open');
    });
  }

  if (btnConfirmWinnerFinal && winnerConfirmModal) {
    btnConfirmWinnerFinal.addEventListener('click', () => {
      if (selectedWinnerId) {
        const state = gameStateStore.getState();
        const group = state.groups.find((g) => g.id === selectedWinnerId);
        if (group && !group.isDisqualified) {
          gameStateStore.declareWinner(selectedWinnerId);
        }
        selectedWinnerId = null;
        winnerConfirmModal.classList.remove('open');
      }
    });
  }

  const btnExitWinnerX = document.getElementById('btn-exit-winner-x');
  if (btnExitWinnerX) {
    btnExitWinnerX.addEventListener('click', () => {
      gameStateStore.clearWinner();
    });
  }

  if (btnEndWinner) {
    btnEndWinner.addEventListener('click', () => {
      gameStateStore.clearWinner();
    });
  }
}

// Robust Admin Multi-Window Timer Loop
let adminTimerInterval = null;
function syncAdminTimerLoop(timerState) {
  if (adminTimerInterval) {
    clearInterval(adminTimerInterval);
    adminTimerInterval = null;
  }

  if (timerState && timerState.isRunning && timerState.seconds > 0) {
    adminTimerInterval = setInterval(() => {
      const state = gameStateStore.getState();
      if (state.timer.isRunning && state.timer.seconds > 0) {
        gameStateStore.tickTimer();
      } else {
        if (adminTimerInterval) {
          clearInterval(adminTimerInterval);
          adminTimerInterval = null;
        }
      }
    }, 1000);
  }
}

// Initialize Admin UI
renderAdminPanel(gameStateStore.getState());
bindAdminEvents();
syncAdminTimerLoop(gameStateStore.getState().timer);
syncTimerAudio(gameStateStore.getState().timer);

gameStateStore.onStateChange((state, meta) => {
  renderAdminPanel(state);
  syncAdminTimerLoop(state.timer);
  syncTimerAudio(state.timer);

  if (meta && meta.eventType === 'reset') {
    stopAllAudio();
  }

  // Live update Winner Select Modal if currently open
  const winnerSelectModal = document.getElementById('winner-select-modal');
  const winnerConfirmModal = document.getElementById('winner-confirm-modal');
  if (winnerSelectModal && winnerSelectModal.classList.contains('open')) {
    renderWinnerOptions(state);
  }

  // If winner confirm modal is open and confirmed team was just disqualified, revert to select modal
  if (winnerConfirmModal && winnerConfirmModal.classList.contains('open')) {
    const confirmNameEl = document.getElementById('confirm-winner-team-name');
    if (confirmNameEl) {
      const dqMatch = state.groups.find((g) => g.name === confirmNameEl.textContent && g.isDisqualified);
      if (dqMatch) {
        winnerConfirmModal.classList.remove('open');
        selectedWinnerId = null;
        if (winnerSelectModal) {
          renderWinnerOptions(state);
          winnerSelectModal.classList.add('open');
        }
      }
    }
  }
});
