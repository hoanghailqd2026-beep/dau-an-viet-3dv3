import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { HeritageSite } from '../../types/heritage';
import { TOUR_ROUTES } from '../../data/tours';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../contexts/AuthContext';
import { useHeritagePassportStamps } from '../../utils/heritagePassport';
import { HeritageTypographicPlate } from '../common/HeritageTypographicPlate';
import { HeritageSmoothImage } from '../common/HeritageSmoothImage';
import { useMuseumTilt3D } from '../../utils/useMuseumTilt3D';
import {
  PASSES_UPDATED_EVENT,
  PublishedSiteQuizSet,
  QUIZZES_UPDATED_EVENT,
  IssuedPassRecord,
  activateUserSchoolPackage,
  checkAndRecordSubmissionRate,
  getUserEdTechState,
  listIssuedPasses,
  loadPublishedQuizzes,
  maskEmailForDisplay,
  recordIssuedPass,
  saveUserEdTechState,
  setUserSubscriptionTier,
} from '../../utils/adminPlatformStore';
import {
  Ticket,
  GraduationCap,
  Check,
  QrCode,
  Download,
  Printer,
  BookOpen,
  ShoppingBag,
  Award,
  X,
  ArrowUpRight,
  RotateCcw,
  Sparkles,
  Building2,
  Compass,
  ShieldCheck,
  UserCheck,
  LogIn,
  Lock,
  CheckCircle2,
  Star,
  MessageSquareHeart,
} from 'lucide-react';

interface CommercializationEdTechHubProps {
  sites: HeritageSite[];
  hiddenSiteIds?: string[];
  preselectedGuidedRoute?: {
    mappedTourId: string;
    title: string;
    token: number;
  } | null;
  onStart3DVipExperience: (siteId?: string, routeId?: string) => void;
  onNavigateToMap: () => void;
  onOpenAudioGuide: (site: HeritageSite) => void;
  onOpenMyJourney?: () => void;
  onOpenFeedback?: () => void;
}

interface QuizQuestion {
  id: number;
  monumentCode: string;
  monumentCodeEn?: string;
  monumentCodeZh?: string;
  question: string;
  questionEn?: string;
  questionZh?: string;
  options: string[];
  optionsEn?: string[];
  optionsZh?: string[];
  correctIndex: number;
  explanation: string;
  explanationEn?: string;
  explanationZh?: string;
}

const EDTECH_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    monumentCode: 'HCM-DT-009 · Địa đạo Củ Chi',
    monumentCodeEn: 'HCM-DT-009 · Cu Chi Tunnels',
    monumentCodeZh: 'HCM-DT-009 · 古芝地道',
    question:
      'Vì sao hệ thống Địa đạo Củ Chi sâu tới 3 tầng ngầm (từ -3m đến -10m) có thể chịu được sức ép bom đạn hạng nặng mà không cần gia cố bê tông cốt thép?',
    questionEn:
      'Why could the 3-level subterranean Cu Chi Tunnels (from -3m to -10m) withstand heavy aerial bombardment without reinforced concrete lining?',
    questionZh:
      '为什么深达地下三层（-3米至-10米）的古芝地道无需钢筋混凝土加固即可抵御重型炸弹冲击？',
    options: [
      'A. Nhờ đào trong tầng cát biển mềm có độ đàn hồi cao',
      'B. Nhờ cấu tạo địa chất đất sét pha đá ong (laterite clay) trên nền phù sa cổ bền chắc như bê tông tự nhiên',
      'C. Nhờ toàn bộ vách hầm được ốp đá hoa cương xanh Biên Hòa',
      'D. Nhờ đào dưới mực nước ngầm của sông Sài Gòn',
    ],
    optionsEn: [
      'A. Dug within soft elastic marine sand strata',
      'B. Carved into ancient alluvial laterite clay that hardens like natural concrete upon air oxidation',
      'C. Lined entirely with Bien Hoa blue granite slabs',
      'D. Excavated beneath the water table of the Saigon River',
    ],
    optionsZh: [
      'A. 挖掘于富有弹性的松软海沙层中',
      'B. 依托古冲积台地富含铁铝的红土粘土层（Laterite Clay），遇空气氧化后坚硬如天然混凝土',
      'C. 整个隧道内壁均铺设边和青花岗岩',
      'D. 挖掘于西贡河地下水位以下',
    ],
    correctIndex: 1,
    explanation:
      'Địa đạo Củ Chi, Tam Giác Sắt (Bình Dương) và Long Phước (Bà Rịa - Vũng Tàu) đều nằm trên tầng địa chất đất sét pha đá ong (laterite clay) thuộc thềm phù sa cổ Đông Nam Bộ: khi tiếp xúc không khí oxy hóa sẽ kết tảng cứng chắc như bê tông tự nhiên.',
    explanationEn:
      'Cu Chi Tunnels, Iron Triangle (Binh Duong), and Long Phuoc (Ba Ria - Vung Tau) were all excavated in ancient alluvial laterite clay: upon exposure to oxygen, iron-aluminum oxides harden into a self-supporting natural concrete arch.',
    explanationZh:
      '古芝地道、平阳铁三角地道与巴地头顿龙福地道均位于东南部古冲积红土粘土层中，接触空气氧化后结块硬化，坚固程度堪比天然混凝土。',
  },
  {
    id: 2,
    monumentCode: 'HCM-DT-001 · Dinh Độc Lập',
    monumentCodeEn: 'HCM-DT-001 · Independence Palace',
    monumentCodeZh: 'HCM-DT-001 · 独立宫（统一宫）',
    question:
      'Mặt tiền Dinh Độc Lập do Kiến trúc sư Ngô Viết Thụ thiết kế (khởi công 1962) sử dụng hệ lam che nắng mang hình tượng văn hóa phương Đông nào?',
    questionEn:
      'What Eastern cultural motif inspired the brise-soleil sun-shading facade of Independence Palace designed by Architect Ngo Viet Thu (begun 1962)?',
    questionZh:
      '由建筑师吴日树设计的独立宫（1962年动工）正立面遮阳格栅融入了哪种东方文化意象？',
    options: [
      'A. Bức rèm trúc cách điệu từ đốt trúc phương Đông giúp thông gió tự nhiên và giảm bức xạ nhiệt đới',
      'B. Hệ cột thức Corinth cổ điển Hy Lạp - La Mã',
      'C. Hệ vòm nhọn Gothic kiểu Pháp thế kỷ XIX',
      'D. Mái ngói ống lưu ly xanh kiểu cung đình Huế',
    ],
    optionsEn: [
      'A. Stylized Eastern bamboo-segment curtain screens enabling natural cross-ventilation and solar shading',
      'B. Greco-Roman Corinthian colonnades',
      'C. 19th-century French Gothic pointed arches',
      'D. Imperial Hue glazed tubular roof tiles',
    ],
    optionsZh: [
      'A. 化用东方湘妃竹节意象的石质竹帘格栅，兼具自然通风与热带遮阳功能',
      'B. 古希腊罗马科林斯柱式',
      'C. 19世纪法国哥特式尖拱',
      'D. 顺化皇城青琉璃筒瓦屋顶',
    ],
    correctIndex: 0,
    explanation:
      'KTS Ngô Viết Thụ (Khôi nguyên La Mã 1955) đã kết hợp hoàn hảo chủ nghĩa Hiện đại Nhiệt đới (Tropical Modernism) với triết lý phương Đông qua bức rèm hoa đá hình đốt trúc bao quanh lầu 2 và mặt bằng tổng thể chữ Cát (吉).',
    explanationEn:
      'Architect Ngo Viet Thu (1955 Prix de Rome laureate) harmonized Tropical Modernism with Eastern philosophy through the bamboo-segment stone brise-soleil around the second floor and the auspicious "Cát" (吉) floor plan.',
    explanationZh:
      '罗马大奖得主吴日树建筑师将热带现代主义与东方哲学完美融合，二层环绕竹节造型花石格栅，总体平面呈吉祥的汉字“吉”字形。',
  },
  {
    id: 3,
    monumentCode: 'HCM-DT-006 · Bảo tàng Lịch sử TP.HCM',
    monumentCodeEn: 'HCM-DT-006 · HCMC Museum of History',
    monumentCodeZh: 'HCM-DT-006 · 胡志明市历史博物馆',
    question:
      'Công trình Bảo tàng Lịch sử Thành phố Hồ Chí Minh (khánh thành năm 1929) do KTS Auguste Delaval thiết kế là đại diện tiêu biểu của phong cách kiến trúc nào?',
    questionEn:
      'The Ho Chi Minh City Museum of History (inaugurated in 1929, designed by Auguste Delaval) is a landmark example of which architectural style?',
    questionZh:
      '由建筑师奥古斯特·德拉瓦尔设计、1929年落成的胡志明市历史博物馆是哪种建筑风格的代表作？',
    options: [
      'A. Kiến trúc Phục hưng Ý (Italian Renaissance)',
      'B. Kiến trúc Đông Dương (Indochine Architecture) kết hợp khối tháp bát giác chồng diêm Á Đông và bố cục đối xứng Pháp',
      'C. Kiến trúc Brutalism bê tông trần thế kỷ XX',
      'D. Kiến trúc Baroque Tây Ban Nha',
    ],
    optionsEn: [
      'A. Italian Renaissance Architecture',
      'B. Indochine Architecture blending an octagonal double-tiered East Asian rotunda tower with French symmetrical wings',
      'C. 20th-century Brutalist exposed concrete',
      'D. Spanish Baroque Architecture',
    ],
    optionsZh: [
      'A. 意大利文艺复兴建筑风格',
      'B. 印支建筑风格（Indochine），融合东方重檐八角中央塔楼与法式对称采光展翼',
      'C. 20世纪粗野主义清水混凝土建筑',
      'D. 西班牙巴洛克风格',
    ],
    correctIndex: 1,
    explanation:
      'Bảo tàng Lịch sử TP.HCM (Bảo tàng Blanchard de la Brosse cũ, 1929) là kiệt tác mở đầu trào lưu Kiến trúc Đông Dương tại Sài Gòn với tháp bát giác mái ngói chồng diêm, hệ con sơn đấu củng kết hợp mặt bằng thông gió hiện đại của Pháp.',
    explanationEn:
      'The HCMC Museum of History (formerly Musée Blanchard de la Brosse, 1929) pioneered Indochine Architecture in Saigon with its octagonal double-eave central tower, bracket consoles, and naturally ventilated French exhibition galleries.',
    explanationZh:
      '胡志明市历史博物馆（1929年落成）是西贡印支建筑流派的开山之作，中央八角重檐塔楼、传统斗拱构件与法式现代通风展厅相得益彰。',
  },
  {
    id: 4,
    monumentCode: 'BD-DT-001 · Nhà cổ Trần Công Vàng',
    monumentCodeEn: 'BD-DT-001 · Tran Cong Vang Ancient House',
    monumentCodeZh: 'BD-DT-001 · 陈公黄金木古宅',
    question:
      'Nhà cổ Trần Công Vàng (TP. Thủ Dầu Một, Bình Dương — xây dựng 1889–1892) được kết cấu theo kiểu mặt bằng truyền thống nào của vùng đất Nam Bộ?',
    questionEn:
      'The Tran Cong Vang Ancient House (Thu Dau Mot, Binh Duong — built 1889–1892) is structured around which traditional Southern Vietnamese layout?',
    questionZh:
      '平阳省土龙木市陈公黄金木古宅（建于1889–1892年）采用了南部哪种传统建筑平面与木构形制？',
    options: [
      'A. Kiểu nhà sàn gỗ 2 tầng vùng cao nguyên',
      'B. Kiểu nhà chữ Đinh (丁) 3 gian 2 chái với 64 cột gỗ quý liên kết mộng chốt và mái ngói âm dương',
      'C. Kiểu biệt thự Tân cổ điển Pháp 3 tầng mái dốc',
      'D. Kiểu tháp gạch Chăm Pa nung đỏ',
    ],
    optionsEn: [
      'A. Two-story highland wooden stilt house',
      'B. Traditional "Đinh" (丁) layout with 3 bays, 2 wings, 64 ironwood columns joined by mortise-and-tenon, and yin-yang roof tiles',
      'C. Three-story French Neoclassical pitched-roof villa',
      'D. Fired red-brick Cham tower layout',
    ],
    optionsZh: [
      'A. 高原双层木结构干栏式建筑',
      'B. 传统“丁”字形三间两厢布局，由64根珍贵硬木立柱榫卯穿斗连接，覆阴阳筒板瓦',
      'C. 三层法式新古典主义坡屋顶别墅',
      'D. 占婆红砖佛塔形制',
    ],
    correctIndex: 1,
    explanation:
      'Nhà cổ Trần Công Vàng là di tích kiến trúc nghệ thuật cấp Quốc gia tại Bình Dương, tiêu biểu cho nhà cổ chữ Đinh (丁) Nam Bộ với hệ khung xuyên trính 64 cột gỗ căm xe, gỗ đỏ và chạm khắc tứ linh tinh xảo.',
    explanationEn:
      'Tran Cong Vang Ancient House is a National Architectural & Artistic Monument in Binh Duong, exemplifying Southern "Đinh" (丁) timber residences with 64 ironwood columns and intricate Four Sacred Animals woodcarvings.',
    explanationZh:
      '陈公黄金木古宅是平阳省国家级建筑艺术遗迹，代表了南部“丁”字形传统穿斗式木构古宅的巅峰工艺，拥有64根铁力木立柱与精美贴金木雕。',
  },
  {
    id: 5,
    monumentCode: 'BRVT-DT-001 · Bạch Dinh (Villa Blanche)',
    monumentCodeEn: 'BRVT-DT-001 · White Palace (Villa Blanche)',
    monumentCodeZh: 'BRVT-DT-001 · 白宫（头顿总督行宫）',
    question:
      'Bạch Dinh (Villa Blanche — Vũng Tàu, xây dựng 1898–1902) tọa lạc trên sườn Núi Lớn có đặc điểm kiến trúc và giá trị khảo cổ đặc biệt nào?',
    questionEn:
      'What are the distinctive architectural and archaeological features of the White Palace (Villa Blanche — Vung Tau, built 1898–1902) on Big Mountain?',
    questionZh:
      '坐落于头顿大山山腰的白宫（Villa Blanche，建于1898–1902年）具有哪些独特的建筑特征与考古价值？',
    options: [
      'A. Dinh thự Pháp Tân cổ điển 3 tầng gắn phù điêu gốm men cổ điển Hy Lạp, đồng thời lưu giữ bộ sưu tập gốm sứ cổ Hòn Cau thế kỷ XVII',
      'B. Pháo đài ngầm hoàn toàn dưới đáy biển Vũng Tàu',
      'C. Ngôi chùa gỗ 7 tầng tháp cổ nhất miền Đông Nam Bộ',
      'D. Nhà ga đường sắt đầu tiên của vùng Đông Nam Bộ',
    ],
    optionsEn: [
      'A. 3-story French Neoclassical villa adorned with Greco-Roman ceramic friezes, housing the 17th-century Hon Cau shipwreck porcelain collection',
      'B. Subsea fortress completely beneath Vung Tau bay',
      'C. Oldest 7-story wooden pagoda in Southeast Vietnam',
      'D. First railway terminus in Southeast Vietnam',
    ],
    optionsZh: [
      'A. 三层法式新古典主义行宫，外墙镶嵌古希腊彩色釉陶浮雕，并珍藏17世纪槟岛古沉船出水的数千件青花瓷器',
      'B. 完全位于头顿海底的地下要塞',
      'C. 东南部最古老的七层木塔寺院',
      'D. 东南部第一座火车站',
    ],
    correctIndex: 0,
    explanation:
      'Bạch Dinh cao 19m trên sườn Núi Lớn ở độ cao +27m so với mực nước biển, nổi bật với hành lang vòm cuốn Tân cổ điển Pháp, phù điêu cá chép hóa rồng và trưng bày hàng ngàn cổ vật gốm sứ vớt từ tàu đắm cổ Hòn Cau - Côn Đảo.',
    explanationEn:
      'Standing 19m tall at +27.5m above sea level on Big Mountain, the White Palace features French Neoclassical arcades, mosaic busts, and thousands of 17th-century Kangxi-era porcelain artifacts salvaged from the Hon Cau shipwreck.',
    explanationZh:
      '白宫高19米，雄踞海拔27.5米的大山悬崖之上，以法式新古典主义拱廊、鲤鱼跃龙门瓷雕及槟岛古沉船打捞的数千件清代外销瓷珍品闻名。',
  },
];

