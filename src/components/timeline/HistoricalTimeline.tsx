import React, { useState, useRef } from 'react';
import { HeritageSite } from '../../types/heritage';
import { HERITAGE_SITES } from '../../data/heritageSites';
import { useI18n } from '../../i18n/I18nContext';
import { HeritageTypographicPlate } from '../common/HeritageTypographicPlate';
import { HeritageSmoothImage } from '../common/HeritageSmoothImage';
import { Wireframe3DEmblem, Flip3DText } from '../spatial/Ambient3DBackground';
import {
  Calendar,
  ChevronRight,
  ChevronLeft,
  Box,
  Quote,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';

type PeriodFilterKey = 'all' | 'pre1900' | '1900_1945' | '1945_1975' | 'post1975';

interface PeriodFilterOption {
  key: PeriodFilterKey;
  label: { vi: string; en: string; zh: string };
  rangeHint: { vi: string; en: string; zh: string };
  defaultEraIdx: number;
}

const PERIOD_FILTER_OPTIONS: PeriodFilterOption[] = [
  {
    key: 'all',
    label: { vi: 'Tất cả', en: 'All Eras', zh: '全部时期' },
    rangeHint: { vi: '1698 - 2026', en: '1698 - 2026', zh: '1698 - 2026' },
    defaultEraIdx: 2,
  },
  {
    key: 'pre1900',
    label: { vi: 'Trước 1900', en: 'Before 1900', zh: '1900年前' },
    rangeHint: { vi: 'Khởi nguồn & Cổ điển', en: 'Origins & Classical', zh: '起源与古典时期' },
    defaultEraIdx: 1,
  },
  {
    key: '1900_1945',
    label: { vi: '1900-1945', en: '1900-1945', zh: '1900-1945' },
    rangeHint: { vi: 'Giao thoa Đông Dương', en: 'Indochine Synthesis', zh: '印度支那交融期' },
    defaultEraIdx: 2,
  },
  {
    key: '1945_1975',
    label: { vi: '1945-1975', en: '1945-1975', zh: '1945-1975' },
    rangeHint: { vi: 'Kháng chiến & Hiện đại', en: 'Resistance & Modernism', zh: '抗战与现代主义' },
    defaultEraIdx: 3,
  },
  {
    key: 'post1975',
    label: { vi: 'Sau 1975', en: 'After 1975', zh: '1975年后' },
    rangeHint: { vi: 'Trùng tu & Di sản số', en: 'Conservation & Digital', zh: '修缮与数字保护' },
    defaultEraIdx: 4,
  },
];

// Sites that have landmark post-1975 national recognition, archaeological excavation, or major conservation milestones
const POST_1975_MILESTONE_SITES: Record<string, { vi: string; en: string; zh: string }> = {
  'HCM-DT-001': { vi: 'ĐTQG Đặc biệt 2009', en: 'Special National 2009', zh: '2009年国家级特别遗迹' },
  'HCM-DT-002': { vi: 'Đại tu 1998', en: 'Restored 1998', zh: '1998年原貌大修' },
  'HCM-DT-003': { vi: 'Bảo tồn Kiến trúc', en: 'Heritage Preserved', zh: '历史建筑保护' },
  'HCM-DT-005': { vi: 'Trùng tu Nhà thờ', en: 'Cathedral Conservation', zh: '大教堂修缮工程' },
  'HCM-DT-009': { vi: 'ĐTQG Đặc biệt 2015', en: 'Special National 2015', zh: '2015年国家级特别遗迹' },
  'HCM-DT-010': { vi: 'Khai quật 1993-1994', en: 'Excavated 1993-1994', zh: '1993-1994年考古发掘' },
};

interface HistoricalTimelineProps {
  sites?: HeritageSite[];
  hiddenSiteIds?: string[];
  onSelectSiteById: (siteId: string) => void;
  onOpen3DById: (siteId: string) => void;
  onOpenVRById?: (siteId: string) => void;
}

interface MilestoneEraData {
  era: { vi: string; en: string; zh: string };
  yearRange: string;
  title: { vi: string; en: string; zh: string };
  summary: { vi: string; en: string; zh: string };
  historicalContext: { vi: string; en: string; zh: string };
  heroSiteId: string;
  archivalImage: string;
  archivalCaption: { vi: string; en: string; zh: string };
  relatedSiteIds: string[];
  keyEvents: { vi: string[]; en: string[]; zh: string[] };
}

const HISTORICAL_ERAS: MilestoneEraData[] = [
  {
    era: {
      vi: 'THỜI KỲ KHAI HOANG & LẬP PHỦ',
      en: 'PIONEERING SETTLEMENT & GIA DINH FOUNDATION',
      zh: '南疆垦殖与设府时期',
    },
    yearRange: '1698 - 1789',
    title: {
      vi: 'Khai Phá Vùng Đất Phương Nam & Tổ Đình Phật Giáo',
      en: 'Pioneering the Southern Frontier & Ancient Buddhist Patriarch Temples',
      zh: '开拓南方疆土与南部佛教祖庭肇建',
    },
    summary: {
      vi: 'Lễ Thành hầu Nguyễn Hữu Cảnh vâng lệnh chúa Nguyễn kinh lược phương Nam, chính thức thiết lập đơn vị hành chính phủ Gia Định. Các ngôi cổ tự đầu tiên của Phật giáo Nam Bộ được khởi dựng.',
      en: 'General Nguyen Huu Canh, under Lord Nguyen orders, officially established Gia Dinh Prefecture. The first Buddhist patriarch monasteries of Southern Vietnam were founded.',
      zh: '礼成侯阮有镜奉阮主之命经略南方，正式设立嘉定府行政建制，越南南部最早的佛教祖庭古刹相继兴建。',
    },
    historicalContext: {
      vi: 'Đô thị Sài Gòn hình thành dọc theo các bến sông và rạch Bến Nghé, phát triển thành trung tâm giao thương sầm uất đa văn hóa giữa người Việt, người Hoa, và thương nhân quốc tế.',
      en: 'Saigon emerged along rivers and Ben Nghe canal, becoming a bustling multicultural trading hub among Vietnamese, Chinese, and international merchants.',
      zh: '西贡城区沿西贡河与牛渚涌形成，发展成为越人、华人与国际商贾云集的多元文化商贸中心。',
    },
    heroSiteId: 'HCM-DT-011',
    archivalImage: '',
    archivalCaption: {
      vi: 'Tổ đình Giác Lâm (1744) - Cổ tự Phật giáo lâu đời nhất vùng đất Gia Định xưa',
      en: 'Giac Lam Pagoda (1744) - The oldest Buddhist ancestral temple of historic Gia Dinh',
      zh: '觉林寺祖庭（1744年）— 古嘉定地区历史最悠久的佛教古刹',
    },
    relatedSiteIds: ['HCM-DT-010', 'HCM-DT-011'],
    keyEvents: {
      vi: [
        '1698: Lễ Thành hầu Nguyễn Hữu Cảnh lập phủ Gia Định, gồm 2 huyện Phước Long và Tân Bình.',
        '1744: Khởi dựng Chùa Giác Lâm (Tổ đình Giác Lâm) trên gò Cẩm Sơn.',
        '1770 - 1780: Cù lao Phố Chợ Lớn hình thành trung tâm thương mại lúa gạo sầm uất.',
      ],
      en: [
        '1698: General Nguyen Huu Canh established Gia Dinh Prefecture with Phuoc Long and Tan Binh districts.',
        '1744: Construction of Giac Lam Pagoda commenced atop Cam Son mound.',
        '1770 - 1780: Cho Lon river island became a thriving southern rice trading hub.',
      ],
      zh: [
        '1698: 礼成侯阮有镜设立嘉定府，下辖福隆与新平二县。',
        '1744: 觉林寺（觉林祖庭）于锦山丘上肇建。',
        '1770 - 1780: 堤岸地区逐渐发展为南部最繁华的稻米贸易中心。',
      ],
    },
  },
  {
    era: {
      vi: 'THỜI KỲ THÀNH BÁT QUÁI & TỔNG TRẤN',
      en: 'BAGUA CITADEL & GOVERNOR-GENERAL ERA',
      zh: '八卦城与嘉定总镇时期',
    },
    yearRange: '1790 - 1858',
    title: {
      vi: 'Thành Bát Quái (Thành Quy) & Công Đức Tả Quân Lê Văn Duyệt',
      en: 'Bagua Citadel (Citadel of Saigon) & Legacy of Marshal Le Van Duyet',
      zh: '八卦城（龟城）与左军黎文悦总镇时代',
    },
    summary: {
      vi: 'Xây dựng tòa thành quân sự Vauban 8 pháo đài kiên cố bậc nhất Đông Dương. Thời kỳ Tả quân Lê Văn Duyệt làm Tổng trấn Gia Định Thành, biến Sài Gòn thành một trung tâm tự do thương mại phồn thịnh.',
      en: 'Construction of the 8-bastion Vauban military citadel, the strongest fortress in Indochina. Governor-General Le Van Duyet transformed Saigon into a flourishing free-trade metropolis.',
      zh: '修筑印度支那最坚固的八棱沃邦式（Vauban）军事城堡；左军黎文悦任嘉定城总镇期间，将西贡建设为繁荣的自由贸易都会。',
    },
    historicalContext: {
      vi: 'Bản đồ Trần Văn Học năm 1815 ghi lại cấu trúc Thành Bát Quái với hệ thống đồn lũy bảo vệ và mạng kênh rạch tự nhiên nuôi sống toàn bộ cư dân đô thị.',
      en: 'Tran Van Hoc’s 1815 map documented the Bagua Citadel layout alongside fortresses and waterway networks sustaining the urban population.',
      zh: '1815年陈文学绘制的古舆图详实记录了八卦城格局、防御工事以及滋养城市居民的天然河涌水网。',
    },
    heroSiteId: 'HCM-DT-008',
    archivalImage: '',
    archivalCaption: {
      vi: 'Lăng Tả quân Lê Văn Duyệt (Bà Chiểu) - Biểu tượng lòng tôn kính vị đại thần mở mang Gia Định Thành',
      en: 'Tomb of Marshal Le Van Duyet (Ba Chieu) - Honoring the heroic pioneer of historic Gia Dinh',
      zh: '左军黎文悦陵（婆沼陵）— 纪念经略嘉定城之功臣名将',
    },
    relatedSiteIds: ['HCM-DT-008', 'HCM-DT-012'],
    keyEvents: {
      vi: [
        '1790: Vua Gia Long cho xây dựng Thành Bát Quái (Thành Quy) theo đồ án KTS Victor Olivier de Puymanel.',
        '1815: Giám thành Trần Văn Học hoàn thành bản đồ địa bạ chi tiết đầu tiên của Sài Gòn (Thành Bát Quái).',
        '1820: Cộng đồng người Hoa Triều Châu khởi dựng Hội quán Nghĩa An tại Chợ Lớn.',
        '1832: Tả quân Tổng trấn Lê Văn Duyệt tạ thế, để lại di sản mở mang Nam Bộ trường tồn.',
      ],
      en: [
        '1790: Emperor Gia Long erected the Bagua Citadel designed by French engineer Olivier de Puymanel.',
        '1815: Cartographer Tran Van Hoc drafted the first complete cadastral map of Saigon Citadel.',
        '1820: Chaozhou guild masters constructed Nghia An Assembly Hall in Cho Lon.',
        '1832: Governor-General Le Van Duyet passed away, leaving an enduring southern legacy.',
      ],
      zh: [
        '1790: 嘉隆帝采纳法国工程师皮马内尔（Puymanel）方案修筑八卦城（龟城）。',
        '1815: 监城陈文学完成西贡首幅精确城防与地籍舆图。',
        '1820: 堤岸潮州华人社群兴建义安会馆（关帝庙）。',
        '1832: 嘉定总镇左军黎文悦逝世，留下深远的南方开发遗产。',
      ],
    },
  },
  {
    era: {
      vi: 'THỜI KỲ KIẾN TRÚC THUỘC ĐỊA PHÁP',
      en: 'FRENCH COLONIAL ARCHITECTURAL ERA',
      zh: '法属时期与印度支那建筑黄金时代',
    },
    yearRange: '1859 - 1945',
    title: {
      vi: 'Thời Kỳ Hoàng Kim Kiến Trúc Tân Cổ Điển & Đông Dương',
      en: 'Golden Age of Beaux-Arts, Neo-Classical & Indochine Architecture',
      zh: '布杂艺术、新古典主义与印度支那风格建筑黄金期',
    },
    summary: {
      vi: 'Quy hoạch đô thị hiện đại theo mô hình Paris thu nhỏ. Các kiệt tác kiến trúc Beaux-Arts, Gothic, Romanesque và phong cách Đông Dương ra đời định hình diện mạo di sản đô thị.',
      en: 'Modern urban planning dubbed the "Pearl of the Orient". Masterpieces of Beaux-Arts, Gothic, Romanesque, and Indochine styles shaped the urban heritage skyline.',
      zh: '按照“东方小巴黎”蓝图推进近代城市规划，布杂艺术、哥特式、罗曼式与印度支那风格杰作奠定了城市历史风貌。',
    },
    historicalContext: {
      vi: 'Lấp các con kênh rạch cổ để mở các đại lộ Charner (Nguyễn Huệ), de la Somme (Hàm Nghi), Catinat (Đồng Khởi). Xây dựng hệ thống công trình biểu tượng phục vụ hành chính, văn hóa và bưu chính viễn thông.',
      en: 'Ancient canals filled to create grand boulevards Charner (Nguyen Hue), de la Somme (Ham Nghi), and Catinat (Dong Khoi). Iconic public buildings erected for civil, cultural, and postal service.',
      zh: '填埋古运河开辟阮惠（Charner）、咸宜（de la Somme）、同起（Catinat）等林荫大道，兴建行政、文化与邮政地标建筑群。',
    },
    heroSiteId: 'HCM-DT-003',
    archivalImage: '',
    archivalCaption: {
      vi: 'Bưu điện Trung tâm Sài Gòn (1886 - 1891) - Đỉnh cao kỹ nghệ kết cấu thép Gustave Eiffel',
      en: 'Saigon Central Post Office (1886 - 1891) - Pinnacle of Gustave Eiffel iron vaulting',
      zh: '西贡中心邮政局（1886 - 1891）— 埃菲尔铁艺穹顶结构与新古典主义杰作',
    },
    relatedSiteIds: ['HCM-DT-003', 'HCM-DT-005', 'HCM-DT-002', 'HCM-DT-004', 'HCM-DT-006', 'HCM-DT-007'],
    keyEvents: {
      vi: [
        '1863: Xây dựng trụ sở thương cảng Bến Nhà Rồng của hãng Messageries Maritimes.',
        '1877 - 1880: Khởi công và khánh thành Nhà thờ Chính tòa Đức Bà Sài Gòn bằng gạch nung Toulouse.',
        '1886 - 1891: KTS Alfred Foulhoux xây dựng Bưu điện Trung tâm với vòm thép Gustave Eiffel.',
        '1898 - 1900: Khánh thành Nhà hát Thành phố phong cách Flamboyant Beaux-Arts.',
        '1911: Ngày 5/6, Bác Hồ từ Bến Nhà Rồng ra đi tìm đường cứu nước.',
        '1912 - 1914: Khánh thành Chợ Mới Bến Thành với tháp đồng hồ 4 mặt biểu tượng.',
        '1926 - 1929: KTS Auguste Delaval xây dựng Bảo tàng Lịch sử phong cách Đông Dương.',
      ],
      en: [
        '1863: Construction of Messageries Maritimes trading headquarters at Nha Rong Wharf.',
        '1877 - 1880: Groundbreaking and consecration of Notre-Dame Cathedral built with Toulouse red bricks.',
        '1886 - 1891: Architect Alfred Foulhoux designed the Central Post Office featuring Gustave Eiffel vaulting.',
        '1898 - 1900: Municipal Theatre inaugurated in flamboyant French Beaux-Arts style.',
        '1911: On June 5, young patriot Ho Chi Minh departed Nha Rong Wharf on his quest for national independence.',
        '1912 - 1914: Ben Thanh Market inaugurated with its iconic four-faced clock tower.',
        '1926 - 1929: Architect Auguste Delaval constructed the Museum of History in Indochine style.',
      ],
      zh: [
        '1863: 法国轮船公司于芽龙港兴建“龙屋”商港总部。',
        '1877 - 1880: 采用图卢兹红砖建造西贡圣母大教堂并落成祝圣。',
        '1886 - 1891: 建筑师富卢（Foulhoux）与埃菲尔设计建造西贡中心邮政局。',
        '1898 - 1900: 法兰西第三共和国华丽布杂艺术风格的西贡大剧院落成。',
        '1911: 6月5日，青年阮必成（胡志明）自芽龙港乘船远赴海外寻求救国之路。',
        '1912 - 1914: 带有标志性四面钟楼的滨城市场正式启用。',
        '1926 - 1929: 建筑师德拉瓦尔（Auguste Delaval）设计建造印度支那风格的胡志明市历史博物馆。',
      ],
    },
  },
  {
    era: {
      vi: 'KHÁNG CHIẾN & HIỆN ĐẠI NHIỆT ĐỚI',
      en: 'RESISTANCE & TROPICAL MODERNISM',
      zh: '抗战岁月与热带现代主义建筑',
    },
    yearRange: '1945 - 1975',
    title: {
      vi: 'Đỉnh Cao Kiến Trúc Ngô Viết Thụ & Vùng Đất Thép Củ Chi',
      en: 'Zenith of Ngo Viet Thu Modernism & The Iron Tunnels of Cu Chi',
      zh: '吴曰树热带现代主义巅峰与古芝钢铁地道奇迹',
    },
    summary: {
      vi: 'Kiến trúc hiện đại nhiệt đới Việt Nam đạt đỉnh cao với Dinh Độc Lập do Khôi nguyên La Mã Ngô Viết Thụ thiết kế; đồng thời quân dân Sài Gòn sáng tạo kỳ quan ngầm 250km Địa đạo Củ Chi.',
      en: 'Vietnamese tropical modernist architecture peaked with the Independence Palace by Grand Prix de Rome architect Ngo Viet Thu; alongside the 250km subterranean fortress of Cu Chi.',
      zh: '罗马大奖得主吴曰树设计的独立宫将越南热带现代主义建筑推向巅峰；与此同时，军民修筑了全长250公里的古芝地下军事奇观。',
    },
    historicalContext: {
      vi: 'Sự giao thoa giữa triết lý dịch học phương Đông và vật liệu bê tông cốt thép hiện đại. Ngày 30/4/1975, xe tăng húc đổ cổng Dinh Độc Lập, đánh dấu cột mốc lịch sử giải phóng miền Nam, thống nhất đất nước.',
      en: 'Fusion of Eastern philosophical geometry and 20th-century reinforced concrete engineering. On April 30, 1975, tanks breached the palace gates, marking national reunification.',
      zh: '东方易学哲理与现代钢筋混凝土工程完美交融。1975年4月30日，坦克驶入独立宫大门，标志着南方解放与国家统一。',
    },
    heroSiteId: 'HCM-DT-001',
    archivalImage: '',
    archivalCaption: {
      vi: 'Dinh Độc Lập (1962 - 1966) - Kiệt tác kiến trúc hiện đại nhiệt đới của Ngô Viết Thụ',
      en: 'Independence Palace (1962 - 1966) - Masterpiece of tropical modernist architecture',
      zh: '独立宫（1962 - 1966）— 建筑大师吴曰树的热带现代主义代表作',
    },
    relatedSiteIds: ['HCM-DT-001', 'HCM-DT-009'],
    keyEvents: {
      vi: [
        '1948 - 1968: Phát triển mạng lưới Địa đạo Củ Chi 3 tầng ngầm liên hoàn dài hơn 250km.',
        '1962 - 1966: Xây dựng Dinh Độc Lập mới theo đồ án triết học phương Đông của Ngô Viết Thụ.',
        '1975: Ngày 30/4, chiến dịch Hồ Chí Minh toàn thắng tại Dinh Độc Lập, non sông liền một dải.',
      ],
      en: [
        '1948 - 1968: Development of the 250km interconnected multi-level Cu Chi tunnel fortress.',
        '1962 - 1966: Reconstruction of Independence Palace based on Eastern philosophical blueprints.',
        '1975: On April 30, Ho Chi Minh Campaign concluded victoriously at the Independence Palace.',
      ],
      zh: [
        '1948 - 1968: 扩建三层立体互通、总长逾250公里的古芝地道防御网络。',
        '1962 - 1966: 按吴曰树融合东方汉字哲学的方案重建独立宫。',
        '1975: 4月30日，胡志明战役于独立宫取得全面胜利，实现国家统一。',
      ],
    },
  },
  {
    era: {
      vi: 'KỶ NGUYÊN SỐ & BẢO TỒN DI SẢN',
      en: 'DIGITAL ERA & HERITAGE PRESERVATION',
      zh: '数字纪元与跨区域遗产保护',
    },
    yearRange: '1976 - 2026',
    title: {
      vi: 'Bảo Tồn Di Sản Văn Hóa & Hệ Thống Bản Đồ Số GIS',
      en: 'Cultural Heritage Conservation & Digital GIS Spatial System',
      zh: '文化遗产科学修缮与 GIS 数字空间遗产地图系统',
    },
    summary: {
      vi: 'TP. Hồ Chí Minh xếp hạng bảo tồn hàng trăm di tích quốc gia, phục dựng các tác phẩm điêu khắc nghệ thuật và triển khai Đề án Bản đồ số GIS tích hợp 3D/VR360.',
      en: 'Ho Chi Minh City preserves hundreds of national monuments, restores classical bas-relief artworks, and develops the GIS Digital Heritage Map with 3D/VR360 integration.',
      zh: '胡志明市对数百处国家级遗迹进行评级保护与艺术浮雕原貌修复，并建设融合 3D LiDAR 与 VR360 的跨区域 GIS 数字遗产地图平台。',
    },
    historicalContext: {
      vi: 'Ứng dụng công nghệ quét LiDAR 3D, bản đồ số GIS tương tác và thuyết minh đa ngữ, đưa di sản tiếp cận hàng triệu du khách quốc tế và thế hệ trẻ trên nền tảng đô thị thông minh.',
      en: 'Deploying 3D LiDAR scanning, interactive GIS georeferencing, and multilingual audio guides, connecting tangible heritage with international visitors and youth on smart city platforms.',
      zh: '运用 3D 激光雷达扫描、交互式 GIS 地理配准与多语种语音导览技术，让物质文化遗产在智慧城市平台上触达全球游客与年轻一代。',
    },
    heroSiteId: 'HCM-DT-002',
    archivalImage: '',
    archivalCaption: {
      vi: 'Nhà hát Thành phố - Trùng tu nguyên bản hệ thống phù điêu và tượng thiên thần nghệ thuật',
      en: 'Saigon Opera House - Restored original facade relief sculptures and angel statuary',
      zh: '胡志明市大剧院 — 按历史原貌修复立面浮雕与女神雕像群',
    },
    relatedSiteIds: ['HCM-DT-001', 'HCM-DT-002', 'HCM-DT-003', 'HCM-DT-005', 'HCM-DT-009'],
    keyEvents: {
      vi: [
        '1998: Đại tu nhân kỷ niệm 300 năm Sài Gòn - TP.HCM, phục dựng cụm tượng nữ thần Nhà hát.',
        '2009: Dinh Độc Lập được xếp hạng Di tích Quốc gia Đặc biệt.',
        '2015: Địa đạo Củ Chi xếp hạng Di tích Quốc gia Đặc biệt; đệ trình UNESCO công nhận Di sản Thế giới.',
        '2026: Vận hành Hệ thống Bản đồ số Di sản Văn hóa Vật thể TP.HCM với công nghệ 3D LiDAR & VR360.',
      ],
      en: [
        '1998: Centennial restoration celebrating 300 years of Saigon, reviving the facade statuary.',
        '2009: Independence Palace classified as a Special National Monument.',
        '2015: Cu Chi Tunnels designated Special National Monument and submitted for UNESCO World Heritage consideration.',
        '2026: Official launch of the HCMC Tangible Cultural Heritage Digital GIS System with 3D LiDAR & VR360.',
      ],
      zh: [
        '1998: 喜迎西贡—胡志明市建城300周年大修，复原大剧院立面艺术雕像。',
        '2009: 独立宫获评为越南国家级特别遗迹。',
        '2015: 古芝地道获评国家级特别遗迹，并申报联合国教科文组织世界遗产。',
        '2026: 正式上线融合 3D LiDAR 与 VR360 的胡志明市及东南部物质文化遗产数字 GIS 地图系统。',
      ],
    },
  },
];

export const HistoricalTimeline: React.FC<HistoricalTimelineProps> = ({
  sites: sitesProp,
  hiddenSiteIds = [],
  onSelectSiteById,
  onOpen3DById,
  onOpenVRById,
}) => {
  const { lang, t, getLocalizedSite } = useI18n();
  const activeSites = sitesProp && sitesProp.length > 0 ? sitesProp : HERITAGE_SITES;
  const [selectedEraIdx, setSelectedEraIdx] = useState<number>(2);
  const [periodFilterIdx, setPeriodFilterIdx] = useState<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const milestoneRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activePeriodOption = PERIOD_FILTER_OPTIONS[periodFilterIdx] || PERIOD_FILTER_OPTIONS[0];
  const activePeriodKey = activePeriodOption.key;

  const filteredSiteIds = React.useMemo(() => {
    if (activePeriodKey === 'all') {
      return HISTORICAL_ERAS[selectedEraIdx].relatedSiteIds.filter((id) =>
        activeSites.some((s) => s.id === id)
      );
    }

    const matches = activeSites.filter((s) => {
      const yr = s.commencementYear;
      if (activePeriodKey === 'pre1900') return yr < 1900;
      if (activePeriodKey === '1900_1945') return yr >= 1900 && yr <= 1945;
      if (activePeriodKey === '1945_1975') return yr > 1945 && yr <= 1975;
      if (activePeriodKey === 'post1975') {
        return yr > 1975 || Boolean(POST_1975_MILESTONE_SITES[s.id]);
      }
      return true;
    });

    return matches
      .slice()
      .sort((a, b) => a.commencementYear - b.commencementYear)
      .map((s) => s.id);
  }, [activePeriodKey, activeSites, selectedEraIdx]);

  const [failedThumbMap, setFailedThumbMap] = useState<Record<string, boolean>>({});
  const currentEraData = HISTORICAL_ERAS[selectedEraIdx];
  const currentHeroSite = activeSites.find((s) => s.id === currentEraData.heroSiteId) || activeSites[0];
  const currentEraPhotoRaw = currentHeroSite?.photos?.[0] || currentEraData.archivalImage || '';
  const currentEraPhoto =
    currentEraPhotoRaw && !failedThumbMap[`era:${selectedEraIdx}:${currentEraPhotoRaw}`]
      ? currentEraPhotoRaw
      : '';
  const eraTitle = lang === 'zh' ? currentEraData.title.zh : lang === 'en' ? currentEraData.title.en : currentEraData.title.vi;
  const eraName = lang === 'zh' ? currentEraData.era.zh : lang === 'en' ? currentEraData.era.en : currentEraData.era.vi;
  const eraSummary = lang === 'zh' ? currentEraData.summary.zh : lang === 'en' ? currentEraData.summary.en : currentEraData.summary.vi;
  const eraContext = lang === 'zh' ? currentEraData.historicalContext.zh : lang === 'en' ? currentEraData.historicalContext.en : currentEraData.historicalContext.vi;
  const eraCaption = lang === 'zh' ? currentEraData.archivalCaption.zh : lang === 'en' ? currentEraData.archivalCaption.en : currentEraData.archivalCaption.vi;
  const eraEvents = lang === 'zh' ? currentEraData.keyEvents.zh : lang === 'en' ? currentEraData.keyEvents.en : currentEraData.keyEvents.vi;

  // Tự động căn giữa mốc thời gian đang chọn vào giữa khung cuộn ngang trên điện thoại (<768px)
  React.useEffect(() => {
    const activeBtn = milestoneRefs.current[selectedEraIdx];
    if (activeBtn && typeof window !== 'undefined' && window.innerWidth < 768) {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [selectedEraIdx]);

  const handleSelectEra = (idx: number) => {
    setSelectedEraIdx(idx);
    const btn = milestoneRefs.current[idx];
    if (btn) {
      btn.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  };

  const handlePeriodSliderChange = (nextIdx: number) => {
    const clampedIdx = Math.max(0, Math.min(PERIOD_FILTER_OPTIONS.length - 1, nextIdx));
    setPeriodFilterIdx(clampedIdx);
    const opt = PERIOD_FILTER_OPTIONS[clampedIdx];
    if (opt && opt.key !== 'all') {
      handleSelectEra(opt.defaultEraIdx);
    }
  };

  const scrollTimeline = (direction: 'left' | 'right') => {
    if (direction === 'left' && selectedEraIdx > 0) {
      handleSelectEra(selectedEraIdx - 1);
    } else if (direction === 'right' && selectedEraIdx < HISTORICAL_ERAS.length - 1) {
      handleSelectEra(selectedEraIdx + 1);
    }
  };

  return (
    <div className="relative w-full max-w-full min-w-0 overflow-hidden bg-black text-[#F5F5F7] py-8 sm:py-10 px-4 sm:px-8 space-y-10">
      <div className="max-w-7xl mx-auto space-y-10">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
            <span className="text-xs font-medium text-[#D4AF37] bg-[#D4AF37]/12 px-3 py-1 rounded-full">
              {lang === 'zh' ? '城市遗产编年史' : lang === 'en' ? 'Urban Heritage Chronicles' : 'Biên niên sử Di sản Đô thị'}
            </span>
            <span className="text-[#86868B]">·</span>
            <span className="text-xs font-sans text-[#86868B] font-medium tabular-nums">
              {lang === 'zh' ? '西贡 - 嘉定 (1698 - 2026)' : 'Sài Gòn - Gia Định (1698 - 2026)'}
            </span>
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-[#F5F5F7] tracking-tight">
            {lang === 'zh'
              ? '西贡 - 胡志明市 300 年历史长河'
              : lang === 'en'
              ? '300-Year Historical Flow of Saigon - HCMC'
              : 'Dòng Chảy Lịch Sử 300 Năm Sài Gòn - TP.HCM'}
          </h2>
          <p className="text-sm md:text-base text-[#86868B] mt-2.5 max-w-3xl leading-relaxed font-normal">
            {lang === 'zh'
              ? '探索南方跨越三个世纪的建筑风格演变、城市规划格局与物质文化遗产脉络。'
              : lang === 'en'
              ? 'The spatial evolution of architecture, urban planning, and tangible cultural heritage across historical eras.'
              : 'Hành trình chuyển mình không gian kiến trúc, quy hoạch đô thị và di sản văn hóa vật thể phương Nam qua các thời kỳ lịch sử.'}
          </p>
        </div>

        {/* Navigation Step Arrows */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => scrollTimeline('left')}
            disabled={selectedEraIdx === 0}
            className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
              selectedEraIdx === 0
                ? 'text-[#86868B]/40 bg-[#1D1D1F]/50 cursor-not-allowed border-white/[0.06]'
                : 'text-[#F5F5F7] bg-[#1D1D1F] hover:bg-[#272729] border-white/[0.12]'
            }`}
            title={lang === 'zh' ? '上一时期' : lang === 'en' ? 'Previous era' : 'Thời kỳ trước'}
            aria-label={lang === 'zh' ? '上一时期' : lang === 'en' ? 'Previous era' : 'Thời kỳ trước'}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-sans text-[#F5F5F7] font-medium bg-[#1D1D1F] px-4 py-2 rounded-full border border-white/[0.12] tabular-nums">
            {selectedEraIdx + 1} / {HISTORICAL_ERAS.length}
          </span>
          <button
            onClick={() => scrollTimeline('right')}
            disabled={selectedEraIdx === HISTORICAL_ERAS.length - 1}
            className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
              selectedEraIdx === HISTORICAL_ERAS.length - 1
                ? 'text-[#86868B]/40 bg-[#1D1D1F]/50 cursor-not-allowed border-white/[0.06]'
                : 'text-[#F5F5F7] bg-[#1D1D1F] hover:bg-[#272729] border-white/[0.12]'
            }`}
            title={lang === 'zh' ? '下一时期' : lang === 'en' ? 'Next era' : 'Thời kỳ tiếp theo'}
            aria-label={lang === 'zh' ? '下一时期' : lang === 'en' ? 'Next era' : 'Thời kỳ tiếp theo'}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* CHRONOLOGICAL PERIOD FILTER SLIDER (APPLE DARK PRO) */}
      <div className="bg-[#1D1D1F]/90 backdrop-blur-2xl rounded-[24px] p-5 sm:p-6 border border-white/[0.08] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-[#F5F5F7] tracking-tight">
                {lang === 'zh' ? '年代筛选滑块' : lang === 'en' ? 'Chronological Timeline Slider' : 'Bộ Lọc Niên Đại Lịch Sử'}
              </h3>
              <p className="text-xs text-[#86868B]">
                {lang === 'zh'
                  ? '拖动滑块或点击历史阶段以筛选对应时期的文物古迹'
                  : lang === 'en'
                  ? 'Scrub or select a historical period to filter matching monuments'
                  : 'Kéo thanh trượt hoặc chọn mốc thời kỳ để lọc di sản theo niên đại khởi dựng & bảo tồn'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-xs font-sans font-medium text-[#D4AF37] bg-[#D4AF37]/12 border border-[#D4AF37]/25 px-3 py-1 rounded-full tabular-nums">
              {activePeriodKey === 'all'
                ? `${activePeriodOption.label[lang === 'zh' ? 'zh' : lang === 'en' ? 'en' : 'vi']} · ${filteredSiteIds.length} ${lang === 'zh' ? '处代表' : lang === 'en' ? 'featured' : 'tiêu biểu'}`
                : `${activePeriodOption.label[lang === 'zh' ? 'zh' : lang === 'en' ? 'en' : 'vi']} · ${filteredSiteIds.length} ${lang === 'zh' ? '处遗迹' : lang === 'en' ? 'monuments' : 'di tích'}`}
            </span>
            {activePeriodKey !== 'all' && (
              <button
                type="button"
                onClick={() => handlePeriodSliderChange(0)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F5F5F7] bg-white/[0.08] hover:bg-white/[0.15] px-3 py-1 rounded-full border border-white/10 transition-colors cursor-pointer"
                title={lang === 'zh' ? '重置筛选' : lang === 'en' ? 'Reset filter' : 'Đặt lại bộ lọc'}
              >
                <RotateCcw className="w-3 h-3" />
                <span>{lang === 'zh' ? '重置' : lang === 'en' ? 'Reset' : 'Tất cả'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive Range Track + Era Stops */}
        <div className="space-y-3 pt-1">
          <div className="relative flex items-center h-6 px-2">
            <div className="absolute left-2 right-2 h-1.5 rounded-full bg-white/[0.1] overflow-hidden pointer-events-none">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(periodFilterIdx / (PERIOD_FILTER_OPTIONS.length - 1)) * 100}%`,
                  background: 'linear-gradient(90deg, #0071E3, #D4AF37)',
                }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={PERIOD_FILTER_OPTIONS.length - 1}
              step={1}
              value={periodFilterIdx}
              onChange={(e) => handlePeriodSliderChange(Number(e.target.value))}
              aria-label={
                lang === 'zh'
                  ? '年代筛选滑块'
                  : lang === 'en'
                  ? 'Filter monuments by historical period'
                  : 'Thanh trượt lọc di sản theo niên đại'
              }
              className="relative z-10 w-full h-6 appearance-none bg-transparent cursor-pointer accent-[#D4AF37]"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PERIOD_FILTER_OPTIONS.map((opt, idx) => {
              const isActive = periodFilterIdx === idx;
              const optLabel = lang === 'zh' ? opt.label.zh : lang === 'en' ? opt.label.en : opt.label.vi;
              const optHint = lang === 'zh' ? opt.rangeHint.zh : lang === 'en' ? opt.rangeHint.en : opt.rangeHint.vi;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handlePeriodSliderChange(idx)}
                  className={`px-3 py-2 rounded-2xl text-left transition-all border cursor-pointer ${
                    isActive
                      ? 'bg-[#D4AF37]/16 border-[#D4AF37]/55 text-[#F5F5F7] shadow-[0_0_20px_rgba(212,175,55,0.14)]'
                      : 'bg-black/35 border-white/[0.06] text-[#86868B] hover:border-white/20 hover:text-[#F5F5F7]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={`text-xs font-semibold truncate ${isActive ? 'text-[#D4AF37]' : 'text-[#F5F5F7]/85'}`}>
                      {optLabel}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isActive ? 'bg-[#D4AF37]' : 'bg-white/20'
                      }`}
                    />
                  </div>
                  <div className="text-[11px] font-sans tabular-nums text-[#86868B] truncate mt-0.5">{optHint}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* HORIZONTAL TIMELINE AXIS (SCRUBBER) */}
      <div
        className="mobile-timeline-scrubber relative w-full max-w-full min-w-0 md:py-3 overflow-x-auto no-scrollbar"
        ref={scrollContainerRef}
      >
        <div className="mobile-timeline-track relative z-10 flex items-start md:justify-between md:min-w-[760px] md:px-2 md:gap-3">
          {/* Horizontal Connector Rail Line (Background Inactive) */}
          <div
            className="absolute max-md:top-7 md:top-4 h-[2px] bg-white/[0.12] z-0 pointer-events-none"
            style={{
              left: `${(1 / (HISTORICAL_ERAS.length * 2)) * 100}%`,
              right: `${(1 / (HISTORICAL_ERAS.length * 2)) * 100}%`,
            }}
          />

          {/* Active Gold Line connecting from node 1 to active node */}
          <div
            className="absolute max-md:top-7 md:top-4 h-[2px] z-0 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(212,175,55,0.65)] pointer-events-none"
            style={{
              left: `${(1 / (HISTORICAL_ERAS.length * 2)) * 100}%`,
              width: `${(selectedEraIdx / (HISTORICAL_ERAS.length - 1)) * ((HISTORICAL_ERAS.length - 1) / HISTORICAL_ERAS.length) * 100}%`,
              background: 'linear-gradient(90deg, #0071E3, #D4AF37)',
            }}
          />

          {HISTORICAL_ERAS.map((eraItem, idx) => {
            const isSelected = selectedEraIdx === idx;
            const isPastOrActive = idx <= selectedEraIdx;
            const eraFullName = lang === 'zh' ? eraItem.era.zh : lang === 'en' ? eraItem.era.en : eraItem.era.vi;

            return (
              <button
                key={idx}
                ref={(el) => {
                  milestoneRefs.current[idx] = el;
                }}
                type="button"
                onClick={() => handleSelectEra(idx)}
                className="mobile-timeline-milestone relative z-10 flex flex-col items-center group cursor-pointer text-center focus:outline-none transition-all md:flex-1"
              >
                {/* Node Disc */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-[#D4AF37] text-black scale-110 shadow-[0_0_18px_rgba(212,175,55,0.55)] font-bold ring-4 ring-black'
                      : isPastOrActive
                      ? 'bg-[#1D1D1F] border border-[#D4AF37]/60 text-[#D4AF37]'
                      : 'bg-[#1D1D1F] border border-white/[0.18] text-[#86868B] group-hover:border-white/40 group-hover:text-[#F5F5F7]'
                  }`}
                >
                  <span className="text-xs font-sans font-semibold tabular-nums">{idx + 1}</span>
                </div>

                {/* Year Range Badge */}
                <div
                  className={`mt-3 px-3 py-1 rounded-full text-xs md:text-[13px] font-sans transition-all font-medium whitespace-nowrap tabular-nums ${
                    isSelected
                      ? 'bg-[#F5F5F7] text-black shadow-sm'
                      : 'bg-[#1D1D1F] text-[#86868B] border border-white/[0.08] group-hover:text-[#F5F5F7]'
                  }`}
                >
                  {eraItem.yearRange}
                </div>

                {/* Subtitle Era Name */}
                <span
                  className={`text-[11px] sm:text-xs text-center mt-1.5 font-medium leading-snug transition-colors max-w-[170px] ${
                    isSelected ? 'text-[#F5F5F7] font-semibold' : 'text-[#86868B] group-hover:text-[#F5F5F7]'
                  }`}
                  style={{ textWrap: 'balance' }}
                >
                  {eraFullName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN TWO-COLUMN ERA CONTENT DISPLAY */}
      <div
        key={selectedEraIdx}
        className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start"
      >
        {/* Left Column: Era Context, Archival Illustration & Key Events */}
        <div className="lg:col-span-7 space-y-6">
          {/* Era Title & Summary Bento Card */}
          <div className="space-y-3 bg-[#1D1D1F] p-6 md:p-7 rounded-[28px] border border-white/[0.08] shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs font-sans">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="bg-[#D4AF37]/15 text-[#D4AF37] px-3 py-1 rounded-full font-medium">
                  {eraName}
                </span>
                <span className="text-[#86868B]">·</span>
                <span className="text-[#F5F5F7] font-semibold tabular-nums">{currentEraData.yearRange}</span>
              </div>
              <Wireframe3DEmblem accentHex="#D4AF37" variant="astrolabe" />
            </div>
            <h3 className="font-serif text-2xl md:text-3xl font-semibold text-[#F5F5F7] tracking-tight leading-snug">
              {eraTitle}
            </h3>
            <p className="text-sm sm:text-base text-[#F5F5F7]/85 leading-relaxed font-normal pt-1">
              {eraSummary}
            </p>
          </div>

          {/* Archival Plate or Real Admin Photograph */}
          <div className="relative aspect-video rounded-[28px] overflow-hidden bg-[#171817] border border-white/[0.08] shadow-md group">
            {currentEraPhoto ? (
              <>
                <HeritageSmoothImage
                  src={currentEraPhoto}
                  alt={eraCaption}
                  waitTone="dark"
                  onError={() =>
                    setFailedThumbMap((prev) => ({
                      ...prev,
                      [`era:${selectedEraIdx}:${currentEraPhotoRaw}`]: true,
                    }))
                  }
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-[opacity,transform] duration-500"
                />
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex flex-col sm:flex-row sm:items-end justify-between gap-2.5">
                  <p className="text-xs sm:text-sm text-[#F5F5F7] font-medium drop-shadow-md line-clamp-2 leading-relaxed flex-1">
                    {eraCaption}
                  </p>
                  <span className="text-[11px] font-sans font-medium text-[#D4AF37] bg-black/75 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 shrink-0 self-start sm:self-end">
                    {lang === 'zh' ? '历史档案' : lang === 'en' ? 'Historical Archive' : 'Tư liệu lịch sử'}
                  </span>
                </div>
              </>
            ) : currentHeroSite ? (
              <HeritageTypographicPlate
                site={currentHeroSite}
                variant="detail"
                subtitleOverride={eraCaption}
                badgeOverride={`${currentEraData.yearRange} · ${lang === 'zh' ? '历史档案' : lang === 'en' ? 'Historical Archive' : 'Tư liệu lịch sử'}`}
              />
            ) : null}
          </div>

          {/* Historical Context Quote */}
          <div className="flex items-start gap-3.5 bg-[#1D1D1F] p-5 md:p-6 rounded-[24px] border border-white/[0.08]">
            <Quote className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5 opacity-90" />
            <p className="text-sm sm:text-[15px] text-[#F5F5F7]/90 leading-relaxed italic font-normal">
              &ldquo;{eraContext}&rdquo;
            </p>
          </div>

          {/* Key Chronological Events Section */}
          <div className="space-y-3.5 pt-1">
            <h4 className="text-lg font-semibold text-[#F5F5F7] flex items-center gap-2 tracking-tight">
              <Calendar className="w-4 h-4 text-[#D4AF37]" />
              <span>{lang === 'zh' ? '核心历史与建筑里程碑：' : lang === 'en' ? 'Core Historical & Architectural Milestones:' : 'Các Sự Kiện & Dấu Ấn Kiến Trúc Cốt Lõi:'}</span>
            </h4>

            <div className="relative pl-6 sm:pl-7 ml-2 sm:ml-3 space-y-3.5 border-l-2 border-[#D4AF37]/35 my-3">
              {eraEvents.map((evt, eIdx) => {
                const colonIndex = evt.indexOf(':');
                const hasColon = colonIndex !== -1;
                const yearPart = hasColon ? evt.substring(0, colonIndex).trim() : '';
                const textPart = hasColon ? evt.substring(colonIndex + 1).trim() : evt;

                return (
                  <div key={`${selectedEraIdx}-${eIdx}`} className="relative group">
                    <div
                      className="absolute -left-[31px] sm:-left-[35px] top-5 w-3 h-3 rounded-full bg-[#D4AF37] border-2 border-black shadow-[0_0_8px_rgba(212,175,55,0.75)] group-hover:scale-125 transition-transform"
                      aria-hidden="true"
                    />

                    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 p-4 md:p-5 rounded-[20px] border border-white/[0.08] bg-[#1D1D1F] hover:bg-[#272729] transition-colors">
                      {yearPart ? (
                        <span className="text-xs sm:text-[13px] font-semibold text-[#D4AF37] bg-[#D4AF37]/15 px-3 py-1 rounded-full shrink-0 self-start font-sans tabular-nums">
                          {yearPart}
                        </span>
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] shrink-0 mt-2" />
                      )}
                      <p className="text-sm sm:text-[15px] text-[#F5F5F7]/90 font-normal leading-relaxed flex-1 break-words">
                        {textPart}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Key Monuments Associated with this Era or Period Filter */}
        <div className="lg:col-span-5 bg-[#1D1D1F] rounded-[28px] p-6 border border-white/[0.08] space-y-4 shadow-xl lg:sticky lg:top-20">
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3.5">
            <div className="min-w-0">
              <span className="text-base sm:text-lg font-semibold text-[#F5F5F7] tracking-tight block truncate">
                {activePeriodKey === 'all'
                  ? (lang === 'zh' ? '代表性遗迹' : lang === 'en' ? 'Prominent Monuments' : 'Di Tích Tiêu Biểu')
                  : `${lang === 'zh' ? '时期筛选：' : lang === 'en' ? 'Period: ' : 'Niên đại: '}${
                      lang === 'zh'
                        ? activePeriodOption.label.zh
                        : lang === 'en'
                        ? activePeriodOption.label.en
                        : activePeriodOption.label.vi
                    }`}{' '}
                ({filteredSiteIds.length})
              </span>
            </div>
            <span className="text-xs font-sans text-[#86868B] shrink-0">
              {lang === 'zh' ? '3D 与 VR 视觉' : lang === 'en' ? 'Visual 3D & VR' : 'Trực quan 3D & VR'}
            </span>
          </div>

          <div className="space-y-3.5 max-h-[72vh] overflow-y-auto pr-1">
            {filteredSiteIds.map((siteId, sIdx) => {
              const rawSite = activeSites.find((s) => s.id === siteId);
              if (!rawSite) return null;
              const site = getLocalizedSite(rawSite);
              const yearLabel =
                rawSite.commencementYear < 0
                  ? `${Math.abs(rawSite.commencementYear)} ${lang === 'zh' ? '公元前' : lang === 'en' ? 'BCE' : 'TCN'}`
                  : String(rawSite.commencementYear);
              const post1975Tag =
                activePeriodKey === 'post1975' && POST_1975_MILESTONE_SITES[siteId]
                  ? (lang === 'zh'
                      ? POST_1975_MILESTONE_SITES[siteId].zh
                      : lang === 'en'
                      ? POST_1975_MILESTONE_SITES[siteId].en
                      : POST_1975_MILESTONE_SITES[siteId].vi)
                  : null;

              const badgeText =
                site.rankingLevel === 'Special National'
                  ? (lang === 'zh' ? '国家级特别遗迹' : lang === 'en' ? 'Special National' : 'Quốc gia Đặc biệt')
                  : site.rankingLevel === 'National'
                  ? (lang === 'zh' ? '国家级遗迹' : lang === 'en' ? 'National Monument' : 'Di tích Quốc gia')
                  : (lang === 'zh' ? '市级遗迹' : lang === 'en' ? 'City-level Monument' : 'Cấp Thành phố');

              return (
                <div
                  key={`${selectedEraIdx}-${activePeriodKey}-${siteId}`}
                  className="p-4 rounded-[20px] bg-black/35 border border-white/[0.08] hover:border-white/20 transition-all space-y-3 group"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-20 aspect-video shrink-0 rounded-xl overflow-hidden bg-[#171817] border border-white/10 relative">
                      {rawSite.photos?.[0] && !failedThumbMap[`site:${rawSite.id}:${rawSite.photos[0]}`] ? (
                        <HeritageSmoothImage
                          src={rawSite.photos[0]}
                          alt={site.officialName}
                          waitTone="dark"
                          onError={() =>
                            setFailedThumbMap((prev) => ({
                              ...prev,
                              [`site:${rawSite.id}:${rawSite.photos[0]}`]: true,
                            }))
                          }
                          className="w-full h-full object-cover group-hover:scale-110 transition-[opacity,transform] duration-500"
                        />
                      ) : (
                        <HeritageTypographicPlate site={rawSite} index={sIdx} variant="compact" />
                      )}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-[#F5F5F7] font-sans font-semibold bg-white/[0.1] px-2 py-0.5 rounded-full tabular-nums">
                            {yearLabel}
                          </span>
                          <span className="text-[11px] text-[#D4AF37] font-sans font-medium bg-[#D4AF37]/12 px-2.5 py-0.5 rounded-full inline-block">
                            {post1975Tag || badgeText}
                          </span>
                          {hiddenSiteIds.includes(siteId) && (
                            <span className="px-2 py-0.5 rounded-full bg-[#171817] border border-[#C9A46A] text-[#C9A46A] text-[9.5px] font-semibold">
                              {lang === 'en'
                                ? 'Tester Preview · Hidden'
                                : lang === 'zh'
                                ? '隐藏草稿 · 测试模式'
                                : 'Đang ẩn · Chế độ Tester'}
                            </span>
                          )}
                        </div>
                        <Wireframe3DEmblem accentHex="#D4AF37" variant={sIdx % 2 === 0 ? 'octahedron' : 'astrolabe'} />
                      </div>
                      <h5 className="font-serif text-base font-semibold text-[#F5F5F7] group-hover:text-[#D4AF37] transition-colors truncate">
                        {site.officialName}
                      </h5>
                      <p className="text-xs text-[#86868B] line-clamp-2 font-normal leading-relaxed">
                        {site.architecturalStyle || site.summary}
                      </p>
                    </div>
                  </div>

                  {/* Direct 3D/VR exploration action row */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                    <button
                      onClick={() => onOpen3DById(siteId)}
                      className="group/btn flex-1 py-2 px-3 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      title={t('common.view3D')}
                    >
                      <Box className="w-3.5 h-3.5" />
                      <Flip3DText text="3D LiDAR" />
                    </button>
                    <button
                      onClick={() => onSelectSiteById(siteId)}
                      className="group/btn py-2 px-3.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-[#F5F5F7] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      title={t('common.heritageArchive')}
                    >
                      <Flip3DText text={t('common.heritageArchive')} />
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    {onOpenVRById && rawSite.hasVR360 && (
                      <button
                        onClick={() => onOpenVRById(siteId)}
                        className="py-2 px-3 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-[#D4AF37] text-xs font-medium cursor-pointer transition-colors"
                      >
                        VR
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
