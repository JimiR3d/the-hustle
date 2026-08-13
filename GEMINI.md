# The Hustle — Digital Game Show Board

## Overview
A single-page digital game show board application designed for arena displays (1920x1080) and host admin show controls. Built around a 2-player team card format inspired by "THE HUSTLE Love & MONEY". Features real-time state synchronization across dual screens (Main Arena Display and Admin Control Screen) via BroadcastChannel and LocalStorage.

## Live Deployment & GitHub
- **Main Arena Board (v1 Live Stable):** [https://the-hustle-eight.vercel.app/](https://the-hustle-eight.vercel.app/)
- **Host Admin Control Panel:** [https://the-hustle-eight.vercel.app/admin](https://the-hustle-eight.vercel.app/admin)
- **GitHub Repository:** [https://github.com/JimiR3d/the-hustle](https://github.com/JimiR3d/the-hustle)

## Stack
- **Frontend:** HTML5, Modern CSS3 (CSS Grid, Flexbox, 3D Transforms, CSS Masking), Vanilla JavaScript (ES Modules), WebGL (@paper-design/shaders)
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
├── index.html           # Main Display Screen (1920x1080 Arena view with VT323 pixel fonts & DQ stack)
├── admin.html           # Admin Control Screen (Host controller)
├── public/assets/       # Static assets (logo.png, background_v2.png, team_container_t1..t5.png, score_board.png, *.png)
├── src/
│   ├── css/
│   │   ├── main.css     # Design tokens, background_v2 100% 100%, Team 1-5 container frame masks, casino gold beam, DQ flight, 3D zoom spotlight
│   │   └── admin.css    # Responsive host controller styling with Start/Pause/Stop/Reset timer buttons
│   └── js/
│       ├── state.js     # 5 Team state, ALL_PLAYERS dictionary, tickTimer, pause/stop/reset & dual-channel sync engine
│       ├── display.js   # Renderer, WebGL Liquid Metal ShaderMount, Apple Genie DQ flight controller, spotlight manager & Web Audio alarm
│       └── admin.js     # Host control panel logic, select dropdowns, quick presets & explicit timer buttons
```

## Conventions
- 5 Team Groups (Teams of 2 Players each = 10 competitors) arranged matching `Display Demo v3 (1).png`.
- Designated row & slot layout: Teams 1, 2, 3 in Top Row (Slots 1, 2, 3); Teams 4, 5 in Bottom Row (Slots 4, 5).
- Restoring any disqualified team immediately returns it to its exact original slot index (e.g. Team 1 &rarr; Slot 1).
- Spotlight Centering: Spotlighted teams smoothly glide directly to the center underneath the Game Timer (`scale(1.22)` for 1 team, side-by-side arrangement for multiple teams with zero overlap).
- Returning from spotlight smoothly restores teams back to their exact designated home slots (Slots 1–5).
- 60fps GPU Performance: Persistent DOM nodes (structureKey does not destroy DOM on spotlight/points updates) with hardware-accelerated transforms.
- Spotlight Dimmer Isolation: The stage dark overlay activates exclusively on spotlighted teams; starting or running the timer never affects background darkness.
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
- **Status:** v2 Redesign complete on `v2-redesign` branch, featuring smooth spotlight centering under timer, multi-spotlight side-by-side arrangement, zero DOM re-render 60fps optimization, dimmer isolation (timer does not darken background), exact slot restoration ordering (Teams 1-5 always restore to original positions), spaced-out group layout, seamless crack-free player card photos, flat casino Team 1-5 container frame overlays with direct CSS mask glowing casino gold light beams (`#ffd700`, `#ffb300`, `#ffe57f`), top text overlay keeping "TEAM N" crisp on top of the beam, subtle WebGL Liquid Metal fluid shader from `@paper-design/shaders`, clean wide capsule scoreboard (`score_board.png`), transparent backdrop (no blurry glass), clean header pill spacing, direct card 3D sway breathing, full-bleed `background_v2.png`, pixelated LED scores (`VT323`), tilted card pairs, Apple Genie disqualification flight, clean initial mini-slots, recognizable mini player card photos, 100% reliable 5-card restore, dynamic center alignment, enlarged HUD timer, and bug-free card sheen sweeps. Live Vercel site (`the-hustle-eight.vercel.app`) remains on `v1-live-stable` for stakeholder demo.

## Boundaries
- Single-page dual-view system; keep real-time sync simple, dependency-free, and bulletproof.
