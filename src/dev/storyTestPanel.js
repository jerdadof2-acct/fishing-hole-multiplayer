import { CELESTIAL_DEPTHS_LOCATION_INDEX, HIDDEN_RELICS } from '../config/hiddenRelics.js';
import { CORTEZ_BACKWATERS_LOCATION_INDEX } from '../config/cortezBackwaters.js';
import { STARFISH_ID } from '../config/starfishEncounter.js';
import { collectHiddenRelic } from '../hiddenRelics.js';
import { AMAZON_DEPTHS_NAME } from '../locations.js';
import { getDevOceanBoatLocations, isDevMode } from './devMode.js';
import {
    isDevFaceCameraEnabled,
    setDevFaceCameraEnabled
} from './devFaceCamera.js';
import { DEV_GEM_OFFSET_STORAGE_KEY } from './devGemOffset.js';

function getAmazonLocationIndex(locations) {
    const list = locations?.locations ?? [];
    return list.findIndex((loc) => loc.name === AMAZON_DEPTHS_NAME);
}

function grantStarfishCaught(player, fishCollection) {
    const entry = { caught: true, firstCatchDate: Date.now(), count: 1 };
    player.caughtFishCollection[STARFISH_ID] = entry;
    if (fishCollection?.caughtFishCollection) {
        fishCollection.caughtFishCollection[STARFISH_ID] = entry;
        fishCollection.save?.({ skipSync: true });
    }
    player.syncStoryUnlocks();
    player.save({ skipSync: true });
}
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
        <label class="story-test-facecam">
            <input type="checkbox" id="dev-face-camera"${isDevFaceCameraEnabled() ? ' checked' : ''}>
            Face camera (gem dial-in)
        </label>
        <button type="button" data-action="reset-gem-offset">Reset gem to default</button>
        <button type="button" data-action="copy-gem-offset">Copy gem offset</button>
        <p class="story-test-panel-hint">Drag Halley’s body to <strong>rotate</strong>. Drag the <strong>blue gem</strong> to position it (scroll = depth). Use Crescent Pond or dock — not a rocking boat.</p>
        <div class="story-test-panel-section">Large boat preview</div>
        <div class="story-test-boat-grid">${boatButtons}</div>
        <p class="story-test-panel-hint">Or use the location dropdown — ocean spots are unlocked on localhost.</p>
        <div class="story-test-panel-section">Story shortcuts</div>
        <button type="button" data-action="forge">Show forge popup</button>
        <button type="button" data-action="celestial">Go to Celestial Depths</button>
        <button type="button" data-action="cortez">Go to Cortez Backwaters</button>
        <button type="button" data-action="reset-starfish">Reset Starfish (first catch)</button>
        <div class="story-test-panel-section">Amazon Depths</div>
        <button type="button" data-action="spawn-anaconda">Spawn anaconda shadow</button>
    `;

    document.body.appendChild(panel);

    const faceCamCheckbox = panel.querySelector('#dev-face-camera');
    faceCamCheckbox?.addEventListener('change', () => {
        const enabled = faceCamCheckbox.checked === true;
        setDevFaceCameraEnabled(enabled);
        if (enabled) {
            game._devFaceCameraActive = false;
            game.syncDevFaceCamera?.();
        } else {
            game.clearDevFaceCamera?.();
        }
    });

    import('./devCatDrag.js').then(({ setupDevCatDrag }) => {
        setupDevCatDrag(game);
    });

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

        if (action === 'cortez') {
            grantStarfishCaught(player, game.fishCollection);
            jumpToLocation(game, CORTEZ_BACKWATERS_LOCATION_INDEX);
            ui.showBannerNotification?.('Cortez Backwaters — fish the old Gulf flats from the dock.', '#86efac', 4200);
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

        if (action === 'reset-gem-offset') {
            game.cat?.resetMedallionGemToDefault?.();
            ui.showBannerNotification?.('Gem reset to default clasp offset.', '#93c5fd', 2800);
            return;
        }

        if (action === 'copy-gem-offset') {
            const gem = game.cat?._medallionFx?.gem;
            if (!gem) {
                ui.showBannerNotification?.('No gem found on Halley.', '#fca5a5', 2800);
                return;
            }
            const p = gem.position;
            const snippet = `new THREE.Vector3(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`;
            console.info(`[DEV] MEDALLION_GEM_OFFSET ${snippet}`);
            const copyText = `[${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}]`;
            navigator.clipboard?.writeText?.(copyText)?.catch(() => {});
            ui.showBannerNotification?.(`Gem offset: ${copyText}`, '#93c5fd', 5000);
            return;
        }

        if (action === 'spawn-anaconda') {
            const amazonIndex = getAmazonLocationIndex(game.locations);
            const atAmazon = game.locations?.getCurrentLocation()?.name === AMAZON_DEPTHS_NAME;
            if (!atAmazon && amazonIndex >= 0) {
                jumpToLocation(game, amazonIndex);
            }
            game.water?.setAmazonAnacondaEnabled(true);
            const spawned = game.water?.forceSpawnAmazonAnaconda?.({ closer: true });
            if (spawned) {
                ui.showBannerNotification?.('Anaconda shadow spawned — watch the river.', '#86efac', 3200);
            } else {
                ui.showBannerNotification?.('Could not spawn anaconda — water not ready.', '#fca5a5', 3200);
            }
        }
    });

    console.info('[DEV] Panel ready — ocean locations unlocked on localhost');
    try {
        const stored = localStorage.getItem(DEV_GEM_OFFSET_STORAGE_KEY);
        if (stored) {
            console.info('[DEV] Saved gem offset in localStorage:', stored);
        }
    } catch {
        /* ignore */
    }
}
