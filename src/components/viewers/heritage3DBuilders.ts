import * as THREE from 'three';
import {
  addBoxPart,
  addInteriorWarmLight,
  buildContactShadowPad,
  buildFrenchArchedArcadeWall,
  buildOrganicTree,
  buildTraditionalTieredRoof,
  buildTurnedPillarWithPlinth,
  getBlueStoneTerraceTex,
  getDarkTimberWallTex,
  getLouveredWoodShutterTex,
  getMotherOfPearlInlayTex,
  getStratifiedEarthTex,
  getTerracottaCourtyardTex,
  getTimberGrainTex,
  getTraditionalWallTex,
  getWeatheredMossyTileTex,
  getYinYangTileTex,
  registerMeshNode,
} from './heritage3DTextures';

export interface HeritageHotspotFeature {
  id: string;
  name: string;
  description: string;
  cameraPos: [number, number, number];
  targetPos: [number, number, number];
  thumbnailUrl: string;
}

export const NEW_NINE_SITE_IDS = [
  'HCM-DT-008',
  'HCM-DT-010',
  'HCM-DT-011',
  'HCM-DT-012',
  'BRVT-DT-001',
  'BRVT-DT-002',
  'BRVT-DT-003',
  'BD-DT-001',
  'BD-DT-002',
] as const;

export const SUBSURFACE_CUTAWAY_SITE_IDS = [
  'HCM-DT-009',
  'HCM-DT-010',
  'BRVT-DT-003',
  'BD-DT-002',
] as const;

/**
 * Helper: Gắn set vật liệu PBR đầy đủ (map + bumpMap + roughnessMap)
 */
function makePbrMat(
  tex: { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture },
  opts: {
    color?: number | string | THREE.Color;
    bumpScale?: number;
    roughness?: number;
    metalness?: number;
    side?: THREE.Side;
  } = {}
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: opts.color ?? 0xffffff,
    map: tex.map,
    bumpMap: tex.bumpMap,
    bumpScale: opts.bumpScale ?? 0.08,
    roughnessMap: tex.roughnessMap,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.04,
    side: opts.side ?? THREE.FrontSide,
  });
}

/**
 * Helper: Tạo bao lam chạm lộng vòm cuốn sơn son thếp vàng bằng ExtrudeGeometry
 */
function buildCarvedBaoLamArch(
  group: THREE.Group,
  cx: number,
  y: number,
  cz: number,
  width: number,
  height: number,
  goldMat: THREE.Material,
  lacquerMat: THREE.Material,
  tier: number,
  isInterior = true
) {
  const shape = new THREE.Shape();
  const hw = width / 2;
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, height);
  shape.lineTo(-hw, height);
  shape.closePath();

  const hole = new THREE.Path();
  const archR = hw * 0.68;
  hole.moveTo(-archR, 0);
  hole.lineTo(-archR, height * 0.36);
  hole.absarc(0, height * 0.36, archR, Math.PI, 0, true);
  hole.lineTo(archR, 0);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 14,
  });
  geo.translate(0, 0, -0.06);
  const arch = new THREE.Mesh(geo, goldMat);
  arch.position.set(cx, y, cz);
  registerMeshNode(group, arch, tier, false, { isInterior });

  addBoxPart(group, width * 0.86, 0.22, 0.15, lacquerMat, cx, y + height - 0.15, cz, tier, false, { isInterior });
}

// =============================================================================
// 1. LĂNG TẢ QUÂN LÊ VĂN DUYỆT (LĂNG ÔNG BÀ CHIỂU — TP.HCM) [HCM-DT-008]
// =============================================================================
function buildLeVanDuyetTomb(group: THREE.Group) {
  const yardMat = makePbrMat(getTerracottaCourtyardTex(7, 6), { bumpScale: 0.08, roughness: 0.86 });
  const roofMat = makePbrMat(getYinYangTileTex('aged_terracotta', 5, 4), { bumpScale: 0.14, roughness: 0.42 });
  const wallMat = makePbrMat(getTraditionalWallTex('yellow_temple', 4, 2), { bumpScale: 0.06, roughness: 0.8 });
  const woodMat = makePbrMat(getTimberGrainTex('cam_xe', 2, 2), { bumpScale: 0.05, roughness: 0.45 });
  const lacquerMat = makePbrMat(getTimberGrainTex('gilded_lacquer', 2, 2), { bumpScale: 0.04, roughness: 0.35, metalness: 0.14 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe3b444, roughness: 0.26, metalness: 0.82 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9b958b, roughness: 0.8 });
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x5c4220, roughness: 0.36, metalness: 0.78 });
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x2c2420, roughness: 0.65 });
  const limeTombMat = new THREE.MeshStandardMaterial({ color: 0x847d72, roughness: 0.88 });

  // Sân lát gạch tàu & thềm đá xanh
  addBoxPart(group, 36, 0.34, 30, yardMat, 0, 0.17, 0, 0, true);
  addBoxPart(group, 19.2, 0.26, 18.2, stoneMat, 0, 0.45, -2.2, 0);
  buildContactShadowPad(group, 0, 0.35, 6.2, 1.4, 1.4, 0, 0.45);

  // Tường bao sơn vàng cổ & mái ngói âm dương
  const wallY = 1.45;
  addBoxPart(group, 0.48, 2.2, 29.2, wallMat, -17.5, wallY, 0, 0.4);
  addBoxPart(group, 0.48, 2.2, 29.2, wallMat, 17.5, wallY, 0, 0.4);
  addBoxPart(group, 35.4, 2.2, 0.48, wallMat, 0, wallY, -14.5, 0.4);
  addBoxPart(group, 11.4, 2.2, 0.48, wallMat, -11.9, wallY, 14.2, 0.4);
  addBoxPart(group, 11.4, 2.2, 0.48, wallMat, 11.9, wallY, 14.2, 0.4);
  addBoxPart(group, 0.78, 0.26, 29.6, roofMat, -17.5, 2.66, 0, 0.4);
  addBoxPart(group, 0.78, 0.26, 29.6, roofMat, 17.5, 2.66, 0, 0.4);
  addBoxPart(group, 35.8, 0.26, 0.78, roofMat, 0, 2.66, -14.5, 0.4);

  // Cổng Tam Quan cổ kính với 3 vòm cuốn thật (ExtrudeGeometry) & mái chồng diêm cong đầu đao + Lưỡng long chầu nguyệt
  buildFrenchArchedArcadeWall(group, 0, 0.34, 13.8, 10.6, 4.1, 0.92, 3, 2.05, 2.25, wallMat, goldMat, null, 0.8);
  for (const px of [-4.6, -1.7, 1.7, 4.6]) {
    addBoxPart(group, 0.85, 0.32, 1.15, stoneMat, px, 0.5, 13.8, 0.6);
  }
  addBoxPart(group, 2.8, 0.82, 0.16, lacquerMat, 0, 4.1, 14.32, 0.8);
  addBoxPart(group, 2.3, 0.48, 0.18, goldMat, 0, 4.1, 14.36, 0.8);
  buildTraditionalTieredRoof(group, 0, 4.44, 13.8, 12.2, 3.8, 1.65, roofMat, ridgeMat, goldMat, 2.3, true, 0.34);
  buildTraditionalTieredRoof(group, 0, 5.95, 13.8, 6.8, 2.6, 1.45, roofMat, ridgeMat, goldMat, 2.6, true, 0.32);

  // Bức Bình Phong chạm Rồng Hổ (z = +9.8)
  addBoxPart(group, 5.0, 0.42, 1.05, stoneMat, 0, 0.55, 9.8, 0.2);
  addBoxPart(group, 4.4, 2.45, 0.42, wallMat, 0, 1.98, 9.8, 0.5);
  addBoxPart(group, 3.5, 1.65, 0.48, stoneMat, 0, 1.98, 9.8, 0.5);
  const medallionDragon = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.1, 10, 20), goldMat);
  medallionDragon.position.set(0, 2.02, 10.08);
  registerMeshNode(group, medallionDragon, 0.5);
  const tigerRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 8, 16), lacquerMat);
  tigerRing.position.set(0, 2.02, 10.12);
  registerMeshNode(group, tigerRing, 0.5);
  buildTraditionalTieredRoof(group, 0, 3.18, 9.8, 5.1, 1.6, 0.92, roofMat, ridgeMat, goldMat, 1.8, false, 0.22);

  // Đỉnh đồng lớn đặt trước Tiền điện (z = +6.2)
  addBoxPart(group, 1.4, 0.36, 1.4, stoneMat, 0, 0.52, 6.2, 0.1);
  const cauldron = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.42, 0.08),
        new THREE.Vector2(0.28, 0.35),
        new THREE.Vector2(0.54, 0.65),
        new THREE.Vector2(0.48, 0.95),
        new THREE.Vector2(0.58, 1.04),
        new THREE.Vector2(0.2, 1.26),
        new THREE.Vector2(0.0, 1.38),
      ],
      18
    ),
    bronzeMat
  );
  cauldron.position.set(0, 0.7, 6.2);
  registerMeshNode(group, cauldron, 0.2);

  // Nhà Bia Đá Cổ Phan Thanh Giản bên trái sân trước (x = -9.5, z = +7.5)
  addBoxPart(group, 4.6, 0.35, 4.6, stoneMat, -9.5, 0.52, 7.5, 0);
  for (const sx of [-11.1, -7.9]) {
    for (const sz of [5.9, 9.1]) {
      buildTurnedPillarWithPlinth(group, sx, 0.7, sz, 2.9, 0.15, lacquerMat, stoneMat, 1);
    }
  }
  addBoxPart(group, 1.35, 0.38, 0.85, stoneMat, -9.5, 0.88, 7.5, 0.3);
  addBoxPart(group, 1.15, 1.85, 0.28, stoneMat, -9.5, 1.85, 7.5, 0.4);
  buildTraditionalTieredRoof(group, -9.5, 3.6, 7.5, 5.5, 5.5, 1.85, roofMat, ridgeMat, goldMat, 2.3, false, 0.26);

  // 3 Điện Trùng Thiềm Điệp Ốc: Tiền điện (+2.8), Trung điện (-1.9), Chính điện (-6.8)
  const halls = [
    { cz: 2.8, w: 15.0, d: 4.5, h: 3.45, roofH: 2.15 },
    { cz: -1.9, w: 13.8, d: 4.2, h: 3.65, roofH: 2.05 },
    { cz: -6.8, w: 15.4, d: 5.0, h: 3.95, roofH: 2.4 },
  ];

  halls.forEach((h, idx) => {
    addBoxPart(group, 0.38, h.h, h.d, wallMat, -h.w / 2 + 0.19, 0.58 + h.h / 2, h.cz, 1.0);
    addBoxPart(group, 0.38, h.h, h.d, wallMat, h.w / 2 - 0.19, 0.58 + h.h / 2, h.cz, 1.0);
    if (idx === 2) {
      addBoxPart(group, h.w, h.h, 0.38, wallMat, 0, 0.58 + h.h / 2, h.cz - h.d / 2 + 0.19, 1.0);
    }

    // Hệ cột gỗ sơn son & vì kèo nâng đỡ mái
    for (const cx of [-5.6, -2.8, 0, 2.8, 5.6]) {
      for (const dz of [-h.d * 0.32, h.d * 0.32]) {
        buildTurnedPillarWithPlinth(group, cx, 0.58, h.cz + dz, h.h, 0.16, lacquerMat, stoneMat, 0.6, true);
      }
      addBoxPart(group, 0.22, 0.24, h.d - 0.5, woodMat, cx, 0.58 + h.h - 0.18, h.cz, 1.1, false, { isInterior: true });
    }

    buildTraditionalTieredRoof(group, 0, 0.58 + h.h, h.cz, h.w + 2.0, h.d + 1.5, h.roofH, roofMat, ridgeMat, goldMat, 2.5, true, 0.3);
  });

  // Nội thất PBR bên trong: Hương án sơn son thếp vàng, Bao lam chạm lộng, Khám thờ & Giá binh khí Bát Bửu
  addInteriorWarmLight(group, 0, 3.5, -6.5, 0.5, 2.6, 13, 0xffaa33);
  addInteriorWarmLight(group, 0, 3.2, 2.6, 0.5, 2.1, 11, 0xffad44);

  // Bao lam chạm lộng thếp vàng ở Tiền điện & Chính điện
  buildCarvedBaoLamArch(group, 0, 1.85, 3.6, 4.4, 2.0, goldMat, lacquerMat, 0.6, true);
  buildCarvedBaoLamArch(group, 0, 1.95, -5.3, 4.8, 2.3, goldMat, lacquerMat, 0.6, true);

  // Hương án lớn Tiền điện & Trung điện
  for (const az of [2.6, -1.9]) {
    addBoxPart(group, 3.2, 1.15, 1.1, lacquerMat, 0, 1.14, az, 0.3, false, { isInterior: true });
    addBoxPart(group, 3.38, 0.14, 1.24, goldMat, 0, 1.74, az, 0.3, false, { isInterior: true });
    const censer = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.38, 12), goldMat);
    censer.position.set(0, 1.98, az);
    registerMeshNode(group, censer, 0.3, false, { isInterior: true });
    for (const cx of [-0.95, 0.95]) {
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.42, 8), goldMat);
      candle.position.set(cx, 2.0, az);
      registerMeshNode(group, candle, 0.3, false, { isInterior: true });
    }
  }

  // Khám thờ Tả quân Lê Văn Duyệt & Nhị vị phu nhân ở Chính điện (z = -7.8)
  addBoxPart(group, 5.8, 0.45, 2.2, stoneMat, 0, 0.78, -7.8, 0.2, false, { isInterior: true });
  addBoxPart(group, 3.6, 2.5, 1.35, lacquerMat, 0, 2.25, -8.0, 0.3, false, { isInterior: true });
  addBoxPart(group, 2.6, 2.1, 0.18, goldMat, 0, 2.2, -7.3, 0.3, false, { isInterior: true });

  // Giá binh khí Bát Bửu nghi trượng (8 cây kích/lọng đồng hai bên điện thờ)
  for (const side of [-1, 1]) {
    addBoxPart(group, 0.35, 0.25, 6.2, lacquerMat, side * 4.4, 0.72, -1.35, 0.25, false, { isInterior: true });
    for (let w = 0; w < 4; w++) {
      const wz = -4.2 + w * 1.9;
      const wx = side * 4.4;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), lacquerMat);
      shaft.position.set(wx, 1.76, wz);
      registerMeshNode(group, shaft, 0.3, false, { isInterior: true });
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 5), goldMat);
      blade.position.set(wx, 3.08, wz);
      registerMeshNode(group, blade, 0.3, false, { isInterior: true });
    }
  }

  // Khu Mộ Song Táng hình nấm rùa phía sau Chính điện (z = -11.8)
  addBoxPart(group, 11.6, 0.3, 4.6, stoneMat, 0, 0.48, -11.8, 0);
  addBoxPart(group, 11.8, 0.95, 0.32, wallMat, 0, 1.1, -9.5, 0.2);
  addBoxPart(group, 11.8, 0.95, 0.32, wallMat, 0, 1.1, -13.9, 0.2);
  for (const mx of [-2.4, 2.4]) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1.75, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), limeTombMat);
    mound.scale.set(1.05, 0.64, 1.4);
    mound.position.set(mx, 0.62, -11.8);
    registerMeshNode(group, mound, 0.2, false, { isInterior: true });
    addBoxPart(group, 1.25, 0.65, 0.22, stoneMat, mx, 0.95, -10.35, 0.2, false, { isInterior: true });
  }

  // Cây hoa sứ cổ thụ & cây đa sân lăng
  buildOrganicTree(group, -13.8, 0.34, 10.5, 1.18, 0.5, 'frangipani');
  buildOrganicTree(group, 13.8, 0.34, 10.5, 1.15, 0.5, 'frangipani');
  buildOrganicTree(group, -14.2, 0.34, -8.5, 1.22, 0.5, 'banyan_bodhi');
  buildOrganicTree(group, 14.2, 0.34, -8.5, 1.12, 0.5, 'banyan_bodhi');
}

// =============================================================================
// 2. KHU DI TÍCH KHẢO CỔ HỌC GIỒNG CÁ VỒ (CẦN GIỜ — TP.HCM) [HCM-DT-010]
// =============================================================================
function buildGiongCaVoArchaeology(group: THREE.Group) {
  const earthCliffMat = makePbrMat(getStratifiedEarthTex('coastal_sand_peat', 2, 1), { bumpScale: 0.18, roughness: 0.92 });
  const sandSurfaceMat = new THREE.MeshStandardMaterial({ color: 0xbfa172, roughness: 0.9 });
  const culturalSoilMat = new THREE.MeshStandardMaterial({ color: 0x694d34, roughness: 0.94 });
  const peatBaseMat = new THREE.MeshStandardMaterial({ color: 0x36322d, roughness: 0.95 });
  const jarClayMat = new THREE.MeshStandardMaterial({ color: 0xb45c38, roughness: 0.62, metalness: 0.05 });
  const jarCylMat = new THREE.MeshStandardMaterial({ color: 0x9b4b2c, roughness: 0.65, metalness: 0.05 });
  const jarInsideMat = new THREE.MeshStandardMaterial({ color: 0x4b2a1b, roughness: 0.85, side: THREE.DoubleSide });
  const nephriteMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: new THREE.Color(0x047857), emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.15 });
  const agateMat = new THREE.MeshStandardMaterial({ color: 0xea580c, emissive: new THREE.Color(0xc2410c), emissiveIntensity: 0.3, roughness: 0.22, metalness: 0.1 });
  const goldArtifactMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: new THREE.Color(0xb45309), emissiveIntensity: 0.35, roughness: 0.24, metalness: 0.86 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.78 });
  const canopyRoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.35 });
  const stakeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 });
  const tideWaterMat = new THREE.MeshStandardMaterial({ color: 0x1d5b64, roughness: 0.15, metalness: 0.42, transparent: true, opacity: 0.86 });

  // Mặt cắt địa tầng Cần Giờ (y = -2.8..+1.6)
  addBoxPart(group, 26, 1.4, 22, peatBaseMat, 0, -2.1, 0, 0, false, { noShadow: true });
  addBoxPart(group, 26, 1.8, 6.5, earthCliffMat, 0, -0.5, -7.75, 0.8, false, { noShadow: true });
  addBoxPart(group, 4.5, 1.8, 15.5, earthCliffMat, -10.75, -0.5, 3.25, 0.8, false, { noShadow: true });
  addBoxPart(group, 4.5, 1.8, 15.5, earthCliffMat, 10.75, -0.5, 3.25, 0.8, false, { noShadow: true });
  addBoxPart(group, 17, 0.28, 15.5, culturalSoilMat, 0, -1.26, 3.25, 0);

  // Lớp cát giồng bề mặt (tier = 1.8)
  addBoxPart(group, 26, 1.0, 6.5, sandSurfaceMat, 0, 0.9, -7.75, 1.8);
  addBoxPart(group, 4.5, 1.0, 15.5, sandSurfaceMat, -10.75, 0.9, 3.25, 1.8);
  addBoxPart(group, 4.5, 1.0, 15.5, sandSurfaceMat, 10.75, 0.9, 3.25, 1.8);

  // Lạch nước triều rừng ngập mặn Cần Giờ bên phải
  addBoxPart(group, 3.8, 0.45, 22.2, tideWaterMat, 11.4, 0.38, 0, 0.2);

  // Lưới dây chia ô vuông hố khai quật + cọc mốc gỗ ở từng giao điểm
  const cordMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
  for (let gx = -8; gx <= 8; gx += 4) {
    addBoxPart(group, 0.04, 0.04, 14.5, cordMat, gx, 0.44, 3.2, 1.1);
    for (let gz = -4; gz <= 9; gz += 3.25) {
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.9, 6), stakeMat);
      stake.position.set(gx, 0.08, gz);
      registerMeshNode(group, stake, 1.1);
    }
  }
  for (let gz = -4; gz <= 9; gz += 3.25) {
    addBoxPart(group, 16.5, 0.04, 0.04, cordMat, 0, 0.44, gz, 1.1);
  }

  // Hai dáng Mộ Chum Gốm Cổ (THREE.LatheGeometry): Chum Hình Cầu Trứng & Chum Hình Trụ Cổ Đứng
  const ovoidJarGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.32, 0.04),
      new THREE.Vector2(0.58, 0.42),
      new THREE.Vector2(0.64, 0.76),
      new THREE.Vector2(0.52, 1.12),
      new THREE.Vector2(0.6, 1.26),
    ],
    22
  );
  const cylindricalJarGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.42, 0.04),
      new THREE.Vector2(0.52, 0.35),
      new THREE.Vector2(0.54, 0.92),
      new THREE.Vector2(0.46, 1.18),
      new THREE.Vector2(0.56, 1.32),
    ],
    22
  );

  // 28 cụm Mộ Chum phân bố 2 tầng địa tầng (cạn & sâu)
  const jarCoords: Array<[number, number, number, boolean, boolean]> = [
    [-6.4, -2.0, 0.98, false, false], [-3.8, -2.3, 1.1, true, true], [-1.2, -1.6, 0.94, false, true], [1.6, -2.1, 1.08, true, false], [4.5, -1.8, 0.98, false, true], [6.8, -2.2, 0.92, false, false],
    [-6.6, 1.3, 1.04, true, true], [-4.1, 1.0, 0.95, false, false], [-1.3, 1.5, 1.16, true, false], [1.4, 1.2, 1.0, false, true], [4.1, 1.5, 1.12, true, true], [6.6, 1.0, 0.94, false, false],
    [-6.0, 4.4, 0.96, false, true], [-3.3, 4.1, 1.14, true, false], [-0.5, 4.7, 0.98, false, true], [2.2, 4.3, 1.08, true, true], [5.0, 4.8, 1.0, false, false], [6.9, 4.4, 0.92, false, true],
    [-5.8, 7.6, 1.06, true, false], [-2.8, 7.3, 0.98, false, true], [0.2, 7.8, 1.14, true, true], [3.0, 7.4, 0.96, false, false], [5.8, 7.7, 1.06, true, true],
    [-2.4, -0.2, 0.88, true, false], [0.4, 2.8, 0.9, false, true], [2.8, 0.1, 0.92, true, true], [-4.8, 6.1, 0.88, false, false], [4.4, 6.2, 0.92, true, false],
  ];

  jarCoords.forEach(([jx, jz, scale, isOpen, isCyl], idx) => {
    const jy = idx >= 23 ? -1.45 : -1.12;
    const jar = new THREE.Mesh(
      isCyl ? cylindricalJarGeo : ovoidJarGeo,
      isOpen ? jarInsideMat : isCyl ? jarCylMat : jarClayMat
    );
    jar.scale.setScalar(scale);
    jar.position.set(jx, jy, jz);
    jar.rotation.z = idx % 5 === 0 ? 0.14 : idx % 4 === 0 ? -0.1 : 0;
    registerMeshNode(group, jar, 0.2, false, { isInterior: true });

    if (!isOpen) {
      const lid = new THREE.Mesh(
        new THREE.SphereGeometry(0.58 * scale, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45),
        jarClayMat
      );
      lid.position.set(jx, jy + 1.16 * scale, jz);
      registerMeshNode(group, lid, 0.4, false, { isInterior: true });
    } else {
      // Hiện vật tùy táng bằng vàng, đá ngọc nephrite & mã não nổi bật trong X-Ray
      const e1 = new THREE.Mesh(new THREE.TorusGeometry(0.18 * scale, 0.055 * scale, 8, 14, Math.PI * 1.4), nephriteMat);
      e1.rotation.x = Math.PI / 2;
      e1.position.set(jx - 0.12, jy + 0.62 * scale, jz + 0.06);
      registerMeshNode(group, e1, 0.25, false, { isInterior: true });

      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.1 * scale, 8, 8), agateMat);
      bead.position.set(jx + 0.16, jy + 0.58 * scale, jz - 0.08);
      registerMeshNode(group, bead, 0.25, false, { isInterior: true });

      const vessel = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scale, 0.12 * scale, 0.24 * scale, 12), goldArtifactMat);
      vessel.position.set(jx, jy + 0.48 * scale, jz);
      registerMeshNode(group, vessel, 0.25, false, { isInterior: true });
    }
  });

  addInteriorWarmLight(group, 0, 2.2, 3.0, 0.5, 2.4, 15, 0xffd28a);

  // Hệ giàn mái bảo tồn hố khai quật (elevationTier = 2.6)
  for (const px of [-9.2, 9.2]) {
    for (const pz of [-4.2, 3.2, 10.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 5.2, 8), steelMat);
      post.position.set(px, 3.5, pz);
      registerMeshNode(group, post, 1.5);
    }
  }
  const roofL = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.18, 16.5), canopyRoofMat);
  roofL.position.set(-5.0, 6.65, 3.1);
  roofL.rotation.z = 0.22;
  registerMeshNode(group, roofL, 2.6);

  const roofR = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.18, 16.5), canopyRoofMat);
  roofR.position.set(5.0, 6.65, 3.1);
  roofR.rotation.z = -0.22;
  registerMeshNode(group, roofR, 2.6);

  // Rừng đước Cần Giờ rễ chống trên gò đất ven triều
  buildOrganicTree(group, -10.8, 1.4, -7.8, 1.18, 1.8, 'mangrove');
  buildOrganicTree(group, 0, 1.4, -8.4, 1.25, 1.8, 'mangrove');
  buildOrganicTree(group, 9.8, 1.4, -7.6, 1.12, 1.8, 'mangrove');
  buildOrganicTree(group, -10.8, 1.4, 6.2, 1.08, 1.8, 'mangrove');
}

