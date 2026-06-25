import { GAMEPLAY_ONBOARDING_STEPS } from './config/onboarding.js';

const OVERLAY_ID = 'gameplay-onboarding';
const BODY_CLASS = 'gameplay-onboarding-active';

/**
 * @param {import('./player.js').Player | null | undefined} player
 * @param {{ force?: boolean }} [options]
 */
export function shouldShowGameplayOnboarding(player, options = {}) {
    if (options.force) {
        return true;
    }
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.has('onboarding')) {
            return true;
        }
    }
    return Boolean(player && player.hasSeenGameplayOnboarding !== true);
}

/**
 * @param {import('./player.js').Player} player
 */
export function markGameplayOnboardingSeen(player) {
    if (!player) {
        return;
    }
    player.hasSeenGameplayOnboarding = true;
    player.save({ skipSync: false });
}

/**
 * @param {{ player?: import('./player.js').Player, ui?: import('./ui.js').UI, force?: boolean, onComplete?: () => void }} options
 * @returns {Promise<void>}
 */
export function startGameplayOnboarding(options = {}) {
    const { player, ui, force = false, onComplete } = options;

    if (!shouldShowGameplayOnboarding(player, { force })) {
        onComplete?.();
        return Promise.resolve();
    }

    if (document.getElementById(OVERLAY_ID)) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        let stepIndex = 0;
        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = 'gameplay-onboarding';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'How to play');

        overlay.innerHTML = `
            <div class="gameplay-onboarding-backdrop" aria-hidden="true"></div>
            <div class="gameplay-onboarding-spotlight hidden" aria-hidden="true"></div>
            <div class="gameplay-onboarding-card">
                <p class="gameplay-onboarding-step-label"></p>
                <div class="gameplay-onboarding-icon" aria-hidden="true"></div>
                <h2 class="gameplay-onboarding-title"></h2>
                <p class="gameplay-onboarding-body"></p>
                <div class="gameplay-onboarding-actions">
                    <button type="button" class="gameplay-onboarding-back" hidden>Back</button>
                    <button type="button" class="gameplay-onboarding-skip">Skip tour</button>
                    <button type="button" class="gameplay-onboarding-next">Next</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.classList.add(BODY_CLASS);

        if (ui?.switchTab) {
            ui.switchTab('game');
        }

        const spotlight = overlay.querySelector('.gameplay-onboarding-spotlight');
        const card = overlay.querySelector('.gameplay-onboarding-card');
        const stepLabel = overlay.querySelector('.gameplay-onboarding-step-label');
        const iconEl = overlay.querySelector('.gameplay-onboarding-icon');
        const titleEl = overlay.querySelector('.gameplay-onboarding-title');
        const bodyEl = overlay.querySelector('.gameplay-onboarding-body');
        const backBtn = overlay.querySelector('.gameplay-onboarding-back');
        const skipBtn = overlay.querySelector('.gameplay-onboarding-skip');
        const nextBtn = overlay.querySelector('.gameplay-onboarding-next');

        const finish = (markSeen = true) => {
            if (markSeen && player) {
                markGameplayOnboardingSeen(player);
            }
            window.removeEventListener('resize', reposition);
            window.removeEventListener('orientationchange', reposition);
            overlay.remove();
            document.body.classList.remove(BODY_CLASS);
            onComplete?.();
            resolve();
        };

        const getTargetRect = (selector) => {
            if (!selector) {
                return null;
            }
            const el = document.querySelector(selector);
            if (!el || el.classList.contains('hidden')) {
                return null;
            }
            const rect = el.getBoundingClientRect();
            if (rect.width < 2 || rect.height < 2) {
                return null;
            }
            const pad = 10;
            return {
                top: Math.max(8, rect.top - pad),
                left: Math.max(8, rect.left - pad),
                width: Math.min(window.innerWidth - 16, rect.width + pad * 2),
                height: Math.min(window.innerHeight - 16, rect.height + pad * 2)
            };
        };

        const positionCard = (step, targetRect) => {
            if (!card) {
                return;
            }

            card.classList.toggle('gameplay-onboarding-card--center', Boolean(step.center || !targetRect));
            card.style.top = '';
            card.style.left = '';
            card.style.bottom = '';
            card.style.right = '';
            card.style.transform = '';

            if (step.center || !targetRect) {
                return;
            }

            const margin = 16;
            const cardRect = card.getBoundingClientRect();
            const placement = step.placement === 'below' ? 'below' : 'above';
            let top;
            let left = targetRect.left + targetRect.width / 2 - cardRect.width / 2;
            left = Math.max(margin, Math.min(left, window.innerWidth - cardRect.width - margin));

            if (placement === 'below') {
                top = targetRect.top + targetRect.height + margin;
                if (top + cardRect.height > window.innerHeight - margin) {
                    top = targetRect.top - cardRect.height - margin;
                }
            } else {
                top = targetRect.top - cardRect.height - margin;
                if (top < margin) {
                    top = targetRect.top + targetRect.height + margin;
                }
            }

            top = Math.max(margin, Math.min(top, window.innerHeight - cardRect.height - margin));
            card.style.top = `${top}px`;
            card.style.left = `${left}px`;
        };

        const reposition = () => {
            const step = GAMEPLAY_ONBOARDING_STEPS[stepIndex];
            if (!step) {
                return;
            }
            const targetRect = step.center ? null : getTargetRect(step.target);
            if (spotlight) {
                if (targetRect) {
                    spotlight.classList.remove('hidden');
                    spotlight.style.top = `${targetRect.top}px`;
                    spotlight.style.left = `${targetRect.left}px`;
                    spotlight.style.width = `${targetRect.width}px`;
                    spotlight.style.height = `${targetRect.height}px`;
                } else {
                    spotlight.classList.add('hidden');
                }
            }
            requestAnimationFrame(() => positionCard(step, targetRect));
        };

        const renderStep = () => {
            const step = GAMEPLAY_ONBOARDING_STEPS[stepIndex];
            const total = GAMEPLAY_ONBOARDING_STEPS.length;
            if (!step) {
                finish(true);
                return;
            }

            if (stepLabel) {
                stepLabel.textContent = `Step ${stepIndex + 1} of ${total}`;
            }
            if (iconEl) {
                iconEl.textContent = step.icon || '';
                iconEl.classList.toggle('hidden', !step.icon);
            }
            if (titleEl) {
                titleEl.textContent = step.title;
            }
            if (bodyEl) {
                bodyEl.textContent = step.body;
            }
            if (backBtn) {
                backBtn.hidden = stepIndex === 0;
            }
            if (skipBtn) {
                skipBtn.hidden = stepIndex === total - 1;
            }
            if (nextBtn) {
                nextBtn.textContent = stepIndex === total - 1 ? 'Start fishing!' : 'Next';
            }

            overlay.setAttribute('aria-labelledby', `onboarding-title-${step.id}`);
            if (titleEl) {
                titleEl.id = `onboarding-title-${step.id}`;
            }

            reposition();
        };

        backBtn?.addEventListener('click', () => {
            if (stepIndex > 0) {
                stepIndex -= 1;
                renderStep();
            }
        });

        skipBtn?.addEventListener('click', () => finish(true));

        nextBtn?.addEventListener('click', () => {
            if (stepIndex >= GAMEPLAY_ONBOARDING_STEPS.length - 1) {
                finish(true);
                return;
            }
            stepIndex += 1;
            renderStep();
        });

        overlay.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                finish(true);
            } else if (event.key === 'Enter' && event.target === nextBtn) {
                nextBtn.click();
            }
        });

        window.addEventListener('resize', reposition);
        window.addEventListener('orientationchange', reposition);

        renderStep();
        nextBtn?.focus();
    });
}
