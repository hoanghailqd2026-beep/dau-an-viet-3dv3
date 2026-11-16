import React, { useState, useRef, useMemo, useEffect } from 'react';
import { HeritageSite } from '../../types/heritage';
import { HERITAGE_SITES } from '../../data/heritageSites';
import {
  resolveSitePhotos,
  useHeritageRealPhotos,
  saveCustomSitePhoto,
  removeCustomSitePhoto,
  compressImageFileToDataUrl,
  normalizeCustomPhotoSlot,
} from '../../utils/wikimediaPhotoService';
import { HeritageTypographicPlate } from '../common/HeritageTypographicPlate';
import { HeritageSmoothImage } from '../common/HeritageSmoothImage';
import { triggerHaptic } from '../../utils/haptics';
import {
  Layers,
  CheckSquare,
  Square,
  X,
  MoveHorizontal,
  User,
  RotateCw,
  MousePointerClick,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  Check,
  Camera,
  RotateCcw,
  Upload,
} from 'lucide-react';

// ============================================================================
// 1. MULTI-LAYER GIS FILTER TYPES & DATA (BAUTEN / PERSONEN / EREIGNIS / QUELLEN / AUDIO)
// ============================================================================
export type GisLayerKey = 'bauten' | 'personen' | 'ereignis' | 'quellen' | 'audio';

export interface GisLayerConfig {
  key: GisLayerKey;
  code: string;
  labelVi: string;
  labelEn: string;
  labelZh: string;
  color: string;
  bgColor: string;
}

export const GIS_MULTI_LAYERS: GisLayerConfig[] = [
  {
    key: 'bauten',
    code: 'Kiến trúc',
    labelVi: 'Kiến trúc & Kết cấu công trình',
    labelEn: 'Architecture & Structural System',
    labelZh: '建筑与结构系统',
    color: '#C5A059',
    bgColor: 'rgba(197, 160, 89, 0.2)',
  },
  {
    key: 'personen',
    code: 'Nhân vật',
    labelVi: 'Nhân vật Lịch sử & Kiến trúc sư',
    labelEn: 'Historical Figures & Architects',
    labelZh: '历史人物与建筑师',
    color: '#E05A47',
    bgColor: 'rgba(224, 90, 71, 0.2)',
  },
  {
    key: 'ereignis',
    code: 'Sự kiện',
    labelVi: 'Sự kiện & Dấu mốc Lịch sử',
    labelEn: 'Historical Events & Milestones',
    labelZh: '历史事件与里程碑',
    color: '#D9822B',
    bgColor: 'rgba(217, 130, 43, 0.2)',
  },
  {
    key: 'quellen',
    code: 'Tư liệu',
    labelVi: 'Sử liệu & Lưu trữ gốc',
    labelEn: 'Primary Archival Sources',
    labelZh: '原始档案文献',
    color: '#3AA690',
    bgColor: 'rgba(58, 166, 144, 0.2)',
  },
  {
    key: 'audio',
    code: 'Thuyết minh',
    labelVi: 'Trạm Thuyết minh Âm thanh',
    labelEn: 'Spatial Audio Narration Stops',
    labelZh: '空间语音导览站',
    color: '#38BDF8',
    bgColor: 'rgba(56, 189, 248, 0.2)',
  },
];

export interface GisPinItem {
  id: string;
  layer: GisLayerKey;
  code: string;
  color: string;
  title: string;
  subtitle: string;
  detail: string;
  // Offset in lat/lng for 2D map & 3D relative coordinates
  latOffset: number;
  lngOffset: number;
  pos3D: [number, number, number];
}

export function buildGisPinsForSite(site: HeritageSite, lang: string = 'vi'): GisPinItem[] {
  const firstMilestone = site.milestones?.[0];
  const secondMilestone = site.milestones?.[1];
  const architectName = site.architect || 'Kiến trúc sư Đông Dương & Việt Nam';

  return [
    {
      id: `${site.id}-bauten`,
      layer: 'bauten',
      code: lang === 'en' ? 'Architecture' : 'Kiến trúc',
      color: '#C5A059',
      title:
        lang === 'en'
          ? `Architectural System: ${site.architecturalStyle}`
          : `Kết cấu Kiến trúc: ${site.architecturalStyle}`,
      subtitle: `${site.materials?.slice(0, 2).join(' · ') || 'Đá cổ & Gỗ quý'}`,
      detail:
        site.conservationNotes ||
        'Hệ kết cấu chịu lực nguyên bản bảo tồn theo tiêu chuẩn trùng tu di tích quốc gia.',
      latOffset: 0.00055,
      lngOffset: -0.00065,
      pos3D: [-1.8, 1.9, 1.4],
    },
    {
      id: `${site.id}-personen`,
      layer: 'personen',
      code: lang === 'en' ? 'Architect' : 'Nhân vật',
      color: '#E05A47',
      title:
        lang === 'en'
          ? `Key Figure / Architect: ${architectName.split('(')[0].trim()}`
          : `Nhân vật / Tác giả: ${architectName.split('(')[0].trim()}`,
      subtitle: site.chronology,
      detail: `Người định hình diện mạo công trình ${site.officialName} trong tiến trình lịch sử đô thị Nam Bộ.`,
      latOffset: -0.0005,
      lngOffset: 0.0007,
      pos3D: [1.9, 1.5, 1.5],
    },
    {
      id: `${site.id}-ereignis`,
      layer: 'ereignis',
      code: lang === 'en' ? 'Event' : 'Sự kiện',
      color: '#D9822B',
      title: firstMilestone
        ? `${firstMilestone.year} — Sự kiện Lịch sử`
        : `Dấu mốc Lịch sử (${site.commencementYear || '1868'})`,
      subtitle: site.rankingLevel,
      detail: firstMilestone?.event || site.summary,
      latOffset: 0.00065,
      lngOffset: 0.0006,
      pos3D: [1.7, 2.4, -1.2],
    },
    {
      id: `${site.id}-quellen`,
      layer: 'quellen',
      code: lang === 'en' ? 'Archive' : 'Tư liệu',
      color: '#3AA690',
      title:
        lang === 'en'
          ? `Archival Dossier #${site.identifierCode}`
          : `Lưu trữ gốc #${site.identifierCode}`,
      subtitle: site.decisionDecreeNumber || 'Tư liệu Bản vẽ & Địa bạ cổ',
      detail:
        secondMilestone?.event ||
        'Hồ sơ bản vẽ mặt cắt kiến trúc, ảnh chụp bưu thiếp Đông Dương và quyết định xếp hạng di tích.',
      latOffset: -0.0006,
      lngOffset: -0.00055,
      pos3D: [-1.7, 1.2, -1.5],
    },
    {
      id: `${site.id}-audio`,
      layer: 'audio',
      code: lang === 'en' ? 'Audio' : 'Thuyết minh',
      color: '#38BDF8',
      title:
        lang === 'en'
          ? `Spatial Audio Point: ${site.officialName}`
          : `Trạm Thuyết minh 3D: ${site.officialName}`,
      subtitle: 'Tần số âm thanh vòm 360° & Thuyết minh chuyên khảo',
      detail:
        'Bấm để nghe phân tích chuyên sâu về lịch sử kiến tạo, vật liệu địa chất và giai thoại di sản.',
      latOffset: 0.00015,
      lngOffset: 0.00085,
      pos3D: [0, 2.9, 1.8],
    },
  ];
}

// ============================================================================
// 2. HISTORICAL ERAS GENERATOR FOR CHÂTEAU D'AMBOISE 3D INTERFACE
// ============================================================================
export interface ChateauEraItem {
  id: string;
  shortPeriod: string;
  titleVi: string;
  titleEn: string;
  figureName: string;
  figureRole: string;
  figureYears: string;
  archNote: string;
  blueprintCaption: string;
}

