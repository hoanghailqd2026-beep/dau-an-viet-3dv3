import { useState, useEffect, useCallback } from 'react';

export const GLB_MODELS_UPDATED_EVENT = 'dau-an-viet-glb-models-updated';

const GLB_IDB_NAME = 'dau_an_viet_glb_db';
const GLB_IDB_VERSION = 1;
const GLB_IDB_STORE = 'glb_models';

const CUSTOM_GLB_URLS_KEY = 'dau_an_viet_custom_glb_urls_v1';
const CUSTOM_GLB_PREFERRED_MODE_KEY = 'dau_an_viet_custom_glb_mode_v1';

export type GlbSourceKind = 'session_temp' | 'indexeddb' | 'remote_url' | 'procedural';

export interface StoredGlbRecord {
  siteId: string;
  blob: Blob;
  fileName: string;
  fileSize: number;
  updatedAt: string;
}

export interface StoredGlbMetadata {
  siteId: string;
  fileName: string;
  fileSize: number;
  updatedAt: string;
}

export interface ResolvedGlbSource {
  siteId: string;
  kind: GlbSourceKind;
  url: string | null;
  fileName: string | null;
  fileSize: number | null;
  updatedAt: string | null;
  remoteUrl: string;
  hasIndexedDbFile: boolean;
  indexedDbMeta: StoredGlbMetadata | null;
  hasSessionTempFile?: boolean;
}

export interface SiteGlbBadgeInfo {
  siteId: string;
  kind: 'session_temp' | 'indexeddb' | 'remote_url';
  label: string;
  fileSize?: number;
  updatedAt?: string;
}

// Session-level ObjectURL cache to avoid leaking Blob URLs across re-renders
const sessionObjectUrlCache = new Map<string, { updatedAt: string; objectUrl: string }>();

// Browser-RAM-only temporary `.glb` models uploaded by Tester Pro (NEVER persisted to IndexedDB/localStorage)
const sessionTempGlbMap = new Map<
  string,
  { url: string; fileName: string; fileSize: number; updatedAt: string }
>();

export function setSessionTempGlb(siteId: string, file: File): StoredGlbMetadata {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.glb') && !lowerName.endsWith('.gltf')) {
    throw new Error('Vui lòng chọn tệp mô hình 3D định dạng .glb hoặc .gltf');
  }
  const prev = sessionTempGlbMap.get(siteId);
  if (prev?.url) {
    try {
      URL.revokeObjectURL(prev.url);
    } catch {
      // ignore
    }
  }
  const updatedAt = new Date().toISOString();
  const url = URL.createObjectURL(file);
  sessionTempGlbMap.set(siteId, {
    url,
    fileName: file.name,
    fileSize: file.size,
    updatedAt,
  });
  emitGlbUpdated(siteId);
  return {
    siteId,
    fileName: file.name,
    fileSize: file.size,
    updatedAt,
  };
}

export function clearSessionTempGlb(siteId: string): void {
  const prev = sessionTempGlbMap.get(siteId);
  if (prev?.url) {
    try {
      URL.revokeObjectURL(prev.url);
    } catch {
      // ignore
    }
  }
  sessionTempGlbMap.delete(siteId);
  emitGlbUpdated(siteId);
}

export function hasSessionTempGlb(siteId: string): boolean {
  return sessionTempGlbMap.has(siteId);
}

function emitGlbUpdated(siteId?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GLB_MODELS_UPDATED_EVENT, { detail: { siteId } }));
}

export function formatGlbFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Normalize common GitHub / jsDelivr / Google Drive / Cloud `.glb` URLs so GLTFLoader can fetch raw binary directly.
 */
export function normalizeExternalGlbUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  // Convert standard GitHub blob URL -> raw.githubusercontent.com
  // e.g. https://github.com/user/repo/blob/main/models/bachdinh.glb -> https://raw.githubusercontent.com/user/repo/main/models/bachdinh.glb
  const githubBlobMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^?#]+)([?#].*)?$/i
  );
  if (githubBlobMatch) {
    const [, owner, repo, restPath] = githubBlobMatch;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${restPath}`;
  }

  // Convert GitHub raw route with /raw/ -> raw.githubusercontent.com
  const githubRawMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/raw\/([^?#]+)([?#].*)?$/i
  );
  if (githubRawMatch) {
    const [, owner, repo, restPath] = githubRawMatch;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${restPath}`;
  }

  return trimmed;
}

