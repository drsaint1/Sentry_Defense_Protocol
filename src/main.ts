import "./style.css";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Raycaster,
  Scene,
  SphereGeometry,
  CapsuleGeometry,
  ConeGeometry,
  TorusGeometry,
  Vector3,
  Vector2,
  WebGLRenderer,
  Clock,
  CylinderGeometry
} from "three";
import OneLabsProvider from "./onelabs/OneLabsProvider";
import GameOverlay from "./ui/GameOverlay";
import {
  grantTokenBonus,
  recordKillReward,
  registerGameActions,
  setActiveMachineFromGame,
  setGameReadiness,
  updateBridgeFromGame
} from "./ui/gameBridge";

export function returnToMenu() {
  setGameReadiness(false);
  setActiveMachineFromGame(undefined);
  updateBridgeFromGame({ gameOver: false, gameReady: false });
}

export function restartGame() {
  resetGame();
  updateBridgeFromGame({ gameOver: false });
}

type GameState = "playing" | "dead";

type Bullet = {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
};

type Enemy = {
  mesh: Group;
  velocity: Vector3;
  health: number;
  speed: number;
  radius: number;
  halfHeight: number;
  idlePhase: number;
  bobRate: number;
};

type PowerUpType = "rapid-fire" | "shield" | "explosive";

type PowerUp = {
  mesh: Mesh;
  type: PowerUpType;
  timeToLive: number;
};

const WORLD_RADIUS = 110;
const ENEMY_SPAWN_RADIUS = 70;
const ENEMY_TARGET_RADIUS = 4;
const BULLET_SPEED = 90;
const BULLET_LIFETIME = 2.8;
const BASE_FIRE_RATE = 0.16;
const RAPID_FIRE_MULTIPLIER = 0.5;
const EXPLOSIVE_RADIUS = 10;
const POWER_UP_LIFETIME = 12;
const POWER_UP_DROP_CHANCE = 0.22;
const POWER_PICKUP_RADIUS = 5;
const AIM_PLANE_HEIGHT = 2.4;
const MIN_INTERMISSION = 2.2;
const MAX_INTERMISSION = 4.2;
const MIN_AIM_DISTANCE = 10;
const MAX_AIM_DISTANCE = 85;
const KEYBOARD_AIM_SPEED = 36;
const TOKENS_PER_KILL = 4;
const WAVE_CLEAR_BONUS = 12;
const DEPLOYMENT_BONUS = 25;
const ENEMY_COLOR_PRESETS = [
  { limb: 0x3b5162, torso: 0xff7a7a, head: 0xffd9c7 },
  { limb: 0x5b7553, torso: 0xfcd77f, head: 0xffefdf },
  { limb: 0x7c5c6d, torso: 0x9fd7ff, head: 0xf8d5ff },
  { limb: 0x3d4f63, torso: 0xa5f0c5, head: 0xfafff2 }
] as const;

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) {
  throw new Error("Missing app root");
}

const uiRootElement = document.createElement("div");
uiRootElement.id = "ui-root";
document.body.appendChild(uiRootElement);
const uiRoot = createRoot(uiRootElement);
uiRoot.render(createElement(OneLabsProvider, null, createElement(GameOverlay)));

const scene = new Scene();
scene.background = new Color(0xb9dcff);
scene.fog = new FogExp2(0xd8ecff, 0.01);

const camera = new PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 32, 46);
camera.lookAt(new Vector3(0, 4, 0));

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.domElement.style.touchAction = "none";
appRoot.appendChild(renderer.domElement);

const clock = new Clock();

const ambient = new AmbientLight(0xf3fbff, 0.55);
scene.add(ambient);

