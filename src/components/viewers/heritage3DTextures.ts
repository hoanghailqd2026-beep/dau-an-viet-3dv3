import * as THREE from 'three';

export interface ProceduralTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

const textureSetCache: Record<string, ProceduralTextureSet> = {};
let cachedContactShadowTex: THREE.CanvasTexture | null = null;

function makeSeededRandom(seedInit: number): () => number {
  let seed = seedInit;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function finalizeTextureSet(
  key: string,
  colorCanvas: HTMLCanvasElement,
  bumpCanvas: HTMLCanvasElement,
  roughCanvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1
): ProceduralTextureSet {
  const configureTex = (canvas: HTMLCanvasElement, isSrgb: boolean) => {
    const tex = new THREE.CanvasTexture(canvas);
    if (isSrgb) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 8;
    tex.userData = { isCached: true };
    return tex;
  };

  const set: ProceduralTextureSet = {
    map: configureTex(colorCanvas, true),
    bumpMap: configureTex(bumpCanvas, false),
    roughnessMap: configureTex(roughCanvas, false),
  };
  textureSetCache[key] = set;
  return set;
}

function createTripleCanvas(size = 512): {
  c: HTMLCanvasElement;
  b: HTMLCanvasElement;
  r: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  bCtx: CanvasRenderingContext2D;
  rCtx: CanvasRenderingContext2D;
} {
  const c = document.createElement('canvas');
  const b = document.createElement('canvas');
  const r = document.createElement('canvas');
  c.width = b.width = r.width = size;
  c.height = b.height = r.height = size;
  return {
    c,
    b,
    r,
    ctx: c.getContext('2d')!,
    bCtx: b.getContext('2d')!,
    rCtx: r.getContext('2d')!,
  };
}

/**
 * Soft radial contact-shadow texture so columns, trees, stupas & boats never look floating
 */
export function getContactShadowTexture(): THREE.CanvasTexture {
  if (cachedContactShadowTex) return cachedContactShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.32)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.userData = { isCached: true };
  cachedContactShadowTex = tex;
  return tex;
}

/**
 * 1. Gạch tàu lát sân cổ truyền Nam Bộ (#92402b, rêu phong & ron vữa)
 */
export function getTerracottaCourtyardTex(repeatX = 6, repeatY = 6): ProceduralTextureSet {
  const key = `terracotta_yard_${repeatX}_${repeatY}`;
  if (textureSetCache[key]) return textureSetCache[key];

  const { c, b, r, ctx, bCtx, rCtx } = createTripleCanvas(512);
  const rand = makeSeededRandom(8001);

  ctx.fillStyle = '#753322';
  ctx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#404040';
  bCtx.fillRect(0, 0, 512, 512);
  rCtx.fillStyle = '#dcdcdc';
  rCtx.fillRect(0, 0, 512, 512);

  const tile = 64;
  for (let y = 0; y < 512; y += tile) {
    for (let x = 0; x < 512; x += tile) {
      const shade = Math.floor((rand() - 0.5) * 26);
      ctx.fillStyle = `rgb(${150 + shade}, ${68 + Math.floor(shade * 0.5)}, ${44 + Math.floor(shade * 0.4)})`;
      ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);

      const bVal = 152 + Math.floor((rand() - 0.5) * 18);
      bCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
      bCtx.fillRect(x + 2, y + 2, tile - 4, tile - 4);

      const rVal = 195 + Math.floor((rand() - 0.5) * 30);
      rCtx.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
      rCtx.fillRect(x + 2, y + 2, tile - 4, tile - 4);

      // Subtle terracotta bevel highlight
      ctx.strokeStyle = 'rgba(220, 145, 110, 0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3, y + 3, tile - 6, tile - 6);

      if (rand() > 0.68) {
        ctx.fillStyle = 'rgba(65, 90, 44, 0.28)';
        ctx.beginPath();
        ctx.arc(x + rand() * tile, y + rand() * tile, 5 + rand() * 9, 0, Math.PI * 2);
        ctx.fill();
        rCtx.fillStyle = '#eeeeee';
        rCtx.beginPath();
        rCtx.arc(x + rand() * tile, y + rand() * tile, 5 + rand() * 8, 0, Math.PI * 2);
        rCtx.fill();
      }
      ctx.strokeStyle = 'rgba(32, 22, 18, 0.62)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, tile, tile);
      bCtx.strokeStyle = '#2a2a2a';
      bCtx.lineWidth = 3;
      bCtx.strokeRect(x, y, tile, tile);
    }
  }

  return finalizeTextureSet(key, c, b, r, repeatX, repeatY);
}

/**
 * 2. Bộ vân Ngói Âm Dương, Ngói Lưu Ly Xanh Ngọc Bích & Ngói Đỏ Marseille (kèm bumpMap + roughnessMap)
 */
