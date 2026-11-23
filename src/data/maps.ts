import { MapDefinition, MapId } from '../types/game';

export const MAPS: Record<MapId, MapDefinition> = {
  [MapId.DUST2]: {
    id: MapId.DUST2,
    nameUz: 'Dust II (Original)',
    nameEn: 'de_dust2 (Classic)',
    subtitleUz: '1:1 haqiqiy Dust 2 · Long, Pit, Catwalk, Xbox, Mid eshiklar, B Tunellar va B Oyna',
    subtitleEn: 'Authentic Dust 2 · A Long, Pit, Catwalk, Xbox, Mid Doors, B Tunnels & Window',
    previewImage: '/src/assets/images/map_dust2_arena_1795413197948.jpg',
    arenaWidth: 96,
    arenaDepth: 96,
    skyTopHex: 0x2f74a8,
    skyHorizonHex: 0xe6cda6,
    fogHex: 0xdfcaa4,
    fogDensity: 0.006,
    sunHex: 0xfff5e0,
    sunIntensity: 2.4,
    sunPosition: [46, 58, 28],
    hemiSkyHex: 0x9bd2f5,
    hemiGroundHex: 0x9c7b50,
    groundStyle: 'desert_cobble',
    ctSpawns: [
      [-6, 0, -37],
      [-2, 0, -39],
      [2, 0, -36],
      [-9, 0, -34],
    ],
    tSpawns: [
      [-4, 1.2, 41],
      [0, 1.2, 42],
      [4, 1.2, 41],
      [8, 1.2, 39],
    ],
    bombSiteA: [33, -27],
    bombSiteB: [-34, -29],
    obstacles: [
      // === T-SPAWN ELEVATED TERRACE & RAMPS ===
      { x: 0, y: 0, z: 41, w: 30, h: 1.2, d: 12, kind: 'ramp_step' },
      { x: -17, y: 0, z: 40, w: 4, h: 0.8, d: 10, kind: 'ramp_step' },
      { x: -21, y: 0, z: 40, w: 4, h: 0.4, d: 10, kind: 'ramp_step' },
      { x: 17, y: 0, z: 40, w: 4, h: 0.8, d: 10, kind: 'ramp_step' },
      { x: 21, y: 0, z: 40, w: 4, h: 0.4, d: 10, kind: 'ramp_step' },

      // === T-MID SUICIDE RAMP & SNIPER CORRIDOR ===
      { x: 0, y: 0, z: 33.5, w: 6.5, h: 0.8, d: 3.0, kind: 'ramp_step' },
      { x: 0, y: 0, z: 30.5, w: 6.5, h: 0.4, d: 3.0, kind: 'ramp_step' },
      { x: -7.5, y: 0, z: 26.0, w: 8.0, h: 4.8, d: 9.0, kind: 'wall' },
      { x: 7.5, y: 0, z: 26.0, w: 8.0, h: 4.8, d: 9.0, kind: 'wall' },

      // === MID DOUBLE DOORS & CT MID ===
      { x: -8.5, y: 0, z: -12, w: 7.0, h: 5.4, d: 1.8, kind: 'wall' },
      { x: -2.6, y: 0, z: -12, w: 4.1, h: 4.5, d: 0.55, kind: 'door' },
      { x: 2.5, y: 0, z: -12, w: 4.2, h: 4.5, d: 0.55, kind: 'door' },
      { x: 6.0, y: 0, z: -12, w: 2.6, h: 5.4, d: 1.8, kind: 'wall' },
      { x: -0.5, y: 4.5, z: -12, w: 11.5, h: 1.4, d: 1.8, kind: 'arch' },
      { x: -3.5, y: 0, z: -24, w: 2.2, h: 1.25, d: 2.2, kind: 'crate' }, // CT Mid box

      // === MID <-> LOWER TUNNELS DIVIDER & XBOX ===
      { x: -14, y: 0, z: 15, w: 4.5, h: 5.2, d: 14, kind: 'wall' },
      { x: -14, y: 0, z: -7, w: 4.5, h: 5.2, d: 10, kind: 'wall' },
      { x: 4.2, y: 0, z: 2.0, w: 2.3, h: 1.35, d: 2.3, kind: 'crate' }, // Iconic Xbox!

      // === CATWALK / SHORT A ELEVATED PATH & STAIRS ===
      { x: 9.5, y: 0, z: 12.5, w: 4.6, h: 0.5, d: 3.2, kind: 'ramp_step' },
      { x: 9.5, y: 0, z: 9.3, w: 4.6, h: 1.0, d: 3.2, kind: 'ramp_step' },
      { x: 9.7, y: 0, z: -5.2, w: 5.0, h: 1.5, d: 25.6, kind: 'ramp_step' },
      { x: 17.1, y: 0, z: -19.2, w: 9.8, h: 1.5, d: 5.4, kind: 'ramp_step' },
      { x: 11.2, y: 1.5, z: -21.2, w: 6.5, h: 0.95, d: 0.9, kind: 'barrier' }, // Short parapet
      { x: 15.2, y: 0, z: -3.5, w: 2.4, h: 5.0, d: 24.0, kind: 'wall' }, // Mid/Long divider

      // === CT RAMP TO A SITE ===
      { x: 11.5, y: 0, z: -31, w: 4.0, h: 0.4, d: 7.0, kind: 'ramp_step' },
      { x: 15.5, y: 0, z: -31, w: 4.0, h: 0.8, d: 7.0, kind: 'ramp_step' },
      { x: 19.5, y: 0, z: -31, w: 4.0, h: 1.2, d: 7.0, kind: 'ramp_step' },

      // === A SITE PLAT, DOUBLE STACK, GOOSE & A-RAMP ===
      { x: 32.75, y: 0, z: -28, w: 22.5, h: 1.2, d: 20.0, kind: 'ramp_step' },
      { x: 35.0, y: 0, z: -16.5, w: 16.0, h: 0.8, d: 3.0, kind: 'ramp_step' },
      { x: 35.0, y: 0, z: -13.5, w: 16.0, h: 0.4, d: 3.0, kind: 'ramp_step' },
      { x: 31.0, y: 1.2, z: -26, w: 2.6, h: 1.35, d: 2.6, kind: 'crate' }, // A Site Default
      { x: 31.0, y: 2.55, z: -26, w: 1.7, h: 1.2, d: 1.7, kind: 'crate' }, // Double Stack
      { x: 26.0, y: 1.2, z: -23, w: 2.4, h: 1.2, d: 2.4, kind: 'crate' },
      { x: 39.0, y: 1.2, z: -34, w: 2.4, h: 1.3, d: 2.4, kind: 'crate' }, // Goose corner
      { x: 42.5, y: 1.2, z: -21, w: 1.1, h: 1.35, d: 1.1, kind: 'barrel' },

      // === A LONG: CAR, PIT, BLUE CONTAINER & LONG DOORS HOUSE ===
      { x: 39.0, y: 0, z: -8.0, w: 2.4, h: 1.45, d: 4.6, kind: 'car' }, // Iconic A Long Car
      { x: 40.0, y: 0, z: 3.0, w: 5.0, h: 1.15, d: 1.5, kind: 'barrier' }, // Pit cover
      { x: 43.0, y: 0, z: 6.0, w: 2.2, h: 1.15, d: 2.2, kind: 'crate' },
      { x: 25.5, y: 0, z: 4.5, w: 2.6, h: 2.1, d: 4.8, kind: 'container', color: 0x1d4ed8 }, // Blue dumpster
      { x: 28.0, y: 0, z: 5.2, w: 1.8, h: 1.1, d: 1.8, kind: 'crate' },

      // Long Doors House (with roof ceiling)
      { x: 18.5, y: 0, z: 17.0, w: 3.0, h: 5.2, d: 18.0, kind: 'wall' },
      { x: 24.0, y: 0, z: 23.0, w: 8.0, h: 4.8, d: 1.8, kind: 'wall' },
      { x: 39.0, y: 0, z: 23.0, w: 14.4, h: 4.8, d: 1.8, kind: 'wall' },
      { x: 25.0, y: 0, z: 11.0, w: 10.0, h: 4.8, d: 1.8, kind: 'wall' },
      { x: 30.6, y: 0, z: 10.2, w: 0.6, h: 4.2, d: 2.4, kind: 'door' }, // Open door wing L
      { x: 36.2, y: 0, z: 10.2, w: 0.6, h: 4.2, d: 2.4, kind: 'door' }, // Open door wing R
      { x: 42.0, y: 0, z: 11.0, w: 12.0, h: 4.8, d: 1.8, kind: 'wall' },
      { x: 33.5, y: 4.5, z: 17.0, w: 26.0, h: 0.7, d: 13.5, kind: 'arch' },
      { x: 36.0, y: 0, z: 30.0, w: 2.8, h: 1.35, d: 2.8, kind: 'crate' }, // Outside Long crate

      // === B TUNNELS (UPPER & LOWER) WITH COVERED ROOF ===
      { x: -28.0, y: 0, z: 26.0, w: 2.6, h: 1.3, d: 2.6, kind: 'crate' }, // Outside Tunnels
      { x: -23.0, y: 0, z: 22.0, w: 1.1, h: 1.35, d: 1.1, kind: 'barrel' },
      { x: -42.0, y: 0, z: 15.5, w: 12.0, h: 4.8, d: 1.8, kind: 'wall' },
      { x: -24.0, y: 0, z: 15.5, w: 15.0, h: 4.8, d: 1.8, kind: 'wall' },
      { x: -24.0, y: 0, z: 11.0, w: 2.2, h: 4.8, d: 8.0, kind: 'wall' },
      { x: -24.0, y: 0, z: -5.0, w: 2.2, h: 4.8, d: 14.0, kind: 'wall' },
      { x: -43.5, y: 0, z: -12.0, w: 9.0, h: 5.0, d: 2.0, kind: 'wall' },
      { x: -25.5, y: 0, z: -12.0, w: 18.0, h: 5.0, d: 2.0, kind: 'wall' },
      { x: -33.0, y: 0, z: 3.0, w: 2.6, h: 1.4, d: 2.6, kind: 'crate' }, // Tunnel box
      { x: -35.5, y: 4.2, z: 2.0, w: 24.0, h: 0.7, d: 28.0, kind: 'arch' }, // Upper Tunnels Roof

      // === B SITE, BACK PLAT, B CAR, B DOORS & B WINDOW ===
      { x: -37.0, y: 0, z: -41.5, w: 18.0, h: 1.1, d: 8.5, kind: 'ramp_step' }, // B Back Plat
      { x: -37.0, y: 0, z: -36.0, w: 12.0, h: 0.55, d: 2.5, kind: 'ramp_step' },
      { x: -42.0, y: 0, z: -20.0, w: 2.4, h: 1.45, d: 4.6, kind: 'car' }, // Iconic B Car
      { x: -34.0, y: 0, z: -28.0, w: 3.0, h: 1.35, d: 3.0, kind: 'crate' }, // B Default
      { x: -34.0, y: 1.35, z: -28.0, w: 1.85, h: 1.2, d: 1.85, kind: 'crate' },
      { x: -28.0, y: 0, z: -22.0, w: 2.4, h: 1.25, d: 2.4, kind: 'crate' }, // Big Box
      { x: -18.0, y: 0, z: -17.0, w: 2.0, h: 5.2, d: 9.0, kind: 'wall' },
      { x: -18.0, y: 0, z: -23.4, w: 0.6, h: 4.2, d: 1.8, kind: 'door' }, // B Doors
      { x: -18.0, y: 0, z: -27.6, w: 0.6, h: 4.2, d: 1.8, kind: 'door' },
      { x: -18.0, y: 4.2, z: -25.5, w: 2.0, h: 1.0, d: 5.0, kind: 'arch' },
      { x: -18.0, y: 0, z: -31.0, w: 2.0, h: 5.2, d: 5.0, kind: 'wall' },
      { x: -18.0, y: 0, z: -36.5, w: 2.0, h: 1.05, d: 6.0, kind: 'barrier' }, // B Window sill
      { x: -18.0, y: 3.2, z: -36.5, w: 2.0, h: 2.0, d: 6.0, kind: 'arch' }, // B Window lintel
      { x: -18.0, y: 0, z: -43.0, w: 2.0, h: 5.2, d: 7.5, kind: 'wall' },
    ],
  },

  [MapId.MIRAGE]: {
    id: MapId.MIRAGE,
    nameUz: 'Mirage Qal’asi',
    nameEn: 'Mirage Compound',
    subtitleUz: 'O‘rta yer dengizi qumtosh maydoni · A va B sektorlar',
    subtitleEn: 'Mediterranean sandstone courtyard · A & B sites',
    previewImage: '/src/assets/images/map_mirage_compound_1795411889683.jpg',
    arenaWidth: 76,
    arenaDepth: 76,
    skyTopHex: 0x2b5876,
    skyHorizonHex: 0xd8b88a,
    fogHex: 0xd4b68c,
    fogDensity: 0.0085,
    sunHex: 0xfff1d6,
    sunIntensity: 2.2,
    sunPosition: [36, 48, 22],
    hemiSkyHex: 0x87ceeb,
    hemiGroundHex: 0x8b6f47,
    groundStyle: 'sandstone',
    ctSpawns: [
      [-28, 0, -28],
      [-22, 0, -30],
      [-30, 0, -22],
      [-18, 0, -28],
    ],
    tSpawns: [
      [28, 0, 28],
      [22, 0, 30],
      [30, 0, 22],
      [18, 0, 28],
    ],
    bombSiteA: [-20, 12],
    bombSiteB: [18, -18],
    obstacles: [
      // Mid central connector walls & pillars
      { x: 0, y: 0, z: 0, w: 4.5, h: 3.4, d: 4.5, kind: 'crate' },
      { x: -10, y: 0, z: -4, w: 6, h: 4.6, d: 2.2, kind: 'wall' },
      { x: 10, y: 0, z: 4, w: 6, h: 4.6, d: 2.2, kind: 'wall' },
      { x: 0, y: 0, z: -14, w: 8, h: 4.8, d: 2.4, kind: 'wall' },
      { x: 0, y: 0, z: 14, w: 8, h: 4.8, d: 2.4, kind: 'wall' },

      // A Site area (West-South)
      { x: -20, y: 0, z: 14, w: 3.2, h: 2.4, d: 3.2, kind: 'crate' },
      { x: -20, y: 2.4, z: 14, w: 2.1, h: 1.8, d: 2.1, kind: 'crate' },
      { x: -24, y: 0, z: 6, w: 2.4, h: 4.8, d: 10, kind: 'wall' },
      { x: -14, y: 0, z: 22, w: 3.5, h: 2.2, d: 2.4, kind: 'crate' },
      { x: -28, y: 0, z: 20, w: 4, h: 4.2, d: 4, kind: 'pillar' },

      // B Site area (East-North)
      { x: 19, y: 0, z: -18, w: 3.4, h: 2.4, d: 3.4, kind: 'crate' },
      { x: 24, y: 0, z: -8, w: 2.4, h: 4.8, d: 9, kind: 'wall' },
      { x: 14, y: 0, z: -24, w: 4, h: 2.0, d: 2.6, kind: 'crate' },
      { x: 27, y: 0, z: -22, w: 3.6, h: 4.4, d: 3.6, kind: 'pillar' },

      // Tactical mid crates & sandbag barriers
      { x: -8, y: 0, z: 10, w: 2.2, h: 1.5, d: 4.2, kind: 'barrier' },
      { x: 8, y: 0, z: -10, w: 2.2, h: 1.5, d: 4.2, kind: 'barrier' },
      { x: -16, y: 0, z: -16, w: 3.2, h: 2.2, d: 3.2, kind: 'crate' },
      { x: 16, y: 0, z: 16, w: 3.2, h: 2.2, d: 3.2, kind: 'crate' },
      { x: -28, y: 0, z: -10, w: 2.6, h: 1.8, d: 2.6, kind: 'crate' },
      { x: 28, y: 0, z: 10, w: 2.6, h: 1.8, d: 2.6, kind: 'crate' },
    ],
  },

  [MapId.NUKE]: {
    id: MapId.NUKE,
    nameUz: 'Nuke Zavodi',
    nameEn: 'Nuke Facility',
    subtitleUz: 'Sanoat majmuasi · Konteyner hovlisi va po‘lat to‘siqlar',
    subtitleEn: 'Industrial reactor yard · Shipping containers & steel cover',
    previewImage: '/src/assets/images/map_nuke_facility_1795411891168.jpg',
    arenaWidth: 78,
    arenaDepth: 78,
    skyTopHex: 0x3b536b,
    skyHorizonHex: 0xb7c6d4,
    fogHex: 0xb5c4d2,
    fogDensity: 0.009,
    sunHex: 0xf4f8ff,
    sunIntensity: 2.0,
    sunPosition: [-30, 52, 28],
    hemiSkyHex: 0xc2d8ec,
    hemiGroundHex: 0x475569,
    groundStyle: 'concrete',
    ctSpawns: [
      [-28, 0, -26],
      [-24, 0, -30],
      [-31, 0, -20],
      [-20, 0, -29],
    ],
    tSpawns: [
      [28, 0, 26],
      [24, 0, 30],
      [31, 0, 20],
      [20, 0, 29],
    ],
    bombSiteA: [-16, 16],
    bombSiteB: [18, -16],
    obstacles: [
      // Yard shipping containers (Blue & Orange)
      { x: 0, y: 0, z: -2, w: 3.2, h: 3.0, d: 8.5, kind: 'container', color: 0x1d4ed8 },
      { x: 0, y: 3.0, z: -2, w: 3.2, h: 3.0, d: 8.5, kind: 'container', color: 0xea580c },
      { x: -12, y: 0, z: -10, w: 8.5, h: 3.0, d: 3.2, kind: 'container', color: 0x1e40af },
      { x: 12, y: 0, z: 10, w: 8.5, h: 3.0, d: 3.2, kind: 'container', color: 0xc2410c },

      // Reactor concrete silos & walls
      { x: -18, y: 0, z: 14, w: 5.5, h: 5.2, d: 5.5, kind: 'pillar' },
      { x: 18, y: 0, z: -14, w: 5.5, h: 5.2, d: 5.5, kind: 'pillar' },
      { x: -24, y: 0, z: 2, w: 2.4, h: 4.5, d: 10, kind: 'wall' },
      { x: 24, y: 0, z: -2, w: 2.4, h: 4.5, d: 10, kind: 'wall' },

      // Tactical crates & Jersey barriers
      { x: -9, y: 0, z: 12, w: 3.2, h: 2.2, d: 3.2, kind: 'crate' },
      { x: 9, y: 0, z: -12, w: 3.2, h: 2.2, d: 3.2, kind: 'crate' },
      { x: -20, y: 0, z: 24, w: 4.5, h: 1.5, d: 1.8, kind: 'barrier' },
      { x: 20, y: 0, z: -24, w: 4.5, h: 1.5, d: 1.8, kind: 'barrier' },
      { x: -14, y: 0, z: -24, w: 3.0, h: 2.1, d: 3.0, kind: 'crate' },
      { x: 14, y: 0, z: 24, w: 3.0, h: 2.1, d: 3.0, kind: 'crate' },
      { x: 0, y: 0, z: 18, w: 6.5, h: 3.8, d: 2.2, kind: 'wall' },
      { x: 0, y: 0, z: -18, w: 6.5, h: 3.8, d: 2.2, kind: 'wall' },
    ],
  },

  [MapId.VERTIGO]: {
    id: MapId.VERTIGO,
    nameUz: 'Vertigo Tomi',
    nameEn: 'Vertigo Skyline',
    subtitleUz: 'Osmono‘par bino tomi · Po‘lat ustunlar va ochiq ufq',
    subtitleEn: 'High-rise construction roof · Steel pillars & open skyline',
    previewImage: '/src/assets/images/map_vertigo_skyline_1795411891312.jpg',
    arenaWidth: 72,
    arenaDepth: 72,
    skyTopHex: 0x3b82f6,
    skyHorizonHex: 0xdce6f2,
    fogHex: 0xd7e2ef,
    fogDensity: 0.0075,
    sunHex: 0xfff8eb,
    sunIntensity: 2.3,
    sunPosition: [40, 56, -24],
    hemiSkyHex: 0xbae6fd,
    hemiGroundHex: 0x64748b,
    groundStyle: 'rooftop',
    ctSpawns: [
      [-26, 0, -26],
      [-21, 0, -27],
      [-27, 0, -21],
      [-17, 0, -26],
    ],
    tSpawns: [
      [26, 0, 26],
      [21, 0, 27],
      [27, 0, 21],
      [17, 0, 26],
    ],
    bombSiteA: [-16, 16],
    bombSiteB: [16, -16],
    obstacles: [
      // Concrete construction core pillars
      { x: -12, y: 0, z: -12, w: 3.5, h: 5.5, d: 3.5, kind: 'pillar' },
      { x: 12, y: 0, z: 12, w: 3.5, h: 5.5, d: 3.5, kind: 'pillar' },
      { x: -12, y: 0, z: 12, w: 3.5, h: 5.5, d: 3.5, kind: 'pillar' },
      { x: 12, y: 0, z: -12, w: 3.5, h: 5.5, d: 3.5, kind: 'pillar' },

      // Center elevator shaft walls
      { x: 0, y: 0, z: 0, w: 6.5, h: 4.5, d: 6.5, kind: 'wall' },

      // Yellow safety barriers & construction crates
      { x: -20, y: 0, z: 4, w: 1.8, h: 1.5, d: 6.5, kind: 'barrier' },
      { x: 20, y: 0, z: -4, w: 1.8, h: 1.5, d: 6.5, kind: 'barrier' },
      { x: 4, y: 0, z: -20, w: 6.5, h: 1.5, d: 1.8, kind: 'barrier' },
      { x: -4, y: 0, z: 20, w: 6.5, h: 1.5, d: 1.8, kind: 'barrier' },

      { x: -20, y: 0, z: 18, w: 3.0, h: 2.2, d: 3.0, kind: 'crate' },
      { x: 20, y: 0, z: -18, w: 3.0, h: 2.2, d: 3.0, kind: 'crate' },
      { x: -18, y: 0, z: -20, w: 3.0, h: 2.0, d: 3.0, kind: 'crate' },
      { x: 18, y: 0, z: 20, w: 3.0, h: 2.0, d: 3.0, kind: 'crate' },
      { x: 0, y: 0, z: 15, w: 4.2, h: 2.4, d: 2.4, kind: 'crate' },
      { x: 0, y: 0, z: -15, w: 4.2, h: 2.4, d: 2.4, kind: 'crate' },
    ],
  },
};

export const MAP_LIST = Object.values(MAPS);
