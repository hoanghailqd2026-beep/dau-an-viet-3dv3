import * as THREE from 'three';

export interface ProceduralPBRTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap?: THREE.CanvasTexture;
}

// Cache generated textures so we don't recreate them on every render
const textureCache: Record<string, ProceduralPBRTextureSet> = {};

/**
 * 1. Marseille / Toulouse Deep Warm Fired Brick PBR Texture (Nhà thờ Đức Bà Sài Gòn)
 * Authentically simulates aged kiln-fired Marseille bricks in deep warm terracotta red
 * (#9E4230, #923B2A, #A84936), muted grey-taupe mortar joints (#8A7B73), and tactile bump relief.
 */
export function getToulouseBrickTextures(): ProceduralPBRTextureSet {
  if (textureCache['toulouseBrick']) return textureCache['toulouseBrick'];

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  // Muted warm grey-taupe mortar base (#8a7b73)
  ctx.fillStyle = '#8a7b73';
  ctx.fillRect(0, 0, 512, 512);

  // Recessed mortar in bump map
  bumpCtx.fillStyle = '#242424';
  bumpCtx.fillRect(0, 0, 512, 512);

  const rows = 20;
  const cols = 8;
  const mortar = 2.4;
  const rowStep = 512 / rows;
  const colStep = 512 / cols;
  const brickH = rowStep - mortar;
  const brickW = colStep - mortar;

  // Deep warm Marseille brick palette centered around #9E4230 (no neon/bright orange)
  const brickColors = [
    '#9e4230',
    '#943c2b',
    '#a64835',
    '#9e4230',
    '#8d3726',
    '#a24532',
    '#983e2d',
    '#ab4c39',
  ];

  for (let r = 0; r < rows; r++) {
    const y = r * rowStep + mortar * 0.5;
    const offsetX = r % 2 === 0 ? 0 : colStep * 0.5;

    for (let c = -1; c <= cols; c++) {
      const x = c * colStep + offsetX + mortar * 0.5;
      const hash = Math.abs(Math.floor(Math.sin(r * 19.3 + c * 11.7) * 10000));
      const baseColor = brickColors[hash % brickColors.length];
      ctx.fillStyle = baseColor;
      ctx.fillRect(x, y, brickW, brickH);

      // Subtle kiln-baked clay shading on each brick
      ctx.fillStyle = hash % 2 === 0 ? 'rgba(110, 38, 24, 0.18)' : 'rgba(180, 82, 62, 0.14)';
      ctx.fillRect(x + 2, y + 2, brickW - 4, brickH - 4);

      for (let p = 0; p < 22; p++) {
        const px = x + ((hash + p * 17) % Math.floor(brickW));
        const py = y + ((hash + p * 31) % Math.floor(brickH));
        ctx.fillStyle = p % 2 === 0 ? 'rgba(55, 20, 12, 0.15)' : 'rgba(215, 165, 145, 0.10)';
        ctx.fillRect(px, py, 2, 2);
      }

      // Bump map: raised brick surface with slight brick-to-brick height variation
      const bumpShade = 205 + (hash % 36);
      bumpCtx.fillStyle = `rgb(${bumpShade}, ${bumpShade}, ${bumpShade})`;
      bumpCtx.fillRect(x, y, brickW, brickH);
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 4);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4, 4);

  map.userData = { isCached: true };
  bumpMap.userData = { isCached: true };

  textureCache['toulouseBrick'] = { map, bumpMap };
  return textureCache['toulouseBrick'];
}

/**
 * 1B. Muted Terracotta Clay Roof Tiles (#B55035) for Notre-Dame Cathedral
 * Authentically replicates aged terracotta roof tiles (#B55035) with interlocking ribs and weathering.
 */
