# The Hustle — Digital Game Show Board

## Overview
A single-page digital game show board application designed for arena displays (1920x1080) and host admin show controls. Built around a 2-player team card format inspired by "THE HUSTLE Love & MONEY". Features an opening 8-layer GSAP + Lenis Intro Parallax Screen that seamlessly scrolls down to reveal the Main Arena Board, with real-time state synchronization across dual screens (Main Arena Display and Admin Control Screen) via BroadcastChannel and LocalStorage.

## Live Deployment & GitHub
- **Main Arena Board (v1 Live Stable):** [https://the-hustle-eight.vercel.app/](https://the-hustle-eight.vercel.app/)
- **Host Admin Control Panel:** [https://the-hustle-eight.vercel.app/admin](https://the-hustle-eight.vercel.app/admin)
- **GitHub Repository:** [https://github.com/JimiR3d/the-hustle](https://github.com/JimiR3d/the-hustle)

## Stack
- **Frontend:** HTML5, Modern CSS3 (CSS Grid, Flexbox, 3D Transforms, CSS Masking, Custom Pink Scrollbars), Vanilla JavaScript (ES Modules), WebGL (@paper-design/shaders), GSAP, ScrollTrigger, Lenis
- **Fonts:** Google Fonts (`Cinzel`, `Outfit`, `VT323` pixel LED, `Silkscreen`)
- **Tooling / Dev Server:** Vite
- **Deployment & Sync:** Vercel + GitHub Continuous Integration, BroadcastChannel API + LocalStorage dual-channel sync engine
- **Audio:** Web Audio API (`AudioContext`) native sound synthesis for countdown alarms

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
├── index.html           # Main Display Screen (Intro Parallax Screen + 1920x1080 Arena view)
├── admin.html           # Admin Control Screen (Host controller)
├── public/assets/       # Static assets (logo.png, background_v2.png, team_container_t1..t5.png, score_board.png, *.png)
│   └── parallax/        # Parallax assets (sky.png, Buildings.png, Ground.png, PiggyBank.png, homeLogo.png, Hosts.png, signHustle.png, sponsoreLogoss.png)
├── src/
│   ├── css/
│   │   ├── main.css     # Design tokens, custom pink scrollbar, card shimmer mask, parallax scrolling layers, background_v2, Team 1-5 container frame masks, casino gold beam, DQ flight, 3D zoom spotlight
│   │   └── admin.css    # Responsive host controller styling with Start/Pause/Stop/Reset timer buttons
│   └── js/
│       ├── parallax.js  # GSAP ScrollTrigger multi-depth scrub timeline & Lenis smooth scrolling controller
│       ├── state.js     # 5 Team state, ALL_PLAYERS dictionary, tickTimer, pause/stop/reset & dual-channel sync engine
│       ├── display.js   # Renderer, FLIP layout animator, WebGL Liquid Metal ShaderMount, Apple Genie DQ flight controller, spotlight manager & Web Audio alarm
│       └── admin.js     # Host control panel logic, select dropdowns, quick presets & explicit timer buttons
```

## Conventions
- **Dedicated `.card-shimmer-mask` Layer:** Shimmer reflections are strictly clipped within the card's exact dimensions (`border-radius: 14px; overflow: hidden; pointer-events: none;`) without bleeding into the background or cropping the card image.
- **Unclipped Proportional Player Cards:** Set `object-fit: contain` on player card artwork so the full original card illustrations, suits, and borders remain 100% visible at all times.
- **Elimination FLIP Transitions:** When a team is eliminated, remaining active cards smoothly glide with 0.85s eased transitions into their newly centered layout using `animateLayoutFlip()` without snapping or jumping.
- **100% Transparent Card Tear Gaps:** Transparent player card slots ensure the stage background and casino table are clearly visible through the torn gap between card fragments during disqualification (zero white rectangular artifact).
- **Internal Pink Glowing Scrollbar:** Webpage features custom glowing pink scrollbar styling (`linear-gradient(180deg, #ff3399 0%, #ff0066 50%, #cc0052 100%)`).
- **Opening Intro Parallax Screen:** 8 visual layers composed to match `Layout (Final look).png` with smooth multi-plane depth scrub via GSAP ScrollTrigger and Lenis smooth scrolling.
- **Proportional Parallax Artwork:** All artwork layers (sky, buildings, ground, piggy bank, logo sign, hosts, roadside billboard, sponsors) scale proportionally without cropping.
- **Soft Atmospheric Section Blend:** Smooth gradient transition sitting at `z-index: 2` behind all interactive UI, host cards, and text (zero black rectangle divider).
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
- Disqualifications trigger a 2.8s 3-phase live motion sequence: Phase 1 (0.6s neon red flash aura) -> Phase 2 (1.0s slow smooth diagonal card tear cut in place on stage) -> Phase 3 (1.2s Apple Genie curved flight trajectory gliding across screen directly to bottom-right slot).
- Bottom-right mini-slots start 100% clean and empty when zero teams are disqualified; render recognizable miniature player card photos (`player1.image` and `player2.image`) with team labels when occupied.
- Remaining active team panels dynamically re-center themselves on the stage layout.
- Card light sheen sweeps (`.card-white-light-reflection`) persist smoothly without resetting on point changes.
- Web Audio API spy countdown finish buzzer sound plays on `00:00` alongside ambient green flash.
- Floating green `+N` popups on point additions; floating red `-N` popups on point subtractions.

## Current State
- **Status:** v2 Redesign complete on `v2-redesign` branch, featuring dedicated `.card-shimmer-mask` layer clipping the shimmer reflection strictly within card boundaries with zero bleed, unclipped `object-fit: contain` player cards, smooth elimination FLIP layout transitions, 100% transparent card tear gaps, internal custom pink scrollbar, smooth spotlight movement animations with easing, simultaneous spotlighting of up to 3 groups under the timer with zero overlap, soft atmospheric section blend fade behind content, non-cropped proportional parallax artwork layers, opening 8-layer GSAP + Lenis Intro Parallax Screen, asset preloading, dimmer isolation, exact slot restoration ordering, flat casino Team 1-5 container frame overlays with direct CSS mask glowing casino gold light beams, WebGL Liquid Metal fluid shader, and real-time dual-screen synchronization.

## Boundaries
- Single-page dual-view system; keep real-time sync simple, dependency-free, and bulletproof.
