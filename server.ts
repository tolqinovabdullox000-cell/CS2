import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import type { Faction, GameMode, MapId } from './src/types/game';
import type {
  ClientToServerMessage,
  RoomPlayerInfo,
  RoomState,
  ServerToClientMessage,
} from './src/types/multiplayer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ClientConnection {
  ws: WebSocket;
  clientId: string;
  roomCode: string | null;
}

interface ServerRoom {
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

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';

function generateAlphanumericCode(existing: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    // Guarantee mix of letters and digits (e.g. 3 letters + 2 digits, shuffled)
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
    const code = chars.join('');
    if (!existing.has(code)) return code;
  }
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

const rooms = new Map<string, ServerRoom>();
const clients = new Map<WebSocket, ClientConnection>();

function serializeRoom(room: ServerRoom): RoomState {
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

function sendMsg(ws: WebSocket, msg: ServerToClientMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastRoom(roomCode: string, msg: ServerToClientMessage, excludeClientId?: string) {
  const payload = JSON.stringify(msg);
  for (const conn of clients.values()) {
    if (conn.roomCode === roomCode && conn.clientId !== excludeClientId && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(payload);
    }
  }
}

function removeClientFromRoom(conn: ClientConnection) {
  const code = conn.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  conn.roomCode = null;
  if (!room) return;

  room.players.delete(conn.clientId);
  if (room.players.size === 0) {
    if (room.roundResetTimer) clearTimeout(room.roundResetTimer);
    rooms.delete(code);
    return;
  }

  if (room.hostId === conn.clientId) {
    const nextHost = room.players.values().next().value;
    if (nextHost) {
      room.hostId = nextHost.id;
      nextHost.isHost = true;
    }
  }

  broadcastRoom(code, { type: 'room:state', room: serializeRoom(room) });
}

function checkClassicRoundWin(room: ServerRoom) {
  if (room.mode !== 'classic' || room.status !== 'playing' || room.roundResetTimer) return;
  if (room.fillBots > 0) return; // Hybrid local+bot rooms let clients coordinate round end

  const players = Array.from(room.players.values());
  const ctPlayers = players.filter((p) => p.faction === 'CT');
  const tPlayers = players.filter((p) => p.faction === 'T');
  if (ctPlayers.length === 0 || tPlayers.length === 0) return;

  const ctAlive = ctPlayers.some((p) => p.alive);
  const tAlive = tPlayers.some((p) => p.alive);

  if (!ctAlive || !tAlive) {
    const winner: Faction = (ctAlive ? 'CT' : 'T') as Faction;
    triggerRoundFinish(room, winner);
  }
}

function triggerRoundFinish(room: ServerRoom, winner: Faction) {
  if (room.roundResetTimer) return;
  if (winner === 'CT') room.ctScore += 1;
  else room.tScore += 1;

  for (const p of room.players.values()) {
    const won = p.faction === winner;
    p.money = Math.min(16000, p.money + (won ? 3250 : 1900));
  }

  broadcastRoom(room.code, {
    type: 'room:state',
    room: serializeRoom(room),
  });

  room.roundResetTimer = setTimeout(() => {
    room.roundResetTimer = null;
    room.roundNumber += 1;
    for (const p of room.players.values()) {
      p.alive = true;
      p.health = 100;
      p.armor = 100;
    }
    broadcastRoom(room.code, {
      type: 'round:reset',
      room: serializeRoom(room),
      winner,
    });
  }, 3400);
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ws: true });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ exists: false });
      return;
    }
    res.json({
      exists: true,
      code: room.code,
      status: room.status,
      mapId: room.mapId,
      mode: room.mode,
      playerCount: room.players.size,
    });
  });

  wss.on('connection', (ws) => {
    const clientId = `p_${Math.random().toString(36).slice(2, 10)}`;
    const conn: ClientConnection = {
      ws,
      clientId,
      roomCode: null,
    };
    clients.set(ws, conn);

    ws.on('message', (raw) => {
      let msg: ClientToServerMessage;
      try {
        msg = JSON.parse(String(raw)) as ClientToServerMessage;
      } catch {
        return;
      }

      if (msg.type === 'room:create') {
        removeClientFromRoom(conn);
        const preferredId = msg.player.clientId || clientId;
        conn.clientId = preferredId;

        const existingCodes = new Set(rooms.keys());
        const code = generateAlphanumericCode(existingCodes);
        const hostPlayer: RoomPlayerInfo = {
          id: conn.clientId,
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

        const room: ServerRoom = {
          code,
          hostId: conn.clientId,
          status: 'lobby',
          mapId: msg.mapId,
          mode: msg.mode,
          fillBots: Math.max(0, Math.min(8, msg.fillBots ?? 0)),
          ctScore: 0,
          tScore: 0,
          roundNumber: 1,
          roundResetTimer: null,
          players: new Map([[conn.clientId, hostPlayer]]),
        };
        rooms.set(code, room);
        conn.roomCode = code;

        sendMsg(ws, {
          type: 'room:joined',
          clientId: conn.clientId,
          room: serializeRoom(room),
        });
        return;
      }

      if (msg.type === 'room:join') {
        const cleanCode = String(msg.code || '')
          .trim()
          .toUpperCase();
        const room = rooms.get(cleanCode);
        if (!room) {
          sendMsg(ws, {
            type: 'room:error',
            code: 'ROOM_NOT_FOUND',
            messageUz: `"${cleanCode}" parolli xona topilmadi. Parolni tekshiring.`,
            messageEn: `Room "${cleanCode}" was not found. Check the 5-character code.`,
          });
          return;
        }
        if (room.players.size >= 10 && !room.players.has(msg.player.clientId)) {
          sendMsg(ws, {
            type: 'room:error',
            code: 'ROOM_FULL',
            messageUz: 'Xona to‘lgan (maksimum 10 o‘yinchi).',
            messageEn: 'Room is full (max 10 players).',
          });
          return;
        }

        removeClientFromRoom(conn);
        const preferredId = msg.player.clientId || clientId;
        conn.clientId = preferredId;
        conn.roomCode = cleanCode;

        // Auto-balance team if player didn't force opposite or if one side is empty
        const ctCount = Array.from(room.players.values()).filter((p) => p.faction === 'CT').length;
        const tCount = Array.from(room.players.values()).filter((p) => p.faction === 'T').length;
        const assignedFaction: Faction =
          ctCount > tCount ? ('T' as Faction) : tCount > ctCount ? ('CT' as Faction) : msg.player.faction;

        const existing = room.players.get(conn.clientId);
        const joinPlayer: RoomPlayerInfo = existing ?? {
          id: conn.clientId,
          name: msg.player.name || 'Operator',
          clanTag: msg.player.clanTag || '',
          faction: assignedFaction,
          avatarId: msg.player.avatarId || 'ct_specialist',
          isHost: room.hostId === conn.clientId,
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
        room.players.set(conn.clientId, joinPlayer);

        const serialized = serializeRoom(room);
        sendMsg(ws, {
          type: 'room:joined',
          clientId: conn.clientId,
          room: serialized,
        });
        broadcastRoom(cleanCode, { type: 'room:state', room: serialized }, conn.clientId);

        if (room.status === 'playing') {
          sendMsg(ws, {
            type: 'match:started',
            room: serialized,
            seed: Date.now(),
          });
        }
        return;
      }

      if (msg.type === 'room:leave') {
        removeClientFromRoom(conn);
        return;
      }

      const room = conn.roomCode ? rooms.get(conn.roomCode) : undefined;
      if (!room) return;

      if (msg.type === 'room:switch_faction') {
        const p = room.players.get(conn.clientId);
        if (p) {
          p.faction = msg.faction;
          broadcastRoom(room.code, { type: 'room:state', room: serializeRoom(room) });
        }
        return;
      }

      if (msg.type === 'room:update_config') {
        if (room.hostId !== conn.clientId) return;
        room.mapId = msg.mapId;
        room.mode = msg.mode;
        room.fillBots = Math.max(0, Math.min(8, msg.fillBots ?? 0));
        broadcastRoom(room.code, { type: 'room:state', room: serializeRoom(room) });
        return;
      }

      if (msg.type === 'room:start') {
        if (room.hostId !== conn.clientId) return;
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
        broadcastRoom(room.code, {
          type: 'match:started',
          room: serializeRoom(room),
          seed: Date.now(),
        });
        return;
      }

      if (msg.type === 'player:state') {
        const p = room.players.get(conn.clientId);
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

        broadcastRoom(
          room.code,
          {
            type: 'players:snapshot',
            players: Array.from(room.players.values()),
          },
          conn.clientId
        );
        return;
      }

      if (msg.type === 'player:shoot') {
        const shooter = room.players.get(conn.clientId);
        if (!shooter) return;
        broadcastRoom(
          room.code,
          {
            type: 'player:shoot',
            event: {
              shooterId: conn.clientId,
              shooterName: shooter.name,
              weaponId: msg.weaponId,
              muzzlePos: msg.muzzlePos,
              hitPoint: msg.hitPoint,
            },
          },
          conn.clientId
        );
        return;
      }

      if (msg.type === 'player:hit') {
        const attacker = room.players.get(conn.clientId);
        const victim = room.players.get(msg.targetId);
        if (!attacker || !victim || !victim.alive) return;

        let dmg = Math.max(1, Math.round(msg.damage));
        if (victim.armor > 0) {
          const absorbed = Math.min(victim.armor, Math.round(dmg * 0.35));
          victim.armor = Math.max(0, victim.armor - absorbed);
          dmg = Math.max(1, Math.round(dmg * 0.72));
        }
        victim.health = Math.max(0, victim.health - dmg);

        // Notify victim client of damage
        for (const c of clients.values()) {
          if (c.roomCode === room.code && c.clientId === victim.id) {
            sendMsg(c.ws, {
              type: 'player:damaged',
              attackerId: attacker.id,
              attackerName: attacker.name,
              damage: dmg,
              health: victim.health,
              armor: victim.armor,
              headshot: msg.headshot,
            });
          }
        }

        if (victim.health <= 0) {
          victim.alive = false;
          victim.deaths += 1;
          attacker.kills += 1;
          attacker.score += msg.headshot ? 150 : 100;
          attacker.money = Math.min(16000, attacker.money + (msg.headshot ? 450 : 300));

          broadcastRoom(room.code, {
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

          broadcastRoom(room.code, {
            type: 'players:snapshot',
            players: Array.from(room.players.values()),
          });

          checkClassicRoundWin(room);
        }
        return;
      }

      if (msg.type === 'player:respawn') {
        const p = room.players.get(conn.clientId);
        if (!p) return;
        p.alive = true;
        p.health = 100;
        p.armor = 100;
        p.x = msg.x;
        p.y = msg.y;
        p.z = msg.z;
        broadcastRoom(room.code, {
          type: 'players:snapshot',
          players: Array.from(room.players.values()),
        });
        return;
      }

      if (msg.type === 'player:grenade') {
        broadcastRoom(
          room.code,
          {
            type: 'player:grenade',
            event: {
              throwerId: conn.clientId,
              grenadeId: msg.grenadeId,
              pos: msg.pos,
              vel: msg.vel,
              detonateDelayMs: msg.detonateDelayMs,
            },
          },
          conn.clientId
        );
        return;
      }

      if (msg.type === 'player:spray') {
        broadcastRoom(
          room.code,
          {
            type: 'player:spray',
            event: {
              playerId: conn.clientId,
              pos: msg.pos,
              normal: msg.normal,
              decalIndex: msg.decalIndex,
            },
          },
          conn.clientId
        );
        return;
      }

      if (msg.type === 'round:sync_finish') {
        if (room.hostId === conn.clientId) {
          triggerRoundFinish(room, msg.winner);
        }
      }
    });

    ws.on('close', () => {
      removeClientFromRoom(conn);
      clients.delete(ws);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`StrikeFront 2 server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
