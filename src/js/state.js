// Centralized State Management for 5 Team Groups with Instant Dual-Channel Sync

const STORAGE_KEY = 'ellis_game_show_state_v4';
const CHANNEL_NAME = 'ellis_game_show_channel_v4';

export const ALL_PLAYERS = {
  'Adrian': '/assets/Adrian.png',
  'Aphro': '/assets/Aphro.png',
  'Chidera': '/assets/Chidera.png',
  'Chinazom': '/assets/Chinazom.png',
  'EZ': '/assets/EZ.png',
  'Kitan': '/assets/Kitan.png',
  'Marty': '/assets/Marty.png',
  'Tayo': '/assets/Tayo.png',
  'Teslim': '/assets/Teslim.png',
  'kIA': '/assets/kIA.png',
};

const DEFAULT_GROUPS = [
  {
    id: 'group-1',
    name: 'TESLIM & CHIDERA',
    player1: { name: 'Teslim', image: ALL_PLAYERS['Teslim'] },
    player2: { name: 'Chidera', image: ALL_PLAYERS['Chidera'] },
    points: 0,
    isPopUp: false,
    isDisqualified: false,
  },
  {
    id: 'group-2',
    name: 'ADRIAN & TAYO',
    player1: { name: 'Adrian', image: ALL_PLAYERS['Adrian'] },
    player2: { name: 'Tayo', image: ALL_PLAYERS['Tayo'] },
    points: 0,
    isPopUp: false,
    isDisqualified: false,
  },
  {
    id: 'group-3',
    name: 'EZ & APHRO',
    player1: { name: 'EZ', image: ALL_PLAYERS['EZ'] },
    player2: { name: 'Aphro', image: ALL_PLAYERS['Aphro'] },
    points: 0,
    isPopUp: false,
    isDisqualified: false,
  },
  {
    id: 'group-4',
    name: 'CHINAZOM & MARTY',
    player1: { name: 'Chinazom', image: ALL_PLAYERS['Chinazom'] },
    player2: { name: 'Marty', image: ALL_PLAYERS['Marty'] },
    points: 0,
    isPopUp: false,
    isDisqualified: false,
  },
  {
    id: 'group-5',
    name: 'KIA & KITAN',
    player1: { name: 'kIA', image: ALL_PLAYERS['kIA'] },
    player2: { name: 'Kitan', image: ALL_PLAYERS['Kitan'] },
    points: 0,
    isPopUp: false,
    isDisqualified: false,
  },
];

const DEFAULT_STATE = {
  groups: DEFAULT_GROUPS,
  timer: {
    seconds: 300,
    initialSeconds: 300,
    isRunning: false,
    isExpanded: false,
  },
  leaderboard: {
    isVisible: false,
    title: 'CURRENT STANDINGS',
  },
  intermissionTimer: {
    seconds: 300,
    initialSeconds: 300,
    isRunning: false,
    targetEndTime: null,
  },
  arenaFocusNonce: 0,
  presentationCue: {
    kind: null,
    label: '',
    nonce: 0,
  },
  winner: null,
  winnerGroupId: null,
  lastUpdated: Date.now(),
  lastTxId: null,
  lastScoreEvent: null,
};