// =============================================================================
// 3. CHÙA GIÁC LÂM (QUẬN TÂN BÌNH — TP.HCM) [HCM-DT-011]
// =============================================================================
function buildGiacLamPagoda(group: THREE.Group) {
  const yardMat = makePbrMat(getTerracottaCourtyardTex(7, 6), { bumpScale: 0.08, roughness: 0.86 });
  const roofMat = makePbrMat(getYinYangTileTex('aged_terracotta', 5, 4), { bumpScale: 0.14, roughness: 0.44 });
  const woodMat = makePbrMat(getTimberGrainTex('cam_xe', 2, 2), { bumpScale: 0.05, roughness: 0.45 });
  const lacquerMat = makePbrMat(getTimberGrainTex('gilded_lacquer', 2, 2), { bumpScale: 0.04, roughness: 0.36 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe3b444, roughness: 0.24, metalness: 0.84 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xa69e90, roughness: 0.78 });
  const creamStupaMat = new THREE.MeshStandardMaterial({ color: 0xe8dfd0, roughness: 0.62 });
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x3b2820, roughness: 0.68 });

  // Sân chùa & nền đá xanh
  addBoxPart(group, 36, 0.32, 30, yardMat, 0, 0.16, 0, 0, true);
  addBoxPart(group, 19.8, 0.28, 22.4, stoneMat, 2.5, 0.44, -2.0, 0);
  buildContactShadowPad(group, -11.2, 0.32, 7.5, 3.6, 3.6, 0, 0.45);

  // 1) BẢO THÁP XÁ LỢI 7 TẦNG HÌNH LỤC GIÁC (lan can từng tầng & mái cong 6 góc)
  addBoxPart(group, 6.0, 0.6, 6.0, stoneMat, -11.2, 0.62, 7.5, 0);
  for (let level = 0; level < 7; level++) {
    const r = 2.2 - level * 0.22;
    const baseY = 0.92 + level * 1.48;
    const tierVal = level < 3 ? 0.5 : level < 5 ? 1.4 : 2.3;

    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, 1.22, 6), creamStupaMat);
    body.position.set(-11.2, baseY + 0.61, 7.5);
    registerMeshNode(group, body, tierVal);

    // Lan can lục giác bao quanh từng tầng tháp
    const balustrade = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.18, 0.22, 6, 1, true), stoneMat);
    balustrade.material = stoneMat.clone();
    balustrade.material.side = THREE.DoubleSide;
    balustrade.position.set(-11.2, baseY + 0.12, 7.5);
    registerMeshNode(group, balustrade, tierVal);

    // Mái hắt lục giác uốn cong nhẹ & đầu góc vàng
    const eave = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 1.32, 0.28, 6), roofMat);
    eave.position.set(-11.2, baseY + 1.32, 7.5);
    registerMeshNode(group, eave, tierVal + 0.2);

    for (let c = 0; c < 6; c++) {
      const ang = (c / 6) * Math.PI * 2 + Math.PI / 6;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 4), goldMat);
      tip.position.set(-11.2 + Math.cos(ang) * r * 1.28, baseY + 1.32, 7.5 + Math.sin(ang) * r * 1.28);
      tip.rotation.z = -Math.cos(ang) * 0.45;
      tip.rotation.x = Math.sin(ang) * 0.45;
      registerMeshNode(group, tip, tierVal + 0.2);
    }
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.2, 8), goldMat);
  spire.position.set(-11.2, 12.4, 7.5);
  registerMeshNode(group, spire, 2.6);

  // 2) CÂY BỒ ĐỀ CỔ THỤ (1953) với rễ phụ buông rủ
  addBoxPart(group, 3.8, 0.36, 3.8, stoneMat, 12.2, 0.5, 10.2, 0);
  buildOrganicTree(group, 12.2, 0.68, 10.2, 1.58, 0.6, 'banyan_bodhi');

  // 3) QUẦN THỂ CHỮ TAM (Tiền đường +4.8, Chính điện -1.8, Nhà Tổ -8.4)
  const hallCentersZ = [4.8, -1.8, -8.4];
  const colPositionsX = [-5.5, -2.75, 0, 2.75, 5.5, 8.25, 10.8];

  hallCentersZ.forEach((hz, idx) => {
    const hW = 18.2;
    const hD = 5.4;
    const wallH = 3.6;

    addBoxPart(group, 0.32, wallH, hD, creamStupaMat, -6.4, 0.58 + wallH / 2, hz, 0.9);
    addBoxPart(group, 0.32, wallH, hD, creamStupaMat, 11.4, 0.58 + wallH / 2, hz, 0.9);
    if (idx === 2) {
      addBoxPart(group, hW, wallH, 0.32, creamStupaMat, 2.5, 0.58 + wallH / 2, hz - hD / 2, 0.9);
    }

    // Hệ cột gỗ lim đặt trên chân tảng đá xanh + vì kèo xuyên trính
    for (const cx of colPositionsX) {
      for (const dz of [-1.9, 0, 1.9]) {
        buildTurnedPillarWithPlinth(group, cx, 0.58, hz + dz, wallH, 0.15, woodMat, stoneMat, 0.6, true);
      }
      addBoxPart(group, 0.2, 0.24, hD - 0.6, woodMat, cx, 0.58 + wallH - 0.18, hz, 1.1, false, { isInterior: true });
    }

    // Hoành phi, câu đối & bao lam sơn son thếp vàng giữa các gian
    for (const bx of [-1.4, 2.5, 6.4]) {
      buildCarvedBaoLamArch(group, bx, 1.9, hz + 1.9, 2.5, 1.7, goldMat, lacquerMat, 0.8, true);
    }

    buildTraditionalTieredRoof(group, 2.5, 0.58 + wallH, hz, hW + 2.0, hD + 1.5, 2.35, roofMat, ridgeMat, goldMat, 2.5, true, 0.3);
  });

  // 4) NỘI THẤT CHÍNH ĐIỆN: PHẬT A DI ĐÀ & 18 VỊ LA HÁN GỖ MÍT THẾP VÀNG
  addInteriorWarmLight(group, 2.5, 3.2, -1.8, 0.6, 2.5, 13, 0xffaa33);
  addInteriorWarmLight(group, 2.5, 3.2, 4.6, 0.6, 2.0, 12, 0xffb84d);

  // Tam bảo Chính điện & Tượng Phật A Di Đà trên tòa sen
  addBoxPart(group, 4.6, 1.1, 1.7, lacquerMat, 2.5, 1.12, -3.4, 0.3, false, { isInterior: true });
  const lotusBase = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.62, 0.36, 16), goldMat);
  lotusBase.position.set(2.5, 1.85, -3.4);
  registerMeshNode(group, lotusBase, 0.3, false, { isInterior: true });
  const buddhaBody = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, 1.25, 14), goldMat);
  buddhaBody.position.set(2.5, 2.6, -3.4);
  registerMeshNode(group, buddhaBody, 0.3, false, { isInterior: true });
  const buddhaHead = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), goldMat);
  buddhaHead.position.set(2.5, 3.42, -3.4);
  registerMeshNode(group, buddhaHead, 0.3, false, { isInterior: true });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.06, 8, 22), goldMat);
  halo.position.set(2.5, 3.05, -3.72);
  registerMeshNode(group, halo, 0.3, false, { isInterior: true });

  // Hoành phi câu đối dọc Chính điện
  for (const cx of [0.2, 4.8]) {
    addBoxPart(group, 0.24, 2.1, 0.08, lacquerMat, cx, 2.5, -2.5, 0.5, false, { isInterior: true });
    addBoxPart(group, 0.14, 1.85, 0.1, goldMat, cx, 2.5, -2.47, 0.5, false, { isInterior: true });
  }

  // 18 vị La Hán bằng gỗ mít thếp vàng xếp 2 hàng tả hữu dọc Chính điện
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const az = -4.2 + i * 1.15;
      const ax = side === -1 ? -4.8 : 9.8;
      addBoxPart(group, 0.48, 0.55, 0.48, lacquerMat, ax, 0.85, az, 0.25, false, { isInterior: true });
      const statue = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.44, 5, 10), goldMat);
      statue.position.set(ax, 1.5, az);
      registerMeshNode(group, statue, 0.25, false, { isInterior: true });
      const miniHead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), goldMat);
      miniHead.position.set(ax, 1.92, az);
      registerMeshNode(group, miniHead, 0.25, false, { isInterior: true });
    }
  }
}

// =============================================================================
// 4. HỘI QUÁN NGHĨA AN — CHÙA ÔNG (QUẬN 5 — TP.HCM) [HCM-DT-012]
// =============================================================================
function buildNghiaAnAssemblyHall(group: THREE.Group) {
  const yardMat = makePbrMat(getTerracottaCourtyardTex(6, 5), { bumpScale: 0.08, roughness: 0.85 });
  const jadeRoofMat = makePbrMat(getYinYangTileTex('turquoise_glaze', 5, 4), { bumpScale: 0.15, roughness: 0.3, metalness: 0.14 });
  const brickWallMat = makePbrMat(getTraditionalWallTex('aged_brick_wall', 3, 2), { bumpScale: 0.08, roughness: 0.82 });
  const lacquerMat = makePbrMat(getTimberGrainTex('gilded_lacquer', 2, 2), { bumpScale: 0.05, roughness: 0.35 });
  const woodMat = makePbrMat(getTimberGrainTex('cam_xe', 2, 2), { bumpScale: 0.05, roughness: 0.48 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xecb939, roughness: 0.22, metalness: 0.86 });
  const graniteMat = new THREE.MeshStandardMaterial({ color: 0x8f949a, roughness: 0.65 });
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x6c4f28, roughness: 0.36, metalness: 0.8 });
  const crimsonHorseMat = new THREE.MeshStandardMaterial({ color: 0x9b1c1c, roughness: 0.3, metalness: 0.08 });
  const ceramicBlueMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.22, metalness: 0.12 });
  const ceramicGreenMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.24, metalness: 0.1 });
  const drumSkinMat = new THREE.MeshStandardMaterial({ color: 0xead8b8, roughness: 0.72 });

  // Sân đá & thềm hoa cương Triều Châu
  addBoxPart(group, 30, 0.34, 28, yardMat, 0, 0.17, 0, 0, true);
  addBoxPart(group, 21.5, 0.28, 21.5, graniteMat, 0, 0.48, -0.5, 0);

  const wallH = 4.25;
  // Tường gạch cổ Triều Châu bao quanh Tiền điện, Chính điện & Đông-Tây lang (chừa giếng trời Thiên Tỉnh ở giữa)
  addBoxPart(group, 6.4, wallH, 0.45, brickWallMat, -6.2, 0.62 + wallH / 2, 9.6, 1.0);
  addBoxPart(group, 6.4, wallH, 0.45, brickWallMat, 6.2, 0.62 + wallH / 2, 9.6, 1.0);
  addBoxPart(group, 20.5, 1.15, 0.45, goldMat, 0, 4.25, 9.6, 1.1);
  addBoxPart(group, 20.5, wallH + 0.6, 0.48, brickWallMat, 0, 0.62 + (wallH + 0.6) / 2, -10.5, 1.0);
  addBoxPart(group, 0.48, wallH, 19.6, brickWallMat, -10.0, 0.62 + wallH / 2, -0.6, 1.0);
  addBoxPart(group, 0.48, wallH, 19.6, brickWallMat, 10.0, 0.62 + wallH / 2, -0.6, 1.0);

  // Hệ cột hoa cương & gỗ son bao quanh Thiên Tỉnh
  for (const cx of [-6.8, -3.2, 3.2, 6.8]) {
    buildTurnedPillarWithPlinth(group, cx, 0.62, 5.2, wallH, 0.17, lacquerMat, graniteMat, 0.7, true);
    buildTurnedPillarWithPlinth(group, cx, 0.62, -4.6, wallH, 0.17, lacquerMat, graniteMat, 0.7, true);
  }

  // Hệ mái ngói ống lưu ly xanh ngọc bích + Tượng tiểu cảnh gốm sứ Cây Mai nhiều màu trên bờ nóc
  buildTraditionalTieredRoof(group, 0, 4.86, 7.2, 21.8, 6.4, 2.4, jadeRoofMat, ceramicBlueMat, goldMat, 2.5, true, 0.34);
  buildTraditionalTieredRoof(group, 0, 5.4, -7.2, 21.8, 7.5, 2.8, jadeRoofMat, ceramicBlueMat, goldMat, 2.5, true, 0.36);
  buildTraditionalTieredRoof(group, -8.3, 4.55, 0.2, 4.3, 9.4, 1.38, jadeRoofMat, ceramicBlueMat, goldMat, 2.3, false, 0.2);
  buildTraditionalTieredRoof(group, 8.3, 4.55, 0.2, 4.3, 9.4, 1.38, jadeRoofMat, ceramicBlueMat, goldMat, 2.3, false, 0.2);

  // Quần thể tiểu cảnh gốm sứ Cây Mai nhiều màu rực rỡ trên bờ nóc Chính điện & Tiền điện
  for (let fx = -4.6; fx <= 4.6; fx += 1.55) {
    const fMat = fx === 0 ? goldMat : Math.round(fx) % 2 === 0 ? ceramicBlueMat : ceramicGreenMat;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.56, 8), fMat);
    body.position.set(fx, 8.7, -7.2);
    registerMeshNode(group, body, 2.5);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), goldMat);
    head.position.set(fx, 9.08, -7.2);
    registerMeshNode(group, head, 2.5);
  }

  // Sân Thiên tỉnh lộ thiên ở giữa (x = 0, z = +0.4): bể đá chạm & nhang vòng xoắn treo cao
  addBoxPart(group, 3.4, 0.45, 3.4, graniteMat, 0, 0.8, 0.4, 0.1);
  for (const ix of [-2.4, 0, 2.4]) {
    const coil = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.78, 16), goldMat);
    coil.position.set(ix, 3.8, 0.4);
    registerMeshNode(group, coil, 1.4, false, { isInterior: true });
  }

  // Đôi Sư Tử Đá hoa cương canh cửa Tiền điện
  for (const lx of [-2.8, 2.8]) {
    addBoxPart(group, 0.95, 0.72, 1.05, graniteMat, lx, 0.96, 11.2, 0.2);
    const lion = new THREE.Mesh(new THREE.DodecahedronGeometry(0.46, 1), graniteMat);
    lion.position.set(lx, 1.66, 11.2);
    registerMeshNode(group, lion, 0.2);
  }

  // Nội thất PBR bên trong
  addInteriorWarmLight(group, 0, 3.8, -6.2, 0.6, 2.6, 14, 0xff9933);
  addInteriorWarmLight(group, -4.4, 3.2, 5.2, 0.6, 2.0, 11, 0xffaa44);

  // Bao lam sơn son thếp vàng chạm lộng & Bàn thờ Quan Thánh Đế Quân
  buildCarvedBaoLamArch(group, 0, 1.9, -5.6, 6.2, 2.4, goldMat, lacquerMat, 0.7, true);
  addBoxPart(group, 5.8, 1.25, 1.5, lacquerMat, 0, 1.24, -8.4, 0.3, false, { isInterior: true });
  const shrine = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.6, 1.2), goldMat);
  shrine.position.set(0, 2.65, -9.2);
  registerMeshNode(group, shrine, 0.3, false, { isInterior: true });

  // Lư hương đồng chạm rồng trước Chính điện
  const incenseBurner = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.55, 0.08),
        new THREE.Vector2(0.36, 0.32),
        new THREE.Vector2(0.66, 0.64),
        new THREE.Vector2(0.58, 0.94),
        new THREE.Vector2(0.7, 1.02),
      ],
      18
    ),
    bronzeMat
  );
  incenseBurner.position.set(0, 0.62, -4.2);
  registerMeshNode(group, incenseBurner, 0.3, false, { isInterior: true });

  // Đại hồng chung bên cánh phải (x = +5.8, z = -4.2)
  addBoxPart(group, 0.24, 2.5, 0.24, woodMat, 5.1, 1.85, -4.2, 0.5, false, { isInterior: true });
  addBoxPart(group, 0.24, 2.5, 0.24, woodMat, 6.5, 1.85, -4.2, 0.5, false, { isInterior: true });
  addBoxPart(group, 1.9, 0.26, 0.4, lacquerMat, 5.8, 3.08, -4.2, 0.5, false, { isInterior: true });
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.52, 1.18, 16), bronzeMat);
  bell.position.set(5.8, 2.15, -4.2);
  registerMeshNode(group, bell, 0.5, false, { isInterior: true });

  // Trống lễ hội lớn trên giá gỗ bên cánh phải phía trước (x = +5.6, z = +5.6)
  addBoxPart(group, 1.2, 1.15, 0.2, woodMat, 5.6, 1.2, 5.1, 0.3, false, { isInterior: true });
  addBoxPart(group, 1.2, 1.15, 0.2, woodMat, 5.6, 1.2, 6.1, 0.3, false, { isInterior: true });
  const drumBody = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 1.15, 16), lacquerMat);
  drumBody.rotation.x = Math.PI / 2;
  drumBody.position.set(5.6, 1.75, 5.6);
  registerMeshNode(group, drumBody, 0.3, false, { isInterior: true });
  const drumFace = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 1.19, 16), drumSkinMat);
  drumFace.rotation.x = Math.PI / 2;
  drumFace.position.set(5.6, 1.75, 5.6);
  registerMeshNode(group, drumFace, 0.3, false, { isInterior: true });

  // Tượng Ngựa Xích Thố đỏ rực bên trái Tiền điện (x = -5.2, z = +5.6)
  addBoxPart(group, 2.6, 0.42, 1.5, graniteMat, -5.2, 0.82, 5.6, 0.2, false, { isInterior: true });
  const horseBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.25, 6, 12), crimsonHorseMat);
  horseBody.rotation.z = Math.PI / 2;
  horseBody.position.set(-5.2, 1.88, 5.6);
  registerMeshNode(group, horseBody, 0.3, false, { isInterior: true });
  const horseNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.95, 10), crimsonHorseMat);
  horseNeck.position.set(-4.35, 2.35, 5.6);
  horseNeck.rotation.z = -0.35;
  registerMeshNode(group, horseNeck, 0.3, false, { isInterior: true });
  const horseHead = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.28), crimsonHorseMat);
  horseHead.position.set(-4.02, 2.75, 5.6);
  horseHead.rotation.z = -0.25;
  registerMeshNode(group, horseHead, 0.3, false, { isInterior: true });
  for (const lx of [-5.8, -4.6]) {
    for (const lz of [5.35, 5.85]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.95, 8), crimsonHorseMat);
      leg.position.set(lx, 1.42, lz);
      registerMeshNode(group, leg, 0.3, false, { isInterior: true });
    }
  }
}

// [BRVT-DT-001] Bạch Dinh sử dụng mô hình .glb thực tế, không dùng khối procedural 3D.

