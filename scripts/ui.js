import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { resources, blocks } from "./blocks.js";
import { recipes, checkRecipe } from "./recipes.js";
import * as THREE from "three";

export function createUI(scene, world, player) {
  // --- 1. CSS STYLES ---
  const style = document.createElement("style");
  style.innerHTML = `
    /* === LIL GUI === */
    .lil-gui.root { position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; width: 450px !important; max-height: 85vh !important; display: none; background-color: #151515; z-index: 2000; border: 2px solid #fff; }
    .lil-gui { --text-color: #eee; --widget-color: #555; font-family: 'Minecraft', monospace; }

    /* === INVENTORY/CRAFTING WINDOWS === */
    #inventory-screen { display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1500; align-items: center; justify-content: center; }
    .inventory-window, .crafting-window { width: 580px; background-color: #C6C6C6; border: 4px solid #fff; border-right-color: #555; border-bottom-color: #555; display: flex; flex-direction: column; padding: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.6); font-family: 'Minecraft', monospace; position: relative; }
    .inventory-window { height: 420px; } .crafting-window { height: 480px; }
    .inv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; color: #404040; font-size: 18px; }
    .inv-close-btn { width: 28px; height: 28px; background-color: #ff5555; border: 2px solid #aa0000; color: white; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    #inv-search { background: #000; border: 2px solid #555; color: #fff; font-family: 'Minecraft', monospace; padding: 6px; width: 220px; outline: none; }
    .inv-grid-container { flex: 1; overflow-y: auto; border: 2px solid #808080; background: #C6C6C6; padding: 4px; }
    .inventory-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 2px; }
    .inv-slot { width: 44px; height: 44px; background: #8B8B8B; border: 2px solid #373737; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; }
    .inv-slot:hover { background-color: #A0A0A0; border-color: #fff; }
    .inv-slot img { width: 32px; height: 32px; image-rendering: pixelated; }
    .inv-qty { position: absolute; bottom: 2px; right: 2px; color: #fff; font-size: 14px; font-weight: bold; text-shadow: 1px 1px 0 #000; pointer-events: none; }
    
    /* CRAFTING SPECIFIC */
    #crafting-screen { display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1600; align-items: center; justify-content: center; }
    .crafting-area { display: flex; align-items: center; justify-content: center; padding: 20px; gap: 30px; margin-bottom: 20px; }
    .craft-grid-3x3 { display: grid; grid-template-columns: repeat(3, 44px); grid-template-rows: repeat(3, 44px); gap: 2px; }
    .arrow-right { font-size: 40px; color: #404040; font-weight: bold; }
    .craft-output-col { display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .output-slot { width: 60px; height: 60px; border: 2px solid #373737; background: #8B8B8B; display: flex; align-items: center; justify-content: center; }
    .craft-btn { width: 60px; height: 30px; background: #8B8B8B; border: 2px solid #fff; font-family: 'Minecraft', monospace; cursor: pointer; font-weight: bold; color: #333; }
    .craft-btn:disabled { color: #666; background: #999; cursor: default; }
    .recipe-book-btn { position: absolute; left: -32px; top: 60px; width: 32px; height: 40px; background: #52c234; border: 2px solid #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .recipe-help-screen { display: none; position: absolute; left: -220px; top: 0; width: 215px; height: 100%; background: #C6C6C6; border: 3px solid #fff; overflow-y: auto; z-index: 1400; }
    .recipe-help-item { display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #999; gap: 10px; cursor: pointer; }
    .recipe-help-item:hover { background: #ddd; }
  `;
  document.head.appendChild(style);

  // --- 2. GUI SETUP ---
  const gui = new GUI({ title: "Game Options" });
  let isMenuVisible = false;
  let isInventoryVisible = false;

  // --- 3. INVENTORY DOM ---
  const invScreen = document.getElementById("inventory-screen");
  const invWindow = invScreen.querySelector(".inventory-window");

  invWindow.innerHTML = `
      <div class="inv-header">
          <span>Search Items</span>
          <div class="inv-controls">
            <input type="text" id="inv-search" placeholder="Search..." autocomplete="off">
            <button id="inv-close-btn" class="inv-close-btn">X</button>
          </div>
      </div>
      <div class="inv-grid-container">
          <div id="inventory-grid" class="inventory-grid"></div>
      </div>
  `;

  const invGrid = document.getElementById("inventory-grid");
  const searchInput = document.getElementById("inv-search");
  const closeBtn = document.getElementById("inv-close-btn");

  // --- 4. CRAFTING DOM ---
  const craftingScreen = document.createElement("div");
  craftingScreen.id = "crafting-screen";
  document.body.appendChild(craftingScreen);

  craftingScreen.innerHTML = `
      <div class="crafting-window">
          <div class="inv-header" style="padding: 5px 10px;">
              <span>Crafting</span>
              <button class="inv-close-btn" id="craft-close-btn">X</button>
          </div>
          
          <div class="recipe-book-btn" id="recipe-book-toggle">📖</div>
          <div class="recipe-help-screen" id="recipe-help">
               <h4 style="text-align:center; margin:10px 0; border-bottom:1px solid #777;">Recipes</h4>
               <div id="recipe-list"></div>
          </div>

          <div class="crafting-area">
              <div class="craft-grid-3x3" id="craft-grid"></div>
              <div class="arrow-right">➡</div>
              <div class="craft-output-col">
                  <div class="output-slot" id="craft-output"></div>
                  <button id="craft-ok-btn" class="craft-btn" disabled>OK</button>
              </div>
          </div>
          
          <div class="inv-header" style="padding-left:10px; font-size:14px;">Inventory (Click to Place)</div>
          <div class="inv-grid-container" style="flex:1;">
              <div id="craft-player-inv" class="inventory-grid"></div>
          </div>
      </div>
  `;

  // --- 5. HELPER FUNCTIONS ---
  function getBlockIcon(block) {
    if (block.id === 0) return null;
    let mat = block.material;
    if (Array.isArray(mat)) mat = mat[0];
    if (mat && mat.map && mat.map.image) {
      const image = mat.map.image;
      if (image instanceof HTMLImageElement) return image.src;
      else if (image instanceof HTMLCanvasElement) return image.toDataURL();
    }
    if (mat && mat.color) {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#" + mat.color.getHexString();
      ctx.fillRect(0, 0, 32, 32);
      return canvas.toDataURL();
    }
    return "/textures/dirt.png";
  }

  // --- 6. INVENTORY LOGIC (UPDATED TO USE PLAYER.INVENTORY) ---

  // This function refreshes the UI whenever inventory changes
  const refreshUI = () => {
    const grids = [invGrid, document.getElementById("craft-player-inv")];
    grids.forEach((grid) => {
      if (!grid) return;
      if (grid.offsetParent === null) return; // Only update visible grids to save perf

      // Re-generate using player.inventory
      generateInventory(grid, grid.id === "craft-player-inv");
    });
    // Also update crafting logic if open
    if (craftingScreen.style.display === "flex") updateCraftingLogic();
  };

  // Bind to Player
  player.onInventoryChange = refreshUI;

  closeBtn.addEventListener("click", () => {
    closeInventory();
  });

  function generateInventory(targetGridElement, isCraftingMode = false) {
    targetGridElement.innerHTML = "";

    // Iterate through Player Inventory
    for (const [idStr, count] of Object.entries(player.inventory)) {
      const id = parseInt(idStr);
      const block = Object.values(blocks).find((b) => b.id === id);
      if (!block) continue;

      const slot = document.createElement("div");
      slot.className = "inv-slot";
      slot.dataset.name = block.name;

      const iconSrc = getBlockIcon(block);
      if (iconSrc) {
        const img = document.createElement("img");
        img.src = iconSrc;
        slot.appendChild(img);
      }

      // Quantity Badge
      const qty = document.createElement("span");
      qty.className = "inv-qty";
      qty.innerText = count;
      slot.appendChild(qty);

      slot.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isCraftingMode) {
          player.activeBlockId = block.id;
          const allSlots = targetGridElement.querySelectorAll(".inv-slot");
          allSlots.forEach((s) => (s.style.borderColor = "#373737"));
          slot.style.borderColor = "#00FF00";
        } else {
          selectBlock(block);
        }
      });
      targetGridElement.appendChild(slot);
    }
  }

  function selectBlock(block) {
    player.activeBlockId = block.id;
    closeInventory();
  }

  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const slots = invGrid.getElementsByClassName("inv-slot");
    Array.from(slots).forEach((slot) => {
      const name = slot.dataset.name.toLowerCase();
      slot.style.display = name.includes(term) ? "flex" : "none";
    });
  });

  // --- 7. CRAFTING LOGIC ---
  let craftGridData = Array(9).fill(0);
  let craftResult = null;
  const craftGridEl = document.getElementById("craft-grid");
  const outputEl = document.getElementById("craft-output");
  const okBtn = document.getElementById("craft-ok-btn");
  const recipeList = document.getElementById("recipe-list");

  function renderCraftGrid() {
    craftGridEl.innerHTML = "";
    craftGridData.forEach((blockId, index) => {
      const slot = document.createElement("div");
      slot.className = "inv-slot";

      if (blockId !== 0) {
        const block = Object.values(blocks).find((b) => b.id === blockId);
        if (block) {
          const img = document.createElement("img");
          img.src = getBlockIcon(block);
          slot.appendChild(img);
        }
      }

      slot.onclick = () => {
        if (craftGridData[index] === 0) {
          // Check if player HAS item
          if (
            player.activeBlockId !== 0 &&
            player.hasItem(player.activeBlockId)
          ) {
            craftGridData[index] = player.activeBlockId;
          }
        } else {
          craftGridData[index] = 0;
        }
        updateCraftingLogic();
        renderCraftGrid();
      };
      craftGridEl.appendChild(slot);
    });
  }

  function updateCraftingLogic() {
    const result = checkRecipe(craftGridData);
    outputEl.innerHTML = "";

    if (result) {
      craftResult = result;

      // Check resources
      const needed = {};
      craftGridData.forEach((id) => {
        if (id !== 0) needed[id] = (needed[id] || 0) + 1;
      });

      let hasResources = true;
      for (const [id, count] of Object.entries(needed)) {
        if (!player.hasItem(id, count)) {
          hasResources = false;
          break;
        }
      }

      okBtn.disabled = !hasResources;

      const block = Object.values(blocks).find((b) => b.id === result.id);
      if (block) {
        const img = document.createElement("img");
        img.src = getBlockIcon(block);
        img.style.width = "40px";
        img.style.height = "40px";
        outputEl.appendChild(img);
      }
    } else {
      craftResult = null;
      okBtn.disabled = true;
    }
  }

  // OK Button Click
  okBtn.onclick = () => {
    if (!craftResult) return;

    const block = Object.values(blocks).find((b) => b.id === craftResult.id);
    if (block) {
      console.log("Crafted: " + block.name);

      // 1. Consume Ingredients
      craftGridData.forEach((ingredientId) => {
        if (ingredientId !== 0) {
          player.removeInventoryItem(ingredientId, 1);
        }
      });

      // 2. Add Result
      player.addInventoryItem(craftResult.id, craftResult.count);

      // 3. Clear Grid & Refresh
      craftGridData = Array(9).fill(0);
      player.activeBlockId = craftResult.id;
      renderCraftGrid();
      updateCraftingLogic();

      // Force refresh of inventory UI immediately
      refreshUI();
    }
  };

  // Populate Recipe Book
  recipeList.innerHTML = "";
  recipes.forEach((r) => {
    const row = document.createElement("div");
    row.className = "recipe-help-item";

    const resBlock = Object.values(blocks).find((b) => b.id === r.result.id);
    if (resBlock) {
      const img = document.createElement("img");
      img.src = getBlockIcon(resBlock);
      img.style.width = "24px";
      img.style.height = "24px";
      row.appendChild(img);

      const txt = document.createElement("span");
      txt.innerText = `${resBlock.name} x${r.result.count}`;
      row.appendChild(txt);

      row.onclick = () => {
        craftGridData = Array(9).fill(0);
        if (r.type === "shapeless") {
          r.ingredients.forEach((ingId, idx) => {
            if (idx < 9) craftGridData[idx] = ingId;
          });
        } else {
          const flatPattern = r.pattern.flat();
          for (let i = 0; i < 9; i++) {
            craftGridData[i] = flatPattern[i] ? flatPattern[i] : 0;
          }
        }
        renderCraftGrid();
        updateCraftingLogic();
      };
      recipeList.appendChild(row);
    }
  });

  document.getElementById("recipe-book-toggle").onclick = () => {
    const el = document.getElementById("recipe-help");
    el.style.display = el.style.display === "block" ? "none" : "block";
  };

  document.getElementById("craft-close-btn").onclick = () => {
    craftingScreen.style.display = "none";
    player.controls.lock();
  };

  window.openCraftingTable = () => {
    craftingScreen.style.display = "flex";
    document.exitPointerLock();
    craftGridData = Array(9).fill(0);
    renderCraftGrid();
    updateCraftingLogic();

    // Initial inventory render for the crafting screen
    const invBottom = document.getElementById("craft-player-inv");
    generateInventory(invBottom, true);
  };

  // --- 8. INPUT HANDLING ---
  document.addEventListener("keydown", (event) => {
    const isTyping = document.activeElement === searchInput;

    if (event.code === "KeyP") {
      if (isTyping) return;
      if (isInventoryVisible) closeInventory();
      toggleMenu();
    }

    if (event.code === "KeyE") {
      if (isTyping) return;
      if (isMenuVisible) return;

      if (craftingScreen.style.display === "flex") {
        craftingScreen.style.display = "none";
        player.controls.lock();
        return;
      }

      if (!isInventoryVisible) {
        event.preventDefault();
        openInventory();
      } else {
        closeInventory();
      }
    }

    if (event.code === "Escape") {
      if (isInventoryVisible) closeInventory();
      else if (craftingScreen.style.display === "flex") {
        craftingScreen.style.display = "none";
        player.controls.lock();
      } else if (isMenuVisible) toggleMenu();
    }
  });

  function openInventory() {
    isInventoryVisible = true;
    invScreen.style.display = "flex";
    document.exitPointerLock();
    searchInput.value = "";
    generateInventory(invGrid, false);
    setTimeout(() => {
      searchInput.focus();
    }, 10);
  }

  function closeInventory() {
    isInventoryVisible = false;
    invScreen.style.display = "none";
    searchInput.blur();
    player.controls.lock();
  }

  function toggleMenu() {
    isMenuVisible = !isMenuVisible;
    if (isMenuVisible) {
      gui.domElement.style.display = "block";
      document.exitPointerLock();
    } else {
      gui.domElement.style.display = "none";
      player.controls.lock();
    }
  }

  // --- 9. LIL GUI SETTINGS ---
  const updateWorld = () => {
    setTimeout(() => {
      world.createWorld(true);
    }, 10);
  };

  const fileFolder = gui.addFolder("World Saves");
  const fileParams = {
    save: () => world.save(),
    load: () => world.load(),
    reset: () => {
      if (confirm("Delete all world data?")) {
        world.dataStore.clear();
        world.createWorld(true);
      }
    },
  };
  fileFolder.add(fileParams, "save").name("Save World");
  fileFolder.add(fileParams, "load").name("Load World");
  fileFolder.add(fileParams, "reset").name("Reset World");

  const viewFolder = gui.addFolder("Video Settings");
  viewFolder
    .add(world, "drawDistance", 2, 16, 1)
    .name("Render Distance")
    .onFinishChange(updateWorld);
  viewFolder.add(world, "asyncLoading").name("Async Loading");
  viewFolder.add(scene.fog, "near", 1, 300, 1).name("Fog Start");
  viewFolder.add(scene.fog, "far", 50, 500, 1).name("Fog End");

  const terrainFolder = gui.addFolder("World Generation");
  terrainFolder
    .add(world.params, "seed", 0, 10000, 1)
    .name("Seed")
    .onFinishChange(updateWorld);
  terrainFolder
    .add(world.params.terrain, "scale", 10, 150)
    .name("Scale")
    .onFinishChange(updateWorld);
  terrainFolder
    .add(world.params.terrain, "magnitude", 0, 1)
    .name("Height Multiplier")
    .onFinishChange(updateWorld);
  terrainFolder
    .add(world.params.terrain, "offset", 0, 30, 1)
    .name("Base Height")
    .onFinishChange(updateWorld);
  terrainFolder
    .add(world.params.terrain, "waterOffset", 0, 30, 1)
    .name("Sea Level")
    .onFinishChange(() => world.createWorld(true));

  const natureFolder = gui.addFolder("Nature");
  natureFolder
    .add(world.params.trees, "frequency", 0, 0.1, 0.001)
    .name("Tree Density")
    .onFinishChange(updateWorld);
  natureFolder
    .add(world.params.clouds, "density", 0, 1, 0.01)
    .name("Cloud Density")
    .onFinishChange(updateWorld);

  const resourceFolder = gui.addFolder("Ores").close();
  resources.forEach((res) => {
    const folder = resourceFolder.addFolder(res.name);
    folder
      .add(res, "scarcity", 0, 1, 0.01)
      .name("Rarity")
      .onFinishChange(updateWorld);
  });

  // Initial Refresh
  refreshUI();
}