export function getMarseilleRoofTileTextures(): ProceduralPBRTextureSet {
  if (textureCache['marseilleRoofTile']) return textureCache['marseilleRoofTile'];

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  // Muted terracotta clay base (#B55035)
  ctx.fillStyle = '#b55035';
  ctx.fillRect(0, 0, 512, 512);

  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, 512, 512);

  const tileCols = 16;
  const tileRows = 16;
  const colW = 512 / tileCols;
  const rowH = 512 / tileRows;

  for (let r = 0; r < tileRows; r++) {
    const y = r * rowH;
    const offX = (r % 2) * (colW * 0.5);

    for (let c = -1; c <= tileCols; c++) {
      const x = c * colW + offX;
      const shadeVar = ((r * 7 + c * 13) & 3) * 4;

      // Tile pan body (#B55035 with natural clay variation)
      ctx.fillStyle = shadeVar === 0 ? '#b55035' : shadeVar === 4 ? '#bd563b' : '#a8472e';
      ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 3);

      // Raised interlocking roll / rib on each tile (#c25d42)
      ctx.fillStyle = '#c25d42';
      ctx.fillRect(x + colW * 0.32, y + 2, colW * 0.28, rowH - 4);

      // Deep vertical channel crease (#7d311d)
      ctx.fillStyle = '#7d311d';
      ctx.fillRect(x, y, 2.5, rowH);

      // Bump map for tile overlap & vertical roll rib
      bumpCtx.fillStyle = '#b8b8b8';
      bumpCtx.fillRect(x + 2, y + 2, colW - 4, rowH - 3);
      bumpCtx.fillStyle = '#f2f2f2';
      bumpCtx.fillRect(x + colW * 0.32, y + 2, colW * 0.28, rowH - 4);
      bumpCtx.fillStyle = '#262626';
      bumpCtx.fillRect(x, y, 2.5, rowH);
    }

    // Horizontal course overlap shadow line
    ctx.fillStyle = '#732c19';
    ctx.fillRect(0, y, 512, 2.4);
    bumpCtx.fillStyle = '#1c1c1c';
    bumpCtx.fillRect(0, y, 512, 3.0);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(5, 5);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(5, 5);

  map.userData = { isCached: true };
  bumpMap.userData = { isCached: true };

  textureCache['marseilleRoofTile'] = { map, bumpMap };
  return textureCache['marseilleRoofTile'];
}

/**
 * 1C. Weathered Horizontal-Lap Zinc & Slate Spire Shingle Texture (#BCC2C8 blended with #8E969E)
 * Draws horizontal overlapping metal/slate shingle courses, vertical joint seams, and aged weathering streaks.
 */
export function getSpireFishscaleStoneTextures(): ProceduralPBRTextureSet {
  if (textureCache['spireFishscaleStone']) return textureCache['spireFishscaleStone'];

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  // Weathered cool grey-slate base (#BCC2C8 blended with #8E969E)
  ctx.fillStyle = '#b4bac0';
  ctx.fillRect(0, 0, 512, 512);

  bumpCtx.fillStyle = '#b0b0b0';
  bumpCtx.fillRect(0, 0, 512, 512);

  const courseRows = 32; // Dense horizontal overlapping courses
  const courseCols = 12;
  const rowH = 512 / courseRows; // 16px per horizontal course
  const colW = 512 / courseCols;

  const shingleTones = ['#bcc2c8', '#b0b7be', '#a3abb3', '#969fa7', '#c2c8ce', '#8e969e'];

  for (let r = 0; r < courseRows; r++) {
    const y = r * rowH;
    const offX = (r % 2) * (colW * 0.5);

    for (let c = -1; c <= courseCols; c++) {
      const x = c * colW + offX;
      const hash = Math.abs(Math.floor(Math.sin(r * 23.1 + c * 17.7) * 1000));
      const tone = shingleTones[hash % shingleTones.length];

      // Horizontal overlapping shingle plate
      ctx.fillStyle = tone;
      ctx.fillRect(x + 1, y + 1.5, colW - 2, rowH - 2.5);

      // Subtle top-to-bottom gradient on each horizontal shingle course
      ctx.fillStyle = 'rgba(142, 150, 158, 0.24)';
      ctx.fillRect(x + 1, y + rowH * 0.62, colW - 2, rowH * 0.35);

      // Vertical seam between adjacent zinc/slate plates
      ctx.fillStyle = '#7d858d';
      ctx.fillRect(x, y, 1.5, rowH);

      // Bump map: stepped horizontal course relief
      const bVal = 175 + (hash % 35);
      bumpCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
      bumpCtx.fillRect(x + 1, y + 2, colW - 2, rowH - 3);
      bumpCtx.fillStyle = '#4a4a4a';
      bumpCtx.fillRect(x, y, 1.5, rowH);
    }

    // Crisp horizontal lap shadow line across the spire face
    ctx.fillStyle = '#737b83';
    ctx.fillRect(0, y + rowH - 2.2, 512, 2.2);
    ctx.fillStyle = '#d0d5da';
    ctx.fillRect(0, y, 512, 1.2);

    bumpCtx.fillStyle = '#242424';
    bumpCtx.fillRect(0, y + rowH - 2.5, 512, 2.5);
    bumpCtx.fillStyle = '#ededed';
    bumpCtx.fillRect(0, y, 512, 1.5);
  }

  // Organic vertical rainwater patina & aged zinc oxidation streaks (#8E969E / #7A828A)
  for (let s = 0; s < 42; s++) {
    const sx = ((s * 37) % 500) + 4;
    const sy = (s * 53) % 420;
    const sw = 6 + (s % 14);
    const sh = 45 + (s % 95);
    const grad = ctx.createLinearGradient(sx, sy, sx, sy + sh);
    grad.addColorStop(0, 'rgba(122, 130, 138, 0.0)');
    grad.addColorStop(0.35, 'rgba(118, 126, 134, 0.24)');
    grad.addColorStop(1, 'rgba(142, 150, 158, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, sw, sh);
  }

  // Fine metallic/stone surface grain
  for (let i = 0; i < 3800; i++) {
    const gx = (i * 89) % 512;
    const gy = (i * 149) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(95, 102, 110, 0.14)' : 'rgba(210, 216, 222, 0.12)';
    ctx.fillRect(gx, gy, 2, 2);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 6);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 6);

  map.userData = { isCached: true };
  bumpMap.userData = { isCached: true };

  textureCache['spireFishscaleStone'] = { map, bumpMap };
  return textureCache['spireFishscaleStone'];
}