export function getYinYangTileTex(
  variant: 'aged_terracotta' | 'turquoise_glaze' | 'marseille_red',
  repeatX = 5,
  repeatY = 4
): ProceduralTextureSet {
  const key = `roof_${variant}_${repeatX}_${repeatY}`;
  if (textureSetCache[key]) return textureSetCache[key];

  const { c, b, r, ctx, bCtx, rCtx } = createTripleCanvas(512);
  const rand = makeSeededRandom(variant === 'turquoise_glaze' ? 9121 : variant === 'marseille_red' ? 7731 : 6613);

  ctx.fillStyle =
    variant === 'turquoise_glaze' ? '#0d5e5c' : variant === 'marseille_red' ? '#9e3826' : '#5e3226';
  ctx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#707070';
  bCtx.fillRect(0, 0, 512, 512);
  rCtx.fillStyle = variant === 'turquoise_glaze' ? '#4a4a4a' : variant === 'marseille_red' ? '#9e9e9e' : '#c8c8c8';
  rCtx.fillRect(0, 0, 512, 512);

  if (variant === 'marseille_red') {
    // Classic French interlocking ribbed Marseille terracotta tiles
    const cols = 12;
    const colW = 512 / cols;
    const rowH = 42.66;
    for (let y = 0; y < 512; y += rowH) {
      for (let i = 0; i < cols; i++) {
        const x = i * colW;
        const g = ctx.createLinearGradient(x, 0, x + colW, 0);
        const shift = (rand() - 0.5) * 14;
        g.addColorStop(0, `rgb(${120 + shift}, 40, 26)`);
        g.addColorStop(0.32, `rgb(${192 + shift}, 72, 48)`);
        g.addColorStop(0.55, `rgb(${164 + shift}, 58, 38)`);
        g.addColorStop(0.82, `rgb(${205 + shift}, 82, 54)`);
        g.addColorStop(1, `rgb(${112 + shift}, 36, 24)`);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, colW, rowH);

        const bg = bCtx.createLinearGradient(x, 0, x + colW, 0);
        bg.addColorStop(0, '#363636');
        bg.addColorStop(0.35, '#d6d6d6');
        bg.addColorStop(0.55, '#868686');
        bg.addColorStop(0.82, '#e5e5e5');
        bg.addColorStop(1, '#323232');
        bCtx.fillStyle = bg;
        bCtx.fillRect(x, y, colW, rowH);

        const rg = rCtx.createLinearGradient(x, 0, x + colW, 0);
        rg.addColorStop(0, '#c8c8c8');
        rg.addColorStop(0.5, '#969696');
        rg.addColorStop(1, '#c8c8c8');
        rCtx.fillStyle = rg;
        rCtx.fillRect(x, y, colW, rowH);
      }
      ctx.fillStyle = 'rgba(38, 12, 8, 0.44)';
      ctx.fillRect(0, y + rowH - 4, 512, 4);
      bCtx.fillStyle = '#202020';
      bCtx.fillRect(0, y + rowH - 4, 512, 4);
    }
  } else {
    // Vietnamese Yin-Yang tiles & Teochew Turquoise Glazed Pipe Tiles
    const cols = 16;
    const colW = 512 / cols;
    const rowH = 32;

    for (let i = 0; i < cols; i++) {
      const x = i * colW;
      const g = ctx.createLinearGradient(x, 0, x + colW, 0);
      if (variant === 'turquoise_glaze') {
        g.addColorStop(0, '#074040');
        g.addColorStop(0.28, '#137d79');
        g.addColorStop(0.5, '#27b8b0');
        g.addColorStop(0.75, '#117470');
        g.addColorStop(1, '#063738');
      } else {
        const mossShift = rand() > 0.7 ? 12 : 0;
        g.addColorStop(0, '#3f221b');
        g.addColorStop(0.3, `rgb(${98 + mossShift}, ${54 + mossShift}, 40)`);
        g.addColorStop(0.5, `rgb(${132 + mossShift}, ${74 + mossShift}, 54)`);
        g.addColorStop(0.75, '#6c3b2c');
        g.addColorStop(1, '#381e18');
      }
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, colW, 512);

      const bg = bCtx.createLinearGradient(x, 0, x + colW, 0);
      bg.addColorStop(0, '#2a2a2a');
      bg.addColorStop(0.5, '#eaeaea');
      bg.addColorStop(1, '#2a2a2a');
      bCtx.fillStyle = bg;
      bCtx.fillRect(x, 0, colW, 512);

      const rg = rCtx.createLinearGradient(x, 0, x + colW, 0);
      if (variant === 'turquoise_glaze') {
        rg.addColorStop(0, '#787878');
        rg.addColorStop(0.5, '#343434');
        rg.addColorStop(1, '#787878');
      } else {
        rg.addColorStop(0, '#dadada');
        rg.addColorStop(0.5, '#a8a8a8');
        rg.addColorStop(1, '#dadada');
      }
      rCtx.fillStyle = rg;
      rCtx.fillRect(x, 0, colW, 512);
    }

    for (let y = 0; y < 512; y += rowH) {
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.fillRect(0, y, 512, 3.5);
      bCtx.fillStyle = '#202020';
      bCtx.fillRect(0, y, 512, 3.5);

      // Scalloped tile overlap lip
      for (let i = 0; i < cols; i++) {
        ctx.strokeStyle =
          variant === 'turquoise_glaze' ? 'rgba(180, 250, 240, 0.25)' : 'rgba(210, 155, 130, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(i * colW + colW * 0.5, y + 3, colW * 0.42, 0, Math.PI);
        ctx.stroke();
      }
    }

    if (variant === 'aged_terracotta') {
      for (let m = 0; m < 190; m++) {
        const mx = rand() * 512;
        const my = rand() * 512;
        const mr = 4 + rand() * 14;
        ctx.fillStyle = `rgba(68, 96, 42, ${0.14 + rand() * 0.26})`;
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.fill();
        rCtx.fillStyle = '#f2f2f2';
        rCtx.beginPath();
        rCtx.arc(mx, my, mr * 0.85, 0, Math.PI * 2);
        rCtx.fill();
      }
    }
  }

  return finalizeTextureSet(key, c, b, r, repeatX, repeatY);
}

/**
 * 3. Tường vôi vàng cổ & Đá ong / Tường trắng ngà Pháp / Tường gạch cổ Triều Châu
 */
export function getTraditionalWallTex(
  variant: 'yellow_temple' | 'white_villa' | 'aged_brick_wall',
  repeatX = 3,
  repeatY = 2
): ProceduralTextureSet {
  const key = `wall_${variant}_${repeatX}_${repeatY}`;
  if (textureSetCache[key]) return textureSetCache[key];

  const { c, b, r, ctx, bCtx, rCtx } = createTripleCanvas(512);
  const rand = makeSeededRandom(variant === 'white_villa' ? 5112 : variant === 'aged_brick_wall' ? 6231 : 4118);

  ctx.fillStyle =
    variant === 'white_villa' ? '#f5f2eb' : variant === 'yellow_temple' ? '#d9b875' : '#964732';
  ctx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);
  rCtx.fillStyle = variant === 'white_villa' ? '#b8b8b8' : '#d8d8d8';
  rCtx.fillRect(0, 0, 512, 512);

  if (variant === 'aged_brick_wall') {
    const bw = 64;
    const bh = 28;
    for (let row = 0; row < 512 / bh + 1; row++) {
      const y = row * bh;
      const offset = (row % 2) * (bw / 2);
      for (let x = -bw; x < 512 + bw; x += bw) {
        const bx = x + offset;
        const delta = Math.floor((rand() - 0.5) * 26);
        ctx.fillStyle = `rgb(${152 + delta}, ${72 + Math.floor(delta * 0.45)}, ${50 + Math.floor(delta * 0.35)})`;
        ctx.fillRect(bx + 2, y + 2, bw - 4, bh - 4);
        bCtx.fillStyle = `rgb(${148 + delta}, ${148 + delta}, ${148 + delta})`;
        bCtx.fillRect(bx + 2, y + 2, bw - 4, bh - 4);
        ctx.strokeStyle = 'rgba(218, 202, 182, 0.42)';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, y, bw, bh);
        bCtx.strokeStyle = '#3c3c3c';
        bCtx.lineWidth = 2;
        bCtx.strokeRect(bx, y, bw, bh);
      }
    }
  } else {
    for (let i = 0; i < 7200; i++) {
      const rx = rand() * 512;
      const ry = rand() * 512;
      const sz = 1 + rand() * 2.8;
      ctx.fillStyle =
        variant === 'white_villa'
          ? i % 2 === 0
            ? 'rgba(214, 206, 192, 0.22)'
            : 'rgba(255, 255, 255, 0.26)'
          : i % 3 === 0
          ? 'rgba(138, 96, 36, 0.18)'
          : i % 3 === 1
          ? 'rgba(246, 224, 168, 0.16)'
          : 'rgba(92, 74, 48, 0.12)';
      ctx.fillRect(rx, ry, sz, sz);
      bCtx.fillStyle = i % 2 === 0 ? '#6e6e6e' : '#949494';
      bCtx.fillRect(rx, ry, sz, sz);
      rCtx.fillStyle = i % 2 === 0 ? '#c4c4c4' : '#e6e6e6';
      rCtx.fillRect(rx, ry, sz, sz);
    }

    if (variant === 'yellow_temple') {
      // Laterite base & weathered lower-wall moss gradient
      const pat = ctx.createLinearGradient(0, 410, 0, 512);
      pat.addColorStop(0, 'rgba(72, 86, 48, 0.0)');
      pat.addColorStop(1, 'rgba(64, 78, 42, 0.28)');
      ctx.fillStyle = pat;
      ctx.fillRect(0, 410, 512, 102);

      // Subtle laterite pores near base
      for (let p = 0; p < 160; p++) {
        const px = rand() * 512;
        const py = 440 + rand() * 70;
        const pr = 1.5 + rand() * 3.5;
        ctx.fillStyle = 'rgba(76, 46, 28, 0.34)';
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        bCtx.fillStyle = '#363636';
        bCtx.beginPath();
        bCtx.arc(px, py, pr, 0, Math.PI * 2);
        bCtx.fill();
      }
    }
  }

  return finalizeTextureSet(key, c, b, r, repeatX, repeatY);
}