export function getChateauErasForSite(site: HeritageSite): ChateauEraItem[] {
  const cleanArch = (site.architect || 'Kiến trúc sư Đông Dương').split('(')[0].trim();

  if (site.id === 'HCM-DT-001' || site.id === 'dinh-doc-lap') {
    return [
      {
        id: 'era-pre-1860',
        shortPeriod: 'Trước 1860 (Gia Định)',
        titleVi: 'Thành Bát Quái & Quy hoạch Gia Định Cổ (1790–1859)',
        titleEn: 'Bagua Citadel & Ancient Gia Dinh Planning (1790–1859)',
        figureName: 'Trần Văn Học & Olivier de Puymanel',
        figureRole: 'Quy hoạch Thành Quy (Thành Bát Quái) — Gia Định',
        figureYears: '1790–1835',
        archNote:
          'Khu đất cao trung tâm Thành Gia Định cổ với hệ thống hào nước và trục thần đạo hướng ra sông Sài Gòn trước khi người Pháp quy hoạch đại lộ Norodom.',
        blueprintCaption: 'Bản đồ Thành Bát Quái Gia Định năm 1815 (Trần Văn Học)',
      },
      {
        id: 'era-1868-1900',
        shortPeriod: '1868–1900 (Khởi dựng)',
        titleVi: 'Dinh Norodom — KTS. Achille-Antoine Hermitte (1868–1873)',
        titleEn: 'Norodom Palace — Arch. Achille-Antoine Hermitte (1868–1873)',
        figureName: 'KTS. Achille-Antoine Hermitte',
        figureRole: 'Kiến trúc sư Pháp (Tân Cổ điển Đế chế thứ hai)',
        figureYears: '1840–1870',
        archNote:
          'Khởi dựng ngày 23/2/1868 với mặt tiền rộng 80m theo phong cách Tân cổ điển Pháp, đá xanh Biên Hòa và vật liệu nhập khẩu từ Pháp.',
        blueprintCaption: 'Bưu thiếp cổ Dinh Norodom (Phủ Toàn quyền Đông Dương) năm 1898',
      },
      {
        id: 'era-1945-1954',
        shortPeriod: '1945–1954 (Chuyển giao)',
        titleVi: 'Giai đoạn Chuyển giao Lịch sử Đông Dương (1945–1954)',
        titleEn: 'Indochina Historical Transition Era (1945–1954)',
        figureName: 'Cao ủy Pháp & Chính quyền Sài Gòn',
        figureRole: 'Biến động Chính trị & Đô thị Sài Gòn',
        figureYears: '1945–1954',
        archNote:
          'Công trình chứng kiến sự chuyển giao quyền lực sau Thế chiến II và Hiệp định Genève 1954, đổi tên từ Dinh Norodom sang Dinh Độc Lập.',
        blueprintCaption: 'Không ảnh trục đại lộ Norodom (Lê Duẩn) năm 1950',
      },
      {
        id: 'era-1955-1975',
        shortPeriod: '1955–1975 (Tái thiết)',
        titleVi: 'KTS. Ngô Viết Thụ — Kiến trúc Hiện đại Phương Đông (1962–1966)',
        titleEn: 'Arch. Ngo Viet Thu — Oriental Modernist Masterpiece (1962–1966)',
        figureName: 'KTS. Ngô Viết Thụ (Khôi nguyên La Mã)',
        figureRole: 'Kiến trúc sư trưởng (Premier Grand Prix de Rome 1955)',
        figureYears: '1926–2000',
        archNote:
          'Thiết kế mới hoàn toàn năm 1962 theo chiết tự chữ CÁT (吉), chữ KHẨU (口), chữ TRUNG (忠) cùng hệ rèm hoa đá hình đốt trúc độc bản.',
        blueprintCaption: 'Bản vẽ mặt đứng chính chữ CÁT của KTS. Ngô Viết Thụ (1962)',
      },
      {
        id: 'era-1975-2026',
        shortPeriod: '1975–2026 (Bảo tồn)',
        titleVi: 'Hội Trường Thống Nhất — Di tích Quốc gia Đặc biệt (1975–2026)',
        titleEn: 'Reunification Hall — Special National Monument (1975–2026)',
        figureName: 'Hội đồng Bảo tồn Di sản Quốc gia',
        figureRole: 'Di tích Quốc gia Đặc biệt (Quyết định 1272/QĐ-TTg)',
        figureYears: '1975–2026',
        archNote:
          'Bảo tồn nguyên trạng 100 phòng chức năng, hầm chỉ huy ngầm chịu bom và số hóa không gian 3D / BIM phục vụ nghiên cứu quốc tế.',
        blueprintCaption: 'Mô hình số hóa BIM / Quang trắc 3D Hội Trường Thống Nhất (2026)',
      },
    ];
  }

  return [
    {
      id: 'era-1',
      shortPeriod: 'Trước 1860 (Gia Định)',
      titleVi: `Địa tầng Lịch sử Sơ khởi — ${site.address.district} (Trước 1860)`,
      titleEn: `Early Historical Stratum — ${site.address.district} (Pre-1860)`,
      figureName: 'Cư dân & Nghệ nhân Nam Bộ cổ',
      figureRole: 'Khai phá địa tầng văn hóa & giao thương đường thủy',
      figureYears: 'Thế kỷ XVIII – 1859',
      archNote: `Khu vực ${site.address.district} hình thành mạng lưới kênh rạch, làng nghề và cấu trúc phòng thủ truyền thống trên nền địa chất Đông Nam Bộ.`,
      blueprintCaption: `Bản đồ địa hình cổ khu vực ${site.address.district} (1815)`,
    },
    {
      id: 'era-2',
      shortPeriod: '1868–1900 (Khởi dựng)',
      titleVi: `${cleanArch} — Thời kỳ Kiến tạo Nguyên bản (${site.commencementYear || '1880–1900'})`,
      titleEn: `${cleanArch} — Original Construction Era (${site.commencementYear || '1880–1900'})`,
      figureName: cleanArch,
      figureRole: `Tác giả kiến trúc (${site.architecturalStyle})`,
      figureYears: site.chronology || 'Cuối thế kỷ XIX',
      archNote:
        site.milestones?.[0]?.event ||
        `Khởi dựng công trình theo phong cách ${site.architecturalStyle} với kỹ thuật vật liệu ${site.materials?.slice(0, 2).join(', ') || 'đá và gạch cổ'}.`,
      blueprintCaption: `Tư liệu bản vẽ & bưu thiếp cổ công trình (${site.commencementYear || 1900})`,
    },
    {
      id: 'era-3',
      shortPeriod: '1945–1954 (Biến động)',
      titleVi: `Biến chuyển Đô thị & Lịch sử Kháng chiến (1945–1954)`,
      titleEn: `Urban Transformation & Resistance Era (1945–1954)`,
      figureName: 'Chứng nhân Lịch sử Đông Nam Bộ',
      figureRole: 'Giai đoạn bản lề thế kỷ XX',
      figureYears: '1945–1954',
      archNote:
        site.milestones?.[1]?.event ||
        `Công trình đi qua giai đoạn lịch sử 1945–1954, ghi dấu nhiều sự kiện văn hóa – quân sự quan trọng tại ${site.address.district}.`,
      blueprintCaption: `Tư liệu ảnh lưu trữ giai đoạn 1945–1954`,
    },
    {
      id: 'era-4',
      shortPeriod: '1955–1975 (Cải tạo)',
      titleVi: `Giai đoạn 1955–1975 — Dấu ấn Lịch sử & Kỹ thuật`,
      titleEn: `1955–1975 Era — Historical & Structural Imprint`,
      figureName: cleanArch,
      figureRole: 'Bảo tồn & Mở rộng kết cấu công trình',
      figureYears: '1955–1975',
      archNote:
        site.milestones?.[2]?.event ||
        site.summary,
      blueprintCaption: `Hồ sơ khảo sát kiến trúc giai đoạn 1955–1975`,
    },
    {
      id: 'era-5',
      shortPeriod: '1975–2026 (Bảo tồn)',
      titleVi: `Trùng tu Khoa học & Số hóa Di sản 3D (1975–2026)`,
      titleEn: `Scientific Conservation & 3D Digital Twin (1975–2026)`,
      figureName: 'Viện Bảo tồn Di tích & Dấu Ấn Việt 3D',
      figureRole: site.rankingLevel,
      figureYears: '1975–2026',
      archNote:
        site.conservationNotes ||
        'Công trình được bảo tồn nghiêm ngặt và quét 3D/quang trắc độ chính xác cao phục vụ trưng bày bảo tàng số.',
      blueprintCaption: `Bản sao số 3D (Digital Twin) chuẩn WGS84 — Năm 2026`,
    },
  ];
}

// ============================================================================
// 3. LISBOA ROMANA DIAGONAL BEFORE / AFTER SPLIT SLIDER OVERLAY
// ============================================================================
const CUSTOM_HISTORICAL_STORAGE_KEY = 'heritage_custom_historical_photos_v1';

interface HistoricalArchiveEntry {
  index: number;
  siteId: string;
  url?: string;
  title: string;
  titleEn: string;
  eraTag: string;
  caption: string;
  captionEn: string;
  credit: string;
  isFilteredArchival?: boolean;
  filterCss?: string;
}

