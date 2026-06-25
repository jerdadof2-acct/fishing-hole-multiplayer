/**
 * Cloud save capture/restore — full game state for cross-device play.
 */

const SAVE_VERSION = 1;

export function captureLocalGameSave() {
    const read = (key) => {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    };

    const player = read('kittyCreekPlayer');
    if (!player) {
        return null;
    }

    return {
        version: SAVE_VERSION,
        savedAt: Date.now(),
        player,
        inventory: read('kittyCreekInventory'),
        collection: read('kittyCreekCollection')
    };
}

export function applyGameSaveToLocal(gameSave) {
    if (!gameSave || typeof gameSave !== 'object') {
        return false;
    }

    const write = (key, data) => {
        if (!data || typeof data !== 'object') {
            return;
        }
        const serialized = JSON.stringify(data);
        localStorage.setItem(key, serialized);
        localStorage.setItem(`${key}_backup`, serialized);
    };

    if (gameSave.player) {
        write('kittyCreekPlayer', gameSave.player);
    }
    if (gameSave.inventory) {
        write('kittyCreekInventory', gameSave.inventory);
    }
    if (gameSave.collection) {
        write('kittyCreekCollection', gameSave.collection);
    }

    return Boolean(gameSave.player);
}

export function getNewerGameSave(localSave, remoteSave) {
    if (!remoteSave?.player) {
        return localSave;
    }
    if (!localSave?.player) {
        return remoteSave;
    }
    const localTs = localSave.savedAt || 0;
    const remoteTs = remoteSave.savedAt || 0;
    return remoteTs >= localTs ? remoteSave : localSave;
}