/**
 * 4. Gỗ quý căm xe / gõ đỏ (#4A2511) & Gỗ sơn son thếp vàng chạm khắc
 */
export function getTimberGrainTex(
  variant: 'cam_xe' | 'gilded_lacquer' | 'weathered_wood',
  repeatX = 2,
  repeatY = 2
): ProceduralTextureSet {
  const key = `wood_${variant}_${repeatX}_${repeatY}`;
  if (textureSetCache[key]) return textureSetCache[key];

  const { c, b, r, ctx, bCtx, rCtx } = createTripleCanvas(512);
  const rand = makeSeededRandom(variant === 'gilded_lacquer' ? 3091 : variant === 'weathered_wood' ? 1923 : 2047);

  ctx.fillStyle =
    variant === 'gilded_lacquer' ? '#8b1913' : variant === 'weathered_wood' ? '#5c412d' : '#4a2511';
  ctx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);
  rCtx.fillStyle = variant === 'gilded_lacquer' ? '#707070' : variant === 'weathered_wood' ? '#c8c8c8' : '#787878';
  rCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 210; i++) {
    const x = rand() * 512;
    const w = 1 + rand() * 3.8;
    ctx.fillStyle =
      variant === 'gilded_lacquer'
        ? i % 5 === 0
          ? 'rgba(226, 180, 68, 0.34)'
          : 'rgba(65, 10, 8, 0.25)'
        : i % 2 === 0
        ? 'rgba(28, 12, 5, 0.32)'
        : 'rgba(128, 70, 38, 0.18)';
    ctx.fillRect(x, 0, w, 512);
    bCtx.fillStyle = i % 2 === 0 ? '#626262' : '#9c9c9c';
    bCtx.fillRect(x, 0, w, 512);
  }

  if (variant === 'gilded_lacquer') {
    // Gilded carved scrollwork medallions
    ctx.strokeStyle = 'rgba(235, 190, 76, 0.45)';
    bCtx.strokeStyle = '#d4d4d4';
    rCtx.strokeStyle = '#383838';
    ctx.lineWidth = 2.5;
    bCtx.lineWidth = 2.5;
    rCtx.lineWidth = 3;
    for (let gy = 64; gy < 512; gy += 128) {
      for (let gx = 64; gx < 512; gx += 128) {
        ctx.beginPath();
        ctx.arc(gx, gy, 32, 0, Math.PI * 2);
        ctx.stroke();
        bCtx.beginPath();
        bCtx.arc(gx, gy, 32, 0, Math.PI * 2);
        bCtx.stroke();
        rCtx.beginPath();
        rCtx.arc(gx, gy, 32, 0, Math.PI * 2);
        rCtx.stroke();
      }
    }
  }

  return finalizeTextureSet(key, c, b, r, repeatX, repeatY);
}

/**
 * 5. Địa tầng đất đỏ Bazan (#6E3B26, #8C5238, #4A2B1D) & Cát khảo cổ Giồng Cá Vồ
 */
export function getStratifiedEarthTex(
  variant: 'coastal_sand_peat' | 'red_basalt_clay',
  repeatX = 2,
  repeatY = 1
): ProceduralTextureSet {
  const key = `earth_${variant}_${repeatX}_${repeatY}`;
  if (textureSetCache[key]) return textureSetCache[key];

  const { c, b, r, ctx, bCtx, rCtx } = createTripleCanvas(512);
  const rand = makeSeededRandom(variant === 'coastal_sand_peat' ? 1409 : 2503);

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  if (variant === 'coastal_sand_peat') {
    grad.addColorStop(0.0, '#c7ab80');
    grad.addColorStop(0.28, '#9b7b4e');
    grad.addColorStop(0.62, '#624b33');
    grad.addColorStop(1.0, '#36322d');
  } else {
    grad.addColorStop(0.0, '#4f4024');
    grad.addColorStop(0.18, '#8c5238');
    grad.addColorStop(0.56, '#6e3b26');
    grad.addColorStop(1.0, '#4a2b1d');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);
  rCtx.fillStyle = '#e8e8e8';
  rCtx.fillRect(0, 0, 512, 512);

  for (let band = 0; band < 28; band++) {
    const baseY = (band / 28) * 512;
    ctx.beginPath();
    bCtx.beginPath();
    ctx.moveTo(0, baseY);
    bCtx.moveTo(0, baseY);
    for (let x = 0; x <= 512; x += 32) {
      const yOff = baseY + Math.sin(x * 0.025 + band) * 5 + (rand() - 0.5) * 3;
      ctx.lineTo(x, yOff);
      bCtx.lineTo(x, yOff);
    }
    ctx.lineWidth = 2 + rand() * 4;
    ctx.strokeStyle = variant === 'coastal_sand_peat' ? 'rgba(42, 34, 24, 0.28)' : 'rgba(56, 20, 10, 0.34)';
    ctx.stroke();
    bCtx.lineWidth = 2.5;
    bCtx.strokeStyle = band % 2 === 0 ? '#555555' : '#a2a2a2';
    bCtx.stroke();
  }

  for (let i = 0; i < 6500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const sz = 1 + rand() * 2.5;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.18)' : 'rgba(255,235,205,0.13)';
    ctx.fillRect(x, y, sz, sz);
    bCtx.fillStyle = i % 2 === 0 ? '#4e4e4e' : '#b8b8b8';
    bCtx.fillRect(x, y, sz, sz);
  }

  return finalizeTextureSet(key, c, b, r, repeatX, repeatY);
}