// =============================================================================
// 6. QUẦN THỂ KIẾN TRÚC NHÀ LỚN LONG SƠN — ĐỀN ÔNG TRẦN [BRVT-DT-002]
// =============================================================================
function buildLongSonTiledRoof(
  group: THREE.Group,
  cx: number,
  eaveY: number,
  cz: number,
  width: number,
  depth: number,
  height: number,
  roofMat: THREE.Material,
  whiteLimeMat: THREE.Material,
  beamMat: THREE.Material,
  tier = 2.65,
  sagAmount = 0.2
) {
  const hw = width / 2;
  const hd = depth / 2;
  const ridgeHalf = Math.max(0.38, (width - depth * 0.64) * 0.5);
  const segU = 10;
  const segV = 8;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const evalSlopePoint = (side: 'front' | 'back' | 'left' | 'right', u: number, v: number): THREE.Vector3 => {
    const curveFactor = Math.pow(v, 1.35);
    const eaveLift = (1 - v) * sagAmount * Math.pow(Math.abs(u * 2 - 1), 2.0);
    const y = curveFactor * height + eaveLift;

    if (side === 'front' || side === 'back') {
      const sgn = side === 'front' ? 1 : -1;
      const xEave = THREE.MathUtils.lerp(-hw, hw, u);
      const xRidge = THREE.MathUtils.lerp(-ridgeHalf, ridgeHalf, u);
      const x = THREE.MathUtils.lerp(xEave, xRidge, v);
      const z = sgn * THREE.MathUtils.lerp(hd, 0.06, v);
      return new THREE.Vector3(x, y, z);
    } else {
      const sgn = side === 'right' ? 1 : -1;
      const zEave = THREE.MathUtils.lerp(-hd, hd, u);
      const z = THREE.MathUtils.lerp(zEave, 0, v);
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
        uvs.push(u * Math.max(1.6, width / 4.5), v * 1.5);
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

  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roofGeo.setIndex(indices);
  roofGeo.computeVertexNormals();

  const doubleMat = roofMat.clone();
  doubleMat.side = THREE.DoubleSide;
  const roofMesh = new THREE.Mesh(roofGeo, doubleMat);
  roofMesh.position.set(cx, eaveY, cz);
  registerMeshNode(group, roofMesh, tier, false, { hideOnReveal: true, isExteriorShell: true, isRoofShell: true });

  const roofShellOpts = { hideOnReveal: true, isExteriorShell: true, isRoofShell: true };

  // VÂN RÃNH NGÓI ÂM DƯƠNG NỔI 3D RÕ NÉT TRÊN TẤT CẢ CÁC MÁI ĐỀN, LẦU ĐÔI VÀ NHÀ LỒNG
  const ribSpacing = 0.46;
  const ribCount = Math.max(5, Math.floor((width - 0.5) / ribSpacing));
  const slopeLen = Math.hypot(hd - 0.06, height);
  const slopePitch = Math.atan2(height, hd - 0.06);
  for (let rIdx = 0; rIdx <= ribCount; rIdx++) {
    const u = rIdx / ribCount;
    const xEave = THREE.MathUtils.lerp(-hw + 0.18, hw - 0.18, u);
    const xRidge = THREE.MathUtils.lerp(-ridgeHalf + 0.08, ridgeHalf - 0.08, u);
    const xm = (xEave + xRidge) * 0.5;
    const eaveLiftMid = 0.42 * sagAmount * Math.pow(Math.abs(u * 2 - 1), 2.0);
    const ym = height * 0.47 + eaveLiftMid + 0.032;
    const zm = hd * 0.51;
    const yawSkew = Math.atan2(xRidge - xEave, hd - 0.06);

    for (const sgn of [1, -1]) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.065, 0.048, slopeLen * 0.94),
        roofMat
      );
      rib.position.set(cx + xm, eaveY + ym, cz + sgn * zm);
      rib.rotation.x = sgn * slopePitch;
      rib.rotation.y = -sgn * yawSkew * 0.45;
      registerMeshNode(group, rib, tier, false, roofShellOpts);
    }
  }

  // Diềm mái gỗ căm xe dưới hàng hiên
  addBoxPart(group, width - 0.08, 0.13, 0.12, beamMat, cx, eaveY - 0.03, cz + hd - 0.06, tier, false, roofShellOpts);
  addBoxPart(group, width - 0.08, 0.13, 0.12, beamMat, cx, eaveY - 0.03, cz - hd + 0.06, tier, false, roofShellOpts);
  addBoxPart(group, 0.12, 0.13, depth - 0.08, beamMat, cx - hw + 0.06, eaveY - 0.03, cz, tier, false, roofShellOpts);
  addBoxPart(group, 0.12, 0.13, depth - 0.08, beamMat, cx + hw - 0.06, eaveY - 0.03, cz, tier, false, roofShellOpts);

  // ĐƯỜNG GỜ CHỈ VÔI TRẮNG (#EAE6DF) DỌC 4 DIỀM MÁI (nét nhận diện đặc trưng của Nhà Lớn Long Sơn)
  addBoxPart(group, width + 0.06, 0.13, 0.15, whiteLimeMat, cx, eaveY + 0.06, cz + hd, tier, false, roofShellOpts);
  addBoxPart(group, width + 0.06, 0.13, 0.15, whiteLimeMat, cx, eaveY + 0.06, cz - hd, tier, false, roofShellOpts);
  addBoxPart(group, 0.15, 0.13, depth + 0.06, whiteLimeMat, cx - hw, eaveY + 0.06, cz, tier, false, roofShellOpts);
  addBoxPart(group, 0.15, 0.13, depth + 0.06, whiteLimeMat, cx + hw, eaveY + 0.06, cz, tier, false, roofShellOpts);

  // BỜ NÓC UỐN CONG SƠN TRẮNG ĐẶC TRƯNG NAM BỘ (#EAE6DF) & ĐẦU ĐAO
  const ridgeLen = Math.max(0.8, ridgeHalf * 2);
  const ridgeSaddleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-ridgeLen * 0.52, height + 0.24, 0),
    new THREE.Vector3(-ridgeLen * 0.25, height + 0.11, 0),
    new THREE.Vector3(0, height + 0.08, 0),
    new THREE.Vector3(ridgeLen * 0.25, height + 0.11, 0),
    new THREE.Vector3(ridgeLen * 0.52, height + 0.24, 0),
  ]);
  const curvedRidgeMesh = new THREE.Mesh(
    new THREE.TubeGeometry(ridgeSaddleCurve, 16, 0.13, 8, false),
    whiteLimeMat
  );
  curvedRidgeMesh.position.set(cx, eaveY, cz);
  registerMeshNode(group, curvedRidgeMesh, tier, false, roofShellOpts);

  addBoxPart(group, ridgeLen + 0.12, 0.18, 0.24, whiteLimeMat, cx, eaveY + height + 0.06, cz, tier, false, roofShellOpts);
  for (const sx of [-1, 1]) {
    const finial = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.32), whiteLimeMat);
    finial.position.set(cx + sx * (ridgeLen * 0.5), eaveY + height + 0.34, cz);
    registerMeshNode(group, finial, tier, false, roofShellOpts);
  }

  // 4 ĐƯỜNG GỜ CHỈ VÔI TRẮNG (#EAE6DF) DỌC 4 BỜ CHẢY / BỜ QUYẾT
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const hipCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * ridgeHalf, height + 0.16, 0),
      new THREE.Vector3(sx * (width * 0.35), height * 0.46, sz * (depth * 0.28)),
      new THREE.Vector3(sx * (width * 0.49), sagAmount * 0.85, sz * (depth * 0.49)),
      new THREE.Vector3(sx * (width * 0.52), sagAmount + 0.26, sz * (depth * 0.52)),
    ]);
    const hipMesh = new THREE.Mesh(new THREE.TubeGeometry(hipCurve, 12, 0.095, 6, false), whiteLimeMat);
    hipMesh.position.set(cx, eaveY, cz);
    registerMeshNode(group, hipMesh, tier, false, roofShellOpts);
  }
}

function buildLongSonTimberTrussBay(
  group: THREE.Group,
  x: number,
  eaveY: number,
  cz: number,
  spanZ: number,
  riseH: number,
  woodMat: THREE.Material,
  darkWoodMat: THREE.Material,
  tier = 1.25
) {
  const opts = { isInterior: true };
  // Trính ngang chính (tie-beam) + xuyên thượng & xuyên hạ liên kết mộng chốt
  addBoxPart(group, 0.18, 0.22, spanZ * 0.92, woodMat, x, eaveY - 0.14, cz, tier, false, opts);
  addBoxPart(group, 0.15, 0.17, spanZ * 0.58, woodMat, x, eaveY + riseH * 0.42, cz, tier, false, opts);
  addBoxPart(group, 0.13, 0.14, spanZ * 0.32, darkWoodMat, x, eaveY + riseH * 0.72, cz, tier, false, opts);

  // Trụ trốn giữa & 2 con đội chồng rường (king post & queen posts)
  addBoxPart(group, 0.16, riseH * 0.94, 0.16, woodMat, x, eaveY + riseH * 0.39, cz, tier, false, opts);
  for (const sz of [-1, 1]) {
    addBoxPart(group, 0.13, riseH * 0.54, 0.13, darkWoodMat, x, eaveY + riseH * 0.15, cz + sz * spanZ * 0.24, tier, false, opts);
  }

  // Hai thanh kèo xiên & đòn tay đỡ ngói + chốt mộng gỗ
  const rafterLen = Math.hypot(spanZ * 0.49, riseH * 0.90);
  const rafterAng = Math.atan2(riseH * 0.90, spanZ * 0.49);
  for (const sz of [-1, 1]) {
    const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.15, rafterLen), woodMat);
    rafter.position.set(x, eaveY + riseH * 0.43, cz + sz * (spanZ * 0.24));
    rafter.rotation.x = sz * rafterAng;
    registerMeshNode(group, rafter, tier, false, opts);

    // Kê bẩy hiên & chốt mộng đầu cột
    addBoxPart(group, 0.26, 0.14, 0.38, darkWoodMat, x, eaveY - 0.04, cz + sz * (spanZ * 0.43), tier, false, opts);
  }
}

function buildLongSonStoneStairsAndRails(
  group: THREE.Group,
  cx: number,
  fromY: number,
  toY: number,
  zStart: number,
  zEnd: number,
  width: number,
  stoneMat: THREE.Material,
  darkStoneMat: THREE.Material,
  steps = 6
) {
  const dir = zEnd > zStart ? 1 : -1;
  const totalLen = Math.abs(zEnd - zStart);
  const stepD = totalLen / steps;
  const totalH = toY - fromY;

  for (let s = 0; s < steps; s++) {
    const hRatio = (s + 1) / steps;
    const stepH = totalH * hRatio;
    const sz = zStart + dir * (stepD * (s + 0.5));
    addBoxPart(group, width, stepH, stepD + 0.04, stoneMat, cx, fromY + stepH / 2, sz, 0, true);
  }

  // Lan can đá hai bên cầu thang với trụ vuông giật cấp
  for (const sx of [-1, 1]) {
    const rx = cx + sx * (width / 2 + 0.2);
    const railLen = totalLen + 0.26;
    const railH = totalH * 0.5 + 0.64;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, railLen), darkStoneMat);
    rail.position.set(rx, fromY + railH, (zStart + zEnd) / 2);
    rail.rotation.x = dir * Math.atan2(totalH, totalLen);
    registerMeshNode(group, rail, 0);

    for (const [pz, py] of [
      [zStart, fromY],
      [zEnd, toY],
    ]) {
      addBoxPart(group, 0.32, 0.86, 0.32, stoneMat, rx, py + 0.43, pz, 0);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.38), darkStoneMat);
      cap.position.set(rx, py + 0.90, pz);
      registerMeshNode(group, cap, 0);
    }
  }
}

/**
 * Cầu thang đá xanh bề thế chia làm 3 lối đi (ngăn cách bởi 4 dãy lan can tay vịn đá giật cấp)
 */
function buildLongSonTripleLaneGrandStaircase(
  group: THREE.Group,
  cx: number,
  fromY: number,
  toY: number,
  zStart: number,
  zEnd: number,
  totalWidth: number,
  stoneMat: THREE.Material,
  darkStoneMat: THREE.Material,
  whiteLimeMat: THREE.Material,
  steps = 9
) {
  const dir = zEnd > zStart ? 1 : -1;
  const totalLen = Math.abs(zEnd - zStart);
  const stepD = totalLen / steps;
  const totalH = toY - fromY;

  // Bậc đá xanh chạy suốt 3 lối đi
  for (let s = 0; s < steps; s++) {
    const hRatio = (s + 1) / steps;
    const stepH = totalH * hRatio;
    const sz = zStart + dir * (stepD * (s + 0.5));
    addBoxPart(group, totalWidth, stepH, stepD + 0.05, stoneMat, cx, fromY + stepH / 2, sz, 0, true);
  }

  // 4 dãy lan can tay vịn đá giật cấp chia cầu thang thành 3 lối đi (Tả đạo - Trung đạo - Hữu đạo)
  const railOffsets = [-totalWidth / 2, -totalWidth * 0.175, totalWidth * 0.175, totalWidth / 2];
  const zMid = (zStart + zEnd) / 2;
  const yMid = (fromY + toY) / 2;

  for (const xOff of railOffsets) {
    const rx = cx + xOff;
    // Tường vách lan can đá giật cấp 3 nhịp
    addBoxPart(group, 0.26, 0.55, totalLen * 0.34, darkStoneMat, rx, fromY + 0.28, zStart + dir * (totalLen * 0.17), 0, true);
    addBoxPart(group, 0.26, 0.68, totalLen * 0.34, darkStoneMat, rx, yMid + 0.16, zMid, 0, true);
    addBoxPart(group, 0.26, 0.78, totalLen * 0.34, darkStoneMat, rx, toY + 0.04, zEnd - dir * (totalLen * 0.17), 0, true);

    // Tay vịn đá nghiêng + chỉ vôi trắng mảnh dọc sống tay vịn
    const slopeLen = Math.hypot(totalLen, totalH) + 0.25;
    const slopeAng = dir * Math.atan2(totalH, totalLen);
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.18, slopeLen), stoneMat);
    topRail.position.set(rx, yMid + 0.62, zMid);
    topRail.rotation.x = slopeAng;
    registerMeshNode(group, topRail, 0);

    const limeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, slopeLen), whiteLimeMat);
    limeTrim.position.set(rx, yMid + 0.72, zMid);
    limeTrim.rotation.x = slopeAng;
    registerMeshNode(group, limeTrim, 0);

    // 3 trụ cột đá giật cấp (Chân thang - Giữa thang - Đỉnh thang) có chóp sen đá
    for (const [pz, py] of [
      [zStart, fromY],
      [zMid, yMid],
      [zEnd, toY],
    ]) {
      addBoxPart(group, 0.40, 1.02, 0.40, stoneMat, rx, py + 0.51, pz, 0);
      addBoxPart(group, 0.46, 0.10, 0.46, whiteLimeMat, rx, py + 1.04, pz, 0);
      const lotusCap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), darkStoneMat);
      lotusCap.position.set(rx, py + 1.20, pz);
      registerMeshNode(group, lotusCap, 0);
    }
  }
}

function buildLongSonHangingLantern(
  group: THREE.Group,
  x: number,
  eaveY: number,
  z: number,
  woodMat: THREE.Material,
  glowMat: THREE.Material,
  tier = 2.4
) {
  const opts = { isExteriorShell: true };
  // Dây treo & khung đèn lồng lục giác gỗ cổ
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.32, 6), woodMat);
  cord.position.set(x, eaveY - 0.16, z);
  registerMeshNode(group, cord, tier, false, opts);

  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.20, 0.10, 6), woodMat);
  capTop.position.set(x, eaveY - 0.34, z);
  registerMeshNode(group, capTop, tier, false, opts);

  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.28, 6), glowMat);
  core.position.set(x, eaveY - 0.50, z);
  registerMeshNode(group, core, tier, false, { isExteriorShell: true, noShadow: true });

  const capBot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.05, 0.08, 6), woodMat);
  capBot.position.set(x, eaveY - 0.66, z);
  registerMeshNode(group, capBot, tier, false, opts);
}

function buildLongSonRainwaterJar(
  group: THREE.Group,
  x: number,
  baseY: number,
  z: number,
  jarMat: THREE.Material,
  waterMat: THREE.Material,
  stoneMat?: THREE.Material
) {
  if (stoneMat) {
    addBoxPart(group, 0.64, 0.10, 0.64, stoneMat, x, baseY + 0.05, z, 0.12, true);
  }
  const y0 = stoneMat ? baseY + 0.10 : baseY;
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.24, 0.0),
    new THREE.Vector2(0.37, 0.26),
    new THREE.Vector2(0.41, 0.52),
    new THREE.Vector2(0.33, 0.74),
    new THREE.Vector2(0.26, 0.84),
    new THREE.Vector2(0.33, 0.88),
    new THREE.Vector2(0.24, 0.88),
  ];
  const jarGeo = new THREE.LatheGeometry(pts, 14);
  const jar = new THREE.Mesh(jarGeo, jarMat);
  jar.position.set(x, y0, z);
  registerMeshNode(group, jar, 0.15);

  const water = new THREE.Mesh(new THREE.CircleGeometry(0.24, 12), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, y0 + 0.80, z);
  registerMeshNode(group, water, 0.15, false, { noShadow: true });
}

/**
 * Cây cổ thụ thân cao (dáng cây sao, cây dầu cổ thụ):
 * Dời toàn bộ ra vành đai ngoại vi (|x| >= 22.0 hoặc trên triền cao Núi Nứa z <= -19.2),
 * nâng chiều cao thân cây (trunkH = 12.6..15.2m) để tán cây vươn cao tuyệt đối KHÔNG chạm mái hiên,
 * KHÔNG mọc trên sân gạch và KHÔNG che khuất mặt tiền công trình.
 */
function buildLongSonInstancedFoliage(group: THREE.Group, trunkMat: THREE.Material) {
  const treeSpecs: Array<{ x: number; y: number; z: number; scale: number; trunkH: number; crownCount: number }> = [
    // Vành đai ngoại vi bên trái & bên phải (cách xa mép mái hiên > 4.5m)
    { x: -23.2, y: 0.36, z: 7.5, scale: 1.32, trunkH: 12.8, crownCount: 14 },
    { x: 23.4, y: 0.36, z: 7.5, scale: 1.32, trunkH: 12.8, crownCount: 14 },
    { x: -23.8, y: 1.10, z: -2.2, scale: 1.42, trunkH: 13.4, crownCount: 15 },
    { x: 24.0, y: 1.10, z: -2.2, scale: 1.42, trunkH: 13.4, crownCount: 15 },
    { x: -23.0, y: 2.20, z: -11.8, scale: 1.48, trunkH: 13.8, crownCount: 16 },
    { x: 23.2, y: 2.20, z: -11.8, scale: 1.48, trunkH: 13.8, crownCount: 16 },
    // Rừng cây sao - cây dầu cổ thụ trên triền cao Núi Nứa phía sau quần thể (z = -19.5 .. -27.5)
    { x: -17.8, y: 4.8, z: -19.6, scale: 1.52, trunkH: 13.2, crownCount: 16 },
    { x: -9.5, y: 5.8, z: -21.2, scale: 1.62, trunkH: 14.0, crownCount: 18 },
    { x: -1.8, y: 6.5, z: -22.8, scale: 1.68, trunkH: 14.6, crownCount: 18 },
    { x: 12.4, y: 6.2, z: -21.8, scale: 1.62, trunkH: 14.2, crownCount: 18 },
    { x: 18.5, y: 4.9, z: -19.6, scale: 1.52, trunkH: 13.2, crownCount: 16 },
    { x: -13.5, y: 8.2, z: -26.8, scale: 1.65, trunkH: 14.4, crownCount: 17 },
    { x: 0.5, y: 9.0, z: -28.0, scale: 1.75, trunkH: 15.0, crownCount: 19 },
    { x: 14.2, y: 8.4, z: -26.8, scale: 1.65, trunkH: 14.4, crownCount: 17 },
  ];

  interface ClusterTransform {
    pos: THREE.Vector3;
    rot: THREE.Euler;
    scale: THREE.Vector3;
    colorHex: number;
  }
  const clusters: ClusterTransform[] = [];
  const leafPalette = [0x1f3a1c, 0x294b24, 0x335c2c, 0x3e6b35, 0x254220];

  treeSpecs.forEach((t, tIdx) => {
    buildContactShadowPad(group, t.x, t.y, t.z, 2.2 * t.scale, 2.2 * t.scale, 0, 0.34);

    // Thân cây sao / cây dầu cổ thụ thẳng cao vút vượt hẳn qua đỉnh mái ngói
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20 * t.scale, 0.44 * t.scale, t.trunkH, 10),
      trunkMat
    );
    trunk.position.set(t.x, t.y + t.trunkH * 0.5, t.z);
    trunk.rotation.z = (tIdx % 2 === 0 ? 1 : -1) * 0.025;
    registerMeshNode(group, trunk, 0);

    // 4 cành lớn vươn trên cao (từ 88% chiều cao thân trở lên) đỡ các tầng tán cổ thụ
    for (let b = 0; b < 4; b++) {
      const ang = (b / 4) * Math.PI * 2 + tIdx * 0.65;
      const limbLen = 2.2 * t.scale;
      const limb = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08 * t.scale, 0.15 * t.scale, limbLen, 7),
        trunkMat
      );
      limb.position.set(
        t.x + Math.cos(ang) * 0.78 * t.scale,
        t.y + t.trunkH * 0.88 + (b % 2) * 0.42,
        t.z + Math.sin(ang) * 0.78 * t.scale
      );
      limb.rotation.z = -Math.cos(ang) * 0.62;
      limb.rotation.x = Math.sin(ang) * 0.62;
      registerMeshNode(group, limb, 0);
    }

    // Tán lá đa tầng gọn gàng trên cao
    for (let c = 0; c < t.crownCount; c++) {
      const tierRatio = c / t.crownCount;
      const layerAng = c * 2.39996 + tIdx * 1.15;
      const radial = (0.42 + Math.sqrt(tierRatio) * 1.75) * t.scale;
      const heightOff = t.trunkH + 0.15 + (1 - tierRatio) * 2.3 + (c % 3) * 0.35;
      const cx = t.x + Math.cos(layerAng) * radial;
      const cz = t.z + Math.sin(layerAng) * radial;
      const cy = t.y + heightOff;
      const rad = (0.82 + ((c * 7) % 5) * 0.14) * t.scale;

      clusters.push({
        pos: new THREE.Vector3(cx, cy, cz),
        rot: new THREE.Euler((c % 3) * 0.22, layerAng, ((c + 1) % 3) * 0.18),
        scale: new THREE.Vector3(rad * 1.36, rad * 0.58, rad * 1.28),
        colorHex: leafPalette[(tIdx + c) % leafPalette.length],
      });
    }
  });

  const canopyGeo = new THREE.IcosahedronGeometry(1.0, 1);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.02,
    flatShading: true,
  });

  const instancedCanopy = new THREE.InstancedMesh(canopyGeo, canopyMat, clusters.length);
  const dummy = new THREE.Object3D();
  const tempColor = new THREE.Color();

  clusters.forEach((cl, idx) => {
    dummy.position.copy(cl.pos);
    dummy.rotation.copy(cl.rot);
    dummy.scale.copy(cl.scale);
    dummy.updateMatrix();
    instancedCanopy.setMatrixAt(idx, dummy.matrix);
    tempColor.setHex(cl.colorHex);
    instancedCanopy.setColorAt(idx, tempColor);
  });

  instancedCanopy.instanceMatrix.needsUpdate = true;
  if (instancedCanopy.instanceColor) {
    instancedCanopy.instanceColor.needsUpdate = true;
  }
  instancedCanopy.computeBoundingSphere();
  registerMeshNode(group, instancedCanopy, 0);
}

