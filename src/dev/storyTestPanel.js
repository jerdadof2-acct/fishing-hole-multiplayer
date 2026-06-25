import { CELESTIAL_DEPTHS_LOCATION_INDEX, HIDDEN_RELICS } from '../config/hiddenRelics.js';
import { collectHiddenRelic } from '../hiddenRelics.js';
import { getDevOceanBoatLocations, isDevMode } from './devMode.js';

function grantAllRelics(player) {
    if (!player) return;
    player.hiddenRelicsCollected = HIDDEN_RELICS.map((relic) => relic.id);
    player.starlightLureCrafted = true;
    player.syncStoryUnlocks();
    player.save({ skipSync: true });
}

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
    ui.showBannerNotification?.(`Preview: ${name}`, '#93c5fd', 2800);
}

/**
 * Local dev shortcuts (localhost, 127.0.0.1, ?dev=1, or ?storytest=1).
 * @param {import('../main.js').default} game
 */
export function initStoryTestPanel(game) {
    if (!isDevMode() || !game) return;

    const existing = document.getElementById('story-test-panel');
    if (existing) existing.remove();

    const oceanBoatLocations = getDevOceanBoatLocations(game.locations);
    const boatButtons = oceanBoatLocations.map((loc) => `
        <button type="button" data-location="${loc.index}" class="story-test-boat-btn">
            ${loc.name}
        </button>
    `).join('');

    const panel = document.createElement('div');
    panel.id = 'story-test-panel';
    panel.setAttribute('aria-label', 'Dev test shortcuts');
    panel.innerHTML = `
        <div class="story-test-panel-title">Dev (local)</div>
        <div class="story-test-panel-section">Large boat preview</div>
        <div class="story-test-boat-grid">${boatButtons}</div>
        <p class="story-test-panel-hint">Or use the location dropdown — ocean spots are unlocked on localhost.</p>
        <div class="story-test-panel-section">Story shortcuts</div>
        <button type="button" data-action="forge">Show forge popup</button>
        <button type="button" data-action="celestial">Go to Celestial Depths</button>
        <button type="button" data-action="reset-starfish">Reset Starfish (first catch)</button>
    `;

    document.body.appendChild(panel);

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
        if (!ui || !player) {
            console.warn('[DEV] Game not ready yet');
            return;
        }

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
        }
    });

    console.info('[DEV] Panel ready — ocean locations unlocked on localhost');
}