class GameStateStore {
  constructor() {
    this.listeners = new Set();
    this.lastProcessedTxId = null;
    this.broadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;
    
    this.state = this.normalizeState(this.loadStateFromStorage());

    // Dual-Channel Sync Engine (BroadcastChannel + LocalStorage Storage Event)
    const handleIncomingState = (newState, eventType, source) => {
      if (!newState || !newState.lastTxId) return;
      if (newState.lastTxId === this.lastProcessedTxId) return; // Deduplicate
      
      // Check if points changed compared to current state
      let pointsChanged = false;
      if (this.state && this.state.groups && newState.groups) {
        newState.groups.forEach((group, idx) => {
          const oldGroup = this.state.groups[idx];
          if (oldGroup && oldGroup.points !== group.points) {
            pointsChanged = true;
          }
        });
      }

      this.lastProcessedTxId = newState.lastTxId;
      this.state = this.normalizeState(newState);

      const resolvedEventType = (eventType === 'storage_update' && pointsChanged) ? 'points_update' : (eventType || 'update');
      this.notifyListeners({ source, eventType: resolvedEventType });
    };

    if (this.broadcastChannel) {
      this.broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.state) {
          handleIncomingState(event.data.state, event.data.eventType, 'broadcast');
        }
      };
    }

    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          handleIncomingState(parsed, 'storage_update', 'storage');
        } catch (err) {
          console.error('Error parsing stored state:', err);
        }
      }
    });
  }

  loadStateFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not access localStorage', e);
    }
    return null;
  }

  normalizeState(savedState) {
    if (!savedState) {
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }

    return {
      ...DEFAULT_STATE,
      ...savedState,
      groups: Array.isArray(savedState.groups) ? savedState.groups : JSON.parse(JSON.stringify(DEFAULT_GROUPS)),
      timer: {
        ...DEFAULT_STATE.timer,
        ...(savedState.timer || {}),
      },
      leaderboard: {
        ...DEFAULT_STATE.leaderboard,
        ...(savedState.leaderboard || {}),
      },
      intermissionTimer: {
        ...DEFAULT_STATE.intermissionTimer,
        ...(savedState.intermissionTimer || {}),
      },
      presentationCue: {
        ...DEFAULT_STATE.presentationCue,
        ...(savedState.presentationCue || {}),
      },
      winner: savedState.winner || (savedState.winnerGroupId ? {
        type: 'group',
        groupId: savedState.winnerGroupId,
        playerName: null,
      } : null),
    };
  }

  saveAndBroadcast(eventType = 'update') {
    const txId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.state.lastUpdated = Date.now();
    this.state.lastTxId = txId;
    this.lastProcessedTxId = txId;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        state: this.state,
        eventType,
        timestamp: Date.now(),
      });
    }

    this.notifyListeners({ source: 'local', eventType });
  }

  onStateChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(meta = {}) {
    this.listeners.forEach((callback) => callback(this.state, meta));
  }

  getState() {
    return this.state;
  }

  // --- Actions ---

  updateGroupPoints(id, delta) {
    const group = this.state.groups.find((g) => g.id === id);
    if (!group || group.isDisqualified) return;

    group.points = Math.max(0, group.points + delta);

    if (delta !== 0) {
      this.state.lastScoreEvent = {
        groupId: id,
        delta,
        timestamp: Date.now(),
      };
    }

    this.saveAndBroadcast('points_update');
  }

  setGroupPoints(id, value) {
    const group = this.state.groups.find((g) => g.id === id);
    if (!group || group.isDisqualified) return;
    const target = Math.max(0, parseInt(value, 10) || 0);
    const delta = target - group.points;
    group.points = target;

    if (delta !== 0) {
      this.state.lastScoreEvent = {
        groupId: id,
        delta,
        timestamp: Date.now(),
      };
    }

    this.saveAndBroadcast('points_update');
  }

  updateGroupPlayer(groupId, slot, newPlayerName) {
    const group = this.state.groups.find((g) => g.id === groupId);
    if (!group || !ALL_PLAYERS[newPlayerName]) return;

    if (slot === 'player1') {
      group.player1 = { name: newPlayerName, image: ALL_PLAYERS[newPlayerName] };
    } else if (slot === 'player2') {
      group.player2 = { name: newPlayerName, image: ALL_PLAYERS[newPlayerName] };
    }

    group.name = `${group.player1.name} & ${group.player2.name}`.toUpperCase();
    this.saveAndBroadcast('player_reshuffle');
  }

  togglePopUp(id) {
    const group = this.state.groups.find((g) => g.id === id);
    if (!group) return;

    if (group.isPopUp) {
      group.isPopUp = false;
      this.saveAndBroadcast('popup_toggle');
    } else {
      const activeSpotlightCount = this.state.groups.filter((g) => g.isPopUp && !g.isDisqualified).length;
      if (activeSpotlightCount < 3) {
        group.isPopUp = true;
        this.saveAndBroadcast('popup_toggle');
      }
    }
  }

  resetSpotlights() {
    let changed = false;
    this.state.groups.forEach((group) => {
      if (group.isPopUp) {
        group.isPopUp = false;
        changed = true;
      }
    });
    if (changed) {
      this.saveAndBroadcast('reset_spotlights');
    }
  }

  disqualifyGroup(id) {
    const group = this.state.groups.find((g) => g.id === id);
    if (group) {
      group.isDisqualified = true;
      group.isPopUp = false;
      this.saveAndBroadcast('disqualify');
    }
  }

  restoreGroup(id) {
    const group = this.state.groups.find((g) => g.id === id);
    if (group) {
      group.isDisqualified = false;
      this.saveAndBroadcast('restore');
    }
  }

  updateGroupName(id, newName) {
    const group = this.state.groups.find((g) => g.id === id);
    if (group && newName.trim()) {
      group.name = newName.trim().toUpperCase();
      this.saveAndBroadcast('rename');
    }
  }

  updateTimer(seconds, isRunning) {
    this.state.timer.seconds = Math.max(0, seconds);
    this.state.timer.isRunning = isRunning;
    if (isRunning && this.state.timer.seconds > 0) {
      this.state.timer.targetEndTime = Date.now() + this.state.timer.seconds * 1000;
    } else {
      this.state.timer.targetEndTime = null;
    }
    this.saveAndBroadcast('timer_update');
  }

  pauseTimer() {
    if (this.state.timer.isRunning && this.state.timer.targetEndTime) {
      this.state.timer.seconds = Math.max(0, Math.ceil((this.state.timer.targetEndTime - Date.now()) / 1000));
    }
    this.state.timer.isRunning = false;
    this.state.timer.targetEndTime = null;
    this.saveAndBroadcast('timer_update');
  }

  stopTimer() {
    this.state.timer.isRunning = false;
    this.state.timer.targetEndTime = null;
    this.state.timer.seconds = this.state.timer.initialSeconds || 300;
    this.saveAndBroadcast('timer_update');
  }

  resetTimer() {
    this.state.timer.isRunning = false;
    this.state.timer.targetEndTime = null;
    this.state.timer.seconds = this.state.timer.initialSeconds || 300;
    this.state.timer.isExpanded = false;
    this.saveAndBroadcast('timer_update');
  }

  tickTimer() {
    if (this.state.timer.isRunning) {
      if (this.state.timer.targetEndTime) {
        const remaining = Math.max(0, Math.ceil((this.state.timer.targetEndTime - Date.now()) / 1000));
        if (this.state.timer.seconds !== remaining) {
          this.state.timer.seconds = remaining;
          if (remaining === 0) {
            this.state.timer.isRunning = false;
            this.state.timer.targetEndTime = null;
          }
          this.saveAndBroadcast('timer_tick');
        }
      } else if (this.state.timer.seconds > 0) {
        this.state.timer.seconds -= 1;
        if (this.state.timer.seconds === 0) {
          this.state.timer.isRunning = false;
        }
        this.saveAndBroadcast('timer_tick');
      }
    }
  }

  setTimerDuration(seconds) {
    const targetSecs = Math.max(0, parseInt(seconds, 10) || 0);
    this.state.timer.seconds = targetSecs;
    this.state.timer.initialSeconds = targetSecs;
    this.state.timer.isRunning = false;
    this.state.timer.targetEndTime = null;
    this.saveAndBroadcast('timer_duration');
  }

  toggleTimerExpansion(forceState) {
    this.state.timer.isExpanded = typeof forceState === 'boolean' ? forceState : !this.state.timer.isExpanded;
    this.saveAndBroadcast('timer_expand');
  }

  updateIntermissionTimer(seconds, isRunning) {
    const timer = this.state.intermissionTimer;
    timer.seconds = Math.max(0, seconds);
    timer.isRunning = Boolean(isRunning && timer.seconds > 0);
    timer.targetEndTime = timer.isRunning ? Date.now() + timer.seconds * 1000 : null;
    this.saveAndBroadcast('intermission_timer_update');
  }

  pauseIntermissionTimer() {
    const timer = this.state.intermissionTimer;
    if (timer.isRunning && timer.targetEndTime) {
      timer.seconds = Math.max(0, Math.ceil((timer.targetEndTime - Date.now()) / 1000));
    }
    timer.isRunning = false;
    timer.targetEndTime = null;
    this.saveAndBroadcast('intermission_timer_update');
  }

  resetIntermissionTimer() {
    const timer = this.state.intermissionTimer;
    timer.isRunning = false;
    timer.targetEndTime = null;
    timer.seconds = timer.initialSeconds || 300;
    this.saveAndBroadcast('intermission_timer_update');
  }

  setIntermissionDuration(seconds) {
    const targetSecs = Math.max(0, parseInt(seconds, 10) || 0);
    const timer = this.state.intermissionTimer;
    timer.seconds = targetSecs;
    timer.initialSeconds = targetSecs;
    timer.isRunning = false;
    timer.targetEndTime = null;
    this.saveAndBroadcast('intermission_timer_duration');
  }

  tickIntermissionTimer() {
    const timer = this.state.intermissionTimer;
    if (!timer.isRunning) return;
    const remaining = timer.targetEndTime
      ? Math.max(0, Math.ceil((timer.targetEndTime - Date.now()) / 1000))
      : Math.max(0, timer.seconds - 1);
    if (remaining === timer.seconds) return;
    timer.seconds = remaining;
    if (remaining === 0) {
      timer.isRunning = false;
      timer.targetEndTime = null;
    }
    this.saveAndBroadcast('intermission_timer_tick');
  }

  enterArena() {
    this.state.arenaFocusNonce = (this.state.arenaFocusNonce || 0) + 1;
    this.saveAndBroadcast('arena_focus');
  }

  triggerPresentationCue(kind, label) {
    this.state.presentationCue = {
      kind,
      label,
      nonce: (this.state.presentationCue?.nonce || 0) + 1,
    };
    this.saveAndBroadcast('presentation_cue');
  }

  showLeaderboard() {
    if (this.state.winnerGroupId) return;
    this.state.leaderboard.isVisible = true;
    this.saveAndBroadcast('leaderboard_show');
  }

  hideLeaderboard() {
    this.state.leaderboard.isVisible = false;
    this.saveAndBroadcast('leaderboard_hide');
  }

  toggleLeaderboard() {
    if (this.state.leaderboard.isVisible) {
      this.hideLeaderboard();
    } else {
      this.showLeaderboard();
    }
  }

  declareWinner(winner) {
    const normalizedWinner = typeof winner === 'string'
      ? { type: 'group', groupId: winner, playerName: null }
      : winner;
    if (!normalizedWinner?.groupId) return;
    this.state.leaderboard.isVisible = false;
    this.state.winner = normalizedWinner;
    this.state.winnerGroupId = normalizedWinner.groupId;
    this.saveAndBroadcast('winner_declared');
  }

  clearWinner() {
    this.state.winner = null;
    this.state.winnerGroupId = null;
    this.saveAndBroadcast('winner_cleared');
  }

  resetAll() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.state.lastUpdated = Date.now();
    this.state.lastTxId = `tx_reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.saveAndBroadcast('reset');
  }
}

export const gameStateStore = new GameStateStore();
