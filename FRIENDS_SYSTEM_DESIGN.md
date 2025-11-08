# Friends System Design & Implementation Plan

## Overview
A comprehensive friend system that allows players to connect with friends, share friend codes, track each other's progress, and see recent big catches.

## Architecture

### 1. Database Schema (PostgreSQL)

```sql
-- Players table (extends existing player data)
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    friend_code TEXT UNIQUE NOT NULL, -- 6-8 character alphanumeric code
    display_name TEXT,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    money INTEGER DEFAULT 100,
    total_caught INTEGER DEFAULT 0,
    biggest_catch DECIMAL(10, 2) DEFAULT 0,
    player_stats JSONB DEFAULT '{"accuracy": 50, "luck": 50, "patience": 50, "strength": 50}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW()
);

-- Friendships table (bidirectional, symmetric)
CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id UUID REFERENCES players(id) ON DELETE CASCADE,
    player2_id UUID REFERENCES players(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(player1_id, player2_id),
    CHECK (player1_id != player2_id)
);

-- Friend activity feed (recent big catches)
CREATE TABLE friend_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    fish_name TEXT NOT NULL,
    fish_weight DECIMAL(10, 2) NOT NULL,
    fish_rarity TEXT,
    location_name TEXT,
    experience_gained INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Player fish collections (sync from game)
CREATE TABLE player_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE UNIQUE,
    caught_fish JSONB DEFAULT '{}', -- {fishId: {caught: bool, count: int, firstCatchDate: timestamp}}
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_friendships_player1 ON friendships(player1_id);
CREATE INDEX idx_friendships_player2 ON friendships(player2_id);
CREATE INDEX idx_friendships_status ON friendships(status);
CREATE INDEX idx_friend_activities_player ON friend_activities(player_id);
CREATE INDEX idx_friend_activities_created ON friend_activities(created_at DESC);
CREATE INDEX idx_players_friend_code ON players(friend_code);
CREATE INDEX idx_players_username ON players(username);
```

### 2. Backend API Endpoints (Express.js)

**Base URL**: `/api`

#### Player Management
- `POST /api/players/register` - Create new player with username
  - Request: `{ username: string }`
  - Response: `{ userId: uuid, username: string, friendCode: string }`

- `GET /api/players/me` - Get current player data
  - Headers: `Authorization: Bearer <userId>`
  - Response: Player object with stats

- `PUT /api/players/me` - Update player data (sync from game)
  - Headers: `Authorization: Bearer <userId>`
  - Request: `{ level, experience, money, totalCaught, biggestCatch, stats }`
  - Response: Updated player object

- `GET /api/players/:friendCode` - Get player by friend code
  - Response: `{ userId, username, level, friendCode, stats }`

#### Friends System
- `POST /api/friends/request` - Send friend request by friend code
  - Headers: `Authorization: Bearer <userId>`
  - Request: `{ friendCode: string }`
  - Response: `{ success: boolean, message: string }`

- `GET /api/friends` - Get all friends (accepted)
  - Headers: `Authorization: Bearer <userId>`
  - Response: `[{ userId, username, level, biggestCatch, lastActive, ...stats }]`

- `GET /api/friends/pending` - Get pending friend requests
  - Headers: `Authorization: Bearer <userId>`
  - Response: `{ sent: [...], received: [...] }`

- `POST /api/friends/accept/:requestId` - Accept friend request
  - Headers: `Authorization: Bearer <userId>`
  - Response: `{ success: boolean }`

- `POST /api/friends/decline/:requestId` - Decline friend request
  - Headers: `Authorization: Bearer <userId>`
  - Response: `{ success: boolean }`

- `DELETE /api/friends/:friendId` - Remove friend
  - Headers: `Authorization: Bearer <userId>`
  - Response: `{ success: boolean }`

#### Activity Feed
- `POST /api/activities/catch` - Log a big catch (auto-called on catch)
  - Headers: `Authorization: Bearer <userId>`
  - Request: `{ fishName, fishWeight, fishRarity, locationName, experienceGained }`
  - Response: `{ success: boolean }`

- `GET /api/activities/friends` - Get friends' recent catches
  - Headers: `Authorization: Bearer <userId>`
  - Query: `?limit=20`
  - Response: `[{ playerId, username, fishName, fishWeight, fishRarity, locationName, createdAt }]`

#### Fish Collection
- `GET /api/players/:playerId/collection` - Get player's fish collection
  - Headers: `Authorization: Bearer <userId>`
  - Response: `{ caughtFish: [{ fishId, fishName, count, firstCatchDate }] }`

- `PUT /api/players/me/collection` - Update player's fish collection (sync)
  - Headers: `Authorization: Bearer <userId>`
  - Request: `{ caughtFishCollection: {...} }`
  - Response: `{ success: boolean }`

### 3. Friend Code System

**Format**: 6-8 character alphanumeric (uppercase, no confusing characters)
- Generate: `ABC123`, `XYZ789`, etc.
- Easy to share: Screenshot, copy-paste, or manual entry
- Unique: Database constraint ensures uniqueness

### 4. Frontend Implementation

#### Files to Create/Modify:

1. **`server/index.js`** - Express backend server
2. **`src/api.js`** - API client wrapper
3. **`src/player.js`** - Add userId, username, friendCode, friends array
4. **`src/ui.js`** - Add Friends tab and modal
5. **`index.html`** - Add Friends tab button and modal structure
6. **`css/styles.css`** - Styles for Friends UI

#### User Flow:

1. **First Launch / Username Setup**:
   - Check if `player.userId` exists in localStorage
   - If not, show username modal
   - User enters username (3-20 chars, alphanumeric + underscore)
   - Call `/api/players/register`
   - Save `userId`, `username`, `friendCode` to localStorage
   - Display friend code prominently

