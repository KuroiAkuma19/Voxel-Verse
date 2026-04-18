import { blocks } from "./blocks.js";

const getID = (blockName) => {
  return blocks[blockName] ? blocks[blockName].id : 0;
};

export const recipes = [
  // 1. Planks
  {
    type: "shapeless",
    ingredients: [blocks.tree.id],
    result: { id: blocks.plank.id, count: 4 },
  },
  // 2. Crafting Table
  {
    pattern: [
      [blocks.plank.id, blocks.plank.id, null],
      [blocks.plank.id, blocks.plank.id, null],
      [null, null, null],
    ],
    result: { id: blocks.craftingTable.id, count: 1 },
  },
  // 3. Glass (4 Sand -> 2 Glass)
  {
    pattern: [
      [blocks.sand.id, blocks.sand.id, null],
      [blocks.sand.id, blocks.sand.id, null],
      [null, null, null],
    ],
    result: { id: blocks.glass.id, count: 2 },
  },
  // 4. Sandstone
  {
    pattern: [
      [blocks.sand.id, blocks.sand.id, null],
      [blocks.sand.id, blocks.sand.id, null],
      [null, null, null],
    ],
    result: { id: blocks.sandstone.id, count: 1 },
  },
  // 5. Door (6 Planks -> 1 Door)
  {
    pattern: [
      [blocks.plank.id, blocks.plank.id, null],
      [blocks.plank.id, blocks.plank.id, null],
      [blocks.plank.id, blocks.plank.id, null],
    ],
    result: { id: getID("door"), count: 1 },
  },
  // 6. Stone Bricks (4 Stone -> 4 Stone Bricks)
  {
    pattern: [
      [blocks.stone.id, blocks.stone.id, null],
      [blocks.stone.id, blocks.stone.id, null],
      [null, null, null],
    ],
    result: { id: getID("stoneBricks"), count: 4 },
  },
  // 7. Oak Stairs (6 Planks -> 4 Stairs)
  {
    pattern: [
      [blocks.plank.id, null, null],
      [blocks.plank.id, blocks.plank.id, null],
      [blocks.plank.id, blocks.plank.id, blocks.plank.id],
    ],
    result: { id: getID("oakStairs"), count: 4 },
  },
  // 8. Oak Slab (3 Planks -> 6 Slabs)
  {
    pattern: [
      [blocks.plank.id, blocks.plank.id, blocks.plank.id],
      [null, null, null],
      [null, null, null],
    ],
    result: { id: getID("oakSlab"), count: 6 },
  },
  // 9. Glowstone
  {
    pattern: [
      [null, blocks.glass.id, null],
      [blocks.glass.id, blocks.coalOre.id, blocks.glass.id],
      [null, blocks.glass.id, null],
    ],
    result: { id: blocks.glowstone.id, count: 1 },
  },
  // 10. Coarse Dirt
  {
    pattern: [
      [blocks.dirt.id, getID("gravel"), null],
      [getID("gravel"), blocks.dirt.id, null],
      [null, null, null],
    ],
    result: { id: getID("coarseDirt"), count: 4 },
  },
];

export function checkRecipe(grid) {
  for (const recipe of recipes) {
    if (recipe.type === "shapeless") {
      const currentIngredients = grid.filter((id) => id !== 0 && id !== null);
      const recipeIngredients = [...recipe.ingredients];
      if (currentIngredients.length !== recipeIngredients.length) continue;

      const gridCounts = {};
      const recipeCounts = {};
      currentIngredients.forEach(
        (id) => (gridCounts[id] = (gridCounts[id] || 0) + 1)
      );
      recipeIngredients.forEach(
        (id) => (recipeCounts[id] = (recipeCounts[id] || 0) + 1)
      );

      let match = true;
      for (const id in gridCounts) {
        if (gridCounts[id] !== recipeCounts[id]) match = false;
      }
      if (match) return recipe.result;
    } else {
      const flatPattern = recipe.pattern.flat();
      let match = true;
      for (let i = 0; i < 9; i++) {
        const recipeItem = flatPattern[i];
        const gridItem = grid[i];
        if (recipeItem === null) {
          if (gridItem !== 0) {
            match = false;
            break;
          }
        } else {
          if (gridItem !== recipeItem) {
            match = false;
            break;
          }
        }
      }
      if (match) return recipe.result;
    }
  }
  return null;
}
