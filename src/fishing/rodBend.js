import * as THREE from 'three';

/** Progressive bend from tip (index 0) to base — tip carries most of the curve. */
export const ROD_BEND_PERCENTAGES = [0.92, 0.78, 0.64, 0.5, 0.36, 0.22, 0.1];

const _toBobber = new THREE.Vector3();
const _rodAxis = new THREE.Vector3(0, 1, 0);
const _worldOffset = new THREE.Vector3();
const _localHoriz = new THREE.Vector3();
const _pullLocal = new THREE.Vector3();
const _rodRootQuat = new THREE.Quaternion();
const _invRodRootQuat = new THREE.Quaternion();

export function getFishWeightBendMultiplier(weight) {
    if (!weight || weight < 3) return 1.0;
    if (weight < 6) return 1.25;
    if (weight < 10) return 1.55;
    if (weight < 20) return 1.9;
    return 2.35;
}

export function collectBlankSections(tempRodTip, tempRodRoot) {
    const sections = [];
    let current = tempRodTip?.parent;

    while (current && current !== tempRodRoot) {
        const name = current.name || '';
        if (name.includes('Blank') || name.includes('RodBlank')) {
            sections.push(current);
        }
        current = current.parent;
    }

    return sections;
}

/**
 * @param {{
 *   localTipPos: THREE.Vector3,
 *   localBobberPos: THREE.Vector3,
 *   rodTipWorld?: THREE.Vector3,
 *   bobberWorld?: THREE.Vector3,
 *   rodRoot?: THREE.Object3D,
 *   fishPullWorld?: THREE.Vector3 | null,
 *   distance: number,
 *   fishWeight?: number,
 *   lineTension?: number,
 *   mode?: 'fight' | 'reel' | 'idle'
 * }} params
 * @returns {{ pitch: number, lateral: number, swayScale: number }}
 */
export function computeRodBendTowardBobber({
    localTipPos,
    localBobberPos,
    rodTipWorld,
    bobberWorld,
    rodRoot,
    fishPullWorld = null,
    distance,
    fishWeight = 0,
    lineTension = 0.2,
    mode = 'idle'
}) {
    const weightMult = getFishWeightBendMultiplier(fishWeight);
    const distanceFactor = THREE.MathUtils.clamp(1 - (distance / 14) * 0.25, 0.65, 1);
    const tensionBoost = THREE.MathUtils.clamp(0.5 + lineTension * 0.45, 0.5, 1.65);
    const modeScale = mode === 'fight' ? 1 : mode === 'reel' ? 0.72 : 0.42;

    // During a fight, bend side-to-side toward the fish (world horizontal pull), not just downward.
    if (mode === 'fight' && rodRoot && rodTipWorld && bobberWorld) {
        _worldOffset.subVectors(bobberWorld, rodTipWorld);
        const horizLen = Math.hypot(_worldOffset.x, _worldOffset.z);
        if (horizLen > 0.12) {
            rodRoot.getWorldQuaternion(_rodRootQuat);
            _invRodRootQuat.copy(_rodRootQuat).invert();

            _localHoriz.set(_worldOffset.x, 0, _worldOffset.z).multiplyScalar(1 / horizLen);
            _localHoriz.applyQuaternion(_invRodRootQuat);

            const horizAimFactor = Math.min(1, horizLen / 5.5);

            const maxLateral = THREE.MathUtils.degToRad(28) * weightMult * tensionBoost * distanceFactor;
            const maxPitch = THREE.MathUtils.degToRad(8) * weightMult * tensionBoost * distanceFactor;

            let lateralDir = _localHoriz.x;
            let pitchDir = -_localHoriz.z * 0.35;

            if (fishPullWorld) {
                _pullLocal.copy(fishPullWorld);
                _pullLocal.y = 0;
                if (_pullLocal.lengthSq() > 1e-4) {
                    _pullLocal.normalize().applyQuaternion(_invRodRootQuat);
                    lateralDir = THREE.MathUtils.lerp(lateralDir, _pullLocal.x, 0.65);
                    pitchDir += _pullLocal.z * 0.12;
                }
            }

            return {
                pitch: maxPitch * horizAimFactor * THREE.MathUtils.clamp(pitchDir, -1, 1),
                lateral: maxLateral * horizAimFactor * THREE.MathUtils.clamp(lateralDir, -1, 1),
                swayScale: 1.15,
                lateralSwayScale: 1.35
            };
        }
    }

    _toBobber.subVectors(localBobberPos, localTipPos);
    const dist = _toBobber.length();
    if (dist < 0.08) {
        return { pitch: 0, lateral: 0, swayScale: 0 };
    }

    _toBobber.multiplyScalar(1 / dist);

    const aimAngle = Math.acos(THREE.MathUtils.clamp(_rodAxis.dot(_toBobber), -1, 1));
    const aimFactor = Math.min(1, aimAngle / THREE.MathUtils.degToRad(32));

    const maxPitch = THREE.MathUtils.degToRad(mode === 'idle' ? 18 : 14)
        * weightMult * modeScale * tensionBoost * distanceFactor;
    const maxLateral = THREE.MathUtils.degToRad(mode === 'reel' ? 14 : 8)
        * weightMult * modeScale * tensionBoost * distanceFactor;

    const pitchDir = THREE.MathUtils.clamp(
        -_toBobber.z * 0.55 + Math.max(0, -_toBobber.y) * 0.45,
        -1,
        1
    );
    const lateralDir = THREE.MathUtils.clamp(-_toBobber.x, -1, 1);

    return {
        pitch: maxPitch * aimFactor * pitchDir,
        lateral: maxLateral * aimFactor * lateralDir,
        swayScale: mode === 'fight' ? 1 : mode === 'reel' ? 0.55 : 0.2
    };
}

