const SHOW_ASSETS = [
  '/assets/background_v2.webp', '/assets/logo.webp', '/assets/WinnerIcon.webp',
  '/assets/Times_up.webp', '/assets/cards/CardBack.webp',
  '/assets/questions-prompts/QuestionCard.webp', '/assets/questions-prompts/PromptCard.webp',
  '/assets/game-instructions/Game1.webp', '/assets/game-instructions/Game2.webp',
  '/assets/game-instructions/Game3.webp',
  '/assets/parallax/sky.webp', '/assets/parallax/Buildings.webp', '/assets/parallax/Ground.webp',
  '/assets/parallax/PiggyBank.webp', '/assets/parallax/homeLogo.webp', '/assets/parallax/Hosts.webp',
  '/assets/parallax/signHustle.webp', '/assets/parallax/sponsoreLogoss.webp',
  '/assets/Adrian.webp', '/assets/Aphro.webp', '/assets/Chidera.webp', '/assets/Chinazom.webp',
  '/assets/EZ.webp', '/assets/Kitan.webp', '/assets/Marty.webp', '/assets/Tayo.webp',
  '/assets/Teslim.webp', '/assets/kIA.webp',
  '/assets/team_container_t1.png', '/assets/team_container_t2.png',
  '/assets/team_container_t3.png', '/assets/team_container_t4.png',
  '/assets/team_container_t5.png', '/assets/score_board.png',
  '/assets/coins/Coin1.png', '/assets/coins/Coin2.png', '/assets/coins/Coin3.png',
  '/assets/Time_up.mp3',
];

let activePreload = null;
let failedAssets = [];

async function warmAsset(url) {
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  await response.arrayBuffer();
}

export function preloadShowAssets(onProgress, forceRetry = false) {
  if (activePreload && !forceRetry) return activePreload;
  const queue = forceRetry && failedAssets.length ? [...failedAssets] : [...SHOW_ASSETS];
  let loaded = 0;
  failedAssets = [];
  onProgress?.({ loaded, total: queue.length, failed: [], complete: false });

  activePreload = Promise.all(queue.map(async (url) => {
    try { await warmAsset(url); } catch { failedAssets.push(url); }
    loaded += 1;
    onProgress?.({ loaded, total: queue.length, failed: [...failedAssets], complete: loaded === queue.length });
  })).then(() => ({ loaded, total: queue.length, failed: [...failedAssets] }));
  return activePreload;
}

export function retryFailedShowAssets(onProgress) {
  activePreload = null;
  return preloadShowAssets(onProgress, true);
}

export function unlockAudioOnFirstGesture() {
  const unlock = () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      const context = new AudioContextClass();
      context.resume().finally(() => context.close());
    }
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, { capture: true, once: true });
  window.addEventListener('keydown', unlock, { capture: true, once: true });
}