2. **Adding Friends**:
   - Go to Friends tab
   - Click "Add Friend" button
   - Enter friend's code or scan QR code (future)
   - Send friend request
   - Friend receives notification (in pending requests)

3. **Accepting Friend Requests**:
   - Friends tab shows pending requests badge
   - Click "Pending Requests" section
   - See list of received requests
   - Accept or decline

4. **Viewing Friends**:
   - Friends tab shows list of all friends
   - Each friend card shows:
     - Username
     - Level
     - Biggest catch
     - Last active time
     - Stats (accuracy, luck, patience, strength)

5. **Activity Feed**:
   - **On-Screen Notifications**: Show real-time popup notifications when friends catch:
     - Really rare fish (Epic, Legendary, Trophy)
     - Large fish (>6 lbs)
   - Notifications appear as overlay (top-right corner)
   - Auto-dismiss after 5 seconds
   - Click notification to go to Friends tab
   - Friends tab shows full activity history
   - Auto-refreshes every 30 seconds

6. **Friends Tab Details**:
   - Each friend card displays:
     - Username
     - Level and experience progress
     - Player stats (accuracy, luck, patience, strength)
     - Biggest catch (weight and fish name)
     - **Unlocked fish collection** (grid showing caught fish)
     - Last active time

7. **Sync Player Data**:
   - On game start: Sync player stats to server
   - After level up: Sync immediately
   - After big catch: Log to activity feed
   - Periodic sync: Every 5 minutes

### 5. Technical Implementation Details

#### API Client (`src/api.js`):
```javascript
class API {
    constructor() {
        const globalBase = typeof window !== 'undefined' ? window.__API_BASE_URL__ : null;
        const metaBase = typeof document !== 'undefined'
            ? document.querySelector('meta[name="kitty-creek-api-base"]')?.content
            : null;

        this.baseURL = (globalBase || metaBase || '/api').replace(/\/$/, '');
        this.userId = null;
    }
    
    setBaseURL(url) {
        if (!url) return;
        this.baseURL = url.replace(/\/$/, '');
    }
    
    setUserId(userId) {
        this.userId = userId;
    }
    
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (this.userId) {
            headers['Authorization'] = `Bearer ${this.userId}`;
        }
        
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        return response.json();
    }
    
    // Player methods
    async registerPlayer(username) { ... }
    async getPlayer() { ... }
    async updatePlayer(data) { ... }
    async getPlayerByFriendCode(friendCode) { ... }
    
    // Friends methods
    async sendFriendRequest(friendCode) { ... }
    async getFriends() { ... }
    async getPendingRequests() { ... }
    async acceptFriendRequest(requestId) { ... }
    async declineFriendRequest(requestId) { ... }
    async removeFriend(friendId) { ... }
    
    // Activity methods
    async logCatch(catchData) { ... }
    async getFriendActivities(limit = 20) { ... }
}
```

#### Player Model Updates (`src/player.js`):
- Add: `userId`, `username`, `friendCode`, `friends: []`
- Methods: `syncToServer()`, `loadFromServer()`, `updateFriendList()`

#### UI Integration (`src/ui.js`):
- Add `renderFriends()` method
- Add friend request modal
- Add friend profile modal
- Add activity feed component

### 6. Security Considerations

1. **Authentication**: Simple Bearer token (userId) for MVP
2. **Validation**: Validate friend codes, usernames on both client and server
3. **Rate Limiting**: Limit friend requests (e.g., 10 per hour)
4. **Input Sanitization**: Sanitize all user inputs
5. **CORS**: Configure CORS for production domain

### 7. GitHub & Railway Deployment

#### GitHub Setup
1. Initialize Git repository (if not already)
2. Create `.gitignore` with:
   - `node_modules/`
   - `.env`
   - `dist/`
   - `*.log`
3. Create repository on GitHub
4. Push code to main branch

#### Railway Deployment
1. **Project Setup**:
   - Connect GitHub repository to Railway
   - Railway will auto-detect Node.js project
   - Set root directory (if needed)

2. **Environment Variables**:
   - `DATABASE_URL` - PostgreSQL connection string (Railway provides)
   - `PORT` - Server port (Railway sets automatically)
   - `NODE_ENV` - `production`
   - `API_URL` - Frontend API URL (for CORS)

3. **Database**:
   - Add PostgreSQL service in Railway
   - Railway provides `DATABASE_URL` automatically
   - Run migration script on first deploy

4. **Build Configuration**:
   - Build command: `npm run build` (if using build step)
   - Start command: `node server/index.js`
   - Static files served from Express

5. **Railway Configuration** (`railway.json` or package.json):
   ```json
   {
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "node server/index.js",
       "restartPolicyType": "ON_FAILURE"
     }
   }
   ```

6. **Database Migrations**:
   - Run migrations on deploy (Railway post-deploy script)
   - Or manual migration via Railway CLI

#### Deployment Checklist
- [ ] GitHub repository created and pushed
- [ ] Railway account created
- [ ] PostgreSQL database added in Railway
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] CORS configured for production domain
- [ ] SSL/HTTPS enabled (Railway default)

### 8. Future Enhancements

- QR code generation for friend codes
- Push notifications for friend catches
- Friend challenges/competitions
- Private messaging
- Friend groups/clubs
- Achievement sharing
- Leaderboard filtering by friends

### 9. Database Migration Script

```sql
-- Run this to set up the database
\i schema.sql
```

## Implementation Priority

1. **Phase 1**: Database schema + Basic backend (register, get player, friend code)
2. **Phase 2**: Friend requests (send, accept, decline)
3. **Phase 3**: Friends list UI + Activity feed
4. **Phase 4**: Sync system + Real-time updates
5. **Phase 5**: Polish + Error handling + Offline support

