/**
 * API Client for Kitty Creek Friends System
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
                ? document.querySelector('meta[name="kitty-creek-api-base"]')?.content
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
     * @returns {Promise<Object>} Player data with userId and friendCode
     */
    async registerPlayer(username) {
        return this.request('/players/register', {
            method: 'POST',
            body: JSON.stringify({ username })
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
    async getFriends() {
        return this.request('/friends');
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

    /**
     * Get friends' recent activities
     * @param {number} limit - Maximum number of activities
     * @returns {Promise<Array>} Array of activity objects
     */
    async getFriendActivities(limit = 20) {
        return this.request(`/activities/friends?limit=${limit}`);
    }
    
    // ==================== Utility Methods ====================
    
    /**
     * Health check
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        try {
            return await this.request('/health');
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }
}

// Export singleton instance
export const api = new API();



