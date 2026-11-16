import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HeritageSite } from '../../types/heritage';
import { useI18n } from '../../i18n/I18nContext';
import { useLabs } from '../../contexts/LabsContext';
import {
  useHeritageRealPhotos,
  resolveSitePhotoSlots,
} from '../../utils/wikimediaPhotoService';
import {
  HeritageTypographicPlate,
  getHeritagePlatePalette,
} from '../common/HeritageTypographicPlate';
import { HeritageSmoothImage } from '../common/HeritageSmoothImage';
import { getHeritageColorBlock } from '../../utils/indochinePalette';
import { useMuseumTilt3D } from '../../utils/useMuseumTilt3D';
import { triggerHaptic } from '../../utils/haptics';
import { buildHighDetailModel, getLandmarkFeatures, GLB_ONLY_SITE_IDS } from './ThreeDModelViewer';
import {
  saveGlbFileToIndexedDB,
  useSiteGlbSource,
} from '../../utils/glbModelStorage';
import { loadAndNormalizeGlb } from '../../utils/threeGlbLoader';
import { ResolvedGuidedTour } from '../../data/guidedTours';
import { GuidedTourStarterSection } from '../guide/GuidedTourConcierge';
import {
  ANALYTICS_UPDATED_EVENT,
  VISITORS_UPDATED_EVENT,
  loadAnalytics,
  loadVisitHistoryLogs,
  PlatformAnalytics,
  VisitHistoryLogEntry,
} from '../../utils/adminPlatformStore';
import {
  Plus,
  Camera,
  Compass,
  Ticket,
  BookOpen,
  Layers,
  Scan,
  ArrowUpRight,
  Lock,
  Users,
  Eye,
  Monitor,
  Smartphone,
  Clock,
  Landmark,
  Upload,
} from 'lucide-react';

interface AppleScrollytellingHomeProps {
  sites: HeritageSite[];
  selectedSite: HeritageSite;
  hiddenSiteIds?: string[];
  isPaused?: boolean;
  isAuthenticated?: boolean;
  guidedTours?: ResolvedGuidedTour[];
  masterpieceSite?: HeritageSite | null;
  onStartGuidedTour?: (tour: ResolvedGuidedTour) => void;
  onStartMasterpiece?: () => void;
  onSelectSite: (site: HeritageSite) => void;
  onOpen3D: (site: HeritageSite) => void;
  onOpenDetailModal: (site: HeritageSite) => void;
  onOpenAudioModal: (site: HeritageSite) => void;
  onOpenPhotoManager: (site: HeritageSite) => void;
  onOpenLisboaSplit: () => void;
  onOpenCinemaModal: (site?: HeritageSite) => void;
  onNavigateTab: (tab: 'explore' | 'space3d' | 'map_routes' | 'catalog' | 'edtech') => void;
}



function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (
      obj instanceof THREE.Mesh ||
      obj instanceof THREE.Points ||
      obj instanceof THREE.Line ||
      obj instanceof THREE.LineSegments ||
      obj instanceof THREE.LineLoop ||
      obj instanceof THREE.Sprite
    ) {
      obj.geometry?.dispose();
      const disposeMat = (m: THREE.Material) => {
        const anyMat = m as unknown as Record<string, unknown>;
        [
          'map',
          'bumpMap',
          'roughnessMap',
          'normalMap',
          'aoMap',
          'emissiveMap',
          'metalnessMap',
          'alphaMap',
          'envMap',
          'specularMap',
        ].forEach((k) => {
          const tex = anyMat[k];
          if (tex && typeof (tex as THREE.Texture).dispose === 'function' && !(tex as THREE.Texture).userData?.isCached) {
            (tex as THREE.Texture).dispose();
          }
        });
        m.dispose();
      };
      if (Array.isArray(obj.material)) {
        obj.material.forEach(disposeMat);
      } else if (obj.material) {
        disposeMat(obj.material);
      }
    }
  });
}

function fitCameraForStage(camera: THREE.PerspectiveCamera, targetGroup: THREE.Object3D, distanceScale = 1.38) {
  const box = new THREE.Box3().setFromObject(targetGroup);
  if (box.isEmpty()) return new THREE.Vector3(0, 3, 0);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 10);
  const fovRad = (camera.fov * Math.PI) / 180;
  const dist = (maxDim / 2 / Math.tan(fovRad / 2)) * distanceScale;
  camera.position.set(center.x + dist * 0.52, center.y + dist * 0.34, center.z + dist * 0.84);
  camera.lookAt(center);
  return center;
}

interface BentoMonumentCardProps {
  site: HeritageSite;
  officialName: string;
  isAuthenticated?: boolean;
  isHiddenForVisitors?: boolean;
  onOpenDetailModal: (site: HeritageSite) => void;
  onOpenPhotoManager: (site: HeritageSite) => void;
  onOpen3D: (site: HeritageSite) => void;
}

const BentoMonumentCard: React.FC<BentoMonumentCardProps> = React.memo(({
  site,
  officialName,
  isAuthenticated = false,
  isHiddenForVisitors = false,
  onOpenDetailModal,
  onOpenPhotoManager,
  onOpen3D,
}) => {
  const { lang } = useI18n();
  const tiltHandlers = useMuseumTilt3D(4);
  const [activePhotoIdx, setActivePhotoIdx] = useState<0 | 1>(0);
  const [imgFailed, setImgFailed] = useState(false);
  const rawPhoto = site.photos?.[activePhotoIdx] ?? (activePhotoIdx === 0 ? site.photos?.[0] : '') ?? '';
  useEffect(() => {
    setImgFailed(false);
  }, [rawPhoto, activePhotoIdx]);
  const hasRealPhoto = Boolean(rawPhoto && !imgFailed);
  const block = getHeritageColorBlock(site, lang as 'vi' | 'en' | 'zh');

  return (
  <article
    onClick={() => onOpenDetailModal(site)}
    onMouseMove={tiltHandlers.onMouseMove}
    onMouseLeave={tiltHandlers.onMouseLeave}
    style={{ backgroundColor: block.bg, color: block.fg }}
    className="museum-tilt-card relative group rounded-[24px] border border-[#171817]/20 overflow-hidden cursor-pointer flex flex-col justify-between shadow-[0_14px_34px_rgba(23,24,23,0.12)]"
  >
    <div
      data-tilt-glow="true"
      className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300"
    />
    <div
      className="relative aspect-video w-full overflow-hidden bg-[#171817]"
      style={{ borderBottom: `1px solid ${block.hairline}` }}
    >
      {hasRealPhoto ? (
        <HeritageSmoothImage
          src={rawPhoto}
          alt={officialName}
          loading="lazy"
          waitTone="dark"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-[opacity,transform] duration-500"
        />
      ) : (
        <HeritageTypographicPlate site={site} variant="bento" />
      )}
      {isHiddenForVisitors && (
        <span className="absolute bottom-3 left-3 z-10 px-2.5 py-0.5 rounded-full bg-[#171817] border border-[#C9A46A] text-[#C9A46A] text-[10px] font-semibold">
          {lang === 'en'
            ? 'Tester Preview · Hidden'
            : lang === 'zh'
            ? '隐藏草稿 · 测试模式'
            : 'Đang ẩn · Chế độ Tester'}
        </span>
      )}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-3 right-3 z-10 inline-flex items-center rounded-full bg-[#F4EFE4]/95 border border-[#171817]/25 p-0.5 shadow-sm"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActivePhotoIdx(0);
          }}
          className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold tabular-nums transition-colors cursor-pointer ${
            activePhotoIdx === 0
              ? 'bg-[#171817] text-[#D8C9A9]'
              : 'text-[#171817]/75 hover:text-[#171817]'
          }`}
        >
          01
        </button>
        <span className="text-[#171817]/25 text-[10px] px-0.5 select-none" aria-hidden="true">
          |
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActivePhotoIdx(1);
          }}
          className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold tabular-nums transition-colors cursor-pointer ${
            activePhotoIdx === 1
              ? 'bg-[#171817] text-[#D8C9A9]'
              : 'text-[#171817]/75 hover:text-[#171817]'
          }`}
        >
          02
        </button>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenPhotoManager(site);
        }}
        title={
          lang === 'en'
            ? 'Change real photo'
            : lang === 'zh'
            ? '更换实景照片'
            : 'Đổi ảnh chụp thật'
        }
        className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-3 right-3 z-10 w-8 h-8 rounded-full bg-[#F4EFE4]/95 border border-[#171817]/20 text-[#171817] flex items-center justify-center cursor-pointer"
      >
        <Camera className="w-3.5 h-3.5" />
      </button>
    </div>

    <div className="p-5 flex-1 flex flex-col justify-between">
      <div>
        <span
          className="font-sans text-[12px] font-medium tabular-nums"
          style={{ color: block.mutedFg }}
        >
          {site.commencementYear} · {site.identifierCode}
        </span>
        <h4
          className="font-serif text-xl font-medium mt-1 line-clamp-1"
          style={{ fontVariantNumeric: 'lining-nums', color: block.fg }}
        >
          {officialName}
        </h4>
      </div>

      <div className="flex items-center justify-between pt-4 mt-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen3D(site);
          }}
          style={{ color: block.fg }}
          className="text-xs font-semibold hover:underline cursor-pointer flex items-center gap-1"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{lang === 'en' ? '3D View' : lang === 'zh' ? '3D 视图' : 'Xem 3D'}</span>
          {!isAuthenticated && <Lock className="w-3 h-3 shrink-0 opacity-80" />}
        </button>
        <span
          style={{
            backgroundColor: block.badgeBg,
            color: block.badgeFg,
            borderColor: block.hairline,
          }}
          className="w-8 h-8 rounded-full border flex items-center justify-center transition-transform group-hover:scale-105"
        >
          {!isAuthenticated ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
        </span>
      </div>
    </div>
  </article>
  );
});

