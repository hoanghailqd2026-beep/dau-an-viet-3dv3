import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  HeritageSite,
  BaseMapMode,
  WGS84Coordinate,
  TourRoute,
} from '../../types/heritage';
import {
  formatWGS84,
  calculateDistanceKm,
} from '../../utils/coordinateConversion';
import {
  ZoomIn,
  ZoomOut,
  Compass,
  LocateFixed,
  X,
  Crosshair,
  Map as MapIcon,
  Satellite,
  History,
  Pin,
  MousePointer2,
  Maximize2,
  QrCode,
  Box,
  Upload,
  Link2,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { LayerControlMenu } from './LayerControlMenu';
import { HeritageQrScannerOverlay } from './HeritageQrScannerOverlay';
import { GlbMiniStage } from './GlbMiniStage';
import { useI18n } from '../../i18n/I18nContext';
import { Language } from '../../i18n/types';
import {
  getIndochineCategoryMeta,
  getTourRouteIndochineColor,
  getHeritageColorBlock,
} from '../../utils/indochinePalette';
import {
  getHistoricalArchiveForSite,
  getCustomHistoricalPhotoForSite,
} from '../spatial/MuseumHistoricalWidgets';
import { HeritageTypographicPlate } from '../common/HeritageTypographicPlate';
import { HeritageSmoothImage } from '../common/HeritageSmoothImage';
import { resolveHeritageVideoId, HeritageVideoKey } from '../../data/heritageFilms';
import { trackPlatformInteraction } from '../../utils/adminPlatformStore';
import { useAuth } from '../../contexts/AuthContext';
import {
  clearAllCustomGlbForSite,
  clearSessionTempGlb,
  formatGlbFileSize,
  saveCustomGlbUrl,
  saveGlbFileToIndexedDB,
  setSessionTempGlb,
  useAllCustomGlbMap,
  useSiteGlbSource,
} from '../../utils/glbModelStorage';

interface MapCanvasProps {
  sites: HeritageSite[];
  selectedSite: HeritageSite | null;
  focusTick?: number;
  onSelectSite: (site: HeritageSite | null) => void;
  activeTour: TourRoute | null;
  baseMapMode: BaseMapMode;
  onChangeBaseMapMode: (mode: BaseMapMode) => void;
  onOpenARAudio: (site: HeritageSite) => void;
  onTriggerAudioGuide?: (site: HeritageSite) => void;
  onOpen3D: (site: HeritageSite) => void;
  onOpenDetailModal?: (site: HeritageSite) => void;
  onOpenPhotoManager?: (site: HeritageSite) => void;
  onOpenVideo?: (site: HeritageSite) => void;
  onOpenPastPresentSplit?: (site: HeritageSite) => void;
  activeMapHeritageId?: HeritageVideoKey;
  className?: string;
  showInspectorDrawer?: boolean;
}

const HCMC_CENTER_WGS84: WGS84Coordinate = { lat: 10.7769, lng: 106.6983 }; // District 1 Saigon Center
const DEFAULT_ZOOM = 14;

// Tile image cache for fast smooth rendering
const tileImageCache = new Map<string, HTMLImageElement>();

export interface HeritageCategoryStyle {
  color: string;
  glowColor: string;
  iconText: string;
  categoryLabel: string;
  badgeBg: string;
}

export const getSiteCategoryStyle = (site: HeritageSite): HeritageCategoryStyle => {
  const meta = getIndochineCategoryMeta(site, 'vi');
  const block = getHeritageColorBlock(site, 'vi');
  return {
    color: block.bg,
    glowColor: 'rgba(201, 164, 106, 0.5)',
    iconText: site.rankingLevel === 'Special National' ? '★' : '●',
    categoryLabel: meta.badgeLabel,
    badgeBg: block.badgeBg,
  };
};

interface MarkerCluster {
  id: string;
  count: number;
  centerGeo: WGS84Coordinate;
  screenX: number;
  screenY: number;
  sites: HeritageSite[];
}

type HistoricalLensRegion =
  | 'saigon_core'
  | 'cholon_giadinh'
  | 'cuchi_binhduong'
  | 'vungtau_cangio';

interface RegionalLensMeta {
  region: HistoricalLensRegion;
  label: string;
  eraRange: string;
  layerMode: BaseMapMode;
}

function getRegionalLensMeta(siteId: string | undefined, lang: Language): RegionalLensMeta {
  const key = resolveHeritageVideoId(siteId);

  if (['08', '11', '12'].includes(key)) {
    return {
      region: 'cholon_giadinh',
      eraRange: '1882 – 1920',
      layerMode: 'historical_1898',
      label:
        lang === 'en'
          ? 'CHO LON – GO CAM SON URBAN LENS (1882 – 1920)'
          : lang === 'zh'
          ? '堤岸与古嘉定历史舆图透镜 (1882 – 1920)'
          : 'THẤU KÍNH ĐÔ THỊ CHỢ LỚN – GÒ CẨM SƠN (1882 – 1920)',
    };
  }

  if (['09', '16', '17'].includes(key)) {
    return {
      region: 'cuchi_binhduong',
      eraRange: '1948 – 1975',
      layerMode: 'historical_1966',
      label:
        lang === 'en'
          ? 'TUNNELS & EASTERN WAR ZONE LENS (1948 – 1975)'
          : lang === 'zh'
          ? '地道与东南部战区舆图透镜 (1948 – 1975)'
          : 'THẤU KÍNH ĐỊA ĐẠO & CHIẾN KHU MIỀN ĐÔNG (1948 – 1975)',
    };
  }

  if (['10', '13', '14', '15'].includes(key)) {
    return {
      region: 'vungtau_cangio',
      eraRange: '1895 – 1954',
      layerMode: 'historical_1898',
      label:
        lang === 'en'
          ? 'CAP SAINT-JACQUES & COASTAL LENS (1895 – 1954)'
          : lang === 'zh'
          ? '头顿与沿海历史舆图透镜 (1895 – 1954)'
          : 'THẤU KÍNH CAP SAINT-JACQUES & DUYÊN HẢI (1895 – 1954)',
    };
  }

  return {
    region: 'saigon_core',
    eraRange: '1815 – 1898',
    layerMode: 'historical_1815',
    label:
      lang === 'en'
        ? 'GIA DINH – BAGUA CITADEL LENS (1815 – 1898)'
        : lang === 'zh'
        ? '嘉定八卦城历史舆图透镜 (1815 – 1898)'
        : 'THẤU KÍNH GIA ĐỊNH – THÀNH BÁT QUÁI (1815 – 1898)',
  };
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  sites,
  selectedSite,
  focusTick = 0,
  onSelectSite,
  activeTour,
  baseMapMode,
  onChangeBaseMapMode,
  onOpenARAudio,
  onTriggerAudioGuide,
  onOpen3D,
  onOpenDetailModal,
  onOpenPhotoManager,
  onOpenVideo,
  onOpenPastPresentSplit,
  activeMapHeritageId,
  className,
  showInspectorDrawer = false,
}) => {
  const { lang, t, formatDistrictName, getLocalizedSite } = useI18n();
  const { isAdmin, isTesterPro } = useAuth();
  const isRamOnlyTester = isTesterPro && !isAdmin;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const lensBufferCanvasRef = useRef<HTMLCanvasElement>(null);
  const lensClipRef = useRef<HTMLDivElement>(null);
  const lensRingRef = useRef<HTMLDivElement>(null);
  const lensOuterRingRef = useRef<HTMLDivElement>(null);
  const lensCrosshairRef = useRef<HTMLDivElement>(null);
  const lensPillRef = useRef<HTMLDivElement>(null);
  const lensPillTextRef = useRef<HTMLSpanElement>(null);

  // Map viewport state
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [center, setCenter] = useState<WGS84Coordinate>(HCMC_CENTER_WGS84);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Popup InfoWindow state
  const [popupSite, setPopupSite] = useState<HeritageSite | null>(selectedSite);

  // Historical split comparison state & Regional Spyglass Lens state (zero-rerender DOM transform)
  const [isSplitCompare, setIsSplitCompare] = useState<boolean>(false);
  const [splitSliderX, setSplitSliderX] = useState<number>(50); // percentage 0 - 100
  const [historicalOpacity, setHistoricalOpacity] = useState<number>(0.85);
  const [isSpyglassLensMode, setIsSpyglassLensMode] = useState<boolean>(false);
  const [isLensLocked, setIsLensLocked] = useState<boolean>(false);
  const [lensRegionKey, setLensRegionKey] = useState<
    'saigon_core' | 'cholon_giadinh' | 'cuchi_binhduong' | 'vungtau_cangio'
  >('saigon_core');
  const [histCardImgFailed, setHistCardImgFailed] = useState<boolean>(false);
  const [popupImgFailed, setPopupImgFailed] = useState<boolean>(false);
  const [spyModernImgFailed, setSpyModernImgFailed] = useState<boolean>(false);

  useEffect(() => {
    setPopupImgFailed(false);
  }, [popupSite?.id, selectedSite?.id]);

  useEffect(() => {
    setSpyModernImgFailed(false);
    setHistCardImgFailed(false);
  }, [activeMapHeritageId, selectedSite?.id]);

  const lensCurrentPosRef = useRef<{ x: number; y: number } | null>(null);
  const lensTargetPosRef = useRef<{ x: number; y: number } | null>(null);
  const lensPinnedToSiteRef = useRef<boolean>(true);
  const lensLerpRafRef = useRef<number | null>(null);
  const lastPinClientPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastLensRegionRef = useRef<string>('saigon_core');
  const lastLensLabelRef = useRef<string>('');

  // Measurement tool state
  const [measureMode, setMeasureMode] = useState<boolean>(false);
  const [measurePointA, setMeasurePointA] = useState<WGS84Coordinate | null>(null);
  const [measurePointB, setMeasurePointB] = useState<WGS84Coordinate | null>(null);

  // Live mouse readout & hover
  const [cursorWgs84, setCursorWgs84] = useState<WGS84Coordinate>(HCMC_CENTER_WGS84);
  const [hoveredSite, setHoveredSite] = useState<HeritageSite | null>(null);
  const [hoveredCluster, setHoveredCluster] = useState<MarkerCluster | null>(null);
  const [showCoordinates, setShowCoordinates] = useState<boolean>(false);
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState<boolean>(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState<boolean>(false);

  // Persistent Browser IndexedDB + GitHub/Cloud .glb Model State
  const tooltipTargetSiteId = (popupSite || hoveredSite)?.id || null;
  const customGlbBadgeMap = useAllCustomGlbMap();
  const { source: activeGlbSource } = useSiteGlbSource(tooltipTargetSiteId);
  const [popupMediaTab, setPopupMediaTab] = useState<'glb' | 'photo'>('glb');
  const [showGlbLinkRow, setShowGlbLinkRow] = useState<boolean>(false);
  const [showOtherSiteGlbControls, setShowOtherSiteGlbControls] = useState<boolean>(false);
  const [glbLinkDraft, setGlbLinkDraft] = useState<string>('');
  const [glbStatusNotice, setGlbStatusNotice] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const glbFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setGlbLinkDraft(activeGlbSource.remoteUrl || '');
    setPopupMediaTab(activeGlbSource.url ? 'glb' : 'photo');
  }, [tooltipTargetSiteId, activeGlbSource.url, activeGlbSource.remoteUrl]);

  useEffect(() => {
    setShowGlbLinkRow(false);
    setShowOtherSiteGlbControls(false);
    setGlbStatusNotice(null);
  }, [tooltipTargetSiteId]);

  const showTemporaryGlbNotice = (type: 'ok' | 'err', text: string) => {
    setGlbStatusNotice({ type, text });
    window.setTimeout(() => {
      setGlbStatusNotice((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const handleMapGlbFileChange = async (
    siteId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (isRamOnlyTester) {
        const meta = setSessionTempGlb(siteId, file);
        setPopupMediaTab('glb');
        setTileRerenderTick((v) => v + 1);
        showTemporaryGlbNotice(
          'ok',
          `Đã nạp thử "${meta.fileName}" (${formatGlbFileSize(meta.fileSize)}) vào RAM phiên làm việc (không lưu vào dữ liệu gốc).`
        );
        return;
      }
      const meta = await saveGlbFileToIndexedDB(siteId, file);
      setPopupMediaTab('glb');
      setTileRerenderTick((v) => v + 1);
      showTemporaryGlbNotice(
        'ok',
        `Đã lưu "${meta.fileName}" (${formatGlbFileSize(meta.fileSize)}) vào IndexedDB.`
      );
    } catch (err) {
      showTemporaryGlbNotice(
        'err',
        err instanceof Error ? err.message : 'Không thể nạp file .glb.'
      );
    }
  };

  const handleSaveMapGlbUrl = (siteId: string) => {
    if (isRamOnlyTester) return;
    const raw = glbLinkDraft.trim();
    if (!raw) {
      showTemporaryGlbNotice('err', 'Vui lòng dán URL tệp .glb (GitHub/Cloud).');
      return;
    }
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      showTemporaryGlbNotice('err', 'Link .glb phải bắt đầu bằng https:// hoặc http://');
      return;
    }
    const normalized = saveCustomGlbUrl(siteId, raw);
    setGlbLinkDraft(normalized);
    setPopupMediaTab('glb');
    setShowGlbLinkRow(false);
    showTemporaryGlbNotice('ok', 'Đã lưu link .glb từ GitHub/Cloud & hiển thị lên bản đồ.');
  };

  const handleClearMapGlb = async (siteId: string) => {
    if (isRamOnlyTester || activeGlbSource.kind === 'session_temp') {
      clearSessionTempGlb(siteId);
      setPopupMediaTab(activeGlbSource.hasIndexedDbFile || activeGlbSource.remoteUrl ? 'glb' : 'photo');
      showTemporaryGlbNotice('ok', 'Đã gỡ tệp .glb thử nghiệm khỏi RAM.');
      return;
    }
    await clearAllCustomGlbForSite(siteId);
    setGlbLinkDraft('');
    setPopupMediaTab('photo');
    showTemporaryGlbNotice('ok', 'Đã xóa mô hình .glb tùy chỉnh, khôi phục mặc định.');
  };

  // Layer visibility toggles (Mặc định: showProtectionZones = false)
  const [showDistricts, setShowDistricts] = useState<boolean>(true);
  const [showWaterways, setShowWaterways] = useState<boolean>(true);
  const [showProtectionZones, setShowProtectionZones] = useState<boolean>(false);
  const [tileRerenderTick, setTileRerenderTick] = useState<number>(0);

  // Smooth camera animation loop state
  const animFrameRef = useRef<number | null>(null);

  const centerRef = useRef<WGS84Coordinate>(center);
  const zoomRef = useRef<number>(zoom);
  useEffect(() => {
    centerRef.current = center;
  }, [center]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Global mouse/pointer up listener to prevent dragging getting stuck
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setIsPanning(false);
    };
    window.addEventListener('mouseup', handleGlobalPointerUp);
    window.addEventListener('touchend', handleGlobalPointerUp);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalPointerUp);
      window.removeEventListener('touchend', handleGlobalPointerUp);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, []);

  // ESC key closes popup and deselects site (unless QR scanner overlay is open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isQrScannerOpen) {
        setPopupSite(null);
        onSelectSite(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectSite, isQrScannerOpen]);

  // Smooth camera transition (flyTo) respecting prefers-reduced-motion
  const flyTo = useCallback((targetCoord: WGS84Coordinate, targetZoom: number, durationMs = 800) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setCenter(targetCoord);
      setZoom(targetZoom);
      return;
    }

    const startCoord = { ...centerRef.current };
    const startZoom = zoomRef.current;
    const startTime = performance.now();

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const animateStep = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const ease = easeInOutCubic(progress);

      setCenter({
        lat: startCoord.lat + (targetCoord.lat - startCoord.lat) * ease,
        lng: startCoord.lng + (targetCoord.lng - startCoord.lng) * ease,
      });
      setZoom(startZoom + (targetZoom - startZoom) * ease);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animateStep);
      } else {
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(animateStep);
  }, []);

  // Sync selectedSite / focusTick prop to popupSite, smooth flyTo & Spyglass Lens anchor
  const prevSelectedSiteIdRef = useRef<string | null>(null);
  const prevFocusTickRef = useRef<number>(focusTick);
  useEffect(() => {
    if (selectedSite) {
      const siteChanged = prevSelectedSiteIdRef.current !== selectedSite.id;
      const tickChanged = prevFocusTickRef.current !== focusTick;
      if (siteChanged || tickChanged) {
        prevSelectedSiteIdRef.current = selectedSite.id;
        prevFocusTickRef.current = focusTick;
        setHistCardImgFailed(false);
        lensPinnedToSiteRef.current = true;
        const shiftedLat = isSpyglassLensMode
          ? selectedSite.gps.lat - 0.0012
          : selectedSite.gps.lat - 0.0028;
        flyTo({ lat: shiftedLat, lng: selectedSite.gps.lng }, Math.max(zoomRef.current, 15.2));
      }
      if (!showInspectorDrawer) {
        setPopupSite(selectedSite);
      } else {
        setPopupSite(null);
      }
    } else {
      prevSelectedSiteIdRef.current = null;
      setPopupSite(null);
    }
  }, [selectedSite, focusTick, flyTo, showInspectorDrawer, isSpyglassLensMode]);

  // Direct GPU-composited DOM transform for 60FPS Spyglass Lens (0 React re-renders, 0 tile redraws)
  const applySpyglassDomTransform = useCallback(
    (lensX: number, lensY: number) => {
      const parentEl = containerRef.current;
      const width = parentEl?.clientWidth || 1000;
      const height = parentEl?.clientHeight || 700;
      const lensRadius = Math.min(160, Math.max(115, Math.min(width, height) * 0.23));
      const diameter = lensRadius * 2;
      const left = lensX - lensRadius;
      const top = lensY - lensRadius;

      if (lensClipRef.current) {
        lensClipRef.current.style.width = `${diameter}px`;
        lensClipRef.current.style.height = `${diameter}px`;
        lensClipRef.current.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      }
      if (lensBufferCanvasRef.current) {
        lensBufferCanvasRef.current.style.transform = `translate3d(${-left}px, ${-top}px, 0)`;
      }
      if (lensRingRef.current) {
        lensRingRef.current.style.width = `${diameter}px`;
        lensRingRef.current.style.height = `${diameter}px`;
        lensRingRef.current.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      }
      if (lensOuterRingRef.current) {
        const outerDiam = diameter + 10;
        lensOuterRingRef.current.style.width = `${outerDiam}px`;
        lensOuterRingRef.current.style.height = `${outerDiam}px`;
        lensOuterRingRef.current.style.transform = `translate3d(${left - 5}px, ${top - 5}px, 0)`;
      }
      if (lensCrosshairRef.current) {
        lensCrosshairRef.current.style.transform = `translate3d(${lensX - 18}px, ${lensY - 18}px, 0)`;
      }

      // Resolve regional context without triggering React state updates unless crossing regions
      let regionalSite =
        (activeMapHeritageId
          ? sites.find((s) => resolveHeritageVideoId(s.id) === activeMapHeritageId)
          : null) ||
        selectedSite ||
        sites[0];

      if (!isLensLocked && !lensPinnedToSiteRef.current) {
        const numTiles = Math.pow(2, zoomRef.current);
        const cLat = centerRef.current.lat;
        const cLng = centerRef.current.lng;
        const centerWorldX = ((cLng + 180) / 360) * 256 * numTiles;
        const sinCenterLat = Math.sin((cLat * Math.PI) / 180);
        const centerWorldY =
          (0.5 - Math.log((1 + sinCenterLat) / (1 - sinCenterLat)) / (4 * Math.PI)) * 256 * numTiles;

        let bestDist = lensRadius * 0.9;
        for (const candidate of sites) {
          const targetWorldX = ((candidate.gps.lng + 180) / 360) * 256 * numTiles;
          const sinTargetLat = Math.sin((candidate.gps.lat * Math.PI) / 180);
          const targetWorldY =
            (0.5 - Math.log((1 + sinTargetLat) / (1 - sinTargetLat)) / (4 * Math.PI)) * 256 * numTiles;
          const cx = width / 2 + (targetWorldX - centerWorldX);
          const cy = height / 2 + (targetWorldY - centerWorldY);
          const d = Math.hypot(cx - lensX, cy - lensY);
          if (d < bestDist) {
            bestDist = d;
            regionalSite = candidate;
          }
        }
      }

      const regionalMeta = getRegionalLensMeta(regionalSite?.id, lang);
      if (lensPillTextRef.current && lastLensLabelRef.current !== regionalMeta.label) {
        lastLensLabelRef.current = regionalMeta.label;
        lensPillTextRef.current.textContent = regionalMeta.label;
      }
      if (lastLensRegionRef.current !== regionalMeta.region) {
        lastLensRegionRef.current = regionalMeta.region;
        setLensRegionKey(regionalMeta.region);
      }

      if (lensPillRef.current) {
        const pillW = Math.min(width - 20, Math.max(220, lensPillRef.current.offsetWidth || 250));
        const pillX = Math.max(10, Math.min(width - pillW - 10, lensX - pillW / 2));
        const pillY = Math.max(84, top - 30);
        lensPillRef.current.style.transform = `translate3d(${pillX}px, ${pillY}px, 0)`;
      }
    },
    [activeMapHeritageId, sites, selectedSite, isLensLocked, lang]
  );

  // Smooth rAF interpolation for Spyglass Lens cursor tracking (zero React re-renders)
  const startLensLerpLoop = useCallback(() => {
    if (lensLerpRafRef.current !== null) return;
    const step = () => {
      const cur = lensCurrentPosRef.current;
      const target = lensTargetPosRef.current;
      if (!cur || !target) {
        lensLerpRafRef.current = null;
        return;
      }
      const dx = target.x - cur.x;
      const dy = target.y - cur.y;
      if (Math.hypot(dx, dy) < 0.45) {
        lensCurrentPosRef.current = { ...target };
        applySpyglassDomTransform(target.x, target.y);
        lensLerpRafRef.current = null;
        return;
      }
      const next = {
        x: cur.x + dx * 0.26,
        y: cur.y + dy * 0.26,
      };
      lensCurrentPosRef.current = next;
      applySpyglassDomTransform(next.x, next.y);
      lensLerpRafRef.current = requestAnimationFrame(step);
    };
    lensLerpRafRef.current = requestAnimationFrame(step);
  }, [applySpyglassDomTransform]);

  useEffect(() => {
    return () => {
      if (lensLerpRafRef.current !== null) {
        cancelAnimationFrame(lensLerpRafRef.current);
      }
    };
  }, []);

  // Auto-focus Stop 01 when activeTour changes (only if selectedSite is not already in tour)
  useEffect(() => {
    if (activeTour && activeTour.sites.length > 0) {
      const tourSites = activeTour.sites
        .map((id) => sites.find((s) => s.id === id))
        .filter((s): s is HeritageSite => Boolean(s));

      if (tourSites.length > 0) {
        const stop01 = tourSites[0];
        const isAlreadyAtStop = selectedSite && activeTour.sites.includes(selectedSite.id);
        if (!isAlreadyAtStop) {
          lensPinnedToSiteRef.current = true;
          flyTo({ lat: stop01.gps.lat - 0.0014, lng: stop01.gps.lng }, 15.0, 800);
        }
      }
    }
  }, [activeTour?.id, sites, flyTo]);

  // Standard Web Mercator Projection: Lat/Lng -> Screen Pixels
  const projectToScreen = useCallback(
    (coord: WGS84Coordinate, width: number, height: number) => {
      const numTiles = Math.pow(2, zoom);
      const centerWorldX = ((center.lng + 180) / 360) * 256 * numTiles;
      const sinCenterLat = Math.sin((center.lat * Math.PI) / 180);
      const centerWorldY =
        (0.5 - Math.log((1 + sinCenterLat) / (1 - sinCenterLat)) / (4 * Math.PI)) * 256 * numTiles;

      const targetWorldX = ((coord.lng + 180) / 360) * 256 * numTiles;
      const sinTargetLat = Math.sin((coord.lat * Math.PI) / 180);
      const targetWorldY =
        (0.5 - Math.log((1 + sinTargetLat) / (1 - sinTargetLat)) / (4 * Math.PI)) * 256 * numTiles;

      const screenX = width / 2 + (targetWorldX - centerWorldX);
      const screenY = height / 2 + (targetWorldY - centerWorldY);

      return { x: screenX, y: screenY };
    },
    [center, zoom]
  );

  // Inverse Projection: Screen Pixels -> WGS84
  const projectToGeo = useCallback(
    (screenX: number, screenY: number, width: number, height: number): WGS84Coordinate => {
      const numTiles = Math.pow(2, zoom);
      const centerWorldX = ((center.lng + 180) / 360) * 256 * numTiles;
      const sinCenterLat = Math.sin((center.lat * Math.PI) / 180);
      const centerWorldY =
        (0.5 - Math.log((1 + sinCenterLat) / (1 - sinCenterLat)) / (4 * Math.PI)) * 256 * numTiles;

      const targetWorldX = centerWorldX + (screenX - width / 2);
      const targetWorldY = centerWorldY + (screenY - height / 2);

      const targetLng = (targetWorldX / (256 * numTiles)) * 360 - 180;
      const n = Math.PI - (2 * Math.PI * targetWorldY) / (256 * numTiles);
      const targetLat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

      return { lat: targetLat, lng: targetLng };
    },
    [center, zoom]
  );

  const tileRafRef = useRef<number | null>(null);

  // Fast tile loader with caching and rAF-batched repaint
  const loadTile = useCallback((url: string): HTMLImageElement | null => {
    if (tileImageCache.has(url)) {
      const img = tileImageCache.get(url)!;
      return img.complete ? img : null;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      if (tileRafRef.current === null) {
        tileRafRef.current = requestAnimationFrame(() => {
          tileRafRef.current = null;
          setTileRerenderTick((t) => t + 1);
        });
      }
    };
    tileImageCache.set(url, img);
    return null;
  }, []);

  // Marker Clustering Algorithm (only in non-route GIS mode when zoom < 14)
  const getClustersAndUnclustered = useCallback(
    (width: number, height: number) => {
      if (zoom >= 14 || activeTour) {
        return { clusters: [], unclustered: sites };
      }

      const clusterRadius = 45; // screen pixels
      const clusters: MarkerCluster[] = [];
      const assigned = new Set<string>();

      sites.forEach((site) => {
        if (assigned.has(site.id)) return;
        const p = projectToScreen(site.gps, width, height);

        const neighbors: HeritageSite[] = [site];
        assigned.add(site.id);

        sites.forEach((other) => {
          if (assigned.has(other.id)) return;
          const otherP = projectToScreen(other.gps, width, height);
          const dist = Math.hypot(p.x - otherP.x, p.y - otherP.y);
          if (dist < clusterRadius) {
            neighbors.push(other);
            assigned.add(other.id);
          }
        });

        if (neighbors.length > 1) {
          const avgLat = neighbors.reduce((acc, cur) => acc + cur.gps.lat, 0) / neighbors.length;
          const avgLng = neighbors.reduce((acc, cur) => acc + cur.gps.lng, 0) / neighbors.length;
          const centerGeo = { lat: avgLat, lng: avgLng };
          const centerScreen = projectToScreen(centerGeo, width, height);

          clusters.push({
            id: `cl-${site.id}`,
            count: neighbors.length,
            centerGeo,
            screenX: centerScreen.x,
            screenY: centerScreen.y,
            sites: neighbors,
          });
        }
      });

      const unclustered = sites.filter(
        (site) => !clusters.some((cl) => cl.sites.some((s) => s.id === site.id))
      );

      return { clusters, unclustered };
    },
    [sites, zoom, activeTour, projectToScreen]
  );

  // Layer 1: Base Slippy Map Tiles (Satellite / Dark / Split Compare — NEVER redraws on Spyglass mousemove or marker hover)
  useEffect(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.parentElement?.clientWidth || 1000;
    const height = canvas.parentElement?.clientHeight || 700;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const drawTiles = (
      isSatellite: boolean,
      clipXStart: number,
      clipWidth: number,
      enableHistoricalOverlay = false
    ) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(clipXStart, 0, clipWidth, height);
      ctx.clip();

      const tileZoom = Math.floor(zoom);
      const numTiles = Math.pow(2, tileZoom);
      const tileSize = 256;

      const centerWorldX = ((center.lng + 180) / 360) * numTiles * tileSize;
      const sinLat = Math.sin((center.lat * Math.PI) / 180);
      const centerWorldY =
        (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * numTiles * tileSize;

      const scaleFraction = Math.pow(2, zoom - tileZoom);
      const scaledTileSize = tileSize * scaleFraction;

      const minTileX = Math.floor((centerWorldX - width / 2 / scaleFraction) / tileSize) - 1;
      const maxTileX = Math.floor((centerWorldX + width / 2 / scaleFraction) / tileSize) + 1;
      const minTileY = Math.floor((centerWorldY - height / 2 / scaleFraction) / tileSize) - 1;
      const maxTileY = Math.floor((centerWorldY + height / 2 / scaleFraction) / tileSize) + 1;

      ctx.fillStyle = isSatellite ? '#171817' : '#171817';
      ctx.fillRect(clipXStart, 0, clipWidth, height);

      for (let tx = minTileX; tx <= maxTileX; tx++) {
        for (let ty = minTileY; ty <= maxTileY; ty++) {
          if (ty < 0 || ty >= numTiles) continue;
          const wrappedTx = ((tx % numTiles) + numTiles) % numTiles;

          const screenX = width / 2 + (tx * tileSize - centerWorldX) * scaleFraction;
          const screenY = height / 2 + (ty * tileSize - centerWorldY) * scaleFraction;

          if (isSatellite) {
            const satUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tileZoom}/${ty}/${wrappedTx}`;
            const imgSat = loadTile(satUrl);
            if (imgSat) {
              ctx.drawImage(imgSat, screenX, screenY, scaledTileSize, scaledTileSize);
            }
          } else {
            const baseUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${tileZoom}/${ty}/${wrappedTx}`;
            const refUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/${tileZoom}/${ty}/${wrappedTx}`;

            const imgBase = loadTile(baseUrl);
            if (imgBase) {
              ctx.drawImage(imgBase, screenX, screenY, scaledTileSize, scaledTileSize);
            }

            if (zoom >= 14) {
              const imgRef = loadTile(refUrl);
              if (imgRef) {
                ctx.globalAlpha = 0.55;
                ctx.drawImage(imgRef, screenX, screenY, scaledTileSize, scaledTileSize);
                ctx.globalAlpha = 1.0;
              }
            }
          }
        }
      }

      if (showWaterways) {
        drawWaterwayEnhancement(ctx, width, height, isSatellite);
      }

      if (showDistricts) {
        drawDistrictBorders(ctx, width, height, isSatellite);
      }

      if (enableHistoricalOverlay) {
        const histMode: BaseMapMode = baseMapMode.startsWith('historical')
          ? baseMapMode
          : 'historical_1815';
        drawHistoricalMapOverlay(ctx, width, height, histMode, Math.max(0.88, historicalOpacity));
        if (histMode === 'historical_1815') {
          drawHistoricalMapOverlay(ctx, width, height, 'historical_1898', 0.72);
        }
      }

      ctx.restore();
    };

    if (isSplitCompare) {
      const splitPixel = (width * splitSliderX) / 100;
      drawTiles(false, 0, splitPixel, true);
      drawTiles(true, splitPixel, width - splitPixel, false);

      ctx.save();
      ctx.strokeStyle = '#D8C9A9';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(splitPixel, 0);
      ctx.lineTo(splitPixel, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(splitPixel, height / 2, 20, 0, Math.PI * 2);
      ctx.fillStyle = '#D8C9A9';
      ctx.shadowColor = 'rgba(23,24,23,0.65)';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#C9A46A';
      ctx.stroke();

      ctx.fillStyle = '#171817';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('◄ ►', splitPixel, height / 2);

      const splitLeftLabel =
        lang === 'en'
          ? '◄ HISTORICAL 1815/1898'
          : lang === 'zh'
          ? '◄ 1815/1898 古舆图'
          : '◄ BẢN ĐỒ CỔ 1815/1898';
      const splitRightLabel =
        lang === 'en'
          ? 'SATELLITE 2026 ►'
          : lang === 'zh'
          ? '2026 卫星图 ►'
          : 'VỆ TINH 2026 ►';

      ctx.fillStyle = '#171817';
      ctx.fillRect(splitPixel - 155, 58, 142, 24);
      ctx.strokeStyle = '#C9A46A';
      ctx.lineWidth = 1;
      ctx.strokeRect(splitPixel - 155, 58, 142, 24);
      ctx.fillStyle = '#C9A46A';
      ctx.font = 'bold 9.5px monospace';
      ctx.fillText(splitLeftLabel, splitPixel - 84, 70);

      ctx.fillStyle = '#171817';
      ctx.fillRect(splitPixel + 13, 58, 132, 24);
      ctx.strokeStyle = '#C9A46A';
      ctx.strokeRect(splitPixel + 13, 58, 132, 24);
      ctx.fillStyle = '#D8C9A9';
      ctx.fillText(splitRightLabel, splitPixel + 79, 70);
      ctx.restore();
    } else {
      drawTiles(
        isSpyglassLensMode ? true : baseMapMode === 'satellite',
        0,
        width,
        !isSpyglassLensMode && baseMapMode.startsWith('historical')
      );
    }
  }, [
    center,
    zoom,
    baseMapMode,
    isSplitCompare,
    splitSliderX,
    historicalOpacity,
    isSpyglassLensMode,
    showDistricts,
    showWaterways,
    tileRerenderTick,
    lang,
    loadTile,
  ]);

  // Layer 2: 1:1 Coordinate-Locked Antique Map Buffer for Spyglass (redraws only on pan/zoom/region change, NOT on mousemove)
  useEffect(() => {
    if (!isSpyglassLensMode) return;
    const lensCanvas = lensBufferCanvasRef.current;
    if (!lensCanvas) return;
    const ctx = lensCanvas.getContext('2d');
    if (!ctx) return;

    const width = containerRef.current?.clientWidth || 1000;
    const height = containerRef.current?.clientHeight || 700;
    if (lensCanvas.width !== width) lensCanvas.width = width;
    if (lensCanvas.height !== height) lensCanvas.height = height;

    ctx.fillStyle = '#1D1710';
    ctx.fillRect(0, 0, width, height);

    const tileZoom = Math.floor(zoom);
    const numTiles = Math.pow(2, tileZoom);
    const tileSize = 256;
    const centerWorldX = ((center.lng + 180) / 360) * numTiles * tileSize;
    const sinLat = Math.sin((center.lat * Math.PI) / 180);
    const centerWorldY =
      (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * numTiles * tileSize;
    const scaleFraction = Math.pow(2, zoom - tileZoom);
    const scaledTileSize = tileSize * scaleFraction;

    const minTileX = Math.floor((centerWorldX - width / 2 / scaleFraction) / tileSize) - 1;
    const maxTileX = Math.floor((centerWorldX + width / 2 / scaleFraction) / tileSize) + 1;
    const minTileY = Math.floor((centerWorldY - height / 2 / scaleFraction) / tileSize) - 1;
    const maxTileY = Math.floor((centerWorldY + height / 2 / scaleFraction) / tileSize) + 1;

    ctx.save();
    ctx.filter = 'sepia(0.75) contrast(1.18) brightness(0.88)';
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        if (ty < 0 || ty >= numTiles) continue;
        const wrappedTx = ((tx % numTiles) + numTiles) % numTiles;
        const screenX = width / 2 + (tx * tileSize - centerWorldX) * scaleFraction;
        const screenY = height / 2 + (ty * tileSize - centerWorldY) * scaleFraction;

        const topoUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${tileZoom}/${ty}/${wrappedTx}`;
        const imgTopo = loadTile(topoUrl);
        if (imgTopo) {
          ctx.drawImage(imgTopo, screenX, screenY, scaledTileSize, scaledTileSize);
        } else {
          const satFallbackUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tileZoom}/${ty}/${wrappedTx}`;
          const imgSatFallback = loadTile(satFallbackUrl);
          if (imgSatFallback) {
            ctx.drawImage(imgSatFallback, screenX, screenY, scaledTileSize, scaledTileSize);
          }
        }
      }
    }
    ctx.restore();

    // Subtle parchment glaze inside lens
    ctx.fillStyle = 'rgba(197, 160, 89, 0.12)';
    ctx.fillRect(0, 0, width, height);

    // World-locked Geodetic Coordinate Grid (1:1 locked to lat/lng)
    const gridStepDeg = zoom >= 15.2 ? 0.004 : zoom >= 13.5 ? 0.01 : 0.04;
    const topLeftGeo = projectToGeo(0, 0, width, height);
    const bottomRightGeo = projectToGeo(width, height, width, height);
    const startLat = Math.floor(bottomRightGeo.lat / gridStepDeg) * gridStepDeg;
    const endLat = Math.ceil(topLeftGeo.lat / gridStepDeg) * gridStepDeg;
    const startLng = Math.floor(topLeftGeo.lng / gridStepDeg) * gridStepDeg;
    const endLng = Math.ceil(bottomRightGeo.lng / gridStepDeg) * gridStepDeg;

    ctx.strokeStyle = 'rgba(197, 160, 89, 0.34)';
    ctx.lineWidth = 0.8;
    for (let gLat = startLat; gLat <= endLat; gLat += gridStepDeg) {
      const pL = projectToScreen({ lat: gLat, lng: startLng }, width, height);
      const pR = projectToScreen({ lat: gLat, lng: endLng }, width, height);
      ctx.beginPath();
      ctx.moveTo(pL.x, pL.y);
      ctx.lineTo(pR.x, pR.y);
      ctx.stroke();
    }
    for (let gLng = startLng; gLng <= endLng; gLng += gridStepDeg) {
      const pT = projectToScreen({ lat: endLat, lng: gLng }, width, height);
      const pB = projectToScreen({ lat: startLat, lng: gLng }, width, height);
      ctx.beginPath();
      ctx.moveTo(pT.x, pT.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
    }

    // Regional Historical Cartographic Overlays (World-Projected 1:1)
    if (lensRegionKey === 'saigon_core') {
      drawHistoricalMapOverlay(ctx, width, height, 'historical_1815', 0.65, false);
      drawHistoricalMapOverlay(ctx, width, height, 'historical_1898', 0.58, false);
    } else if (lensRegionKey === 'cholon_giadinh') {
      const pCholon = projectToScreen({ lat: 10.7525, lng: 106.663 }, width, height);
      const pGiacLam = projectToScreen({ lat: 10.7795, lng: 106.6476 }, width, height);
      const pLangOng = projectToScreen({ lat: 10.8025, lng: 106.6974 }, width, height);
      ctx.strokeStyle = 'rgba(243, 202, 110, 0.78)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pCholon.x, pCholon.y);
      ctx.lineTo(pGiacLam.x, pGiacLam.y);
      ctx.lineTo(pLangOng.x, pLangOng.y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (lensRegionKey === 'cuchi_binhduong') {
      const pCuChi = projectToScreen({ lat: 11.1436, lng: 106.4628 }, width, height);
      const pBenCat = projectToScreen({ lat: 11.138, lng: 106.578 }, width, height);
      const radZone = Math.max(40, Math.pow(2, zoom - 13) * 75);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.72)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.arc(pCuChi.x, pCuChi.y, radZone, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pBenCat.x, pBenCat.y, radZone * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (lensRegionKey === 'vungtau_cangio') {
      const pBachDinh = projectToScreen({ lat: 10.3497, lng: 107.0706 }, width, height);
      const pCanGio = projectToScreen({ lat: 10.415, lng: 106.955 }, width, height);
      ctx.strokeStyle = 'rgba(197, 160, 89, 0.7)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(pBachDinh.x, pBachDinh.y);
      ctx.lineTo(pCanGio.x, pCanGio.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [
    isSpyglassLensMode,
    center,
    zoom,
    tileRerenderTick,
    lensRegionKey,
    loadTile,
    projectToGeo,
    projectToScreen,
  ]);

  // Keep pinned Spyglass position synced on center/zoom/selection changes (0 React re-renders on cursor tracking)
  useEffect(() => {
    if (!isSpyglassLensMode) return;
    const width = containerRef.current?.clientWidth || 1000;
    const height = containerRef.current?.clientHeight || 700;
    const activeSiteForLens =
      (activeMapHeritageId
        ? sites.find((s) => resolveHeritageVideoId(s.id) === activeMapHeritageId)
        : null) ||
      selectedSite ||
      sites[0];
    const activeScreen = activeSiteForLens
      ? projectToScreen(activeSiteForLens.gps, width, height)
      : { x: width * 0.5, y: height * 0.5 };

    const usePinnedPos = isLensLocked || lensPinnedToSiteRef.current || !lensCurrentPosRef.current;
    const pos = usePinnedPos ? activeScreen : lensCurrentPosRef.current!;
    if (usePinnedPos) {
      lensCurrentPosRef.current = pos;
    }
    applySpyglassDomTransform(pos.x, pos.y);
  }, [
    isSpyglassLensMode,
    isLensLocked,
    center,
    zoom,
    selectedSite,
    activeMapHeritageId,
    sites,
    projectToScreen,
    applySpyglassDomTransform,
  ]);

  // Layer 3: Interactive Vector & Marker Overlay Canvas (routes, buffer zones, markers, clusters, GIS [i] pins, measurement)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.parentElement?.clientWidth || 1000;
    const height = canvas.parentElement?.clientHeight || 700;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (activeTour) {
      drawTourRoute(ctx, width, height, activeTour, sites);
    }

    if (showProtectionZones && selectedSite) {
      drawHeritageProtectionZones(ctx, width, height, selectedSite);
    }

    drawMarkersAndClusters(ctx, width, height);

    if (measureMode && measurePointA) {
      drawMeasurementLine(ctx, width, height);
    }
  }, [
    center,
    zoom,
    sites,
    selectedSite,
    hoveredSite,
    hoveredCluster,
    activeTour,
    measureMode,
    measurePointA,
    measurePointB,
    showProtectionZones,
    projectToScreen,
    getClustersAndUnclustered,
    lang,
    formatDistrictName,
    getLocalizedSite,
    customGlbBadgeMap,
  ]);

  // Enhanced Saigon River & Living Canal Waterways (Nước xanh đen dịu)
  const drawWaterwayEnhancement = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    isSatellite: boolean
  ) => {
    ctx.save();
    const riverCoords: WGS84Coordinate[] = [
      { lat: 10.842, lng: 106.726 },
      { lat: 10.825, lng: 106.722 },
      { lat: 10.805, lng: 106.716 },
      { lat: 10.792, lng: 106.711 },
      { lat: 10.781, lng: 106.708 },
      { lat: 10.768, lng: 106.709 },
      { lat: 10.755, lng: 106.717 },
      { lat: 10.738, lng: 106.732 },
    ];

    // Xanh đen dịu, không bão hòa
    ctx.strokeStyle = isSatellite ? 'rgba(30, 58, 80, 0.45)' : 'rgba(20, 36, 48, 0.7)';
    ctx.lineWidth = Math.max(16, Math.pow(2, zoom - 12) * 15);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    riverCoords.forEach((coord, i) => {
      const p = projectToScreen(coord, width, height);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Rạch Bến Nghé / Kênh Tàu Hủ
    const benNgheCanal: WGS84Coordinate[] = [
      { lat: 10.768, lng: 106.708 },
      { lat: 10.764, lng: 106.699 },
      { lat: 10.758, lng: 106.685 },
      { lat: 10.752, lng: 106.669 },
    ];
    ctx.strokeStyle = isSatellite ? 'rgba(30, 58, 80, 0.4)' : 'rgba(20, 36, 48, 0.65)';
    ctx.lineWidth = Math.max(4.5, Math.pow(2, zoom - 13) * 4.5);
    ctx.beginPath();
    benNgheCanal.forEach((c, idx) => {
      const p = projectToScreen(c, width, height);
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    ctx.restore();
  };

  // District Boundaries & Centroid Labels
  const drawDistrictBorders = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    isSatellite: boolean
  ) => {
    ctx.save();
    const districtCentroids: { name: string; coord: WGS84Coordinate }[] = [
      { name: 'Quận 1', coord: { lat: 10.7756, lng: 106.7004 } },
      { name: 'Quận 3', coord: { lat: 10.7844, lng: 106.6844 } },
      { name: 'Quận 5 (Chợ Lớn)', coord: { lat: 10.7541, lng: 106.6631 } },
      { name: 'Quận 4', coord: { lat: 10.762, lng: 106.705 } },
      { name: 'Bình Thạnh', coord: { lat: 10.803, lng: 106.699 } },
    ];

    districtCentroids.forEach((dist) => {
      const p = projectToScreen(dist.coord, width, height);
      if (p.x < -40 || p.x > width + 40 || p.y < -40 || p.y > height + 40) return;

      if (zoom >= 13 && zoom <= 16) {
        ctx.font = '600 11px sans-serif';
        ctx.fillStyle = isSatellite ? 'rgba(255, 255, 255, 0.45)' : 'rgba(245, 239, 230, 0.35)';
        ctx.textAlign = 'center';
        ctx.fillText(formatDistrictName(dist.name).toUpperCase(), p.x, p.y);
      }
    });

    ctx.restore();
  };

  // Protection Buffer Zones: Vàng đồng nhạt, opacity 0.12, bỏ nhãn chữ đỏ
  const drawHeritageProtectionZones = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    site: HeritageSite
  ) => {
    const p = projectToScreen(site.gps, width, height);
    ctx.save();
    const scale = Math.pow(2, zoom - 14);
    const r1 = Math.max(22, 38 * scale);
    const r2 = Math.max(48, 85 * scale);

    // Vành đai bảo vệ II
    ctx.beginPath();
    ctx.arc(p.x, p.y, r2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(201, 161, 91, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.stroke();

    ctx.fillStyle = 'rgba(201, 161, 91, 0.04)';
    ctx.fill();

    // Vành đai bảo vệ I (Vàng đồng nhạt thay đỏ, opacity 0.12)
    ctx.beginPath();
    ctx.arc(p.x, p.y, r1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(201, 161, 91, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.stroke();

    ctx.fillStyle = 'rgba(201, 161, 91, 0.12)';
    ctx.fill();

    ctx.restore();
  };

  // Historical Map Overlays (1815 Gia Định Octagonal Citadel, 1898 French Colonial Plan, 1966 Saigon Capital Axis)
  const drawHistoricalMapOverlay = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    layerId: BaseMapMode,
    opacity: number,
    withWashAndGrid: boolean = true
  ) => {
    ctx.save();
    ctx.globalAlpha = opacity;

    if (withWashAndGrid) {
      // Subtle vintage sepia cartographic parchment wash
      ctx.fillStyle = 'rgba(46, 34, 18, 0.34)';
      ctx.fillRect(0, 0, width, height);

      // Subtle cartographic graticule grid
      const gridSpacing = 90;
      ctx.strokeStyle = 'rgba(212, 175, 97, 0.14)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < width; gx += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }
    }

    const pPalace = projectToScreen({ lat: 10.777, lng: 106.6953 }, width, height);
    const pCathedral = projectToScreen({ lat: 10.7798, lng: 106.699 }, width, height);
    const pTheatre = projectToScreen({ lat: 10.7767, lng: 106.7032 }, width, height);
    const pBenThanh = projectToScreen({ lat: 10.7725, lng: 106.698 }, width, height);
    const pNhaRong = projectToScreen({ lat: 10.7683, lng: 106.7068 }, width, height);
    const pMuseum = projectToScreen({ lat: 10.7879, lng: 106.7048 }, width, height);

    if (layerId === 'historical_1815') {
      // Thành Bát Quái (Thành Quy - Gia Định 1815) theo Đồ bản Trần Văn Học
      const pCenter = projectToScreen({ lat: 10.7785, lng: 106.6975 }, width, height);
      const rad = Math.max(38, Math.pow(2, zoom - 14) * 115);

      // Outer moat (Hào thành Bát Quái)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 + Math.PI / 8;
        const x = pCenter.x + (rad + 10) * Math.cos(angle);
        const y = pCenter.y + (rad + 10) * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      // Octagonal stone rampart & 8 Vauban-style bastions
      ctx.fillStyle = 'rgba(212, 175, 97, 0.16)';
      ctx.strokeStyle = '#F3CA6E';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 + Math.PI / 8;
        const x = pCenter.x + rad * Math.cos(angle);
        const y = pCenter.y + rad * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bastion nodes at 8 corners
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 + Math.PI / 8;
        const x = pCenter.x + rad * Math.cos(angle);
        const y = pCenter.y + rad * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#F3CA6E';
        ctx.fill();
      }

      // Label
      ctx.fillStyle = '#FDE68A';
      ctx.font = 'bold 11px serif';
      ctx.textAlign = 'center';
      ctx.fillText('THÀNH BÁT QUÁI GIA ĐỊNH (1790 - 1815)', pCenter.x, pCenter.y - rad - 16);
    } else if (layerId === 'historical_1898') {
      // Quy hoạch Đô thị Pháp thuộc Sài Gòn - Chợ Lớn 1898 (Đại lộ Norodom, Catinat, Charner, Bonard)
      ctx.strokeStyle = '#F3CA6E';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);

      // Trục Đại lộ Norodom (Dinh Norodom -> Thảo Cầm Viên / Bảo tàng)
      ctx.beginPath();
      ctx.moveTo(pPalace.x, pPalace.y);
      ctx.lineTo(pMuseum.x, pMuseum.y);
      ctx.stroke();

      // Trục Đường Catinat (Nhà thờ Đức Bà -> Nhà hát -> Bến sông Sài Gòn)
      ctx.beginPath();
      ctx.moveTo(pCathedral.x, pCathedral.y);
      ctx.lineTo(pTheatre.x, pTheatre.y);
      ctx.lineTo(pNhaRong.x, pNhaRong.y - 18);
      ctx.stroke();

      // Trục Đại lộ Bonard (Nhà hát -> Chợ Bến Thành)
      ctx.beginPath();
      ctx.moveTo(pTheatre.x, pTheatre.y);
      ctx.lineTo(pBenThanh.x, pBenThanh.y);
      ctx.stroke();

      // Kênh Lớn (Kênh Charner / Đại lộ Nguyễn Huệ xưa)
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pPalace.x + 18, pPalace.y + 12);
      ctx.lineTo(pNhaRong.x - 10, pNhaRong.y - 10);
      ctx.stroke();

      ctx.fillStyle = '#FDE68A';
      ctx.font = 'bold 11px serif';
      ctx.textAlign = 'center';
      ctx.fillText('QUY HOẠCH ĐẠI LỘ PHÁP THUỘC SÀI GÒN (1898)', pCathedral.x, pCathedral.y - 26);
    } else if (layerId === 'historical_1966') {
      // Đô thành Sài Gòn 1966 (Trục lễ tân Dinh Độc Lập - Công trường Hòa Bình - Bến Bạch Đằng)
      const radCore = Math.max(48, Math.pow(2, zoom - 14) * 145);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.arc(pCathedral.x, pCathedral.y, radCore, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
      ctx.fill();

      // Trục Đại lộ Thống Nhất - Tự Do - Lê Lợi
      ctx.setLineDash([]);
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(pPalace.x, pPalace.y);
      ctx.lineTo(pCathedral.x, pCathedral.y);
      ctx.lineTo(pTheatre.x, pTheatre.y);
      ctx.lineTo(pBenThanh.x, pBenThanh.y);
      ctx.stroke();

      ctx.fillStyle = '#FDE68A';
      ctx.font = 'bold 11px serif';
      ctx.textAlign = 'center';
      ctx.fillText('TRỤC LỊCH SỬ ĐÔ THÀNH SÀI GÒN (1966)', pPalace.x, pPalace.y - 28);
    }

    ctx.restore();
  };

  // Smooth Curved Arc Tour Route (#C5A059) — renders ONLY the selected route
  const drawTourRoute = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    tour: TourRoute,
    allSites: HeritageSite[]
  ) => {
    const tourSites = tour.sites
      .map((id) => allSites.find((s) => s.id === id))
      .filter((s): s is HeritageSite => Boolean(s));

    if (tourSites.length === 0) return;

    const routePalette = getTourRouteIndochineColor(tour);
    const routeHex = routePalette.primaryHex;

    ctx.save();

    if (tourSites.length >= 2) {
      // Draw smooth quadratic curved arcs between consecutive stops
      for (let i = 0; i < tourSites.length - 1; i++) {
        const p1 = projectToScreen(tourSites[i].gps, width, height);
        const p2 = projectToScreen(tourSites[i + 1].gps, width, height);

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) continue;

        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const curveSign = i % 2 === 0 ? 1 : -1;
        const offset = Math.min(54, Math.max(12, dist * 0.22)) * curveSign;
        const cx = mx - (dy / dist) * offset;
        const cy = my + (dx / dist) * offset;

        // Subtle dark casing for crisp legibility over dark/satellite maps
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);
        ctx.strokeStyle = 'rgba(23, 24, 23, 0.85)';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 0;
        ctx.stroke();

        // Smooth pigment route curve
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);
        ctx.strokeStyle = routeHex;
        ctx.lineWidth = 3;
        ctx.shadowColor = routePalette.softBgRgba;
        ctx.shadowBlur = 8;
        ctx.stroke();

        // Midpoint directional arrow along the curve (t = 0.5)
        ctx.shadowBlur = 0;
        const arrowX = 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x;
        const arrowY = 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y;
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(angle);
        ctx.fillStyle = routeHex;
        ctx.strokeStyle = '#171817';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(5.5, 0);
        ctx.lineTo(-4.5, -4.5);
        ctx.lineTo(-1.5, 0);
        ctx.lineTo(-4.5, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Numbered pins 1, 2, 3... for active route stops
    tourSites.forEach((site, idx) => {
      const p = projectToScreen(site.gps, width, height);
      const isCurrentStop = selectedSite?.id === site.id;

      // Outer glowing halo (stronger on selected stop)
      ctx.beginPath();
      ctx.arc(p.x, p.y, isCurrentStop ? 20 : 15, 0, Math.PI * 2);
      ctx.fillStyle = isCurrentStop
        ? 'rgba(201, 164, 106, 0.32)'
        : routePalette.softBgRgba;
      ctx.fill();

      if (isCurrentStop) {
        ctx.strokeStyle = routeHex;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Main numbered badge
      ctx.beginPath();
      ctx.arc(p.x, p.y, isCurrentStop ? 13 : 11, 0, Math.PI * 2);
      ctx.fillStyle = routeHex;
      ctx.fill();
      ctx.strokeStyle = '#171817';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner number
      ctx.fillStyle = routePalette.fgHex;
      ctx.font = 'bold 10.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${idx + 1}`, p.x, p.y + 0.5);
    });

    ctx.restore();
  };

  // Draw Custom Map Markers, Clusters & Dimmed 6px Non-Tour Dots
  const drawMarkersAndClusters = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    const { clusters, unclustered } = getClustersAndUnclustered(width, height);

    // 1. Draw Cluster Markers (only when activeTour is null)
    clusters.forEach((cl) => {
      const isHovered = hoveredCluster?.id === cl.id;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cl.screenX, cl.screenY, isHovered ? 27 : 23, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(201, 164, 106, 0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(201, 164, 106, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cl.screenX, cl.screenY, isHovered ? 21 : 18, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(23, 24, 23, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#A94F3D';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cl.screenX, cl.screenY, isHovered ? 15.5 : 13.5, 0, Math.PI * 2);
      ctx.fillStyle = '#171817';
      ctx.fill();
      ctx.strokeStyle = '#C9A46A';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#D8C9A9';
      ctx.font = '800 12px "Be Vietnam Pro", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${cl.count}`, cl.screenX, cl.screenY + 0.5);

      ctx.restore();
    });

    // 2. Draw Individual Sites (Color-blocked by the 4 Heritage Pigments)
    unclustered.forEach((site) => {
      const p = projectToScreen(site.gps, width, height);
      if (p.x < -80 || p.x > width + 80 || p.y < -80 || p.y > height + 80) return;

      const isSelected = selectedSite?.id === site.id;
      const isHovered = hoveredSite?.id === site.id;
      const isInActiveTour = activeTour?.sites.includes(site.id) ?? false;
      const siteBlock = getHeritageColorBlock(site, lang);

      if (activeTour) {
        if (!isInActiveTour) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, isSelected || isHovered ? 4.5 : 3, 0, Math.PI * 2);
          ctx.fillStyle =
            isSelected || isHovered
              ? '#C9A46A'
              : 'rgba(216, 201, 169, 0.36)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(23, 24, 23, 0.85)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }

        if (isSelected || isHovered) {
          ctx.save();
          ctx.font = isSelected ? '600 11.5px sans-serif' : '500 10.5px sans-serif';
          const labelText = getLocalizedSite(site).officialName;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.strokeStyle = 'rgba(23, 24, 23, 0.92)';
          ctx.lineWidth = 3.5;
          const labelY = p.y + (isInActiveTour ? 18 : 8);
          ctx.strokeText(labelText, p.x, labelY);
          ctx.fillStyle = '#D8C9A9';
          ctx.fillText(labelText, p.x, labelY);
          ctx.restore();
        }
        return;
      }

      const isSpecialNational = site.rankingLevel === 'Special National';
      const pinColor = siteBlock.bg;
      const pinRadius = isSpecialNational
        ? isSelected
          ? 12.5
          : isHovered
          ? 11.5
          : 10.5
        : isSelected
        ? 11
        : isHovered
        ? 10
        : 8.5;

      ctx.save();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, isSpecialNational ? 24 : 21, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(201, 164, 106, 0.28)';
        ctx.fill();
        ctx.strokeStyle = '#C9A46A';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, isHovered ? 19 : 15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(23, 24, 23, 0.35)';
        ctx.fill();
        ctx.strokeStyle = isHovered ? '#D8C9A9' : 'rgba(216, 201, 169, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      ctx.save();
      ctx.shadowColor = 'rgba(23, 24, 23, 0.75)';
      ctx.shadowBlur = isSelected || isHovered ? 12 : 7;

      ctx.beginPath();
      ctx.arc(p.x, p.y, pinRadius, 0, Math.PI * 2);
      ctx.fillStyle = pinColor;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(p.x, p.y, pinRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#D8C9A9';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      if (isSpecialNational) {
        ctx.fillStyle = siteBlock.fg;
        ctx.font = 'bold 10.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', p.x, p.y + 0.5);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
        ctx.fillStyle = siteBlock.fg;
        ctx.fill();
      }

      // Visual GLB badge directly on map pin when IndexedDB or Cloud .glb is loaded
      if (customGlbBadgeMap[site.id]) {
        const bx = p.x + pinRadius + 6;
        const by = p.y - pinRadius - 3;
        ctx.fillStyle = '#171817';
        ctx.beginPath();
        ctx.roundRect(bx - 12, by - 7, 24, 14, 4);
        ctx.fill();
        ctx.strokeStyle = '#C9A46A';
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.fillStyle = '#C9A46A';
        ctx.font = 'bold 7.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GLB', bx, by + 0.5);
      }

      const shouldShowLabel = isSelected || isHovered || zoom >= 15;
      if (shouldShowLabel) {
        ctx.font = isSelected ? '600 11.5px sans-serif' : '500 10.5px sans-serif';
        const labelText = getLocalizedSite(site).officialName;

        let line1 = labelText;
        let line2 = '';
        if (labelText.length > 20 && labelText.includes(' ')) {
          const words = labelText.split(' ');
          const mid = Math.ceil(words.length / 2);
          line1 = words.slice(0, mid).join(' ');
          line2 = words.slice(mid).join(' ');
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        ctx.strokeStyle = 'rgba(23, 24, 23, 0.94)';
        ctx.lineWidth = 3.5;
        ctx.strokeText(line1, p.x, p.y + pinRadius + 5);
        if (line2) {
          ctx.strokeText(line2, p.x, p.y + pinRadius + 17);
        }

        ctx.fillStyle = isSelected ? '#C9A46A' : '#D8C9A9';
        ctx.fillText(line1, p.x, p.y + pinRadius + 5);
        if (line2) {
          ctx.fillText(line2, p.x, p.y + pinRadius + 17);
        }
      }

      ctx.restore();
    });
  };

  // Measurement Line Tool
  const drawMeasurementLine = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    if (!measurePointA) return;
    const pA = projectToScreen(measurePointA, width, height);
    const pB = measurePointB
      ? projectToScreen(measurePointB, width, height)
      : projectToScreen(cursorWgs84, width, height);

    ctx.save();
    ctx.strokeStyle = '#C9A46A';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);

    ctx.beginPath();
    ctx.moveTo(pA.x, pA.y);
    ctx.lineTo(pB.x, pB.y);
    ctx.stroke();

    ctx.fillStyle = '#A94F3D';
    ctx.beginPath();
    ctx.arc(pA.x, pA.y, 6, 0, Math.PI * 2);
    ctx.arc(pB.x, pB.y, 6, 0, Math.PI * 2);
    ctx.fill();

    const targetPt = measurePointB || cursorWgs84;
    const distKm = calculateDistanceKm(measurePointA, targetPt);
    const distText = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(2)} km`;

    const midX = (pA.x + pB.x) / 2;
    const midY = (pA.y + pB.y) / 2;

    ctx.fillStyle = '#F4EFE4';
    ctx.beginPath();
    ctx.roundRect(midX - 40, midY - 12, 80, 24, 6);
    ctx.fill();
    ctx.strokeStyle = '#A94F3D';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#171817';
    ctx.font = 'bold 10.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(distText, midX, midY);

    ctx.restore();
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (showCoordinates || measureMode) {
      const geo = projectToGeo(screenX, screenY, canvas.width, canvas.height);
      setCursorWgs84(geo);
    }

    if (isSpyglassLensMode && !isLensLocked && !isPanning && animFrameRef.current === null) {
      if (lensPinnedToSiteRef.current) {
        const pinOrigin = lastPinClientPosRef.current;
        if (!pinOrigin) {
          lastPinClientPosRef.current = { x: e.clientX, y: e.clientY };
        } else if (Math.hypot(e.clientX - pinOrigin.x, e.clientY - pinOrigin.y) > 12) {
          lensPinnedToSiteRef.current = false;
          lastPinClientPosRef.current = null;
        }
      }

      if (!lensPinnedToSiteRef.current) {
        if (!lensCurrentPosRef.current) {
          lensCurrentPosRef.current = { x: screenX, y: screenY };
        }
        lensTargetPosRef.current = { x: screenX, y: screenY };
        startLensLerpLoop();
      }
    }

    // Split drag handle
    if (isSplitCompare && e.buttons === 1) {
      const splitPx = (canvas.width * splitSliderX) / 100;
      if (Math.abs(screenX - splitPx) < 25) {
        const newPct = Math.max(5, Math.min(95, (screenX / canvas.width) * 100));
        setSplitSliderX(newPct);
        return;
      }
    }

    // Panning
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;

      const numTiles = Math.pow(2, zoom);
      const oldCenterWorldX = ((center.lng + 180) / 360) * 256 * numTiles;
      const sinLat = Math.sin((center.lat * Math.PI) / 180);
      const oldCenterWorldY =
        (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * 256 * numTiles;

      const newCenterWorldX = oldCenterWorldX - dx;
      const newCenterWorldY = oldCenterWorldY - dy;

      const newLng = (newCenterWorldX / (256 * numTiles)) * 360 - 180;
      const n = Math.PI - (2 * Math.PI * newCenterWorldY) / (256 * numTiles);
      const newLat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

      setCenter({ lat: newLat, lng: newLng });
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Hover test: Clusters first, then individual markers (only update state when hovered ID changes)
    const { clusters, unclustered } = getClustersAndUnclustered(canvas.width, canvas.height);

    let hCl: MarkerCluster | null = null;
    for (const cl of clusters) {
      if (Math.hypot(cl.screenX - screenX, cl.screenY - screenY) < 24) {
        hCl = cl;
        break;
      }
    }
    if ((hCl?.id ?? null) !== (hoveredCluster?.id ?? null)) {
      setHoveredCluster(hCl);
    }

    if (hCl) {
      if (hoveredSite !== null) setHoveredSite(null);
      return;
    }

    const orderedHitSites = activeTour
      ? [
          ...unclustered.filter((s) => activeTour.sites.includes(s.id)),
          ...unclustered.filter((s) => !activeTour.sites.includes(s.id)),
        ]
      : unclustered;

    let hovered: HeritageSite | null = null;
    for (const site of orderedHitSites) {
      const p = projectToScreen(site.gps, canvas.width, canvas.height);
      const dist = Math.hypot(p.x - screenX, p.y - screenY);
      const hitRadius = activeTour && !activeTour.sites.includes(site.id) ? 10 : 22;
      if (dist < hitRadius) {
        hovered = site;
        break;
      }
    }
    if ((hovered?.id ?? null) !== (hoveredSite?.id ?? null)) {
      setHoveredSite(hovered);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Measurement tool click
    if (measureMode) {
      const geo = projectToGeo(screenX, screenY, canvas.width, canvas.height);
      if (!measurePointA) {
        setMeasurePointA(geo);
      } else if (!measurePointB) {
        setMeasurePointB(geo);
      } else {
        setMeasurePointA(geo);
        setMeasurePointB(null);
      }
      return;
    }

    // Click on cluster -> Zoom in
    const { clusters, unclustered } = getClustersAndUnclustered(canvas.width, canvas.height);
    for (const cl of clusters) {
      if (Math.hypot(cl.screenX - screenX, cl.screenY - screenY) < 24) {
        flyTo(cl.centerGeo, Math.min(17, zoom + 2.5));
        return;
      }
    }

    // Prioritize active route stops when clicking
    const orderedClickSites = activeTour
      ? [
          ...unclustered.filter((s) => activeTour.sites.includes(s.id)),
          ...unclustered.filter((s) => !activeTour.sites.includes(s.id)),
        ]
      : unclustered;

    // Site marker click
    for (const site of orderedClickSites) {
      const p = projectToScreen(site.gps, canvas.width, canvas.height);
      const dist = Math.hypot(p.x - screenX, p.y - screenY);
      const hitRadius = activeTour && !activeTour.sites.includes(site.id) ? 11 : 22;
      if (dist < hitRadius) {
        lensPinnedToSiteRef.current = true;
        lastPinClientPosRef.current = { x: e.clientX, y: e.clientY };
        onSelectSite(site);
        if (!showInspectorDrawer) {
          setPopupSite(site);
        }
        return;
      }
    }

    // Click on empty canvas closes popup and deselects site
    setPopupSite(null);
    onSelectSite(null);
  };

  // Touch gestures for mobile & tablet
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startTime: number;
    initialDistance?: number;
    initialZoom?: number;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      if (e.cancelable) e.preventDefault();
      const delta = e.deltaY < 0 ? 0.35 : -0.35;
      setZoom((prev) => Math.max(10, Math.min(18, prev + delta)));
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStateRef.current = {
          startX: t.clientX,
          startY: t.clientY,
          lastX: t.clientX,
          lastY: t.clientY,
          startTime: Date.now(),
        };
        setIsPanning(true);
        setPanStart({ x: t.clientX, y: t.clientY });
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStateRef.current = {
          startX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          startY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
          lastX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          lastY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
          startTime: Date.now(),
          initialDistance: dist,
          initialZoom: zoom,
        };
        setIsPanning(false);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchStateRef.current) return;
      if (e.cancelable) e.preventDefault();

      if (e.touches.length === 1 && isPanning) {
        const t = e.touches[0];
        const dx = t.clientX - touchStateRef.current.lastX;
        const dy = t.clientY - touchStateRef.current.lastY;

        touchStateRef.current.lastX = t.clientX;
        touchStateRef.current.lastY = t.clientY;

        const numTiles = Math.pow(2, zoom);
        const oldCenterWorldX = ((center.lng + 180) / 360) * 256 * numTiles;
        const sinLat = Math.sin((center.lat * Math.PI) / 180);
        const oldCenterWorldY =
          (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * 256 * numTiles;

        const newCenterWorldX = oldCenterWorldX - dx;
        const newCenterWorldY = oldCenterWorldY - dy;

        const newLng = (newCenterWorldX / (256 * numTiles)) * 360 - 180;
        const n = Math.PI - (2 * Math.PI * newCenterWorldY) / (256 * numTiles);
        const newLat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

        setCenter({ lat: newLat, lng: newLng });
      } else if (e.touches.length === 2 && touchStateRef.current.initialDistance) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = currentDist / touchStateRef.current.initialDistance;
        const deltaZoom = Math.log2(scale);
        const targetZoom = Math.max(10, Math.min(18, (touchStateRef.current.initialZoom || zoom) + deltaZoom));
        setZoom(targetZoom);
      }
    };

    const onTouchEnd = () => {
      setIsPanning(false);
      if (!touchStateRef.current) return;

      const elapsed = Date.now() - touchStateRef.current.startTime;
      const moved = Math.hypot(
        touchStateRef.current.lastX - touchStateRef.current.startX,
        touchStateRef.current.lastY - touchStateRef.current.startY
      );

      // If quick tap with minimal movement, treat as marker click
      if (elapsed < 350 && moved < 15 && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const screenX = touchStateRef.current.lastX - rect.left;
        const screenY = touchStateRef.current.lastY - rect.top;

        const { clusters, unclustered } = getClustersAndUnclustered(
          canvasRef.current.width,
          canvasRef.current.height
        );
        for (const cl of clusters) {
          if (Math.hypot(cl.screenX - screenX, cl.screenY - screenY) < 28) {
            flyTo(cl.centerGeo, Math.min(17, zoom + 2.5));
            touchStateRef.current = null;
            return;
          }
        }
        for (const site of unclustered) {
          const p = projectToScreen(site.gps, canvasRef.current.width, canvasRef.current.height);
          const dist = Math.hypot(p.x - screenX, p.y - screenY);
          if (dist < 26) {
            onSelectSite(site);
            if (!showInspectorDrawer) {
              setPopupSite(site);
            }
            touchStateRef.current = null;
            return;
          }
        }
        setPopupSite(null);
        onSelectSite(null);
      }

      touchStateRef.current = null;
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [zoom, isPanning, center, sites, showInspectorDrawer]);

  // Active tooltip site (shown when hovering or clicking a marker on the map, always synced with latest sites array)
  const rawTooltipSite = popupSite || hoveredSite;
  const activeTooltipSite = rawTooltipSite
    ? sites.find((s) => s.id === rawTooltipSite.id) || rawTooltipSite
    : null;

  const isHistoricalMode = baseMapMode.startsWith('historical') || isSpyglassLensMode;

  return (
    <div
      ref={containerRef}
      className={
        className ||
        'relative w-full h-full bg-[#171817] overflow-hidden select-none'
      }
    >
      {/* Layer 1: Base Slippy Map Tiles Canvas */}
      <canvas
        ref={baseCanvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none select-none z-0"
      />

      {/* Layer 2: GPU-Composited 60FPS Synchronized Regional Spyglass Lens (0 React re-renders on mousemove) */}
      {isSpyglassLensMode && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
          {/* Circular clipped 1:1 coordinate-locked antique tile buffer */}
          <div
            ref={lensClipRef}
            className="absolute top-0 left-0 rounded-full overflow-hidden pointer-events-none"
            style={{ willChange: 'transform' }}
          >
            <canvas
              ref={lensBufferCanvasRef}
              className="absolute top-0 left-0 block pointer-events-none"
              style={{ willChange: 'transform' }}
            />
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, rgba(0,0,0,0) 68%, rgba(23,24,23,0.45) 100%)',
              }}
            />
          </div>

          {/* Outer dashed Heritage Gold optical rim */}
          <div
            ref={lensOuterRingRef}
            className="absolute top-0 left-0 rounded-full pointer-events-none"
            style={{
              border: '1.2px dashed rgba(201, 164, 106, 0.7)',
              willChange: 'transform',
            }}
          />

          {/* Inner solid Heritage Gold rim + glow */}
          <div
            ref={lensRingRef}
            className="absolute top-0 left-0 rounded-full pointer-events-none"
            style={{
              border: '2.8px solid #C9A46A',
              boxShadow: '0 0 18px rgba(201, 164, 106, 0.45)',
              willChange: 'transform',
            }}
          />

          {/* Precision optical crosshair */}
          <div
            ref={lensCrosshairRef}
            className="absolute top-0 left-0 w-9 h-9 pointer-events-none"
            style={{ willChange: 'transform' }}
          >
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <line x1="0" y1="18" x2="36" y2="18" stroke="rgba(201,164,106,0.5)" strokeWidth="0.9" />
              <line x1="18" y1="0" x2="18" y2="36" stroke="rgba(201,164,106,0.5)" strokeWidth="0.9" />
            </svg>
          </div>

          {/* Regional Era Pill on Lens Rim */}
          <div
            ref={lensPillRef}
            className="absolute top-0 left-0 h-[22px] px-3 rounded-full bg-[#F4EFE4] border border-[#171817]/30 flex items-center justify-center pointer-events-none whitespace-nowrap shadow-md"
            style={{ willChange: 'transform' }}
          >
            <span
              ref={lensPillTextRef}
              className="text-[11px] font-semibold text-[#171817] tracking-normal"
            />
          </div>
        </div>
      )}

      {/* Layer 3: Interactive Slippy Vector & Marker Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        className={`relative z-[2] w-full h-full block touch-none overscroll-contain select-none ${
          isPanning
            ? 'cursor-grabbing'
            : measureMode
            ? 'cursor-crosshair'
            : hoveredSite || hoveredCluster
            ? 'cursor-pointer'
            : 'cursor-grab'
        }`}
        style={{
          touchAction: 'none',
          overscrollBehavior: 'contain',
          userSelect: 'none',
        }}
      />

      {/* TOP-CENTER SINGLE HERITAGE PILL BAR: Bản đồ tối | Vệ tinh | Bản đồ lịch sử */}
      <div
        className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100vw-24px)] flex flex-col items-center gap-1.5 pointer-events-none"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-auto inline-flex items-center p-1 rounded-full bg-[#F4EFE4]/95 backdrop-blur-2xl border border-[#171817]/20 gap-1 shadow-lg"
          role="group"
          aria-label="Map View Mode Toggle"
        >
          {/* 1. Bản đồ tối */}
          <button
            type="button"
            onClick={() => {
              onChangeBaseMapMode('admin');
              setIsSpyglassLensMode(false);
              setIsSplitCompare(false);
            }}
            aria-pressed={baseMapMode === 'admin' && !isSpyglassLensMode}
            className={`h-7 px-3 sm:px-3.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              baseMapMode === 'admin' && !isSpyglassLensMode
                ? 'bg-[#A94F3D] text-[#D8C9A9] shadow-sm'
                : 'text-[#171817]/75 hover:text-[#171817] hover:bg-[#EDE4D0]'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5 shrink-0" />
            <span>
              {lang === 'zh' ? '暗色地图' : lang === 'en' ? 'Dark Map' : 'Bản đồ tối'}
            </span>
          </button>

          {/* 2. Vệ tinh */}
          <button
            type="button"
            onClick={() => {
              onChangeBaseMapMode('satellite');
              setIsSpyglassLensMode(false);
              setIsSplitCompare(false);
            }}
            aria-pressed={baseMapMode === 'satellite' && !isSpyglassLensMode}
            className={`h-7 px-3 sm:px-3.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              baseMapMode === 'satellite' && !isSpyglassLensMode
                ? 'bg-[#47796D] text-[#171817] shadow-sm'
                : 'text-[#171817]/75 hover:text-[#171817] hover:bg-[#EDE4D0]'
            }`}
          >
            <Satellite className="w-3.5 h-3.5 shrink-0" />
            <span>
              {lang === 'zh' ? '卫星' : lang === 'en' ? 'Satellite' : 'Vệ tinh'}
            </span>
          </button>

          {/* 3. Bản đồ lịch sử */}
          <button
            type="button"
            onClick={() => {
              const target = selectedSite || sites[0];
              const regional = getRegionalLensMeta(target?.id, lang);
              onChangeBaseMapMode(regional.layerMode);
              setIsSplitCompare(false);
              setIsSpyglassLensMode(true);
              lensPinnedToSiteRef.current = true;
              lastPinClientPosRef.current = null;
              trackPlatformInteraction('tech_map_1815', target?.id);
            }}
            aria-pressed={isHistoricalMode}
            className={`h-7 px-3 sm:px-3.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              isHistoricalMode
                ? 'bg-[#C9A46A] text-[#171817] shadow-sm'
                : 'text-[#171817]/75 hover:text-[#171817] hover:bg-[#EDE4D0]'
            }`}
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span>
              {lang === 'zh'
                ? '历史舆图'
                : lang === 'en'
                ? 'Historical Map'
                : 'Bản đồ lịch sử'}
            </span>
          </button>
        </div>

        {/* Compact Lens Tracking Mode Toggle right below top toolbar */}
        {isSpyglassLensMode && (
          <div className="pointer-events-auto inline-flex items-center p-0.5 rounded-full bg-[#F4EFE4]/95 backdrop-blur-2xl border border-[#171817]/20 shadow-lg gap-0.5">
            <button
              type="button"
              onClick={() => {
                setIsLensLocked(true);
                lensPinnedToSiteRef.current = true;
                lastPinClientPosRef.current = null;
              }}
              className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                isLensLocked
                  ? 'bg-[#C9A46A] text-[#171817]'
                  : 'text-[#171817]/75 hover:text-[#171817]'
              }`}
            >
              <Pin className="w-3 h-3 shrink-0" />
              <span>
                {lang === 'zh'
                  ? '锁定中心'
                  : lang === 'en'
                  ? 'Lock Center'
                  : 'Khóa tâm'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLensLocked(false);
                lensPinnedToSiteRef.current = false;
                lastPinClientPosRef.current = null;
              }}
              className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                !isLensLocked
                  ? 'bg-[#C9A46A] text-[#171817]'
                  : 'text-[#171817]/75 hover:text-[#171817]'
              }`}
            >
              <MousePointer2 className="w-3 h-3 shrink-0" />
              <span>
                {lang === 'zh'
                  ? '随鼠标探测'
                  : lang === 'en'
                  ? 'Follow Cursor'
                  : 'Soi theo chuột'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* TOP-LEFT QR HERITAGE PLAQUE SCANNER TRIGGER */}
      <div
        className="absolute top-14 sm:top-4 left-3 sm:left-4 z-20 pointer-events-none"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            setIsLayerMenuOpen(false);
            setIsQrScannerOpen(true);
          }}
          className="pointer-events-auto h-9 px-3 sm:px-3.5 rounded-full bg-[#F4EFE4]/95 hover:bg-[#EDE4D0] backdrop-blur-2xl border border-[#171817]/20 hover:border-[#A94F3D] text-[#171817] text-[11px] font-semibold flex items-center gap-1.5 shadow-lg transition-all cursor-pointer whitespace-nowrap"
          title={
            lang === 'zh'
              ? '扫描现场铭牌二维码，直达数字档案与语音导览'
              : lang === 'en'
              ? 'Scan physical heritage plaque QR to open dossier & audio guide'
              : 'Quét mã QR trên bia di tích để mở Hồ sơ & phát Thuyết minh'
          }
        >
          <QrCode className="w-3.5 h-3.5 text-[#A94F3D] shrink-0" />
          <span>
            {lang === 'zh'
              ? '扫描铭牌 QR'
              : lang === 'en'
              ? 'Scan Plaque QR'
              : 'Quét QR Di tích'}
          </span>
        </button>
      </div>

      {/* TOP-RIGHT UNIFIED STACK: Lớp bản đồ + Zoom (+ / -) & Locate */}
      <div
        className={`absolute top-14 sm:top-4 right-3 sm:right-4 flex flex-col items-end gap-2 pointer-events-none ${
          isLayerMenuOpen ? 'z-40' : 'z-20'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <LayerControlMenu
          embedded={true}
          baseMapMode={baseMapMode}
          onChangeBaseMapMode={(mode) => {
            onChangeBaseMapMode(mode);
            if (!mode.startsWith('historical')) {
              setIsSpyglassLensMode(false);
            }
          }}
          showDistricts={showDistricts}
          onToggleDistricts={() => setShowDistricts(!showDistricts)}
          showWaterways={showWaterways}
          onToggleWaterways={() => setShowWaterways(!showWaterways)}
          showProtectionZones={showProtectionZones}
          onToggleProtectionZones={() => setShowProtectionZones(!showProtectionZones)}
          measureMode={measureMode}
          onToggleMeasureMode={() => {
            setMeasureMode(!measureMode);
            setMeasurePointA(null);
            setMeasurePointB(null);
          }}
          isSplitCompare={isSplitCompare}
          onToggleSplitCompare={() => {
            const next = !isSplitCompare;
            setIsSplitCompare(next);
            if (next) setIsSpyglassLensMode(false);
          }}
          historicalOpacity={historicalOpacity}
          onChangeHistoricalOpacity={setHistoricalOpacity}
          isOpen={isLayerMenuOpen}
          onToggleOpen={setIsLayerMenuOpen}
        />

        {/* Compact Zoom (+ / -), Locate & Reset Dock */}
        <div className="pointer-events-auto flex flex-col rounded-2xl border border-[#171817]/20 bg-[#F4EFE4]/95 backdrop-blur-2xl divide-y divide-[#171817]/12 overflow-hidden shadow-lg">
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.min(18, prev + 0.5))}
            className="w-9 h-9 flex items-center justify-center text-[#171817] hover:text-[#A94F3D] hover:bg-[#EDE4D0] transition-colors cursor-pointer"
            title={lang === 'zh' ? '放大地图' : lang === 'en' ? 'Zoom in' : 'Phóng to'}
            aria-label={lang === 'zh' ? '放大地图' : lang === 'en' ? 'Zoom in' : 'Phóng to'}
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setZoom((prev) => Math.max(10, prev - 0.5))}
            className="w-9 h-9 flex items-center justify-center text-[#171817] hover:text-[#A94F3D] hover:bg-[#EDE4D0] transition-colors cursor-pointer"
            title={lang === 'zh' ? '缩小地图' : lang === 'en' ? 'Zoom out' : 'Thu nhỏ'}
            aria-label={lang === 'zh' ? '缩小地图' : lang === 'en' ? 'Zoom out' : 'Thu nhỏ'}
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    flyTo({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 16);
                  },
                  () => {
                    flyTo(HCMC_CENTER_WGS84, 16);
                  }
                );
              } else {
                flyTo(HCMC_CENTER_WGS84, 16);
              }
            }}
            className="w-9 h-9 flex items-center justify-center text-[#171817] hover:text-[#A94F3D] hover:bg-[#EDE4D0] transition-colors cursor-pointer"
            title={lang === 'zh' ? '定位我的当前位置' : lang === 'en' ? 'Locate my position' : 'Định vị vị trí hiện tại'}
          >
            <LocateFixed className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => flyTo(HCMC_CENTER_WGS84, DEFAULT_ZOOM)}
            className="w-9 h-9 flex items-center justify-center text-[#171817] hover:text-[#A94F3D] hover:bg-[#EDE4D0] transition-colors cursor-pointer"
            title={lang === 'zh' ? '返回西贡中心' : lang === 'en' ? 'Reset to Central Saigon' : 'Trở về trung tâm Sài Gòn'}
          >
            <Compass className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowCoordinates(!showCoordinates)}
            className={`w-9 h-9 flex items-center justify-center transition-colors cursor-pointer ${
              showCoordinates
                ? 'bg-[#C9A46A] text-[#171817]'
                : 'text-[#171817]/70 hover:text-[#A94F3D] hover:bg-[#EDE4D0]'
            }`}
            title={lang === 'zh' ? '显示/隐藏 WGS84 大地测量坐标' : lang === 'en' ? 'Toggle WGS84 geodesic coordinates' : 'Bật/Tắt tọa độ trắc địa WGS84'}
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        </div>

        {showCoordinates && (
          <div className="pointer-events-auto px-3 py-1 rounded-full bg-[#F4EFE4] border border-[#171817]/20 text-[11px] font-semibold text-[#171817] shadow-lg whitespace-nowrap tabular-nums">
            {formatWGS84(cursorWgs84)}
          </div>
        )}
      </div>

      {/* COLOR-BLOCKED MARKER POPUP CARD */}
      {activeTooltipSite && !showInspectorDrawer && containerRef.current && (() => {
        const tooltipMeta = getIndochineCategoryMeta(activeTooltipSite, lang);
        const tooltipBlock = getHeritageColorBlock(activeTooltipSite, lang);
        const locTooltipSite = getLocalizedSite(activeTooltipSite);
        const primaryPhotoUrl = activeTooltipSite.photos?.[0] || '';
        const hasValidPopupPhoto = Boolean(primaryPhotoUrl) && !popupImgFailed;
        const hasCustomGlb = Boolean(activeGlbSource.url);
        const showLiveGlbViewport = hasCustomGlb && popupMediaTab === 'glb';
        const isBaoDaiPalace = activeTooltipSite.id === 'BRVT-DT-001';
        const shouldShowGlbControls =
          isBaoDaiPalace || hasCustomGlb || showOtherSiteGlbControls;

        return (
          <div
            className={`absolute inset-x-3 bottom-3 sm:inset-auto sm:top-16 sm:right-16 z-30 flex justify-center ${
              popupSite ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="w-full sm:w-[348px] max-h-[82vh] overflow-y-auto rounded-[24px] bg-[#F4EFE4] border border-[#171817]/20 shadow-[0_24px_60px_rgba(23,24,23,0.32)] overflow-x-hidden flex flex-col animate-apple-sheet text-[#171817]">
              {/* Top Strip (Thematic Pigment) */}
              <div
                className="px-4 py-2.5 border-b border-[#171817]/15 flex items-center justify-between gap-2 shrink-0"
                style={{ backgroundColor: tooltipBlock.bg, color: tooltipBlock.fg }}
              >
                <span className="text-[12px] font-semibold truncate">
                  {tooltipMeta.badgeLabel}
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] opacity-80 tabular-nums">
                    {activeTooltipSite.identifierCode}
                  </span>
                  {popupSite && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setPopupSite(null);
                        onSelectSite(null);
                      }}
                      className="w-6 h-6 rounded-full bg-[#171817] hover:bg-[#171817]/80 text-[#D8C9A9] flex items-center justify-center cursor-pointer"
                      aria-label={t('map.popupClose')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Photo / Live 3D .GLB Interactive Stage */}
              <div
                className={`group relative w-full bg-[#171817] overflow-hidden border-b border-[#171817]/15 shrink-0 ${
                  showLiveGlbViewport ? 'h-48' : 'aspect-video'
                }`}
              >
                {showLiveGlbViewport && activeGlbSource.url ? (
                  <>
                    <GlbMiniStage
                      glbUrl={activeGlbSource.url}
                      lang={lang}
                      className="w-full h-full"
                    />
                    <div className="pointer-events-none absolute bottom-2 left-2.5 z-10 px-2 py-0.5 rounded-sm bg-[#171817] border border-[#C9A46A]/60 text-[10px] font-medium text-[#D8C9A9] max-w-[72%] truncate">
                      {activeGlbSource.kind === 'session_temp'
                        ? `Tạm RAM · ${activeGlbSource.fileName}`
                        : activeGlbSource.kind === 'indexeddb'
                        ? `IndexedDB · ${activeGlbSource.fileName}`
                        : `Cloud .GLB · ${activeGlbSource.fileName}`}
                    </div>
                  </>
                ) : hasValidPopupPhoto ? (
                  <>
                    <HeritageSmoothImage
                      src={primaryPhotoUrl}
                      alt={locTooltipSite.officialName}
                      loading="lazy"
                      waitTone="dark"
                      onError={() => setPopupImgFailed(true)}
                      className="w-full h-full object-cover object-center pointer-events-none"
                    />
                    <div className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-[#F4EFE4] border border-[#171817]/20 text-[11px] font-semibold text-[#171817] tabular-nums shadow-sm">
                      {activeTooltipSite.commencementYear || locTooltipSite.chronology.split('(')[0].trim()}
                    </div>
                  </>
                ) : (
                  <HeritageTypographicPlate site={activeTooltipSite} variant="catalog" />
                )}

                {/* Media View Toggle when custom .glb exists */}
                {hasCustomGlb && (
                  <div className="pointer-events-auto absolute top-2.5 right-2.5 z-10 inline-flex items-center rounded-sm bg-[#171817] border border-[#C9A46A]/50 overflow-hidden shadow-sm">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPopupMediaTab('glb');
                      }}
                      className={`px-2 py-1 text-[10px] font-semibold cursor-pointer transition-colors ${
                        popupMediaTab === 'glb'
                          ? 'bg-[#C9A46A] text-[#171817]'
                          : 'text-[#D8C9A9] hover:text-white'
                      }`}
                    >
                      3D .GLB
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPopupMediaTab('photo');
                      }}
                      className={`px-2 py-1 text-[10px] font-semibold cursor-pointer transition-colors ${
                        popupMediaTab === 'photo'
                          ? 'bg-[#C9A46A] text-[#171817]'
                          : 'text-[#D8C9A9] hover:text-white'
                      }`}
                    >
                      {lang === 'en' ? 'Photo' : lang === 'zh' ? '实景图' : 'Ảnh'}
                    </button>
                  </div>
                )}

                {onOpenPhotoManager && !showLiveGlbViewport && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPhotoManager(activeTooltipSite);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-full bg-[#F4EFE4] hover:bg-[#C9A46A] text-[#171817] border border-[#171817]/25 text-[10px] font-semibold cursor-pointer shadow-sm"
                  >
                    {lang === 'en'
                      ? 'Change Photo'
                      : lang === 'zh'
                      ? '更换实景图'
                      : 'Đổi ảnh thật'}
                  </button>
                )}
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3 text-left bg-[#F4EFE4]">
                <div>
                  <h4 className="font-serif text-base font-semibold text-[#171817] leading-snug line-clamp-2">
                    {locTooltipSite.officialName}
                  </h4>
                  {isBaoDaiPalace && (
                    <div className="text-[11px] font-medium text-[#A94F3D] mt-0.5">
                      Dinh Bảo Đại / Villa Blanche Vũng Tàu
                    </div>
                  )}
                  <div className="text-xs text-[#171817]/65 truncate mt-1">
                    {activeTooltipSite.address.street}, {formatDistrictName(activeTooltipSite.address.district)}
                  </div>
                </div>

                {/* IndexedDB Local .GLB & GitHub/Cloud Link Panel */}
                {popupSite && shouldShowGlbControls ? (
                  <div className="p-2.5 rounded-xl bg-[#EDE4D0] border border-[#171817]/15 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10.5px] font-semibold text-[#171817] flex items-center gap-1.5">
                        <Box className="w-3.5 h-3.5 text-[#A94F3D]" />
                        <span>
                          {isRamOnlyTester
                            ? lang === 'en'
                              ? 'Temp .GLB Test (RAM Only)'
                              : 'Thử nghiệm 3D (.glb · RAM tạm thời)'
                            : lang === 'en'
                            ? '3D Model (.GLB · IndexedDB)'
                            : 'Mô hình 3D (.glb · Lưu trình duyệt)'}
                        </span>
                      </span>
                      {hasCustomGlb && (!isRamOnlyTester || activeGlbSource.kind === 'session_temp') && (
                        <button
                          type="button"
                          onClick={() => void handleClearMapGlb(activeTooltipSite.id)}
                          className="text-[10px] font-semibold text-[#A94F3D] hover:underline flex items-center gap-0.5 cursor-pointer"
                          title={
                            activeGlbSource.kind === 'session_temp'
                              ? 'Gỡ tệp thử nghiệm tạm thời'
                              : 'Xóa file .glb đã lưu để về mặc định'
                          }
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{activeGlbSource.kind === 'session_temp' ? 'Gỡ tệp thử' : 'Xóa'}</span>
                        </button>
                      )}
                    </div>

                    <input
                      ref={glbFileInputRef}
                      type="file"
                      accept=".glb,.gltf,model/gltf-binary"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => void handleMapGlbFileChange(activeTooltipSite.id, e)}
                      className="hidden"
                    />

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => glbFileInputRef.current?.click()}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#171817] hover:bg-[#2a2b29] text-[#D8C9A9] text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#C9A46A] shrink-0" />
                        <span className="truncate">
                          {isRamOnlyTester ? 'Nạp thử tệp .glb cục bộ' : 'Chọn file .glb từ máy tính'}
                        </span>
                      </button>

                      {!isRamOnlyTester && (
                        <button
                          type="button"
                          onClick={() => setShowGlbLinkRow((prev) => !prev)}
                          className={`py-1.5 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shrink-0 ${
                            showGlbLinkRow
                              ? 'bg-[#C9A46A] text-[#171817] border-[#171817]/25'
                              : 'bg-[#F4EFE4] hover:bg-[#E4D7BC] text-[#171817] border-[#171817]/20'
                          }`}
                          title="Dán link .glb từ GitHub / Cloud"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Link</span>
                        </button>
                      )}
                    </div>

                    {!isRamOnlyTester && showGlbLinkRow && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="url"
                          value={glbLinkDraft}
                          onChange={(e) => setGlbLinkDraft(e.target.value)}
                          placeholder="Dán link .glb GitHub / Cloud (https://...)"
                          className="flex-1 h-8 px-2.5 rounded-lg bg-[#F4EFE4] border border-[#171817]/25 text-[11px] text-[#171817] placeholder:text-[#171817]/45 focus:outline-none focus:border-[#A94F3D]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveMapGlbUrl(activeTooltipSite.id)}
                          className="h-8 px-2.5 rounded-lg bg-[#47796D] hover:bg-[#3B665B] text-[#F4EFE4] text-[10.5px] font-semibold cursor-pointer shrink-0"
                        >
                          Lưu
                        </button>
                      </div>
                    )}

                    {hasCustomGlb && (
                      <div className="flex items-center gap-1.5 text-[10px] text-[#47796D] font-medium pt-0.5">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {activeGlbSource.kind === 'session_temp'
                            ? `Tạm RAM: ${activeGlbSource.fileName} (${formatGlbFileSize(activeGlbSource.fileSize)})`
                            : activeGlbSource.kind === 'indexeddb'
                            ? `IndexedDB: ${activeGlbSource.fileName} (${formatGlbFileSize(activeGlbSource.fileSize)})`
                            : `Link Cloud: ${activeGlbSource.fileName}`}
                        </span>
                      </div>
                    )}

                    {glbStatusNotice && (
                      <div
                        className={`text-[10px] font-medium leading-snug ${
                          glbStatusNotice.type === 'ok' ? 'text-[#47796D]' : 'text-[#A94F3D]'
                        }`}
                      >
                        {glbStatusNotice.text}
                      </div>
                    )}
                  </div>
                ) : popupSite && activeTooltipSite.has3D ? (
                  <button
                    type="button"
                    onClick={() => setShowOtherSiteGlbControls(true)}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-[#EDE4D0] hover:bg-[#E4D7BC] border border-[#171817]/15 text-[10.5px] font-semibold text-[#171817] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Upload className="w-3 h-3 text-[#A94F3D]" />
                    <span>
                      {isRamOnlyTester
                        ? 'Nạp thử tệp .glb cục bộ (RAM)'
                        : 'Chọn file .glb từ máy tính / Link Cloud'}
                    </span>
                  </button>
                ) : null}

                {/* Action Row */}
                <div className="pt-2.5 border-t border-[#171817]/15 flex items-center justify-between gap-2 text-[11px]">
                  {onOpenDetailModal && (
                    <button
                      type="button"
                      onClick={() => onOpenDetailModal(activeTooltipSite)}
                      className="font-semibold text-[#A94F3D] hover:underline transition-colors cursor-pointer"
                    >
                      {lang === 'zh' ? '查看档案 ↗' : lang === 'en' ? 'Full Dossier ↗' : 'Hồ sơ toàn văn ↗'}
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenARAudio(activeTooltipSite)}
                      className="px-2.5 py-1 rounded-full bg-[#47796D] hover:bg-[#3B665B] text-[#171817] text-[10.5px] font-semibold transition-colors cursor-pointer"
                    >
                      {lang === 'zh' ? '语音' : lang === 'en' ? 'Audio' : 'Thuyết minh'}
                    </button>
                    {onOpenVideo && (
                      <button
                        type="button"
                        onClick={() => onOpenVideo(activeTooltipSite)}
                        className="px-2.5 py-1 rounded-full bg-[#C9A46A] hover:bg-[#b89256] text-[#171817] text-[10.5px] font-semibold transition-colors cursor-pointer"
                      >
                        Video
                      </button>
                    )}
                    {activeTooltipSite.has3D && (
                      <button
                        type="button"
                        onClick={() => onOpen3D(activeTooltipSite)}
                        className="px-3 py-1 rounded-full bg-[#A94F3D] hover:bg-[#934232] text-[#D8C9A9] text-[10.5px] font-semibold transition-colors cursor-pointer"
                      >
                        3D ↗
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* HISTORICAL SPYGLASS DUAL COMPARISON DOCK */}
      {isSpyglassLensMode && (() => {
        const spyTarget =
          (activeMapHeritageId
            ? sites.find((s) => resolveHeritageVideoId(s.id) === activeMapHeritageId)
            : null) ||
          selectedSite ||
          sites[0];
        if (!spyTarget) return null;
        const locSpySite = getLocalizedSite(spyTarget);
        const modernSrc = !spyModernImgFailed ? (spyTarget.photos?.[0] || '') : '';

        const archiveMeta = getHistoricalArchiveForSite(spyTarget.id);
        const customHistSrc = getCustomHistoricalPhotoForSite(spyTarget.id);
        const histSrc = customHistSrc || (!histCardImgFailed ? (archiveMeta?.url || '') : '');
        const applyVintageFilter =
          !customHistSrc && Boolean(archiveMeta?.isFilteredArchival);
        const histFilterCss = applyVintageFilter
          ? archiveMeta?.filterCss || 'sepia(0.88) contrast(1.18) brightness(0.84)'
          : 'sepia(0.22) contrast(1.06) brightness(0.92)';

        const eraTag = archiveMeta?.eraTag || String(spyTarget.commencementYear || '1900');
        const histTitle =
          lang === 'en'
            ? archiveMeta?.titleEn || `${locSpySite.officialName} (${eraTag})`
            : lang === 'zh'
            ? `${locSpySite.officialName} (${eraTag})`
            : archiveMeta?.title || `${locSpySite.folkName || locSpySite.officialName} (${eraTag})`;

        const handleOpenComparison = () => {
          if (onOpenPastPresentSplit) {
            onOpenPastPresentSplit(spyTarget);
          }
        };

        return (
          <div
            className="hidden sm:flex absolute bottom-4 left-4 z-20 items-end gap-2.5 lg:gap-3 pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Card Left: 2026 • HIỆN TẠI */}
            <button
              type="button"
              onClick={handleOpenComparison}
              className="group text-left w-48 lg:w-56 bg-[#F4EFE4] rounded-[20px] border border-[#A94F3D] shadow-xl overflow-hidden transition-all cursor-pointer"
              title={
                lang === 'zh'
                  ? '点击打开全屏古今对比'
                  : lang === 'en'
                  ? 'Click to open fullscreen Past & Present comparison'
                  : 'Bấm để mở so sánh Xưa & Nay toàn màn hình'
              }
            >
              <div className="px-3 py-1 bg-[#A94F3D] text-[#D8C9A9] flex items-center justify-between text-[11px] font-semibold">
                <span>
                  {lang === 'zh'
                    ? '2026 · 现今实景'
                    : lang === 'en'
                    ? '2026 · Present'
                    : '2026 · Hiện tại'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Maximize2 className="w-2.5 h-2.5" />
                </span>
              </div>
              <div className="relative aspect-video w-full bg-[#171817] overflow-hidden">
                {modernSrc ? (
                  <HeritageSmoothImage
                    key={`spy-mod-${spyTarget.id}-${modernSrc.slice(0, 40)}`}
                    src={modernSrc}
                    alt={locSpySite.officialName}
                    loading="lazy"
                    waitTone="dark"
                    onError={() => setSpyModernImgFailed(true)}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-[opacity,transform] duration-500"
                  />
                ) : (
                  <HeritageTypographicPlate site={spyTarget} variant="catalog" />
                )}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 bg-[#171817]/55 flex items-center justify-center">
                  <span className="px-2.5 py-1 rounded-full bg-[#F4EFE4] border border-[#171817]/20 text-[10px] font-semibold text-[#171817]">
                    {lang === 'zh'
                      ? '古今对比 ↗'
                      : lang === 'en'
                      ? 'Past & Present ↗'
                      : 'So sánh Xưa & Nay ↗'}
                  </span>
                </div>
              </div>
              <div className="px-3 py-2 bg-[#F4EFE4]">
                <div className="text-xs font-semibold text-[#171817] truncate">
                  {locSpySite.officialName}
                </div>
              </div>
            </button>

            {/* Card Right: TƯ LIỆU CỔ */}
            <div className="group w-48 lg:w-56 bg-[#F4EFE4] rounded-[20px] border border-[#C9A46A] shadow-xl overflow-hidden transition-all">
              <div className="px-3 py-1 bg-[#C9A46A] text-[#171817] flex items-center justify-between text-[11px] font-semibold">
                <span className="truncate pr-1">
                  {lang === 'zh'
                    ? `${eraTag} · 历史档案`
                    : lang === 'en'
                    ? `${eraTag} · Archive`
                    : `${eraTag} · Tư liệu cổ`}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSpyglassLensMode(false);
                    onChangeBaseMapMode('admin');
                  }}
                  className="hover:underline cursor-pointer font-bold shrink-0"
                >
                  {lang === 'zh' ? '关闭 ✕' : lang === 'en' ? 'CLOSE ✕' : 'ĐÓNG ✕'}
                </button>
              </div>
              <button
                type="button"
                onClick={handleOpenComparison}
                className="w-full text-left cursor-pointer block"
              >
                <div className="relative aspect-video w-full bg-[#171817] overflow-hidden">
                  {histSrc ? (
                    <HeritageSmoothImage
                      key={`spy-hist-${spyTarget.id}-orig`}
                      src={histSrc}
                      alt={`${locSpySite.officialName} - ${eraTag}`}
                      loading="lazy"
                      waitTone="dark"
                      onError={() => {
                        if (!histCardImgFailed) {
                          setHistCardImgFailed(true);
                        }
                      }}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-[opacity,transform] duration-500"
                      style={{
                        filter: histFilterCss,
                      }}
                    />
                  ) : (
                    <HeritageTypographicPlate
                      site={spyTarget}
                      variant="archival"
                      titleOverride={histTitle}
                      badgeOverride={eraTag}
                      className="!p-2"
                    />
                  )}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 bg-[#171817]/55 flex items-center justify-center">
                    <span className="px-2.5 py-1 rounded-full bg-[#C9A46A] border border-[#171817]/25 text-[10px] font-semibold text-[#171817]">
                      {lang === 'zh'
                        ? '古今对比 ↗'
                        : lang === 'en'
                        ? 'Past & Present ↗'
                        : 'So sánh Xưa & Nay ↗'}
                    </span>
                  </div>
                </div>
                <div className="px-3 py-2 bg-[#F4EFE4]">
                  <div className="text-xs font-semibold text-[#A94F3D] truncate">
                    {histTitle}
                  </div>
                </div>
              </button>
            </div>
          </div>
        );
      })()}

      {/* HERITAGE PLAQUE QR CODE SCANNER OVERLAY */}
      <HeritageQrScannerOverlay
        isOpen={isQrScannerOpen}
        sites={sites}
        initialSelectedSite={selectedSite}
        onClose={() => setIsQrScannerOpen(false)}
        onScanMatched={(scannedSite) => {
          setIsQrScannerOpen(false);
          setPopupSite(scannedSite);
          onSelectSite(scannedSite);
          flyTo(scannedSite.gps, 16);
          if (onOpenDetailModal) {
            onOpenDetailModal(scannedSite);
          }
          if (onTriggerAudioGuide) {
            onTriggerAudioGuide(scannedSite);
          } else {
            onOpenARAudio(scannedSite);
          }
        }}
      />
    </div>
  );
};
