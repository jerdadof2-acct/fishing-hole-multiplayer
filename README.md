# 🐱 Kitty Creek Fishing Club 🎣

A purrfect multiplayer fishing tournament game with cat-themed fun, real-time multiplayer support, and hilarious AI bot competitors!

## Features

- 🐱 **Cat-Themed Fun** - Play as a fisher-cat and compete with hilarious bot cats like "Sly Sylvester" and "Tommy the Stray"
- 🎣 **Multiplayer Fishing Tournaments** - Compete with other players in real-time
- 🏆 **Fair Play** - Equal catch chances for all players during tournaments
- 🐟 **Mega Fish** - Tournament fish can be up to 3x bigger than normal!
- 📊 **Leaderboards** - Track biggest fish and biggest bags
- 🎮 **Deep Progression System** - Unlock locations, tackle, and improve stats
- 💾 **Auto-Save** - Your progress saves automatically
- 🔊 **Cat Sound Effects** - Hear cats meow and purr when you catch fish!
- 💬 **Real-Time Chat** - See player messages as announcement cards over the lake
- 🎨 **Modern UI** - Polished, professional game design

## Game Mechanics

### Progressive Pacing
The game adapts its pace based on your level to extend playtime and maintain challenge:

**Cast/Wait Times:**
- **Levels 1-5**: Quick paced (0.5 to 2 seconds between casts)
- **Levels 6-10**: Moderately paced (2 to 4 seconds)
- **Levels 11-15**: Slow paced (3 to 5.5 seconds)
- **Levels 16+**: Very slow paced (4 to 7 seconds)

This ensures the game remains challenging as you progress, encouraging careful fishing decisions and creating a longer, more engaging experience.

### Experience System
Experience requirements increase dramatically at higher levels to provide long-term goals:

**Level Requirements (Example):**
- Level 1 → 2: 100 exp
- Level 5 → 6: 750 exp
- Level 10 → 11: 5,000 exp
- Level 15 → 16: 20,000+ exp (exponential growth from here)

These steep increases ensure that reaching higher levels is a significant achievement requiring dedicated playtime.

### Equipment Economy
Fishing gear prices follow an exponential curve to reward progression and extend gameplay:

**Rod Prices (Example):**
- Basic Rod: Free (starter)
- Fiberglass Rod: $250
- Carbon Fiber Rod: $1,000
- Pro Rod: $3,500
- Master Rod: $10,000
- Legendary Rod: $30,000
- Trophy Rod: $100,000

Similar pricing applies to reels, hooks, lines, and baits, with highest-tier equipment costing tens of thousands. This creates meaningful financial goals and encourages saving for upgrades while continuing to fish and level up.

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js + Express (for Railway deployment)
- **Database**: PostgreSQL (for multiplayer persistence)
- **Real-time**: WebSockets (Socket.io)

## Railway Deployment

This game is designed to be deployed on Railway with PostgreSQL.

1. Create a new service in your Railway project
2. Connect your GitHub repository
3. Railway will auto-detect Node.js and deploy
4. Add PostgreSQL database
5. Set environment variables

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment (development/production)

## License

Enjoy the game!

