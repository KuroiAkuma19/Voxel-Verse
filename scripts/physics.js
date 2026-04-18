import * as THREE from "three";
import { blocks } from "./blocks.js";

export class Physics {
  gravity = 32;
  simulationRate = 200;
  timestep = 1 / this.simulationRate;
  accumulator = 0;

  _tempVector = new THREE.Vector3();
  _tempNormal = new THREE.Vector3();
  _closestPoint = new THREE.Vector3();

  constructor(scene) {
    this.helpers = new THREE.Group();
    this.helpers.visible = false;
    scene.add(this.helpers);

    const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
    const cylMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
    });
    this.playerCylinderHelper = new THREE.Mesh(cylGeo, cylMat);
    this.helpers.add(this.playerCylinderHelper);
  }

  update(dt, player, world) {
    this.accumulator += dt;
    if (this.accumulator > 0.1) this.accumulator = 0.1;

    const waterLevel = world.params.terrain.waterOffset + 0.4;

    while (this.accumulator >= this.timestep) {
      // --- FLYING LOGIC (Skip Physics) ---
      if (player.isFlying) {
        // Just apply the movement inputs from Player.js directly
        player.applyInputs(this.timestep);
        // (Optional) We still run collision detection below if you want
        // to stop player from flying through walls.
        // If you want "NoClip" (ghost mode), comment out detectCollisions below.
      } else {
        // --- NORMAL PHYSICS (Gravity / Water) ---
        const chestLevel = player.position.y - player.height * 0.7;
        const isInWater = chestLevel < waterLevel;

        if (isInWater) {
          // Water Physics
          player.velocity.y -= 3.0 * this.timestep;
          if (player.velocity.y < -2) player.velocity.y = -2;

          const isMoving =
            player.keyStates["KeyW"] ||
            player.keyStates["KeyS"] ||
            player.keyStates["KeyA"] ||
            player.keyStates["KeyD"];
          const isSprinting = player.keyStates["ShiftLeft"];

          if (isMoving && isSprinting) {
            player.velocity.y = 3.0;
            if (player.position.y >= waterLevel) {
              player.velocity.y = Math.min(player.velocity.y, 0.5);
            }
          }

          player.applyInputs(this.timestep);
          player.velocity.x *= 0.6;
          player.velocity.z *= 0.6;
        } else {
          // Air Physics
          player.velocity.y -= this.gravity * this.timestep;
          player.applyInputs(this.timestep);
        }
      }

      // 2. Collision Detection
      // We keep this running even when flying so you don't accidentally fly into the void or get stuck in a wall.
      // To enable "Ghost Mode", wrap this in if (!player.isFlying)
      this.detectCollisions(player, world);

      this.accumulator -= this.timestep;
    }

    this.updatePlayerCylinderHelper(player);
  }

  updatePlayerCylinderHelper(player) {
    this.playerCylinderHelper.scale.set(
      player.radius * 2,
      player.height,
      player.radius * 2
    );
    this.playerCylinderHelper.position.set(
      player.position.x,
      player.position.y - player.height / 2,
      player.position.z
    );
  }

  detectCollisions(player, world) {
    player.onGround = false;
    const candidates = this.broadPhase(player, world);
    const collisions = this.narrowPhase(candidates, player);

    if (collisions.length > 0) {
      this.resolveCollisions(collisions, player);
    }
  }

  broadPhase(player, world) {
    const candidates = [];
    const minX = Math.floor(player.position.x - player.radius);
    const maxX = Math.ceil(player.position.x + player.radius);
    const minY = Math.floor(player.position.y - player.height);
    const maxY = Math.ceil(player.position.y);
    const minZ = Math.floor(player.position.z - player.radius);
    const maxZ = Math.ceil(player.position.z + player.radius);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const block = world.getBlock(x, y, z);
          if (block && block.id !== blocks.empty.id) {
            candidates.push({ x, y, z });
          }
        }
      }
    }
    return candidates;
  }

  narrowPhase(candidates, player) {
    const collisions = [];
    const p = player.position;

    for (const block of candidates) {
      this._closestPoint.set(
        Math.max(block.x - 0.5, Math.min(p.x, block.x + 0.5)),
        Math.max(
          block.y - 0.5,
          Math.min(p.y - player.height / 2, block.y + 0.5)
        ),
        Math.max(block.z - 0.5, Math.min(p.z, block.z + 0.5))
      );

      const dx = this._closestPoint.x - player.position.x;
      const dy = this._closestPoint.y - (player.position.y - player.height / 2);
      const dz = this._closestPoint.z - player.position.z;

      if (this.pointInPlayerBoundingCylinder(this._closestPoint, player)) {
        const overlapY = player.height / 2 - Math.abs(dy);
        const overlapXZ = player.radius - Math.sqrt(dx * dx + dz * dz);

        const verticalThreshold = player.velocity.y < 0 ? 0.2 : 0;

        let normal, overlap;
        if (overlapY < overlapXZ + verticalThreshold) {
          normal = new THREE.Vector3(0, -Math.sign(dy), 0);
          overlap = overlapY;
          if (normal.y > 0) player.onGround = true;
        } else {
          normal = new THREE.Vector3(-dx, 0, -dz).normalize();
          overlap = overlapXZ;
        }

        collisions.push({
          block,
          contactPoint: this._closestPoint.clone(),
          normal,
          overlap,
        });
      }
    }
    return collisions;
  }

  resolveCollisions(collisions, player) {
    collisions.sort((a, b) => b.overlap - a.overlap);

    for (const collision of collisions) {
      if (!this.pointInPlayerBoundingCylinder(collision.contactPoint, player))
        continue;

      const delta = collision.normal.clone().multiplyScalar(collision.overlap);
      player.position.add(delta);

      const magnitude = player.worldVelocity.dot(collision.normal);
      const velocityAdjustment = collision.normal
        .clone()
        .multiplyScalar(magnitude);
      player.applyWorldDeltaVelocity(velocityAdjustment.negate());
    }
  }

  pointInPlayerBoundingCylinder(p, player) {
    const dx = p.x - player.position.x;
    const dy = p.y - (player.position.y - player.height / 2);
    const dz = p.z - player.position.z;
    const r_sq = dx * dx + dz * dz;
    return (
      Math.abs(dy) <= player.height / 2 && r_sq <= player.radius * player.radius
    );
  }
}
