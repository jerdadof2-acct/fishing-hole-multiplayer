# Fishing Hole - Multiplayer Tournament Game

A fun, retro-styled multiplayer fishing tournament game with real-time multiplayer support.

## Features

- 🎣 **Multiplayer Fishing Tournaments** - Compete with other players in real-time
- 🏆 **Fair Play** - Equal catch chances for all players during tournaments
- 🐟 **Mega Fish** - Tournament fish can be up to 3x bigger than normal!
- 📊 **Leaderboards** - Track biggest fish and biggest bags
- 🎮 **Progression System** - Unlock locations, tackle, and improve stats
- 💾 **Persistent Data** - Save your progress with localStorage

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

