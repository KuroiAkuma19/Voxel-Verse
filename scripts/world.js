import * as THREE from "three";
import { WorldChunk } from "./worldChunk.js";
import { blocks } from "./blocks.js";
import { DataStore } from "./dataStore.js";
import { Water } from "three/examples/jsm/objects/Water2.js";

export class World extends THREE.Group {
  asyncLoading = true;
  drawDistance = 5;
  chunkSize = { width: 40, height: 64 };
  params = {
    seed: 0,
    terrain: {
      scale: 90,
      magnitude: 10,
      offset: 4,
      waterOffset: 4,
    },
    biomes: {
      temperature: {
        scale: 10,
      },
      humidity: {
        scale: 10,
      },
    },
    trees: {
      trunk: {
        minHeight: 4,
        maxHeight: 7,
      },
      canopy: {
        minRadius: 2,
        maxRadius: 4,
        density: 0.5,
      },
      frequency: 0.01,
    },
    clouds: {
      scale: 30,
      density: 0,
    },
  };

  dataStore = new DataStore();
  chunkCache = new Map();
  chunks = new Map();
  frustum = new THREE.Frustum();
  cameraViewProjectionMatrix = new THREE.Matrix4();
  raycaster = new THREE.Raycaster();
  water = null;

  constructor() {
    super();
    this.water = this.createWater();
    this.add(this.water);
  }

  save() {
    localStorage.setItem("minecraft_params", JSON.stringify(this.params));
    localStorage.setItem("minecraft_data", JSON.stringify(this.dataStore.data));
    this.showStatus("GAME SAVED");
  }

  load() {
    const savedParams = localStorage.getItem("minecraft_params");
    const savedData = localStorage.getItem("minecraft_data");

    if (savedParams && savedData) {
      this.params = JSON.parse(savedParams);
      this.dataStore.data = JSON.parse(savedData);
      this.createWorld(true);
      this.showStatus("GAME LOADED");
    } else {
      this.showStatus("NO SAVED GAME FOUND");
    }
  }

  showStatus(msg) {
    const el = document.getElementById("status");
    if (el) {
      el.innerHTML = msg;
      setTimeout(() => (el.innerHTML = ""), 3000);
    }
  }

  createWater() {
    const waterGeometry = new THREE.PlaneGeometry(1000, 1000);
    
    // UPDATED: Added BASE_URL logic to ensure water textures load on GitHub
    const baseUrl = import.meta.env.BASE_URL;
    
    const water = new Water(waterGeometry, {
      color: "#ffffff",
      scale: 4,
      flowDirection: new THREE.Vector2(1, 1),
      textureWidth: 1024,
      textureHeight: 1024,
    });

    water.rotation.x = -Math.PI / 2;
    water.position.y = this.params.terrain.waterOffset + 0.4;
    water.layers.set(1);
    return water;
  }

  updateVisibleChunks(playerCamera) {
    this.cameraViewProjectionMatrix.multiplyMatrices(
      playerCamera.projectionMatrix,
      playerCamera.matrixWorldInverse
    );
    this.frustum.setFromProjectionMatrix(this.cameraViewProjectionMatrix);

    for (let chunk of this.children) {
      if (chunk instanceof WorldChunk) {
        const box = new THREE.Box3().setFromObject(chunk);
        chunk.visible = this.frustum.intersectsBox(box);
      }
    }
  }

  createWorld(clearCache = false) {
    if (clearCache && Object.keys(this.dataStore.data).length === 0) {
      this.dataStore.clear();
    }

    this.disposeChunks();

    for (let x = -this.drawDistance; x <= this.drawDistance; x++) {
      for (let z = -this.drawDistance; z <= this.drawDistance; z++) {
        this.loadChunk(x, z);
      }
    }
  }

  update(player) {
    const playerChunkX = Math.floor(player.position.x / this.chunkSize.width);
    const playerChunkZ = Math.floor(player.position.z / this.chunkSize.width);

    const newChunks = new Map();
    for (
      let x = playerChunkX - this.drawDistance;
      x <= playerChunkX + this.drawDistance;
      x++
    ) {
      for (
        let z = playerChunkZ - this.drawDistance;
        z <= playerChunkZ + this.drawDistance;
        z++
      ) {
        const chunkId = `${x}:${z}`;
        newChunks.set(chunkId, true);
        if (!this.chunks.has(chunkId)) {
          this.loadChunk(x, z);
        }
      }
    }

    for (const [chunkId, chunk] of this.chunks.entries()) {
      if (!newChunks.has(chunkId)) {
        this.unloadChunk(chunk.userData.x, chunk.userData.z);
      }
    }
  }

