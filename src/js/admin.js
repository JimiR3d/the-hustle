import { gameStateStore, ALL_PLAYERS } from './state.js';

let pendingDisqualifyId = null;

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
      const state = gameStateStore.getState();
      gameStateStore.updateTimer(state.timer.seconds, true);
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
}

// Initialize Admin UI
renderAdminPanel(gameStateStore.getState());
bindAdminEvents();

gameStateStore.onStateChange((state) => {
  renderAdminPanel(state);
});