function buildNhaLonLongSon(group: THREE.Group) {
  // =========================================================================
  // 1. MÀU SẮC & VẬT LIỆU ĐẶC TRƯNG NHÀ LỚN LONG SƠN (ĐỀN ÔNG TRẦN)
  // =========================================================================
  const blueStoneMat = makePbrMat(getBlueStoneTerraceTex(6, 5), {
    color: 0xffffff,
    bumpScale: 0.15,
    roughness: 0.80,
  });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x485058, roughness: 0.78 });

  const mossyRoofMat = makePbrMat(getWeatheredMossyTileTex(6, 4), {
    color: 0xffffff,
    bumpScale: 0.22,
    roughness: 0.68,
  });
  const whiteLimeTrimMat = new THREE.MeshStandardMaterial({
    color: 0xeae6df,
    roughness: 0.56,
    metalness: 0.04,
  });

  const woodMat = makePbrMat(getDarkTimberWallTex(2, 2), {
    color: 0xffffff,
    bumpScale: 0.06,
    roughness: 0.42,
    metalness: 0.05,
  });
  const darkPlankMat = makePbrMat(getDarkTimberWallTex(3, 2), {
    color: 0xffffff,
    bumpScale: 0.08,
    roughness: 0.44,
    metalness: 0.04,
  });
  const louverMat = makePbrMat(getLouveredWoodShutterTex(2, 2), {
    color: 0xffffff,
    bumpScale: 0.09,
    roughness: 0.44,
    metalness: 0.03,
  });
  const agedBeamMat = new THREE.MeshStandardMaterial({
    color: 0x3d1e10,
    roughness: 0.44,
    metalness: 0.04,
  });

  const crimsonLacquerMat = makePbrMat(getTimberGrainTex('gilded_lacquer', 2, 2), {
    color: 0x7c1414,
    bumpScale: 0.04,
    roughness: 0.30,
    metalness: 0.18,
  });
  const goldGildMat = new THREE.MeshStandardMaterial({
    color: 0xe8bd48,
    emissive: new THREE.Color(0x5a3b08),
    emissiveIntensity: 0.22,
    roughness: 0.24,
    metalness: 0.84,
  });
  const pearlInlayMat = makePbrMat(getMotherOfPearlInlayTex(1, 1), {
    bumpScale: 0.04,
    roughness: 0.30,
    metalness: 0.18,
  });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc59b46, roughness: 0.28, metalness: 0.80 });
  const lanternGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffe4a0,
    emissive: new THREE.Color(0xff9d2e),
    emissiveIntensity: 2.1,
    roughness: 0.22,
  });
  const hearthBrickMat = makePbrMat(getTerracottaCourtyardTex(3, 2), {
    color: 0x7a3a26,
    bumpScale: 0.12,
    roughness: 0.88,
  });
  const hearthEmberMat = new THREE.MeshStandardMaterial({
    color: 0xffcfa0,
    emissive: new THREE.Color(0xff520d),
    emissiveIntensity: 2.6,
    roughness: 0.25,
  });
  const castIronMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.52, metalness: 0.65 });
  const smokeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    transparent: true,
    opacity: 0.26,
    roughness: 0.95,
    depthWrite: false,
  });
  const hillGrassMat = new THREE.MeshStandardMaterial({ color: 0x2d4f23, roughness: 0.92, flatShading: true });
  const hillLushMat = new THREE.MeshStandardMaterial({ color: 0x375f2b, roughness: 0.90, flatShading: true });
  const hillDeepGreenMat = new THREE.MeshStandardMaterial({ color: 0x203b19, roughness: 0.94, flatShading: true });
  const frontRoadMat = new THREE.MeshStandardMaterial({ color: 0x3b424b, roughness: 0.88, metalness: 0.04 });
  const roadLineMat = new THREE.MeshStandardMaterial({ color: 0xd6d1c4, roughness: 0.72 });
  const jarMat = new THREE.MeshStandardMaterial({ color: 0x6e3924, roughness: 0.46, metalness: 0.10 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x244656, roughness: 0.12, metalness: 0.28 });
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x7b5e38, roughness: 0.74 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3f2d1f, roughness: 0.90 });

  const tier1Y = 0.58;
  const tier2Y = 1.36;
  const tier3Y = 2.16;
  const centerAxisX = 1.2;

  // =========================================================================
  // 2. BỐI CẢNH ĐỊA HÌNH: TRỤC ĐƯỜNG CHÍNH PHÍA TRƯỚC, TRIỀN NÚI NỨA (NGỌA LONG)
  //    XANH MƯỚT DỐC THOẢI PHÍA SAU & LỐI BẬC THANG ĐÁ XANH LÊN KHU LĂNG MỘ ÔNG TRẦN
  // =========================================================================
  // Nền thảo nguyên xanh đảo Long Sơn (tuyệt đối KHÔNG có đường nhựa chạy vòng sau lưng)
  addBoxPart(group, 48.0, 0.36, 44.0, hillDeepGreenMat, 0, 0.18, -3.5, 0, true);

  // TRỤC ĐƯỜNG CHÍNH Ở PHÍA TRƯỚC CỔNG SÂN ĐỀN (chạy ngang phía trước z = +16.8)
  addBoxPart(group, 48.0, 0.12, 3.6, frontRoadMat, 0, 0.40, 16.8, 0, true);
  addBoxPart(group, 48.2, 0.18, 0.28, blueStoneMat, 0, 0.44, 14.92, 0, true);
  addBoxPart(group, 48.2, 0.18, 0.28, blueStoneMat, 0, 0.44, 18.68, 0, true);
  for (let rx = -20; rx <= 20; rx += 4.0) {
    addBoxPart(group, 1.8, 0.02, 0.14, roadLineMat, rx, 0.47, 16.8, 0, true);
  }
  // Sân dẫn đá xanh nối từ trục đường chính vào Cổng Đá Không Khóa Cửa (z = 13.5..14.9)
  addBoxPart(group, 12.6, 0.22, 1.65, blueStoneMat, centerAxisX, 0.45, 14.25, 0, true);

  // TRIỀN NÚI NỨA (NÚI NGỌA LONG) XANH MƯỚT DỐC THOẢI PHÍA SAU QUẦN THỂ (z = -13.2 đến -31.0)
  const nuiNuaLayers: Array<{ x: number; y: number; z: number; rx: number; ry: number; rz: number; mat: THREE.Material }> = [
    { x: 0.5, y: 1.85, z: -17.2, rx: 24.5, ry: 3.4, rz: 5.2, mat: hillLushMat },
    { x: -13.5, y: 2.15, z: -17.8, rx: 12.5, ry: 4.0, rz: 5.5, mat: hillGrassMat },
    { x: 14.2, y: 2.25, z: -17.8, rx: 12.8, ry: 4.2, rz: 5.5, mat: hillGrassMat },
    { x: 0.8, y: 4.10, z: -22.2, rx: 23.0, ry: 5.6, rz: 6.0, mat: hillGrassMat },
    { x: -12.8, y: 4.60, z: -23.0, rx: 11.8, ry: 6.2, rz: 5.8, mat: hillLushMat },
    { x: 13.5, y: 4.75, z: -23.0, rx: 12.2, ry: 6.4, rz: 5.8, mat: hillLushMat },
    { x: 0.0, y: 7.20, z: -27.2, rx: 21.0, ry: 8.2, rz: 5.6, mat: hillDeepGreenMat },
    { x: -11.5, y: 6.80, z: -27.6, rx: 10.5, ry: 7.6, rz: 4.8, mat: hillGrassMat },
    { x: 11.8, y: 7.00, z: -27.4, rx: 10.8, ry: 7.8, rz: 4.8, mat: hillGrassMat },
    { x: -20.2, y: 1.45, z: -9.8, rx: 4.2, ry: 2.6, rz: 8.2, mat: hillLushMat },
    { x: 20.6, y: 1.45, z: -9.8, rx: 4.2, ry: 2.6, rz: 8.2, mat: hillLushMat },
  ];
  nuiNuaLayers.forEach((m) => {
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.0, 1.0, 12), m.mat);
    mound.scale.set(m.rx, m.ry, m.rz);
    mound.position.set(m.x, m.y, m.z);
    registerMeshNode(group, mound, 0, true);
  });

  // Tường kè đá xanh Núi Nứa chắn đất sườn đồi sau khu Hậu điện
  addBoxPart(group, 34.8, 2.4, 0.78, blueStoneMat, 0.8, 2.2, -13.6, 0, true);
  addBoxPart(group, 35.0, 0.12, 0.88, whiteLimeTrimMat, 0.8, 3.44, -13.6, 0, true);

  // LỐI BẬC THANG ĐÁ XANH DẪN LÊN KHU LĂNG MỘ ÔNG TRẦN TRÊN SƯỜN NÚI NỨA
  const tombAxisX = 5.4;
  buildLongSonStoneStairsAndRails(
    group,
    tombAxisX,
    tier3Y,
    4.25,
    -13.2,
    -17.4,
    2.4,
    blueStoneMat,
    darkStoneMat,
    10
  );
  addBoxPart(group, 3.2, 0.32, 1.8, blueStoneMat, tombAxisX, 4.12, -18.2, 0.1, true);
  buildLongSonStoneStairsAndRails(
    group,
    tombAxisX,
    4.25,
    6.20,
    -19.0,
    -22.2,
    2.4,
    blueStoneMat,
    darkStoneMat,
    9
  );

  // KHU LĂNG MỘ ÔNG TRẦN (LÊ VĂN MƯU) TRÊN SƯỜN NÚI NỨA (x = 5.4, y = 6.20, z = -24.2)
  const tombY = 6.20;
  const tombZ = -24.2;
  addBoxPart(group, 7.6, 0.65, 4.6, blueStoneMat, tombAxisX, tombY - 0.18, tombZ, 0.15, true);
  addBoxPart(group, 7.8, 0.08, 4.8, whiteLimeTrimMat, tombAxisX, tombY + 0.16, tombZ, 0.15, true);
  addBoxPart(group, 7.4, 0.72, 0.28, blueStoneMat, tombAxisX, tombY + 0.52, tombZ - 2.1, 0.2, true);
  for (const sx of [-1, 1]) {
    addBoxPart(group, 0.28, 0.68, 4.2, blueStoneMat, tombAxisX + sx * 3.55, tombY + 0.50, tombZ, 0.2, true);
    addBoxPart(group, 2.1, 0.64, 0.28, blueStoneMat, tombAxisX + sx * 2.5, tombY + 0.48, tombZ + 2.1, 0.2, true);
    addBoxPart(group, 0.38, 1.55, 0.38, blueStoneMat, tombAxisX + sx * 1.25, tombY + 0.92, tombZ + 2.1, 0.25, true);
    addBoxPart(group, 0.48, 0.12, 0.48, whiteLimeTrimMat, tombAxisX + sx * 1.25, tombY + 1.74, tombZ + 2.1, 0.25, true);
  }
  addBoxPart(group, 1.8, 0.92, 0.22, darkStoneMat, tombAxisX, tombY + 0.62, tombZ + 1.15, 0.25, true);
  addBoxPart(group, 1.9, 0.08, 0.28, whiteLimeTrimMat, tombAxisX, tombY + 1.12, tombZ + 1.15, 0.25, true);
  addBoxPart(group, 2.8, 0.54, 1.85, blueStoneMat, tombAxisX, tombY + 0.42, tombZ - 0.35, 0.25, true);
  addBoxPart(group, 2.4, 0.32, 1.45, whiteLimeTrimMat, tombAxisX, tombY + 0.82, tombZ - 0.35, 0.25, true);
  addBoxPart(group, 1.5, 1.18, 0.24, darkStoneMat, tombAxisX, tombY + 0.75, tombZ - 1.42, 0.25, true);

  // =========================================================================
  // 3. HELPER KIẾN TRÚC GỖ ĐẶC TRƯNG: CỬA BỨC BÀN, LAN CAN CON TIỆN, HOÀNH PHI CÂU ĐỐI
  // =========================================================================
  const buildCuaBucBanBay = (
    cx: number,
    baseY: number,
    z: number,
    bayW: number,
    bayH: number,
    tier: number,
    isOpenCenter = false
  ) => {
    const shellOpts = { isExteriorShell: true };
    addBoxPart(group, bayW, 0.22, 0.16, agedBeamMat, cx, baseY + 0.11, z, tier, false, shellOpts);
    addBoxPart(group, bayW, 0.16, 0.18, agedBeamMat, cx, baseY + bayH - 0.08, z, tier, false, shellOpts);

    const leafCount = 4;
    const leafW = (bayW - 0.16) / leafCount;
    for (let i = 0; i < leafCount; i++) {
      const isMiddleLeaf = i === 1 || i === 2;
      if (isOpenCenter && isMiddleLeaf) continue;
      const lx = cx - bayW * 0.5 + 0.08 + (i + 0.5) * leafW;
      addBoxPart(group, leafW - 0.04, bayH * 0.34, 0.10, darkPlankMat, lx, baseY + 0.22 + bayH * 0.17, z, tier, false, shellOpts);
      addBoxPart(group, leafW - 0.02, 0.12, 0.12, woodMat, lx, baseY + 0.22 + bayH * 0.38, z, tier, false, shellOpts);
      for (const spOff of [-leafW * 0.26, 0, leafW * 0.26]) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, bayH * 0.28, 6), woodMat);
        bar.position.set(lx + spOff, baseY + 0.22 + bayH * 0.56, z);
        registerMeshNode(group, bar, tier, false, shellOpts);
      }
      addBoxPart(group, leafW - 0.04, bayH * 0.16, 0.10, darkPlankMat, lx, baseY + bayH - 0.22, z, tier, false, shellOpts);
    }
  };

  const buildTurnedSpindleRailing = (
    x1: number,
    x2: number,
    baseY: number,
    z: number,
    tier: number
  ) => {
    const len = Math.abs(x2 - x1);
    const midX = (x1 + x2) * 0.5;
    addBoxPart(group, len, 0.09, 0.12, woodMat, midX, baseY + 0.74, z, tier);
    addBoxPart(group, len, 0.07, 0.12, agedBeamMat, midX, baseY + 0.10, z, tier);
    const count = Math.max(3, Math.floor(len / 0.28));
    for (let i = 0; i <= count; i++) {
      const sx = THREE.MathUtils.lerp(x1 + 0.12, x2 - 0.12, i / count);
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.040, 0.58, 7), woodMat);
      sp.position.set(sx, baseY + 0.42, z);
      registerMeshNode(group, sp, tier);
    }
  };

  const buildHoanhPhiAndCauDoi = (
    cx: number,
    baseY: number,
    z: number,
    colSpanHalf: number,
    colH: number,
    tier: number
  ) => {
    const intOpts = { isInterior: true };
    const hpW = colSpanHalf * 1.68;
    const hpH = 0.62;
    const hpBoard = new THREE.Mesh(new THREE.BoxGeometry(hpW, hpH, 0.09), crimsonLacquerMat);
    hpBoard.position.set(cx, baseY + colH - 0.52, z + 0.18);
    hpBoard.rotation.x = 0.12;
    registerMeshNode(group, hpBoard, tier, false, intOpts);

    addBoxPart(group, hpW + 0.08, 0.06, 0.11, goldGildMat, cx, baseY + colH - 0.21, z + 0.18, tier, false, intOpts);
    addBoxPart(group, hpW + 0.08, 0.06, 0.11, goldGildMat, cx, baseY + colH - 0.83, z + 0.18, tier, false, intOpts);
    for (let g = -1.5; g <= 1.5; g += 1.0) {
      addBoxPart(group, 0.28, 0.30, 0.12, goldGildMat, cx + g * (hpW * 0.21), baseY + colH - 0.52, z + 0.20, tier, false, intOpts);
    }

    for (const side of [-1, 1]) {
      const colX = cx + side * colSpanHalf;
      const cdH = colH * 0.68;
      addBoxPart(group, 0.24, cdH, 0.07, crimsonLacquerMat, colX, baseY + colH * 0.48, z + 0.19, tier, false, intOpts);
      addBoxPart(group, 0.28, 0.08, 0.09, goldGildMat, colX, baseY + colH * 0.48 + cdH * 0.5, z + 0.19, tier, false, intOpts);
      addBoxPart(group, 0.28, 0.08, 0.09, goldGildMat, colX, baseY + colH * 0.48 - cdH * 0.5, z + 0.19, tier, false, intOpts);
      for (let k = -3; k <= 3; k++) {
        addBoxPart(group, 0.12, 0.14, 0.09, goldGildMat, colX, baseY + colH * 0.48 + k * (cdH * 0.12), z + 0.20, tier, false, intOpts);
      }
    }
  };

  // =========================================================================
  // 4. TẦNG 1: SÂN ĐỀN LÁT ĐÁ XANH, ĐỈNH HƯƠNG ĐÁ TRUNG TÂM, HÀNG RÀO TRỤ ĐÁ
  //    KHÔNG KHÓA CỬA & CẦU THANG TAM CẤP 3 LỐI ĐI
  // =========================================================================
  addBoxPart(group, 36.4, 0.26, 11.2, blueStoneMat, 0, 0.45, 8.4, 0, true);

  const fenceZ = 13.5;
  const fenceSegments: Array<[number, number]> = [
    [-17.4, -9.0],
    [-6.6, -2.2],
    [4.6, 9.0],
    [11.4, 17.4],
  ];
  fenceSegments.forEach(([x1, x2]) => {
    const segW = x2 - x1;
    const segCx = (x1 + x2) / 2;
    addBoxPart(group, segW, 0.86, 0.44, blueStoneMat, segCx, tier1Y + 0.43, fenceZ, 0, true);
    addBoxPart(group, segW + 0.08, 0.10, 0.52, darkStoneMat, segCx, tier1Y + 0.91, fenceZ, 0, true);
    addBoxPart(group, segW + 0.06, 0.05, 0.50, whiteLimeTrimMat, segCx, tier1Y + 0.98, fenceZ, 0, true);
  });
  for (const sideX of [-17.4, 17.4]) {
    addBoxPart(group, 0.44, 0.86, 10.2, blueStoneMat, sideX, tier1Y + 0.43, 8.4, 0, true);
    addBoxPart(group, 0.52, 0.10, 10.3, darkStoneMat, sideX, tier1Y + 0.91, 8.4, 0, true);
    addBoxPart(group, 0.50, 0.05, 10.3, whiteLimeTrimMat, sideX, tier1Y + 0.98, 8.4, 0, true);
  }

  const gatePierXs = [-17.4, -13.2, -9.0, -6.6, -2.2, 4.6, 9.0, 11.4, 17.4];
  gatePierXs.forEach((px) => {
    const isMainGate = px === -2.2 || px === 4.6;
    const pierW = isMainGate ? 0.72 : 0.48;
    const pierH = isMainGate ? 2.25 : 1.48;
    addBoxPart(group, pierW, pierH, pierW, blueStoneMat, px, tier1Y + pierH / 2, fenceZ, 0, true);
    addBoxPart(group, pierW + 0.14, 0.12, pierW + 0.14, whiteLimeTrimMat, px, tier1Y + pierH + 0.06, fenceZ, 0, true);
    addBoxPart(group, pierW + 0.24, 0.14, pierW + 0.24, darkStoneMat, px, tier1Y + pierH + 0.18, fenceZ, 0, true);

    const lanternCore = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.25, 6), lanternGlowMat);
    lanternCore.position.set(px, tier1Y + pierH + 0.38, fenceZ);
    lanternCore.userData.isLanternCore = true;
    registerMeshNode(group, lanternCore, 0, false, { noShadow: true });
    const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.16, 6), agedBeamMat);
    lanternCap.position.set(px, tier1Y + pierH + 0.56, fenceZ);
    registerMeshNode(group, lanternCap, 0);

    if (isMainGate) {
      const gateLight = addInteriorWarmLight(group, px, tier1Y + pierH + 0.45, fenceZ, 0, 0.45, 11, 0xffaa3b);
      gateLight.userData.isWarmLanternLight = true;
      gateLight.userData.baseIntensity = 0.35;
      gateLight.userData.nightIntensity = 3.2;
    }
  });

  // ĐỈNH HƯƠNG ĐÁ XANH CHẠM KHẮC Ở TRUNG TÂM SÂN ĐỀN & ĐÔI TRỤ ĐÁ NGHI LỄ (x = 1.2, z = 8.8)
  addBoxPart(group, 1.85, 0.24, 1.85, blueStoneMat, centerAxisX, tier1Y + 0.12, 8.8, 0.2, true);
  addBoxPart(group, 1.42, 0.22, 1.42, darkStoneMat, centerAxisX, tier1Y + 0.34, 8.8, 0.2, true);
  const censerPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.46, 0.0),
    new THREE.Vector2(0.32, 0.34),
    new THREE.Vector2(0.62, 0.68),
    new THREE.Vector2(0.68, 0.98),
    new THREE.Vector2(0.50, 1.14),
    new THREE.Vector2(0.40, 0.98),
  ];
  const censerBody = new THREE.Mesh(new THREE.LatheGeometry(censerPts, 16), blueStoneMat);
  censerBody.position.set(centerAxisX, tier1Y + 0.44, 8.8);
  registerMeshNode(group, censerBody, 0.25);
  for (const sx of [-0.66, 0.66]) {
    addBoxPart(group, 0.14, 0.48, 0.22, darkStoneMat, centerAxisX + sx, tier1Y + 1.22, 8.8, 0.25);
  }
  const censerLid = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.36, 8), darkStoneMat);
  censerLid.position.set(centerAxisX, tier1Y + 1.72, 8.8);
  registerMeshNode(group, censerLid, 0.25);
  for (const sx of [-1.85, 1.85]) {
    addBoxPart(group, 0.36, 1.92, 0.36, blueStoneMat, centerAxisX + sx, tier1Y + 0.96, 8.8, 0.2);
    addBoxPart(group, 0.46, 0.10, 0.46, whiteLimeTrimMat, centerAxisX + sx, tier1Y + 1.96, 8.8, 0.2);
  }

  buildLongSonTripleLaneGrandStaircase(
    group,
    centerAxisX,
    tier1Y,
    tier2Y,
    6.1,
    3.0,
    8.2,
    blueStoneMat,
    darkStoneMat,
    whiteLimeTrimMat,
    9
  );
  buildLongSonStoneStairsAndRails(group, -8.4, tier1Y, tier2Y, 4.6, 3.0, 2.5, blueStoneMat, darkStoneMat, 6);
  buildLongSonStoneStairsAndRails(group, 10.8, tier1Y, tier2Y, 4.6, 3.0, 2.5, blueStoneMat, darkStoneMat, 6);

  // =========================================================================
  // 5. TẦNG 2: NHÀ LONG ĐÌNH, LẦU ĐÔI (LẦU TIÊN - LẦU CẤM) & HÀNH LANG GỖ LIỀN MẠCH
  // =========================================================================
  addBoxPart(group, 32.4, 0.80, 6.8, blueStoneMat, 1.2, 0.96, -0.4, 0, true);
  addBoxPart(group, 32.6, 0.08, 0.32, whiteLimeTrimMat, 1.2, tier2Y + 0.02, 2.95, 0, true);

  const ldX = centerAxisX;
  const ldZ = -0.2;
  const ldBaseY = tier2Y;
  const ldW = 8.4;
  const ldD = 6.4;
  const ldLowerH = 3.15;
  const ldUpperH = 4.45;

  addBoxPart(group, ldW - 0.4, 0.16, ldD - 0.4, darkPlankMat, ldX, ldBaseY + 0.08, ldZ, 0.1, false, { isInterior: true });

  const ldColXs = [-3.6, -1.8, 0, 1.8, 3.6];
  const ldColZs = [-2.6, -1.3, 0, 1.3, 2.6];
  for (const px of ldColXs) {
    for (const pz of ldColZs) {
      const isOuterRing = Math.abs(px) === 3.6 || Math.abs(pz) === 2.6;
      const isInnerCore = Math.abs(px) === 1.8 && Math.abs(pz) === 1.3;
      if (isOuterRing) {
        buildTurnedPillarWithPlinth(group, ldX + px, ldBaseY, ldZ + pz, ldLowerH, 0.155, woodMat, blueStoneMat, 0.65, true);
      } else if (isInnerCore) {
        buildTurnedPillarWithPlinth(group, ldX + px, ldBaseY, ldZ + pz, ldUpperH, 0.185, woodMat, blueStoneMat, 0.75, true);
      }
    }
    buildLongSonTimberTrussBay(group, ldX + px, ldBaseY + ldLowerH, ldZ, ldD - 0.4, 1.65, woodMat, agedBeamMat, 1.25);
  }

  buildTurnedSpindleRailing(ldX - 3.5, ldX - 1.8, ldBaseY + 0.16, ldZ + 2.6, 0.65);
  buildTurnedSpindleRailing(ldX + 1.8, ldX + 3.5, ldBaseY + 0.16, ldZ + 2.6, 0.65);
  buildHoanhPhiAndCauDoi(ldX, ldBaseY + 0.16, ldZ + 1.3, 1.8, ldLowerH - 0.16, 0.68);
  buildCarvedBaoLamArch(group, ldX, ldBaseY + 2.05, ldZ + 2.58, 3.4, 0.95, goldGildMat, crimsonLacquerMat, 0.72, false);

  buildLongSonTiledRoof(
    group,
    ldX,
    ldBaseY + ldLowerH,
    ldZ,
    ldW + 2.2,
    ldD + 2.0,
    1.28,
    mossyRoofMat,
    whiteLimeTrimMat,
    agedBeamMat,
    2.55,
    0.20
  );
  addBoxPart(group, 5.8, 0.58, 4.2, louverMat, ldX, ldBaseY + ldLowerH + 1.15, ldZ, 2.68, false, {
    hideOnReveal: true,
    isExteriorShell: true,
    isRoofShell: true,
  });
  addBoxPart(group, 6.0, 0.08, 4.4, whiteLimeTrimMat, ldX, ldBaseY + ldLowerH + 0.88, ldZ, 2.68, false, {
    hideOnReveal: true,
    isExteriorShell: true,
    isRoofShell: true,
  });
  buildLongSonTiledRoof(
    group,
    ldX,
    ldBaseY + ldUpperH,
    ldZ,
    6.8,
    5.4,
    1.58,
    mossyRoofMat,
    whiteLimeTrimMat,
    agedBeamMat,
    2.92,
    0.22
  );

  for (const lx of [-3.4, -1.2, 1.2, 3.4]) {
    buildLongSonHangingLantern(group, ldX + lx, ldBaseY + ldLowerH - 0.02, ldZ + 3.15, agedBeamMat, lanternGlowMat, 2.45);
    buildLongSonHangingLantern(group, ldX + lx, ldBaseY + ldLowerH - 0.02, ldZ - 3.15, agedBeamMat, lanternGlowMat, 2.45);
  }
  const ldLanternLight = addInteriorWarmLight(group, ldX, ldBaseY + 2.6, ldZ + 2.2, 0.65, 0.55, 14, 0xffa838);
  ldLanternLight.userData.isWarmLanternLight = true;
  ldLanternLight.userData.baseIntensity = 0.45;
  ldLanternLight.userData.nightIntensity = 3.5;

  const buildTruongKySettee = (sx: number, sy: number, sz: number, rotY = 0) => {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.14, 0.70), woodMat);
    seat.position.set(sx, sy + 0.45, sz);
    seat.rotation.y = rotY;
    registerMeshNode(group, seat, 0.3, false, { isInterior: true });
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.58, 0.10), darkPlankMat);
    back.position.set(sx + Math.sin(rotY) * -0.28, sy + 0.76, sz - Math.cos(rotY) * 0.28);
    back.rotation.y = rotY;
    registerMeshNode(group, back, 0.3, false, { isInterior: true });
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.52, 0.54), agedBeamMat);
    table.position.set(sx + Math.sin(rotY) * 0.55, sy + 0.36, sz + Math.cos(rotY) * 0.55);
    table.rotation.y = rotY;
    registerMeshNode(group, table, 0.3, false, { isInterior: true });
  };

  addBoxPart(group, 2.4, 1.02, 0.96, pearlInlayMat, ldX, ldBaseY + 0.62, ldZ - 0.8, 0.32, false, { isInterior: true });
  for (const side of [-1, 1]) {
    buildTruongKySettee(ldX + side * 2.55, ldBaseY + 0.16, ldZ + 0.3, (side * Math.PI) / 2);
  }

  // 5B. LẦU ĐÔI (LẦU TIÊN BÊN TRÁI x = -8.4 & LẦU CẤM BÊN PHẢI x = +10.8) NỐI LIỀN MẠCH HÀNH LANG GỖ VỚI DÃY NHÀ LỒNG PHÍA SAU
  const buildTwoStoryWing = (wx: number, wz: number, connectSide: 1 | -1) => {
    const wBaseY = tier2Y;
    const wW = 6.0;
    const wD = 6.4;
    const h1 = 2.95;
    const h2 = 2.65;

    addBoxPart(group, wW - 0.2, 0.16, wD - 0.2, woodMat, wx, wBaseY + 0.08, wz, 0.1, false, { isInterior: true });
    addBoxPart(group, wW + 0.2, 0.18, wD + 0.2, woodMat, wx, wBaseY + h1, wz, 0.85, false, { isInterior: true });

    for (const px of [-2.4, 0, 2.4]) {
      for (const pz of [-2.5, 0, 2.5]) {
        buildTurnedPillarWithPlinth(group, wx + px, wBaseY, wz + pz, h1, 0.145, woodMat, blueStoneMat, 0.65, true);
      }
    }
    buildCuaBucBanBay(wx, wBaseY + 0.16, wz + wD / 2 - 0.42, wW - 1.0, h1 * 0.86, 0.72, true);
    addBoxPart(group, 0.16, h1 * 0.88, wD - 1.0, darkPlankMat, wx - connectSide * (wW / 2 - 0.42), wBaseY + h1 * 0.44, wz, 0.72, false, {
      isExteriorShell: true,
    });
    addBoxPart(group, wW - 1.0, h1 * 0.88, 0.16, darkPlankMat, wx, wBaseY + h1 * 0.44, wz - wD / 2 + 0.42, 0.72, false, {
      isExteriorShell: true,
    });
    buildTruongKySettee(wx, wBaseY + 0.16, wz - 0.6, 0);

    buildLongSonTiledRoof(
      group,
      wx,
      wBaseY + h1 + 0.02,
      wz,
      wW + 1.5,
      wD + 1.5,
      0.86,
      mossyRoofMat,
      whiteLimeTrimMat,
      agedBeamMat,
      2.45,
      0.14
    );

    const uBaseY = wBaseY + h1 + 0.10;
    const uW = 4.4;
    const uD = 4.8;
    for (const px of [-2.5, 0, 2.5]) {
      for (const pz of [-2.6, 2.6]) {
        buildTurnedPillarWithPlinth(group, wx + px, uBaseY, wz + pz, h2, 0.125, woodMat, blueStoneMat, 0.95, true);
      }
      buildLongSonTimberTrussBay(group, wx + px * 0.72, uBaseY + h2, wz, uD, 1.62, woodMat, agedBeamMat, 1.4);
    }

    addBoxPart(group, uW, h2 * 0.88, 0.15, louverMat, wx, uBaseY + h2 * 0.44, wz + uD / 2 - 0.12, 1.0, false, {
      isExteriorShell: true,
    });
    addBoxPart(group, 0.15, h2 * 0.88, uD, louverMat, wx + connectSide * (uW / 2 - 0.12), uBaseY + h2 * 0.44, wz, 1.0, false, {
      isExteriorShell: true,
    });
    addBoxPart(group, 0.15, h2 * 0.88, uD, darkPlankMat, wx - connectSide * (uW / 2 - 0.12), uBaseY + h2 * 0.44, wz, 1.0, false, {
      isExteriorShell: true,
    });
    addBoxPart(group, uW, h2 * 0.88, 0.15, darkPlankMat, wx, uBaseY + h2 * 0.44, wz - uD / 2 + 0.12, 1.0, false, {
      isExteriorShell: true,
    });

    const balFrontZ = wz + wD / 2 - 0.18;
    const balLeftX = wx - wW / 2 + 0.18;
    const balRightX = wx + wW / 2 - 0.18;

    addBoxPart(group, wW - 0.2, 0.11, 0.14, woodMat, wx, uBaseY + 0.78, balFrontZ, 0.95);
    addBoxPart(group, wW - 0.2, 0.08, 0.14, woodMat, wx, uBaseY + 0.10, balFrontZ, 0.95);
    addBoxPart(group, 0.14, 0.11, wD - 0.2, woodMat, balLeftX, uBaseY + 0.78, wz, 0.95);
    addBoxPart(group, 0.14, 0.11, wD - 0.2, woodMat, balRightX, uBaseY + 0.78, wz, 0.95);

    for (let sx = -wW / 2 + 0.28; sx <= wW / 2 - 0.24; sx += 0.28) {
      const spFront = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.044, 0.66, 7), woodMat);
      spFront.position.set(wx + sx, uBaseY + 0.44, balFrontZ);
      registerMeshNode(group, spFront, 0.95);
    }
    for (let sz = -wD / 2 + 0.28; sz <= wD / 2 - 0.24; sz += 0.28) {
      const spLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.044, 0.66, 7), woodMat);
      spLeft.position.set(balLeftX, uBaseY + 0.44, wz + sz);
      registerMeshNode(group, spLeft, 0.95);

      const spRight = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.044, 0.66, 7), woodMat);
      spRight.position.set(balRightX, uBaseY + 0.44, wz + sz);
      registerMeshNode(group, spRight, 0.95);
    }

    buildLongSonTiledRoof(
      group,
      wx,
      uBaseY + h2,
      wz,
      wW + 1.8,
      wD + 1.8,
      1.85,
      mossyRoofMat,
      whiteLimeTrimMat,
      agedBeamMat,
      2.88,
      0.22
    );

    buildLongSonHangingLantern(group, wx - 1.5, uBaseY + h2 - 0.02, balFrontZ + 0.45, agedBeamMat, lanternGlowMat, 2.6);
    buildLongSonHangingLantern(group, wx + 1.5, uBaseY + h2 - 0.02, balFrontZ + 0.45, agedBeamMat, lanternGlowMat, 2.6);
    const ptWing = addInteriorWarmLight(group, wx, uBaseY + 1.4, wz, 0.9, 0.5, 12, 0xffaa42);
    ptWing.userData.isInteriorPointLight = true;
    ptWing.userData.isWarmLanternLight = true;
    ptWing.userData.baseIntensity = 0.5;
    ptWing.userData.targetIntensity = 2.9;
    ptWing.userData.nightIntensity = 2.8;

    // HÀNH LANG GỖ NỐI LIỀN MẠCH GIỮA 2 LẦU ĐÔI VỚI NHÀ LONG ĐÌNH (THEO PHƯƠNG NGANG X)
    const corrMidX = wx + connectSide * 4.2;
    addBoxPart(group, 3.0, 0.20, 2.5, woodMat, corrMidX, wBaseY + 0.14, -0.2, 0.15);
    for (const pz of [-1.05, 0.65]) {
      buildTurnedPillarWithPlinth(group, corrMidX, wBaseY, pz, h1 + 0.18, 0.13, woodMat, blueStoneMat, 0.65, true);
    }
    buildTurnedSpindleRailing(corrMidX - 1.35, corrMidX + 1.35, wBaseY + 0.16, 0.72, 0.65);
    buildTurnedSpindleRailing(corrMidX - 1.35, corrMidX + 1.35, wBaseY + 0.16, -1.12, 0.65);
    buildLongSonTiledRoof(
      group,
      corrMidX,
      wBaseY + h1 + 0.14,
      -0.2,
      3.4,
      3.0,
      0.95,
      mossyRoofMat,
      whiteLimeTrimMat,
      agedBeamMat,
      2.55,
      0.12
    );

    // HÀNH LANG GỖ CẦU THANG NỐI LIỀN MẠCH TỪ LẦU ĐÔI RA DÃY NHÀ LỒNG PHÍA SAU (THEO PHƯƠNG DỌC Z: z = -2.2 .. -4.8)
    const rearBridgeZ = -3.55;
    const rearBridgeY = (tier2Y + tier3Y) * 0.5 + 0.12;
    addBoxPart(group, 2.4, 0.18, 2.8, woodMat, wx, rearBridgeY, rearBridgeZ, 0.35);
    for (const sx of [-0.95, 0.95]) {
      buildTurnedPillarWithPlinth(group, wx + sx, rearBridgeY, rearBridgeZ, 3.05, 0.13, woodMat, blueStoneMat, 0.65, true);
      addBoxPart(group, 0.11, 0.09, 2.6, woodMat, wx + sx, rearBridgeY + 0.74, rearBridgeZ, 0.65);
      for (let rz = -1.0; rz <= 1.05; rz += 0.34) {
        const bSp = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.036, 0.56, 6), woodMat);
        bSp.position.set(wx + sx, rearBridgeY + 0.42, rearBridgeZ + rz);
        registerMeshNode(group, bSp, 0.65);
      }
    }
    buildLongSonTiledRoof(
      group,
      wx,
      rearBridgeY + 3.05,
      rearBridgeZ,
      3.4,
      3.2,
      0.96,
      mossyRoofMat,
      whiteLimeTrimMat,
      agedBeamMat,
      2.56,
      0.12
    );
  };

  buildTwoStoryWing(-8.4, -0.4, 1);
  buildTwoStoryWing(10.8, -0.4, -1);

  // =========================================================================
  // 6. TẦNG 3: KHU NHÀ THÁNH (TIỀN ĐIỆN - TRUNG ĐIỆN - HẬU ĐIỆN), KHU NHÀ LỒNG & KHU BẾP NHÀ LÒ
  // =========================================================================
  addBoxPart(group, 33.8, 1.60, 9.8, blueStoneMat, 0.8, 1.36, -8.6, 0, true);
  addBoxPart(group, 34.0, 0.08, 0.32, whiteLimeTrimMat, 0.8, tier3Y + 0.02, -3.72, 0, true);

  buildLongSonStoneStairsAndRails(group, centerAxisX, tier2Y, tier3Y, -2.5, -4.0, 3.6, blueStoneMat, darkStoneMat, 6);
  buildLongSonStoneStairsAndRails(group, -8.4, tier2Y, tier3Y, -3.1, -4.2, 2.2, blueStoneMat, darkStoneMat, 5);
  buildLongSonStoneStairsAndRails(group, 10.8, tier2Y, tier3Y, -3.1, -4.2, 2.2, blueStoneMat, darkStoneMat, 5);

  addBoxPart(group, 3.2, 0.16, 2.6, woodMat, centerAxisX, (tier2Y + tier3Y) * 0.5 + 0.10, -3.25, 0.35);
  for (const sx of [-1.45, 1.45]) {
    buildTurnedPillarWithPlinth(group, centerAxisX + sx, (tier2Y + tier3Y) / 2, -3.25, 3.25, 0.135, woodMat, blueStoneMat, 0.65, true);
  }
  buildLongSonTiledRoof(
    group,
    centerAxisX,
    tier2Y + 3.45,
    -3.25,
    4.2,
    2.8,
    1.05,
    mossyRoofMat,
    whiteLimeTrimMat,
    agedBeamMat,
    2.58,
    0.12
  );

  // 6A. KHU NHÀ THÁNH: TIỀN ĐIỆN – TRUNG ĐIỆN – HẬU ĐIỆN (3 nếp nhà cổ trùng thiềm điệp ốc)
  const nhX = centerAxisX;
  const nhBaseY = tier3Y;
  const nhW = 13.8;
  const hallSpecs: Array<{ cz: number; d: number; h: number; roofH: number; tier: number }> = [
    { cz: -5.3, d: 3.2, h: 3.35, roofH: 1.72, tier: 2.68 },
    { cz: -8.2, d: 3.4, h: 3.62, roofH: 1.92, tier: 2.78 },
    { cz: -11.2, d: 3.6, h: 3.88, roofH: 2.12, tier: 2.88 },
  ];

  addBoxPart(group, nhW - 0.2, 0.16, 9.4, woodMat, nhX, nhBaseY + 0.08, -8.3, 0.1, false, { isInterior: true });

  hallSpecs.forEach((hSpec, hIdx) => {
    for (const px of [-5.8, -2.9, 0, 2.9, 5.8]) {
      for (const pz of [-hSpec.d * 0.42, hSpec.d * 0.42]) {
        buildTurnedPillarWithPlinth(
          group,
          nhX + px,
          nhBaseY,
          hSpec.cz + pz,
          hSpec.h,
          0.165,
          woodMat,
          blueStoneMat,
          0.65,
          true
        );
      }
      buildLongSonTimberTrussBay(
        group,
        nhX + px,
        nhBaseY + hSpec.h,
        hSpec.cz,
        hSpec.d - 0.2,
        hSpec.roofH * 0.85,
        woodMat,
        agedBeamMat,
        1.25 + hIdx * 0.08
      );
    }

    buildLongSonTiledRoof(
      group,
      nhX,
      nhBaseY + hSpec.h,
      hSpec.cz,
      nhW + 1.8,
      hSpec.d + 1.25,
      hSpec.roofH,
      mossyRoofMat,
      whiteLimeTrimMat,
      agedBeamMat,
      hSpec.tier,
      0.22
    );
  });

  // HỆ CỬA BỨC BÀN GỖ CĂM XE & LAN CAN CON TIỆN MẶT TIỀN KHU NHÀ THÁNH (z = -3.82)
  buildCuaBucBanBay(nhX, nhBaseY + 0.16, -3.82, 2.75, 3.05, 0.72, true);
  buildCuaBucBanBay(nhX - 4.35, nhBaseY + 0.16, -3.82, 2.75, 3.05, 0.72, false);
  buildCuaBucBanBay(nhX + 4.35, nhBaseY + 0.16, -3.82, 2.75, 3.05, 0.72, false);
  buildTurnedSpindleRailing(nhX - 6.6, nhX - 1.75, nhBaseY + 0.16, -3.48, 0.68);
  buildTurnedSpindleRailing(nhX + 1.75, nhX + 6.6, nhBaseY + 0.16, -3.48, 0.68);

  addBoxPart(group, nhW - 0.2, 3.75, 0.22, darkPlankMat, nhX, nhBaseY + 1.88, -12.85, 0.72, false, {
    isExteriorShell: true,
  });
  for (const sx of [-1, 1]) {
    addBoxPart(group, 0.18, 3.55, 8.8, darkPlankMat, nhX + sx * (nhW / 2 - 0.18), nhBaseY + 1.78, -8.3, 0.72, false, {
      isExteriorShell: true,
    });
  }

  // NỘI THẤT KHU NHÀ THÁNH (TIỀN ĐIỆN - TRUNG ĐIỆN - HẬU ĐIỆN):
  // Hương án, Tủ thờ cẩn xà cừ, Hoành phi câu đối sơn son thếp vàng (TUYỆT ĐỐI KHÔNG ĐẶT TƯỢNG THỜ)
  const ptMain = addInteriorWarmLight(group, nhX, nhBaseY + 3.0, -8.2, 0.6, 0.95, 18, 0xffaa3d);
  ptMain.userData.isInteriorPointLight = true;
  ptMain.userData.isWarmLanternLight = true;
  ptMain.userData.baseIntensity = 0.85;
  ptMain.userData.targetIntensity = 3.8;
  ptMain.userData.nightIntensity = 3.6;

  buildHoanhPhiAndCauDoi(nhX, nhBaseY + 0.16, -5.3, 2.9, 3.18, 0.36);
  buildHoanhPhiAndCauDoi(nhX, nhBaseY + 0.16, -8.2, 2.9, 3.42, 0.36);
  buildHoanhPhiAndCauDoi(nhX, nhBaseY + 0.16, -11.0, 2.9, 3.65, 0.36);
  buildCarvedBaoLamArch(group, nhX, nhBaseY + 2.15, -6.75, 5.4, 1.15, goldGildMat, crimsonLacquerMat, 0.36, true);
  buildCarvedBaoLamArch(group, nhX, nhBaseY + 2.25, -9.65, 5.4, 1.22, goldGildMat, crimsonLacquerMat, 0.36, true);

  addBoxPart(group, 3.2, 1.08, 1.05, woodMat, nhX, nhBaseY + 0.68, -8.3, 0.32, false, { isInterior: true });
  addBoxPart(group, 2.8, 0.72, 0.08, pearlInlayMat, nhX, nhBaseY + 0.68, -7.76, 0.32, false, { isInterior: true });
  const frontUrn = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.15, 0.34, 10), brassMat);
  frontUrn.position.set(nhX, nhBaseY + 1.38, -8.15);
  registerMeshNode(group, frontUrn, 0.32, false, { isInterior: true });

  addBoxPart(group, 4.8, 1.24, 1.32, woodMat, nhX, nhBaseY + 0.76, -11.4, 0.32, false, { isInterior: true });
  addBoxPart(group, 4.4, 0.84, 0.09, pearlInlayMat, nhX, nhBaseY + 0.76, -10.72, 0.32, false, { isInterior: true });
  addBoxPart(group, 2.6, 0.52, 0.88, darkPlankMat, nhX, nhBaseY + 1.56, -11.6, 0.32, false, { isInterior: true });
  addBoxPart(group, 1.45, 1.08, 0.10, crimsonLacquerMat, nhX, nhBaseY + 2.34, -11.88, 0.32, false, { isInterior: true });
  addBoxPart(group, 1.55, 0.08, 0.14, goldGildMat, nhX, nhBaseY + 2.90, -11.88, 0.32, false, { isInterior: true });
  addBoxPart(group, 1.55, 0.08, 0.14, goldGildMat, nhX, nhBaseY + 1.78, -11.88, 0.32, false, { isInterior: true });

  const altarUrn = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.38, 10), brassMat);
  altarUrn.position.set(nhX, nhBaseY + 1.98, -11.2);
  registerMeshNode(group, altarUrn, 0.32, false, { isInterior: true });
  for (const sx of [-0.82, 0.82]) {
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.10, 0.48, 8), brassMat);
    candle.position.set(nhX + sx, nhBaseY + 2.02, -11.2);
    registerMeshNode(group, candle, 0.32, false, { isInterior: true });
  }

  for (const side of [-1, 1]) {
    for (let c = 0; c < 3; c++) {
      const cxCab = nhX + side * (3.0 + c * 1.42);
      const czCab = -11.5 + (c % 2) * 2.4;
      addBoxPart(group, 1.26, 2.02, 0.76, woodMat, cxCab, nhBaseY + 1.14, czCab, 0.35, false, { isInterior: true });
      addBoxPart(group, 1.12, 1.72, 0.08, pearlInlayMat, cxCab, nhBaseY + 1.18, czCab + 0.38, 0.35, false, {
        isInterior: true,
      });
    }
  }
  for (const side of [-1, 1]) {
    buildTruongKySettee(nhX + side * 3.8, nhBaseY + 0.16, -5.5, (side * Math.PI) / 2);
    buildTruongKySettee(nhX + side * 3.8, nhBaseY + 0.16, -8.3, (side * Math.PI) / 2);
  }

  // 6B. DÃY NHÀ LỒNG (NHÀ HỘI DÀI PHÍA SAU) & KHU BẾP NHÀ LÒ (CÓ BẾP LÒ CỔ & KHÓI BẾP BAY NHẸ LÊN TRỜI)
  const buildRearDoubleHallWing = (wx: number, wW: number, connectX: number, isKitchenWing = false) => {
    addBoxPart(group, wW - 0.2, 0.16, 8.8, woodMat, wx, nhBaseY + 0.08, -8.4, 0.1, false, { isInterior: true });
    const subHalls: Array<{ cz: number; d: number; h: number; roofH: number; tier: number }> = [
      { cz: -6.2, d: 4.0, h: 3.25, roofH: 1.62, tier: 2.66 },
      { cz: -10.4, d: 4.2, h: 3.50, roofH: 1.78, tier: 2.76 },
    ];
    subHalls.forEach((sh) => {
      for (const px of [-wW * 0.38, 0, wW * 0.38]) {
        for (const pz of [-sh.d * 0.4, sh.d * 0.4]) {
          buildTurnedPillarWithPlinth(group, wx + px, nhBaseY, sh.cz + pz, sh.h, 0.14, woodMat, blueStoneMat, 0.65, true);
        }
        buildLongSonTimberTrussBay(group, wx + px, nhBaseY + sh.h, sh.cz, sh.d - 0.3, sh.roofH * 0.85, woodMat, agedBeamMat, 1.25);
      }
      buildLongSonTiledRoof(
        group,
        wx,
        nhBaseY + sh.h,
        sh.cz,
        wW + 1.5,
        sh.d + 1.2,
        sh.roofH,
        mossyRoofMat,
        whiteLimeTrimMat,
        agedBeamMat,
        sh.tier,
        0.18
      );
    });

    buildCuaBucBanBay(wx, nhBaseY + 0.16, -4.3, wW - 0.8, 2.85, 0.72, true);
    addBoxPart(group, wW - 0.2, 3.2, 0.20, darkPlankMat, wx, nhBaseY + 1.6, -12.3, 0.72, false, { isExteriorShell: true });
    buildTurnedSpindleRailing(wx - wW * 0.44, wx - 0.85, nhBaseY + 0.16, -3.95, 0.65);
    buildTurnedSpindleRailing(wx + 0.85, wx + wW * 0.44, nhBaseY + 0.16, -3.95, 0.65);

    if (isKitchenWing) {
      // KHU NHÀ LÒ (BẾP CỔ TRUYỀN NHÀ LỚN LONG SƠN)
      const stoveZ = -10.5;
      addBoxPart(group, 3.8, 0.86, 1.48, hearthBrickMat, wx, nhBaseY + 0.52, stoveZ, 0.32, false, { isInterior: true });
      addBoxPart(group, 3.9, 0.08, 1.56, darkStoneMat, wx, nhBaseY + 0.98, stoveZ, 0.32, false, { isInterior: true });

      for (const sx of [-1.05, 1.05]) {
        const emberCore = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.28, 10), hearthEmberMat);
        emberCore.position.set(wx + sx, nhBaseY + 0.36, stoveZ + 0.62);
        emberCore.userData.isHearthEmber = true;
        registerMeshNode(group, emberCore, 0.32, false, { isInterior: true, noShadow: true });

        const cauldron = new THREE.Mesh(
          new THREE.CylinderGeometry(0.56, 0.38, 0.46, 14),
          sx < 0 ? castIronMat : brassMat
        );
        cauldron.position.set(wx + sx, nhBaseY + 1.18, stoveZ);
        registerMeshNode(group, cauldron, 0.35, false, { isInterior: true });
      }
      for (let logIdx = 0; logIdx < 5; logIdx++) {
        const logMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.1, 7), agedBeamMat);
        logMesh.rotation.z = Math.PI / 2;
        logMesh.position.set(wx, nhBaseY + 0.26 + (logIdx % 2) * 0.14, stoveZ + 0.82 + (logIdx - 2) * 0.06);
        registerMeshNode(group, logMesh, 0.32, false, { isInterior: true });
      }

      const hearthLight = addInteriorWarmLight(group, wx, nhBaseY + 1.45, stoveZ + 0.4, 0.35, 0.85, 15, 0xff6e24);
      hearthLight.userData.isInteriorPointLight = true;
      hearthLight.userData.isHearthFireLight = true;
      hearthLight.userData.baseIntensity = 0.85;
      hearthLight.userData.targetIntensity = 4.2;
      hearthLight.userData.nightIntensity = 4.4;

      addBoxPart(group, 1.55, 0.56, 1.15, louverMat, wx, nhBaseY + 3.50 + 1.65, stoveZ, 2.82, false, {
        hideOnReveal: true,
        isExteriorShell: true,
        isRoofShell: true,
      });
      buildLongSonTiledRoof(
        group,
        wx,
        nhBaseY + 3.50 + 1.92,
        stoveZ,
        2.15,
        1.65,
        0.58,
        mossyRoofMat,
        whiteLimeTrimMat,
        agedBeamMat,
        2.86,
        0.08
      );

      for (let sIdx = 0; sIdx < 9; sIdx++) {
        const tSmoke = sIdx / 8;
        const puffRadius = 0.24 + tSmoke * 0.58;
        const puffMat = smokeMat.clone();
        puffMat.opacity = (1 - tSmoke * 0.72) * 0.26;
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(puffRadius, 1), puffMat);
        const baseSmokeY = nhBaseY + 6.05 + tSmoke * 4.4;
        const baseSmokeX = wx + Math.sin(sIdx * 1.1) * 0.25;
        const baseSmokeZ = stoveZ - tSmoke * 0.65;
        puff.position.set(baseSmokeX, baseSmokeY, baseSmokeZ);
        puff.scale.set(1.15, 0.78, 1.15);
        puff.userData.isKitchenSmoke = true;
        puff.userData.smokePhase = sIdx * 0.75;
        puff.userData.origSmokeX = baseSmokeX;
        puff.userData.origSmokeY = baseSmokeY;
        puff.userData.origSmokeZ = baseSmokeZ;
        puff.userData.baseOpacity = puffMat.opacity;
        registerMeshNode(group, puff, 2.9, false, { noShadow: true });
      }
      buildTruongKySettee(wx, nhBaseY + 0.16, -6.2, 0);
    } else {
      addBoxPart(group, 1.8, 1.75, 0.68, pearlInlayMat, wx, nhBaseY + 1.0, -11.4, 0.35, false, { isInterior: true });
      buildHoanhPhiAndCauDoi(wx, nhBaseY + 0.16, -10.2, wW * 0.38, 3.35, 0.36);
      buildTruongKySettee(wx, nhBaseY + 0.16, -6.4, 0);
    }

    // HÀNH LANG GỖ CÓ MÁI CHE NỐI LIỀN MẠCH GIỮA KHU NHÀ THÁNH VÀ DÃY NHÀ LỒNG / NHÀ LÒ
    addBoxPart(group, 2.8, 0.16, 4.2, woodMat, connectX, nhBaseY + 0.08, -8.2, 0.15);
    buildTurnedSpindleRailing(connectX - 1.2, connectX + 1.2, nhBaseY + 0.16, -6.15, 0.65);
    buildTurnedSpindleRailing(connectX - 1.2, connectX + 1.2, nhBaseY + 0.16, -10.25, 0.65);
    buildLongSonTiledRoof(
      group,
      connectX,
      nhBaseY + 3.22,
      -8.2,
      2.8,
      4.4,
      0.92,
      mossyRoofMat,
      whiteLimeTrimMat,
      agedBeamMat,
      2.56,
      0.10
    );
  };

  buildRearDoubleHallWing(11.4, 5.8, 8.3, false);
  buildRearDoubleHallWing(-9.4, 6.4, -5.9, true);

  // =========================================================================
  // 7. NHÀ GHE SẤM (BÊN TRÁI SÂN): CĂN CHỈNH VUÔNG GÓC VỚI TRỤC SÂN CHÍNH,
  //    HOÀN THIỆN THÂN GHE BẦU LỚN DÀI VỚI MŨI GHE CONG TRUYỀN THỐNG TRÊN ĐÀ GỖ
  // =========================================================================
  const boatX = -10.6;
  const boatZ = 8.2;
  const boatBaseY = tier1Y;
  addBoxPart(group, 10.6, 0.28, 5.4, blueStoneMat, boatX, boatBaseY + 0.14, boatZ, 0, true);
  addBoxPart(group, 10.7, 0.06, 5.5, whiteLimeTrimMat, boatX, boatBaseY + 0.29, boatZ, 0, true);
  buildContactShadowPad(group, boatX, boatBaseY + 0.30, boatZ, 4.8, 1.95, 0.1, 0.48);

  for (const px of [-4.3, -1.45, 1.45, 4.3]) {
    for (const pz of [-2.15, 2.15]) {
      buildTurnedPillarWithPlinth(group, boatX + px, boatBaseY + 0.28, boatZ + pz, 3.25, 0.145, woodMat, blueStoneMat, 0.65);
    }
    buildLongSonTimberTrussBay(group, boatX + px, boatBaseY + 3.52, boatZ, 4.2, 1.38, woodMat, agedBeamMat, 1.22);
  }
  buildLongSonTiledRoof(
    group,
    boatX,
    boatBaseY + 3.52,
    boatZ,
    11.6,
    6.2,
    1.72,
    mossyRoofMat,
    whiteLimeTrimMat,
    agedBeamMat,
    2.65,
    0.20
  );

  const boatLight = addInteriorWarmLight(group, boatX, boatBaseY + 2.85, boatZ, 0.45, 0.65, 12, 0xffaa3d);
  boatLight.userData.isInteriorPointLight = true;
  boatLight.userData.isWarmLanternLight = true;
  boatLight.userData.baseIntensity = 0.55;
  boatLight.userData.targetIntensity = 3.4;
  boatLight.userData.nightIntensity = 3.0;

  for (const cxOff of [-2.5, 0, 2.5]) {
    addBoxPart(group, 0.28, 0.48, 1.75, agedBeamMat, boatX + cxOff, boatBaseY + 0.54, boatZ, 0.22, false, { isInterior: true });
    addBoxPart(group, 0.38, 0.14, 1.95, woodMat, boatX + cxOff, boatBaseY + 0.34, boatZ, 0.22, false, { isInterior: true });
  }

  const gheSamGroup = new THREE.Group();
  gheSamGroup.position.set(boatX, 0, boatZ);
  gheSamGroup.rotation.y = Math.PI / 2;
  group.add(gheSamGroup);

  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, -4.65);
  hullShape.quadraticCurveTo(1.38, -1.5, 1.22, 2.5);
  hullShape.quadraticCurveTo(0.78, 4.05, 0, 4.88);
  hullShape.quadraticCurveTo(-0.78, 4.05, -1.22, 2.5);
  hullShape.quadraticCurveTo(-1.38, -1.5, 0, -4.65);
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.86,
    bevelEnabled: true,
    bevelSize: 0.14,
    bevelThickness: 0.18,
  });
  hullGeo.rotateX(Math.PI / 2);
  const boatHull = new THREE.Mesh(hullGeo, woodMat);
  boatHull.name = 'ghe-sam-boat';
  boatHull.position.set(0, boatBaseY + 1.38, 0);
  registerMeshNode(gheSamGroup, boatHull, 0.28, false, { isInterior: true });

  const bowStemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, boatBaseY + 1.12, 3.4),
    new THREE.Vector3(0, boatBaseY + 1.58, 4.55),
    new THREE.Vector3(0, boatBaseY + 2.42, 5.18),
  ]);
  const bowStem = new THREE.Mesh(new THREE.TubeGeometry(bowStemCurve, 12, 0.095, 8, false), agedBeamMat);
  bowStem.name = 'ghe-sam-prow';
  registerMeshNode(gheSamGroup, bowStem, 0.28, false, { isInterior: true });

  const sternStemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, boatBaseY + 1.12, -3.4),
    new THREE.Vector3(0, boatBaseY + 1.54, -4.45),
    new THREE.Vector3(0, boatBaseY + 2.22, -4.98),
  ]);
  const sternStem = new THREE.Mesh(new THREE.TubeGeometry(sternStemCurve, 12, 0.09, 8, false), agedBeamMat);
  registerMeshNode(gheSamGroup, sternStem, 0.28, false, { isInterior: true });

  addBoxPart(gheSamGroup, 0.08, 0.92, 0.52, darkPlankMat, 0, boatBaseY + 1.52, -4.85, 0.28, false, { isInterior: true });

  for (const side of [-1, 1]) {
    const gunwaleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, boatBaseY + 1.88, -4.55),
      new THREE.Vector3(side * 1.18, boatBaseY + 1.46, -1.5),
      new THREE.Vector3(side * 1.22, boatBaseY + 1.46, 1.5),
      new THREE.Vector3(0, boatBaseY + 2.02, 4.78),
    ]);
    const gunwale = new THREE.Mesh(new THREE.TubeGeometry(gunwaleCurve, 16, 0.065, 6, false), agedBeamMat);
    registerMeshNode(gheSamGroup, gunwale, 0.28, false, { isInterior: true });

    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 4.1, 7), agedBeamMat);
    oar.rotation.x = Math.PI / 2 - 0.08;
    oar.rotation.z = side * 0.18;
    oar.position.set(side * 1.24, boatBaseY + 1.22, -0.3);
    registerMeshNode(gheSamGroup, oar, 0.28, false, { isInterior: true });
  }
  for (let rib = -3.2; rib <= 3.2; rib += 0.8) {
    addBoxPart(gheSamGroup, 1.92, 0.08, 0.12, agedBeamMat, 0, boatBaseY + 1.44, rib, 0.28, false, { isInterior: true });
  }

  const cabin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.96, 1.04, 3.2, 14, 1, false, 0, Math.PI),
    bambooMat
  );
  cabin.name = 'ghe-sam-cabin';
  cabin.rotation.z = Math.PI / 2;
  cabin.rotation.y = Math.PI / 2;
  cabin.position.set(0, boatBaseY + 1.48, 0.15);
  registerMeshNode(gheSamGroup, cabin, 0.36, false, { isInterior: true });
  for (let h = -1.35; h <= 1.40; h += 0.68) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.01, 0.036, 6, 14, Math.PI), agedBeamMat);
    hoop.position.set(0, boatBaseY + 1.48, 0.15 + h);
    registerMeshNode(gheSamGroup, hoop, 0.36, false, { isInterior: true });
  }

  // =========================================================================
  // 8. HÀNG LU NƯỚC MƯA (KHẠP DA BÒ) SẮP XẾP NGAY NGẮN DỌC THỀM NHÀ & CÂY CỔ THỤ NGOẠI VI
  // =========================================================================
  const jarPositions: Array<[number, number, number]> = [
    [-6.8, tier1Y, 3.42],
    [-5.8, tier1Y, 3.42],
    [-4.8, tier1Y, 3.42],
    [-3.8, tier1Y, 3.42],
    [6.2, tier1Y, 3.42],
    [7.2, tier1Y, 3.42],
    [8.2, tier1Y, 3.42],
    [9.2, tier1Y, 3.42],
    [-5.2, tier2Y, 2.38],
    [-4.2, tier2Y, 2.38],
    [-3.2, tier2Y, 2.38],
    [5.6, tier2Y, 2.38],
    [6.6, tier2Y, 2.38],
    [7.6, tier2Y, 2.38],
    [-7.2, tier3Y, -3.55],
    [-6.2, tier3Y, -3.55],
    [-5.2, tier3Y, -3.55],
    [7.6, tier3Y, -3.55],
    [8.6, tier3Y, -3.55],
    [9.6, tier3Y, -3.55],
  ];
  jarPositions.forEach(([jx, jy, jz]) => {
    buildLongSonRainwaterJar(group, jx, jy, jz, jarMat, waterMat, darkStoneMat);
  });

  buildLongSonInstancedFoliage(group, trunkMat);
}

