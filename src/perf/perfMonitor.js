/**
 * Lightweight performance recorder for cold-load / warm-load / runtime budgets.
 * Enable with ?perf=1 or localStorage.setItem('halley-perf', '1').
 * Snapshot: window.__halleyPerf.report()
 */

const PERF_FLAG = 'halley-perf';
const MAX_FRAME_SAMPLES = 240;
const BUDGETS = {
    firstPlayableMs: 20000,
    p95FrameMs: 22,
    peakTextures: 180,
    peakGeometries: 400
};

function isEnabled() {
    try {
        if (new URLSearchParams(window.location.search).get('perf') === '1') {
            return true;
        }
        return localStorage.getItem(PERF_FLAG) === '1';
    } catch {
        return false;
    }
}

function now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function percentile(sorted, p) {
    if (!sorted.length) {
        return 0;
    }
    const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[Math.max(0, idx)];
}

class PerfMonitor {
    constructor() {
        this.enabled = isEnabled();
        this.marks = Object.create(null);
        this.measures = [];
        this.frameTimes = [];
        this.gpuPeaks = { textures: 0, geometries: 0, programs: 0, calls: 0, triangles: 0 };
        this.transfer = { requests: 0, transferBytes: 0 };
        this.events = [];
        this._lastFrame = 0;
        this._rafHooked = false;
        this._resourceObserver = null;
        this.bootStartedAt = now();

        if (this.enabled) {
            this.mark('boot-start');
            this._observeResources();
            console.info('[PERF] Monitor enabled. Use window.__halleyPerf.report() for a snapshot.');
        }
    }

    mark(name) {
        if (!this.enabled) {
            return;
        }
        this.marks[name] = now();
        this.events.push({ type: 'mark', name, t: this.marks[name] });
    }

    measure(name, startMark, endMark = null) {
        if (!this.enabled) {
            return null;
        }
        const start = this.marks[startMark];
        const end = endMark ? this.marks[endMark] : now();
        if (start == null || end == null) {
            return null;
        }
        const duration = end - start;
        this.measures.push({ name, startMark, duration });
        this.events.push({ type: 'measure', name, duration });
        return duration;
    }

    note(message, data = null) {
        if (!this.enabled) {
            return;
        }
        this.events.push({ type: 'note', message, data, t: now() });
    }

    recordContextLoss() {
        this.note('webgl-context-lost');
    }

    sampleRenderer(renderer) {
        if (!this.enabled || !renderer?.info) {
            return;
        }
        const mem = renderer.info.memory || {};
        const render = renderer.info.render || {};
        this.gpuPeaks.textures = Math.max(this.gpuPeaks.textures, mem.textures || 0);
        this.gpuPeaks.geometries = Math.max(this.gpuPeaks.geometries, mem.geometries || 0);
        this.gpuPeaks.programs = Math.max(this.gpuPeaks.programs, (renderer.info.programs || []).length || 0);
        this.gpuPeaks.calls = Math.max(this.gpuPeaks.calls, render.calls || 0);
        this.gpuPeaks.triangles = Math.max(this.gpuPeaks.triangles, render.triangles || 0);
    }

    recordFrame() {
        if (!this.enabled) {
            return;
        }
        const t = now();
        if (this._lastFrame > 0) {
            const dt = t - this._lastFrame;
            this.frameTimes.push(dt);
            if (this.frameTimes.length > MAX_FRAME_SAMPLES) {
                this.frameTimes.shift();
            }
        }
        this._lastFrame = t;
    }

    markFirstPlayable() {
        if (!this.enabled || this.marks['first-playable']) {
            return;
        }
        this.mark('first-playable');
        this.measure('cold-to-playable', 'boot-start', 'first-playable');
    }

    markLocationChange(locationName) {
        if (!this.enabled) {
            return;
        }
        this.mark(`location-${locationName}`);
        this.note('location-change', { locationName });
    }

    _observeResources() {
        if (typeof PerformanceObserver === 'undefined') {
            return;
        }
        try {
            this._resourceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.initiatorType === 'xmlhttprequest' || entry.initiatorType === 'fetch'
                        || entry.initiatorType === 'img' || entry.initiatorType === 'script'
                        || entry.initiatorType === 'css' || entry.initiatorType === 'link'
                        || entry.initiatorType === 'audio' || entry.initiatorType === 'video'
                        || entry.initiatorType === 'other') {
                        this.transfer.requests += 1;
                        // transferSize is 0 for cache hits — still count the request.
                        this.transfer.transferBytes += entry.transferSize || 0;
                    }
                }
            });
            this._resourceObserver.observe({ type: 'resource', buffered: true });
        } catch (error) {
            console.warn('[PERF] Resource observer unavailable:', error);
        }
    }

    report() {
        const sortedFrames = [...this.frameTimes].sort((a, b) => a - b);
        const playable = this.measures.find((m) => m.name === 'cold-to-playable');
        const snapshot = {
            enabled: this.enabled,
            budgets: BUDGETS,
            marks: { ...this.marks },
            measures: [...this.measures],
            transfer: { ...this.transfer },
            gpuPeaks: { ...this.gpuPeaks },
            frame: {
                samples: sortedFrames.length,
                avgMs: sortedFrames.length
                    ? sortedFrames.reduce((a, b) => a + b, 0) / sortedFrames.length
                    : 0,
                p95Ms: percentile(sortedFrames, 95),
                maxMs: sortedFrames.length ? sortedFrames[sortedFrames.length - 1] : 0
            },
            pass: {
                firstPlayable: !playable || playable.duration <= BUDGETS.firstPlayableMs,
                p95Frame: !sortedFrames.length || percentile(sortedFrames, 95) <= BUDGETS.p95FrameMs,
                textures: this.gpuPeaks.textures <= BUDGETS.peakTextures,
                geometries: this.gpuPeaks.geometries <= BUDGETS.peakGeometries
            },
            events: this.events.slice(-80)
        };

        if (this.enabled) {
            console.info('[PERF] Report', snapshot);
        }
        return snapshot;
    }
}

export const perfMonitor = new PerfMonitor();

if (typeof window !== 'undefined') {
    window.__halleyPerf = perfMonitor;
}
