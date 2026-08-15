import { gameStateStore, ALL_PLAYERS } from './state.js';

let pendingDisqualifyId = null;
let selectedWinner = null;
let renderWinnerOptions = () => {};
let lastScoreUndo = null;
let selectedQuestionPromptType = 'question';

function refreshUndoButton() {
  const button = document.getElementById('btn-undo-score');
  if (!button) return;
  button.disabled = !lastScoreUndo;
  button.textContent = lastScoreUndo ? `UNDO ${lastScoreUndo.label}` : 'UNDO LAST SCORE';
}

// Show audio is produced by the audience display only. Keeping the controller
// silent prevents two open tabs (or a phone and PC) from doubling every cue.

function renderAdminPanel(state) {
  const container = document.getElementById('competitors-list');
  const timerVal = document.getElementById('admin-timer-val');

  if (timerVal) {
    const mins = String(Math.floor(state.timer.seconds / 60)).padStart(2, '0');
    const secs = String(state.timer.seconds % 60).padStart(2, '0');
    timerVal.textContent = `${mins}:${secs}`;
  }

  const intermissionVal = document.getElementById('admin-intermission-val');
  if (intermissionVal && state.intermissionTimer) {
    const mins = String(Math.floor(state.intermissionTimer.seconds / 60)).padStart(2, '0');
    const secs = String(state.intermissionTimer.seconds % 60).padStart(2, '0');
    intermissionVal.textContent = `${mins}:${secs}`;
    intermissionVal.classList.toggle('is-running', state.intermissionTimer.isRunning);
  }

  const cardStatus = document.getElementById('question-prompt-air-status');
  const toggleCardButton = document.getElementById('btn-toggle-question-prompt');
  const cardIsVisible = Boolean(state.questionPromptCard?.isVisible);
  if (cardStatus) {
    cardStatus.textContent = cardIsVisible
      ? `${String(state.questionPromptCard.type || 'question').toUpperCase()} ON AIR`
      : 'OFF AIR';
    cardStatus.classList.toggle('active', cardIsVisible);
  }
  if (toggleCardButton) {
    const buttonType = cardIsVisible ? state.questionPromptCard.type : selectedQuestionPromptType;
    toggleCardButton.textContent = `${cardIsVisible ? 'HIDE' : 'SHOW'} ${String(buttonType || 'question').toUpperCase()}`;
    toggleCardButton.classList.toggle('btn-card-hide', cardIsVisible);
  }

  if (!container) return;
  container.innerHTML = '';

  const playerOptionsHTML = (selectedName, isRevealed) => {
    const placeholder = isRevealed ? '' : '<option value="" selected disabled>SELECT PLAYER</option>';
    return placeholder + Object.keys(ALL_PLAYERS).map((name) => {
      const isSel = Boolean(isRevealed) && name.toLowerCase() === (selectedName || '').toLowerCase();
      return `<option value="${escapeHtml(name)}" ${isSel ? 'selected' : ''}>${escapeHtml(name)}</option>`;
    }).join('');
  };

  state.groups.forEach((group, index) => {
    const row = document.createElement('div');
    row.className = `competitor-row ${group.isPopUp ? 'is-popup' : ''} ${group.isDisqualified ? 'is-disqualified' : ''}`;
    
    row.innerHTML = `
      <div class="comp-info">
        <div class="comp-team-header">
          <span class="comp-team-label">GROUP ${index + 1}${group.player1?.isRevealed || group.player2?.isRevealed ? ` — ${escapeHtml(group.name)}` : ''}</span>
        </div>
        <div class="player-select-group">
          <select class="player-select" data-id="${group.id}" data-slot="player1" ${group.isDisqualified ? 'disabled' : ''}>
            ${playerOptionsHTML(group.player1 ? group.player1.name : '', group.player1?.isRevealed)}
          </select>
          <span style="font-size: 11px; color: #ffd700;">&amp;</span>
          <select class="player-select" data-id="${group.id}" data-slot="player2" ${group.isDisqualified ? 'disabled' : ''}>
            ${playerOptionsHTML(group.player2 ? group.player2.name : '', group.player2?.isRevealed)}
          </select>
        </div>
      </div>

      <div class="points-control-group">
        <button class="quick-pts-btn sub" data-action="pts" data-id="${group.id}" data-delta="-5" ${group.isDisqualified ? 'disabled' : ''}>-5</button>
        <input 
          type="number" 
          class="pts-input" 
          value="${group.points}" 
          data-id="${group.id}"
          ${group.isDisqualified ? 'disabled' : ''} 
        />
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

  const btnToggleLeaderboard = document.getElementById('btn-toggle-leaderboard');
  const leaderboardStatus = document.getElementById('leaderboard-status');
  const leaderboardVisible = Boolean(state.leaderboard?.isVisible);
  if (btnToggleLeaderboard) {
    btnToggleLeaderboard.textContent = leaderboardVisible ? 'HIDE LEADERBOARD' : 'SHOW LEADERBOARD';
    btnToggleLeaderboard.classList.toggle('active', leaderboardVisible);
    btnToggleLeaderboard.disabled = Boolean(state.winnerGroupId);
  }
  if (leaderboardStatus) {
    leaderboardStatus.textContent = leaderboardVisible ? 'ON AIR' : 'HIDDEN';
    leaderboardStatus.classList.toggle('active', leaderboardVisible);
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

  const cloudStatusLabel = document.getElementById('cloud-status-label');
  const cloudStatusDot = document.getElementById('cloud-status-dot');
  const cloudPinInput = document.getElementById('cloud-host-pin');
  const cloudConnectButton = document.getElementById('btn-cloud-connect');
  const renderCloudStatus = ({ status, isHost }) => {
    const resolved = isHost ? 'host' : status;
    if (cloudStatusLabel) {
      cloudStatusLabel.textContent = resolved === 'host' ? 'PHONE CONTROL READY' :
        resolved === 'connected' ? 'DISPLAY SYNC ONLINE' : resolved === 'offline' ? 'LOCAL MODE' : 'CONNECTING';
    }
    if (cloudStatusDot) cloudStatusDot.dataset.status = resolved;
    if (cloudConnectButton && resolved === 'host') {
      cloudConnectButton.textContent = 'CONNECTED';
      cloudConnectButton.disabled = true;
    }
    if (cloudPinInput && resolved === 'host') cloudPinInput.style.display = 'none';
  };
  window.addEventListener('hustle-remote-status', (event) => renderCloudStatus(event.detail));
  renderCloudStatus(gameStateStore.getRemoteInfo());

  document.querySelectorAll('[data-workspace-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.workspaceTarget;
      document.querySelectorAll('[data-workspace-target]').forEach((tab) => tab.classList.toggle('active', tab === button));
      document.querySelectorAll('[data-control-workspace]').forEach((workspace) => {
        workspace.hidden = workspace.dataset.controlWorkspace !== target;
      });
    });
  });

  const cardTextInput = document.getElementById('question-prompt-text');
  const cardCount = document.getElementById('question-prompt-character-count');
  const toggleCardButton = document.getElementById('btn-toggle-question-prompt');
  const syncCardComposer = () => {
    const length = cardTextInput?.value.length || 0;
    if (cardCount) cardCount.textContent = `${length} / 420`;
    if (toggleCardButton && !gameStateStore.getState().questionPromptCard?.isVisible) {
      toggleCardButton.textContent = `SHOW ${selectedQuestionPromptType.toUpperCase()}`;
    }
    if (cardTextInput) cardTextInput.placeholder = `Enter the ${selectedQuestionPromptType} here...`;
  };

  document.querySelectorAll('[data-card-type]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedQuestionPromptType = button.dataset.cardType === 'prompt' ? 'prompt' : 'question';
      document.querySelectorAll('[data-card-type]').forEach((tab) => tab.classList.toggle('active', tab === button));
      syncCardComposer();
    });
  });
  cardTextInput?.addEventListener('input', syncCardComposer);
  toggleCardButton?.addEventListener('click', () => {
    if (gameStateStore.getState().questionPromptCard?.isVisible) {
      gameStateStore.hideQuestionPromptCard();
    } else {
      gameStateStore.showQuestionPromptCard(selectedQuestionPromptType, cardTextInput?.value);
    }
  });
  syncCardComposer();

  cloudConnectButton?.addEventListener('click', async () => {
    cloudConnectButton.disabled = true;
    cloudConnectButton.textContent = 'CONNECTING...';
    try {
      await gameStateStore.connectRemoteHost(cloudPinInput?.value);
    } catch (error) {
      cloudConnectButton.disabled = false;
      cloudConnectButton.textContent = 'CONNECT PHONE CONTROL';
      if (cloudStatusLabel) cloudStatusLabel.textContent = error.message.toUpperCase();
    }
  });

  document.getElementById('btn-clear-all-data')?.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Clear every player assignment, score, timer, winner, spotlight, and saved arena value? This cannot be undone.'
    );
    if (!confirmed) return;
    selectedWinner = null;
    lastScoreUndo = null;
    gameStateStore.clearAllData();
  });

  document.getElementById('btn-undo-score')?.addEventListener('click', () => {
    if (!lastScoreUndo) return;
    const action = lastScoreUndo;
    lastScoreUndo = null;
    gameStateStore.setGroupPoints(action.groupId, action.previousPoints);
    refreshUndoButton();
  });

  // Launch Arena Window Button
  const btnLaunch = document.getElementById('btn-launch-display');
  if (btnLaunch) {
    btnLaunch.addEventListener('click', () => {
      window.open('index.html', '_blank', 'width=1920,height=1080');
    });
  }

  document.getElementById('btn-enter-arena')?.addEventListener('click', () => {
    gameStateStore.enterArena();
  });

  // Timer Controls (Start, Pause, Stop, Reset)
  const btnTimerStart = document.getElementById('btn-timer-start');
  const btnTimerPause = document.getElementById('btn-timer-pause');
  const btnTimerStop = document.getElementById('btn-timer-stop');
  const btnTimerReset = document.getElementById('btn-timer-reset');

  const btnSetCustomTimer = document.getElementById('btn-set-custom-timer');
  const inputCustomTimer = document.getElementById('input-custom-timer');

  if (btnTimerStart) {
    btnTimerStart.addEventListener('click', () => {
      const state = gameStateStore.getState();
      let secs = state.timer.seconds;
      if (secs <= 0) {
        secs = state.timer.initialSeconds || 300;
      }
      gameStateStore.updateTimer(secs, true);
    });
  }

  if (btnTimerPause) {
    btnTimerPause.addEventListener('click', () => {
      gameStateStore.pauseTimer();
    });
  }

  if (btnTimerStop) {
    btnTimerStop.addEventListener('click', () => {
      gameStateStore.stopTimer();
    });
  }

  if (btnTimerReset) {
    btnTimerReset.addEventListener('click', () => {
      gameStateStore.resetTimer();
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

  const inputIntermission = document.getElementById('input-intermission-timer');
  const parseClockInput = (value) => {
    const parts = value.trim().split(':');
    if (parts.length === 2) {
      return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    }
    return (parseInt(parts[0], 10) || 0) * 60;
  };

  document.getElementById('btn-set-intermission')?.addEventListener('click', () => {
    gameStateStore.setIntermissionDuration(parseClockInput(inputIntermission?.value || '05:00'));
  });
  document.getElementById('btn-intermission-start')?.addEventListener('click', () => {
    const timer = gameStateStore.getState().intermissionTimer;
    gameStateStore.updateIntermissionTimer(timer.seconds > 0 ? timer.seconds : timer.initialSeconds, true);
  });
  document.getElementById('btn-intermission-pause')?.addEventListener('click', () => {
    gameStateStore.pauseIntermissionTimer();
  });
  document.getElementById('btn-intermission-reset')?.addEventListener('click', () => {
    gameStateStore.resetIntermissionTimer();
  });

  document.querySelectorAll('[data-cue-kind]').forEach((button) => {
    button.addEventListener('click', () => {
      gameStateStore.triggerPresentationCue(button.dataset.cueKind, button.dataset.cueLabel);
    });
  });

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
      lastScoreUndo = null;
      refreshUndoButton();
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
        const group = gameStateStore.getState().groups.find((item) => item.id === id);
        if (group && !group.isDisqualified) {
          lastScoreUndo = {
            groupId: id,
            previousPoints: group.points,
            label: `${delta > 0 ? '+' : ''}${delta} ON ${group.name}`,
          };
        }
        gameStateStore.updateGroupPoints(id, delta);
        refreshUndoButton();
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
        const group = gameStateStore.getState().groups.find((item) => item.id === id);
        if (group && !group.isDisqualified) {
          lastScoreUndo = {
            groupId: id,
            previousPoints: group.points,
            label: `SCORE EDIT ON ${group.name}`,
          };
        }
        gameStateStore.setGroupPoints(id, e.target.value);
        refreshUndoButton();
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

  const btnToggleLeaderboard = document.getElementById('btn-toggle-leaderboard');
  if (btnToggleLeaderboard) {
    btnToggleLeaderboard.addEventListener('click', () => {
      gameStateStore.toggleLeaderboard();
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

  renderWinnerOptions = function renderWinnerOptionsForState(state) {
    if (!winnerOptionsList) return;
    winnerOptionsList.innerHTML = '';

    // Filter ONLY non-disqualified eligible teams
    const eligibleGroups = state.groups.filter((g) => !g.isDisqualified && g.player1?.isRevealed && g.player2?.isRevealed);

    // Verify currently selected team is still eligible
    const selectedWinnerGroup = selectedWinner
      ? state.groups.find((group) => group.id === selectedWinner.groupId && !group.isDisqualified)
      : null;
    const selectedWinnerIsEligible = !selectedWinner || (selectedWinner.type === 'group'
      ? eligibleGroups.some((group) => group.id === selectedWinner.groupId)
      : [selectedWinnerGroup?.player1, selectedWinnerGroup?.player2]
        .some((player) => player?.isRevealed && player.name === selectedWinner.playerName));
    if (selectedWinner && !selectedWinnerIsEligible) {
      selectedWinner = null;
      if (btnProceedWinnerConfirm) btnProceedWinnerConfirm.disabled = true;
    }

    const makeWinnerSection = (title, className) => {
      const section = document.createElement('section');
      section.className = 'winner-option-section';
      section.innerHTML = `<h4>${title}</h4><div class="winner-options-grid ${className}"></div>`;
      winnerOptionsList.appendChild(section);
      return section.querySelector('.winner-options-grid');
    };

    const teamsGrid = makeWinnerSection('TEAMS', 'winner-teams-grid');
    const playersGrid = makeWinnerSection('PLAYERS', 'winner-players-grid');

    const appendOption = (targetContainer, group, target, title, subtitle, badge) => {
      const opt = document.createElement('div');
      const isEliminated = Boolean(group.isDisqualified);
      const isSelected = selectedWinner && selectedWinner.type === target.type &&
        selectedWinner.groupId === target.groupId && selectedWinner.playerName === target.playerName;
      opt.className = `winner-option-card ${isSelected ? 'selected' : ''} ${isEliminated ? 'is-eliminated' : ''}`;
      opt.setAttribute('role', 'button');
      opt.setAttribute('aria-disabled', String(isEliminated));
      opt.innerHTML = `
        <div class="winner-opt-team-name">${escapeHtml(title)}</div>
      `;

      opt.addEventListener('click', () => {
        if (isEliminated) return;
        selectedWinner = target;
        winnerOptionsList.querySelectorAll('.winner-option-card').forEach((card) => card.classList.remove('selected'));
        opt.classList.add('selected');
        if (btnProceedWinnerConfirm) btnProceedWinnerConfirm.disabled = false;
      });

      targetContainer.appendChild(opt);
    };

    state.groups.forEach((group) => {
      if (group.player1?.isRevealed && group.player2?.isRevealed) {
        appendOption(teamsGrid, group, { type: 'group', groupId: group.id, playerName: null }, group.name,
          `${group.player1?.name || ''} & ${group.player2?.name || ''}`, `${group.points} PTS · GROUP`);
      }
      [group.player1, group.player2].filter((player) => player?.isRevealed).forEach((player) => {
        appendOption(playersGrid, group, { type: 'player', groupId: group.id, playerName: player.name }, player.name,
          `Individual winner · ${group.name}`, 'PLAYER');
      });
    });

    const hasAnyEligiblePlayer = state.groups.some((group) => !group.isDisqualified &&
      (group.player1?.isRevealed || group.player2?.isRevealed));
    if (eligibleGroups.length === 0 && !hasAnyEligiblePlayer) selectedWinner = null;

    if (btnProceedWinnerConfirm) {
      btnProceedWinnerConfirm.disabled = !selectedWinner;
    }
  };

  if (btnOpenWinnerModal && winnerSelectModal) {
    btnOpenWinnerModal.addEventListener('click', () => {
      const state = gameStateStore.getState();
      selectedWinner = null;
      renderWinnerOptions(state);
      winnerSelectModal.classList.add('open');
    });
  }

  if (btnCancelWinnerSelect && winnerSelectModal) {
    btnCancelWinnerSelect.addEventListener('click', () => {
      selectedWinner = null;
      winnerSelectModal.classList.remove('open');
    });
  }

  if (btnProceedWinnerConfirm && winnerConfirmModal && winnerSelectModal) {
    btnProceedWinnerConfirm.addEventListener('click', () => {
      if (!selectedWinner) return;
      const state = gameStateStore.getState();
      const group = state.groups.find((g) => g.id === selectedWinner.groupId);
      if (!group || group.isDisqualified) {
        selectedWinner = null;
        renderWinnerOptions(state);
        return;
      }

      if (confirmWinnerTeamName) {
        confirmWinnerTeamName.textContent = selectedWinner.type === 'player' ? selectedWinner.playerName : group.name;
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
      if (selectedWinner) {
        const state = gameStateStore.getState();
        const group = state.groups.find((g) => g.id === selectedWinner.groupId);
        if (group && !group.isDisqualified) {
          gameStateStore.declareWinner(selectedWinner);
        }
        selectedWinner = null;
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
function syncAdminTimerLoop(state) {
  if (adminTimerInterval) {
    clearInterval(adminTimerInterval);
    adminTimerInterval = null;
  }

  const gameRunning = state?.timer?.isRunning && state.timer.seconds > 0;
  const intermissionRunning = state?.intermissionTimer?.isRunning && state.intermissionTimer.seconds > 0;
  if (gameRunning || intermissionRunning) {
    adminTimerInterval = setInterval(() => {
      const current = gameStateStore.getState();
      if (current.timer.isRunning && current.timer.seconds > 0) {
        gameStateStore.tickTimer();
      }
      if (current.intermissionTimer.isRunning && current.intermissionTimer.seconds > 0) {
        gameStateStore.tickIntermissionTimer();
      }
      if (!current.timer.isRunning && !current.intermissionTimer.isRunning) {
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
syncAdminTimerLoop(gameStateStore.getState());

gameStateStore.onStateChange((state, meta) => {
  renderAdminPanel(state);
  syncAdminTimerLoop(state);

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
      const dqMatch = selectedWinner && state.groups.find((g) => g.id === selectedWinner.groupId && g.isDisqualified);
      if (dqMatch) {
        winnerConfirmModal.classList.remove('open');
        selectedWinner = null;
        if (winnerSelectModal) {
          renderWinnerOptions(state);
          winnerSelectModal.classList.add('open');
        }
      }
    }
  }
});
