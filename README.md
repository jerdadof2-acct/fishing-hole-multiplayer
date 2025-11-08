# Kitty Creek Fishing Club 🎣

A 3D fishing simulation game built with Three.js featuring realistic fishing mechanics, player progression, and social features.

## 🎮 Game Features

- **Realistic Fishing**: Physics-based casting, reeling, and fish fighting
- **33 Fish Types**: Common to Trophy rarity fish with unique behaviors
- **10 Locations**: Pond, River, Lake, and Ocean fishing spots
- **Player Progression**: Level up, earn money, unlock gear and locations
- **Tiered Achievements**: Multi-tier achievement system with rewards
- **Tackle Shop**: Purchase rods, reels, lines, hooks, and baits
- **Fish Collection**: Track all caught fish and view your collection
- **Cloud Saves**: Username-based profiles synced to PostgreSQL via the Express backend
- **Friends System**: Connect with friends and see their catches (backend ready)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (for backend/friends system)
- Modern web browser
- PostgreSQL (optional, for friends system)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd "Kitty Creek"
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the server** (optional, for friends system)
```bash
npm start
```

4. **Open in browser**
   - For local development: Open `index.html` directly
   - For friends system: Navigate to `http://localhost:3000`

## 🔐 Cloud Saves & Accounts

- The game now prompts for a username the first time you launch it and stores that profile in PostgreSQL.
- Progress (level, money, stats, fish collection) stays synced between sessions through the Express API.
- By default the frontend talks to the same origin at `/api`; override this by setting `window.__API_BASE_URL__` before loading `src/bootstrap.js` or by adding `<meta name="kitty-creek-api-base" content="https://your-api.com/api">`.
- Auth details are cached in `localStorage` (`kittyCreekAuth`) for seamless reloads; clearing it forces a new username prompt.
- If the backend can’t be reached (for example during local testing), the game automatically falls back to offline mode and keeps using `localStorage` only.

## 📁 Project Structure

```
Kitty Creek/
├── index.html              # Main entry point
├── src/                    # Source code
│   ├── main.js            # Core game systems & scene setup
│   ├── bootstrap.js       # Account bootstrap and Game launcher
│   ├── player.js          # Player system
│   ├── fishing.js         # Fishing mechanics
│   ├── fish.js            # Fish behavior
│   ├── achievements.js    # Achievement system
│   └── ...                # Other game systems
├── server/                 # Backend (friends system)
│   ├── index.js           # Express server
│   └── schema.sql         # Database schema
├── assets/                 # Game assets
└── css/                    # Styles
```

## 🎯 Current Status

### ✅ Completed
- Core fishing mechanics
- Player progression system
- Achievement system (tiered)
- Location system
- Tackle shop
- Inventory system
- Audio system
- Friends system backend

### ⏳ In Progress
- Friends system frontend
- Bonus locations

### 📋 Planned
- Tournament system
- Daily challenges
- Additional features

## 📚 Documentation

- **PROJECT_DOCUMENTATION.md** - Complete project overview
- **IMPLEMENTATION_STATUS.md** - Current implementation status
- **FRIENDS_SYSTEM_DESIGN.md** - Friends system architecture
- **BONUS_LOCATIONS_DESIGN.md** - Bonus locations design
- **SETUP_INSTRUCTIONS.md** - Setup and deployment guide

## 🛠️ Development

### Running Locally
```bash
# Start backend server (friends system)
npm start

# Or run with auto-reload
npm run dev
```

### Environment Variables
Create a `.env` file:
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/kitty_creek
PORT=3000
NODE_ENV=development
```

## 🎣 How to Play

1. **Cast**: Click the CAST button to cast your line
2. **Wait**: Watch for the bobber to tug
3. **Set Hook**: Click SET HOOK when you see a tug
4. **Fight**: Reel in the fish (hold or click rapidly)
5. **Catch**: Land the fish and earn rewards!

## 🏆 Achievements

Unlock achievements by:
- Catching fish
- Reaching levels
- Earning money
- Collecting rare fish
- Unlocking locations
- And more!

Each achievement has multiple tiers with increasing rewards.

## 👥 Friends System (Coming Soon)

- Add friends with friend codes
- See friends' catches and stats
- View friends' fish collections
- Get notified when friends catch rare fish

## 🗺️ Locations

Fish at different locations:
- **Pond**: Easy fishing for beginners
- **River**: Flowing waters with diverse fish
- **Lake**: Deep waters with bigger fish
- **Ocean**: Saltwater fishing with trophy fish

## 🎣 Tackle Shop

Purchase gear to improve your fishing:
- **Rods**: Better catch rates and strength
- **Reels**: Faster reeling speed
- **Lines**: Stronger lines for big fish
- **Hooks**: Longer timing windows
- **Baits**: Better catch bonuses

## 📊 Progression

- **Level Up**: Gain experience by catching fish
- **Earn Money**: Sell fish to buy better gear
- **Unlock Locations**: New fishing spots at higher levels
- **Complete Achievements**: Earn XP and money rewards

## 🐛 Known Issues

None currently. See IMPLEMENTATION_STATUS.md for details.

## 🤝 Contributing

This is a personal project. For suggestions or issues, please contact the maintainer.

## 📝 License

All rights reserved.

## 🙏 Credits

- Three.js for 3D graphics
- Sound effects from various sources
- Fish images and assets

---

**Version**: 1.0
**Last Updated**: 2024
**Status**: Active Development



