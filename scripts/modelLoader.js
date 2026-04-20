import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class ModelLoader {
  loader = new GLTFLoader();


  baseUrl = import.meta.env.BASE_URL;

  models = {
    pickaxe: undefined,
  };

  loadModels(onLoad) {

    this.loader.load(`${this.baseUrl}models/pickaxe2.glb`, (model) => {
      const mesh = model.scene;
      this.models.pickaxe = mesh;
      onLoad(this.models);
    }, 
    undefined, 
    (error) => {
      console.error("Error loading model:", error);
    });
  }
}