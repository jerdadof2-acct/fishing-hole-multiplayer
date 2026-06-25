# Halley's Big Catch 🎣

A purrfect multiplayer fishing tournament game with physics-based fishing, deep progression, and soon-to-launch social features.

## 🎮 Game Features

- 🐱 **Cat-Themed Competition** – Face lovable rivals like “Sly Sylvester” and “Tommy the Stray”
- 🎣 **Realistic Fishing** – Physics-driven casting, reeling, and fish behavior across ponds, rivers, lakes, and oceans
- 🏆 **Multiplayer Tournaments** – Fair-play events where mega fish can tip the scales (Render-hosted backend)
- 📊 **Leaderboards & Progression** – Track biggest fish, level up through exponential XP tiers, and unlock new tackle
- 💾 **Cloud Saves** – Username-based profiles persist via PostgreSQL when the backend is connected
- 🤝 **Friends System (WIP)** – Share your friend code, manage requests, and view future crew activity in a dedicated tab
- 🎧 **Immersive Polish** – Modern UI, cat sound effects, and animated environments powered by Three.js

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Modern web browser
- PostgreSQL (for cloud saves / Render deployment)

### Installation
```bash
git clone https://github.com/jerdadof2-acct/fishing-hole-multiplayer.git
cd "Halley's Big Catch"
npm install
```

### Running Locally
```bash
# Launch the backend API (Express + PostgreSQL)
npm run dev

# Production mode
npm start
```

Open `index.html` directly (or serve it) to play. The client checks `/api/health`; if the backend is unavailable it automatically falls back to offline/localStorage mode.

## 🔐 Cloud Saves & Friend Codes

- On first launch, the game prompts for a username and registers it with the backend (when available).
- Progress (level, stats, fish collection) syncs via `/api/players/*` endpoints.
- By default the frontend targets `/api`; override with:
  ```html
  <script>
    window.__API_BASE_URL__ = 'https://kitty-creek.onrender.com/api';
  </script>
  ```
  or `<meta name="halleys-big-catch-api-base" content="https://your-domain/api">`.
- Offline play still tracks everything locally; the new Friends tab shows your friend code (or “OFFLINE” when disconnected) and includes copy/add affordances ready for backend integration.

## 📁 Project Structure

```
Halley's Big Catch/
├── index.html              # Main entry point
├── src/
│   ├── bootstrap.js        # Auth bootstrap + offline fallback
│   ├── main.js             # Core scene/game setup
│   ├── player.js           # Player progression & sync
│   ├── ui.js               # Tabs, modals, HUD, friends UI
│   └── …                   # Fishing, physics, audio, etc.
├── server/
│   ├── index.js            # Express API (ESM)
│   └── schema.sql          # PostgreSQL schema
├── assets/                 # Audio, GLBs, textures, images
└── css/styles.css          # Game styles
```

## 🗺️ Mechanics Snapshot

- **Progressive pacing** – Cast/wait timers scale from quick (Lv 1–5) to very deliberate (Lv 16+).
- **Experience curve** – Exponential XP requirements (e.g., Lv 10→11: 5,000 XP; Lv 15→16: 20,000+).
- **Economy** – Exponential pricing across rods, reels, lines, hooks, and baits ($0 → $100,000).
- **Achievements & Collection** – Tiered achievements, 33 fish types, top-catch tracking, and instanced leaderboards.
- **Upcoming** – Friends activity feed, live tournaments, extra locations, and real-time multiplayer hooks.

## 🛠️ Environment Variables
Create `.env` (or configure Render environment variables):
```env
DATABASE_URL=postgresql://user:pass@host:port/dbname
PORT=3000
NODE_ENV=development
```

## 📦 Deployment on Render

**Live site:** https://kitty-creek.onrender.com

1. Create a Render web service and link this GitHub repo.
2. Add a Render PostgreSQL instance; set `DATABASE_URL` on the web service.
3. Run the schema once:
   ```bash
   psql $DATABASE_URL -f server/schema.sql
   ```
4. Set `FRONTEND_URL` to `https://kitty-creek.onrender.com`. The client uses `/api` on the same origin by default.

See `RENDER_DEPLOYMENT.md` and `SETUP_INSTRUCTIONS.md` for full steps.

## 📚 Documentation

- `PROJECT_DOCUMENTATION.md` – Global overview
- `IMPLEMENTATION_STATUS.md` – Progress tracker
- `FRIENDS_SYSTEM_DESIGN.md` – Social systems spec
- `.cursor/rules/*.mdc` – Detailed physics, data-flow, and progression notes

## 📝 License

Enjoy the game! Contributions welcome via pull requests or issues.

