import { TackleShop } from './tackleShop.js';
import { ACHIEVEMENTS, evaluateAchievements as evaluateAchievementDefs, getAchievementStatuses } from './achievements.js';

export class UI {
    constructor(fishing, fish, water, game, gameplaySystems = null, sfx = null) {
        this.fishing = fishing;
        this.fish = fish;
        this.water = water;
        this.game = game; // Reference to game instance for location switching
        this.sfx = sfx; // Sound effects system
        
        // Gameplay systems
        this.player = gameplaySystems?.player || null;
        this.inventory = gameplaySystems?.inventory || null;
        this.leaderboard = gameplaySystems?.leaderboard || null;
        this.fishCollection = gameplaySystems?.fishCollection || null;
        this.currentInventoryTab = 'collection';
        this.currentShopTab = 'rods';
        this.api = game?.api || null;
        this.globalLeaderboardCache = { entries: [], fetchedAt: 0 };
        this.speedLeaderboardCache = { entries: [], fetchedAt: 0 };
        this.activeLeaderboardTab = 'local';
        this.friendData = { friends: [], pending: { sent: [], received: [] }, activities: [] };
        this.friendDataLoaded = false;
        this.friendMessageTimer = null;
        this.friendRefreshTimer = null;
        this.lastFriendSnapshot = { friends: new Map(), activities: new Set() };
        this.affordableNotified = new Set();
        this.notificationState = {
            lastMessage: null,
            lastType: null,
            timestamp: 0
        };
        this.playerCatchCache = { entries: [], fetchedAt: 0 };
        this.friendDetailCache = new Map();
        this.activeFriendId = null;
        this.totalFishTypes = null;
    }

