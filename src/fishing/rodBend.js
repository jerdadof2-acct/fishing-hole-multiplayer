import * as THREE from 'three';

/** Gentle line-sag curve along the blank (tip → base). */
export const ROD_BEND_IDLE_PERCENTAGES = [0.55, 0.45, 0.36, 0.28, 0.2, 0.12, 0.06];

/** Fight: only the last ~2 rod sections arc toward the bobber; butt stays stiff. */
export const ROD_BEND_FIGHT_PERCENTAGES = [1.0, 0.82, 0.05, 0.02, 0.01, 0, 0];

const _toBobber = new THREE.Vector3();
const _rodAxis = new THREE.Vector3(0, 1, 0);
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
 *   rodRoot?: THREE.Object3D,
 *   fishPullWorld?: THREE.Vector3 | null,
 *   distance: number,
 *   fishWeight?: number,
 *   lineTension?: number,
 *   mode?: 'fight' | 'reel' | 'idle'
 * }} params
 */
export function computeRodBendTowardBobber({
    localTipPos,
    localBobberPos,
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

    _toBobber.subVectors(localBobberPos, localTipPos);
    const dist = _toBobber.length();
    if (dist < 0.08) {
        return { pitch: 0, lateral: 0, swayScale: 0, bendMode: mode };
    }

    _toBobber.multiplyScalar(1 / dist);
    const dir = _toBobber;

    const aimAngle = Math.acos(THREE.MathUtils.clamp(_rodAxis.dot(dir), -1, 1));
    const aimFactor = Math.min(1, aimAngle / THREE.MathUtils.degToRad(mode === 'fight' ? 26 : 32));

    if (mode === 'fight') {
        const maxPitch = THREE.MathUtils.degToRad(22) * weightMult * tensionBoost * distanceFactor;
        const maxLateral = THREE.MathUtils.degToRad(34) * weightMult * tensionBoost * distanceFactor;

        // Full 3D aim: tip arcs toward bobber — down (Y) and sideways (X).
        let lateralDir = -dir.x;
        let pitchDir = -dir.z * 0.35 + Math.max(0, -dir.y) * 1.0;

        if (fishPullWorld && rodRoot) {
            rodRoot.getWorldQuaternion(_rodRootQuat);
            _invRodRootQuat.copy(_rodRootQuat).invert();
            _pullLocal.copy(fishPullWorld);
            if (_pullLocal.lengthSq() > 1e-4) {
                _pullLocal.normalize().applyQuaternion(_invRodRootQuat);
                lateralDir = THREE.MathUtils.lerp(lateralDir, -_pullLocal.x, 0.55);
                pitchDir = THREE.MathUtils.lerp(
                    pitchDir,
                    -_pullLocal.z * 0.3 + Math.max(0, -dir.y) * 0.85,
                    0.2
                );
            }
        }

        const lateralMag = Math.abs(dir.x) + Math.abs(dir.z) * 0.25;
        const pitchMag = Math.max(0, -dir.y) + Math.abs(dir.z) * 0.2;
        const lateralWeight = THREE.MathUtils.clamp(lateralMag / Math.max(0.15, lateralMag + pitchMag), 0.35, 1);
        const pitchWeight = THREE.MathUtils.clamp(pitchMag / Math.max(0.15, lateralMag + pitchMag), 0.35, 1);

        return {
            pitch: maxPitch * aimFactor * pitchWeight * THREE.MathUtils.clamp(pitchDir, -1, 1),
            lateral: maxLateral * aimFactor * lateralWeight * THREE.MathUtils.clamp(lateralDir, -1, 1),
            swayScale: 1.2,
            lateralSwayScale: 1.4,
            bendMode: 'fight'
        };
    }

    const maxPitch = THREE.MathUtils.degToRad(mode === 'idle' ? 18 : 14)
        * weightMult * modeScale * tensionBoost * distanceFactor;
    const maxLateral = THREE.MathUtils.degToRad(mode === 'reel' ? 14 : 8)
        * weightMult * modeScale * tensionBoost * distanceFactor;

    const pitchDir = THREE.MathUtils.clamp(
        -dir.z * 0.55 + Math.max(0, -dir.y) * 0.45,
        -1,
        1
    );
    const lateralDir = THREE.MathUtils.clamp(-dir.x, -1, 1);

    return {
        pitch: maxPitch * aimFactor * pitchDir,
        lateral: maxLateral * aimFactor * lateralDir,
        swayScale: mode === 'reel' ? 0.55 : 0.2,
        bendMode: mode
    };
}

/**
 * @param {THREE.Object3D[]} blankSections
 * @param {Record<string, { currentX: number, targetX: number, currentZ: number, targetZ: number }>} rodBendState
 * @param {{ pitch: number, lateral: number, swayScale?: number, lateralSwayScale?: number, bendMode?: string }} targets
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

    const percentages = targets.bendMode === 'fight'
        ? ROD_BEND_FIGHT_PERCENTAGES
        : ROD_BEND_IDLE_PERCENTAGES;
    const lerpSpeed = targets.bendMode === 'fight' ? 16 : 14;

    for (let i = 0; i < blankSections.length && i < percentages.length; i++) {
        const section = blankSections[i];
        const sectionId = section.uuid || section.name;
        const bendPercent = percentages[i];
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
