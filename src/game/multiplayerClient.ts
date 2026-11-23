import { Faction, GameMode, GrenadeId, MapId, PlayerProfile, SkinId, WeaponId } from '../types/game';
import type {
  ClientToServerMessage,
  RemoteGrenadeEvent,
  RemoteKillEvent,
  RemoteShootEvent,
  RemoteSprayEvent,
  RoomPlayerInfo,
  RoomState,
  ServerToClientMessage,
} from '../types/multiplayer';

export interface MultiplayerCallbacks {
  onRoomJoined?: (clientId: string, room: RoomState) => void;
  onRoomState?: (room: RoomState) => void;
  onRoomError?: (messageUz: string, messageEn: string) => void;
  onMatchStarted?: (room: RoomState) => void;
  onRoundReset?: (room: RoomState, winner?: Faction) => void;
  onPlayersSnapshot?: (players: RoomPlayerInfo[]) => void;
  onRemoteShoot?: (event: RemoteShootEvent) => void;
  onLocalDamaged?: (payload: {
    attackerId: string;
    attackerName: string;
    damage: number;
    health: number;
    armor: number;
    headshot: boolean;
  }) => void;
  onRemoteKilled?: (event: RemoteKillEvent) => void;
  onRemoteGrenade?: (event: RemoteGrenadeEvent) => void;
  onRemoteSpray?: (event: RemoteSprayEvent) => void;
  onDisconnect?: () => void;
}

const CLIENT_ID_STORAGE_KEY = 'strikefront2_client_id_v1';

function getOrCreateClientId(): string {
  try {
    const existing = sessionStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (existing) return existing;
    const next = `op_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return `op_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private connecting: Promise<void> | null = null;
  private callbacks: MultiplayerCallbacks = {};
  public readonly clientId: string;

  constructor() {
    this.clientId = getOrCreateClientId();
  }

  public setCallbacks(cb: MultiplayerCallbacks) {
    this.callbacks = cb;
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public async connect(): Promise<void> {
    if (this.isConnected()) return;
    if (this.connecting) return this.connecting;

    this.connecting = new Promise<void>((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(url);
      this.ws = socket;

      const timeout = window.setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          socket.close();
          this.connecting = null;
          reject(new Error('WebSocket connection timeout'));
        }
      }, 6000);

      socket.onopen = () => {
        window.clearTimeout(timeout);
        this.connecting = null;
        resolve();
      };

      socket.onerror = () => {
        window.clearTimeout(timeout);
        this.connecting = null;
        reject(new Error('WebSocket connection error'));
      };

      socket.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as ServerToClientMessage;
          this.handleMessage(msg);
        } catch {
          // ignore malformed messages
        }
      };

      socket.onclose = () => {
        this.ws = null;
        this.connecting = null;
        this.callbacks.onDisconnect?.();
      };
    });

    return this.connecting;
  }

  private handleMessage(msg: ServerToClientMessage) {
    switch (msg.type) {
      case 'room:joined':
        this.callbacks.onRoomJoined?.(msg.clientId, msg.room);
        break;
      case 'room:state':
        this.callbacks.onRoomState?.(msg.room);
        break;
      case 'room:error':
        this.callbacks.onRoomError?.(msg.messageUz, msg.messageEn);
        break;
      case 'match:started':
        this.callbacks.onMatchStarted?.(msg.room);
        break;
      case 'round:reset':
        this.callbacks.onRoundReset?.(msg.room, msg.winner);
        break;
      case 'players:snapshot':
        this.callbacks.onPlayersSnapshot?.(msg.players);
        break;
      case 'player:shoot':
        this.callbacks.onRemoteShoot?.(msg.event);
        break;
      case 'player:damaged':
        this.callbacks.onLocalDamaged?.(msg);
        break;
      case 'player:killed':
        this.callbacks.onRemoteKilled?.(msg.event);
        break;
      case 'player:grenade':
        this.callbacks.onRemoteGrenade?.(msg.event);
        break;
      case 'player:spray':
        this.callbacks.onRemoteSpray?.(msg.event);
        break;
    }
  }

  public send(msg: ClientToServerMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public async createRoom(profile: PlayerProfile, mapId: MapId, mode: GameMode, fillBots = 0) {
    await this.connect();
    const weaponId = profile.preferredPrimary || WeaponId.AK47;
    const skinId = profile.equippedSkins[weaponId] || SkinId.STANDARD;
    this.send({
      type: 'room:create',
      player: {
        clientId: this.clientId,
        name: profile.name,
        clanTag: profile.clanTag,
        faction: profile.faction,
        avatarId: profile.avatarId,
        weaponId,
        skinId,
      },
      mapId,
      mode,
      fillBots,
    });
  }

  public async joinRoom(code: string, profile: PlayerProfile) {
    await this.connect();
    const weaponId = profile.preferredPrimary || WeaponId.AK47;
    const skinId = profile.equippedSkins[weaponId] || SkinId.STANDARD;
    this.send({
      type: 'room:join',
      code: code.trim().toUpperCase(),
      player: {
        clientId: this.clientId,
        name: profile.name,
        clanTag: profile.clanTag,
        faction: profile.faction,
        avatarId: profile.avatarId,
        weaponId,
        skinId,
      },
    });
  }

  public leaveRoom() {
    this.send({ type: 'room:leave' });
  }

  public switchFaction(faction: Faction) {
    this.send({ type: 'room:switch_faction', faction });
  }

  public updateRoomConfig(mapId: MapId, mode: GameMode, fillBots: number) {
    this.send({ type: 'room:update_config', mapId, mode, fillBots });
  }

  public startRoomMatch() {
    this.send({ type: 'room:start' });
  }

  public sendGrenade(grenadeId: GrenadeId, pos: [number, number, number], vel: [number, number, number], detonateDelayMs: number) {
    this.send({ type: 'player:grenade', grenadeId, pos, vel, detonateDelayMs });
  }

  public dispose() {
    this.leaveRoom();
    this.ws?.close();
    this.ws = null;
  }
}
