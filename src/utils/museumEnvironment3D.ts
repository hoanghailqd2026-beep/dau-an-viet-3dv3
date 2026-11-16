import * as THREE from 'three';

export type MuseumLightingMode = 'studio' | 'day' | 'golden' | 'night';

interface CachedCompassTextures {
  dark: THREE.CanvasTexture;
  light: THREE.CanvasTexture;
}

let cachedDustTexture: THREE.CanvasTexture | null = null;
let cachedCompassTextures: CachedCompassTextures | null = null;

/**
 * Generates a soft radial champagne-gold glow sprite for floating dust & stars (cached once).
 */
export function getSoftGlowParticleTexture(): THREE.CanvasTexture {
  if (cachedDustTexture) return cachedDustTexture;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0.0, 'rgba(255, 246, 224, 1.0)');
    grad.addColorStop(0.28, 'rgba(229, 196, 128, 0.85)');
    grad.addColorStop(0.65, 'rgba(197, 160, 89, 0.22)');
    grad.addColorStop(1.0, 'rgba(197, 160, 89, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.isCached = true;
  tex.needsUpdate = true;
  cachedDustTexture = tex;
  return tex;
}

function drawCompassRoseCanvas(variant: 'dark' | 'light'): HTMLCanvasElement {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.492;

  const isDark = variant === 'dark';

  // 1. Stone / Architectural Base Radial Surface
  const baseGrad = ctx.createRadialGradient(cx, cy, size * 0.06, cx, cy, maxR);
  if (isDark) {
    baseGrad.addColorStop(0.0, '#1D1C1F');
    baseGrad.addColorStop(0.55, '#161518');
    baseGrad.addColorStop(0.88, '#121114');
    baseGrad.addColorStop(1.0, '#0E0D10');
  } else {
    baseGrad.addColorStop(0.0, '#E3DDD1');
    baseGrad.addColorStop(0.55, '#D7CFC0');
    baseGrad.addColorStop(0.88, '#C8BEAC');
    baseGrad.addColorStop(1.0, '#BCB09B');
  }
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Subtle radial architectural micro-grain (deterministic, light touch)
  ctx.save();
  ctx.globalAlpha = isDark ? 0.035 : 0.04;
  for (let i = 0; i < 2400; i++) {
    const ang = (i * 137.508) % (Math.PI * 2);
    const rad = Math.sqrt((i % 997) / 997) * maxR;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#000000';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();

  const goldPrimary = isDark ? 'rgba(197, 160, 89, 0.58)' : 'rgba(122, 92, 42, 0.65)';
  const goldSecondary = isDark ? 'rgba(197, 160, 89, 0.24)' : 'rgba(122, 92, 42, 0.28)';
  const goldFaint = isDark ? 'rgba(197, 160, 89, 0.12)' : 'rgba(122, 92, 42, 0.14)';
  const textFill = isDark ? '#DFC286' : '#5E4419';

  // 2. Concentric Geodetic Rings
  const ringRadii = [0.18, 0.34, 0.52, 0.72, 0.855, 0.905, 0.968];
  ringRadii.forEach((ratio, idx) => {
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * ratio, 0, Math.PI * 2);
    ctx.strokeStyle =
      idx === 4 || idx === 6 ? goldPrimary : idx % 2 === 0 ? goldSecondary : goldFaint;
    ctx.lineWidth = idx === 6 ? 3.5 : idx === 4 ? 2.2 : 1.5;
    if (idx === 1 || idx === 3) {
      ctx.setLineDash([8, 12]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // 3. Cardinal & Intercardinal Geodetic Crosshairs
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const isCardinal = i % 2 === 0;
    const rStart = maxR * (isCardinal ? 0.18 : 0.34);
    const rEnd = maxR * (isCardinal ? 0.855 : 0.855);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * rStart, cy + Math.sin(angle) * rStart);
    ctx.lineTo(cx + Math.cos(angle) * rEnd, cy + Math.sin(angle) * rEnd);
    ctx.strokeStyle = isCardinal ? goldSecondary : goldFaint;
    ctx.lineWidth = isCardinal ? 2.0 : 1.2;
    ctx.stroke();
  }

  // 4. Precision 360° Geodetic Azimuth Ticks around Outer Band
  const tickOuter = maxR * 0.905;
  for (let deg = 0; deg < 360; deg += 5) {
    const rad = ((deg - 90) * Math.PI) / 180;
    const isMajor = deg % 30 === 0;
    const isMid = deg % 10 === 0;
    const tickLen = isMajor ? 28 : isMid ? 16 : 9;
    const tickInner = tickOuter - tickLen;

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * tickInner, cy + Math.sin(rad) * tickInner);
    ctx.lineTo(cx + Math.cos(rad) * tickOuter, cy + Math.sin(rad) * tickOuter);
    ctx.strokeStyle = isMajor ? goldPrimary : goldSecondary;
    ctx.lineWidth = isMajor ? 3.0 : isMid ? 1.8 : 1.0;
    ctx.stroke();

    // Fine degree numerals every 30° except cardinal positions
    if (isMajor && deg % 90 !== 0) {
      ctx.save();
      const labelR = maxR * 0.935;
      ctx.translate(cx + Math.cos(rad) * labelR, cy + Math.sin(rad) * labelR);
      ctx.rotate(rad + Math.PI / 2);
      ctx.font = '500 24px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = goldPrimary;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${deg}°`, 0, 0);
      ctx.restore();
    }
  }

  // 5. Compass Rose Cardinal Letters (B - Đ - N - T)
  // Standard Three.js CircleGeometry rotated -PI/2 around X puts canvas top (y=0) at -Z (North = B),
  // canvas right (x=size) at +X (East = Đ), canvas bottom at +Z (South = N), canvas left at -X (West = T).
  const cardinals: Array<{ label: string; sub: string; deg: number }> = [
    { label: 'B', sub: '0°', deg: 0 },
    { label: 'Đ', sub: '90°', deg: 90 },
    { label: 'N', sub: '180°', deg: 180 },
    { label: 'T', sub: '270°', deg: 270 },
  ];

  cardinals.forEach(({ label, deg }) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    const badgeR = maxR * 0.935;
    const bx = cx + Math.cos(rad) * badgeR;
    const by = cy + Math.sin(rad) * badgeR;

    // Small diamond pointer right inside the compass ring
    const dR = maxR * 0.878;
    const dx = cx + Math.cos(rad) * dR;
    const dy = cy + Math.sin(rad) * dR;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(rad + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fillStyle = deg === 0 ? '#D95B38' : textFill;
    ctx.fill();
    ctx.restore();

    // Cardinal Letter
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(rad + Math.PI / 2);
    ctx.font = '600 44px "Lora", Georgia, serif';
    ctx.fillStyle = deg === 0 ? (isDark ? '#F5EFE6' : '#8C2D19') : textFill;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });

  return canvas;
}

/**
 * Generates and caches both Dark (Studio/Night) and Light (Day/Sunset)
 * Geodetic & Compass Diorama Plinth textures once per session.
 */
export function getDioramaCompassTextures(maxAnisotropy: number): CachedCompassTextures {
  if (cachedCompassTextures) return cachedCompassTextures;

  const darkTex = new THREE.CanvasTexture(drawCompassRoseCanvas('dark'));
  darkTex.colorSpace = THREE.SRGBColorSpace;
  darkTex.anisotropy = Math.min(16, Math.max(1, maxAnisotropy));
  darkTex.userData.isCached = true;
  darkTex.needsUpdate = true;

  const lightTex = new THREE.CanvasTexture(drawCompassRoseCanvas('light'));
  lightTex.colorSpace = THREE.SRGBColorSpace;
  lightTex.anisotropy = Math.min(16, Math.max(1, maxAnisotropy));
  lightTex.userData.isCached = true;
  lightTex.needsUpdate = true;

  cachedCompassTextures = { dark: darkTex, light: lightTex };
  return cachedCompassTextures;
}

export interface SkyDomeUniforms {
  [uniform: string]: THREE.IUniform<unknown>;
  uTopColor: THREE.IUniform<THREE.Color>;
  uMidColor: THREE.IUniform<THREE.Color>;
  uHorizonColor: THREE.IUniform<THREE.Color>;
  uGlowColor: THREE.IUniform<THREE.Color>;
  uGlowIntensity: THREE.IUniform<number>;
  uGlowDir: THREE.IUniform<THREE.Vector3>;
}

export function createMuseumSkyDome(): {
  mesh: THREE.Mesh;
  uniforms: SkyDomeUniforms;
} {
  const uniforms: SkyDomeUniforms = {
    uTopColor: { value: new THREE.Color(0x08080a) },
    uMidColor: { value: new THREE.Color(0x101012) },
    uHorizonColor: { value: new THREE.Color(0x181715) },
    uGlowColor: { value: new THREE.Color(0xc5a059) },
    uGlowIntensity: { value: 0.22 },
    uGlowDir: { value: new THREE.Vector3(-0.32, 0.16, -0.93).normalize() },
  };

  const geo = new THREE.SphereGeometry(180, 32, 32);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uGlowColor;
      uniform float uGlowIntensity;
      uniform vec3 uGlowDir;
      varying vec3 vWorldDir;

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, -0.15, 1.0);

        // Smooth vertical sky gradient merging invisibly with FogExp2 at horizon (h == 0)
        float lowerMix = smoothstep(-0.02, 0.30, h);
        float upperMix = smoothstep(0.24, 0.92, h);

        vec3 sky = mix(uHorizonColor, uMidColor, lowerMix);
        sky = mix(sky, uTopColor, upperMix);

        // Subtle architectural backdrop aura / solar glow behind the monument
        float align = max(0.0, dot(dir, normalize(uGlowDir)));
        float softHalo = pow(align, 4.5);
        float horizonBoost = 1.0 - smoothstep(0.0, 0.65, abs(h));
        sky += uGlowColor * softHalo * uGlowIntensity * (0.45 + 0.55 * horizonBoost);

        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.userData.isGround = true;

  return { mesh, uniforms };
}