/**
 * Helper đăng ký Mesh vào hệ thống bóc tách (Exploded View), X-Ray & Nội thất
 */
export function registerMeshNode(
  group: THREE.Group,
  mesh: THREE.Mesh,
  tier: number,
  isGround = false,
  options?: {
    isInterior?: boolean;
    noShadow?: boolean;
    hideOnReveal?: boolean;
    isExteriorShell?: boolean;
    isRoofShell?: boolean;
  }
): THREE.Mesh {
  const isInterior = Boolean(options?.isInterior);
  const noShadow = Boolean(options?.noShadow);
  mesh.castShadow = !isGround && !noShadow;
  mesh.receiveShadow = true;
  mesh.userData.elevationTier = tier;
  mesh.userData.origY = mesh.position.y;
  if (isGround) {
    mesh.userData.isGround = true;
  }
  if (isInterior) {
    mesh.userData.isInterior = true;
  }
  if (options?.hideOnReveal) {
    mesh.userData.hideOnReveal = true;
    mesh.userData.isExteriorShell = true;
  }
  if (options?.isExteriorShell) {
    mesh.userData.isExteriorShell = true;
  }
  if (options?.isRoofShell) {
    mesh.userData.isRoofShell = true;
  }

  const m = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
  if (m) {
    mesh.userData.origColor = m.color ? m.color.getHex() : 0xffffff;
    mesh.userData.originalMaterial = {
      color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
      emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0x000000),
      emissiveIntensity: m.emissiveIntensity ?? 0,
      opacity: m.opacity !== undefined ? m.opacity : 1.0,
      transparent: m.transparent ?? false,
      wireframe: false,
      depthWrite: m.depthWrite !== undefined ? m.depthWrite : true,
      map: m.map || null,
      bumpMap: m.bumpMap || null,
      bumpScale: m.bumpScale ?? 0.05,
      roughnessMap: m.roughnessMap || null,
      roughness: m.roughness ?? 0.7,
      metalness: m.metalness ?? 0.05,
    };
  }
  group.add(mesh);
  return mesh;
}

export function addBoxPart(
  group: THREE.Group,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  tier: number,
  isGround = false,
  options?: {
    isInterior?: boolean;
    noShadow?: boolean;
    hideOnReveal?: boolean;
    isExteriorShell?: boolean;
    isRoofShell?: boolean;
  }
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return registerMeshNode(group, m, tier, isGround, options);
}

/**
 * Contact Shadow pad (Ambient Occlusion decal) grounding columns, trees, stupas & structures
 */
export function buildContactShadowPad(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  radiusX: number,
  radiusZ: number,
  tier = 0,
  opacity = 0.44
): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const geo = new THREE.PlaneGeometry(radiusX * 2, radiusZ * 2);
  geo.rotateX(-Math.PI / 2);
  const pad = new THREE.Mesh(geo, mat);
  pad.position.set(x, y + 0.025, z);
  pad.userData.isGround = true;
  pad.userData.elevationTier = tier;
  pad.userData.origY = pad.position.y;
  pad.castShadow = false;
  pad.receiveShadow = false;
  group.add(pad);
  return pad;
}

export function addInteriorWarmLight(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  tier: number,
  intensity = 2.0,
  distance = 11,
  colorHex = 0xffad42
): THREE.PointLight {
  const pt = new THREE.PointLight(colorHex, intensity, distance);
  pt.position.set(x, y, z);
  pt.userData.elevationTier = tier;
  pt.userData.origY = y;
  group.add(pt);
  return pt;
}

/**
 * Cột gỗ tiện tròn có chân tảng đá xanh chạm hoa sen & đấu củng đỉnh cột
 */
export function buildTurnedPillarWithPlinth(
  group: THREE.Group,
  x: number,
  baseY: number,
  z: number,
  height: number,
  radius: number,
  woodMat: THREE.Material,
  plinthMat: THREE.Material,
  tier: number,
  isInterior = false
) {
  const plinthH = 0.24;
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.45, radius * 1.85, plinthH, 8),
    plinthMat
  );
  plinth.position.set(x, baseY + plinthH / 2, z);
  registerMeshNode(group, plinth, Math.max(0.2, tier - 0.3), false, { isInterior });

  const colH = Math.max(0.4, height - plinthH);
  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.88, radius * 1.04, colH, 12),
    woodMat
  );
  col.position.set(x, baseY + plinthH + colH / 2, z);
  registerMeshNode(group, col, tier, false, { isInterior });

  // Đầu đấu củng đỡ kèo
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 2.5, 0.14, radius * 2.5),
    woodMat
  );
  cap.position.set(x, baseY + height - 0.04, z);
  registerMeshNode(group, cap, tier, false, { isInterior });
}

/**
 * Tường hành lang vòm cuốn Tân Cổ Điển (dùng ExtrudeGeometry với absarc cắt vòm bán nguyệt thật)
 */
export function buildFrenchArchedArcadeWall(
  group: THREE.Group,
  cx: number,
  baseY: number,
  cz: number,
  totalWidth: number,
  wallHeight: number,
  thickness: number,
  archCount: number,
  archWidth: number,
  archSpringY: number,
  wallMat: THREE.Material,
  trimMat: THREE.Material,
  shutterMat: THREE.Material | null,
  tier: number
) {
  const shape = new THREE.Shape();
  const hw = totalWidth / 2;
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, wallHeight);
  shape.lineTo(-hw, wallHeight);
  shape.closePath();

  const archRadius = archWidth / 2;
  const spacing = totalWidth / archCount;

  for (let i = 0; i < archCount; i++) {
    const ax = -hw + spacing * (i + 0.5);
    const hole = new THREE.Path();
    hole.moveTo(ax - archRadius, 0.18);
    hole.lineTo(ax - archRadius, archSpringY);
    hole.absarc(ax, archSpringY, archRadius, Math.PI, 0, true);
    hole.lineTo(ax + archRadius, 0.18);
    hole.closePath();
    shape.holes.push(hole);

    // Arch keystone & molded ring accent
    const archTrim = new THREE.Mesh(
      new THREE.TorusGeometry(archRadius + 0.06, 0.07, 8, 16, Math.PI),
      trimMat
    );
    archTrim.position.set(ax, baseY + archSpringY, cz + thickness / 2 + 0.04);
    registerMeshNode(group, archTrim, tier);

    // Optional interior shutter frame recessed slightly behind arcade
    if (shutterMat) {
      addBoxPart(
        group,
        archWidth * 0.78,
        archSpringY * 0.92,
        0.1,
        shutterMat,
        ax,
        baseY + archSpringY * 0.52,
        cz - 0.18,
        tier,
        false,
        { isInterior: true }
      );
    }
  }

  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 0.03,
    bevelThickness: 0.03,
    bevelSegments: 2,
    curveSegments: 14,
  });
  extrudeGeo.translate(0, 0, -thickness / 2);

  const wallMesh = new THREE.Mesh(extrudeGeo, wallMat);
  wallMesh.position.set(cx, baseY, cz);
  registerMeshNode(group, wallMesh, tier);
}

