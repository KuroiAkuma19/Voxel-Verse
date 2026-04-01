import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { resources } from "./blocks.js";

export function createUI(scene, world, player) {
  // --- 1. INJECT CUSTOM "VOXELVERSE" CSS ---
  // We inject styles here so you don't have to edit style.css manually
  const style = document.createElement("style");
  style.innerHTML = `
    /* Centered Layout */
    .lil-gui.root {
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: 400px !important; /* Wider for better readability */
        max-height: 80vh !important; /* Maximum height (80% of screen) */
        display: none; /* Hidden by default */
        box-shadow: 0 0 0 4px rgba(0,0,0,0.5) !important; /* Blocky outline */
    }

    /* Scrollbar Logic */
    .lil-gui .children {
        max-height: 60vh; /* Inner scroll area */
        overflow-y: auto; /* Show slider if content is too long */
        overflow-x: hidden;
    }

    /* "VoxelVerse" Visual Theme */
    .lil-gui { 
        --background-color: #111111;
        --text-color: #e0e0e0;
        --title-background-color: #222222;
        --widget-color: #333333;
        --hover-color: #444444;
        --focus-color: #555555;
        --number-color: #4facfe;
        --string-color: #52c234; /* Grass Green */
        font-family: 'Courier New', Courier, monospace !important; /* Retro font */
        font-weight: bold;
    }

    /* Blocky Scrollbar Styling */
    .lil-gui .children::-webkit-scrollbar {
        width: 12px;
        background: #111;
    }
    .lil-gui .children::-webkit-scrollbar-thumb {
        background-color: #555;
        border: 2px solid #111; /* Creates a pixel-art look */
    }
    .lil-gui .children::-webkit-scrollbar-thumb:hover {
        background-color: #777;
    }

    /* Title Bar Styling */
    .lil-gui .title {
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: #52c234; /* VoxelVerse Green */
        border-bottom: 2px solid #333;
        padding: 10px;
    }
  `;
  document.head.appendChild(style);

  // --- 2. INITIALIZE UI ---
  const gui = new GUI({ title: "VoxelVerse Menu" });
  let isMenuVisible = false;

  // --- 3. INPUT HANDLING (Toggle Menu) ---
  document.addEventListener("keydown", (event) => {
    if (event.code === "KeyP") {
      toggleMenu();
    }
  });

  function toggleMenu() {
    isMenuVisible = !isMenuVisible;

    if (isMenuVisible) {
      gui.domElement.style.display = "block";
      document.exitPointerLock(); // Show cursor
    } else {
      gui.domElement.style.display = "none";
      player.controls.lock(); // Hide cursor, return to game
    }
  }

  // Helper to prevent lag while dragging sliders
  const updateWorld = () => {
    setTimeout(() => {
      world.createWorld(true);
    }, 10);
  };

  // --- 4. GAME SETTINGS ---

  const fileFolder = gui.addFolder("Data Management");
  const fileParams = {
    save: () => world.save(),
    load: () => world.load(),
    reset: () => {
      if (
        confirm(
          "Warning: This will delete your VoxelVerse world data. Continue?"
        )
      ) {
        world.dataStore.clear();
        world.createWorld(true);
      }
    },
  };
  fileFolder.add(fileParams, "save").name("Save World");
  fileFolder.add(fileParams, "load").name("Load World");
  fileFolder.add(fileParams, "reset").name("Reset All Data");

  // --- RENDERING ---
  const viewFolder = gui.addFolder("Graphics & Render");

  viewFolder
    .add(world, "drawDistance", 2, 10, 1)
    .name("Draw Distance")
    .onFinishChange(updateWorld);

  viewFolder.add(world, "asyncLoading").name("Async Chunk Loading");

  viewFolder.add(scene.fog, "near", 1, 200, 1).name("Fog Start");
  viewFolder.add(scene.fog, "far", 50, 500, 1).name("Fog End");

  // --- TERRAIN GEN ---
  const terrainFolder = gui.addFolder("Terrain Generator");

  terrainFolder
    .add(world.params, "seed", 0, 10000, 1)
    .name("World Seed")
    .onFinishChange(updateWorld);

  terrainFolder
    .add(world.params.terrain, "scale", 10, 150)
    .name("Zoom Scale")
    .onFinishChange(updateWorld);

  terrainFolder
    .add(world.params.terrain, "magnitude", 0, 1)
    .name("Terrain Height")
    .onFinishChange(updateWorld);

  terrainFolder
    .add(world.params.terrain, "offset", 0, 30, 1)
    .name("Base Level")
    .onFinishChange(updateWorld);

  terrainFolder
    .add(world.params.terrain, "waterOffset", 0, 30, 1)
    .name("Sea Level")
    .onFinishChange(() => world.createWorld(true));

  // --- BIOMES ---
  const biomesFolder = gui.addFolder("Biome Settings");
  biomesFolder
    .add(world.params.biomes.temperature, "scale", 10, 500)
    .name("Temp Scale")
    .onFinishChange(updateWorld);
  biomesFolder
    .add(world.params.biomes.humidity, "scale", 10, 500)
    .name("Humidity Scale")
    .onFinishChange(updateWorld);

  // --- FLORA ---
  const natureFolder = gui.addFolder("Flora & Fauna");

  natureFolder
    .add(world.params.trees, "frequency", 0, 0.1, 0.001)
    .name("Tree Density")
    .onFinishChange(updateWorld);

  const treeSize = natureFolder.addFolder("Tree Geometry").close();
  treeSize
    .add(world.params.trees.trunk, "minHeight", 1, 10)
    .name("Min Trunk")
    .onFinishChange(updateWorld);
  treeSize
    .add(world.params.trees.trunk, "maxHeight", 1, 15)
    .name("Max Trunk")
    .onFinishChange(updateWorld);
  treeSize
    .add(world.params.trees.canopy, "minRadius", 1, 5)
    .name("Leaf Radius")
    .onFinishChange(updateWorld);

  // --- SKY ---
  const cloudFolder = natureFolder.addFolder("Atmosphere").close();
  cloudFolder
    .add(world.params.clouds, "density", 0, 1, 0.01)
    .name("Cloud Cover")
    .onFinishChange(updateWorld);
  cloudFolder
    .add(world.params.clouds, "scale", 0, 100)
    .name("Cloud Size")
    .onFinishChange(updateWorld);

  // --- ORES ---
  const resourceFolder = gui.addFolder("Ore Distribution").close();
  resources.forEach((res) => {
    const folder = resourceFolder.addFolder(res.name);
    folder
      .add(res, "scarcity", 0, 1, 0.01)
      .name("Rarity")
      .onFinishChange(updateWorld);
    folder
      .add(res.scale, "x", 10, 100)
      .name("Vein Width")
      .onFinishChange(updateWorld);
    folder
      .add(res.scale, "y", 10, 100)
      .name("Vein Height")
      .onFinishChange(updateWorld);
    folder
      .add(res.scale, "z", 10, 100)
      .name("Vein Depth")
      .onFinishChange(updateWorld);
  });
}
