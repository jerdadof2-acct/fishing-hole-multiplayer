import * as THREE from 'three';
import { isDevFaceCameraEnabled } from './devFaceCamera.js';
import { saveDevGemOffset } from './devGemOffset.js';

const ROTATE_SENSITIVITY = 0.012;
const GEM_DEPTH_SCROLL = 0.004;

/**
 * Dev face-camera mode:
 * - Drag Halley's body: rotate in place on the dock (no sliding into the water).
 * - Drag the blue gem: move it on the chest; logs MEDALLION_GEM_OFFSET on release.
 * @param {import('../main.js').Game} game
 */
export function setupDevCatDrag(game) {
    const canvas = game.scene?.renderer?.domElement;
    if (!canvas || game._devCatDragBound) {
        return;
    }
    game._devCatDragBound = true;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const planeHit = new THREE.Vector3();
    const cameraNormal = new THREE.Vector3();
    const grabOffsetLocal = new THREE.Vector3();
    const localHit = new THREE.Vector3();

    let dragging = false;
    let activePointerId = null;
    /** @type {'gem' | 'rotate'} */
    let dragMode = 'rotate';
    let draggedGem = null;
    let gemParent = null;
    let rotateStartX = 0;
    let rotateStartY = 0;

    const updatePointer = (event) => {
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const setCanvasCursor = (cursor) => {
        canvas.style.cursor = cursor;
    };

    const canDrag = () => isDevFaceCameraEnabled() && game.cat && game.isDevFaceCameraEligible?.();

    const beginDrag = (event, hit) => {
        const isGem = hit.object?.name === 'CometMedallionGem';

        if (isGem) {
            draggedGem = hit.object;
            gemParent = hit.object.parent;
            dragMode = 'gem';
            game.cat._gemDragActive = true;

            game.scene.camera.getWorldDirection(cameraNormal);
            cameraNormal.negate();
            dragPlane.setFromNormalAndCoplanarPoint(cameraNormal, hit.point);
            gemParent.worldToLocal(localHit.copy(hit.point));
            grabOffsetLocal.copy(localHit).sub(draggedGem.position);
        } else {
            draggedGem = null;
            gemParent = null;
            dragMode = 'rotate';
            rotateStartX = event.clientX;
            const anchor = game.cat.getModel?.();
            rotateStartY = anchor?.rotation.y ?? 0;
        }

        dragging = true;
        activePointerId = event.pointerId;
        canvas.setPointerCapture(event.pointerId);
        setCanvasCursor(dragMode === 'gem' ? 'grabbing' : 'ew-resize');
        event.preventDefault();
        event.stopPropagation();
    };

    const applyDrag = (event) => {
        if (dragMode === 'gem' && draggedGem && gemParent) {
            raycaster.setFromCamera(pointer, game.scene.camera);
            if (!raycaster.ray.intersectPlane(dragPlane, planeHit)) {
                return;
            }
            gemParent.worldToLocal(localHit.copy(planeHit));
            localHit.sub(grabOffsetLocal);
            draggedGem.position.copy(localHit);
            return;
        }

        const deltaX = event.clientX - rotateStartX;
        const nextY = rotateStartY + deltaX * ROTATE_SENSITIVITY;
        game.cat.setDevManualRotation?.(nextY);
    };

    const endDrag = (event) => {
        if (!dragging || event.pointerId !== activePointerId) {
            return;
        }

        if (dragMode === 'gem' && draggedGem) {
            const p = draggedGem.position;
            saveDevGemOffset(p);
            const snippet = `new THREE.Vector3(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`;
            console.info(`[DEV] MEDALLION_GEM_OFFSET ${snippet}`);
            console.info('[DEV] MEDALLION_GEM_OFFSET detail', {
                x: Number(p.x.toFixed(3)),
                y: Number(p.y.toFixed(3)),
                z: Number(p.z.toFixed(3)),
                snippet
            });
            if (game.cat) {
                game.cat._gemDragActive = false;
            }
        } else if (dragMode === 'rotate') {
            const anchor = game.cat?.getModel?.();
            if (anchor) {
                console.info('[DEV] Halley rotation.y', Number(anchor.rotation.y.toFixed(3)));
            }
        }

        dragging = false;
        activePointerId = null;
        dragMode = 'rotate';
        if (game.cat) {
            game.cat._gemDragActive = false;
        }
        draggedGem = null;
        gemParent = null;

        if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }
        setCanvasCursor(canDrag() ? '' : '');
    };

    const onPointerDown = (event) => {
        if (!canDrag() || event.button !== 0 || dragging) {
            return;
        }
        if (event.target !== canvas) {
            return;
        }

        updatePointer(event);
        const targets = game.cat.getTapTargets?.() || [];
        if (!targets.length) {
            return;
        }

        raycaster.setFromCamera(pointer, game.scene.camera);
        const hits = raycaster.intersectObjects(targets, false);
        if (!hits.length) {
            return;
        }

        beginDrag(event, hits[0]);
    };

    const onPointerMove = (event) => {
        if (!dragging || event.pointerId !== activePointerId) {
            if (canDrag() && event.target === canvas) {
                updatePointer(event);
                const targets = game.cat.getTapTargets?.() || [];
                raycaster.setFromCamera(pointer, game.scene.camera);
                const hits = raycaster.intersectObjects(targets, false);
                if (!hits.length) {
                    setCanvasCursor('');
                    return;
                }
                setCanvasCursor(
                    hits[0].object?.name === 'CometMedallionGem' ? 'grab' : 'ew-resize'
                );
            }
            return;
        }

        if (dragMode === 'gem') {
            updatePointer(event);
        }
        applyDrag(event);
        event.preventDefault();
    };

    const onWheel = (event) => {
        if (!dragging || !canDrag() || dragMode !== 'gem' || !draggedGem) {
            return;
        }

        draggedGem.position.z += -event.deltaY * GEM_DEPTH_SCROLL;
        event.preventDefault();
    };

    canvas.addEventListener('pointerdown', onPointerDown, true);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointerup', onPointerUp);

    function onPointerUp(event) {
        endDrag(event);
    }

    game._devCatDragCleanup = () => {
        canvas.removeEventListener('pointerdown', onPointerDown, true);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
        canvas.removeEventListener('wheel', onWheel);
        window.removeEventListener('pointerup', onPointerUp);
        setCanvasCursor('');
    };
}
