import React, { useState, useMemo, useEffect } from 'react';
import { HeritageSite, BaseMapMode, TourRoute } from './types/heritage';
import { HERITAGE_SITES } from './data/heritageSites';
import { TOUR_ROUTES } from './data/tours';
import { useI18n } from './i18n/I18nContext';
import { Language } from './i18n/types';
import { AppleErrorBoundary } from './components/common/AppleErrorBoundary';
import {
  useHeritageRealPhotos,
  resolveSitePhotos,
  saveCustomSitePhoto,
  removeCustomSitePhoto,
  clearAllCustomSitePhotos,
  loadCustomPhotosMap,
  hasAnyCustomPhotoForSite,
  CustomPhotosMap,
  PhotoSlotIndex,
} from './utils/wikimediaPhotoService';
import { MapCanvas } from './components/gis/MapCanvas';
import { FloatingExplorer } from './components/gis/FloatingExplorer';
import { TourRoutePanel } from './components/routing/TourRoutePanel';
import { HistoricalTimeline } from './components/timeline/HistoricalTimeline';
import { HeritageCatalog } from './components/heritage/HeritageCatalog';
import { HeritageDetailModal } from './components/heritage/HeritageDetailModal';
import { CustomPhotoManagerModal } from './components/heritage/CustomPhotoManagerModal';
import { ARAudioModal } from './components/ar/ARAudioModal';
import { FloatingAudioBar } from './components/ar/FloatingAudioBar';
import { AudioGuideProvider, useAudioGuide } from './contexts/AudioGuideContext';
import { AuthProvider, AuthUser, useAuth } from './contexts/AuthContext';
import { LabsProvider, useLabs } from './contexts/LabsContext';
import { DauAnLabsModal, LabsQuickNoteModal } from './components/labs/DauAnLabsModal';
import { AuthModal } from './components/auth/AuthModal';
import { MyTicketsAndJourneyModal } from './components/account/MyTicketsAndJourneyModal';
import { FeedbackModal } from './components/feedback/FeedbackModal';
import { SupportHelpdeskModal, SupportModalTab } from './components/support/SupportHelpdeskModal';
import { AdminWorkflowModal } from './components/admin/AdminWorkflowModal';
import { EmergencyLockdownOverlay } from './components/security/EmergencyLockdownOverlay';
import { ThreeDModelViewer } from './components/viewers/ThreeDModelViewer';
import { AppleScrollytellingHome } from './components/viewers/AppleScrollytellingHome';
import { VR360Viewer } from './components/viewers/VR360Viewer';
import { CommercializationEdTechHub } from './components/startup/CommercializationEdTechHub';
import { GeminiHeritageChat } from './components/GeminiHeritageChat';
import { InteractiveUserGuideModal } from './components/guide/InteractiveUserGuideModal';
import {
  GuidedTourWelcomeModal,
  GuidedTourProgressBar,
  GuidedTourCompletionModal,
} from './components/guide/GuidedTourConcierge';
import {
  GuidedTourRoute,
  ResolvedGuidedTour,
  resolvePublicGuidedTours,
} from './data/guidedTours';
import { LisboaDiagonalSplitOverlay } from './components/spatial/MuseumHistoricalWidgets';
import { CinemaDocumentaryModal, LocalVideoAsset } from './components/media/CinemaDocumentaryModal';
import { HeritageVideoKey, resolveHeritageVideoId } from './data/heritageFilms';
import {
  AI_SHIELD_STORAGE_KEY,
  AI_SHIELD_UPDATED_EVENT,
  AiSecurityShieldState,
  CMS_UPDATED_EVENT,
  CmsSiteOverride,
  EMERGENCY_LOCKDOWN_EVENT,
  EMERGENCY_LOCKDOWN_STORAGE_KEY,
  EmergencyLockdownState,
  PRIMARY_ADMIN_EMAIL,
  RegisteredVisitorRecord,
  SUPPORT_TICKETS_STORAGE_KEY,
  SUPPORT_TICKETS_UPDATED_EVENT,
  SiteSettings,
  VISITORS_UPDATED_EVENT,
  deactivateEmergencyLockdown,
  getVisitorRecord,
  hasUnreadSupportReply,
  loadAiSecurityShield,
  loadCmsSiteOverrides,
  loadEmergencyLockdownState,
  loadHiddenHeritageIds,
  loadSiteSettings,
  recordServerSiteView,
  recordServerVisit,
  recordUnauthorizedAdminAttempt,
  recordVisitorCompletedRoute,
  recordVisitorExploredSite,
  saveCmsSiteOverride,
  syncLocalBootstrapSnapshotToServer,
  syncStateFromServer,
  trackPlatformInteraction,
  createSupportTicket,
  processSupportTicketAiReply,
} from './utils/adminPlatformStore';
import {
  Sparkles,
  Map as MapIcon,
  Route,
  BookOpen,
  Clock,
  Ticket,
  HelpCircle,
  LifeBuoy,
  LogIn,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  ChevronDown,
  Lock,
  Star,
  Headphones,
  X,
  FlaskConical,
  Bug,
  CheckCircle2,
  Menu,
} from 'lucide-react';

export type MainTab = 'explore' | 'space3d' | 'map_routes' | 'catalog' | 'edtech';

function HeritageAppContent({ emergencyState }: { emergencyState: EmergencyLockdownState }) {
  const { user, isTesterPro } = useAuth();
  const isAdminSession = user?.role === 'admin';
  const canPreviewHidden = isAdminSession || isTesterPro;
  const [activeTab, setActiveTab] = useState<MainTab>('explore');
  const [mapSubView, setMapSubView] = useState<'gis' | 'routes'>('gis');
  const [catalogSubView, setCatalogSubView] = useState<'dossiers' | 'timeline'>('dossiers');

  // Single Source of Truth: Wikimedia Commons API (2 photos/site) + Admin custom overrides
  const { customPhotosMap, setCustomPhotosMap, wikimediaCacheMap } = useHeritageRealPhotos();

  // Live Admin CMS overrides, hidden heritage IDs & global site settings synced via CMS_UPDATED_EVENT
  const [cmsOverridesMap, setCmsOverridesMap] = useState<Record<string, CmsSiteOverride>>(() =>
    loadCmsSiteOverrides()
  );
  const [hiddenHeritageIds, setHiddenHeritageIds] = useState<string[]>(() =>
    loadHiddenHeritageIds()
  );
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => loadSiteSettings());

  const refreshCmsFromStore = () => {
    setCmsOverridesMap(loadCmsSiteOverrides());
    setHiddenHeritageIds(loadHiddenHeritageIds());
    setSiteSettings(loadSiteSettings());
  };

  useEffect(() => {
    let cancelled = false;
    const bootstrapSync = async () => {
      await syncStateFromServer();
      if (cancelled) return;
      await syncLocalBootstrapSnapshotToServer();
      if (cancelled) return;
      await recordServerVisit(user?.displayName || user?.email);
    };
    void bootstrapSync();

    const intervalId = window.setInterval(() => {
      void syncStateFromServer();
    }, 15000);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void syncStateFromServer();
      }
    };

    const onCmsUpdated = () => refreshCmsFromStore();
    window.addEventListener(CMS_UPDATED_EVENT, onCmsUpdated);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('focus', onVisibilityOrFocus);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener(CMS_UPDATED_EVENT, onCmsUpdated);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('focus', onVisibilityOrFocus);
    };
  }, []);

  // All 17 sites enriched with resolved photos & full CMS field overrides (used by Admin Studio)
  const allSites = useMemo<HeritageSite[]>(() => {
    return HERITAGE_SITES.map((site) => {
      const ov = cmsOverridesMap[site.id];
      return {
        ...site,
        photos: resolveSitePhotos(site, customPhotosMap, wikimediaCacheMap),
        ...(ov
          ? {
              officialName: ov.officialName || site.officialName,
              chronology: ov.chronology || site.chronology,
              commencementYear:
                typeof ov.commencementYear === 'number'
                  ? ov.commencementYear
                  : site.commencementYear,
              address: {
                ...site.address,
                street: ov.addressStreet || site.address.street,
                district: ov.addressDistrict || site.address.district,
              },
              summary: ov.summary || site.summary,
              architecturalStyle: ov.architecturalStyle || site.architecturalStyle,
              conservationNotes:
                ov.conservationNotes !== undefined
                  ? ov.conservationNotes
                  : site.conservationNotes,
              dossierStatus: ov.dossierStatus || site.dossierStatus,
              expertReviews: ov.expertReviews || site.expertReviews,
            }
          : {}),
      };
    });
  }, [customPhotosMap, wikimediaCacheMap, cmsOverridesMap]);

  // Role-based site visibility:
  // - Admin & Tester Pro ALWAYS see all 17 sites (hidden sites get unified badge).
  // - Normal / Paid Visitors NEVER see sites listed in dau_an_viet_hidden_heritages.
  const sites = useMemo<HeritageSite[]>(() => {
    if (canPreviewHidden) return allSites;
    const hiddenSet = new Set(hiddenHeritageIds);
    return allSites.filter((site) => !hiddenSet.has(site.id));
  }, [allSites, hiddenHeritageIds, canPreviewHidden]);

  const [selectedSiteId, setSelectedSiteId] = useState<string>(HERITAGE_SITES[0].id);
  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) || sites[0] || allSites[0],
    [sites, selectedSiteId, allSites]
  );

  // Map & Filter State
  const [baseMapMode, setBaseMapMode] = useState<BaseMapMode>('admin');
  const [activeTour, setActiveTour] = useState<TourRoute | null>(TOUR_ROUTES[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRanking, setFilterRanking] = useState('all');
  const [filterDistrict, setFilterDistrict] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterTech, setFilterTech] = useState('all');

  // Modals & Overlays
  const [detailModalSiteId, setDetailModalSiteId] = useState<string | null>(null);
  const [vrModalSiteId, setVrModalSiteId] = useState<string | null>(null);
  const [photoManagerSiteId, setPhotoManagerSiteId] = useState<string | null>(null);
  const [showLisboaSplit, setShowLisboaSplit] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // If a visitor is viewing a site that gets hidden, automatically redirect to the first public site
  useEffect(() => {
    if (canPreviewHidden || sites.length === 0) return;
    if (!sites.some((s) => s.id === selectedSiteId)) {
      setSelectedSiteId(sites[0].id);
    }
    if (detailModalSiteId && !sites.some((s) => s.id === detailModalSiteId)) {
      setDetailModalSiteId(null);
    }
    if (vrModalSiteId && !sites.some((s) => s.id === vrModalSiteId)) {
      setVrModalSiteId(null);
    }
    if (photoManagerSiteId && !sites.some((s) => s.id === photoManagerSiteId)) {
      setPhotoManagerSiteId(null);
    }
  }, [canPreviewHidden, sites, selectedSiteId, detailModalSiteId, vrModalSiteId, photoManagerSiteId]);

  const detailModalSite = useMemo(
    () => (detailModalSiteId ? sites.find((s) => s.id === detailModalSiteId) || null : null),
    [sites, detailModalSiteId]
  );
  const vrModalSite = useMemo(
    () => (vrModalSiteId ? sites.find((s) => s.id === vrModalSiteId) || null : null),
    [sites, vrModalSiteId]
  );
  const photoManagerSite = useMemo(
    () => (photoManagerSiteId ? sites.find((s) => s.id === photoManagerSiteId) || null : null),
    [sites, photoManagerSiteId]
  );

  return (
    <AudioGuideProvider sites={sites}>
      <HeritageAppInner
        emergencyState={emergencyState}
        allSites={allSites}
        sites={sites}
        hiddenSiteIds={canPreviewHidden ? hiddenHeritageIds : []}
        siteSettings={siteSettings}
        onRefreshCms={refreshCmsFromStore}
        selectedSite={selectedSite}
        setSelectedSiteId={setSelectedSiteId}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mapSubView={mapSubView}
        setMapSubView={setMapSubView}
        catalogSubView={catalogSubView}
        setCatalogSubView={setCatalogSubView}
        customPhotosMap={customPhotosMap}
        setCustomPhotosMap={setCustomPhotosMap}
        baseMapMode={baseMapMode}
        setBaseMapMode={setBaseMapMode}
        activeTour={activeTour}
        setActiveTour={setActiveTour}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterRanking={filterRanking}
        setFilterRanking={setFilterRanking}
        filterDistrict={filterDistrict}
        setFilterDistrict={setFilterDistrict}
        filterType={filterType}
        setFilterType={setFilterType}
        filterTech={filterTech}
        setFilterTech={setFilterTech}
        detailModalSite={detailModalSite}
        setDetailModalSiteId={setDetailModalSiteId}
        vrModalSite={vrModalSite}
        setVrModalSiteId={setVrModalSiteId}
        photoManagerSite={photoManagerSite}
        setPhotoManagerSiteId={setPhotoManagerSiteId}
        showLisboaSplit={showLisboaSplit}
        setShowLisboaSplit={setShowLisboaSplit}
        isAiChatOpen={isAiChatOpen}
        setIsAiChatOpen={setIsAiChatOpen}
        isGuideOpen={isGuideOpen}
        setIsGuideOpen={setIsGuideOpen}
        onUpdateSiteStatus={(siteId, newStatus, expertComment) => {
          const baseSite = allSites.find((s) => s.id === siteId);
          const prevReviews = baseSite?.expertReviews || [];
          const nextReviews = expertComment?.trim()
            ? [
                {
                  id: `rev-${Date.now()}`,
                  reviewerName: 'Quản trị viên Dấu Ấn Việt',
                  title: 'Phê duyệt qua Admin Studio',
                  organization: 'Bảo tàng Số Dấu Ấn Việt 3D',
                  ratingScore: newStatus === 'approved_published' ? 5 : 3,
                  verdict:
                    newStatus === 'approved_published'
                      ? ('approved' as const)
                      : ('revision_requested' as const),
                  timestamp: new Date().toLocaleDateString('vi-VN'),
                  comment: expertComment.trim(),
                },
                ...prevReviews,
              ]
            : prevReviews;
          saveCmsSiteOverride(siteId, {
            dossierStatus: newStatus,
            expertReviews: nextReviews,
          });
          refreshCmsFromStore();
        }}
      />
    </AudioGuideProvider>
  );
}

