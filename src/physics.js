import * as THREE from 'three';

export class Physics {
    static GRAVITY = 9.8; // m/s²
    static AIR_RESISTANCE = 0.02; // Air resistance coefficient

    // Calculate parabolic trajectory for projectile motion
    static calculateTrajectory(startPos, targetPos, initialVelocity, deltaTime) {
        const direction = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
        const velocity = direction.multiplyScalar(initialVelocity);
        
        // Apply gravity
        velocity.y -= this.GRAVITY * deltaTime;
        
        // Apply air resistance
        velocity.multiplyScalar(1 - this.AIR_RESISTANCE * deltaTime);
        
        // Calculate new position
        const newPos = startPos.clone().add(velocity.clone().multiplyScalar(deltaTime));
        
        return { position: newPos, velocity: velocity };
    }

    // Calculate trajectory to hit a target point
    static calculateLaunchVelocity(startPos, targetPos, maxHeight = 5) {
        const dx = targetPos.x - startPos.x;
        const dz = targetPos.z - startPos.z;
        const dy = targetPos.y - startPos.y;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Calculate initial velocity to reach target
        // Using projectile motion equations
        const g = this.GRAVITY;
        const angle = Math.atan2(maxHeight - startPos.y, distance / 2);
        
        // Calculate initial speed needed
        const v0y = Math.sqrt(2 * g * (maxHeight - startPos.y));
        const v0x = distance / (2 * v0y / g);
        
        // Create velocity vector
        const direction = new THREE.Vector3(dx, 0, dz).normalize();
        const velocity = new THREE.Vector3();
        velocity.copy(direction.multiplyScalar(v0x));
        velocity.y = v0y;
        
        return velocity;
    }

    // Calculate fishing line sag based on gravity and tension
    static calculateLineSag(startPos, endPos, tension, segments = 20) {
        const points = [];
        
        // Validate inputs
        if (!startPos || !endPos) {
            return [startPos || new THREE.Vector3(), endPos || new THREE.Vector3()];
        }
        
        // Ensure minimum 2 points for the curve
        if (segments < 1) segments = 1;
        
        const length = startPos.distanceTo(endPos);
        const sagAmount = length * 0.1; // 10% sag due to gravity
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const point = new THREE.Vector3();
            point.lerpVectors(startPos, endPos, t);
            
            // Add sag based on gravity (more sag in the middle)
            const sag = Math.sin(t * Math.PI) * sagAmount * (1 - tension);
            point.y -= sag;
            
            // Validate the point before adding
            if (isFinite(point.x) && isFinite(point.y) && isFinite(point.z)) {
                points.push(point);
            } else {
                // Fallback to simple lerp if sag calculation fails
                const fallbackPoint = new THREE.Vector3();
                fallbackPoint.lerpVectors(startPos, endPos, t);
                points.push(fallbackPoint);
            }
        }
        
        // Ensure at least 2 points
        if (points.length < 2) {
            points.length = 0;
            points.push(startPos.clone());
            points.push(endPos.clone());
        }
        
        return points;
    }

    // Check if position is within bounds
    static isWithinBounds(position, bounds) {
        return position.x >= bounds.minX &&
               position.x <= bounds.maxX &&
               position.z >= bounds.minZ &&
               position.z <= bounds.maxZ;
    }
}

