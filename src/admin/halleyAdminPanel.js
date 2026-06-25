const PANEL_STORAGE_KEY = 'halleyAdminPanelOpen';

function readPanelOpenPreference() {
    try {
        return localStorage.getItem(PANEL_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

function writePanelOpenPreference(open) {
    try {
        localStorage.setItem(PANEL_STORAGE_KEY, open ? '1' : '0');
    } catch {
        /* ignore */
    }
}

function formatRelativeTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const diff = Date.now() - date.getTime();
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
}

/**
 * Live-ops panel for Halley — reach other players, not personal cheats.
 * @param {import('../main.js').default} game
 */
export function initHalleyAdminPanel(game) {
    if (!game?.player?.isAdmin || !game?.api) return;

    const existing = document.getElementById('halley-admin-panel');
    if (existing) existing.remove();

    const existingToggle = document.getElementById('halley-admin-toggle');
    if (existingToggle) existingToggle.remove();

    const panel = document.createElement('div');
    panel.id = 'halley-admin-panel';
    panel.className = 'halley-admin-panel hidden';
    panel.setAttribute('aria-label', 'Halley live ops panel');
    panel.innerHTML = `
        <div class="command-panel-header">
            <div class="command-panel-title">☄ Halley Live Ops</div>
            <button type="button" class="command-panel-close" data-action="close" aria-label="Close">✕</button>
        </div>
        <p class="command-panel-intro">Send messages to everyone playing. They appear as toasts or banners on their screen.</p>
        <div class="halley-admin-stat-row">
            <span data-role="online-count">Checking who's online…</span>
            <button type="button" data-action="refresh-online" class="halley-admin-mini-btn">Refresh</button>
        </div>
        <div class="command-panel-section">Broadcast</div>
        <label class="halley-admin-label">Title</label>
        <input type="text" class="halley-admin-input" data-role="title" maxlength="80" placeholder="Halley says…" />
        <label class="halley-admin-label">Message</label>
        <textarea class="halley-admin-textarea" data-role="body" maxlength="280" rows="3" placeholder="Join me at Amazon Depths tonight!"></textarea>
        <div class="halley-admin-row">
            <label class="halley-admin-label">Style</label>
            <select class="command-panel-select" data-role="display-type">
                <option value="toast">Toast (corner)</option>
                <option value="banner">Banner (center)</option>
            </select>
        </div>
        <div class="halley-admin-row" data-role="toast-type-row">
            <label class="halley-admin-label">Toast color</label>
            <select class="command-panel-select" data-role="toast-type">
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="error">Alert</option>
            </select>
        </div>
        <button type="button" data-action="send" class="halley-admin-send-btn">Send to all players</button>
        <div class="command-panel-section">Quick sends</div>
        <button type="button" data-action="preset-live">🎣 Halley is fishing live!</button>
        <button type="button" data-action="preset-event">🏆 Trophy hour — legendary fish are biting!</button>
        <button type="button" data-action="preset-thanks">💛 Thanks for fishing with me today!</button>
        <div class="command-panel-section">Player management</div>
        <label class="halley-admin-label">Username or friend code</label>
        <div class="halley-admin-travel-row">
            <input type="text" class="halley-admin-input" data-role="lookup-query" maxlength="40" placeholder="e.g. TestAngler or ABC123" />
            <button type="button" data-action="lookup-player" class="halley-admin-mini-btn">Look up</button>
        </div>
        <div class="halley-admin-player-card hidden" data-role="player-card"></div>
        <div class="command-panel-section">Recent</div>
        <div class="halley-admin-recent" data-role="recent-list">Loading…</div>
        <p class="command-panel-hint">Tap ☄ top-left to hide · Ctrl+Shift+H</p>
    `;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'halley-admin-toggle';
    toggle.className = 'halley-command-toggle';
    toggle.setAttribute('aria-label', 'Toggle Halley live ops panel');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = '☄';
    toggle.title = 'Halley Live Ops';

    document.body.appendChild(panel);
    document.body.appendChild(toggle);

    const titleInput = panel.querySelector('[data-role="title"]');
    const bodyInput = panel.querySelector('[data-role="body"]');
    const displayTypeSelect = panel.querySelector('[data-role="display-type"]');
    const toastTypeRow = panel.querySelector('[data-role="toast-type-row"]');
    const toastTypeSelect = panel.querySelector('[data-role="toast-type"]');
    const onlineCountEl = panel.querySelector('[data-role="online-count"]');
    const recentListEl = panel.querySelector('[data-role="recent-list"]');
    const lookupQueryInput = panel.querySelector('[data-role="lookup-query"]');
    const playerCardEl = panel.querySelector('[data-role="player-card"]');

    let lookedUpPlayer = null;
    let confirmModalEl = null;

    let panelVisible = readPanelOpenPreference();

    const setPanelVisible = (visible) => {
        panelVisible = visible;
        panel.classList.toggle('hidden', !visible);
        toggle.classList.toggle('active', visible);
        toggle.setAttribute('aria-expanded', visible ? 'true' : 'false');
        writePanelOpenPreference(visible);
        if (visible) {
            refreshOnlineCount();
            refreshRecent();
        }
    };

    setPanelVisible(panelVisible);

    const syncToastTypeVisibility = () => {
        const isToast = displayTypeSelect?.value === 'toast';
        toastTypeRow?.classList.toggle('hidden', !isToast);
    };

    displayTypeSelect?.addEventListener('change', syncToastTypeVisibility);
    syncToastTypeVisibility();

    toggle.addEventListener('click', () => setPanelVisible(!panelVisible));

    const onKeyDown = (event) => {
        if (!event.ctrlKey || !event.shiftKey || event.key.toLowerCase() !== 'h') {
            return;
        }
        event.preventDefault();
        setPanelVisible(!panelVisible);
    };
    window.addEventListener('keydown', onKeyDown);

    async function refreshOnlineCount() {
        if (!onlineCountEl) return;
        try {
            const result = await game.api.getAdminOnlineCount(5);
            const count = result?.onlineCount ?? 0;
            onlineCountEl.textContent = `${count} player${count === 1 ? '' : 's'} online (last 5 min)`;
        } catch {
            onlineCountEl.textContent = 'Could not load online count';
        }
    }

    async function refreshRecent() {
        if (!recentListEl) return;
        try {
            const rows = await game.api.getRecentAdminAnnouncements(6);
            if (!Array.isArray(rows) || rows.length === 0) {
                recentListEl.innerHTML = '<p class="halley-admin-recent-empty">No broadcasts yet.</p>';
                return;
            }
            recentListEl.innerHTML = rows.map((row) => `
                <div class="halley-admin-recent-item">
                    <strong>${escapeHtml(row.title || 'Untitled')}</strong>
                    <span>${escapeHtml(row.displayType || 'toast')} · ${formatRelativeTime(row.createdAt)}</span>
                    ${row.body ? `<p>${escapeHtml(row.body)}</p>` : ''}
                </div>
            `).join('');
        } catch {
            recentListEl.textContent = 'Could not load recent broadcasts.';
        }
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function clearPlayerCard() {
        lookedUpPlayer = null;
        if (!playerCardEl) return;
        playerCardEl.classList.add('hidden');
        playerCardEl.innerHTML = '';
    }

    function renderPlayerCard(player) {
        if (!playerCardEl || !player) return;

        lookedUpPlayer = player;
        const blocked = player.isAdmin || player.isSelf;
        const blockReason = player.isSelf
            ? 'This is your Halley account.'
            : (player.isAdmin ? 'The Halley admin account cannot be deleted.' : '');

        playerCardEl.classList.remove('hidden');
        playerCardEl.innerHTML = `
            <div class="halley-admin-player-name">${escapeHtml(player.username)}</div>
            <div class="halley-admin-player-meta">
                Code ${escapeHtml(player.friendCode || '------')}
                · Level ${player.level ?? '?'}
                · ${player.totalCaught ?? 0} caught
            </div>
            ${player.biggestCatch != null ? `<div class="halley-admin-player-meta">Biggest: ${Number(player.biggestCatch).toFixed(2)} lbs</div>` : ''}
            ${blocked
                ? `<p class="halley-admin-player-blocked">${blockReason}</p>`
                : `<button type="button" data-action="delete-player" class="halley-admin-danger-btn">Delete account…</button>`
            }
        `;
    }

    function closeConfirmModal() {
        if (confirmModalEl) {
            confirmModalEl.remove();
            confirmModalEl = null;
        }
    }

    function openDeleteConfirmModal(player) {
        closeConfirmModal();
        if (!player || player.isAdmin || player.isSelf) return;

        confirmModalEl = document.createElement('div');
        confirmModalEl.className = 'halley-admin-confirm-modal';
        confirmModalEl.innerHTML = `
            <div class="halley-admin-confirm-backdrop" data-action="cancel-delete"></div>
            <div class="halley-admin-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="halley-delete-title">
                <h4 id="halley-delete-title">Delete ${escapeHtml(player.username)}?</h4>
                <p>This permanently removes their save, friends, catches, and leaderboard entry. This cannot be undone.</p>
                <label class="halley-admin-label" for="halley-delete-confirm-input">Type <strong>${escapeHtml(player.username)}</strong> to confirm</label>
                <input id="halley-delete-confirm-input" type="text" class="halley-admin-input" data-role="confirm-username" autocomplete="off" />
                <div class="halley-admin-confirm-actions">
                    <button type="button" data-action="cancel-delete" class="halley-admin-mini-btn">Cancel</button>
                    <button type="button" data-action="confirm-delete" class="halley-admin-danger-btn" disabled>Delete permanently</button>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModalEl);

        const confirmInput = confirmModalEl.querySelector('[data-role="confirm-username"]');
        const confirmBtn = confirmModalEl.querySelector('[data-action="confirm-delete"]');

        const syncConfirmButton = () => {
            const matches = confirmInput?.value?.trim() === player.username;
            if (confirmBtn) confirmBtn.disabled = !matches;
        };

        confirmInput?.addEventListener('input', syncConfirmButton);
        confirmInput?.focus();

        confirmModalEl.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]')?.dataset?.action;
            if (action === 'cancel-delete') {
                closeConfirmModal();
                return;
            }

            if (action === 'confirm-delete') {
                if (confirmBtn?.disabled) return;
                confirmBtn.disabled = true;
                try {
                    await game.api.deleteAdminPlayer(player.id, player.username);
                    game.ui?.showToast?.({
                        type: 'success',
                        title: 'Player deleted',
                        body: `${player.username} was removed from the game.`
                    });
                    closeConfirmModal();
                    clearPlayerCard();
                    if (lookupQueryInput) lookupQueryInput.value = '';
                    await refreshOnlineCount();
                } catch (error) {
                    game.ui?.showToast?.({
                        type: 'error',
                        title: 'Delete failed',
                        body: error?.message || 'Could not delete player.'
                    });
                    confirmBtn.disabled = false;
                }
            }
        });
    }

    async function lookupPlayer() {
        const query = lookupQueryInput?.value?.trim();
        if (!query) {
            game.ui?.showToast?.({ type: 'error', title: 'Look up failed', body: 'Enter a username or friend code.' });
            return;
        }

        clearPlayerCard();
        try {
            const player = await game.api.lookupAdminPlayer(query);
            renderPlayerCard(player);
        } catch (error) {
            game.ui?.showToast?.({
                type: 'error',
                title: 'Player not found',
                body: error?.message || 'No match for that username or code.'
            });
        }
    }

    async function sendBroadcast({ title, body, displayType, toastType }) {
        const ui = game.ui;
        try {
            await game.api.sendAdminAnnouncement({
                title,
                body,
                displayType: displayType || 'toast',
                toastType: toastType || 'info',
                expiresInMinutes: 24 * 60
            });
            ui?.showToast?.({
                type: 'success',
                title: 'Broadcast sent',
                body: 'Every player will see it on their next sync.'
            });
            if (titleInput) titleInput.value = '';
            if (bodyInput) bodyInput.value = '';
            await refreshRecent();
        } catch (error) {
            ui?.showToast?.({
                type: 'error',
                title: 'Broadcast failed',
                body: error?.message || 'Could not send message.'
            });
        }
    }

    panel.addEventListener('click', async (event) => {
        const action = event.target.closest('[data-action]')?.dataset?.action;
        if (!action) return;

        if (action === 'close') {
            setPanelVisible(false);
            return;
        }

        if (action === 'refresh-online') {
            await refreshOnlineCount();
            return;
        }

        if (action === 'preset-live') {
            await sendBroadcast({
                title: '☄ Halley is fishing live!',
                body: 'Cast a line and see what the creek brings tonight.',
                displayType: 'banner',
                toastType: 'info'
            });
            return;
        }

        if (action === 'preset-event') {
            await sendBroadcast({
                title: '🏆 Trophy hour!',
                body: 'Legendary fish are extra active — Halley is watching the leaderboard.',
                displayType: 'toast',
                toastType: 'success'
            });
            return;
        }

        if (action === 'preset-thanks') {
            await sendBroadcast({
                title: '💛 From Halley',
                body: 'Thanks for fishing with me today. More adventures soon!',
                displayType: 'toast',
                toastType: 'info'
            });
            return;
        }

        if (action === 'send') {
            const title = titleInput?.value?.trim();
            const body = bodyInput?.value?.trim();
            if (!title) {
                game.ui?.showToast?.({ type: 'error', title: 'Title required', body: 'Add a short headline for players.' });
                return;
            }
            await sendBroadcast({
                title,
                body,
                displayType: displayTypeSelect?.value || 'toast',
                toastType: toastTypeSelect?.value || 'info'
            });
            return;
        }

        if (action === 'lookup-player') {
            await lookupPlayer();
            return;
        }

        if (action === 'delete-player') {
            if (lookedUpPlayer) {
                openDeleteConfirmModal(lookedUpPlayer);
            }
        }
    });

    lookupQueryInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            lookupPlayer();
        }
    });

    if (panelVisible) {
        refreshOnlineCount();
        refreshRecent();
    }

    console.info('[ADMIN] Halley live ops panel ready');
}
