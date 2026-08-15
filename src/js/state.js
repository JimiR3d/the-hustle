// Centralized State Management for 5 Team Groups with Instant Dual-Channel Sync

const STORAGE_KEY = 'ellis_game_show_state_v4';
const CHANNEL_NAME = 'ellis_game_show_channel_v4';
const SUPABASE_URL = 'https://bnawjxemtqxtyelayzja.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dD8L23d5oWUOFDIogayrXw_G-h19nK7';
const REMOTE_SHOW_CODE = 'HUSTLE-ELLIS';

export const ALL_PLAYERS = {
  'Adrian': '/assets/Adrian.webp',
  'Aphro': '/assets/Aphro.webp',
  'Chidera': '/assets/Chidera.webp',
  'Chinazom': '/assets/Chinazom.webp',
  'EZ': '/assets/EZ.webp',
  'Kitan': '/assets/Kitan.webp',
  'Marty': '/assets/Marty.webp',
  'Tayo': '/assets/Tayo.webp',
  'Teslim': '/assets/Teslim.webp',
  'kIA': '/assets/kIA.webp',
};

const DEFAULT_GROUPS = [
  {
    id: 'group-1',
    name: 'GROUP 1',
    player1: { name: 'Teslim', image: ALL_PLAYERS['Teslim'], isRevealed: false },
    player2: { name: 'Chidera', image: ALL_PLAYERS['Chidera'], isRevealed: false },
    points: 0,
    isPopUp: false,
    isDisqualified: false,
  },
  {
    id: 'group-2',
    name: 'GROUP 2',
    player1: { name: 'Adrian', image: ALL_PLAYERS['Adrian'], isRevealed: false },
    player2: { name: 'Tayo', image: ALL_PLAYERS['Tayo'], isRevealed: false },
    points: 0,
    isPopUp: false,
    isDisqualified: false,
  },
  {
    id: 'group-3',
    name: 'GROUP 3',
    player1: { name: 'EZ', image: ALL_PLAYERS['EZ'], isRevealed: false },
    player2: { name: 'Aphro', image: ALL_PLAYERS['Aphro'], isRevealed: false },
    points: 0,
    isPopUp: false,
    isDisqualified: false,
  },
  {
    id: 'group-4',
    name: 'GROUP 4',
    player1: { name: 'Chinazom', image: ALL_PLAYERS['Chinazom'], isRevealed: false },
    player2: { name: 'Marty', image: ALL_PLAYERS['Marty'], isRevealed: false },
    points: 0,
    isPopUp: false,
    isDisqualified: false,
  },
  {
    id: 'group-5',
    name: 'GROUP 5',
    player1: { name: 'kIA', image: ALL_PLAYERS['kIA'], isRevealed: false },
    player2: { name: 'Kitan', image: ALL_PLAYERS['Kitan'], isRevealed: false },
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
  mainMenuFocusNonce: 0,
  arenaSetup: {
    cardsDealt: false,
    dealNonce: 0,
    rosterCompleteNonce: 0,
  },
  presentationCue: {
    kind: null,
    label: '',
    nonce: 0,
  },
  questionPromptCard: {
    isVisible: false,
    type: 'question',
    text: '',
    options: [],
    correctOptionIndex: null,
    selectedOptionIndex: null,
    answerRevealed: false,
    teamId: null,
    nonce: 0,
  },
  gameInstructionCard: {
    isVisible: false,
    gameId: null,
    text: '',
    nonce: 0,
  },
  winner: null,
  winnerGroupId: null,
  lastUpdated: Date.now(),
  lastTxId: null,
  revision: 0,
  lastScoreEvent: null,
};

class GameStateStore {
  constructor() {
    this.listeners = new Set();
    this.lastProcessedTxId = null;
    this.broadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;
    this.remoteClient = null;
    this.remoteChannel = null;
    this.remotePushQueue = Promise.resolve();
    this.remoteHostPin = sessionStorage.getItem('hustle_remote_host_pin') || '';
    this.remoteStatus = 'connecting';
    
    this.state = this.normalizeState(this.loadStateFromStorage());

    // Dual-Channel Sync Engine (BroadcastChannel + LocalStorage Storage Event)
    const handleIncomingState = (newState, eventType, source) => {
      if (!newState || !newState.lastTxId) return;
      if (newState.lastTxId === this.lastProcessedTxId) return; // Deduplicate
      const isStale = (Number(newState.revision) || 0) < (Number(this.state?.revision) || 0);
      const isAuthoritativeClear = eventType === 'clear_all_data';
      if (isStale && !isAuthoritativeClear) return;
      
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
      this.refreshRunningTimers();

      const resolvedEventType = (eventType === 'storage_update' && pointsChanged) ? 'points_update' : (eventType || 'update');
      this.notifyListeners({ source, eventType: resolvedEventType });
    };
    this.handleIncomingState = handleIncomingState;

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

    this.initializeRemoteSync();
  }

  setRemoteStatus(status, message = '') {
    this.remoteStatus = status;
    window.dispatchEvent(new CustomEvent('hustle-remote-status', {
      detail: { status, message, showCode: REMOTE_SHOW_CODE, isHost: Boolean(this.remoteHostPin) },
    }));
  }

  async initializeRemoteSync() {
    if (!window.supabase?.createClient) {
      this.setRemoteStatus('offline', 'Cloud library unavailable; local sync is still active.');
      return;
    }

    try {
      this.remoteClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false },
      });
      const { data, error } = await this.remoteClient
        .from('hustle_show_sessions')
        .select('state,event_type')
        .eq('show_code', REMOTE_SHOW_CODE)
        .single();
      if (error) throw error;
      if (data?.state?.lastTxId) {
        this.handleIncomingState(data.state, data.event_type || 'remote_init', 'supabase');
      }

      this.remoteChannel = this.remoteClient
        .channel(`hustle-show-${REMOTE_SHOW_CODE}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'hustle_show_sessions',
          filter: `show_code=eq.${REMOTE_SHOW_CODE}`,
        }, (payload) => {
          if (payload.new?.state) {
            this.handleIncomingState(payload.new.state, payload.new.event_type || 'remote_update', 'supabase');
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') this.setRemoteStatus('connected', 'Cloud display sync is live.');
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') this.setRemoteStatus('offline', 'Cloud connection lost; local sync remains active.');
        });
    } catch (error) {
      console.warn('Supabase sync unavailable:', error);
      this.setRemoteStatus('offline', 'Cloud connection unavailable; local sync remains active.');
    }
  }

  async connectRemoteHost(pin) {
    const cleanPin = String(pin || '').trim();
    if (!/^\d{6}$/.test(cleanPin)) throw new Error('Enter the 6-digit host PIN.');
    this.remoteHostPin = cleanPin;
    const response = await this.pushRemoteState('host_connect');
    if (!response.ok) {
      this.remoteHostPin = '';
      throw new Error(response.error || 'Could not connect the controller.');
    }
    sessionStorage.setItem('hustle_remote_host_pin', cleanPin);
    this.setRemoteStatus('host', 'Phone controller is connected.');
    return true;
  }

  async pushRemoteState(eventType = 'update') {
    if (!this.remoteHostPin) return { ok: false, skipped: true };
    const stateSnapshot = JSON.parse(JSON.stringify(this.state));
    const pinSnapshot = this.remoteHostPin;
    const send = async () => this.sendRemoteState(stateSnapshot, eventType, pinSnapshot);
    this.remotePushQueue = this.remotePushQueue.then(send, send);
    return this.remotePushQueue;
  }

  async sendRemoteState(stateSnapshot, eventType, hostPin) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/hustle-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({
          showCode: REMOTE_SHOW_CODE,
          hostPin,
          state: stateSnapshot,
          eventType,
        }),
      });
      const result = await response.json().catch(() => ({}));
      return response.ok ? { ok: true } : { ok: false, error: result.error || 'Remote update failed.' };
    } catch (error) {
      this.setRemoteStatus('offline', 'Cloud update failed; local sync remains active.');
      return { ok: false, error: error.message };
    }
  }

  getRemoteInfo() {
    return { status: this.remoteStatus, showCode: REMOTE_SHOW_CODE, isHost: Boolean(this.remoteHostPin) };
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

    const isLegacyAssignmentState = !savedState.arenaSetup;
    return {
      ...DEFAULT_STATE,
      ...savedState,
      groups: Array.isArray(savedState.groups)
        ? savedState.groups.map((group) => ({
          ...group,
          player1: {
            ...group.player1,
            image: ALL_PLAYERS[group.player1?.name] || group.player1?.image,
            isRevealed: typeof group.player1?.isRevealed === 'boolean'
              ? group.player1.isRevealed
              : isLegacyAssignmentState,
          },
          player2: {
            ...group.player2,
            image: ALL_PLAYERS[group.player2?.name] || group.player2?.image,
            isRevealed: typeof group.player2?.isRevealed === 'boolean'
              ? group.player2.isRevealed
              : isLegacyAssignmentState,
          },
        }))
        : JSON.parse(JSON.stringify(DEFAULT_GROUPS)),
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
      arenaSetup: {
        ...DEFAULT_STATE.arenaSetup,
        ...(savedState.arenaSetup || {}),
      },
      presentationCue: {
        ...DEFAULT_STATE.presentationCue,
        ...(savedState.presentationCue || {}),
      },
      questionPromptCard: {
        ...DEFAULT_STATE.questionPromptCard,
        ...(savedState.questionPromptCard || {}),
      },
      gameInstructionCard: {
        ...DEFAULT_STATE.gameInstructionCard,
        ...(savedState.gameInstructionCard || {}),
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
    this.state.revision = (Number(this.state.revision) || 0) + 1;
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

    if (this.remoteHostPin) this.pushRemoteState(eventType);

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

  refreshRunningTimers() {
    ['timer', 'intermissionTimer'].forEach((key) => {
      const timer = this.state[key];
      if (!timer?.isRunning || !timer.targetEndTime) return;
      timer.seconds = Math.max(0, Math.ceil((timer.targetEndTime - Date.now()) / 1000));
      if (timer.seconds === 0) {
        timer.isRunning = false;
        timer.targetEndTime = null;
      }
    });
  }

  saveLocalTimerFrame(eventType) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Local timer frame could not be saved', e);
    }
    this.notifyListeners({ source: 'local-timer', eventType });
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
    const rosterWasComplete = this.state.groups.every((entry) =>
      entry.player1?.isRevealed && entry.player2?.isRevealed
    );

    if (slot === 'player1') {
      group.player1 = { name: newPlayerName, image: ALL_PLAYERS[newPlayerName], isRevealed: true };
    } else if (slot === 'player2') {
      group.player2 = { name: newPlayerName, image: ALL_PLAYERS[newPlayerName], isRevealed: true };
    }

    const revealedNames = [group.player1, group.player2]
      .filter((player) => player?.isRevealed)
      .map((player) => player.name);
    group.name = revealedNames.length ? revealedNames.join(' & ').toUpperCase() : group.id.replace('-', ' ').toUpperCase();
    const rosterIsComplete = this.state.groups.every((entry) =>
      entry.player1?.isRevealed && entry.player2?.isRevealed
    );
    if (rosterIsComplete && !rosterWasComplete) {
      this.state.arenaSetup.rosterCompleteNonce = (this.state.arenaSetup.rosterCompleteNonce || 0) + 1;
      this.saveAndBroadcast('roster_complete');
    } else {
      this.saveAndBroadcast('player_reshuffle');
    }
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
          this.saveLocalTimerFrame('timer_tick');
        }
      } else if (this.state.timer.seconds > 0) {
        this.state.timer.seconds -= 1;
        if (this.state.timer.seconds === 0) {
          this.state.timer.isRunning = false;
        }
        this.saveLocalTimerFrame('timer_tick');
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

  spotlightOnly(id) {
    const target = this.state.groups.find((group) => group.id === id && !group.isDisqualified);
    if (!target) return;
    this.state.groups.forEach((group) => { group.isPopUp = group.id === id; });
    this.saveAndBroadcast('spotlight_focus');
  }

  prepareContentTeam(id = null) {
    const target = this.state.groups.find((group) => group.id === id && !group.isDisqualified) || null;
    this.state.groups.forEach((group) => { group.isPopUp = Boolean(target && group.id === target.id); });
    if (this.state.questionPromptCard?.isVisible) {
      this.state.questionPromptCard.isVisible = false;
      this.state.questionPromptCard.nonce = (this.state.questionPromptCard.nonce || 0) + 1;
    }
    this.saveAndBroadcast('content_team_prepare');
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
    this.saveLocalTimerFrame('intermission_timer_tick');
  }

  enterArena() {
    this.state.arenaFocusNonce = (this.state.arenaFocusNonce || 0) + 1;
    if (!this.state.arenaSetup?.cardsDealt) {
      this.state.groups = this.state.groups.map((group, index) => ({
        ...group,
        name: `GROUP ${index + 1}`,
        player1: { ...group.player1, isRevealed: false },
        player2: { ...group.player2, isRevealed: false },
      }));
      this.state.arenaSetup = {
        ...this.state.arenaSetup,
        cardsDealt: true,
        dealNonce: (this.state.arenaSetup?.dealNonce || 0) + 1,
      };
    }
    this.saveAndBroadcast('arena_focus');
  }

  returnToMainMenu() {
    this.state.mainMenuFocusNonce = (this.state.mainMenuFocusNonce || 0) + 1;
    this.saveAndBroadcast('main_menu_focus');
  }

  triggerPresentationCue(kind, label) {
    this.state.presentationCue = {
      kind,
      label,
      nonce: (this.state.presentationCue?.nonce || 0) + 1,
    };
    this.saveAndBroadcast('presentation_cue');
  }

  showQuestionPromptCard(type, text, options = [], correctOptionIndex = null, teamId = null) {
    const cleanType = type === 'prompt' ? 'prompt' : 'question';
    const cleanText = String(text || '').trim();
    if (!cleanText) return;
    this.state.questionPromptCard = {
      isVisible: true,
      type: cleanType,
      text: cleanText,
      options: cleanType === 'question' && Array.isArray(options) ? options.slice(0, 4).map(String) : [],
      correctOptionIndex: cleanType === 'question' && Number.isInteger(correctOptionIndex) ? correctOptionIndex : null,
      selectedOptionIndex: null,
      answerRevealed: false,
      teamId: this.state.groups.some((group) => group.id === teamId) ? teamId : null,
      nonce: (this.state.questionPromptCard?.nonce || 0) + 1,
    };
    this.state.groups.forEach((group) => { group.isPopUp = false; });
    this.state.gameInstructionCard.isVisible = false;
    this.state.leaderboard.isVisible = false;
    this.saveAndBroadcast('question_prompt_show');
  }

  hideQuestionPromptCard() {
    if (!this.state.questionPromptCard?.isVisible) return;
    this.state.questionPromptCard = {
      ...this.state.questionPromptCard,
      isVisible: false,
      nonce: (this.state.questionPromptCard?.nonce || 0) + 1,
    };
    this.saveAndBroadcast('question_prompt_hide');
  }

  selectQuestionOption(optionIndex) {
    const card = this.state.questionPromptCard;
    const index = Number(optionIndex);
    if (!card?.isVisible || card.type !== 'question' || !Number.isInteger(index) || index < 0 || index >= card.options.length) return;
    card.selectedOptionIndex = index;
    card.answerRevealed = false;
    this.saveAndBroadcast('question_option_select');
  }

  revealQuestionAnswer() {
    const card = this.state.questionPromptCard;
    if (!card?.isVisible || card.type !== 'question' || !Number.isInteger(card.selectedOptionIndex)) return;
    card.answerRevealed = true;
    this.saveAndBroadcast('question_answer_reveal');
  }

  showGameInstruction(gameId, text) {
    const cleanGameId = Number(gameId);
    const cleanText = String(text || '').trim();
    if (![1, 2, 3].includes(cleanGameId) || !cleanText) return;
    this.state.gameInstructionCard = {
      isVisible: true,
      gameId: cleanGameId,
      text: cleanText,
      nonce: (this.state.gameInstructionCard?.nonce || 0) + 1,
    };
    this.state.questionPromptCard.isVisible = false;
    this.state.leaderboard.isVisible = false;
    this.saveAndBroadcast('game_instruction_show');
  }

  hideGameInstruction() {
    if (!this.state.gameInstructionCard?.isVisible) return;
    this.state.gameInstructionCard = {
      ...this.state.gameInstructionCard,
      isVisible: false,
      nonce: (this.state.gameInstructionCard?.nonce || 0) + 1,
    };
    this.saveAndBroadcast('game_instruction_hide');
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
    const currentRevision = Number(this.state.revision) || 0;
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.state.revision = currentRevision;
    this.saveAndBroadcast('reset');
  }

  clearAllData() {
    const currentRevision = Number(this.state.revision) || 0;
    localStorage.removeItem(STORAGE_KEY);
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.state.revision = currentRevision;
    this.saveAndBroadcast('clear_all_data');
  }
}

export const gameStateStore = new GameStateStore();
