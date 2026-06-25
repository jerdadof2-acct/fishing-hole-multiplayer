const DISPLAY_TYPES = new Set(['toast', 'banner']);
const TOAST_TYPES = new Set(['info', 'success', 'error']);

export function normalizeAnnouncementInput(body = {}) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const message = typeof body.body === 'string'
        ? body.body.trim()
        : (typeof body.message === 'string' ? body.message.trim() : '');

    if (!title) {
        return { ok: false, error: 'Title is required' };
    }

    const displayType = DISPLAY_TYPES.has(body.displayType) ? body.displayType : 'toast';
    const toastType = TOAST_TYPES.has(body.toastType) ? body.toastType : 'info';
    const bannerColor = typeof body.bannerColor === 'string' && body.bannerColor.trim()
        ? body.bannerColor.trim()
        : '#fde68a';

    let durationMs = Number(body.durationMs ?? body.duration);
    if (!Number.isFinite(durationMs) || durationMs < 2000) {
        durationMs = displayType === 'banner' ? 8000 : 6000;
    }
    durationMs = Math.min(durationMs, 30000);

    let expiresAt = null;
    const expiresInMinutes = Number(body.expiresInMinutes ?? body.expiresIn);
    if (Number.isFinite(expiresInMinutes) && expiresInMinutes > 0) {
        expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    } else {
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    return {
        ok: true,
        value: {
            title,
            body: message,
            displayType,
            toastType,
            bannerColor,
            durationMs,
            expiresAt
        }
    };
}

export function mapAnnouncementRow(row) {
    if (!row) return row;
    return {
        id: row.id,
        title: row.title,
        body: row.body,
        displayType: row.display_type,
        toastType: row.toast_type,
        bannerColor: row.banner_color,
        durationMs: row.duration_ms,
        expiresAt: row.expires_at,
        createdAt: row.created_at
    };
}
