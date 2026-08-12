# The Hustle — Digital Game Show Board

## Overview
A single-page digital game show board application designed for arena displays (1920x1080) and host admin show controls. Built around a 2-player team card format inspired by "THE HUSTLE Love & MONEY". Features real-time state synchronization across dual screens (Main Arena Display and Admin Control Screen) via BroadcastChannel and LocalStorage.

## Live Deployment & GitHub
- **Main Arena Board (v1 Live Stable):** [https://the-hustle-eight.vercel.app/](https://the-hustle-eight.vercel.app/)
- **Host Admin Control Panel:** [https://the-hustle-eight.vercel.app/admin](https://the-hustle-eight.vercel.app/admin)
- **GitHub Repository:** [https://github.com/JimiR3d/the-hustle](https://github.com/JimiR3d/the-hustle)

## Stack
- **Frontend:** HTML5, Modern CSS3 (CSS Grid, Flexbox, 3D Transforms, Custom Animations), Vanilla JavaScript (ES Modules)
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
│   │   ├── main.css     # Design tokens, background_v2 100% 100%, Team 1-5 container frames, DQ flight, mini-stack
│   │   └── admin.css    # Responsive host controller styling with Start/Pause/Stop/Reset timer buttons
│   └── js/
│       ├── state.js     # 5 Team state, ALL_PLAYERS dictionary, tickTimer, pause/stop/reset & dual-channel sync engine
│       ├── display.js   # Renderer, Apple Genie DQ flight controller, mini-stack & Web Audio spy alarm synthesizer
│       └── admin.js     # Host control panel logic, select dropdowns, quick presets & explicit timer buttons
```

## Conventions
- 5 Team Groups (Teams of 2 Players each = 10 competitors) arranged matching `Display Demo v3 (1).png`.
- Per-team container frame overlays (`team_container_t1.png` .. `team_container_t5.png`) with pixelated "TEAM N" header pills.
- Dynamic player reshuffling via Admin select dropdowns for Player 1 and Player 2.
- Full-bleed casino board background (`background_v2.png` with `100% 100%` fit) showing all bottom-left glasses, ice, deck, chips, and dice.
- High-contrast white rounded glass containers (`Single Group layout v2 (1).png`) with organic card angles (`rotate(-4.5deg)` / `rotate(4.5deg)`).
- Updated wide curved capsule Score Board pill (`score_board.png`) with pixelated LED score numbers (`VT323`).
- Explicit timer controls (**Start**, **Pause**, **Stop**, **Reset Timer**) on Admin bar; enlarged HUD timer badge with bold 38px clock.
- Disqualifications trigger a 2.8s 3-phase live motion sequence: Phase 1 (0.6s neon red flash aura) -> Phase 2 (1.0s slow smooth diagonal card tear cut in place on stage) -> Phase 3 (1.2s Apple Genie curved flight trajectory gliding across screen directly to bottom-right slot).
- Bottom-right mini-slots start 100% clean and empty when zero teams are disqualified; render recognizable miniature player card photos (`player1.image` and `player2.image`) with team labels when occupied.
- Remaining active team panels dynamically re-center themselves on the stage layout.
- Restoring disqualified teams immediately returns all 5 team cards to the active stage layout (3 top row, 2 bottom row).
- Card light sheen sweeps (`.card-white-light-reflection`) persist smoothly without resetting on point changes.
- Web Audio API spy countdown finish buzzer sound plays on `00:00` alongside ambient green flash.
- Floating green `+N` popups on point additions; floating red `-N` popups on point subtractions.

## Current State
- **Status:** v2 Redesign complete on `v2-redesign` branch, featuring Team 1-5 container frame overlays (`team_container_t1.png` .. `team_container_t5.png`), full-bleed `background_v2.png`, pixelated LED scores (`VT323`), tilted card pairs, Apple Genie disqualification flight, clean initial mini-slots, recognizable mini player card photos, 100% reliable 5-card restore, dynamic center alignment, enlarged HUD timer, and bug-free card sheen sweeps. Live Vercel site (`the-hustle-eight.vercel.app`) remains on `v1-live-stable` for stakeholder demo.

## Boundaries
- Single-page dual-view system; keep real-time sync simple, dependency-free, and bulletproof.
