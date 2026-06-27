/** Set true for verbose dev logging (off for release — helps mobile performance). */
export const DEBUG = false;

/** @param {...unknown} args */
export function debugLog(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}