const sun = new DirectionalLight(0xfff0c1, 0.95);
sun.position.set(28, 60, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const ground = new Mesh(
  new PlaneGeometry(WORLD_RADIUS, WORLD_RADIUS),
  new MeshStandardMaterial({ color: 0x8fb77b, roughness: 0.9 })
);
ground.receiveShadow = true;
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

let turret: Group;
let gunPivot: Group;
let muzzlePoints: Object3D[] = [];
let muzzleIndex = 0;
let bulletGeometryActive: BufferGeometry = new BoxGeometry(0.4, 0.4, 2);
let bulletMaterialActive: MeshStandardMaterial = new MeshStandardMaterial({
  color: 0xfff2a6,
  emissive: 0xffd166,
  roughness: 0.3
});
type MachineBuild = {
  root: Group;
  gunPivot: Group;
  muzzlePoints: Object3D[];
  bulletGeometry: BufferGeometry;
  bulletMaterial: MeshStandardMaterial;
};

type MachineVariant = {
  id: string;
  name: string;
  description: string;
  build: () => MachineBuild;
};

type WaveTuning = {
  count: number;
  baseHealth: number;
  baseSpeed: number;
  maxSimultaneous: number;
  spawnInterval: { min: number; max: number };
};

function createVariantSentinel(): MachineBuild {
  const root = new Group();

  const basePlate = new Mesh(
    new CylinderGeometry(7.2, 8, 1.4, 28),
    new MeshStandardMaterial({ color: 0x1a232f, roughness: 0.88 })
  );
  basePlate.castShadow = true;
  basePlate.receiveShadow = true;
  basePlate.position.y = 0.7;
  root.add(basePlate);

  const stabilizer = new Mesh(
    new CylinderGeometry(4.2, 5.4, 3.8, 24),
    new MeshStandardMaterial({ color: 0x273240, roughness: 0.72 })
  );
  stabilizer.castShadow = true;
  stabilizer.receiveShadow = true;
  stabilizer.position.y = 3;
  root.add(stabilizer);

  const swivel = new Mesh(
    new CylinderGeometry(3.4, 3.4, 2.2, 20),
    new MeshStandardMaterial({ color: 0x334150, roughness: 0.55, metalness: 0.25 })
  );
  swivel.castShadow = true;
  swivel.receiveShadow = true;
  swivel.position.y = 5;
  root.add(swivel);

  const turretHead = new Mesh(
    new BoxGeometry(5.4, 3.6, 4.8),
    new MeshStandardMaterial({ color: 0x6f8199, roughness: 0.38, metalness: 0.32 })
  );
  turretHead.castShadow = true;
  turretHead.position.set(0, 6.6, 0);
  root.add(turretHead);

  const sensorModule = new Mesh(
    new BoxGeometry(2.4, 1.1, 1.4),
    new MeshStandardMaterial({ color: 0xaec2dd, emissive: 0x1a2738, roughness: 0.28 })
  );
  sensorModule.castShadow = true;
  sensorModule.position.set(0, 7.9, 2.6);
  root.add(sensorModule);

  const ammoBox = new Mesh(
    new BoxGeometry(2.8, 2.2, 4.6),
    new MeshStandardMaterial({ color: 0x2b3745, roughness: 0.6 })
  );
  ammoBox.castShadow = true;
  ammoBox.position.set(-3.9, 6.2, -0.5);
  root.add(ammoBox);

  const feedTray = new Mesh(
    new BoxGeometry(1.4, 0.7, 3.8),
    new MeshStandardMaterial({ color: 0x909fb3, roughness: 0.4 })
  );
  feedTray.castShadow = true;
  feedTray.position.set(-1.6, 6.9, 1.4);
  feedTray.rotation.y = -0.32;
  root.add(feedTray);

  const pivot = new Group();
  pivot.position.set(0, 6.9, 0.7);
  root.add(pivot);

  const recoilShield = new Mesh(
    new BoxGeometry(3.6, 3, 0.7),
    new MeshStandardMaterial({ color: 0x49586c, roughness: 0.46 })
  );
  recoilShield.castShadow = true;
  recoilShield.position.set(0, 0.3, -0.8);
  pivot.add(recoilShield);

  const cradle = new Mesh(
    new BoxGeometry(2.8, 1.8, 3.8),
    new MeshStandardMaterial({ color: 0x5d6f84, roughness: 0.42 })
  );
  cradle.castShadow = true;
  cradle.position.set(0, 0, 1.8);
  pivot.add(cradle);

  const barrelCluster = new Group();
  barrelCluster.position.set(0, 0, 2.5);
  pivot.add(barrelCluster);

  const barrelMaterial = new MeshStandardMaterial({ color: 0xb4becb, roughness: 0.28, metalness: 0.62 });
  const barrelGeometry = new CylinderGeometry(0.38, 0.38, 7.8, 18);

  function createBarrel(offsetX: number) {
    const barrel = new Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(offsetX, 0, 3.9);
    barrel.castShadow = true;
    barrelCluster.add(barrel);

    const muzzleBrake = new Mesh(
      new BoxGeometry(0.8, 0.8, 1.4),
      new MeshStandardMaterial({ color: 0x1f2a36, roughness: 0.35, metalness: 0.45 })
    );
    muzzleBrake.castShadow = true;
    muzzleBrake.position.set(offsetX, 0, 7.8);
    barrelCluster.add(muzzleBrake);

    const coolingSleeve = new Mesh(
      new CylinderGeometry(0.55, 0.55, 3.2, 16),
      new MeshStandardMaterial({ color: 0x343f4c, roughness: 0.5 })
    );
    coolingSleeve.rotation.x = Math.PI / 2;
    coolingSleeve.position.set(offsetX, 0, 2);
    barrelCluster.add(coolingSleeve);
  }

  createBarrel(-0.55);
  createBarrel(0.55);

  const optic = new Mesh(
    new BoxGeometry(1.2, 0.8, 2.2),
    new MeshStandardMaterial({ color: 0x8da2bc, emissive: 0x1e2f44, roughness: 0.35 })
  );
  optic.castShadow = true;
  optic.position.set(0.8, 1, 1.4);
  pivot.add(optic);

  const muzzleLeft = new Object3D();
  muzzleLeft.position.set(-0.55, 0, 8.2);
  barrelCluster.add(muzzleLeft);

  const muzzleRight = new Object3D();
  muzzleRight.position.set(0.55, 0, 8.2);
  barrelCluster.add(muzzleRight);

  const bulletGeometry = new BoxGeometry(0.45, 0.45, 2.4);
  const bulletMaterial = new MeshStandardMaterial({
    color: 0xfff2a6,
    emissive: 0xffd166,
    roughness: 0.3
  });

  return {
    root,
    gunPivot: pivot,
    muzzlePoints: [muzzleLeft, muzzleRight],
    bulletGeometry,
    bulletMaterial
  };
}

function createVariantBulwark(): MachineBuild {
  const root = new Group();

  const base = new Mesh(
    new CylinderGeometry(8.4, 9.2, 1.8, 32),
    new MeshStandardMaterial({ color: 0x232f36, roughness: 0.8 })
  );
  base.castShadow = true;
  base.receiveShadow = true;
  base.position.y = 0.9;
  root.add(base);

  const armoredCore = new Mesh(
    new CylinderGeometry(5.4, 6.4, 4.6, 26),
    new MeshStandardMaterial({ color: 0x364853, roughness: 0.58, metalness: 0.25 })
  );
  armoredCore.castShadow = true;
  armoredCore.position.y = 3.6;
  root.add(armoredCore);

  const guardRing = new Mesh(
    new TorusGeometry(4.8, 0.5, 12, 28),
    new MeshStandardMaterial({ color: 0x1f2b34, roughness: 0.42 })
  );
  guardRing.rotation.x = Math.PI / 2;
  guardRing.position.y = 4.8;
  root.add(guardRing);

  const pivot = new Group();
  pivot.position.set(0, 6.8, 0.4);
  root.add(pivot);

  const armorPlates = new Mesh(
    new BoxGeometry(6.6, 3.2, 5),
    new MeshStandardMaterial({ color: 0x5c7385, roughness: 0.36, metalness: 0.35 })
  );
  armorPlates.castShadow = true;
  armorPlates.position.set(0, 0.8, 0);
  pivot.add(armorPlates);

  const exhausts = new Mesh(
    new BoxGeometry(2.4, 2, 5.8),
    new MeshStandardMaterial({ color: 0x2a363f, roughness: 0.52 })
  );
  exhausts.castShadow = true;
  exhausts.position.set(-3.2, 0.5, -0.4);
  pivot.add(exhausts);

  const upperArray = new Group();
  upperArray.position.set(0, 0, 3.2);
  pivot.add(upperArray);

  const barrelMaterial = new MeshStandardMaterial({ color: 0xb7d0df, roughness: 0.24, metalness: 0.55 });
  const barrelGeom = new CylinderGeometry(0.32, 0.42, 9.6, 20);

  const muzzlePoints: Object3D[] = [];
  const barrelOffsets = [-0.9, 0, 0.9];
  for (const offset of barrelOffsets) {
    const barrel = new Mesh(barrelGeom, barrelMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(offset, 0.3, 4.5);
    barrel.castShadow = true;
    upperArray.add(barrel);

    const muzzle = new Object3D();
    muzzle.position.set(offset, 0.3, 9.1);
    upperArray.add(muzzle);
    muzzlePoints.push(muzzle);

    const coolingFins = new Mesh(
      new BoxGeometry(0.4, 0.8, 2.4),
      new MeshStandardMaterial({ color: 0x29343c, roughness: 0.5 })
    );
    coolingFins.castShadow = true;
    coolingFins.position.set(offset, 0.3, 2.2);
    upperArray.add(coolingFins);
  }

  const sights = new Mesh(
    new BoxGeometry(1.8, 1.2, 2.8),
    new MeshStandardMaterial({ color: 0x9fb6c6, emissive: 0x162433, roughness: 0.28 })
  );
  sights.castShadow = true;
  sights.position.set(1.9, 1.1, 1.6);
  pivot.add(sights);

  const bulletGeometry = new CylinderGeometry(0.35, 0.2, 3.6, 12);
  bulletGeometry.rotateX(Math.PI / 2);
  const bulletMaterial = new MeshStandardMaterial({
    color: 0xcfdff3,
    emissive: 0x6fb1ff,
    emissiveIntensity: 0.6,
    roughness: 0.25,
    metalness: 0.2
  });

  return {
    root,
    gunPivot: pivot,
    muzzlePoints,
    bulletGeometry,
    bulletMaterial
  };
}

function createVariantStorm(): MachineBuild {
  const root = new Group();

  const base = new Mesh(
    new CylinderGeometry(6.8, 7.6, 1.6, 28),
    new MeshStandardMaterial({ color: 0x1b213a, roughness: 0.65 })
  );
  base.castShadow = true;
  base.receiveShadow = true;
  base.position.y = 0.8;
  root.add(base);

  const ringLower = new Mesh(
    new TorusGeometry(5.4, 0.5, 18, 36),
    new MeshStandardMaterial({ color: 0x23304f, roughness: 0.42 })
  );
  ringLower.rotation.x = Math.PI / 2;
  ringLower.position.y = 3.8;
  root.add(ringLower);

  const innerColumn = new Mesh(
    new CylinderGeometry(3.4, 3.9, 4.6, 24),
    new MeshStandardMaterial({ color: 0x2d3a68, roughness: 0.5, metalness: 0.2 })
  );
  innerColumn.castShadow = true;
  innerColumn.position.y = 4.4;
  root.add(innerColumn);

  const pivot = new Group();
  pivot.position.set(0, 6.6, 0);
  root.add(pivot);

  const swivel = new Group();
  swivel.position.set(0, 1.6, 0);
  pivot.add(swivel);

  const swivelBase = new Mesh(
    new CylinderGeometry(3.1, 3.1, 1.4, 24),
    new MeshStandardMaterial({ color: 0x384a82, roughness: 0.42 })
  );
  swivelBase.castShadow = true;
  swivel.add(swivelBase);

  const coreSpine = new Mesh(
    new CylinderGeometry(1.8, 1.8, 3.6, 20),
    new MeshStandardMaterial({ color: 0x4658c0, emissive: 0x1d2a7f, emissiveIntensity: 0.6, roughness: 0.28 })
  );
  coreSpine.castShadow = true;
  coreSpine.position.y = 2.2;
  swivel.add(coreSpine);

  const headShell = new Mesh(
    new BoxGeometry(4.8, 2.2, 4.2),
    new MeshStandardMaterial({ color: 0x97b4ff, roughness: 0.3, metalness: 0.35 })
  );
  headShell.castShadow = true;
  headShell.position.set(0, 3.6, 0.4);
  swivel.add(headShell);

  const visorFrame = new Mesh(
    new BoxGeometry(3.6, 1.2, 0.6),
    new MeshStandardMaterial({ color: 0x1b254f, emissive: 0x173271, emissiveIntensity: 0.8 })
  );
  visorFrame.position.set(0, 3.8, 2.3);
  swivel.add(visorFrame);

  const crest = new Mesh(
    new CylinderGeometry(1.1, 1.6, 1.6, 16),
    new MeshStandardMaterial({ color: 0x4a5ce0, emissive: 0x2130b8, emissiveIntensity: 0.5, roughness: 0.22 })
  );
  crest.rotation.x = Math.PI / 2;
  crest.position.set(0, 4.6, 0.2);
  swivel.add(crest);

  const emitterFrame = new Group();
  emitterFrame.position.set(0, 3.2, 2.5);
  swivel.add(emitterFrame);

  const muzzlePoints: Object3D[] = [];
  const nozzleOffsets = [
    new Vector3(-1.2, 0.3, 0),
    new Vector3(1.2, 0.3, 0),
    new Vector3(-0.8, -0.8, 0.2),
    new Vector3(0.8, -0.8, 0.2)
  ];

  const nozzleMaterial = new MeshStandardMaterial({ color: 0xc8e8ff, emissive: 0x66b7ff, emissiveIntensity: 0.9, roughness: 0.2 });

  for (const offset of nozzleOffsets) {
    const housing = new Mesh(new CylinderGeometry(0.35, 0.35, 1.6, 14), nozzleMaterial);
    housing.rotation.x = Math.PI / 2;
    housing.position.copy(offset.clone().add(new Vector3(0, 0, 0.4)));
    emitterFrame.add(housing);

    const tip = new Mesh(new ConeGeometry(0.28, 0.9, 16), nozzleMaterial.clone());
    tip.rotation.x = Math.PI / 2;
    tip.position.copy(offset.clone().add(new Vector3(0, 0, 1.6)));
    emitterFrame.add(tip);

    const muzzle = new Object3D();
    muzzle.position.copy(offset.clone().add(new Vector3(0, 0, 2.3)));
    emitterFrame.add(muzzle);
    muzzlePoints.push(muzzle);
  }

  const sideFinsMaterial = new MeshStandardMaterial({ color: 0x6b7df0, emissive: 0x3243c3, emissiveIntensity: 0.6 });
  const finLeft = new Mesh(new BoxGeometry(0.5, 2.4, 5.8), sideFinsMaterial);
  finLeft.position.set(-2.6, 3.2, 0.4);
  swivel.add(finLeft);
  const finRight = finLeft.clone();
  finRight.position.x = 2.6;
  swivel.add(finRight);

  const bulletGeometry = new SphereGeometry(0.8, 18, 18);
  bulletGeometry.scale(1, 1, 1.4);
  const bulletMaterial = new MeshStandardMaterial({
    color: 0x9fe7ff,
    emissive: 0x65d1ff,
    emissiveIntensity: 1.1,
    roughness: 0.16
  });

  return {
    root,
    gunPivot: pivot,
    muzzlePoints,
    bulletGeometry,
    bulletMaterial
  };
}

const machineVariants: MachineVariant[] = [
  {
    id: "sentinel",
    name: "Sentinel Mk I",
    description: "Balanced dual-barrel defense platform. Standard brass rounds.",
    build: createVariantSentinel
  },
  {
    id: "bulwark",
    name: "Bulwark Mk II",
    description: "Armored triple-barrel cannon with ion darts.",
    build: createVariantBulwark
  },
  {
    id: "storm",
    name: "Stormcaster Mk III",
    description: "Energy projector firing plasma spheres.",
    build: createVariantStorm
  }
];

let selectedVariantIndex = -1;
let selectionActive = true;

function applyMachineVariant(index: number) {
  const variant = machineVariants[index];
  if (!variant) {
    return;
  }
  const build = variant.build();
  if (turret) {
    scene.remove(turret);
  }
  turret = build.root;
  gunPivot = build.gunPivot;
  muzzlePoints = build.muzzlePoints;
  bulletGeometryActive = build.bulletGeometry;
  bulletMaterialActive = build.bulletMaterial;
  turret.position.set(0, 0, 0);
  scene.add(turret);
  muzzleIndex = 0;
  selectedVariantIndex = index;
  turret.updateMatrixWorld(true);
  alignTurretToNeutralPose();
  setActiveMachineFromGame(variant.id);
  setStatus(`${variant.name} calibrated. Awaiting deployment command.`);
}

function handleVariantSelection(index: number) {
  applyMachineVariant(index);
  selectionActive = false;
  setGameReadiness(true);
}

registerGameActions({
  selectMachine(machineId: string) {
    const index = machineVariants.findIndex((variant) => variant.id === machineId);
    if (index === -1) {
      return false;
    }
    handleVariantSelection(index);
    return true;
  },
  startSession() {
    if (!turret || !gunPivot) return;
    resetGame();
    grantTokenBonus(DEPLOYMENT_BONUS);
  }
});

const aimPlane = new Plane(new Vector3(0, 1, 0), -AIM_PLANE_HEIGHT);
const aimTarget = new Vector3(0, AIM_PLANE_HEIGHT, 28);
const raycaster = new Raycaster();
const pointer = new Vector3(0, 0, 0);
const pointerNDC = new Vector2();
const aimDirection = new Vector3(0, 0, 1);
const turretPickupPoint = new Vector3(0, 1.5, 0);
const pivotWorld = new Vector3();
const horizontalScratch = new Vector3();
const keyboardDelta = new Vector3();
const muzzleWorld = new Vector3();
const forwardVector = new Vector3(0, 0, 1);
const directionScratch = new Vector3();
const neutralAimTarget = new Vector3();

const aimInputState = {
  up: false,
  down: false,
  left: false,
  right: false
};

let gameState: GameState = "dead";
let fireCooldown = 0;
let score = 0;
let wave = 1;
let enemiesToSpawn = 0;
let intermission = 2.5;
let spawnCooldown = 0;
let shieldCharges = 0;
let statusMessage = "Connect a wallet to deploy a defense platform.";
let waveTuning: WaveTuning = getWaveTuning(1);
let elapsedTime = 0;

const bullets: Bullet[] = [];
const enemies: Enemy[] = [];
const powerUps: PowerUp[] = [];
let lastScoreDisplayed = 0;

let rapidFireTimer = 0;
let explosiveTimer = 0;
let submitScoreRecord = 0;

function setStatus(message: string) {
  statusMessage = message;
  pushBridgeStats();
}

function alignTurretToNeutralPose() {
  if (!gunPivot) return;
  const pivotPos = gunPivot.getWorldPosition(pivotWorld);
  const neutralDistance = Math.max(MIN_AIM_DISTANCE * 2, 30);
  neutralAimTarget.set(pivotPos.x, pivotPos.y, pivotPos.z + neutralDistance);
  orientTurretTowards(neutralAimTarget);
  aimTarget.set(0, AIM_PLANE_HEIGHT, neutralDistance);
}

setStatus("Connect a wallet to mint and deploy a machine.");

function clampAimTarget() {
  horizontalScratch.set(aimTarget.x, 0, aimTarget.z);
  let distance = horizontalScratch.length();
  if (distance < 0.0001) {
    horizontalScratch.set(0, 0, MIN_AIM_DISTANCE);
    distance = MIN_AIM_DISTANCE;
  }
  if (distance < MIN_AIM_DISTANCE) {
    horizontalScratch.setLength(MIN_AIM_DISTANCE);
  } else if (distance > MAX_AIM_DISTANCE) {
    horizontalScratch.setLength(MAX_AIM_DISTANCE);
  }
  aimTarget.set(horizontalScratch.x, AIM_PLANE_HEIGHT, horizontalScratch.z);
}

function orientTurretTowards(target: Vector3) {
  if (!turret || !gunPivot) return;
  const pivotPos = gunPivot.getWorldPosition(pivotWorld);
  directionScratch.copy(target).sub(pivotPos);
  if (directionScratch.lengthSq() < 1e-6) {
    directionScratch.set(0, 0, 1);
  }
  directionScratch.normalize();
  const yaw = Math.atan2(directionScratch.x, directionScratch.z);
  const horizontalLen = Math.sqrt(directionScratch.x * directionScratch.x + directionScratch.z * directionScratch.z);
  let pitch = Math.atan2(directionScratch.y, horizontalLen);
  pitch = Math.max(Math.min(pitch, 0.5), -0.9);
  turret.rotation.y = yaw;
  gunPivot.rotation.x = pitch;

  const cosPitch = Math.cos(pitch);
  aimDirection.set(Math.sin(yaw) * cosPitch, Math.sin(pitch), Math.cos(yaw) * cosPitch);
}

function setAimTargetFromPoint(point: Vector3) {
  if (!gunPivot) return;
  aimTarget.copy(point);
  aimTarget.y = AIM_PLANE_HEIGHT;
  clampAimTarget();
  orientTurretTowards(aimTarget);
}

function updateKeyboardAim(dt: number) {
  if (selectionActive || !gunPivot) return;
  keyboardDelta.set(
    (aimInputState.right ? 1 : 0) - (aimInputState.left ? 1 : 0),
    0,
    (aimInputState.up ? 1 : 0) - (aimInputState.down ? 1 : 0)
  );
  if (keyboardDelta.lengthSq() === 0) {
    return;
  }
  keyboardDelta.normalize().multiplyScalar(KEYBOARD_AIM_SPEED * dt);
  aimTarget.add(keyboardDelta);
  aimTarget.y = AIM_PLANE_HEIGHT;
  clampAimTarget();
  orientTurretTowards(aimTarget);
}

function handleAimKey(code: string, isDown: boolean) {
  switch (code) {
    case "ArrowUp":
    case "KeyW":
      aimInputState.up = isDown;
      return true;
    case "ArrowDown":
    case "KeyS":
      aimInputState.down = isDown;
      return true;
    case "ArrowLeft":
    case "KeyA":
      aimInputState.left = isDown;
      return true;
    case "ArrowRight":
    case "KeyD":
      aimInputState.right = isDown;
      return true;
    default:
      return false;
  }
}

function resetGame() {
  if (!turret || !gunPivot) {
    selectionActive = true;
    setGameReadiness(false);
    return;
  }
  for (const bullet of bullets) {
    scene.remove(bullet.mesh);
  }
  bullets.length = 0;
  for (const enemy of enemies) {
    scene.remove(enemy.mesh);
  }
  enemies.length = 0;
  for (const power of powerUps) {
    scene.remove(power.mesh);
  }
  powerUps.length = 0;

  score = 0;
  lastScoreDisplayed = 0;
  intermission = 0;
  spawnCooldown = 0;
  fireCooldown = 0;
  rapidFireTimer = 0;
  explosiveTimer = 0;
  shieldCharges = 0;
  gameState = "playing";
  aimInputState.up = aimInputState.down = aimInputState.left = aimInputState.right = false;
  pointer.set(0, AIM_PLANE_HEIGHT, 28);
  alignTurretToNeutralPose();
  beginWave(1, true);
  setStatus("Aim with mouse or arrows/WASD, keep the gun alive.");
  pushBridgeStats();
}

function createHumanoidEnemy(): Group {
  const palette = ENEMY_COLOR_PRESETS[Math.floor(Math.random() * ENEMY_COLOR_PRESETS.length)];
  const group = new Group();
  const lean = (Math.random() - 0.5) * 0.08;
  group.userData.lean = lean;
  group.scale.setScalar(0.9 + Math.random() * 0.2);

  const limbMat = new MeshStandardMaterial({ color: palette.limb, roughness: 0.47 });
  const torsoPrimary = new MeshStandardMaterial({ color: palette.torso, roughness: 0.34, metalness: 0.12 });
  const torsoAccent = torsoPrimary.clone();
  torsoAccent.emissive = new Color(0x221013);
  torsoAccent.emissiveIntensity = 0.35;
  const armorTrimColor = new Color(palette.torso);
  armorTrimColor.offsetHSL(0, 0, 0.08);
  const armorTrim = new MeshStandardMaterial({ color: armorTrimColor, roughness: 0.28, metalness: 0.4 });
  const underSuitMat = new MeshStandardMaterial({ color: 0x111722, roughness: 0.7 });
  const visorMat = new MeshStandardMaterial({ color: 0x1a263b, emissive: 0x132840, emissiveIntensity: 0.95, metalness: 0.85, roughness: 0.18 });
  const detailMat = new MeshStandardMaterial({ color: 0xf0f9ff, emissive: 0x73e8ff, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.18 });
  const headMat = new MeshStandardMaterial({ color: palette.head, roughness: 0.25 });

  const hips = new Mesh(new BoxGeometry(1.4, 0.9, 1.1), limbMat);
  hips.castShadow = true;
  hips.position.set(0, 2.2, 0);
  group.add(hips);

  const pelvisFrame = new Mesh(new TorusGeometry(1.05, 0.12, 12, 36), armorTrim);
  pelvisFrame.rotation.x = Math.PI / 2;
  pelvisFrame.position.set(0, 2.4, 0);
  pelvisFrame.castShadow = true;
  group.add(pelvisFrame);

  const thighGeom = new CapsuleGeometry(0.38, 1.9, 10, 16);
  const calfGeom = new CapsuleGeometry(0.32, 1.5, 10, 16);
  const shinGuardGeom = new BoxGeometry(0.55, 1.5, 0.4);

  const leftThigh = new Mesh(thighGeom, limbMat);
  leftThigh.castShadow = true;
  leftThigh.position.set(-0.55, 3.4, 0.05);
  leftThigh.rotation.z = 0.05;
  group.add(leftThigh);

  const rightThigh = leftThigh.clone();
  rightThigh.position.x = 0.55;
  rightThigh.rotation.z = -0.05;
  group.add(rightThigh);

  const leftCalf = new Mesh(calfGeom, limbMat);
  leftCalf.castShadow = true;
  leftCalf.position.set(-0.55, 1.8, 0.15);
  group.add(leftCalf);

  const rightCalf = leftCalf.clone();
  rightCalf.position.x = 0.55;
  rightCalf.position.z = -0.05;
  group.add(rightCalf);

  const leftShinGuard = new Mesh(shinGuardGeom, torsoAccent.clone());
  leftShinGuard.castShadow = true;
  leftShinGuard.position.set(-0.55, 1.8, 0.32);
  group.add(leftShinGuard);

  const rightShinGuard = leftShinGuard.clone();
  rightShinGuard.position.x = 0.55;
  group.add(rightShinGuard);

  const kneePadGeom = new SphereGeometry(0.32, 12, 12);
  const leftKnee = new Mesh(kneePadGeom, armorTrim);
  leftKnee.position.set(-0.55, 2.6, 0.35);
  group.add(leftKnee);

  const rightKnee = leftKnee.clone();
  rightKnee.position.x = 0.55;
  group.add(rightKnee);

  const bootMaterial = limbMat.clone();
  bootMaterial.metalness = 0.2;
  const leftBoot = new Mesh(new BoxGeometry(0.8, 0.45, 1.4), bootMaterial);
  leftBoot.castShadow = true;
  leftBoot.position.set(-0.55, 0.4, 0.45);
  const leftSole = new Mesh(new BoxGeometry(0.95, 0.2, 1.5), underSuitMat);
  leftSole.position.y = -0.3;
  leftBoot.add(leftSole);
  group.add(leftBoot);

  const rightBoot = leftBoot.clone();
  rightBoot.position.x = 0.55;
  group.add(rightBoot);

  const abdomen = new Mesh(new CapsuleGeometry(0.58, 1.1, 12, 18), underSuitMat);
  abdomen.castShadow = true;
  abdomen.position.set(0, 4.5, 0);
  group.add(abdomen);

  const chest = new Mesh(new BoxGeometry(2, 2.6, 1.4), torsoPrimary);
  chest.castShadow = true;
  chest.position.set(0, 6.3, 0);
  group.add(chest);

  const chestPlate = new Mesh(new CapsuleGeometry(0.85, 1.1, 14, 22), torsoAccent);
  chestPlate.rotation.x = Math.PI / 2;
  chestPlate.castShadow = true;
  chestPlate.position.set(0, 6.5, 0.75);
  group.add(chestPlate);

  const harness = new Mesh(new CapsuleGeometry(1.1, 1.2, 12, 18), armorTrim);
  harness.rotation.z = Math.PI / 2;
  harness.castShadow = true;
  harness.position.set(0, 7.4, 0);
  group.add(harness);

  const utilityBelt = new Mesh(new TorusGeometry(1.05, 0.16, 12, 30), armorTrim);
  utilityBelt.rotation.x = Math.PI / 2;
  utilityBelt.position.set(0, 4.1, 0.05);
  group.add(utilityBelt);

  const backpack = new Mesh(new BoxGeometry(1.2, 2.3, 0.8), armorTrim);
  backpack.castShadow = true;
  backpack.position.set(0, 6.2, -0.9);
  group.add(backpack);

  const batteryPack = new Mesh(new BoxGeometry(1.4, 0.8, 0.5), torsoAccent.clone());
  batteryPack.position.set(0, 5.1, -0.8);
  group.add(batteryPack);

  const collar = new Mesh(new TorusGeometry(0.78, 0.14, 12, 24), armorTrim.clone());
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 7.5, 0);
  group.add(collar);

  const upperArmGeom = new CapsuleGeometry(0.28, 1.1, 8, 12);
  const forearmGeom = new CapsuleGeometry(0.25, 1.1, 8, 12);
  const gauntletGeom = new CylinderGeometry(0.36, 0.32, 0.8, 14);

  const leftUpperArm = new Mesh(upperArmGeom, limbMat);
  leftUpperArm.castShadow = true;
  leftUpperArm.position.set(-1.2, 7.1, 0.12);
  leftUpperArm.rotation.z = 0.08;
  group.add(leftUpperArm);

  const rightUpperArm = leftUpperArm.clone();
  rightUpperArm.position.x = 1.2;
  rightUpperArm.rotation.z = -0.08;
  group.add(rightUpperArm);

  const leftForearm = new Mesh(forearmGeom, limbMat);
  leftForearm.castShadow = true;
  leftForearm.position.set(-1.3, 5.8, 0.25);
  leftForearm.rotation.z = 0.15;
  group.add(leftForearm);

  const rightForearm = leftForearm.clone();
  rightForearm.position.x = 1.3;
  rightForearm.rotation.z = -0.15;
  group.add(rightForearm);

  const leftGauntlet = new Mesh(gauntletGeom, armorTrim.clone());
  leftGauntlet.castShadow = true;
  leftGauntlet.position.set(-1.35, 5.1, 0.3);
  group.add(leftGauntlet);

  const rightGauntlet = leftGauntlet.clone();
  rightGauntlet.position.x = 1.35;
  group.add(rightGauntlet);

  const leftShoulderPad = new Mesh(new CapsuleGeometry(0.45, 0.6, 10, 16), armorTrim.clone());
  leftShoulderPad.castShadow = true;
  leftShoulderPad.position.set(-1.35, 7.4, 0.1);
  group.add(leftShoulderPad);

  const rightShoulderPad = leftShoulderPad.clone();
  rightShoulderPad.position.x = 1.35;
  group.add(rightShoulderPad);

  const leftHand = new Mesh(new BoxGeometry(0.5, 0.45, 0.5), limbMat);
  leftHand.castShadow = true;
  leftHand.position.set(-1.4, 4.8, 0.35);
  group.add(leftHand);

  const rightHand = leftHand.clone();
  rightHand.position.x = 1.4;
  group.add(rightHand);

  const neck = new Mesh(new CapsuleGeometry(0.28, 0.5, 8, 12), underSuitMat);
  neck.castShadow = true;
  neck.position.set(0, 7.9, 0);
  group.add(neck);

  const head = new Mesh(new SphereGeometry(0.85, 20, 18), headMat);
  head.castShadow = true;
  head.position.set(0, 8.7, 0);
  group.add(head);

  const helmet = new Mesh(new CapsuleGeometry(0.95, 0.5, 16, 20), armorTrim.clone());
  helmet.castShadow = true;
  helmet.position.set(0, 8.8, 0);
  group.add(helmet);

  const visor = new Mesh(new BoxGeometry(1.2, 0.45, 0.28), visorMat);
  visor.position.set(0, 8.75, 0.52);
  group.add(visor);

  const faceplate = new Mesh(new CylinderGeometry(0.28, 0.28, 0.15, 12), detailMat);
  faceplate.rotation.x = Math.PI / 2;
  faceplate.position.set(0, 8.75, 0.68);
  group.add(faceplate);

  const eyeBar = new Mesh(new BoxGeometry(0.55, 0.1, 0.04), detailMat);
  eyeBar.position.set(0, 8.78, 0.6);
  group.add(eyeBar);

  const comms = new Mesh(new CylinderGeometry(0.08, 0.08, 0.8, 12), detailMat.clone());
  comms.rotation.x = Math.PI / 2;
  comms.position.set(-0.65, 8.9, -0.2);
  group.add(comms);

  return group;
}

function getWaveTuning(currentWave: number): WaveTuning {
  const progression = Math.min(1, (currentWave - 1) / 18);
  const count = Math.round(5 + currentWave * 2.1 + Math.pow(currentWave, 1.05) * 0.25);
  const baseHealth = 3 + Math.floor(currentWave / 2);
  const baseSpeed = 7 + currentWave * 0.45;
  const maxSimultaneous = Math.min(5 + Math.floor(currentWave * 0.6), 16);
  const intervalMin = Math.max(0.95, 1.7 - progression * 0.65);
  const intervalMax = Math.max(intervalMin + 0.55, 2.8 - progression * 0.5);
  return {
    count,
    baseHealth,
    baseSpeed,
    maxSimultaneous,
    spawnInterval: {
      min: intervalMin,
      max: intervalMax
    }
  };
}

function intermissionDurationForWave(nextWave: number) {
  const reduction = Math.min(nextWave * 0.15, 1.5);
  return Math.max(MIN_INTERMISSION, MAX_INTERMISSION - reduction);
}

function scheduleNextSpawn(forceFast = false) {
  const { spawnInterval, maxSimultaneous } = waveTuning;
  const intervalRange = spawnInterval.max - spawnInterval.min;
  const baseline = forceFast
    ? spawnInterval.min * 0.6
    : spawnInterval.min + Math.random() * intervalRange;
  const crowdFactor = enemies.length / Math.max(1, maxSimultaneous);
  spawnCooldown = baseline * (1 + crowdFactor * 0.8);
}

function beginWave(nextWave: number, freshStart = false) {
  wave = nextWave;
  waveTuning = getWaveTuning(wave);
  enemiesToSpawn = waveTuning.count;
  intermission = 0;
  scheduleNextSpawn(true);
  const tutorial = freshStart ? " Aim with mouse or arrows/WASD, keep the gun alive." : "";
  setStatus(`Wave ${wave}: ${waveTuning.count} hostiles inbound.${tutorial}`);
  pushBridgeStats();
}

function spawnEnemy() {
  const angle = Math.random() * Math.PI * 2;
  const radius = ENEMY_SPAWN_RADIUS + Math.random() * 15;
  const position = new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  const target = new Vector3(0, 0, 0);
  const dir = target.clone().sub(position).normalize();
  const speedVariation = waveTuning.baseSpeed * 0.25;
  const speed = waveTuning.baseSpeed + (Math.random() - 0.5) * speedVariation;
  const health = waveTuning.baseHealth + (Math.random() < 0.2 ? 1 : 0);
  const velocity = dir.clone().multiplyScalar(speed);

  const enemyGroup = createHumanoidEnemy();
  enemyGroup.position.copy(position);
  scene.add(enemyGroup);

  const enemyRadius = 1.2;
  const enemyHalfHeight = 5.2;
  enemies.push({
    mesh: enemyGroup,
    velocity,
    health,
    speed,
    radius: enemyRadius,
    halfHeight: enemyHalfHeight,
    idlePhase: Math.random() * Math.PI * 2,
    bobRate: 2 + Math.random()
  });
  pushBridgeStats();
}

function spawnPowerUp(position: Vector3) {
  const roll = Math.random();
  let type: PowerUpType;
  if (roll < 0.33) {
    type = "rapid-fire";
  } else if (roll < 0.66) {
    type = "shield";
  } else {
    type = "explosive";
  }
  const mesh = new Mesh(
    new SphereGeometry(1.2, 18, 18),
    new MeshStandardMaterial({ color: type === "shield" ? 0x4bd8ff : type === "rapid-fire" ? 0xffd166 : 0xff7bff })
  );
  mesh.castShadow = true;
  mesh.position.copy(position).setY(1.5);
  scene.add(mesh);

  powerUps.push({ mesh, type, timeToLive: POWER_UP_LIFETIME });
}

function spawnBullet() {
  if (muzzlePoints.length === 0) return;
  const bullet = new Mesh(bulletGeometryActive, bulletMaterialActive);
  bullet.castShadow = true;
  const muzzle = muzzlePoints[muzzleIndex];
  muzzleIndex = (muzzleIndex + 1) % muzzlePoints.length;
  muzzle.getWorldPosition(muzzleWorld);
  bullet.position.copy(muzzleWorld);
  const direction = aimDirection.clone();
  bullet.quaternion.setFromUnitVectors(forwardVector, direction);
  scene.add(bullet);

  const velocity = direction.multiplyScalar(BULLET_SPEED);
  bullets.push({ mesh: bullet, velocity, life: BULLET_LIFETIME });
}

function pushBridgeStats() {
  const powers: string[] = [];
  if (rapidFireTimer > 0) powers.push(`Rapid Fire (${Math.ceil(rapidFireTimer)}s)`);
  if (explosiveTimer > 0) powers.push(`Explosive (${Math.ceil(explosiveTimer)}s)`);
  if (shieldCharges > 0) powers.push(`Shield x${shieldCharges}`);
  lastScoreDisplayed = Math.floor(score);
  updateBridgeFromGame({
    wave,
    score: lastScoreDisplayed,
    status: statusMessage,
    powerUps: powers,
    enemiesRemaining: enemies.length + enemiesToSpawn
  });
}

function killPlayer(reason: string) {
  if (gameState === "dead") return;
  gameState = "dead";
  setStatus(`Base destroyed (${reason}).`);
  submitScore(Math.floor(score));
  updateBridgeFromGame({ gameOver: true });
}

function submitScore(value: number) {
  console.info(`[on-chain stub] Score submitted: ${value}`);
  if (value > submitScoreRecord) {
    submitScoreRecord = value;
    console.info("[on-chain stub] New record! NFT mint stub executed.");
  }
}

function applyPowerUp(power: PowerUpType) {
  switch (power) {
    case "rapid-fire":
      rapidFireTimer = 8;
      setStatus("Rapid Fire active!");
      break;
    case "shield":
      shieldCharges = Math.min(shieldCharges + 1, 3);
      setStatus("Shield obtained.");
      break;
    case "explosive":
      explosiveTimer = 10;
      setStatus("Explosive rounds armed!");
      break;
  }
  pushBridgeStats();
}

function handleEnemyDeath(enemy: Enemy) {
  score += 10;
  const killReward = TOKENS_PER_KILL + Math.floor(wave * 0.5);
  recordKillReward(killReward);
  if (Math.random() < POWER_UP_DROP_CHANCE) {
    spawnPowerUp(enemy.mesh.position.clone());
  }
  scene.remove(enemy.mesh);
  enemies.splice(enemies.indexOf(enemy), 1);
  pushBridgeStats();
}

function explodeAt(position: Vector3) {
  for (const enemy of enemies.slice()) {
    if (enemy.mesh.position.distanceTo(position) <= EXPLOSIVE_RADIUS) {
      enemy.health = 0;
      handleEnemyDeath(enemy);
    }
  }
}

function updateBullets(dt: number) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.mesh.position.addScaledVector(bullet.velocity, dt);
    bullet.life -= dt;
    if (bullet.life <= 0) {
      scene.remove(bullet.mesh);
      bullets.splice(i, 1);
      continue;
    }

    for (const enemy of enemies) {
      const enemyPos = enemy.mesh.position;
      const bulletPos = bullet.mesh.position;
      const bulletY = bulletPos.y;
      const baseY = enemyPos.y;
      if (bulletY < baseY - 0.5 || bulletY > baseY + enemy.halfHeight * 2 + 0.5) {
        continue;
      }
      const dx = bulletPos.x - enemyPos.x;
      const dz = bulletPos.z - enemyPos.z;
      if (dx * dx + dz * dz <= enemy.radius * enemy.radius) {
        enemy.health -= explosiveTimer > 0 ? 2 : 1;
        if (enemy.health <= 0) {
          handleEnemyDeath(enemy);
          if (explosiveTimer > 0) {
            explodeAt(enemyPos.clone());
          }
        }
        scene.remove(bullet.mesh);
        bullets.splice(i, 1);
        break;
      }
    }
  }
}

