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
import { P2PRoomTransport } from './p2pRoomBroker';

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
  private p2p: P2PRoomTransport | null = null;
  private transport: 'ws' | 'p2p' | null = null;
  private connecting: Promise<void> | null = null;
  private callbacks: MultiplayerCallbacks = {};
  public readonly clientId: string;

  constructor() {
    this.clientId = getOrCreateClientId();
  }

  public setCallbacks(cb: MultiplayerCallbacks) {
    this.callbacks = cb;
  }

  public getTransportMode(): 'ws' | 'p2p' | null {
    return this.transport;
  }

  public isConnected(): boolean {
    if (this.transport === 'p2p') {
      return this.p2p?.isConnected() ?? false;
    }
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private async hasLocalWebSocketServer(): Promise<boolean> {
    const customWs = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_WS_URL;
    if (customWs && customWs.trim().length > 0) {
      return true;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1400);
    try {
      const res = await fetch('/api/health', {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!res.ok) return false;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return false;
      const data = (await res.json()) as { ok?: boolean; ws?: boolean };
      return Boolean(data?.ok && data?.ws);
    } catch {
      return false;
    } finally {
      window.clearTimeout(timer);
    }
  }

  private connectWebSocket(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connecting) return this.connecting;

    this.connecting = new Promise<void>((resolve, reject) => {
      const customWs = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_WS_URL;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = customWs && customWs.trim().length > 0 ? customWs.trim() : `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(url);
      this.ws = socket;

      const timeout = window.setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          socket.close();
          this.connecting = null;
          reject(new Error('WebSocket connection timeout'));
        }
      }, 4500);

      socket.onopen = () => {
        window.clearTimeout(timeout);
        this.connecting = null;
        this.transport = 'ws';
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
        if (this.transport === 'ws') {
          this.callbacks.onDisconnect?.();
        }
      };
    });

    return this.connecting;
  }

  private ensureP2PTransport(): P2PRoomTransport {
    if (!this.p2p) {
      this.p2p = new P2PRoomTransport(
        this.clientId,
        (msg) => this.handleMessage(msg),
        () => {
          if (this.transport === 'p2p') {
            this.callbacks.onDisconnect?.();
          }
        }
      );
    }
    this.transport = 'p2p';
    return this.p2p;
  }

  public async connect(): Promise<'ws' | 'p2p'> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.transport = 'ws';
      return 'ws';
    }

    const wsAvailable = await this.hasLocalWebSocketServer();
    if (wsAvailable) {
      try {
        await this.connectWebSocket();
        return 'ws';
      } catch {
        // Fall through to WebRTC P2P when WS upgrade is blocked (e.g. static/serverless hosts)
      }
    }

    this.ensureP2PTransport();
    return 'p2p';
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
    if (this.transport === 'p2p' && this.p2p) {
      this.p2p.send(msg);
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public async createRoom(profile: PlayerProfile, mapId: MapId, mode: GameMode, fillBots = 0) {
    const modeUsed = await this.connect();
    const weaponId = profile.preferredPrimary || WeaponId.AK47;
    const skinId = profile.equippedSkins[weaponId] || SkinId.STANDARD;
    const createMsg: Extract<ClientToServerMessage, { type: 'room:create' }> = {
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
    };

    if (modeUsed === 'p2p') {
      await this.ensureP2PTransport().createRoom(createMsg);
      return;
    }

    this.send(createMsg);
  }

  public async joinRoom(code: string, profile: PlayerProfile) {
    const modeUsed = await this.connect();
    const weaponId = profile.preferredPrimary || WeaponId.AK47;
    const skinId = profile.equippedSkins[weaponId] || SkinId.STANDARD;
    const joinMsg: Extract<ClientToServerMessage, { type: 'room:join' }> = {
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
    };

    if (modeUsed === 'p2p') {
      await this.ensureP2PTransport().joinRoom(joinMsg);
      return;
    }

    this.send(joinMsg);
  }

  public leaveRoom() {
    if (this.transport === 'p2p' && this.p2p) {
      this.p2p.send({ type: 'room:leave' });
      const broker = this.p2p;
      window.setTimeout(() => broker.cleanup(), 40);
      return;
    }
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

  public sendGrenade(
    grenadeId: GrenadeId,
    pos: [number, number, number],
    vel: [number, number, number],
    detonateDelayMs: number
  ) {
    this.send({ type: 'player:grenade', grenadeId, pos, vel, detonateDelayMs });
  }

  public dispose() {
    if (this.p2p) {
      this.p2p.send({ type: 'room:leave' });
      this.p2p.cleanup();
      this.p2p = null;
    }
    if (this.ws) {
      this.send({ type: 'room:leave' });
      this.ws.close();
      this.ws = null;
    }
    this.transport = null;
  }
}