const HISTORICAL_ARCHIVE_LIST: HistoricalArchiveEntry[] = [
  {
    index: 0,
    siteId: 'HCM-DT-001',
    title: 'Dinh Toàn quyền / Dinh Norodom (1896)',
    titleEn: 'Palais Norodom / Governor-General Palace (1896)',
    eraTag: '1896',
    caption: 'Dinh Toàn quyền Đông Dương tại Sài Gòn năm 1896 trước khi KTS Ngô Viết Thụ tái thiết năm 1962.',
    captionEn: 'Indochina Governor-General Palace in 1896 prior to Ngo Viet Thu’s 1962 reconstruction.',
    credit: 'Kho lưu trữ Đông Dương 1896',
  },
  {
    index: 1,
    siteId: 'HCM-DT-002',
    title: 'Théâtre Municipal de Saïgon (1920)',
    titleEn: 'Municipal Theatre of Saigon (1920)',
    eraTag: '1920',
    caption: 'Mặt tiền Nhà hát Lớn Sài Gòn năm 1920 với vòm cửa Baroque và phù điêu đắp nổi trên đường Catinat.',
    captionEn: 'Saigon Opera House facade in 1920 along historic Rue Catinat.',
    credit: 'Bưu ảnh Sài Gòn 1920',
  },
  {
    index: 2,
    siteId: 'HCM-DT-003',
    title: 'Hôtel des Postes de Saïgon (1900)',
    titleEn: 'Hôtel des Postes de Saïgon (1900)',
    eraTag: '1900',
    caption: 'Bưu điện Trung tâm Sài Gòn đầu thế kỷ XX với mặt đứng Tân Cổ điển Pháp và hệ khung vòm thép.',
    captionEn: 'Saigon Central Post Office circa 1900 with French Neoclassical facade and Eiffel iron truss.',
    credit: 'Tư liệu Bưu điện Sài Gòn 1900',
  },
  {
    index: 3,
    siteId: 'HCM-DT-004',
    title: 'Les Halles Centrales de Saïgon (1914)',
    titleEn: 'Les Halles Centrales de Saïgon (1914)',
    eraTag: '1914',
    caption: 'Chợ Mới Bến Thành năm khánh thành 1914 cùng tháp đồng hồ cửa Nam và quảng trường giao lộ trung tâm.',
    captionEn: 'Newly built Ben Thanh Market (Les Halles Centrales) in 1914 with its South Gate clock tower.',
    credit: 'Bưu ảnh Đông Dương 1914',
  },
  {
    index: 4,
    siteId: 'HCM-DT-005',
    title: 'Cathédrale Notre-Dame de Saïgon (1900)',
    titleEn: 'Cathédrale Notre-Dame de Saïgon (1900)',
    eraTag: '1900',
    caption: 'Vương cung Thánh đường Đức Bà Sài Gòn năm 1900 với hai tháp chuông gạch trần Marseille nguyên bản.',
    captionEn: 'Notre-Dame Cathedral of Saigon circa 1900 featuring original Marseille red brick spires.',
    credit: 'Tư liệu Sài Gòn xưa 1900',
  },
  {
    index: 5,
    siteId: 'HCM-DT-006',
    title: 'Musée Blanchard de la Brosse (1929)',
    titleEn: 'Musée Blanchard de la Brosse (1929)',
    eraTag: '1929',
    caption: 'Bảo tàng Blanchard de la Brosse năm 1929 — công trình khai sinh phong cách Kiến trúc Đông Dương.',
    captionEn: 'Blanchard de la Brosse Museum in 1929 — landmark of Ernest Hébrard’s Indochinese style.',
    credit: 'Tư liệu Bảo tàng 1929',
  },
  {
    index: 6,
    siteId: 'HCM-DT-007',
    title: 'Messageries Maritimes de Saïgon (1900)',
    titleEn: 'Messageries Maritimes de Saïgon (1900)',
    eraTag: '1900',
    caption: 'Trụ sở Hãng vận tải biển Messageries Maritimes (Bến Nhà Rồng) bên thương cảng Sài Gòn năm 1900.',
    captionEn: 'Messageries Maritimes Headquarters (Nha Rong Wharf) along Saigon River circa 1900.',
    credit: 'Tư liệu Cảng Sài Gòn 1900',
  },
  {
    index: 7,
    siteId: 'HCM-DT-008',
    title: 'Lăng Ông Bà Chiểu – Gia Định xưa (1920)',
    titleEn: 'Ba Chieu Mausoleum – Historic Gia Dinh (1920)',
    eraTag: '1920',
    caption: 'Tư liệu Lăng Tả quân Lê Văn Duyệt (Tombeau d’un Mandarin) vùng Gia Định xưa trên bưu ảnh 1920.',
    captionEn: 'Historic 1920 postcard of General Le Van Duyet Mausoleum in Gia Dinh.',
    credit: 'Bưu ảnh Gia Định 1920',
  },
  {
    index: 8,
    siteId: 'HCM-DT-009',
    title: 'Vùng Đất Thép Củ Chi (Tư liệu 1967)',
    titleEn: 'Cu Chi Iron Land Tunnels (1967 Archive)',
    eraTag: '1967',
    caption: 'Ảnh tư liệu cửa hầm bí mật vùng đất thép Củ Chi năm 1967 thuộc hồ sơ chiến dịch Cedar Falls (NARA).',
    captionEn: '1967 NARA archival photograph of a concealed Cu Chi tunnel entrance during Operation Cedar Falls.',
    credit: 'Kho lưu trữ Quốc gia NARA 1967',
  },
  {
    index: 9,
    siteId: 'HCM-DT-010',
    title: 'Di chỉ Mộ chum Cần Giờ (~2.500 năm trước)',
    titleEn: 'Giong Ca Vo Jar Burials (~2,500 Years BP)',
    eraTag: '~500 BCE',
    caption: 'Tư liệu khai quật & cổ vật mộ chum gốm Giồng Cá Vồ niên đại khoảng 2.500 năm trước.',
    captionEn: 'Archival documentation of Giong Ca Vo archaeological jar burial artifacts (~500 BCE).',
    credit: 'Tư liệu Khảo cổ Cần Giờ',
    isFilteredArchival: true,
    filterCss: 'sepia(0.85) contrast(1.15) brightness(0.86)',
  },
  {
    index: 10,
    siteId: 'HCM-DT-011',
    title: 'Tổ đình Giác Lâm (Dựng năm 1744)',
    titleEn: 'Giac Lam Ancestral Pagoda (Founded 1744)',
    eraTag: '1744',
    caption: 'Ngôi tổ đình cổ nhất vùng Gia Định (dựng năm 1744) phục chế tông phim lưu trữ đầu thế kỷ XX.',
    captionEn: 'Oldest pagoda in Gia Dinh (1744) presented in archival plate documentation.',
    credit: 'Tư liệu Tổ đình Giác Lâm',
    isFilteredArchival: true,
    filterCss: 'sepia(0.86) contrast(1.16) brightness(0.84) saturate(0.75)',
  },
  {
    index: 11,
    siteId: 'HCM-DT-012',
    title: 'Chùa Ông Chợ Lớn (Đầu thế kỷ XX)',
    titleEn: 'Cholon Quan Am / Nghia An Hall (Early 20C)',
    eraTag: 'ĐẦU TK XX',
    caption: 'Kiến trúc hội quán Triều Châu cổ kính vùng Chợ Lớn phục chế sắc độ ảnh phim đầu thế kỷ XX.',
    captionEn: 'Historic Cholon Teochew assembly architecture in archival plate documentation.',
    credit: 'Tư liệu Chợ Lớn',
    isFilteredArchival: true,
    filterCss: 'sepia(0.86) contrast(1.16) brightness(0.84) saturate(0.75)',
  },
  {
    index: 12,
    siteId: 'BRVT-DT-001',
    title: 'Villa Blanche – Cap Saint-Jacques (1920)',
    titleEn: 'Villa Blanche – Cap Saint-Jacques (1920)',
    eraTag: '1920',
    caption: 'Bạch Dinh bên sườn Núi Lớn hướng ra Bãi Trước Vũng Tàu trên bưu ảnh lưu trữ năm 1920.',
    captionEn: 'Villa Blanche overlooking Front Beach at Cap Saint-Jacques (Vung Tau) in 1920.',
    credit: 'Bưu ảnh Cap Saint-Jacques 1920',
  },
  {
    index: 13,
    siteId: 'BRVT-DT-002',
    title: 'Đền Ông Trần Long Sơn (1910–1929)',
    titleEn: 'Nha Lon Long Son Timber Complex (1910–1929)',
    eraTag: '1910–1929',
    caption: 'Quần thể kiến trúc gỗ truyền thống Nhà Lớn Long Sơn đầu thế kỷ XX.',
    captionEn: 'Traditional timber heritage complex of Nha Lon Long Son in early 20C archival plate.',
    credit: 'Tư liệu Di sản Long Sơn',
    isFilteredArchival: true,
    filterCss: 'sepia(0.88) contrast(1.18) brightness(0.82)',
  },
  {
    index: 14,
    siteId: 'BRVT-DT-003',
    title: 'Căn cứ Địa đạo Long Phước (1948–1968)',
    titleEn: 'Long Phuoc Resistance Tunnels (1948–1968)',
    eraTag: '1948–1968',
    caption: 'Hệ thống căn cứ địa đạo Long Phước thời kỳ kháng chiến trong hồ sơ lưu trữ lịch sử.',
    captionEn: 'Long Phuoc resistance tunnel base (1948–1968) in archival historical records.',
    credit: 'Tư liệu Kháng chiến Bà Rịa',
    isFilteredArchival: true,
    filterCss: 'grayscale(0.65) sepia(0.55) contrast(1.22) brightness(0.8)',
  },
  {
    index: 15,
    siteId: 'BD-DT-001',
    title: 'Nhà rường Thủ Dầu Một (1889–1892)',
    titleEn: 'Thu Dau Mot 5-Bay Heritage House (1889–1892)',
    eraTag: '1892',
    caption: 'Ngôi nhà rường gỗ 5 gian 2 chái họ Trần tại Phú Cường năm 1892.',
    captionEn: 'Traditional 1892 5-bay timber residence in Thu Dau Mot in archival plate documentation.',
    credit: 'Tư liệu Thủ Dầu Một 1892',
    isFilteredArchival: true,
    filterCss: 'sepia(0.9) contrast(1.18) brightness(0.82)',
  },
  {
    index: 16,
    siteId: 'BD-DT-002',
    title: 'Chiến khu Tam Giác Sắt Bến Cát (1967)',
    titleEn: 'Iron Triangle – Ben Cat War Zone (1967)',
    eraTag: '1967',
    caption: 'Tư liệu lịch sử vùng chiến khu Tam Giác Sắt – Tây Nam Bến Cát năm 1967 (Kho lưu trữ NARA).',
    captionEn: '1967 NARA historical archive record from the Iron Triangle – Ben Cat region.',
    credit: 'Kho lưu trữ Quốc gia NARA 1967',
  },
];

