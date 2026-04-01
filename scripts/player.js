import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { blocks } from "./blocks.js";
import { Tool } from "./tool.js";

const CENTER_SCREEN = new THREE.Vector2();

export class Player {
  radius = 0.4;
  height = 1.75;
  jumpSpeed = 10;
  onGround = false;

  // Feature: Reduced speeds and Run support
  maxSpeed = 20; // Kept for compatibility, but overridden by walk/run below
  walkSpeed = 6;
  runSpeed = 10;

  input = new THREE.Vector3();
  velocity = new THREE.Vector3();
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  controls = new PointerLockControls(this.camera, document.body);
  cameraHelper = new THREE.CameraHelper(this.camera);

  raycaster = new THREE.Raycaster(
    new THREE.Vector3(),
    new THREE.Vector3(),
    0,
    5
  );
  selectedCoords = null;
  activeBlockId = blocks.grass.id;
  tool = new Tool();

  _worldVelocity = new THREE.Vector3();
  _euler = new THREE.Euler(0, 0, 0, "YXZ");
  _tempMatrix = new THREE.Matrix4();
  _tempVector = new THREE.Vector3();
  _viewDir = new THREE.Vector3();
  _lastPositionText = "";

  // Input State Tracking
  keyStates = {};

  constructor(scene) {
    this.camera.position.set(16, 16, 16);
    this.camera.layers.enable(1);
    scene.add(this.camera);
    this.camera.add(this.tool);

    document.addEventListener("keydown", this.onkeyDown.bind(this));
    document.addEventListener("keyup", this.onKeyUp.bind(this));

    this.boundHelper = new THREE.Mesh(
      new THREE.CylinderGeometry(this.radius, this.radius, this.height, 16),
      new THREE.MeshBasicMaterial({
        wireframe: true,
        visible: false,
        transparent: true,
        opacity: 0,
      })
    );
    scene.add(this.boundHelper);

    const selectionMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.3,
      color: 0xffffaa,
    });
    const selectionGeometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    this.selectionHelper = new THREE.Mesh(selectionGeometry, selectionMaterial);
    scene.add(this.selectionHelper);

    this.raycaster.layers.set(0);
  }

  get worldVelocity() {
    this._worldVelocity.copy(this.velocity);
    this._euler.set(0, this.camera.rotation.y, 0);
    this._worldVelocity.applyEuler(this._euler);
    return this._worldVelocity;
  }

  update(world) {
    this.updateRaycaster(world);
    this.updateVisibleChunks(world);
    this.updateBoundsHelper();
  }

  updateRaycaster(world) {
    this.raycaster.setFromCamera(CENTER_SCREEN, this.camera);
    const intersections = this.raycaster.intersectObject(world, true);

    if (intersections.length > 0) {
      const intersection = intersections[0];
      const chunk = intersection.object.parent || intersection.object;

      if (intersection.object.getMatrixAt) {
        intersection.object.getMatrixAt(
          intersection.instanceId,
          this._tempMatrix
        );
        this.selectedCoords = chunk.position.clone();
        this.selectedCoords.applyMatrix4(this._tempMatrix);
      } else {
        this.selectedCoords = intersection.point.clone().floor().addScalar(0.5);
      }

      if (this.activeBlockId !== blocks.empty.id) {
        this.selectedCoords.add(intersection.normal);
      }

      this.selectionHelper.position.copy(this.selectedCoords);
      this.selectionHelper.visible = true;
    } else {
      this.selectedCoords = null;
      this.selectionHelper.visible = false;
    }
  }

  updateVisibleChunks(world) {
    this.camera.getWorldDirection(this._viewDir);
    const fovAngle = THREE.MathUtils.degToRad(75);
    const cosFov = Math.cos(fovAngle / 2);
    const maxDistance = 60;

    for (const chunk of world.children) {
      if (!chunk.isChunk && chunk.userData.x === undefined) continue;

      this._tempVector.copy(chunk.position);
      const distance = this._tempVector.distanceTo(this.camera.position);
      this._tempVector.sub(this.camera.position).normalize();
      const dot = this._viewDir.dot(this._tempVector);

      if (dot > cosFov && distance < maxDistance) {
        chunk.visible = true;
      } else {
        chunk.visible = distance < 10;
      }
    }
  }

  applyWorldDeltaVelocity(dv) {
    this._euler.set(0, -this.camera.rotation.y, 0);
    dv.applyEuler(this._euler);
    this.velocity.add(dv);
  }

  // Feature: Updated to handle Run/Walk logic
  applyInputs(dt) {
    if (this.controls.isLocked) {
      // Check Shift key for speed
      const speed = this.keyStates["ShiftLeft"]
        ? this.runSpeed
        : this.walkSpeed;

      // Reset horizontal velocity to re-calculate from keys
      this.velocity.x = 0;
      this.velocity.z = 0;

      // Continuous key checking
      if (this.keyStates["KeyW"]) this.velocity.z += speed;
      if (this.keyStates["KeyS"]) this.velocity.z -= speed;
      if (this.keyStates["KeyA"]) this.velocity.x -= speed;
      if (this.keyStates["KeyD"]) this.velocity.x += speed;

      this.controls.moveRight(this.velocity.x * dt);
      this.controls.moveForward(this.velocity.z * dt);
      this.position.y += this.velocity.y * dt;

      const posText = this.toString();
      if (posText !== this._lastPositionText) {
        const el = document.getElementById("player-position");
        if (el) el.innerHTML = posText;
        this._lastPositionText = posText;
      }
    }
  }

  updateBoundsHelper() {
    this.boundHelper.position.copy(this.position);
    this.boundHelper.position.y -= this.height / 2;
  }

  get position() {
    return this.camera.position;
  }

  onKeyUp(event) {
    this.keyStates[event.code] = false;
  }

  onkeyDown(event) {
    this.keyStates[event.code] = true;

    if (!this.controls.isLocked) {
      this.controls.lock();
    }

    switch (event.code) {
      case "Digit0":
      case "Digit1":
      case "Digit2":
      case "Digit3":
      case "Digit4":
      case "Digit5":
      case "Digit6":
      case "Digit7":
      case "Digit8":
        document
          .getElementById(`toolbar-${this.activeBlockId}`)
          ?.classList.remove("selected");
        this.activeBlockId = Number(event.key);
        document
          .getElementById(`toolbar-${this.activeBlockId}`)
          ?.classList.add("selected");
        this.tool.visible = this.activeBlockId === 0;
        break;

      case "KeyR":
        this.position.set(32, 16, 32);
        this.velocity.set(0, 0, 0);
        break;
      case "Space":
        if (this.onGround) {
          this.velocity.y = this.jumpSpeed;
        }
        break;
    }
  }

  toString() {
    return `X: ${this.position.x.toFixed(1)} Y: ${this.position.y.toFixed(
      1
    )} Z: ${this.position.z.toFixed(1)}`;
  }
}