export const CommercializationEdTechHub: React.FC<CommercializationEdTechHubProps> = ({
  sites,
  hiddenSiteIds = [],
  preselectedGuidedRoute = null,
  onStart3DVipExperience,
  onNavigateToMap,
  onOpenMyJourney,
  onOpenFeedback,
}) => {
  const { lang, getLocalizedSite, getLocalizedTour } = useI18n();
  const { user, isAdmin, isTesterPro, userTier, entitlements, refreshEntitlements, openAuthModal } = useAuth();
  const canPreviewHidden = isAdmin || isTesterPro;
  const canAccessSection03 = Boolean(
    user && (isAdmin || isTesterPro || entitlements.hasSchoolPackage)
  );
  const tiltHandlers = useMuseumTilt3D(4);
  const passportScope = user?.email || user?.userId;
  const passportStamps = useHeritagePassportStamps(passportScope);
  const unlockedStampCount = Object.keys(passportStamps).length;

  const initialPersonal = getUserEdTechState(user?.userId, user?.email);

  // State cho Gói B2C (19.000đ / Tuyến hoặc 49.000đ / VIP Toàn Vùng)
  const [b2cPlanType, setB2cPlanType] = useState<'route_19k' | 'vip_49k'>(
    initialPersonal.b2cPlanType
  );
  const [selectedRouteId, setSelectedRouteId] = useState<string>(TOUR_ROUTES[0]?.id || 'TOUR-01');

  // State cho Modal Thanh toán VietQR / MoMo & Vé điện tử VIP
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'vietqr' | 'momo'>('vietqr');
  const [ticketIssued, setTicketIssued] = useState<boolean>(initialPersonal.ticketIssued);
  const [ticketPassId, setTicketPassId] = useState<string | undefined>(
    initialPersonal.ticketPassId
  );
  const [certPassId, setCertPassId] = useState<string | undefined>(initialPersonal.certPassId);
  const [passesSnapshot, setPassesSnapshot] = useState<IssuedPassRecord[]>(() =>
    listIssuedPasses()
  );
  const [buyerName, setBuyerName] = useState<string>(() => user?.displayName || '');
  const [checkoutQrDataUrl, setCheckoutQrDataUrl] = useState<string>('');
  const [issuedTicketQrDataUrl, setIssuedTicketQrDataUrl] = useState<string>('');
  const [ticketSpamError, setTicketSpamError] = useState<string | null>(null);

  useEffect(() => {
    const onPassesUpdated = () => setPassesSnapshot(listIssuedPasses());
    window.addEventListener(PASSES_UPDATED_EVENT, onPassesUpdated);
    return () => window.removeEventListener(PASSES_UPDATED_EVENT, onPassesUpdated);
  }, []);

  const [guidedCertCode, setGuidedCertCode] = useState<string | null>(null);

  useEffect(() => {
    if (!preselectedGuidedRoute) return;
    setB2cPlanType('route_19k');
    setSelectedRouteId(preselectedGuidedRoute.mappedTourId);
    setGuidedCertCode(null);
  }, [preselectedGuidedRoute?.token, preselectedGuidedRoute?.mappedTourId]);

  // State cho Modal Đăng ký B2B Trường học
  const [isB2BModalOpen, setIsB2BModalOpen] = useState<boolean>(false);
  const [schoolName, setSchoolName] = useState<string>('Trường THPT Chuyên Lê Quý Đôn');
  const [schoolProvince, setSchoolProvince] = useState<string>('TP. Hồ Chí Minh / Bà Rịa - Vũng Tàu / Bình Dương');
  const [teacherContact, setTeacherContact] = useState<string>('to-lich-su@edu.vn');
  const [b2bSubmitted, setB2bSubmitted] = useState<boolean>(false);

  // State cho Cửa hàng Ấn phẩm O2O Souvenirs
  const [selectedSouvenirId, setSelectedSouvenirId] = useState<string | null>(null);
  const [souvenirOrderedId, setSouvenirOrderedId] = useState<string | null>(null);

  // State cho Bài kiểm tra tương tác 5 câu hỏi (EdTech Quiz)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>(
    initialPersonal.selectedAnswers
  );
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(initialPersonal.quizSubmitted);
  const [worksheetDownloadedToast, setWorksheetDownloadedToast] = useState<string | null>(null);
  const [failedPhotoMap, setFailedPhotoMap] = useState<Record<string, boolean>>({});

  // Ngân hàng Thử thách Kiến thức Di sản do Admin AI Curator xuất bản
  const [publishedQuizMap, setPublishedQuizMap] = useState<Record<string, PublishedSiteQuizSet>>(
    () => loadPublishedQuizzes()
  );
  const [activeTopicSiteId, setActiveTopicSiteId] = useState<string>('');
  const [topicAnswers, setTopicAnswers] = useState<Record<string, Record<string, number>>>(
    () => initialPersonal.topicAnswers || {}
  );
  const [topicSubmittedMap, setTopicSubmittedMap] = useState<Record<string, boolean>>(
    () => initialPersonal.topicSubmittedMap || {}
  );
  const [topicCertIds, setTopicCertIds] = useState<Record<string, string>>(
    () => initialPersonal.topicCertIds || {}
  );

  useEffect(() => {
    if (!user) {
      setIsPaymentModalOpen(false);
      setIsB2BModalOpen(false);
    }
    const saved = getUserEdTechState(user?.userId, user?.email);
    setB2cPlanType(saved.b2cPlanType);
    setSelectedAnswers(saved.selectedAnswers);
    setQuizSubmitted(saved.quizSubmitted);
    setTicketIssued(saved.ticketIssued);
    setTicketPassId(saved.ticketPassId);
    setCertPassId(saved.certPassId);
    setTopicAnswers(saved.topicAnswers || {});
    setTopicSubmittedMap(saved.topicSubmittedMap || {});
    setTopicCertIds(saved.topicCertIds || {});
    setGuidedCertCode(null);
    setTicketSpamError(null);
    setBuyerName(user?.displayName || '');
  }, [user?.userId, user?.email, user?.displayName]);

  useEffect(() => {
    const onQuizzesUpdated = () => setPublishedQuizMap(loadPublishedQuizzes());
    window.addEventListener(QUIZZES_UPDATED_EVENT, onQuizzesUpdated);
    return () => window.removeEventListener(QUIZZES_UPDATED_EVENT, onQuizzesUpdated);
  }, []);

  const visiblePublishedTopics = Object.values(publishedQuizMap).filter(
    (set) =>
      set.questions.length > 0 &&
      sites.some((s) => s.id === set.siteId) &&
      (canPreviewHidden || (!set.isHidden && !hiddenSiteIds.includes(set.siteId)))
  );
  const selectedTopic =
    visiblePublishedTopics.find((t) => t.siteId === activeTopicSiteId) ||
    visiblePublishedTopics[0] ||
    null;

  const quizScore = EDTECH_QUIZ_QUESTIONS.reduce((acc, q) => {
    if (selectedAnswers[q.id] === q.correctIndex) return acc + 20;
    return acc;
  }, 0);

  useEffect(() => {
    saveUserEdTechState(
      user?.userId,
      {
        selectedAnswers,
        quizSubmitted,
        ticketIssued,
        ticketPassId,
        b2cPlanType,
        certPassId,
        topicAnswers,
        topicSubmittedMap,
        topicCertIds,
      },
      user?.email
    );
  }, [
    user?.userId,
    user?.email,
    selectedAnswers,
    quizSubmitted,
    ticketIssued,
    ticketPassId,
    b2cPlanType,
    certPassId,
    topicAnswers,
    topicSubmittedMap,
    topicCertIds,
  ]);

  const currentTicketRecord = passesSnapshot.find((p) => p.id === ticketPassId);
  const currentCertRecord = passesSnapshot.find((p) => p.id === certPassId);
  const selectedRouteObj =
    TOUR_ROUTES.find((r) => r.id === selectedRouteId) || TOUR_ROUTES[0];
  const authenticatedAccountLabel = user
    ? user.authMethod === 'judge_quick_access'
      ? 'Ban Giám Khảo (Demo)'
      : user.email
      ? `${user.provider === 'google' ? 'Google' : 'Facebook'} · ${user.email}`
      : `${user.provider === 'google' ? 'Google' : 'Facebook'} · ${user.displayName}`
    : '';

  useEffect(() => {
    if (!isPaymentModalOpen || !user) return;
    let cancelled = false;
    const buildQr = async () => {
      try {
        if (!ticketIssued) {
          const payPayload = `${paymentMethod.toUpperCase()}|DAU-AN-VIET-3D|${
            b2cPlanType === 'vip_49k' ? '49000' : '19000'
          }|${user.userId}|${selectedRouteId}`;
          const url = await QRCode.toDataURL(payPayload, {
            width: 180,
            margin: 1,
            color: { dark: '#171817', light: '#F4EFE4' },
          });
          if (!cancelled) setCheckoutQrDataUrl(url);
        } else if (currentTicketRecord) {
          const ticketPayload = JSON.stringify({
            app: 'DAU-AN-VIET-3D',
            code: currentTicketRecord.code,
            holder: currentTicketRecord.ownerName,
            contact: currentTicketRecord.ownerContactMasked,
            route: currentTicketRecord.routeTitle || currentTicketRecord.label,
            issuedAt: currentTicketRecord.issuedAt,
          });
          const url = await QRCode.toDataURL(ticketPayload, {
            width: 200,
            margin: 1,
            color: { dark: '#171817', light: '#F4EFE4' },
          });
          if (!cancelled) setIssuedTicketQrDataUrl(url);
        }
      } catch {
        // ignore QR error
      }
    };
    void buildQr();
    return () => {
      cancelled = true;
    };
  }, [
    isPaymentModalOpen,
    user,
    ticketIssued,
    paymentMethod,
    b2cPlanType,
    selectedRouteId,
    currentTicketRecord,
  ]);

  const handleDownloadWorksheet = (provinceLabel: string) => {
    const content = [
      '========================================================================',
      'BẢO TÀNG SỐ KIẾN TRÚC & DI SẢN ĐÔNG NAM BỘ — DẤU ẤN VIỆT 3D',
      `PHIẾU HỌC TẬP TRẢI NGHIỆM DI SẢN 3D (${provinceLabel.toUpperCase()})`,
      'Chương trình Giáo dục Phổ thông 2018 — Môn Lịch sử & Giáo dục Địa phương',
      '========================================================================',
      '',
      'Họ và tên học sinh: ....................................................',
      'Lớp: .................... Trường: ......................................',
      '',
      'PHẦN I. KHẢO SÁT KHÔNG GIAN 3D & ĐỊA TẦNG LỊCH SỬ:',
      '1. Quan sát chế độ Giải phẫu X-Ray 3D của Dinh Độc Lập (HCM-DT-001):',
      '   - Nhận xét giải pháp thông gió và bức rèm hoa đá chữ Cát của KTS Ngô Viết Thụ:',
      '   .....................................................................',
      '',
      '2. Quan sát Mặt cắt 3 tầng ngầm Địa đạo Củ Chi (HCM-DT-009) & Tam Giác Sắt:',
      '   - Giải thích vai trò của tầng đất sét pha đá ong (laterite clay) trên nền phù sa cổ:',
      '   .....................................................................',
      '',
      '3. So sánh kiến trúc Pháp - Đông Dương (Nhà hát TP, Bảo tàng Lịch sử, Bạch Dinh)',
      '   với kiến trúc gỗ cổ truyền Nam Bộ (Nhà cổ Trần Công Vàng, Nhà Lớn Long Sơn):',
      '   .....................................................................',
      '',
      'PHẦN II. MÃ KÍCH HOẠT HỌC LIỆU SỐ TRƯỜNG HỌC:',
      'Mã truy cập 3D Lab: EDTECH-DNB-2026-VIP',
      '========================================================================',
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Phieu_Hoc_Tap_Di_San_3D_${provinceLabel.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setWorksheetDownloadedToast(
      lang === 'en'
        ? `Downloaded 3D Heritage Worksheet (${provinceLabel}) — Ready for classroom printing!`
        : lang === 'zh'
        ? `已下载 3D 遗产学习单（${provinceLabel}）— 可直接打印分发给班级！`
        : `Đã tải xuống Phiếu Học Tập 3D (${provinceLabel}) — Sẵn sàng in hoặc phát cho lớp học!`
    );
    setTimeout(() => setWorksheetDownloadedToast(null), 4000);
  };

  const souvenirs = [
    {
      id: 'souvenir-postcards',
      code: 'O2O-AR-01',
      title:
        lang === 'en'
          ? '3D QR Heritage Architectural Postcard Set (8 Monuments)'
          : lang === 'zh'
          ? '集成 3D 二维码的古建筑烫金明信片套装（8枚）'
          : 'Bộ Bưu thiếp Kiến trúc Cổ tích hợp mã QR 3D',
      price: '39.000đ',
      unit:
        lang === 'en'
          ? '/ Set of 8 fine-art cards'
          : lang === 'zh'
          ? '/ 套（8张艺术卡纸）'
          : '/ Bộ 8 tấm giấy mỹ thuật',
      badge:
        lang === 'en'
          ? 'SCAN QR TO LAUNCH 3D DIORAMA'
          : lang === 'zh'
          ? '扫码开启 3D 建筑沙盘'
          : 'TÍCH HỢP QUÉT QR MỞ SA BÀN 3D',
      siteId: 'HCM-DT-001',
      photo: sites.find((s) => s.id === 'HCM-DT-001')?.photos?.[0] || '',
      description:
        lang === 'en'
          ? 'Set of 8 bronze-foil embossed postcards on 350gsm archival paper. Scan the rear QR code to inspect interactive 3D X-Ray models and listen to multilingual narration.'
          : lang === 'zh'
          ? '采用 350gsm 艺术纸烫印香槟金浮雕的 8 张遗产明信片。使用手机扫描背面二维码即可直接旋转 3D X光解剖模型并收听中英越三语导览。'
          : 'Bộ 8 bưu thiếp in nổi kim nhũ vàng đồng trên giấy mỹ thuật định lượng 350gsm. Quét mã QR mặt sau bằng điện thoại để xoay trực tiếp mô hình 3D X-Ray và nghe thuyết minh đa ngôn ngữ.',
      specs:
        lang === 'en'
          ? ['Champagne Gold #C5A059 foil embossing', 'Integrated 3D & VI/EN/ZH Audio QR', 'Ideal gift for international visitors & students']
          : lang === 'zh'
          ? ['香槟金 #C5A059 烫金压纹工艺', '内置 3D 解剖与中/英/越语音导览二维码', '适合国际游客与学生的文化纪念品']
          : ['In kim nhũ Vàng Champagne #C5A059', 'Tích hợp mã QR 3D & Audio VI/EN/ZH', 'Quà tặng du khách quốc tế & học sinh'],
    },
    {
      id: 'souvenir-passport',
      code: 'O2O-AR-02',
      title:
        lang === 'en'
          ? 'Southeast Vietnam Heritage Passport & Stamp Folio'
          : lang === 'zh'
          ? '东南部遗产实体护照明信册（现场盖章版）'
          : 'Sổ tay Hộ chiếu Di sản đóng dấu mộc tại điểm',
      price: '45.000đ',
      unit:
        lang === 'en'
          ? '/ 48-page thread-sewn booklet'
          : lang === 'zh'
          ? '/ 册（48页锁线精装）'
          : '/ Cuốn khâu chỉ 48 trang',
      badge:
        lang === 'en'
          ? 'SYNCED WITH DIGITAL PASSPORT & STAMPS'
          : lang === 'zh'
          ? '同步数字护照与现场印章'
          : 'ĐỒNG BỘ HỘ CHIẾU SỐ & DẤU MỘC',
      siteId: 'HCM-DT-006',
      photo: sites.find((s) => s.id === 'HCM-DT-006')?.photos?.[0] || '',
      description:
        lang === 'en'
          ? 'Foil-stamped leatherette passport recording your journey across 17 monuments in HCMC, Binh Duong, and Ba Ria - Vung Tau. Combine physical bronze stamps on-site with digital badges.'
          : lang === 'zh'
          ? '烫金皮面纪念护照，记录探访胡志明市、平阳与巴地头顿17处遗迹的旅程。结合遗址现场盖章与线上数字徽章解锁。'
          : 'Sổ tay bìa da ép nhũ lưu giữ hành trình chinh phục 17 di tích Đông Nam Bộ (TP.HCM – Bình Dương – Bà Rịa Vũng Tàu). Kết hợp đóng dấu mộc đồng tại điểm di tích và mở khóa huy hiệu số trên web.',
      specs:
        lang === 'en'
          ? ['17 architectural elevation dossier spreads', 'Dedicated stamp boxes for 17 monuments', 'Includes complimentary 19,000 VND 3D Route code']
          : lang === 'zh'
          ? ['17处遗迹立面测绘图档案页', '17个遗产点专属实体盖章栏', '附赠 19,000 越盾 3D 路线激活码']
          : ['17 trang hồ sơ bản vẽ mặt đứng', 'Ô đóng dấu mộc tại 17 điểm di tích', 'Tặng kèm mã kích hoạt Tour 3D 19.000đ'],
    },
    {
      id: 'souvenir-map-ar',
      code: 'O2O-AR-03',
      title:
        lang === 'en'
          ? '1815 Gia Dinh & Southeast Vietnam Archival Map + AR Lens'
          : lang === 'zh'
          ? '1815 嘉定古地图复刻卷轴与 AR 透视镜套装'
          : 'Bản đồ Giấy Cổ Gia Định - Đông Nam Bộ kèm Thấu kính AR',
      price: '55.000đ',
      unit:
        lang === 'en'
          ? '/ A2 archival map + AR lens card'
          : lang === 'zh'
          ? '/ 份（A2古地图 + AR透视卡）'
          : '/ Bản đồ khổ A2 + Kính lúp AR',
      badge:
        lang === 'en'
          ? '1815–2026 HISTORICAL STRATA MAP'
          : lang === 'zh'
          ? '1815–2026 历史地层对照图'
          : 'BẢN ĐỒ THẤU KÍNH LỊCH SỬ 1815–2026',
      siteId: 'HCM-DT-009',
      photo: sites.find((s) => s.id === 'HCM-DT-009')?.photos?.[0] || '',
      description:
        lang === 'en'
          ? 'Restored 1815 Gia Dinh Octagonal Citadel map by Tran Van Hoc paired with 7 modern regional heritage routes and an AR comparison lens.'
          : lang === 'zh'
          ? '复刻1815年陈文学绘制的嘉定八卦城古地图，结合现代7条跨区域遗产路线及AR历史地层对比透视卡。'
          : 'Bản đồ phục chế Thành Bát Quái Gia Định 1815 của Trần Văn Học kết hợp mạng lưới 7 tuyến di sản liên vùng hiện đại, đi kèm thẻ thấu kính AR đối chiếu địa tầng xưa và nay.',
      specs:
        lang === 'en'
          ? ['Water-resistant A2 traditional Do paper', 'Compare 1815 & 2026 Saigon urban strata', 'Visual teaching aid for local history classes']
          : lang === 'zh'
          ? ['A2幅面防水传统楮纸印刷', '对照1815与2026西贡城市地层', '地方历史课程直观教学挂图']
          : ['Giấy dó mỹ thuật chống thấm khổ A2', 'Đối chiếu địa tầng Sài Gòn 1815 & 2026', 'Học liệu trực quan cho tiết Lịch sử địa phương'],
    },
  ];

  return (
    <div className="w-full min-h-full bg-[#D8C9A9] text-[#171817] select-none">
      {/* Toast thông báo tải học liệu */}
      {worksheetDownloadedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-sm bg-[#171817] border border-[#C9A46A] text-[#D8C9A9] text-xs font-medium shadow-lg">
          <Check className="w-4 h-4 text-[#C9A46A] shrink-0" />
          <span>{worksheetDownloadedToast}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 space-y-20">
        {/* =====================================================================
            HEADER CHUYÊN TRANG THƯƠNG MẠI HÓA & HỌC LIỆU SỐ (STARTUP HUB)
           ===================================================================== */}
        <section className="border-b border-[#171817]/20 pb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-3.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#A94F3D] font-semibold tracking-normal">
              <span>{lang === 'en' ? 'Tickets & Digital EdTech' : lang === 'zh' ? '门票与数字教材' : 'Vé tham quan & Học liệu số'}</span>
              <span className="text-[#171817]/40">·</span>
              <span className="text-[#171817]/70 font-medium">
                {lang === 'en'
                  ? 'Personal 3D Pass  ·  School License  ·  Heritage Publications'
                  : lang === 'zh'
                  ? '个人探索通行证  ·  学校授权  ·  遗产出版物'
                  : 'Vé trải nghiệm cá nhân  ·  Bản quyền Trường học  ·  Ấn phẩm Di sản'}
              </span>
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl font-semibold text-[#171817] tracking-tight leading-[1.12]">
              {lang === 'en'
                ? '3D Heritage Tickets, School EdTech Licenses & Archival Publications'
                : lang === 'zh'
                ? '3D 遗产门票、学校数字教材授权与文创出版物'
                : 'Vé Trải Nghiệm 3D, Học Liệu Số Trường Học & Ấn Phẩm Di Sản'}
            </h1>
            <p className="text-sm sm:text-base text-[#171817]/80 leading-relaxed">
              {lang === 'en'
                ? 'Sustainable cultural-tech business model connecting individual travelers (B2C), secondary & high schools across HCMC – Binh Duong – Ba Ria Vung Tau (B2B EdTech), and physical-digital museum souvenirs (O2O).'
                : lang === 'zh'
                ? '可持续的文化科技与数字教育模式，连接自由行游客（B2C）、胡志明市–平阳–巴地头顿跨区域中学（B2B 数字教材）与实体结合 AR/QR 的博物馆文创出版物（O2O）。'
                : 'Mô hình kinh doanh Công nghệ Văn hóa - Giáo dục bền vững kết nối Du khách tự túc (B2C), Hệ thống Trường THCS/THPT liên vùng TP.HCM – Bình Dương – Bà Rịa Vũng Tàu (B2B EdTech) và Ấn phẩm Bảo tàng kết hợp AR/QR (O2O).'}
            </p>
          </div>

          {/* Chỉ số hiệu quả kinh tế */}
          <div className="grid grid-cols-3 rounded-sm border border-[#171817]/20 bg-[#E4D7BC] divide-x divide-[#171817]/20 shrink-0 overflow-hidden">
            <div className="px-5 py-4">
              <span className="block font-serif text-xl sm:text-2xl text-[#A94F3D] font-semibold tabular-nums">
                -95%
              </span>
              <span className="block text-[12px] text-[#171817]/75 mt-1 font-medium">
                {lang === 'en' ? 'Cost vs. private guide' : lang === 'zh' ? '相比私人导游节省' : 'Chi phí so với thuê HDV'}
              </span>
            </div>
            <div className="px-5 py-4">
              <span className="block font-serif text-xl sm:text-2xl text-[#171817] font-semibold tabular-nums">
                {lang === 'en' ? '17 Sites' : lang === 'zh' ? '17 处遗迹' : '17 Điểm'}
              </span>
              <span className="block text-[12px] text-[#171817]/75 mt-1 font-medium">
                {lang === 'en' ? 'Across 3 Provinces' : lang === 'zh' ? '跨三省市联动' : 'Liên vùng 3 Tỉnh thành'}
              </span>
            </div>
            <div className="px-5 py-4">
              <span className="block font-serif text-xl sm:text-2xl text-[#A94F3D] font-semibold tabular-nums">
                {lang === 'en' ? '3 Pillars' : lang === 'zh' ? '3 大模块' : '3 Nguồn thu'}
              </span>
              <span className="block text-[12px] text-[#171817]/75 mt-1 font-medium">
                {lang === 'en' ? 'Visitor · School · O2O' : lang === 'zh' ? '个人 · 学校 · 文创' : 'Cá nhân · Trường học · Ấn phẩm'}
              </span>
            </div>
          </div>
        </section>

        {/* Thanh cá nhân hóa tài khoản cho Vé & Chứng nhận */}
        <div className="rounded-sm border border-[#171817]/20 bg-[#E4D7BC] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-[#C9A46A] text-[#171817] border border-[#171817]/20">
              {user ? user.avatarInitials : <Lock className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#171817]">
                {user ? (
                  <>
                    <span className="truncate">
                      {lang === 'en'
                        ? 'Authenticated Pass Holder: '
                        : lang === 'zh'
                        ? '已认证持票与行程账户：'
                        : 'Chủ tài khoản mua vé & hành trình: '}
                      <span className="text-[#171817] font-semibold">{user.displayName}</span>
                    </span>
                    {isAdmin ? (
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide bg-[#C9A46A] text-[#171817] border border-[#171817]/20 shrink-0">
                        {lang === 'en' ? 'Administrator' : lang === 'zh' ? '管理员' : 'Quản trị viên'}
                      </span>
                    ) : isTesterPro ? (
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide bg-[#47796D] text-[#D8C9A9] shrink-0">
                        Tester Pro
                      </span>
                    ) : userTier === 'pro' ? (
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide bg-[#171817] border border-[#C9A46A] text-[#C9A46A] shrink-0">
                        Pro
                      </span>
                    ) : userTier === 'plus' ? (
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide bg-[#526D8B] text-[#D8C9A9] shrink-0">
                        Plus
                      </span>
                    ) : null}
                  </>
                ) : (
                  lang === 'en'
                    ? 'Sign in with Google or Facebook to purchase tickets & save your journey'
                    : lang === 'zh'
                    ? '请登录 Google 或 Facebook 以购买门票并保存探索行程'
                    : 'Đăng nhập để mua vé & lưu hành trình'
                )}
              </div>
              <div className="text-[11px] text-[#171817]/70 truncate mt-0.5">
                {user
                  ? isTesterPro
                    ? lang === 'en'
                      ? `${authenticatedAccountLabel} · Tester Pro · All 3 Core Tiers unlocked at 0đ for QA verification`
                      : lang === 'zh'
                      ? `${authenticatedAccountLabel} · 专业测试版 · 三大核心套餐免费 0 越盾解锁测试`
                      : `${authenticatedAccountLabel} · Người thử nghiệm Pro · Mở khóa miễn phí toàn bộ 3 Gói Cốt lõi`
                    : lang === 'en'
                    ? `${authenticatedAccountLabel} · ${isAdmin ? 'Administrator' : 'Visitor'} · Verified pass holder`
                    : lang === 'zh'
                    ? `${authenticatedAccountLabel} · ${isAdmin ? '管理员' : '访客'} · 持票人信息已锁定`
                    : `${authenticatedAccountLabel} · ${isAdmin ? 'Quản trị viên' : 'Du khách'} · Đã khóa thông tin chủ vé`
                  : lang === 'en'
                  ? 'Sign-in required to issue QR passes, earn EdTech certificates, and sync with Admin Studio'
                  : lang === 'zh'
                  ? '需登录账户以签发专属二维码门票、获取数字教材证书并同步至管理后台'
                  : 'Bắt buộc đăng nhập Google hoặc Facebook để xuất vé QR, cấp chứng nhận và đồng bộ Admin Studio'}
              </div>
            </div>
          </div>

          {!user ? (
            <button
              type="button"
              onClick={() => openAuthModal({ prompt: lang === 'en' ? 'Tickets & EdTech' : lang === 'zh' ? '门票与教材' : 'Vé & Học liệu' })}
              className="px-4 py-2 rounded-sm bg-[#171817] hover:bg-[#A94F3D] text-[#D8C9A9] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 self-start sm:self-auto"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{lang === 'en' ? 'Sign In to Buy Tickets' : lang === 'zh' ? '立即登录' : 'Đăng nhập ngay'}</span>
            </button>
          ) : (
            onOpenMyJourney && (
              <button
                type="button"
                onClick={onOpenMyJourney}
                className="px-4 py-2 rounded-sm bg-[#171817] hover:bg-[#A94F3D] text-[#D8C9A9] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 self-start sm:self-auto"
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>
                  {lang === 'en' ? 'My Passes & Journey' : lang === 'zh' ? '我的门票与行程' : 'Vé & Hành trình của tôi'}
                </span>
              </button>
            )
          )}
        </div>

        {preselectedGuidedRoute && (
          <section className="rounded-sm border border-[#A94F3D]/45 bg-[#EDE3CE] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-[#A94F3D]">
                {lang === 'en'
                  ? 'Pre-filled from your completed route'
                  : lang === 'zh'
                  ? '已自动填入您刚完成的路线'
                  : 'Đã điền sẵn lộ trình vừa hoàn thành'}
              </div>
              <h3 className="font-serif text-lg sm:text-xl font-semibold text-[#171817]">
                {preselectedGuidedRoute.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#171817]/80">
                {guidedCertCode
                  ? lang === 'en'
                    ? `Issued route certificate ${guidedCertCode} and synced to your Profile & Admin Studio.`
                    : lang === 'zh'
                    ? `已签发路线证书 ${guidedCertCode}，并同步至个人档案与管理后台。`
                    : `Đã cấp chứng nhận hành trình mã ${guidedCertCode} và đồng bộ vào Hồ sơ cá nhân & Admin Studio.`
                  : lang === 'en'
                  ? 'Claim your free Heritage Route Certificate immediately or issue a 3D QR Tour Ticket for this route below.'
                  : lang === 'zh'
                  ? '您可立即免费领取遗产路线完成证书，或在下方签发该路线的 3D 二维码门票。'
                  : 'Bạn có thể nhận ngay Chứng nhận Hành trình Di sản miễn phí hoặc xuất Vé Tour 3D QR theo tuyến đã chọn sẵn bên dưới.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {user && !guidedCertCode && (
                <button
                  type="button"
                  onClick={() => {
                    const issued = recordIssuedPass({
                      code: `ROUTE-CERT-${Date.now().toString().slice(-4)}`,
                      kind: 'edtech_cert',
                      ownerUserId: user.userId,
                      ownerEmail: user.email || undefined,
                      ownerName: user.displayName,
                      ownerContactMasked: maskEmailForDisplay(user.email || user.displayName),
                      provider: user.provider,
                      routeId: preselectedGuidedRoute.mappedTourId,
                      routeTitle: preselectedGuidedRoute.title,
                      label: `Chứng nhận Hoàn thành Hành trình · ${preselectedGuidedRoute.title}`,
                      amountLabel: 'Chứng nhận Hành trình · Miễn phí',
                      score: 100,
                    });
                    setCertPassId(issued.id);
                    setGuidedCertCode(issued.code);
                    refreshEntitlements();
                  }}
                  className="px-5 py-2.5 rounded-sm bg-[#C9A46A] hover:bg-[#B89258] text-[#171817] text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Award className="w-4 h-4 shrink-0" />
                  <span>
                    {lang === 'en'
                      ? 'Claim Route Certificate'
                      : lang === 'zh'
                      ? '立即领取路线证书'
                      : 'Nhận Chứng nhận Hành trình ngay'}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    openAuthModal({ prompt: lang === 'en' ? 'Claim Route Pass' : lang === 'zh' ? '领取门票与证书' : 'Nhận Vé & Chứng nhận Hành trình' });
                    return;
                  }
                  setTicketIssued(false);
                  setIsPaymentModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-sm bg-[#A94F3D] hover:bg-[#8E3F30] text-[#D8C9A9] text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Ticket className="w-4 h-4 shrink-0" />
                <span>
                  {lang === 'en'
                    ? 'Open 3D Ticket for This Route'
                    : lang === 'zh'
                    ? '打开本路线 3D 门票'
                    : 'Mở Vé Tour 3D tuyến này'}
                </span>
              </button>
            </div>
          </section>
        )}

        {/* =====================================================================
            KHU VỰC 1 — 3 GÓI SẢN PHẨM & BIỂU GIÁ (PRICING TIERS B2C & B2B)
           ===================================================================== */}
        <section className="space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-[13px] tracking-normal text-[#A94F3D] font-semibold block">
                {lang === 'en'
                  ? '01. Service pricing & digital licensing'
                  : lang === 'zh'
                  ? '01. 服务价格与数字授权方案'
                  : '01. Biểu giá dịch vụ & bản quyền số hóa'}
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-[#171817] tracking-tight mt-1.5">
                {lang === 'en'
                  ? '3 Core Product Tiers'
                  : lang === 'zh'
                  ? '3 大核心产品套餐'
                  : '3 Gói Sản Phẩm Cốt Lõi'}
              </h2>
            </div>
            <span className="text-xs text-[#171817]/75">
              {lang === 'en'
                ? 'Freemium · 3D Experience Pass · School License · Instant QR & VIP Issuance'
                : lang === 'zh'
                ? '免费版 · 3D 体验门票 · 学校授权 · 即时签发二维码与 VIP 通行证'
                : 'Miễn phí · Vé trải nghiệm 3D · Bản quyền Trường học · Cấp vé QR & Mã VIP trực tiếp'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* THẺ 1: GÓI KHÁM PHÁ (FREEMIUM — 0 VNĐ) — MẢNG MÀU ĐỎ GẠCH #A94F3D */}
            <div
              onMouseMove={tiltHandlers.onMouseMove}
              onMouseLeave={tiltHandlers.onMouseLeave}
              className="museum-tilt-card relative overflow-hidden rounded-sm border border-[#171817]/20 bg-[#A94F3D] text-[#D8C9A9] p-7 sm:p-8 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-5 relative z-20">
                <div className="flex items-center justify-between border-b border-[#D8C9A9]/25 pb-4">
                  <div>
                    <span className="text-[13px] font-semibold tracking-normal text-[#C9A46A] block">
                      {lang === 'en' ? 'Community Tier' : lang === 'zh' ? '公众普及版' : 'Gói Cộng đồng'}
                    </span>
                    <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#D8C9A9] tracking-tight mt-1">
                      {lang === 'en' ? 'Explorer Pass (Free)' : lang === 'zh' ? '探索套餐（免费）' : 'Gói Khám Phá (Miễn phí)'}
                    </h3>
                  </div>
                  <Compass className="w-6 h-6 text-[#C9A46A] shrink-0" />
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-3xl sm:text-4xl text-[#C9A46A] font-semibold tracking-tight tabular-nums">
                    0 VNĐ
                  </span>
                  <span className="text-xs text-[#D8C9A9]/80">
                    {lang === 'en' ? '/ Community access' : lang === 'zh' ? '/ 公众开放访问' : '/ Truy cập cộng đồng'}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[#D8C9A9]/90 leading-relaxed">
                  {lang === 'en'
                    ? 'Open historical and architectural reference for the public and students preparing for field trips.'
                    : lang === 'zh'
                    ? '面向公众与学生的历史建筑基础科普，便于实地考察前快速查阅。'
                    : 'Phổ cập kiến thức lịch sử - kiến trúc cơ bản cho cộng đồng và học sinh tra cứu nhanh trước chuyến đi thực tế.'}
                </p>

                <ul className="space-y-3 pt-3 border-t border-[#D8C9A9]/25 text-xs sm:text-sm text-[#D8C9A9]">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#C9A46A] shrink-0 mt-0.5" />
                    <span>
                      {lang === 'en'
                        ? 'Interactive GIS map of 17 monuments across HCMC, Binh Duong & Ba Ria - Vung Tau'
                        : lang === 'zh'
                        ? '浏览覆盖胡志明市、平阳与巴地头顿17处遗迹的 GIS 数字地图'
                        : 'Xem bản đồ số GIS 17 di tích liên vùng (TP.HCM – Bình Dương – Bà Rịa Vũng Tàu)'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#C9A46A] shrink-0 mt-0.5" />
                    <span>
                      {lang === 'en'
                        ? 'Rotate standard 3D exterior models directly in the browser'
                        : lang === 'zh'
                        ? '在浏览器中旋转查看标准 3D 建筑外观模型'
                        : 'Xoay xem mô hình 3D ngoại thất cơ bản trên trình duyệt'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#C9A46A] shrink-0 mt-0.5" />
                    <span>
                      {lang === 'en'
                        ? 'Read historical summaries, chronology, and monument classifications'
                        : lang === 'zh'
                        ? '查阅历史简介、建造年代与文物保护级别信息'
                        : 'Đọc tóm tắt lịch sử, niên đại và thông tin xếp hạng di tích'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#C9A46A] shrink-0 mt-0.5" />
                    <span>
                      {lang === 'en'
                        ? 'Gemini 2.5 Flash AI Curator (limit 3 questions/day) · Browse Helpdesk FAQ only'
                        : lang === 'zh'
                        ? 'Gemini 2.5 Flash AI 助理（每日限 3 问）· 仅浏览帮助中心常见问题'
                        : 'Trợ lý AI Gemini 2.5 Flash (tối đa 3 câu/ngày) · Chỉ xem Hướng dẫn & FAQ'}
                    </span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={onNavigateToMap}
                className="relative z-20 w-full py-3.5 px-5 rounded-sm bg-[#171817] hover:bg-[#D8C9A9] text-[#D8C9A9] hover:text-[#171817] text-xs font-semibold transition-colors cursor-pointer"
              >
                {lang === 'en' ? 'Currently Active (Free)' : lang === 'zh' ? '当前正在免费使用' : 'Đang sử dụng miễn phí'}
              </button>
            </div>

            {/* THẺ 2 (NỔI BẬT NHẤT): VÉ TOUR 3D & THUYẾT MINH AI — MẢNG MÀU XANH CỔ #47796D */}
            <div
              onMouseMove={tiltHandlers.onMouseMove}
              onMouseLeave={tiltHandlers.onMouseLeave}
              className="museum-tilt-card relative overflow-hidden rounded-sm border border-[#171817]/20 bg-[#47796D] text-[#D8C9A9] p-7 sm:p-8 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4 relative z-20">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#C9A46A] text-[12px] font-semibold">
                    {lang === 'en' ? 'Most Popular · Save 95%' : lang === 'zh' ? '最受欢迎 · 节省 95%' : 'Phổ biến nhất · Tiết kiệm 95%'}
                  </span>
                  <Ticket className="w-5 h-5 text-[#C9A46A] shrink-0" />
                </div>

                <div className="border-b border-[#D8C9A9]/25 pb-4">
                  <span className="text-[13px] font-semibold tracking-normal text-[#C9A46A] block">
                    {lang === 'en' ? '3D Experience & Audio Pass' : lang === 'zh' ? '3D 深度体验与语音导览票' : 'Vé Trải nghiệm 3D & Thuyết minh'}
                  </span>
                  <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#D8C9A9] tracking-tight mt-1">
                    {lang === 'en' ? '3D Tour Pass & Smart Audio Guide' : lang === 'zh' ? '3D 导览门票与智能语音解说' : 'Vé Tour 3D & Thuyết Minh Thông Minh'}
                  </h3>
                </div>

                {/* Bộ chọn mức giá linh hoạt: 19.000đ / Tuyến hoặc 49.000đ / VIP Toàn Vùng */}
                {!user ? (
                  <div className="rounded-sm border border-[#C9A46A]/65 bg-[#171817]/25 p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#C9A46A]">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>
                        {lang === 'en'
                          ? 'Sign in to purchase tickets & save your journey'
                          : lang === 'zh'
                          ? '登录以购买门票并保存行程'
                          : 'Đăng nhập để mua vé & lưu hành trình'}
                      </span>
                    </div>
                    <p className="text-xs text-[#D8C9A9]/90 leading-relaxed">
                      {lang === 'en'
                        ? 'Named QR ticket issuance is protected via Google or Facebook accounts to synchronize personal journeys and Admin Studio.'
                        : lang === 'zh'
                        ? '实名二维码门票签发受 Google 或 Facebook 账户保护，以便同步个人行程与管理后台。'
                        : 'Biểu mẫu xuất vé QR định danh được bảo vệ theo tài khoản Google hoặc Facebook để đồng bộ hành trình cá nhân và Admin Studio.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-sm bg-[#171817]/25 border border-[#D8C9A9]/30">
                      <button
                        type="button"
                        onClick={() => setB2cPlanType('route_19k')}
                        className={`py-2.5 px-3 rounded-sm text-left transition-colors cursor-pointer ${
                          b2cPlanType === 'route_19k'
                            ? 'bg-[#C9A46A] text-[#171817] font-semibold'
                            : 'text-[#D8C9A9]/85 hover:text-[#D8C9A9]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-serif text-lg font-semibold leading-none tabular-nums">19.000đ</span>
                          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide bg-[#526D8B] text-[#D8C9A9] shrink-0">
                            Plus
                          </span>
                        </div>
                        <span className="block text-[10px] mt-1">
                          {lang === 'en' ? '/ 1 Thematic Route' : lang === 'zh' ? '/ 单条专题路线' : '/ 1 Tuyến Chuyên Đề'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setB2cPlanType('vip_49k')}
                        className={`py-2.5 px-3 rounded-sm text-left transition-colors cursor-pointer ${
                          b2cPlanType === 'vip_49k'
                            ? 'bg-[#C9A46A] text-[#171817] font-semibold'
                            : 'text-[#D8C9A9]/85 hover:text-[#D8C9A9]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-serif text-lg font-semibold leading-none tabular-nums">49.000đ</span>
                          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide bg-[#171817] border border-[#C9A46A] text-[#C9A46A] shrink-0">
                            Pro
                          </span>
                        </div>
                        <span className="block text-[10px] mt-1">
                          {lang === 'en' ? '/ All-Region VIP (3 Provinces)' : lang === 'zh' ? '/ 全区域 VIP（三省市）' : '/ VIP Toàn Vùng (3 Tỉnh)'}
                        </span>
                      </button>
                    </div>

                    {b2cPlanType === 'route_19k' && (
                      <div className="space-y-1.5">
                        <label className="block text-[12.5px] font-semibold text-[#C9A46A]">
                          {lang === 'en'
                            ? 'Select thematic route (19,000 VND):'
                            : lang === 'zh'
                            ? '选择要购买的专题路线（19,000 越盾）：'
                            : 'Chọn tuyến chuyên đề muốn mua vé (19.000đ):'}
                        </label>
                        <select
                          value={selectedRouteId}
                          onChange={(e) => setSelectedRouteId(e.target.value)}
                          className="w-full rounded-sm bg-[#171817] border border-[#D8C9A9]/35 px-3 py-2.5 text-xs text-[#D8C9A9] focus:outline-none focus:border-[#C9A46A] cursor-pointer"
                        >
                          {TOUR_ROUTES.map((route) => {
                            const loc = getLocalizedTour(route);
                            return (
                              <option key={route.id} value={route.id}>
                                {loc.title} ({route.sites.length} {lang === 'en' ? 'stops' : lang === 'zh' ? '站' : 'trạm'} · ~{route.distanceKm} km)
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}
                  </>
                )}

                <ul className="space-y-2.5 pt-2 border-t border-[#D8C9A9]/25 text-xs sm:text-sm text-[#D8C9A9]">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#C9A46A] shrink-0 mt-0.5" />
                    <span>
                      {lang === 'en' ? (
                        <>Unlock full <strong>3D X-Ray Dissection &amp; 3-Tier Subterranean Cross-Sections</strong></>
                      ) : lang === 'zh' ? (
                        <>解锁全部 <strong>3D X光透视与地下三层地道剖面</strong> 模式</>
                      ) : (
                        <>Mở khóa toàn bộ chế độ <strong>Giải phẫu 3D X-Ray &amp; Mặt cắt 3 tầng ngầm</strong></>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#C9A46A] shrink-0 mt-0.5" />
                    <span>
                      {lang === 'en' ? (
                        <><strong>Multilingual Audio Guide (VI/EN/ZH)</strong> triggered via on-site GPS/QR</>
                      ) : lang === 'zh' ? (
                        <><strong>中/英/越三语语音导览</strong>，支持现场 GPS/二维码自动触发</>
                      ) : (
                        <><strong>Thuyết minh âm thanh đa ngôn ngữ (VI/EN/ZH)</strong> tự động theo GPS/QR tại điểm</>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#C9A46A] shrink-0 mt-0.5" />
                    <span>
                      {b2cPlanType === 'vip_49k' ? (
                        lang === 'en' ? (
                          <>Receive the <strong className="inline-block rounded-full px-2 py-0.5 text-[10px] bg-[#171817] border border-[#C9A46A] text-[#C9A46A]">Pro</strong> badge · Unlimited <strong>Gemini 4 Hydrogen</strong> + <strong>Fast-Track Priority Support</strong> (AI &amp; Admin)</>
                        ) : lang === 'zh' ? (
                          <>获授 <strong className="inline-block rounded-full px-2 py-0.5 text-[10px] bg-[#171817] border border-[#C9A46A] text-[#C9A46A]">Pro</strong> 徽章 · 无限量 <strong>Gemini 4 Hydrogen</strong> + <strong>AI 与管理员极速优先支持</strong></>
                        ) : (
                          <>Nhận huy hiệu <strong className="inline-block rounded-full px-2 py-0.5 text-[10px] bg-[#171817] border border-[#C9A46A] text-[#C9A46A]">Pro</strong> cạnh tên · <strong>Gemini 4 Hydrogen</strong> không giới hạn + <strong>Hỗ trợ Ưu tiên Nhanh (Fast-Track)</strong> từ AI &amp; Admin</>
                        )
                      ) : lang === 'en' ? (
                        <>Receive the <strong className="inline-block rounded-full px-2 py-0.5 text-[10px] bg-[#526D8B] text-[#D8C9A9]">Plus</strong> badge · <strong>Gemini 3.5 Flash</strong> AI + Direct Admin Support (30-day archive, standard response)</>
                      ) : lang === 'zh' ? (
                        <>获授 <strong className="inline-block rounded-full px-2 py-0.5 text-[10px] bg-[#526D8B] text-[#D8C9A9]">Plus</strong> 徽章 · <strong>Gemini 3.5 Flash</strong> AI + 管理员支持工单（保存 30 天，标准响应）</>
                      ) : (
                        <>Nhận huy hiệu <strong className="inline-block rounded-full px-2 py-0.5 text-[10px] bg-[#526D8B] text-[#D8C9A9]">Plus</strong> cạnh tên · <strong>Gemini 3.5 Flash</strong> + Gửi hỗ trợ tới Admin (lưu lịch sử 30 ngày, phản hồi tiêu chuẩn)</>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#C9A46A] shrink-0 mt-0.5" />
                    <span>
                      {lang === 'en' ? (
                        <>Download <strong>Offline Wi-Fi Cache</strong> for underground tunnels without cellular signal</>
                      ) : lang === 'zh' ? (
                        <>下载 <strong>离线缓存包</strong>，深入地下隧道无需 4G 信号即可查阅</>
                      ) : (
                        <>Tải gói dữ liệu <strong>Offline Wi-Fi Cache</strong> không cần 4G khi xuống hầm địa đạo</>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#C9A46A] shrink-0 mt-0.5" />
                    <span>
                      {lang === 'en' ? (
                        <>Receive your <strong>Digital Heritage Passport</strong> to collect architectural stamps</>
                      ) : lang === 'zh' ? (
                        <>获取 <strong>数字遗产护照（Digital Heritage Passport）</strong> 收集印章</>
                      ) : (
                        <>Nhận <strong>Hộ chiếu Di sản Số (Digital Heritage Passport)</strong> lưu dấu hành trình</>
                      )}
                    </span>
                  </li>
                </ul>
              </div>

              {!user ? (
                <button
                  type="button"
                  onClick={() => openAuthModal({ prompt: lang === 'en' ? 'Buy 3D Tour Ticket' : lang === 'zh' ? '购买 3D 导览门票' : 'Mua vé Tour 3D' })}
                  className="relative z-20 w-full py-3.5 px-5 rounded-sm bg-[#C9A46A] hover:bg-[#D8C9A9] text-[#171817] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'en'
                      ? 'Sign In to Buy Tickets & Save Journey'
                      : lang === 'zh'
                      ? '登录以购买门票并保存行程'
                      : 'Đăng nhập để mua vé & lưu hành trình'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (isTesterPro) {
                      const randSuffix = Math.random().toString(36).slice(2, 5).toUpperCase();
                      const uniqueCode =
                        b2cPlanType === 'vip_49k'
                          ? `TST-VIP-${Date.now().toString().slice(-4)}-${randSuffix}`
                          : `TST-RTE-${Date.now().toString().slice(-4)}-${randSuffix}`;
                      const routeTitle =
                        b2cPlanType === 'vip_49k'
                          ? `Vé VIP Toàn Vùng Đông Nam Bộ (17 Di tích · ${TOUR_ROUTES.length} Tuyến)`
                          : getLocalizedTour(selectedRouteObj).title;
                      const issued = recordIssuedPass({
                        code: uniqueCode,
                        kind: b2cPlanType === 'vip_49k' ? 'vip_ticket' : 'route_ticket',
                        ownerUserId: user.userId,
                        ownerEmail: user.email || undefined,
                        ownerName: user.displayName,
                        ownerContactMasked: maskEmailForDisplay(user.email || user.displayName),
                        provider: user.provider,
                        routeId: b2cPlanType === 'route_19k' ? selectedRouteObj.id : undefined,
                        routeTitle,
                        label:
                          b2cPlanType === 'vip_49k'
                            ? 'Vé VIP Toàn Vùng (Tester Pro)'
                            : 'Vé Tuyến Chuyên Đề 3D (Tester Pro)',
                        amountLabel: 'Miễn phí · Tester Pro',
                      });
                      setUserSubscriptionTier(user.userId, user.email || undefined, b2cPlanType);
                      setTicketPassId(issued.id);
                      setTicketIssued(true);
                      refreshEntitlements();
                      setIsPaymentModalOpen(true);
                      return;
                    }
                    setTicketIssued(false);
                    setIsPaymentModalOpen(true);
                  }}
                  className="relative z-20 w-full py-3.5 px-5 rounded-sm bg-[#171817] hover:bg-[#D8C9A9] text-[#D8C9A9] hover:text-[#171817] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>
                    {isTesterPro
                      ? lang === 'en'
                        ? 'Unlock Free & Issue QR (Tester Pro)'
                        : lang === 'zh'
                        ? '免费解锁并签发二维码（测试版）'
                        : 'Mở khóa 0đ & Xuất vé QR (Tester Pro)'
                      : lang === 'en'
                      ? 'Get Experience Pass Now'
                      : lang === 'zh'
                      ? '立即购买体验门票'
                      : 'Mua vé trải nghiệm ngay'}
                  </span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* THẺ 3: GÓI HỌC LIỆU SỐ TRƯỜNG HỌC (B2B EDTECH) — MẢNG MÀU XANH LAM #526D8B */}
            <div
              onMouseMove={tiltHandlers.onMouseMove}
              onMouseLeave={tiltHandlers.onMouseLeave}
              className="museum-tilt-card relative overflow-hidden rounded-sm border border-[#171817]/20 bg-[#526D8B] text-[#D8C9A9] p-7 sm:p-8 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-5 relative z-20">
                <div className="flex items-center justify-between border-b border-[#D8C9A9]/25 pb-4">
                  <div>
                    <span className="text-[13px] font-semibold tracking-normal text-[#C9A46A] block">
                      {lang === 'en' ? 'Institutional EdTech License' : lang === 'zh' ? '学校教育机构授权' : 'Bản quyền Giáo dục Trường học'}
                    </span>
                    <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#D8C9A9] tracking-tight mt-1">
                      {lang === 'en' ? 'School Digital EdTech Package' : lang === 'zh' ? '学校 3D 数字教材授权包' : 'Gói Học Liệu Số Trường Học'}
                    </h3>
                  </div>
                  <GraduationCap className="w-6 h-6 text-[#C9A46A] shrink-0" />
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-3xl sm:text-4xl text-[#C9A46A] font-semibold tracking-tight tabular-nums">
                    5.000.000đ
                  </span>
                  <span className="text-xs text-[#D8C9A9]/80">
                    {lang === 'en' ? '/ School / Year' : lang === 'zh' ? '/ 学校 / 学年' : '/ Trường / Năm'}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[#D8C9A9]/90 leading-relaxed">
                  {lang === 'en'
                    ? 'Online 3D Heritage Lab aligned with the 2018 General Education Curriculum for History & Local Education.'
                    : lang === 'zh'
                    ? '符合 2018 国家普通教育课程标准的在线 3D 遗产实验室，服务历史与地方教育课程。'
                    : 'Giải pháp phòng Lab Di sản 3D trực tuyến phục vụ môn Lịch sử & Giáo dục Địa phương chuẩn Chương trình GDPT 2018.'}
                </p>

                <ul className="space-y-3 pt-3 border-t border-[#D8C9A9]/25 text-xs sm:text-sm text-[#D8C9A9]">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#C9A46A] shrink-0 mt-0.5" />
                    <span>
                      {lang === 'en' ? (
                        <>Unlimited campus-wide access for <strong>all Teachers &amp; Students</strong></>
                      ) : lang === 'zh' ? (
                        <>为全校 <strong>教师与学生提供无限制</strong> 校园访问授权</>
                      ) : (
                        <>Cấp bản quyền truy cập <strong>không giới hạn cho toàn bộ Giáo viên &amp; Học sinh</strong> của trường THCS/THPT</>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#C9A46A] shrink-0 mt-0.5" />
                    <span>
                      {lang === 'en' ? (
                        <><strong>Exclusively unlocks</strong> the Open EdTech Repository, 3-Province Worksheets &amp; Interactive Assessment Quiz</>
                      ) : lang === 'zh' ? (
                        <><strong>独家解锁</strong>开放数字教材库、三省市学习单与互动知识测验</>
                      ) : (
                        <><strong>Mở khóa độc quyền</strong> Kho Học Liệu Mở, Phiếu Học Tập 3 Tỉnh &amp; Bài Kiểm Tra Trắc Nghiệm Tương Tác</>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#C9A46A] shrink-0 mt-0.5" />
                    <span>
                      {lang === 'en' ? (
                        <>Includes <strong>Gemini 4 Hydrogen Unlimited</strong> + Priority Fast-Track Support &amp; Teacher Dashboard</>
                      ) : lang === 'zh' ? (
                        <>包含 <strong>无限量 Gemini 4 Hydrogen AI</strong>、优先快速支持与教学管理面板</>
                      ) : (
                        <>Tích hợp <strong>Gemini 4 Hydrogen không giới hạn</strong>, Hỗ trợ Ưu tiên Nhanh &amp; Bảng điều khiển giảng dạy</>
                      )}
                    </span>
                  </li>
                </ul>
              </div>

              {!user ? (
                <button
                  type="button"
                  onClick={() => openAuthModal({ prompt: lang === 'en' ? 'Register School EdTech Trial' : lang === 'zh' ? '申请学校教材试用' : 'Đăng ký Học liệu Trường học' })}
                  className="relative z-20 w-full py-3.5 px-5 rounded-sm bg-[#171817] hover:bg-[#D8C9A9] text-[#D8C9A9] hover:text-[#171817] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5 text-[#C9A46A]" />
                  <span>
                    {lang === 'en' ? 'Sign In for School Registration' : lang === 'zh' ? '登录以申请学校授权' : 'Đăng nhập để đăng ký trường học'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (isTesterPro) {
                      const issued = recordIssuedPass({
                        code: `TST-B2B-${Date.now().toString().slice(-4)}`,
                        kind: 'b2b_school',
                        ownerUserId: user.userId,
                        ownerEmail: user.email || undefined,
                        ownerName: `${schoolName} (${user.displayName})`,
                        ownerContactMasked: maskEmailForDisplay(teacherContact || user.email),
                        provider: user.provider,
                        label: `Bản quyền Trường học · ${schoolProvince} (Tester Pro)`,
                        amountLabel: 'Miễn phí · Tester Pro',
                      });
                      activateUserSchoolPackage({
                        userId: user.userId,
                        userEmail: user.email || undefined,
                        schoolName,
                        province: schoolProvince,
                      });
                      setCertPassId(issued.id);
                      setB2bSubmitted(true);
                      refreshEntitlements();
                      setIsB2BModalOpen(true);
                      return;
                    }
                    setB2bSubmitted(false);
                    setIsB2BModalOpen(true);
                  }}
                  className="relative z-20 w-full py-3.5 px-5 rounded-sm bg-[#171817] hover:bg-[#D8C9A9] text-[#D8C9A9] hover:text-[#171817] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>
                    {isTesterPro
                      ? lang === 'en'
                        ? 'Unlock School Pack Free (Tester Pro)'
                        : lang === 'zh'
                        ? '免费解锁学校教材包（测试版）'
                        : 'Mở khóa 0đ Học liệu Trường học (Tester Pro)'
                      : lang === 'en'
                      ? 'Request School Trial License'
                      : lang === 'zh'
                      ? '申请学校免费试用授权'
                      : 'Đăng ký dùng thử cho Trường học'}
                  </span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* =====================================================================
            KHU VỰC 2 — CỬA HÀNG ẤN PHẨM DI SẢN TÍCH HỢP AR/3D (O2O SOUVENIRS)
           ===================================================================== */}
        <section className="space-y-8 pt-6 border-t border-[#171817]/18">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-[13px] tracking-normal text-[#A94F3D] font-semibold block">
                {lang === 'en'
                  ? '02. Phygital AR/3D Museum Publications'
                  : lang === 'zh'
                  ? '02. 融合数字科技的遗产文创出版物'
                  : '02. Ấn phẩm di sản tích hợp công nghệ số'}
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-[#171817] tracking-tight mt-1.5">
                {lang === 'en'
                  ? 'AR / 3D Heritage Publications & Souvenir Store'
                  : lang === 'zh'
                  ? 'AR / 3D 遗产文创与出版物商店'
                  : 'Cửa Hàng Ấn Phẩm Di Sản Tích Hợp AR / 3D'}
              </h2>
            </div>
            <span className="text-xs text-[#171817]/75">
              {lang === 'en'
                ? 'Bridging physical keepsakes (Offline Souvenir) with 3D Digital Twins (Online)'
                : lang === 'zh'
                ? '结合实体纪念品（Offline）与线上 3D 数字孪生沙盘（Online）'
                : 'Kết hợp trải nghiệm vật lý (Offline Souvenir) và công nghệ số hóa 3D (Online Digital Twin)'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {souvenirs.map((item) => {
              const isOrdered = souvenirOrderedId === item.id;
              return (
                <article
                  key={item.id}
                  onMouseMove={tiltHandlers.onMouseMove}
                  onMouseLeave={tiltHandlers.onMouseLeave}
                  className="museum-tilt-card relative rounded-sm border border-[#171817]/20 bg-[#EDE3CE] hover:bg-[#E4D7BC] flex flex-col justify-between overflow-hidden group transition-colors"
                >
                  <div>
                    <div className="relative aspect-video w-full overflow-hidden bg-[#171817] border-b border-[#171817]/18">
                      {item.photo && !failedPhotoMap[item.id] ? (
                        <>
                          <HeritageSmoothImage
                            src={item.photo}
                            alt={item.title}
                            waitTone="dark"
                            onError={() =>
                              setFailedPhotoMap((prev) => ({ ...prev, [item.id]: true }))
                            }
                            className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#171817]/65 via-transparent to-transparent" />
                          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-sm bg-[#171817]/90 border border-[#C9A46A]/60 text-[10px] font-semibold text-[#C9A46A]">
                            {item.badge}
                          </div>
                          <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-sm bg-[#171817]/90 text-[11px] font-semibold text-[#D8C9A9] tabular-nums">
                            {item.code}
                          </div>
                        </>
                      ) : (() => {
                        const mappedSite = sites.find((s) => s.id === item.siteId) || sites[0];
                        return mappedSite ? (
                          <HeritageTypographicPlate
                            site={mappedSite}
                            variant="catalog"
                            titleOverride={item.title}
                            badgeOverride={item.code}
                          />
                        ) : null;
                      })()}
                    </div>

                    <div className="p-6 sm:p-7 space-y-3">
                      <h3 className="font-serif text-xl font-semibold text-[#171817] tracking-tight leading-snug">
                        {item.title}
                      </h3>

                      <div className="flex items-baseline gap-2 border-b border-[#171817]/15 pb-3">
                        <span className="font-serif text-2xl text-[#A94F3D] font-semibold tabular-nums">
                          {item.price}
                        </span>
                        <span className="text-xs text-[#171817]/70">{item.unit}</span>
                      </div>

                      <p className="text-xs sm:text-sm text-[#171817]/80 leading-relaxed">
                        {item.description}
                      </p>

                      <ul className="space-y-1.5 pt-2">
                        {item.specs.map((sp, i) => (
                          <li key={i} className="text-xs text-[#171817]/85 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[#47796D] shrink-0" />
                            <span>{sp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="px-6 sm:px-7 pb-6 sm:pb-7 pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSouvenirOrderedId(item.id);
                        setSelectedSouvenirId(item.id);
                      }}
                      className="w-full py-3 px-4 rounded-sm bg-[#A94F3D] hover:bg-[#8E3F30] text-[#D8C9A9] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>
                        {isOrdered
                          ? lang === 'en'
                            ? 'View Attached 3D QR Code'
                            : lang === 'zh'
                            ? '查看附带的 3D 二维码'
                            : 'Xem mã QR 3D đính kèm'
                          : lang === 'en'
                          ? 'Order Publication & Preview QR'
                          : lang === 'zh'
                          ? '预订文创并预览二维码'
                          : 'Đặt ấn phẩm & xem mẫu QR'}
                      </span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Hộp hiển thị xem trước Ấn phẩm O2O khi người dùng bấm chọn */}
          {selectedSouvenirId && (
            <div className="rounded-sm border border-[#A94F3D]/50 bg-[#EDE3CE] p-6 sm:p-7 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="text-[13px] font-semibold text-[#47796D]">
                  ✓{' '}
                  {lang === 'en'
                    ? `Initialized digital publication preview (${selectedSouvenirId})`
                    : lang === 'zh'
                    ? `已生成数字文创出版物预览（${selectedSouvenirId}）`
                    : `Đã khởi tạo mẫu ấn phẩm số hóa (${selectedSouvenirId})`}
                </div>
                <h4 className="font-serif text-xl font-semibold text-[#171817]">
                  {lang === 'en'
                    ? 'Phygital Link: Physical Keepsake → 3D Diorama & Digital Heritage Passport'
                    : lang === 'zh'
                    ? '虚实联动体验：实体文创出版物 → 3D 建筑沙盘与数字遗产护照'
                    : 'Trải nghiệm liên kết Ấn phẩm Vật lý → Không gian Sa bàn 3D & Hộ chiếu Di sản'}
                </h4>
                <p className="text-xs sm:text-sm text-[#171817]/80 leading-relaxed">
                  {lang === 'en'
                    ? 'Each publication includes a unique QR identifier. Scanning the postcard or map QR launches the corresponding 3D model and stamps your Digital Heritage Passport.'
                    : lang === 'zh'
                    ? '每件文创出版物均印有专属二维码。扫描明信片或古地图上的二维码，即可自动开启对应 3D 模型并在数字遗产护照中盖章认证。'
                    : 'Mỗi ấn phẩm được in kèm mã định danh QR riêng biệt. Khi học sinh hoặc du khách quét mã QR trên bưu thiếp / bản đồ giấy, ứng dụng sẽ tự động mở mô hình 3D tương ứng và đóng dấu mộc xác nhận vào Hộ chiếu Di sản Số.'}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => onStart3DVipExperience('HCM-DT-001', 'TOUR-INTER-01')}
                  className="px-5 py-3 rounded-sm bg-[#47796D] hover:bg-[#3A655B] text-[#D8C9A9] text-xs font-semibold cursor-pointer transition-colors"
                >
                  {lang === 'en'
                    ? 'Launch 3D Diorama via QR ↗'
                    : lang === 'zh'
                    ? '扫码体验 3D 沙盘 ↗'
                    : 'Mở thử Sa bàn 3D từ mã QR ↗'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSouvenirId(null)}
                  className="px-4 py-3 rounded-sm bg-[#D8C9A9] hover:bg-[#E4D7BC] border border-[#171817]/25 text-xs font-medium text-[#171817] cursor-pointer transition-colors"
                >
                  {lang === 'en' ? 'Close' : lang === 'zh' ? '关闭' : 'Đóng'}
                </button>
              </div>
            </div>
          )}
          {/* Bảng Dấu mộc Hộ chiếu Di sản Số đồng bộ từ Thử thách Giải mã 3D */}
          <div className="rounded-sm border border-[#171817]/20 bg-[#EDE3CE] p-6 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#171817]/18 pb-4">
              <div>
                <span className="text-[13px] font-semibold text-[#A94F3D] block">
                  {lang === 'en'
                    ? `Digital Heritage Passport · ${user ? user.displayName : '3D Architectural Stamps'}`
                    : lang === 'zh'
                    ? `数字遗产护照 · ${user ? user.displayName : '3D 建筑解密印章'}`
                    : `Hộ chiếu Di sản Số · ${user ? user.displayName : 'Dấu mộc Giải mã 3D'}`}
                </span>
                <h3 className="font-serif text-xl font-semibold text-[#171817] tracking-tight mt-1">
                  {lang === 'en'
                    ? `Digital Heritage Passport ${user ? `— ${user.displayName}` : '(Synced with 3D Architectural Stamps)'}`
                    : lang === 'zh'
                    ? `数字遗产护照 ${user ? `— ${user.displayName}` : '（同步 3D 建筑解剖印章）'}`
                    : `Hộ Chiếu Di Sản Số ${user ? `— ${user.displayName}` : '(Đồng bộ Dấu Mộc Giải Mã Kiến Trúc 3D)'}`}
                </h3>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="px-4 py-2 rounded-sm bg-[#E4D7BC] border border-[#171817]/25 text-xs font-semibold text-[#171817] tabular-nums">
                  {unlockedStampCount} / {sites.length}{' '}
                  {lang === 'en' ? 'Stamps Unlocked' : lang === 'zh' ? '枚印章已解锁' : 'Dấu mộc đã mở'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {sites.map((site) => {
                const stamp = passportStamps[site.id];
                const isUnlocked = Boolean(stamp);
                const thumbPhoto = site.photos?.[0] || '';
                const hasValidThumb = Boolean(thumbPhoto) && !failedPhotoMap[site.id];
                const locSite = getLocalizedSite(site);
                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => onStart3DVipExperience(site.id, 'TOUR-INTER-01')}
                    className={`text-left p-3.5 rounded-sm border transition-colors cursor-pointer flex flex-col justify-between gap-2.5 group ${
                      isUnlocked
                        ? 'bg-[#C9A46A]/25 border-[#A94F3D] hover:bg-[#C9A46A]/35'
                        : 'bg-[#D8C9A9]/75 border-[#171817]/18 hover:border-[#171817]/45'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-[#171817]/65 tabular-nums">
                        {site.id}
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          isUnlocked ? 'text-[#47796D]' : 'text-[#171817]/60'
                        }`}
                      >
                        {isUnlocked
                          ? `✓ ${stamp.stampCode}`
                          : lang === 'en'
                          ? 'Locked'
                          : lang === 'zh'
                          ? '待解锁'
                          : 'Chưa giải mã'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-16 aspect-video rounded-sm overflow-hidden shrink-0 border border-[#171817]/20 bg-[#171817]">
                        {hasValidThumb ? (
                          <HeritageSmoothImage
                            src={thumbPhoto}
                            alt={locSite.officialName}
                            loading="lazy"
                            waitTone="dark"
                            onError={() =>
                              setFailedPhotoMap((prev) => ({ ...prev, [site.id]: true }))
                            }
                            className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                          />
                        ) : (
                          <HeritageTypographicPlate site={site} variant="compact" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="text-xs font-semibold text-[#171817] line-clamp-1">
                          {locSite.officialName}
                        </div>
                        <div className="text-[11px] text-[#171817]/70 line-clamp-1">
                          {isUnlocked
                            ? stamp.secretTitle
                            : lang === 'en'
                            ? 'Open 3D & Unlock Stamp ↗'
                            : lang === 'zh'
                            ? '点击开启 3D 沙盘并解锁 ↗'
                            : 'Bấm để mở Sa bàn 3D & Giải mã ↗'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* =====================================================================
            KHU VỰC 3 — KHO HỌC LIỆU MỞ & BÀI KIỂM TRA TƯƠNG TÁC (EDTECH QUIZ)
            Ẩn hoàn toàn khi chưa mở khóa Gói Trường học (trừ Admin & Tester Pro)
           ===================================================================== */}
        {canAccessSection03 && (
        <section className="space-y-8 pt-6 border-t border-[#171817]/18">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[13px] tracking-normal text-[#A94F3D] font-semibold block">
                  {lang === 'en'
                    ? '03. Open EdTech Repository & Interactive Assessment'
                    : lang === 'zh'
                    ? '03. 开放数字教材库与互动知识测评'
                    : '03. Kho học liệu mở & đánh giá tương tác'}
                </span>
                {isTesterPro && !isAdmin && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#171817] text-[#C9A46A] border border-[#C9A46A]/45 text-[11px] font-semibold tracking-wide">
                    {lang === 'en'
                      ? 'Unlocked via Tester Mode'
                      : lang === 'zh'
                      ? '通过测试模式解锁'
                      : 'Mở khóa qua Chế độ Tester'}
                  </span>
                )}
              </div>
              <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-[#171817] tracking-tight mt-1.5">
                {lang === 'en'
                  ? 'Open EdTech Repository & Interactive Heritage Quiz'
                  : lang === 'zh'
                  ? '开放数字教材库与遗产互动测验'
                  : 'Kho Học Liệu Mở & Bài Kiểm Tra Tương Tác'}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleDownloadWorksheet('TP.HCM - Bình Dương - BRVT')}
                className="px-4 py-2.5 rounded-sm bg-[#47796D] hover:bg-[#3A655B] text-[#D8C9A9] text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {lang === 'en'
                    ? 'Download 3-Province Worksheet'
                    : lang === 'zh'
                    ? '下载三省市 3D 学习单'
                    : 'Tải Phiếu Học Tập 3 Tỉnh'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2.5 rounded-sm bg-[#EDE3CE] hover:bg-[#E4D7BC] text-[#171817] border border-[#171817]/25 text-xs font-medium transition-colors cursor-pointer flex items-center gap-2"
              >
                <Printer className="w-3.5 h-3.5 text-[#A94F3D]" />
                <span>
                  {lang === 'en' ? 'Print Syllabus & Quiz' : lang === 'zh' ? '打印教学大纲与测验' : 'In Đề Cương & Trắc Nghiệm'}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Cột trái (4/12): Danh mục Tài liệu & Giáo án số hóa 3 Tỉnh */}
            <div className="lg:col-span-4 rounded-sm border border-[#171817]/20 bg-[#EDE3CE] p-6 sm:p-7 space-y-5">
              <div className="border-b border-[#171817]/18 pb-3.5">
                <span className="text-[13px] font-semibold text-[#A94F3D] block">
                  {lang === 'en'
                    ? '2018 General Education Curriculum'
                    : lang === 'zh'
                    ? '2018 国家普通教育课程标准'
                    : 'Chương trình Giáo dục Phổ thông 2018'}
                </span>
                <h3 className="font-serif text-xl font-semibold text-[#171817] mt-1">
                  {lang === 'en'
                    ? '3D Worksheets & Lesson Plans'
                    : lang === 'zh'
                    ? '3D 实践学习单与互动教案'
                    : 'Bộ Phiếu Học Tập & Giáo Án 3D'}
                </h3>
              </div>

              <div className="space-y-3">
                {[
                  {
                    code: 'DOC-HCM-01',
                    title:
                      lang === 'en'
                        ? 'Module 1: Saigon – Gia Dinh Architecture & Cu Chi Tunnels (12 HCMC Sites)'
                        : lang === 'zh'
                        ? '专题 1：西贡–嘉定建筑遗产与古芝地道（胡志明市 12 处遗迹）'
                        : 'Chuyên đề 1: Kiến trúc Sài Gòn – Gia Định & Địa đạo Củ Chi (12 Di tích TP.HCM)',
                    region:
                      lang === 'en' ? 'Ho Chi Minh City' : lang === 'zh' ? '胡志明市' : 'TP. Hồ Chí Minh',
                  },
                  {
                    code: 'DOC-BD-02',
                    title:
                      lang === 'en'
                        ? 'Module 2: Southern "Đinh" Timber Houses & Ben Cat Iron Triangle Tunnels'
                        : lang === 'zh'
                        ? '专题 2：南部丁字形古宅与笨葛铁三角地道'
                        : 'Chuyên đề 2: Nhà cổ chữ Đinh Nam Bộ & Địa đạo Tam Giác Sắt Bến Cát',
                    region:
                      lang === 'en' ? 'Binh Duong Province' : lang === 'zh' ? '平阳省' : 'Tỉnh Bình Dương',
                  },
                  {
                    code: 'DOC-BRVT-03',
                    title:
                      lang === 'en'
                        ? 'Module 3: Coastal Heritage, White Palace, Long Son Big House & Long Phuoc Tunnels'
                        : lang === 'zh'
                        ? '专题 3：海洋遗产、头顿白宫、龙山大屋与龙福地道'
                        : 'Chuyên đề 3: Di sản Biển, Bạch Dinh, Nhà Lớn Long Sơn & Địa đạo Long Phước',
                    region:
                      lang === 'en'
                        ? 'Ba Ria - Vung Tau Province'
                        : lang === 'zh'
                        ? '巴地头顿省'
                        : 'Tỉnh Bà Rịa - Vũng Tàu',
                  },
                ].map((doc) => (
                  <div
                    key={doc.code}
                    className="p-4 rounded-sm bg-[#D8C9A9]/75 border border-[#171817]/18 hover:border-[#171817]/40 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#A94F3D] tabular-nums">
                      <span>{doc.code}</span>
                      <span>{doc.region}</span>
                    </div>
                    <div className="text-sm font-medium text-[#171817] leading-snug">
                      {doc.title}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadWorksheet(doc.region)}
                      className="pt-1 text-xs text-[#47796D] hover:text-[#3A655B] font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>
                        {lang === 'en' ? 'Download Worksheet ↗' : lang === 'zh' ? '下载实践学习单 ↗' : 'Tải phiếu thực hành ↗'}
                      </span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Thống kê kết quả làm bài trắc nghiệm */}
              <div className="p-4 rounded-sm bg-[#E4D7BC] border border-[#171817]/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#171817]/75">
                    {lang === 'en' ? 'Quiz Progress:' : lang === 'zh' ? '答题进度：' : 'Tiến độ làm bài:'}
                  </span>
                  <span className="text-xs text-[#A94F3D] font-semibold tabular-nums">
                    {Object.keys(selectedAnswers).length} / 5{' '}
                    {lang === 'en' ? 'questions' : lang === 'zh' ? '题' : 'câu'}
                  </span>
                </div>
                {quizSubmitted && (
                  <div className="pt-2 border-t border-[#171817]/18 space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-[#171817]/85">
                        {lang === 'en' ? 'Score Achieved:' : lang === 'zh' ? '最终得分：' : 'Điểm số đạt được:'}
                      </span>
                      <span className="font-serif text-2xl text-[#A94F3D] font-semibold tabular-nums">
                        {quizScore} / 100 {lang === 'en' ? 'pts' : lang === 'zh' ? '分' : 'điểm'}
                      </span>
                    </div>
                    <p className="text-xs text-[#171817]/75">
                      {quizScore >= 80
                        ? lang === 'en'
                          ? 'Excellent! You have mastered the history, architecture, and geology of Southeast Vietnam.'
                          : lang === 'zh'
                          ? '优异！您已深入掌握东南部历史、建筑与地质特征。'
                          : 'Xuất sắc! Bạn đã nắm vững kiến thức lịch sử - kiến trúc & địa chất Đông Nam Bộ.'
                        : lang === 'en'
                        ? 'Completed! Review the detailed architectural explanations on the right.'
                        : lang === 'zh'
                        ? '已完成！请查看右侧每道题的详细科学解析。'
                        : 'Đã hoàn thành! Xem giải thích chi tiết từng câu ở cột bên phải.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Cột phải (8/12): 5 Câu hỏi Trắc nghiệm Tương tác */}
            <div className="lg:col-span-8 rounded-sm border border-[#171817]/20 bg-[#EDE3CE] p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#171817]/18 pb-4">
                <div>
                  <span className="text-[13px] font-semibold text-[#A94F3D]">
                    {lang === 'en'
                      ? 'Interactive Assessment · 5 Questions'
                      : lang === 'zh'
                      ? '互动知识测评 · 5 道选择题'
                      : 'Đánh giá kiến thức tương tác · 5 câu hỏi'}
                  </span>
                  <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#171817] tracking-tight mt-0.5">
                    {lang === 'en'
                      ? 'Southeast Vietnam History, Architecture & Geology Quiz'
                      : lang === 'zh'
                      ? '东南部历史、建筑与地质综合测验'
                      : 'Bài Kiểm Tra Trắc Nghiệm Lịch Sử – Kiến Trúc – Địa Chất Đông Nam Bộ'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAnswers({});
                    setQuizSubmitted(false);
                  }}
                  className="px-3.5 py-1.5 rounded-sm border border-[#171817]/25 bg-[#D8C9A9]/75 hover:bg-[#E4D7BC] text-xs text-[#171817]/75 hover:text-[#171817] flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{lang === 'en' ? 'Reset' : lang === 'zh' ? '重做' : 'Làm lại'}</span>
                </button>
              </div>

              <div className="space-y-5">
                {EDTECH_QUIZ_QUESTIONS.map((q, qIdx) => {
                  const chosen = selectedAnswers[q.id];
                  const isAnswered = chosen !== undefined;
                  const isCorrect = chosen === q.correctIndex;
                  const locCode =
                    lang === 'en'
                      ? q.monumentCodeEn || q.monumentCode
                      : lang === 'zh'
                      ? q.monumentCodeZh || q.monumentCode
                      : q.monumentCode;
                  const locQuestion =
                    lang === 'en'
                      ? q.questionEn || q.question
                      : lang === 'zh'
                      ? q.questionZh || q.question
                      : q.question;
                  const locOptions =
                    lang === 'en'
                      ? q.optionsEn || q.options
                      : lang === 'zh'
                      ? q.optionsZh || q.options
                      : q.options;
                  const locExplanation =
                    lang === 'en'
                      ? q.explanationEn || q.explanation
                      : lang === 'zh'
                      ? q.explanationZh || q.explanation
                      : q.explanation;

                  return (
                    <div
                      key={q.id}
                      className="p-5 sm:p-6 rounded-sm bg-[#D8C9A9]/70 border border-[#171817]/18 space-y-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold text-[#A94F3D] tabular-nums">
                          {lang === 'en'
                            ? `Question 0${qIdx + 1} · ${locCode}`
                            : lang === 'zh'
                            ? `第 0${qIdx + 1} 题 · ${locCode}`
                            : `Câu 0${qIdx + 1} · ${locCode}`}
                        </span>
                        {isAnswered && (
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-sm border ${
                              isCorrect
                                ? 'text-[#47796D] bg-[#47796D]/12 border-[#47796D]/40'
                                : 'text-[#A94F3D] bg-[#A94F3D]/12 border-[#A94F3D]/40'
                            }`}
                          >
                            {isCorrect
                              ? lang === 'en'
                                ? '✓ Correct (+20 pts)'
                                : lang === 'zh'
                                ? '✓ 回答正确 (+20分)'
                                : '✓ Chính xác (+20đ)'
                              : lang === 'en'
                              ? '✕ See explanation'
                              : lang === 'zh'
                              ? '✕ 查看解析'
                              : '✕ Xem giải thích'}
                          </span>
                        )}
                      </div>

                      <h4 className="text-base sm:text-lg font-medium text-[#171817] leading-snug">
                        {locQuestion}
                      </h4>

                      <div className="grid grid-cols-1 gap-2">
                        {locOptions.map((opt, oIdx) => {
                          const isThisSelected = chosen === oIdx;
                          const showCorrectHighlight =
                            (quizSubmitted || isAnswered) && oIdx === q.correctIndex;
                          const showWrongHighlight =
                            isThisSelected && oIdx !== q.correctIndex;

                          return (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() =>
                                setSelectedAnswers((prev) => ({ ...prev, [q.id]: oIdx }))
                              }
                              className={`w-full text-left px-4 py-3 rounded-sm border text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                                showCorrectHighlight
                                  ? 'border-[#47796D] bg-[#47796D]/15 text-[#171817] font-semibold'
                                  : showWrongHighlight
                                  ? 'border-[#A94F3D] bg-[#A94F3D]/15 text-[#A94F3D] font-medium'
                                  : isThisSelected
                                  ? 'border-[#526D8B] bg-[#526D8B]/15 text-[#171817]'
                                  : 'border-[#171817]/18 bg-[#F4EFE4]/70 text-[#171817]/90 hover:border-[#171817]/40'
                              }`}
                            >
                              <span>{opt}</span>
                              {showCorrectHighlight && (
                                <Check className="w-4 h-4 text-[#47796D] shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {(isAnswered || quizSubmitted) && (
                        <div className="p-4 rounded-sm bg-[#E4D7BC] border border-[#C9A46A]/80 text-xs text-[#171817]/90 leading-relaxed">
                          <strong className="text-[#A94F3D] font-semibold block mb-1">
                            {lang === 'en'
                              ? 'Architectural & Scientific Explanation:'
                              : lang === 'zh'
                              ? '建筑与科学原理解析：'
                              : 'Giải thích khoa học & kiến trúc:'}
                          </strong>
                          {locExplanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 flex flex-wrap items-center justify-between gap-4 border-t border-[#171817]/18">
                <div className="text-xs text-[#171817]/75">
                  {user ? (
                    lang === 'en' ? (
                      <>
                        Complete all 5 questions to claim a Digital EdTech Certificate for{' '}
                        <strong className="text-[#171817]">{user.displayName}</strong>
                      </>
                    ) : lang === 'zh' ? (
                      <>
                        完成 5 道测验题即可为 <strong className="text-[#171817]">{user.displayName}</strong> 领取数字教材证书
                      </>
                    ) : (
                      <>
                        Hoàn thành 5 câu hỏi để nhận Chứng nhận Học liệu Số cho{' '}
                        <strong className="text-[#171817]">{user.displayName}</strong>
                      </>
                    )
                  ) : lang === 'en' ? (
                    'Please sign in to save your Digital EdTech Certificate to your account'
                  ) : lang === 'zh' ? (
                    '请登录以将数字教材证书保存至您的个人账户'
                  ) : (
                    'Vui lòng đăng nhập để lưu Chứng nhận Học liệu Số vào tài khoản của bạn'
                  )}
                </div>
                {!user ? (
                  <button
                    type="button"
                    onClick={() => openAuthModal({ prompt: lang === 'en' ? 'Claim EdTech Certificate' : lang === 'zh' ? '领取数字教材证书' : 'Nhận chứng nhận Học liệu Số' })}
                    className="px-6 py-3 rounded-sm bg-[#171817] hover:bg-[#A94F3D] text-[#D8C9A9] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>
                      {lang === 'en' ? 'Sign In to Claim Certificate' : lang === 'zh' ? '登录以领取证书' : 'Đăng nhập để nhận chứng nhận'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setQuizSubmitted(true);
                      const certPass = recordIssuedPass({
                        code: `CERT-DNB-2026-${quizScore}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
                        kind: 'edtech_cert',
                        ownerUserId: user.userId,
                        ownerEmail: user.email || undefined,
                        ownerName: user.displayName,
                        ownerContactMasked: maskEmailForDisplay(user.email || user.displayName),
                        provider: user.provider,
                        label: 'Chứng nhận Học liệu Số 3D',
                        amountLabel: 'Miễn phí · EdTech',
                        score: quizScore,
                      });
                      setCertPassId(certPass.id);
                      refreshEntitlements();
                    }}
                    className="px-6 py-3 rounded-sm bg-[#A94F3D] hover:bg-[#8E3F30] text-[#D8C9A9] text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Award className="w-4 h-4" />
                    <span>
                      {lang === 'en' ? 'Grade & Claim Certificate' : lang === 'zh' ? '评分并领取证书' : 'Chấm điểm & nhận chứng nhận'}
                    </span>
                  </button>
                )}
              </div>

              {quizSubmitted && (
                <div className="mt-4 rounded-sm border border-[#C9A46A] bg-[#E4D7BC] p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#171817]/18 pb-3.5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-[#A94F3D]">
                          {lang === 'en'
                            ? 'Southeast Vietnam Digital EdTech Certificate'
                            : lang === 'zh'
                            ? '东南部数字教材学习认证证书'
                            : 'Chứng nhận Học liệu Số Đông Nam Bộ'}
                        </span>
                        {currentCertRecord && (
                          <span
                            className={`px-2 py-0.5 rounded-sm border text-[11px] font-medium ${
                              currentCertRecord.status === 'verified'
                                ? 'bg-[#47796D]/15 border-[#47796D]/40 text-[#47796D]'
                                : currentCertRecord.status === 'revoked'
                                ? 'bg-[#A94F3D]/15 border-[#A94F3D]/40 text-[#A94F3D]'
                                : 'bg-[#D8C9A9] border-[#171817]/20 text-[#171817]'
                            }`}
                          >
                            {currentCertRecord.status === 'verified'
                              ? lang === 'en'
                                ? '✓ Admin Verified'
                                : lang === 'zh'
                                ? '✓ 管理员已核验'
                                : '✓ Admin Đã Xác Thực'
                              : currentCertRecord.status === 'revoked'
                              ? lang === 'en'
                                ? '✕ Revoked'
                                : lang === 'zh'
                                ? '✕ 已吊销'
                                : '✕ Đã Thu Hồi'
                              : lang === 'en'
                              ? 'Active'
                              : lang === 'zh'
                              ? '有效'
                              : 'Đang Hiệu Lực'}
                          </span>
                        )}
                      </div>
                      <h4 className="font-serif text-lg sm:text-xl font-semibold text-[#171817] mt-1">
                        {lang === 'en' ? 'Awarded to: ' : lang === 'zh' ? '授予：' : 'Cấp cho: '}
                        <span className="text-[#A94F3D]">{user?.displayName || buyerName}</span>
                      </h4>
                      {user && (
                        <p className="text-[11px] text-[#171817]/70 mt-0.5 tabular-nums">
                          {user.provider === 'google' ? 'Google' : 'Facebook'}
                          {user.email ? ` · ${user.email}` : ''} ·{' '}
                          {isAdmin
                            ? lang === 'en'
                              ? 'Administrator'
                              : lang === 'zh'
                              ? '管理员'
                              : 'Quản trị viên'
                            : lang === 'en'
                            ? 'Visitor'
                            : lang === 'zh'
                            ? '访客'
                            : 'Du khách'}
                        </p>
                      )}
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <div className="text-[12px] font-medium text-[#171817]/70">
                        {lang === 'en' ? 'Assessment Score' : lang === 'zh' ? '测评成绩' : 'Kết quả đánh giá'}
                      </div>
                      <div className="font-serif text-2xl font-semibold text-[#A94F3D] tabular-nums">
                        {quizScore} / 100 {lang === 'en' ? 'pts' : lang === 'zh' ? '分' : 'điểm'}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#171817]/75">
                    <span>
                      {lang === 'en' ? 'Certificate ID: ' : lang === 'zh' ? '证书编号：' : 'Mã chứng nhận: '}
                      <strong className="text-[#171817] tabular-nums">{currentCertRecord?.code || `CERT-DNB-2026-${quizScore}`}</strong> · Dấu Ấn Việt 3D
                    </span>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3.5 py-1.5 rounded-sm bg-[#171817] hover:bg-[#A94F3D] text-[#D8C9A9] text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#C9A46A]" />
                      <span>{lang === 'en' ? 'Print Certificate' : lang === 'zh' ? '打印证书' : 'In chứng nhận'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* THỬ THÁCH KIẾN THỨC DI SẢN — NGÂN HÀNG CÂU HỎI CHUYÊN ĐỀ DO ADMIN XUẤT BẢN */}
          <div className="rounded-sm border border-[#171817]/20 bg-[#EDE3CE] p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#171817]/18 pb-4">
              <div>
                <span className="text-[13px] font-semibold text-[#A94F3D] block">
                  {lang === 'en'
                    ? 'Specialized EdTech Modules · Synced from Admin Studio'
                    : lang === 'zh'
                    ? '深度专题题库 · 同步自管理后台'
                    : 'Chuyên đề học liệu chuyên sâu · Đồng bộ từ Admin Studio'}
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#171817] tracking-tight mt-1">
                  {lang === 'en'
                    ? 'Heritage Knowledge Challenge'
                    : lang === 'zh'
                    ? '遗产知识专题挑战'
                    : 'Thử thách Kiến thức Di sản'}
                </h3>
                <p className="text-xs sm:text-sm text-[#171817]/75 mt-1">
                  {lang === 'en' ? (
                    <>Complete monument-specific quiz modules with <strong className="text-[#A94F3D]">80% or higher</strong> to earn a <strong className="text-[#171817]">Specialized Module Badge &amp; Certificate</strong>.</>
                  ) : lang === 'zh' ? (
                    <>完成各遗迹专项测验并达到 <strong className="text-[#A94F3D]">80% 及以上</strong>，即可获得 <strong className="text-[#171817]">专题徽章与完成证书</strong>。</>
                  ) : (
                    <>Hoàn thành bộ câu hỏi chuyên đề theo từng di tích đạt từ <strong className="text-[#A94F3D]">80% trở lên</strong> để nhận <strong className="text-[#171817]">Huy hiệu &amp; Chứng nhận Hoàn thành Chuyên đề</strong>.</>
                  )}
                </p>
              </div>
              <span className="px-3 py-1 rounded-sm bg-[#E4D7BC] border border-[#171817]/25 text-[12px] font-semibold text-[#171817] shrink-0 tabular-nums">
                {visiblePublishedTopics.length}{' '}
                {lang === 'en' ? 'modules open' : lang === 'zh' ? '个开放专题' : 'chuyên đề đang mở'}
              </span>
            </div>

            {visiblePublishedTopics.length === 0 ? (
              <div className="p-6 rounded-sm bg-[#D8C9A9]/75 border border-[#171817]/18 text-center space-y-2">
                <GraduationCap className="w-8 h-8 text-[#A94F3D] mx-auto" />
                <div className="text-sm font-medium text-[#171817]">
                  {lang === 'en'
                    ? 'No monument-specific quiz modules published yet'
                    : lang === 'zh'
                    ? '暂未发布按遗迹分类的专项测验题库'
                    : 'Chưa có chuyên đề trắc nghiệm riêng theo di tích nào được xuất bản'}
                </div>
                <p className="text-xs text-[#171817]/75 max-w-lg mx-auto">
                  {lang === 'en'
                    ? 'Administrators can generate 3-question modules with the AI Curator in Admin Studio and publish them directly here.'
                    : lang === 'zh'
                    ? '管理员可在管理后台使用 AI 策展人生成 3 道深度题目并直接发布至此。'
                    : 'Quản trị viên có thể tạo bộ 3 câu hỏi chuyên sâu bằng Trợ lý Giám tuyển AI trong Admin Studio và xuất bản trực tiếp tại đây.'}
                </p>
              </div>
            ) : (
              selectedTopic && (() => {
                const topicSiteObj = sites.find((s) => s.id === selectedTopic.siteId);
                const topicDisplayName = topicSiteObj
                  ? getLocalizedSite(topicSiteObj).officialName
                  : selectedTopic.siteName;
                const currentTopicAnswers = topicAnswers[selectedTopic.siteId] || {};
                const isTopicSubmitted = Boolean(topicSubmittedMap[selectedTopic.siteId]);
                const totalQs = selectedTopic.questions.length;
                const correctCount = selectedTopic.questions.filter(
                  (q) => currentTopicAnswers[q.id] === q.correctIndex
                ).length;
                const scorePct = totalQs > 0 ? Math.round((correctCount / totalQs) * 100) : 0;
                const topicCertRecord = passesSnapshot.find(
                  (p) => p.id === topicCertIds[selectedTopic.siteId]
                );

                return (
                  <div className="space-y-6">
                    {/* Selector Tabs cho các chuyên đề đã xuất bản */}
                    <div className="flex flex-wrap items-center gap-2">
                      {visiblePublishedTopics.map((topic) => {
                        const isActive = topic.siteId === selectedTopic.siteId;
                        const isTopicHidden =
                          hiddenSiteIds.includes(topic.siteId) || Boolean(topic.isHidden);
                        const sObj = sites.find((s) => s.id === topic.siteId);
                        const label = sObj ? getLocalizedSite(sObj).officialName : topic.siteName;
                        return (
                          <button
                            key={topic.siteId}
                            type="button"
                            onClick={() => setActiveTopicSiteId(topic.siteId)}
                            className={`px-3.5 py-2 rounded-sm text-xs font-medium border transition-colors cursor-pointer inline-flex items-center gap-2 ${
                              isActive
                                ? 'bg-[#171817] border-[#171817] text-[#D8C9A9] font-semibold'
                                : 'bg-[#D8C9A9] border-[#171817]/20 text-[#171817] hover:border-[#171817]/45'
                            }`}
                          >
                            <span>{label}</span>
                            <span
                              className={`text-[11px] tabular-nums ${
                                isActive ? 'text-[#C9A46A]' : 'text-[#A94F3D]'
                              }`}
                            >
                              ({topic.questions.length} {lang === 'en' ? 'Q' : lang === 'zh' ? '题' : 'câu'})
                            </span>
                            {isTopicHidden && canPreviewHidden && (
                              <span className="px-1.5 py-0.5 rounded-sm bg-[#171817] border border-[#C9A46A] text-[#C9A46A] text-[9.5px] font-semibold">
                                {lang === 'en'
                                  ? 'Tester Preview · Hidden'
                                  : lang === 'zh'
                                  ? '隐藏草稿 · 测试模式'
                                  : 'Đang ẩn · Chế độ Tester'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Danh sách câu hỏi chuyên đề */}
                    <div className="space-y-4">
                      {selectedTopic.questions.map((q, qIdx) => {
                        const chosen = currentTopicAnswers[q.id];
                        const isAnswered = chosen !== undefined;
                        const isCorrect = chosen === q.correctIndex;
                        return (
                          <div
                            key={q.id}
                            className="p-5 rounded-sm bg-[#D8C9A9]/70 border border-[#171817]/18 space-y-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12px] font-semibold text-[#A94F3D] tabular-nums">
                                {lang === 'en'
                                  ? `Module ${topicDisplayName} · Q${qIdx + 1}/${totalQs}`
                                  : lang === 'zh'
                                  ? `专题 ${topicDisplayName} · 第 ${qIdx + 1}/${totalQs} 题`
                                  : `Chuyên đề ${topicDisplayName} · Câu ${qIdx + 1}/${totalQs}`}
                              </span>
                              {isAnswered && (
                                <span
                                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-sm border ${
                                    isCorrect
                                      ? 'text-[#47796D] bg-[#47796D]/12 border-[#47796D]/40'
                                      : 'text-[#A94F3D] bg-[#A94F3D]/12 border-[#A94F3D]/40'
                                  }`}
                                >
                                  {isCorrect
                                    ? lang === 'en'
                                      ? '✓ Correct'
                                      : lang === 'zh'
                                      ? '✓ 正确'
                                      : '✓ Chính xác'
                                    : lang === 'en'
                                    ? '✕ Incorrect'
                                    : lang === 'zh'
                                    ? '✕ 不正确'
                                    : '✕ Chưa chính xác'}
                                </span>
                              )}
                            </div>

                            <h4 className="text-sm sm:text-base font-medium text-[#171817] leading-snug">
                              {q.question}
                            </h4>

                            <div className="grid grid-cols-1 gap-2">
                              {q.options.map((opt, oIdx) => {
                                const isThisSelected = chosen === oIdx;
                                const showCorrect =
                                  (isTopicSubmitted || isAnswered) && oIdx === q.correctIndex;
                                const showWrong = isThisSelected && oIdx !== q.correctIndex;
                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    onClick={() =>
                                      setTopicAnswers((prev) => ({
                                        ...prev,
                                        [selectedTopic.siteId]: {
                                          ...(prev[selectedTopic.siteId] || {}),
                                          [q.id]: oIdx,
                                        },
                                      }))
                                    }
                                    className={`w-full text-left px-4 py-2.5 rounded-sm border text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                                      showCorrect
                                        ? 'border-[#47796D] bg-[#47796D]/15 text-[#171817] font-semibold'
                                        : showWrong
                                        ? 'border-[#A94F3D] bg-[#A94F3D]/15 text-[#A94F3D] font-medium'
                                        : isThisSelected
                                        ? 'border-[#526D8B] bg-[#526D8B]/15 text-[#171817]'
                                        : 'border-[#171817]/18 bg-[#F4EFE4]/70 text-[#171817]/90 hover:border-[#171817]/40'
                                    }`}
                                  >
                                    <span>{opt}</span>
                                    {showCorrect && <Check className="w-4 h-4 text-[#47796D] shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>

                            {(isAnswered || isTopicSubmitted) && q.explanation && (
                              <div className="p-3.5 rounded-sm bg-[#E4D7BC] border border-[#C9A46A]/80 text-xs text-[#171817]/90 leading-relaxed">
                                <strong className="text-[#A94F3D] font-semibold block mb-0.5">
                                  {lang === 'en' ? 'Archival Note:' : lang === 'zh' ? '文献解析：' : 'Giải thích tư liệu:'}
                                </strong>
                                {q.explanation}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Nút nộp bài chuyên đề */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#171817]/18">
                      <div className="text-xs text-[#171817]/75">
                        {lang === 'en' ? 'Answered ' : lang === 'zh' ? '已作答 ' : 'Đã trả lời '}
                        <strong className="text-[#A94F3D] tabular-nums">
                          {Object.keys(currentTopicAnswers).length}/{totalQs}
                        </strong>{' '}
                        {lang === 'en' ? 'in ' : lang === 'zh' ? '题 · ' : 'câu chuyên đề '}
                        <strong className="text-[#171817]">{topicDisplayName}</strong>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setTopicAnswers((prev) => ({
                              ...prev,
                              [selectedTopic.siteId]: {},
                            }));
                            setTopicSubmittedMap((prev) => ({
                              ...prev,
                              [selectedTopic.siteId]: false,
                            }));
                          }}
                          className="px-3.5 py-2 rounded-sm bg-[#D8C9A9] hover:bg-[#E4D7BC] border border-[#171817]/25 text-xs text-[#171817] cursor-pointer transition-colors"
                        >
                          {lang === 'en' ? 'Reset' : lang === 'zh' ? '重做' : 'Làm lại'}
                        </button>
                        {!user ? (
                          <button
                            type="button"
                            onClick={() =>
                              openAuthModal({
                                prompt: lang === 'en' ? 'Claim Module Badge & Certificate' : lang === 'zh' ? '领取专题徽章与证书' : 'Nhận Huy hiệu & Chứng nhận Hoàn thành Chuyên đề',
                              })
                            }
                            className="px-5 py-2.5 rounded-sm bg-[#171817] hover:bg-[#A94F3D] text-[#D8C9A9] text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>
                              {lang === 'en' ? 'Sign In to Grade Module' : lang === 'zh' ? '登录以评分' : 'Đăng nhập để chấm điểm chuyên đề'}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setTopicSubmittedMap((prev) => ({
                                ...prev,
                                [selectedTopic.siteId]: true,
                              }));
                              if (scorePct >= 80 && !topicCertIds[selectedTopic.siteId]) {
                                const issued = recordIssuedPass({
                                  code: `BADGE-${selectedTopic.siteId}-${scorePct}-${Math.random()
                                    .toString(36)
                                    .slice(2, 5)
                                    .toUpperCase()}`,
                                  kind: 'edtech_cert',
                                  ownerUserId: user.userId,
                                  ownerEmail: user.email || undefined,
                                  ownerName: user.displayName,
                                  ownerContactMasked: maskEmailForDisplay(
                                    user.email || user.displayName
                                  ),
                                  provider: user.provider,
                                  label: `Huy hiệu & Chứng nhận Hoàn thành Chuyên đề · ${topicDisplayName}`,
                                  routeTitle: `Chuyên đề ${topicDisplayName}`,
                                  amountLabel: 'Huy hiệu Chuyên đề · Miễn phí',
                                  score: scorePct,
                                });
                                setTopicCertIds((prev) => ({
                                  ...prev,
                                  [selectedTopic.siteId]: issued.id,
                                }));
                                refreshEntitlements();
                              }
                            }}
                            className="px-5 py-2.5 rounded-sm bg-[#A94F3D] hover:bg-[#8E3F30] text-[#D8C9A9] text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Award className="w-4 h-4" />
                            <span>
                              {lang === 'en' ? 'Grade Module' : lang === 'zh' ? '提交专题评分' : 'Chấm điểm chuyên đề'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Huy hiệu & Chứng nhận Hoàn thành Chuyên đề (>= 80%) */}
                    {isTopicSubmitted && (
                      <div
                        className={`rounded-sm border p-5 space-y-3 ${
                          scorePct >= 80
                            ? 'border-[#47796D] bg-[#E4D7BC]'
                            : 'border-[#171817]/20 bg-[#D8C9A9]/75'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <span
                              className={`text-[13px] font-semibold block ${
                                scorePct >= 80 ? 'text-[#47796D]' : 'text-[#A94F3D]'
                              }`}
                            >
                              {scorePct >= 80
                                ? lang === 'en'
                                  ? '★ Module Completion Badge & Certificate'
                                  : lang === 'zh'
                                  ? '★ 专题完成徽章与认证证书'
                                  : '★ Huy hiệu & Chứng nhận Hoàn thành Chuyên đề'
                                : lang === 'en'
                                ? 'Module Result (80% required for badge)'
                                : lang === 'zh'
                                ? '专题成绩（需达到 ≥ 80% 方可获得徽章）'
                                : 'Kết quả chuyên đề (Cần đạt ≥ 80% để cấp huy hiệu)'}
                            </span>
                            <h4 className="font-serif text-lg font-semibold text-[#171817] mt-1">
                              {scorePct >= 80
                                ? lang === 'en'
                                  ? `Congratulations ${user?.displayName || 'Visitor'} on scoring ${scorePct}% (${correctCount}/${totalQs})!`
                                  : lang === 'zh'
                                  ? `恭喜 ${user?.displayName || '访客'} 获得 ${scorePct}%（${correctCount}/${totalQs} 题）！`
                                  : `Chúc mừng ${user?.displayName || 'Du khách'} đã đạt ${scorePct}% (${correctCount}/${totalQs} câu)!`
                                : lang === 'en'
                                ? `You scored ${scorePct}% (${correctCount}/${totalQs}) — Review and retry to reach ≥ 80%.`
                                : lang === 'zh'
                                ? `您的得分为 ${scorePct}%（${correctCount}/${totalQs} 题）— 请复习后重试以达到 ≥ 80%。`
                                : `Bạn đạt ${scorePct}% (${correctCount}/${totalQs} câu) — Hãy ôn tập và thử lại để đạt ≥ 80%.`}
                            </h4>
                            {topicCertRecord && (
                              <p className="text-xs text-[#171817]/75 mt-1 tabular-nums">
                                {lang === 'en' ? 'Certificate ID: ' : lang === 'zh' ? '证书编号：' : 'Mã chứng nhận: '}
                                <strong className="text-[#A94F3D]">{topicCertRecord.code}</strong>
                              </p>
                            )}
                          </div>
                          {scorePct >= 80 && (
                            <button
                              type="button"
                              onClick={() => window.print()}
                              className="px-4 py-2 rounded-sm bg-[#171817] hover:bg-[#A94F3D] text-[#D8C9A9] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>
                                {lang === 'en' ? 'Print Certificate' : lang === 'zh' ? '打印证书' : 'In chứng nhận chuyên đề'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </section>
        )}

        {/* =====================================================================
            KHU VỰC 4 — THẺ MỜI ĐÁNH GIÁ TRẢI NGHIỆM SAU THAM QUAN
           ===================================================================== */}
        <section className="rounded-sm border border-[#171817]/20 bg-[#EDE3CE] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#A94F3D]">
              <MessageSquareHeart className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'en'
                  ? 'Visitor Experience Feedback · Synced with Curatorial Board'
                  : lang === 'zh'
                  ? '访客体验评价 · 实时同步管理委员会'
                  : 'Đánh giá trải nghiệm du khách · Đồng bộ Ban Quản lý'}
              </span>
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#171817] tracking-tight">
              {lang === 'en'
                ? 'Rate Your Dấu Ấn Việt 3D Museum & EdTech Experience'
                : lang === 'zh'
                ? '评价您在 Dấu Ấn Việt 3D 数字博物馆的参观与教材体验'
                : 'Đánh giá trải nghiệm tham quan & học liệu Dấu Ấn Việt 3D'}
            </h3>
            <p className="text-xs sm:text-sm text-[#171817]/80 leading-relaxed">
              {lang === 'en'
                ? 'Your feedback on 3D X-Ray models, the 1815 historical map, documentary videos, and multilingual narration is sent directly to Admin Studio to improve the digital museum.'
                : lang === 'zh'
                ? '您对 3D X光模型、1815 古地图、纪录片视频及多语种导览的任何建议都将直接同步至管理后台，助力提升数字博物馆品质。'
                : 'Mọi góp ý về mô hình 3D X-Ray, bản đồ cổ 1815, video Flycam và thuyết minh đa ngôn ngữ của bạn được ghi nhận trực tiếp về Admin Studio để nâng cao chất lượng bảo tàng số.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!user) {
                openAuthModal({
                  prompt: lang === 'en' ? 'Rate Experience' : lang === 'zh' ? '评价体验' : 'Đánh giá trải nghiệm',
                  onSuccess: () => onOpenFeedback && onOpenFeedback(),
                });
              } else if (onOpenFeedback) {
                onOpenFeedback();
              }
            }}
            className="px-6 py-3.5 rounded-sm bg-[#171817] hover:bg-[#A94F3D] text-[#D8C9A9] text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0 self-start md:self-auto"
          >
            {!user ? <Lock className="w-3.5 h-3.5 shrink-0" /> : <Star className="w-4 h-4 fill-[#C9A46A] text-[#C9A46A] shrink-0" />}
            <span>
              {lang === 'en' ? 'Rate Experience' : lang === 'zh' ? '评价体验' : 'Đánh giá trải nghiệm'}
            </span>
          </button>
        </section>
      </div>

      {/* =====================================================================
          MODAL 1: THANH TOÁN VIETQR / MOMO GIẢ LẬP & CẤP VÉ ĐIỆN TỬ QR VIP
         ===================================================================== */}
      {isPaymentModalOpen && user && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#171817]/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsPaymentModalOpen(false)}
        >
          <div
            className="relative w-[94vw] sm:w-full max-w-2xl max-h-[88dvh] overflow-y-auto modal-scrollbar rounded-sm bg-[#D8C9A9] border border-[#171817]/25 p-5 sm:p-8 text-[#171817] space-y-6 animate-apple-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#171817]/18 pb-4">
              <div>
                <span className="text-[13px] font-semibold text-[#A94F3D] block">
                  {ticketIssued
                    ? lang === 'en'
                      ? 'Digital Heritage Passport & QR E-Ticket Issued'
                      : lang === 'zh'
                      ? '数字遗产护照与二维码电子票已签发'
                      : 'Hộ chiếu Di sản Số & Vé điện tử QR đã phát hành'
                    : lang === 'en'
                    ? 'Instant Checkout via VietQR / MoMo'
                    : lang === 'zh'
                    ? 'VietQR / MoMo 快捷支付'
                    : 'Thanh toán nhanh VietQR / Ví MoMo'}
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-[#171817] mt-1">
                  {ticketIssued
                    ? lang === 'en'
                      ? 'QR E-Ticket & Digital Heritage Passport'
                      : lang === 'zh'
                      ? '二维码电子票与数字遗产护照'
                      : 'Vé Điện Tử QR & Hộ Chiếu Di Sản Số'
                    : lang === 'en'
                    ? 'VietQR / MoMo Payment Gateway'
                    : lang === 'zh'
                    ? 'VietQR / MoMo 支付网关'
                    : 'Cổng Thanh Toán VietQR / MoMo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-8 h-8 rounded-sm bg-[#EDE3CE] hover:bg-[#171817] border border-[#171817]/20 text-[#171817] hover:text-[#D8C9A9] flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!ticketIssued ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                  {/* Khung QR thanh toán */}
                  <div className="sm:col-span-5 rounded-sm bg-[#EDE3CE] border border-[#171817]/20 p-4 flex flex-col items-center text-center space-y-3">
                    <div className="flex items-center gap-1.5 w-full bg-[#D8C9A9] border border-[#171817]/18 p-1 rounded-sm">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('vietqr')}
                        className={`flex-1 py-1.5 rounded-sm text-[10px] font-semibold transition-colors cursor-pointer ${
                          paymentMethod === 'vietqr'
                            ? 'bg-[#171817] text-[#D8C9A9]'
                            : 'text-[#171817]/70 hover:text-[#171817]'
                        }`}
                      >
                        VietQR Napas
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('momo')}
                        className={`flex-1 py-1.5 rounded-sm text-[10px] font-semibold transition-colors cursor-pointer ${
                          paymentMethod === 'momo'
                            ? 'bg-[#171817] text-[#D8C9A9]'
                            : 'text-[#171817]/70 hover:text-[#171817]'
                        }`}
                      >
                        MoMo Wallet
                      </button>
                    </div>

                    <div className="w-40 h-40 rounded-sm bg-[#F4EFE4] p-2.5 border-2 border-[#C9A46A] flex items-center justify-center overflow-hidden">
                      {checkoutQrDataUrl ? (
                        <img
                          src={checkoutQrDataUrl}
                          alt="QR Checkout"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <QrCode className="w-20 h-20 text-[#171817]" />
                      )}
                    </div>

                    <div className="text-[12px] font-semibold text-[#A94F3D]">
                      {paymentMethod === 'vietqr'
                        ? 'VietQR · Dấu Ấn Việt 3D'
                        : 'MoMo · Dấu Ấn Việt 3D'}
                    </div>
                  </div>

                  {/* Thông tin đơn hàng (Đã khóa theo tài khoản đã xác thực) */}
                  <div className="sm:col-span-7 space-y-3.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="block text-[12px] font-medium text-[#171817]/75">
                          {lang === 'en'
                            ? 'Pass Holder Name (Locked to account):'
                            : lang === 'zh'
                            ? '持票人姓名（已绑定账户）：'
                            : 'Họ tên chủ vé (Đã khóa theo tài khoản):'}
                        </label>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#47796D]">
                          <Lock className="w-3 h-3" />
                          <span>{lang === 'en' ? 'Verified' : lang === 'zh' ? '已认证' : 'Đã xác thực'}</span>
                        </span>
                      </div>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={user.displayName}
                        className="w-full px-3.5 py-2.5 rounded-sm bg-[#F4EFE4] border border-[#171817]/25 text-xs sm:text-sm text-[#171817] cursor-not-allowed opacity-90"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[12px] font-medium text-[#171817]/75">
                        {lang === 'en'
                          ? 'Authenticated Account:'
                          : lang === 'zh'
                          ? '认证账户：'
                          : 'Tài khoản Google / Facebook định danh:'}
                      </label>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={authenticatedAccountLabel}
                        className="w-full px-3.5 py-2.5 rounded-sm bg-[#F4EFE4] border border-[#171817]/25 text-xs text-[#171817]/80 cursor-not-allowed opacity-90"
                      />
                    </div>

                    <div className="p-4 rounded-sm bg-[#EDE3CE] border border-[#171817]/20 space-y-2 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="text-[#171817]/70 shrink-0">
                          {lang === 'en' ? 'Selected Plan:' : lang === 'zh' ? '所选套餐：' : 'Gói dịch vụ:'}
                        </span>
                        <span className="font-semibold text-[#171817] text-right">
                          {b2cPlanType === 'vip_49k'
                            ? lang === 'en'
                              ? 'All-Region VIP (17 Monuments)'
                              : lang === 'zh'
                              ? '三省市全区域 VIP（17处遗迹）'
                              : 'VIP Toàn Vùng 3 Tỉnh (17 Di tích)'
                            : getLocalizedTour(selectedRouteObj).title}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-[#171817]/70 shrink-0">
                          {lang === 'en' ? 'Included Benefits:' : lang === 'zh' ? '包含权益：' : 'Quyền lợi đi kèm:'}
                        </span>
                        <span className="text-[#47796D] font-semibold text-right">3D X-Ray + Audio VI/EN/ZH + QR</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-[#171817]/18 text-sm">
                        <span className="text-[#171817] font-semibold">
                          {lang === 'en' ? 'Total Amount:' : lang === 'zh' ? '应付总额：' : 'Tổng thanh toán:'}
                        </span>
                        <span className="font-serif text-xl text-[#A94F3D] font-semibold tabular-nums">
                          {b2cPlanType === 'vip_49k' ? '49.000 VNĐ' : '19.000 VNĐ'}
                        </span>
                      </div>
                    </div>

                    {ticketSpamError && (
                      <div className="rounded-sm bg-[#A94F3D]/15 border border-[#A94F3D]/50 px-3.5 py-2.5 text-xs text-[#A94F3D] font-medium">
                        {ticketSpamError}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setTicketSpamError(null);
                        const rate = checkAndRecordSubmissionRate(
                          'ticket',
                          authenticatedAccountLabel || user.displayName
                        );
                        if (!rate.allowed) {
                          setTicketSpamError(
                            rate.threatLevel === 2
                              ? `CẢNH BÁO AN NINH MỨC 2: Phát hiện thao tác tạo vé ồ ạt bất thường. Trợ lý AI đã kích hoạt Lá chắn Bảo vệ toàn trang & gửi email khẩn cấp về Quản trị viên (${rate.retryAfterSec} giây).`
                              : `Lá chắn AI Mức 1: Phát hiện tạo vé liên tiếp quá nhanh. AI đã tạm khóa 60 giây (${rate.retryAfterSec}s) & gửi báo cáo về Quản trị viên.`
                          );
                          return;
                        }
                        const randSuffix = Math.random().toString(36).slice(2, 5).toUpperCase();
                        const uniqueCode =
                          b2cPlanType === 'vip_49k'
                            ? `VIP-3D-${Date.now().toString().slice(-4)}-${randSuffix}`
                            : `RTE-3D-${Date.now().toString().slice(-4)}-${randSuffix}`;
                        const routeTitle =
                          b2cPlanType === 'vip_49k'
                            ? `Vé VIP Toàn Vùng Đông Nam Bộ (17 Di tích · ${TOUR_ROUTES.length} Tuyến)`
                            : getLocalizedTour(selectedRouteObj).title;
                        const issued = recordIssuedPass({
                          code: uniqueCode,
                          kind: b2cPlanType === 'vip_49k' ? 'vip_ticket' : 'route_ticket',
                          ownerUserId: user.userId,
                          ownerEmail: user.email || undefined,
                          ownerName: user.displayName,
                          ownerContactMasked: maskEmailForDisplay(user.email || user.displayName),
                          provider: user.provider,
                          routeId: b2cPlanType === 'route_19k' ? selectedRouteObj.id : undefined,
                          routeTitle,
                          label:
                            b2cPlanType === 'vip_49k'
                              ? 'Vé VIP Toàn Vùng (17 Di tích)'
                              : 'Vé Tuyến Chuyên Đề 3D',
                          amountLabel: isTesterPro
                            ? 'Miễn phí · Tester Pro'
                            : b2cPlanType === 'vip_49k'
                            ? '49.000 VNĐ'
                            : '19.000 VNĐ',
                        });
                        setUserSubscriptionTier(user.userId, user.email || undefined, b2cPlanType);
                        setTicketPassId(issued.id);
                        setTicketIssued(true);
                        refreshEntitlements();
                      }}
                      className="w-full py-3.5 px-5 rounded-sm bg-[#A94F3D] hover:bg-[#8E3F30] text-[#D8C9A9] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {lang === 'en'
                          ? 'Confirm Payment & Issue Personal QR Pass'
                          : lang === 'zh'
                          ? '确认支付并生成专属二维码门票'
                          : 'Xác nhận thanh toán & Tạo mã vé QR riêng'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* TẤM VÉ ĐIỆN TỬ QR ĐỊNH DANH RIÊNG */
              <div className="space-y-6">
                <div className="rounded-sm border border-[#C9A46A] bg-[#EDE3CE] p-6 relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#171817]/18 pb-4">
                    <div className="min-w-0">
                      <span
                        className={`px-3 py-1 rounded-sm border text-[11px] font-semibold ${
                          currentTicketRecord?.status === 'revoked'
                            ? 'bg-[#A94F3D]/15 border-[#A94F3D]/40 text-[#A94F3D]'
                            : currentTicketRecord?.status === 'verified'
                            ? 'bg-[#47796D]/15 border-[#47796D]/40 text-[#47796D]'
                            : 'bg-[#C9A46A]/25 border-[#C9A46A] text-[#171817]'
                        }`}
                      >
                        {currentTicketRecord?.status === 'revoked'
                          ? lang === 'en'
                            ? '✕ Ticket Revoked by Administrator'
                            : lang === 'zh'
                            ? '✕ 门票已被管理员吊销'
                            : '✕ Vé đã bị Quản trị viên thu hồi'
                          : currentTicketRecord?.status === 'verified'
                          ? lang === 'en'
                            ? '✓ VIP Pass · Admin Verified'
                            : lang === 'zh'
                            ? '✓ VIP 通行证 · 管理员已核验'
                            : '✓ Vé VIP · Admin đã xác thực'
                          : lang === 'en'
                          ? 'Digital Heritage Pass · Synced with Admin Studio'
                          : lang === 'zh'
                          ? '数字遗产通行证 · 已同步至管理后台'
                          : 'Vé Di sản Số · Đã đồng bộ Admin Studio'}
                      </span>
                      <h4 className="font-serif text-xl sm:text-2xl font-semibold text-[#171817] mt-2">
                        {currentTicketRecord?.routeTitle ||
                          (b2cPlanType === 'vip_49k'
                            ? lang === 'en'
                              ? 'All-Region Southeast Vietnam VIP Pass (HCMC – Binh Duong – BRVT)'
                              : lang === 'zh'
                              ? '东南部三省市全区域 VIP 通行证'
                              : 'Vé VIP Toàn Vùng Đông Nam Bộ (TP.HCM – Bình Dương – BRVT)'
                            : lang === 'en'
                            ? '3D Heritage Route & Audio Guide Pass'
                            : lang === 'zh'
                            ? '3D 遗产路线与语音导览门票'
                            : 'Vé Trải Nghiệm Tuyến Di Sản 3D & Thuyết Minh')}
                      </h4>
                      <p className="text-xs text-[#171817]/75 mt-1">
                        {lang === 'en' ? 'Holder: ' : lang === 'zh' ? '持票人：' : 'Chủ vé: '}
                        <strong className="text-[#171817]">{currentTicketRecord?.ownerName || user.displayName}</strong> ·{' '}
                        <span>{authenticatedAccountLabel}</span>
                      </p>
                    </div>

                    <div className="w-28 h-28 rounded-sm bg-[#F4EFE4] p-2 border-2 border-[#C9A46A] shrink-0 flex items-center justify-center overflow-hidden">
                      {issuedTicketQrDataUrl ? (
                        <img
                          src={issuedTicketQrDataUrl}
                          alt={`QR ${currentTicketRecord?.code || ''}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <QrCode className="w-16 h-16 text-[#171817]" />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-[#171817]/18 text-xs">
                    <div>
                      <span className="block text-[12px] font-medium text-[#171817]/70">
                        {lang === 'en' ? 'Personal QR Code' : lang === 'zh' ? '专属二维码编号' : 'Mã vé QR định danh'}
                      </span>
                      <span className="text-sm text-[#A94F3D] font-bold mt-0.5 block tabular-nums">
                        {currentTicketRecord?.code || 'VIP-3D-SYNCED'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[12px] font-medium text-[#171817]/70">
                        {lang === 'en' ? 'X-Ray Anatomy' : lang === 'zh' ? 'X光解剖模式' : 'Giải phẫu X-Ray'}
                      </span>
                      <span className="text-[#171817] font-semibold mt-0.5 block">
                        {lang === 'en' ? '100% Unlocked' : lang === 'zh' ? '100% 已解锁' : 'Mở khóa 100%'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[12px] font-medium text-[#171817]/70">
                        {lang === 'en' ? 'Audio Guide' : lang === 'zh' ? '多语种导览' : 'Thuyết minh đa ngữ'}
                      </span>
                      <span className="text-[#171817] font-semibold mt-0.5 block">
                        {lang === 'en' ? 'VI / EN / ZH Unlimited' : lang === 'zh' ? '越 / 英 / 中 无限制' : 'VI / EN / ZH Không giới hạn'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[12px] font-medium text-[#171817]/70">
                        {lang === 'en' ? 'Account Sync' : lang === 'zh' ? '账户同步' : 'Đồng bộ tài khoản'}
                      </span>
                      <span className="text-[#47796D] font-semibold mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{lang === 'en' ? 'Saved to Profile' : lang === 'zh' ? '已存入档案' : 'Đã lưu hồ sơ'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-[#171817]/75">
                      {lang === 'en' ? 'Digital Passport holds ' : lang === 'zh' ? '数字护照已收集 ' : 'Hộ chiếu số hiện có '}
                      <strong className="text-[#A94F3D] tabular-nums">
                        {unlockedStampCount}/{sites.length}
                      </strong>{' '}
                      {lang === 'en'
                        ? '3D Architectural Stamps.'
                        : lang === 'zh'
                        ? '枚 3D 建筑印章。'
                        : 'dấu mộc Giải mã Kiến trúc 3D Đông Nam Bộ.'}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {onOpenMyJourney && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsPaymentModalOpen(false);
                            onOpenMyJourney();
                          }}
                          className="px-4 py-2.5 rounded-sm bg-[#D8C9A9] hover:bg-[#E4D7BC] border border-[#171817]/25 text-[#171817] text-xs font-semibold cursor-pointer transition-colors"
                        >
                          {lang === 'en' ? 'My Passes & Journey' : lang === 'zh' ? '我的门票与行程' : 'Vé & Hành trình của tôi'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setIsPaymentModalOpen(false);
                          onStart3DVipExperience(
                            selectedRouteObj.sites[0] || 'HCM-DT-009',
                            selectedRouteObj.id
                          );
                        }}
                        className="px-5 py-2.5 rounded-sm bg-[#47796D] hover:bg-[#3A655B] text-[#D8C9A9] text-xs font-semibold cursor-pointer flex items-center gap-2 transition-colors"
                      >
                        <span>
                          {lang === 'en'
                            ? 'Enter 3D Space with QR Pass'
                            : lang === 'zh'
                            ? '持二维码门票进入 3D 空间'
                            : 'Vào Không gian 3D với Vé QR'}
                        </span>
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: ĐĂNG KÝ DÙNG THỬ HỌC LIỆU SỐ TRƯỜNG HỌC (B2B EDTECH FORM)
         ===================================================================== */}
      {isB2BModalOpen && user && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#171817]/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsB2BModalOpen(false)}
        >
          <div
            className="relative w-[94vw] sm:w-full max-w-xl max-h-[88dvh] overflow-y-auto modal-scrollbar rounded-sm bg-[#D8C9A9] border border-[#171817]/25 p-5 sm:p-8 text-[#171817] space-y-6 animate-apple-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#171817]/18 pb-4">
              <div>
                <span className="text-[13px] font-semibold text-[#526D8B] block">
                  {lang === 'en'
                    ? 'Institutional License · 5,000,000 VND / Year'
                    : lang === 'zh'
                    ? '学校机构授权 · 5,000,000 越盾 / 学年'
                    : 'Bản quyền Trường học · 5.000.000 VNĐ / Năm'}
                </span>
                <h3 className="font-serif text-2xl font-semibold tracking-tight text-[#171817] mt-1">
                  {lang === 'en'
                    ? 'Register 3D Digital EdTech License for Schools'
                    : lang === 'zh'
                    ? '申请学校 3D 数字教材版权授权'
                    : 'Đăng Ký Bản Quyền Học Liệu Số 3D Cho Trường Học'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsB2BModalOpen(false)}
                className="w-8 h-8 rounded-sm bg-[#EDE3CE] hover:bg-[#171817] border border-[#171817]/20 text-[#171817] hover:text-[#D8C9A9] flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!b2bSubmitted ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-[#171817]/75">
                    {lang === 'en'
                      ? 'Secondary / High School / Institution Name:'
                      : lang === 'zh'
                      ? '中学 / 教育机构名称：'
                      : 'Tên Trường THCS / THPT / Đơn vị giáo dục:'}
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-sm bg-[#F4EFE4] border border-[#171817]/25 text-xs sm:text-sm text-[#171817] focus:outline-none focus:border-[#526D8B]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-[#171817]/75">
                    {lang === 'en'
                      ? 'Department of Education / Province:'
                      : lang === 'zh'
                      ? '教育厅 / 所在省市：'
                      : 'Sở Giáo dục & Đào tạo / Tỉnh thành:'}
                  </label>
                  <input
                    type="text"
                    value={schoolProvince}
                    onChange={(e) => setSchoolProvince(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-sm bg-[#F4EFE4] border border-[#171817]/25 text-xs sm:text-sm text-[#171817] focus:outline-none focus:border-[#526D8B]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-[#171817]/75">
                    {lang === 'en'
                      ? 'Principal / History Department Email or Phone:'
                      : lang === 'zh'
                      ? '校领导或历史教研组联系邮箱 / 电话：'
                      : 'Email / Số điện thoại Ban Giám hiệu hoặc Tổ trưởng Tổ Lịch sử:'}
                  </label>
                  <input
                    type="text"
                    value={teacherContact}
                    onChange={(e) => setTeacherContact(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-sm bg-[#F4EFE4] border border-[#171817]/25 text-xs sm:text-sm text-[#171817] focus:outline-none focus:border-[#526D8B]"
                  />
                </div>

                {ticketSpamError && (
                  <div className="rounded-sm bg-[#A94F3D]/15 border border-[#A94F3D]/50 px-3.5 py-2.5 text-xs text-[#A94F3D] font-medium">
                    {ticketSpamError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setTicketSpamError(null);
                    const rate = checkAndRecordSubmissionRate(
                      'ticket',
                      authenticatedAccountLabel || user.displayName
                    );
                    if (!rate.allowed) {
                      setTicketSpamError(
                        rate.threatLevel === 2
                          ? `CẢNH BÁO AN NINH MỨC 2: Phát hiện đăng ký ồ ạt bất thường. Trợ lý AI đã kích hoạt Lá chắn Bảo vệ & gửi email khẩn cấp về Quản trị viên (${rate.retryAfterSec} giây).`
                          : `Lá chắn AI Mức 1: Phát hiện gửi liên tiếp quá nhanh. AI đã tạm khóa 60 giây (${rate.retryAfterSec}s) & gửi báo cáo về Quản trị viên.`
                      );
                      return;
                    }
                    setB2bSubmitted(true);
                    recordIssuedPass({
                      code: `EDTECH-B2B-${Date.now().toString().slice(-4)}`,
                      kind: 'b2b_school',
                      ownerUserId: user.userId,
                      ownerEmail: user.email || undefined,
                      ownerName: `${schoolName} (${user.displayName})`,
                      ownerContactMasked: maskEmailForDisplay(teacherContact || user.email),
                      provider: user.provider,
                      label: `Bản quyền Trường học · ${schoolProvince}`,
                      amountLabel: isTesterPro ? 'Miễn phí · Tester Pro' : '5.000.000 VNĐ / Năm',
                    });
                    activateUserSchoolPackage({
                      userId: user.userId,
                      userEmail: user.email || undefined,
                      schoolName,
                      province: schoolProvince,
                    });
                    refreshEntitlements();
                  }}
                  className="w-full py-3.5 px-5 rounded-sm bg-[#526D8B] hover:bg-[#435B76] text-[#D8C9A9] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  <span>
                    {lang === 'en'
                      ? 'Activate School Trial License Now'
                      : lang === 'zh'
                      ? '立即激活学校试用授权账户'
                      : 'Kích hoạt tài khoản dùng thử Trường học ngay'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="p-5 rounded-sm bg-[#EDE3CE] border border-[#47796D] space-y-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-7 h-7 text-[#47796D] shrink-0" />
                  <div>
                    <div className="text-[13px] font-semibold text-[#47796D]">
                      {lang === 'en'
                        ? 'School EdTech License Issued'
                        : lang === 'zh'
                        ? '已签发学校数字教材授权码'
                        : 'Đã cấp mã bản quyền học liệu trường học'}
                    </div>
                    <h4 className="font-serif text-xl font-semibold text-[#171817]">{schoolName}</h4>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-[#171817]/85 leading-relaxed">
                  {lang === 'en' ? (
                    <>3D History Lab Activation Code: <strong className="text-[#A94F3D] tabular-nums">EDTECH-B2B-2026</strong>. All teachers and students can now access the 3D X-Ray Diorama, download 2018 Curriculum Lesson Plans, and take interactive quizzes.</>
                  ) : lang === 'zh' ? (
                    <>3D 历史实验室激活码：<strong className="text-[#A94F3D] tabular-nums">EDTECH-B2B-2026</strong>。全校师生现可使用 3D X光沙盘、下载配套教案并参与互动测验。</>
                  ) : (
                    <>Mã kích hoạt phòng Lab Lịch sử 3D: <strong className="text-[#A94F3D] tabular-nums">EDTECH-B2B-2026</strong>. Toàn bộ giáo viên và học sinh của trường đã có thể sử dụng Sa bàn 3D X-Ray, tải Giáo án GDPT 2018 và làm bài kiểm tra tương tác.</>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsB2BModalOpen(false);
                      onStart3DVipExperience('HCM-DT-001', 'TOUR-INTER-02');
                    }}
                    className="px-5 py-2.5 rounded-sm bg-[#47796D] hover:bg-[#3A655B] text-[#D8C9A9] text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {lang === 'en'
                      ? 'Open 3D Lab for Classroom ↗'
                      : lang === 'zh'
                      ? '开启课堂 3D 沙盘 ↗'
                      : 'Mở Sa bàn 3D cho lớp học ↗'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadWorksheet(schoolName)}
                    className="px-4 py-2.5 rounded-sm bg-[#171817] hover:bg-[#A94F3D] text-[#D8C9A9] text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {lang === 'en'
                      ? 'Download 3D Lesson Plans'
                      : lang === 'zh'
                      ? '下载 3D 教案包'
                      : 'Tải Bộ Giáo Án 3D'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