/**
 * Creates 120 ultra-fine champagne-gold floating dust motes for Studio mode.
 */
export function createStudioBronzeDust(count = 120): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Golden-angle spiral distribution for even, organic spacing around the monument
    const t = i / count;
    const angle = i * 2.3999632;
    const radius = 10 + Math.sqrt(t) * 32;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = 1.5 + ((i * 7.13) % 21.5);
    positions[i * 3 + 2] = Math.sin(angle) * radius;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xc5a059,
    map: getSoftGlowParticleTexture(),
    size: 0.42,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
  });

  const points = new THREE.Points(geo, mat);
  points.userData.isGround = true;
  return points;
}

/**
 * Creates subtle pinpoint stars in the upper night sky dome for Night mode.
 */
export function createNightStarfield(count = 240): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const coolStar = new THREE.Color(0xdde9ff);
  const warmStar = new THREE.Color(0xffe7bd);

  for (let i = 0; i < count; i++) {
    // Deterministic upper-hemisphere Fibonacci lattice with jitter
    const u = (i + 0.5) / count;
    const y = 0.14 + u * 0.84; // Keep stars comfortably above horizon
    const rHoriz = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * 2.3999632 + ((i % 7) - 3) * 0.12;
    const radius = 154 + (i % 15);

    positions[i * 3] = Math.cos(phi) * rHoriz * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = Math.sin(phi) * rHoriz * radius;

    const c = i % 5 === 0 ? warmStar : coolStar;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    map: getSoftGlowParticleTexture(),
    size: 1.05,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  const stars = new THREE.Points(geo, mat);
  stars.visible = false;
  stars.userData.isGround = true;
  return stars;
}