// =============================================================================
// 7. KHU DI TÍCH ĐỊA ĐẠO LONG PHƯỚC (TP. BÀ RỊA — BRVT) [BRVT-DT-003]
// =============================================================================
function buildLongPhuocTunnels(group: THREE.Group) {
  const basaltCliffMat = makePbrMat(getStratifiedEarthTex('red_basalt_clay', 2, 1), { bumpScale: 0.16, roughness: 0.92 });
  const timberLogMat = makePbrMat(getTimberGrainTex('weathered_wood', 2, 2), { bumpScale: 0.07, roughness: 0.7 });
  const deepClayMat = new THREE.MeshStandardMaterial({ color: 0x622713, roughness: 0.95 });
  const midClayMat = new THREE.MeshStandardMaterial({ color: 0x9b4522, roughness: 0.93 });
  const tunnelWallMat = new THREE.MeshStandardMaterial({ color: 0x381d11, roughness: 0.88, side: THREE.DoubleSide });
  const topGrassMat = new THREE.MeshStandardMaterial({ color: 0x45692d, roughness: 0.9 });
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x768c3e, roughness: 0.72 });
  const flagRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
  const lampGlowMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: new THREE.Color(0xf59e0b), emissiveIntensity: 2.2, roughness: 0.25 });

  // Mặt cắt địa tầng Đất Đỏ Bazan (noShadow on enclosing cutaway walls so interior TubeGeometry tunnels are never darkened)
  addBoxPart(group, 26.6, 0.6, 22.6, deepClayMat, 0, -5.7, 0, 0);
  addBoxPart(group, 21.8, 5.2, 17.8, deepClayMat, -2.1, -2.8, -2.1, 0.1, false, { noShadow: true });
  addBoxPart(group, 21.8, 5.4, 17.8, midClayMat, -2.1, 2.5, -2.1, 1.0, false, { noShadow: true });
  addBoxPart(group, 21.8, 3.0, 17.8, basaltCliffMat, -2.1, 6.7, -2.1, 2.0, false, { noShadow: true });
  addBoxPart(group, 26.0, 0.8, 22.0, topGrassMat, 0, 8.6, 0, 2.5, false, { noShadow: true });

  // Dải mặt cắt trước +Z (z = +8.9) & bên phải +X (x = +10.9)
  addBoxPart(group, 26.0, 0.85, 4.2, deepClayMat, 0, -4.98, 8.9, 0);
  addBoxPart(group, 26.0, 0.95, 4.2, midClayMat, 0, 0.4, 8.9, 1.0);
  addBoxPart(group, 26.0, 1.9, 4.2, basaltCliffMat, 0, 7.25, 8.9, 2.2);

  addBoxPart(group, 4.2, 0.85, 17.8, deepClayMat, 10.9, -4.98, -2.1, 0);
  addBoxPart(group, 4.2, 0.95, 17.8, midClayMat, 10.9, 0.4, -2.1, 1.0);
  addBoxPart(group, 4.2, 1.9, 17.8, basaltCliffMat, 10.9, 7.25, -2.1, 2.2);

  // HỆ ĐƯỜNG HẦM UỐN LƯỢN BẰNG THREE.TubeGeometry + CatmullRomCurve3 (nổi bật vàng hổ phách trong X-Ray)
  const upperTunnelCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-9.5, 2.4, 8.7),
    new THREE.Vector3(-4.2, 2.5, 8.9),
    new THREE.Vector3(-0.6, 2.4, 8.5),
    new THREE.Vector3(4.2, 2.5, 8.8),
    new THREE.Vector3(9.8, 2.4, 8.2),
    new THREE.Vector3(10.6, 2.4, 2.5),
  ]);
  const upperTube = new THREE.Mesh(new THREE.TubeGeometry(upperTunnelCurve, 44, 0.92, 10, false), tunnelWallMat);
  registerMeshNode(group, upperTube, 0.45, false, { isInterior: true });

  const deepTunnelCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-9.8, -2.8, 8.7),
    new THREE.Vector3(-4.5, -2.9, 8.9),
    new THREE.Vector3(-0.6, -2.8, 8.5),
    new THREE.Vector3(5.4, -2.8, 8.7),
    new THREE.Vector3(10.2, -2.9, 7.2),
    new THREE.Vector3(10.6, -2.8, -6.5),
  ]);
  const deepTube = new THREE.Mesh(new THREE.TubeGeometry(deepTunnelCurve, 48, 0.96, 10, false), tunnelWallMat);
  registerMeshNode(group, deepTube, 0.3, false, { isInterior: true });

  // Ống tụt thông tầng uốn lượn kết nối tầng trên -> tầng sâu & lên cửa hầm mặt đất
  const shaftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.8, 8.6, 5.2),
    new THREE.Vector3(3.2, 5.8, 7.0),
    new THREE.Vector3(-0.6, 2.4, 8.4),
    new THREE.Vector3(-0.6, -2.8, 8.4),
  ]);
  const shaftTube = new THREE.Mesh(new THREE.TubeGeometry(shaftCurve, 28, 0.62, 10, false), tunnelWallMat);
  registerMeshNode(group, shaftTube, 0.4, false, { isInterior: true });

  // 1) HẦM CHỮ A CHỐNG PHÁO gia cố kèo gỗ (x = -6.5, z = +8.8)
  addInteriorWarmLight(group, -6.5, 4.2, 8.8, 0.8, 2.3, 10, 0xffaa44);
  for (const ax of [-8.8, -6.5, -4.2]) {
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 4.2, 0.24), timberLogMat);
    legL.position.set(ax, 3.1, 7.65);
    legL.rotation.x = 0.36;
    registerMeshNode(group, legL, 0.5, false, { isInterior: true });

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 4.2, 0.24), timberLogMat);
    legR.position.set(ax, 3.1, 9.95);
    legR.rotation.x = -0.36;
    registerMeshNode(group, legR, 0.5, false, { isInterior: true });

    addBoxPart(group, 0.22, 0.2, 2.4, timberLogMat, ax, 3.9, 8.8, 0.5, false, { isInterior: true });
  }

  // 2) PHÒNG HỌP CHI BỘ NGẦM & ĐÈN DẦU TỎA SÁNG (x = +4.2, z = +8.8)
  addInteriorWarmLight(group, 4.2, 4.2, 8.6, 0.8, 2.4, 10, 0xffaa33);
  addBoxPart(group, 3.6, 0.16, 1.5, timberLogMat, 4.2, 2.0, 8.6, 0.45, false, { isInterior: true });
  addBoxPart(group, 0.2, 0.9, 0.2, timberLogMat, 2.8, 1.45, 8.6, 0.45, false, { isInterior: true });
  addBoxPart(group, 0.2, 0.9, 0.2, timberLogMat, 5.6, 1.45, 8.6, 0.45, false, { isInterior: true });
  addBoxPart(group, 2.4, 1.3, 0.08, flagRedMat, 4.2, 3.6, 7.4, 0.45, false, { isInterior: true });
  const oilLamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), lampGlowMat);
  oilLamp.position.set(4.2, 2.26, 8.6);
  registerMeshNode(group, oilLamp, 0.45, false, { isInterior: true });

  // 3) HẦM QUÂN Y DÃ CHIẾN ở Mặt Cắt Bên (+X = +10.5, y = -2.8)
  addInteriorWarmLight(group, 10.4, -1.4, -2.2, 0.4, 2.4, 11, 0xffb347);
  for (const bz of [-5.8, -2.2, 1.4]) {
    addBoxPart(group, 1.5, 0.14, 2.4, bambooMat, 10.2, -3.55, bz, 0.3, false, { isInterior: true });
    addBoxPart(group, 0.14, 0.9, 0.14, bambooMat, 9.6, -4.05, bz - 1.0, 0.3, false, { isInterior: true });
    addBoxPart(group, 0.14, 0.9, 0.14, bambooMat, 10.8, -4.05, bz + 1.0, 0.3, false, { isInterior: true });
  }

  // 4) TẦNG MẶT ĐẤT: Nắp hầm bí mật, Ụ mối thông hơi, Công sự chiến đấu & Bụi tre tầm vông
  addBoxPart(group, 1.6, 0.22, 1.6, timberLogMat, 3.8, 9.06, 5.2, 2.5);
  const termiteMound = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.35, 9), basaltCliffMat);
  termiteMound.position.set(-5.5, 9.5, 4.8);
  registerMeshNode(group, termiteMound, 2.5);

  // Công sự chiến đấu cá nhân (foxholes)
  for (const [fx, fz] of [[-9.2, 6.5], [8.8, 6.2]]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.22, 8, 14), basaltCliffMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(fx, 9.02, fz);
    registerMeshNode(group, rim, 2.5);
  }

  // Bụi tre tầm vông Bà Rịa (nhiều thân đốt tre mọc chụm)
  for (const [bx, bz] of [[-7.2, -5.8], [7.8, -6.0]]) {
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.2, 7), bambooMat);
      stalk.position.set(bx + Math.cos(a) * 0.45, 11.4, bz + Math.sin(a) * 0.45);
      stalk.rotation.z = Math.cos(a) * 0.14;
      stalk.rotation.x = Math.sin(a) * 0.14;
      registerMeshNode(group, stalk, 2.5);
    }
  }
  buildOrganicTree(group, -2.5, 9.0, -1.5, 1.2, 2.5, 'banyan_bodhi');
  buildOrganicTree(group, 4.5, 9.0, -3.5, 1.15, 2.5, 'frangipani');
}

