import * as THREE from 'three';

type AddPalacePartFn = (
  mesh: THREE.Object3D,
  tier: number,
  origColor?: number,
  isGround?: boolean
) => THREE.Object3D;

// Cached CanvasTextures so switching landmarks back to HCM-DT-001 reuses GPU textures cleanly
let cachedWarMapTex: THREE.CanvasTexture | null = null;
let cachedLacquerMuralTex: THREE.CanvasTexture | null = null;
let cachedMarbleTex: THREE.CanvasTexture | null = null;
let cachedBrocadeCarpetTex: THREE.CanvasTexture | null = null;
let cachedBunkerConcreteTex: THREE.CanvasTexture | null = null;
let cachedHelipadTex: THREE.CanvasTexture | null = null;

function createWarMapTexture(): THREE.CanvasTexture {
  if (cachedWarMapTex) return cachedWarMapTex;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Vintage military parchment / olive-cream backdrop
    ctx.fillStyle = '#ddd3b8';
    ctx.fillRect(0, 0, 1024, 512);

    // Subtle topographic ocean east/south
    ctx.fillStyle = '#b9c9cb';
    ctx.beginPath();
    ctx.moveTo(640, 0);
    ctx.lineTo(1024, 0);
    ctx.lineTo(1024, 512);
    ctx.lineTo(390, 512);
    ctx.bezierCurveTo(470, 410, 570, 340, 620, 260);
    ctx.bezierCurveTo(670, 175, 650, 90, 640, 0);
    ctx.closePath();
    ctx.fill();

    // Contour rings & Mekong Delta river network
    ctx.strokeStyle = '#4c758a';
    ctx.lineWidth = 3;
    const rivers = [
      [180, 140, 320, 230, 460, 340, 550, 460],
      [120, 220, 280, 290, 400, 390, 470, 495],
      [420, 70, 470, 165, 505, 250, 580, 315],
    ];
    rivers.forEach(([x0, y0, x1, y1, x2, y2, x3, y3]) => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3);
      ctx.stroke();
    });

    // Military grid lines (UTM sectors)
    ctx.strokeStyle = 'rgba(55, 65, 50, 0.24)';
    ctx.lineWidth = 1;
    for (let x = 64; x < 1024; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 64; y < 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Tactical Zone boundaries (Vùng I - IV) & arrows
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(220, 180);
    ctx.lineTo(660, 180);
    ctx.moveTo(150, 310);
    ctx.lineTo(600, 310);
    ctx.stroke();
    ctx.setLineDash([]);

    // Strategic markers & Saigon ring
    const markers = [
      { x: 485, y: 265, r: 16, label: 'SÀI GÒN - GIA ĐỊNH' },
      { x: 565, y: 295, r: 9, label: 'VŨNG TÀU' },
      { x: 430, y: 205, r: 9, label: 'BÌNH DƯƠNG' },
      { x: 350, y: 375, r: 9, label: 'CẦN THƠ' },
      { x: 605, y: 115, r: 9, label: 'XUÂN LỘC' },
    ];
    markers.forEach((m, idx) => {
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fillStyle = idx === 0 ? 'rgba(185, 28, 28, 0.35)' : 'rgba(185, 28, 28, 0.75)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#7f1d1d';
      ctx.stroke();

      ctx.fillStyle = '#1f2937';
      ctx.font = idx === 0 ? 'bold 18px monospace' : 'bold 13px monospace';
      ctx.fillText(m.label, m.x + m.r + 8, m.y + 5);
    });

    // Tactical arrow arcs
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 4;
    [
      [560, 90, 520, 190, 495, 245],
      [330, 150, 410, 215, 465, 255],
    ].forEach(([sx, sy, cx, cy, ex, ey]) => {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cx, cy, ex, ey);
      ctx.stroke();
    });

    // Map border & legend block
    ctx.strokeStyle = '#2c3527';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, 1004, 492);
    ctx.fillStyle = 'rgba(32, 38, 28, 0.88)';
    ctx.fillRect(28, 28, 305, 86);
    ctx.fillStyle = '#e5d8b2';
    ctx.font = 'bold 17px monospace';
    ctx.fillText('BẢN ĐỒ TÁC CHIẾN NAM BỘ', 44, 60);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#c5a059';
    ctx.fillText('TẦNG HẦM CHỈ HUY NGẦM B1 • 1966–1975', 44, 88);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.isCached = true;
  cachedWarMapTex = tex;
  return tex;
}

