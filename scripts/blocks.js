import * as THREE from "three";

const textureLoader = new THREE.TextureLoader();

function createProceduralTexture(type, mainColorHex, accentColorHex) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = mainColorHex;
  ctx.fillRect(0, 0, size, size);

  const noise = (density, color) => {
    ctx.fillStyle = color;
    for (let i = 0; i < size * size * density; i++) {
      const x = Math.floor(Math.random() * size);
      const y = Math.floor(Math.random() * size);
      ctx.fillRect(x, y, 1, 1);
    }
  };

  switch (type) {
    case "noise":
      noise(0.1, accentColorHex);
      break;
    case "pillar":
      ctx.fillStyle = accentColorHex;
      for (let x = 0; x < size; x += 8) ctx.fillRect(x, 0, 2, size);
      noise(0.05, accentColorHex);
      break;
    case "cactus":
      ctx.fillStyle = accentColorHex;
      for (let x = 4; x < size; x += 16) ctx.fillRect(x, 0, 4, size);
      ctx.fillStyle = "#dddddd";
      for (let i = 0; i < 40; i++) {
        const x = Math.floor(Math.random() * size);
        const y = Math.floor(Math.random() * size);
        if (x % 16 > 4 && x % 16 < 8) ctx.fillRect(x, y, 2, 1);
      }
      break;
    case "rings":
      ctx.strokeStyle = accentColorHex;
      ctx.lineWidth = 2;
      for (let r = 4; r < size / 2; r += 6) {
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case "layers":
      ctx.fillStyle = accentColorHex;
      ctx.fillRect(0, size - 10, size, 2);
      ctx.fillRect(0, size - 25, size, 2);
      noise(0.05, accentColorHex);
      break;
    case "shrub":
      ctx.clearRect(0, 0, size, size);
      ctx.strokeStyle = mainColorHex;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(size / 2, size);
      ctx.lineTo(size / 2, size / 2);
      ctx.moveTo(size / 2, size / 2);
      ctx.lineTo(size / 4, size / 4);
      ctx.moveTo(size / 2, size / 2);
      ctx.lineTo(size * 0.75, size / 4);
      ctx.moveTo(size / 2, size * 0.7);
      ctx.lineTo(size * 0.8, size * 0.6);
      ctx.stroke();
      break;
    case "bricks":
      ctx.fillStyle = accentColorHex;
      for (let y = 0; y < size; y += 16) {
        ctx.fillRect(0, y, size, 2);
        for (let x = y % 32 === 0 ? 0 : 32; x < size; x += 32)
          ctx.fillRect(x, y, 2, 16);
      }
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

function loadTexture(
  path,
  fallbackType = "noise",
  col1 = "#ff00ff",
  col2 = "#000000"
) {
  const texture = textureLoader.load(
    path,
    () => {},
    undefined,
    () => {
      const procedural = createProceduralTexture(fallbackType, col1, col2);
      texture.image = procedural.image;
      texture.needsUpdate = true;
    }
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

const textures = {
  // --- EXISTING TEXTURES ---
  grass: loadTexture("/textures/grass.png", "noise", "#6dbf4b", "#5a9e3d"),
  dirt: loadTexture("/textures/dirt.png", "noise", "#8b5a2b", "#6d4520"),
  stone: loadTexture("/textures/stone.png", "noise", "#909090", "#707070"),
  coalOre: loadTexture("/textures/coal_ore.png", "noise", "#909090", "#000000"),
  ironOre: loadTexture("/textures/iron_ore.png", "noise", "#909090", "#d6a874"),

  // CRAFTING TABLE
  crafting_table_side: loadTexture(
    "/textures/crafting_table_side.png",
    "pillar",
    "#3b291d",
    "#261911"
  ),
  crafting_table_top: loadTexture(
    "/textures/crafting_table_top.png",
    "rings",
    "#5e4835",
    "#3b291d"
  ),
  crafting_table_front: loadTexture(
    "/textures/crafting_table_front.png",
    "pillar",
    "#3b291d",
    "#261911"
  ),

  // NEW BUILDING TEXTURES (Procedural fallbacks)
  door_top: createProceduralTexture("pillar", "#5e4835", "#3b291d"),
  door_bottom: createProceduralTexture("pillar", "#5e4835", "#3b291d"),
  stone_bricks: createProceduralTexture("bricks", "#757575", "#505050"),

  grass_side_snowed: loadTexture(
    "/textures/grass_side_snowed.png",
    "layers",
    "#ffffff",
    "#8b5a2b"
  ),
  leaves_acacia: loadTexture(
    "/textures/acacia_leaves.png",
    "noise",
    "#5e5e5e",
    "#303030"
  ),
  ice: loadTexture("/textures/ice.png", "noise", "#a0e0ff", "#d0f0ff"),
  leaves_spurce_opaque: loadTexture(
    "/textures/spruce_leaves_opaque.png",
    "noise",
    "#2d4c2d",
    "#1a2e1a"
  ),
  mangrove_leaves: loadTexture(
    "/textures/mangrove_leaves.png",
    "noise",
    "#4a6b2f",
    "#2d451a"
  ),
  grassSide: loadTexture(
    "/textures/grass_side_1.png",
    "layers",
    "#8b5a2b",
    "#6dbf4b"
  ),
  leaves: loadTexture(
    "/textures/cherry_leaves.png",
    "noise",
    "#e85d9e",
    "#c43e7b"
  ),
  treeSide: loadTexture(
    "/textures/tree_side.png",
    "pillar",
    "#7c5c40",
    "#59402b"
  ),
  treeTop: loadTexture("/textures/tree_top.png", "rings", "#bfa383", "#7c5c40"),
  sand: loadTexture("/textures/sand.png", "noise", "#e8dcb3", "#d6c28e"),
  tall_grass: loadTexture(
    "/textures/tall_dry_grass.png",
    "shrub",
    "#6dbf4b",
    "#6dbf4b"
  ),
  snow: loadTexture("/textures/snow.png", "noise", "#ffffff", "#e0e0e0"),
  jungle_tree_side: loadTexture(
    "/textures/jungle_tree_side.jpg",
    "pillar",
    "#584630",
    "#3b2e1e"
  ),
  jungle_tree_top: loadTexture(
    "/textures/jungle_tree_top.jpg",
    "rings",
    "#9c7c56",
    "#584630"
  ),

  cactusSide: createProceduralTexture("cactus", "#527d26", "#3e611b"),
  cactusTop: createProceduralTexture("rings", "#527d26", "#3e611b"),
  spruceLogSide: createProceduralTexture("pillar", "#3b291d", "#261911"),
  spruceLogTop: createProceduralTexture("rings", "#5e4835", "#3b291d"),
  spruceLeaves: createProceduralTexture("noise", "#2d4c2d", "#1a2e1a"),
  sandstoneSide: createProceduralTexture("layers", "#e8dcb3", "#d6c28e"),
  sandstoneTop: createProceduralTexture("noise", "#e8dcb3", "#d6c28e"),
  deadBush: createProceduralTexture("shrub", "#6b5030", "#6b5030"),
  plank: createProceduralTexture("bricks", "#a07449", "#805836"),
  cobblestone: createProceduralTexture("noise", "#606060", "#404040"),
  glass: createProceduralTexture("noise", "#e0f0ff", "#ffffff"),
  gravel: loadTexture("/textures/gravel.png", "noise", "#7f7f7f", "#5e5e5e"),
  coarse_dirt: loadTexture(
    "/textures/coarse_dirt.png",
    "noise",
    "#77553b",
    "#5c422d"
  ),
  andesite: loadTexture(
    "/textures/stone_andesite.png",
    "noise",
    "#878787",
    "#737373"
  ),
  suspicious_gravel: loadTexture(
    "/textures/suspicious_gravel_0.png",
    "noise",
    "#857d75",
    "#68625c"
  ),
  podzol_top: loadTexture(
    "/textures/dirt_podzol_top.png",
    "noise",
    "#5c402a",
    "#4a3322"
  ),
  podzol_side: loadTexture(
    "/textures/dirt_podzol_side.png",
    "layers",
    "#5c402a",
    "#77553b"
  ),
  packed_ice: loadTexture(
    "/textures/ice_packed.png",
    "noise",
    "#a0c0ff",
    "#ffffff"
  ),
  blue_ice: loadTexture(
    "/textures/blue_ice.png",
    "noise",
    "#4060ff",
    "#a0c0ff"
  ),
  spruce_log_file: loadTexture(
    "/textures/log_spruce.png",
    "pillar",
    "#3b291d",
    "#261911"
  ),

  moss: createProceduralTexture("noise", "#647D33", "#455E24"),
  glowstone: createProceduralTexture("noise", "#ffcc66", "#eebb00"),
};

export const blocks = {
  // 0 - 26 (Originals)
  empty: { id: 0, name: "Empty" },
  grass: {
    id: 1,
    name: "Grass",
    color: 0x6dbf4b,
    material: [
      new THREE.MeshLambertMaterial({ map: textures.grassSide }),
      new THREE.MeshLambertMaterial({ map: textures.dirt }),
      new THREE.MeshLambertMaterial({ map: textures.grass }),
      new THREE.MeshLambertMaterial({ map: textures.dirt }),
      new THREE.MeshLambertMaterial({ map: textures.dirt }),
      new THREE.MeshLambertMaterial({ map: textures.dirt }),
    ],
  },
  dirt: {
    id: 2,
    name: "Dirt",
    color: 0x8b5a2b,
    material: new THREE.MeshLambertMaterial({ map: textures.dirt }),
  },
  stone: {
    id: 3,
    name: "Stone",
    color: 0x909090,
    scale: { x: 30, y: 30, z: 30 },
    scarcity: 0.5,
    material: new THREE.MeshLambertMaterial({ map: textures.stone }),
  },
  coalOre: {
    id: 4,
    name: "Coal Ore",
    color: 0x3a3a3a,
    scale: { x: 20, y: 20, z: 20 },
    scarcity: 0.8,
    material: new THREE.MeshLambertMaterial({ map: textures.coalOre }),
  },
  ironOre: {
    id: 5,
    name: "Iron Ore",
    color: 0xb87333,
    scale: { x: 60, y: 60, z: 60 },
    scarcity: 0.82,
    material: new THREE.MeshLambertMaterial({ map: textures.ironOre }),
  },
  tree: {
    id: 6,
    name: "Oak Log",
    scarcity: 0.9,
    material: [
      new THREE.MeshLambertMaterial({ map: textures.treeSide }),
      new THREE.MeshLambertMaterial({ map: textures.treeSide }),
      new THREE.MeshLambertMaterial({ map: textures.treeTop }),
      new THREE.MeshLambertMaterial({ map: textures.treeTop }),
      new THREE.MeshLambertMaterial({ map: textures.treeSide }),
      new THREE.MeshLambertMaterial({ map: textures.treeSide }),
    ],
  },
  leaves: {
    id: 7,
    name: "Oak Leaves",
    material: new THREE.MeshLambertMaterial({
      map: textures.leaves,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
  },
  sand: {
    id: 8,
    name: "Sand",
    material: new THREE.MeshLambertMaterial({ map: textures.sand }),
  },
  cloud: {
    id: 9,
    name: "Cloud",
    material: new THREE.MeshBasicMaterial({ color: 0xf0f0f0 }),
  },
  tall_grass: {
    id: 10,
    name: "Tall Grass",
    crossMesh: true,
    scarcity: 0.07,
    material: new THREE.MeshLambertMaterial({
      map: textures.tall_grass,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
  },
  snow: {
    id: 11,
    name: "Snow",
    material: new THREE.MeshLambertMaterial({ map: textures.snow }),
  },
  jungleTree: {
    id: 12,
    name: "Jungle Log",
    scarcity: 0.9,
    material: [
      new THREE.MeshLambertMaterial({ map: textures.jungle_tree_side }),
      new THREE.MeshLambertMaterial({ map: textures.jungle_tree_side }),
      new THREE.MeshLambertMaterial({ map: textures.jungle_tree_top }),
      new THREE.MeshLambertMaterial({ map: textures.jungle_tree_top }),
      new THREE.MeshLambertMaterial({ map: textures.jungle_tree_side }),
      new THREE.MeshLambertMaterial({ map: textures.jungle_tree_side }),
    ],
  },
  jungeleleaves: {
    id: 13,
    name: "Jungle Leaves",
    material: new THREE.MeshLambertMaterial({
      map: loadTexture(
        "/textures/azalea_leaves.png",
        "noise",
        "#58a040",
        "#3e7529"
      ),
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
  },
  cactus: {
    id: 14,
    name: "Cactus",
    material: [
      new THREE.MeshLambertMaterial({ map: textures.cactusSide }),
      new THREE.MeshLambertMaterial({ map: textures.cactusSide }),
      new THREE.MeshLambertMaterial({ map: textures.cactusTop }),
      new THREE.MeshLambertMaterial({ map: textures.cactusTop }),
      new THREE.MeshLambertMaterial({ map: textures.cactusSide }),
      new THREE.MeshLambertMaterial({ map: textures.cactusSide }),
    ],
  },
  spruceLog: {
    id: 15,
    name: "Spruce Log",
    material: [
      new THREE.MeshLambertMaterial({ map: textures.spruceLogSide }),
      new THREE.MeshLambertMaterial({ map: textures.spruceLogSide }),
      new THREE.MeshLambertMaterial({ map: textures.spruceLogTop }),
      new THREE.MeshLambertMaterial({ map: textures.spruceLogTop }),
      new THREE.MeshLambertMaterial({ map: textures.spruceLogSide }),
      new THREE.MeshLambertMaterial({ map: textures.spruceLogSide }),
    ],
  },
  spruceLeaves: {
    id: 16,
    name: "Spruce Leaves",
    material: new THREE.MeshLambertMaterial({
      map: textures.spruceLeaves,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
  },
  sandstone: {
    id: 17,
    name: "Sandstone",
    material: [
      new THREE.MeshLambertMaterial({ map: textures.sandstoneSide }),
      new THREE.MeshLambertMaterial({ map: textures.sandstoneSide }),
      new THREE.MeshLambertMaterial({ map: textures.sandstoneTop }),
      new THREE.MeshLambertMaterial({ map: textures.sandstoneTop }),
      new THREE.MeshLambertMaterial({ map: textures.sandstoneSide }),
      new THREE.MeshLambertMaterial({ map: textures.sandstoneSide }),
    ],
  },
  deadBush: {
    id: 18,
    name: "Dead Bush",
    crossMesh: true,
    material: new THREE.MeshLambertMaterial({
      map: textures.deadBush,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
  },
  plank: {
    id: 19,
    name: "Plank",
    material: new THREE.MeshLambertMaterial({ map: textures.plank }),
  },
  glass: {
    id: 20,
    name: "Glass",
    material: new THREE.MeshLambertMaterial({
      map: textures.glass,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    }),
  },
  cobblestone: {
    id: 21,
    name: "Cobblestone",
    material: new THREE.MeshLambertMaterial({ map: textures.cobblestone }),
  },
  snowyGrass: {
    id: 22,
    name: "Snowy Grass",
    material: [
      new THREE.MeshLambertMaterial({ map: textures.grass_side_snowed }),
      new THREE.MeshLambertMaterial({ map: textures.grass_side_snowed }),
      new THREE.MeshLambertMaterial({ map: textures.snow }),
      new THREE.MeshLambertMaterial({ map: textures.dirt }),
      new THREE.MeshLambertMaterial({ map: textures.grass_side_snowed }),
      new THREE.MeshLambertMaterial({ map: textures.grass_side_snowed }),
    ],
  },
  acaciaLeaves: {
    id: 23,
    name: "Acacia Leaves",
    material: new THREE.MeshLambertMaterial({
      map: textures.leaves_acacia,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
  },
  spruceLeavesOpaque: {
    id: 24,
    name: "Spruce Leaves Opaque",
    material: [
      new THREE.MeshLambertMaterial({ map: textures.leaves_spurce_opaque }),
      new THREE.MeshLambertMaterial({ map: textures.leaves_spurce_opaque }),
      new THREE.MeshLambertMaterial({ map: textures.snow }),
      new THREE.MeshLambertMaterial({ map: textures.leaves_spurce_opaque }),
      new THREE.MeshLambertMaterial({ map: textures.leaves_spurce_opaque }),
      new THREE.MeshLambertMaterial({ map: textures.leaves_spurce_opaque }),
    ],
  },
  mangroveLeaves: {
    id: 25,
    name: "Mangrove Leaves",
    material: new THREE.MeshLambertMaterial({
      map: textures.mangrove_leaves,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
  },
  ice: {
    id: 26,
    name: "Ice",
    material: new THREE.MeshLambertMaterial({
      map: textures.ice,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    }),
  },

  // --- NEW BLOCKS ---
  gravel: {
    id: 27,
    name: "Gravel",
    material: new THREE.MeshLambertMaterial({ map: textures.gravel }),
  },
  coarseDirt: {
    id: 28,
    name: "Coarse Dirt",
    material: new THREE.MeshLambertMaterial({ map: textures.coarse_dirt }),
  },
  andesite: {
    id: 29,
    name: "Andesite",
    material: new THREE.MeshLambertMaterial({ map: textures.andesite }),
  },
  suspiciousGravel: {
    id: 30,
    name: "Suspicious Gravel",
    material: new THREE.MeshLambertMaterial({
      map: textures.suspicious_gravel,
    }),
  },
  podzol: {
    id: 31,
    name: "Podzol",
    material: [
      new THREE.MeshLambertMaterial({ map: textures.podzol_side }),
      new THREE.MeshLambertMaterial({ map: textures.podzol_side }),
      new THREE.MeshLambertMaterial({ map: textures.podzol_top }),
      new THREE.MeshLambertMaterial({ map: textures.dirt }),
      new THREE.MeshLambertMaterial({ map: textures.podzol_side }),
      new THREE.MeshLambertMaterial({ map: textures.podzol_side }),
    ],
  },
  packedIce: {
    id: 32,
    name: "Packed Ice",
    material: new THREE.MeshLambertMaterial({ map: textures.packed_ice }),
  },
  blueIce: {
    id: 33,
    name: "Blue Ice",
    material: new THREE.MeshLambertMaterial({ map: textures.blue_ice }),
  },

  // 40: Crafting Table
  craftingTable: {
    id: 40,
    name: "Crafting Table",
    material: [
      new THREE.MeshLambertMaterial({ map: textures.crafting_table_side }),
      new THREE.MeshLambertMaterial({ map: textures.crafting_table_side }),
      new THREE.MeshLambertMaterial({ map: textures.crafting_table_top }),
      new THREE.MeshLambertMaterial({ map: textures.plank }),
      new THREE.MeshLambertMaterial({ map: textures.crafting_table_front }),
      new THREE.MeshLambertMaterial({ map: textures.crafting_table_side }),
    ],
  },

  // --- BUILDINGS (Added) ---
  door: {
    id: 41,
    name: "Door",
    material: new THREE.MeshLambertMaterial({ map: textures.door_top }),
  }, // Placeholder 1x1 block
  stoneBricks: {
    id: 42,
    name: "Stone Bricks",
    material: new THREE.MeshLambertMaterial({ map: textures.stone_bricks }),
  },
  oakStairs: {
    id: 43,
    name: "Oak Stairs",
    material: new THREE.MeshLambertMaterial({ map: textures.plank }),
  }, // Block placeholder
  oakSlab: {
    id: 44,
    name: "Oak Slab",
    material: new THREE.MeshLambertMaterial({ map: textures.plank }),
  }, // Block placeholder

  moss: {
    id: 50,
    name: "Moss Block",
    material: new THREE.MeshLambertMaterial({ map: textures.moss }),
  },
  glowstone: {
    id: 51,
    name: "Glowstone",
    material: new THREE.MeshBasicMaterial({
      map: textures.glowstone,
      color: 0xffddaa,
    }),
  },
};

export const resources = [blocks.stone, blocks.coalOre, blocks.ironOre];