// =============================================================================
// 8. NHÀ CỔ TRẦN CÔNG VÀNG (TP. THỦ DẦU MỘT — BÌNH DƯƠNG) [BD-DT-001]
// =============================================================================
function buildTranCongVangHouse(group: THREE.Group) {
  const yardMat = makePbrMat(getTerracottaCourtyardTex(6, 5), { bumpScale: 0.08, roughness: 0.85 });
  const roofMat = makePbrMat(getYinYangTileTex('aged_terracotta', 5, 4), { bumpScale: 0.15, roughness: 0.46 });
  const camXeWoodMat = makePbrMat(getTimberGrainTex('cam_xe', 2, 2), { bumpScale: 0.05, roughness: 0.42 });
  const lacquerMat = makePbrMat(getTimberGrainTex('gilded_lacquer', 2, 2), { bumpScale: 0.04, roughness: 0.36 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe3b444, roughness: 0.25, metalness: 0.82 });
  const blueStoneMat = new THREE.MeshStandardMaterial({ color: 0x7a8086, roughness: 0.78 });
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x3b2820, roughness: 0.68 });
  const pearlMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.2, metalness: 0.48 });
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x3d6b34, roughness: 0.86, flatShading: true });

  // Sân gạch tàu & Nền đá xanh bó móng 5 gian 2 chái chữ Đinh
  addBoxPart(group, 34, 0.32, 28, yardMat, 0, 0.16, 0, 0, true);
  addBoxPart(group, 22.8, 0.45, 11.4, blueStoneMat, 0, 0.54, 2.2, 0);
  addBoxPart(group, 9.8, 0.45, 11.4, blueStoneMat, 0, 0.54, -8.2, 0);

  // Tam cấp đá xanh mặt trước (+Z)
  for (let s = 0; s < 3; s++) {
    addBoxPart(group, 6.8, 0.15, 0.48, blueStoneMat, 0, 0.36 + s * 0.15, 8.4 - s * 0.45, 0);
  }

  // HỆ 36 CỘT GỖ CĂM XE / GÕ ĐỎ ĐẶT TRÊN CHÂN TẢNG ĐÁ XANH CHẠM HOA SEN
  const xs = [-9.2, -6.2, -3.1, 0, 3.1, 6.2, 9.2];
  const zs = [-2.2, 0.4, 3.0, 5.6, 7.1];
  for (const cx of xs) {
    for (const cz of zs) {
      const colH = cz === 7.1 ? 3.2 : 4.0;
      buildTurnedPillarWithPlinth(group, cx, 0.76, cz, colH, 0.15, camXeWoodMat, blueStoneMat, 0.6, true);
    }
    // Hệ vì kèo đâm – trính chồng rường – trụ trốn
    addBoxPart(group, 0.18, 0.24, 9.2, camXeWoodMat, cx, 4.78, 2.2, 1.2, false, { isInterior: true });
    addBoxPart(group, 0.16, 0.22, 5.2, camXeWoodMat, cx, 5.25, 1.8, 1.2, false, { isInterior: true });
    addBoxPart(group, 0.14, 0.72, 0.14, camXeWoodMat, cx, 5.02, 0.4, 1.2, false, { isInterior: true });
    addBoxPart(group, 0.14, 0.72, 0.14, camXeWoodMat, cx, 5.02, 3.2, 1.2, false, { isInterior: true });
  }

  // Cột nhà phụ chữ Đinh phía sau (z = -5.2 .. -11.6)
  for (const cx of [-3.4, 0, 3.4]) {
    for (const cz of [-5.2, -8.4, -11.6]) {
      buildTurnedPillarWithPlinth(group, cx, 0.76, cz, 3.8, 0.14, camXeWoodMat, blueStoneMat, 0.6, true);
    }
  }

  // Vách gỗ hai đầu hồi & hậu nhà chính
  addBoxPart(group, 0.24, 3.8, 8.8, camXeWoodMat, -9.8, 2.7, 1.8, 0.9);
  addBoxPart(group, 0.24, 3.8, 8.8, camXeWoodMat, 9.8, 2.7, 1.8, 0.9);
  addBoxPart(group, 19.6, 3.8, 0.24, camXeWoodMat, 0, 2.7, -12.6, 0.9);

  // Hệ mái ngói âm dương võng nhẹ đặc trưng nhà rường (elevationTier = 2.5)
  buildTraditionalTieredRoof(group, 0, 4.92, 2.3, 23.8, 12.6, 2.7, roofMat, ridgeMat, goldMat, 2.5, false, 0.38);
  buildTraditionalTieredRoof(group, 0, 4.68, -8.2, 11.0, 11.6, 2.2, roofMat, ridgeMat, goldMat, 2.5, false, 0.28);

  // NỘI THẤT GỖ CHẠM LỘNG THẾP VÀNG & CẨN XÀ CỪ:
  addInteriorWarmLight(group, 0, 3.8, 2.5, 0.6, 2.6, 14, 0xffaa38);
  addInteriorWarmLight(group, -5.0, 3.4, 2.5, 0.6, 1.8, 11, 0xffb84d);

  // Bao lam chạm lộng Tứ linh & Hoành phi câu đối sơn son thếp vàng giữa gian thờ
  for (const bx of [-3.1, 0, 3.1]) {
    buildCarvedBaoLamArch(group, bx, 2.2, 3.0, 2.7, 1.9, goldMat, lacquerMat, 0.8, true);
  }
  addBoxPart(group, 2.4, 0.82, 0.12, lacquerMat, 0, 3.85, 0.5, 0.8, false, { isInterior: true });

  // Bức bình phong gỗ khảm xà cừ (z = +3.3) & Tủ thờ gia tiên (z = +0.5)
  addBoxPart(group, 2.8, 1.95, 0.14, camXeWoodMat, 0, 1.75, 3.3, 0.3, false, { isInterior: true });
  addBoxPart(group, 2.3, 1.4, 0.18, pearlMat, 0, 1.82, 3.3, 0.3, false, { isInterior: true });
  addBoxPart(group, 3.2, 1.45, 0.95, camXeWoodMat, 0, 1.5, 0.4, 0.25, false, { isInterior: true });
  addBoxPart(group, 2.8, 1.1, 0.98, pearlMat, 0, 1.55, 0.4, 0.25, false, { isInterior: true });

  // Bộ Trường kỷ cẩn xà cừ ở hai gian khách (x = ±4.6)
  for (const sx of [-4.6, 4.6]) {
    addBoxPart(group, 2.2, 0.52, 0.75, camXeWoodMat, sx, 1.04, 3.4, 0.25, false, { isInterior: true });
    addBoxPart(group, 1.85, 0.36, 0.78, pearlMat, sx, 1.24, 3.65, 0.25, false, { isInterior: true });
    addBoxPart(group, 1.4, 0.68, 0.85, camXeWoodMat, sx, 1.12, 2.0, 0.25, false, { isInterior: true });
  }

  // Hàng rào cây xanh cắt tỉa & chậu bonsai sân nhà cổ
  for (const hx of [-11.5, -6.5, 6.5, 11.5]) {
    addBoxPart(group, 4.2, 0.72, 0.85, hedgeMat, hx, 0.68, 11.8, 0.2);
  }
  for (const bx of [-4.5, 4.5]) {
    addBoxPart(group, 0.85, 0.55, 0.85, blueStoneMat, bx, 0.58, 10.6, 0.2);
    const bonsai = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 1), hedgeMat);
    bonsai.position.set(bx, 1.35, 10.6);
    registerMeshNode(group, bonsai, 0.2);
  }
  buildOrganicTree(group, -13.2, 0.32, 10.2, 1.15, 0.4, 'frangipani');
  buildOrganicTree(group, 13.2, 0.32, 10.2, 1.15, 0.4, 'frangipani');
}