function createBinhNgoLacquerTexture(): THREE.CanvasTexture {
  if (cachedLacquerMuralTex) return cachedLacquerMuralTex;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Deep vermilion lacquer background with subtle warm sheen
    const grad = ctx.createLinearGradient(0, 0, 1024, 512);
    grad.addColorStop(0, '#5d0c0c');
    grad.addColorStop(0.5, '#8b1a14');
    grad.addColorStop(1, '#4c0909');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Gilded clouds & rising sun disk
    ctx.fillStyle = 'rgba(218, 173, 74, 0.85)';
    ctx.beginPath();
    ctx.arc(512, 145, 58, 0, Math.PI * 2);
    ctx.fill();

    // Stylized gold-leaf layered mountains (Giang Sơn Cẩm Tú)
    const layers = [
      { yBase: 360, amp: 145, col: 'rgba(180, 132, 42, 0.65)', phase: 0.2 },
      { yBase: 410, amp: 115, col: 'rgba(216, 169, 68, 0.82)', phase: 1.4 },
      { yBase: 455, amp: 80, col: 'rgba(240, 200, 105, 0.92)', phase: 2.5 },
    ];
    layers.forEach((l) => {
      ctx.beginPath();
      ctx.moveTo(0, 512);
      for (let x = 0; x <= 1024; x += 24) {
        const peak =
          Math.sin(x * 0.008 + l.phase) * l.amp * 0.6 +
          Math.cos(x * 0.019 - l.phase) * l.amp * 0.4;
        ctx.lineTo(x, l.yBase - Math.abs(peak));
      }
      ctx.lineTo(1024, 512);
      ctx.closePath();
      ctx.fillStyle = l.col;
      ctx.fill();
    });

    // Winding golden river & stylized lacquer pine/bamboo clusters
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(140, 490);
    ctx.bezierCurveTo(340, 410, 620, 470, 910, 390);
    ctx.stroke();

    // Traditional lacquer panel vertical dividers (bộ tranh ghép tấm)
    ctx.strokeStyle = '#290707';
    ctx.lineWidth = 5;
    for (let i = 1; i < 8; i++) {
      const px = (1024 / 8) * i;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, 512);
      ctx.stroke();
    }

    // Gilded outer museum border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 14;
    ctx.strokeRect(8, 8, 1008, 496);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.isCached = true;
  cachedLacquerMuralTex = tex;
  return tex;
}