/**
 * @param {THREE.Object3D[]} blankSections
 * @param {Record<string, { currentX: number, targetX: number, currentZ: number, targetZ: number }>} rodBendState
 * @param {{ pitch: number, lateral: number, swayScale?: number }} targets
 * @param {number} delta
 * @param {number} [swayTime]
 */
export function applyRodSectionBend(blankSections, rodBendState, targets, delta, swayTime = 0) {
    const swayScale = targets.swayScale ?? 0;
    const swayFrequency = 2.4;
    const swayAmplitude = 0.12 * swayScale;
    const lateralSwayScale = targets.lateralSwayScale ?? 1;
    const sway1 = Math.sin(swayTime * swayFrequency) * swayAmplitude;
    const sway2 = Math.sin(swayTime * swayFrequency * 1.65) * swayAmplitude * 0.45;
    const totalSway = sway1 + sway2;

    const lerpSpeed = 14;

    for (let i = 0; i < blankSections.length && i < ROD_BEND_PERCENTAGES.length; i++) {
        const section = blankSections[i];
        const sectionId = section.uuid || section.name;
        const bendPercent = ROD_BEND_PERCENTAGES[i];
        const swayFactor = 1 - (i / Math.max(1, blankSections.length)) * 0.72;

        const targetPitch = targets.pitch * bendPercent;
        const targetLateral = targets.lateral * bendPercent
            + totalSway * targets.lateral * bendPercent * swayFactor * lateralSwayScale;

        if (!rodBendState[sectionId]) {
            rodBendState[sectionId] = {
                currentX: section.rotation.x || 0,
                targetX: 0,
                currentZ: section.rotation.z || 0,
                targetZ: 0
            };
        }

        const state = rodBendState[sectionId];
        state.targetX = targetPitch;
        state.targetZ = targetLateral;

        state.currentX = THREE.MathUtils.lerp(state.currentX, state.targetX, lerpSpeed * delta);
        state.currentZ = THREE.MathUtils.lerp(state.currentZ, state.targetZ, lerpSpeed * delta);

        section.rotation.x = state.currentX;
        section.rotation.z = state.currentZ;
    }
}

export function resetRodSectionBend(blankSections, rodBendState, delta, lerpSpeed = 9) {
    for (const section of blankSections) {
        const sectionId = section.uuid || section.name;

        if (!rodBendState[sectionId]) {
            rodBendState[sectionId] = {
                currentX: section.rotation.x || 0,
                targetX: 0,
                currentZ: section.rotation.z || 0,
                targetZ: 0
            };
        }

        const state = rodBendState[sectionId];
        state.targetX = 0;
        state.targetZ = 0;
        state.currentX = THREE.MathUtils.lerp(state.currentX, 0, lerpSpeed * delta);
        state.currentZ = THREE.MathUtils.lerp(state.currentZ, 0, lerpSpeed * delta);
        section.rotation.x = state.currentX;
        section.rotation.z = state.currentZ;
    }
}