    init() {
        const castButton = document.getElementById('cast-button');
        const locationSelect = document.getElementById('location-select');
        
        // Cast button (handles both cast and set hook)
        castButton.addEventListener('click', () => {
            this.handleCastOrSetHook();
        });
        
        // Touch support for mobile
        castButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleCastOrSetHook();
        });
        
        // Location selector - switch between unlocked locations
        if (locationSelect && this.game?.locations && this.player) {
            this.updateLocationSelector();
            locationSelect.addEventListener('change', (e) => {
                const locationIndex = parseInt(e.target.value);
                if (!isNaN(locationIndex)) {
                    this.handleLocationChange(locationIndex);
                }
            });
        } else if (locationSelect) {
            // Set up event listener even if locations/player not ready yet
            // Will be populated once game systems are initialized
            locationSelect.addEventListener('change', (e) => {
                const locationIndex = parseInt(e.target.value);
                if (!isNaN(locationIndex) && this.game?.locations && this.player) {
                    this.handleLocationChange(locationIndex);
                }
            });
        }
        
        // Set up fishing callbacks
        this.fishing.onFishCaught = () => {
            this.handleFishCaught();
        };
        
        // Bite detection state
        this.waitingForBite = false;
        this.biteStrikeTime = null;
        this.hookSetSuccess = false;
        
        // Initialize new UI components
        this.initTabs();
        this.initModals();
        this.initFriendsUI();
        this.updatePlayerInfo();
        this.renderFriends();
        
        // Check achievements on game start (in case player already met conditions)
        setTimeout(() => {
            this.evaluateAchievements('startup');
        }, 1000);
        
        // Update player info periodically
        setInterval(() => {
            this.updatePlayerInfo();
        }, 1000);
    }
    
    initTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;
                this.switchTab(tab);
            });
        });
        
        // Default to game tab
        this.switchTab('game');
    }
    
    switchTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
            }
        });
        
        // Show/hide appropriate UI
        const gameArea = document.getElementById('game-area');
        const shopModal = document.getElementById('shop-modal');
        const inventoryModal = document.getElementById('inventory-modal');
        const leaderboardModal = document.getElementById('leaderboard-modal');
        const friendsModal = document.getElementById('friends-modal');
        
        // Hide all modals first
        shopModal?.classList.add('hidden');
        inventoryModal?.classList.add('hidden');
        leaderboardModal?.classList.add('hidden');
        friendsModal?.classList.add('hidden');
        
        if (tab === 'game') {
            gameArea?.classList.remove('hidden');
        } else if (tab === 'shop') {
            gameArea?.classList.add('hidden');
            this.openModal('shop-modal');
            this.renderShop('rods'); // Default to rods
        } else if (tab === 'inventory') {
            gameArea?.classList.add('hidden');
            this.openModal('inventory-modal');
            this.renderInventory('collection'); // Default to collection
        } else if (tab === 'friends') {
            gameArea?.classList.add('hidden');
            this.openModal('friends-modal');
            this.renderFriends(true);
        } else if (tab === 'leaderboard') {
            gameArea?.classList.add('hidden');
            this.openModal('leaderboard-modal');
            this.renderLeaderboard('local'); // Default to local top 10
        }

        if (this.friendRefreshTimer) {
            clearInterval(this.friendRefreshTimer);
            this.friendRefreshTimer = null;
        }
    }

    async renderGlobalLeaderboardSection(force = false) {
        const leaderboardContent = document.getElementById('leaderboard-content');
        if (!leaderboardContent) return;

        const loadingMessage = '<p style="text-align: center; color: rgba(255,255,255,0.6); padding: 30px;">Loading global leaderboard...</p>';

        if (!this.isOnline() || !this.api) {
            this.renderGlobalLeaderboardFallback(leaderboardContent);
            return;
        }

        if (force) {
            this.globalLeaderboardCache.fetchedAt = 0;
        }

        leaderboardContent.innerHTML = loadingMessage;

        try {
            const entries = await this.refreshGlobalLeaderboard();

            if (!entries || entries.length === 0) {
                leaderboardContent.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.6); padding: 40px;">No catches have been logged yet. Be the first to catch a monster!</p>';
                return;
            }

            leaderboardContent.innerHTML = this.buildGlobalLeaderboardMarkup(entries);
        } catch (error) {
            console.error('[UI] Failed to load global leaderboard:', error);
            this.renderGlobalLeaderboardFallback(leaderboardContent, error);
        }
    }

    renderGlobalLeaderboardFallback(container, error = null) {
        const leaderboardData = this.leaderboard.getLeaderboardData(this.player.name);
        const { top10, playerEntry, playerRank } = leaderboardData;

        if (top10.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5); padding: 40px;">No catches yet.</p>';
            return;
        }

        let html = top10.map((entry, index) => {
            const isPlayer = entry.playerName === this.player.name;
            return `
                <div class="leaderboard-entry ${isPlayer ? 'player-entry' : ''}">
                    <div class="leaderboard-rank">#${index + 1}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-player">${entry.playerName}</div>
                        <div class="leaderboard-fish">${entry.fishName}</div>
                    </div>
                    <div class="leaderboard-weight">${entry.weight.toFixed(2)} lbs</div>
                </div>
            `;
        }).join('');

        if (playerRank === -1 && playerEntry) {
            html += `
                <div class="leaderboard-entry player-entry" style="margin-top: 20px; border-top: 2px solid #4a90e2; padding-top: 20px;">
                    <div class="leaderboard-rank">...</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-player">${playerEntry.playerName} (You)</div>
                        <div class="leaderboard-fish">${playerEntry.fishName}</div>
                    </div>
                    <div class="leaderboard-weight">${playerEntry.weight.toFixed(2)} lbs</div>
                </div>
            `;
        }

        if (error) {
            html = `<div class="friends-placeholder error">Live leaderboard unavailable. Showing your local catches instead.<br>${this.safeText(error.message || '')}</div>` + html;
        }

        container.innerHTML = html;
    }

    async refreshGlobalLeaderboard() {
        if (!this.api || !this.isOnline()) {
            return this.getLocalGlobalLeaderboardEntries();
        }

        const now = Date.now();
        const cacheAge = now - this.globalLeaderboardCache.fetchedAt;

        if (this.globalLeaderboardCache.entries.length > 0 && cacheAge < 15000) {
            return this.globalLeaderboardCache.entries;
        }

        try {
            const response = await this.api.getGlobalLeaderboard(50);
            const entries = Array.isArray(response) ? response : [];
            this.globalLeaderboardCache = {
                entries,
                fetchedAt: now
            };
            return entries;
        } catch (error) {
            console.error('[UI] Global leaderboard fetch error:', error);
            if (this.globalLeaderboardCache.entries.length > 0) {
                return this.globalLeaderboardCache.entries;
            }
            return this.getLocalGlobalLeaderboardEntries();
        }
    }

    getLocalGlobalLeaderboardEntries() {
        if (!this.leaderboard) return [];
        const leaderboardData = this.leaderboard.getLeaderboardData(this.player.name);
        const { top10 } = leaderboardData;

        return (top10 || []).map((entry) => ({
            player_id: null,
            username: entry.playerName,
            fish_name: entry.fishName,
            fish_weight: entry.weight,
            location_name: null,
            recorded_at: entry.timestamp ? new Date(entry.timestamp).toISOString() : null,
            _local: true
        }));
    }

    buildGlobalLeaderboardMarkup(entries) {
        const highlightId = this.player?.userId || null;
        const highlightName = this.player?.name || null;

        return entries.map((entry, index) => {
            const username = this.safeText(entry.username || 'Unknown angler');
            const fishName = this.safeText(entry.fish_name || 'Mystery Fish');
            const location = this.safeText(entry.location_name || '???');
            const weightValue = Number(entry.fish_weight) || 0;
            const weightText = weightValue > 0 ? `${weightValue.toFixed(2)} lbs` : '--';
            const recorded = entry.recorded_at ? this.formatRelativeTime(entry.recorded_at) : '';
            const isPlayer = (highlightId && entry.player_id === highlightId) ||
                (!highlightId && highlightName && username === highlightName);

            return `
                <div class="leaderboard-entry ${isPlayer ? 'player-entry' : ''}">
                    <div class="leaderboard-rank">#${index + 1}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-player">${username}</div>
                        <div class="leaderboard-fish">${fishName}${location !== '???' ? ` · ${location}` : ''}</div>
                        ${recorded ? `<div class="leaderboard-meta">Caught ${recorded}</div>` : ''}
                    </div>
                    <div class="leaderboard-weight">${weightText}</div>
                </div>
            `;
        }).join('');
    }
    
    initModals() {
        // Close buttons
        document.querySelectorAll('.modal-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                const modalId = closeBtn.dataset.modal;
                this.closeModal(modalId);
            });
        });
        
        // Shop tabs
        document.querySelectorAll('.shop-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderShop(tab.dataset.shopTab);
            });
        });
        
        // Inventory tabs
        document.querySelectorAll('.inventory-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.inventory-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderInventory(tab.dataset.inventoryTab);
            });
        });
        
        // Leaderboard tabs
        document.querySelectorAll('.leaderboard-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.leaderboard-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderLeaderboard(tab.dataset.leaderboardTab);
            });
        });
        
        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }
    
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
        }
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            // Return to game tab when closing
            this.switchTab('game');
        }
    }
    
    initFriendsUI() {
        this.renderFriendCode();

        const copyButton = document.getElementById('friends-copy-code');
        const addForm = document.getElementById('friends-add-form');
        const inputEl = document.getElementById('friends-add-input');
        const friendsListEl = document.getElementById('friends-list');
        const pendingReceivedEl = document.getElementById('friends-pending-received');
        const pendingSentEl = document.getElementById('friends-pending-sent');

        if (copyButton) {
            copyButton.addEventListener('click', async () => {
                if (!this.isOnline()) {
                    this.showFriendMessage('Go online to share your friend code.', 'error');
                    return;
                }

                const code = this.player?.friendCode;
                if (!code || code === '------') {
                    this.showFriendMessage('Friend code unavailable. Try again in a moment.', 'error');
                    return;
                }

                try {
                    if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(code);
                        this.showFriendMessage('Friend code copied to clipboard!');
                    } else {
                        this.showFriendMessage('Clipboard unavailable. Tap and hold to copy manually.', 'error');
                    }
                } catch (error) {
                    console.warn('[UI] Failed to copy friend code:', error);
                    this.showFriendMessage('Copy failed. Tap and hold to copy manually.', 'error');
                }
            });
        }

        if (addForm) {
            addForm.addEventListener('submit', async (event) => {
                event.preventDefault();

                if (!this.isOnline()) {
                    this.showFriendMessage('Connect to the clubhouse to send friend requests.', 'error');
                    return;
                }

                const code = inputEl?.value?.trim().toUpperCase();
                if (!code) {
                    this.showFriendMessage('Enter a friend code to send a request.', 'error');
                    return;
                }

                if (code === (this.player?.friendCode || '').toUpperCase()) {
                    this.showFriendMessage('That is your own friend code.', 'error');
                    return;
                }

                const submitButton = addForm.querySelector('button[type="submit"]');
                if (submitButton) submitButton.disabled = true;

                try {
                    await this.handleSendFriendRequest(code);
                } finally {
                    if (submitButton) submitButton.disabled = false;
                    if (inputEl) inputEl.value = '';
                }
            });
        }

        if (friendsListEl) {
            friendsListEl.addEventListener('click', (event) => this.handleFriendsListClick(event));
        }

        if (pendingReceivedEl) {
            pendingReceivedEl.addEventListener('click', (event) => this.handlePendingListClick(event));
        }

        if (pendingSentEl) {
            pendingSentEl.addEventListener('click', (event) => this.handlePendingListClick(event));
        }
    }

    updatePlayerInfo() {
        if (!this.player) return;
        
        const nameEl = document.getElementById('player-name');
        const levelEl = document.getElementById('player-level');
        const moneyEl = document.getElementById('player-money');
        const expEl = document.getElementById('player-exp');
        const expBar = document.getElementById('exp-bar');
        
        if (nameEl) nameEl.textContent = this.player.name || 'Guest';
        if (levelEl) levelEl.textContent = this.player.level;
        if (moneyEl) moneyEl.textContent = `$${this.player.money}`;
        
        if (expEl && expBar && this.player) {
            const expForCurrentLevel = this.player.calculateExpForLevel(this.player.level);
            const expForNextLevel = this.player.calculateExpForLevel(this.player.level + 1);
            const expNeededForNext = expForNextLevel - expForCurrentLevel;
            let currentExpInLevel = Math.max(0, this.player.experience);

            if (currentExpInLevel > expNeededForNext) {
                currentExpInLevel = expNeededForNext;
            }

            const expPercent = expNeededForNext > 0 ? (currentExpInLevel / expNeededForNext) * 100 : 0;

            expEl.textContent = `${Math.floor(currentExpInLevel)}/${expNeededForNext}`;
            expBar.style.width = `${Math.min(100, Math.max(0, expPercent))}%`;
        }

        this.renderFriendCode();
        // Upgrade highlighting disabled for now
    }
    
    async renderFriends(refresh = false) {
        this.renderFriendCode();

        if (!this.isOnline()) {
            this.renderFriendsOffline();
            return;
        }

        if (refresh || !this.friendDataLoaded) {
            this.refreshFriends(true);
        } else {
            this.renderFriendsLists();
        }

        if (!this.friendRefreshTimer && this.isOnline()) {
            this.friendRefreshTimer = setInterval(() => {
                if (this.isOnline()) {
                    this.refreshFriends(true);
                }
            }, 15000);
        }
    }

    async refreshFriends(force = false) {
        if (!this.isOnline()) {
            this.renderFriendsOffline();
            return;
        }

        if (!this.api) {
            console.warn('[UI] No API instance available for friends refresh');
            this.renderFriendsError(new Error('Friends API unavailable.'));
            return;
        }

        const wasLoaded = this.friendDataLoaded;

        if (!force && this.friendDataLoaded) {
            this.renderFriendsLists();
            return;
        }

        this.setFriendsPlaceholder('friends-list', 'Loading friends...');
        this.setFriendsPlaceholder('friends-pending-received', 'Loading requests...');
        this.setFriendsPlaceholder('friends-pending-sent', 'Loading requests...');

        try {
            const activityLimit = 20;
            const activitiesPromise = this.api.getFriendActivities
                ? this.api.getFriendActivities(activityLimit)
                : Promise.resolve([]);

            const [friendList, pending, activityList] = await Promise.all([
                this.api.getFriends(),
                this.api.getPendingRequests(),
                activitiesPromise
            ]);

            this.friendData = {
                friends: Array.isArray(friendList) ? friendList : [],
                pending: {
                    sent: pending?.sent ?? [],
                    received: pending?.received ?? []
                },
                activities: Array.isArray(activityList) ? activityList : []
            };

            this.friendDataLoaded = true;
            this.renderFriendsLists();
            this.detectFriendNotifications(friendList, this.friendData.pending, activityList, wasLoaded);
        } catch (error) {
            console.warn('[UI] Failed to load friends:', error);
            this.friendDataLoaded = false;
            this.renderFriendsError(error);
            this.showFriendMessage(error?.message || 'Failed to load friend data.', 'error');
        }
    }

    renderFriendsLists() {
        const friends = this.friendData?.friends ?? [];
        const pending = this.friendData?.pending ?? { sent: [], received: [] };

        this.renderFriendList(friends);
        this.syncFriendDetailState(friends);
        this.renderPendingList('friends-pending-received', pending.received, 'received');
        this.renderPendingList('friends-pending-sent', pending.sent, 'sent');
        this.renderFriendActivities();
    }

    renderFriendList(friends = []) {
        const listEl = document.getElementById('friends-list');
        if (!listEl) return;

        if (!friends.length) {
            this.setFriendsPlaceholder('friends-list', 'No friends yet. Share your code to build your crew!');
            this.activeFriendId = null;
            this.setFriendDetailMessage('Add a friend to view their collection.');
            return;
        }

        listEl.classList.remove('friends-placeholder');
        listEl.innerHTML = friends.map(friend => this.buildFriendEntry(friend)).join('');
        if (this.activeFriendId) {
            this.highlightFriendEntry(this.activeFriendId);
        }
    }

    syncFriendDetailState(friends = []) {
        if (!friends.length) {
            this.activeFriendId = null;
            return;
        }

        if (this.activeFriendId && friends.some(friend => friend.id === this.activeFriendId)) {
            this.highlightFriendEntry(this.activeFriendId);
        } else {
            this.activeFriendId = null;
            this.setFriendDetailMessage('Select a friend to view their collection.');
        }
    }

    getFriendById(friendId) {
        return this.friendData?.friends?.find(friend => friend.id === friendId) || null;
    }

    highlightFriendEntry(friendId) {
        const listEl = document.getElementById('friends-list');
        if (!listEl) return;
        listEl.querySelectorAll('.friends-entry').forEach(entry => {
            entry.classList.toggle('active', friendId && entry.dataset.friendId === friendId);
        });
    }

    setFriendDetailMessage(message) {
        const section = document.getElementById('friends-detail-section');
        if (section) {
            section.classList.remove('hidden');
        }
        this.setFriendsPlaceholder('friends-detail-content', message);
        const detailContent = document.getElementById('friends-detail-content');
        if (detailContent) {
            detailContent.classList.add('friends-detail-placeholder');
        }
    }

    async selectFriendEntry(friendId) {
        if (!friendId) return;

        this.activeFriendId = friendId;
        this.highlightFriendEntry(friendId);

        if (!this.isOnline()) {
            this.setFriendDetailMessage('Connect to view friend collections.');
            return;
        }

        const detailContent = document.getElementById('friends-detail-content');
        if (!detailContent) return;

        this.setFriendDetailMessage('Fetching collection...');

        try {
            let cacheEntry = this.friendDetailCache.get(friendId);
            const cacheFresh = cacheEntry && (Date.now() - cacheEntry.fetchedAt) < 60000;

            if (!cacheFresh) {
                const data = await this.api.getFriendCollection(friendId);
                cacheEntry = { data, fetchedAt: Date.now() };
                this.friendDetailCache.set(friendId, cacheEntry);
            }

            if (this.totalFishTypes === null) {
                try {
                    const { FishTypes } = await import('./fishTypes.js');
                    if (Array.isArray(FishTypes)) {
                        this.totalFishTypes = FishTypes.length;
                    }
                } catch (error) {
                    console.warn('[UI] Failed to load fish types:', error);
                    this.totalFishTypes = 33;
                }
            }

            detailContent.classList.remove('friends-placeholder');
            this.renderFriendDetail(cacheEntry.data, this.getFriendById(friendId));
        } catch (error) {
            console.warn('[UI] Failed to load friend collection:', error);
            this.setFriendDetailMessage(error?.message || 'Unable to load collection.');
        }
    }

    renderFriendDetail(data = {}, friendMeta = null) {
        const detailContent = document.getElementById('friends-detail-content');
        if (!detailContent) return;

        detailContent.classList.remove('friends-placeholder', 'friends-detail-placeholder');

        const caughtFish = data.caughtFish || {};
        const totals = data.totals || {};
        const uniqueFish = totals.uniqueFish ?? Object.values(caughtFish).filter(entry => entry && entry.caught !== false).length;
        const totalCatches = totals.totalCatches ?? Object.values(caughtFish).reduce((sum, entry) => sum + (entry?.count || 0), 0);
        const totalSpecies = this.totalFishTypes ?? 0;

        const displayName = this.safeText(friendMeta?.display_name || data.displayName || friendMeta?.username || data.username || 'Angler');
        const level = friendMeta?.level ?? data.level ?? '-';
        const friendCode = this.safeText(friendMeta?.friend_code || data.friendCode || '');
        const biggestCatchRaw = friendMeta?.biggest_catch ?? data.biggestCatch ?? null;
        const biggestCatchText = Number.isFinite(Number(biggestCatchRaw)) ? `${Number(biggestCatchRaw).toFixed(2)} lbs` : null;

        const summaryPieces = [];
        summaryPieces.push(`Level ${level}`);
        if (totalSpecies > 0) {
            summaryPieces.push(`${uniqueFish}/${totalSpecies} species`);
        } else {
            summaryPieces.push(`${uniqueFish} species`);
        }
        summaryPieces.push(`${totalCatches} total catch${totalCatches === 1 ? '' : 'es'}`);

        const secondaryPieces = [];
        if (friendCode) secondaryPieces.push(`Code ${friendCode}`);
        if (biggestCatchText) secondaryPieces.push(`Biggest ${biggestCatchText}`);

        const statsSource = friendMeta?.player_stats ?? data.player_stats;
        const stats = this.parsePlayerStats(statsSource);
        const statEntries = [];
        if (stats.accuracy !== undefined) statEntries.push({ label: 'Accuracy', value: stats.accuracy });
        if (stats.luck !== undefined) statEntries.push({ label: 'Luck', value: stats.luck });
        if (stats.patience !== undefined) statEntries.push({ label: 'Patience', value: stats.patience });
        if (stats.strength !== undefined) statEntries.push({ label: 'Strength', value: stats.strength });

        const topFish = Array.isArray(data.topFish) ? [...data.topFish] : [];
        topFish.sort((a, b) => (Number(b?.maxWeight) || 0) - (Number(a?.maxWeight) || 0));

        const gridHtml = topFish.length
            ? topFish.map(entry => {
                const fishName = this.safeText(entry.fishName || 'Unknown fish');
                const weight = Number(entry.maxWeight);
                const weightText = Number.isFinite(weight) ? `${weight.toFixed(2)} lbs` : '--';
                return `
                    <div class="friends-detail-row">
                        <span class="friends-detail-fish">${fishName}</span>
                        <span class="friends-detail-weight">${weightText}</span>
                    </div>
                `;
            }).join('')
            : '<div class="friends-detail-empty">No catches recorded yet.</div>';

        detailContent.innerHTML = `
            <div class="friends-detail-header">
                <div>
                    <div class="friends-detail-name">${displayName}</div>
                    <div class="friends-detail-meta">${summaryPieces.join(' · ')}</div>
                    ${secondaryPieces.length ? `<div class="friends-detail-meta secondary">${secondaryPieces.join(' · ')}</div>` : ''}
                </div>
            </div>
            ${statEntries.length ? `<div class="friends-detail-stats">${statEntries.map(stat => `<span class="friends-detail-stat">${stat.label}: ${stat.value}</span>`).join('')}</div>` : ''}
            <div class="friends-detail-grid">
                ${gridHtml}
            </div>
        `;
    }

    renderPendingList(elementId, items = [], mode = 'received') {
        const container = document.getElementById(elementId);
        if (!container) return;

        if (!items.length) {
            this.setFriendsPlaceholder(elementId, 'No pending requests.');
            return;
        }

        container.classList.remove('friends-placeholder');
        container.innerHTML = items.map(item => this.buildPendingEntry(item, mode)).join('');
    }

    renderFriendActivities() {
        const container = document.getElementById('friends-activity');
        if (!container) return;

        const activities = this.friendData?.activities ?? [];

        if (!this.isOnline()) {
            this.setFriendsPlaceholder('friends-activity', "Connect to see your friends' trophy catches.");
            return;
        }

        if (!activities.length) {
            this.setFriendsPlaceholder('friends-activity', 'No big catches yet. Hook something legendary!');
            return;
        }

        container.classList.remove('friends-placeholder');
        container.innerHTML = activities.map(activity => this.buildActivityEntry(activity)).join('');
    }

    buildFriendEntry(friend) {
        const id = this.safeAttr(friend?.id ?? '');
        const name = this.safeText(friend?.username || 'Unknown angler');
        const code = this.safeText(friend?.friend_code || '------');
        const level = friend?.level ?? '-';
        const statusInfo = this.getFriendStatus(friend);
        const metaPieces = [`Level ${level}`];
        if (statusInfo.meta) metaPieces.push(statusInfo.meta);

        const stats = this.parsePlayerStats(friend?.player_stats);
        const statChips = [];
        if (stats.accuracy !== undefined) statChips.push(`🎯 ${stats.accuracy}`);
        if (stats.luck !== undefined) statChips.push(`🍀 ${stats.luck}`);
        if (stats.patience !== undefined) statChips.push(`🧘 ${stats.patience}`);
        if (stats.strength !== undefined) statChips.push(`💪 ${stats.strength}`);

        const totalCaught = friend?.total_caught;
        const biggestCatch = friend?.biggest_catch;
        const extraPieces = [];
        if (Number.isFinite(Number(biggestCatch))) {
            extraPieces.push(`Biggest ${Number(biggestCatch).toFixed(2)} lbs`);
        }
        if (Number.isFinite(Number(totalCaught))) {
            extraPieces.push(`${Number(totalCaught)} caught`);
        }

        return `
            <div class="friends-entry" data-friend-id="${id}">
                <div class="friends-entry-info">
                    <span class="friends-entry-name">${name}</span>
                    <div class="friends-entry-status">
                        <span class="friends-status-dot ${statusInfo.statusClass}"></span>
                        <span class="friends-entry-meta">Code ${code}${metaPieces.length ? ' · ' + metaPieces.join(' · ') : ''}</span>
                    </div>
                    ${extraPieces.length ? `<div class="friends-entry-meta">${extraPieces.join(' · ')}</div>` : ''}
                    ${statChips.length ? `<div class="friends-entry-stats">${statChips.map(stat => `<span class="friends-entry-stat">${stat}</span>`).join('')}</div>` : ''}
                </div>
                <div class="friends-entry-actions">
                    <button class="friend-action-button neutral" data-action="copy" data-code="${code}">Copy</button>
                    <button class="friend-action-button decline" data-action="remove" data-id="${id}">Remove</button>
                </div>
            </div>
        `;
    }

    buildPendingEntry(item, mode) {
        const id = this.safeAttr(item?.id ?? '');
        const name = this.safeText(item?.username || 'Unknown angler');
        const code = this.safeText(item?.friend_code || '------');
        const level = item?.level ?? '-';
        const created = item?.created_at ? this.formatRelativeTime(item.created_at) : '';
        const metaPieces = [`Level ${level}`];
        if (created) metaPieces.push(created);

        if (mode === 'received') {
            return `
                <div class="friends-entry" data-request-id="${id}">
                    <div class="friends-entry-info">
                        <span class="friends-entry-name">${name}</span>
                        <span class="friends-entry-meta">Code ${code}${metaPieces.length ? ' · ' + metaPieces.join(' · ') : ''}</span>
                    </div>
                    <div class="friends-entry-actions">
                        <button class="friend-action-button accept" data-action="accept" data-request-id="${id}">Accept</button>
                        <button class="friend-action-button decline" data-action="decline" data-request-id="${id}">Decline</button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="friends-entry" data-request-id="${id}">
                <div class="friends-entry-info">
                    <span class="friends-entry-name">${name}</span>
                    <span class="friends-entry-meta">Code ${code}${metaPieces.length ? ' · ' + metaPieces.join(' · ') : ''}</span>
                </div>
                <div class="friends-entry-actions">
                    <span class="friends-entry-meta">Pending</span>
                </div>
            </div>
        `;
    }

    renderFriendsOffline() {
        this.friendDataLoaded = false;
        this.renderFriendCode();
        this.setFriendsPlaceholder('friends-list', 'Friends are only available while you are connected.');
        this.setFriendsPlaceholder('friends-pending-received', 'No pending requests while offline.');
        this.setFriendsPlaceholder('friends-pending-sent', 'No pending requests while offline.');
        this.setFriendsPlaceholder('friends-activity', "Reconnect to see your friends' legendary catches.");
        this.friendDetailCache.clear();
        this.activeFriendId = null;
        this.setFriendDetailMessage('Connect to view friend collections.');
    }

    renderFriendsError(error) {
        const message = error?.message || 'Unable to load friend data.';
        this.setFriendsPlaceholder('friends-list', message);
        this.setFriendsPlaceholder('friends-pending-received', message);
        this.setFriendsPlaceholder('friends-pending-sent', message);
        this.setFriendsPlaceholder('friends-activity', message);
        this.setFriendDetailMessage('Friend collections unavailable right now.');
    }

    async renderLocalLeaderboard() {
        const leaderboardContent = document.getElementById('leaderboard-content');
        if (!leaderboardContent) return;

        const wrapSection = (title, bodyHtml, subtitle = '') => `
            <div style="margin-bottom: 28px;">
                <h3 style="font-size: 20px; font-weight: 700; color: #f5f5f5; margin: 0 0 6px;">${title}</h3>
                ${subtitle ? `<p style="margin: 0 0 14px; color: rgba(255,255,255,0.65); font-size: 13px;">${subtitle}</p>` : ''}
                ${bodyHtml}
            </div>
        `;

        if (this.isOnline() && this.api && this.player?.userId) {
            const now = Date.now();
            const cacheAge = now - this.playerCatchCache.fetchedAt;

            if (!this.playerCatchCache.entries.length || cacheAge > 15000) {
                leaderboardContent.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.6); padding: 30px;">Loading your top catches...</p>';
                try {
                    const catches = await this.api.getPlayerCatches(50);
                    this.playerCatchCache = {
                        entries: Array.isArray(catches) ? catches : [],
                        fetchedAt: Date.now()
                    };
                } catch (error) {
                    console.warn('[UI] Failed to fetch player catches:', error);
                    leaderboardContent.innerHTML = `<p style="text-align: center; color: rgba(255,255,255,0.5); padding: 40px;">Failed to load your catches.<br>${this.safeText(error.message || '')}</p>`;
                    return;
                }
            }

            const entries = this.playerCatchCache.entries;
            if (entries.length === 0) {
                leaderboardContent.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5); padding: 40px;">No catches logged yet. Cast a line!</p>';
                return;
            }

            const html = entries.slice(0, 10).map((entry, index) => {
                const timestamp = entry.created_at ? new Date(entry.created_at) : null;
                const locationText = entry.location_name ? ` · ${this.safeText(entry.location_name)}` : '';
                return `
                    <div class="leaderboard-entry">
                        <div class="leaderboard-rank">#${index + 1}</div>
                        <div class="leaderboard-info">
                            <div class="leaderboard-player">${this.safeText(entry.fish_name || 'Fish')}</div>
                            <div class="leaderboard-fish">${timestamp ? timestamp.toLocaleString() : 'Unknown date'}${locationText}</div>
                        </div>
                        <div class="leaderboard-weight">${Number(entry.fish_weight || 0).toFixed(2)} lbs</div>
                    </div>
                `;
            }).join('');

            const weightSection = wrapSection(
                '🏆 Heaviest Hauls',
                html || '<p style="color: rgba(255,255,255,0.6); text-align: center;">No catches logged yet. Cast a line!</p>',
                'Local catches live on this device.'
            );
            leaderboardContent.innerHTML = weightSection;
            return;
        }

        // Offline fallback (local inventory)
        const top10 = this.inventory.getTop10();
        const weightHtml = top10.length === 0
            ? '<p style="text-align: center; color: rgba(255,255,255,0.5); padding: 40px;">No catches yet. Go fishing!</p>'
            : top10.map((fishCatch, index) => {
                const date = new Date(fishCatch.timestamp);
                return `
                    <div class="leaderboard-entry">
                        <div class="leaderboard-rank">#${index + 1}</div>
                        <div class="leaderboard-info">
                            <div class="leaderboard-player">${this.safeText(fishCatch.fishName)}</div>
                            <div class="leaderboard-fish">${date.toLocaleDateString()}</div>
                        </div>
                        <div class="leaderboard-weight">${fishCatch.weight.toFixed(2)} lbs</div>
                    </div>
                `;
            }).join('');

        const weightSection = wrapSection(
            '🏆 Heaviest Hauls',
            weightHtml,
            'These catches are stored locally. Sync online to share the bragging rights.'
        );
        leaderboardContent.innerHTML = weightSection;
    }

    buildSpeedBoardMarkup({ entries = [], title = '⚡ Speed Board', subtitle = '', playerBest = null, emptyMessage = null } = {}) {
        const defaultEmpty = emptyMessage || 'No lightning-fast hooks yet. Nail that perfect snap to claim the crown!';

        const body = entries.length
            ? entries.map((entry, index) => {
                const playerName = this.safeText(entry.playerName || 'Unknown angler');
                const fishName = entry.fishName ? this.safeText(entry.fishName) : null;
                const weightText = entry.weight !== undefined && entry.weight !== null
                    ? ` (${Number(entry.weight).toFixed(2)} lbs)`
                    : '';
                const location = entry.locationName ? this.safeText(entry.locationName) : null;
                const timestampText = entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : '';
                const reaction = Number(entry.reactionTimeMs);
                const reactionText = Number.isFinite(reaction) ? reaction : '--';
                const isPlayer = (this.player?.userId && entry.playerId === this.player.userId) ||
                    (!this.player?.userId && this.player?.name && playerName === this.player.name);
                const fishLabelParts = [];
                if (fishName) {
                    fishLabelParts.push(`Hooked a ${fishName}${weightText}`);
                }
                if (location) {
                    fishLabelParts.push(location);
                }
                if (timestampText) {
                    fishLabelParts.push(timestampText);
                }
                const metaLine = fishLabelParts.length ? fishLabelParts.join(' · ') : 'Hooked something mysterious';

                return `
                    <div class="leaderboard-entry ${isPlayer ? 'player-entry' : ''}">
                        <div class="leaderboard-rank">#${index + 1}</div>
                        <div class="leaderboard-info">
                            <div class="leaderboard-player">${playerName}</div>
                            <div class="leaderboard-fish">${metaLine}</div>
                        </div>
                        <div class="leaderboard-weight">${reactionText}<span style="font-size: 11px; margin-left: 3px; text-transform: uppercase; color: rgba(255,255,255,0.7);">ms</span></div>
                    </div>
                `;
            }).join('')
            : `<p style="text-align: center; color: rgba(255,255,255,0.55); padding: 36px 20px;">${this.safeText(defaultEmpty)}</p>`;

        const note = playerBest && Number.isFinite(Number(playerBest.reactionTimeMs))
            ? `<div style="margin-top: 10px; padding: 10px 14px; border-radius: 10px; background: rgba(100, 181, 246, 0.18); color: #e3f2fd;">Your quickest hook: <strong>${Number(playerBest.reactionTimeMs)} ms</strong>. Keep those paws ready!</div>`
            : '';

        return `
            <div style="padding: 6px 0;">
                <h3 style="font-size: 20px; font-weight: 700; color: #f5f5f5; margin: 0 0 6px;">${title}</h3>
                ${subtitle ? `<p style="margin: 0 0 14px; color: rgba(255,255,255,0.65); font-size: 13px;">${this.safeText(subtitle)}</p>` : ''}
                ${body}
                ${note}
            </div>
        `;
    }

    async renderSpeedLeaderboard(forceRefresh = false) {
        const leaderboardContent = document.getElementById('leaderboard-content');
        if (!leaderboardContent) return;

        const loadingMessage = '<p style="text-align: center; color: rgba(255,255,255,0.6); padding: 30px;">Checking who has the quickest paws...</p>';
        leaderboardContent.innerHTML = loadingMessage;

        const localEntries = this.getLocalSpeedLeaderboardEntries();
        const localPlayerBest = this.player ? this.leaderboard?.getPlayerBestReaction(this.player.name) : null;

        if (!this.isOnline() || !this.api) {
            leaderboardContent.innerHTML = this.buildSpeedBoardMarkup({
                entries: localEntries,
                subtitle: 'Local-only sprint times. Connect online to enter the global dash.',
                playerBest: localPlayerBest
            });
            return;
        }

        try {
            const entries = await this.refreshSpeedLeaderboard(forceRefresh);
            const mapped = entries.map(entry => ({
                playerId: entry.player_id || null,
                playerName: entry.username || 'Unknown angler',
                fishName: entry.fish_name || null,
                weight: entry.fish_weight !== undefined ? Number(entry.fish_weight) : null,
                locationName: entry.location_name || null,
                reactionTimeMs: entry.reaction_time_ms !== undefined ? Number(entry.reaction_time_ms) : null,
                timestamp: entry.created_at || null
            }));

            const playerBest = mapped.find(entry => {
                if (this.player?.userId && entry.playerId) {
                    return entry.playerId === this.player.userId;
                }
                if (!this.player?.userId && this.player?.name) {
                    return entry.playerName === this.player.name;
                }
                return false;
            }) || localPlayerBest;

            leaderboardContent.innerHTML = this.buildSpeedBoardMarkup({
                entries: mapped,
                subtitle: 'Global lightning-hook rankings. Snap fast, brag often.',
                playerBest,
                emptyMessage: 'No hooks on record yet. Be the first to set the water on fire!'
            });
        } catch (error) {
            console.warn('[UI] Failed to render speed leaderboard:', error);
            const fallbackMarkup = this.buildSpeedBoardMarkup({
                entries: localEntries,
                subtitle: 'Showing local data (speed board server unavailable).',
                playerBest: localPlayerBest
            });
            leaderboardContent.innerHTML = `<div class="friends-placeholder error" style="margin-bottom: 16px;">Live speed board unavailable.<br>${this.safeText(error.message || '')}</div>${fallbackMarkup}`;
        }
    }

    async refreshSpeedLeaderboard(forceRefresh = false) {
        if (!this.api || !this.isOnline()) {
            return this.getLocalSpeedLeaderboardEntriesRaw();
        }

        const now = Date.now();
        if (!forceRefresh) {
            const cacheAge = now - this.speedLeaderboardCache.fetchedAt;
            if (this.speedLeaderboardCache.entries.length > 0 && cacheAge < 15000) {
                return this.speedLeaderboardCache.entries;
            }
        }

        const entries = await this.api.getSpeedLeaderboard(50);
        const normalized = Array.isArray(entries) ? entries : [];
        this.speedLeaderboardCache = {
            entries: normalized,
            fetchedAt: now
        };
        return normalized;
    }

    getLocalSpeedLeaderboardEntriesRaw() {
        if (!this.leaderboard) return [];
        return this.leaderboard.getSpeedBoardTop();
    }

    getLocalSpeedLeaderboardEntries() {
        const raw = this.getLocalSpeedLeaderboardEntriesRaw();
        return raw.map(entry => ({
            playerId: null,
            playerName: entry.playerName,
            fishName: entry.fishName,
            weight: entry.weight,
            locationName: entry.locationName || null,
            reactionTimeMs: entry.reactionTimeMs,
            timestamp: entry.timestamp || null
        }));
    }

    renderFriendCode() {
        const friendCodeEl = document.getElementById('friends-player-code');
        if (!friendCodeEl) return;

        if (!this.player) {
            friendCodeEl.textContent = '------';
            return;
        }

        if (!this.isOnline()) {
            friendCodeEl.textContent = this.player.friendCode || 'OFFLINE';
            return;
        }

        friendCodeEl.textContent = this.player.friendCode || '------';
    }

    isOnline() {
        return Boolean(this.player?.userId && this.api);
    }

    showFriendMessage(message, tone = 'info', duration = 4000) {
        const messageEl = document.getElementById('friends-add-message');
        if (!messageEl) return;

        messageEl.textContent = message;
        messageEl.classList.remove('hidden');
        if (tone === 'error') {
            messageEl.classList.add('error');
        } else {
            messageEl.classList.remove('error');
        }

        if (this.friendMessageTimer) {
            clearTimeout(this.friendMessageTimer);
        }

        if (duration > 0) {
            this.friendMessageTimer = setTimeout(() => this.clearFriendMessage(), duration);
        }
    }

    clearFriendMessage() {
        const messageEl = document.getElementById('friends-add-message');
        if (!messageEl) return;
        messageEl.textContent = '';
        messageEl.classList.add('hidden');
        messageEl.classList.remove('error');
        this.friendMessageTimer = null;
    }

    setFriendsPlaceholder(elementId, text) {
        const element = document.getElementById(elementId);
        if (!element) return;
        element.classList.add('friends-placeholder');
        element.innerHTML = `<p>${this.safeText(text)}</p>`;
    }

    safeText(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/[&<>"']/g, (char) => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return map[char] || char;
        });
    }

    safeAttr(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/["'<>\s]/g, (char) => {
            const map = { '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;', ' ': '%20' };
            return map[char] || '';
        });
    }

    formatRelativeTime(dateString) {
        if (!dateString) return '';
        const timestamp = new Date(dateString).getTime();
        if (Number.isNaN(timestamp)) return '';

        const diffMs = Date.now() - timestamp;
        const diffMinutes = Math.round(diffMs / 60000);

        if (diffMinutes < 1) return 'just now';
        if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;

        const diffHours = Math.round(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;

        const diffDays = Math.round(diffHours / 24);
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }

    async handleSendFriendRequest(code) {
        try {
            await this.api.sendFriendRequest(code);
            this.showFriendMessage('Friend request sent!');
            await this.refreshFriends(true);
        } catch (error) {
            const message = error?.message || 'Failed to send friend request.';
            this.showFriendMessage(message, 'error');
        }
    }

    async handleFriendsListClick(event) {
        const actionTarget = event.target.closest('[data-action]');
        if (actionTarget) {
            const action = actionTarget.dataset.action;

        if (action === 'copy') {
                event.preventDefault();
                event.stopPropagation();
                const code = actionTarget.dataset.code;
            if (!code) return;
            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(code);
                    this.showFriendMessage('Friend code copied to clipboard!');
                } else {
                    this.showFriendMessage('Clipboard unavailable. Tap and hold to copy manually.', 'error');
                }
            } catch (error) {
                console.warn('[UI] Failed to copy friend code:', error);
                this.showFriendMessage('Copy failed. Tap and hold to copy manually.', 'error');
            }
            return;
        }

        if (action === 'remove') {
                event.preventDefault();
                event.stopPropagation();

            if (!this.isOnline()) {
                this.showFriendMessage('Connect to remove friends.', 'error');
                return;
            }

                const friendId = actionTarget.dataset.id;
            if (!friendId) return;

            try {
                    actionTarget.disabled = true;
                await this.api.removeFriend(friendId);
                this.showFriendMessage('Friend removed.');
                await this.refreshFriends(true);
            } catch (error) {
                console.warn('[UI] Failed to remove friend:', error);
                this.showFriendMessage(error?.message || 'Failed to remove friend.', 'error');
            } finally {
                    actionTarget.disabled = false;
                }
                return;
            }
        }

        const entry = event.target.closest('.friends-entry');
        if (!entry) return;
        const friendId = entry.dataset.friendId;
        if (!friendId) return;

        await this.selectFriendEntry(friendId);
    }

    async handlePendingListClick(event) {
        const target = event.target.closest('[data-action]');
        if (!target || !this.isOnline()) return;

        const action = target.dataset.action;
        const requestId = target.dataset.requestId;
        if (!requestId) return;

        try {
            target.disabled = true;
            if (action === 'accept') {
                await this.api.acceptFriendRequest(requestId);
                this.showFriendMessage('Friend request accepted!');
            } else if (action === 'decline') {
                await this.api.declineFriendRequest(requestId);
                this.showFriendMessage('Friend request declined.');
            } else {
                target.disabled = false;
                return;
            }

            await this.refreshFriends(true);
        } catch (error) {
            console.warn('[UI] Failed to update request:', error);
            this.showFriendMessage(error?.message || 'Failed to update request.', 'error');
        } finally {
            target.disabled = false;
        }
    }
    
    renderShop(category) {
        if (!this.player) return;
        
        this.currentShopTab = category;
        document.querySelectorAll('.shop-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.shopTab === category);
        });
        
        import('./tackleShop.js').then(({ TackleShop, getTackleByCategory, purchase, equip, canAfford, canUnlock }) => {
            const shopItems = document.getElementById('shop-items');
            if (!shopItems) return;
            
            const items = getTackleByCategory(category);
            const categorySingular = category.slice(0, -1); // Remove 's' from 'rods' -> 'rod'
            const currentGear = this.player.gear[categorySingular] || this.player.gear[category];
            
            shopItems.innerHTML = items.map(item => {
                const isOwned = this.player.tackleUnlocks[category].includes(item.id);
                const isEquipped = currentGear === item.name;
                const isUnlocked = canUnlock(item.unlockLevel, this.player.level, this.player.tackleUnlocks[category], item.id);
                const canBuy = canAfford(item.cost, this.player.money);
                
                let buttonText = 'Equip';
                let buttonClass = 'shop-button';
                let buttonDisabled = false;
                
                if (!isOwned) {
                    if (!isUnlocked) {
                        buttonText = `Locked (Lv ${item.unlockLevel})`;
                        buttonClass += ' locked';
                        buttonDisabled = true;
                    } else if (!canBuy) {
                        buttonText = 'Not enough money';
                        buttonClass += ' locked';
                        buttonDisabled = true;
            } else {
                        buttonText = `Buy $${item.cost}`;
                        buttonClass = 'shop-button';
                    }
                } else if (isEquipped) {
                    buttonText = 'Equipped';
                    buttonClass += ' equipped';
                    buttonDisabled = true;
                }
                
                const stats = [];
                if (item.catchBonus !== undefined) stats.push(`Catch: +${item.catchBonus}`);
                if (item.strength !== undefined) stats.push(`Strength: ${item.strength}`);
                if (item.speedBonus !== undefined) stats.push(`Speed: +${item.speedBonus}`);
                if (item.smoothness !== undefined) stats.push(`Smoothness: ${item.smoothness}`);
                if (item.visibility !== undefined) stats.push(`Visibility: ${item.visibility}`);
                if (item.timingWindow !== undefined) stats.push(`Timing: ${item.timingWindow}ms`);
                if (item.durability !== undefined) stats.push(`Durability: ${item.durability}`);
                
                const statsHtml = stats.length > 0 
                    ? `<div class="shop-item-stats">${stats.map(s => `<span class="shop-item-stat">${s}</span>`).join('')}</div>` 
                    : '';
                
                return `
                    <div class="shop-item">
                        <div class="shop-item-header">
                            <div class="shop-item-name">${item.name}</div>
                            <div class="shop-item-cost">$${item.cost}</div>
                        </div>
                        <div class="shop-item-description">${item.description}</div>
                        ${statsHtml}
                        <div class="shop-item-actions">
                            <button class="${buttonClass}" data-category="${category}" data-item-id="${item.id}" ${buttonDisabled ? 'disabled' : ''}>
                                ${buttonText}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add event listeners to buttons
            shopItems.querySelectorAll('.shop-button').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const category = btn.dataset.category;
                    const itemId = parseInt(btn.dataset.itemId);
                    const item = items.find(i => i.id === itemId);
                    const isOwned = this.player.tackleUnlocks[category].includes(itemId);
                    
                    if (!isOwned) {
                        // Purchase
                        const result = purchase(this.player, category, itemId);
                        if (result.success) {
                            // Play click sound for equipment change
                            if (this.sfx) {
                                this.sfx.play2D("mouse_click", 0.5, 1.0);
                            }
                            this.updatePlayerInfo();
                            this.renderShop(category); // Refresh shop
                            this.evaluateAchievements('purchase');
                        } else {
                            alert(result.message);
                        }
                    } else {
                        // Equip
                        const result = equip(this.player, category, itemId);
                        if (result.success) {
                            // Play click sound for equipment change
                            if (this.sfx) {
                                this.sfx.play2D("mouse_click", 0.5, 1.0);
                            }
                            this.player.save();
                            this.renderShop(category); // Refresh shop
                            this.evaluateAchievements('equip');
                        } else {
                            alert(result.message);
                        }
                    }
                });
            });
        }).catch(error => {
            console.error('[UI] Failed to load tackleShop:', error);
        });
    }
    
    renderInventory(tab) {
        if (!this.inventory || !this.player) return;
        
        const inventoryContent = document.getElementById('inventory-content');
        if (!inventoryContent) return;
        
        this.currentInventoryTab = tab;
        document.querySelectorAll('.inventory-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.inventoryTab === tab);
        });
        
        if (tab === 'top10') {
            const top10 = this.inventory.getTop10();
            if (top10.length === 0) {
                inventoryContent.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5); padding: 40px;">No catches yet. Go fishing!</p>';
            } else {
                inventoryContent.innerHTML = top10.map((fishCatch, index) => {
                    const date = new Date(fishCatch.timestamp);
                    return `
                        <div class="inventory-item">
                            <div class="inventory-item-header">
                                <div class="inventory-item-name">#${index + 1} - ${fishCatch.fishName}</div>
                                <div class="inventory-item-weight">${fishCatch.weight.toFixed(2)} lbs</div>
                            </div>
                            <div class="inventory-item-date">${date.toLocaleDateString()}</div>
                        </div>
                    `;
                }).join('');
            }
        } else if (tab === 'collection') {
            import('./fishTypes.js').then(({ FishTypes, getFishImagePath }) => {
                const collection = this.fishCollection ? this.fishCollection.getAllCollectionData() : {};
                
                // Get biggest catch for each fish from inventory
                const getBiggestCatchForFish = (fishId) => {
                    if (!this.inventory) return null;
                    
                    const allCatches = [];
                    
                    // Check top 10 biggest fish
                    const top10 = this.inventory.getTop10();
                    const fishInTop10 = top10.filter(c => c.fishId === fishId);
                    allCatches.push(...fishInTop10.map(c => c.weight));
                    
                    // Check recent catches
                    const recent = this.inventory.getRecentCatches();
                    const fishInRecent = recent.filter(c => c.fishId === fishId);
                    allCatches.push(...fishInRecent.map(c => c.weight));
                    
                    // If we found any catches for this fish, return the max weight
                    if (allCatches.length > 0) {
                        return Math.max(...allCatches);
                    }
                    
                    return null;
                };
                
                // Check if collection data exists and has fish
                if (!FishTypes || FishTypes.length === 0) {
                    inventoryContent.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5); padding: 40px;">Loading fish data...</p>';
            return;
        }
        
                inventoryContent.innerHTML = `
                    <div class="collection-grid">
                        ${FishTypes.map(fish => {
                            const fishData = collection[fish.id];
                            const isCaught = fishData && fishData.caught === true;
                            const catchCount = fishData ? (fishData.count || 0) : 0;
                            const biggestCatch = isCaught ? getBiggestCatchForFish(fish.id) : null;
                            const imagePath = getFishImagePath(fish.name);
                            return `
                                <div class="collection-item ${isCaught ? '' : 'locked'}" data-fish-id="${fish.id}" style="cursor: ${isCaught ? 'pointer' : 'default'};">
                                    <img src="${imagePath}" alt="${fish.name}" class="collection-item-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                    <div style="display: none; width: 80px; height: 80px; background: rgba(255,255,255,0.1); border-radius: 10px; flex-direction: column; align-items: center; justify-content: center; font-size: 32px;">🐟</div>
                                    <div class="collection-item-name">${fish.name}</div>
                                    ${isCaught ? `
                                        <div style="font-size: 11px; color: rgba(255,255,255,0.8); margin-top: 4px; text-align: center;">
                                            Caught: ${catchCount} time${catchCount !== 1 ? 's' : ''}
                                        </div>
                                        ${biggestCatch ? `
                                            <div style="font-size: 11px; color: #fbbf24; margin-top: 2px; text-align: center; font-weight: bold;">
                                                Biggest: ${biggestCatch.toFixed(2)} lbs
                                            </div>
                                        ` : ''}
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
                
                // Add click handlers to caught fish items
                inventoryContent.querySelectorAll('.collection-item:not(.locked)').forEach(item => {
                    item.addEventListener('click', () => {
                        const fishId = parseInt(item.dataset.fishId);
                        const fish = FishTypes.find(f => f.id === fishId);
                        if (fish) {
                            this.showFishDetails(fish, collection[fishId]);
                        }
                    });
                });
            }).catch(error => {
                console.error('[UI] Failed to load fishTypes:', error);
                inventoryContent.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5); padding: 40px;">Failed to load collection. Please refresh.</p>';
            });
        } else if (tab === 'achievements') {
            this.renderAchievementsTab(inventoryContent);
        } else if (tab === 'settings') {
            // Settings tab with reset progress button
            inventoryContent.innerHTML = `
                <div style="padding: 20px;">
                    <h3 style="margin-bottom: 20px; color: #4a90e2;">Game Settings</h3>
                    <div style="background: rgba(255, 255, 255, 0.05); border-radius: 10px; padding: 20px; margin-bottom: 20px;">
                        <div style="margin-bottom: 15px;">
                            <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #ef4444;">⚠️ Danger Zone</div>
                            <div style="font-size: 14px; color: rgba(255, 255, 255, 0.7); margin-bottom: 15px;">
                                Reset all progress and start from the beginning. This action cannot be undone!
                            </div>
                            <button id="reset-progress-btn" style="
                                padding: 12px 24px;
                                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                                color: white;
                                border: 2px solid rgba(255, 255, 255, 0.3);
                                border-radius: 8px;
                                font-size: 14px;
                                font-weight: bold;
                                cursor: pointer;
                                transition: all 0.2s;
                                width: 100%;
                            " onmouseover="this.style.background='linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'; this.style.transform='scale(1.02)'" onmouseout="this.style.background='linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'; this.style.transform='scale(1)'">
                                🔄 Reset All Progress
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // Add reset button handler
            const resetBtn = document.getElementById('reset-progress-btn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    this.showResetConfirmation();
                });
            }
        }
    }
    
    renderLeaderboard(tab) {
        if (!this.leaderboard || !this.player) return;

        this.activeLeaderboardTab = tab;

        const leaderboardContent = document.getElementById('leaderboard-content');
        if (!leaderboardContent) return;

        document.querySelectorAll('.leaderboard-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.leaderboardTab === tab);
        });

        if (tab === 'local') {
            this.renderLocalLeaderboard().catch(error => {
                console.warn('[UI] Failed to render local leaderboard:', error);
            });
        } else if (tab === 'global') {
            this.renderGlobalLeaderboardSection();
        } else if (tab === 'speed') {
            this.renderSpeedLeaderboard();
        }
    }
    
    updateLocationSelector() {
        const locationSelect = document.getElementById('location-select');
        if (!locationSelect || !this.game?.locations || !this.player) {
            return;
        }
        
        // Clear existing options
        locationSelect.innerHTML = '';
        
        // Get all locations
        const locations = this.game.locations.locations;
        const currentLocationIndex = this.game.locations.getCurrentLocationIndex();
        
        // Add options for unlocked locations only
        locations.forEach((location, index) => {
            if (this.player.locationUnlocks.includes(index)) {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = location.name;
                if (index === currentLocationIndex) {
                    option.selected = true;
                }
                locationSelect.appendChild(option);
            }
        });
        
        // If no locations unlocked, add at least the first one
        if (locationSelect.options.length === 0 && locations.length > 0) {
            const option = document.createElement('option');
            option.value = 0;
            option.textContent = locations[0].name;
            option.selected = true;
            locationSelect.appendChild(option);
        }
    }
    
    handleLocationChange(locationIndex) {
        if (!this.game?.locations) {
            console.warn('[UI] Locations system not available');
            return;
        }
        
        const location = this.game.locations.getLocation(locationIndex);
        if (!location) {
            console.warn('[UI] Invalid location index:', locationIndex);
            return;
        }
        
        // Check if location is unlocked
        if (!this.player.locationUnlocks.includes(locationIndex)) {
            console.warn('[UI] Location not unlocked:', location.name);
            return;
        }
        
        // Check if player can afford the location
        if (this.player.money < location.cost) {
            this.showToast({
                type: 'error',
                title: 'Not enough money',
                body: `You need $${location.cost} to travel.`
            });
            return;
        }
        
        console.log('[UI] Changing location to:', location.name);
        
        // Switch location (this will update water type and platform automatically)
        this.game.changeLocation(locationIndex);
        
        // Deduct cost if not free
        if (location.cost > 0) {
            this.player.spendMoney(location.cost);
            this.updatePlayerInfo();
        }
        
        if (this.player) {
            this.player.currentLocationIndex = locationIndex;
            this.player.save({ skipSync: true });
        }
        
        // Update location selector to show current selection
        this.updateLocationSelector();
        
        this.showToast({
            type: 'info',
            title: 'Location updated',
            body: `Now fishing at ${location.name}.`
        });
    }

    handleCastOrSetHook() {
        const castButton = document.getElementById('cast-button');
        const currentState = castButton?.getAttribute('data-state');

        if (!this.fishing) {
            console.error('Fishing system not available');
            return;
        }
        
        // Check if we're setting hook (after bite)
        if (this.waitingForBite && this.biteStrikeTime) {
            this.handleSetHook();
            return;
        }

        if (currentState === 'waiting' || currentState === 'fighting') {
            return;
        }
        
        // Otherwise, cast
        this.handleCast();
    }

    handleCast() {
        console.log('[UI] Handle cast called');
        const castButton = document.getElementById('cast-button');
        
        if (!this.fishing) {
            console.error('Fishing system not available');
            return;
        }
        
        // Reset bite detection state
        this.waitingForBite = false;
        this.biteStrikeTime = null;
        this.hookSetSuccess = false;
        
        castButton.disabled = true;
        castButton.textContent = 'WAITING...'; // Change to WAITING immediately after cast
        castButton.setAttribute('data-state', 'waiting');
        
        // Call fishing cast
        try {
            this.fishing.cast();
        } catch (error) {
            console.error('Error in cast:', error);
            castButton.disabled = false;
            castButton.textContent = 'CAST';
            castButton.removeAttribute('data-state');
            return;
        }
        
        // Wait for bobber to land and settle in water before starting bite detection
        // Cast animation takes ~1.1 seconds, bobber lands and settles, then wait for bite
        // According to reference: bobber needs to be floating in water before bite detection starts
        setTimeout(() => {
            if (this.fishing && this.fishing.bobber && this.fishing.bobber.visible) {
                // Wait for bobber to fully settle in water (floating state established)
                // This ensures the bobber is floating before we start the bite timer
                setTimeout(() => {
                    if (this.fishing && this.fishing.bobber && this.fishing.bobber.visible && this.fishing.bobber.userData.floating) {
                        console.log('[UI] Bobber settled in water, starting bite detection timer');
                        // Now start the bite detection timer (which will wait 0.5-7 seconds based on level)
                        // Button already shows "WAITING..." so we just start the timer
                        this.startBiteDetection();
                } else {
                        console.warn('[UI] Bobber not ready for bite detection');
                    }
                }, 2000); // Wait 2 seconds for bobber to fully settle after landing
            }
        }, 3000); // Wait 3 seconds for cast to complete and bobber to land
    }
    
    startBiteDetection() {
        if (!this.player || !this.game?.locations) {
            console.warn('[UI] Player or locations not available for bite detection');
            return;
        }
        
        const castButton = document.getElementById('cast-button');
        const currentLocation = this.game.locations.getCurrentLocation();
        
        // Import bite detection
        import('./biteDetection.js').then(({ calculateBiteTiming, getReactionTimeWindow }) => {
            // Calculate bite timing based on player level
            const { min, max } = calculateBiteTiming(this.player.level);
            const biteTime = min + Math.random() * (max - min);
            
            console.log(`[UI] Waiting for bite: ${(biteTime / 1000).toFixed(1)}s`);
            
            this.waitingForBite = true;
            // Button already shows "WAITING..." from handleCast, so we just keep it disabled
            castButton.disabled = true;
            
            // Wait for bite
            setTimeout(() => {
                if (!this.waitingForBite) return; // Cast was cancelled
                
                // Fish strikes!
                this.biteStrikeTime = Date.now();
                this.handleFishBite();
                
                // Auto-fail if player doesn't react in time
                const reactionWindow = getReactionTimeWindow();
                this.autoFailTimer = setTimeout(() => {
                    if (!this.hookSetSuccess && this.biteStrikeTime) {
                        this.handleMiss('Too slow! Fish got away!');
                    }
                }, reactionWindow);
                
            }, biteTime);
        }).catch(error => {
            console.error('[UI] Failed to load bite detection:', error);
            // Fallback: hook immediately
            this.handleFishBite();
        });
    }
    
    handleFishBite() {
        const castButton = document.getElementById('cast-button');
        
        // Show bite animation/effect
        if (this.fishing?.bobber) {
            // Trigger bobber strike animation
            this.fishing.bobber.userData.biteStrike = true;
            this.fishing.bobber.userData.biteStrikeTime = this.fishing.sceneRef?.clock?.elapsedTime || Date.now() / 1000;
            
            // Trigger splash effect at bobber
            if (this.fishing.splash && this.fishing.bobber) {
                this.fishing.splash.trigger(this.fishing.bobber.position);
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        if (this.fishing.splash) {
                            this.fishing.splash.triggerRipple(this.fishing.bobber.position);
                        }
                    }, i * 100);
                }
            }
            
            console.log('[UI] Fish strikes!');
        }
        
        // Change button to "SET HOOK!"
        castButton.textContent = 'SET HOOK!';
        castButton.disabled = false;
        castButton.style.background = 'rgba(255, 100, 100, 0.9)'; // Red for urgency
        castButton.setAttribute('data-state', 'set-hook');
    }
    
    handleSetHook() {
        if (!this.biteStrikeTime) {
            console.warn('[UI] handleSetHook called but no bite strike time');
            return;
        }
        
        // Clear auto-fail timer immediately when user clicks
        if (this.autoFailTimer) {
            clearTimeout(this.autoFailTimer);
            this.autoFailTimer = null;
        }
        
        const castButton = document.getElementById('cast-button');
        const reactionTime = Date.now() - this.biteStrikeTime;
        
        console.log('[UI] Setting hook - Reaction time:', reactionTime, 'ms');
        
        // Import bite detection
        import('./biteDetection.js').then(({ calculateCatchChance, determineCatch }) => {
            import('./tackleShop.js').then(({ getHookTimingWindow }) => {
                const currentLocation = this.game.locations.getCurrentLocation();
                
                // Calculate catch probability
                const catchProbability = calculateCatchChance(this.player, currentLocation, null);
                
                // Get hook timing window
                const timingWindow = getHookTimingWindow(this.player);
                
                console.log('[UI] Catch check - Probability:', (catchProbability * 100).toFixed(1) + '%, Reaction time:', reactionTime, 'ms, Timing window:', timingWindow, 'ms');
                
                // Determine if catch or miss
                const isCatch = determineCatch(catchProbability, reactionTime, timingWindow);
                
                if (isCatch) {
                    // CATCH! Hook the fish and start fight
                    console.log('[UI] Catch successful! Reaction time:', reactionTime, 'ms');
                    this.hookSetSuccess = true;
                    this.waitingForBite = false;
                    
                    castButton.disabled = true;
                    castButton.textContent = 'FIGHTING...';
                    castButton.style.background = '';
                    castButton.setAttribute('data-state', 'fighting');
                    
                    // Hook fish and start fight
            if (this.fishing.bobber && this.fishing.bobber.visible) {
                        // Spawn fish at bobber location (fish is determined by location)
                        this.fish.spawnFish();
                        // Hook the fish (starts fight)
                        this.fish.hook();
                        // Set fishing state for fight
                        this.fishing.setFishOnLine(true);
                        this.fishing.isReeling = true; // Start reeling/fighting
                        console.log('[UI] Fish hooked, fight begins!');
                    
                    if (this.fishing) {
                        this.fishing.lastReactionTimeMs = reactionTime;
                    }
                    }
            } else {
                    // MISS!
                    let reason = 'Missed! The fish got away!';
                    if (reactionTime > timingWindow) {
                        reason = 'Too slow! Fish got away!';
                    } else if (reactionTime < 200) {
                        reason = 'Too eager! Fish wasn\'t ready!';
                    }
                    console.log('[UI] Catch failed -', reason, 'Reaction time:', reactionTime, 'ms, Timing window:', timingWindow, 'ms');
                    this.handleMiss(reason);
                }
            }).catch(error => {
                console.error('[UI] Failed to load tackleShop:', error);
                this.handleMiss('Error loading tackle data');
            });
        }).catch(error => {
            console.error('[UI] Failed to load bite detection:', error);
            // Fallback: always catch
            this.hookSetSuccess = true;
            this.waitingForBite = false;
            if (this.fishing.bobber && this.fishing.bobber.visible) {
                this.fish.spawnFish();
                this.fish.hook();
            this.fishing.setFishOnLine(true);
                this.fishing.isReeling = true;
            }
        });
    }
    
    handleMiss(reason) {
        const castButton = document.getElementById('cast-button');
        
        this.waitingForBite = false;
        this.biteStrikeTime = null;
        this.hookSetSuccess = false;
        
        // Get humorous miss message based on reason
        let missMessage = this.getMissMessage(reason);
        
        // Show miss notification with humorous message
        this.showMissNotification(missMessage);
        
        // Reset button
        castButton.textContent = 'CAST';
        castButton.disabled = false;
        castButton.style.background = '';
        
        // Reset fishing state
        if (this.fishing) {
            this.fishing.isCasting = false;
            this.fishing.isReeling = false;
            this.fishing.fishOnLine = false;
            if (this.fishing.bobber) {
                this.fishing.bobber.visible = false;
            }
        }
        
        // Clear auto-fail timer
        if (this.autoFailTimer) {
            clearTimeout(this.autoFailTimer);
            this.autoFailTimer = null;
        }
    }
    
    getMissMessage(reason) {
        // Determine message type based on reason
        let messageType = 'general';
        const reasonLower = (reason || '').toLowerCase();
        if (reasonLower.includes('too slow') || reasonLower.includes('too quick')) {
            messageType = 'tooSlow';
        } else if (reasonLower.includes('too eager')) {
            messageType = 'tooEager';
        }
        
        // Humorous miss messages from reference file
        const missMessages = {
            tooEager: [
                "Too eager! Fish wasn't ready!",
                "Slow down, tiger! The fish needs a moment! 😸",
                "You're faster than a cat chasing a laser pointer! 🔴",
                "The fish said 'chill, let me finish my coffee first!' ☕"
            ],
            tooSlow: [
                "That fish was too quick for your paws! 🐾",
                "Too slow! Fish got away!",
                "The fish saw you coming and said 'NOPE!' 😹",
                "That fish escaped faster than you run from the vacuum! 🏃",
                "Fish are doing cat yoga down there! 🧘‍♀️",
                "Fish are on their meow-ning break! ☕",
                "That fish yelled 'DEUCES!' and swam away! ✌️",
                "The fish took one look at you and said 'Hard pass!' 🙅",
                "That fish went 'Nah fam, not today Satan!' 😈"
            ],
            general: [
                "That fish was too quick for your paws! 🐾",
                "The fish saw you coming and said 'NOPE!' 😹",
                "Just a nibble... your whiskers need more practice!",
                "Fish are gossiping about your casting technique! 😸",
                "They're doing cat yoga down there! 🧘‍♀️",
                "Fish are on their meow-ning break! ☕",
                "A ghost fish stole your bait and laughed! 👻😹",
                "Fish are watching cat videos... but not yours! 📺",
                "They swam away purring at your attempt!",
                "Your bait was too fancy for fish who prefer cat food! 🐟",
                "Fish are playing hide and seek... you're 'it'!",
                "Maybe try a different spot, furriend?",
                "That fish said 'meow-bee next time!' 😸",
                "Fish are having a catnip party without you! 🎉🌿",
                "Just a friendly turtle saying 'meow-lo!' 🐢",
                "The fish are playing tag... and you're still it!",
                "Your hook came back empty... like a cat's food bowl at 3am!",
                "Fish saw your cat avatar and got jealous! 😼",
                "They're busy practicing their fin-ishing moves!",
                "Fish are playing poker... and winning! 🃏",
                "Your bait was too spicy for their delicate palates! 🌶️",
                "Fish are on vacation... to avoid cats! 🏖️",
                "They're writing their memoirs... 'My Life as Cat Bait' 📝",
                "Fish are doing karaoke... 'Don't Stop Belly-in!' 🎤",
                "Just a crab waving hello with claws! 🦀",
                "Fish are practicing social distancing... from cats!",
                "They're having a business meeting... about avoiding cats! 💼",
                "Fish are doing homework... 'How to Avoid Being Caught 101' 📚",
                "Your purr-suasion skills need work! 😸",
                "That fish ghosted you harder than your last Tinder date! 💀",
                "Fish are filing a restraining order against you! 📋",
                "The fish laughed and gave you a participation trophy! 🏆",
                "Fish are starting a support group: 'Victims of Cat Fishing' 🎣",
                "That fish is now writing a strongly worded Yelp review about you! ⭐",
                "Fish are organizing a protest: 'Occupy the Deep End!' 📢",
                "The fish just added you to their fish-block list! 🚫",
                "Fish are literally creating an escape committee right now! 🏃‍♀️🏃‍♂️",
                "That fish is ghost writing its autobiography: 'The One That Got Away... Again' 📖",
                "The fish sent back your bait with a complaint form! 📝",
                "Fish are forming an anti-cat coalition... and you're President! 👔",
                "That fish just called its lawyer! And won! ⚖️",
                "The fish started a GoFundMe: 'Save Me From This Cat's Awful Casting' 💰",
                "Fish are doing inventory... of their bait collection you keep donating! 📦",
                "That fish put 'Professional Escapologist' on its LinkedIn! 💼",
                "The fish just roasted you in front of its whole school! 🔥",
                "Fish are voting you 'Least Threatening Cat of the Month' 🏅",
                "That fish escaped and is now teaching other fish your techniques... backwards! 🎓"
            ]
        };
        
        const messages = missMessages[messageType] || missMessages.general;
        return messages[Math.floor(Math.random() * messages.length)];
    }
    
    showMissNotification(message) {
        // Create miss notification with humorous styling
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 200, 100, 0.95);
            color: #333;
            padding: 20px 40px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
            z-index: 10000;
            font-family: 'Arial', sans-serif;
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            max-width: 80%;
            border: 3px solid rgba(255, 150, 50, 0.8);
            animation: popupFadeIn 0.3s ease-out;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds (longer for humorous messages)
        setTimeout(() => {
            notification.style.animation = 'popupFadeOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    handleFishCaught() {
        const castButton = document.getElementById('cast-button');
        
        // Reset bite detection state
        this.waitingForBite = false;
        this.biteStrikeTime = null;
        this.hookSetSuccess = false;
        
        // Reset button for next cast
        setTimeout(() => {
            castButton.disabled = false;
            castButton.textContent = 'CAST';
            castButton.style.background = '';
        }, 500);
        
        // Get fish data
        const fishData = this.fish.getCurrentFish();
        if (!fishData) {
            console.warn('[UI] No fish data for catch handling');
            return;
        }
        
        // Record catch in gameplay systems
        if (this.player && this.inventory && this.leaderboard && this.fishCollection) {
            const { species, weight, fishId, value, experience } = fishData;
            const rawReaction = this.fishing?.lastReactionTimeMs;
            const reactionTimeMs = typeof rawReaction === 'number' && Number.isFinite(rawReaction)
                ? Math.max(0, Math.round(rawReaction))
                : null;
            
            // Check if first catch of this fish
            const isFirstCatch = this.fishCollection.unlockFish(fishId);
            
            // Add to player catch tracking (returns unlocks if leveled up)
            const newUnlocks = this.player.addCatch({
                fishName: species,
                weight,
                fishId,
                value,
                experience,
                reactionTimeMs
            }, this.game?.locations, TackleShop);
            
            // Handle unlock if player leveled up (single unlock per level)
            if (newUnlocks) {
                this.handleUnlocks(newUnlocks);
            }
            
            // Add to inventory
            this.inventory.addCatch({
                fishName: species,
                weight,
                fishId,
                value,
                experience,
                reactionTimeMs,
                timestamp: Date.now()
            });
            this.inventory.save();
            
            // Update leaderboard
            const locationId = this.game?.locations?.getCurrentLocationIndex() || 0;
            
            this.leaderboard.addCatch({
                playerName: this.player.name,
                fishName: species,
                weight,
                reactionTimeMs,
                locationId,
                timestamp: Date.now()
            });

            if (this.api && this.isOnline()) {
                const currentLocation = this.game?.locations?.getCurrentLocation?.();
                const locationName = currentLocation?.name || null;

                this.api.logCatch({
                    fishName: species,
                    fishWeight: weight,
                    fishRarity: fishData.rarity,
                    locationName,
                    experienceGained: experience,
                    reactionTimeMs
                }).catch(error => {
                    console.warn('[UI] Failed to log catch activity:', error);
                });

                this.api.logLeaderboardCatch({
                    fishName: species,
                    fishWeight: weight,
                    locationName,
                    reactionTimeMs
                }).then(() => {
                    this.globalLeaderboardCache.fetchedAt = 0;
                    this.speedLeaderboardCache.fetchedAt = 0;
                    if (this.activeLeaderboardTab === 'global') {
                        this.renderGlobalLeaderboardSection(true);
                    } else if (this.activeLeaderboardTab === 'speed') {
                        this.renderSpeedLeaderboard(true);
                    }
                }).catch(error => {
                    console.warn('[UI] Failed to update leaderboard catch:', error);
                });
            }
            
            // Update top 10 biggest fish in player
            this.player.top10BiggestFish = this.inventory.getTop10();
            this.player.save();
            
            // Check for achievement unlocks after catch
            this.evaluateAchievements('catch');
            
            // Show first catch popup if needed
            if (isFirstCatch) {
        setTimeout(() => {
                    this.showFirstCatchPopup(fishData);
                }, 1900); // After celebration
            } else {
                // Show regular catch popup
                setTimeout(() => {
            this.showFishCatchPopup();
                }, 1900); // After celebration
            }
        } else {
            // Fallback: show regular popup if systems not available
            setTimeout(() => {
                this.showFishCatchPopup();
            }, 1900);
        }

        if (this.fishing) {
            this.fishing.lastReactionTimeMs = null;
        }
    }
    
    showFishCatchPopup() {
        // Get fish data from fish instance
        const fishData = this.fish.getCurrentFish();
        if (!fishData) {
            console.warn('[UI] No fish data available for popup');
            return;
        }
        
        // Remove existing popup if any
        const existingPopup = document.getElementById('fish-catch-popup');
        if (existingPopup) {
            existingPopup.remove();
        }
        
        // Create popup element
        const popup = document.createElement('div');
        popup.id = 'fish-catch-popup';
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 40px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            z-index: 10000;
            font-family: 'Arial', sans-serif;
            text-align: center;
            min-width: 300px;
            animation: popupFadeIn 0.3s ease-out;
        `;
        
        // Add animation keyframes to style tag if not exists
        if (!document.getElementById('popup-animations')) {
            const style = document.createElement('style');
            style.id = 'popup-animations';
            style.textContent = `
                @keyframes popupFadeIn {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.8);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                }
                @keyframes popupFadeOut {
                    from {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.8);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Determine size color for weight display
        const weight = fishData.weight;
        let sizeColor = '#fff';
        
        if (weight < 3.0) {
            sizeColor = '#4ade80';
        } else if (weight < 4.0) {
            sizeColor = '#60a5fa';
        } else if (weight < 6.0) {
            sizeColor = '#f59e0b';
        } else if (weight < 10.0) {
            sizeColor = '#f97316';
        } else {
            sizeColor = '#ef4444';
        }
        
        // Create popup content
        popup.innerHTML = `
            <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">
                🎣 Caught!
            </div>
            <div style="font-size: 20px; margin-bottom: 8px; font-weight: 600;">
                ${fishData.species || 'Fish'}
            </div>
            <div style="font-size: 28px; font-weight: bold; margin-bottom: 15px; color: ${sizeColor};">
                ${weight.toFixed(2)} lbs
            </div>
            <div style="font-size: 16px; margin-bottom: 8px; color: #c4d9ff;">
                +${Math.floor(fishData.experience || 0)} XP
            </div>
            <button id="popup-close-btn" style="
                margin-top: 20px;
                padding: 10px 30px;
                background: rgba(255, 255, 255, 0.2);
                border: 2px solid white;
                border-radius: 25px;
                color: white;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                Close
            </button>
        `;
        
        // Add to document
        document.body.appendChild(popup);
        
        // Close button handler
        const closeBtn = document.getElementById('popup-close-btn');
        closeBtn.addEventListener('click', () => {
            popup.style.animation = 'popupFadeOut 0.3s ease-out';
            setTimeout(() => popup.remove(), 300);
        });
        
        // Auto-close after 5 seconds
        setTimeout(() => {
            if (popup.parentNode) {
                popup.style.animation = 'popupFadeOut 0.3s ease-out';
                setTimeout(() => popup.remove(), 300);
            }
        }, 5000);
    }
    
    showFirstCatchPopup(fishData) {
        if (!fishData) {
            console.warn('[UI] No fish data for first catch popup');
            return;
        }
        
        // Remove existing popup if any
        const existingPopup = document.getElementById('first-catch-popup');
        if (existingPopup) {
            existingPopup.remove();
        }
        
        // Import fishTypes for image path only
        import('./fishTypes.js').then(({ getFishImagePath }) => {
            const fishName = fishData.species || fishData.name || 'Fish';
            const weight = fishData.weight || 0;
            const rarity = fishData.rarity || 'Common';
            const imagePath = getFishImagePath(fishName);
            
            // Rarity colors
            const rarityColors = {
                'Common': '#4ade80',
                'Uncommon': '#60a5fa',
                'Rare': '#f59e0b',
                'Epic': '#f97316',
                'Legendary': '#ef4444',
                'Trophy': '#fbbf24'
            };
            const rarityColor = rarityColors[rarity] || '#fff';
            
            // Create simple popup element
            const popup = document.createElement('div');
            popup.id = 'first-catch-popup';
            popup.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px 40px;
                border-radius: 15px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                z-index: 10001;
                font-family: 'Arial', sans-serif;
                text-align: center;
                min-width: 300px;
                max-width: 90vw;
                animation: popupFadeIn 0.3s ease-out;
            `;
            
            // Create simple popup content - just image, title, fish name, and weight
            popup.innerHTML = `
                <div style="font-size: 24px; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; color: #fbbf24;">
                    🎉 NEW FISH CAUGHT! 🎉
                </div>
                <div style="margin-bottom: 20px; position: relative; width: 200px; height: 200px; margin: 0 auto;">
                    <img src="${imagePath}" alt="${fishName}" 
                         style="max-width: 200px; max-height: 200px; width: auto; height: auto; border-radius: 10px; border: 3px solid ${rarityColor}; display: block;"
                         onerror="this.onerror=null; this.style.display='none'; this.parentElement.querySelector('.fish-placeholder').style.display='flex';">
                    <div class="fish-placeholder" style="display: none; width: 200px; height: 200px; background: rgba(255,255,255,0.1); border-radius: 10px; border: 3px solid ${rarityColor}; position: absolute; top: 0; left: 0; flex-direction: column; align-items: center; justify-content: center; font-size: 48px;">
                        🐟
                    </div>
                </div>
                <div style="font-size: 22px; margin-bottom: 15px; font-weight: 600;">
                    ${fishName}
                </div>
                <div style="font-size: 28px; font-weight: bold; margin-bottom: 20px; color: #fbbf24;">
                    ${weight.toFixed(2)} lbs
                </div>
                <button id="first-catch-close-btn" style="
                    margin-top: 10px;
                    padding: 10px 30px;
                    background: rgba(255, 255, 255, 0.2);
                    border: 2px solid white;
                    border-radius: 25px;
                    color: white;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                    Close
                </button>
            `;
            
            // Add to document
            document.body.appendChild(popup);
            
            // Close button handler
            const closeBtn = document.getElementById('first-catch-close-btn');
            closeBtn.addEventListener('click', () => {
                popup.style.animation = 'popupFadeOut 0.3s ease-out';
                setTimeout(() => popup.remove(), 300);
            });
            
            // Auto-close after 4 seconds
            setTimeout(() => {
                if (popup.parentNode) {
                    popup.style.animation = 'popupFadeOut 0.3s ease-out';
                    setTimeout(() => popup.remove(), 300);
                }
            }, 4000);
        }).catch(error => {
            console.error('[UI] Failed to load fishTypes:', error);
            // Fallback to regular popup
            this.showFishCatchPopup();
        });
    }
    
    handleUnlocks(newUnlock) {
        if (!newUnlock || !this.player) return;
        
        const isLevelPayload = newUnlock.type === 'level';
        const unlockDetails = isLevelPayload ? newUnlock.unlock : newUnlock;
        
        // Show level up popup near top of screen
        this.showLevelUpPopup(unlockDetails || newUnlock);
        
        // Check for achievement unlocks after level up
        this.evaluateAchievements('levelup');
        
        if (this.isOnline() && this.api && isLevelPayload) {
            const level = newUnlock.level ?? this.player.level;
            const levelsGained = newUnlock.levelsGained ?? 1;
            this.api.logLevelUp(level, levelsGained).catch(error => {
                console.warn('[UI] Failed to log level up activity:', error);
            });
        }
        
        if (unlockDetails?.type === 'location') {
            const location = unlockDetails.location;
            if (location) {
                this.updateLocationSelector();
            }
        } else if (unlockDetails?.type === 'tackle') {
            const tackle = unlockDetails.tackle;
            if (tackle && this.currentShopTab) {
                this.renderShop(this.currentShopTab);
            }
        }
    }
    
    showLevelUpPopup(newUnlock) {
        if (!this.player) return;
        
        // Remove existing popup if any
        const existingPopup = document.getElementById('level-up-popup');
        if (existingPopup) {
            existingPopup.remove();
        }
        
        const newLevel = this.player.level;
        let unlockText = '';
        let unlockIcon = '🎉';
        
        if (newUnlock.type === 'location') {
            const location = newUnlock.location;
            unlockText = `New Location: ${location.name}`;
            unlockIcon = '📍';
        } else if (newUnlock.type === 'tackle') {
            const tackle = newUnlock.tackle;
            const categoryName = tackle.category.charAt(0).toUpperCase() + tackle.category.slice(1);
            unlockText = `New ${categoryName}: ${tackle.name}`;
            unlockIcon = '🎣';
        }
        
        // Create level up popup near top of screen
        const popup = document.createElement('div');
        popup.id = 'level-up-popup';
        popup.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
            color: #1a1a2e;
            padding: 20px 30px;
            border-radius: 12px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
            z-index: 10002;
            font-family: 'Arial', sans-serif;
            text-align: center;
            min-width: 280px;
            max-width: 90vw;
            border: 3px solid rgba(255, 255, 255, 0.3);
            animation: popupFadeIn 0.3s ease-out;
        `;
        
        // Adjust top position for mobile (accounting for player info panel)
        if (window.innerWidth <= 768) {
            popup.style.top = '100px'; // Slightly lower on mobile
        }
        
        popup.innerHTML = `
            <div style="font-size: 20px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
                🎊 You've Reached Level ${newLevel}! 🎊
            </div>
            <div style="font-size: 16px; font-weight: 600; margin-top: 10px; color: #1a1a2e;">
                ${unlockIcon} ${unlockText}
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // Auto-close after 5 seconds
        setTimeout(() => {
            if (popup.parentNode) {
                popup.style.animation = 'popupFadeOut 0.3s ease-out';
                setTimeout(() => popup.remove(), 300);
            }
        }, 5000);
    }
    
    showBannerNotification(message, color = '#00ffff', duration = 3000) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 15%;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, ${color} 0%, #0088cc 100%);
            color: white;
            padding: 20px 40px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
            z-index: 10001;
            font-family: 'Arial', sans-serif;
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            max-width: 80%;
            animation: popupFadeIn 0.3s ease-out;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'popupFadeOut 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }
    
    showFishDetails(fish, collectionData) {
        if (!fish) return;
        
        // Import fishTypes for facts and image path
        import('./fishTypes.js').then(({ getFishFacts, getFishImagePath }) => {
            const facts = getFishFacts(fish.name);
            const imagePath = getFishImagePath(fish.name);
            const isCaught = collectionData && collectionData.caught === true;
            
            // Rarity colors
            const rarityColors = {
                'Common': '#4ade80',
                'Uncommon': '#60a5fa',
                'Rare': '#f59e0b',
                'Epic': '#f97316',
                'Legendary': '#ef4444',
                'Trophy': '#fbbf24'
            };
            const rarityColor = rarityColors[fish.rarity] || '#fff';
            
            // Remove existing popup if any
            const existingPopup = document.getElementById('fish-details-popup');
            if (existingPopup) {
                existingPopup.remove();
            }
            
            // Create detailed fish stats popup
            const popup = document.createElement('div');
            popup.id = 'fish-details-popup';
            popup.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%);
                color: white;
                padding: 30px 40px;
                border-radius: 15px;
                border: 2px solid ${rarityColor};
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
                z-index: 10002;
                font-family: 'Arial', sans-serif;
                max-width: 500px;
                max-height: 90vh;
                overflow-y: auto;
                animation: popupFadeIn 0.3s ease-out;
            `;
            
            const catchCount = collectionData ? collectionData.count || 0 : 0;
            const firstCatchDate = collectionData && collectionData.firstCatchDate 
                ? new Date(collectionData.firstCatchDate).toLocaleDateString() 
                : 'Not caught yet';
            
            popup.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: ${rarityColor}; font-size: 24px;">${fish.name}</h2>
                    <button id="fish-details-close-btn" style="
                        background: transparent;
                        border: none;
                        color: rgba(255,255,255,0.7);
                        font-size: 32px;
                        cursor: pointer;
                        padding: 0;
                        width: 40px;
                        height: 40px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 50%;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='white'" onmouseout="this.style.background='transparent'; this.style.color='rgba(255,255,255,0.7)'">&times;</button>
                </div>
                <div style="margin-bottom: 20px; text-align: center;">
                    <img src="${imagePath}" alt="${fish.name}" 
                         style="max-width: 200px; max-height: 200px; width: auto; height: auto; border-radius: 10px; border: 3px solid ${rarityColor}; display: block; margin: 0 auto;"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div style="display: none; width: 200px; height: 200px; background: rgba(255,255,255,0.1); border-radius: 10px; border: 3px solid ${rarityColor}; margin: 0 auto; flex-direction: column; align-items: center; justify-content: center; font-size: 48px;">
                        🐟
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 20px; margin-bottom: 15px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div>
                            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 5px;">Rarity</div>
                            <div style="font-size: 18px; font-weight: bold; color: ${rarityColor};">${fish.rarity}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 5px;">Season</div>
                            <div style="font-size: 18px; font-weight: bold;">${fish.season}</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div>
                            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 5px;">Weight Range</div>
                            <div style="font-size: 16px; font-weight: bold;">${fish.minWeight.toFixed(1)} - ${fish.maxWeight.toFixed(1)} lbs</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 5px;">Value</div>
                            <div style="font-size: 16px; font-weight: bold; color: #f39c12;">$${fish.value}</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 5px;">Experience</div>
                            <div style="font-size: 16px; font-weight: bold; color: #4a90e2;">+${fish.experience} XP</div>
                        </div>
                        ${isCaught ? `
                        <div>
                            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 5px;">Caught</div>
                            <div style="font-size: 16px; font-weight: bold;">${catchCount}x</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ${isCaught ? `
                <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 15px; margin-bottom: 15px;">
                    <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 5px;">First Caught</div>
                    <div style="font-size: 14px;">${firstCatchDate}</div>
                </div>
                ` : ''}
                <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 15px;">
                    <div style="font-size: 14px; margin-bottom: 10px; font-weight: bold; color: ${rarityColor};">About ${fish.name}</div>
                    <div style="font-size: 13px; line-height: 1.6; color: rgba(255,255,255,0.9);">
                        <div style="margin-bottom: 10px;"><strong style="color: #4a90e2;">Fact:</strong> ${facts.fact}</div>
                        <div style="margin-bottom: 10px;"><strong style="color: #f39c12;">Fun:</strong> ${facts.fun}</div>
                        <div><strong style="color: #27ae60;">Real:</strong> ${facts.real}</div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(popup);
            
            // Close button handler
            const closeBtn = document.getElementById('fish-details-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    popup.style.animation = 'popupFadeOut 0.3s ease-out';
                    setTimeout(() => popup.remove(), 300);
                });
            }
            
            // Close when clicking outside
            popup.addEventListener('click', (e) => {
                if (e.target === popup) {
                    popup.style.animation = 'popupFadeOut 0.3s ease-out';
                    setTimeout(() => popup.remove(), 300);
                }
            });
        }).catch(error => {
            console.error('[UI] Failed to load fishTypes:', error);
        });
    }
    
    showResetConfirmation() {
        // Create confirmation dialog
        const confirmDialog = document.createElement('div');
        confirmDialog.id = 'reset-confirmation-dialog';
        confirmDialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%);
            color: white;
            padding: 30px 40px;
            border-radius: 15px;
            border: 3px solid #ef4444;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
            z-index: 10003;
            font-family: 'Arial', sans-serif;
            text-align: center;
            min-width: 320px;
            max-width: 90vw;
            animation: popupFadeIn 0.3s ease-out;
        `;
        
        confirmDialog.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 20px; color: #ef4444;">⚠️ WARNING ⚠️</div>
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px;">Reset All Progress?</div>
            <div style="font-size: 14px; color: rgba(255, 255, 255, 0.8); margin-bottom: 25px; line-height: 1.6;">
                This will permanently delete:<br>
                • All your progress and levels<br>
                • All caught fish and collection<br>
                • All tackle purchases<br>
                • All leaderboard entries<br><br>
                <strong>This action CANNOT be undone!</strong>
            </div>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button id="reset-confirm-btn" style="
                    padding: 12px 30px;
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    color: white;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'" onmouseout="this.style.background='linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'">
                    Yes, Reset Everything
                </button>
                <button id="reset-cancel-btn" style="
                    padding: 12px 30px;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">
                    Cancel
                </button>
            </div>
        `;
        
        document.body.appendChild(confirmDialog);
        
        // Confirm button handler
        const confirmBtn = document.getElementById('reset-confirm-btn');
        confirmBtn.addEventListener('click', () => {
            this.resetAllProgress();
            confirmDialog.style.animation = 'popupFadeOut 0.3s ease-out';
            setTimeout(() => confirmDialog.remove(), 300);
        });
        
        // Cancel button handler
        const cancelBtn = document.getElementById('reset-cancel-btn');
        cancelBtn.addEventListener('click', () => {
            confirmDialog.style.animation = 'popupFadeOut 0.3s ease-out';
            setTimeout(() => confirmDialog.remove(), 300);
        });
        
        // Close when clicking outside
        confirmDialog.addEventListener('click', (e) => {
            if (e.target === confirmDialog) {
                confirmDialog.style.animation = 'popupFadeOut 0.3s ease-out';
                setTimeout(() => confirmDialog.remove(), 300);
            }
        });
    }
    
    resetAllProgress() {
        const preservedName = this.player?.name && this.player.name.trim() !== '' ? this.player.name : 'Guest';
        const preservedFriendCode = this.player?.friendCode || null;
        const preservedUserId = this.player?.userId || null;

        // Clear all localStorage data
        localStorage.removeItem('kittyCreekPlayer');
        localStorage.removeItem('kittyCreekPlayer_backup');
        localStorage.removeItem('kittyCreekInventory');
        localStorage.removeItem('kittyCreekInventory_backup');
        localStorage.removeItem('kittyCreekLeaderboard');
        localStorage.removeItem('kittyCreekLeaderboard_backup');
        localStorage.removeItem('kittyCreekCollection');
        localStorage.removeItem('kittyCreekCollection_backup');
        
        // Reset all game systems to initial state
        if (this.player) {
            // Reset player to defaults
            this.player.name = preservedName;
            this.player.level = 1;
            this.player.experience = 0;
            this.player.money = 100;
            this.player.totalCaught = 0;
            this.player.totalWeight = 0;
            this.player.biggestCatch = 0;
            this.player.locationUnlocks = [0, 1];
            this.player.tackleUnlocks = {
                rods: [0],
                reels: [0],
                lines: [0],
                hooks: [0],
                baits: [0]
            };
            this.player.tackleNotified = {
                rods: [],
                reels: [],
                lines: [],
                hooks: [],
                baits: []
            };
            this.player.gear = {
                rod: 'Basic Rod',
                reel: 'Basic Reel',
                line: 'Monofilament',
                hook: 'Basic Hook',
                bait: 'Basic Bait'
            };
            this.player.stats = {
                accuracy: 50,
                luck: 50,
                patience: 50,
                strength: 50
            };
            this.player.achievements = {};
            this.player.recentCatches = [];
            this.player.top10BiggestFish = [];
            this.player.caughtFish = {};
            this.player.caughtFishCollection = {};
            this.player.seasonalCatches = {
                spring: { caught: 0, biggest: 0 },
                summer: { caught: 0, biggest: 0 },
                fall: { caught: 0, biggest: 0 },
                winter: { caught: 0, biggest: 0 }
            };
            if (preservedFriendCode) {
                this.player.friendCode = preservedFriendCode;
            }
            if (preservedUserId) {
                this.player.userId = preservedUserId;
            }
            if (typeof this.player.normalizeTackleState === 'function') {
                this.player.normalizeTackleState();
            }
            this.player.save();
        }
        
        if (this.inventory) {
            // Reset inventory
            this.inventory.recentCatches = [];
            this.inventory.top10BiggestFish = [];
            this.inventory.caughtFish = {};
            this.inventory.save();
        }
        
        if (this.leaderboard) {
            // Reset leaderboard
            this.leaderboard.leaderboards = {};
            this.leaderboard.global = [];
            this.leaderboard.save();
        }
        
        if (this.fishCollection) {
            // Reset fish collection
            this.fishCollection.caughtFishCollection = {};
            this.fishCollection.save();
        }
        
        // Reset location to first location
        if (this.game?.locations) {
            this.game.locations.setCurrentLocation(0);
            this.game.changeLocation(0);
        }
        
        // Update UI elements
        this.updatePlayerInfo();
        this.updateLocationSelector();
        if (this.currentShopTab) {
            this.renderShop(this.currentShopTab);
        }
        this.renderInventory('collection'); // Reset to collection tab
        
        // Show success message
        this.showBannerNotification('Progress reset! Starting fresh...', '#4ade80', 3000);
        
        console.log('[UI] All progress reset - game restarted');
    }

    getAchievementContext() {
        const totalLocations = this.game?.locations?.locations?.length || 0;
        const totalFish = 33; // Total number of fish types in the game
        return {
            totalLocations,
            totalFish
        };
    }

    renderAchievementsTab(container) {
        if (!this.player) {
            container.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5); padding: 40px;">Player data not available.</p>';
            return;
        }

        // Check for achievements before displaying (in case conditions were met)
        this.evaluateAchievements('view');

        const context = this.getAchievementContext();
        const statuses = getAchievementStatuses(this.player, context);

        if (!statuses || statuses.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5); padding: 40px;">No achievements defined yet.</p>';
            return;
        }

        const unlockedCount = statuses.filter(status => status.currentTier > 0).length;
        const totalCount = statuses.length;
        const completedCount = statuses.filter(status => status.isComplete).length;

        const achievementsHtml = statuses.map(status => {
            const { name, description, currentTier, maxTier, currentValue, nextTarget, progressPercent, nextReward, isComplete, prefix, unit, allTiers } = status;
            const classes = `achievement-item ${currentTier > 0 ? 'unlocked' : 'locked'}`;

            // Format value for display
            const formatValue = (value) => {
                if (prefix) return `${prefix}${Math.floor(value)}`;
                if (unit === 'lbs') return `${value.toFixed(1)} ${unit}`;
                return Math.floor(value);
            };

            // Show tier indicator if multi-tier
            const tierIndicator = maxTier > 1 ? `<span style="font-size: 11px; color: rgba(255,255,255,0.6); margin-left: 8px;">Tier ${currentTier}/${maxTier}</span>` : '';

            let progressMarkup = '';
            if (!isComplete && nextTarget > 0) {
                const progressLabel = `${formatValue(currentValue)} / ${formatValue(nextTarget)}`;
                progressMarkup = `
                    <div class="achievement-progress">
                        <div class="achievement-progress-bar" style="width: ${progressPercent}%;"></div>
                    </div>
                    <div class="achievement-progress-label">
                        <span>${progressLabel}</span>
                        <span>${Math.round(progressPercent)}%</span>
                    </div>
                `;
            } else if (isComplete) {
                progressMarkup = `
                    <div class="achievement-progress">
                        <div class="achievement-progress-bar" style="width: 100%; background: #4ade80;"></div>
                    </div>
                    <div class="achievement-progress-label" style="color: #4ade80;">
                        <span>Complete! ${formatValue(currentValue)} ${unit}</span>
                        <span>100%</span>
                    </div>
                `;
            }

            // Show next tier reward
            let rewardMarkup = '';
            if (nextReward && !isComplete) {
                const rewardParts = [];
                if (nextReward.experience) rewardParts.push(`+${nextReward.experience} XP`);
                if (nextReward.money) rewardParts.push(`+$${nextReward.money}`);
                if (rewardParts.length > 0) {
                    rewardMarkup = `<div class="achievement-reward" style="font-size: 11px; color: rgba(74, 222, 128, 0.8); margin-top: 5px; font-weight: 500;">
                        Next Tier Reward: ${rewardParts.join(', ')}
                    </div>`;
                }
            }

            // Show tier progress (collapsible)
            let tierListMarkup = '';
            if (maxTier > 1 && allTiers.length > 0) {
                const tierList = allTiers.map(t => {
                    const tierStatus = t.unlocked ? '✓' : '○';
                    const tierColor = t.unlocked ? '#4ade80' : 'rgba(255,255,255,0.4)';
                    const tierReward = t.reward ? ` (+${t.reward.experience} XP, +$${t.reward.money})` : '';
                    return `<div style="font-size: 10px; color: ${tierColor}; margin: 2px 0; padding-left: 15px;">
                        ${tierStatus} Tier ${t.tier}: ${formatValue(t.target)} ${unit}${tierReward}
                    </div>`;
                }).join('');
                
                tierListMarkup = `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); max-height: 150px; overflow-y: auto;">
                    <div style="font-size: 10px; color: rgba(255,255,255,0.5); margin-bottom: 4px;">Tier Progress:</div>
                    ${tierList}
                </div>`;
            }

            return `
                <div class="${classes}">
                    <div class="achievement-name">${name}${tierIndicator}</div>
                    <div class="achievement-desc">${description}</div>
                    ${progressMarkup}
                    ${rewardMarkup}
                    ${tierListMarkup}
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div style="margin-bottom: 16px; font-size: 13px; color: rgba(255,255,255,0.7); text-align: center;">
                Achievements started: <strong>${unlockedCount}</strong> / ${totalCount} • Completed: <strong>${completedCount}</strong> / ${totalCount}
            </div>
            <div class="achievements-list">
                ${achievementsHtml}
            </div>
        `;
    }

    evaluateAchievements(trigger = 'generic') {
        if (!this.player) return;
        
        // Migrate old array-based achievements to object-based (tier tracking)
        if (Array.isArray(this.player.achievements)) {
            const oldAchievements = this.player.achievements;
            this.player.achievements = {};
            // Convert old achievements to tier 1
            oldAchievements.forEach(id => {
                this.player.achievements[id] = 1;
            });
        }
        
        if (typeof this.player.achievements !== 'object' || this.player.achievements === null) {
            this.player.achievements = {};
        }

        const context = this.getAchievementContext();
        const newlyUnlocked = evaluateAchievementDefs(this.player, context);
        if (!newlyUnlocked || newlyUnlocked.length === 0) {
            return;
        }

        let updated = false;
        let totalExpReward = 0;
        let totalMoneyReward = 0;
        
        newlyUnlocked.forEach(unlock => {
            const { achievementId, tier, reward, name, description, target, unit, prefix } = unlock;
            
            // Update achievement tier
            const currentTier = this.player.achievements[achievementId] || 0;
            if (tier > currentTier) {
                this.player.achievements[achievementId] = tier;
                updated = true;
                
                // Grant rewards
                if (reward) {
                    const expReward = reward.experience || 0;
                    const moneyReward = reward.money || 0;
                    
                    if (expReward > 0) {
                        totalExpReward += expReward;
                        this.player.addExperience(expReward, this.game?.locations, TackleShop);
                    }
                    
                    if (moneyReward > 0) {
                        totalMoneyReward += moneyReward;
                        this.player.addMoney(moneyReward);
                    }
                    
                    // Show notification with tier and rewards
                    const tierText = unlock.maxTier > 1 ? ` (Tier ${tier})` : '';
                    const rewardText = [];
                    if (expReward > 0) {
                        rewardText.push(`${expReward} XP`);
                    }
                    if (moneyReward > 0) {
                        rewardText.push(`$${moneyReward.toLocaleString()}`);
                    }

                    const descriptionLine = description ? description : '';
                    const rewardsLine = rewardText.length ? `Rewards: ${rewardText.join(' • ')}` : '';
                    const bodyLines = [descriptionLine, rewardsLine].filter(Boolean).join('\n');

                    this.showToast({
                        type: 'success',
                        title: `Achievement Unlocked${tierText}`,
                        body: bodyLines || name
                    });
                }
            }
        });

        if (updated) {
            this.player.save();
            if (this.currentInventoryTab === 'achievements') {
                const inventoryContent = document.getElementById('inventory-content');
                if (inventoryContent) {
                    this.renderAchievementsTab(inventoryContent);
                }
            }
        }

        if (totalExpReward > 0 || totalMoneyReward > 0) {
            const summaryParts = [];
            if (totalExpReward > 0) summaryParts.push(`+${totalExpReward} XP`);
            if (totalMoneyReward > 0) summaryParts.push(`+$${totalMoneyReward.toLocaleString()}`);

            this.showToast({
                type: 'success',
                title: 'Achievement rewards collected',
                body: summaryParts.join(' • ')
            });
        }
    }

    detectFriendNotifications(friendList = [], pending = { sent: [], received: [] }, activityList = [], wasLoaded = false) {
        if (!this.lastFriendSnapshot) {
            this.lastFriendSnapshot = { friends: new Map(), activities: new Set() };
        }

        const pendingCount = Array.isArray(pending?.received) ? pending.received.length : 0;
        const badge = document.querySelector('.friends-tab-badge');

        const previousActivitySet = this.lastFriendSnapshot.activities || new Set();
        const currentActivityIds = new Set();
        const newActivities = [];

        activityList.forEach(activity => {
            if (!activity || !activity.id) return;
            currentActivityIds.add(activity.id);
            if (wasLoaded && !previousActivitySet.has(activity.id)) {
                newActivities.push(activity);
            }
        });

        this.lastFriendSnapshot.activities = currentActivityIds;

        if (wasLoaded && newActivities.length > 0) {
            const maxToShow = 3;
            newActivities.slice(0, maxToShow).forEach(activity => {
                const angler = this.safeText(activity.username || 'A friend');
                const fishName = this.safeText(activity.fish_name || 'a fish');
                const weight = activity.fish_weight ? `${Number(activity.fish_weight).toFixed(2)} lbs` : null;
                const rarity = activity.fish_rarity && activity.fish_rarity !== 'Common' ? activity.fish_rarity : null;
                const location = activity.location_name ? this.safeText(activity.location_name) : null;

                const bodyLines = [];
                if (weight) bodyLines.push(`Weight: ${weight}`);
                if (rarity) bodyLines.push(`Rarity: ${rarity}`);
                if (location) bodyLines.push(`Location: ${location}`);

                this.showToast({
                    type: 'info',
                    title: `${angler} caught ${fishName}!`,
                    body: bodyLines.join('\n')
                });
            });

            if (newActivities.length > maxToShow) {
                this.showToast({
                    type: 'info',
                    title: 'More friend catches',
                    body: `+${newActivities.length - maxToShow} more friends hooked big fish!`
                });
            }
        }

        let badgeText = '';
        let showBadge = false;

        if (pendingCount > 0) {
            badgeText = pendingCount > 9 ? '9+' : `${pendingCount}`;
            showBadge = true;
        } else if (newActivities.length > 0) {
            badgeText = '•';
            showBadge = true;
        }

        if (badge) {
            if (showBadge) {
                badge.textContent = badgeText;
                badge.classList.remove('hidden');
                if (badgeText === '•') {
                    badge.classList.add('friends-tab-badge-dot');
                } else {
                    badge.classList.remove('friends-tab-badge-dot');
                }
            } else {
                badge.textContent = '';
                badge.classList.add('hidden');
                badge.classList.remove('friends-tab-badge-dot');
            }
        }

        const friendSnapshotMap = new Map();
        friendList.forEach(friend => {
            if (friend?.id) {
                friendSnapshotMap.set(friend.id, {
                    last_active: friend.last_active,
                    total_caught: friend.total_caught,
                    biggest_catch: friend.biggest_catch
                });
            }
        });
        this.lastFriendSnapshot.friends = friendSnapshotMap;

        this.friendData.notifications = {
            pending: pendingCount,
            newActivities: newActivities.map(a => a.id),
            lastUpdated: Date.now()
        };
    }

    getFriendStatus(friend) {
        const lastActive = friend?.last_active ? new Date(friend.last_active).getTime() : null;
        const now = Date.now();
        const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

        let statusClass = 'offline';
        let meta = '';

        if (lastActive) {
            const diff = now - lastActive;
            if (diff < ONLINE_THRESHOLD_MS) {
                statusClass = 'online';
                meta = 'Online now';
            } else {
                const minutes = Math.round(diff / 60000);
                if (minutes < 60) {
                    meta = `Last seen ${minutes} min${minutes === 1 ? '' : 's'} ago`;
                } else {
                    const hours = Math.round(minutes / 60);
                    if (hours < 24) {
                        meta = `Last seen ${hours} hr${hours === 1 ? '' : 's'} ago`;
                    } else {
                        const days = Math.round(hours / 24);
                        meta = `Last seen ${days} day${days === 1 ? '' : 's'} ago`;
                    }
                }
            }
        } else {
            meta = 'Last seen unknown';
        }

        return { statusClass, meta };
    }

    parsePlayerStats(rawStats) {
        if (!rawStats) return {};
        if (typeof rawStats === 'string') {
            try {
                return JSON.parse(rawStats);
            } catch (error) {
                console.warn('[UI] Failed to parse player stats JSON:', error);
                return {};
            }
        }
        if (typeof rawStats === 'object') {
            return { ...rawStats };
        }
        return {};
    }
 }