export const AppleScrollytellingHome: React.FC<AppleScrollytellingHomeProps> = React.memo(({
  sites,
  selectedSite,
  hiddenSiteIds = [],
  isPaused = false,
  isAuthenticated = false,
  guidedTours = [],
  masterpieceSite = null,
  onStartGuidedTour,
  onStartMasterpiece,
  onSelectSite,
  onOpen3D,
  onOpenDetailModal,
  onOpenAudioModal,
  onOpenPhotoManager,
  onOpenLisboaSplit,
  onOpenCinemaModal,
  onNavigateTab,
}) => {
  const { lang, getLocalizedSite } = useI18n();
  const locSelected = getLocalizedSite(selectedSite);

  const featuredFeatures = useMemo(() => getLandmarkFeatures(selectedSite.id), [selectedSite.id]);
  const tiltHandlers = useMuseumTilt3D(4);

  const { customPhotosMap, wikimediaCacheMap } = useHeritageRealPhotos();
  const [cardPhotoSlotMap, setCardPhotoSlotMap] = useState<Record<string, 0 | 1>>({});

  const getCardPhotoSlot = useCallback(
    (siteId: string): 0 | 1 => cardPhotoSlotMap[siteId] ?? 0,
    [cardPhotoSlotMap]
  );

  const setCardPhotoSlot = useCallback((siteId: string, slot: 0 | 1) => {
    setCardPhotoSlotMap((prev) => (prev[siteId] === slot ? prev : { ...prev, [siteId]: slot }));
  }, []);

  const [failedPhotoMap, setFailedPhotoMap] = useState<Record<string, boolean>>({});
  const markPhotoFailed = useCallback((key: string) => {
    setFailedPhotoMap((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  const resolveHeroPhoto = useCallback(
    (site: HeritageSite, slot: 0 | 1 = 0) => {
      const { slots } = resolveSitePhotoSlots(site.id, customPhotosMap, wikimediaCacheMap);
      return slots[slot] || site.photos?.[slot] || (slot === 0 ? site.photos?.[0] : '') || '';
    },
    [customPhotosMap, wikimediaCacheMap]
  );

  // Van Gogh Museum-style horizontal card strip refs & scroll progress
  const heroCardsTrackRef = useRef<HTMLDivElement>(null);
  const [heroScrollProgress, setHeroScrollProgress] = useState<number>(0);
  const dragStateRef = useRef<{
    isDown: boolean;
    startX: number;
    scrollLeft: number;
  }>({ isDown: false, startX: 0, scrollLeft: 0 });
  const dragDistanceRef = useRef<number>(0);
  const [isDraggingCards, setIsDraggingCards] = useState<boolean>(false);

  const handleHeroTrackScroll = useCallback(() => {
    const el = heroCardsTrackRef.current;
    if (!el) return;
    const maxScroll = Math.max(1, el.scrollWidth - el.clientWidth);
    const ratio = Math.min(1, Math.max(0, el.scrollLeft / maxScroll));
    setHeroScrollProgress(ratio);
  }, []);

  useEffect(() => {
    handleHeroTrackScroll();
    window.addEventListener('resize', handleHeroTrackScroll);
    return () => window.removeEventListener('resize', handleHeroTrackScroll);
  }, [handleHeroTrackScroll, sites.length]);

  useEffect(() => {
    const el = heroCardsTrackRef.current;
    if (!el) return;

    const onWheelNative = (e: WheelEvent) => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const delta = e.deltaY;
      if (delta === 0) return;

      const atStart = el.scrollLeft <= 1;
      const atEnd = el.scrollLeft >= maxScroll - 1;
      if ((delta < 0 && atStart) || (delta > 0 && atEnd)) {
        return;
      }

      e.preventDefault();
      el.scrollLeft += delta;
    };

    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current.isDown) return;
      const el = heroCardsTrackRef.current;
      if (!el) return;
      const dx = e.clientX - dragStateRef.current.startX;
      dragDistanceRef.current = Math.max(dragDistanceRef.current, Math.abs(dx));
      if (dragDistanceRef.current >= 3) {
        setIsDraggingCards(true);
      }
      el.scrollLeft = dragStateRef.current.scrollLeft - dx;
    };

    const endDrag = () => {
      if (!dragStateRef.current.isDown) return;
      dragStateRef.current.isDown = false;
      setIsDraggingCards(false);
      window.setTimeout(() => {
        dragDistanceRef.current = 0;
      }, 0);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('blur', endDrag);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('blur', endDrag);
    };
  }, []);

  const handleHeroTrackMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = heroCardsTrackRef.current;
    if (!el) return;
    dragDistanceRef.current = 0;
    dragStateRef.current = {
      isDown: true,
      startX: e.clientX,
      scrollLeft: el.scrollLeft,
    };
  }, []);

  const scrollHeroCards = useCallback((direction: -1 | 1) => {
    const el = heroCardsTrackRef.current;
    if (!el) return;
    const firstCard = el.firstElementChild as HTMLElement | null;
    const stepPx = firstCard ? firstCard.offsetWidth + 24 : 309;
    el.scrollBy({ left: direction * stepPx, behavior: 'smooth' });
  }, []);

  // Refs for Sticky Scrollytelling 3D Choreography
  const choreographySectionRef = useRef<HTMLDivElement>(null);
  const stickyStageWrapperRef = useRef<HTMLDivElement>(null);
  const stickyCanvasHostRef = useRef<HTMLDivElement>(null);
  const stickyVisibleRef = useRef<boolean>(false);
  const resumeStickyLoopRef = useRef<(() => void) | null>(null);
  const isPausedRef = useRef<boolean>(isPaused);
  const [activeBeat, setActiveBeat] = useState<0 | 1 | 2>(0);
  const activeBeatRef = useRef<0 | 1 | 2>(0);
  const { source: stickyGlbSource } = useSiteGlbSource(selectedSite.id);
  const stickyGlbInputRef = useRef<HTMLInputElement | null>(null);
  const [stickyGlbLoading, setStickyGlbLoading] = useState<boolean>(false);
  const [stickyGlbError, setStickyGlbError] = useState<string | null>(null);
  const [isSavingStickyGlb, setIsSavingStickyGlb] = useState<boolean>(false);

  useEffect(() => {
    activeBeatRef.current = activeBeat;
  }, [activeBeat]);

  useEffect(() => {
    isPausedRef.current = isPaused;
    if (!isPaused) {
      resumeStickyLoopRef.current?.();
    }
  }, [isPaused]);

  // Live synced visitor analytics & recent visit logs (across devices)
  const [liveAnalytics, setLiveAnalytics] = useState<PlatformAnalytics>(() => loadAnalytics());
  const [visitHistoryLogs, setVisitHistoryLogs] = useState<VisitHistoryLogEntry[]>(() =>
    loadVisitHistoryLogs()
  );

  useEffect(() => {
    const syncAnalyticsView = () => {
      setLiveAnalytics(loadAnalytics());
      setVisitHistoryLogs(loadVisitHistoryLogs());
    };
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === 'dau_an_viet_analytics_v1' ||
        e.key === 'dau_an_viet_visit_history_v1'
      ) {
        syncAnalyticsView();
      }
    };
    window.addEventListener(ANALYTICS_UPDATED_EVENT, syncAnalyticsView);
    window.addEventListener(VISITORS_UPDATED_EVENT, syncAnalyticsView);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(ANALYTICS_UPDATED_EVENT, syncAnalyticsView);
      window.removeEventListener(VISITORS_UPDATED_EVENT, syncAnalyticsView);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const totalSiteViews = useMemo(
    () =>
      Object.values(liveAnalytics.siteViews || {}).reduce(
        (sum, val) => sum + (Number.isFinite(val) ? Number(val) : 0),
        0
      ),
    [liveAnalytics.siteViews]
  );
  const selectedSiteViews = liveAnalytics.siteViews?.[selectedSite.id] || 0;
  const latestVisitEntry = visitHistoryLogs[0] || null;

  // Scroll listener for 3-beat Apple Choreography
  useEffect(() => {
    const handleScroll = () => {
      const section = choreographySectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const viewportH = window.innerHeight || 800;
      const scrollableSpan = Math.max(1, rect.height - viewportH);
      const progress = Math.max(0, Math.min(1, -rect.top / scrollableSpan));

      if (progress < 0.34) {
        setActiveBeat(0);
      } else if (progress < 0.7) {
        setActiveBeat(1);
      } else {
        setActiveBeat(2);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const { effectiveGoldenHour3D, effectiveWireframeOverlay } = useLabs();
  const labsGoldenHourRef = useRef<boolean>(effectiveGoldenHour3D);
  const labsWireframeRef = useRef<boolean>(effectiveWireframeOverlay);
  labsGoldenHourRef.current = effectiveGoldenHour3D;
  labsWireframeRef.current = effectiveWireframeOverlay;

  useEffect(() => {
    resumeStickyLoopRef.current?.();
  }, [effectiveGoldenHour3D, effectiveWireframeOverlay]);

  // =========================================================================
  // STICKY SCROLLYTELLING 3D CHOREOGRAPHY STAGE (Turntable + 0.8s Camera Lerp)
  // =========================================================================
  useEffect(() => {
    const host = stickyCanvasHostRef.current;
    const wrapper = stickyStageWrapperRef.current;
    if (!host || !wrapper) return;

    const width = host.clientWidth || 720;
    const height = host.clientHeight || 540;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171817);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.2, 450);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    host.innerHTML = '';
    host.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x18181b, 0.9);
    scene.add(hemiLight);
    const keyLight = new THREE.DirectionalLight(0xfff5e4, 1.85);
    keyLight.position.set(18, 28, 22);
    scene.add(keyLight);

    const cyanRim = new THREE.DirectionalLight(0x38bdf8, 0.9);
    cyanRim.position.set(-20, 14, -18);
    scene.add(cyanRim);

    const labsWireframeMat = new THREE.MeshBasicMaterial({
      color: 0xc8a96e,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      depthWrite: false,
    });

    const stageGroup = new THREE.Group();
    scene.add(stageGroup);

    const baseGrid = new THREE.GridHelper(44, 22, 0x334155, 0x18181b);
    baseGrid.position.y = -0.05;
    stageGroup.add(baseGrid);

    const modelGroup = new THREE.Group();
    stageGroup.add(modelGroup);

    const xrayShellMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.24,
      roughness: 0.2,
      metalness: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const xrayInteriorMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd4af37,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.25,
    });

    const cachedMeshes: THREE.Mesh[] = [];
    const registerMeshesAndFit = () => {
      cachedMeshes.length = 0;
      modelGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.userData.origY === undefined) {
            obj.userData.origY = obj.position.y;
          }
          if (!obj.userData.origMaterialRef) {
            obj.userData.origMaterialRef = obj.material;
          }
          cachedMeshes.push(obj);
        }
      });
    };

    const isGlbOnlySticky = GLB_ONLY_SITE_IDS.has(selectedSite.id);
    if (!isGlbOnlySticky) {
      setStickyGlbLoading(false);
      setStickyGlbError(null);
      buildHighDetailModel(selectedSite.id, modelGroup);
      registerMeshesAndFit();
    } else if (!stickyGlbSource.url) {
      setStickyGlbLoading(false);
      setStickyGlbError(null);
    }

    const baseCenter = fitCameraForStage(camera, modelGroup, 1.48);
    let camDistance = camera.position.distanceTo(baseCenter);

    // Museum Turntable OrbitControls (autoRotate = true, autoRotateSpeed = 0.35, dampingFactor = 0.05)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.target.copy(baseCenter);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.update();

    let userInteracting = false;
    const onControlStart = () => {
      userInteracting = true;
      controls.autoRotate = false;
    };
    const onControlEnd = () => {
      userInteracting = false;
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('end', onControlEnd);

    let currentExploded = 0;
    let currentXrayActive = false;
    let currentGoldenActive: boolean | null = null;
    let currentWireframeActive = false;
    const wireOverlays: THREE.Mesh[] = [];
    let lastBeat = activeBeatRef.current;
    let beatTransitionStart = 0;
    const beatLerpDurationSec = 0.8;
    const fromCamPos = camera.position.clone();
    const toCamPos = camera.position.clone();
    const fromTargetPos = baseCenter.clone();
    const toTargetPos = baseCenter.clone();

    const syncLabsStageVisuals = () => {
      const wantGolden = labsGoldenHourRef.current;
      if (wantGolden !== currentGoldenActive) {
        currentGoldenActive = wantGolden;
        if (wantGolden) {
          scene.background = new THREE.Color(0x171817);
          hemiLight.color.setHex(0xe8a472);
          hemiLight.groundColor.setHex(0x2a1810);
          hemiLight.intensity = 0.85;
          keyLight.color.setHex(0xffb86c);
          keyLight.intensity = 2.2;
          keyLight.position.set(28, 9, 16);
          cyanRim.color.setHex(0xc9a46a);
          cyanRim.intensity = 1.0;
        } else {
          scene.background = new THREE.Color(0x171817);
          hemiLight.color.setHex(0xf8fafc);
          hemiLight.groundColor.setHex(0x18181b);
          hemiLight.intensity = 0.9;
          keyLight.color.setHex(0xfff5e4);
          keyLight.intensity = 1.85;
          keyLight.position.set(18, 28, 22);
          cyanRim.color.setHex(0x526d8b);
          cyanRim.intensity = 0.9;
        }
      }

      const wantWire = labsWireframeRef.current;
      if (wantWire !== currentWireframeActive) {
        currentWireframeActive = wantWire;
        if (wantWire) {
          for (const mesh of cachedMeshes) {
            if (mesh.geometry && !mesh.userData.isGround && !mesh.userData.isGrid) {
              const overlay = new THREE.Mesh(mesh.geometry, labsWireframeMat);
              overlay.userData.isLabsWireframeOverlay = true;
              overlay.renderOrder = 2;
              mesh.add(overlay);
              wireOverlays.push(overlay);
            }
          }
        } else {
          while (wireOverlays.length > 0) {
            const ov = wireOverlays.pop();
            ov?.parent?.remove(ov);
          }
        }
      }
    };
    syncLabsStageVisuals();

    const computeBeatCameraVectors = (beatIdx: 0 | 1 | 2) => {
      const angle = beatIdx === 0 ? 0.52 : beatIdx === 1 ? 0.92 : -0.45;
      const elevation =
        beatIdx === 1 ? camDistance * 0.44 : beatIdx === 2 ? camDistance * 0.32 : camDistance * 0.34;
      const horiz = camDistance * 0.88;
      const targetExpl = beatIdx === 1 ? 0.72 : beatIdx === 2 ? 0.25 : 0;
      return {
        cam: new THREE.Vector3(
          baseCenter.x + Math.sin(angle) * horiz,
          baseCenter.y + elevation,
          baseCenter.z + Math.cos(angle) * horiz
        ),
        target: new THREE.Vector3(baseCenter.x, baseCenter.y + targetExpl * 1.4, baseCenter.z),
      };
    };

    const clock = new THREE.Clock();
    let rafId = 0;
    let isDisposed = false;

    const shouldRun = () =>
      !isDisposed &&
      stickyVisibleRef.current &&
      !isPausedRef.current &&
      document.visibilityState === 'visible';

    const animate = () => {
      if (!shouldRun()) {
        rafId = 0;
        return;
      }
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const nowSec = clock.elapsedTime;

      syncLabsStageVisuals();

      const beat = activeBeatRef.current;
      const targetExploded = beat === 1 ? 0.72 : beat === 2 ? 0.25 : 0;
      const wantXray = beat === 2;

      if (beat !== lastBeat) {
        lastBeat = beat;
        beatTransitionStart = nowSec;
        fromCamPos.copy(camera.position);
        fromTargetPos.copy(controls.target);
        const dest = computeBeatCameraVectors(beat);
        toCamPos.copy(dest.cam);
        toTargetPos.copy(dest.target);
      }

      currentExploded = THREE.MathUtils.damp(currentExploded, targetExploded, 4.8, dt);

      // Update exploded elevation tiers smoothly
      for (const mesh of cachedMeshes) {
        const tier = typeof mesh.userData.elevationTier === 'number' ? mesh.userData.elevationTier : 0;
        const origY = typeof mesh.userData.origY === 'number' ? mesh.userData.origY : 0;
        if (tier > 0) {
          mesh.position.y = origY + tier * 3.8 * currentExploded;
        }
      }

      // Toggle X-Ray cleanly when crossing beat 2 boundary
      if (wantXray !== currentXrayActive) {
        currentXrayActive = wantXray;
        for (const mesh of cachedMeshes) {
          if (wantXray) {
            const isInterior = Boolean(mesh.userData.isInterior);
            mesh.material = isInterior ? xrayInteriorMat : xrayShellMat;
          } else if (mesh.userData.origMaterialRef) {
            mesh.material = mesh.userData.origMaterialRef;
          }
        }
      }

      // Smooth 0.8s camera lerp when switching views, then museum turntable OrbitControls
      if (beatTransitionStart > 0 && nowSec - beatTransitionStart <= beatLerpDurationSec && !userInteracting) {
        const progress = Math.min(1, (nowSec - beatTransitionStart) / beatLerpDurationSec);
        const ease = 1 - Math.pow(1 - progress, 3);
        camera.position.lerpVectors(fromCamPos, toCamPos, ease);
        controls.target.lerpVectors(fromTargetPos, toTargetPos, ease);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    const startStickyLoop = () => {
      if (rafId === 0 && shouldRun()) {
        clock.getDelta();
        animate();
      }
    };
    resumeStickyLoopRef.current = startStickyLoop;

    const io = new IntersectionObserver(
      (entries) => {
        stickyVisibleRef.current = entries[0]?.isIntersecting ?? false;
        if (stickyVisibleRef.current) {
          startStickyLoop();
        }
      },
      { threshold: 0.05 }
    );
    io.observe(wrapper);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        startStickyLoop();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const handleResize = () => {
      if (!host) return;
      const w = host.clientWidth || 720;
      const h = host.clientHeight || 540;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Initial frame render + start loop if visible
    renderer.render(scene, camera);
    startStickyLoop();

    if (isGlbOnlySticky && stickyGlbSource.url) {
      setStickyGlbLoading(true);
      setStickyGlbError(null);
      void loadAndNormalizeGlb(stickyGlbSource.url, {
        targetMaxDim: 26,
        groundY: 0,
        maxAnisotropy: 4,
      })
        .then((res) => {
          if (isDisposed) return;
          modelGroup.add(res.root);
          registerMeshesAndFit();
          const newCenter = fitCameraForStage(camera, modelGroup, 1.48);
          baseCenter.copy(newCenter);
          camDistance = camera.position.distanceTo(baseCenter);
          controls.target.copy(baseCenter);
          controls.update();
          setStickyGlbLoading(false);
          renderer.render(scene, camera);
        })
        .catch((err) => {
          if (isDisposed) return;
          setStickyGlbError(err instanceof Error ? err.message : 'Không thể nạp tệp .glb');
          setStickyGlbLoading(false);
        });
    }

    return () => {
      isDisposed = true;
      resumeStickyLoopRef.current = null;
      if (rafId) cancelAnimationFrame(rafId);
      io.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('end', onControlEnd);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      while (wireOverlays.length > 0) {
        const ov = wireOverlays.pop();
        ov?.parent?.remove(ov);
      }
      labsWireframeMat.dispose();
      xrayShellMat.dispose();
      xrayInteriorMat.dispose();
      disposeObject3D(stageGroup);
      scene.clear();
      envRT.dispose();
      renderer.dispose();
      host.innerHTML = '';
    };
  }, [selectedSite.id, stickyGlbSource.url, stickyGlbSource.updatedAt]);

  // Representative sites for Apple Bento Grid
  const primaryBentoSite = useMemo(
    () => sites.find((s) => s.id === 'HCM-DT-001') || sites[0],
    [sites]
  );
  const cuChiSite = useMemo(
    () => sites.find((s) => s.id === 'HCM-DT-009') || sites[1],
    [sites]
  );
  const extraBentoSites = useMemo(() => {
    const ids = ['HCM-DT-002', 'HCM-DT-003', 'BRVT-DT-001', 'BD-DT-001'];
    return ids.map((id) => sites.find((s) => s.id === id)).filter((s): s is HeritageSite => Boolean(s));
  }, [sites]);

  const beats = useMemo(
    () => [
      {
        index: 0 as const,
        eyebrow: lang === 'en' ? '01 · ORIGINAL ARCHITECTURE' : lang === 'zh' ? '01 · 原貌建筑' : '01 · KIẾN TRÚC NGUYÊN BẢN',
        title:
          lang === 'en'
            ? 'Millimeter-Accurate Digital Twin.'
            : lang === 'zh'
            ? '毫米级三维数字孪生。'
            : 'Bản sao số chuẩn xác đến từng chi tiết.',
        body:
          lang === 'en'
            ? `Explore ${locSelected.officialName} (${selectedSite.commencementYear}) with physically based lighting, authentic stone & brick textures, and 360° spatial depth.`
            : lang === 'zh'
            ? `鉴赏 ${locSelected.officialName}（${selectedSite.commencementYear}年），采用真实物理光照与砖石木构材质，精准还原 ${locSelected.architecturalStyle} 的空间比例。`
            : `Chiêm ngưỡng ${locSelected.officialName} (${selectedSite.commencementYear}) với vật liệu phản xạ ánh sáng thực tế, giữ nguyên tỷ lệ kiến trúc ${locSelected.architecturalStyle}.`,
      },
      {
        index: 1 as const,
        eyebrow: lang === 'en' ? '02 · EXPLODED ANATOMY' : lang === 'zh' ? '02 · 3D 拆解结构' : '02 · BÓC TÁCH KẾT CẤU',
        title:
          lang === 'en'
            ? 'Every Roof, Truss & Level Separated.'
            : lang === 'zh'
            ? '屋顶、桁架与地下结构逐层分离。'
            : 'Tách lớp từng tầng mái, hệ khung và nền móng.',
        body:
          lang === 'en'
            ? 'Watch upper roofs, colonnades, and subterranean tunnels lift smoothly along vertical structural axes — inspired by Apple Pro hardware teardowns.'
            : lang === 'zh'
            ? '以 60FPS 流畅度将屋顶、花格幕墙、立柱与地下掩体沿垂直轴向逐层拆解，清晰呈现内部承重构造。'
            : 'Quan sát phần mái, rèm hoa đá, khung cột và các tầng hầm ngầm tách lớp theo phương thẳng đứng mượt mà 60FPS, lộ rõ cấu tạo chịu lực bên trong.',
      },
      {
        index: 2 as const,
        eyebrow: lang === 'en' ? '03 · X-RAY & INTERIOR' : lang === 'zh' ? '03 · X光透视与内部空间' : '03 · CHẾ ĐỘ X-RAY & NỘI THẤT THẬT',
        title:
          lang === 'en'
            ? 'See Inside History.'
            : lang === 'zh'
            ? '穿透墙体，直击历史内部。'
            : 'Nhìn xuyên thấu vào lòng không gian lịch sử.',
        body:
          lang === 'en'
            ? 'Translucent spatial X-Ray reveals inner chambers, secret command bunkers, and structural load paths hidden behind historic facades.'
            : lang === 'zh'
            ? '建筑外立面转为湛蓝 X光半透明视图，完整展现隐藏在墙体内部的礼堂、指挥地堡与地下坑道网。'
            : 'Lớp vỏ kiến trúc chuyển sang trong suốt X-Ray ánh lam, phô diễn toàn bộ nội thất, hội trường và đường hầm ngầm ẩn sâu bên trong công trình.',
      },
    ],
    [lang, locSelected.officialName, locSelected.architecturalStyle, selectedSite.commencementYear]
  );

  return (
    <div className="w-full bg-[#D8C9A9] text-[#171817]">
      {/* ====================================================================
          PART 1: VIETNAM HERITAGE EDITORIAL HERO — ASYMMETRIC 5/7 SPLIT
         ==================================================================== */}
      <section className="w-full pl-8 md:pl-16 lg:pl-24 pr-0 py-10 overflow-hidden bg-[#D8C9A9]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* CỘT TRÁI (5 cột ~ 42%): Tiêu đề Lora 3 dòng thanh thoát, mô tả & 2 liên kết mũi tên trần */}
          <div className="lg:col-span-5 pr-8 lg:pr-4">
            <h1
              className="font-['Lora'] text-[38px] lg:text-[44px] font-normal text-[#171817] leading-[1.2] tracking-tight"
              style={{ fontVariantNumeric: 'lining-nums' }}
            >
              {lang === 'en' ? (
                <>
                  Explore Southern
                  <br />
                  Architectural Heritage
                  <br />
                  &amp; Living History
                </>
              ) : lang === 'zh' ? (
                <>
                  探索越南南部
                  <br />
                  建筑遗产与百年
                  <br />
                  历史印记
                </>
              ) : (
                <>
                  Khám phá Di sản
                  <br />
                  Kiến trúc &amp; Lịch sử
                  <br />
                  Vùng đất Nam Bộ
                </>
              )}
            </h1>

            <p className="mt-5 text-[14.5px] leading-[1.7] text-[#171817]/75 max-w-[360px] font-normal">
              {lang === 'en'
                ? `Dấu Ấn Việt 3D Digital Museum — reconstructing ${sites.length} iconic Southeastern Vietnamese monuments through architectural dissection and curated archives.`
                : lang === 'zh'
                ? `越印 3D 数字博物馆 — 通过建筑结构三维解构与历史文献档案，呈现越南东南部 ${sites.length} 处代表性文化遗产工程。`
                : `Bảo tàng số Dấu Ấn Việt 3D — không gian phục dựng ${sites.length} công trình di tích tiêu biểu vùng Đông Nam Bộ qua mô hình giải phẫu kiến trúc và tư liệu khảo cứu.`}
            </p>

            <div className="mt-7 flex flex-col items-start gap-3">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('soft');
                  choreographySectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-[14.5px] font-semibold text-[#A94F3D] hover:text-[#171817] transition-colors flex items-center gap-2.5 group cursor-pointer"
              >
                <span
                  className="inline-block transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                >
                  →
                </span>
                <span>
                  {lang === 'en'
                    ? 'Explore 3D Dissection'
                    : lang === 'zh'
                    ? '探索 3D 结构解剖'
                    : 'Khám phá bóc tách 3D'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('soft');
                  onOpenAudioModal(selectedSite);
                }}
                className="text-[14.5px] font-semibold text-[#47796D] hover:text-[#171817] transition-colors flex items-center gap-2.5 group cursor-pointer"
              >
                <span
                  className="inline-block transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                >
                  →
                </span>
                <span>
                  {lang === 'en'
                    ? 'Listen to Museum Audio Guide'
                    : lang === 'zh'
                    ? '收听博物馆语音导览'
                    : 'Nghe thuyết minh bảo tàng'}
                </span>
              </button>
            </div>
          </div>

          {/* CỘT PHẢI (7 cột ~ 58%): Dải thẻ phân mảng màu sắc tố & Thanh điều hướng nét chấm */}
          <div className="lg:col-span-7 min-w-0">
            <div
              ref={heroCardsTrackRef}
              onScroll={handleHeroTrackScroll}
              onMouseDown={handleHeroTrackMouseDown}
              className={`flex gap-6 overflow-x-auto hero-cards-scrollbar pr-16 pt-2 pb-4 select-none ${
                isDraggingCards ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'
              }`}
              style={{ perspective: '1200px' }}
            >
              {sites.map((site, idx) => {
                const loc = getLocalizedSite(site);
                const cleanTitle = loc.officialName.split(/\s*[（(]/)[0];
                const isSelected = site.id === selectedSite.id;
                const activeSlot = getCardPhotoSlot(site.id);
                const photoUrl = resolveHeroPhoto(site, activeSlot);
                const indexPadded = String(idx + 1).padStart(2, '0');
                const block = getHeritageColorBlock(site, lang as 'vi' | 'en' | 'zh');
                const rankingShort =
                  lang === 'en'
                    ? site.rankingLevel === 'Special National'
                      ? 'Special National'
                      : 'National Heritage'
                    : lang === 'zh'
                    ? site.rankingLevel === 'Special National'
                      ? '国家级特别遗迹'
                      : '国家级遗迹'
                    : site.rankingLevel === 'Special National'
                    ? 'Di tích Quốc gia Đặc biệt'
                    : 'Di tích Quốc gia';
                const hasPhoto = Boolean(photoUrl && !failedPhotoMap[`hero:${site.id}:${photoUrl}`]);

                return (
                  <article
                    key={site.id}
                    onMouseMove={tiltHandlers.onMouseMove}
                    onMouseLeave={tiltHandlers.onMouseLeave}
                    onClick={(e) => {
                      if (dragDistanceRef.current >= 5) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      triggerHaptic('selection');
                      onSelectSite(site);
                      choreographySectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{
                      backgroundColor: block.bg,
                      color: block.fg,
                    }}
                    className={`w-[270px] sm:w-[285px] h-[420px] rounded-2xl overflow-hidden relative shrink-0 cursor-grab active:cursor-grabbing group border transition-all duration-300 flex flex-col ${
                      isSelected
                        ? 'border-[#171817] ring-2 ring-[#171817]/40 shadow-[0_18px_40px_rgba(23,24,23,0.22)]'
                        : 'border-[#171817]/20 hover:border-[#171817]/70 shadow-[0_12px_28px_rgba(23,24,23,0.14)]'
                    }`}
                  >
                    <div
                      data-tilt-glow="true"
                      className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300"
                    />

                    {/* Nút chuyển nhanh Ảnh 01 | 02 ở góc trên bên phải mỗi thẻ di tích */}
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-3 right-3 z-30 inline-flex items-center rounded-full bg-[#F4EFE4]/95 border border-[#171817]/25 p-0.5 shadow-sm"
                    >
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('selection');
                          setCardPhotoSlot(site.id, 0);
                        }}
                        className={`px-2 py-0.5 rounded-full text-[10.5px] font-sans font-semibold tabular-nums transition-colors cursor-pointer ${
                          activeSlot === 0
                            ? 'bg-[#171817] text-[#D8C9A9]'
                            : 'text-[#171817]/75 hover:text-[#171817]'
                        }`}
                      >
                        01
                      </button>
                      <span className="text-[#171817]/25 text-[10px] px-0.5 select-none" aria-hidden="true">
                        |
                      </span>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('selection');
                          setCardPhotoSlot(site.id, 1);
                        }}
                        className={`px-2 py-0.5 rounded-full text-[10.5px] font-sans font-semibold tabular-nums transition-colors cursor-pointer ${
                          activeSlot === 1
                            ? 'bg-[#171817] text-[#D8C9A9]'
                            : 'text-[#171817]/75 hover:text-[#171817]'
                        }`}
                      >
                        02
                      </button>
                    </div>

                    {hasPhoto ? (
                      <div className="w-full h-full flex flex-col justify-between">
                        <div
                          className="relative aspect-video w-full overflow-hidden shrink-0 bg-[#171817]"
                          style={{ borderBottom: `1px solid ${block.hairline}` }}
                        >
                          <HeritageSmoothImage
                            src={photoUrl}
                            alt={cleanTitle}
                            loading={idx < 4 ? 'eager' : 'lazy'}
                            waitTone="dark"
                            onError={() => markPhotoFailed(`hero:${site.id}:${photoUrl}`)}
                            className="w-full h-full object-cover object-center group-hover:scale-105 transition-[opacity,transform] duration-500"
                            draggable={false}
                          />
                        </div>

                        <div
                          className="p-5 flex-1 flex flex-col justify-between"
                          style={{ color: block.fg }}
                        >
                          <div>
                            <div
                              className="text-[11px] font-medium uppercase tracking-[0.07em] tabular-nums"
                              style={{ color: block.mutedFg }}
                            >
                              {indexPadded} · {rankingShort}
                            </div>
                            <h2
                              className="font-['Lora'] text-[21px] leading-[1.25] mt-1 line-clamp-2 font-normal"
                              style={{ fontVariantNumeric: 'lining-nums', color: block.fg }}
                            >
                              {cleanTitle}
                            </h2>
                            <p
                              className="text-[12.5px] leading-[1.5] mt-2 line-clamp-2"
                              style={{ color: block.mutedFg }}
                            >
                              {loc.summary}
                            </p>
                          </div>

                          <div
                            className="pt-2 text-[13px] font-semibold flex items-center gap-2"
                            style={{ color: block.fg }}
                          >
                            <span>
                              {lang === 'en'
                                ? 'Explore now'
                                : lang === 'zh'
                                ? '立即探索'
                                : 'Khám phá ngay'}
                            </span>
                            <span
                              className="inline-block transition-transform duration-200 group-hover:translate-x-1"
                              aria-hidden="true"
                            >
                              →
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      (() => {
                        const palette = getHeritagePlatePalette(site.id, idx);
                        return (
                          <div className="w-full h-full flex flex-col justify-between">
                            <HeritageTypographicPlate
                              site={site}
                              index={idx}
                              variant="hero"
                              className="!pb-2 flex-1"
                            />
                            <div
                              className="px-6 pb-6 pt-3 flex flex-col justify-end"
                              style={{
                                color: palette.fg,
                                borderTop: `1px solid ${palette.hairline}`,
                              }}
                            >
                              <div
                                className="text-[11px] font-medium uppercase tracking-[0.08em] tabular-nums"
                                style={{ color: palette.mutedFg }}
                              >
                                {indexPadded} · {rankingShort}
                              </div>
                              <h2
                                className="font-['Lora'] text-[22px] leading-[1.25] mt-1 line-clamp-2 font-normal"
                                style={{ fontVariantNumeric: 'lining-nums', color: palette.fg }}
                              >
                                {cleanTitle}
                              </h2>
                              <p
                                className="text-[13px] leading-[1.55] mt-2 line-clamp-2"
                                style={{ color: palette.mutedFg }}
                              >
                                {loc.summary}
                              </p>

                              <div
                                className="mt-4 text-[13px] font-semibold transition-opacity flex items-center gap-2"
                                style={{ color: palette.fg }}
                              >
                                <span>
                                  {lang === 'en'
                                    ? 'Explore now'
                                    : lang === 'zh'
                                    ? '立即探索'
                                    : 'Khám phá ngay'}
                                </span>
                                <span
                                  className="inline-block transition-transform duration-200 group-hover:translate-x-1"
                                  aria-hidden="true"
                                >
                                  →
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </article>
                );
              })}
            </div>

            {/* Thanh điều hướng nét chấm dưới góc phải */}
            <div className="mt-5 pr-8 md:pr-14 flex items-center justify-end gap-3.5 text-[13px] text-[#171817]/75">
              <span>
                {lang === 'en'
                  ? 'Scroll for more'
                  : lang === 'zh'
                  ? '滑动浏览更多'
                  : 'Lướt xem thêm'}
              </span>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  scrollHeroCards(-1);
                }}
                aria-label={
                  lang === 'en'
                    ? 'Scroll left'
                    : lang === 'zh'
                    ? '向左滑动'
                    : 'Lướt sang trái'
                }
                className="w-7 h-7 rounded-full border border-[#171817]/25 bg-[#EDE4D0] flex items-center justify-center text-[#171817] hover:border-[#A94F3D] hover:bg-[#A94F3D] hover:text-[#D8C9A9] transition cursor-pointer shrink-0"
              >
                ←
              </button>

              <div className="w-32 h-2 relative flex items-center">
                <div className="w-full border-b-2 border-dotted border-[#171817]/30" />
                <div
                  className="absolute left-0 top-1/2 -translate-y-[1px] h-[2px] bg-[#A94F3D] transition-all duration-150"
                  style={{ width: `${Math.max(10, heroScrollProgress * 100)}%` }}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  scrollHeroCards(1);
                }}
                aria-label={
                  lang === 'en'
                    ? 'Scroll right'
                    : lang === 'zh'
                    ? '向右滑动'
                    : 'Lướt sang phải'
                }
                className="w-7 h-7 rounded-full border border-[#171817]/25 bg-[#EDE4D0] flex items-center justify-center text-[#171817] hover:border-[#A94F3D] hover:bg-[#A94F3D] hover:text-[#D8C9A9] transition cursor-pointer shrink-0"
              >
                →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          PART 2: STICKY SCROLL-DRIVEN 3D CHOREOGRAPHY (240vh)
         ==================================================================== */}
      <section
        ref={choreographySectionRef}
        className="relative max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 border-t border-[#171817]/15"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left: 3 Scrolling Editorial Beats */}
          <div className="lg:col-span-5 space-y-12 lg:space-y-24 lg:py-[18vh]">
            {beats.map((beat) => {
              const isActive = activeBeat === beat.index;
              return (
                <div
                  key={beat.index}
                  onClick={() => setActiveBeat(beat.index)}
                  className={`cursor-pointer transition-all duration-500 p-6 rounded-[24px] border ${
                    isActive
                      ? 'opacity-100 bg-[#F4EFE4] border-[#A94F3D] shadow-[0_16px_40px_rgba(23,24,23,0.12)]'
                      : 'opacity-65 hover:opacity-95 bg-[#EDE4D0]/70 border-[#171817]/15'
                  }`}
                >
                  <div className="font-sans text-[13px] font-semibold text-[#A94F3D] mb-2">
                    {beat.eyebrow}
                  </div>
                  <h2
                    className="font-serif text-2xl sm:text-4xl font-medium tracking-tight text-[#171817] leading-tight"
                    style={{ fontVariantNumeric: 'lining-nums' }}
                  >
                    {beat.title}
                  </h2>
                  <p className="font-sans mt-3 text-sm sm:text-base text-[#171817]/75 leading-relaxed">{beat.body}</p>

                  {isActive && beat.index === 2 && (
                    <div className="mt-5 flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen3D(selectedSite);
                        }}
                        className="px-4 py-2 rounded-full bg-[#A94F3D] hover:bg-[#914030] text-[#D8C9A9] text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
                      >
                        <Scan className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'en'
                            ? 'Open Fullscreen X-Ray Studio'
                            : lang === 'zh'
                            ? '打开全屏 X光透视工作室'
                            : 'Mở Studio X-Ray Toàn màn hình'}
                        </span>
                        {!isAuthenticated && <Lock className="w-3 h-3 shrink-0" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('soft');
                          onOpenLisboaSplit();
                        }}
                        className="px-4 py-2 rounded-full bg-[#47796D] hover:bg-[#3A645A] active:scale-[0.97] text-[#171817] text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-all duration-150"
                      >
                        <span>
                          {lang === 'en'
                            ? 'Past & Present Split'
                            : lang === 'zh'
                            ? '古今对比滑块'
                            : 'Kéo chéo Xưa & Nay'}
                        </span>
                        {!isAuthenticated && <Lock className="w-3 h-3 shrink-0" />}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Sticky 3D Stage (#171817 WebGL canvas) + 1px SVG Structural Leader Lines */}
          <div
            ref={stickyStageWrapperRef}
            className="lg:col-span-7 lg:sticky lg:top-20 h-[56vh] min-h-[380px] lg:h-[calc(100vh-7rem)] rounded-[28px] overflow-hidden bg-[#171817] border border-[#171817]/25 shadow-[0_24px_60px_rgba(23,24,23,0.22)] relative"
          >
            {/* Isolated WebGL Host */}
            <div ref={stickyCanvasHostRef} className="w-full h-full" />

            {/* GLB-ONLY LOADING OR DIRECT UPLOAD CARD */}
            {GLB_ONLY_SITE_IDS.has(selectedSite.id) && stickyGlbLoading && (
              <div className="absolute inset-0 z-20 bg-[#171817]/95 flex items-center justify-center p-6">
                <div className="w-full max-w-xs space-y-2.5 text-left">
                  <span className="text-[10.5px] font-sans font-semibold uppercase tracking-[0.14em] text-[#C9A46A] block">
                    {lang === 'en' ? 'LOADING .GLB' : lang === 'zh' ? '正在加载 .GLB' : 'ĐANG NẠP .GLB'}
                  </span>
                  <div className="w-full h-1 bg-[#D8C9A9]/15 rounded-full overflow-hidden">
                    <div className="h-full w-2/3 bg-[#C9A46A] rounded-full" />
                  </div>
                </div>
              </div>
            )}

            {GLB_ONLY_SITE_IDS.has(selectedSite.id) &&
              !stickyGlbLoading &&
              (!stickyGlbSource.url || Boolean(stickyGlbError)) && (
                <div className="absolute inset-0 z-20 flex items-center justify-center p-4 pointer-events-none">
                  <div className="pointer-events-auto max-w-sm w-full rounded-sm bg-[#171817]/95 border border-[#C9A46A]/45 p-5 shadow-2xl space-y-3 text-left">
                    <span className="text-[10.5px] font-sans font-semibold uppercase tracking-[0.14em] text-[#C9A46A] block">
                      {lang === 'en'
                        ? 'REAL .GLB MODEL ONLY'
                        : lang === 'zh'
                        ? '仅支持真实 .GLB 模型'
                        : 'MÔ HÌNH .GLB THỰC TẾ'}
                    </span>
                    <h4 className="font-serif text-base font-bold text-[#D8C9A9]">
                      {locSelected.officialName}
                    </h4>
                    <p className="text-xs text-[#D8C9A9]/80 leading-relaxed">
                      {stickyGlbError
                        ? stickyGlbError
                        : lang === 'en'
                        ? 'Upload a .glb file from your computer to preview this monument in 3D.'
                        : lang === 'zh'
                        ? '从电脑选择真实 .glb 文件即可实时浏览三维模型。'
                        : 'Chọn tệp .glb từ máy tính để hiển thị mô hình 3D thật cho di tích này.'}
                    </p>
                    <input
                      ref={stickyGlbInputRef}
                      type="file"
                      accept=".glb,.gltf,model/gltf-binary"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        setIsSavingStickyGlb(true);
                        setStickyGlbError(null);
                        try {
                          await saveGlbFileToIndexedDB(selectedSite.id, file);
                        } catch (err) {
                          setStickyGlbError(
                            err instanceof Error ? err.message : 'Không thể nạp tệp .glb'
                          );
                        } finally {
                          setIsSavingStickyGlb(false);
                        }
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isSavingStickyGlb}
                      onClick={() => stickyGlbInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-sm bg-[#C9A46A] hover:bg-[#D8C9A9] text-[#171817] text-xs font-semibold cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {isSavingStickyGlb
                          ? lang === 'en'
                            ? 'Saving...'
                            : lang === 'zh'
                            ? '正在保存...'
                            : 'Đang nạp...'
                          : lang === 'en'
                          ? 'Choose .glb file from computer'
                          : lang === 'zh'
                          ? '从电脑选择 .glb 文件'
                          : 'Chọn tệp .glb từ máy tính'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

            {/* Beat Selector Pills Top-Left */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-1 rounded-full bg-[#F4EFE4]/95 backdrop-blur-xl border border-[#171817]/20 p-1 shadow-md">
              {[
                {
                  idx: 0 as const,
                  label: lang === 'en' ? 'Original' : lang === 'zh' ? '原貌' : 'Nguyên bản',
                },
                {
                  idx: 1 as const,
                  label: lang === 'en' ? '3D Exploded' : lang === 'zh' ? '3D拆解' : 'Bóc tách 3D',
                },
                {
                  idx: 2 as const,
                  label: lang === 'en' ? 'X-Ray' : lang === 'zh' ? 'X光透视' : 'X-Ray',
                },
              ].map((tab) => (
                <button
                  key={tab.idx}
                  type="button"
                  onClick={() => setActiveBeat(tab.idx)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    activeBeat === tab.idx
                      ? 'bg-[#A94F3D] text-[#D8C9A9]'
                      : 'text-[#171817]/75 hover:text-[#171817]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 1px Technical SVG Leader Lines during Exploded Beat (Beat 1) */}
            {activeBeat === 1 && (
              <div className="absolute inset-0 pointer-events-none z-10">
                <svg className="w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="none">
                  {/* Callout 1: Upper Roof / Canopy */}
                  <polyline
                    points="380,155 470,115 585,115"
                    fill="none"
                    stroke="rgba(216,201,169,0.55)"
                    strokeWidth="1"
                  />
                  <circle cx="380" cy="155" r="4" fill="#C9A46A" />
                  <circle cx="380" cy="155" r="8" fill="none" stroke="rgba(201,164,106,0.55)" strokeWidth="1" />

                  {/* Callout 2: Structural Mid Facade */}
                  <polyline
                    points="355,305 230,275 115,275"
                    fill="none"
                    stroke="rgba(216,201,169,0.55)"
                    strokeWidth="1"
                  />
                  <circle cx="355" cy="305" r="4" fill="#A94F3D" />
                  <circle cx="355" cy="305" r="8" fill="none" stroke="rgba(169,79,61,0.55)" strokeWidth="1" />

                  {/* Callout 3: Foundation / Subterranean Tier */}
                  <polyline
                    points="430,430 520,465 620,465"
                    fill="none"
                    stroke="rgba(216,201,169,0.55)"
                    strokeWidth="1"
                  />
                  <circle cx="430" cy="430" r="4" fill="#47796D" />
                </svg>

                {/* Text Labels anchored neatly beside leader lines */}
                <div className="hidden sm:block absolute top-[15%] right-6 rounded-xl bg-[#F4EFE4]/95 backdrop-blur-xl border border-[#171817]/20 px-3 py-1.5 text-[11px] text-[#171817] shadow-md">
                  <span className="text-[#A94F3D] font-semibold block">
                    {lang === 'en'
                      ? 'Roof & Crown Tier'
                      : lang === 'zh'
                      ? '屋顶与塔尖层'
                      : 'Tầng mái & Đỉnh chóp'}
                  </span>
                  <span className="text-[#171817]/75">
                    {locSelected.hotspots?.[0]?.name ||
                      featuredFeatures[0]?.name ||
                      locSelected.architecturalStyle}
                  </span>
                </div>
                <div className="hidden sm:block absolute top-[41%] left-5 rounded-xl bg-[#F4EFE4]/95 backdrop-blur-xl border border-[#171817]/20 px-3 py-1.5 text-[11px] text-[#171817] shadow-md">
                  <span className="text-[#526D8B] font-semibold block">
                    {lang === 'en'
                      ? 'Structural Load Frame'
                      : lang === 'zh'
                      ? '承重框架结构'
                      : 'Hệ khung chịu lực'}
                  </span>
                  <span className="text-[#171817]/75">{(locSelected.materials || []).slice(0, 2).join(' · ')}</span>
                </div>
                <div className="hidden sm:block absolute bottom-[16%] right-6 rounded-xl bg-[#F4EFE4]/95 backdrop-blur-xl border border-[#171817]/20 px-3 py-1.5 text-[11px] text-[#171817] shadow-md">
                  <span className="text-[#47796D] font-semibold block">
                    {lang === 'en'
                      ? 'Foundation & Stratum'
                      : lang === 'zh'
                      ? '基础与地下岩层'
                      : 'Nền móng & Địa tầng'}
                  </span>
                  <span className="font-sans text-[11px] text-[#171817]/75 tabular-nums">
                    {selectedSite.gps.lat.toFixed(4)}°N, {selectedSite.gps.lng.toFixed(4)}°E
                  </span>
                </div>
              </div>
            )}

            {/* Bottom-Right Subtle Status Pill */}
            <div className="absolute bottom-4 right-4 z-10 pointer-events-none rounded-full bg-[#F4EFE4]/95 backdrop-blur-xl border border-[#171817]/20 px-3.5 py-1.5 text-xs font-medium text-[#171817] shadow-md">
              {activeBeat === 0
                ? lang === 'en'
                  ? 'Original · Solid PBR'
                  : lang === 'zh'
                  ? '原貌 · PBR 真实材质'
                  : 'Nguyên bản · Vật liệu PBR'
                : activeBeat === 1
                ? lang === 'en'
                  ? '3D Exploded · +72%'
                  : lang === 'zh'
                  ? '3D拆解 · +72%'
                  : 'Bóc tách 3D · +72%'
                : lang === 'en'
                ? 'X-Ray · Interior Cut'
                : lang === 'zh'
                ? 'X光透视 · 内部剖面'
                : 'X-Ray · Mặt cắt nội thất'}
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          PART 3: COLOR-BLOCKED CURATORIAL BENTO GRID SHOWCASE
         ==================================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 border-t border-[#171817]/15 space-y-10">
        {onStartGuidedTour && onStartMasterpiece && (
          <GuidedTourStarterSection
            tours={guidedTours}
            isAuthenticated={isAuthenticated}
            masterpieceSite={masterpieceSite}
            onStartTour={onStartGuidedTour}
            onStartMasterpiece={onStartMasterpiece}
          />
        )}

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="font-sans text-[13px] font-semibold uppercase tracking-[0.12em] text-[#A94F3D] block">
              {lang === 'en' ? 'Curated Showcase' : lang === 'zh' ? '精选馆藏展区' : 'Không gian trưng bày'}
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-medium tracking-tight text-[#171817] mt-1">
              {lang === 'en'
                ? 'Explore every facet of heritage.'
                : lang === 'zh'
                ? '多维度探索越南南疆文化遗产。'
                : 'Khám phá toàn diện Di sản Đông Nam Bộ.'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('catalog')}
            className="text-sm font-semibold text-[#A94F3D] hover:text-[#171817] flex items-center gap-1.5 cursor-pointer self-start sm:self-end transition-colors"
          >
            <span>
              {lang === 'en'
                ? `View all ${sites.length} monuments`
                : lang === 'zh'
                ? `查看全部 ${sites.length} 处遗产档案`
                : `Xem tất cả ${sites.length} hồ sơ`}
            </span>
            {!isAuthenticated && <Lock className="w-3 h-3 shrink-0" />}
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {/* Row 1: Asymmetric Large Bento Cards */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Featured Card 1 (7 cols) */}
          {primaryBentoSite && (() => {
            const pSlot = getCardPhotoSlot(primaryBentoSite.id);
            const pPhoto = resolveHeroPhoto(primaryBentoSite, pSlot);
            const hasPrimaryPhoto = Boolean(pPhoto && !failedPhotoMap[`bento:${primaryBentoSite.id}:${pPhoto}`]);
            const block = getHeritageColorBlock(primaryBentoSite, lang as 'vi' | 'en' | 'zh');
            return (
            <article
              onClick={() => onOpenDetailModal(primaryBentoSite)}
              onMouseMove={tiltHandlers.onMouseMove}
              onMouseLeave={tiltHandlers.onMouseLeave}
              style={{ backgroundColor: block.bg, color: block.fg }}
              className="museum-tilt-card md:col-span-7 group relative min-h-[380px] rounded-[28px] border border-[#171817]/20 overflow-hidden cursor-pointer flex flex-col justify-between shadow-[0_16px_40px_rgba(23,24,23,0.14)]"
            >
              <div
                data-tilt-glow="true"
                className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300"
              />
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-3.5 right-3.5 z-30 inline-flex items-center rounded-full bg-[#F4EFE4]/95 border border-[#171817]/25 p-0.5 shadow-sm"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCardPhotoSlot(primaryBentoSite.id, 0);
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10.5px] font-sans font-semibold tabular-nums transition-colors cursor-pointer ${
                    pSlot === 0 ? 'bg-[#171817] text-[#D8C9A9]' : 'text-[#171817]/75 hover:text-[#171817]'
                  }`}
                >
                  01
                </button>
                <span className="text-[#171817]/25 text-[10px] px-0.5 select-none" aria-hidden="true">|</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCardPhotoSlot(primaryBentoSite.id, 1);
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10.5px] font-sans font-semibold tabular-nums transition-colors cursor-pointer ${
                    pSlot === 1 ? 'bg-[#171817] text-[#D8C9A9]' : 'text-[#171817]/75 hover:text-[#171817]'
                  }`}
                >
                  02
                </button>
              </div>
              {hasPrimaryPhoto ? (
                <div
                  className="aspect-video w-full overflow-hidden bg-[#171817] shrink-0"
                  style={{ borderBottom: `1px solid ${block.hairline}` }}
                >
                  <HeritageSmoothImage
                    src={pPhoto}
                    alt={getLocalizedSite(primaryBentoSite).officialName}
                    loading="lazy"
                    waitTone="dark"
                    onError={() => markPhotoFailed(`bento:${primaryBentoSite.id}:${pPhoto}`)}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-[opacity,transform] duration-500"
                  />
                </div>
              ) : (
                <div
                  className="pointer-events-none absolute inset-4 border"
                  style={{ borderColor: block.hairline }}
                />
              )}

              <div className="relative z-10 p-7 flex-1 flex flex-col justify-between">
                <div className="max-w-md">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="font-sans text-[12px] font-medium tabular-nums"
                      style={{ color: block.mutedFg }}
                    >
                      {primaryBentoSite.commencementYear} · {primaryBentoSite.identifierCode} ·{' '}
                      {lang === 'en'
                        ? 'Special National Monument'
                        : lang === 'zh'
                        ? '国家级特别遗迹'
                        : 'Di tích Quốc gia Đặc biệt'}
                    </span>
                    {hiddenSiteIds.includes(primaryBentoSite.id) && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#171817] border border-[#C9A46A] text-[#C9A46A] text-[11px] font-semibold">
                        {lang === 'en'
                          ? 'Tester Preview · Hidden'
                          : lang === 'zh'
                          ? '隐藏草稿 · 测试模式'
                          : 'Đang ẩn · Chế độ Tester'}
                      </span>
                    )}
                  </div>
                  <h3
                    className="font-serif text-2xl sm:text-4xl font-medium tracking-tight mt-1.5"
                    style={{ fontVariantNumeric: 'lining-nums', color: block.fg }}
                  >
                    {getLocalizedSite(primaryBentoSite).officialName}
                  </h3>
                  <p
                    className="font-sans text-sm mt-2 line-clamp-2"
                    style={{ color: block.mutedFg }}
                  >
                    {getLocalizedSite(primaryBentoSite).summary}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen3D(primaryBentoSite);
                    }}
                    className="px-4 py-2 rounded-full bg-[#171817] hover:bg-[#171817]/90 text-[#D8C9A9] text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>
                      {lang === 'en'
                        ? 'Open 3D X-Ray'
                        : lang === 'zh'
                        ? '打开 3D X光透视'
                        : 'Mở 3D X-Ray'}
                    </span>
                    {!isAuthenticated && <Lock className="w-3 h-3 shrink-0" />}
                  </button>
                  {!hasPrimaryPhoto && (
                    <span
                      className="font-serif text-5xl leading-none font-normal tabular-nums opacity-35 ml-auto mr-3"
                      style={{ color: block.fg, fontVariantNumeric: 'lining-nums' }}
                    >
                      01
                    </span>
                  )}
                  <span
                    style={{
                      backgroundColor: block.badgeBg,
                      color: block.badgeFg,
                      borderColor: block.hairline,
                    }}
                    className="w-9 h-9 rounded-full border flex items-center justify-center transition-transform group-hover:scale-105"
                  >
                    {!isAuthenticated ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
                  </span>
                </div>
              </div>
            </article>
            );
          })()}

          {/* Featured Card 2 (5 cols) */}
          {cuChiSite && (() => {
            const cSlot = getCardPhotoSlot(cuChiSite.id);
            const cPhoto = resolveHeroPhoto(cuChiSite, cSlot);
            const hasCuChiPhoto = Boolean(cPhoto && !failedPhotoMap[`bento:${cuChiSite.id}:${cPhoto}`]);
            const block = getHeritageColorBlock(cuChiSite, lang as 'vi' | 'en' | 'zh');
            return (
            <article
              onClick={() => onOpenDetailModal(cuChiSite)}
              onMouseMove={tiltHandlers.onMouseMove}
              onMouseLeave={tiltHandlers.onMouseLeave}
              style={{ backgroundColor: block.bg, color: block.fg }}
              className="museum-tilt-card md:col-span-5 group relative min-h-[380px] rounded-[28px] border border-[#171817]/20 overflow-hidden cursor-pointer flex flex-col justify-between shadow-[0_16px_40px_rgba(23,24,23,0.14)]"
            >
              <div
                data-tilt-glow="true"
                className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300"
              />
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-3.5 right-3.5 z-30 inline-flex items-center rounded-full bg-[#F4EFE4]/95 border border-[#171817]/25 p-0.5 shadow-sm"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCardPhotoSlot(cuChiSite.id, 0);
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10.5px] font-sans font-semibold tabular-nums transition-colors cursor-pointer ${
                    cSlot === 0 ? 'bg-[#171817] text-[#D8C9A9]' : 'text-[#171817]/75 hover:text-[#171817]'
                  }`}
                >
                  01
                </button>
                <span className="text-[#171817]/25 text-[10px] px-0.5 select-none" aria-hidden="true">|</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCardPhotoSlot(cuChiSite.id, 1);
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10.5px] font-sans font-semibold tabular-nums transition-colors cursor-pointer ${
                    cSlot === 1 ? 'bg-[#171817] text-[#D8C9A9]' : 'text-[#171817]/75 hover:text-[#171817]'
                  }`}
                >
                  02
                </button>
              </div>
              {hasCuChiPhoto ? (
                <div
                  className="aspect-video w-full overflow-hidden bg-[#171817] shrink-0"
                  style={{ borderBottom: `1px solid ${block.hairline}` }}
                >
                  <HeritageSmoothImage
                    src={cPhoto}
                    alt={getLocalizedSite(cuChiSite).officialName}
                    loading="lazy"
                    waitTone="dark"
                    onError={() => markPhotoFailed(`bento:${cuChiSite.id}:${cPhoto}`)}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-[opacity,transform] duration-500"
                  />
                </div>
              ) : (
                <div
                  className="pointer-events-none absolute inset-4 border"
                  style={{ borderColor: block.hairline }}
                />
              )}

              <div className="relative z-10 p-7 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="font-sans text-[12px] font-medium tabular-nums"
                      style={{ color: block.mutedFg }}
                    >
                      {lang === 'en'
                        ? `3 Underground Strata · ${cuChiSite.identifierCode}`
                        : lang === 'zh'
                        ? `三层地下坑道结构 · ${cuChiSite.identifierCode}`
                        : `3 tầng địa tầng ngầm · ${cuChiSite.identifierCode}`}
                    </span>
                    {hiddenSiteIds.includes(cuChiSite.id) && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#171817] border border-[#C9A46A] text-[#C9A46A] text-[11px] font-semibold">
                        {lang === 'en'
                          ? 'Tester Preview · Hidden'
                          : lang === 'zh'
                          ? '隐藏草稿 · 测试模式'
                          : 'Đang ẩn · Chế độ Tester'}
                      </span>
                    )}
                  </div>
                  <h3
                    className="font-serif text-2xl sm:text-3xl font-medium tracking-tight mt-1.5"
                    style={{ fontVariantNumeric: 'lining-nums', color: block.fg }}
                  >
                    {getLocalizedSite(cuChiSite).officialName}
                  </h3>
                  <p
                    className="font-sans text-sm mt-2 line-clamp-2"
                    style={{ color: block.mutedFg }}
                  >
                    {getLocalizedSite(cuChiSite).summary}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen3D(cuChiSite);
                    }}
                    className="px-4 py-2 rounded-full bg-[#171817] hover:bg-[#171817]/90 text-[#D8C9A9] text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>
                      {lang === 'en'
                        ? '3-Level Tunnel Cutaway ↗'
                        : lang === 'zh'
                        ? '三层地下坑道剖面 ↗'
                        : 'Mặt cắt 3 tầng ngầm ↗'}
                    </span>
                    {!isAuthenticated && <Lock className="w-3 h-3 shrink-0" />}
                  </button>
                  <span
                    style={{
                      backgroundColor: block.badgeBg,
                      color: block.badgeFg,
                      borderColor: block.hairline,
                    }}
                    className="w-9 h-9 rounded-full border flex items-center justify-center transition-transform group-hover:scale-105"
                  >
                    {!isAuthenticated ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
                  </span>
                </div>
              </div>
            </article>
            );
          })()}
        </div>

        {/* Row 2: 3 Platform Capabilities Bento Cards (Color-Blocked: Teal, Slate Blue, Gold) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <article
            onClick={() => onNavigateTab('map_routes')}
            className="group rounded-[28px] bg-[#47796D] hover:bg-[#3F6E63] text-[#171817] border border-[#171817]/20 p-7 flex flex-col justify-between min-h-[240px] cursor-pointer transition-all duration-300 shadow-[0_14px_34px_rgba(23,24,23,0.12)]"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <Compass className="w-6 h-6 text-[#171817]" />
                {!isAuthenticated && <Lock className="w-3.5 h-3.5 text-[#171817]/75" />}
              </div>
              <span className="text-[13px] font-medium text-[#171817]/80 block">
                {lang === 'en'
                  ? 'GIS & 1815 Historical Map'
                  : lang === 'zh'
                  ? 'GIS 与 1815 历史古图'
                  : 'GIS & Bản đồ cổ 1815'}
              </span>
              <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#171817] mt-1">
                {lang === 'en'
                  ? 'Map & 7 Regional Routes'
                  : lang === 'zh'
                  ? '地图与 7 条跨区域路线'
                  : 'Bản đồ & 7 Tuyến Liên vùng'}
              </h3>
              <p className="text-xs sm:text-sm text-[#171817]/80 mt-2 leading-relaxed">
                {lang === 'en'
                  ? '1815 Gia Định Citadel time-spyglass lens, 5-layer GIS map, and 7 curated routes connecting HCMC – Bình Dương – Bà Rịa-Vũng Tàu.'
                  : lang === 'zh'
                  ? '1815年嘉定八卦城历史透镜、5层GIS空间地图，以及连接胡志明市、平阳与巴地头顿的7条精选路线。'
                  : 'Thấu kính xuyên không Thành Bát Quái 1815, bản đồ GIS 5 lớp và 7 lộ trình kết nối TP.HCM – Bình Dương – BR-VT.'}
              </p>
            </div>
            <div className="flex justify-end pt-4">
              <span className="w-9 h-9 rounded-full bg-[#171817]/15 group-hover:bg-[#171817] text-[#171817] group-hover:text-[#D8C9A9] flex items-center justify-center transition-colors">
                {!isAuthenticated ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
              </span>
            </div>
          </article>

          <article
            onClick={() => onNavigateTab('catalog')}
            className="group rounded-[28px] bg-[#526D8B] hover:bg-[#49627E] text-[#D8C9A9] border border-[#171817]/20 p-7 flex flex-col justify-between min-h-[240px] cursor-pointer transition-all duration-300 shadow-[0_14px_34px_rgba(23,24,23,0.12)]"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <BookOpen className="w-6 h-6 text-[#D8C9A9]" />
                {!isAuthenticated && <Lock className="w-3.5 h-3.5 text-[#D8C9A9]/80" />}
              </div>
              <span className="text-[13px] font-medium text-[#D8C9A9]/85 block">
                {lang === 'en'
                  ? '17 Dossiers & 300-Year Chronicle'
                  : lang === 'zh'
                  ? '17 份档案与 300 年编年史'
                  : '17 Hồ sơ & Biên niên sử 300 năm'}
              </span>
              <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#D8C9A9] mt-1">
                {lang === 'en'
                  ? 'Heritage Dossiers & Real Photos'
                  : lang === 'zh'
                  ? '遗产档案与实景影像'
                  : 'Hồ sơ Di sản & Ảnh thật'}
              </h3>
              <p className="text-xs sm:text-sm text-[#D8C9A9]/85 mt-2 leading-relaxed">
                {lang === 'en'
                  ? 'VN-2000 / WGS-84 geodetic coordinates, 1698–2026 historical timeline, and verified Wikimedia Commons photography.'
                  : lang === 'zh'
                  ? 'VN-2000 / WGS-84 测绘坐标、1698–2026 历史时间轴，以及维基共享资源实景高清摄影。'
                  : 'Tư liệu tọa độ VN-2000 / WGS-84, dòng chảy lịch sử 1698–2026 và ảnh chụp thực tế Wikimedia Commons.'}
              </p>
            </div>
            <div className="flex justify-end pt-4">
              <span className="w-9 h-9 rounded-full bg-[#171817]/25 group-hover:bg-[#D8C9A9] text-[#D8C9A9] group-hover:text-[#171817] flex items-center justify-center transition-colors">
                {!isAuthenticated ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
              </span>
            </div>
          </article>

          <article
            onClick={() => onNavigateTab('edtech')}
            className="group rounded-[28px] bg-[#C9A46A] hover:bg-[#BE985D] text-[#171817] border border-[#171817]/20 p-7 flex flex-col justify-between min-h-[240px] cursor-pointer transition-all duration-300 shadow-[0_14px_34px_rgba(23,24,23,0.12)]"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <Ticket className="w-6 h-6 text-[#171817]" />
                {!isAuthenticated && <Lock className="w-3.5 h-3.5 text-[#171817]/75" />}
              </div>
              <span className="text-[13px] font-medium text-[#171817]/80 block">
                {lang === 'en'
                  ? '3D Tickets · EdTech · Tourism'
                  : lang === 'zh'
                  ? '3D 门票 · 数字教材 · 文化旅游'
                  : 'Vé 3D · Học liệu số · Du lịch'}
              </span>
              <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#171817] mt-1">
                {lang === 'en'
                  ? '3D Tour Tickets & Digital EdTech'
                  : lang === 'zh'
                  ? '3D 导览门票与数字教材'
                  : 'Vé Tour 3D & Học liệu Số'}
              </h3>
              <p className="text-xs sm:text-sm text-[#171817]/80 mt-2 leading-relaxed">
                {lang === 'en'
                  ? 'Instant QR e-ticket issuance, K-12 local history curriculum packages, and interactive 5-question quizzes.'
                  : lang === 'zh'
                  ? '支持二维码即刻出票、中小学地方历史数字课程包，以及5题互动知识测验。'
                  : 'Thanh toán QR demo cấp Vé Điện Tử tức thì, gói trường học GDPT 2018 và bài trắc nghiệm 5 câu.'}
              </p>
            </div>
            <div className="flex justify-end pt-4">
              <span className="w-9 h-9 rounded-full bg-[#171817]/15 group-hover:bg-[#171817] text-[#171817] group-hover:text-[#D8C9A9] flex items-center justify-center transition-colors">
                {!isAuthenticated ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
              </span>
            </div>
          </article>
        </div>

        {/* Row 3: 4 Representative Monuments Compact Bento Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {extraBentoSites.map((site) => (
            <BentoMonumentCard
              key={site.id}
              site={site}
              officialName={getLocalizedSite(site).officialName}
              isAuthenticated={isAuthenticated}
              isHiddenForVisitors={hiddenSiteIds.includes(site.id)}
              onOpenDetailModal={onOpenDetailModal}
              onOpenPhotoManager={onOpenPhotoManager}
              onOpen3D={onOpen3D}
            />
          ))}
        </div>

        {/* Row 4: Live Multi-Device Visitor Statistics Cards */}
        <div className="pt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#47796D] animate-pulse" />
              <span className="font-sans text-[13px] font-semibold text-[#A94F3D]">
                {lang === 'en'
                  ? 'Live Museum Attendance'
                  : lang === 'zh'
                  ? '实时访客统计'
                  : 'Thống kê khách tham quan trực tuyến'}
              </span>
            </div>
            <span className="text-xs text-[#171817]/65">
              {lang === 'en'
                ? 'Synced in real time across desktop & mobile devices'
                : lang === 'zh'
                ? '跨电脑与手机设备实时同步'
                : 'Đồng bộ theo thời gian thực trên máy tính & điện thoại'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-[22px] bg-[#F4EFE4] border border-[#171817]/15 p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#171817]/75">
                  {lang === 'en'
                    ? 'Total Museum Visits'
                    : lang === 'zh'
                    ? '博物馆总访问量'
                    : 'Tổng lượt khách tham quan'}
                </span>
                <Users className="w-4 h-4 text-[#A94F3D]" />
              </div>
              <div
                className="text-3xl font-semibold text-[#171817] tabular-nums"
                style={{ fontVariantNumeric: 'lining-nums' }}
              >
                {liveAnalytics.totalVisitors.toLocaleString('vi-VN')}
              </div>
              <div className="text-[11px] font-medium text-[#47796D]">
                {lang === 'en'
                  ? 'Counted once per visitor session'
                  : lang === 'zh'
                  ? '按独立访问会话统计'
                  : 'Ghi nhận theo từng phiên truy cập'}
              </div>
            </div>

            <div className="rounded-[22px] bg-[#F4EFE4] border border-[#171817]/15 p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#171817]/75 truncate">
                  {lang === 'en'
                    ? 'Selected Monument Views'
                    : lang === 'zh'
                    ? '当前古迹浏览量'
                    : 'Lượt xem di tích đang chọn'}
                </span>
                <Landmark className="w-4 h-4 text-[#526D8B] shrink-0" />
              </div>
              <div
                className="text-3xl font-semibold text-[#171817] tabular-nums"
                style={{ fontVariantNumeric: 'lining-nums' }}
              >
                {selectedSiteViews.toLocaleString('vi-VN')}
              </div>
              <div className="text-[11px] text-[#171817]/70 truncate">
                {locSelected.officialName.split(/\s*[（(]/)[0]}
              </div>
            </div>

            <div className="rounded-[22px] bg-[#F4EFE4] border border-[#171817]/15 p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#171817]/75">
                  {lang === 'en'
                    ? '3D & Dossier Views'
                    : lang === 'zh'
                    ? '3D 与档案浏览总计'
                    : 'Lượt xem 3D & Hồ sơ Di sản'}
                </span>
                <Eye className="w-4 h-4 text-[#C9A46A]" />
              </div>
              <div
                className="text-3xl font-semibold text-[#A94F3D] tabular-nums"
                style={{ fontVariantNumeric: 'lining-nums' }}
              >
                {totalSiteViews.toLocaleString('vi-VN')}
              </div>
              <div className="text-[11px] text-[#171817]/70">
                {lang === 'en'
                  ? `Across ${sites.length} preserved monuments`
                  : lang === 'zh'
                  ? `涵盖 ${sites.length} 处遗产工程`
                  : `Trên toàn bộ ${sites.length} công trình di tích`}
              </div>
            </div>

            <div className="rounded-[22px] bg-[#F4EFE4] border border-[#171817]/15 p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#171817]/75">
                  {lang === 'en'
                    ? 'Latest Activity'
                    : lang === 'zh'
                    ? '最近访问动态'
                    : 'Hoạt động tham quan gần nhất'}
                </span>
                {latestVisitEntry?.deviceType === 'Điện thoại' ? (
                  <Smartphone className="w-4 h-4 text-[#47796D]" />
                ) : (
                  <Monitor className="w-4 h-4 text-[#47796D]" />
                )}
              </div>
              <div className="text-sm font-semibold text-[#171817] line-clamp-1">
                {latestVisitEntry
                  ? latestVisitEntry.siteName || latestVisitEntry.actionLabel
                  : lang === 'en'
                  ? 'Digital Museum Online'
                  : lang === 'zh'
                  ? '数字博物馆在线运行中'
                  : 'Bảo tàng Số đang hoạt động'}
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-[#171817]/70">
                <span>
                  {latestVisitEntry?.deviceType === 'Điện thoại'
                    ? lang === 'en'
                      ? 'Mobile'
                      : lang === 'zh'
                      ? '手机端'
                      : 'Điện thoại'
                    : lang === 'en'
                    ? 'Desktop'
                    : lang === 'zh'
                    ? '电脑端'
                    : 'Máy tính'}
                </span>
                <span className="font-sans tabular-nums">
                  {latestVisitEntry
                    ? new Date(latestVisitEntry.timestamp).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : lang === 'en'
                    ? 'Online'
                    : lang === 'zh'
                    ? '在线'
                    : 'Trực tuyến'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          PART 4: CHÂN TRANG BẢO TÀNG & SỐ LIỆU ĐỒNG BỘ
         ==================================================================== */}
      <footer className="border-t border-[#171817]/20 bg-[#EDE4D0] text-[#171817]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className="font-serif text-lg font-semibold text-[#171817]">
                  Dấu Ấn Việt 3D
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#C9A46A]/35 border border-[#171817]/20 text-[#171817] text-[11px] font-sans font-semibold tabular-nums">
                  {lang === 'en'
                    ? `${sites.length} digitized monuments`
                    : lang === 'zh'
                    ? `${sites.length} 处数字化遗迹`
                    : `${sites.length} di tích số hóa`}
                </span>
              </div>
              <p className="text-xs text-[#171817]/75 max-w-xl">
                {lang === 'en'
                  ? 'Digital Heritage Museum of Southeastern Vietnam — Spatial 3D Architecture, 1815 Historical Map Lens & Multilingual Narration.'
                  : lang === 'zh'
                  ? '越南东南部数字遗产博物馆 — 3D空间建筑、1815历史地图透镜与多语种语音导览。'
                  : 'Bảo tàng Di sản Số Đông Nam Bộ — Kiến trúc 3D tương tác, Thấu kính Bản đồ 1815 và Thuyết minh đa ngôn ngữ.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3.5 py-2 rounded-xl bg-[#F4EFE4] border border-[#171817]/15 text-xs flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-[#A94F3D]" />
                <span className="text-[#171817]/75">
                  {lang === 'en' ? 'Visits:' : lang === 'zh' ? '总访客:' : 'Tổng lượt khách:'}
                </span>
                <strong className="text-[#171817] font-sans font-semibold tabular-nums">
                  {liveAnalytics.totalVisitors.toLocaleString('vi-VN')}
                </strong>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-[#F4EFE4] border border-[#171817]/15 text-xs flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-[#47796D]" />
                <span className="text-[#171817]/75">
                  {lang === 'en' ? '3D & Dossiers:' : lang === 'zh' ? '3D与档案浏览:' : 'Lượt xem 3D & Hồ sơ:'}
                </span>
                <strong className="text-[#171817] font-sans font-semibold tabular-nums">
                  {totalSiteViews.toLocaleString('vi-VN')}
                </strong>
              </div>
            </div>
          </div>

          {visitHistoryLogs.length > 0 && (
            <div className="pt-4 border-t border-[#171817]/15 flex flex-wrap items-center gap-2">
              <span className="text-xs font-sans font-medium text-[#171817]/70 inline-flex items-center gap-1.5 mr-1">
                <Clock className="w-3 h-3 text-[#A94F3D]" />
                <span>
                  {lang === 'en' ? 'Recent:' : lang === 'zh' ? '最近访问:' : 'Vừa tham quan:'}
                </span>
              </span>
              {visitHistoryLogs.slice(0, 3).map((entry) => (
                <span
                  key={entry.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F4EFE4] border border-[#171817]/15 text-[11px] text-[#171817]"
                >
                  {entry.deviceType === 'Điện thoại' ? (
                    <Smartphone className="w-3 h-3 text-[#47796D] shrink-0" />
                  ) : (
                    <Monitor className="w-3 h-3 text-[#526D8B] shrink-0" />
                  )}
                  <span className="truncate max-w-[180px]">
                    {entry.siteName || entry.actionLabel}
                  </span>
                  <span className="text-[#171817]/60 font-sans tabular-nums">
                    {new Date(entry.timestamp).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </span>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-[#171817]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-[#171817]/70">
            <span>
              {lang === 'en'
                ? `© ${new Date().getFullYear()} Dấu Ấn Việt 3D · Digital Museum & Multi-Device Sync`
                : lang === 'zh'
                ? `© ${new Date().getFullYear()} Dấu Ấn Việt 3D · 数字遗产典藏与多设备同步系统`
                : `© ${new Date().getFullYear()} Dấu Ấn Việt 3D · Hệ thống Lưu trữ & Đồng bộ Đa thiết bị`}
            </span>
            <div className="flex flex-wrap items-center gap-4 text-[#171817]/80">
              <button
                type="button"
                onClick={() => onNavigateTab('space3d')}
                className="hover:text-[#A94F3D] font-medium transition-colors cursor-pointer"
              >
                {lang === 'en' ? '3D Space' : lang === 'zh' ? '3D 空间' : 'Không gian 3D'}
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('map_routes')}
                className="hover:text-[#A94F3D] font-medium transition-colors cursor-pointer"
              >
                {lang === 'en' ? 'Map & Routes' : lang === 'zh' ? '地图与路线' : 'Bản đồ & Tuyến'}
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('catalog')}
                className="hover:text-[#A94F3D] font-medium transition-colors cursor-pointer"
              >
                {lang === 'en' ? 'Heritage Dossiers' : lang === 'zh' ? '遗产档案' : 'Hồ sơ Di sản'}
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('edtech')}
                className="hover:text-[#A94F3D] font-medium transition-colors cursor-pointer"
              >
                {lang === 'en' ? 'Tickets & EdTech' : lang === 'zh' ? '门票与教材' : 'Vé & Học liệu'}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
});

export default AppleScrollytellingHome;
