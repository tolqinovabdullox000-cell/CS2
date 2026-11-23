import React, { useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  Crosshair,
  Gamepad2,
  KeyRound,
  LogIn,
  Play,
  RefreshCw,
  Settings,
  Shield,
  Sliders,
  Swords,
  UserCheck,
  Users,
  Volume2,
  Wifi,
  X,
} from 'lucide-react';
import { getCopy } from '../data/i18n';
import { MAP_LIST } from '../data/maps';
import { SKIN_LIST, WEAPONS, WEAPON_LIST } from '../data/weapons';
import { soundEngine } from '../game/audio';
import type { PlayConnectionMode, RoomState } from '../types/multiplayer';
import {
  BotDifficulty,
  Faction,
  GameMode,
  GameSettings,
  GraphicsQuality,
  Language,
  MatchConfig,
  PlayerProfile,
  SkinId,
  TacticalRole,
  WeaponId,
  WeaponSlot,
} from '../types/game';

export type MenuTab = 'play' | 'loadout' | 'profile' | 'settings';

const AVATAR_OPTIONS: {
  id: PlayerProfile['avatarId'];
  labelUz: string;
  labelEn: string;
  src?: string;
}[] = [
  {
    id: 'ct_specialist',
    labelUz: 'CT Mutaxassis',
    labelEn: 'CT Specialist',
    src: '/src/assets/images/operator_ct_avatar_1795411891239.jpg',
  },
  {
    id: 't_operative',
    labelUz: 'T Agent',
    labelEn: 'T Operative',
    src: '/src/assets/images/operator_t_avatar_1795411891965.jpg',
  },
  {
    id: 'emblem_gold',
    labelUz: 'Oltin Qalqon',
    labelEn: 'Gold Shield',
  },
  {
    id: 'emblem_cobalt',
    labelUz: 'Kiber Nishon',
    labelEn: 'Cyber Crest',
  },
];

const RANK_PRESETS = ['Global Elite', 'Premier 25,000', 'Faceit Lvl 10', 'Supreme Master', 'Taktik Ustasi'];

const CROSSHAIR_COLORS = ['#22c55e', '#38bdf8', '#f59e0b', '#ef4444', '#ffffff', '#e879f9'];

interface MainMenuProps {
  profile: PlayerProfile;
  settings: GameSettings;
  matchConfig: MatchConfig;
  playMode: PlayConnectionMode;
  localRoom: RoomState | null;
  localClientId: string;
  localModalOpen: boolean;
  localConnecting: boolean;
  localError: string | null;
  onSelectPlayMode: (mode: PlayConnectionMode) => void;
  onOpenLocalModal: () => void;
  onCloseLocalModal: () => void;
  onCreateLocalRoom: () => void;
  onJoinLocalRoom: (code: string) => void;
  onSwitchLocalFaction: (faction: Faction) => void;
  onUpdateLocalExtraBots: (count: number) => void;
  onLeaveLocalRoom: () => void;
  onUpdateProfile: (next: PlayerProfile) => void;
  onUpdateSettings: (next: GameSettings) => void;
  onUpdateMatchConfig: (next: MatchConfig) => void;
  onStartMatch: () => void;
}

export function renderAvatarThumbnail(profile: PlayerProfile, sizeClass = 'w-12 h-12') {
  const opt = AVATAR_OPTIONS.find((a) => a.id === profile.avatarId);
  if (opt?.src) {
    return (
      <img
        src={opt.src}
        alt={profile.name}
        referrerPolicy="no-referrer"
        className={`${sizeClass} rounded-lg object-cover border border-white/15 shrink-0`}
      />
    );
  }
  const isGold = profile.avatarId === 'emblem_gold';
  return (
    <div
      className={`${sizeClass} rounded-lg flex items-center justify-center border border-white/15 shrink-0 ${
        isGold
          ? 'bg-gradient-to-br from-amber-500/30 to-amber-900/60 text-amber-300'
          : 'bg-gradient-to-br from-blue-500/30 to-slate-900 text-sky-300'
      }`}
    >
      {isGold ? <Shield className="w-6 h-6" /> : <Crosshair className="w-6 h-6" />}
    </div>
  );
}