/**
 * Tạo hình mái ngói truyền thống Việt Nam võng cong 4 mái (concave curved slope + sweeping đầu đao + Lưỡng long chầu nguyệt)
 */
function buildCurvedRoofShellGeometry(width: number, depth: number, height: number, sagAmount: number): THREE.BufferGeometry {
  const hw = width / 2;
  const hd = depth / 2;
  const ridgeHalf = Math.max(0.5, (width - depth * 0.68) * 0.5);
  const segU = 10;
  const segV = 8;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const evalSlopePoint = (side: 'front' | 'back' | 'left' | 'right', u: number, v: number): THREE.Vector3 => {
    // v = 0 (eave) -> 1 (ridge); concave curve (sag) makes Vietnamese roof curve upward gracefully at eaves
    const curveFactor = Math.pow(v, 1.45);
    const eaveLift = (1 - v) * sagAmount * Math.pow(Math.abs(u * 2 - 1), 2.1);
    const y = curveFactor * height + eaveLift;

    if (side === 'front' || side === 'back') {
      const sgn = side === 'front' ? 1 : -1;
      const xEave = THREE.MathUtils.lerp(-hw, hw, u);
      const xRidge = THREE.MathUtils.lerp(-ridgeHalf, ridgeHalf, u);
      const x = THREE.MathUtils.lerp(xEave, xRidge, v);
      const z = sgn * THREE.MathUtils.lerp(hd, 0.08, v);
      return new THREE.Vector3(x, y, z);
    } else {
      const sgn = side === 'right' ? 1 : -1;
      const zEave = THREE.MathUtils.lerp(-hd, hd, u);
      const zRidge = 0;
      const z = THREE.MathUtils.lerp(zEave, zRidge, v);
      const x = sgn * THREE.MathUtils.lerp(hw, ridgeHalf, v);
      return new THREE.Vector3(x, y, z);
    }
  };

  const sides: Array<'front' | 'back' | 'left' | 'right'> = ['front', 'back', 'left', 'right'];
  let vertOffset = 0;

  for (const side of sides) {
    for (let iv = 0; iv <= segV; iv++) {
      const v = iv / segV;
      for (let iu = 0; iu <= segU; iu++) {
        const u = iu / segU;
        const pt = evalSlopePoint(side, u, v);
        positions.push(pt.x, pt.y, pt.z);
        uvs.push(u * 2, v * 1.4);
      }
    }
    const stride = segU + 1;
    for (let iv = 0; iv < segV; iv++) {
      for (let iu = 0; iu < segU; iu++) {
        const a = vertOffset + iv * stride + iu;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        if (side === 'front' || side === 'left') {
          indices.push(a, b, d, a, d, c);
        } else {
          indices.push(a, d, b, a, c, d);
        }
      }
    }
    vertOffset += (segV + 1) * (segU + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildTraditionalTieredRoof(
  group: THREE.Group,
  cx: number,
  eaveY: number,
  cz: number,
  width: number,
  depth: number,
  height: number,
  roofMat: THREE.Material,
  ridgeMat: THREE.Material,
  goldTrimMat: THREE.Material,
  tier: number,
  withRidgeBeasts = false,
  sagAmount = 0.28
) {
  // Mái ngói cong 4 mái thực thụ với mặt cong võng đặc trưng đình chùa Việt
  const roofGeo = buildCurvedRoofShellGeometry(width, depth, height, sagAmount);
  const doubleMat = roofMat.clone();
  doubleMat.side = THREE.DoubleSide;
  const roofMesh = new THREE.Mesh(roofGeo, doubleMat);
  roofMesh.position.set(cx, eaveY, cz);
  registerMeshNode(group, roofMesh, tier);

  // Hệ xà gỗ / con sơn lộ dưới diềm mái (tạo chiều sâu kiến trúc)
  const riegelMat = new THREE.MeshStandardMaterial({ color: 0x4b2916, roughness: 0.6 });
  const bracketCount = Math.max(3, Math.floor(width / 3.4));
  for (let b = 0; b < bracketCount; b++) {
    const bx = cx - width * 0.42 + (b / Math.max(1, bracketCount - 1)) * (width * 0.84);
    addBoxPart(group, 0.16, 0.18, depth * 0.92, riegelMat, bx, eaveY - 0.06, cz, tier);
  }

  // Bờ nóc chính ở đỉnh mái
  const ridgeLen = Math.max(1.2, width - depth * 0.65);
  addBoxPart(group, ridgeLen, 0.28, 0.3, ridgeMat, cx, eaveY + height + 0.08, cz, tier);
  addBoxPart(group, ridgeLen + 0.18, 0.09, 0.36, goldTrimMat, cx, eaveY + height + 0.24, cz, tier);

  // 4 Bờ quyết uốn cong vút lên thành đầu đao (dùng TubeGeometry theo CatmullRomCurve3)
  const ridgeHalf = Math.max(0.5, (width - depth * 0.68) * 0.5);
  const corners = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  for (const [sx, sz] of corners) {
    const p0 = new THREE.Vector3(sx * ridgeHalf, height + 0.08, 0);
    const p1 = new THREE.Vector3(sx * (width * 0.36), height * 0.44, sz * (depth * 0.28));
    const p2 = new THREE.Vector3(sx * (width * 0.5), sagAmount * 0.95, sz * (depth * 0.5));
    const p3 = new THREE.Vector3(sx * (width * 0.53), sagAmount + 0.42, sz * (depth * 0.53));
    const hipCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
    const hipGeo = new THREE.TubeGeometry(hipCurve, 14, 0.085, 6, false);
    const hipMesh = new THREE.Mesh(hipGeo, ridgeMat);
    hipMesh.position.set(cx, eaveY, cz);
    registerMeshNode(group, hipMesh, tier);

    // Đầu đao vàng đồng cong vút
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 6), goldTrimMat);
    tip.position.set(cx + p3.x, eaveY + p3.y + 0.1, cz + p3.z);
    tip.rotation.z = sx > 0 ? -0.45 : 0.45;
    tip.rotation.x = sz > 0 ? 0.45 : -0.45;
    registerMeshNode(group, tip, tier);
  }

  // Hai Lưỡng Long Chầu Nguyệt uốn lượn bằng TubeGeometry trên bờ nóc
  if (withRidgeBeasts) {
    const sunOrb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), goldTrimMat);
    sunOrb.position.set(cx, eaveY + height + 0.52, cz);
    registerMeshNode(group, sunOrb, tier);

    const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 8, 18), goldTrimMat);
    haloRing.position.set(cx, eaveY + height + 0.52, cz);
    registerMeshNode(group, haloRing, tier);

    for (const side of [-1, 1]) {
      const dragonCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.48, eaveY + height + 0.55, cz),
        new THREE.Vector3(side * (ridgeLen * 0.18), eaveY + height + 0.36, cz),
        new THREE.Vector3(side * (ridgeLen * 0.32), eaveY + height + 0.62, cz),
        new THREE.Vector3(side * (ridgeLen * 0.46), eaveY + height + 0.28, cz),
      ]);
      const dBody = new THREE.Mesh(new THREE.TubeGeometry(dragonCurve, 16, 0.09, 7, false), goldTrimMat);
      dBody.position.x = cx;
      registerMeshNode(group, dBody, tier);
    }
  }
}

