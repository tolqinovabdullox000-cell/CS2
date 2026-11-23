import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MAPS } from '../data/maps';
import { GRENADES, WEAPONS } from '../data/weapons';
import {
  BotDifficulty,
  EnemyDotMarker,
  Faction,
  GameMode,
  GameSettings,
  GraphicsQuality,
  GrenadeId,
  hasSpecialAimTag,
  HudSnapshot,
  KillfeedEntry,
  MapDefinition,
  MapId,
  MatchConfig,
  PlayerProfile,
  RadarBlip,
  ScoreboardRow,
  SkinId,
  WeaponId,
  WeaponSlot,
} from '../types/game';
import { soundEngine } from './audio';
import { buildGrenadeModel, buildOperatorModel, buildWeaponModel, OperatorRig } from './models';
import { MultiplayerClient } from './multiplayerClient';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import type {
  RemoteGrenadeEvent,
  RemoteKillEvent,
  RemoteShootEvent,
  RemoteSprayEvent,
  RoomPlayerInfo,
  RoomState,
} from '../types/multiplayer';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _dir = new THREE.Vector3();

const BOT_NAMES_CT = ['Shoxruh', 'Jasur_PRO', 'Bekzod', 'Kiber_UZ', 'Sardor', 'Timur_CT', 'Azizbek'];
const BOT_NAMES_T = ['Phantom', 'Riptide', 'Viper_X', 'Kobra', 'Nazar', 'Samurai', 'Draco'];

interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

interface BotState {
  id: string;
  name: string;
  faction: Faction;
  rig: OperatorRig;
  x: number;
  y: number;
  z: number;
  yaw: number;
  health: number;
  armor: number;
  alive: boolean;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  money: number;
  weaponId: WeaponId;
  targetX: number;
  targetZ: number;
  lastShotAt: number;
  reactionDelayMs: number;
  spotTime: number;
  strafeDir: number;
  strafeTimer: number;
  walkPhase: number;
  respawnAt: number;
  blindUntil: number;
}

interface RemotePlayerState {
  id: string;
  name: string;
  clanTag: string;
  faction: Faction;
  rig: OperatorRig;
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  yaw: number;
  targetYaw: number;
  crouching: boolean;
  alive: boolean;
  health: number;
  armor: number;
  kills: number;
  deaths: number;
  score: number;
  money: number;
  walkPhase: number;
}

interface TracerFX {
  line: THREE.Line;
  expiresAt: number;
}

interface SparkFX {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  expiresAt: number;
}

interface ThrownGrenadeFX {
  id: GrenadeId;
  group: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  detonateAt: number;
  lastTrailAt: number;
}

interface ExplosionFX {
  core: THREE.Mesh;
  ring: THREE.Mesh;
  light: THREE.PointLight;
  startedAt: number;
  durationMs: number;
  isFlash: boolean;
}

interface SmokeCloudFX {
  center: THREE.Vector3;
  radius: number;
  group: THREE.Group;
  puffs: { sprite: THREE.Sprite; targetOffset: THREE.Vector3; baseScale: number; rotSpeed: number }[];
  startedAt: number;
  durationMs: number;
}

