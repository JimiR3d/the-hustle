# The Hustle — Digital Game Show Board

## Overview
A single-page digital game show board application designed for arena displays (1920x1080) and host admin show controls. Built around a 2-player team card format inspired by "THE HUSTLE Love & MONEY". Features real-time state synchronization across dual screens (Main Arena Display and Admin Control Screen) via BroadcastChannel and LocalStorage.

## Live Deployment & GitHub
- **Main Arena Board:** [https://the-hustle-eight.vercel.app/](https://the-hustle-eight.vercel.app/)
- **Host Admin Control Panel:** [https://the-hustle-eight.vercel.app/admin](https://the-hustle-eight.vercel.app/admin)
- **GitHub Repository:** [https://github.com/JimiR3d/the-hustle](https://github.com/JimiR3d/the-hustle)

## Stack
- **Frontend:** HTML5, Modern CSS3 (CSS Grid, Flexbox, 3D Transforms, Custom Animations), Vanilla JavaScript (ES Modules)
- **Tooling / Dev Server:** Vite
- **Deployment & Sync:** Vercel + GitHub Continuous Integration, BroadcastChannel API + LocalStorage dual-channel sync engine
- **Audio:** Web Audio API (`AudioContext`) native sound synthesis for countdown alarms

## Commands
```bash
# Development
npm run dev              # Start local dev server with Vite

# Build & Preview
npm run build            # Build production bundle
npm run preview          # Preview production build

# Deployment
git push origin master   # Automatically deploys to Vercel production
```

## Project Structure
```
├── index.html           # Main Display Screen (1920x1080 Arena view)
├── admin.html           # Admin Control Screen (Host controller)
├── public/assets/       # Static assets served at root (logo.png, background.png, back_glass.png, score_board.png, *.png)
├── src/
│   ├── css/
│   │   ├── main.css     # Design tokens, team layout, back_glass, white/pink edge, 1.7x timer zoom, line-free bg
│   │   └── admin.css    # Responsive host controller styling with Start/Pause/Stop/Reset timer buttons
│   └── js/
│       ├── state.js     # 5 Team state, ALL_PLAYERS dictionary, tickTimer, pause/stop/reset & dual-channel sync engine
│       ├── display.js   # Display screen renderer, card animation controller & Web Audio spy alarm synthesizer
│       └── admin.js     # Host control panel logic, select dropdowns, quick presets & explicit timer buttons
```

## Conventions
- 5 Team Groups (Teams of 2 Players each = 10 competitors) arranged matching `Display Demo v2.png` (3 top row, 2 bottom row centered).
- Dynamic player reshuffling via Admin select dropdowns for Player 1 and Player 2.
- 100% borderless, line-free full-screen arena background (`background.png` with `background-size: cover`) on all monitor aspect ratios.
- Liquid back glass container (`back_glass.png`) with white/pink translucent glass edge effect.
- Wider Score Board pill (`240px`) at bottom center displaying team name and digital LED score (`75`).
- Explicit timer controls (**Start**, **Pause**, **Stop**, **Reset Timer**) on Admin bar; timer auto-zooms to 1.7x scale when active.
- Web Audio API spy countdown finish buzzer sound plays on `00:00` alongside ambient green flash.
- Floating green `+N` popups on point additions; floating red `-N` popups on point subtractions.
- Textless disqualification split on team card pairs.

## Current State
- **Status:** Complete 2-Player Team MVP live on Vercel (`the-hustle-eight.vercel.app`), connected to GitHub (`JimiR3d/the-hustle`), featuring 1920x1080 Arena display, Host Admin controller with live player reshuffling dropdowns, dual-channel zero-latency state sync, explicit Start/Pause/Stop/Reset timer controls, Web Audio spy countdown buzzer sound, line-free edge-to-edge background fitting, and textless card tearing splits.

## Boundaries
- Single-page dual-view system; keep real-time sync simple, dependency-free, and bulletproof.