/**
 * Cây nhiệt đới / hoa sứ / bồ đề (có rễ phụ) / rừng đước / cao su kèm Contact Shadow bên dưới
 */
export function buildOrganicTree(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  scale: number,
  tier: number,
  style: 'banyan_bodhi' | 'frangipani' | 'mangrove' | 'rubber'
) {
  const trunkColor =
    style === 'rubber' ? 0x7a736a : style === 'frangipani' ? 0x7c7164 : style === 'mangrove' ? 0x4b382a : 0x523926;
  const leafColorA =
    style === 'frangipani' ? 0x456b38 : style === 'mangrove' ? 0x2d5836 : style === 'rubber' ? 0x3b6331 : 0x345b2c;
  const leafColorB =
    style === 'frangipani' ? 0x61874a : style === 'mangrove' ? 0x3f7144 : style === 'rubber' ? 0x517b41 : 0x48743a;

  const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9 });
  const leafMatA = new THREE.MeshStandardMaterial({ color: leafColorA, roughness: 0.85, flatShading: true });
  const leafMatB = new THREE.MeshStandardMaterial({ color: leafColorB, roughness: 0.83, flatShading: true });

  // Contact shadow pad at ground level
  buildContactShadowPad(group, x, y, z, 1.8 * scale, 1.8 * scale, tier, 0.36);

  const trunkH = style === 'rubber' ? 4.6 * scale : style === 'frangipani' ? 2.2 * scale : 2.9 * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15 * scale, (style === 'banyan_bodhi' ? 0.56 : 0.28) * scale, trunkH, 9),
    trunkMat
  );
  trunk.position.set(x, y + trunkH / 2, z);
  registerMeshNode(group, trunk, tier);

  if (style === 'banyan_bodhi') {
    // Rễ phụ buông xuống từ tán cây Bồ Đề / Cây Đa cổ thụ
    for (let ar = 0; ar < 6; ar++) {
      const ang = (ar / 6) * Math.PI * 2 + 0.3;
      const rx = x + Math.cos(ang) * (1.05 * scale);
      const rz = z + Math.sin(ang) * (1.05 * scale);
      const rootStrand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03 * scale, 0.045 * scale, trunkH * 0.9, 6),
        trunkMat
      );
      rootStrand.position.set(rx, y + trunkH * 0.45, rz);
      registerMeshNode(group, rootStrand, tier);
    }
  }

  if (style === 'mangrove') {
    for (let r = 0; r < 6; r++) {
      const a = (r / 6) * Math.PI * 2;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, y + 1.15 * scale, z),
        new THREE.Vector3(x + Math.cos(a) * 0.55 * scale, y + 0.72 * scale, z + Math.sin(a) * 0.55 * scale),
        new THREE.Vector3(x + Math.cos(a) * 0.88 * scale, y, z + Math.sin(a) * 0.88 * scale),
      ]);
      const stilt = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.055 * scale, 6, false), trunkMat);
      registerMeshNode(group, stilt, tier);
    }
  }

  if (style === 'rubber') {
    // Chén hứng mủ cao su đặc trưng rừng cao su Bến Cát
    const cupMat = new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.7 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.1 * scale, 0.2 * scale, 8), cupMat);
    cup.position.set(x + 0.22 * scale, y + 1.45 * scale, z);
    registerMeshNode(group, cup, tier);
  }

  const crowns =
    style === 'banyan_bodhi'
      ? [
          [0, trunkH + 0.9 * scale, 0, 2.25],
          [-1.35 * scale, trunkH + 0.4 * scale, 0.6 * scale, 1.6],
          [1.35 * scale, trunkH + 0.5 * scale, -0.5 * scale, 1.65],
          [0.2 * scale, trunkH + 1.55 * scale, -0.4 * scale, 1.5],
        ]
      : [
          [0, trunkH + 0.55 * scale, 0, 1.38],
          [-0.65 * scale, trunkH + 0.25 * scale, 0.4 * scale, 0.98],
          [0.65 * scale, trunkH + 0.3 * scale, -0.35 * scale, 1.02],
        ];

  crowns.forEach(([ox, oy, oz, r], idx) => {
    const canopy = new THREE.Mesh(
      new THREE.DodecahedronGeometry(r * scale, 1),
      idx % 2 === 0 ? leafMatA : leafMatB
    );
    canopy.scale.set(1.16, 0.72, 1.16);
    canopy.position.set(x + ox, y + oy, z + oz);
    registerMeshNode(group, canopy, tier);
  });

  if (style === 'frangipani') {
    const blossomMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6 });
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * Math.PI * 2;
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.14 * scale, 6, 6), blossomMat);
      flower.position.set(x + Math.cos(a) * 1.05 * scale, y + trunkH + 0.85 * scale, z + Math.sin(a) * 1.05 * scale);
      registerMeshNode(group, flower, tier);
    }
  }
}


// =============================================================================
// BỘ VÂN PBR CHUYÊN BIỆT CHO QUẦN THỂ NHÀ LỚN LONG SƠN [BRVT-DT-002]
// =============================================================================

/**
 * Đá xanh Núi Nứa chẻ tự nhiên (#5A626A) lát bậc cấp, tường kè, chân tảng cột & tường rào
 */