function updateEnemies(dt: number) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    horizontalScratch.copy(enemy.mesh.position).setY(0);
    const distanceSq = horizontalScratch.lengthSq();
    if (distanceSq > 0) {
      horizontalScratch.normalize().multiplyScalar(-enemy.speed);
    } else {
      horizontalScratch.set(0, 0, -enemy.speed);
    }
    enemy.velocity.lerp(horizontalScratch, dt * 3.6);
    enemy.velocity.y = 0;
    enemy.mesh.position.addScaledVector(enemy.velocity, dt);
    enemy.mesh.position.y = Math.sin(elapsedTime * enemy.bobRate + enemy.idlePhase) * 0.15;
    enemy.mesh.rotation.y = Math.atan2(-enemy.velocity.x, -enemy.velocity.z);
    enemy.mesh.rotation.x = Math.sin(elapsedTime * enemy.bobRate * 0.5 + enemy.idlePhase) * 0.02;
    const lean = typeof enemy.mesh.userData?.lean === "number" ? (enemy.mesh.userData as { lean: number }).lean : 0;
    enemy.mesh.rotation.z = lean + Math.sin(elapsedTime * enemy.bobRate + enemy.idlePhase) * 0.02;
    const distanceToCore = Math.sqrt(distanceSq);
    if (distanceToCore <= ENEMY_TARGET_RADIUS) {
      if (shieldCharges > 0) {
        shieldCharges -= 1;
        scene.remove(enemy.mesh);
        enemies.splice(i, 1);
        setStatus("Shield absorbed damage!");
        pushBridgeStats();
        continue;
      }
      killPlayer("breach");
      return;
    }
  }
}