/**
 * 1D. Warm Pinkish-Brown Sandstone Texture (#C49A84) for Corner Quoins, Corbel Table & Window Trim
 * Matches the real-world pinkish-brown sandstone quoins and moulded trim of Saigon Notre-Dame Cathedral.
 */
export function getWeatheredLimestoneTextures(): ProceduralPBRTextureSet {
  if (textureCache['weatheredLimestone']) return textureCache['weatheredLimestone'];

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  // Warm pinkish-brown sandstone base (#C49A84)
  ctx.fillStyle = '#c49a84';
  ctx.fillRect(0, 0, 512, 512);

  bumpCtx.fillStyle = '#909090';
  bumpCtx.fillRect(0, 0, 512, 512);

  // Subtle dressed sandstone ashlar block courses
  const blockH = 64;
  const blockW = 128;
  for (let r = 0; r < 8; r++) {
    const y = r * blockH;
    const offX = (r % 2) * (blockW * 0.5);
    for (let c = -1; c <= 4; c++) {
      const x = c * blockW + offX;
      const tone = (r * 3 + c * 5) % 3;
      ctx.fillStyle = tone === 0 ? '#c49a84' : tone === 1 ? '#ba907a' : '#cca38d';
      ctx.fillRect(x + 1.5, y + 1.5, blockW - 3, blockH - 3);

      bumpCtx.fillStyle = tone === 0 ? '#a8a8a8' : '#b8b8b8';
      bumpCtx.fillRect(x + 1.5, y + 1.5, blockW - 3, blockH - 3);
    }
    ctx.fillStyle = 'rgba(128, 94, 78, 0.45)';
    ctx.fillRect(0, y, 512, 1.8);
    bumpCtx.fillStyle = '#484848';
    bumpCtx.fillRect(0, y, 512, 2.0);
  }

  // Natural sandstone pores & warm mineral grain
  for (let i = 0; i < 4500; i++) {
    const gx = (i * 73) % 512;
    const gy = (i * 139) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(115, 82, 66, 0.15)' : 'rgba(224, 190, 172, 0.14)';
    ctx.fillRect(gx, gy, 2, 2);
    bumpCtx.fillStyle = i % 2 === 0 ? '#d0d0d0' : '#606060';
    bumpCtx.fillRect(gx, gy, 2, 2);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 3);

  map.userData = { isCached: true };
  bumpMap.userData = { isCached: true };

  textureCache['weatheredLimestone'] = { map, bumpMap };
  return textureCache['weatheredLimestone'];
}

/**
 * 2. French Colonial Ochre Yellow Stucco (Bưu điện Trung tâm & Nhà hát)
 * Replicates the iconic French Indochina yellow plaster with organic humidity patinas.
 */
export function getColonialStuccoTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  if (textureCache['colonialStucco']) return textureCache['colonialStucco'];

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  // Warm ochre yellow foundation
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, 512, 512);

  // Organic aged plaster variation
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const rad = 20 + Math.random() * 60;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, Math.random() > 0.5 ? 'rgba(202, 138, 4, 0.15)' : 'rgba(254, 240, 138, 0.15)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bump map for tactile stucco grain
  bumpCtx.fillStyle = '#888888';
  bumpCtx.fillRect(0, 0, 512, 512);
  const imgData = bumpCtx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 45;
    imgData.data[i] = Math.min(255, Math.max(0, 136 + n));
    imgData.data[i + 1] = Math.min(255, Math.max(0, 136 + n));
    imgData.data[i + 2] = Math.min(255, Math.max(0, 136 + n));
  }
  bumpCtx.putImageData(imgData, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 2);

  map.userData = { isCached: true };
  bumpMap.userData = { isCached: true };

  textureCache['colonialStucco'] = { map, bumpMap };
  return textureCache['colonialStucco'];
}

