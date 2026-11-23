export enum Faction {
  CT = 'CT',
  T = 'T',
}

export enum GameMode {
  CLASSIC = 'classic',
  DEATHMATCH = 'deathmatch',
  AIM_ARENA = 'aim_arena',
}

export enum BotDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

export enum WeaponSlot {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  MELEE = 'melee',
}

export enum WeaponId {
  AK47 = 'ak47',
  M4A1S = 'm4a1s',
  AWP = 'awp',
  DEAGLE = 'deagle',
  USPS = 'usps',
  KNIFE = 'knife',
}

export enum GrenadeId {
  HE = 'he',
  FLASH = 'flash',
  SMOKE = 'smoke',
}

export enum SkinId {
  STANDARD = 'standard',
  ASIIMOV = 'asiimov',
  GOLD = 'gold',
  COBALT = 'cobalt',
  REDLINE = 'redline',
}

export enum MapId {
  DUST2 = 'dust2',
  MIRAGE = 'mirage',
  NUKE = 'nuke',
  VERTIGO = 'vertigo',
}

export enum TacticalRole {
  ENTRY = 'entry',
  AWPER = 'awper',
  IGL = 'igl',
  SUPPORT = 'support',
  LURKER = 'lurker',
}

export enum GraphicsQuality {
  HIGH = 'high',
  MEDIUM = 'medium',
  FAST = 'fast',
}

export type Language = 'uz' | 'en';

export interface CrosshairConfig {
  color: string;
  size: number;
  thickness: number;
  gap: number;
  dot: boolean;
  dynamic: boolean;
}

export interface PlayerProfile {
  name: string;
  clanTag: string;
  faction: Faction;
  role: TacticalRole;
  rankTitle: string;
  avatarId: 'ct_specialist' | 't_operative' | 'emblem_gold' | 'emblem_cobalt';
  accentColor: string;
  bio: string;
  preferredPrimary: WeaponId;
  preferredSecondary: WeaponId;
  equippedSkins: Record<WeaponId, SkinId>;
}

export interface GameSettings {
  sensitivity: number;
  fov: number;
  volume: number;
  graphics: GraphicsQuality;
  language: Language;
  showRadar: boolean;
  crosshair: CrosshairConfig;
}

export interface MatchConfig {
  mode: GameMode;
  mapId: MapId;
  difficulty: BotDifficulty;
  botCount: number;
  playerFaction: Faction;
}

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  slot: WeaponSlot;
  categoryLabelUz: string;
  categoryLabelEn: string;
  price: number;
  damage: number;
  headshotMultiplier: number;
  armorPenetration: number;
  fireRateMs: number;
  automatic: boolean;
  magSize: number;
  reserveMax: number;
  reloadTimeMs: number;
  baseSpread: number;
  moveSpread: number;
  recoilKick: number;
  range: number;
  moveSpeedMultiplier: number;
  hasScope: boolean;
  scopeFov?: number;
}

export interface GrenadeSpec {
  id: GrenadeId;
  nameUz: string;
  nameEn: string;
  shortLabel: string;
  descUz: string;
  descEn: string;
  price: number;
  maxCarry: number;
  fuseMs: number;
}

export interface SkinSpec {
  id: SkinId;
  nameUz: string;
  nameEn: string;
  primaryHex: number;
  secondaryHex: number;
  accentHex: number;
  metalness: number;
  roughness: number;
  rarityColor: string;
}

export interface MapBoxObstacle {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  kind: 'wall' | 'crate' | 'container' | 'pillar' | 'barrier' | 'arch' | 'ramp_step' | 'door' | 'barrel' | 'car';
  color?: number;
}

export interface MapDefinition {
  id: MapId;
  nameUz: string;
  nameEn: string;
  subtitleUz: string;
  subtitleEn: string;
  previewImage: string;
  arenaWidth: number;
  arenaDepth: number;
  skyTopHex: number;
  skyHorizonHex: number;
  fogHex: number;
  fogDensity: number;
  sunHex: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiSkyHex: number;
  hemiGroundHex: number;
  groundStyle: 'sandstone' | 'concrete' | 'rooftop' | 'desert_cobble';
  ctSpawns: [number, number, number][];
  tSpawns: [number, number, number][];
  bombSiteA: [number, number];
  bombSiteB: [number, number];
  obstacles: MapBoxObstacle[];
}

export interface KillfeedEntry {
  id: string;
  killerName: string;
  killerFaction: Faction;
  victimName: string;
  victimFaction: Faction;
  weaponId: WeaponId | GrenadeId;
  headshot: boolean;
  timestamp: number;
}

export interface ScoreboardRow {
  id: string;
  name: string;
  clanTag: string;
  faction: Faction;
  isPlayer: boolean;
  alive: boolean;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  money: number;
}

export interface RadarBlip {
  id: string;
  x: number;
  z: number;
  faction: Faction;
  isPlayer: boolean;
  alive: boolean;
}

export interface EnemyDotMarker {
  id: string;
  screenX: number;
  screenY: number;
  distance: number;
  visible: boolean;
  name: string;
}

export interface HudSnapshot {
  health: number;
  armor: number;
  money: number;
  activeSlot: WeaponSlot;
  activeWeaponId: WeaponId;
  ammoInMag: number;
  ammoReserve: number;
  isReloading: boolean;
  isScoped: boolean;
  isCrouching: boolean;
  roundNumber: number;
  ctScore: number;
  tScore: number;
  roundTimeRemaining: number;
  roundBanner: string | null;
  hitMarkerType: 'none' | 'body' | 'head';
  damageFlash: number;
  playerYaw: number;
  playerX: number;
  playerZ: number;
  radarBlips: RadarBlip[];
  enemyDots: EnemyDotMarker[];
  assistActive: boolean;
  speedMultiplier: number;
  killfeed: KillfeedEntry[];
  scoreboard: ScoreboardRow[];
  isAlive: boolean;
  respawnTimer: number;
  ownedWeapons: Record<WeaponSlot, WeaponId | null>;
  ownedGrenades: Record<GrenadeId, number>;
  activeGrenade: GrenadeId | null;
  flashBlindAlpha: number;
  pointerLocked: boolean;
  crosshairSpread: number;
}

export function hasSpecialAimTag(name: string): boolean {
  const trimmed = name.trim();
  return /[%&*()$]$/.test(trimmed);
}

