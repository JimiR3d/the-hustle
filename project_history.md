# Project History — The Hustle Game Show Board

## Session Log

### Session 2026-08-10 — Initial Dual-Screen Architecture & Casino Card System
**Tasks completed:**
- Built 1920x1080 Arena Display (`index.html`) and Host Control Panel (`admin.html`).
- Implemented `BroadcastChannel` + `localStorage` real-time state synchronization engine in `src/js/state.js`.
- Implemented 3D pop-up spotlight and jagged card tearing split animation for disqualifications.

### Session 2026-08-10 — Card Aesthetics & White Glass Reflection Refinement
**Tasks completed:**
- Reduced card dimensions to `210px x 310px` for a proportional layout across the 1920x1080 canvas.
- Moved score badge pills to the very bottom edge of each card (`bottom: -15px`).
- Updated disqualification tearing so broken cards tilt slightly to the right (`5.5deg`).
- Added floating green plus sign popups (`+1`, `+5`) and green badge lighting on point additions.
- Fixed active card seam lines by rendering seamless full card faces on non-disqualified cards.
- Replaced light effects with a single wide transparent white glass reflection sweep (`card-white-light-reflection`) passing top-left to bottom-right across cards while preserving the gentle 3D tilt breathing loop.

### Session 2026-08-10 — 2-Player Team Group Layout & Website Asset Integration
**Tasks completed:**
- Transformed layout into 5 Team Groups (Teams of 2 Players each = 10 competitors) matching `Display Demo v2.png` (3 top row, 2 bottom row centered).
- Integrated website assets: `background.png` (arena background), `logo.png` (header logo), `back_glass.png` (liquid glass panel container), `score_board.png` (group score badge), and 10 high-resolution player cards (`Adrian.png`, `Aphro.png`, `Chidera.png`, `Chinazom.png`, `EZ.png`, `Kitan.png`, `Marty.png`, `Tayo.png`, `Teslim.png`, `kIA.png`).
- Added floating red `-1`/`-5` text popups and red score badge flashes on point subtractions.
- Spotlight ("Bring Forward") brings the entire 2-player team panel forward in 3D space (`scale(1.22)`).
- Textless card tearing splits for disqualified teams.

### Session 2026-08-10 — Member Reshuffling, Dual Sync, Timer Auto-Zoom & UI Polish
**Tasks completed:**
- Added Player 1 & Player 2 select dropdowns on Admin panel for live player reshuffling.
- Enhanced dual-channel sync (`BroadcastChannel` + `localStorage` storage events with `lastTxId` deduplication) for 100% instant real-time sync across multi-window browser setups.
- Expanded `.group-score-pill` width to `240px` and text width to `210px` so long names (`CHIDERA & CHINAZOM`) fit comfortably.
- Added quick `5m` (`05:00`) and `10m` (`10:00`) timer preset buttons on Admin bar.
- Implemented timer auto-zoom (`1.7x` scale) whenever the timer starts counting.
- Softened zero countdown full-page green flash (`brightness(1.35)`) to a clean ambient backdrop glow.
- Updated liquid back glass edge animation to a translucent white/pink glass glow.
- Staggered glistening sheen animation delays across player card slots.
- Made `.competitor-row` in Admin UI fully responsive for half-screen split windows (`958px` width).

### Session 2026-08-10 — Borderless Stage, Explicit Timer Controls & Web Audio Alarm
**Tasks completed:**
- Removed all inset box shadows and dark edge pseudoelements from `#app-stage`, rendering a 100% borderless, line-free background throughout.
- Added explicit **▶ Start**, **⏸ Pause**, **⏹ Stop**, and **🔄 Reset Timer** buttons on the Admin control panel.
- Synthesized a dramatic Web Audio API spy countdown finish buzzer sound that triggers simultaneously with the green flash when the timer reaches `00:00`.