// =============================================================================
// 9. KHU DI TÍCH ĐỊA ĐẠO TAM GIÁC SẮT — TÂY NAM BẾN CÁT [BD-DT-002]
// =============================================================================
function buildTamGiacSatTunnels(group: THREE.Group) {
  const basaltCliffMat = makePbrMat(getStratifiedEarthTex('red_basalt_clay', 2, 1), { bumpScale: 0.16, roughness: 0.92 });
  const timberMat = makePbrMat(getTimberGrainTex('weathered_wood', 2, 2), { bumpScale: 0.06, roughness: 0.68 });
  const deepClayMat = new THREE.MeshStandardMaterial({ color: 0x5d2410, roughness: 0.95 });
  const midClayMat = new THREE.MeshStandardMaterial({ color: 0x994120, roughness: 0.93 });
  const tunnelWallMat = new THREE.MeshStandardMaterial({ color: 0x32180e, roughness: 0.88, side: THREE.DoubleSide });
  const topSoilMat = new THREE.MeshStandardMaterial({ color: 0x526430, roughness: 0.9 });
  const saigonRiverMat = new THREE.MeshStandardMaterial({ color: 0x246269, roughness: 0.16, metalness: 0.44, transparent: true, opacity: 0.88 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.38, metalness: 0.78 });
  const emberMat = new THREE.MeshStandardMaterial({ color: 0xff5500, emissive: new THREE.Color(0xff4500), emissiveIntensity: 2.3, roughness: 0.35 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x4b5c34, roughness: 0.8 });

  // Khối mặt cắt địa tầng ven sông Sài Gòn (noShadow on enclosing cutaway soil blocks)
  addBoxPart(group, 26.6, 0.6, 22.6, deepClayMat, 0, -5.7, 0, 0);
  addBoxPart(group, 17.5, 5.2, 17.8, deepClayMat, 0.1, -2.8, -2.1, 0.1, false, { noShadow: true });
  addBoxPart(group, 17.5, 5.4, 17.8, midClayMat, 0.1, 2.5, -2.1, 1.0, false, { noShadow: true });
  addBoxPart(group, 17.5, 3.0, 17.8, basaltCliffMat, 0.1, 6.7, -2.1, 2.0, false, { noShadow: true });

  // Sông Sài Gòn uốn lượn dọc rìa trái (-X) nối sang Địa đạo Củ Chi
  addBoxPart(group, 4.8, 4.6, 22.0, deepClayMat, -10.8, -3.1, 0, 0);
  const riverShape = new THREE.Shape();
  riverShape.moveTo(-2.4, -11.0);
  riverShape.lineTo(1.8, -11.0);
  riverShape.quadraticCurveTo(2.9, -3.5, 1.6, 2.5);
  riverShape.quadraticCurveTo(0.8, 7.0, 2.2, 11.0);
  riverShape.lineTo(-2.4, 11.0);
  riverShape.closePath();
  const riverGeo = new THREE.ExtrudeGeometry(riverShape, { depth: 7.6, bevelEnabled: false, curveSegments: 16 });
  riverGeo.rotateX(Math.PI / 2);
  const riverMesh = new THREE.Mesh(riverGeo, saigonRiverMat);
  riverMesh.position.set(-10.8, 6.8, 0);
  registerMeshNode(group, riverMesh, 0.3, false, { noShadow: true });

  // Thuyền gỗ bí mật bên bến vượt sông Sài Gòn
  const sampanShape = new THREE.Shape();
  sampanShape.moveTo(0, -1.7);
  sampanShape.quadraticCurveTo(0.6, 0, 0, 1.7);
  sampanShape.quadraticCurveTo(-0.6, 0, 0, -1.7);
  const sampanGeo = new THREE.ExtrudeGeometry(sampanShape, { depth: 0.35, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04 });
  sampanGeo.rotateX(Math.PI / 2);
  const boat = new THREE.Mesh(sampanGeo, timberMat);
  boat.position.set(-10.2, 7.05, 4.8);
  registerMeshNode(group, boat, 0.5);

  // Mặt đất bên trên & Dải trần mặt cắt trước
  addBoxPart(group, 21.5, 0.8, 22.0, topSoilMat, 2.25, 8.6, 0, 2.5, false, { noShadow: true });
  addBoxPart(group, 21.5, 0.85, 4.2, deepClayMat, 2.25, -4.98, 8.9, 0);
  addBoxPart(group, 21.5, 1.0, 4.2, midClayMat, 2.25, 0.4, 8.9, 1.0);
  addBoxPart(group, 21.5, 1.9, 4.2, basaltCliffMat, 2.25, 7.25, 8.9, 2.2);

  // MẠNG ĐƯỜNG HẦM 2 TẦNG UỐN LƯỢN (TubeGeometry + CatmullRomCurve3)
  const level1Curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-7.4, 2.2, 8.6),
    new THREE.Vector3(-2.2, 2.3, 8.8),
    new THREE.Vector3(3.2, 2.2, 8.6),
    new THREE.Vector3(7.8, 2.3, 8.8),
    new THREE.Vector3(10.8, 2.2, 4.5),
  ]);
  registerMeshNode(group, new THREE.Mesh(new THREE.TubeGeometry(level1Curve, 44, 0.92, 10, false), tunnelWallMat), 0.45, false, { isInterior: true });

  const level2Curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-8.6, -2.5, 8.6),
    new THREE.Vector3(-3.5, -2.9, 8.8),
    new THREE.Vector3(0.8, -2.9, 8.6),
    new THREE.Vector3(5.8, -2.8, 8.8),
    new THREE.Vector3(10.8, -2.8, 6.2),
  ]);
  registerMeshNode(group, new THREE.Mesh(new THREE.TubeGeometry(level2Curve, 48, 0.96, 10, false), tunnelWallMat), 0.3, false, { isInterior: true });

  // 1) HẦM CHỈ HUY CHIẾN DỊCH & SA BÀN TÁC CHIẾN (x = -2.2, z = +8.7)
  addInteriorWarmLight(group, -2.2, 4.2, 8.6, 0.8, 2.3, 10, 0xffaa38);
  addBoxPart(group, 3.2, 0.16, 1.4, timberMat, -2.2, 2.0, 8.6, 0.45, false, { isInterior: true });
  // Sa bàn tác chiến 3D mini trên bàn chỉ huy
  addBoxPart(group, 1.5, 0.14, 0.95, topSoilMat, -2.5, 2.15, 8.6, 0.45, false, { isInterior: true });
  const hillMini = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.25, 6), midClayMat);
  hillMini.position.set(-2.5, 2.3, 8.6);
  registerMeshNode(group, hillMini, 0.45, false, { isInterior: true });
  addBoxPart(group, 0.65, 0.45, 0.45, steelMat, -1.1, 2.3, 8.6, 0.45, false, { isInterior: true });

  // 2) KHO VŨ KHÍ NGẦM (x = +7.8, z = +8.6)
  addInteriorWarmLight(group, 7.8, 4.2, 8.6, 0.8, 2.1, 9, 0xffaa44);
  for (let b = 0; b < 4; b++) {
    addBoxPart(group, 1.0, 0.58, 0.65, crateMat, 6.2 + (b % 2) * 1.2, 1.28 + Math.floor(b / 2) * 0.6, 8.4, 0.45, false, { isInterior: true });
  }
  for (let r = 0; r < 5; r++) {
    const rifle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.8, 6), steelMat);
    rifle.rotation.z = 0.12;
    rifle.position.set(8.6 + r * 0.28, 2.0, 7.7);
    registerMeshNode(group, rifle, 0.45, false, { isInterior: true });
  }

  // 3) TẦNG 2 NGẦM: BẾP HOÀNG CẦM TẢN KHÓI & CỬA THOÁT HIỂM RA SÔNG SÀI GÒN
  addInteriorWarmLight(group, -1.5, -1.4, 8.6, 0.4, 2.3, 10, 0xff7722);
  addInteriorWarmLight(group, 5.8, -1.4, 8.6, 0.4, 2.0, 10, 0xffaa38);

  addBoxPart(group, 1.9, 0.72, 1.4, midClayMat, 0.5, -4.18, 8.5, 0.25, false, { isInterior: true });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.42, 14), steelMat);
  pot.position.set(0.5, -3.65, 8.5);
  registerMeshNode(group, pot, 0.25, false, { isInterior: true });
  const embers = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), emberMat);
  embers.position.set(0.5, -3.95, 8.9);
  registerMeshNode(group, embers, 0.25, false, { isInterior: true });

  // Đường ống tản khói ngầm uốn lượn chạy ra mặt đất
  const smokeFlueCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.5, -3.85, 8.2),
    new THREE.Vector3(3.2, -3.7, 7.5),
    new THREE.Vector3(6.4, -2.6, 7.2),
    new THREE.Vector3(8.5, 1.5, 6.8),
    new THREE.Vector3(9.2, 8.6, 6.5),
  ]);
  const smokeFlue = new THREE.Mesh(new THREE.TubeGeometry(smokeFlueCurve, 30, 0.14, 8, false), steelMat);
  registerMeshNode(group, smokeFlue, 0.3, false, { isInterior: true });

  // Cửa hầm thoát hiểm mở ra bờ sông Sài Gòn
  addBoxPart(group, 1.6, 1.8, 2.2, timberMat, -8.3, -2.5, 8.6, 0.3, false, { isInterior: true });

  // GIAO THÔNG HÀO ZIGZAG & HÀNG CÂY CAO SU BẾN CÁT THẲNG TẮP TRÊN MẶT ĐẤT
  for (const [gx, gz, rot] of [
    [-3.5, 3.2, 0.35],
    [1.8, 1.5, -0.45],
    [6.2, -1.5, 0.35],
  ] as Array<[number, number, number]>) {
    const trench = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.48, 1.1), basaltCliffMat);
    trench.position.set(gx, 8.95, gz);
    trench.rotation.y = rot;
    registerMeshNode(group, trench, 2.5);
  }
  for (const rx of [-5.2, 0.5, 6.2]) {
    for (const rz of [-7.5, -2.5]) {
      buildOrganicTree(group, rx, 9.0, rz, 1.12, 2.5, 'rubber');
    }
  }
}

