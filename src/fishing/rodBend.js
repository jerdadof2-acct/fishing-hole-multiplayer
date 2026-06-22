import * as THREE from 'three';

/** Fight: only the last ~2 rod sections arc toward the bobber. */
export const ROD_BEND_FIGHT_PERCENTAGES = [1.0, 0.72, 0, 0, 0, 0, 0];

/** Blank section length in tempRod.js (must match createBlankSection height). */
const SECTION_LENGTH = 0.43;

const _hingeWorld = new THREE.Vector3();
const _tipWorld = new THREE.Vector3();
const _aimWorld = new THREE.Vector3();
const _aimLocal = new THREE.Vector3();
const _rodUp = new THREE.Vector3(0, 1, 0);
const _bendQuat = new THREE.Quaternion();
const _bendEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _parentQuat = new THREE.Quaternion();
const _invParentQuat = new THREE.Quaternion();

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
 * Fight-only: aim the tip blank sections toward the bobber (3D — down and sideways).
 * Uses world-space target so cat yaw tracking does not zero out lateral bend.
 */
export function computeFightRodBend({
    bobberWorld,
    fishPullWorld = null,
    fishWeight = 0,
    lineTension = 0.2
}) {
    const weightMult = getFishWeightBendMultiplier(fishWeight);
    const tensionBoost = THREE.MathUtils.clamp(0.55 + lineTension * 0.45, 0.55, 1.65);
    const maxAngle = THREE.MathUtils.degToRad(30) * weightMult * tensionBoost;

    _aimWorld.copy(bobberWorld);
    if (fishPullWorld && fishPullWorld.lengthSq() > 1e-4) {
        _aimWorld.addScaledVector(fishPullWorld, 2.2);
    }

    return {
        aimWorld: _aimWorld.clone(),
        maxAngle,
        swayScale: 1.15,
        bendMode: 'fight'
    };
}

/**
 * @param {THREE.Object3D[]} blankSections
 * @param {Record<string, { currentX: number, targetX: number, currentY: number, targetY: number, currentZ: number, targetZ: number }>} rodBendState
 * @param {{ aimWorld: THREE.Vector3, maxAngle: number, swayScale?: number, bendMode?: string }} targets
 * @param {number} delta
 * @param {number} [swayTime]
 */
export function applyFightTipBend(blankSections, rodBendState, targets, delta, swayTime = 0) {
    const { aimWorld, maxAngle } = targets;
    const sway = Math.sin(swayTime * 2.3) * 0.04 * (targets.swayScale ?? 1);
    const lerpSpeed = 18;

    for (let i = 0; i < blankSections.length; i++) {
        const section = blankSections[i];
        const sectionId = section.uuid || section.name;
        const bendPercent = ROD_BEND_FIGHT_PERCENTAGES[i] ?? 0;

        if (!rodBendState[sectionId]) {
            rodBendState[sectionId] = {
                currentX: section.rotation.x || 0,
                targetX: 0,
                currentY: section.rotation.y || 0,
                targetY: 0,
                currentZ: section.rotation.z || 0,
                targetZ: 0
            };
        }

        const state = rodBendState[sectionId];

        if (bendPercent < 0.01) {
            state.targetX = 0;
            state.targetY = 0;
            state.targetZ = 0;
        } else {
            const parent = section.parent;
            if (!parent) {
                continue;
            }

            parent.updateMatrixWorld(true);
            section.getWorldPosition(_hingeWorld);

            _tipWorld.set(0, SECTION_LENGTH, 0);
            section.localToWorld(_tipWorld);

            _aimLocal.copy(aimWorld).sub(_hingeWorld);
            if (_aimLocal.lengthSq() < 0.04) {
                state.targetX = 0;
                state.targetY = 0;
                state.targetZ = 0;
            } else {
                parent.getWorldQuaternion(_parentQuat);
                _invParentQuat.copy(_parentQuat).invert();
                _aimLocal.applyQuaternion(_invParentQuat).normalize();

                _bendQuat.setFromUnitVectors(_rodUp, _aimLocal);
                _bendEuler.setFromQuaternion(_bendQuat, 'YXZ');

                const scale = bendPercent * (0.82 + sway);
                state.targetX = THREE.MathUtils.clamp(_bendEuler.x * scale, -maxAngle, maxAngle);
                state.targetY = THREE.MathUtils.clamp(_bendEuler.y * scale, -maxAngle, maxAngle);
                state.targetZ = THREE.MathUtils.clamp(_bendEuler.z * scale, -maxAngle, maxAngle);
            }
        }

        state.currentX = THREE.MathUtils.lerp(state.currentX, state.targetX, lerpSpeed * delta);
        state.currentY = THREE.MathUtils.lerp(state.currentY, state.targetY, lerpSpeed * delta);
        state.currentZ = THREE.MathUtils.lerp(state.currentZ, state.targetZ, lerpSpeed * delta);

        section.rotation.x = state.currentX;
        section.rotation.y = state.currentY;
        section.rotation.z = state.currentZ;
    }
}

export function resetRodSectionBend(blankSections, rodBendState, delta, lerpSpeed = 12) {
    for (const section of blankSections) {
        const sectionId = section.uuid || section.name;

        if (!rodBendState[sectionId]) {
            rodBendState[sectionId] = {
                currentX: section.rotation.x || 0,
                targetX: 0,
                currentY: section.rotation.y || 0,
                targetY: 0,
                currentZ: section.rotation.z || 0,
                targetZ: 0
            };
        }

        const state = rodBendState[sectionId];
        state.targetX = 0;
        state.targetY = 0;
        state.targetZ = 0;
        state.currentX = THREE.MathUtils.lerp(state.currentX, 0, lerpSpeed * delta);
        state.currentY = THREE.MathUtils.lerp(state.currentY, 0, lerpSpeed * delta);
        state.currentZ = THREE.MathUtils.lerp(state.currentZ, 0, lerpSpeed * delta);
        section.rotation.x = state.currentX;
        section.rotation.y = state.currentY;
        section.rotation.z = state.currentZ;
    }
}
