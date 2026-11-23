import type { Faction, GameMode, GrenadeId, MapId, SkinId, WeaponId } from './game';

export type PlayConnectionMode = 'bot' | 'local';

export interface RoomPlayerInfo {
  id: string;
  name: string;
  clanTag: string;
  faction: Faction;
  avatarId: string;
  isHost: boolean;
  alive: boolean;
  health: number;
  armor: number;
  kills: number;
  deaths: number;
  score: number;
  money: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  crouching: boolean;
  weaponId: WeaponId;
  skinId: SkinId;
}

export interface RoomState {
  code: string;
  hostId: string;
  status: 'lobby' | 'playing';
  mapId: MapId;
  mode: GameMode;
  fillBots: number;
  ctScore: number;
  tScore: number;
  roundNumber: number;
  players: RoomPlayerInfo[];
}

export interface RemoteShootEvent {
  shooterId: string;
  shooterName: string;
  weaponId: WeaponId;
  muzzlePos: [number, number, number];
  hitPoint: [number, number, number];
}

export interface RemoteGrenadeEvent {
  throwerId: string;
  grenadeId: GrenadeId;
  pos: [number, number, number];
  vel: [number, number, number];
  detonateDelayMs: number;
}

export interface RemoteSprayEvent {
  playerId: string;
  pos: [number, number, number];
  normal: [number, number, number];
  decalIndex: number;
}

export interface RemoteKillEvent {
  killerId: string;
  killerName: string;
  killerFaction: Faction;
  victimId: string;
  victimName: string;
  victimFaction: Faction;
  weaponId: WeaponId | GrenadeId;
  headshot: boolean;
}

export type ClientToServerMessage =
  | {
      type: 'room:create';
      player: {
        clientId: string;
        name: string;
        clanTag: string;
        faction: Faction;
        avatarId: string;
        weaponId: WeaponId;
        skinId: SkinId;
      };
      mapId: MapId;
      mode: GameMode;
      fillBots: number;
    }
  | {
      type: 'room:join';
      code: string;
      player: {
        clientId: string;
        name: string;
        clanTag: string;
        faction: Faction;
        avatarId: string;
        weaponId: WeaponId;
        skinId: SkinId;
      };
    }
  | {
      type: 'room:leave';
    }
  | {
      type: 'room:switch_faction';
      faction: Faction;
    }
  | {
      type: 'room:update_config';
      mapId: MapId;
      mode: GameMode;
      fillBots: number;
    }
  | {
      type: 'room:start';
    }
  | {
      type: 'player:state';
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch: number;
      crouching: boolean;
      alive: boolean;
      health: number;
      armor: number;
      weaponId: WeaponId;
      skinId: SkinId;
      money: number;
    }
  | {
      type: 'player:shoot';
      weaponId: WeaponId;
      muzzlePos: [number, number, number];
      hitPoint: [number, number, number];
    }
  | {
      type: 'player:hit';
      targetId: string;
      damage: number;
      weaponId: WeaponId | GrenadeId;
      headshot: boolean;
    }
  | {
      type: 'player:respawn';
      x: number;
      y: number;
      z: number;
    }
  | {
      type: 'player:grenade';
      grenadeId: GrenadeId;
      pos: [number, number, number];
      vel: [number, number, number];
      detonateDelayMs: number;
    }
  | {
      type: 'player:spray';
      pos: [number, number, number];
      normal: [number, number, number];
      decalIndex: number;
    }
  | {
      type: 'round:sync_finish';
      winner: Faction;
    };

export type ServerToClientMessage =
  | {
      type: 'room:joined';
      clientId: string;
      room: RoomState;
    }
  | {
      type: 'room:state';
      room: RoomState;
    }
  | {
      type: 'room:error';
      code: string;
      messageUz: string;
      messageEn: string;
    }
  | {
      type: 'match:started';
      room: RoomState;
      seed: number;
    }
  | {
      type: 'round:reset';
      room: RoomState;
      winner?: Faction;
    }
  | {
      type: 'players:snapshot';
      players: RoomPlayerInfo[];
    }
  | {
      type: 'player:shoot';
      event: RemoteShootEvent;
    }
  | {
      type: 'player:damaged';
      attackerId: string;
      attackerName: string;
      damage: number;
      health: number;
      armor: number;
      headshot: boolean;
    }
  | {
      type: 'player:killed';
      event: RemoteKillEvent;
    }
  | {
      type: 'player:grenade';
      event: RemoteGrenadeEvent;
    }
  | {
      type: 'player:spray';
      event: RemoteSprayEvent;
    };
