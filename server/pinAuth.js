import crypto from 'crypto';

const PIN_PATTERN = /^\d{4,6}$/;
const SCRYPT_KEYLEN = 64;

export function validatePin(pin) {
    if (typeof pin !== 'string' || !PIN_PATTERN.test(pin)) {
        return { ok: false, error: 'Save PIN must be 4–6 digits.' };
    }
    return { ok: true };
}

export function hashPin(pin) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(pin, salt, SCRYPT_KEYLEN).toString('hex');
    return `scrypt:${salt}:${hash}`;
}

export function verifyPin(pin, stored) {
    if (!stored || typeof stored !== 'string') {
        return false;
    }
    const parts = stored.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
        return false;
    }
    const [, salt, expectedHash] = parts;
    const actualHash = crypto.scryptSync(pin, salt, SCRYPT_KEYLEN).toString('hex');
    try {
        return crypto.timingSafeEqual(
            Buffer.from(actualHash, 'hex'),
            Buffer.from(expectedHash, 'hex')
        );
    } catch {
        return false;
    }
}
