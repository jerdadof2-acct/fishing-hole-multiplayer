import { CELESTIAL_DEPTHS_LOCATION_INDEX, HIDDEN_RELICS } from '../config/hiddenRelics.js';
import { collectHiddenRelic } from '../hiddenRelics.js';

function jumpToLocation(game, locationIndex) {
    const ui = game.ui;
    const player = game.player;
    if (!ui || !player || !game.locations) return;

    const switched = game.changeLocation(locationIndex);
    if (!switched) return;

    player.currentLocationIndex = locationIndex;
    player.save({ skipSync: true });
    ui.updateLocationSelector?.();
    ui.updatePlayerInfo?.();

    const name = game.locations.getLocation(locationIndex)?.name || 'Location';
    ui.showBannerNotification?.(`Halley Command: ${name}`, '#fde68a', 2800);
}

function grantAllRelics(player) {
    if (!player) return;
    player.hiddenRelicsCollected = HIDDEN_RELICS.map((relic) => relic.id);
    player.starlightLureCrafted = true;
    player.syncStoryUnlocks();
    player.save({ skipSync: true });
}

function unlockAllLocations(player, locations) {
    if (!player || !locations?.locations) return;
    let added = false;
    locations.locations.forEach((_, index) => {
        if (!player.locationUnlocks.includes(index)) {
            player.locationUnlocks.push(index);
            added = true;
        }
    });
    if (added) {
        player.save({ skipSync: true });
    }
}

/**
 * In-game director panel for the Halley admin account (production-safe).
 * @param {import('../main.js').default} game
 */
export function initHalleyCommandPanel(game) {
    if (!game?.player?.isAdmin) return;

    const existing = document.getElementById('halley-command-panel');
    if (existing) existing.remove();

    const existingToggle = document.getElementById('halley-command-toggle');
    if (existingToggle) existingToggle.remove();

    const locations = game.locations?.locations ?? [];
    const locationButtons = locations.map((loc, index) => `
        <button type="button" data-location="${index}" class="command-panel-loc-btn">
            ${loc.name}
        </button>
    `).join('');

    const panel = document.createElement('div');
    panel.id = 'halley-command-panel';
    panel.className = 'halley-command-panel';
    panel.setAttribute('aria-label', 'Halley command panel');
    panel.innerHTML = `
        <div class="command-panel-title">☄ Halley Command</div>
        <div class="command-panel-section">Travel anywhere</div>
        <div class="command-panel-grid">${locationButtons}</div>
        <div class="command-panel-section">Story shortcuts</div>
        <button type="button" data-action="forge">Show forge popup</button>
        <button type="button" data-action="celestial">Go to Celestial Depths</button>
        <button type="button" data-action="reset-starfish">Reset Starfish reunion</button>
        <button type="button" data-action="grant-relics">Grant all sea relics</button>
        <div class="command-panel-section">Quick boosts</div>
        <button type="button" data-action="money">+$10,000</button>
        <button type="button" data-action="level">+5 levels</button>
        <button type="button" data-action="unlock-all">Unlock every location</button>
        <p class="command-panel-hint">Free travel · all spots in the location menu · Ctrl+Shift+H to hide</p>
    `;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'halley-command-toggle';
    toggle.className = 'halley-command-toggle';
    toggle.setAttribute('aria-label', 'Toggle Halley command panel');
    toggle.textContent = '☄';
    toggle.title = 'Halley Command (Ctrl+Shift+H)';

    document.body.appendChild(panel);
    document.body.appendChild(toggle);

    const setPanelVisible = (visible) => {
        panel.classList.toggle('hidden', !visible);
        toggle.classList.toggle('active', visible);
    };

    let panelVisible = true;
    setPanelVisible(panelVisible);

    toggle.addEventListener('click', () => {
        panelVisible = !panelVisible;
        setPanelVisible(panelVisible);
    });

    const onKeyDown = (event) => {
        if (!event.ctrlKey || !event.shiftKey || event.key.toLowerCase() !== 'h') {
            return;
        }
        event.preventDefault();
        panelVisible = !panelVisible;
        setPanelVisible(panelVisible);
    };

    window.addEventListener('keydown', onKeyDown);

    panel.addEventListener('click', (event) => {
        const locationIndex = event.target.closest('[data-location]')?.dataset?.location;
        if (locationIndex !== undefined) {
            jumpToLocation(game, Number(locationIndex));
            return;
        }

        const action = event.target.closest('[data-action]')?.dataset?.action;
        if (!action) return;

        const ui = game.ui;
        const player = game.player;
        if (!ui || !player) return;

        if (action === 'forge') {
            const lastRelic = HIDDEN_RELICS[HIDDEN_RELICS.length - 1];
            player.hiddenRelicsCollected = HIDDEN_RELICS.slice(0, -1).map((r) => r.id);
            player.starlightLureCrafted = false;
            player.syncStoryUnlocks();
            const forged = collectHiddenRelic(player, lastRelic.id);
            ui.showRelicPopup(lastRelic, forged);
            ui.updateLocationSelector?.();
            return;
        }

        if (action === 'celestial') {
            grantAllRelics(player);
            jumpToLocation(game, CELESTIAL_DEPTHS_LOCATION_INDEX);
            ui.showBannerNotification?.('Celestial Depths — cast to meet the Starfish.', '#fde68a', 4000);
            return;
        }

        if (action === 'reset-starfish') {
            if (game.fishCollection?.caughtFishCollection) {
                delete game.fishCollection.caughtFishCollection[33];
                game.fishCollection.save?.({ skipSync: true });
            }
            ui.showBannerNotification?.('Starfish reset — next catch uses the full reunion.', '#a5f3fc', 3500);
            return;
        }

        if (action === 'grant-relics') {
            grantAllRelics(player);
            ui.updateLocationSelector?.();
            ui.showBannerNotification?.('All sea relics granted.', '#fde68a', 3000);
            return;
        }

        if (action === 'money') {
            player.money = (player.money || 0) + 10000;
            player.save();
            ui.updatePlayerInfo?.();
            ui.showBannerNotification?.('+$10,000', '#4ade80', 2500);
            return;
        }

        if (action === 'level') {
            player.level = (player.level || 1) + 5;
            player.save();
            ui.updatePlayerInfo?.();
            ui.showBannerNotification?.('+5 levels', '#4ade80', 2500);
            return;
        }

        if (action === 'unlock-all') {
            unlockAllLocations(player, game.locations);
            ui.updateLocationSelector?.();
            ui.showBannerNotification?.('Every location unlocked.', '#93c5fd', 2800);
        }
    });

    unlockAllLocations(game.player, game.locations);
    game.ui?.updateLocationSelector?.();

    console.info('[ADMIN] Halley command panel ready');
}
