import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { WorldChunk } from "./worldChunk.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { createUI } from "./ui.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Player } from "./player.js";
import { Physics } from "./physics.js";
import { World } from "./world.js";
import { blocks } from "./blocks.js";
import { ModelLoader } from "./modelLoader.js";


const baseUrl = import.meta.env.BASE_URL;

const stats = new Stats();
document.body.append(stats.dom);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const editorCamera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.01,
  1000
);
editorCamera.position.set(-32, 16, -32);
editorCamera.layers.enable(1);
editorCamera.lookAt(0, 0, 0);

const controls = new OrbitControls(editorCamera, renderer.domElement);
controls.target.set(16, 0, 16);
controls.update();

const scene = new THREE.Scene();
const world = new World();
world.createWorld();
scene.add(world);


export const player = new Player(scene);
const physics = new Physics(scene);

const modelLoader = new ModelLoader();

modelLoader.loadModels((models) => {
  player.tool.setMesh(models.pickaxe);
});

const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);

const sunVector = new THREE.Vector3();
const skyUniforms = sky.material.uniforms;
skyUniforms["turbidity"].value = 5;
skyUniforms["rayleigh"].value = 3.0;
skyUniforms["mieCoefficient"].value = 0.005;
skyUniforms["mieDirectionalG"].value = 0.7;

const dayDuration = 600;
const duskDuration = 10;
const nightDuration = 10;
const dawnDuration = 10;
const totalDuration = dayDuration + duskDuration + nightDuration + dawnDuration;

const skyColors = {
  day: new THREE.Color(0x87ceeb),
  dusk: new THREE.Color(0xff8c00),
  night: new THREE.Color(0x00001a),
  dawn: new THREE.Color(0xffd700),
};
const groundColors = {
  day: new THREE.Color(0xb97a20),
  night: new THREE.Color(0x080820),
};

scene.fog = new THREE.Fog(skyColors.day, 180, 200);
renderer.setClearColor(skyColors.day);

const hemiLight = new THREE.HemisphereLight(
  skyColors.day,
  groundColors.day,
  0.6
);
hemiLight.position.set(0, 100, 0);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff5e1, 1.2);
sunLight.position.set(100, 150, 100);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -120;
sunLight.shadow.camera.right = 120;
sunLight.shadow.camera.top = 120;
sunLight.shadow.camera.bottom = -120;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 400;
sunLight.shadow.bias = -0.00015;
sunLight.shadow.mapSize.set(4096, 4096);
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-80, 50, -80);
scene.add(fillLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);



function onMouseDown(event) {
  if (!player.controls.isLocked) return;

  if (event.button === 2) {
    if (player.isFlying) {
      player.launch();
      return;
    }

    if (player.selectedCoords) {
      const targetBlock = world.getBlock(
        player.selectedCoords.x,
        player.selectedCoords.y,
        player.selectedCoords.z
      );
      if (targetBlock && targetBlock.id === blocks.craftingTable.id) {
        if (window.openCraftingTable) {
          window.openCraftingTable();
          return;
        }
      }
    }

    if (player.selectedCoords && player.activeBlockId !== blocks.empty.id) {
      if (player.hasItem(player.activeBlockId, 1)) {
        player.removeInventoryItem(player.activeBlockId, 1);
        world.addBlock(
          player.selectedCoords.x,
          player.selectedCoords.y,
          player.selectedCoords.z,
          player.activeBlockId
        );
        player.tool.startAnimation();
      } else {
        console.log("Cannot place: Not enough items.");
      }
    }
  }

  else if (event.button === 0) {
    if (!player.selectedCoords) return;

    let breakCoords = player.selectedCoords;
    const blockToBreak = world.getBlock(
      breakCoords.x,
      breakCoords.y,
      breakCoords.z
    );

    if (blockToBreak && blockToBreak.id !== blocks.empty.id) {
      let dropId = blockToBreak.id;
      if (dropId === blocks.grass.id) dropId = blocks.dirt.id;
      if (dropId === blocks.stone.id) dropId = blocks.cobblestone.id;

      player.addInventoryItem(dropId, 1);
      console.log(`Collected ${blockToBreak.name}`);

      world.removeBlock(breakCoords.x, breakCoords.y, breakCoords.z);
      player.tool.startAnimation();
    }
  }
}

document.addEventListener("mousedown", onMouseDown);
window.addEventListener("contextmenu", (e) => e.preventDefault());

const listener = new THREE.AudioListener();
player.camera.add(listener);
const ambientSound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();

// FIXED: Added baseUrl to the audio path
audioLoader.load(`${baseUrl}ambient.mp3`, (buffer) => {
  ambientSound.setBuffer(buffer);
  ambientSound.setLoop(true);
  ambientSound.setVolume(0.4);
  ambientSound.play();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && ambientSound.isPlaying) ambientSound.pause();
  if ((event.key === " " || event.code === "Space") && !ambientSound.isPlaying)
    ambientSound.play();
});

let previousTime = performance.now();
let totalTime = dayDuration * 0.5;

