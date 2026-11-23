import * as THREE from 'three';

export interface ProceduralTextureSet {
  sandstoneFloor: THREE.CanvasTexture;
  sandstoneWall: THREE.CanvasTexture;
  desertCobbleFloor: THREE.CanvasTexture;
  woodenDoor: THREE.CanvasTexture;
  barrelMetal: THREE.CanvasTexture;
  concreteFloor: THREE.CanvasTexture;
  concreteWall: THREE.CanvasTexture;
  rooftopFloor: THREE.CanvasTexture;
  woodCrate: THREE.CanvasTexture;
  corrugatedMetal: THREE.CanvasTexture;
  hazardBarrier: THREE.CanvasTexture;
  skyscraperGlass: THREE.CanvasTexture;
  surfaceBump: THREE.CanvasTexture;
  siteDecalA: THREE.CanvasTexture;
  siteDecalB: THREE.CanvasTexture;
  skyWarm: THREE.CanvasTexture;
  skyCool: THREE.CanvasTexture;
  smokePuff: THREE.CanvasTexture;
  wallSprays: THREE.CanvasTexture[];
  dispose: () => void;
}

function configureTexture(
  canvas: HTMLCanvasElement,
  maxAniso: number,
  repeatX = 1,
  repeatY = 1,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function makeCanvas(size = 512, height = size): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function addGrain(ctx: CanvasRenderingContext2D, width: number, height: number, amount = 22) {
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function makeSkyCanvas(
  topHex: string,
  midHex: string,
  horizonHex: string,
  sunColor: string,
  sunX: number,
  sunY: number
): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(1024, 512);
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, topHex);
  grad.addColorStop(0.48, midHex);
  grad.addColorStop(0.76, horizonHex);
  grad.addColorStop(1, horizonHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Soft sun glow
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 175);
  sunGlow.addColorStop(0, '#ffffff');
  sunGlow.addColorStop(0.14, sunColor);
  sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, 1024, 512);

  // Wispy volumetric cloud bands
  for (let i = 0; i < 42; i++) {
    const cx = (i * 97) % 1024;
    const cy = 90 + ((i * 53) % 175);
    const rw = 55 + (i % 5) * 28;
    const rh = 12 + (i % 3) * 8;
    const cg = ctx.createRadialGradient(cx, cy, 4, cx, cy, rw);
    cg.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
    cg.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, rh / rw);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = cg;
    ctx.fillRect(cx - rw, cy - rw, rw * 2, rw * 2);
    ctx.restore();
  }
  return c;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextureSet {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // 1. Sandstone Floor (warm Mediterranean courtyard stone with mortar joints)
  const [sfC, sfCtx] = makeCanvas(512);
  sfCtx.fillStyle = '#9c7f57';
  sfCtx.fillRect(0, 0, 512, 512);
  const tileSize = 64;
  for (let y = 0; y < 512; y += tileSize) {
    const offset = (y / tileSize) % 2 === 0 ? 0 : tileSize / 2;
    for (let x = -tileSize; x < 512 + tileSize; x += tileSize) {
      const shade = 192 + Math.floor(Math.random() * 28);
      sfCtx.fillStyle = `rgb(${shade}, ${shade - 26}, ${shade - 62})`;
      sfCtx.fillRect(x + offset + 3, y + 3, tileSize - 6, tileSize - 6);
      sfCtx.strokeStyle = 'rgba(255, 240, 210, 0.16)';
      sfCtx.strokeRect(x + offset + 4, y + 4, tileSize - 8, tileSize - 8);
    }
  }
  addGrain(sfCtx, 512, 512, 24);
  const sandstoneFloor = configureTexture(sfC, maxAniso, 16, 16);

  // 1b. Dust II Desert Cobble & Sand Road
  const [dcC, dcCtx] = makeCanvas(512);
  dcCtx.fillStyle = '#a4845a';
  dcCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 32) {
    const off = (y / 32) % 2 === 0 ? 0 : 24;
    for (let x = -32; x < 512 + 32; x += 48) {
      const s = 180 + Math.floor(Math.random() * 34);
      dcCtx.fillStyle = `rgb(${s}, ${s - 28}, ${s - 62})`;
      dcCtx.fillRect(x + off + 2, y + 2, 44, 28);
    }
  }
  // Subtle drifted sand patches
  for (let i = 0; i < 12; i++) {
    const sx = (i * 113) % 512;
    const sy = (i * 71) % 512;
    const sg = dcCtx.createRadialGradient(sx, sy, 8, sx, sy, 75);
    sg.addColorStop(0, 'rgba(222, 194, 148, 0.34)');
    sg.addColorStop(1, 'rgba(222, 194, 148, 0)');
    dcCtx.fillStyle = sg;
    dcCtx.fillRect(0, 0, 512, 512);
  }
  addGrain(dcCtx, 512, 512, 26);
  const desertCobbleFloor = configureTexture(dcC, maxAniso, 18, 18);

  // 1c. Heavy Weathered Wooden Double Door
  const [wdC, wdCtx] = makeCanvas(512);
  wdCtx.fillStyle = '#5c3c22';
  wdCtx.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) {
    wdCtx.fillStyle = x % 128 === 0 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.06)';
    wdCtx.fillRect(x, 0, 61, 512);
    wdCtx.fillStyle = '#241409';
    wdCtx.fillRect(x + 61, 0, 3, 512);
  }
  wdCtx.fillStyle = '#27272a';
  wdCtx.fillRect(0, 88, 512, 34);
  wdCtx.fillRect(0, 390, 512, 34);
  wdCtx.fillStyle = '#52525b';
  for (let x = 28; x < 512; x += 64) {
    wdCtx.fillRect(x, 99, 10, 10);
    wdCtx.fillRect(x, 401, 10, 10);
  }
  addGrain(wdCtx, 512, 512, 18);
  const woodenDoor = configureTexture(wdC, maxAniso, 1, 1);

  // 1d. Tactical Olive/Rust Barrel
  const [bmC, bmCtx] = makeCanvas(256);
  bmCtx.fillStyle = '#3d523a';
  bmCtx.fillRect(0, 0, 256, 256);
  bmCtx.fillStyle = '#1f2937';
  bmCtx.fillRect(0, 72, 256, 16);
  bmCtx.fillRect(0, 168, 256, 16);
  bmCtx.fillStyle = '#eab308';
  bmCtx.fillRect(0, 118, 256, 18);
  addGrain(bmCtx, 256, 256, 20);
  const barrelMetal = configureTexture(bmC, maxAniso, 1, 1);

  // 2. Sandstone Wall (plaster, arches, masonry & weathered base)
  const [swC, swCtx] = makeCanvas(512);
  swCtx.fillStyle = '#d9be94';
  swCtx.fillRect(0, 0, 512, 512);
  // Subtle stucco patches
  for (let i = 0; i < 8; i++) {
    const px = (i * 89) % 440;
    const py = (i * 67) % 420;
    const g = swCtx.createRadialGradient(px, py, 10, px, py, 95);
    g.addColorStop(0, i % 2 === 0 ? 'rgba(246, 229, 198, 0.25)' : 'rgba(154, 118, 72, 0.2)');
    g.addColorStop(1, 'rgba(217, 190, 148, 0)');
    swCtx.fillStyle = g;
    swCtx.fillRect(0, 0, 512, 512);
  }
  // Upper decorative frieze & lower skirting band
  swCtx.fillStyle = 'rgba(130, 96, 56, 0.26)';
  swCtx.fillRect(0, 0, 512, 34);
  swCtx.fillStyle = 'rgba(255, 244, 224, 0.25)';
  swCtx.fillRect(0, 34, 512, 6);

  const wg = swCtx.createLinearGradient(0, 360, 0, 512);
  wg.addColorStop(0, 'rgba(92, 68, 38, 0)');
  wg.addColorStop(1, 'rgba(84, 60, 32, 0.36)');
  swCtx.fillStyle = wg;
  swCtx.fillRect(0, 360, 512, 152);

  swCtx.strokeStyle = 'rgba(110, 82, 50, 0.28)';
  swCtx.lineWidth = 3;
  for (let y = 40; y < 512; y += 64) {
    swCtx.beginPath();
    swCtx.moveTo(0, y);
    swCtx.lineTo(512, y);
    swCtx.stroke();
    const rowOff = (y / 64) % 2 === 0 ? 0 : 64;
    for (let x = rowOff; x < 512; x += 128) {
      swCtx.beginPath();
      swCtx.moveTo(x, y);
      swCtx.lineTo(x, y + 64);
      swCtx.stroke();
    }
  }
  addGrain(swCtx, 512, 512, 24);
  const sandstoneWall = configureTexture(swC, maxAniso, 2, 1);

  // 3. Concrete Floor
  const [cfC, cfCtx] = makeCanvas(512);
  cfCtx.fillStyle = '#5c6674';
  cfCtx.fillRect(0, 0, 512, 512);
  cfCtx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  cfCtx.lineWidth = 4;
  for (let i = 0; i <= 512; i += 128) {
    cfCtx.beginPath();
    cfCtx.moveTo(i, 0);
    cfCtx.lineTo(i, 512);
    cfCtx.stroke();
    cfCtx.beginPath();
    cfCtx.moveTo(0, i);
    cfCtx.lineTo(512, i);
    cfCtx.stroke();
  }
  addGrain(cfCtx, 512, 512, 24);
  const concreteFloor = configureTexture(cfC, maxAniso, 14, 14);

  // 4. Concrete Wall (panels, rivets & industrial stripe)
  const [cwC, cwCtx] = makeCanvas(512);
  cwCtx.fillStyle = '#8b95a5';
  cwCtx.fillRect(0, 0, 512, 512);
  cwCtx.fillStyle = 'rgba(30, 41, 59, 0.26)';
  cwCtx.fillRect(0, 444, 512, 68);
  cwCtx.fillStyle = '#f59e0b';
  cwCtx.fillRect(0, 434, 512, 10);
  cwCtx.fillStyle = 'rgba(15, 23, 42, 0.18)';
  cwCtx.fillRect(0, 0, 512, 26);
  cwCtx.strokeStyle = 'rgba(30, 41, 59, 0.32)';
  cwCtx.lineWidth = 3;
  cwCtx.strokeRect(10, 32, 236, 392);
  cwCtx.strokeRect(266, 32, 236, 392);
  // Subtle panel bolts
  cwCtx.fillStyle = 'rgba(30, 41, 59, 0.45)';
  for (const bx of [22, 232, 278, 488]) {
    for (const by of [48, 408]) {
      cwCtx.beginPath();
      cwCtx.arc(bx, by, 4, 0, Math.PI * 2);
      cwCtx.fill();
    }
  }
  addGrain(cwCtx, 512, 512, 20);
  const concreteWall = configureTexture(cwC, maxAniso, 2, 1);

  // 5. Rooftop Floor
  const [rfC, rfCtx] = makeCanvas(512);
  rfCtx.fillStyle = '#47515e';
  rfCtx.fillRect(0, 0, 512, 512);
  rfCtx.strokeStyle = 'rgba(255,255,255,0.09)';
  rfCtx.lineWidth = 2;
  for (let i = 0; i < 512; i += 64) {
    rfCtx.beginPath();
    rfCtx.moveTo(i, 0);
    rfCtx.lineTo(i, 512);
    rfCtx.stroke();
    rfCtx.beginPath();
    rfCtx.moveTo(0, i);
    rfCtx.lineTo(512, i);
    rfCtx.stroke();
  }
  addGrain(rfCtx, 512, 512, 26);
  const rooftopFloor = configureTexture(rfC, maxAniso, 14, 14);

  // 6. Wooden Tactical Crate
  const [wcC, wcCtx] = makeCanvas(512);
  wcCtx.fillStyle = '#a87948';
  wcCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    wcCtx.fillStyle = y % 128 === 0 ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.05)';
    wcCtx.fillRect(0, y, 512, 62);
    wcCtx.fillStyle = '#4a3118';
    wcCtx.fillRect(0, y + 62, 512, 2);
  }
  wcCtx.strokeStyle = '#6e4a26';
  wcCtx.lineWidth = 36;
  wcCtx.strokeRect(18, 18, 476, 476);
  wcCtx.beginPath();
  wcCtx.moveTo(24, 24);
  wcCtx.lineTo(488, 488);
  wcCtx.lineWidth = 26;
  wcCtx.stroke();
  wcCtx.fillStyle = 'rgba(25, 18, 12, 0.78)';
  wcCtx.font = 'bold 40px monospace';
  wcCtx.fillText('SUPPLY-04', 142, 268);
  addGrain(wcCtx, 512, 512, 16);
  const woodCrate = configureTexture(wcC, maxAniso, 1, 1);

  // 7. Corrugated Shipping Container
  const [cmC, cmCtx] = makeCanvas(512);
  cmCtx.fillStyle = '#d4d4d8';
  cmCtx.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 32) {
    cmCtx.fillStyle = 'rgba(0,0,0,0.24)';
    cmCtx.fillRect(x, 0, 12, 512);
    cmCtx.fillStyle = 'rgba(255,255,255,0.18)';
    cmCtx.fillRect(x + 12, 0, 6, 512);
  }
  cmCtx.strokeStyle = 'rgba(0,0,0,0.35)';
  cmCtx.lineWidth = 18;
  cmCtx.strokeRect(9, 9, 494, 494);
  addGrain(cmCtx, 512, 512, 14);
  const corrugatedMetal = configureTexture(cmC, maxAniso, 2, 1);

  // 8. Hazard Concrete Barrier
  const [hbC, hbCtx] = makeCanvas(512);
  hbCtx.fillStyle = '#9ca3af';
  hbCtx.fillRect(0, 0, 512, 512);
  hbCtx.save();
  hbCtx.beginPath();
  hbCtx.rect(0, 0, 512, 140);
  hbCtx.clip();
  hbCtx.fillStyle = '#eab308';
  hbCtx.fillRect(0, 0, 512, 140);
  hbCtx.fillStyle = '#18181b';
  for (let x = -256; x < 768; x += 64) {
    hbCtx.beginPath();
    hbCtx.moveTo(x, 0);
    hbCtx.lineTo(x + 32, 0);
    hbCtx.lineTo(x - 60, 140);
    hbCtx.lineTo(x - 92, 140);
    hbCtx.closePath();
    hbCtx.fill();
  }
  hbCtx.restore();
  addGrain(hbCtx, 512, 512, 22);
  const hazardBarrier = configureTexture(hbC, maxAniso, 1, 1);

  // 8b. Distant Skyscraper Windows (for Vertigo & City Horizons)
  const [sgC, sgCtx] = makeCanvas(256, 512);
  sgCtx.fillStyle = '#1e293b';
  sgCtx.fillRect(0, 0, 256, 512);
  for (let y = 16; y < 500; y += 28) {
    for (let x = 14; x < 240; x += 28) {
      const lit = Math.random() > 0.68;
      sgCtx.fillStyle = lit ? 'rgba(253, 230, 138, 0.72)' : 'rgba(56, 189, 248, 0.22)';
      sgCtx.fillRect(x, y, 18, 16);
    }
  }
  const skyscraperGlass = configureTexture(sgC, maxAniso, 1, 2);

  // 8c. Linear Surface Micro-Bump Map (NoColorSpace!)
  const [buC, buCtx] = makeCanvas(256);
  buCtx.fillStyle = '#808080';
  buCtx.fillRect(0, 0, 256, 256);
  addGrain(buCtx, 256, 256, 65);
  const surfaceBump = configureTexture(buC, maxAniso, 8, 8, false);

  // 9. Bomb Site Decals A & B
  const makeSiteDecal = (letter: string) => {
    const [dc, dctx] = makeCanvas(256);
    dctx.clearRect(0, 0, 256, 256);
    dctx.strokeStyle = 'rgba(220, 38, 38, 0.9)';
    dctx.lineWidth = 14;
    dctx.strokeRect(18, 18, 220, 220);
    dctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
    dctx.font = 'bold 148px sans-serif';
    dctx.textAlign = 'center';
    dctx.textBaseline = 'middle';
    dctx.fillText(letter, 128, 134);
    const tex = new THREE.CanvasTexture(dc);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  };
  const siteDecalA = makeSiteDecal('A');
  const siteDecalB = makeSiteDecal('B');

  // 10. Sky Dome Gradient Textures
  const skyWarmCanvas = makeSkyCanvas('#1e4d7b', '#5289b5', '#f2d09c', '#fff3c4', 280, 170);
  const skyWarm = configureTexture(skyWarmCanvas, maxAniso, 1, 1);
  skyWarm.wrapS = THREE.ClampToEdgeWrapping;
  skyWarm.wrapT = THREE.ClampToEdgeWrapping;

  const skyCoolCanvas = makeSkyCanvas('#1e3a5f', '#4e79a7', '#cbd9e6', '#ffffff', 720, 150);
  const skyCool = configureTexture(skyCoolCanvas, maxAniso, 1, 1);
  skyCool.wrapS = THREE.ClampToEdgeWrapping;
  skyCool.wrapT = THREE.ClampToEdgeWrapping;

  // 11. Volumetric Soft Smoke Puff Sprite Texture
  const [spC, spCtx] = makeCanvas(256);
  spCtx.clearRect(0, 0, 256, 256);
  const lobes = [
    { x: 128, y: 128, r: 96, a: 0.55 },
    { x: 96, y: 108, r: 68, a: 0.42 },
    { x: 158, y: 112, r: 66, a: 0.42 },
    { x: 118, y: 154, r: 70, a: 0.4 },
    { x: 146, y: 152, r: 60, a: 0.36 },
  ];
  for (const lb of lobes) {
    const g = spCtx.createRadialGradient(lb.x, lb.y, 4, lb.x, lb.y, lb.r);
    g.addColorStop(0, `rgba(240, 245, 250, ${lb.a})`);
    g.addColorStop(0.55, `rgba(205, 214, 224, ${lb.a * 0.55})`);
    g.addColorStop(1, 'rgba(180, 190, 200, 0)');
    spCtx.fillStyle = g;
    spCtx.beginPath();
    spCtx.arc(lb.x, lb.y, lb.r, 0, Math.PI * 2);
    spCtx.fill();
  }
  const smokePuff = configureTexture(spC, maxAniso, 1, 1);
  smokePuff.wrapS = THREE.ClampToEdgeWrapping;
  smokePuff.wrapT = THREE.ClampToEdgeWrapping;

  // 12. Wall Graffiti Sprays, Site Stencils & Tactical Posters
  const makeSprayTex = (drawFn: (ctx: CanvasRenderingContext2D) => void) => {
    const [c, ctx] = makeCanvas(512, 256);
    ctx.clearRect(0, 0, 512, 256);
    drawFn(ctx);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  };

  const drawSprayDrips = (ctx: CanvasRenderingContext2D, color: string, xStart: number, xEnd: number, yBase: number) => {
    ctx.fillStyle = color;
    for (let x = xStart; x < xEnd; x += 26) {
      const h = 10 + ((x * 17) % 34);
      ctx.fillRect(x, yBase, 4, h);
    }
  };

  // Spray 0: Iconic "GOOSE" mural stencil (for Dust II A-Site Goose & walls)
  const sprayGoose = makeSprayTex((ctx) => {
    const bg = ctx.createRadialGradient(256, 128, 20, 256, 128, 210);
    bg.addColorStop(0, 'rgba(185, 28, 28, 0.38)');
    bg.addColorStop(1, 'rgba(185, 28, 28, 0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = 'rgba(20, 20, 24, 0.88)';
    // Stylized goose neck & wings silhouette
    ctx.beginPath();
    ctx.moveTo(118, 172);
    ctx.quadraticCurveTo(148, 86, 188, 66);
    ctx.lineTo(222, 62);
    ctx.lineTo(202, 78);
    ctx.quadraticCurveTo(182, 118, 212, 134);
    ctx.lineTo(276, 108);
    ctx.lineTo(246, 152);
    ctx.lineTo(192, 174);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#dc2626';
    ctx.font = '900 72px Impact, sans-serif';
    ctx.fillText('GOOSE', 248, 168);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4;
    ctx.strokeText('GOOSE', 248, 168);
    drawSprayDrips(ctx, 'rgba(220, 38, 38, 0.78)', 255, 445, 170);
  });

  // Spray 1: Bomb Site A Direction Stencil ("SITE A ->")
  const spraySiteA = makeSprayTex((ctx) => {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.fillRect(28, 36, 456, 184);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.lineWidth = 8;
    ctx.strokeRect(32, 40, 448, 176);

    ctx.fillStyle = '#ef4444';
    ctx.font = '900 84px sans-serif';
    ctx.fillText('A  ➔', 110, 156);
    ctx.fillStyle = '#fef2f2';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('BOMB SITE', 112, 82);
    drawSprayDrips(ctx, 'rgba(239, 68, 68, 0.72)', 95, 390, 216);
  });

  // Spray 2: Bomb Site B Direction Stencil ("<- SITE B")
  const spraySiteB = makeSprayTex((ctx) => {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.fillRect(28, 36, 456, 184);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.92)';
    ctx.lineWidth = 8;
    ctx.strokeRect(32, 40, 448, 176);

    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 84px sans-serif';
    ctx.fillText('⬅  B', 112, 156);
    ctx.fillStyle = '#fffbeb';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('BOMB SITE', 238, 82);
    drawSprayDrips(ctx, 'rgba(245, 158, 11, 0.72)', 110, 410, 216);
  });

  // Spray 3: Tactical Street Crown & Crosshair Graffiti
  const sprayCrown = makeSprayTex((ctx) => {
    const glow = ctx.createRadialGradient(256, 128, 18, 256, 128, 195);
    glow.addColorStop(0, 'rgba(14, 165, 233, 0.45)');
    glow.addColorStop(0.6, 'rgba(245, 158, 11, 0.25)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 512, 256);

    // Crown polygon
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(146, 162);
    ctx.lineTo(130, 76);
    ctx.lineTo(202, 118);
    ctx.lineTo(256, 48);
    ctx.lineTo(310, 118);
    ctx.lineTo(382, 76);
    ctx.lineTo(366, 162);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 44px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STRIKEFRONT', 256, 212);
    drawSprayDrips(ctx, 'rgba(56, 189, 248, 0.8)', 140, 380, 214);
  });

  // Spray 4: Viper / Desert Wolf Street Art
  const sprayViper = makeSprayTex((ctx) => {
    const glow = ctx.createRadialGradient(256, 128, 12, 256, 128, 190);
    glow.addColorStop(0, 'rgba(249, 115, 22, 0.45)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = 'rgba(17, 24, 39, 0.88)';
    ctx.beginPath();
    ctx.moveTo(256, 36);
    ctx.lineTo(344, 108);
    ctx.lineTo(308, 212);
    ctx.lineTo(256, 188);
    ctx.lineTo(204, 212);
    ctx.lineTo(168, 108);
    ctx.closePath();
    ctx.fill();

    // Glowing eyes & fangs
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(208, 112);
    ctx.lineTo(242, 126);
    ctx.lineTo(214, 134);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(304, 112);
    ctx.lineTo(270, 126);
    ctx.lineTo(298, 134);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ALPHA // 02', 256, 242);
  });

  // Spray 5: Industrial Hazard Sector Poster
  const sprayWarning = makeSprayTex((ctx) => {
    ctx.fillStyle = 'rgba(24, 24, 27, 0.86)';
    ctx.fillRect(42, 30, 428, 196);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(42, 30, 428, 38);
    ctx.fillStyle = '#18181b';
    ctx.font = '900 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ SECTOR 02 // ACTIVE ZONE', 256, 58);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 52px Impact, sans-serif';
    ctx.fillText('NO ENTRY', 256, 146);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('AUTHORISED TACTICAL OPS ONLY', 256, 194);
  });

  const wallSprays = [sprayGoose, spraySiteA, spraySiteB, sprayCrown, sprayViper, sprayWarning];

  return {
    sandstoneFloor,
    sandstoneWall,
    desertCobbleFloor,
    woodenDoor,
    barrelMetal,
    concreteFloor,
    concreteWall,
    rooftopFloor,
    woodCrate,
    corrugatedMetal,
    hazardBarrier,
    skyscraperGlass,
    surfaceBump,
    siteDecalA,
    siteDecalB,
    skyWarm,
    skyCool,
    smokePuff,
    wallSprays,
    dispose: () => {
      sandstoneFloor.dispose();
      sandstoneWall.dispose();
      desertCobbleFloor.dispose();
      woodenDoor.dispose();
      barrelMetal.dispose();
      concreteFloor.dispose();
      concreteWall.dispose();
      rooftopFloor.dispose();
      woodCrate.dispose();
      corrugatedMetal.dispose();
      hazardBarrier.dispose();
      skyscraperGlass.dispose();
      surfaceBump.dispose();
      siteDecalA.dispose();
      siteDecalB.dispose();
      skyWarm.dispose();
      skyCool.dispose();
      smokePuff.dispose();
      wallSprays.forEach((s) => s.dispose());
    },
  };
}
