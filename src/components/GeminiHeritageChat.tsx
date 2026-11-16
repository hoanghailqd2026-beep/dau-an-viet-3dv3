import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { HeritageSite } from '../types/heritage';
import { useI18n } from '../i18n/I18nContext';
import { speechEngine } from '../utils/chunkedSpeechEngine';
import { Language } from '../i18n/types';
import { useAudioGuide } from '../contexts/AudioGuideContext';
import { useAuth } from '../contexts/AuthContext';
import { useLabs } from '../contexts/LabsContext';
import { incrementFreeAiDailyUsage } from '../utils/adminPlatformStore';
import { HERITAGE_SITES } from '../data/heritageSites';
import {
  getLivingDocentSiteData,
  evaluateMysteryRayClick,
} from '../data/livingDocentData';
import {
  unlockPassportStamp,
  useHeritagePassportStamps,
} from '../utils/heritagePassport';
import {
  Sparkles,
  Landmark,
  Flame,
  ScrollText,
  Send,
  Volume2,
  VolumeX,
  X,
  Compass,
  Loader2,
  CheckCircle2,
  Minimize2,
  Maximize2,
  Play,
  Pause,
  Square,
  SkipForward,
  Puzzle,
  Award,
  Mic,
  MicOff,
  RotateCcw,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface GeminiHotspotTarget {
  id: string;
  name: string;
  description: string;
  cameraPos: [number, number, number];
  targetPos: [number, number, number];
  thumbnailUrl: string;
}

export type GeminiPersonaMode =
  | 'Architect'
  | 'Eyewitness'
  | 'Polymath'
  | 'Historian'
  | 'Witness'
  | 'expert'
  | 'witness';

export type CanonicalPersona = 'Architect' | 'Eyewitness' | 'Polymath';

export interface SpatialActionBadge {
  tag: string;
  label: string;
  type: 'hotspot' | 'mode' | 'autotour';
}

interface ChatMessageItem {
  id: string;
  role: 'user' | 'model';
  content: string;
  persona: CanonicalPersona;
  spatialActions: SpatialActionBadge[];
  labsConfirmations?: string[];
  timestamp: string;
  modelUsed?: string;
}

export interface RoleplayIdentity {
  name: string;
  title: string;
  intro: string;
}

export interface MysteryRayClickPayload {
  hitPoint: [number, number, number];
  meshName: string;
  timestamp: number;
}

export interface GeminiHeritageChatProps {
  isOpen: boolean;
  onClose: () => void;
  currentSite: HeritageSite;
  sites?: HeritageSite[];
  hotspots: GeminiHotspotTarget[];
  onFlyToHotspot: (hotspot: GeminiHotspotTarget) => void;
  onSetRenderMode: (mode: 'textured' | 'wireframe' | 'xray') => void;
  onTriggerAutoTour: () => void;
  onSwitchSite?: (site: HeritageSite) => void;
  onSetLightingMode?: (mode: 'studio' | 'day' | 'golden' | 'night') => void;
  onSetExplodedFactor?: (factor: number) => void;
  onSetSpatialSpotlight?: (pos: [number, number, number], label?: string) => void;
  onClearSpatialSpotlight?: () => void;
  isMysteryModeActive?: boolean;
  onToggleMysteryMode?: (active: boolean) => void;
  mysteryRayClickEvent?: MysteryRayClickPayload | null;
  onNavigateToTickets?: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionInstanceLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstanceLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike;
}

export function normalizePersona(persona: GeminiPersonaMode): CanonicalPersona {
  if (persona === 'Architect') return 'Architect';
  if (persona === 'Eyewitness' || persona === 'Witness' || persona === 'witness') {
    return 'Eyewitness';
  }
  return 'Polymath';
}

export function isWitnessPersona(persona: GeminiPersonaMode): boolean {
  const norm = normalizePersona(persona);
  return norm === 'Architect' || norm === 'Eyewitness';
}

export function getRoleplayIdentity(
  site: HeritageSite,
  persona: GeminiPersonaMode = 'Architect',
  lang: Language = 'vi'
): RoleplayIdentity {
  const data = getLivingDocentSiteData(site);
  const norm = normalizePersona(persona);
  if (norm === 'Eyewitness') {
    return {
      name: data.eyewitness.name,
      title: data.eyewitness.role[lang],
      intro: data.eyewitness.greeting[lang],
    };
  }
  if (norm === 'Polymath') {
    return {
      name:
        lang === 'en'
          ? 'Prof. Polymath Historian'
          : lang === 'zh'
          ? '博学历史学家 · 文献策展人'
          : 'GS. Nhà Thông Sử',
      title:
        lang === 'en'
          ? 'Comparative World History & Archival Citations'
          : lang === 'zh'
          ? '世界历史比较与文献档案专家'
          : 'Lịch sử Đối sánh Liên vùng & Trích nguồn Sử liệu',
      intro: data.polymathContext,
    };
  }
  return {
    name: data.architect.name,
    title: data.architect.role[lang],
    intro: data.architect.greeting[lang],
  };
}

export function buildHeritageSystemInstruction(
  site: HeritageSite,
  persona: GeminiPersonaMode,
  hotspots: GeminiHotspotTarget[],
  roleplayIdentity: RoleplayIdentity,
  language: Language = 'vi'
): string {
  const canonical = normalizePersona(persona);
  const docentData = getLivingDocentSiteData(site);
  const hotspotLines = hotspots
    .slice(0, 6)
    .map(
      (h, idx) =>
        `  * [ACTION:HOTSPOT_${idx + 1}] -> Trạm ${idx + 1}: "${h.name}" (${h.description})`
    )
    .join('\n');

  const historicalEvents = (site.milestones || []).map((m) => `${m.year}: ${m.event}`).join('; ');

  const languageDirective =
    language === 'en'
      ? 'IMPORTANT LANGUAGE RULE: Respond 100% in natural, vivid, scholarly English (keep Vietnamese proper nouns and [ACTION:...] tags intact).'
      : language === 'zh'
      ? 'IMPORTANT LANGUAGE RULE: 请100%使用自然、专业、典雅的简体中文回答用户问题（保留底部的 [ACTION:...] 空间控制指令标签不变）。'
      : 'QUY TẮC NGÔN NGỮ: Trả lời 100% bằng Tiếng Việt chuẩn mực, giàu bản sắc văn hóa - học thuật.';

  const personaBlock =
    canonical === 'Architect'
      ? `CHẾ ĐỘ NHÂN VẬT 1: 🏛️ KIẾN TRÚC SƯ / NGHỆ NHÂN (ARCHITECT / ARTISAN ROLEPLAY).
- Bạn phải xưng "tôi" (hoặc "I" / "我") và nhập vai hoàn toàn vào tác giả/nghệ nhân công trình: **${roleplayIdentity.name}** (${roleplayIdentity.title}).
- Bối cảnh: ${roleplayIdentity.intro}
- Trọng tâm phân tích: Kỹ thuật kết cấu chịu lực, vật liệu chế tác (${(site.materials || []).join(', ')}), tỷ lệ hình học, giải pháp vi khí hậu nhiệt đới và ý đồ nghệ thuật kiến trúc.`
      : canonical === 'Eyewitness'
      ? `CHẾ ĐỘ NHÂN VẬT 2: 🕯️ NHÂN CHỨNG THỜI CUỘC (HISTORICAL EYEWITNESS ROLEPLAY).
- Bạn phải xưng "tôi" (hoặc "I" / "我") và nhập vai vào chứng nhân sống của lịch sử: **${roleplayIdentity.name}** (${roleplayIdentity.title}).
- Bối cảnh: ${roleplayIdentity.intro}
- Trọng tâm phân tích: Kể lại ký ức chân thực, không khí thời cuộc, âm thanh - ánh sáng và những khoảnh khắc lịch sử không thể quên tại từng góc của ${site.officialName}.`
      : `CHẾ ĐỘ NHÂN VẬT 3: 📜 NHÀ THÔNG SỬ (POLYMATH HISTORIAN).
- Bạn đóng vai Nhà Thông Sử & Giám tuyển So sánh Di sản Thế giới.
- Trọng tâm: Kết nối công trình Đông Nam Bộ này với lịch sử Việt Nam và thế giới cùng thời kỳ (${docentData.polymathContext}).
- QUY TẮC BẮT BUỘC: Cuối câu trả lời LUÔN LUÔN có dòng trích dẫn rõ ràng: \`Nguồn tham khảo: ${docentData.polymathSources}\`.`;

  return `Bạn là "Hệ thống Hướng Dẫn Viên Nhân Chứng Không Gian 3D (Spatial Living Docent)" của Dấu Ấn Việt 3D (HeritageGuide 3D).

${languageDirective}

${personaBlock}

THÔNG TIN DI TÍCH HIỆN TẠI:
- Mã: ${site.id} (${site.identifierCode || ''})
- Tên công trình: ${site.officialName}
- Khu vực: ${site.address.district}, ${site.address.city}
- Phong cách: ${site.architecturalStyle}
- Niên đại: ${site.chronology}
- Chủ thể kiến tạo: ${site.architect}
- Sự kiện tiêu biểu: ${historicalEvents}
- Hồ sơ tóm tắt: ${site.summary}

DANH SÁCH ĐIỂM NHẤN KHÔNG GIAN 3D (HOTSPOTS):
${hotspotLines || '  * [ACTION:HOTSPOT_1] -> Toàn cảnh công trình'}

QUY TẮC TRÌNH BÀY & ĐIỀU KHIỂN 3D:
1. Trình bày súc tích (110 - 200 từ), rõ ràng, truyền cảm hứng và bám sát sử liệu công trình.
2. Khi phù hợp, chủ động gợi ý du khách trải nghiệm tính năng tương tác liên quan như **X-Ray**, **Bóc tách kiến trúc**, chuyển ánh sáng **Studio / Ban ngày / Hoàng hôn / Đêm**, hoặc đối chiếu **Thấu kính Bản đồ Lịch sử 1815** tại tab **Bản đồ & Tuyến**.
3. Khi nói tới bất kỳ bộ phận kiến trúc nào, đính kèm thẻ ở cuối cùng để hệ thống tự động bay Camera + rọi đèn Spotlight Gold vào đúng vị trí đó:
   \`[ACTION:HOTSPOT_1]\` .. \`[ACTION:HOTSPOT_6]\`, \`[ACTION:MODE_XRAY]\`, \`[ACTION:MODE_WIREFRAME]\`, \`[ACTION:MODE_TEXTURED]\`, \`[ACTION:START_TOUR]\`.`;
}

function getSuggestedQuestionsForSite(siteId: string, lang: Language): string[] {
  if (lang === 'en') {
    if (siteId === 'HCM-DT-001') {
      return [
        'Explain the Chinese character geometry & bamboo stone facade',
        'Enable X-Ray to inspect the Command Bunker B1',
        'Fly spotlight to the UH-1 Rooftop Helipad',
      ];
    }
    if (siteId === 'HCM-DT-009' || siteId === 'BRVT-DT-003' || siteId === 'BD-DT-002') {
      return [
        'Why did laterite clay tunnels survive B-52 shockwaves?',
        'Toggle X-Ray to trace the Hoang Cam smokeless kitchen',
        'Connect Cu Chi, Iron Triangle & Long Phuoc strategy',
      ];
    }
    return [
      'Analyze architectural materials & structural design',
      'Toggle X-Ray to inspect hidden interior geometry',
      'Connect this landmark with world history of its era',
    ];
  }
  if (lang === 'zh') {
    return [
      '解析该建筑的核心结构与材料工艺',
      '开启 X-Ray 透视查看内部隐藏构造',
      '将此遗产与同时代世界历史进行对比',
    ];
  }
  switch (siteId) {
    case 'HCM-DT-001':
      return [
        'Triết lý chữ Cát (吉) & rèm hoa đá đốt trúc của dinh?',
        'Bật X-Ray và rọi đèn xuống Tầng hầm Chỉ huy B1',
        'So sánh Dinh Độc Lập với kiến trúc hiện đại thế giới',
      ];
    case 'HCM-DT-002':
      return [
        'Ý nghĩa 2 tượng Nữ thần Caryatids & vòm Beaux-Arts?',
        'Bật X-Ray xem kết cấu mái Mansard & khán phòng',
        'So sánh Nhà hát Sài Gòn với Opéra Paris',
      ];
    case 'HCM-DT-009':
    case 'BRVT-DT-003':
    case 'BD-DT-002':
      return [
        'Vì sao địa chất đá ong chống được bom B-52?',
        'Bật X-Ray và rọi đèn tới Bếp Hoàng Cầm tản khói',
        'Liên kết chiến lược Củ Chi – Tam Giác Sắt – Long Phước',
      ];
    default:
      return [
        'Phân tích vật liệu, kết cấu & bí quyết xây dựng công trình',
        'Bật X-Ray để giải phẫu cấu trúc bên trong',
        'Đặt di tích này trong bối cảnh lịch sử thế giới cùng thời',
      ];
  }
}

export function parseGeminiResponseAndActions(
  rawText: string,
  hotspots: GeminiHotspotTarget[],
  lang: Language = 'vi'
): {
  cleanText: string;
  actions: SpatialActionBadge[];
} {
  const actionRegex = /\[ACTION:([A-Z0-9_]+)\]/gi;
  const matchedTags: string[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = actionRegex.exec(rawText)) !== null) {
    const tag = match[1].toUpperCase();
    if (!matchedTags.includes(tag)) {
      matchedTags.push(tag);
    }
  }

  const cleanText = rawText.replace(/\[ACTION:[A-Z0-9_]+\]/gi, '').trim();
  const actions: SpatialActionBadge[] = [];

  for (const tag of matchedTags) {
    if (tag.startsWith('HOTSPOT_')) {
      const idx = parseInt(tag.replace('HOTSPOT_', ''), 10) - 1;
      const targetHotspot = hotspots[idx] || hotspots[0];
      if (targetHotspot) {
        actions.push({
          tag,
          type: 'hotspot',
          label:
            lang === 'en'
              ? `Spotlight & Camera focused: ${targetHotspot.name}`
              : lang === 'zh'
              ? `已锁定聚光灯并聚焦：${targetHotspot.name}`
              : `Đèn rọi & Camera đã khóa điểm: ${targetHotspot.name}`,
        });
      }
    } else if (tag === 'MODE_XRAY') {
      actions.push({
        tag,
        type: 'mode',
        label:
          lang === 'en'
            ? 'X-Ray structural anatomy activated'
            : lang === 'zh'
            ? '已开启 X-Ray 结构透视'
            : 'Đã bật chế độ Giải phẫu X-Ray',
      });
    } else if (tag === 'MODE_WIREFRAME') {
      actions.push({
        tag,
        type: 'mode',
        label:
          lang === 'en'
            ? 'CAD Wireframe activated'
            : lang === 'zh'
            ? '已切换至 CAD 线框模式'
            : 'Đã bật Khung dây Trắc địa CAD',
      });
    } else if (tag === 'MODE_TEXTURED') {
      actions.push({
        tag,
        type: 'mode',
        label:
          lang === 'en'
            ? 'PBR Material view restored'
            : lang === 'zh'
            ? '已恢复 PBR 真实材质视图'
            : 'Đã khôi phục Bề mặt vật liệu PBR',
      });
    } else if (tag === 'START_TOUR' || tag === 'AUTO_TOUR') {
      actions.push({
        tag: 'START_TOUR',
        type: 'autotour',
        label:
          lang === 'en'
            ? 'Synchronized 3D Docent Tour launched'
            : lang === 'zh'
            ? '已启动 3D 同步导览'
            : 'Đã kích hoạt Tour 3D cùng Nhân chứng',
      });
    }
  }

  return { cleanText, actions };
}

