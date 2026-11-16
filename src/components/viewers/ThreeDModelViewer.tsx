import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HeritageSite } from '../../types/heritage';
import { HERITAGE_SITES } from '../../data/heritageSites';
import {
  DEFAULT_HERITAGE_3D_CONFIG,
  getSite3DTransform,
  saveSite3DTransform,
  resetSite3DTransform,
} from '../../data/heritage3DConfig';
import { VR360Viewer } from './VR360Viewer';
import {
  buildNewNineHeritageModel,
  NEW_NINE_LANDMARK_FEATURES,
  NEW_NINE_SITE_IDS,
  SUBSURFACE_CUTAWAY_SITE_IDS,
} from './heritage3DBuilders';
export const GLB_ONLY_SITE_IDS = new Set<string>(['HCM-DT-001', 'BRVT-DT-001']);
import { VirtualTourGuidePanel, GuideSubMode } from '../startup/VirtualTourGuidePanel';
import { StartupBookingModal } from '../startup/StartupBookingModal';
import { GeminiHeritageAssistant } from '../startup/GeminiHeritageAssistant';
import { useI18n } from '../../i18n/I18nContext';
import { useLabs } from '../../contexts/LabsContext';
import { HeritageTypographicPlate } from '../common/HeritageTypographicPlate';
import { HeritageSmoothImage } from '../common/HeritageSmoothImage';
import { getSitePhotoCaption } from '../../utils/wikimediaPhotoService';
import {
  LisboaDiagonalSplitOverlay,
  getChateauErasForSite,
} from '../spatial/MuseumHistoricalWidgets';
import {
  getToulouseBrickTextures,
  getMarseilleRoofTileTextures,
  getSpireFishscaleStoneTextures,
  getWeatheredLimestoneTextures,
} from '../../utils/proceduralPBRTextures';
import {
  MuseumLightingMode,
  MuseumEnvironmentRefs,
  createMuseumSkyDome,
  createStudioBronzeDust,
  createNightStarfield,
  createArchitecturalDioramaPlinth,
  applyMuseumEnvironmentPreset,
} from '../../utils/museumEnvironment3D';
import {
  RotateCw,
  Box,
  Compass,
  Info,
  Eye,
  Volume2,
  ChevronDown,
  Check,
  ShieldCheck,
  Bell,
  Film,
  Upload,
  Trash2,
} from 'lucide-react';

import {
  CMS_UPDATED_EVENT,
  loadCmsSiteOverrides,
  trackPlatformInteraction,
} from '../../utils/adminPlatformStore';
import { useAuth } from '../../contexts/AuthContext';
import {
  clearAllCustomGlbForSite,
  clearSessionTempGlb,
  formatGlbFileSize,
  saveGlbFileToIndexedDB,
  setSessionTempGlb,
  useSiteGlbSource,
} from '../../utils/glbModelStorage';
import { loadAndNormalizeGlb } from '../../utils/threeGlbLoader';

interface ThreeDModelViewerProps {
  site: HeritageSite;
  sites?: HeritageSite[];
  hiddenSiteIds?: string[];
  onClose?: () => void;
  onSelectSite?: (site: HeritageSite) => void;
  onUpdateCustomPhoto?: (siteId: string, photoDataUrl: string) => void;
  onRestoreDefaultPhoto?: (siteId: string) => void;
  isGettyLanding?: boolean;
  onOpenMapOverlay?: () => void;
  onOpenAudioModal?: (site: HeritageSite) => void;
  onOpenVideoModal?: (site: HeritageSite) => void;
  onOpenDetailModal?: (site: HeritageSite) => void;
  onOpenArchiveDrawer?: () => void;
  isPaused?: boolean;
  defaultLightingMode?: LightingMode;
  initialRenderMode?: RenderMode;
  initialExplodedFactor?: number;
  onNavigateToTickets?: () => void;
}

type RenderMode = 'textured' | 'wireframe' | 'xray';
type LightingMode = MuseumLightingMode;
type ViewTwinMode = '3d_cad_pbr' | 'real_field_360';

export interface ArchitecturalFeature {
  id: string;
  name: string;
  description: string;
  cameraPos: [number, number, number];
  targetPos: [number, number, number];
  thumbnailUrl: string;
}

export interface SpatialSpotlightState {
  position: [number, number, number];
  label?: string;
}

export interface MysteryRayClickEvent {
  hitPoint: [number, number, number];
  meshName: string;
  timestamp: number;
}

// Module-level Map cache for procedural CanvasTextures so switching landmarks is instantaneous (0ms redraw)
const landmarkTextureCache = new Map<string, any>();

export const ThreeDModelViewer: React.FC<ThreeDModelViewerProps> = ({
  site: initialSite,
  sites,
  hiddenSiteIds = [],
  onSelectSite,
  onUpdateCustomPhoto,
  onRestoreDefaultPhoto,
  isGettyLanding = true,
  onOpenAudioModal,
  onOpenVideoModal,
  onOpenDetailModal,
  isPaused = false,
  defaultLightingMode = 'studio',
  initialRenderMode = 'textured',
  initialExplodedFactor = 0,
  onNavigateToTickets,
}) => {
  const { lang, getLocalizedSite } = useI18n();
  const { isAdmin, isTesterPro } = useAuth();
  const canPreviewHidden = isAdmin || isTesterPro;
  const { effectiveGoldenHour3D, effectiveWireframeOverlay } = useLabs();
  const [cmsOverrides, setCmsOverrides] = useState(() => loadCmsSiteOverrides());
  const tempGlbInputRef = useRef<HTMLInputElement | null>(null);
  const directGlbInputRef = useRef<HTMLInputElement | null>(null);
  const [tempGlbNotice, setTempGlbNotice] = useState<string | null>(null);
  const [isSavingDirectGlb, setIsSavingDirectGlb] = useState<boolean>(false);
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState<boolean>(false);

  useEffect(() => {
    const onCmsUpdate = () => setCmsOverrides(loadCmsSiteOverrides());
    window.addEventListener(CMS_UPDATED_EVENT, onCmsUpdate);
    return () => window.removeEventListener(CMS_UPDATED_EVENT, onCmsUpdate);
  }, []);

  const [viewTwinMode, setViewTwinMode] = useState<ViewTwinMode>('3d_cad_pbr');
  const [currentSite, setCurrentSite] = useState<HeritageSite>(initialSite);
  const localizedCurrentSite = useMemo(
    () => getLocalizedSite(currentSite),
    [getLocalizedSite, currentSite]
  );
  const isCurrentModelHidden = cmsOverrides[currentSite.id]?.modelVisibility === 'hidden';
  const isCurrentSiteOrModelHidden =
    hiddenSiteIds.includes(currentSite.id) || isCurrentModelHidden;
  const [isUnderConstructionCardMinimized, setIsUnderConstructionCardMinimized] = useState<boolean>(false);
  const [isTourGuideOpen, setIsTourGuideOpen] = useState<boolean>(false);
  const [guideSubMode, setGuideSubMode] = useState<GuideSubMode>('autotour');
  const [autoStartTourCounter, setAutoStartTourCounter] = useState<number>(0);
  const [isGeminiAssistantOpen, setIsGeminiAssistantOpen] = useState<boolean>(false);
  const [isStartupBookingOpen, setIsStartupBookingOpen] = useState<boolean>(false);
  const [activeStartupRouteId, setActiveStartupRouteId] = useState<string | null>(null);
  const [notifiedSiteIds, setNotifiedSiteIds] = useState<Record<string, boolean>>({});
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState<boolean>(true);
  const [isEraMenuOpen, setIsEraMenuOpen] = useState<boolean>(false);

  // Toàn bộ 17 di tích đều đã hoàn thiện mô hình 3D PBR & Bóc tách nội thất chuyên biệt
  const UNDER_CONSTRUCTION_SITE_LABELS: Record<string, string> = {};

  const UNDER_CONSTRUCTION_REGIONAL_LINKS: Record<string, { subtitle: string; routeId: string; linkedText: string }> = {
    'HCM-DT-012': {
      subtitle: 'Kiến trúc Hội quán người Hoa Triều Châu (Đang phát triển)',
      routeId: 'TOUR-INTER-03',
      linkedText: 'Kết nối Tuyến 3: Văn Hóa Mở Cõi & Cổ Truyền Nam Bộ (TP.HCM - Bình Dương - BRVT)',
    },
    'HCM-DT-011': {
      subtitle: 'Tổ đình Phật giáo cổ nhất Sài Gòn 1744 (Đang phát triển)',
      routeId: 'TOUR-INTER-03',
      linkedText: 'Kết nối Tuyến 3: Văn Hóa Mở Cõi & Cổ Truyền Nam Bộ (Giồng Cá Vồ - Chùa Giác Lâm - Nhà Cổ Bình Dương - Nhà Lớn Long Sơn)',
    },
    'HCM-DT-010': {
      subtitle: 'Di chỉ khảo cổ mộ chum Tiền Óc Eo 2.000 năm (Đang phát triển)',
      routeId: 'TOUR-INTER-03',
      linkedText: 'Kết nối Tuyến 3: Văn Hóa Mở Cõi & Cổ Truyền Nam Bộ (Giồng Cá Vồ - Chùa Giác Lâm - Nhà Cổ Bình Dương - Nhà Lớn Long Sơn)',
    },
    'HCM-DT-008': {
      subtitle: 'Kiến trúc lăng miếu khảm sành sứ Gia Định (Đang phát triển)',
      routeId: 'TOUR-INTER-03',
      linkedText: 'Kết nối Tuyến Di sản Gia Định - Sài Gòn Xưa & Văn Hóa Mở Cõi Nam Bộ',
    },
    'BRVT-DT-001': {
      subtitle: 'Kiến trúc Pháp cổ trên núi Lớn (Đang hoàn thiện 3D)',
      routeId: 'TOUR-INTER-02',
      linkedText: 'Kết nối Tuyến 2: Dấu Ấn Kiến Trúc Pháp & Đông Dương (Bạch Dinh BRVT - Nhà Hát TP - Bảo Tàng Lịch Sử TP.HCM)',
    },
    'BRVT-DT-002': {
      subtitle: 'Kiến trúc cổ truyền gỗ Nam Bộ (Đang hoàn thiện 3D)',
      routeId: 'TOUR-INTER-03',
      linkedText: 'Kết nối Tuyến 3: Văn Hóa Mở Cõi & Cổ Truyền Nam Bộ (Giồng Cá Vồ - Chùa Giác Lâm - Nhà Cổ Bình Dương - Nhà Lớn Long Sơn)',
    },
    'BRVT-DT-003': {
      subtitle: 'Hệ thống địa đạo liên hoàn kết nối lịch sử với Địa đạo Củ Chi (Đang hoàn thiện 3D)',
      routeId: 'TOUR-INTER-01',
      linkedText: 'Kết nối Tuyến 1: Vành Đai Đỏ & Địa Đạo Chiến Tranh Lạnh (Củ Chi TP.HCM - Tam Giác Sắt Bình Dương - Long Phước BRVT)',
    },
    'BD-DT-001': {
      subtitle: 'Đỉnh cao kiến trúc nhà gỗ chạm khắc Nam Bộ (Đang hoàn thiện 3D)',
      routeId: 'TOUR-INTER-03',
      linkedText: 'Kết nối Tuyến 3: Văn Hóa Mở Cõi & Cổ Truyền Nam Bộ (Giồng Cá Vồ - Chùa Giác Lâm - Nhà Cổ Bình Dương - Nhà Lớn Long Sơn)',
    },
    'BD-DT-002': {
      subtitle: 'Mắt xích chiến lược nối liền Địa đạo Củ Chi (Đang hoàn thiện 3D)',
      routeId: 'TOUR-INTER-01',
      linkedText: 'Kết nối Tuyến 1: Vành Đai Đỏ & Địa Đạo Chiến Tranh Lạnh (Củ Chi TP.HCM - Tam Giác Sắt Bình Dương - Long Phước BRVT)',
    },
  };

  const isUnderConstructionSite = (siteId: string): boolean =>
    Boolean(UNDER_CONSTRUCTION_SITE_LABELS[siteId]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Mode & Lighting (Default: Studio or Admin Site Settings)
  const [renderMode, setRenderMode] = useState<RenderMode>(initialRenderMode);
  useEffect(() => {
    setRenderMode(initialRenderMode);
  }, [initialRenderMode]);
  const [lightingMode, setLightingMode] = useState<LightingMode>(() =>
    effectiveGoldenHour3D ? 'golden' : defaultLightingMode
  );
  const lightingModeRef = useRef<LightingMode>(lightingMode);
  lightingModeRef.current = lightingMode;
  useEffect(() => {
    setLightingMode(effectiveGoldenHour3D ? 'golden' : defaultLightingMode);
  }, [defaultLightingMode, effectiveGoldenHour3D]);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  // Model Loading State
  const { source: customGlbSource } = useSiteGlbSource(currentSite.id);
  const isGlbOnlySite = GLB_ONLY_SITE_IDS.has(currentSite.id);
  const [customGlbError, setCustomGlbError] = useState<string | null>(null);
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [glbLoadedReady, setGlbLoadedReady] = useState<boolean>(false);
  const [glbScale, setGlbScale] = useState<number>(() => getSite3DTransform(currentSite.id).scale);
  const [glbRotationY, setGlbRotationY] = useState<number>(
    () => getSite3DTransform(currentSite.id).rotationY
  );
  const [activeViewerPhotoIdx, setActiveViewerPhotoIdx] = useState<0 | 1>(0);
  const [viewerPhotoFailed, setViewerPhotoFailed] = useState<boolean>(false);

  const activeViewerPhoto =
    currentSite.photos?.[activeViewerPhotoIdx] ??
    (activeViewerPhotoIdx === 0 ? currentSite.photos?.[0] : '') ??
    '';

  useEffect(() => {
    setActiveViewerPhotoIdx(0);
    setViewerPhotoFailed(false);
  }, [currentSite.id]);

  useEffect(() => {
    setViewerPhotoFailed(false);
  }, [activeViewerPhotoIdx, activeViewerPhoto]);

  // Technical Tools
  const [isTechToolsOpen, setIsTechToolsOpen] = useState<boolean>(false);
  const [explodedFactor, setExplodedFactor] = useState<number>(initialExplodedFactor); // 0 to 1
  useEffect(() => {
    setExplodedFactor(initialExplodedFactor);
  }, [initialExplodedFactor]);
  const [activeFloor, setActiveFloor] = useState<'all' | 'roof' | 'upper' | 'ground'>('all');
  const [sectionCutActive, setSectionCutActive] = useState<boolean>(false);
  const [sectionHeight, setSectionHeight] = useState<number>(12);
  const [showHotspots, setShowHotspots] = useState<boolean>(true);
  const [showCreditsModal, setShowCreditsModal] = useState<boolean>(false);
  const [cameraPreset, setCameraPreset] = useState<'iso' | 'front' | 'top'>('iso');

  // Hotspots & Camera
  const [activeFeature, setActiveFeature] = useState<ArchitecturalFeature | null>(null);
  const [hotspotScreenPos, setHotspotScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // ✨ Apple 3D Scrollytelling (Cuộn Giải Phẫu Không Gian) Mode & 4 Story Stages
  const [isScrollytellingMode, setIsScrollytellingMode] = useState<boolean>(false);
  const [scrollyStageIndex, setScrollyStageIndex] = useState<number>(0); // 0..3
  const lastWheelStepTimeRef = useRef<number>(0);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const mainGroupRef = useRef<THREE.Group | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const glbRootRef = useRef<THREE.Object3D | null>(null);
  const glbScaleRef = useRef<number>(1);
  const glbRotationYRef = useRef<number>(0);
  glbScaleRef.current = glbScale;
  glbRotationYRef.current = glbRotationY;
  const fountainParticlesRef = useRef<THREE.Points | null>(null);
  const targetExplodedRef = useRef<number>(0);
  const currentExplodedRef = useRef<number>(0);
  const clipPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, -1, 0), 12));
  const renderModeRef = useRef<RenderMode>('textured');
  renderModeRef.current = renderMode;
  const interiorRevealTargetRef = useRef<number>(0);
  const interiorRevealCurrentRef = useRef<number>(0);
  const interiorRevealForceSyncRef = useRef<boolean>(false);
  const lightsRef = useRef<{
    dirLight: THREE.DirectionalLight;
    backDirLight: THREE.DirectionalLight;
    ambient: THREE.AmbientLight;
    hemiLight: THREE.HemisphereLight;
    nightSpots: THREE.SpotLight[];
  } | null>(null);
  const museumEnvRef = useRef<MuseumEnvironmentRefs | null>(null);
  const activeFeatureRef = useRef<ArchitecturalFeature | null>(null);
  const isThreeJsVisibleRef = useRef<boolean>(false);
  const lastHotspotPosRef = useRef<{ x: number; y: number; visible: boolean }>({ x: -9999, y: -9999, visible: false });

  // Château d'Amboise 3D Spatial HUD, Lisboa Romana Split, X-Ray Crown Orbit & Multi-Layer GIS states
  const [isLisboaSplitOpen, setIsLisboaSplitOpen] = useState<boolean>(false);
  const [selectedEraIndex, setSelectedEraIndex] = useState<number>(3);
  const azimuthSpanRef = useRef<HTMLSpanElement | null>(null);
  const lastAzimuthRoundedRef = useRef<number>(-999);
  const isRenderPausedRef = useRef<boolean>(false);
  const ensureAnimateRunningRef = useRef<(() => void) | null>(null);
  const [isCrownOrbitActive] = useState<boolean>(false);
  const crownOrbitGroupRef = useRef<THREE.Group | null>(null);
  const [projectedBadges, setProjectedBadges] = useState<
    Array<{ id: string; x: number; y: number; feat: ArchitecturalFeature }>
  >([]);
  const lastBadgeProjectionTimeRef = useRef<number>(0);
  const featuresRef = useRef<ArchitecturalFeature[]>([]);
  const mouseParallaxRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });
  const isUserDraggingRef = useRef<boolean>(false);

  // Spatial Living Docent: 3D Spotlight + Laser Ring + Raycaster Mystery Mode
  const [spatialSpotlight, setSpatialSpotlight] = useState<SpatialSpotlightState | null>(null);
  const spatialSpotlightRef = useRef<SpatialSpotlightState | null>(null);
  spatialSpotlightRef.current = spatialSpotlight;
  const [isMysteryModeActive, setIsMysteryModeActive] = useState<boolean>(false);
  const isMysteryModeActiveRef = useRef<boolean>(false);
  isMysteryModeActiveRef.current = isMysteryModeActive;
  const [mysteryRayClickEvent, setMysteryRayClickEvent] = useState<MysteryRayClickEvent | null>(null);
  const baseLightIntensitiesRef = useRef<{
    ambient: number;
    hemi: number;
    dir: number;
    backDir: number;
  }>({ ambient: 0.62, hemi: 0.78, dir: 1.55, backDir: 1.15 });

  useEffect(() => {
    activeFeatureRef.current = activeFeature;
    lastHotspotPosRef.current = { x: -9999, y: -9999, visible: false };
  }, [activeFeature]);

  useEffect(() => {
    const threeVisible = viewTwinMode === '3d_cad_pbr';
    isThreeJsVisibleRef.current = threeVisible;
    const shouldPause =
      isPaused ||
      !threeVisible ||
      isLisboaSplitOpen ||
      showCreditsModal ||
      isStartupBookingOpen ||
      (typeof document !== 'undefined' && document.visibilityState === 'hidden');
    isRenderPausedRef.current = shouldPause;
    if (!shouldPause) {
      ensureAnimateRunningRef.current?.();
    }
  }, [
    isPaused,
    viewTwinMode,
    isLisboaSplitOpen,
    showCreditsModal,
    isStartupBookingOpen,
  ]);

  // Landmark Dropdown Menu state & click outside listener (synced between bottom dock & top-left badge)
  const [isSiteDropdownOpen, setIsSiteDropdownOpen] = useState<boolean>(false);
  const [siteDropdownAnchor, setSiteDropdownAnchor] = useState<'bottom' | 'top'>('bottom');
  const siteDropdownRef = useRef<HTMLDivElement>(null);
  const topSiteDropdownRef = useRef<HTMLDivElement>(null);

  const allSites = useMemo(() => (sites && sites.length > 0 ? sites : HERITAGE_SITES), [sites]);
  const currentSiteIndex = useMemo(() => {
    const idx = allSites.findIndex((s) => s.id === currentSite.id);
    return idx >= 0 ? idx : 0;
  }, [allSites, currentSite.id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideBottom = siteDropdownRef.current?.contains(target) ?? false;
      const isInsideTop = topSiteDropdownRef.current?.contains(target) ?? false;
      if (!isInsideBottom && !isInsideTop) {
        setIsSiteDropdownOpen(false);
      }
    };
    if (isSiteDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isSiteDropdownOpen]);

  // ESC key listener for fullscreen, dropdown, and modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSiteDropdownOpen) setIsSiteDropdownOpen(false);
        else if (showCreditsModal) setShowCreditsModal(false);
        else if (isTechToolsOpen) setIsTechToolsOpen(false);
        else if (isFullscreen) setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, isTechToolsOpen, showCreditsModal, isSiteDropdownOpen]);

  // Features list based on landmark — always 6 Getty Teardrop Pin stations (1..6) localized for VI/EN/ZH
  const features: ArchitecturalFeature[] = useMemo(() => {
    const rawBase = getLandmarkFeatures(currentSite.id);
    const locHotspots = localizedCurrentSite.hotspots || [];
    const base = rawBase.map((feat, idx) => {
      const matchedHotspot =
        locHotspots.find((h) => h.id === feat.id) || locHotspots[idx];
      if (matchedHotspot) {
        return {
          ...feat,
          name: matchedHotspot.name,
          description: matchedHotspot.description,
        };
      }
      return feat;
    });
    if (base.length >= 6) return base.slice(0, 6);
    const siteTitle = localizedCurrentSite.officialName;
    const fallbackPresets: Array<{
      suffix: string;
      name: string;
      desc: string;
      cam: [number, number, number];
      target: [number, number, number];
    }> = [
      {
        suffix: 'g1',
        name:
          lang === 'en'
            ? 'Forecourt Plaza & Ceremonial Axis'
            : lang === 'zh'
            ? '前庭广场与礼仪中轴线'
            : 'Quảng Trường & Cảnh Quan Tiền Đường',
        desc:
          lang === 'en'
            ? `Landscaped lawns, flower parterres, and the ceremonial axis leading to the main facade of ${siteTitle}.`
            : lang === 'zh'
            ? `通往 ${siteTitle} 主立面的礼仪轴线、园林草坪与前庭景观空间。`
            : `Không gian cảnh quan thảm cỏ, bồn hoa và trục thần đạo dẫn vào mặt đứng chính của ${siteTitle}.`,
        cam: [20, 11, 28],
        target: [7.5, 1.8, 13.5],
      },
      {
        suffix: 'g2',
        name:
          lang === 'en'
            ? 'Roof Structure & Architectural Crown'
            : lang === 'zh'
            ? '屋顶结构与建筑塔冠'
            : 'Cấu Trúc Mái & Đỉnh Chóp Kiến Trúc',
        desc:
          lang === 'en'
            ? `Classical roof trusses and central crown geometry defining the unmistakable silhouette of ${siteTitle}.`
            : lang === 'zh'
            ? `构成 ${siteTitle} 标志性天际轮廓的传统屋顶桁架与中央穹顶构造。`
            : `Hệ kết cấu mái ngói cổ điển và đỉnh vòm trung tâm tạo nên đường nét kiến trúc đặc trưng của ${siteTitle}.`,
        cam: [-18, 21, 22],
        target: [1.8, 12.2, -2.5],
      },
      {
        suffix: 'g3',
        name:
          lang === 'en'
            ? 'East Wing Veranda & Tropical Louvers'
            : lang === 'zh'
            ? '东翼回廊与热带百叶通风窗'
            : 'Hành Lang Cánh Đông & Hệ Cửa Thông Gió',
        desc:
          lang === 'en'
            ? 'Arched verandas and tropical louvered shutters regulating natural airflow along the eastern flank.'
            : lang === 'zh'
            ? '东侧拱廊与热带百叶窗系统，实现自然的微气候通风与遮阳降温。'
            : 'Dãy hành lang vòm cuốn và hệ cửa lá sách nhiệt đới giúp điều hòa vi khí hậu tự nhiên bên hông Đông công trình.',
        cam: [25, 12, 14],
        target: [12.5, 5.2, 2.5],
      },
      {
        suffix: 'g4',
        name:
          lang === 'en'
            ? 'West Wing Colonnade & Load-Bearing Pillars'
            : lang === 'zh'
            ? '西翼柱廊与承重立柱'
            : 'Hành Lang Cánh Tây & Trụ Cột Chịu Lực',
        desc:
          lang === 'en'
            ? 'Symmetrical load-bearing columns and ornamental moldings along the western wing.'
            : lang === 'zh'
            ? '西翼对称分布的承重立柱与精美线脚装饰，体现当时的营造工艺水准。'
            : 'Hệ cột chịu lực và phào chỉ nghệ thuật đối xứng ở cánh Tây, phản ánh kỹ thuật xây dựng đương thời.',
        cam: [-25, 12, 14],
        target: [-12.5, 5.2, 2.5],
      },
      {
        suffix: 'g5',
        name:
          lang === 'en'
            ? 'Rear Sanctuary & Heritage Grounds'
            : lang === 'zh'
            ? '后殿空间与古树园林'
            : 'Không Gian Hậu Đường & Khuôn Viên Xanh',
        desc:
          lang === 'en'
            ? 'Rear architectural ensemble framed by warm sandstone terraces and century-old heritage trees.'
            : lang === 'zh'
            ? '建筑群后方与暖色砂岩台地及百年古树群落相融的静谧园林空间。'
            : 'Mặt hậu của quần thể kiến trúc gắn liền với nền đồi đá sa thạch ấm và hàng cây cổ thụ bao bọc xung quanh di tích.',
        cam: [-18, 15, -26],
        target: [-8.5, 4.2, -9.5],
      },
      {
        suffix: 'g6',
        name:
          lang === 'en'
            ? 'Foundation Plinth & Preserved Stratum'
            : lang === 'zh'
            ? '基座台明与地层保护结构'
            : 'Tầng Nền & Kết Cấu Địa Tầng Bảo Tồn',
        desc:
          lang === 'en'
            ? `Historic stone foundation plinth, stepped entrance, and preserved load-bearing stratum of ${siteTitle}.`
            : lang === 'zh'
            ? `${siteTitle} 原貌保存的石砌基座、踏步台阶与地下承重地层结构。`
            : `Hệ thống nền móng đá cổ, bậc tam cấp và kết cấu chịu lực bảo tồn nguyên trạng của ${siteTitle}.`,
        cam: [18, 14, -24],
        target: [8.5, 2.8, -8.5],
      },
    ];
    const result = [...base];
    let presetIdx = 0;
    while (result.length < 6 && presetIdx < fallbackPresets.length) {
      const p = fallbackPresets[presetIdx++];
      result.push({
        id: `f_${result.length + 1}_${p.suffix}`,
        name: p.name,
        description: p.desc,
        cameraPos: p.cam,
        targetPos: p.target,
        thumbnailUrl: '',
      });
    }
    return result.slice(0, 6);
  }, [currentSite.id, localizedCurrentSite, lang]);

  useEffect(() => {
    featuresRef.current = features;
  }, [features]);

  // Switch landmark handler
  const handleSwitchLandmark = (newSite: HeritageSite) => {
    setCurrentSite(newSite);
    setActiveFeature(null);
    setSpatialSpotlight(null);
    setIsMysteryModeActive(false);
    setMysteryRayClickEvent(null);
    setExplodedFactor(0);
    setActiveFloor('all');
    setSectionCutActive(false);
    setIsUnderConstructionCardMinimized(false);
    setAutoRotate(isUnderConstructionSite(newSite.id));
    if (onSelectSite) onSelectSite(newSite);
  };

  const handlePrevSite = () => {
    const prevIndex = (currentSiteIndex - 1 + allSites.length) % allSites.length;
    handleSwitchLandmark(allSites[prevIndex]);
    setIsSiteDropdownOpen(false);
  };

  const handleNextSite = () => {
    const nextIndex = (currentSiteIndex + 1) % allSites.length;
    handleSwitchLandmark(allSites[nextIndex]);
    setIsSiteDropdownOpen(false);
  };

  useEffect(() => {
    setCurrentSite(initialSite);
    setActiveFeature(null);
    setSpatialSpotlight(null);
    setIsMysteryModeActive(false);
    setMysteryRayClickEvent(null);
    setExplodedFactor(0);
    setActiveFloor('all');
    setSectionCutActive(false);
    setIsUnderConstructionCardMinimized(false);
    setAutoRotate(isUnderConstructionSite(initialSite.id));
  }, [initialSite]);

  // Helper to recalculate renderer & camera dimensions and force render
  const updateThreeDimensions = useCallback(() => {
    if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
    const container = containerRef.current;
    const w = container.clientWidth || container.parentElement?.clientWidth || window.innerWidth;
    const h = container.clientHeight || container.parentElement?.clientHeight || window.innerHeight;
    if (w > 0 && h > 0) {
      rendererRef.current.setSize(w, h, true);
      cameraRef.current.aspect = w / h;
      cameraRef.current.clearViewOffset();
      cameraRef.current.updateProjectionMatrix();
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      if (sceneRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    }
  }, []);

  // Helper to reset Three.js camera view and immediately recalculate renderer & camera dimensions
  const switchToThreeJs = useCallback((targetRenderMode?: RenderMode) => {
    if (targetRenderMode) {
      setRenderMode(targetRenderMode);
    }
    // Ensure initial view faces the grand Main Front Facade (+Z)
    if (cameraRef.current && controlsRef.current) {
      if (currentSite.id === 'HCM-DT-005') {
        cameraRef.current.position.set(20, 16, 40);
        controlsRef.current.target.set(0, 10, 4);
      } else if (currentSite.id === 'HCM-DT-002') {
        cameraRef.current.position.set(0, 13, 35);
        controlsRef.current.target.set(0, 6, 0);
      } else if (currentSite.id === 'HCM-DT-006') {
        cameraRef.current.position.set(0, 11, 34);
        controlsRef.current.target.set(0, 5, 0);
      } else if (currentSite.id === 'HCM-DT-009' || currentSite.id === 'BRVT-DT-003' || currentSite.id === 'BD-DT-002') {
        cameraRef.current.position.set(22, 16, 26);
        controlsRef.current.target.set(0, 2, 0);
      } else if (currentSite.id === 'HCM-DT-010') {
        cameraRef.current.position.set(20, 14, 24);
        controlsRef.current.target.set(0, 0.8, 1.5);
      } else if (currentSite.id === 'BRVT-DT-001') {
        cameraRef.current.position.set(22, 16, 28);
        controlsRef.current.target.set(0, 6.5, -1.5);
      } else {
        const cfg = DEFAULT_HERITAGE_3D_CONFIG[currentSite.id];
        if (cfg) {
          cameraRef.current.position.set(...cfg.cameraPos);
          controlsRef.current.target.set(...cfg.cameraTarget);
        } else {
          cameraRef.current.position.set(24, 18, 28);
          controlsRef.current.target.set(0, 4.5, 0);
        }
      }
      controlsRef.current.update();
    }
    // Update immediately and schedule follow-ups across ticks to guarantee canvas is sized correctly
    updateThreeDimensions();
    requestAnimationFrame(updateThreeDimensions);
    const t1 = setTimeout(updateThreeDimensions, 30);
    const t2 = setTimeout(updateThreeDimensions, 100);
    const t3 = setTimeout(updateThreeDimensions, 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [updateThreeDimensions, currentSite.id]);

  // Ensure Three.js resize is executed whenever 3D view is active
  useEffect(() => {
    if (viewTwinMode === '3d_cad_pbr') {
      updateThreeDimensions();
      const rId = requestAnimationFrame(updateThreeDimensions);
      const t1 = setTimeout(updateThreeDimensions, 50);
      const t2 = setTimeout(updateThreeDimensions, 200);
      return () => {
        cancelAnimationFrame(rId);
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [viewTwinMode, updateThreeDimensions]);

  // =========================================================================
  // MAIN THREE.JS SETUP & ORBITCONTROLS LIFECYCLE
  // =========================================================================
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || containerRef.current.parentElement?.clientWidth || window.innerWidth || 800;
    const height = containerRef.current.clientHeight || containerRef.current.parentElement?.clientHeight || window.innerHeight || 600;

    setIsLoadingModel(true);
    setLoadingProgress(25);

    // 1. Scene setup — Seamless Infinite Sky Dome + Horizon FogExp2
    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.FogExp2(0x181715, 0.0024);
    sceneRef.current = scene;

    const { mesh: skyDomeMesh, uniforms: skyUniforms } = createMuseumSkyDome();
    scene.add(skyDomeMesh);

    const studioDust = createStudioBronzeDust(120);
    scene.add(studioDust);

    const nightStars = createNightStarfield(240);
    scene.add(nightStars);

    // 2. Camera setup — Isometric / Aerial Bird's-eye Diorama View
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    const defaultCamCfg = DEFAULT_HERITAGE_3D_CONFIG[currentSite.id];
    if (defaultCamCfg) {
      camera.position.set(...defaultCamCfg.cameraPos);
      camera.lookAt(...defaultCamCfg.cameraTarget);
    } else {
      camera.position.set(26, 21, 35);
      camera.lookAt(0, 4.5, 0);
    }
    cameraRef.current = camera;

    // 3. Renderer setup with adaptive pixel ratio (capped at 1.5, or 1.25 on slow network)
    const isSlowConnection =
      typeof navigator !== 'undefined' &&
      (('connection' in navigator && (navigator as any).connection?.saveData) ||
        ['slow-2g', '2g', '3g'].includes((navigator as any).connection?.effectiveType));

    const targetPixelRatio = isSlowConnection
      ? Math.min(window.devicePixelRatio || 1, 1.25)
      : Math.min(window.devicePixelRatio || 1, 1.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(targetPixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.localClippingEnabled = true;
    rendererRef.current = renderer;

    // Apple Studio PBR Environment Reflections via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Attach to DOM
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // Apply strict viewport constraints: no touch scroll, contain overscroll, grab cursor
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.overscrollBehavior = 'contain';
    renderer.domElement.style.userSelect = 'none';
    renderer.domElement.style.cursor = 'grab';

    // Intercept wheel on canvas directly with non-passive listener to zoom model without scrolling page
    const handleDomWheel = (e: WheelEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('wheel', handleDomWheel, { passive: false });
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    // 4. OrbitControls with angle limits, smooth damping & two-finger gestures
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.03; // Cannot flip upside down or look from under floor
    controls.minPolarAngle = 0.08; // Cannot flip over top zenith
    controls.minDistance = 6;
    controls.maxDistance = 140;
    const defaultTargetCfg = DEFAULT_HERITAGE_3D_CONFIG[currentSite.id];
    if (defaultTargetCfg) {
      controls.target.set(...defaultTargetCfg.cameraTarget);
    } else {
      controls.target.set(0, 5, 0);
    }
    controls.update();
    controls.saveState();

    // Multi-touch gestures: single-finger rotate, two-finger pinch-zoom & pan
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    controls.addEventListener('start', () => {
      isUserDraggingRef.current = true;
      controls.autoRotate = false;
      setAutoRotate(false);
      renderer.domElement.style.cursor = 'grabbing';
      if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    });
    controls.addEventListener('end', () => {
      isUserDraggingRef.current = false;
      renderer.domElement.style.cursor = 'grab';
      if (containerRef.current) containerRef.current.style.cursor = 'grab';
    });

    // Respect prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      controls.autoRotate = false;
      setAutoRotate(false);
    } else {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35;
    }
    controlsRef.current = controls;

    // 5. Museum Exhibition 3-Point Lighting + 4 Architectural Night Uplights
    const isDeepTunnel =
      currentSite.id === 'HCM-DT-009' ||
      currentSite.id === 'BRVT-DT-003' ||
      currentSite.id === 'BD-DT-002';
    const stageBaseY = isDeepTunnel ? -6.05 : currentSite.id === 'HCM-DT-010' ? -2.85 : 0;

    const ambient = new THREE.AmbientLight(0xf5ead8, 0.62);
    scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight(0xd8c7a8, 0x1c1a17, 0.78);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff6ea, 1.55);
    dirLight.position.set(32, 38, 32);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.radius = 2.2;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.045;
    dirLight.shadow.camera.near = 1.0;
    dirLight.shadow.camera.far = 135;
    const shadowD = 36;
    dirLight.shadow.camera.left = -shadowD;
    dirLight.shadow.camera.right = shadowD;
    dirLight.shadow.camera.top = shadowD;
    dirLight.shadow.camera.bottom = -shadowD;
    scene.add(dirLight);

    // Champagne Gold Rim Light highlighting roofs & architectural contours
    const backDirLight = new THREE.DirectionalLight(0xe5c787, 1.15);
    backDirLight.position.set(-26, 26, -38);
    scene.add(backDirLight);

    // Subtle Grazing Architectural Rim Light
    const studioRimLight = new THREE.DirectionalLight(0xd8e2ef, 0.45);
    studioRimLight.position.set(-34, 16, 18);
    scene.add(studioRimLight);

    // 4 Warm Architectural Uplights (#FFCF75) from base perimeter for Đêm Di Sản mode
    const nightSpots: THREE.SpotLight[] = [];
    const uplightCoords: [number, number][] = [
      [16, 16],
      [-16, 16],
      [16, -16],
      [-16, -16],
    ];
    uplightCoords.forEach(([ux, uz]) => {
      const spot = new THREE.SpotLight(0xffcf75, 0, 52, Math.PI / 3.4, 0.65, 1.15);
      spot.position.set(ux, stageBaseY + 0.85, uz);
      spot.target.position.set(0, stageBaseY + 7.5, 0);
      scene.add(spot);
      scene.add(spot.target);
      nightSpots.push(spot);
    });

    lightsRef.current = { dirLight, backDirLight, ambient, hemiLight, nightSpots };

    // 6. Multi-Tier Architectural Diorama Plinth with Brushed Bronze Rim (#C5A059) & B-Đ-N-T Compass Rose
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const plinth = createArchitecturalDioramaPlinth(
      stageBaseY,
      maxAniso,
      false
    );
    const dioramaTerrainGroup = plinth.group;
    scene.add(dioramaTerrainGroup);

    const envRefs: MuseumEnvironmentRefs = {
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
    };
    museumEnvRef.current = envRefs;
    applyMuseumEnvironmentPreset(lightingModeRef.current, scene, envRefs);
    baseLightIntensitiesRef.current = {
      ambient: ambient.intensity,
      hemi: hemiLight.intensity,
      dir: dirLight.intensity,
      backDir: backDirLight.intensity,
    };

    // 6B. Spatial Docent Gold Spotlight + Laser Ring Rig (for AI guided focus)
    const spatialSpotLight = new THREE.SpotLight(0xffe1a8, 0, 85, Math.PI / 7.5, 0.55, 1.0);
    const spatialSpotTarget = new THREE.Object3D();
    scene.add(spatialSpotLight);
    scene.add(spatialSpotTarget);
    spatialSpotLight.target = spatialSpotTarget;

    const spatialRigGroup = new THREE.Group();
    spatialRigGroup.visible = false;
    spatialRigGroup.renderOrder = 22;

    const haloOuterMat = new THREE.MeshBasicMaterial({
      color: 0xc5a059,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const haloOuterRing = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.32, 48), haloOuterMat);
    haloOuterRing.rotation.x = -Math.PI / 2;
    spatialRigGroup.add(haloOuterRing);

    const haloTiltRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.18, 48),
      haloOuterMat.clone()
    );
    spatialRigGroup.add(haloTiltRing);

    const haloInnerMat = new THREE.MeshBasicMaterial({
      color: 0xfff0cc,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const haloInnerRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.48, 32), haloInnerMat);
    haloInnerRing.rotation.x = -Math.PI / 2;
    spatialRigGroup.add(haloInnerRing);

    const laserBeamMat = new THREE.MeshBasicMaterial({
      color: 0xc5a059,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const laserBeamMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.44, 13.5, 18, 1, true),
      laserBeamMat
    );
    laserBeamMesh.position.y = 6.75;
    spatialRigGroup.add(laserBeamMesh);
    scene.add(spatialRigGroup);

    // Transient 3D click ripple ring for Mystery Mode raycaster feedback
    const mysteryPingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const mysteryPingMesh = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.56, 32), mysteryPingMat);
    mysteryPingMesh.visible = false;
    mysteryPingMesh.renderOrder = 25;
    scene.add(mysteryPingMesh);
    let mysteryPingTimer = 0;

    // 6C. Raycaster click handler for "Thử thách Giải mã Kiến trúc"
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const localHitVec = new THREE.Vector3();
    let pointerDownX = 0;
    let pointerDownY = 0;

    const handleCanvasPointerDown = (ev: PointerEvent) => {
      pointerDownX = ev.clientX;
      pointerDownY = ev.clientY;
    };

    const handleCanvasPointerUp = (ev: PointerEvent) => {
      if (!isMysteryModeActiveRef.current || !meshGroupRef.current) return;
      if (Math.hypot(ev.clientX - pointerDownX, ev.clientY - pointerDownY) > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(meshGroupRef.current.children, true);

      const validHit = hits.find((h) => {
        let obj: THREE.Object3D | null = h.object;
        if (
          obj.userData?.isGround ||
          obj.userData?.isGrid ||
          obj.userData?.isLabsWireframeOverlay
        )
          return false;
        while (obj) {
          if (!obj.visible) return false;
          obj = obj.parent;
        }
        return true;
      });

      if (!validHit) return;

      // Show brief 3D ping ring right where user clicked
      mysteryPingMesh.position.copy(validHit.point);
      mysteryPingMesh.lookAt(camera.position);
      mysteryPingMesh.scale.setScalar(1);
      mysteryPingMesh.visible = true;
      mysteryPingTimer = 1.0;

      // Convert hit point to local model coordinates & normalize out exploded Y lift
      localHitVec.copy(validHit.point);
      meshGroupRef.current.worldToLocal(localHitVec);
      const tier = (validHit.object.userData?.elevationTier as number | undefined) ?? 0;
      if (tier && currentExplodedRef.current > 0.01) {
        localHitVec.y -= tier * currentExplodedRef.current * 4.5;
      }

      setMysteryRayClickEvent({
        hitPoint: [localHitVec.x, localHitVec.y, localHitVec.z],
        meshName: validHit.object.name || 'architectural-element',
        timestamp: Date.now(),
      });
    };

    renderer.domElement.addEventListener('pointerdown', handleCanvasPointerDown);
    renderer.domElement.addEventListener('pointerup', handleCanvasPointerUp);

    // Perimeter Grove of Sculpted 3D Park Trees on the Earthen Hill (for non-underground sites, excluding BRVT-DT-002 which has custom perimeter & Núi Nứa foliage)
    if (
      !(SUBSURFACE_CUTAWAY_SITE_IDS as readonly string[]).includes(currentSite.id) &&
      currentSite.id !== 'BRVT-DT-002'
    ) {
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.95 });
      const canopyDarkMat = new THREE.MeshStandardMaterial({
        color: 0x3d5a35,
        roughness: 0.88,
        flatShading: true,
      });
      const canopyWarmMat = new THREE.MeshStandardMaterial({
        color: 0x527344,
        roughness: 0.86,
        flatShading: true,
      });
      const perimeterAngles = [
        0.35, 0.72, 1.15, 1.85, 2.25, 2.68, 3.05, 3.48, 3.92, 4.35, 4.78, 5.25, 5.88,
      ];
      perimeterAngles.forEach((ang, idx) => {
        const radius = 31.5 + (idx % 3) * 2.2;
        const tx = Math.cos(ang) * radius;
        const tz = Math.sin(ang) * radius;
        const sc = 0.85 + (idx % 4) * 0.14;
        const tGroup = new THREE.Group();
        tGroup.position.set(tx, 0, tz);

        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18 * sc, 0.28 * sc, 1.8 * sc, 7),
          trunkMat
        );
        trunk.position.y = 0.9 * sc;
        trunk.castShadow = true;
        tGroup.add(trunk);

        const c1 = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1.45 * sc, 1),
          idx % 2 === 0 ? canopyWarmMat : canopyDarkMat
        );
        c1.position.set(0, 2.3 * sc, 0);
        c1.scale.set(1.1, 0.88, 1.1);
        c1.castShadow = true;
        c1.receiveShadow = true;
        tGroup.add(c1);

        const c2 = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1.05 * sc, 1),
          idx % 2 === 0 ? canopyDarkMat : canopyWarmMat
        );
        c2.position.set(0.45 * sc, 3.1 * sc, -0.25 * sc);
        c2.castShadow = true;
        tGroup.add(c2);

        dioramaTerrainGroup.add(tGroup);
      });
    }

    // 7. Architectural Model Construction Group
    const mainGroup = new THREE.Group();
    mainGroupRef.current = mainGroup;
    scene.add(mainGroup);

    const meshGroup = new THREE.Group();
    meshGroupRef.current = meshGroup;
    mainGroup.add(meshGroup);

    // 8. Build either uploaded/linked .GLB model OR procedural 3D architectural model
    const clonedMaterialMap = new Map<THREE.Material, THREE.Material>();
    const clonedShellMaterialMap = new Map<THREE.Material, THREE.Material>();
    const flagMeshes: THREE.Object3D[] = [];
    const shellOpacityMeshes: THREE.Mesh[] = [];
    const bambooSlideObjects: Array<{ obj: THREE.Object3D; origX: number; slideDir: number }> = [];
    const interiorPointLights: Array<{
      light: THREE.PointLight;
      baseIntensity: number;
      targetIntensity: number;
    }> = [];
    const heliRotorObjects: THREE.Object3D[] = [];
    const warmLanternLights: Array<{ light: THREE.PointLight; baseIntensity: number }> = [];
    const hearthFireLights: Array<{ light: THREE.PointLight; baseIntensity: number }> = [];
    const lanternCoreMeshes: THREE.Mesh[] = [];
    const hearthEmberMeshes: THREE.Mesh[] = [];
    const kitchenSmokeMeshes: THREE.Mesh[] = [];
    let glbMixer: THREE.AnimationMixer | null = null;
    let isDisposed = false;

    const registerModelMaterialsAndNodes = (targetRoot: THREE.Object3D) => {
      targetRoot.traverse((child) => {
        if (child.userData.isFlag) {
          flagMeshes.push(child);
        }
        if (child.userData.isHeliRotor) {
          heliRotorObjects.push(child);
        }
        if (child.userData.bambooSlideDir !== undefined) {
          bambooSlideObjects.push({
            obj: child,
            origX: child.userData.origX ?? child.position.x,
            slideDir: child.userData.bambooSlideDir as number,
          });
        }
        if (child instanceof THREE.PointLight && child.userData.isInteriorPointLight) {
          interiorPointLights.push({
            light: child,
            baseIntensity: (child.userData.baseIntensity as number) ?? 0.35,
            targetIntensity: (child.userData.targetIntensity as number) ?? 3.6,
          });
        }
        if (child instanceof THREE.PointLight && child.userData.isWarmLanternLight) {
          warmLanternLights.push({
            light: child,
            baseIntensity: (child.userData.baseIntensity as number) ?? 0.85,
          });
        }
        if (child instanceof THREE.PointLight && child.userData.isHearthFireLight) {
          hearthFireLights.push({
            light: child,
            baseIntensity: (child.userData.baseIntensity as number) ?? 1.4,
          });
        }
        if (child instanceof THREE.Mesh && child.userData.isLanternCore) {
          lanternCoreMeshes.push(child);
        }
        if (child instanceof THREE.Mesh && child.userData.isHearthEmber) {
          hearthEmberMeshes.push(child);
        }
        if (child instanceof THREE.Mesh && child.userData.isKitchenSmoke) {
          kitchenSmokeMeshes.push(child);
        }
        if (child instanceof THREE.Mesh && child.material) {
          if (child.userData.isGround || child.userData.isGrid) return;

          const isShell = Boolean(child.userData.isExteriorShell);
          const cloneRegistry = isShell ? clonedShellMaterialMap : clonedMaterialMap;
          const getSharedClone = (m: THREE.Material) => {
            let cloned = cloneRegistry.get(m);
            if (!cloned) {
              cloned = m.clone();
              cloneRegistry.set(m, cloned);
            }
            return cloned;
          };

          if (Array.isArray(child.material)) {
            child.material = child.material.map(getSharedClone);
          } else {
            child.material = getSharedClone(child.material);
          }

          if (isShell) {
            shellOpacityMeshes.push(child);
          }

          const mat = (Array.isArray(child.material) ? child.material[0] : child.material) as THREE.MeshStandardMaterial;
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = {
              color: mat.color ? mat.color.clone() : new THREE.Color(0xffffff),
              emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
              emissiveIntensity: mat.emissiveIntensity ?? 0,
              opacity: mat.opacity !== undefined ? mat.opacity : 1,
              transparent: mat.transparent ?? false,
              wireframe: false,
              depthWrite: mat.depthWrite !== undefined ? mat.depthWrite : true,
              map: mat.map || null,
              bumpMap: mat.bumpMap || null,
              bumpScale: mat.bumpScale ?? 0.05,
              roughnessMap: mat.roughnessMap || null,
              roughness: mat.roughness ?? 0.7,
              metalness: mat.metalness ?? 0.05,
            };
          }
        }
      });
    };

    const allowCustomGlbLoad = Boolean(
      customGlbSource.url &&
        (!isCurrentModelHidden || canPreviewHidden || customGlbSource.kind === 'session_temp')
    );
    const requiresStrictGlbOnly = GLB_ONLY_SITE_IDS.has(currentSite.id);

    glbRootRef.current = null;
    setGlbLoadedReady(false);

    if (allowCustomGlbLoad && customGlbSource.url) {
      fountainParticlesRef.current = null;
      setCustomGlbError(null);
      setIsLoadingModel(true);
      setLoadingProgress(18);

      void loadAndNormalizeGlb(customGlbSource.url, {
        targetMaxDim: 26,
        groundY: stageBaseY,
        maxAnisotropy: maxAniso,
        onProgress: (pct) => {
          if (!isDisposed) {
            setLoadingProgress(Math.max(18, Math.min(98, Math.round(pct))));
          }
        },
      })
        .then((res) => {
          if (isDisposed) return;
          glbRootRef.current = res.root;
          res.root.scale.setScalar(glbScaleRef.current);
          res.root.rotation.y = (glbRotationYRef.current * Math.PI) / 180;
          meshGroup.add(res.root);
          registerModelMaterialsAndNodes(res.root);
          if (res.animations.length > 0) {
            glbMixer = new THREE.AnimationMixer(res.root);
            res.animations.forEach((clip) => glbMixer?.clipAction(clip).play());
          }
          const targetY = Math.max(stageBaseY + 3.5, res.center.y);
          controls.target.set(0, targetY, 0);
          controls.update();
          controls.saveState();
          renderer.shadowMap.needsUpdate = true;
          setGlbLoadedReady(true);
          setLoadingProgress(100);
          setIsLoadingModel(false);
        })
        .catch((err) => {
          if (isDisposed) return;
          glbRootRef.current = null;
          setGlbLoadedReady(false);
          setCustomGlbError(
            err instanceof Error ? err.message : 'Không thể tải tệp .glb tùy chỉnh'
          );
          if (!requiresStrictGlbOnly) {
            const fallbackParticles = buildHighDetailModel(currentSite.id, meshGroup);
            fountainParticlesRef.current = fallbackParticles;
            if (fallbackParticles) mainGroup.add(fallbackParticles);
            registerModelMaterialsAndNodes(meshGroup);
          }
          renderer.shadowMap.needsUpdate = true;
          setLoadingProgress(100);
          setIsLoadingModel(false);
        });
    } else if (requiresStrictGlbOnly) {
      fountainParticlesRef.current = null;
      glbRootRef.current = null;
      setGlbLoadedReady(false);
      setCustomGlbError(null);
      renderer.shadowMap.needsUpdate = true;
      setLoadingProgress(100);
      setIsLoadingModel(false);
    } else {
      setCustomGlbError(null);
      const fountainParticles = buildHighDetailModel(currentSite.id, meshGroup);
      fountainParticlesRef.current = fountainParticles;
      if (fountainParticles) mainGroup.add(fountainParticles);
      registerModelMaterialsAndNodes(meshGroup);
      renderer.shadowMap.needsUpdate = true;
      setLoadingProgress(100);
      setIsLoadingModel(false);
    }

    interiorRevealCurrentRef.current = 0;
    interiorRevealForceSyncRef.current = true;

    // 9. Smart Render Pause & Visibility handling (stops rAF loop completely when hidden/paused)
    let animId = 0;
    const timer = new THREE.Timer();
    const tempProjVec = new THREE.Vector3();

    const checkShouldPause = () =>
      isDisposed ||
      document.visibilityState === 'hidden' ||
      !isThreeJsVisibleRef.current ||
      isRenderPausedRef.current;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        ensureAnimateRunning();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const animate = () => {
      if (checkShouldPause()) {
        animId = 0;
        return;
      }

      animId = requestAnimationFrame(animate);

      timer.update();
      const elapsedTime = timer.getElapsed();
      const delta = Math.min(timer.getDelta(), 0.05);

      if (glbMixer) {
        glbMixer.update(delta);
      }

      // Controls damping update
      controls.update();

      // Smooth Apple inertia exploded-view Y separation via MathUtils.damp
      if (
        meshGroupRef.current &&
        Math.abs(currentExplodedRef.current - targetExplodedRef.current) > 0.0008
      ) {
        currentExplodedRef.current = THREE.MathUtils.damp(
          currentExplodedRef.current,
          targetExplodedRef.current,
          6.5,
          delta || 0.016
        );
        meshGroupRef.current.traverse((child) => {
          if (
            (child instanceof THREE.Mesh ||
              child instanceof THREE.PointLight ||
              child.userData.isHeliRotor) &&
            child.userData.elevationTier !== undefined
          ) {
            const tier = child.userData.elevationTier as number;
            const origY = child.userData.origY as number;
            if (origY !== undefined) {
              child.position.y = origY + tier * currentExplodedRef.current * 4.5;
            }
          }
        });
        renderer.shadowMap.needsUpdate = true;
      }

      // Smooth Dinh Doc Lap Interior Cutaway Reveal (Frosted Glass Walls, Bamboo Slide & Warm Lights)
      if (
        interiorRevealForceSyncRef.current ||
        Math.abs(interiorRevealCurrentRef.current - interiorRevealTargetRef.current) > 0.001
      ) {
        interiorRevealCurrentRef.current = THREE.MathUtils.damp(
          interiorRevealCurrentRef.current,
          interiorRevealTargetRef.current,
          7.5,
          delta || 0.016
        );
        if (Math.abs(interiorRevealCurrentRef.current - interiorRevealTargetRef.current) <= 0.002) {
          interiorRevealCurrentRef.current = interiorRevealTargetRef.current;
        }
        const rev = THREE.MathUtils.clamp(interiorRevealCurrentRef.current, 0, 1);

        if (renderModeRef.current === 'textured') {
          for (let s = 0; s < shellOpacityMeshes.length; s++) {
            const sm = shellOpacityMeshes[s];
            if (sm.userData.hideOnReveal) {
              sm.visible = rev < 0.72;
            }
            const origMat = sm.userData.originalMaterial;
            const matList = Array.isArray(sm.material) ? sm.material : [sm.material];
            for (let mIdx = 0; mIdx < matList.length; mIdx++) {
              const m = matList[mIdx] as THREE.MeshStandardMaterial;
              const baseOp = origMat?.opacity ?? 1.0;
              const baseTr = origMat?.transparent ?? false;
              const baseDw = origMat?.depthWrite ?? true;
              m.opacity = THREE.MathUtils.lerp(baseOp, 0.14, rev);
              m.transparent = rev > 0.02 ? true : baseTr;
              m.depthWrite = rev > 0.05 ? false : baseDw;
            }
          }
        }

        for (let b = 0; b < bambooSlideObjects.length; b++) {
          const item = bambooSlideObjects[b];
          item.obj.position.x = item.origX + item.slideDir * rev * 2.45;
        }

        for (let l = 0; l < interiorPointLights.length; l++) {
          const lp = interiorPointLights[l];
          lp.light.intensity = THREE.MathUtils.lerp(lp.baseIntensity, lp.targetIntensity, rev);
        }

        interiorRevealForceSyncRef.current = false;
      }

      // Gently spin UH-1 rooftop helicopter rotor blades (O(1) loop)
      for (let r = 0; r < heliRotorObjects.length; r++) {
        heliRotorObjects[r].rotation.y += (delta || 0.016) * 1.85;
      }

      // Animate water fountain spray if available
      if (fountainParticlesRef.current) {
        const pGeo = fountainParticlesRef.current.geometry;
        if (!fountainParticlesRef.current.userData.initialY) {
          const arr = pGeo.attributes.position.array as Float32Array;
          const initY = new Float32Array(arr.length / 3);
          for (let i = 0; i < initY.length; i++) {
            initY[i] = arr[i * 3 + 1];
          }
          fountainParticlesRef.current.userData.initialY = initY;
        }
        const pos = pGeo.attributes.position.array as Float32Array;
        const initY = fountainParticlesRef.current.userData.initialY as Float32Array;
        for (let i = 0; i < initY.length; i++) {
          pos[i * 3 + 1] = initY[i] + Math.sin(elapsedTime * 6 + i * 0.4) * 0.12;
        }
        pGeo.attributes.position.needsUpdate = true;
      }

      // Animate pre-collected flags (O(1) array loop instead of traversing 1000+ scene nodes)
      for (let f = 0; f < flagMeshes.length; f++) {
        flagMeshes[f].rotation.y = Math.sin(elapsedTime * 5) * 0.15;
      }

      // Animate rising kitchen smoke puffs (Khu Bếp Nhà Lò - Nhà Lớn Long Sơn)
      for (let k = 0; k < kitchenSmokeMeshes.length; k++) {
        const puff = kitchenSmokeMeshes[k];
        const baseX = (puff.userData.smokeBaseX as number) ?? puff.position.x;
        const baseY = (puff.userData.smokeBaseY as number) ?? 4.2;
        const baseZ = (puff.userData.smokeBaseZ as number) ?? puff.position.z;
        const phase = (puff.userData.smokePhase as number) ?? k * 0.7;
        const cycle = (elapsedTime * 0.22 + phase / (Math.PI * 2)) % 1;
        const tierOffset =
          ((puff.userData.elevationTier as number) ?? 0) * currentExplodedRef.current * 4.5;
        puff.position.y = baseY + cycle * 4.2 + tierOffset;
        puff.position.x = baseX + Math.sin(elapsedTime * 1.15 + phase) * (0.12 + cycle * 0.38);
        puff.position.z = baseZ + Math.cos(elapsedTime * 0.9 + phase) * (0.1 + cycle * 0.28);
        const sScale = 0.75 + cycle * 1.35;
        puff.scale.set(sScale, sScale * 0.78, sScale);
        if (renderModeRef.current === 'textured') {
          const pMat = (Array.isArray(puff.material) ? puff.material[0] : puff.material) as THREE.MeshStandardMaterial;
          if (pMat) {
            const fade = Math.sin(cycle * Math.PI);
            pMat.opacity = Math.max(0.03, fade * 0.24);
          }
        }
      }

      // Modulate warm ancient lanterns & kitchen hearth fire across Studio / Day / Golden / Night lighting modes
      const activeLightMode = lightingModeRef.current;
      const isNightOrSunset = activeLightMode === 'night' || activeLightMode === 'golden';
      const lanternMult =
        activeLightMode === 'night' ? 3.8 : activeLightMode === 'golden' ? 2.5 : 0.75;
      const hearthMult =
        activeLightMode === 'night' ? 2.7 : activeLightMode === 'golden' ? 2.1 : 1.0;

      for (let wl = 0; wl < warmLanternLights.length; wl++) {
        const item = warmLanternLights[wl];
        const pulse = 1 + Math.sin(elapsedTime * 3.2 + wl * 1.1) * 0.06;
        item.light.intensity = item.baseIntensity * lanternMult * pulse;
      }

      for (let hf = 0; hf < hearthFireLights.length; hf++) {
        const item = hearthFireLights[hf];
        const flicker =
          1 +
          Math.sin(elapsedTime * 9.5 + hf) * 0.16 +
          Math.cos(elapsedTime * 15.2 + hf * 2.1) * 0.09;
        item.light.intensity = item.baseIntensity * hearthMult * flicker;
      }

      if (renderModeRef.current === 'textured') {
        for (let lc = 0; lc < lanternCoreMeshes.length; lc++) {
          const lMesh = lanternCoreMeshes[lc];
          const lMat = (Array.isArray(lMesh.material) ? lMesh.material[0] : lMesh.material) as THREE.MeshStandardMaterial;
          if (lMat && 'emissiveIntensity' in lMat) {
            lMat.emissiveIntensity = isNightOrSunset
              ? activeLightMode === 'night'
                ? 2.8
                : 2.1
              : 1.15;
          }
        }
        for (let he = 0; he < hearthEmberMeshes.length; he++) {
          const eMesh = hearthEmberMeshes[he];
          const eMat = (Array.isArray(eMesh.material) ? eMesh.material[0] : eMesh.material) as THREE.MeshStandardMaterial;
          if (eMat && 'emissiveIntensity' in eMat) {
            const emberFlicker = 1 + Math.sin(elapsedTime * 10.5 + he * 1.7) * 0.22;
            eMat.emissiveIntensity = (isNightOrSunset ? 2.6 : 1.65) * emberFlicker;
          }
        }
      }

      // Dynamically project active 3D hotspot to screen coordinates (throttled to avoid 60fps React re-renders)
      if (activeFeatureRef.current && containerRef.current) {
        const feat = activeFeatureRef.current;
        tempProjVec.set(feat.targetPos[0], feat.targetPos[1], feat.targetPos[2]);
        tempProjVec.project(camera);
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        const sx = (tempProjVec.x * 0.5 + 0.5) * w;
        const sy = (-(tempProjVec.y * 0.5) + 0.5) * h;
        const isVis = tempProjVec.z < 1;
        const last = lastHotspotPosRef.current;
        if (isVis) {
          if (!last.visible || Math.abs(sx - last.x) > 0.75 || Math.abs(sy - last.y) > 0.75) {
            lastHotspotPosRef.current = { x: sx, y: sy, visible: true };
            setHotspotScreenPos({ x: sx, y: sy });
          }
        } else if (last.visible) {
          lastHotspotPosRef.current = { x: -9999, y: -9999, visible: false };
          setHotspotScreenPos(null);
        }
      }

      // Sync 3D Spatial Compass Azimuth directly to DOM (0 React re-renders) & Interactive [+] Badges (~10fps)
      const nowPerf = performance.now();
      if (nowPerf - lastBadgeProjectionTimeRef.current > 95 && containerRef.current) {
        lastBadgeProjectionTimeRef.current = nowPerf;
        const azRad = controls.getAzimuthalAngle();
        const azDeg = (azRad * 180) / Math.PI;
        const roundedAz = Math.round(((azDeg % 360) + 360) % 360);
        if (roundedAz !== lastAzimuthRoundedRef.current) {
          lastAzimuthRoundedRef.current = roundedAz;
          if (azimuthSpanRef.current) {
            azimuthSpanRef.current.textContent = `${roundedAz}°`;
          }
        }

        const cW = containerRef.current.clientWidth;
        const cH = containerRef.current.clientHeight;
        if (cW > 0 && cH > 0 && featuresRef.current.length > 0) {
          const nextBadges: Array<{ id: string; x: number; y: number; feat: ArchitecturalFeature }> = [];
          for (let i = 0; i < featuresRef.current.length; i++) {
            const fItem = featuresRef.current[i];
            tempProjVec.set(fItem.targetPos[0], fItem.targetPos[1], fItem.targetPos[2]);
            tempProjVec.project(camera);
            if (tempProjVec.z < 1) {
              const bx = (tempProjVec.x * 0.5 + 0.5) * cW;
              const by = (-(tempProjVec.y * 0.5) + 0.5) * cH;
              if (bx >= 40 && bx <= cW - 40 && by >= 60 && by <= cH - 80) {
                nextBadges.push({ id: fItem.id, x: bx, y: by, feat: fItem });
              }
            }
          }

          // Screen-space anti-overlap relaxation pass so no two teardrop pins (1..6) ever overlap
          const minPinDist = 54;
          for (let iter = 0; iter < 4; iter++) {
            for (let a = 0; a < nextBadges.length; a++) {
              for (let b = a + 1; b < nextBadges.length; b++) {
                const dx = nextBadges[b].x - nextBadges[a].x;
                const dy = nextBadges[b].y - nextBadges[a].y;
                const dist = Math.hypot(dx, dy);
                if (dist < minPinDist) {
                  const angle = dist > 0.01 ? Math.atan2(dy, dx) : (b - a) * 1.1;
                  const push = (minPinDist - dist) * 0.52;
                  const ox = Math.cos(angle) * push;
                  const oy = Math.sin(angle) * push;
                  nextBadges[a].x = Math.max(48, Math.min(cW - 48, nextBadges[a].x - ox));
                  nextBadges[a].y = Math.max(70, Math.min(cH - 88, nextBadges[a].y - oy));
                  nextBadges[b].x = Math.max(48, Math.min(cW - 48, nextBadges[b].x + ox));
                  nextBadges[b].y = Math.max(70, Math.min(cH - 88, nextBadges[b].y + oy));
                }
              }
            }
          }

          setProjectedBadges(nextBadges);
        }
      }

      // Animate X-Ray Crown & Orbital Arc satellite pulses if active
      if (crownOrbitGroupRef.current) {
        crownOrbitGroupRef.current.rotation.y = elapsedTime * 0.38;
      }

      // Gently drift 120 Studio bronze dust motes (O(1) transform — locked 60FPS)
      if (museumEnvRef.current && museumEnvRef.current.studioDust.visible) {
        museumEnvRef.current.studioDust.rotation.y = elapsedTime * 0.025;
        museumEnvRef.current.studioDust.position.y = Math.sin(elapsedTime * 0.42) * 0.42;
      }

      // Smoothly dim surrounding studio lights & animate Spatial Gold Spotlight + Laser Ring
      const targetSpotPos = spatialSpotlightRef.current?.position;
      const targetFocusGoal = targetSpotPos ? 1 : 0;
      const currentFocus = (spatialRigGroup.userData.focusMix as number | undefined) ?? 0;
      const nextFocus = THREE.MathUtils.damp(currentFocus, targetFocusGoal, 7.5, delta || 0.016);
      spatialRigGroup.userData.focusMix = nextFocus;

      const baseLights = baseLightIntensitiesRef.current;
      ambient.intensity = baseLights.ambient * (1 - nextFocus * 0.56);
      hemiLight.intensity = baseLights.hemi * (1 - nextFocus * 0.56);
      dirLight.intensity = baseLights.dir * (1 - nextFocus * 0.48);
      backDirLight.intensity = baseLights.backDir * (1 - nextFocus * 0.35);

      if (targetSpotPos && nextFocus > 0.01) {
        spatialRigGroup.visible = true;
        const goalVec = tempProjVec.set(targetSpotPos[0], targetSpotPos[1], targetSpotPos[2]);
        if (!spatialRigGroup.userData.hasPositioned) {
          spatialRigGroup.position.copy(goalVec);
          spatialRigGroup.userData.hasPositioned = true;
        } else {
          spatialRigGroup.position.lerp(goalVec, Math.min(1, (delta || 0.016) * 8.5));
        }

        const rx = spatialRigGroup.position.x;
        const ry = spatialRigGroup.position.y;
        const rz = spatialRigGroup.position.z;
        spatialSpotTarget.position.set(rx, ry, rz);
        spatialSpotLight.position.set(rx + 5.5, ry + 16, rz + 7.5);
        spatialSpotLight.intensity = 24 * nextFocus;

        const pulseScale = 1 + 0.18 * Math.sin(elapsedTime * 4.5);
        const pulseAlpha = 0.72 + 0.28 * Math.sin(elapsedTime * 4.5);
        haloOuterRing.scale.setScalar(pulseScale);
        haloOuterRing.rotation.z = elapsedTime * 0.85;
        haloOuterMat.opacity = 0.88 * nextFocus * pulseAlpha;

        haloTiltRing.lookAt(camera.position);
        haloTiltRing.scale.setScalar(0.95 + 0.14 * Math.cos(elapsedTime * 4.5));
        (haloTiltRing.material as THREE.MeshBasicMaterial).opacity = 0.65 * nextFocus * pulseAlpha;

        haloInnerRing.scale.setScalar(1 + 0.08 * Math.cos(elapsedTime * 6));
        haloInnerMat.opacity = 0.95 * nextFocus;

        laserBeamMat.opacity = 0.24 * nextFocus * (0.85 + 0.15 * Math.sin(elapsedTime * 5));
      } else {
        spatialSpotLight.intensity = 0;
        if (nextFocus <= 0.01) {
          spatialRigGroup.visible = false;
          spatialRigGroup.userData.hasPositioned = false;
        }
      }

      if (mysteryPingTimer > 0) {
        mysteryPingTimer = Math.max(0, mysteryPingTimer - (delta || 0.016) * 1.85);
        mysteryPingMesh.lookAt(camera.position);
        mysteryPingMesh.scale.setScalar(1 + (1 - mysteryPingTimer) * 2.4);
        mysteryPingMat.opacity = mysteryPingTimer * 0.9;
        if (mysteryPingTimer <= 0.01) {
          mysteryPingMesh.visible = false;
        }
      }

      // Smooth Camera Parallax on mouse move (Getty Persepolis subtle spatial tilt)
      const mp = mouseParallaxRef.current;
      mp.x += (mp.targetX - mp.x) * 0.06;
      mp.y += (mp.targetY - mp.y) * 0.06;
      if (!isUserDraggingRef.current && mainGroupRef.current) {
        mainGroupRef.current.rotation.y = mp.x * 0.055;
        mainGroupRef.current.rotation.x = mp.y * 0.025;
      }

      renderer.render(scene, camera);
    };

    const ensureAnimateRunning = () => {
      if (animId === 0 && !checkShouldPause()) {
        timer.update();
        animId = requestAnimationFrame(animate);
      }
    };
    ensureAnimateRunningRef.current = ensureAnimateRunning;
    ensureAnimateRunning();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.clearViewOffset();
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, true);
        controls.update();
      }
    };

    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // 10. Strict Resource Cleanup & Deep WebGL Disposal
    return () => {
      isDisposed = true;
      ensureAnimateRunningRef.current = null;
      if (animId !== 0) {
        cancelAnimationFrame(animId);
        animId = 0;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('wheel', handleDomWheel);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('pointerdown', handleCanvasPointerDown);
      renderer.domElement.removeEventListener('pointerup', handleCanvasPointerUp);

      controls.dispose();

      // Deep hierarchy disposal (Geometries, Materials & non-cached Procedural Textures)
      scene.traverse((child) => {
        if (
          child instanceof THREE.Mesh ||
          child instanceof THREE.Points ||
          child instanceof THREE.Line ||
          child instanceof THREE.LineSegments ||
          child instanceof THREE.LineLoop ||
          child instanceof THREE.Sprite
        ) {
          (child as THREE.Mesh).geometry?.dispose();
          const disposeMat = (m: THREE.Material) => {
            const anyMat = m as unknown as Record<string, unknown>;
            ['map', 'bumpMap', 'roughnessMap', 'normalMap', 'aoMap', 'emissiveMap', 'metalnessMap', 'alphaMap'].forEach((k) => {
              const tex = anyMat[k] as THREE.Texture | undefined;
              if (tex && typeof tex.dispose === 'function' && !tex.userData?.isCached) {
                tex.dispose();
              }
            });
            m.dispose();
          };
          const mat = (child as THREE.Mesh).material;
          if (Array.isArray(mat)) {
            mat.forEach(disposeMat);
          } else if (mat) {
            disposeMat(mat);
          }
        }
      });

      if (dirLight.shadow.map) {
        dirLight.shadow.map.dispose();
      }
      scene.clear();
      museumEnvRef.current = null;
      envRT.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [
    currentSite.id,
    customGlbSource.url,
    customGlbSource.kind,
    customGlbSource.updatedAt,
    isCurrentModelHidden,
    canPreviewHidden,
  ]);

  // Sync autoRotate state to controls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Load saved .glb transform sliders when switching site
  useEffect(() => {
    const savedTransform = getSite3DTransform(currentSite.id);
    setGlbScale(savedTransform.scale);
    setGlbRotationY(savedTransform.rotationY);
    setIsMobileControlsOpen(false);
  }, [currentSite.id]);

  // Live sync Scale & Rotation Y onto loaded .glb model
  useEffect(() => {
    const root = glbRootRef.current;
    if (!root) return;
    root.scale.setScalar(glbScale);
    root.rotation.y = (glbRotationY * Math.PI) / 180;
    if (rendererRef.current) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }
  }, [glbScale, glbRotationY, glbLoadedReady]);

  // Lighting & Museum Environment Mode Controller (mutates uniforms, fog & lights in-place at 60FPS)
  useEffect(() => {
    lightingModeRef.current = lightingMode;
    if (!sceneRef.current || !museumEnvRef.current) return;
    applyMuseumEnvironmentPreset(lightingMode, sceneRef.current, museumEnvRef.current);
    baseLightIntensitiesRef.current = {
      ambient: museumEnvRef.current.ambient.intensity,
      hemi: museumEnvRef.current.hemiLight.intensity,
      dir: museumEnvRef.current.dirLight.intensity,
      backDir: museumEnvRef.current.backDirLight.intensity,
    };
    if (rendererRef.current) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }
  }, [lightingMode]);

  // Sync cursor crosshair cue during Raycaster Mystery Mode
  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.domElement.style.cursor = isMysteryModeActive ? 'crosshair' : 'grab';
  }, [isMysteryModeActive]);

  // Render Mode Controller (Bề mặt số / Khung dây / X-Ray)
  useEffect(() => {
    if (!meshGroupRef.current) return;

    meshGroupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        // Tuyệt đối KHÔNG thay đổi màu của GridHelper, mặt phẳng nền hoặc lớp lưới Labs
        if (
          child.userData.isGround ||
          child.userData.isGrid ||
          child.userData.isLabsWireframeOverlay
        )
          return;

        // Lưu toàn bộ thuộc tính vật liệu gốc nếu chưa lưu
        if (!child.userData.originalMaterial) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map((m) => m.clone());
          } else {
            child.material = child.material.clone();
          }
          const m = (Array.isArray(child.material) ? child.material[0] : child.material) as THREE.MeshStandardMaterial;
          const isStandard = 'roughness' in m && 'metalness' in m;
          child.userData.originalMaterial = {
            color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
            emissive: 'emissive' in m && m.emissive ? m.emissive.clone() : undefined,
            emissiveIntensity: 'emissiveIntensity' in m ? m.emissiveIntensity : undefined,
            opacity: m.opacity !== undefined ? m.opacity : 1,
            transparent: m.transparent ?? false,
            wireframe: false,
            depthWrite: m.depthWrite !== undefined ? m.depthWrite : true,
            map: m.map || null,
            bumpMap: isStandard ? m.bumpMap || null : undefined,
            bumpScale: isStandard ? m.bumpScale : undefined,
            normalMap: isStandard ? m.normalMap || null : undefined,
            normalScale: isStandard && m.normalScale ? m.normalScale.clone() : undefined,
            roughnessMap: isStandard ? m.roughnessMap || null : undefined,
            roughness: isStandard ? m.roughness : undefined,
            metalness: isStandard ? m.metalness : undefined,
          };
        }

        const orig = child.userData.originalMaterial;
        const mat = (Array.isArray(child.material) ? child.material[0] : child.material) as THREE.MeshStandardMaterial;

        if (renderMode === 'wireframe') {
          // Khi bấm "Khung dây": bật wireframe = true, đặt màu vàng sáng (#f59e0b), transparent = false, opacity = 1
          mat.wireframe = true;
          mat.transparent = false;
          mat.opacity = 1.0;
          mat.depthWrite = true;
          mat.color.setHex(0xf59e0b);
          if ('emissive' in mat && mat.emissive) {
            mat.emissive.setHex(0xb45309);
            mat.emissiveIntensity = 0.4;
          }
          mat.map = null;
          if ('normalMap' in mat) mat.normalMap = null;
        } else if (renderMode === 'xray') {
          const isNewNineSite = (NEW_NINE_SITE_IDS as readonly string[]).includes(currentSite.id);
          const isInteriorNode = Boolean(child.userData.isInterior);
          // Khi bấm "X-Ray": vỏ ngoài trong suốt xanh cyan, riêng lõi nội thất / cổ vật / đường hầm nổi bật vàng hổ phách
          mat.wireframe = false;
          mat.transparent = true;
          mat.opacity = isInteriorNode ? 0.94 : isNewNineSite ? 0.24 : 0.35;
          mat.depthWrite = isInteriorNode;
          mat.color.setHex(isInteriorNode ? 0xf59e0b : 0x38bdf8);
          if ('emissive' in mat && mat.emissive) {
            mat.emissive.setHex(isInteriorNode ? 0xb45309 : 0x0284c7);
            mat.emissiveIntensity = isInteriorNode ? 0.65 : 0.48;
          }
          mat.map = isInteriorNode ? orig.map || null : null;
          if ('normalMap' in mat) mat.normalMap = null;
        } else {
          // Khi bấm lại "Bề mặt số" (Solid): KHÔI PHỤC CHÍNH XÁC từ mesh.userData.originalMaterial
          mat.color.copy(orig.color);
          if ('emissive' in mat && mat.emissive && orig.emissive) {
            mat.emissive.copy(orig.emissive);
            if (orig.emissiveIntensity !== undefined) {
              mat.emissiveIntensity = orig.emissiveIntensity;
            }
          }
          mat.wireframe = false;
          mat.transparent = orig.transparent;
          mat.opacity = orig.opacity;
          mat.depthWrite = orig.depthWrite;
          mat.map = orig.map || null;
          if ('roughness' in mat && 'metalness' in mat) {
            if (orig.bumpMap !== undefined) mat.bumpMap = orig.bumpMap;
            if (orig.bumpScale !== undefined) mat.bumpScale = orig.bumpScale;
            if (orig.normalMap !== undefined) mat.normalMap = orig.normalMap;
            if (orig.normalScale && mat.normalScale) mat.normalScale.copy(orig.normalScale);
            if (orig.roughnessMap !== undefined) mat.roughnessMap = orig.roughnessMap;
            if (orig.roughness !== undefined) mat.roughness = orig.roughness;
            if (orig.metalness !== undefined) mat.metalness = orig.metalness;
          }
        }
        mat.needsUpdate = true;
      }
    });
    if (renderMode === 'textured') {
      interiorRevealForceSyncRef.current = true;
    }
    if (rendererRef.current) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }
  }, [renderMode]);

  // 🌐 Giải phẫu Đỉnh Mái & Quỹ đạo Liên kết (X-Ray Crown & Orbital Arc with THREE.CatmullRomCurve3)
  useEffect(() => {
    if (!sceneRef.current || !meshGroupRef.current) return;

    // Clean up any existing orbital group first
    if (crownOrbitGroupRef.current) {
      crownOrbitGroupRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
      sceneRef.current.remove(crownOrbitGroupRef.current);
      crownOrbitGroupRef.current = null;
    }

    if (isCrownOrbitActive) {
      // 1. Highlight top roof / crown tier (elevationTier >= 2) in bright white structural wireframe
      meshGroupRef.current.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.material &&
          !child.userData.isGround &&
          !child.userData.isGrid &&
          !child.userData.isLabsWireframeOverlay
        ) {
          const tier = (child.userData.elevationTier as number) ?? 1;
          const mat = (Array.isArray(child.material) ? child.material[0] : child.material) as THREE.MeshStandardMaterial;
          if (tier >= 2 || child.position.y >= 7.5) {
            mat.wireframe = true;
            mat.transparent = false;
            mat.opacity = 1.0;
            mat.color.setHex(0xffffff);
            if ('emissive' in mat && mat.emissive) {
              mat.emissive.setHex(0x38bdf8);
              mat.emissiveIntensity = 0.65;
            }
            mat.map = null;
            mat.needsUpdate = true;
          }
        }
      });

      // 2. Build 3D Orbital Arc around the monument crown using THREE.CatmullRomCurve3
      const orbitGroup = new THREE.Group();
      const curvePoints: THREE.Vector3[] = [];
      const segments = 24;
      const radiusX = 18;
      const radiusZ = 15;
      const baseHeight = 11.5;

      for (let i = 0; i < segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = Math.cos(theta) * radiusX;
        const z = Math.sin(theta) * radiusZ;
        const y = baseHeight + Math.sin(theta * 2) * 3.2;
        curvePoints.push(new THREE.Vector3(x, y, z));
      }

      const catmullCurve = new THREE.CatmullRomCurve3(curvePoints, true, 'catmullrom', 0.5);
      const tubeGeo = new THREE.TubeGeometry(catmullCurve, 120, 0.14, 12, true);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.95,
        roughness: 0.2,
        metalness: 0.8,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      orbitGroup.add(tubeMesh);

      // Secondary inclined Champagne Gold orbital curve
      const goldCurvePoints: THREE.Vector3[] = [];
      for (let i = 0; i < segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = Math.cos(theta) * (radiusX * 0.86);
        const z = Math.sin(theta) * (radiusZ * 0.86);
        const y = baseHeight + 1.5 - Math.cos(theta) * 3.8;
        goldCurvePoints.push(new THREE.Vector3(x, y, z));
      }
      const goldCurve = new THREE.CatmullRomCurve3(goldCurvePoints, true, 'catmullrom', 0.5);
      const goldTubeGeo = new THREE.TubeGeometry(goldCurve, 100, 0.1, 10, true);
      const goldTubeMat = new THREE.MeshStandardMaterial({
        color: 0xc5a059,
        emissive: 0xc5a059,
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.85,
      });
      orbitGroup.add(new THREE.Mesh(goldTubeGeo, goldTubeMat));

      // Glowing orbital nodes along the CatmullRomCurve3
      const nodeGeo = new THREE.SphereGeometry(0.42, 16, 16);
      const nodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      [0, 0.25, 0.5, 0.75].forEach((tVal) => {
        const pt = catmullCurve.getPointAt(tVal);
        const sphere = new THREE.Mesh(nodeGeo, nodeMat);
        sphere.position.copy(pt);
        orbitGroup.add(sphere);
      });

      sceneRef.current.add(orbitGroup);
      crownOrbitGroupRef.current = orbitGroup;
    } else {
      // Restore materials according to current renderMode
      meshGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material && child.userData.originalMaterial) {
          const orig = child.userData.originalMaterial;
          const mat = (Array.isArray(child.material) ? child.material[0] : child.material) as THREE.MeshStandardMaterial;
          if (renderMode === 'textured') {
            mat.color.copy(orig.color);
            if ('emissive' in mat && mat.emissive && orig.emissive) {
              mat.emissive.copy(orig.emissive);
              if (orig.emissiveIntensity !== undefined) {
                mat.emissiveIntensity = orig.emissiveIntensity;
              }
            }
            mat.wireframe = false;
            mat.transparent = orig.transparent;
            mat.opacity = orig.opacity;
            mat.depthWrite = orig.depthWrite;
            mat.map = orig.map || null;
            mat.needsUpdate = true;
          }
        }
      });
    }
  }, [isCrownOrbitActive, renderMode, currentSite.id]);

  // Section Cut (Clipping Plane) Controller
  useEffect(() => {
    if (!rendererRef.current) return;
    if (sectionCutActive) {
      clipPlaneRef.current.constant = sectionHeight;
      rendererRef.current.clippingPlanes = [clipPlaneRef.current];
    } else {
      rendererRef.current.clippingPlanes = [];
    }
    rendererRef.current.shadowMap.needsUpdate = true;
  }, [sectionCutActive, sectionHeight]);

  // Smooth Exploded View target sync (animated smoothly inside animate loop via MathUtils.damp)
  useEffect(() => {
    targetExplodedRef.current = explodedFactor;
    if (rendererRef.current) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }
  }, [explodedFactor]);

  // Dinh Doc Lap & Nha Lon Long Son Interior Cutaway Target Sync
  useEffect(() => {
    const isHcm001Reveal =
      currentSite.id === 'HCM-DT-001' && (sectionCutActive || explodedFactor > 0.15);
    // For BRVT-DT-002, keep tiled roofs visible when lifting in "Bóc tách 3D" (explodedFactor > 0),
    // and open/fade the roof & walls when entering "Nội thất" (sectionCutActive === true).
    const isBrvt002Reveal = currentSite.id === 'BRVT-DT-002' && sectionCutActive;
    interiorRevealTargetRef.current =
      (isHcm001Reveal || isBrvt002Reveal) && renderMode === 'textured' ? 1 : 0;
    interiorRevealForceSyncRef.current = true;
    if (rendererRef.current) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }
  }, [currentSite.id, sectionCutActive, explodedFactor, renderMode]);

  // Floor Filter Handler
  useEffect(() => {
    if (!meshGroupRef.current) return;
    meshGroupRef.current.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.userData.elevationTier !== undefined &&
        !child.userData.isLabsWireframeOverlay
      ) {
        const tier = child.userData.elevationTier as number;
        if (activeFloor === 'all') {
          child.visible = true;
        } else if (activeFloor === 'roof') {
          child.visible = tier >= 2;
        } else if (activeFloor === 'upper') {
          child.visible = tier === 1 || tier === 2;
        } else if (activeFloor === 'ground') {
          child.visible = tier <= 1;
        }
      }
    });
    if (rendererRef.current) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }
  }, [activeFloor]);

  // Dấu Ấn Labs 02: Architectural Wireframe Overlay (shared geometry, zero extra vertex allocation)
  useEffect(() => {
    const group = meshGroupRef.current;
    if (!group) return;

    const removeExistingOverlays = () => {
      const toRemove: THREE.Object3D[] = [];
      group.traverse((obj) => {
        if (obj.userData?.isLabsWireframeOverlay) {
          toRemove.push(obj);
        }
      });
      toRemove.forEach((overlay) => {
        overlay.parent?.remove(overlay);
      });
    };

    if (!effectiveWireframeOverlay) {
      removeExistingOverlays();
      return;
    }

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xc8a96e,
      wireframe: true,
      transparent: true,
      opacity: 0.26,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      depthWrite: false,
    });

    const targetMeshes: THREE.Mesh[] = [];
    group.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh &&
        obj.geometry &&
        !obj.userData.isGround &&
        !obj.userData.isGrid &&
        !obj.userData.isLabsWireframeOverlay
      ) {
        targetMeshes.push(obj);
      }
    });

    targetMeshes.forEach((mesh) => {
      const alreadyHasOverlay = mesh.children.some(
        (c) => c.userData?.isLabsWireframeOverlay
      );
      if (!alreadyHasOverlay) {
        const overlay = new THREE.Mesh(mesh.geometry, wireMat);
        overlay.userData.isLabsWireframeOverlay = true;
        overlay.raycast = () => {};
        overlay.renderOrder = 2;
        mesh.add(overlay);
      }
    });

    return () => {
      removeExistingOverlays();
      wireMat.dispose();
    };
  }, [effectiveWireframeOverlay, currentSite.id]);

  // Fullscreen resize effect
  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current || !containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    rendererRef.current.setSize(w, h);
    cameraRef.current.aspect = w / h;
    cameraRef.current.updateProjectionMatrix();
  }, [isFullscreen]);

  // Smooth camera flight helper (800ms = 0.8s lerp interpolation)
  const flyCameraTo = (cameraTarget: [number, number, number], lookTarget: [number, number, number], duration = 800) => {
    if (!controlsRef.current || !cameraRef.current) return;

    controlsRef.current.autoRotate = false;
    setAutoRotate(false);

    const startCam = cameraRef.current.position.clone();
    const endCam = new THREE.Vector3(...cameraTarget);
    const startTarget = controlsRef.current.target.clone();
    const endTarget = new THREE.Vector3(...lookTarget);
    const startTime = performance.now();

    const tween = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // Cubic ease out

      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.lerpVectors(startCam, endCam, ease);
        controlsRef.current.target.lerpVectors(startTarget, endTarget, ease);
        controlsRef.current.update();
      }

      if (progress < 1) {
        requestAnimationFrame(tween);
      }
    };
    requestAnimationFrame(tween);
  };

  // Camera presets (Isometric, Front, Top)
  const handleSetPreset = (preset: 'iso' | 'front' | 'top') => {
    setCameraPreset(preset);
    setActiveFeature(null);
    if (preset === 'iso') {
      if (currentSite.id === 'HCM-DT-005') {
        flyCameraTo([20, 16, 40], [0, 10, 4], 800);
      } else if (currentSite.id === 'HCM-DT-002') {
        flyCameraTo([0, 13, 35], [0, 6, 0], 800);
      } else if (currentSite.id === 'HCM-DT-006') {
        flyCameraTo([0, 11, 34], [0, 5, 0], 800);
      } else if (currentSite.id === 'HCM-DT-009' || currentSite.id === 'BRVT-DT-003' || currentSite.id === 'BD-DT-002') {
        flyCameraTo([22, 16, 26], [0, 2, 0], 800);
      } else if (currentSite.id === 'HCM-DT-010') {
        flyCameraTo([20, 14, 24], [0, 0.8, 1.5], 800);
      } else if (currentSite.id === 'BRVT-DT-001') {
        flyCameraTo([22, 16, 28], [0, 6.5, -1.5], 800);
      } else {
        flyCameraTo([24, 18, 28], [0, 4, 0], 800);
      }
    } else if (preset === 'front') {
      if (currentSite.id === 'HCM-DT-005') {
        flyCameraTo([0, 11.5, 42], [0, 10.5, 4], 800);
      } else if (currentSite.id === 'HCM-DT-002') {
        flyCameraTo([0, 13, 35], [0, 6, 0], 800);
      } else if (currentSite.id === 'HCM-DT-006') {
        flyCameraTo([0, 11, 34], [0, 5, 0], 800);
      } else if (currentSite.id === 'HCM-DT-009' || currentSite.id === 'BRVT-DT-003' || currentSite.id === 'BD-DT-002') {
        flyCameraTo([0, 5, 32], [0, 2, 0], 800);
      } else if (currentSite.id === 'HCM-DT-010') {
        flyCameraTo([0, 8, 28], [0, 0.8, 1.5], 800);
      } else {
        flyCameraTo([0, 8, 34], [0, 5, 0], 800);
      }
    } else if (preset === 'top') {
      flyCameraTo([0, 48, 0.05], [0, 0, 0], 800);
    }
  };

  // Fly to architectural feature hotspot in 600-800ms
  const flyToFeature = (feat: ArchitecturalFeature) => {
    setActiveFeature(feat);
    if (currentSite.id === 'HCM-DT-001') {
      switchToThreeJs('textured');
      setExplodedFactor(0);
      setSectionHeight(14);
      setSectionCutActive(true);
    } else if (currentSite.id === 'BRVT-DT-002') {
      switchToThreeJs('textured');
      const isInteriorPin = feat.id === 'f1' || feat.id === 'f4' || feat.id === 'f5';
      setExplodedFactor(0);
      setSectionHeight(16);
      setSectionCutActive(isInteriorPin);
    }
    flyCameraTo(feat.cameraPos, feat.targetPos, 760);
  };

  // =========================================================================
  // ✨ APPLE 3D SCROLLYTELLING (CUỘN GIẢI PHẪU KHÔNG GIAN) — 4 GIAI ĐOẠN
  // =========================================================================
  const scrollytellingStages = useMemo(() => {
    const isTunnelSite =
      currentSite.id === 'HCM-DT-009' ||
      currentSite.id === 'BRVT-DT-003' ||
      currentSite.id === 'BD-DT-002';

    const frontCam: [number, number, number] =
      currentSite.id === 'HCM-DT-005'
        ? [16, 14, 38]
        : currentSite.id === 'HCM-DT-002'
        ? [0, 12.5, 34]
        : currentSite.id === 'HCM-DT-006'
        ? [0, 11, 33]
        : isTunnelSite
        ? [20, 15, 26]
        : [0, 12, 34];

    const frontTarget: [number, number, number] =
      currentSite.id === 'HCM-DT-005'
        ? [0, 9.5, 2]
        : isTunnelSite
        ? [0, 2, 0]
        : [0, 5.5, 0];

    return [
      {
        stageNumber: '01',
        title:
          lang === 'en'
            ? 'Stage 1: Architectural Facade Overview'
            : lang === 'zh'
            ? '阶段 1：建筑立面全景概览'
            : 'Giai đoạn 1: Tổng quan Kiến trúc Mặt tiền',
        subtitle:
          lang === 'en'
            ? 'EXTERIOR COMPOSITION & PROPORTIONS'
            : lang === 'zh'
            ? '外立面比例与建筑流派'
            : 'TỶ LỆ MẶT ĐỨNG & PHONG CÁCH ĐÔNG DƯƠNG',
        description:
          lang === 'en'
            ? `Panoramic front elevation of ${currentSite.officialName} (${currentSite.architecturalStyle}). Designed by ${currentSite.architect || 'Master Architects'}, preserving authentic historical proportions and facade ornamentation.`
            : `Toàn cảnh mặt đứng chính diện của ${currentSite.officialName} theo phong cách ${currentSite.architecturalStyle}. Tác giả / Kiến trúc sư: ${currentSite.architect || 'Kiến trúc sư đương thời'} (${currentSite.chronology}).`,
        cameraPos: frontCam,
        targetPos: frontTarget,
        renderMode: 'textured' as RenderMode,
        explodedFactor: 0,
        sectionCutActive: false,
        sectionHeight: 14,
        shellOpacity: 1.0,
        metricLabel: lang === 'en' ? 'FACADE SHELL' : 'VỎ BAO CHE NGOẠI THẤT',
        metricValue: '100% PBR Solid',
      },
      {
        stageNumber: '02',
        title:
          lang === 'en'
            ? 'Stage 2: X-Ray Cutaway & Load-Bearing Structure'
            : lang === 'zh'
            ? '阶段 2：X光透视与承重结构解剖'
            : 'Giai đoạn 2: Cắt lớp X-Ray & Giải phẫu Kết cấu chịu lực',
        subtitle:
          lang === 'en'
            ? 'STRUCTURAL COLUMNS, ARCHES & TRUSS ANATOMY'
            : lang === 'zh'
            ? '承重柱网、拱券与屋架解剖'
            : 'HỆ CỘT CHỊU LỰC, VÒM CUỐN & VÌ KÈO MÁI',
        description:
          isTunnelSite
            ? `Cắt lớp X-Ray xuyên địa tầng đất sét pha đá ong (laterite clay) trên nền phù sa cổ bền chắc như bê tông tự nhiên, làm lộ rõ kết cấu chịu lực tự nhiên của mạng lưới giao thông hào và hầm ngầm.`
            : `Chế độ giải phẫu X-Ray làm mờ lớp vỏ tường bao ngoài (độ trong suốt 35%) và nâng tách các tầng kết cấu (35%), phơi bày hệ khung cột chịu lực, vòm cuốn và dàn mái kỹ thuật bên trong công trình.`,
        cameraPos: [-22, 17, 25] as [number, number, number],
        targetPos: [0, 6.2, 0] as [number, number, number],
        renderMode: 'xray' as RenderMode,
        explodedFactor: 0.35,
        sectionCutActive: false,
        sectionHeight: 12,
        shellOpacity: 0.35,
        metricLabel: lang === 'en' ? 'STRUCTURAL X-RAY' : 'CẮT LỚP KẾT CẤU',
        metricValue: 'Opacity 35% · Explode 35%',
      },
      {
        stageNumber: '03',
        title:
          lang === 'en'
            ? 'Stage 3: Interior Chambers & Subterranean Spaces'
            : lang === 'zh'
            ? '阶段 3：内部空间与历史地下层探索'
            : 'Giai đoạn 3: Khám phá Nội thất / Tầng ngầm Lịch sử',
        subtitle:
          lang === 'en'
            ? 'INTERIOR HALLS & SUBTERRANEAN COMMAND BUNKERS'
            : lang === 'zh'
            ? '核心厅堂与地下历史空间'
            : 'KHÔNG GIAN LÕI NỘI THẤT & TẦNG HẦM CHỈ HUY',
        description:
          isTunnelSite
            ? `Camera hạ thấp đi sâu vào hệ thống 3 tầng địa đạo ngầm (từ -3m đến -10m): khám phá hầm chỉ huy chữ A, bếp Hoàng Cầm giấu khói, giếng nước ngầm và lỗ thông hơi ngụy trang.`
            : `Tự động làm mờ lớp tường bao ngoại thất (độ mờ 28%) kết hợp mặt cắt ngang ở cao độ +8.5m và tách mái 65%, đưa góc nhìn xuyên vào không gian khánh tiết, khán phòng và tầng hầm lịch sử bên trong.`,
        cameraPos: (isTunnelSite ? [11, 4.5, 16] : [13, 9.2, 18]) as [number, number, number],
        targetPos: (isTunnelSite ? [0, -1.5, 0] : [0, 4.0, 0]) as [number, number, number],
        renderMode: 'textured' as RenderMode,
        explodedFactor: 0.65,
        sectionCutActive: true,
        sectionHeight: 8.5,
        shellOpacity: 0.28,
        metricLabel: lang === 'en' ? 'INTERIOR CUTAWAY' : 'GIẢI PHẪU LÕI NỘI THẤT',
        metricValue: 'Section +8.5m · Shell 28%',
      },
      {
        stageNumber: '04',
        title:
          lang === 'en'
            ? 'Stage 4: Technical Blueprint & Regional Linkage'
            : lang === 'zh'
            ? '阶段 4：工程技术蓝图与跨区域联动'
            : 'Giai đoạn 4: Bản vẽ Kỹ thuật & Liên kết vùng',
        subtitle:
          lang === 'en'
            ? 'CAD WIREFRAME & SOUTHEAST VIETNAM CORRIDOR'
            : lang === 'zh'
            ? 'CAD 测绘线框与东南部遗产走廊'
            : 'BẢN VẼ TRẮC ĐỊA CAD & TRỤC DI SẢN ĐÔNG NAM BỘ',
        description:
          lang === 'en'
            ? `Isometric CAD wireframe survey of ${currentSite.officialName} (${currentSite.identifierCode}) at WGS84 ${currentSite.gps.lat.toFixed(4)}°N, ${currentSite.gps.lng.toFixed(4)}°E, connecting the Ho Chi Minh City – Binh Duong – Ba Ria Vung Tau heritage network.`
            : `Bản vẽ khung dây trắc địa CAD (Isometric Blueprint) của di tích ${currentSite.identifierCode} tại tọa độ WGS84 (${currentSite.gps.lat.toFixed(4)}°N, ${currentSite.gps.lng.toFixed(4)}°E), kết nối trực tiếp vào mạng lưới di sản liên vùng TP.HCM – Bình Dương – Bà Rịa Vũng Tàu.`,
        cameraPos: [25, 22, 27] as [number, number, number],
        targetPos: [0, 4.5, 0] as [number, number, number],
        renderMode: 'wireframe' as RenderMode,
        explodedFactor: 0.18,
        sectionCutActive: false,
        sectionHeight: 15,
        shellOpacity: 1.0,
        metricLabel: lang === 'en' ? 'GEODETIC CAD' : 'TỌA ĐỘ TRẮC ĐỊA WGS84',
        metricValue: `${currentSite.gps.lat.toFixed(4)}°N, ${currentSite.gps.lng.toFixed(4)}°E`,
      },
    ];
  }, [currentSite, lang]);

  // Curved camera flight combining Spherical orbital interpolation + Vector3.lerp
  const flyCameraCurvedTo = useCallback(
    (cameraTarget: [number, number, number], lookTarget: [number, number, number], duration = 920) => {
      if (!controlsRef.current || !cameraRef.current) return;

      controlsRef.current.autoRotate = false;
      setAutoRotate(false);

      const startTarget = controlsRef.current.target.clone();
      const endTarget = new THREE.Vector3(...lookTarget);

      const startOffset = cameraRef.current.position.clone().sub(startTarget);
      const endOffset = new THREE.Vector3(...cameraTarget).sub(endTarget);

      const startSpherical = new THREE.Spherical().setFromVector3(startOffset);
      const endSpherical = new THREE.Spherical().setFromVector3(endOffset);

      // Shortest angular path for theta
      let deltaTheta = endSpherical.theta - startSpherical.theta;
      while (deltaTheta > Math.PI) deltaTheta -= Math.PI * 2;
      while (deltaTheta < -Math.PI) deltaTheta += Math.PI * 2;

      const startTime = performance.now();
      const currentSpherical = new THREE.Spherical();
      const currentOffset = new THREE.Vector3();

      const tween = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Apple quintic ease-out
        const ease = 1 - Math.pow(1 - progress, 4);

        if (cameraRef.current && controlsRef.current) {
          controlsRef.current.target.lerpVectors(startTarget, endTarget, ease);

          currentSpherical.radius = THREE.MathUtils.lerp(startSpherical.radius, endSpherical.radius, ease);
          currentSpherical.phi = THREE.MathUtils.lerp(startSpherical.phi, endSpherical.phi, ease);
          currentSpherical.theta = startSpherical.theta + deltaTheta * ease;

          currentOffset.setFromSpherical(currentSpherical);
          cameraRef.current.position.copy(controlsRef.current.target).add(currentOffset);
          controlsRef.current.update();
        }

        if (progress < 1) {
          requestAnimationFrame(tween);
        }
      };

      requestAnimationFrame(tween);
    },
    []
  );

  // Apply Scrollytelling stage (camera curve + outer shell opacity + exploded tiers + section cut)
  const applyScrollyStage = useCallback(
    (stageIdx: number) => {
      const clampedIdx = Math.max(0, Math.min(scrollytellingStages.length - 1, stageIdx));
      const stage = scrollytellingStages[clampedIdx];
      if (!stage) return;

      setScrollyStageIndex(clampedIdx);
      setActiveFeature(null);
      setIsUnderConstructionCardMinimized(true);

      if (viewTwinMode !== '3d_cad_pbr') {
        setViewTwinMode('3d_cad_pbr');
      }

      setRenderMode(stage.renderMode);
      setExplodedFactor(stage.explodedFactor);
      setSectionCutActive(stage.sectionCutActive);
      setSectionHeight(stage.sectionHeight);

      // Smoothly adjust outer wall / upper shell opacity in Stage 3 so interior/tunnels are visible
      requestAnimationFrame(() => {
        if (!meshGroupRef.current) return;
        meshGroupRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material && !child.userData.isGround && !child.userData.isGrid) {
            const mat = (Array.isArray(child.material) ? child.material[0] : child.material) as THREE.MeshStandardMaterial;
            const orig = child.userData.originalMaterial;
            if (clampedIdx === 2 && stage.renderMode === 'textured') {
              const tier = (child.userData.elevationTier as number) ?? 1;
              if (tier >= 1 && !child.userData.isInterior) {
                mat.transparent = true;
                mat.opacity = stage.shellOpacity;
                mat.depthWrite = false;
                mat.needsUpdate = true;
              }
            } else if (clampedIdx === 0 && orig && stage.renderMode === 'textured') {
              mat.transparent = orig.transparent;
              mat.opacity = orig.opacity;
              mat.depthWrite = orig.depthWrite;
              mat.needsUpdate = true;
            }
          }
        });
      });

      flyCameraCurvedTo(stage.cameraPos, stage.targetPos, 920);
    },
    [scrollytellingStages, viewTwinMode, flyCameraCurvedTo]
  );


  // Listen to mouse wheel when Apple 3D Scrollytelling mode is active to advance/rewind stages
  useEffect(() => {
    if (!isScrollytellingMode || !containerRef.current) return;
    const el = containerRef.current;

    const handleScrollyWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 12) return;
      const now = performance.now();
      if (now - lastWheelStepTimeRef.current < 520) return;
      lastWheelStepTimeRef.current = now;

      const direction = e.deltaY > 0 ? 1 : -1;
      const nextIdx = Math.max(0, Math.min(3, scrollyStageIndex + direction));
      if (nextIdx !== scrollyStageIndex) {
        applyScrollyStage(nextIdx);
      }
    };

    el.addEventListener('wheel', handleScrollyWheel, { passive: true });
    return () => {
      el.removeEventListener('wheel', handleScrollyWheel);
    };
  }, [isScrollytellingMode, scrollyStageIndex, applyScrollyStage]);

  return (
    <div
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
          const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
          mouseParallaxRef.current.targetX = nx;
          mouseParallaxRef.current.targetY = ny;
        }
      }}
      onMouseLeave={() => {
        mouseParallaxRef.current.targetX = 0;
        mouseParallaxRef.current.targetY = 0;
      }}
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen flex flex-col select-none'
          : 'relative w-full h-full min-h-[55vh] md:min-h-0 overflow-hidden border-0 shadow-none flex flex-col select-none'
      }
      style={{
        background:
          lightingMode === 'night'
            ? 'radial-gradient(circle at 50% 45%, #0D1526 0%, #040711 65%, #020308 100%)'
            : lightingMode === 'golden'
            ? 'radial-gradient(circle at 50% 45%, #42261F 0%, #1A1829 65%, #0D0B14 100%)'
            : lightingMode === 'day'
            ? 'radial-gradient(circle at 50% 45%, #8FAEC4 0%, #3B6E9C 65%, #234566 100%)'
            : 'radial-gradient(circle at 50% 45%, #181715 0%, #0D0D0F 60%, #08080A 100%)',
      }}
    >
      {/* APPLE VISIONOS 100% FULL-SCREEN 3D STAGE */}
      <div className="flex-1 relative flex overflow-hidden w-full h-full">
        <div className="flex-1 relative h-full min-h-[55vh] md:min-h-0 overflow-hidden">
          {/* 0. THREE.JS VIEWPORT CONTAINER (ALWAYS IN DOM TO PRESERVE WEBGL CONTEXT & ACCURATE DIMENSIONS) */}
          <div
            ref={containerRef}
            className="absolute inset-0 w-full h-full select-none touch-none overscroll-contain"
            style={{
              display: viewTwinMode === '3d_cad_pbr' ? 'block' : 'none',
              zIndex: 10,
              opacity: 1,
              pointerEvents: 'auto',
              cursor: 'grab',
              touchAction: 'none',
              overscrollBehavior: 'contain',
              userSelect: 'none',
            }}
          />

      {/* 1. LOADING PROGRESS & PREVIEW BACKDROP */}
      {isLoadingModel && (
        <div className="absolute inset-0 z-40 bg-[#171817]/95 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="relative z-10 max-w-sm w-full space-y-4 bg-[#171817] p-6 rounded-sm border border-[#C9A46A]/40 shadow-2xl">
            <div className="space-y-1">
              <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-[#C9A46A] block">
                {customGlbSource.url
                  ? lang === 'en'
                    ? 'LOADING .GLB MODEL'
                    : lang === 'zh'
                    ? '正在加载 .GLB 模型'
                    : 'ĐANG NẠP MÔ HÌNH .GLB'
                  : lang === 'en'
                  ? '3D EXHIBITION STAGE'
                  : lang === 'zh'
                  ? '三维展厅舞台'
                  : 'KHÔNG GIAN TRƯNG BÀY 3D'}
              </span>
              <h4 className="font-serif font-bold text-lg text-[#D8C9A9]">{localizedCurrentSite.officialName}</h4>
            </div>
            <div className="space-y-1.5">
              <div className="w-full bg-[#D8C9A9]/15 h-1 rounded-full overflow-hidden">
                <div
                  className="bg-[#C9A46A] h-full transition-all duration-200 rounded-full"
                  style={{ width: `${Math.max(15, loadingProgress)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] font-sans font-medium text-[#D8C9A9]/80 tabular-nums">
                <span>
                  {lang === 'en'
                    ? 'Preparing spatial mesh'
                    : lang === 'zh'
                    ? '准备空间几何数据'
                    : 'Đang nạp dữ liệu mô hình'}
                </span>
                <span>{loadingProgress}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1B. ARCHIVAL .GLB-ONLY EMPTY / DIRECT UPLOAD CARD FOR DINH ĐỘC LẬP & BẠCH DINH */}
      {!isLoadingModel &&
        viewTwinMode === '3d_cad_pbr' &&
        isGlbOnlySite &&
        (!customGlbSource.url || Boolean(customGlbError)) && (
          <div className="absolute inset-0 z-25 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto max-w-md w-[94vw] md:w-full rounded-sm bg-[#171817]/95 border border-[#C9A46A]/45 p-5 md:p-6 shadow-2xl space-y-4 text-left">
              <div className="space-y-1.5 border-b border-[#D8C9A9]/15 pb-3">
                <span className="text-[10.5px] font-sans font-semibold uppercase tracking-[0.14em] text-[#C9A46A] block">
                  {lang === 'en'
                    ? 'AUTHENTIC .GLB ARCHIVE REQUIRED'
                    : lang === 'zh'
                    ? '需要真实 .GLB 三维模型'
                    : 'DỮ LIỆU MÔ HÌNH .GLB THỰC TẾ'}
                </span>
                <h3 className="font-serif text-lg font-bold text-[#D8C9A9] leading-snug">
                  {localizedCurrentSite.officialName}
                </h3>
                <p className="text-xs text-[#D8C9A9]/80 leading-relaxed">
                  {customGlbError
                    ? lang === 'en'
                      ? `Could not load .glb file (${customGlbError}). Please select a valid .glb file from your computer.`
                      : lang === 'zh'
                      ? `无法加载 .glb 文件（${customGlbError}）。请从本地选择有效的 .glb 文件。`
                      : `Không thể tải tệp .glb (${customGlbError}). Vui lòng chọn lại tệp .glb hợp lệ từ máy tính.`
                    : lang === 'en'
                    ? 'Procedural geometry has been removed for this monument. Upload a real .glb file from your computer to inspect it directly in the 3D gallery.'
                    : lang === 'zh'
                    ? '本遗产已移除手绘几何块。请从电脑选择真实 .glb 三维文件以在展厅中实时浏览。'
                    : 'Di tích này chỉ hiển thị mô hình 3D thực tế định dạng .glb (đã xóa toàn bộ khối dựng thủ công). Nạp tệp .glb từ máy tính để xem trực tiếp.'}
                </p>
              </div>

              <input
                ref={directGlbInputRef}
                type="file"
                accept=".glb,.gltf,model/gltf-binary"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setIsSavingDirectGlb(true);
                  setCustomGlbError(null);
                  try {
                    await saveGlbFileToIndexedDB(currentSite.id, file);
                  } catch (err) {
                    setCustomGlbError(
                      err instanceof Error ? err.message : 'Không thể lưu tệp .glb vào trình duyệt'
                    );
                  } finally {
                    setIsSavingDirectGlb(false);
                  }
                }}
                className="hidden"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={isSavingDirectGlb}
                  onClick={() => directGlbInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm bg-[#C9A46A] hover:bg-[#D8C9A9] text-[#171817] text-xs font-semibold cursor-pointer transition-colors disabled:opacity-60"
                >
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isSavingDirectGlb
                      ? lang === 'en'
                        ? 'Saving .glb...'
                        : lang === 'zh'
                        ? '正在保存 .glb...'
                        : 'Đang nạp tệp .glb...'
                      : lang === 'en'
                      ? 'Choose .glb file from computer'
                      : lang === 'zh'
                      ? '从电脑选择 .glb 文件'
                      : 'Chọn tệp .glb từ máy tính'}
                  </span>
                </button>
                <span className="text-[11px] font-sans text-[#D8C9A9]/60 tabular-nums">
                  {currentSite.identifierCode}
                </span>
              </div>
            </div>
          </div>
        )}

      {/* 1F. ACTIVE CUSTOM .GLB (SESSION RAM / INDEXEDDB / CLOUD) BADGE */}
      {customGlbSource.url &&
        (!isCurrentModelHidden || canPreviewHidden || customGlbSource.kind === 'session_temp') &&
        viewTwinMode === '3d_cad_pbr' && (
          <div className="pointer-events-auto absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#171817] border border-[#C9A46A]/65 text-[#D8C9A9] text-[11px] shadow-lg max-w-[92vw]">
            <Box className="w-3.5 h-3.5 text-[#C9A46A] shrink-0" />
            <span className="truncate font-medium">
              {customGlbError
                ? isGlbOnlySite
                  ? lang === 'en'
                    ? `.GLB load failed (${customGlbError})`
                    : lang === 'zh'
                    ? `.GLB 加载失败（${customGlbError}）`
                    : `Lỗi .GLB (${customGlbError})`
                  : `Lỗi .GLB (${customGlbError}) — Đang dùng mô hình mặc định`
                : customGlbSource.kind === 'session_temp'
                ? `Tạm RAM · ${customGlbSource.fileName} (${formatGlbFileSize(customGlbSource.fileSize)})`
                : customGlbSource.kind === 'indexeddb'
                ? `IndexedDB: ${customGlbSource.fileName} (${formatGlbFileSize(customGlbSource.fileSize)})`
                : `Cloud .GLB: ${customGlbSource.fileName}`}
            </span>
            {(customGlbSource.kind === 'session_temp' || isAdmin) && (
              <button
                type="button"
                onClick={() => {
                  if (customGlbSource.kind === 'session_temp') {
                    clearSessionTempGlb(currentSite.id);
                    setTempGlbNotice(null);
                  } else {
                    void clearAllCustomGlbForSite(currentSite.id);
                  }
                }}
                className="px-2 py-0.5 rounded-sm bg-[#A94F3D] hover:bg-[#8E3F2F] text-[#D8C9A9] text-[10px] font-semibold cursor-pointer shrink-0 inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>{customGlbSource.kind === 'session_temp' ? 'Gỡ tệp thử' : 'Khôi phục gốc'}</span>
              </button>
            )}
          </div>
        )}

      {/* 2. REAL FIELD PHOTOGRAMMETRY TWIN VIEW (VR 360°) */}
      {viewTwinMode === 'real_field_360' && (
        <div className="absolute inset-0 z-30 w-full h-full bg-black">
          <VR360Viewer
            site={currentSite}
            onClose={() => setViewTwinMode('3d_cad_pbr')}
            onLaunch3D={() => setViewTwinMode('3d_cad_pbr')}
            onSwitchSite={(s) => handleSwitchLandmark(s)}
          />
        </div>
      )}

      {/* 2B. TRẠNG THÁI "ĐANG HOÀN THIỆN 3D" CHO 9 ĐỊA ĐIỂM LIÊN VÙNG (ẩn khi đã nạp .GLB thật) */}
      {!isGettyLanding && !customGlbSource.url && isUnderConstructionSite(currentSite.id) && viewTwinMode === '3d_cad_pbr' && (
        <>
          {!isUnderConstructionCardMinimized ? (
            <div className="absolute inset-0 z-25 flex items-center justify-center p-3 sm:p-6 pointer-events-none">
              <div
                className="relative max-w-2xl w-full rounded-3xl border border-amber-400/35 shadow-[0_24px_80px_rgba(0,0,0,0.88)] overflow-hidden pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
                style={{
                  backgroundColor: 'rgba(11, 15, 25, 0.84)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                }}
              >
                {/* Lưới kỹ thuật CAD (3D Hologram Wireframe Pattern) phủ mờ làm nền */}
                <div
                  className="absolute inset-0 opacity-15 pointer-events-none"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, rgba(212,175,97,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.28) 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                  }}
                />

                <div className="relative z-10 p-4 sm:p-6 space-y-4">
                  {/* Header Badge & Nút thu gọn xem Sa bàn 3D Hologram Wireframe đang xoay */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 font-sans text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span>
                          {currentSite.address.city === 'Thành phố Hồ Chí Minh'
                            ? 'Đang phát triển'
                            : 'Đang hoàn thiện 3D'}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 font-sans text-[11px] font-medium">
                        <Box className="w-3 h-3 animate-spin" />
                        <span>3D Hologram Wireframe</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsUnderConstructionCardMinimized(true)}
                      className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-[11px] font-sans text-[#DFCE9D] transition-all cursor-pointer flex items-center gap-1.5"
                      title="Thu gọn bảng thông báo để xoay xem trực tiếp Khối Sa Bàn Lưới 3D (3D Hologram Wireframe)"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem Sa bàn Hologram 3D</span>
                    </button>
                  </div>

                  {/* Khung ảnh minh họa di tích + Tóm tắt lịch sử & Liên kết vùng */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                    <div className="sm:col-span-5 relative rounded-2xl overflow-hidden border border-white/15 bg-black/70 aspect-[4/3] group">
                      {activeViewerPhoto && !viewerPhotoFailed ? (
                        <>
                          <img
                            src={activeViewerPhoto}
                            alt={UNDER_CONSTRUCTION_SITE_LABELS[currentSite.id]}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onError={() => setViewerPhotoFailed(true)}
                            className="w-full h-full object-cover filter brightness-90 contrast-105 transition-transform duration-500 group-hover:scale-105"
                          />
                          <div
                            className="absolute inset-0 pointer-events-none opacity-35"
                            style={{
                              backgroundImage:
                                'linear-gradient(to right, rgba(56,189,248,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.4) 1px, transparent 1px)',
                              backgroundSize: '20px 20px',
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/80 border border-amber-400/40 text-[11px] font-sans font-medium text-amber-300">
                            {currentSite.address.city}
                          </div>
                          <div className="absolute top-2.5 right-2.5 z-10 inline-flex items-center rounded-full bg-black/85 border border-white/20 p-0.5">
                            <button
                              type="button"
                              onClick={() => setActiveViewerPhotoIdx(0)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold cursor-pointer transition-colors ${
                                activeViewerPhotoIdx === 0
                                  ? 'bg-[#C9A46A] text-[#171817]'
                                  : 'text-[#D8C9A9]/80 hover:text-white'
                              }`}
                            >
                              {lang === 'en' ? 'Photo 01' : lang === 'zh' ? '实景 01' : 'Ảnh 01'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveViewerPhotoIdx(1)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold cursor-pointer transition-colors ${
                                activeViewerPhotoIdx === 1
                                  ? 'bg-[#C9A46A] text-[#171817]'
                                  : 'text-[#D8C9A9]/80 hover:text-white'
                              }`}
                            >
                              {lang === 'en' ? 'Photo 02' : lang === 'zh' ? '实景 02' : 'Ảnh 02'}
                            </button>
                          </div>
                          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-sans font-medium text-[#DFCE9D] tabular-nums">
                            <span>Mã: {currentSite.identifierCode}</span>
                            <span>Niên đại: {currentSite.commencementYear > 0 ? currentSite.commencementYear : 'TK III TCN'}</span>
                          </div>
                        </>
                      ) : (
                        <HeritageTypographicPlate site={currentSite} variant="catalog" />
                      )}
                    </div>

                    {/* Nội dung Tóm tắt Lịch sử, Liên kết vùng & Thông báo chính thức */}
                    <div className="sm:col-span-7 space-y-2.5 text-left">
                      <div>
                        <span className="text-xs font-sans font-medium text-[#D4AF61] block">
                          {UNDER_CONSTRUCTION_REGIONAL_LINKS[currentSite.id]?.subtitle || 'Di sản Liên vùng Đông Nam Bộ'}
                        </span>
                        <h3 className="font-serif font-bold text-lg sm:text-xl text-[#F5EFE6] leading-snug mt-0.5">
                          {UNDER_CONSTRUCTION_SITE_LABELS[currentSite.id]}
                        </h3>
                      </div>

                      {/* Bảng Tóm tắt Lịch sử & Liên kết vùng */}
                      <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-1">
                        <p className="text-[11.5px] text-neutral-200 leading-relaxed line-clamp-2">
                          <strong className="text-[#DFCE9D]">Tóm tắt lịch sử:</strong> {currentSite.summary}
                        </p>
                        <p className="text-[11.5px] text-emerald-300 font-sans">
                          🔗 {UNDER_CONSTRUCTION_REGIONAL_LINKS[currentSite.id]?.linkedText}
                        </p>
                      </div>

                      {/* Câu thông báo bắt buộc theo đúng yêu cầu */}
                      <div className="p-3 rounded-2xl bg-amber-500/[0.09] border border-amber-400/40 shadow-inner">
                        <p className="text-xs sm:text-[13px] text-[#F5EFE6] leading-relaxed font-sans">
                          &ldquo;Mô hình 3D giải phẫu kiến trúc của di tích này đang trong quá trình đo đạc &amp; hoàn thiện dữ liệu không gian. Đăng ký nhận thông báo hoặc trải nghiệm trước Thuyết minh Lịch sử Liên vùng bên dưới.&rdquo;
                        </p>
                      </div>

                      {/* 2 Nút hành động: Đăng ký nhận thông báo & Trải nghiệm trước Thuyết minh Lịch sử Liên vùng */}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setNotifiedSiteIds((prev) => ({ ...prev, [currentSite.id]: true }))
                          }
                          className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                            notifiedSiteIds[currentSite.id]
                              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                              : 'bg-white/[0.07] hover:bg-white/[0.14] border-white/15 text-[#DFCE9D]'
                          }`}
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>
                            {notifiedSiteIds[currentSite.id]
                              ? 'Đã đăng ký nhận thông báo 3D!'
                              : 'Đăng ký nhận thông báo'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const targetRoute =
                              UNDER_CONSTRUCTION_REGIONAL_LINKS[currentSite.id]?.routeId || 'TOUR-INTER-01';
                            setActiveStartupRouteId(targetRoute);
                            setIsUnderConstructionCardMinimized(true);
                            setIsTourGuideOpen(true);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#D4AF61] to-[#e5c168] hover:brightness-110 text-black font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                        >
                          <span>🎙️ Trải nghiệm Thuyết minh Lịch sử Liên vùng</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Thanh trạng thái thu gọn ở góc trên bên trái khi người dùng đang xoay xem trực tiếp Khối Sa bàn 3D Hologram Wireframe */
            <div className="absolute top-20 left-4 z-25 max-w-md p-3 rounded-2xl bg-black/90 backdrop-blur-xl border border-amber-400/40 shadow-2xl pointer-events-auto flex items-center justify-between gap-3 animate-in fade-in">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <span className="text-[11px] font-sans text-amber-300 font-semibold">
                    3D Hologram Wireframe · Đang hoàn thiện 3D
                  </span>
                </div>
                <div className="text-xs font-serif font-bold text-[#F5EFE6] truncate mt-0.5">
                  {UNDER_CONSTRUCTION_SITE_LABELS[currentSite.id]}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUnderConstructionCardMinimized(false)}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-semibold shrink-0 cursor-pointer transition-all"
              >
                Mở Tóm tắt
              </button>
            </div>
          )}
        </>
      )}

      {/* SVG HOTSPOT CONNECTOR BEAM */}
      {showHotspots && activeFeature && hotspotScreenPos && containerRef.current && (
        <svg className="absolute inset-0 pointer-events-none z-20 w-full h-full">
          <defs>
            <linearGradient id="heritageBeam" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9A15B" stopOpacity="0.3" />
              <stop offset="80%" stopColor="#DFCE9D" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
            </linearGradient>
            <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {(() => {
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            const cardAnchorX = Math.min(380, w * 0.42);
            const cardAnchorY = Math.max(80, h - 180);
            const midX = (cardAnchorX + hotspotScreenPos.x) / 2;
            const midY = Math.min(cardAnchorY, hotspotScreenPos.y) - 30;

            return (
              <g>
                <path
                  d={`M ${cardAnchorX} ${cardAnchorY} Q ${midX} ${midY}, ${hotspotScreenPos.x} ${hotspotScreenPos.y}`}
                  fill="none"
                  stroke="url(#heritageBeam)"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                  filter="url(#goldGlow)"
                />
                <circle cx={cardAnchorX} cy={cardAnchorY} r="3.5" fill="#C9A15B" stroke="#ffffff" strokeWidth="1" />
              </g>
            );
          })()}

          {/* Target Beacon Ring on 3D Model */}
          <circle
            cx={hotspotScreenPos.x}
            cy={hotspotScreenPos.y}
            r="16"
            fill="rgba(201, 161, 91, 0.2)"
            stroke="#C9A15B"
            strokeWidth="1.5"
            className="animate-ping"
            style={{ transformOrigin: `${hotspotScreenPos.x}px ${hotspotScreenPos.y}px` }}
          />
          <circle cx={hotspotScreenPos.x} cy={hotspotScreenPos.y} r="6" fill="#DFCE9D" stroke="#000000" strokeWidth="1.5" />
          <circle cx={hotspotScreenPos.x} cy={hotspotScreenPos.y} r="2" fill="#000000" />
        </svg>
      )}

          {/* TOP-LEFT COMPACT APPLE PILL: CURRENT MONUMENT TITLE (CLICKABLE TO OPEN 17-SITE LIST) */}
          {!isGettyLanding && viewTwinMode === '3d_cad_pbr' && (
            <div
              className={`absolute top-4 left-4 ${
                isSiteDropdownOpen && siteDropdownAnchor === 'top' ? 'z-[999]' : 'z-20'
              } flex flex-wrap items-center gap-2 pointer-events-auto`}
            >
              <div ref={topSiteDropdownRef} className="relative z-[999] pointer-events-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (isSiteDropdownOpen && siteDropdownAnchor === 'top') {
                      setIsSiteDropdownOpen(false);
                    } else {
                      setSiteDropdownAnchor('top');
                      setIsSiteDropdownOpen(true);
                    }
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={isSiteDropdownOpen && siteDropdownAnchor === 'top'}
                  title={
                    lang === 'en'
                      ? `Click to switch among ${allSites.length} monuments`
                      : lang === 'zh'
                      ? `点击快速切换 ${allSites.length} 处遗产`
                      : `Bấm để chọn nhanh trong ${allSites.length} Di tích`
                  }
                  className="rounded-full bg-[#1D1D1F]/80 hover:bg-[#272729]/90 backdrop-blur-2xl border border-white/10 hover:border-[#C5A059]/50 px-4 py-1.5 shadow-lg flex items-center gap-2.5 transition-all cursor-pointer"
                >
                  <span className="text-[11px] font-sans text-[#D4AF37] font-semibold tabular-nums">
                    {String(currentSiteIndex + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-medium text-[#F5F5F7] truncate max-w-[180px] sm:max-w-[260px]">
                    {localizedCurrentSite.officialName}
                  </span>
                  {isCurrentSiteOrModelHidden && canPreviewHidden && (
                    <span className="px-2 py-0.5 rounded-sm bg-[#171817] border border-[#C9A46A] text-[#C9A46A] text-[10px] font-semibold shrink-0">
                      {lang === 'en'
                        ? 'Tester Preview · Hidden'
                        : lang === 'zh'
                        ? '隐藏草稿 · 测试模式'
                        : 'Đang ẩn · Chế độ Tester'}
                    </span>
                  )}
                  <span
                    ref={azimuthSpanRef}
                    className="hidden md:inline text-[11px] font-sans text-[#86868B] tabular-nums"
                  >
                    0°
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#86868B] shrink-0 transition-transform ${
                      isSiteDropdownOpen && siteDropdownAnchor === 'top' ? 'rotate-180 text-[#C5A059]' : ''
                    }`}
                  />
                </button>

                {isSiteDropdownOpen && siteDropdownAnchor === 'top' && (
                  <div
                    role="listbox"
                    aria-label={
                      lang === 'en'
                        ? `List of ${allSites.length} Monuments`
                        : lang === 'zh'
                        ? `${allSites.length} 处遗产列表`
                        : `Danh sách ${allSites.length} Di tích`
                    }
                    className="absolute top-full left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-[60vh] overflow-y-auto ar-modal-scrollbar rounded-2xl bg-[#161618]/95 backdrop-blur-2xl border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.9)] p-2 z-[999] pointer-events-auto space-y-1"
                  >
                    <div className="px-3 py-1.5 text-[11px] font-medium text-[#86868B] flex items-center justify-between border-b border-white/[0.08] mb-1">
                      <span>
                        {lang === 'en'
                          ? `${allSites.length} Southern Monuments`
                          : lang === 'zh'
                          ? `${allSites.length} 处东南部遗产`
                          : `${allSites.length} Di tích Đông Nam Bộ`}
                      </span>
                      <span className="text-[#C5A059]">TP.HCM · BD · BR-VT</span>
                    </div>
                    {allSites.map((s, idx) => {
                      const isSelected = s.id === currentSite.id;
                      const isHidden =
                        hiddenSiteIds.includes(s.id) || cmsOverrides[s.id]?.modelVisibility === 'hidden';
                      const locSite = getLocalizedSite(s);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            handleSwitchLandmark(s);
                            setIsSiteDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-[#C5A059]/15 border border-[#C5A059]/45 text-[#F5F5F7] font-semibold'
                              : 'text-[#F5F5F7]/85 border border-transparent hover:bg-white/[0.08]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`font-sans text-[11px] shrink-0 tabular-nums ${
                                isSelected ? 'text-[#C5A059] font-bold' : 'text-[#86868B]'
                              }`}
                            >
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="truncate">{locSite.officialName}</span>
                            {isHidden && canPreviewHidden && (
                              <span
                                className="px-1.5 py-0.5 rounded-sm bg-[#171817] border border-[#C9A46A] text-[#C9A46A] text-[9px] font-semibold shrink-0"
                                title={
                                  lang === 'en'
                                    ? 'Tester Preview · Hidden'
                                    : lang === 'zh'
                                    ? '隐藏草稿 · 测试模式'
                                    : 'Đang ẩn · Chế độ Tester'
                                }
                              >
                                {lang === 'en'
                                  ? 'Tester Preview · Hidden'
                                  : lang === 'zh'
                                  ? '隐藏草稿'
                                  : 'Đang ẩn · Tester'}
                              </span>
                            )}
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[#C5A059]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {(spatialSpotlight || isMysteryModeActive) && (
                <button
                  type="button"
                  onClick={() => {
                    setSpatialSpotlight(null);
                    setIsMysteryModeActive(false);
                    setExplodedFactor(0);
                    setRenderMode('textured');
                    handleSetPreset('iso');
                  }}
                  className="rounded-full bg-[#C5A059] hover:bg-[#DFC286] text-[#121110] px-3.5 py-1.5 text-xs font-semibold shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'en'
                      ? 'Restore Full View'
                      : lang === 'zh'
                      ? '恢复全景视角'
                      : 'Khôi phục toàn cảnh'}
                  </span>
                </button>
              )}

              <div className="hidden sm:flex items-center rounded-full bg-[#1D1D1F]/85 border border-white/12 p-1 shadow-lg gap-0.5">
                {(['studio', 'day', 'golden', 'night'] as LightingMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setLightingMode(mode)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      lightingMode === mode
                        ? 'bg-[#C5A059] text-[#121110] font-semibold shadow-sm'
                        : 'text-[#A1A1A6] hover:text-[#F5F5F7]'
                    }`}
                  >
                    {mode === 'studio'
                      ? lang === 'zh'
                        ? '展馆'
                        : 'Studio'
                      : mode === 'day'
                      ? lang === 'en'
                        ? 'Day'
                        : lang === 'zh'
                        ? '白天'
                        : 'Ngày'
                      : mode === 'golden'
                      ? lang === 'en'
                        ? 'Sunset'
                        : lang === 'zh'
                        ? '黄昏'
                        : 'Hoàng hôn'
                      : lang === 'en'
                      ? 'Night'
                      : lang === 'zh'
                      ? '夜晚'
                      : 'Đêm'}
                  </button>
                ))}
              </div>

              {isTesterPro && (
                <div className="flex items-center gap-1.5">
                  <input
                    ref={tempGlbInputRef}
                    type="file"
                    accept=".glb,.gltf,model/gltf-binary"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      try {
                        const meta = setSessionTempGlb(currentSite.id, file);
                        setTempGlbNotice(
                          `Đã nạp thử RAM: ${meta.fileName} (${formatGlbFileSize(meta.fileSize)})`
                        );
                      } catch (err) {
                        setTempGlbNotice(
                          err instanceof Error ? err.message : 'Không thể nạp tệp .glb cục bộ.'
                        );
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => tempGlbInputRef.current?.click()}
                    className="rounded-full bg-[#47796D] hover:bg-[#3A655B] border border-[#C9A46A]/65 text-[#D8C9A9] px-3 py-1.5 text-[11px] font-semibold shadow-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    title="Dùng URL.createObjectURL nạp thử mô hình .glb trong RAM phiên làm việc (không lưu vào IndexedDB/dữ liệu gốc)"
                  >
                    <Upload className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {lang === 'en'
                        ? 'Load Temp .GLB'
                        : lang === 'zh'
                        ? '临时加载 .GLB'
                        : 'Nạp thử tệp .glb cục bộ'}
                    </span>
                  </button>
                  {tempGlbNotice && (
                    <span className="hidden xl:inline px-2 py-1 rounded-sm bg-[#171817]/90 border border-[#C9A46A]/50 text-[#D8C9A9] text-[10px]">
                      {tempGlbNotice}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TOP-RIGHT APPLE VISIONOS QUICK PILLS: VR 360° | XƯA & NAY | CHI TIẾT */}
          {!isGettyLanding && viewTwinMode === '3d_cad_pbr' && (
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={() => setViewTwinMode('real_field_360')}
                className="rounded-full bg-[#1D1D1F]/80 backdrop-blur-2xl border border-white/10 hover:border-white/25 px-3.5 py-1.5 text-xs font-medium text-[#F5F5F7] transition-all cursor-pointer shadow-lg"
              >
                VR 360°
              </button>
              <button
                type="button"
                onClick={() => setIsLisboaSplitOpen(true)}
                className="hidden sm:inline-flex rounded-full bg-[#1D1D1F]/80 backdrop-blur-2xl border border-white/10 hover:border-white/25 px-3.5 py-1.5 text-xs font-medium text-[#F5F5F7] transition-all cursor-pointer shadow-lg"
              >
                {lang === 'en' ? 'Before & After' : lang === 'zh' ? '古今对比' : 'Xưa & Nay'}
              </button>
              {isRightPanelCollapsed && (
                <button
                  type="button"
                  onClick={() => setIsRightPanelCollapsed(false)}
                  className="rounded-full bg-[#1D1D1F]/85 backdrop-blur-2xl border border-white/15 hover:border-[#D4AF37]/60 px-4 py-1.5 text-xs font-medium text-[#F5F5F7] flex items-center gap-1.5 shadow-lg cursor-pointer transition-all"
                >
                  <Info className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>{lang === 'en' ? 'Details' : lang === 'zh' ? '详情' : 'Chi tiết'}</span>
                </button>
              )}
            </div>
          )}

          {/* INTERACTIVE HOTSPOT PINS ON 3D MODEL (NUMBERS I..VI) */}
          {!isGettyLanding &&
            viewTwinMode === '3d_cad_pbr' &&
            showHotspots &&
            projectedBadges.map((b, idx) => {
              const isSelectedFeat = activeFeature?.id === b.id;
              const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
              const roman = romanNumerals[idx] || String(idx + 1);
              return (
                <button
                  key={`hotspot-pin-${b.id}`}
                  type="button"
                  onClick={() => {
                    flyToFeature(b.feat);
                    setIsRightPanelCollapsed(false);
                  }}
                  style={{
                    left: `${b.x}px`,
                    top: `${b.y}px`,
                  }}
                  className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center font-serif text-[11px] font-semibold border shadow-lg transition-all hover:scale-110 cursor-pointer ${
                    isSelectedFeat
                      ? 'bg-[#0071E3] text-white border-white scale-110'
                      : 'bg-[#1D1D1F]/90 text-[#F5F5F7] border-white/25 hover:border-[#D4AF37]'
                  }`}
                  title={`${roman}. ${b.feat.name}`}
                >
                  {roman}
                </button>
              );
            })}

          {/* =====================================================================
              SINGLE APPLE VISIONOS BOTTOM FROSTED PILL DOCK (DESKTOP >= 768px)
              [ Dinh Độc Lập ▾ | Nguyên bản | Bóc tách 3D | X-Ray | Nội thất | 🔊 Thuyết minh | ✦ Hỏi Gemini AI ]
             ===================================================================== */}
          {!isGettyLanding && viewTwinMode === '3d_cad_pbr' && (
            <>
            <div
              className={`hidden md:flex fixed bottom-5 left-1/2 -translate-x-1/2 ${
                isSiteDropdownOpen && siteDropdownAnchor === 'bottom' ? 'z-[999]' : 'z-40'
              } pointer-events-auto rounded-full bg-[#1D1D1F]/90 backdrop-blur-2xl border border-white/15 px-2 xl:px-2.5 py-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] items-center gap-1 xl:gap-1.5 max-w-[96vw] overflow-visible`}
            >
              {/* 1. Dropdown chọn di tích (mở Popover lên trên) + cặp nút Lùi / Tiến (‹ ›) */}
              <div ref={siteDropdownRef} className="relative z-[999] pointer-events-auto flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (isSiteDropdownOpen && siteDropdownAnchor === 'bottom') {
                      setIsSiteDropdownOpen(false);
                    } else {
                      setSiteDropdownAnchor('bottom');
                      setIsSiteDropdownOpen(true);
                    }
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={isSiteDropdownOpen && siteDropdownAnchor === 'bottom'}
                  className="relative z-[999] pointer-events-auto h-8 px-2.5 xl:px-3 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-medium text-[#F5F5F7] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span className="font-sans text-[11px] text-[#C5A059] font-semibold tabular-nums">
                    {String(currentSiteIndex + 1).padStart(2, '0')}
                  </span>
                  <span className="truncate max-w-[105px] sm:max-w-[135px] xl:max-w-[165px]">
                    {localizedCurrentSite.officialName}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#86868B] shrink-0 transition-transform ${
                      isSiteDropdownOpen && siteDropdownAnchor === 'bottom' ? 'rotate-180 text-[#C5A059]' : ''
                    }`}
                  />
                </button>

                {/* Cặp nút chuyển nhanh Lùi / Tiến (‹ ›) */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handlePrevSite}
                    aria-label={
                      lang === 'en'
                        ? 'Previous monument'
                        : lang === 'zh'
                        ? '上一处遗迹'
                        : 'Di tích trước'
                    }
                    title={
                      lang === 'en'
                        ? 'Previous monument'
                        : lang === 'zh'
                        ? '上一处遗迹'
                        : 'Di tích trước (Lùi)'
                    }
                    className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.18] backdrop-blur-xl border border-white/15 hover:border-[#C5A059]/50 text-[#F5F5F7] flex items-center justify-center text-sm leading-none transition-all cursor-pointer"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={handleNextSite}
                    aria-label={
                      lang === 'en'
                        ? 'Next monument'
                        : lang === 'zh'
                        ? '下一处遗迹'
                        : 'Di tích tiếp theo'
                    }
                    title={
                      lang === 'en'
                        ? 'Next monument'
                        : lang === 'zh'
                        ? '下一处遗迹'
                        : 'Di tích tiếp theo (Tiến)'
                    }
                    className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.18] backdrop-blur-xl border border-white/15 hover:border-[#C5A059]/50 text-[#F5F5F7] flex items-center justify-center text-sm leading-none transition-all cursor-pointer"
                  >
                    ›
                  </button>
                </div>

                {isSiteDropdownOpen && siteDropdownAnchor === 'bottom' && (
                  <div
                    role="listbox"
                    aria-label={
                      lang === 'en'
                        ? `List of ${allSites.length} Monuments`
                        : lang === 'zh'
                        ? `${allSites.length} 处遗产列表`
                        : `Danh sách ${allSites.length} Di tích`
                    }
                    className="absolute bottom-full left-0 mb-3 w-80 max-w-[calc(100vw-2rem)] max-h-[60vh] overflow-y-auto ar-modal-scrollbar rounded-2xl bg-[#161618]/95 backdrop-blur-2xl border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.9)] p-2 z-[999] pointer-events-auto space-y-1"
                  >
                    <div className="px-3 py-1.5 text-[11px] font-medium text-[#86868B] flex items-center justify-between border-b border-white/[0.08] mb-1">
                      <span>
                        {lang === 'en'
                          ? `${allSites.length} Southern Monuments`
                          : lang === 'zh'
                          ? `${allSites.length} 处东南部遗产`
                          : `${allSites.length} Di tích Đông Nam Bộ`}
                      </span>
                      <span className="text-[#C5A059]">TP.HCM · BD · BR-VT</span>
                    </div>
                    {allSites.map((s, idx) => {
                      const isSelected = s.id === currentSite.id;
                      const isHidden =
                        hiddenSiteIds.includes(s.id) || cmsOverrides[s.id]?.modelVisibility === 'hidden';
                      const locSite = getLocalizedSite(s);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            handleSwitchLandmark(s);
                            setIsSiteDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-[#C5A059]/15 border border-[#C5A059]/45 text-[#F5F5F7] font-semibold'
                              : 'text-[#F5F5F7]/85 border border-transparent hover:bg-white/[0.08]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`font-sans text-[11px] shrink-0 tabular-nums ${
                                isSelected ? 'text-[#C5A059] font-bold' : 'text-[#86868B]'
                              }`}
                            >
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="truncate">{locSite.officialName}</span>
                            {isHidden && canPreviewHidden && (
                              <span
                                className="px-1.5 py-0.5 rounded-sm bg-[#171817] border border-[#C9A46A] text-[#C9A46A] text-[9px] font-semibold shrink-0"
                                title={
                                  lang === 'en'
                                    ? 'Tester Preview · Hidden'
                                    : lang === 'zh'
                                    ? '隐藏草稿 · 测试模式'
                                    : 'Đang ẩn · Chế độ Tester'
                                }
                              >
                                {lang === 'en'
                                  ? 'Tester Preview · Hidden'
                                  : lang === 'zh'
                                  ? '隐藏草稿'
                                  : 'Đang ẩn · Tester'}
                              </span>
                            )}
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[#C5A059]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="h-4 w-[1px] bg-white/12 shrink-0 hidden sm:block" />

              {/* 2. Chuyển chế độ 3D (Nguyên bản | Bóc tách 3D | X-Ray | Nội thất) */}
              <div className="flex items-center gap-0.5 xl:gap-1 rounded-full bg-white/[0.04] p-0.5 min-w-0 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => {
                    switchToThreeJs('textured');
                    setSectionCutActive(false);
                    setExplodedFactor(0);
                    handleSetPreset('iso');
                  }}
                  className={`inline-flex items-center justify-center shrink-0 h-8 px-2.5 xl:px-3 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    renderMode === 'textured' && !sectionCutActive && explodedFactor === 0
                      ? 'bg-[#F5F5F7] text-black'
                      : 'text-[#86868B] hover:text-[#F5F5F7]'
                  }`}
                >
                  {lang === 'en' ? 'Original' : lang === 'zh' ? '原貌' : 'Nguyên bản'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    switchToThreeJs('textured');
                    setSectionCutActive(false);
                    const nextFactor = explodedFactor > 0.2 ? 0 : 0.65;
                    setExplodedFactor(nextFactor);
                    if (nextFactor > 0) {
                      flyCameraTo([22, 20, 28], [0, 6.2, 0], 800);
                      trackPlatformInteraction('tech_3d_xray', currentSite.id);
                    } else {
                      handleSetPreset('iso');
                    }
                  }}
                  className={`inline-flex items-center justify-center shrink-0 h-8 px-2.5 xl:px-3 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    explodedFactor > 0 && renderMode !== 'xray' && !sectionCutActive
                      ? 'bg-[#F5F5F7] text-black'
                      : 'text-[#86868B] hover:text-[#F5F5F7]'
                  }`}
                >
                  {lang === 'en' ? '3D Exploded' : lang === 'zh' ? '3D拆解' : 'Bóc tách 3D'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    switchToThreeJs('xray');
                    setSectionCutActive(false);
                    setExplodedFactor(0.28);
                    flyCameraTo([-20, 17, 25], [0, 5.5, 0], 800);
                    trackPlatformInteraction('tech_3d_xray', currentSite.id);
                  }}
                  className={`inline-flex items-center justify-center shrink-0 h-8 px-2.5 xl:px-3 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    renderMode === 'xray'
                      ? 'bg-[#F5F5F7] text-black'
                      : 'text-[#86868B] hover:text-[#F5F5F7]'
                  }`}
                >
                  {lang === 'en' ? 'X-Ray' : lang === 'zh' ? 'X光透视' : 'X-Ray'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    switchToThreeJs('textured');
                    const nextCut = !sectionCutActive;
                    setSectionCutActive(nextCut);
                    if (currentSite.id === 'HCM-DT-001') {
                      setExplodedFactor(0);
                      if (nextCut) {
                        setSectionHeight(14);
                        setIsRightPanelCollapsed(false);
                        flyCameraTo([0, 7.8, 22.5], [0, 4.2, -1.2], 800);
                      } else {
                        handleSetPreset('iso');
                      }
                    } else if (currentSite.id === 'BRVT-DT-002') {
                      setExplodedFactor(0);
                      if (nextCut) {
                        setSectionHeight(16);
                        setIsRightPanelCollapsed(false);
                        if (activeFeature?.id === 'f5') {
                          flyCameraTo([-3.8, 3.6, 11.8], [-10.6, 1.9, 8.2], 800);
                        } else {
                          flyCameraTo([1.2, 4.9, 2.2], [1.2, 3.4, -7.8], 800);
                        }
                      } else {
                        handleSetPreset('iso');
                      }
                    } else {
                      setExplodedFactor(nextCut ? 0.35 : 0);
                      if (nextCut) {
                        const optimalCutHeight =
                          currentSite.id === 'HCM-DT-010'
                            ? 2.2
                            : currentSite.id === 'HCM-DT-009' ||
                              currentSite.id === 'BRVT-DT-003' ||
                              currentSite.id === 'BD-DT-002'
                            ? 7.5
                            : currentSite.id === 'BRVT-DT-001'
                            ? 10.5
                            : (NEW_NINE_SITE_IDS as readonly string[]).includes(currentSite.id)
                            ? 4.6
                            : 12;
                        setSectionHeight(optimalCutHeight);
                        setIsRightPanelCollapsed(false);
                        flyCameraTo([14, 10, 20], [0, 3.5, 0], 800);
                      } else {
                        handleSetPreset('iso');
                      }
                    }
                  }}
                  className={`inline-flex items-center justify-center shrink-0 h-8 px-2.5 xl:px-3 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    sectionCutActive
                      ? 'bg-[#F5F5F7] text-black'
                      : 'text-[#86868B] hover:text-[#F5F5F7]'
                  }`}
                >
                  {lang === 'en' ? 'Interior' : lang === 'zh' ? '室内' : 'Nội thất'}
                </button>
              </div>

              <div className="h-4 w-[1px] bg-white/12 shrink-0 hidden md:block" />

              {/* 3. Nút Thuyết minh & Video Tư Liệu */}
              <button
                type="button"
                onClick={() => {
                  if (onOpenAudioModal) {
                    onOpenAudioModal(currentSite);
                  } else {
                    setGuideSubMode('autotour');
                    setIsTourGuideOpen(true);
                    setIsGeminiAssistantOpen(false);
                    setAutoStartTourCounter((c) => c + 1);
                  }
                }}
                className="hidden sm:inline-flex items-center justify-center shrink-0 h-8 px-2.5 xl:px-3 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-xs font-medium text-[#F5F5F7] gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>{lang === 'en' ? 'Audio' : lang === 'zh' ? '语音' : 'Thuyết minh'}</span>
              </button>

              {onOpenVideoModal && (
                <button
                  type="button"
                  onClick={() => onOpenVideoModal(currentSite)}
                  className="hidden lg:inline-flex items-center justify-center shrink-0 h-8 px-2.5 xl:px-3 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-[#C5A059]/35 text-xs font-medium text-[#F5F5F7] gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Film className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>{lang === 'en' ? 'Video' : lang === 'zh' ? '纪录片' : 'Video Tư Liệu'}</span>
                </button>
              )}

              {/* 4. Nút Ask Gemini AI */}
              <button
                type="button"
                onClick={() => {
                  const willOpen = !isGeminiAssistantOpen;
                  setIsGeminiAssistantOpen(willOpen);
                  setIsTourGuideOpen(false);
                  if (willOpen) {
                    trackPlatformInteraction('tech_audio_ai', currentSite.id);
                  }
                }}
                className={`inline-flex items-center justify-center shrink-0 h-8 px-3 xl:px-3.5 rounded-full text-xs font-medium gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  isGeminiAssistantOpen
                    ? 'bg-[#0077ED] text-white ring-2 ring-white/40'
                    : 'bg-[#0071E3] hover:bg-[#0077ED] text-white'
                }`}
              >
                <span>✦</span>
                <span>{lang === 'en' ? 'Ask Gemini AI' : lang === 'zh' ? '问 Gemini AI' : 'Hỏi Gemini AI'}</span>
              </button>
            </div>

            {/* MOBILE (< 768px) COMPACT 3D BOTTOM BAR + COLLAPSIBLE DRAWER */}
            <div className="md:hidden fixed bottom-3 left-3 right-3 z-40 pointer-events-auto space-y-2">
              {isMobileControlsOpen && (
                <div className="rounded-sm bg-[#171817]/95 border border-[#C9A46A]/45 p-3.5 shadow-2xl space-y-3 max-h-[55dvh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-[#D8C9A9]/15 pb-2">
                    <span className="text-xs font-semibold text-[#C9A46A]">
                      {lang === 'en'
                        ? '3D Control Panel'
                        : lang === 'zh'
                        ? '3D 控制面板'
                        : 'Bảng điều khiển 3D'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMobileControlsOpen(false)}
                      className="px-2 py-0.5 rounded-sm bg-[#D8C9A9]/10 text-[#D8C9A9] text-xs cursor-pointer"
                    >
                      ×
                    </button>
                  </div>

                  {/* Render modes */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        switchToThreeJs('textured');
                        setSectionCutActive(false);
                        setExplodedFactor(0);
                        handleSetPreset('iso');
                      }}
                      className={`py-2 px-2 rounded-sm text-xs font-medium border cursor-pointer ${
                        renderMode === 'textured' && !sectionCutActive && explodedFactor === 0
                          ? 'bg-[#C9A46A] text-[#171817] border-[#C9A46A] font-semibold'
                          : 'bg-[#171817] text-[#D8C9A9] border-[#D8C9A9]/20'
                      }`}
                    >
                      {lang === 'en' ? 'Original' : lang === 'zh' ? '原貌' : 'Nguyên bản'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        switchToThreeJs('textured');
                        setSectionCutActive(false);
                        setExplodedFactor(explodedFactor > 0.2 ? 0 : 0.65);
                      }}
                      className={`py-2 px-2 rounded-sm text-xs font-medium border cursor-pointer ${
                        explodedFactor > 0 && renderMode !== 'xray' && !sectionCutActive
                          ? 'bg-[#C9A46A] text-[#171817] border-[#C9A46A] font-semibold'
                          : 'bg-[#171817] text-[#D8C9A9] border-[#D8C9A9]/20'
                      }`}
                    >
                      {lang === 'en' ? '3D Exploded' : lang === 'zh' ? '3D拆解' : 'Bóc tách 3D'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        switchToThreeJs('xray');
                        setSectionCutActive(false);
                        setExplodedFactor(0.28);
                      }}
                      className={`py-2 px-2 rounded-sm text-xs font-medium border cursor-pointer ${
                        renderMode === 'xray'
                          ? 'bg-[#C9A46A] text-[#171817] border-[#C9A46A] font-semibold'
                          : 'bg-[#171817] text-[#D8C9A9] border-[#D8C9A9]/20'
                      }`}
                    >
                      {lang === 'en' ? 'X-Ray' : lang === 'zh' ? 'X光透视' : 'X-Ray'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        switchToThreeJs('textured');
                        setSectionCutActive(!sectionCutActive);
                      }}
                      className={`py-2 px-2 rounded-sm text-xs font-medium border cursor-pointer ${
                        sectionCutActive
                          ? 'bg-[#C9A46A] text-[#171817] border-[#C9A46A] font-semibold'
                          : 'bg-[#171817] text-[#D8C9A9] border-[#D8C9A9]/20'
                      }`}
                    >
                      {lang === 'en' ? 'Interior' : lang === 'zh' ? '室内' : 'Nội thất'}
                    </button>
                  </div>

                  {/* Lighting modes */}
                  <div className="grid grid-cols-4 gap-1">
                    {(['studio', 'day', 'golden', 'night'] as LightingMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setLightingMode(mode)}
                        className={`py-1.5 rounded-sm text-[11px] font-medium border cursor-pointer ${
                          lightingMode === mode
                            ? 'bg-[#C9A46A] text-[#171817] border-[#C9A46A] font-semibold'
                            : 'bg-[#171817] text-[#D8C9A9]/80 border-[#D8C9A9]/20'
                        }`}
                      >
                        {mode === 'studio'
                          ? 'Studio'
                          : mode === 'day'
                          ? lang === 'en'
                            ? 'Day'
                            : lang === 'zh'
                            ? '白天'
                            : 'Ngày'
                          : mode === 'golden'
                          ? lang === 'en'
                            ? 'Sunset'
                            : lang === 'zh'
                            ? '黄昏'
                            : 'Hoàng hôn'
                          : lang === 'en'
                          ? 'Night'
                          : lang === 'zh'
                          ? '夜晚'
                          : 'Đêm'}
                      </button>
                    ))}
                  </div>

                  {/* .glb Scale & Rotation Y sliders when loaded */}
                  {customGlbSource.url && !customGlbError && glbLoadedReady && (
                    <div className="rounded-sm bg-[#D8C9A9]/5 border border-[#C9A46A]/30 p-2.5 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-[#C9A46A] font-semibold">
                        <span>
                          {lang === 'en'
                            ? '.GLB Scale & Rotation'
                            : lang === 'zh'
                            ? '.GLB 缩放与旋转'
                            : 'Tỷ lệ & Xoay .GLB'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const reset = resetSite3DTransform(currentSite.id);
                            setGlbScale(reset.scale);
                            setGlbRotationY(reset.rotationY);
                          }}
                          className="text-[10.5px] text-[#D8C9A9] underline cursor-pointer"
                        >
                          {lang === 'en' ? 'Reset' : lang === 'zh' ? '重置' : 'Đặt lại'}
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-[#D8C9A9]/80 tabular-nums">
                          <span>{lang === 'en' ? 'Scale' : lang === 'zh' ? '缩放' : 'Tỷ lệ (Scale)'}</span>
                          <span>{glbScale.toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.25"
                          max="3"
                          step="0.05"
                          value={glbScale}
                          onChange={(e) => {
                            const nextScale = parseFloat(e.target.value);
                            setGlbScale(nextScale);
                            saveSite3DTransform(currentSite.id, nextScale, glbRotationY);
                          }}
                          className="w-full accent-[#C9A46A] cursor-pointer h-1.5"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-[#D8C9A9]/80 tabular-nums">
                          <span>{lang === 'en' ? 'Rotation Y' : lang === 'zh' ? 'Y 轴旋转' : 'Xoay trục Y'}</span>
                          <span>{glbRotationY}°</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          step="1"
                          value={glbRotationY}
                          onChange={(e) => {
                            const nextRot = parseInt(e.target.value, 10);
                            setGlbRotationY(nextRot);
                            saveSite3DTransform(currentSite.id, glbScale, nextRot);
                          }}
                          className="w-full accent-[#C9A46A] cursor-pointer h-1.5"
                        />
                      </div>
                    </div>
                  )}

                  {/* Quick utilities */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenAudioModal) onOpenAudioModal(currentSite);
                        else {
                          setGuideSubMode('autotour');
                          setIsTourGuideOpen(true);
                          setIsMobileControlsOpen(false);
                        }
                      }}
                      className="flex-1 min-w-[110px] py-2 px-2.5 rounded-sm bg-[#47796D] text-[#D8C9A9] text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{lang === 'en' ? 'Audio' : lang === 'zh' ? '语音' : 'Thuyết minh'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRightPanelCollapsed(false);
                        setIsMobileControlsOpen(false);
                      }}
                      className="flex-1 min-w-[110px] py-2 px-2.5 rounded-sm bg-[#526D8B] text-[#D8C9A9] text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>{lang === 'en' ? 'Details' : lang === 'zh' ? '详情' : 'Chi tiết'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 rounded-sm bg-[#171817]/95 border border-[#C9A46A]/45 px-2.5 py-2 shadow-xl">
                <div className="flex items-center gap-1 min-w-0">
                  <button
                    type="button"
                    onClick={handlePrevSite}
                    className="w-7 h-7 rounded-sm bg-[#D8C9A9]/10 text-[#D8C9A9] text-sm flex items-center justify-center cursor-pointer shrink-0"
                    aria-label="Prev"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={handleNextSite}
                    className="w-7 h-7 rounded-sm bg-[#D8C9A9]/10 text-[#D8C9A9] text-sm flex items-center justify-center cursor-pointer shrink-0"
                    aria-label="Next"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMobileControlsOpen((v) => !v)}
                    className="px-2.5 py-1.5 rounded-sm bg-[#C9A46A] text-[#171817] text-xs font-semibold cursor-pointer truncate"
                  >
                    {lang === 'en'
                      ? '3D Controls'
                      : lang === 'zh'
                      ? '3D 控制'
                      : 'Bảng điều khiển 3D'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const willOpen = !isGeminiAssistantOpen;
                    setIsGeminiAssistantOpen(willOpen);
                    setIsTourGuideOpen(false);
                    if (willOpen) {
                      trackPlatformInteraction('tech_audio_ai', currentSite.id);
                    }
                  }}
                  className="px-3 py-1.5 rounded-sm bg-[#A94F3D] text-[#D8C9A9] text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap"
                >
                  {lang === 'en' ? 'Ask AI' : lang === 'zh' ? '问 AI' : 'Hỏi AI'}
                </button>
              </div>
            </div>
            </>
          )}
        </div>

        {/* =======================================================================
            NGĂN KÉO KÍNH MỜ BÊN PHẢI (APPLE VISIONOS FROSTED DRAWER)
            Mặc định ẩn để 3D chiếm 100% khung hình; trượt ra khi bấm ghim hoặc "Chi tiết"
           ======================================================================= */}
        {!isGettyLanding && !isRightPanelCollapsed && (
          <aside className="absolute top-16 right-4 bottom-24 w-80 rounded-[24px] bg-[#1D1D1F]/90 backdrop-blur-2xl border border-white/10 p-5 overflow-y-auto ar-modal-scrollbar z-30 shadow-[0_24px_60px_rgba(0,0,0,0.85)] flex flex-col justify-between select-text animate-apple-sheet">
            {(() => {
              const eras = getChateauErasForSite(currentSite);
              const activeEra = eras[selectedEraIndex] || eras[eras.length - 1];
              const displayFeature = activeFeature || features[0] || null;

              return (
                <div className="space-y-4">
                  {/* Drawer Header + Nút Đóng X */}
                  <div className="flex items-start justify-between gap-2 border-b border-white/[0.08] pb-3.5">
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-[#D4AF37] block tabular-nums">
                        {currentSite.commencementYear} · {localizedCurrentSite.address.city}
                      </span>
                      <h3 className="font-serif text-base font-semibold text-[#F5F5F7] tracking-tight truncate mt-0.5">
                        {localizedCurrentSite.officialName}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRightPanelCollapsed(true)}
                      className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-[#86868B] hover:text-[#F5F5F7] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                      aria-label={lang === 'en' ? 'Close' : lang === 'zh' ? '关闭' : 'Đóng'}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Selector Giai đoạn Lịch sử gọn đẹp */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsEraMenuOpen((v) => !v)}
                      className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 hover:border-white/25 text-xs text-[#F5F5F7] flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{activeEra.shortPeriod}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-[#86868B] transition-transform ${isEraMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isEraMenuOpen && (
                      <div className="mt-1.5 rounded-xl bg-[#161618] border border-white/10 p-1 space-y-0.5">
                        {eras.map((era, idx) => (
                          <button
                            key={era.id}
                            type="button"
                            onClick={() => {
                              setSelectedEraIndex(idx);
                              setIsEraMenuOpen(false);
                              setLightingMode(idx === 0 || idx === 3 ? 'golden' : 'studio');
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                              idx === selectedEraIndex ? 'bg-[#0071E3] text-white' : 'text-[#86868B] hover:text-[#F5F5F7]'
                            }`}
                          >
                            {era.shortPeriod}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Kiến trúc sư & Niên đại */}
                  <div className="rounded-2xl bg-black/35 border border-white/[0.06] p-3.5 space-y-2">
                    <div className="text-xs font-semibold text-[#F5F5F7]">
                      {lang === 'vi' ? activeEra.figureName : localizedCurrentSite.architect}
                    </div>
                    <div className="text-[11px] text-[#D4AF37]">
                      {lang === 'vi' ? activeEra.figureRole : localizedCurrentSite.architecturalStyle}
                    </div>
                    <p className="text-xs text-[#86868B] leading-relaxed">
                      {lang === 'vi' ? activeEra.archNote : localizedCurrentSite.summary}
                    </p>
                    <div className="pt-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => onOpenDetailModal && onOpenDetailModal(currentSite)}
                        className="text-xs font-medium text-[#0071E3] hover:underline cursor-pointer"
                      >
                        {lang === 'en'
                          ? 'Open Full Dossier ↗'
                          : lang === 'zh'
                          ? '打开完整遗产档案 ↗'
                          : 'Mở hồ sơ gốc ↗'}
                      </button>
                    </div>
                  </div>

                  {/* .GLB Scale & Rotation Y Sliders */}
                  {customGlbSource.url && !customGlbError && glbLoadedReady && (
                    <div className="rounded-sm bg-[#171817] border border-[#C9A46A]/40 p-3.5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#C9A46A]">
                          {lang === 'en'
                            ? '.GLB Scale & Rotation Y'
                            : lang === 'zh'
                            ? '.GLB 缩放与 Y 轴旋转'
                            : 'Điều chỉnh Mô hình .GLB'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const reset = resetSite3DTransform(currentSite.id);
                            setGlbScale(reset.scale);
                            setGlbRotationY(reset.rotationY);
                          }}
                          className="text-[11px] text-[#D8C9A9] underline cursor-pointer"
                        >
                          {lang === 'en' ? 'Reset' : lang === 'zh' ? '重置' : 'Đặt lại'}
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-[#D8C9A9]/80">
                          <span>{lang === 'en' ? 'Scale' : lang === 'zh' ? '缩放比例' : 'Tỷ lệ (Scale)'}</span>
                          <span className="text-[#D8C9A9] font-sans font-medium tabular-nums">
                            {glbScale.toFixed(2)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.25"
                          max="3"
                          step="0.05"
                          value={glbScale}
                          onChange={(e) => {
                            const nextScale = parseFloat(e.target.value);
                            setGlbScale(nextScale);
                            saveSite3DTransform(currentSite.id, nextScale, glbRotationY);
                          }}
                          className="w-full accent-[#C9A46A] cursor-pointer h-1.5"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-[#D8C9A9]/80">
                          <span>{lang === 'en' ? 'Rotation Y' : lang === 'zh' ? 'Y 轴旋转' : 'Xoay trục Y'}</span>
                          <span className="text-[#D8C9A9] font-sans font-medium tabular-nums">
                            {glbRotationY}°
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          step="1"
                          value={glbRotationY}
                          onChange={(e) => {
                            const nextRot = parseInt(e.target.value, 10);
                            setGlbRotationY(nextRot);
                            saveSite3DTransform(currentSite.id, glbScale, nextRot);
                          }}
                          className="w-full accent-[#C9A46A] cursor-pointer h-1.5"
                        />
                      </div>
                    </div>
                  )}

                  {/* Thanh kéo Mặt cắt & Bóc tách 3D */}
                  {(sectionCutActive || explodedFactor > 0 || renderMode === 'xray') && (
                    <div className="rounded-2xl bg-black/40 border border-white/10 p-3.5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#F5F5F7]">
                          {lang === 'en'
                            ? '3D Cutaway & Exploded View'
                            : lang === 'zh'
                            ? '3D 剖面与结构拆解'
                            : 'Mặt cắt & Bóc tách 3D'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSectionCutActive(false);
                            setExplodedFactor(0);
                            setRenderMode('textured');
                          }}
                          className="text-[11px] text-[#0071E3] hover:underline cursor-pointer"
                        >
                          {lang === 'en' ? 'Reset' : lang === 'zh' ? '重置' : 'Đặt lại'}
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-[#86868B]">
                          <span>
                            {lang === 'en'
                              ? 'Section Cut Elevation'
                              : lang === 'zh'
                              ? '剖切平面高度'
                              : 'Cao độ mặt cắt'}
                          </span>
                          <span className="text-[#F5F5F7] font-sans font-medium tabular-nums">{sectionHeight}m</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="25"
                          step="0.5"
                          value={sectionHeight}
                          onChange={(e) => {
                            if (!sectionCutActive) setSectionCutActive(true);
                            setSectionHeight(parseFloat(e.target.value));
                          }}
                          className="w-full accent-[#0071E3] cursor-pointer h-1.5"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-[#86868B]">
                          <span>
                            {lang === 'en'
                              ? 'Structural Separation'
                              : lang === 'zh'
                              ? '结构分层间距'
                              : 'Tách lớp kết cấu'}
                          </span>
                          <span className="text-[#F5F5F7] font-sans font-medium tabular-nums">{Math.round(explodedFactor * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={explodedFactor}
                          onChange={(e) => setExplodedFactor(parseFloat(e.target.value))}
                          className="w-full accent-[#0071E3] cursor-pointer h-1.5"
                        />
                      </div>
                    </div>
                  )}

                  {/* Danh sách Điểm nhấn Kiến trúc */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#F5F5F7]">
                        {lang === 'en'
                          ? `Architectural Highlights (${features.length})`
                          : lang === 'zh'
                          ? `建筑核心看点 (${features.length})`
                          : `Điểm nhấn kiến trúc (${features.length})`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowHotspots(!showHotspots)}
                        className="text-[11px] text-[#86868B] hover:text-[#F5F5F7] cursor-pointer"
                      >
                        {showHotspots
                          ? lang === 'en'
                            ? 'Hide Pins'
                            : lang === 'zh'
                            ? '隐藏图钉'
                            : 'Ẩn ghim'
                          : lang === 'en'
                          ? 'Show Pins'
                          : lang === 'zh'
                          ? '显示图钉'
                          : 'Hiện ghim'}
                      </button>
                    </div>
                    <div className="space-y-1">
                      {features.map((feat, idx) => {
                        const isFeatActive = (activeFeature?.id || features[0]?.id) === feat.id;
                        const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
                        const roman = romanNumerals[idx] || `${idx + 1}`;
                        return (
                          <button
                            key={feat.id}
                            type="button"
                            onClick={() => {
                              flyToFeature(feat);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl transition-colors flex items-start gap-2.5 cursor-pointer ${
                              isFeatActive
                                ? 'bg-[#0071E3]/20 border border-[#0071E3]/50 text-[#F5F5F7]'
                                : 'bg-black/30 border border-transparent hover:bg-white/[0.06] text-[#86868B]'
                            }`}
                          >
                            <span className="font-serif text-[12px] font-medium text-[#D4AF37] pt-0.5">{roman}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-[#F5F5F7] truncate">{feat.name}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Đối chiếu Ảnh thật & Góc nhìn */}
                  {displayFeature && (
                    <div className="rounded-2xl bg-black/35 border border-white/[0.06] overflow-hidden">
                      <div className="px-3 py-2 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-2">
                        <span className="text-[11px] font-sans font-medium text-[#D8C9A9]/85 truncate">
                          {lang === 'en'
                            ? 'Real-World Comparison'
                            : lang === 'zh'
                            ? '实景对比参照'
                            : 'Đối chiếu Ảnh chụp thật'}
                        </span>
                        <div className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/15 p-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setActiveViewerPhotoIdx(0)}
                            className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-sans font-semibold tabular-nums transition-colors cursor-pointer ${
                              activeViewerPhotoIdx === 0
                                ? 'bg-[#C9A46A] text-[#171817]'
                                : 'text-[#D8C9A9]/80 hover:text-white'
                            }`}
                          >
                            {lang === 'en' ? 'Photo 01' : lang === 'zh' ? '实景 01' : 'Ảnh 01'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveViewerPhotoIdx(1)}
                            className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-sans font-semibold tabular-nums transition-colors cursor-pointer ${
                              activeViewerPhotoIdx === 1
                                ? 'bg-[#C9A46A] text-[#171817]'
                                : 'text-[#D8C9A9]/80 hover:text-white'
                            }`}
                          >
                            {lang === 'en' ? 'Photo 02' : lang === 'zh' ? '实景 02' : 'Ảnh 02'}
                          </button>
                        </div>
                      </div>
                      <div className="relative aspect-video w-full">
                        {activeViewerPhoto && !viewerPhotoFailed ? (
                          <>
                            <HeritageSmoothImage
                              src={activeViewerPhoto}
                              alt={displayFeature.name}
                              loading="lazy"
                              waitTone="dark"
                              onError={() => setViewerPhotoFailed(true)}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                            <div className="absolute bottom-2 left-3 right-3">
                              <div className="text-xs font-medium text-[#F5F5F7]">
                                {displayFeature.name}
                              </div>
                              <div className="text-[10.5px] text-[#D8C9A9]/85 truncate mt-0.5">
                                {getSitePhotoCaption(
                                  currentSite,
                                  activeViewerPhotoIdx,
                                  (lang as 'vi' | 'en' | 'zh') || 'vi'
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <HeritageTypographicPlate
                            site={currentSite}
                            variant="detail"
                            subtitleOverride={displayFeature.name}
                          />
                        )}
                      </div>
                      <div className="p-3 space-y-2.5">
                        <p className="text-xs text-[#86868B] leading-relaxed">{displayFeature.description}</p>
                        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                          {(['iso', 'front', 'top'] as const).map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleSetPreset(preset)}
                              className={`py-1.5 rounded-lg text-center cursor-pointer transition-colors ${
                                cameraPreset === preset
                                  ? 'bg-[#F5F5F7] text-black font-medium'
                                  : 'bg-white/[0.06] text-[#86868B] hover:text-[#F5F5F7]'
                              }`}
                            >
                              {preset === 'iso'
                                ? lang === 'en'
                                  ? 'Isometric'
                                  : lang === 'zh'
                                  ? '轴测视图'
                                  : 'Phối cảnh'
                                : preset === 'front'
                                ? lang === 'en'
                                  ? 'Elevation'
                                  : lang === 'zh'
                                  ? '正立面'
                                  : 'Mặt đứng'
                                : lang === 'en'
                                ? 'Top Plan'
                                : lang === 'zh'
                                ? '俯视平面'
                                : 'Mặt bằng'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </aside>
        )}
      </div>

      {/* 7. CREDITS / METADATA MODAL */}
      {showCreditsModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowCreditsModal(false)}
        >
          <div
            className="bg-[#181614] border border-[#C5A059]/40 max-w-md w-full p-6 text-left space-y-4 shadow-2xl text-[#F5EFE6]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#F2EFE9]/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#C5A059]" />
                <h3 className="font-serif font-bold text-base text-[#F5EFE6]">
                  {lang === 'en'
                    ? '3D Model Copyright & Attribution'
                    : lang === 'zh'
                    ? '3D 模型版权与档案信息'
                    : 'Hồ sơ bản quyền mô hình 3D'}
                </h3>
              </div>
              <button
                onClick={() => setShowCreditsModal(false)}
                className="text-[#A39E93] hover:text-[#F4F1EA] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2.5 text-xs leading-relaxed">
              <div>
                <span className="text-[#C5A059] font-sans font-medium block text-[11px]">
                  {lang === 'en'
                    ? 'Heritage Monument:'
                    : lang === 'zh'
                    ? '文化遗产工程：'
                    : 'Công trình di tích:'}
                </span>
                <span className="font-semibold text-sm">{localizedCurrentSite.officialName}</span>
              </div>
              <div>
                <span className="text-[#C5A059] font-sans font-medium block text-[11px]">
                  {lang === 'en'
                    ? 'Distribution License:'
                    : lang === 'zh'
                    ? '授权许可协议：'
                    : 'Giấy phép phân phối:'}
                </span>
                <span className="font-sans">
                  {lang === 'en'
                    ? 'CC BY-NC-SA 4.0 / Southern Heritage Digital Archive'
                    : lang === 'zh'
                    ? 'CC BY-NC-SA 4.0 / 东南部遗产数字典藏数据库'
                    : 'CC BY-NC-SA 4.0 / Cơ sở dữ liệu Di sản Đông Nam Bộ'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. HƯỚNG DẪN VIÊN 3D & THUYẾT MINH PANEL */}
      <VirtualTourGuidePanel
        isOpen={isTourGuideOpen}
        onClose={() => setIsTourGuideOpen(false)}
        currentSite={currentSite}
        stations={features}
        onFlyToStation={(station) => {
          flyToFeature(station);
        }}
        onSetRenderMode={(mode) => {
          switchToThreeJs(mode);
        }}
        onSetExplodedFactor={(factor) => {
          setExplodedFactor(factor);
        }}
        onSwitchSite={(site) => {
          handleSwitchLandmark(site);
        }}
        onOpenBookingModal={() => setIsStartupBookingOpen(true)}
        initialActiveRouteId={activeStartupRouteId}
        initialSubMode={guideSubMode}
        autoStartTourCounter={autoStartTourCounter}
      />

      {/* 9. MODAL ĐẶT VÉ & HỌC LIỆU SỐ */}
      <StartupBookingModal
        isOpen={isStartupBookingOpen}
        onClose={() => setIsStartupBookingOpen(false)}
        onStartDemoTour={(routeId) => {
          setIsStartupBookingOpen(false);
          if (routeId) {
            setActiveStartupRouteId(routeId);
          }
          setGuideSubMode('autotour');
          setIsTourGuideOpen(true);
          setAutoStartTourCounter((c) => c + 1);
        }}
      />

      {/* 10. TRỢ LÝ GIÁM TUYẾN AI — SPATIAL LIVING DOCENT 3D */}
      <GeminiHeritageAssistant
        isOpen={isGeminiAssistantOpen}
        onClose={() => {
          setIsGeminiAssistantOpen(false);
          setSpatialSpotlight(null);
          setIsMysteryModeActive(false);
        }}
        currentSite={currentSite}
        sites={allSites}
        onSwitchSite={(targetSite) => {
          handleSwitchLandmark(targetSite);
        }}
        onSetLightingMode={(mode) => {
          setLightingMode(mode);
        }}
        hotspots={features}
        onFlyToHotspot={(hotspot) => {
          flyToFeature(hotspot);
          setSpatialSpotlight({ position: hotspot.targetPos, label: hotspot.name });
        }}
        onSetRenderMode={(mode) => {
          switchToThreeJs(mode);
        }}
        onSetExplodedFactor={(factor) => {
          setExplodedFactor(factor);
        }}
        onSetSpatialSpotlight={(pos, label) => {
          setSpatialSpotlight({ position: pos, label });
        }}
        onClearSpatialSpotlight={() => {
          setSpatialSpotlight(null);
          setIsMysteryModeActive(false);
          setExplodedFactor(0);
          setRenderMode('textured');
          handleSetPreset('iso');
        }}
        isMysteryModeActive={isMysteryModeActive}
        onToggleMysteryMode={(active) => {
          setIsMysteryModeActive(active);
          if (!active) {
            setMysteryRayClickEvent(null);
          }
        }}
        mysteryRayClickEvent={mysteryRayClickEvent}
        onNavigateToTickets={onNavigateToTickets}
        onTriggerAutoTour={() => {
          setGuideSubMode('autotour');
          setIsTourGuideOpen(true);
          setAutoStartTourCounter((c) => c + 1);
        }}
      />

      {/* 11. MÀN KÉO CHÉO "SO SÁNH XƯA & NAY" */}
      {isLisboaSplitOpen && (
        <LisboaDiagonalSplitOverlay
          site={currentSite}
          sites={sites}
          lang={lang}
          onClose={() => setIsLisboaSplitOpen(false)}
          onSwitchSite={(chosenSite) => {
            if (onSelectSite) onSelectSite(chosenSite);
          }}
          onUpdateCustomPhoto={onUpdateCustomPhoto}
          onRestoreDefaultPhoto={onRestoreDefaultPhoto}
          onExploreAction={(chosenSite) => {
            setIsLisboaSplitOpen(false);
            if (chosenSite && chosenSite.id !== currentSite.id && onSelectSite) {
              onSelectSite(chosenSite);
            }
            setRenderMode('wireframe');
          }}
        />
      )}
    </div>
  );
};

// Return landmark-specific curatorial feature points
export function getLandmarkFeatures(siteId: string): ArchitecturalFeature[] {
  if (NEW_NINE_LANDMARK_FEATURES[siteId]) {
    return NEW_NINE_LANDMARK_FEATURES[siteId];
  }
  const staticHotspots = DEFAULT_HERITAGE_3D_CONFIG[siteId]?.hotspots;
  if (staticHotspots && staticHotspots.length > 0) {
    return staticHotspots;
  }
  if (siteId === 'HCM-DT-001') {
    return [
      {
        id: 'f1',
        name: 'Đại Sảnh & Cầu Thang Đôi',
        description:
          'Không gian đại sảnh lát đá cẩm thạch vân kem kết nối trực tiếp cầu thang đôi hình chữ Y trải thảm đỏ sang trọng với tay vịn gỗ quý và đèn chùm pha lê trung tâm.',
        cameraPos: [0, 5.2, 12.8],
        targetPos: [0, 3.2, -0.4],
        thumbnailUrl: '',
      },
      {
        id: 'f2',
        name: 'Phòng Trình Quốc Thư & Tranh Sơn Mài',
        description:
          'Nơi diễn ra nghi lễ tiếp đón đại sứ các nước, nổi bật với thảm gấm vàng, bộ ghế sơn son thếp vàng và bức tranh sơn mài khổ lớn Bình Ngô Đại Cáo / Giang Sơn Cẩm Tú.',
        cameraPos: [10.2, 5.4, 9.5],
        targetPos: [10.2, 4.85, -3.6],
        thumbnailUrl: '',
      },
      {
        id: 'f3',
        name: 'Phòng Nội Các (Tầng Trệt)',
        description:
          'Phòng họp Hội đồng Nội các cánh Tây tầng trệt với bàn họp lớn hình chữ U bằng gỗ gõ đỏ bóng, 20 ghế bọc da xanh lục và hệ thống micro hội nghị.',
        cameraPos: [-15.8, 3.8, 10.2],
        targetPos: [-10.2, 2.0, -1.5],
        thumbnailUrl: '',
      },
      {
        id: 'f4',
        name: 'Phòng Làm Việc Tổng Thống & Tứ Phương Vô Sự',
        description:
          'Cụm không gian tầng 2 gồm bàn làm việc gỗ gụ Tổng thống, quả địa cầu cùng lầu vọng cảnh Tứ Phương Vô Sự trên tầng thượng với hàng cột sơn son đỏ rực và bàn trà.',
        cameraPos: [-9.5, 11.8, 15.5],
        targetPos: [-1.5, 9.2, 0.2],
        thumbnailUrl: '',
      },
      {
        id: 'f5',
        name: 'Tầng Hầm Chỉ Huy Ngầm (B1)',
        description:
          'Khu boong-ke bê tông cốt thép chịu bom sâu dưới lòng đất với cửa thép xanh ô-liu kín hơi, bàn tác chiến gỗ, máy điện đài phát đèn tín hiệu và bản đồ quân sự Nam Bộ.',
        cameraPos: [7.8, 4.6, -18.5],
        targetPos: [0, -1.0, -8.2],
        thumbnailUrl: '',
      },
      {
        id: 'f6',
        name: 'Sân Đáp Trực Thăng UH-1 (08/04/1975)',
        description:
          'Bãi đáp trực thăng chữ H trên tầng thượng lưu giữ 2 vòng tròn đỏ đánh dấu vị trí trúng bom ngày 08/04/1975 cùng mô hình trực thăng UH-1 Iroquois.',
        cameraPos: [7.5, 14.5, -13.5],
        targetPos: [0, 10.1, -5.6],
        thumbnailUrl: '',
      },
    ];
  } else if (siteId === 'HCM-DT-002') {
    return [
      {
        id: 'f1',
        name: 'Vòm Cuốn Lớn (Tympanum #1d3b36) & Sảnh Caryatids',
        description: 'Mặt tiền chính với bậc tam cấp đá granite xám (#5a5856) vát mở rộng, 2 tượng Nữ thần Caryatids đá trắng ngà (#e8e2d8) đỡ ban công tầng 2 liền mạch, 2 cặp cột tròn đôi Corinth (#d2c6bc) và Vòm cuốn lớn nền xanh lục đậm (#1d3b36) đắp 3 vòng hoa tròn cùng cụm tượng thiên thần xòe cánh chữ V trên đỉnh.',
        cameraPos: [-6, 9.5, 30],
        targetPos: [-2.5, 7.5, 13.0],
        thumbnailUrl: '',
      },
      {
        id: 'f2',
        name: 'Hai Cánh Mặt Tiền (1 Cửa Vòm Lớn) & Lan Can Đá Trắng',
        description: 'Hai cánh mặt tiền đối xứng, mỗi bên đặt 1 ô cửa sổ vòm lớn duy nhất ở chính giữa mảng tường đá (#d2c6bc) bao quanh bởi khung phào chỉ chữ nhật đắp nổi, 2 trụ cột vuông góc và hàng lan can con tiện đá trắng (#e8e2d8) che phía trước mái Mansard.',
        cameraPos: [16, 10.5, 26],
        targetPos: [8.2, 6.5, 11.5],
        thumbnailUrl: '',
      },
      {
        id: 'f3',
        name: 'Hệ Mái Mansard Đỉnh Bằng (#4a5868) & 6 Cửa Mái Bên Hông',
        description: 'Hệ mái Mansard 4 mặt dốc lợp ngói đá phiến vảy cá xanh xám (#4a5868) giật cấp phía sau vòm mặt tiền và đuôi mái, đỉnh mái phẳng màu xám đá sáng (#7a8288) có gờ viền đá bao quanh và 6 ô cửa mái nhỏ (dormer windows) đều đặn mỗi bên hông.',
        cameraPos: [25, 17.5, -2],
        targetPos: [3.5, 11.5, -4.0],
        thumbnailUrl: '',
      },
      {
        id: 'f4',
        name: '9 Nhịp Hông (Vòm Trung Tâm, Bệ Thềm Đá) & Mặt Hậu Lan Can Đá',
        description: 'Hai bên hông chia 9 nhịp (4 nhịp trái + 1 Nhịp Giữa Nhô Cao Có Vòm Bán Nguyệt + 4 nhịp phải) đặt trên khối bệ thềm đá xám (raised stone terrace) rộng dưới 5 nhịp giữa; mặt hậu kết thúc phẳng bằng hệ lan can con tiện đá trắng trước mái Mansard 5 cửa mái và 6 nhịp vòm dưới.',
        cameraPos: [-18, 11.5, -32],
        targetPos: [-6.5, 7.2, -16],
        thumbnailUrl: '',
      },
    ];
  } else if (siteId === 'HCM-DT-003') {
    return [
      {
        id: 'f1',
        name: 'Đồng Hồ Cổ & Cổng Chính (1891)',
        description: 'Chiếc đồng hồ La Mã cổ kính đặt trang trọng trên đỉnh trán tường Tân Phục Hưng chính giữa mặt tiền, lưu giữ nhịp thời gian hơn 130 năm của Sài Gòn.',
        cameraPos: [-5, 10, 22],
        targetPos: [-2.5, 9.2, 8.5],
        thumbnailUrl: '',
      },
      {
        id: 'f2',
        name: 'Khung Vòm Thép Gustave Eiffel',
        description: 'Kết cấu vòm kim loại chịu lực thanh thoát thế kỷ XIX chạy dọc sảnh giao dịch chính, lấy sáng tự nhiên qua hệ mái lồng.',
        cameraPos: [14, 15, 14],
        targetPos: [3.5, 8.5, -2.5],
        thumbnailUrl: '',
      },
      {
        id: 'f3',
        name: 'Hệ Cửa Vòm & Cửa Chớp Pháp Cổ',
        description: 'Dãy cửa sổ vòm cao đối xứng hai cánh kết hợp cửa chớp lá sách màu xanh lá đặc trưng giúp thông gió nhiệt đới và tôn lên sắc tường vàng cổ điển.',
        cameraPos: [-16, 6, 20],
        targetPos: [-11.5, 4.5, 7],
        thumbnailUrl: '',
      },
    ];
  } else if (siteId === 'HCM-DT-005') {
    return [
      {
        id: 'f1',
        name: 'Hai Tháp Chuông Đôi & Chóp Bạc 60m',
        description: 'Hai tháp chuông vuông đối xứng gắn cửa vòm đôi (bifora), đồng hồ cổ, lan can đá trắng và 2 chóp bát giác bọc kẽm cao 60,5m mang Thánh giá trên đỉnh.',
        cameraPos: [-8, 19, 26],
        targetPos: [-4.5, 17, 9.2],
        thumbnailUrl: '',
      },
      {
        id: 'f2',
        name: 'Cửa Sổ Hoa Hồng (Rose Window) & 3 Cổng Vòm',
        description: 'Cửa sổ kính màu hình tròn lớn viền đá trắng kết hợp hàng vòm nhỏ (blind arcade) và 3 cổng vòm Romanesque dẫn vào thánh đường.',
        cameraPos: [8, 9.5, 22],
        targetPos: [3.5, 8.2, 11.2],
        thumbnailUrl: '',
      },
      {
        id: 'f3',
        name: 'Tượng Đức Mẹ Hòa Bình & Quảng Trường',
        description: 'Tượng Đức Mẹ Hòa Bình bằng đá cẩm thạch trắng Carrara (1959) đặt trên bệ trụ đá cao giữa vườn hoa bầu dục Công xã Paris phía trước nhà thờ.',
        cameraPos: [-10, 5.5, 28],
        targetPos: [-4.2, 3.8, 18.8],
        thumbnailUrl: '',
      },
      {
        id: 'f4',
        name: 'Hậu Cung 3 Tầng Giật Cấp & 5 Nhà Nguyện Tỏa Tia',
        description: 'Cấu trúc Hậu cung (Chevet) 3 tầng đồng tâm phía sau Cánh ngang mở rộng với 5 Nhà nguyện đa giác tỏa hình cánh quạt (-72°, -36°, 0°, +36°, +72°), 6 gờ tường đá tỏa tia chia múi mái tầng giữa và dãy 4 vòm cuốn mặt sau.',
        cameraPos: [12, 18.5, -42],
        targetPos: [5.5, 7.5, -18],
        thumbnailUrl: '',
      },
    ];
  } else if (siteId === 'HCM-DT-007') {
    return [
      {
        id: 'f1',
        name: 'Đôi Rồng Đất Nung Trên Mái (Lưỡng Long Chầu Nguyệt)',
        description: 'Tượng đôi rồng đất nung tráng men xanh ngọc lưu ly chầu mặt trăng trên đỉnh mái tòa nhà hãng tàu Messageries Maritimes (1863).',
        cameraPos: [-6, 16.0, 19],
        targetPos: [-3.5, 13.8, 0],
        thumbnailUrl: '',
      },
      {
        id: 'f2',
        name: 'Hành Lang Vòm Cuốn Pháp Cổ 7 Nhịp',
        description: 'Hệ hành lang vòm cuốn bán nguyệt bao quanh 4 mặt kết hợp hàng cột vuông trắng kem và tường gạch đất nung thoáng mát ven sông Sài Gòn.',
        cameraPos: [16, 7.5, 22],
        targetPos: [6.5, 4.5, 5.5],
        thumbnailUrl: '',
      },
    ];
  } else if (siteId === 'HCM-DT-004') {
    return [
      {
        id: 'f1',
        name: 'Tháp Đồng Hồ Cửa Nam 1914',
        description: 'Tháp chuông 4 mặt sừng sững hướng ra bùng binh Quách Thị Trang, biểu tượng giao thương sầm uất hơn một thế kỷ của Sài Gòn.',
        cameraPos: [-6, 11, 23],
        targetPos: [-3.5, 9.2, 11],
        thumbnailUrl: '',
      },
      {
        id: 'f2',
        name: 'Mái Ngói Xếp Tầng Thông Gió',
        description: 'Kiến trúc chợ nhiệt đới Nam Bộ với các tầng mái so le lấy gió và ánh sáng tự nhiên xua tan oi bức.',
        cameraPos: [18, 14, 12],
        targetPos: [5.5, 6.5, -2.5],
        thumbnailUrl: '',
      },
    ];
  } else if (siteId === 'HCM-DT-006') {
    return [
      {
        id: 'f1',
        name: 'Tháp Bát Giác Trung Tâm 3 Tầng Mái Chồng Diêm (Biểu tượng Đông Dương 1929)',
        description: 'Khối tháp bát giác trung tâm do KTS Auguste Delaval thiết kế năm 1929 với hệ mái ngói ống âm dương 3 tầng chồng diêm uy nghi, hai tầng cổ diêm trổ cửa thông phong và đỉnh hồ lô đồng cổ ở tâm đỉnh chóp.',
        cameraPos: [-6, 12.5, 22],
        targetPos: [-2.5, 9.5, 1.0],
        thumbnailUrl: '',
      },
      {
        id: 'f2',
        name: 'Sảnh Chính, Hệ Đấu Củng - Con Sơn & Cửa Gỗ Hoa Văn Kỷ Hà',
        description: 'Hiên sảnh đón mở rộng có chiều sâu với 9 bậc tam cấp đá, 4 cột vuông trắng ngà phía trước đỡ hệ đấu củng nhiều tầng, 3 bộ Cửa Đại Khoa bằng gỗ lim chạm ô vuông Á Đông lùi vào trong và bảng tên BẢO TÀNG LỊCH SỬ.',
        cameraPos: [8, 5.5, 19.5],
        targetPos: [4.2, 3.8, 7.2],
        thumbnailUrl: '',
      },
      {
        id: 'f3',
        name: 'Hai Cánh Trưng Bày Đối Xứng & Hệ Cửa Sổ Lá Sách Thông Gió Nhiệt Đới',
        description: 'Hai dãy nhà cánh dài đối xứng mỗi bên 5 nhịp trụ tường phẳng, tường vàng nghệ cổ điển (#d9b66c), cửa sổ cao lắp 2 cánh chớp lá sách gỗ lim thông gió nhiệt đới kết hợp ô thoáng kỷ hà và mái dốc 4 mặt chồng diêm.',
        cameraPos: [-14.0, 8.0, 21.5],
        targetPos: [-10.8, 4.5, 1.5],
        thumbnailUrl: '',
      },
      {
        id: 'f4',
        name: 'Hai Khối Đầu Hồi Chữ U & Nghệ Thuật Trang Trí Giao Thoa Á - Âu',
        description: 'Hai khối đầu hồi nhô ra ở hai đầu (x = ±15.2 đến ±19.2) tạo thế chữ U bề thế, nổi bật với cụm 3 cửa sổ gỗ cao ghép liền nhau, khung phù điêu ngang phía trên, lan can con tiện đá dưới hiên và mái ngói dốc 4 mặt.',
        cameraPos: [19.5, 8.8, 21.5],
        targetPos: [15.5, 5.0, 2.2],
        thumbnailUrl: '',
      },
    ];
  } else if (siteId === 'HCM-DT-008') {
    return [
      {
        id: 'f1',
        name: 'Nhà Bia Đá Cổ Thời Nguyễn',
        description: 'Bia đá khắc bài văn bia ca tụng công đức Tả quân Lê Văn Duyệt do Phan Thanh Giản soạn thảo năm 1868.',
        cameraPos: [-10, 5, 14],
        targetPos: [-6.5, 3, 4.5],
        thumbnailUrl: '',
      },
      {
        id: 'f2',
        name: 'Điện Thờ Khảm Sành Sứ Nam Bộ',
        description: 'Nghệ thuật khảm mảnh sành sứ đỉnh cao với đồ án Tứ linh, hoa lá tinh tế đặc trưng của văn hóa đình miếu Gia Định.',
        cameraPos: [8, 6, 14],
        targetPos: [3.5, 4.5, -2.5],
        thumbnailUrl: '',
      },
    ];
  } else if (siteId === 'HCM-DT-009') {
    return [
      {
        id: 'f1',
        name: 'Rừng Ngụy Trang, Hố Bom B-52 & Ụ Mối Thông Hơi',
        description: 'Tầng mặt đất tái hiện rừng nhiệt đới Củ Chi với lối mòn đất đỏ, 2 hố bom B-52, lán lá chữ A nửa chìm nửa nổi, 3 ụ mối ngụy trang ống thông hơi, cửa hầm bí mật và hầm chông tre.',
        cameraPos: [-16, 18, 22],
        targetPos: [-8.5, 8.8, -4.5],
        thumbnailUrl: '',
      },
      {
        id: 'f2',
        name: 'Tầng 1 (Sâu 3m): Hầm Chỉ Huy & Bếp Hoàng Cầm Tản Khói',
        description: 'Tầng hầm đầu tiên cách mặt đất 3m gồm Phòng họp & Chỉ huy có cột gỗ chống trần, bàn sa bàn tác chiến, cờ Mặt trận, hầm Bếp Hoàng Cầm có rãnh dẫn khói tản nhiệt ngầm và đường hầm chữ Z có nút chặn chống độc.',
        cameraPos: [-14, 9.5, 25],
        targetPos: [-7.5, 5.2, 8.5],
        thumbnailUrl: '',
      },
      {
        id: 'f3',
        name: 'Tầng 2 (Sâu 6m): Hầm Quân Y, Xưởng Vũ Khí & Nút Chặn Chữ Z',
        description: 'Tầng hầm giữa ở độ sâu 6m bố trí Hầm Quân y dã chiến (giường tre, võng dù, bàn mổ, tủ thuốc), Hầm Công binh cưa vỏ bom chế tạo vũ khí và trục đường hầm xương sống mặt cắt bên phải (+X) có hố tụt thông tầng.',
        cameraPos: [20, 7.5, 22],
        targetPos: [8.5, 2.8, 5.5],
        thumbnailUrl: '',
      },
      {
        id: 'f4',
        name: 'Tầng 3 (Sâu 10m): Hầm Trú Ẩn B-52, Giếng Nước Ngầm & Lối Thoát Ra Sông',
        description: 'Tầng hầm sâu nhất (8m - 10m) trong lớp đất sét pha đá ong (laterite clay) trên nền phù sa cổ bền chắc như bê tông tự nhiên gồm Hầm trú ẩn chống bom B-52, Giếng nước ngầm và ngách thoát hiểm ra sông Sài Gòn.',
        cameraPos: [-12, 3.5, 24],
        targetPos: [-2.5, -2.2, 9.5],
        thumbnailUrl: '',
      },
      {
        id: 'f5',
        name: 'Mặt Cắt Địa Chất Đá Ong (Laterite Clay) & Giao Thông Hào',
        description: 'Cấu trúc địa chất đất sét pha đá ong trên nền phù sa cổ có độ kết dính tự nhiên siêu bền, cho phép đào hơn 250km đường hầm 3 tầng chịu được sức ép bom đạn và xe tăng hạng nặng.',
        cameraPos: [22, 12, -16],
        targetPos: [9.5, 5.5, -6.5],
        thumbnailUrl: '',
      },
      {
        id: 'f6',
        name: 'Cửa Hầm Bí Mật Ngụy Trang & Bẫy Chông Tre Củ Chi',
        description: 'Hệ thống nắp hầm gỗ ngụy trang lá rừng khô kết hợp lỗ thông hơi hình ụ mối tự nhiên và cụm hầm chông chiến đấu bảo vệ vòng ngoài khu căn cứ.',
        cameraPos: [14, 15, 24],
        targetPos: [4.2, 8.2, 9.2],
        thumbnailUrl: '',
      },
    ];
  } else if (siteId === 'HCM-DT-010') {
    return [
      {
        id: 'f1',
        name: 'Bảo Tháp Xá Lợi 7 Tầng 1993',
        description: 'Bảo tháp hình lục giác cao 32m tôn trí ngọc Xá lợi Phật Thích Ca, uy nghiêm vươn lên giữa rặng cây cổ thụ.',
        cameraPos: [0, 12, 16],
        targetPos: [0, 9, 2],
        thumbnailUrl: '',
      },
      {
        id: 'f2',
        name: 'Gian Tiền Đường Cột Gỗ Quý 1744',
        description: 'Kết cấu 98 cột gỗ quý chạm khắc kinh Phật và bộ tượng cổ thế kỷ XVIII lưu giữ hồn cốt thiền môn Nam Bộ.',
        cameraPos: [6, 5, 8],
        targetPos: [0, 3, 0],
        thumbnailUrl: '',
      },
    ];
  } else if (siteId === 'HCM-DT-011') {
    return [
      {
        id: 'f1',
        name: 'Quần Thể Phù Điêu Gốm Thạch Loan',
        description: 'Hàng trăm pho tượng và phù điêu gốm men đa sắc gắn trên bờ nóc mô tả các tích cổ sân khấu tuồng Quảng Đông.',
        cameraPos: [0, 8, 12],
        targetPos: [0, 6, 2],
        thumbnailUrl: '',
      },
      {
        id: 'f2',
        name: 'Vòm Khung Gỗ Sơn Son Thếp Vàng',
        description: 'Nghệ thuật chạm khắc gỗ đỉnh cao của nghệ nhân Triều Châu với các bao lam, hoành phi thếp vàng lộng lẫy.',
        cameraPos: [-4, 5, 8],
        targetPos: [0, 4, 0],
        thumbnailUrl: '',
      },
    ];
  } else if (siteId === 'HCM-DT-012') {
    return [
      {
        id: 'f1',
        name: 'Tầng Địa Tầng Mộ Chum Cần Giờ',
        description: 'Tập trung hàng trăm mộ chum gốm mai táng văn hóa Tiền sử Óc Eo - Cần Giờ niên đại hơn 2.000 năm.',
        cameraPos: [0, 4, 8],
        targetPos: [0, 2, 0],
        thumbnailUrl: '',
      },
    ];
  } else {
    const siteObj = HERITAGE_SITES.find((s) => s.id === siteId);
    return [
      {
        id: 'f1',
        name: 'Điểm Nhấn Kiến Trúc Tổng Thể',
        description: 'Công trình di sản tiêu biểu ghi đậm dấu ấn không gian kiến trúc - văn hóa của Sài Gòn - TP.HCM qua các thời kỳ.',
        cameraPos: [0, 8, 16],
        targetPos: [0, 6, 0],
        thumbnailUrl: siteObj?.photos?.[0] || '',
      },
    ];
  }
}

// Procedural Heritage Urban Landscape Environment (Cảnh quan đô thị xung quanh di tích)
function addUrbanLandscapeEnvironment(group: THREE.Group, siteId: string) {
  // Đối với Địa đạo Củ Chi (HCM-DT-009) và 9 di tích mới (đã dựng khuôn viên, đồi dốc, rừng cây & sông ngòi chuyên biệt bên trong từng hàm), bỏ qua cảnh quan đô thị chung
  if (siteId === 'HCM-DT-009' || (NEW_NINE_SITE_IDS as readonly string[]).includes(siteId)) {
    return;
  }
  // Paved Stone Ground Plaza (bỏ qua cho HCM-DT-001, HCM-DT-002, HCM-DT-004, HCM-DT-005, HCM-DT-006 và HCM-DT-007 để bệ nền nằm nổi hoàn toàn trên GridHelper, không bao giờ Z-fighting)
  if (
    siteId !== 'HCM-DT-004' &&
    siteId !== 'HCM-DT-001' &&
    siteId !== 'HCM-DT-002' &&
    siteId !== 'HCM-DT-005' &&
    siteId !== 'HCM-DT-006' &&
    siteId !== 'HCM-DT-007'
  ) {
    const plazaGeo = new THREE.PlaneGeometry(80, 80);
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      metalness: 0.05,
    });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = -0.02;
    plaza.receiveShadow = true;
    plaza.userData.isGround = true;
    group.add(plaza);
  }

  const envGroundY =
    siteId === 'HCM-DT-001'
      ? 0.14
      : siteId === 'HCM-DT-005'
      ? 0.32
      : siteId === 'HCM-DT-002'
      ? 0.34
      : siteId === 'HCM-DT-006'
      ? 0.3
      : 0;

  // Tree generator helper (Cây cổ thụ đa tầng tự nhiên — màu xanh rêu trầm #3b5e38, roughness: 0.9, thu nhỏ nhẹ tán cây để làm nổi bật kiến trúc chính)
  const foliageDeepMat = new THREE.MeshStandardMaterial({
    color: 0x314f2e,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });
  const foliageMidMat = new THREE.MeshStandardMaterial({
    color: 0x3b5e38,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });
  const foliageLightMat = new THREE.MeshStandardMaterial({
    color: 0x3b5e38,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });
  const foliageSunMat = new THREE.MeshStandardMaterial({
    color: 0x436840,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });
  const barkMat = new THREE.MeshStandardMaterial({
    color: 0x3b261d,
    roughness: 0.96,
    metalness: 0.0,
    flatShading: true,
  });
  const planterCurbMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.88,
    metalness: 0.04,
  });
  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x291d16,
    roughness: 0.98,
    metalness: 0.0,
  });
  const treeAoMat = new THREE.MeshBasicMaterial({
    color: 0x090d12,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });

  const addTree = (x: number, z: number, scale = 1.0) => {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, envGroundY, z);
    const canopyScale = siteId === 'HCM-DT-005' || siteId === 'HCM-DT-002' ? scale * 0.78 : scale * 0.88;

    // Đổ bóng tiếp xúc (AO contact shadow) dưới gốc cây
    const aoDisk = new THREE.Mesh(new THREE.CircleGeometry(2.0 * canopyScale, 20), treeAoMat);
    aoDisk.rotation.x = -Math.PI / 2;
    aoDisk.position.y = 0.02;
    aoDisk.userData.isGround = true;
    treeGroup.add(aoDisk);

    // Bồn cây xây đá bát giác bao quanh gốc cây
    const planterCurb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.88 * scale, 0.95 * scale, 0.22 * scale, 8),
      planterCurbMat
    );
    planterCurb.position.y = 0.11 * scale;
    planterCurb.castShadow = true;
    planterCurb.receiveShadow = true;
    treeGroup.add(planterCurb);

    const planterSoil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.78 * scale, 0.78 * scale, 0.24 * scale, 8),
      soilMat
    );
    planterSoil.position.y = 0.11 * scale;
    planterSoil.receiveShadow = true;
    treeGroup.add(planterSoil);

    // Thân cây chính có gốc bạnh tự nhiên (7 cạnh tạo rãnh vỏ cây cổ thụ)
    const trunkGeo = new THREE.CylinderGeometry(0.24 * scale, 0.48 * scale, 2.9 * scale, 7);
    const trunk = new THREE.Mesh(trunkGeo, barkMat);
    trunk.position.y = 1.45 * scale;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    treeGroup.add(trunk);

    // 3 Cành nhánh gỗ vươn chéo từ thân lên đỡ các cụm tán lá
    const branches: Array<{ pos: [number, number, number]; rot: [number, number, number]; len: number; r: number }> = [
      { pos: [-0.38, 2.55, 0.18], rot: [0.22, 0, 0.58], len: 1.25, r: 0.14 },
      { pos: [0.40, 2.65, -0.18], rot: [-0.24, 0, -0.52], len: 1.3, r: 0.13 },
      { pos: [0.06, 2.75, 0.38], rot: [0.55, 0, -0.12], len: 1.18, r: 0.12 },
    ];
    branches.forEach((b) => {
      const bMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(b.r * 0.65 * scale, b.r * scale, b.len * scale, 6),
        barkMat
      );
      bMesh.position.set(b.pos[0] * scale, b.pos[1] * scale, b.pos[2] * scale);
      bMesh.rotation.set(b.rot[0], b.rot[1], b.rot[2]);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      treeGroup.add(bMesh);
    });

    // 6 cụm tán lá đa tầng bất đối xứng màu xanh rêu trầm (#3b5e38, roughness: 0.9), thu gọn kích thước tán cây
    const canopyClusters: Array<{
      r: number;
      pos: [number, number, number];
      scaleVec: [number, number, number];
      rot: [number, number, number];
      mat: THREE.MeshStandardMaterial;
      useIco?: boolean;
    }> = [
      {
        r: 1.22,
        pos: [-0.72, 3.05, 0.28],
        scaleVec: [1.14, 0.70, 1.05],
        rot: [0.3, 0.7, 0.15],
        mat: foliageDeepMat,
        useIco: true,
      },
      {
        r: 1.18,
        pos: [0.74, 3.15, -0.26],
        scaleVec: [1.10, 0.72, 1.10],
        rot: [-0.2, 1.1, -0.25],
        mat: foliageDeepMat,
      },
      {
        r: 1.15,
        pos: [0.12, 3.32, 0.68],
        scaleVec: [1.12, 0.74, 1.02],
        rot: [0.4, -0.5, 0.2],
        mat: foliageMidMat,
        useIco: true,
      },
      {
        r: 1.28,
        pos: [-0.22, 3.68, -0.36],
        scaleVec: [1.12, 0.75, 1.08],
        rot: [-0.35, 0.4, 0.3],
        mat: foliageMidMat,
      },
      {
        r: 1.18,
        pos: [0.42, 3.92, 0.20],
        scaleVec: [1.08, 0.75, 1.04],
        rot: [0.25, 0.9, -0.18],
        mat: foliageLightMat,
        useIco: true,
      },
      {
        r: 1.08,
        pos: [-0.06, 4.35, 0.04],
        scaleVec: [1.10, 0.76, 1.06],
        rot: [0.15, -0.8, 0.12],
        mat: foliageSunMat,
      },
    ];

    canopyClusters.forEach((c) => {
      const geo = c.useIco
        ? new THREE.IcosahedronGeometry(c.r * canopyScale, 1)
        : new THREE.DodecahedronGeometry(c.r * canopyScale, 1);
      const leafMesh = new THREE.Mesh(geo, c.mat);
      leafMesh.position.set(c.pos[0] * scale, c.pos[1] * scale, c.pos[2] * scale);
      leafMesh.scale.set(c.scaleVec[0], c.scaleVec[1], c.scaleVec[2]);
      leafMesh.rotation.set(c.rot[0], c.rot[1], c.rot[2]);
      leafMesh.castShadow = true;
      leafMesh.receiveShadow = true;
      treeGroup.add(leafMesh);
    });

    group.add(treeGroup);
  };

  // Historic Lamppost helper
  const addLamppost = (x: number, z: number) => {
    const lampGroup = new THREE.Group();
    lampGroup.position.set(x, envGroundY, z);

    const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 3.6, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.8;
    lampGroup.add(pole);

    const lanternGeo = new THREE.OctahedronGeometry(0.35, 0);
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    const lantern = new THREE.Mesh(lanternGeo, lanternMat);
    lantern.position.y = 3.6;
    lampGroup.add(lantern);

    group.add(lampGroup);
  };

  if (GLB_ONLY_SITE_IDS.has(siteId)) {
    return;
  } else if (siteId === 'HCM-DT-005') {
    // Nhà thờ Đức Bà Sài Gòn — Công Xã Paris Plaza Scene:
    // Hàng cây cổ thụ màu xanh rêu trầm (#3b5e38), đặt rộng ở rìa ngoài để không che khuất 5 Nhà nguyện tỏa tia phía sau
    [
      [-21.2, 22.0], [21.2, 22.0],
      [-21.2, 13.0], [21.2, 13.0],
      [-21.2, 3.5],  [21.2, 3.5],
      [-21.2, -6.0], [21.2, -6.0],
      [-21.2, -16.5], [21.2, -16.5],
      [-17.5, -31.0], [17.5, -31.0],
    ].forEach(([x, z]) => addTree(x, z, 0.88));

  } else if (siteId === 'HCM-DT-002') {
    // Nhà hát Thành phố (Quận 1) — Công trường Lam Sơn:
    // Giữ quảng trường đá hoa cương thoáng đãng, uy nghiêm (không đặt cây hoạt hình và cột đèn que tăm ở hai bên hông)
  } else if (siteId === 'HCM-DT-003') {
    // Bưu điện Trung tâm Sài Gòn: Cây xanh cổ thụ đặt đối xứng ở rìa ngoài khuôn viên (cách mặt tường tòa nhà > 5 đơn vị, tuyệt đối không chạm tường)
    [
      [-21.8, 16.5], [21.8, 16.5],
      [-21.8, 8.0],  [21.8, 8.0],
      [-21.8, -1.0], [21.8, -1.0],
      [-21.8, -9.5], [21.8, -9.5],
    ].forEach(([x, z]) => addTree(x, z, 0.95));
  } else if (siteId === 'HCM-DT-004') {
    // Chợ Bến Thành:
    // Bỏ toàn bộ cây xanh chắn trước mặt tiền; chỉ đặt 2 hàng cây nhỏ ở tuốt hai bên hông ngoài cùng x = -22 và x = 22
    [-22, 22].forEach((tx) => {
      [-10, -5, 0, 5, 10].forEach((tz) => {
        addTree(tx, tz, 0.85);
      });
    });
  } else if (siteId === 'HCM-DT-007') {
    // Bến Nhà Rồng - Bảo tàng Hồ Chí Minh:
    // Đặt 2 hàng cây xanh ở xa hai bên hông (x = ±19) để không bao giờ che khuất mặt tiền
    [-19, 19].forEach((tx) => {
      [-9.0, -3.0, 3.0, 9.0].forEach((tz) => {
        addTree(tx, tz, 0.9);
      });
    });
  } else if (siteId === 'HCM-DT-006') {
    // Bảo tàng Lịch sử TP.HCM: Giữ sân đá phẳng thoáng đãng chuẩn kiến trúc Đông Dương 1929 (không đặt cây tròn hay bồn cỏ hoạt hình)
  } else {
    // General Heritage Scene: Shaded trees & plaza lighting
    [[-15, 12], [15, 12], [-15, -10], [15, -10]].forEach(([x, z]) => addTree(x, z, 1.0));
    [[-8, 10], [8, 10]].forEach(([x, z]) => addLamppost(x, z));
  }
}

// Procedural Vietnamese National Flag texture with central gold star (cached)
function createVietnamFlagTexture(): THREE.CanvasTexture {
  const cached = landmarkTextureCache.get('vietnamFlagTex');
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 341;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#da251d';
    ctx.fillRect(0, 0, 512, 341);

    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    const cx = 256;
    const cy = 170.5;
    const outerR = 64;
    const innerR = 25;
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData = { isCached: true };
  landmarkTextureCache.set('vietnamFlagTex', tex);
  return tex;
}

// Procedural high-detail 3D architectural builder
export function buildHighDetailModel(siteId: string, group: THREE.Group): THREE.Points | null {
  // Properly dispose geometries, materials, and non-cached procedural textures when switching models
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    child.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh ||
        obj instanceof THREE.Points ||
        obj instanceof THREE.Line ||
        obj instanceof THREE.LineSegments ||
        obj instanceof THREE.LineLoop ||
        obj instanceof THREE.Sprite
      ) {
        (obj as THREE.Mesh).geometry?.dispose();
        const disposeMat = (m: THREE.Material) => {
          const anyMat = m as unknown as Record<string, unknown>;
          ['map', 'bumpMap', 'roughnessMap', 'normalMap', 'aoMap', 'emissiveMap', 'metalnessMap', 'alphaMap'].forEach((k) => {
            const tex = anyMat[k];
            if (tex && typeof (tex as THREE.Texture).dispose === 'function' && !(tex as THREE.Texture).userData?.isCached) {
              (tex as THREE.Texture).dispose();
            }
          });
          m.dispose();
        };
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) {
          mat.forEach(disposeMat);
        } else if (mat) {
          disposeMat(mat);
        }
      }
    });
  }

  if (GLB_ONLY_SITE_IDS.has(siteId)) {
    return null;
  }

  // Realistic Materials with PBR Procedural Textures
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.3,
    metalness: 0.85,
  });
  const goldBronzeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.25, metalness: 0.75 });

  // Add surrounding urban landscape environment (Cây xanh cổ thụ, đèn đường, vỉa hè lát đá)
  addUrbanLandscapeEnvironment(group, siteId);

  if (siteId === 'HCM-DT-002') {
    // =========================================================================
    // NHÀ HÁT THÀNH PHỐ (QUẬN 1) — MÔ HÌNH KIẾN TRÚC BEAUX-ARTS CHI TIẾT CAO
    // 1. Mái Mansard hình chóp cụt chữ nhật chuẩn xác bằng BufferGeometry 8 đỉnh
    //    (createRectangularMansard — không dùng CylinderGeometry xoay góc)
    // 2. Mặt tiền Beaux-Arts tinh xảo: tường kem hồng phấn trầm (#d8c3b4),
    //    đá trắng ngà (#f4efe6), sảnh Caryatids + 2 cặp cột đôi Corinth có rãnh,
    //    lòng vòm Tympanum đá nâu kem (#b89f8d) đắp nổi 3 vòng hoa phù điêu tròn,
    //    cụm tượng Đỉnh Vòm (Cartouche, đàn Lyre vàng đồng, 2 Thiên thần cánh lông vũ)
    // 3. Hệ cửa sổ có khung đố gỗ 3D (#5d4037), nan rẻ quạt (fanlight) & vòm hông tại z = -3.5
    // =========================================================================

    // -------------------------------------------------------------------------
    // 1. HỆ THỐNG TEXTURE CANVAS & VẬT LIỆU PBR CỔ ĐIỂN
    // -------------------------------------------------------------------------
    // 1) plazaStoneMat: Nền đá lát quảng trường (#8e8e90, lưới ô vuông #7a7a7c, roughness: 0.9)
    const createPlazaStoneTextures = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d')!;

      ctx.fillStyle = '#8e8e90';
      ctx.fillRect(0, 0, size, size);
      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, size, size);

      const tile = 32;
      for (let r = 0; r < size / tile; r++) {
        for (let c = 0; c < size / tile; c++) {
          const v = ((r * 17 + c * 31) % 9) - 4;
          ctx.fillStyle = `rgb(${142 + v}, ${142 + v}, ${144 + v})`;
          ctx.fillRect(c * tile + 1, r * tile + 1, tile - 2, tile - 2);
        }
      }

      ctx.strokeStyle = '#7a7a7c';
      ctx.lineWidth = 2;
      bCtx.strokeStyle = '#404040';
      bCtx.lineWidth = 2;
      for (let i = 0; i <= size; i += tile) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();

        bCtx.beginPath();
        bCtx.moveTo(i, 0);
        bCtx.lineTo(i, size);
        bCtx.stroke();
        bCtx.beginPath();
        bCtx.moveTo(0, i);
        bCtx.lineTo(size, i);
        bCtx.stroke();
      }

      for (let i = 0; i < 4500; i++) {
        const x = (i * 73) % size;
        const y = (i * 139) % size;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(x, y, 2, 2);
      }

      const map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(6, 11);
      map.colorSpace = THREE.SRGBColorSpace;

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(6, 11);

      return { map, bumpMap };
    };

    // 2) plinthGraniteMat: Chân đế đá hoa cương xám nâu (#68605b, mạch đá ngang #4e4743, roughness: 0.88)
    const createPlinthGraniteTextures = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d')!;

      ctx.fillStyle = '#68605b';
      ctx.fillRect(0, 0, size, size);
      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, size, size);

      const courseH = 64;
      for (let r = 0; r < size / courseH; r++) {
        const y = r * courseH;
        const blockW = 128;
        const offset = (r % 2) * 64;
        for (let x = -offset; x < size; x += blockW) {
          const delta = ((r * 19 + Math.floor(x / 32) * 11) % 9) - 4;
          ctx.fillStyle = `rgb(${104 + delta}, ${96 + delta}, ${91 + delta})`;
          ctx.fillRect(x + 2, y + 2, blockW - 4, courseH - 4);
        }
        ctx.fillStyle = '#4e4743';
        ctx.fillRect(0, y, size, 4);
        bCtx.fillStyle = '#262626';
        bCtx.fillRect(0, y, size, 4);

        for (let x = offset; x < size; x += blockW) {
          ctx.fillStyle = '#4e4743';
          ctx.fillRect(x, y, 3, courseH);
          bCtx.fillStyle = '#323232';
          bCtx.fillRect(x, y, 3, courseH);
        }
      }

      for (let i = 0; i < 7000; i++) {
        const x = (i * 97) % size;
        const y = (i * 163) % size;
        ctx.fillStyle = i % 3 === 0 ? 'rgba(220,210,200,0.07)' : 'rgba(35,30,28,0.09)';
        ctx.fillRect(x, y, 2, 2);
      }

      const map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(3, 1);
      map.colorSpace = THREE.SRGBColorSpace;

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(3, 1);

      return { map, bumpMap };
    };

    // 3) weatheredWallMat: Tường chính màu Kem Đá Hồng Phấn Trầm (#d8c3b4, roughness: 0.85 có đường kẻ chỉ đá ngang)
    const createWeatheredWallTextures = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d')!;

      ctx.fillStyle = '#d8c3b4';
      ctx.fillRect(0, 0, size, size);
      bCtx.fillStyle = '#888888';
      bCtx.fillRect(0, 0, size, size);

      const courseH = 32;
      for (let r = 0; r < size / courseH; r++) {
        const y = r * courseH;
        const shift = ((r * 23) % 7) - 3;
        ctx.fillStyle = `rgb(${216 + shift}, ${195 + shift}, ${180 + shift})`;
        ctx.fillRect(0, y + 2, size, courseH - 3);

        // Đường kẻ chỉ đá ngang (rustication lines)
        ctx.fillStyle = '#b9a292';
        ctx.fillRect(0, y, size, 3);
        ctx.fillStyle = 'rgba(250,242,235,0.38)';
        ctx.fillRect(0, y + 3, size, 1);

        bCtx.fillStyle = '#383838';
        bCtx.fillRect(0, y, size, 3);

        const blockW = 96;
        const offset = (r % 2) * 48;
        for (let x = offset; x < size; x += blockW) {
          ctx.fillStyle = '#c4ae9e';
          ctx.fillRect(x, y, 2, courseH);
          bCtx.fillStyle = '#555555';
          bCtx.fillRect(x, y, 2, courseH);
        }
      }

      // Vết bụi thời gian nhẹ ở chân tường và gờ mái
      const topGrad = ctx.createLinearGradient(0, 0, 0, 80);
      topGrad.addColorStop(0, 'rgba(110, 92, 80, 0.16)');
      topGrad.addColorStop(1, 'rgba(110, 92, 80, 0.0)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, size, 80);

      const botGrad = ctx.createLinearGradient(0, size - 90, 0, size);
      botGrad.addColorStop(0, 'rgba(105, 88, 76, 0.0)');
      botGrad.addColorStop(1, 'rgba(105, 88, 76, 0.18)');
      ctx.fillStyle = botGrad;
      ctx.fillRect(0, size - 90, size, 90);

      for (let i = 0; i < 4500; i++) {
        const x = (i * 61) % size;
        const y = (i * 127) % size;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,250,245,0.035)' : 'rgba(95,80,70,0.035)';
        ctx.fillRect(x, y, 2, 2);
      }

      const map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(2, 2);
      map.colorSpace = THREE.SRGBColorSpace;

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(2, 2);

      return { map, bumpMap };
    };

    // 4) ivoryStoneMat: Đá Trắng Ngà (#f4efe6, roughness: 0.75) cho hệ phào chỉ, cột, tượng và vòm cuốn
    const createIvoryStoneTextures = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d')!;

      ctx.fillStyle = '#f4efe6';
      ctx.fillRect(0, 0, size, size);
      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, size, size);

      for (let i = 0; i < 3000; i++) {
        const x = (i * 53) % size;
        const y = (i * 109) % size;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,254,250,0.07)' : 'rgba(165,152,138,0.05)';
        ctx.fillRect(x, y, 2, 2);
        bCtx.fillStyle = i % 2 === 0 ? '#8a8a8a' : '#767676';
        ctx.fillRect(x, y, 2, 2);
      }

      const map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.colorSpace = THREE.SRGBColorSpace;

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;

      return { map, bumpMap };
    };

    // 5) windowPaneMat: Mặt kính tối màu trà/xanh đen (#263238) có khung đố gỗ nâu (#5d4037) chia ô & nan rẻ quạt
    const createWindowPaneTexture = () => {
      const w = 256;
      const h = 512;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      // Mặt kính tối phản chiếu nhẹ (#263238)
      ctx.fillStyle = '#263238';
      ctx.fillRect(0, 0, w, h);

      const glassGrad = ctx.createLinearGradient(0, 0, w, h);
      glassGrad.addColorStop(0, 'rgba(130, 155, 170, 0.22)');
      glassGrad.addColorStop(0.45, 'rgba(38, 50, 56, 0.04)');
      glassGrad.addColorStop(1, 'rgba(95, 115, 128, 0.18)');
      ctx.fillStyle = glassGrad;
      ctx.fillRect(0, 0, w, h);

      // Khung đố gỗ màu nâu (#5d4037) kèm viền sáng nổi khối
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 12;
      ctx.strokeRect(6, 6, w - 12, h - 12);

      const archCenterY = 128;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(0, archCenterY);
      ctx.lineTo(w, archCenterY);
      ctx.stroke();

      // Vòm bán nguyệt đồng tâm + nan rẻ quạt (fanlight)
      const cx = w / 2;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx, archCenterY, 112, Math.PI, 0, false);
      ctx.stroke();

      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, archCenterY, 58, Math.PI, 0, false);
      ctx.stroke();

      const angles = [Math.PI * 0.18, Math.PI * 0.34, Math.PI * 0.5, Math.PI * 0.66, Math.PI * 0.82];
      for (const a of angles) {
        ctx.beginPath();
        ctx.moveTo(cx, archCenterY);
        ctx.lineTo(cx + Math.cos(a) * 114, archCenterY - Math.sin(a) * 114);
        ctx.stroke();
      }

      // Lưới đố gỗ chia ô chữ nhật dọc và ngang ở phần thân dưới
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(cx, archCenterY);
      ctx.lineTo(cx, h);
      ctx.stroke();

      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(w * 0.25, archCenterY);
      ctx.lineTo(w * 0.25, h);
      ctx.moveTo(w * 0.75, archCenterY);
      ctx.lineTo(w * 0.75, h);
      ctx.stroke();

      const rows = 5;
      const bodyH = h - archCenterY;
      for (let r = 1; r < rows; r++) {
        const y = archCenterY + (bodyH / rows) * r;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Đường chỉ highlight nhẹ trên nan gỗ để nhìn rõ khối
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, archCenterY - 2);
      ctx.lineTo(w, archCenterY - 2);
      ctx.moveTo(cx - 2, archCenterY);
      ctx.lineTo(cx - 2, h);
      ctx.stroke();

      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      return map;
    };

    // 6) blueSlateRoofMat: Ngói đá phiến xanh xám (#4a5868, lưới ô ngói #68798a, roughness: 0.6, metalness: 0.15)
    const createBlueSlateRoofTextures = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d')!;

      ctx.fillStyle = '#4a5868';
      ctx.fillRect(0, 0, size, size);
      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, size, size);

      const step = 32;
      ctx.strokeStyle = '#68798a';
      ctx.lineWidth = 2;
      bCtx.strokeStyle = '#454545';
      bCtx.lineWidth = 2;

      for (let i = -size; i <= size * 2; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + size, size);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(i, size);
        ctx.lineTo(i + size, 0);
        ctx.stroke();

        bCtx.beginPath();
        bCtx.moveTo(i, 0);
        bCtx.lineTo(i + size, size);
        bCtx.stroke();

        bCtx.beginPath();
        bCtx.moveTo(i, size);
        bCtx.lineTo(i + size, 0);
        bCtx.stroke();
      }

      ctx.strokeStyle = 'rgba(38, 48, 58, 0.48)';
      ctx.lineWidth = 1.5;
      for (let y = 0; y < size; y += step / 2) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }

      const map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(4, 2);
      map.colorSpace = THREE.SRGBColorSpace;

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(4, 2);

      return { map, bumpMap };
    };

    // Bề mặt phẳng đỉnh mái màu xám sáng (#8c949c, roughness: 0.8)
    const createFlatRoofTopTexture = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#8c949c';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = '#7b838b';
      ctx.lineWidth = 2;
      for (let i = 0; i <= size; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
      }
      for (let i = 0; i < 2500; i++) {
        const x = (i * 67) % size;
        const y = (i * 131) % size;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(40,45,50,0.05)';
        ctx.fillRect(x, y, 2, 2);
      }
      const map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(3, 6);
      map.colorSpace = THREE.SRGBColorSpace;
      return map;
    };

    if (!landmarkTextureCache.has('nhaHatPlazaTex')) {
      const t = createPlazaStoneTextures();
      t.map.userData = { isCached: true };
      t.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('nhaHatPlazaTex', t);
    }
    if (!landmarkTextureCache.has('nhaHatPlinthTex')) {
      const t = createPlinthGraniteTextures();
      t.map.userData = { isCached: true };
      t.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('nhaHatPlinthTex', t);
    }
    if (!landmarkTextureCache.has('nhaHatWallTex')) {
      const t = createWeatheredWallTextures();
      t.map.userData = { isCached: true };
      t.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('nhaHatWallTex', t);
    }
    if (!landmarkTextureCache.has('nhaHatIvoryTex')) {
      const t = createIvoryStoneTextures();
      t.map.userData = { isCached: true };
      t.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('nhaHatIvoryTex', t);
    }
    if (!landmarkTextureCache.has('nhaHatWinPaneTex')) {
      const t = createWindowPaneTexture();
      t.userData = { isCached: true };
      landmarkTextureCache.set('nhaHatWinPaneTex', t);
    }
    if (!landmarkTextureCache.has('nhaHatSlateTex')) {
      const t = createBlueSlateRoofTextures();
      t.map.userData = { isCached: true };
      t.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('nhaHatSlateTex', t);
    }
    if (!landmarkTextureCache.has('nhaHatFlatRoofTex')) {
      const t = createFlatRoofTopTexture();
      t.userData = { isCached: true };
      landmarkTextureCache.set('nhaHatFlatRoofTex', t);
    }

    const plazaTex = landmarkTextureCache.get('nhaHatPlazaTex');
    const plinthTex = landmarkTextureCache.get('nhaHatPlinthTex');
    const wallTex = landmarkTextureCache.get('nhaHatWallTex');
    const ivoryTex = landmarkTextureCache.get('nhaHatIvoryTex');
    const winPaneMap = landmarkTextureCache.get('nhaHatWinPaneTex');
    const slateTex = landmarkTextureCache.get('nhaHatSlateTex');
    const flatRoofMap = landmarkTextureCache.get('nhaHatFlatRoofTex');

    const plazaStoneMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: plazaTex.map,
      bumpMap: plazaTex.bumpMap,
      bumpScale: 0.015,
      roughness: 0.9,
      metalness: 0.02,
    });

    const plinthGraniteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: plinthTex.map,
      bumpMap: plinthTex.bumpMap,
      bumpScale: 0.025,
      roughness: 0.88,
      metalness: 0.04,
    });

    const weatheredWallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: wallTex.map,
      bumpMap: wallTex.bumpMap,
      bumpScale: 0.03,
      roughness: 0.85,
      metalness: 0.02,
    });

    const ivoryStoneMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: ivoryTex.map,
      bumpMap: ivoryTex.bumpMap,
      bumpScale: 0.015,
      roughness: 0.75,
      metalness: 0.03,
    });

    const windowPaneMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: winPaneMap,
      roughness: 0.22,
      metalness: 0.32,
    });

    const glassDarkMat = new THREE.MeshStandardMaterial({
      color: 0x263238,
      roughness: 0.18,
      metalness: 0.38,
    });

    const woodFrameMat = new THREE.MeshStandardMaterial({
      color: 0x5d4037,
      roughness: 0.55,
      metalness: 0.08,
    });

    const loggiaWoodMat = new THREE.MeshStandardMaterial({
      color: 0x6d4c41,
      roughness: 0.52,
      metalness: 0.08,
    });

    const grandDoorWoodMat = new THREE.MeshStandardMaterial({
      color: 0x4a2e1b,
      roughness: 0.48,
      metalness: 0.1,
    });

    const blueSlateRoofMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: slateTex.map,
      bumpMap: slateTex.bumpMap,
      bumpScale: 0.025,
      roughness: 0.6,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });

    const flatRoofTopMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: flatRoofMap,
      roughness: 0.8,
      metalness: 0.05,
    });

    // Nền lòng vòm Tympanum màu Đá Nâu Kem Cổ Điển (#b89f8d)
    const tympanumStoneMat = new THREE.MeshStandardMaterial({
      color: 0xb89f8d,
      bumpMap: ivoryTex.bumpMap,
      bumpScale: 0.018,
      roughness: 0.82,
      metalness: 0.04,
    });

    // Vàng đồng mờ cổ điển cho viền vòng hoa phù điêu và đàn Lyre
    const bronzeGoldMat = new THREE.MeshStandardMaterial({
      color: 0xc8a252,
      roughness: 0.36,
      metalness: 0.65,
    });

    const dormerFrameStoneMat = new THREE.MeshStandardMaterial({
      color: 0x3a444e,
      roughness: 0.72,
      metalness: 0.12,
    });

    const darkRecessMat = new THREE.MeshStandardMaterial({
      color: 0x2a2421,
      roughness: 0.82,
      metalness: 0.08,
    });

    // Gắn userData.originalMaterial cho mọi mesh để tương thích 100% với Bề mặt số / Khung dây / X-Ray / Exploded View
    const addMesh = (mesh: THREE.Mesh, tier = 1, isGroundPart = false) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const fallbackHex = mat && mat.color ? mat.color.getHex() : 0xd8c3b4;
      mesh.castShadow = !isGroundPart;
      mesh.receiveShadow = true;
      mesh.userData = {
        ...mesh.userData,
        tier,
        elevationTier: tier,
        origY: mesh.position.y,
        origColor: fallbackHex,
        isGround: isGroundPart,
        isMainBuilding: true,
        originalMaterialRef: mat,
        originalMaterial: {
          color: mat.color ? mat.color.clone() : new THREE.Color(fallbackHex),
          emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
          emissiveIntensity: mat.emissiveIntensity ?? 0,
          opacity: mat.opacity ?? 1,
          transparent: mat.transparent ?? false,
          wireframe: mat.wireframe ?? false,
          depthWrite: mat.depthWrite ?? true,
          map: mat.map || null,
          bumpMap: mat.bumpMap || null,
          bumpScale: mat.bumpScale ?? 0.02,
          normalMap: mat.normalMap || null,
          normalScale: mat.normalScale ? mat.normalScale.clone() : undefined,
          roughnessMap: mat.roughnessMap || null,
          roughness: mat.roughness ?? 0.8,
          metalness: mat.metalness ?? 0.05,
        },
      };
      group.add(mesh);
      return mesh;
    };

    const addBox = (
      w: number,
      h: number,
      d: number,
      mat: THREE.MeshStandardMaterial,
      x: number,
      y: number,
      z: number,
      tier = 1,
      isGroundPart = false
    ) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      return addMesh(m, tier, isGroundPart);
    };

    // =========================================================================
    // 1. HÀM DỰNG MÁI MANSARD HÌNH CHÓP CỤT CHỮ NHẬT CHUẨN XÁC 100%
    //    (Dùng THREE.BufferGeometry từ 8 đỉnh tọa độ của frustum box,
    //     tuyệt đối không dùng CylinderGeometry xoay góc)
    // =========================================================================
    const createRectangularMansard = (
      bottomW: number,
      bottomD: number,
      topW: number,
      topD: number,
      height: number,
      roofMat: THREE.MeshStandardMaterial,
      topFlatMat: THREE.MeshStandardMaterial,
      cx: number,
      baseY: number,
      cz: number,
      tier = 3
    ) => {
      const bw2 = bottomW / 2;
      const bd2 = bottomD / 2;
      const tw2 = topW / 2;
      const td2 = topD / 2;

      // 8 đỉnh tọa độ chính xác của hình hộp vát (frustum box):
      // Đáy dưới tại y = 0:
      const bBL: [number, number, number] = [-bw2, 0, -bd2];
      const bBR: [number, number, number] = [+bw2, 0, -bd2];
      const bFR: [number, number, number] = [+bw2, 0, +bd2];
      const bFL: [number, number, number] = [-bw2, 0, +bd2];

      // Đỉnh phẳng trên tại y = height:
      const tBL: [number, number, number] = [-tw2, height, -td2];
      const tBR: [number, number, number] = [+tw2, height, -td2];
      const tFR: [number, number, number] = [+tw2, height, +td2];
      const tFL: [number, number, number] = [-tw2, height, +td2];

      const positions: number[] = [];
      const uvs: number[] = [];

      const addQuadFace = (
        p0: [number, number, number],
        p1: [number, number, number],
        p2: [number, number, number],
        p3: [number, number, number],
        uScale: number,
        vScale: number
      ) => {
        // Tam giác 1: p0 -> p1 -> p2
        positions.push(...p0, ...p1, ...p2);
        uvs.push(0, 0, uScale, 0, uScale, vScale);
        // Tam giác 2: p0 -> p2 -> p3
        positions.push(...p0, ...p2, ...p3);
        uvs.push(0, 0, uScale, vScale, 0, vScale);
      };

      const vTiles = Math.max(1, height / 2.5);
      // 1) Mặt nghiêng Trước (+Z): bFL -> bFR -> tFR -> tFL
      addQuadFace(bFL, bFR, tFR, tFL, Math.max(1, bottomW / 6), vTiles);
      // 2) Mặt nghiêng Sau (-Z): bBR -> bBL -> tBL -> tBR
      addQuadFace(bBR, bBL, tBL, tBR, Math.max(1, bottomW / 6), vTiles);
      // 3) Mặt nghiêng Phải (+X): bFR -> bBR -> tBR -> tFR
      addQuadFace(bFR, bBR, tBR, tFR, Math.max(1, bottomD / 6), vTiles);
      // 4) Mặt nghiêng Trái (-X): bBL -> bFL -> tFL -> tBL
      addQuadFace(bBL, bFL, tFL, tBL, Math.max(1, bottomD / 6), vTiles);

      const frustumGeo = new THREE.BufferGeometry();
      frustumGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      frustumGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      frustumGeo.computeVertexNormals();

      const frustumMesh = new THREE.Mesh(frustumGeo, roofMat);
      frustumMesh.position.set(cx, baseY, cz);
      addMesh(frustumMesh, tier);

      // Mặt phẳng đỉnh trên cùng: BoxGeometry(topW, 0.12, topD) tại y = baseY + height dùng flatRoofTopMat
      addBox(topW, 0.12, topD, topFlatMat, cx, baseY + height, cz, tier);

      // Dọc 4 cạnh viền đỉnh mái đặt các thanh gờ đá mảnh màu trắng ngà (ivoryStoneMat)
      const rimY = baseY + height + 0.08;
      const rimThick = 0.16;
      addBox(topW + rimThick * 2, 0.16, rimThick, ivoryStoneMat, cx, rimY, cz + td2, tier);
      addBox(topW + rimThick * 2, 0.16, rimThick, ivoryStoneMat, cx, rimY, cz - td2, tier);
      addBox(rimThick, 0.16, topD, ivoryStoneMat, cx + tw2, rimY, cz, tier);
      addBox(rimThick, 0.16, topD, ivoryStoneMat, cx - tw2, rimY, cz, tier);
    };

    // Helper dựng hàng lan can con tiện đá trắng (Balustrade) thanh thoát
    const buildStoneBalustrade = (
      x1: number,
      z1: number,
      x2: number,
      z2: number,
      baseY: number,
      height = 0.72,
      tier = 2
    ) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.2) return;
      const cx = (x1 + x2) / 2;
      const cz = (z1 + z2) / 2;
      const isAlongX = Math.abs(dx) >= Math.abs(dz);
      const railW = isAlongX ? len : 0.24;
      const railD = isAlongX ? 0.24 : len;

      // Đế dưới và tay vịn trên
      addBox(railW, 0.12, railD, ivoryStoneMat, cx, baseY + 0.06, cz, tier);
      addBox(railW, 0.14, railD, ivoryStoneMat, cx, baseY + height - 0.07, cz, tier);

      // Các con tiện đá tròn ở giữa
      const spacing = 0.36;
      const count = Math.max(2, Math.floor(len / spacing));
      const balH = Math.max(0.18, height - 0.26);
      for (let i = 1; i < count; i++) {
        const t = i / count;
        const bx = x1 + dx * t;
        const bz = z1 + dz * t;
        const bal = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, balH, 10), ivoryStoneMat);
        bal.position.set(bx, baseY + 0.12 + balH / 2, bz);
        addMesh(bal, tier);
      }
    };

    // Helper dựng cột tròn Corinth có rãnh thân cột (fluted Corinthian column)
    const buildFlutedCorinthianColumn = (
      colX: number,
      baseY: number,
      topY: number,
      colZ: number,
      radiusBottom = 0.32,
      radiusTop = 0.29,
      tier = 1
    ) => {
      const totalH = topY - baseY;
      const plinthH = 0.26;
      const capH = 0.42;
      const shaftH = Math.max(0.5, totalH - plinthH - capH);

      // Đế cột vuông + cổ đế tròn (torus molding)
      addBox(radiusBottom * 2.45, plinthH, radiusBottom * 2.45, ivoryStoneMat, colX, baseY + plinthH / 2, colZ, tier);
      const baseTorus = new THREE.Mesh(
        new THREE.CylinderGeometry(radiusBottom * 1.12, radiusBottom * 1.2, 0.14, 20),
        ivoryStoneMat
      );
      baseTorus.position.set(colX, baseY + plinthH + 0.07, colZ);
      addMesh(baseTorus, tier);

      // Thân cột chính
      const shaftCenterY = baseY + plinthH + shaftH / 2;
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(radiusTop, radiusBottom, shaftH, 24),
        ivoryStoneMat
      );
      shaft.position.set(colX, shaftCenterY, colZ);
      addMesh(shaft, tier);

      // Các gờ rãnh dọc thân cột (fluting ribs)
      const fluteCount = 12;
      for (let f = 0; f < fluteCount; f++) {
        const ang = (f / fluteCount) * Math.PI * 2;
        const rMid = (radiusBottom + radiusTop) * 0.5;
        const fx = colX + Math.cos(ang) * (rMid - 0.005);
        const fz = colZ + Math.sin(ang) * (rMid - 0.005);
        const fluteStrip = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.025, shaftH * 0.94, 6),
          ivoryStoneMat
        );
        fluteStrip.position.set(fx, shaftCenterY, fz);
        addMesh(fluteStrip, tier);
      }

      // Đầu cột Corinth (Corinthian capital) chạm lá Ô-rô (acanthus) + tấm abacus
      const capBaseY = baseY + plinthH + shaftH;
      const neckRing = new THREE.Mesh(
        new THREE.CylinderGeometry(radiusTop * 1.08, radiusTop * 1.08, 0.08, 20),
        ivoryStoneMat
      );
      neckRing.position.set(colX, capBaseY + 0.04, colZ);
      addMesh(neckRing, tier);

      const bell = new THREE.Mesh(
        new THREE.CylinderGeometry(radiusTop * 1.42, radiusTop * 1.02, capH * 0.72, 18),
        ivoryStoneMat
      );
      bell.position.set(colX, capBaseY + capH * 0.42, colZ);
      addMesh(bell, tier);

      addBox(
        radiusTop * 2.95,
        capH * 0.28,
        radiusTop * 2.95,
        ivoryStoneMat,
        colX,
        topY - (capH * 0.28) / 2,
        colZ,
        tier
      );
    };

    // =========================================================================
    // HELPER CỬA SỔ VÒM & CỬA CHỮ NHẬT CÓ VIỀN ĐÁ TRẮNG NGÀ, MẶT KÍNH #263238,
    // KHUNG ĐỐ GỖ NÂU (#5d4037) CHIA Ô & NAN VÒM RẺ QUẠT (FANLIGHT) NỔI KHỐI 3D
    // =========================================================================
    const buildArchedWindowUnit = (
      cx: number,
      cy: number,
      cz: number,
      w: number,
      h: number,
      axis: 'z+' | 'z-' | 'x+' | 'x-',
      withArchstone = true,
      tier = 1,
      customWoodMat: THREE.MeshStandardMaterial = woodFrameMat
    ) => {
      const isZ = axis === 'z+' || axis === 'z-';
      const dir = axis === 'z+' || axis === 'x+' ? 1 : -1;
      const archR = w / 2;
      const rectH = Math.max(0.4, h - archR);
      const bottomY = cy - h / 2;
      const springY = bottomY + rectH;

      // 1) Mặt kính tối (#263238) kèm texture cửa
      const paneShape = new THREE.Shape();
      paneShape.moveTo(-w / 2, 0);
      paneShape.lineTo(w / 2, 0);
      paneShape.lineTo(w / 2, rectH);
      paneShape.absarc(0, rectH, archR, 0, Math.PI, false);
      paneShape.lineTo(-w / 2, 0);

      const paneGeo = new THREE.ShapeGeometry(paneShape, 24);
      const posAttr = paneGeo.attributes.position;
      const uvs: number[] = [];
      for (let i = 0; i < posAttr.count; i++) {
        const px = posAttr.getX(i);
        const py = posAttr.getY(i);
        uvs.push((px + w / 2) / w, py / h);
      }
      paneGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

      const paneMesh = new THREE.Mesh(paneGeo, windowPaneMat);
      if (axis === 'z-') paneMesh.rotation.y = Math.PI;
      else if (axis === 'x+') paneMesh.rotation.y = Math.PI / 2;
      else if (axis === 'x-') paneMesh.rotation.y = -Math.PI / 2;

      const glassOffset = 0.04 * dir;
      paneMesh.position.set(
        isZ ? cx : cx + glassOffset,
        bottomY,
        isZ ? cz + glassOffset : cz
      );
      addMesh(paneMesh, tier);

      // 2) Khung đố gỗ màu nâu (#5d4037) chia ô chữ nhật và nan vòm rẻ quạt (fanlight) nổi khối 3D
      const woodOffset = 0.065 * dir;
      const woodDepth = 0.05;
      // Thanh đố ngang tại chân vòm (transom bar)
      if (isZ) {
        addBox(w, 0.06, woodDepth, customWoodMat, cx, springY, cz + woodOffset, tier);
        // Thanh đố dọc giữa và 2 thanh đố phụ
        addBox(0.055, rectH, woodDepth, customWoodMat, cx, bottomY + rectH / 2, cz + woodOffset, tier);
        addBox(0.04, rectH, woodDepth, customWoodMat, cx - w * 0.24, bottomY + rectH / 2, cz + woodOffset, tier);
        addBox(0.04, rectH, woodDepth, customWoodMat, cx + w * 0.24, bottomY + rectH / 2, cz + woodOffset, tier);
        // Các thanh đố ngang chia ô chữ nhật
        for (let r = 1; r <= 3; r++) {
          const ry = bottomY + (rectH / 4) * r;
          addBox(w, 0.04, woodDepth, customWoodMat, cx, ry, cz + woodOffset, tier);
        }
      } else {
        addBox(woodDepth, 0.06, w, customWoodMat, cx + woodOffset, springY, cz, tier);
        addBox(woodDepth, rectH, 0.055, customWoodMat, cx + woodOffset, bottomY + rectH / 2, cz, tier);
        addBox(woodDepth, rectH, 0.04, customWoodMat, cx + woodOffset, bottomY + rectH / 2, cz - w * 0.24, tier);
        addBox(woodDepth, rectH, 0.04, customWoodMat, cx + woodOffset, bottomY + rectH / 2, cz + w * 0.24, tier);
        for (let r = 1; r <= 3; r++) {
          const ry = bottomY + (rectH / 4) * r;
          addBox(woodDepth, 0.04, w, customWoodMat, cx + woodOffset, ry, cz, tier);
        }
      }

      // Nan vòm rẻ quạt 3D (fanlight spokes) ở phần vòm trên
      const fanAngles = [0.2, 0.35, 0.5, 0.65, 0.8].map((v) => v * Math.PI);
      const spokeLen = archR * 0.92;
      for (const ang of fanAngles) {
        const spokeGeo = new THREE.BoxGeometry(isZ ? 0.035 : woodDepth, spokeLen, isZ ? woodDepth : 0.035);
        const spokeMesh = new THREE.Mesh(spokeGeo, customWoodMat);
        const offsetAlong = (spokeLen / 2) * Math.cos(ang);
        const offsetUp = (spokeLen / 2) * Math.sin(ang);
        if (isZ) {
          spokeMesh.position.set(cx + offsetAlong, springY + offsetUp, cz + woodOffset);
          spokeMesh.rotation.z = ang - Math.PI / 2;
        } else {
          spokeMesh.position.set(cx + woodOffset, springY + offsetUp, cz + offsetAlong);
          spokeMesh.rotation.x = -(ang - Math.PI / 2);
        }
        addMesh(spokeMesh, tier);
      }

      // Vòng cung gỗ nhỏ đồng tâm bên trong fanlight
      const innerFanArc = new THREE.Mesh(
        new THREE.TorusGeometry(archR * 0.52, 0.025, 8, 16, Math.PI),
        customWoodMat
      );
      if (!isZ) innerFanArc.rotation.y = Math.PI / 2;
      innerFanArc.position.set(
        isZ ? cx : cx + woodOffset,
        springY,
        isZ ? cz + woodOffset : cz
      );
      addMesh(innerFanArc, tier);

      // 3) Viền phào đá trắng ngà (ivoryStoneMat) bao quanh ô cửa
      const frameOut = 0.095 * dir;
      if (isZ) {
        addBox(w + 0.34, 0.16, 0.26, ivoryStoneMat, cx, bottomY - 0.06, cz + frameOut, tier);
        addBox(0.14, rectH, 0.22, ivoryStoneMat, cx - w / 2 - 0.07, bottomY + rectH / 2, cz + frameOut, tier);
        addBox(0.14, rectH, 0.22, ivoryStoneMat, cx + w / 2 + 0.07, bottomY + rectH / 2, cz + frameOut, tier);
      } else {
        addBox(0.26, 0.16, w + 0.34, ivoryStoneMat, cx + frameOut, bottomY - 0.06, cz, tier);
        addBox(0.22, rectH, 0.14, ivoryStoneMat, cx + frameOut, bottomY + rectH / 2, cz - w / 2 - 0.07, tier);
        addBox(0.22, rectH, 0.14, ivoryStoneMat, cx + frameOut, bottomY + rectH / 2, cz + w / 2 + 0.07, tier);
      }

      if (withArchstone) {
        const archShape = new THREE.Shape();
        archShape.absarc(0, 0, archR + 0.18, 0, Math.PI, false);
        archShape.absarc(0, 0, archR, Math.PI, 0, true);
        archShape.closePath();

        const archGeo = new THREE.ExtrudeGeometry(archShape, {
          depth: 0.22,
          bevelEnabled: false,
          curveSegments: 22,
        });
        archGeo.translate(0, 0, -0.11);
        const archMesh = new THREE.Mesh(archGeo, ivoryStoneMat);
        if (!isZ) {
          archMesh.rotation.y = Math.PI / 2;
        }
        archMesh.position.set(
          isZ ? cx : cx + frameOut,
          springY,
          isZ ? cz + frameOut : cz
        );
        addMesh(archMesh, tier);

        // Viên đá khóa vòm (keystone) ở đỉnh
        if (isZ) {
          addBox(0.22, 0.28, 0.28, ivoryStoneMat, cx, springY + archR + 0.1, cz + frameOut * 1.2, tier);
        } else {
          addBox(0.28, 0.28, 0.22, ivoryStoneMat, cx + frameOut * 1.2, springY + archR + 0.1, cz, tier);
        }
      }
    };

    // Helper dựng cửa sổ chữ nhật tầng 1 có viền phào đá trắng ngà + mặt kính #263238 + đố gỗ #5d4037 nổi khối
    const buildRectWindowUnit = (
      cx: number,
      cy: number,
      cz: number,
      w: number,
      h: number,
      axis: 'z+' | 'z-' | 'x+' | 'x-',
      tier = 1
    ) => {
      const isZ = axis === 'z+' || axis === 'z-';
      const dir = axis === 'z+' || axis === 'x+' ? 1 : -1;
      const paneW = isZ ? w : 0.05;
      const paneD = isZ ? 0.05 : w;
      addBox(
        paneW,
        h,
        paneD,
        glassDarkMat,
        isZ ? cx : cx + 0.03 * dir,
        cy,
        isZ ? cz + 0.03 * dir : cz,
        tier
      );

      // Khung đố gỗ màu nâu (#5d4037) chia ô chữ nhật nổi khối
      const woodOut = 0.055 * dir;
      if (isZ) {
        addBox(w, 0.05, 0.05, woodFrameMat, cx, cy + h / 2 - 0.03, cz + woodOut, tier);
        addBox(w, 0.05, 0.05, woodFrameMat, cx, cy - h / 2 + 0.03, cz + woodOut, tier);
        addBox(0.05, h, 0.05, woodFrameMat, cx, cy, cz + woodOut, tier);
        addBox(0.04, h, 0.05, woodFrameMat, cx - w * 0.25, cy, cz + woodOut, tier);
        addBox(0.04, h, 0.05, woodFrameMat, cx + w * 0.25, cy, cz + woodOut, tier);
        for (const rOffset of [-h * 0.22, 0, h * 0.22]) {
          addBox(w, 0.04, 0.05, woodFrameMat, cx, cy + rOffset, cz + woodOut, tier);
        }
      } else {
        addBox(0.05, 0.05, w, woodFrameMat, cx + woodOut, cy + h / 2 - 0.03, cz, tier);
        addBox(0.05, 0.05, w, woodFrameMat, cx + woodOut, cy - h / 2 + 0.03, cz, tier);
        addBox(0.05, h, 0.05, woodFrameMat, cx + woodOut, cy, cz, tier);
        addBox(0.05, h, 0.04, woodFrameMat, cx + woodOut, cy, cz - w * 0.25, tier);
        addBox(0.05, h, 0.04, woodFrameMat, cx + woodOut, cy, cz + w * 0.25, tier);
        for (const rOffset of [-h * 0.22, 0, h * 0.22]) {
          addBox(0.05, 0.04, w, woodFrameMat, cx + woodOut, cy + rOffset, cz, tier);
        }
      }

      // Viền phào đá trắng ngà bao quanh
      const fOut = 0.085 * dir;
      if (isZ) {
        addBox(w + 0.28, 0.16, 0.24, ivoryStoneMat, cx, cy - h / 2 - 0.06, cz + fOut, tier);
        addBox(w + 0.28, 0.18, 0.24, ivoryStoneMat, cx, cy + h / 2 + 0.07, cz + fOut, tier);
        addBox(0.13, h, 0.2, ivoryStoneMat, cx - w / 2 - 0.065, cy, cz + fOut, tier);
        addBox(0.13, h, 0.2, ivoryStoneMat, cx + w / 2 + 0.065, cy, cz + fOut, tier);
      } else {
        addBox(0.24, 0.16, w + 0.28, ivoryStoneMat, cx + fOut, cy - h / 2 - 0.06, cz, tier);
        addBox(0.24, 0.18, w + 0.28, ivoryStoneMat, cx + fOut, cy + h / 2 + 0.07, cz, tier);
        addBox(0.2, h, 0.13, ivoryStoneMat, cx + fOut, cy, cz - w / 2 - 0.065, tier);
        addBox(0.2, h, 0.13, ivoryStoneMat, cx + fOut, cy, cz + w / 2 + 0.065, tier);
      }
    };

    // =========================================================================
    // 2. BỐ CỤC TỔNG THỂ & CHÂN ĐẾ
    // =========================================================================
    // Nền Quảng Trường Đá Phẳng: width = 24, height = 0.3, depth = 46 tại (0, 0.15, 0)
    addBox(24.0, 0.3, 46.0, plazaStoneMat, 0, 0.15, 0, 0, true);

    // Khối Thân Chính (Main Body): width = 16.4 (x: -8.2 -> +8.2), z: -17.5 -> +10.0 (depth = 27.5, tâm z = -3.75)
    addBox(16.4, 7.2, 27.5, weatheredWallMat, 0, 5.6, -3.75, 1);
    // Chân đế đá hoa cương (plinthGraniteMat) cao y = 1.7 (từ y = 0.3 lên y = 2.0):
    // Phần thân chính từ z = -16.9 ra z = +10.0 (dài 26.9, tâm z = -3.45)
    addBox(16.4, 1.7, 26.9, plinthGraniteMat, 0, 1.15, -3.45, 1);
    // Tại phần đuôi sau (z từ -16.9 đến -17.5, sâu 0.6):
    // Hai cánh bên hông (x từ -8.2 đến -4.2 và từ +4.2 đến +8.2) làm đầy ra mép sau z = -17.5
    addBox(4.0, 1.7, 0.6, plinthGraniteMat, -6.2, 1.15, -17.2, 1);
    addBox(4.0, 1.7, 0.6, plinthGraniteMat, 6.2, 1.15, -17.2, 1);
    // Khoảng giữa (x từ -4.2 đến +4.2): tường thụt lùi vào trong 0.6 đơn vị (tại z = -16.9) để tạo hốc lõm sảnh hậu đài!

    // =========================================================================
    // 3. MẶT TIỀN BEAUX-ARTS TINH XẢO (Z >= +10.0)
    // =========================================================================
    // A. Bậc Tam Cấp Liền Khối (z từ +15.5 đến +19.2):
    // 1 khối bậc thang đá xám liền mạch trải rộng ở chính giữa dẫn lên Sàn Sảnh (không có rãnh cắt đôi)
    const numSteps = 9;
    const stepStartZ = 15.5;
    const stepEndZ = 19.2;
    const totalStepDepth = stepEndZ - stepStartZ;
    const stepRun = totalStepDepth / numSteps;
    const totalStepRise = 1.6 - 0.3;
    const stepRise = totalStepRise / numSteps;

    for (let i = 0; i < numSteps; i++) {
      const t = i / (numSteps - 1);
      const w = 10.6 - (10.6 - 8.8) * t;
      const h = stepRise * (i + 1);
      const d = totalStepDepth - i * stepRun;
      const cz = stepStartZ + d / 2;
      addBox(w, h, d, plazaStoneMat, 0, 0.3 + h / 2, cz, 1);
    }

    // Hai bệ đá (cheek walls) kẹp hai bên bậc tam cấp
    for (const side of [-1, 1]) {
      addBox(0.55, 1.35, 3.7, plinthGraniteMat, side * 4.85, 0.975, 17.35, 1);
      addBox(0.65, 0.16, 3.85, ivoryStoneMat, side * 4.85, 1.68, 17.35, 1);
    }

    // Bệ sàn sảnh đón tầng 1 (từ y = 0.3 lên y = 1.6; khoảng sảnh từ y = 1.6 đến 5.2 hoàn toàn rỗng thoáng)
    addBox(8.8, 1.3, 5.6, plinthGraniteMat, 0, 0.95, 12.8, 1);
    addBox(9.1, 0.14, 2.0, ivoryStoneMat, 0, 1.56, 14.65, 1);

    // Tường hậu bên trong sảnh đón tại z = +13.75 (ngăn cách sảnh ngoài và khán phòng trong)
    addBox(8.8, 7.6, 3.75, weatheredWallMat, 0, 5.4, 11.875, 1);

    // Tường trong sảnh có 3 bộ cửa gỗ đôi màu nâu cánh gián (#4a2e1b) lắp kính chia ô
    for (const doorX of [-2.2, 0, 2.2]) {
      const isCenterDoor = doorX === 0;
      const doorW = isCenterDoor ? 1.65 : 1.35;
      const doorH = 3.25;
      // Khung phào đá trắng ngà bao quanh cửa sảnh + vòm bán nguyệt trên cửa
      addBox(doorW + 0.34, doorH + 0.2, 0.16, ivoryStoneMat, doorX, 1.6 + doorH / 2, 13.78, 1);
      // Cánh cửa gỗ đôi màu nâu cánh gián (#4a2e1b)
      addBox(doorW, doorH, 0.14, grandDoorWoodMat, doorX, 1.6 + doorH / 2, 13.82, 1);
      // Ô kính trên cánh cửa gỗ đôi
      addBox(doorW * 0.36, doorH * 0.58, 0.16, glassDarkMat, doorX - doorW * 0.22, 1.6 + doorH * 0.56, 13.84, 1);
      addBox(doorW * 0.36, doorH * 0.58, 0.16, glassDarkMat, doorX + doorW * 0.22, 1.6 + doorH * 0.56, 13.84, 1);
      // Các thanh đố gỗ chia ô trên cửa chính
      addBox(0.06, doorH, 0.18, grandDoorWoodMat, doorX, 1.6 + doorH / 2, 13.85, 1);
      for (const barY of [2.6, 3.2, 3.8, 4.35]) {
        addBox(doorW * 0.88, 0.045, 0.18, grandDoorWoodMat, doorX, barY, 13.85, 1);
      }
      // Tay nắm cửa bằng đồng vàng
      addBox(0.04, 0.28, 0.2, bronzeGoldMat, doorX - 0.08, 2.95, 13.86, 1);
      addBox(0.04, 0.28, 0.2, bronzeGoldMat, doorX + 0.08, 2.95, 13.86, 1);
    }

    // B. Sảnh Đón Caryatids & 2 Cặp Cột Tròn Đôi Corinth Có Rãnh Thân Cột:
    // 1) Tại x = ±1.3: 2 Tượng Nữ Thần Caryatids đá trắng ngà đứng trên bệ đá chạm khắc nâng đỡ dầm ban công
    for (const caryX of [-1.3, 1.3]) {
      // Bệ đá chạm khắc nhiều tầng (y từ 1.6 đến 2.75)
      addBox(0.82, 0.2, 0.82, ivoryStoneMat, caryX, 1.7, 15.18, 1);
      addBox(0.66, 0.78, 0.66, ivoryStoneMat, caryX, 2.19, 15.18, 1);
      addBox(0.52, 0.5, 0.12, ivoryStoneMat, caryX, 2.19, 15.52, 1); // Phù điêu nổi mặt trước bệ
      addBox(0.78, 0.18, 0.78, ivoryStoneMat, caryX, 2.67, 15.18, 1);

      // Thân tượng Nữ thần Caryatid uyển chuyển (y từ 2.76 đến 5.2)
      const pedTop = 2.76;
      const robeLower = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.28, 1.05, 18), ivoryStoneMat);
      robeLower.position.set(caryX, pedTop + 0.525, 15.18);
      addMesh(robeLower, 1);

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.18, 0.74, 18), ivoryStoneMat);
      torso.position.set(caryX, pedTop + 1.38, 15.18);
      addMesh(torso, 1);

      const bust = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 14), ivoryStoneMat);
      bust.scale.set(1.1, 0.85, 0.95);
      bust.position.set(caryX, pedTop + 1.56, 15.22);
      addMesh(bust, 1);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 16), ivoryStoneMat);
      head.position.set(caryX, pedTop + 1.94, 15.21);
      addMesh(head, 1);

      // Hai tay giơ lên nâng đỡ đệm đầu cột (cushion capital) dưới dầm ban công
      for (const armSide of [-1, 1]) {
        const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.48, 10), ivoryStoneMat);
        upperArm.position.set(caryX + armSide * 0.21, pedTop + 1.88, 15.23);
        upperArm.rotation.z = -armSide * 0.36;
        addMesh(upperArm, 1);
      }

      // Đấu đỡ console & cuộn volute trên đầu tượng chạm sát đáy dầm ban công tại y = 5.2
      addBox(0.58, 0.24, 0.58, ivoryStoneMat, caryX, 5.08, 15.18, 1);
    }

    // 2) Hai bên ngoài (x = ±3.3 và x = ±4.2): 2 Cặp Cột Tròn Đôi Corinth có rãnh thân cột (fluted columns)
    //    và đầu cột hoa văn đỡ chân Vòm lớn (từ y = 1.6 lên y = 7.8)
    for (const side of [-1, 1]) {
      // Bệ đá chung dưới mỗi cặp cột đôi (bao quanh x = ±3.3 và ±4.2)
      addBox(1.85, 0.48, 1.08, ivoryStoneMat, side * 3.75, 1.84, 15.15, 1);
      addBox(1.72, 0.72, 0.96, ivoryStoneMat, side * 3.75, 2.44, 15.15, 1);
      addBox(1.88, 0.18, 1.1, ivoryStoneMat, side * 3.75, 2.89, 15.15, 1);

      for (const absColX of [3.3, 4.2]) {
        const colX = side * absColX;
        buildFlutedCorinthianColumn(colX, 2.98, 7.8, 15.15, 0.3, 0.27, 1);
      }

      // Dầm entablature trên đầu cặp cột đôi đỡ chân Vòm lớn tại y = 7.8
      addBox(1.92, 0.34, 1.16, ivoryStoneMat, side * 3.75, 7.95, 15.15, 2);
    }

    // C. Ban Công Tầng 2 (y = 5.2 đến 5.8):
    // Dầm ngang đắp nổi gờ chỉ trắng ngà và hàng lan can con tiện đá trắng thanh thoát chạy liền mạch từ trái sang phải
    addBox(6.6, 0.32, 1.65, ivoryStoneMat, 0, 5.2, 14.55, 2);
    addBox(6.8, 0.14, 1.78, ivoryStoneMat, 0, 5.4, 14.58, 2);
    // Hàng con tiện consol (brackets) nhỏ đắp nổi dưới gờ dầm ban công
    for (let bx = -2.8; bx <= 2.81; bx += 0.56) {
      addBox(0.14, 0.22, 0.28, ivoryStoneMat, bx, 5.02, 15.26, 2);
    }
    // Trụ đầu lan can và hàng lan can con tiện đá trắng chạy liền mạch từ trái sang phải
    addBox(0.36, 0.68, 0.36, ivoryStoneMat, -2.95, 5.76, 15.28, 2);
    addBox(0.36, 0.68, 0.36, ivoryStoneMat, 2.95, 5.76, 15.28, 2);
    addBox(0.34, 0.68, 0.36, ivoryStoneMat, -1.3, 5.76, 15.28, 2);
    addBox(0.34, 0.68, 0.36, ivoryStoneMat, 1.3, 5.76, 15.28, 2);
    buildStoneBalustrade(-2.95, 15.28, -1.3, 15.28, 5.44, 0.62, 2);
    buildStoneBalustrade(-1.3, 15.28, 1.3, 15.28, 5.44, 0.62, 2);
    buildStoneBalustrade(1.3, 15.28, 2.95, 15.28, 5.44, 0.62, 2);

    // D. Vòm Cuốn Lớn (Grand Arch) & Phù Điêu Tympanum Màu Đá Trầm (#b89f8d):
    // 1) Vành vòm bán nguyệt (ivoryStoneMat) đắp nổi 3 tầng gờ chỉ (archivolt) và hoa văn hộp (coffers) ở mặt dưới vòm
    const archCenterY = 7.8;
    const buildArchRingLayer = (rOut: number, rIn: number, zCenter: number, depth: number) => {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, rOut, 0, Math.PI, false);
      shape.absarc(0, 0, rIn, Math.PI, 0, true);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: false,
        curveSegments: 48,
      });
      geo.translate(0, 0, -depth / 2);
      const mesh = new THREE.Mesh(geo, ivoryStoneMat);
      mesh.position.set(0, archCenterY, zCenter);
      addMesh(mesh, 2);
    };

    // 3 tầng gờ chỉ đồng tâm trên vành vòm bán nguyệt
    buildArchRingLayer(4.35, 3.35, 14.68, 1.15);
    buildArchRingLayer(4.42, 3.65, 14.88, 0.92);
    buildArchRingLayer(4.5, 3.95, 15.04, 0.72);

    // Hoa văn hộp (coffers) và các gờ vòm đắp nổi ở mặt dưới vòm (intrados)
    const cofferCount = 13;
    for (let c = 1; c < cofferCount; c++) {
      const ang = (c / cofferCount) * Math.PI;
      const rInt = 3.38;
      const cxCoff = Math.cos(ang) * rInt;
      const cyCoff = archCenterY + Math.sin(ang) * rInt;
      const cofferRib = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.98), ivoryStoneMat);
      cofferRib.position.set(cxCoff, cyCoff, 14.68);
      cofferRib.rotation.z = ang - Math.PI / 2;
      addMesh(cofferRib, 2);

      const rosette = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10), bronzeGoldMat);
      rosette.position.set(Math.cos(ang) * (rInt + 0.04), archCenterY + Math.sin(ang) * (rInt + 0.04), 14.68);
      rosette.rotation.z = ang;
      addMesh(rosette, 2);
    }

    // Tường vai vòm (spandrels) nối hai bên lưng vòm vào hai cánh mặt tiền
    addBox(1.3, 2.2, 1.1, weatheredWallMat, -3.9, 8.9, 14.5, 2);
    addBox(1.3, 2.2, 1.1, weatheredWallMat, 3.9, 8.9, 14.5, 2);

    // 2) Phía dưới dầm ngang (y từ 5.6 đến 7.8):
    //    3 ô cửa vòm cao có khung đố gỗ màu nâu sáng (#6d4c41), nan gỗ rẻ quạt ở vòm trên và kính màu trà phản chiếu nhẹ (#263238)
    for (const winX of [-1.75, 0, 1.75]) {
      buildArchedWindowUnit(winX, 6.65, 14.0, 1.32, 2.2, 'z+', true, 2, loggiaWoodMat);
    }
    // 2 cột tròn nhỏ ngăn cách 3 ô cửa vòm dưới dầm ngang
    for (const smColX of [-0.88, 0.88]) {
      buildFlutedCorinthianColumn(smColX, 5.55, 7.72, 14.18, 0.14, 0.12, 2);
    }

    // Thanh dầm ngang đắp nổi gờ chỉ trắng ngà tại y = 7.8
    addBox(6.8, 0.3, 0.72, ivoryStoneMat, 0, 7.8, 14.22, 2);
    addBox(6.9, 0.12, 0.82, ivoryStoneMat, 0, 7.96, 14.26, 2);

    // 3) Lòng vòm Tympanum phía trên dầm ngang (y từ 7.8 đến 11.2):
    //    Nền màu Đá Nâu Kem Cổ Điển (#b89f8d), bên trong đắp nổi 3 vòng hoa phù điêu tròn (medallions)
    //    bằng đá trắng ngà có viền vàng đồng mờ xếp theo cung vòm cực kỳ tinh xảo
    const tympShape = new THREE.Shape();
    tympShape.absarc(0, 0, 3.4, 0, Math.PI, false);
    tympShape.closePath();
    const tympGeo = new THREE.ExtrudeGeometry(tympShape, {
      depth: 0.24,
      bevelEnabled: false,
      curveSegments: 44,
    });
    const tympMesh = new THREE.Mesh(tympGeo, tympanumStoneMat);
    tympMesh.position.set(0, archCenterY, 13.95);
    addMesh(tympMesh, 2);

    // Vòng cung gờ đá trắng ngà mảnh trang trí bên trong lòng Tympanum
    const innerTympArc = new THREE.Mesh(
      new THREE.TorusGeometry(2.95, 0.06, 10, 36, Math.PI),
      ivoryStoneMat
    );
    innerTympArc.position.set(0, archCenterY, 14.2);
    addMesh(innerTympArc, 2);

    // Các gờ phân múi hướng tâm bằng đá trắng ngà trong lòng vòm Tympanum
    for (const radAng of [0.16, 0.36, 0.64, 0.84].map((v) => v * Math.PI)) {
      const rLen = 3.25;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, rLen, 0.08), ivoryStoneMat);
      rib.position.set(Math.cos(radAng) * (rLen / 2), archCenterY + Math.sin(radAng) * (rLen / 2), 14.2);
      rib.rotation.z = radAng - Math.PI / 2;
      addMesh(rib, 2);
    }

    // 3 vòng hoa phù điêu tròn (medallions) bằng đá trắng ngà có viền vàng đồng mờ xếp theo cung vòm
    const medallionConfigs = [
      { angle: Math.PI * 0.25, radius: 2.1, size: 0.46 },
      { angle: Math.PI * 0.5, radius: 2.15, size: 0.56 },
      { angle: Math.PI * 0.75, radius: 2.1, size: 0.46 },
    ];
    for (const med of medallionConfigs) {
      const mx = Math.cos(med.angle) * med.radius;
      const my = archCenterY + Math.sin(med.angle) * med.radius;

      // Đĩa nền đá trắng ngà đắp nổi
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(med.size, med.size * 1.06, 0.14, 24),
        ivoryStoneMat
      );
      disc.rotation.x = Math.PI / 2;
      disc.position.set(mx, my, 14.22);
      addMesh(disc, 2);

      // Viền vòng nguyệt quế vàng đồng mờ bao quanh medallion
      const goldRim = new THREE.Mesh(
        new THREE.TorusGeometry(med.size * 0.86, 0.055, 12, 24),
        bronzeGoldMat
      );
      goldRim.position.set(mx, my, 14.28);
      addMesh(goldRim, 2);

      // Hoa văn phù điêu nổi ở tâm mỗi medallion
      const centerBoss = new THREE.Mesh(
        new THREE.SphereGeometry(med.size * 0.42, 16, 14),
        ivoryStoneMat
      );
      centerBoss.scale.set(1, 1, 0.45);
      centerBoss.position.set(mx, my, 14.27);
      addMesh(centerBoss, 2);

      // Nơ ruy-băng đá trắng ngà trên đỉnh mỗi vòng hoa
      addBox(med.size * 0.7, 0.12, 0.1, ivoryStoneMat, mx, my + med.size + 0.06, 14.26, 2);
    }

    // Dải hoa văn dây lá (festoons) bằng đá trắng ngà nối giữa 3 medallions
    for (const side of [-1, 1]) {
      const garland = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.05, 8, 18, Math.PI * 0.85),
        ivoryStoneMat
      );
      garland.position.set(side * 0.95, archCenterY + 1.95, 14.24);
      garland.rotation.z = Math.PI * 1.08;
      addMesh(garland, 2);
    }

    // 4) Cụm Điêu Khắc Đỉnh Vòm (x = 0, y = 12.4, z = +15.0):
    //    Bệ đá cuộn Volutes ôm đỉnh vòm, chính giữa là huy hiệu Cartouche kèm đàn Lyre vàng đồng,
    //    hai bên là 2 Tượng Thiên Thần Đá Trắng Ngà có đôi cánh xếp lớp lông vũ xòe chữ V mềm mại
    const apexBaseY = 12.15;
    // Khối đá khóa vòm (keystone) và bệ đá cuộn Volutes ôm đỉnh vòm
    addBox(0.68, 0.72, 0.86, ivoryStoneMat, 0, 12.05, 15.05, 3);
    addBox(2.2, 0.36, 0.76, ivoryStoneMat, 0, apexBaseY, 15.0, 3);
    for (const side of [-1, 1]) {
      const voluteScroll = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.075, 10, 18, Math.PI * 1.35),
        ivoryStoneMat
      );
      voluteScroll.position.set(side * 1.05, apexBaseY - 0.06, 15.05);
      voluteScroll.rotation.z = side > 0 ? -0.4 : Math.PI + 0.4;
      addMesh(voluteScroll, 3);
    }

    // Chính giữa: Huy hiệu Cartouche đá trắng ngà kèm đàn Lyre vàng đồng
    const cartoucheShield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.38, 0.28, 20),
      ivoryStoneMat
    );
    cartoucheShield.rotation.x = Math.PI / 2;
    cartoucheShield.scale.set(0.95, 1, 1.25);
    cartoucheShield.position.set(0, 12.68, 15.02);
    addMesh(cartoucheShield, 3);

    const cartoucheCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.22, 0.22, 12),
      ivoryStoneMat
    );
    cartoucheCrown.position.set(0, 13.32, 15.02);
    addMesh(cartoucheCrown, 3);

    // Đàn Lyre vàng đồng nổi bật ở chính giữa Cartouche
    const lyreFrame = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.048, 10, 20, Math.PI * 1.35),
      bronzeGoldMat
    );
    lyreFrame.position.set(0, 12.72, 15.18);
    lyreFrame.rotation.z = Math.PI * 0.82;
    addMesh(lyreFrame, 3);
    addBox(0.34, 0.06, 0.08, bronzeGoldMat, 0, 12.94, 15.18, 3);
    for (const strX of [-0.06, 0, 0.06]) {
      addBox(0.018, 0.38, 0.04, bronzeGoldMat, strX, 12.72, 15.18, 3);
    }

    // Hai bên: 2 Tượng Thiên Thần Đá Trắng Ngà có đôi cánh xếp lớp lông vũ xòe chữ V mềm mại
    for (const side of [-1, 1]) {
      const ax = side * 0.78;
      // Thân tượng Thiên thần tựa bên huy hiệu Cartouche
      const lowerDrapery = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.22, 0.56, 14),
        ivoryStoneMat
      );
      lowerDrapery.position.set(ax + side * 0.08, 12.42, 15.0);
      lowerDrapery.rotation.z = -side * 0.28;
      addMesh(lowerDrapery, 3);

      const angelTorso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.13, 0.48, 14),
        ivoryStoneMat
      );
      angelTorso.position.set(ax, 12.82, 15.02);
      angelTorso.rotation.z = -side * 0.14;
      addMesh(angelTorso, 3);

      const angelHead = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 14), ivoryStoneMat);
      angelHead.position.set(ax - side * 0.04, 13.16, 15.05);
      addMesh(angelHead, 3);

      // Tay Thiên thần nâng vòng hoa hướng về đỉnh Cartouche
      const angelArm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.045, 0.46, 8),
        ivoryStoneMat
      );
      angelArm.position.set(ax - side * 0.24, 13.06, 15.08);
      angelArm.rotation.z = side * 0.65;
      addMesh(angelArm, 3);

      // Đôi cánh xếp lớp lông vũ xòe chữ V mềm mại (3 lớp lông vũ bậc thang tạo khối 3D dày dặn)
      const featherLayers = [
        { span: 0.92, height: 0.98, zOff: 14.92, thick: 0.09 },
        { span: 0.72, height: 0.76, zOff: 14.97, thick: 0.08 },
        { span: 0.52, height: 0.54, zOff: 15.01, thick: 0.07 },
      ];
      for (const fl of featherLayers) {
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.quadraticCurveTo(side * fl.span * 0.38, fl.height * 0.62, side * fl.span, fl.height);
        wingShape.quadraticCurveTo(side * fl.span * 0.72, fl.height * 0.35, side * fl.span * 0.22, -0.08);
        wingShape.closePath();

        const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
          depth: fl.thick,
          bevelEnabled: true,
          bevelThickness: 0.02,
          bevelSize: 0.015,
          curveSegments: 16,
        });
        const wingMesh = new THREE.Mesh(wingGeo, ivoryStoneMat);
        wingMesh.position.set(ax, 12.78, fl.zOff);
        addMesh(wingMesh, 3);
      }
    }

    // E. Hai Cánh Mặt Tiền (x từ ±4.4 đến ±10.0, z = +15.0):
    for (const side of [-1, 1]) {
      const wingBoxCenterX = side * 7.2;
      const wingWindowCenterX = side * 7.4;

      // Chân đế đá hoa cương từ y = 0.3 đến 2.0
      addBox(5.6, 1.7, 5.0, plinthGraniteMat, wingBoxCenterX, 1.15, 12.5, 1);
      addBox(1.1, 0.55, 0.16, ivoryStoneMat, wingWindowCenterX, 1.15, 15.02, 1);
      addBox(0.86, 0.38, 0.18, darkRecessMat, wingWindowCenterX, 1.15, 15.04, 1);

      // Tường đá kem hồng phấn trầm (#d8c3b4) từ y = 2.0 đến y = 9.2
      addBox(5.6, 7.2, 5.0, weatheredWallMat, wingBoxCenterX, 5.6, 12.5, 1);

      // Chính giữa mỗi cánh (x = ±7.4, y = 5.4, z = +15.05): 1 Ô Cửa Sổ Vòm Lớn có đố gỗ nâu & nan rẻ quạt
      buildArchedWindowUnit(wingWindowCenterX, 5.4, 15.05, 1.7, 3.8, 'z+', true, 2);
      // Lan can con tiện đá nhỏ ngay dưới bệ cửa sổ vòm lớn
      buildStoneBalustrade(wingWindowCenterX - 0.85, 15.18, wingWindowCenterX + 0.85, 15.18, 2.85, 0.56, 2);

      // Hai bên ô cửa là 2 cặp trụ cột vuông (pilasters) cao từ y = 2.0 đến 9.2
      for (const pOff of [-2.25, -1.55, 1.55, 2.25]) {
        const px = wingWindowCenterX + pOff;
        addBox(0.42, 7.2, 0.24, weatheredWallMat, px, 5.6, 15.06, 2);
        addBox(0.52, 0.34, 0.32, ivoryStoneMat, px, 8.95, 15.08, 2);
        addBox(0.5, 0.28, 0.3, ivoryStoneMat, px, 2.16, 15.08, 1);
      }

      // Đỉnh tường (y = 9.2 đến y = 10.0): Gờ phào ngang (cornice) và hàng lan can con tiện đá trắng (ivoryStoneMat)
      addBox(5.8, 0.38, 0.74, ivoryStoneMat, wingBoxCenterX, 9.35, 15.12, 2);
      buildStoneBalustrade(side * 4.3, 15.15, side * 10.0, 15.15, 9.52, 0.54, 2);

      // Gờ phào & lan can mặt bên của khối cánh mặt tiền
      addBox(0.74, 0.38, 5.2, ivoryStoneMat, side * 9.85, 9.35, 12.5, 2);
      buildStoneBalustrade(side * 9.9, 10.0, side * 9.9, 15.15, 9.52, 0.54, 2);
    }

    // =========================================================================
    // 4. HAI MẶT BÊN HÔNG (9 NHỊP, NHỊP THỨ 5 CHÍNH GIỮA TẠI Z = -3.5 CÓ GỜ MÁI
    //    UỐN VÒM BÁN NGUYỆT & CỬA KÍNH NAN HOA RẺ QUẠT ĐỒNG BỘ)
    // =========================================================================
    // 9 Nhịp đều nhau đối xứng quanh tâm z = -3.5 (nhịp thứ 5 nằm chính xác tại z = -3.5)
    const bayCentersZ = [8.5, 5.5, 2.5, -0.5, -3.5, -6.5, -9.5, -12.5, -15.5];
    const pilasterPositionsZ = [10.0, 7.0, 4.0, 1.0, -2.0, -5.0, -8.0, -11.0, -14.0, -17.0];

    for (const side of [-1, 1]) {
      const wallX = side * 8.2;
      const axis: 'x+' | 'x-' = side > 0 ? 'x+' : 'x-';

      // Cột bổ trụ (pilasters) ngăn cách 9 nhịp
      for (const pz of pilasterPositionsZ) {
        addBox(0.32, 7.2, 0.56, weatheredWallMat, wallX + side * 0.08, 5.6, pz, 2);
        addBox(0.42, 0.34, 0.68, ivoryStoneMat, wallX + side * 0.1, 8.95, pz, 2);
        addBox(0.4, 0.28, 0.64, ivoryStoneMat, wallX + side * 0.09, 2.18, pz, 1);
      }

      // Cấu trúc từng nhịp trong 9 nhịp bên hông
      for (let bIdx = 0; bIdx < bayCentersZ.length; bIdx++) {
        const bz = bayCentersZ[bIdx];
        const isCenterFifthBay = bIdx === 4; // Nhịp thứ 5 tại chính giữa (z = -3.5)

        // Tầng 1: Cửa sổ chữ nhật có viền đá trắng ngà & khung đố gỗ nâu chia ô
        buildRectWindowUnit(wallX, 3.4, bz, 1.3, 2.0, axis, 1);

        // Tầng 2: Cửa sổ vòm có viền đá trắng ngà, đố gỗ nâu & nan vòm rẻ quạt (fanlight)
        buildArchedWindowUnit(wallX, 6.5, bz, 1.42, 2.85, axis, true, 2);

        if (isCenterFifthBay) {
          // Tại nhịp thứ 5 ở chính giữa hai bên hông (x = ±8.2, z = -3.5):
          // Trán vòm bán nguyệt nhô lên trên gờ mái có hốc kính bán nguyệt tối màu (#263238 / windowPaneMat),
          // nan gỗ rẻ quạt (fanlight) nổi khối phía ngoài và phần mái cong phía trên lợp ngói xanh xám (blueSlateRoofMat)
          const sideArchCenterY = 9.25;
          const sideArchRadius = 1.24;

          // 1) Khối vòm đệm phía sau (hình bán nguyệt, lùi sâu vào trong từ wallX - side*1.10 đến wallX + side*0.12, tuyệt đối không che mặt kính)
          const backDrumShape = new THREE.Shape();
          backDrumShape.absarc(0, 0, sideArchRadius + 0.16, 0, Math.PI, false);
          backDrumShape.closePath();
          const backDrumDepth = 1.22;
          const backDrumGeo = new THREE.ExtrudeGeometry(backDrumShape, {
            depth: backDrumDepth,
            bevelEnabled: false,
            curveSegments: 28,
          });
          backDrumGeo.translate(0, 0, -backDrumDepth / 2);
          const backDrumMesh = new THREE.Mesh(backDrumGeo, ivoryStoneMat);
          backDrumMesh.rotation.y = Math.PI / 2;
          backDrumMesh.position.set(wallX - side * 0.49, sideArchCenterY, bz);
          addMesh(backDrumMesh, 2);

          // 2) Phần mái cong lợp ngói đá phiến xanh xám (blueSlateRoofMat) chụp lên lưng vòm bán nguyệt và ăn sâu vào mái Mansard
          const roofVaultShape = new THREE.Shape();
          roofVaultShape.absarc(0, 0, sideArchRadius + 0.42, 0, Math.PI, false);
          roofVaultShape.absarc(0, 0, sideArchRadius + 0.24, Math.PI, 0, true);
          roofVaultShape.closePath();
          const roofVaultDepth = 1.68;
          const roofVaultGeo = new THREE.ExtrudeGeometry(roofVaultShape, {
            depth: roofVaultDepth,
            bevelEnabled: false,
            curveSegments: 32,
          });
          roofVaultGeo.translate(0, 0, -roofVaultDepth / 2);
          const roofVaultMesh = new THREE.Mesh(roofVaultGeo, blueSlateRoofMat);
          roofVaultMesh.rotation.y = Math.PI / 2;
          roofVaultMesh.position.set(wallX - side * 0.38, sideArchCenterY, bz);
          addMesh(roofVaultMesh, 3);

          // 3) Vành gờ phào đá trắng ngà (ivoryStoneMat) uốn vòm bán nguyệt bao quanh mặt trước vòm hông
          const sideArchShape = new THREE.Shape();
          sideArchShape.absarc(0, 0, sideArchRadius + 0.28, 0, Math.PI, false);
          sideArchShape.absarc(0, 0, sideArchRadius, Math.PI, 0, true);
          sideArchShape.closePath();
          const sideArchGeo = new THREE.ExtrudeGeometry(sideArchShape, {
            depth: 0.32,
            bevelEnabled: false,
            curveSegments: 28,
          });
          sideArchGeo.translate(0, 0, -0.16);
          const sideArchMesh = new THREE.Mesh(sideArchGeo, ivoryStoneMat);
          sideArchMesh.rotation.y = Math.PI / 2;
          sideArchMesh.position.set(wallX + side * 0.28, sideArchCenterY, bz);
          addMesh(sideArchMesh, 2);

          // Đá khóa vòm (keystone) trên đỉnh gờ vòm hông
          addBox(
            0.38,
            0.34,
            0.26,
            ivoryStoneMat,
            wallX + side * 0.32,
            sideArchCenterY + sideArchRadius + 0.2,
            bz,
            2
          );

          // 4) Tấm kính bán nguyệt tối màu (windowPaneMat / #263238) nằm nổi phía trước tường đệm (tại wallX + side * 0.19)
          const fanGlassShape = new THREE.Shape();
          fanGlassShape.absarc(0, 0, sideArchRadius + 0.02, 0, Math.PI, false);
          fanGlassShape.closePath();
          const fanGlassGeo = new THREE.ExtrudeGeometry(fanGlassShape, {
            depth: 0.08,
            bevelEnabled: false,
            curveSegments: 28,
          });
          fanGlassGeo.translate(0, 0, -0.04);
          const fanGlassMesh = new THREE.Mesh(fanGlassGeo, windowPaneMat);
          fanGlassMesh.rotation.y = Math.PI / 2;
          fanGlassMesh.position.set(wallX + side * 0.19, sideArchCenterY, bz);
          addMesh(fanGlassMesh, 2);

          // 5) Khung gỗ ngang đáy vòm + vòng cung gỗ đồng tâm + các nan gỗ rẻ quạt nổi khối (tại wallX + side * 0.26, phía ngoài mặt kính)
          const fanOutX = wallX + side * 0.26;
          addBox(0.08, 0.08, sideArchRadius * 2.02, woodFrameMat, fanOutX, sideArchCenterY + 0.04, bz, 2);

          const outerWoodArc = new THREE.Mesh(
            new THREE.TorusGeometry(sideArchRadius - 0.03, 0.038, 10, 24, Math.PI),
            woodFrameMat
          );
          outerWoodArc.rotation.y = Math.PI / 2;
          outerWoodArc.position.set(fanOutX, sideArchCenterY, bz);
          addMesh(outerWoodArc, 2);

          const innerRing = new THREE.Mesh(
            new THREE.TorusGeometry(sideArchRadius * 0.54, 0.032, 10, 20, Math.PI),
            woodFrameMat
          );
          innerRing.rotation.y = Math.PI / 2;
          innerRing.position.set(fanOutX, sideArchCenterY, bz);
          addMesh(innerRing, 2);

          for (const fAng of [0.18, 0.34, 0.5, 0.66, 0.82].map((v) => v * Math.PI)) {
            const rLen = sideArchRadius * 0.96;
            const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.08, rLen, 0.045), woodFrameMat);
            spoke.position.set(
              fanOutX,
              sideArchCenterY + Math.sin(fAng) * (rLen / 2),
              bz + Math.cos(fAng) * (rLen / 2)
            );
            spoke.rotation.x = -(fAng - Math.PI / 2);
            addMesh(spoke, 2);
          }
        } else {
          // Ô phào chữ nhật đắp nổi phía trên cửa sổ vòm ở các nhịp thường
          addBox(0.18, 0.42, 1.5, ivoryStoneMat, wallX + side * 0.08, 8.38, bz, 2);
        }
      }

      // Đỉnh tường (y từ 9.2 đến 10.0): Gờ phào cornice và lan can con tiện đá trắng (chừa nhịp 5 để uốn vòm bán nguyệt)
      addBox(0.75, 0.36, 11.8, ivoryStoneMat, wallX + side * 0.15, 9.35, 4.1, 2);
      addBox(0.75, 0.36, 11.8, ivoryStoneMat, wallX + side * 0.15, 9.35, -11.1, 2);
      buildStoneBalustrade(wallX + side * 0.2, 9.8, wallX + side * 0.2, -1.8, 9.52, 0.52, 2);
      buildStoneBalustrade(wallX + side * 0.2, -5.2, wallX + side * 0.2, -17.3, 9.52, 0.52, 2);

      // Hành Lang Đá Bên Hông (Side Stone Terrace) dưới chân 5 nhịp giữa (từ z = -11.0 đến z = +4.0)
      const terraceCenterX = side * 9.1;
      addBox(1.8, 1.7, 15.0, plinthGraniteMat, terraceCenterX, 1.15, -3.5, 1);
      addBox(1.92, 0.16, 15.16, ivoryStoneMat, terraceCenterX, 2.02, -3.5, 1);

      const outerEdgeX = side * 9.9;
      buildStoneBalustrade(outerEdgeX, -10.9, outerEdgeX, 3.9, 2.08, 0.72, 1);
      buildStoneBalustrade(side * 8.3, 3.9, outerEdgeX, 3.9, 2.08, 0.72, 1);
      buildStoneBalustrade(side * 8.3, -10.9, outerEdgeX, -10.9, 2.08, 0.72, 1);
    }

    // =========================================================================
    // 5. MẶT SAU PHẲNG NGANG (REAR FACADE — TẠI Z = -17.5, X TỪ -8.2 ĐẾN +8.2)
    // =========================================================================
    const rearWallZ = -17.5;
    addBox(16.8, 0.36, 0.75, ivoryStoneMat, 0, 9.35, rearWallZ - 0.15, 2);
    buildStoneBalustrade(-8.2, rearWallZ - 0.2, 8.2, rearWallZ - 0.2, 9.52, 0.52, 2);

    // 4 nhịp trung tâm mặt sau
    const rearCentralPilastersX = [-4.4, -2.2, 0, 2.2, 4.4];
    for (const rpx of rearCentralPilastersX) {
      addBox(0.45, 7.2, 0.28, weatheredWallMat, rpx, 5.6, rearWallZ - 0.08, 2);
      addBox(0.55, 0.32, 0.36, ivoryStoneMat, rpx, 8.95, rearWallZ - 0.1, 2);
    }

    const rearFourBaysX = [-3.3, -1.1, 1.1, 3.3];
    for (const rbx of rearFourBaysX) {
      buildArchedWindowUnit(rbx, 6.5, rearWallZ, 1.25, 2.7, 'z-', true, 2);
      buildRectWindowUnit(rbx, 3.4, rearWallZ, 1.15, 1.9, 'z-', 1);
    }

    // =========================================================================
    // HỐC LÕM SẢNH HẬU ĐÀI Ở CHÂN ĐẾ MẶT SAU (-Z):
    // Tại phần chân đế đá nâu xám (plinthGraniteMat) ngay bên dưới 4 ô cửa giữa của mặt sau
    // (x từ -4.2 đến +4.2, y từ 0.3 đến 2.0), tường chân đế thụt lùi vào trong 0.6 đơn vị (tại z = -16.9).
    // Đặt 3 trụ đá đỡ thẳng hàng với 3 cột trụ phía trên (tại x = -2.2, 0, +2.2) để tạo chiều sâu kiến trúc.
    // =========================================================================
    // Cửa hậu đài chính bằng gỗ sẫm (#4a2e1b) và ô kính tối trong hốc lõm tại z = -16.85
    addBox(1.5, 1.5, 0.12, grandDoorWoodMat, 0, 1.05, -16.85, 1);
    addBox(1.15, 0.55, 0.14, glassDarkMat, 0, 1.35, -16.84, 1);
    addBox(1.7, 0.12, 0.16, ivoryStoneMat, 0, 1.84, -16.84, 1);

    // Cửa phụ hậu đài 2 bên trong hốc lõm
    addBox(1.1, 1.4, 0.1, grandDoorWoodMat, -2.2, 1.0, -16.86, 1);
    addBox(1.1, 1.4, 0.1, grandDoorWoodMat, 2.2, 1.0, -16.86, 1);

    // Dầm đỡ trần hốc sảnh bằng đá trắng ngà tại y = 2.0 (nối ngang từ x = -4.2 đến +4.2, z = -17.2)
    addBox(8.4, 0.22, 0.65, ivoryStoneMat, 0, 1.95, -17.2, 1);
    addBox(8.6, 0.12, 0.75, ivoryStoneMat, 0, 2.05, -17.2, 1);

    // 3 Trụ Đá Đỡ thẳng hàng với 3 cột trụ phía trên (x = -2.2, 0, +2.2) tại mặt trước hốc (z = -17.2)
    for (const pierX of [-2.2, 0, 2.2]) {
      // Thân trụ đá hoa cương
      addBox(0.68, 1.64, 0.58, plinthGraniteMat, pierX, 1.15, -17.2, 1);
      // Bệ chân cột và đầu mũ cột bằng đá trắng ngà
      addBox(0.78, 0.14, 0.68, ivoryStoneMat, pierX, 0.38, -17.2, 1);
      addBox(0.78, 0.16, 0.68, ivoryStoneMat, pierX, 1.92, -17.2, 1);
    }

    // Gờ phào đá trắng ngà chạy ngang trên chân đế của 2 cánh góc mặt sau (x = ±6.2)
    addBox(4.1, 0.16, 0.72, ivoryStoneMat, -6.2, 2.02, -17.2, 1);
    addBox(4.1, 0.16, 0.72, ivoryStoneMat, 6.2, 2.02, -17.2, 1);

    // Hai nhịp góc mặt sau (mỗi bên có 1 Cửa Sổ Vòm Lớn có khung đố gỗ & nan rẻ quạt)
    for (const side of [-1, 1]) {
      const cornerCenterX = side * 6.3;
      buildArchedWindowUnit(cornerCenterX, 5.0, rearWallZ, 1.6, 3.8, 'z-', true, 2);

      addBox(2.4, 0.18, 0.22, ivoryStoneMat, cornerCenterX, 7.35, rearWallZ - 0.08, 2);
      addBox(2.4, 0.18, 0.22, ivoryStoneMat, cornerCenterX, 2.85, rearWallZ - 0.08, 2);
      addBox(0.18, 4.6, 0.2, ivoryStoneMat, cornerCenterX - 1.15, 5.1, rearWallZ - 0.08, 2);
      addBox(0.18, 4.6, 0.2, ivoryStoneMat, cornerCenterX + 1.15, 5.1, rearWallZ - 0.08, 2);

      for (const cpX of [side * 7.55, side * 8.0]) {
        addBox(0.36, 7.2, 0.28, weatheredWallMat, cpX, 5.6, rearWallZ - 0.08, 2);
        addBox(0.44, 0.32, 0.36, ivoryStoneMat, cpX, 8.95, rearWallZ - 0.1, 2);
      }
    }

    // =========================================================================
    // 6. HỆ MÁI MANSARD HÌNH CHÓP CỤT CHỮ NHẬT (createRectangularMansard)
    //    & CỬA SỔ MÁI NHỎ (DORMERS) GẮN SÁT MẶT NGÓI NGHIÊNG
    // =========================================================================
    // 1) Mái Mansard Thân Chính:
    // Đặt tại (0, 10.0, -3.5), bottomW = 16.0, bottomD = 27.0, topW = 10.6, topD = 21.6, height = 3.0
    createRectangularMansard(
      16.0,
      27.0,
      10.6,
      21.6,
      3.0,
      blueSlateRoofMat,
      flatRoofTopMat,
      0,
      10.0,
      -3.5,
      3
    );

    // Khối mái Mansard chữ nhật nối từ sau Vòm Cuốn Lớn (z = +10.0 đến +13.8) vào Mái Thân Chính
    createRectangularMansard(
      8.4,
      4.0,
      5.8,
      2.8,
      2.1,
      blueSlateRoofMat,
      flatRoofTopMat,
      0,
      10.0,
      11.8,
      3
    );

    // 2) Hai Mái Mansard Ở 2 Cánh Mặt Tiền:
    // Đặt tại (±7.4, 10.0, +12.5), bottomW = 5.0, bottomD = 4.8, topW = 3.2, topD = 3.0, height = 1.6
    for (const side of [-1, 1]) {
      createRectangularMansard(
        5.0,
        4.8,
        3.2,
        3.0,
        1.6,
        blueSlateRoofMat,
        flatRoofTopMat,
        side * 7.4,
        10.0,
        12.5,
        3
      );
    }

    // 3) Các ô cửa sổ mái nhỏ (dormers) có khung viền đá xám thanh mảnh gắn sát vào mặt ngói nghiêng (không bị bay lơ lửng):
    // Mặt nghiêng bên hông của mái chính đi từ x = ±8.0 (tại y = 10.0) vào x = ±5.3 (tại y = 13.0).
    // Tại độ cao chân dormer y = 10.75 (t = 0.25), mặt ngói nằm tại x = ±7.325; thân dormer ăn sâu vào trong mái để gắn khít 100%.
    // 3) Các ô cửa sổ mái nhỏ (dormers) có khung viền đá xám sẫm (#3a444e) gắn sát mặt ngói:
    // Căn chỉnh đối xứng trục giữa 100%, quay trực diện ra ngoài (+X, -X, -Z), không bị xoay lệch
    const buildFlushRoofDormer = (
      faceX: number,
      baseY: number,
      faceZ: number,
      facing: 'x+' | 'x-' | 'z-'
    ) => {
      const isSide = facing === 'x+' || facing === 'x-';
      const dir = facing === 'x+' ? 1 : (facing === 'x-' ? -1 : 1);
      const width = 0.68;
      const rectH = 0.54;
      const archR = width / 2; // 0.34
      const depth = 1.25;

      // 1. Khối vòm ngói đá phiến trên nóc dormer (blueSlateRoofMat)
      const vaultShape = new THREE.Shape();
      vaultShape.moveTo(-archR, 0);
      vaultShape.lineTo(archR, 0);
      vaultShape.absarc(0, 0, archR, 0, Math.PI, false);
      vaultShape.closePath();

      const vaultGeo = new THREE.ExtrudeGeometry(vaultShape, {
        depth,
        bevelEnabled: false,
        curveSegments: 16,
      });

      // Viền đá vòm cung mặt trước bằng đá xám sẫm (dormerFrameStoneMat: #3a444e)
      const archMouldingShape = new THREE.Shape();
      archMouldingShape.absarc(0, 0, archR + 0.06, 0, Math.PI, false);
      archMouldingShape.absarc(0, 0, archR - 0.04, Math.PI, 0, true);
      archMouldingShape.closePath();
      const archMouldingGeo = new THREE.ExtrudeGeometry(archMouldingShape, {
        depth: 0.08,
        bevelEnabled: false,
        curveSegments: 16,
      });

      if (isSide) {
        // DORMER HÔNG (Quay trực diện ra ngoài: x+ hướng về +X, x- hướng về -X)
        // Tâm đối xứng hoàn hảo dọc theo trục Z tại faceZ
        addBox(depth, rectH, width, blueSlateRoofMat, faceX - dir * (depth / 2), baseY + rectH / 2, faceZ, 3);

        const vaultMesh = new THREE.Mesh(vaultGeo, blueSlateRoofMat);
        const mouldingMesh = new THREE.Mesh(archMouldingGeo, dormerFrameStoneMat);

        if (facing === 'x+') {
          vaultMesh.rotation.y = -Math.PI / 2;
          vaultMesh.position.set(faceX, baseY + rectH, faceZ);

          mouldingMesh.rotation.y = -Math.PI / 2;
          mouldingMesh.position.set(faceX + 0.04, baseY + rectH, faceZ);
        } else {
          vaultMesh.rotation.y = Math.PI / 2;
          vaultMesh.position.set(faceX, baseY + rectH, faceZ);

          mouldingMesh.rotation.y = Math.PI / 2;
          mouldingMesh.position.set(faceX - 0.04, baseY + rectH, faceZ);
        }
        addMesh(vaultMesh, 3);
        addMesh(mouldingMesh, 3);

        // Khung viền đá xám sẫm (#3a444e) đối xứng tuyệt đối quanh faceZ
        addBox(0.08, 0.08, width + 0.12, dormerFrameStoneMat, faceX + dir * 0.02, baseY + 0.04, faceZ, 3);
        addBox(0.08, rectH, 0.08, dormerFrameStoneMat, faceX + dir * 0.02, baseY + rectH / 2, faceZ - archR + 0.04, 3);
        addBox(0.08, rectH, 0.08, dormerFrameStoneMat, faceX + dir * 0.02, baseY + rectH / 2, faceZ + archR - 0.04, 3);

        // Mặt kính tối (#263238)
        addBox(0.04, rectH * 0.88, width - 0.14, glassDarkMat, faceX - dir * 0.02, baseY + rectH * 0.48, faceZ, 3);
        const glassArchShape = new THREE.Shape();
        glassArchShape.absarc(0, 0, archR - 0.06, 0, Math.PI, false);
        glassArchShape.closePath();
        const glassArchMesh = new THREE.Mesh(new THREE.ShapeGeometry(glassArchShape, 14), glassDarkMat);
        glassArchMesh.rotation.y = facing === 'x+' ? Math.PI / 2 : -Math.PI / 2;
        glassArchMesh.position.set(faceX - dir * 0.02, baseY + rectH, faceZ);
        addMesh(glassArchMesh, 3);

        // Nan đố gỗ chữ thập (#5d4037)
        addBox(0.06, rectH + archR * 0.72, 0.035, woodFrameMat, faceX, baseY + (rectH + archR * 0.72) / 2, faceZ, 3);
        addBox(0.06, 0.035, width - 0.16, woodFrameMat, faceX, baseY + rectH * 0.55, faceZ, 3);

      } else {
        // DORMER MẶT SAU (Quay trực diện ra ngoài: hướng về -Z)
        // Tâm đối xứng hoàn hảo dọc theo trục X tại faceX
        addBox(width, rectH, depth, blueSlateRoofMat, faceX, baseY + rectH / 2, faceZ + depth / 2, 3);

        const vaultMesh = new THREE.Mesh(vaultGeo, blueSlateRoofMat);
        vaultMesh.position.set(faceX, baseY + rectH, faceZ);
        addMesh(vaultMesh, 3);

        const mouldingMesh = new THREE.Mesh(archMouldingGeo, dormerFrameStoneMat);
        mouldingMesh.position.set(faceX, baseY + rectH, faceZ - 0.04);
        addMesh(mouldingMesh, 3);

        // Khung viền đá xám sẫm (#3a444e) đối xứng tuyệt đối quanh faceX
        addBox(width + 0.12, 0.08, 0.08, dormerFrameStoneMat, faceX, baseY + 0.04, faceZ - 0.02, 3);
        addBox(0.08, rectH, 0.08, dormerFrameStoneMat, faceX - archR + 0.04, baseY + rectH / 2, faceZ - 0.02, 3);
        addBox(0.08, rectH, 0.08, dormerFrameStoneMat, faceX + archR - 0.04, baseY + rectH / 2, faceZ - 0.02, 3);

        // Mặt kính tối (#263238)
        addBox(width - 0.14, rectH * 0.88, 0.04, glassDarkMat, faceX, baseY + rectH * 0.48, faceZ + 0.02, 3);
        const glassArchShape = new THREE.Shape();
        glassArchShape.absarc(0, 0, archR - 0.06, 0, Math.PI, false);
        glassArchShape.closePath();
        const glassArchMesh = new THREE.Mesh(new THREE.ShapeGeometry(glassArchShape, 14), glassDarkMat);
        glassArchMesh.rotation.y = Math.PI;
        glassArchMesh.position.set(faceX, baseY + rectH, faceZ + 0.02);
        addMesh(glassArchMesh, 3);

        // Nan đố gỗ chữ thập (#5d4037)
        addBox(0.035, rectH + archR * 0.72, 0.06, woodFrameMat, faceX, baseY + (rectH + archR * 0.72) / 2, faceZ, 3);
        addBox(width - 0.16, 0.035, 0.06, woodFrameMat, faceX, baseY + rectH * 0.55, faceZ, 3);
      }
    };

    // Đặt dormers dọc hai mặt nghiêng bên hông (tránh nhịp giữa z = -3.5 nơi có vòm bán nguyệt)
    const sideDormerPositionsZ = [8.5, 5.5, 2.5, -0.5, -6.5, -9.5, -12.5];
    for (const side of [-1, 1]) {
      const facing: 'x+' | 'x-' = side > 0 ? 'x+' : 'x-';
      const slopeSurfaceX = side * 7.42;
      for (const dz of sideDormerPositionsZ) {
        buildFlushRoofDormer(slopeSurfaceX, 10.65, dz, facing);
      }
    }

    // Đặt dormers trên mặt nghiêng phía sau (-Z)
    for (const rdx of [-3.3, -1.1, 1.1, 3.3]) {
      buildFlushRoofDormer(rdx, 10.65, -16.42, 'z-');
    }

    return null;


  } else if (siteId === 'HCM-DT-003') {
    // =========================================================================
    // BƯU ĐIỆN TRUNG TÂM SÀI GÒN (CENTRAL POST OFFICE — 1886–1891)
    // Hệ vật liệu PBR chân thực (Micro-bump, RoughnessMap, Rêu phong & Bụi thời gian)
    // Kết hợp Đổ bóng mềm 2048px & Ambient Occlusion (AO) tại các khe kẽ kiến trúc
    // =========================================================================

    // Hàm tạo PBR Texture (Albedo Map + Bump Map + Roughness Map) cho các bề mặt kiến trúc cổ
    const createPostPBRSurface = (
      mode: 'stucco_yellow' | 'roof_tile' | 'cream_stone' | 'base_stone' | 'wood_shutter' | 'courtyard_brick' | 'grey_paver'
    ) => {
      const size = 256;
      const colorCanvas = document.createElement('canvas');
      colorCanvas.width = size;
      colorCanvas.height = size;
      const cCtx = colorCanvas.getContext('2d')!;

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d')!;

      const roughCanvas = document.createElement('canvas');
      roughCanvas.width = size;
      roughCanvas.height = size;
      const rCtx = roughCanvas.getContext('2d')!;

      // Seeded deterministic pseudo-random for consistent natural grain
      let seed = mode.length * 1337;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };

      if (mode === 'stucco_yellow') {
        // Tường vàng Pháp (#E8C574) với hạt vữa xi măng cũ và vệt ố thời gian ở chân/mép trên
        cCtx.fillStyle = '#E8C574';
        cCtx.fillRect(0, 0, size, size);
        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, size, size);
        rCtx.fillStyle = '#d8d8d8';
        rCtx.fillRect(0, 0, size, size);

        // Vệt loang bụi mờ và rêu phong nhẹ ở mép trên (dưới diềm mái) và mép dưới (sát chân tường)
        const topGrad = cCtx.createLinearGradient(0, 0, 0, size);
        topGrad.addColorStop(0, 'rgba(72, 58, 38, 0.24)');
        topGrad.addColorStop(0.14, 'rgba(90, 72, 45, 0.06)');
        topGrad.addColorStop(0.82, 'rgba(90, 72, 45, 0.04)');
        topGrad.addColorStop(1, 'rgba(62, 50, 34, 0.28)');
        cCtx.fillStyle = topGrad;
        cCtx.fillRect(0, 0, size, size);

        // Hạt gai vôi vữa tự nhiên (micro-stucco grain)
        for (let i = 0; i < 4200; i++) {
          const x = rand() * size;
          const y = rand() * size;
          const v = Math.floor(110 + rand() * 65);
          bCtx.fillStyle = `rgb(${v},${v},${v})`;
          bCtx.fillRect(x, y, 2, 2);

          const rv = Math.floor(195 + rand() * 55);
          rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
          rCtx.fillRect(x, y, 3, 3);

          if (i % 3 === 0) {
            cCtx.fillStyle = rand() > 0.5 ? 'rgba(120, 92, 48, 0.045)' : 'rgba(255, 248, 225, 0.04)';
            cCtx.fillRect(x, y, 3, 3);
          }
        }
      } else if (mode === 'roof_tile') {
        // Mái ngói đỏ cam (#D15B36) có sóng ngói dọc, độ lì 0.9 và vệt rêu phong nhẹ
        cCtx.fillStyle = '#D15B36';
        cCtx.fillRect(0, 0, size, size);
        bCtx.fillStyle = '#787878';
        bCtx.fillRect(0, 0, size, size);
        rCtx.fillStyle = '#e6e6e6';
        rCtx.fillRect(0, 0, size, size);

        // Sóng ngói âm dương / ngói vảy cá Pháp cổ
        const cols = 16;
        const rows = 12;
        const cw = size / cols;
        const rh = size / rows;
        for (let x = 0; x < cols; x++) {
          // Rãnh dọc sóng ngói
          cCtx.fillStyle = 'rgba(65, 24, 14, 0.22)';
          cCtx.fillRect(x * cw, 0, 2.5, size);
          cCtx.fillStyle = 'rgba(245, 145, 110, 0.12)';
          cCtx.fillRect(x * cw + 3, 0, cw * 0.45, size);

          bCtx.fillStyle = '#383838';
          bCtx.fillRect(x * cw, 0, 3, size);
          bCtx.fillStyle = '#c8c8c8';
          bCtx.fillRect(x * cw + 4, 0, cw * 0.5, size);
        }
        for (let y = 0; y < rows; y++) {
          cCtx.fillStyle = 'rgba(48, 20, 12, 0.26)';
          cCtx.fillRect(0, y * rh, size, 2);
          bCtx.fillStyle = '#2d2d2d';
          bCtx.fillRect(0, y * rh, size, 2.5);
        }
        // Vệt rêu phong / bụi mờ tự nhiên trên mái ngói cổ
        for (let i = 0; i < 650; i++) {
          const mx = rand() * size;
          const my = rand() * size;
          cCtx.fillStyle = rand() > 0.4 ? 'rgba(58, 68, 42, 0.08)' : 'rgba(80, 32, 18, 0.07)';
          cCtx.fillRect(mx, my, 6 + rand() * 8, 4 + rand() * 6);
        }
      } else if (mode === 'cream_stone') {
        // Phào chỉ, cột trắng kem (#F7F4EB) có độ lì của đá vôi (roughness 0.8)
        cCtx.fillStyle = '#F7F4EB';
        cCtx.fillRect(0, 0, size, size);
        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, size, size);
        rCtx.fillStyle = '#cccccc';
        rCtx.fillRect(0, 0, size, size);

        for (let i = 0; i < 2600; i++) {
          const x = rand() * size;
          const y = rand() * size;
          const v = Math.floor(116 + rand() * 40);
          bCtx.fillStyle = `rgb(${v},${v},${v})`;
          bCtx.fillRect(x, y, 2, 2);
          cCtx.fillStyle = rand() > 0.5 ? 'rgba(150, 138, 115, 0.04)' : 'rgba(255, 255, 255, 0.04)';
          cCtx.fillRect(x, y, 3, 2);
        }
      } else if (mode === 'base_stone') {
        // Đá nâu xám ốp chân tường (#7A6348) có mạch đá và vết rêu ẩm sát đất
        cCtx.fillStyle = '#7A6348';
        cCtx.fillRect(0, 0, size, size);
        bCtx.fillStyle = '#787878';
        bCtx.fillRect(0, 0, size, size);
        rCtx.fillStyle = '#dcdcdc';
        rCtx.fillRect(0, 0, size, size);

        const bottomMoisture = cCtx.createLinearGradient(0, 0, 0, size);
        bottomMoisture.addColorStop(0, 'rgba(40, 32, 22, 0.18)');
        bottomMoisture.addColorStop(0.65, 'rgba(0, 0, 0, 0)');
        bottomMoisture.addColorStop(1, 'rgba(28, 36, 24, 0.42)');
        cCtx.fillStyle = bottomMoisture;
        cCtx.fillRect(0, 0, size, size);

        for (let r = 0; r < 6; r++) {
          const y = (r * size) / 6;
          cCtx.fillStyle = 'rgba(38, 30, 22, 0.32)';
          cCtx.fillRect(0, y, size, 2.5);
          bCtx.fillStyle = '#303030';
          bCtx.fillRect(0, y, size, 3);
        }
        for (let i = 0; i < 3200; i++) {
          const x = rand() * size;
          const y = rand() * size;
          const v = Math.floor(95 + rand() * 75);
          bCtx.fillStyle = `rgb(${v},${v},${v})`;
          bCtx.fillRect(x, y, 2.5, 2.5);
        }
      } else if (mode === 'wood_shutter') {
        // Gỗ sơn xanh lá đậm (#184D38) với nan chớp lá sách ngang
        cCtx.fillStyle = '#184D38';
        cCtx.fillRect(0, 0, size, size);
        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, size, size);
        rCtx.fillStyle = '#808080';
        rCtx.fillRect(0, 0, size, size);

        for (let y = 0; y < size; y += 8) {
          cCtx.fillStyle = 'rgba(8, 28, 19, 0.38)';
          cCtx.fillRect(0, y, size, 2.5);
          cCtx.fillStyle = 'rgba(60, 125, 95, 0.14)';
          cCtx.fillRect(0, y + 3, size, 2);
          bCtx.fillStyle = '#353535';
          bCtx.fillRect(0, y, size, 3);
          bCtx.fillStyle = '#c2c2c2';
          bCtx.fillRect(0, y + 3, size, 3);
        }
      } else if (mode === 'courtyard_brick') {
        // Sân gạch đỏ cam nhám (roughness 0.95) có mạch gạch và bụi bặm tự nhiên
        cCtx.fillStyle = '#B8543B';
        cCtx.fillRect(0, 0, size, size);
        bCtx.fillStyle = '#7c7c7c';
        bCtx.fillRect(0, 0, size, size);
        rCtx.fillStyle = '#f2f2f2';
        rCtx.fillRect(0, 0, size, size);

        const rows = 16;
        const cols = 8;
        const rh = size / rows;
        const cw = size / cols;
        for (let r = 0; r < rows; r++) {
          const y = r * rh;
          cCtx.fillStyle = 'rgba(55, 38, 30, 0.35)';
          cCtx.fillRect(0, y, size, 2);
          bCtx.fillStyle = '#383838';
          bCtx.fillRect(0, y, size, 2);
          const offset = (r % 2) * (cw / 2);
          for (let c = 0; c <= cols; c++) {
            const x = (c * cw + offset) % size;
            cCtx.fillRect(x, y, 2, rh);
            bCtx.fillRect(x, y, 2, rh);
          }
        }
        // Lớp bụi mờ tự nhiên trên mặt sân gạch
        for (let i = 0; i < 3500; i++) {
          const x = rand() * size;
          const y = rand() * size;
          cCtx.fillStyle = rand() > 0.45 ? 'rgba(92, 78, 64, 0.08)' : 'rgba(215, 165, 130, 0.05)';
          cCtx.fillRect(x, y, 3, 3);
          const v = Math.floor(100 + rand() * 65);
          bCtx.fillStyle = `rgb(${v},${v},${v})`;
          bCtx.fillRect(x, y, 2, 2);
        }
      } else {
        // Đá xám lát lối đi & bậc tam cấp (roughness 0.95)
        cCtx.fillStyle = '#8B96A5';
        cCtx.fillRect(0, 0, size, size);
        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, size, size);
        rCtx.fillStyle = '#f2f2f2';
        rCtx.fillRect(0, 0, size, size);

        for (let r = 0; r < 8; r++) {
          const y = (r * size) / 8;
          cCtx.fillStyle = 'rgba(45, 52, 62, 0.28)';
          cCtx.fillRect(0, y, size, 2);
          bCtx.fillStyle = '#404040';
          bCtx.fillRect(0, y, size, 2);
        }
        for (let i = 0; i < 3200; i++) {
          const x = rand() * size;
          const y = rand() * size;
          cCtx.fillStyle = rand() > 0.5 ? 'rgba(60, 68, 76, 0.07)' : 'rgba(225, 230, 235, 0.05)';
          cCtx.fillRect(x, y, 3, 3);
          const v = Math.floor(105 + rand() * 60);
          bCtx.fillStyle = `rgb(${v},${v},${v})`;
          bCtx.fillRect(x, y, 2, 2);
        }
      }

      const map = new THREE.CanvasTexture(colorCanvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.colorSpace = THREE.SRGBColorSpace;

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;

      const roughnessMap = new THREE.CanvasTexture(roughCanvas);
      roughnessMap.wrapS = THREE.RepeatWrapping;
      roughnessMap.wrapT = THREE.RepeatWrapping;

      return { map, bumpMap, roughnessMap };
    };

    const getCachedPostPBRSurface = (
      kind: 'stucco_yellow' | 'roof_tile' | 'cream_stone' | 'base_stone' | 'wood_shutter' | 'courtyard_brick' | 'grey_paver'
    ) => {
      const cacheKey = `postPBR_${kind}`;
      if (!landmarkTextureCache.has(cacheKey)) {
        const res = createPostPBRSurface(kind);
        res.map.userData = { isCached: true };
        res.bumpMap.userData = { isCached: true };
        res.roughnessMap.userData = { isCached: true };
        landmarkTextureCache.set(cacheKey, res);
      }
      return landmarkTextureCache.get(cacheKey);
    };

    const yellowStuccoTex = getCachedPostPBRSurface('stucco_yellow');
    const roofTileTex = getCachedPostPBRSurface('roof_tile');
    const creamStoneTex = getCachedPostPBRSurface('cream_stone');
    const baseStoneTex = getCachedPostPBRSurface('base_stone');
    const woodShutterTex = getCachedPostPBRSurface('wood_shutter');
    const brickPaverTex = getCachedPostPBRSurface('courtyard_brick');
    const greyPaverTex = getCachedPostPBRSurface('grey_paver');

    // 1. HỆ VẬT LIỆU PBR THỰC TẾ (XÓA BỎ HOÀN TOÀN CẢM GIÁC NHỰA BÓNG)
    // + Tường vàng Pháp (#E8C574): roughness: 0.85 + micro-bump & roughnessMap vôi vữa cũ
    const postYellowMat = new THREE.MeshStandardMaterial({
      color: 0xe8c574,
      map: yellowStuccoTex.map,
      bumpMap: yellowStuccoTex.bumpMap,
      bumpScale: 0.045,
      roughnessMap: yellowStuccoTex.roughnessMap,
      roughness: 0.85,
      metalness: 0.02,
    });
    // + Các phào chỉ, cột trắng kem (#F7F4EB): roughness: 0.8 (độ lì tự nhiên của đá, vôi)
    const postTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf7f4eb,
      map: creamStoneTex.map,
      bumpMap: creamStoneTex.bumpMap,
      bumpScale: 0.03,
      roughnessMap: creamStoneTex.roughnessMap,
      roughness: 0.8,
      metalness: 0.02,
    });
    // + Cửa sổ và cửa lớn màu xanh lá đậm (#184D38): roughness: 0.5, metalness: 0.1 (gỗ sơn cũ bóng mờ nhẹ)
    const shutterGreenMat = new THREE.MeshStandardMaterial({
      color: 0x184d38,
      map: woodShutterTex.map,
      bumpMap: woodShutterTex.bumpMap,
      bumpScale: 0.035,
      roughness: 0.5,
      metalness: 0.1,
    });
    // + Chân tường ốp đá nâu xám (#7A6348) có vân đá nhám & vệt ẩm sát đất
    const baseStoneMat = new THREE.MeshStandardMaterial({
      color: 0x7a6348,
      map: baseStoneTex.map,
      bumpMap: baseStoneTex.bumpMap,
      bumpScale: 0.06,
      roughnessMap: baseStoneTex.roughnessMap,
      roughness: 0.88,
      metalness: 0.03,
    });
    // + Mái ngói đỏ cam (#D15B36): roughness: 0.9, vân sọc ngói nhấp nhô nhẹ & rêu phong
    const postRoofMat = new THREE.MeshStandardMaterial({
      color: 0xd15b36,
      map: roofTileTex.map,
      bumpMap: roofTileTex.bumpMap,
      bumpScale: 0.075,
      roughnessMap: roofTileTex.roughnessMap,
      roughness: 0.9,
      metalness: 0.03,
    });
    // + Các cấu kiện sắt, lan can, cột đèn màu đen: metalness: 0.7, roughness: 0.4 (gang đúc / sắt hoen gỉ)
    const eiffelIronMat = new THREE.MeshStandardMaterial({
      color: 0x222b34,
      bumpMap: baseStoneTex.bumpMap,
      bumpScale: 0.02,
      roughness: 0.4,
      metalness: 0.7,
    });
    // + Kính cửa sổ sảnh chính: roughness: 0.1, metalness: 0.9 (phản chiếu ánh sáng tự nhiên)
    const postDarkGlassMat = new THREE.MeshStandardMaterial({
      color: 0x162430,
      roughness: 0.1,
      metalness: 0.9,
    });
    // + Sân gạch trước và lối đi: roughness: 0.95, vân gạch/đá nhám bám bụi tự nhiên
    const courtyardBrickMat = new THREE.MeshStandardMaterial({
      color: 0xc2593f,
      map: brickPaverTex.map,
      bumpMap: brickPaverTex.bumpMap,
      bumpScale: 0.055,
      roughnessMap: brickPaverTex.roughnessMap,
      roughness: 0.95,
      metalness: 0.02,
    });
    const greyStoneWalkMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      map: greyPaverTex.map,
      bumpMap: greyPaverTex.bumpMap,
      bumpScale: 0.045,
      roughnessMap: greyPaverTex.roughnessMap,
      roughness: 0.95,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const lawnGreenMat = new THREE.MeshStandardMaterial({
      color: 0x215e34,
      bumpMap: yellowStuccoTex.bumpMap,
      bumpScale: 0.04,
      roughness: 0.95,
      metalness: 0.0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    // Vật liệu Ambient Occlusion (AO)
    const aoShadowMat = new THREE.MeshBasicMaterial({
      color: 0x0c0a08,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const addPostPart = (mesh: THREE.Mesh, tier: number, origColor: number, isGround = false) => {
      mesh.castShadow = !isGround;
      mesh.receiveShadow = true;
      mesh.userData.elevationTier = tier;
      mesh.userData.origY = mesh.position.y;
      mesh.userData.origColor = origColor;
      const m = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
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
        bumpScale: m.bumpScale ?? 0.04,
        roughnessMap: m.roughnessMap || null,
        roughness: m.roughness ?? 0.8,
        metalness: m.metalness ?? 0.05,
      };
      group.add(mesh);
      return mesh;
    };

    // Helper dựng mái ngói dốc 4 mặt (True 4-sided Hip Roof Geometry) + bờ nóc trắng kem
    const addHipRoof = (
      cx: number,
      bottomY: number,
      cz: number,
      w: number,
      d: number,
      h: number,
      tier = 3
    ) => {
      const hw = w / 2;
      const hd = d / 2;
      const isWide = w >= d;
      const ridgeHalf = isWide
        ? Math.max(0.35, (w - d) * 0.34)
        : Math.max(0.35, (d - w) * 0.34);

      const v0 = [-hw, 0, hd];
      const v1 = [hw, 0, hd];
      const v2 = [hw, 0, -hd];
      const v3 = [-hw, 0, -hd];
      const r0 = isWide ? [-ridgeHalf, h, 0] : [0, h, ridgeHalf];
      const r1 = isWide ? [ridgeHalf, h, 0] : [0, h, -ridgeHalf];

      const positions: number[] = [];
      const pushTri = (a: number[], b: number[], c: number[]) => {
        positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      };

      if (isWide) {
        // Mặt dốc trước (+Z): v0, v1, r1, r0
        pushTri(v0, v1, r1);
        pushTri(v0, r1, r0);
        // Mặt dốc sau (-Z): v2, v3, r0, r1
        pushTri(v2, v3, r0);
        pushTri(v2, r0, r1);
        // Mặt dốc trái (-X): v3, v0, r0
        pushTri(v3, v0, r0);
        // Mặt dốc phải (+X): v1, v2, r1
        pushTri(v1, v2, r1);
      } else {
        // Mặt dốc phải (+X): v1, v2, r1, r0
        pushTri(v1, v2, r1);
        pushTri(v1, r1, r0);
        // Mặt dốc trái (-X): v3, v0, r0, r1
        pushTri(v3, v0, r0);
        pushTri(v3, r0, r1);
        // Mặt dốc trước (+Z): v0, v1, r0
        pushTri(v0, v1, r0);
        // Mặt dốc sau (-Z): v2, v3, r1
        pushTri(v2, v3, r1);
      }
      // Đáy mái
      pushTri(v0, v3, v2);
      pushTri(v0, v2, v1);

      const roofGeo = new THREE.BufferGeometry();
      roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      roofGeo.computeVertexNormals();

      const roofMesh = new THREE.Mesh(roofGeo, postRoofMat);
      roofMesh.position.set(cx, bottomY, cz);
      addPostPart(roofMesh, tier, 0xd15b36);

      // Sống nóc mái màu trắng kem (#F7F4EB)
      const ridgeBar = new THREE.Mesh(
        new THREE.BoxGeometry(
          isWide ? ridgeHalf * 2 + 0.25 : 0.24,
          0.16,
          isWide ? 0.24 : ridgeHalf * 2 + 0.25
        ),
        postTrimMat
      );
      ridgeBar.position.set(cx, bottomY + h + 0.04, cz);
      addPostPart(ridgeBar, tier, 0xf7f4eb);
    };

    // Helper tạo hình vòm bán nguyệt chuẩn trên mặt phẳng XY (vòm hướng lên +Y, độ dày đẩy ra +Z)
    // Tuyệt đối không bị xoay ngang như CylinderGeometry
    const createExtrudedArchGeo = (innerR: number, outerR: number, depth: number, segments = 32) => {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, outerR, 0, Math.PI, false);
      if (innerR > 0.001) {
        shape.lineTo(-innerR, 0);
        shape.absarc(0, 0, innerR, Math.PI, 0, true);
      } else {
        shape.lineTo(-outerR, 0);
      }
      shape.closePath();
      return new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: false,
        curveSegments: segments,
      });
    };

    // Helper tạo ô cửa sổ chữ nhật có khung viền rỗng 4 cạnh (không chồng khối đặc gây Z-fighting)
    const addHollowRectWindowToGroup = (
      targetGroup: THREE.Group,
      cx: number,
      cy: number,
      cz: number,
      w: number,
      h: number,
      borderW = 0.06,
      frameDepth = 0.03
    ) => {
      // 4 thanh viền trắng kem bao quanh ngoài lòng cửa
      const topBar = new THREE.Mesh(
        new THREE.BoxGeometry(w + borderW * 2, borderW, frameDepth),
        postTrimMat
      );
      topBar.position.set(cx, cy + h / 2 + borderW / 2, cz + frameDepth / 2);
      targetGroup.add(topBar);

      const botBar = new THREE.Mesh(
        new THREE.BoxGeometry(w + borderW * 2, borderW, frameDepth),
        postTrimMat
      );
      botBar.position.set(cx, cy - h / 2 - borderW / 2, cz + frameDepth / 2);
      targetGroup.add(botBar);

      const leftBar = new THREE.Mesh(
        new THREE.BoxGeometry(borderW, h, frameDepth),
        postTrimMat
      );
      leftBar.position.set(cx - w / 2 - borderW / 2, cy, cz + frameDepth / 2);
      targetGroup.add(leftBar);

      const rightBar = new THREE.Mesh(
        new THREE.BoxGeometry(borderW, h, frameDepth),
        postTrimMat
      );
      rightBar.position.set(cx + w / 2 + borderW / 2, cy, cz + frameDepth / 2);
      targetGroup.add(rightBar);

      // Bệ cửa sổ mảnh phía dưới
      const sill = new THREE.Mesh(
        new THREE.BoxGeometry(w + borderW * 2 + 0.08, 0.06, frameDepth + 0.03),
        postTrimMat
      );
      sill.position.set(cx, cy - h / 2 - borderW - 0.03, cz + (frameDepth + 0.03) / 2);
      targetGroup.add(sill);

      // Lòng cửa lá sách xanh lá đậm (#184D38) nằm gọn bên trong khung rỗng (không đè lên viền trắng)
      const shutterDepth = frameDepth * 0.75;
      const shutter = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, shutterDepth),
        shutterGreenMat
      );
      shutter.position.set(cx, cy, cz + shutterDepth / 2);
      targetGroup.add(shutter);

      // Đố dọc chia 2 cánh cửa chớp nằm nổi nhẹ phía trước mặt lá sách
      const mullion = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, h, 0.012),
        postTrimMat
      );
      mullion.position.set(cx, cy, cz + shutterDepth + 0.006);
      targetGroup.add(mullion);
    };

    // Helper tạo 1 nhịp mặt đứng chuẩn (Tầng 1 cửa chữ nhật lá sách + Tầng 2 cửa vòm cao lá sách + Phào chỉ)
    // normalDir: 'front' (+Z), 'back' (-Z), 'left' (-X), 'right' (+X)
    const addFacadeWindowBay = (
      x: number,
      z: number,
      baseY: number,
      normalDir: 'front' | 'back' | 'left' | 'right'
    ) => {
      const rotY =
        normalDir === 'front'
          ? 0
          : normalDir === 'back'
          ? Math.PI
          : normalDir === 'right'
          ? Math.PI / 2
          : -Math.PI / 2;

      const bayGroup = new THREE.Group();
      bayGroup.position.set(x, baseY, z);
      bayGroup.rotation.y = rotY;

      // --- TẦNG 1: CỬA SỔ CHỮ NHẬT CÓ LÁ SÁCH XANH LÁ ĐẬM (#184D38) & VIỀN MẢNH (depth: 0.03, border: 0.06) ---
      addHollowRectWindowToGroup(bayGroup, 0, 2.4, 0.006, 1.16, 2.0, 0.06, 0.03);

      // Bảng tên danh nhân khoa học viền trắng kem mảnh phía trên cửa tầng 1
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.26, 0.025), postTrimMat);
      plaque.position.set(0, 3.82, 0.018);
      bayGroup.add(plaque);

      // --- TẦNG 2: CỬA SỔ VÒM CAO (ARCHED WINDOW) CÓ LÁ SÁCH XANH LÁ ĐẬM (#184D38) ---
      const archR = 0.58;
      const f2RectH = 1.82;
      const f2RectY = 5.94;
      const archCenterY = f2RectY + f2RectH / 2; // 6.85
      const f2Border = 0.065;
      const f2Depth = 0.035;
      const zOff = 0.006;

      // Hai thanh viền dọc trắng kem hai bên thân cửa vòm tầng 2 (rỗng ở giữa)
      [-1, 1].forEach((side) => {
        const jamb = new THREE.Mesh(
          new THREE.BoxGeometry(f2Border, f2RectH, f2Depth),
          postTrimMat
        );
        jamb.position.set(side * (archR + f2Border / 2), f2RectY, zOff + f2Depth / 2);
        bayGroup.add(jamb);
      });

      // Vòm bán nguyệt trắng kem rỗng phía trên (dùng ExtrudeGeometry chuẩn mặt phẳng XY)
      const f2FrameArch = new THREE.Mesh(
        createExtrudedArchGeo(archR, archR + f2Border, f2Depth, 28),
        postTrimMat
      );
      f2FrameArch.position.set(0, archCenterY, zOff);
      bayGroup.add(f2FrameArch);

      // Viền khóa vòm (Keystone) trắng kem trên đỉnh cửa vòm
      const keystone = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.05), postTrimMat);
      keystone.position.set(0, archCenterY + archR + f2Border * 0.6, zOff + 0.025);
      bayGroup.add(keystone);

      // Bệ cửa sổ tầng 2 mảnh
      const f2Sill = new THREE.Mesh(
        new THREE.BoxGeometry((archR + f2Border) * 2 + 0.08, 0.07, f2Depth + 0.03),
        postTrimMat
      );
      f2Sill.position.set(0, f2RectY - f2RectH / 2 - 0.035, zOff + (f2Depth + 0.03) / 2);
      bayGroup.add(f2Sill);

      // Thân cửa lá sách xanh lá đậm tầng 2 (nằm gọn trong lòng khung trắng)
      const shutterD = 0.024;
      const f2ShutterRect = new THREE.Mesh(
        new THREE.BoxGeometry(archR * 2, f2RectH, shutterD),
        shutterGreenMat
      );
      f2ShutterRect.position.set(0, f2RectY, zOff + shutterD / 2);
      bayGroup.add(f2ShutterRect);

      // Đầu vòm lá sách xanh lá đậm tầng 2 (dùng ExtrudeGeometry chuẩn, khớp khít tuyệt đối với vòm trắng)
      const f2ShutterArch = new THREE.Mesh(
        createExtrudedArchGeo(0, archR, shutterD, 28),
        shutterGreenMat
      );
      f2ShutterArch.position.set(0, archCenterY, zOff);
      bayGroup.add(f2ShutterArch);

      // Đố ngang chân vòm & đố dọc chia 2 cánh cửa vòm tầng 2
      const f2Transom = new THREE.Mesh(
        new THREE.BoxGeometry(archR * 2, 0.03, 0.012),
        postTrimMat
      );
      f2Transom.position.set(0, archCenterY, zOff + shutterD + 0.006);
      bayGroup.add(f2Transom);

      const f2Mullion = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, f2RectH + archR, 0.012),
        postTrimMat
      );
      f2Mullion.position.set(0, f2RectY + archR / 2, zOff + shutterD + 0.006);
      bayGroup.add(f2Mullion);

      // Convert children of bayGroup into world coordinates on `group` so exploded view & section cut work per mesh
      bayGroup.updateMatrixWorld(true);
      const children = [...bayGroup.children] as THREE.Mesh[];
      children.forEach((child) => {
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        child.getWorldPosition(worldPos);
        child.getWorldQuaternion(worldQuat);
        bayGroup.remove(child);
        child.position.copy(worldPos);
        child.quaternion.copy(worldQuat);
        const tier = worldPos.y > baseY + 4.3 ? 2 : 1;
        const m = child.material as THREE.MeshStandardMaterial;
        addPostPart(child, tier, m.color.getHex());
      });
    };

    // Helper tạo thức cột giả (Pilaster) trắng kem chạy dọc tầng 1 & tầng 2
    const addPilasterColumn = (
      x: number,
      z: number,
      baseY: number,
      normalDir: 'front' | 'back' | 'left' | 'right'
    ) => {
      const isZ = normalDir === 'front' || normalDir === 'back';
      const w = isZ ? 0.32 : 0.18;
      const d = isZ ? 0.18 : 0.32;

      // Chân cột đá nâu xám (#7A6348)
      const colBase = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.95, d + 0.06), baseStoneMat);
      colBase.position.set(x, baseY + 0.475, z);
      addPostPart(colBase, 1, 0x7a6348);

      // Thân cột tầng 1 trắng kem (#F7F4EB)
      const colF1 = new THREE.Mesh(new THREE.BoxGeometry(w, 3.3, d), postTrimMat);
      colF1.position.set(x, baseY + 0.95 + 1.65, z);
      addPostPart(colF1, 1, 0xf7f4eb);

      // Thân cột tầng 2 trắng kem (#F7F4EB)
      const colF2 = new THREE.Mesh(new THREE.BoxGeometry(w, 3.6, d), postTrimMat);
      colF2.position.set(x, baseY + 4.45 + 1.8, z);
      addPostPart(colF2, 2, 0xf7f4eb);

      // Đầu cột Corinthian (Capital)
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.28, d + 0.12), postTrimMat);
      cap.position.set(x, baseY + 8.12, z);
      addPostPart(cap, 2, 0xf7f4eb);
    };

    // =========================================================================
    // 2. KHUÔN VIÊN & SÂN TRƯỚC THỰC TẾ (GROUND BASE, WALKWAY, LAWNS, LAMPPOSTS & FENCE)
    // =========================================================================
    // Đế khuôn viên mở rộng lát gạch đỏ cam (#C2593F) — mặt trên tại y = 0.36
    const compoundBase = new THREE.Mesh(new THREE.BoxGeometry(46.0, 0.36, 35.0), courtyardBrickMat);
    compoundBase.position.set(0, 0.18, 2.5);
    addPostPart(compoundBase, 0, 0xc2593f, true);

    // Viền đá xám bao quanh mép đế khuôn viên
    const compoundCurb = new THREE.Mesh(new THREE.BoxGeometry(46.6, 0.28, 35.6), greyStoneWalkMat);
    compoundCurb.position.set(0, 0.14, 2.5);
    addPostPart(compoundCurb, 0, 0x94a3b8, true);

    // Lối đi lát đá màu xám ở chính giữa sân trước:
    // Nâng cao độ Y lên cao hơn mặt sân gạch đỏ (y = 0.36) khoảng 0.05 - 0.06 đơn vị (mặt trên tại y = 0.42)
    // và hợp nhất mặt phẳng lối đi (không dùng RingGeometry chồng lên BoxGeometry) để triệt tiêu hoàn toàn Z-fighting
    const centerWalkway = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.06, 9.1), greyStoneWalkMat);
    centerWalkway.position.set(0, 0.39, 15.05);
    addPostPart(centerWalkway, 0, 0x94a3b8, true);

    // Hai nhánh quảng trường đá xám mở rộng sang hai bên trước bậc tam cấp (cùng cao độ y = 0.39, không chồng lấp với centerWalkway)
    [-6.2, 6.2].forEach((wx) => {
      const sideWalkwayWing = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 4.2), greyStoneWalkMat);
      sideWalkwayWing.position.set(wx, 0.39, 12.6);
      addPostPart(sideWalkwayWing, 0, 0x94a3b8, true);
    });

    // Hai bồn cỏ xanh đối xứng hai bên sân trước (nâng cao độ Y lên cao hơn mặt sân gạch đỏ 0.05 - 0.08 đơn vị)
    [-13.2, 13.2].forEach((lx) => {
      const lawnBedCurb = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.06, 6.2), postTrimMat);
      lawnBedCurb.position.set(lx, 0.39, 14.8);
      addPostPart(lawnBedCurb, 0, 0xf7f4eb, true);

      const lawnBedGrass = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.06, 5.6), lawnGreenMat);
      lawnBedGrass.position.set(lx, 0.43, 14.8);
      addPostPart(lawnBedGrass, 0, 0x1e6b3a, true);
    });

    // 6 Cột đèn chùm cổ điển (3 bóng cầu vàng ấm) dọc lối đi vòng cung và sân trước
    const addOrnateChandelierLamp = (lx: number, lz: number) => {
      const postBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.7, 12), eiffelIronMat);
      postBase.position.set(lx, 0.7, lz);
      addPostPart(postBase, 0, 0x1e293b, true);

      const postShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.2, 12), eiffelIronMat);
      postShaft.position.set(lx, 2.3, lz);
      addPostPart(postShaft, 0, 0x1e293b, true);

      const crossArm = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.08), eiffelIronMat);
      crossArm.position.set(lx, 3.75, lz);
      addPostPart(crossArm, 0, 0x1e293b, true);

      const lampGlowMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      });
      [-0.42, 0, 0.42].forEach((gx, idx) => {
        const globe = new THREE.Mesh(new THREE.SphereGeometry(idx === 1 ? 0.22 : 0.17, 14, 14), lampGlowMat);
        globe.position.set(lx + gx, idx === 1 ? 4.05 : 3.9, lz);
        addPostPart(globe, 0, 0xfef08a, true);
      });
    };

    [
      [-5.4, 13.8],
      [5.4, 13.8],
      [-7.6, 17.5],
      [7.6, 17.5],
      [-15.5, 18.2],
      [15.5, 18.2],
    ].forEach(([lx, lz]) => addOrnateChandelierLamp(lx, lz));

    // Hàng rào sắt mỹ thuật màu đen có trụ cột vàng bao quanh rìa khuôn viên
    const fenceZFront = 19.6;
    const fenceZBack = -14.6;
    const fenceXSide = 22.6;

    const addFencePost = (px: number, pz: number, isGatePillar = false) => {
      const pw = isGatePillar ? 0.75 : 0.48;
      const ph = isGatePillar ? 2.4 : 1.85;
      const postMesh = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pw), postYellowMat);
      postMesh.position.set(px, 0.36 + ph / 2, pz);
      addPostPart(postMesh, 0, 0xe8c574, true);

      const postCap = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.14, 0.18, pw + 0.14), postTrimMat);
      postCap.position.set(px, 0.36 + ph + 0.09, pz);
      addPostPart(postCap, 0, 0xf7f4eb, true);
    };

    const addIronFenceSegment = (x1: number, z1: number, x2: number, z2: number) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const cx = (x1 + x2) / 2;
      const cz = (z1 + z2) / 2;
      const isHoriz = Math.abs(z1 - z2) < 0.01;

      // Chân tường rào thấp màu vàng Pháp
      const lowWall = new THREE.Mesh(
        new THREE.BoxGeometry(isHoriz ? len : 0.24, 0.45, isHoriz ? 0.24 : len),
        postYellowMat
      );
      lowWall.position.set(cx, 0.36 + 0.225, cz);
      addPostPart(lowWall, 0, 0xe8c574, true);

      // Thanh sắt ngang trên và dưới
      [1.05, 1.75].forEach((ry) => {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(isHoriz ? len : 0.08, 0.07, isHoriz ? 0.08 : len),
          eiffelIronMat
        );
        rail.position.set(cx, ry, cz);
        addPostPart(rail, 0, 0x1e293b, true);
      });

      // Các thanh song sắt dọc màu đen
      const numBars = Math.floor(len / 0.55);
      for (let i = 1; i < numBars; i++) {
        const t = i / numBars;
        const bx = x1 + (x2 - x1) * t;
        const bz = z1 + (z2 - z1) * t;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.15, 0.05), eiffelIronMat);
        bar.position.set(bx, 1.35, bz);
        addPostPart(bar, 0, 0x1e293b, true);
      }
    };

    // Hàng rào mặt trước (chừa lối cổng chính rộng từ x = -4.8 đến +4.8)
    [-22.6, -18.0, -13.5, -9.0, -4.8, 4.8, 9.0, 13.5, 18.0, 22.6].forEach((px) => {
      addFencePost(px, fenceZFront, Math.abs(px) === 4.8);
    });
    addIronFenceSegment(-22.6, fenceZFront, -4.8, fenceZFront);
    addIronFenceSegment(4.8, fenceZFront, 22.6, fenceZFront);

    // Hàng rào mặt sau và hai bên hông
    [-18.0, -11.0, -4.0, 4.0, 11.0, 18.0].forEach((px) => addFencePost(px, fenceZBack));
    addIronFenceSegment(-22.6, fenceZBack, 22.6, fenceZBack);

    [-14.6, -8.0, -1.5, 5.0, 12.0].forEach((pz) => {
      addFencePost(-fenceXSide, pz);
      addFencePost(fenceXSide, pz);
    });
    addIronFenceSegment(-fenceXSide, fenceZBack, -fenceXSide, fenceZFront);
    addIronFenceSegment(fenceXSide, fenceZBack, fenceXSide, fenceZFront);

    // =========================================================================
    // 3. KHỐI TÒA NHÀ CHÍNH 4 MẶT (TRƯỚC, SAU, TRÁI, PHẢI) & CHÂN TƯỜNG ĐÁ NÂU XÁM
    // =========================================================================
    const baseY = 0.36;

    // A. HAI DÃY CÁNH ĐỐI XỨNG TRÁI & PHẢI + DÃY HẬU KHÉP KÍN 4 MẶT
    // Tòa nhà rộng từ x = -15.6 đến +15.6 (31.2m), sâu từ z = -9.6 đến +8.8 (18.4m)
    [-1, 1].forEach((dir) => {
      const wingX = dir * 10.2; // Tâm mỗi cánh tại x = ±10.2 (từ ±4.8 đến ±15.6, rộng 10.8)
      const wingW = 10.8;
      const wingD = 18.4; // Chạy từ z = -9.6 đến z = +8.8
      const wingZ = -0.4;

      // Chân tường ốp đá nâu xám (#7A6348) bao quanh cả 4 mặt cánh
      const wingPlinth = new THREE.Mesh(new THREE.BoxGeometry(wingW + 0.16, 0.95, wingD + 0.16), baseStoneMat);
      wingPlinth.position.set(wingX, baseY + 0.475, wingZ);
      addPostPart(wingPlinth, 1, 0x7a6348);

      // Tường vàng Pháp tầng 1 (#E8C574)
      const wingF1 = new THREE.Mesh(new THREE.BoxGeometry(wingW, 3.35, wingD), postYellowMat);
      wingF1.position.set(wingX, baseY + 0.95 + 1.675, wingZ);
      addPostPart(wingF1, 1, 0xe8c574);

      // Phào chỉ ngang ngăn tầng 1 - tầng 2 màu trắng kem (#F7F4EB) chạy khắp 4 mặt
      const wingBelt = new THREE.Mesh(new THREE.BoxGeometry(wingW + 0.36, 0.28, wingD + 0.36), postTrimMat);
      wingBelt.position.set(wingX, baseY + 4.35, wingZ);
      addPostPart(wingBelt, 1, 0xf7f4eb);

      // Tường vàng Pháp tầng 2 (#E8C574)
      const wingF2 = new THREE.Mesh(new THREE.BoxGeometry(wingW, 3.7, wingD), postYellowMat);
      wingF2.position.set(wingX, baseY + 4.45 + 1.85, wingZ);
      addPostPart(wingF2, 2, 0xe8c574);

      // Diềm mái và lan can trắng kem (#F7F4EB) chạy quanh mép dưới mái
      const wingCornice = new THREE.Mesh(new THREE.BoxGeometry(wingW + 0.5, 0.38, wingD + 0.5), postTrimMat);
      wingCornice.position.set(wingX, baseY + 8.3, wingZ);
      addPostPart(wingCornice, 2, 0xf7f4eb);

      // Mái ngói dốc 4 mặt (Hip Roof) màu đỏ cam (#D15B36) đồng bộ trên mỗi cánh
      addHipRoof(wingX, baseY + 8.49, wingZ, wingW + 0.4, wingD + 0.4, 2.15, 3);

      // 1) CHI TIẾT MẶT TIỀN CÁNH (+Z = 8.8): 2 nhịp cửa sổ ngoài (tránh giao cắt với khối sảnh trung tâm x = ±5.2)
      const frontWallZ = wingZ + wingD / 2; // +8.8
      const innerBayX = dir * 7.15;
      const outerBayX = dir * 12.25;
      const farBayX = dir * 14.3;
      void farBayX;
      [-3.4, 0, 3.4].forEach((bx) => {
        const worldBx = wingX + bx;
        // Chỉ tạo nhịp cửa nếu nằm ngoài phạm vi khối sảnh giữa (|x| > 5.8)
        if (Math.abs(worldBx) > 5.8) {
          addFacadeWindowBay(worldBx, frontWallZ, baseY, 'front');
        }
      });
      void innerBayX;
      void outerBayX;
      // Bổ sung nhịp cửa cân đối trên mặt tiền mỗi cánh tại x = ±7.4, ±10.6, ±13.8
      [7.4, 10.6, 13.8].forEach((absX) => {
        if (absX !== 6.8 && absX !== 10.2 && absX !== 13.6) {
          // Đã có [-3.4, 0, 3.4] tương ứng x = ±6.8, ±10.2, ±13.6 đều > 5.8!
        }
      });
      [-5.1, -1.7, 1.7, 5.1].forEach((px) => {
        if (Math.abs(wingX + px) > 5.4) {
          addPilasterColumn(wingX + px, frontWallZ + 0.02, baseY, 'front');
        }
      });

      // 2) CHI TIẾT MẶT HẬU CÁNH (-Z = -9.6): 3 nhịp cửa sổ vòm & chữ nhật + thức cột
      const backWallZ = wingZ - wingD / 2; // -9.6
      [-3.4, 0, 3.4].forEach((bx) => {
        addFacadeWindowBay(wingX + bx, backWallZ, baseY, 'back');
      });
      [-5.1, -1.7, 1.7, 5.1].forEach((px) => {
        addPilasterColumn(wingX + px, backWallZ - 0.02, baseY, 'back');
      });

      // 3) CHI TIẾT MẶT HÔNG NGOÀI CÙNG (TRÁI x = -15.6 / PHẢI x = +15.6): 5 nhịp cửa sổ dọc chiều sâu + thức cột
      const sideWallX = wingX + dir * (wingW / 2); // ±15.6
      const sideDir = dir === -1 ? 'left' : 'right';
      [-7.2, -3.8, -0.4, 3.0, 6.4].forEach((bz) => {
        addFacadeWindowBay(sideWallX, bz, baseY, sideDir);
      });
      [-8.9, -5.5, -2.1, 1.3, 4.7, 8.1].forEach((pz) => {
        addPilasterColumn(sideWallX + dir * 0.02, pz, baseY, sideDir);
      });
    });

    // B. KHỐI NỐI MẶT HẬU TRUNG TÂM (REAR CENTRAL FACADE — x = -4.8..4.8, z = -9.6..-5.8)
    // Đảm bảo mặt sau tòa nhà liền mạch, đầy đủ cửa sổ vòm, lá sách xanh lá đậm và thức cột
    const rearCenterW = 9.6;
    const rearCenterD = 3.8;
    const rearCenterZ = -7.7;

    const rearPlinth = new THREE.Mesh(
      new THREE.BoxGeometry(rearCenterW + 0.16, 0.95, rearCenterD + 0.16),
      baseStoneMat
    );
    rearPlinth.position.set(0, baseY + 0.475, rearCenterZ);
    addPostPart(rearPlinth, 1, 0x7a6348);

    const rearF1 = new THREE.Mesh(new THREE.BoxGeometry(rearCenterW, 3.35, rearCenterD), postYellowMat);
    rearF1.position.set(0, baseY + 0.95 + 1.675, rearCenterZ);
    addPostPart(rearF1, 1, 0xe8c574);

    const rearBelt = new THREE.Mesh(new THREE.BoxGeometry(rearCenterW + 0.3, 0.28, rearCenterD + 0.3), postTrimMat);
    rearBelt.position.set(0, baseY + 4.35, rearCenterZ);
    addPostPart(rearBelt, 1, 0xf7f4eb);

    const rearF2 = new THREE.Mesh(new THREE.BoxGeometry(rearCenterW, 3.7, rearCenterD), postYellowMat);
    rearF2.position.set(0, baseY + 4.45 + 1.85, rearCenterZ);
    addPostPart(rearF2, 2, 0xe8c574);

    const rearCornice = new THREE.Mesh(new THREE.BoxGeometry(rearCenterW + 0.4, 0.38, rearCenterD + 0.4), postTrimMat);
    rearCornice.position.set(0, baseY + 8.3, rearCenterZ);
    addPostPart(rearCornice, 2, 0xf7f4eb);

    addHipRoof(0, baseY + 8.49, rearCenterZ, rearCenterW + 0.3, rearCenterD + 0.3, 1.55, 3);

    // 3 Nhịp cửa sổ mặt hậu trung tâm tại z = -9.6
    [-3.1, 0, 3.1].forEach((bx) => {
      addFacadeWindowBay(bx, -9.6, baseY, 'back');
    });
    [-4.6, -1.55, 1.55, 4.6].forEach((px) => {
      addPilasterColumn(px, -9.62, baseY, 'back');
    });

    // =========================================================================
    // 4. KHỐI SẢNH CHÍNH TRUNG TÂM 3 TẦNG & MÁI NGÓI DỐC 4 MẶT (CENTRAL AVANT-CORPS)
    // =========================================================================
    const pavW = 10.4;
    const pavD = 6.2;
    const pavZ = 7.4; // Nhô ra phía trước đến z = 10.5 (so với cánh z = 8.8)
    const pavFrontZ = pavZ + pavD / 2; // 10.5

    // Chân tường đá nâu xám khối sảnh chính (#7A6348):
    // Chia làm 2 bệ đá hai bên (x = ±4.25) và bậc thềm sảnh ở giữa (cao 0.54m) để KHÔNG BAO GIỜ che lấp 3 cửa chính!
    [-4.25, 4.25].forEach((px) => {
      const sidePlinth = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.95, pavD + 0.2), baseStoneMat);
      sidePlinth.position.set(px, baseY + 0.475, pavZ);
      addPostPart(sidePlinth, 1, 0x7a6348);
    });
    const centerThreshold = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.54, pavD + 0.16), greyStoneWalkMat);
    centerThreshold.position.set(0, baseY + 0.27, pavZ);
    addPostPart(centerThreshold, 1, 0x94a3b8);

    // Khối thân Tầng 1 & Tầng 2 của sảnh chính
    const pavBodyF1 = new THREE.Mesh(new THREE.BoxGeometry(pavW, 3.55, pavD), postYellowMat);
    pavBodyF1.position.set(0, baseY + 0.95 + 1.775, pavZ);
    addPostPart(pavBodyF1, 1, 0xe8c574);

    // Điền phần tường vàng phía trên thềm cửa chính (từ y = baseY + 0.54 đến baseY + 0.95)
    const pavLowerCenterWall = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.45, pavD), postYellowMat);
    pavLowerCenterWall.position.set(0, baseY + 0.745, pavZ);
    addPostPart(pavLowerCenterWall, 1, 0xe8c574);

    const pavBelt1 = new THREE.Mesh(new THREE.BoxGeometry(pavW + 0.36, 0.26, pavD + 0.36), postTrimMat);
    pavBelt1.position.set(0, baseY + 4.5, pavZ);
    addPostPart(pavBelt1, 2, 0xf7f4eb);

    const pavBodyF2 = new THREE.Mesh(new THREE.BoxGeometry(pavW, 4.1, pavD), postYellowMat);
    pavBodyF2.position.set(0, baseY + 4.65 + 2.05, pavZ);
    addPostPart(pavBodyF2, 2, 0xe8c574);

    // Phào chỉ ngăn Tầng 2 và Tầng 3 (Attic Floor)
    const pavBelt2 = new THREE.Mesh(new THREE.BoxGeometry(pavW + 0.45, 0.3, pavD + 0.45), postTrimMat);
    pavBelt2.position.set(0, baseY + 8.8, pavZ);
    addPostPart(pavBelt2, 2, 0xf7f4eb);

    // Tầng 3 (Tầng trên cùng dưới mái của khối sảnh giữa — cao 2.35m)
    const pavBodyF3 = new THREE.Mesh(new THREE.BoxGeometry(pavW, 2.35, pavD), postYellowMat);
    pavBodyF3.position.set(0, baseY + 8.97 + 1.175, pavZ);
    addPostPart(pavBodyF3, 2, 0xe8c574);

    // Viền diềm mái / lan can trắng chạy quanh mép dưới mái khối trung tâm (#F7F4EB)
    const pavTopCornice = new THREE.Mesh(new THREE.BoxGeometry(pavW + 0.7, 0.42, pavD + 0.7), postTrimMat);
    pavTopCornice.position.set(0, baseY + 11.45, pavZ);
    addPostPart(pavTopCornice, 3, 0xf7f4eb);

    // Lan can con tiện trắng quanh mép dưới mái trung tâm
    const pavBalustrade = new THREE.Mesh(new THREE.BoxGeometry(pavW + 0.5, 0.32, pavD + 0.5), postTrimMat);
    pavBalustrade.position.set(0, baseY + 11.8, pavZ);
    addPostPart(pavBalustrade, 3, 0xf7f4eb);

    // MÁI KHỐI TRUNG TÂM: Mái ngói dốc 4 mặt (Hip Roof) màu đỏ cam (#D15B36)
    addHipRoof(0, baseY + 11.96, pavZ, pavW + 0.6, pavD + 0.6, 2.55, 3);

    // Hàng 5 ô cửa sổ chữ nhật xanh lá đậm (#184D38) ở Tầng trên cùng (Tầng 3 khối sảnh giữa):
    // Dùng khung rỗng 4 cạnh (depth = 0.03, border width = 0.06) không chồng khối đặc
    const f3WinY = baseY + 10.15;
    const f3TempGroup = new THREE.Group();
    [-3.4, -1.7, 0, 1.7, 3.4].forEach((wx) => {
      addHollowRectWindowToGroup(f3TempGroup, wx, f3WinY, pavFrontZ + 0.006, 0.86, 1.22, 0.06, 0.03);
    });
    while (f3TempGroup.children.length > 0) {
      const part = f3TempGroup.children[0] as THREE.Mesh;
      f3TempGroup.remove(part);
      const m = part.material as THREE.MeshStandardMaterial;
      addPostPart(part, 2, m.color.getHex());
    }

    // Các bổ trụ trắng kem mảnh xen kẽ hàng 5 cửa sổ tầng 3
    [-4.45, -2.55, -0.85, 0.85, 2.55, 4.45].forEach((px) => {
      const f3Pil = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 0.04), postTrimMat);
      f3Pil.position.set(px, f3WinY, pavFrontZ + 0.02);
      addPostPart(f3Pil, 2, 0xf7f4eb);
    });

    // KHU VỰC CỔNG CHÍNH & VÒM BÁN NGUYỆT LỚN CHIA Ô NAN QUẠT (GRAND ARCHWAY)
    // Bậc tam cấp đá xám (3 bậc trải rộng từ sân y = 0.36 lên thềm sảnh y = 0.90)
    [
      { w: 8.6, h: 0.18, d: 1.8, y: 0.45, z: pavFrontZ + 0.9 },
      { w: 7.8, h: 0.18, d: 1.25, y: 0.63, z: pavFrontZ + 0.625 },
      { w: 7.0, h: 0.18, d: 0.7, y: 0.81, z: pavFrontZ + 0.35 },
    ].forEach((st) => {
      const step = new THREE.Mesh(new THREE.BoxGeometry(st.w, st.h, st.d), greyStoneWalkMat);
      step.position.set(0, st.y, st.z);
      addPostPart(step, 0, 0x94a3b8, true);
    });

    // 3 Cửa chính dẫn vào sảnh ở tầng trệt (x = -2.15, 0, 2.15), đặt chuẩn trên mặt thềm y = 0.90 (baseY + 0.54)
    // Khung cửa rỗng 3 cạnh + cánh cửa gỗ xanh lá đậm & hoa sắt đen cổ điển (không chồng khối đặc)
    const doorBaseY = baseY + 0.54; // 0.90
    [-2.15, 0, 2.15].forEach((dx, idx) => {
      const dw = idx === 1 ? 1.95 : 1.28;
      const dh = 2.95;
      const doorCenterY = doorBaseY + dh / 2;
      const borderW = 0.09;
      const frameD = 0.05;
      const zBase = pavFrontZ + 0.008;

      // Hai trụ khung cửa trắng kem bên trái & phải
      [-1, 1].forEach((s) => {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(borderW, dh, frameD), postTrimMat);
        jamb.position.set(dx + s * (dw / 2 + borderW / 2), doorCenterY, zBase + frameD / 2);
        addPostPart(jamb, 1, 0xf7f4eb);
      });
      // Lanh tô ngang trắng kem trên đỉnh cửa
      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(dw + borderW * 2 + 0.08, borderW * 1.3, frameD + 0.02),
        postTrimMat
      );
      lintel.position.set(dx, doorBaseY + dh + (borderW * 1.3) / 2, zBase + (frameD + 0.02) / 2);
      addPostPart(lintel, 1, 0xf7f4eb);

      // Lòng cửa kính tối bên trong (không đè lên khung trắng)
      const glassDepth = 0.024;
      const doorGlass = new THREE.Mesh(
        new THREE.BoxGeometry(dw, dh, glassDepth),
        postDarkGlassMat
      );
      doorGlass.position.set(dx, doorCenterY, zBase + glassDepth / 2);
      addPostPart(doorGlass, 1, 0x162430);

      // Pano gỗ xanh lá đậm (#184D38) ở phần dưới 2 cánh cửa chính
      const lowerPanelH = 1.05;
      [-1, 1].forEach((s) => {
        const leafW = dw / 2 - 0.03;
        const woodPanel = new THREE.Mesh(
          new THREE.BoxGeometry(leafW, lowerPanelH, 0.014),
          shutterGreenMat
        );
        woodPanel.position.set(
          dx + s * (dw / 4),
          doorBaseY + lowerPanelH / 2 + 0.02,
          zBase + glassDepth + 0.007
        );
        addPostPart(woodPanel, 1, 0x184d38);
      });

      // Khung đố cửa sắt đen mảnh chia 2 cánh & ô thoáng trên
      const centerStile = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, dh, 0.018),
        eiffelIronMat
      );
      centerStile.position.set(dx, doorCenterY, zBase + glassDepth + 0.009);
      addPostPart(centerStile, 1, 0x222b34);

      const transomBar = new THREE.Mesh(
        new THREE.BoxGeometry(dw, 0.04, 0.018),
        eiffelIronMat
      );
      transomBar.position.set(dx, doorBaseY + dh - 0.65, zBase + glassDepth + 0.009);
      addPostPart(transomBar, 1, 0x222b34);
    });

    // MÁI HIÊN SẢNH CHÍNH (CANOPY) KHUNG SẮT ĐEN NHÔ RA PHÍA TRƯỚC
    const canopyY = baseY + 3.92;
    const canopyZ = pavFrontZ + 0.85;
    const canopyFrame = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.14, 1.7), eiffelIronMat);
    canopyFrame.position.set(0, canopyY, canopyZ);
    addPostPart(canopyFrame, 1, 0x1e293b);

    const canopyGlass = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.06, 1.45), postDarkGlassMat);
    canopyGlass.position.set(0, canopyY + 0.06, canopyZ);
    addPostPart(canopyGlass, 1, 0x111c24);

    // Tay đỡ console sắt mỹ thuật của mái hiên (gắn vào trụ tường, không chống cột xuống bậc tam cấp chắn cửa)
    [-3.15, -1.15, 1.15, 3.15].forEach((cx) => {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.38, 1.55), eiffelIronMat);
      bracket.position.set(cx, canopyY - 0.19, canopyZ - 0.05);
      addPostPart(bracket, 1, 0x1e293b);
    });

    // VÒM CỔNG LỚN HÌNH BÁN NGUYỆT (GRAND ARCHWAY) CHIA Ô NAN QUẠT Ở CHÍNH GIỮA MẶT TIỀN
    // Dùng ExtrudeGeometry trên mặt phẳng XY để vòm bán nguyệt hướng thẳng lên +Y, tuyệt đối không bị xoay lệch
    const grandArchCenterY = baseY + 4.72;
    const grandArchR = 2.65;

    // Lòng vòm bán nguyệt sâu màu kính tối (dùng createExtrudedArchGeo chuẩn mặt phẳng đứng)
    const grandArchBack = new THREE.Mesh(
      createExtrudedArchGeo(0, grandArchR, 0.04, 44),
      postDarkGlassMat
    );
    grandArchBack.position.set(0, grandArchCenterY, pavFrontZ + 0.01);
    addPostPart(grandArchBack, 2, 0x162430);

    // Thanh bệ ngang dưới đáy vòm bán nguyệt
    const grandArchBaseBar = new THREE.Mesh(
      new THREE.BoxGeometry((grandArchR + 0.32) * 2, 0.16, 0.12),
      postTrimMat
    );
    grandArchBaseBar.position.set(0, grandArchCenterY - 0.06, pavFrontZ + 0.06);
    addPostPart(grandArchBaseBar, 2, 0xf7f4eb);

    // Viền vòm bán nguyệt lớn đắp nổi màu trắng kem (#F7F4EB)
    const grandArchTrim = new THREE.Mesh(
      createExtrudedArchGeo(grandArchR, grandArchR + 0.32, 0.1, 44),
      postTrimMat
    );
    grandArchTrim.position.set(0, grandArchCenterY, pavFrontZ + 0.015);
    addPostPart(grandArchTrim, 2, 0xf7f4eb);

    // Vòng cung phụ đồng tâm bên trong vòm bán nguyệt (Concentric fanlight ring)
    const innerRingMesh = new THREE.Mesh(
      createExtrudedArchGeo(1.68, 1.8, 0.06, 36),
      postTrimMat
    );
    innerRingMesh.position.set(0, grandArchCenterY, pavFrontZ + 0.03);
    addPostPart(innerRingMesh, 2, 0xf7f4eb);

    const innerCoreArch = new THREE.Mesh(
      createExtrudedArchGeo(0.72, 0.82, 0.06, 28),
      postTrimMat
    );
    innerCoreArch.position.set(0, grandArchCenterY, pavFrontZ + 0.03);
    addPostPart(innerCoreArch, 2, 0xf7f4eb);

    // Các thanh chia ô nan quạt (Radial Fanlight Spoke Mullions) tỏa ra từ tâm vòm bán nguyệt
    for (let i = 1; i <= 7; i++) {
      const ang = (i * Math.PI) / 8;
      const spokeLen = grandArchR - 0.78;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.065, spokeLen, 0.04), postTrimMat);
      const midR = 0.78 + spokeLen / 2;
      spoke.position.set(
        Math.cos(ang) * midR,
        grandArchCenterY + Math.sin(ang) * midR,
        pavFrontZ + 0.055
      );
      spoke.rotation.z = ang - Math.PI / 2;
      addPostPart(spoke, 2, 0xf7f4eb);
    }

    // ĐỒNG HỒ CỔ HÌNH TRÒN LỚN GẮN CHÍNH GIỮA ĐỈNH VÒM CỔNG (MẶT TRẮNG, KIM VÀ SỐ ĐEN)
    // Đặt cao độ tại đỉnh vòm (grandArchCenterY + grandArchR + 0.15) và phân tách lớp Z rõ ràng
    const clockY = grandArchCenterY + grandArchR + 0.12;
    const clockZ = pavFrontZ + 0.14;
    const clockR = 0.96;

    // PHÙ ĐIÊU TRẮNG ĐẮP NỔI (SCULPTED WHITE RELIEF CREST & GARLAND) BAO QUANH ĐỒNG HỒ
    const reliefShield = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.65, 0.12), postTrimMat);
    reliefShield.position.set(0, clockY + clockR + 0.18, pavFrontZ + 0.08);
    addPostPart(reliefShield, 2, 0xf7f4eb);

    [-1.45, 1.45].forEach((gx) => {
      const garland = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.24, 0.1), postTrimMat);
      garland.position.set(gx, clockY - 0.15, pavFrontZ + 0.08);
      garland.rotation.z = gx > 0 ? -0.25 : 0.25;
      addPostPart(garland, 2, 0xf7f4eb);
    });

    // Viền ngoài đồng hồ trắng kem đắp nổi (từ z = pavFrontZ + 0.04 đến +0.14)
    const clockOuterFrame = new THREE.Mesh(
      new THREE.CylinderGeometry(clockR + 0.18, clockR + 0.18, 0.1, 36),
      postTrimMat
    );
    clockOuterFrame.rotation.x = Math.PI / 2;
    clockOuterFrame.position.set(0, clockY, clockZ - 0.05);
    addPostPart(clockOuterFrame, 2, 0xf7f4eb);

    // Viền đồng vàng (từ z = clockZ đến clockZ + 0.06)
    const clockBezel = new THREE.Mesh(
      new THREE.CylinderGeometry(clockR + 0.07, clockR + 0.07, 0.06, 36),
      goldBronzeMat
    );
    clockBezel.rotation.x = Math.PI / 2;
    clockBezel.position.set(0, clockY, clockZ + 0.03);
    addPostPart(clockBezel, 2, 0xd97706);

    // Mặt đồng hồ màu trắng tinh (#FFFFFF) (từ z = clockZ + 0.06 đến clockZ + 0.10)
    const clockFace = new THREE.Mesh(
      new THREE.CylinderGeometry(clockR, clockR, 0.04, 36),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 })
    );
    clockFace.rotation.x = Math.PI / 2;
    clockFace.position.set(0, clockY, clockZ + 0.08);
    addPostPart(clockFace, 2, 0xffffff);

    // 12 Cọc số đen (Black Hour Numerals) nổi phía trước mặt đồng hồ trắng (tại z = clockZ + 0.115)
    const blackDialMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
    for (let h = 0; h < 12; h++) {
      const ang = (h * Math.PI) / 6;
      const tickR = clockR * 0.8;
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(h % 3 === 0 ? 0.075 : 0.045, h % 3 === 0 ? 0.19 : 0.12, 0.02),
        blackDialMat
      );
      tick.position.set(
        Math.cos(ang) * tickR,
        clockY + Math.sin(ang) * tickR,
        clockZ + 0.112
      );
      tick.rotation.z = ang - Math.PI / 2;
      addPostPart(tick, 2, 0x111111);
    }

    // Kim giờ và kim phút màu đen (#111111) chỉ 10h10 + chốt tâm đen
    const hHand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.48, 0.02), blackDialMat);
    hHand.rotation.z = 0.88;
    hHand.position.set(-0.15, clockY + 0.13, clockZ + 0.125);
    addPostPart(hHand, 2, 0x111111);

    const mHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.68, 0.02), blackDialMat);
    mHand.rotation.z = -0.88;
    mHand.position.set(0.2, clockY + 0.17, clockZ + 0.13);
    addPostPart(mHand, 2, 0x111111);

    const clockPin = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 16), blackDialMat);
    clockPin.rotation.x = Math.PI / 2;
    clockPin.position.set(0, clockY, clockZ + 0.128);
    addPostPart(clockPin, 2, 0x111111);

    // Hai nhịp cửa sổ phụ & thức cột đôi Corinthian kẹp hai bên Vòm cổng chính (x = ±4.05)
    [-4.05, 4.05].forEach((sx) => {
      addFacadeWindowBay(sx, pavFrontZ, baseY, 'front');
    });
    [-5.05, -3.25, 3.25, 5.05].forEach((px) => {
      addPilasterColumn(px, pavFrontZ + 0.02, baseY, 'front');
    });

    // Cột cờ và Quốc kỳ Việt Nam trên đỉnh mái khối trung tâm
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.8, 12), eiffelIronMat);
    flagPole.position.set(0, baseY + 15.6, pavZ);
    addPostPart(flagPole, 3, 0x1e293b);

    const vnFlagTex = createVietnamFlagTexture();
    const vnFlagMat = new THREE.MeshStandardMaterial({
      map: vnFlagTex,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    const vnFlag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.05), vnFlagMat);
    vnFlag.position.set(0.82, baseY + 16.45, pavZ);
    vnFlag.userData.isFlag = true;
    addPostPart(vnFlag, 3, 0xda251d);

    // =========================================================================
    // 5. KHUNG VÒM THÉP GUSTAVE EIFFEL CHẠY DỌC SẢNH CHÍNH PHÍA SAU KHỐI MẶT TIỀN
    // Nằm giữa sân trong/sảnh chính (z = -5.8 đến z = +4.4) để lộ rõ kết cấu vòm thép
    // khi xoay góc nhìn hoặc bật chế độ Khung dây (Wireframe) / X-Ray
    // =========================================================================
    const vaultRadius = 4.55;
    const vaultLen = 10.2;
    const vaultCenterZ = -0.7;
    const vaultBaseY = baseY + 7.2;

    // Lợp mái vòm ống phía trên sảnh chính (Barrel Vault Roof)
    const vaultGeo = new THREE.CylinderGeometry(
      vaultRadius,
      vaultRadius,
      vaultLen,
      36,
      1,
      false,
      0,
      Math.PI
    );
    vaultGeo.rotateZ(Math.PI / 2);
    vaultGeo.rotateY(Math.PI / 2);
    const mainVault = new THREE.Mesh(vaultGeo, postRoofMat);
    mainVault.position.set(0, vaultBaseY, vaultCenterZ);
    addPostPart(mainVault, 3, 0xd15b36);

    // Hệ khung vòm thép tiền chế Gustave Eiffel (Wrought-Iron Arch Trusses & Columns) bên trong sảnh
    [-5.2, -3.2, -1.2, 0.8, 2.8, 4.2].forEach((rz) => {
      // Vòm thép chính
      const ribGeo = new THREE.CylinderGeometry(
        vaultRadius - 0.12,
        vaultRadius - 0.12,
        0.24,
        32,
        1,
        false,
        0,
        Math.PI
      );
      ribGeo.rotateZ(Math.PI / 2);
      ribGeo.rotateY(Math.PI / 2);
      const rib = new THREE.Mesh(ribGeo, eiffelIronMat);
      rib.position.set(0, vaultBaseY, rz);
      addPostPart(rib, 2, 0x1e293b);

      // Vòm thép phụ song song bên trong (Double Arch Lattice Truss)
      const innerRibGeo = new THREE.CylinderGeometry(
        vaultRadius - 0.55,
        vaultRadius - 0.55,
        0.18,
        28,
        1,
        false,
        0,
        Math.PI
      );
      innerRibGeo.rotateZ(Math.PI / 2);
      innerRibGeo.rotateY(Math.PI / 2);
      const innerRib = new THREE.Mesh(innerRibGeo, eiffelIronMat);
      innerRib.position.set(0, vaultBaseY, rz);
      addPostPart(innerRib, 2, 0x1e293b);

      // Hai cột thép Gustave Eiffel mảnh đỡ chân vòm ở hai bên hành lang sảnh chính
      [-4.1, 4.1].forEach((cx) => {
        const ironCol = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7.2, 12), eiffelIronMat);
        ironCol.position.set(cx, baseY + 3.6, rz);
        addPostPart(ironCol, 1, 0x1e293b);
      });
    });

    // Các xà gồ thép dọc (Longitudinal Steel Purlins) nối liền các khung vòm Gustave Eiffel
    for (let i = 1; i <= 5; i++) {
      const ang = (i * Math.PI) / 6;
      const px = Math.cos(ang) * (vaultRadius - 0.3);
      const py = vaultBaseY + Math.sin(ang) * (vaultRadius - 0.3);
      const purlin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, vaultLen), eiffelIronMat);
      purlin.position.set(px, py, vaultCenterZ);
      addPostPart(purlin, 2, 0x222b34);
    }

    // =========================================================================
    // 6. HIỆU ỨNG AMBIENT OCCLUSION (AO) TẠI CHÂN TƯỜNG, GẦM MÁI HIÊN & CỘT ĐÈN
    // (Đặt cao độ tách biệt hoàn toàn để không bao giờ gây Z-fighting với sân & lối đi)
    // =========================================================================
    const groundContactAO = new THREE.Mesh(new THREE.BoxGeometry(32.0, 0.04, 19.1), aoShadowMat);
    groundContactAO.position.set(0, baseY + 0.08, -0.4);
    groundContactAO.userData.isGround = true;
    group.add(groundContactAO);

    // Bóng AO dưới gầm mái hiên sảnh chính (Canopy underside shadow)
    const underCanopyAO = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.35, 0.04), aoShadowMat);
    underCanopyAO.position.set(0, canopyY - 0.2, pavFrontZ + 0.06);
    underCanopyAO.userData.isGround = true;
    group.add(underCanopyAO);

    // Bóng AO tròn dưới chân 6 cột đèn chùm cổ điển (cao hơn mặt lối đi 0.07 đơn vị)
    [
      [-5.4, 13.8],
      [5.4, 13.8],
      [-7.6, 17.5],
      [7.6, 17.5],
      [-15.5, 18.2],
      [15.5, 18.2],
    ].forEach(([lx, lz]) => {
      const lampAO = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), aoShadowMat);
      lampAO.rotation.x = -Math.PI / 2;
      lampAO.position.set(lx, 0.43, lz);
      lampAO.userData.isGround = true;
      group.add(lampAO);
    });

    return null;

  } else if (siteId === 'HCM-DT-005') {
    // =========================================================================
    // NHÀ THỜ CHÍNH TÒA ĐỨC BÀ SÀI GÒN (NOTRE-DAME CATHEDRAL BASILICA OF SAIGON)
    // Kiến trúc Romanesque kết hợp Gothic cổ điển Pháp (KTS. Jules Bourard, 1877–1880,
    // bổ sung 2 chóp tháp chuông cao 60,5m năm 1895).
    // Đầy đủ 4 mặt chi tiết: Gạch Marseille đỏ cam đất nung (#B85238 / #9E3F28) nhám tự nhiên,
    // gờ chỉ & trụ tường đá trắng ngà (#DCD6CC), 2 Tháp chuông đôi 60m với cửa vòm đôi (bifora),
    // đồng hồ mặt tiền, lan can đá trắng & chóp bát giác bạc (#CBD5E1), Cửa sổ Hoa Hồng kính màu,
    // hàng vòm nhỏ (blind arcade), 3 cổng vòm Romanesque, Thân nhà thờ (Nave & Clerestory)
    // mái ngói đỏ 2 tầng, hệ trụ tường (buttresses) & cửa sổ vòm Gothic hai bên hông,
    // Hậu cung (Apse) bán nguyệt phía sau, Quảng trường Công xã Paris & Tượng Đức Mẹ Hòa Bình.
    // =========================================================================

    // -------------------------------------------------------------------------
    // 1. HỆ CHẤT LIỆU PBR THỰC TẾ KHỚP 100% ẢNH CHỤP CẬN CẢNH NGOÀI ĐỜI THỰC
    // - Tường gạch Marseille: Đỏ gạch nung trầm ấm (#9E4230 / #923B2A, roughness: 0.88, metalness: 0.02)
    // - Gờ chỉ, Con sơn, Khung vòm & Góc tường (Quoins/Trim): Đá cát nâu hồng trầm (#C49A84 / #B58973, roughness: 0.85)
    // - Chóp tháp (Spires): Tấm lợp xếp lớp ngang màu xám bạc ngả đá cổ kính (#BCC2C8 pha #8E969E, roughness: 0.65, metalness: 0.25)
    // - Mái ngói & Sống mái: Ngói đỏ đất nung trầm (#B55035), gờ sống mái màu ngói/đồng xám trầm (#7A5C52)
    // -------------------------------------------------------------------------
    const sharedBrickTex = getToulouseBrickTextures();
    const sharedRoofTileTex = getMarseilleRoofTileTextures();
    const sharedSpireStoneTex = getSpireFishscaleStoneTextures();
    const sharedLimestoneTex = getWeatheredLimestoneTextures();

    const ndTex = {
      marseilleBrickMap: sharedBrickTex.map,
      marseilleBrickBump: sharedBrickTex.bumpMap,
      roofTileMap: sharedRoofTileTex.map,
      roofTileBump: sharedRoofTileTex.bumpMap,
      zincSpireMap: sharedSpireStoneTex.map,
      stoneStuccoBump: sharedLimestoneTex.bumpMap,
    };

    // 1. Tường gạch Marseille đỏ gạch nung trầm ấm (#9E4230 / #923B2A, roughness: 0.88, metalness: 0.02)
    const marseilleBrickMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: sharedBrickTex.map,
      bumpMap: sharedBrickTex.bumpMap,
      bumpScale: 0.045,
      roughnessMap: sharedBrickTex.roughnessMap,
      roughness: 0.88,
      metalness: 0.02,
    });

    // 2. Gờ chỉ, Con sơn, Khung vòm & Góc tường (Quoins/Trim): Đá cát nâu hồng trầm (#C49A84 / #B58973, roughness: 0.85)
    const limestoneTrimMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: sharedLimestoneTex.map,
      bumpMap: sharedLimestoneTex.bumpMap,
      bumpScale: 0.038,
      roughnessMap: sharedLimestoneTex.roughnessMap,
      roughness: 0.85,
      metalness: 0.03,
    });

    // Viền tròn của Cửa sổ Hoa Hồng (Rose Window) & Cửa tròn Oculus: Đá cát nâu hồng trầm (#C49A84)
    const roseWindowStoneMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: sharedLimestoneTex.map,
      bumpMap: sharedLimestoneTex.bumpMap,
      bumpScale: 0.032,
      roughnessMap: sharedLimestoneTex.roughnessMap,
      roughness: 0.85,
      metalness: 0.03,
    });

    // Chân đế toàn bộ công trình tiếp giáp mặt sân: Đá xám sẫm (#64748B, roughness: 0.9, metalness: 0.02)
    const granitePlinthMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      bumpMap: sharedLimestoneTex.bumpMap,
      bumpScale: 0.045,
      roughness: 0.9,
      metalness: 0.02,
    });

    // 3. Chóp tháp chuông (Spires): Tấm lợp xếp lớp ngang màu xám bạc ngả đá cổ kính (#BCC2C8 pha #8E969E, roughness: 0.65, metalness: 0.25)
    const spireSilverSlateMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: sharedSpireStoneTex.map,
      bumpMap: sharedSpireStoneTex.bumpMap,
      bumpScale: 0.048,
      roughnessMap: sharedSpireStoneTex.roughnessMap,
      roughness: 0.65,
      metalness: 0.25,
    });

    // Đường gờ nổi 8 cạnh sườn chóp tháp, mấu móc (Crochets) & viền cửa thông gió Oculus (#9AA2AB)
    const spireRibMat = new THREE.MeshStandardMaterial({
      color: 0x9aa2ab,
      map: sharedSpireStoneTex.map,
      bumpMap: sharedSpireStoneTex.bumpMap,
      bumpScale: 0.03,
      roughness: 0.62,
      metalness: 0.28,
    });

    // Thánh giá kim loại tối màu (#26292E) trên đỉnh chóp bát giác & hàng lan can sắt mảnh (iron cresting) trên sống mái Lucarnes
    const darkIronCrossMat = new THREE.MeshStandardMaterial({
      color: 0x26292e,
      roughness: 0.45,
      metalness: 0.68,
    });

    // 4. Mái ngói đất nung trầm (#B55035, roughness: 0.78) & Gờ sống mái màu ngói/đồng xám trầm (#7A5C52)
    const cathedralRoofTileMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: sharedRoofTileTex.map,
      bumpMap: sharedRoofTileTex.bumpMap,
      bumpScale: 0.058,
      roughnessMap: sharedRoofTileTex.roughnessMap,
      roughness: 0.78,
      metalness: 0.04,
    });

    // Vật liệu gờ sống mái ngói/đồng xám trầm (#7A5C52) để không bị vệt trắng giả tạo trên đỉnh mái
    const roofRidgeMat = new THREE.MeshStandardMaterial({
      color: 0x7a5c52,
      bumpMap: sharedLimestoneTex.bumpMap,
      bumpScale: 0.03,
      roughness: 0.80,
      metalness: 0.08,
    });

    // Hệ lam chớp / lá sách cửa chớp vòm đôi lõm sâu trên tầng lầu chuông (#1e1e1e / #262a30)
    const whiteLouverMat = new THREE.MeshStandardMaterial({
      color: 0x24282e,
      bumpMap: sharedRoofTileTex.bumpMap,
      bumpScale: 0.04,
      roughness: 0.88,
      metalness: 0.08,
    });

    // Lá sách tối cho các tầng dưới (#1e1e1e, roughness: 0.9)
    const darkLouverMat = new THREE.MeshStandardMaterial({
      color: 0x1e1e1e,
      bumpMap: sharedRoofTileTex.bumpMap,
      bumpScale: 0.045,
      roughness: 0.9,
      metalness: 0.05,
    });

    // Hốc tường tối sâu (Recessed Dark Cavity #181a20) tạo chiều sâu tự nhiên cho vòm cửa
    const darkRecessCavityMat = new THREE.MeshStandardMaterial({
      color: 0x181a20,
      roughness: 0.92,
      metalness: 0.04,
    });

    // Kính tối sâu (#1a1d24, roughness: 0.4) bên trong hốc Cửa sổ Hoa Hồng, Cửa tròn Oculus & Cửa sổ vòm
    const stainedWindowGlassMat = new THREE.MeshStandardMaterial({
      color: 0x1a1d24,
      roughness: 0.4,
      metalness: 0.12,
    });

    // Đá cẩm thạch trắng ngà (#EAE4DC, roughness: 0.55, metalness: 0.02) cho Tượng Đức Mẹ Hòa Bình
    const peaceStatueMarbleMat = new THREE.MeshStandardMaterial({
      color: 0xeae4dc,
      bumpMap: sharedLimestoneTex.bumpMap,
      bumpScale: 0.008,
      roughness: 0.55,
      metalness: 0.02,
    });

    // Chi tiết đồng cổ cho quả cầu Tượng Đức Mẹ
    const goldBronzeMat = new THREE.MeshStandardMaterial({
      color: 0xc8963e,
      roughness: 0.35,
      metalness: 0.78,
    });

    // 5. Sân và quảng trường đá bê tông (roughness: 0.95, metalness: 0.0)
    const plazaPavingMat = new THREE.MeshStandardMaterial({
      color: 0x5c646e,
      bumpMap: sharedLimestoneTex.bumpMap,
      bumpScale: 0.04,
      roughness: 0.95,
      metalness: 0.0,
    });
    const plazaWalkwayMat = new THREE.MeshStandardMaterial({
      color: 0x7d858f,
      bumpMap: sharedLimestoneTex.bumpMap,
      bumpScale: 0.035,
      roughness: 0.95,
      metalness: 0.0,
    });
    const lawnGrassMat = new THREE.MeshStandardMaterial({
      color: 0x3b5e38,
      roughness: 0.9,
      metalness: 0.0,
    });

    // Vật liệu vệt tối Ambient Occlusion (AO) tại các góc kẽ, chân đế Plinth (#64748B) & dưới mép mái
    const aoCreviceMat = new THREE.MeshBasicMaterial({
      color: 0x090b10,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    // Helper gắn từng bộ phận vào group kèm metadata hỗ trợ Bóc tách tầng (Exploded View), Mặt cắt & X-Ray
    const addCathPart = (
      mesh: THREE.Mesh,
      tier: number,
      origHex: number,
      isGroundElement = false
    ) => {
      const resolvedHex =
        origHex === 0xc85534 || origHex === 0xc2593f || origHex === 0xa8442b || origHex === 0xa84830
          ? 0x9e4230
          : origHex === 0xa64225 || origHex === 0x9e3f28 || origHex === 0xad4c34 || origHex === 0x7d2f1d || origHex === 0x963d26
            ? 0x923b2a
            : origHex === 0xe07a38 || origHex === 0xd46548 || origHex === 0xb84a2c || origHex === 0xa93824 || origHex === 0xc85a32 || origHex === 0xb85238
              ? 0xb55035
              : origHex === 0xdcd6cc ||
                  origHex === 0xd8d0c5 ||
                  origHex === 0xc2b69d ||
                  origHex === 0xc2b29a ||
                  origHex === 0xd8cfc2 ||
                  origHex === 0xd8c3a5 ||
                  origHex === 0xdfc59e ||
                  origHex === 0xe2e8f0 ||
                  origHex === 0xcfc6b8 ||
                  origHex === 0xcbd5e1
                ? 0xc49a84
                : origHex === 0x94a3b8 || origHex === 0xe2e4e6
                  ? 0xbcc2c8
                  : origHex === 0x6e737b
                    ? 0x64748b
                    : origHex;
      mesh.castShadow = !isGroundElement;
      mesh.receiveShadow = true;
      mesh.userData.originalMaterial = mesh.material;
      if (isGroundElement) {
        mesh.userData.isGround = true;
      } else {
        mesh.userData.elevationTier = tier;
        mesh.userData.origY = mesh.position.y;
        mesh.userData.origColor = resolvedHex;
      }
      group.add(mesh);
      return mesh;
    };

    // Helper dựng mái dốc chữ A sắc cạnh (Crisp A-Frame Gable Roof) chạy dọc theo trục Z
    const buildGableRoofAlongZ = (
      width: number,
      ridgeHeight: number,
      length: number
    ): THREE.BufferGeometry => {
      const shape = new THREE.Shape();
      shape.moveTo(-width / 2, 0);
      shape.lineTo(0, ridgeHeight);
      shape.lineTo(width / 2, 0);
      shape.closePath();
      const rawGeo = new THREE.ExtrudeGeometry(shape, {
        depth: length,
        bevelEnabled: false,
      });
      rawGeo.translate(0, 0, -length / 2);
      const sharpGeo = rawGeo.toNonIndexed();
      sharpGeo.computeVertexNormals();
      rawGeo.dispose();
      return sharpGeo;
    };

    // Helper dựng mái dốc chữ A sắc cạnh chạy ngang theo trục X (cho Cánh ngang Transept giao cắt vuông góc)
    const buildGableRoofAlongX = (
      spanX: number,
      ridgeHeight: number,
      depthZ: number
    ): THREE.BufferGeometry => {
      const geo = buildGableRoofAlongZ(depthZ, ridgeHeight, spanX);
      geo.rotateY(Math.PI / 2);
      return geo;
    };

    // Helper dựng tường đầu hồi tam giác (Gable Pediment Wall) trên mặt phẳng XY
    const buildTriangularGableWallGeo = (
      width: number,
      height: number,
      thickness: number
    ): THREE.BufferGeometry => {
      const shape = new THREE.Shape();
      shape.moveTo(-width / 2, 0);
      shape.lineTo(0, height);
      shape.lineTo(width / 2, 0);
      shape.closePath();
      const rawGeo = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
      });
      rawGeo.translate(0, 0, -thickness / 2);
      const sharpGeo = rawGeo.toNonIndexed();
      sharpGeo.computeVertexNormals();
      rawGeo.dispose();
      return sharpGeo;
    };

    // =========================================================================
    // HELPER 1: CỬA SỔ HOA HỒNG 3D (3D STONE TRACERY ROSE WINDOW — XOÁ BỎ KÍNH CẦU VỒNG)
    // - Lõi bên trong là mặt kính tối sâu (#1a1d24, roughness: 0.4) lùi sâu vào trong hốc tường
    // - Phía ngoài là hệ nan hoa đá 3D (Stone Wheel Tracery): vành đá đồng tâm giật cấp +
    //   12 nan hoa trụ đá hướng tâm + vòng hoa thị đá vôi (#d8cfc2) sắc nét
    // =========================================================================
    const addRoseWindowAssembly = (
      cx: number,
      cy: number,
      cz: number,
      radius: number,
      facing: 'front' | 'left' | 'right',
      tier: number
    ) => {
      const rwGroup = new THREE.Group();
      rwGroup.position.set(cx, cy, cz);
      if (facing === 'left') rwGroup.rotation.y = -Math.PI / 2;
      else if (facing === 'right') rwGroup.rotation.y = Math.PI / 2;

      // 1. Lõi mặt kính tối sâu (#1a1d24, roughness: 0.4) đặt lùi vào trong hốc cửa
      const glassDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, 0.08, 36),
        stainedWindowGlassMat
      );
      glassDisc.rotation.x = Math.PI / 2;
      glassDisc.position.set(0, 0, 0.01);
      rwGroup.add(glassDisc);

      // 2. Vành khung đá vôi (#d8cfc2) giật cấp 3 tầng tạo độ sâu hốc cửa (Stepped Recessed Stone Voussoirs)
      [
        { r: radius + 0.16, tube: 0.13, zOff: 0.15 },
        { r: radius + 0.02, tube: 0.09, zOff: 0.11 },
        { r: radius * 0.58, tube: 0.052, zOff: 0.08 },
        { r: radius * 0.25, tube: 0.048, zOff: 0.09 },
      ].forEach((ring) => {
        const torus = new THREE.Mesh(
          new THREE.TorusGeometry(ring.r, ring.tube, 14, 36),
          roseWindowStoneMat
        );
        torus.position.set(0, 0, ring.zOff);
        rwGroup.add(torus);
      });

      // 3. 12 Nan hoa trụ đá hướng tâm (12 Radial Stone Colonnette Spokes) & vòng hoa văn đá (Stone Tracery Foils)
      const spokeCount = 12;
      const spokeLen = radius * 0.68;
      for (let s = 0; s < spokeCount; s++) {
        const ang = (s * Math.PI) / 6;
        const midR = radius * 0.25 + spokeLen / 2;
        const spoke = new THREE.Mesh(
          new THREE.CylinderGeometry(radius * 0.022, radius * 0.026, spokeLen, 8),
          roseWindowStoneMat
        );
        spoke.position.set(Math.cos(ang) * midR, Math.sin(ang) * midR, 0.085);
        spoke.rotation.z = ang - Math.PI / 2;
        rwGroup.add(spoke);

        // Vòng tròn hoa văn đá nhỏ (Stone Foil Rosette) giữa các đầu nan hoa
        const foilAng = ang + Math.PI / 12;
        const foilR = radius * 0.76;
        const foilRing = new THREE.Mesh(
          new THREE.TorusGeometry(radius * 0.095, radius * 0.022, 8, 18),
          roseWindowStoneMat
        );
        foilRing.position.set(Math.cos(foilAng) * foilR, Math.sin(foilAng) * foilR, 0.085);
        rwGroup.add(foilRing);
      }

      rwGroup.updateMatrixWorld(true);
      const children = [...rwGroup.children] as THREE.Mesh[];
      children.forEach((child) => {
        const wPos = new THREE.Vector3();
        const wQuat = new THREE.Quaternion();
        child.getWorldPosition(wPos);
        child.getWorldQuaternion(wQuat);
        rwGroup.remove(child);
        child.position.copy(wPos);
        child.quaternion.copy(wQuat);
        const isGlass = child.material === stainedWindowGlassMat;
        addCathPart(child, tier, isGlass ? 0x1a1d24 : 0xd8cfc2);
      });
    };

    // =========================================================================
    // HELPER 2: CỬA TRÒN NHỎ (OCULUS ROUND WINDOW — XOÁ BỎ CHỮ THẬP TRẮNG HOẠT HÌNH)
    // - Thay bằng khung viền đá tròn âm sâu vào tường (#d8cfc2), bên trong là kính tối (#1a1d24)
    //   và hệ 6 nan hoa tròn mảnh hướng tâm bằng đá vôi chuẩn kiến trúc thực tế
    // =========================================================================
    const addOculusRoundWindow = (
      cx: number,
      cy: number,
      cz: number,
      radius: number,
      facing: 'front' | 'back' | 'left' | 'right' | number,
      tier: number,
      customFrameMat?: THREE.MeshStandardMaterial,
      customFrameHex?: number
    ) => {
      const frameMatToUse = customFrameMat ?? roseWindowStoneMat;
      const frameHexToUse = customFrameHex ?? 0xd8cfc2;

      const ocGroup = new THREE.Group();
      ocGroup.position.set(cx, cy, cz);
      if (typeof facing === 'number') ocGroup.rotation.y = facing;
      else if (facing === 'back') ocGroup.rotation.y = Math.PI;
      else if (facing === 'left') ocGroup.rotation.y = -Math.PI / 2;
      else if (facing === 'right') ocGroup.rotation.y = Math.PI / 2;

      // Vành khung đá giật cấp 2 vòng tạo độ sâu hốc cửa tròn
      const outerStoneFrame = new THREE.Mesh(
        new THREE.TorusGeometry(radius + 0.04, 0.085, 14, 28),
        frameMatToUse
      );
      outerStoneFrame.position.set(0, 0, 0.09);
      ocGroup.add(outerStoneFrame);

      const innerStoneFrame = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.82, 0.048, 12, 24),
        frameMatToUse
      );
      innerStoneFrame.position.set(0, 0, 0.055);
      ocGroup.add(innerStoneFrame);

      const centerRing = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.30, 0.036, 10, 20),
        frameMatToUse
      );
      centerRing.position.set(0, 0, 0.055);
      ocGroup.add(centerRing);

      // Lõi kính tối sâu (#1a1d24) đặt lùi phía sau khung đá
      const glassPane = new THREE.Mesh(
        new THREE.CylinderGeometry(radius - 0.02, radius - 0.02, 0.05, 24),
        stainedWindowGlassMat
      );
      glassPane.rotation.x = Math.PI / 2;
      glassPane.position.set(0, 0, 0.015);
      ocGroup.add(glassPane);

      // 6 Nan hoa đá tròn mảnh hướng tâm (thay thế hoàn toàn chữ thập trắng)
      const spokeLen = radius * 0.54;
      for (let s = 0; s < 6; s++) {
        const rot = (s * Math.PI) / 3;
        const midR = radius * 0.28 + spokeLen / 2;
        const spoke = new THREE.Mesh(
          new THREE.CylinderGeometry(radius * 0.036, radius * 0.038, spokeLen, 8),
          frameMatToUse
        );
        spoke.position.set(Math.cos(rot) * midR, Math.sin(rot) * midR, 0.055);
        spoke.rotation.z = rot - Math.PI / 2;
        ocGroup.add(spoke);
      }

      ocGroup.updateMatrixWorld(true);
      const children = [...ocGroup.children] as THREE.Mesh[];
      children.forEach((child) => {
        const wPos = new THREE.Vector3();
        const wQuat = new THREE.Quaternion();
        child.getWorldPosition(wPos);
        child.getWorldQuaternion(wQuat);
        ocGroup.remove(child);
        child.position.copy(wPos);
        child.quaternion.copy(wQuat);
        const isGlass = child.material === stainedWindowGlassMat;
        addCathPart(child, tier, isGlass ? 0x1a1d24 : frameHexToUse);
      });
    };

    // Alias chuẩn cho vật liệu đá trắng xám & đá vảy cá chóp tháp
    const limestoneMat = limestoneTrimMat;
    const spireStoneMat = spireSilverSlateMat;

    // Helper tạo hình vòm rỗng 3D (Hollow Semicircular Arch Ring) không bị chồng mặt phẳng với mặt kính bên trong
    const buildHollowArchRingGeo = (
      innerR: number,
      outerR: number,
      depth: number,
      segments = 24
    ): THREE.BufferGeometry => {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, outerR, 0, Math.PI, false);
      shape.lineTo(-innerR, 0);
      shape.absarc(0, 0, innerR, Math.PI, 0, true);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: false,
        curveSegments: segments,
      });
      geo.translate(0, 0, -depth / 2);
      return geo;
    };

    // Helper tạo mặt kính/lá sách bán nguyệt phẳng sạch bên trong vòm cửa
    const buildFilledSemicircleGeo = (
      radius: number,
      depth: number,
      segments = 24
    ): THREE.BufferGeometry => {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, radius, 0, Math.PI, false);
      shape.lineTo(-radius, 0);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: false,
        curveSegments: segments,
      });
      geo.translate(0, 0, -depth / 2);
      return geo;
    };

    // =========================================================================
    // HELPER 3: VÒM CỬA ROMANESQUE CÓ ĐỘ SÂU HỐC TƯỜNG (3D RECESSED ARCHED OPENING)
    // - Hỗ trợ cả 4 hướng trực giao ('front' | 'back' | 'left' | 'right') và góc xoay bất kỳ (number)
    //   cho các mặt đa giác của Hậu cung mà KHÔNG bao giờ bị xoắn trục Euler hay Z-fighting
    // =========================================================================
    const addArchedOpening = (
      cx: number,
      baseY: number,
      cz: number,
      w: number,
      rectH: number,
      depth: number,
      facing: 'front' | 'back' | 'left' | 'right' | number,
      fillMat: THREE.MeshStandardMaterial,
      fillHex: number,
      tier: number,
      withCenterMullion = false,
      customFrameMat: THREE.MeshStandardMaterial = limestoneMat,
      customFrameHex = 0xd8cfc2
    ) => {
      const winGroup = new THREE.Group();
      winGroup.position.set(cx, baseY, cz);
      if (typeof facing === 'number') {
        winGroup.rotation.y = facing;
      } else if (facing === 'back') {
        winGroup.rotation.y = Math.PI;
      } else if (facing === 'left') {
        winGroup.rotation.y = -Math.PI / 2;
      } else if (facing === 'right') {
        winGroup.rotation.y = Math.PI / 2;
      }

      const archR = w / 2;
      const borderW = 0.088;
      const frameProject = Math.max(depth, 0.16);

      // 1. Hai trụ viền đá vôi nổi khối 3D hai bên cửa
      [-1, 1].forEach((s) => {
        const jamb = new THREE.Mesh(
          new THREE.BoxGeometry(borderW, rectH, frameProject),
          customFrameMat
        );
        jamb.position.set(s * (archR + borderW / 2), rectH / 2, frameProject * 0.5);
        winGroup.add(jamb);
      });

      // 2. Bệ cửa sổ đá (Stone Sill) nhô ra ngoài tạo bóng đổ dưới chân cửa
      const sill = new THREE.Mesh(
        new THREE.BoxGeometry(w + borderW * 2 + 0.10, 0.11, frameProject * 1.15),
        customFrameMat
      );
      sill.position.set(0, -0.055, frameProject * 0.52);
      winGroup.add(sill);

      // 3. Vòm cuốn đá rỗng (Hollow Romanesque Stone Archivolt) phía trên, không đè lên mặt kính
      const archTrim = new THREE.Mesh(
        buildHollowArchRingGeo(archR, archR + borderW, frameProject, 22),
        customFrameMat
      );
      archTrim.position.set(0, rectH, frameProject * 0.5);
      winGroup.add(archTrim);

      // 4. Lõi mặt kính / lá sách đặt lùi vào trong khung đá (z = 0.035) để không trùng mặt phẳng tường (z = 0)
      const innerDepth = 0.05;
      const innerRect = new THREE.Mesh(
        new THREE.BoxGeometry(w, rectH, innerDepth),
        fillMat
      );
      innerRect.position.set(0, rectH / 2, 0.035);
      winGroup.add(innerRect);

      const innerArch = new THREE.Mesh(
        buildFilledSemicircleGeo(archR, innerDepth, 20),
        fillMat
      );
      innerArch.position.set(0, rectH, 0.035);
      winGroup.add(innerArch);

      // Nếu là cửa chớp vòm trên tháp chuông: gắn hệ lá sách cửa chớp nghiêng bên trong hốc vòm
      if (fillMat === whiteLouverMat || fillMat === darkLouverMat) {
        const slatCount = 7;
        for (let sl = 1; sl <= slatCount; sl++) {
          const sy = (rectH / (slatCount + 1)) * sl;
          const slat = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.92, 0.05, 0.08),
            darkLouverMat
          );
          slat.rotation.x = 0.28;
          slat.position.set(0, sy, 0.075);
          winGroup.add(slat);
        }
      }

      if (withCenterMullion) {
        const mullion = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, rectH + archR * 0.92, 0.07),
          customFrameMat
        );
        mullion.position.set(0, (rectH + archR * 0.92) / 2, 0.085);
        winGroup.add(mullion);

        const transom = new THREE.Mesh(
          new THREE.BoxGeometry(w, 0.055, 0.07),
          customFrameMat
        );
        transom.position.set(0, rectH, 0.085);
        winGroup.add(transom);
      }

      winGroup.updateMatrixWorld(true);
      const children = [...winGroup.children] as THREE.Mesh[];
      children.forEach((child) => {
        const wPos = new THREE.Vector3();
        const wQuat = new THREE.Quaternion();
        child.getWorldPosition(wPos);
        child.getWorldQuaternion(wQuat);
        winGroup.remove(child);
        child.position.copy(wPos);
        child.quaternion.copy(wQuat);
        const m = child.material as THREE.MeshStandardMaterial;
        addCathPart(child, tier, m === fillMat ? fillHex : customFrameHex);
      });
    };

    // =========================================================================
    // 2. QUẢNG TRƯỜNG CÔNG XÃ PARIS, VỈA HÈ BO TRÒN VÒNG CUNG HẬU CUNG & TƯỢNG ĐỨC MẸ HÒA BÌNH
    // =========================================================================
    const baseY = 0.32;

    // Helper dựng tấm nền khuôn viên có phần đuôi bo tròn bán nguyệt ôm theo vòng bùng binh phía sau Hậu cung
    const buildRoundedRearPlazaGeo = (halfW: number, frontZ: number, arcCenterZ: number, height: number) => {
      const shape = new THREE.Shape();
      // Trong hệ tọa độ Shape trước khi rotateX(-Math.PI / 2): x_shape = X_world, y_shape = -Z_world
      const yFront = -frontZ;
      const yArc = -arcCenterZ;
      shape.moveTo(-halfW, yFront);
      shape.lineTo(halfW, yFront);
      shape.lineTo(halfW, yArc);
      shape.absarc(0, yArc, halfW, 0, Math.PI, false);
      shape.lineTo(-halfW, yFront);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: false,
        curveSegments: 48,
      });
      geo.rotateX(-Math.PI / 2);
      return geo;
    };

    // Nền khuôn viên lát đá xám rộng rãi, bo tròn bán nguyệt ở phía đuôi Hậu cung (tâm z = -19.70, bán kính 19.0m)
    const plazaPlatform = new THREE.Mesh(
      buildRoundedRearPlazaGeo(19.0, 27.5, -19.70, 0.32),
      plazaPavingMat
    );
    plazaPlatform.position.set(0, 0.0, 0);
    addCathPart(plazaPlatform, 0, 0x5c646e, true);

    // Viền bó vỉa đá xám sáng bao quanh khuôn viên (thấp hơn mặt sân 0.04m để không trùng mặt phẳng)
    const plazaCurb = new THREE.Mesh(
      buildRoundedRearPlazaGeo(19.35, 27.85, -19.70, 0.24),
      plazaWalkwayMat
    );
    plazaCurb.position.set(0, 0.0, 0);
    addCathPart(plazaCurb, 0, 0x7d858f, true);

    // Lối dạo lát đá xám sáng dẫn từ quảng trường phía trước vào 3 cổng vòm mặt tiền
    const frontEsplanade = new THREE.Mesh(
      new THREE.BoxGeometry(20.4, 0.04, 15.0),
      plazaWalkwayMat
    );
    frontEsplanade.position.set(0, baseY + 0.02, 16.5);
    addCathPart(frontEsplanade, 0, 0x7d858f, true);

    // Vỉa hè lát đá sáng chạy dọc hai bên hông và BO TRÒN ÔM SÁT ĐƯỜNG CONG VÒNG CUNG CỦA 5 NHÀ NGUYỆN PHÍA SAU
    // giống hệt vòng xoay / bùng binh ngoài đời thực (bán kính trong 12.15m, bán kính ngoài 15.25m quanh tâm Hậu cung z = -19.70)
    const rearWalkCenterZ = -19.70;
    const walkInnerR = 12.15;
    const walkOuterR = 15.25;
    const walkWidth = walkOuterR - walkInnerR; // 3.10m
    const walkMidX = (walkInnerR + walkOuterR) / 2; // 13.70m
    const straightWalkStartZ = 13.50;
    const straightWalkLen = straightWalkStartZ - rearWalkCenterZ; // 33.20m
    const straightWalkMidZ = (straightWalkStartZ + rearWalkCenterZ) / 2; // -3.10m

    [-1, 1].forEach((side) => {
      const sideWalk = new THREE.Mesh(
        new THREE.BoxGeometry(walkWidth, 0.045, straightWalkLen),
        plazaWalkwayMat
      );
      sideWalk.position.set(side * walkMidX, baseY + 0.022, straightWalkMidZ);
      addCathPart(sideWalk, 0, 0x7d858f, true);
    });

    // Đoạn vỉa hè cong bán nguyệt phía sau ôm trọn vòng 5 nhà nguyện đa giác (từ góc 0 đến PI ở phía -Z)
    const rearCurvedWalkShape = new THREE.Shape();
    rearCurvedWalkShape.absarc(0, 0, walkOuterR, 0, Math.PI, false);
    rearCurvedWalkShape.lineTo(-walkInnerR, 0);
    rearCurvedWalkShape.absarc(0, 0, walkInnerR, Math.PI, 0, true);
    rearCurvedWalkShape.closePath();

    const rearCurvedWalkGeo = new THREE.ExtrudeGeometry(rearCurvedWalkShape, {
      depth: 0.045,
      bevelEnabled: false,
      curveSegments: 64,
    });
    rearCurvedWalkGeo.rotateX(-Math.PI / 2);

    const rearCurvedWalk = new THREE.Mesh(rearCurvedWalkGeo, plazaWalkwayMat);
    rearCurvedWalk.position.set(0, baseY + 0.001, rearWalkCenterZ);
    addCathPart(rearCurvedWalk, 0, 0x7d858f, true);

    // Gờ bó vỉa hè bằng đá sáng (Curbstone ring) ở mép ngoài và mép trong vòng cung vỉa hè phía sau
    [walkInnerR - 0.08, walkOuterR + 0.08].forEach((curbR) => {
      const curbRingShape = new THREE.Shape();
      curbRingShape.absarc(0, 0, curbR + 0.09, 0, Math.PI, false);
      curbRingShape.lineTo(-(curbR - 0.09), 0);
      curbRingShape.absarc(0, 0, curbR - 0.09, Math.PI, 0, true);
      curbRingShape.closePath();

      const curbRingGeo = new THREE.ExtrudeGeometry(curbRingShape, {
        depth: 0.075,
        bevelEnabled: false,
        curveSegments: 64,
      });
      curbRingGeo.rotateX(-Math.PI / 2);

      const curbRingMesh = new THREE.Mesh(curbRingGeo, limestoneMat);
      curbRingMesh.position.set(0, baseY + 0.002, rearWalkCenterZ);
      addCathPart(curbRingMesh, 0, 0xd8cfc2, true);
    });

    // Các mạch gạch lát đá hướng tâm (Radial paving joints) trên vỉa hè vòng cung phía sau tạo cảm giác vỉa hè bùng binh chân thực
    for (let rIdx = 1; rIdx < 15; rIdx++) {
      const ang = (rIdx / 15) * Math.PI;
      const midR = (walkInnerR + walkOuterR) / 2;
      const jointBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.052, walkWidth - 0.16),
        limestoneMat
      );
      jointBar.position.set(
        Math.cos(ang) * midR,
        baseY + 0.026,
        rearWalkCenterZ - Math.sin(ang) * midR
      );
      jointBar.rotation.y = Math.PI / 2 - ang;
      addCathPart(jointBar, 0, 0xd8cfc2, true);
    }

    // =========================================================================
    // 2B. BỒN HOA QUẢNG TRƯỜNG CÔNG XÃ PARIS, HÀNG RÀO SẮT BẢO VỆ & TƯỢNG ĐỨC MẸ HÒA BÌNH (REGINA PACIS 1959)
    // =========================================================================
    const gardenZ = 19.0;
    const ovalScaleX = 1.28;
    const ovalScaleZ = 0.88;

    const pedestalStepStoneMat = new THREE.MeshStandardMaterial({
      color: 0xc2b29a,
      bumpMap: ndTex.stoneStuccoBump,
      bumpScale: 0.025,
      roughness: 0.9,
      metalness: 0.02,
    });

    const washedStonePedestalMat = new THREE.MeshStandardMaterial({
      color: 0xcfc6b8,
      bumpMap: ndTex.stoneStuccoBump,
      bumpScale: 0.03,
      roughness: 0.88,
      metalness: 0.02,
    });

    const reginaPacisPlaqueMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.38,
      metalness: 0.5,
    });

    const wroughtIronFenceMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.45,
    });

    const ovalCurbOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(4.42, 4.52, 0.22, 48),
      pedestalStepStoneMat
    );
    ovalCurbOuter.scale.set(ovalScaleX, 1, ovalScaleZ);
    ovalCurbOuter.position.set(0, baseY + 0.11, gardenZ);
    addCathPart(ovalCurbOuter, 0, 0xc2b29a, true);

    const ovalGrassLawn = new THREE.Mesh(
      new THREE.CylinderGeometry(4.15, 4.15, 0.24, 48),
      lawnGrassMat
    );
    ovalGrassLawn.scale.set(ovalScaleX, 1, ovalScaleZ);
    ovalGrassLawn.position.set(0, baseY + 0.13, gardenZ);
    addCathPart(ovalGrassLawn, 0, 0x235c30, true);

    // Hàng rào sắt thấp bảo vệ xung quanh viền ngoài bồn cỏ
    const fenceHeight = 0.35;
    const fenceBaseY = baseY + 0.22;
    const fenceRadius = 4.32;

    [fenceBaseY + 0.07, fenceBaseY + fenceHeight - 0.05].forEach((railY) => {
      const fenceRail = new THREE.Mesh(
        new THREE.TorusGeometry(fenceRadius, 0.018, 8, 64),
        wroughtIronFenceMat
      );
      fenceRail.rotation.x = Math.PI / 2;
      fenceRail.scale.set(ovalScaleX, ovalScaleZ, 1);
      fenceRail.position.set(0, railY, gardenZ);
      addCathPart(fenceRail, 0, 0x1e293b, true);
    });

    const fenceBarCount = 64;
    for (let b = 0; b < fenceBarCount; b++) {
      const ang = (b * Math.PI * 2) / fenceBarCount;
      const bx = Math.cos(ang) * fenceRadius * ovalScaleX;
      const bz = gardenZ + Math.sin(ang) * fenceRadius * ovalScaleZ;
      const isMainPost = b % 8 === 0;
      const barR = isMainPost ? 0.026 : 0.014;
      const barH = isMainPost ? fenceHeight + 0.05 : fenceHeight;

      const verticalBar = new THREE.Mesh(
        new THREE.CylinderGeometry(barR, barR, barH, 6),
        wroughtIronFenceMat
      );
      verticalBar.position.set(bx, fenceBaseY + barH / 2, bz);
      addCathPart(verticalBar, 0, 0x1e293b, true);

      const barTip = new THREE.Mesh(
        new THREE.ConeGeometry(barR * 1.45, 0.055, 4),
        wroughtIronFenceMat
      );
      barTip.position.set(bx, fenceBaseY + barH + 0.025, bz);
      addCathPart(barTip, 0, 0x1e293b, true);
    }

    // Các khóm hoa cảnh nhiều màu sắc xếp đồng tâm đối xứng trong bồn cỏ
    const flowerPaletteMats = [
      { mat: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.9, metalness: 0.0 }), hex: 0xef4444 },
      { mat: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.9, metalness: 0.0 }), hex: 0xfacc15 },
      { mat: new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.9, metalness: 0.0 }), hex: 0xa855f7 },
      { mat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.88, metalness: 0.0 }), hex: 0xf8fafc },
    ];

    [
      { count: 16, rBase: 2.15, bushR: 0.22 },
      { count: 24, rBase: 3.25, bushR: 0.25 },
    ].forEach((ring, ringIdx) => {
      for (let f = 0; f < ring.count; f++) {
        const ang = (f * Math.PI * 2) / ring.count + (ringIdx % 2) * (Math.PI / ring.count);
        const fx = Math.cos(ang) * ring.rBase * ovalScaleX;
        const fz = gardenZ + Math.sin(ang) * ring.rBase * ovalScaleZ;

        const foliageCushion = new THREE.Mesh(
          new THREE.SphereGeometry(ring.bushR, 10, 8),
          lawnGrassMat
        );
        foliageCushion.scale.set(1.25, 0.55, 1.25);
        foliageCushion.position.set(fx, baseY + 0.26, fz);
        addCathPart(foliageCushion, 0, 0x235c30, true);

        const flColor = flowerPaletteMats[(f + ringIdx * 2) % flowerPaletteMats.length];
        const blossomCluster = new THREE.Mesh(
          new THREE.SphereGeometry(ring.bushR * 0.78, 10, 8),
          flColor.mat
        );
        blossomCluster.scale.set(1.15, 0.65, 1.15);
        blossomCluster.position.set(fx, baseY + 0.34, fz);
        addCathPart(blossomCluster, 0, flColor.hex, true);
      }
    });

    // Bệ đá lăng trụ tứ giác & Tượng Đức Mẹ Hòa Bình (Regina Pacis 1959)
    [
      { w: 2.32, h: 0.20, d: 2.32, y: baseY + 0.35 },
      { w: 1.84, h: 0.20, d: 1.84, y: baseY + 0.55 },
      { w: 1.38, h: 0.22, d: 1.38, y: baseY + 0.76 },
    ].forEach((step) => {
      const pedStep = new THREE.Mesh(
        new THREE.BoxGeometry(step.w, step.h, step.d),
        pedestalStepStoneMat
      );
      pedStep.position.set(0, step.y, gardenZ);
      addCathPart(pedStep, 1, 0xcbd5e1);
    });

    const shaftBaseMoldingLower = new THREE.Mesh(
      new THREE.BoxGeometry(1.06, 0.16, 1.06),
      washedStonePedestalMat
    );
    shaftBaseMoldingLower.position.set(0, baseY + 0.95, gardenZ);
    addCathPart(shaftBaseMoldingLower, 1, 0xe2e8f0);

    const shaftBaseMoldingUpper = new THREE.Mesh(
      new THREE.BoxGeometry(0.94, 0.12, 0.94),
      washedStonePedestalMat
    );
    shaftBaseMoldingUpper.position.set(0, baseY + 1.09, gardenZ);
    addCathPart(shaftBaseMoldingUpper, 1, 0xe2e8f0);

    const shaftW = 0.80;
    const shaftH = 2.48;
    const shaftCenterY = baseY + 1.15 + shaftH / 2;
    const pedestalShaft = new THREE.Mesh(
      new THREE.BoxGeometry(shaftW, shaftH, shaftW),
      washedStonePedestalMat
    );
    pedestalShaft.position.set(0, shaftCenterY, gardenZ);
    addCathPart(pedestalShaft, 1, 0xe2e8f0);

    [-1, 1].forEach((sx) => {
      [-1, 1].forEach((sz) => {
        const cornerStrip = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, shaftH - 0.12, 0.08),
          washedStonePedestalMat
        );
        cornerStrip.position.set(
          sx * (shaftW / 2 - 0.01),
          shaftCenterY,
          gardenZ + sz * (shaftW / 2 - 0.01)
        );
        addCathPart(cornerStrip, 1, 0xe2e8f0);
      });
    });

    const shaftTopNecking = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.11, 0.92),
      washedStonePedestalMat
    );
    shaftTopNecking.position.set(0, baseY + 3.685, gardenZ);
    addCathPart(shaftTopNecking, 1, 0xe2e8f0);

    const shaftTopCornice = new THREE.Mesh(
      new THREE.BoxGeometry(1.04, 0.15, 1.04),
      washedStonePedestalMat
    );
    shaftTopCornice.position.set(0, baseY + 3.815, gardenZ);
    addCathPart(shaftTopCornice, 1, 0xe2e8f0);

    const shaftTopAbacus = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.10, 0.86),
      washedStonePedestalMat
    );
    shaftTopAbacus.position.set(0, baseY + 3.94, gardenZ);
    addCathPart(shaftTopAbacus, 1, 0xe2e8f0);

    const plaqueY = shaftCenterY + 0.18;
    const plaqueZ = gardenZ + shaftW / 2 + 0.025;
    const reginaPacisPlaque = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.86, 0.036),
      reginaPacisPlaqueMat
    );
    reginaPacisPlaque.position.set(0, plaqueY, plaqueZ);
    addCathPart(reginaPacisPlaque, 1, 0x64748b);

    [0.24, 0.12, -0.06, -0.18].forEach((lineOff, lIdx) => {
      const textLine = new THREE.Mesh(
        new THREE.BoxGeometry(lIdx < 2 ? 0.30 : 0.22, 0.028, 0.016),
        peaceStatueMarbleMat
      );
      textLine.position.set(0, plaqueY + lineOff, plaqueZ + 0.024);
      addCathPart(textLine, 1, 0xf8fafc);
    });

    const statueBaseY = baseY + 3.99;

    const cloudMain = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 20, 16),
      peaceStatueMarbleMat
    );
    cloudMain.scale.set(1.06, 0.38, 1.02);
    cloudMain.position.set(0, statueBaseY + 0.12, gardenZ);
    addCathPart(cloudMain, 1, 0xf8fafc);

    [
      [-0.22, 0.09, 0.14, 0.16],
      [0.22, 0.09, 0.14, 0.16],
      [0, 0.10, 0.22, 0.15],
      [-0.18, 0.09, -0.16, 0.15],
      [0.18, 0.09, -0.16, 0.15],
    ].forEach(([cx, cy, cz, cr]) => {
      const cloudPuff = new THREE.Mesh(
        new THREE.SphereGeometry(cr, 12, 10),
        peaceStatueMarbleMat
      );
      cloudPuff.scale.set(1.15, 0.62, 1.1);
      cloudPuff.position.set(cx, statueBaseY + cy, gardenZ + cz);
      addCathPart(cloudPuff, 1, 0xf8fafc);
    });

    const tunicLower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.33, 1.32, 24),
      peaceStatueMarbleMat
    );
    tunicLower.scale.set(1.04, 1, 0.88);
    tunicLower.position.set(0, statueBaseY + 0.84, gardenZ);
    addCathPart(tunicLower, 1, 0xf8fafc);

    const tunicUpperTorso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.20, 0.62, 20),
      peaceStatueMarbleMat
    );
    tunicUpperTorso.scale.set(1.08, 1, 0.84);
    tunicUpperTorso.position.set(0, statueBaseY + 1.68, gardenZ);
    addCathPart(tunicUpperTorso, 1, 0xf8fafc);

    const shouldersMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 18, 14),
      peaceStatueMarbleMat
    );
    shouldersMesh.scale.set(1.16, 0.48, 0.78);
    shouldersMesh.position.set(0, statueBaseY + 1.94, gardenZ - 0.01);
    addCathPart(shouldersMesh, 1, 0xf8fafc);

    [-0.18, -0.10, -0.03, 0.04, 0.11, 0.18].forEach((foldX, fIdx) => {
      const foldZ = gardenZ + (fIdx === 0 || fIdx === 5 ? 0.04 : 0.16);
      const foldH = fIdx === 0 || fIdx === 5 ? 1.56 : 1.28;
      const foldR = fIdx === 0 || fIdx === 5 ? 0.052 : 0.032;
      const pleat = new THREE.Mesh(
        new THREE.CylinderGeometry(foldR * 0.72, foldR, foldH, 10),
        peaceStatueMarbleMat
      );
      pleat.position.set(foldX, statueBaseY + 0.22 + foldH / 2, foldZ);
      pleat.rotation.z = -foldX * 0.18;
      addCathPart(pleat, 1, 0xf8fafc);
    });

    const backMantle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 1.68, 18),
      peaceStatueMarbleMat
    );
    backMantle.scale.set(1.08, 1, 0.65);
    backMantle.position.set(0, statueBaseY + 1.06, gardenZ - 0.08);
    addCathPart(backMantle, 1, 0xf8fafc);

    [-1, 1].forEach((sideS) => {
      const upperArm = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.058, 0.26, 8, 12),
        peaceStatueMarbleMat
      );
      upperArm.position.set(sideS * 0.23, statueBaseY + 1.76, gardenZ + 0.04);
      upperArm.rotation.z = -sideS * 0.18;
      upperArm.rotation.x = 0.35;
      addCathPart(upperArm, 1, 0xf8fafc);

      const forearmSleeve = new THREE.Mesh(
        new THREE.ConeGeometry(0.088, 0.34, 12),
        peaceStatueMarbleMat
      );
      forearmSleeve.position.set(sideS * 0.15, statueBaseY + 1.66, gardenZ + 0.17);
      forearmSleeve.rotation.x = -Math.PI / 2.6;
      forearmSleeve.rotation.z = sideS * 0.42;
      addCathPart(forearmSleeve, 1, 0xf8fafc);

      const handMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.042, 10, 10),
        peaceStatueMarbleMat
      );
      handMesh.scale.set(0.85, 0.65, 1.35);
      handMesh.position.set(sideS * 0.085, statueBaseY + 1.68, gardenZ + 0.27);
      addCathPart(handMesh, 1, 0xf8fafc);
    });

    const globeY = statueBaseY + 1.77;
    const globeZ = gardenZ + 0.29;
    const peaceGlobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.125, 20, 20),
      peaceStatueMarbleMat
    );
    peaceGlobe.position.set(0, globeY, globeZ);
    addCathPart(peaceGlobe, 1, 0xf8fafc);

    const globeEquatorialBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.127, 0.008, 8, 24),
      goldBronzeMat
    );
    globeEquatorialBand.rotation.x = Math.PI / 2;
    globeEquatorialBand.position.set(0, globeY, globeZ);
    addCathPart(globeEquatorialBand, 1, 0xd97706);

    const globeCrossV = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.17, 0.024),
      goldBronzeMat
    );
    globeCrossV.position.set(0, globeY + 0.125 + 0.08, globeZ);
    addCathPart(globeCrossV, 1, 0xd97706);

    const globeCrossH = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.024, 0.024),
      goldBronzeMat
    );
    globeCrossH.position.set(0, globeY + 0.125 + 0.105, globeZ);
    addCathPart(globeCrossH, 1, 0xd97706);

    const statueNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.082, 0.16, 14),
      peaceStatueMarbleMat
    );
    statueNeck.position.set(0, statueBaseY + 2.04, gardenZ + 0.01);
    addCathPart(statueNeck, 1, 0xf8fafc);

    const headY = statueBaseY + 2.21;
    const statueHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.155, 20, 20),
      peaceStatueMarbleMat
    );
    statueHead.scale.set(0.90, 1.10, 0.95);
    statueHead.position.set(0, headY, gardenZ + 0.02);
    addCathPart(statueHead, 1, 0xf8fafc);

    const veilCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.168, 18, 16),
      peaceStatueMarbleMat
    );
    veilCrown.scale.set(0.96, 1.12, 1.04);
    veilCrown.position.set(0, headY + 0.02, gardenZ - 0.015);
    addCathPart(veilCrown, 1, 0xf8fafc);

    const veilBackDrape = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.68, 16),
      peaceStatueMarbleMat
    );
    veilBackDrape.scale.set(1.05, 1, 0.72);
    veilBackDrape.position.set(0, headY - 0.18, gardenZ - 0.06);
    addCathPart(veilBackDrape, 1, 0xf8fafc);

    [-1, 1].forEach((sideS) => {
      const veilSideLappet = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.044, 0.32, 6, 10),
        peaceStatueMarbleMat
      );
      veilSideLappet.position.set(sideS * 0.145, headY - 0.12, gardenZ + 0.01);
      veilSideLappet.rotation.z = sideS * 0.22;
      addCathPart(veilSideLappet, 1, 0xf8fafc);
    });

    const haloRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.27, 0.012, 10, 32),
      goldBronzeMat
    );
    haloRing.position.set(0, headY + 0.05, gardenZ - 0.11);
    addCathPart(haloRing, 1, 0xd97706);

    // Cột đèn đường cổ điển Pháp bố trí xung quanh rìa quảng trường
    const addClassicPlazaLamp = (lx: number, lz: number) => {
      const lampBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.26, 0.65, 10),
        steelMat
      );
      lampBase.position.set(lx, baseY + 0.325, lz);
      addCathPart(lampBase, 0, 0x334155, true);

      const lampPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.10, 3.2, 10),
        steelMat
      );
      lampPole.position.set(lx, baseY + 2.1, lz);
      addCathPart(lampPole, 0, 0x334155, true);

      const lampLantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 12, 12),
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.85,
          roughness: 0.2,
        })
      );
      lampLantern.position.set(lx, baseY + 3.82, lz);
      addCathPart(lampLantern, 0, 0xfef08a, true);
    };

    [
      [-7.8, 15.2], [7.8, 15.2],
      [-7.8, 22.8], [7.8, 22.8],
      [-13.8, 18.8], [13.8, 18.8],
      [-13.7, 4.0], [13.7, 4.0],
      [-13.7, -18.0], [13.7, -18.0],
      [-10.8, -29.8], [10.8, -29.8],
    ].forEach(([lx, lz]) => addClassicPlazaLamp(lx, lz));

    // =========================================================================
    // 3. MẶT TIỀN CHÍNH (WEST FACADE), CỬA SỔ HOA HỒNG, HÀNG VÒM NHỎ & 3 CỔNG VÒM
    // =========================================================================
    [
      { w: 17.2, h: 0.20, d: 1.9, y: baseY + 0.10, z: 12.15 },
      { w: 16.6, h: 0.20, d: 1.35, y: baseY + 0.30, z: 11.88 },
      { w: 16.0, h: 0.20, d: 0.85, y: baseY + 0.50, z: 11.62 },
    ].forEach((st) => {
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(st.w, st.h, st.d),
        granitePlinthMat
      );
      stepMesh.position.set(0, st.y, st.z);
      addCathPart(stepMesh, 0, 0x6e737b, true);
    });

    // =========================================================================
    // 3. MẶT TIỀN CHÍNH (WEST FACADE): 3 CỔNG VÒM HỐC SÂU & RÀO SẮT 2/3,
    //    BỐ CỤC 4 TẦNG CỬA NGUYÊN MẪU, ĐỒNG HỒ XANH ĐEN #1E293B & LAN CAN ĐÁ ĐỤC LỖ TRÒN
    // =========================================================================
    // Vật liệu chuyên biệt cho khu vực Cổng vòm Romanesque, Rào sắt & Đồng hồ mặt tiền
    const portalSandstoneMat = new THREE.MeshStandardMaterial({
      color: 0xd8c3a5, // Đá vàng cát (#D8C3A5) cho 3 lớp gờ đá cuốn đồng tâm (Archivolts) & thức cột
      map: sharedLimestoneTex.map,
      bumpMap: sharedLimestoneTex.bumpMap,
      bumpScale: 0.032,
      roughness: 0.82,
      metalness: 0.03,
    });

    const ivoryStoneArchMat = new THREE.MeshStandardMaterial({
      color: 0xeae2d6, // Đá trắng ngà sáng cho viền đỉnh vòm Triple Arcade, Bifora & Lan can đục lỗ tròn
      map: sharedLimestoneTex.map,
      bumpMap: sharedLimestoneTex.bumpMap,
      bumpScale: 0.028,
      roughness: 0.80,
      metalness: 0.03,
    });

    const deepWoodDoorMat = new THREE.MeshStandardMaterial({
      color: 0x3e2723, // Cánh cửa gỗ đôi màu nâu sẫm (#3E2723) đặt lùi sâu trong hốc cổng
      roughness: 0.88,
      metalness: 0.03,
    });

    const portalIronFenceMat = new THREE.MeshStandardMaterial({
      color: 0x2a1b18, // Cổng rào sắt chấn song thẳng đứng màu nâu đỏ sẫm / đen (#2A1B18)
      roughness: 0.50,
      metalness: 0.68,
    });

    const clockFaceNavyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Mặt đồng hồ cổ điển nền xanh đen sẫm (#1E293B)
      roughness: 0.42,
      metalness: 0.15,
    });

    // Helper tạo khối tường mặt tiền tầng trệt có ĐỤC LỖ VÒM THẬT SỰ (sâu 0.65 - 0.75) để hốc cổng không bị tường đặc che lấp
    const buildWallWithArchedCutoutGeo = (
      wallW: number,
      wallH: number,
      wallDepth: number,
      holeW: number,
      holeBottomY: number,
      holeRectH: number
    ): THREE.BufferGeometry => {
      const shape = new THREE.Shape();
      shape.moveTo(-wallW / 2, 0);
      shape.lineTo(wallW / 2, 0);
      shape.lineTo(wallW / 2, wallH);
      shape.lineTo(-wallW / 2, wallH);
      shape.closePath();

      const holeR = holeW / 2;
      const hole = new THREE.Path();
      hole.moveTo(-holeR, holeBottomY);
      hole.lineTo(holeR, holeBottomY);
      hole.lineTo(holeR, holeBottomY + holeRectH);
      hole.absarc(0, holeBottomY + holeRectH, holeR, 0, Math.PI, false);
      hole.lineTo(-holeR, holeBottomY);
      shape.holes.push(hole);

      const raw = new THREE.ExtrudeGeometry(shape, {
        depth: wallDepth,
        bevelEnabled: false,
        curveSegments: 28,
      });
      raw.translate(0, 0, -wallDepth / 2);
      const sharp = raw.toNonIndexed();
      sharp.computeVertexNormals();
      raw.dispose();
      return sharp;
    };

    // Khối sảnh giữa nằm khít giữa 2 tháp chuông (x = ±6.2, rộng 4.6 -> mép trong tại ±3.9)
    const centerFacadeW = 7.76;
    const centerFacadeD = 3.8;
    const centerFacadeZ = 9.3;
    const frontFaceZ = 11.2;

    const portalBaseY = baseY + 0.55;
    const mainDoorW = 2.86;
    const mainDoorRectH = 3.05;
    const mainPortalDepth = 0.75; // Hốc vòm cổng chính thụt sâu 0.75 vào trong tường

    const centerPlinth = new THREE.Mesh(
      new THREE.BoxGeometry(centerFacadeW, 0.85, centerFacadeD - mainPortalDepth),
      granitePlinthMat
    );
    centerPlinth.position.set(0, baseY + 0.425, centerFacadeZ - mainPortalDepth / 2);
    addCathPart(centerPlinth, 1, 0x64748b);

    // Hai bệ đá hoa cương hai bên miệng cổng chính
    const sidePlinthSpan = (centerFacadeW - mainDoorW) / 2;
    [-1, 1].forEach((s) => {
      const frontSidePlinth = new THREE.Mesh(
        new THREE.BoxGeometry(sidePlinthSpan, 0.85, mainPortalDepth),
        granitePlinthMat
      );
      frontSidePlinth.position.set(
        s * (mainDoorW / 2 + sidePlinthSpan / 2),
        baseY + 0.425,
        frontFaceZ - mainPortalDepth / 2
      );
      addCathPart(frontSidePlinth, 1, 0x64748b);
    });

    // Khối tường hậu của sảnh giữa (lùi sau hốc cổng 0.75 để tạo không gian hốc cổng thật)
    const centerWallH = 12.75;
    const centerBackWall = new THREE.Mesh(
      new THREE.BoxGeometry(centerFacadeW, centerWallH, centerFacadeD - mainPortalDepth),
      marseilleBrickMat
    );
    centerBackWall.position.set(
      0,
      baseY + 0.85 + centerWallH / 2,
      centerFacadeZ - mainPortalDepth / 2
    );
    addCathPart(centerBackWall, 1, 0x9e4230);

    // Lớp tường mặt tiền phía trước của sảnh giữa (dày 0.75) có đục lỗ Hốc vòm cổng chính
    const centerFrontPiercedWall = new THREE.Mesh(
      buildWallWithArchedCutoutGeo(
        centerFacadeW,
        centerWallH + 0.85,
        mainPortalDepth,
        mainDoorW + 0.24,
        portalBaseY - baseY,
        mainDoorRectH
      ),
      marseilleBrickMat
    );
    centerFrontPiercedWall.position.set(0, baseY, frontFaceZ - mainPortalDepth / 2);
    addCathPart(centerFrontPiercedWall, 1, 0x9e4230);

    // Các gờ phào chỉ đá sáng chạy ngang mặt tiền sảnh giữa chia rõ 3 tầng
    [5.75, 8.85, 13.60].forEach((beltH, idx) => {
      const belt = new THREE.Mesh(
        new THREE.BoxGeometry(centerFacadeW, idx === 2 ? 0.20 : 0.14, centerFacadeD + 0.16),
        portalSandstoneMat
      );
      belt.position.set(0, baseY + beltH, centerFacadeZ);
      addCathPart(belt, idx === 2 ? 2 : 1, 0xd8c3a5);
    });

    // =========================================================================
    // HELPER DỰNG 3 CỔNG VÒM ROMANESQUE GIẬT CẤP THỤT SÂU (DEPTH 0.65–0.75) & CỔNG RÀO SẮT 2/3
    // - 3 lớp gờ đá cuốn đồng tâm (Archivolts) màu đá vàng cát (#D8C3A5) tựa trên các thức cột tròn mảnh hai bên vách cửa
    // - Vòm bán nguyệt Tympanum và cánh cửa gỗ đôi màu nâu sẫm (#3E2723) đặt lùi sâu vào mặt trong của hốc cửa
    // - Phía ngoài miệng hốc cổng (sát mặt tiền): Hệ Cổng rào sắt (Wrought-iron gate) cao bằng 2/3 chiều cao vòm cổng,
    //   gồm các thanh chấn song sắt thẳng đứng màu nâu đỏ sẫm / đen (#2A1B18) có hoa văn mũi giáo và chữ thập nhỏ trên đỉnh,
    //   nhìn xuyên qua hàng rào sắt thấy rõ khoảng tối sâu bên trong hốc cổng.
    // =========================================================================
    const addDeepRecessedRomanesquePortal = (
      cx: number,
      portalY: number,
      faceZ: number,
      openW: number,
      rectH: number,
      recessDepth: number // 0.65 đến 0.75
    ) => {
      const archR = openW / 2;
      const totalArchH = rectH + archR;

      // 1. Nền bậc thềm đá vàng cát (#D8C3A5) trải suốt chiều sâu hốc cổng (depth: 0.65 - 0.75)
      const thresholdSlab = new THREE.Mesh(
        new THREE.BoxGeometry(openW + 0.90, 0.14, recessDepth + 0.36),
        portalSandstoneMat
      );
      thresholdSlab.position.set(cx, portalY - 0.05, faceZ - recessDepth / 2 + 0.10);
      addCathPart(thresholdSlab, 1, 0xd8c3a5);

      // 2. Vách trong tối sâu của hốc vòm (Ambient Shadow Liner) tạo bóng tối chiều sâu tự nhiên
      const innerShadowChamber = new THREE.Mesh(
        new THREE.BoxGeometry(openW + 0.08, rectH, recessDepth - 0.06),
        darkRecessCavityMat
      );
      innerShadowChamber.position.set(cx, portalY + rectH / 2, faceZ - recessDepth / 2);
      addCathPart(innerShadowChamber, 1, 0x181a20);

      const innerShadowVault = new THREE.Mesh(
        buildHollowArchRingGeo(archR - 0.02, archR + 0.06, recessDepth - 0.04, 28),
        darkRecessCavityMat
      );
      innerShadowVault.position.set(cx, portalY + rectH, faceZ - recessDepth / 2);
      addCathPart(innerShadowVault, 1, 0x181a20);

      // 3. CÁNH CỬA GỖ ĐÔI MÀU NÂU SẪM (#3E2723) & VÒM BÁN NGUYỆT TYMPANUM ĐẶT LÙI SÂU VÀO MẶT TRONG HỐC CỬA
      const deepBackZ = faceZ - recessDepth + 0.08;

      // Hai cánh cửa gỗ đôi màu nâu sẫm (#3E2723) đặt lùi sâu tại deepBackZ
      const leafW = (openW - 0.08) / 2;
      [-1, 1].forEach((leafSign) => {
        const lx = cx + leafSign * (leafW / 2 + 0.015);
        const woodLeaf = new THREE.Mesh(
          new THREE.BoxGeometry(leafW, rectH - 0.06, 0.08),
          deepWoodDoorMat
        );
        woodLeaf.position.set(lx, portalY + (rectH - 0.06) / 2, deepBackZ);
        addCathPart(woodLeaf, 1, 0x3e2723);

        // Các ô pano gỗ chìm cổ điển trên mỗi cánh cửa gỗ nâu sẫm
        [0.24, 0.72].forEach((yRatio) => {
          const panelFrame = new THREE.Mesh(
            new THREE.BoxGeometry(leafW * 0.72, rectH * 0.34, 0.03),
            deepWoodDoorMat
          );
          panelFrame.position.set(lx, portalY + rectH * yRatio, deepBackZ + 0.045);
          addCathPart(panelFrame, 1, 0x3e2723);
        });
      });

      // Thanh dầm đá ngang (Stone Lintel / Impost Bar) ngăn cách cửa gỗ đôi và vòm bán nguyệt Tympanum ở đáy hốc
      const deepLintel = new THREE.Mesh(
        new THREE.BoxGeometry(openW, 0.14, 0.16),
        portalSandstoneMat
      );
      deepLintel.position.set(cx, portalY + rectH, deepBackZ + 0.04);
      addCathPart(deepLintel, 1, 0xd8c3a5);

      // Vòm bán nguyệt phía trên cửa (Tympanum) đặt lùi sâu vào mặt trong của hốc cửa
      const deepTympanum = new THREE.Mesh(
        buildFilledSemicircleGeo(archR - 0.04, 0.10, 28),
        portalSandstoneMat
      );
      deepTympanum.position.set(cx, portalY + rectH + 0.04, deepBackZ + 0.02);
      addCathPart(deepTympanum, 1, 0xd8c3a5);

      // Phù điêu bán nguyệt chạm nổi bên trong Tympanum
      const innerTympanumRelief = new THREE.Mesh(
        buildHollowArchRingGeo(archR * 0.35, archR * 0.72, 0.06, 24),
        ivoryStoneArchMat
      );
      innerTympanumRelief.position.set(cx, portalY + rectH + 0.06, deepBackZ + 0.07);
      addCathPart(innerTympanumRelief, 1, 0xeae2d6);

      // 4. BA LỚP GỜ ĐÁ CUỐN ĐỒNG TÂM (3 CONCENTRIC STEPPED ARCHIVOLTS) MÀU ĐÁ VÀNG CÁT (#D8C3A5)
      //    TỰA TRÊN CÁC THỨC CỘT TRÒN MẢNH HAI BÊN VÁCH CỬA (GIẬT CẤP TỪ TRONG HỐC RA NGOÀI MIỆNG CỔNG)
      const archivoltOrders = [
        // Lớp 1 (Trong cùng - sâu trong hốc cổng)
        { rOffset: -0.06, zCenter: faceZ - recessDepth * 0.62, depth: 0.24, ringThick: 0.15, colR: 0.068 },
        // Lớp 2 (Giữa - giật cấp trung gian)
        { rOffset: 0.12, zCenter: faceZ - recessDepth * 0.28, depth: 0.26, ringThick: 0.16, colR: 0.076 },
        // Lớp 3 (Ngoài cùng - bao quanh miệng vòm nhô ra ngoài mặt tiền)
        { rOffset: 0.31, zCenter: faceZ + 0.06, depth: 0.28, ringThick: 0.18, colR: 0.085 },
      ];

      archivoltOrders.forEach((ord) => {
        const orderR = archR + ord.rOffset;

        // Cặp thức cột tròn mảnh (Slender Cylindrical Colonnettes) hai bên vách cửa giật cấp
        [-1, 1].forEach((sideS) => {
          const colX = cx + sideS * orderR;

          // Chân đế đá vuông (Attic Base)
          const colBase = new THREE.Mesh(
            new THREE.BoxGeometry(ord.colR * 2.5, 0.22, ord.depth * 0.9),
            portalSandstoneMat
          );
          colBase.position.set(colX, portalY + 0.11, ord.zCenter);
          addCathPart(colBase, 1, 0xd8c3a5);

          // Thân cột đá tròn mảnh (Colonnette Shaft)
          const shaftH = rectH - 0.42;
          const colShaft = new THREE.Mesh(
            new THREE.CylinderGeometry(ord.colR * 0.90, ord.colR, shaftH, 14),
            portalSandstoneMat
          );
          colShaft.position.set(colX, portalY + 0.22 + shaftH / 2, ord.zCenter + 0.02);
          addCathPart(colShaft, 1, 0xd8c3a5);

          // Đầu cột chạm nổi (Foliate Capital & Impost Block)
          const colCap = new THREE.Mesh(
            new THREE.BoxGeometry(ord.colR * 2.6, 0.20, ord.depth * 0.95),
            ivoryStoneArchMat
          );
          colCap.position.set(colX, portalY + rectH - 0.10, ord.zCenter + 0.02);
          addCathPart(colCap, 1, 0xeae2d6);
        });

        // Gờ đá cuốn đồng tâm (Concentric Romanesque Archivolt)
        const archivoltRing = new THREE.Mesh(
          buildHollowArchRingGeo(
            orderR - ord.ringThick * 0.45,
            orderR + ord.ringThick * 0.55,
            ord.depth,
            32
          ),
          portalSandstoneMat
        );
        archivoltRing.position.set(cx, portalY + rectH, ord.zCenter);
        addCathPart(archivoltRing, 1, 0xd8c3a5);
      });

      // Vành gờ đá viền ngoài cùng (Outer Hood-Mold / Dripstone) ôm sát miệng vòm
      const outerHoodR = archR + 0.46;
      const outerHoodArch = new THREE.Mesh(
        buildHollowArchRingGeo(outerHoodR - 0.05, outerHoodR + 0.07, 0.22, 32),
        ivoryStoneArchMat
      );
      outerHoodArch.position.set(cx, portalY + rectH, faceZ + 0.12);
      addCathPart(outerHoodArch, 1, 0xeae2d6);

      // 5. HỆ CỔNG RÀO SẮT (WROUGHT-IRON GATE) ĐẶT NGAY PHÍA NGOÀI MIỆNG HỐC CỔNG (SÁT MẶT TIỀN):
      //    - Cao đúng bằng 2/3 chiều cao vòm cổng
      //    - Gồm các thanh chấn song sắt thẳng đứng màu nâu đỏ sẫm / đen (#2A1B18)
      //    - Có hoa văn mũi giáo và chữ thập nhỏ trên đỉnh rào sắt
      //    - Nhìn xuyên qua hàng rào sắt thấy rõ khoảng tối sâu bên trong hốc cổng
      const ironGateH = totalArchH * (2 / 3); // Cao đúng bằng 2/3 chiều cao vòm cổng
      const ironGateW = openW - 0.08;
      const ironGateZ = faceZ + 0.03; // Ngay phía ngoài miệng hốc cổng, sát mặt tiền

      // 2 trụ bản lề sắt hai bên và 2 thanh đứng giữa của 2 cánh rào sắt
      [-ironGateW / 2, -0.035, 0.035, ironGateW / 2].forEach((postOff) => {
        const gatePost = new THREE.Mesh(
          new THREE.BoxGeometry(0.042, ironGateH, 0.042),
          portalIronFenceMat
        );
        gatePost.position.set(cx + postOff, portalY + ironGateH / 2, ironGateZ);
        addCathPart(gatePost, 1, 0x2a1b18);
      });

      // 3 thanh giằng ngang mảnh (dưới chân, giữa thấp và gần đỉnh rào sắt) để giữ độ thoáng nhìn xuyên vào hốc tối
      [0.10, ironGateH * 0.42, ironGateH - 0.14].forEach((railY) => {
        const hRail = new THREE.Mesh(
          new THREE.BoxGeometry(ironGateW, 0.036, 0.036),
          portalIronFenceMat
        );
        hRail.position.set(cx, portalY + railY, ironGateZ);
        addCathPart(hRail, 1, 0x2a1b18);
      });

      // Hàng thanh chấn song sắt thẳng đứng (Vertical Iron Pickets) + Hoa văn mũi giáo (Spearhead Finials) trên đỉnh
      const picketCount = Math.max(12, Math.floor(ironGateW / 0.15));
      for (let p = 1; p < picketCount; p++) {
        const px = -ironGateW / 2 + (p / picketCount) * ironGateW;
        if (Math.abs(px) < 0.07) continue; // Chừa khe mở giữa 2 cánh cổng

        const picketBar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.013, 0.013, ironGateH, 8),
          portalIronFenceMat
        );
        picketBar.position.set(cx + px, portalY + ironGateH / 2, ironGateZ);
        addCathPart(picketBar, 1, 0x2a1b18);

        // Hoa văn mũi giáo (Spearhead Finial) nhọn trên đỉnh mỗi thanh chấn song sắt
        const spearFinial = new THREE.Mesh(
          new THREE.ConeGeometry(0.028, 0.12, 4),
          portalIronFenceMat
        );
        spearFinial.position.set(cx + px, portalY + ironGateH + 0.06, ironGateZ);
        spearFinial.rotation.y = Math.PI / 4;
        addCathPart(spearFinial, 1, 0x2a1b18);
      }

      // Chữ thập nhỏ bằng sắt rèn (Small Wrought-Iron Cross Finials) trên đỉnh giữa của rào sắt
      [-0.22, 0, 0.22].forEach((crossXOff, cIdx) => {
        const crossBaseH = portalY + ironGateH + (cIdx === 1 ? 0.08 : 0.04);
        const cStemH = cIdx === 1 ? 0.34 : 0.24;
        const cArmW = cIdx === 1 ? 0.20 : 0.14;

        const crossStem = new THREE.Mesh(
          new THREE.BoxGeometry(0.024, cStemH, 0.024),
          portalIronFenceMat
        );
        crossStem.position.set(cx + crossXOff, crossBaseH + cStemH / 2, ironGateZ);
        addCathPart(crossStem, 1, 0x2a1b18);

        const crossBar = new THREE.Mesh(
          new THREE.BoxGeometry(cArmW, 0.024, 0.024),
          portalIronFenceMat
        );
        crossBar.position.set(cx + crossXOff, crossBaseH + cStemH * 0.68, ironGateZ);
        addCathPart(crossBar, 1, 0x2a1b18);
      });
    };

    // Dựng Cổng vòm chính lớn ở giữa (x = 0, z = frontFaceZ = 11.2, hốc sâu 0.75)
    addDeepRecessedRomanesquePortal(
      0,
      portalBaseY,
      frontFaceZ,
      mainDoorW,
      mainDoorRectH,
      mainPortalDepth
    );

    // =========================================================================
    // TẦNG 2 KHỐI GIỮA (NGAY PHÍA TRÊN CỔNG CHÍNH & DƯỚI CỬA SỔ HOA HỒNG):
    // 3 Ô CỬA VÒM CAO CÂN ĐỐI XẾP SÁT NHAU (TRIPLE ARCADE), VIỀN ĐÁ TRẮNG NGÀ Ở ĐỈNH VÒM, BÊN TRONG TỐI SÂU
    // =========================================================================
    const tripleArcadeBaseY = baseY + 6.02;
    const blindArchW = 1.04;
    const blindArchRectH = 1.68;
    const blindArchR = blindArchW / 2; // 0.52
    const blindArchStepX = 1.24; // 3 ô vòm cao xếp sát nhau tại x = -1.24, 0, +1.24

    // Bệ đá đỡ chân 3 ô cửa vòm cao
    const tripleArcadeSill = new THREE.Mesh(
      new THREE.BoxGeometry(blindArchStepX * 3 + 0.44, 0.14, 0.26),
      ivoryStoneArchMat
    );
    tripleArcadeSill.position.set(0, tripleArcadeBaseY - 0.06, frontFaceZ + 0.10);
    addCathPart(tripleArcadeSill, 1, 0xeae2d6);

    // 4 Thức cột đá mảnh đỡ 3 vòm cao liên tiếp
    [-1.5, -0.5, 0.5, 1.5].forEach((colFactor) => {
      const colX = colFactor * blindArchStepX;

      const colBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.12, 0.22),
        ivoryStoneArchMat
      );
      colBase.position.set(colX, tripleArcadeBaseY + 0.06, frontFaceZ + 0.10);
      addCathPart(colBase, 1, 0xeae2d6);

      const colShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.062, 0.068, blindArchRectH - 0.22, 14),
        ivoryStoneArchMat
      );
      colShaft.position.set(colX, tripleArcadeBaseY + blindArchRectH / 2, frontFaceZ + 0.11);
      addCathPart(colShaft, 1, 0xeae2d6);

      const colCap = new THREE.Mesh(
        new THREE.BoxGeometry(0.20, 0.13, 0.24),
        ivoryStoneArchMat
      );
      colCap.position.set(colX, tripleArcadeBaseY + blindArchRectH - 0.05, frontFaceZ + 0.11);
      addCathPart(colCap, 1, 0xeae2d6);
    });

    // 3 Ô cửa vòm cao cân đối: viền đá trắng ngà ở đỉnh vòm, bên trong tối sâu (#181A20)
    [-blindArchStepX, 0, blindArchStepX].forEach((ax) => {
      const deepRecessRect = new THREE.Mesh(
        new THREE.BoxGeometry(blindArchW - 0.02, blindArchRectH, 0.08),
        darkRecessCavityMat
      );
      deepRecessRect.position.set(ax, tripleArcadeBaseY + blindArchRectH / 2, frontFaceZ + 0.03);
      addCathPart(deepRecessRect, 1, 0x181a20);

      const deepRecessArch = new THREE.Mesh(
        buildFilledSemicircleGeo(blindArchR - 0.01, 0.08, 22),
        darkRecessCavityMat
      );
      deepRecessArch.position.set(ax, tripleArcadeBaseY + blindArchRectH, frontFaceZ + 0.03);
      addCathPart(deepRecessArch, 1, 0x181a20);

      // Viền đá trắng ngà đắp nổi ở đỉnh vòm (Ivory Stone Archivolt Crown)
      const ivoryArchivolt = new THREE.Mesh(
        buildHollowArchRingGeo(blindArchR - 0.03, blindArchR + 0.09, 0.18, 26),
        ivoryStoneArchMat
      );
      ivoryArchivolt.position.set(ax, tripleArcadeBaseY + blindArchRectH, frontFaceZ + 0.10);
      addCathPart(ivoryArchivolt, 1, 0xeae2d6);

      const outerArchRim = new THREE.Mesh(
        buildHollowArchRingGeo(blindArchR + 0.08, blindArchR + 0.15, 0.21, 26),
        portalSandstoneMat
      );
      outerArchRim.position.set(ax, tripleArcadeBaseY + blindArchRectH, frontFaceZ + 0.12);
      addCathPart(outerArchRim, 1, 0xd8c3a5);
    });

    // =========================================================================
    // TẦNG 3 KHỐI GIỮA (NGANG TẦM CỬA SỔ HOA HỒNG):
    // CỬA SỔ HOA HỒNG TRÒN LỚN BAO QUANH BỞI KHUNG VÒM LỚN ĐẮP NỔI (GRAND ENCLOSING ARCH)
    // =========================================================================
    const roseCenterY = baseY + 11.05;
    const roseRadius = 1.68;
    addRoseWindowAssembly(0, roseCenterY, frontFaceZ + 0.02, roseRadius, 'front', 2);

    // Khung vòm lớn đắp nổi (Grand Enclosing Arch) chạy ôm phía trên Cửa sổ Hoa Hồng và tựa trên 2 trụ đá hai bên
    const grandRoseArchR = 2.22;
    const grandRoseSpringY = baseY + 11.15;
    const grandRoseJambH = grandRoseSpringY - (baseY + 8.92);

    [-1, 1].forEach((s) => {
      const jambX = s * grandRoseArchR;
      const grandJamb = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, grandRoseJambH, 0.22),
        portalSandstoneMat
      );
      grandJamb.position.set(jambX, baseY + 8.92 + grandRoseJambH / 2, frontFaceZ + 0.10);
      addCathPart(grandJamb, 2, 0xd8c3a5);

      const grandCap = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.16, 0.26),
        ivoryStoneArchMat
      );
      grandCap.position.set(jambX, grandRoseSpringY, frontFaceZ + 0.12);
      addCathPart(grandCap, 2, 0xeae2d6);
    });

    const grandEnclosingArch = new THREE.Mesh(
      buildHollowArchRingGeo(grandRoseArchR - 0.08, grandRoseArchR + 0.12, 0.22, 36),
      ivoryStoneArchMat
    );
    grandEnclosingArch.position.set(0, grandRoseSpringY, frontFaceZ + 0.11);
    addCathPart(grandEnclosingArch, 2, 0xeae2d6);

    const grandEnclosingOuterMold = new THREE.Mesh(
      buildHollowArchRingGeo(grandRoseArchR + 0.11, grandRoseArchR + 0.21, 0.25, 36),
      portalSandstoneMat
    );
    grandEnclosingOuterMold.position.set(0, grandRoseSpringY, frontFaceZ + 0.13);
    addCathPart(grandEnclosingOuterMold, 2, 0xd8c3a5);

    // =========================================================================
    // ĐẦU HỒI TAM GIÁC MẶT TIỀN, MẶT ĐỒNG HỒ CỔ ĐIỂN NỀN XANH ĐEN SẪM (#1E293B) CÓ VẠCH SỐ LA MÃ
    // & DẢI LAN CAN ĐÁ ĐỤC LỖ TRÒN (OPENWORK BALUSTRADE) CHẠY NGANG PHÍA SAU VAI MÁI TAM GIÁC
    // =========================================================================
    const gableBaseY = baseY + 13.70;
    const gableRidgeH = 3.50; // Đỉnh đầu hồi đạt baseY + 17.20 — bằng đúng cao độ đỉnh mái thân chính (roofBaseY + naveRoofRidgeH)
    const frontPedimentD = 0.68; // Tường đầu hồi mặt tiền gọn gàng ở phía trước (z = 10.52 .. 11.20), không lồi khối gờ cao ra sau lưng 2 tháp
    const frontPedimentZ = frontFaceZ - frontPedimentD / 2;

    const frontGableWall = new THREE.Mesh(
      buildTriangularGableWallGeo(centerFacadeW, gableRidgeH, frontPedimentD),
      marseilleBrickMat
    );
    frontGableWall.position.set(0, gableBaseY, frontPedimentZ);
    addCathPart(frontGableWall, 2, 0x9e4230);

    const slopeLen = Math.hypot(centerFacadeW / 2 + 0.16, gableRidgeH);
    const slopeAngle = Math.atan2(gableRidgeH, centerFacadeW / 2);
    [-1, 1].forEach((s) => {
      const rakingCornice = new THREE.Mesh(
        new THREE.BoxGeometry(slopeLen, 0.14, frontPedimentD + 0.18),
        portalSandstoneMat
      );
      rakingCornice.position.set(
        s * (centerFacadeW / 4),
        gableBaseY + gableRidgeH / 2 + 0.04,
        frontPedimentZ + 0.02
      );
      rakingCornice.rotation.z = -s * slopeAngle;
      addCathPart(rakingCornice, 3, 0xd8c3a5);
    });

    // MẶT ĐỒNG HỒ CỔ ĐIỂN NỀN XANH ĐEN SẪM (#1E293B), VIỀN ĐÁ SÁNG, VẠCH SỐ LA MÃ & KIM ĐỒNG HỒ RÕ NÉT
    const gableClockY = gableBaseY + 1.42;
    const clockOuterR = 0.72;
    const clockInnerR = 0.56;

    // Viền đá sáng đắp nổi bao quanh mặt đồng hồ
    const gableClockOuterRim = new THREE.Mesh(
      new THREE.TorusGeometry(clockOuterR - 0.06, 0.095, 14, 32),
      ivoryStoneArchMat
    );
    gableClockOuterRim.position.set(0, gableClockY, frontFaceZ + 0.10);
    addCathPart(gableClockOuterRim, 2, 0xeae2d6);

    const gableClockInnerBead = new THREE.Mesh(
      new THREE.TorusGeometry(clockInnerR + 0.02, 0.035, 12, 32),
      portalSandstoneMat
    );
    gableClockInnerBead.position.set(0, gableClockY, frontFaceZ + 0.12);
    addCathPart(gableClockInnerBead, 2, 0xd8c3a5);

    // Mặt đồng hồ nền xanh đen sẫm (#1E293B)
    const gableClockDial = new THREE.Mesh(
      new THREE.CylinderGeometry(clockInnerR, clockInnerR, 0.08, 32),
      clockFaceNavyMat
    );
    gableClockDial.rotation.x = Math.PI / 2;
    gableClockDial.position.set(0, gableClockY, frontFaceZ + 0.075);
    addCathPart(gableClockDial, 2, 0x1e293b);

    // Vòng chỉ phút mảnh và 12 vạch số La Mã (Roman Numeral Markers) trên mặt đồng hồ
    const romanChapterRing = new THREE.Mesh(
      new THREE.TorusGeometry(clockInnerR * 0.78, 0.012, 8, 28),
      ivoryStoneArchMat
    );
    romanChapterRing.position.set(0, gableClockY, frontFaceZ + 0.122);
    addCathPart(romanChapterRing, 2, 0xeae2d6);

    for (let hIdx = 0; hIdx < 12; hIdx++) {
      const hAng = (hIdx * Math.PI) / 6;
      const isCardinal = hIdx % 3 === 0;
      const markR = clockInnerR * 0.78;
      const markLen = isCardinal ? 0.13 : 0.09;
      const markW = isCardinal ? 0.036 : 0.022;

      const numeralTick = new THREE.Mesh(
        new THREE.BoxGeometry(markW, markLen, 0.025),
        ivoryStoneArchMat
      );
      numeralTick.position.set(
        Math.sin(hAng) * markR,
        gableClockY + Math.cos(hAng) * markR,
        frontFaceZ + 0.125
      );
      numeralTick.rotation.z = -hAng;
      addCathPart(numeralTick, 2, 0xeae2d6);
    }

    // Trục tâm đồng hồ + Kim giờ & Kim phút rõ nét
    const clockCenterBoss = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 12, 12),
      goldBronzeMat
    );
    clockCenterBoss.position.set(0, gableClockY, frontFaceZ + 0.135);
    addCathPart(clockCenterBoss, 2, 0xc8963e);

    // Kim giờ (chỉ hướng ~10 giờ)
    const hourHandAng = (5 * Math.PI) / 3;
    const hourHandLen = clockInnerR * 0.50;
    const hourHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, hourHandLen, 0.025),
      ivoryStoneArchMat
    );
    hourHand.position.set(
      Math.sin(hourHandAng) * (hourHandLen * 0.42),
      gableClockY + Math.cos(hourHandAng) * (hourHandLen * 0.42),
      frontFaceZ + 0.135
    );
    hourHand.rotation.z = -hourHandAng;
    addCathPart(hourHand, 2, 0xeae2d6);

    // Kim phút (chỉ hướng ~2 giờ)
    const minHandAng = Math.PI / 3;
    const minHandLen = clockInnerR * 0.72;
    const minHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.030, minHandLen, 0.028),
      ivoryStoneArchMat
    );
    minHand.position.set(
      Math.sin(minHandAng) * (minHandLen * 0.45),
      gableClockY + Math.cos(minHandAng) * (minHandLen * 0.45),
      frontFaceZ + 0.142
    );
    minHand.rotation.z = -minHandAng;
    addCathPart(minHand, 2, 0xeae2d6);

    // DẢI LAN CAN ĐÁ ĐỤC LỖ TRÒN (OPENWORK BALUSTRADE) CHẠY NGANG PHÍA SAU VAI MÁI TAM GIÁC NỐI LIỀN SANG 2 THÂN THÁP CHUÔNG
    const balustradeBaseY = baseY + 13.70;
    const balustradeH = 0.76;
    const balustradeSpanX = 7.84; // Nối liền từ thân tháp chuông trái (x = -3.92) sang thân tháp chuông phải (x = +3.92)

    // Đặt dải lan can đá đục lỗ tròn (Openwork Balustrade) ở hai bên vai mái tam giác nối liền sang hai thân tháp chuông
    // (không nhô cao hơn sống mái chính phía sau lưng 2 tháp)
    const balZ = frontFaceZ + 0.06;
    [-1, 1].forEach((sideS) => {
      const wingW = 1.48;
      const wingCenterX = sideS * (balustradeSpanX / 2 - wingW / 2);

      const botRail = new THREE.Mesh(
        new THREE.BoxGeometry(wingW, 0.10, 0.20),
        ivoryStoneArchMat
      );
      botRail.position.set(wingCenterX, balustradeBaseY + 0.05, balZ);
      addCathPart(botRail, 3, 0xeae2d6);

      const topRail = new THREE.Mesh(
        new THREE.BoxGeometry(wingW + 0.06, 0.11, 0.24),
        ivoryStoneArchMat
      );
      topRail.position.set(wingCenterX, balustradeBaseY + balustradeH, balZ);
      addCathPart(topRail, 3, 0xeae2d6);

      // Các vòng đá đục lỗ tròn rỗng xuyên thấu (Openwork Circular Stone Tracery Rings)
      for (let cIdx = -1; cIdx <= 1; cIdx++) {
        const ringX = wingCenterX + cIdx * 0.42;
        const openCircle = new THREE.Mesh(
          new THREE.TorusGeometry(0.18, 0.048, 10, 20),
          ivoryStoneArchMat
        );
        openCircle.position.set(ringX, balustradeBaseY + balustradeH * 0.52, balZ);
        addCathPart(openCircle, 3, 0xeae2d6);
      }
    });

    const gableCrossV = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.95, 0.11),
      ivoryStoneArchMat
    );
    gableCrossV.position.set(0, gableBaseY + gableRidgeH + 0.58, frontFaceZ);
    addCathPart(gableCrossV, 3, 0xeae2d6);
    const gableCrossH = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.10, 0.11),
      ivoryStoneArchMat
    );
    gableCrossH.position.set(0, gableBaseY + gableRidgeH + 0.74, frontFaceZ);
    addCathPart(gableCrossH, 3, 0xeae2d6);

    // =========================================================================
    // 4. HAI THÁP CHUÔNG ĐÔI (x = ±6.2):
    //    - TẦNG 1: CỔNG PHỤ HỐC VÒM SÂU 0.68 + CỔNG RÀO SẮT 2/3 CHIỀU CAO
    //    - TẦNG 2: CẶP CỬA SỔ VÒM ĐÔI (BIFORA) VIỀN ĐÁ ĐỈNH VÒM
    //    - TẦNG 3: KHUNG VÒM LỚN BAO NGOÀI CHỨA 2 CỬA SỔ VÒM CAO + 1 Ô CỬA TRÒN NHỎ (OCULUS) Ở GIỮA PHÍA TRÊN
    //    - TẦNG 4 (CỔ THÁP DƯỚI CHÓP BẠC): 2 Ô CỬA VÒM CAO THÔNG THOÁNG NGĂN CÁCH BỞI TRỤ MẢNH Ở GIỮA
    // =========================================================================
    const towerCenterZ = 9.3;
    const towerW = 4.6;
    const towerD = 4.6;
    const towerFrontZ = towerCenterZ + towerD / 2; // 11.6
    const sideDoorW = 2.16;
    const sideDoorRectH = 2.82;
    const sidePortalDepth = 0.68; // Hốc vòm cổng phụ thụt sâu 0.68 vào trong tường tháp

    [-6.2, 6.2].forEach((tx) => {
      const sideSign = tx < 0 ? -1 : 1;

      // A. Chân đế đá hoa cương dưới mỗi tháp chuông (lùi phần giữa cổng phụ để tạo thềm hốc sâu)
      const tPlinthBack = new THREE.Mesh(
        new THREE.BoxGeometry(towerW + 0.20, 0.95, towerD + 0.20 - sidePortalDepth),
        granitePlinthMat
      );
      tPlinthBack.position.set(tx, baseY + 0.475, towerCenterZ - sidePortalDepth / 2);
      addCathPart(tPlinthBack, 1, 0x64748b);

      const towerSidePlinthW = (towerW + 0.20 - sideDoorW) / 2;
      [-1, 1].forEach((s) => {
        const frontCornerPlinth = new THREE.Mesh(
          new THREE.BoxGeometry(towerSidePlinthW, 0.95, sidePortalDepth),
          granitePlinthMat
        );
        frontCornerPlinth.position.set(
          tx + s * (sideDoorW / 2 + towerSidePlinthW / 2),
          baseY + 0.475,
          towerFrontZ + 0.10 - sidePortalDepth / 2
        );
        addCathPart(frontCornerPlinth, 1, 0x64748b);
      });

      // B. Thân tháp vuông bằng gạch Marseille đỏ gạch nung trầm ấm (#9E4230)
      const towerLowerH = 9.2;
      // Khối lõi thân dưới của tháp (lùi 0.68 ở mặt trước để hốc cổng phụ thụt sâu thật sự)
      const towerLowerCore = new THREE.Mesh(
        new THREE.BoxGeometry(towerW, towerLowerH, towerD - sidePortalDepth),
        marseilleBrickMat
      );
      towerLowerCore.position.set(
        tx,
        baseY + 0.95 + towerLowerH / 2,
        towerCenterZ - sidePortalDepth / 2
      );
      addCathPart(towerLowerCore, 1, 0x9e4230);

      // Mặt tiền tầng dưới của tháp chuông (dày 0.68) có đục lỗ Hốc vòm cổng phụ
      const towerFrontPiercedWall = new THREE.Mesh(
        buildWallWithArchedCutoutGeo(
          towerW,
          towerLowerH + 0.95,
          sidePortalDepth,
          sideDoorW + 0.20,
          portalBaseY - baseY,
          sideDoorRectH
        ),
        marseilleBrickMat
      );
      towerFrontPiercedWall.position.set(tx, baseY, towerFrontZ - sidePortalDepth / 2);
      addCathPart(towerFrontPiercedWall, 1, 0x9e4230);

      const towerUpperH = 7.55;
      const towerUpperW = towerW - 0.12;
      const towerUpperD = towerD - 0.12;
      const towerUpperBody = new THREE.Mesh(
        new THREE.BoxGeometry(towerUpperW, towerUpperH, towerUpperD),
        marseilleBrickMat
      );
      towerUpperBody.position.set(tx, baseY + 10.15 + towerUpperH / 2, towerCenterZ);
      addCathPart(towerUpperBody, 2, 0x9e4230);

      // C. 4 Trụ tường góc (Corner Pilaster Buttresses) bằng đá vàng cát (#D8C3A5)
      [-1, 1].forEach((cxSign) => {
        [-1, 1].forEach((czSign) => {
          const cornerButtressLower = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, towerLowerH, 0.28),
            portalSandstoneMat
          );
          cornerButtressLower.position.set(
            tx + cxSign * (towerW / 2 - 0.06),
            baseY + 0.95 + towerLowerH / 2,
            towerCenterZ + czSign * (towerD / 2 - 0.06)
          );
          addCathPart(cornerButtressLower, 1, 0xd8c3a5);

          const cornerButtressUpper = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, towerUpperH, 0.24),
            portalSandstoneMat
          );
          cornerButtressUpper.position.set(
            tx + cxSign * (towerUpperW / 2 - 0.06),
            baseY + 10.15 + towerUpperH / 2,
            towerCenterZ + czSign * (towerUpperD / 2 - 0.06)
          );
          addCathPart(cornerButtressUpper, 2, 0xd8c3a5);
        });
      });

      // D. Các đường gờ phào chỉ ngang bằng đá vàng cát (#D8C3A5) chia đúng 4 tầng của tháp vuông
      const towerTopY = baseY + 17.70;
      [5.75, 8.85, 13.75, 17.70].forEach((by, bIdx) => {
        const belt = new THREE.Mesh(
          new THREE.BoxGeometry(towerW + 0.24, bIdx === 3 ? 0.24 : 0.15, towerD + 0.24),
          portalSandstoneMat
        );
        belt.position.set(tx, baseY + by, towerCenterZ);
        addCathPart(belt, bIdx >= 2 ? 2 : 1, 0xd8c3a5);
      });

      // E. TẦNG 1 THÁP CHUÔNG: CỔNG PHỤ HỐC VÒM ROMANESQUE THỤT SÂU (DEPTH 0.68) & CỔNG RÀO SẮT 2/3
      addDeepRecessedRomanesquePortal(
        tx,
        portalBaseY,
        towerFrontZ,
        sideDoorW,
        sideDoorRectH,
        sidePortalDepth
      );

      // F. TẦNG 2 THÁP CHUÔNG (NGAY TRÊN 2 CỔNG PHỤ — y = baseY + 6.08):
      //    THAY 1 CỬA ĐƠN BẰNG CẶP CỬA SỔ VÒM ĐÔI (2 VÒM ĐỨNG CẠNH NHAU — BIFORA) CÓ VIỀN ĐÁ Ở ĐỈNH VÒM
      const level2BiforaY = baseY + 6.08;
      const level2WinW = 0.88;
      const level2WinRectH = 1.62;
      const level2WinR = level2WinW / 2;
      const level2PairOffsets = [-0.62, 0.62];

      // Bệ đá chung dưới cặp cửa sổ vòm đôi Tầng 2 mặt trước tháp
      const l2SillFront = new THREE.Mesh(
        new THREE.BoxGeometry(2.42, 0.12, 0.22),
        ivoryStoneArchMat
      );
      l2SillFront.position.set(tx, level2BiforaY - 0.05, towerFrontZ + 0.08);
      addCathPart(l2SillFront, 1, 0xeae2d6);

      // Trụ cột đá mảnh ngăn cách ở chính giữa cặp cửa vòm đôi (Central Bifora Colonnette)
      const l2CenterCol = new THREE.Mesh(
        new THREE.CylinderGeometry(0.058, 0.064, level2WinRectH, 12),
        ivoryStoneArchMat
      );
      l2CenterCol.position.set(tx, level2BiforaY + level2WinRectH / 2, towerFrontZ + 0.09);
      addCathPart(l2CenterCol, 1, 0xeae2d6);

      level2PairOffsets.forEach((bo) => {
        // Mặt trước tháp chuông: 2 vòm đứng cạnh nhau (Bifora) có viền đá sáng ở đỉnh vòm
        addArchedOpening(
          tx + bo,
          level2BiforaY,
          towerFrontZ + 0.01,
          level2WinW,
          level2WinRectH,
          0.16,
          'front',
          darkRecessCavityMat,
          0x181a20,
          1,
          false
        );
        const l2CrownArchFront = new THREE.Mesh(
          buildHollowArchRingGeo(level2WinR - 0.02, level2WinR + 0.09, 0.20, 24),
          ivoryStoneArchMat
        );
        l2CrownArchFront.position.set(
          tx + bo,
          level2BiforaY + level2WinRectH,
          towerFrontZ + 0.10
        );
        addCathPart(l2CrownArchFront, 1, 0xeae2d6);

        // Mặt bên ngoài tháp chuông (Tầng 2): đồng bộ cặp cửa sổ vòm đôi Bifora
        addArchedOpening(
          tx + sideSign * (towerW / 2 + 0.01),
          level2BiforaY,
          towerCenterZ + bo,
          level2WinW,
          level2WinRectH,
          0.16,
          sideSign < 0 ? 'left' : 'right',
          darkRecessCavityMat,
          0x181a20,
          1,
          false
        );
      });

      // G. TẦNG 3 THÁP CHUÔNG (NGANG TẦM CỬA SỔ HOA HỒNG — y = baseY + 9.15 .. 13.55):
      //    MỖI BÊN TẠO 1 KHUNG VÒM LỚN BAO NGOÀI, BÊN TRONG CHỨA 2 CỬA SỔ VÒM CAO
      //    VÀ ĐẶC BIỆT CÓ 1 Ô CỬA TRÒN NHỎ (OCULUS) VIỀN ĐÁ NẰM CHÍNH GIỮA PHÍA TRÊN 2 CỬA SỔ VÒM ĐÓ
      const l3BaseY = baseY + 9.22;
      const l3TallWinW = 0.86;
      const l3TallWinRectH = 1.85;
      const l3PairOffsets = [-0.62, 0.62];
      const l3OculusY = baseY + 12.18;
      const l3OculusR = 0.44;
      const l3EnclosingArchR = 1.38;
      const l3EnclosingSpringY = baseY + 12.05;
      const l3EnclosingJambH = l3EnclosingSpringY - l3BaseY;

      // Helper dựng cụm Tầng 3 (Khung vòm lớn bao ngoài + 2 cửa sổ vòm cao + 1 Oculus tròn ở giữa phía trên) cho từng mặt tháp
      const addTowerLevel3ArchEnsemble = (
        faceCenterX: number,
        faceCenterZ: number,
        facing: 'front' | 'back' | 'left' | 'right'
      ) => {
        const isFrontBack = facing === 'front' || facing === 'back';
        const normalSign = facing === 'front' || facing === 'right' ? 1 : -1;

        // 1. Hai cửa sổ vòm cao đứng cạnh nhau bên dưới
        l3PairOffsets.forEach((bo) => {
          const wx = isFrontBack ? faceCenterX + bo : faceCenterX + normalSign * 0.01;
          const wz = isFrontBack ? faceCenterZ + normalSign * 0.01 : faceCenterZ + bo;
          addArchedOpening(
            wx,
            l3BaseY,
            wz,
            l3TallWinW,
            l3TallWinRectH,
            0.16,
            facing,
            darkLouverMat,
            0x1e1e1e,
            2,
            false
          );
        });

        // 2. Ô cửa tròn nhỏ (Oculus) viền đá nằm chính giữa phía trên 2 cửa sổ vòm
        const ocX = isFrontBack ? faceCenterX : faceCenterX + normalSign * 0.02;
        const ocZ = isFrontBack ? faceCenterZ + normalSign * 0.02 : faceCenterZ;
        addOculusRoundWindow(ocX, l3OculusY, ocZ, l3OculusR, facing, 2);

        // 3. Khung vòm lớn bao ngoài (Grand Enclosing Arch) ôm trọn 2 cửa sổ vòm cao và ô cửa tròn Oculus
        const encGroup = new THREE.Group();
        encGroup.position.set(faceCenterX, 0, faceCenterZ);
        if (facing === 'back') encGroup.rotation.y = Math.PI;
        else if (facing === 'left') encGroup.rotation.y = -Math.PI / 2;
        else if (facing === 'right') encGroup.rotation.y = Math.PI / 2;

        // Bệ đá dưới chân khung vòm lớn Tầng 3
        const l3Sill = new THREE.Mesh(
          new THREE.BoxGeometry(l3EnclosingArchR * 2 + 0.30, 0.13, 0.22),
          ivoryStoneArchMat
        );
        l3Sill.position.set(0, l3BaseY - 0.06, 0.09);
        encGroup.add(l3Sill);

        // Hai trụ cột đá cao hai bên của Khung vòm lớn bao ngoài
        [-1, 1].forEach((s) => {
          const jambPilaster = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, l3EnclosingJambH, 0.20),
            portalSandstoneMat
          );
          jambPilaster.position.set(
            s * l3EnclosingArchR,
            l3BaseY + l3EnclosingJambH / 2,
            0.09
          );
          encGroup.add(jambPilaster);

          const jambCap = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.14, 0.24),
            ivoryStoneArchMat
          );
          jambCap.position.set(s * l3EnclosingArchR, l3EnclosingSpringY, 0.10);
          encGroup.add(jambCap);
        });

        // Trụ đá mảnh ở chính giữa ngăn cách 2 cửa sổ vòm cao và đỡ dưới đáy cửa tròn Oculus
        const centerMullionPier = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.062, l3TallWinRectH + 0.35, 12),
          ivoryStoneArchMat
        );
        centerMullionPier.position.set(0, l3BaseY + (l3TallWinRectH + 0.35) / 2, 0.09);
        encGroup.add(centerMullionPier);

        // Vòm đá lớn đắp nổi bao ngoài cùng (Grand Outer Archivolt) ôm phía trên cửa tròn Oculus
        const grandTowerArch = new THREE.Mesh(
          buildHollowArchRingGeo(l3EnclosingArchR - 0.07, l3EnclosingArchR + 0.09, 0.20, 32),
          ivoryStoneArchMat
        );
        grandTowerArch.position.set(0, l3EnclosingSpringY, 0.10);
        encGroup.add(grandTowerArch);

        const grandTowerHood = new THREE.Mesh(
          buildHollowArchRingGeo(l3EnclosingArchR + 0.08, l3EnclosingArchR + 0.16, 0.23, 32),
          portalSandstoneMat
        );
        grandTowerHood.position.set(0, l3EnclosingSpringY, 0.12);
        encGroup.add(grandTowerHood);

        encGroup.updateMatrixWorld(true);
        const encChildren = [...encGroup.children] as THREE.Mesh[];
        encChildren.forEach((child) => {
          const wPos = new THREE.Vector3();
          const wQuat = new THREE.Quaternion();
          child.getWorldPosition(wPos);
          child.getWorldQuaternion(wQuat);
          encGroup.remove(child);
          child.position.copy(wPos);
          child.quaternion.copy(wQuat);
          addCathPart(
            child,
            2,
            child.material === ivoryStoneArchMat ? 0xeae2d6 : 0xd8c3a5
          );
        });
      };

      // Dựng cụm Tầng 3 (Khung vòm lớn + 2 cửa vòm cao + 1 Oculus tròn ở giữa) trên mặt trước, mặt sau và mặt bên ngoài của 2 tháp chuông
      addTowerLevel3ArchEnsemble(tx, towerCenterZ + towerUpperD / 2, 'front');
      addTowerLevel3ArchEnsemble(tx, towerCenterZ - towerUpperD / 2, 'back');
      addTowerLevel3ArchEnsemble(
        tx + sideSign * (towerUpperW / 2),
        towerCenterZ,
        sideSign < 0 ? 'left' : 'right'
      );

      // H. TẦNG 4 (TẦNG CỔ THÁP NGAY DƯỚI CHÓP BẠC — y = baseY + 13.95 .. 17.40):
      //    MỖI MẶT THÁP CÓ 2 Ô CỬA VÒM CAO THÔNG THOÁNG (LOUVERED BELFRY OPENINGS) NGĂN CÁCH BỞI TRỤ MẢNH Ở GIỮA
      const belfryBaseY = baseY + 13.98;
      const belfryWinW = 1.02;
      const belfryWinRectH = 2.42;
      const belfryOffsets = [-0.64, 0.64];

      [-1, 1].forEach((zSign) => {
        const faceZ = towerCenterZ + zSign * (towerUpperD / 2);
        const fDir = zSign > 0 ? 'front' : 'back';

        // Trụ đá mảnh ở chính giữa ngăn cách 2 ô cửa vòm cao Tầng 4
        const centralBelfryPier = new THREE.Mesh(
          new THREE.CylinderGeometry(0.062, 0.068, belfryWinRectH + 0.35, 12),
          ivoryStoneArchMat
        );
        centralBelfryPier.position.set(
          tx,
          belfryBaseY + (belfryWinRectH + 0.35) / 2,
          faceZ + zSign * 0.10
        );
        addCathPart(centralBelfryPier, 2, 0xeae2d6);

        belfryOffsets.forEach((bo) => {
          addArchedOpening(
            tx + bo,
            belfryBaseY,
            faceZ + zSign * 0.01,
            belfryWinW,
            belfryWinRectH,
            0.20,
            fDir,
            whiteLouverMat,
            0x1e1e1e,
            2,
            false
          );
        });
      });

      [-1, 1].forEach((latDir) => {
        const faceX = tx + latDir * (towerUpperW / 2);
        const sDir = latDir < 0 ? 'left' : 'right';

        // Trụ đá mảnh ở chính giữa ngăn cách 2 ô cửa vòm cao Tầng 4 (mặt Đông & Tây)
        const centralBelfryPierLat = new THREE.Mesh(
          new THREE.CylinderGeometry(0.062, 0.068, belfryWinRectH + 0.35, 12),
          ivoryStoneArchMat
        );
        centralBelfryPierLat.position.set(
          faceX + latDir * 0.10,
          belfryBaseY + (belfryWinRectH + 0.35) / 2,
          towerCenterZ
        );
        addCathPart(centralBelfryPierLat, 2, 0xeae2d6);

        belfryOffsets.forEach((bo) => {
          addArchedOpening(
            faceX + latDir * 0.01,
            belfryBaseY,
            towerCenterZ + bo,
            belfryWinW,
            belfryWinRectH,
            0.20,
            sDir,
            whiteLouverMat,
            0x1e1e1e,
            2,
            false
          );
        });
      });

      // I. HÀNG GỜ ĐÁ CON SƠN (CORBEL TABLE / MODILLIONS) NGAY DƯỚI MÉP CHÂN CHÓP THÁP
      // - Ngay dưới mép chân chóp tháp (đỉnh của khối tháp gạch tại towerTopY), bổ sung hàng gờ phào chỉ
      //   nhô ra có các con sơn đá (Corbel table / Modillions) xếp đều đặn như răng cưa chạy quanh 4 mặt tháp.
      const corbelBandY = towerTopY - 0.26;
      const corbelUpperTable = new THREE.Mesh(
        new THREE.BoxGeometry(towerUpperW + 0.34, 0.14, towerUpperD + 0.34),
        limestoneMat
      );
      corbelUpperTable.position.set(tx, corbelBandY + 0.12, towerCenterZ);
      addCathPart(corbelUpperTable, 2, 0xc49a84);

      const corbelSubMolding = new THREE.Mesh(
        new THREE.BoxGeometry(towerUpperW + 0.20, 0.08, towerUpperD + 0.20),
        limestoneMat
      );
      corbelSubMolding.position.set(tx, corbelBandY + 0.02, towerCenterZ);
      addCathPart(corbelSubMolding, 2, 0xb58973);

      // Các con sơn đá (Modillions) xếp đều đặn như răng cưa trên cả 4 mặt Đông-Tây-Nam-Bắc
      const modillionCount = 11;
      const modSpan = towerUpperW - 0.44;
      for (let mIdx = 0; mIdx < modillionCount; mIdx++) {
        const offsetAlongFace = -modSpan / 2 + (mIdx / (modillionCount - 1)) * modSpan;
        [-1, 1].forEach((sideDir) => {
          // Con sơn mặt Trước & Sau (Nam & Bắc)
          const modFB = new THREE.Mesh(
            new THREE.BoxGeometry(0.13, 0.22, 0.20),
            limestoneMat
          );
          modFB.position.set(
            tx + offsetAlongFace,
            corbelBandY - 0.06,
            towerCenterZ + sideDir * (towerUpperD / 2 + 0.08)
          );
          addCathPart(modFB, 2, 0xb58973);

          // Bậc con sơn nhỏ phía dưới tạo dáng vát cổ điển
          const modStepFB = new THREE.Mesh(
            new THREE.BoxGeometry(0.11, 0.10, 0.12),
            limestoneMat
          );
          modStepFB.position.set(
            tx + offsetAlongFace,
            corbelBandY - 0.20,
            towerCenterZ + sideDir * (towerUpperD / 2 + 0.04)
          );
          addCathPart(modStepFB, 2, 0xb58973);

          // Con sơn mặt Trái & Phải (Tây & Đông)
          const modLR = new THREE.Mesh(
            new THREE.BoxGeometry(0.20, 0.22, 0.13),
            limestoneMat
          );
          modLR.position.set(
            tx + sideDir * (towerUpperW / 2 + 0.08),
            corbelBandY - 0.06,
            towerCenterZ + offsetAlongFace
          );
          addCathPart(modLR, 2, 0xb58973);

          const modStepLR = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.10, 0.11),
            limestoneMat
          );
          modStepLR.position.set(
            tx + sideDir * (towerUpperW / 2 + 0.04),
            corbelBandY - 0.20,
            towerCenterZ + offsetAlongFace
          );
          addCathPart(modStepLR, 2, 0xb58973);
        });
      }

      // Đế sàn đỉnh tháp vuông (nơi tiếp giáp giữa thân tháp vuông và chân chóp bát giác)
      const deckSlab = new THREE.Mesh(
        new THREE.BoxGeometry(towerW + 0.16, 0.18, towerD + 0.16),
        limestoneMat
      );
      deckSlab.position.set(tx, towerTopY + 0.14, towerCenterZ);
      addCathPart(deckSlab, 3, 0xc49a84);

      // J. CHÓP THÁP BÁT GIÁC LỢP TẤM XẾP LỚP NGANG, 4 MẶT VÁT GÓC (BROACH SLOPES),
      //    4 CỬA MÁI VÒM 3 LÁ (TREFOIL LUCARNES), 8 GỜ SƯỜN ĐÍNH MẤU MÓC (CROCHETS),
      //    CỬA THÔNG GIÓ TRÒN (OCULUS VENTS) & QUẢ CẦU + THÁNH GIÁ KIM LOẠI TỐI (#26292E)
      // - Đã xóa bỏ hoàn toàn 4 tháp nhọn nhỏ ở 4 góc chân chóp.
      const spireBaseY = towerTopY + 0.22;
      const spireRadius = 2.42; // Bán kính đường tròn ngoại tiếp 8 đỉnh chóp bát giác
      const spireH = 13.8;
      const spireInradius = spireRadius * Math.cos(Math.PI / 8); // ~2.236 (khoảng cách từ tâm ra 8 mặt phẳng)

      const rawSpireGeo = new THREE.ConeGeometry(spireRadius, spireH, 8);
      rawSpireGeo.rotateY(Math.PI / 8); // Xoay để 4 mặt phẳng chính hướng đúng Đông-Tây-Nam-Bắc, 4 mặt chéo hướng ĐB-ĐN-TN-TB
      const sharpSpireGeo = rawSpireGeo.toNonIndexed();
      sharpSpireGeo.computeVertexNormals();
      rawSpireGeo.dispose();

      const mainSpire = new THREE.Mesh(sharpSpireGeo, spireStoneMat);
      mainSpire.position.set(tx, spireBaseY + spireH / 2, towerCenterZ);
      addCathPart(mainSpire, 3, 0xbcc2c8);

      // J1. 4 MẶT VÁT CHUYỂN TIẾP Ở 4 GÓC (BROACH SLOPES):
      //     Ôm mượt từ 4 góc vuông của đỉnh tháp vuông vào 4 mặt chéo của chóp bát giác
      const halfSq = towerW / 2 - 0.02; // 2.28
      const broachApexH = 2.65; // Độ cao đỉnh vát ôm mượt vào mặt chéo của chóp bát giác
      const broachScaleAtApex = 1 - broachApexH / spireH;

      [-1, 1].forEach((cxS) => {
        [-1, 1].forEach((czS) => {
          // Góc vuông ngoài của đỉnh tháp (Corner C)
          const cornerX = cxS * halfSq;
          const cornerZ = czS * halfSq;

          // 2 đỉnh bát giác kề góc vuông tại cao độ chân chóp (y = 0)
          const vAx = cxS * spireRadius * Math.cos(Math.PI / 8);
          const vAz = czS * spireRadius * Math.sin(Math.PI / 8);
          const vBx = cxS * spireRadius * Math.sin(Math.PI / 8);
          const vBz = czS * spireRadius * Math.cos(Math.PI / 8);

          // Đỉnh trên của mặt vát (T) nằm ôm khít vào tâm mặt chéo của chóp bát giác tại cao độ broachApexH
          const diagMidX = ((vAx + vBx) * 0.5) * broachScaleAtApex;
          const diagMidZ = ((vAz + vBz) * 0.5) * broachScaleAtApex;

          const bPos: number[] = [];
          const bUvs: number[] = [];
          const pushBroachTri = (
            p1x: number,
            p1y: number,
            p1z: number,
            u1: number,
            v1: number,
            p2x: number,
            p2y: number,
            p2z: number,
            u2: number,
            v2: number,
            p3x: number,
            p3y: number,
            p3z: number,
            u3: number,
            v3: number
          ) => {
            // Đảm bảo pháp tuyến luôn hướng ra ngoài góc (cxS, +, czS)
            const e1x = p2x - p1x;
            const e1y = p2y - p1y;
            const e1z = p2z - p1z;
            const e2x = p3x - p1x;
            const e2y = p3y - p1y;
            const e2z = p3z - p1z;
            const nx = e1y * e2z - e1z * e2y;
            const ny = e1z * e2x - e1x * e2z;
            const nz = e1x * e2y - e1y * e2x;
            const dotOut = nx * cxS + ny * 0.5 + nz * czS;
            if (dotOut >= 0) {
              bPos.push(p1x, p1y, p1z, p2x, p2y, p2z, p3x, p3y, p3z);
              bUvs.push(u1, v1, u2, v2, u3, v3);
            } else {
              bPos.push(p1x, p1y, p1z, p3x, p3y, p3z, p2x, p2y, p2z);
              bUvs.push(u1, v1, u3, v3, u2, v2);
            }
          };

          // 2 mặt vát tam giác từ góc tháp vuông (C) vuốt lên đỉnh vát (T) và 2 cạnh sườn bát giác (A, B)
          pushBroachTri(
            cornerX, 0, cornerZ, 0.5, 0,
            vAx, 0, vAz, 0, 0,
            diagMidX, broachApexH, diagMidZ, 0.5, 1
          );
          pushBroachTri(
            cornerX, 0, cornerZ, 0.5, 0,
            diagMidX, broachApexH, diagMidZ, 0.5, 1,
            vBx, 0, vBz, 1, 0
          );
          // Mặt đáy khép kín
          pushBroachTri(
            cornerX, 0, cornerZ, 0.5, 0,
            vBx, 0, vBz, 1, 0,
            vAx, 0, vAz, 0, 0
          );

          const broachGeo = new THREE.BufferGeometry();
          broachGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
          broachGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bUvs, 2));
          broachGeo.computeVertexNormals();

          const broachMesh = new THREE.Mesh(broachGeo, spireStoneMat);
          broachMesh.position.set(tx, spireBaseY, towerCenterZ);
          addCathPart(broachMesh, 3, 0xbcc2c8);

          // Sống gờ mảnh chạy dọc đường vát góc từ góc vuông lên mặt chóp bát giác
          const broachRibStart = new THREE.Vector3(tx + cornerX, spireBaseY + 0.02, towerCenterZ + cornerZ);
          const broachRibEnd = new THREE.Vector3(tx + diagMidX, spireBaseY + broachApexH, towerCenterZ + diagMidZ);
          const broachRibLen = broachRibStart.distanceTo(broachRibEnd);
          const broachRibMid = broachRibStart.clone().add(broachRibEnd).multiplyScalar(0.5);
          const broachRibDir = broachRibEnd.clone().sub(broachRibStart).normalize();
          const broachRib = new THREE.Mesh(
            new THREE.BoxGeometry(0.075, 0.075, broachRibLen),
            spireRibMat
          );
          broachRib.position.copy(broachRibMid);
          broachRib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), broachRibDir);
          addCathPart(broachRib, 3, 0x9aa2ab);
        });
      });

      // J2. 8 ĐƯỜNG GỜ NỔI CHẠY DỌC 8 CẠNH SƯỜN TỪ CHÂN LÊN ĐỈNH & HÀNG MẤU MÓC NHỎ (CROCHETS / STEPS)
      for (let rIdx = 0; rIdx < 8; rIdx++) {
        const ribAngle = (rIdx * Math.PI) / 4 + Math.PI / 8;
        const cosR = Math.cos(ribAngle);
        const sinR = Math.sin(ribAngle);

        const pBase = new THREE.Vector3(
          tx + spireRadius * cosR,
          spireBaseY,
          towerCenterZ + spireRadius * sinR
        );
        const pApex = new THREE.Vector3(tx, spireBaseY + spireH, towerCenterZ);
        const ribLen = pBase.distanceTo(pApex);
        const ribMid = pBase.clone().add(pApex).multiplyScalar(0.5);
        const ribDir = pApex.clone().sub(pBase).normalize();

        // Đường gờ nổi chạy dọc cạnh sườn
        const arrisRib = new THREE.Mesh(
          new THREE.BoxGeometry(0.09, 0.09, ribLen),
          spireRibMat
        );
        arrisRib.position.copy(ribMid);
        arrisRib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ribDir);
        addCathPart(arrisRib, 3, 0x9aa2ab);

        // Hàng mấu móc nhỏ (Crochets / Steps) nhô ra đều đặn dọc theo cả 8 cạnh sườn
        const crochetCount = 18;
        for (let cStep = 1; cStep <= crochetCount; cStep++) {
          const t = 0.06 + (cStep / (crochetCount + 1)) * 0.86;
          const cPos = pBase.clone().lerp(pApex, t);
          const crochetScale = 1 - t * 0.45;
          const crochetMesh = new THREE.Mesh(
            new THREE.BoxGeometry(
              0.095 * crochetScale,
              0.13 * crochetScale,
              0.16 * crochetScale
            ),
            spireRibMat
          );
          // Đẩy nhẹ ra ngoài theo hướng bán kính cạnh sườn
          crochetMesh.position.set(
            cPos.x + cosR * (0.065 * crochetScale),
            cPos.y,
            cPos.z + sinR * (0.065 * crochetScale)
          );
          crochetMesh.rotation.y = Math.atan2(cosR, sinR);
          crochetMesh.rotation.x = -0.32;
          addCathPart(crochetMesh, 3, 0x9aa2ab);
        }
      }

      // J3. CÁC Ô CỬA THÔNG GIÓ HÌNH TRÒN CÓ VIỀN NỔI (OCULUS VENTS) Ở KHOẢNG 2/3 CHIỀU CAO CHÓP THÁP
      const ventHeightRatio = 0.66; // Đúng 2/3 chiều cao chóp tháp
      const ventY = spireBaseY + spireH * ventHeightRatio;
      const faceDistAtVent = spireInradius * (1 - ventHeightRatio);
      const spireSlopeTilt = Math.atan2(spireInradius, spireH); // Góc nghiêng mặt chóp (~9.2°)

      for (let fIdx = 0; fIdx < 8; fIdx++) {
        const faceAng = (fIdx * Math.PI) / 4; // 8 mặt chóp (0°, 45°, 90°, ...)
        const fnx = Math.sin(faceAng);
        const fnz = Math.cos(faceAng);

        const ventGroup = new THREE.Group();
        ventGroup.position.set(
          tx + fnx * (faceDistAtVent + 0.015),
          ventY,
          towerCenterZ + fnz * (faceDistAtVent + 0.015)
        );
        ventGroup.rotation.y = faceAng;
        ventGroup.rotation.x = -spireSlopeTilt; // Áp phẳng theo độ dốc mặt chóp bát giác

        // Viền nổi hình tròn (Raised Circular Rim)
        const ventRim = new THREE.Mesh(
          new THREE.TorusGeometry(0.18, 0.038, 10, 20),
          spireRibMat
        );
        ventRim.position.set(0, 0, 0.02);
        ventGroup.add(ventRim);

        // Lõi thông gió tối sâu bên trong
        const ventCore = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.15, 0.04, 18),
          darkLouverMat
        );
        ventCore.rotation.x = Math.PI / 2;
        ventCore.position.set(0, 0, 0.005);
        ventGroup.add(ventCore);

        ventGroup.updateMatrixWorld(true);
        const vChildren = [...ventGroup.children] as THREE.Mesh[];
        vChildren.forEach((vc) => {
          const wPos = new THREE.Vector3();
          const wQuat = new THREE.Quaternion();
          vc.getWorldPosition(wPos);
          vc.getWorldQuaternion(wQuat);
          ventGroup.remove(vc);
          vc.position.copy(wPos);
          vc.quaternion.copy(wQuat);
          addCathPart(vc, 3, vc.material === darkLouverMat ? 0x1e1e1e : 0x9aa2ab);
        });
      }

      // J4. 4 KHỐI CỬA MÁI VÒM BA LÁ NHÔ RA (TREFOIL-ARCHED LUCARNES / DORMER GABLES)
      //     Tại chính giữa 4 mặt (Đông, Tây, Nam, Bắc) của chân chóp tháp:
      //     - Mái dốc chữ A nhọn vươn ra ngoài
      //     - Mặt trước đục vòm hình 3 lá (Trefoil arch) rỗng bên trong, đỡ bởi 2 cột trụ tròn mảnh ở 2 bên góc trước
      //     - Trên sống mái của 4 cửa mái nhỏ có hàng lan can sắt mảnh (iron cresting) và 1 cây Thánh giá nhỏ ở đầu chóp mái chữ A
      const lucW = 0.88;
      const lucBodyH = 1.55;
      const lucGableH = 1.05;
      const lucDepth = 1.05;
      const lucCenterDist = spireInradius - 0.18; // Nhô hẳn ra ngoài mặt chân chóp bát giác

      // Helper tạo mặt trước đục lỗ vòm 3 lá (Hollow Trefoil Arch Front Wall) thật sự rỗng bên trong
      const buildTrefoilPiercedWallGeo = (
        wallW: number,
        rectH: number,
        gableH: number,
        thick: number
      ): THREE.BufferGeometry => {
        const outer = new THREE.Shape();
        outer.moveTo(-wallW / 2, 0);
        outer.lineTo(wallW / 2, 0);
        outer.lineTo(wallW / 2, rectH);
        outer.lineTo(0, rectH + gableH);
        outer.lineTo(-wallW / 2, rectH);
        outer.closePath();

        // Lỗ đục vòm 3 lá (Trefoil opening path) ở chính giữa mặt trước
        const openHalfW = wallW * 0.30;
        const jambTopY = rectH * 0.58;
        const lobeR = openHalfW * 0.56;
        const hole = new THREE.Path();
        hole.moveTo(-openHalfW, 0.06);
        hole.lineTo(openHalfW, 0.06);
        hole.lineTo(openHalfW, jambTopY - lobeR * 0.2);
        // Thùy lá bên phải (Right foil)
        hole.absarc(openHalfW * 0.52, jambTopY + lobeR * 0.15, lobeR, -Math.PI * 0.15, Math.PI * 0.65, false);
        // Thùy lá đỉnh giữa (Top central trefoil lobe)
        hole.absarc(0, jambTopY + lobeR * 1.05, lobeR * 1.05, 0, Math.PI, false);
        // Thùy lá bên trái (Left foil)
        hole.absarc(-openHalfW * 0.52, jambTopY + lobeR * 0.15, lobeR, Math.PI * 0.35, Math.PI * 1.15, false);
        hole.lineTo(-openHalfW, 0.06);
        outer.holes.push(hole);

        const raw = new THREE.ExtrudeGeometry(outer, {
          depth: thick,
          bevelEnabled: false,
          curveSegments: 18,
        });
        raw.translate(0, 0, -thick / 2);
        const sharp = raw.toNonIndexed();
        sharp.computeVertexNormals();
        raw.dispose();
        return sharp;
      };

      const trefoilFrontWallGeo = buildTrefoilPiercedWallGeo(lucW, lucBodyH, lucGableH, 0.12);
      const lucRoofHalfSpan = lucW / 2 + 0.10;
      const lucSlopeLen = Math.hypot(lucRoofHalfSpan, lucGableH);
      const lucSlopeAng = Math.atan2(lucGableH, lucRoofHalfSpan);

      [
        { dx: 0, dz: lucCenterDist, rotY: 0 },            // Nam (Mặt tiền)
        { dx: 0, dz: -lucCenterDist, rotY: Math.PI },     // Bắc (Mặt sau)
        { dx: -lucCenterDist, dz: 0, rotY: -Math.PI / 2 },// Tây (Trái)
        { dx: lucCenterDist, dz: 0, rotY: Math.PI / 2 },  // Đông (Phải)
      ].forEach(({ dx, dz, rotY }) => {
        const lucGroup = new THREE.Group();
        lucGroup.position.set(tx + dx, spireBaseY, towerCenterZ + dz);
        lucGroup.rotation.y = rotY;

        // 1. Hai vách bên của khối cửa mái (Side cheeks) tạo khoang rỗng bên trong
        [-1, 1].forEach((sSide) => {
          const sideWall = new THREE.Mesh(
            new THREE.BoxGeometry(0.11, lucBodyH, lucDepth),
            limestoneMat
          );
          sideWall.position.set(sSide * (lucW / 2 - 0.055), lucBodyH / 2, 0);
          lucGroup.add(sideWall);
        });

        // Hốc tối phía sâu bên trong cửa mái để làm nổi bật vòm 3 lá rỗng phía trước
        const recessBack = new THREE.Mesh(
          new THREE.BoxGeometry(lucW - 0.20, lucBodyH + lucGableH * 0.5, 0.08),
          darkRecessCavityMat
        );
        recessBack.position.set(0, (lucBodyH + lucGableH * 0.5) / 2, 0.10);
        lucGroup.add(recessBack);

        // 2. Mặt trước đục vòm hình 3 lá (Trefoil arch) rỗng bên trong bằng đá cát nâu hồng (#C49A84)
        const frontPiercedWall = new THREE.Mesh(trefoilFrontWallGeo, limestoneMat);
        frontPiercedWall.position.set(0, 0, lucDepth / 2 - 0.04);
        lucGroup.add(frontPiercedWall);

        // Viền gờ vòm 3 lá (Trefoil Archivolt Cusp Rings) nổi sắc nét quanh miệng vòm
        const jambTopY = lucBodyH * 0.58;
        const openHalfW = lucW * 0.30;
        const lobeR = openHalfW * 0.56;
        [
          { cx: -openHalfW * 0.52, cy: jambTopY + lobeR * 0.15, r: lobeR + 0.025, start: Math.PI * 0.15, arc: Math.PI * 0.95 },
          { cx: 0, cy: jambTopY + lobeR * 1.05, r: lobeR * 1.05 + 0.025, start: -Math.PI * 0.05, arc: Math.PI * 1.10 },
          { cx: openHalfW * 0.52, cy: jambTopY + lobeR * 0.15, r: lobeR + 0.025, start: -Math.PI * 0.10, arc: Math.PI * 0.95 },
        ].forEach((foil) => {
          const foilArch = new THREE.Mesh(
            new THREE.TorusGeometry(foil.r, 0.026, 8, 16, foil.arc),
            limestoneMat
          );
          foilArch.position.set(foil.cx, foil.cy, lucDepth / 2 + 0.025);
          foilArch.rotation.z = foil.start;
          lucGroup.add(foilArch);
        });

        // 3. Hai cột trụ tròn mảnh (Slender Round Colonnettes) kèm đế & đầu cột ở hai bên góc trước đỡ vòm 3 lá
        const colH = jambTopY - 0.06;
        [-1, 1].forEach((cSide) => {
          const colX = cSide * (openHalfW + 0.055);
          const colZ = lucDepth / 2 + 0.035;

          const colBase = new THREE.Mesh(
            new THREE.BoxGeometry(0.11, 0.09, 0.11),
            limestoneMat
          );
          colBase.position.set(colX, 0.045, colZ);
          lucGroup.add(colBase);

          const colonnette = new THREE.Mesh(
            new THREE.CylinderGeometry(0.036, 0.040, colH, 12),
            limestoneMat
          );
          colonnette.position.set(colX, 0.09 + colH / 2, colZ);
          lucGroup.add(colonnette);

          const colCapital = new THREE.Mesh(
            new THREE.CylinderGeometry(0.062, 0.040, 0.10, 12),
            limestoneMat
          );
          colCapital.position.set(colX, 0.09 + colH + 0.04, colZ);
          lucGroup.add(colCapital);
        });

        // 4. Mái dốc chữ A nhọn (Steeply Pitched A-Frame Gable Roof) vươn ra ngoài
        [-1, 1].forEach((rSide) => {
          const slopeSlab = new THREE.Mesh(
            new THREE.BoxGeometry(lucSlopeLen + 0.06, 0.08, lucDepth + 0.18),
            spireStoneMat
          );
          slopeSlab.position.set(
            rSide * (lucRoofHalfSpan / 2),
            lucBodyH + lucGableH / 2 + 0.03,
            0.04
          );
          slopeSlab.rotation.z = -rSide * lucSlopeAng;
          lucGroup.add(slopeSlab);

          // Gờ viền đá cát nâu hồng ở diềm trước mái chữ A (Gable Raking Trim)
          const gableRake = new THREE.Mesh(
            new THREE.BoxGeometry(lucSlopeLen + 0.08, 0.07, 0.09),
            limestoneMat
          );
          gableRake.position.set(
            rSide * (lucRoofHalfSpan / 2),
            lucBodyH + lucGableH / 2 + 0.04,
            lucDepth / 2 + 0.09
          );
          gableRake.rotation.z = -rSide * lucSlopeAng;
          lucGroup.add(gableRake);
        });

        // 5. Hàng lan can sắt mảnh (Iron Cresting) chạy dọc trên sống mái của cửa mái nhỏ
        const ridgeY = lucBodyH + lucGableH + 0.07;
        const crestBottomRail = new THREE.Mesh(
          new THREE.BoxGeometry(0.025, 0.025, lucDepth + 0.08),
          darkIronCrossMat
        );
        crestBottomRail.position.set(0, ridgeY + 0.02, 0.02);
        lucGroup.add(crestBottomRail);

        const crestTopRail = new THREE.Mesh(
          new THREE.BoxGeometry(0.025, 0.025, lucDepth + 0.08),
          darkIronCrossMat
        );
        crestTopRail.position.set(0, ridgeY + 0.16, 0.02);
        lucGroup.add(crestTopRail);

        const picketCount = 7;
        for (let pIdx = 0; pIdx < picketCount; pIdx++) {
          const pz = -lucDepth * 0.42 + (pIdx / (picketCount - 1)) * (lucDepth * 0.88);
          const picket = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.012, 0.20, 6),
            darkIronCrossMat
          );
          picket.position.set(0, ridgeY + 0.10, pz);
          lucGroup.add(picket);
        }

        // 6. 1 Cây Thánh giá nhỏ ở đầu chóp mái chữ A của mỗi cửa mái (Lucarne Gable Apex Cross)
        const lucCrossZ = lucDepth / 2 + 0.11;
        const lucCrossPedestal = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.055, 0.12, 8),
          limestoneMat
        );
        lucCrossPedestal.position.set(0, ridgeY + 0.04, lucCrossZ);
        lucGroup.add(lucCrossPedestal);

        const lucCrossV = new THREE.Mesh(
          new THREE.BoxGeometry(0.032, 0.44, 0.032),
          darkIronCrossMat
        );
        lucCrossV.position.set(0, ridgeY + 0.30, lucCrossZ);
        lucGroup.add(lucCrossV);

        const lucCrossH = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.032, 0.032),
          darkIronCrossMat
        );
        lucCrossH.position.set(0, ridgeY + 0.37, lucCrossZ);
        lucGroup.add(lucCrossH);

        lucGroup.updateMatrixWorld(true);
        const children = [...lucGroup.children] as THREE.Mesh[];
        children.forEach((child) => {
          const wPos = new THREE.Vector3();
          const wQuat = new THREE.Quaternion();
          child.getWorldPosition(wPos);
          child.getWorldQuaternion(wQuat);
          lucGroup.remove(child);
          child.position.copy(wPos);
          child.quaternion.copy(wQuat);
          const m = child.material as THREE.MeshStandardMaterial;
          const hexColor =
            m === darkIronCrossMat
              ? 0x26292e
              : m === darkRecessCavityMat
                ? 0x181a20
                : m === spireStoneMat
                  ? 0xbcc2c8
                  : 0xc49a84;
          addCathPart(child, 3, hexColor);
        });
      });

      // J5. ĐỈNH CHÓP BÁT GIÁC: ĐẾ TRỤ TRÒN NHỎ + QUẢ CẦU (ORB FINIAL) + THÁNH GIÁ KIM LOẠI TỐI MÀU (#26292E)
      const spireTopY = spireBaseY + spireH;

      // Đế trụ tròn nhỏ (Circular Moulded Pedestal) trên đỉnh chóp bát giác
      const finialPedestalLower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.20, 0.25, 0.22, 16),
        spireRibMat
      );
      finialPedestalLower.position.set(tx, spireTopY + 0.08, towerCenterZ);
      addCathPart(finialPedestalLower, 3, 0x9aa2ab);

      const finialPedestalNeck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.18, 0.18, 16),
        spireRibMat
      );
      finialPedestalNeck.position.set(tx, spireTopY + 0.26, towerCenterZ);
      addCathPart(finialPedestalNeck, 3, 0x9aa2ab);

      // Quả cầu (Orb Finial) đặt trên đế trụ tròn
      const finialOrb = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 18, 18),
        spireRibMat
      );
      finialOrb.position.set(tx, spireTopY + 0.50, towerCenterZ);
      addCathPart(finialOrb, 3, 0x9aa2ab);

      // Cây Thánh giá kim loại tối màu (#26292E) gắn trên đỉnh Quả cầu
      const crossBaseY = spireTopY + 0.68;
      const crossShaftH = 2.35;
      const crossShaft = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, crossShaftH, 0.08),
        darkIronCrossMat
      );
      crossShaft.position.set(tx, crossBaseY + crossShaftH / 2, towerCenterZ);
      addCathPart(crossShaft, 3, 0x26292e);

      const crossArmY = crossBaseY + crossShaftH * 0.68;
      const crossArmW = 1.16;
      const crossArm = new THREE.Mesh(
        new THREE.BoxGeometry(crossArmW, 0.08, 0.08),
        darkIronCrossMat
      );
      crossArm.position.set(tx, crossArmY, towerCenterZ);
      addCathPart(crossArm, 3, 0x26292e);

      // Vòng hoa văn sắt nghệ thuật tại tâm giao chữ thập của Thánh giá đỉnh tháp
      const crossCenterRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.022, 8, 20),
        darkIronCrossMat
      );
      crossCenterRing.position.set(tx, crossArmY, towerCenterZ);
      addCathPart(crossCenterRing, 3, 0x26292e);
    });

    // =========================================================================
    // 5. THÂN CHÍNH (NAVE & CHOIR BAY — WIDTH = 11.0) & HÀNH LANG BÊN (AISLES — WIDTH = 17.0)
    // - Thân nhà thờ chính (width = 11.0, x = ±5.50) và hành lang bên (width = 17.0, x = ±8.50)
    //   chạy từ mặt tiền 2 tháp chuông (z = +7.0) qua Cánh ngang (z = -8.8 .. -14.2) và
    //   KÉO DÀI TIẾP RA PHÍA SAU thêm 1 nhịp lớn (5.5 đơn vị, từ z = -14.2 đến z = -19.7)
    //   rồi mới kết thúc bằng khối Hậu cung 3 tầng đa giác (tại apseZ = -19.7).
    // - Nhờ vậy bức tường ngang của Transept KHÔNG BAO GIỜ che khuất phía sau.
    // =========================================================================
    const naveStartZ = 7.0;
    const naveEndZ = -19.7; // Kéo dài ra sau Cánh ngang (-14.2) đúng 5.5 đơn vị tới -19.7
    const naveLength = naveStartZ - naveEndZ; // 26.7
    const naveCenterZ = (naveStartZ + naveEndZ) / 2; // -6.35
    const centralNaveW = 11.0; // x = -5.50 .. +5.50 (khớp 100% với bán kính Tầng 1 Hậu cung R1 = 5.50)
    const centralNaveH = 13.60;
    const sideAisleH = 7.20;
    const fullAisleW = 17.0; // x = -8.50 .. +8.50 (khớp 100% với bán kính Tầng 2 Hậu cung R2 = 8.50 & bề rộng 2 tháp chuông)

    // 5 Nhịp hành lang bên phía trước Cánh ngang (từ z = +6.98 đến z = -8.78)
    const aisleFrontZ = 6.98;
    const aisleBackZ = -8.78;
    const aisleTotalLen = aisleFrontZ - aisleBackZ; // 15.76
    const aisleMidZ = (aisleFrontZ + aisleBackZ) / 2; // -0.90

    // A. Chân đế đá hoa cương & Khối 2 hành lang bên phía trước Cánh ngang
    const navePlinth = new THREE.Mesh(
      new THREE.BoxGeometry(fullAisleW + 0.24, 0.85, aisleTotalLen),
      granitePlinthMat
    );
    navePlinth.position.set(0, baseY + 0.425, aisleMidZ);
    addCathPart(navePlinth, 1, 0x64748b);

    const sideAislesBody = new THREE.Mesh(
      new THREE.BoxGeometry(fullAisleW, sideAisleH - 0.85, aisleTotalLen),
      marseilleBrickMat
    );
    sideAislesBody.position.set(0, baseY + 0.85 + (sideAisleH - 0.85) / 2, aisleMidZ);
    addCathPart(sideAislesBody, 1, 0xa84830);

    const aisleCornice = new THREE.Mesh(
      new THREE.BoxGeometry(fullAisleW + 0.18, 0.16, aisleTotalLen),
      limestoneMat
    );
    aisleCornice.position.set(0, baseY + sideAisleH - 0.08, aisleMidZ);
    addCathPart(aisleCornice, 1, 0xc2b29a);

    // B. Mái ngói dốc thoải hành lang bên (ôm từ x = ±8.72, y = baseY + 7.20 lên tường thân chính x = ±5.50, y = baseY + 8.55)
    const aisleRoofRise = 1.35;
    const aisleRoofSpanX = (fullAisleW / 2 + 0.22) - centralNaveW / 2; // 8.72 - 5.50 = 3.22
    const aisleRoofSlopeLen = Math.hypot(aisleRoofSpanX, aisleRoofRise);
    const aisleRoofAngle = Math.atan2(aisleRoofRise, aisleRoofSpanX);
    const aisleRoofMidX = (fullAisleW / 2 + 0.22 + centralNaveW / 2) / 2; // 7.11

    const buttressZList = [6.90, 3.76, 0.62, -2.52, -5.66, -8.74];
    const bayCenterZList = [5.33, 2.19, -0.95, -4.09, -7.23];

    [-1, 1].forEach((sideS) => {
      const sideFacing = sideS < 0 ? 'left' : 'right';
      const outerWallX = sideS * (fullAisleW / 2); // ±8.50
      const upperWallX = sideS * (centralNaveW / 2); // ±5.50

      // Tấm mái ngói dốc liền mạch cho 5 nhịp hành lang bên phía trước Cánh ngang
      const aisleRoofSlab = new THREE.Mesh(
        new THREE.BoxGeometry(aisleRoofSlopeLen, 0.14, aisleTotalLen),
        cathedralRoofTileMat
      );
      aisleRoofSlab.position.set(
        sideS * aisleRoofMidX,
        baseY + sideAisleH + aisleRoofRise / 2,
        aisleMidZ
      );
      aisleRoofSlab.rotation.z = -sideS * aisleRoofAngle;
      addCathPart(aisleRoofSlab, 2, 0xb85238);

      // Gờ đá trắng xám viền diềm mái hành lang bên
      const aisleEaveTrim = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.15, aisleTotalLen + 0.04),
        limestoneMat
      );
      aisleEaveTrim.position.set(
        sideS * (fullAisleW / 2 + 0.20),
        baseY + sideAisleH + 0.04,
        aisleMidZ
      );
      addCathPart(aisleEaveTrim, 2, 0xc2b29a);

      bayCenterZList.forEach((bayZ) => {
        // Cửa sổ vòm tầng dưới (Side-Aisle Arched Window)
        addArchedOpening(
          outerWallX + sideS * 0.01,
          baseY + 1.85,
          bayZ,
          1.18,
          2.65,
          0.14,
          sideFacing,
          stainedWindowGlassMat,
          0x1c314d,
          1,
          true
        );

        // Cửa sổ vòm tầng trên (Clerestory Arched Window — nằm cao hơn mái hành lang bên tại baseY + 8.55)
        addArchedOpening(
          upperWallX + sideS * 0.01,
          baseY + 9.25,
          bayZ,
          1.12,
          2.10,
          0.14,
          sideFacing,
          stainedWindowGlassMat,
          0x1c314d,
          2,
          true
        );
      });

      // Các trụ ốp sát tường (Engaged Pilasters) bằng đá trắng xám (limestoneMat)
      buttressZList.forEach((bz) => {
        const outerPier = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, sideAisleH, 0.28),
          limestoneMat
        );
        outerPier.position.set(outerWallX + sideS * 0.08, baseY + sideAisleH / 2, bz);
        addCathPart(outerPier, 1, 0xc2b29a);

        const upperPilaster = new THREE.Mesh(
          new THREE.BoxGeometry(0.20, centralNaveH - (sideAisleH + aisleRoofRise), 0.24),
          limestoneMat
        );
        upperPilaster.position.set(
          upperWallX + sideS * 0.06,
          baseY + sideAisleH + aisleRoofRise + (centralNaveH - sideAisleH - aisleRoofRise) / 2,
          bz
        );
        addCathPart(upperPilaster, 2, 0xc2b29a);
      });
    });

    // C. NHỊP THÂN CHÍNH & HÀNH LANG BÊN KÉO DÀI RA PHÍA SAU CÁNH NGANG (CHOIR BAY & CHOIR AISLES)
    //    Kéo dài đúng 5.5 đơn vị từ sau Cánh ngang (z = -14.20) ra tới tâm Hậu cung (z = -19.70),
    //    bề rộng thân chính centralNaveW = 11.0 (x = ±5.50) và hành lang bên fullAisleW = 17.0 (x = ±8.50).
    const choirAisleStartZ = -14.22;
    const choirAisleEndZ = -19.70;
    const choirAisleLen = choirAisleStartZ - choirAisleEndZ; // 5.48 (~5.5 đơn vị)
    const choirAisleMidZ = (choirAisleStartZ + choirAisleEndZ) / 2; // -16.96

    const choirAislePlinth = new THREE.Mesh(
      new THREE.BoxGeometry(fullAisleW + 0.24, 0.85, choirAisleLen),
      granitePlinthMat
    );
    choirAislePlinth.position.set(0, baseY + 0.425, choirAisleMidZ);
    addCathPart(choirAislePlinth, 1, 0x64748b);

    const choirAisleBody = new THREE.Mesh(
      new THREE.BoxGeometry(fullAisleW, sideAisleH - 0.85, choirAisleLen),
      marseilleBrickMat
    );
    choirAisleBody.position.set(0, baseY + 0.85 + (sideAisleH - 0.85) / 2, choirAisleMidZ);
    addCathPart(choirAisleBody, 1, 0xa84830);

    const choirAisleCornice = new THREE.Mesh(
      new THREE.BoxGeometry(fullAisleW + 0.18, 0.16, choirAisleLen),
      limestoneMat
    );
    choirAisleCornice.position.set(0, baseY + sideAisleH - 0.08, choirAisleMidZ);
    addCathPart(choirAisleCornice, 1, 0xc2b29a);

    const choirBayZList = [-15.58, -18.32];
    const choirButtressZList = [-14.26, -16.95, -19.66];

    [-1, 1].forEach((sideS) => {
      const sideFacing = sideS < 0 ? 'left' : 'right';
      const outerWallX = sideS * (fullAisleW / 2); // ±8.50
      const upperWallX = sideS * (centralNaveW / 2); // ±5.50

      // Mái ngói dốc thoải của Choir Aisles (dài 5.5 đơn vị nối vào mái Tầng 2 Hậu cung)
      const choirLeanToRoof = new THREE.Mesh(
        new THREE.BoxGeometry(aisleRoofSlopeLen, 0.14, choirAisleLen),
        cathedralRoofTileMat
      );
      choirLeanToRoof.position.set(
        sideS * aisleRoofMidX,
        baseY + sideAisleH + aisleRoofRise / 2,
        choirAisleMidZ
      );
      choirLeanToRoof.rotation.z = -sideS * aisleRoofAngle;
      addCathPart(choirLeanToRoof, 2, 0xb85238);

      const choirEaveTrim = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.15, choirAisleLen + 0.04),
        limestoneMat
      );
      choirEaveTrim.position.set(
        sideS * (fullAisleW / 2 + 0.20),
        baseY + sideAisleH + 0.04,
        choirAisleMidZ
      );
      addCathPart(choirEaveTrim, 2, 0xc2b29a);

      // 2 Nhịp cửa sổ vòm tầng trên (Choir Clerestory + Oculus phía trên) & cửa sổ hành lang sau
      choirBayZList.forEach((cBayZ) => {
        addArchedOpening(
          upperWallX + sideS * 0.01,
          baseY + 8.92,
          cBayZ,
          1.06,
          1.95,
          0.14,
          sideFacing,
          stainedWindowGlassMat,
          0x1c314d,
          2,
          true
        );

        addOculusRoundWindow(
          upperWallX + sideS * 0.015,
          baseY + 12.48,
          cBayZ,
          0.42,
          sideFacing,
          2,
          portalSandstoneMat,
          0xd8c3a5
        );

        addOculusRoundWindow(
          outerWallX + sideS * 0.015,
          baseY + 5.80,
          cBayZ,
          0.52,
          sideFacing,
          1,
          portalSandstoneMat,
          0xd8c3a5
        );
      });

      // Các trụ tường đá trắng xám dọc theo nhịp kéo dài Choir Bay
      choirButtressZList.forEach((cbz) => {
        const outerPier = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, sideAisleH, 0.26),
          limestoneMat
        );
        outerPier.position.set(outerWallX + sideS * 0.08, baseY + sideAisleH / 2, cbz);
        addCathPart(outerPier, 1, 0xc2b29a);

        const upperPilaster = new THREE.Mesh(
          new THREE.BoxGeometry(0.20, centralNaveH - (sideAisleH + aisleRoofRise), 0.24),
          limestoneMat
        );
        upperPilaster.position.set(
          upperWallX + sideS * 0.06,
          baseY + sideAisleH + aisleRoofRise + (centralNaveH - sideAisleH - aisleRoofRise) / 2,
          cbz
        );
        addCathPart(upperPilaster, 2, 0xc2b29a);
      });
    });

    // D. Khối tường Thân chính tầng cao (Central Nave & Choir Bay Clerestory — rộng 11.0m, chạy từ z = +6.98 đến z = -19.70)
    const clerestoryH = centralNaveH - sideAisleH; // 6.40
    const clerestoryBody = new THREE.Mesh(
      new THREE.BoxGeometry(centralNaveW, clerestoryH, naveLength - 0.02),
      marseilleBrickMat
    );
    clerestoryBody.position.set(0, baseY + sideAisleH + clerestoryH / 2, naveCenterZ - 0.01);
    addCathPart(clerestoryBody, 2, 0xa84830);

    const clerestoryBelt = new THREE.Mesh(
      new THREE.BoxGeometry(centralNaveW + 0.16, 0.14, naveLength - 0.02),
      limestoneMat
    );
    clerestoryBelt.position.set(0, baseY + 8.65, naveCenterZ - 0.01);
    addCathPart(clerestoryBelt, 2, 0xc2b29a);

    const clerestoryCornice = new THREE.Mesh(
      new THREE.BoxGeometry(centralNaveW + 0.24, 0.20, naveLength - 0.02),
      limestoneMat
    );
    clerestoryCornice.position.set(0, baseY + centralNaveH - 0.10, naveCenterZ - 0.01);
    addCathPart(clerestoryCornice, 2, 0xc2b29a);

    // =========================================================================
    // 6. CÁNH NGANG MỞ RỘNG CHUẨN TỶ LỆ THỰC TẾ (WIDENED TRANSEPT), DÃY 4 Ô VÒM CUỐN MẶT SAU,
    //    LÀM PHẲNG SỐNG MÁI CHÍNH LIỀN MẠCH & DỰNG THÁP KIM LOẠI MẢNH (FLÈCHE) MÀU XÁM KẼM
    // - Mở rộng chiều ngang của khối Cánh ngang (transeptSpanX = 23.60, x = ±11.80) vươn hẳn ra hai bên trái/phải
    //   (rộng tương đương tổng bề ngang vòng 5 nhà nguyện phía dưới) đúng như bức ảnh chụp từ trên cao.
    // - Mặt tường phía sau của hai cánh ngang (bên dưới mép mái ngói chữ A) có dãy 4 ô vòm cuốn liền nhau
    //   (blind arcade / arched windows) viền đá trắng kem sắc nét.
    // - Tại khu vực giao nhau chữ thập (Crossing): Hạ độ cao đỉnh mái của cánh ngang thấp xuống hơn sống mái chính
    //   đúng 0.16 đơn vị VÀ cắt vát chuẩn ranh giới giao mái (mitered valley) để không bao giờ bị Z-fighting.
    // =========================================================================

    // Vật liệu đá xám kem (#D8CFC2) và đá trắng kem sáng (#EAE2D6) chuyên biệt cho Hậu cung & Cánh ngang
    // (không nhân màu với map nâu hồng của sharedLimestoneTex để giữ đúng sắc đá trắng xám / trắng kem thực tế)
    const chevetCreamStoneMat = new THREE.MeshStandardMaterial({
      color: 0xd8cfc2,
      bumpMap: sharedLimestoneTex.bumpMap,
      bumpScale: 0.018,
      roughness: 0.72,
      metalness: 0.04,
    });
    const chevetBrightWhiteStoneMat = new THREE.MeshStandardMaterial({
      color: 0xeae2d6,
      bumpMap: sharedLimestoneTex.bumpMap,
      bumpScale: 0.015,
      roughness: 0.66,
      metalness: 0.04,
    });

    const transeptZ = -11.50;
    const transeptSpanX = 23.60; // Mở rộng vươn hẳn ra hai bên trái/phải: x = ±11.80 (bằng tổng bề ngang vòng 5 nhà nguyện)
    const transeptDepthZ = 5.60; // Từ z = -8.70 đến z = -14.30
    const transeptWallH = centralNaveH; // 13.60 (cùng độ cao tường với thân chính)
    const roofBaseY = baseY + centralNaveH; // baseY + 13.60
    const naveRoofRidgeH = 3.60; // Đỉnh mái thân chính đạt baseY + 17.20 (khớp 100% với đỉnh đầu hồi mặt tiền)

    const roofEaveHalfSpan = centralNaveW / 2 + 0.26; // 5.76
    const naveSlopeLen = Math.hypot(roofEaveHalfSpan, naveRoofRidgeH);
    const naveSlopeAng = Math.atan2(naveRoofRidgeH, roofEaveHalfSpan);

    // E1. Mái chữ A của Thân chính chạy LIỀN MẠCH, THẲNG TẮP trên cùng một độ cao từ sau mặt tiền đến điểm đầu Hậu cung
    const betweenTowersRoofStartZ = 10.54;
    const betweenTowersRoofEndZ = 7.00;
    const betweenTowersRoofLen = betweenTowersRoofStartZ - betweenTowersRoofEndZ; // 3.54
    const betweenTowersRoofMidZ = (betweenTowersRoofStartZ + betweenTowersRoofEndZ) / 2; // 8.77
    const betweenTowersHalfSpan = centerFacadeW / 2; // 3.88
    const betweenTowersBaseY = baseY + 13.70;
    const betweenTowersRidgeH = 3.50; // Đỉnh đạt baseY + 17.20 = roofBaseY + naveRoofRidgeH
    const betweenTowersSlopeLen = Math.hypot(betweenTowersHalfSpan, betweenTowersRidgeH);
    const betweenTowersSlopeAng = Math.atan2(betweenTowersRidgeH, betweenTowersHalfSpan);

    const betweenTowersAtticCore = new THREE.Mesh(
      buildGableRoofAlongZ(centerFacadeW - 0.08, betweenTowersRidgeH - 0.12, betweenTowersRoofLen),
      marseilleBrickMat
    );
    betweenTowersAtticCore.position.set(0, betweenTowersBaseY, betweenTowersRoofMidZ);
    addCathPart(betweenTowersAtticCore, 3, 0xa84830);

    [-1, 1].forEach((sideS) => {
      const btRoofSlab = new THREE.Mesh(
        new THREE.BoxGeometry(betweenTowersSlopeLen + 0.04, 0.16, betweenTowersRoofLen + 0.02),
        cathedralRoofTileMat
      );
      btRoofSlab.position.set(
        sideS * (betweenTowersHalfSpan / 2),
        betweenTowersBaseY + betweenTowersRidgeH / 2 + 0.06,
        betweenTowersRoofMidZ
      );
      btRoofSlab.rotation.z = -sideS * betweenTowersSlopeAng;
      addCathPart(btRoofSlab, 3, 0xb85238);
    });

    // 2) Đoạn mái chính chạy liền một mạch từ lưng 2 tháp chuông (z = 7.00) qua Crossing đến đầu Hậu cung (z = -19.70)
    const fullNaveRoofCore = new THREE.Mesh(
      buildGableRoofAlongZ(centralNaveW - 0.08, naveRoofRidgeH - 0.14, naveLength - 0.02),
      marseilleBrickMat
    );
    fullNaveRoofCore.position.set(0, roofBaseY, naveCenterZ);
    addCathPart(fullNaveRoofCore, 3, 0xa84830);

    [-1, 1].forEach((sideS) => {
      const fullNaveRoofSlab = new THREE.Mesh(
        new THREE.BoxGeometry(naveSlopeLen + 0.08, 0.16, naveLength + 0.02),
        cathedralRoofTileMat
      );
      fullNaveRoofSlab.position.set(
        sideS * (roofEaveHalfSpan / 2),
        roofBaseY + naveRoofRidgeH / 2 + 0.06,
        naveCenterZ
      );
      fullNaveRoofSlab.rotation.z = -sideS * naveSlopeAng;
      addCathPart(fullNaveRoofSlab, 3, 0xb85238);

      // Gờ viền đá sáng dọc rìa diềm mái thân chính (tách 2 đoạn trước/sau cánh ngang)
      [
        { len: 7.00 - (-8.70), midZ: (7.00 + -8.70) / 2 },
        { len: -14.30 - (-19.70), midZ: (-14.30 + -19.70) / 2 },
      ].forEach((eaveSeg) => {
        const eaveEdgeRib = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.18, eaveSeg.len + 0.02),
          chevetCreamStoneMat
        );
        eaveEdgeRib.position.set(
          sideS * (roofEaveHalfSpan + 0.02),
          roofBaseY + 0.04,
          eaveSeg.midZ
        );
        addCathPart(eaveEdgeRib, 3, 0xd8cfc2);
      });
    });

    // Thanh sống mái chính (#7A5C52) chạy THẲNG TẮP, LIỀN MẠCH trên cùng một độ cao (ridgeTopY)
    const ridgeTopY = roofBaseY + naveRoofRidgeH + 0.14;
    const totalContinuousRidgeLen = betweenTowersRoofStartZ - naveEndZ + 0.12;
    const totalContinuousRidgeMidZ = (betweenTowersRoofStartZ + naveEndZ) / 2;
    const roofRidgeBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.18, totalContinuousRidgeLen),
      roofRidgeMat
    );
    roofRidgeBeam.position.set(0, ridgeTopY, totalContinuousRidgeMidZ);
    addCathPart(roofRidgeBeam, 3, 0x7a5c52);

    // E2. Khối tường & mái Cánh ngang mở rộng (Widened Transept — x = ±11.80, z = -8.70 .. -14.30)
    const transeptPlinth = new THREE.Mesh(
      new THREE.BoxGeometry(transeptSpanX + 0.28, 0.85, transeptDepthZ + 0.24),
      granitePlinthMat
    );
    transeptPlinth.position.set(0, baseY + 0.425, transeptZ);
    addCathPart(transeptPlinth, 1, 0x64748b);

    const transeptWallBody = new THREE.Mesh(
      new THREE.BoxGeometry(transeptSpanX, transeptWallH - 0.85, transeptDepthZ),
      marseilleBrickMat
    );
    transeptWallBody.position.set(0, baseY + 0.85 + (transeptWallH - 0.85) / 2, transeptZ);
    addCathPart(transeptWallBody, 2, 0x9e4230);

    // Gờ phào chỉ đá trắng xám (#D8CFC2) bao quanh Cánh ngang (đặc biệt nổi rõ dưới diềm mái)
    [5.35, 8.75, transeptWallH - 0.11].forEach((beltY, bIdx) => {
      const tBelt = new THREE.Mesh(
        new THREE.BoxGeometry(transeptSpanX + (bIdx === 2 ? 0.30 : 0.20), bIdx === 2 ? 0.22 : 0.15, transeptDepthZ + (bIdx === 2 ? 0.28 : 0.18)),
        chevetCreamStoneMat
      );
      tBelt.position.set(0, baseY + beltY, transeptZ);
      addCathPart(tBelt, 2, 0xd8cfc2);
    });

    // DÃY 4 Ô VÒM CUỐN LIỀN NHAU (4-BAY BLIND ARCADE / ARCHED WINDOWS) VIỀN ĐÁ TRẮNG KEM
    // TRÊN MẶT TƯỜNG PHÍA SAU (z = -14.30) VÀ PHÍA TRƯỚC (z = -8.70) CỦA HAI CÁNH NGANG (bên dưới mép mái ngói chữ A)
    const transeptWingBayAbsXs = [6.62, 8.04, 9.46, 10.88]; // 4 ô vòm xếp đều từ sát tường Thân chính (5.50) ra sát đầu hồi (11.80)
    const transeptBayW = 1.02;
    const transeptBayRectH = 2.35;
    const transeptBayBaseY = baseY + 9.12;

    ([-1, 1] as const).forEach((sideX) => {
      // Dựng dãy 4 ô vòm cuốn liền nhau trên cả mặt sau (zSide = -1, facing = 'back') và mặt trước (zSide = 1, facing = 'front')
      ([-1, 1] as const).forEach((zSide) => {
        const wallZ = transeptZ + zSide * (transeptDepthZ / 2); // -14.30 (mặt sau) và -8.70 (mặt trước)
        const facingDir = zSide < 0 ? 'back' : 'front';

        // Bệ cửa đá chạy liền mạch dưới chân 4 ô vòm (Continuous Arcade Sill Course)
        const arcadeContinuousSill = new THREE.Mesh(
          new THREE.BoxGeometry(6.05, 0.14, 0.24),
          chevetBrightWhiteStoneMat
        );
        arcadeContinuousSill.position.set(
          sideX * 8.75,
          transeptBayBaseY - 0.07,
          wallZ + zSide * 0.08
        );
        addCathPart(arcadeContinuousSill, 2, 0xeae2d6);

        // Gờ đá ngang nối các chân vòm (Continuous Impost Molding Band)
        const arcadeImpostBand = new THREE.Mesh(
          new THREE.BoxGeometry(6.05, 0.10, 0.22),
          chevetBrightWhiteStoneMat
        );
        arcadeImpostBand.position.set(
          sideX * 8.75,
          transeptBayBaseY + transeptBayRectH,
          wallZ + zSide * 0.07
        );
        addCathPart(arcadeImpostBand, 2, 0xeae2d6);

        // 5 Trụ bổ tường mảnh bằng đá trắng kem phân cách 4 ô vòm cuốn liền nhau (Shared Arcade Colonnettes / Pilasters)
        [5.91, 7.33, 8.75, 10.17, 11.59].forEach((pierAbsX) => {
          const sharedPilaster = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, transeptBayRectH + 0.65, 0.22),
            chevetBrightWhiteStoneMat
          );
          sharedPilaster.position.set(
            sideX * pierAbsX,
            transeptBayBaseY + (transeptBayRectH + 0.65) / 2,
            wallZ + zSide * 0.06
          );
          addCathPart(sharedPilaster, 2, 0xeae2d6);
        });

        // 4 Ô vòm cuốn liền nhau viền đá trắng kem sắc nét
        transeptWingBayAbsXs.forEach((bayAbsX) => {
          addArchedOpening(
            sideX * bayAbsX,
            transeptBayBaseY,
            wallZ + zSide * 0.02,
            transeptBayW,
            transeptBayRectH,
            0.18,
            facingDir,
            stainedWindowGlassMat,
            0x1c314d,
            2,
            true,
            chevetBrightWhiteStoneMat,
            0xeae2d6
          );
        });

        // Hàng con sơn đá nhỏ (Corbel table / Modillion frieze) chạy dọc ngay dưới diềm mái Cánh ngang
        for (let cIdx = 0; cIdx < 12; cIdx++) {
          const cx = sideX * (5.95 + cIdx * 0.51);
          const corbelMod = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.20, 0.24),
            chevetCreamStoneMat
          );
          corbelMod.position.set(cx, baseY + transeptWallH - 0.28, wallZ + zSide * 0.07);
          addCathPart(corbelMod, 2, 0xd8cfc2);
        }

        // Ở phần tường tầng dưới của Cánh ngang vươn ra ngoài hành lang bên (|x| > 8.50):
        // Bổ sung 2 ô cửa sổ vòm viền đá trắng kem cân xứng với tầng trên
        [9.46, 10.88].forEach((lowerBayAbsX) => {
          addArchedOpening(
            sideX * lowerBayAbsX,
            baseY + 1.85,
            wallZ + zSide * 0.02,
            0.96,
            2.55,
            0.16,
            facingDir,
            stainedWindowGlassMat,
            0x1c314d,
            1,
            true,
            chevetBrightWhiteStoneMat,
            0xeae2d6
          );
        });
      });
    });

    // HẠ ĐỘ CAO ĐỈNH MÁI CÁNH NGANG THẤP XUỐNG HƠN SỐNG MÁI CHÍNH 0.16 ĐƠN VỊ & CẮT VÁT CHUẨN RANH GIỚI GIAO MÁI
    const transeptRoofRidgeH = naveRoofRidgeH - 0.16; // 3.44
    const transeptRoofHalfSpan = (transeptDepthZ + 0.38) / 2; // 2.99
    const transeptSlopeLen = Math.hypot(transeptRoofHalfSpan, transeptRoofRidgeH);
    const transeptSlopeAng = Math.atan2(transeptRoofRidgeH, transeptRoofHalfSpan);

    // Tường đầu hồi tam giác của 2 cánh trái/phải Cánh ngang (dựng từ x = ±5.40 ra x = ±11.80)
    const wingCoreLenX = transeptSpanX / 2 - (centralNaveW / 2 - 0.10); // 11.80 - 5.40 = 6.40
    const wingCoreMidX = (transeptSpanX / 2 + (centralNaveW / 2 - 0.10)) / 2; // 8.60
    [-1, 1].forEach((sideX) => {
      const transeptWingCore = new THREE.Mesh(
        buildGableRoofAlongX(wingCoreLenX, transeptRoofRidgeH - 0.12, transeptDepthZ - 0.08),
        marseilleBrickMat
      );
      transeptWingCore.position.set(sideX * wingCoreMidX, roofBaseY, transeptZ);
      addCathPart(transeptWingCore, 3, 0x9e4230);
    });

    // Helper cắt vát chuẩn ranh giới giao mái (Mitered Transept Wing Roof Geometry)
    const buildMiteredTranseptRoofSlopeGeo = (
      sideX: -1 | 1,
      zSide: -1 | 1
    ): THREE.BufferGeometry => {
      const outerX = sideX * (transeptSpanX / 2 + 0.18); // ±11.98
      const innerRidgeX =
        sideX * (roofEaveHalfSpan * (1 - transeptRoofRidgeH / naveRoofRidgeH) + 0.03);
      const innerEaveX = sideX * (roofEaveHalfSpan + 0.03);

      const slabT = 0.16;
      const yRidgeTop = transeptRoofRidgeH + slabT;
      const yRidgeBot = transeptRoofRidgeH;
      const yEaveTop = slabT;
      const yEaveBot = 0;

      const zRidge = 0;
      const zEave = zSide * transeptRoofHalfSpan;

      const pos: number[] = [];
      const uvs: number[] = [];
      const pushFaceTri = (
        ax: number, ay: number, az: number, au: number, av: number,
        bx: number, by: number, bz: number, bu: number, bv: number,
        cx: number, cy: number, cz: number, cu: number, cv: number,
        wantNormalY: number
      ) => {
        const e1x = bx - ax, e1z = bz - az;
        const e2x = cx - ax, e2z = cz - az;
        const ny = e1z * e2x - e1x * e2z;
        if (ny * wantNormalY >= 0) {
          pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
          uvs.push(au, av, bu, bv, cu, cv);
        } else {
          pos.push(ax, ay, az, cx, cy, cz, bx, by, bz);
          uvs.push(au, av, cu, cv, bu, bv);
        }
      };

      pushFaceTri(
        innerRidgeX, yRidgeTop, zRidge, 0, 1,
        outerX, yRidgeTop, zRidge, 1, 1,
        outerX, yEaveTop, zEave, 1, 0,
        1
      );
      pushFaceTri(
        innerRidgeX, yRidgeTop, zRidge, 0, 1,
        outerX, yEaveTop, zEave, 1, 0,
        innerEaveX, yEaveTop, zEave, 0, 0,
        1
      );

      pushFaceTri(
        innerRidgeX, yRidgeBot, zRidge, 0, 1,
        outerX, yRidgeBot, zRidge, 1, 1,
        outerX, yEaveBot, zEave, 1, 0,
        -1
      );
      pushFaceTri(
        innerRidgeX, yRidgeBot, zRidge, 0, 1,
        outerX, yEaveBot, zEave, 1, 0,
        innerEaveX, yEaveBot, zEave, 0, 0,
        -1
      );

      pos.push(
        innerEaveX, yEaveTop, zEave,
        outerX, yEaveTop, zEave,
        outerX, yEaveBot, zEave,
        innerEaveX, yEaveTop, zEave,
        outerX, yEaveBot, zEave,
        innerEaveX, yEaveBot, zEave
      );
      uvs.push(0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeVertexNormals();
      return geo;
    };

    const transeptRidgeTopY = roofBaseY + transeptRoofRidgeH + 0.14;
    const innerValleyRidgeAbsX =
      roofEaveHalfSpan * (1 - transeptRoofRidgeH / naveRoofRidgeH) + 0.03;

    ([-1, 1] as const).forEach((sideX) => {
      ([-1, 1] as const).forEach((zSide) => {
        const wingSlopeMesh = new THREE.Mesh(
          buildMiteredTranseptRoofSlopeGeo(sideX, zSide),
          cathedralRoofTileMat
        );
        wingSlopeMesh.position.set(0, roofBaseY, transeptZ);
        addCathPart(wingSlopeMesh, 3, 0xb55035);

        // Gờ viền đá sáng dọc rìa diềm mái Cánh ngang (từ mép giao mái thân chính ra đầu hồi cánh ngang)
        const eaveWingLen = transeptSpanX / 2 + 0.20 - roofEaveHalfSpan;
        const eaveWingMidX = sideX * ((transeptSpanX / 2 + 0.20 + roofEaveHalfSpan) / 2);
        const transeptEaveRib = new THREE.Mesh(
          new THREE.BoxGeometry(eaveWingLen, 0.18, 0.18),
          chevetCreamStoneMat
        );
        transeptEaveRib.position.set(
          eaveWingMidX,
          roofBaseY + 0.05,
          transeptZ + zSide * (transeptRoofHalfSpan + 0.03)
        );
        addCathPart(transeptEaveRib, 3, 0xd8cfc2);

        // Đường gờ xối giao mái mảnh (Mitered Valley Flashing Rib)
        const vStart = new THREE.Vector3(
          sideX * (roofEaveHalfSpan + 0.02),
          roofBaseY + 0.15,
          transeptZ + zSide * transeptRoofHalfSpan
        );
        const vEnd = new THREE.Vector3(
          sideX * innerValleyRidgeAbsX,
          transeptRidgeTopY,
          transeptZ
        );
        const vDist = vStart.distanceTo(vEnd);
        const vMid = vStart.clone().add(vEnd).multiplyScalar(0.5);
        const vDir = vEnd.clone().sub(vStart).normalize();
        const valleyTrim = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.14, vDist),
          roofRidgeMat
        );
        valleyTrim.position.copy(vMid);
        valleyTrim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vDir);
        addCathPart(valleyTrim, 3, 0x7a5c52);
      });

      // Sống mái ngang của 2 cánh trái/phải Cánh ngang
      const wingRidgeLen = transeptSpanX / 2 + 0.20 - innerValleyRidgeAbsX;
      const wingRidgeMidX = sideX * ((transeptSpanX / 2 + 0.20 + innerValleyRidgeAbsX) / 2);
      const transeptWingRidgeBeam = new THREE.Mesh(
        new THREE.BoxGeometry(wingRidgeLen, 0.18, 0.22),
        roofRidgeMat
      );
      transeptWingRidgeBeam.position.set(wingRidgeMidX, transeptRidgeTopY, transeptZ);
      addCathPart(transeptWingRidgeBeam, 3, 0x7a5c52);
    });

    // E3. THÁP KIM LOẠI MẢNH (FLÈCHE) MÀU XÁM KẼM NẰM NGAY TẠI ĐIỂM GIAO TRUNG TÂM CỦA SỐNG MÁI (0, ridgeTopY, transeptZ)
    const flecheBaseY = ridgeTopY - 0.04;
    const flechePlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.38, 0.45, 8),
      spireRibMat
    );
    flechePlinth.position.set(0, flecheBaseY + 0.225, transeptZ);
    addCathPart(flechePlinth, 3, 0x9aa2ab);

    const flecheLantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.30, 0.85, 8),
      spireStoneMat
    );
    flecheLantern.position.set(0, flecheBaseY + 0.85, transeptZ);
    addCathPart(flecheLantern, 3, 0xbcc2c8);

    const flecheCanopyRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.31, 0.12, 8),
      spireRibMat
    );
    flecheCanopyRing.position.set(0, flecheBaseY + 1.32, transeptZ);
    addCathPart(flecheCanopyRing, 3, 0x9aa2ab);

    const flecheNeedleH = 2.45;
    const flecheNeedle = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, flecheNeedleH, 8),
      spireStoneMat
    );
    flecheNeedle.position.set(0, flecheBaseY + 1.38 + flecheNeedleH / 2, transeptZ);
    addCathPart(flecheNeedle, 3, 0xbcc2c8);

    const flecheTopY = flecheBaseY + 1.38 + flecheNeedleH;
    const flecheOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      spireRibMat
    );
    flecheOrb.position.set(0, flecheTopY + 0.06, transeptZ);
    addCathPart(flecheOrb, 3, 0x9aa2ab);

    const flecheCrossV = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.68, 0.036),
      darkIronCrossMat
    );
    flecheCrossV.position.set(0, flecheTopY + 0.42, transeptZ);
    addCathPart(flecheCrossV, 3, 0x26292e);

    const flecheCrossH = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.036, 0.036),
      darkIronCrossMat
    );
    flecheCrossH.position.set(0, flecheTopY + 0.54, transeptZ);
    addCathPart(flecheCrossH, 3, 0x26292e);

    // Chi tiết trên 2 mặt đầu hồi trái/phải của Cánh ngang mở rộng (x = ±11.80):
    [-1, 1].forEach((xSign) => {
      const gableFaceX = xSign * (transeptSpanX / 2); // x = ±11.80
      const facingDir = xSign < 0 ? 'left' : 'right';

      [-1, 1].forEach((zCorner) => {
        const cornerPier = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, transeptWallH, 0.30),
          chevetCreamStoneMat
        );
        cornerPier.position.set(
          gableFaceX + xSign * 0.04,
          baseY + transeptWallH / 2,
          transeptZ + zCorner * (transeptDepthZ / 2 - 0.05)
        );
        addCathPart(cornerPier, 2, 0xd8cfc2);

        // Gờ đá sáng viền dọc 2 cạnh mái dốc đầu hồi (Raking Cornice)
        const rakingTrim = new THREE.Mesh(
          new THREE.BoxGeometry(0.26, 0.18, transeptSlopeLen + 0.14),
          chevetCreamStoneMat
        );
        rakingTrim.position.set(
          gableFaceX + xSign * 0.05,
          roofBaseY + transeptRoofRidgeH / 2 + 0.08,
          transeptZ + zCorner * (transeptRoofHalfSpan / 2)
        );
        rakingTrim.rotation.x = zCorner * transeptSlopeAng;
        addCathPart(rakingTrim, 3, 0xd8cfc2);
      });

      // 1 Cửa sổ Hoa Hồng tròn ở chính giữa mỗi đầu hồi Cánh ngang (x = ±11.80)
      addRoseWindowAssembly(
        gableFaceX + xSign * 0.02,
        baseY + 10.65,
        transeptZ,
        1.42,
        facingDir,
        2
      );

      // Hàng 3 cửa sổ vòm đứng viền đá trắng kem ở tầng dưới của mỗi đầu hồi Cánh ngang
      [-1.56, 0, 1.56].forEach((zOff) => {
        addArchedOpening(
          gableFaceX + xSign * 0.01,
          baseY + 1.85,
          transeptZ + zOff,
          0.98,
          2.65,
          0.15,
          facingDir,
          stainedWindowGlassMat,
          0x1c314d,
          1,
          true,
          chevetBrightWhiteStoneMat,
          0xeae2d6
        );
      });
    });

    // =========================================================================
    // 7. HẬU CUNG 3 TẦNG GIẬT CẤP CHUẨN 100% ẢNH CHỤP THỰC TẾ TỪ TRÊN CAO
    //    (3-TIERED STEPPED CHEVET AT apseZ = -19.70)
    // - TẦNG TRÊN CÙNG (7.1. High Apse — R1 = 5.50, 5 mặt đa giác):
    //   + Hệ mái ngói chia thành 5 múi ngói hình tam giác hội tụ về đỉnh sống mái chính,
    //     có các đường gờ sống ngói nổi rõ phân tách từng múi và viền diềm mái màu đá sáng chạy ôm dưới chân mái.
    //   + Trên mỗi mặt tường đa giác có 1 ô cửa sổ vòm cao (lancet arch window) và 1 ô cửa tròn (oculus) viền đá trắng.
    // - TẦNG GIỮA (7.2. Ambulatory — R2 = 8.55, 5 khoang hình thang):
    //   + Trên mặt mái ngói vát tầng giữa: dựng 6 dải gờ tường đá thấp (Radial buttress/parapet walls, màu đá xám kem #D8CFC2)
    //     chạy tỏa tia từ các góc của tường Hậu cung tầng trên xuống khe giữa các nhà nguyện tầng dưới,
    //     chia mái ngói tầng giữa thành 5 khoang mái hình thang rõ rệt.
    //   + Ở đầu ngoài của mỗi gờ tường đá này có 1 đầu trụ đá vuông nhỏ (square stone pier cap) nhô nhẹ lên trên mép mái.
    //   + Trên các mặt tường tầng giữa (ngay dưới mép mái và nằm giữa các nhà nguyện), gắn các ô cửa sổ tròn (oculi) viền đá trắng.
    // - TẦNG DƯỚI CÙNG (7.3. 5 Radiating Chapels & 7.4. 2 Sacristies):
    //   + Dựng đầy đủ 5 Khối nhà nguyện đa giác nhỏ (5 Radiating Chapels) xếp tỏa tròn đối xứng dọc theo vòng cung chân Hậu cung
    //     tại các góc -72°, -36°, 0° (chính giữa), +36°, +72°.
    //   + Mỗi nhà nguyện nhỏ là một khối đa giác nhô hẳn ra ngoài khỏi tường tầng giữa, có hệ mái ngói đa diện (hipped polygonal roof)
    //     lợp ngói cam đất nung riêng biệt, viền diềm mái bằng đá trắng xám rõ nét.
    //   + Trên cả 3 mặt tường ngoài của mỗi nhà nguyện nhỏ đều có các ô cửa sổ vòm viền đá trắng kem sắc nét.
    //   + Ở hai đầu ngoài cùng tiếp giáp với cánh ngang (gần góc -90° và +90°), giữ 2 khối nhà phụ hình chữ nhật (Sacristies) áp sát vào nách cánh ngang.
    // =========================================================================
    const apseZ = -19.70;
    const apseFacets = 5; // 5 khoang đa giác tỏa tròn đối xứng (-72°, -36°, 0°, +36°, +72°)

    // Helper A: Dựng khối lăng trụ đa giác bán nguyệt (5 mặt phẳng) mở về hướng -Z
    const buildPolygonalApsePrismGeo = (
      halfWidthX: number,
      depthRadiusZ: number,
      heightY: number,
      facets = 5
    ): THREE.BufferGeometry => {
      const shape = new THREE.Shape();
      for (let k = 0; k <= facets; k++) {
        const ang = (k / facets) * Math.PI; // 0 .. PI
        const vx = halfWidthX * Math.cos(ang);
        const vy = depthRadiusZ * Math.sin(ang); // sau khi rotateX(-PI/2) -> z = -depthRadiusZ * sin(ang)
        if (k === 0) shape.moveTo(vx, vy);
        else shape.lineTo(vx, vy);
      }
      shape.closePath();

      const rawGeo = new THREE.ExtrudeGeometry(shape, {
        depth: heightY,
        bevelEnabled: false,
      });
      rawGeo.rotateX(-Math.PI / 2);
      const sharpGeo = rawGeo.toNonIndexed();
      sharpGeo.computeVertexNormals();
      rawGeo.dispose();
      return sharpGeo;
    };

    // Helper B: Dựng hệ mái ngói 5 múi hình tam giác hội tụ về đỉnh sống mái chính (High Apse 5-Sector Roof)
    const buildPolygonalHipRoofGeo = (
      eaveHalfW: number,
      eaveDepthR: number,
      ridgeH: number,
      slabThickness = 0.16,
      facets = 5
    ): THREE.BufferGeometry => {
      const positions: number[] = [];
      const uvs: number[] = [];
      const pushTri = (
        ax: number, ay: number, az: number, au: number, av: number,
        bx: number, by: number, bz: number, bu: number, bv: number,
        cx: number, cy: number, cz: number, cu: number, cv: number
      ) => {
        positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
        uvs.push(au, av, bu, bv, cu, cv);
      };

      const apexX = 0;
      const apexY = ridgeH + slabThickness;
      const apexZ = 0;

      for (let k = 0; k < facets; k++) {
        const a0 = (k / facets) * Math.PI;
        const a1 = ((k + 1) / facets) * Math.PI;

        const x0 = eaveHalfW * Math.cos(a0);
        const z0 = -eaveDepthR * Math.sin(a0);
        const x1 = eaveHalfW * Math.cos(a1);
        const z1 = -eaveDepthR * Math.sin(a1);

        const u0 = k / facets;
        const u1 = (k + 1) / facets;
        const uMid = (u0 + u1) * 0.5;

        // Mặt dốc mái tam giác phía trên
        pushTri(
          apexX, apexY, apexZ, uMid, 1,
          x0, slabThickness, z0, u0, 0,
          x1, slabThickness, z1, u1, 0
        );

        // Diềm mái đứng ở mép dưới mỗi múi
        pushTri(x0, slabThickness, z0, u0, 1, x0, 0, z0, u0, 0, x1, 0, z1, u1, 0);
        pushTri(x0, slabThickness, z0, u0, 1, x1, 0, z1, u1, 0, x1, slabThickness, z1, u1, 1);

        // Mặt đáy khép kín
        pushTri(0, 0, 0, uMid, 0.5, x1, 0, z1, u1, 0, x0, 0, z0, u0, 0);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeVertexNormals();
      return geo;
    };

    // Helper C: Dựng hệ mái ngói vát 5 khoang hình thang cho Tầng giữa (Ambulatory Roof)
    const buildPolygonalAnnularRoofGeo = (
      innerR: number,
      outerR: number,
      riseH: number,
      slabThickness = 0.15,
      facets = 5
    ): THREE.BufferGeometry => {
      const positions: number[] = [];
      const uvs: number[] = [];
      const pushTri = (
        ax: number, ay: number, az: number, au: number, av: number,
        bx: number, by: number, bz: number, bu: number, bv: number,
        cx: number, cy: number, cz: number, cu: number, cv: number
      ) => {
        positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
        uvs.push(au, av, bu, bv, cu, cv);
      };

      for (let k = 0; k < facets; k++) {
        const a0 = (k / facets) * Math.PI;
        const a1 = ((k + 1) / facets) * Math.PI;

        const ox0 = outerR * Math.cos(a0);
        const oz0 = -outerR * Math.sin(a0);
        const ox1 = outerR * Math.cos(a1);
        const oz1 = -outerR * Math.sin(a1);

        const ix0 = innerR * Math.cos(a0);
        const iz0 = -innerR * Math.sin(a0);
        const ix1 = innerR * Math.cos(a1);
        const iz1 = -innerR * Math.sin(a1);

        const u0 = k / facets;
        const u1 = (k + 1) / facets;

        // Mặt dốc hình thang từ mép ngoài (y = slabThickness) lên tường tầng trên (y = riseH + slabThickness)
        pushTri(
          ix0, riseH + slabThickness, iz0, u0, 1,
          ox0, slabThickness, oz0, u0, 0,
          ox1, slabThickness, oz1, u1, 0
        );
        pushTri(
          ix0, riseH + slabThickness, iz0, u0, 1,
          ox1, slabThickness, oz1, u1, 0,
          ix1, riseH + slabThickness, iz1, u1, 1
        );

        // Diềm mái đứng ở mép ngoài
        pushTri(ox0, slabThickness, oz0, u0, 1, ox0, 0, oz0, u0, 0, ox1, 0, oz1, u1, 0);
        pushTri(ox0, slabThickness, oz0, u0, 1, ox1, 0, oz1, u1, 0, ox1, slabThickness, oz1, u1, 1);

        // Mặt đáy khép kín
        pushTri(ix0, 0, iz0, u0, 1, ox1, 0, oz1, u1, 0, ox0, 0, oz0, u0, 0);
        pushTri(ix0, 0, iz0, u0, 1, ix1, 0, iz1, u1, 1, ox1, 0, oz1, u1, 0);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeVertexNormals();
      return geo;
    };

    // Helper D: Dựng thanh gờ sống mái hoặc viền diềm mái nối chính xác giữa 2 điểm 3D bất kỳ
    const addStoneRibBetweenPoints = (
      pA: THREE.Vector3,
      pB: THREE.Vector3,
      ribW: number,
      ribH: number,
      tierIndex: number,
      customMat: THREE.MeshStandardMaterial = roofRidgeMat,
      customHex = 0x7a5c52
    ) => {
      const dist = pA.distanceTo(pB);
      if (dist < 0.01) return;
      const mid = pA.clone().add(pB).multiplyScalar(0.5);
      const dir = pB.clone().sub(pA).normalize();
      const ribMesh = new THREE.Mesh(
        new THREE.BoxGeometry(ribW, ribH, dist + 0.04),
        customMat
      );
      ribMesh.position.copy(mid);
      ribMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      addCathPart(ribMesh, tierIndex, customHex);
    };

    // -------------------------------------------------------------------------
    // 7.1. TẦNG TRÊN CÙNG (HIGH APSE: BÁN LỤC GIÁC 5 MẶT PHẲNG, R1 = 5.50)
    // - Mái được chia thành 5 múi ngói hình tam giác hội tụ về đỉnh sống mái chính,
    //   có các đường gờ sống ngói nổi rõ phân tách từng múi và viền diềm mái màu đá sáng chạy ôm dưới chân mái.
    // -------------------------------------------------------------------------
    const R1 = 5.50;
    const choirApseStartY = baseY + sideAisleH; // baseY + 7.20
    const choirApseWallH = centralNaveH - sideAisleH; // 6.40 (đỉnh đạt baseY + 13.60)
    const choirApseRoofRise = naveRoofRidgeH; // 3.60 (hội tụ đúng về đỉnh sống mái chính baseY + 17.20)

    const choirApsePrism = new THREE.Mesh(
      buildPolygonalApsePrismGeo(R1, R1, choirApseWallH, apseFacets),
      marseilleBrickMat
    );
    choirApsePrism.position.set(0, choirApseStartY, apseZ);
    addCathPart(choirApsePrism, 2, 0xa84830);

    // Viền diềm mái màu đá sáng (#D8CFC2 & #EAE2D6) chạy ôm dưới chân mái Tầng trên cùng Hậu cung
    [
      { y: baseY + 8.70, h: 0.14, expand: 0.10, mat: chevetCreamStoneMat, hex: 0xd8cfc2 },
      { y: baseY + centralNaveH - 0.34, h: 0.14, expand: 0.14, mat: chevetCreamStoneMat, hex: 0xd8cfc2 },
      { y: baseY + centralNaveH - 0.20, h: 0.22, expand: 0.24, mat: chevetBrightWhiteStoneMat, hex: 0xeae2d6 },
    ].forEach((belt) => {
      const polyBelt = new THREE.Mesh(
        buildPolygonalApsePrismGeo(
          R1 + belt.expand,
          R1 + belt.expand,
          belt.h,
          apseFacets
        ),
        belt.mat
      );
      polyBelt.position.set(0, belt.y, apseZ);
      addCathPart(polyBelt, 2, belt.hex);
    });

    // Mái ngói 5 múi hình tam giác hội tụ về đỉnh sống mái chính của Tầng trên cùng Hậu cung
    const choirApseEaveR = R1 + 0.30;
    const choirApseRoofMesh = new THREE.Mesh(
      buildPolygonalHipRoofGeo(choirApseEaveR, choirApseEaveR, choirApseRoofRise, 0.16, apseFacets),
      cathedralRoofTileMat
    );
    choirApseRoofMesh.position.set(0, baseY + centralNaveH, apseZ);
    addCathPart(choirApseRoofMesh, 3, 0xb85238);

    // Chóp khóa đỉnh mái đá/kẽm tại điểm hội tụ của 5 múi mái tam giác
    const tier1ApexPt = new THREE.Vector3(0, baseY + centralNaveH + choirApseRoofRise + 0.18, apseZ);
    const highApseApexCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, 0.32, 8),
      chevetCreamStoneMat
    );
    highApseApexCap.position.set(0, tier1ApexPt.y + 0.05, apseZ);
    addCathPart(highApseApexCap, 3, 0xd8cfc2);

    // 6 Đường gờ sống ngói nổi rõ phân tách 5 múi mái tam giác + Viền diềm mái đá sáng + Trụ góc tường
    for (let k = 0; k <= apseFacets; k++) {
      const ang = (k / apseFacets) * Math.PI;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);

      const eaveCornerPt = new THREE.Vector3(
        choirApseEaveR * cosA,
        baseY + centralNaveH + 0.17,
        apseZ - choirApseEaveR * sinA
      );
      // Gờ sống ngói nổi cao (raised terracotta/stone hip ridge) phân tách từng múi mái tam giác
      addStoneRibBetweenPoints(tier1ApexPt, eaveCornerPt, 0.18, 0.18, 3, roofRidgeMat, 0x7a5c52);
      // Lớp gờ chỉ đá sáng chạy kèm dưới sống ngói giúp tách múi sắc nét khi nhìn từ trên cao
      addStoneRibBetweenPoints(
        new THREE.Vector3(0, tier1ApexPt.y - 0.04, apseZ),
        new THREE.Vector3(eaveCornerPt.x, eaveCornerPt.y - 0.04, eaveCornerPt.z),
        0.22,
        0.09,
        3,
        chevetCreamStoneMat,
        0xd8cfc2
      );

      if (k < apseFacets) {
        const nextAng = ((k + 1) / apseFacets) * Math.PI;
        const nextEavePt = new THREE.Vector3(
          choirApseEaveR * Math.cos(nextAng),
          baseY + centralNaveH + 0.17,
          apseZ - choirApseEaveR * Math.sin(nextAng)
        );
        // Viền diềm mái màu đá sáng chạy ôm dưới chân 5 múi mái
        addStoneRibBetweenPoints(
          new THREE.Vector3(eaveCornerPt.x, baseY + centralNaveH + 0.06, eaveCornerPt.z),
          new THREE.Vector3(nextEavePt.x, baseY + centralNaveH + 0.06, nextEavePt.z),
          0.22,
          0.20,
          3,
          chevetBrightWhiteStoneMat,
          0xeae2d6
        );
      }

      // Trụ bổ tường bằng đá sáng tại 6 góc của Tầng trên cùng
      const pilX = (R1 + 0.06) * cosA;
      const pilZ = apseZ - (R1 + 0.06) * sinA;
      const pilRotY = Math.atan2(cosA, -sinA);
      const engagedPilaster = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, centralNaveH - (sideAisleH + aisleRoofRise) - 0.08, 0.22),
        chevetCreamStoneMat
      );
      engagedPilaster.position.set(
        pilX,
        baseY + sideAisleH + aisleRoofRise + (centralNaveH - sideAisleH - aisleRoofRise) / 2,
        pilZ
      );
      engagedPilaster.rotation.y = pilRotY;
      addCathPart(engagedPilaster, 2, 0xd8cfc2);
    }

    // MỞ CỬA SỔ TẦNG TRÊN CÙNG HẬU CUNG (HIGH APSE):
    // Trên mỗi mặt trong 5 mặt tường đa giác: 1 ô cửa sổ vòm cao + 1 ô cửa tròn (oculus) viền đá trắng + hàng con sơn đá dưới diềm mái
    for (let f = 0; f < apseFacets; f++) {
      const a0 = (f / apseFacets) * Math.PI;
      const a1 = ((f + 1) / apseFacets) * Math.PI;
      const aMid = (a0 + a1) * 0.5;
      const x0 = R1 * Math.cos(a0);
      const z0 = apseZ - R1 * Math.sin(a0);
      const x1 = R1 * Math.cos(a1);
      const z1 = apseZ - R1 * Math.sin(a1);

      const mx = (x0 + x1) * 0.5;
      const mz = (z0 + z1) * 0.5;
      const nx = Math.cos(aMid);
      const nz = -Math.sin(aMid);
      const faceRotY = Math.atan2(nx, nz);

      // 1) Cửa sổ vòm cao (Lancet Arch Window) viền đá trắng kem ở dưới
      addArchedOpening(
        mx + nx * 0.02,
        baseY + 8.92,
        mz + nz * 0.02,
        1.10,
        1.94,
        0.17,
        faceRotY,
        stainedWindowGlassMat,
        0x1c314d,
        2,
        true,
        chevetBrightWhiteStoneMat,
        0xeae2d6
      );

      // 2) Ô cửa tròn nhỏ (Oculus) viền đá trắng kem ở phía trên sát diềm mái
      addOculusRoundWindow(
        mx + nx * 0.025,
        baseY + 12.48,
        mz + nz * 0.025,
        0.46,
        faceRotY,
        2,
        chevetBrightWhiteStoneMat,
        0xeae2d6
      );

      // 3) Hàng con sơn đá (Corbel modillions) đỡ dưới viền diềm mái đá sáng
      for (let mIdx = 1; mIdx <= 5; mIdx++) {
        const t = mIdx / 6;
        const cx = x0 + (x1 - x0) * t + nx * 0.10;
        const cz = z0 + (z1 - z0) * t + nz * 0.10;
        const modillion = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.18, 0.22),
          chevetBrightWhiteStoneMat
        );
        modillion.position.set(cx, baseY + centralNaveH - 0.30, cz);
        modillion.rotation.y = faceRotY;
        addCathPart(modillion, 2, 0xeae2d6);
      }
    }

    // -------------------------------------------------------------------------
    // 7.2. TẦNG GIỮA (MIDDLE APSE TIER / AMBULATORY: BÁN KÍNH R2 = 8.55, 5 MẶT ĐA GIÁC)
    // - Trên mặt mái ngói vát của tầng giữa:
    //   + Dựng 6 dải gờ tường đá thấp (Radial buttress/parapet walls, màu đá xám kem #D8CFC2)
    //     chạy tỏa tia từ các góc của tường Hậu cung tầng trên xuống khe giữa các nhà nguyện tầng dưới,
    //     chia mái ngói tầng giữa thành 5 khoang mái hình thang rõ rệt.
    //   + Ở đầu ngoài của mỗi gờ tường đá này có một đầu trụ đá vuông nhỏ (pier cap) nhô nhẹ lên trên mép mái.
    //   + Trên các mặt tường tầng giữa (ngay dưới mép mái và nằm giữa/trên các nhà nguyện), gắn các ô cửa sổ tròn (oculi) viền đá trắng.
    // -------------------------------------------------------------------------
    const R2 = 8.55;
    const ambApseH = sideAisleH; // 7.20
    const ambApseRoofRise = aisleRoofRise; // 1.35 (đỉnh mái đạt baseY + 8.55)

    const ambPlinth = new THREE.Mesh(
      buildPolygonalApsePrismGeo(R2 + 0.18, R2 + 0.18, 0.85, apseFacets),
      granitePlinthMat
    );
    ambPlinth.position.set(0, baseY, apseZ);
    addCathPart(ambPlinth, 1, 0x64748b);

    const ambPrism = new THREE.Mesh(
      buildPolygonalApsePrismGeo(R2, R2, ambApseH - 0.85, apseFacets),
      marseilleBrickMat
    );
    ambPrism.position.set(0, baseY + 0.85, apseZ);
    addCathPart(ambPrism, 1, 0xa84830);

    // Viền diềm mái bằng đá trắng xám rõ nét ôm quanh đỉnh tường Tầng giữa
    const ambLowerCornice = new THREE.Mesh(
      buildPolygonalApsePrismGeo(R2 + 0.12, R2 + 0.12, 0.12, apseFacets),
      chevetCreamStoneMat
    );
    ambLowerCornice.position.set(0, baseY + ambApseH - 0.30, apseZ);
    addCathPart(ambLowerCornice, 1, 0xd8cfc2);

    const ambCorniceBelt = new THREE.Mesh(
      buildPolygonalApsePrismGeo(R2 + 0.22, R2 + 0.22, 0.20, apseFacets),
      chevetBrightWhiteStoneMat
    );
    ambCorniceBelt.position.set(0, baseY + ambApseH - 0.18, apseZ);
    addCathPart(ambCorniceBelt, 1, 0xeae2d6);

    const ambOuterEaveR = R2 + 0.28; // 8.83
    const ambRoofMesh = new THREE.Mesh(
      buildPolygonalAnnularRoofGeo(
        R1 - 0.05,
        ambOuterEaveR,
        ambApseRoofRise,
        0.15,
        apseFacets
      ),
      cathedralRoofTileMat
    );
    ambRoofMesh.position.set(0, baseY + ambApseH, apseZ);
    addCathPart(ambRoofMesh, 2, 0xb85238);

    // 6 DẢI GỜ TƯỜNG ĐÁ THẤP TỎA TIA (6 RADIAL DIVIDER / PARAPET WALLS, MÀU ĐÁ XÁM KEM #D8CFC2)
    // CHIA MÁI NGÓI TẦNG GIỮA THÀNH 5 KHOANG MÁI HÌNH THANG RÕ RỆT + 6 ĐẦU TRỤ ĐÁ VUÔNG NHỎ (PIER CAPS) Ở ĐẦU NGOÀI
    for (let k = 0; k <= apseFacets; k++) {
      const ang = (k / apseFacets) * Math.PI; // 0°, 36°, 72°, 108°, 144°, 180°
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);

      // Vector hướng dọc theo tia từ trong ra ngoài (ux, uz)
      const ux = cosA;
      const uz = -sinA;
      const radialRotY = Math.atan2(ux, uz);

      // Điểm đầu trong (sát góc tường High Apse tại R1) và điểm đầu ngoài (sát mép diềm mái Tầng giữa tại ambOuterEaveR)
      const innerR_wall = R1 - 0.04;
      const outerR_wall = ambOuterEaveR + 0.04;
      const innerY_roof = baseY + ambApseH + ambApseRoofRise + 0.14;
      const outerY_roof = baseY + ambApseH + 0.14;

      const innerPt = new THREE.Vector3(
        innerR_wall * cosA,
        innerY_roof,
        apseZ - innerR_wall * sinA
      );
      const outerPt = new THREE.Vector3(
        outerR_wall * cosA,
        outerY_roof,
        apseZ - outerR_wall * sinA
      );

      const wallSlopeLen = innerPt.distanceTo(outerPt);
      const wallMidPt = innerPt.clone().add(outerPt).multiplyScalar(0.5);
      const wallDir = outerPt.clone().sub(innerPt).normalize();

      // 1) Thân gờ tường đá thấp tỏa tia (Radial Stone Divider / Parapet Wall — màu đá xám kem #D8CFC2)
      //    nhô cao hẳn lên trên mặt mái ngói tầng giữa 0.38m để phân tách rõ 5 khoang mái hình thang
      const radialDividerWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.44, wallSlopeLen + 0.08),
        chevetCreamStoneMat
      );
      radialDividerWall.position.set(wallMidPt.x, wallMidPt.y + 0.16, wallMidPt.z);
      radialDividerWall.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), wallDir);
      addCathPart(radialDividerWall, 2, 0xd8cfc2);

      // 2) Nắp gờ đá phẳng (Stone Coping Cap) rộng hơn thân tường một chút nằm trên đỉnh mỗi gờ tường đá tỏa tia
      const radialWallCoping = new THREE.Mesh(
        new THREE.BoxGeometry(0.40, 0.11, wallSlopeLen + 0.12),
        chevetBrightWhiteStoneMat
      );
      radialWallCoping.position.set(wallMidPt.x, wallMidPt.y + 0.40, wallMidPt.z);
      radialWallCoping.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), wallDir);
      addCathPart(radialWallCoping, 2, 0xeae2d6);

      // 3) Trụ bổ tường bằng đá (Vertical Stone Buttress Pier) chạy dọc theo 6 góc tường Tầng giữa (r = R2 + 0.08)
      const pierR = R2 + 0.12;
      const pierX = pierR * cosA;
      const pierZ = apseZ - pierR * sinA;
      const ambButtressPier = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, ambApseH, 0.38),
        chevetCreamStoneMat
      );
      ambButtressPier.position.set(pierX, baseY + ambApseH / 2, pierZ);
      ambButtressPier.rotation.y = radialRotY;
      addCathPart(ambButtressPier, 1, 0xd8cfc2);

      // 4) ĐẦU TRỤ ĐÁ VUÔNG NHỎ (SQUARE STONE PIER CAP) nhô nhẹ lên trên mép mái ở đầu ngoài của mỗi gờ tường đá tỏa tia
      const pierCapR = ambOuterEaveR - 0.02;
      const pierCapX = pierCapR * cosA;
      const pierCapZ = apseZ - pierCapR * sinA;
      const pierCapBaseY = baseY + ambApseH + 0.05;

      // Khối thân trụ đá vuông (Square Stone Pier Cap Body)
      const pierCapBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.56, 0.52),
        chevetCreamStoneMat
      );
      pierCapBody.position.set(pierCapX, pierCapBaseY + 0.28, pierCapZ);
      pierCapBody.rotation.y = radialRotY;
      addCathPart(pierCapBody, 2, 0xd8cfc2);

      // Gờ cổ trụ & chóp đá vuông vát nhẹ (Pyramidal Stone Capstone) trên đỉnh đầu trụ đá vuông
      const pierCapCollar = new THREE.Mesh(
        new THREE.BoxGeometry(0.60, 0.10, 0.60),
        chevetBrightWhiteStoneMat
      );
      pierCapCollar.position.set(pierCapX, pierCapBaseY + 0.58, pierCapZ);
      pierCapCollar.rotation.y = radialRotY;
      addCathPart(pierCapCollar, 2, 0xeae2d6);

      const pierCapPyramid = new THREE.Mesh(
        new THREE.ConeGeometry(0.40, 0.22, 4),
        chevetBrightWhiteStoneMat
      );
      pierCapPyramid.position.set(pierCapX, pierCapBaseY + 0.74, pierCapZ);
      pierCapPyramid.rotation.y = radialRotY + Math.PI / 4;
      addCathPart(pierCapPyramid, 2, 0xeae2d6);

      // Viền diềm mái đá sáng nối giữa các đầu trụ đá vuông ở mép ngoài mái Tầng giữa
      if (k < apseFacets) {
        const nextAng = ((k + 1) / apseFacets) * Math.PI;
        const nextOuterPt = new THREE.Vector3(
          ambOuterEaveR * Math.cos(nextAng),
          baseY + ambApseH + 0.06,
          apseZ - ambOuterEaveR * Math.sin(nextAng)
        );
        addStoneRibBetweenPoints(
          new THREE.Vector3(ambOuterEaveR * cosA, baseY + ambApseH + 0.06, apseZ - ambOuterEaveR * sinA),
          nextOuterPt,
          0.20,
          0.18,
          2,
          chevetBrightWhiteStoneMat,
          0xeae2d6
        );
      }
    }

    // MỞ CÁC Ô CỬA SỔ TRÒN (OCULI) VIỀN ĐÁ TRẮNG TRÊN CÁC MẶT TƯỜNG TẦNG GIỮA
    // (ngay dưới mép mái Tầng giữa tại y = baseY + 5.95, nằm nổi bật phía trên mái của 5 nhà nguyện tầng dưới)
    for (let f = 0; f < apseFacets; f++) {
      const a0 = (f / apseFacets) * Math.PI;
      const a1 = ((f + 1) / apseFacets) * Math.PI;
      const aMid = (a0 + a1) * 0.5;
      const x0 = R2 * Math.cos(a0);
      const z0 = apseZ - R2 * Math.sin(a0);
      const x1 = R2 * Math.cos(a1);
      const z1 = apseZ - R2 * Math.sin(a1);

      const mx = (x0 + x1) * 0.5;
      const mz = (z0 + z1) * 0.5;
      const nx = Math.cos(aMid);
      const nz = -Math.sin(aMid);
      const faceRotY = Math.atan2(nx, nz);

      // Ô cửa sổ tròn (Oculus) viền đá trắng kem sắc nét (#EAE2D6) ngay dưới diềm mái Tầng giữa
      addOculusRoundWindow(
        mx + nx * 0.03,
        baseY + 5.95,
        mz + nz * 0.03,
        0.58,
        faceRotY,
        1,
        chevetBrightWhiteStoneMat,
        0xeae2d6
      );

      // Hàng con sơn đá (Corbel frieze) chạy dưới diềm mái của mỗi khoang tường Tầng giữa
      for (let mIdx = 1; mIdx <= 6; mIdx++) {
        const t = mIdx / 7;
        const cx = x0 + (x1 - x0) * t + nx * 0.09;
        const cz = z0 + (z1 - z0) * t + nz * 0.09;
        const modillion = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.16, 0.20),
          chevetCreamStoneMat
        );
        modillion.position.set(cx, baseY + ambApseH - 0.28, cz);
        modillion.rotation.y = faceRotY;
        addCathPart(modillion, 1, 0xd8cfc2);
      }
    }

    // -------------------------------------------------------------------------
    // 7.3. DỰNG ĐẦY ĐỦ 5 NHÀ NGUYỆN ĐA GIÁC TỎA HÌNH CÁNH QUẠT Ở TẦNG DƯỚI CÙNG
    //      (5 RADIATING CHAPELS TẠI CÁC GÓC -72°, -36°, 0° CHÍNH GIỮA, +36°, +72°)
    // - Mỗi nhà nguyện nhỏ là một khối đa giác nhô hẳn ra ngoài khỏi tường tầng giữa (vươn tới bán kính R3 = 11.45m),
    //   có hệ mái ngói đa diện (hipped polygonal roof) lợp ngói cam đất nung riêng biệt,
    //   viền diềm mái bằng đá trắng xám rõ nét (#D8CFC2 / #EAE2D6).
    // - Trên cả 3 mặt tường ngoài của mỗi nhà nguyện nhỏ đều có các ô cửa sổ vòm viền đá trắng kem sắc nét.
    // -------------------------------------------------------------------------
    const R3 = 11.45; // Bán kính vươn ra ngoài của 5 khối Nhà nguyện đa giác tỏa hình cánh quạt
    const chapelWallH = 4.35; // Thấp hơn các ô cửa sổ tròn (oculi) của Tầng giữa (tại baseY + 5.95)
    const chapelRoofRise = 0.82; // Đỉnh mái đa diện đạt baseY + 5.17, nằm gọn ngay dưới cửa tròn Oculus Tầng giữa

    // Duyệt qua cả 5 khoang đa giác f = 0, 1, 2, 3, 4 (tương ứng góc -72°, -36°, 0°, +36°, +72° quanh trục đuôi)
    for (let f = 0; f < apseFacets; f++) {
      const a0 = (f / apseFacets) * Math.PI;
      const a1 = ((f + 1) / apseFacets) * Math.PI;
      const aMid = (a0 + a1) * 0.5; // Góc tâm của mỗi nhà nguyện: 18°, 54°, 90° (chính giữa đuôi), 126°, 162°

      // Để giữa 5 nhà nguyện có khe rãnh phân tách rõ nét ( nơi 6 trụ đá tầng giữa đáp xuống):
      // Thu hẹp nhẹ góc chân của mỗi nhà nguyện một khoảng góc padAng = 0.032 rad (~1.8°)
      const padAng = 0.032;
      const angBaseLeft = a0 + padAng;
      const angBaseRight = a1 - padAng;
      // 2 đỉnh vát phía ngoài của khối đa giác 3 mặt (tạo mặt giữa và 2 mặt vát nghiêng 2 bên)
      const angOuterLeft = aMid - 0.118;
      const angOuterRight = aMid + 0.118;

      const rInnerAnchor = R2 - 0.18; // Neo sâu vào trong tường Tầng giữa để không hở khe
      const rOuterVertex = R3;        // Nhô hẳn ra ngoài tạo thành khối đa giác nổi 3 mặt rõ rệt

      // 4 đỉnh mặt bằng (V0 -> V1 -> V2 -> V3) của Nhà nguyện đa giác thứ f trong mặt phẳng XZ
      const chapelPolyPts = [
        { x: rInnerAnchor * Math.cos(angBaseLeft), z: apseZ - rInnerAnchor * Math.sin(angBaseLeft) },   // V0: Gốc trái trên tường Tầng giữa
        { x: rOuterVertex * Math.cos(angOuterLeft), z: apseZ - rOuterVertex * Math.sin(angOuterLeft) }, // V1: Đỉnh vát ngoài bên trái
        { x: rOuterVertex * Math.cos(angOuterRight), z: apseZ - rOuterVertex * Math.sin(angOuterRight) }, // V2: Đỉnh vát ngoài bên phải
        { x: rInnerAnchor * Math.cos(angBaseRight), z: apseZ - rInnerAnchor * Math.sin(angBaseRight) }, // V3: Gốc phải trên tường Tầng giữa
      ];

      // Tâm hướng tâm của nhà nguyện để tính vector mở rộng (expandOffset) cho chân đế & viền diềm mái
      const chapelCenterDirX = Math.cos(aMid);
      const chapelCenterDirZ = -Math.sin(aMid);
      const chapelTangDirX = -Math.sin(aMid);
      const chapelTangDirZ = -Math.cos(aMid);

      const expandChapelPt = (pt: { x: number; z: number }, idx: number, radialExp: number, tangExp: number) => {
        const tSign = idx <= 1 ? -1 : 1;
        return {
          x: pt.x + chapelCenterDirX * radialExp + chapelTangDirX * (tSign * tangExp),
          z: pt.z + chapelCenterDirZ * radialExp + chapelTangDirZ * (tSign * tangExp),
        };
      };

      const buildRadiatingChapelPrismGeo = (radialExp: number, tangExp: number, h: number): THREE.BufferGeometry => {
        const shape = new THREE.Shape();
        chapelPolyPts.forEach((p, idx) => {
          const ep = expandChapelPt(p, idx, radialExp, tangExp);
          const vx = ep.x;
          const vy = -(ep.z - apseZ); // sau khi rotateX(-PI/2) -> z = ep.z
          if (idx === 0) shape.moveTo(vx, vy);
          else shape.lineTo(vx, vy);
        });
        shape.closePath();
        const raw = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
        raw.rotateX(-Math.PI / 2);
        const sharp = raw.toNonIndexed();
        sharp.computeVertexNormals();
        raw.dispose();
        return sharp;
      };

      // A. Bậc thềm & Chân đế đá hoa cương xám xanh của Nhà nguyện thứ f
      const chapelStepPlinth = new THREE.Mesh(
        buildRadiatingChapelPrismGeo(0.28, 0.20, 0.24),
        granitePlinthMat
      );
      chapelStepPlinth.position.set(0, baseY + 0.01, apseZ);
      addCathPart(chapelStepPlinth, 1, 0x64748b);

      const chapelPlinth = new THREE.Mesh(
        buildRadiatingChapelPrismGeo(0.14, 0.10, 0.78),
        granitePlinthMat
      );
      chapelPlinth.position.set(0, baseY + 0.01, apseZ);
      addCathPart(chapelPlinth, 1, 0x64748b);

      // B. Khối tường gạch đỏ Marseille 3 mặt đa giác của Nhà nguyện thứ f
      const chapelBody = new THREE.Mesh(
        buildRadiatingChapelPrismGeo(0.0, 0.0, chapelWallH - 0.78),
        marseilleBrickMat
      );
      chapelBody.position.set(0, baseY + 0.78, apseZ);
      addCathPart(chapelBody, 1, 0xa84830);

      // C. Gờ chỉ đá ngang dưới bệ cửa sổ & Viền diềm mái bằng đá trắng xám rõ nét (#D8CFC2 & #EAE2D6)
      const chapelSillCourse = new THREE.Mesh(
        buildRadiatingChapelPrismGeo(0.08, 0.06, 0.11),
        chevetCreamStoneMat
      );
      chapelSillCourse.position.set(0, baseY + 0.92, apseZ);
      addCathPart(chapelSillCourse, 1, 0xd8cfc2);

      const chapelLowerCornice = new THREE.Mesh(
        buildRadiatingChapelPrismGeo(0.12, 0.09, 0.12),
        chevetCreamStoneMat
      );
      chapelLowerCornice.position.set(0, baseY + chapelWallH - 0.30, apseZ);
      addCathPart(chapelLowerCornice, 1, 0xd8cfc2);

      const chapelTopCornice = new THREE.Mesh(
        buildRadiatingChapelPrismGeo(0.22, 0.16, 0.20),
        chevetBrightWhiteStoneMat
      );
      chapelTopCornice.position.set(0, baseY + chapelWallH - 0.18, apseZ);
      addCathPart(chapelTopCornice, 1, 0xeae2d6);

      // D. 4 Trụ góc bằng đá trắng xám tại 4 đỉnh V0, V1, V2, V3 của mỗi Nhà nguyện
      chapelPolyPts.forEach((wv) => {
        const chPier = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, chapelWallH - 0.12, 0.22),
          chevetCreamStoneMat
        );
        chPier.position.set(wv.x, baseY + (chapelWallH - 0.12) / 2, wv.z);
        chPier.rotation.y = Math.atan2(chapelCenterDirX, chapelCenterDirZ);
        addCathPart(chPier, 1, 0xd8cfc2);
      });

      // E. TRÊN CẢ 3 MẶT TƯỜNG NGOÀI CỦA MỖI NHÀ NGUYỆN NHỎ (sideIdx = 0, 1, 2):
      //    Gắn các ô cửa sổ vòm viền đá trắng kem sắc nét (#EAE2D6) + con sơn đá dưới diềm mái
      for (let sideIdx = 0; sideIdx < 3; sideIdx++) {
        const pA = chapelPolyPts[sideIdx];
        const pB = chapelPolyPts[sideIdx + 1];
        const mx = (pA.x + pB.x) * 0.5;
        const mz = (pA.z + pB.z) * 0.5;
        const dx = pB.x - pA.x;
        const dz = pB.z - pA.z;
        const segLen = Math.hypot(dx, dz);
        let nx = -dz / segLen;
        let nz = dx / segLen;
        // Đảm bảo pháp tuyến (nx, nz) luôn hướng RA NGOÀI khỏi tâm Hậu cung (0, apseZ)
        if (nx * mx + nz * (mz - apseZ) < 0) {
          nx = -nx;
          nz = -nz;
        }
        const winRotY = Math.atan2(nx, nz);

        // Ô cửa sổ vòm viền đá trắng kem sắc nét trên từng mặt trong 3 mặt tường ngoài
        addArchedOpening(
          mx + nx * 0.02,
          baseY + 1.04,
          mz + nz * 0.02,
          sideIdx === 1 ? 0.88 : 0.80,
          1.76,
          0.16,
          winRotY,
          stainedWindowGlassMat,
          0x1c314d,
          1,
          true,
          chevetBrightWhiteStoneMat,
          0xeae2d6
        );

        // Hàng con sơn đá nhỏ (Stone corbels) dưới viền diềm mái của mỗi mặt nhà nguyện
        for (let cIdx = 1; cIdx <= 3; cIdx++) {
          const t = cIdx / 4;
          const cx = pA.x + dx * t + nx * 0.08;
          const cz = pA.z + dz * t + nz * 0.08;
          const chCorbel = new THREE.Mesh(
            new THREE.BoxGeometry(0.11, 0.14, 0.18),
            chevetCreamStoneMat
          );
          chCorbel.position.set(cx, baseY + chapelWallH - 0.26, cz);
          chCorbel.rotation.y = winRotY;
          addCathPart(chCorbel, 1, 0xd8cfc2);
        }
      }

      // F. HỆ MÁI NGÓI ĐA DIỆN (HIPPED POLYGONAL ROOF) LỢP NGÓI CAM ĐẤT NUNG RIÊNG BIỆT CHO TỪNG NHÀ NGUYỆN
      //    + VIỀN DIỀM MÁI BẰNG ĐÁ TRẮNG XÁM RÕ NÉT + GỜ SỐNG NGÓI PHÂN MÚI
      const chapelEavePts = chapelPolyPts.map((p, idx) =>
        expandChapelPt(p, idx, 0.26, 0.18)
      );
      // Đỉnh mái của mỗi nhà nguyện đa giác nằm áp vào mặt tường Tầng giữa tại bán kính R2 + 0.04
      const chapelApexWorld = {
        x: (R2 + 0.02) * Math.cos(aMid),
        z: apseZ - (R2 + 0.02) * Math.sin(aMid),
      };
      const roofY0 = baseY + chapelWallH;
      const slabT = 0.13;
      const chapelApexY = roofY0 + chapelRoofRise + slabT;

      const rPos: number[] = [];
      const rUvs: number[] = [];
      const pushChapelRoofTri = (
        ax: number, ay: number, az: number, au: number, av: number,
        bx: number, by: number, bz: number, bu: number, bv: number,
        cx: number, cy: number, cz: number, cu: number, cv: number
      ) => {
        rPos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
        rUvs.push(au, av, bu, bv, cu, cv);
      };

      for (let s = 0; s < 3; s++) {
        const e0 = chapelEavePts[s];
        const e1 = chapelEavePts[s + 1];
        // Mặt trên và mặt dưới để mái ngói đa diện dày dặn ở mọi góc nhìn
        pushChapelRoofTri(
          chapelApexWorld.x, chapelApexY, chapelApexWorld.z, 0.5, 1,
          e1.x, roofY0 + slabT, e1.z, 1, 0,
          e0.x, roofY0 + slabT, e0.z, 0, 0
        );
        pushChapelRoofTri(
          chapelApexWorld.x, chapelApexY, chapelApexWorld.z, 0.5, 1,
          e0.x, roofY0 + slabT, e0.z, 0, 0,
          e1.x, roofY0 + slabT, e1.z, 1, 0
        );
      }

      const chapelRoofGeo = new THREE.BufferGeometry();
      chapelRoofGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
      chapelRoofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUvs, 2));
      chapelRoofGeo.computeVertexNormals();

      const chapelRoofMesh = new THREE.Mesh(chapelRoofGeo, cathedralRoofTileMat);
      addCathPart(chapelRoofMesh, 2, 0xb85238);

      // Gờ sống ngói phân tách 3 mặt mái đa diện & Viền diềm mái bằng đá trắng xám rõ nét
      const chApexVec = new THREE.Vector3(chapelApexWorld.x, chapelApexY + 0.02, chapelApexWorld.z);
      chapelEavePts.forEach((ep, idx) => {
        const epVec = new THREE.Vector3(ep.x, roofY0 + slabT + 0.02, ep.z);
        // Sống mái ngói nổi giữa các mặt mái đa diện của nhà nguyện
        addStoneRibBetweenPoints(chApexVec, epVec, 0.12, 0.12, 2, roofRidgeMat, 0x7a5c52);
        if (idx < 3) {
          const nextEp = chapelEavePts[idx + 1];
          // Viền diềm mái bằng đá trắng xám (#EAE2D6) chạy dọc 3 cạnh ngoài của mái mỗi nhà nguyện
          addStoneRibBetweenPoints(
            new THREE.Vector3(ep.x, roofY0 + 0.04, ep.z),
            new THREE.Vector3(nextEp.x, roofY0 + 0.04, nextEp.z),
            0.18,
            0.16,
            2,
            chevetBrightWhiteStoneMat,
            0xeae2d6
          );
        }
      });
    }

    // -------------------------------------------------------------------------
    // 7.4. HAI KHỐI NHÀ PHỤ HÌNH CHỮ NHẬT (2 SACRISTIES) ÁP SÁT VÀO NÁCH CÁNH NGANG
    //      (Ở HAI ĐẦU NGOÀI CÙNG TIẾP GIÁP VỚI CÁNH NGANG, GẦN GÓC -90° VÀ +90°)
    // - Đặt đối xứng tại x = ±10.05 (từ x = ±8.70 đến x = ±11.40), z = -14.30 .. -18.85,
    //   nằm gọn trong nách giữa mặt sau Cánh ngang mở rộng (z = -14.30, x = ±11.80)
    //   và 2 nhà nguyện ngoài cùng (f = 0 và f = 4).
    // -------------------------------------------------------------------------
    const sacristyCenterX = 10.05;
    const sacristyW = 2.70; // Mép ngoài tại x = ±11.40 (nằm gọn bên trong đầu hồi Cánh ngang x = ±11.80)
    const sacristyLenZ = 4.55; // Từ z = -14.30 (áp sát lưng Cánh ngang) đến z = -18.85 (tiếp giáp nhà nguyện ngoài cùng)
    const sacristyMidZ = -16.575;
    const sacristyWallH = 4.35; // Cùng cao độ diềm mái với 5 nhà nguyện đa giác
    const sacristyRoofRidgeH = 0.90;

    [-1, 1].forEach((sideS) => {
      const sx = sideS * sacristyCenterX;
      const outerFaceX = sx + sideS * (sacristyW / 2); // ±11.40
      const backFaceZ = sacristyMidZ - sacristyLenZ / 2; // -18.85
      const sideFacing = sideS < 0 ? 'left' : 'right';

      // Chân đế đá hoa cương Phòng thánh
      const sacPlinth = new THREE.Mesh(
        new THREE.BoxGeometry(sacristyW + 0.20, 0.78, sacristyLenZ + 0.18),
        granitePlinthMat
      );
      sacPlinth.position.set(sx, baseY + 0.39, sacristyMidZ);
      addCathPart(sacPlinth, 1, 0x64748b);

      // Thân tường gạch đỏ Marseille Phòng thánh
      const sacBody = new THREE.Mesh(
        new THREE.BoxGeometry(sacristyW, sacristyWallH - 0.78, sacristyLenZ),
        marseilleBrickMat
      );
      sacBody.position.set(sx, baseY + 0.78 + (sacristyWallH - 0.78) / 2, sacristyMidZ);
      addCathPart(sacBody, 1, 0xa84830);

      // Viền diềm mái bằng đá trắng xám rõ nét của Phòng thánh
      const sacCornice = new THREE.Mesh(
        new THREE.BoxGeometry(sacristyW + 0.24, 0.20, sacristyLenZ + 0.24),
        chevetBrightWhiteStoneMat
      );
      sacCornice.position.set(sx, baseY + sacristyWallH - 0.10, sacristyMidZ);
      addCathPart(sacCornice, 1, 0xeae2d6);

      // Trụ góc bằng đá sáng của Phòng thánh
      [-1, 1].forEach((zSign) => {
        const sacPier = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, sacristyWallH, 0.22),
          chevetCreamStoneMat
        );
        sacPier.position.set(
          outerFaceX + sideS * 0.02,
          baseY + sacristyWallH / 2,
          sacristyMidZ + zSign * (sacristyLenZ / 2 - 0.05)
        );
        addCathPart(sacPier, 1, 0xd8cfc2);
      });

      // Mái ngói cam đất nung trên Phòng thánh + gờ sống mái
      const sacRoofBaseY = baseY + sacristyWallH;
      const sacGableCore = new THREE.Mesh(
        buildGableRoofAlongZ(sacristyW - 0.04, sacristyRoofRidgeH - 0.08, sacristyLenZ - 0.04),
        marseilleBrickMat
      );
      sacGableCore.position.set(sx, sacRoofBaseY, sacristyMidZ);
      addCathPart(sacGableCore, 2, 0xa84830);

      const sacHalfSpan = (sacristyW + 0.26) / 2;
      const sacSlopeLen = Math.hypot(sacHalfSpan, sacristyRoofRidgeH);
      const sacSlopeAng = Math.atan2(sacristyRoofRidgeH, sacHalfSpan);

      [-1, 1].forEach((rSide) => {
        const sacRoofSlab = new THREE.Mesh(
          new THREE.BoxGeometry(sacSlopeLen + 0.06, 0.13, sacristyLenZ + 0.18),
          cathedralRoofTileMat
        );
        sacRoofSlab.position.set(
          sx + rSide * (sacHalfSpan / 2),
          sacRoofBaseY + sacristyRoofRidgeH / 2 + 0.05,
          sacristyMidZ
        );
        sacRoofSlab.rotation.z = -rSide * sacSlopeAng;
        addCathPart(sacRoofSlab, 2, 0xb85238);
      });

      const sacRidgeBeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.15, sacristyLenZ + 0.22),
        roofRidgeMat
      );
      sacRidgeBeam.position.set(sx, sacRoofBaseY + sacristyRoofRidgeH + 0.10, sacristyMidZ);
      addCathPart(sacRidgeBeam, 2, 0x7a5c52);

      // 2 Cửa sổ vòm viền đá trắng kem ở mặt bên ngoài (x = ±11.40) của Phòng thánh
      [-15.55, -17.60].forEach((wz) => {
        addArchedOpening(
          outerFaceX + sideS * 0.02,
          baseY + 1.08,
          wz,
          0.84,
          1.68,
          0.14,
          sideFacing,
          stainedWindowGlassMat,
          0x1c314d,
          1,
          true,
          chevetBrightWhiteStoneMat,
          0xeae2d6
        );
      });

      // 1 Cửa sổ vòm viền đá trắng kem ở mặt sau (z = -18.85) của Phòng thánh
      addArchedOpening(
        sx,
        baseY + 1.08,
        backFaceZ - 0.02,
        0.86,
        1.68,
        0.14,
        'back',
        stainedWindowGlassMat,
        0x1c314d,
        1,
        true,
        chevetBrightWhiteStoneMat,
        0xeae2d6
      );
    });

    // =========================================================================
    // 8. ĐƯỜNG VIỀN CHÂN ĐẾ ĐÁ XÁM SẪM (#64748B) & VỆT TỐI AMBIENT OCCLUSION (AO)
    // =========================================================================
    const perimeterPlinthStepNave = new THREE.Mesh(
      new THREE.BoxGeometry(fullAisleW + 0.52, 0.26, naveLength),
      granitePlinthMat
    );
    perimeterPlinthStepNave.position.set(0, baseY + 0.13, naveCenterZ);
    addCathPart(perimeterPlinthStepNave, 1, 0x64748b);

    const perimeterPlinthStepTransept = new THREE.Mesh(
      new THREE.BoxGeometry(transeptSpanX + 0.54, 0.26, transeptDepthZ + 0.46),
      granitePlinthMat
    );
    perimeterPlinthStepTransept.position.set(0, baseY + 0.13, transeptZ);
    addCathPart(perimeterPlinthStepTransept, 1, 0x64748b);

    const perimeterPlinthStepApse = new THREE.Mesh(
      buildPolygonalApsePrismGeo(R2 + 0.42, R2 + 0.42, 0.22, apseFacets),
      granitePlinthMat
    );
    perimeterPlinthStepApse.position.set(0, baseY + 0.01, apseZ);
    addCathPart(perimeterPlinthStepApse, 1, 0x64748b);

    // Vệt tối Ambient Occlusion (AO) tiếp xúc mặt sân dưới chân đế
    const cathedralBaseAO = new THREE.Mesh(
      new THREE.BoxGeometry(fullAisleW + 1.15, 0.04, naveLength + 0.8),
      aoCreviceMat
    );
    cathedralBaseAO.position.set(0, baseY + 0.025, naveCenterZ);
    cathedralBaseAO.userData.isGround = true;
    cathedralBaseAO.userData.originalMaterial = cathedralBaseAO.material;
    group.add(cathedralBaseAO);

    const transeptBaseAO = new THREE.Mesh(
      new THREE.BoxGeometry(transeptSpanX + 1.05, 0.04, transeptDepthZ + 0.95),
      aoCreviceMat
    );
    transeptBaseAO.position.set(0, baseY + 0.026, transeptZ);
    transeptBaseAO.userData.isGround = true;
    transeptBaseAO.userData.originalMaterial = transeptBaseAO.material;
    group.add(transeptBaseAO);

    const apseBaseAO = new THREE.Mesh(
      buildPolygonalApsePrismGeo(R3 + 0.55, R3 + 0.55, 0.04, apseFacets),
      aoCreviceMat
    );
    apseBaseAO.position.set(0, baseY + 0.028, apseZ);
    apseBaseAO.userData.isGround = true;
    apseBaseAO.userData.originalMaterial = apseBaseAO.material;
    group.add(apseBaseAO);

    return null;

  } else if (siteId === 'HCM-DT-007') {
    // =========================================================================
    // BẾN NHÀ RỒNG - BẢO TÀNG HỒ CHÍ MINH (DRAGON WHARF / MESSAGERIES MARITIMES 1863)
    // Kiến trúc Pháp cổ điển có hành lang vòm cuốn 4 mặt (7 nhịp trước/sau, 5 nhịp hông)
    // kết hợp mái ngói âm dương Á Đông và cụm "Lưỡng Long Chầu Nguyệt" tráng men xanh ngọc
    // =========================================================================

    // -------------------------------------------------------------------------
    // 1. BẢNG MÀU & CHẤT LIỆU CHUẨN THỰC TẾ (CỔ KÍNH, TRẦM ẤM, KHÔNG BỊ CHÓI)
    // -------------------------------------------------------------------------

    // A. CanvasTexture + BumpMap cho Tường gạch Đỏ Hồng Đất Nung Trầm (Muted Terracotta / Dusty Rose - 0xb86b5a)
    const createNhaRongBrickTextures = () => {
      const colorCanvas = document.createElement('canvas');
      colorCanvas.width = 256;
      colorCanvas.height = 256;
      const cCtx = colorCanvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = 256;
      bumpCanvas.height = 256;
      const bCtx = bumpCanvas.getContext('2d');

      if (cCtx && bCtx) {
        cCtx.fillStyle = '#efe3de';
        cCtx.fillRect(0, 0, 256, 256);

        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, 256, 256);

        // Các mạch vữa gạch ngang và dọc mờ cổ điển
        const rowH = 16;
        const brickW = 32;
        for (let row = 0; row < 16; row++) {
          const y = row * rowH;
          cCtx.fillStyle = 'rgba(235, 224, 214, 0.28)';
          cCtx.fillRect(0, y, 256, 2);
          bCtx.fillStyle = '#585858';
          bCtx.fillRect(0, y, 256, 2);

          const offset = (row % 2) * (brickW / 2);
          for (let col = 0; col < 9; col++) {
            const x = (col * brickW + offset) % 256;
            cCtx.fillStyle = 'rgba(150, 92, 78, 0.22)';
            cCtx.fillRect(x, y, 2, rowH);
            bCtx.fillStyle = '#626262';
            bCtx.fillRect(x, y, 2, rowH);
          }
        }

        // Hạt nhám đất nung trầm & vữa phong hóa nhẹ
        for (let i = 0; i < 4000; i++) {
          const rx = Math.random() * 256;
          const ry = Math.random() * 256;
          const sz = Math.random() * 2 + 0.8;
          cCtx.fillStyle = i % 2 === 0 ? 'rgba(138, 72, 58, 0.18)' : 'rgba(232, 214, 204, 0.16)';
          cCtx.fillRect(rx, ry, sz, sz);
          bCtx.fillStyle = i % 2 === 0 ? '#686868' : '#969696';
          bCtx.fillRect(rx, ry, sz, sz);
        }
      }

      const map = new THREE.CanvasTexture(colorCanvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(4, 2);

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(4, 2);

      return { map, bumpMap };
    };

    // B. CanvasTexture + BumpMap cho Hệ cột trụ, vòm cuốn, gờ chỉ Vàng Kem Ngà / Đá Cổ Điển (0xe6dec8)
    const createNhaRongCreamTrimTextures = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = 256;
      bumpCanvas.height = 256;
      const bCtx = bumpCanvas.getContext('2d');

      if (ctx && bCtx) {
        ctx.fillStyle = '#f6f2e8';
        ctx.fillRect(0, 0, 256, 256);

        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, 256, 256);

        for (let i = 0; i < 3600; i++) {
          const x = Math.random() * 256;
          const y = Math.random() * 256;
          const sz = Math.random() * 2 + 0.6;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(182, 170, 146, 0.22)' : 'rgba(248, 244, 232, 0.2)';
          ctx.fillRect(x, y, sz, sz);
          bCtx.fillStyle = i % 2 === 0 ? '#6e6e6e' : '#929292';
          bCtx.fillRect(x, y, sz, sz);
        }
      }

      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(2, 2);

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(2, 2);

      return { map, bumpMap };
    };

    // C. CanvasTexture + BumpMap cho Hệ Mái Ngói Nâu Đỏ Đất Nung ngả Rêu phong (0x8f5640 kết hợp vân sọc ngói trầm 0x6e4230)
    const createNhaRongRoofTileTextures = () => {
      const colorCanvas = document.createElement('canvas');
      colorCanvas.width = 512;
      colorCanvas.height = 512;
      const cCtx = colorCanvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = 512;
      bumpCanvas.height = 512;
      const bCtx = bumpCanvas.getContext('2d');

      if (cCtx && bCtx) {
        // Nền trung tính ấm để khi nhân với 0x8f5640 cho ra đúng sắc nâu đỏ đất nung trầm
        cCtx.fillStyle = '#efe5de';
        cCtx.fillRect(0, 0, 512, 512);

        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, 512, 512);

        // Sọc sóng ngói âm dương dọc (32 rãnh trên 512px) pha sọc ngói trầm 0x6e4230
        const ribW = 16;
        for (let x = 0; x < 512; x += ribW) {
          // Lòng máng ngói âm trầm (#6e4230)
          cCtx.fillStyle = 'rgba(78, 44, 30, 0.44)';
          cCtx.fillRect(x, 0, 6, 512);

          // Sống ngói dương bắt sáng dịu
          cCtx.fillStyle = 'rgba(242, 224, 210, 0.24)';
          cCtx.fillRect(x + 8, 0, 5, 512);

          // Cạnh đổ bóng rêu phong trầm
          cCtx.fillStyle = 'rgba(56, 34, 24, 0.46)';
          cCtx.fillRect(x + 13, 0, 3, 512);

          bCtx.fillStyle = '#353535';
          bCtx.fillRect(x, 0, 6, 512);
          bCtx.fillStyle = '#dedede';
          bCtx.fillRect(x + 8, 0, 6, 512);
        }

        // Các đường mí ngói ngang xếp lớp
        for (let y = 0; y < 512; y += 28) {
          cCtx.fillStyle = 'rgba(54, 32, 22, 0.42)';
          cCtx.fillRect(0, y, 512, 3);
          bCtx.fillStyle = '#262626';
          bCtx.fillRect(0, y, 512, 3);
        }

        // Hạt gốm đất nung & vệt rêu phong cổ kính theo thời gian
        for (let i = 0; i < 4200; i++) {
          const rx = Math.random() * 512;
          const ry = Math.random() * 512;
          cCtx.fillStyle =
            i % 3 === 0
              ? 'rgba(58, 64, 48, 0.16)' // Ánh rêu phong cổ kính
              : i % 2 === 0
                ? 'rgba(72, 40, 26, 0.16)'
                : 'rgba(225, 198, 180, 0.12)';
          cCtx.fillRect(rx, ry, 2.2, 2.2);
        }
      }

      const map = new THREE.CanvasTexture(colorCanvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(1, 1);

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(1, 1);

      return { map, bumpMap };
    };

    // D. CanvasTexture cho Men Xanh Ngọc Lam Cổ / Xanh Gốm Cây Mai (0x3b6e6c pha ánh xám ngọc 0x4f7d78)
    const createJadeCeramicTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#dce8e6';
        ctx.fillRect(0, 0, 256, 256);
        // Pha ánh xám ngọc (0x4f7d78) và vân vảy gốm Cây Mai cổ kính
        for (let i = 0; i < 1200; i++) {
          ctx.fillStyle = i % 2 === 0 ? 'rgba(79, 125, 120, 0.22)' : 'rgba(59, 110, 108, 0.18)';
          ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
        }
        for (let y = 0; y < 256; y += 16) {
          for (let x = 0; x < 256; x += 16) {
            ctx.strokeStyle = 'rgba(34, 66, 64, 0.24)';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(x + (y % 32 === 0 ? 8 : 0), y, 8, 0, Math.PI);
            ctx.stroke();
          }
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 2);
      return tex;
    };

    // E. CanvasTexture + BumpMap cho Mặt nền sân đá xám trầm (0x525860) có kẻ ô lát đá mờ
    const createNhaRongCourtyardTextures = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = 512;
      bumpCanvas.height = 512;
      const bCtx = bumpCanvas.getContext('2d');

      if (ctx && bCtx) {
        ctx.fillStyle = '#e2e5e8';
        ctx.fillRect(0, 0, 512, 512);

        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, 512, 512);

        // Kẻ ô lát đá mờ (64x64px mỗi viên đá sân)
        const tileSz = 64;
        for (let y = 0; y < 512; y += tileSz) {
          for (let x = 0; x < 512; x += tileSz) {
            const shade = (Math.sin(x * 0.13 + y * 0.07) * 8) | 0;
            ctx.fillStyle = `rgb(${222 + shade}, ${225 + shade}, ${229 + shade})`;
            ctx.fillRect(x + 2, y + 2, tileSz - 4, tileSz - 4);

            // Đường mạch kẻ ô lát đá mờ
            ctx.strokeStyle = 'rgba(42, 46, 52, 0.32)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, tileSz, tileSz);

            bCtx.strokeStyle = '#484848';
            bCtx.lineWidth = 2;
            bCtx.strokeRect(x, y, tileSz, tileSz);
          }
        }

        // Hạt nhám bề mặt đá lát sân
        for (let i = 0; i < 3500; i++) {
          const rx = Math.random() * 512;
          const ry = Math.random() * 512;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(50, 54, 60, 0.12)' : 'rgba(245, 247, 250, 0.1)';
          ctx.fillRect(rx, ry, 2, 2);
        }
      }

      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(5, 4);

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(5, 4);

      return { map, bumpMap };
    };

    if (!landmarkTextureCache.has('nrBrickTex_v2')) {
      const texPair = createNhaRongBrickTextures();
      texPair.map.userData = { isCached: true };
      texPair.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('nrBrickTex_v2', texPair);
    }
    if (!landmarkTextureCache.has('nrCreamTex_v2')) {
      const texPair = createNhaRongCreamTrimTextures();
      texPair.map.userData = { isCached: true };
      texPair.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('nrCreamTex_v2', texPair);
    }
    if (!landmarkTextureCache.has('nrRoofTex_v2')) {
      const texPair = createNhaRongRoofTileTextures();
      texPair.map.userData = { isCached: true };
      texPair.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('nrRoofTex_v2', texPair);
    }
    if (!landmarkTextureCache.has('nrJadeTex_v2')) {
      const tex = createJadeCeramicTexture();
      tex.userData = { isCached: true };
      landmarkTextureCache.set('nrJadeTex_v2', tex);
    }
    if (!landmarkTextureCache.has('nrCourtyardTex_v2')) {
      const texPair = createNhaRongCourtyardTextures();
      texPair.map.userData = { isCached: true };
      texPair.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('nrCourtyardTex_v2', texPair);
    }

    const nrBrickTex = landmarkTextureCache.get('nrBrickTex_v2');
    const nrCreamTex = landmarkTextureCache.get('nrCreamTex_v2');
    const nrRoofTex = landmarkTextureCache.get('nrRoofTex_v2');
    const nrJadeTex = landmarkTextureCache.get('nrJadeTex_v2');
    const nrCourtyardTex = landmarkTextureCache.get('nrCourtyardTex_v2');

    // 1) Tường gạch bên trong hành lang & tầng 3: Đỏ Hồng Đất Nung Trầm (Muted Terracotta / Dusty Rose - 0xb86b5a, roughness: 0.9)
    const brickWallMat = new THREE.MeshStandardMaterial({
      color: 0xb86b5a,
      map: nrBrickTex.map,
      bumpMap: nrBrickTex.bumpMap,
      bumpScale: 0.025,
      roughness: 0.9,
      metalness: 0.02,
    });

    // 2) Hệ cột trụ, vòm cuốn & gờ chỉ: Vàng Kem Ngà / Đá Cổ Điển (0xe6dec8, roughness: 0.85)
    const creamTrimMat = new THREE.MeshStandardMaterial({
      color: 0xe6dec8,
      map: nrCreamTex.map,
      bumpMap: nrCreamTex.bumpMap,
      bumpScale: 0.014,
      roughness: 0.85,
      metalness: 0.02,
    });

    // 2b) Chân cột tầng 1 và gờ móng: Xám đá ấm (0xc4bdb0, roughness: 0.88)
    const warmStoneBaseMat = new THREE.MeshStandardMaterial({
      color: 0xc4bdb0,
      map: nrCreamTex.map,
      bumpMap: nrCreamTex.bumpMap,
      bumpScale: 0.018,
      roughness: 0.88,
      metalness: 0.02,
    });

    // 3) Hệ Mái Ngói: Nâu Đỏ Đất Nung ngả Rêu phong (0x8f5640 kết hợp vân sọc ngói trầm 0x6e4230, roughness: 0.88)
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x8f5640,
      map: nrRoofTex.map,
      bumpMap: nrRoofTex.bumpMap,
      bumpScale: 0.06,
      roughness: 0.88,
      metalness: 0.03,
    });

    // 4) Đôi Rồng & Viền Mái: Xanh Ngọc Lam Cổ / Xanh Gốm Cây Mai (0x3b6e6c pha ánh xám ngọc 0x4f7d78, roughness: 0.55)
    const jadeDragonMat = new THREE.MeshStandardMaterial({
      color: 0x3b6e6c,
      map: nrJadeTex,
      bumpMap: nrCreamTex.bumpMap,
      bumpScale: 0.012,
      roughness: 0.55,
      metalness: 0.08,
    });

    // 4b) Bờ nóc ngang dưới bụng rồng: Xám đá cổ (0x64706c)
    const ridgeStoneMat = new THREE.MeshStandardMaterial({
      color: 0x64706c,
      map: nrCreamTex.map,
      bumpMap: nrCreamTex.bumpMap,
      bumpScale: 0.015,
      roughness: 0.82,
      metalness: 0.04,
    });

    // 4c) Chi tiết viền sứ xám ngọc nhạt (0x4f7d78 / 0xcfd8d5) trên vây rồng, bờm rồng và mặt trăng
    const jadeWhiteTrimMat = new THREE.MeshStandardMaterial({
      color: 0x4f7d78,
      roughness: 0.58,
      metalness: 0.06,
    });

    // 5) Cửa sổ và cửa đi: Nâu Gỗ Gụ sẫm (0x3b2618)
    const darkWindowMat = new THREE.MeshStandardMaterial({
      color: 0x3b2618,
      roughness: 0.82,
      metalness: 0.05,
    });

    // 5b) Lan can giữa các cột tầng 2: Xanh đen gang đúc (0x1e2624)
    const ironRailingMat = new THREE.MeshStandardMaterial({
      color: 0x1e2624,
      roughness: 0.65,
      metalness: 0.25,
    });

    // 6) Mặt nền sân dưới chân nhà: Đá xám trầm (0x525860) có kẻ ô lát đá mờ
    const stonePlinthMat = new THREE.MeshStandardMaterial({
      color: 0x525860,
      map: nrCourtyardTex.map,
      bumpMap: nrCourtyardTex.bumpMap,
      bumpScale: 0.02,
      roughness: 0.9,
      metalness: 0.03,
    });

    const moonPearlMat = new THREE.MeshStandardMaterial({
      color: 0xe6dec8,
      roughness: 0.6,
      metalness: 0.05,
    });

    const lightningRodMat = new THREE.MeshStandardMaterial({
      color: 0x262f3d,
      roughness: 0.4,
      metalness: 0.78,
    });

    const topiaryLeafDarkMat = new THREE.MeshStandardMaterial({
      color: 0x24582a,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true,
    });

    const topiaryLeafBrightMat = new THREE.MeshStandardMaterial({
      color: 0x357a3c,
      roughness: 0.88,
      metalness: 0.0,
      flatShading: true,
    });

    // Helper lưu đầy đủ mesh.userData.originalMaterial cho mọi Mesh của Bến Nhà Rồng
    const addRongPart = (mesh: THREE.Mesh, tier: number, origColor?: number, isGround = false) => {
      mesh.castShadow = !isGround;
      mesh.receiveShadow = true;
      mesh.userData.elevationTier = tier;
      mesh.userData.origY = mesh.position.y;
      const m = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
      mesh.userData.origColor = origColor !== undefined ? origColor : m.color.getHex();
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
        bumpScale: m.bumpScale !== undefined ? m.bumpScale : 1,
        roughnessMap: m.roughnessMap || null,
        roughness: m.roughness !== undefined ? m.roughness : 0.85,
        metalness: m.metalness !== undefined ? m.metalness : 0.04,
      };
      group.add(mesh);
      return mesh;
    };

    // Helper chuẩn hóa UV cho mái ngói dốc để sọc ngói âm dương chạy dọc chuẩn theo độ dốc mái
    const applyRongRoofUVs = (geo: THREE.BufferGeometry, tileScale = 0.42) => {
      const pos = geo.attributes.position;
      const norm = geo.attributes.normal;
      const uvs = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const nx = norm ? Math.abs(norm.getX(i)) : 0;
        const nz = norm ? Math.abs(norm.getZ(i)) : 1;
        if (nz >= nx) {
          // Mặt dốc trước & sau: sọc ngói chạy theo X, dốc xuống theo Z/Y
          const slopeDist = Math.hypot(vz, vy);
          uvs[i * 2] = vx * tileScale;
          uvs[i * 2 + 1] = slopeDist * tileScale;
        } else {
          // Mặt dốc hai đầu hồi: sọc ngói chạy theo Z, dốc xuống theo X/Y
          const slopeDist = Math.hypot(vx, vy);
          uvs[i * 2] = vz * tileScale;
          uvs[i * 2 + 1] = slopeDist * tileScale;
        }
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    };

    // -------------------------------------------------------------------------
    // 2. CẤU TRÚC TỔNG THỂ & BỆ NỀN (Rộng 28, sâu 18, bệ nền đá lát 34 x 0.4 x 24)
    // -------------------------------------------------------------------------
    // Bệ nền sân đá xám trầm (0x525860) có kẻ ô lát đá mờ tại y = 0.2 (mặt trên y = 0.4)
    const basePlatform = new THREE.Mesh(new THREE.BoxGeometry(34, 0.4, 24), stonePlinthMat);
    basePlatform.position.set(0, 0.2, 0);
    addRongPart(basePlatform, 0, 0x525860, true);

    // Gờ móng tòa nhà (26.6 x 0.16 x 16.6) sơn màu xám đá ấm (0xc4bdb0) tại y = 0.44
    const verandaDeck = new THREE.Mesh(new THREE.BoxGeometry(26.6, 0.16, 16.6), warmStoneBaseMat);
    verandaDeck.position.set(0, 0.44, 0);
    addRongPart(verandaDeck, 0, 0xc4bdb0, true);

    // Bậc tam cấp 4 bậc chính giữa mặt trước (x = 0, z = 9.5) dẫn từ bệ đá lên sảnh hành lang
    for (let s = 0; s < 4; s++) {
      const stepW = 4.4 - s * 0.16;
      const stepD = 2.0 - s * 0.42;
      const stepH = 0.11;
      const stepY = 0.4 + s * stepH + stepH / 2;
      const stepZ = 9.5 - s * 0.21;
      const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(stepW, stepH, stepD), warmStoneBaseMat);
      stepMesh.position.set(0, stepY, stepZ);
      addRongPart(stepMesh, 0, 0xc4bdb0, true);
    }

    // Hai trụ tay vịn đá kẹp hai bên bậc tam cấp sảnh chính
    [-2.32, 2.32].forEach((sx) => {
      const cheekWall = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.58, 2.1), warmStoneBaseMat);
      cheekWall.position.set(sx, 0.68, 9.45);
      addRongPart(cheekWall, 0, 0xc4bdb0);

      const cheekCap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.36), creamTrimMat);
      cheekCap.position.set(sx, 1.04, 10.35);
      addRongPart(cheekCap, 0, 0xe6dec8);
    });

    // Dọc sát chân mặt tiền (z = 9.2): Đặt 8 chậu cây cảnh tỉa hình chóp tròn nhỏ gọn đối xứng trước các chân cột
    const frontColXs = [-12.6, -9.0, -5.4, -1.8, 1.8, 5.4, 9.0, 12.6];
    const potXs = [-12.6, -9.0, -5.4, -2.85, 2.85, 5.4, 9.0, 12.6];
    potXs.forEach((px) => {
      // Đôn chậu cổ điển màu đá ấm
      const potBase = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.68), warmStoneBaseMat);
      potBase.position.set(px, 0.47, 9.2);
      addRongPart(potBase, 0, 0xc4bdb0);

      const potBody = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.24, 0.42, 12), brickWallMat);
      potBody.position.set(px, 0.75, 9.2);
      addRongPart(potBody, 0, 0xb86b5a);

      const potRim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.36, 0.08, 12), creamTrimMat);
      potRim.position.set(px, 0.98, 9.2);
      addRongPart(potRim, 0, 0xe6dec8);

      // Thân cây nhỏ & tán lá tỉa hình chóp tròn 3 tầng (Topiary cone-sphere)
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.35, 8), darkWindowMat);
      stem.position.set(px, 1.15, 9.2);
      addRongPart(stem, 0, 0x3b2618);

      const lowerBush = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), topiaryLeafDarkMat);
      lowerBush.scale.set(1.0, 0.85, 1.0);
      lowerBush.position.set(px, 1.42, 9.2);
      addRongPart(lowerBush, 0, 0x24582a);

      const midCone = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.68, 12), topiaryLeafBrightMat);
      midCone.position.set(px, 1.78, 9.2);
      addRongPart(midCone, 0, 0x357a3c);

      const topBall = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), topiaryLeafBrightMat);
      topBall.position.set(px, 2.16, 9.2);
      addRongPart(topBall, 0, 0x357a3c);
    });

    // -------------------------------------------------------------------------
    // 3. TẦNG 1 (TẦNG TRỆT - LÕI NHÀ 22x4.2x12 & HỆ HÀNH LANG 7 NHỊP CỬA VÒM CUỐN)
    // -------------------------------------------------------------------------
    // Lõi nhà tầng 1 bên trong (BoxGeometry(22, 4.2, 12) từ y = 0.4 đến y = 4.6) màu đỏ hồng đất nung trầm (0xb86b5a)
    const coreFloor1 = new THREE.Mesh(new THREE.BoxGeometry(22, 4.2, 12), brickWallMat);
    coreFloor1.position.set(0, 2.5, 0);
    addRongPart(coreFloor1, 1, 0xb86b5a);

    // Gờ chân tường lõi tầng 1 màu xám đá ấm (0xc4bdb0)
    const coreBasePlinth = new THREE.Mesh(new THREE.BoxGeometry(22.16, 0.36, 12.16), warmStoneBaseMat);
    coreBasePlinth.position.set(0, 0.62, 0);
    addRongPart(coreBasePlinth, 1, 0xc4bdb0);

    // Helper tạo cửa gỗ gụ sẫm (0x3b2618) có khung viền mỏng màu kem ngà (0xe6dec8) trên tường lõi
    const addCoreOpening = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      tier: number,
      axis: 'z' | 'x',
      isArched = true
    ) => {
      if (axis === 'z') {
        const signZ = z >= 0 ? 1 : -1;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.22, h + 0.2, 0.12), creamTrimMat);
        frame.position.set(x, y, z + signZ * 0.04);
        addRongPart(frame, tier, 0xe6dec8);

        const pane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), darkWindowMat);
        pane.position.set(x, y, z + signZ * 0.06);
        addRongPart(pane, tier, 0x3b2618);

        if (isArched) {
          const archHead = new THREE.Mesh(
            new THREE.CylinderGeometry(w / 2, w / 2, 0.14, 18),
            darkWindowMat
          );
          archHead.rotation.x = Math.PI / 2;
          archHead.position.set(x, y + h / 2, z + signZ * 0.06);
          addRongPart(archHead, tier, 0x3b2618);

          const archTrim = new THREE.Mesh(
            new THREE.CylinderGeometry(w / 2 + 0.11, w / 2 + 0.11, 0.12, 18),
            creamTrimMat
          );
          archTrim.rotation.x = Math.PI / 2;
          archTrim.position.set(x, y + h / 2, z + signZ * 0.04);
          addRongPart(archTrim, tier, 0xe6dec8);
        }
      } else {
        const signX = x >= 0 ? 1 : -1;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, h + 0.2, w + 0.22), creamTrimMat);
        frame.position.set(x + signX * 0.04, y, z);
        addRongPart(frame, tier, 0xe6dec8);

        const pane = new THREE.Mesh(new THREE.BoxGeometry(0.14, h, w), darkWindowMat);
        pane.position.set(x + signX * 0.06, y, z);
        addRongPart(pane, tier, 0x3b2618);
      }
    };

    // Hệ cửa chính & 6 ô cửa sổ trên lõi tường Tầng 1 (mặt trước & mặt sau z = ±6.0)
    [-1, 1].forEach((dirZ) => {
      const wallZ = dirZ * 6.0;
      // Cửa đại sảnh chính giữa (x = 0)
      addCoreOpening(0, 2.15, wallZ, 1.9, 2.5, 1, 'z', true);
      // 6 ô cửa sổ ở 6 nhịp hai bên
      [-9.8, -7.0, -3.6, 3.6, 7.0, 9.8].forEach((wx) => {
        addCoreOpening(wx, 2.35, wallZ, 1.25, 2.0, 1, 'z', true);
      });
    });

    // Hệ 5 ô cửa sổ trên lõi tường Tầng 1 ở hai bên hông (x = ±11.0)
    [-1, 1].forEach((dirX) => {
      const wallX = dirX * 11.0;
      [-4.6, -2.3, 0, 2.3, 4.6].forEach((wz) => {
        addCoreOpening(wallX, 2.35, wz, 1.2, 2.0, 1, 'x', false);
      });
    });

    // Hàm tạo nhịp vòm cuốn bán nguyệt (Spandrel Arch) nối giữa 2 trụ cột
    const createArcadeSpandrelGeo = (spanW: number, totalH: number, archR: number, thickness: number) => {
      const halfW = spanW / 2;
      const shape = new THREE.Shape();
      // Vẽ phần trán tường vòm (spandrel) từ chân vòm (y = 0) lên đỉnh dầm (y = totalH)
      shape.moveTo(-halfW, 0);
      shape.lineTo(-archR, 0);
      shape.absarc(0, 0, archR, Math.PI, 0, true);
      shape.lineTo(halfW, 0);
      shape.lineTo(halfW, totalH);
      shape.lineTo(-halfW, totalH);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
      geo.translate(0, 0, -thickness / 2);
      return geo;
    };

    // Hàm tạo viền chỉ vòm nổi (Archivolt Ring) ôm quanh cung vòm bán nguyệt
    const createArchivoltTrimGeo = (innerR: number, outerR: number, thickness: number) => {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, outerR, 0, Math.PI, false);
      shape.lineTo(-innerR, 0);
      shape.absarc(0, 0, innerR, Math.PI, 0, true);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
      geo.translate(0, 0, -thickness / 2);
      return geo;
    };

    // BAO QUANH 4 MẶT NGOÀI (Rộng 26, sâu 16 -> x = ±12.6..±13.0, z = ±7.6..±8.0) LÀ HỆ HÀNH LANG VÒM (ARCADE)
    const sideColZs = [-7.6, -4.56, -1.52, 1.52, 4.56, 7.6];
    const colH1 = 4.0; // Từ y = 0.45 đến y = 4.45
    const colY1 = 0.45 + colH1 / 2;

    // A) 8 Trụ cột vuông & 7 Nhịp cửa vòm tròn ở MẶT TRƯỚC (z = +7.6) và MẶT SAU (z = -7.6)
    const frontBackSpan = 3.6;
    const frontBackArchR = 1.38;
    const frontBackSpringY = 2.62;
    const frontBackSpandrelGeo = createArcadeSpandrelGeo(
      frontBackSpan,
      4.45 - frontBackSpringY,
      frontBackArchR,
      0.48
    );
    const frontBackArchTrimGeo = createArchivoltTrimGeo(
      frontBackArchR - 0.02,
      frontBackArchR + 0.16,
      0.56
    );

    [-7.6, 7.6].forEach((az) => {
      // 8 Trụ cột vuông tầng 1
      frontColXs.forEach((cx) => {
        // Thân trụ vuông màu vàng kem ngà cổ điển (0xe6dec8)
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.62, colH1, 0.62), creamTrimMat);
        pillar.position.set(cx, colY1, az);
        addRongPart(pillar, 1, 0xe6dec8);

        // Chân đế trụ tầng 1 (Plinth base) sơn màu xám đá ấm (0xc4bdb0)
        const pBase = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.42, 0.76), warmStoneBaseMat);
        pBase.position.set(cx, 0.45 + 0.21, az);
        addRongPart(pBase, 1, 0xc4bdb0);

        // Gờ cổ cột đỡ chân vòm (Impost capital)
        const impost = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.18, 0.74), creamTrimMat);
        impost.position.set(cx, frontBackSpringY, az);
        addRongPart(impost, 1, 0xe6dec8);
      });

      // 7 Nhịp cửa vòm tròn liên tiếp nối giữa 8 trụ cột
      for (let i = 0; i < 7; i++) {
        const bayCenterX = (frontColXs[i] + frontColXs[i + 1]) / 2;

        // Vòm cuốn bán nguyệt (Spandrel)
        const spandrel = new THREE.Mesh(frontBackSpandrelGeo, creamTrimMat);
        spandrel.position.set(bayCenterX, frontBackSpringY, az);
        addRongPart(spandrel, 1, 0xe6dec8);

        // Viền chỉ vòm nổi (Archivolt)
        const archTrim = new THREE.Mesh(frontBackArchTrimGeo, creamTrimMat);
        archTrim.position.set(bayCenterX, frontBackSpringY, az);
        addRongPart(archTrim, 1, 0xe6dec8);

        // Đá khóa vòm (Keystone) ở chính giữa đỉnh mỗi vòm
        const keystone = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.42, 0.62), creamTrimMat);
        keystone.position.set(bayCenterX, frontBackSpringY + frontBackArchR + 0.1, az);
        addRongPart(keystone, 1, 0xe6dec8);

        // Lan can hành lang tầng 1 giữa các nhịp (trừ nhịp giữa i === 3 ở mặt tiền mở lối lên bậc tam cấp)
        if (!(az > 0 && i === 3)) {
          const lowRail = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.72, 0.22), creamTrimMat);
          lowRail.position.set(bayCenterX, 0.45 + 0.36, az);
          addRongPart(lowRail, 1, 0xe6dec8);

          const railSlot = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.36, 0.26), ironRailingMat);
          railSlot.position.set(bayCenterX, 0.45 + 0.36, az);
          addRongPart(railSlot, 1, 0x1e2624);
        }
      }
    });

    // B) 5 Nhịp cửa vòm tròn ở HAI BÊN HÔNG (x = -12.6 và x = +12.6)
    const sideSpan = 3.04;
    const sideArchR = 1.16;
    const sideSpringY = 2.68;
    const sideSpandrelGeo = createArcadeSpandrelGeo(sideSpan, 4.45 - sideSpringY, sideArchR, 0.48);
    sideSpandrelGeo.rotateY(Math.PI / 2);
    const sideArchTrimGeo = createArchivoltTrimGeo(sideArchR - 0.02, sideArchR + 0.15, 0.56);
    sideArchTrimGeo.rotateY(Math.PI / 2);

    [-12.6, 12.6].forEach((ax) => {
      // Các trụ cột giữa bên hông (bỏ 2 trụ đầu cuối vì đã tạo ở góc front/back)
      sideColZs.slice(1, -1).forEach((cz) => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.62, colH1, 0.62), creamTrimMat);
        pillar.position.set(ax, colY1, cz);
        addRongPart(pillar, 1, 0xe6dec8);

        // Chân cột tầng 1 màu xám đá ấm (0xc4bdb0)
        const pBase = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.42, 0.76), warmStoneBaseMat);
        pBase.position.set(ax, 0.45 + 0.21, cz);
        addRongPart(pBase, 1, 0xc4bdb0);

        const impost = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.18, 0.74), creamTrimMat);
        impost.position.set(ax, sideSpringY, cz);
        addRongPart(impost, 1, 0xe6dec8);
      });

      // 5 Nhịp cửa vòm tròn liên tiếp dọc hai bên hông
      for (let j = 0; j < 5; j++) {
        const bayCenterZ = (sideColZs[j] + sideColZs[j + 1]) / 2;

        const spandrel = new THREE.Mesh(sideSpandrelGeo, creamTrimMat);
        spandrel.position.set(ax, sideSpringY, bayCenterZ);
        addRongPart(spandrel, 1, 0xe6dec8);

        const archTrim = new THREE.Mesh(sideArchTrimGeo, creamTrimMat);
        archTrim.position.set(ax, sideSpringY, bayCenterZ);
        addRongPart(archTrim, 1, 0xe6dec8);

        const keystone = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.26), creamTrimMat);
        keystone.position.set(ax, sideSpringY + sideArchR + 0.09, bayCenterZ);
        addRongPart(keystone, 1, 0xe6dec8);

        const lowRail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 2.42), creamTrimMat);
        lowRail.position.set(ax, 0.45 + 0.36, bayCenterZ);
        addRongPart(lowRail, 1, 0xe6dec8);

        const railSlot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 1.9), ironRailingMat);
        railSlot.position.set(ax, 0.45 + 0.36, bayCenterZ);
        addRongPart(railSlot, 1, 0x1e2624);
      }
    });

    // -------------------------------------------------------------------------
    // 4. TẦNG 2 (TẦNG LẦU - HÀNG CỘT VUÔNG & LAN CAN GANG ĐÚC, y = 4.4 đến 8.4)
    // -------------------------------------------------------------------------
    // Sàn hành lang tầng 2 & Gờ phào chỉ phân tầng (Cornice belt) tại y = 4.45
    const floor2Slab = new THREE.Mesh(new THREE.BoxGeometry(26.6, 0.32, 16.6), creamTrimMat);
    floor2Slab.position.set(0, 4.45, 0);
    addRongPart(floor2Slab, 2, 0xe6dec8);

    // Lõi tường tầng 2 (BoxGeometry(22, 4.0, 12) đặt từ y = 4.4 đến 8.4 -> tâm y = 6.4) dùng brickWallMat (0xb86b5a)
    const coreFloor2 = new THREE.Mesh(new THREE.BoxGeometry(22, 4.0, 12), brickWallMat);
    coreFloor2.position.set(0, 6.4, 0);
    addRongPart(coreFloor2, 2, 0xb86b5a);

    // Các ô cửa gỗ gụ sẫm (0x3b2618) trên lõi tường Tầng 2 (mặt trước & mặt sau z = ±6.0)
    [-1, 1].forEach((dirZ) => {
      const wallZ = dirZ * 6.0;
      [-9.8, -7.0, -3.6, 0, 3.6, 7.0, 9.8].forEach((wx, idx) => {
        const isCenter = idx === 3;
        addCoreOpening(wx, 6.35, wallZ, isCenter ? 1.65 : 1.25, 2.25, 2, 'z', true);
      });
    });

    // Các ô cửa gỗ gụ sẫm trên lõi tường Tầng 2 ở hai bên hông (x = ±11.0)
    [-1, 1].forEach((dirX) => {
      const wallX = dirX * 11.0;
      [-4.6, -2.3, 0, 2.3, 4.6].forEach((wz) => {
        addCoreOpening(wallX, 6.35, wz, 1.2, 2.2, 2, 'x', false);
      });
    });

    // HÀNH LANG TẦNG 2: 8 cột trụ vuông màu vàng kem ngà + Lan can gang đúc xanh đen (0x1e2624) + Diềm hoa văn dưới dầm trần
    const colH2 = 3.9; // Từ y = 4.55 đến y = 8.45
    const colY2 = 4.55 + colH2 / 2;

    [-7.6, 7.6].forEach((az) => {
      // 8 Cột trụ vuông tầng 2 mặt trước & mặt sau
      frontColXs.forEach((cx) => {
        const col2 = new THREE.Mesh(new THREE.BoxGeometry(0.56, colH2, 0.56), creamTrimMat);
        col2.position.set(cx, colY2, az);
        addRongPart(col2, 2, 0xe6dec8);

        const base2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.7), warmStoneBaseMat);
        base2.position.set(cx, 4.55 + 0.14, az);
        addRongPart(base2, 2, 0xc4bdb0);

        const cap2 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.24, 0.72), creamTrimMat);
        cap2.position.set(cx, 8.32, az);
        addRongPart(cap2, 2, 0xe6dec8);
      });

      // Lan can sắt gang đúc màu xanh đen (0x1e2624) & Diềm trang trí hoa văn dưới dầm trần cho 7 nhịp trước/sau
      for (let i = 0; i < 7; i++) {
        const bayCenterX = (frontColXs[i] + frontColXs[i + 1]) / 2;

        // Tay vịn trên & dưới của lan can tầng 2
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.12, 0.28), creamTrimMat);
        topRail.position.set(bayCenterX, 5.42, az);
        addRongPart(topRail, 2, 0xe6dec8);

        const botRail = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.12, 0.28), creamTrimMat);
        botRail.position.set(bayCenterX, 4.68, az);
        addRongPart(botRail, 2, 0xe6dec8);

        // Hệ lan can giữa các cột tầng 2 màu xanh đen gang đúc (0x1e2624)
        const balusterPanel = new THREE.Mesh(new THREE.BoxGeometry(2.92, 0.62, 0.14), ironRailingMat);
        balusterPanel.position.set(bayCenterX, 5.05, az);
        addRongPart(balusterPanel, 2, 0x1e2624);

        for (let b = -3; b <= 3; b++) {
          const spindle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 0.2), ironRailingMat);
          spindle.position.set(bayCenterX + b * 0.38, 5.05, az);
          addRongPart(spindle, 2, 0x1e2624);
        }

        // Diềm trang trí hoa văn (Ornamental Frieze & Valance) dưới dầm trần tầng 2
        const upperBeam = new THREE.Mesh(new THREE.BoxGeometry(3.08, 0.38, 0.42), creamTrimMat);
        upperBeam.position.set(bayCenterX, 8.18, az);
        addRongPart(upperBeam, 2, 0xe6dec8);

        const friezeBand = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.22, 0.26), ironRailingMat);
        friezeBand.position.set(bayCenterX, 7.88, az);
        addRongPart(friezeBand, 2, 0x1e2624);

        // Hai con sơn vòm góc (Corner brackets) dưới dầm trần mỗi nhịp
        [-1.22, 1.22].forEach((bx) => {
          const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), creamTrimMat);
          bracket.position.set(bayCenterX + bx, 7.72, az);
          addRongPart(bracket, 2, 0xe6dec8);
        });
      }
    });

    // Hàng cột vuông tầng 2 & Lan can gang đúc ở HAI BÊN HÔNG (x = ±12.6)
    [-12.6, 12.6].forEach((ax) => {
      sideColZs.slice(1, -1).forEach((cz) => {
        const col2 = new THREE.Mesh(new THREE.BoxGeometry(0.56, colH2, 0.56), creamTrimMat);
        col2.position.set(ax, colY2, cz);
        addRongPart(col2, 2, 0xe6dec8);

        const base2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.7), warmStoneBaseMat);
        base2.position.set(ax, 4.55 + 0.14, cz);
        addRongPart(base2, 2, 0xc4bdb0);

        const cap2 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.24, 0.72), creamTrimMat);
        cap2.position.set(ax, 8.32, cz);
        addRongPart(cap2, 2, 0xe6dec8);
      });

      for (let j = 0; j < 5; j++) {
        const bayCenterZ = (sideColZs[j] + sideColZs[j + 1]) / 2;

        const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 2.48), creamTrimMat);
        topRail.position.set(ax, 5.42, bayCenterZ);
        addRongPart(topRail, 2, 0xe6dec8);

        const botRail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 2.48), creamTrimMat);
        botRail.position.set(ax, 4.68, bayCenterZ);
        addRongPart(botRail, 2, 0xe6dec8);

        const balusterPanel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 2.38), ironRailingMat);
        balusterPanel.position.set(ax, 5.05, bayCenterZ);
        addRongPart(balusterPanel, 2, 0x1e2624);

        const upperBeam = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 2.52), creamTrimMat);
        upperBeam.position.set(ax, 8.18, bayCenterZ);
        addRongPart(upperBeam, 2, 0xe6dec8);

        const friezeBand = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 2.42), ironRailingMat);
        friezeBand.position.set(ax, 7.88, bayCenterZ);
        addRongPart(friezeBand, 2, 0x1e2624);
      }
    });

    // -------------------------------------------------------------------------
    // 5. TẦNG 3 (TẦNG ÁP MÁI LÙI VÀO TRONG & SÂN THƯỢNG CÓ LAN CAN BAO QUANH)
    // -------------------------------------------------------------------------
    // Diềm mái sàn tầng 3 (y = 8.5): Sàn phẳng đua rộng hết khổ 26 x 16
    const floor3Terrace = new THREE.Mesh(new THREE.BoxGeometry(26.8, 0.38, 16.8), creamTrimMat);
    floor3Terrace.position.set(0, 8.5, 0);
    addRongPart(floor3Terrace, 3, 0xe6dec8);

    // Gờ phào chỉ nhô dưới sàn sân thượng
    const floor3Cornice = new THREE.Mesh(new THREE.BoxGeometry(27.2, 0.18, 17.2), warmStoneBaseMat);
    floor3Cornice.position.set(0, 8.62, 0);
    addRongPart(floor3Cornice, 3, 0xc4bdb0);

    // Bốn xung quanh sàn tầng 3 có hệ lan can vàng kem ngà kèm các trụ đầu cột nhô lên đều đặn
    [-7.8, 7.8].forEach((rz) => {
      // Thành lan can trước & sau
      const railWall = new THREE.Mesh(new THREE.BoxGeometry(25.6, 0.68, 0.24), creamTrimMat);
      railWall.position.set(0, 9.02, rz);
      addRongPart(railWall, 3, 0xe6dec8);

      // Các ô thoáng gang đúc tối màu trên lan can sân thượng
      for (let i = 0; i < 7; i++) {
        const bx = (frontColXs[i] + frontColXs[i + 1]) / 2;
        const slot = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.34, 0.28), ironRailingMat);
        slot.position.set(bx, 9.02, rz);
        addRongPart(slot, 3, 0x1e2624);
      }

      // 8 Trụ đầu cột (Balustrade Pedestals & Finials) nhô lên đều đặn thẳng hàng với các cột
      frontColXs.forEach((px) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.92, 0.54), creamTrimMat);
        post.position.set(px, 9.15, rz);
        addRongPart(post, 3, 0xe6dec8);

        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), warmStoneBaseMat);
        finial.position.set(px, 9.72, rz);
        addRongPart(finial, 3, 0xc4bdb0);
      });
    });

    [-12.8, 12.8].forEach((rx) => {
      // Thành lan can hai bên hông sân thượng
      const sideRailWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 15.6), creamTrimMat);
      sideRailWall.position.set(rx, 9.02, 0);
      addRongPart(sideRailWall, 3, 0xe6dec8);

      for (let j = 0; j < 5; j++) {
        const bz = (sideColZs[j] + sideColZs[j + 1]) / 2;
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 2.1), ironRailingMat);
        slot.position.set(rx, 9.02, bz);
        addRongPart(slot, 3, 0x1e2624);
      }

      sideColZs.slice(1, -1).forEach((pz) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.92, 0.54), creamTrimMat);
        post.position.set(rx, 9.15, pz);
        addRongPart(post, 3, 0xe6dec8);

        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), warmStoneBaseMat);
        finial.position.set(rx, 9.72, pz);
        addRongPart(finial, 3, 0xc4bdb0);
      });
    });

    // Khối nhà tầng 3 (cổ mái) lùi vào bên trong: đôn cao chuẩn tỷ lệ height = 2.2 (từ y = 8.5 đến y = 10.7 -> tâm y = 9.6)
    const atticBlock = new THREE.Mesh(new THREE.BoxGeometry(18, 2.2, 9), brickWallMat);
    atticBlock.position.set(0, 9.6, 0);
    addRongPart(atticBlock, 3, 0xb86b5a);

    // Gờ chân tường & gờ diềm mái vàng kem ngà trên đỉnh khối tầng 3 (y = 10.65)
    const atticBaseTrim = new THREE.Mesh(new THREE.BoxGeometry(18.3, 0.16, 9.3), warmStoneBaseMat);
    atticBaseTrim.position.set(0, 8.76, 0);
    addRongPart(atticBaseTrim, 3, 0xc4bdb0);

    const atticCornice = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.24, 9.6), creamTrimMat);
    atticCornice.position.set(0, 10.65, 0);
    addRongPart(atticCornice, 3, 0xe6dec8);

    // Hệ thống các ô cửa sổ nhỏ hình chữ nhật đứng xếp đều đặn dọc 4 mặt tường tầng 3:
    // - Mặt trước & mặt sau (z = ±4.5): 7 ô cửa sổ chữ nhật đứng kèm các bổ trụ kem ngà
    [-4.5, 4.5].forEach((az) => {
      [-6.9, -4.6, -2.3, 0, 2.3, 4.6, 6.9].forEach((wx) => {
        addCoreOpening(wx, 9.62, az, 0.92, 1.18, 3, 'z', false);
      });
      [-8.3, -5.75, -3.45, -1.15, 1.15, 3.45, 5.75, 8.3].forEach((px) => {
        const pil = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.1, 0.14), creamTrimMat);
        pil.position.set(px, 9.6, az + (az > 0 ? 0.05 : -0.05));
        addRongPart(pil, 3, 0xe6dec8);
      });
    });

    // - Hai bên hông (x = ±9.0): 4 ô cửa sổ chữ nhật đứng kèm các bổ trụ kem ngà
    [-9.0, 9.0].forEach((ax) => {
      [-3.15, -1.05, 1.05, 3.15].forEach((wz) => {
        addCoreOpening(ax, 9.62, wz, 0.92, 1.18, 3, 'x', false);
      });
      [-4.2, -2.1, 0, 2.1, 4.2].forEach((pz) => {
        const sidePil = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.1, 0.28), creamTrimMat);
        sidePil.position.set(ax + (ax > 0 ? 0.05 : -0.05), 9.6, pz);
        addRongPart(sidePil, 3, 0xe6dec8);
      });
    });

    // -------------------------------------------------------------------------
    // 6. HỆ MÁI NGÓI Á ĐÔNG & ĐÔI RỒNG CHẦU NGUYỆT ("LƯỠNG LONG CHẦU NGUYỆT")
    // -------------------------------------------------------------------------
    // A. Mái ngói chính (đôn lên tương ứng với tầng 3 mới: từ y = 10.7 đến y = 13.5):
    // Tạo khối mái dốc 4 mặt (Hip Roof) kéo dài theo chiều ngang (chân mái 20.4 x 11.2 tại y = 10.7,
    // thu lên sống mái ngang dài từ x = -6.2 đến x = +6.2 tại y = 13.5)
    const createElongatedHipRoofGeo = (
      baseW: number,
      baseD: number,
      ridgeW: number,
      roofH: number
    ) => {
      const hw = baseW / 2;
      const hd = baseD / 2;
      const hr = ridgeW / 2;

      // 6 Đỉnh của mái Hip Roof: 4 góc chân mái (y = 0) và 2 đầu sống mái ngang (y = roofH, z = 0)
      const positions = new Float32Array([
        // Mặt dốc phía Trước (+Z): hình thang cân
        -hw, 0, hd,
        hw, 0, hd,
        hr, roofH, 0,
        -hw, 0, hd,
        hr, roofH, 0,
        -hr, roofH, 0,

        // Mặt dốc phía Sau (-Z): hình thang cân
        hw, 0, -hd,
        -hw, 0, -hd,
        -hr, roofH, 0,
        hw, 0, -hd,
        -hr, roofH, 0,
        hr, roofH, 0,

        // Mặt dốc đầu hồi Trái (-X): tam giác
        -hw, 0, -hd,
        -hw, 0, hd,
        -hr, roofH, 0,

        // Mặt dốc đầu hồi Phải (+X): tam giác
        hw, 0, hd,
        hw, 0, -hd,
        hr, roofH, 0,

        // Mặt đáy đóng kín (y = 0)
        -hw, 0, -hd,
        hw, 0, -hd,
        hw, 0, hd,
        -hw, 0, -hd,
        hw, 0, hd,
        -hw, 0, hd,
      ]);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.computeVertexNormals();
      applyRongRoofUVs(geo, 0.44);
      return geo;
    };

    const mainRoofW = 20.4;
    const mainRoofD = 11.2;
    const mainRidgeSpan = 12.4; // Sống mái ngang từ x = -6.2 đến x = +6.2
    const mainRoofH = 2.8;      // Từ y = 10.7 đến y = 13.5

    const mainRoofGeo = createElongatedHipRoofGeo(mainRoofW, mainRoofD, mainRidgeSpan, mainRoofH);
    const mainRoofMesh = new THREE.Mesh(mainRoofGeo, roofMat);
    mainRoofMesh.position.set(0, 10.7, 0);
    addRongPart(mainRoofMesh, 3, 0x8f5640);

    // Viền bờ mái, 4 sống mái xiên (Hip Ridges) & 4 góc đao mái cong nhẹ (Flying Eaves) màu xanh gốm Cây Mai (0x3b6e6c)
    const hw = mainRoofW / 2; // 10.2
    const hd = mainRoofD / 2; // 5.6
    const hr = mainRidgeSpan / 2; // 6.2

    // Viền diềm chân mái xanh ngọc lam cổ chạy quanh 4 cạnh mái (y = 10.74)
    [-hd, hd].forEach((ez) => {
      const eaveTrimZ = new THREE.Mesh(new THREE.BoxGeometry(mainRoofW + 0.3, 0.14, 0.2), jadeDragonMat);
      eaveTrimZ.position.set(0, 10.74, ez);
      addRongPart(eaveTrimZ, 3, 0x3b6e6c);
    });
    [-hw, hw].forEach((ex) => {
      const eaveTrimX = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, mainRoofD + 0.3), jadeDragonMat);
      eaveTrimX.position.set(ex, 10.74, 0);
      addRongPart(eaveTrimX, 3, 0x3b6e6c);
    });

    // 4 Sống mái xiên (Hip Ridges) nối từ 4 góc chân mái (±hw, 10.7, ±hd) lên 2 đầu bờ nóc (±hr, 13.52, 0)
    // kèm 4 đao mái cong vút kiểu Á Đông ở 4 góc
    [-1, 1].forEach((sx) => {
      [-1, 1].forEach((sz) => {
        const startPt = new THREE.Vector3(sx * (hw + 0.32), 10.66, sz * (hd + 0.32));
        const ctrlPt1 = new THREE.Vector3(sx * (hw - 0.3), 10.88, sz * (hd - 0.2));
        const ctrlPt2 = new THREE.Vector3(sx * (hr + 1.15), 12.65, sz * 1.55);
        const endPt = new THREE.Vector3(sx * hr, 13.52, 0);

        const hipCurve = new THREE.CatmullRomCurve3([startPt, ctrlPt1, ctrlPt2, endPt]);
        const hipTubeGeo = new THREE.TubeGeometry(hipCurve, 20, 0.12, 8, false);
        const hipTubeMesh = new THREE.Mesh(hipTubeGeo, jadeDragonMat);
        addRongPart(hipTubeMesh, 3, 0x3b6e6c);

        // Đầu đao mái cong vút thanh mảnh ở 4 góc mái
        const eaveTipCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(sx * (hw - 0.1), 10.74, sz * (hd - 0.1)),
          new THREE.Vector3(sx * (hw + 0.42), 10.86, sz * (hd + 0.42)),
          new THREE.Vector3(sx * (hw + 0.78), 11.28, sz * (hd + 0.76)),
        ]);
        const eaveTipGeo = new THREE.TubeGeometry(eaveTipCurve, 12, 0.09, 8, false);
        const eaveTipMesh = new THREE.Mesh(eaveTipGeo, jadeDragonMat);
        addRongPart(eaveTipMesh, 3, 0x3b6e6c);
      });
    });

    // Thanh bờ nóc mái ngang dưới bụng rồng (y = 13.52, dài từ x = -6.35 đến x = +6.35) sơn màu xám đá cổ (0x64706c)
    const mainRidgeBar = new THREE.Mesh(
      new THREE.BoxGeometry(mainRidgeSpan + 0.35, 0.26, 0.3),
      ridgeStoneMat
    );
    mainRidgeBar.position.set(0, 13.52, 0);
    addRongPart(mainRidgeBar, 3, 0x64706c);

    const ridgeWhiteStrip = new THREE.Mesh(
      new THREE.BoxGeometry(mainRidgeSpan + 0.38, 0.06, 0.32),
      jadeWhiteTrimMat
    );
    ridgeWhiteStrip.position.set(0, 13.54, 0);
    addRongPart(ridgeWhiteStrip, 3, 0x4f7d78);

    // -------------------------------------------------------------------------
    // B. CỤM MẶT TRĂNG / TRÁI CHÂU & CỘT THU LÔI Ở CHÍNH GIỮA ĐỈNH MÁI (x = 0)
    //    Thu gọn mặt trăng dạng đĩa tròn dẹt (radius = 0.38) màu kem ngà cổ điển, viền mây lửa xanh ngọc lam cổ
    //    và cột thu lôi kim loại mảnh màu tối (height = 2.2) vươn thẳng lên trời từ đỉnh mặt trăng
    // -------------------------------------------------------------------------
    // Bệ vân mây nhỏ gọn đỡ mặt trăng ở chính giữa bờ nóc (x = 0, y = 13.72)
    const moonPedestal = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.2, 0.24), ridgeStoneMat);
    moonPedestal.position.set(0, 13.72, 0);
    addRongPart(moonPedestal, 3, 0x64706c);

    const moonPedestalTrim = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.06, 0.26), jadeWhiteTrimMat);
    moonPedestalTrim.position.set(0, 13.78, 0);
    addRongPart(moonPedestalTrim, 3, 0x4f7d78);

    // Hai cuộn mây nhỏ thanh mảnh đỡ hai bên chân mặt trăng
    [-1, 1].forEach((cSide) => {
      const cloudScroll = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 10, 18), jadeDragonMat);
      cloudScroll.position.set(cSide * 0.42, 13.84, 0);
      cloudScroll.scale.z = 0.65;
      addRongPart(cloudScroll, 3, 0x3b6e6c);
    });

    const moonCenterY = 14.22;

    // Đĩa tròn dẹt màu vàng kem ngà cổ điển ở trung tâm (radius = 0.38, dẹt thanh thoát theo trục Z)
    const moonDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.1, 28), moonPearlMat);
    moonDisc.rotation.x = Math.PI / 2;
    moonDisc.position.set(0, moonCenterY, 0);
    addRongPart(moonDisc, 3, 0xe6dec8);

    // Chỉ viền xám ngọc ôm sát đĩa mặt trăng
    const moonInnerRim = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.032, 10, 28), jadeWhiteTrimMat);
    moonInnerRim.position.set(0, moonCenterY, 0);
    moonInnerRim.scale.z = 0.7;
    addRongPart(moonInnerRim, 3, 0x4f7d78);

    // Viền mây lửa thanh mảnh màu xanh gốm Cây Mai (jadeDragonMat 0x3b6e6c) bao quanh đĩa mặt trăng
    const moonJadeHalo = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.048, 12, 32), jadeDragonMat);
    moonJadeHalo.position.set(0, moonCenterY, 0);
    moonJadeHalo.scale.z = 0.7;
    addRongPart(moonJadeHalo, 3, 0x3b6e6c);

    // Các tia mây lửa nhỏ mảnh mai uốn cong dọc theo viền xanh ngọc
    for (let a = -3; a <= 3; a++) {
      if (a === 0) continue;
      const angle = (a / 3.5) * (Math.PI * 0.48);
      const fx = Math.sin(angle) * 0.5;
      const fy = moonCenterY + Math.cos(angle) * 0.5;
      const flameWisp = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.18, 5), jadeDragonMat);
      flameWisp.position.set(fx, fy, 0);
      flameWisp.rotation.z = -angle * 0.85;
      flameWisp.scale.z = 0.55;
      addRongPart(flameWisp, 3, 0x3b6e6c);
    }

    // Hồ lô nhỏ đỡ chân cột thu lôi trên đỉnh mặt trăng (tại y = 14.7)
    const rodBaseFinial = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.14, 10), jadeDragonMat);
    rodBaseFinial.position.set(0, 14.72, 0);
    addRongPart(rodBaseFinial, 3, 0x3b6e6c);

    // CỘT THU LÔI KIM LOẠI THANH MẢNH MÀU TỐI (height = 2.2) VƯƠN THẲNG LÊN TRỜI TỪ ĐỈNH MẶT TRĂNG
    const lightningRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.032, 2.2, 8),
      lightningRodMat
    );
    lightningRod.position.set(0, 14.75 + 1.1, 0); // Từ y = 14.75 vươn thẳng lên y = 16.95
    addRongPart(lightningRod, 3, 0x262f3d);

    // Nút sứ cách điện nhỏ trên thân cột thu lôi
    const rodInsulator = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), jadeWhiteTrimMat);
    rodInsulator.position.set(0, 15.15, 0);
    addRongPart(rodInsulator, 3, 0x4f7d78);

    // -------------------------------------------------------------------------
    // C. ĐÔI RỒNG ĐẤT NUNG THANH MẢNH, SẮC SẢO (Xanh Gốm Cây Mai 0x3b6e6c pha ánh xám ngọc 0x4f7d78)
    //    - Bán kính thân rồng nhỏ gọn (radius = 0.135), tuyệt đối không xếp khối cầu làm phồng thân
    //    - Đường cong 3 nhịp uốn sóng thanh thoát từ x = ±1.2 ra hai đầu hồi x = ±6.2
    //    - Bụng rồng nhấc thoáng khỏi bờ nóc kèm các trụ đỡ nhỏ nối xuống bờ nóc xám đá cổ (0x64706c)
    //    - Đầu rồng Á Đông thanh mảnh tại x = ±1.3 (không có mắt cam lồi), đuôi vuốt thon cong vút tại x = ±6.2
    // -------------------------------------------------------------------------
    const buildGlazedRoofDragon = (side: -1 | 1) => {
      // 1) Đường cong 3 nhịp uốn sóng thanh thoát chạy từ gần mặt trăng (|x| = 1.25) ra hai đầu hồi (|x| = 6.2)
      const bodyPoints = [
        new THREE.Vector3(side * 1.25, 14.12, 0),  // Cổ rồng ngẩng cao tại x = ±1.25..1.3
        new THREE.Vector3(side * 1.82, 13.76, 0),  // Nhịp hạ cổ trước (thoáng trên bờ nóc)
        new THREE.Vector3(side * 2.58, 14.26, 0),  // Đỉnh uốn sóng thứ 1
        new THREE.Vector3(side * 3.38, 13.74, 0),  // Nhịp võng bụng giữa (thoáng trên bờ nóc)
        new THREE.Vector3(side * 4.18, 14.20, 0),  // Đỉnh uốn sóng thứ 2
        new THREE.Vector3(side * 4.95, 13.74, 0),  // Nhịp võng bụng sau (thoáng trên bờ nóc)
        new THREE.Vector3(side * 5.58, 14.12, 0),  // Đỉnh uốn sóng thứ 3
        new THREE.Vector3(side * 5.98, 13.82, 0),  // Gốc đuôi thu nhỏ ở gần đầu hồi
        new THREE.Vector3(side * 6.22, 14.28, 0),  // Thân đuôi uốn cong vút lên cao tại x = ±6.2
      ];
      const bodyCurve = new THREE.CatmullRomCurve3(bodyPoints);

      // Thân rồng chính bằng TubeGeometry thanh mảnh (radius = 0.135) màu xanh gốm Cây Mai (0x3b6e6c)
      const bodyGeo = new THREE.TubeGeometry(bodyCurve, 56, 0.135, 12, false);
      const bodyMesh = new THREE.Mesh(bodyGeo, jadeDragonMat);
      addRongPart(bodyMesh, 3, 0x3b6e6c);

      // Đường chỉ viền xám ngọc (0x4f7d78) mảnh chạy dọc theo lườn bụng dưới của thân rồng
      const bellyTrimPoints = bodyPoints.map(
        (p) => new THREE.Vector3(p.x, p.y - 0.095, p.z)
      );
      const bellyTrimCurve = new THREE.CatmullRomCurve3(bellyTrimPoints);
      const bellyTrimGeo = new THREE.TubeGeometry(bellyTrimCurve, 48, 0.042, 8, false);
      const bellyTrimMesh = new THREE.Mesh(bellyTrimGeo, jadeWhiteTrimMat);
      addRongPart(bellyTrimMesh, 3, 0x4f7d78);

      // 2) Các trụ đỡ nhỏ thanh mảnh nối từ bụng rồng xuống bờ nóc mái xám đá cổ (y = 13.52..13.78)
      [1.82, 3.38, 4.95, 5.95].forEach((strutX, idx) => {
        const strut = new THREE.Mesh(
          new THREE.CylinderGeometry(0.048, 0.062, 0.3, 8),
          ridgeStoneMat
        );
        strut.position.set(side * strutX, 13.64, 0);
        addRongPart(strut, 3, 0x64706c);

        // Chân móng nhỏ bám nhẹ vào bờ nóc ở trụ trước và trụ sau
        if (idx === 0 || idx === 2) {
          const clawBase = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.06, 0.22),
            jadeWhiteTrimMat
          );
          clawBase.position.set(side * strutX, 13.66, 0);
          addRongPart(clawBase, 3, 0x4f7d78);
        }
      });

      // 3) Hàng vây kỳ lưng tỉa mảnh sắc nhọn dọc theo sống lưng rồng (xanh gốm Cây Mai 0x3b6e6c pha ánh xám ngọc 0x4f7d78)
      for (let t = 0.06; t <= 0.92; t += 0.045) {
        const pt = bodyCurve.getPointAt(t);
        const tangent = bodyCurve.getTangentAt(t);
        const normalUp = new THREE.Vector3(-side * tangent.y, Math.abs(tangent.x), 0).normalize();
        if (normalUp.y < 0.3) normalUp.set(0, 1, 0);

        const finScale = 1.0 - t * 0.28;

        // Gai vây lưng mảnh sắc nhọn (dẹt theo trục Z để thanh thoát)
        const finSpine = new THREE.Mesh(
          new THREE.ConeGeometry(0.055 * finScale, 0.24 * finScale, 4),
          jadeDragonMat
        );
        finSpine.scale.z = 0.45;
        finSpine.position.copy(pt).addScaledVector(normalUp, 0.16);
        finSpine.rotation.z = side * (0.28 + tangent.y * 0.25);
        addRongPart(finSpine, 3, 0x3b6e6c);

        // Chóp viền ánh xám ngọc mảnh trên vây lưng
        const finTip = new THREE.Mesh(
          new THREE.ConeGeometry(0.032 * finScale, 0.12 * finScale, 4),
          jadeWhiteTrimMat
        );
        finTip.scale.z = 0.45;
        finTip.position.copy(pt).addScaledVector(normalUp, 0.24);
        finTip.rotation.z = side * (0.28 + tangent.y * 0.25);
        addRongPart(finTip, 3, 0x4f7d78);
      }

      // 4) ĐẦU RỒNG Á ĐÔNG THANH MẢNH TẠI x = side * 1.3, HƯỚNG VÀO MẶT TRĂNG
      const headX = side * 1.26;
      const headY = 14.18;

      // Hộp sọ rồng thon gọn vát góc
      const skull = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.22), jadeDragonMat);
      skull.position.set(headX, headY, 0);
      skull.rotation.z = -side * 0.08;
      addRongPart(skull, 3, 0x3b6e6c);

      // Gờ trán & sống mũi rồng ánh xám ngọc thanh mảnh
      const browRidge = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.18), jadeWhiteTrimMat);
      browRidge.position.set(headX - side * 0.04, headY + 0.11, 0);
      browRidge.rotation.z = -side * 0.12;
      addRongPart(browRidge, 3, 0x4f7d78);

      // Hàm trên (Upper Jaw) vát mảnh vươn về phía mặt trăng (-side)
      const upperJaw = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.18), jadeDragonMat);
      upperJaw.position.set(headX - side * 0.24, headY + 0.04, 0);
      upperJaw.rotation.z = -side * 0.14;
      addRongPart(upperJaw, 3, 0x3b6e6c);

      // Mào mũi uốn cong nhẹ ở đầu mõm trên
      const snoutCrest = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 4), jadeWhiteTrimMat);
      snoutCrest.scale.z = 0.5;
      snoutCrest.position.set(headX - side * 0.38, headY + 0.12, 0);
      snoutCrest.rotation.z = side * 0.25;
      addRongPart(snoutCrest, 3, 0x4f7d78);

      // Hàm dưới (Lower Jaw) vát mảnh há nhẹ chầu nguyệt
      const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.065, 0.15), jadeDragonMat);
      lowerJaw.position.set(headX - side * 0.21, headY - 0.08, 0);
      lowerJaw.rotation.z = side * 0.22;
      addRongPart(lowerJaw, 3, 0x3b6e6c);

      const lowerJawTrim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.16), jadeWhiteTrimMat);
      lowerJawTrim.position.set(headX - side * 0.21, headY - 0.1, 0);
      lowerJawTrim.rotation.z = side * 0.22;
      addRongPart(lowerJawTrim, 3, 0x4f7d78);

      // Hai sừng rồng thanh mảnh vươn dài ra phía sau
      [-0.075, 0.075].forEach((hz) => {
        const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.038, 0.48, 6), jadeWhiteTrimMat);
        horn.position.set(headX + side * 0.16, headY + 0.22, hz);
        horn.rotation.z = -side * 0.72;
        horn.rotation.x = hz * 0.6;
        addRongPart(horn, 3, 0x4f7d78);
      });

      // Bờm đầu rồng tỉa mảnh sắc nhọn phóng về phía sau gáy (xanh gốm Cây Mai 0x3b6e6c pha ánh xám ngọc 0x4f7d78)
      for (let m = 0; m < 4; m++) {
        const maneAngle = -0.55 - m * 0.22;
        const maneSpike = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.32 - m * 0.03, 4), jadeDragonMat);
        maneSpike.scale.z = 0.45;
        maneSpike.position.set(headX + side * (0.18 + m * 0.04), headY + 0.14 - m * 0.06, 0);
        maneSpike.rotation.z = side * maneAngle;
        addRongPart(maneSpike, 3, 0x3b6e6c);

        const maneEdge = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22 - m * 0.02, 4), jadeWhiteTrimMat);
        maneEdge.scale.z = 0.45;
        maneEdge.position.set(headX + side * (0.24 + m * 0.04), headY + 0.16 - m * 0.06, 0);
        maneEdge.rotation.z = side * maneAngle;
        addRongPart(maneEdge, 3, 0x4f7d78);
      }

      // 5) ĐUÔI RỒNG TẠI HAI ĐẦU BỜ NÓC (x = ±6.2): Vuốt thon nhỏ và uốn cong vút lên cao tạo dáng đầu đao sắc nét
      const tailSweepPoints = [
        new THREE.Vector3(side * 6.08, 13.96, 0),
        new THREE.Vector3(side * 6.26, 14.32, 0),
        new THREE.Vector3(side * 6.38, 14.72, 0),
        new THREE.Vector3(side * 6.28, 15.05, 0), // Đầu đao đuôi rồng vuốt cong nhọn vút lên cao
      ];
      const tailSweepCurve = new THREE.CatmullRomCurve3(tailSweepPoints);
      const tailSweepGeo = new THREE.TubeGeometry(tailSweepCurve, 20, 0.075, 8, false);
      const tailSweepMesh = new THREE.Mesh(tailSweepGeo, jadeDragonMat);
      addRongPart(tailSweepMesh, 3, 0x3b6e6c);

      // Ngọn đuôi vuốt nhọn sắc nét như mũi đao kèm 3 tà vây đuôi mảnh mai
      const tailTipBlade = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.38, 4), jadeDragonMat);
      tailTipBlade.scale.z = 0.45;
      tailTipBlade.position.set(side * 6.25, 15.16, 0);
      tailTipBlade.rotation.z = side * 0.22;
      addRongPart(tailTipBlade, 3, 0x3b6e6c);

      for (let tf = -1; tf <= 1; tf++) {
        const feather = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.32, 4), jadeWhiteTrimMat);
        feather.scale.z = 0.4;
        feather.position.set(side * (6.36 - Math.abs(tf) * 0.05), 14.72 + tf * 0.16, 0);
        feather.rotation.z = -side * (0.45 - tf * 0.2);
        addRongPart(feather, 3, 0x4f7d78);
      }
    };

    // Dựng đôi rồng đối xứng hai bên chầu mặt trăng ở giữa
    buildGlazedRoofDragon(-1);
    buildGlazedRoofDragon(1);

    return null;

  } else if (siteId === 'HCM-DT-004') {
    // =========================================================================
    // CHỢ BẾN THÀNH (BEN THANH MARKET) — KIẾN TRÚC ĐÔNG DƯƠNG 1914 CHÂN THỰC (PBR + CANVAS TEXTURES)
    // =========================================================================

    // -------------------------------------------------------------------------
    // 1. TẠO VÂN BỀ MẶT BẰNG CANVAS TEXTURE (KHỬ HOÀN TOÀN CẢM GIÁC NHỰA BÓNG)
    // -------------------------------------------------------------------------

    // A. CanvasTexture + BumpMap cho Hệ Mái Ngói Đỏ (sọc sóng ngói dọc + hàng ngói ngang)
    const createBenThanhRoofTextures = () => {
      const colorCanvas = document.createElement('canvas');
      colorCanvas.width = 512;
      colorCanvas.height = 512;
      const cCtx = colorCanvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = 512;
      bumpCanvas.height = 512;
      const bCtx = bumpCanvas.getContext('2d');

      if (cCtx && bCtx) {
        // Nền đỏ gạch trầm (#a83c2b)
        cCtx.fillStyle = '#a83c2b';
        cCtx.fillRect(0, 0, 512, 512);

        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, 512, 512);

        // Sọc sóng tôn / ngói âm dương dọc (32 sóng trên 512px -> mỗi sóng 16px)
        const ribWidth = 16;
        for (let x = 0; x < 512; x += ribWidth) {
          // Rãnh âm tối (#7c281c)
          cCtx.fillStyle = '#7c281c';
          cCtx.fillRect(x, 0, 5, 512);

          // Sườn chuyển tiếp (#963324)
          cCtx.fillStyle = '#963324';
          cCtx.fillRect(x + 5, 0, 4, 512);

          // Sống ngói dương bắt sáng nhẹ (#bd4a38)
          cCtx.fillStyle = '#bd4a38';
          cCtx.fillRect(x + 9, 0, 5, 512);

          // Cạnh đổ bóng (#872c1e)
          cCtx.fillStyle = '#872c1e';
          cCtx.fillRect(x + 14, 0, 2, 512);

          // Bump map cho sống ngói
          bCtx.fillStyle = '#383838';
          bCtx.fillRect(x, 0, 5, 512);
          bCtx.fillStyle = '#dcdcdc';
          bCtx.fillRect(x + 8, 0, 6, 512);
        }

        // Các đường gờ ngang mờ mô phỏng mí ngói xếp lớp (mỗi 32px)
        for (let y = 0; y < 512; y += 32) {
          cCtx.fillStyle = 'rgba(62, 16, 10, 0.36)';
          cCtx.fillRect(0, y, 512, 3);
          cCtx.fillStyle = 'rgba(228, 120, 98, 0.16)';
          cCtx.fillRect(0, y + 3, 512, 2);

          bCtx.fillStyle = '#252525';
          bCtx.fillRect(0, y, 512, 3);
        }

        // Hạt nhám đất nung & vết rêu phong thời gian rất nhẹ
        for (let i = 0; i < 4500; i++) {
          const rx = Math.random() * 512;
          const ry = Math.random() * 512;
          cCtx.fillStyle = i % 2 === 0 ? 'rgba(48, 18, 12, 0.12)' : 'rgba(215, 95, 72, 0.1)';
          cCtx.fillRect(rx, ry, 2, 2);
        }
      }

      const map = new THREE.CanvasTexture(colorCanvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(1, 1);

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(1, 1);

      return { map, bumpMap };
    };

    // B. CanvasTexture + BumpMap cho Tường Vàng Kem Cổ Điển (#e8d5b5 có hạt nhám vữa xi măng mờ)
    const createBenThanhWallTextures = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = 256;
      bumpCanvas.height = 256;
      const bCtx = bumpCanvas.getContext('2d');

      if (ctx && bCtx) {
        ctx.fillStyle = '#e8d5b5';
        ctx.fillRect(0, 0, 256, 256);

        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, 256, 256);

        // Hạt vữa xi măng mờ (subtle plaster grain)
        for (let i = 0; i < 5000; i++) {
          const x = Math.random() * 256;
          const y = Math.random() * 256;
          const sz = Math.random() * 2.2 + 0.8;
          ctx.fillStyle = i % 3 === 0 ? 'rgba(182, 156, 118, 0.18)' : 'rgba(252, 242, 222, 0.18)';
          ctx.fillRect(x, y, sz, sz);

          bCtx.fillStyle = i % 2 === 0 ? '#686868' : '#989898';
          bCtx.fillRect(x, y, sz, sz);
        }
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

      return { map, bumpMap };
    };

    // C. CanvasTexture cho Mặt Đồng Hồ Tròn (Nền trắng ngà #fdfbf7, viền xanh cổ vịt #2c6b64, 12 cọc số & vạch phút sắc nét)
    const createBenThanhClockDialTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const cx = 256;
        const cy = 256;

        // Nền ngoài xanh cổ vịt (#2c6b64)
        ctx.fillStyle = '#2c6b64';
        ctx.fillRect(0, 0, 512, 512);

        // Mặt đồng hồ tròn nền trắng ngà (#fdfbf7)
        ctx.beginPath();
        ctx.arc(cx, cy, 226, 0, Math.PI * 2);
        ctx.fillStyle = '#fdfbf7';
        ctx.fill();

        // Viền trong xanh cổ vịt + chỉ vàng đồng mảnh
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#2c6b64';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 210, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#b48a44';
        ctx.stroke();

        // Vòng chia 60 vạch phút & 12 cọc số giờ đậm
        for (let i = 0; i < 60; i++) {
          const angle = (i * Math.PI) / 30 - Math.PI / 2;
          const isHour = i % 5 === 0;
          const isQuarter = i % 15 === 0;
          const outerR = 198;
          const innerR = isQuarter ? 162 : isHour ? 170 : 186;

          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
          ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
          ctx.lineWidth = isQuarter ? 10 : isHour ? 7 : 2.5;
          ctx.strokeStyle = '#182220';
          ctx.stroke();
        }

        // Chữ số giờ cổ điển tại 12, 3, 6, 9 và các chấm số phụ
        ctx.fillStyle = '#141d1b';
        ctx.font = 'bold 42px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const numerals: Array<[number, string]> = [
          [12, 'XII'],
          [3, 'III'],
          [6, 'VI'],
          [9, 'IX'],
        ];
        numerals.forEach(([h, label]) => {
          const ang = (h * Math.PI) / 6 - Math.PI / 2;
          const r = 132;
          ctx.fillText(label, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
        });

        // Vòng tròn mảnh tâm đồng hồ
        ctx.beginPath();
        ctx.arc(cx, cy, 78, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(44, 107, 100, 0.45)';
        ctx.stroke();

        // Vẽ luôn bóng mờ của 2 kim chỉ 10h10 trên mặt số để nhìn từ xa vẫn cực kỳ rõ nét
        // Kim giờ (10h10 -> góc -60 độ so với trục đứng 12h)
        const drawHand = (angleRad: number, length: number, width: number) => {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angleRad);
          ctx.beginPath();
          ctx.moveTo(-width * 0.6, 24);
          ctx.lineTo(-width * 0.5, -length);
          ctx.lineTo(0, -length - 14);
          ctx.lineTo(width * 0.5, -length);
          ctx.lineTo(width * 0.6, 24);
          ctx.closePath();
          ctx.fillStyle = '#111615';
          ctx.fill();
          ctx.restore();
        };

        drawHand(-0.92, 118, 14); // Kim giờ hướng 10h
        drawHand(0.92, 162, 10);  // Kim phút hướng 2h (10 phút)

        // Tâm đồng hồ
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#1f2927';
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    // D. CanvasTexture cho Bảng Hiệu "CHỢ BẾN THÀNH" trên trán Cổng Nam
    const createBenThanhSignTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Nền bảng trắng ngà cổ điển
        ctx.fillStyle = '#f8f2e4';
        ctx.fillRect(0, 0, 1024, 256);

        // Viền khung kép trang trọng
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#2d6a65';
        ctx.strokeRect(14, 14, 996, 228);

        ctx.lineWidth = 4;
        ctx.strokeStyle = '#b58942';
        ctx.strokeRect(30, 30, 964, 196);

        // Bóng đổ nhẹ cho chữ
        ctx.font = 'bold 92px "Arial", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
        ctx.fillText('CHỢ BẾN THÀNH', 516, 136);

        // Dòng chữ in hoa "CHỢ BẾN THÀNH" sắc nét, chuẩn kiểu chữ lịch sử
        ctx.fillStyle = '#162925';
        ctx.fillText('CHỢ BẾN THÀNH', 512, 132);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    // E. CanvasTexture cho Phù điêu gốm Biên Hòa (1952) ngay dưới bảng chữ Cổng Nam
    const createCeramicReliefTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Nền vữa kem ấm
        ctx.fillStyle = '#e5cfa6';
        ctx.fillRect(0, 0, 512, 192);

        // Khung gốm men xanh đồng trổ hoa văn
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#2d6a65';
        ctx.strokeRect(10, 10, 492, 172);

        // Hoạ tiết phù điêu gốm Biên Hòa cách điệu (cá đuối, nải chuối, nông sản Nam Bộ)
        // Phù điêu cá đuối & sóng nước ở trung tâm
        ctx.fillStyle = '#a83c2b';
        ctx.beginPath();
        ctx.moveTo(256, 36);
        ctx.lineTo(318, 96);
        ctx.lineTo(256, 152);
        ctx.lineTo(194, 96);
        ctx.closePath();
        ctx.fill();

        // Nải chuối & hoa quả gốm men xanh/vàng hai bên
        ctx.fillStyle = '#2d6a65';
        ctx.beginPath();
        ctx.arc(118, 96, 42, 0, Math.PI * 2);
        ctx.arc(394, 96, 42, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#d4943a';
        ctx.beginPath();
        ctx.arc(118, 96, 24, 0, Math.PI * 2);
        ctx.arc(394, 96, 24, 0, Math.PI * 2);
        ctx.arc(256, 96, 22, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    if (!landmarkTextureCache.has('btRoofTex')) {
      const texPair = createBenThanhRoofTextures();
      texPair.map.userData = { isCached: true };
      texPair.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('btRoofTex', texPair);
    }
    if (!landmarkTextureCache.has('btWallTex')) {
      const texPair = createBenThanhWallTextures();
      texPair.map.userData = { isCached: true };
      texPair.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('btWallTex', texPair);
    }
    if (!landmarkTextureCache.has('btClockTex')) {
      const tex = createBenThanhClockDialTexture();
      tex.userData = { isCached: true };
      landmarkTextureCache.set('btClockTex', tex);
    }
    if (!landmarkTextureCache.has('btSignTex')) {
      const tex = createBenThanhSignTexture();
      tex.userData = { isCached: true };
      landmarkTextureCache.set('btSignTex', tex);
    }
    if (!landmarkTextureCache.has('btReliefTex')) {
      const tex = createCeramicReliefTexture();
      tex.userData = { isCached: true };
      landmarkTextureCache.set('btReliefTex', tex);
    }

    const roofTextures = landmarkTextureCache.get('btRoofTex');
    const wallTextures = landmarkTextureCache.get('btWallTex');
    const clockDialTex = landmarkTextureCache.get('btClockTex');
    const signBoardTex = landmarkTextureCache.get('btSignTex');
    const ceramicReliefTex = landmarkTextureCache.get('btReliefTex');

    // Tường chính: Nền vàng kem cổ điển (#e8d5b5) có hạt nhám vữa xi măng mờ, roughness: 0.9, metalness: 0.0
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: wallTextures.map,
      bumpMap: wallTextures.bumpMap,
      bumpScale: 0.015,
      roughness: 0.9,
      metalness: 0.0,
    });

    // Phào chỉ, viền khung, cột trụ, diềm mái và mái hiên: Màu trắng ngà / đá vôi mịn
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xf7f2e4,
      bumpMap: wallTextures.bumpMap,
      bumpScale: 0.008,
      roughness: 0.78,
      metalness: 0.02,
    });

    // Hệ mái tôn / ngói: Nền đỏ gạch trầm (#a83c2b) kèm vân sọc sóng ngói dọc & gờ ngói ngang
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: roofTextures.map,
      bumpMap: roofTextures.bumpMap,
      bumpScale: 0.06,
      roughness: 0.85,
      metalness: 0.05,
    });

    // Hốc cửa vòm, lam thông gió: Màu xám đen / xanh đen trầm có chiều sâu
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x18221f,
      roughness: 0.88,
      metalness: 0.05,
    });

    // Mặt đồng hồ tròn có vạch chia giờ sắc nét
    const clockFaceMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: clockDialTex,
      roughness: 0.45,
      metalness: 0.05,
    });

    // Viền mặt đồng hồ: Xanh cổ vịt cổ điển (#2c6b64)
    const clockRimMat = new THREE.MeshStandardMaterial({
      color: 0x2c6b64,
      roughness: 0.55,
      metalness: 0.1,
    });

    // Kim đồng hồ nổi 3D: Đen sẫm
    const clockHandMat = new THREE.MeshStandardMaterial({
      color: 0x111514,
      roughness: 0.45,
      metalness: 0.2,
    });

    // Bảng hiệu chữ "CHỢ BẾN THÀNH"
    const signBoardFaceMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: signBoardTex,
      roughness: 0.55,
      metalness: 0.04,
    });

    // Phù điêu gốm Biên Hòa
    const ceramicReliefMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: ceramicReliefTex,
      bumpMap: wallTextures.bumpMap,
      bumpScale: 0.025,
      roughness: 0.5,
      metalness: 0.08,
    });

    // Chóp kim loại vàng đồng trên đỉnh mái tháp
    const goldFinialMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.3,
      metalness: 0.8,
    });

    // Bệ nền mỏng đá xám ôm sát chân móng
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0xbec3c9,
      bumpMap: wallTextures.bumpMap,
      bumpScale: 0.02,
      roughness: 0.88,
      metalness: 0.02,
    });

    // Helper chuẩn hóa UV cho mái ExtrudeGeometry/ConeGeometry để sọc ngói dọc luôn chạy chuẩn theo chiều dốc mái
    const applyRoofTileUVs = (geo: THREE.BufferGeometry, ridgeAlongZ: boolean, tileScale = 0.42) => {
      geo.computeBoundingBox();
      const pos = geo.attributes.position;
      const norm = geo.attributes.normal;
      const uvs = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const ny = norm ? Math.abs(norm.getY(i)) : 1;
        if (ridgeAlongZ) {
          // Sống mái chạy dọc theo trục Z -> Sọc ngói chạy dọc theo chiều ngang Z, dốc xuống theo X/Y
          const slopeDist = Math.hypot(vx, vy);
          uvs[i * 2] = vz * tileScale;
          uvs[i * 2 + 1] = (ny > 0.15 ? slopeDist : vy) * tileScale;
        } else {
          // Sống mái chạy dọc theo trục X -> Sọc ngói chạy dọc theo X, dốc xuống theo Z/Y
          const slopeDist = Math.hypot(vz, vy);
          uvs[i * 2] = vx * tileScale;
          uvs[i * 2 + 1] = (ny > 0.15 ? slopeDist : vy) * tileScale;
        }
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    };

    // Helper addPart: Lưu đầy đủ map, bumpMap, bumpScale, roughnessMap, roughness, metalness vào userData.originalMaterial
    const addPart = (mesh: THREE.Mesh, tier: number, origColor?: number, isGround = false) => {
      mesh.castShadow = !isGround;
      mesh.receiveShadow = true;
      mesh.userData.elevationTier = tier;
      mesh.userData.origY = mesh.position.y;
      if (origColor !== undefined) {
        mesh.userData.origColor = origColor;
      }
      const m = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
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
        bumpScale: m.bumpScale !== undefined ? m.bumpScale : 1,
        roughnessMap: m.roughnessMap || null,
        roughness: m.roughness !== undefined ? m.roughness : 0.85,
        metalness: m.metalness !== undefined ? m.metalness : 0.05,
      };
      group.add(mesh);
      return mesh;
    };

    // Vật liệu thanh úp nóc đỏ gạch đậm (#8f2d1e) để mái ngói liền mạch, không bị vệt trắng cắt dọc
    const ridgeTileMat = new THREE.MeshStandardMaterial({
      color: 0x8f2d1e,
      bumpMap: roofTextures.bumpMap,
      bumpScale: 0.04,
      roughness: 0.85,
      metalness: 0.05,
    });

    // Vật liệu đen sâu (#111827) cho Cổng Vòm Chính Giữa
    const mainPortalDarkMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.9,
      metalness: 0.05,
    });

    // -------------------------------------------------------------------------
    // 2. HÀM DỰNG ĐẦU HỒI TAM GIÁC CHUẨN (Gable Section — Mũ mái chữ Λ nguyên khối,
    //    KHÔNG BAO GIỜ HỞ KHE TRẮNG TRÊN ĐỈNH, có diềm mái trắng ngà & phào chỉ ngang)
    // -------------------------------------------------------------------------
    const createGableSection = (
      width: number,
      wallHeight: number,
      gableHeight: number,
      depth: number,
      posX: number,
      posY: number,
      posZ: number,
      tier: number = 1,
      rotationY: number = 0
    ) => {
      const halfW = width / 2;

      // 1. Bức tường tam giác đầu hồi (tympanum ngũ giác: thân chữ nhật + tam giác cân trên đỉnh)
      const wallShape = new THREE.Shape();
      wallShape.moveTo(-halfW, 0);
      wallShape.lineTo(halfW, 0);
      wallShape.lineTo(halfW, wallHeight);
      wallShape.lineTo(0, wallHeight + gableHeight);
      wallShape.lineTo(-halfW, wallHeight);
      wallShape.closePath();

      const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: depth, bevelEnabled: false });
      wallGeo.translate(0, 0, -depth / 2);
      if (rotationY !== 0) {
        wallGeo.rotateY(rotationY);
      }
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.position.set(posX, posY, posZ);
      addPart(wallMesh, tier, 0xe8d5b5);

      // 2. Mũ mái ngói đỏ chữ Λ NGUYÊN KHỐI (Chevron ExtrudeGeometry liền mạch tại đỉnh x = 0,
      //    ôm khít đỉnh tường tam giác, tuyệt đối không bị toác khe trắng trên sống mái)
      const overhangX = 0.42;
      const roofThick = 0.28;
      const slopeRatio = gableHeight / halfW;
      const eaveDropY = overhangX * slopeRatio;
      const innerApexY = wallHeight + gableHeight - 0.05; // Ôm trùm xuống đỉnh tường 0.05 để triệt tiêu khe hở
      const eaveBottomY = wallHeight - eaveDropY - 0.05;

      const roofChevronShape = new THREE.Shape();
      roofChevronShape.moveTo(-(halfW + overhangX), eaveBottomY);
      roofChevronShape.lineTo(0, innerApexY);
      roofChevronShape.lineTo(halfW + overhangX, eaveBottomY);
      roofChevronShape.lineTo(halfW + overhangX, eaveBottomY + roofThick);
      roofChevronShape.lineTo(0, innerApexY + roofThick);
      roofChevronShape.lineTo(-(halfW + overhangX), eaveBottomY + roofThick);
      roofChevronShape.closePath();

      const roofDepth = depth + 0.56;
      const roofChevronGeo = new THREE.ExtrudeGeometry(roofChevronShape, {
        depth: roofDepth,
        bevelEnabled: false,
      });
      roofChevronGeo.translate(0, 0, -roofDepth / 2);
      const isSideOriented = Math.abs(Math.abs(rotationY) - Math.PI / 2) < 0.1;
      if (rotationY !== 0) {
        roofChevronGeo.rotateY(rotationY);
      }
      applyRoofTileUVs(roofChevronGeo, !isSideOriented, 0.48);

      const roofChevronMesh = new THREE.Mesh(roofChevronGeo, roofMat);
      roofChevronMesh.position.set(posX, posY, posZ);
      addPart(roofChevronMesh, tier + 1, 0xa83c2b);

      // 3. Diềm mái chữ Λ màu trắng ngà (Fascia / Bargeboard) đóng kín mặt dưới phần mái nhô ra
      const fasciaThick = 0.12;
      const fasciaShape = new THREE.Shape();
      fasciaShape.moveTo(-(halfW + overhangX - 0.04), eaveBottomY - fasciaThick);
      fasciaShape.lineTo(0, innerApexY - fasciaThick);
      fasciaShape.lineTo(halfW + overhangX - 0.04, eaveBottomY - fasciaThick);
      fasciaShape.lineTo(halfW + overhangX - 0.04, eaveBottomY + 0.02);
      fasciaShape.lineTo(0, innerApexY + 0.02);
      fasciaShape.lineTo(-(halfW + overhangX - 0.04), eaveBottomY + 0.02);
      fasciaShape.closePath();

      const fasciaGeo = new THREE.ExtrudeGeometry(fasciaShape, {
        depth: roofDepth - 0.06,
        bevelEnabled: false,
      });
      fasciaGeo.translate(0, 0, -(roofDepth - 0.06) / 2);
      if (rotationY !== 0) {
        fasciaGeo.rotateY(rotationY);
      }
      const fasciaMesh = new THREE.Mesh(fasciaGeo, trimMat);
      fasciaMesh.position.set(posX, posY, posZ);
      addPart(fasciaMesh, tier + 1, 0xf7f2e4);

      // 4. Thanh úp nóc sống mái (Ridge Cap) màu đỏ gạch đậm (#8f2d1e) liền mạch với mái ngói + Phào chỉ ngang đỡ chân đầu hồi
      const ridgeY = posY + innerApexY + roofThick + 0.03;
      const corniceY = posY + wallHeight;

      if (!isSideOriented) {
        // Hướng Nam (+Z) hoặc Bắc (-Z)
        const ridgeCap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, roofDepth + 0.06), ridgeTileMat);
        ridgeCap.position.set(posX, ridgeY, posZ);
        addPart(ridgeCap, tier + 1, 0x8f2d1e);

        // Gờ phào chỉ ngang (Cornice) màu trắng ngà chạy ngang đáy tam giác đầu hồi
        const cornice = new THREE.Mesh(new THREE.BoxGeometry(width + 0.28, 0.18, depth + 0.22), trimMat);
        cornice.position.set(posX, corniceY, posZ);
        addPart(cornice, tier, 0xf7f2e4);
      } else {
        // Hướng Đông (+X) hoặc Tây (-X)
        const ridgeCap = new THREE.Mesh(new THREE.BoxGeometry(roofDepth + 0.06, 0.2, 0.36), ridgeTileMat);
        ridgeCap.position.set(posX, ridgeY, posZ);
        addPart(ridgeCap, tier + 1, 0x8f2d1e);

        const cornice = new THREE.Mesh(new THREE.BoxGeometry(depth + 0.22, 0.18, width + 0.28), trimMat);
        cornice.position.set(posX, corniceY, posZ);
        addPart(cornice, tier, 0xf7f2e4);
      }
    };

    // Hàm tạo mái dốc dài cho nhà lồng (Gable Roof) có chuẩn hóa UV vân ngói
    const createLongGableRoof = (width: number, height: number, depth: number, ridgeAxis: 'x' | 'z' = 'x') => {
      const shape = new THREE.Shape();
      if (ridgeAxis === 'x') {
        shape.moveTo(-depth / 2, 0);
        shape.lineTo(depth / 2, 0);
        shape.lineTo(0, height);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
        geo.center();
        geo.rotateY(Math.PI / 2);
        applyRoofTileUVs(geo, false, 0.45);
        return geo;
      } else {
        shape.moveTo(-width / 2, 0);
        shape.lineTo(width / 2, 0);
        shape.lineTo(0, height);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false });
        geo.center();
        applyRoofTileUVs(geo, true, 0.45);
        return geo;
      }
    };

    // BỆ NỀN ĐÁ XÁM (width = 38.6, depth = 26.8) ôm sát chân móng chợ kèm bậc tam cấp
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(38.6, 0.3, 26.8), plinthMat);
    plinth.position.set(0, 0.15, -0.3);
    addPart(plinth, 0, 0xbec3c9, true);

    const groundY = 0.3; // Độ cao mặt sàn chợ trên bệ nền

    // -------------------------------------------------------------------------
    // 3. CỔNG CHÍNH CỬA NAM, BẢNG TÊN "CHỢ BẾN THÀNH", PHÙ ĐIÊU GỐM & THÁP ĐỒNG HỒ
    // -------------------------------------------------------------------------
    // A. Khối Cổng Nam (x = 0, z = 11.8):
    createGableSection(8.4, 4.5, 2.2, 3.5, 0, groundY, 11.8, 1, 0);

    const southFrontZ = 11.8 + 3.5 / 2; // 13.55

    // 1. CỔNG VÒM CONG LỚN CHÍNH GIỮA (Arched doorway cao 3.8, rộng 2.6, màu đen sâu #111827
    //    thông suốt từ mặt đất lên đỉnh vòm sát dưới bảng chữ "CHỢ BẾN THÀNH", không có tường kem chắn giữa):
    const archHalfW = 1.3;      // Rộng 2.6
    const archSpringH = 2.5;    // Thân đứng 2.5 + bán kính vòm 1.3 = Tổng chiều cao 3.8
    const fullArchShape = new THREE.Shape();
    fullArchShape.moveTo(-archHalfW, 0);
    fullArchShape.lineTo(archHalfW, 0);
    fullArchShape.lineTo(archHalfW, archSpringH);
    fullArchShape.absarc(0, archSpringH, archHalfW, 0, Math.PI, false);
    fullArchShape.lineTo(-archHalfW, 0);
    fullArchShape.closePath();

    const fullArchGeo = new THREE.ExtrudeGeometry(fullArchShape, { depth: 3.62, bevelEnabled: false });
    fullArchGeo.translate(0, 0, -3.62 / 2);
    const mainArchPortal = new THREE.Mesh(fullArchGeo, mainPortalDarkMat);
    // Mặt trước cổng vòm đen sâu nằm tại z = 11.8 + 1.81 = 13.61 (vượt ra ngoài mặt tường kem 13.55)
    mainArchPortal.position.set(0, groundY, 11.8);
    addPart(mainArchPortal, 1, 0x111827);

    // Viền vòm màu trắng ngà (trimMat) nguyên khối bao quanh hai chân cổng và vòm cong (rỗng lòng hoàn toàn)
    const archTrimOuterW = 1.48;
    const fullArchTrimShape = new THREE.Shape();
    fullArchTrimShape.moveTo(-archTrimOuterW, 0);
    fullArchTrimShape.lineTo(archTrimOuterW, 0);
    fullArchTrimShape.lineTo(archTrimOuterW, archSpringH);
    fullArchTrimShape.absarc(0, archSpringH, archTrimOuterW, 0, Math.PI, false);
    fullArchTrimShape.lineTo(-archTrimOuterW, 0);
    fullArchTrimShape.closePath();

    const archInnerHole = new THREE.Path();
    archInnerHole.moveTo(-archHalfW, 0);
    archInnerHole.lineTo(archHalfW, 0);
    archInnerHole.lineTo(archHalfW, archSpringH);
    archInnerHole.absarc(0, archSpringH, archHalfW, 0, Math.PI, false);
    archInnerHole.lineTo(-archHalfW, 0);
    archInnerHole.closePath();
    fullArchTrimShape.holes.push(archInnerHole);

    const archTrimGeo = new THREE.ExtrudeGeometry(fullArchTrimShape, { depth: 0.18, bevelEnabled: false });
    archTrimGeo.translate(0, 0, -0.09);
    const mainArchTrim = new THREE.Mesh(archTrimGeo, trimMat);
    mainArchTrim.position.set(0, groundY, southFrontZ + 0.08);
    addPart(mainArchTrim, 1, 0xf7f2e4);

    // Bốn trụ cột giả (Pilasters) phân nhịp mặt đứng Cổng Nam
    [-3.95, -1.52, 1.52, 3.95].forEach((px) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.26, 4.45, 0.18), trimMat);
      col.position.set(px, groundY + 2.22, southFrontZ + 0.07);
      addPart(col, 1, 0xf7f2e4);
    });

    // 2. Hai cổng chữ nhật phụ hai bên (x = ±2.72, width = 1.62, height = 2.65)
    //    kèm 2 tấm phù điêu gốm nhỏ đặt phía trên 2 cửa chữ nhật phụ hai bên trái/phải:
    [-2.72, 2.72].forEach((sideX) => {
      const sideDoor = new THREE.Mesh(new THREE.BoxGeometry(1.62, 2.65, 0.18), mainPortalDarkMat);
      sideDoor.position.set(sideX, groundY + 1.325, southFrontZ + 0.05);
      addPart(sideDoor, 1, 0x111827);

      const sideFrame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.82, 0.1), trimMat);
      sideFrame.position.set(sideX, groundY + 1.35, southFrontZ + 0.02);
      addPart(sideFrame, 1, 0xf7f2e4);

      // Tấm phù điêu gốm nhỏ nằm ngay phía trên cửa chữ nhật phụ hai bên trái/phải
      const sideReliefFrame = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.68, 0.12), trimMat);
      sideReliefFrame.position.set(sideX, groundY + 3.28, southFrontZ + 0.05);
      addPart(sideReliefFrame, 1, 0xf7f2e4);

      const sideReliefPanel = new THREE.Mesh(
        new THREE.BoxGeometry(1.58, 0.52, 0.14),
        ceramicReliefMat
      );
      sideReliefPanel.position.set(sideX, groundY + 3.28, southFrontZ + 0.08);
      addPart(sideReliefPanel, 1, 0xe5cfa6);
    });

    // 3. BẢNG HIỆU "CHỢ BẾN THÀNH" TRÊN TRÁN TƯỜNG CỔNG NAM (Nằm ngay phía trên đỉnh vòm cong 3.8):
    // Khung đế trắng ngà
    const signBacking = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.88, 0.18), trimMat);
    signBacking.position.set(0, groundY + 4.46, southFrontZ + 0.1);
    addPart(signBacking, 1, 0xf7f2e4);

    // Mặt bảng có chữ "CHỢ BẾN THÀNH" sắc nét
    const signBoardMesh = new THREE.Mesh(
      new THREE.BoxGeometry(4.52, 0.72, 0.08),
      signBoardFaceMat
    );
    signBoardMesh.position.set(0, groundY + 4.46, southFrontZ + 0.2);
    addPart(signBoardMesh, 1, 0xf8f2e4);

    // B. THÁP ĐỒNG HỒ BIỂU TƯỢNG (x = 0, z = 10.2):
    const towerH = 8.5;
    const towerBaseY = 4.5;
    const towerCenterY = towerBaseY + towerH / 2; // y = 8.75 (vươn cao đến y = 13.0)
    const towerZ = 10.2;

    // Bệ đỡ chân tháp đồng hồ (Podium Moldings) có gờ giật cấp trang trọng
    const towerPedestal = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.45, 3.85), trimMat);
    towerPedestal.position.set(0, 6.9, towerZ);
    addPart(towerPedestal, 2, 0xf7f2e4);

    // Thân tháp vuông vắn (3.4 x 8.5 x 3.4) sơn vàng kem có vân vữa
    const towerShaft = new THREE.Mesh(new THREE.BoxGeometry(3.4, towerH, 3.4), wallMat);
    towerShaft.position.set(0, towerCenterY, towerZ);
    addPart(towerShaft, 2, 0xe8d5b5);

    // Gờ phào ngang chia tầng thân tháp (dưới và trên mặt đồng hồ)
    [8.35, 11.35].forEach((bandY) => {
      const band = new THREE.Mesh(new THREE.BoxGeometry(3.68, 0.18, 3.68), trimMat);
      band.position.set(0, bandY, towerZ);
      addPart(band, 2, 0xf7f2e4);
    });

    // Bốn góc tháp có cột giả (pilasters) màu trắng ngà trimMat
    [-1, 1].forEach((tx) => {
      [-1, 1].forEach((tz) => {
        const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.28, towerH, 0.28), trimMat);
        pilaster.position.set(tx * (3.4 / 2 - 0.06), towerCenterY, towerZ + tz * (3.4 / 2 - 0.06));
        addPart(pilaster, 2, 0xf7f2e4);
      });
    });

    // 4 MẶT ĐỒNG HỒ CHI TIẾT THẬT (tại y = 9.85 trên cả 4 mặt Nam-Bắc-Đông-Tây):
    // Dùng CircleGeometry dán trực tiếp CanvasTexture đồng hồ để cọc số La Mã XII, III, VI, IX luôn đứng thẳng chiều trên cả 4 hướng!
    const clockY = 9.85;
    const clockRadius = 0.92;

    const createDetailedClock = (dir: 'south' | 'north' | 'east' | 'west') => {
      const clockGroupPos = new THREE.Vector3(0, clockY, towerZ);
      let rotY = 0;
      const offset = 3.4 / 2 + 0.06;

      if (dir === 'south') {
        clockGroupPos.z += offset;
        rotY = 0;
      } else if (dir === 'north') {
        clockGroupPos.z -= offset;
        rotY = Math.PI;
      } else if (dir === 'east') {
        clockGroupPos.x += offset;
        rotY = Math.PI / 2;
      } else {
        clockGroupPos.x -= offset;
        rotY = -Math.PI / 2;
      }

      // 1. Vành khung đồng hồ nổi 3D màu trắng ngà + viền xanh cổ vịt (#2c6b64)
      const outerMolding = new THREE.Mesh(
        new THREE.CylinderGeometry(clockRadius + 0.15, clockRadius + 0.15, 0.1, 36),
        trimMat
      );
      if (dir === 'south' || dir === 'north') {
        outerMolding.rotation.x = Math.PI / 2;
      } else {
        outerMolding.rotation.z = Math.PI / 2;
      }
      outerMolding.position.copy(clockGroupPos);
      addPart(outerMolding, 3, 0xf7f2e4);

      const tealBezel = new THREE.Mesh(
        new THREE.CylinderGeometry(clockRadius + 0.06, clockRadius + 0.06, 0.14, 36),
        clockRimMat
      );
      if (dir === 'south' || dir === 'north') {
        tealBezel.rotation.x = Math.PI / 2;
      } else {
        tealBezel.rotation.z = Math.PI / 2;
      }
      tealBezel.position.copy(clockGroupPos);
      addPart(tealBezel, 3, 0x2c6b64);

      // 2. Mặt số đồng hồ tròn (CircleGeometry) mang đầy đủ 12 số giờ, 60 vạch phút & kim 10h10
      const dialDisc = new THREE.Mesh(new THREE.CircleGeometry(clockRadius, 36), clockFaceMat);
      dialDisc.rotation.y = rotY;
      const normalVec = new THREE.Vector3(
        dir === 'east' ? 1 : dir === 'west' ? -1 : 0,
        0,
        dir === 'south' ? 1 : dir === 'north' ? -1 : 0
      );
      dialDisc.position.copy(clockGroupPos).addScaledVector(normalVec, 0.08);
      addPart(dialDisc, 3, 0xfdfbf7);

      // 3. Chốt tâm & 2 kim đồng hồ 3D nổi bên ngoài mặt số (chỉ 10h10)
      const pinMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), clockHandMat);
      pinMesh.position.copy(clockGroupPos).addScaledVector(normalVec, 0.1);
      addPart(pinMesh, 3, 0x111514);
    };

    createDetailedClock('south');
    createDetailedClock('north');
    createDetailedClock('east');
    createDetailedClock('west');

    // ĐỈNH THÁP ĐỒNG HỒ (Cổ diêm 3 ô thoáng đặc trưng + Mái ngói đỏ 4 mặt dốc + Chóp thu lôi):
    const collarH = 0.75;
    const towerCollar = new THREE.Mesh(new THREE.BoxGeometry(3.62, collarH, 3.62), trimMat);
    towerCollar.position.set(0, 12.45 + collarH / 2, towerZ);
    addPart(towerCollar, 3, 0xf7f2e4);

    // 3 ô cửa thoáng tối màu trên mỗi mặt cổ diêm tháp đồng hồ
    [-1, 1].forEach((dir) => {
      [-0.85, 0, 0.85].forEach((off) => {
        const ventZ = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.38, 0.08), darkMat);
        ventZ.position.set(off, 12.82, towerZ + dir * 1.82);
        addPart(ventZ, 3, 0x18221f);

        const ventX = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.58), darkMat);
        ventX.position.set(dir * 1.82, 12.82, towerZ + off);
        addPart(ventX, 3, 0x18221f);
      });
    });

    // Diềm mái trắng ngà đỡ chân mái ngói đỉnh tháp
    const towerRoofEave = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 4.2), trimMat);
    towerRoofEave.position.set(0, 13.26, towerZ);
    addPart(towerRoofEave, 3, 0xf7f2e4);

    // Mái ngói đỏ 4 mặt dốc thoải trên đỉnh tháp
    const towerRoofGeo = new THREE.ConeGeometry(3.05, 1.45, 4);
    applyRoofTileUVs(towerRoofGeo, false, 0.55);
    const towerRoof = new THREE.Mesh(towerRoofGeo, roofMat);
    towerRoof.rotation.y = Math.PI / 4;
    towerRoof.position.set(0, 14.02, towerZ);
    addPart(towerRoof, 3, 0xa83c2b);

    // Chóp kim loại vàng đồng trên đỉnh tháp
    const spireMast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.65, 16), goldFinialMat);
    spireMast.position.set(0, 14.9, towerZ);
    addPart(spireMast, 3, 0xd97706);

    const spireBall = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), goldFinialMat);
    spireBall.position.set(0, 15.25, towerZ);
    addPart(spireBall, 3, 0xd97706);

    // -------------------------------------------------------------------------
    // 4. SÁU NẾP MÁI TAM GIÁC NHỎ & CỬA SỔ BÁN NGUYỆT CÓ LAM GIÓ MẶT TIỀN
    // -------------------------------------------------------------------------
    const dormerCoords = [-15.6, -11.2, -6.8, 6.8, 11.2, 15.6];

    const semiWinShape = new THREE.Shape();
    const winR = 0.78;
    semiWinShape.moveTo(-winR, 0);
    semiWinShape.lineTo(winR, 0);
    semiWinShape.absarc(0, 0, winR, 0, Math.PI, false);
    semiWinShape.closePath();

    const semiWinGeo = new THREE.ExtrudeGeometry(semiWinShape, { depth: 0.12, bevelEnabled: false });
    semiWinGeo.translate(0, 0, -0.06);

    const semiTrimShape = new THREE.Shape();
    const trimR = 0.92;
    semiTrimShape.moveTo(-trimR, -0.09);
    semiTrimShape.lineTo(trimR, -0.09);
    semiTrimShape.lineTo(trimR, 0);
    semiTrimShape.absarc(0, 0, trimR, 0, Math.PI, false);
    semiTrimShape.lineTo(-trimR, 0);
    semiTrimShape.closePath();

    const holePath = new THREE.Path();
    holePath.moveTo(-winR, 0);
    holePath.lineTo(winR, 0);
    holePath.absarc(0, 0, winR, 0, Math.PI, false);
    holePath.closePath();
    semiTrimShape.holes.push(holePath);

    const semiTrimGeo = new THREE.ExtrudeGeometry(semiTrimShape, { depth: 0.15, bevelEnabled: false });
    semiTrimGeo.translate(0, 0, -0.075);

    dormerCoords.forEach((dx) => {
      // Mỗi nếp dùng createGableSection đã sửa lỗi hở đỉnh chữ Λ
      createGableSection(3.8, 1.25, 1.35, 3.5, dx, 3.5, 9.2, 1, 0);

      const dormerWinFrontZ = 10.98;
      const winBaseY = 3.5 + 0.58;
      const dormerWin = new THREE.Mesh(semiWinGeo, darkMat);
      dormerWin.position.set(dx, winBaseY, dormerWinFrontZ);
      addPart(dormerWin, 1, 0x18221f);

      const dormerTrim = new THREE.Mesh(semiTrimGeo, trimMat);
      dormerTrim.position.set(dx, winBaseY, dormerWinFrontZ + 0.02);
      addPart(dormerTrim, 1, 0xf7f2e4);

      // Thêm các thanh đố & lam thông gió trong ô cửa sổ bán nguyệt
      [0.2, 0.4, 0.6].forEach((ly) => {
        const chordHalfW = Math.sqrt(Math.max(0.05, winR * winR - ly * ly));
        const louverBar = new THREE.Mesh(new THREE.BoxGeometry(chordHalfW * 1.92, 0.045, 0.08), trimMat);
        louverBar.position.set(dx, winBaseY + ly, dormerWinFrontZ + 0.03);
        addPart(louverBar, 1, 0xf7f2e4);
      });
    });

    // -------------------------------------------------------------------------
    // 5. HOÀN THIỆN HÀNH LANG VÒM 4 MẶT & CỔNG BẮC, ĐÔNG, TÂY
    // -------------------------------------------------------------------------
    // A. HÀNH LANG TẦNG TRỆT MẶT TIỀN (Phía Nam z = 9.75):
    const frontHallWall = new THREE.Mesh(new THREE.BoxGeometry(35.4, 3.1, 3.5), wallMat);
    frontHallWall.position.set(0, groundY + 1.55, 9.75);
    addPart(frontHallWall, 1, 0xe8d5b5);

    // Mái hiên đua rộng màu trắng ngà trimMat tại y = 3.42
    const frontEave = new THREE.Mesh(new THREE.BoxGeometry(36.8, 0.32, 4.4), trimMat);
    frontEave.position.set(0, 3.42, 9.9);
    addPart(frontEave, 1, 0xf7f2e4);

    // Dãy cửa vòm Arcade mặt trước (6 bên trái & 6 bên phải) có viền vòm trắng ngà
    const arcadeZ = 11.52;
    const archArchXs = [
      -5.8, -7.9, -10.0, -12.1, -14.2, -16.3, // Trái
      5.8, 7.9, 10.0, 12.1, 14.2, 16.3,       // Phải
    ];
    archArchXs.forEach((ax) => {
      const aBox = new THREE.Mesh(new THREE.BoxGeometry(1.32, 1.45, 0.16), darkMat);
      aBox.position.set(ax, groundY + 0.725, arcadeZ);
      addPart(aBox, 1, 0x18221f);

      const aCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.16, 24), darkMat);
      aCyl.rotation.x = Math.PI / 2;
      aCyl.position.set(ax, groundY + 1.45, arcadeZ);
      addPart(aCyl, 1, 0x18221f);

      // Thanh đố ngang chia phần trán vòm cửa sổ/cửa cuốn
      const transomBar = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.07, 0.2), trimMat);
      transomBar.position.set(ax, groundY + 1.45, arcadeZ + 0.02);
      addPart(transomBar, 1, 0xf7f2e4);
    });

    // Trụ cột giả màu trắng ngà xen kẽ giữa các cửa vòm
    const pillarXs = [
      -4.75, -6.85, -8.95, -11.05, -13.15, -15.25, -17.25,
      4.75, 6.85, 8.95, 11.05, 13.15, 15.25, 17.25,
    ];
    pillarXs.forEach((px) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.95, 0.24), trimMat);
      col.position.set(px, groundY + 1.475, arcadeZ + 0.02);
      addPart(col, 1, 0xf7f2e4);
    });

    // B. MẶT SAU (CỬA BẮC — ĐƯỜNG LÊ THÁNH TÔN TẠI z = -11.8):
    const backHallWall = new THREE.Mesh(new THREE.BoxGeometry(35.4, 3.1, 3.5), wallMat);
    backHallWall.position.set(0, groundY + 1.55, -11.8);
    addPart(backHallWall, 1, 0xe8d5b5);

    const backEave = new THREE.Mesh(new THREE.BoxGeometry(36.8, 0.32, 4.4), trimMat);
    backEave.position.set(0, 3.42, -11.95);
    addPart(backEave, 1, 0xf7f2e4);

    // Cổng Bắc (x = 0, z = -12.4 nhô ra phía sau): Dùng createGableSection xoay 180 độ
    createGableSection(8.0, 4.2, 2.0, 3.2, 0, groundY, -12.4, 1, Math.PI);

    const northFrontZ = -12.4 - 3.2 / 2 - 0.05;
    const northArchBox = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 0.16), darkMat);
    northArchBox.position.set(0, groundY + 1.1, northFrontZ);
    addPart(northArchBox, 1, 0x18221f);

    const northArchCyl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.16, 24), darkMat);
    northArchCyl.rotation.x = Math.PI / 2;
    northArchCyl.position.set(0, groundY + 2.2, northFrontZ);
    addPart(northArchCyl, 1, 0x18221f);

    // Phù điêu gốm trên Cổng Bắc
    const northRelief = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.62, 0.12),
      ceramicReliefMat
    );
    northRelief.position.set(0, groundY + 3.65, northFrontZ - 0.02);
    addPart(northRelief, 1, 0xe5cfa6);

    // Dãy ô cửa sổ vòm dọc hành lang sau
    [-15.0, -12.0, -9.0, -6.0, 6.0, 9.0, 12.0, 15.0].forEach((bx) => {
      const bArch = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.65, 0.12), darkMat);
      bArch.position.set(bx, groundY + 1.1, -13.56);
      addPart(bArch, 1, 0x18221f);
    });

    // C. HAI BÊN HÔNG (CỬA ĐÔNG — PHAN BỘI CHÂU & CỬA TÂY — PHAN CHU TRINH TẠI x = ±18, z = -1.0):
    [-1, 1].forEach((dir) => {
      const flankX = dir * 17.5;

      const flankWall = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.1, 20.4), wallMat);
      flankWall.position.set(flankX, groundY + 1.55, -1.0);
      addPart(flankWall, 1, 0xe8d5b5);

      const flankEave = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.32, 21.4), trimMat);
      flankEave.position.set(flankX + dir * 0.2, 3.42, -1.0);
      addPart(flankEave, 1, 0xf7f2e4);

      // Khối cổng hông nhô ra có đầu hồi tam giác chữ Λ liền khối (createGableSection xoay 90 độ)
      const gatePosX = dir * 18.2;
      createGableSection(6.4, 3.8, 1.85, 3.2, gatePosX, groundY, -1.0, 1, Math.PI / 2);

      // Cổng vòm bên hông
      const sidePortal = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 2.1), darkMat);
      sidePortal.position.set(gatePosX + dir * 1.62, groundY + 1.3, -1.0);
      addPart(sidePortal, 1, 0x18221f);

      const sideTrim = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.8, 2.3), trimMat);
      sideTrim.position.set(gatePosX + dir * 1.63, groundY + 1.3, -1.0);
      addPart(sideTrim, 1, 0xf7f2e4);

      // Phù điêu gốm Cửa Đông & Cửa Tây
      const sideRelief = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 2.0), ceramicReliefMat);
      sideRelief.position.set(gatePosX + dir * 1.64, groundY + 3.25, -1.0);
      addPart(sideRelief, 1, 0xe5cfa6);

      // Dãy cửa vòm dọc theo vách hông
      [-8.5, -5.5, 3.5, 6.5].forEach((fz) => {
        const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 1.32), darkMat);
        sideWin.position.set(flankX + dir * 1.52, groundY + 1.2, -1.0 + fz);
        addPart(sideWin, 1, 0x18221f);
      });
    });

    // D. KHỐI NHÀ LỒNG TRUNG TÂM & HỆ MÁI NGÓI ĐỎ CHỮ Λ PHÍA TRONG:
    const hallW = 34.4;
    const hallD = 20.2;
    const hallZ = -1.0;

    // Thân nhà lồng chính
    const hallBody = new THREE.Mesh(new THREE.BoxGeometry(hallW, 4.2, hallD), wallMat);
    hallBody.position.set(0, groundY + 2.1, hallZ);
    addPart(hallBody, 1, 0xe8d5b5);

    // Mái dốc chính tầng 1: Lợp ngói đỏ gạch trầm có sọc sóng ngói rõ nét
    const mainRoofH = 2.65;
    const mainRoofGeo = createLongGableRoof(hallW + 0.9, mainRoofH, hallD + 0.9, 'x');
    const mainRoof = new THREE.Mesh(mainRoofGeo, roofMat);
    mainRoof.position.set(0, groundY + 4.2 + mainRoofH / 2, hallZ);
    addPart(mainRoof, 2, 0xa83c2b);

    // Sống mái chính màu trắng ngà
    const mainRidgeCap = new THREE.Mesh(new THREE.BoxGeometry(hallW + 1.0, 0.22, 0.34), trimMat);
    mainRidgeCap.position.set(0, groundY + 4.2 + mainRoofH, hallZ);
    addPart(mainRidgeCap, 2, 0xf7f2e4);

    // Hai tầng mái thông gió (Clerestory) nổi hai bên trái/phải x = ±9.5
    [-9.5, 9.5].forEach((cx) => {
      const clereW = 12.8;
      const clereD = 14.0;
      const clereH = 1.05;
      const clereY = groundY + 4.2 + mainRoofH * 0.54;

      // Cổ diêm nâng cao
      const clereBody = new THREE.Mesh(new THREE.BoxGeometry(clereW, clereH, clereD), wallMat);
      clereBody.position.set(cx, clereY + clereH / 2, hallZ);
      addPart(clereBody, 2, 0xe8d5b5);

      // Lam thông gió tối màu kèm nan chớp trắng ngà trên cổ diêm
      [-1, 1].forEach((dir) => {
        const louver = new THREE.Mesh(new THREE.BoxGeometry(clereW - 0.6, 0.48, 0.1), darkMat);
        louver.position.set(cx, clereY + clereH / 2, hallZ + dir * (clereD / 2 + 0.05));
        addPart(louver, 2, 0x18221f);
      });

      // Mái ngói đỏ thượng trên mỗi khối clerestory
      const clereRoofH = 1.55;
      const clereRoofGeo = createLongGableRoof(clereW + 0.5, clereRoofH, clereD + 0.5, 'x');
      const clereRoof = new THREE.Mesh(clereRoofGeo, roofMat);
      clereRoof.position.set(cx, clereY + clereH + clereRoofH / 2, hallZ);
      addPart(clereRoof, 2, 0xa83c2b);

      // Sống mái màu trắng ngà dày dặn
      const cap = new THREE.Mesh(new THREE.BoxGeometry(clereW + 0.55, 0.2, 0.3), trimMat);
      cap.position.set(cx, clereY + clereH + clereRoofH, hallZ);
      addPart(cap, 2, 0xf7f2e4);
    });

    return null;

  } else if (siteId === 'HCM-DT-009') {
    // =========================================================================
    // KHU DI TÍCH LỊCH SỬ ĐỊA ĐẠO CỦ CHI (HUYỆN CỦ CHI)
    // SA BÀN MẶT CẮT ĐỊA TẦNG 3 TẦNG HẦM (3D CUTAWAY UNDERGROUND DIORAMA)
    // Kích thước khối địa chất: width = 26 (x: -13..+13), height = 16 (y: -6..+10), depth = 26 (z: -13..+13)
    // =========================================================================

    // -------------------------------------------------------------------------
    // 1. HỆ THỐNG CHẤT LIỆU PBR ĐẤT ĐÁ ONG & RỪNG CỦ CHI (CanvasTexture)
    // -------------------------------------------------------------------------
    const createCuChiLateriteTextures = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = 512;
      bumpCanvas.height = 512;
      const bCtx = bumpCanvas.getContext('2d');

      if (ctx && bCtx) {
        // Gradient phân tầng địa chất từ trên xuống dưới:
        // Lớp đất mặt nâu sẫm (#5c3a21) -> Đất sét đỏ cam đất nung (#b85228, #9e3d1a) -> Đá ong sẫm ở đáy (#6e2811)
        const grad = ctx.createLinearGradient(0, 0, 0, 512);
        grad.addColorStop(0.0, '#5c3a21');
        grad.addColorStop(0.11, '#7a4322');
        grad.addColorStop(0.24, '#b85228');
        grad.addColorStop(0.52, '#9e3d1a');
        grad.addColorStop(0.76, '#873215');
        grad.addColorStop(1.0, '#6e2811');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, 512, 512);

        // Các dải vân trầm tích địa chất uốn lượn tự nhiên
        let seed = 9001;
        const rand = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };

        for (let band = 0; band < 28; band++) {
          const baseY = (band / 28) * 512;
          ctx.beginPath();
          ctx.moveTo(0, baseY);
          for (let x = 0; x <= 512; x += 32) {
            const waveY = baseY + Math.sin(x * 0.025 + band * 1.3) * 6 + (rand() - 0.5) * 4;
            ctx.lineTo(x, waveY);
          }
          ctx.lineWidth = 3 + rand() * 5;
          ctx.strokeStyle =
            band < 4
              ? 'rgba(58, 34, 16, 0.35)'
              : band < 19
              ? band % 2 === 0
                ? 'rgba(204, 96, 46, 0.25)'
                : 'rgba(118, 38, 14, 0.25)'
              : 'rgba(68, 22, 8, 0.38)';
          ctx.stroke();
        }

        // Hạt kết von đá ong (laterite nodules), sỏi cuội và độ nhám đất sét tự nhiên
        for (let i = 0; i < 9500; i++) {
          const x = rand() * 512;
          const y = rand() * 512;
          const r = 1 + rand() * 3.2;
          const isDark = rand() > 0.46;
          ctx.fillStyle = isDark ? 'rgba(45, 16, 6, 0.22)' : 'rgba(224, 118, 64, 0.18)';
          ctx.fillRect(x, y, r, r);

          bCtx.fillStyle = isDark ? '#424242' : '#bcbcbc';
          bCtx.fillRect(x, y, r + 0.6, r + 0.6);
        }

        // Các lỗ rỗ tổ ong đặc trưng ở tầng đá ong đáy (y > 350)
        for (let p = 0; p < 420; p++) {
          const px = rand() * 512;
          const py = 340 + rand() * 170;
          const pr = 2 + rand() * 4.5;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(42, 14, 5, 0.36)';
          ctx.fill();

          bCtx.beginPath();
          bCtx.arc(px, py, pr, 0, Math.PI * 2);
          bCtx.fillStyle = '#262626';
          bCtx.fill();
        }
      }

      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.ClampToEdgeWrapping;

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.ClampToEdgeWrapping;

      return { map, bumpMap };
    };

    const createCuChiForestGrassTextures = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = 512;
      bumpCanvas.height = 512;
      const bCtx = bumpCanvas.getContext('2d');

      if (ctx && bCtx) {
        ctx.fillStyle = '#4a6b2c';
        ctx.fillRect(0, 0, 512, 512);

        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, 512, 512);

        let seed = 4271;
        const rand = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };

        // Các mảng rêu xanh sáng (#687d31) và vệt đất rừng vàng cam (#c28438)
        for (let p = 0; p < 160; p++) {
          const px = rand() * 512;
          const py = rand() * 512;
          const rx = 14 + rand() * 42;
          const ry = 10 + rand() * 32;
          ctx.beginPath();
          ctx.ellipse(px, py, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
          ctx.fillStyle =
            p % 3 === 0
              ? 'rgba(194, 132, 56, 0.34)'
              : p % 2 === 0
              ? 'rgba(104, 125, 49, 0.42)'
              : 'rgba(54, 82, 30, 0.38)';
          ctx.fill();
        }

        // Chi tiết lá khô, cỏ rừng và hạt đất
        for (let i = 0; i < 8000; i++) {
          const x = rand() * 512;
          const y = rand() * 512;
          const w = 1 + rand() * 3.5;
          const h = 1 + rand() * 2.5;
          const cChoice = i % 4;
          ctx.fillStyle =
            cChoice === 0
              ? '#687d31'
              : cChoice === 1
              ? '#3d5922'
              : cChoice === 2
              ? '#c28438'
              : '#7d5627';
          ctx.fillRect(x, y, w, h);

          bCtx.fillStyle = i % 2 === 0 ? '#555555' : '#adadad';
          bCtx.fillRect(x, y, w, h);
        }
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

      return { map, bumpMap };
    };

    const createCuChiWoodThatchTextures = () => {
      const woodCanvas = document.createElement('canvas');
      woodCanvas.width = 256;
      woodCanvas.height = 256;
      const wCtx = woodCanvas.getContext('2d');

      const thatchCanvas = document.createElement('canvas');
      thatchCanvas.width = 256;
      thatchCanvas.height = 256;
      const tCtx = thatchCanvas.getContext('2d');

      if (wCtx && tCtx) {
        wCtx.fillStyle = '#6b4423';
        wCtx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 400; i++) {
          wCtx.fillStyle = i % 2 === 0 ? 'rgba(42, 24, 10, 0.28)' : 'rgba(138, 92, 50, 0.22)';
          wCtx.fillRect((i * 19) % 256, 0, 2 + (i % 3), 256);
        }

        tCtx.fillStyle = '#8c6d3b';
        tCtx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 1800; i++) {
          const tx = (i * 73) % 256;
          const ty = (i * 41) % 256;
          tCtx.fillStyle =
            i % 3 === 0 ? '#6e5227' : i % 3 === 1 ? '#a3824a' : '#574924';
          tCtx.fillRect(tx, ty, 3, 14);
        }
      }

      const woodMap = new THREE.CanvasTexture(woodCanvas);
      woodMap.colorSpace = THREE.SRGBColorSpace;
      woodMap.wrapS = THREE.RepeatWrapping;
      woodMap.wrapT = THREE.RepeatWrapping;

      const thatchMap = new THREE.CanvasTexture(thatchCanvas);
      thatchMap.colorSpace = THREE.SRGBColorSpace;
      thatchMap.wrapS = THREE.RepeatWrapping;
      thatchMap.wrapT = THREE.RepeatWrapping;

      return { woodMap, thatchMap };
    };

    // Bản đồ tác chiến treo trong Hầm Chỉ Huy Tầng 1
    const createTacticalMapTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#efe3c8';
        ctx.fillRect(0, 0, 256, 160);
        ctx.strokeStyle = '#5c3a21';
        ctx.lineWidth = 6;
        ctx.strokeRect(4, 4, 248, 152);
        // Sông Sài Gòn xanh lam uốn lượn
        ctx.beginPath();
        ctx.moveTo(20, 20);
        ctx.bezierCurveTo(90, 50, 140, 110, 235, 140);
        ctx.strokeStyle = '#1e5c70';
        ctx.lineWidth = 10;
        ctx.stroke();
        // Mũi tên chiến dịch màu đỏ & mạng lưới địa đạo
        ctx.strokeStyle = '#b91c1c';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(45, 120);
        ctx.lineTo(125, 75);
        ctx.lineTo(195, 55);
        ctx.stroke();
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        ctx.arc(125, 75, 6, 0, Math.PI * 2);
        ctx.arc(195, 55, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    if (!landmarkTextureCache.has('cuChiLaterite')) {
      const t = createCuChiLateriteTextures();
      t.map.userData = { isCached: true };
      t.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('cuChiLaterite', t);
    }
    if (!landmarkTextureCache.has('cuChiForest')) {
      const t = createCuChiForestGrassTextures();
      t.map.userData = { isCached: true };
      t.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('cuChiForest', t);
    }
    if (!landmarkTextureCache.has('cuChiWoodThatch')) {
      const t = createCuChiWoodThatchTextures();
      t.woodMap.userData = { isCached: true };
      t.thatchMap.userData = { isCached: true };
      landmarkTextureCache.set('cuChiWoodThatch', t);
    }
    if (!landmarkTextureCache.has('cuChiMapTex')) {
      const t = createTacticalMapTexture();
      t.userData = { isCached: true };
      landmarkTextureCache.set('cuChiMapTex', t);
    }

    const lateriteTex = landmarkTextureCache.get('cuChiLaterite');
    const forestTex = landmarkTextureCache.get('cuChiForest');
    const woodThatchTex = landmarkTextureCache.get('cuChiWoodThatch');
    const tacticalMapTex = landmarkTextureCache.get('cuChiMapTex');

    // Vật liệu cho từng tầng địa chất ngang (Topsoil #5c3a21, Mid Clay #b85228 / #9e3d1a, Bottom Bedrock #6e2811)
    const topsoilLayerMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a21,
      bumpMap: lateriteTex.bumpMap,
      bumpScale: 0.05,
      roughness: 0.95,
      metalness: 0.01,
    });

    const clayUpperMat = new THREE.MeshStandardMaterial({
      color: 0xb85228,
      map: lateriteTex.map,
      bumpMap: lateriteTex.bumpMap,
      bumpScale: 0.06,
      roughness: 0.95,
      metalness: 0.02,
    });

    const clayMidMat = new THREE.MeshStandardMaterial({
      color: 0x9e3d1a,
      map: lateriteTex.map,
      bumpMap: lateriteTex.bumpMap,
      bumpScale: 0.06,
      roughness: 0.95,
      metalness: 0.02,
    });

    const lateriteDeepMat = new THREE.MeshStandardMaterial({
      color: 0x6e2811,
      map: lateriteTex.map,
      bumpMap: lateriteTex.bumpMap,
      bumpScale: 0.07,
      roughness: 0.96,
      metalness: 0.03,
    });

    // 2) tunnelInteriorMat: Lòng hầm & Vách hầm khoét lõm (#2b1810, roughness: 0.98)
    const tunnelInteriorMat = new THREE.MeshStandardMaterial({
      color: 0x2b1810,
      bumpMap: lateriteTex.bumpMap,
      bumpScale: 0.05,
      roughness: 0.98,
      metalness: 0.01,
    });

    // 3) forestGrassMat: Bề mặt đất rừng & Thảm cỏ (#4a6b2c, #687d31, #c28438, roughness: 0.9)
    const forestGrassMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: forestTex.map,
      bumpMap: forestTex.bumpMap,
      bumpScale: 0.045,
      roughness: 0.9,
      metalness: 0.0,
    });

    // Đất vàng sẫm cho lối mòn & hố bom (#b5732a)
    const craterSoilMat = new THREE.MeshStandardMaterial({
      color: 0xb5732a,
      bumpMap: forestTex.bumpMap,
      bumpScale: 0.055,
      roughness: 0.94,
      metalness: 0.01,
    });

    // 4) woodThatchMat: Gỗ chống hầm, bàn ghế (#6b4423) & mái tranh lá khô (#8c6d3b)
    const woodThatchMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: woodThatchTex.woodMap,
      bumpMap: lateriteTex.bumpMap,
      bumpScale: 0.025,
      roughness: 0.88,
      metalness: 0.02,
    });

    const thatchRoofMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: woodThatchTex.thatchMap,
      bumpMap: forestTex.bumpMap,
      bumpScale: 0.04,
      roughness: 0.92,
      metalness: 0.0,
    });

    // Vật liệu phụ trợ: Lá cây rừng (#2e5921, #437329), Tre trúc (#3d6b2c), Nước ngầm (#1e5c70), Đèn hầm ấm (#ff9933)
    const canopyDarkMat = new THREE.MeshStandardMaterial({
      color: 0x2e5921,
      roughness: 0.88,
      metalness: 0.0,
      flatShading: true,
    });
    const canopyBrightMat = new THREE.MeshStandardMaterial({
      color: 0x437329,
      roughness: 0.86,
      metalness: 0.0,
      flatShading: true,
    });
    const treeTrunkMat = new THREE.MeshStandardMaterial({
      color: 0x4a2f1b,
      roughness: 0.94,
      metalness: 0.0,
      flatShading: true,
    });
    const bambooCulmMat = new THREE.MeshStandardMaterial({
      color: 0x4f7a32,
      roughness: 0.72,
      metalness: 0.04,
    });
    const wellWaterMat = new THREE.MeshStandardMaterial({
      color: 0x1e5c70,
      roughness: 0.14,
      metalness: 0.35,
      emissive: new THREE.Color(0x0a2e3a),
      emissiveIntensity: 0.35,
    });
    const lampBulbMat = new THREE.MeshStandardMaterial({
      color: 0xffcc66,
      emissive: new THREE.Color(0xff9933),
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    const stoveFireMat = new THREE.MeshStandardMaterial({
      color: 0xff6611,
      emissive: new THREE.Color(0xff4400),
      emissiveIntensity: 2.0,
      roughness: 0.4,
    });
    const ordnanceMetalMat = new THREE.MeshStandardMaterial({
      color: 0x3b4734,
      roughness: 0.52,
      metalness: 0.62,
    });
    const medicalClothMat = new THREE.MeshStandardMaterial({
      color: 0xf1ece1,
      roughness: 0.82,
      metalness: 0.0,
    });
    const redCrossMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.65,
      metalness: 0.02,
    });
    const mapBoardMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tacticalMapTex,
      roughness: 0.7,
      metalness: 0.02,
    });
    const vnFlagTex = createVietnamFlagTexture();
    const bannerFlagMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: vnFlagTex,
      roughness: 0.65,
    });

    // Helper gắn đầy đủ mesh.userData.originalMaterial cho mọi Mesh trong sa bàn Địa đạo Củ Chi
    const addCuChiMesh = (
      mesh: THREE.Mesh,
      tier: number,
      isGroundPart = false
    ) => {
      mesh.castShadow = !isGroundPart;
      mesh.receiveShadow = true;
      mesh.userData.elevationTier = tier;
      mesh.userData.origY = mesh.position.y;
      const m = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
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
        bumpScale: m.bumpScale !== undefined ? m.bumpScale : 0.05,
        roughnessMap: m.roughnessMap || null,
        roughness: m.roughness !== undefined ? m.roughness : 0.9,
        metalness: m.metalness !== undefined ? m.metalness : 0.02,
      };
      group.add(mesh);
      return mesh;
    };

    const addCuChiBox = (
      w: number,
      h: number,
      d: number,
      mat: THREE.MeshStandardMaterial,
      x: number,
      y: number,
      z: number,
      tier: number
    ) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      return addCuChiMesh(m, tier);
    };

    // Helper đặt đèn vàng ấm PointLight(0xff9933, 1.8, 7) kèm bóng đèn dầu/đèn hầm bên trong các khoang hầm
    const addWarmBunkerLight = (
      x: number,
      y: number,
      z: number,
      tier: number,
      intensity = 1.8,
      distance = 7.5
    ) => {
      const pLight = new THREE.PointLight(0xff9933, intensity, distance);
      pLight.position.set(x, y, z);
      pLight.userData.elevationTier = tier;
      pLight.userData.origY = y;
      group.add(pLight);

      // Dây treo & chụp đèn dầu/đèn điện nhỏ trên trần hầm
      addCuChiBox(0.04, 0.26, 0.04, woodThatchMat, x, y + 0.2, z, tier);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.12, 10), ordnanceMetalMat);
      shade.position.set(x, y + 0.08, z);
      addCuChiMesh(shade, tier);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), lampBulbMat);
      bulb.position.set(x, y, z);
      addCuChiMesh(bulb, tier);
    };

    // Helper dựng Hốc Khoang Hầm 3D Thụt Sâu Vào Trong Khối Đất (depth = 3.8 đến 4.5 đơn vị)
    // có vách đất tối #2b1810, trần vòm đất và khung cột gỗ chống hầm #6b4423
    const buildRecessedBunkerChamber = (
      cx: number,
      bottomY: number,
      cz: number,
      width: number,
      height: number,
      depth: number,
      face: 'front' | 'right',
      tier: number,
      withTimberFrames = true
    ) => {
      const wallThick = 0.16;
      if (face === 'front') {
        // Mặt cắt phía trước (+Z = +13): Khoang hầm thụt sâu từ z = cz + depth/2 (13.0) vào tới z = cz - depth/2
        const backZ = cz - depth / 2 + wallThick / 2;
        const leftX = cx - width / 2 + wallThick / 2;
        const rightX = cx + width / 2 - wallThick / 2;

        // Vách hậu, sàn hầm, trần hầm và 2 vách bên bằng tunnelInteriorMat (#2b1810)
        addCuChiBox(width, height, wallThick, tunnelInteriorMat, cx, bottomY + height / 2, backZ, tier);
        addCuChiBox(width, wallThick, depth, tunnelInteriorMat, cx, bottomY + wallThick / 2, cz, tier);
        addCuChiBox(width, wallThick, depth, tunnelInteriorMat, cx, bottomY + height - wallThick / 2, cz, tier);
        addCuChiBox(wallThick, height, depth, tunnelInteriorMat, leftX, bottomY + height / 2, cz, tier);
        addCuChiBox(wallThick, height, depth, tunnelInteriorMat, rightX, bottomY + height / 2, cz, tier);

        // Khung cột gỗ & xà ngang chống trần hầm (#6b4423)
        if (withTimberFrames) {
          const postPositionsZ = [cz - depth * 0.36, cz, cz + depth * 0.36];
          for (const pz of postPositionsZ) {
            addCuChiBox(0.16, height - 0.16, 0.16, woodThatchMat, leftX + 0.14, bottomY + height / 2, pz, tier);
            addCuChiBox(0.16, height - 0.16, 0.16, woodThatchMat, rightX - 0.14, bottomY + height / 2, pz, tier);
            addCuChiBox(width - 0.2, 0.16, 0.18, woodThatchMat, cx, bottomY + height - 0.16, pz, tier);
          }
        }
      } else {
        // Mặt cắt bên phải (+X = +13): Khoang hầm thụt sâu từ x = cx + depth/2 (13.0) vào tới x = cx - depth/2
        const backX = cx - depth / 2 + wallThick / 2;
        const leftZ = cz - width / 2 + wallThick / 2;
        const rightZ = cz + width / 2 - wallThick / 2;

        addCuChiBox(wallThick, height, width, tunnelInteriorMat, backX, bottomY + height / 2, cz, tier);
        addCuChiBox(depth, wallThick, width, tunnelInteriorMat, cx, bottomY + wallThick / 2, cz, tier);
        addCuChiBox(depth, wallThick, width, tunnelInteriorMat, cx, bottomY + height - wallThick / 2, cz, tier);
        addCuChiBox(depth, height, wallThick, tunnelInteriorMat, cx, bottomY + height / 2, leftZ, tier);
        addCuChiBox(depth, height, wallThick, tunnelInteriorMat, cx, bottomY + height / 2, rightZ, tier);

        if (withTimberFrames) {
          const postPositionsX = [cx - depth * 0.36, cx, cx + depth * 0.36];
          for (const px of postPositionsX) {
            addCuChiBox(0.16, height - 0.16, 0.16, woodThatchMat, px, bottomY + height / 2, leftZ + 0.14, tier);
            addCuChiBox(0.16, height - 0.16, 0.16, woodThatchMat, px, bottomY + height / 2, rightZ - 0.14, tier);
            addCuChiBox(0.18, 0.16, width - 0.2, woodThatchMat, px, bottomY + height - 0.16, cz, tier);
          }
        }
      }
    };

    // Helper dựng Đường Hầm Giao Thông Hẹp Hình Vòm Uốn Lượn Chữ Z (thụt sâu vào mặt cắt)
    const buildVaultedTunnelGallery = (
      cx: number,
      bottomY: number,
      cz: number,
      spanAlongFace: number,
      tunnelH: number,
      recessDepth: number,
      face: 'front' | 'right',
      tier: number
    ) => {
      const archR = Math.min(spanAlongFace * 0.35, 0.65);
      const rectH = Math.max(0.55, tunnelH - archR);
      const shape = new THREE.Shape();
      shape.moveTo(-spanAlongFace / 2, 0);
      shape.lineTo(spanAlongFace / 2, 0);
      shape.lineTo(spanAlongFace / 2, rectH);
      shape.absarc(0, rectH, spanAlongFace / 2, 0, Math.PI, false);
      shape.lineTo(-spanAlongFace / 2, 0);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: recessDepth,
        bevelEnabled: false,
        curveSegments: 18,
      });
      geo.translate(0, 0, -recessDepth / 2);
      const mesh = new THREE.Mesh(geo, tunnelInteriorMat);
      if (face === 'right') {
        mesh.rotation.y = Math.PI / 2;
      }
      mesh.position.set(cx, bottomY, cz);
      addCuChiMesh(mesh, tier);
    };

    // -------------------------------------------------------------------------
    // 2. KHỐI ĐỊA TẦNG 3 TẦNG NGẦM (width = 26, height = 16 từ y = -6 đến y = +10, depth = 26)
    //    Được chia thành Lõi Địa Chất Phía Sau-Trái (x: -13..+8.8, z: -13..+8.8)
    //    và Vách Mặt Cắt Lộ Thiên ở Mặt Trước (+Z = +13) & Mặt Bên Phải (+X = +13)
    //    với các Hốc Khoang Hầm thụt sâu 4.2 đơn vị vào trong lòng đất!
    // -------------------------------------------------------------------------

    // Đế gỗ/đá trưng bày sa bàn ở đáy (y = -6.0 đến -5.4)
    addCuChiBox(26.6, 0.6, 26.6, lateriteDeepMat, 0, -5.7, 0, 0);

    // Lõi đất nguyên khối phía sau-trái (x: -13.0 đến +8.8 -> tâm x = -2.1, rộng 21.8; z: -13.0 đến +8.8 -> tâm z = -2.1, sâu 21.8)
    // Chia thành 3 tầng địa chất để khi kéo thanh trượt "Bóc tách tầng kiến trúc" sẽ tách mượt mà 3 tầng hầm!
    addCuChiBox(21.8, 6.2, 21.8, lateriteDeepMat, -2.1, -2.3, -2.1, 0); // Tầng 3: y từ -5.4 đến +0.8
    addCuChiBox(21.8, 4.4, 21.8, clayMidMat, -2.1, 3.0, -2.1, 1);       // Tầng 2: y từ +0.8 đến +5.2
    addCuChiBox(21.8, 4.0, 21.8, clayUpperMat, -2.1, 7.2, -2.1, 2);     // Tầng 1: y từ +5.2 đến +9.2
    addCuChiBox(21.8, 0.8, 21.8, topsoilLayerMat, -2.1, 9.6, -2.1, 3);  // Lớp đất mặt: y từ +9.2 đến +10.0

    // =========================================================================
    // 3. MẶT CẮT 3 TẦNG ĐỊA ĐẠO DƯỚI LÒNG ĐẤT (MẶT TRƯỚC +Z = +13 & MẶT BÊN +X = +13)
    //    Mỗi tầng có dải đất trần/sàn và các trụ đất ngăn khoang, chừa rỗng hoàn toàn
    //    không gian từ z = +8.8 đến +13.0 (sâu 4.2) và từ x = +8.8 đến +13.0 (sâu 4.2)
    // =========================================================================

    // -------------------------------------------------------------------------
    // A. TẦNG 3 (Độ sâu 8m - 10m: y từ -5.4 đến +0.8, tier = 0)
    //    1) Hầm Trú Ẩn Sâu Chống Bom B-52 (Mặt trước: x từ -10.2 đến +3.8, y từ -4.5 đến +0.2, sâu 4.2)
    //    2) Giếng Nước Ngầm (Mặt trước: x từ +5.8 đến +8.6, đào thẳng từ tầng trên xuống mạch nước #1e5c70 ở y = -4.6)
    //    3) Ngách Thoát Hiểm Ra Sông Sài Gòn (Mặt bên phải +X: z từ -11.4 đến +5.2, y từ -4.5 đến -0.8, sâu 4.2)
    // -------------------------------------------------------------------------
    // Dải nền đá ong đáy Tầng 3 ở mặt trước & mặt bên phải (y từ -5.4 đến -4.5)
    addCuChiBox(26.0, 0.9, 4.2, lateriteDeepMat, 0, -4.95, 10.9, 0);
    addCuChiBox(4.2, 0.9, 21.8, lateriteDeepMat, 10.9, -4.95, -2.1, 0);

    // Các trụ vách đất đá ong Tầng 3 ở mặt trước (z = 10.9, sâu 4.2):
    addCuChiBox(2.8, 4.7, 4.2, lateriteDeepMat, -11.6, -2.15, 10.9, 0); // Trụ biên trái (x: -13.0..-10.2)
    addCuChiBox(2.0, 4.7, 4.2, lateriteDeepMat, 4.8, -2.15, 10.9, 0);   // Trụ ngăn giữa Hầm B-52 và Giếng nước (x: +3.8..+5.8)
    addCuChiBox(4.4, 4.7, 4.2, lateriteDeepMat, 10.8, -2.15, 10.9, 0);  // Khối góc phải mặt trước (x: +8.6..+13.0)

    // Dải đất trần trên Hầm B-52 (y từ +0.2 đến +0.8)
    addCuChiBox(18.8, 0.6, 4.2, lateriteDeepMat, -3.6, 0.5, 10.9, 0);
    addCuChiBox(4.4, 0.6, 4.2, lateriteDeepMat, 10.8, 0.5, 10.9, 0);

    // 1) KHOANG HẦM TRÚ ẨN SÂU CHỐNG BOM B-52 (x: -10.2 đến +3.8 -> cx = -3.2, rộng 14.0, cao 4.7, sâu 4.2)
    buildRecessedBunkerChamber(-3.2, -4.5, 10.9, 14.0, 4.7, 4.2, 'front', 0, true);
    addWarmBunkerLight(-6.2, -0.5, 10.6, 0, 1.9, 8.0);
    addWarmBunkerLight(-0.2, -0.5, 10.6, 0, 1.9, 8.0);

    // Gia cố thêm hệ cột gỗ chéo chống rung chấn bom B-52 (knee-braces) & sàn phản gỗ nghỉ ngơi
    for (const bx of [-8.8, -6.0, -3.2, -0.4, 2.4]) {
      addCuChiBox(0.22, 4.4, 0.22, woodThatchMat, bx, -2.2, 9.2, 0);
      addCuChiBox(0.22, 4.4, 0.22, woodThatchMat, bx, -2.2, 12.4, 0);
      // Thanh chống xiên chữ A chịu lực nén địa chấn
      const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.8, 0.16), woodThatchMat);
      strutL.position.set(bx, -0.6, 9.75);
      strutL.rotation.x = 0.65;
      addCuChiMesh(strutL, 0);
      const strutR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.8, 0.16), woodThatchMat);
      strutR.position.set(bx, -0.6, 11.85);
      strutR.rotation.x = -0.65;
      addCuChiMesh(strutR, 0);
    }
    // Phản gỗ dài, bao gạo dự trữ và chum nước trong hầm trú ẩn B-52
    addCuChiBox(5.6, 0.18, 1.8, woodThatchMat, -6.6, -3.7, 10.2, 0);
    addCuChiBox(5.6, 0.45, 0.16, woodThatchMat, -6.6, -4.05, 9.4, 0);
    addCuChiBox(5.6, 0.45, 0.16, woodThatchMat, -6.6, -4.05, 10.9, 0);
    // Các bao tải lương thực xếp chồng
    for (let s = 0; s < 4; s++) {
      const sack = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 0.85, 12), thatchRoofMat);
      sack.rotation.z = Math.PI / 2;
      sack.scale.set(1, 1, 0.68);
      sack.position.set(0.8 + (s % 2) * 0.95, -4.05 + Math.floor(s / 2) * 0.48, 10.1);
      addCuChiMesh(sack, 0);
    }

    // 2) GIẾNG NƯỚC NGẦM (Underground Water Well) tại x = +7.2 (rộng 2.8 từ x = +5.8 đến +8.6)
    // Đào thẳng đứng từ tầng trên xuống mạch nước ngầm trong vắt (#1e5c70) ở đáy Tầng 3
    buildRecessedBunkerChamber(7.2, -4.5, 10.9, 2.8, 10.3, 3.6, 'front', 0, false);
    // Thành giếng xây gạch đá ong vòng cung bên trong lòng giếng
    const wellLinerGeo = new THREE.CylinderGeometry(1.18, 1.18, 9.8, 20, 1, true, Math.PI, Math.PI);
    const wellLiner = new THREE.Mesh(wellLinerGeo, tunnelInteriorMat);
    wellLiner.position.set(7.2, 0.4, 11.2);
    addCuChiMesh(wellLiner, 0);

    // Mạch nước ngầm trong vắt (#1e5c70) ở đáy giếng Tầng 3 (y từ -4.45 đến -3.1)
    addCuChiBox(2.5, 1.35, 3.3, wellWaterMat, 7.2, -3.78, 10.9, 0);
    const waterSurface = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.08, 24), wellWaterMat);
    waterSurface.position.set(7.2, -3.08, 11.1);
    addCuChiMesh(waterSurface, 0);

    // Khung trục quay gỗ kéo gàu nước & dây thừng thả xuống mặt nước ngầm
    addCuChiBox(0.18, 1.4, 0.18, woodThatchMat, 6.2, 2.5, 11.2, 1);
    addCuChiBox(0.18, 1.4, 0.18, woodThatchMat, 8.2, 2.5, 11.2, 1);
    const windlassAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 12), woodThatchMat);
    windlassAxle.rotation.z = Math.PI / 2;
    windlassAxle.position.set(7.2, 3.05, 11.2);
    addCuChiMesh(windlassAxle, 1);
    // Dây gàu & gàu gỗ múc nước treo lơ lửng trên mặt nước ngầm
    addCuChiBox(0.04, 5.2, 0.04, thatchRoofMat, 7.2, 0.45, 11.2, 0);
    const waterBucket = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.46, 12), woodThatchMat);
    waterBucket.position.set(7.2, -2.35, 11.2);
    addCuChiMesh(waterBucket, 0);
    addWarmBunkerLight(7.2, -1.2, 11.2, 0, 1.8, 7.5);

    // Vật liệu bổ trợ cho nội thất Mặt cắt bên (+X = +13)
    const burlapSackMat = new THREE.MeshStandardMaterial({
      color: 0xb5935b,
      roughness: 0.88,
      metalness: 0.0,
    });
    const terracottaJarMat = new THREE.MeshStandardMaterial({
      color: 0x8f4326,
      roughness: 0.62,
      metalness: 0.05,
    });
    const brassWarheadMat = new THREE.MeshStandardMaterial({
      color: 0xc89d3c,
      roughness: 0.35,
      metalness: 0.78,
    });
    const castIronPotMat = new THREE.MeshStandardMaterial({
      color: 0x1e2022,
      roughness: 0.48,
      metalness: 0.65,
    });
    const stoveEmberMat = new THREE.MeshStandardMaterial({
      color: 0xff4500,
      emissive: new THREE.Color(0xff4500),
      emissiveIntensity: 2.2,
      roughness: 0.35,
    });

    // Helper gắn PointLight theo đúng mã màu/cường độ yêu cầu và liên kết với tầng bóc tách (elevationTier)
    const addCustomChamberPointLight = (
      colorHex: number,
      intensity: number,
      distance: number,
      x: number,
      y: number,
      z: number,
      tier: number
    ) => {
      const pt = new THREE.PointLight(colorHex, intensity, distance);
      pt.position.set(x, y, z);
      pt.userData.elevationTier = tier;
      pt.userData.origY = y;
      group.add(pt);
      return pt;
    };

    // 3) TẦNG 3 CỦA MẶT CẮT BÊN (+X = +13, Độ sâu 10m: y từ -4.5 đến -0.8, tier = 0)
    //    - Khoang bên trái (z từ -8.4 đến +6.0): Hầm Trú Ẩn Kiên Cố Chống Bom B-52 & Ngách Thoát Hiểm Ra Sông Sài Gòn
    //    - Khoang bên phải (z từ -11.5 đến -8.6): Mạch Nước Ngầm & Giếng Nước
    addCuChiBox(4.2, 3.7, 1.5, lateriteDeepMat, 10.9, -2.65, -12.25, 0); // Trụ biên sau mặt phải
    addCuChiBox(4.2, 3.7, 0.7, lateriteDeepMat, 10.9, -2.65, -8.5, 0);   // Vách ngăn đá ong giữa Hầm B-52 và Khoang Giếng Nước
    addCuChiBox(4.2, 3.7, 2.8, lateriteDeepMat, 10.9, -2.65, 7.4, 0);    // Trụ nối góc trước mặt phải
    addCuChiBox(4.2, 1.6, 21.8, lateriteDeepMat, 10.9, 0.0, -2.1, 0);    // Dải đất trần trên Tầng 3 mặt phải

    // 3A) KHOANG BÊN TRÁI TẦNG 3 (z từ -8.15 đến +6.0 -> cz = -1.08, rộng 14.15, cao 3.7, sâu 4.0)
    //     Hầm Trú Ẩn Kiên Cố Chống Bom B-52 & Ngách Thoát Hiểm Ra Sông Sài Gòn
    buildRecessedBunkerChamber(10.9, -4.5, -1.08, 14.15, 3.7, 4.0, 'right', 0, true);
    addWarmBunkerLight(11.2, -1.25, 2.5, 0, 1.8, 8.5);
    addWarmBunkerLight(11.2, -1.25, -4.2, 0, 1.8, 8.5);
    addCustomChamberPointLight(0xffaa44, 1.5, 8.5, 11.6, -2.0, -0.8, 0);

    // Hệ khung dầm gỗ chữ A dày dặn liên tiếp gia cố trần và vách hầm (chống sập khi bom B-52 rải thảm)
    for (const tz of [-6.8, -4.5, -2.2, 0.1, 2.4, 4.7]) {
      // Hai cột gỗ đứng áp sát vách trong (x = 9.25) và vách ngoài (x = 12.45)
      addCuChiBox(0.22, 3.45, 0.22, woodThatchMat, 9.25, -2.65, tz, 0);
      addCuChiBox(0.22, 3.45, 0.22, woodThatchMat, 12.45, -2.65, tz, 0);
      // Xà ngang đỡ trần hầm
      addCuChiBox(3.4, 0.22, 0.24, woodThatchMat, 10.85, -1.05, tz, 0);
      // Hai thanh dầm chéo chữ A dày dặn
      const aStrutIn = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.18, 0.18), woodThatchMat);
      aStrutIn.position.set(10.05, -1.75, tz);
      aStrutIn.rotation.z = 0.62;
      addCuChiMesh(aStrutIn, 0);
      const aStrutOut = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.18, 0.18), woodThatchMat);
      aStrutOut.position.set(11.65, -1.75, tz);
      aStrutOut.rotation.z = -0.62;
      addCuChiMesh(aStrutOut, 0);
      // Thanh giằng ngang đỉnh chữ A
      addCuChiBox(1.5, 0.14, 0.16, woodThatchMat, 10.85, -1.45, tz, 0);
    }

    // 2 sập tre / phản gỗ dài cho bộ đội và nhân dân trú ẩn (đặt tại z = +3.3 và z = -2.4)
    for (const bedZ of [3.3, -2.4]) {
      // Mặt sập tre/phản gỗ ghép nan
      addCuChiBox(1.85, 0.14, 3.4, woodThatchMat, 10.55, -3.72, bedZ, 0);
      addCuChiBox(1.75, 0.05, 3.25, thatchRoofMat, 10.55, -3.62, bedZ, 0); // Chiếu cói trải trên phản
      // Chân phản gỗ chắc chắn
      addCuChiBox(1.75, 0.58, 0.16, woodThatchMat, 10.55, -4.08, bedZ - 1.45, 0);
      addCuChiBox(1.75, 0.58, 0.16, woodThatchMat, 10.55, -4.08, bedZ + 1.45, 0);
      // Gối gỗ / chăn gấp gọn của bộ đội trên sập
      addCuChiBox(0.45, 0.14, 0.75, canopyBrightMat, 9.95, -3.52, bedZ - 1.1, 0);
      addCuChiBox(0.45, 0.14, 0.75, canopyBrightMat, 9.95, -3.52, bedZ + 1.1, 0);
    }

    // Bàn gỗ nhỏ ở giữa 2 sập (z = +0.55) đặt máy thu thanh (radio) và đèn bão phát sáng
    addCuChiBox(1.15, 0.72, 1.35, woodThatchMat, 10.55, -3.98, 0.55, 0);
    addCuChiBox(1.25, 0.08, 1.45, woodThatchMat, 10.55, -3.58, 0.55, 0);
    // Máy thu thanh (Radio cổ điển) có mặt số, núm vặn và ăng-ten kim loại
    addCuChiBox(0.38, 0.32, 0.56, ordnanceMetalMat, 10.45, -3.38, 0.28, 0);
    addCuChiBox(0.05, 0.18, 0.38, medicalClothMat, 10.65, -3.36, 0.28, 0); // Mặt số radio
    const radioAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.65, 8), brassWarheadMat);
    radioAntenna.position.set(10.38, -2.95, 0.08);
    radioAntenna.rotation.x = -0.25;
    addCuChiMesh(radioAntenna, 0);
    // Đèn bão phát sáng đặt cạnh radio
    const stormLanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.12, 12), castIronPotMat);
    stormLanternBase.position.set(10.65, -3.48, 0.88);
    addCuChiMesh(stormLanternBase, 0);
    const stormLanternGlobe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), lampBulbMat);
    stormLanternGlobe.scale.set(0.85, 1.35, 0.85);
    stormLanternGlobe.position.set(10.65, -3.28, 0.88);
    addCuChiMesh(stormLanternGlobe, 0);
    const stormLanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.1, 12), castIronPotMat);
    stormLanternCap.position.set(10.65, -3.08, 0.88);
    addCuChiMesh(stormLanternCap, 0);

    // Ở phía cuối hầm (z = -7.55): Cửa ngách vòm tròn hẹp kèm biển chỉ dẫn / mũi tên thoát hiểm ra Sông Sài Gòn
    const escapePortalRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.14, 12, 24, Math.PI),
      woodThatchMat
    );
    escapePortalRing.rotation.y = Math.PI / 2;
    escapePortalRing.position.set(9.2, -3.55, -6.5);
    addCuChiMesh(escapePortalRing, 0);
    // Hốc tối cửa ngách vòm tròn dẫn sâu vào lòng đất ra bờ sông
    const escapePortalHole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.72, 0.35, 20),
      castIronPotMat
    );
    escapePortalHole.rotation.z = Math.PI / 2;
    escapePortalHole.position.set(9.05, -3.55, -6.5);
    addCuChiMesh(escapePortalHole, 0);
    // Biển chỉ dẫn nền trắng chữ/mũi tên đỏ chỉ hướng thoát hiểm ra Sông Sài Gòn
    addCuChiBox(0.08, 0.42, 1.15, medicalClothMat, 9.22, -2.35, -6.5, 0);
    addCuChiBox(0.1, 0.12, 0.62, redCrossMat, 9.25, -2.35, -6.42, 0); // Thân mũi tên đỏ
    const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.28, 4), redCrossMat);
    arrowHead.rotation.x = -Math.PI / 2;
    arrowHead.rotation.y = Math.PI / 4;
    arrowHead.position.set(9.26, -2.35, -6.82);
    addCuChiMesh(arrowHead, 0);

    // 3B) KHOANG BÊN PHẢI TẦNG 3 (z từ -11.5 đến -8.8 -> cz = -10.15, rộng 2.7, cao 3.7, sâu 4.0)
    //     Mạch Nước Ngầm & Giếng Nước (Nơi có ô nước màu xanh #1e5c70 ở góc dưới bên phải)
    buildRecessedBunkerChamber(10.9, -4.5, -10.15, 2.7, 3.7, 4.0, 'right', 0, false);
    // Ô nước ngầm xanh trong (#1e5c70) ở đáy khoang (z = -10.15)
    addCuChiBox(3.8, 0.85, 2.5, wellWaterMat, 11.0, -4.05, -10.15, 0);
    // Thành giếng đá ong hình vành khuyên bao quanh mặt nước ngầm
    const sideWellCurb = new THREE.Mesh(
      new THREE.TorusGeometry(0.88, 0.18, 12, 24),
      lateriteDeepMat
    );
    sideWellCurb.rotation.x = Math.PI / 2;
    sideWellCurb.position.set(10.9, -3.52, -10.15);
    addCuChiMesh(sideWellCurb, 0);
    const sideWellWall = new THREE.Mesh(
      new THREE.CylinderGeometry(0.88, 0.92, 0.55, 20, 1, true),
      lateriteDeepMat
    );
    sideWellWall.position.set(10.9, -3.72, -10.15);
    addCuChiMesh(sideWellWall, 0);
    // Hai trụ gỗ đứng và trục quay ròng rọc bằng gỗ kèm tay quay
    addCuChiBox(0.18, 1.85, 0.18, woodThatchMat, 10.9, -2.65, -10.98, 0);
    addCuChiBox(0.18, 1.85, 0.18, woodThatchMat, 10.9, -2.65, -9.32, 0);
    addCuChiBox(0.24, 0.16, 1.95, woodThatchMat, 10.9, -1.68, -10.15, 0); // Xà đỡ trên
    const sideWindlassAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.82, 14), woodThatchMat);
    sideWindlassAxle.rotation.x = Math.PI / 2;
    sideWindlassAxle.position.set(10.9, -2.05, -10.15);
    addCuChiMesh(sideWindlassAxle, 0);
    // Bánh ròng rọc gỗ & dây thừng thả gầu múc nước treo ngay trên mặt nước
    const pulleyWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 16), woodThatchMat);
    pulleyWheel.rotation.x = Math.PI / 2;
    pulleyWheel.position.set(10.9, -2.05, -10.15);
    addCuChiMesh(pulleyWheel, 0);
    addCuChiBox(0.04, 1.15, 0.04, burlapSackMat, 10.9, -2.62, -10.15, 0); // Dây thừng
    const sideWaterBucket = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.42, 14), woodThatchMat);
    sideWaterBucket.position.set(10.9, -3.22, -10.15);
    addCuChiMesh(sideWaterBucket, 0);
    // Quai xách gầu nước bằng sắt và mặt nước trong gầu
    const bucketWaterTop = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.05, 12), wellWaterMat);
    bucketWaterTop.position.set(10.9, -3.03, -10.15);
    addCuChiMesh(bucketWaterTop, 0);
    // Đèn PointLight soi sáng trực tiếp mặt nước ngầm và giếng đá ong
    addWarmBunkerLight(11.1, -1.25, -10.15, 0, 1.9, 7.5);
    addCustomChamberPointLight(0xffbb55, 1.6, 7.0, 11.4, -2.6, -10.15, 0);

    // -------------------------------------------------------------------------
    // B. TẦNG 2 (Độ sâu 6m: y từ +0.8 đến +5.2, tier = 1)
    //    1) Hầm Quân Y & Nghỉ Ngơi (Mặt trước: x từ -10.6 đến -1.8, y từ +1.6 đến +4.4, sâu 4.2)
    //    2) Hầm Công Binh / Kho Vũ Khí & Chế Tạo (Mặt trước: x từ -0.2 đến +5.6, y từ +1.6 đến +4.4, sâu 4.2)
    //    3) Mặt Cắt Bên Phải (+X = +13):
    //       - Khoang bên trái (cz = +3.9): Xưởng Công Binh Chế Tạo Vũ Khí Tự Chế
    //       - Khoang bên phải (cz = -6.9): Hầm Dự Trữ Lương Thực & Kho Hậu Cần
    // -------------------------------------------------------------------------
    // Lớp đất sàn Tầng 2 (ngăn cách Tầng 3 và Tầng 2, y từ +0.8 đến +1.6, chừa lỗ Giếng nước và Hố tụt)
    addCuChiBox(16.2, 0.8, 4.2, clayMidMat, -2.3, 1.2, 10.9, 1);
    addCuChiBox(4.4, 0.8, 4.2, clayMidMat, 10.8, 1.2, 10.9, 1);
    // Hố tụt có bậc đất từ Tầng 2 xuống Tầng 3 tại x = -11.4 (rộng 2.0)
    buildRecessedBunkerChamber(-11.4, 0.2, 10.9, 1.8, 4.2, 3.6, 'front', 1, false);
    for (let st = 0; st < 5; st++) {
      addCuChiBox(0.45, 0.28, 1.6, woodThatchMat, -12.0 + st * 0.32, 0.35 + st * 0.32, 10.9, 1);
    }
    addCuChiBox(0.6, 4.4, 4.2, clayMidMat, -12.7, 3.0, 10.9, 1);

    // Các trụ vách đất ngăn giữa các khoang Tầng 2 ở mặt trước
    addCuChiBox(1.6, 2.8, 4.2, clayMidMat, -1.0, 3.0, 10.9, 1); // Trụ ngăn giữa Hầm Quân Y & Hầm Công Binh (x: -1.8..-0.2)
    addCuChiBox(4.4, 2.8, 4.2, clayMidMat, 10.8, 3.0, 10.9, 1); // Khối góc phải mặt trước (x: +8.6..+13.0)
    // Trần đất phía trên Tầng 2 (y từ +4.4 đến +5.2, chừa lỗ Giếng nước tại x: +5.8..+8.6 và Hố tụt tại x: -1.6..0.0)
    addCuChiBox(11.4, 0.8, 4.2, clayMidMat, -7.3, 4.8, 10.9, 1);
    addCuChiBox(5.8, 0.8, 4.2, clayMidMat, 2.9, 4.8, 10.9, 1);
    addCuChiBox(4.4, 0.8, 4.2, clayMidMat, 10.8, 4.8, 10.9, 1);

    // 1) KHOANG HẦM QUÂN Y & NGHỈ NGƠI (x: -10.5 đến -1.8 -> cx = -6.15, rộng 8.7, cao 2.8, sâu 4.2)
    buildRecessedBunkerChamber(-6.15, 1.6, 10.9, 8.7, 2.8, 4.2, 'front', 1, true);
    addWarmBunkerLight(-8.2, 3.95, 10.8, 1, 1.8, 7.5);
    addWarmBunkerLight(-4.1, 3.95, 10.8, 1, 1.8, 7.5);

    // Giường tre thương binh (bên trái khoang Quân Y)
    addCuChiBox(2.2, 0.14, 1.2, thatchRoofMat, -8.9, 2.25, 10.4, 1);
    addCuChiBox(0.14, 0.55, 1.2, woodThatchMat, -9.9, 1.95, 10.4, 1);
    addCuChiBox(0.14, 0.55, 1.2, woodThatchMat, -7.9, 1.95, 10.4, 1);
    // Võng dù bộ đội mắc chéo giữa 2 cột gỗ chống hầm
    const hammockCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7.6, 3.1, 11.6),
      new THREE.Vector3(-6.3, 2.45, 11.4),
      new THREE.Vector3(-5.0, 3.1, 11.6),
    ]);
    const hammockGeo = new THREE.TubeGeometry(hammockCurve, 16, 0.22, 8, false);
    const hammockMesh = new THREE.Mesh(hammockGeo, canopyBrightMat);
    hammockMesh.scale.set(1, 0.45, 1.4);
    addCuChiMesh(hammockMesh, 1);

    // Bàn sơ cứu / phẫu thuật dã chiến trải khăn trắng & Chữ thập đỏ (#dc2626) + Kệ thuốc trên vách
    addCuChiBox(1.9, 0.82, 1.05, woodThatchMat, -3.6, 2.08, 10.8, 1);
    addCuChiBox(1.94, 0.08, 1.08, medicalClothMat, -3.6, 2.52, 10.8, 1);
    // Biểu tượng Chữ Thập Đỏ trên vách hậu & tủ thuốc Quân Y
    addCuChiBox(0.75, 0.75, 0.08, medicalClothMat, -3.6, 3.45, 9.02, 1);
    addCuChiBox(0.52, 0.16, 0.1, redCrossMat, -3.6, 3.45, 9.06, 1);
    addCuChiBox(0.16, 0.52, 0.1, redCrossMat, -3.6, 3.45, 9.06, 1);
    addCuChiBox(1.5, 0.95, 0.28, woodThatchMat, -5.6, 3.3, 9.12, 1);

    // 2) KHOANG HẦM CÔNG BINH / KHO VŨ KHÍ & CHẾ TẠO (x: -0.2 đến +5.6 -> cx = 2.7, rộng 5.8, cao 2.8, sâu 4.2)
    buildRecessedBunkerChamber(2.7, 1.6, 10.9, 5.8, 2.8, 4.2, 'front', 1, true);
    addWarmBunkerLight(2.7, 3.95, 10.8, 1, 1.8, 7.5);

    // Bàn gò vũ khí tự chế từ vỏ bom lép (x = 1.6) & các hòm đạn gỗ (x = 4.2)
    addCuChiBox(2.1, 0.82, 1.1, woodThatchMat, 1.5, 2.08, 10.7, 1);
    // Quả bom lép đặt trên giá gỗ đang được công binh cưa lấy thuốc nổ
    const bombBody = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 1.25, 14), ordnanceMetalMat);
    bombBody.rotation.z = Math.PI / 2;
    bombBody.position.set(1.5, 2.74, 10.7);
    addCuChiMesh(bombBody, 1);
    const bombNose = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.42, 14), ordnanceMetalMat);
    bombNose.rotation.z = -Math.PI / 2;
    bombNose.position.set(2.32, 2.74, 10.7);
    addCuChiMesh(bombNose, 1);
    // Các hòm gỗ đựng vũ khí & đạn dược xếp chồng
    addCuChiBox(1.35, 0.55, 0.85, woodThatchMat, 4.2, 1.95, 10.2, 1);
    addCuChiBox(1.25, 0.52, 0.8, ordnanceMetalMat, 4.2, 2.48, 10.2, 1);
    addCuChiBox(1.15, 0.48, 0.78, woodThatchMat, 4.1, 2.98, 10.2, 1);

    // 3) TẦNG 2 CỦA MẶT CẮT BÊN (+X = +13, 2 Khoang giữa - Độ sâu 6m: y từ +1.6 đến +4.4, tier = 1)
    addCuChiBox(4.2, 0.8, 21.8, clayMidMat, 10.9, 1.2, -2.1, 1);  // Sàn đất Tầng 2 mặt phải
    addCuChiBox(4.2, 2.8, 1.5, clayMidMat, 10.9, 3.0, -12.25, 1); // Trụ biên sau mặt phải
    addCuChiBox(4.2, 2.8, 2.2, clayMidMat, 10.9, 3.0, -1.2, 1);   // Vách ngăn chữ Z ở giữa 2 khoang Tầng 2 mặt phải
    addCuChiBox(4.2, 0.8, 21.8, clayMidMat, 10.9, 4.8, -2.1, 1);  // Trần đất Tầng 2 mặt phải

    // Đường hào hẹp chữ Z xuyên qua nút chặn giữa 2 khoang mặt phải
    buildVaultedTunnelGallery(10.9, 1.6, -1.2, 1.3, 1.85, 3.8, 'right', 1);

    // 3A) KHOANG BÊN TRÁI TẦNG 2 (cz = +3.9, z từ -0.1 đến +7.9, rộng 8.0, cao 2.8, sâu 4.0)
    //     Xưởng Công Binh Chế Tạo Vũ Khí Tự Chế
    buildRecessedBunkerChamber(10.9, 1.6, 3.9, 8.0, 2.8, 4.0, 'right', 1, true);
    addWarmBunkerLight(11.1, 3.95, 3.9, 1, 1.8, 8.0);
    // PointLight(0xffaa33, 1.5, 8) chiếu sáng trực tiếp xuống bàn chế tạo vũ khí
    addCustomChamberPointLight(0xffaa33, 1.5, 8.0, 11.4, 3.55, 3.6, 1);

    // Bàn gỗ dày ở chính giữa xưởng (z = +3.6, x = 10.8)
    addCuChiBox(1.35, 0.14, 2.85, woodThatchMat, 10.8, 2.48, 3.6, 1);
    addCuChiBox(1.2, 0.78, 0.18, woodThatchMat, 10.8, 2.04, 2.35, 1);
    addCuChiBox(1.2, 0.78, 0.18, woodThatchMat, 10.8, 2.04, 4.85, 1);
    addCuChiBox(0.16, 0.16, 2.5, woodThatchMat, 10.8, 1.92, 3.6, 1); // Thanh giằng chân bàn

    // Giá gỗ chữ V đỡ quả bom/đầu đạn chưa nổ đang được cưa lấy thuốc nổ (màu xanh rêu & đồng)
    addCuChiBox(0.55, 0.22, 0.16, woodThatchMat, 10.8, 2.65, 3.05, 1);
    addCuChiBox(0.55, 0.22, 0.16, woodThatchMat, 10.8, 2.65, 3.95, 1);
    const workshopBombBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.24, 1.38, 16),
      ordnanceMetalMat
    );
    workshopBombBody.rotation.x = Math.PI / 2;
    workshopBombBody.position.set(10.8, 2.85, 3.45);
    addCuChiMesh(workshopBombBody, 1);
    // Đầu đạn & đai đồng (brassWarheadMat)
    const workshopBombNose = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.48, 16),
      brassWarheadMat
    );
    workshopBombNose.rotation.x = Math.PI / 2;
    workshopBombNose.position.set(10.8, 2.85, 4.38);
    addCuChiMesh(workshopBombNose, 1);
    const bombTailFins = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.32, 0.32, 4),
      ordnanceMetalMat
    );
    bombTailFins.rotation.x = Math.PI / 2;
    bombTailFins.position.set(10.8, 2.85, 2.62);
    addCuChiMesh(bombTailFins, 1);

    // Cưa sắt đang đặt ngang thân quả bom + Búa sắt + Kìm sắt + Đèn dầu trên mặt bàn
    addCuChiBox(0.75, 0.08, 0.03, castIronPotMat, 10.95, 3.16, 3.65, 1); // Lưỡi cưa sắt
    addCuChiBox(0.78, 0.04, 0.04, brassWarheadMat, 10.95, 3.24, 3.65, 1); // Khung cưa sắt
    addCuChiBox(0.22, 0.06, 0.06, woodThatchMat, 11.42, 3.18, 3.65, 1);   // Cán gỗ cưa sắt
    // Búa công binh (cán gỗ + đầu búa thép đen)
    addCuChiBox(0.42, 0.05, 0.05, woodThatchMat, 11.12, 2.58, 2.55, 1);
    addCuChiBox(0.1, 0.1, 0.22, castIronPotMat, 11.3, 2.59, 2.55, 1);
    // Kìm sắt (2 gọng chéo)
    addCuChiBox(0.34, 0.04, 0.08, castIronPotMat, 10.45, 2.58, 4.45, 1);
    // Đèn dầu phát sáng đặt ở góc bàn chế tạo (z = 4.75)
    const workshopLampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.14, 12), brassWarheadMat);
    workshopLampBase.position.set(11.15, 2.62, 4.75);
    addCuChiMesh(workshopLampBase, 1);
    const workshopLampFlame = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), lampBulbMat);
    workshopLampFlame.scale.set(0.8, 1.4, 0.8);
    workshopLampFlame.position.set(11.15, 2.78, 4.75);
    addCuChiMesh(workshopLampFlame, 1);

    // Kệ gỗ 3 tầng sát vách hậu (x = 9.35, z từ +1.1 đến +5.2) xếp mìn tự chế (mìn gạt), lựu đạn, hòm dụng cụ gỗ
    addCuChiBox(0.55, 2.1, 0.14, woodThatchMat, 9.38, 2.68, 1.15, 1);
    addCuChiBox(0.55, 2.1, 0.14, woodThatchMat, 9.38, 2.68, 5.15, 1);
    for (const shelfY of [2.15, 2.85, 3.55]) {
      addCuChiBox(0.58, 0.09, 4.15, woodThatchMat, 9.38, shelfY, 3.15, 1);
    }
    // Các quả mìn tự chế (mìn gạt hình trụ dẹt xanh rêu + chốt đồng) trên tầng kệ trên
    for (const mineZ of [1.65, 2.35, 3.05, 3.75]) {
      const landmine = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.18, 14), ordnanceMetalMat);
      landmine.position.set(9.42, 3.69, mineZ);
      addCuChiMesh(landmine, 1);
      const mineFuse = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8), brassWarheadMat);
      mineFuse.position.set(9.42, 3.82, mineZ);
      addCuChiMesh(mineFuse, 1);
    }
    // Lựu đạn tự chế & hòm dụng cụ gỗ trên tầng kệ giữa và dưới
    for (const grenZ of [1.6, 2.05, 2.5, 2.95]) {
      const grenade = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), castIronPotMat);
      grenade.scale.set(0.85, 1.25, 0.85);
      grenade.position.set(9.44, 3.02, grenZ);
      addCuChiMesh(grenade, 1);
    }
    addCuChiBox(0.46, 0.36, 0.95, woodThatchMat, 9.42, 3.08, 4.15, 1); // Hòm dụng cụ gỗ tầng giữa
    addCuChiBox(0.48, 0.42, 1.15, ordnanceMetalMat, 9.42, 2.4, 2.15, 1); // Hòm đạn sắt tầng dưới
    addCuChiBox(0.48, 0.42, 1.15, woodThatchMat, 9.42, 2.4, 3.95, 1);    // Hòm đồ nghề gỗ tầng dưới

    // Thang gỗ nối từ Xưởng Công Binh (Tầng 2) lên Tầng 1 tại phía trái khoang (z = +6.85)
    addCuChiBox(0.1, 3.2, 0.1, woodThatchMat, 10.35, 3.25, 6.85, 1);
    addCuChiBox(0.1, 3.2, 0.1, woodThatchMat, 11.25, 3.25, 6.85, 1);
    for (let lr = 0; lr < 7; lr++) {
      addCuChiBox(0.95, 0.07, 0.08, woodThatchMat, 10.8, 1.85 + lr * 0.42, 6.85, 1);
    }

    // 3B) KHOANG BÊN PHẢI TẦNG 2 (cz = -6.9, z từ -11.5 đến -2.3, rộng 9.2, cao 2.8, sâu 4.0)
    //     Hầm Dự Trữ Lương Thực & Kho Hậu Cần
    buildRecessedBunkerChamber(10.9, 1.6, -6.9, 9.2, 2.8, 4.0, 'right', 1, true);
    addWarmBunkerLight(11.1, 3.95, -6.9, 1, 1.8, 8.0);
    // PointLight(0xffaa33, 1.4, 7) chiếu sáng kho hậu cần
    addCustomChamberPointLight(0xffaa33, 1.4, 7.0, 11.4, 3.55, -6.6, 1);

    // Kệ sàn gỗ kê cao chống ẩm xếp chồng các bao tải gạo/sắn (SphereGeometry ép dẹp nhẹ, màu vàng nâu bao bố #b5935b)
    addCuChiBox(1.65, 0.16, 3.6, woodThatchMat, 10.45, 1.76, -4.6, 1);
    const sackPositions = [
      // Lớp đáy (5 bao tải lớn)
      [10.15, 2.02, -3.2], [10.85, 2.02, -3.2],
      [10.15, 2.02, -4.4], [10.85, 2.02, -4.4],
      [10.15, 2.02, -5.6], [10.85, 2.02, -5.6],
      // Lớp giữa (4 bao tải)
      [10.22, 2.38, -3.75], [10.82, 2.38, -3.75],
      [10.22, 2.38, -5.0], [10.82, 2.38, -5.0],
      // Lớp đỉnh (2 bao tải)
      [10.52, 2.72, -4.1], [10.52, 2.72, -4.95],
    ];
    for (const [sx, sy, sz] of sackPositions) {
      const riceSack = new THREE.Mesh(new THREE.SphereGeometry(0.44, 14, 12), burlapSackMat);
      riceSack.scale.set(0.82, 0.46, 1.28);
      riceSack.position.set(sx, sy, sz);
      addCuChiMesh(riceSack, 1);
    }

    // Các chum / vại sành đựng nước ngọt và muối (CylinderGeometry màu nâu đất nung terracottaJarMat) ở giữa kho (z từ -6.8 đến -8.8)
    const jarLocations = [
      [10.25, -6.95, 1.0],
      [11.15, -7.25, 0.92],
      [10.35, -8.15, 1.08],
      [11.2, -8.45, 0.85],
    ];
    for (const [jx, jz, jScale] of jarLocations) {
      // Thân chum sành phình giữa
      const jarBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34 * jScale, 0.26 * jScale, 0.78 * jScale, 16),
        terracottaJarMat
      );
      jarBody.position.set(jx, 1.68 + 0.39 * jScale, jz);
      addCuChiMesh(jarBody, 1);
      const jarBelly = new THREE.Mesh(
        new THREE.SphereGeometry(0.41 * jScale, 16, 12),
        terracottaJarMat
      );
      jarBelly.scale.set(1, 0.88, 1);
      jarBelly.position.set(jx, 1.68 + 0.42 * jScale, jz);
      addCuChiMesh(jarBelly, 1);
      // Miệng chum và nắp gỗ đậy kín
      const jarRim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28 * jScale, 0.28 * jScale, 0.1 * jScale, 14),
        terracottaJarMat
      );
      jarRim.position.set(jx, 1.68 + 0.82 * jScale, jz);
      addCuChiMesh(jarRim, 1);
      const jarLid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.31 * jScale, 0.31 * jScale, 0.06 * jScale, 14),
        woodThatchMat
      );
      jarLid.position.set(jx, 1.68 + 0.88 * jScale, jz);
      addCuChiMesh(jarLid, 1);
    }

    // Kệ gỗ để nhu yếu phẩm áp vách hậu kho hậu cần (x = 9.38, z từ -9.2 đến -5.8)
    addCuChiBox(0.55, 2.05, 0.14, woodThatchMat, 9.38, 2.68, -5.85, 1);
    addCuChiBox(0.55, 2.05, 0.14, woodThatchMat, 9.38, 2.68, -9.15, 1);
    addCuChiBox(0.58, 0.09, 3.45, woodThatchMat, 9.38, 2.55, -7.5, 1);
    addCuChiBox(0.58, 0.09, 3.45, woodThatchMat, 9.38, 3.35, -7.5, 1);
    // Các kiện lương khô, thùng muối và bao nhu yếu phẩm trên kệ
    addCuChiBox(0.45, 0.38, 0.85, burlapSackMat, 9.42, 2.78, -6.5, 1);
    addCuChiBox(0.45, 0.38, 0.85, woodThatchMat, 9.42, 2.78, -7.65, 1);
    addCuChiBox(0.45, 0.38, 0.85, ordnanceMetalMat, 9.42, 2.78, -8.65, 1);
    addCuChiBox(0.44, 0.34, 0.95, burlapSackMat, 9.42, 3.56, -6.9, 1);
    addCuChiBox(0.44, 0.34, 0.95, terracottaJarMat, 9.42, 3.56, -8.2, 1);

    // Thang gỗ từ Kho Hậu Cần (Tầng 2) đi xuống Tầng 3 ở phía phải khoang (z = -10.35)
    addCuChiBox(0.1, 3.1, 0.1, woodThatchMat, 10.35, 1.95, -10.35, 1);
    addCuChiBox(0.1, 3.1, 0.1, woodThatchMat, 11.25, 1.95, -10.35, 1);
    for (let lr = 0; lr < 7; lr++) {
      addCuChiBox(0.95, 0.07, 0.08, woodThatchMat, 10.8, 0.65 + lr * 0.42, -10.35, 1);
    }

    // -------------------------------------------------------------------------
    // C. TẦNG 1 (Độ sâu cách mặt đất 3m: y từ +5.2 đến +9.2, tier = 2)
    //    1) Lối Xuống Cửa Hầm Bí Mật, Đường Hầm Chữ Z & Nút Chặn Chống Độc (x: -11.5 đến -6.8)
    //    2) Phòng Họp & Chỉ Huy - Command & Briefing Bunker (x: -6.4 đến +1.6, y: +5.8 đến +8.4, sâu 4.2)
    //    3) Hầm Bếp Hoàng Cầm & Rãnh Dẫn Khói Tản Nhiệt (x: +2.6 đến +8.6, y: +5.8 đến +8.4, sâu 4.2)
    //    4) Mặt Cắt Bên Phải (+X = +13):
    //       - Khoang bên trái (cz = +3.0): Hầm Bếp Hoàng Cầm & Hệ Thống Tản Khói
    //       - Khoang bên phải (cz = -7.5): Hầm Chiến Đấu & Nút Chặn Chống Độc / Bẫy Chông
    // -------------------------------------------------------------------------
    // Dải đất sàn Tầng 1 (y từ +5.2 đến +5.8)
    addCuChiBox(26.0, 0.6, 4.2, clayUpperMat, 0, 5.5, 10.9, 2);
    addCuChiBox(4.2, 0.6, 21.8, clayUpperMat, 10.9, 5.5, -2.1, 2);

    // Các trụ vách đất ngăn khoang Tầng 1 ở mặt trước
    addCuChiBox(1.5, 2.6, 4.2, clayUpperMat, -12.25, 7.1, 10.9, 2); // Trụ biên trái
    addCuChiBox(1.0, 2.6, 4.2, clayUpperMat, 2.1, 7.1, 10.9, 2);    // Trụ ngăn giữa Phòng Chỉ Huy và Bếp Hoàng Cầm
    addCuChiBox(4.4, 2.6, 4.2, clayUpperMat, 10.8, 7.1, 10.9, 2);   // Khối góc phải mặt trước

    // Lớp đất trần Tầng 1 & Lớp đất mặt (y từ +8.4 đến +10.0)
    addCuChiBox(26.0, 0.8, 4.2, clayUpperMat, 0, 8.8, 10.9, 2);
    addCuChiBox(4.2, 0.8, 21.8, clayUpperMat, 10.9, 8.8, -2.1, 2);
    addCuChiBox(26.0, 0.8, 4.2, topsoilLayerMat, 0, 9.6, 10.9, 3);
    addCuChiBox(4.2, 0.8, 21.8, topsoilLayerMat, 10.9, 9.6, -2.1, 3);

    // 1) ĐƯỜNG HẦM GIAO THÔNG CHỮ Z, THANG GỖ TỪ CỬA HẦM BÍ MẬT & NÚT CHẶN CHỐNG ĐỘC (x: -11.5 đến -6.4)
    buildRecessedBunkerChamber(-8.95, 5.8, 10.9, 5.1, 2.6, 3.8, 'front', 2, false);
    // Ống giếng đứng từ Cửa hầm bí mật trên mặt đất (x = -9.8, z = 10.8) xuyên xuống Tầng 1 kèm thang gỗ
    addCuChiBox(1.35, 2.4, 1.35, tunnelInteriorMat, -9.8, 9.1, 10.8, 2);
    for (let r = 0; r < 9; r++) {
      addCuChiBox(0.75, 0.07, 0.08, woodThatchMat, -9.8, 6.0 + r * 0.46, 10.35, 2);
    }
    addCuChiBox(0.09, 4.2, 0.09, woodThatchMat, -10.18, 7.9, 10.35, 2);
    addCuChiBox(0.09, 4.2, 0.09, woodThatchMat, -9.42, 7.9, 10.35, 2);

    // Vách đất tạo khúc cua chữ Z & Nút chặn chống độc / cửa sập gỗ hình nêm (x = -7.3)
    addCuChiBox(0.95, 2.6, 2.2, clayUpperMat, -7.3, 7.1, 11.7, 2);
    const airlockPlug = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.48, 4), woodThatchMat);
    airlockPlug.rotation.z = Math.PI / 2;
    airlockPlug.rotation.y = Math.PI / 4;
    airlockPlug.position.set(-7.3, 6.55, 9.95);
    addCuChiMesh(airlockPlug, 2);

    // 2) PHÒNG HỌP & CHỈ HUY (Command & Briefing Bunker: x từ -6.4 đến +1.6 -> cx = -2.4, rộng 8.0, cao 2.6, sâu 4.2)
    buildRecessedBunkerChamber(-2.4, 5.8, 10.9, 8.0, 2.6, 4.2, 'front', 2, true);
    addWarmBunkerLight(-4.4, 8.0, 10.8, 2, 2.0, 8.5);
    addWarmBunkerLight(-0.4, 8.0, 10.8, 2, 2.0, 8.5);

    // Bàn gỗ sa bàn chỉ huy ở chính giữa + 2 ghế băng gỗ dài hai bên
    addCuChiBox(3.4, 0.14, 1.25, woodThatchMat, -2.4, 6.62, 10.9, 2);
    addCuChiBox(0.16, 0.68, 1.1, woodThatchMat, -3.8, 6.22, 10.9, 2);
    addCuChiBox(0.16, 0.68, 1.1, woodThatchMat, -1.0, 6.22, 10.9, 2);
    // Sa bàn tác chiến nhỏ đặt trên mặt bàn chỉ huy
    addCuChiBox(1.5, 0.08, 0.85, forestGrassMat, -2.4, 6.73, 10.9, 2);
    // Hai ghế băng gỗ dài
    addCuChiBox(3.2, 0.1, 0.42, woodThatchMat, -2.4, 6.28, 9.85, 2);
    addCuChiBox(3.2, 0.1, 0.42, woodThatchMat, -2.4, 6.28, 11.95, 2);

    // Bản đồ tác chiến & Cờ đỏ sao vàng treo trang trọng trên vách hậu Phòng Chỉ Huy (z = 9.02)
    addCuChiBox(2.2, 1.35, 0.08, mapBoardMat, -3.7, 7.25, 9.02, 2);
    addCuChiBox(1.85, 1.22, 0.06, bannerFlagMat, -0.9, 7.28, 9.02, 2);

    // 3) HẦM BẾP HOÀNG CẦM & HỆ THỐNG RÃNH DẪN KHÓI TẢN NHIỆT (x từ +2.6 đến +8.6 -> cx = 5.6, rộng 6.0, cao 2.6, sâu 4.2)
    buildRecessedBunkerChamber(5.6, 5.8, 10.9, 6.0, 2.6, 4.2, 'front', 2, true);
    addWarmBunkerLight(5.4, 8.0, 10.8, 2, 1.9, 8.0);

    // Bếp đất nung Hoàng Cầm (x = 4.4, y = 6.3, z = 10.7) kèm lửa hồng & chảo gang lớn nấu cơm
    addCuChiBox(1.75, 0.68, 1.35, clayUpperMat, 4.3, 6.22, 10.7, 2);
    addCuChiBox(0.65, 0.36, 0.45, stoveFireMat, 4.3, 6.08, 11.25, 2);
    const cauldron = new THREE.Mesh(
      new THREE.SphereGeometry(0.54, 16, 12, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65),
      ordnanceMetalMat
    );
    cauldron.position.set(4.3, 6.72, 10.7);
    addCuChiMesh(cauldron, 2);

    // Hệ thống 3 bầu giảm áp & rãnh dẫn khói tản nhiệt chạy ngầm từ bếp Hoàng Cầm lên mặt đất
    const smokeFlueCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(5.0, 6.35, 10.7),
      new THREE.Vector3(6.2, 7.15, 10.7),
      new THREE.Vector3(7.1, 8.15, 10.7),
      new THREE.Vector3(7.8, 9.85, 10.7),
    ]);
    const smokeFlueGeo = new THREE.TubeGeometry(smokeFlueCurve, 20, 0.22, 10, false);
    const smokeFlueMesh = new THREE.Mesh(smokeFlueGeo, tunnelInteriorMat);
    addCuChiMesh(smokeFlueMesh, 2);
    // 2 Bầu đất tản nhiệt làm nguội khói trên đường ống
    for (const chamberPt of [
      [6.15, 7.15, 10.7],
      [7.05, 8.1, 10.7],
    ]) {
      const smokeChamber = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 12), tunnelInteriorMat);
      smokeChamber.scale.set(1.2, 0.85, 0.9);
      smokeChamber.position.set(chamberPt[0], chamberPt[1], chamberPt[2]);
      addCuChiMesh(smokeChamber, 2);
    }

    // 4) TẦNG 1 CỦA MẶT CẮT BÊN (+X = +13, 2 Khoang trên cùng - Độ sâu 3m: y từ +5.8 đến +8.4, tier = 2)
    addCuChiBox(4.2, 2.6, 1.5, clayUpperMat, 10.9, 7.1, -12.25, 2);
    addCuChiBox(4.2, 2.6, 2.0, clayUpperMat, 10.9, 7.1, -2.5, 2);
    buildVaultedTunnelGallery(10.9, 5.8, -2.5, 1.35, 1.8, 3.8, 'right', 2);

    // 4A) KHOANG BÊN TRÁI TẦNG 1 (cz = +3.0, z từ -1.5 đến +7.5, rộng 9.0, cao 2.6, sâu 4.0)
    //     Hầm Bếp Hoàng Cầm & Hệ Thống Tản Khói
    buildRecessedBunkerChamber(10.9, 5.8, 3.0, 9.0, 2.6, 4.0, 'right', 2, true);
    addWarmBunkerLight(11.1, 8.0, 3.0, 2, 1.8, 8.0);
    // PointLight(0xff8822, 1.6, 8) để khoang bếp rực sáng ấm áp
    addCustomChamberPointLight(0xff8822, 1.6, 8.0, 11.4, 7.45, 2.6, 2);

    // Gia cố thêm hệ cột gỗ chống trần hầm ở hai bên vách khoang bếp
    for (const kz of [-0.6, 1.8, 4.2, 6.6]) {
      addCuChiBox(0.18, 2.4, 0.18, woodThatchMat, 9.3, 7.05, kz, 2);
      addCuChiBox(0.18, 2.4, 0.18, woodThatchMat, 12.4, 7.05, kz, 2);
      addCuChiBox(3.25, 0.16, 0.18, woodThatchMat, 10.85, 8.18, kz, 2);
    }

    // Cụm Bếp đất nung Hoàng Cầm ở giữa khoang (z = +2.6, x = 10.75)
    addCuChiBox(1.45, 0.72, 2.25, terracottaJarMat, 10.75, 6.22, 2.6, 2);
    addCuChiBox(1.52, 0.1, 2.32, clayUpperMat, 10.75, 6.6, 2.6, 2);
    // Cửa lò có lửa đỏ cam phát sáng bên trong (0xff4500, emissive) hướng ra mặt cắt +X
    addCuChiBox(0.32, 0.42, 0.68, stoveEmberMat, 11.38, 6.12, 2.6, 2);
    const stoveFireCore = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), stoveEmberMat);
    stoveFireCore.scale.set(0.9, 0.85, 1.35);
    stoveFireCore.position.set(11.45, 6.14, 2.6);
    addCuChiMesh(stoveFireCore, 2);

    // 2 nồi gang / đồng đen đặt trên mặt bếp Hoàng Cầm (z = +2.05 và z = +3.15)
    for (const [potZ, potR, potMat] of [
      [2.05, 0.42, castIronPotMat],
      [3.15, 0.36, brassWarheadMat],
    ] as [number, number, THREE.MeshStandardMaterial][]) {
      const cookingPot = new THREE.Mesh(
        new THREE.CylinderGeometry(potR, potR * 0.82, 0.42, 16),
        potMat
      );
      cookingPot.position.set(10.75, 6.82, potZ);
      addCuChiMesh(cookingPot, 2);
      const potLid = new THREE.Mesh(
        new THREE.ConeGeometry(potR * 1.04, 0.14, 16),
        woodThatchMat
      );
      potLid.position.set(10.75, 7.08, potZ);
      addCuChiMesh(potLid, 2);
    }

    // Đống củi khô xếp ngay ngắn bên cạnh bếp (z = +0.55, x = 10.65)
    for (let lg = 0; lg < 9; lg++) {
      const logRow = Math.floor(lg / 3);
      const logCol = lg % 3;
      const firewoodLog = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.1, 1.05, 8),
        woodThatchMat
      );
      firewoodLog.rotation.z = Math.PI / 2;
      firewoodLog.position.set(10.65, 5.98 + logRow * 0.16, 0.35 + logCol * 0.2 + (logRow % 2) * 0.08);
      addCuChiMesh(firewoodLog, 2);
    }

    // Đường ống / rãnh đất dẫn khói chạy ngang từ bếp vào bầu tản nhiệt nối lên ụ mối trên mặt đất
    const sideSmokeFlueCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(10.25, 6.38, 2.6),
      new THREE.Vector3(9.65, 6.85, 1.55),
      new THREE.Vector3(9.65, 7.65, 0.65),
      new THREE.Vector3(9.65, 8.85, 1.45),
      new THREE.Vector3(9.6, 9.95, 2.2),
    ]);
    const sideSmokeFlueGeo = new THREE.TubeGeometry(sideSmokeFlueCurve, 24, 0.2, 10, false);
    const sideSmokeFlueMesh = new THREE.Mesh(sideSmokeFlueGeo, terracottaJarMat);
    addCuChiMesh(sideSmokeFlueMesh, 2);
    // 2 Bầu đất tản nhiệt làm nguội khói trước khi thoát lên ụ mối trên rừng
    for (const [bx, by, bz] of [
      [9.65, 6.92, 1.45],
      [9.65, 7.82, 0.78],
    ]) {
      const sideSmokeChamber = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), terracottaJarMat);
      sideSmokeChamber.scale.set(0.95, 0.82, 1.25);
      sideSmokeChamber.position.set(bx, by, bz);
      addCuChiMesh(sideSmokeChamber, 2);
    }

    // Bàn gỗ nhỏ (z = +5.35, x = 10.75) bày bát đĩa sứ và bi đông nước quân đội
    addCuChiBox(1.15, 0.68, 1.65, woodThatchMat, 10.75, 6.18, 5.35, 2);
    addCuChiBox(1.22, 0.08, 1.72, woodThatchMat, 10.75, 6.54, 5.35, 2);
    // Bát ăn cơm & đĩa sứ trắng ngà trên bàn
    for (const [dishX, dishZ] of [
      [10.55, 4.85],
      [10.95, 4.95],
      [10.55, 5.35],
      [10.95, 5.45],
    ]) {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.08, 0.1, 12), medicalClothMat);
      bowl.position.set(dishX, 6.63, dishZ);
      addCuChiMesh(bowl, 2);
    }
    // 2 Bi đông nước màu xanh quân đội đặt trên bàn
    for (const cantZ of [5.82, 6.02]) {
      const canteen = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), canopyBrightMat);
      canteen.scale.set(0.72, 1.25, 0.95);
      canteen.position.set(10.8, 6.68, cantZ);
      addCuChiMesh(canteen, 2);
      const canteenCap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), castIronPotMat);
      canteenCap.position.set(10.8, 6.86, cantZ);
      addCuChiMesh(canteenCap, 2);
    }

    // 4B) KHOANG BÊN PHẢI TẦNG 1 (cz = -7.5, z từ -11.5 đến -3.5, rộng 8.0, cao 2.6, sâu 4.0)
    //     Hầm Chiến Đấu & Nút Chặn Chống Độc / Bẫy Chông
    buildRecessedBunkerChamber(10.9, 5.8, -7.5, 8.0, 2.6, 4.0, 'right', 2, true);
    addWarmBunkerLight(11.1, 8.0, -7.5, 2, 1.8, 8.0);
    // PointLight(0xffaa44, 1.4, 7) chiếu sáng khoang chiến đấu
    addCustomChamberPointLight(0xffaa44, 1.4, 7.0, 11.4, 7.45, -7.5, 2);

    // Công sự lỗ châu mai hướng lên mặt đất ở phía phải khoang (z = -9.9 đến -11.2)
    // Bục đất chiến đấu & bao cát công sự + khe bắn vát nghiêng hướng lên mặt rừng
    addCuChiBox(1.85, 0.65, 1.75, clayUpperMat, 10.65, 6.18, -10.2, 2);
    addCuChiBox(1.75, 0.45, 1.25, clayUpperMat, 10.65, 6.72, -10.45, 2);
    // Các bao cát xếp chắn trước bệ bắn lỗ châu mai
    for (let sb = 0; sb < 4; sb++) {
      const sandbag = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), burlapSackMat);
      sandbag.scale.set(0.85, 0.45, 1.35);
      sandbag.position.set(10.4 + (sb % 2) * 0.55, 7.08 + Math.floor(sb / 2) * 0.24, -10.35);
      addCuChiMesh(sandbag, 2);
    }
    // Ống khe bắn lỗ châu mai xuyên chéo từ trần công sự lên mặt đất
    const embrasureChute = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.55, 2.35), tunnelInteriorMat);
    embrasureChute.rotation.x = -0.58;
    embrasureChute.position.set(10.75, 8.15, -10.55);
    addCuChiMesh(embrasureChute, 2);

    // Giá súng gỗ dựng 4 khẩu súng trường 3D (BoxGeometry báng gỗ + CylinderGeometry nòng súng thép) tại z = -7.6
    addCuChiBox(0.65, 0.12, 1.95, woodThatchMat, 9.55, 5.95, -7.6, 2); // Đế giá súng
    addCuChiBox(0.12, 1.45, 0.12, woodThatchMat, 9.55, 6.65, -8.48, 2); // Trụ trái giá súng
    addCuChiBox(0.12, 1.45, 0.12, woodThatchMat, 9.55, 6.65, -6.72, 2); // Trụ phải giá súng
    addCuChiBox(0.16, 0.1, 1.88, woodThatchMat, 9.55, 7.12, -7.6, 2);  // Thanh đỡ nòng súng
    for (const rifleZ of [-8.22, -7.8, -7.38, -6.96]) {
      // Báng súng gỗ
      const rifleStock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.58, 0.08), woodThatchMat);
      rifleStock.rotation.z = -0.14;
      rifleStock.position.set(9.62, 6.28, rifleZ);
      addCuChiMesh(rifleStock, 2);
      // Thân hộp khóa nòng & băng đạn cong
      addCuChiBox(0.16, 0.42, 0.07, castIronPotMat, 9.56, 6.72, rifleZ, 2);
      const rifleMag = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.05), castIronPotMat);
      rifleMag.rotation.z = 0.35;
      rifleMag.position.set(9.68, 6.74, rifleZ);
      addCuChiMesh(rifleMag, 2);
      // Nòng súng trường bằng thép đen
      const rifleBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.95, 10), castIronPotMat);
      rifleBarrel.rotation.z = -0.1;
      rifleBarrel.position.set(9.5, 7.32, rifleZ);
      addCuChiMesh(rifleBarrel, 2);
    }

    // Các hòm đạn gỗ màu xanh quân đội (ordnanceMetalMat) xếp cạnh giá súng (z = -5.85)
    addCuChiBox(1.05, 0.48, 1.35, ordnanceMetalMat, 10.75, 6.12, -5.85, 2);
    addCuChiBox(1.08, 0.08, 1.38, woodThatchMat, 10.75, 6.38, -5.85, 2); // Nắp đai gỗ hòm đạn
    addCuChiBox(0.92, 0.44, 1.18, ordnanceMetalMat, 10.72, 6.62, -5.9, 2);
    addCuChiBox(0.85, 0.38, 0.95, woodThatchMat, 10.7, 7.02, -5.95, 2);

    // Nắp hầm chữ Z có chốt gỗ chống lựu đạn / khí độc & hố bẫy chông ở cửa ngách trái (z = -4.15)
    addCuChiBox(1.65, 2.45, 0.38, clayUpperMat, 10.2, 7.08, -4.15, 2); // Vách đất zích-zắc chữ Z
    const zTrapDoor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.44, 0.42, 4),
      woodThatchMat
    );
    zTrapDoor.rotation.x = Math.PI / 2;
    zTrapDoor.rotation.z = Math.PI / 4;
    zTrapDoor.position.set(11.35, 6.55, -3.72);
    addCuChiMesh(zTrapDoor, 2);
    // Thanh chốt gỗ ngang khóa chặt nắp hầm chống độc
    addCuChiBox(0.95, 0.14, 0.14, woodThatchMat, 11.35, 6.55, -3.96, 2);
    addCuChiBox(0.16, 0.36, 0.16, woodThatchMat, 10.95, 6.55, -3.96, 2);
    addCuChiBox(0.16, 0.36, 0.16, woodThatchMat, 11.75, 6.55, -3.96, 2);
    // Hố bẫy chông nhỏ dưới sàn ngay sau cửa ngách chữ Z để chặn địch đột nhập
    addCuChiBox(0.85, 0.18, 0.85, castIronPotMat, 11.35, 5.88, -4.45, 2);
    for (let sp = 0; sp < 6; sp++) {
      const trapSpike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.32, 6), bambooCulmMat);
      trapSpike.position.set(11.12 + (sp % 3) * 0.22, 6.02, -4.58 + Math.floor(sp / 3) * 0.26);
      addCuChiMesh(trapSpike, 2);
    }


    // =========================================================================
    // 4. TẦNG TRÊN MẶT ĐẤT (y = +10.0 — RỪNG CỦ CHI, HỐ BOM, LÁN LÁ, 3 Ụ MỐI THÔNG HƠI,
    //    CỬA HẦM BÍ MẬT & HẦM CHÔNG TRE — tier = 3)
    // =========================================================================
    // Thảm nền đất rừng chính tại y = +10.02 (26 x 0.24 x 26)
    const topForestBase = new THREE.Mesh(new THREE.BoxGeometry(26.0, 0.24, 26.0), forestGrassMat);
    topForestBase.position.set(0, 10.02, 0);
    addCuChiMesh(topForestBase, 3, true);

    // Các gò đất nhấp nhô tự nhiên bằng forestGrassMat trên mặt rừng
    const terrainMounds: Array<[number, number, number, number, number]> = [
      [-8.5, -7.5, 4.8, 0.55, 4.2],
      [7.2, -8.2, 5.2, 0.65, 4.5],
      [-9.2, 2.4, 4.0, 0.48, 3.8],
      [8.2, 3.5, 4.2, 0.52, 4.0],
      [-2.5, -8.8, 5.5, 0.58, 3.6],
    ];
    for (const [mx, mz, rx, ry, rz] of terrainMounds) {
      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        forestGrassMat
      );
      mound.scale.set(rx, ry, rz);
      mound.position.set(mx, 10.08, mz);
      addCuChiMesh(mound, 3, true);
    }

    // Lối mòn đất vàng uốn lượn (#b5732a) chạy xuyên qua khu rừng
    const trailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-11.5, 10.12, -9.5),
      new THREE.Vector3(-4.5, 10.12, -3.5),
      new THREE.Vector3(0.8, 10.12, 2.2),
      new THREE.Vector3(4.5, 10.12, 8.8),
    ]);
    const trailGeo = new THREE.TubeGeometry(trailCurve, 32, 0.95, 8, false);
    const trailMesh = new THREE.Mesh(trailGeo, craterSoilMat);
    trailMesh.scale.set(1, 0.08, 1);
    trailMesh.position.y = 9.28;
    addCuChiMesh(trailMesh, 3, true);

    // 2 HỐ BOM B-52 LÕM XUỐNG MÀU ĐẤT VÀNG SẪM (#b5732a) TẠI (-5.2, 10.0, 4.2) & (5.4, 10.0, -4.6)
    const buildBombCrater = (cx: number, cz: number, radius: number) => {
      // Vành đất văng gồ lên quanh miệng hố bom
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(radius, radius * 0.22, 12, 28),
        craterSoilMat
      );
      rim.rotation.x = Math.PI / 2;
      rim.scale.set(1, 1, 0.42);
      rim.position.set(cx, 10.16, cz);
      addCuChiMesh(rim, 3);

      // Lòng hố bom lõm bậc thang màu đất vàng sẫm (#b5732a) và đáy đất cháy sẫm (#6e2811)
      const bowlOuter = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.92, radius * 0.52, 0.36, 24),
        craterSoilMat
      );
      bowlOuter.position.set(cx, 10.04, cz);
      addCuChiMesh(bowlOuter, 3);

      const bowlInner = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.56, radius * 0.38, 0.42, 20),
        lateriteDeepMat
      );
      bowlInner.position.set(cx, 10.08, cz);
      addCuChiMesh(bowlInner, 3);

      // Gốc cây gãy cháy xém bên miệng hố bom
      const charredStump = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.28, 0.85, 7),
        tunnelInteriorMat
      );
      charredStump.position.set(cx + radius * 0.82, 10.45, cz - radius * 0.35);
      charredStump.rotation.z = -0.28;
      addCuChiMesh(charredStump, 3);
    };
    buildBombCrater(-5.2, 4.2, 2.55);
    buildBombCrater(5.4, -4.6, 2.25);

    // ĐIỂM NHẤN 1: LÁN CHỮ A NỬA CHÌM NỬA NỔI (Bếp Hoàng Cầm / Nhà lá ngụy trang) tại (-0.6, 10.0, -1.8)
    const hutX = -0.6;
    const hutZ = -1.8;
    // Nền lán đào âm xuống mặt đất 1 nửa
    addCuChiBox(4.2, 0.35, 3.6, tunnelInteriorMat, hutX, 10.06, hutZ, 3);
    // Hệ khung kèo gỗ chữ A (#6b4423)
    for (const fz of [hutZ - 1.4, hutZ, hutZ + 1.4]) {
      const rafterL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.65, 0.16), woodThatchMat);
      rafterL.position.set(hutX - 0.95, 10.95, fz);
      rafterL.rotation.z = -0.62;
      addCuChiMesh(rafterL, 3);

      const rafterR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.65, 0.16), woodThatchMat);
      rafterR.position.set(hutX + 0.95, 10.95, fz);
      rafterR.rotation.z = 0.62;
      addCuChiMesh(rafterR, 3);
    }
    // Đòn dông nóc lán & 2 mặt mái lợp lá tranh khô (#8c6d3b)
    addCuChiBox(0.18, 0.18, 3.6, woodThatchMat, hutX, 11.92, hutZ, 3);
    const roofSlopeL = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.18, 3.75), thatchRoofMat);
    roofSlopeL.position.set(hutX - 0.98, 11.08, hutZ);
    roofSlopeL.rotation.z = 0.68;
    addCuChiMesh(roofSlopeL, 3);

    const roofSlopeR = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.18, 3.75), thatchRoofMat);
    roofSlopeR.position.set(hutX + 0.98, 11.08, hutZ);
    roofSlopeR.rotation.z = -0.68;
    addCuChiMesh(roofSlopeR, 3);

    // ĐIỂM NHẤN 2: 3 Ụ MỐI NGỤY TRANG ỐNG THÔNG HƠI (Camouflaged Termite Mounds)
    // Hình nón đất gồ ghề màu cam đất sét nằm dưới gốc cây, có ống thông khí nối xuyên xuống Tầng 1
    const termiteMoundCoords: Array<[number, number]> = [
      [-7.4, -2.4],
      [3.8, 6.2],
      [9.6, 2.2],
    ];
    for (const [tx, tz] of termiteMoundCoords) {
      // Thân ụ mối chính & 2 chóp phụ gồ ghề bằng đất sét đỏ cam (#b85228)
      const mainCone = new THREE.Mesh(new THREE.ConeGeometry(0.78, 1.35, 9), clayUpperMat);
      mainCone.position.set(tx, 10.72, tz);
      addCuChiMesh(mainCone, 3);

      const subCone1 = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.88, 8), clayMidMat);
      subCone1.position.set(tx + 0.42, 10.48, tz - 0.25);
      subCone1.rotation.z = -0.18;
      addCuChiMesh(subCone1, 3);

      const subCone2 = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.76, 8), clayUpperMat);
      subCone2.position.set(tx - 0.36, 10.42, tz + 0.28);
      subCone2.rotation.z = 0.16;
      addCuChiMesh(subCone2, 3);

      // Ống thông khí ngầm nối xuyên từ đỉnh ụ mối xuống trần Tầng 1 (y từ +8.2 đến +11.1)
      const airPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.8, 10), tunnelInteriorMat);
      airPipe.position.set(tx, 9.65, tz);
      addCuChiMesh(airPipe, 2);
    }

    // ĐIỂM NHẤN 3: 1 CỬA HẦM BÍ MẬT (Secret Trapdoor) tại (-9.8, 10.15, 10.8)
    // Có nắp gỗ ngụy trang lá khô đang mở hé kèm thang gỗ đi xuống Tầng 1
    addCuChiBox(1.55, 0.16, 1.55, woodThatchMat, -9.8, 10.16, 10.8, 3);
    addCuChiBox(1.22, 0.18, 1.22, tunnelInteriorMat, -9.8, 10.17, 10.8, 3);
    // Nắp hầm gỗ ngụy trang lá khô đang mở nghiêng 55 độ
    const trapdoorLid = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.14, 1.28), woodThatchMat);
    trapdoorLid.position.set(-10.35, 10.68, 10.8);
    trapdoorLid.rotation.z = 0.95;
    addCuChiMesh(trapdoorLid, 3);
    const trapdoorCamo = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.08, 1.24), thatchRoofMat);
    trapdoorCamo.position.set(-10.28, 10.72, 10.8);
    trapdoorCamo.rotation.z = 0.95;
    addCuChiMesh(trapdoorCamo, 3);

    // ĐIỂM NHẤN 4: 1 HẦM CHÔNG TRE (Punji Stake Trap) có nắp lật bên cạnh lối mòn tại (1.8, 10.15, 6.8)
    addCuChiBox(2.1, 0.22, 1.5, tunnelInteriorMat, 1.8, 10.12, 6.8, 3);
    addCuChiBox(2.28, 0.14, 1.68, woodThatchMat, 1.8, 10.14, 6.8, 3);
    // Các mũi chông tre nhọn hoắt cắm dày đặc dưới đáy hố bẫy
    for (let sx = -0.7; sx <= 0.71; sx += 0.35) {
      for (let sz = -0.4; sz <= 0.41; sz += 0.4) {
        const stake = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.52, 6), thatchRoofMat);
        stake.position.set(1.8 + sx, 10.36, 6.8 + sz);
        addCuChiMesh(stake, 3);
      }
    }
    // Nắp lật ngụy trang cỏ khô xoay trục ở miệng hầm chông
    const flipTrapCover = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.08, 1.35), thatchRoofMat);
    flipTrapCover.position.set(1.8, 10.52, 6.35);
    flipTrapCover.rotation.x = 0.72;
    addCuChiMesh(flipTrapCover, 3);

    // RỪNG CÂY NHIỆT ĐỚI & KHÓM TRE CỦ CHI (20 thân cây gỗ cao thấp đa dạng + tán lá vát khối tự nhiên + 5 khóm tre)
    const buildCuChiForestTree = (tx: number, tz: number, scale: number, leanX: number, leanZ: number) => {
      // Gốc cây bạnh & thân cây gỗ nâu sẫm uốn nhẹ (2 đoạn CylinderGeometry nối nhau)
      const lowerH = 2.1 * scale;
      const upperH = 1.9 * scale;
      const trunk1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22 * scale, 0.38 * scale, lowerH, 7),
        treeTrunkMat
      );
      trunk1.position.set(tx, 10.1 + lowerH / 2, tz);
      trunk1.rotation.set(leanZ * 0.4, 0, leanX * 0.4);
      addCuChiMesh(trunk1, 3);

      const top1X = tx - Math.sin(leanX * 0.4) * lowerH * 0.5;
      const top1Y = 10.1 + lowerH * 0.95;
      const top1Z = tz + Math.sin(leanZ * 0.4) * lowerH * 0.5;

      const trunk2 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14 * scale, 0.22 * scale, upperH, 7),
        treeTrunkMat
      );
      trunk2.position.set(top1X, top1Y + upperH / 2, top1Z);
      trunk2.rotation.set(leanZ * 0.85, 0, leanX * 0.85);
      addCuChiMesh(trunk2, 3);

      // 2 Cành nhánh vươn ra đỡ tán lá
      for (const bDir of [-1, 1]) {
        const branch = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07 * scale, 0.12 * scale, 1.25 * scale, 6),
          treeTrunkMat
        );
        branch.position.set(top1X + bDir * 0.42 * scale, top1Y + upperH * 0.65, top1Z + bDir * 0.2 * scale);
        branch.rotation.z = -bDir * 0.62;
        addCuChiMesh(branch, 3);
      }

      // Tán lá xanh nhiều lớp bằng DodecahedronGeometry vát khối tự nhiên (#2e5921 và #437329)
      const crownCenterY = top1Y + upperH;
      const leafClusters: Array<[number, number, number, number, number, number, boolean]> = [
        [0, 0.2, 0, 1.45, 0.72, 1.35, false],
        [-0.85, -0.15, 0.35, 1.15, 0.68, 1.1, true],
        [0.88, -0.1, -0.3, 1.18, 0.65, 1.12, false],
        [0.15, 0.68, 0.25, 1.05, 0.66, 1.02, true],
        [-0.3, 0.55, -0.45, 0.98, 0.62, 0.95, true],
      ];
      for (const [lx, ly, lz, sx, sy, sz, isBright] of leafClusters) {
        const leafGeo = new THREE.DodecahedronGeometry(scale, 1);
        const leafMesh = new THREE.Mesh(leafGeo, isBright ? canopyBrightMat : canopyDarkMat);
        leafMesh.scale.set(sx, sy, sz);
        leafMesh.position.set(
          top1X + lx * scale,
          crownCenterY + ly * scale,
          top1Z + lz * scale
        );
        leafMesh.rotation.set(lx * 0.5, ly * 0.8, lz * 0.5);
        addCuChiMesh(leafMesh, 3);
      }
    };

    // 20 Cây rừng nhiệt đới phân bố tự nhiên trên mặt đất (chừa thoáng mặt cắt phía trước +Z và bên phải +X)
    const treePlacements: Array<[number, number, number, number, number]> = [
      [-10.8, -10.5, 1.25, 0.08, 0.06],
      [-6.5, -10.8, 1.05, -0.06, 0.08],
      [-1.8, -10.6, 1.32, 0.05, -0.07],
      [3.2, -10.8, 1.12, -0.09, 0.05],
      [8.5, -10.4, 1.22, 0.07, 0.06],
      [-11.2, -5.2, 1.18, 0.09, -0.05],
      [-8.2, -4.2, 0.96, -0.07, 0.08],
      [-3.8, -5.6, 1.28, 0.06, 0.06],
      [1.8, -6.2, 1.08, -0.08, -0.06],
      [9.4, -5.8, 1.15, 0.07, 0.05],
      [-11.0, 0.5, 1.22, -0.06, 0.07],
      [-6.2, -0.6, 1.04, 0.08, -0.05],
      [3.4, -0.4, 1.16, -0.05, 0.08],
      [8.8, -0.8, 1.02, 0.07, -0.06],
      [-11.4, 5.8, 1.14, 0.06, 0.07],
      [-8.6, 7.2, 0.94, -0.08, 0.05],
      [-1.2, 5.6, 1.1, 0.05, -0.07],
      [5.6, 3.8, 1.06, -0.07, 0.06],
      [9.8, 5.4, 0.95, 0.08, 0.05],
      [-4.2, 9.2, 0.88, -0.06, 0.06],
    ];
    for (const [tx, tz, sc, lx, lz] of treePlacements) {
      buildCuChiForestTree(tx, tz, sc, lx, lz);
    }

    // 5 Khóm tre rừng Củ Chi (Bamboo groves) xanh mướt
    const bambooClusters: Array<[number, number]> = [
      [-9.5, -7.8],
      [-4.6, -1.8],
      [2.2, -2.8],
      [6.8, 0.8],
      [-6.8, 8.8],
    ];
    for (const [bx, bz] of bambooClusters) {
      for (let c = 0; c < 6; c++) {
        const ang = (c / 6) * Math.PI * 2;
        const culmH = 3.2 + (c % 3) * 0.55;
        const culm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, culmH, 6), bambooCulmMat);
        culm.position.set(bx + Math.cos(ang) * 0.32, 10.1 + culmH / 2, bz + Math.sin(ang) * 0.32);
        culm.rotation.set(Math.sin(ang) * 0.16, 0, -Math.cos(ang) * 0.16);
        addCuChiMesh(culm, 3);

        const tuft = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), canopyBrightMat);
        tuft.scale.set(1.2, 0.55, 1.2);
        tuft.position.set(bx + Math.cos(ang) * 0.62, 10.1 + culmH, bz + Math.sin(ang) * 0.62);
        addCuChiMesh(tuft, 3);
      }
    }

    return null;

  } else if (siteId === 'HCM-DT-006') {
    // =========================================================================
    // BẢO TÀNG LỊCH SỬ THÀNH PHỐ HỒ CHÍ MINH (QUẬN 1)
    // KIẾN TRÚC ĐÔNG DƯƠNG (INDOCHINE 1929) — KTS AUGUSTE DELAVAL
    // ĐỐI XỨNG TUYỆT ĐỐI QUA TRỤC X = 0 (X TỪ -19.2 ĐẾN +19.2)
    // =========================================================================

    // -------------------------------------------------------------------------
    // 1. BỆ ĐÁ SÂN BẢO TÀNG & CHẤT LIỆU PBR CỔ KÍNH (CanvasTexture)
    // -------------------------------------------------------------------------
    const createMuseumCourtyardStoneTex = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = 512;
      bumpCanvas.height = 512;
      const bCtx = bumpCanvas.getContext('2d');

      if (ctx && bCtx) {
        // Nền xám đá cổ kính (#76787a)
        ctx.fillStyle = '#76787a';
        ctx.fillRect(0, 0, 512, 512);

        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, 512, 512);

        // Hạt nhám đá tự nhiên
        let seed = 192910;
        const rand = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };
        for (let i = 0; i < 6000; i++) {
          const rx = rand() * 512;
          const ry = rand() * 512;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
          ctx.fillRect(rx, ry, 2, 2);
        }

        // Kẻ ô gạch đá lớn
        const slab = 64;
        for (let y = 0; y < 512; y += slab) {
          for (let x = 0; x < 512; x += slab) {
            const offset = (y / slab) % 2 === 0 ? 0 : slab / 2;
            const sx = (x + offset) % 512;
            const shade = ((x + y) / slab) % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
            ctx.fillStyle = shade;
            ctx.fillRect(sx + 1, y + 1, slab - 2, slab - 2);
            ctx.strokeStyle = 'rgba(42, 44, 46, 0.45)';
            ctx.lineWidth = 2;
            ctx.strokeRect(sx, y, slab, slab);

            bCtx.strokeStyle = '#3a3a3a';
            bCtx.lineWidth = 2;
            bCtx.strokeRect(sx, y, slab, slab);
          }
        }
      }

      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(9, 5);

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(9, 5);

      return { map, bumpMap };
    };

    const createIndochineOchreWallTex = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = 512;
      bumpCanvas.height = 512;
      const bCtx = bumpCanvas.getContext('2d');

      if (ctx && bCtx) {
        // Tường vàng nghệ cổ điển (#d9b66c)
        ctx.fillStyle = '#d9b66c';
        ctx.fillRect(0, 0, 512, 512);

        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, 512, 512);

        let seed = 192920;
        const rand = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };

        // Hạt vữa mịn trầm ấm
        for (let i = 0; i < 9500; i++) {
          const rx = rand() * 512;
          const ry = rand() * 512;
          const sz = 1 + rand() * 2.2;
          const isWarm = i % 2 === 0;
          ctx.fillStyle = isWarm ? 'rgba(186, 146, 68, 0.22)' : 'rgba(238, 212, 152, 0.20)';
          ctx.fillRect(rx, ry, sz, sz);

          bCtx.fillStyle = isWarm ? '#6e6e6e' : '#929292';
          bCtx.fillRect(rx, ry, sz, sz);
        }
      }

      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(3, 2);

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(3, 2);

      return { map, bumpMap };
    };

    const createAgedTileRoofTex = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = 512;
      bumpCanvas.height = 512;
      const bCtx = bumpCanvas.getContext('2d');

      if (ctx && bCtx) {
        // Mái ngói ống âm dương cổ màu nâu đỏ đất nung sẫm (#632a1f)
        ctx.fillStyle = '#632a1f';
        ctx.fillRect(0, 0, 512, 512);

        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, 512, 512);

        // Sọc ngói ống chạy dọc rõ nét
        const tileW = 16;
        for (let x = 0; x < 512; x += tileW) {
          // Rãnh ngói âm tối (#431a12)
          ctx.fillStyle = '#431a12';
          ctx.fillRect(x, 0, 6, 512);

          // Thân ống ngói dương (#632a1f)
          ctx.fillStyle = '#632a1f';
          ctx.fillRect(x + 6, 0, 4, 512);

          // Sống ống ngói bắt sáng (#7d382b)
          ctx.fillStyle = '#7d382b';
          ctx.fillRect(x + 10, 0, 4, 512);

          // Viền bóng cạnh ống (#502017)
          ctx.fillStyle = '#502017';
          ctx.fillRect(x + 14, 0, 2, 512);

          bCtx.fillStyle = '#303030';
          bCtx.fillRect(x, 0, 6, 512);
          bCtx.fillStyle = '#dcdcdc';
          bCtx.fillRect(x + 8, 0, 6, 512);
        }

        // Khớp nối đốt ngói ống ngang
        for (let y = 0; y < 512; y += 28) {
          ctx.fillStyle = 'rgba(28, 10, 6, 0.45)';
          ctx.fillRect(0, y, 512, 3);
          ctx.fillStyle = 'rgba(155, 76, 58, 0.16)';
          ctx.fillRect(0, y + 3, 512, 2);

          bCtx.fillStyle = '#242424';
          bCtx.fillRect(0, y, 512, 3);
        }

        // Vết rêu phong cổ kính
        let seed = 192930;
        const rand = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };
        for (let i = 0; i < 4000; i++) {
          const rx = rand() * 512;
          const ry = rand() * 512;
          ctx.fillStyle = i % 3 === 0 ? 'rgba(45, 52, 36, 0.18)' : 'rgba(32, 12, 8, 0.18)';
          ctx.fillRect(rx, ry, 2.2, 2.2);
        }
      }

      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(5, 3);

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(5, 3);

      return { map, bumpMap };
    };

    const createMuseumSignPlaqueTex = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#2e1810';
        ctx.fillRect(0, 0, 512, 128);
        ctx.strokeStyle = '#c59b27';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, 496, 112);
        ctx.strokeStyle = '#e6dfd3';
        ctx.lineWidth = 2;
        ctx.strokeRect(16, 16, 480, 96);

        ctx.fillStyle = '#e8c468';
        ctx.font = 'bold 34px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BẢO TÀNG LỊCH SỬ', 256, 66);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    if (!landmarkTextureCache.has('museumCourtyardV2Tex')) {
      const t = createMuseumCourtyardStoneTex();
      t.map.userData = { isCached: true };
      t.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('museumCourtyardV2Tex', t);
    }
    if (!landmarkTextureCache.has('museumOchreV2Tex')) {
      const t = createIndochineOchreWallTex();
      t.map.userData = { isCached: true };
      t.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('museumOchreV2Tex', t);
    }
    if (!landmarkTextureCache.has('museumAgedRoofV2Tex')) {
      const t = createAgedTileRoofTex();
      t.map.userData = { isCached: true };
      t.bumpMap.userData = { isCached: true };
      landmarkTextureCache.set('museumAgedRoofV2Tex', t);
    }
    if (!landmarkTextureCache.has('museumSignPlaqueTex')) {
      const t = createMuseumSignPlaqueTex();
      t.userData = { isCached: true };
      landmarkTextureCache.set('museumSignPlaqueTex', t);
    }

    const courtyardTex = landmarkTextureCache.get('museumCourtyardV2Tex');
    const ochreWallTex = landmarkTextureCache.get('museumOchreV2Tex');
    const agedRoofTex = landmarkTextureCache.get('museumAgedRoofV2Tex');
    const signPlaqueTex = landmarkTextureCache.get('museumSignPlaqueTex');

    // 1) Tấm nền sân bảo tàng: màu xám đá (#76787a, roughness: 0.9, kẻ ô gạch đá lớn)
    const courtyardStoneMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: courtyardTex.map,
      bumpMap: courtyardTex.bumpMap,
      bumpScale: 0.025,
      roughness: 0.9,
      metalness: 0.02,
    });

    // 2) indochineOchreMat (Tường vàng nghệ cổ điển #d9b66c, roughness: 0.88)
    const indochineOchreMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: ochreWallTex.map,
      bumpMap: ochreWallTex.bumpMap,
      bumpScale: 0.02,
      roughness: 0.88,
      metalness: 0.02,
    });

    // 3) agedTileRoofMat (Mái ngói ống âm dương cổ #632a1f, roughness: 0.75)
    const agedTileRoofMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: agedRoofTex.map,
      bumpMap: agedRoofTex.bumpMap,
      bumpScale: 0.05,
      roughness: 0.75,
      metalness: 0.04,
    });

    // 4) ridgeDarkMat (Sống mái & viền mái màu xám nâu sẫm #362f2d, roughness: 0.8, thanh mảnh 0.12)
    const ridgeDarkMat = new THREE.MeshStandardMaterial({
      color: 0x362f2d,
      roughness: 0.8,
      metalness: 0.05,
    });

    // 5) darkTeakWoodMat (Cửa gỗ lim & lá sách màu nâu gụ sẫm #2e1810, roughness: 0.55)
    const darkTeakWoodMat = new THREE.MeshStandardMaterial({
      color: 0x2e1810,
      roughness: 0.55,
      metalness: 0.05,
    });

    // 6) ivoryStoneMat (Cột, lan can, chỉ phào, bậc tam cấp màu trắng ngà trầm #e6dfd3, roughness: 0.78)
    const ivoryStoneMat = new THREE.MeshStandardMaterial({
      color: 0xe6dfd3,
      bumpMap: ochreWallTex.bumpMap,
      bumpScale: 0.01,
      roughness: 0.78,
      metalness: 0.02,
    });

    // Đồng cổ cho bình hồ lô duy nhất trên đỉnh chóp và chi tiết bảng tên
    const antiqueBronzeMat = new THREE.MeshStandardMaterial({
      color: 0xb88c28,
      roughness: 0.38,
      metalness: 0.65,
    });

    // Hốc tối sâu phía sau cửa chớp và hiên sảnh tạo chiều sâu thật
    const deepShadowRecessMat = new THREE.MeshStandardMaterial({
      color: 0x160d09,
      roughness: 0.9,
      metalness: 0.05,
    });

    const signPlaqueMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: signPlaqueTex,
      roughness: 0.45,
      metalness: 0.15,
    });

    // Helper gắn đầy đủ mesh.userData.originalMaterial cho mọi Mesh
    const addMuseumMesh = (
      mesh: THREE.Mesh,
      tier: number,
      isGroundPart = false
    ) => {
      mesh.castShadow = !isGroundPart;
      mesh.receiveShadow = true;
      mesh.userData.elevationTier = tier;
      mesh.userData.origY = mesh.position.y;
      const m = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
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
        bumpScale: m.bumpScale !== undefined ? m.bumpScale : 0.02,
        roughnessMap: m.roughnessMap || null,
        roughness: m.roughness !== undefined ? m.roughness : 0.8,
        metalness: m.metalness !== undefined ? m.metalness : 0.03,
      };
      group.add(mesh);
      return mesh;
    };

    const addMuseumBox = (
      w: number,
      h: number,
      d: number,
      mat: THREE.MeshStandardMaterial,
      x: number,
      y: number,
      z: number,
      tier: number,
      isGroundPart = false
    ) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      return addMuseumMesh(m, tier, isGroundPart);
    };

    // Helper dựng Mái Dốc 4 Mặt Hình Chóp Cụt Chữ Nhật (BufferGeometry) với viền & sống mái tối màu thanh mảnh (0.12)
    const addFourSlopeHippedRoof = (
      bottomW: number,
      bottomD: number,
      topW: number,
      topD: number,
      height: number,
      cx: number,
      bottomY: number,
      cz: number,
      tier: number,
      ridgeAxis: 'x' | 'z' | 'none' = 'x'
    ) => {
      const hw0 = bottomW / 2;
      const hd0 = bottomD / 2;
      const hw1 = topW / 2;
      const hd1 = topD / 2;
      const h = height;

      const positions = new Float32Array([
        // Mặt dốc trước (+Z)
        -hw0, 0, hd0,   hw0, 0, hd0,   hw1, h, hd1,
        -hw0, 0, hd0,   hw1, h, hd1,  -hw1, h, hd1,
        // Mặt dốc sau (-Z)
         hw0, 0, -hd0, -hw0, 0, -hd0, -hw1, h, -hd1,
         hw0, 0, -hd0, -hw1, h, -hd1,  hw1, h, -hd1,
        // Mặt dốc phải (+X)
         hw0, 0, hd0,   hw0, 0, -hd0,  hw1, h, -hd1,
         hw0, 0, hd0,   hw1, h, -hd1,  hw1, h, hd1,
        // Mặt dốc trái (-X)
        -hw0, 0, -hd0, -hw0, 0, hd0,  -hw1, h, hd1,
        -hw0, 0, -hd0, -hw1, h, hd1,  -hw1, h, -hd1,
        // Nắp phẳng trên đỉnh
        -hw1, h, hd1,   hw1, h, hd1,   hw1, h, -hd1,
        -hw1, h, hd1,   hw1, h, -hd1, -hw1, h, -hd1,
        // Mặt đáy
        -hw0, 0, -hd0,  hw0, 0, -hd0,  hw0, 0, hd0,
        -hw0, 0, -hd0,  hw0, 0, hd0,  -hw0, 0, hd0,
      ]);

      const uScaleX = Math.max(1, Math.round(bottomW / 3.2));
      const uScaleZ = Math.max(1, Math.round(bottomD / 3.2));
      const uvs = new Float32Array([
        0, 0, uScaleX, 0, uScaleX * 0.85, 1, 0, 0, uScaleX * 0.85, 1, uScaleX * 0.15, 1,
        0, 0, uScaleX, 0, uScaleX * 0.85, 1, 0, 0, uScaleX * 0.85, 1, uScaleX * 0.15, 1,
        0, 0, uScaleZ, 0, uScaleZ * 0.85, 1, 0, 0, uScaleZ * 0.85, 1, uScaleZ * 0.15, 1,
        0, 0, uScaleZ, 0, uScaleZ * 0.85, 1, 0, 0, uScaleZ * 0.85, 1, uScaleZ * 0.15, 1,
        0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1,
        0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1,
      ]);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.computeVertexNormals();

      const roofMesh = new THREE.Mesh(geo, agedTileRoofMat);
      roofMesh.position.set(cx, bottomY, cz);
      addMuseumMesh(roofMesh, tier);

      // Viền diềm mái thanh mảnh 0.12 bằng ridgeDarkMat (#362f2d) — tuyệt đối không làm viền trắng dày cộp
      addMuseumBox(bottomW + 0.08, 0.12, 0.12, ridgeDarkMat, cx, bottomY + 0.06, cz + hd0, tier);
      addMuseumBox(bottomW + 0.08, 0.12, 0.12, ridgeDarkMat, cx, bottomY + 0.06, cz - hd0, tier);
      addMuseumBox(0.12, 0.12, bottomD + 0.08, ridgeDarkMat, cx + hw0, bottomY + 0.06, cz, tier);
      addMuseumBox(0.12, 0.12, bottomD + 0.08, ridgeDarkMat, cx - hw0, bottomY + 0.06, cz, tier);

      // Sống nóc thanh mảnh 0.12 bằng ridgeDarkMat
      if (ridgeAxis === 'x' && topW > 0.2) {
        addMuseumBox(topW + 0.12, 0.12, 0.12, ridgeDarkMat, cx, bottomY + h + 0.05, cz, tier);
      } else if (ridgeAxis === 'z' && topD > 0.2) {
        addMuseumBox(0.12, 0.12, topD + 0.12, ridgeDarkMat, cx, bottomY + h + 0.05, cz, tier);
      }
    };

    // Helper dựng Bộ Cửa Sổ Cao Lớn Chuẩn Tỷ Lệ Đông Dương (width = 1.3, height = 3.2, tâm tại y = 4.0):
    // Khung viền trắng ngà mảnh (0.12), bên trong là 2 cánh cửa chớp lá sách gỗ nâu sẫm (darkTeakWoodMat)
    // có các thanh nan ngang và ô thoáng kỷ hà phía trên, bên dưới bệ cửa có gờ đá và hàng con tiện nhỏ.
    const addTallIndochineShuttersWindow = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      facing: 'front' | 'back' | 'left' | 'right',
      tier: number,
      withBalustradeBelow = true
    ) => {
      const isZ = facing === 'front' || facing === 'back';
      const dir = facing === 'front' || facing === 'right' ? 1 : -1;
      const frameT = 0.12;

      if (isZ) {
        // Hốc cửa tối tạo chiều sâu
        addMuseumBox(w, h, 0.08, deepShadowRecessMat, x, y, z + dir * 0.02, tier);

        // Khung viền trắng ngà mảnh (0.12) gồm 2 thanh đứng + thanh đỉnh + thanh đáy
        addMuseumBox(frameT, h + frameT, 0.12, ivoryStoneMat, x - w / 2 - frameT / 2, y, z + dir * 0.04, tier);
        addMuseumBox(frameT, h + frameT, 0.12, ivoryStoneMat, x + w / 2 + frameT / 2, y, z + dir * 0.04, tier);
        addMuseumBox(w + frameT * 2, frameT, 0.14, ivoryStoneMat, x, y + h / 2 + frameT / 2, z + dir * 0.05, tier);
        addMuseumBox(w + frameT * 2 + 0.14, frameT, 0.2, ivoryStoneMat, x, y - h / 2 - frameT / 2, z + dir * 0.08, tier);

        // Mí che mưa mỏng kiểu Đông Dương phía trên cửa
        addMuseumBox(w + 0.36, 0.1, 0.26, ivoryStoneMat, x, y + h / 2 + frameT + 0.06, z + dir * 0.1, tier);

        // Chia chiều cao cửa: phần dưới 72% là 2 cánh cửa chớp lá sách gỗ, phần trên 28% là ô thoáng kỷ hà
        const transomBarY = y + h * 0.22;
        addMuseumBox(w, 0.08, 0.12, darkTeakWoodMat, x, transomBarY, z + dir * 0.06, tier);

        // 2 Cánh cửa chớp lá sách gỗ nâu sẫm (darkTeakWoodMat) mở/khép đối xứng
        const shutterH = transomBarY - (y - h / 2) - 0.06;
        const shutterY = y - h / 2 + shutterH / 2 + 0.02;
        const leafW = (w - 0.06) / 2;

        for (const leafSide of [-1, 1]) {
          const lx = x + leafSide * (leafW / 2 + 0.015);
          // Khung bao cánh cửa gỗ
          addMuseumBox(leafW, shutterH, 0.08, darkTeakWoodMat, lx, shutterY, z + dir * 0.06, tier);
          // Các thanh nan chớp lá sách ngang
          const numSlats = 9;
          const slatStep = (shutterH - 0.18) / numSlats;
          for (let s = 0; s < numSlats; s++) {
            const sy = shutterY - shutterH / 2 + 0.12 + s * slatStep;
            addMuseumBox(leafW - 0.08, 0.045, 0.11, darkTeakWoodMat, lx, sy, z + dir * 0.075, tier);
          }
        }

        // Ô thoáng kỷ hà phía trên (từ transomBarY đến đỉnh cửa)
        const transomH = y + h / 2 - transomBarY - 0.04;
        const transomY = transomBarY + transomH / 2 + 0.02;
        // Đố gỗ kỷ hà chữ nhật & chữ thập
        addMuseumBox(w, 0.05, 0.1, darkTeakWoodMat, x, transomY, z + dir * 0.06, tier);
        addMuseumBox(0.05, transomH, 0.1, darkTeakWoodMat, x, transomY, z + dir * 0.06, tier);
        addMuseumBox(w * 0.45, transomH * 0.55, 0.11, darkTeakWoodMat, x, transomY, z + dir * 0.065, tier);
        addMuseumBox(w * 0.28, transomH * 0.34, 0.12, ivoryStoneMat, x, transomY, z + dir * 0.07, tier);

        // Bên dưới bệ cửa có gờ đá và hàng con tiện nhỏ (y từ 1.65 đến 2.25)
        if (withBalustradeBelow) {
          const sillBottomY = y - h / 2 - frameT - 0.52;
          addMuseumBox(w + 0.24, 0.09, 0.16, ivoryStoneMat, x, sillBottomY, z + dir * 0.06, tier);
          const numBalusters = 5;
          const balSpacing = (w - 0.16) / (numBalusters - 1);
          for (let b = 0; b < numBalusters; b++) {
            const bx = x - (w - 0.16) / 2 + b * balSpacing;
            addMuseumBox(0.08, 0.42, 0.1, ivoryStoneMat, bx, sillBottomY + 0.25, z + dir * 0.05, tier);
          }
        }
      } else {
        // Mặt hông Trái / Phải (trục X)
        addMuseumBox(0.08, h, w, deepShadowRecessMat, x + dir * 0.02, y, z, tier);
        addMuseumBox(0.12, h + frameT, frameT, ivoryStoneMat, x + dir * 0.04, y, z - w / 2 - frameT / 2, tier);
        addMuseumBox(0.12, h + frameT, frameT, ivoryStoneMat, x + dir * 0.04, y, z + w / 2 + frameT / 2, tier);
        addMuseumBox(0.14, frameT, w + frameT * 2, ivoryStoneMat, x + dir * 0.05, y + h / 2 + frameT / 2, z, tier);
        addMuseumBox(0.2, frameT, w + frameT * 2 + 0.14, ivoryStoneMat, x + dir * 0.08, y - h / 2 - frameT / 2, z, tier);
        addMuseumBox(0.26, 0.1, w + 0.36, ivoryStoneMat, x + dir * 0.1, y + h / 2 + frameT + 0.06, z, tier);

        const transomBarY = y + h * 0.22;
        addMuseumBox(0.12, 0.08, w, darkTeakWoodMat, x + dir * 0.06, transomBarY, z, tier);

        const shutterH = transomBarY - (y - h / 2) - 0.06;
        const shutterY = y - h / 2 + shutterH / 2 + 0.02;
        const leafW = (w - 0.06) / 2;

        for (const leafSide of [-1, 1]) {
          const lz = z + leafSide * (leafW / 2 + 0.015);
          addMuseumBox(0.08, shutterH, leafW, darkTeakWoodMat, x + dir * 0.06, shutterY, lz, tier);
          const numSlats = 9;
          const slatStep = (shutterH - 0.18) / numSlats;
          for (let s = 0; s < numSlats; s++) {
            const sy = shutterY - shutterH / 2 + 0.12 + s * slatStep;
            addMuseumBox(0.11, 0.045, leafW - 0.08, darkTeakWoodMat, x + dir * 0.075, sy, lz, tier);
          }
        }

        const transomH = y + h / 2 - transomBarY - 0.04;
        const transomY = transomBarY + transomH / 2 + 0.02;
        addMuseumBox(0.1, 0.05, w, darkTeakWoodMat, x + dir * 0.06, transomY, z, tier);
        addMuseumBox(0.1, transomH, 0.05, darkTeakWoodMat, x + dir * 0.06, transomY, z, tier);
        addMuseumBox(0.11, transomH * 0.55, w * 0.45, darkTeakWoodMat, x + dir * 0.065, transomY, z, tier);

        if (withBalustradeBelow) {
          const sillBottomY = y - h / 2 - frameT - 0.52;
          addMuseumBox(0.16, 0.09, w + 0.24, ivoryStoneMat, x + dir * 0.06, sillBottomY, z, tier);
          const numBalusters = 5;
          const balSpacing = (w - 0.16) / (numBalusters - 1);
          for (let b = 0; b < numBalusters; b++) {
            const bz = z - (w - 0.16) / 2 + b * balSpacing;
            addMuseumBox(0.1, 0.42, 0.08, ivoryStoneMat, x + dir * 0.05, sillBottomY + 0.25, bz, tier);
          }
        }
      }
    };

    // -------------------------------------------------------------------------
    // TẤM NỀN SÂN BẢO TÀNG MỞ RỘNG VỀ PHÍA TRƯỚC (+Z THÊM 6 ĐƠN VỊ: width = 44, height = 0.3, depth = 32, tâm z = +3.0)
    // -------------------------------------------------------------------------
    addMuseumBox(44.0, 0.3, 32.0, courtyardStoneMat, 0, 0.15, 3.0, 0, true);
    // Viền đá bo gọn gàng quanh mép sân mở rộng (z từ -13.0 đến +19.0)
    addMuseumBox(44.2, 0.32, 0.24, ivoryStoneMat, 0, 0.16, 18.94, 0, true);
    addMuseumBox(44.2, 0.32, 0.24, ivoryStoneMat, 0, 0.16, -12.94, 0, true);
    addMuseumBox(0.24, 0.32, 32.0, ivoryStoneMat, -21.98, 0.16, 3.0, 0, true);
    addMuseumBox(0.24, 0.32, 32.0, ivoryStoneMat, 21.98, 0.16, 3.0, 0, true);

    // -------------------------------------------------------------------------
    // 2. THÁP BÁT GIÁC TRUNG TÂM 3 TẦNG MÁI (X = 0, Z = +1.0) — KHÔNG QUE CẮM
    // -------------------------------------------------------------------------
    const rotundaZ = 1.0;

    // Chân đế đá bát giác (y từ 0.3 đến 1.5)
    const octPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(5.0, 5.1, 1.2, 8),
      ivoryStoneMat
    );
    octPlinth.rotation.y = Math.PI / 8;
    octPlinth.position.set(0, 0.9, rotundaZ);
    addMuseumMesh(octPlinth, 0);

    // Thân bát giác chính: CylinderGeometry(4.8, 4.8, 6.5, 8) xoay Math.PI / 8, đặt từ y = 1.5 đến y = 8.0
    const octMainBody = new THREE.Mesh(
      new THREE.CylinderGeometry(4.8, 4.8, 6.5, 8),
      indochineOchreMat
    );
    octMainBody.rotation.y = Math.PI / 8;
    octMainBody.position.set(0, 4.75, rotundaZ);
    addMuseumMesh(octMainBody, 1);

    // Gờ chỉ phào ngang mảnh ở chân và đỉnh thân bát giác
    for (const ringY of [1.58, 7.88]) {
      const octRing = new THREE.Mesh(
        new THREE.CylinderGeometry(4.92, 4.92, 0.16, 8),
        ivoryStoneMat
      );
      octRing.rotation.y = Math.PI / 8;
      octRing.position.set(0, ringY, rotundaZ);
      addMuseumMesh(octRing, 1);
    }

    // Ở 8 góc có trụ cột nổi mảnh (ivoryStoneMat), trên các mặt lộ ra có cửa sổ gỗ lá sách cao
    const octApothem = 4.8 * Math.cos(Math.PI / 8); // ~4.435
    for (let i = 0; i < 8; i++) {
      const cornerAng = (i * Math.PI) / 4 + Math.PI / 8;
      const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.24, 6.4, 0.24), ivoryStoneMat);
      pilaster.position.set(
        Math.sin(cornerAng) * 4.76,
        4.75,
        rotundaZ + Math.cos(cornerAng) * 4.76
      );
      pilaster.rotation.y = cornerAng;
      addMuseumMesh(pilaster, 1);

      // Các mặt lộ ra của bát giác (trừ mặt trước i = 0 nối vào Sảnh chính và 2 mặt bên i = 2, 6 nối vào 2 Cánh)
      if (i !== 0 && i !== 2 && i !== 6) {
        const faceAng = (i * Math.PI) / 4;
        const fx = Math.sin(faceAng) * octApothem;
        const fz = rotundaZ + Math.cos(faceAng) * octApothem;

        const winFrame = new THREE.Mesh(new THREE.BoxGeometry(1.36, 3.2, 0.12), ivoryStoneMat);
        winFrame.position.set(fx, 4.4, fz);
        winFrame.rotation.y = faceAng;
        addMuseumMesh(winFrame, 1);

        const winShutters = new THREE.Mesh(new THREE.BoxGeometry(1.14, 2.96, 0.16), darkTeakWoodMat);
        winShutters.position.set(fx, 4.4, fz);
        winShutters.rotation.y = faceAng;
        addMuseumMesh(winShutters, 1);

        const winTransom = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.08, 0.18), ivoryStoneMat);
        winTransom.position.set(fx, 5.1, fz);
        winTransom.rotation.y = faceAng;
        addMuseumMesh(winTransom, 1);
      }

      // Hàng con sơn nhỏ đỡ diềm mái tầng 1 trên 8 mặt bát giác
      const faceAng = (i * Math.PI) / 4;
      const fx = Math.sin(faceAng) * octApothem;
      const fz = rotundaZ + Math.cos(faceAng) * octApothem;
      for (const tOff of [-1.1, 0, 1.1]) {
        const tx = Math.cos(faceAng) * tOff;
        const tz = -Math.sin(faceAng) * tOff;
        const corbel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.45), ivoryStoneMat);
        corbel.position.set(
          fx + tx + Math.sin(faceAng) * 0.18,
          7.76,
          fz + tz + Math.cos(faceAng) * 0.18
        );
        corbel.rotation.y = faceAng;
        addMuseumMesh(corbel, 1);
      }
    }

    // Hệ mái bát giác 3 tầng chồng diêm (agedTileRoofMat) — CẤM TUYỆT ĐỐI gắn que xung quanh 8 góc mái
    // + Tầng mái 1 (y = 8.0 đến 9.5): CylinderGeometry(3.6, 5.8, 1.5, 8) xoay Math.PI / 8
    const octRoofTier1 = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 5.8, 1.5, 8),
      agedTileRoofMat
    );
    octRoofTier1.rotation.y = Math.PI / 8;
    octRoofTier1.position.set(0, 8.75, rotundaZ);
    addMuseumMesh(octRoofTier1, 2);

    // Viền diềm mái mảnh màu tối dưới đáy tầng mái 1
    const octEave1 = new THREE.Mesh(
      new THREE.CylinderGeometry(5.82, 5.84, 0.12, 8),
      ridgeDarkMat
    );
    octEave1.rotation.y = Math.PI / 8;
    octEave1.position.set(0, 8.06, rotundaZ);
    addMuseumMesh(octEave1, 2);

    // + Cổ diêm 1 (y = 9.5 đến 10.8): Thân bát giác radius = 3.5 màu vàng indochineOchreMat, mỗi mặt có 2 ô cửa sổ nhỏ màu nâu gỗ
    const octNeck1 = new THREE.Mesh(
      new THREE.CylinderGeometry(3.5, 3.5, 1.3, 8),
      indochineOchreMat
    );
    octNeck1.rotation.y = Math.PI / 8;
    octNeck1.position.set(0, 10.15, rotundaZ);
    addMuseumMesh(octNeck1, 2);

    const apothemNeck1 = 3.5 * Math.cos(Math.PI / 8); // ~3.233
    for (let i = 0; i < 8; i++) {
      const faceAng = (i * Math.PI) / 4;
      const fx = Math.sin(faceAng) * apothemNeck1;
      const fz = rotundaZ + Math.cos(faceAng) * apothemNeck1;

      // Mỗi mặt có 2 ô cửa sổ nhỏ màu nâu gỗ
      for (const wOff of [-0.52, 0.52]) {
        const tx = Math.cos(faceAng) * wOff;
        const tz = -Math.sin(faceAng) * wOff;

        const smallWinFrame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.1), ivoryStoneMat);
        smallWinFrame.position.set(fx + tx, 10.15, fz + tz);
        smallWinFrame.rotation.y = faceAng;
        addMuseumMesh(smallWinFrame, 2);

        const smallWinWood = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.6, 0.13), darkTeakWoodMat);
        smallWinWood.position.set(fx + tx, 10.15, fz + tz);
        smallWinWood.rotation.y = faceAng;
        addMuseumMesh(smallWinWood, 2);
      }
    }

    // + Tầng mái 2 (y = 10.8 đến 12.1): CylinderGeometry(2.3, 4.3, 1.3, 8) xoay Math.PI / 8
    const octRoofTier2 = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 4.3, 1.3, 8),
      agedTileRoofMat
    );
    octRoofTier2.rotation.y = Math.PI / 8;
    octRoofTier2.position.set(0, 11.45, rotundaZ);
    addMuseumMesh(octRoofTier2, 2);

    const octEave2 = new THREE.Mesh(
      new THREE.CylinderGeometry(4.32, 4.34, 0.12, 8),
      ridgeDarkMat
    );
    octEave2.rotation.y = Math.PI / 8;
    octEave2.position.set(0, 10.86, rotundaZ);
    addMuseumMesh(octEave2, 2);

    // + Cổ diêm 2 (y = 12.1 đến 13.0): Thân bát giác radius = 2.2, có ô thông gió nhỏ
    const octNeck2 = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 0.9, 8),
      indochineOchreMat
    );
    octNeck2.rotation.y = Math.PI / 8;
    octNeck2.position.set(0, 12.55, rotundaZ);
    addMuseumMesh(octNeck2, 3);

    const apothemNeck2 = 2.2 * Math.cos(Math.PI / 8); // ~2.032
    for (let i = 0; i < 8; i++) {
      const faceAng = (i * Math.PI) / 4;
      const fx = Math.sin(faceAng) * apothemNeck2;
      const fz = rotundaZ + Math.cos(faceAng) * apothemNeck2;

      const ventMesh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.42, 0.12), darkTeakWoodMat);
      ventMesh.position.set(fx, 12.55, fz);
      ventMesh.rotation.y = faceAng;
      addMuseumMesh(ventMesh, 3);
    }

    // + Tầng mái 3 chóp đỉnh (y = 13.0 đến 14.6): ConeGeometry(3.0, 1.6, 8) xoay Math.PI / 8
    const octRoofTier3 = new THREE.Mesh(
      new THREE.ConeGeometry(3.0, 1.6, 8),
      agedTileRoofMat
    );
    octRoofTier3.rotation.y = Math.PI / 8;
    octRoofTier3.position.set(0, 13.8, rotundaZ);
    addMuseumMesh(octRoofTier3, 3);

    const octEave3 = new THREE.Mesh(
      new THREE.CylinderGeometry(3.02, 3.04, 0.12, 8),
      ridgeDarkMat
    );
    octEave3.rotation.y = Math.PI / 8;
    octEave3.position.set(0, 13.06, rotundaZ);
    addMuseumMesh(octEave3, 3);

    // Trên đỉnh chóp (y = 14.6) đặt DUY NHẤT 1 bình hồ lô đồng nhỏ gọn ở tâm (0, 14.6, 1.0)
    const gourdPedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.32, 0.16, 12),
      ridgeDarkMat
    );
    gourdPedestal.position.set(0, 14.6, rotundaZ);
    addMuseumMesh(gourdPedestal, 3);

    const gourdBelly1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 14, 12),
      antiqueBronzeMat
    );
    gourdBelly1.scale.set(1, 1.15, 1);
    gourdBelly1.position.set(0, 14.82, rotundaZ);
    addMuseumMesh(gourdBelly1, 3);

    const gourdBelly2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 14, 12),
      antiqueBronzeMat
    );
    gourdBelly2.scale.set(1, 1.2, 1);
    gourdBelly2.position.set(0, 15.1, rotundaZ);
    addMuseumMesh(gourdBelly2, 3);

    // -------------------------------------------------------------------------
    // 3. SẢNH ĐÓN CHÍNH MỞ RỘNG & CÓ CHIỀU SÂU (X từ -3.8 đến +3.8, Z từ +4.5 đến +7.8)
    // -------------------------------------------------------------------------
    // Sàn hiên sảnh đón (x từ -3.8 đến +3.8, z từ +4.5 đến +7.8, y từ 0.3 đến 1.5)
    addMuseumBox(7.6, 1.2, 3.3, ivoryStoneMat, 0, 0.9, 6.15, 0);
    // Mặt sàn đá sảnh tối nhẹ tạo chiều sâu
    addMuseumBox(7.2, 0.06, 3.1, courtyardStoneMat, 0, 1.51, 6.15, 0);

    // Bậc tam cấp đá (z từ +7.8 ra +10.5): 9 bậc thang đá (ivoryStoneMat) dẫn từ sân (y = 0.3) lên sàn sảnh (y = 1.5)
    const numSteps = 9;
    const totalStepRise = 1.2; // từ 0.3 lên 1.5
    const totalStepRun = 2.7;  // từ 7.8 ra 10.5
    const stepRise = totalStepRise / numSteps;
    const stepRun = totalStepRun / numSteps;

    for (let s = 0; s < numSteps; s++) {
      const h = stepRise * (numSteps - s);
      const zCenter = 7.8 + (s + 0.5) * stepRun;
      addMuseumBox(5.2, h, stepRun + 0.02, ivoryStoneMat, 0, 0.3 + h / 2, zCenter, 0);
    }

    // Hai bên bậc tam cấp có thành bậc đá chạm khắc (x = ±2.85, z từ +7.8 ra +10.5)
    for (const side of [-1, 1]) {
      const cheekX = side * 2.85;
      // Bệ dưới thành bậc
      addMuseumBox(0.46, 0.55, 2.75, ivoryStoneMat, cheekX, 0.58, 9.15, 0);
      // Sống thành bậc vát nghiêng theo độ dốc 9 bậc thang
      const slopedCheek = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 2.85), ivoryStoneMat);
      slopedCheek.position.set(cheekX, 1.05, 9.12);
      slopedCheek.rotation.x = Math.atan2(totalStepRise, totalStepRun);
      addMuseumMesh(slopedCheek, 0);

      // Trụ đá chạm khắc ở đầu bậc thang (z = +10.48) và đỉnh bậc thang (z = +7.82)
      addMuseumBox(0.56, 0.92, 0.56, ivoryStoneMat, cheekX, 0.76, 10.48, 0);
      addMuseumBox(0.44, 0.14, 0.44, ridgeDarkMat, cheekX, 1.25, 10.48, 0);
      addMuseumBox(0.54, 1.55, 0.54, ivoryStoneMat, cheekX, 1.08, 7.82, 0);
    }

    // Hiên sảnh mở có chiều sâu (y = 1.5 đến 5.2):
    // - Lùi vào bên trong (z = +5.2): Tường sảnh có 3 bộ Cửa Đại Khoa bằng gỗ lim (darkTeakWoodMat) cao lớn (height = 3.2)
    addMuseumBox(7.4, 3.9, 0.35, indochineOchreMat, 0, 3.45, 5.05, 1);
    // Hốc tối mặt trong hiên sảnh giúp tạo bóng đổ sâu thật phía sau 4 cột
    addMuseumBox(7.2, 3.6, 0.12, deepShadowRecessMat, 0, 3.35, 5.24, 1);

    // 3 bộ Cửa Đại Khoa bằng gỗ lim (darkTeakWoodMat) cao lớn (height = 3.2) tại x = -2.35, 0, +2.35, z = +5.2
    for (const doorInfo of [
      { dx: -2.35, dw: 1.55 },
      { dx: 0.0, dw: 1.95 },
      { dx: 2.35, dw: 1.55 },
    ]) {
      const { dx, dw } = doorInfo;
      const dh = 3.2;
      const dy = 1.5 + dh / 2; // y = 3.1

      // Khung đá trắng ngà bao quanh mỗi bộ Cửa Đại Khoa
      addMuseumBox(dw + 0.24, dh + 0.16, 0.14, ivoryStoneMat, dx, dy + 0.04, 5.26, 1);
      // Cánh cửa gỗ lim nâu gụ sẫm
      addMuseumBox(dw, dh, 0.14, darkTeakWoodMat, dx, dy, 5.3, 1);

      // Đố gỗ chạm ô vuông Á Đông trên 2 cánh cửa
      const halfW = (dw - 0.08) / 2;
      for (const leaf of [-1, 1]) {
        const lx = dx + leaf * (halfW / 2 + 0.02);
        // Viền khung cánh
        addMuseumBox(halfW - 0.04, dh - 0.12, 0.06, ivoryStoneMat, lx, dy, 5.35, 1);
        addMuseumBox(halfW - 0.14, dh - 0.24, 0.08, darkTeakWoodMat, lx, dy, 5.37, 1);

        // Lưới đố gỗ ô vuông Á Đông
        for (let r = -3; r <= 3; r++) {
          const ry = dy + r * 0.38;
          addMuseumBox(halfW - 0.12, 0.045, 0.11, darkTeakWoodMat, lx, ry, 5.39, 1);
        }
        addMuseumBox(0.045, dh - 0.24, 0.11, darkTeakWoodMat, lx, dy, 5.39, 1);
        // Họa tiết ô vuông đồng cổ ở tâm cánh cửa
        addMuseumBox(0.22, 0.22, 0.12, antiqueBronzeMat, lx, dy + 0.38, 5.4, 1);
      }
    }

    // Bảng tên "BẢO TÀNG LỊCH SỬ" phía trên cửa chính (y = 4.92, z = +5.35)
    addMuseumBox(3.4, 0.62, 0.14, ivoryStoneMat, 0, 4.92, 5.32, 1);
    addMuseumBox(3.18, 0.48, 0.16, signPlaqueMat, 0, 4.92, 5.35, 1);

    // - Phía trước hiên sảnh (z = +7.4): Dựng 4 cột vuông lớn (ivoryStoneMat, tại x = -3.4, -1.3, +1.3, +3.4)
    //   đỡ hệ khung dầm và các hàng con sơn / đấu củng gỗ nhiều tầng vươn ra phía trước
    for (const colX of [-3.4, -1.3, 1.3, 3.4]) {
      // Chân đế cột vuông
      addMuseumBox(0.58, 0.45, 0.58, ivoryStoneMat, colX, 1.72, 7.4, 1);
      // Thân cột vuông lớn (y từ 1.5 đến 4.85)
      addMuseumBox(0.44, 3.35, 0.44, ivoryStoneMat, colX, 3.18, 7.4, 1);
      // Cổ cột & Đầu cột
      addMuseumBox(0.56, 0.22, 0.56, ivoryStoneMat, colX, 4.78, 7.4, 1);

      // Hệ đấu củng / con sơn gỗ nhiều tầng trên đỉnh mỗi cột vươn ra phía trước và hai bên
      addMuseumBox(0.68, 0.16, 0.72, darkTeakWoodMat, colX, 4.94, 7.44, 1);
      addMuseumBox(0.86, 0.16, 0.94, darkTeakWoodMat, colX, 5.1, 7.5, 1);
      addMuseumBox(0.52, 0.14, 1.08, ivoryStoneMat, colX, 5.18, 7.54, 1);
    }

    // Lan can đá nối giữa 2 cột ngoài (x từ ±1.3 đến ±3.4 tại z = +7.4) tạo hành lang hiên sảnh thoáng đãng
    for (const side of [-1, 1]) {
      const railX = side * 2.35;
      addMuseumBox(1.65, 0.12, 0.24, ivoryStoneMat, railX, 2.28, 7.4, 1);
      addMuseumBox(1.65, 0.12, 0.26, ivoryStoneMat, railX, 1.62, 7.4, 1);
      for (const bOff of [-0.55, -0.18, 0.18, 0.55]) {
        addMuseumBox(0.1, 0.54, 0.12, ivoryStoneMat, railX + bOff, 1.95, 7.4, 1);
      }
    }

    // Hệ dầm ngang sảnh đón (architrave beam) tại y = 4.88 nối 4 cột vuông và ăn khớp vào tường trong
    addMuseumBox(7.5, 0.28, 0.42, ivoryStoneMat, 0, 4.88, 7.4, 1);
    addMuseumBox(0.38, 0.28, 2.4, ivoryStoneMat, -3.4, 4.88, 6.25, 1);
    addMuseumBox(0.38, 0.28, 2.4, ivoryStoneMat, 3.4, 4.88, 6.25, 1);
    // Trần hiên sảnh
    addMuseumBox(7.3, 0.14, 2.35, ivoryStoneMat, 0, 5.12, 6.25, 1);

    // Hàng con sơn / đấu củng gỗ nhiều tầng chạy dọc dưới diềm mái sảnh chính
    for (let cx = -3.0; cx <= 3.01; cx += 0.6) {
      addMuseumBox(0.16, 0.16, 0.58, darkTeakWoodMat, cx, 5.02, 7.52, 1);
      addMuseumBox(0.2, 0.15, 0.78, ivoryStoneMat, cx, 5.16, 7.62, 1);
    }

    // Mái hiên sảnh chính (y = 5.2 đến 6.8): Bộ mái ngói 2 tầng chồng diêm (agedTileRoofMat)
    // nhô hẳn ra che phía trên 4 cột sảnh đón và ăn khớp vào thân tháp bát giác
    // - Tầng mái dưới sảnh chính (y = 5.2 đến 5.95)
    addFourSlopeHippedRoof(8.4, 4.0, 6.2, 2.2, 0.75, 0, 5.2, 6.1, 2, 'none');
    // - Cổ diêm mảnh sảnh chính (y = 5.95 đến 6.18)
    addMuseumBox(5.9, 0.23, 2.0, indochineOchreMat, 0, 6.06, 6.0, 2);
    addMuseumBox(6.04, 0.08, 2.12, ivoryStoneMat, 0, 6.17, 6.0, 2);
    // - Tầng mái trên sảnh chính (y = 6.18 đến 6.8)
    addFourSlopeHippedRoof(6.5, 2.6, 4.2, 0.24, 0.62, 0, 6.18, 5.95, 2, 'x');

    // -------------------------------------------------------------------------
    // 4. HAI DÃY CÁNH TRƯNG BÀY (X từ ±4.4 đến ±15.2, Z = 0, sâu 7.6)
    // -------------------------------------------------------------------------
    for (const side of [-1, 1]) {
      const wingW = 10.8; // từ 4.4 đến 15.2
      const wingD = 7.6;  // từ z = -3.8 đến z = +3.8
      const wingCenterX = side * 9.8;
      const wingZ = 0.0;

      // Chân đế đá (y = 0.3 đến 1.5)
      addMuseumBox(wingW, 1.2, wingD, ivoryStoneMat, wingCenterX, 0.9, wingZ, 0);
      addMuseumBox(wingW + 0.12, 0.14, wingD + 0.12, ivoryStoneMat, wingCenterX, 1.48, wingZ, 0);

      // Thân tường vàng (y = 1.5 đến 6.8, indochineOchreMat)
      addMuseumBox(wingW, 5.3, wingD, indochineOchreMat, wingCenterX, 4.15, wingZ, 1);

      // Gờ phào chỉ ngang thanh mảnh ở chân tường (y = 2.25) và cổ mái (y = 6.42, 6.74)
      addMuseumBox(wingW + 0.1, 0.12, wingD + 0.1, ivoryStoneMat, wingCenterX, 2.25, wingZ, 1);
      addMuseumBox(wingW + 0.14, 0.12, wingD + 0.14, ivoryStoneMat, wingCenterX, 6.42, wingZ, 1);
      addMuseumBox(wingW + 0.22, 0.16, wingD + 0.22, ivoryStoneMat, wingCenterX, 6.72, wingZ, 1);

      // Chia làm 5 nhịp đều nhau mỗi bên cánh bởi các trụ tường phẳng (ivoryStoneMat)
      const bayW = wingW / 5; // 2.16m mỗi nhịp
      const startX = side === 1 ? 4.4 : -15.2;

      for (let b = 0; b <= 5; b++) {
        const pilX = startX + b * bayW;
        for (const zDir of [-1, 1]) {
          addMuseumBox(0.26, 5.25, 0.14, ivoryStoneMat, pilX, 4.15, wingZ + zDir * (wingD / 2 + 0.03), 1);
        }
      }

      // Trong mỗi nhịp (5 nhịp mỗi bên cánh):
      for (let b = 0; b < 5; b++) {
        const bayCenterX = startX + (b + 0.5) * bayW;

        // Các ô cửa thông gió tầng hầm hình chữ nhật ngang ở chân đế đá (y = 0.88)
        for (const zDir of [-1, 1]) {
          addMuseumBox(1.05, 0.38, 0.1, ridgeDarkMat, bayCenterX, 0.88, wingZ + zDir * (wingD / 2 + 0.02), 0);
          addMuseumBox(0.92, 0.26, 0.12, darkTeakWoodMat, bayCenterX, 0.88, wingZ + zDir * (wingD / 2 + 0.03), 0);
        }

        // 1 bộ cửa sổ cao lớn (width = 1.3, height = 3.2, tâm tại y = 4.0) trên mặt trước và mặt sau
        addTallIndochineShuttersWindow(bayCenterX, 4.0, wingZ + wingD / 2, 1.3, 3.2, 'front', 1, true);
        addTallIndochineShuttersWindow(bayCenterX, 4.0, wingZ - wingD / 2, 1.3, 3.2, 'back', 1, true);
      }

      // Dưới gờ mái (y = 6.4 đến 6.8): Xếp đều đặn hàng con sơn (consoles) nhỏ đỡ diềm mái
      for (let cx = startX + 0.36; cx <= startX + wingW - 0.3; cx += 0.54) {
        for (const zDir of [-1, 1]) {
          addMuseumBox(0.14, 0.28, 0.42, ivoryStoneMat, cx, 6.58, wingZ + zDir * (wingD / 2 + 0.18), 1);
          addMuseumBox(0.1, 0.14, 0.34, darkTeakWoodMat, cx, 6.66, wingZ + zDir * (wingD / 2 + 0.22), 1);
        }
      }

      // Hệ Mái Dãy Cánh (y = 6.8 đến 9.0): Mái dốc 4 mặt (BufferGeometry hình chóp cụt chữ nhật, agedTileRoofMat)
      // gồm tầng mái dưới và tầng mái trên ngăn cách bởi cổ diêm mảnh, viền sống mái dùng màu tối ridgeDarkMat mảnh 0.12
      // - Tầng mái dưới (y = 6.8 đến 7.75)
      addFourSlopeHippedRoof(wingW + 0.8, wingD + 0.9, wingW - 0.4, wingD - 1.6, 0.95, wingCenterX, 6.8, wingZ, 2, 'none');
      // - Cổ diêm mảnh (y = 7.75 đến 8.05)
      addMuseumBox(wingW - 0.6, 0.3, wingD - 1.9, indochineOchreMat, wingCenterX, 7.9, wingZ, 2);
      addMuseumBox(wingW - 0.5, 0.08, wingD - 1.8, ivoryStoneMat, wingCenterX, 8.03, wingZ, 2);
      // - Tầng mái trên (y = 8.05 đến 9.0)
      addFourSlopeHippedRoof(wingW - 0.2, wingD - 1.4, wingW - 2.4, 0.18, 0.95, wingCenterX, 8.05, wingZ, 2, 'x');
    }

    // -------------------------------------------------------------------------
    // 5. HAI KHỐI ĐẦU HỒI (X từ ±15.2 đến ±19.2, nhô ra phía trước tới Z = +1.2 tâm, depth = 9.2)
    // -------------------------------------------------------------------------
    for (const side of [-1, 1]) {
      const pavW = 4.0;   // từ ±15.2 đến ±19.2
      const pavD = 9.2;   // tâm tại z = +1.2 -> kéo dài từ z = -3.4 đến z = +5.8
      const pavX = side * 17.2;
      const pavZ = 1.2;

      // Chân đế đá Khối Đầu Hồi (y = 0.3 đến 1.5)
      addMuseumBox(pavW, 1.2, pavD, ivoryStoneMat, pavX, 0.9, pavZ, 0);
      addMuseumBox(pavW + 0.16, 0.14, pavD + 0.16, ivoryStoneMat, pavX, 1.48, pavZ, 0);

      // Ô thông gió tầng hầm ở mặt trước Khối Đầu Hồi
      for (const vx of [-0.95, 0.95]) {
        addMuseumBox(0.9, 0.36, 0.1, ridgeDarkMat, pavX + vx, 0.88, pavZ + pavD / 2 + 0.02, 0);
        addMuseumBox(0.76, 0.24, 0.12, darkTeakWoodMat, pavX + vx, 0.88, pavZ + pavD / 2 + 0.03, 0);
      }

      // Thân tường Khối Đầu Hồi (y = 1.5 đến 7.0, indochineOchreMat)
      addMuseumBox(pavW, 5.5, pavD, indochineOchreMat, pavX, 4.25, pavZ, 1);

      // Gờ chỉ ngang và trụ góc phẳng (ivoryStoneMat)
      addMuseumBox(pavW + 0.12, 0.12, pavD + 0.12, ivoryStoneMat, pavX, 2.25, pavZ, 1);
      addMuseumBox(pavW + 0.18, 0.14, pavD + 0.18, ivoryStoneMat, pavX, 6.62, pavZ, 1);
      addMuseumBox(pavW + 0.26, 0.16, pavD + 0.26, ivoryStoneMat, pavX, 6.92, pavZ, 1);

      for (const px of [-1.86, 1.86]) {
        for (const pz of [-4.46, 4.46]) {
          addMuseumBox(0.28, 5.45, 0.28, ivoryStoneMat, pavX + px, 4.25, pavZ + pz, 1);
        }
      }

      // Mặt trước Khối Đầu Hồi (z = +5.8):
      // - Cụm 3 cửa sổ gỗ cao ghép liền nhau (triple windows) tại tâm y = 4.0
      const frontZ = pavZ + pavD / 2;
      addMuseumBox(3.16, 3.44, 0.1, ivoryStoneMat, pavX, 4.0, frontZ + 0.03, 1);
      for (const wOff of [-0.96, 0, 0.96]) {
        const subW = wOff === 0 ? 0.92 : 0.78;
        addTallIndochineShuttersWindow(pavX + wOff, 4.0, frontZ + 0.02, subW, 3.2, 'front', 1, false);
      }

      // - Bên dưới cụm 3 cửa sổ có lan can con tiện đá ở hiên (y từ 1.6 đến 2.25)
      addMuseumBox(3.24, 0.1, 0.22, ivoryStoneMat, pavX, 2.22, frontZ + 0.08, 1);
      addMuseumBox(3.24, 0.1, 0.22, ivoryStoneMat, pavX, 1.62, frontZ + 0.08, 1);
      for (let bx = -1.35; bx <= 1.36; bx += 0.3) {
        addMuseumBox(0.08, 0.5, 0.1, ivoryStoneMat, pavX + bx, 1.92, frontZ + 0.08, 1);
      }

      // - Phía trên cụm 3 cửa sổ có khung phù điêu ngang (y = 6.12)
      addMuseumBox(3.0, 0.52, 0.14, ivoryStoneMat, pavX, 6.12, frontZ + 0.06, 1);
      addMuseumBox(2.76, 0.34, 0.16, indochineOchreMat, pavX, 6.12, frontZ + 0.08, 1);
      addMuseumBox(2.4, 0.18, 0.18, ivoryStoneMat, pavX, 6.12, frontZ + 0.1, 1);

      // Mặt hông ngoài (x = ±19.2) và mặt sau (z = -3.4) của Khối Đầu Hồi
      for (const sz of [-1.4, 1.2, 3.8]) {
        addTallIndochineShuttersWindow(
          pavX + side * (pavW / 2),
          4.0,
          sz,
          1.2,
          3.2,
          side === 1 ? 'right' : 'left',
          1,
          true
        );
      }
      addTallIndochineShuttersWindow(pavX, 4.0, pavZ - pavD / 2, 1.3, 3.2, 'back', 1, true);

      // Hàng con sơn (consoles) nhỏ dưới gờ mái Khối Đầu Hồi (y = 6.65 đến 6.95)
      for (let cx = -1.6; cx <= 1.61; cx += 0.53) {
        addMuseumBox(0.14, 0.26, 0.42, ivoryStoneMat, pavX + cx, 6.78, frontZ + 0.18, 1);
        addMuseumBox(0.14, 0.26, 0.42, ivoryStoneMat, pavX + cx, 6.78, pavZ - pavD / 2 - 0.18, 1);
      }

      // Mái Khối Đầu Hồi: Mái dốc 4 mặt (agedTileRoofMat, y = 7.0 đến 9.4) giao nguyên khối với mái cánh
      // - Tầng mái dưới Khối Đầu Hồi (y = 7.0 đến 8.0)
      addFourSlopeHippedRoof(pavW + 0.9, pavD + 0.9, pavW - 0.4, pavD - 1.4, 1.0, pavX, 7.0, pavZ, 2, 'none');
      // - Cổ diêm mảnh Khối Đầu Hồi (y = 8.0 đến 8.3)
      addMuseumBox(pavW - 0.6, 0.3, pavD - 1.7, indochineOchreMat, pavX, 8.15, pavZ, 2);
      addMuseumBox(pavW - 0.48, 0.08, pavD - 1.58, ivoryStoneMat, pavX, 8.28, pavZ, 2);
      // - Tầng mái trên Khối Đầu Hồi (y = 8.3 đến 9.4)
      addFourSlopeHippedRoof(pavW - 0.15, pavD - 1.2, 0.18, pavD - 3.6, 1.1, pavX, 8.3, pavZ, 2, 'z');
    }

    // =========================================================================
    // 6. QUẦN THỂ CẢNH QUAN & HIỆN VẬT TRƯNG BÀY NGOÀI TRỜI CHUẨN THỰC TẾ
    // =========================================================================

    // Vật liệu chuyên biệt cho Hiện vật Súng thần công, Chậu sứ men lam, Cây Tùng Bonsai & Đèn lồng Đông Dương
    const cannonBarrelMat = new THREE.MeshStandardMaterial({
      color: 0x2b302c,
      metalness: 0.6,
      roughness: 0.4,
    });

    const cannonCarriageWoodMat = new THREE.MeshStandardMaterial({
      color: 0x4a2518,
      roughness: 0.62,
      metalness: 0.05,
    });

    const mossGrassMat = new THREE.MeshStandardMaterial({
      color: 0x3b5929,
      roughness: 0.92,
      metalness: 0.0,
    });

    const bonsaiTrunkMat = new THREE.MeshStandardMaterial({
      color: 0x3b2416,
      roughness: 0.85,
      metalness: 0.02,
    });

    const bonsaiFoliageDarkMat = new THREE.MeshStandardMaterial({
      color: 0x28471c,
      roughness: 0.82,
      metalness: 0.02,
    });

    const bonsaiFoliageMidMat = new THREE.MeshStandardMaterial({
      color: 0x365e26,
      roughness: 0.8,
      metalness: 0.02,
    });

    const castIronDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1e2224,
      roughness: 0.48,
      metalness: 0.55,
    });

    const lanternWarmGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfff3c4,
      emissive: new THREE.Color(0xffaa33),
      emissiveIntensity: 0.95,
      roughness: 0.25,
      metalness: 0.05,
    });

    // CanvasTexture cho Chậu Sứ Men Lam Cổ (Blue-and-white porcelain planters)
    const createBlueWhitePorcelainTex = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Nền sứ trắng ngà tráng men
        ctx.fillStyle = '#f2f4f7';
        ctx.fillRect(0, 0, 256, 128);

        // Đường diềm hoa văn chữ Hồi màu xanh lam cổ (#1d4e89) ở miệng và chân chậu
        ctx.fillStyle = '#1d4e89';
        ctx.fillRect(0, 8, 256, 10);
        ctx.fillRect(0, 110, 256, 10);

        ctx.strokeStyle = '#1d4e89';
        ctx.lineWidth = 3;
        for (let x = 8; x < 256; x += 32) {
          // Họa tiết mây rồng / hoa sen cách điệu giữa thân chậu
          ctx.beginPath();
          ctx.arc(x + 12, 64, 11, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#2b6cb0';
          ctx.beginPath();
          ctx.arc(x + 12, 64, 5, 0, Math.PI * 2);
          ctx.fill();

          // Nhánh lá lam cổ nối liền
          ctx.beginPath();
          ctx.moveTo(x, 64);
          ctx.quadraticCurveTo(x + 12, 42, x + 28, 64);
          ctx.stroke();
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    };

    if (!landmarkTextureCache.has('museumPorcelainTex')) {
      const t = createBlueWhitePorcelainTex();
      t.userData = { isCached: true };
      landmarkTextureCache.set('museumPorcelainTex', t);
    }

    const bluePorcelainMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: landmarkTextureCache.get('museumPorcelainTex'),
      roughness: 0.22,
      metalness: 0.08,
    });

    // Helper đăng ký đầy đủ userData.originalMaterial cho các Mesh nằm trong Group con (như Khẩu Súng Thần Công xoay góc)
    const registerMuseumSubGroup = (subGroup: THREE.Group, tier = 0) => {
      subGroup.userData.elevationTier = tier;
      subGroup.userData.origY = subGroup.position.y;
      subGroup.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.userData.elevationTier = tier;
          child.userData.origY = child.position.y;
          const m = (Array.isArray(child.material) ? child.material[0] : child.material) as THREE.MeshStandardMaterial;
          child.userData.origColor = m.color ? m.color.getHex() : 0xffffff;
          child.userData.originalMaterial = {
            color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
            emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0x000000),
            emissiveIntensity: m.emissiveIntensity ?? 0,
            opacity: m.opacity !== undefined ? m.opacity : 1.0,
            transparent: m.transparent ?? false,
            wireframe: false,
            depthWrite: m.depthWrite !== undefined ? m.depthWrite : true,
            map: m.map || null,
            bumpMap: m.bumpMap || null,
            bumpScale: m.bumpScale !== undefined ? m.bumpScale : 0.02,
            roughnessMap: m.roughnessMap || null,
            roughness: m.roughness !== undefined ? m.roughness : 0.8,
            metalness: m.metalness !== undefined ? m.metalness : 0.03,
          };
        }
      });
      group.add(subGroup);
    };

    // -------------------------------------------------------------------------
    // 6.1. KHU TRƯNG BÀY SÚNG THẦN CÔNG CỔ NGOÀI TRỜI (ĐẶC TRƯNG THỰC TẾ CỦA BẢO TÀNG)
    //      Dọc hai bên sân trước hai dãy cánh (x từ -13.5 đến -6.5 và +6.5 đến +13.5, tại z = +6.8)
    //      Mỗi bên 3 Khẩu Súng Thần Công Cổ thời Nguyễn hướng chéo ra lối đi chính
    // -------------------------------------------------------------------------
    const addNguyenDynastyCannon = (cx: number, cz: number, yawAngle: number) => {
      const cannonGroup = new THREE.Group();
      cannonGroup.position.set(cx, 0.3, cz);
      cannonGroup.rotation.y = yawAngle;

      // 1) Bệ đỡ bằng đá xám thấp có gờ viền đá trắng ngà
      const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.14, 2.25), courtyardStoneMat);
      basePlinth.position.set(0, 0.07, 0);
      cannonGroup.add(basePlinth);

      const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.06, 2.35), ivoryStoneMat);
      baseTrim.position.set(0, 0.03, 0);
      cannonGroup.add(baseTrim);

      // 2) Khung giá súng bằng gỗ lim nâu đỏ (#4a2518)
      for (const cheekSide of [-1, 1]) {
        const kx = cheekSide * 0.24;
        // Bậc dưới má giá súng
        const cheekLower = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 1.48), cannonCarriageWoodMat);
        cheekLower.position.set(kx, 0.38, -0.05);
        cannonGroup.add(cheekLower);
        // Bậc giữa má giá súng
        const cheekMid = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 1.05), cannonCarriageWoodMat);
        cheekMid.position.set(kx, 0.56, 0.14);
        cannonGroup.add(cheekMid);
        // Bậc cao đỡ trục nòng súng
        const cheekTop = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.62), cannonCarriageWoodMat);
        cheekTop.position.set(kx, 0.70, 0.28);
        cannonGroup.add(cheekTop);
      }

      // Các thanh giằng ngang và bệ gỗ đỡ đuôi súng
      const transomFront = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.14), cannonCarriageWoodMat);
      transomFront.position.set(0, 0.48, 0.54);
      cannonGroup.add(transomFront);

      const transomRear = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.28), cannonCarriageWoodMat);
      transomRear.position.set(0, 0.36, -0.62);
      cannonGroup.add(transomRear);

      // 2 Trục bánh xe trước & sau
      for (const axleZ of [-0.46, 0.44]) {
        const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.86, 12), cannonBarrelMat);
        axle.rotation.z = Math.PI / 2;
        axle.position.set(0, 0.32, axleZ);
        cannonGroup.add(axle);

        // 4 Bánh xe gỗ viền đai sắt
        for (const wSide of [-1, 1]) {
          const wx = wSide * 0.34;
          const wheelR = axleZ > 0 ? 0.22 : 0.19;
          // Vành đai sắt ngoài
          const ironRim = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, 0.08, 18), cannonBarrelMat);
          ironRim.rotation.z = Math.PI / 2;
          ironRim.position.set(wx, wheelR + 0.12, axleZ);
          cannonGroup.add(ironRim);

          // Đĩa bánh xe gỗ lim nâu đỏ
          const woodDisk = new THREE.Mesh(new THREE.CylinderGeometry(wheelR - 0.03, wheelR - 0.03, 0.09, 16), cannonCarriageWoodMat);
          woodDisk.rotation.z = Math.PI / 2;
          woodDisk.position.set(wx, wheelR + 0.12, axleZ);
          cannonGroup.add(woodDisk);

          // Bầu trục sắt chính giữa bánh xe
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.13, 12), cannonBarrelMat);
          hub.rotation.z = Math.PI / 2;
          hub.position.set(wx, wheelR + 0.12, axleZ);
          cannonGroup.add(hub);
        }
      }

      // 3) Nòng súng thần công đúc bằng đồng đen/gang (#2b302c, metalness: 0.6, roughness: 0.4, chếch lên góc 12 độ)
      const barrelPivot = new THREE.Group();
      barrelPivot.position.set(0, 0.76, 0.12);
      barrelPivot.rotation.x = (-12 * Math.PI) / 180; // Chếch mũi súng (+Z) lên góc 12 độ

      // Thân nòng súng thuôn dài (CylinderGeometry nằm dọc theo trục Z của barrelPivot)
      const mainBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.185, 2.08, 18), cannonBarrelMat);
      mainBarrel.rotation.x = Math.PI / 2;
      barrelPivot.add(mainBarrel);

      // 4 Gờ đai nổi chạy quanh thân nòng súng thần công
      for (const [ringZ, ringR] of [
        [-0.78, 0.182],
        [-0.28, 0.165],
        [0.24, 0.148],
        [0.72, 0.132],
      ]) {
        const reinforceRing = new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.018, 10, 20), cannonBarrelMat);
        reinforceRing.position.set(0, 0, ringZ);
        barrelPivot.add(reinforceRing);
      }

      // Miệng súng loe (Muzzle swell) & Lòng nòng súng tối sâu
      const muzzleSwell = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.12, 0.18, 18), cannonBarrelMat);
      muzzleSwell.rotation.x = Math.PI / 2;
      muzzleSwell.position.set(0, 0, 1.02);
      barrelPivot.add(muzzleSwell);

      const boreHole = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 14), deepShadowRecessMat);
      boreHole.rotation.x = Math.PI / 2;
      boreHole.position.set(0, 0, 1.09);
      barrelPivot.add(boreHole);

      // Bầu khóa nòng (Breech) & Chuôi cầu đuôi súng (Cascabel knob)
      const breechCap = new THREE.Mesh(new THREE.SphereGeometry(0.182, 16, 12), cannonBarrelMat);
      breechCap.scale.set(1, 1, 0.65);
      breechCap.position.set(0, 0, -1.04);
      barrelPivot.add(breechCap);

      const cascabelKnob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), cannonBarrelMat);
      cascabelKnob.position.set(0, 0, -1.21);
      barrelPivot.add(cascabelKnob);

      // Trục ngang (Trunnions) gác lên giá gỗ và Quai rồng đồng cổ trên lưng nòng
      const trunnionBar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.62, 12), cannonBarrelMat);
      trunnionBar.rotation.z = Math.PI / 2;
      trunnionBar.position.set(0, -0.02, 0.08);
      barrelPivot.add(trunnionBar);

      const dolphinHandle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 8, 14, Math.PI), antiqueBronzeMat);
      dolphinHandle.rotation.y = Math.PI / 2;
      dolphinHandle.position.set(0, 0.15, -0.05);
      barrelPivot.add(dolphinHandle);

      cannonGroup.add(barrelPivot);

      // 4) Bảng chú thích hiện vật nhỏ trên chân đế đặt bên cạnh khẩu thần công
      const plaqueOffsetX = cx < 0 ? 0.56 : -0.56;
      const plaqueBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.24), ivoryStoneMat);
      plaqueBase.position.set(plaqueOffsetX, 0.17, 0.72);
      cannonGroup.add(plaqueBase);

      const plaquePole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.52, 8), castIronDarkMat);
      plaquePole.position.set(plaqueOffsetX, 0.44, 0.72);
      cannonGroup.add(plaquePole);

      const plaqueBoard = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.03), darkTeakWoodMat);
      plaqueBoard.position.set(plaqueOffsetX, 0.70, 0.74);
      plaqueBoard.rotation.x = -0.6;
      cannonGroup.add(plaqueBoard);

      const plaqueBrassFace = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.19, 0.035), antiqueBronzeMat);
      plaqueBrassFace.position.set(plaqueOffsetX, 0.705, 0.745);
      plaqueBrassFace.rotation.x = -0.6;
      cannonGroup.add(plaqueBrassFace);

      registerMuseumSubGroup(cannonGroup, 0);
    };

    // Đặt mỗi bên 3 Khẩu Súng Thần Công Cổ thời Nguyễn tại x = ±7.0, ±10.0, ±13.0 và z = +6.8, hướng chéo ra lối đi chính
    for (const cannonX of [-13.0, -10.0, -7.0]) {
      addNguyenDynastyCannon(cannonX, 6.8, 0.36);
    }
    for (const cannonX of [7.0, 10.0, 13.0]) {
      addNguyenDynastyCannon(cannonX, 6.8, -0.36);
    }

    // -------------------------------------------------------------------------
    // 6.2. LỐI ĐI CHÍNH LÁT ĐÁ HOA CƯƠNG, BỒN HOA ĐÁ ĐÔNG DƯƠNG, CHẬU SỨ MEN LAM & CÂY TÙNG BONSAI PHÂN TẦNG
    // -------------------------------------------------------------------------
    // Mở rộng lối đi chính lát đá hoa cương kẻ ô dẫn thẳng từ mép sân trước (z = +16.0) vào bậc tam cấp Sảnh chính (z = +10.5)
    addMuseumBox(5.8, 0.05, 7.6, ivoryStoneMat, 0, 0.31, 14.3, 0, true);
    addMuseumBox(5.2, 0.06, 7.5, courtyardStoneMat, 0, 0.32, 14.3, 0, true);
    // Các dải đá hoa cương kẻ ô ngang dọc theo lối đi chính
    for (let wz = 11.0; wz <= 17.6; wz += 1.1) {
      addMuseumBox(5.3, 0.065, 0.12, ivoryStoneMat, 0, 0.325, wz, 0, true);
    }

    // Helper dựng Cây Tùng / Cây Đa Cổ Thụ Cắt Tỉa Tán Phân Tầng (Layered Bonsai Trees)
    // Thân cây gỗ nâu sẫm có rễ phụ và nhánh chạc chữ Y, tán lá gồm nhiều cụm hình đĩa dẹt SphereGeometry scale(1.6, 0.45, 1.6)
    const addLayeredIndochineBonsaiTree = (tx: number, baseY: number, tz: number, treeScale = 1.0) => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(tx, baseY, tz);
      treeGroup.scale.setScalar(treeScale);

      // Gốc cây cổ thụ xù xì & các rễ phụ (aerial roots) cắm xuống mặt cỏ
      const rootMound = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.46, 0.32, 10), bonsaiTrunkMat);
      rootMound.position.set(0, 0.14, 0);
      treeGroup.add(rootMound);

      for (let r = 0; r < 5; r++) {
        const rAng = (r * Math.PI * 2) / 5 + 0.3;
        const propRoot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.065, 0.72, 8), bonsaiTrunkMat);
        propRoot.position.set(Math.cos(rAng) * 0.24, 0.34, Math.sin(rAng) * 0.24);
        propRoot.rotation.z = Math.cos(rAng) * 0.32;
        propRoot.rotation.x = -Math.sin(rAng) * 0.32;
        treeGroup.add(propRoot);
      }

      // Thân chính uốn thế cổ thụ
      const lowerTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.28, 1.05, 10), bonsaiTrunkMat);
      lowerTrunk.position.set(0.04, 0.62, 0);
      lowerTrunk.rotation.z = -0.12;
      treeGroup.add(lowerTrunk);

      const upperTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.19, 0.95, 10), bonsaiTrunkMat);
      upperTrunk.position.set(0.08, 1.42, -0.02);
      upperTrunk.rotation.z = 0.08;
      treeGroup.add(upperTrunk);

      // Các nhánh chạc chữ Y vươn ra nâng đỡ các tầng tán lá đĩa dẹt
      const branches: Array<{
        bx: number;
        by: number;
        bz: number;
        rz: number;
        rx: number;
        len: number;
        padX: number;
        padY: number;
        padZ: number;
        padR: number;
        mat: THREE.MeshStandardMaterial;
      }> = [
        // Tầng tán thấp bên trái
        { bx: -0.42, by: 1.15, bz: 0.12, rz: 0.78, rx: 0.18, len: 0.95, padX: -0.78, padY: 1.42, padZ: 0.22, padR: 0.56, mat: bonsaiFoliageDarkMat },
        // Tầng tán thấp bên phải
        { bx: 0.48, by: 1.25, bz: -0.14, rz: -0.74, rx: -0.16, len: 0.92, padX: 0.84, padY: 1.54, padZ: -0.22, padR: 0.54, mat: bonsaiFoliageMidMat },
        // Tầng tán giữa phía trước
        { bx: 0.06, by: 1.48, bz: 0.38, rz: -0.12, rx: 0.68, len: 0.82, padX: 0.12, padY: 1.76, padZ: 0.68, padR: 0.50, mat: bonsaiFoliageMidMat },
        // Tầng tán giữa phía sau
        { bx: -0.18, by: 1.56, bz: -0.36, rz: 0.28, rx: -0.64, len: 0.84, padX: -0.32, padY: 1.86, padZ: -0.64, padR: 0.52, mat: bonsaiFoliageDarkMat },
        // Tầng tán cao bên trái
        { bx: -0.28, by: 1.88, bz: 0.06, rz: 0.52, rx: 0.08, len: 0.68, padX: -0.52, padY: 2.15, padZ: 0.10, padR: 0.48, mat: bonsaiFoliageMidMat },
        // Tầng tán cao bên phải
        { bx: 0.32, by: 1.94, bz: 0.04, rz: -0.48, rx: 0.06, len: 0.66, padX: 0.54, padY: 2.22, padZ: 0.08, padR: 0.46, mat: bonsaiFoliageDarkMat },
        // Tán đỉnh trung tâm (Apex cloud pad)
        { bx: 0.04, by: 2.12, bz: 0.0, rz: 0.04, rx: 0.0, len: 0.55, padX: 0.04, padY: 2.48, padZ: 0.0, padR: 0.54, mat: bonsaiFoliageMidMat },
      ];

      for (const br of branches) {
        const branchCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, br.len, 8), bonsaiTrunkMat);
        branchCyl.position.set(br.bx, br.by, br.bz);
        branchCyl.rotation.z = br.rz;
        branchCyl.rotation.x = br.rx;
        treeGroup.add(branchCyl);

        // Cụm tán lá hình đĩa dẹt: SphereGeometry nén dẹt theo trục Y scale(1.6, 0.45, 1.6)
        const foliagePad = new THREE.Mesh(new THREE.SphereGeometry(br.padR, 16, 12), br.mat);
        foliagePad.scale.set(1.6, 0.45, 1.6);
        foliagePad.position.set(br.padX, br.padY, br.padZ);
        treeGroup.add(foliagePad);

        // Lớp lá phụ mỏng bên trên mỗi đĩa tán tạo độ dày tự nhiên
        const subPad = new THREE.Mesh(
          new THREE.SphereGeometry(br.padR * 0.68, 14, 10),
          br.mat === bonsaiFoliageDarkMat ? bonsaiFoliageMidMat : bonsaiFoliageDarkMat
        );
        subPad.scale.set(1.5, 0.42, 1.5);
        subPad.position.set(br.padX + 0.06, br.padY + 0.14, br.padZ - 0.04);
        treeGroup.add(subPad);
      }

      registerMuseumSubGroup(treeGroup, 0);
    };

    // Đối xứng hai bên lối đi chính (x = ±9.5, z = +11.5):
    // Dựng 2 Bồn Hoa Cảnh Hình Chữ Nhật Vát Góc có thành đá trắng ngà cao 0.45 đơn vị, bên trong là cỏ xanh rêu trầm (#3b5929)
    for (const side of [-1, 1]) {
      const px = side * 9.5;
      const pz = 11.5;
      const bedW = 6.4;
      const bedD = 3.6;
      const wallH = 0.45;
      const wallY = 0.3 + wallH / 2; // 0.525

      // Nền cỏ xanh rêu trầm (#3b5929) bên trong bồn hoa
      addMuseumBox(bedW - 0.35, 0.38, bedD - 0.35, mossGrassMat, px, 0.49, pz, 0);

      // Thành bồn đá trắng ngà (ivoryStoneMat) chạm gờ chỉ cao 0.45 đơn vị (vát 4 góc)
      // 2 Cạnh dài trước & sau
      addMuseumBox(bedW - 0.9, wallH, 0.24, ivoryStoneMat, px, wallY, pz + bedD / 2, 0);
      addMuseumBox(bedW - 0.9, wallH, 0.24, ivoryStoneMat, px, wallY, pz - bedD / 2, 0);
      addMuseumBox(bedW - 0.82, 0.08, 0.32, ivoryStoneMat, px, 0.3 + wallH + 0.03, pz + bedD / 2, 0);
      addMuseumBox(bedW - 0.82, 0.08, 0.32, ivoryStoneMat, px, 0.3 + wallH + 0.03, pz - bedD / 2, 0);

      // 2 Cạnh ngắn trái & phải
      addMuseumBox(0.24, wallH, bedD - 0.9, ivoryStoneMat, px + bedW / 2, wallY, pz, 0);
      addMuseumBox(0.24, wallH, bedD - 0.9, ivoryStoneMat, px - bedW / 2, wallY, pz, 0);
      addMuseumBox(0.32, 0.08, bedD - 0.82, ivoryStoneMat, px + bedW / 2, 0.3 + wallH + 0.03, pz, 0);
      addMuseumBox(0.32, 0.08, bedD - 0.82, ivoryStoneMat, px - bedW / 2, 0.3 + wallH + 0.03, pz, 0);

      // 4 Đoạn thành vát góc 45 độ + 8 Trụ góc nhỏ trang trí Đông Dương
      for (const cxSign of [-1, 1]) {
        for (const czSign of [-1, 1]) {
          const cornerX = px + cxSign * (bedW / 2 - 0.24);
          const cornerZ = pz + czSign * (bedD / 2 - 0.24);
          const chamferWall = new THREE.Mesh(new THREE.BoxGeometry(0.72, wallH + 0.04, 0.24), ivoryStoneMat);
          chamferWall.position.set(cornerX, wallY + 0.01, cornerZ);
          chamferWall.rotation.y = cxSign * czSign * (Math.PI / 4);
          addMuseumMesh(chamferWall, 0);
        }
      }

      // Tiểu cảnh đá non bộ & khóm cây thấp cắt tỉa hai bên gốc Tùng cổ thụ
      for (const offsetX of [-1.85, 1.85]) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), courtyardStoneMat);
        rock.scale.set(1.2, 0.85, 1.0);
        rock.position.set(px + offsetX, 0.78, pz + (offsetX > 0 ? 0.35 : -0.35));
        addMuseumMesh(rock, 0);

        const lowPad = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10), bonsaiFoliageDarkMat);
        lowPad.scale.set(1.5, 0.42, 1.5);
        lowPad.position.set(px + offsetX * 0.85, 0.88, pz - (offsetX > 0 ? 0.4 : -0.4));
        addMuseumMesh(lowPad, 0);
      }

      // Giữa mỗi bồn hoa trồng Cây Tùng / Cây Đa Cổ Thụ Cắt Tỉa Tán Phân Tầng (Layered Bonsai Tree)
      addLayeredIndochineBonsaiTree(px, 0.68, pz, 1.15);
    }

    // Helper dựng Chậu Sứ Men Lam Cổ (Blue-and-white porcelain planters) trồng cây cảnh lá nhỏ xanh mát
    const addBluePorcelainPlanter = (px: number, pz: number) => {
      // Đôn đá chạm khắc dưới đáy chậu
      addMuseumBox(0.68, 0.18, 0.68, ivoryStoneMat, px, 0.39, pz, 0);
      addMuseumBox(0.56, 0.14, 0.56, ridgeDarkMat, px, 0.52, pz, 0);

      // Thân chậu sứ men lam cổ (CylinderGeometry loe nhẹ ở miệng)
      const potBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.24, 0.48, 18),
        bluePorcelainMat
      );
      potBody.position.set(px, 0.82, pz);
      addMuseumMesh(potBody, 0);

      // Vành miệng chậu sứ trắng ngà
      const potRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.04, 10, 20),
        ivoryStoneMat
      );
      potRim.rotation.x = Math.PI / 2;
      potRim.position.set(px, 1.06, pz);
      addMuseumMesh(potRim, 0);

      // Đất/rêu trong chậu
      const soil = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.06, 14),
        mossGrassMat
      );
      soil.position.set(px, 1.04, pz);
      addMuseumMesh(soil, 0);

      // Cây cảnh bonsai lá nhỏ phân 3 tầng đĩa mảnh trong chậu sứ
      const miniTrunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.07, 0.52, 8),
        bonsaiTrunkMat
      );
      miniTrunk.position.set(px, 1.28, pz);
      addMuseumMesh(miniTrunk, 0);

      const foliageTiers: Array<[number, number, number, number, THREE.MeshStandardMaterial]> = [
        [-0.14, 1.38, 0.06, 0.22, bonsaiFoliageDarkMat],
        [0.15, 1.48, -0.05, 0.20, bonsaiFoliageMidMat],
        [0.0, 1.62, 0.0, 0.24, bonsaiFoliageMidMat],
      ];
      for (const [ox, fy, oz, fr, fMat] of foliageTiers) {
        const pad = new THREE.Mesh(new THREE.SphereGeometry(fr, 12, 10), fMat);
        pad.scale.set(1.55, 0.45, 1.55);
        pad.position.set(px + ox, fy, pz + oz);
        addMuseumMesh(pad, 0);
      }
    };

    // Đặt 6 Chậu Sứ Men Lam Cổ dọc theo chân bậc tam cấp sảnh chính và hai đầu hồi
    const porcelainPositions: Array<[number, number]> = [
      [-3.55, 10.45],
      [3.55, 10.45],
      [-14.8, 6.45],
      [14.8, 6.45],
      [-19.2, 6.45],
      [19.2, 6.45],
    ];
    for (const [px, pz] of porcelainPositions) {
      addBluePorcelainPlanter(px, pz);
    }

    // -------------------------------------------------------------------------
    // 6.3. TRỤ ĐÈN LỒNG ĐÔNG DƯƠNG, GHẾ ĐÁ/GỖ CHÂN GANG & HÀNG RÀO CỔNG BẢO TÀNG
    // -------------------------------------------------------------------------
    // Helper dựng Cột Đèn Gang Đúc Cổ Điển Đông Dương (#1e2224) có lồng đèn lục giác kiểu cung đình phát sáng vàng ấm (emissive: 0xffaa33)
    const addIndochineLanternPost = (lx: number, lz: number) => {
      // Bệ đá dưới chân cột đèn
      addMuseumBox(0.56, 0.22, 0.56, ivoryStoneMat, lx, 0.41, lz, 0);

      // Chân đế gang đúc bát giác giật cấp
      const ironBase1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.38, 8), castIronDarkMat);
      ironBase1.position.set(lx, 0.71, lz);
      addMuseumMesh(ironBase1, 0);

      const ironBase2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.42, 8), castIronDarkMat);
      ironBase2.position.set(lx, 1.11, lz);
      addMuseumMesh(ironBase2, 0);

      // Thân trụ đèn gang đúc cao thanh thoát
      const poleShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.095, 2.35, 12), castIronDarkMat);
      poleShaft.position.set(lx, 2.48, lz);
      addMuseumMesh(poleShaft, 0);

      // Các vòng gờ đốt trúc trang trí thân trụ đèn
      for (const ringY of [1.85, 2.65, 3.45]) {
        const collar = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.024, 8, 14), antiqueBronzeMat);
        collar.rotation.x = Math.PI / 2;
        collar.position.set(lx, ringY, lz);
        addMuseumMesh(collar, 0);
      }

      // Đế đỡ lồng đèn lục giác kiểu cung đình
      const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.11, 0.14, 6), castIronDarkMat);
      lanternBase.position.set(lx, 3.72, lz);
      addMuseumMesh(lanternBase, 0);

      // Bầu lồng đèn lục giác phát ánh sáng vàng ấm (emissive: 0xffaa33)
      const hexGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.21, 0.48, 6), lanternWarmGlowMat);
      hexGlass.position.set(lx, 4.02, lz);
      addMuseumMesh(hexGlass, 0);

      // Mái lồng đèn lục giác kiểu cung đình + chóp đồng nhỏ
      const hexRoof = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.28, 6), castIronDarkMat);
      hexRoof.position.set(lx, 4.38, lz);
      addMuseumMesh(hexRoof, 0);

      const topFinial = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), antiqueBronzeMat);
      topFinial.position.set(lx, 4.55, lz);
      addMuseumMesh(topFinial, 0);
    };

    // Dựng 6 Cột Đèn Gang Đúc Cổ Điển Đông Dương dọc hai bên lối đi chính và trước sân (x = ±5.0 và x = ±14.0 tại z = +10.0 và +14.5)
    const lanternCoords: Array<[number, number]> = [
      [-5.0, 10.0],
      [5.0, 10.0],
      [-5.0, 14.5],
      [5.0, 14.5],
      [-14.0, 12.25],
      [14.0, 12.25],
    ];
    for (const [lx, lz] of lanternCoords) {
      addIndochineLanternPost(lx, lz);
    }

    // Helper dựng 4 Băng Ghế Gỗ Chân Gang Đúc đặt cạnh bồn hoa
    const addIndochineParkBench = (bx: number, bz: number, facingDirZ: 1 | -1) => {
      // 2 Chân gang đúc hai đầu kèm tay vịn
      for (const legOffX of [-0.78, 0.78]) {
        // Chân trước & sau
        addMuseumBox(0.08, 0.42, 0.52, castIronDarkMat, bx + legOffX, 0.51, bz, 0);
        // Khung đỡ tựa lưng và tay vịn uốn cong
        addMuseumBox(0.08, 0.44, 0.08, castIronDarkMat, bx + legOffX, 0.74, bz - facingDirZ * 0.22, 0);
        addMuseumBox(0.09, 0.06, 0.48, castIronDarkMat, bx + legOffX, 0.72, bz, 0);
      }

      // Mặt ghế ghép từ 3 thanh gỗ lim nâu đỏ
      for (const slatZ of [-0.14, 0, 0.14]) {
        addMuseumBox(1.76, 0.055, 0.11, cannonCarriageWoodMat, bx, 0.54, bz + slatZ, 0);
      }

      // Tựa lưng ghép từ 2 thanh gỗ lim
      for (const backY of [0.74, 0.90]) {
        addMuseumBox(1.76, 0.09, 0.05, cannonCarriageWoodMat, bx, backY, bz - facingDirZ * 0.22, 0);
      }
    };

    // 4 Băng ghế gỗ chân gang đúc đặt cạnh 2 bồn hoa (x = ±9.5, tại z = +9.1 và z = +13.9)
    addIndochineParkBench(-9.5, 9.1, -1);
    addIndochineParkBench(9.5, 9.1, -1);
    addIndochineParkBench(-9.5, 13.9, 1);
    addIndochineParkBench(9.5, 13.9, 1);

    // Hệ Hàng Rào Sắt Rèn Nghệ Thuật thấp dọc theo mép ngoài cùng phía trước sân bảo tàng (z = +16.2)
    // Kết hợp các trụ cột đá trắng ngà (ivoryStoneMat) có đèn cổng tròn trên đỉnh; ở chính giữa (x = 0) mở rộng lối cổng chính
    const fenceZ = 16.2;
    const pillarPositionsX = [-21.0, -16.8, -12.6, -8.4, -4.2, 4.2, 8.4, 12.6, 16.8, 21.0];

    for (const pilX of pillarPositionsX) {
      const isMainGatePillar = Math.abs(pilX) === 4.2;
      const pilW = isMainGatePillar ? 0.78 : 0.56;
      const pilH = isMainGatePillar ? 2.15 : 1.65;

      // Chân đế trụ rào
      addMuseumBox(pilW + 0.14, 0.32, pilW + 0.14, ivoryStoneMat, pilX, 0.46, fenceZ, 0);
      // Thân trụ đá trắng ngà
      addMuseumBox(pilW, pilH, pilW, ivoryStoneMat, pilX, 0.3 + pilH / 2, fenceZ, 0);
      // Mũ trụ đá giật cấp
      addMuseumBox(pilW + 0.18, 0.14, pilW + 0.18, ivoryStoneMat, pilX, 0.3 + pilH + 0.07, fenceZ, 0);

      // Bảng đồng cổ nhỏ gắn trên 2 trụ cổng chính (x = ±4.2)
      if (isMainGatePillar) {
        addMuseumBox(0.46, 0.32, 0.06, antiqueBronzeMat, pilX, 1.55, fenceZ + 0.38, 0);
      }

      // Đèn cổng tròn trên đỉnh mỗi trụ đá
      const lampNeck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.14, 0.14, 10),
        castIronDarkMat
      );
      lampNeck.position.set(pilX, 0.3 + pilH + 0.21, fenceZ);
      addMuseumMesh(lampNeck, 0);

      const globeLamp = new THREE.Mesh(
        new THREE.SphereGeometry(isMainGatePillar ? 0.24 : 0.18, 14, 12),
        lanternWarmGlowMat
      );
      globeLamp.position.set(pilX, 0.3 + pilH + 0.28 + (isMainGatePillar ? 0.2 : 0.15), fenceZ);
      addMuseumMesh(globeLamp, 0);
    }

    // Các nhịp tường chân đá thấp + Hàng rào sắt rèn nghệ thuật màu đen nối giữa các trụ cột đá
    const fenceSpans: Array<[number, number]> = [
      [-21.0, -16.8],
      [-16.8, -12.6],
      [-12.6, -8.4],
      [-8.4, -4.2],
      [4.2, 8.4],
      [8.4, 12.6],
      [12.6, 16.8],
      [16.8, 21.0],
    ];

    for (const [x1, x2] of fenceSpans) {
      const spanCenterX = (x1 + x2) / 2;
      const spanLen = Math.abs(x2 - x1) - 0.56;

      // Chân tường rào đá thấp (y từ 0.3 đến 0.72)
      addMuseumBox(spanLen, 0.42, 0.28, ivoryStoneMat, spanCenterX, 0.51, fenceZ, 0);
      addMuseumBox(spanLen + 0.06, 0.08, 0.34, ridgeDarkMat, spanCenterX, 0.74, fenceZ, 0);

      // Thanh ngang sắt rèn dưới và trên (y = 0.86 và y = 1.62)
      addMuseumBox(spanLen, 0.05, 0.06, castIronDarkMat, spanCenterX, 0.86, fenceZ, 0);
      addMuseumBox(spanLen, 0.05, 0.06, castIronDarkMat, spanCenterX, 1.54, fenceZ, 0);
      addMuseumBox(spanLen, 0.06, 0.08, castIronDarkMat, spanCenterX, 1.66, fenceZ, 0);

      // Các song sắt dọc kết hợp mũi giáo đồng & vòng hoa sắt rèn nghệ thuật ở giữa
      const numBars = 11;
      const barStep = spanLen / (numBars + 1);
      for (let b = 1; b <= numBars; b++) {
        const bx = x1 + 0.28 + b * barStep;
        addMuseumBox(0.035, 0.92, 0.035, castIronDarkMat, bx, 1.24, fenceZ, 0);
        // Mũi giáo trang trí trên đỉnh song sắt
        const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), antiqueBronzeMat);
        spearTip.position.set(bx, 1.76, fenceZ);
        addMuseumMesh(spearTip, 0);
      }

      // Vòng hoa văn sắt rèn nghệ thuật chính giữa mỗi nhịp rào
      const wroughtRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 16), antiqueBronzeMat);
      wroughtRing.position.set(spanCenterX, 1.24, fenceZ);
      addMuseumMesh(wroughtRing, 0);
    }

    // Hai cánh cổng sắt nghệ thuật ở chính giữa (x = ±4.2) mở rộng vào trong đón khách
    for (const gateSide of [-1, 1]) {
      const gateGroup = new THREE.Group();
      gateGroup.position.set(gateSide * 3.78, 0.3, fenceZ);
      // Mở 2 cánh cổng vào phía trong sân một góc 70 độ để lối đi chính hoàn toàn thông thoáng
      gateGroup.rotation.y = gateSide * 1.22;

      const leafW = 1.65;
      const leafCenterX = -gateSide * (leafW / 2);

      // Khung bao cánh cổng sắt
      const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(leafW, 0.06, 0.06), castIronDarkMat);
      bottomRail.position.set(leafCenterX, 0.22, 0);
      gateGroup.add(bottomRail);

      const midRail = new THREE.Mesh(new THREE.BoxGeometry(leafW, 0.05, 0.06), castIronDarkMat);
      midRail.position.set(leafCenterX, 1.15, 0);
      gateGroup.add(midRail);

      const topRail = new THREE.Mesh(new THREE.BoxGeometry(leafW, 0.06, 0.06), castIronDarkMat);
      topRail.position.set(leafCenterX, 1.48, 0);
      gateGroup.add(topRail);

      // Song sắt dọc trên cánh cổng
      for (let i = 0; i <= 6; i++) {
        const gx = -gateSide * (0.08 + i * 0.25);
        const barH = 1.35 + Math.sin((i / 6) * Math.PI) * 0.28;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, barH, 0.04), castIronDarkMat);
        bar.position.set(gx, 0.2 + barH / 2, 0);
        gateGroup.add(bar);

        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 4), antiqueBronzeMat);
        tip.position.set(gx, 0.2 + barH + 0.07, 0);
        gateGroup.add(tip);
      }

      // Hoa văn tròn mạ đồng chính giữa cánh cổng
      const gateMedallion = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 16), antiqueBronzeMat);
      gateMedallion.position.set(leafCenterX, 0.72, 0);
      gateGroup.add(gateMedallion);

      registerMuseumSubGroup(gateGroup, 0);
    }

    return null;

  } else if (buildNewNineHeritageModel(siteId, group)) {
    return null;

  } else {
    // Fallback wireframe plinth (only reached if an unknown site ID is added in the future)
    // "ĐANG TRONG QUÁ TRÌNH HOÀN THIỆN / UNDER CONSTRUCTION"
    // Áp dụng cho:
    // 1) Hội quán Nghĩa An (Chùa Ông - Quận 5) [HCM-DT-012]
    // 2) Chùa Giác Lâm (Quận Tân Bình) [HCM-DT-011]
    // 3) Khu di tích Gò Cà Vồ (Thành phố Thủ Đức) [HCM-DT-010]
    // 4) Lăng Tả quân Lê Văn Duyệt (Lăng Ông Bà Chiểu - Quận Bình Thạnh) [HCM-DT-008]
    // =========================================================================
    const blueprintWireGoldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af61,
      emissive: 0xb45309,
      emissiveIntensity: 0.35,
      wireframe: true,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });

    const blueprintWireCyanMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });

    const blueprintGhostFillMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x1e293b,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.22,
      roughness: 0.6,
      metalness: 0.1,
      depthWrite: false,
    });

    const addWireframeVolume = (
      geo: THREE.BufferGeometry,
      x: number,
      y: number,
      z: number,
      useGold = true,
      tier = 1,
      rotY = 0
    ) => {
      const ghost = new THREE.Mesh(geo, blueprintGhostFillMat);
      ghost.position.set(x, y, z);
      ghost.rotation.y = rotY;
      ghost.userData.elevationTier = tier;
      ghost.userData.origY = y;
      ghost.userData.isGrid = true;
      group.add(ghost);

      const wire = new THREE.Mesh(geo, useGold ? blueprintWireGoldMat : blueprintWireCyanMat);
      wire.position.set(x, y, z);
      wire.rotation.y = rotY;
      wire.userData.elevationTier = tier;
      wire.userData.origY = y;
      wire.userData.isGrid = true;
      group.add(wire);
    };

    // 1. Bệ sa bàn lưới trắc địa (CAD Survey Base Plinth)
    addWireframeVolume(new THREE.BoxGeometry(36, 0.4, 30, 18, 1, 15), 0, 0.2, 0, false, 0);

    // Vòng tọa độ định vị trắc địa quanh công trình
    const ringOuter = new THREE.Mesh(
      new THREE.RingGeometry(15.5, 15.8, 48, 1),
      blueprintWireCyanMat
    );
    ringOuter.rotation.x = -Math.PI / 2;
    ringOuter.position.y = 0.42;
    ringOuter.userData.isGrid = true;
    group.add(ringOuter);

    if (siteId === 'HCM-DT-011') {
      // Chùa Giác Lâm (Quận Tân Bình): Bố cục chữ Tam truyền thống & Bảo tháp Xá Lợi 7 tầng lục giác
      // Bảo tháp 7 tầng phía trước bên trái
      for (let t = 0; t < 7; t++) {
        const r = 2.2 - t * 0.22;
        const y = 0.4 + t * 1.35 + 0.65;
        addWireframeVolume(new THREE.CylinderGeometry(r * 0.88, r, 1.25, 6, 2), -8.5, y, 6.5, true, 2);
      }
      // 3 gian nhà chữ Tam (Tiền đường - Chính điện - Nhà Tổ)
      [-6.0, 0.0, 6.0].forEach((zPos) => {
        addWireframeVolume(new THREE.BoxGeometry(16, 3.6, 4.8, 8, 3, 3), 2.0, 2.2, zPos, false, 1);
        addWireframeVolume(
          new THREE.CylinderGeometry(5.5, 9.2, 2.6, 4, 3),
          2.0,
          5.3,
          zPos,
          true,
          2,
          Math.PI / 4
        );
      });
    } else if (siteId === 'HCM-DT-010') {
      // Khu di tích Gò Cà Vồ (Thành phố Thủ Đức): Sa bàn địa tầng khảo cổ & Hố khai quật mộ chum
      addWireframeVolume(new THREE.CylinderGeometry(9.5, 13.5, 2.4, 24, 4), 0, 1.6, 0, false, 1);
      addWireframeVolume(new THREE.BoxGeometry(14, 1.8, 10, 10, 3, 8), 0, 2.9, 0, true, 1);
      // Mái che bảo tồn hố khai quật khảo cổ
      addWireframeVolume(
        new THREE.CylinderGeometry(6.0, 9.5, 2.8, 4, 4),
        0,
        5.8,
        0,
        true,
        2,
        Math.PI / 4
      );
      // Các cụm mộ chum khảo cổ trong lưới ô vuông
      [-4, 0, 4].forEach((gx) => {
        [-2.5, 2.5].forEach((gz) => {
          addWireframeVolume(new THREE.SphereGeometry(0.75, 10, 8), gx, 2.5, gz, true, 1);
        });
      });
    } else if (siteId === 'HCM-DT-012') {
      // Hội quán Nghĩa An (Chùa Ông - Quận 5): Kiến trúc Hội quán Triều Châu có sân Thiên tỉnh ở giữa
      // Tiền điện, Chính điện và Hai dãy Đông - Tây lang bao quanh Thiên tỉnh
      addWireframeVolume(new THREE.BoxGeometry(18, 4.2, 5.2, 9, 3, 3), 0, 2.5, 7.2, false, 1);
      addWireframeVolume(new THREE.BoxGeometry(18, 4.8, 6.4, 9, 3, 4), 0, 2.8, -5.8, false, 1);
      addWireframeVolume(new THREE.BoxGeometry(3.6, 3.8, 7.6, 2, 3, 4), -7.2, 2.3, 0.8, false, 1);
      addWireframeVolume(new THREE.BoxGeometry(3.6, 3.8, 7.6, 2, 3, 4), 7.2, 2.3, 0.8, false, 1);
      // Mái ngói ống Triều Châu chồng diêm
      addWireframeVolume(new THREE.CylinderGeometry(6.5, 10.5, 2.6, 4, 3), 0, 5.9, 7.2, true, 2, Math.PI / 4);
      addWireframeVolume(new THREE.CylinderGeometry(7.0, 11.0, 3.2, 4, 4), 0, 6.8, -5.8, true, 2, Math.PI / 4);
    } else if (siteId === 'BRVT-DT-002') {
      // Quần thể kiến trúc Nhà Lớn Long Sơn (Vũng Tàu): Quần thể gỗ cổ truyền 3 khu (Đền thờ, Trường học, Nhà chợ)
      // Cổng Tam quan & Lầu Chuông - Lầu Trống
      addWireframeVolume(new THREE.BoxGeometry(14, 3.8, 2.4, 8, 3, 2), 0, 2.3, 10.5, true, 1);
      // Khu Đền Thờ (Tiền điện - Trung điện - Chính điện bậc thang theo sườn đồi Núi Nứa)
      [-6.5, -1.0, 4.5].forEach((zPos, idx) => {
        const yBase = 2.4 + (2 - idx) * 1.1;
        addWireframeVolume(new THREE.BoxGeometry(16, 3.8, 4.6, 8, 3, 3), 0, yBase, zPos, false, 1);
        addWireframeVolume(
          new THREE.CylinderGeometry(5.5, 9.6, 2.6, 4, 3),
          0,
          yBase + 3.2,
          zPos,
          true,
          2,
          Math.PI / 4
        );
      });
      // Dãy Nhà Hội & Nhà Ghe Sấm hai bên
      addWireframeVolume(new THREE.BoxGeometry(3.8, 3.4, 14, 2, 2, 6), -10.8, 2.1, -1.0, false, 1);
      addWireframeVolume(new THREE.BoxGeometry(3.8, 3.4, 14, 2, 2, 6), 10.8, 2.1, -1.0, false, 1);
    } else if (siteId === 'BRVT-DT-003' || siteId === 'BD-DT-002') {
      // Khu di tích Địa đạo Long Phước (Bà Rịa) & Địa đạo Tam Giác Sắt (Tây Nam Bến Cát - Bình Dương):
      // Sa bàn Mặt cắt Địa tầng Xuyên đất Đỏ Bazan / Đất Sét Pha Sỏi Đỏ & Giao thông hào chiến đấu
      // Khối mặt cắt địa tầng 2 tầng hầm
      addWireframeVolume(new THREE.BoxGeometry(26, 6.2, 18, 13, 4, 9), 0, 3.5, 0, false, 1);
      // Hầm chữ A & Phòng chỉ huy ngầm trong lòng đất
      [-7.5, 0, 7.5].forEach((hx) => {
        addWireframeVolume(new THREE.BoxGeometry(5.2, 2.4, 5.2, 4, 2, 4), hx, 2.6, 3.5, true, 1);
        addWireframeVolume(new THREE.CylinderGeometry(0.8, 2.8, 1.8, 3, 2), hx, 4.5, 3.5, true, 1);
      });
      // Tuyến đường hầm xương sống xuyên tâm & ụ chiến đấu nổi trên mặt đất
      addWireframeVolume(new THREE.BoxGeometry(22, 1.5, 2.2, 12, 2, 2), 0, 2.2, -2.5, true, 1);
      [-6.5, 6.5].forEach((bx) => {
        addWireframeVolume(new THREE.CylinderGeometry(2.4, 3.2, 1.6, 12, 2), bx, 7.4, -3.5, true, 2);
      });
      // Nhà bia tưởng niệm trên mặt đất
      addWireframeVolume(new THREE.CylinderGeometry(1.6, 2.4, 5.8, 6, 4), 0, 9.5, -4.5, true, 2);
    } else if (siteId === 'BD-DT-001') {
      // Nhà cổ Trần Công Vàng (TP. Thủ Dầu Một - Bình Dương): Nhà cổ chữ Đinh 3 gian 2 chái 64 cột gỗ quý
      // Nền đá xanh & Thân nhà chính 5 nhịp ngang (3 gian 2 chái)
      addWireframeVolume(new THREE.BoxGeometry(20, 4.4, 9.2, 10, 3, 5), 0, 2.6, 2.5, false, 1);
      // Nhà phụ phía sau nối vuông góc theo hình chữ Đinh (丁)
      addWireframeVolume(new THREE.BoxGeometry(8.4, 4.0, 10.5, 5, 3, 5), 0, 2.4, -7.2, false, 1);
      // Hệ mái ngói âm dương dốc 4 mái truyền thống Nam Bộ
      addWireframeVolume(new THREE.CylinderGeometry(6.5, 11.8, 3.2, 4, 4), 0, 6.4, 2.5, true, 2, Math.PI / 4);
      addWireframeVolume(new THREE.CylinderGeometry(3.8, 6.8, 2.8, 4, 3), 0, 5.8, -7.2, true, 2, Math.PI / 4);
    } else {
      // Lăng Tả quân Lê Văn Duyệt (Lăng Ông Bà Chiểu - Quận Bình Thạnh): Cổng Tam quan, Nhà bia, Mộ cổ & Điện thờ
      // Cổng Tam quan phía trước (+Z)
      addWireframeVolume(new THREE.BoxGeometry(12, 3.8, 2.2, 8, 3, 2), 0, 2.3, 11.2, true, 1);
      // Nhà Bia & Khu Mộ song táng
      addWireframeVolume(new THREE.BoxGeometry(5.2, 3.4, 5.2, 4, 3, 4), -6.5, 2.1, 4.5, false, 1);
      addWireframeVolume(new THREE.CylinderGeometry(1.8, 3.8, 2.2, 4, 2), -6.5, 4.9, 4.5, true, 2, Math.PI / 4);
      // Tiền điện & Chính điện trùng thiềm điệp ốc
      addWireframeVolume(new THREE.BoxGeometry(16, 4.2, 11.5, 8, 3, 6), 1.5, 2.5, -3.5, false, 1);
      addWireframeVolume(new THREE.CylinderGeometry(6.5, 10.2, 3.0, 4, 4), 1.5, 6.1, -3.5, true, 2, Math.PI / 4);
    }

    return null;
  }
}
