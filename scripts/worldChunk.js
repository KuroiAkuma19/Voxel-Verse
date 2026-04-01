import * as THREE from "three";
import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise.js";
import { RNG } from "./rng.js";
import { blocks, resources } from "./blocks.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

const geometry = new THREE.BoxGeometry(1, 1, 1);
const loader = new GLTFLoader();

export class WorldChunk extends THREE.Group {
  data = [];
  grassMesh = null;
  grassInstances = [];
  grassGeometry = null;
  grassMaterial = null;

  constructor(size, params, dataStore) {
    super();
    this.loaded = false;
    this.size = size;
    this.params = params;
    this.dataStore = dataStore;
    this._matrix = new THREE.Matrix4(); // Reusable matrix
    this.heightMap = new Int16Array(size.width * size.width);
    this.biomeMap = new Array(size.width * size.width);
  }

  async createWorld() {
    try {
      const rng = new RNG(this.params.seed);
      await this.loadGrassModel();

      // Initialize data structure
      this.InitializeTerrain();

      // Generation steps with aggressive yielding
      await this.generateResources(rng);
      await this.generateTerrain(rng);
      await this.generateStructures(rng);
      await this.generateTrees(rng);
      await this.generateVegetation(rng);

      this.generateCloud(rng);
      this.loadPlayerChanges();

      // Optimized Meshing
      await this.generateMeshes();

      this.loaded = true;
    } catch (e) {
      console.error("Chunk generation error:", e);
      this.loaded = true; // Ensures world doesn't stall
    }
  }

