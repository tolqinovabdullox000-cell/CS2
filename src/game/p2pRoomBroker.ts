import Peer, { DataConnection } from 'peerjs';
import type { Faction, GameMode, MapId } from '../types/game';
import type {
  ClientToServerMessage,
  RoomPlayerInfo,
  RoomState,
  ServerToClientMessage,
} from '../types/multiplayer';

const PEER_PREFIX = 'sf2-';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

function generateAlphanumericCode(): string {
  const chars: string[] = [
    LETTERS[Math.floor(Math.random() * LETTERS.length)],
    LETTERS[Math.floor(Math.random() * LETTERS.length)],
    LETTERS[Math.floor(Math.random() * LETTERS.length)],
    DIGITS[Math.floor(Math.random() * DIGITS.length)],
    DIGITS[Math.floor(Math.random() * DIGITS.length)],
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

interface HostRoomData {
  code: string;
  hostId: string;
  status: 'lobby' | 'playing';
  mapId: MapId;
  mode: GameMode;
  fillBots: number;
  ctScore: number;
  tScore: number;
  roundNumber: number;
  roundResetTimer: ReturnType<typeof setTimeout> | null;
  players: Map<string, RoomPlayerInfo>;
}

/**
 * Browser-based WebRTC P2P Room Broker (Host + Guest) powered by PeerJS.
 * Allows local & cross-laptop 5-char password rooms to work seamlessly on static
 * hosts like Vercel where no Node.js WebSocket server (`server.ts`) is running.
 */
export class P2PRoomTransport {
  private peer: Peer | null = null;
  private hostConn: DataConnection | null = null;
  private guestConns = new Map<string, DataConnection>();
  private connToClientId = new Map<DataConnection, string>();
  private room: HostRoomData | null = null;
  private isHostMode = false;
  private localClientId: string;
  private onServerMessage: (msg: ServerToClientMessage) => void;
  private onDisconnected: () => void;

  constructor(
    localClientId: string,
    onServerMessage: (msg: ServerToClientMessage) => void,
    onDisconnected: () => void
  ) {
    this.localClientId = localClientId;
    this.onServerMessage = onServerMessage;
    this.onDisconnected = onDisconnected;
  }

  public isConnected(): boolean {
    if (this.isHostMode) {
      return Boolean(this.peer && !this.peer.destroyed && this.room);
    }
    return Boolean(this.hostConn && this.hostConn.open);
  }

  private serializeRoom(room: HostRoomData): RoomState {
    return {
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      mapId: room.mapId,
      mode: room.mode,
      fillBots: room.fillBots,
      ctScore: room.ctScore,
      tScore: room.tScore,
      roundNumber: room.roundNumber,
      players: Array.from(room.players.values()),
    };
  }

  private sendToGuest(clientId: string, msg: ServerToClientMessage) {
    if (clientId === this.localClientId) {
      this.onServerMessage(msg);
      return;
    }
    const conn = this.guestConns.get(clientId);
    if (conn && conn.open) {
      conn.send(msg);
    }
  }

  private broadcast(msg: ServerToClientMessage, excludeClientId?: string) {
    if (excludeClientId !== this.localClientId) {
      this.onServerMessage(msg);
    }
    for (const [cid, conn] of this.guestConns.entries()) {
      if (cid !== excludeClientId && conn.open) {
        conn.send(msg);
      }
    }
  }

  private checkClassicRoundWin() {
    const room = this.room;
    if (!room || room.mode !== 'classic' || room.status !== 'playing' || room.roundResetTimer) {
      return;
    }
    if (room.fillBots > 0) return;

    const players = Array.from(room.players.values());
    const ctPlayers = players.filter((p) => p.faction === 'CT');
    const tPlayers = players.filter((p) => p.faction === 'T');
    if (ctPlayers.length === 0 || tPlayers.length === 0) return;

    const ctAlive = ctPlayers.some((p) => p.alive);
    const tAlive = tPlayers.some((p) => p.alive);
    if (!ctAlive || !tAlive) {
      const winner: Faction = (ctAlive ? 'CT' : 'T') as Faction;
      this.triggerRoundFinish(winner);
    }
  }

  private triggerRoundFinish(winner: Faction) {
    const room = this.room;
    if (!room || room.roundResetTimer) return;

    if (winner === 'CT') room.ctScore += 1;
    else room.tScore += 1;

    for (const p of room.players.values()) {
      const won = p.faction === winner;
      p.money = Math.min(16000, p.money + (won ? 3250 : 1900));
    }

    this.broadcast({
      type: 'room:state',
      room: this.serializeRoom(room),
    });

    room.roundResetTimer = setTimeout(() => {
      if (!this.room) return;
      this.room.roundResetTimer = null;
      this.room.roundNumber += 1;
      for (const p of this.room.players.values()) {
        p.alive = true;
        p.health = 100;
        p.armor = 100;
      }
      this.broadcast({
        type: 'round:reset',
        room: this.serializeRoom(this.room),
        winner,
      });
    }, 3400);
  }

  private handleHostIncomingMessage(senderClientId: string | null, conn: DataConnection | null, msg: ClientToServerMessage) {
    const room = this.room;
    if (!room) return;

    if (msg.type === 'room:join') {
      if (room.players.size >= 10 && !room.players.has(msg.player.clientId)) {
        const errMsg: ServerToClientMessage = {
          type: 'room:error',
          code: 'ROOM_FULL',
          messageUz: 'Xona to‘lgan (maksimum 10 o‘yinchi).',
          messageEn: 'Room is full (max 10 players).',
        };
        if (conn && conn.open) conn.send(errMsg);
        return;
      }

      const joinId = msg.player.clientId || `p_${Math.random().toString(36).slice(2, 10)}`;
      if (conn) {
        this.guestConns.set(joinId, conn);
        this.connToClientId.set(conn, joinId);
      }

      const ctCount = Array.from(room.players.values()).filter((p) => p.faction === 'CT').length;
      const tCount = Array.from(room.players.values()).filter((p) => p.faction === 'T').length;
      const assignedFaction: Faction =
        ctCount > tCount ? ('T' as Faction) : tCount > ctCount ? ('CT' as Faction) : msg.player.faction;

      const existing = room.players.get(joinId);
      const joinPlayer: RoomPlayerInfo = existing ?? {
        id: joinId,
        name: msg.player.name || 'Operator',
        clanTag: msg.player.clanTag || '',
        faction: assignedFaction,
        avatarId: msg.player.avatarId || 'ct_specialist',
        isHost: room.hostId === joinId,
        alive: true,
        health: 100,
        armor: 100,
        kills: 0,
        deaths: 0,
        score: 0,
        money: room.mode === 'classic' ? 1000 : 16000,
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        pitch: 0,
        crouching: false,
        weaponId: msg.player.weaponId,
        skinId: msg.player.skinId,
      };
      joinPlayer.name = msg.player.name || joinPlayer.name;
      joinPlayer.clanTag = msg.player.clanTag || '';
      room.players.set(joinId, joinPlayer);

      const serialized = this.serializeRoom(room);
      this.sendToGuest(joinId, {
        type: 'room:joined',
        clientId: joinId,
        room: serialized,
      });
      this.broadcast({ type: 'room:state', room: serialized }, joinId);

      if (room.status === 'playing') {
        this.sendToGuest(joinId, {
          type: 'match:started',
          room: serialized,
          seed: Date.now(),
        });
      }
      return;
    }

    const cid = senderClientId;
    if (!cid) return;

    if (msg.type === 'room:leave') {
      room.players.delete(cid);
      this.guestConns.delete(cid);
      this.broadcast({ type: 'room:state', room: this.serializeRoom(room) });
      return;
    }

    if (msg.type === 'room:switch_faction') {
      const p = room.players.get(cid);
      if (p) {
        p.faction = msg.faction;
        this.broadcast({ type: 'room:state', room: this.serializeRoom(room) });
      }
      return;
    }

    if (msg.type === 'room:update_config') {
      if (room.hostId !== cid) return;
      room.mapId = msg.mapId;
      room.mode = msg.mode;
      room.fillBots = Math.max(0, Math.min(8, msg.fillBots ?? 0));
      this.broadcast({ type: 'room:state', room: this.serializeRoom(room) });
      return;
    }

    if (msg.type === 'room:start') {
      if (room.hostId !== cid) return;
      room.status = 'playing';
      room.roundNumber = 1;
      room.ctScore = 0;
      room.tScore = 0;
      for (const p of room.players.values()) {
        p.alive = true;
        p.health = 100;
        p.armor = 100;
        p.kills = 0;
        p.deaths = 0;
        p.score = 0;
        p.money = room.mode === 'classic' ? 1000 : 16000;
      }
      this.broadcast({
        type: 'match:started',
        room: this.serializeRoom(room),
        seed: Date.now(),
      });
      return;
    }

    if (msg.type === 'player:state') {
      const p = room.players.get(cid);
      if (!p) return;
      p.x = msg.x;
      p.y = msg.y;
      p.z = msg.z;
      p.yaw = msg.yaw;
      p.pitch = msg.pitch;
      p.crouching = msg.crouching;
      p.alive = msg.alive;
      p.health = msg.health;
      p.armor = msg.armor;
      p.weaponId = msg.weaponId;
      p.skinId = msg.skinId;
      p.money = msg.money;

      this.broadcast(
        {
          type: 'players:snapshot',
          players: Array.from(room.players.values()),
        },
        cid
      );
      return;
    }

    if (msg.type === 'player:shoot') {
      const shooter = room.players.get(cid);
      if (!shooter) return;
      this.broadcast(
        {
          type: 'player:shoot',
          event: {
            shooterId: cid,
            shooterName: shooter.name,
            weaponId: msg.weaponId,
            muzzlePos: msg.muzzlePos,
            hitPoint: msg.hitPoint,
          },
        },
        cid
      );
      return;
    }

    if (msg.type === 'player:hit') {
      const attacker = room.players.get(cid);
      const victim = room.players.get(msg.targetId);
      if (!attacker || !victim || !victim.alive) return;

      let dmg = Math.max(1, Math.round(msg.damage));
      if (victim.armor > 0) {
        const absorbed = Math.min(victim.armor, Math.round(dmg * 0.35));
        victim.armor = Math.max(0, victim.armor - absorbed);
        dmg = Math.max(1, Math.round(dmg * 0.72));
      }
      victim.health = Math.max(0, victim.health - dmg);

      this.sendToGuest(victim.id, {
        type: 'player:damaged',
        attackerId: attacker.id,
        attackerName: attacker.name,
        damage: dmg,
        health: victim.health,
        armor: victim.armor,
        headshot: msg.headshot,
      });

      if (victim.health <= 0) {
        victim.alive = false;
        victim.deaths += 1;
        attacker.kills += 1;
        attacker.score += msg.headshot ? 150 : 100;
        attacker.money = Math.min(16000, attacker.money + (msg.headshot ? 450 : 300));

        this.broadcast({
          type: 'player:killed',
          event: {
            killerId: attacker.id,
            killerName: attacker.clanTag ? `[${attacker.clanTag}] ${attacker.name}` : attacker.name,
            killerFaction: attacker.faction,
            victimId: victim.id,
            victimName: victim.clanTag ? `[${victim.clanTag}] ${victim.name}` : victim.name,
            victimFaction: victim.faction,
            weaponId: msg.weaponId,
            headshot: msg.headshot,
          },
        });

        this.broadcast({
          type: 'players:snapshot',
          players: Array.from(room.players.values()),
        });

        this.checkClassicRoundWin();
      }
      return;
    }

    if (msg.type === 'player:respawn') {
      const p = room.players.get(cid);
      if (!p) return;
      p.alive = true;
      p.health = 100;
      p.armor = 100;
      p.x = msg.x;
      p.y = msg.y;
      p.z = msg.z;
      this.broadcast({
        type: 'players:snapshot',
        players: Array.from(room.players.values()),
      });
      return;
    }

    if (msg.type === 'player:grenade') {
      this.broadcast(
        {
          type: 'player:grenade',
          event: {
            throwerId: cid,
            grenadeId: msg.grenadeId,
            pos: msg.pos,
            vel: msg.vel,
            detonateDelayMs: msg.detonateDelayMs,
          },
        },
        cid
      );
      return;
    }

    if (msg.type === 'player:spray') {
      this.broadcast(
        {
          type: 'player:spray',
          event: {
            playerId: cid,
            pos: msg.pos,
            normal: msg.normal,
            decalIndex: msg.decalIndex,
          },
        },
        cid
      );
      return;
    }

    if (msg.type === 'round:sync_finish') {
      if (room.hostId === cid) {
        this.triggerRoundFinish(msg.winner);
      }
    }
  }

  public async createRoom(msg: Extract<ClientToServerMessage, { type: 'room:create' }>): Promise<void> {
    this.cleanup();
    this.isHostMode = true;

    for (let attempt = 0; attempt < 6; attempt++) {
      const code = generateAlphanumericCode();
      const peerId = `${PEER_PREFIX}${code}`;

      try {
        const peer = await this.openHostPeer(peerId);
        this.peer = peer;

        const hostPlayer: RoomPlayerInfo = {
          id: this.localClientId,
          name: msg.player.name || 'Operator',
          clanTag: msg.player.clanTag || '',
          faction: msg.player.faction,
          avatarId: msg.player.avatarId || 'ct_specialist',
          isHost: true,
          alive: true,
          health: 100,
          armor: 100,
          kills: 0,
          deaths: 0,
          score: 0,
          money: msg.mode === 'classic' ? 1000 : 16000,
          x: 0,
          y: 0,
          z: 0,
          yaw: 0,
          pitch: 0,
          crouching: false,
          weaponId: msg.player.weaponId,
          skinId: msg.player.skinId,
        };

        this.room = {
          code,
          hostId: this.localClientId,
          status: 'lobby',
          mapId: msg.mapId,
          mode: msg.mode,
          fillBots: Math.max(0, Math.min(8, msg.fillBots ?? 0)),
          ctScore: 0,
          tScore: 0,
          roundNumber: 1,
          roundResetTimer: null,
          players: new Map([[this.localClientId, hostPlayer]]),
        };

        peer.on('connection', (conn) => {
          conn.on('data', (raw) => {
            if (raw && typeof raw === 'object' && 'type' in raw) {
              const incoming = raw as ClientToServerMessage;
              const senderId = this.connToClientId.get(conn) ?? null;
              this.handleHostIncomingMessage(senderId, conn, incoming);
            }
          });
          conn.on('close', () => {
            const cid = this.connToClientId.get(conn);
            this.connToClientId.delete(conn);
            if (cid && this.room) {
              this.guestConns.delete(cid);
              this.room.players.delete(cid);
              this.broadcast({
                type: 'room:state',
                room: this.serializeRoom(this.room),
              });
            }
          });
        });

        this.onServerMessage({
          type: 'room:joined',
          clientId: this.localClientId,
          room: this.serializeRoom(this.room),
        });
        return;
      } catch (err) {
        const isCollision = err instanceof Error && err.message === 'UNAVAILABLE_ID';
        if (!isCollision || attempt === 5) {
          throw err;
        }
      }
    }
  }

  private openHostPeer(peerId: string): Promise<Peer> {
    return new Promise((resolve, reject) => {
      const peer = new Peer(peerId, { config: ICE_CONFIG });
      let settled = false;

      const timer = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          peer.destroy();
          reject(new Error('P2P signaling timeout'));
        }
      }, 9000);

      peer.on('open', () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(peer);
      });

      peer.on('error', (err) => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          peer.destroy();
          if (err.type === 'unavailable-id') {
            reject(new Error('UNAVAILABLE_ID'));
          } else {
            reject(new Error(err.message || 'P2P connection failed'));
          }
        }
      });

      peer.on('disconnected', () => {
        // Keep room alive during transient signaling hiccups
      });

      peer.on('close', () => {
        if (this.peer === peer) {
          this.onDisconnected();
        }
      });
    });
  }

  public async joinRoom(msg: Extract<ClientToServerMessage, { type: 'room:join' }>): Promise<void> {
    this.cleanup();
    this.isHostMode = false;

    const cleanCode = msg.code.trim().toUpperCase();
    const targetPeerId = `${PEER_PREFIX}${cleanCode}`;

    await new Promise<void>((resolve, reject) => {
      const peer = new Peer({ config: ICE_CONFIG });
      this.peer = peer;
      let settled = false;

      const timer = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          this.cleanup();
          reject(new Error('P2P join timeout'));
        }
      }, 10000);

      peer.on('open', () => {
        const conn = peer.connect(targetPeerId, { reliable: true });
        this.hostConn = conn;

        conn.on('open', () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          conn.send(msg);
          resolve();
        });

        conn.on('data', (raw) => {
          if (raw && typeof raw === 'object' && 'type' in raw) {
            this.onServerMessage(raw as ServerToClientMessage);
          }
        });

        conn.on('close', () => {
          if (this.hostConn === conn) {
            this.hostConn = null;
            this.onDisconnected();
          }
        });

        conn.on('error', () => {
          if (!settled) {
            settled = true;
            window.clearTimeout(timer);
            this.cleanup();
            reject(new Error('DataChannel error'));
          }
        });
      });

      peer.on('error', (err) => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          if (err.type === 'peer-unavailable') {
            this.cleanup();
            this.onServerMessage({
              type: 'room:error',
              code: 'ROOM_NOT_FOUND',
              messageUz: `"${cleanCode}" parolli xona topilmadi. Parolni tekshiring.`,
              messageEn: `Room "${cleanCode}" was not found. Check the 5-character code.`,
            });
            resolve();
            return;
          }
          this.cleanup();
          reject(new Error(err.message || 'P2P connection error'));
        }
      });
    });
  }

  public send(msg: ClientToServerMessage) {
    if (this.isHostMode) {
      this.handleHostIncomingMessage(this.localClientId, null, msg);
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(msg);
    }
  }

  public cleanup() {
    if (this.room?.roundResetTimer) {
      clearTimeout(this.room.roundResetTimer);
      this.room.roundResetTimer = null;
    }
    if (this.hostConn) {
      try {
        this.hostConn.close();
      } catch {
        // ignore
      }
      this.hostConn = null;
    }
    for (const conn of this.guestConns.values()) {
      try {
        conn.close();
      } catch {
        // ignore
      }
    }
    this.guestConns.clear();
    this.connToClientId.clear();
    this.room = null;
    this.isHostMode = false;
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
    }
  }
}