/**
 * 3. French Slate Mansard Roof Shingles (Nhà hát Thành phố & Bưu điện)
 * Diamond fishscale French slate tiles with weathered sheen.
 */
export function getFrenchSlateTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  if (textureCache['frenchSlate']) return textureCache['frenchSlate'];

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 512, 512);

  bumpCtx.fillStyle = '#303030';
  bumpCtx.fillRect(0, 0, 512, 512);

  const tileW = 32;
  const tileH = 24;

  for (let y = 0; y < 512; y += tileH) {
    const isOdd = Math.floor(y / tileH) % 2 === 1;
    const xOffset = isOdd ? tileW / 2 : 0;

    for (let x = -tileW; x < 512 + tileW; x += tileW) {
      const rx = x + xOffset;
      // Diamond scale shape
      ctx.beginPath();
      ctx.moveTo(rx + tileW / 2, y);
      ctx.lineTo(rx + tileW, y + tileH * 0.7);
      ctx.lineTo(rx + tileW / 2, y + tileH);
      ctx.lineTo(rx, y + tileH * 0.7);
      ctx.closePath();

      const slateShade = 30 + Math.floor(Math.random() * 25);
      ctx.fillStyle = `rgb(${slateShade}, ${slateShade + 6}, ${slateShade + 16})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Bump
      bumpCtx.beginPath();
      bumpCtx.moveTo(rx + tileW / 2, y);
      bumpCtx.lineTo(rx + tileW, y + tileH * 0.7);
      bumpCtx.lineTo(rx + tileW / 2, y + tileH);
      bumpCtx.lineTo(rx, y + tileH * 0.7);
      bumpCtx.closePath();
      bumpCtx.fillStyle = '#cccccc';
      bumpCtx.fill();
      bumpCtx.strokeStyle = '#111111';
      bumpCtx.lineWidth = 2;
      bumpCtx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 4);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4, 4);

  map.userData = { isCached: true };
  bumpMap.userData = { isCached: true };

  textureCache['frenchSlate'] = { map, bumpMap };
  return textureCache['frenchSlate'];
}

/**
 * 4. Weathered Vietnamese Marble & Stone (Dinh Độc Lập bậc tam cấp & cột sảnh)
 */
export function getWeatheredMarbleTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  if (textureCache['weatheredMarble']) return textureCache['weatheredMarble'];

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#ded9cf';
  ctx.fillRect(0, 0, 512, 512);

  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, 512, 512);

  // Subtle grey and amber veining
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
  ctx.lineWidth = 2.5;

  for (let i = 0; i < 18; i++) {
    let curX = Math.random() * 512;
    let curY = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(curX, curY);

    for (let step = 0; step < 8; step++) {
      curX += (Math.random() - 0.5) * 80;
      curY += (Math.random() - 0.5) * 80;
      ctx.lineTo(curX, curY);
    }
    ctx.stroke();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 2);

  map.userData = { isCached: true };
  bumpMap.userData = { isCached: true };

  textureCache['weatheredMarble'] = { map, bumpMap };
  return textureCache['weatheredMarble'];
}

/**
 * 5. Authentic Terracotta Yin-Yang Roof Tiles (Chùa Giác Lâm, Hội Quán Nghĩa An)
 */
export function getTerracottaTileTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  if (textureCache['terracotta']) return textureCache['terracotta'];

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#9a3412'; // Deep terracotta
  ctx.fillRect(0, 0, 512, 512);

  const ribW = 24;
  for (let x = 0; x < 512; x += ribW) {
    // Dark crease
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(x, 0, ribW * 0.4, 512);

    // Light crown
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(x + ribW * 0.4, 0, ribW * 0.6, 512);

    // Bump
    bumpCtx.fillStyle = '#333333';
    bumpCtx.fillRect(x, 0, ribW * 0.4, 512);
    bumpCtx.fillStyle = '#ffffff';
    bumpCtx.fillRect(x + ribW * 0.4, 0, ribW * 0.6, 512);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 3);

  map.userData = { isCached: true };
  bumpMap.userData = { isCached: true };

  textureCache['terracotta'] = { map, bumpMap };
  return textureCache['terracotta'];
}