export class StrikeFrontEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: ProceduralTextureSet;
  private envRT: THREE.WebGLRenderTarget;
  private isSoftwareGl: boolean;

  private mode: 'menu' | 'match' = 'menu';
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();

  // Menu showcase objects
  private showcaseGroup = new THREE.Group();
  private showcaseWeaponGroup: THREE.Group | null = null;
  private showcaseOperatorRig: OperatorRig | null = null;
  private showcaseAngle = 0;

  // World map containers
  private worldGroup = new THREE.Group();
  private worldCollisionMeshes: THREE.Object3D[] = [];
  private aabbs: AABB[] = [];
  private activeMap: MapDefinition = MAPS[MapId.MIRAGE];

  // Player state
  private profile: PlayerProfile;
  private settings: GameSettings;
  private matchConfig: MatchConfig;

  private playerX = 0;
  private playerY = 0;
  private playerZ = 0;
  private playerVelY = 0;
  private playerGrounded = true;
  private bhopSpeedMult = 1.0;
  private groundedWithoutJumpSec = 0;
  private currentEyeHeight = 1.7;
  private playerYaw = 0;
  private playerPitch = 0;
  private playerHealth = 100;
  private playerArmor = 100;
  private playerMoney = 800;
  private playerKills = 0;
  private playerDeaths = 0;
  private playerScore = 0;
  private playerAlive = true;
  private playerRespawnAt = 0;
  private recoilPitch = 0;
  private recoilYaw = 0;
  private hitMarkerType: 'none' | 'body' | 'head' = 'none';
  private hitMarkerExpires = 0;
  private damageFlash = 0;

  // Player weapons & viewmodel
  private ownedWeapons: Record<WeaponSlot, WeaponId | null> = {
    [WeaponSlot.PRIMARY]: null,
    [WeaponSlot.SECONDARY]: WeaponId.USPS,
    [WeaponSlot.MELEE]: WeaponId.KNIFE,
  };
  private ammoState: Record<WeaponId, { mag: number; reserve: number }> = {
    [WeaponId.AK47]: { mag: 30, reserve: 90 },
    [WeaponId.M4A1S]: { mag: 25, reserve: 75 },
    [WeaponId.AWP]: { mag: 5, reserve: 25 },
    [WeaponId.DEAGLE]: { mag: 7, reserve: 35 },
    [WeaponId.USPS]: { mag: 12, reserve: 36 },
    [WeaponId.KNIFE]: { mag: 1, reserve: 0 },
  };
  private activeSlot: WeaponSlot = WeaponSlot.SECONDARY;
  private lastSlot: WeaponSlot = WeaponSlot.MELEE;
  private ownedGrenades: Record<GrenadeId, number> = {
    [GrenadeId.HE]: 0,
    [GrenadeId.FLASH]: 0,
    [GrenadeId.SMOKE]: 0,
  };
  private activeGrenade: GrenadeId | null = null;
  private flashBlindAlpha = 0;
  private lastGrenadeThrowAt = 0;

  private viewmodelPivot = new THREE.Group();
  private viewmodelMesh: THREE.Group | null = null;
  private muzzleLight = new THREE.PointLight(0xffb74d, 0, 8);
  private muzzleMesh: THREE.Mesh;
  private muzzleFlashExpires = 0;

  private isReloading = false;
  private reloadEndsAt = 0;
  private isScoped = false;
  private inspectAnim = 0;
  private kickAnim = 0;
  private walkBobPhase = 0;
  private lastFootstepAt = 0;
  private lastFireAt = 0;
  private mouseDown = false;

  // Match / Round state
  private bots: BotState[] = [];
  private remotePlayers = new Map<string, RemotePlayerState>();
  private mpClient: MultiplayerClient | null = null;
  private mpRoom: RoomState | null = null;
  private lastNetStateEmit = 0;
  private tracers: TracerFX[] = [];
  private sparks: SparkFX[] = [];
  private thrownGrenades: ThrownGrenadeFX[] = [];
  private explosions: ExplosionFX[] = [];
  private smokeClouds: SmokeCloudFX[] = [];
  private sprayDecals: THREE.Mesh[] = [];
  private lastSprayAt = 0;
  private dustPoints: THREE.Points | null = null;
  private killfeed: KillfeedEntry[] = [];
  private roundNumber = 1;
  private ctScore = 0;
  private tScore = 0;
  private roundTimeRemaining = 90;
  private roundOverFreezeUntil = 0;
  private roundBanner: string | null = null;

  // Input & HUD
  private keys: Record<string, boolean> = {};
  private pointerLocked = false;
  private raycaster = new THREE.Raycaster();
  private onHudUpdate: (hud: HudSnapshot) => void;
  private onPauseToggle: () => void;
  private onBuyToggle: () => void;
  private onScoreboardToggle: (open: boolean) => void;
  private lastHudEmit = 0;

  constructor(
    container: HTMLElement,
    initialProfile: PlayerProfile,
    initialSettings: GameSettings,
    initialMatchConfig: MatchConfig,
    callbacks: {
      onHudUpdate: (hud: HudSnapshot) => void;
      onPauseToggle: () => void;
      onBuyToggle: () => void;
      onScoreboardToggle: (open: boolean) => void;
    }
  ) {
    this.container = container;
    this.profile = initialProfile;
    this.settings = initialSettings;
    this.matchConfig = initialMatchConfig;
    this.onHudUpdate = callbacks.onHudUpdate;
    this.onPauseToggle = callbacks.onPauseToggle;
    this.onBuyToggle = callbacks.onBuyToggle;
    this.onScoreboardToggle = callbacks.onScoreboardToggle;

    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && initialSettings.graphics !== GraphicsQuality.FAST,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.applyGraphicsQuality(initialSettings.graphics);

    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      initialSettings.fov,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.08,
      360
    );
    this.scene.add(this.camera);

    // Studio environment reflection for metallic weapons & visors
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    this.textures = createProceduralTextures(this.renderer);

    // Muzzle flash setup
    const flashGeo = new THREE.OctahedronGeometry(0.08, 0);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9 });
    this.muzzleMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleMesh.visible = false;
    this.viewmodelPivot.add(this.muzzleMesh);
    this.viewmodelPivot.add(this.muzzleLight);
    this.camera.add(this.viewmodelPivot);

    this.scene.add(this.worldGroup);
    this.scene.add(this.showcaseGroup);

    this.bindEvents();
    this.setupMenuShowcase();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.tick();
  }

  private applyGraphicsQuality(quality: GraphicsQuality) {
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      return;
    }
    if (quality === GraphicsQuality.HIGH) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } else if (quality === GraphicsQuality.MEDIUM) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
    } else {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
    }
  }

  public updateProfileAndSettings(profile: PlayerProfile, settings: GameSettings, matchConfig: MatchConfig) {
    const prevPrimary = this.profile.preferredPrimary;
    const prevFaction = this.profile.faction;
    const prevSkin = this.profile.equippedSkins[prevPrimary];
    const prevMap = this.matchConfig.mapId;

    this.profile = profile;
    this.settings = settings;
    this.matchConfig = matchConfig;

    soundEngine.setVolume(settings.volume);
    this.applyGraphicsQuality(settings.graphics);
    if (!this.isScoped) {
      this.camera.fov = settings.fov;
      this.camera.updateProjectionMatrix();
    }

    if (this.mode === 'menu') {
      const nextSkin = profile.equippedSkins[profile.preferredPrimary];
      if (
        prevPrimary !== profile.preferredPrimary ||
        prevFaction !== profile.faction ||
        prevSkin !== nextSkin ||
        prevMap !== matchConfig.mapId
      ) {
        this.setupMenuShowcase();
      }
    }
  }

  private clearGroup(group: THREE.Group) {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints) {
          const m = obj as THREE.Mesh | THREE.Points;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
    }
  }

  public setupMenuShowcase() {
    this.mode = 'menu';
    this.exitPointerLock();
    this.viewmodelPivot.visible = false;
    this.clearBots();
    this.clearRemotePlayers();
    this.mpClient = null;
    this.mpRoom = null;
    this.clearFX();
    this.clearGroup(this.worldGroup);
    this.clearGroup(this.showcaseGroup);

    const map = MAPS[this.matchConfig.mapId];
    this.activeMap = map;
    this.applyAtmosphere(map);

    const isWarmMap = map.groundStyle === 'sandstone' || map.groundStyle === 'desert_cobble';
    const showcaseSky = new THREE.Mesh(
      new THREE.SphereGeometry(180, 20, 14),
      new THREE.MeshBasicMaterial({
        map: isWarmMap ? this.textures.skyWarm : this.textures.skyCool,
        side: THREE.BackSide,
        fog: false,
      })
    );
    this.showcaseGroup.add(showcaseSky);

    // Subtle background pedestal + dark studio floor for menu
    const stageFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.8, 0.28, 36),
      new THREE.MeshStandardMaterial({ color: 0x161d2b, metalness: 0.72, roughness: 0.34 })
    );
    stageFloor.position.set(0, -0.14, 0);
    stageFloor.receiveShadow = true;
    this.showcaseGroup.add(stageFloor);

    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.42, 0.035, 10, 48),
      new THREE.MeshStandardMaterial({
        color: this.profile.faction === Faction.CT ? 0x3b82f6 : 0xf59e0b,
        emissive: this.profile.faction === Faction.CT ? 0x1d4ed8 : 0xd97706,
        emissiveIntensity: 0.9,
      })
    );
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = 0.01;
    this.showcaseGroup.add(rimRing);

    // Build selected weapon showcase (scaled & floating above right side)
    const weaponId = this.profile.preferredPrimary;
    const skinId = this.profile.equippedSkins[weaponId] ?? SkinId.STANDARD;
    this.showcaseWeaponGroup = buildWeaponModel(weaponId, skinId, false);
    this.showcaseWeaponGroup.scale.setScalar(2.35);
    this.showcaseWeaponGroup.position.set(0.95, 1.45, 0.4);
    this.showcaseWeaponGroup.rotation.y = Math.PI * 0.68;
    this.showcaseGroup.add(this.showcaseWeaponGroup);

    // Build player faction operator standing on pedestal
    this.showcaseOperatorRig = buildOperatorModel(this.profile.faction, -1);
    this.showcaseOperatorRig.group.position.set(-0.95, 0, -0.35);
    this.showcaseOperatorRig.group.rotation.y = 0.35;
    this.showcaseGroup.add(this.showcaseOperatorRig.group);

    // Lighting for showcase
    const key = new THREE.DirectionalLight(map.sunHex, 2.2);
    key.position.set(4, 7, 5);
    key.castShadow = !this.isSoftwareGl;
    this.showcaseGroup.add(key);

    const rim = new THREE.DirectionalLight(
      this.profile.faction === Faction.CT ? 0x60a5fa : 0xfbbf24,
      1.6
    );
    rim.position.set(-5, 4, -4);
    this.showcaseGroup.add(rim);

    const hemi = new THREE.HemisphereLight(map.hemiSkyHex, 0x0f172a, 0.9);
    this.showcaseGroup.add(hemi);

    this.camera.position.set(0.45, 1.75, 4.35);
    this.camera.rotation.set(-0.08, 0.08, 0, 'YXZ');
    this.camera.fov = 48;
    this.camera.updateProjectionMatrix();
  }

  private applyAtmosphere(map: MapDefinition) {
    this.scene.background = new THREE.Color(map.skyHorizonHex);
    this.scene.fog = new THREE.FogExp2(map.fogHex, map.fogDensity * 0.52);
  }

  public startMatch(config: MatchConfig) {
    this.mpClient = null;
    this.mpRoom = null;
    this.clearRemotePlayers();
    this.beginMatchInternal(config, config.botCount);
  }

  public startMultiplayerMatch(config: MatchConfig, client: MultiplayerClient, room: RoomState) {
    this.mpClient = client;
    this.mpRoom = room;
    this.clearRemotePlayers();

    // Sync assigned faction from server room player entry
    const selfInfo = room.players.find((p) => p.id === client.clientId);
    const effectiveConfig: MatchConfig = {
      ...config,
      mapId: room.mapId,
      mode: room.mode,
      playerFaction: selfInfo?.faction ?? config.playerFaction,
      botCount: room.fillBots,
    };

    this.beginMatchInternal(effectiveConfig, room.fillBots);
    this.syncRemotePlayersFromRoom(room.players);
  }

  private beginMatchInternal(config: MatchConfig, botCountToSpawn: number) {
    this.matchConfig = config;
    this.mode = 'match';
    this.clearGroup(this.showcaseGroup);
    this.showcaseWeaponGroup = null;
    this.showcaseOperatorRig = null;

    this.buildMapWorld(MAPS[config.mapId]);

    this.roundNumber = this.mpRoom?.roundNumber ?? 1;
    this.ctScore = this.mpRoom?.ctScore ?? 0;
    this.tScore = this.mpRoom?.tScore ?? 0;
    this.playerKills = 0;
    this.playerDeaths = 0;
    this.playerScore = 0;
    this.killfeed = [];

    // Starting loadout & economy
    if (config.mode === GameMode.DEATHMATCH || config.mode === GameMode.AIM_ARENA) {
      this.playerMoney = 16000;
      this.ownedWeapons = {
        [WeaponSlot.PRIMARY]: this.profile.preferredPrimary,
        [WeaponSlot.SECONDARY]: this.profile.preferredSecondary,
        [WeaponSlot.MELEE]: WeaponId.KNIFE,
      };
      this.ownedGrenades = {
        [GrenadeId.HE]: 1,
        [GrenadeId.FLASH]: 2,
        [GrenadeId.SMOKE]: 1,
      };
      this.activeSlot = WeaponSlot.PRIMARY;
    } else {
      this.playerMoney = 1000;
      this.ownedWeapons = {
        [WeaponSlot.PRIMARY]: null,
        [WeaponSlot.SECONDARY]: this.profile.preferredSecondary,
        [WeaponSlot.MELEE]: WeaponId.KNIFE,
      };
      this.ownedGrenades = {
        [GrenadeId.HE]: 0,
        [GrenadeId.FLASH]: 1,
        [GrenadeId.SMOKE]: 0,
      };
      this.activeSlot = WeaponSlot.SECONDARY;
    }
    this.activeGrenade = null;
    this.flashBlindAlpha = 0;

    this.resetAmmoForOwned();
    this.spawnBots(botCountToSpawn);
    this.startRound();

    this.viewmodelPivot.visible = true;
    this.rebuildViewmodel();
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
    this.requestPointerLock();
    this.emitHud(true);
  }

  private buildMapWorld(map: MapDefinition) {
    this.activeMap = map;
    this.dustPoints = null;
    this.clearGroup(this.worldGroup);
    this.worldCollisionMeshes = [];
    this.aabbs = [];
    this.sprayDecals = [];

    this.applyAtmosphere(map);

    const isWarmMap = map.groundStyle === 'sandstone' || map.groundStyle === 'desert_cobble';

    // 0. Gradient Sky Dome
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(230, 24, 16),
      new THREE.MeshBasicMaterial({
        map: isWarmMap ? this.textures.skyWarm : this.textures.skyCool,
        side: THREE.BackSide,
        fog: false,
      })
    );
    this.worldGroup.add(skyDome);

    // 1. Lighting
    const hemi = new THREE.HemisphereLight(map.hemiSkyHex, map.hemiGroundHex, 0.85);
    this.worldGroup.add(hemi);

    const sun = new THREE.DirectionalLight(map.sunHex, map.sunIntensity * 1.08);
    sun.position.set(...map.sunPosition);
    sun.castShadow = !this.isSoftwareGl && this.settings.graphics !== GraphicsQuality.FAST;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 140;
    const d = 44;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.worldGroup.add(sun);

    // 2. Extended outer horizon terrain + arena floor (no floating box in void!)
    const outerGround = new THREE.Mesh(
      new THREE.PlaneGeometry(340, 340),
      new THREE.MeshStandardMaterial({
        color: isWarmMap ? 0xc29e6c : map.groundStyle === 'rooftop' ? 0x263244 : 0x475569,
        roughness: 0.94,
        metalness: 0.03,
      })
    );
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.y = -0.04;
    this.worldGroup.add(outerGround);

    const floorTex =
      map.groundStyle === 'desert_cobble'
        ? this.textures.desertCobbleFloor
        : map.groundStyle === 'sandstone'
        ? this.textures.sandstoneFloor
        : map.groundStyle === 'rooftop'
        ? this.textures.rooftopFloor
        : this.textures.concreteFloor;

    const arenaFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(map.arenaWidth, map.arenaDepth),
      new THREE.MeshStandardMaterial({
        map: floorTex,
        bumpMap: this.textures.surfaceBump,
        bumpScale: 0.035,
        roughness: 0.84,
        metalness: 0.06,
      })
    );
    arenaFloor.rotation.x = -Math.PI / 2;
    arenaFloor.receiveShadow = true;
    this.worldGroup.add(arenaFloor);
    this.worldCollisionMeshes.push(arenaFloor);

    // Perimeter boundary walls (visual + collision)
    const halfW = map.arenaWidth / 2;
    const halfD = map.arenaDepth / 2;
    const wallMat = new THREE.MeshStandardMaterial({
      map: isWarmMap ? this.textures.sandstoneWall : this.textures.concreteWall,
      bumpMap: this.textures.surfaceBump,
      bumpScale: 0.032,
      roughness: 0.82,
      metalness: 0.06,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: isWarmMap ? 0x8f6b43 : 0x334155,
      roughness: 0.78,
      metalness: 0.18,
    });
    const palletMat = new THREE.MeshStandardMaterial({
      color: 0x4b331b,
      roughness: 0.9,
    });

    const perimeterDefs = [
      { x: 0, z: -halfD - 1, w: map.arenaWidth + 4, h: map.groundStyle === 'rooftop' ? 1.6 : 6.2, d: 2 },
      { x: 0, z: halfD + 1, w: map.arenaWidth + 4, h: map.groundStyle === 'rooftop' ? 1.6 : 6.2, d: 2 },
      { x: -halfW - 1, z: 0, w: 2, h: map.groundStyle === 'rooftop' ? 1.6 : 6.2, d: map.arenaDepth + 4 },
      { x: halfW + 1, z: 0, w: 2, h: map.groundStyle === 'rooftop' ? 1.6 : 6.2, d: map.arenaDepth + 4 },
    ];
    for (const p of perimeterDefs) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), wallMat);
      mesh.position.set(p.x, p.h / 2, p.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.worldGroup.add(mesh);
      this.worldCollisionMeshes.push(mesh);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.2, 0.24, p.d + 0.2), trimMat);
      cap.position.set(p.x, p.h + 0.12, p.z);
      this.worldGroup.add(cap);
    }

    // Distant skyline / backdrop silhouettes & map-specific landmarks
    const silhouetteMat = new THREE.MeshStandardMaterial({
      map: map.groundStyle === 'rooftop' ? this.textures.skyscraperGlass : undefined,
      color: isWarmMap ? 0xb48c5e : map.groundStyle === 'rooftop' ? 0xffffff : 0x3b485b,
      roughness: 0.82,
      metalness: map.groundStyle === 'rooftop' ? 0.35 : 0.08,
    });
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const dist = 62 + (i % 3) * 14;
      const bw = 10 + (i % 4) * 5;
      const bh = map.groundStyle === 'rooftop' ? 24 + (i % 5) * 11 : 10 + (i % 4) * 6;
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw), silhouetteMat);
      b.position.set(Math.cos(angle) * dist, bh / 2 - 4, Math.sin(angle) * dist);
      this.worldGroup.add(b);
    }

    // Map-specific environmental landmarks outside arena bounds
    if (isWarmMap) {
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4728, roughness: 0.92 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.72, side: THREE.DoubleSide });
      const palmAngles = [0.25, 0.95, 1.85, 2.55, 3.4, 4.15, 5.05, 5.75];
      for (const ang of palmAngles) {
        const palm = new THREE.Group();
        const dist = halfW + 7.5 + (Math.abs(Math.sin(ang * 3)) * 5);
        palm.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
        for (let seg = 0; seg < 4; seg++) {
          const tSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.24 - seg * 0.03, 0.28 - seg * 0.03, 2.2, 8), trunkMat);
          tSeg.position.set(seg * 0.22, seg * 2.0 + 1.1, 0);
          tSeg.rotation.z = -0.09;
          palm.add(tSeg);
        }
        for (let f = 0; f < 6; f++) {
          const fAng = (f / 6) * Math.PI * 2;
          const frond = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.55), leafMat);
          frond.position.set(0.7 + Math.cos(fAng) * 1.15, 8.2, Math.sin(fAng) * 1.15);
          frond.rotation.y = -fAng;
          frond.rotation.z = -0.32;
          palm.add(frond);
        }
        this.worldGroup.add(palm);
      }
    } else if (map.id === MapId.NUKE) {
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.75, metalness: 0.15 });
      const pipeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.45, metalness: 0.55 });
      for (const pos of [
        [-52, -48],
        [52, -46],
      ] as [number, number][]) {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 9.5, 26, 20), towerMat);
        tower.position.set(pos[0], 13, pos[1]);
        this.worldGroup.add(tower);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.45, 8, 24), pipeMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(pos[0], 26, pos[1]);
        this.worldGroup.add(rim);
      }
    } else if (map.id === MapId.VERTIGO) {
      const craneMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.48, metalness: 0.45 });
      const mast = new THREE.Mesh(new THREE.BoxGeometry(1.6, 26, 1.6), craneMat);
      mast.position.set(-42, 13, -38);
      this.worldGroup.add(mast);
      const jib = new THREE.Mesh(new THREE.BoxGeometry(28, 1.3, 1.4), craneMat);
      jib.position.set(-30, 25, -38);
      this.worldGroup.add(jib);
    }

    // Floating atmospheric dust motes
    const moteCount = 180;
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = (Math.random() - 0.5) * map.arenaWidth;
      motePos[i * 3 + 1] = 0.6 + Math.random() * 6.5;
      motePos[i * 3 + 2] = (Math.random() - 0.5) * map.arenaDepth;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    this.dustPoints = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({
        color: isWarmMap ? 0xffe4b5 : 0xe2e8f0,
        size: 0.14,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      })
    );
    this.worldGroup.add(this.dustPoints);

    const rampMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      bumpMap: this.textures.surfaceBump,
      bumpScale: 0.03,
      roughness: 0.85,
      metalness: 0.05,
    });

    // 3. Map tactical obstacles
    for (const obs of map.obstacles) {
      if (obs.kind === 'car') {
        const car = new THREE.Group();
        car.position.set(obs.x, obs.y, obs.z);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6b4f3b, roughness: 0.65, metalness: 0.45 });
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.18, metalness: 0.7 });
        const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9, metalness: 0.08 });

        const lower = new THREE.Mesh(new THREE.BoxGeometry(obs.w, obs.h * 0.55, obs.d), bodyMat);
        lower.position.y = obs.h * 0.4;
        lower.castShadow = true;
        lower.receiveShadow = true;
        car.add(lower);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(obs.w * 0.86, obs.h * 0.42, obs.d * 0.5), bodyMat);
        cabin.position.set(0, obs.h * 0.82, -obs.d * 0.04);
        cabin.castShadow = true;
        car.add(cabin);

        const glass = new THREE.Mesh(new THREE.BoxGeometry(obs.w * 0.88, obs.h * 0.3, obs.d * 0.46), glassMat);
        glass.position.set(0, obs.h * 0.82, -obs.d * 0.04);
        car.add(glass);

        const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
        wheelGeo.rotateZ(Math.PI / 2);
        for (const [wx, wz] of [
          [-obs.w * 0.46, obs.d * 0.3],
          [obs.w * 0.46, obs.d * 0.3],
          [-obs.w * 0.46, -obs.d * 0.3],
          [obs.w * 0.46, -obs.d * 0.3],
        ]) {
          const wheel = new THREE.Mesh(wheelGeo, tireMat);
          wheel.position.set(wx, 0.36, wz);
          car.add(wheel);
        }

        this.worldGroup.add(car);
        this.worldCollisionMeshes.push(lower, cabin);
        this.aabbs.push({
          minX: obs.x - obs.w / 2,
          maxX: obs.x + obs.w / 2,
          minY: obs.y,
          maxY: obs.y + obs.h,
          minZ: obs.z - obs.d / 2,
          maxZ: obs.z + obs.d / 2,
        });
        continue;
      }

      let mat: THREE.MeshStandardMaterial;
      if (obs.kind === 'crate') {
        mat = new THREE.MeshStandardMaterial({ map: this.textures.woodCrate, roughness: 0.8, metalness: 0.06 });
      } else if (obs.kind === 'door') {
        mat = new THREE.MeshStandardMaterial({ map: this.textures.woodenDoor, roughness: 0.76, metalness: 0.16 });
      } else if (obs.kind === 'barrel') {
        mat = new THREE.MeshStandardMaterial({ map: this.textures.barrelMetal, roughness: 0.45, metalness: 0.68 });
      } else if (obs.kind === 'container') {
        mat = new THREE.MeshStandardMaterial({
          map: this.textures.corrugatedMetal,
          color: obs.color ?? 0x2563eb,
          roughness: 0.44,
          metalness: 0.68,
        });
      } else if (obs.kind === 'barrier') {
        mat = new THREE.MeshStandardMaterial({ map: this.textures.hazardBarrier, roughness: 0.84, metalness: 0.1 });
      } else if (obs.kind === 'ramp_step') {
        mat = rampMat;
      } else {
        mat = wallMat;
      }

      const geo =
        obs.kind === 'barrel'
          ? new THREE.CylinderGeometry(obs.w / 2, obs.w / 2, obs.h, 16)
          : new THREE.BoxGeometry(obs.w, obs.h, obs.d);

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(obs.x, obs.y + obs.h / 2, obs.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.worldGroup.add(mesh);
      this.worldCollisionMeshes.push(mesh);

      // Decorative trim, pallets & tunnel interior lanterns
      if (obs.kind === 'wall' || obs.kind === 'pillar') {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(obs.w + 0.18, 0.2, obs.d + 0.18), trimMat);
        cap.position.set(obs.x, obs.y + obs.h + 0.08, obs.z);
        this.worldGroup.add(cap);
        if (obs.y === 0) {
          const plinth = new THREE.Mesh(new THREE.BoxGeometry(obs.w + 0.14, 0.26, obs.d + 0.14), trimMat);
          plinth.position.set(obs.x, 0.13, obs.z);
          this.worldGroup.add(plinth);
        }
      } else if (obs.kind === 'crate' && obs.y === 0) {
        const pallet = new THREE.Mesh(new THREE.BoxGeometry(obs.w + 0.16, 0.08, obs.d + 0.16), palletMat);
        pallet.position.set(obs.x, 0.04, obs.z);
        this.worldGroup.add(pallet);
      } else if (obs.kind === 'arch' && obs.w >= 15) {
        const lanternBulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xffe4b5 })
        );
        lanternBulb.position.set(obs.x, obs.y - 0.14, obs.z);
        this.worldGroup.add(lanternBulb);

        const tunnelLight = new THREE.PointLight(0xffcf87, 1.8, 22);
        tunnelLight.position.set(obs.x, obs.y - 0.5, obs.z);
        this.worldGroup.add(tunnelLight);
      }

      this.aabbs.push({
        minX: obs.x - obs.w / 2,
        maxX: obs.x + obs.w / 2,
        minY: obs.y,
        maxY: obs.y + obs.h,
        minZ: obs.z - obs.d / 2,
        maxZ: obs.z + obs.d / 2,
      });
    }

    // 4. Bomb site decals A and B + tactical holo ring beacons (placed on top of platform surface)
    const addSiteDecal = (pos: [number, number], tex: THREE.CanvasTexture, beaconHex: number) => {
      const siteY = this.getFloorHeightAt(pos[0], pos[1], 4);
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(4.8, 4.8),
        new THREE.MeshStandardMaterial({
          map: tex,
          transparent: true,
          roughness: 0.9,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
      );
      decal.rotation.x = -Math.PI / 2;
      decal.position.set(pos[0], siteY + 0.02, pos[1]);
      this.worldGroup.add(decal);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.35, 0.055, 8, 36),
        new THREE.MeshBasicMaterial({ color: beaconHex, transparent: true, opacity: 0.55 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(pos[0], siteY + 0.05, pos[1]);
      this.worldGroup.add(ring);

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.55, 3.8, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: beaconHex,
          transparent: true,
          opacity: 0.14,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      beam.position.set(pos[0], siteY + 1.9, pos[1]);
      this.worldGroup.add(beam);
    };
    addSiteDecal(map.bombSiteA, this.textures.siteDecalA, 0xf59e0b);
    addSiteDecal(map.bombSiteB, this.textures.siteDecalB, 0xef4444);

    // 5. Wall Graffiti Sprays, Site Stencils & Tactical Posters (fixes plain walls!)
    const placeWallSpray = (
      x: number,
      y: number,
      z: number,
      rotY: number,
      decalIndex: number,
      width = 2.6,
      height = 1.35
    ) => {
      const tex = this.textures.wallSprays[decalIndex % this.textures.wallSprays.length];
      const spray = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({
          map: tex,
          transparent: true,
          roughness: 0.85,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        })
      );
      spray.position.set(x, y, z);
      spray.rotation.y = rotY;
      this.worldGroup.add(spray);
    };

    if (map.id === MapId.DUST2) {
      // Iconic A-site GOOSE graffiti on back-right wall
      placeWallSpray(37.5, 2.75, -39.4, 0, 0, 3.4, 1.7);
      // Site A arrows near Long & Catwalk
      placeWallSpray(24.0, 2.1, 21.8, Math.PI, 1, 2.6, 1.3);
      placeWallSpray(15.2, 2.9, -4.4, Math.PI / 2, 1, 2.4, 1.2);
      // Site B arrows near T-Spawn & Upper Tunnels
      placeWallSpray(-14.5, 2.6, 33.8, Math.PI, 2, 2.8, 1.4);
      placeWallSpray(-24.9, 2.0, -3.5, -Math.PI / 2, 2, 2.5, 1.25);
      // Street art murals in Mid, A Long, B Site
      placeWallSpray(-6.9, 2.1, -2.0, Math.PI / 2, 3, 3.0, 1.5);
      placeWallSpray(43.8, 2.2, 4.0, -Math.PI / 2, 4, 3.2, 1.6);
      placeWallSpray(-45.8, 2.2, -26.0, Math.PI / 2, 3, 2.9, 1.45);
      placeWallSpray(-18.0, 2.1, -39.4, 0, 5, 2.5, 1.25);
    }

    // Add balanced architectural graffiti/signs on tall corridor walls across all maps
    let autoIdx = 0;
    for (const obs of map.obstacles) {
      if (obs.kind !== 'wall' || obs.h < 2.8) continue;
      if (obs.w >= 6.5 && obs.d <= 2.2) {
        const idx = map.groundStyle === 'concrete' || map.groundStyle === 'rooftop' ? (autoIdx % 2 === 0 ? 5 : 3) : (autoIdx % 4) + 1;
        placeWallSpray(obs.x, obs.y + 1.85, obs.z + obs.d / 2 + 0.03, 0, idx, 2.5, 1.25);
        autoIdx += 1;
      } else if (obs.d >= 6.5 && obs.w <= 2.2) {
        const idx = map.groundStyle === 'concrete' || map.groundStyle === 'rooftop' ? (autoIdx % 2 === 0 ? 5 : 4) : (autoIdx % 4) + 1;
        placeWallSpray(obs.x + obs.w / 2 + 0.03, obs.y + 1.85, obs.z, Math.PI / 2, idx, 2.5, 1.25);
        autoIdx += 1;
      }
    }
  }

  private clearBots() {
    for (const b of this.bots) {
      this.scene.remove(b.rig.group);
    }
    this.bots = [];
  }

  private clearRemotePlayers() {
    for (const rp of this.remotePlayers.values()) {
      this.scene.remove(rp.rig.group);
    }
    this.remotePlayers.clear();
  }

  public syncRemotePlayersFromRoom(players: RoomPlayerInfo[]) {
    if (!this.mpClient) return;
    const myId = this.mpClient.clientId;
    const seen = new Set<string>();

    for (const p of players) {
      if (p.id === myId) continue;
      seen.add(p.id);
      const existing = this.remotePlayers.get(p.id);
      if (!existing || existing.faction !== p.faction) {
        if (existing) {
          this.scene.remove(existing.rig.group);
        }
        const rig = buildOperatorModel(p.faction, -2);
        rig.headMesh.userData.remotePlayerId = p.id;
        rig.headMesh.traverse((child) => {
          child.userData.hitZone = 'head';
          child.userData.remotePlayerId = p.id;
        });
        for (const bm of rig.bodyHitMeshes) {
          bm.userData.remotePlayerId = p.id;
        }
        rig.group.position.set(p.x, p.y, p.z);
        rig.group.visible = p.alive;
        if (this.mode === 'match') {
          this.scene.add(rig.group);
        }

        this.remotePlayers.set(p.id, {
          id: p.id,
          name: p.name,
          clanTag: p.clanTag,
          faction: p.faction,
          rig,
          x: p.x,
          y: p.y,
          z: p.z,
          targetX: p.x,
          targetY: p.y,
          targetZ: p.z,
          yaw: p.yaw,
          targetYaw: p.yaw,
          crouching: p.crouching,
          alive: p.alive,
          health: p.health,
          armor: p.armor,
          kills: p.kills,
          deaths: p.deaths,
          score: p.score,
          money: p.money,
          walkPhase: 0,
        });
      } else {
        existing.name = p.name;
        existing.clanTag = p.clanTag;
        existing.targetX = p.x;
        existing.targetY = p.y;
        existing.targetZ = p.z;
        existing.targetYaw = p.yaw;
        existing.crouching = p.crouching;
        existing.alive = p.alive;
        existing.health = p.health;
        existing.armor = p.armor;
        existing.kills = p.kills;
        existing.deaths = p.deaths;
        existing.score = p.score;
        existing.money = p.money;
        existing.rig.group.visible = p.alive;
      }
    }

    for (const [id, rp] of this.remotePlayers.entries()) {
      if (!seen.has(id)) {
        this.scene.remove(rp.rig.group);
        this.remotePlayers.delete(id);
      }
    }
  }

  public handleRemoteShoot(ev: RemoteShootEvent) {
    if (this.mode !== 'match') return;
    const dist = _v1.set(...ev.muzzlePos).distanceTo(this.camera.position);
    const atten = Math.max(0.08, 1 - dist / 60);
    soundEngine.playGunshot(ev.weaponId, atten * 0.85);
    this.spawnTracer(new THREE.Vector3(...ev.muzzlePos), new THREE.Vector3(...ev.hitPoint), 0xfca5a5);
  }

  public handleLocalDamaged(payload: {
    attackerId: string;
    attackerName: string;
    damage: number;
    health: number;
    armor: number;
    headshot: boolean;
  }) {
    if (this.mode !== 'match' || !this.playerAlive) return;
    this.playerHealth = payload.health;
    this.playerArmor = payload.armor;
    this.damageFlash = payload.headshot ? 1.0 : 0.85;
    soundEngine.playHitSound(payload.headshot);
    if (this.playerHealth <= 0) {
      this.playerAlive = false;
      this.playerDeaths += 1;
      this.playerRespawnAt = performance.now() + 2600;
      this.bhopSpeedMult = 1.0;
      this.groundedWithoutJumpSec = 0;
      this.isScoped = false;
      this.camera.fov = this.settings.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  public handleRemoteKilled(ev: RemoteKillEvent) {
    if (this.mode !== 'match') return;
    this.pushKillfeed({
      id: `${Date.now()}_${Math.random()}`,
      killerName: ev.killerName,
      killerFaction: ev.killerFaction,
      victimName: ev.victimName,
      victimFaction: ev.victimFaction,
      weaponId: ev.weaponId,
      headshot: ev.headshot,
      timestamp: performance.now(),
    });
    if (this.mpClient && ev.killerId === this.mpClient.clientId) {
      this.playerKills += 1;
      this.playerScore += ev.headshot ? 150 : 100;
      this.playerMoney = Math.min(16000, this.playerMoney + (ev.headshot ? 450 : 300));
    }
  }

  public handleRemoteGrenade(ev: RemoteGrenadeEvent) {
    if (this.mode !== 'match') return;
    this.spawnThrownGrenade(
      ev.grenadeId,
      new THREE.Vector3(...ev.pos),
      new THREE.Vector3(...ev.vel),
      performance.now() + ev.detonateDelayMs
    );
  }

  public handleRemoteSpray(ev: RemoteSprayEvent) {
    if (this.mode !== 'match') return;
    this.spawnWallSprayAt(new THREE.Vector3(...ev.pos), new THREE.Vector3(...ev.normal), ev.decalIndex);
  }

  public handleServerRoundReset(room: RoomState, winner?: Faction) {
    if (this.mode !== 'match') return;
    this.mpRoom = room;
    this.ctScore = room.ctScore;
    this.tScore = room.tScore;
    this.roundNumber = room.roundNumber;
    this.syncRemotePlayersFromRoom(room.players);
    if (winner) {
      const won = winner === this.matchConfig.playerFaction;
      this.playerMoney = Math.min(16000, this.playerMoney + (won ? 3250 : 1900));
      soundEngine.playRoundChime(won);
    }
    this.startRound();
  }

  private spawnBots(countOverride?: number) {
    this.clearBots();
    const desired = countOverride ?? this.matchConfig.botCount;
    if (desired <= 0) return;
    const totalBots = Math.max(1, Math.min(9, desired));
    const playerSide = this.matchConfig.playerFaction;
    const enemySide = playerSide === Faction.CT ? Faction.T : Faction.CT;

    let ctIdx = 0;
    let tIdx = 0;

    for (let i = 0; i < totalBots; i++) {
      // In Aim Arena or Deathmatch, make most/all bots enemies for high action; in Classic, split teams!
      let faction: Faction;
      if (this.matchConfig.mode === GameMode.AIM_ARENA) {
        faction = enemySide;
      } else if (this.matchConfig.mode === GameMode.CLASSIC) {
        // Alternate enemies and allies, ensuring at least 1 enemy
        faction = i % 2 === 0 ? enemySide : playerSide;
      } else {
        // Deathmatch: 70% enemies, 30% allies
        faction = i % 3 === 2 ? playerSide : enemySide;
      }

      const namePool = faction === Faction.CT ? BOT_NAMES_CT : BOT_NAMES_T;
      const name = faction === Faction.CT ? namePool[ctIdx++ % namePool.length] : namePool[tIdx++ % namePool.length];
      const rig = buildOperatorModel(faction, i);
      this.scene.add(rig.group);

      this.bots.push({
        id: `bot_${i}`,
        name,
        faction,
        rig,
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        health: 100,
        armor: 100,
        alive: true,
        kills: 0,
        deaths: 0,
        assists: 0,
        score: 0,
        money: 2400,
        weaponId: faction === Faction.CT ? WeaponId.M4A1S : WeaponId.AK47,
        targetX: 0,
        targetZ: 0,
        lastShotAt: 0,
        reactionDelayMs:
          this.matchConfig.difficulty === BotDifficulty.HARD
            ? 240
            : this.matchConfig.difficulty === BotDifficulty.MEDIUM
            ? 480
            : 820,
        spotTime: 0,
        strafeDir: Math.random() > 0.5 ? 1 : -1,
        strafeTimer: 0,
        walkPhase: Math.random() * Math.PI * 2,
        respawnAt: 0,
        blindUntil: 0,
      });
    }
  }

  private getSpawnPos(faction: Faction, idx: number): [number, number, number] {
    const spawns = faction === Faction.CT ? this.activeMap.ctSpawns : this.activeMap.tSpawns;
    const base = spawns[idx % spawns.length];
    return [base[0] + (Math.random() - 0.5) * 1.5, base[1], base[2] + (Math.random() - 0.5) * 1.5];
  }

  private pickPatrolTarget(): [number, number] {
    if (this.activeMap.id === MapId.DUST2) {
      const lanes: [number, number][] = [
        [33, -27], // A Site
        [-34, -29], // B Site
        [0, 6], // Top Mid / Xbox
        [-2, -22], // CT Mid
        [33, 2], // A Long
        [10, -5], // Catwalk / Short A
        [-33, 3], // Upper B Tunnels
      ];
      const pick = lanes[Math.floor(Math.random() * lanes.length)];
      return [pick[0] + (Math.random() - 0.5) * 5, pick[1] + (Math.random() - 0.5) * 5];
    }
    if (Math.random() < 0.38) return [this.activeMap.bombSiteA[0] + (Math.random() - 0.5) * 8, this.activeMap.bombSiteA[1] + (Math.random() - 0.5) * 8];
    if (Math.random() < 0.72) return [this.activeMap.bombSiteB[0] + (Math.random() - 0.5) * 8, this.activeMap.bombSiteB[1] + (Math.random() - 0.5) * 8];
    return [(Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20];
  }

  private startRound() {
    this.roundTimeRemaining = this.matchConfig.mode === GameMode.CLASSIC ? 90 : 300;
    this.roundBanner = null;
    this.roundOverFreezeUntil = 0;

    // Spawn player
    const [px, py, pz] = this.getSpawnPos(this.matchConfig.playerFaction, 0);
    this.playerX = px;
    this.playerY = py;
    this.playerZ = pz;
    this.playerVelY = 0;
    this.playerGrounded = true;
    this.bhopSpeedMult = 1.0;
    this.groundedWithoutJumpSec = 0;
    this.currentEyeHeight = 1.7;
    this.playerHealth = 100;
    this.playerArmor = 100;
    this.playerAlive = true;
    this.isReloading = false;
    this.isScoped = false;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.playerYaw =
      this.activeMap.id === MapId.DUST2
        ? this.matchConfig.playerFaction === Faction.CT
          ? Math.PI
          : 0
        : this.matchConfig.playerFaction === Faction.CT
        ? -Math.PI * 0.75
        : Math.PI * 0.25;
    this.playerPitch = 0;
    this.activeGrenade = null;
    this.flashBlindAlpha = 0;
    this.clearFX();

    this.resetAmmoForOwned();

    // Spawn bots
    this.bots.forEach((b, idx) => {
      const [bx, by, bz] = this.getSpawnPos(b.faction, idx + 1);
      b.x = bx;
      b.y = by;
      b.z = bz;
      b.health = 100;
      b.armor = 100;
      b.alive = true;
      b.blindUntil = 0;
      b.rig.group.visible = true;
      b.rig.group.position.set(bx, by, bz);
      const [tx, tz] = this.pickPatrolTarget();
      b.targetX = tx;
      b.targetZ = tz;
    });
  }

  private resetAmmoForOwned() {
    (Object.keys(this.ammoState) as WeaponId[]).forEach((wid) => {
      this.ammoState[wid] = {
        mag: WEAPONS[wid].magSize,
        reserve: WEAPONS[wid].reserveMax,
      };
    });
  }

  private rebuildViewmodel() {
    if (this.viewmodelMesh) {
      this.viewmodelPivot.remove(this.viewmodelMesh);
      this.viewmodelMesh.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          (o as THREE.Mesh).geometry?.dispose();
        }
      });
      this.viewmodelMesh = null;
    }

    if (this.activeGrenade) {
      const nade = buildGrenadeModel(this.activeGrenade, true);
      nade.scale.setScalar(1.35);
      nade.position.set(0.24, -0.18, -0.38);
      nade.rotation.set(0.18, -0.25, 0.12);
      this.viewmodelMesh = nade;
      this.viewmodelPivot.add(nade);
      return;
    }

    const activeWeaponId = this.ownedWeapons[this.activeSlot] ?? WeaponId.KNIFE;
    const skinId = this.profile.equippedSkins[activeWeaponId] ?? SkinId.STANDARD;
    const gun = buildWeaponModel(activeWeaponId, skinId, true);

    if (activeWeaponId === WeaponId.KNIFE) {
      gun.position.set(0.24, -0.22, -0.4);
      gun.rotation.set(0.15, -0.4, 0.2);
    } else if (activeWeaponId === WeaponId.DEAGLE || activeWeaponId === WeaponId.USPS) {
      gun.position.set(0.23, -0.21, -0.44);
    } else {
      gun.position.set(0.24, -0.22, -0.46);
    }

    this.viewmodelMesh = gun;
    this.viewmodelPivot.add(gun);
    this.muzzleMesh.position.set(0.24, -0.18, -1.05);
    this.muzzleLight.position.set(0.24, -0.16, -1.05);
  }

  public switchSlot(slot: WeaponSlot) {
    if (this.mode !== 'match' || !this.playerAlive) return;
    if (!this.ownedWeapons[slot]) return;
    if (slot === this.activeSlot && this.activeGrenade === null) return;
    if (this.activeGrenade === null) {
      this.lastSlot = this.activeSlot;
    }
    this.activeGrenade = null;
    this.activeSlot = slot;
    this.isReloading = false;
    this.isScoped = false;
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
    this.kickAnim = -0.12;
    this.rebuildViewmodel();
    soundEngine.playUiClick();
  }

  public cycleOrSelectGrenade(preferred?: GrenadeId) {
    if (this.mode !== 'match' || !this.playerAlive) return;
    const order: GrenadeId[] = [GrenadeId.HE, GrenadeId.FLASH, GrenadeId.SMOKE];
    const available = order.filter((g) => this.ownedGrenades[g] > 0);
    if (available.length === 0) return;

    let next: GrenadeId;
    if (preferred && this.ownedGrenades[preferred] > 0) {
      next = preferred;
    } else if (this.activeGrenade && available.includes(this.activeGrenade)) {
      const idx = available.indexOf(this.activeGrenade);
      next = available[(idx + 1) % available.length];
    } else {
      next = available[0];
    }

    this.activeGrenade = next;
    this.isReloading = false;
    this.isScoped = false;
    this.viewmodelPivot.visible = true;
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
    this.kickAnim = -0.1;
    this.rebuildViewmodel();
    soundEngine.playPinPull();
    this.emitHud(true);
  }

  public buyWeapon(weaponId: WeaponId): boolean {
    const spec = WEAPONS[weaponId];
    if (this.ownedWeapons[spec.slot] === weaponId) return false;
    if (this.playerMoney < spec.price) return false;

    this.playerMoney -= spec.price;
    this.ownedWeapons[spec.slot] = weaponId;
    this.ammoState[weaponId] = { mag: spec.magSize, reserve: spec.reserveMax };
    this.activeGrenade = null;
    this.activeSlot = spec.slot;
    this.isReloading = false;
    this.isScoped = false;
    this.rebuildViewmodel();
    soundEngine.playUiClick();
    this.emitHud(true);
    return true;
  }

  public buyGrenade(grenadeId: GrenadeId): boolean {
    const spec = GRENADES[grenadeId];
    if (this.ownedGrenades[grenadeId] >= spec.maxCarry) return false;
    if (this.playerMoney < spec.price) return false;

    this.playerMoney -= spec.price;
    this.ownedGrenades[grenadeId] += 1;
    soundEngine.playUiClick();
    this.emitHud(true);
    return true;
  }

  public buyArmor(): boolean {
    if (this.playerArmor >= 100 || this.playerMoney < 1000) return false;
    this.playerMoney -= 1000;
    this.playerArmor = 100;
    soundEngine.playUiClick();
    this.emitHud(true);
    return true;
  }

  public requestPointerLock() {
    if (this.mode !== 'match') return;
    try {
      this.renderer.domElement.requestPointerLock();
    } catch {
      // Ignore pointer lock rejection in automated tests
    }
  }

  public exitPointerLock() {
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
  }

  private bindEvents() {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('wheel', this.handleWheel, { passive: true });
    window.addEventListener('contextmenu', this.handleContextMenu);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
  };

  private handleContextMenu = (e: MouseEvent) => {
    if (this.mode === 'match') e.preventDefault();
  };

  private handlePointerLockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    this.pointerLocked = locked;
    if (!locked) {
      this.mouseDown = false;
      this.keys = {};
    }
    this.emitHud(true);
  };

  private handleResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.mode !== 'match') return;
    this.keys[e.code] = true;

    if (e.code === 'Digit1') this.switchSlot(WeaponSlot.PRIMARY);
    else if (e.code === 'Digit2') this.switchSlot(WeaponSlot.SECONDARY);
    else if (e.code === 'Digit3') this.switchSlot(WeaponSlot.MELEE);
    else if (e.code === 'Digit4') this.cycleOrSelectGrenade();
    else if (e.code === 'KeyG') {
      const order: GrenadeId[] = [GrenadeId.HE, GrenadeId.FLASH, GrenadeId.SMOKE];
      const toThrow =
        this.activeGrenade && this.ownedGrenades[this.activeGrenade] > 0
          ? this.activeGrenade
          : order.find((g) => this.ownedGrenades[g] > 0) ?? null;
      if (toThrow) {
        this.throwGrenade(toThrow);
      }
    } else if (e.code === 'KeyQ') this.switchSlot(this.lastSlot);
    else if (e.code === 'KeyR') this.startReload();
    else if (e.code === 'KeyF') {
      this.inspectAnim = 1.0;
    } else if (e.code === 'KeyT') {
      this.applyInteractiveSpray();
    } else if (e.code === 'KeyB') {
      e.preventDefault();
      this.onBuyToggle();
    } else if (e.code === 'KeyP') {
      this.onPauseToggle();
    } else if (e.code === 'Tab') {
      e.preventDefault();
      this.onScoreboardToggle(true);
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
    if (e.code === 'Tab' && this.mode === 'match') {
      this.onScoreboardToggle(false);
    }
  };

  private handleWheel = (e: WheelEvent) => {
    if (this.mode !== 'match' || !this.pointerLocked) return;
    const slots = [WeaponSlot.PRIMARY, WeaponSlot.SECONDARY, WeaponSlot.MELEE].filter(
      (s) => this.ownedWeapons[s] !== null
    );
    const idx = slots.indexOf(this.activeSlot);
    const next = e.deltaY > 0 ? (idx + 1) % slots.length : (idx - 1 + slots.length) % slots.length;
    this.switchSlot(slots[next]);
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.mode !== 'match' || !this.pointerLocked || !this.playerAlive) return;
    const sensScale = this.isScoped ? 0.42 : 1.0;
    const sens = 0.0022 * this.settings.sensitivity * sensScale;
    this.playerYaw -= e.movementX * sens;
    this.playerPitch = THREE.MathUtils.clamp(this.playerPitch - e.movementY * sens, -1.48, 1.48);
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (this.mode !== 'match') return;
    if (!this.pointerLocked) return;
    if (e.button === 0) {
      if (this.activeGrenade && this.ownedGrenades[this.activeGrenade] > 0) {
        this.throwGrenade(this.activeGrenade);
        return;
      }
      this.mouseDown = true;
      this.tryFire(performance.now());
    } else if (e.button === 2) {
      if (this.activeGrenade) return;
      const wid = this.ownedWeapons[this.activeSlot] ?? WeaponId.KNIFE;
      const spec = WEAPONS[wid];
      if (spec.hasScope) {
        this.isScoped = !this.isScoped;
        this.camera.fov = this.isScoped ? spec.scopeFov ?? 28 : this.settings.fov;
        this.camera.updateProjectionMatrix();
        this.viewmodelPivot.visible = !this.isScoped;
        soundEngine.playUiClick();
        this.emitHud(true);
      }
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false;
  };

  private startReload() {
    if (!this.playerAlive || this.isReloading) return;
    const wid = this.ownedWeapons[this.activeSlot] ?? WeaponId.KNIFE;
    const spec = WEAPONS[wid];
    if (spec.slot === WeaponSlot.MELEE) return;
    const st = this.ammoState[wid];
    if (st.mag >= spec.magSize || st.reserve <= 0) return;

    this.isReloading = true;
    this.isScoped = false;
    this.viewmodelPivot.visible = true;
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
    this.reloadEndsAt = performance.now() + spec.reloadTimeMs;
    soundEngine.playReload();
  }

  private tryFire(now: number) {
    if (!this.playerAlive || this.isReloading) return;
    const wid = this.ownedWeapons[this.activeSlot] ?? WeaponId.KNIFE;
    const spec = WEAPONS[wid];
    if (now - this.lastFireAt < spec.fireRateMs) return;

    if (spec.slot !== WeaponSlot.MELEE) {
      const st = this.ammoState[wid];
      if (st.mag <= 0) {
        this.startReload();
        return;
      }
      st.mag -= 1;
    }

    this.lastFireAt = now;
    this.inspectAnim = 0;
    this.kickAnim = spec.id === WeaponId.AWP ? 0.18 : 0.08;
    soundEngine.playGunshot(wid, 1.0);

    // Muzzle flash
    if (spec.slot !== WeaponSlot.MELEE) {
      this.muzzleMesh.visible = true;
      this.muzzleMesh.rotation.z = Math.random() * Math.PI;
      this.muzzleLight.intensity = 4.5;
      this.muzzleFlashExpires = now + 45;
    }

    const assistActive = hasSpecialAimTag(this.profile.name);

    // Spread & Recoil calculation
    const moving =
      this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD'];
    const crouching = this.keys['ControlLeft'] || this.keys['KeyC'];
    let spread = spec.baseSpread;
    if (moving && !this.keys['ShiftLeft']) spread += spec.moveSpread;
    if (crouching) spread *= 0.55;
    if (this.isScoped) spread *= 0.2;
    if (assistActive) spread = 0;

    // Direction from camera + spread + recoil (or precision target lock when assistActive)
    this.camera.getWorldPosition(_v1);
    this.camera.getWorldDirection(_dir);

    if (assistActive) {
      let bestScore = -1;
      let lockedTargetPos: THREE.Vector3 | null = null;
      let lockedYaw: number | null = null;
      let lockedPitch: number | null = null;

      for (const b of this.bots) {
        if (!b.alive) continue;
        if (this.matchConfig.mode !== GameMode.DEATHMATCH && b.faction === this.matchConfig.playerFaction) continue;

        b.rig.headMesh.getWorldPosition(_v3);
        const dist = _v1.distanceTo(_v3);
        if (dist > spec.range) continue;

        _v2.copy(_v3).sub(_v1).normalize();
        const align = _dir.dot(_v2);
        if (align > 0.35 && this.hasLineOfSight(_v1.x, _v1.y, _v1.z, _v3.x, _v3.y, _v3.z)) {
          if (align > bestScore) {
            bestScore = align;
            lockedTargetPos = _v3.clone();
          }
        }
      }

      for (const rp of this.remotePlayers.values()) {
        if (!rp.alive) continue;
        if (this.matchConfig.mode !== GameMode.DEATHMATCH && rp.faction === this.matchConfig.playerFaction) continue;

        rp.rig.headMesh.getWorldPosition(_v3);
        const dist = _v1.distanceTo(_v3);
        if (dist > spec.range) continue;

        _v2.copy(_v3).sub(_v1).normalize();
        const align = _dir.dot(_v2);
        if (align > 0.35 && this.hasLineOfSight(_v1.x, _v1.y, _v1.z, _v3.x, _v3.y, _v3.z)) {
          if (align > bestScore) {
            bestScore = align;
            lockedTargetPos = _v3.clone();
          }
        }
      }

      if (lockedTargetPos) {
        _dir.copy(lockedTargetPos).sub(_v1).normalize();
        lockedYaw = Math.atan2(-_dir.x, -_dir.z);
        lockedPitch = Math.asin(THREE.MathUtils.clamp(_dir.y, -0.99, 0.99));
        this.playerYaw = lockedYaw;
        this.playerPitch = lockedPitch;
        this.camera.rotation.set(this.playerPitch, this.playerYaw, 0, 'YXZ');
        this.camera.updateMatrixWorld();
      }
    } else {
      _dir.x += (Math.random() - 0.5) * spread;
      _dir.y += (Math.random() - 0.5) * spread;
      _dir.z += (Math.random() - 0.5) * spread;
      _dir.normalize();
    }

    if (!assistActive) {
      this.recoilPitch += spec.recoilKick;
      this.recoilYaw += (Math.random() - 0.5) * spec.recoilKick * 0.55;
    } else {
      this.recoilPitch = 0;
      this.recoilYaw = 0;
    }

    // Unscope after AWP shot
    if (this.isScoped && wid === WeaponId.AWP) {
      this.isScoped = false;
      this.viewmodelPivot.visible = true;
      this.camera.fov = this.settings.fov;
      this.camera.updateProjectionMatrix();
    }

    // Raycast against world + enemy bots + remote human players
    this.raycaster.set(_v1, _dir);
    this.raycaster.far = spec.range;

    const worldHits = this.raycaster.intersectObjects(this.worldCollisionMeshes, false);
    const worldDist = worldHits.length > 0 ? worldHits[0].distance : spec.range;

    // Gather enemy hitboxes
    const enemyMeshes: THREE.Object3D[] = [];
    for (const b of this.bots) {
      if (!b.alive) continue;
      if (this.matchConfig.mode !== GameMode.DEATHMATCH && b.faction === this.matchConfig.playerFaction) continue;
      enemyMeshes.push(b.rig.headMesh, ...b.rig.bodyHitMeshes);
    }
    for (const rp of this.remotePlayers.values()) {
      if (!rp.alive) continue;
      if (this.matchConfig.mode !== GameMode.DEATHMATCH && rp.faction === this.matchConfig.playerFaction) continue;
      enemyMeshes.push(rp.rig.headMesh, ...rp.rig.bodyHitMeshes);
    }

    const botHits = this.raycaster.intersectObjects(enemyMeshes, true);
    let hitPoint = _v2.copy(_v1).addScaledVector(_dir, worldDist);

    if (botHits.length > 0 && botHits[0].distance < worldDist) {
      const hit = botHits[0];
      hitPoint = hit.point;
      const hitZone = hit.object.userData.hitZone as 'head' | 'body' | undefined;
      const botIndex = hit.object.userData.botIndex as number | undefined;
      const remotePlayerId = hit.object.userData.remotePlayerId as string | undefined;

      if (remotePlayerId && this.remotePlayers.has(remotePlayerId)) {
        const isHead = hitZone === 'head';
        const dmg = Math.round(spec.damage * (isHead ? spec.headshotMultiplier : 1.0));
        this.hitMarkerType = isHead ? 'head' : 'body';
        this.hitMarkerExpires = now + 180;
        soundEngine.playHitSound(isHead);
        this.spawnImpactSparks(hit.point, 0xef4444, 6);
        this.mpClient?.send({
          type: 'player:hit',
          targetId: remotePlayerId,
          damage: dmg,
          weaponId: wid,
          headshot: isHead,
        });
      } else if (botIndex !== undefined && botIndex >= 0 && this.bots[botIndex]) {
        const bot = this.bots[botIndex];
        const isHead = hitZone === 'head';
        let dmg = spec.damage * (isHead ? spec.headshotMultiplier : 1.0);
        if (bot.armor > 0) {
          const absorbed = dmg * (1 - spec.armorPenetration) * 0.5;
          bot.armor = Math.max(0, bot.armor - absorbed);
          dmg = dmg * spec.armorPenetration;
        }
        bot.health -= Math.round(dmg);
        this.hitMarkerType = isHead ? 'head' : 'body';
        this.hitMarkerExpires = now + 180;
        soundEngine.playHitSound(isHead);
        this.spawnImpactSparks(hit.point, 0xef4444, 6);

        if (bot.health <= 0) {
          this.handleBotEliminated(bot, wid, isHead);
        }
      }
    } else if (worldHits.length > 0) {
      this.spawnImpactSparks(worldHits[0].point, 0xfbbf24, 5);
    }

    if (spec.slot !== WeaponSlot.MELEE) {
      const muzzleWorld = _v3.set(0.15, -0.12, -0.7).applyMatrix4(this.camera.matrixWorld);
      this.spawnTracer(muzzleWorld, hitPoint, 0xfde68a);
      this.mpClient?.send({
        type: 'player:shoot',
        weaponId: wid,
        muzzlePos: [muzzleWorld.x, muzzleWorld.y, muzzleWorld.z],
        hitPoint: [hitPoint.x, hitPoint.y, hitPoint.z],
      });
    }
  }

  private handleBotEliminated(bot: BotState, weaponId: WeaponId | GrenadeId, headshot: boolean) {
    bot.alive = false;
    bot.deaths += 1;
    bot.rig.group.visible = false;
    bot.respawnAt = performance.now() + 2500;

    this.playerKills += 1;
    this.playerScore += headshot ? 150 : 100;
    this.playerMoney = Math.min(16000, this.playerMoney + (headshot ? 450 : 300));

    this.pushKillfeed({
      id: `${Date.now()}_${Math.random()}`,
      killerName: this.profile.clanTag ? `[${this.profile.clanTag}] ${this.profile.name}` : this.profile.name,
      killerFaction: this.matchConfig.playerFaction,
      victimName: bot.name,
      victimFaction: bot.faction,
      weaponId,
      headshot,
      timestamp: performance.now(),
    });

    this.checkRoundEnd();
  }

  private pushKillfeed(entry: KillfeedEntry) {
    this.killfeed = [entry, ...this.killfeed].slice(0, 5);
  }

  private applyInteractiveSpray() {
    const now = performance.now();
    if (!this.playerAlive || now - this.lastSprayAt < 2500) return;

    this.camera.getWorldPosition(_v1);
    this.camera.getWorldDirection(_dir);
    this.raycaster.set(_v1, _dir);
    this.raycaster.far = 5.2;

    const hits = this.raycaster.intersectObjects(this.worldCollisionMeshes, false);
    const hit = hits[0];
    const face = hit?.face;
    if (!hit || !face) return;

    const normal = face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
    if (Math.abs(normal.y) > 0.65) return; // Spray vertical walls cleanly

    this.lastSprayAt = now;
    const decalIndex = this.matchConfig.playerFaction === Faction.CT ? 3 : 4;
    this.spawnWallSprayAt(hit.point, normal, decalIndex);
    soundEngine.playSprayCan();

    this.mpClient?.send({
      type: 'player:spray',
      pos: [hit.point.x, hit.point.y, hit.point.z],
      normal: [normal.x, normal.y, normal.z],
      decalIndex,
    });
  }

  private spawnWallSprayAt(point: THREE.Vector3, normal: THREE.Vector3, decalIndex: number) {
    const tex = this.textures.wallSprays[decalIndex % this.textures.wallSprays.length];
    const spray = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75, 0.9),
      new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        roughness: 0.85,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    spray.position.copy(point).addScaledVector(normal, 0.03);
    spray.lookAt(point.clone().add(normal));
    this.worldGroup.add(spray);
    this.sprayDecals.push(spray);
    if (this.sprayDecals.length > 24) {
      const oldest = this.sprayDecals.shift();
      if (oldest) {
        this.worldGroup.remove(oldest);
        oldest.geometry.dispose();
        (oldest.material as THREE.Material).dispose();
      }
    }
  }

  private throwGrenade(grenadeId: GrenadeId) {
    const now = performance.now();
    if (!this.playerAlive || this.ownedGrenades[grenadeId] <= 0) return;
    if (now - this.lastGrenadeThrowAt < 380) return;

    this.lastGrenadeThrowAt = now;
    this.ownedGrenades[grenadeId] -= 1;
    this.kickAnim = 0.22;
    soundEngine.playPinPull();

    this.camera.getWorldPosition(_v1);
    this.camera.getWorldDirection(_dir);

    const startPos = _v1.clone().addScaledVector(_dir, 0.75);
    startPos.y -= 0.1;
    const vel = _dir.clone().multiplyScalar(19.5);
    vel.y += 3.2;
    const fuseMs = GRENADES[grenadeId].fuseMs;

    this.spawnThrownGrenade(grenadeId, startPos, vel, now + fuseMs);
    this.mpClient?.sendGrenade(
      grenadeId,
      [startPos.x, startPos.y, startPos.z],
      [vel.x, vel.y, vel.z],
      fuseMs
    );

    // Switch back to remaining grenade or previous weapon
    if (this.ownedGrenades[grenadeId] <= 0) {
      const nextNade = ([GrenadeId.HE, GrenadeId.FLASH, GrenadeId.SMOKE] as GrenadeId[]).find(
        (g) => this.ownedGrenades[g] > 0
      );
      this.activeGrenade = nextNade ?? null;
      this.rebuildViewmodel();
    }
    this.emitHud(true);
  }

  private spawnThrownGrenade(
    grenadeId: GrenadeId,
    startPos: THREE.Vector3,
    vel: THREE.Vector3,
    detonateAt: number
  ) {
    const group = buildGrenadeModel(grenadeId, false);
    group.scale.setScalar(1.6);
    group.position.copy(startPos);
    this.scene.add(group);

    this.thrownGrenades.push({
      id: grenadeId,
      group,
      pos: startPos.clone(),
      vel: vel.clone(),
      rotVel: new THREE.Vector3(7 + Math.random() * 5, 5 + Math.random() * 5, 4),
      detonateAt,
      lastTrailAt: performance.now(),
    });
  }

  private detonateGrenade(g: ThrownGrenadeFX, now: number) {
    const pos = g.pos;
    const distToPlayer = pos.distanceTo(this.camera.position);
    const distAtten = Math.max(0.1, 1 - distToPlayer / 65);

    if (g.id === GrenadeId.HE) {
      soundEngine.playHeExplosion(distAtten);
      this.spawnExplosionVisual(pos, false, now);
      this.spawnImpactSparks(pos, 0xff6b00, 14);
      this.spawnImpactSparks(pos, 0xfef08a, 8);

      const blastRadius = 9.5;
      // Splash damage to enemy bots
      for (const b of this.bots) {
        if (!b.alive) continue;
        if (this.matchConfig.mode !== GameMode.DEATHMATCH && b.faction === this.matchConfig.playerFaction) continue;
        const botPos = _v3.set(b.x, b.y + 1.1, b.z);
        const d = pos.distanceTo(botPos);
        if (d <= blastRadius && this.hasLineOfSight(pos.x, pos.y + 0.25, pos.z, botPos.x, botPos.y, botPos.z)) {
          const factor = 1 - d / blastRadius;
          const dmg = Math.round(98 * Math.pow(factor, 0.75));
          if (dmg > 0) {
            b.health -= dmg;
            this.hitMarkerType = 'body';
            this.hitMarkerExpires = now + 200;
            soundEngine.playHitSound(false);
            if (b.health <= 0) {
              this.handleBotEliminated(b, GrenadeId.HE, false);
            }
          }
        }
      }

      // Mild self-damage if standing right over own HE
      if (this.playerAlive && distToPlayer <= 6.2 && this.hasLineOfSight(pos.x, pos.y + 0.25, pos.z, this.camera.position.x, this.camera.position.y, this.camera.position.z)) {
        const selfDmg = Math.round(45 * (1 - distToPlayer / 6.2));
        if (selfDmg > 0) {
          this.playerHealth = Math.max(1, this.playerHealth - selfDmg);
          this.damageFlash = 0.7;
        }
      }
    } else if (g.id === GrenadeId.FLASH) {
      this.spawnExplosionVisual(pos, true, now);
      this.spawnImpactSparks(pos, 0xe0f2fe, 10);

      let playerBlindFactor = 0;
      if (
        this.playerAlive &&
        distToPlayer < 28 &&
        this.hasLineOfSight(pos.x, pos.y + 0.2, pos.z, this.camera.position.x, this.camera.position.y, this.camera.position.z)
      ) {
        this.camera.getWorldDirection(_dir);
        _v2.copy(pos).sub(this.camera.position).normalize();
        const lookDot = _dir.dot(_v2);
        const distScale = Math.max(0.2, 1 - distToPlayer / 28);
        if (lookDot > 0.35) {
          playerBlindFactor = Math.min(1, (0.55 + lookDot * 0.45) * distScale);
        } else if (distToPlayer < 9) {
          playerBlindFactor = 0.32 * distScale;
        }
        this.flashBlindAlpha = Math.max(this.flashBlindAlpha, playerBlindFactor);
      }

      soundEngine.playFlashbang(distAtten, playerBlindFactor);

      // Blind enemy bots in line of sight
      for (const b of this.bots) {
        if (!b.alive) continue;
        const botHead = _v3.set(b.x, b.y + 1.5, b.z);
        const d = pos.distanceTo(botHead);
        if (d < 22 && this.hasLineOfSight(pos.x, pos.y + 0.2, pos.z, botHead.x, botHead.y, botHead.z)) {
          b.blindUntil = now + 3800;
          b.spotTime = 0;
        }
      }
    } else {
      // Smoke Grenade ("Dimka")
      soundEngine.playSmokeHiss(distAtten);
      this.spawnSmokeCloud(pos, now);
    }
  }

  private spawnExplosionVisual(pos: THREE.Vector3, isFlash: boolean, now: number) {
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(isFlash ? 0.5 : 0.7, 16, 12),
      new THREE.MeshBasicMaterial({
        color: isFlash ? 0xf8fafc : 0xff7b00,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      })
    );
    core.position.copy(pos).setY(pos.y + 0.25);
    this.scene.add(core);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, isFlash ? 0.08 : 0.16, 8, 28),
      new THREE.MeshBasicMaterial({
        color: isFlash ? 0xbae6fd : 0xfacc15,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(pos).setY(pos.y + 0.14);
    this.scene.add(ring);

    const light = new THREE.PointLight(isFlash ? 0xf0f9ff : 0xff7b00, isFlash ? 20 : 12, isFlash ? 30 : 22);
    light.position.copy(pos).setY(pos.y + 0.6);
    this.scene.add(light);

    this.explosions.push({
      core,
      ring,
      light,
      startedAt: now,
      durationMs: isFlash ? 340 : 540,
      isFlash,
    });
  }

  private spawnSmokeCloud(pos: THREE.Vector3, now: number) {
    const group = new THREE.Group();
    const center = pos.clone();
    center.y = Math.max(0.2, center.y) + 1.4;
    group.position.copy(pos);

    const puffs: SmokeCloudFX['puffs'] = [];
    const puffCount = 22;
    for (let i = 0; i < puffCount; i++) {
      const shade = 205 + Math.floor(Math.random() * 45);
      const col = (shade << 16) | (shade << 8) | Math.min(255, shade + 6);
      const mat = new THREE.SpriteMaterial({
        map: this.textures.smokePuff,
        color: col,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      const angle = (i / puffCount) * Math.PI * 2 + Math.random() * 0.5;
      const radial = i < 4 ? Math.random() * 1.1 : 1.1 + Math.random() * 2.5;
      const yOff = 0.7 + Math.random() * 2.7;
      const targetOffset = new THREE.Vector3(Math.cos(angle) * radial, yOff, Math.sin(angle) * radial);
      const baseScale = 3.2 + Math.random() * 1.9;
      sprite.scale.set(0.6, 0.6, 1);
      group.add(sprite);
      puffs.push({
        sprite,
        targetOffset,
        baseScale,
        rotSpeed: (Math.random() - 0.5) * 0.65,
      });
    }
    this.scene.add(group);
    this.smokeClouds.push({
      center,
      radius: 4.3,
      group,
      puffs,
      startedAt: now,
      durationMs: 12000,
    });
  }

  private isBlockedBySmoke(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    if (this.smokeClouds.length === 0) return false;
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const lenSq = dx * dx + dy * dy + dz * dz;
    if (lenSq < 0.01) return false;

    for (const sc of this.smokeClouds) {
      const t = THREE.MathUtils.clamp(
        ((sc.center.x - ax) * dx + (sc.center.y - ay) * dy + (sc.center.z - az) * dz) / lenSq,
        0,
        1
      );
      const cx = ax + t * dx - sc.center.x;
      const cy = ay + t * dy - sc.center.y;
      const cz = az + t * dz - sc.center.z;
      const r = sc.radius * 0.88;
      if (cx * cx + cy * cy + cz * cz <= r * r) {
        return true;
      }
    }
    return false;
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3, colorHex: number) {
    const geo = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
    const mat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.72 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, expiresAt: performance.now() + 75 });
  }

  private spawnImpactSparks(point: THREE.Vector3, colorHex: number, count: number) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.055, 0.055),
        new THREE.MeshBasicMaterial({ color: colorHex })
      );
      mesh.position.copy(point);
      this.scene.add(mesh);
      this.sparks.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 4.5,
          Math.random() * 3.5 + 0.5,
          (Math.random() - 0.5) * 4.5
        ),
        expiresAt: performance.now() + 260,
      });
    }
  }

  private clearFX() {
    for (const t of this.tracers) {
      this.scene.remove(t.line);
      t.line.geometry.dispose();
      (t.line.material as THREE.Material).dispose();
    }
    this.tracers = [];
    for (const s of this.sparks) {
      this.scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      (s.mesh.material as THREE.Material).dispose();
    }
    this.sparks = [];
    for (const g of this.thrownGrenades) {
      this.scene.remove(g.group);
      g.group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const m = o as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
          else m.material?.dispose();
        }
      });
    }
    this.thrownGrenades = [];
    for (const ex of this.explosions) {
      this.scene.remove(ex.core, ex.ring, ex.light);
      ex.core.geometry.dispose();
      (ex.core.material as THREE.Material).dispose();
      ex.ring.geometry.dispose();
      (ex.ring.material as THREE.Material).dispose();
    }
    this.explosions = [];
    for (const sc of this.smokeClouds) {
      this.scene.remove(sc.group);
      for (const p of sc.puffs) {
        p.sprite.material.dispose();
      }
    }
    this.smokeClouds = [];
  }

  private getFloorHeightAt(x: number, z: number, currentY: number): number {
    let floorY = 0;
    const pad = 0.3;
    for (const box of this.aabbs) {
      if (
        x >= box.minX - pad &&
        x <= box.maxX + pad &&
        z >= box.minZ - pad &&
        z <= box.maxZ + pad
      ) {
        // Step-up tolerance of 0.55m so players can walk up ramps & land cleanly on crates
        if (currentY >= box.maxY - 0.55 && box.maxY > floorY) {
          floorY = box.maxY;
        }
      }
    }
    return floorY;
  }

  private resolveCollisions(nx: number, nz: number, radius = 0.45, entityY = 0): [number, number] {
    const halfW = this.activeMap.arenaWidth / 2 - radius;
    const halfD = this.activeMap.arenaDepth / 2 - radius;
    let rx = THREE.MathUtils.clamp(nx, -halfW, halfW);
    let rz = THREE.MathUtils.clamp(nz, -halfD, halfD);

    for (const box of this.aabbs) {
      // Allow walking/jumping on top of crates & ramps when entityY clears step-up height
      if (box.maxY <= entityY + 0.55 || box.minY >= entityY + 1.65) continue;

      const closestX = THREE.MathUtils.clamp(rx, box.minX, box.maxX);
      const closestZ = THREE.MathUtils.clamp(rz, box.minZ, box.maxZ);
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq) || 0.001;
        const push = radius - dist;
        if (distSq > 0.0001) {
          rx += (dx / dist) * push;
          rz += (dz / dist) * push;
        } else {
          const penLeft = Math.abs(rx - box.minX);
          const penRight = Math.abs(box.maxX - rx);
          const penTop = Math.abs(rz - box.minZ);
          const penBottom = Math.abs(box.maxZ - rz);
          const m = Math.min(penLeft, penRight, penTop, penBottom);
          if (m === penLeft) rx = box.minX - radius;
          else if (m === penRight) rx = box.maxX + radius;
          else if (m === penTop) rz = box.minZ - radius;
          else rz = box.maxZ + radius;
        }
      }
    }
    return [rx, rz];
  }

  private updatePlayer(dt: number, now: number) {
    // Handle respawn in Deathmatch / Aim Arena
    if (!this.playerAlive) {
      if (this.matchConfig.mode !== GameMode.CLASSIC && now >= this.playerRespawnAt) {
        const [sx, sy, sz] = this.getSpawnPos(this.matchConfig.playerFaction, Math.floor(Math.random() * 4));
        this.playerX = sx;
        this.playerY = sy;
        this.playerZ = sz;
        this.playerHealth = 100;
        this.playerArmor = 100;
        this.playerAlive = true;
        this.bhopSpeedMult = 1.0;
        this.groundedWithoutJumpSec = 0;
        this.flashBlindAlpha = 0;
        this.ownedGrenades = {
          [GrenadeId.HE]: 1,
          [GrenadeId.FLASH]: 2,
          [GrenadeId.SMOKE]: 1,
        };
        this.resetAmmoForOwned();
        this.mpClient?.send({
          type: 'player:respawn',
          x: sx,
          y: sy,
          z: sz,
        });
      }
      return;
    }

    // Complete reload
    if (this.isReloading && now >= this.reloadEndsAt) {
      const wid = this.ownedWeapons[this.activeSlot] ?? WeaponId.KNIFE;
      const spec = WEAPONS[wid];
      const st = this.ammoState[wid];
      const needed = spec.magSize - st.mag;
      const take = Math.min(needed, st.reserve);
      st.mag += take;
      st.reserve -= take;
      this.isReloading = false;
    }

    // Continuous auto fire (only when holding a gun, not grenade)
    if (this.mouseDown && this.pointerLocked && !this.activeGrenade) {
      const wid = this.ownedWeapons[this.activeSlot] ?? WeaponId.KNIFE;
      if (WEAPONS[wid].automatic) {
        this.tryFire(now);
      }
    }

    const assistActive = hasSpecialAimTag(this.profile.name);
    if (!assistActive) {
      this.bhopSpeedMult = 1.0;
      this.groundedWithoutJumpSec = 0;
    }

    // Jump & Gravity with vertical crate/platform support + special bhop speed cheat
    if (this.keys['Space'] && this.playerGrounded) {
      this.playerVelY = 7.4;
      this.playerGrounded = false;
      this.groundedWithoutJumpSec = 0;
      if (assistActive) {
        this.bhopSpeedMult = Math.min(2.35, this.bhopSpeedMult + 0.19);
      }
    } else if (assistActive && this.playerGrounded) {
      this.groundedWithoutJumpSec += dt;
      if (this.groundedWithoutJumpSec > 0.35) {
        this.bhopSpeedMult = THREE.MathUtils.damp(this.bhopSpeedMult, 1.0, 4.5, dt);
      }
    }

    // Movement input
    let fwd = 0;
    let strafe = 0;
    if (this.keys['KeyW']) fwd += 1;
    if (this.keys['KeyS']) fwd -= 1;
    if (this.keys['KeyD']) strafe += 1;
    if (this.keys['KeyA']) strafe -= 1;

    const crouching = Boolean(this.keys['ControlLeft'] || this.keys['ControlRight'] || this.keys['KeyC']);
    const walking = Boolean(this.keys['ShiftLeft']);
    const activeWid = this.ownedWeapons[this.activeSlot] ?? WeaponId.KNIFE;
    const baseSpeed = 7.6 * WEAPONS[activeWid].moveSpeedMultiplier * this.bhopSpeedMult;
    const speed = crouching ? baseSpeed * 0.54 : walking ? baseSpeed * 0.62 : this.isScoped ? baseSpeed * 0.5 : baseSpeed;

    if (fwd !== 0 || strafe !== 0) {
      const len = Math.hypot(fwd, strafe);
      fwd /= len;
      strafe /= len;

      const sinY = Math.sin(this.playerYaw);
      const cosY = Math.cos(this.playerYaw);
      const moveX = (-sinY * fwd + cosY * strafe) * speed * dt;
      const moveZ = (-cosY * fwd - sinY * strafe) * speed * dt;

      const [nx, nz] = this.resolveCollisions(this.playerX + moveX, this.playerZ + moveZ, 0.45, this.playerY);
      this.playerX = nx;
      this.playerZ = nz;

      // Smooth step-up onto ramps
      const steppedY = this.getFloorHeightAt(this.playerX, this.playerZ, this.playerY);
      if (this.playerGrounded && steppedY > this.playerY && steppedY - this.playerY <= 0.55) {
        this.playerY = steppedY;
      }

      this.walkBobPhase += dt * (walking ? 7 : 11);
      if (this.playerGrounded && !walking && !crouching && now - this.lastFootstepAt > 360) {
        this.lastFootstepAt = now;
        soundEngine.playFootstep();
      }
    } else {
      this.walkBobPhase = THREE.MathUtils.damp(this.walkBobPhase, 0, 8, dt);
    }

    this.playerVelY -= 19.0 * dt;
    this.playerY += this.playerVelY * dt;

    // Head-ceiling collision (prevents jumping through tunnel ceilings/arches)
    if (this.playerVelY > 0) {
      for (const box of this.aabbs) {
        if (
          this.playerX >= box.minX - 0.3 &&
          this.playerX <= box.maxX + 0.3 &&
          this.playerZ >= box.minZ - 0.3 &&
          this.playerZ <= box.maxZ + 0.3 &&
          box.minY > this.playerY + 1.0 &&
          this.playerY + 1.82 > box.minY
        ) {
          this.playerY = box.minY - 1.82;
          this.playerVelY = 0;
          break;
        }
      }
    }

    const floorH = this.getFloorHeightAt(this.playerX, this.playerZ, this.playerY);
    if (this.playerY <= floorH) {
      this.playerY = floorH;
      this.playerVelY = 0;
      this.playerGrounded = true;
    } else {
      this.playerGrounded = false;
    }

    // Dynamic subtle FOV stretch during bhop speed boost
    if (!this.isScoped) {
      const targetFov = this.settings.fov + (this.bhopSpeedMult - 1.0) * 8.5;
      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 10, dt);
        this.camera.updateProjectionMatrix();
      }
    }

    // Recoil & flash blindness recovery
    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 10, dt);
    this.recoilYaw = THREE.MathUtils.damp(this.recoilYaw, 0, 10, dt);
    this.kickAnim = THREE.MathUtils.damp(this.kickAnim, 0, 14, dt);
    this.inspectAnim = Math.max(0, this.inspectAnim - dt * 0.75);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.5);
    this.flashBlindAlpha = Math.max(0, this.flashBlindAlpha - dt * 0.32);

    // Smooth crouch camera height transition
    const targetEyeHeight = crouching ? 1.08 : 1.7;
    this.currentEyeHeight = THREE.MathUtils.damp(this.currentEyeHeight, targetEyeHeight, 14, dt);

    this.camera.position.set(this.playerX, this.playerY + this.currentEyeHeight, this.playerZ);
    this.camera.rotation.set(
      THREE.MathUtils.clamp(this.playerPitch + this.recoilPitch, -1.5, 1.5),
      this.playerYaw + this.recoilYaw,
      0,
      'YXZ'
    );

    // Viewmodel bob, recoil, reload, inspect
    const bobX = Math.cos(this.walkBobPhase) * (fwd !== 0 || strafe !== 0 ? 0.012 : 0);
    const bobY = Math.abs(Math.sin(this.walkBobPhase)) * (fwd !== 0 || strafe !== 0 ? -0.014 : 0);
    const reloadDip = this.isReloading ? -0.18 : 0;
    const inspectRotY = this.inspectAnim > 0 ? Math.sin(this.inspectAnim * Math.PI) * 0.75 : 0;
    const inspectRotZ = this.inspectAnim > 0 ? Math.sin(this.inspectAnim * Math.PI) * 0.35 : 0;

    this.viewmodelPivot.position.set(bobX, bobY + reloadDip, this.kickAnim);
    this.viewmodelPivot.rotation.set(this.kickAnim * 0.8 + (this.isReloading ? -0.35 : 0), inspectRotY, inspectRotZ);

    if (now > this.muzzleFlashExpires) {
      this.muzzleMesh.visible = false;
      this.muzzleLight.intensity = 0;
    }

    // Sync local player transform to multiplayer room (~22Hz)
    if (this.mpClient && now - this.lastNetStateEmit >= 45) {
      this.lastNetStateEmit = now;
      this.mpClient.send({
        type: 'player:state',
        x: this.playerX,
        y: this.playerY,
        z: this.playerZ,
        yaw: this.playerYaw + Math.PI,
        pitch: this.playerPitch,
        crouching,
        alive: this.playerAlive,
        health: this.playerHealth,
        armor: this.playerArmor,
        weaponId: activeWid,
        skinId: this.profile.equippedSkins[activeWid] ?? SkinId.STANDARD,
        money: this.playerMoney,
      });
    }
  }

  private hasLineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    _v1.set(ax, ay, az);
    _v2.set(bx - ax, by - ay, bz - az);
    const dist = _v2.length();
    if (dist < 0.1) return true;
    _v2.divideScalar(dist);
    this.raycaster.set(_v1, _v2);
    this.raycaster.far = dist;
    const hits = this.raycaster.intersectObjects(this.worldCollisionMeshes, false);
    return hits.length === 0;
  }

  private updateBots(dt: number, now: number) {
    for (const bot of this.bots) {
      if (!bot.alive) {
        if (this.matchConfig.mode !== GameMode.CLASSIC && now >= bot.respawnAt) {
          const [sx, sy, sz] = this.getSpawnPos(bot.faction, Math.floor(Math.random() * 4));
          bot.x = sx;
          bot.y = sy;
          bot.z = sz;
          bot.health = 100;
          bot.armor = 100;
          bot.alive = true;
          bot.rig.group.visible = true;
          const [tx, tz] = this.pickPatrolTarget();
          bot.targetX = tx;
          bot.targetZ = tz;
        }
        continue;
      }

      const isEnemyToPlayer =
        this.matchConfig.mode === GameMode.DEATHMATCH || bot.faction !== this.matchConfig.playerFaction;

      let canSeeTarget = false;
      let targetPosX = this.playerX;
      let targetPosZ = this.playerZ;
      let targetBot: BotState | null = null;
      let closestDist = Infinity;

      // Blinded bots cannot see or shoot
      const isBotBlinded = now < bot.blindUntil;

      // Check player visibility (blocked by smoke clouds!)
      if (!isBotBlinded && isEnemyToPlayer && this.playerAlive) {
        const dPlayer = Math.hypot(this.playerX - bot.x, this.playerZ - bot.z);
        if (
          dPlayer < 48 &&
          !this.isBlockedBySmoke(bot.x, bot.y + 1.5, bot.z, this.playerX, this.playerY + 1.45, this.playerZ) &&
          this.hasLineOfSight(bot.x, bot.y + 1.5, bot.z, this.playerX, this.playerY + 1.45, this.playerZ)
        ) {
          canSeeTarget = true;
          closestDist = dPlayer;
          targetPosX = this.playerX;
          targetPosZ = this.playerZ;
        }
      }

      // Check opposing bots visibility (blocked by smoke clouds!)
      if (!isBotBlinded) {
        for (const other of this.bots) {
          if (!other.alive || other.id === bot.id) continue;
          if (this.matchConfig.mode !== GameMode.DEATHMATCH && other.faction === bot.faction) continue;
          const dBot = Math.hypot(other.x - bot.x, other.z - bot.z);
          if (
            dBot < closestDist &&
            dBot < 42 &&
            !this.isBlockedBySmoke(bot.x, bot.y + 1.5, bot.z, other.x, other.y + 1.45, other.z) &&
            this.hasLineOfSight(bot.x, bot.y + 1.5, bot.z, other.x, other.y + 1.45, other.z)
          ) {
            canSeeTarget = true;
            closestDist = dBot;
            targetBot = other;
            targetPosX = other.x;
            targetPosZ = other.z;
          }
        }
      }

      if (canSeeTarget) {
        if (bot.spotTime === 0) bot.spotTime = now;
        const dx = targetPosX - bot.x;
        const dz = targetPosZ - bot.z;
        bot.yaw = Math.atan2(dx, dz);

        // Tactical strafe while shooting
        bot.strafeTimer -= dt;
        if (bot.strafeTimer <= 0) {
          bot.strafeTimer = 0.6 + Math.random() * 0.9;
          bot.strafeDir *= -1;
        }
        const strafeSpeed = 2.6;
        const sx = Math.cos(bot.yaw) * bot.strafeDir * strafeSpeed * dt;
        const sz = -Math.sin(bot.yaw) * bot.strafeDir * strafeSpeed * dt;
        const [nx, nz] = this.resolveCollisions(bot.x + sx, bot.z + sz, 0.45, bot.y);
        bot.x = nx;
        bot.z = nz;
        bot.y = this.getFloorHeightAt(bot.x, bot.z, bot.y);
        bot.walkPhase += dt * 7;

        // Shoot after reaction delay
        const fireCooldown =
          this.matchConfig.difficulty === BotDifficulty.HARD
            ? 240
            : this.matchConfig.difficulty === BotDifficulty.MEDIUM
            ? 380
            : 560;

        if (now - bot.spotTime > bot.reactionDelayMs && now - bot.lastShotAt > fireCooldown) {
          bot.lastShotAt = now;
          const distAtten = Math.max(0.1, 1 - closestDist / 55);
          soundEngine.playGunshot(bot.weaponId, distAtten * 0.75);

          const accuracy =
            this.matchConfig.difficulty === BotDifficulty.HARD
              ? 0.42
              : this.matchConfig.difficulty === BotDifficulty.MEDIUM
              ? 0.28
              : 0.16;

          const start = _v1.set(bot.x, bot.y + 1.45, bot.z);
          const end = _v2.set(
            targetPosX + (Math.random() - 0.5) * (1.8 - accuracy * 2.2),
            (targetBot ? targetBot.y : this.playerY) + 1.2 + (Math.random() - 0.5) * 0.7,
            targetPosZ + (Math.random() - 0.5) * (1.8 - accuracy * 2.2)
          );
          this.spawnTracer(start, end, 0xfca5a5);

          if (Math.random() < accuracy) {
            const rawDmg = this.matchConfig.difficulty === BotDifficulty.HARD ? 18 : 13;
            if (targetBot) {
              targetBot.health -= rawDmg * 1.4;
              if (targetBot.health <= 0) {
                targetBot.alive = false;
                targetBot.deaths += 1;
                targetBot.rig.group.visible = false;
                targetBot.respawnAt = now + 2500;
                bot.kills += 1;
                bot.score += 100;
                this.pushKillfeed({
                  id: `${Date.now()}_${Math.random()}`,
                  killerName: bot.name,
                  killerFaction: bot.faction,
                  victimName: targetBot.name,
                  victimFaction: targetBot.faction,
                  weaponId: bot.weaponId,
                  headshot: false,
                  timestamp: now,
                });
                this.checkRoundEnd();
              }
            } else if (this.playerAlive) {
              this.applyDamageToPlayer(rawDmg, bot);
            }
          }
        }
      } else {
        bot.spotTime = 0;
        // Patrol toward waypoint
        const dx = bot.targetX - bot.x;
        const dz = bot.targetZ - bot.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.8) {
          const [tx, tz] = this.pickPatrolTarget();
          bot.targetX = tx;
          bot.targetZ = tz;
        } else {
          const moveSpeed = 3.6;
          bot.yaw = Math.atan2(dx, dz);
          const prevX = bot.x;
          const prevZ = bot.z;
          const [nx, nz] = this.resolveCollisions(
            bot.x + (dx / dist) * moveSpeed * dt,
            bot.z + (dz / dist) * moveSpeed * dt,
            0.45,
            bot.y
          );
          bot.x = nx;
          bot.z = nz;
          bot.y = this.getFloorHeightAt(bot.x, bot.z, bot.y);
          bot.walkPhase += dt * 8;
          // If stuck on obstacle, pick a fresh waypoint
          if (Math.hypot(nx - prevX, nz - prevZ) < 0.01) {
            const [tx, tz] = this.pickPatrolTarget();
            bot.targetX = tx;
            bot.targetZ = tz;
          }
        }
      }

      // Sync 3D rig transform & leg stride
      bot.rig.group.position.set(bot.x, bot.y, bot.z);
      bot.rig.group.rotation.y = bot.yaw;
      const swing = Math.sin(bot.walkPhase) * 0.42;
      bot.rig.leftLeg.rotation.x = swing;
      bot.rig.rightLeg.rotation.x = -swing;
    }
  }

  private applyDamageToPlayer(dmg: number, attacker: BotState) {
    if (!this.playerAlive) return;
    let finalDmg = dmg;
    if (this.playerArmor > 0) {
      this.playerArmor = Math.max(0, this.playerArmor - dmg * 0.35);
      finalDmg = dmg * 0.65;
    }
    this.playerHealth = Math.max(0, Math.round(this.playerHealth - finalDmg));
    this.damageFlash = 0.85;
    soundEngine.playHitSound(false);

    if (this.playerHealth <= 0) {
      this.playerAlive = false;
      this.playerDeaths += 1;
      this.playerRespawnAt = performance.now() + 2600;
      this.bhopSpeedMult = 1.0;
      this.groundedWithoutJumpSec = 0;
      this.isScoped = false;
      this.camera.fov = this.settings.fov;
      this.camera.updateProjectionMatrix();
      attacker.kills += 1;
      attacker.score += 100;

      this.pushKillfeed({
        id: `${Date.now()}_${Math.random()}`,
        killerName: attacker.name,
        killerFaction: attacker.faction,
        victimName: this.profile.name,
        victimFaction: this.matchConfig.playerFaction,
        weaponId: attacker.weaponId,
        headshot: false,
        timestamp: performance.now(),
      });

      this.checkRoundEnd();
    }
  }

  private checkRoundEnd() {
    if (this.matchConfig.mode !== GameMode.CLASSIC || this.roundOverFreezeUntil > 0) return;

    // Pure server-authoritative PvP rooms handle round transitions on server
    if (this.mpClient && this.bots.length === 0) return;

    const ctAlive =
      (this.matchConfig.playerFaction === Faction.CT && this.playerAlive) ||
      this.bots.some((b) => b.faction === Faction.CT && b.alive) ||
      Array.from(this.remotePlayers.values()).some((rp) => rp.faction === Faction.CT && rp.alive);
    const tAlive =
      (this.matchConfig.playerFaction === Faction.T && this.playerAlive) ||
      this.bots.some((b) => b.faction === Faction.T && b.alive) ||
      Array.from(this.remotePlayers.values()).some((rp) => rp.faction === Faction.T && rp.alive);

    if (!ctAlive || !tAlive) {
      const winner = ctAlive ? Faction.CT : Faction.T;
      if (this.mpClient && this.mpRoom?.hostId === this.mpClient.clientId) {
        this.mpClient.send({ type: 'round:sync_finish', winner });
      }
      this.finishRound(winner);
    }
  }

  private finishRound(winner: Faction) {
    if (winner === Faction.CT) this.ctScore += 1;
    else this.tScore += 1;

    const playerWon = winner === this.matchConfig.playerFaction;
    this.playerMoney = Math.min(16000, this.playerMoney + (playerWon ? 3250 : 1900));
    this.roundBanner =
      winner === Faction.CT
        ? this.settings.language === 'uz'
          ? 'MAXSUS KUCHLAR (CT) G‘ALABA QOZONDI'
          : 'COUNTER-TERRORISTS WIN'
        : this.settings.language === 'uz'
        ? 'HUJUMCHILAR (T) G‘ALABA QOZONDI'
        : 'TERRORISTS WIN';

    soundEngine.playRoundChime(playerWon);
    this.roundOverFreezeUntil = performance.now() + 3400;
  }

  private updateFX(dt: number, now: number) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      if (now >= this.tracers[i].expiresAt) {
        const t = this.tracers[i];
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      if (now >= s.expiresAt) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
        this.sparks.splice(i, 1);
      } else {
        s.vel.y -= 12 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
      }
    }

    // Update thrown grenades physics & detonation
    const halfW = this.activeMap.arenaWidth / 2 - 0.25;
    const halfD = this.activeMap.arenaDepth / 2 - 0.25;
    for (let i = this.thrownGrenades.length - 1; i >= 0; i--) {
      const g = this.thrownGrenades[i];
      if (now >= g.detonateAt) {
        this.detonateGrenade(g, now);
        this.scene.remove(g.group);
        g.group.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            const m = o as THREE.Mesh;
            m.geometry?.dispose();
            if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
            else m.material?.dispose();
          }
        });
        this.thrownGrenades.splice(i, 1);
        continue;
      }

      g.vel.y -= 18.0 * dt;
      const nextX = g.pos.x + g.vel.x * dt;
      const nextY = g.pos.y + g.vel.y * dt;
      const nextZ = g.pos.z + g.vel.z * dt;

      // Perimeter wall bounce
      if (nextX <= -halfW || nextX >= halfW) {
        g.vel.x *= -0.52;
        g.pos.x = THREE.MathUtils.clamp(nextX, -halfW, halfW);
        soundEngine.playGrenadeBounce(0.5);
      } else {
        g.pos.x = nextX;
      }
      if (nextZ <= -halfD || nextZ >= halfD) {
        g.vel.z *= -0.52;
        g.pos.z = THREE.MathUtils.clamp(nextZ, -halfD, halfD);
        soundEngine.playGrenadeBounce(0.5);
      } else {
        g.pos.z = nextZ;
      }

      // Obstacle side & top bounce
      let landedY = 0.08;
      for (const box of this.aabbs) {
        if (g.pos.x >= box.minX - 0.14 && g.pos.x <= box.maxX + 0.14 && g.pos.z >= box.minZ - 0.14 && g.pos.z <= box.maxZ + 0.14) {
          if (g.pos.y >= box.maxY - 0.18 && nextY <= box.maxY + 0.1) {
            landedY = Math.max(landedY, box.maxY + 0.08);
          } else if (nextY < box.maxY && nextY > box.minY) {
            // Side bounce push
            const penL = Math.abs(g.pos.x - box.minX);
            const penR = Math.abs(box.maxX - g.pos.x);
            const penT = Math.abs(g.pos.z - box.minZ);
            const penB = Math.abs(box.maxZ - g.pos.z);
            const minP = Math.min(penL, penR, penT, penB);
            if (minP === penL || minP === penR) {
              g.vel.x *= -0.55;
              g.pos.x = minP === penL ? box.minX - 0.15 : box.maxX + 0.15;
            } else {
              g.vel.z *= -0.55;
              g.pos.z = minP === penT ? box.minZ - 0.15 : box.maxZ + 0.15;
            }
            if (g.vel.length() > 2.2) soundEngine.playGrenadeBounce(0.55);
          }
        }
      }

      if (nextY <= landedY) {
        g.pos.y = landedY;
        if (Math.abs(g.vel.y) > 1.8) {
          soundEngine.playGrenadeBounce(Math.min(0.8, Math.abs(g.vel.y) / 14));
          g.vel.y = -g.vel.y * 0.45;
          g.vel.x *= 0.72;
          g.vel.z *= 0.72;
        } else {
          g.vel.y = 0;
          g.vel.x *= 0.88;
          g.vel.z *= 0.88;
        }
      } else {
        g.pos.y = nextY;
      }

      g.group.position.copy(g.pos);
      g.group.rotation.x += g.rotVel.x * dt;
      g.group.rotation.y += g.rotVel.y * dt;
      g.group.rotation.z += g.rotVel.z * dt;

      if (now - g.lastTrailAt > 45 && g.vel.length() > 3.5) {
        g.lastTrailAt = now;
        const trailCol = g.id === GrenadeId.HE ? 0xf97316 : g.id === GrenadeId.FLASH ? 0x38bdf8 : 0x10b981;
        this.spawnImpactSparks(g.pos, trailCol, 1);
      }
    }

    // Update explosion fireball/shockwave animations
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      const elapsed = now - ex.startedAt;
      const p = elapsed / ex.durationMs;
      if (p >= 1) {
        this.scene.remove(ex.core, ex.ring, ex.light);
        ex.core.geometry.dispose();
        (ex.core.material as THREE.Material).dispose();
        ex.ring.geometry.dispose();
        (ex.ring.material as THREE.Material).dispose();
        this.explosions.splice(i, 1);
      } else {
        const coreScale = ex.isFlash ? 1 + p * 6.5 : 1 + p * 6.0;
        ex.core.scale.setScalar(coreScale);
        (ex.core.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.9;
        const ringScale = 1 + p * (ex.isFlash ? 5.5 : 8.5);
        ex.ring.scale.setScalar(ringScale);
        (ex.ring.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.8;
        ex.light.intensity = (ex.isFlash ? 20 : 12) * (1 - p);
      }
    }

    // Update volumetric smoke clouds ("Dimka")
    for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
      const sc = this.smokeClouds[i];
      const elapsed = now - sc.startedAt;
      if (elapsed >= sc.durationMs) {
        this.scene.remove(sc.group);
        for (const puff of sc.puffs) {
          puff.sprite.material.dispose();
        }
        this.smokeClouds.splice(i, 1);
        continue;
      }

      const bloom = Math.min(1, elapsed / 750);
      const fadeOut = elapsed > sc.durationMs - 2200 ? Math.max(0, (sc.durationMs - elapsed) / 2200) : 1;
      for (const puff of sc.puffs) {
        puff.sprite.position.copy(puff.targetOffset).multiplyScalar(bloom);
        const s = puff.baseScale * (0.35 + bloom * 0.65);
        puff.sprite.scale.set(s, s, 1);
        puff.sprite.material.rotation += puff.rotSpeed * dt;
        puff.sprite.material.opacity = 0.72 * fadeOut;
      }
    }

    if (this.dustPoints) {
      this.dustPoints.rotation.y += dt * 0.015;
    }
  }

  private emitHud(force = false) {
    const now = performance.now();
    if (!force && now - this.lastHudEmit < 55) return;
    this.lastHudEmit = now;

    const activeWeaponId = this.ownedWeapons[this.activeSlot] ?? WeaponId.KNIFE;
    const ammo = this.ammoState[activeWeaponId];

    const radarBlips: RadarBlip[] = [
      {
        id: 'player',
        x: this.playerX,
        z: this.playerZ,
        faction: this.matchConfig.playerFaction,
        isPlayer: true,
        alive: this.playerAlive,
      },
      ...this.bots.map((b) => ({
        id: b.id,
        x: b.x,
        z: b.z,
        faction: b.faction,
        isPlayer: false,
        alive: b.alive,
      })),
      ...Array.from(this.remotePlayers.values()).map((rp) => ({
        id: rp.id,
        x: rp.x,
        z: rp.z,
        faction: rp.faction,
        isPlayer: false,
        alive: rp.alive,
      })),
    ];

    const scoreboard: ScoreboardRow[] = [
      {
        id: 'player',
        name: this.profile.name,
        clanTag: this.profile.clanTag,
        faction: this.matchConfig.playerFaction,
        isPlayer: true,
        alive: this.playerAlive,
        kills: this.playerKills,
        deaths: this.playerDeaths,
        assists: 0,
        score: this.playerScore,
        money: this.playerMoney,
      },
      ...this.bots.map((b) => ({
        id: b.id,
        name: b.name,
        clanTag: b.faction,
        faction: b.faction,
        isPlayer: false,
        alive: b.alive,
        kills: b.kills,
        deaths: b.deaths,
        assists: b.assists,
        score: b.score,
        money: b.money,
      })),
      ...Array.from(this.remotePlayers.values()).map((rp) => ({
        id: rp.id,
        name: rp.name,
        clanTag: rp.clanTag,
        faction: rp.faction,
        isPlayer: false,
        alive: rp.alive,
        kills: rp.kills,
        deaths: rp.deaths,
        assists: 0,
        score: rp.score,
        money: rp.money,
      })),
    ].sort((a, b) => b.score - a.score);

    const moving = this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD'];
    const isCrouching = Boolean(this.keys['ControlLeft'] || this.keys['ControlRight'] || this.keys['KeyC']);
    const crosshairSpread =
      (moving ? 14 : 0) + this.recoilPitch * 240 + (isCrouching ? -3 : 0);

    const assistActive = hasSpecialAimTag(this.profile.name);
    const enemyDots: EnemyDotMarker[] = [];

    if (assistActive && this.mode === 'match') {
      this.camera.updateMatrixWorld();
      const pushDotForTarget = (id: string, name: string, headMesh: THREE.Object3D) => {
        headMesh.getWorldPosition(_v1);
        const dist = _v1.distanceTo(this.camera.position);
        const visible = this.hasLineOfSight(
          this.camera.position.x,
          this.camera.position.y,
          this.camera.position.z,
          _v1.x,
          _v1.y,
          _v1.z
        );
        _v1.project(this.camera);
        if (_v1.z > -1 && _v1.z < 1) {
          const sx = (_v1.x * 0.5 + 0.5) * 100;
          const sy = (-_v1.y * 0.5 + 0.5) * 100;
          if (sx >= 2 && sx <= 98 && sy >= 2 && sy <= 98) {
            enemyDots.push({
              id,
              screenX: sx,
              screenY: sy,
              distance: Math.round(dist),
              visible,
              name,
            });
          }
        }
      };

      for (const b of this.bots) {
        if (!b.alive) continue;
        if (this.matchConfig.mode !== GameMode.DEATHMATCH && b.faction === this.matchConfig.playerFaction) continue;
        pushDotForTarget(b.id, b.name, b.rig.headMesh);
      }
      for (const rp of this.remotePlayers.values()) {
        if (!rp.alive) continue;
        if (this.matchConfig.mode !== GameMode.DEATHMATCH && rp.faction === this.matchConfig.playerFaction) continue;
        pushDotForTarget(rp.id, rp.name, rp.rig.headMesh);
      }
    }

    this.onHudUpdate({
      health: this.playerHealth,
      armor: this.playerArmor,
      money: this.playerMoney,
      activeSlot: this.activeSlot,
      activeWeaponId,
      ammoInMag: ammo.mag,
      ammoReserve: ammo.reserve,
      isReloading: this.isReloading,
      isScoped: this.isScoped,
      isCrouching,
      roundNumber: this.roundNumber,
      ctScore: this.ctScore,
      tScore: this.tScore,
      roundTimeRemaining: Math.max(0, Math.ceil(this.roundTimeRemaining)),
      roundBanner: this.roundBanner,
      hitMarkerType: now < this.hitMarkerExpires ? this.hitMarkerType : 'none',
      damageFlash: this.damageFlash,
      playerYaw: this.playerYaw,
      playerX: this.playerX,
      playerZ: this.playerZ,
      radarBlips,
      enemyDots,
      assistActive,
      speedMultiplier: Number(this.bhopSpeedMult.toFixed(2)),
      killfeed: this.killfeed.filter((k) => now - k.timestamp < 5500),
      scoreboard,
      isAlive: this.playerAlive,
      respawnTimer: this.playerAlive ? 0 : Math.max(0, (this.playerRespawnAt - now) / 1000),
      ownedWeapons: { ...this.ownedWeapons },
      ownedGrenades: { ...this.ownedGrenades },
      activeGrenade: this.activeGrenade,
      flashBlindAlpha: this.flashBlindAlpha,
      pointerLocked: this.pointerLocked,
      crosshairSpread: Math.max(0, crosshairSpread),
    });
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = () => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (this.mode === 'menu') {
      this.showcaseAngle += dt * 0.65;
      if (this.showcaseWeaponGroup) {
        this.showcaseWeaponGroup.rotation.y = Math.PI * 0.68 + Math.sin(this.showcaseAngle) * 0.45;
        this.showcaseWeaponGroup.position.y = 1.45 + Math.sin(this.showcaseAngle * 1.6) * 0.05;
      }
      if (this.showcaseOperatorRig) {
        this.showcaseOperatorRig.group.rotation.y = 0.35 + Math.sin(this.showcaseAngle * 0.5) * 0.14;
      }
    } else {
      // Active match loop
      if (this.roundOverFreezeUntil > 0) {
        if (now >= this.roundOverFreezeUntil) {
          this.roundNumber += 1;
          this.startRound();
        }
      } else {
        this.roundTimeRemaining -= dt;
        if (this.roundTimeRemaining <= 0) {
          if (this.matchConfig.mode === GameMode.CLASSIC) {
            this.finishRound(Faction.CT);
          } else {
            this.roundTimeRemaining = 300;
          }
        }
      }

      this.updatePlayer(dt, now);
      this.updateBots(dt, now);
      this.updateRemotePlayers(dt);
      this.updateFX(dt, now);
      this.emitHud(false);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private updateRemotePlayers(dt: number) {
    for (const rp of this.remotePlayers.values()) {
      if (!rp.alive) {
        rp.rig.group.visible = false;
        continue;
      }
      rp.rig.group.visible = true;
      const moveDist = Math.hypot(rp.targetX - rp.x, rp.targetZ - rp.z);
      rp.x = THREE.MathUtils.damp(rp.x, rp.targetX, 14, dt);
      rp.y = THREE.MathUtils.damp(rp.y, rp.targetY, 14, dt);
      rp.z = THREE.MathUtils.damp(rp.z, rp.targetZ, 14, dt);
      rp.yaw = THREE.MathUtils.damp(rp.yaw, rp.targetYaw, 14, dt);

      rp.rig.group.position.set(rp.x, rp.y, rp.z);
      rp.rig.group.rotation.y = rp.yaw;
      rp.rig.upperBody.position.y = rp.crouching ? 0.56 : 0.82;

      if (moveDist > 0.04) {
        rp.walkPhase += dt * 10;
        const swing = Math.sin(rp.walkPhase) * 0.42;
        rp.rig.leftLeg.rotation.x = swing;
        rp.rig.rightLeg.rotation.x = -swing;
      } else {
        rp.rig.leftLeg.rotation.x = THREE.MathUtils.damp(rp.rig.leftLeg.rotation.x, 0, 10, dt);
        rp.rig.rightLeg.rotation.x = THREE.MathUtils.damp(rp.rig.rightLeg.rotation.x, 0, 10, dt);
      }
    }
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);

    this.exitPointerLock();
    this.clearBots();
    this.clearRemotePlayers();
    this.clearFX();
    this.clearGroup(this.worldGroup);
    this.clearGroup(this.showcaseGroup);
    this.textures.dispose();
    this.envRT.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