function buildScholarlyFallbackResponse(
  query: string,
  site: HeritageSite,
  persona: CanonicalPersona,
  hotspots: GeminiHotspotTarget[],
  lang: Language
): string {
  const q = query.toLowerCase();
  const data = getLivingDocentSiteData(site);
  const identity = getRoleplayIdentity(site, persona, lang);
  const actionTags: string[] = [];

  if (q.includes('x-ray') || q.includes('xray') || q.includes('xuyên thấu') || q.includes('kết cấu') || q.includes('inspect') || q.includes('透视')) {
    actionTags.push('[ACTION:MODE_XRAY]');
  } else if (q.includes('khung dây') || q.includes('wireframe') || q.includes('线框')) {
    actionTags.push('[ACTION:MODE_WIREFRAME]');
  } else if (q.includes('bề mặt') || q.includes('textured') || q.includes('pbr')) {
    actionTags.push('[ACTION:MODE_TEXTURED]');
  }

  if (q.includes('tour') || q.includes('dẫn tôi') || q.includes('tham quan')) {
    actionTags.push('[ACTION:START_TOUR]');
  }

  hotspots.forEach((h, idx) => {
    const hName = h.name.toLowerCase();
    if (
      (q.includes('hầm') && hName.includes('hầm')) ||
      (q.includes('b1') && hName.includes('b1')) ||
      (q.includes('trực thăng') && hName.includes('trực thăng')) ||
      (q.includes('uh-1') && hName.includes('uh-1')) ||
      (q.includes('hoàng cầm') && hName.includes('hoàng cầm')) ||
      (q.includes('quân y') && hName.includes('quân y')) ||
      (q.includes('bát giác') && hName.includes('bát giác')) ||
      (q.includes('hoa hồng') && hName.includes('hoa hồng')) ||
      (q.includes('caryatid') && hName.includes('caryatid')) ||
      (q.includes('mansard') && hName.includes('mansard')) ||
      (q.includes('đồng hồ') && hName.includes('đồng hồ')) ||
      (q.includes('rồng') && hName.includes('rồng'))
    ) {
      actionTags.push(`[ACTION:HOTSPOT_${idx + 1}]`);
    }
  });

  if (actionTags.length === 0 && hotspots.length > 0) {
    actionTags.push('[ACTION:HOTSPOT_1]');
  }

  if (persona === 'Architect') {
    const materialsText = (site.materials || []).slice(0, 3).join(', ');
    if (lang === 'en') {
      return `Speaking as **${identity.name}** (${identity.title}):\n\n${identity.intro}\n\nIn crafting **${site.officialName}** (${site.chronology}), we balanced **${site.architecturalStyle}** geometry with local climate endurance using **${materialsText || 'traditional masonry & timber'}** (${site.dimensionsDescription}). Look closely at the spotlighted zone to trace how structure shapes daylight and acoustics.\n${actionTags.join(' ')}`;
    }
    if (lang === 'zh') {
      return `我是 **${identity.name}**（${identity.title}）：\n\n${identity.intro}\n\n在营建 **${site.officialName}**（${site.chronology}）时，我们精选 **${materialsText || '本地传统砖石与硬木'}**，将 **${site.architecturalStyle}** 的结构力学与南方热带通风采光完美结合（${site.dimensionsDescription}）。请随聚光灯观察关键节点。\n${actionTags.join(' ')}`;
    }
    return `Tôi là **${identity.name}** (*${identity.title}*):\n\n${identity.intro}\n\nKhi kiến tạo **${site.officialName}** (${site.chronology}), chúng tôi sử dụng **${materialsText || 'vật liệu truyền thống tuyển chọn'}** theo phong cách **${site.architecturalStyle}** (${site.dimensionsDescription}) để vừa đạt chuẩn thẩm mỹ kết cấu, vừa điều hòa nắng gió nhiệt đới.\n${actionTags.join(' ')}`;
  }

  if (persona === 'Eyewitness') {
    if (lang === 'en') {
      return `From my lived memory as **${identity.name}** (*${identity.title}*):\n\n${identity.intro}\n\nStanding right here at **${site.officialName}**, every stone, beam, and corridor holds the pulse of ${(site.milestones || []).slice(0, 2).map((m) => `${m.year} (${m.event})`).join(' and ')}. Notice the illuminated sector — that was where history felt closest to our hearts.\n${actionTags.join(' ')}`;
    }
    if (lang === 'zh') {
      return `以 **${identity.name}**（${identity.title}）的亲历视角诉说：\n\n${identity.intro}\n\n站在这座 **${site.officialName}** 之中，每一寸砖石与梁柱都铭刻着 ${(site.milestones || []).slice(0, 2).map((m) => `${m.year}年`).join('与')} 的时代风云。聚光灯所照之处，正是当年最令人难忘的历史瞬间。\n${actionTags.join(' ')}`;
    }
    return `Ký ức của tôi — **${identity.name}** (*${identity.title}*):\n\n${identity.intro}\n\nĐứng ngay giữa không gian **${site.officialName}**, từng cột gỗ hay mảng tường nơi vùng ánh sáng rọi tới đều lưu dấu hơi thở của những năm tháng lịch sử: ${(site.milestones || []).slice(0, 2).map((m) => `${m.year}: ${m.event}`).join('; ')}.\n${actionTags.join(' ')}`;
  }

  // Polymath MUST always end with explicit Nguồn tham khảo: citation
  if (lang === 'en') {
    return `From a **Comparative World History & Archival Perspective**:\n\n**${site.officialName}** (${site.chronology}) in ${site.address.district} exemplifies how Southeast Vietnam intersected with global currents of its era: ${data.polymathContext}\n\nKey milestones: ${(site.milestones || []).map((m) => `${m.year}: ${m.event}`).join('; ')}.\n\nNguồn tham khảo: ${data.polymathSources}\n${actionTags.join(' ')}`;
  }
  if (lang === 'zh') {
    return `从 **博学比较史学与文献考据视角**：\n\n位于 ${site.address.district} 的 **${site.officialName}**（${site.chronology}）折射出东南部遗产与同期世界史的交汇：${data.polymathContext}\n\n核心年表：${(site.milestones || []).map((m) => `${m.year}年：${m.event}`).join('；')}。\n\nNguồn tham khảo: ${data.polymathSources}\n${actionTags.join(' ')}`;
  }
  return `Dưới góc nhìn **Nhà Thông Sử & Đối sánh Liên vùng**:\n\n**${site.officialName}** (${site.chronology}) tại **${site.address.district}** là mắt xích tiêu biểu nối lịch sử Đông Nam Bộ với dòng chảy thế giới đương đại: ${data.polymathContext}\n\nCác mốc sử liệu cốt lõi: ${(site.milestones || []).map((m) => `${m.year} — ${m.event}`).join('; ')}.\n\nNguồn tham khảo: ${data.polymathSources}\n${actionTags.join(' ')}`;
}