export interface DioramaPlinthRefs {
  group: THREE.Group;
  lowerMat: THREE.MeshStandardMaterial;
  upperMat: THREE.MeshStandardMaterial;
  deckMat: THREE.MeshStandardMaterial;
  surfaceMat: THREE.MeshStandardMaterial;
  bronzeTrimMat: THREE.MeshStandardMaterial;
  compassTextures: CachedCompassTextures;
}

/**
 * Builds the Multi-Tier Architectural Diorama Plinth with brushed champagne bronze rim
 * and 2048px Geodetic & Compass Rose ("B - Đ - N - T") surface texture.
 */
export function createArchitecturalDioramaPlinth(
  stageBaseY: number,
  maxAnisotropy: number,
  hasBunkerCutaway = false
): DioramaPlinthRefs {
  const group = new THREE.Group();
  group.position.y = stageBaseY;

  const compassTextures = getDioramaCompassTextures(maxAnisotropy);

  // Matte Champagne Bronze Bevel Material (#C5A059, metalness: 0.7, roughness: 0.3)
  const bronzeTrimMat = new THREE.MeshStandardMaterial({
    color: 0xc5a059,
    metalness: 0.7,
    roughness: 0.3,
  });

  // 1. Lower Expansive Plinth Skirt (blends seamlessly into horizon fog)
  const lowerMat = new THREE.MeshStandardMaterial({
    color: 0x151416,
    roughness: 0.92,
    metalness: 0.08,
  });

  // 2. Stepped Architectural Gallery Pedestal
  const upperMat = new THREE.MeshStandardMaterial({
    color: 0x1e1d20,
    roughness: 0.86,
    metalness: 0.12,
  });

  // 3. Main Exhibition Podium Deck
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x242226,
    roughness: 0.82,
    metalness: 0.14,
  });

  // 4. Planar Geodetic & Compass Rose Exhibition Surface (B - Đ - N - T)
  const surfaceMat = new THREE.MeshStandardMaterial({
    map: compassTextures.dark,
    roughness: 0.84,
    metalness: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  if (hasBunkerCutaway) {
    // Subterranean Bunker Cutaway Pit (World X: -6.4..+6.4, World Z: -11.6..-5.4 -> Shape Y: +5.4..+11.6)
    const addPitHole = (shape: THREE.Shape) => {
      const hole = new THREE.Path();
      hole.moveTo(-6.4, 5.4);
      hole.lineTo(6.4, 5.4);
      hole.lineTo(6.4, 11.6);
      hole.lineTo(-6.4, 11.6);
      hole.closePath();
      shape.holes.push(hole);
    };

    // Lower Skirt as extruded pierced ring (depth 2.2m, y = -2.42..-0.22)
    const lowerShape = new THREE.Shape();
    lowerShape.absarc(0, 0, 52.0, 0, Math.PI * 2, false);
    addPitHole(lowerShape);
    const lowerGeo = new THREE.ExtrudeGeometry(lowerShape, {
      depth: 2.2,
      bevelEnabled: false,
      curveSegments: 72,
    });
    lowerGeo.rotateX(-Math.PI / 2);
    const lowerSkirt = new THREE.Mesh(lowerGeo, lowerMat);
    lowerSkirt.position.y = -2.42;
    lowerSkirt.receiveShadow = true;
    lowerSkirt.userData.isGround = true;
    group.add(lowerSkirt);

    // Middle Terrace as extruded pierced ring (depth 0.44m, y = -0.50..-0.06)
    const upperShape = new THREE.Shape();
    upperShape.absarc(0, 0, 43.6, 0, Math.PI * 2, false);
    addPitHole(upperShape);
    const upperGeo = new THREE.ExtrudeGeometry(upperShape, {
      depth: 0.44,
      bevelEnabled: false,
      curveSegments: 72,
    });
    upperGeo.rotateX(-Math.PI / 2);
    const middleTerrace = new THREE.Mesh(upperGeo, upperMat);
    middleTerrace.position.y = -0.50;
    middleTerrace.receiveShadow = true;
    middleTerrace.userData.isGround = true;
    group.add(middleTerrace);

    // Main Deck as extruded pierced ring (depth 0.16m, y = -0.155..0.005)
    const deckShape = new THREE.Shape();
    deckShape.absarc(0, 0, 37.6, 0, Math.PI * 2, false);
    addPitHole(deckShape);
    const deckGeo = new THREE.ExtrudeGeometry(deckShape, {
      depth: 0.16,
      bevelEnabled: false,
      curveSegments: 72,
    });
    deckGeo.rotateX(-Math.PI / 2);
    const mainDeck = new THREE.Mesh(deckGeo, deckMat);
    mainDeck.position.y = -0.155;
    mainDeck.receiveShadow = true;
    mainDeck.userData.isGround = true;
    group.add(mainDeck);

    // Pierced Compass Surface Disc with exact matching 2048px compass UVs
    const discR = 36.82;
    const discShape = new THREE.Shape();
    discShape.absarc(0, 0, discR, 0, Math.PI * 2, false);
    addPitHole(discShape);
    const discGeo = new THREE.ShapeGeometry(discShape, 96);
    const posAttr = discGeo.attributes.position;
    const uvArr = new Float32Array(posAttr.count * 2);
    for (let i = 0; i < posAttr.count; i++) {
      const sx = posAttr.getX(i);
      const sy = posAttr.getY(i);
      uvArr[i * 2] = sx / (discR * 2) + 0.5;
      uvArr[i * 2 + 1] = sy / (discR * 2) + 0.5;
    }
    discGeo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    discGeo.rotateX(-Math.PI / 2);
    const compassDisc = new THREE.Mesh(discGeo, surfaceMat);
    compassDisc.position.y = 0.005;
    compassDisc.receiveShadow = true;
    compassDisc.userData.isGround = true;
    group.add(compassDisc);
  } else {
    const lowerSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(47.5, 56.5, 2.2, 72),
      lowerMat
    );
    lowerSkirt.position.y = -1.32;
    lowerSkirt.receiveShadow = true;
    lowerSkirt.userData.isGround = true;
    group.add(lowerSkirt);

    const middleTerrace = new THREE.Mesh(
      new THREE.CylinderGeometry(41.8, 45.6, 0.44, 72),
      upperMat
    );
    middleTerrace.position.y = -0.28;
    middleTerrace.receiveShadow = true;
    middleTerrace.userData.isGround = true;
    group.add(middleTerrace);

    const mainDeck = new THREE.Mesh(
      new THREE.CylinderGeometry(36.9, 38.6, 0.16, 72),
      deckMat
    );
    mainDeck.position.y = -0.075;
    mainDeck.receiveShadow = true;
    mainDeck.userData.isGround = true;
    group.add(mainDeck);

    const compassDisc = new THREE.Mesh(new THREE.CircleGeometry(36.82, 96), surfaceMat);
    compassDisc.rotation.x = -Math.PI / 2;
    compassDisc.position.y = 0.005;
    compassDisc.receiveShadow = true;
    compassDisc.userData.isGround = true;
    group.add(compassDisc);
  }

  // Subtle Lower Bronze Step Collar
  const lowerBronzeCollar = new THREE.Mesh(
    new THREE.TorusGeometry(41.85, 0.11, 10, 96),
    bronzeTrimMat
  );
  lowerBronzeCollar.rotation.x = Math.PI / 2;
  lowerBronzeCollar.position.y = -0.07;
  lowerBronzeCollar.userData.isGround = true;
  group.add(lowerBronzeCollar);

  // Beveled Champagne Bronze Outer Frame Rim (#C5A059)
  const topBronzeRim = new THREE.Mesh(
    new THREE.TorusGeometry(36.92, 0.19, 14, 96),
    bronzeTrimMat
  );
  topBronzeRim.rotation.x = Math.PI / 2;
  topBronzeRim.position.y = -0.002;
  topBronzeRim.receiveShadow = true;
  topBronzeRim.userData.isGround = true;
  group.add(topBronzeRim);

  return {
    group,
    lowerMat,
    upperMat,
    deckMat,
    surfaceMat,
    bronzeTrimMat,
    compassTextures,
  };
}