function animate() {
  requestAnimationFrame(animate);
  const currentTime = performance.now();
  const dt = (currentTime - previousTime) / 1000;

  if (player.controls.isLocked) {
    player.update(world);
    physics.update(dt, player, world);
    world.update(player);

    totalTime += dt;
    const timeOfDay = (totalTime % totalDuration) / totalDuration;
    const sunPhi = Math.acos(Math.sin(timeOfDay * Math.PI * 2));
    const sunTheta = timeOfDay * Math.PI * 2;
    sunVector.setFromSphericalCoords(1, sunPhi, sunTheta);
    skyUniforms["sunPosition"].value.copy(sunVector);

    const duskStart = dayDuration / totalDuration;
    const nightStart = (dayDuration + duskDuration) / totalDuration;
    const dawnStart =
      (dayDuration + duskDuration + nightDuration) / totalDuration;

    if (timeOfDay < duskStart) {
      const lerpFactor = timeOfDay / duskStart;
      scene.fog.color.copy(skyColors.dawn).lerp(skyColors.day, lerpFactor);
      renderer.setClearColor(scene.fog.color);
      sunLight.intensity = THREE.MathUtils.lerp(0.5, 1.2, lerpFactor);
      hemiLight.color.copy(skyColors.dawn).lerp(skyColors.day, lerpFactor);
      hemiLight.groundColor
        .copy(groundColors.night)
        .lerp(groundColors.day, lerpFactor);
      ambientLight.intensity = THREE.MathUtils.lerp(0.4, 0.6, lerpFactor);
      fillLight.intensity = THREE.MathUtils.lerp(0.3, 0.5, lerpFactor);
    } else if (timeOfDay < nightStart) {
      const lerpFactor = (timeOfDay - duskStart) / (nightStart - duskStart);
      scene.fog.color.copy(skyColors.day).lerp(skyColors.dusk, lerpFactor);
      renderer.setClearColor(scene.fog.color);
      sunLight.intensity = THREE.MathUtils.lerp(1.2, 0.5, lerpFactor);
      hemiLight.color.copy(skyColors.day).lerp(skyColors.dusk, lerpFactor);
      hemiLight.groundColor
        .copy(groundColors.day)
        .lerp(groundColors.night, lerpFactor);
      ambientLight.intensity = THREE.MathUtils.lerp(0.6, 0.2, lerpFactor);
      fillLight.intensity = THREE.MathUtils.lerp(0.5, 0.1, lerpFactor);
    } else if (timeOfDay < dawnStart) {
      const lerpFactor = (timeOfDay - nightStart) / (dawnStart - nightStart);
      scene.fog.color.copy(skyColors.dusk).lerp(skyColors.night, lerpFactor);
      renderer.setClearColor(scene.fog.color);
      sunLight.intensity = THREE.MathUtils.lerp(0.5, 0, lerpFactor);
      hemiLight.color.copy(skyColors.dusk).lerp(skyColors.night, lerpFactor);
      hemiLight.groundColor
        .copy(groundColors.night)
        .lerp(groundColors.night, lerpFactor);
      ambientLight.intensity = THREE.MathUtils.lerp(0.2, 0.1, lerpFactor);
      fillLight.intensity = 0;
    } else {
      const lerpFactor = (timeOfDay - dawnStart) / (1 - dawnStart);
      scene.fog.color.copy(skyColors.night).lerp(skyColors.dawn, lerpFactor);
      renderer.setClearColor(scene.fog.color);
      sunLight.intensity = THREE.MathUtils.lerp(0, 0.5, lerpFactor);
      hemiLight.color.copy(skyColors.night).lerp(skyColors.dawn, lerpFactor);
      hemiLight.groundColor
        .copy(groundColors.night)
        .lerp(groundColors.day, lerpFactor);
      ambientLight.intensity = THREE.MathUtils.lerp(0.1, 0.4, lerpFactor);
      fillLight.intensity = THREE.MathUtils.lerp(0, 0.3, lerpFactor);
    }

    const sunTargetPosition = player.position.clone();
    sunTargetPosition.y += 10;
    sunLight.position
      .copy(player.position)
      .add(sunVector.clone().multiplyScalar(100));

    const sunDir = sunLight.position.clone().normalize();
    const warmColor = new THREE.Color(0xfff1cc);
    const coldColor = new THREE.Color(0xf5f9ff);
    const mixFactor = Math.max(0, sunDir.y);

    const cloudMaterial = blocks.cloud?.material;
    if (cloudMaterial) {
      cloudMaterial.color.copy(coldColor).lerp(warmColor, 1 - mixFactor);
    }
  }

  world.updateVisibleChunks(player.camera);
  renderer.render(
    scene,
    player.controls.isLocked ? player.camera : editorCamera
  );
  stats.update();
  previousTime = currentTime;
}

window.addEventListener("resize", () => {
  editorCamera.aspect = window.innerWidth / window.innerHeight;
  editorCamera.updateProjectionMatrix();
  player.camera.aspect = window.innerWidth / window.innerHeight;
  player.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

createUI(scene, world, player);
animate();

const titleScreen = document.getElementById("title-screen");
const gameUI = document.getElementById("game-ui");
const btnPlay = document.getElementById("btn-play");
const btnQuit = document.getElementById("btn-quit");

if (btnPlay) {
  btnPlay.addEventListener("click", () => {
    titleScreen.style.display = "none";
    gameUI.style.display = "block";
    setTimeout(() => {
      player.controls.lock();
    }, 50);
  });
}
if (btnQuit) {
  btnQuit.addEventListener("click", () => {
    if (confirm("Quit VoxelVerse?")) window.location.reload();
  });
}