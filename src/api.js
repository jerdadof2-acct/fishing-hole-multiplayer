/**
 * API Client for Halley's Big Catch Friends System
 * Handles all communication with the backend server
 */

export class API {
    constructor() {
        // Allow host page to configure base URL before bootstrap (e.g., window.__API_BASE_URL__)
        const globalBase =
            typeof window !== 'undefined' && window.__API_BASE_URL__
                ? window.__API_BASE_URL__
                : null;
        const metaBase =
            typeof document !== 'undefined'
                ? document.querySelector('meta[name="halleys-big-catch-api-base"]')?.content
                : null;

        this.baseURL = this.normalizeBaseURL(globalBase || metaBase || '/api');
        this.userId = null;
    }
    
    /**
     * Normalize API base URL (trim trailing slash)
     * @param {string} value
     * @returns {string}
     */
    normalizeBaseURL(value) {
        if (!value) return '/api';
        return value.endsWith('/') ? value.slice(0, -1) : value;
    }

    /**
     * Set custom base URL at runtime
     * @param {string} value
     */
    setBaseURL(value) {
        this.baseURL = this.normalizeBaseURL(value);
    }

    /**
     * Set the current user ID for authentication
     * @param {string} userId - User UUID
     */
    setUserId(userId) {
        this.userId = userId;
    }
    