export interface MuseumEnvironmentRefs {
  skyUniforms: SkyDomeUniforms;
  studioDust: THREE.Points;
  nightStars: THREE.Points;
  plinth: DioramaPlinthRefs;
  dirLight: THREE.DirectionalLight;
  backDirLight: THREE.DirectionalLight;
  studioRimLight: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  hemiLight: THREE.HemisphereLight;
  nightSpots: THREE.SpotLight[];
}

/**
 * Updates Sky Dome shader uniforms, FogExp2, Lights, Particle visibility, and Plinth Compass Texture
 * in place — zero allocations, zero shader rebuilds -> 60FPS lock across all 17 models.
 */
export function applyMuseumEnvironmentPreset(
  mode: MuseumLightingMode,
  scene: THREE.Scene,
  refs: MuseumEnvironmentRefs
): void {
  const {
    skyUniforms,
    studioDust,
    nightStars,
    plinth,
    dirLight,
    backDirLight,
    studioRimLight,
    ambient,
    hemiLight,
    nightSpots,
  } = refs;

  scene.background = null;

  const ensureFog = (hex: number, density: number) => {
    if (scene.fog && scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.setHex(hex);
      scene.fog.density = density;
    } else {
      scene.fog = new THREE.FogExp2(hex, density);
    }
  };

  if (mode === 'studio') {
    // 1) STUDIO — Chuẩn Bảo tàng Apple Dark Pro
    skyUniforms.uTopColor.value.setHex(0x08080a);
    skyUniforms.uMidColor.value.setHex(0x101012);
    skyUniforms.uHorizonColor.value.setHex(0x181715);
    skyUniforms.uGlowColor.value.setHex(0xc5a059);
    skyUniforms.uGlowIntensity.value = 0.24;
    skyUniforms.uGlowDir.value.set(-0.28, 0.16, -0.94).normalize();

    ensureFog(0x181715, 0.0024);

    // 45° Warm White Key + Champagne Rim Light
    ambient.color.setHex(0xf5ead8);
    ambient.intensity = 0.62;
    hemiLight.color.setHex(0xd8c7a8);
    hemiLight.groundColor.setHex(0x1c1a17);
    hemiLight.intensity = 0.78;
    dirLight.color.setHex(0xfff6ea);
    dirLight.intensity = 1.55;
    dirLight.position.set(32, 38, 32);
    backDirLight.color.setHex(0xe5c787);
    backDirLight.intensity = 1.15;
    backDirLight.position.set(-26, 26, -38);
    studioRimLight.color.setHex(0xd8e2ef);
    studioRimLight.intensity = 0.45;
    nightSpots.forEach((s) => (s.intensity = 0));

    studioDust.visible = true;
    nightStars.visible = false;

    // Dark Museum Stone Plinth + Gold Compass Texture
    plinth.lowerMat.color.setHex(0x151416);
    plinth.upperMat.color.setHex(0x1e1d20);
    plinth.deckMat.color.setHex(0x252327);
    if (plinth.surfaceMat.map !== plinth.compassTextures.dark) {
      plinth.surfaceMat.map = plinth.compassTextures.dark;
      plinth.surfaceMat.needsUpdate = true;
    }
  } else if (mode === 'day') {
    // 2) NGÀY — Nắng Kiến Trúc Đông Nam Bộ
    skyUniforms.uTopColor.value.setHex(0x3b6e9c);
    skyUniforms.uMidColor.value.setHex(0x8faec4);
    skyUniforms.uHorizonColor.value.setHex(0xdfd7c8);
    skyUniforms.uGlowColor.value.setHex(0xfff4dc);
    skyUniforms.uGlowIntensity.value = 0.18;
    skyUniforms.uGlowDir.value.set(0.45, 0.35, 0.78).normalize();

    ensureFog(0xd8d0c1, 0.0020);

    ambient.color.setHex(0xfff8eb);
    ambient.intensity = 0.65;
    hemiLight.color.setHex(0x9cc7ea);
    hemiLight.groundColor.setHex(0x9a8368);
    hemiLight.intensity = 0.95;
    dirLight.color.setHex(0xfff8eb);
    dirLight.intensity = 1.8;
    dirLight.position.set(34, 46, 30);
    backDirLight.color.setHex(0xe6eef8);
    backDirLight.intensity = 0.65;
    backDirLight.position.set(-28, 28, -36);
    studioRimLight.color.setHex(0xc8dcf5);
    studioRimLight.intensity = 0.28;
    nightSpots.forEach((s) => (s.intensity = 0));

    studioDust.visible = false;
    nightStars.visible = false;

    // Warm Limestone Plinth + Light Compass Texture
    plinth.lowerMat.color.setHex(0xb8af9f);
    plinth.upperMat.color.setHex(0xc8bfaf);
    plinth.deckMat.color.setHex(0xd4cbbd);
    if (plinth.surfaceMat.map !== plinth.compassTextures.light) {
      plinth.surfaceMat.map = plinth.compassTextures.light;
      plinth.surfaceMat.needsUpdate = true;
    }
  } else if (mode === 'golden') {
    // 3) HOÀNG HÔN — Giờ Vàng Phương Nam
    skyUniforms.uTopColor.value.setHex(0x1a1829);
    skyUniforms.uMidColor.value.setHex(0x8c4932);
    skyUniforms.uHorizonColor.value.setHex(0xe2a458);
    skyUniforms.uGlowColor.value.setHex(0xffbe6b);
    skyUniforms.uGlowIntensity.value = 0.38;
    skyUniforms.uGlowDir.value.set(0.68, 0.14, 0.72).normalize();

    ensureFog(0xd59652, 0.0026);

    // Low-angle side sunlight creating long dramatic shadows across facades
    ambient.color.setHex(0xf7a96b);
    ambient.intensity = 0.50;
    hemiLight.color.setHex(0xe08b67);
    hemiLight.groundColor.setHex(0x3b241a);
    hemiLight.intensity = 0.74;
    dirLight.color.setHex(0xffb86c);
    dirLight.intensity = 1.98;
    dirLight.position.set(48, 12, 24);
    backDirLight.color.setHex(0xd88a78);
    backDirLight.intensity = 0.85;
    backDirLight.position.set(-32, 18, -40);
    studioRimLight.color.setHex(0xffc985);
    studioRimLight.intensity = 0.42;
    nightSpots.forEach((s) => (s.intensity = 0));

    studioDust.visible = false;
    nightStars.visible = false;

    // Warm Sunset Stone Plinth + Light Compass Texture
    plinth.lowerMat.color.setHex(0x7c6a58);
    plinth.upperMat.color.setHex(0x98836e);
    plinth.deckMat.color.setHex(0xb49d85);
    if (plinth.surfaceMat.map !== plinth.compassTextures.light) {
      plinth.surfaceMat.map = plinth.compassTextures.light;
      plinth.surfaceMat.needsUpdate = true;
    }
  } else {
    // 4) ĐÊM — Đêm Di Sản Huyền Ảo
    skyUniforms.uTopColor.value.setHex(0x040711);
    skyUniforms.uMidColor.value.setHex(0x080e1c);
    skyUniforms.uHorizonColor.value.setHex(0x0d1526);
    skyUniforms.uGlowColor.value.setHex(0x2a416e);
    skyUniforms.uGlowIntensity.value = 0.12;
    skyUniforms.uGlowDir.value.set(-0.35, 0.25, -0.9).normalize();

    ensureFog(0x0d1526, 0.0032);

    ambient.color.setHex(0x1d2b4a);
    ambient.intensity = 0.28;
    hemiLight.color.setHex(0x233863);
    hemiLight.groundColor.setHex(0x0a0f1a);
    hemiLight.intensity = 0.36;
    dirLight.color.setHex(0x8aa9d6);
    dirLight.intensity = 0.42;
    dirLight.position.set(-24, 38, 28);
    backDirLight.color.setHex(0x6e8ec2);
    backDirLight.intensity = 0.35;
    backDirLight.position.set(24, 24, -36);
    studioRimLight.color.setHex(0x8fb4eb);
    studioRimLight.intensity = 0.32;
    // Warm Architectural Uplights (#FFCF75) shining up from the monument base
    nightSpots.forEach((s) => (s.intensity = 5.5));

    studioDust.visible = false;
    nightStars.visible = true;

    // Deep Midnight Obsidian Plinth + Dark Compass Texture
    plinth.lowerMat.color.setHex(0x0d121d);
    plinth.upperMat.color.setHex(0x141b2b);
    plinth.deckMat.color.setHex(0x192133);
    if (plinth.surfaceMat.map !== plinth.compassTextures.dark) {
      plinth.surfaceMat.map = plinth.compassTextures.dark;
      plinth.surfaceMat.needsUpdate = true;
    }
  }
}
