import jsQR from 'jsqr';
import { HeritageSite } from '../types/heritage';
import { resolveHeritageVideoId } from '../data/heritageFilms';

export const HERITAGE_PLAQUE_BASE_URL = 'https://dauanviet3d.vn/plaque';

function stripDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildHeritagePlaqueQrPayload(site: HeritageSite): string {
  return `${HERITAGE_PLAQUE_BASE_URL}/${encodeURIComponent(site.identifierCode)}?site=${encodeURIComponent(site.id)}`;
}

export function decodeQrFromImageData(imageData: ImageData): string | null {
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });
  return result?.data ? result.data.trim() : null;
}

export async function decodeQrFromImageElement(
  img: HTMLImageElement | HTMLCanvasElement,
  maxDimension = 1024
): Promise<string | null> {
  const srcWidth = img instanceof HTMLCanvasElement ? img.width : img.naturalWidth || img.width;
  const srcHeight = img instanceof HTMLCanvasElement ? img.height : img.naturalHeight || img.height;
  if (!srcWidth || !srcHeight) return null;

  const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
  const targetWidth = Math.max(1, Math.round(srcWidth * scale));
  const targetHeight = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const decoded = decodeQrFromImageData(imageData);
  if (decoded) return decoded;

  // Fallback to native BarcodeDetector if available in Chromium/Edge
  const win = window as unknown as {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
    };
  };
  if (typeof win.BarcodeDetector === 'function') {
    try {
      const detector = new win.BarcodeDetector({ formats: ['qr_code'] });
      const results = await detector.detect(canvas);
      const raw = results.find((r) => Boolean(r.rawValue))?.rawValue;
      if (raw) return raw.trim();
    } catch {
      // ignore unsupported format error
    }
  }

  return null;
}

export async function decodeQrFromFile(file: File): Promise<string | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to decode image file'));
      el.src = objectUrl;
    });
    return await decodeQrFromImageElement(img);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function resolveHeritageSiteFromQrPayload(
  rawText: string,
  sites: HeritageSite[]
): HeritageSite | null {
  const trimmed = rawText.trim();
  if (!trimmed || sites.length === 0) return null;

  const matchCandidate = (candidateRaw: string | null | undefined): HeritageSite | null => {
    if (!candidateRaw) return null;
    const candidate = candidateRaw.trim();
    if (!candidate) return null;

    const upper = candidate.toUpperCase();
    const compactUpper = upper.replace(/\s+/g, '');

    // 1. Exact ID or official heritage identifierCode
    const direct = sites.find(
      (s) =>
        s.id.toUpperCase() === compactUpper ||
        s.identifierCode.toUpperCase() === compactUpper
    );
    if (direct) return direct;

    // 2. Numeric index (01..17 or 1..17)
    const numericMatch = compactUpper.match(/^#?(0?[1-9]|1[0-7])$/);
    if (numericMatch) {
      const padded = numericMatch[1].padStart(2, '0');
      const byIndex = sites.find((s) => resolveHeritageVideoId(s.id) === padded);
      if (byIndex) return byIndex;
    }

    return null;
  };

  // A. Direct match
  const directHit = matchCandidate(trimmed);
  if (directHit) return directHit;

  // B. JSON payload e.g. {"siteId":"HCM-DT-001"} or {"code":"HCM-Q1-LSKT-001"}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const keys = ['siteId', 'site', 'id', 'identifierCode', 'code', 'plaqueCode', 'heritageId'];
      for (const k of keys) {
        const val = parsed[k];
        if (typeof val === 'string' || typeof val === 'number') {
          const hit = matchCandidate(String(val));
          if (hit) return hit;
        }
      }
    } catch {
      // ignore invalid JSON
    }
  }

  // C. Prefixed plaque strings e.g. DAV:HCM-Q1-LSKT-001, HERITAGE:01
  const prefixMatch = trimmed.match(/^(?:DAV|DAU-AN-VIET|HERITAGE|DI-TICH|DITICH|PLAQUE|QR)[:/\s]+(.+)$/i);
  if (prefixMatch?.[1]) {
    const hit = resolveHeritageSiteFromQrPayload(prefixMatch[1], sites);
    if (hit) return hit;
  }

  // D. URL query params or path segments (e.g. https://dauanviet3d.vn/plaque/HCM-Q1-LSKT-001?site=HCM-DT-001)
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes('/') || trimmed.includes('?')) {
    try {
      const url = new URL(trimmed, HERITAGE_PLAQUE_BASE_URL);
      const paramKeys = ['site', 'siteId', 'id', 'code', 'identifier', 'plaque'];
      for (const p of paramKeys) {
        const hit = matchCandidate(url.searchParams.get(p));
        if (hit) return hit;
      }
      const segments = url.pathname.split('/').filter(Boolean);
      for (let i = segments.length - 1; i >= 0; i--) {
        const hit = matchCandidate(decodeURIComponent(segments[i]));
        if (hit) return hit;
      }
    } catch {
      // ignore malformed URL
    }
  }

  // E. Substring scan for any site.id or site.identifierCode inside a longer plaque text block
  const upperAll = trimmed.toUpperCase();
  for (const site of sites) {
    if (
      upperAll.includes(site.identifierCode.toUpperCase()) ||
      upperAll.includes(site.id.toUpperCase())
    ) {
      return site;
    }
  }

  // F. Diacritic-insensitive official/folk name fallback (min 4 chars)
  const norm = stripDiacritics(trimmed);
  if (norm.length >= 4) {
    const nameMatch = sites.find((s) => {
      const off = stripDiacritics(s.officialName);
      const folk = s.folkName ? stripDiacritics(s.folkName) : '';
      return (
        off === norm ||
        off.includes(norm) ||
        norm.includes(off) ||
        (folk.length >= 4 && (folk === norm || folk.includes(norm) || norm.includes(folk)))
      );
    });
    if (nameMatch) return nameMatch;
  }

  return null;
}