function updatePowerUps(dt: number) {
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const power = powerUps[i];
    power.timeToLive -= dt;
    power.mesh.rotation.y += dt * 1.5;
    if (power.timeToLive <= 0) {
      scene.remove(power.mesh);
      powerUps.splice(i, 1);
      continue;
    }
    if (power.mesh.position.distanceTo(turretPickupPoint) < POWER_PICKUP_RADIUS) {
      applyPowerUp(power.type);
      scene.remove(power.mesh);
      powerUps.splice(i, 1);
    }
  }
}

function updateAimFromPointer(clientX: number, clientY: number) {
  if (selectionActive || !gunPivot) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;

  pointerNDC.set(x, y);
  raycaster.setFromCamera(pointerNDC, camera);
  if (raycaster.ray.intersectPlane(aimPlane, pointer)) {
    setAimTargetFromPoint(pointer);
  }
}

function spawnWaveIfReady(dt: number) {
  if (enemiesToSpawn > 0) {
    spawnCooldown -= dt;
    if (spawnCooldown <= 0) {
      if (enemies.length >= waveTuning.maxSimultaneous) {
        spawnCooldown = 0.25;
      } else {
        spawnEnemy();
        enemiesToSpawn -= 1;
        if (enemiesToSpawn > 0) {
          scheduleNextSpawn();
        }
      }
    }
  } else if (enemies.length === 0 && gameState === "playing") {
    if (intermission <= 0) {
      intermission = intermissionDurationForWave(wave + 1);
      grantTokenBonus(WAVE_CLEAR_BONUS + Math.floor(wave * 1.5));
      setStatus(`Sector clear. Wave ${wave + 1} routing in...`);
      return;
    }
    intermission -= dt;
    if (intermission <= 0) {
      beginWave(wave + 1);
    }
  }
}

