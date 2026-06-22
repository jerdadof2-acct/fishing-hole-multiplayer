import { CELESTIAL_DEPTHS_LOCATION_INDEX, HIDDEN_RELICS } from '../config/hiddenRelics.js';
import { collectHiddenRelic } from '../hiddenRelics.js';

function isStoryTestMode() {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.has('dev') || params.has('storytest');
}

function grantAllRelics(player) {
    if (!player) return;
    player.hiddenRelicsCollected = HIDDEN_RELICS.map((relic) => relic.id);
    player.starlightLureCrafted = true;
    player.syncStoryUnlocks();
    player.save({ skipSync: true });
}

/**
 * Local-only story preview (?dev=1 or ?storytest=1 on the URL).
 * @param {import('../main.js').default} game
 */
export function initStoryTestPanel(game) {
    if (!isStoryTestMode() || !game) return;

    const existing = document.getElementById('story-test-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'story-test-panel';
    panel.setAttribute('aria-label', 'Story test shortcuts');
    panel.innerHTML = `
        <div class="story-test-panel-title">Story test (local)</div>
        <button type="button" data-action="forge">1 — Show forge popup</button>
        <button type="button" data-action="celestial">2 — Go to Celestial Depths</button>
        <button type="button" data-action="reset-starfish">Reset Starfish (first catch)</button>
        <p class="story-test-panel-hint">After step 2: cast and hook the Starfish.</p>
    `;

    document.body.appendChild(panel);

    panel.addEventListener('click', (event) => {
        const action = event.target.closest('[data-action]')?.dataset?.action;
        if (!action) return;

        const ui = game.ui;
        const player = game.player;
        if (!ui || !player) {
            console.warn('[STORY TEST] Game not ready yet');
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
            game.changeLocation(CELESTIAL_DEPTHS_LOCATION_INDEX);
            player.currentLocationIndex = CELESTIAL_DEPTHS_LOCATION_INDEX;
            player.save({ skipSync: true });
            ui.updateLocationSelector?.();
            ui.updatePlayerInfo?.();
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

    console.info('[STORY TEST] Panel ready — use ?dev=1 or ?storytest=1 in the URL');
}