interface HeritageAppInnerProps {
  emergencyState: EmergencyLockdownState;
  allSites: HeritageSite[];
  sites: HeritageSite[];
  hiddenSiteIds: string[];
  siteSettings: SiteSettings;
  onRefreshCms: () => void;
  selectedSite: HeritageSite;
  setSelectedSiteId: React.Dispatch<React.SetStateAction<string>>;
  activeTab: MainTab;
  setActiveTab: React.Dispatch<React.SetStateAction<MainTab>>;
  mapSubView: 'gis' | 'routes';
  setMapSubView: React.Dispatch<React.SetStateAction<'gis' | 'routes'>>;
  catalogSubView: 'dossiers' | 'timeline';
  setCatalogSubView: React.Dispatch<React.SetStateAction<'dossiers' | 'timeline'>>;
  customPhotosMap: CustomPhotosMap;
  setCustomPhotosMap: React.Dispatch<React.SetStateAction<CustomPhotosMap>>;
  baseMapMode: BaseMapMode;
  setBaseMapMode: React.Dispatch<React.SetStateAction<BaseMapMode>>;
  activeTour: TourRoute | null;
  setActiveTour: React.Dispatch<React.SetStateAction<TourRoute | null>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filterRanking: string;
  setFilterRanking: React.Dispatch<React.SetStateAction<string>>;
  filterDistrict: string;
  setFilterDistrict: React.Dispatch<React.SetStateAction<string>>;
  filterType: string;
  setFilterType: React.Dispatch<React.SetStateAction<string>>;
  filterTech: string;
  setFilterTech: React.Dispatch<React.SetStateAction<string>>;
  detailModalSite: HeritageSite | null;
  setDetailModalSiteId: React.Dispatch<React.SetStateAction<string | null>>;
  vrModalSite: HeritageSite | null;
  setVrModalSiteId: React.Dispatch<React.SetStateAction<string | null>>;
  photoManagerSite: HeritageSite | null;
  setPhotoManagerSiteId: React.Dispatch<React.SetStateAction<string | null>>;
  showLisboaSplit: boolean;
  setShowLisboaSplit: React.Dispatch<React.SetStateAction<boolean>>;
  isAiChatOpen: boolean;
  setIsAiChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isGuideOpen: boolean;
  setIsGuideOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onUpdateSiteStatus: (
    siteId: string,
    newStatus: 'draft' | 'district_submitted' | 'expert_review' | 'approved_published',
    expertComment?: string
  ) => void;
}