// =============================================================================
// BỘ ĐỊNH TUYẾN CHÍNH CHO 9 DI TÍCH & HOTSPOTS (1 -> 6)
// =============================================================================
export function buildNewNineHeritageModel(siteId: string, group: THREE.Group): boolean {
  switch (siteId) {
    case 'HCM-DT-008':
      buildLeVanDuyetTomb(group);
      return true;
    case 'HCM-DT-010':
      buildGiongCaVoArchaeology(group);
      return true;
    case 'HCM-DT-011':
      buildGiacLamPagoda(group);
      return true;
    case 'HCM-DT-012':
      buildNghiaAnAssemblyHall(group);
      return true;
    case 'BRVT-DT-001':
      // Bạch Dinh chỉ hiển thị từ tệp .glb thực tế, không tạo hình khối thủ công
      return true;
    case 'BRVT-DT-002':
      buildNhaLonLongSon(group);
      return true;
    case 'BRVT-DT-003':
      buildLongPhuocTunnels(group);
      return true;
    case 'BD-DT-001':
      buildTranCongVangHouse(group);
      return true;
    case 'BD-DT-002':
      buildTamGiacSatTunnels(group);
      return true;
    default:
      return false;
  }
}

export const NEW_NINE_LANDMARK_FEATURES: Record<string, HeritageHotspotFeature[]> = {
  'HCM-DT-008': [
    {
      id: 'f1',
      name: 'Cổng Tam Quan & Bình Phong Rồng Hổ',
      description: 'Cổng Tam Quan cổ kính hai tầng mái ngói âm dương uốn cong đầu đao cùng Lưỡng Long Chầu Nguyệt, chắn sau là bức bình phong Rồng Hổ.',
      cameraPos: [0, 8.5, 25],
      targetPos: [0, 3.2, 12.2],
      thumbnailUrl: '',
    },
    {
      id: 'f2',
      name: 'Nhà Bia Đá Cổ Phan Thanh Giản (1868)',
      description: 'Nhà bia tứ giác bên trái sân lăng lưu giữ tấm bia đá xanh khắc bài văn bia ca ngợi công đức khai mở Gia Định của Tả quân.',
      cameraPos: [-16, 6.5, 14],
      targetPos: [-9.5, 2.2, 7.5],
      thumbnailUrl: '',
    },
    {
      id: 'f3',
      name: 'Tiền Điện, Đỉnh Đồng & Bao Lam Thếp Vàng',
      description: 'Hệ mái ngói âm dương nối tiếp cùng đỉnh đồng lớn trước sân, hương án sơn son thếp vàng và hai hàng giá binh khí Bát Bửu.',
      cameraPos: [12, 7.5, 11],
      targetPos: [0, 2.5, 1.5],
      thumbnailUrl: '',
    },
    {
      id: 'f4',
      name: 'Chính Điện & Khám Thờ Tả Quân Thếp Vàng',
      description: 'Trung tâm nội thất điện thờ với khám thờ sơn son thếp vàng rực rỡ và hệ cột gỗ sơn son chạm trổ tinh xảo.',
      cameraPos: [7.5, 5.5, 4.5],
      targetPos: [0, 2.2, -7.2],
      thumbnailUrl: '',
    },
    {
      id: 'f5',
      name: 'Mộ Song Táng Hình Nấm Rùa',
      description: 'Hai ngôi mộ cổ của Tả quân Lê Văn Duyệt và nhị vị phu nhân đắp vữa ô dước hình mai rùa nằm trong vòng thành đá phía sau.',
      cameraPos: [-12, 7.2, -18],
      targetPos: [0, 1.2, -11.8],
      thumbnailUrl: '',
    },
  ],
  'HCM-DT-010': [
    {
      id: 'f1',
      name: 'Địa Tầng Khảo Cổ & Mái Che Bảo Tồn',
      description: 'Mặt cắt địa chất Giồng Cá Vồ phân tách 3 lớp đất cát giồng, tầng văn hóa Tiền Óc Eo và bùn ngập mặn Cần Giờ.',
      cameraPos: [18, 12, 20],
      targetPos: [0, 1.5, 1.5],
      thumbnailUrl: '',
    },
    {
      id: 'f2',
      name: 'Quần Thể 300+ Mộ Chum Gốm Cổ (Lathe 3D)',
      description: 'Các mộ chum gốm hình trứng và hình trụ đứng đặt trong lưới hố khai quật ô vuông có niên đại hơn 2.500 năm.',
      cameraPos: [-8, 6.2, 12],
      targetPos: [-1.3, -0.4, 1.6],
      thumbnailUrl: '',
    },
    {
      id: 'f3',
      name: 'Khuyên Tai Hai Đầu Thú & Hạt Mã Não',
      description: 'Hiện vật tùy táng quý hiếm bằng vàng, đá ngọc nephrite và hạt mã não đỏ cam phát sáng khi bật X-Ray.',
      cameraPos: [5.5, 4.5, 9.5],
      targetPos: [1.4, -0.4, 4.3],
      thumbnailUrl: '',
    },
    {
      id: 'f4',
      name: 'Hố Khai Quật Lưới Dây & Cọc Mốc',
      description: 'Hệ thống dây định vị và cọc mốc khảo cổ học giúp ghi nhận chính xác tọa độ từng hiện vật gốm chân đế.',
      cameraPos: [0, 10, 14],
      targetPos: [0, 0.2, 3.2],
      thumbnailUrl: '',
    },
    {
      id: 'f5',
      name: 'Hệ Sinh Thái Rừng Đước & Kênh Triều Cần Giờ',
      description: 'Cây đước rễ chống và lạch nước thủy triều bao bọc gò đất cao cổ đại giữa vùng ngập mặn.',
      cameraPos: [18, 8.5, -10],
      targetPos: [10.5, 1.5, -3.5],
      thumbnailUrl: '',
    },
  ],
  'HCM-DT-011': [
    {
      id: 'f1',
      name: 'Bảo Tháp Xá Lợi 7 Tầng Lục Giác',
      description: 'Ngọn bảo tháp lục giác cao vút tôn trí xá lợi Phật ở góc trước sân chùa, nổi bật với 7 tầng lan can đá và mái cong.',
      cameraPos: [-20, 12, 18],
      targetPos: [-11.2, 6.5, 7.5],
      thumbnailUrl: '',
    },
    {
      id: 'f2',
      name: 'Cây Bồ Đề Cổ Thụ Rễ Phụ (1953)',
      description: 'Cây bồ đề cổ thụ rợp bóng với chùm rễ phụ buông rủ bên phải sân trước được chiết từ cây bồ đề thiêng Sri Lanka.',
      cameraPos: [20, 9.5, 18],
      targetPos: [12.2, 3.5, 10.2],
      thumbnailUrl: '',
    },
    {
      id: 'f3',
      name: 'Bố Cục 3 Gian Chữ Tam & Mái Ngói Liệt',
      description: 'Tiền đường, Chính điện và Nhà Tổ nối tiếp theo trục dọc, lợp ngói âm dương võng cong cổ kính chuẩn mực Nam Bộ.',
      cameraPos: [16, 13, 16],
      targetPos: [2.5, 4.5, -1.8],
      thumbnailUrl: '',
    },
    {
      id: 'f4',
      name: 'Hệ 98 Cột Gỗ Lim & Hoành Phi Câu Đối',
      description: 'Không gian nội thất dày đặc cột gỗ lim trên chân tảng đá xanh nối bằng kỹ thuật xuyên trính chạm trổ tùng hạc.',
      cameraPos: [12, 5.8, 8.5],
      targetPos: [2.5, 2.2, 1.5],
      thumbnailUrl: '',
    },
    {
      id: 'f5',
      name: 'Chính Điện Phật A Di Đà & Thập Bát La Hán',
      description: '18 pho tượng La Hán gỗ mít thếp vàng sắp thành hai hàng trang nghiêm chầu về tượng Phật A Di Đà tại trung tâm.',
      cameraPos: [-6, 5.2, 6.5],
      targetPos: [2.5, 2.0, -3.2],
      thumbnailUrl: '',
    },
  ],
  'HCM-DT-012': [
    {
      id: 'f1',
      name: 'Mái Ngói Lưu Ly Xanh Ngọc & Gốm Cây Mai',
      description: 'Bộ mái cong Triều Châu phủ ngói ống men xanh ngọc bích cùng hàng tượng tiểu cảnh gốm sứ Cây Mai rực rỡ trên bờ nóc.',
      cameraPos: [15, 12, 18],
      targetPos: [0, 6.8, -1.0],
      thumbnailUrl: '',
    },
    {
      id: 'f2',
      name: 'Sân Thiên Tỉnh & Nhang Vòng Treo Cao',
      description: 'Khoảng giếng trời thông thoáng giữa Tiền điện và Chính điện đón ánh sáng tự nhiên rọi xuống sân đá và nhang vòng.',
      cameraPos: [8, 9.5, 8],
      targetPos: [0, 2.5, 0.4],
      thumbnailUrl: '',
    },
    {
      id: 'f3',
      name: 'Tượng Ngựa Xích Thố Đỏ Rực',
      description: 'Pho tượng ngựa Xích Thố tạc gỗ sơn son bóng lộng đặt tại Tiền điện bên trái, gắn liền với lễ hội chui bụng ngựa cầu may.',
      cameraPos: [-11, 4.5, 11],
      targetPos: [-5.2, 1.8, 5.6],
      thumbnailUrl: '',
    },
    {
      id: 'f4',
      name: 'Chính Điện Quan Thánh & Bao Lam Thếp Vàng',
      description: 'Khám thờ Quan Công uy nghi sau lớp bao lam gỗ chạm lộng tinh xảo và chiếc lư hương đồng cổ.',
      cameraPos: [4.5, 5.2, 2.0],
      targetPos: [0, 2.2, -7.8],
      thumbnailUrl: '',
    },
    {
      id: 'f5',
      name: 'Đại Hồng Chung Cổ & Trống Lễ Hội',
      description: 'Chuông đồng lớn treo trên giá gỗ bên cánh phải cùng chiếc trống lễ hội uy nghi.',
      cameraPos: [11, 5.0, 2.5],
      targetPos: [5.8, 2.2, -4.2],
      thumbnailUrl: '',
    },
  ],
  'BRVT-DT-001': [
    {
      id: 'f1',
      name: 'Mặt Tiền Vòm Cuốn Tân Cổ Điển & Mái Marseille',
      description: 'Tòa biệt thự 3 tầng tường trắng ngà với hành lang vòm bán nguyệt Pháp, lan can lục bình đá và mái ngói đỏ Marseille.',
      cameraPos: [16, 13, 22],
      targetPos: [0, 7.5, -1.5],
      thumbnailUrl: '',
    },
    {
      id: 'f2',
      name: 'Trận Địa 19 Khẩu Thần Công Hướng Biển',
      description: 'Dãy 19 khẩu thần công đặt dọc lan can đá phía trước nhìn thẳng xuống vịnh Bãi Trước Vũng Tàu.',
      cameraPos: [12, 5.5, 18],
      targetPos: [0, 1.5, 10.6],
      thumbnailUrl: '',
    },
    {
      id: 'f3',
      name: '8 Tượng Bán Thân Hy Lạp - La Mã Trên Diềm Mái',
      description: 'Chuỗi 8 hốc tròn gắn tượng bán thân gốm sứ men màu châu Âu tô điểm diềm thượng tầng 3 của dinh thự.',
      cameraPos: [-10, 13.5, 13],
      targetPos: [0, 11.2, 2.5],
      thumbnailUrl: '',
    },
    {
      id: 'f4',
      name: 'Phòng Trưng Bày Gốm Sứ Cổ Hòn Cau (Khang Hy)',
      description: 'Nội thất tầng 3 trưng bày bộ sưu tập bình gốm sứ men lam Khang Hy trục vớt từ tàu đắm vùng biển Hòn Cau.',
      cameraPos: [6, 10.5, 7],
      targetPos: [0, 9.2, -3.5],
      thumbnailUrl: '',
    },
    {
      id: 'f5',
      name: 'Cầu Thang Xoắn Gỗ Cổ & Rừng Hoa Sứ Núi Lớn',
      description: 'Nội thất cầu thang gỗ xoắn tầng 2 hòa quyện giữa sắc hoa sứ trắng cổ thụ bao bọc toàn khu dinh thự.',
      cameraPos: [-16, 8.5, 12],
      targetPos: [-4.2, 6.2, -2.5],
      thumbnailUrl: '',
    },
  ],
  'BRVT-DT-002': [
    {
      id: 'f1',
      name: 'Chính Điện (Nhà Thánh)',
      description: 'Khu Nhà Thánh 3 nếp trùng thiềm điệp ốc (Tiền điện – Trung điện – Hậu điện) với hệ cửa bức bàn gỗ căm xe, lan can con tiện, hương án, 6 tủ thờ cẩn ốc xà cừ và hoành phi câu đối sơn son thếp vàng (không đặt tượng thờ theo đúng tín ngưỡng Đạo Ông Trần).',
      cameraPos: [1.2, 6.2, -0.8],
      targetPos: [1.2, 3.8, -8.2],
      thumbnailUrl: '',
    },
    {
      id: 'f2',
      name: 'Lầu Đôi & Khu Nhà Lồng',
      description: 'Cặp Lầu Đôi 2 tầng (Lầu Tiên – Lầu Cấm) và Nhà Long Đình chồng diêm nối liền mạch qua hệ hành lang gỗ có mái ngói âm dương, lan can con tiện dẫn thẳng vào dãy Nhà Lồng phía sau.',
      cameraPos: [12.5, 7.6, 8.8],
      targetPos: [1.2, 4.2, -0.4],
      thumbnailUrl: '',
    },
    {
      id: 'f3',
      name: 'Sân Đền, Đỉnh Hương & Hàng Lu Nước Mưa',
      description: 'Sân đền lát đá xanh Núi Nứa rộng thoáng với Đỉnh Hương Đá chạm khắc ở trung tâm, cầu thang đá 3 lối đi và hàng lu nước mưa (khạp da bò) xếp ngay ngắn dọc thềm nhà.',
      cameraPos: [7.8, 5.4, 14.2],
      targetPos: [1.2, 1.8, 6.2],
      thumbnailUrl: '',
    },
    {
      id: 'f4',
      name: 'Hậu Điện & Khu Bếp Nhà Lò',
      description: 'Khu Hậu Điện nối liền Nhà Lò cổ truyền có bếp lò xây gạch, nồi đồng lớn cùng làn khói bếp mỏng bay nhẹ lên trời trên nền triền Núi Nứa (Ngọa Long) và lối bậc thang đá xanh lên Lăng Mộ Ông Trần.',
      cameraPos: [-16.2, 6.8, -2.2],
      targetPos: [-9.4, 3.6, -10.2],
      thumbnailUrl: '',
    },
    {
      id: 'f5',
      name: 'Nhà Ghe Sấm (Di Vật Khai Hoang 1900)',
      description: 'Nhà che bên trái sân đền căn chỉnh vuông góc với trục sân chính, bảo tồn nguyên vẹn chiếc Ghe Sấm thân ghe bầu lớn dài với phần mũi ghe cong truyền thống đặt trên đà gỗ căm xe.',
      cameraPos: [-4.2, 3.8, 13.2],
      targetPos: [-10.6, 1.9, 8.2],
      thumbnailUrl: '',
    },
    {
      id: 'f6',
      name: 'Cổng & Hàng Rào Trụ Đá Không Khóa Cửa',
      description: 'Hàng rào trụ đá xanh thấp gắn đèn lồng cổ và Cổng chính mở rộng không cánh khóa nhìn ra trục đường chính phía trước — biểu trưng tinh thần hiếu khách "mở cửa suốt ngày đêm đãi khách thập phương" của Nhà Lớn Long Sơn.',
      cameraPos: [1.2, 4.8, 22.4],
      targetPos: [1.2, 2.1, 13.5],
      thumbnailUrl: '',
    },
  ],
  'BRVT-DT-003': [
    {
      id: 'f1',
      name: 'Mạng Đường Hầm Địa Đạo Uốn Lượn 2 Tầng',
      description: 'Sa bàn cắt dọc 2 tầng đường hầm uốn lượn tự nhiên sâu 3m–6m trong lớp đất đỏ bazan vững chãi vùng Bà Rịa.',
      cameraPos: [21, 12, 23],
      targetPos: [0, 1.8, 2.0],
      thumbnailUrl: '',
    },
    {
      id: 'f2',
      name: 'Hầm Chữ A Gia Cố Gỗ Chống Bom Pháo',
      description: 'Hệ khung gỗ chữ A kết hợp giằng ngang chịu lực giúp bảo vệ an toàn trước sức công phá pháo kích hạng nặng.',
      cameraPos: [-12, 6.0, 18],
      targetPos: [-6.5, 3.2, 8.6],
      thumbnailUrl: '',
    },
    {
      id: 'f3',
      name: 'Phòng Họp Chi Bộ & Đèn Dầu Ngầm',
      description: 'Khoang hầm chỉ huy ngầm nối thẳng xuống đường hầm xương sống qua ống tụt thông tầng.',
      cameraPos: [8, 5.5, 19],
      targetPos: [4.0, 2.8, 8.6],
      thumbnailUrl: '',
    },
    {
      id: 'f4',
      name: 'Hầm Quân Y Dã Chiến (Mặt Cắt Bên +X)',
      description: 'Khoang hầm cứu thương tầng sâu trang bị sập tre và tủ y tế phục vụ thương bệnh binh.',
      cameraPos: [22, 2.5, 2],
      targetPos: [10.4, -2.2, -2.2],
      thumbnailUrl: '',
    },
    {
      id: 'f5',
      name: 'Bụi Tre Tầm Vông, Ụ Mối & Nắp Hầm Bí Mật',
      description: 'Mặt đất phía trên phủ bụi tre tầm vông và ụ mối che giấu hoàn hảo nắp hầm bí mật và công sự cá nhân.',
      cameraPos: [-11, 15, 14],
      targetPos: [0, 9.0, 2.5],
      thumbnailUrl: '',
    },
  ],
  'BD-DT-001': [
    {
      id: 'f1',
      name: 'Kiến Trúc Nhà Rường 5 Gian 2 Chái Chữ Đinh',
      description: 'Toàn cảnh ngôi nhà gỗ cổ bên sông Sài Gòn với hệ mái ngói âm dương võng nhẹ và nền đá xanh vững chắc.',
      cameraPos: [18, 11, 20],
      targetPos: [0, 3.8, 1.5],
      thumbnailUrl: '',
    },
    {
      id: 'f2',
      name: 'Hệ 36 Cột Gỗ Căm Xe & Chân Tảng Đá Hoa Sen',
      description: 'Mạng cột gỗ tròn bóng loáng tỳ trên chân tảng đá xanh chạm hoa sen nâng đỡ toàn bộ hệ kèo đấm truyền thống.',
      cameraPos: [-10, 4.8, 13],
      targetPos: [0, 2.4, 3.2],
      thumbnailUrl: '',
    },
    {
      id: 'f3',
      name: 'Bao Lam Chạm Lộng Tứ Linh Thếp Vàng',
      description: 'Các bức bao lam, hoành phi chạm lộng tinh xảo đề tài Long - Lân - Quy - Phụng của thợ mộc Thủ Dầu Một.',
      cameraPos: [6, 5.2, 10],
      targetPos: [0, 3.8, 2.8],
      thumbnailUrl: '',
    },
    {
      id: 'f4',
      name: 'Tủ Thờ Gia Tiên & Bình Phong Cẩn Xà Cừ',
      description: 'Bức bình phong gỗ và tủ thờ khảm ốc xà cừ lấp lánh đặt tại gian chính giữa trang nghiêm.',
      cameraPos: [-4, 4.0, 9.5],
      targetPos: [0, 1.7, 1.8],
      thumbnailUrl: '',
    },
    {
      id: 'f5',
      name: 'Gian Khách Trường Kỷ & Vườn Bonsai Kiểng Cổ',
      description: 'Bộ trường kỷ khảm trai tiếp khách hai bên gian thờ nối ra sân gạch tàu viền hàng rào kiểng.',
      cameraPos: [13, 6.2, 6],
      targetPos: [4.6, 1.8, 2.5],
      thumbnailUrl: '',
    },
  ],
  'BD-DT-002': [
    {
      id: 'f1',
      name: 'Vành Đai Đỏ Bên Sông Sài Gòn & Rừng Cao Su',
      description: 'Toàn cảnh sa bàn mặt cắt địa đạo Tam Giác Sắt đối diện bờ sông Sài Gòn uốn lượn với hàng cao su Bến Cát thẳng tắp.',
      cameraPos: [20, 14, 24],
      targetPos: [-1.0, 2.5, 1.0],
      thumbnailUrl: '',
    },
    {
      id: 'f2',
      name: 'Hầm Chỉ Huy & Sa Bàn Tác Chiến 3D',
      description: 'Phòng chỉ huy ngầm tầng 1 với bàn sa bàn tác chiến và máy vô tuyến chỉ đạo đánh bại trận càn Cedar Falls.',
      cameraPos: [-4, 6.2, 19],
      targetPos: [-2.2, 3.0, 8.6],
      thumbnailUrl: '',
    },
    {
      id: 'f3',
      name: 'Kho Vũ Khí Ngầm Tây Nam Bến Cát',
      description: 'Kho cất giữ súng bộ binh và hòm đạn chiến đấu ẩn sâu dưới tầng đất đỏ sét pha sỏi.',
      cameraPos: [14, 5.5, 18],
      targetPos: [7.8, 2.8, 8.6],
      thumbnailUrl: '',
    },
    {
      id: 'f4',
      name: 'Bếp Hoàng Cầm & Ống Tản Khói Ngầm',
      description: 'Hệ bếp nấu ăn ngầm dẫn khói qua đường ống uốn lượn xuyên đất khiến máy bay trinh sát không thể phát hiện.',
      cameraPos: [5, 1.2, 19],
      targetPos: [1.2, -3.5, 8.5],
      thumbnailUrl: '',
    },
    {
      id: 'f5',
      name: 'Cửa Thoát Hiểm Ven Sông & Giao Thông Hào',
      description: 'Ngách hầm sâu mở thẳng ra bến thuyền sông Sài Gòn kết nối trực tiếp sang Địa đạo Củ Chi.',
      cameraPos: [-18, 6.5, 16],
      targetPos: [-9.2, 1.8, 7.0],
      thumbnailUrl: '',
    },
  ],
};