    /**
     * Make an authenticated API request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} Response data
     */
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (this.userId) {
            headers['Authorization'] = `Bearer ${this.userId}`;
        }
        
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                ...options,
                headers
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                throw new Error(error.error || `API Error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`[API] Request failed: ${endpoint}`, error);
            throw error;
        }
    }
    
    // ==================== Player Methods ====================
    
    /**
     * Register a new player
     * @param {string} username - Player username
     * @param {string} pin - 4-6 digit save PIN
     * @returns {Promise<Object>} Player data with userId and friendCode
     */
    async registerPlayer(username, pin) {
        return this.request('/players/register', {
            method: 'POST',
            body: JSON.stringify({ username, pin })
        });
    }

    /**
     * Sign in with username + save PIN (new device / reinstall)
     * @param {string} username
     * @param {string} pin
     */
    async loginPlayer(username, pin) {
        return this.request('/players/login', {
            method: 'POST',
            body: JSON.stringify({ username, pin })
        });
    }

    /**
     * Claim an older account that never got a save PIN (username only).
     */
    async claimAccount(username) {
        return this.request('/players/claim', {
            method: 'POST',
            body: JSON.stringify({ username })
        });
    }

    /**
     * Recover an account that never got a save PIN (username + friend code).
     * Disabled once a save PIN is set on the account.
     */
    async recoverAccount(username, friendCode) {
        return this.request('/players/recover', {
            method: 'POST',
            body: JSON.stringify({ username, friendCode })
        });
    }

    async getGameSave() {
        return this.request('/players/me/save');
    }

    async updateGameSave(gameSave) {
        return this.request('/players/me/save', {
            method: 'PUT',
            body: JSON.stringify({ gameSave })
        });
    }

    async setSavePin(pin) {
        return this.request('/players/me/pin', {
            method: 'PUT',
            body: JSON.stringify({ pin })
        });
    }
    
    /**
     * Get current player data
     * @returns {Promise<Object>} Player data
     */
    async getPlayer() {
        return this.request('/players/me');
    }
    
    /**
     * Update player data (sync from game)
     * @param {Object} data - Player data to update
     * @returns {Promise<Object>} Updated player data
     */
    async updatePlayer(data) {
        return this.request('/players/me', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /** Keep last_active fresh so friends see you as online while playing. */
    async pingPresence() {
        return this.request('/players/me/presence', { method: 'POST' });
    }
    
    /**
     * Get player by friend code
     * @param {string} friendCode - Friend code
     * @returns {Promise<Object>} Player data
     */
    async getPlayerByFriendCode(friendCode) {
        return this.request(`/players/${friendCode}`);
    }
    
    /**
     * Get player's fish collection
     * @param {string} playerId - Player UUID
     * @returns {Promise<Object>} Collection data
     */
    async getPlayerCollection(playerId) {
        return this.request(`/players/${playerId}/collection`);
    }
    
    /**
     * Update player's fish collection
     * @param {Object} caughtFishCollection - Collection data
     * @returns {Promise<Object>} Success response
     */
    async updatePlayerCollection(caughtFishCollection) {
        return this.request('/players/me/collection', {
            method: 'PUT',
            body: JSON.stringify({ caughtFishCollection })
        });
    }
    
    // ==================== Friends Methods ====================
    
    /**
     * Send friend request by friend code
     * @param {string} friendCode - Friend's code
     * @returns {Promise<Object>} Success response
     */
    async sendFriendRequest(friendCode) {
        return this.request('/friends/request', {
            method: 'POST',
            body: JSON.stringify({ friendCode })
        });
    }
    
    /**
     * Get all friends
     * @returns {Promise<Array>} Array of friend objects
     */
    async getFriends(recentMinutes = null) {
        const query = Number.isFinite(Number(recentMinutes)) && Number(recentMinutes) > 0
            ? `?recentMinutes=${Math.round(Number(recentMinutes))}`
            : '';
        return this.request(`/friends${query}`);
    }
    
    /**
     * Get pending friend requests
     * @returns {Promise<Object>} { sent: [], received: [] }
     */
    async getPendingRequests() {
        return this.request('/friends/pending');
    }
    
    /**
     * Accept friend request
     * @param {string} requestId - Request UUID
     * @returns {Promise<Object>} Success response
     */
    async acceptFriendRequest(requestId) {
        return this.request(`/friends/accept/${requestId}`, {
            method: 'POST'
        });
    }
    
    /**
     * Decline friend request
     * @param {string} requestId - Request UUID
     * @returns {Promise<Object>} Success response
     */
    async declineFriendRequest(requestId) {
        return this.request(`/friends/decline/${requestId}`, {
            method: 'POST'
        });
    }
    
    /**
     * Remove friend
     * @param {string} friendId - Friend's user UUID
     * @returns {Promise<Object>} Success response
     */
    async removeFriend(friendId) {
        return this.request(`/friends/${friendId}`, {
            method: 'DELETE'
        });
    }

    async getFriendCollection(friendId) {
        return this.request(`/friends/${friendId}/collection`);
    }
    
    // ==================== Activity Methods ====================
    
    /**
     * Log a catch to activity feed
     * @param {Object} catchData - Catch information
     * @returns {Promise<Object>} Success response
     */
    async logCatch(catchData) {
        return this.request('/activities/catch', {
            method: 'POST',
            body: JSON.stringify(catchData)
        });
    }

    async logLevelUp(level, levelsGained = 1) {
        return this.request('/activities/level', {
            method: 'POST',
            body: JSON.stringify({ level, levelsGained })
        });
    }

    async logLeaderboardCatch(catchData) {
        return this.request('/leaderboard/catch', {
            method: 'POST',
            body: JSON.stringify(catchData)
        });
    }

    async getGlobalLeaderboard(limit = 20) {
        return this.request(`/leaderboard/global?limit=${limit}`);
    }

    async getSpeedLeaderboard(limit = 20) {
        return this.request(`/leaderboard/speed?limit=${limit}`);
    }

    async getPlayerCatches(limit = 50) {
        if (!this.userId) {
            throw new Error('User ID not set');
        }
        return this.request(`/players/${this.userId}/catches?limit=${limit}`);
    }

    /**
     * Get friends' recent activities
     * @param {number} limit - Maximum number of activities
     * @returns {Promise<Array>} Array of activity objects
     */
    async getFriendActivities(limit = 20) {
        return this.request(`/activities/friends?limit=${limit}`);
    }

    async getPendingAnnouncements() {
        return this.request('/announcements/pending');
    }

    async ackAnnouncement(announcementId) {
        return this.request(`/announcements/${announcementId}/ack`, { method: 'POST' });
    }

    async getAdminOnlineCount(minutes = 5) {
        return this.request(`/admin/online-count?minutes=${minutes}`);
    }

    async getAdminPlayerRegistry() {
        return this.request('/admin/players/registry');
    }

    async sendAdminAnnouncement(payload) {
        return this.request('/admin/announcements', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async getRecentAdminAnnouncements(limit = 10) {
        return this.request(`/admin/announcements/recent?limit=${limit}`);
    }

    async lookupAdminPlayer(query) {
        const encoded = encodeURIComponent(query);
        return this.request(`/admin/players/lookup?q=${encoded}`);
    }

    async deleteAdminPlayer(playerId, confirmUsername) {
        return this.request(`/admin/players/${playerId}`, {
            method: 'DELETE',
            body: JSON.stringify({ confirmUsername })
        });
    }
    
    // ==================== Utility Methods ====================
    
    /**
     * Health check
     * @returns {Promise<Object>} Health status
     */
    async healthCheck(timeoutMs = 10000) {
        try {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timer = controller
                ? setTimeout(() => controller.abort(), timeoutMs)
                : null;

            const headers = { 'Content-Type': 'application/json' };
            const response = await fetch(`${this.baseURL}/health`, {
                headers,
                signal: controller?.signal
            });

            if (timer) clearTimeout(timer);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            const message = error?.name === 'AbortError'
                ? 'Server timed out — starting offline mode'
                : error.message;
            return { status: 'error', message };
        }
    }
}

// Export singleton instance
export const api = new API();