function readJsonRecord<T extends Record<string, string>>(key: string): T {
  if (typeof window === 'undefined') return {} as T;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {} as T;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as T;
  } catch {
    // ignore storage errors
  }
  return {} as T;
}

function writeJsonRecord(key: string, data: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

export function listCustomGlbUrls(): Record<string, string> {
  return readJsonRecord(CUSTOM_GLB_URLS_KEY);
}

export function getCustomGlbUrl(siteId: string): string {
  const map = listCustomGlbUrls();
  return map[siteId] || '';
}

function getPreferredModes(): Record<string, 'indexeddb' | 'remote_url'> {
  return readJsonRecord(CUSTOM_GLB_PREFERRED_MODE_KEY) as Record<
    string,
    'indexeddb' | 'remote_url'
  >;
}

function setPreferredMode(siteId: string, mode: 'indexeddb' | 'remote_url' | null): void {
  const modes = { ...getPreferredModes() };
  if (mode) {
    modes[siteId] = mode;
  } else {
    delete modes[siteId];
  }
  writeJsonRecord(CUSTOM_GLB_PREFERRED_MODE_KEY, modes);
}

export function saveCustomGlbUrl(siteId: string, rawUrl: string): string {
  const normalized = normalizeExternalGlbUrl(rawUrl);
  const current = { ...listCustomGlbUrls() };
  if (normalized) {
    current[siteId] = normalized;
    setPreferredMode(siteId, 'remote_url');
  } else {
    delete current[siteId];
    setPreferredMode(siteId, 'indexeddb');
  }
  writeJsonRecord(CUSTOM_GLB_URLS_KEY, current);
  emitGlbUpdated(siteId);
  return normalized;
}

export function removeCustomGlbUrl(siteId: string): void {
  const current = { ...listCustomGlbUrls() };
  delete current[siteId];
  writeJsonRecord(CUSTOM_GLB_URLS_KEY, current);
  setPreferredMode(siteId, 'indexeddb');
  emitGlbUpdated(siteId);
}

function openGlbDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser'));
      return;
    }
    const request = window.indexedDB.open(GLB_IDB_NAME, GLB_IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(GLB_IDB_STORE)) {
        db.createObjectStore(GLB_IDB_STORE, { keyPath: 'siteId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

function getCachedObjectUrl(siteId: string, blob: Blob, updatedAt: string): string {
  const existing = sessionObjectUrlCache.get(siteId);
  if (existing && existing.updatedAt === updatedAt) {
    return existing.objectUrl;
  }
  if (existing) {
    try {
      URL.revokeObjectURL(existing.objectUrl);
    } catch {
      // ignore
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  sessionObjectUrlCache.set(siteId, { updatedAt, objectUrl });
  return objectUrl;
}

function revokeCachedObjectUrl(siteId: string): void {
  const existing = sessionObjectUrlCache.get(siteId);
  if (existing) {
    try {
      URL.revokeObjectURL(existing.objectUrl);
    } catch {
      // ignore
    }
    sessionObjectUrlCache.delete(siteId);
  }
}

export async function saveGlbFileToIndexedDB(
  siteId: string,
  file: File
): Promise<StoredGlbMetadata> {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.glb') && !lowerName.endsWith('.gltf')) {
    throw new Error('Vui lòng chọn tệp mô hình 3D định dạng .glb hoặc .gltf');
  }

  const db = await openGlbDatabase();
  const updatedAt = new Date().toISOString();
  const record: StoredGlbRecord = {
    siteId,
    blob: file,
    fileName: file.name,
    fileSize: file.size,
    updatedAt,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(GLB_IDB_STORE, 'readwrite');
    tx.objectStore(GLB_IDB_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Không thể ghi tệp .glb vào IndexedDB'));
  });
  db.close();

  // Cache objectURL immediately for instant 0ms rendering
  getCachedObjectUrl(siteId, file, updatedAt);
  setPreferredMode(siteId, 'indexeddb');
  emitGlbUpdated(siteId);

  return {
    siteId,
    fileName: file.name,
    fileSize: file.size,
    updatedAt,
  };
}

export async function getGlbRecordFromIndexedDB(siteId: string): Promise<StoredGlbRecord | null> {
  try {
    const db = await openGlbDatabase();
    const record = await new Promise<StoredGlbRecord | null>((resolve, reject) => {
      const tx = db.transaction(GLB_IDB_STORE, 'readonly');
      const req = tx.objectStore(GLB_IDB_STORE).get(siteId);
      req.onsuccess = () => resolve((req.result as StoredGlbRecord | undefined) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return record;
  } catch {
    return null;
  }
}

export async function deleteGlbFromIndexedDB(siteId: string): Promise<void> {
  try {
    const db = await openGlbDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(GLB_IDB_STORE, 'readwrite');
      tx.objectStore(GLB_IDB_STORE).delete(siteId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
  revokeCachedObjectUrl(siteId);
  if (getCustomGlbUrl(siteId)) {
    setPreferredMode(siteId, 'remote_url');
  } else {
    setPreferredMode(siteId, null);
  }
  emitGlbUpdated(siteId);
}

export async function clearAllCustomGlbForSite(siteId: string): Promise<void> {
  const currentUrls = { ...listCustomGlbUrls() };
  delete currentUrls[siteId];
  writeJsonRecord(CUSTOM_GLB_URLS_KEY, currentUrls);
  setPreferredMode(siteId, null);
  await deleteGlbFromIndexedDB(siteId);
}

export async function listAllGlbMetadataFromIndexedDB(): Promise<Record<string, StoredGlbMetadata>> {
  const result: Record<string, StoredGlbMetadata> = {};
  try {
    const db = await openGlbDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(GLB_IDB_STORE, 'readonly');
      const req = tx.objectStore(GLB_IDB_STORE).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          const val = cursor.value as StoredGlbRecord;
          if (val && val.siteId) {
            result[val.siteId] = {
              siteId: val.siteId,
              fileName: val.fileName,
              fileSize: val.fileSize,
              updatedAt: val.updatedAt,
            };
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    // ignore
  }
  return result;
}

export async function resolveSiteGlbSource(siteId: string): Promise<ResolvedGlbSource> {
  const remoteUrl = getCustomGlbUrl(siteId);
  const preferred = getPreferredModes()[siteId];
  const idbRecord = await getGlbRecordFromIndexedDB(siteId);
  const sessionTemp = sessionTempGlbMap.get(siteId);

  const idbMeta: StoredGlbMetadata | null = idbRecord
    ? {
        siteId: idbRecord.siteId,
        fileName: idbRecord.fileName,
        fileSize: idbRecord.fileSize,
        updatedAt: idbRecord.updatedAt,
      }
    : null;

  if (sessionTemp && sessionTemp.url) {
    return {
      siteId,
      kind: 'session_temp',
      url: sessionTemp.url,
      fileName: sessionTemp.fileName,
      fileSize: sessionTemp.fileSize,
      updatedAt: sessionTemp.updatedAt,
      remoteUrl,
      hasIndexedDbFile: Boolean(idbRecord),
      indexedDbMeta: idbMeta,
      hasSessionTempFile: true,
    };
  }

  const extractRemoteFileName = (u: string): string => {
    try {
      const parsed = new URL(u);
      const last = parsed.pathname.split('/').filter(Boolean).pop();
      return last || 'cloud-model.glb';
    } catch {
      return u.split('/').pop() || 'cloud-model.glb';
    }
  };

  if (preferred === 'remote_url' && remoteUrl) {
    return {
      siteId,
      kind: 'remote_url',
      url: remoteUrl,
      fileName: extractRemoteFileName(remoteUrl),
      fileSize: null,
      updatedAt: remoteUrl,
      remoteUrl,
      hasIndexedDbFile: Boolean(idbRecord),
      indexedDbMeta: idbMeta,
    };
  }

  if (idbRecord && idbRecord.blob) {
    const objectUrl = getCachedObjectUrl(siteId, idbRecord.blob, idbRecord.updatedAt);
    return {
      siteId,
      kind: 'indexeddb',
      url: objectUrl,
      fileName: idbRecord.fileName,
      fileSize: idbRecord.fileSize,
      updatedAt: idbRecord.updatedAt,
      remoteUrl,
      hasIndexedDbFile: true,
      indexedDbMeta: idbMeta,
    };
  }

  if (remoteUrl) {
    return {
      siteId,
      kind: 'remote_url',
      url: remoteUrl,
      fileName: extractRemoteFileName(remoteUrl),
      fileSize: null,
      updatedAt: remoteUrl,
      remoteUrl,
      hasIndexedDbFile: false,
      indexedDbMeta: null,
    };
  }

  return {
    siteId,
    kind: 'procedural',
    url: null,
    fileName: null,
    fileSize: null,
    updatedAt: null,
    remoteUrl: '',
    hasIndexedDbFile: false,
    indexedDbMeta: null,
  };
}

export function switchSiteGlbSourceMode(
  siteId: string,
  mode: 'indexeddb' | 'remote_url'
): void {
  setPreferredMode(siteId, mode);
  emitGlbUpdated(siteId);
}

/**
 * React hook subscribing to the active `.glb` model source for a single heritage site.
 */
export function useSiteGlbSource(siteId: string | null | undefined) {
  const [source, setSource] = useState<ResolvedGlbSource>(() => ({
    siteId: siteId || '',
    kind: 'procedural',
    url: null,
    fileName: null,
    fileSize: null,
    updatedAt: null,
    remoteUrl: siteId ? getCustomGlbUrl(siteId) : '',
    hasIndexedDbFile: false,
    indexedDbMeta: null,
  }));
  const [loading, setLoading] = useState<boolean>(Boolean(siteId));

  const load = useCallback(async () => {
    if (!siteId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const resolved = await resolveSiteGlbSource(siteId);
    setSource(resolved);
    setLoading(false);
  }, [siteId]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!siteId) {
        if (active) setLoading(false);
        return;
      }
      if (active) setLoading(true);
      const resolved = await resolveSiteGlbSource(siteId);
      if (active) {
        setSource(resolved);
        setLoading(false);
      }
    };
    void run();

    const onUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ siteId?: string }>).detail;
      if (!detail?.siteId || detail.siteId === siteId) {
        void run();
      }
    };
    const onStorage = (ev: StorageEvent) => {
      if (
        ev.key === CUSTOM_GLB_URLS_KEY ||
        ev.key === CUSTOM_GLB_PREFERRED_MODE_KEY ||
        ev.key === null
      ) {
        void run();
      }
    };
    window.addEventListener(GLB_MODELS_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      active = false;
      window.removeEventListener(GLB_MODELS_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [siteId]);

  return { source, loading, refresh: load };
}

/**
 * React hook returning a lightweight map of all sites that currently have a custom `.glb`
 * (either in IndexedDB or via external GitHub/Cloud link), used for Map markers & Admin list badges.
 */
export function useAllCustomGlbMap(): Record<string, SiteGlbBadgeInfo> {
  const [badgeMap, setBadgeMap] = useState<Record<string, SiteGlbBadgeInfo>>({});

  useEffect(() => {
    let active = true;
    const compute = async () => {
      const idbMetaMap = await listAllGlbMetadataFromIndexedDB();
      const urlsMap = listCustomGlbUrls();
      const modes = getPreferredModes();
      const next: Record<string, SiteGlbBadgeInfo> = {};

      const allIds = new Set([
        ...Array.from(sessionTempGlbMap.keys()),
        ...Object.keys(idbMetaMap),
        ...Object.keys(urlsMap),
      ]);
      allIds.forEach((id) => {
        const temp = sessionTempGlbMap.get(id);
        const idb = idbMetaMap[id];
        const url = urlsMap[id];
        const pref = modes[id];
        if (temp) {
          next[id] = {
            siteId: id,
            kind: 'session_temp',
            label: temp.fileName,
            fileSize: temp.fileSize,
            updatedAt: temp.updatedAt,
          };
        } else if (pref === 'remote_url' && url) {
          next[id] = {
            siteId: id,
            kind: 'remote_url',
            label: url.split('/').pop() || 'Cloud .glb',
          };
        } else if (idb) {
          next[id] = {
            siteId: id,
            kind: 'indexeddb',
            label: idb.fileName,
            fileSize: idb.fileSize,
            updatedAt: idb.updatedAt,
          };
        } else if (url) {
          next[id] = {
            siteId: id,
            kind: 'remote_url',
            label: url.split('/').pop() || 'Cloud .glb',
          };
        }
      });

      if (active) setBadgeMap(next);
    };

    void compute();
    const onUpdated = () => void compute();
    const onStorage = (ev: StorageEvent) => {
      if (
        ev.key === CUSTOM_GLB_URLS_KEY ||
        ev.key === CUSTOM_GLB_PREFERRED_MODE_KEY ||
        ev.key === null
      ) {
        void compute();
      }
    };
    window.addEventListener(GLB_MODELS_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      active = false;
      window.removeEventListener(GLB_MODELS_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return badgeMap;
}