export const MainMenu: React.FC<MainMenuProps> = ({
  profile,
  settings,
  matchConfig,
  playMode,
  localRoom,
  localClientId,
  localModalOpen,
  localConnecting,
  localError,
  onSelectPlayMode,
  onOpenLocalModal,
  onCloseLocalModal,
  onCreateLocalRoom,
  onJoinLocalRoom,
  onSwitchLocalFaction,
  onUpdateLocalExtraBots,
  onLeaveLocalRoom,
  onUpdateProfile,
  onUpdateSettings,
  onUpdateMatchConfig,
  onStartMatch,
}) => {
  const [activeTab, setActiveTab] = useState<MenuTab>('play');
  const [inspectWeaponId, setInspectWeaponId] = useState<WeaponId>(profile.preferredPrimary);
  const [savedNotice, setSavedNotice] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedNotice, setCopiedNotice] = useState(false);

  const t = getCopy(settings.language);
  const isHost = !localRoom || localRoom.hostId === localClientId;
  const selfInRoom = localRoom?.players.find((p) => p.id === localClientId);

  const handleTabChange = (tab: MenuTab) => {
    soundEngine.playUiClick();
    setActiveTab(tab);
  };

  const triggerSavedFlash = () => {
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1400);
  };

  const selectedWeapon = WEAPONS[inspectWeaponId];
  const selectedSkinId = profile.equippedSkins[inspectWeaponId] ?? SkinId.STANDARD;

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-between pointer-events-none select-none">
      {/* Subtle dark vignette for legibility without covering the 3D center */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0f17]/90 via-[#0b0f17]/35 to-[#0b0f17]/70 pointer-events-none" />

      {/* Top Navigation Bar — 3-Zone Contract */}
      <header className="relative z-20 flex items-center justify-between gap-8 px-8 py-4 bg-[#0b0f17]/92 border-b border-white/10 pointer-events-auto">
        {/* Zone 1: Wordmark */}
        <div className="font-display text-xl font-bold tracking-wider text-white whitespace-nowrap shrink-0">
          {t.brand}
        </div>

        {/* Zone 2: 4 Concise Nav Links */}
        <nav className="flex items-center gap-7">
          {(
            [
              { id: 'play', label: t.navPlay },
              { id: 'loadout', label: t.navLoadout },
              { id: 'profile', label: t.navProfile },
              { id: 'settings', label: t.navSettings },
            ] as { id: MenuTab; label: string }[]
          ).map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`relative py-1.5 text-sm font-semibold tracking-wide transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active ? 'text-amber-400' : 'text-slate-300 hover:text-white'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute left-0 right-0 -bottom-[17px] h-0.5 bg-amber-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary CTA */}
        <button
          onClick={() => {
            soundEngine.playUiClick();
            onStartMatch();
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm tracking-wide transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          {t.launchMatch}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="relative z-20 flex-1 flex items-stretch justify-between px-8 py-6 gap-8 overflow-hidden">
        {/* Left Interactive Drawer */}
        <section className="w-full max-w-[580px] h-full overflow-y-auto pr-2 pointer-events-auto flex flex-col gap-5">
          {activeTab === 'play' && (
            <>
              {/* Game Mode */}
              <div className="bg-[#111723]/92 border border-white/10 rounded-xl p-5">
                <h2 className="font-display text-sm font-semibold text-slate-300 tracking-wide mb-3 flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-amber-400" />
                  {t.selectMode}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {([GameMode.CLASSIC, GameMode.DEATHMATCH, GameMode.AIM_ARENA] as GameMode[]).map(
                    (modeId) => {
                      const active = matchConfig.mode === modeId;
                      return (
                        <button
                          key={modeId}
                          onClick={() => {
                            soundEngine.playUiClick();
                            onUpdateMatchConfig({ ...matchConfig, mode: modeId });
                          }}
                          className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                            active
                              ? 'bg-amber-500/15 border-amber-400/70 text-white'
                              : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="font-display font-bold text-sm">{t.modes[modeId].title}</div>
                          <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                            {t.modes[modeId].desc}
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Map Selector */}
              <div className="bg-[#111723]/92 border border-white/10 rounded-xl p-5">
                <h2 className="font-display text-sm font-semibold text-slate-300 tracking-wide mb-3">
                  {t.selectMap}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MAP_LIST.map((map) => {
                    const active = matchConfig.mapId === map.id;
                    return (
                      <button
                        key={map.id}
                        onClick={() => {
                          soundEngine.playUiClick();
                          onUpdateMatchConfig({ ...matchConfig, mapId: map.id });
                        }}
                        className={`group text-left rounded-lg overflow-hidden border transition-colors cursor-pointer ${
                          active
                            ? 'border-amber-400 bg-amber-500/10'
                            : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                        }`}
                      >
                        <div className="aspect-video w-full overflow-hidden bg-slate-900">
                          <img
                            src={map.previewImage}
                            alt={settings.language === 'uz' ? map.nameUz : map.nameEn}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div className="p-2.5">
                          <div className="font-display font-bold text-sm text-white truncate">
                            {settings.language === 'uz' ? map.nameUz : map.nameEn}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {settings.language === 'uz' ? map.subtitleUz : map.subtitleEn}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Match Setup: Team Side, Difficulty, Bot Count */}
              <div className="bg-[#111723]/92 border border-white/10 rounded-xl p-5 space-y-4">
                <h2 className="font-display text-sm font-semibold text-slate-300 tracking-wide">
                  {t.matchSetup}
                </h2>

                <div>
                  <div className="text-xs text-slate-400 mb-2">{t.sideLabel}</div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => {
                        soundEngine.playUiClick();
                        onUpdateMatchConfig({ ...matchConfig, playerFaction: Faction.CT });
                        onUpdateProfile({ ...profile, faction: Faction.CT });
                      }}
                      className={`py-2.5 px-3 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                        matchConfig.playerFaction === Faction.CT
                          ? 'bg-blue-500/20 border-blue-400 text-blue-200'
                          : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      {t.ctName}
                    </button>
                    <button
                      onClick={() => {
                        soundEngine.playUiClick();
                        onUpdateMatchConfig({ ...matchConfig, playerFaction: Faction.T });
                        onUpdateProfile({ ...profile, faction: Faction.T });
                      }}
                      className={`py-2.5 px-3 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                        matchConfig.playerFaction === Faction.T
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      {t.tName}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-2">{t.difficultyLabel}</div>
                    <div className="grid grid-cols-3 gap-1.5 bg-black/30 p-1 rounded-lg border border-white/10">
                      {([BotDifficulty.EASY, BotDifficulty.MEDIUM, BotDifficulty.HARD] as BotDifficulty[]).map(
                        (diff) => (
                          <button
                            key={diff}
                            onClick={() => {
                              soundEngine.playUiClick();
                              onUpdateMatchConfig({ ...matchConfig, difficulty: diff });
                            }}
                            className={`py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                              matchConfig.difficulty === diff
                                ? 'bg-amber-500 text-slate-950 font-semibold'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            {t.difficulties[diff]}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span>{t.botCountLabel}</span>
                      <span className="font-mono-tabular text-amber-400 font-bold">
                        {matchConfig.botCount}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={9}
                      value={matchConfig.botCount}
                      onChange={(e) =>
                        onUpdateMatchConfig({ ...matchConfig, botCount: Number(e.target.value) })
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'loadout' && (
            <div className="bg-[#111723]/92 border border-white/10 rounded-xl p-5 space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                  <Swords className="w-5 h-5 text-amber-400" />
                  {t.loadoutTitle}
                </h2>
                <p className="text-xs text-slate-400 mt-1">{t.loadoutSubtitle}</p>
              </div>

              {/* Weapon Picker Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {WEAPON_LIST.map((w) => {
                  const active = inspectWeaponId === w.id;
                  const equipped =
                    profile.preferredPrimary === w.id || profile.preferredSecondary === w.id;
                  return (
                    <button
                      key={w.id}
                      onClick={() => {
                        soundEngine.playUiClick();
                        setInspectWeaponId(w.id);
                        if (w.slot === WeaponSlot.PRIMARY) {
                          onUpdateProfile({ ...profile, preferredPrimary: w.id });
                        } else if (w.slot === WeaponSlot.SECONDARY) {
                          onUpdateProfile({ ...profile, preferredSecondary: w.id });
                        }
                      }}
                      className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-amber-500/15 border-amber-400 text-white'
                          : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-display font-bold text-sm truncate">{w.name}</span>
                        {equipped && (
                          <span className="text-[10px] font-semibold text-amber-400">★</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {settings.language === 'uz' ? w.categoryLabelUz : w.categoryLabelEn}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Weapon Stats */}
              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/10">
                <div className="bg-black/25 rounded-lg p-2.5">
                  <div className="text-[11px] text-slate-400">{t.weaponStats.damage}</div>
                  <div className="font-mono-tabular text-base font-bold text-white mt-0.5">
                    {selectedWeapon.damage}
                  </div>
                </div>
                <div className="bg-black/25 rounded-lg p-2.5">
                  <div className="text-[11px] text-slate-400">{t.weaponStats.fireRate}</div>
                  <div className="font-mono-tabular text-base font-bold text-white mt-0.5">
                    {Math.round(60000 / selectedWeapon.fireRateMs)} RPM
                  </div>
                </div>
                <div className="bg-black/25 rounded-lg p-2.5">
                  <div className="text-[11px] text-slate-400">{t.weaponStats.mag}</div>
                  <div className="font-mono-tabular text-base font-bold text-white mt-0.5">
                    {selectedWeapon.magSize} / {selectedWeapon.reserveMax}
                  </div>
                </div>
                <div className="bg-black/25 rounded-lg p-2.5">
                  <div className="text-[11px] text-slate-400">{t.weaponStats.price}</div>
                  <div className="font-mono-tabular text-base font-bold text-amber-400 mt-0.5">
                    ${selectedWeapon.price}
                  </div>
                </div>
              </div>

              {/* Skin Finish Picker */}
              <div className="pt-2 border-t border-white/10">
                <div className="text-xs font-medium text-slate-300 mb-2.5">{t.skinSelect}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SKIN_LIST.map((skin) => {
                    const active = selectedSkinId === skin.id;
                    return (
                      <button
                        key={skin.id}
                        onClick={() => {
                          soundEngine.playUiClick();
                          onUpdateProfile({
                            ...profile,
                            equippedSkins: {
                              ...profile.equippedSkins,
                              [inspectWeaponId]: skin.id,
                            },
                          });
                        }}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          active
                            ? 'bg-white/10 border-amber-400 text-white'
                            : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.05]'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded border border-white/20 shrink-0"
                          style={{
                            background: `linear-gradient(135deg, #${skin.primaryHex
                              .toString(16)
                              .padStart(6, '0')} 50%, #${skin.accentHex
                              .toString(16)
                              .padStart(6, '0')} 50%)`,
                          }}
                        />
                        <span className="text-xs font-semibold truncate">
                          {settings.language === 'uz' ? skin.nameUz : skin.nameEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="bg-[#111723]/92 border border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-amber-400" />
                    {t.profileTitle}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">{t.profileSubtitle}</p>
                </div>
                {savedNotice && (
                  <span className="text-xs font-semibold text-emerald-400">{t.saveProfile}</span>
                )}
              </div>

              {/* Callsign & Clan Tag */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1.5">
                    {t.playerNameLabel}
                  </label>
                  <input
                    type="text"
                    maxLength={18}
                    value={profile.name}
                    onChange={(e) => {
                      onUpdateProfile({ ...profile, name: e.target.value });
                      triggerSavedFlash();
                    }}
                    className="w-full px-3.5 py-2 rounded-lg bg-black/40 border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">{t.clanTagLabel}</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={profile.clanTag}
                    onChange={(e) => {
                      onUpdateProfile({ ...profile, clanTag: e.target.value.toUpperCase() });
                      triggerSavedFlash();
                    }}
                    placeholder="UZB"
                    className="w-full px-3.5 py-2 rounded-lg bg-black/40 border border-white/15 text-sm font-mono-tabular text-amber-300 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Faction Identity */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">{t.factionLabel}</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => {
                      soundEngine.playUiClick();
                      onUpdateProfile({ ...profile, faction: Faction.CT });
                      onUpdateMatchConfig({ ...matchConfig, playerFaction: Faction.CT });
                      triggerSavedFlash();
                    }}
                    className={`py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      profile.faction === Faction.CT
                        ? 'bg-blue-500/20 border-blue-400 text-blue-200'
                        : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    {t.ctName}
                  </button>
                  <button
                    onClick={() => {
                      soundEngine.playUiClick();
                      onUpdateProfile({ ...profile, faction: Faction.T });
                      onUpdateMatchConfig({ ...matchConfig, playerFaction: Faction.T });
                      triggerSavedFlash();
                    }}
                    className={`py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      profile.faction === Faction.T
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    {t.tName}
                  </button>
                </div>
              </div>

              {/* Tactical Role */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">{t.roleLabel}</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.values(TacticalRole) as TacticalRole[]).map((role) => {
                    const active = profile.role === role;
                    return (
                      <button
                        key={role}
                        onClick={() => {
                          soundEngine.playUiClick();
                          onUpdateProfile({ ...profile, role });
                          triggerSavedFlash();
                        }}
                        className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer text-left truncate ${
                          active
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.05]'
                        }`}
                      >
                        {t.roles[role]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Avatar Selection */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">{t.avatarLabel}</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {AVATAR_OPTIONS.map((av) => {
                    const active = profile.avatarId === av.id;
                    return (
                      <button
                        key={av.id}
                        onClick={() => {
                          soundEngine.playUiClick();
                          onUpdateProfile({ ...profile, avatarId: av.id });
                          triggerSavedFlash();
                        }}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors cursor-pointer ${
                          active
                            ? 'border-amber-400 bg-amber-500/10'
                            : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                        }`}
                      >
                        {av.src ? (
                          <img
                            src={av.src}
                            alt={av.labelEn}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-md object-cover"
                          />
                        ) : (
                          <div
                            className={`w-12 h-12 rounded-md flex items-center justify-center ${
                              av.id === 'emblem_gold'
                                ? 'bg-amber-500/25 text-amber-300'
                                : 'bg-blue-500/25 text-sky-300'
                            }`}
                          >
                            {av.id === 'emblem_gold' ? (
                              <Shield className="w-6 h-6" />
                            ) : (
                              <Crosshair className="w-6 h-6" />
                            )}
                          </div>
                        )}
                        <span className="text-[11px] text-slate-200 truncate w-full text-center">
                          {settings.language === 'uz' ? av.labelUz : av.labelEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rank Title & Bio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">{t.rankLabel}</label>
                  <select
                    value={profile.rankTitle}
                    onChange={(e) => {
                      onUpdateProfile({ ...profile, rankTitle: e.target.value });
                      triggerSavedFlash();
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
                  >
                    {RANK_PRESETS.map((r) => (
                      <option key={r} value={r} className="bg-slate-900">
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">{t.bioLabel}</label>
                  <input
                    type="text"
                    maxLength={36}
                    value={profile.bio}
                    onChange={(e) => {
                      onUpdateProfile({ ...profile, bio: e.target.value });
                      triggerSavedFlash();
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-[#111723]/92 border border-white/10 rounded-xl p-5 space-y-5">
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                {t.settingsTitle}
              </h2>

              {/* Language & Graphics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-400 mb-1.5">{t.language}</div>
                  <div className="grid grid-cols-2 gap-1.5 bg-black/30 p-1 rounded-lg border border-white/10">
                    {(['uz', 'en'] as Language[]).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => {
                          soundEngine.playUiClick();
                          onUpdateSettings({ ...settings, language: lang });
                        }}
                        className={`py-1.5 rounded text-xs font-semibold cursor-pointer ${
                          settings.language === lang
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {lang === 'uz' ? 'O‘zbekcha' : 'English'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-1.5">{t.graphics}</div>
                  <select
                    value={settings.graphics}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        graphics: e.target.value as GraphicsQuality,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {Object.values(GraphicsQuality).map((q) => (
                      <option key={q} value={q} className="bg-slate-900">
                        {t.graphicsOptions[q]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sliders: Sensitivity, FOV, Volume */}
              <div className="space-y-3.5 pt-2 border-t border-white/10">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-slate-400" /> {t.sensitivity}
                    </span>
                    <span className="font-mono-tabular text-amber-400 font-bold">
                      {settings.sensitivity.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={3.0}
                    step={0.05}
                    value={settings.sensitivity}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, sensitivity: Number(e.target.value) })
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{t.fov}</span>
                    <span className="font-mono-tabular text-amber-400 font-bold">
                      {settings.fov}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={70}
                    max={105}
                    step={1}
                    value={settings.fov}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, fov: Number(e.target.value) })
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-slate-400" /> {t.volume}
                    </span>
                    <span className="font-mono-tabular text-amber-400 font-bold">
                      {Math.round(settings.volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.volume}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, volume: Number(e.target.value) })
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Crosshair Customization */}
              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-white">
                    {t.crosshairTitle}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {CROSSHAIR_COLORS.map((hex) => (
                      <button
                        key={hex}
                        onClick={() =>
                          onUpdateSettings({
                            ...settings,
                            crosshair: { ...settings.crosshair, color: hex },
                          })
                        }
                        aria-label={`Color ${hex}`}
                        className={`w-5 h-5 rounded-full border cursor-pointer ${
                          settings.crosshair.color === hex
                            ? 'border-white scale-110'
                            : 'border-white/25'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 items-center">
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>{t.crosshairSize}</span>
                        <span className="font-mono-tabular">{settings.crosshair.size}px</span>
                      </div>
                      <input
                        type="range"
                        min={3}
                        max={16}
                        value={settings.crosshair.size}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...settings,
                            crosshair: { ...settings.crosshair, size: Number(e.target.value) },
                          })
                        }
                        className="w-full accent-amber-400 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>{t.crosshairGap}</span>
                        <span className="font-mono-tabular">{settings.crosshair.gap}px</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={12}
                        value={settings.crosshair.gap}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...settings,
                            crosshair: { ...settings.crosshair, gap: Number(e.target.value) },
                          })
                        }
                        className="w-full accent-amber-400 cursor-pointer"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.crosshair.dot}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...settings,
                            crosshair: { ...settings.crosshair, dot: e.target.checked },
                          })
                        }
                        className="accent-amber-400"
                      />
                      {t.crosshairDot}
                    </label>
                  </div>

                  {/* Live Crosshair Preview Box */}
                  <div className="h-24 rounded-lg bg-[#1d2636] border border-white/10 relative flex items-center justify-center">
                    <div
                      style={{
                        position: 'absolute',
                        width: settings.crosshair.size,
                        height: settings.crosshair.thickness,
                        backgroundColor: settings.crosshair.color,
                        transform: `translateX(${-(settings.crosshair.gap + settings.crosshair.size / 2)}px)`,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        width: settings.crosshair.size,
                        height: settings.crosshair.thickness,
                        backgroundColor: settings.crosshair.color,
                        transform: `translateX(${settings.crosshair.gap + settings.crosshair.size / 2}px)`,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        width: settings.crosshair.thickness,
                        height: settings.crosshair.size,
                        backgroundColor: settings.crosshair.color,
                        transform: `translateY(${-(settings.crosshair.gap + settings.crosshair.size / 2)}px)`,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        width: settings.crosshair.thickness,
                        height: settings.crosshair.size,
                        backgroundColor: settings.crosshair.color,
                        transform: `translateY(${settings.crosshair.gap + settings.crosshair.size / 2}px)`,
                      }}
                    />
                    {settings.crosshair.dot && (
                      <div
                        style={{
                          width: settings.crosshair.thickness + 1,
                          height: settings.crosshair.thickness + 1,
                          backgroundColor: settings.crosshair.color,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right Side: Bot vs Local Selector + Live Identity Card */}
        <aside className="flex flex-col justify-between items-end pointer-events-auto gap-4">
          {activeTab === 'play' ? (
            <div className="w-80 bg-[#111723]/94 border border-white/15 rounded-xl p-4 space-y-3 shadow-2xl">
              <div>
                <div className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-amber-400" />
                  {t.localPlay.askTitle}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {t.localPlay.askSubtitle}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    soundEngine.playUiClick();
                    onSelectPlayMode('bot');
                  }}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    playMode === 'bot'
                      ? 'bg-amber-500/18 border-amber-400 text-white'
                      : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-display font-bold text-xs">
                    <Bot className="w-4 h-4 text-amber-400 shrink-0" />
                    {t.localPlay.botModeTitle}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-snug">
                    {t.localPlay.botModeDesc}
                  </div>
                </button>

                <button
                  onClick={() => {
                    soundEngine.playUiClick();
                    onSelectPlayMode('local');
                  }}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    playMode === 'local'
                      ? 'bg-sky-500/20 border-sky-400 text-white'
                      : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-display font-bold text-xs">
                    <Users className="w-4 h-4 text-sky-400 shrink-0" />
                    {t.localPlay.localModeTitle}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-snug">
                    {t.localPlay.localModeDesc}
                  </div>
                </button>
              </div>

              {localRoom && (
                <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-400/35 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] text-sky-300 font-semibold">
                      {t.localPlay.localActiveBadge}
                    </div>
                    <div className="font-mono-tabular font-bold text-sm tracking-widest text-white">
                      {localRoom.code} · {localRoom.players.length}P
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      soundEngine.playUiClick();
                      onOpenLocalModal();
                    }}
                    className="px-2.5 py-1.5 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-[11px] cursor-pointer"
                  >
                    {t.localPlay.openLobbyBtn}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div />
          )}

          <div className="hidden lg:block w-80 bg-[#111723]/92 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3.5">
              {renderAvatarThumbnail(profile, 'w-14 h-14')}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {profile.clanTag && (
                    <span className="font-mono-tabular text-xs font-bold text-amber-400">
                      [{profile.clanTag}]
                    </span>
                  )}
                  <span className="font-display font-bold text-base text-white truncate">
                    {profile.name || 'Operator'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 truncate mt-0.5">
                  {profile.rankTitle} · {t.roles[profile.role]}
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {profile.faction === Faction.CT ? t.ctName : t.tName}
                </div>
              </div>
            </div>

            {profile.bio && (
              <div className="mt-3 pt-2.5 border-t border-white/10 text-xs text-slate-300 truncate">
                “{profile.bio}”
              </div>
            )}

            <button
              onClick={() => handleTabChange('profile')}
              className="mt-3 w-full py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
            >
              {t.navProfile}
            </button>
          </div>
        </aside>
      </main>

      {/* Local Multiplayer Room & 5-Char Password Modal */}
      {localModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-3xl bg-[#0e1420] border border-white/15 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-sky-400" />
                <h2 className="font-display text-lg font-bold text-white">{t.localPlay.modalTitle}</h2>
              </div>
              <button
                onClick={onCloseLocalModal}
                aria-label={t.localPlay.closeModal}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Panel 1: Generated 5-Char Room Code */}
              <div className="bg-black/30 border border-sky-400/30 rounded-xl p-4 flex flex-col justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-sky-300">
                    {t.localPlay.yourCodeLabel}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{t.localPlay.yourCodeHint}</p>

                  <div className="mt-3 flex items-center justify-between gap-2 bg-[#111928] border border-sky-400/50 rounded-xl px-4 py-3">
                    <span className="font-mono-tabular text-3xl font-black tracking-[0.28em] text-amber-300">
                      {localRoom ? localRoom.code : localConnecting ? '.....' : '-----'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={!localRoom}
                        onClick={() => {
                          if (!localRoom) return;
                          navigator.clipboard?.writeText(localRoom.code).catch(() => {});
                          setCopiedNotice(true);
                          window.setTimeout(() => setCopiedNotice(false), 1500);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        {copiedNotice ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedNotice ? t.localPlay.copied : t.localPlay.copyCode}
                      </button>
                      <button
                        disabled={localConnecting}
                        onClick={() => {
                          soundEngine.playUiClick();
                          onCreateLocalRoom();
                        }}
                        title={t.localPlay.newRoomBtn}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer disabled:opacity-40"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Room Players List split by Team */}
                {localRoom && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="font-semibold">
                        {t.localPlay.playersInRoom} ({localRoom.players.length}/10)
                      </span>
                      <button
                        onClick={() => {
                          const currentSide = selfInRoom?.faction ?? profile.faction;
                          onSwitchLocalFaction(currentSide === Faction.CT ? Faction.T : Faction.CT);
                        }}
                        className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 underline cursor-pointer"
                      >
                        {t.localPlay.switchSideBtn}
                      </button>
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {localRoom.players.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                p.faction === Faction.CT
                                  ? 'bg-sky-500/25 text-sky-300'
                                  : 'bg-amber-500/25 text-amber-300'
                              }`}
                            >
                              {p.faction}
                            </span>
                            <span className="text-white font-medium truncate">
                              {p.clanTag ? `[${p.clanTag}] ` : ''}
                              {p.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {p.isHost && (
                              <span className="text-[10px] font-bold text-amber-300">
                                {t.localPlay.hostBadge}
                              </span>
                            )}
                            {p.id === localClientId && (
                              <span className="text-[10px] font-bold text-emerald-400">
                                {t.localPlay.youBadge}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {isHost && (
                      <div className="pt-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                          <span>{t.localPlay.extraBotsLabel}</span>
                          <span className="font-mono-tabular text-amber-300 font-bold">
                            {localRoom.fillBots}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={6}
                          value={localRoom.fillBots}
                          onChange={(e) => onUpdateLocalExtraBots(Number(e.target.value))}
                          className="w-full accent-sky-400 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Panel 2: Enter Another Room's 5-Char Password */}
              <div className="bg-black/30 border border-white/10 rounded-xl p-4 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <LogIn className="w-4 h-4" />
                    {t.localPlay.joinTitle}
                  </div>
                  <input
                    type="text"
                    maxLength={5}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder={t.localPlay.joinPlaceholder}
                    className="w-full px-4 py-3 rounded-xl bg-[#111928] border border-white/20 focus:border-amber-400 text-center font-mono-tabular text-2xl font-black tracking-[0.35em] text-white uppercase focus:outline-none"
                  />
                  <button
                    disabled={joinCodeInput.trim().length < 5 || localConnecting}
                    onClick={() => {
                      soundEngine.playUiClick();
                      onJoinLocalRoom(joinCodeInput.trim());
                    }}
                    className="w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:bg-white/10 disabled:text-slate-500 text-slate-950 font-display font-bold text-sm transition-colors cursor-pointer"
                  >
                    {localConnecting ? t.localPlay.connecting : t.localPlay.joinBtn}
                  </button>

                  {localError && (
                    <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-400/40 text-xs text-red-200">
                      {localError}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-3 border-t border-white/10">
                  {localRoom && isHost ? (
                    <button
                      onClick={() => {
                        soundEngine.playUiClick();
                        onStartMatch();
                      }}
                      className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      {t.localPlay.startLocalMatch}
                    </button>
                  ) : localRoom ? (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-400/30 text-xs text-amber-200 text-center">
                      {t.localPlay.waitingHost}
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2">
                    {localRoom && (
                      <button
                        onClick={() => {
                          soundEngine.playUiClick();
                          onLeaveLocalRoom();
                        }}
                        className="flex-1 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-200 text-xs font-semibold cursor-pointer"
                      >
                        {t.localPlay.leaveRoom}
                      </button>
                    )}
                    <button
                      onClick={onCloseLocalModal}
                      className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      {t.localPlay.closeModal}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