function createPalaceMarbleTexture(): THREE.CanvasTexture {
  if (cachedMarbleTex) return cachedMarbleTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#efe9de';
    ctx.fillRect(0, 0, 512, 512);
    // Tile grid
    ctx.strokeStyle = 'rgba(170, 155, 130, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    // Subtle marble veins
    ctx.strokeStyle = 'rgba(186, 170, 145, 0.38)';
    ctx.lineWidth = 1.6;
    for (let v = 0; v < 22; v++) {
      let vx = (v * 97) % 512;
      let vy = (v * 53) % 512;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      for (let s = 0; s < 5; s++) {
        vx += 32 + ((v * 17 + s * 29) % 45) - 18;
        vy += 28 + ((v * 23 + s * 13) % 35) - 12;
        ctx.lineTo(vx, vy);
      }
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  tex.userData.isCached = true;
  cachedMarbleTex = tex;
  return tex;
}

function createRoyalBrocadeCarpetTexture(): THREE.CanvasTexture {
  if (cachedBrocadeCarpetTex) return cachedBrocadeCarpetTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#6f1419';
    ctx.fillRect(0, 0, 512, 512);
    // Gold ornamental border
    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 14;
    ctx.strokeRect(20, 20, 472, 472);
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, 440, 440);
    // Subtle geometric lotus medallions
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
    ctx.lineWidth = 2;
    for (let x = 96; x < 440; x += 106) {
      for (let y = 96; y < 440; y += 106) {
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.isCached = true;
  cachedBrocadeCarpetTex = tex;
  return tex;
}

function createBunkerConcreteTexture(): THREE.CanvasTexture {
  if (cachedBunkerConcreteTex) return cachedBunkerConcreteTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#535852';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3200; i++) {
      const x = (i * 73) % 256;
      const y = (i * 137) % 256;
      const alpha = 0.08 + ((i * 19) % 10) * 0.015;
      ctx.fillStyle = i % 3 === 0 ? `rgba(38, 48, 32, ${alpha})` : `rgba(110, 115, 108, ${alpha})`;
      ctx.fillRect(x, y, 3, 3);
    }
    ctx.strokeStyle = 'rgba(30, 34, 30, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 252, 124);
    ctx.strokeRect(2, 130, 252, 124);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.userData.isCached = true;
  cachedBunkerConcreteTex = tex;
  return tex;
}

function createHelipadAndBombMarksTexture(): THREE.CanvasTexture {
  if (cachedHelipadTex) return cachedHelipadTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#56606b';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle rooftop concrete grain
    for (let i = 0; i < 3500; i++) {
      const x = (i * 89) % 512;
      const y = (i * 193) % 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(x, y, 2, 2);
    }

    // Helipad outer white ring
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(256, 256, 214, 0, Math.PI * 2);
    ctx.stroke();

    // Yellow inner caution ring
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.72)';
    ctx.lineWidth = 6;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    ctx.arc(256, 256, 178, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Crisp central 'H'
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(166, 138, 36, 236);
    ctx.fillRect(310, 138, 36, 236);
    ctx.fillRect(166, 238, 180, 36);

    // Two historical red concentric circles marking 08/04/1975 bomb impact sites
    const bombMarks = [
      { x: 118, y: 378 },
      { x: 392, y: 146 },
    ];
    bombMarks.forEach((bm) => {
      ctx.fillStyle = 'rgba(185, 28, 28, 0.25)';
      ctx.beginPath();
      ctx.arc(bm.x, bm.y, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(bm.x, bm.y, 24, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bm.x, bm.y, 11, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.isCached = true;
  cachedHelipadTex = tex;
  return tex;
}

export function buildDinhDocLapInterior(
  addPalacePart: AddPalacePartFn,
  materials: {
    palaceWhiteMat: THREE.MeshStandardMaterial;
    goldBronzeMat: THREE.MeshStandardMaterial;
    steelMat: THREE.MeshStandardMaterial;
  }
): void {
  const { palaceWhiteMat, goldBronzeMat, steelMat } = materials;

  const markInterior = (
    mesh: THREE.Object3D,
    tier: number,
    origColor?: number
  ) => {
    mesh.userData.isInterior = true;
    addPalacePart(mesh, tier, origColor, false);
    return mesh;
  };

  const addInteriorPointLight = (
    x: number,
    y: number,
    z: number,
    tier: number,
    targetIntensity = 3.8,
    distance = 17,
    color = 0xffe4b5
  ) => {
    const light = new THREE.PointLight(color, 0.35, distance, 1.65);
    light.position.set(x, y, z);
    light.userData.isInteriorPointLight = true;
    light.userData.targetIntensity = targetIntensity;
    light.userData.baseIntensity = 0.35;
    light.userData.elevationTier = tier;
    light.userData.origY = y;
    addPalacePart(light, tier);
    return light;
  };

  // Shared interior materials
  const marbleFloorMat = new THREE.MeshStandardMaterial({
    map: createPalaceMarbleTexture(),
    color: 0xffffff,
    roughness: 0.24,
    metalness: 0.06,
  });
  const brocadeCarpetMat = new THREE.MeshStandardMaterial({
    map: createRoyalBrocadeCarpetTexture(),
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.04,
  });
  const crimsonCarpetMat = new THREE.MeshStandardMaterial({
    color: 0x7a161b,
    roughness: 0.92,
    metalness: 0.02,
  });
  const goDoWoodMat = new THREE.MeshStandardMaterial({
    color: 0x7c2d12,
    roughness: 0.25,
    metalness: 0.08,
  });
  const walnutMat = new THREE.MeshStandardMaterial({
    color: 0x451a08,
    roughness: 0.34,
    metalness: 0.08,
  });
  const greenLeatherMat = new THREE.MeshStandardMaterial({
    color: 0x1b4d3e,
    roughness: 0.38,
    metalness: 0.06,
  });
  const redVelvetMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    roughness: 0.72,
    metalness: 0.04,
  });
  const vermilionColMat = new THREE.MeshStandardMaterial({
    color: 0xa4161a,
    roughness: 0.32,
    metalness: 0.1,
  });
  const crystalGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff8e7,
    emissive: 0xffd580,
    emissiveIntensity: 0.95,
    roughness: 0.12,
    metalness: 0.1,
  });
  const bunkerConcreteMat = new THREE.MeshStandardMaterial({
    map: createBunkerConcreteTexture(),
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.04,
  });
  const blastSteelMat = new THREE.MeshStandardMaterial({
    color: 0x2f3b28,
    roughness: 0.45,
    metalness: 0.68,
  });
  const oliveDrabMat = new THREE.MeshStandardMaterial({
    color: 0x434f38,
    roughness: 0.56,
    metalness: 0.24,
  });
  const heliGlassMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.14,
    metalness: 0.65,
    transparent: true,
    opacity: 0.54,
  });

  // ===========================================================================
  // 1. TẦNG HẦM CHỈ HUY NGẦM (B1) — X: -5.8..+5.8, Z: -11.2..-5.8, Y: -2.05..-0.05
  // ===========================================================================
  const bunkerFloorY = -2.05;
  const bunkerCenterZ = -8.5;
  const bunkerW = 11.6;
  const bunkerD = 5.4;
  const bunkerH = 1.98;

  const bunkerFloor = new THREE.Mesh(
    new THREE.BoxGeometry(bunkerW, 0.16, bunkerD),
    bunkerConcreteMat
  );
  bunkerFloor.position.set(0, bunkerFloorY, bunkerCenterZ);
  markInterior(bunkerFloor, 0, 0x535852);

  // West, East, and Front-South concrete walls (leaving North side open for low-angle inspection & rear view)
  const bWallW = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, bunkerH, bunkerD),
    bunkerConcreteMat
  );
  bWallW.position.set(-bunkerW / 2 + 0.14, bunkerFloorY + bunkerH / 2 + 0.06, bunkerCenterZ);
  markInterior(bWallW, 0, 0x535852);

  const bWallE = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, bunkerH, bunkerD),
    bunkerConcreteMat
  );
  bWallE.position.set(bunkerW / 2 - 0.14, bunkerFloorY + bunkerH / 2 + 0.06, bunkerCenterZ);
  markInterior(bWallE, 0, 0x535852);

  const bWallS = new THREE.Mesh(
    new THREE.BoxGeometry(bunkerW, bunkerH, 0.28),
    bunkerConcreteMat
  );
  bWallS.position.set(0, bunkerFloorY + bunkerH / 2 + 0.06, -5.92);
  markInterior(bWallS, 0, 0x535852);

  // Heavy olive-steel blast door on the West wall (x = -5.45)
  const blastDoorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.56, 1.28),
    blastSteelMat
  );
  blastDoorFrame.position.set(-5.45, bunkerFloorY + 0.86, -8.5);
  markInterior(blastDoorFrame, 0, 0x2f3b28);

  const blastWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.035, 8, 18),
    steelMat
  );
  blastWheel.rotation.y = Math.PI / 2;
  blastWheel.position.set(-5.32, bunkerFloorY + 0.88, -8.25);
  markInterior(blastWheel, 0, 0x334155);

  // Large Southern Vietnam & Saigon Military Map mounted on South wall facing North (-Z)
  const warMapMat = new THREE.MeshStandardMaterial({
    map: createWarMapTexture(),
    roughness: 0.45,
    metalness: 0.05,
  });
  const warMapBoard = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 1.52, 0.08),
    warMapMat
  );
  warMapBoard.position.set(0, bunkerFloorY + 1.15, -6.12);
  markInterior(warMapBoard, 0, 0xddd3b8);

  // Central Wooden Tactical Command Table + Radio Transceivers + Red/Green LEDs + Green Desk Lamp
  const bTableTop = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.1, 1.85),
    walnutMat
  );
  bTableTop.position.set(0, bunkerFloorY + 0.72, -8.35);
  markInterior(bTableTop, 0, 0x451a08);

  [-1.9, 1.9].forEach((tx) => {
    [-0.7, 0.7].forEach((tz) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 0.12), walnutMat);
      leg.position.set(tx, bunkerFloorY + 0.36, -8.35 + tz);
      markInterior(leg, 0, 0x451a08);
    });
  });

  // Two field radio/telegraph consoles with glowing red & green indicator LEDs
  [-1.35, 1.25].forEach((rx) => {
    const radioBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.36, 0.48),
      blastSteelMat
    );
    radioBox.position.set(rx, bunkerFloorY + 0.95, -8.45);
    markInterior(radioBox, 0, 0x2f3b28);

    const redLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.6 })
    );
    redLed.position.set(rx - 0.18, bunkerFloorY + 1.0, -8.2);
    markInterior(redLed, 0, 0xef4444);

    const greenLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.6 })
    );
    greenLed.position.set(rx + 0.16, bunkerFloorY + 1.0, -8.2);
    markInterior(greenLed, 0, 0x22c55e);
  });

  // Iconic green banker's desk lamp at center of tactical table
  const lampStand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.11, 0.36, 12), goldBronzeMat);
  lampStand.position.set(0, bunkerFloorY + 0.95, -8.4);
  markInterior(lampStand, 0, 0xd97706);

  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.18, 12),
    new THREE.MeshStandardMaterial({
      color: 0x15803d,
      emissive: 0x22c55e,
      emissiveIntensity: 0.45,
      roughness: 0.25,
    })
  );
  lampShade.position.set(0, bunkerFloorY + 1.14, -8.35);
  markInterior(lampShade, 0, 0x15803d);

  addInteriorPointLight(0, bunkerFloorY + 1.55, -8.35, 0, 4.2, 13, 0xffdf9e);

  // ===========================================================================
  // 2. TẦNG TRỆT (Y = 0.88) — PHÒNG NỘI CÁC (WEST) + ĐẠI SẢNH & CẦU THANG ĐÔI CHỮ Y
  // ===========================================================================
  const groundFloorY = 0.88;

  // Polished marble lobby floor across center & East ground floor
  const groundLobbyFloor = new THREE.Mesh(
    new THREE.BoxGeometry(20.6, 0.08, 9.2),
    marbleFloorMat
  );
  groundLobbyFloor.position.set(5.4, groundFloorY, -1.6);
  markInterior(groundLobbyFloor, 0, 0xefe9de);

  // Phòng Nội Các (West Ground Wing: x = -15.8..-4.2, z = -5.8..+2.8)
  const cabinetCarpet = new THREE.Mesh(
    new THREE.BoxGeometry(10.8, 0.09, 8.2),
    crimsonCarpetMat
  );
  cabinetCarpet.position.set(-10.2, groundFloorY + 0.01, -1.5);
  markInterior(cabinetCarpet, 0, 0x7a161b);

  // U-shaped / Oval Glossy Reddish Gỗ Gõ Đỏ Conference Table (roughness: 0.25)
  const cabCenterX = -10.2;
  const cabCenterZ = -1.5;
  const cabTopNorth = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.11, 1.25),
    goDoWoodMat
  );
  cabTopNorth.position.set(cabCenterX, groundFloorY + 0.78, cabCenterZ - 2.0);
  markInterior(cabTopNorth, 0, 0x7c2d12);

  [-1.2, 1.2].forEach((sideX) => {
    const cabWing = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.11, 4.4),
      goDoWoodMat
    );
    cabWing.position.set(cabCenterX + sideX, groundFloorY + 0.78, cabCenterZ + 0.2);
    markInterior(cabWing, 0, 0x7c2d12);

    const cabBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.72, 3.8),
      walnutMat
    );
    cabBase.position.set(cabCenterX + sideX, groundFloorY + 0.38, cabCenterZ + 0.2);
    markInterior(cabBase, 0, 0x451a08);
  });

  // 20 Green Leather Chairs + 20 Conference Microphones via InstancedMesh (1 draw call each)
  const chairCoords: Array<{ x: number; z: number; rotY: number; micX: number; micZ: number }> = [];
  // 8 on outer West side, 8 on outer East side, 4 along North head
  for (let i = 0; i < 8; i++) {
    const zPos = cabCenterZ - 1.55 + i * 0.56;
    chairCoords.push({ x: cabCenterX - 2.15, z: zPos, rotY: Math.PI / 2, micX: cabCenterX - 1.55, micZ: zPos });
    chairCoords.push({ x: cabCenterX + 2.15, z: zPos, rotY: -Math.PI / 2, micX: cabCenterX + 1.55, micZ: zPos });
  }
  for (let i = 0; i < 4; i++) {
    const xPos = cabCenterX - 1.05 + i * 0.7;
    chairCoords.push({ x: xPos, z: cabCenterZ - 2.95, rotY: 0, micX: xPos, micZ: cabCenterZ - 2.38 });
  }

  const chairCount = chairCoords.length; // 20
  const cSeatInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.1, 0.46), greenLeatherMat, chairCount);
  const cBackInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.54, 0.09), greenLeatherMat, chairCount);
  const cLegInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.16, 0.42, 8), steelMat, chairCount);
  const micInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.045, 0.24, 8), steelMat, chairCount);

  const dummy = new THREE.Object3D();
  chairCoords.forEach((c, idx) => {
    dummy.position.set(c.x, groundFloorY + 0.45, c.z);
    dummy.rotation.set(0, c.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    cSeatInst.setMatrixAt(idx, dummy.matrix);

    const backOffsetX = -Math.sin(c.rotY) * 0.2;
    const backOffsetZ = -Math.cos(c.rotY) * 0.2;
    dummy.position.set(c.x + backOffsetX, groundFloorY + 0.72, c.z + backOffsetZ);
    dummy.updateMatrix();
    cBackInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(c.x, groundFloorY + 0.22, c.z);
    dummy.updateMatrix();
    cLegInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(c.micX, groundFloorY + 0.94, c.micZ);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    micInst.setMatrixAt(idx, dummy.matrix);
  });
  cSeatInst.instanceMatrix.needsUpdate = true;
  cBackInst.instanceMatrix.needsUpdate = true;
  cLegInst.instanceMatrix.needsUpdate = true;
  micInst.instanceMatrix.needsUpdate = true;
  markInterior(cSeatInst, 0, 0x1b4d3e);
  markInterior(cBackInst, 0, 0x1b4d3e);
  markInterior(cLegInst, 0, 0x334155);
  markInterior(micInst, 0, 0x334155);

  addInteriorPointLight(-10.2, 2.95, -1.5, 0, 3.8, 16, 0xffe4b5);

  // ===========================================================================
  // CẦU THANG ĐÔI CHỮ Y TRUNG TÂM (Ground Y=0.88 -> Landing Y=2.30 -> Floor 1 Y=3.74)
  // ===========================================================================
  // Central lower flight ascending toward -Z
  const lowerSteps = 9;
  for (let s = 0; s < lowerSteps; s++) {
    const t = (s + 0.5) / lowerSteps;
    const sy = groundFloorY + t * 1.42;
    const sz = 2.4 - t * 3.8;
    const stepBase = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 0.44), palaceWhiteMat);
    stepBase.position.set(0, sy, sz);
    markInterior(stepBase, 0, 0xffffff);

    const stepRunner = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.04, 0.44), crimsonCarpetMat);
    stepRunner.position.set(0, sy + 0.09, sz);
    markInterior(stepRunner, 0, 0x7a161b);
  }

  // Mid Landing Platform (y = 2.30)
  const midLanding = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.24, 1.9), palaceWhiteMat);
  midLanding.position.set(0, 2.24, -2.35);
  markInterior(midLanding, 0, 0xffffff);

  const midCarpet = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.04, 1.65), crimsonCarpetMat);
  midCarpet.position.set(0, 2.37, -2.35);
  markInterior(midCarpet, 0, 0x7a161b);

  // Left & Right Upper Flights branching outward (-X and +X) up to Floor 1 (y = 3.74)
  [-1, 1].forEach((dir) => {
    const upperSteps = 8;
    for (let s = 0; s < upperSteps; s++) {
      const t = (s + 0.5) / upperSteps;
      const sx = dir * (2.2 + t * 3.1);
      const sy = 2.34 + t * 1.38;
      const stepU = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 1.65), palaceWhiteMat);
      stepU.position.set(sx, sy, -2.35);
      markInterior(stepU, 0, 0xffffff);

      const runnerU = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 1.25), crimsonCarpetMat);
      runnerU.position.set(sx, sy + 0.09, -2.35);
      markInterior(runnerU, 0, 0x7a161b);
    }

    // Wooden balustrades along each upper wing flight
    const railU = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.08, 0.1), walnutMat);
    railU.position.set(dir * 3.75, 3.65, -1.52);
    railU.rotation.z = dir * 0.41;
    markInterior(railU, 0, 0x451a08);
  });

  // Twin teak handrails along the central lower flight
  [-1.38, 1.38].forEach((rx) => {
    const cRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 4.1), walnutMat);
    cRail.position.set(rx, 2.15, 0.5);
    cRail.rotation.x = 0.36;
    markInterior(cRail, 0, 0x451a08);
  });

  // ===========================================================================
  // 3. TẦNG 1 (Y = 3.75) — ĐẠI SẢNH, PHÒNG TRÌNH QUỐC THƯ (EAST) & KHÁNH TIẾT (WEST)
  // ===========================================================================
  const floor1Y = 3.75;

  // Floor 1 Marble Base (East & West wings, keeping center stairwell gallery framing clean)
  [-10.2, 10.2].forEach((fx) => {
    const f1Slab = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.07, 9.2), marbleFloorMat);
    f1Slab.position.set(fx, floor1Y, -1.6);
    markInterior(f1Slab, 1, 0xefe9de);
  });

  // Central Floor 1 Chandelier overlooking Đại Sảnh
  const makeChandelier = (cx: number, cy: number, cz: number, tier: number) => {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.65, 8), goldBronzeMat);
    rod.position.set(cx, cy, cz);
    markInterior(rod, tier, 0xd97706);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 8, 24), goldBronzeMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(cx, cy - 0.3, cz);
    markInterior(ring, tier, 0xd97706);

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 1), crystalGlowMat);
    core.position.set(cx, cy - 0.36, cz);
    markInterior(core, tier, 0xfff8e7);
  };
  makeChandelier(0, 6.0, -0.5, 1);
  addInteriorPointLight(0, 5.45, -0.5, 1, 4.2, 18, 0xffe4b5);

  // --- SPACE 3A: PHÒNG TRÌNH QUỐC THƯ (East Wing Floor 1: x = +4.6..+15.6) ---
  const credX = 10.2;
  const credCarpet = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.06, 6.6), brocadeCarpetMat);
  credCarpet.position.set(credX, floor1Y + 0.04, -1.6);
  markInterior(credCarpet, 1, 0x6f1419);

  // Focal Mural: Tranh Sơn Mài "Bình Ngô Đại Cáo / Giang Sơn Cẩm Tú" on North Wall (z = -5.4)
  const lacquerWallBacking = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 2.28, 0.16),
    walnutMat
  );
  lacquerWallBacking.position.set(credX, floor1Y + 1.28, -5.48);
  markInterior(lacquerWallBacking, 1, 0x451a08);

  const lacquerMural = new THREE.Mesh(
    new THREE.PlaneGeometry(5.9, 1.98),
    new THREE.MeshStandardMaterial({
      map: createBinhNgoLacquerTexture(),
      roughness: 0.28,
      metalness: 0.18,
    })
  );
  lacquerMural.position.set(credX, floor1Y + 1.28, -5.38);
  markInterior(lacquerMural, 1, 0x8b1a14);

  // Stepped Dais & Gilded Red-Lacquer Ceremonial Armchair
  const dais = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 2.2), walnutMat);
  dais.position.set(credX, floor1Y + 0.13, -3.7);
  markInterior(dais, 1, 0x451a08);

  const throneSeat = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.42, 0.78), redVelvetMat);
  throneSeat.position.set(credX, floor1Y + 0.44, -3.9);
  markInterior(throneSeat, 1, 0x991b1b);

  const throneBack = new THREE.Mesh(new THREE.BoxGeometry(0.96, 1.15, 0.14), goldBronzeMat);
  throneBack.position.set(credX, floor1Y + 0.92, -4.25);
  markInterior(throneBack, 1, 0xd97706);

  [-1.35, 1.35].forEach((ox) => {
    const envoyChair = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.72, 0.65), redVelvetMat);
    envoyChair.position.set(credX + ox, floor1Y + 0.42, -3.55);
    markInterior(envoyChair, 1, 0x991b1b);
  });

  // --- SPACE 3B: PHÒNG KHÁNH TIẾT (West Wing Floor 1: x = -15.6..-4.6) ---
  const banqX = -10.2;
  const banqCarpet = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.06, 7.2), crimsonCarpetMat);
  banqCarpet.position.set(banqX, floor1Y + 0.04, -1.6);
  markInterior(banqCarpet, 1, 0x7a161b);

  // Two long white-clothed banquet tables + 24 red-velvet InstancedMesh banquet chairs
  const banqChairs: Array<{ x: number; z: number }> = [];
  [-3.2, 0.1].forEach((bz) => {
    const tableCloth = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.68, 1.35),
      palaceWhiteMat
    );
    tableCloth.position.set(banqX, floor1Y + 0.4, bz);
    markInterior(tableCloth, 1, 0xffffff);

    for (let c = 0; c < 6; c++) {
      const cx = banqX - 2.75 + c * 1.1;
      banqChairs.push({ x: cx, z: bz - 0.92 });
      banqChairs.push({ x: cx, z: bz + 0.92 });
    }
  });

  const bChairSeatInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), redVelvetMat, banqChairs.length);
  const bChairBackInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.46, 0.07), goldBronzeMat, banqChairs.length);
  banqChairs.forEach((bc, idx) => {
    dummy.position.set(bc.x, floor1Y + 0.25, bc.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    bChairSeatInst.setMatrixAt(idx, dummy.matrix);

    const offsetZ = bc.z < -1.5 ? -0.18 : 0.18;
    dummy.position.set(bc.x, floor1Y + 0.65, bc.z + offsetZ);
    dummy.updateMatrix();
    bChairBackInst.setMatrixAt(idx, dummy.matrix);
  });
  bChairSeatInst.instanceMatrix.needsUpdate = true;
  bChairBackInst.instanceMatrix.needsUpdate = true;
  markInterior(bChairSeatInst, 1, 0x991b1b);
  markInterior(bChairBackInst, 1, 0xd97706);

  makeChandelier(banqX - 2.2, 6.05, -1.6, 1);
  makeChandelier(banqX + 2.2, 6.05, -1.6, 1);
  addInteriorPointLight(credX, 5.55, -1.8, 1, 3.8, 17, 0xffe4b5);
  addInteriorPointLight(banqX, 5.55, -1.6, 1, 3.6, 17, 0xffe4b5);

  // ===========================================================================
  // 4. TẦNG 2 (Y = 6.55) — PHÒNG LÀM VIỆC TỔNG THỐNG & LẦU TỨ PHƯƠNG VÔ SỰ (Y = 9.40)
  // ===========================================================================
  const floor2Y = 6.55;

  const floor2Slab = new THREE.Mesh(new THREE.BoxGeometry(26.5, 0.07, 9.0), marbleFloorMat);
  floor2Slab.position.set(0, floor2Y, -1.5);
  markInterior(floor2Slab, 2, 0xefe9de);

  const presRug = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.05, 5.8), brocadeCarpetMat);
  presRug.position.set(-4.8, floor2Y + 0.04, -1.4);
  markInterior(presRug, 2, 0x6f1419);

  // Presidential Carved Walnut Desk + Tufted Leather Chair + Brass Globe + Flags
  const presDesk = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.78, 1.45), walnutMat);
  presDesk.position.set(-4.8, floor2Y + 0.44, -2.1);
  markInterior(presDesk, 2, 0x451a08);

  const presChairBack = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.15, 0.22), greenLeatherMat);
  presChairBack.position.set(-4.8, floor2Y + 0.72, -3.25);
  markInterior(presChairBack, 2, 0x1b4d3e);

  const globeStand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 0.28, 10), goldBronzeMat);
  globeStand.position.set(-3.55, floor2Y + 0.96, -2.0);
  markInterior(globeStand, 2, 0xd97706);

  const globeSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35, metalness: 0.15 })
  );
  globeSphere.position.set(-3.55, floor2Y + 1.2, -2.0);
  markInterior(globeSphere, 2, 0x2563eb);

  // VIP Reception Lounge Sofas (East side of Floor 2)
  const vipRug = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.05, 5.2), crimsonCarpetMat);
  vipRug.position.set(5.4, floor2Y + 0.04, -1.4);
  markInterior(vipRug, 2, 0x7a161b);

  const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.84, 0.85), greenLeatherMat);
  sofaBack.position.set(5.4, floor2Y + 0.48, -2.65);
  markInterior(sofaBack, 2, 0x1b4d3e);

  const coffeeTable = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.42, 1.1), goDoWoodMat);
  coffeeTable.position.set(5.4, floor2Y + 0.26, -1.0);
  markInterior(coffeeTable, 2, 0x7c2d12);

  addInteriorPointLight(-3.8, 8.45, -1.5, 2, 3.8, 17, 0xffe4b5);
  addInteriorPointLight(5.4, 8.45, -1.4, 2, 3.2, 15, 0xffe4b5);

  // --- SPACE 4B: NỘI THẤT LẦU TỨ PHƯƠNG VÔ SỰ (Rooftop Y = 9.40..11.95, Z = -1.5..+4.1) ---
  const pavBaseY = 9.39;
  const pavCenterZ = 1.3;

  const pavWoodFloor = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.08, 4.9), goDoWoodMat);
  pavWoodFloor.position.set(0, pavBaseY + 0.05, pavCenterZ);
  markInterior(pavWoodFloor, 3, 0x7c2d12);

  // 8 Characteristic Vermilion Red Lacquered Columns inside Tứ Phương Vô Sự
  [-5.5, -1.85, 1.85, 5.5].forEach((cx) => {
    [-1.7, 1.7].forEach((cz) => {
      const redCol = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 2.48, 14), vermilionColMat);
      redCol.position.set(cx, pavBaseY + 1.28, pavCenterZ + cz);
      markInterior(redCol, 3, 0xa4161a);
    });
  });

  // Carved rosewood tea table & 4 round stools facing Lê Duẩn Avenue (+Z)
  const teaTable = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.72, 0.62, 8), walnutMat);
  teaTable.position.set(0, pavBaseY + 0.36, pavCenterZ + 0.2);
  markInterior(teaTable, 3, 0x451a08);

  [
    [-1.25, 0.2],
    [1.25, 0.2],
    [0, -0.95],
    [0, 1.35],
  ].forEach(([sx, sz]) => {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.42, 12), goDoWoodMat);
    stool.position.set(sx, pavBaseY + 0.25, pavCenterZ + sz);
    markInterior(stool, 3, 0x7c2d12);
  });

  // Carved perimeter railing inside pavilion
  const pavRailFront = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.68, 0.12), walnutMat);
  pavRailFront.position.set(0, pavBaseY + 0.4, pavCenterZ + 2.25);
  markInterior(pavRailFront, 3, 0x451a08);

  addInteriorPointLight(0, pavBaseY + 2.1, pavCenterZ, 3, 3.6, 15, 0xffe4b5);

  // ===========================================================================
  // 5. SÂN ĐÁP TRỰC THĂNG HELIPAD (08/04/1975) & MÔ HÌNH TRỰC THĂNG UH-1 IROQUOIS
  // ===========================================================================
  const helipadZ = -5.6;
  const helipadDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(3.05, 3.12, 0.08, 48),
    new THREE.MeshStandardMaterial({
      map: createHelipadAndBombMarksTexture(),
      roughness: 0.74,
      metalness: 0.06,
    })
  );
  helipadDeck.position.set(0, pavBaseY + 0.04, helipadZ);
  addPalacePart(helipadDeck, 3, 0x56606b);

  // Olive-Drab UH-1 Iroquois Helicopter parked on the Helipad
  const heliGroup = new THREE.Group();
  heliGroup.position.set(0.2, pavBaseY + 0.08, helipadZ - 0.1);
  heliGroup.rotation.y = 0.42;

  const registerHeliMesh = (m: THREE.Mesh, col: number) => {
    m.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), heliGroup.rotation.y);
    m.position.add(heliGroup.position);
    m.rotation.y += heliGroup.rotation.y;
    markInterior(m, 3, col);
  };

  // Main Fuselage Cabin
  const heliBody = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.88, 2.35), oliveDrabMat);
  heliBody.position.set(0, 0.72, 0);
  registerHeliMesh(heliBody, 0x434f38);

  // Tapered Nose + Translucent Cockpit Glass
  const heliNose = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.64, 0.92), heliGlassMat);
  heliNose.position.set(0, 0.66, 1.52);
  registerHeliMesh(heliNose, 0x1e293b);

  // Tubular Landing Skids
  [-0.58, 0.58].forEach((skX) => {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.95, 8), steelMat);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(skX, 0.08, 0.18);
    registerHeliMesh(skid, 0x334155);

    [-0.65, 0.75].forEach((stZ) => {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 8), steelMat);
      strut.position.set(skX * 0.85, 0.24, stZ);
      registerHeliMesh(strut, 0x334155);
    });
  });

  // Tail Boom + Vertical Fin + Tail Rotor
  const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.28, 2.45, 10), oliveDrabMat);
  tailBoom.rotation.x = Math.PI / 2;
  tailBoom.position.set(0, 0.82, -2.25);
  registerHeliMesh(tailBoom, 0x434f38);

  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.82, 0.42), oliveDrabMat);
  tailFin.position.set(0, 1.18, -3.35);
  registerHeliMesh(tailFin, 0x434f38);

  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.09), goldBronzeMat);
  tailRotor.position.set(0.1, 1.42, -3.45);
  registerHeliMesh(tailRotor, 0xd97706);

  // Main Rotor Mast & Twin Blades (mounted in a spinning group on tier 3)
  const rotorMast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.42, 10), steelMat);
  rotorMast.position.set(0, 1.35, -0.05);
  registerHeliMesh(rotorMast, 0x334155);

  const rotorGroup = new THREE.Group();
  rotorGroup.position.set(
    heliGroup.position.x - Math.sin(heliGroup.rotation.y) * 0.05,
    pavBaseY + 1.62,
    heliGroup.position.z - Math.cos(heliGroup.rotation.y) * 0.05
  );
  rotorGroup.userData.isHeliRotor = true;
  rotorGroup.userData.elevationTier = 3;
  rotorGroup.userData.origY = rotorGroup.position.y;

  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.4,
    metalness: 0.55,
  });
  const mainBlade = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.035, 0.22), bladeMat);
  mainBlade.castShadow = true;
  mainBlade.userData.isInterior = true;
  rotorGroup.add(mainBlade);

  const stabilizerBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 1.45), bladeMat);
  stabilizerBar.userData.isInterior = true;
  rotorGroup.add(stabilizerBar);

  addPalacePart(rotorGroup, 3, 0x1e293b);
}