### Session 2026-08-11 — Rename to 'the-hustle', GitHub Repository & Vercel Integration
**Tasks completed:**
- Renamed project from `ellis-game-show-board` to `the-hustle` in `package.json` and Vercel configuration.
- Created public GitHub repository [JimiR3d/the-hustle](https://github.com/JimiR3d/the-hustle) and pushed full codebase.
- Connected Vercel project `the-hustle` directly to GitHub repository `JimiR3d/the-hustle` for automatic CI/CD deployments on git push.
- Moved player card assets to `public/assets/` for static Vercel production bundle serving.
- Completed end-to-end live browser testing on `https://the-hustle-eight.vercel.app` and `https://the-hustle-eight.vercel.app/admin`.

### Session 2026-08-13 — Parallax Ground Direction, Low Base Ground, Overflow & Fade Transition
**Tasks completed:**
- Reversed ground parallax direction (`yPercent: -45`) in `src/js/parallax.js` so scrolling down moves ground upward naturally as foreground passes viewer.
- Positioned `.layer-ground` base resting position significantly lower (`bottom: -48vh;`) and `.layer-buildings` (`bottom: 0vh;`), revealing full Vegas skyline before ground begins.
- Set `overflow: visible;` on intro parallax section and visuals container, preventing Host cards and roadside sign from being clipped across section boundaries.
- Refined atmospheric feathered gradient fade (`height: 320px; z-index: 4;`) layered above ground/sky and behind all foreground UI elements.
- Centered `.layer-piggy-wrapper` using `left: 0; right: 0; margin: 0 auto;`, completely avoiding any transform conflict with GSAP parallax or CSS rotation.
- Updated assets with latest `Buildings.png` and `Ground.png`.
- Added subtle continuous swinging pendulum animation to the hanging piggy bank (`transform-origin: 50% 0%` with `@keyframes piggy-pendulum-swing` 4.8s `ease-in-out` sway between `-3.5deg` and `+3.5deg`).
- Scaled down main logo to match reference `Layout (Final look).png` and removed added artificial glow/bloom (`filter: none;`).
- Enlarged hanging piggy bank and layered it in front of the logo at `z-index: 12` so it overlaps the logo's top marquee diamond.
- Positioned "ENTER GAME SHOW ARENA" button above sponsor logos with clear spacing (`bottom: 7.5vh;` vs `bottom: 2vh;`).
- Implemented dedicated `.card-shimmer-mask` clipping layer for all player cards, strictly clipping the moving light sweep within card boundaries and eliminating background shimmer bleed.
- Preserved 100% full player card artwork and aspect ratio with `object-fit: contain`.
- Implemented `animateLayoutFlip()` in `display.js` to ensure remaining active team cards smoothly glide into their newly centered layout with 0.85s eased transitions when a team is eliminated (zero snapping/jumping).
- Removed solid white background (`#fffbf7`) from `.player-card-slot`, ensuring 100% transparent backgrounds between torn card fragments so underlying game board and table remain visible through the torn gap.
- Added internal custom pink glowing scrollbar track and thumb matching the casino neon theme.
- Upgraded the spotlight system to support up to 3 groups simultaneously (`state.js`), preventing 4th group selection until one is deselected.
- Balanced layout underneath timers for 1 group (`x: 960px, scale: 1.20`), 2 groups (`x: 690px / 1230px, scale: 1.10`), and 3 groups (`x: 465px / 960px / 1455px, scale: 1.02`) with zero overlap.
- Fixed DOM insertion lifecycle in `display.js` so elements remain mounted, enabling silky smooth eased animations (`transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)`) moving in and out of spotlight without snapping.
- Proportional non-cropped scaling applied to all 8 parallax layers (`sky.png`, `Buildings.png`, `Ground.png`, `PiggyBank.png`, `homeLogo.png`, `Hosts.png`, `signHustle.png`, `sponsoreLogoss.png`).
- Pushed updates to GitHub `v2-redesign`.
