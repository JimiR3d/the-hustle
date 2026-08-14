# The Hustle — Digital Game Show Board

## Overview
A single-page digital game show board application designed for arena displays (1920x1080) and host admin show controls. Built around a 2-player team card format inspired by "THE HUSTLE Love & MONEY". Features an opening 8-layer GSAP + Lenis Intro Parallax Screen with a centered, gently swinging hanging glass cash piggy bank that seamlessly scrolls down through a cinematic black transition buffer (`42vh`) to reveal the Main Arena Board, with real-time state synchronization across dual screens (Main Arena Display and Admin Control Screen) via BroadcastChannel and LocalStorage.

## Live Deployment & GitHub
- **Main Arena Board (v1 Live Stable):** [https://the-hustle-eight.vercel.app/](https://the-hustle-eight.vercel.app/)
- **Host Admin Control Panel:** [https://the-hustle-eight.vercel.app/admin](https://the-hustle-eight.vercel.app/admin)
- **GitHub Repository:** [https://github.com/JimiR3d/the-hustle](https://github.com/JimiR3d/the-hustle)

## Stack
- **Frontend:** HTML5, Modern CSS3 (CSS Grid, Flexbox, 3D Transforms, CSS Masking, Custom Pink Scrollbars), Vanilla JavaScript (ES Modules), WebGL (@paper-design/shaders), GSAP, ScrollTrigger, Lenis
- **Fonts:** Google Fonts (`Inter Bold 700`, `Outfit 400-900`), Self-Hosted Fonts (`Bitcount Single`, `Geist Pixel`)
- **Tooling / Dev Server:** Vite
- **Deployment & Sync:** Vercel + GitHub Continuous Integration, BroadcastChannel API + LocalStorage dual-channel sync engine with wall-clock targetEndTime synchronization
- **Audio:** Web Audio API (`AudioContext`) native sound synthesis & custom `Time_up.mp3` sound effects

## Commands
```bash
# Development
npm run dev              # Start local dev server with Vite (v2-redesign branch)

# Build & Preview
npm run build            # Build production bundle
npm run preview          # Preview production build

# Git Safety
git checkout v1-live-stable   # Restore original live v1 for stakeholder meeting
git checkout v2-redesign      # Switch back to v2 redesign development
```

## Project Structure
```
├── index.html           # Main Display Screen (Intro Parallax Screen + Buffer Section + 1920x1080 Arena view)
├── admin.html           # Admin Control Screen (Host controller with Winner selection & safety confirmation modals)
├── public/assets/       # Static assets (logo.png, background_v2.png, team_container_t1..t5.png, score_board.png, Time_up.mp3, Times_up.png, WinnerIcon.png, coins/*.png)
│   ├── fonts/           # Self-hosted webfonts (bitcount-single/*.woff2, geist-pixel/*.woff2)
│   ├── coins/           # Coin assets (Coin1.png, Coin2.png, Coin3.png)
│   └── parallax/        # Parallax assets (sky.png, Buildings.png, Ground.png, PiggyBank.png, homeLogo.png, Hosts.png, signHustle.png, sponsoreLogoss.png)
├── src/
│   ├── css/
│   │   ├── main.css     # Design tokens, custom pink scrollbar, card shimmer mask, piggy pendulum swing, 3-section transition, Team 1-5 container frame masks, casino gold beam, DQ flight, 3D zoom spotlight, Time's Up overlay & 70% backdrop, Winner celebration 65% backdrop & coin rain
│   │   └── admin.css    # Responsive host controller styling with Start/Pause/Stop/Reset timer buttons, Winner selection and safety confirmation modals
│   └── js/
│       ├── parallax.js  # GSAP ScrollTrigger multi-depth scrub timeline & Lenis smooth scrolling controller (3.0s cinematic auto-scroll)
│       ├── state.js     # 5 Team state, ALL_PLAYERS dictionary, tickTimer, pause/stop/reset, wall-clock targetEndTime, declareWinner, clearWinner & dual-channel sync engine
│       ├── display.js   # Renderer, FLIP layout animator, WebGL Liquid Metal ShaderMount, Apple Genie DQ flight controller, spotlight manager, Time's Up sequence, Winner celebration centering & coin rain engine
│       └── admin.js     # Host control panel logic, select dropdowns, quick presets, explicit timer buttons, Winner selection & safety confirmation modals
```

## Conventions
- **Winner Selection & Winner Celebration System:**
  - Control Panel features standalone gold **🏆 WINNER** button at the bottom.
  - Clicking WINNER opens **SELECT YOUR WINNER** modal listing all available groups with live state binding.
  - Selecting a group and clicking **CONFIRM WINNER** displays a safety confirmation modal (*"Are you sure you want to declare [Selected Team] as the winner?"*) with CANCEL and CONFIRM options.
  - Confirming broadcasts `state.winnerGroupId` and triggers the Winner Celebration on the Game section:
    - **True Full-Viewport 65% Dark Backdrop (`rgba(0, 0, 0, 0.65)`):** Mounted directly to `document.body` at `z-index: 9000;`, covering the entire viewport edge-to-edge with zero transform containment traps.
    - **Main "The Hustle" Logo Elevation:** Sits at `z-index: 9200;` above the dark overlay in its normal header position, remaining 100% bright and clearly visible.
    - **Winning Group Centering & Scaling:** Hardware-accelerated 0.85s eased transform glides the winning team to exact center stage (`scale: 1.50`, centered at `960px, 460px`, `z-index: 9500;`).
    - **Hidden Scoreboard & Group Border:** The outer team border and scoreboard capsule are temporarily hidden during Winner mode (`opacity: 0 !important;`) without modifying underlying state.
    - **Compact Winner Crown Logo (`WinnerIcon.png`):** Scaled 45% smaller (`width: 188px;`, ~55% of previous size) and layered at `bottom: -44px;` (`z-index: 9600;`) across the lower portion of the cards, acting as a clean banner underneath without obscuring player faces or card artwork.
    - **Continuous Coin Rain Engine:** Mounted to `document.body` at `z-index: 9900;`, spawning `Coin3.png` as dominant coin (100% prominence) and `Coin1.png`/`Coin2.png` as variation (40% prominence) with randomized 3D tumbling, rotation, speed, and horizontal drift across the full screen.
    - **Dedicated Red ✕ Exit Button:** Displayed in the winner control section on the Admin panel to cleanly exit Winner mode and smoothly restore the stage.
- **Time's Up Sequence & 70% Dark Backdrop:**
  - When timer reaches `00:00`, fires once per completion.
  - Plays `Time_up.mp3` in perfect sync with the visual entrance.
  - Fades a 70% dark backdrop (`rgba(0, 0, 0, 0.70)`) across the Game section in `0.25s` to make the logo pop while keeping the game faintly visible.
  - Logo (`Times_up.png`) sits in front of the backdrop at `z-index: 2` and remains 100% crisp and sharp (zero blur, zero added glow) throughout the entire animation.
  - Alternates direction each trigger: 1st (Left &rarr; Center &rarr; Right), 2nd (Right &rarr; Center &rarr; Left), 3rd (Left &rarr; Center &rarr; Right), etc.
  - Dynamic 3-phase sequence: Fast entrance (small &rarr; moderate) &rarr; dramatic slow-down center moment (sharp crystal-clear reading) &rarr; fast exit acceleration (moderate &rarr; small).
  - Dark backdrop smoothly fades out (`0.35s`) as the logo exits, returning the stage to its previous brightness without altering active spotlights or layout.
- **Typography & Font System:**
  - `Inter Bold` (weight `700`): Primary branding, headings, and Enter Arena button.
  - `Outfit` (weights `400-900`): Player names, controls, and Admin Control Panel.
  - `Bitcount Single`: Digital LED countdown timer digits (`38px`) and score numbers.
  - `Geist Pixel`: Pixel scoreboard labels and pill text (`.group-name-text`).
- **3-Section Transition Architecture:**
  - Section 1 (Main Menu): Strict containment (`overflow: hidden;`) with fixed bottom black gradient overlay (`.main-menu__bottom-fade` at `260px` height, `z-index: 5`) that darkens the environmental background and billboard sign behind Hosts and Sponsor UI.
  - Section 2 (Black Buffer): Dedicated solid black cinematic buffer (`.transition-buffer-section` at `42vh` height, `min-height: 340px`).
  - Section 3 (Game Section): Top black gradient overlay (`.game-section__top-fade` at `240px` height, `z-index: 5`) sitting beneath `#app-stage` (`z-index: 15`) and header logo/timers (`z-index: 100`).
- **Main Logo & Piggy Bank Exact Centering:** Centered horizontally relative to the Main Menu section with `left: 0; right: 0; margin: 0 auto;`, locking both elements onto the exact horizontal center axis with zero transform conflict.
- **Enter Arena Button Styling & Positioning:** Gold/yellow by default with black text and radiant golden glow, transitioning with cubic-bezier easing to translucent black on hover with gold text. Centered vertically at `bottom: 13.5vh;` in the space between the main logo and sponsor logos.
- **Environmental Multi-Depth Parallax Hierarchy:**
  - Sky: Slowest movement (`yPercent: 12`).
  - Buildings: Medium-speed upward parallax (`yPercent: -18`), centered with `left: 0; right: 0; margin: 0 auto;` (zero transform conflict).
  - Ground: Fastest foreground layer (`yPercent: -38`), positioned at `bottom: -38vh;`.
- **Foreground UI Stacking & Natural Scrolling:**
  - Main Menu: Hosts (`z-index: 12`), Sponsors (`z-index: 12`), Main Logo (`z-index: 10`), Piggy Bank (`z-index: 14`), and Enter Button (`z-index: 20`) sit cleanly ABOVE the bottom gradient and scroll naturally without GSAP parallax displacement.
  - Billboard Sign (`.layer-sign` at `z-index: 4`): Sits BEHIND the bottom gradient, smoothly fading into black while scrolling naturally at 1:1 page speed.
  - Game Section: Game Logo and dynamic HUD Timer sit cleanly ABOVE the top gradient.
- **Cinematic 3.0s Auto-Scroll:** "ENTER GAME SHOW ARENA" button scrolls via Lenis with a 3.0s `easeInOutCubic` easing curve, letting the user watch the GSAP multi-plane parallax timeline before revealing the Game Section.
- **Hanging Piggy Bank Centering & Pendulum Sway:** Positioned with `left: 0; right: 0; margin: 0 auto;` so horizontal centering is 100% immune to transform overwrites. Fixed anchor point at `transform-origin: 50% 0%` where strings meet top of screen, swaying gently in front of the main logo (`z-index: 14`) with 4.8s `ease-in-out` continuous alternate rotation between `-3.5deg` and `+3.5deg`.
- **Dedicated `.card-shimmer-mask` Layer:** Shimmer reflections are strictly clipped within the card's exact dimensions (`border-radius: 14px; overflow: hidden; pointer-events: none;`) without bleeding into the background or cropping the card image.
- **Unclipped Proportional Player Cards:** Set `object-fit: contain` on player card artwork so the full original card illustrations, suits, and borders remain 100% visible at all times.
- **Elimination FLIP Transitions:** When a team is eliminated, remaining active cards smoothly glide with 0.85s eased transitions into their newly centered layout using `animateLayoutFlip()` without snapping or jumping.
- **100% Transparent Card Tear Gaps:** Transparent player card slots ensure the stage background and casino table are clearly visible through the torn gap between card fragments during disqualification (zero white rectangular artifact).
- **Internal Pink Glowing Scrollbar:** Webpage features custom glowing pink scrollbar styling (`linear-gradient(180deg, #ff3399 0%, #ff0066 50%, #cc0052 100%)`).
- **Opening Intro Parallax Screen:** 8 visual layers composed to match `Layout (Final look).png` with smooth multi-plane depth scrub via GSAP ScrollTrigger and Lenis smooth scrolling.
- **Proportional Parallax Artwork:** All artwork layers scale proportionally without cropping.
- **Pre-loading Strategy:** While viewing the intro screen, game board card images and WebGL Liquid Metal shaders are preloaded in memory, eliminating runtime lag upon scrolling down.
- **Up to 3 Groups Spotlighted Simultaneously:** Selecting additional groups preserves existing spotlighted groups up to a maximum of 3 (selecting a 4th is locked until one is deselected).
- **Smooth Eased Spotlight Movement:** Hardware-accelerated 0.8s cubic-bezier eased transforms glide groups from their original home slot to the spotlight area underneath the timers and back without snapping or teleporting.
- **Spotlight Centering Under Timers:**
  - 1 Group: Centered at `x: 960px`, `scale: 1.20`.
  - 2 Groups: Side-by-side at `x: 690px` and `x: 1230px`, `scale: 1.10`.
  - 3 Groups: Balanced 3 across at `x: 465px`, `x: 960px`, and `x: 1455px`, `scale: 1.02`.
- **Spotlight Dimmer Isolation:** The stage dark overlay activates exclusively when at least one group is spotlighted; starting, pausing, or running the timer never affects background darkness.
- **Exact Slot Restoration:** Restoring any disqualified team returns it directly to its exact original slot index (e.g. Team 1 &rarr; Slot 1).
- 5 Team Groups (Teams of 2 Players each = 10 competitors) arranged matching `Display Demo v3 (1).png`.
- Spaced out team grid (`gap: 65px` horizontal, `gap: 38px; margin-top: 15px` vertical) occupying arena canvas space with balanced breathing room.
- Seamless player card photos (`.card-full-face`) with zero subpixel cracks or seams during active play.
- Per-team container frame overlays (`team_container_t1.png` .. `team_container_t5.png`) lying 100% flat on the transparent casino board table without any blurry glass backdrop.
- Direct casino gold light beam animation via CSS `mask-image: url('/assets/team_container_t1.png')` .. `t5.png`, illuminating the exact pixel contours of the container border and top "TEAM N" pill with zero duplicate lines.
- Layered `.team-container-top-overlay` at `z-index: 10` ensuring "TEAM 1" through "TEAM 5" black pixel text stays 100% sharp and visible on top of the passing gold light beam.
- Subtle WebGL Liquid Metal fluid shader from `@paper-design/shaders` mounted inside each scoreboard capsule pill (`Liquid Metal button.txt`).
- Dynamic player reshuffling via Admin select dropdowns for Player 1 and Player 2.
- Full-bleed casino board background (`background_v2.png` with `100% 100%` fit) showing all bottom-left glasses, ice, deck, chips, and dice.
- Cards sit cleanly below the "TEAM N" header pill (`padding-top: 52px`) without any overlap.
- Organic 3D tilt breathing sway animations (`card-sway-p1` and `card-sway-p2`) applied directly onto player cards (`rotate(-4.5deg)` / `rotate(4.5deg)`).
- Explicit timer controls (**Start**, **Pause**, **Stop**, **Reset Timer**) on Admin bar; enlarged HUD timer badge with bold 38px clock.
- Disqualifications trigger a 2.8s 3-phase live motion sequence: Phase 1 (0.6s neon red flash aura) -> Phase 2 (1.0s slow smooth diagonal card tear cut in place on stage) -> Phase 3 (1.2s Apple Genie curved flight trajectory glides across screen directly to bottom-right slot).
- Bottom-right mini-slots start 100% clean and empty when zero teams are disqualified; render recognizable miniature player card photos (`player1.image` and `player2.image`) with team labels when occupied.
- Remaining active team panels dynamically re-center themselves on the stage layout.
- Card light sheen sweeps (`.card-white-light-reflection`) persist smoothly without resetting on point changes.
- Floating green `+N` popups on point additions; floating red `-N` popups on point subtractions.

## Current State
- **Status:** Winner Selection & Winner Celebration system complete on `v2-redesign` branch, featuring standalone WINNER button on control panel, Select Your Winner modal with live state options, safety confirmation popup, 65% dark Game background overlay, smooth winning group centering on stage, prominent uploaded Winner crown logo (`WinnerIcon.png`), continuous randomized 3D coin rain (`Coin3.png` 100% dominant, `Coin1.png` and `Coin2.png` 40% variation), smooth reset with END WINNER DISPLAY, Time's Up size scaled down and extra glow removed, wall-clock timer synchronization, typography modernized to Inter Bold 700, Bitcount Single, and Geist Pixel, exact main logo section horizontal centering locked 1:1 with the swinging hanging piggy bank, restored medium-speed buildings parallax, gold-yellow default Enter Arena button with black hover centered vertically between logo and sponsors, calibrated 42vh black transition buffer section, billboard sign fading behind bottom gradient with natural 1:1 scrolling, slow cinematic 3.0s auto-scroll via Lenis, foreground UI elements layered crisply above transition gradients, environmental-only GSAP parallax scrubbing, strict containment clipping, top/bottom black gradient fades, balanced ground and city skyline elevation, centered hanging piggy bank from top anchor point with continuous pendulum sway, accurate logo sizing without added glow, enlarged piggy bank in front of logo, clean separation between arena button and sponsor logos, dedicated `.card-shimmer-mask` layer clipping shimmer strictly within card boundaries with zero bleed, unclipped `object-fit: contain` player cards, smooth elimination FLIP layout transitions, 100% transparent card tear gaps, internal custom pink scrollbar, smooth spotlight movement animations with easing, simultaneous spotlighting of up to 3 groups under the timer with zero overlap, asset preloading, dimmer isolation, exact slot restoration ordering, flat casino Team 1-5 container frame overlays with direct CSS mask glowing casino gold light beams, WebGL Liquid Metal fluid shader, and real-time dual-screen synchronization.

## Boundaries
- Single-page dual-view system; keep real-time sync simple, dependency-free, and bulletproof.
