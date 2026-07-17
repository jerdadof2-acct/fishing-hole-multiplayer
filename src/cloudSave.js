/**
 * Cloud save capture/restore — full game state for cross-device play.
 */

const SAVE_VERSION = 1;
const META_KEY = 'kittyCreekGameSaveMeta';

function readJson(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeJson(key, data) {
    if (!data || typeof data !== 'object') {
        return;
    }
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
    localStorage.setItem(`${key}_backup`, serialized);
}

function readSavedAtMeta() {
    const meta = readJson(META_KEY);
    return typeof meta?.savedAt === 'number' ? meta.savedAt : 0;
}

function writeSavedAtMeta(savedAt) {
    if (typeof savedAt !== 'number') {
        return;
    }
    localStorage.setItem(META_KEY, JSON.stringify({ savedAt }));
}

/**
 * Progress richness — used so a Crescent-only tablet cannot beat a full phone save
 * just because captureLocalGameSave() stamped a newer savedAt.
 */
export function scoreGameSave(save) {
    const player = save?.player;
    if (!player || typeof player !== 'object') {
        return -1;
    }

    const relics = Array.isArray(player.hiddenRelicsCollected)
        ? player.hiddenRelicsCollected.length
        : 0;
    const unlocks = Array.isArray(player.locationUnlocks)
        ? player.locationUnlocks.length
        : 0;
    const chapters = Array.isArray(player.storyChaptersCompleted)
        ? player.storyChaptersCompleted.length
        : 0;
    const level = Number(player.level) || 0;
    const caught = Number(player.totalCaught) || 0;
    const money = Number(player.money) || 0;

    return (
        relics * 100000 +
        unlocks * 10000 +
        chapters * 1000 +
        level * 100 +
        caught * 10 +
        Math.min(money, 100000) / 1000
    );
}

export function captureLocalGameSave(options = {}) {
    const bumpTimestamp = options.bumpTimestamp !== false;
    const player = readJson('kittyCreekPlayer');
    if (!player) {
        return null;
    }

    const savedAt = bumpTimestamp ? Date.now() : readSavedAtMeta() || 0;
    if (bumpTimestamp) {
        writeSavedAtMeta(savedAt);
    }

    return {
        version: SAVE_VERSION,
        savedAt,
        player,
        inventory: readJson('kittyCreekInventory'),
        collection: readJson('kittyCreekCollection')
    };
}

export function applyGameSaveToLocal(gameSave) {
    if (!gameSave || typeof gameSave !== 'object') {
        return false;
    }

    if (gameSave.player) {
        writeJson('kittyCreekPlayer', gameSave.player);
    }
    if (gameSave.inventory) {
        writeJson('kittyCreekInventory', gameSave.inventory);
    }
    if (gameSave.collection) {
        writeJson('kittyCreekCollection', gameSave.collection);
    }

    if (typeof gameSave.savedAt === 'number') {
        writeSavedAtMeta(gameSave.savedAt);
    }

    return Boolean(gameSave.player);
}

/**
 * Choose which save should win for this account.
 * Story progress beats raw timestamps so thin device saves cannot wipe the cloud.
 */
export function getNewerGameSave(localSave, remoteSave) {
    if (!remoteSave?.player) {
        return localSave;
    }
    if (!localSave?.player) {
        return remoteSave;
    }

    const localUserId = localSave.player.userId || localSave.player.id || null;
    const remoteUserId = remoteSave.player.userId || remoteSave.player.id || null;

    // Prefer the account cloud save when local data belongs to a different
    // (or guest) profile — e.g. a fresh tablet with leftover guest play.
    if (remoteUserId && localUserId && remoteUserId !== localUserId) {
        return remoteSave;
    }
    if (remoteUserId && !localUserId) {
        return remoteSave;
    }

    const localScore = scoreGameSave(localSave);
    const remoteScore = scoreGameSave(remoteSave);
    if (remoteScore > localScore) {
        return remoteSave;
    }
    if (localScore > remoteScore) {
        return localSave;
    }

    const localTs = localSave.savedAt || 0;
    const remoteTs = remoteSave.savedAt || 0;
    return remoteTs >= localTs ? remoteSave : localSave;
}

/**
 * Union story fields when both saves belong to the same account so a device
 * cannot drop relics/unlocks that the other device already earned.
 */
export function mergeStoryProgressIntoSave(targetSave, sourceSave) {
    if (!targetSave?.player || !sourceSave?.player) {
        return targetSave;
    }

    const target = targetSave.player;
    const source = sourceSave.player;
    const unionArray = (a, b) => {
        const out = new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]);
        return [...out];
    };

    target.hiddenRelicsCollected = unionArray(
        target.hiddenRelicsCollected,
        source.hiddenRelicsCollected
    );
    target.locationUnlocks = unionArray(target.locationUnlocks, source.locationUnlocks).sort(
        (a, b) => a - b
    );
    target.storyChaptersCompleted = unionArray(
        target.storyChaptersCompleted,
        source.storyChaptersCompleted
    );

    if (source.relicLocationProgress && typeof source.relicLocationProgress === 'object') {
        target.relicLocationProgress = {
            ...(target.relicLocationProgress || {}),
            ...source.relicLocationProgress
        };
    }

    if (source.locationCastCounts && typeof source.locationCastCounts === 'object') {
        const merged = { ...(target.locationCastCounts || {}) };
        for (const [key, value] of Object.entries(source.locationCastCounts)) {
            const a = Number(merged[key]) || 0;
            const b = Number(value) || 0;
            merged[key] = Math.max(a, b);
        }
        target.locationCastCounts = merged;
    }

    target.elusiveLegendaryRevealed = unionArray(
        target.elusiveLegendaryRevealed,
        source.elusiveLegendaryRevealed
    );

    target.starlightLureCrafted =
        target.starlightLureCrafted === true || source.starlightLureCrafted === true;
    target.fatherJournalReceived =
        target.fatherJournalReceived === true || source.fatherJournalReceived === true;
    target.louisianaBayouComplete =
        target.louisianaBayouComplete === true || source.louisianaBayouComplete === true;
    target.congoRiverComplete =
        target.congoRiverComplete === true || source.congoRiverComplete === true;
    target.crazyCatchCoveComplete =
        target.crazyCatchCoveComplete === true || source.crazyCatchCoveComplete === true;

    return targetSave;
}