interface TourStationStep {
  stationIdx: number;
  hotspot: GeminiHotspotTarget;
  mode: 'textured' | 'xray';
  exploded: number;
  modeLabel: string;
  subtitle: string;
}

function normalizeLabsCommandText(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

const LABS_SITE_ALIASES: Array<{ siteId: string; keywords: string[] }> = [
  { siteId: 'HCM-DT-001', keywords: ['dinh doc lap', 'dinh thong nhat', 'norodom'] },
  { siteId: 'HCM-DT-002', keywords: ['nha hat thanh pho', 'nha hat lon'] },
  { siteId: 'HCM-DT-003', keywords: ['buu dien trung tam', 'buu dien sai gon', 'buu dien'] },
  { siteId: 'HCM-DT-004', keywords: ['cho ben thanh', 'ben thanh'] },
  { siteId: 'HCM-DT-005', keywords: ['nha tho duc ba', 'duc ba sai gon', 'nha tho chinh toa'] },
  { siteId: 'HCM-DT-006', keywords: ['bao tang lich su', 'blanchard de la brosse'] },
  { siteId: 'HCM-DT-007', keywords: ['ben nha rong', 'bao tang ho chi minh'] },
  { siteId: 'HCM-DT-008', keywords: ['lang le van duyet', 'lang ong ba chieu', 'ba chieu'] },
  { siteId: 'HCM-DT-009', keywords: ['dia dao cu chi', 'cu chi'] },
  { siteId: 'HCM-DT-010', keywords: ['rung sac', 'can gio'] },
  { siteId: 'BD-DT-001', keywords: ['chua hoi khanh', 'hoi khanh'] },
  { siteId: 'BD-DT-002', keywords: ['tam giac sat', 'ben cat'] },
  { siteId: 'BD-DT-003', keywords: ['nha tu phu loi', 'phu loi'] },
  { siteId: 'BRVT-DT-001', keywords: ['bach dinh', 'villa blanche'] },
  { siteId: 'BRVT-DT-002', keywords: ['nha lon long son', 'den ong tran', 'long son'] },
  { siteId: 'BRVT-DT-003', keywords: ['dia dao long phuoc', 'long phuoc'] },
  { siteId: 'BRVT-DT-004', keywords: ['con dao', 'nha tu con dao'] },
];

function findSiteForLabsCommand(
  normQuery: string,
  allSites: HeritageSite[]
): HeritageSite | undefined {
  const hasNavVerb =
    normQuery.includes('chuyen sang') ||
    normQuery.includes('chuyen den') ||
    normQuery.includes('xem ') ||
    normQuery.includes('mo ') ||
    normQuery.includes('di toi') ||
    normQuery.includes('sang ');
  if (!hasNavVerb) return undefined;

  for (const entry of LABS_SITE_ALIASES) {
    if (entry.keywords.some((kw) => normQuery.includes(kw))) {
      const found = allSites.find((s) => s.id === entry.siteId);
      if (found) return found;
    }
  }

  return allSites.find((site) => {
    const normName = normalizeLabsCommandText(site.officialName);
    return normName.length > 4 && normQuery.includes(normName);
  });
}

const LABS_QUICK_PROMPTS_BY_LANG: Record<Language, readonly string[]> = {
  vi: [
    'Bóc tách kết cấu công trình này',
    'Kể chuyện dưới góc nhìn kiến trúc sư',
    'Đặt 1 câu hỏi đố vui lịch sử',
  ],
  en: [
    'Dissect the 3D structure of this monument',
    'Narrate from the architect’s perspective',
    'Ask me a historical trivia question',
  ],
  zh: [
    '拆解该建筑的 3D 结构',
    '以建筑师视角讲述建造故事',
    '出一道关于此遗迹的历史问答',
  ],
};

export const GeminiHeritageChat: React.FC<GeminiHeritageChatProps> = ({
  isOpen,
  onClose,
  currentSite,
  sites,
  hotspots,
  onFlyToHotspot,
  onSetRenderMode,
  onTriggerAutoTour,
  onSwitchSite,
  onSetLightingMode,
  onSetExplodedFactor,
  onSetSpatialSpotlight,
  onClearSpatialSpotlight,
  isMysteryModeActive = false,
  onToggleMysteryMode,
  mysteryRayClickEvent,
  onNavigateToTickets,
}) => {
  const { lang, getLocalizedSite } = useI18n();
  const localizedCurrentSite = useMemo(
    () => getLocalizedSite(currentSite),
    [getLocalizedSite, currentSite]
  );
  const { user, userTier, isAdmin, isTesterPro, entitlements, refreshEntitlements } = useAuth();
  const {
    hasLabsAccess,
    effectiveAiLabsEnabled,
    setGoldenHour3D,
    setWireframeOverlay,
  } = useLabs();
  const passportScope = user?.email || user?.userId;
  const quotaScopeKey = (user?.email || '').toLowerCase().trim() || user?.userId || 'guest';
  const { getCustomAudioForSite } = useAudioGuide();
  const passportStamps = useHeritagePassportStamps(passportScope);

  const canUseLabsChat = hasLabsAccess && effectiveAiLabsEnabled;
  const [chatMode, setChatMode] = useState<'standard' | 'labs'>('standard');
  const [testerCompareModel, setTesterCompareModel] = useState<'gemini-4-hydrogen' | 'gemini-3.5-flash'>('gemini-4-hydrogen');
  const [isTesterToolsOpen, setIsTesterToolsOpen] = useState<boolean>(false);
  const isLabsChatMode = canUseLabsChat && chatMode === 'labs';

  const resolvedUserTier: 'free' | 'plus' | 'pro' =
    isAdmin || userTier === 'pro' || entitlements.subscriptionTier === 'vip_49k'
      ? 'pro'
      : userTier === 'plus' || entitlements.subscriptionTier === 'route_19k'
      ? 'plus'
      : 'free';

  const activeModel = isTesterPro
    ? testerCompareModel
    : resolvedUserTier === 'pro'
    ? 'gemini-4-hydrogen'
    : resolvedUserTier === 'plus'
    ? 'gemini-3.5-flash'
    : entitlements.effectiveAiModel;

  const [persona, setPersona] = useState<CanonicalPersona>('Architect');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [isCompact, setIsCompact] = useState<boolean>(false);

  useEffect(() => {
    if (!canUseLabsChat && chatMode === 'labs') {
      setChatMode('standard');
    }
  }, [canUseLabsChat, chatMode]);

  const availableSites = useMemo(
    () => (sites && sites.length > 0 ? sites : HERITAGE_SITES),
    [sites]
  );

  // 60-Second Synchronized Spatial Docent Auto-Tour State
  const [tourStatus, setTourStatus] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [tourStepIndex, setTourStepIndex] = useState<number>(0);
  const [tourUsingCustomAudio, setTourUsingCustomAudio] = useState<boolean>(false);
  const tourAudioRef = useRef<HTMLAudioElement | null>(null);
  const tourTimerRef = useRef<number | null>(null);
  const tourRunTokenRef = useRef<number>(0);

  // Raycaster Mystery Challenge State
  const [mysteryShowHint, setMysteryShowHint] = useState<boolean>(false);
  const [mysteryAttempts, setMysteryAttempts] = useState<number>(0);
  const [mysteryFeedback, setMysteryFeedback] = useState<{
    matched: boolean;
    message: string;
  } | null>(null);
  const lastProcessedClickTimestampRef = useRef<number>(0);

  // Speech Recognition (Voice Query) State
  const [isListeningMic, setIsListeningMic] = useState<boolean>(false);
  const [micUnsupportedNotice, setMicUnsupportedNotice] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const docentData = useMemo(() => getLivingDocentSiteData(currentSite), [currentSite]);
  const roleplayIdentity = useMemo(
    () => getRoleplayIdentity(currentSite, persona, lang),
    [currentSite, persona, lang]
  );
  const suggestedQuestions = useMemo(
    () => getSuggestedQuestionsForSite(currentSite.id, lang),
    [currentSite.id, lang]
  );
  const currentStamp = passportStamps[currentSite.id];
  const unlockedCount = Object.keys(passportStamps).length;

  // Build 4 synchronized stations (approx 60s total: 15s/station) adapting to active Persona & Language
  const tourStations = useMemo<TourStationStep[]>(() => {
    const safeHotspots = hotspots.slice(0, 4);
    if (safeHotspots.length === 0) return [];
    const isUnderground =
      currentSite.id === 'HCM-DT-009' ||
      currentSite.id === 'BRVT-DT-003' ||
      currentSite.id === 'BD-DT-002' ||
      currentSite.id === 'HCM-DT-010';

    return safeHotspots.map((hp, idx) => {
      const mode: 'textured' | 'xray' = idx === 2 || (idx === 1 && isUnderground) ? 'xray' : 'textured';
      const exploded = idx === 1 && !isUnderground ? 0.55 : idx === 2 ? 0.25 : 0;
      const modeLabel =
        mode === 'xray'
          ? 'X-Ray'
          : exploded > 0.2
          ? lang === 'en'
            ? 'Exploded 3D'
            : lang === 'zh'
            ? '分层剖解'
            : 'Bóc tách 3D'
          : lang === 'en'
          ? 'PBR Studio'
          : lang === 'zh'
          ? '实体材质'
          : 'Nguyên bản PBR';

      let subtitle = '';
      if (lang === 'en') {
        subtitle =
          persona === 'Architect'
            ? `Station ${idx + 1} — ${hp.name}: Observe how I designed this zone. ${hp.description}`
            : persona === 'Eyewitness'
            ? `Station ${idx + 1} — ${hp.name}: I remember standing right here during ${currentSite.chronology}. ${hp.description}`
            : `Station ${idx + 1} — ${hp.name}: Historically anchored in ${currentSite.address.district}, ${hp.description}`;
      } else if (lang === 'zh') {
        subtitle =
          persona === 'Architect'
            ? `第 ${idx + 1} 站 · ${hp.name}：请跟随我的设计视角观察此核心构造。${hp.description}`
            : persona === 'Eyewitness'
            ? `第 ${idx + 1} 站 · ${hp.name}：当年我就站在这里见证了时代风云。${hp.description}`
            : `第 ${idx + 1} 站 · ${hp.name}：从历史比较视野来看，${hp.description}`;
      } else {
        subtitle =
          persona === 'Architect'
            ? `Trạm ${idx + 1} — ${hp.name}: Là tác giả công trình, tôi thiết kế khu vực này với điểm nhấn: ${hp.description}`
            : persona === 'Eyewitness'
            ? `Trạm ${idx + 1} — ${hp.name}: Ngay tại vị trí ánh sáng đang rọi vào, ký ức lịch sử vẫn còn nguyên: ${hp.description}`
            : `Trạm ${idx + 1} — ${hp.name}: Dưới góc độ thông sử ${currentSite.chronology}, đây là điểm kết nối quan trọng: ${hp.description}`;
      }

      return {
        stationIdx: idx,
        hotspot: hp,
        mode,
        exploded,
        modeLabel,
        subtitle,
      };
    });
  }, [hotspots, currentSite, persona, lang]);

  const stopAllTourAudioAndTimers = useCallback(() => {
    tourRunTokenRef.current += 1;
    speechEngine.stop();
    if (tourTimerRef.current !== null) {
      window.clearTimeout(tourTimerRef.current);
      tourTimerRef.current = null;
    }
    if (tourAudioRef.current) {
      tourAudioRef.current.pause();
      tourAudioRef.current.currentTime = 0;
      tourAudioRef.current.onended = null;
    }
  }, []);

  const stopTourAndRestore = useCallback(
    (clearSpotlight = true) => {
      stopAllTourAudioAndTimers();
      setTourStatus('idle');
      setTourStepIndex(0);
      setTourUsingCustomAudio(false);
      if (clearSpotlight) {
        onSetExplodedFactor?.(0);
        onSetRenderMode('textured');
        onClearSpatialSpotlight?.();
      }
    },
    [stopAllTourAudioAndTimers, onSetExplodedFactor, onSetRenderMode, onClearSpatialSpotlight]
  );

  // Stop speech/tour/mic safely when site switches or drawer closes
  useEffect(() => {
    stopAllTourAudioAndTimers();
    setTourStatus('idle');
    setTourStepIndex(0);
    setMysteryAttempts(0);
    setMysteryFeedback(null);
    setMysteryShowHint(false);
    setSpeakingMsgId(null);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListeningMic(false);
    }
  }, [currentSite.id, stopAllTourAudioAndTimers]);

  useEffect(() => {
    if (!isOpen) {
      stopAllTourAudioAndTimers();
      setTourStatus('idle');
      setSpeakingMsgId(null);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        setIsListeningMic(false);
      }
    }
  }, [isOpen, stopAllTourAudioAndTimers]);

  useEffect(() => {
    return () => {
      stopAllTourAudioAndTimers();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [stopAllTourAudioAndTimers]);

  // Welcome message per site + persona + lang
  useEffect(() => {
    const polymathSourceLine = `\n\nNguồn tham khảo: ${docentData.polymathSources}`;
    const greeting =
      lang === 'en'
        ? persona === 'Polymath'
          ? `Greetings! I am **${roleplayIdentity.name}**. We are examining **${localizedCurrentSite.officialName}** (*${localizedCurrentSite.address.district}*).\n\n${roleplayIdentity.intro}${polymathSourceLine}`
          : `Welcome! I am **${roleplayIdentity.name}** (*${roleplayIdentity.title}*).\n\n${roleplayIdentity.intro}\n\nLaunch the **3D Witness Tour** or test your eye with the **3D Architecture Mystery** above!`
        : lang === 'zh'
        ? persona === 'Polymath'
          ? `您好！我是 **${roleplayIdentity.name}**。我们正在考察 **${localizedCurrentSite.officialName}**（*${localizedCurrentSite.address.district}*）。\n\n${roleplayIdentity.intro}${polymathSourceLine}`
          : `您好！我是 **${roleplayIdentity.name}**（*${roleplayIdentity.title}*）。\n\n${roleplayIdentity.intro}\n\n欢迎点击上方启动 **3D 人物导览** 或挑战 **点击 3D 解码建筑秘密**！`
        : persona === 'Polymath'
        ? `Kính chào quý khách! Tôi là **${roleplayIdentity.name}** (*${roleplayIdentity.title}*).\n\n${roleplayIdentity.intro}${polymathSourceLine}`
        : `Xin chào quý khách! Tôi là **${roleplayIdentity.name}** (*${roleplayIdentity.title}*).\n\n${roleplayIdentity.intro}\n\nBạn có thể bấm **Tour 3D** hoặc thử sức với **Giải mã 3D** bằng cách chạm trực tiếp lên mô hình 3D!`;

    setMessages([
      {
        id: `welcome-${currentSite.id}-${persona}-${lang}`,
        role: 'model',
        content: greeting,
        persona,
        spatialActions: [],
        timestamp: new Date().toLocaleTimeString(
          lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en-US' : 'vi-VN',
          { hour: '2-digit', minute: '2-digit' }
        ),
        modelUsed: activeModel,
      },
    ]);
  }, [
    currentSite.id,
    currentSite.officialName,
    currentSite.address.district,
    persona,
    roleplayIdentity,
    docentData.polymathSources,
    lang,
    activeModel,
    localizedCurrentSite.address.district,
    localizedCurrentSite.officialName,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Run one station of the 60s Synchronized Spatial Tour
  const runTourStation = useCallback(
    (stepIdx: number) => {
      if (tourStations.length === 0) {
        onTriggerAutoTour();
        return;
      }

      if (stepIdx >= tourStations.length) {
        stopTourAndRestore(true);
        return;
      }

      stopAllTourAudioAndTimers();
      const myToken = tourRunTokenRef.current;
      const step = tourStations[stepIdx];

      setTourStatus('playing');
      setTourStepIndex(stepIdx);

      // 1. Fly Camera + Lock Spatial Gold Spotlight & Laser Ring
      onFlyToHotspot(step.hotspot);
      onSetSpatialSpotlight?.(step.hotspot.targetPos, step.hotspot.name);

      // 2. Apply Anatomical Mode (Exploded / X-Ray / PBR)
      onSetRenderMode(step.mode);
      onSetExplodedFactor?.(step.exploded);

      // 3. Prioritize User Recorded Audio if uploaded for this site, else SpeechEngine (VI/EN/ZH)
      const customTrack = getCustomAudioForSite(currentSite.id);
      if (customTrack && customTrack.url) {
        setTourUsingCustomAudio(true);
        if (!tourAudioRef.current) {
          tourAudioRef.current = new Audio();
        }
        const audioEl = tourAudioRef.current;
        if (audioEl.src !== customTrack.url) {
          audioEl.src = customTrack.url;
        }
        const approxSegmentSec = Math.max(
          10,
          Math.min(18, Math.floor((customTrack.durationSec || 60) / tourStations.length))
        );
        const startOffset = Math.min(
          Math.max(0, (customTrack.durationSec || 60) - 8),
          stepIdx * approxSegmentSec
        );
        if (Number.isFinite(startOffset) && stepIdx === 0) {
          audioEl.currentTime = 0;
        } else if (Number.isFinite(startOffset) && Math.abs(audioEl.currentTime - startOffset) > 4) {
          audioEl.currentTime = startOffset;
        }

        audioEl.play().catch(() => {
          // If autoplay restricted, continue station pacing cleanly with live subtitles
        });

        tourTimerRef.current = window.setTimeout(() => {
          if (tourRunTokenRef.current !== myToken) return;
          runTourStation(stepIdx + 1);
        }, 15000);
      } else {
        setTourUsingCustomAudio(false);
        let advanced = false;
        const advanceOnce = () => {
          if (advanced || tourRunTokenRef.current !== myToken) return;
          advanced = true;
          if (tourTimerRef.current !== null) {
            window.clearTimeout(tourTimerRef.current);
            tourTimerRef.current = null;
          }
          tourTimerRef.current = window.setTimeout(() => {
            if (tourRunTokenRef.current !== myToken) return;
            runTourStation(stepIdx + 1);
          }, 900);
        };

        // Safety fallback timer (16s max per station so 4 stations ≈ 60s even if TTS silent)
        tourTimerRef.current = window.setTimeout(advanceOnce, 15500);

        speechEngine.speakText(step.subtitle, {
          lang,
          rate: 1.0,
          onComplete: advanceOnce,
        });
      }
    },
    [
      tourStations,
      onTriggerAutoTour,
      stopTourAndRestore,
      stopAllTourAudioAndTimers,
      onFlyToHotspot,
      onSetSpatialSpotlight,
      onSetRenderMode,
      onSetExplodedFactor,
      getCustomAudioForSite,
      currentSite.id,
      lang,
    ]
  );

  const handleStartOrToggleTour = () => {
    if (tourStatus === 'playing') {
      stopAllTourAudioAndTimers();
      setTourStatus('paused');
      return;
    }
    if (tourStatus === 'paused') {
      runTourStation(tourStepIndex);
      return;
    }
    // Exit Mystery mode cleanly before starting automated tour
    if (isMysteryModeActive && onToggleMysteryMode) {
      onToggleMysteryMode(false);
    }
    runTourStation(0);
  };

  // Evaluate Raycaster Clicks during "Thử thách Giải mã Kiến trúc"
  useEffect(() => {
    if (!isMysteryModeActive || !mysteryRayClickEvent) return;
    if (mysteryRayClickEvent.timestamp === lastProcessedClickTimestampRef.current) return;
    lastProcessedClickTimestampRef.current = mysteryRayClickEvent.timestamp;

    const mystery = docentData.mystery;
    const result = evaluateMysteryRayClick(
      mysteryRayClickEvent.hitPoint,
      mystery.targetCenter,
      mystery.acceptRadius,
      lang
    );

    const nextAttempts = mysteryAttempts + 1;
    setMysteryAttempts(nextAttempts);
    setMysteryFeedback({
      matched: result.matched,
      message: result.feedback,
    });

    if (result.matched) {
      // 1. Focus Spotlight + Camera + Exploded/X-Ray Reveal
      const targetHotspot = hotspots[mystery.targetHotspotIndex] || hotspots[0];
      if (targetHotspot) {
        onFlyToHotspot(targetHotspot);
      }
      onSetSpatialSpotlight?.(mystery.targetCenter, mystery.secretTitle[lang]);
      if (mystery.revealMode === 'xray') {
        onSetRenderMode('xray');
      } else {
        onSetRenderMode('textured');
        onSetExplodedFactor?.(0.48);
      }

      // 2. Stamp Digital Heritage Passport!
      unlockPassportStamp(
        {
          siteId: currentSite.id,
          siteName: currentSite.officialName,
          secretTitle: mystery.secretTitle[lang],
          stampCode: mystery.stampCode,
          attempts: nextAttempts,
        },
        passportScope
      );

      // 3. Exit active click trap cleanly while keeping spotlight + unlock reveal visible
      onToggleMysteryMode?.(false);

      // 4. Narrate unlocked lore cleanly if user audio isn't busy
      speechEngine.speakText(`${mystery.secretTitle[lang]}. ${mystery.secretStory[lang]}`, {
        lang,
        rate: 1.0,
      });
    }
  }, [
    isMysteryModeActive,
    mysteryRayClickEvent,
    docentData.mystery,
    lang,
    mysteryAttempts,
    hotspots,
    onFlyToHotspot,
    onSetSpatialSpotlight,
    onSetRenderMode,
    onSetExplodedFactor,
    currentSite.id,
    currentSite.officialName,
    onToggleMysteryMode,
  ]);

  const executeSpatialActions = useCallback(
    (actions: SpatialActionBadge[]) => {
      for (const act of actions) {
        if (act.tag === 'MODE_XRAY') {
          onSetRenderMode('xray');
        } else if (act.tag === 'MODE_WIREFRAME') {
          onSetRenderMode('wireframe');
        } else if (act.tag === 'MODE_TEXTURED') {
          onSetRenderMode('textured');
        } else if (act.tag === 'START_TOUR' || act.tag === 'AUTO_TOUR') {
          runTourStation(0);
        } else if (act.tag.startsWith('HOTSPOT_')) {
          const idx = parseInt(tagToIndex(act.tag), 10) - 1;
          const target = hotspots[idx] || hotspots[0];
          if (target) {
            onFlyToHotspot(target);
            onSetSpatialSpotlight?.(target.targetPos, target.name);
          }
        }
      }
    },
    [hotspots, onFlyToHotspot, onSetRenderMode, onSetSpatialSpotlight, runTourStation]
  );

  const handleToggleSpeech = (msgId: string, textToRead: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingMsgId === msgId) {
      speechEngine.stop();
      setSpeakingMsgId(null);
      return;
    }

    const cleanSpeechText = textToRead.replace(/[*#_`~]/g, '');
    setSpeakingMsgId(msgId);
    speechEngine.speakText(cleanSpeechText, {
      lang,
      rate: 1.0,
      onComplete: () => setSpeakingMsgId(null),
    });
  };

  const handleSendMessage = async (questionText?: string) => {
    const query = (questionText ?? inputText).trim();
    if (!query || isLoading) return;

    const isFreeLimited =
      resolvedUserTier === 'free' &&
      entitlements.subscriptionTier === 'free' &&
      !isAdmin &&
      !isTesterPro;
    if (isFreeLimited && (entitlements.aiRemainingToday ?? 0) <= 0) {
      if (!questionText) {
        setInputText('');
      }
      const nowTime = new Date().toLocaleTimeString(
        lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en-US' : 'vi-VN',
        { hour: '2-digit', minute: '2-digit' }
      );
      const limitMsg =
        lang === 'en'
          ? 'You have used all 3/3 daily questions on the Free Tier (Gemini 2.5 Flash). Please upgrade to the 19k Route Pass (Gemini 3.5 Flash) or 49k VIP Pass (Unlimited Gemini 4 Hydrogen) in Tickets & EdTech to continue.'
          : lang === 'zh'
          ? '您今日在免费版（Gemini 2.5 Flash）的 3/3 次提问额度已用完。请前往“门票与数字教材”升级 19k 路线票（Gemini 3.5 Flash）或 49k VIP（无限量 Gemini 4 Hydrogen）继续体验。'
          : 'Bạn đã dùng hết 3/3 lượt hỏi miễn phí trong ngày ở Gói Khám Phá (Gemini 2.5 Flash). Vui lòng nâng cấp lên Vé Tuyến 19k (Gemini 3.5 Flash) hoặc Vé VIP 49k (Gemini 4 Hydrogen không giới hạn) tại mục Vé & Học liệu để tiếp tục hỏi đáp.';
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: query,
          persona,
          spatialActions: [],
          timestamp: nowTime,
        },
        {
          id: `quota-${Date.now() + 1}`,
          role: 'model',
          content: limitMsg,
          persona,
          spatialActions: [],
          timestamp: nowTime,
          modelUsed: 'gemini-2.5-flash',
        },
      ]);
      return;
    }

    if (!questionText) {
      setInputText('');
    }

    let activePersonaForQuery: CanonicalPersona = persona;
    let targetSiteForQuery: HeritageSite = currentSite;
    const labsConfirmations: string[] = [];

    if (isLabsChatMode) {
      const norm = normalizeLabsCommandText(query);

      if (
        norm.includes('kien truc su') ||
        norm.includes('goc nhin kien tao') ||
        norm.includes('architect') ||
        query.includes('建筑师')
      ) {
        activePersonaForQuery = 'Architect';
        if (persona !== 'Architect') setPersona('Architect');
      }

      if (
        norm.includes('tat x-ray') ||
        norm.includes('tat xray') ||
        norm.includes('nguyen ban') ||
        norm.includes('mac dinh') ||
        norm.includes('khoi phuc') ||
        norm.includes('restore original') ||
        query.includes('恢复原貌')
      ) {
        onSetRenderMode('textured');
        onSetExplodedFactor?.(0);
        labsConfirmations.push(
          lang === 'en'
            ? '↳ Restored Original Architecture Mode'
            : lang === 'zh'
            ? '↳ 已恢复原貌建筑模式'
            : '↳ Đã khôi phục chế độ Kiến trúc Nguyên bản'
        );
      } else if (norm.includes('x-ray') || norm.includes('xray') || query.includes('X光') || query.includes('透视')) {
        onSetRenderMode('xray');
        labsConfirmations.push(
          lang === 'en'
            ? '↳ Switched to X-Ray Cutaway Mode'
            : lang === 'zh'
            ? '↳ 已切换至 X光透视模式'
            : '↳ Đã chuyển sang chế độ Mặt cắt X-Ray'
        );
      }

      if (
        norm.includes('boc tach') ||
        norm.includes('tach lop') ||
        norm.includes('giai phau') ||
        norm.includes('dissect') ||
        norm.includes('explode') ||
        query.includes('拆解')
      ) {
        onSetExplodedFactor?.(0.72);
        labsConfirmations.push(
          lang === 'en'
            ? '↳ Activated 3D Exploded Structure Mode'
            : lang === 'zh'
            ? '↳ 已激活 3D 结构拆解模式'
            : '↳ Đã kích hoạt chế độ Bóc tách Kết cấu 3D'
        );
      } else if (norm.includes('thu gon') || norm.includes('lap lai') || norm.includes('collapse')) {
        onSetExplodedFactor?.(0);
        labsConfirmations.push(
          lang === 'en'
            ? '↳ Collapsed 3D structure to solid form'
            : lang === 'zh'
            ? '↳ 已将 3D 结构收拢恢复整体'
            : '↳ Đã thu gọn kết cấu 3D về nguyên khối'
        );
      }

      if (norm.includes('tat gio vang') || norm.includes('tat anh sang gio vang')) {
        setGoldenHour3D(false);
        onSetLightingMode?.('studio');
        labsConfirmations.push(
          lang === 'en'
            ? '↳ Disabled Golden Hour lighting, restored Studio lighting'
            : lang === 'zh'
            ? '↳ 已关闭黄金时刻光照，恢复工作室光照'
            : '↳ Đã tắt Ánh sáng Giờ Vàng, khôi phục ánh sáng Studio'
        );
      } else if (
        norm.includes('gio vang') ||
        norm.includes('hoang hon') ||
        norm.includes('golden hour') ||
        query.includes('黄金时刻')
      ) {
        setGoldenHour3D(true);
        onSetLightingMode?.('golden');
        labsConfirmations.push(
          lang === 'en'
            ? '↳ Enabled Golden Hour 3D Lighting'
            : lang === 'zh'
            ? '↳ 已开启黄金时刻 3D 光照 (Golden Hour 3D)'
            : '↳ Đã bật Ánh sáng Giờ Vàng (Golden Hour 3D)'
        );
      }

      if (norm.includes('tat luoi')) {
        setWireframeOverlay(false);
        labsConfirmations.push(
          lang === 'en'
            ? '↳ Disabled Technical Wireframe Mode'
            : lang === 'zh'
            ? '↳ 已关闭工程线框模式'
            : '↳ Đã tắt Chế độ Lưới Kỹ thuật'
        );
      } else if (
        norm.includes('luoi ky thuat') ||
        norm.includes('bat luoi') ||
        norm.includes('wireframe') ||
        query.includes('线框')
      ) {
        setWireframeOverlay(true);
        labsConfirmations.push(
          lang === 'en'
            ? '↳ Enabled Technical Wireframe Mode'
            : lang === 'zh'
            ? '↳ 已开启工程线框模式 (Wireframe)'
            : '↳ Đã bật Chế độ Lưới Kỹ thuật (Wireframe)'
        );
      }

      const matchedSite = findSiteForLabsCommand(norm, availableSites);
      if (matchedSite && matchedSite.id !== currentSite.id) {
        targetSiteForQuery = matchedSite;
        onSwitchSite?.(matchedSite);
        const locMatched = getLocalizedSite(matchedSite);
        labsConfirmations.push(
          lang === 'en'
            ? `↳ Switched viewport to ${locMatched.officialName}`
            : lang === 'zh'
            ? `↳ 已切换视角至 ${locMatched.officialName}`
            : `↳ Đã chuyển khung hình sang ${locMatched.officialName}`
        );
      }
    }

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      persona: activePersonaForQuery,
      spatialActions: [],
      timestamp: new Date().toLocaleTimeString(
        lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en-US' : 'vi-VN',
        { hour: '2-digit', minute: '2-digit' }
      ),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const hotspotPayload = hotspots.slice(0, 6).map((h, i) => ({
        index: i + 1,
        tag: `ACTION:HOTSPOT_${i + 1}`,
        name: h.name,
        description: h.description,
      }));

      const historyPayload = messages
        .filter((m) => !m.id.startsWith('welcome-'))
        .slice(-6)
        .map((m) => ({
          role: m.role,
          text: m.content,
        }));

      const targetIdentity = getRoleplayIdentity(
        targetSiteForQuery,
        activePersonaForQuery,
        lang
      );
      const targetDocent = getLivingDocentSiteData(targetSiteForQuery);

      const systemInstruction = buildHeritageSystemInstruction(
        targetSiteForQuery,
        activePersonaForQuery,
        hotspots,
        targetIdentity,
        lang
      );

      let rawReply = '';
      let usedModel: string = activeModel;

      const requestModelChat = async (modelToUse: string) => {
        const res = await fetch('/api/gemini/heritage-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: query,
            model: modelToUse,
            lang,
            userTier: resolvedUserTier,
            isPrioritySupport: resolvedUserTier === 'pro' || isAdmin || isTesterPro,
            systemInstruction,
            persona: activePersonaForQuery,
            monument: {
              id: targetSiteForQuery.id,
              code: targetSiteForQuery.identifierCode,
              officialName: targetSiteForQuery.officialName,
              district: `${targetSiteForQuery.address.district}, ${targetSiteForQuery.address.city}`,
              architecturalStyle: targetSiteForQuery.architecturalStyle,
              constructionPeriod: targetSiteForQuery.chronology,
              architectOrBuilder: targetSiteForQuery.architect,
              historicalEvents: (targetSiteForQuery.milestones || []).map(
                (m) => `${m.year}: ${m.event}`
              ),
              summary: targetSiteForQuery.summary,
            },
            roleplayIdentity: targetIdentity,
            hotspots: hotspotPayload,
            history: historyPayload,
          }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data && typeof data.text === 'string' && data.text.trim()) {
          return { text: data.text as string, modelUsed: (data.modelUsed as string) || modelToUse };
        }
        return null;
      };

      try {
        let result = await requestModelChat(activeModel);
        if (!result && activeModel === 'gemini-3.5-flash') {
          result = await requestModelChat('gemini-2.5-flash');
        }
        if (result) {
          rawReply = result.text;
          usedModel = result.modelUsed;
        }
      } catch {
        // Offline scholarly fallback handled below
      }

      if (!rawReply.trim()) {
        const normQuery = normalizeLabsCommandText(query);
        const locTarget = getLocalizedSite(targetSiteForQuery);
        if (
          isLabsChatMode &&
          (normQuery.includes('do vui') ||
            normQuery.includes('cau hoi') ||
            normQuery.includes('trivia') ||
            query.includes('问答'))
        ) {
          if (lang === 'en') {
            rawReply = `Historical Trivia · ${locTarget.officialName}:\n\n${locTarget.officialName} (${locTarget.chronology}) exemplifies ${locTarget.architecturalStyle} in ${locTarget.address.district}. Which architectural detail or milestone from ${locTarget.milestones?.[0]?.year || locTarget.chronology} defines its iconic status?\n\nClue: ${targetDocent.mystery?.secretStory?.[lang] || locTarget.summary}\n\nReply with your answer and I will verify it!`;
          } else if (lang === 'zh') {
            rawReply = `历史知识问答 · ${locTarget.officialName}：\n\n位于 ${locTarget.address.district} 的 ${locTarget.officialName}（${locTarget.chronology}）展现了典型的 ${locTarget.architecturalStyle}。请问该建筑在 ${locTarget.milestones?.[0]?.year || locTarget.chronology} 的哪一构造细节或历史事件成就了它的标志性地位？\n\n线索：${targetDocent.mystery?.secretStory?.[lang] || locTarget.summary}\n\n请发送您的答案，我来为您揭晓！`;
          } else {
            rawReply = `Đố vui Lịch sử · ${locTarget.officialName}:\n\nCông trình ${locTarget.officialName} (${locTarget.chronology}) gắn liền với phong cách ${locTarget.architecturalStyle} tại ${locTarget.address.district}. Theo bạn, yếu tố kiến trúc hoặc dấu mốc năm ${locTarget.milestones?.[0]?.year || locTarget.chronology} nào đã làm nên giá trị biểu tượng của công trình này?\n\nGợi ý: ${targetDocent.mystery?.secretStory?.[lang] || locTarget.summary}\n\nHãy nhắn câu trả lời của bạn để tôi đối chiếu nhé!`;
          }
        } else {
          rawReply = buildScholarlyFallbackResponse(
            query,
            locTarget,
            activePersonaForQuery,
            hotspots,
            lang
          );
        }
      }

      // Guarantee Polymath responses always end with explicit Nguồn tham khảo:
      if (activePersonaForQuery === 'Polymath' && !/Nguồn tham khảo\s*:/i.test(rawReply)) {
        rawReply = `${rawReply}\n\nNguồn tham khảo: ${targetDocent.polymathSources}`;
      }

      const { cleanText, actions } = parseGeminiResponseAndActions(rawReply, hotspots, lang);

      if (actions.length > 0) {
        executeSpatialActions(actions);
      }

      const modelMsg: ChatMessageItem = {
        id: `model-${Date.now()}`,
        role: 'model',
        content: cleanText,
        persona: activePersonaForQuery,
        spatialActions: actions,
        ...(labsConfirmations.length > 0 ? { labsConfirmations } : {}),
        timestamp: new Date().toLocaleTimeString(
          lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en-US' : 'vi-VN',
          { hour: '2-digit', minute: '2-digit' }
        ),
        modelUsed: usedModel,
      };

      setMessages((prev) => [...prev, modelMsg]);
      if (isFreeLimited) {
        incrementFreeAiDailyUsage(quotaScopeKey);
        refreshEntitlements();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleVoiceMic = () => {
    setMicUnsupportedNotice(null);
    if (isListeningMic && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListeningMic(false);
      return;
    }

    const win = window as SpeechRecognitionWindow;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setMicUnsupportedNotice(
        lang === 'en'
          ? 'Voice input requires Chrome or Edge browser.'
          : lang === 'zh'
          ? '语音输入需要 Chrome 或 Edge 浏览器支持。'
          : 'Nhập giọng nói hỗ trợ trên trình duyệt Chrome / Edge.'
      );
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = lang === 'en' ? 'en-US' : lang === 'zh' ? 'zh-CN' : 'vi-VN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (ev) => {
        const transcript = ev.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          setInputText(transcript);
          void handleSendMessage(transcript);
        }
      };
      rec.onerror = () => {
        setIsListeningMic(false);
      };
      rec.onend = () => {
        setIsListeningMic(false);
      };
      recognitionRef.current = rec;
      setIsListeningMic(true);
      rec.start();
    } catch {
      setIsListeningMic(false);
    }
  };

  if (!isOpen) return null;

  const activeTourStep = tourStations[tourStepIndex] || null;
  const mystery = docentData.mystery;
  const hasSpatialFocus = tourStatus !== 'idle' || Boolean(isMysteryModeActive);

  const handleCloseDrawer = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const tierStatusLabel =
    activeModel === 'gemini-4-hydrogen'
      ? lang === 'en'
        ? 'Pro · Gemini 4 Hydrogen'
        : lang === 'zh'
        ? 'Pro · Gemini 4 Hydrogen'
        : 'Pro · Gemini 4 Hydrogen'
      : activeModel === 'gemini-3.5-flash'
      ? lang === 'en'
        ? 'Plus · Gemini 3.5 Flash'
        : lang === 'zh'
        ? 'Plus · Gemini 3.5 Flash'
        : 'Plus · Gemini 3.5 Flash'
      : 'Gemini 2.5 Flash';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        lang === 'en'
          ? 'AI Heritage Curator'
          : lang === 'zh'
          ? 'AI 遗产策展人'
          : 'Trợ lý Giám tuyển AI'
      }
      className={`fixed inset-0 w-full h-[100dvh] rounded-none z-50 md:inset-auto md:bottom-5 md:right-5 md:w-[440px] ${
        isCompact ? 'md:h-[260px]' : 'md:h-[640px]'
      } md:rounded-md bg-[#171817] border border-[#C9A46A]/35 shadow-2xl flex flex-col overflow-hidden pointer-events-auto text-[#D8C9A9]`}
    >
      {/* HEADER 2 TẦNG THOÁNG ĐÃNG — TẦNG 1: TIÊU ĐỀ & THU GỌN / MỞ RỘNG; TẦNG 2: TRẠNG THÁI MODEL & NÂNG CẤP */}
      <div className="bg-[#171817] shrink-0">
        {/* TẦNG 1 */}
        <div className="px-4 py-3 border-b border-[#D8C9A9]/12 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#C9A46A] shrink-0" />
            <span className="font-serif text-base font-semibold text-[#D8C9A9] truncate">
              {localizedCurrentSite.officialName}
            </span>
          </div>

          <div className="shrink-0 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsCompact((prev) => !prev)}
              className="hidden md:flex w-7 h-7 rounded-sm border border-[#D8C9A9]/20 bg-[#171817] hover:border-[#C9A46A] text-[#D8C9A9] items-center justify-center cursor-pointer transition-colors"
              title={
                isCompact
                  ? lang === 'en'
                    ? 'Expand'
                    : lang === 'zh'
                    ? '展开'
                    : 'Mở rộng'
                  : lang === 'en'
                  ? 'Minimize'
                  : lang === 'zh'
                  ? '收起'
                  : 'Thu gọn'
              }
            >
              {isCompact ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={handleCloseDrawer}
              title={lang === 'en' ? 'Collapse AI Assistant' : lang === 'zh' ? '收起 AI 助理' : 'Thu gọn mục AI'}
              aria-label={lang === 'en' ? 'Collapse AI Assistant' : lang === 'zh' ? '收起 AI 助理' : 'Thu gọn mục AI'}
              className="w-7 h-7 rounded-sm border border-[#D8C9A9]/25 bg-[#171817] hover:bg-[#A94F3D] hover:border-[#A94F3D] text-[#D8C9A9] flex items-center justify-center cursor-pointer transition-colors shrink-0 relative z-10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TẦNG 2 */}
        <div className="px-4 py-2 bg-[#D8C9A9]/[0.04] border-b border-[#D8C9A9]/10 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-[#C9A46A]">{tierStatusLabel}</span>

          {!isAdmin && !isTesterPro && activeModel !== 'gemini-4-hydrogen' && onNavigateToTickets && (
            <button
              type="button"
              onClick={onNavigateToTickets}
              className="px-2.5 py-1 rounded-sm border border-[#A94F3D] text-[#D8C9A9] hover:bg-[#A94F3D] text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap"
            >
              {lang === 'en'
                ? 'Upgrade 19k / 49k'
                : lang === 'zh'
                ? '升级 19k / 49k'
                : 'Nâng cấp gói 19k / 49k'}
            </button>
          )}
        </div>

        {/* CHỌN VAI TRÒ + CHẾ ĐỘ TIÊU CHUẨN / LABS */}
        <div className="px-4 py-2.5 border-b border-[#C9A46A]/20 flex items-center gap-2">
          <div className="grid grid-cols-3 gap-1 flex-1 bg-[#171817] border border-[#D8C9A9]/20 p-1 rounded-sm">
            {(
              [
                {
                  id: 'Architect' as const,
                  icon: Landmark,
                  label:
                    lang === 'en'
                      ? 'Architect'
                      : lang === 'zh'
                      ? '建筑匠师'
                      : 'Kiến trúc sư',
                },
                {
                  id: 'Eyewitness' as const,
                  icon: Flame,
                  label:
                    lang === 'en'
                      ? 'Witness'
                      : lang === 'zh'
                      ? '历史亲历'
                      : 'Nhân chứng',
                },
                {
                  id: 'Polymath' as const,
                  icon: ScrollText,
                  label:
                    lang === 'en'
                      ? 'Historian'
                      : lang === 'zh'
                      ? '博学史家'
                      : 'Thông sử',
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = persona === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPersona(tab.id)}
                  className={`py-1.5 px-1.5 rounded-sm text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer min-w-0 ${
                    active
                      ? 'bg-[#C9A46A] text-[#171817] font-semibold'
                      : 'text-[#D8C9A9]/80 hover:text-[#D8C9A9]'
                  }`}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {canUseLabsChat && (
            <div className="inline-flex rounded-sm border border-[#D8C9A9]/20 bg-[#171817] p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setChatMode('standard')}
                className={`px-2 py-1 rounded-sm text-[10.5px] font-medium cursor-pointer transition-colors ${
                  !isLabsChatMode ? 'bg-[#526D8B] text-[#D8C9A9]' : 'text-[#D8C9A9]/70 hover:text-[#D8C9A9]'
                }`}
              >
                {lang === 'en' ? 'Std' : lang === 'zh' ? '标准' : 'Tiêu chuẩn'}
              </button>
              <button
                type="button"
                onClick={() => setChatMode('labs')}
                className={`px-2 py-1 rounded-sm text-[10.5px] font-semibold cursor-pointer transition-colors ${
                  isLabsChatMode ? 'bg-[#C9A46A] text-[#171817]' : 'text-[#D8C9A9]/70 hover:text-[#D8C9A9]'
                }`}
              >
                Labs
              </button>
            </div>
          )}
        </div>

        {/* TẦNG 3: NHÂN VẬT ĐANG NHẬP VAI + NÚT TOUR 3D + MÃ HỘ CHIẾU */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#C9A46A] truncate">
              {roleplayIdentity.name}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-[#C9A46A]/35 text-[10px] text-[#D8C9A9] tabular-nums shrink-0">
              <Award className="w-2.5 h-2.5 text-[#C9A46A]" />
              <span>{unlockedCount}/17</span>
            </span>
            {resolvedUserTier === 'free' && !isAdmin && !isTesterPro && (
              <span className="text-[10px] text-[#D8C9A9]/70 tabular-nums shrink-0">
                ({entitlements.aiRemainingToday ?? 0}/{entitlements.aiDailyLimit ?? 3})
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleStartOrToggleTour}
              className="h-7 px-2.5 rounded-sm bg-[#C9A46A] hover:bg-[#D8C9A9] text-[#171817] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
            >
              {tourStatus === 'playing' ? (
                <>
                  <Pause className="w-3 h-3 shrink-0" />
                  <span>{lang === 'en' ? 'Pause' : lang === 'zh' ? '暂停' : 'Tạm dừng'}</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 shrink-0" />
                  <span>{lang === 'en' ? '3D Tour' : lang === 'zh' ? '3D 导览' : 'Tour 3D'}</span>
                </>
              )}
            </button>

            {onToggleMysteryMode && (
              <button
                type="button"
                onClick={() => {
                  if (tourStatus !== 'idle') {
                    stopTourAndRestore(false);
                  }
                  const next = !isMysteryModeActive;
                  onToggleMysteryMode(next);
                  if (!next) setMysteryFeedback(null);
                }}
                className={`h-7 px-2 rounded-sm border text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                  isMysteryModeActive
                    ? 'bg-[#526D8B] border-[#C9A46A] text-[#D8C9A9]'
                    : 'bg-[#171817] border-[#D8C9A9]/25 text-[#D8C9A9] hover:border-[#C9A46A]'
                }`}
              >
                <Puzzle className="w-3 h-3 text-[#C9A46A] shrink-0" />
                <span>{lang === 'en' ? 'Mystery' : lang === 'zh' ? '解谜' : 'Giải mã 3D'}</span>
              </button>
            )}

            {hasSpatialFocus && (
              <button
                type="button"
                onClick={() => {
                  stopTourAndRestore(true);
                  onToggleMysteryMode?.(false);
                }}
                className="h-7 w-7 rounded-sm border border-[#D8C9A9]/25 text-[#C9A46A] flex items-center justify-center cursor-pointer hover:border-[#C9A46A]"
                title={lang === 'en' ? 'Restore View' : lang === 'zh' ? '恢复视角' : 'Khôi phục góc nhìn'}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* NGĂN MỞ RỘNG GỌN: CÔNG CỤ TESTER (CHỈ DÀNH CHO TESTER PRO) */}
        {isTesterPro && (
          <div className="pt-1 border-t border-[#D8C9A9]/15">
            <button
              type="button"
              onClick={() => setIsTesterToolsOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-[11px] text-[#47796D] hover:text-[#C9A46A] font-semibold cursor-pointer py-0.5"
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-[#47796D] text-[#D8C9A9] text-[10px]">
                  Tester Pro
                </span>
                <span className="text-[#D8C9A9]/80">
                  {lang === 'en' ? 'Tester Tools' : lang === 'zh' ? '测试工具' : 'Công cụ Tester'}
                </span>
              </span>
              {isTesterToolsOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#D8C9A9]/70" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#D8C9A9]/70" />
              )}
            </button>

            {isTesterToolsOpen && (
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTesterCompareModel('gemini-4-hydrogen')}
                  className={`py-1.5 px-2 rounded-sm border text-[10.5px] font-semibold cursor-pointer transition-colors ${
                    testerCompareModel === 'gemini-4-hydrogen'
                      ? 'bg-[#171817] border-[#C9A46A] text-[#C9A46A]'
                      : 'border-[#D8C9A9]/20 text-[#D8C9A9]/75 hover:text-[#D8C9A9]'
                  }`}
                >
                  Pro · Gemini 4 Hydrogen
                </button>
                <button
                  type="button"
                  onClick={() => setTesterCompareModel('gemini-3.5-flash')}
                  className={`py-1.5 px-2 rounded-sm border text-[10.5px] font-semibold cursor-pointer transition-colors ${
                    testerCompareModel === 'gemini-3.5-flash'
                      ? 'bg-[#526D8B] border-[#C9A46A] text-[#D8C9A9]'
                      : 'border-[#D8C9A9]/20 text-[#D8C9A9]/75 hover:text-[#D8C9A9]'
                  }`}
                >
                  Plus · Gemini 3.5 Flash
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LIVE 60-SECOND TOUR SUBTITLE RIBBON */}
      {!isCompact && tourStatus !== 'idle' && activeTourStep && (
        <div className="px-4 py-2.5 bg-[#171817] border-b border-[#C9A46A]/30 space-y-1.5 shrink-0">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-sans text-[#C9A46A] font-semibold tabular-nums">
              {lang === 'en'
                ? `Station ${tourStepIndex + 1}/${tourStations.length}`
                : lang === 'zh'
                ? `第 ${tourStepIndex + 1}/${tourStations.length} 站`
                : `Trạm ${tourStepIndex + 1}/${tourStations.length}`}{' '}
              · {activeTourStep.modeLabel}
            </span>
            <div className="flex items-center gap-1.5">
              {tourUsingCustomAudio && (
                <span className="px-1.5 py-0.5 rounded-sm bg-[#47796D] text-[#D8C9A9] text-[10px]">
                  Audio
                </span>
              )}
              <button
                type="button"
                onClick={() => runTourStation(tourStepIndex + 1)}
                className="px-2 py-0.5 rounded-sm border border-[#D8C9A9]/20 text-[#D8C9A9] hover:border-[#C9A46A] cursor-pointer"
              >
                <SkipForward className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => stopTourAndRestore(true)}
                className="px-2 py-0.5 rounded-sm border border-[#A94F3D] text-[#D8C9A9] hover:bg-[#A94F3D] cursor-pointer"
              >
                <Square className="w-3 h-3" />
              </button>
            </div>
          </div>
          <p className="text-[11.5px] leading-relaxed text-[#D8C9A9] font-sans">
            {activeTourStep.subtitle}
          </p>
        </div>
      )}

      {/* INTERACTIVE CLICK-ON-3D ARCHITECTURAL MYSTERY PANEL */}
      {!isCompact && (isMysteryModeActive || currentStamp) && (isMysteryModeActive || mysteryFeedback?.matched) && (
        <div className="px-4 py-2.5 bg-[#171817] border-b border-[#C9A46A]/25 space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-sans text-[11px] text-[#C9A46A] font-semibold tabular-nums">
              {mysteryFeedback?.matched || currentStamp
                ? lang === 'en'
                  ? 'Mystery Solved · Passport Stamped'
                  : lang === 'zh'
                  ? '解谜成功 · 遗产护照已盖章'
                  : 'Bí mật Lịch sử Được Khai Mở'
                : lang === 'en'
                ? `3D Mystery Challenge (${mysteryAttempts} clicks)`
                : lang === 'zh'
                ? `3D 解码挑战（尝试 ${mysteryAttempts} 次）`
                : `Thử thách Giải mã Kiến trúc (${mysteryAttempts} lần chọn)`}
            </span>
            {!mysteryFeedback?.matched && !currentStamp && (
              <button
                type="button"
                onClick={() => setMysteryShowHint((v) => !v)}
                className="text-[10.5px] text-[#C9A46A] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Lightbulb className="w-3 h-3" />
                <span>{lang === 'en' ? 'Hint' : lang === 'zh' ? '提示' : 'Gợi ý'}</span>
              </button>
            )}
          </div>

          {mysteryFeedback?.matched || (currentStamp && !isMysteryModeActive) ? (
            <div className="rounded-sm bg-[#47796D]/20 border border-[#47796D] p-2.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#D8C9A9]">
                  {mystery.secretTitle[lang]}
                </span>
                <span className="font-sans text-[10px] text-[#C9A46A] px-1.5 py-0.5 rounded-sm bg-[#171817] tabular-nums">
                  {mystery.stampCode}
                </span>
              </div>
              <p className="text-[11px] text-[#D8C9A9]/90 leading-relaxed">
                {mystery.secretStory[lang]}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-[#D8C9A9]">{mystery.title[lang]}</div>
              <p className="text-[11px] text-[#D8C9A9]/85 leading-relaxed">
                {mystery.riddle[lang].replace(/\*\*/g, '')}
              </p>
              {mysteryShowHint && (
                <p className="text-[10.5px] text-[#C9A46A] bg-[#171817] border border-[#C9A46A]/35 rounded-sm px-2 py-1">
                  {mystery.hintTip[lang]}
                </p>
              )}
              {mysteryFeedback && !mysteryFeedback.matched && (
                <div className="text-[11px] text-[#D8C9A9] bg-[#A94F3D]/25 border border-[#A94F3D] rounded-sm px-2.5 py-1.5">
                  {mysteryFeedback.message}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CHAT MESSAGES STREAM */}
      {!isCompact && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 modal-scrollbar bg-[#171817]">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isSpeakingThis = speakingMsgId === msg.id;
              const msgIdentity = getRoleplayIdentity(currentSite, msg.persona, lang);

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div
                    className={`max-w-[92%] rounded-md px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
                      isUser
                        ? 'bg-[#C9A46A] text-[#171817] font-medium'
                        : 'bg-[#171817] border border-[#D8C9A9]/20 text-[#D8C9A9]'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-[#D8C9A9]/15">
                        <span className="inline-flex items-center gap-1.5 font-sans text-[11px] font-semibold text-[#C9A46A] truncate">
                          {msg.persona === 'Architect' ? (
                            <Landmark className="w-3 h-3 shrink-0" />
                          ) : msg.persona === 'Eyewitness' ? (
                            <Flame className="w-3 h-3 shrink-0" />
                          ) : (
                            <ScrollText className="w-3 h-3 shrink-0" />
                          )}
                          <span className="truncate">{msgIdentity.name}</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleSpeech(msg.id, msg.content)}
                          className={`px-2 py-0.5 rounded-sm text-[10.5px] font-sans font-medium flex items-center gap-1 transition-colors cursor-pointer border shrink-0 ${
                            isSpeakingThis
                              ? 'bg-[#C9A46A] text-[#171817] border-[#C9A46A]'
                              : 'bg-[#171817] text-[#C9A46A] border-[#C9A46A]/35 hover:border-[#C9A46A]'
                          }`}
                        >
                          {isSpeakingThis ? (
                            <>
                              <VolumeX className="w-3 h-3" />
                              <span>{lang === 'en' ? 'Stop' : lang === 'zh' ? '停止' : 'Dừng'}</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" />
                              <span>{lang === 'en' ? 'Listen' : lang === 'zh' ? '朗读' : 'Nghe'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {!isUser && msg.labsConfirmations && msg.labsConfirmations.length > 0 && (
                      <div className="mb-2 pb-1.5 border-b border-[#D8C9A9]/15 space-y-0.5">
                        {msg.labsConfirmations.map((line, i) => (
                          <div
                            key={`${msg.id}-lab-${i}`}
                            className="text-[11px] font-medium text-[#C9A46A] leading-snug"
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1.5 break-words">
                      {renderFormattedChatMarkdown(msg.content, isUser)}
                    </div>

                    {msg.spatialActions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[#D8C9A9]/15 space-y-1">
                        {msg.spatialActions.map((act) => (
                          <div
                            key={act.tag}
                            className="px-2.5 py-1 rounded-sm bg-[#47796D]/20 border border-[#47796D] text-[#D8C9A9] text-[10.5px] font-medium flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#C9A46A] shrink-0" />
                            <span>{act.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] font-sans text-[#D8C9A9]/55 px-1 tabular-nums">
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#C9A46A]/30 w-fit text-xs text-[#C9A46A]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9A46A]" />
                <span>
                  {lang === 'en'
                    ? 'Curator is responding...'
                    : lang === 'zh'
                    ? '策展人正在检索文献并回复...'
                    : 'Giám tuyển AI đang tra cứu tư liệu...'}
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* BOTTOM PINNED CHIPS & COMPOSER */}
          <div className="px-3.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[#C9A46A]/20 bg-[#171817] shrink-0">
            {!isLabsChatMode ? (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mb-2">
                <Compass className="w-3.5 h-3.5 text-[#C9A46A] shrink-0" />
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isLoading}
                    onClick={() => void handleSendMessage(q)}
                    className="shrink-0 px-2.5 py-1 rounded-sm bg-[#171817] hover:border-[#C9A46A] border border-[#D8C9A9]/25 text-[11px] text-[#D8C9A9] transition-colors cursor-pointer max-w-[240px] truncate"
                    title={q}
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2 mb-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPersona('Polymath')}
                    className={`px-2.5 py-1 rounded-sm border text-[11px] font-medium transition-colors cursor-pointer truncate ${
                      persona === 'Polymath'
                        ? 'border-[#C9A46A] bg-[#C9A46A] text-[#171817] font-semibold'
                        : 'border-[#D8C9A9]/20 text-[#D8C9A9]/75 hover:text-[#D8C9A9]'
                    }`}
                  >
                    {lang === 'en'
                      ? 'Museum Curator'
                      : lang === 'zh'
                      ? '博物馆策展人'
                      : 'Giám tuyển Bảo tàng'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPersona('Architect')}
                    className={`px-2.5 py-1 rounded-sm border text-[11px] font-medium transition-colors cursor-pointer truncate ${
                      persona === 'Architect'
                        ? 'border-[#C9A46A] bg-[#C9A46A] text-[#171817] font-semibold'
                        : 'border-[#D8C9A9]/20 text-[#D8C9A9]/75 hover:text-[#D8C9A9]'
                    }`}
                  >
                    {lang === 'en'
                      ? 'Architect Perspective'
                      : lang === 'zh'
                      ? '建筑师视角'
                      : 'Góc nhìn Kiến tạo'}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {LABS_QUICK_PROMPTS_BY_LANG[lang].map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void handleSendMessage(q)}
                      className="shrink-0 px-2.5 py-1 rounded-sm border border-[#D8C9A9]/25 hover:border-[#C9A46A] text-[11px] text-[#D8C9A9] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {micUnsupportedNotice && (
              <div className="text-[10.5px] text-[#C9A46A] mb-1.5">{micUnsupportedNotice}</div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendMessage();
              }}
              className="flex items-center gap-1.5"
            >
              <button
                type="button"
                onClick={handleToggleVoiceMic}
                className={`h-9 w-9 rounded-sm border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                  isListeningMic
                    ? 'bg-[#A94F3D] border-[#A94F3D] text-[#D8C9A9]'
                    : 'bg-[#171817] border-[#D8C9A9]/25 hover:border-[#C9A46A] text-[#C9A46A]'
                }`}
                title={
                  lang === 'en'
                    ? 'Speak your question'
                    : lang === 'zh'
                    ? '语音提问'
                    : 'Đặt câu hỏi bằng giọng nói'
                }
              >
                {isListeningMic ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isListeningMic
                    ? lang === 'en'
                      ? 'Listening...'
                      : lang === 'zh'
                      ? '正在聆听...'
                      : 'Đang lắng nghe giọng nói...'
                    : lang === 'en'
                    ? `Ask ${roleplayIdentity.name}...`
                    : lang === 'zh'
                    ? `向 ${roleplayIdentity.name} 提问...`
                    : `Hỏi ${roleplayIdentity.name}...`
                }
                className="flex-1 min-w-0 h-9 bg-[#171817] border border-[#D8C9A9]/25 focus:border-[#C9A46A] rounded-sm px-3 text-xs text-[#D8C9A9] placeholder:text-[#D8C9A9]/45 outline-none transition-colors"
              />

              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="h-9 px-3.5 rounded-sm bg-[#C9A46A] hover:bg-[#D8C9A9] text-[#171817] font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{lang === 'en' ? 'Send' : lang === 'zh' ? '发送' : 'Hỏi'}</span>
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

function renderFormattedInline(text: string, isUser: boolean): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const raw = match[0];
    if (raw.startsWith('**') && raw.endsWith('**')) {
      tokens.push(
        <strong
          key={`b-${keyIdx++}`}
          className={`font-semibold ${isUser ? 'text-[#171817]' : 'text-[#C9A46A]'}`}
        >
          {raw.slice(2, -2)}
        </strong>
      );
    } else if (raw.startsWith('*') && raw.endsWith('*')) {
      tokens.push(
        <em key={`i-${keyIdx++}`} className="italic">
          {raw.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens.map((node) =>
    typeof node === 'string' ? node.replace(/\*{1,2}/g, '') : node
  );
}

function renderFormattedChatMarkdown(content: string, isUser: boolean): React.ReactNode {
  const lines = content.split('\n');
  return lines.map((rawLine, idx) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      return <div key={`sp-${idx}`} className="h-1" />;
    }
    const cleanLine = rawLine.replace(/^#{1,4}\s+/, '').replace(/^\s*[-•]\s+/, '• ');
    return (
      <p key={`ln-${idx}`} className="leading-relaxed">
        {renderFormattedInline(cleanLine, isUser)}
      </p>
    );
  });
}

function tagToIndex(tag: string): string {
  return tag.replace('HOTSPOT_', '');
}

export const GeminiHeritageAssistant = GeminiHeritageChat;
export default GeminiHeritageChat;
