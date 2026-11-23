import React from 'react';
import { CloudFog, Crosshair, Flame, Heart, Shield, ShoppingBag, Skull, Sparkles, X, Zap } from 'lucide-react';
import { getCopy } from '../data/i18n';
import { MAP_LIST, MAPS } from '../data/maps';
import { GRENADE_LIST, GRENADES, WEAPONS, WEAPON_LIST } from '../data/weapons';
import {
  Faction,
  GameSettings,
  GrenadeId,
  HudSnapshot,
  MapId,
  PlayerProfile,
  WeaponId,
  WeaponSlot,
} from '../types/game';
import { renderAvatarThumbnail } from './MainMenu';

interface GameHUDProps {
  hud: HudSnapshot;
  profile: PlayerProfile;
  settings: GameSettings;
  mapId: MapId;
  localRoomCode?: string | null;
  buyMenuOpen: boolean;
  pauseMenuOpen: boolean;
  scoreboardOpen: boolean;
  onResumeClick: () => void;
  onToggleBuyMenu: () => void;
  onBuyWeapon: (weaponId: WeaponId) => void;
  onBuyGrenade: (grenadeId: GrenadeId) => void;
  onBuyArmor: () => void;
  onSwitchMap: (mapId: MapId) => void;
  onExitToMenu: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  profile,
  settings,
  mapId,
  localRoomCode,
  buyMenuOpen,
  pauseMenuOpen,
  scoreboardOpen,
  onResumeClick,
  onToggleBuyMenu,
  onBuyWeapon,
  onBuyGrenade,
  onBuyArmor,
  onSwitchMap,
  onExitToMenu,
}) => {
  const t = getCopy(settings.language);
  const map = MAPS[mapId];
  const activeWeapon = WEAPONS[hud.activeWeaponId];
  const activeGrenadeSpec = hud.activeGrenade ? GRENADES[hud.activeGrenade] : null;
  const ch = settings.crosshair;
  const spread = ch.dynamic ? ch.gap + hud.crosshairSpread : ch.gap;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none overflow-hidden">
      {/* Flashbang Whiteout Overlay */}
      {hud.flashBlindAlpha > 0.01 && (
        <div
          className="absolute inset-0 pointer-events-none bg-white"
          style={{ opacity: Math.min(0.97, hud.flashBlindAlpha) }}
        />
      )}

      {/* Damage Vignette Flash */}
      {hud.damageFlash > 0.02 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 110px rgba(220, 38, 38, ${hud.damageFlash * 0.65})`,
          }}
        />
      )}

      {/* Special Nickname Enemy Dot Markers */}
      {hud.assistActive &&
        hud.isAlive &&
        !buyMenuOpen &&
        !pauseMenuOpen &&
        hud.enemyDots.map((dot) => (
          <div
            key={dot.id}
            style={{
              left: `${dot.screenX}%`,
              top: `${dot.screenY}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute pointer-events-none flex items-center justify-center"
          >
            <span
              className={`block rounded-full ${
                dot.visible
                  ? 'w-3 h-3 bg-red-500 ring-2 ring-amber-300 shadow-[0_0_8px_rgba(239,68,68,0.95)]'
                  : 'w-2.5 h-2.5 bg-red-500/85 ring-1 ring-white/70'
              }`}
            />
          </div>
        ))}

      {/* AWP Scope Overlay */}
      {hud.isScoped && hud.isAlive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-full h-[1px] bg-black/85 absolute" />
          <div className="h-full w-[1px] bg-black/85 absolute" />
          <div
            className="w-[72vh] h-[72vh] rounded-full border-[3px] border-black"
            style={{
              boxShadow: '0 0 0 100vmax rgba(0, 0, 0, 0.92)',
            }}
          />
        </div>
      )}

      {/* Center Dynamic Crosshair & Hitmarker */}
      {hud.isAlive && !hud.isScoped && !buyMenuOpen && !pauseMenuOpen && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            style={{
              position: 'absolute',
              width: ch.size,
              height: ch.thickness,
              backgroundColor: ch.color,
              transform: `translateX(${-(spread + ch.size / 2)}px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: ch.size,
              height: ch.thickness,
              backgroundColor: ch.color,
              transform: `translateX(${spread + ch.size / 2}px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: ch.thickness,
              height: ch.size,
              backgroundColor: ch.color,
              transform: `translateY(${-(spread + ch.size / 2)}px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: ch.thickness,
              height: ch.size,
              backgroundColor: ch.color,
              transform: `translateY(${spread + ch.size / 2}px)`,
            }}
          />
          {ch.dot && (
            <div
              style={{
                width: ch.thickness + 1,
                height: ch.thickness + 1,
                backgroundColor: ch.color,
              }}
            />
          )}

          {/* Hitmarker */}
          {hud.hitMarkerType !== 'none' && (
            <div
              className={`absolute w-6 h-6 pointer-events-none ${
                hud.hitMarkerType === 'head' ? 'text-red-500 scale-125' : 'text-white'
              }`}
            >
              <X className="w-6 h-6 stroke-[2.5]" />
            </div>
          )}
        </div>
      )}

      {/* Top-Left Tactical Radar */}
      {settings.showRadar && (
        <div className="absolute top-4 left-4 w-40 h-40 rounded-xl bg-[#0b1019]/90 border border-white/15 overflow-hidden">
          <svg viewBox="-54 -54 108 108" className="w-full h-full">
            <g transform={`rotate(${(hud.playerYaw * 180) / Math.PI}) translate(${-hud.playerX}, ${-hud.playerZ})`}>
              {/* Arena bounds */}
              <rect
                x={-map.arenaWidth / 2}
                y={-map.arenaDepth / 2}
                width={map.arenaWidth}
                height={map.arenaDepth}
                fill="rgba(30, 41, 59, 0.45)"
                stroke="rgba(148, 163, 184, 0.35)"
                strokeWidth="0.8"
              />
              {/* Obstacles (skip overhead tunnel roofs so lanes stay visible) */}
              {map.obstacles
                .filter((obs) => !(obs.kind === 'arch' && obs.y >= 3.0))
                .map((obs, idx) => (
                  <rect
                    key={idx}
                    x={obs.x - obs.w / 2}
                    y={obs.z - obs.d / 2}
                    width={obs.w}
                    height={obs.d}
                    fill={obs.kind === 'ramp_step' ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.5)'}
                  />
                ))}
              {/* Site Labels */}
              <text
                x={map.bombSiteA[0]}
                y={map.bombSiteA[1]}
                fill="#ef4444"
                fontSize="5"
                fontWeight="bold"
                textAnchor="middle"
              >
                A
              </text>
              <text
                x={map.bombSiteB[0]}
                y={map.bombSiteB[1]}
                fill="#ef4444"
                fontSize="5"
                fontWeight="bold"
                textAnchor="middle"
              >
                B
              </text>
              {/* Blips */}
              {hud.radarBlips.map((b) => {
                if (!b.alive) return null;
                const fill = b.isPlayer
                  ? '#ffffff'
                  : b.faction === Faction.CT
                  ? '#38bdf8'
                  : '#f59e0b';
                return <circle key={b.id} cx={b.x} cy={b.z} r={b.isPlayer ? 2.2 : 1.7} fill={fill} />;
              })}
            </g>
            {/* Player view cone */}
            <polygon points="0,0 -8,-16 8,-16" fill="rgba(255,255,255,0.16)" />
          </svg>
        </div>
      )}

      {/* Top-Center Scoreboard & Round Timer */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center bg-[#0b1019]/92 border border-white/15 rounded-lg overflow-hidden">
        <div className="px-4 py-1.5 bg-blue-600/25 text-blue-300 font-mono-tabular font-bold text-lg">
          {hud.ctScore}
        </div>
        <div className="px-4 py-1.5 text-center border-x border-white/10">
          <div className="font-mono-tabular font-bold text-base text-white leading-none">
            {formatTime(hud.roundTimeRemaining)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {t.hud.round} {hud.roundNumber}
          </div>
        </div>
        <div className="px-4 py-1.5 bg-amber-600/25 text-amber-300 font-mono-tabular font-bold text-lg">
          {hud.tScore}
        </div>
      </div>

      {/* Top-Right Killfeed */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
        {hud.killfeed.map((k) => (
          <div
            key={k.id}
            className="flex items-center gap-2 px-3 py-1 rounded bg-[#0b1019]/90 border border-white/10 text-xs"
          >
            <span
              className={`font-semibold ${
                k.killerFaction === Faction.CT ? 'text-sky-300' : 'text-amber-300'
              }`}
            >
              {k.killerName}
            </span>
            <span className="text-slate-400 font-mono-tabular">
              [
              {k.weaponId in WEAPONS
                ? WEAPONS[k.weaponId as WeaponId].name
                : GRENADES[k.weaponId as GrenadeId].shortLabel}
              ]
            </span>
            {k.headshot && <Crosshair className="w-3.5 h-3.5 text-red-400" />}
            <span
              className={`font-semibold ${
                k.victimFaction === Faction.CT ? 'text-sky-300' : 'text-amber-300'
              }`}
            >
              {k.victimName}
            </span>
          </div>
        ))}
      </div>

      {/* Round Winner / Respawn Banner */}
      {hud.roundBanner && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-lg bg-[#0b1019]/95 border border-amber-400/60 font-display font-bold text-lg tracking-wider text-amber-300">
          {hud.roundBanner}
        </div>
      )}

      {!hud.isAlive && !hud.roundBanner && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 px-5 py-2 rounded-lg bg-red-950/90 border border-red-400/50 flex items-center gap-2 text-sm text-red-100">
          <Skull className="w-4 h-4" />
          <span>
            {hud.respawnTimer > 0
              ? `${t.hud.respawnIn}: ${hud.respawnTimer.toFixed(1)}s`
              : t.hud.dead}
          </span>
        </div>
      )}

      {/* Reloading Indicator */}
      {hud.isReloading && hud.isAlive && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded bg-[#0b1019]/90 border border-white/15 text-xs font-medium text-amber-300">
          {t.hud.reloading}
        </div>
      )}

      {/* Bottom-Left: Health, Armor & Identity */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4 bg-[#0b1019]/92 border border-white/15 rounded-xl px-4 py-3">
        {renderAvatarThumbnail(profile, 'w-11 h-11')}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <span>
              {profile.clanTag ? `[${profile.clanTag}] ` : ''}
              {profile.name}
            </span>
            {hud.isCrouching && (
              <span className="text-[11px] font-medium text-amber-300">· {t.hud.crouched}</span>
            )}
            {hud.assistActive && hud.speedMultiplier > 1.05 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-mono-tabular font-bold text-cyan-300">
                · <Zap className="w-3 h-3 fill-current" />
                {t.hud.speedBoost} {hud.speedMultiplier.toFixed(1)}x
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Heart className="w-4 h-4 fill-current" />
              <span className="font-mono-tabular text-2xl font-bold leading-none">
                {hud.health}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sky-400">
              <Shield className="w-4 h-4" />
              <span className="font-mono-tabular text-lg font-bold leading-none">
                {Math.round(hud.armor)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom-Center Discreet Controls Strip */}
      <div className="hidden md:block absolute bottom-4 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-lg bg-[#0b1019]/80 border border-white/10 text-[11px] text-slate-300 whitespace-nowrap">
        {t.hud.controlsMini}
      </div>

      {/* Bottom-Right: Money, Ammo & Weapon + Grenade Slots */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
        <div className="flex items-center gap-3 bg-[#0b1019]/92 border border-white/15 rounded-xl px-4 py-2.5">
          <div className="text-right pr-3 border-r border-white/10">
            <div className="font-mono-tabular text-lg font-bold text-emerald-400">${hud.money}</div>
            <div className="text-[11px] text-slate-400">
              {activeGrenadeSpec
                ? settings.language === 'uz'
                  ? activeGrenadeSpec.nameUz
                  : activeGrenadeSpec.nameEn
                : activeWeapon.name}
            </div>
          </div>
          <div className="font-mono-tabular text-right">
            {hud.activeGrenade ? (
              <span className="text-2xl font-bold text-amber-300">
                ×{hud.ownedGrenades[hud.activeGrenade]}
              </span>
            ) : activeWeapon.slot === WeaponSlot.MELEE ? (
              <span className="text-2xl font-bold text-slate-200">—</span>
            ) : (
              <>
                <span className="text-2xl font-bold text-white">{hud.ammoInMag}</span>
                <span className="text-sm text-slate-400"> / {hud.ammoReserve}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {([WeaponSlot.PRIMARY, WeaponSlot.SECONDARY, WeaponSlot.MELEE] as WeaponSlot[]).map(
            (slot, idx) => {
              const wid = hud.ownedWeapons[slot];
              const isActive = !hud.activeGrenade && hud.activeSlot === slot;
              return (
                <div
                  key={slot}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium border ${
                    isActive
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-[#0b1019]/85 border-white/10 text-slate-400'
                  }`}
                >
                  {idx + 1}. {wid ? WEAPONS[wid].name : '—'}
                </div>
              );
            }
          )}
          <div
            className={`px-2.5 py-1 rounded text-[11px] font-medium border flex items-center gap-2 ${
              hud.activeGrenade
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-[#0b1019]/85 border-white/10 text-slate-300'
            }`}
          >
            <span>4.</span>
            <span className={hud.activeGrenade === GrenadeId.HE ? 'text-orange-300 font-bold' : ''}>
              HE×{hud.ownedGrenades[GrenadeId.HE]}
            </span>
            <span className={hud.activeGrenade === GrenadeId.FLASH ? 'text-sky-300 font-bold' : ''}>
              FL×{hud.ownedGrenades[GrenadeId.FLASH]}
            </span>
            <span className={hud.activeGrenade === GrenadeId.SMOKE ? 'text-emerald-300 font-bold' : ''}>
              SMK×{hud.ownedGrenades[GrenadeId.SMOKE]}
            </span>
          </div>
        </div>
      </div>

      {/* Click-to-Lock Prompt (when not in Buy/Pause overlay) */}
      {!hud.pointerLocked && !buyMenuOpen && !pauseMenuOpen && (
        <div
          onClick={onResumeClick}
          className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-4 pointer-events-auto cursor-pointer"
        >
          <div className="px-7 py-5 rounded-xl bg-[#0f1623]/95 border border-amber-400/50 text-center max-w-lg">
            <div className="font-display text-xl font-bold text-white">{t.hud.clickToLock}</div>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">{t.hud.lockHint}</p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResumeClick();
                }}
                className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm cursor-pointer"
              >
                {t.hud.resume}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBuyMenu();
                }}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium cursor-pointer"
              >
                {t.hud.buyMenu}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExitToMenu();
                }}
                className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-sm font-medium cursor-pointer"
              >
                {t.hud.exitToMenu}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buy Menu Modal (B) */}
      {buyMenuOpen && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-6 pointer-events-auto">
          <div className="w-full max-w-2xl bg-[#111723] border border-white/15 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h2 className="font-display text-lg font-bold text-white">{t.hud.buyTitle}</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="font-mono-tabular text-base font-bold text-emerald-400">
                  {t.hud.balance}: ${hud.money}
                </div>
                <button
                  onClick={onToggleBuyMenu}
                  className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-medium text-white cursor-pointer"
                >
                  {t.hud.close}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {WEAPON_LIST.filter((w) => w.price > 0).map((w) => {
                const owned = hud.ownedWeapons[w.slot] === w.id;
                const canAfford = hud.money >= w.price;
                return (
                  <button
                    key={w.id}
                    disabled={owned || !canAfford}
                    onClick={() => onBuyWeapon(w.id)}
                    className={`flex items-center justify-between p-3.5 rounded-lg border text-left transition-colors ${
                      owned
                        ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                        : canAfford
                        ? 'bg-white/[0.04] border-white/15 hover:border-amber-400 text-white cursor-pointer'
                        : 'bg-white/[0.02] border-white/5 text-slate-500 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="font-display font-bold text-sm">{w.name}</div>
                      <div className="text-xs text-slate-400">
                        {settings.language === 'uz' ? w.categoryLabelUz : w.categoryLabelEn} · DMG {w.damage}
                      </div>
                    </div>
                    <div className="font-mono-tabular font-bold text-sm text-amber-400">
                      {owned ? t.hud.owned : `$${w.price}`}
                    </div>
                  </button>
                );
              })}

              {/* Kevlar + Helmet */}
              <button
                disabled={hud.armor >= 100 || hud.money < 1000}
                onClick={onBuyArmor}
                className={`sm:col-span-2 flex items-center justify-between p-3.5 rounded-lg border text-left transition-colors ${
                  hud.armor >= 100
                    ? 'bg-sky-500/15 border-sky-400/50 text-sky-200'
                    : hud.money >= 1000
                    ? 'bg-white/[0.04] border-white/15 hover:border-sky-400 text-white cursor-pointer'
                    : 'bg-white/[0.02] border-white/5 text-slate-500 opacity-60'
                }`}
              >
                <span className="font-display font-bold text-sm">{t.hud.armorBtn}</span>
                <span className="font-mono-tabular font-bold text-sm text-sky-300">
                  {hud.armor >= 100 ? t.hud.owned : '$1000'}
                </span>
              </button>
            </div>

            {/* Grenades & Utility Section */}
            <div className="pt-2 border-t border-white/10 space-y-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {t.hud.grenadesTitle}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {GRENADE_LIST.map((g) => {
                  const count = hud.ownedGrenades[g.id];
                  const full = count >= g.maxCarry;
                  const canAfford = hud.money >= g.price;
                  const Icon = g.id === GrenadeId.HE ? Flame : g.id === GrenadeId.FLASH ? Sparkles : CloudFog;
                  const accent =
                    g.id === GrenadeId.HE
                      ? 'text-orange-400'
                      : g.id === GrenadeId.FLASH
                      ? 'text-sky-300'
                      : 'text-emerald-400';

                  return (
                    <button
                      key={g.id}
                      disabled={full || !canAfford}
                      onClick={() => onBuyGrenade(g.id)}
                      className={`flex flex-col justify-between p-3 rounded-lg border text-left transition-colors ${
                        full
                          ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-100'
                          : canAfford
                          ? 'bg-white/[0.04] border-white/15 hover:border-amber-400 text-white cursor-pointer'
                          : 'bg-white/[0.02] border-white/5 text-slate-500 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Icon className={`w-4 h-4 shrink-0 ${accent}`} />
                        <span className="font-mono-tabular text-[11px] text-slate-400">
                          {count}/{g.maxCarry}
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="font-display font-bold text-xs">
                          {settings.language === 'uz' ? g.nameUz : g.nameEn}
                        </div>
                        <div className="font-mono-tabular font-bold text-xs text-amber-400 mt-1">
                          {full ? t.hud.owned : `$${g.price}`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pause Menu (P) */}
      {pauseMenuOpen && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-center p-6 pointer-events-auto">
          <div className="w-full max-w-md bg-[#111723] border border-white/15 rounded-xl p-6 space-y-3 text-center">
            <h2 className="font-display text-xl font-bold text-white mb-2">{t.brand}</h2>
            <button
              onClick={onResumeClick}
              className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm cursor-pointer"
            >
              {t.hud.resume}
            </button>
            <button
              onClick={onToggleBuyMenu}
              className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold text-sm cursor-pointer"
            >
              {t.hud.buyMenu}
            </button>

            <div className="pt-2 border-t border-white/10 text-left">
              <div className="text-xs text-slate-400 mb-2">{t.hud.switchMap}</div>
              <div className="grid grid-cols-2 gap-2">
                {MAP_LIST.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onSwitchMap(m.id)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold text-left truncate cursor-pointer transition-colors ${
                      m.id === mapId
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    {settings.language === 'uz' ? m.nameUz : m.nameEn}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={onExitToMenu}
              className="w-full py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 font-semibold text-sm cursor-pointer"
            >
              {t.hud.exitToMenu}
            </button>
          </div>
        </div>
      )}

      {/* Scoreboard Overlay (Tab) — Split into Special Forces (CT) & Terrorists (T) */}
      {scoreboardOpen && (
        <div className="absolute inset-0 bg-black/65 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
          <div className="w-full max-w-4xl bg-[#0e1420]/96 border border-white/15 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
              <div className="font-display font-bold text-base text-white">
                {t.hud.scoreboardTitle} · {settings.language === 'uz' ? map.nameUz : map.nameEn}
              </div>
              {localRoomCode && (
                <div className="font-mono-tabular text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-400/40 px-2.5 py-1 rounded">
                  LOCAL PAROL: {localRoomCode}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  {
                    faction: Faction.CT,
                    title: t.hud.ctTeamHeader,
                    score: hud.ctScore,
                    borderClass: 'border-sky-500/35',
                    headerClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
                    nameClass: 'text-sky-300',
                    highlightClass: 'bg-sky-500/15',
                  },
                  {
                    faction: Faction.T,
                    title: t.hud.tTeamHeader,
                    score: hud.tScore,
                    borderClass: 'border-amber-500/35',
                    headerClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                    nameClass: 'text-amber-300',
                    highlightClass: 'bg-amber-500/15',
                  },
                ] as const
              ).map((team) => {
                const rows = hud.scoreboard
                  .filter((r) => r.faction === team.faction)
                  .sort((a, b) => b.score - a.score);
                return (
                  <div
                    key={team.faction}
                    className={`rounded-lg border ${team.borderClass} bg-black/25 overflow-hidden`}
                  >
                    <div
                      className={`px-3.5 py-2 border-b ${team.headerClass} flex items-center justify-between gap-2`}
                    >
                      <span className="font-display font-bold text-xs tracking-wide truncate">
                        {team.title}
                      </span>
                      <span className="font-mono-tabular font-bold text-base">{team.score}</span>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-white/10">
                          <th className="py-1.5 px-3 text-left">{t.hud.playerCol}</th>
                          <th className="py-1.5 px-1.5 text-center">{t.hud.killsCol}</th>
                          <th className="py-1.5 px-1.5 text-center">{t.hud.deathsCol}</th>
                          <th className="py-1.5 px-2 text-right">{t.hud.scoreCol}</th>
                          <th className="py-1.5 px-3 text-right">{t.hud.moneyCol}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-slate-500 text-[11px]">
                              —
                            </td>
                          </tr>
                        ) : (
                          rows.map((row) => (
                            <tr
                              key={row.id}
                              className={`border-b border-white/5 last:border-b-0 ${
                                row.isPlayer ? `${team.highlightClass} font-semibold` : ''
                              } ${!row.alive ? 'opacity-50' : ''}`}
                            >
                              <td className="py-2 px-3 text-left truncate max-w-[160px]">
                                <span className={team.nameClass}>
                                  {row.clanTag ? `[${row.clanTag}] ` : ''}
                                  {row.name}
                                </span>
                                {!row.alive && (
                                  <span className="ml-1.5 text-[10px] text-red-400">
                                    ({t.hud.deadBadge})
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-1.5 text-center font-mono-tabular">
                                {row.kills}
                              </td>
                              <td className="py-2 px-1.5 text-center font-mono-tabular">
                                {row.deaths}
                              </td>
                              <td className="py-2 px-2 text-right font-mono-tabular text-white">
                                {row.score}
                              </td>
                              <td className="py-2 px-3 text-right font-mono-tabular text-emerald-400">
                                ${row.money}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