export function getBlueStoneTerraceTex(repeatX = 5, repeatY = 4): ProceduralTextureSet {
  const key = `longson_bluestone_v2_${repeatX}_${repeatY}`;
  if (textureSetCache[key]) return textureSetCache[key];

  const { c, b, r, ctx, bCtx, rCtx } = createTripleCanvas(512);
  const rand = makeSeededRandom(19101);

  ctx.fillStyle = '#434a50';
  ctx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#323232';
  bCtx.fillRect(0, 0, 512, 512);
  rCtx.fillStyle = '#d8d8d8';
  rCtx.fillRect(0, 0, 512, 512);

  const rowH = 64;
  const colW = 128;
  for (let row = 0; row < 512 / rowH; row++) {
    const y = row * rowH;
    const offset = row % 2 === 0 ? 0 : colW * 0.5;
    for (let col = -1; col <= 512 / colW; col++) {
      const x = col * colW + offset;
      const v = Math.floor((rand() - 0.5) * 18);
      // Base #5A626A = rgb(90, 98, 106)
      ctx.fillStyle = `rgb(${90 + v}, ${98 + v}, ${106 + Math.floor(v * 0.9)})`;
      ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);

      const bv = 152 + Math.floor((rand() - 0.5) * 28);
      bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bCtx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);

      const rv = 190 + Math.floor((rand() - 0.5) * 26);
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);

      // Natural split-granite mineral grain & chiseled bevel
      for (let g = 0; g < 18; g++) {
        const gx = x + 6 + rand() * (colW - 12);
        const gy = y + 6 + rand() * (rowH - 12);
        ctx.fillStyle = rand() > 0.5 ? 'rgba(148, 160, 172, 0.24)' : 'rgba(48, 54, 60, 0.28)';
        ctx.fillRect(gx, gy, 3 + rand() * 5, 2 + rand() * 3);
        bCtx.fillStyle = rand() > 0.5 ? '#cacaca' : '#6c6c6c';
        bCtx.fillRect(gx, gy, 3, 2);
      }

      // Subtle weathered lichen/moss at stone mortar joints
      if (rand() > 0.68) {
        ctx.fillStyle = 'rgba(70, 92, 62, 0.22)';
        ctx.beginPath();
        ctx.arc(x + rand() * colW, y + (rand() > 0.5 ? 2 : rowH - 2), 6 + rand() * 8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = 'rgba(28, 33, 38, 0.76)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, colW, rowH);
      bCtx.strokeStyle = '#1b1b1b';
      bCtx.lineWidth = 3;
      bCtx.strokeRect(x, y, colW, rowH);
    }
  }

  return finalizeTextureSet(key, c, b, r, repeatX, repeatY);
}

/**
 * Ngói âm dương rêu phong tông xám đen pha nâu trầm cổ kính (#3B3531 / #4A3B32), vân sóng rõ nét
 */
