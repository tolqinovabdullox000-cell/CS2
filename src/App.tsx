/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { MainMenu } from './components/MainMenu';
import { StrikeFrontEngine } from './game/engine';
import { MultiplayerClient } from './game/multiplayerClient';
import type { PlayConnectionMode, RoomState } from './types/multiplayer';
import {
  BotDifficulty,
  Faction,
  GameMode,
  GameSettings,
  GraphicsQuality,
  GrenadeId,
  HudSnapshot,
  MapId,
  MatchConfig,
  PlayerProfile,
  SkinId,
  TacticalRole,
  WeaponId,
  WeaponSlot,
} from './types/game';

const PROFILE_STORAGE_KEY = 'strikefront2_profile_v1';
const SETTINGS_STORAGE_KEY = 'strikefront2_settings_v1';

const DEFAULT_PROFILE: PlayerProfile = {
  name: 'Sardor_UZ',
  clanTag: 'UZB',
  faction: Faction.CT,
  role: TacticalRole.ENTRY,
  rankTitle: 'Global Elite',
  avatarId: 'ct_specialist',
  accentColor: '#f59e0b',
  bio: 'Aniq nishon va jamoaviy g‘alaba',
  preferredPrimary: WeaponId.AK47,
  preferredSecondary: WeaponId.USPS,
  equippedSkins: {
    [WeaponId.AK47]: SkinId.ASIIMOV,
    [WeaponId.M4A1S]: SkinId.COBALT,
    [WeaponId.AWP]: SkinId.GOLD,
    [WeaponId.DEAGLE]: SkinId.GOLD,
    [WeaponId.USPS]: SkinId.REDLINE,
    [WeaponId.KNIFE]: SkinId.REDLINE,
  },
};

const DEFAULT_SETTINGS: GameSettings = {
  sensitivity: 1.0,
  fov: 85,
  volume: 0.7,
  graphics: GraphicsQuality.HIGH,
  language: 'uz',
  showRadar: true,
  crosshair: {
    color: '#22c55e',
    size: 7,
    thickness: 2,
    gap: 4,
    dot: true,
    dynamic: true,
  },
};

const DEFAULT_MATCH_CONFIG: MatchConfig = {
  mode: GameMode.CLASSIC,
  mapId: MapId.DUST2,
  difficulty: BotDifficulty.MEDIUM,
  botCount: 5,
  playerFaction: Faction.CT,
};