function HeritageAppInner({
  emergencyState,
  allSites,
  sites,
  hiddenSiteIds,
  siteSettings,
  onRefreshCms,
  selectedSite,
  setSelectedSiteId,
  activeTab,
  setActiveTab,
  mapSubView,
  setMapSubView,
  catalogSubView,
  setCatalogSubView,
  customPhotosMap,
  setCustomPhotosMap,
  baseMapMode,
  setBaseMapMode,
  activeTour,
  setActiveTour,
  searchQuery,
  setSearchQuery,
  filterRanking,
  setFilterRanking,
  filterDistrict,
  setFilterDistrict,
  filterType,
  setFilterType,
  filterTech,
  setFilterTech,
  detailModalSite,
  setDetailModalSiteId,
  vrModalSite,
  setVrModalSiteId,
  photoManagerSite,
  setPhotoManagerSiteId,
  showLisboaSplit,
  setShowLisboaSplit,
  isAiChatOpen,
  setIsAiChatOpen,
  isGuideOpen,
  setIsGuideOpen,
  onUpdateSiteStatus,
}: HeritageAppInnerProps) {
  const { lang, setLang, getLocalizedSite } = useI18n();
  const {
    user,
    userTier,
    isAdmin,
    isTesterPro,
    isAuthModalOpen,
    openAuthModal,
    logout,
  } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const {
    effectiveQuickNotesWidget,
    isLabsModalOpen,
    isQuickNoteOpen,
    openLabsModal,
    openQuickNote,
  } = useLabs();
  const isNonAdminBetaTester = Boolean(user && user.isBetaTester && !isAdmin);
  const isNonAdminTesterPro = Boolean(isTesterPro && !isAdmin);
  const canPreviewHidden = isAdmin || isTesterPro;
  const {
    activeSite: audioActiveSite,
    isModalOpen: isAudioModalOpen,
    isFloatingBarVisible,
    isPlaying: isAudioPlaying,
    pause: pauseAudioGuide,
    openModalForSite,
    startAudioGuideForSite,
    minimizeModalKeepPlaying,
  } = useAudioGuide();

  const [isAdminStudioOpen, setIsAdminStudioOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [isMyJourneyOpen, setIsMyJourneyOpen] = useState<boolean>(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState<boolean>(false);
  const [supportDefaultTab, setSupportDefaultTab] = useState<SupportModalTab>('faq');
  const [isTesterBugModalOpen, setIsTesterBugModalOpen] = useState<boolean>(false);
  const [testerBugDescription, setTesterBugDescription] = useState<string>('');
  const [testerBugSubmittedCode, setTesterBugSubmittedCode] = useState<string | null>(null);
  const [isSubmittingTesterBug, setIsSubmittingTesterBug] = useState<boolean>(false);
  const [hasUnreadSupport, setHasUnreadSupport] = useState<boolean>(() =>
    hasUnreadSupportReply(user?.userId, user?.email)
  );
  const [visitorRecord, setVisitorRecord] = useState<RegisteredVisitorRecord | null>(() =>
    getVisitorRecord(user?.userId)
  );
  const [aiShieldState, setAiShieldState] = useState<AiSecurityShieldState>(() =>
    loadAiSecurityShield()
  );
  const unauthorizedLoggedRef = React.useRef<string | null>(null);
  const userMenuRef = React.useRef<HTMLDivElement | null>(null);
  const adminNavRef = React.useRef<HTMLElement | null>(null);
  const isAdminSession = user?.role === 'admin';
  const [pending3DRenderMode, setPending3DRenderMode] = useState<'textured' | 'wireframe' | 'xray'>('textured');
  const [pending3DExploded, setPending3DExploded] = useState<number>(0);

  useEffect(() => {
    const syncShield = () => setAiShieldState(loadAiSecurityShield());
    const onStorage = (e: StorageEvent) => {
      if (e.key === AI_SHIELD_STORAGE_KEY) syncShield();
    };
    window.addEventListener(AI_SHIELD_UPDATED_EVENT, syncShield);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(AI_SHIELD_UPDATED_EVENT, syncShield);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (isAdmin) return;
    const urlMarker = `${window.location.search}${window.location.hash}`.toLowerCase();
    if (urlMarker.includes('admin')) {
      const actorKey = `${user?.email || 'guest'}:${urlMarker}`;
      if (unauthorizedLoggedRef.current !== actorKey) {
        unauthorizedLoggedRef.current = actorKey;
        recordUnauthorizedAdminAttempt(
          user?.email || user?.displayName || 'Khách truy cập trái phép',
          `Phát hiện truy cập tham số quản trị (${urlMarker}) không có quyền Super Admin.`
        );
      }
    }
  }, [isAdmin, user?.email, user?.displayName]);

  useEffect(() => {
    const syncUnreadSupport = () => {
      setHasUnreadSupport(hasUnreadSupportReply(user?.userId, user?.email));
    };
    syncUnreadSupport();
    const onStorage = (e: StorageEvent) => {
      if (e.key === SUPPORT_TICKETS_STORAGE_KEY) syncUnreadSupport();
    };
    window.addEventListener(SUPPORT_TICKETS_UPDATED_EVENT, syncUnreadSupport);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SUPPORT_TICKETS_UPDATED_EVENT, syncUnreadSupport);
      window.removeEventListener('storage', onStorage);
    };
  }, [user?.userId, user?.email]);

  useEffect(() => {
    setVisitorRecord(getVisitorRecord(user?.userId));
    if (!user?.userId) return;
    const onVisitorsUpdated = () => setVisitorRecord(getVisitorRecord(user.userId));
    window.addEventListener(VISITORS_UPDATED_EVENT, onVisitorsUpdated);
    return () => window.removeEventListener(VISITORS_UPDATED_EVENT, onVisitorsUpdated);
  }, [user?.userId]);

  useEffect(() => {
    if (!isAdmin && isAdminStudioOpen) {
      setIsAdminStudioOpen(false);
    }
  }, [isAdmin, isAdminStudioOpen]);

  // Sync shared server state immediately whenever switching main tabs, subviews, or opening Admin Studio
  useEffect(() => {
    void syncStateFromServer();
  }, [activeTab, mapSubView, catalogSubView, isAdminStudioOpen]);

  // Enforce Mandatory Visitor Auth Gate if user logs out while in a protected view
  useEffect(() => {
    if (!user) {
      if (activeTab !== 'explore') {
        setActiveTab('explore');
      }
      if (isMyJourneyOpen) {
        setIsMyJourneyOpen(false);
      }
      if (isFeedbackModalOpen) {
        setIsFeedbackModalOpen(false);
      }
    }
  }, [user, activeTab, isMyJourneyOpen, isFeedbackModalOpen, setActiveTab]);

  // Record 3D site visit whenever authenticated visitor views a monument in Không gian 3D
  useEffect(() => {
    if (user?.userId && activeTab === 'space3d' && selectedSite?.id) {
      recordVisitorExploredSite(user.userId, selectedSite.id);
    }
  }, [user?.userId, activeTab, selectedSite?.id]);

  const [activeGuidedTour, setActiveGuidedTour] = useState<{
    route: GuidedTourRoute;
    stops: HeritageSite[];
    stepIndex: number;
  } | null>(null);
  const [isGuidedWelcomeOpen, setIsGuidedWelcomeOpen] = useState<boolean>(false);
  const [completedGuidedTour, setCompletedGuidedTour] = useState<{
    route: GuidedTourRoute;
    stopCount: number;
  } | null>(null);
  const [preselectedGuidedRoute, setPreselectedGuidedRoute] = useState<{
    mappedTourId: string;
    title: string;
    token: number;
  } | null>(null);
  const [masterpieceAudioHintSite, setMasterpieceAudioHintSite] = useState<HeritageSite | null>(null);

  const prevUserIdRef = React.useRef<string | null>(user?.userId || null);
  const suppressNextWelcomeRef = React.useRef<boolean>(false);

  // Public-only guided tours (strictly excludes any monument hidden in dau_an_viet_hidden_heritages)
  const resolvedGuidedTours = useMemo<ResolvedGuidedTour[]>(
    () => resolvePublicGuidedTours(sites, hiddenSiteIds),
    [sites, hiddenSiteIds]
  );

  // Monument 01 masterpiece (falls back to first public monument if 01 is hidden by Admin)
  const masterpieceSite = useMemo<HeritageSite | null>(() => {
    const hiddenSet = new Set(hiddenSiteIds);
    return (
      sites.find((s) => s.id === 'HCM-DT-001' && !hiddenSet.has(s.id)) ||
      sites.find((s) => !hiddenSet.has(s.id)) ||
      null
    );
  }, [sites, hiddenSiteIds]);

  // Keep active guided tour synced live if Admin hides/unhides any stop
  useEffect(() => {
    if (!activeGuidedTour) return;
    const updated = resolvedGuidedTours.find((item) => item.route.id === activeGuidedTour.route.id);
    if (!updated || updated.stops.length === 0) {
      setActiveGuidedTour(null);
      return;
    }
    const currentStopId = activeGuidedTour.stops[activeGuidedTour.stepIndex]?.id;
    const newIdx = currentStopId
      ? updated.stops.findIndex((s) => s.id === currentStopId)
      : 0;
    const safeIdx =
      newIdx >= 0 ? newIdx : Math.min(activeGuidedTour.stepIndex, updated.stops.length - 1);
    const stopsChanged =
      updated.stops.length !== activeGuidedTour.stops.length ||
      updated.stops.some((s, i) => s.id !== activeGuidedTour.stops[i]?.id);
    if (stopsChanged || safeIdx !== activeGuidedTour.stepIndex) {
      setActiveGuidedTour({
        route: updated.route,
        stops: updated.stops,
        stepIndex: safeIdx,
      });
    }
  }, [resolvedGuidedTours, activeGuidedTour]);

  // Auto-show GuidedTourWelcomeModal on visitor's very first completed login
  useEffect(() => {
    const currentUserId = user?.userId || null;
    const prevUserId = prevUserIdRef.current;
    prevUserIdRef.current = currentUserId;

    if (!currentUserId) {
      setActiveGuidedTour(null);
      setIsGuidedWelcomeOpen(false);
      setCompletedGuidedTour(null);
      setMasterpieceAudioHintSite(null);
      setPreselectedGuidedRoute(null);
      return;
    }

    const welcomeKey = `dau_an_viet_guided_welcome_seen_v1_${currentUserId}`;
    const alreadySeen =
      typeof window !== 'undefined' && Boolean(window.localStorage.getItem(welcomeKey));

    if (suppressNextWelcomeRef.current) {
      suppressNextWelcomeRef.current = false;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(welcomeKey, '1');
        } catch {
          // ignore storage quota errors
        }
      }
      return;
    }

    if (!prevUserId && !alreadySeen && user?.role !== 'admin' && resolvedGuidedTours.length > 0) {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(welcomeKey, '1');
        } catch {
          // ignore storage quota errors
        }
      }
      setIsGuidedWelcomeOpen(true);
    }
  }, [user?.userId, user?.role, resolvedGuidedTours.length]);

  const requireAuth = (action: (authedUser: AuthUser) => void, promptLabel: string) => {
    if (user) {
      action(user);
      return;
    }
    suppressNextWelcomeRef.current = true;
    openAuthModal({
      prompt: promptLabel,
      onSuccess: (authedUser: AuthUser) => action(authedUser),
    });
  };

  useEffect(() => {
    const navEl = adminNavRef.current;
    if (!isAdminSession || !navEl) return;
    const handleWheelToHorizontal = (e: WheelEvent) => {
      if (navEl.scrollWidth <= navEl.clientWidth) return;
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.deltaY !== 0) {
        e.preventDefault();
        navEl.scrollLeft += e.deltaY;
      }
    };
    navEl.addEventListener('wheel', handleWheelToHorizontal, { passive: false });
    return () => navEl.removeEventListener('wheel', handleWheelToHorizontal);
  }, [isAdminSession]);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isUserMenuOpen]);

  const [mapFocusTick, setMapFocusTick] = useState<number>(0);
  const [viewerResetKey, setViewerResetKey] = useState<number>(0);
  const activeMapHeritageId = useMemo(
    () => resolveHeritageVideoId(selectedSite.id),
    [selectedSite.id]
  );

  const handleSelectTourRoute = (tour: TourRoute | null) => {
    setActiveTour(tour);
    if (tour && tour.sites.length > 0) {
      const firstStop = sites.find((s) => s.id === tour.sites[0]);
      if (firstStop) {
        setSelectedSiteId(firstStop.id);
        setMapFocusTick((t) => t + 1);
      }
    }
  };
  const [cinemaState, setCinemaState] = useState<{
    isOpen: boolean;
    siteId: string | null;
    activeVideoHeritageId: HeritageVideoKey | null;
  }>({
    isOpen: false,
    siteId: null,
    activeVideoHeritageId: null,
  });
  const [localVideosMap, setLocalVideosMap] = useState<Record<string, LocalVideoAsset>>({});
  const localVideosRef = React.useRef<Record<string, LocalVideoAsset>>({});
  localVideosRef.current = localVideosMap;

  useEffect(() => {
    return () => {
      Object.values(localVideosRef.current).forEach((asset) => {
        try {
          URL.revokeObjectURL(asset.url);
        } catch {
          // ignore revoke error
        }
      });
    };
  }, []);

  const handleUploadLocalVideo = (targetKey: string, file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setLocalVideosMap((prev) => {
      const existing = prev[targetKey];
      if (existing?.url) {
        try {
          URL.revokeObjectURL(existing.url);
        } catch {
          // ignore revoke error
        }
      }
      return {
        ...prev,
        [targetKey]: { url: objectUrl, fileName: file.name },
      };
    });
  };

  const handleClearLocalVideo = (targetKey: string) => {
    setLocalVideosMap((prev) => {
      const existing = prev[targetKey];
      if (!existing) return prev;
      try {
        URL.revokeObjectURL(existing.url);
      } catch {
        // ignore revoke error
      }
      const next = { ...prev };
      delete next[targetKey];
      return next;
    });
  };

  const handleOpenCinemaModal = (site?: HeritageSite | null) => {
    if (isAudioPlaying) {
      pauseAudioGuide();
    }
    const targetSite = site || selectedSite;
    const lockedVideoKey = resolveHeritageVideoId(targetSite?.id);
    trackPlatformInteraction('tech_flycam', targetSite?.id);
    setCinemaState({
      isOpen: true,
      siteId: targetSite ? targetSite.id : null,
      activeVideoHeritageId: lockedVideoKey,
    });
  };

  useEffect(() => {
    if (!canPreviewHidden && cinemaState.isOpen && cinemaState.siteId) {
      if (!sites.some((s) => s.id === cinemaState.siteId)) {
        setCinemaState({ isOpen: false, siteId: null, activeVideoHeritageId: null });
      }
    }
  }, [canPreviewHidden, cinemaState.isOpen, cinemaState.siteId, sites]);

  const cinemaContextSite = useMemo(
    () => (cinemaState.siteId ? sites.find((s) => s.id === cinemaState.siteId) || null : null),
    [sites, cinemaState.siteId]
  );

  const uniqueDistricts = useMemo(() => {
    const set = new Set<string>();
    sites.forEach((s) => {
      if (s.address.district) set.add(s.address.district);
    });
    return Array.from(set);
  }, [sites]);

  const filteredMapSites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sites.filter((site) => {
      const locSite = getLocalizedSite(site);
      const matchesSearch =
        !q ||
        locSite.officialName.toLowerCase().includes(q) ||
        locSite.folkName.toLowerCase().includes(q) ||
        site.identifierCode.toLowerCase().includes(q) ||
        site.address.district.toLowerCase().includes(q);
      const matchesRanking = filterRanking === 'all' || site.rankingLevel === filterRanking;
      const matchesDistrict = filterDistrict === 'all' || site.address.district === filterDistrict;
      const matchesType = filterType === 'all' || site.type === filterType;
      const matchesTech =
        filterTech === 'all' ||
        (filterTech === '3d' && site.has3D) ||
        (filterTech === 'vr360' && site.hasVR360);

      return matchesSearch && matchesRanking && matchesDistrict && matchesType && matchesTech;
    });
  }, [sites, searchQuery, filterRanking, filterDistrict, filterType, filterTech, getLocalizedSite]);

  const handleOpen3D = (site: HeritageSite, authedUser?: AuthUser) => {
    const actor = authedUser || user;
    setSelectedSiteId(site.id);
    void recordServerSiteView(
      site.id,
      site.officialName,
      'open_3d',
      actor?.displayName || actor?.email
    );
    recordVisitorExploredSite(actor?.userId, site.id);
    setActiveTab('space3d');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleOpenDetailModal = (siteOrId: HeritageSite | string, authedUser?: AuthUser) => {
    const target =
      typeof siteOrId === 'string'
        ? sites.find((s) => s.id === siteOrId) || allSites.find((s) => s.id === siteOrId)
        : siteOrId;
    if (!target) return;
    const actor = authedUser || user;
    setSelectedSiteId(target.id);
    setDetailModalSiteId(target.id);
    void recordServerSiteView(
      target.id,
      target.officialName,
      'open_dossier',
      actor?.displayName || actor?.email
    );
  };

  const startGuidedTourSession = (tour: ResolvedGuidedTour, authedUser?: AuthUser) => {
    if (!tour.stops.length) return;
    const firstStop = tour.stops[0];
    setIsGuidedWelcomeOpen(false);
    setCompletedGuidedTour(null);
    setMasterpieceAudioHintSite(null);
    setActiveGuidedTour({
      route: tour.route,
      stops: tour.stops,
      stepIndex: 0,
    });
    const matchingMapTour = TOUR_ROUTES.find((t) => t.id === tour.route.mappedTourId);
    if (matchingMapTour) {
      setActiveTour(matchingMapTour);
    }
    handleOpen3D(firstStop, authedUser);
  };

  const startMasterpieceSession = (authedUser?: AuthUser) => {
    if (!masterpieceSite) return;
    setIsGuidedWelcomeOpen(false);
    setActiveGuidedTour(null);
    setMasterpieceAudioHintSite(masterpieceSite);
    handleOpen3D(masterpieceSite, authedUser);
  };

  const handleGuidedNextStep = () => {
    if (!activeGuidedTour) return;
    const nextIdx = activeGuidedTour.stepIndex + 1;
    if (nextIdx < activeGuidedTour.stops.length) {
      const nextSite = activeGuidedTour.stops[nextIdx];
      setActiveGuidedTour({
        ...activeGuidedTour,
        stepIndex: nextIdx,
      });
      setSelectedSiteId(nextSite.id);
      void recordServerSiteView(
        nextSite.id,
        nextSite.officialName,
        'open_3d',
        user?.displayName || user?.email
      );
      recordVisitorExploredSite(user?.userId, nextSite.id);
      if (activeTab !== 'space3d' && activeTab !== 'map_routes') {
        setActiveTab('space3d');
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    } else {
      recordVisitorCompletedRoute(user?.userId, activeGuidedTour.route.mappedTourId);
      setCompletedGuidedTour({
        route: activeGuidedTour.route,
        stopCount: activeGuidedTour.stops.length,
      });
      setActiveGuidedTour(null);
    }
  };

  const handleLocateOnMap = (site: HeritageSite) => {
    if (isAudioModalOpen) {
      minimizeModalKeepPlaying();
    }
    setSelectedSiteId(site.id);
    setMapFocusTick((t) => t + 1);
    setMapSubView('gis');
    setActiveTab('map_routes');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleNavigateTab = (tab: MainTab) => {
    if (isAudioModalOpen) {
      minimizeModalKeepPlaying();
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const navItems: { id: MainTab | 'audio'; label: string }[] = [
    { id: 'explore', label: lang === 'en' ? 'Explore' : lang === 'zh' ? '探索' : 'Khám phá' },
    { id: 'space3d', label: lang === 'en' ? '3D Space' : lang === 'zh' ? '3D 空间' : 'Không gian 3D' },
    { id: 'map_routes', label: lang === 'en' ? 'Map & Routes' : lang === 'zh' ? '地图与路线' : 'Bản đồ & Tuyến' },
    { id: 'catalog', label: lang === 'en' ? 'Dossiers' : lang === 'zh' ? '遗产档案' : 'Hồ sơ Di sản' },
    { id: 'edtech', label: lang === 'en' ? 'Tickets & EdTech' : lang === 'zh' ? '门票与教材' : 'Vé & Học liệu' },
    { id: 'audio', label: lang === 'en' ? 'Audio Guide' : lang === 'zh' ? '语音导览' : 'Thuyết minh' },
  ];

  const isStrictAdmin = Boolean(isAdmin && !isTesterPro);

  const renderTierPill = (variant: 'light' | 'dark' = 'light') => {
    if (!user) return null;
    if (isStrictAdmin) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-[#C9A46A] text-[#171817] whitespace-nowrap shrink-0">
          {lang === 'en' ? 'Admin' : lang === 'zh' ? '管理员' : 'Quản trị viên'}
        </span>
      );
    }
    if (isNonAdminTesterPro) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-[#47796D] text-[#D8C9A9] whitespace-nowrap shrink-0">
          {lang === 'en' ? 'Tester Pro' : lang === 'zh' ? '专业测试版' : 'Tester Pro'}
        </span>
      );
    }
    if (userTier === 'pro') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-[#171817] border border-[#C9A46A] text-[#C9A46A] whitespace-nowrap shrink-0">
          Pro
        </span>
      );
    }
    if (userTier === 'plus') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-[#526D8B] text-[#D8C9A9] whitespace-nowrap shrink-0">
          Plus
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide whitespace-nowrap shrink-0 ${
          variant === 'dark'
            ? 'bg-[#D8C9A9]/10 text-[#D8C9A9]/80 border border-[#D8C9A9]/20'
            : 'bg-[#171817]/10 text-[#171817]'
        }`}
      >
        {lang === 'en' ? 'Visitor' : lang === 'zh' ? '访客' : 'Du khách'}
      </span>
    );
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#D8C9A9] text-[#171817] flex flex-col selection:bg-[#A94F3D] selection:text-[#D8C9A9]">
      <div className="sticky top-0 z-50 flex flex-col">
        {emergencyState.isLocked && isStrictAdmin && (
          <div
            role="status"
            className="w-full bg-[#A94F3D] border-b border-[#171817]/25 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#D8C9A9]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <ShieldAlert className="w-4 h-4 text-[#FFD6D3] animate-pulse shrink-0" />
              <span className="font-semibold tracking-tight truncate">
                CHẾ ĐỘ ĐÓNG BĂNG KHẨN CẤP ĐANG BẬT — Toàn bộ du khách đã bị ngắt truy cập
              </span>
            </div>
            <button
              type="button"
              onClick={() => deactivateEmergencyLockdown(user?.email || PRIMARY_ADMIN_EMAIL)}
              className="px-3.5 py-1 rounded-full bg-white hover:bg-[#F5EFE6] text-[#7A1216] text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 shadow"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Mở khóa hoạt động lại ngay</span>
            </button>
          </div>
        )}

        {!emergencyState.isLocked && aiShieldState.level2EmergencyActive && (
          <div
            role="status"
            className="w-full bg-gradient-to-r from-[#5E1115] via-[#8F191E] to-[#5E1115] border-b border-[#FF453A]/60 px-3 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-white"
          >
            <div className="flex items-center gap-2 min-w-0">
              <ShieldAlert className="w-4 h-4 text-[#FFD6D3] animate-pulse shrink-0" />
              <span className="font-medium truncate">
                {isStrictAdmin
                  ? `CẢNH BÁO AN NINH MỨC 2: ${aiShieldState.lastIncidentTitle || 'Trợ lý AI đã bật Lá chắn Bảo vệ & gửi email khẩn cấp về bivsmoon2023@gmail.com'}`
                  : 'Lá chắn AI Bảo vệ Khẩn cấp đang bật: Hệ thống đang áp dụng giới hạn tốc độ truy cập an toàn để ngăn chặn gửi biểu mẫu tự động.'}
              </span>
            </div>
            {isStrictAdmin && (
              <button
                type="button"
                onClick={() => setIsAdminStudioOpen(true)}
                className="px-3 py-1 rounded-full bg-white hover:bg-[#F5EFE6] text-[#7A1216] text-[11px] font-bold cursor-pointer transition-colors shrink-0"
              >
                Mở Admin Studio xử lý
              </button>
            )}
          </div>
        )}

      {/* ====================================================================
          0. MOBILE COMPACT HEADER (< 768px) + RIGHT SLIDE-OVER DRAWER
         ==================================================================== */}
      <header className="flex md:hidden h-14 px-4 bg-[#171817] border-b border-[#C9A46A]/25 items-center justify-between gap-2 text-[#D8C9A9]">
        <button
          type="button"
          onClick={() => {
            setIsMobileMenuOpen(false);
            handleNavigateTab('explore');
          }}
          className="text-left focus:outline-none shrink-0 flex items-center gap-2 cursor-pointer"
        >
          <span className="font-serif text-base font-semibold tracking-tight text-[#D8C9A9] whitespace-nowrap">
            Dấu Ấn Việt
          </span>
          <span className="font-sans text-[10px] font-semibold text-[#171817] bg-[#C9A46A] px-1.5 py-0.5 rounded-[4px] leading-none">
            3D
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {user && (userTier === 'plus' || userTier === 'pro' || isNonAdminTesterPro || isStrictAdmin) && (
            <div className="shrink-0">{renderTierPill('dark')}</div>
          )}

          {!isAudioModalOpen && activeTab !== 'space3d' && (
            <button
              type="button"
              onClick={() =>
                requireAuth(
                  () => {
                    trackPlatformInteraction('tech_audio_ai', selectedSite?.id);
                    setIsAiChatOpen(true);
                  },
                  lang === 'en' ? 'Open AI Assistant' : lang === 'zh' ? '打开 AI 助理' : 'Mở Trợ lý AI'
                )
              }
              aria-label={lang === 'en' ? 'Open AI Assistant' : lang === 'zh' ? '打开 AI 助理' : 'Mở Trợ lý AI'}
              className="h-9 px-2.5 rounded-full bg-[#171817] border border-[#C9A46A]/45 text-[#C9A46A] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>AI</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label={lang === 'en' ? 'Open menu' : lang === 'zh' ? '打开菜单' : 'Mở menu điều hướng'}
            className="relative w-9 h-9 rounded-full bg-[#171817] border border-[#C9A46A]/35 text-[#D8C9A9] flex items-center justify-center cursor-pointer"
          >
            <Menu className="w-4 h-4" />
            {hasUnreadSupport && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#A94F3D]" />
            )}
          </button>
        </div>
      </header>

      {/* ====================================================================
          1. DESKTOP VIETNAM HERITAGE EDITORIAL NAVBAR (h-16, >= 768px)
         ==================================================================== */}
      <header
        className="hidden md:flex h-16 px-3 lg:px-4 xl:px-6 bg-[#D8C9A9]/95 backdrop-blur-md border-b border-[#171817]/15 items-center justify-between gap-2 xl:gap-3 tracking-normal"
      >
        {/* 1. LEFT: ARCHITECTURAL BIENNALE WORDMARK + INDOCHINE ARCH SVG */}
        <button
          type="button"
          onClick={() => handleNavigateTab('explore')}
          className="text-left focus:outline-none shrink-0 flex items-center gap-2 group cursor-pointer"
        >
          <svg width="34" height="38" viewBox="0 0 42 46" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <rect x="3" y="3" width="33" height="38" rx="4.5" stroke="#A94F3D" strokeWidth="1.5" />
            <path d="M7.5 43H35.5C37.9853 43 40 40.9853 40 38.5V7.5" stroke="#C9A46A" strokeWidth="1.2" />
            <line x1="19.5" y1="6.5" x2="19.5" y2="37.5" stroke="#A94F3D" strokeWidth="0.9" strokeDasharray="1.8 1.8" strokeOpacity="0.8" />
            <line x1="7" y1="26.5" x2="32" y2="26.5" stroke="#A94F3D" strokeWidth="0.9" strokeDasharray="1.8 1.8" strokeOpacity="0.8" />
            <path d="M11.5 12.2C16.8 13.8 22.2 13.8 27.5 12.2L26 14.3H13L11.5 12.2Z" stroke="#171817" strokeWidth="1.25" strokeLinejoin="round" />
            <line x1="14.5" y1="14.3" x2="14.5" y2="16.4" stroke="#171817" strokeWidth="1.15" />
            <line x1="24.5" y1="14.3" x2="24.5" y2="16.4" stroke="#171817" strokeWidth="1.15" />
            <path d="M8.5 16.4C15.8 18.4 23.2 18.4 30.5 16.4L28.5 18.8H10.5L8.5 16.4Z" stroke="#171817" strokeWidth="1.3" strokeLinejoin="round" />
            <rect x="11.8" y="18.8" width="2.2" height="13.7" stroke="#171817" strokeWidth="1.15" />
            <rect x="11" y="32.5" width="3.8" height="2.2" stroke="#171817" strokeWidth="1.15" />
            <rect x="25" y="18.8" width="2.2" height="13.7" stroke="#171817" strokeWidth="1.15" />
            <rect x="24.2" y="32.5" width="3.8" height="2.2" stroke="#171817" strokeWidth="1.15" />
            <path d="M14 34.7V26C14 22.9624 16.4624 20.5 19.5 20.5C22.5376 20.5 25 22.9624 25 26V34.7" stroke="#171817" strokeWidth="1.3" />
            <circle cx="19.5" cy="26.5" r="1.7" fill="#A94F3D" />
          </svg>

          <div className="flex flex-col leading-none">
            <div className="flex items-start whitespace-nowrap">
              <span
                className="font-serif text-[18px] xl:text-[19px] 2xl:text-[21px] font-semibold tracking-[-0.01em] text-[#171817] group-hover:text-[#A94F3D] transition-colors leading-none"
                style={{ fontVariantNumeric: 'lining-nums' }}
              >
                Dấu Ấn Việt
              </span>
              <span className="font-sans text-[10px] font-semibold text-[#C9A46A] bg-[#171817] px-1.5 py-0.5 rounded-[4px] ml-1.5 leading-none tracking-normal">
                3D
              </span>
            </div>
            <span className="font-sans font-medium text-[11px] tracking-normal text-[#171817]/70 mt-1 whitespace-nowrap hidden 2xl:block">
              {lang === 'en'
                ? 'Digital Museum of Southern Heritage'
                : lang === 'zh'
                ? '东南部遗产数字博物馆'
                : 'Bảo tàng số Di sản Đông Nam Bộ'}
            </span>
          </div>
        </button>

        {/* 2. CENTER: SINGLE-LINE NAVIGATION TRAY */}
        <nav
          ref={adminNavRef}
          aria-label="Global Navigation"
          className="min-w-0 max-w-full mx-auto bg-[#EDE4D0] border border-[#171817]/15 rounded-full p-1 flex items-center justify-start md:justify-center gap-0.5 lg:gap-1 xl:gap-1.5 overflow-x-auto md:overflow-visible no-scrollbar whitespace-nowrap"
        >
          {navItems.map((item) => {
            const isAudio = item.id === 'audio';
            const isActive = !isAudio && activeTab === item.id;
            const isEdtech = item.id === 'edtech';
            const isLocked = !user && item.id !== 'explore';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'explore') {
                    handleNavigateTab('explore');
                    return;
                  }
                  if (isAudio) {
                    requireAuth(() => openModalForSite(selectedSite.id), item.label);
                  } else {
                    requireAuth(() => handleNavigateTab(item.id as MainTab), item.label);
                  }
                }}
                className={`text-[12px] xl:text-[12.5px] 2xl:text-[13px] tracking-normal whitespace-nowrap shrink-0 rounded-full px-2 lg:px-2.5 xl:px-3 2xl:px-3.5 py-1.5 transition-all duration-200 cursor-pointer inline-flex items-center gap-1 xl:gap-1.5 ${
                  isActive
                    ? 'bg-[#A94F3D] text-[#D8C9A9] font-semibold'
                    : 'text-[#171817]/75 hover:text-[#171817] hover:bg-[#171817]/8'
                }`}
              >
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C9A46A] shrink-0" />
                )}
                {isEdtech && (
                  <Ticket className={`w-3.5 h-3.5 shrink-0 hidden sm:inline ${isActive ? 'text-[#D8C9A9]' : 'text-[#A94F3D]'}`} />
                )}
                <span>{item.label}</span>
                {isLocked && (
                  <Lock className={`w-3 h-3 shrink-0 ${isActive ? 'text-[#D8C9A9]' : 'text-[#47796D]'}`} />
                )}
              </button>
            );
          })}
        </nav>

        {/* 3. RIGHT: VI | EN | ZH PILL SWITCHER + AUTH PORTAL + ? GUIDE */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="inline-flex items-center p-0.5 rounded-full bg-[#EDE4D0] border border-[#171817]/15">
            {(['vi', 'en', 'zh'] as Language[]).map((l, idx) => (
              <React.Fragment key={l}>
                {idx > 0 && (
                  <span className="text-[10px] text-[#171817]/20 select-none">|</span>
                )}
                <button
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-1.5 xl:px-2 py-1 rounded-full text-[10.5px] font-semibold uppercase tracking-normal transition-colors cursor-pointer whitespace-nowrap ${
                    lang === l
                      ? 'bg-[#171817] text-[#D8C9A9]'
                      : 'text-[#171817]/70 hover:text-[#171817]'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Auth Portal: Sign In (Logged out) OR Avatar + Role Badge + Dropdown (Logged in) */}
          {!user ? (
            <button
              type="button"
              onClick={() => openAuthModal()}
              className="h-8 px-2.5 xl:px-3 rounded-full bg-[#EDE4D0] hover:bg-[#171817] border border-[#171817]/20 text-[#171817] hover:text-[#D8C9A9] text-xs font-medium inline-flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer group"
            >
              <LogIn className="w-3.5 h-3.5 text-[#A94F3D] group-hover:text-[#C9A46A] shrink-0" />
              <span>
                {lang === 'en' ? 'Sign In' : lang === 'zh' ? '登录' : 'Đăng nhập'}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 relative" ref={userMenuRef}>
              {isStrictAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsAdminStudioOpen(true);
                  }}
                  className="hidden md:inline-flex h-8 px-2.5 xl:px-3 rounded-full bg-[#C9A46A] hover:bg-[#171817] border border-[#171817]/20 text-[#171817] hover:text-[#C9A46A] text-[11px] font-semibold items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Admin Studio</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-expanded={isUserMenuOpen}
                className="h-8 pl-1 pr-2 rounded-full bg-[#EDE4D0] hover:bg-[#F4EFE4] border border-[#171817]/18 flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <span
                  className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                    isStrictAdmin
                      ? 'bg-[#C9A46A] text-[#171817]'
                      : isNonAdminTesterPro
                      ? 'bg-[#47796D] text-[#D8C9A9]'
                      : userTier === 'pro'
                      ? 'bg-[#171817] text-[#C9A46A] border border-[#C9A46A]/60'
                      : userTier === 'plus'
                      ? 'bg-[#526D8B] text-[#D8C9A9]'
                      : 'bg-[#47796D] text-[#D8C9A9]'
                  }`}
                >
                  {user.avatarInitials}
                </span>
                <span className="hidden lg:inline text-xs font-medium text-[#171817] max-w-[96px] 2xl:max-w-[130px] truncate">
                  {user.displayName}
                </span>
                {(isStrictAdmin || isNonAdminTesterPro || userTier === 'plus' || userTier === 'pro') ? (
                  <span className="hidden md:inline-flex">{renderTierPill('light')}</span>
                ) : (
                  <span className="hidden 2xl:inline-flex">{renderTierPill('light')}</span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-[#171817]/70 shrink-0" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-68 rounded-2xl bg-[#F4EFE4] border border-[#171817]/20 shadow-[0_18px_40px_rgba(23,24,23,0.18)] p-1.5 z-[65] animate-apple-sheet">
                  <div className="px-3 py-2.5 border-b border-[#171817]/12">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-[#171817] truncate">
                        {user.displayName}
                      </div>
                      {renderTierPill('light')}
                    </div>
                    <div className="text-[11px] text-[#171817]/65 truncate mt-0.5 tabular-nums">
                      {user.email || (user.provider === 'facebook' ? 'Facebook Account' : 'Google Account')}
                    </div>
                    <div className="mt-1.5 flex flex-col items-start gap-1">
                      <span className="text-[11px] font-medium text-[#171817]/70">
                        {isStrictAdmin
                          ? lang === 'en'
                            ? 'Administrator (Super/Team Admin)'
                            : lang === 'zh'
                            ? '管理员 (超级/团队管理员)'
                            : 'Quản trị viên (Super/Team Admin)'
                          : isNonAdminTesterPro
                          ? lang === 'en'
                            ? 'Tester Pro · QA & Gemini 4 Hydrogen'
                            : lang === 'zh'
                            ? '专业测试版 · QA 与 Gemini 4 Hydrogen'
                            : 'Người thử nghiệm Pro · QA & Gemini 4 Hydrogen'
                          : userTier === 'pro'
                          ? lang === 'en'
                            ? 'Pro Plan (49,000 VND) · Fast-Track'
                            : lang === 'zh'
                            ? 'Pro 尊享套餐 (49,000đ) · 优先支持'
                            : 'Gói Pro (49.000đ) · Hỗ trợ Ưu tiên Nhanh'
                          : userTier === 'plus'
                          ? lang === 'en'
                            ? 'Plus Plan (19,000 VND) · Gemini 3.5 Flash'
                            : lang === 'zh'
                            ? 'Plus 标准套餐 (19,000đ) · Gemini 3.5 Flash'
                            : 'Gói Plus (19.000đ) · Gemini 3.5 Flash'
                          : lang === 'en'
                          ? 'Visitor · Standard Access'
                          : lang === 'zh'
                          ? '访客 · 参观权限'
                          : 'Du khách · Quyền tham quan'}
                      </span>
                      {isNonAdminBetaTester && (
                        <span className="text-[11px] font-medium text-[#A94F3D] mt-0.5">
                          {lang === 'en'
                            ? 'Beta Tester Account · Labs'
                            : lang === 'zh'
                            ? '测试版账户 · Labs'
                            : 'Tài khoản Thử nghiệm · Labs'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="py-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsMyJourneyOpen(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-[#171817] hover:bg-[#EDE4D0] flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <Ticket className="w-3.5 h-3.5 text-[#A94F3D] shrink-0" />
                      <span>
                        {lang === 'en'
                          ? 'My Tickets & Journey'
                          : lang === 'zh'
                          ? '我的门票与探索旅程'
                          : 'Vé & Hành trình của tôi'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setSupportDefaultTab(hasUnreadSupport ? 'tickets' : 'faq');
                        setIsSupportModalOpen(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-[#171817] hover:bg-[#EDE4D0] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <LifeBuoy className="w-3.5 h-3.5 text-[#47796D] shrink-0" />
                        <span className="truncate">
                          {lang === 'en'
                            ? 'Help & Support'
                            : lang === 'zh'
                            ? '帮助与支持'
                            : 'Trợ giúp & Hỗ trợ'}
                        </span>
                      </span>
                      {hasUnreadSupport && (
                        <span className="w-2 h-2 rounded-full bg-[#A94F3D] shrink-0" />
                      )}
                    </button>

                    {isStrictAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setIsAdminStudioOpen(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-[#171817] bg-[#C9A46A]/35 hover:bg-[#C9A46A]/55 flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {lang === 'en'
                            ? 'Open Admin Studio'
                            : lang === 'zh'
                            ? '打开 Admin Studio'
                            : 'Mở Admin Studio'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsAdminStudioOpen(false);
                        setIsMyJourneyOpen(false);
                        setIsFeedbackModalOpen(false);
                        setDetailModalSiteId(null);
                        setVrModalSiteId(null);
                        setPhotoManagerSiteId(null);
                        setShowLisboaSplit(false);
                        setIsAiChatOpen(false);
                        setCinemaState({ isOpen: false, siteId: null, activeVideoHeritageId: null });
                        setActiveTab('explore');
                        logout();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-[#A94F3D] font-semibold hover:bg-[#A94F3D]/12 flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {lang === 'en'
                          ? 'Sign Out'
                          : lang === 'zh'
                          ? '退出登录'
                          : 'Đăng xuất'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setSupportDefaultTab(hasUnreadSupport ? 'tickets' : 'faq');
              setIsSupportModalOpen(true);
            }}
            aria-label={lang === 'en' ? 'Support' : lang === 'zh' ? '支持' : 'Hỗ trợ'}
            title={lang === 'en' ? 'Support' : lang === 'zh' ? '支持' : 'Hỗ trợ'}
            className="group relative w-8 h-8 rounded-full bg-[#EDE4D0] border border-[#171817]/20 hover:bg-[#171817] text-[#171817] hover:text-[#D8C9A9] flex items-center justify-center transition-all shrink-0 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            {hasUnreadSupport && (
              <span
                aria-label="Có phản hồi mới từ Ban Quản lý"
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#A94F3D] ring-2 ring-[#D8C9A9] animate-pulse"
              />
            )}
            <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute right-0 top-full mt-2 px-2.5 py-1 rounded-full bg-[#171817] border border-[#C9A46A]/45 text-[11px] font-medium text-[#D8C9A9] whitespace-nowrap shadow-xl z-[70]">
              {lang === 'en' ? 'Support' : lang === 'zh' ? '支持' : 'Hỗ trợ'}
            </span>
          </button>
        </div>
      </header>
      </div>

      {/* Mobile Right Slide-Over Navigation Drawer (< 768px) */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-[#171817]/70 z-[75]"
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={lang === 'en' ? 'Mobile Navigation' : lang === 'zh' ? '移动导航' : 'Menu điều hướng'}
            className="fixed inset-y-0 right-0 w-72 max-w-[85vw] bg-[#171817] border-l border-[#C9A46A]/30 text-[#D8C9A9] z-[80] p-5 flex flex-col justify-between overflow-y-auto"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#C9A46A]/20">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-base font-semibold text-[#D8C9A9]">Dấu Ấn Việt</span>
                  <span className="text-[10px] font-semibold bg-[#C9A46A] text-[#171817] px-1.5 py-0.5 rounded-[4px]">
                    3D
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label={lang === 'en' ? 'Close menu' : lang === 'zh' ? '关闭菜单' : 'Đóng menu'}
                  className="w-8 h-8 rounded-full border border-[#D8C9A9]/20 text-[#D8C9A9] hover:border-[#C9A46A] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Account Card */}
              {user ? (
                <div className="p-3 rounded-xl bg-[#D8C9A9]/5 border border-[#C9A46A]/25 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#D8C9A9] truncate">
                      {user.displayName}
                    </span>
                    {renderTierPill('dark')}
                  </div>
                  <div className="text-[11px] text-[#D8C9A9]/65 truncate tabular-nums">
                    {user.email || (user.provider === 'facebook' ? 'Facebook Account' : 'Google Account')}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    openAuthModal();
                  }}
                  className="w-full py-2.5 px-3 rounded-lg bg-[#A94F3D] hover:bg-[#8E4132] text-[#D8C9A9] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{lang === 'en' ? 'Sign In' : lang === 'zh' ? '登录' : 'Đăng nhập'}</span>
                </button>
              )}

              {/* Navigation Links */}
              <nav aria-label="Mobile Navigation" className="space-y-1">
                {navItems.map((item) => {
                  const isAudio = item.id === 'audio';
                  const isActive = !isAudio && activeTab === item.id;
                  const isLocked = !user && item.id !== 'explore';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        if (item.id === 'explore') {
                          handleNavigateTab('explore');
                          return;
                        }
                        if (isAudio) {
                          requireAuth(() => openModalForSite(selectedSite.id), item.label);
                        } else {
                          requireAuth(() => handleNavigateTab(item.id as MainTab), item.label);
                        }
                      }}
                      className={`w-full px-3 py-2.5 rounded-lg text-left text-xs font-medium flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-[#A94F3D] text-[#D8C9A9] font-semibold'
                          : 'text-[#D8C9A9]/85 hover:bg-[#D8C9A9]/10'
                      }`}
                    >
                      <span>{item.label}</span>
                      {isLocked && <Lock className="w-3.5 h-3.5 text-[#C9A46A] shrink-0" />}
                    </button>
                  );
                })}
              </nav>

              {/* Utility Actions */}
              <div className="pt-3 border-t border-[#C9A46A]/20 space-y-1">
                {user && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsMyJourneyOpen(true);
                    }}
                    className="w-full px-3 py-2 rounded-lg text-left text-xs text-[#D8C9A9] hover:bg-[#D8C9A9]/10 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Ticket className="w-3.5 h-3.5 text-[#C9A46A] shrink-0" />
                    <span>
                      {lang === 'en' ? 'My Tickets & Journey' : lang === 'zh' ? '我的门票与旅程' : 'Vé & Hành trình của tôi'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setSupportDefaultTab(hasUnreadSupport ? 'tickets' : 'faq');
                    setIsSupportModalOpen(true);
                  }}
                  className="w-full px-3 py-2 rounded-lg text-left text-xs text-[#D8C9A9] hover:bg-[#D8C9A9]/10 flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <LifeBuoy className="w-3.5 h-3.5 text-[#47796D] shrink-0" />
                    <span>
                      {lang === 'en' ? 'Help & Support' : lang === 'zh' ? '帮助与支持' : 'Trợ giúp & Hỗ trợ'}
                    </span>
                  </span>
                  {hasUnreadSupport && <span className="w-2 h-2 rounded-full bg-[#A94F3D]" />}
                </button>

                {isStrictAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsAdminStudioOpen(true);
                    }}
                    className="w-full px-3 py-2 rounded-lg text-left text-xs font-semibold bg-[#C9A46A] text-[#171817] flex items-center gap-2.5 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Admin Studio</span>
                  </button>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#C9A46A]/20 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider text-[#D8C9A9]/60">
                  {lang === 'en' ? 'Language' : lang === 'zh' ? '语言' : 'Ngôn ngữ'}
                </span>
                <div className="inline-flex items-center p-0.5 rounded-full bg-[#D8C9A9]/10 border border-[#C9A46A]/30">
                  {(['vi', 'en', 'zh'] as Language[]).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLang(l)}
                      className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase cursor-pointer ${
                        lang === l ? 'bg-[#C9A46A] text-[#171817]' : 'text-[#D8C9A9]/75'
                      }`}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {user && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsAdminStudioOpen(false);
                    setIsMyJourneyOpen(false);
                    setIsFeedbackModalOpen(false);
                    setDetailModalSiteId(null);
                    setVrModalSiteId(null);
                    setPhotoManagerSiteId(null);
                    setShowLisboaSplit(false);
                    setIsAiChatOpen(false);
                    setCinemaState({ isOpen: false, siteId: null, activeVideoHeritageId: null });
                    setActiveTab('explore');
                    logout();
                  }}
                  className="w-full px-3 py-2 rounded-lg text-left text-xs text-[#A94F3D] font-semibold hover:bg-[#A94F3D]/15 flex items-center gap-2.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'en' ? 'Sign Out' : lang === 'zh' ? '退出登录' : 'Đăng xuất'}</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Event Announcement Banner controlled from Admin Studio -> Site Settings */}
      {siteSettings.bannerEnabled && siteSettings.bannerText.trim() && (
        <div className="bg-[#EDE4D0] border-b border-[#171817]/15 px-4 py-2 text-center">
          <button
            type="button"
            onClick={() => {
              if (siteSettings.bannerLinkTab === 'explore') {
                handleNavigateTab('explore');
              } else {
                requireAuth(
                  () => handleNavigateTab(siteSettings.bannerLinkTab),
                  siteSettings.bannerText
                );
              }
            }}
            className="text-xs font-medium text-[#171817] hover:text-[#A94F3D] transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <span className="px-2 py-0.5 rounded-full bg-[#A94F3D] text-[#D8C9A9] text-[11px] font-semibold shrink-0">
              {lang === 'en' ? 'Event' : lang === 'zh' ? '活动' : 'Sự kiện'}
            </span>
            <span>{siteSettings.bannerText}</span>
          </button>
        </div>
      )}

      {/* ====================================================================
          2. MAIN VIEWPORT CONTENT (sticky h-16 header above)
         ==================================================================== */}
      <main className="flex-1 flex flex-col bg-[#D8C9A9]">
        {sites.length === 0 && !canPreviewHidden ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#C9A46A] border border-[#171817]/20 flex items-center justify-center text-[#171817]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#171817]">
              {lang === 'en'
                ? 'The Exhibition Gallery is Being Updated by Curators'
                : lang === 'zh'
                ? '展厅正在由博物馆管理委员会更新维护'
                : 'Không gian trưng bày đang được Ban Quản lý cập nhật'}
            </h2>
            <p className="text-sm text-[#171817]/75 max-w-md">
              {lang === 'en'
                ? 'All monument dossiers are currently in internal maintenance mode. Please check back shortly or contact an Administrator.'
                : lang === 'zh'
                ? '当前所有遗产档案处于内部维护模式。请稍后访问或联系管理员。'
                : 'Hiện tất cả hồ sơ di tích đang ở chế độ bảo trì nội bộ. Vui lòng quay lại sau hoặc liên hệ Quản trị viên.'}
            </p>
          </div>
        ) : (
          <>
        {/* TAB 1: KHÁM PHÁ */}
        {!isAudioModalOpen && activeTab === 'explore' && (
          <div className="relative w-full bg-[#D8C9A9]">
            <AppleErrorBoundary
              variant="spatial3d"
              lang={lang}
              onReset={() => setViewerResetKey((k) => k + 1)}
            >
              <AppleScrollytellingHome
                key={`explore-${viewerResetKey}`}
                sites={sites}
                hiddenSiteIds={hiddenSiteIds}
                selectedSite={selectedSite}
                isAuthenticated={Boolean(user)}
                guidedTours={resolvedGuidedTours}
                masterpieceSite={masterpieceSite}
                onStartGuidedTour={(tour) =>
                  requireAuth(
                    (authedUser) => startGuidedTourSession(tour, authedUser),
                    tour.route.title
                  )
                }
                onStartMasterpiece={() =>
                  requireAuth(
                    (authedUser) => startMasterpieceSession(authedUser),
                    masterpieceSite
                      ? getLocalizedSite(masterpieceSite).officialName
                      : 'Không gian 3D'
                  )
                }
                onSelectSite={(site) => setSelectedSiteId(site.id)}
                onOpen3D={(site) =>
                  requireAuth(
                    (authedUser) => handleOpen3D(site, authedUser),
                    lang === 'en' ? '3D Space' : lang === 'zh' ? '3D 空间' : 'Không gian 3D'
                  )
                }
                onOpenDetailModal={(site) =>
                  requireAuth(
                    (authedUser) => handleOpenDetailModal(site, authedUser),
                    lang === 'en' ? 'Heritage Dossier' : lang === 'zh' ? '遗产档案' : 'Hồ sơ Di sản'
                  )
                }
                onOpenAudioModal={(site) =>
                  requireAuth(
                    () => openModalForSite(site.id),
                    lang === 'en' ? 'Audio Guide' : lang === 'zh' ? '语音导览' : 'Thuyết minh'
                  )
                }
                onOpenPhotoManager={(site) =>
                  requireAuth(
                    () => setPhotoManagerSiteId(site.id),
                    lang === 'en' ? 'Archive Photos' : lang === 'zh' ? '实景照片' : 'Ảnh tư liệu'
                  )
                }
                onOpenLisboaSplit={() =>
                  requireAuth(
                    () => setShowLisboaSplit(true),
                    lang === 'en' ? 'Past & Present' : lang === 'zh' ? '古今对比' : 'So sánh Xưa & Nay'
                  )
                }
                onOpenCinemaModal={(site) =>
                  requireAuth(
                    () => handleOpenCinemaModal(site),
                    lang === 'en' ? 'Documentary Video' : lang === 'zh' ? '纪录片' : 'Video Tư Liệu'
                  )
                }
                onNavigateTab={(tab) => {
                  if (tab === 'explore') {
                    handleNavigateTab('explore');
                  } else {
                    requireAuth(
                      () => handleNavigateTab(tab),
                      tab === 'space3d'
                        ? 'Không gian 3D'
                        : tab === 'map_routes'
                        ? 'Bản đồ & Tuyến'
                        : tab === 'catalog'
                        ? 'Hồ sơ Di sản'
                        : 'Vé & Học liệu'
                    );
                  }
                }}
                isPaused={
                  activeTab !== 'explore' ||
                  cinemaState.isOpen ||
                  showLisboaSplit ||
                  Boolean(detailModalSite) ||
                  isAudioModalOpen ||
                  Boolean(vrModalSite) ||
                  Boolean(photoManagerSite) ||
                  isGuideOpen ||
                  isAiChatOpen ||
                  isAuthModalOpen ||
                  isAdminStudioOpen ||
                  isMyJourneyOpen ||
                  isFeedbackModalOpen ||
                  isLabsModalOpen ||
                  isQuickNoteOpen ||
                  isGuidedWelcomeOpen ||
                  Boolean(completedGuidedTour)
                }
              />
            </AppleErrorBoundary>
          </div>
        )}

        {/* TAB 2: KHÔNG GIAN 3D — KEEPS #171817 STAGE */}
        {activeTab === 'space3d' && (
          <div
            className={
              isAudioModalOpen
                ? 'hidden'
                : 'w-full h-[calc(100vh-4rem)] bg-[#171817] relative overflow-hidden'
            }
          >
            <AppleErrorBoundary
              variant="spatial3d"
              lang={lang}
              onReset={() => setViewerResetKey((k) => k + 1)}
              onReturnHome={() => handleNavigateTab('explore')}
            >
              <ThreeDModelViewer
                key={`space3d-${viewerResetKey}`}
                site={selectedSite}
                sites={sites}
                hiddenSiteIds={hiddenSiteIds}
                onSelectSite={(site) => {
                  setSelectedSiteId(site.id);
                  void recordServerSiteView(
                    site.id,
                    site.officialName,
                    'open_3d',
                    user?.displayName || user?.email
                  );
                  recordVisitorExploredSite(user?.userId, site.id);
                }}
                onUpdateCustomPhoto={(siteId, photoDataUrl) => {
                  const updated = saveCustomSitePhoto(siteId, photoDataUrl);
                  setCustomPhotosMap(updated);
                }}
                onRestoreDefaultPhoto={(siteId) => {
                  const updated = removeCustomSitePhoto(siteId);
                  setCustomPhotosMap(updated);
                }}
                isGettyLanding={false}
                defaultLightingMode={siteSettings.default3DLighting}
                initialRenderMode={pending3DRenderMode}
                initialExplodedFactor={pending3DExploded}
                onOpenMapOverlay={() => handleLocateOnMap(selectedSite)}
                onOpenAudioModal={(site) => openModalForSite(site.id)}
                onOpenVideoModal={(site) => handleOpenCinemaModal(site)}
                onOpenDetailModal={(site) => handleOpenDetailModal(site)}
                onOpenArchiveDrawer={() => {
                  setCatalogSubView('dossiers');
                  handleNavigateTab('catalog');
                }}
                onNavigateToTickets={() => handleNavigateTab('edtech')}
                isPaused={
                  activeTab !== 'space3d' ||
                  cinemaState.isOpen ||
                  showLisboaSplit ||
                  Boolean(detailModalSite) ||
                  isAudioModalOpen ||
                  Boolean(vrModalSite) ||
                  Boolean(photoManagerSite) ||
                  isGuideOpen ||
                  isAiChatOpen ||
                  isAuthModalOpen ||
                  isAdminStudioOpen ||
                  isMyJourneyOpen ||
                  isFeedbackModalOpen ||
                  isGuidedWelcomeOpen ||
                  Boolean(completedGuidedTour)
                }
              />
            </AppleErrorBoundary>

            {masterpieceAudioHintSite &&
              selectedSite.id === masterpieceAudioHintSite.id &&
              !isAudioModalOpen &&
              !isAudioPlaying && (
                <div
                  role="status"
                  className="fixed top-20 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100vw-2rem)] rounded-full bg-[#F4EFE4] border border-[#171817]/20 px-4 py-2 shadow-lg flex items-center gap-2.5 animate-apple-sheet"
                >
                  <Headphones className="w-4 h-4 text-[#A94F3D] shrink-0" />
                  <span className="text-xs text-[#171817] truncate">
                    {lang === 'en'
                      ? 'Exploring masterpiece '
                      : lang === 'zh'
                      ? '正在打开杰作 '
                      : 'Đang mở kiệt tác '}
                    <strong className="text-[#A94F3D]">
                      {getLocalizedSite(masterpieceAudioHintSite).officialName}
                    </strong>
                    {lang === 'en'
                      ? ' · Start audio narration?'
                      : lang === 'zh'
                      ? ' · 是否开启语音导览？'
                      : ' · Gợi ý bật thuyết minh?'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = masterpieceAudioHintSite.id;
                      setMasterpieceAudioHintSite(null);
                      startAudioGuideForSite(targetId);
                    }}
                    className="px-3 py-1 rounded-full bg-[#A94F3D] hover:bg-[#171817] text-[#D8C9A9] text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                  >
                    {lang === 'en'
                      ? 'Play Audio Guide'
                      : lang === 'zh'
                      ? '开启导览'
                      : 'Bật thuyết minh'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMasterpieceAudioHintSite(null)}
                    aria-label={
                      lang === 'en'
                        ? 'Dismiss audio hint'
                        : lang === 'zh'
                        ? '关闭语音提示'
                        : 'Đóng gợi ý thuyết minh'
                    }
                    className="w-6 h-6 rounded-full bg-[#EDE4D0] hover:bg-[#171817] text-[#171817] hover:text-[#D8C9A9] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
          </div>
        )}

        {/* TAB 3: BẢN ĐỒ & TUYẾN — GIS MULTI-LAYER & 7 INTER-REGIONAL ROUTES */}
        {!isAudioModalOpen && activeTab === 'map_routes' && (
          <div className="w-full h-[calc(100vh-4rem)] bg-[#D8C9A9] flex flex-col lg:flex-row overflow-hidden">
            <div className="w-full lg:w-[375px] xl:w-[400px] h-[44%] lg:h-full shrink-0 border-b lg:border-b-0 lg:border-r border-[#171817]/15 bg-[#F4EFE4] flex flex-col overflow-hidden">
              {/* Compact Segmented Switcher: Bản đồ GIS | 7 Tuyến Di sản */}
              <div className="p-2.5 border-b border-[#171817]/15 bg-[#EDE4D0] shrink-0">
                <div className="grid grid-cols-2 p-1 rounded-full bg-[#D8C9A9] border border-[#171817]/15 gap-1">
                  <button
                    type="button"
                    onClick={() => setMapSubView('gis')}
                    className={`py-1.5 px-3 rounded-full text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      mapSubView === 'gis'
                        ? 'bg-[#A94F3D] text-[#D8C9A9] font-semibold'
                        : 'text-[#171817]/75 hover:text-[#171817]'
                    }`}
                  >
                    <MapIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {lang === 'en' ? 'GIS Map' : lang === 'zh' ? 'GIS 地图' : 'Bản đồ GIS'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMapSubView('routes');
                      handleSelectTourRoute(activeTour || TOUR_ROUTES[0]);
                    }}
                    className={`py-1.5 px-3 rounded-full text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      mapSubView === 'routes'
                        ? 'bg-[#47796D] text-[#171817] font-semibold'
                        : 'text-[#171817]/75 hover:text-[#171817]'
                    }`}
                  >
                    <Route className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {lang === 'en'
                        ? `${TOUR_ROUTES.length} Routes`
                        : lang === 'zh'
                        ? `${TOUR_ROUTES.length}条主题路线`
                        : `${TOUR_ROUTES.length} Tuyến Di sản`}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                {mapSubView === 'gis' ? (
                  <FloatingExplorer
                    sites={filteredMapSites}
                    hiddenSiteIds={hiddenSiteIds}
                    selectedSite={selectedSite}
                    onSelectSite={(site) => {
                      setSelectedSiteId(site.id);
                      setMapFocusTick((t) => t + 1);
                    }}
                    onOpen3D={(site) => handleOpen3D(site)}
                    onOpenARAudio={(site) => openModalForSite(site.id)}
                    onOpenDetailModal={(site) => handleOpenDetailModal(site)}
                    onOpenVideo={(site) => handleOpenCinemaModal(site)}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    filterRanking={filterRanking}
                    onFilterRankingChange={setFilterRanking}
                    filterDistrict={filterDistrict}
                    onFilterDistrictChange={setFilterDistrict}
                    filterType={filterType}
                    onFilterTypeChange={setFilterType}
                    filterTech={filterTech}
                    onFilterTechChange={setFilterTech}
                    uniqueDistricts={uniqueDistricts}
                    totalSitesCount={sites.length}
                    activeTour={null}
                    onSelectTour={(tour) => {
                      handleSelectTourRoute(tour);
                      if (tour) {
                        setMapSubView('routes');
                      }
                    }}
                  />
                ) : (
                  <TourRoutePanel
                    activeTour={activeTour}
                    onSelectTour={handleSelectTourRoute}
                    allSites={sites}
                    hiddenSiteIds={hiddenSiteIds}
                    selectedSite={selectedSite}
                    completedRouteIds={visitorRecord?.completedRouteIds || []}
                    onCompleteTour={(tour) => {
                      if (user) {
                        recordVisitorCompletedRoute(user.userId, tour.id);
                      }
                    }}
                    onFocusSite={(site) => {
                      setSelectedSiteId(site.id);
                      setMapFocusTick((t) => t + 1);
                    }}
                    onOpen3D={(site) => handleOpen3D(site)}
                    onOpenARAudio={(site) => openModalForSite(site.id)}
                    onOpenDetailModal={(site) => handleOpenDetailModal(site)}
                    onOpenVideo={(site) => handleOpenCinemaModal(site)}
                  />
                )}
              </div>
            </div>

            <div className="flex-1 h-[56%] lg:h-full relative overflow-hidden">
              <MapCanvas
                sites={mapSubView === 'gis' ? filteredMapSites : sites}
                selectedSite={selectedSite}
                activeMapHeritageId={activeMapHeritageId}
                focusTick={mapFocusTick}
                onSelectSite={(site) => {
                  if (site) setSelectedSiteId(site.id);
                }}
                activeTour={mapSubView === 'routes' ? activeTour : null}
                baseMapMode={baseMapMode}
                onChangeBaseMapMode={setBaseMapMode}
                onOpenARAudio={(site) => openModalForSite(site.id)}
                onTriggerAudioGuide={(site) => startAudioGuideForSite(site.id)}
                onOpen3D={(site) => handleOpen3D(site)}
                onOpenDetailModal={(site) => handleOpenDetailModal(site)}
                onOpenPhotoManager={(site) => setPhotoManagerSiteId(site.id)}
                onOpenVideo={(site) => handleOpenCinemaModal(site)}
                onOpenPastPresentSplit={(site) => {
                  setSelectedSiteId(site.id);
                  setShowLisboaSplit(true);
                }}
              />
            </div>
          </div>
        )}

        {/* TAB 4: HỒ SƠ DI SẢN & BIÊN NIÊN SỬ 300 NĂM */}
        {!isAudioModalOpen && activeTab === 'catalog' && (
          <div className="flex-1 w-full bg-[#D8C9A9]">
            {/* Centered Editorial Pill Sub-Navigation */}
            <div className="w-full pt-8 pb-2 px-4 flex justify-center">
              <div className="inline-flex items-center p-1 rounded-full bg-[#EDE4D0] border border-[#171817]/15 gap-1">
                <button
                  type="button"
                  onClick={() => setCatalogSubView('dossiers')}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    catalogSubView === 'dossiers'
                      ? 'bg-[#A94F3D] text-[#D8C9A9] font-semibold'
                      : 'text-[#171817]/75 hover:text-[#171817]'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'en'
                      ? `${sites.length} Heritage Dossiers`
                      : lang === 'zh'
                      ? `${sites.length} 份遗产档案`
                      : `${sites.length} Hồ sơ Di tích`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogSubView('timeline')}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    catalogSubView === 'timeline'
                      ? 'bg-[#47796D] text-[#171817] font-semibold'
                      : 'text-[#171817]/75 hover:text-[#171817]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'en'
                      ? '300-Year Chronicle'
                      : lang === 'zh'
                      ? '300年历史编年史'
                      : 'Biên niên sử 300 Năm'}
                  </span>
                </button>
              </div>
            </div>

            {catalogSubView === 'dossiers' ? (
              <HeritageCatalog
                sites={sites}
                hiddenSiteIds={hiddenSiteIds}
                onSelectSiteOnMap={(site) => handleLocateOnMap(site)}
                onOpen3D={(site) => handleOpen3D(site)}
                onOpenVR360={(site) => setVrModalSiteId(site.id)}
                onOpenARAudio={(site) => openModalForSite(site.id)}
                onOpenDetailModal={(site) => handleOpenDetailModal(site)}
                onOpenVideo={(site) => handleOpenCinemaModal(site)}
                customPhotosMap={customPhotosMap}
                onOpenPhotoManager={(site) => setPhotoManagerSiteId(site.id)}
              />
            ) : (
              <HistoricalTimeline
                sites={sites}
                hiddenSiteIds={hiddenSiteIds}
                onSelectSiteById={(siteId) => handleOpenDetailModal(siteId)}
                onOpen3DById={(siteId) => {
                  const target = sites.find((s) => s.id === siteId) || selectedSite;
                  if (target) {
                    handleOpen3D(target);
                  } else {
                    setSelectedSiteId(siteId);
                    setActiveTab('space3d');
                    window.scrollTo({ top: 0, behavior: 'auto' });
                  }
                }}
                onOpenVRById={(siteId) => {
                  setSelectedSiteId(siteId);
                  setVrModalSiteId(siteId);
                }}
              />
            )}
          </div>
        )}

        {/* TAB 5: VÉ & HỌC LIỆU (COMMERCIALIZATION & EDTECH HUB) */}
        {!isAudioModalOpen && activeTab === 'edtech' && (
          <div className="flex-1 w-full bg-[#D8C9A9]">
            <CommercializationEdTechHub
              sites={sites}
              hiddenSiteIds={hiddenSiteIds}
              preselectedGuidedRoute={preselectedGuidedRoute}
              onStart3DVipExperience={(siteId) => {
                const target =
                  (siteId ? sites.find((s) => s.id === siteId) : null) || selectedSite;
                if (target) {
                  handleOpen3D(target);
                } else {
                  if (siteId) setSelectedSiteId(siteId);
                  setActiveTab('space3d');
                  window.scrollTo({ top: 0, behavior: 'auto' });
                }
              }}
              onNavigateToMap={() => {
                setMapSubView('gis');
                setActiveTab('map_routes');
                window.scrollTo({ top: 0, behavior: 'auto' });
              }}
              onOpenAudioGuide={(site) => openModalForSite(site.id)}
              onOpenMyJourney={() => setIsMyJourneyOpen(true)}
              onOpenFeedback={() =>
                requireAuth(
                  () => setIsFeedbackModalOpen(true),
                  lang === 'en' ? 'Experience Feedback' : lang === 'zh' ? '体验评价' : 'Đánh giá trải nghiệm'
                )
              }
            />
          </div>
        )}

        {/* TAB 6: THUYẾT MINH DI SẢN — DARK EDITORIAL MUSEUM (DƯỚI NAVBAR) */}
        {isAudioModalOpen && (
          <ARAudioModal
            site={audioActiveSite || selectedSite}
            onClose={() => minimizeModalKeepPlaying()}
            onBackToExplore={() => {
              minimizeModalKeepPlaying();
              setActiveTab('explore');
              window.scrollTo({ top: 0, behavior: 'auto' });
            }}
            onSelectSite={(chosen) => setSelectedSiteId(chosen.id)}
            onLaunch3D={() => {
              const target = audioActiveSite || selectedSite;
              minimizeModalKeepPlaying();
              handleOpen3D(target);
            }}
            onNavigateToMap={(site) => {
              minimizeModalKeepPlaying();
              handleLocateOnMap(site);
            }}
            onOpenPhotoManager={(site) => {
              setPhotoManagerSiteId(site.id);
            }}
          />
        )}
          </>
        )}
      </main>

      {/* ====================================================================
          3. MODALS & FLOATING GEMINI AI CURATOR
         ==================================================================== */}
      {showLisboaSplit && (
        <LisboaDiagonalSplitOverlay
          site={selectedSite}
          sites={sites}
          lang={lang}
          onClose={() => setShowLisboaSplit(false)}
          onSwitchSite={(chosenSite) => {
            setSelectedSiteId(chosenSite.id);
            setMapFocusTick((t) => t + 1);
          }}
          onUpdateCustomPhoto={(siteId, photoDataUrl) => {
            const updated = saveCustomSitePhoto(siteId, photoDataUrl);
            setCustomPhotosMap(updated);
          }}
          onRestoreDefaultPhoto={(siteId) => {
            const updated = removeCustomSitePhoto(siteId);
            setCustomPhotosMap(updated);
          }}
          onExploreAction={(chosenSite) => {
            setShowLisboaSplit(false);
            handleOpen3D(chosenSite || selectedSite);
          }}
        />
      )}

      {detailModalSite && (
        <HeritageDetailModal
          site={detailModalSite}
          isHiddenForVisitors={hiddenSiteIds.includes(detailModalSite.id)}
          onClose={() => setDetailModalSiteId(null)}
          onLaunch3D={() => {
            const target = detailModalSite;
            setDetailModalSiteId(null);
            handleOpen3D(target);
          }}
          onLaunchVR360={() => {
            const targetId = detailModalSite.id;
            setDetailModalSiteId(null);
            setVrModalSiteId(targetId);
          }}
          onLaunchAudio={() => {
            const targetId = detailModalSite.id;
            setDetailModalSiteId(null);
            openModalForSite(targetId);
          }}
          onLaunchVideo={() => {
            const target = detailModalSite;
            setDetailModalSiteId(null);
            handleOpenCinemaModal(target);
          }}
          onNavigateToMap={(site) => {
            setDetailModalSiteId(null);
            handleLocateOnMap(site);
          }}
          onOpenPhotoManager={(site) => {
            setPhotoManagerSiteId(site.id);
          }}
        />
      )}

      {vrModalSite && (
        <VR360Viewer
          site={vrModalSite}
          sites={sites}
          onClose={() => setVrModalSiteId(null)}
          onSwitchSite={(site) => {
            setSelectedSiteId(site.id);
            setVrModalSiteId(site.id);
          }}
          onLaunch3D={() => {
            const target = vrModalSite;
            setVrModalSiteId(null);
            handleOpen3D(target);
          }}
          onOpenAudioGuide={() => {
            const targetId = vrModalSite.id;
            setVrModalSiteId(null);
            openModalForSite(targetId);
          }}
          onOpenDossier={(site) => {
            setVrModalSiteId(null);
            handleOpenDetailModal(site);
          }}
        />
      )}

      {photoManagerSite && (
        <CustomPhotoManagerModal
          site={photoManagerSite}
          hasCustomPhoto={hasAnyCustomPhotoForSite(customPhotosMap, photoManagerSite.id)}
          customPhotosMap={customPhotosMap}
          onClose={() => setPhotoManagerSiteId(null)}
          onSaveCustomPhoto={(siteId, photoDataOrUrl, slot: PhotoSlotIndex = 0) => {
            const updated = saveCustomSitePhoto(siteId, photoDataOrUrl, slot);
            setCustomPhotosMap(updated);
          }}
          onRestoreDefaultPhoto={(siteId, slot?: PhotoSlotIndex) => {
            const updated = removeCustomSitePhoto(siteId, slot);
            setCustomPhotosMap(updated);
          }}
          onRestoreAllDefaultPhotos={() => {
            clearAllCustomSitePhotos();
            setCustomPhotosMap(loadCustomPhotosMap());
          }}
        />
      )}

      {/* Guided Tour Progress Bar (non-intrusive bottom bar) */}
      {user && activeGuidedTour && (
        <GuidedTourProgressBar
          route={activeGuidedTour.route}
          stops={activeGuidedTour.stops}
          stepIndex={activeGuidedTour.stepIndex}
          positionClassName={
            activeTab === 'space3d'
              ? isFloatingBarVisible
                ? 'bottom-[144px] left-1/2 -translate-x-1/2'
                : 'bottom-[74px] left-1/2 -translate-x-1/2'
              : 'bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2'
          }
          onNextStep={handleGuidedNextStep}
          onOpenAudioGuide={(site) => startAudioGuideForSite(site.id)}
          onExitTour={() => setActiveGuidedTour(null)}
        />
      )}

      {/* Persistent Floating Audio Guide Bar across all pages & 3D Space */}
      <FloatingAudioBar
        onOpenStudio={(siteId) => openModalForSite(siteId)}
        offsetAboveRouteBar={
          (activeTab === 'map_routes' && mapSubView === 'routes' && Boolean(activeTour)) ||
          activeTab === 'space3d'
        }
        customBottomClass={
          activeGuidedTour && activeTab !== 'space3d'
            ? 'bottom-[128px] sm:bottom-[94px]'
            : undefined
        }
      />

      {/* Floating Experience Feedback, Tester Bug Report & Dấu Ấn Labs Bar (Bottom-Left) */}
      {!isAudioModalOpen &&
        (activeTab !== 'space3d' || isNonAdminBetaTester || effectiveQuickNotesWidget || isNonAdminTesterPro) && (
        <div
          className={`fixed left-3 md:left-5 z-40 ${
            isAiChatOpen ? 'hidden md:flex' : 'flex'
          } flex-wrap items-center gap-1.5 md:gap-2 max-w-[calc(100vw-1.5rem)] md:max-w-[calc(100vw-2.5rem)] ${
            activeTab === 'space3d'
              ? 'bottom-4 md:bottom-5'
              : activeGuidedTour
              ? isFloatingBarVisible
                ? 'bottom-[248px] md:bottom-[174px]'
                : 'bottom-[172px] md:bottom-[94px]'
              : isFloatingBarVisible
              ? activeTab === 'map_routes' && mapSubView === 'routes' && activeTour
                ? 'bottom-[198px] md:bottom-[154px]'
                : 'bottom-[154px] md:bottom-[104px]'
              : activeTab === 'map_routes' && mapSubView === 'routes' && activeTour
              ? 'bottom-[118px] md:bottom-[70px]'
              : 'bottom-16 md:bottom-5'
          }`}
        >
          {activeTab !== 'space3d' && (
            <button
              type="button"
              onClick={() =>
                requireAuth(
                  () => setIsFeedbackModalOpen(true),
                  lang === 'en'
                    ? 'Experience Feedback'
                    : lang === 'zh'
                    ? '体验评价'
                    : 'Đánh giá trải nghiệm'
                )
              }
              className="px-3 py-2 md:px-4 md:py-2.5 rounded-full bg-[#F4EFE4] hover:bg-[#EDE4D0] text-[#171817] border border-[#171817]/20 hover:border-[#A94F3D] shadow-[0_8px_24px_rgba(23,24,23,0.14)] transition-all flex items-center gap-1.5 md:gap-2 cursor-pointer"
            >
              <Star className="w-3.5 h-3.5 text-[#A94F3D] fill-[#C9A46A] shrink-0" />
              <span className="text-[11px] md:text-xs font-medium whitespace-nowrap">
                {lang === 'en'
                  ? 'Rate Experience'
                  : lang === 'zh'
                  ? '评价体验'
                  : 'Đánh giá trải nghiệm'}
              </span>
              {!user && <Lock className="w-3 h-3 text-[#47796D] shrink-0" />}
            </button>
          )}

          {isNonAdminTesterPro && (
            <button
              type="button"
              onClick={() => {
                setTesterBugSubmittedCode(null);
                setTesterBugDescription('');
                setIsTesterBugModalOpen(true);
              }}
              className="px-3 py-2 md:px-3.5 md:py-2.5 rounded-full bg-[#171817] hover:bg-[#47796D] text-[#D8C9A9] border border-[#C9A46A] shadow-[0_8px_24px_rgba(23,24,23,0.22)] transition-all flex items-center gap-1.5 md:gap-2 cursor-pointer"
            >
              <Bug className="w-3.5 h-3.5 text-[#C9A46A] shrink-0" />
              <span className="text-[11px] md:text-xs font-semibold whitespace-nowrap">
                {lang === 'en'
                  ? 'Bug Report / Tester Feedback'
                  : lang === 'zh'
                  ? '测试员反馈与报错'
                  : 'Báo cáo lỗi / Góp ý Tester'}
              </span>
            </button>
          )}

          {isNonAdminBetaTester && (
            <button
              type="button"
              onClick={openLabsModal}
              title={
                lang === 'en'
                  ? 'Toggle Dấu Ấn Labs experimental features'
                  : lang === 'zh'
                  ? '开启 / 关闭 Dấu Ấn Labs 实验功能'
                  : 'Bật / tắt các tính năng thử nghiệm Dấu Ấn Labs'
              }
              className="px-3 py-2 md:px-3.5 md:py-2.5 rounded-full bg-[#F4EFE4] hover:bg-[#EDE4D0] text-[#171817] border border-[#171817]/20 hover:border-[#47796D] shadow-[0_8px_24px_rgba(23,24,23,0.14)] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FlaskConical className="w-3.5 h-3.5 text-[#47796D] shrink-0" />
              <span className="text-[11px] md:text-xs font-medium whitespace-nowrap">Labs</span>
            </button>
          )}

          {effectiveQuickNotesWidget && (
            <button
              type="button"
              onClick={openQuickNote}
              className="px-3 py-2 md:px-3.5 md:py-2.5 rounded-full bg-[#F4EFE4] hover:bg-[#EDE4D0] text-[#171817] border border-[#171817]/20 hover:border-[#C9A46A] shadow-[0_8px_24px_rgba(23,24,23,0.14)] transition-all flex items-center gap-1.5 md:gap-2 cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#A94F3D] shrink-0" />
              <span className="text-[11px] md:text-xs font-medium whitespace-nowrap">
                {lang === 'en' ? 'Labs Notes' : lang === 'zh' ? 'Labs 笔记' : 'Ghi chú Labs'}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Floating Gemini AI Curator Trigger & Drawer (Available outside 3D viewer & Audio Guide) */}
      {!isAudioModalOpen && activeTab !== 'space3d' && (
        <>
          {!isAiChatOpen && (
            <button
              type="button"
              onClick={() =>
                requireAuth(
                  () => {
                    trackPlatformInteraction('tech_audio_ai', selectedSite?.id);
                    setIsAiChatOpen(true);
                  },
                  lang === 'en'
                    ? 'AI Curator'
                    : lang === 'zh'
                    ? 'AI 策展人'
                    : 'Trợ lý Giám tuyển AI'
                )
              }
              className={`fixed right-3 md:right-5 z-50 px-3.5 py-2 md:px-4 md:py-2.5 rounded-full bg-[#171817] hover:bg-[#A94F3D] text-[#D8C9A9] border border-[#C9A46A] shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeGuidedTour
                  ? 'bottom-[124px] md:bottom-[94px]'
                  : activeTab === 'map_routes' && mapSubView === 'routes' && activeTour
                  ? 'bottom-[70px]'
                  : 'bottom-4 md:bottom-5'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C9A46A]" />
              <span className="text-xs font-medium whitespace-nowrap">
                {lang === 'en'
                  ? 'AI Curator'
                  : lang === 'zh'
                  ? 'AI 策展人'
                  : 'Trợ lý Giám tuyển AI'}
              </span>
              {!user && <Lock className="w-3 h-3 text-[#C9A46A] shrink-0" />}
            </button>
          )}

          <GeminiHeritageChat
            isOpen={isAiChatOpen}
            onClose={() => setIsAiChatOpen(false)}
            currentSite={selectedSite}
            sites={sites}
            onSwitchSite={(targetSite) => {
              setSelectedSiteId(targetSite.id);
            }}
            hotspots={[]}
            onFlyToHotspot={() => {
              setIsAiChatOpen(false);
              setActiveTab('space3d');
            }}
            onSetRenderMode={(mode) => {
              setPending3DRenderMode(mode);
              setActiveTab('space3d');
            }}
            onSetExplodedFactor={(factor) => {
              setPending3DExploded(factor);
              if (factor > 0) {
                setActiveTab('space3d');
              }
            }}
            onTriggerAutoTour={() => {
              setIsAiChatOpen(false);
              setActiveTab('space3d');
            }}
            onNavigateToTickets={() => {
              setIsAiChatOpen(false);
              handleNavigateTab('edtech');
            }}
          />
        </>
      )}
      <InteractiveUserGuideModal
        isOpen={isGuideOpen}
        lang={lang}
        onClose={() => setIsGuideOpen(false)}
        onTry3D={() => {
          setIsGuideOpen(false);
          requireAuth(
            (authedUser) => handleOpen3D(selectedSite, authedUser),
            lang === 'en' ? '3D Space' : lang === 'zh' ? '3D 空间' : 'Không gian 3D'
          );
        }}
        onTryExplore={() => {
          setIsGuideOpen(false);
          handleNavigateTab('explore');
        }}
        onOpenMap={() => {
          setIsGuideOpen(false);
          requireAuth(
            () => {
              setMapSubView('gis');
              handleNavigateTab('map_routes');
            },
            lang === 'en' ? 'Map & Routes' : lang === 'zh' ? '地图与路线' : 'Bản đồ & Tuyến'
          );
        }}
        onOpenEdTech={() => {
          setIsGuideOpen(false);
          requireAuth(
            () => handleNavigateTab('edtech'),
            lang === 'en' ? 'Tickets & EdTech' : lang === 'zh' ? '门票与教材' : 'Vé & Học liệu'
          );
        }}
      />

      <CinemaDocumentaryModal
        isOpen={cinemaState.isOpen}
        onClose={() =>
          setCinemaState({ isOpen: false, siteId: null, activeVideoHeritageId: null })
        }
        contextSite={cinemaContextSite}
        sites={sites}
        localVideosMap={localVideosMap}
        onUploadLocalVideo={handleUploadLocalVideo}
        onClearLocalVideo={handleClearLocalVideo}
        onSwitchSite={(site) => {
          setSelectedSiteId(site.id);
          setCinemaState((prev) => ({
            ...prev,
            siteId: site.id,
            activeVideoHeritageId: resolveHeritageVideoId(site.id),
          }));
        }}
      />

      {/* Google & Facebook Auth Portal Modal */}
      <AuthModal />

      {/* Visitor Support & Helpdesk Center (accessible even before login) */}
      <SupportHelpdeskModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        sites={sites}
        defaultTab={supportDefaultTab}
        defaultSiteId={selectedSite?.id}
        onOpenInteractiveGuide={() => setIsGuideOpen(true)}
        onNavigateToTickets={() => {
          setIsSupportModalOpen(false);
          handleNavigateTab('edtech');
        }}
      />

      {/* Visitor Experience Feedback Modal */}
      {user && isFeedbackModalOpen && (
        <FeedbackModal
          isOpen={Boolean(user && isFeedbackModalOpen)}
          onClose={() => setIsFeedbackModalOpen(false)}
          sites={sites}
          defaultSiteId={selectedSite.id}
        />
      )}

      {/* Authenticated Visitor's Personal Tickets & Exploration Journey */}
      {user && isMyJourneyOpen && (
        <MyTicketsAndJourneyModal
          isOpen={Boolean(user && isMyJourneyOpen)}
          sites={sites}
          onClose={() => setIsMyJourneyOpen(false)}
          onOpen3D={(site) => handleOpen3D(site)}
          onOpenMapRoutes={() => {
            setMapSubView('routes');
            handleNavigateTab('map_routes');
          }}
          onGoToTickets={() => handleNavigateTab('edtech')}
        />
      )}

      {/* First-Login Guided Tour Welcome Concierge Modal */}
      {user && (
        <GuidedTourWelcomeModal
          isOpen={isGuidedWelcomeOpen}
          visitorName={user.displayName}
          tours={resolvedGuidedTours}
          hasMasterpiece={Boolean(masterpieceSite)}
          onClose={() => setIsGuidedWelcomeOpen(false)}
          onSelectTour={(tour) => startGuidedTourSession(tour)}
          onStartMasterpiece={() => startMasterpieceSession()}
        />
      )}

      {/* Guided Tour Completion Celebration & Certificate Prompt Modal */}
      {user && (
        <GuidedTourCompletionModal
          completedRoute={completedGuidedTour}
          onClose={() => setCompletedGuidedTour(null)}
          onGoToTicketsAndCertificate={() => {
            if (!completedGuidedTour) return;
            setPreselectedGuidedRoute({
              mappedTourId: completedGuidedTour.route.mappedTourId,
              title: completedGuidedTour.route.title,
              token: Date.now(),
            });
            setCompletedGuidedTour(null);
            handleNavigateTab('edtech');
          }}
          onOpenFeedback={() => {
            setCompletedGuidedTour(null);
            setIsFeedbackModalOpen(true);
          }}
        />
      )}

      {/* Admin Studio — Strictly accessible only to verified Admin accounts (never Tester Pro) */}
      {isStrictAdmin && isAdminStudioOpen && (
        <AdminWorkflowModal
          sites={allSites}
          onClose={() => setIsAdminStudioOpen(false)}
          onUpdateSiteStatus={onUpdateSiteStatus}
          onRefreshCms={onRefreshCms}
          customPhotosMap={customPhotosMap}
          localVideosMap={localVideosMap}
          onOpenPhotoManager={(site) => setPhotoManagerSiteId(site.id)}
          onOpenAudioStudio={(site) => {
            setIsAdminStudioOpen(false);
            openModalForSite(site.id);
          }}
          onOpenVideoModal={(site) => handleOpenCinemaModal(site)}
        />
      )}
      {/* Dấu Ấn Labs Modals (Strictly gated for Beta Tester & Admin accounts) */}
      <DauAnLabsModal />
      <LabsQuickNoteModal sites={allSites} currentSite={selectedSite} />

      {/* Tester Pro Bug Report Modal (Auto-captures Tab + Site + Language, tagged Báo cáo Tester) */}
      {isNonAdminTesterPro && isTesterBugModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tester Pro Bug Report"
          onClick={() => setIsTesterBugModalOpen(false)}
          className="fixed inset-0 z-[1300] bg-[#171817]/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[94vw] sm:w-full max-w-lg max-h-[88dvh] overflow-y-auto modal-scrollbar rounded-2xl bg-[#D8C9A9] border border-[#171817]/25 shadow-2xl text-[#171817]"
          >
            <div className="px-5 py-4 bg-[#171817] text-[#D8C9A9] border-b border-[#C9A46A]/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Bug className="w-4 h-4 text-[#C9A46A] shrink-0" />
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C9A46A] block">
                    {lang === 'en' ? 'Tester Pro · QA Intake' : lang === 'zh' ? '专业测试 · 问题上报' : 'Người thử nghiệm Pro · QA'}
                  </span>
                  <h3 className="font-serif text-base font-semibold text-[#D8C9A9]">
                    {lang === 'en'
                      ? 'Bug Report / Tester Feedback'
                      : lang === 'zh'
                      ? '提交测试错误报告或建议'
                      : 'Báo cáo lỗi / Góp ý Tester'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTesterBugModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#D8C9A9]/10 hover:bg-[#D8C9A9]/20 text-[#D8C9A9] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {testerBugSubmittedCode ? (
              <div className="p-6 space-y-4 text-center">
                <CheckCircle2 className="w-10 h-10 text-[#47796D] mx-auto" />
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[#171817]">
                    {lang === 'en'
                      ? `Report ${testerBugSubmittedCode} sent to Admin Support Inbox`
                      : lang === 'zh'
                      ? `测试报告 ${testerBugSubmittedCode} 已发送至管理员收件箱`
                      : `Đã gửi phiếu ${testerBugSubmittedCode} về Hộp thư Hỗ trợ Admin`}
                  </div>
                  <p className="text-xs text-[#171817]/75">
                    {lang === 'en'
                      ? 'Tagged "Tester Report" with your active tab, monument, and language context.'
                      : lang === 'zh'
                      ? '已附带当前页面标签、遗迹名称与语言上下文并标记为“测试员报告”。'
                      : 'Phiếu đã được gắn nhãn "Báo cáo Tester" cùng ngữ cảnh Tab, Di tích và Ngôn ngữ hiện tại.'}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTesterBugModalOpen(false);
                      setSupportDefaultTab('tickets');
                      setIsSupportModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-full bg-[#47796D] hover:bg-[#3A655A] text-[#D8C9A9] text-xs font-semibold cursor-pointer"
                  >
                    {lang === 'en' ? 'View in Support Inbox' : lang === 'zh' ? '查看支持工单' : 'Xem trong Hộp thư Hỗ trợ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTesterBugModalOpen(false)}
                    className="px-4 py-2 rounded-full bg-[#171817] text-[#D8C9A9] text-xs font-semibold cursor-pointer"
                  >
                    {lang === 'en' ? 'Close' : lang === 'zh' ? '关闭' : 'Đóng'}
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const cleanText = testerBugDescription.trim();
                  if (!cleanText || isSubmittingTesterBug) return;
                  setIsSubmittingTesterBug(true);
                  try {
                    const created = createSupportTicket({
                      senderUserId: user?.userId,
                      ownerEmail: user?.email,
                      senderName: user?.displayName || 'Người thử nghiệm Pro',
                      senderEmail: user?.email || 'tester@dau-an-viet.local',
                      category: 'tester_feedback',
                      relatedSiteId: selectedSite?.id,
                      relatedSiteName: selectedSite?.officialName,
                      description: cleanText,
                      supportTier: 'tester_report',
                      retentionDays: 90,
                      testerContext: {
                        tab: activeTab,
                        siteId: selectedSite?.id,
                        siteName: selectedSite?.officialName,
                        lang,
                      },
                    });
                    setTesterBugSubmittedCode(created.ticketCode);
                    void processSupportTicketAiReply(created.id, sites, cleanText, false);
                  } finally {
                    setIsSubmittingTesterBug(false);
                  }
                }}
                className="p-5 space-y-4"
              >
                <div className="p-3 rounded-xl bg-[#EDE4D0] border border-[#171817]/15 space-y-1.5 text-xs">
                  <div className="font-semibold text-[#171817]">
                    {lang === 'en'
                      ? 'Auto-captured Session Context'
                      : lang === 'zh'
                      ? '自动捕获的当前会话上下文'
                      : 'Ngữ cảnh phiên được tự động ghi nhận'}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-[#171817] text-[#D8C9A9]">
                      Tab: {activeTab}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#47796D] text-[#D8C9A9]">
                      Di tích: {selectedSite?.officialName || '—'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#526D8B] text-[#D8C9A9]">
                      Ngôn ngữ: {lang.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#171817]">
                    {lang === 'en'
                      ? 'Describe the issue, UI flaw, 3D model behavior, or suggestion *'
                      : lang === 'zh'
                      ? '请描述发现的问题、3D 模型表现或改进建议 *'
                      : 'Mô tả lỗi phát hiện, giao diện, mô hình 3D hoặc góp ý *'}
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={testerBugDescription}
                    onChange={(e) => setTesterBugDescription(e.target.value)}
                    placeholder={
                      lang === 'en'
                        ? 'Example: In 3D Space for Bạch Dinh, X-Ray clipping needs adjustment...'
                        : lang === 'zh'
                        ? '示例：在 3D 空间查看白宫时，图层切换响应略有延迟...'
                        : 'Ví dụ: Khi mở X-Ray ở Không gian 3D tại Dinh Độc Lập, góc xoay camera...'
                    }
                    className="w-full p-3 rounded-xl bg-[#F4EFE4] border border-[#171817]/20 focus:border-[#47796D] focus:outline-none text-xs text-[#171817] placeholder:text-[#171817]/45"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTesterBugModalOpen(false)}
                    className="px-4 py-2 rounded-full border border-[#171817]/20 text-xs font-medium text-[#171817] hover:bg-[#171817]/10 cursor-pointer"
                  >
                    {lang === 'en' ? 'Cancel' : lang === 'zh' ? '取消' : 'Hủy bỏ'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTesterBug || !testerBugDescription.trim()}
                    className="px-5 py-2 rounded-full bg-[#A94F3D] hover:bg-[#8E3F30] disabled:opacity-50 text-[#D8C9A9] text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {isSubmittingTesterBug
                      ? lang === 'en'
                        ? 'Sending...'
                        : lang === 'zh'
                        ? '发送中...'
                        : 'Đang gửi...'
                      : lang === 'en'
                      ? 'Submit Tester Report'
                      : lang === 'zh'
                      ? '发送测试报告'
                      : 'Gửi Báo cáo Tester'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmergencyLockdownGate() {
  const { user, isAdmin, logout } = useAuth();
  const [emergencyState, setEmergencyState] = useState<EmergencyLockdownState>(() =>
    loadEmergencyLockdownState()
  );

  useEffect(() => {
    const syncLockdown = () => {
      setEmergencyState(loadEmergencyLockdownState());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === EMERGENCY_LOCKDOWN_STORAGE_KEY) {
        syncLockdown();
      }
    };
    window.addEventListener(EMERGENCY_LOCKDOWN_EVENT, syncLockdown);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EMERGENCY_LOCKDOWN_EVENT, syncLockdown);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const isVisitorLockedOut = emergencyState.isLocked && !isAdmin;

  useEffect(() => {
    if (!isVisitorLockedOut) return;
    const id = window.setInterval(() => {
      void syncStateFromServer();
    }, 15000);
    return () => window.clearInterval(id);
  }, [isVisitorLockedOut]);

  // Auto-logout any non-admin visitor sessions immediately when Emergency Lockdown activates
  useEffect(() => {
    if (emergencyState.isLocked && user && user.role !== 'admin') {
      logout();
    }
  }, [emergencyState.isLocked, user, logout]);

  // Completely unmount HeritageAppContent when locked for non-admins to halt 100% of WebGL 3D loops & API flows
  if (isVisitorLockedOut) {
    return <EmergencyLockdownOverlay lockdownState={emergencyState} />;
  }

  return <HeritageAppContent emergencyState={emergencyState} />;
}

export default function App() {
  return (
    <AppleErrorBoundary variant="app">
      <AuthProvider>
        <LabsProvider>
          <EmergencyLockdownGate />
        </LabsProvider>
      </AuthProvider>
    </AppleErrorBoundary>
  );
}