  loadChunk(chunkX, chunkZ) {
    const chunkId = `${chunkX}:${chunkZ}`;
    if (this.chunks.has(chunkId)) {
      return;
    }

    let chunk = this.chunkCache.get(chunkId);
    if (!chunk) {
      chunk = new WorldChunk(this.chunkSize, this.params, this.dataStore);
      chunk.userData = { x: chunkX, z: chunkZ };
      chunk.position.set(
        chunkX * this.chunkSize.width,
        0,
        chunkZ * this.chunkSize.width
      );
      if (this.asyncLoading) {
        requestIdleCallback(chunk.createWorld.bind(chunk), { timeout: 1000 });
      } else {
        chunk.createWorld();
      }
      this.chunkCache.set(chunkId, chunk);
    }

    this.chunks.set(chunkId, chunk);
    this.add(chunk);
  }

  unloadChunk(chunkX, chunkZ) {
    const chunkId = `${chunkX}:${chunkZ}`;
    if (this.chunks.has(chunkId)) {
      const chunk = this.chunks.get(chunkId);
      this.remove(chunk);
      this.chunks.delete(chunkId);
    }
  }

  getBlock(x, y, z) {
    const coords = this.worldToChunkCoords(x, y, z);
    const chunkId = `${coords.chunk.x}:${coords.chunk.z}`;
    const chunk = this.chunks.get(chunkId);

    if (chunk && chunk.loaded) {
      return chunk.getBlock(coords.block.x, coords.block.y, coords.block.z);
    } else {
      return null;
    }
  }

  worldToChunkCoords(x, y, z) {
    const chunkCoords = {
      x: Math.floor(x / this.chunkSize.width),
      z: Math.floor(z / this.chunkSize.width),
    };

    const blockCoords = {
      x: x - this.chunkSize.width * chunkCoords.x,
      y,
      z: z - this.chunkSize.width * chunkCoords.z,
    };

    return {
      chunk: chunkCoords,
      block: blockCoords,
    };
  }

  getChunk(chunkX, chunkZ) {
    const chunkId = `${chunkX}:${chunkZ}`;
    return this.chunks.get(chunkId);
  }

  disposeChunks() {
    this.chunkCache.forEach((chunk) => chunk.disposeInstances());
    this.chunks.clear();
    this.chunkCache.clear();
    this.clear();
  }

  addBlock(x, y, z, blockId) {
    const coords = this.worldToChunkCoords(x, y, z);
    const chunk = this.getChunk(coords.chunk.x, coords.chunk.z);

    if (chunk) {
      chunk.addBlock(coords.block.x, coords.block.y, coords.block.z, blockId);
      this.revealNeighbors(x, y, z);
    }
  }

  breakBlock(intersection) {
    if (
      intersection.object.isInstancedMesh &&
      intersection.object.geometry.type !== "BoxGeometry"
    ) {
      const chunk = intersection.object.parent;
      if (
        chunk instanceof WorldChunk &&
        typeof chunk.removeGrassInstance === "function"
      ) {
        chunk.removeGrassInstance(intersection.instanceId);
        return;
      }
    }

    const point = intersection.point;
    const normal = intersection.face.normal;

    const x = Math.floor(point.x - normal.x * 0.1);
    const y = Math.floor(point.y - normal.y * 0.1);
    const z = Math.floor(point.z - normal.z * 0.1);

    this.removeBlock(x, y, z);
  }

  removeBlock(x, y, z) {
    const coords = this.worldToChunkCoords(x, y, z);
    const chunk = this.getChunk(coords.chunk.x, coords.chunk.z);

    if (chunk) {
      chunk.removeBlock(coords.block.x, coords.block.y, coords.block.z);
      this.revealNeighbors(x, y, z);
    }
  }

  revealNeighbors(x, y, z) {
    this.revealBlock(x - 1, y, z);
    this.revealBlock(x + 1, y, z);
    this.revealBlock(x, y - 1, z);
    this.revealBlock(x, y + 1, z);
    this.revealBlock(x, y, z - 1);
    this.revealBlock(x, y, z + 1);
  }

  isBlockObscured(x, y, z) {
    const neighbors = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    ];

    for (const [dx, dy, dz] of neighbors) {
      const neighbor = this.getBlock(x + dx, y + dy, z + dz);
      if (!neighbor || neighbor.id === blocks.empty.id) {
        return false;
      }
    }
    return true;
  }

  revealBlock(x, y, z) {
    const coords = this.worldToChunkCoords(x, y, z);
    const chunk = this.getChunk(coords.chunk.x, coords.chunk.z);

    if (!chunk) return;

    const block = chunk.getBlock(
      coords.block.x,
      coords.block.y,
      coords.block.z
    );
    if (!block || block.id === blocks.empty.id || block.instanceId !== null)
      return;

    if (!this.isBlockObscured(x, y, z)) {
      chunk.addBlockInstance(coords.block.x, coords.block.y, coords.block.z);
    }
  }

  hideBlock(x, y, z) {
    const coords = this.worldToChunkCoords(x, y, z);
    const chunk = this.getChunk(coords.chunk.x, coords.chunk.z);

    if (chunk && this.isBlockObscured(x, y, z)) {
      chunk.deleteBlockInstance(coords.block.x, coords.block.y, coords.block.z);
    }
  }
}