export function getWeatheredMossyTileTex(repeatX = 5, repeatY = 4): ProceduralTextureSet {
  const key = `longson_mossy_tile_v3_${repeatX}_${repeatY}`;
  if (textureSetCache[key]) return textureSetCache[key];

  const { c, b, r, ctx, bCtx, rCtx } = createTripleCanvas(512);
  const rand = makeSeededRandom(19102);

  ctx.fillStyle = '#362d28';
  ctx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#606060';
  bCtx.fillRect(0, 0, 512, 512);
  rCtx.fillStyle = '#c4c4c4';
  rCtx.fillRect(0, 0, 512, 512);

  // 16 cặp rãnh ngói âm - sóng ngói dương rõ nét trên mỗi ô UV
  const cols = 16;
  const colW = 512 / cols;
  const rowH = 28;

  for (let i = 0; i < cols; i++) {
    const x = i * colW;
    const toneShift = Math.floor((rand() - 0.5) * 10);
    // Máng ngói âm (lõm sâu tối màu) + Sóng ngói dương (nổi vòm sáng ấm pha nâu đất nung cổ)
    const g = ctx.createLinearGradient(x, 0, x + colW, 0);
    g.addColorStop(0.0, `rgb(${24 + toneShift}, ${20 + toneShift}, ${18 + toneShift})`);
    g.addColorStop(0.18, `rgb(${44 + toneShift}, ${36 + toneShift}, ${32 + toneShift})`);
    g.addColorStop(0.34, `rgb(${68 + toneShift}, ${53 + toneShift}, ${45 + toneShift})`);
    g.addColorStop(0.52, `rgb(${94 + toneShift}, ${72 + toneShift}, ${58 + toneShift})`);
    g.addColorStop(0.70, `rgb(${66 + toneShift}, ${51 + toneShift}, ${43 + toneShift})`);
    g.addColorStop(0.84, `rgb(${38 + toneShift}, ${31 + toneShift}, ${28 + toneShift})`);
    g.addColorStop(1.0, `rgb(${22 + toneShift}, ${18 + toneShift}, ${16 + toneShift})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, colW, 512);

    // Rãnh chỉ đen sắc nét phân tách máng âm và ngói dương
    ctx.fillStyle = 'rgba(14, 11, 9, 0.82)';
    ctx.fillRect(x, 0, 2.2, 512);
    ctx.fillRect(x + colW - 2.2, 0, 2.2, 512);

    const bg = bCtx.createLinearGradient(x, 0, x + colW, 0);
    bg.addColorStop(0.0, '#080808');
    bg.addColorStop(0.22, '#424242');
    bg.addColorStop(0.52, '#ffffff');
    bg.addColorStop(0.80, '#383838');
    bg.addColorStop(1.0, '#080808');
    bCtx.fillStyle = bg;
    bCtx.fillRect(x, 0, colW, 512);

    const rg = rCtx.createLinearGradient(x, 0, x + colW, 0);
    rg.addColorStop(0.0, '#e2e2e2');
    rg.addColorStop(0.52, '#969696');
    rg.addColorStop(1.0, '#e2e2e2');
    rCtx.fillStyle = rg;
    rCtx.fillRect(x, 0, colW, 512);
  }

  for (let y = 0; y < 512; y += rowH) {
    // Ngấn xếp lớp ngói âm dương theo chiều ngang
    ctx.fillStyle = 'rgba(16, 13, 11, 0.76)';
    ctx.fillRect(0, y + rowH - 4, 512, 4);
    ctx.fillStyle = 'rgba(122, 98, 82, 0.28)';
    ctx.fillRect(0, y + rowH - 6, 512, 2);

    bCtx.fillStyle = '#0c0c0c';
    bCtx.fillRect(0, y + rowH - 5, 512, 5);

    // Vòm cong đầu viên ngói dương xếp chồng
    for (let i = 0; i < cols; i++) {
      const cx = i * colW + colW * 0.52;
      ctx.strokeStyle = 'rgba(18, 14, 12, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, y + rowH - 3, colW * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }

    // Rêu phong cổ kính dọc mí ngói âm dương
    for (let m = 0; m < 4; m++) {
      if (rand() > 0.45) {
        const mx = rand() * 512;
        const mr = 4 + rand() * 8;
        ctx.fillStyle = 'rgba(64, 82, 50, 0.28)';
        ctx.beginPath();
        ctx.arc(mx, y + rowH - 2, mr, 0, Math.PI * 2);
        ctx.fill();
        rCtx.fillStyle = '#ececec';
        rCtx.beginPath();
        rCtx.arc(mx, y + rowH - 2, mr, 0, Math.PI * 2);
        rCtx.fill();
      }
    }
  }

  return finalizeTextureSet(key, c, b, r, repeatX, repeatY);
}

/**
 * Hệ gỗ căm xe / gõ đỏ đậm màu nâu cánh gián sẫm bóng mờ (#3D1E10)
 */
export function getDarkTimberWallTex(repeatX = 3, repeatY = 2): ProceduralTextureSet {
  const key = `longson_dark_plank_v2_${repeatX}_${repeatY}`;
  if (textureSetCache[key]) return textureSetCache[key];

  const { c, b, r, ctx, bCtx, rCtx } = createTripleCanvas(512);
  const rand = makeSeededRandom(19103);

  ctx.fillStyle = '#3d1e10';
  ctx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#909090';
  bCtx.fillRect(0, 0, 512, 512);
  rCtx.fillStyle = '#747474';
  rCtx.fillRect(0, 0, 512, 512);

  const plankCount = 12;
  const pw = 512 / plankCount;
  for (let i = 0; i < plankCount; i++) {
    const x = i * pw;
    const shift = Math.floor((rand() - 0.5) * 12);
    // #3D1E10 = rgb(61, 30, 16)
    ctx.fillStyle = `rgb(${61 + shift}, ${30 + Math.floor(shift * 0.55)}, ${16 + Math.floor(shift * 0.35)})`;
    ctx.fillRect(x + 1, 0, pw - 2, 512);

    for (let s = 0; s < 16; s++) {
      const gx = x + 3 + rand() * (pw - 6);
      ctx.strokeStyle = rand() > 0.5 ? 'rgba(30, 14, 7, 0.38)' : 'rgba(88, 46, 26, 0.26)';
      ctx.lineWidth = 1 + rand() * 1.4;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + (rand() - 0.5) * 6, 170, gx + (rand() - 0.5) * 6, 340, gx, 512);
      ctx.stroke();

      bCtx.strokeStyle = rand() > 0.5 ? '#b4b4b4' : '#686868';
      bCtx.lineWidth = 1;
      bCtx.beginPath();
      bCtx.moveTo(gx, 0);
      bCtx.lineTo(gx, 512);
      bCtx.stroke();
    }

    // Plank seam groove
    ctx.fillStyle = 'rgba(18, 8, 4, 0.88)';
    ctx.fillRect(x, 0, 2.5, 512);
    bCtx.fillStyle = '#202020';
    bCtx.fillRect(x, 0, 3, 512);
  }

  return finalizeTextureSet(key, c, b, r, repeatX, repeatY);
}

/**
 * Cửa lá sách gỗ căm xe nâu cánh gián sẫm (#3D1E10)
 */
export function getLouveredWoodShutterTex(repeatX = 2, repeatY = 2): ProceduralTextureSet {
  const key = `longson_louver_shutter_v2_${repeatX}_${repeatY}`;
  if (textureSetCache[key]) return textureSetCache[key];

  const { c, b, r, ctx, bCtx, rCtx } = createTripleCanvas(512);
  ctx.fillStyle = '#3d1e10';
  ctx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#a0a0a0';
  bCtx.fillRect(0, 0, 512, 512);
  rCtx.fillStyle = '#787878';
  rCtx.fillRect(0, 0, 512, 512);

  // Outer stile & rail frame
  ctx.strokeStyle = '#4e2715';
  ctx.lineWidth = 28;
  ctx.strokeRect(14, 14, 484, 484);

  // Horizontal angled louver slats
  const slatH = 18;
  for (let y = 36; y < 476; y += slatH) {
    ctx.fillStyle = '#522916';
    ctx.fillRect(32, y, 448, slatH - 6);
    ctx.fillStyle = '#1f0e07';
    ctx.fillRect(32, y + slatH - 6, 448, 6);

    bCtx.fillStyle = '#dcdcdc';
    bCtx.fillRect(32, y, 448, slatH - 6);
    bCtx.fillStyle = '#222222';
    bCtx.fillRect(32, y + slatH - 6, 448, 6);
  }

  // Center mullion bar
  ctx.fillStyle = '#422011';
  ctx.fillRect(246, 20, 20, 472);
  bCtx.fillStyle = '#e5e5e5';
  bCtx.fillRect(246, 20, 20, 472);

  return finalizeTextureSet(key, c, b, r, repeatX, repeatY);
}

/**
 * Tủ thờ gỗ trắc khảm ốc xà cừ óng ánh (Mother-of-Pearl Inlay)
 */
export function getMotherOfPearlInlayTex(repeatX = 1, repeatY = 1): ProceduralTextureSet {
  const key = `longson_pearl_inlay_${repeatX}_${repeatY}`;
  if (textureSetCache[key]) return textureSetCache[key];

  const { c, b, r, ctx, bCtx, rCtx } = createTripleCanvas(512);

  // Deep polished rosewood/ebony background
  ctx.fillStyle = '#21110a';
  ctx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);
  rCtx.fillStyle = '#585858';
  rCtx.fillRect(0, 0, 512, 512);

  // Mother-of-pearl inlay panels (3 vertical bays)
  const panelXs = [24, 184, 344];
  const panelW = 144;
  panelXs.forEach((px, idx) => {
    ctx.strokeStyle = '#a8e6cf';
    ctx.lineWidth = 4;
    ctx.strokeRect(px, 36, panelW, 440);
    rCtx.strokeStyle = '#262626';
    rCtx.lineWidth = 4;
    rCtx.strokeRect(px, 36, panelW, 440);

    // Inner scrolled border
    ctx.strokeStyle = '#dff6ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 12, 48, panelW - 24, 416);

    // Central iridescent medallion + floral vine scrolls
    const cx = px + panelW / 2;
    const cy = 256;
    const pearlGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 42);
    pearlGrad.addColorStop(0, '#f8fafc');
    pearlGrad.addColorStop(0.45, idx === 1 ? '#bae6fd' : '#a7f3d0');
    pearlGrad.addColorStop(0.75, '#ddd6fe');
    pearlGrad.addColorStop(1, '#99f6e4');
    ctx.strokeStyle = pearlGrad;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.stroke();

    // Inner longevity/lotus geometric inlay
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26);
    }
    ctx.stroke();

    // Top & bottom floral pearl scrolls
    for (const sy of [126, 386]) {
      ctx.strokeStyle = '#c4f1f9';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx - 18, sy, 14, 0, Math.PI * 1.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 18, sy, 14, Math.PI * 0.6, Math.PI * 2);
      ctx.stroke();

      rCtx.fillStyle = '#202020';
      rCtx.beginPath();
      rCtx.arc(cx, sy, 18, 0, Math.PI * 2);
      rCtx.fill();
    }

    bCtx.strokeStyle = '#c8c8c8';
    bCtx.lineWidth = 3;
    bCtx.strokeRect(px + 12, 48, panelW - 24, 416);
  });

  return finalizeTextureSet(key, c, b, r, repeatX, repeatY);
}