const INITIAL_HUD: HudSnapshot = {
  health: 100,
  armor: 100,
  money: 800,
  activeSlot: WeaponSlot.SECONDARY,
  activeWeaponId: WeaponId.USPS,
  ammoInMag: 12,
  ammoReserve: 36,
  isReloading: false,
  isScoped: false,
  isCrouching: false,
  roundNumber: 1,
  ctScore: 0,
  tScore: 0,
  roundTimeRemaining: 90,
  roundBanner: null,
  hitMarkerType: 'none',
  damageFlash: 0,
  playerYaw: 0,
  playerX: 0,
  playerZ: 0,
  radarBlips: [],
  enemyDots: [],
  assistActive: false,
  speedMultiplier: 1,
  killfeed: [],
  scoreboard: [],
  isAlive: true,
  respawnTimer: 0,
  ownedWeapons: {
    [WeaponSlot.PRIMARY]: null,
    [WeaponSlot.SECONDARY]: WeaponId.USPS,
    [WeaponSlot.MELEE]: WeaponId.KNIFE,
  },
  ownedGrenades: {
    [GrenadeId.HE]: 0,
    [GrenadeId.FLASH]: 0,
    [GrenadeId.SMOKE]: 0,
  },
  activeGrenade: null,
  flashBlindAlpha: 0,
  pointerLocked: false,
  crosshairSpread: 0,
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<StrikeFrontEngine | null>(null);
  const mpClientRef = useRef<MultiplayerClient | null>(null);
  if (!mpClientRef.current) {
    mpClientRef.current = new MultiplayerClient();
  }

  const [profile, setProfile] = useState<PlayerProfile>(() =>
    loadJson(PROFILE_STORAGE_KEY, DEFAULT_PROFILE)
  );
  const [settings, setSettings] = useState<GameSettings>(() =>
    loadJson(SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS)
  );
  const [matchConfig, setMatchConfig] = useState<MatchConfig>(() => ({
    ...DEFAULT_MATCH_CONFIG,
    playerFaction: loadJson(PROFILE_STORAGE_KEY, DEFAULT_PROFILE).faction,
  }));

  const [screen, setScreen] = useState<'menu' | 'playing'>('menu');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [buyMenuOpen, setBuyMenuOpen] = useState(false);
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);

  const [playMode, setPlayMode] = useState<PlayConnectionMode>('bot');
  const [localRoom, setLocalRoom] = useState<RoomState | null>(null);
  const [localModalOpen, setLocalModalOpen] = useState(false);
  const [localConnecting, setLocalConnecting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleUpdateProfile = useCallback((next: PlayerProfile) => {
    setProfile(next);
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }, []);

  const handleUpdateSettings = useCallback((next: GameSettings) => {
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }, []);

  // Initialize Three.js engine once in dedicated container
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new StrikeFrontEngine(container, profile, settings, matchConfig, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onPauseToggle: () => {
        setPauseMenuOpen((prev) => {
          const next = !prev;
          if (next) {
            setBuyMenuOpen(false);
            engineRef.current?.exitPointerLock();
          } else {
            engineRef.current?.requestPointerLock();
          }
          return next;
        });
      },
      onBuyToggle: () => {
        setBuyMenuOpen((prev) => {
          const next = !prev;
          if (next) {
            setPauseMenuOpen(false);
            engineRef.current?.exitPointerLock();
          } else {
            engineRef.current?.requestPointerLock();
          }
          return next;
        });
      },
      onScoreboardToggle: (open) => setScoreboardOpen(open),
    });

    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // Mount once so UI updates never tear down the WebGL context
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync profile, settings, and matchConfig into engine cleanly
  useEffect(() => {
    engineRef.current?.updateProfileAndSettings(profile, settings, matchConfig);
  }, [profile, settings, matchConfig]);

  // Bind MultiplayerClient callbacks cleanly
  useEffect(() => {
    const client = mpClientRef.current!;
    client.setCallbacks({
      onRoomJoined: (_cid, room) => {
        setLocalConnecting(false);
        setLocalError(null);
        setLocalRoom(room);
        setPlayMode('local');
        setMatchConfig((prev) => ({
          ...prev,
          mapId: room.mapId,
          mode: room.mode,
        }));
      },
      onRoomState: (room) => {
        setLocalRoom(room);
        engineRef.current?.syncRemotePlayersFromRoom(room.players);
      },
      onRoomError: (messageUz, messageEn) => {
        setLocalConnecting(false);
        setLocalError(settings.language === 'uz' ? messageUz : messageEn);
      },
      onMatchStarted: (room) => {
        setLocalRoom(room);
        setLocalModalOpen(false);
        setBuyMenuOpen(false);
        setPauseMenuOpen(false);
        setScoreboardOpen(false);
        setScreen('playing');
        const nextCfg: MatchConfig = {
          ...matchConfig,
          mapId: room.mapId,
          mode: room.mode,
          botCount: room.fillBots,
        };
        setMatchConfig(nextCfg);
        engineRef.current?.startMultiplayerMatch(nextCfg, client, room);
      },
      onRoundReset: (room, winner) => {
        setLocalRoom(room);
        engineRef.current?.handleServerRoundReset(room, winner);
      },
      onPlayersSnapshot: (players) => {
        engineRef.current?.syncRemotePlayersFromRoom(players);
      },
      onRemoteShoot: (event) => {
        engineRef.current?.handleRemoteShoot(event);
      },
      onLocalDamaged: (payload) => {
        engineRef.current?.handleLocalDamaged(payload);
      },
      onRemoteKilled: (event) => {
        engineRef.current?.handleRemoteKilled(event);
      },
      onRemoteGrenade: (event) => {
        engineRef.current?.handleRemoteGrenade(event);
      },
      onRemoteSpray: (event) => {
        engineRef.current?.handleRemoteSpray(event);
      },
      onDisconnect: () => {
        setLocalConnecting(false);
      },
    });
  }, [matchConfig, settings.language]);

  useEffect(() => {
    return () => {
      mpClientRef.current?.dispose();
    };
  }, []);

  const handleCreateLocalRoom = useCallback(async () => {
    const client = mpClientRef.current;
    if (!client) return;
    setLocalConnecting(true);
    setLocalError(null);
    try {
      await client.createRoom(profile, matchConfig.mapId, matchConfig.mode, 0);
    } catch {
      setLocalConnecting(false);
      setLocalError(
        settings.language === 'uz'
          ? 'Serverga ulanib bo‘lmadi. Qayta urinib ko‘ring.'
          : 'Unable to connect to local room server.'
      );
    }
  }, [matchConfig.mapId, matchConfig.mode, profile, settings.language]);

  const handleJoinLocalRoom = useCallback(
    async (code: string) => {
      const client = mpClientRef.current;
      if (!client) return;
      setLocalConnecting(true);
      setLocalError(null);
      try {
        await client.joinRoom(code, profile);
      } catch {
        setLocalConnecting(false);
        setLocalError(
          settings.language === 'uz'
            ? 'Serverga ulanib bo‘lmadi. Qayta urinib ko‘ring.'
            : 'Unable to connect to local room server.'
        );
      }
    },
    [profile, settings.language]
  );

  const handleSelectPlayMode = useCallback(
    (mode: PlayConnectionMode) => {
      setPlayMode(mode);
      if (mode === 'local') {
        setLocalModalOpen(true);
        if (!localRoom) {
          void handleCreateLocalRoom();
        }
      } else {
        setLocalModalOpen(false);
      }
    },
    [handleCreateLocalRoom, localRoom]
  );

  const handleUpdateMatchConfig = useCallback(
    (next: MatchConfig) => {
      setMatchConfig(next);
      const client = mpClientRef.current;
      if (localRoom && client && localRoom.hostId === client.clientId) {
        client.updateRoomConfig(next.mapId, next.mode, localRoom.fillBots);
      }
    },
    [localRoom]
  );

  const handleStartMatch = useCallback(() => {
    if (playMode === 'local' && localRoom) {
      const client = mpClientRef.current;
      if (client && localRoom.hostId === client.clientId) {
        client.startRoomMatch();
      } else {
        setLocalModalOpen(true);
      }
      return;
    }

    setBuyMenuOpen(false);
    setPauseMenuOpen(false);
    setScoreboardOpen(false);
    setScreen('playing');
    engineRef.current?.startMatch(matchConfig);
  }, [localRoom, matchConfig, playMode]);

  const handleExitToMenu = useCallback(() => {
    setBuyMenuOpen(false);
    setPauseMenuOpen(false);
    setScoreboardOpen(false);
    if (localRoom) {
      mpClientRef.current?.leaveRoom();
      setLocalRoom(null);
      setPlayMode('bot');
    }
    setScreen('menu');
    engineRef.current?.setupMenuShowcase();
  }, [localRoom]);

  const handleResumeClick = useCallback(() => {
    setBuyMenuOpen(false);
    setPauseMenuOpen(false);
    engineRef.current?.requestPointerLock();
  }, []);

  const handleToggleBuyMenu = useCallback(() => {
    setBuyMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setPauseMenuOpen(false);
        engineRef.current?.exitPointerLock();
      } else {
        engineRef.current?.requestPointerLock();
      }
      return next;
    });
  }, []);

  const handleSwitchMap = useCallback(
    (nextMapId: MapId) => {
      const nextConfig = { ...matchConfig, mapId: nextMapId };
      setMatchConfig(nextConfig);
      setPauseMenuOpen(false);
      setBuyMenuOpen(false);
      if (playMode === 'local' && localRoom && mpClientRef.current) {
        if (localRoom.hostId === mpClientRef.current.clientId) {
          mpClientRef.current.updateRoomConfig(nextMapId, nextConfig.mode, localRoom.fillBots);
          mpClientRef.current.startRoomMatch();
        }
        return;
      }
      engineRef.current?.startMatch(nextConfig);
    },
    [localRoom, matchConfig, playMode]
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0b0f17]">
      {/* Dedicated WebGL Mount Container */}
      <div ref={canvasMountRef} className="fixed inset-0 w-full h-full" />

      {screen === 'menu' ? (
        <MainMenu
          profile={profile}
          settings={settings}
          matchConfig={matchConfig}
          playMode={playMode}
          localRoom={localRoom}
          localClientId={mpClientRef.current?.clientId ?? ''}
          localModalOpen={localModalOpen}
          localConnecting={localConnecting}
          localError={localError}
          onSelectPlayMode={handleSelectPlayMode}
          onOpenLocalModal={() => setLocalModalOpen(true)}
          onCloseLocalModal={() => setLocalModalOpen(false)}
          onCreateLocalRoom={() => void handleCreateLocalRoom()}
          onJoinLocalRoom={(code) => void handleJoinLocalRoom(code)}
          onSwitchLocalFaction={(faction) => mpClientRef.current?.switchFaction(faction)}
          onUpdateLocalExtraBots={(count) => {
            if (localRoom) {
              mpClientRef.current?.updateRoomConfig(localRoom.mapId, localRoom.mode, count);
            }
          }}
          onLeaveLocalRoom={() => {
            mpClientRef.current?.leaveRoom();
            setLocalRoom(null);
            setPlayMode('bot');
            setLocalModalOpen(false);
          }}
          onUpdateProfile={handleUpdateProfile}
          onUpdateSettings={handleUpdateSettings}
          onUpdateMatchConfig={handleUpdateMatchConfig}
          onStartMatch={handleStartMatch}
        />
      ) : (
        <GameHUD
          hud={hud}
          profile={profile}
          settings={settings}
          mapId={matchConfig.mapId}
          localRoomCode={playMode === 'local' && localRoom ? localRoom.code : null}
          buyMenuOpen={buyMenuOpen}
          pauseMenuOpen={pauseMenuOpen}
          scoreboardOpen={scoreboardOpen}
          onResumeClick={handleResumeClick}
          onToggleBuyMenu={handleToggleBuyMenu}
          onBuyWeapon={(wid) => engineRef.current?.buyWeapon(wid)}
          onBuyGrenade={(gid) => engineRef.current?.buyGrenade(gid)}
          onBuyArmor={() => engineRef.current?.buyArmor()}
          onSwitchMap={handleSwitchMap}
          onExitToMenu={handleExitToMenu}
        />
      )}
    </div>
  );
}