export const HISTORICAL_ARCHIVE_BY_SITE: Record<string, HistoricalArchiveEntry> = Object.fromEntries(
  HISTORICAL_ARCHIVE_LIST.map((entry) => [entry.siteId, entry])
);

export function getHistoricalArchiveForSite(siteId: string): HistoricalArchiveEntry | undefined {
  return HISTORICAL_ARCHIVE_BY_SITE[siteId];
}

const CUSTOM_HISTORICAL_CHANGED_EVENT = 'heritage_custom_historical_photos_changed';

function loadCustomHistoricalMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CUSTOM_HISTORICAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getCustomHistoricalPhotoForSite(siteId: string): string | undefined {
  return loadCustomHistoricalMap()[siteId];
}

export function saveCustomHistoricalPhotoForSite(
  siteId: string,
  photoDataOrUrl: string
): Record<string, string> {
  const current = loadCustomHistoricalMap();
  const updated = { ...current, [siteId]: photoDataOrUrl };
  try {
    localStorage.setItem(CUSTOM_HISTORICAL_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CUSTOM_HISTORICAL_CHANGED_EVENT));
  }
  return updated;
}

export function removeCustomHistoricalPhotoForSite(siteId: string): Record<string, string> {
  const current = loadCustomHistoricalMap();
  const updated = { ...current };
  delete updated[siteId];
  try {
    localStorage.setItem(CUSTOM_HISTORICAL_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CUSTOM_HISTORICAL_CHANGED_EVENT));
  }
  return updated;
}

type CompareMode = 'diagonal' | 'vertical' | 'xray';

interface LisboaDiagonalSplitProps {
  site: HeritageSite;
  sites?: HeritageSite[];
  lang: string;
  onClose: () => void;
  onExploreAction?: (activeSite?: HeritageSite) => void;
  onSwitchSite?: (site: HeritageSite) => void;
  onUpdateCustomPhoto?: (siteId: string, photoDataUrl: string) => void;
  onRestoreDefaultPhoto?: (siteId: string) => void;
}

