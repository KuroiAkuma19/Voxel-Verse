import * as THREE from "three";

// Animation Not working (tool is loading )

export class Tool extends THREE.Group {
  // Whether the tool is currently animating or not
  animate = false;

  // Amplitude of the animation (bigger = more swing)
  animationAmplitude = 0.8;

  // Duration of animation in ms
  animationDuration = 1000;

  // Start time for the animation
  animationStart = 0;

  // The 3D mesh of the actual tool
  toolMesh = undefined;

  get animationTime() {
    return performance.now() - this.animationStart;
  }

  startAnimation() {
    this.animate = true;
    this.animationStart = performance.now();
  }

  update() {
    if (!this.animate || !this.toolMesh) return;
    let progress = this.animationTime / this.animationDuration;
    if (progress >= 1) {
      // Animation finished
      this.animate = false;
      this.rotation.x = -Math.PI / 4; // Reset to idle position
      return;
    }
    // Smooth swing: sine wave from 0 to π
    let swing = Math.sin(progress * Math.PI);

    this.rotation.x = -Math.PI / 4 + this.animationAmplitude * swing;
  }
  /**
   * @param {THREE.Mesh} mesh
   */
  setMesh(mesh) {
    this.clear();
    this.toolMesh = mesh;
    this.add(this.toolMesh);
    this.receiveShadow = true;
    this.castShadow = true;
    // Positioning in front of camera
    this.position.set(0.8, -0.3, -1.0);

    // Scale to proper size
    this.scale.set(0.05, 0.05, 0.05);

    // Initial rotation values (idle)
    this.rotation.z = Math.PI / 1.5;
    this.rotation.y = Math.PI + 1.5;
    // this.rotation.x = -Math.PI / 4;
  }
}