function updatePowerTimers(dt: number) {
  let changed = false;
  if (rapidFireTimer > 0) {
    const next = Math.max(rapidFireTimer - dt, 0);
    if (next !== rapidFireTimer && next === 0) changed = true;
    rapidFireTimer = next;
  }
  if (explosiveTimer > 0) {
    const next = Math.max(explosiveTimer - dt, 0);
    if (next !== explosiveTimer && next === 0) changed = true;
    explosiveTimer = next;
  }
  if (changed) {
    pushBridgeStats();
  }
}

function updateFire(dt: number) {
  if (selectionActive) return;
  fireCooldown -= dt;
  const rateMultiplier = rapidFireTimer > 0 ? RAPID_FIRE_MULTIPLIER : 1;
  if (fireCooldown <= 0 && gameState === "playing") {
    spawnBullet();
    fireCooldown = BASE_FIRE_RATE * rateMultiplier;
  }
}

function updateScore(dt: number) {
  score += dt * enemies.length * 2;
  const floored = Math.floor(score);
  if (floored !== lastScoreDisplayed) {
    pushBridgeStats();
  }
}

function gameLoop() {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(clock.getDelta(), 0.033);
  elapsedTime += dt;

  updateKeyboardAim(dt);

  if (!selectionActive && gameState === "playing") {
    spawnWaveIfReady(dt);
    updateFire(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updatePowerUps(dt);
    updatePowerTimers(dt);
    updateScore(dt);
  }

  renderer.render(scene, camera);
}

function onPointerMove(event: PointerEvent) {
  updateAimFromPointer(event.clientX, event.clientY);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event: KeyboardEvent) {
  if (handleAimKey(event.code, true)) {
    event.preventDefault();
  }
}

function onKeyUp(event: KeyboardEvent) {
  if (handleAimKey(event.code, false)) {
    event.preventDefault();
  }
}

renderer.domElement.addEventListener("pointermove", onPointerMove);
window.addEventListener("resize", onResize);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

gameLoop();