export const LisboaDiagonalSplitOverlay: React.FC<LisboaDiagonalSplitProps> = ({
  site,
  sites: sitesProp,
  lang,
  onClose,
  onExploreAction,
  onSwitchSite,
  onUpdateCustomPhoto,
  onRestoreDefaultPhoto,
}) => {
  const [activeSiteId, setActiveSiteId] = useState<string>(site.id);
  const [compareMode, setCompareMode] = useState<CompareMode>('diagonal');
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isSiteMenuOpen, setIsSiteMenuOpen] = useState<boolean>(false);
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState<boolean>(false);

  // Photo state & fallback tracking (live synced across all tabs via useHeritageRealPhotos)
  const {
    customPhotosMap: customModernMap,
    setCustomPhotosMap: setCustomModernMap,
    wikimediaCacheMap,
  } = useHeritageRealPhotos();
  const [customHistoricalMap, setCustomHistoricalMap] = useState<Record<string, string>>(() =>
    loadCustomHistoricalMap()
  );
  const [modernCandidateIdx, setModernCandidateIdx] = useState<number>(0);
  const [histLoadFailed, setHistLoadFailed] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const modernFileInputRef = useRef<HTMLInputElement>(null);
  const historicalFileInputRef = useRef<HTMLInputElement>(null);
  const lastHapticStepRef = useRef<number>(Math.floor(50 / 5));
  const lastHapticAtRef = useRef<number>(0);
  const isCenterDetentRef = useRef<boolean>(true);
  const isEdgeDetentRef = useRef<boolean>(false);

  useEffect(() => {
    setActiveSiteId(site.id);
  }, [site.id]);

  useEffect(() => {
    const syncHist = () => setCustomHistoricalMap(loadCustomHistoricalMap());
    window.addEventListener(CUSTOM_HISTORICAL_CHANGED_EVENT, syncHist);
    return () => window.removeEventListener(CUSTOM_HISTORICAL_CHANGED_EVENT, syncHist);
  }, []);

  // Resolve all 17 sites using the Single Source of Truth (Wikimedia Commons API + Admin custom photos)
  const resolvedSites = useMemo<HeritageSite[]>(() => {
    const baseList = sitesProp && sitesProp.length > 0 ? sitesProp : HERITAGE_SITES;
    return baseList.map((s) => ({
      ...s,
      photos: resolveSitePhotos(s, customModernMap, wikimediaCacheMap),
    }));
  }, [sitesProp, customModernMap, wikimediaCacheMap]);

  const activeSiteIndex = useMemo(() => {
    const idx = resolvedSites.findIndex((s) => s.id === activeSiteId);
    return idx >= 0 ? idx : 0;
  }, [resolvedSites, activeSiteId]);

  const activeSite = useMemo(
    () => resolvedSites[activeSiteIndex] || site,
    [resolvedSites, activeSiteIndex, site]
  );

  // Reset image fallback indices whenever site or custom modern photo changes
  useEffect(() => {
    setModernCandidateIdx(0);
    setHistLoadFailed(false);
  }, [activeSite.id, customModernMap[activeSite.id]]);

  // Map historical archive by both site.id and 0..16 index
  const archiveMeta: HistoricalArchiveEntry = useMemo(() => {
    return (
      HISTORICAL_ARCHIVE_BY_SITE[activeSite.id] ||
      HISTORICAL_ARCHIVE_LIST[activeSiteIndex] || {
        index: activeSiteIndex,
        siteId: activeSite.id,
        title: `${activeSite.folkName || activeSite.officialName} (${activeSite.commencementYear})`,
        titleEn: `${activeSite.officialName} (${activeSite.commencementYear})`,
        eraTag: String(activeSite.commencementYear),
        caption: `Tư liệu kiến trúc lịch sử ${activeSite.officialName} (${activeSite.chronology}).`,
        captionEn: `Archival documentation of ${activeSite.officialName} (${activeSite.chronology}).`,
        credit: 'Kho Tư liệu Di sản Đông Nam Bộ · Phục chế Sepia',
        isFilteredArchival: true,
      }
    );
  }, [activeSite, activeSiteIndex]);

  // Build prioritized modern 2026 candidates list strictly from real custom/Wikimedia photos
  const modernCandidates = useMemo(() => {
    const list: string[] = [];
    const pushUnique = (u?: string) => {
      if (u && !list.includes(u)) list.push(u);
    };
    const norm = normalizeCustomPhotoSlot(customModernMap[activeSite.id]);
    pushUnique(norm.photo1);
    pushUnique(norm.photo2);
    (activeSite.photos || []).forEach(pushUnique);
    return list;
  }, [activeSite.id, activeSite.photos, customModernMap]);

  const currentModernSrc = modernCandidates[Math.min(modernCandidateIdx, Math.max(0, modernCandidates.length - 1))] || '';
  const allModernFailed = modernCandidateIdx >= modernCandidates.length;

  // Historical archive source: only render <img> when Admin uploaded a custom archival photo or modern photo exists
  const customHistSrc = customHistoricalMap[activeSite.id];
  const hasRealModernFallback = Boolean(currentModernSrc && !allModernFailed);
  const useSmartFallback = !customHistSrc && hasRealModernFallback && (histLoadFailed || !archiveMeta.url);
  const currentHistoricalSrc = customHistSrc || (useSmartFallback ? currentModernSrc : archiveMeta.url || '');
  const applyVintageFilter = !customHistSrc && Boolean(archiveMeta.isFilteredArchival || useSmartFallback);

  const clampPct = (val: number) => Math.max(0, Math.min(100, val));

  const emitLensSliderHaptic = (nextPct: number, isInitialPress = false) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const clamped = clampPct(nextPct);
    const rounded = Math.round(clamped);
    const inCenterBand = Math.abs(rounded - 50) <= 1;
    const atEdge = rounded <= 1 || rounded >= 99;
    const step = Math.floor(rounded / 5);

    if (inCenterBand && !isCenterDetentRef.current) {
      isCenterDetentRef.current = true;
      isEdgeDetentRef.current = false;
      lastHapticStepRef.current = step;
      lastHapticAtRef.current = now;
      triggerHaptic('detent');
      return;
    }
    if (!inCenterBand) {
      isCenterDetentRef.current = false;
    }

    if (atEdge && !isEdgeDetentRef.current) {
      isEdgeDetentRef.current = true;
      lastHapticStepRef.current = step;
      lastHapticAtRef.current = now;
      triggerHaptic('detent');
      return;
    }
    if (!atEdge) {
      isEdgeDetentRef.current = false;
    }

    if (step !== lastHapticStepRef.current && now - lastHapticAtRef.current >= 55) {
      lastHapticStepRef.current = step;
      lastHapticAtRef.current = now;
      triggerHaptic('tick');
      return;
    }

    if (isInitialPress) {
      lastHapticAtRef.current = now;
      triggerHaptic('soft');
    }
  };

  const updateSplitFromClientX = (
    clientX: number,
    targetEl?: HTMLElement | null,
    isInitialPress = false
  ) => {
    const el = targetEl || containerRef.current;
    const rect = el?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const rawPct = ((clientX - rect.left) / rect.width) * 100;
    const nextPct = clampPct(rawPct);
    setSliderPosition(nextPct);
    emitLensSliderHaptic(nextPct, isInitialPress);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isSiteMenuOpen) setIsSiteMenuOpen(false);
    if (isUploadMenuOpen) setIsUploadMenuOpen(false);
    setIsDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateSplitFromClientX(e.clientX, undefined, true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateSplitFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
  };

  const handleSelectComparisonSite = (nextSite: HeritageSite) => {
    triggerHaptic(nextSite.id === activeSiteId ? 'soft' : 'selection');
    setActiveSiteId(nextSite.id);
    setIsSiteMenuOpen(false);
    if (onSwitchSite) {
      onSwitchSite(nextSite);
    }
  };

  const handleCycleSite = (delta: number) => {
    const total = resolvedSites.length;
    if (total === 0) return;
    const nextIdx = (activeSiteIndex + delta + total) % total;
    handleSelectComparisonSite(resolvedSites[nextIdx]);
  };

  const handleUploadLocalPhoto = async (file: File, target: 'modern' | 'historical') => {
    setIsUploading(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 1600, 0.88);
      if (target === 'modern') {
        const nextMap = saveCustomSitePhoto(activeSite.id, dataUrl);
        setCustomModernMap(nextMap);
        setModernCandidateIdx(0);
        if (onUpdateCustomPhoto) onUpdateCustomPhoto(activeSite.id, dataUrl);
      } else {
        setCustomHistoricalMap((prev) => {
          const next = { ...prev, [activeSite.id]: dataUrl };
          try {
            localStorage.setItem(CUSTOM_HISTORICAL_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore quota errors
          }
          return next;
        });
        setHistLoadFailed(false);
      }
    } finally {
      setIsUploading(false);
      setIsUploadMenuOpen(false);
    }
  };

  const handleRestoreDefaultsForSite = () => {
    const nextModern = removeCustomSitePhoto(activeSite.id);
    setCustomModernMap(nextModern);
    if (onRestoreDefaultPhoto) onRestoreDefaultPhoto(activeSite.id);
    setCustomHistoricalMap((prev) => {
      const next = { ...prev };
      delete next[activeSite.id];
      try {
        localStorage.setItem(CUSTOM_HISTORICAL_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setModernCandidateIdx(0);
    setHistLoadFailed(false);
    setIsUploadMenuOpen(false);
  };

  // Clip-path geometry according to Section 1 specs
  const diagTopX = clampPct(sliderPosition + 8);
  const diagBottomX = clampPct(sliderPosition - 8);
  const historicalLayerStyle: React.CSSProperties =
    compareMode === 'diagonal'
      ? {
          clipPath: `polygon(${diagTopX}% 0%, 100% 0%, 100% 100%, ${diagBottomX}% 100%)`,
        }
      : compareMode === 'vertical'
      ? {
          clipPath: `inset(0 0 0 ${sliderPosition}%)`,
        }
      : {
          opacity: sliderPosition / 100,
        };

  const modeLabels = [
    {
      id: 'diagonal' as CompareMode,
      label: lang === 'en' ? 'Diagonal' : lang === 'zh' ? '斜线' : 'Cắt chéo',
    },
    {
      id: 'vertical' as CompareMode,
      label: lang === 'en' ? 'Vertical' : lang === 'zh' ? '垂直' : 'Chia dọc',
    },
    {
      id: 'xray' as CompareMode,
      label: lang === 'en' ? 'Crossfade' : lang === 'zh' ? '透视' : 'Xuyên mờ',
    },
  ];

  const hasCustomForActive = Boolean(customModernMap[activeSite.id] || customHistoricalMap[activeSite.id]);

  // Camera dial ruler pointer dragging
  const [isDialDragging, setIsDialDragging] = useState(false);
  const handleDialPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDialDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateSplitFromClientX(e.clientX, dialRef.current, true);
  };
  const handleDialPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!isDialDragging) return;
    updateSplitFromClientX(e.clientX, dialRef.current);
  };
  const handleDialPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (isDialDragging) {
      setIsDialDragging(false);
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="fixed inset-0 z-[1300] w-screen h-screen bg-[#111113] select-none overflow-hidden cursor-ew-resize touch-none"
    >
      {/* Hidden local file inputs for custom Modern / Historical uploads */}
      <input
        ref={modernFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUploadLocalPhoto(f, 'modern');
          e.target.value = '';
        }}
      />
      <input
        ref={historicalFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUploadLocalPhoto(f, 'historical');
          e.target.value = '';
        }}
      />

      {/* ====================================================================
          LAYER 0 (z-0): PRESENT DAY 2026 REAL PHOTOGRAPHY OR MUSEUM PLATE
         ==================================================================== */}
      <div className="absolute inset-0 z-0 w-full h-full bg-[#171817]">
        {currentModernSrc && !allModernFailed ? (
          <HeritageSmoothImage
            key={`mod-${activeSite.id}-${modernCandidateIdx}-${currentModernSrc.slice(0, 40)}`}
            src={currentModernSrc}
            alt={`${activeSite.officialName} - 2026 Modern`}
            waitTone="dark"
            onError={() => {
              if (modernCandidateIdx < modernCandidates.length - 1) {
                setModernCandidateIdx((prev) => prev + 1);
              } else {
                setModernCandidateIdx(modernCandidates.length);
              }
            }}
            className="w-full h-full object-cover object-center"
            draggable={false}
          />
        ) : (
          <HeritageTypographicPlate
            site={activeSite}
            index={activeSiteIndex}
            variant="detail"
            badgeOverride={lang === 'en' ? 'PRESENT DAY • 2026' : lang === 'zh' ? '实景现状 • 2026' : 'HIỆN TRẠNG • 2026'}
            className="p-10 sm:p-20 pt-28 sm:pt-32 pb-28 sm:pb-32"
          />
        )}
      </div>

      {/* ====================================================================
          LAYER 1 (z-10): HISTORICAL ARCHIVE PHOTOGRAPHY OR ARCHIVAL PLATE
         ==================================================================== */}
      <div
        className="absolute inset-0 z-10 w-full h-full pointer-events-none"
        style={historicalLayerStyle}
      >
        {currentHistoricalSrc && !(histLoadFailed && !customHistSrc && !hasRealModernFallback) ? (
          <HeritageSmoothImage
            key={`hist-${activeSite.id}-${useSmartFallback ? 'fb' : 'orig'}-${customHistSrc ? 'custom' : 'std'}`}
            src={currentHistoricalSrc}
            alt={`${activeSite.officialName} - Historical Archive`}
            waitTone="dark"
            onError={() => {
              if (!histLoadFailed && !customHistSrc) {
                setHistLoadFailed(true);
              }
            }}
            className="w-full h-full object-cover object-center"
            style={{
              filter: applyVintageFilter
                ? archiveMeta.filterCss || 'sepia(0.88) contrast(1.18) brightness(0.82)'
                : 'sepia(0.22) contrast(1.06) brightness(0.92)',
            }}
            draggable={false}
          />
        ) : (
          <HeritageTypographicPlate
            site={activeSite}
            index={activeSiteIndex}
            variant="archival"
            titleOverride={lang === 'en' ? archiveMeta.titleEn : archiveMeta.title}
            subtitleOverride={lang === 'en' ? archiveMeta.captionEn : archiveMeta.caption}
            badgeOverride={`${lang === 'en' ? 'ARCHIVE' : lang === 'zh' ? '历史档案' : 'TƯ LIỆU'} · ${archiveMeta.eraTag}`}
            className="p-10 sm:p-20 pt-28 sm:pt-32 pb-28 sm:pb-32"
          />
        )}
        {/* Subtle warm archival frame border on right overlay */}
        {applyVintageFilter && (
          <div className="absolute inset-4 sm:inset-7 border border-[#C5A059]/30 rounded-2xl pointer-events-none" />
        )}
      </div>

      {/* ====================================================================
          TOP CONTRAST GRADIENT SCRIM (z-20) — ensures legible white & gold text over bright skies
         ==================================================================== */}
      <div className="absolute top-0 inset-x-0 h-56 bg-gradient-to-b from-black/75 via-black/25 to-transparent z-20 pointer-events-none" />

      {/* ====================================================================
          SIDE METADATA CAPTIONS (z-20)
         ==================================================================== */}
      {/* LEFT CAPTION: PRESENT DAY 2026 */}
      <div
        className="absolute top-32 md:top-24 left-5 sm:left-8 z-20 text-left max-w-xs sm:max-w-md pointer-events-none transition-opacity duration-200"
        style={{
          opacity: compareMode === 'xray' ? 1 : sliderPosition < 16 ? 0.15 : 1,
        }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/55 backdrop-blur-xl border border-white/15 text-[#F5F5F7] font-sans text-xs font-medium tabular-nums mb-2 shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
          <span>
            {lang === 'en'
              ? 'Present Day • 2026'
              : lang === 'zh'
              ? '实景现状 • 2026'
              : 'Hiện tại • 2026'}
          </span>
        </div>
        <h3
          className="font-serif text-2xl sm:text-3xl md:text-4xl font-normal text-[#F5F5F7] leading-[1.12] drop-shadow-[0_2px_14px_rgba(0,0,0,0.9)]"
          style={{ fontVariantNumeric: 'lining-nums' }}
        >
          {activeSite.officialName}
        </h3>
        <p className="font-sans text-xs sm:text-[13px] text-[#F5F5F7]/85 mt-1.5 leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] line-clamp-2">
          {activeSite.address.street}, {activeSite.address.district}, {activeSite.address.city}
        </p>
      </div>

      {/* RIGHT CAPTION: HISTORICAL ARCHIVE */}
      <div
        className="hidden sm:block absolute top-32 md:top-24 right-5 sm:right-8 z-20 text-right max-w-xs sm:max-w-md pointer-events-none transition-opacity duration-200"
        style={{
          opacity: compareMode === 'xray' ? 1 : sliderPosition > 84 ? 0.15 : 1,
        }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1C1610]/75 backdrop-blur-xl border border-[#C5A059]/50 text-[#E5C890] font-sans text-xs font-medium tabular-nums mb-2 shadow-lg">
          <span>
            {lang === 'en'
              ? `Historical Archive • ${archiveMeta.eraTag}`
              : lang === 'zh'
              ? `历史文献 • ${archiveMeta.eraTag}`
              : `Tư liệu xưa • ${archiveMeta.eraTag}`}
          </span>
        </div>
        <h3
          className="font-serif text-2xl sm:text-3xl md:text-4xl font-normal text-[#F5F5F7] leading-[1.12] drop-shadow-[0_2px_14px_rgba(0,0,0,0.9)]"
          style={{ fontVariantNumeric: 'lining-nums' }}
        >
          {lang === 'en' ? archiveMeta.titleEn : archiveMeta.title}
        </h3>
        <p className="font-sans text-xs sm:text-[13px] text-[#F5F5F7]/85 mt-1.5 leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] line-clamp-2">
          {lang === 'en' ? archiveMeta.captionEn : archiveMeta.caption}
        </p>
        <p className="font-sans text-[11px] text-[#C5A059] mt-1 drop-shadow-[0_1px_6px_rgba(0,0,0,0.95)]">
          {archiveMeta.credit}
        </p>
      </div>

      {/* ====================================================================
          DIVIDING LINE (#C5A059 2px) & APPLE GLASS HANDLE (z-30)
         ==================================================================== */}
      {compareMode !== 'xray' && (
        <>
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-30"
            preserveAspectRatio="none"
          >
            <line
              x1={compareMode === 'diagonal' ? `${diagTopX}%` : `${sliderPosition}%`}
              y1="0%"
              x2={compareMode === 'diagonal' ? `${diagBottomX}%` : `${sliderPosition}%`}
              y2="100%"
              stroke="#C5A059"
              strokeWidth="2"
            />
          </svg>

          <div
            className="absolute top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${sliderPosition}%` }}
          >
            <div
              className={`w-12 h-12 rounded-full bg-black/70 backdrop-blur-2xl border border-[#C5A059]/85 flex items-center justify-center transition-transform duration-150 ${
                isDragging
                  ? 'scale-110 shadow-[0_0_38px_rgba(197,160,89,0.68)]'
                  : 'shadow-[0_0_30px_rgba(197,160,89,0.4)]'
              }`}
            >
              <MoveHorizontal className="w-5 h-5 text-[#C5A059]" />
            </div>
          </div>
        </>
      )}

      {/* X-RAY CENTER BLEND READOUT BADGE */}
      {compareMode === 'xray' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
          <div className="px-4 py-2 rounded-full bg-[#141416]/75 backdrop-blur-2xl border border-[#C5A059]/50 shadow-[0_12px_40px_rgba(0,0,0,0.65)] flex items-center gap-3 font-sans tabular-nums text-xs text-[#F5F5F7]">
            <span className="text-[#34D399]">2026: {Math.round(100 - sliderPosition)}%</span>
            <span className="text-white/25">·</span>
            <span className="text-[#C5A059]">Xưa: {Math.round(sliderPosition)}%</span>
          </div>
        </div>
      )}

      {/* ====================================================================
          3-CLUSTER APPLE VISIONOS FLOATING GLASS HUD (z-40)
         ==================================================================== */}

      {/* CLUSTER 1 (TOP-LEFT): ‹ | 01 / 17 • Dinh Độc Lập ▾ | › */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-5 sm:top-6 left-4 sm:left-7 z-40 cursor-default"
      >
        <div className="inline-flex items-center p-1 rounded-full bg-[#141416]/75 backdrop-blur-2xl border border-white/[0.12] shadow-[0_12px_40px_rgba(0,0,0,0.65)] gap-0.5">
          <button
            type="button"
            onClick={() => handleCycleSite(-1)}
            aria-label="Previous monument"
            title={lang === 'en' ? 'Previous monument' : 'Di tích trước'}
            className="w-8 h-8 rounded-full hover:bg-white/[0.12] text-[#F5F5F7] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSiteMenuOpen((prev) => !prev);
              setIsUploadMenuOpen(false);
            }}
            className="h-8 px-2.5 sm:px-3 rounded-full hover:bg-white/[0.08] flex items-center gap-2 text-xs text-[#F5F5F7] transition-colors cursor-pointer whitespace-nowrap"
          >
            <span className="font-sans tabular-nums text-xs text-[#C5A059] font-medium">
              {String(activeSiteIndex + 1).padStart(2, '0')} / {String(resolvedSites.length).padStart(2, '0')}
            </span>
            <span className="text-white/25">•</span>
            <span className="font-sans font-medium max-w-[115px] sm:max-w-[190px] truncate">
              {activeSite.officialName}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#8E8E93] transition-transform ${
                isSiteMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => handleCycleSite(1)}
            aria-label="Next monument"
            title={lang === 'en' ? 'Next monument' : 'Di tích kế tiếp'}
            className="w-8 h-8 rounded-full hover:bg-white/[0.12] text-[#F5F5F7] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 17-Site Dropdown Popover */}
        {isSiteMenuOpen && (
          <div className="absolute left-0 top-full mt-2.5 w-80 sm:w-96 max-h-[62vh] overflow-y-auto modal-scrollbar rounded-3xl bg-[#141416]/90 backdrop-blur-2xl border border-white/[0.14] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.9)] z-50">
            <div className="px-3 py-2 text-xs font-sans font-medium text-[#8E8E93] border-b border-white/[0.08] mb-1.5">
              {lang === 'en'
                ? '17 Archival Comparison Pairs'
                : lang === 'zh'
                ? '17处古今档案对比'
                : 'Danh sách 17 di tích đối chiếu Xưa & Nay'}
            </div>
            {resolvedSites.map((s, idx) => {
              const isSelected = s.id === activeSite.id;
              const entry = HISTORICAL_ARCHIVE_BY_SITE[s.id] || HISTORICAL_ARCHIVE_LIST[idx];
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectComparisonSite(s)}
                  className={`w-full text-left px-3 py-2.5 rounded-2xl flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#C5A059]/20 text-[#F5F5F7] border border-[#C5A059]/45'
                      : 'hover:bg-white/[0.07] text-[#E6E1D6] border border-transparent'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-sans tabular-nums text-[11px] text-[#C5A059] font-medium">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="font-sans text-xs font-medium truncate">
                        {s.officialName}
                      </span>
                    </div>
                    <div className="font-sans text-[11px] text-[#8E8E93] truncate pl-6 mt-0.5">
                      {entry?.title || `${s.commencementYear}`}
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#C5A059] shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* CLUSTER 2 (TOP-CENTER): APPLE SEGMENTED PILL (Cắt chéo | Chia dọc | Xuyên mờ) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-[70px] md:top-6 left-1/2 -translate-x-1/2 z-40 p-1 rounded-full bg-[#141416]/75 backdrop-blur-2xl border border-white/[0.12] shadow-[0_12px_40px_rgba(0,0,0,0.65)] inline-flex items-center gap-1 cursor-default"
      >
        {modeLabels.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              if (m.id !== compareMode) {
                triggerHaptic('selection');
                setCompareMode(m.id);
              } else {
                triggerHaptic('soft');
              }
            }}
            className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-sans transition-all active:scale-[0.97] cursor-pointer whitespace-nowrap ${
              compareMode === m.id
                ? 'bg-[#C5A059] text-[#111113] font-semibold shadow-sm'
                : 'text-[#E6E1D6]/80 hover:text-white font-medium'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* CLUSTER 3 (TOP-RIGHT): TẢI ẢNH TƯ LIỆU + CLOSE BUTTON × */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-5 sm:top-6 right-4 sm:right-7 z-40 flex items-center gap-2.5 cursor-default"
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsUploadMenuOpen((prev) => !prev);
              setIsSiteMenuOpen(false);
            }}
            title={lang === 'en' ? 'Upload archival / present photo' : 'Tải ảnh tư liệu'}
            className={`h-10 px-3 sm:px-3.5 rounded-full bg-[#141416]/75 backdrop-blur-2xl border shadow-[0_12px_40px_rgba(0,0,0,0.65)] text-xs font-sans font-medium flex items-center gap-2 transition-colors cursor-pointer ${
              isUploadMenuOpen || hasCustomForActive
                ? 'border-[#C5A059]/70 text-[#E5C890]'
                : 'border-white/[0.12] text-[#F5F5F7] hover:border-[#C5A059]/60'
            }`}
          >
            <Camera className="w-4 h-4 text-[#C5A059]" />
            <span className="hidden lg:inline">
              {isUploading
                ? lang === 'en'
                  ? 'Processing...'
                  : 'Đang nạp...'
                : lang === 'en'
                ? 'Upload Photo'
                : lang === 'zh'
                ? '上传照片'
                : 'Tải ảnh tư liệu'}
            </span>
          </button>

          {isUploadMenuOpen && (
            <div className="absolute right-0 top-full mt-2.5 w-64 rounded-3xl bg-[#141416]/95 backdrop-blur-2xl border border-white/[0.14] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.9)] z-50 space-y-1">
              <div className="px-3 py-1.5 text-xs font-sans font-medium text-[#8E8E93] border-b border-white/[0.08] mb-1">
                {lang === 'en' ? 'Custom Archive Upload' : 'Nạp ảnh từ máy tính'}
              </div>
              <button
                type="button"
                onClick={() => modernFileInputRef.current?.click()}
                className="w-full px-3 py-2 rounded-2xl hover:bg-white/[0.08] text-left text-xs font-sans text-[#F5F5F7] flex items-center gap-2.5 cursor-pointer transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-[#34D399]" />
                <span>
                  {lang === 'en' ? 'Upload 2026 Present Photo' : 'Nạp ảnh Hiện tại (2026)'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => historicalFileInputRef.current?.click()}
                className="w-full px-3 py-2 rounded-2xl hover:bg-white/[0.08] text-left text-xs font-sans text-[#F5F5F7] flex items-center gap-2.5 cursor-pointer transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>
                  {lang === 'en' ? 'Upload Historical Photo' : 'Nạp ảnh Tư liệu Xưa'}
                </span>
              </button>
              {hasCustomForActive && (
                <button
                  type="button"
                  onClick={handleRestoreDefaultsForSite}
                  className="w-full px-3 py-2 rounded-2xl hover:bg-white/[0.08] text-left text-xs font-sans text-[#E5C890] flex items-center gap-2.5 cursor-pointer transition-colors border-t border-white/[0.08] mt-1 pt-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{lang === 'en' ? 'Restore Original Photos' : 'Khôi phục ảnh mặc định'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={lang === 'en' ? 'Close' : 'Đóng'}
          className="w-10 h-10 rounded-full bg-[#141416]/75 backdrop-blur-2xl border border-white/[0.12] hover:border-[#C5A059] shadow-[0_12px_40px_rgba(0,0,0,0.65)] text-[#F5F5F7] hover:text-[#C5A059] flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ====================================================================
          BOTTOM APPLE CAMERA DIAL TIMELINE RULER + "Khám phá 3D ↗" (z-40)
         ==================================================================== */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] px-4 sm:px-5 py-2 rounded-full bg-[#141416]/80 backdrop-blur-2xl border border-white/[0.12] shadow-[0_20px_55px_rgba(0,0,0,0.85)] flex items-center gap-3 sm:gap-4 cursor-default"
      >
        {/* Left Label: 2026 (NAY) */}
        <span className="font-sans text-[11px] font-medium tabular-nums text-[#34D399] whitespace-nowrap hidden sm:inline">
          2026 Nay
        </span>

        {/* Apple Camera Dial Tick-Mark Scrubber */}
        <div
          ref={dialRef}
          role="slider"
          tabIndex={0}
          aria-label="Time comparison dial"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(sliderPosition)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              const next = clampPct(sliderPosition - 3);
              setSliderPosition(next);
              emitLensSliderHaptic(next);
            }
            if (e.key === 'ArrowRight') {
              const next = clampPct(sliderPosition + 3);
              setSliderPosition(next);
              emitLensSliderHaptic(next);
            }
          }}
          onPointerDown={handleDialPointerDown}
          onPointerMove={handleDialPointerMove}
          onPointerUp={handleDialPointerUp}
          onPointerCancel={handleDialPointerUp}
          className="relative w-44 sm:w-64 h-9 flex items-center justify-between px-1 cursor-ew-resize touch-none"
        >
          {/* 33 precision camera-dial vertical tick marks */}
          {Array.from({ length: 33 }).map((_, idx) => {
            const pct = (idx / 32) * 100;
            const isMajor = idx % 8 === 0;
            const isMid = idx % 4 === 0 && !isMajor;
            const nearCursor = Math.abs(pct - sliderPosition) < 8;
            return (
              <span
                key={idx}
                className="pointer-events-none block rounded-full transition-colors duration-150"
                style={{
                  width: isMajor ? '1.5px' : '1px',
                  height: isMajor ? '16px' : isMid ? '11px' : '7px',
                  backgroundColor: nearCursor
                    ? '#C5A059'
                    : isMajor
                    ? 'rgba(245, 245, 247, 0.5)'
                    : 'rgba(255, 255, 255, 0.22)',
                }}
              />
            );
          })}

          {/* Active Illuminated Needle + Frosted Glass Thumb */}
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center"
            style={{ left: `${sliderPosition}%` }}
          >
            <div
              className={`w-5 h-7 rounded-full bg-white/15 backdrop-blur-xl border border-[#C5A059] flex items-center justify-center transition-transform duration-150 ${
                isDialDragging
                  ? 'scale-110 shadow-[0_0_22px_rgba(197,160,89,0.85)]'
                  : 'shadow-[0_0_16px_rgba(197,160,89,0.65)]'
              }`}
            >
              <span className="w-[1.5px] h-3.5 bg-[#C5A059] rounded-full" />
            </div>
          </div>
        </div>

        {/* Right Label + Live % Readout */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-sans text-[11px] font-medium tabular-nums text-[#C5A059] whitespace-nowrap hidden sm:inline">
            {archiveMeta.eraTag}
          </span>
          <span className="font-sans text-[11px] text-[#F5F5F7]/85 bg-white/[0.08] px-2 py-0.5 rounded-full tabular-nums">
            {Math.round(sliderPosition)}%
          </span>
        </div>

        <div className="w-[1px] h-5 bg-white/15 shrink-0" />

        {/* Primary CTA: Khám phá 3D ↗ */}
        <button
          type="button"
          onClick={() => {
            if (onExploreAction) {
              onExploreAction(activeSite);
            } else {
              onClose();
            }
          }}
          className="px-3.5 sm:px-4 py-1.5 rounded-full bg-[#C5A059] hover:bg-[#D4B06A] text-[#111113] font-sans text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-sm shrink-0"
        >
          <span>
            {lang === 'en'
              ? 'Explore 3D'
              : lang === 'zh'
              ? '探索 3D'
              : 'Khám phá 3D'}
          </span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 4. MULTI-LAYER GIS CHECKBOX FILTER PANEL (BAUTEN / PERSONEN / EREIGNIS / QUELLEN / AUDIO)
// ============================================================================
interface GisMultiLayerPanelProps {
  activeLayers: Record<GisLayerKey, boolean>;
  onToggleLayer: (key: GisLayerKey) => void;
  lang: string;
  compact?: boolean;
}

export const GisMultiLayerPanel: React.FC<GisMultiLayerPanelProps> = ({
  activeLayers,
  onToggleLayer,
  lang,
  compact = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(compact);

  return (
    <div className="bg-[#141210]/95 border border-[#C5A059]/45 backdrop-blur-md text-[#F4F1EA] shadow-2xl w-72 sm:w-80 select-none">
      <button
        type="button"
        onClick={() => setIsCollapsed((v) => !v)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between border-b border-[#F4F1EA]/12 hover:bg-[#1E1B18] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-[#C5A059]" />
          <span className="font-sans text-xs font-semibold text-[#C5A059]">
            {lang === 'en'
              ? '3D GIS Multi-layer Filter'
              : lang === 'zh'
              ? '3D GIS 多图层过滤器'
              : 'Bảng lọc GIS đa lớp'}
          </span>
        </div>
        <span className="font-sans tabular-nums text-xs text-[#E6E1D6]/70">
          {isCollapsed ? '[+]' : '[–]'}
        </span>
      </button>

      {!isCollapsed && (
        <div className="p-3 space-y-1.5">
          {GIS_MULTI_LAYERS.map((layer) => {
            const isChecked = !!activeLayers[layer.key];
            const label =
              lang === 'en' ? layer.labelEn : lang === 'zh' ? layer.labelZh : layer.labelVi;
            return (
              <button
                key={layer.key}
                type="button"
                onClick={() => onToggleLayer(layer.key)}
                className={`w-full px-2.5 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer border ${
                  isChecked
                    ? 'bg-[#1F1C18] border-[#C5A059]/40 text-[#F4F1EA]'
                    : 'bg-transparent border-transparent text-[#A39E93] hover:text-[#F4F1EA]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isChecked ? (
                    <CheckSquare className="w-3.5 h-3.5 shrink-0" style={{ color: layer.color }} />
                  ) : (
                    <Square className="w-3.5 h-3.5 shrink-0 text-[#A39E93]/50" />
                  )}
                  <span className="text-[11px] leading-tight truncate">{label}</span>
                </div>
                <span
                  className="ml-2 px-1.5 py-0.5 font-serif italic font-bold text-[10px] shrink-0 border"
                  style={{
                    color: layer.color,
                    borderColor: layer.color,
                    backgroundColor: layer.bgColor,
                  }}
                >
                  [i]
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 5. CHÂTEAU D'AMBOISE 3D SPATIAL INTERFACE HUD
//    - Top-Center Gold Era Banner
//    - Top-Left 3D Spatial Compass (N - E - S - W)
//    - Bottom Historical Era Selector Bar + "So sánh (Comparer)"
//    - Bottom-Right Historical Figure / Architect & Archival Card
// ============================================================================
interface ChateauAmboiseHUDProps {
  site: HeritageSite;
  lang: string;
  cameraAzimuthDeg: number;
  selectedEraIndex: number;
  onSelectEraIndex: (idx: number) => void;
  onOpenLisboaCompare: () => void;
  isCrownOrbitActive: boolean;
  onToggleCrownOrbit: () => void;
}

export const ChateauAmboiseHUD: React.FC<ChateauAmboiseHUDProps> = ({
  site,
  lang,
  cameraAzimuthDeg,
  selectedEraIndex,
  onSelectEraIndex,
  onOpenLisboaCompare,
  isCrownOrbitActive,
  onToggleCrownOrbit,
}) => {
  const eras = useMemo(() => getChateauErasForSite(site), [site]);
  const currentEra = eras[selectedEraIndex] || eras[eras.length - 1];
  const [showFigureCard, setShowFigureCard] = useState<boolean>(true);

  return (
    <>
      {/* 1. TOP-CENTER CLASSIC GOLD ERA BANNER (CHÂTEAU D'AMBOISE STYLE) */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex flex-col items-center max-w-[92vw]">
        <div className="bg-[#C5A059] text-[#141210] px-6 sm:px-8 py-2 font-serif shadow-[0_8px_30px_rgba(0,0,0,0.65)] border border-[#F4F1EA]/40 text-center">
          <div className="text-[11px] font-sans font-medium opacity-80">
            {lang === 'en'
              ? 'Spatial Heritage Chronology'
              : 'Niên biểu Không gian 3D · Di sản Đông Nam Bộ'}
          </div>
          <div className="text-sm sm:text-base font-bold">
            {lang === 'en' ? currentEra.titleEn : currentEra.titleVi}
          </div>
        </div>
      </div>

      {/* 2. TOP-LEFT 3D SPATIAL COMPASS ROSE (N - E - S - W) ROTATING WITH CAMERA AZIMUTH */}
      <div className="absolute top-20 left-5 z-30 pointer-events-auto flex items-center gap-3">
        <div
          className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#141210]/90 border border-[#C5A059]/60 shadow-xl flex items-center justify-center backdrop-blur-md"
          title="La bàn Không gian 3D xoay theo góc Camera thực tế"
        >
          <div
            className="relative w-full h-full flex items-center justify-center transition-transform duration-150 ease-out"
            style={{
              transform: `rotateX(28deg) rotateZ(${-cameraAzimuthDeg}deg)`,
            }}
          >
            <span className="absolute top-1 text-[10px] font-sans font-bold text-[#E05A47]">
              N
            </span>
            <span className="absolute right-1.5 text-[9px] font-sans text-[#C5A059]">
              E
            </span>
            <span className="absolute bottom-1 text-[9px] font-sans text-[#E6E1D6]/80">
              S
            </span>
            <span className="absolute left-1.5 text-[9px] font-sans text-[#C5A059]">
              W
            </span>
            {/* Compass needle */}
            <svg className="w-8 h-8" viewBox="0 0 32 32">
              <polygon points="16,4 20,16 16,14 12,16" fill="#E05A47" />
              <polygon points="16,28 20,16 16,18 12,16" fill="#C5A059" />
              <circle cx="16" cy="16" r="2.2" fill="#F4F1EA" />
            </svg>
          </div>
          <div className="absolute -bottom-5 inset-x-0 text-center font-sans tabular-nums text-[10px] text-[#C5A059]">
            {Math.round(((cameraAzimuthDeg % 360) + 360) % 360)}°
          </div>
        </div>

        {/* Quick toggle for X-Ray Crown Orbit & Lisboa Split */}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onToggleCrownOrbit}
            className={`px-3 py-1.5 font-sans text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
              isCrownOrbitActive
                ? 'bg-[#C5A059] text-[#141210] border-[#F4F1EA] font-bold shadow-[0_0_20px_rgba(197,160,89,0.5)]'
                : 'bg-[#141210]/90 text-[#E6E1D6] border-[#C5A059]/50 hover:border-[#C5A059]'
            }`}
          >
            <span>🌐</span>
            <span>
              {lang === 'en'
                ? 'X-Ray Crown & Orbital Arc'
                : 'Giải phẫu Đỉnh Mái & Quỹ đạo'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenLisboaCompare}
            className="px-3 py-1.5 bg-[#141210]/90 hover:bg-[#C5A059] text-[#C5A059] hover:text-[#141210] border border-[#C5A059]/60 font-sans text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>🌗</span>
            <span>
              {lang === 'en'
                ? 'Past & Present (Lisboa Split)'
                : 'So sánh Xưa & Nay (Lisboa Split)'}
            </span>
          </button>
        </div>
      </div>

      {/* 3. BOTTOM-RIGHT HISTORICAL FIGURE / ARCHITECT & ARCHIVAL CARD (CHÂTEAU D'AMBOISE STYLE) */}
      <div className="absolute bottom-36 right-5 z-25 pointer-events-auto max-w-xs sm:max-w-sm hidden md:block">
        {showFigureCard ? (
          <div className="bg-[#141210]/95 border border-[#C5A059]/55 p-4 text-[#F4F1EA] shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-3 border-b border-[#F4F1EA]/12 pb-3">
              <div className="flex items-center gap-3">
                {/* Portrait Medallion */}
                <div className="w-12 h-12 shrink-0 bg-[#231E18] border border-[#C5A059] flex flex-col items-center justify-center text-[#C5A059]">
                  <User className="w-6 h-6" />
                  <span className="text-[9px] font-sans tabular-nums">
                    {currentEra.figureYears.slice(0, 9)}
                  </span>
                </div>
                <div>
                  <div className="text-[11px] font-sans font-medium text-[#C5A059]">
                    {currentEra.figureRole}
                  </div>
                  <h4 className="font-serif text-sm sm:text-base font-semibold text-[#F4F1EA]">
                    {currentEra.figureName}
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFigureCard(false)}
                className="text-[#A39E93] hover:text-[#C5A059] text-xs font-sans cursor-pointer"
                title="Thu gọn thẻ nhân vật"
              >
                [–]
              </button>
            </div>

            <p className="text-xs text-[#E6E1D6]/90 leading-relaxed mt-2.5">
              {currentEra.archNote}
            </p>

            <div className="mt-2.5 pt-2 border-t border-[#F4F1EA]/10 flex items-center justify-between text-[11px] font-sans text-[#C5A059]">
              <span className="truncate">{currentEra.blueprintCaption}</span>
            </div>

            {/* 3D Interaction Gesture Guide */}
            <div className="mt-2.5 pt-2 border-t border-[#F4F1EA]/10 flex items-center justify-between text-[11px] font-sans text-[#A39E93]">
              <span className="flex items-center gap-1">
                <RotateCw className="w-3 h-3 text-[#C5A059]" /> Xoay 360°
              </span>
              <span className="flex items-center gap-1">
                <MousePointerClick className="w-3 h-3 text-[#C5A059]" /> Bấm [+] để mổ xẻ
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowFigureCard(true)}
            className="px-3.5 py-2 bg-[#141210]/95 border border-[#C5A059]/60 text-[#C5A059] font-sans text-xs font-medium cursor-pointer"
          >
            [+] {currentEra.figureName}
          </button>
        )}
      </div>

      {/* 4. BOTTOM HISTORICAL ERA TIMELINE BAR ("CHỌN MỘT GIAI ĐOẠN LỊCH SỬ" + "SO SÁNH / COMPARER") */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-25 pointer-events-auto w-[95vw] max-w-5xl">
        <div className="bg-[#141210]/95 border border-[#C5A059]/50 px-3 py-1.5 backdrop-blur-md shadow-2xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          {/* "So sánh (Comparer)" Button */}
          <button
            type="button"
            onClick={onOpenLisboaCompare}
            className="px-3.5 py-2 bg-[#241E16] hover:bg-[#C5A059] text-[#C5A059] hover:text-[#141210] border border-[#C5A059] font-sans text-xs font-semibold shrink-0 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>🌗</span>
            <span>{lang === 'en' ? 'Compare (Comparer)' : 'So sánh (Comparer)'}</span>
          </button>

          <span className="hidden lg:inline font-serif italic text-xs text-[#E6E1D6]/75 shrink-0 px-2">
            {lang === 'en' ? 'Select a historical era:' : 'Chọn một giai đoạn lịch sử:'}
          </span>

          {/* 5 Historical Era Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {eras.map((era, idx) => {
              const isSelected = idx === selectedEraIndex;
              return (
                <button
                  key={era.id}
                  type="button"
                  onClick={() => onSelectEraIndex(idx)}
                  className={`px-3 py-1.5 font-sans tabular-nums text-xs shrink-0 border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#C5A059] text-[#141210] border-[#F4F1EA] font-bold'
                      : 'bg-[#1B1815] text-[#E6E1D6]/80 border-[#F4F1EA]/15 hover:border-[#C5A059]/60 hover:text-[#F4F1EA]'
                  }`}
                >
                  {era.shortPeriod}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};
