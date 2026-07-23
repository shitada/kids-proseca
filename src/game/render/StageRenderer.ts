import * as THREE from "three";
import type { StageConfig } from "../config/stages";
import type { JudgementKind, LaneIndex, NoteState } from "../rhythm/types";

interface LanePulse {
  until: number;
  kind: JudgementKind;
}

interface ParticleBurst {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  velocities: Float32Array;
  startedAt: number;
}

export class StageRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly stage: StageConfig;
  private readonly trainVisuals = new Map<string, THREE.Group>();
  private readonly laneLights: THREE.MeshBasicMaterial[] = [];
  private readonly lanePulses: LanePulse[] = [
    { until: 0, kind: "empty" },
    { until: 0, kind: "empty" },
  ];
  private assistLane: LaneIndex | null = null;
  private readonly particlePool: ParticleBurst[] = [];
  private nextParticleBurst = 0;
  private readonly resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, stage: StageConfig) {
    this.stage = stage;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(stage.theme.sky);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(stage.theme.sky, 24, 54);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 8.5, 11);
    this.camera.lookAt(0, 0.2, -10);

    this.createLighting();
    this.createRailway();
    this.createCity();
    this.createTrainVisuals();
    this.createParticlePool();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  render(states: readonly NoteState[], elapsed: number): void {
    const startZ = -31;
    const hitZ = 1.2;

    for (const state of states) {
      const visual = this.trainVisuals.get(state.note.id);
      if (!visual) {
        continue;
      }

      const timeUntilHit = state.note.time - elapsed;
      const visible =
        state.status === "holding" ||
        (state.status === "pending" &&
          timeUntilHit <= this.stage.leadTime &&
          timeUntilHit >= -0.35);
      visual.visible = visible;

      if (!visible) {
        continue;
      }

      const progress = (this.stage.leadTime - timeUntilHit) / this.stage.leadTime;
      visual.position.z =
        state.status === "holding"
          ? hitZ
          : THREE.MathUtils.lerp(startZ, hitZ, progress);
      visual.position.y = 0.58 + Math.sin(elapsed * 8 + state.note.lane) * 0.025;
    }

    this.laneLights.forEach((material, lane) => {
      const pulse = this.lanePulses[lane];
      if (pulse && elapsed < pulse.until) {
        material.color.setHex(
          pulse.kind === "perfect" ? 0xffff8a : this.stage.theme.train,
        );
        material.opacity = 0.82;
      } else {
        const assisted = lane === this.assistLane;
        material.color.setHex(
          assisted ? this.stage.theme.train : this.stage.theme.accent,
        );
        material.opacity = assisted ? 0.72 : 0.34;
      }
    });

    this.updateParticles(elapsed);
    this.renderer.render(this.scene, this.camera);
  }

  pulseLane(lane: LaneIndex, kind: JudgementKind, elapsed: number): void {
    this.lanePulses[lane] = { until: elapsed + 0.2, kind };
    const burst = this.particlePool[this.nextParticleBurst];
    if (!burst) {
      return;
    }

    this.nextParticleBurst =
      (this.nextParticleBurst + 1) % this.particlePool.length;
    burst.startedAt = elapsed;
    burst.points.position.set(lane === 0 ? -2 : 2, 0.65, 1.2);
    burst.points.visible = true;
    burst.points.material.color.setHex(
      kind === "perfect" ? 0xffed75 : this.stage.theme.train,
    );
    burst.points.material.opacity = 1;
  }

  setAssistLane(lane: LaneIndex | null): void {
    this.assistLane = lane;
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();

    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Points)) {
        return;
      }

      geometries.add(object.geometry);
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => materials.add(material));
      } else {
        materials.add(object.material);
      }
    });

    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this.renderer.dispose();
  }

  private createLighting(): void {
    const ambient = new THREE.HemisphereLight(0xffffff, 0x355067, 2.4);
    const sun = new THREE.DirectionalLight(0xffffff, 2.8);
    sun.position.set(-8, 14, 10);
    this.scene.add(ambient, sun);
  }

  private createRailway(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 68),
      new THREE.MeshToonMaterial({ color: this.stage.theme.ground }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.08, -14);
    this.scene.add(ground);

    const railGeometry = new THREE.BoxGeometry(0.12, 0.09, 35);
    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9e2ec,
      metalness: 0.7,
      roughness: 0.38,
    });
    const sleeperGeometry = new THREE.BoxGeometry(2.2, 0.08, 0.24);
    const sleeperMaterial = new THREE.MeshToonMaterial({ color: 0x754b32 });

    [-2, 2].forEach((laneX, lane) => {
      [-0.66, 0.66].forEach((offset) => {
        const rail = new THREE.Mesh(railGeometry, railMaterial);
        rail.position.set(laneX + offset, 0.04, -14.5);
        this.scene.add(rail);
      });

      for (let z = -31; z <= 3; z += 1.35) {
        const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
        sleeper.position.set(laneX, 0, z);
        this.scene.add(sleeper);
      }

      const laneLightMaterial = new THREE.MeshBasicMaterial({
        color: this.stage.theme.accent,
        transparent: true,
        opacity: 0.34,
      });
      const laneLight = new THREE.Mesh(
        new THREE.BoxGeometry(3.35, 0.05, 0.48),
        laneLightMaterial,
      );
      laneLight.position.set(laneX, 0.13, 1.25);
      this.laneLights[lane] = laneLightMaterial;
      this.scene.add(laneLight);
    });

    const platformMaterial = new THREE.MeshToonMaterial({ color: 0xf6f2dd });
    const warningMaterial = new THREE.MeshToonMaterial({ color: 0xffcf33 });

    [-4.45, 0, 4.45].forEach((x) => {
      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(x === 0 ? 0.7 : 1.5, 0.32, 5.4),
        platformMaterial,
      );
      platform.position.set(x, 0.08, 1.2);
      this.scene.add(platform);

      const warning = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.05, 5.4),
        warningMaterial,
      );
      warning.position.set(x === 0 ? x : x + (x < 0 ? 0.72 : -0.72), 0.27, 1.2);
      this.scene.add(warning);
    });
  }

  private createCity(): void {
    let seed = 17;
    const random = (): number => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const colors = [0xf7b267, 0xf79d84, 0xa8dadc, 0xb8c0ff, 0xffffff];

    for (let index = 0; index < 54; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const width = 1.3 + random() * 2.5;
      const depth = 1.4 + random() * 2.8;
      const height = 1.8 + random() * 6.5;
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshToonMaterial({
          color: colors[Math.floor(random() * colors.length)],
        }),
      );
      building.position.set(
        side * (6.2 + random() * 7),
        height / 2 - 0.02,
        1 - random() * 48,
      );
      this.scene.add(building);
    }

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(2.1, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffef9f }),
    );
    sun.position.set(-10, 12, -38);
    this.scene.add(sun);
  }

  private createTrainVisuals(): void {
    for (const note of this.stage.notes) {
      const carriageCount =
        note.type === "hold"
          ? Math.min(4, Math.max(2, Math.ceil(note.duration * 1.5)))
          : 1;
      const visual = this.createTrain(carriageCount);
      visual.position.x = note.lane === 0 ? -2 : 2;
      visual.visible = false;
      this.trainVisuals.set(note.id, visual);
      this.scene.add(visual);
    }
  }

  private createParticlePool(): void {
    const particleCount = 22;

    for (let poolIndex = 0; poolIndex < 8; poolIndex += 1) {
      const positions = new Float32Array(particleCount * 3);
      const velocities = new Float32Array(particleCount * 3);

      for (let index = 0; index < particleCount; index += 1) {
        const angle = (index / particleCount) * Math.PI * 2;
        const speed = 1.3 + (index % 5) * 0.24;
        velocities[index * 3] = Math.cos(angle) * speed;
        velocities[index * 3 + 1] = 1.2 + (index % 4) * 0.32;
        velocities[index * 3 + 2] = Math.sin(angle) * speed;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      const material = new THREE.PointsMaterial({
        color: this.stage.theme.accent,
        size: 0.2,
        transparent: true,
        depthWrite: false,
      });
      const points = new THREE.Points(geometry, material);
      points.visible = false;
      this.scene.add(points);
      this.particlePool.push({ points, velocities, startedAt: 0 });
    }
  }

  private updateParticles(elapsed: number): void {
    for (const burst of this.particlePool) {
      if (!burst.points.visible) {
        continue;
      }

      const age = elapsed - burst.startedAt;
      if (age >= 0.7) {
        burst.points.visible = false;
        continue;
      }

      const position = burst.points.geometry.getAttribute("position");
      for (let index = 0; index < position.count; index += 1) {
        const velocityOffset = index * 3;
        position.setXYZ(
          index,
          burst.velocities[velocityOffset] * age,
          burst.velocities[velocityOffset + 1] * age - age * age * 2.4,
          burst.velocities[velocityOffset + 2] * age,
        );
      }
      position.needsUpdate = true;
      burst.points.material.opacity = 1 - age / 0.7;
    }
  }

  private createTrain(carriageCount: number): THREE.Group {
    const group = new THREE.Group();
    const bodyMaterial = new THREE.MeshToonMaterial({
      color: this.stage.theme.train,
    });
    const silverMaterial = new THREE.MeshToonMaterial({ color: 0xe8edf2 });
    const glassMaterial = new THREE.MeshToonMaterial({ color: 0x12324a });
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff3ad });

    for (let carriage = 0; carriage < carriageCount; carriage += 1) {
      const z = carriage * -2.78;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.86, 2.6),
        bodyMaterial,
      );
      body.position.set(0, 0.5, z);
      group.add(body);

      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(2.18, 0.2, 2.36),
        silverMaterial,
      );
      roof.position.set(0, 1.01, z);
      group.add(roof);
    }

    const face = new THREE.Mesh(
      new THREE.BoxGeometry(2.14, 0.62, 0.16),
      silverMaterial,
    );
    face.position.set(0, 0.55, 1.37);
    group.add(face);

    const windowGeometry = new THREE.BoxGeometry(0.78, 0.3, 0.04);
    [-0.49, 0.49].forEach((x) => {
      const windowMesh = new THREE.Mesh(windowGeometry, glassMaterial);
      windowMesh.position.set(x, 0.69, 1.46);
      group.add(windowMesh);
    });

    const lightGeometry = new THREE.SphereGeometry(0.08, 12, 8);
    [-0.82, 0.82].forEach((x) => {
      const light = new THREE.Mesh(lightGeometry, lightMaterial);
      light.position.set(x, 0.35, 1.49);
      group.add(light);
    });

    return group;
  }

  private resize(): void {
    const canvas = this.renderer.domElement;
    const width = Math.max(canvas.clientWidth, 1);
    const height = Math.max(canvas.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