  //  HELPER: TIME SLICING 
  // Checks if we've blocked the thread for too long.
  // If > 8ms passed since last check, pause execution.
  async yieldControl(startTime) {
    if (performance.now() - startTime > 8) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      return performance.now();
    }
    return startTime;
  }

  async loadGrassModel() {
    try {
      const gltf = await loader.loadAsync("public/models/grass.glb");
      const geometries = [];
      let mainMaterial = null;
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          const geom = child.geometry.clone();
          child.updateMatrix();
          geom.applyMatrix4(child.matrix);
          geometries.push(geom);
          if (!mainMaterial) mainMaterial = child.material;
        }
      });
      if (geometries.length === 0) return;
      this.grassGeometry = BufferGeometryUtils.mergeGeometries(geometries);
      this.grassGeometry.rotateX(Math.PI / 2);
      this.grassMaterial = mainMaterial;
      if (this.grassMaterial) {
        this.grassMaterial.side = THREE.DoubleSide;
        this.grassMaterial.transparent = true;
        this.grassMaterial.alphaTest = 0.5;
      }
    } catch (error) {
      console.warn("Failed to load grass model", error);
    }
  }

  InitializeTerrain() {
    this.data = [];
    for (let x = 0; x < this.size.width; x++) {
      const slice = [];
      for (let y = 0; y < this.size.height; y++) {
        const row = [];
        for (let z = 0; z < this.size.width; z++) {
          row.push({ id: blocks.empty.id, instanceId: null });
        }
        slice.push(row);
      }
      this.data.push(slice);
    }
  }

  getBiomeByIndex(index) {
    const biomes = [
      "Snowy Plains",
      "Snowy Plains",
      "Snowy Plains",
      "Temperate",
      "Temperate",
      "Temperate",
      "Desert",
      "Desert",
      "Desert",
      "Jungle",
      "Jungle",
      "Jungle",
      "Ice Spikes",
      "Snowy Taiga",
      "Windswept Hills",
      "Windswept Gravelly Hills",
      "Windswept Forest",
      "Stony Peaks",
    ];
    return biomes[Math.abs(index) % biomes.length];
  }

  async generateResources(rng) {
    const simplex = new SimplexNoise(rng);
    let t = performance.now();

    // Iterate Resources
    for (const resource of resources) {
      for (let x = 0; x < this.size.width; x++) {
        t = await this.yieldControl(t); 
        for (let y = 0; y < this.size.height; y++) {
          for (let z = 0; z < this.size.width; z++) {
            const value = simplex.noise3d(
              (this.position.x + x) / resource.scale.x,
              (this.position.y + y) / resource.scale.y,
              (this.position.z + z) / resource.scale.z
            );
            if (value > resource.scarcity) {
              this.setBlock(x, y, z, resource.id);
            }
          }
        }
      }
    }
  }

  getBiome(temperature, humidity, terrain) {
    if (temperature < 0.5) {
      if (humidity < 0.5) {
        if (terrain > 0.75) return "Ice Spikes";
        if (humidity > 0.35) return "Snowy Taiga";
        return "Snowy Plains";
      } else {
        if (terrain > 0.75) return "Stony Peaks";
        if (terrain > 0.55) return "Windswept Hills";
        if (humidity < 0.7 && terrain > 0.4) return "Windswept Forest";
        return "Temperate";
      }
    } else {
      if (humidity < 0.5) {
        if (terrain > 0.75) return "Windswept Gravelly Hills";
        return "Desert";
      } else {
        return "Jungle";
      }
    }
  }

  async generateTerrain(rng) {
    const simplex = new SimplexNoise(rng);
    const biomeGridSize = 240;
    const boundaryDistortion = 20;
    const boundaryScale = 30;

    let t = performance.now();

    for (let x = 0; x < this.size.width; x++) {
      t = await this.yieldControl(t); // Check performance every X column

      for (let z = 0; z < this.size.width; z++) {
        const worldX = this.position.x + x;
        const worldZ = this.position.z + z;

        const distortionX =
          simplex.noise(worldX / boundaryScale, worldZ / boundaryScale) *
          boundaryDistortion;
        const distortionZ =
          simplex.noise(worldZ / boundaryScale, worldX / boundaryScale) *
          boundaryDistortion;

        const cellX = Math.floor((worldX + distortionX) / biomeGridSize);
        const cellZ = Math.floor((worldZ + distortionZ) / biomeGridSize);

        const hash = (cellX * 73856093) ^ (cellZ * 19349663);
        const biome = this.getBiomeByIndex(hash);
        this.biomeMap[x + z * this.size.width] = biome;

        const scale = this.params.terrain.scale;
        let noise = simplex.noise(worldX / (scale * 2), worldZ / (scale * 2));
        noise += 0.5 * simplex.noise(worldX / scale, worldZ / scale);
        noise +=
          0.25 * simplex.noise(worldX / (scale / 2), worldZ / (scale / 2));
        noise = (noise / 1.75 + 1) * 0.5;

        let heightValue = Math.pow(noise, 3);
        let heightMultiplier = 1;
        let groundBlock = blocks.grass.id;
        let subBlock = blocks.dirt.id;

        switch (biome) {
          case "Ice Spikes":
            heightMultiplier = 1.0;
            groundBlock = blocks.snow.id;
            break;
          case "Snowy Plains":
            heightMultiplier = 0.8;
            groundBlock = blocks.snowyGrass
              ? blocks.snowyGrass.id
              : blocks.snow.id;
            break;
          case "Snowy Taiga":
            heightMultiplier = 1.1;
            groundBlock = blocks.snow.id;
            subBlock = blocks.dirt.id;
            break;
          case "Stony Peaks":
            heightMultiplier = 1.8;
            heightValue = Math.pow(noise, 2) + 0.1;
            groundBlock = blocks.stone.id;
            subBlock = blocks.andesite ? blocks.andesite.id : blocks.stone.id;
            break;
          case "Windswept Hills":
            heightMultiplier = 1.4;
            groundBlock = blocks.grass.id;
            break;
          case "Windswept Gravelly Hills":
            heightMultiplier = 1.3;
            groundBlock = blocks.gravel ? blocks.gravel.id : blocks.stone.id;
            subBlock = blocks.gravel ? blocks.gravel.id : blocks.stone.id;
            break;
          case "Windswept Forest":
            heightMultiplier = 1.25;
            groundBlock = blocks.grass.id;
            break;
          case "Desert":
            heightMultiplier = 0.6;
            groundBlock = blocks.sand.id;
            subBlock = blocks.sandstone ? blocks.sandstone.id : blocks.stone.id;
            break;
          case "Jungle":
            heightMultiplier = 1.35;
            heightValue = Math.pow(noise, 2.5);
            break;
          default:
            heightMultiplier = 1.0;
            break;
        }

        const maxHeight = this.size.height - 10;
        let height = Math.floor(heightValue * maxHeight * heightMultiplier);
        if (height < this.params.terrain.waterOffset) height -= 3;
        height = Math.max(1, Math.min(height, this.size.height - 1));
        this.heightMap[x + z * this.size.width] = height;

        const stoneThreshold = this.size.height - 20;

        for (let y = 0; y < this.size.height; y++) {
          if (y <= this.params.terrain.waterOffset && y > height) {
            if (y === this.params.terrain.waterOffset) {
              if (
                biome === "Snowy Plains" ||
                biome === "Ice Spikes" ||
                biome === "Snowy Taiga"
              ) {
                this.setBlock(x, y, z, blocks.ice.id);
              } else {
                this.setBlock(x, y, z, blocks.empty.id);
              }
            } else {
              this.setBlock(x, y, z, blocks.empty.id);
            }
            continue;
          }

          if (y === height) {
            const isBeach =
              height >= this.params.terrain.waterOffset - 1 &&
              height <= this.params.terrain.waterOffset + 1;
            if (isBeach) {
              if (
                biome.includes("Snowy") ||
                biome === "Ice Spikes" ||
                biome === "Snowy Plains"
              )
                this.setBlock(x, y, z, blocks.sand.id);
              else if (!biome.includes("Stony") && !biome.includes("Gravelly"))
                this.setBlock(x, y, z, blocks.sand.id);
              else this.setBlock(x, y, z, groundBlock);
            } else if (
              biome !== "Desert" &&
              y > stoneThreshold &&
              !biome.includes("Hills") &&
              !biome.includes("Peaks")
            ) {
              this.setBlock(
                x,
                y,
                z,
                biome.includes("Snowy") || biome === "Ice Spikes"
                  ? blocks.snow.id
                  : blocks.stone.id
              );
            } else {
              if (height < this.params.terrain.waterOffset)
                this.setBlock(x, y, z, blocks.sand.id);
              else this.setBlock(x, y, z, groundBlock);
            }
          } else if (y < height) {
            const current = this.getBlock(x, y, z);
            if (current && current.id !== blocks.empty.id) continue;
            const depth = height - y;
            if (depth < 4) this.setBlock(x, y, z, subBlock);
            else this.setBlock(x, y, z, blocks.stone.id);
          } else if (y > height) {
            this.setBlock(x, y, z, blocks.empty.id);
          }
        }
      }
    }
  }

  async generateStructures(rng) {
    // Only yield once at start of function to keep it snappy
    await this.yieldControl(performance.now());

    const chunkX = Math.round(this.position.x / this.size.width);
    const chunkZ = Math.round(this.position.z / this.size.width);
    const hash = Math.abs(
      (chunkX * 73856093) ^ (chunkZ * 19349663) ^ this.params.seed
    );
    if (hash % 10 !== 0) return;

    const cx = Math.floor(this.size.width / 2);
    const cz = Math.floor(this.size.width / 2);
    const centerIndex = cx + cz * this.size.width;
    const groundHeight = this.heightMap[centerIndex];

    if (groundHeight <= this.params.terrain.waterOffset + 1) return;

    const biome = this.biomeMap[centerIndex];
    if (
      biome === "Ice Spikes" ||
      biome === "Stony Peaks" ||
      biome.includes("Hills")
    )
      return;

    this.buildTower(cx, groundHeight, cz);
    this.generatePath(cx, cz, 16, rng);

    const buildings = [];
    buildings.push({ x: cx, z: cz });

    const attempts = 60;
    const desiredCount = 15;
    let placedCount = 0;

    let t = performance.now();

    for (let i = 0; i < attempts; i++) {
      if (placedCount >= desiredCount) break;
      t = await this.yieldControl(t);

      const ox = Math.floor(rng.random() * 32) - 16;
      const oz = Math.floor(rng.random() * 32) - 16;
      const bx = cx + ox;
      const bz = cz + oz;
      if (
        bx < 4 ||
        bx > this.size.width - 4 ||
        bz < 4 ||
        bz > this.size.width - 4
      )
        continue;

      let overlap = false;
      for (const b of buildings) {
        const dist = Math.sqrt(Math.pow(bx - b.x, 2) + Math.pow(bz - b.z, 2));
        if (dist < 7) {
          overlap = true;
          break;
        }
      }
      if (overlap) continue;

      const index = bx + bz * this.size.width;
      const h = this.heightMap[index];
      if (Math.abs(h - groundHeight) > 8) continue;

      this.buildHouse(bx, h, bz, rng);
      buildings.push({ x: bx, z: bz });
      placedCount++;
    }
  }


  buildHouse(x, y, z, rng) {
    const type = Math.floor(rng.random() * 4);
    switch (type) {
      case 0:
        this.buildCottage(x, y, z, rng);
        break;
      case 1:
        this.buildTallHouse(x, y, z, rng);
        break;
      case 2:
        this.buildManor(x, y, z, rng);
        break;
      case 3:
        this.buildBlacksmith(x, y, z, rng);
        break;
    }
  }
  getSafeId(name, fallbackName) {
    if (blocks[name]) return blocks[name].id;
    if (blocks[fallbackName]) return blocks[fallbackName].id;
    return blocks.dirt.id;
  }
  buildCottage(x, y, z, rng) {
    const width = 5;
    const depth = 5;
    const height = 4;
    const cobble = this.getSafeId("cobblestone", "stone");
    const wallMaterial = blocks.tree.id;
    const glass = this.getSafeId("glass", "empty");
    this.buildFoundation(x, y, z, width, depth, cobble);
    this.buildWalls(x, y, z, width, depth, height, wallMaterial);
    this.buildPyramidRoof(x, y + height + 1, z, width, depth, blocks.dirt.id);
    this.setBlock(x + 2, y + 1, z, blocks.empty.id);
    this.setBlock(x + 2, y + 2, z, blocks.empty.id);
    this.setBlock(x, y + 2, z + 2, glass);
    this.setBlock(x + 4, y + 2, z + 2, glass);
  }
  buildTallHouse(x, y, z, rng) {
    const width = 4;
    const depth = 4;
    const height = 6;
    const stone = blocks.stone.id;
    const wallMaterial = blocks.tree.id;
    const glass = this.getSafeId("glass", "empty");
    this.buildFoundation(x, y, z, width, depth, stone);
    this.buildWalls(x, y, z, width, depth, height, wallMaterial);
    for (let i = 0; i < width; i++)
      for (let k = 0; k < depth; k++)
        if (i === 0 || i === width - 1 || k === 0 || k === depth - 1)
          this.setBlock(x + i, y + 3, z + k, blocks.tree.id);
    this.buildPyramidRoof(x, y + height + 1, z, width, depth, blocks.dirt.id);
    this.setBlock(x + 1, y + 1, z, blocks.empty.id);
    this.setBlock(x + 1, y + 2, z, blocks.empty.id);
    this.setBlock(x + 1, y + 5, z, glass);
  }
  buildManor(x, y, z, rng) {
    const width = 6;
    const depth = 6;
    const height = 4;
    const cobble = this.getSafeId("cobblestone", "stone");
    const wallMaterial = blocks.tree.id;
    const glass = this.getSafeId("glass", "empty");
    this.buildFoundation(x, y, z, width, depth, cobble);
    this.buildWalls(x, y, z, width, depth, height, wallMaterial);
    const log = blocks.tree.id;
    for (let j = 0; j <= height; j++) {
      this.setBlock(x, y + j, z, log);
      this.setBlock(x + width - 1, y + j, z, log);
      this.setBlock(x, y + j, z + depth - 1, log);
      this.setBlock(x + width - 1, y + j, z + depth - 1, log);
    }
    this.buildPyramidRoof(x, y + height + 1, z, width, depth, blocks.dirt.id);
    this.setBlock(x + 2, y + 1, z, blocks.empty.id);
    this.setBlock(x + 2, y + 2, z, blocks.empty.id);
    this.setBlock(x + 3, y + 1, z, blocks.empty.id);
    this.setBlock(x + 3, y + 2, z, blocks.empty.id);
    this.setBlock(x, y + 2, z + 2, glass);
    this.setBlock(x + width - 1, y + 2, z + 3, glass);
  }
  buildBlacksmith(x, y, z, rng) {
    const width = 5;
    const depth = 4;
    const height = 3;
    const cobble = this.getSafeId("cobblestone", "stone");
    this.buildFoundation(x, y, z, width, depth, cobble);
    const mat = blocks.tree.id;
    for (let j = 1; j <= height; j++) {
      this.setBlock(x, y + j, z, mat);
      this.setBlock(x + width - 1, y + j, z, mat);
      this.setBlock(x, y + j, z + depth - 1, mat);
      this.setBlock(x + width - 1, y + j, z + depth - 1, mat);
    }
    for (let i = 0; i < width; i++)
      for (let k = 0; k < depth; k++)
        this.setBlock(x + i, y + height + 1, z + k, blocks.stone.id);
    this.setBlock(x + 2, y + 1, z + depth - 2, blocks.stone.id);
    this.setBlock(x + 2, y + 2, z + depth - 2, blocks.stone.id);
  }
  buildFoundation(x, y, z, w, d, blockId) {
    for (let i = -1; i <= w; i++) {
      for (let k = -1; k <= d; k++) {
        for (let j = y - 1; j > y - 5; j--) {
          if (this.getBlock(x + i, j, z + k)?.id === blocks.empty.id) {
            this.setBlock(x + i, j, z + k, blockId);
          }
        }
        this.setBlock(x + i, y, z + k, blockId);
        for (let j = 1; j < 5; j++)
          this.setBlock(x + i, y + j, z + k, blocks.empty.id);
      }
    }
  }
  buildWalls(x, y, z, w, d, h, blockId) {
    for (let j = 1; j <= h; j++) {
      for (let i = 0; i < w; i++) {
        this.setBlock(x + i, y + j, z, blockId);
        this.setBlock(x + i, y + j, z + d - 1, blockId);
      }
      for (let k = 0; k < d; k++) {
        this.setBlock(x, y + j, z + k, blockId);
        this.setBlock(x + w - 1, y + j, z + k, blockId);
      }
    }
  }
  buildPyramidRoof(x, y, z, w, d, blockId) {
    let roofH = 0;
    for (let r = -1; r <= Math.ceil(w / 2); r++) {
      for (let i = r; i < w - r; i++) {
        for (let k = r; k < d - r; k++) {
          this.setBlock(x + i, y + roofH, z + k, blockId);
        }
      }
      roofH++;
    }
  }
  buildTower(x, y, z) {
    const h = 14;
    const mat = this.getSafeId("cobblestone", "stone");
    for (let j = 0; j < h; j++) {
      this.setBlock(x, y + j, z, mat);
      this.setBlock(x + 2, y + j, z, mat);
      this.setBlock(x, y + j, z + 2, mat);
      this.setBlock(x + 2, y + j, z + 2, mat);
      if (j % 4 !== 1) {
        this.setBlock(x + 1, y + j, z, mat);
        this.setBlock(x + 1, y + j, z + 2, mat);
        this.setBlock(x, y + j, z + 1, mat);
        this.setBlock(x + 2, y + j, z + 1, mat);
      } else {
        for (let i = 0; i <= 2; i++)
          for (let k = 0; k <= 2; k++) this.setBlock(x + i, y + j, z + k, mat);
      }
    }
    this.setBlock(x, y + h, z, mat);
    this.setBlock(x + 2, y + h, z, mat);
    this.setBlock(x, y + h, z + 2, mat);
    this.setBlock(x + 2, y + h, z + 2, mat);
  }
  generatePath(cx, cz, len, rng) {
    const pathBlock = blocks.dirt.id;
    for (let i = -len; i <= len; i++) {
      this.placePathBlock(cx + i, cz, pathBlock);
      this.placePathBlock(cx, cz + i, pathBlock);
      if (rng.random() > 0.6) this.placePathBlock(cx + i, cz + 1, pathBlock);
      if (rng.random() > 0.6) this.placePathBlock(cx + 1, cz + i, pathBlock);
      const radius = 10;
      const ringX = Math.round(cx + Math.sin(i) * radius);
      const ringZ = Math.round(cz + Math.cos(i) * radius);
      if (rng.random() > 0.3) {
        this.placePathBlock(ringX, ringZ, pathBlock);
      }
    }
  }
  placePathBlock(x, z, blockId) {
    if (x < 0 || x >= this.size.width || z < 0 || z >= this.size.width) return;
    const h = this.heightMap[x + z * this.size.width];
    if (h <= this.params.terrain.waterOffset) return;
    this.setBlock(x, h, z, blockId);
  }

  async generateTrees(rng) {
    let t = performance.now();

    // --- HELPER: SET BLOCK WITH YIELD ---
    // Creating closures for trees is fast, but placing thousands is slow
    const generateOak = (x, y, z) => {
      const h = Math.floor(4 + rng.random() * 5);
      for (let i = 1; i <= h; i++) this.setBlock(x, y + i, z, blocks.tree.id);
      for (let lx = -2; lx <= 2; lx++)
        for (let ly = h - 1; ly <= h + 1; ly++)
          for (let lz = -2; lz <= 2; lz++) {
            if (Math.abs(lx) + Math.abs(ly - h) + Math.abs(lz) <= 3) {
              if (this.getBlock(x + lx, y + ly, z + lz)?.id === blocks.empty.id)
                this.setBlock(x + lx, y + ly, z + lz, blocks.leaves.id);
            }
          }
    };

    const generateCherryTree = (x, y, z) => {
      const h = Math.floor(4 + rng.random() * 4);
      for (let i = 1; i <= h; i++) this.setBlock(x, y + i, z, blocks.tree.id);
      for (let lx = -2; lx <= 2; lx++)
        for (let ly = h - 1; ly <= h + 2; ly++)
          for (let lz = -2; lz <= 2; lz++) {
            if (Math.abs(lx) + Math.abs(ly - h) + Math.abs(lz) <= 2.5) {
              if (this.getBlock(x + lx, y + ly, z + lz)?.id === blocks.empty.id)
                this.setBlock(x + lx, y + ly, z + lz, blocks.leaves.id);
            }
          }
    };

    const generateAcaciaTree = (x, y, z) => {
      const h = Math.floor(5 + rng.random() * 5);
      const log = blocks.tree.id;
      const leaf = blocks.acaciaLeaves
        ? blocks.acaciaLeaves.id
        : blocks.leaves.id;
      for (let i = 1; i <= h - 2; i++) this.setBlock(x, y + i, z, log);
      this.setBlock(x + 1, y + h - 1, z, log);
      this.setBlock(x + 2, y + h, z, log);
      this.setBlock(x - 1, y + h - 1, z, log);
      this.setBlock(x - 2, y + h, z, log);
      const drawCanopy = (cx, cy, cz) => {
        for (let lx = -2; lx <= 2; lx++)
          for (let lz = -2; lz <= 2; lz++)
            if (Math.abs(lx) + Math.abs(lz) <= 2)
              this.setBlock(cx + lx, cy, cz + lz, leaf);
        this.setBlock(cx, cy + 1, cz, leaf);
      };
      drawCanopy(x + 2, y + h + 1, z);
      drawCanopy(x - 2, y + h + 1, z);
    };

    const generateVariedDeadTree = (x, y, z) => {
      const type = Math.floor(rng.random() * 4);
      const log = blocks.tree.id;
      if (type === 0) {
        // Classic
        const h = Math.floor(3 + rng.random() * 4);
        for (let i = 1; i <= h; i++) this.setBlock(x, y + i, z, log);
        if (rng.random() > 0.5) this.setBlock(x + 1, y + h - 1, z, log);
        if (rng.random() > 0.5) this.setBlock(x - 1, y + h - 2, z, log);
        if (rng.random() > 0.5) this.setBlock(x, y + h - 1, z + 1, log);
      } else if (type === 1) {
        // Forked
        const h = Math.floor(2 + rng.random() * 2);
        for (let i = 1; i <= h; i++) this.setBlock(x, y + i, z, log);
        this.setBlock(x + 1, y + h + 1, z, log);
        this.setBlock(x + 2, y + h + 2, z, log);
        this.setBlock(x - 1, y + h + 1, z, log);
        this.setBlock(x - 2, y + h + 2, z, log);
      } else if (type === 2) {
        // Fallen
        const length = Math.floor(3 + rng.random() * 3);
        const dirX = rng.random() > 0.5 ? 1 : 0;
        const dirZ = dirX === 1 ? 0 : 1;
        for (let i = 0; i < length; i++)
          this.setBlock(x + i * dirX, y + 1, z + i * dirZ, log);
      } else {
        // Stump
        this.setBlock(x, y + 1, z, log);
        this.setBlock(x, y + 2, z, log);
        if (rng.random() > 0.5) this.setBlock(x + 1, y + 1, z, log);
        if (rng.random() > 0.5) this.setBlock(x - 1, y + 1, z, log);
        if (rng.random() > 0.5) this.setBlock(x, y + 1, z + 1, log);
        if (rng.random() > 0.5) this.setBlock(x, y + 1, z - 1, log);
      }
    };

    const generateJungleTree = (x, y, z) => {
      const h = Math.floor(8 + rng.random() * 8);
      const log = blocks.jungleTree.id;
      const leaf = blocks.jungeleleaves.id;
      for (let i = 1; i <= h; i++) this.setBlock(x, y + i, z, log);
      for (let lx = -2; lx <= 2; lx++)
        for (let lz = -2; lz <= 2; lz++) {
          if (Math.abs(lx) + Math.abs(lz) <= 3)
            this.setBlock(x + lx, y + h, z + lz, leaf);
        }
      this.setBlock(x, y + h + 1, z, leaf);
    };

    const generateSnowySpruce = (x, y, z) => {
      this.setBlock(x, y, z, blocks.snow.id);
      const h = Math.floor(7 + rng.random() * 6);
      const log = blocks.spruceLog.id;
      const snowyLeaf = blocks.spruceLeavesOpaque
        ? blocks.spruceLeavesOpaque.id
        : blocks.spruceLeaves.id;
      for (let i = 1; i <= h; i++) this.setBlock(x, y + i, z, log);
      this.setBlock(x, y + h + 1, z, snowyLeaf);
      for (let i = h; i >= 3; i -= 2) {
        const radius = Math.floor((h - i) / 3) + 1;
        for (let lx = -radius; lx <= radius; lx++) {
          for (let lz = -radius; lz <= radius; lz++) {
            if (
              Math.abs(lx) + Math.abs(lz) <= radius &&
              (lx !== 0 || lz !== 0)
            ) {
              if (this.getBlock(x + lx, y + i, z + lz)?.id === blocks.empty.id)
                this.setBlock(x + lx, y + i, z + lz, snowyLeaf);
            }
          }
        }
      }
    };

    // --- NEW REALISTIC ICE SPIKE GENERATION ---
    const generateIceSpike = (x, y, z) => {
      const packedIce = blocks.packedIce ? blocks.packedIce.id : blocks.ice.id;
      const blueIce = blocks.blueIce ? blocks.blueIce.id : blocks.ice.id;

      // Decide spike type: Tall/Thin vs. Short/Stout
      const isTallSpike = rng.random() > 0.6; // 40% chance for a tall spike

      let height, baseRadius, taperPower;

      if (isTallSpike) {
        // Tall and thin
        height = Math.floor(20 + rng.random() * 15); // 20-35 blocks high
        baseRadius = Math.floor(1 + rng.random() * 1.5); // Radius 1-2
        taperPower = 0.7; // Tapers quickly to be very thin
      } else {
        // Shorter and stouter
        height = Math.floor(8 + rng.random() * 10); // 8-18 blocks high
        baseRadius = Math.floor(2 + rng.random() * 2); // Radius 2-3
        taperPower = 1.5; // Convex taper, stays thicker for longer
      }

      for (let i = 0; i < height; i++) {
        // Calculate the fraction of height completed (0.0 at bottom, 1.0 at top)
        const heightFraction = i / height;

        // Use the taper power to calculate the current radius with a curve
        // 1 - heightFraction gives us a value from 1.0 (bottom) to 0.0 (top)
        let currentRadius =
          baseRadius * Math.pow(1 - heightFraction, taperPower);

        // Ensure the top is always at least 1 block thick until the very end
        if (i < height - 1) {
          currentRadius = Math.max(0.5, currentRadius);
        }

        for (
          let lx = -Math.ceil(currentRadius);
          lx <= Math.ceil(currentRadius);
          lx++
        ) {
          for (
            let lz = -Math.ceil(currentRadius);
            lz <= Math.ceil(currentRadius);
            lz++
          ) {
            // Distance check for a circle, adding 0.5 for smoother edges
            if (lx * lx + lz * lz <= currentRadius * currentRadius + 0.5) {
              // Blue ice core logic: higher chance in the center and lower down
              const centerDist = Math.sqrt(lx * lx + lz * lz);
              // Chance decreases as you go up and as you move away from the center
              const blueIceChance =
                0.4 *
                (1 - heightFraction) *
                (1 - centerDist / (baseRadius + 0.1));

              const block = rng.random() < blueIceChance ? blueIce : packedIce;
              this.setBlock(x + lx, y + i, z + lz, block);
            }
          }
        }
      }
    };

    const generateShrub = (x, y, z) => {
      const h = 1 + Math.floor(rng.random() * 2);
      for (let i = 1; i <= h; i++) this.setBlock(x, y + i, z, blocks.tree.id);
      const leaf = blocks.leaves.id;
      this.setBlock(x, y + h + 1, z, leaf);
      this.setBlock(x + 1, y + h, z, leaf);
      this.setBlock(x - 1, y + h, z, leaf);
      this.setBlock(x, y + h, z + 1, leaf);
      this.setBlock(x, y + h, z - 1, leaf);
    };

    for (let x = 2; x < this.size.width - 2; x++) {
      t = await this.yieldControl(t);

      for (let z = 2; z < this.size.width - 2; z++) {
        const index = x + z * this.size.width;
        const biome = this.biomeMap[index];
        const height = this.heightMap[index];

        if (height <= this.params.terrain.waterOffset) continue;

        const ground = this.getBlock(x, height, z);
        if (
          !ground ||
          ground.id === blocks.empty.id ||
          ground.id === blocks.water?.id
        )
          continue;
        if (this.getBlock(x, height + 1, z)?.id !== blocks.empty.id) continue;

        let density = 0;
        let treeType = "oak";

        switch (biome) {
          case "Snowy Plains":
            density = 0.001;
            treeType = "oak";
            break;
          case "Ice Spikes":
            density = 0.015;
            treeType = "spike";
            break;
          case "Snowy Taiga":
            density = 0.02;
            treeType = "snowy_spruce";
            break;
          case "Windswept Hills":
            density = 0.005;
            treeType = "acacia";
            break;
          case "Windswept Gravelly Hills":
            density = 0.003;
            treeType = "varied_dead";
            break;
          case "Stony Peaks":
            density = 0.004;
            treeType = "varied_dead";
            break;
          case "Windswept Forest":
            density = 0.02;
            treeType = "cherry";
            break;
          case "Jungle":
            density = 0.08;
            treeType = "jungle";
            break;
          case "Temperate":
            density = 0.008;
            treeType = "oak";
            break;
          case "Desert":
            density = 0.0;
            break;
        }

        if (density > 0 && rng.random() < density) {
          if (treeType === "spike") generateIceSpike(x, height + 1, z);
          else if (treeType === "snowy_spruce") {
            if (
              [
                blocks.dirt.id,
                blocks.grass.id,
                blocks.snow.id,
                blocks.podzol?.id,
              ].includes(ground.id)
            )
              generateSnowySpruce(x, height, z);
          } else if (treeType === "cherry") generateCherryTree(x, height, z);
          else if (treeType === "acacia") generateAcaciaTree(x, height, z);
          else if (treeType === "varied_dead")
            generateVariedDeadTree(x, height, z);
          else if (treeType === "jungle") generateJungleTree(x, height, z);
          else if (treeType === "shrub") generateShrub(x, height, z);
          else if (treeType === "oak") {
            if (
              [blocks.grass.id, blocks.dirt.id, blocks.snowyGrass?.id].includes(
                ground.id
              )
            )
              generateOak(x, height, z);
          }
        }
      }
    }
  }

  async generateVegetation(rng) {
    let t = performance.now();
    this.grassInstances = [];

    for (let x = 0; x < this.size.width; x++) {
      t = await this.yieldControl(t);
      for (let z = 0; z < this.size.width; z++) {
        const height = this.heightMap[x + z * this.size.width];
        if (height <= this.params.terrain.waterOffset) continue;
        const y = height + 1;
        if (this.getBlock(x, y, z)?.id !== blocks.empty.id) continue;

        const ground = this.getBlock(x, height, z);
        const biome = this.biomeMap[x + z * this.size.width];

        if (
          ground &&
          ground.id === blocks.grass.id &&
          (biome === "Temperate" || biome === "Windswept Forest") &&
          rng.random() < 0.05
        ) {
          this.grassInstances.push({ x, y, z });
        }
        if (
          (biome === "Snowy Taiga" || biome === "Desert") &&
          rng.random() < 0.02
        ) {
          if (blocks.deadBush) this.setBlock(x, y, z, blocks.deadBush.id);
        }
        if (biome === "Desert" && rng.random() < 0.005) {
          if (blocks.cactus) {
            this.setBlock(x, y, z, blocks.cactus.id);
            this.setBlock(x, y + 1, z, blocks.cactus.id);
            this.setBlock(x, y + 2, z, blocks.cactus.id);
          }
        }
      }
    }
  }

  generateGrassInstancedMesh() {
    if (
      !this.grassGeometry ||
      !this.grassMaterial ||
      this.grassInstances.length === 0
    )
      return;
    const mesh = new THREE.InstancedMesh(
      this.grassGeometry,
      this.grassMaterial,
      this.grassInstances.length
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.grassInstances.length; i++) {
      const pos = this.grassInstances[i];
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.scale.set(0.5, 0.5, 0.5);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.add(mesh);
    this.grassMesh = mesh;
  }

  generateCloud(rng) {
    const simplex = new SimplexNoise(rng);
    if (this.params.clouds.density <= 0) return;
    for (let x = 0; x < this.size.width; x++) {
      for (let z = 0; z < this.size.width; z++) {
        const val =
          (simplex.noise(
            (this.position.x + x) / 30,
            (this.position.z + z) / 30
          ) +
            1) *
          0.5;
        if (val < this.params.clouds.density)
          this.setBlock(x, this.size.height - 1, z, blocks.cloud.id);
      }
    }
  }

  loadPlayerChanges() {
    for (let x = 0; x < this.size.width; x++) {
      for (let y = 0; y < this.size.height; y++) {
        for (let z = 0; z < this.size.width; z++) {
          if (
            this.dataStore.contains(this.userData.x, this.userData.z, x, y, z)
          ) {
            const blockId = this.dataStore.get(
              this.userData.x,
              this.userData.z,
              x,
              y,
              z
            );
            this.setBlock(x, y, z, blockId);
          }
        }
      }
    }
  }

  generateWater() {
    const material = new THREE.MeshLambertMaterial({
      color: 0x9090e0,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(), material);
    waterMesh.rotateX(-Math.PI / 2.0);
    waterMesh.position.set(
      this.size.width / 2,
      this.params.terrain.waterOffset + 0.4,
      this.size.width / 2
    );
    waterMesh.scale.set(this.size.width, this.size.width, 1);
    waterMesh.layers.set(1);
    this.add(waterMesh);
  }

  // --- OPTIMIZED MESHING: REDUCE VRAM USAGE ---
  async generateMeshes() {
    this.clear();
    this.generateWater();
    this.generateGrassInstancedMesh();

    let t = performance.now();

    // 1. First Pass: Count visible blocks per ID
    // This prevents creating massive arrays for blocks that don't exist
    const counts = {};
    for (let x = 0; x < this.size.width; x++) {
      t = await this.yieldControl(t);
      for (let y = 0; y < this.size.height; y++) {
        for (let z = 0; z < this.size.width; z++) {
          const block = this.getBlock(x, y, z);
          if (
            block &&
            block.id !== blocks.empty.id &&
            !this.isBlockObscured(x, y, z)
          ) {
            counts[block.id] = (counts[block.id] || 0) + 1;
          }
        }
      }
    }

    // 2. Initialize meshes with EXACT counts
    const meshes = {};
    Object.keys(counts).forEach((blockId) => {
      const b = Object.values(blocks).find((bl) => bl.id == blockId);
      if (b) {
        const mesh = new THREE.InstancedMesh(
          geometry,
          b.material,
          counts[blockId]
        );
        mesh.userData.blockId = b.id;
        mesh.count = 0; // Reset count to fill it
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshes[b.id] = mesh;
      }
    });

    // 3. Second Pass: Fill Matrices
    for (let x = 0; x < this.size.width; x++) {
      t = await this.yieldControl(t);
      for (let y = 0; y < this.size.height; y++) {
        for (let z = 0; z < this.size.width; z++) {
          const block = this.getBlock(x, y, z);
          if (
            block &&
            block.id !== blocks.empty.id &&
            !this.isBlockObscured(x, y, z)
          ) {
            const mesh = meshes[block.id];
            if (mesh) {
              const id = mesh.count;
              this._matrix.identity().setPosition(x, y, z);
              mesh.setMatrixAt(id, this._matrix);
              this.setBlockInstanceId(x, y, z, id);
              mesh.count++;
            }
          }
        }
      }
    }

    // 4. Add to scene
    Object.values(meshes).forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      this.add(m);
    });
  }

  addBlock(x, y, z, blockId) {
    if (this.getBlock(x, y, z).id === blocks.empty.id) {
      this.setBlock(x, y, z, blockId);
      this.dataStore.set(this.userData.x, this.userData.z, x, y, z, blockId);
      this.generateMeshes();
    }
  }
  removeBlock(x, y, z) {
    const block = this.getBlock(x, y, z);
    if (block && block.id !== blocks.empty.id) {
      this.setBlock(x, y, z, blocks.empty.id);
      this.dataStore.set(
        this.userData.x,
        this.userData.z,
        x,
        y,
        z,
        blocks.empty.id
      );
      this.generateMeshes();
    }
  }
  isBlockObscured(x, y, z) {
    const up = this.getBlock(x, y + 1, z)?.id ?? 0;
    const down = this.getBlock(x, y - 1, z)?.id ?? 0;
    const left = this.getBlock(x + 1, y, z)?.id ?? 0;
    const right = this.getBlock(x - 1, y, z)?.id ?? 0;
    const forward = this.getBlock(x, y, z + 1)?.id ?? 0;
    const back = this.getBlock(x, y, z - 1)?.id ?? 0;
    if (
      up === 0 ||
      down === 0 ||
      left === 0 ||
      right === 0 ||
      forward === 0 ||
      back === 0
    )
      return false;
    return true;
  }
  getBlock(x, y, z) {
    if (this.inBounds(x, y, z)) return this.data[x][y][z];
    return null;
  }
  setBlock(x, y, z, id) {
    if (this.inBounds(x, y, z)) this.data[x][y][z].id = id;
  }
  setBlockInstanceId(x, y, z, instanceId) {
    if (this.inBounds(x, y, z)) this.data[x][y][z].instanceId = instanceId;
  }
  inBounds(x, y, z) {
    return (
      x >= 0 &&
      x < this.size.width &&
      y >= 0 &&
      y < this.size.height &&
      z >= 0 &&
      z < this.size.width
    );
  }
  updateMesh() {
    this.generateMeshes();
  }
  disposeInstances() {
    this.traverse((obj) => {
      if (obj.dispose) obj.dispose();
    });
    this.clear();
  }
}
