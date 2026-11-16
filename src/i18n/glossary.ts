import { Language, SiteTranslation, TourTranslation } from './types';
import { HeritageSite, TourRoute } from '../types/heritage';

export interface LocalizedField {
  text: string;
  isPending: boolean;
}

/**
 * UTILITY: Loại bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu và cả hai ngôn ngữ
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * BẢNG THUẬT NGỮ CHUẨN (STANDARD GLOSSARY)
 * Tuân thủ yêu cầu bắt buộc:
 * - Di tích quốc gia đặc biệt = Special National Monument
 * - Quốc gia = National Monument
 * - Thành phố = City-level Monument
 * - Hồ sơ di sản = Heritage Archive
 * - Điểm nhấn kiến trúc = Architectural Highlights
 * - Bề mặt số = Digital Surface
 * - Khung dây = Wireframe
 * - Tự xoay = Auto-rotate
 * - Mô hình minh họa = Illustrative Model
 * - Quận 1 = District 1
 * - Công trình = Structures
 * - Tên gọi khác = Also known as
 */
export const HERITAGE_GLOSSARY: Record<string, { vi: string; en: string; zh: string }> = {
  // Cấp xếp hạng di tích
  'ranking.special_national': {
    vi: 'Di tích Quốc gia đặc biệt',
    en: 'Special National Monument',
    zh: '特别国家级遗迹',
  },
  'ranking.national': {
    vi: 'Di tích Quốc gia',
    en: 'National Monument',
    zh: '国家级遗迹',
  },
  'ranking.city': {
    vi: 'Di tích cấp Thành phố',
    en: 'City-level Monument',
    zh: '市级遗迹',
  },

  // Thuật ngữ công nghệ & hồ sơ
  'term.heritage_archive': {
    vi: 'Hồ sơ di sản',
    en: 'Heritage Archive',
    zh: '遗产档案',
  },
  'term.architectural_highlights': {
    vi: 'Điểm nhấn kiến trúc',
    en: 'Architectural Highlights',
    zh: '建筑亮点',
  },
  'term.digital_surface': {
    vi: 'Bề mặt số',
    en: 'Digital Surface',
    zh: '数字表面',
  },
  'term.wireframe': {
    vi: 'Khung dây',
    en: 'Wireframe',
    zh: '线框模式',
  },
  'term.auto_rotate': {
    vi: 'Tự xoay',
    en: 'Auto-rotate',
    zh: '自动旋转',
  },
  'term.illustrative_model': {
    vi: 'Mô hình minh họa',
    en: 'Illustrative Model',
    zh: '示意模型',
  },
  'term.structures': {
    vi: 'Công trình',
    en: 'Structures',
    zh: '处遗产建筑',
  },
  'term.also_known_as': {
    vi: 'Tên gọi khác',
    en: 'Also known as',
    zh: '别称',
  },

  // Loại hình di tích
  'type.architecture': {
    vi: 'Kiến trúc nghệ thuật',
    en: 'Architectural & Artistic',
    zh: '建筑与艺术',
  },
  'type.history': {
    vi: 'Lịch sử - Văn hóa',
    en: 'Historical & Cultural',
    zh: '历史与文化',
  },
  'type.archaeology': {
    vi: 'Khảo cổ học',
    en: 'Archaeological',
    zh: '考古遗址',
  },
  'type.scenic': {
    vi: 'Danh lam thắng cảnh',
    en: 'Scenic Landscape',
    zh: '名胜古迹',
  },

  // Tình trạng bảo tồn
  'status.good': {
    vi: 'Bảo tồn tốt',
    en: 'Well Preserved',
    zh: '保存完好',
  },
  'status.needs_conservation': {
    vi: 'Cần tu bổ, tôn tạo',
    en: 'Restoration Required',
    zh: '亟需修缮',
  },
  'status.under_restoration': {
    vi: 'Đang trong quá trình trùng tu',
    en: 'Currently Under Restoration',
    zh: '修缮保护中',
  },

  // Quận / Huyện TP.HCM & Liên vùng
  'district.q1': { vi: 'Quận 1', en: 'District 1', zh: '第一郡' },
  'district.q3': { vi: 'Quận 3', en: 'District 3', zh: '第三郡' },
  'district.q4': { vi: 'Quận 4', en: 'District 4', zh: '第四郡' },
  'district.q5': { vi: 'Quận 5', en: 'District 5', zh: '第五郡（堤岸）' },
  'district.bt': { vi: 'Quận Bình Thạnh', en: 'Binh Thanh District', zh: '平盛郡' },
  'district.tb': { vi: 'Quận Tân Bình', en: 'Tan Binh District', zh: '新平郡' },
  'district.cc': { vi: 'Huyện Củ Chi', en: 'Cu Chi District', zh: '古芝县' },
  'district.cg': { vi: 'Huyện Cần Giờ', en: 'Can Gio District', zh: '芹耶县' },
};

/**
 * HELPER: Chuyển đổi tên Quận/Huyện sang tiếng Anh, tiếng Trung hoặc giữ tiếng Việt chuẩn
 */
export function formatDistrict(districtVi: string, lang: Language): string {
  if (lang === 'vi') return districtVi;
  const d = districtVi.trim();
  if (lang === 'zh') {
    if (d === 'Quận 1' || d === 'Q1' || d.includes('Quận 1')) return '第一郡';
    if (d === 'Quận 3' || d === 'Q3' || d.includes('Quận 3')) return '第三郡';
    if (d === 'Quận 4' || d === 'Q4' || d.includes('Quận 4')) return '第四郡';
    if (d === 'Quận 5' || d === 'Q5' || d.includes('Quận 5')) return '第五郡（堤岸）';
    if (d.includes('Bình Thạnh')) return '平盛郡';
    if (d.includes('Tân Bình')) return '新平郡';
    if (d.includes('Củ Chi')) return '古芝县';
    if (d.includes('Cần Giờ')) return '芹耶县';
    if (d.includes('Vũng Tàu')) return '头顿市';
    if (d.includes('Bà Rịa')) return '巴地市';
    if (d.includes('Thủ Dầu Một')) return '土龙木市';
    if (d.includes('Bến Cát')) return '槟吉市';
    return districtVi;
  }
  if (d === 'Quận 1' || d === 'Q1' || d.includes('Quận 1')) return 'District 1';
  if (d === 'Quận 3' || d === 'Q3' || d.includes('Quận 3')) return 'District 3';
  if (d === 'Quận 4' || d === 'Q4' || d.includes('Quận 4')) return 'District 4';
  if (d === 'Quận 5' || d === 'Q5' || d.includes('Quận 5')) return 'District 5';
  if (d.includes('Bình Thạnh')) return 'Binh Thanh District';
  if (d.includes('Tân Bình')) return 'Tan Binh District';
  if (d.includes('Củ Chi')) return 'Cu Chi District';
  if (d.includes('Cần Giờ')) return 'Can Gio District';
  if (d.includes('Vũng Tàu')) return 'Vung Tau City';
  if (d.includes('Bà Rịa')) return 'Ba Ria City';
  if (d.includes('Thủ Dầu Một')) return 'Thu Dau Mot City';
  if (d.includes('Bến Cát')) return 'Ben Cat City';
  return districtVi;
}

/**
 * DỮ LIỆU DỊCH ANH - VIỆT TOÀN DIỆN CHO 12 DI TÍCH TIÊU BIỂU
 * Tên tiếng Anh giữ nguyên tên riêng: ví dụ "Dinh Độc Lập (Independence Palace)"
 * Địa chỉ: Giữ tên đường tiếng Việt kèm "District 1", "District 4", etc.
 */
export const SITE_TRANSLATIONS: Record<string, SiteTranslation> = {
  'HCM-DT-001': {
    officialName: 'Independence Palace (Dinh Độc Lập)',
    folkName: 'Reunification Convention Hall / Former Norodom Palace',
    summary:
      'The Independence Palace is a pinnacle of Vietnamese modernist tropical architecture and a monumental historical landmark where the nation was reunited on April 30, 1975. Designed by Grand Prix de Rome architect Ngo Viet Thu, the palace harmonizes Eastern philosophical geometry with 20th-century structural engineering.',
    chronology: '1868 (Norodom Palace) - 1962 (Reconstruction) - 1966 (Inauguration)',
    architect: 'Arch. Ngo Viet Thu (Grand Prix de Rome 1955)',
    architecturalStyle: 'Modernist Tropical Architecture with Eastern Philosophical Geometry',
    conservationNotes: 'The bamboo-lattice concrete screens and authentic interior reception halls are strictly conserved under national heritage regulations.',
    materials: ['Reinforced concrete', 'Terrazzo granite', 'Vietnamese redwood', 'Acoustic louvered glass'],
    dimensionsDescription: '12-hectare estate, 26m height with 3 main floors, 2 mezzanines, rooftop, and 2 fortified war basements.',
    address: {
      houseNumber: '135',
      street: 'Nam Kỳ Khởi Nghĩa',
      ward: 'Bến Thành Ward',
      district: 'District 1',
      city: 'Ho Chi Minh City',
    },
    openingHours: '08:00 - 16:30 (Open daily, including weekends and public holidays)',
    ticketPrices: '65,000 VND / adult (includes historic chambers and exhibition gallery)',
    regulations: [
      'Formal and respectful attire required',
      'No flammable items or oversized luggage allowed',
      'Follow guided routes and museum curatorial directions',
    ],
    managementUnit: 'Independence Palace Historical Relic Management Board (Administration Department - Government Office)',
    milestones: [
      { year: '1868', event: 'Construction of Norodom Palace commenced under French architect Hermite' },
      { year: '1962', event: 'Reconstruction initiated following Eastern philosophical blueprints by Ngo Viet Thu' },
      { year: '1966', event: 'New palace officially inaugurated with a total usable area of 20,000 m²' },
      { year: '1975', event: 'Tanks 390 and 843 breached the main iron gates, marking the reunification of Vietnam' },
      { year: '2009', event: 'Ranked as a Special National Monument by the Prime Minister of Vietnam' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'Bamboo-Lattice Stone Screen (Chinese Character "Cat")',
        description: 'The second-floor facade features architectural wind louvers resembling slender bamboo nodes that optimize natural daylight and symbolize good fortune.',
      },
      {
        id: 'f2',
        name: 'Tu Phuong Vo Su Pavilion (Tranquility Rooftop)',
        description: 'The tranquil rooftop pavilion designed for diplomatic receptions and offering 360-degree panoramic views across central Saigon.',
      },
      {
        id: 'f3',
        name: 'Semicircular Reflection Fountain',
        description: 'The crescent fountain combined with the expansive oval lawn creates a cooling microclimate and classic Feng Shui water basin.',
      },
    ],
    photoCaptions: [
      'Front facade of the Independence Palace facing Le Duan Boulevard',
      'Presidential Credentials Presentation Hall with traditional gilded lacquer panels',
      'Reinforced underground war bunker and communications headquarters',
    ],
  },
  'HCM-DT-002': {
    officialName: 'Saigon Opera House (Nhà hát Thành phố)',
    folkName: 'Saigon Opera House / Former Lower House of the National Assembly',
    summary:
      'Inaugurated on New Year’s Day in 1900, the Saigon Opera House exemplifies the French Flamboyant Third Republic and Beaux-Arts architectural styles. The facade is inspired by the Petit Palais in Paris with magnificent bas-reliefs, stone angels, and acoustic amphitheater.',
    chronology: '1898 (Groundbreaking) - 1900 (Inauguration) - 1998 (Centennial Restoration)',
    architect: 'Arch. Félix Olivier, Ernest Guichard & Eugène Ferret',
    architecturalStyle: 'French Beaux-Arts & Neo-Classical Opéra Style',
    conservationNotes: 'The facade relief sculptures, Corinthian capital columns, and German acoustic ceilings were fully restored to their original 1900 designs.',
    materials: ['Imported French cast iron', 'Arles limestone', 'Oak woodwork', 'Crystal chandeliers'],
    dimensionsDescription: 'Amphitheater auditorium seating 500 spectators with proscenium stage and multi-level balconies.',
    address: {
      houseNumber: '07',
      street: 'Công trường Lam Sơn',
      ward: 'Bến Nghé Ward',
      district: 'District 1',
      city: 'Ho Chi Minh City',
    },
    openingHours: 'Open during scheduled performing arts concerts and weekend opera evenings',
    ticketPrices: 'From 200,000 to 1,200,000 VND depending on the performing arts program',
    regulations: [
      'Evening formal or smart-casual dress code required',
      'Audience members must be seated 15 minutes before curtain rise',
      'No photography or recording during live theatrical performances',
    ],
    managementUnit: 'Ho Chi Minh City Municipal Symphony Orchestra and Ballet (HBSO)',
    milestones: [
      { year: '1898', event: 'Commencement of construction at the focal terminus of Catinat Street' },
      { year: '1900', event: 'Grand opening with the staging of French grand opera' },
      { year: '1955', event: 'Repurposed as the Lower House of the National Assembly' },
      { year: '1975', event: 'Returned to its original mission as the municipal performing arts theater' },
      { year: '2012', event: 'Ranked as a National Monument of Architectural & Artistic Art' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'Goddess Statues Restored in 1998',
        description: 'Twin sandstone caryatid statues supporting the facade pediment sculpted faithfully according to architect Eugène Ferret’s 1900 masterwork.',
      },
      {
        id: 'f2',
        name: 'Historic French Mansard Roof',
        description: 'Curved slate tile mansard roofing punctuated by dormer attic windows and ornate zinc cresting.',
      },
    ],
    photoCaptions: [
      'Front facade of the Saigon Opera House illuminated at dusk',
      'The classical European theater auditorium with tiered horseshoe seating',
    ],
  },
  'HCM-DT-003': {
    officialName: 'Saigon Central Post Office (Bưu điện Trung tâm Sài Gòn)',
    folkName: 'Ben Nghe Post Office / Municipal Post Office',
    summary:
      'Constructed between 1886 and 1891, the Saigon Central Post Office is an eclectic architectural marvel blending French Neo-Classical facade order with industrial Gustave Eiffel vaulted ironwork and vibrant Moroccan tile mosaics.',
    chronology: '1886 (Construction commenced) - 1891 (Inauguration)',
    architect: 'Arch. Marie-Alfred Foulhoux (Iron vault framework by Gustave Eiffel)',
    architecturalStyle: 'Eclectic Neo-Renaissance with Industrial Eiffel Vaulted Ironwork',
    conservationNotes: 'Historic post office counters, original wooden telephone booths, and hand-painted historic cartography maps are preserved intact.',
    materials: ['Riveted wrought iron', 'Handmade ceramic tiles', 'Limestone', 'Polished brass fittings'],
    dimensionsDescription: 'Main grand nave extending over 80 meters with high barrel-vaulted ceiling.',
    address: {
      houseNumber: '02',
      street: 'Công xã Paris',
      ward: 'Bến Nghé Ward',
      district: 'District 1',
      city: 'Ho Chi Minh City',
    },
    openingHours: '07:30 - 18:00 (Open daily for visitors and postal transactions)',
    ticketPrices: 'Free admission for visitors',
    regulations: [
      'Maintain public order in functioning postal service areas',
      'Do not obstruct active mail and financial transaction counters',
    ],
    managementUnit: 'Vietnam Post Corporation (VNPost) - Ho Chi Minh City Branch',
    milestones: [
      { year: '1886', event: 'Foundation stone laid opposite the Basilica Cathedral' },
      { year: '1891', event: 'Formally inaugurated as the central telecommunications nexus of Indochina' },
      { year: '2014', event: 'Comprehensive restoration of historic yellow ochre facade and vaulted interiors' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'Gustave Eiffel Wrought Iron Vault',
        description: 'Graceful 19th-century structural iron nave spanning the entire 80-meter central hall.',
      },
      {
        id: 'f2',
        name: 'Centennial Facade Clock',
        description: 'The monumental Roman numeral clock positioned prominently above the main entrance portico.',
      },
    ],
    photoCaptions: [
      'Monumental entrance portico and clock of the Saigon Central Post Office',
      'Barrel-vaulted central atrium showing the hand-painted antique maps',
    ],
  },
  'HCM-DT-004': {
    officialName: 'Ben Thanh Market (Chợ Bến Thành)',
    folkName: 'New Saigon Market / Old Cho Lon Market',
    summary:
      'Featuring its iconic four-sided clock tower facing Quach Thi Trang Square, Ben Thanh Market has stood as the bustling civic and mercantile heartbeat of Saigon since 1914. Its unique concrete louvered design ensures cross-ventilation in the tropical climate.',
    chronology: '1912 (Commenced) - 1914 (Grand opening) - 1985 (Renovation)',
    architect: 'Contractor Brossard et Mopin',
    architecturalStyle: 'Colonial Mercantile Architecture with Central Clock Tower',
    conservationNotes: 'The four-sided clock tower and ceramic tile relief murals are conserved under municipal heritage regulations.',
    materials: ['Reinforced concrete', 'Marseille roof tiles', 'Iron roof trusses'],
    dimensionsDescription: 'Over 13,000 square meters housing nearly 1,500 trading stalls and 4 grand entrance gates.',
    address: {
      houseNumber: '01',
      street: 'Đường Lê Lợi',
      ward: 'Bến Thành Ward',
      district: 'District 1',
      city: 'Ho Chi Minh City',
    },
    openingHours: '06:00 - 19:00 (Day market) & 19:00 - 23:00 (Night market perimeter)',
    ticketPrices: 'Free admission',
    regulations: ['Preserve fire safety precautions', 'Polite commercial transactions'],
    managementUnit: 'Ben Thanh Market Management Board - District 1 People’s Committee',
    milestones: [
      { year: '1912', event: 'Relocated from Charner canal to reclaimed Marais Boresse marshland' },
      { year: '1914', event: 'Three-day opening festival celebrating the grand market of Saigon' },
      { year: '2024', event: 'Ranked as a City-level Monument of History & Architecture' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'South Gate Clock Tower (1914)',
        description: 'The iconic four-sided clock tower facing Quach Thi Trang Square, symbol of Saigon commerce.',
      },
      {
        id: 'f2',
        name: 'Tiered Louvered Ventilation Roofs',
        description: 'Tropical vernacular market roofing with overlapping eaves that induce natural airflow.',
      },
    ],
    photoCaptions: [
      'Iconic clock tower of the South Gate at Ben Thanh Market',
      'Bustling historic interior trading aisles under the original metal roof truss',
    ],
  },
  'HCM-DT-005': {
    officialName: 'Saigon Notre-Dame Cathedral Basilica (Nhà thờ Đức Bà Sài Gòn)',
    folkName: 'Cathedral Basilica of Our Lady of the Immaculate Conception',
    summary:
      'Erected between 1877 and 1880 at Paris Square, the cathedral is a Romanesque-Gothic synthesis constructed with unblemished red bricks imported from Toulouse and zinc spires added in 1895. It was elevated to a Minor Basilica by the Holy See in 1959.',
    chronology: '1877 (Foundation) - 1880 (Consecration) - 1895 (Bell spires added)',
    architect: 'Arch. Jules Bourard',
    architecturalStyle: 'Romanesque-Gothic Revival',
    conservationNotes: 'Undergoing a meticulous structural restoration with authentic European replacement tiles and timber.',
    materials: ['Toulouse kiln-fired red clay bricks', 'Belgian stained glass', 'Lorraine bronze bells'],
    dimensionsDescription: '93m length, 35m width, with twin bell towers rising to 60.5 meters.',
    address: {
      houseNumber: '01',
      street: 'Công xã Paris',
      ward: 'Bến Nghé Ward',
      district: 'District 1',
      city: 'Ho Chi Minh City',
    },
    openingHours: 'Currently perimeter exterior viewing due to master conservation work',
    ticketPrices: 'Free admission for parishioners and visitors',
    regulations: ['Keep solemn demeanor around sacred grounds', 'Do not enter active conservation scaffolding zones'],
    managementUnit: 'Archdiocese of Ho Chi Minh City',
    milestones: [
      { year: '1877', event: 'First stone blessed by Bishop Isidore Colombert' },
      { year: '1880', event: 'Solemn consecration on Easter Sunday' },
      { year: '1959', event: 'Elevated to Basilica status by Pope John XXIII' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'Twin Bell Towers (60.5m)',
        description: 'Two soaring zinc-capped spires housing 6 massive French bronze bells cast in 1879.',
      },
      {
        id: 'f2',
        name: 'Gothic Rose Stained-Glass Window',
        description: 'Grand circular rose window creating vibrant theological lighting within the sacred sanctuary.',
      },
    ],
    photoCaptions: [
      'Twin spires of Saigon Notre-Dame Cathedral Basilica viewed from Paris Square',
      'Detail of the mortarless Toulouse red brick masonry intact after 140+ years',
    ],
  },
  'HCM-DT-006': {
    officialName: 'Museum of History of HCMC (Bảo tàng Lịch sử TP.HCM)',
    folkName: 'Musée Blanchard de la Brosse / National Museum of Vietnam',
    summary:
      'Completed in 1929 inside the Saigon Botanic Gardens, this landmark is a prime specimen of Indochinese Architecture (Style Indochinois) by Auguste Delaval, featuring an octagonal Chinese-pagoda tower merged with French masonry ventilation.',
    chronology: '1926 (Commenced) - 1929 (Opened) - 1970 (Rear wing extension)',
    architect: 'Arch. Auguste Delaval',
    architecturalStyle: 'Indochinese Architecture (Style Indochinois)',
    conservationNotes: 'Octagonal Yin-Yang tiled central pavilion and dragon roof ridges are meticulously preserved.',
    materials: ['Yin-yang ceramic tiles', 'Reinforced concrete', 'Teak wood carvings'],
    dimensionsDescription: 'Central octagonal rotunda with expansive surrounding exhibition wings.',
    address: {
      houseNumber: '02',
      street: 'Nguyễn Bỉnh Khiêm',
      ward: 'Bến Nghé Ward',
      district: 'District 1',
      city: 'Ho Chi Minh City',
    },
    openingHours: '08:00 - 11:30 & 13:00 - 17:00 (Tuesday through Sunday)',
    ticketPrices: '30,000 VND / visitor',
    regulations: ['No flash photography in archaeological galleries', 'Do not touch antiquities'],
    managementUnit: 'Department of Culture and Sports of Ho Chi Minh City',
    milestones: [
      { year: '1929', event: 'Inaugurated as the Musée Blanchard de la Brosse' },
      { year: '2012', event: 'Recognized as a National Monument of Architectural & Artistic Art' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'Indochinese Octagonal Rotunda',
        description: 'Octagonal tower blending Asian pagoda aesthetics with French masonry ventilation.',
      },
      {
        id: 'f2',
        name: 'Tiered Glazed Ceramic Roofs',
        description: 'Eaves adorned with blue-glazed ceramic ridge tiles in the classic Indochine movement.',
      },
    ],
    photoCaptions: [
      'Main octagonal entrance pavilion of the Museum of History of Ho Chi Minh City',
      'Antique Oc Eo cultural Buddha sculpture exhibit inside the central rotunda',
    ],
  },
  'HCM-DT-007': {
    officialName: 'Nha Rong Wharf - Ho Chi Minh Museum (Bến Nhà Rồng)',
    folkName: 'Messageries Maritimes Headquarters / Dragon House Wharf',
    summary:
      'Built in 1863 along the Saigon River by the French Messageries Maritimes, this historic riverfront depot is crowned by twin ceramic dragons facing the moon. Here on June 5, 1911, young patriot Nguyen Tat Thanh departed aboard the Amiral Latouche-Tréville on his journey to liberate Vietnam.',
    chronology: '1863 (Construction) - 1911 (Historic departure) - 1979 (Memorial Museum)',
    architect: 'Messageries Maritimes Engineering Team',
    architecturalStyle: 'Colonial Maritime Architecture with Vietnamese Dragon Crown Ridge',
    conservationNotes: 'Riverfront stone quays and rooftop dragon sculptures are maintained in pristine state.',
    materials: ['Brick masonry', 'French roof tiles', 'Glazed ceramic dragons'],
    dimensionsDescription: 'Historic two-story headquarters overlooking the junction of Saigon River and Ben Nghe canal.',
    address: {
      houseNumber: '01',
      street: 'Nguyễn Tất Thành',
      ward: 'Ward 12',
      district: 'District 4',
      city: 'Ho Chi Minh City',
    },
    openingHours: '07:30 - 11:30 & 13:30 - 17:00 (Tuesday to Sunday)',
    ticketPrices: '20,000 VND / visitor',
    regulations: ['Respectful decorum in memorial galleries', 'Follow riverfront safety railings'],
    managementUnit: 'Ho Chi Minh Museum - Ho Chi Minh City Branch',
    milestones: [
      { year: '1863', event: 'Messageries Maritimes depot completed at the mouth of Ben Nghe canal' },
      { year: '1911', event: 'Nguyen Tat Thanh departed on his quest for national liberation on June 5, 1911' },
      { year: '1998', event: 'Ranked as a National Historical Monument' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'Twin Ceramic Dragons on Roof Ridge',
        description: 'Glazed terracotta sculpture of twin dragons facing the moon crowning the historic maritime depot.',
      },
    ],
    photoCaptions: [
      'Nha Rong Wharf viewed from across the confluence of the Saigon River',
      'Historic riverfront stone quay where President Ho Chi Minh departed in 1911',
    ],
  },
  'HCM-DT-008': {
    officialName: 'Tomb of General Le Van Duyet (Lăng Ông Bà Chiểu)',
    folkName: 'Lang Ong Ba Chieu / Duc Thuong Cong Shrine',
    summary:
      'The sacred memorial and mausoleum of Viceroy Le Van Duyet (1764-1832), who pioneered the governance and economic prosperity of southern Gia Dinh. The complex embodies Southern Vietnamese imperial communal temple layout with exceptional porcelain mosaic art.',
    chronology: '1848 (Tomb built) - 1914 (Temple constructed) - 1949 (Main gateway)',
    architect: 'Traditional Southern Guild of Temple Masters',
    architecturalStyle: 'Nguyen Dynasty Southern Court & Mausoleum Architecture',
    conservationNotes: 'Vibrant porcelain mosaic dragons, phoenixes, and lacquered couplets are authentic.',
    materials: ['Precious ironwood', 'Glazed ceramics', 'Laterite stone tomb', 'Gilded lacquer'],
    dimensionsDescription: 'Compound spanning 18,500 square meters comprising Three-Entrance Gate, Stele House, Tomb, and Main Temple.',
    address: {
      houseNumber: '01',
      street: 'Vũ Tùng',
      ward: 'Ward 1',
      district: 'Binh Thanh District',
      city: 'Ho Chi Minh City',
    },
    openingHours: '07:00 - 17:00 (Daily)',
    ticketPrices: 'Free admission for pilgrims and cultural visitors',
    regulations: ['Modest attire required within incense chambers', 'Maintain solemn reverence'],
    managementUnit: 'Management Board of Lang Ong Ba Chieu Monument',
    milestones: [
      { year: '1848', event: 'King Tu Duc rehabilitated General Le Van Duyet and restored the mausoleum' },
      { year: '1989', event: 'Classified as a National Historical & Cultural Monument' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'Nguyen Dynasty Memorial Stone Stele House',
        description: 'Historic stele inscribed with the eulogy by scholar Phan Thanh Gian in 1868.',
      },
      {
        id: 'f2',
        name: 'Southern Porcelain Mosaic Shrine',
        description: 'Exquisite ceramic shard mosaics depicting the Four Mythical Beasts unique to Gia Dinh temple art.',
      },
    ],
    photoCaptions: [
      'Main Triple Gate entrance to the Tomb of General Le Van Duyet',
      'Porcelain mosaic dragon ornamentation on the temple roof ridge',
    ],
  },
  'HCM-DT-009': {
    officialName: 'Cu Chi Tunnels (Địa đạo Củ Chi)',
    folkName: 'Steel Land of Cu Chi / Ben Duoc & Ben Dinh Tunnel Networks',
    summary:
      'A legendary subterranean military wonder spanning more than 250 kilometers of interconnected multi-level tunnels hand-dug in laterite clay on ancient alluvial soil as durable as natural concrete. It sheltered armed forces, civilians, hospital bays, and command centers during national resistance campaigns.',
    chronology: '1946 (Early tunnels) - 1961-1968 (Full system expansion)',
    architect: 'Local guerrillas and engineering combatants of Cu Chi',
    architecturalStyle: 'Subterranean Defense Complex & Military Fortification',
    conservationNotes: 'Original laterite clay tunnel sections, disguised ventilation holes, and booby trap exhibits are conserved and reinforced for safety.',
    materials: ['Laterite clay on ancient alluvial substrate (natural concrete durability)', 'Bamboo supports', 'Camouflaged earth mounds'],
    dimensionsDescription: 'Over 250km of multi-level tunnels with depths ranging from 3m down to 12m below the surface.',
    address: {
      houseNumber: 'Ấp Phú Hiệp',
      street: 'Tỉnh lộ 15',
      ward: 'Phú Mỹ Hưng Commune',
      district: 'Cu Chi District',
      city: 'Ho Chi Minh City',
    },
    openingHours: '07:00 - 17:00 (Daily)',
    ticketPrices: '70,000 - 125,000 VND / visitor (includes military forest docent guide)',
    regulations: ['Visitors with respiratory or heart conditions should remain on surface trails', 'Follow certified guides strictly'],
    managementUnit: 'Cu Chi Tunnels Historical Relic Site Management',
    milestones: [
      { year: '1946', event: 'Initial secret underground shelters dug during the anti-colonial resistance' },
      { year: '1968', event: 'Crucial logistical springboard during the Tet Offensive' },
      { year: '2015', event: 'Ranked as a Special National Monument by the Prime Minister' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'Camouflaged Secret Trapdoor Entry',
        description: 'Wooden trapdoor hidden under dry leaves sized exactly for a single fighter, bearing heavy vehicle weight above.',
      },
      {
        id: 'f2',
        name: 'Termite Mound Air Ventilation Flues',
        description: 'Subtly disguised termite mounds channeling fresh airflow into the 3-level deep tunnels.',
      },
    ],
    photoCaptions: [
      'Camouflaged secret entrance to the Cu Chi Tunnels under forest foliage',
      'Underground meeting room and medical station conserved in original state',
    ],
  },
  'HCM-DT-010': {
    officialName: 'Giong Ca Vo Archaeological Site (Di chỉ Giồng Cá Vồ)',
    folkName: 'Can Gio Jar Burial Necropolis / Proto-Oc Eo Maritime Port',
    summary:
      'Situated within the Can Gio Mangrove Biosphere Reserve, Giong Ca Vo is an internationally acclaimed 2,000-year-old archaeological jar burial necropolis of the prehistoric Sa Huynh - Proto-Oc Eo maritime trading culture.',
    chronology: '500 BCE - 100 CE (Late Iron Age / Pre-Funan era)',
    architect: 'Prehistoric Coastal Inhabitants of Southern Vietnam',
    architecturalStyle: 'Prehistoric Jar Burial Necropolis & Maritime Habitation Site',
    conservationNotes: 'Stratigraphic excavation pits and intact burial jars with human remains are protected under geo-archaeological shelters.',
    materials: ['Terracotta pottery jars', 'Jade double-headed animal ornaments', 'Carnelian beads', 'Bronze blades'],
    dimensionsDescription: 'Excavation area encompassing over 5,000 square meters on a red sand ridge in the mangrove forest.',
    address: {
      houseNumber: 'Ấp Đông Hòa',
      street: 'Đường Rừng Sác',
      ward: 'Long Hòa Commune',
      district: 'Can Gio District',
      city: 'Ho Chi Minh City',
    },
    openingHours: '08:00 - 16:30 (Scheduled archaeological field tours)',
    ticketPrices: 'Included in Can Gio Ecotourism and Heritage Pass',
    regulations: ['Do not step into excavated stratigraphic trenches', 'No metal detection equipment allowed'],
    managementUnit: 'Center for Archaeological Studies (HCMC Institute of Social Sciences) & Can Gio District People’s Committee',
    milestones: [
      { year: '1993', event: 'First scientific excavation uncovering hundreds of intact burial urns' },
      { year: '2024', event: 'Officially declared a National Monument of Archaeological Science' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'Can Gio Jar Burial Stratigraphy Trench',
        description: 'Concentration of hundreds of ancient earthenware burial jars dating back more than 2,000 years.',
      },
    ],
    photoCaptions: [
      'Archaeological field pit showing in-situ burial urns at Giong Ca Vo',
      'Rare jade double-headed beast earrings discovered within the burial jars',
    ],
  },
  'HCM-DT-011': {
    officialName: 'Giac Lam Pagoda (Chùa Giác Lâm)',
    folkName: 'Cam Son Patriarchal Monastery / Son Can Pagoda',
    summary:
      'Founded in 1744 by Buddhist layman Ly Thuy Long, Giac Lam is one of the earliest patriarchal temples in Saigon. It preserves 113 antique jackfruit wood statues gilded in pure gold, 98 carved pillars, and an outstanding seven-story Xa Loi stupa.',
    chronology: '1744 (Founded) - 1798 (Major expansion) - 1900 (Restoration)',
    architect: 'Venerable Zen Masters of the Lam Te (Linji) Dhyana Tradition',
    architecturalStyle: 'Traditional Southern "Tam" Character Buddhist Monastery',
    conservationNotes: 'Ancient gilded jackfruit wood statues and porcelain bowl stupa mosaics are kept in original devotional condition.',
    materials: ['Aged jackfruit wood', 'Limestone', 'Yin-yang clay tiles', 'Gold leaf lacquer'],
    dimensionsDescription: 'Triple-hall monastic layout with 98 antique ironwood pillars.',
    address: {
      houseNumber: '565',
      street: 'Lạc Long Quân',
      ward: 'Ward 10',
      district: 'Tan Binh District',
      city: 'Ho Chi Minh City',
    },
    openingHours: '06:00 - 12:00 & 13:30 - 20:00 (Daily)',
    ticketPrices: 'Free admission for devotees and cultural visitors',
    regulations: ['Silent prayer respect in main dharma hall', 'Remove shoes where designated'],
    managementUnit: 'Executive Board of Vietnam Buddhist Sangha - Tan Binh District',
    milestones: [
      { year: '1744', event: 'Pagoda established on Cam Son hill' },
      { year: '1988', event: 'Ranked as a National Monument of Architectural & Artistic Art' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'Seven-Story Xa Loi Relic Stupa (1993)',
        description: 'Hexagonal stupa rising 32 meters enshrining Buddha relics amidst ancient shady trees.',
      },
      {
        id: 'f2',
        name: 'Ancient Wooden Hall with 98 Pillars (1744)',
        description: 'Magnificent hall supported by 98 ironwood pillars preserving 18th-century gilded Buddhist statuary.',
      },
    ],
    photoCaptions: [
      'Seven-story Xa Loi stupa towering over Giac Lam Pagoda grounds',
      'The sacred Dharma Hall with 113 antique gilded jackfruit wood statues',
    ],
  },
  'HCM-DT-012': {
    officialName: 'Nghia An Assembly Hall (Chùa Ông - Miếu Nghĩa An)',
    folkName: 'Teochew Assembly Hall / Cho Lon Quan De Temple',
    summary:
      'Erected by the Chaozhou (Teochew) Chinese immigrant community in Cho Lon during the early 19th century, Nghia An Assembly Hall venerates Lord Guan Yu. It is renowned for its splendid gilded wood carvings, ceramic roof tableaus by the Buu Nguyen kiln, and colossal red wooden door guardians.',
    chronology: 'Circa 1820 (Established) - 1902 (Reconstructed) - 2010 (Conservation)',
    architect: 'Master Teochew Artisans of Wood and Ceramic Sculptures',
    architecturalStyle: 'Chaozhou Traditional Guild Hall & Quadrangle Courtyard Temple',
    conservationNotes: 'Gilded wood reliefs portraying the Romance of the Three Kingdoms are conserved under national status.',
    materials: ['Lacquer-gilded ironwood', 'Glazed Cay Mai ceramics', 'Fujian granite columns'],
    dimensionsDescription: 'Quadrangle courtyard sanctuary surrounded by ceremonial verandas and ancestor halls.',
    address: {
      houseNumber: '678',
      street: 'Nguyễn Trãi',
      ward: 'Ward 11',
      district: 'District 5',
      city: 'Ho Chi Minh City',
    },
    openingHours: '07:00 - 17:30 (Daily)',
    ticketPrices: 'Free admission',
    regulations: ['Respect religious worshippers', 'Do not touch gilded statues or altars'],
    managementUnit: 'Management Committee of Nghia An Chaozhou Assembly Hall',
    milestones: [
      { year: '1820', event: 'Established as the communal center for Teochew merchants in Cho Lon' },
      { year: '1993', event: 'Ranked as a National Monument of Architectural & Artistic Art' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'Cay Mai Ceramic Roof Reliefs',
        description: 'Hundreds of polychrome glazed ceramic figurines on the roof ridge depicting Cantonese classical theater scenes.',
      },
      {
        id: 'f2',
        name: 'Gilded Teochew Woodcarving Screens',
        description: 'Exquisite woodwork carved by Chaozhou masters with heavy gold leafing depicting heroic historical sagas.',
      },
    ],
    photoCaptions: [
      'Main courtyard and decorated facade of Nghia An Chaozhou Assembly Hall',
      'Intricate gilded wood carvings and lanterns within the incense sanctuary',
    ],
  },
  'BRVT-DT-001': {
    officialName: 'White Palace Vung Tau - Villa Blanche (Bạch Dinh)',
    folkName: 'Villa Blanche / Governor-General Summer Palace',
    summary:
      'Constructed between 1898 and 1902 on the seaward slope of Big Mountain (Núi Lớn) at 27.7m elevation, Villa Blanche is a Neo-Classical French summer residence adorned with Greek busts and porcelain mosaics.',
    chronology: '1898 - 1902 (French Colonial Era)',
    architect: 'French Colonial Public Works Architects',
    architecturalStyle: 'French 19th-Century Neo-Classical Architecture',
    conservationNotes: 'Original ceramic mosaic portraits and Hon Cau underwater porcelain treasures are preserved.',
    materials: ['Brick masonry', 'Marseille tiles', 'Glazed European ceramic mosaics', 'Teak louvers'],
    dimensionsDescription: '28m length, 15m width, 19m height across 3 floors overlooking Front Beach.',
    address: {
      houseNumber: '04',
      street: 'Trần Phú',
      ward: 'Ward 1',
      district: 'Vung Tau City',
      city: 'Ba Ria - Vung Tau',
    },
    openingHours: '07:00 - 17:00 (Daily)',
    ticketPrices: '15,000 VND / visitor',
    regulations: ['Preserve frangipani forest landscape', 'Do not touch antique ceramic artifacts'],
    managementUnit: 'Ba Ria - Vung Tau Provincial Museum',
    milestones: [
      { year: '1898', event: 'Governor-General Paul Doumer initiated construction on Big Mountain' },
      { year: '1907', event: 'Place of patriotic confinement of Emperor Thanh Thai' },
      { year: '1992', event: 'Recognized as a National Historical & Cultural Monument' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'Neo-Classical Arched Facade & Marseille Tile Roof',
        description: 'Three-story ivory residence featuring French semicircular arcades, stone balustrades, and red Marseille roof tiles.',
      },
      {
        id: 'f2',
        name: 'Battery of 19 Coastal Cannons Facing the Sea',
        description: 'Array of 19 historic cannons along the front stone terrace overlooking Vung Tau Front Beach.',
      },
      {
        id: 'f3',
        name: '8 Greco-Roman Bust Medallions on the Cornice',
        description: 'Series of 8 circular niches housing polychrome glazed European ceramic busts along the upper cornice.',
      },
      {
        id: 'f4',
        name: 'Hon Cau Shipwreck Kangxi Porcelain Gallery',
        description: 'Third-floor gallery displaying blue-and-white Kangxi porcelain salvaged from the ancient Hon Cau shipwreck.',
      },
      {
        id: 'f5',
        name: 'Antique Spiral Wooden Staircase & Frangipani Grove',
        description: 'Second-floor spiral hardwood staircase surrounded by century-old blooming white frangipani trees on Big Mountain.',
      },
    ],
  },
  'BRVT-DT-002': {
    officialName: 'Long Son Big House (Nhà Lớn Long Sơn)',
    folkName: 'Temple of Master Le (Đền Ông Trần)',
    summary:
      'Built from 1910 to 1929 by Master Le Van Muu (Ông Trần), the Long Son Big House is an extraordinary 2-hectare vernacular wood architectural complex combining sanctuaries, communal schools, markets, and rice granaries.',
    chronology: '1910 - 1929',
    architect: 'Master Le Van Muu (Ông Trần) & local disciples',
    architecturalStyle: 'Southern Vernacular Mortise-and-Tenon Wood Architecture',
    conservationNotes: 'Traditional rituals, communal wooden houses, and antique cabinets are kept intact by residents.',
    materials: ['Ironwood', 'Yin-yang terracotta tiles', 'Mother-of-pearl inlay'],
    dimensionsDescription: '2-hectare complex divided into Worship, Communal Living, and Mausoleum zones.',
    address: {
      houseNumber: 'Thôn 5',
      street: 'Đường vào Nhà Lớn',
      ward: 'Long Sơn Commune',
      district: 'Vung Tau City',
      city: 'Ba Ria - Vung Tau',
    },
    openingHours: '06:00 - 17:00 (Daily)',
    ticketPrices: 'Free admission',
    regulations: ['Modest attire required', 'Respect traditional Ông Trần community customs'],
    managementUnit: 'Long Son Big House Conservation Board',
    milestones: [
      { year: '1910', event: 'Master Le Van Muu reclaimed Long Son island and erected the complex' },
      { year: '1991', event: 'Ranked as a National Architectural & Historical Monument' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'Main Sanctuary (Triple-Hall Holy House)',
        description: 'Three-tier interconnected hardwood sanctuary with ironwood panel doors, mother-of-pearl inlaid altars, and gilded parallel couplets.',
      },
      {
        id: 'f2',
        name: 'Twin Pavilions & Communal Long Houses',
        description: 'Two-story Celestial & Forbidden Pavilions linked via yin-yang tiled timber corridors to the communal guest halls.',
      },
      {
        id: 'f3',
        name: 'Stone Courtyard, Incense Cauldron & Rainwater Jars',
        description: 'Nui Nua bluestone courtyard centered around the carved stone incense burner and rows of traditional terracotta rainwater jars.',
      },
      {
        id: 'f4',
        name: 'Rear Sanctuary & Communal Hearth Kitchen',
        description: 'Traditional brick hearth kitchen with giant bronze cauldrons serving free communal meals at the foot of Nui Nua.',
      },
      {
        id: 'f5',
        name: 'Ghe Sam Boat Pavilion (1900 Founding Relic)',
        description: 'Preserved original wooden sailing barge used by Master Le Van Muu during the 1900 land reclamation of Long Son Island.',
      },
      {
        id: 'f6',
        name: 'Unlocked Stone Pillar Gateway',
        description: 'Open stone gateway without locks symbolizing the community philosophy of round-the-clock hospitality for all travelers.',
      },
    ],
  },
  'BRVT-DT-003': {
    officialName: 'Long Phuoc Tunnels (Địa đạo Long Phước)',
    folkName: 'Eastern Shield of Ba Ria Revolutionary Base',
    summary:
      'Constructed starting in 1948 and expanded in 1963, the Long Phuoc Tunnels feature a "backbone" subterranean spine connecting 5 hamlets with fortified fighting bunkers, medical bays, and food caches.',
    chronology: '1948 - 1975',
    architect: 'Armed Forces & People of Long Phuoc Commune',
    architecturalStyle: 'Subterranean Military Defense Network',
    conservationNotes: 'Restored main tunnel corridors, communications trenches, and memorial hall.',
    materials: ['Laterite clay soil', 'Bamboo reinforcement'],
    dimensionsDescription: 'Backbone tunnel 1.6m-1.8m high, 0.7m-0.8m wide, 3m-6m underground.',
    address: {
      houseNumber: 'Ấp Bắc',
      street: 'Hương lộ 2',
      ward: 'Long Phước Commune',
      district: 'Ba Ria City',
      city: 'Ba Ria - Vung Tau',
    },
    openingHours: '07:30 - 17:00 (Daily)',
    ticketPrices: 'Free admission',
    regulations: ['Follow tunnel safety guides', 'Maintain solemnity in the memorial zone'],
    managementUnit: 'Ba Ria City Monument Management Board',
    milestones: [
      { year: '1948', event: 'First secret underground shelters excavated by Long Phuoc residents' },
      { year: '1990', event: 'Ranked as a National Historical Monument' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'Two-Level Winding Subterranean Tunnel Spine',
        description: 'Longitudinal cutaway of the two-level tunnel spine dug 3m–6m deep into firm Ba Ria red basalt clay.',
      },
      {
        id: 'f2',
        name: 'A-Frame Timber-Reinforced Bomb Shelter',
        description: 'Heavy-duty A-frame timber bracing protecting underground fighters against heavy artillery bombardment.',
      },
      {
        id: 'f3',
        name: 'Underground Command Cell & Oil Lamp Chamber',
        description: 'Subterranean command chamber connected directly to the main backbone tunnel via a vertical shaft.',
      },
      {
        id: 'f4',
        name: 'Field Medical Bunker (Side Cutaway)',
        description: 'Deep-level emergency medical bay equipped with bamboo beds and surgical supply cabinets.',
      },
      {
        id: 'f5',
        name: 'Bamboo Groves, Termite Mounds & Secret Trapdoors',
        description: 'Surface bamboo thickets and termite mounds camouflaging secret tunnel hatches and firing positions.',
      },
    ],
  },
  'BD-DT-001': {
    officialName: 'Tran Cong Vang Ancient House (Nhà cổ Trần Công Vàng)',
    folkName: 'Phu Cuong WoodCarving Masterpiece House',
    summary:
      'Built from 1889 to 1892 in Phu Cuong, Thu Dau Mot, this 5-bay "Đinh"-shaped residence is a masterpiece of Southern Vietnamese carpentry with 48 precious wood columns and exquisite Thu Dau Mot gilded reliefs.',
    chronology: '1889 - 1892',
    architect: 'Thu Dau Mot Master Woodcarving Guild',
    architecturalStyle: 'Traditional Southern 5-Bay "Đinh" Wooden House',
    conservationNotes: 'All 48 ironwood pillars and Four-Season woodcarving panels remain intact after 130+ years.',
    materials: ['Cẩm lai, Gõ đỏ, Lim wood', 'Yin-yang roof tiles', 'Hexagonal floor bricks'],
    dimensionsDescription: 'over 1,300m² grounds with 5 main bays and 2 side wings.',
    address: {
      houseNumber: '18',
      street: 'Bạch Đằng',
      ward: 'Phú Cường Ward',
      district: 'Thu Dau Mot City',
      city: 'Binh Duong',
    },
    openingHours: '08:00 - 17:00 (Daily)',
    ticketPrices: '20,000 VND / visitor',
    regulations: ['Request permission before touching antique furniture', 'Maintain quiet in the ancestral hall'],
    managementUnit: 'Tran Family Heritage Caretakers & Binh Duong Museum',
    milestones: [
      { year: '1892', event: 'Completion after 3 years of carving by master artisans' },
      { year: '1993', event: 'Ranked as a National Architectural & Artistic Monument' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '5-Bay 2-Wing "Đinh"-Shaped Timber Architecture',
        description: 'Panoramic view of the antique wooden residence by the Saigon River with yin-yang roof tiles and bluestone foundation.',
      },
      {
        id: 'f2',
        name: '36 Ironwood Pillars & Lotus Stone Bases',
        description: 'Polished round ironwood columns resting on lotus-carved bluestone plinths supporting the mortise-and-tenon truss.',
      },
      {
        id: 'f3',
        name: 'Gilded Openwork Archway of the Four Sacred Beasts',
        description: 'Exquisite gilded openwork woodcarvings depicting Dragon, Qilin, Turtle, and Phoenix by Thu Dau Mot master carvers.',
      },
      {
        id: 'f4',
        name: 'Ancestral Altar & Mother-of-Pearl Inlaid Screen',
        description: 'Iridescent mother-of-pearl inlaid wooden screen and ancestral cabinets in the solemn central bay.',
      },
      {
        id: 'f5',
        name: 'Reception Divans & Antique Bonsai Courtyard',
        description: 'Inlaid hardwood reception divans opening onto the terracotta-tiled courtyard and ornamental bonsai garden.',
      },
    ],
  },
  'BD-DT-002': {
    officialName: 'Iron Triangle Tunnels - Tay Nam Ben Cat (Địa đạo Tam Giác Sắt)',
    folkName: 'Southwest Ben Cat Underground Fortress (An Điền - An Tây - Phú An)',
    summary:
      'Connecting the three strategic communes of An Dien, An Tay, and Phu An along the Saigon River, this 100km+ multi-level subterranean network served as the northern gateway shield of Saigon - Gia Dinh.',
    chronology: '1948 - 1975',
    architect: 'Armed Forces & People of Ben Cat - Binh Duong',
    architecturalStyle: '3-Level Subterranean Military Fortress',
    conservationNotes: '23-hectare memorial park with reconstructed tunnel sections and riverside monument.',
    materials: ['Laterite clay', 'Reinforced concrete memorial'],
    dimensionsDescription: 'Over 100km of 3-level tunnels linking directly to Cu Chi across the Saigon River.',
    address: {
      houseNumber: 'Ấp Phú Thuận',
      street: 'ĐT 744',
      ward: 'Phú An Ward',
      district: 'Ben Cat City',
      city: 'Binh Duong',
    },
    openingHours: '07:30 - 17:00 (Daily)',
    ticketPrices: 'Free admission',
    regulations: ['Follow safety rules in underground tunnel exhibits'],
    managementUnit: 'Ben Cat City Historical Monument Management Board',
    milestones: [
      { year: '1948', event: 'Commencement of the 3-commune subterranean tunnel network' },
      { year: '1996', event: 'Ranked as a National Historical Monument' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: 'Saigon River Red Belt & Ben Cat Rubber Forest',
        description: 'Cutaway diorama of the Iron Triangle Tunnels facing the winding Saigon River and Ben Cat rubber plantations.',
      },
      {
        id: 'f2',
        name: 'Underground Command Bunker & 3D Tactical Table',
        description: 'Level-1 command bunker with tactical sand table and radio station used to repel Operation Cedar Falls.',
      },
      {
        id: 'f3',
        name: 'Southwest Ben Cat Subterranean Armory',
        description: 'Underground ordnance and rifle cache concealed deep beneath the laterite clay stratum.',
      },
      {
        id: 'f4',
        name: 'Hoang Cam Smokeless Stove & Subsurface Flues',
        description: 'Underground cooking system diffusing smoke through winding earth channels to evade aerial reconnaissance.',
      },
      {
        id: 'f5',
        name: 'Riverside Escape Hatch & Communications Trench',
        description: 'Deep tunnel branch opening directly onto the Saigon River boat landing, linking across to the Cu Chi Tunnels.',
      },
    ],
  },
};

/**
 * DỮ LIỆU DỊCH TIẾNG TRUNG (ZH) TOÀN DIỆN CHO 17 DI TÍCH LIÊN VÙNG
 */
export const SITE_TRANSLATIONS_ZH: Record<string, SiteTranslation> = {
  'HCM-DT-001': {
    officialName: '独立宫（统一会堂 / Dinh Độc Lập）',
    folkName: '统一宫 / 原诺罗敦宫',
    summary:
      '独立宫是越南现代主义热带建筑的巅峰之作，也是1975年4月30日南方解放、国家统一的重要历史见证。由罗马大奖得主建筑师吴曰树（Ngô Viết Thụ）设计，完美融合了东方哲学风水几何与20世纪现代工程结构。',
    chronology: '1868年（诺罗敦宫）- 1962年（重建）- 1966年（落成）',
    architect: '建筑师 吴曰树（1955年罗马大奖得主）',
    architecturalStyle: '现代主义热带建筑与东方哲学几何美学',
    conservationNotes: '二楼外立面“吉”字形竹节遮阳花格窗与历代外交内阁厅室均按特别国家级遗迹标准严格原状保存。',
    materials: ['钢筋混凝土', '水磨石花岗岩', '越南珍贵红木', '隔音百叶玻璃'],
    dimensionsDescription: '占地12公顷，主楼高26米，共3层主楼、2层夹层、顶层四方无事楼及2层地下抗炸指挥掩体。',
    address: {
      houseNumber: '135',
      street: 'Nam Kỳ Khởi Nghĩa',
      ward: '槟城坊',
      district: '第一郡',
      city: '胡志明市',
    },
    openingHours: '08:00 - 16:30（每日开放，含周末及节假日）',
    ticketPrices: '65,000 越南盾 / 成人（含历史主楼与专题展览馆）',
    regulations: ['请着装得体庄重', '严禁携带易燃易爆物品或超大行李', '请遵循导览路线与工作人员指引'],
    managementUnit: '独立宫历史遗迹管理处（政府办公厅行政管理局）',
    milestones: [
      { year: '1868', event: '法国建筑师 Hermite 主持兴建诺罗敦宫（Palais Norodom）' },
      { year: '1962', event: '依据建筑师吴曰树的东方哲学图景方案启动重建' },
      { year: '1966', event: '新独立宫正式落成，总使用面积达 20,000 平方米' },
      { year: '1975', event: '4月30日，390号与843号坦克冲入正门，标志着越南南北统一' },
      { year: '2009', event: '获越南政府总理批准确认为首批特别国家级历史遗迹' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '“吉”字竹节遮阳石花窗',
        description: '二楼外立面采用仿东方竹节造型的混凝土遮阳格栅，既优化热带自然采光通风，又寓意吉祥昌盛。',
      },
      {
        id: 'f2',
        name: '四方无事楼（顶层观景阁）',
        description: '顶层静谧轩敞的传统意境亭阁，可360度俯瞰黎笋林荫大道与西贡市中心全景。',
      },
      {
        id: 'f3',
        name: '半月形风水明堂喷泉',
        description: '半圆形喷泉池与椭圆形大草坪构成传统风水“明堂聚水”格局，调节建筑微气候。',
      },
    ],
    photoCaptions: [
      '面向黎笋大道的独立宫正立面全景',
      '饰有传统金漆画屏的国书递交大厅',
      '坚固的地下作战指挥中心与电讯室',
    ],
  },
  'HCM-DT-002': {
    officialName: '胡志明市大剧院（西贡歌剧院 / Nhà hát Thành phố）',
    folkName: '西贡大剧院 / 原下议院大厦',
    summary:
      '于1900年元旦正式揭幕，胡志明市大剧院是法兰西第三共和国华丽学院派（Beaux-Arts）建筑典范。正立面灵感源自巴黎小皇宫（Petit Palais），拥有精美绝伦的女神浮雕、石雕天使与欧洲古典马蹄形声学剧场。',
    chronology: '1898年（动工）- 1900年（落成）- 1998年（百年复原大修）',
    architect: '建筑师 Félix Olivier、Ernest Guichard 与 Eugène Ferret',
    architecturalStyle: '法国学院派（Beaux-Arts）与新古典主义歌剧院风格',
    conservationNotes: '外立面石雕浮雕、科林斯柱式及欧洲声学穹顶均于1998年按1900年原始图纸原貌复原。',
    materials: ['法国进口铸铁构件', '阿尔勒石灰石', '橡木装饰', '水晶吊灯'],
    dimensionsDescription: '马蹄形多层包厢观众厅，可容纳500名观众。',
    address: {
      houseNumber: '07',
      street: 'Công trường Lam Sơn',
      ward: '𤅶牺牲坊',
      district: '第一郡',
      city: '胡志明市',
    },
    openingHours: '按交响乐、芭蕾及艺术演出场次开放',
    ticketPrices: '200,000 - 1,200,000 越南盾（视演出剧目而定）',
    regulations: ['请着正装或得体休闲装入场', '请于演出前15分钟入座', '演出期间严禁拍照或录音录像'],
    managementUnit: '胡志明市交响乐、歌舞与芭蕾舞剧院 (HBSO)',
    milestones: [
      { year: '1898', event: '在卡蒂纳街（今同起街）核心景观节点破土动工' },
      { year: '1900', event: '盛大揭幕并首演法国古典歌剧' },
      { year: '1955', event: '曾一度改作下议院议事厅' },
      { year: '1975', event: '恢复市级表演艺术歌剧院功能' },
      { year: '2012', event: '被评定为国家级建筑艺术遗迹' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '1998年复原的艺术女神石像',
        description: '大门口两侧托起拱券的艺术女神雕像，严格依照建筑师 Eugène Ferret 1900年原稿复刻。',
      },
      {
        id: 'f2',
        name: '法式孟莎式石板穹顶',
        description: '曲线优美的天然石板瓦孟莎屋顶，配以老虎窗与精致锌制顶饰。',
      },
    ],
  },
  'HCM-DT-003': {
    officialName: '西贡中央邮局（Bưu điện Trung tâm Sài Gòn）',
    folkName: '𤅶牺牲邮局 / 市中心邮政总局',
    summary:
      '建于1886年至1891年间，西贡中央邮局是一座折衷主义建筑杰作，巧妙融合了法式新古典主义立面秩序、古斯塔夫·埃菲尔（Gustave Eiffel）设计的工业钢铁拱顶结构以及摩洛哥风格拼花地砖。',
    chronology: '1886年（动工）- 1891年（落成）',
    architect: '建筑师 Marie-Alfred Foulhoux（钢铁拱顶由 Gustave Eiffel 设计）',
    architecturalStyle: '新文艺复兴折衷主义与埃菲尔工业铁艺拱顶',
    conservationNotes: '百年邮政柜台、古典木制电话亭及穹顶两侧1892年手绘历史古地图均完好保存。',
    materials: ['铆接锻铁钢架', '手工花砖', '石灰岩', '抛光黄铜构件'],
    dimensionsDescription: '中央邮政大厅纵深逾80米，覆以高耸的绿色钢肋拱形穹顶。',
    address: {
      houseNumber: '02',
      street: 'Công xã Paris',
      ward: '𤅶牺牲坊',
      district: '第一郡',
      city: '胡志明市',
    },
    openingHours: '07:30 - 18:00（每日开放参观及办理邮政业务）',
    ticketPrices: '免费参观',
    regulations: ['请在邮政业务办理区域保持安静与秩序', '请勿阻碍正在运营的邮政服务窗口'],
    managementUnit: '越南邮政总公司 (VNPost) - 胡志明市邮政局',
    milestones: [
      { year: '1886', event: '在巴黎公社广场大教堂斜对面奠基动工' },
      { year: '1891', event: '正式落成，成为印度支那核心电讯与邮政枢纽' },
      { year: '2014', event: '全面修缮历史黄赭色外立面与室内钢拱大厅' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '古斯塔夫·埃菲尔锻铁拱顶',
        description: '横跨80米中央大厅的19世纪优雅绿色弧形钢铁桁架结构。',
      },
      {
        id: 'f2',
        name: '正门百年罗马数字大钟',
        description: '镶嵌于正门山花中央的百年大钟，见证西贡跨越三个世纪的时光流转。',
      },
    ],
  },
  'HCM-DT-004': {
    officialName: '槟城市场（Chợ Bến Thành）',
    folkName: '西贡新市场',
    summary:
      '以面向郭氏庄广场的标志性四面钟楼闻名，槟城市场自1914年以来一直是西贡最具活力的商业与市民生活心脏。其独特的多层百叶通风屋顶专为热带气候跨风散热而设计。',
    chronology: '1912年（动工）- 1914年（开业）- 1985年（修缮）',
    architect: 'Brossard et Mopin 建筑工程公司',
    architecturalStyle: '殖民时期热带商业大厅建筑与四面钟楼',
    conservationNotes: '南门四面钟楼及四大主入口的边和陶瓷浮雕壁画均受市级遗迹保护。',
    materials: ['钢筋混凝土', '马赛红瓦', '钢屋架'],
    dimensionsDescription: '占地逾13,000平方米，设4座主城门与近1,500个商铺摊位。',
    address: {
      houseNumber: '01',
      street: 'Đường Lê Lợi',
      ward: '槟城坊',
      district: '第一郡',
      city: '胡志明市',
    },
    openingHours: '06:00 - 19:00（日间市场）& 19:00 - 23:00（外围夜市）',
    ticketPrices: '免费入场',
    regulations: ['注意消防安全', '文明购物与游览'],
    managementUnit: '槟城市场管理委员会（第一郡人民委员会）',
    milestones: [
      { year: '1912', event: '由旧市场迁址至填平的 Boresse 沼泽地动工兴建' },
      { year: '1914', event: '举办为期三天的盛大开市庆典（ Tân Vương Hội ）' },
      { year: '2024', event: '被认定为胡志明市级历史与建筑艺术遗迹' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '南门四面钟楼 (1914)',
        description: '面向郭氏庄广场的标志性三拱门四面钟楼，西贡百年商贸象征。',
      },
      {
        id: 'f2',
        name: '双层百叶通风屋顶',
        description: '适应热带气候的叠层百叶屋面结构，促进室内自然空气对流。',
      },
    ],
  },
  'HCM-DT-005': {
    officialName: '西贡圣母大教堂（红教堂 / Nhà thờ Đức Bà Sài Gòn）',
    folkName: '圣母无原罪主教座堂 / 王公圣母大教堂',
    summary:
      '建于1877年至1880年间的巴黎公社广场，融合罗马式与哥特式复兴风格，全部采用法国图卢兹（Toulouse）进口裸露红砖砌筑，1895年增建两座高耸的锌制钟楼尖顶，1959年获梵蒂冈晋升为宗座圣殿。',
    chronology: '1877年（奠基）- 1880年（祝圣）- 1895年（增建尖顶）',
    architect: '建筑师 Jules Bourard',
    architecturalStyle: '罗马式与哥特式复兴建筑',
    conservationNotes: '目前正使用欧洲原产替换砖瓦与木材进行全面结构保护性修缮。',
    materials: ['法国图卢兹红砖', '比利时彩绘玻璃', '洛林青铜大钟'],
    dimensionsDescription: '全长93米，宽35米，双子钟楼尖顶高达60.5米。',
    address: {
      houseNumber: '01',
      street: 'Công xã Paris',
      ward: '𤅶牺牲坊',
      district: '第一郡',
      city: '胡志明市',
    },
    openingHours: '修缮期间开放外围广场瞻仰与定时弥撒',
    ticketPrices: '免费参观',
    regulations: ['请在宗教圣地保持庄重肃穆', '请勿进入修缮施工脚手架围挡区域'],
    managementUnit: '天主教胡志明市总教区',
    milestones: [
      { year: '1877', event: 'Colombert 主教主持奠基仪式' },
      { year: '1880', event: '复活节主日隆重举行落成祝圣典礼' },
      { year: '1959', event: '教宗若望二十三世赐封为次级宗座圣殿（Basilica）' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '双子钟楼尖顶 (60.5米)',
        description: '两座高耸入云的钢骨锌板尖塔，内悬1879年法国铸造的6口巨型青铜钟。',
      },
      {
        id: 'f2',
        name: '哥特式玫瑰花窗',
        description: '正立面中央的大型圆形彩绘玫瑰花窗，为圣殿内部营造神圣光影。',
      },
    ],
  },
  'HCM-DT-006': {
    officialName: '胡志明市历史博物馆（Bảo tàng Lịch sử TP.HCM）',
    folkName: '原布朗夏尔·德·拉·布罗斯博物馆 / 越南国家博物馆',
    summary:
      '1929年落成于西贡动植物园内，由建筑师 Auguste Delaval 设计，是印度支那风格（Style Indochinois）建筑的代表作。中央耸立八角形重檐攒尖宝塔，巧妙融合东方宫殿语汇与法式热带通风空间。',
    chronology: '1926年（动工）- 1929年（开馆）- 1970年（增建后翼）',
    architect: '建筑师 Auguste Delaval',
    architecturalStyle: '印度支那建筑风格（Indochine Architecture）',
    conservationNotes: '八角攒尖琉璃瓦中央塔楼、盘龙脊饰及户外阮朝古火炮展区均完好保存。',
    materials: ['阴阳琉璃筒瓦', '钢筋混凝土', '柚木雕花门窗'],
    dimensionsDescription: '中央八角形大厅配两侧对称展翼，后部连接1970年由吴曰树设计的U形扩展展馆。',
    address: {
      houseNumber: '02',
      street: 'Nguyễn Bỉnh Khiêm',
      ward: '𤅶牺牲坊',
      district: '第一郡',
      city: '胡志明市',
    },
    openingHours: '08:00 - 11:30 & 13:00 - 17:00（周二至周日开放）',
    ticketPrices: '30,000 越南盾 / 人',
    regulations: ['文物展厅内请勿使用闪光灯拍照', '请勿触摸馆藏历史文物'],
    managementUnit: '胡志明市文化与体育局',
    milestones: [
      { year: '1929', event: '作为 Blanchard de la Brosse 博物馆正式开馆' },
      { year: '2012', event: '被认定为国家级建筑艺术遗迹' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '印度支那八角重檐塔楼',
        description: '融合东方传统攒尖宝塔造型与法式现代自然采光通风设计的中央主塔。',
      },
      {
        id: 'f2',
        name: '琉璃瓦飞檐与龙凤脊饰',
        description: '饰有青釉陶瓷浮雕与传统回纹的叠层屋檐。',
      },
    ],
  },
  'HCM-DT-007': {
    officialName: '龙屋码头 - 胡志明博物馆（Bến Nhà Rồng）',
    folkName: '法国帝国邮船公司总部 / 龙屋商港',
    summary:
      '1863年由法国帝国邮船公司（Messageries Maritimes）建于西贡河畔，屋脊饰有极具东方特色的“双龙朝月”琉璃陶塑。1911年6月5日，青年阮必成（胡志明主席）在此登上拉图什-特雷维尔号商船，踏上寻找救国道路的征程。',
    chronology: '1863年（建成）- 1911年（历史远航）- 1979年（纪念博物馆）',
    architect: '法国帝国邮船公司工程团队',
    architecturalStyle: '法属殖民时期外廊式商港建筑与越南双龙屋脊',
    conservationNotes: '西贡河畔古石砌码头与屋顶双龙朝月陶塑均保持历史原貌。',
    materials: ['红砖砌体', '法国平瓦', '琉璃双龙陶塑'],
    dimensionsDescription: '两层四周外廊式历史建筑，俯瞰西贡河与𤅶牺牲河交汇处。',
    address: {
      houseNumber: '01',
      street: 'Nguyễn Tất Thành',
      ward: '第12坊',
      district: '第四郡',
      city: '胡志明市',
    },
    openingHours: '07:30 - 11:30 & 13:30 - 17:00（周二至周日开放）',
    ticketPrices: '20,000 越南盾 / 人',
    regulations: ['在纪念展厅内请保持庄重', '临江码头区域请注意安全护栏'],
    managementUnit: '胡志明博物馆 - 胡志明市分馆',
    milestones: [
      { year: '1863', event: '法国邮船公司总部大楼在𤅶牺牲河口落成' },
      { year: '1911', event: '1911年6月5日，青年阮必成由此出发远赴海外寻求民族解放之路' },
      { year: '1998', event: '被列为国家级历史文化遗迹' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '屋脊“双龙朝月”琉璃陶塑',
        description: '赋予这座法式大楼“龙屋（Nhà Rồng）”之名的翠绿釉陶双龙雕塑。',
      },
    ],
  },
  'HCM-DT-008': {
    officialName: '左军黎文悦陵（Lăng Ông Bà Chiểu / 婆沼陵）',
    folkName: '上公庙 / 嘉定城总镇陵园',
    summary:
      '纪念对开拓与繁荣南方嘉定立下卓越功勋的嘉定城总镇左军黎文悦（1764-1832）的庄严祠陵。建筑群采用阮朝南方传统“重檐叠屋”规制，以精美绝伦的碎瓷镶嵌龙凤与金漆木雕闻名。',
    chronology: '1848年（修筑陵墓）- 1914年（兴建正殿）- 1949年（三关门）',
    architect: '南方传统祠庙营造工匠行会',
    architecturalStyle: '阮朝南方祠庙与陵寝建筑艺术',
    conservationNotes: '彩色碎瓷镶嵌四灵图腾、石碑亭及金漆楹联均保存完好。',
    materials: ['铁力木（格木）', '彩釉陶瓷片', '红土蜂窝石陵墓', '贴金生漆'],
    dimensionsDescription: '占地18,500平方米，由三关门、碑亭、红石陵墓与上公祠正殿组成。',
    address: {
      houseNumber: '01',
      street: 'Vũ Tùng',
      ward: '第1坊',
      district: '平盛郡',
      city: '胡志明市',
    },
    openingHours: '07:00 - 17:00（每日开放）',
    ticketPrices: '免费开放',
    regulations: ['进入殿堂请衣着端庄', '保持安静肃穆'],
    managementUnit: '左军黎文悦历史文化遗迹管理处',
    milestones: [
      { year: '1848', event: '嗣德帝为左军黎文悦平反并敕令重修陵寝' },
      { year: '1989', event: '被认定为国家级历史文化遗迹' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '阮朝御制石碑亭',
        description: '立有1868年大学士潘清简撰写的颂扬黎文悦功绩的汉文石碑。',
      },
      {
        id: 'f2',
        name: '南方碎瓷镶嵌艺术',
        description: '利用彩色瓷片精巧拼贴出的龙、麟、龟、凤四灵浮雕。',
      },
    ],
  },
  'HCM-DT-009': {
    officialName: '古芝地道历史遗迹区（Địa đạo Củ Chi）',
    folkName: '古芝钢铁之地 / 𤅶药与𤅶停地下城网络',
    summary:
      '全长超过250公里的传奇地下军事防御奇观，由军民在坚硬的红土铁盘层中徒手挖掘而成。三层立体地下网络涵盖指挥所、战地医院、无烟黄琴灶、兵工厂与隐蔽通气孔。',
    chronology: '1946年（初期挖掘）- 1961-1968年（全面扩展贯通）',
    architect: '古芝武装力量与当地人民',
    architecturalStyle: '多层地下军事防御工事体系',
    conservationNotes: '原始红土地道段、伪装白蚁丘通气孔及竹签陷阱展示区均经加固保护。',
    materials: ['高粘性红土铁盘土', '竹木支护', '天然落叶伪装层'],
    dimensionsDescription: '总长逾250公里，分上、中、下三层，深达地下3米至12米。',
    address: {
      houseNumber: 'Ấp Phú Hiệp',
      street: 'Tỉnh lộ 15',
      ward: '富美兴社',
      district: '古芝县',
      city: '胡志明市',
    },
    openingHours: '07:00 - 17:00（每日开放）',
    ticketPrices: '70,000 - 125,000 越南盾 / 人（含林区专业讲解导览）',
    regulations: ['患有幽闭恐惧或心肺疾病者建议在地面参观', '进入地道请严格跟随导览员'],
    managementUnit: '古芝地道历史遗迹区管理处',
    milestones: [
      { year: '1946', event: '抗法时期挖掘首批地下秘密藏身窖' },
      { year: '1968', event: '戊申春季攻势期间的重要战略集结基地' },
      { year: '2015', event: '被评定为特别国家级历史遗迹' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '落叶伪装秘密活板门',
        description: '仅容一人侧身进出的木质暗门，覆盖枯叶后可承受上方装甲车碾压。',
      },
      {
        id: 'f2',
        name: '白蚁丘伪装通气孔',
        description: '巧妙伪装成森林白蚁土堆的竹管通风道，为地下三层地道输送新鲜空气。',
      },
    ],
  },
  'HCM-DT-010': {
    officialName: '榕嘎喔考古遗址（Di chỉ khảo cổ học Giồng Cá Vồ）',
    folkName: '芹耶瓮棺葬墓地 / 前奥厄文化古海港',
    summary:
      '位于联合国教科文组织认定的芹耶红树林生物圈保护区内，是一处距今约2,500年的铁器时代晚期瓮棺葬墓地与古聚落遗址，见证了沙萤文化向扶南奥厄（Óc Eo）海上贸易文明的演进。',
    chronology: '公元前500年 - 公元100年（铁器时代晚期 / 前扶南时期）',
    architect: '越南南部史前沿海先民',
    architecturalStyle: '史前瓮棺葬墓地与红砂岗海洋聚落遗址',
    conservationNotes: '考古地层探方与出土球形陶瓮、双兽首软玉耳饰受国家级保护。',
    materials: ['粗砂球形陶瓮', '双兽首玉饰（Bicephalous）', '红玉髓珠饰', '青铜与铁器'],
    dimensionsDescription: '位于红树林水系环抱的红土砂岗（Giồng），核心发掘面积逾5,000平方米。',
    address: {
      houseNumber: 'Ấp Đông Hòa',
      street: 'Đường Rừng Sác',
      ward: '隆和社',
      district: '芹耶县',
      city: '胡志明市',
    },
    openingHours: '08:00 - 16:30（考古生态考察预约）',
    ticketPrices: '含于芹耶生态与文化遗产通票内',
    regulations: ['严禁踏入考古地层探方', '禁止携带金属探测设备'],
    managementUnit: '胡志明市社科院考古研究中心 & 芹耶县人民委员会',
    milestones: [
      { year: '1993', event: '首次科学考古发掘，清理出数百座原位瓮棺葬' },
      { year: '2024', event: '获认定为国家级考古遗址' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '考古地层剖面与保护顶棚',
        description: '展示榕嘎喔三层红砂岗地层、前奥厄文化层与芹耶红树林淤泥层。',
      },
      {
        id: 'f2',
        name: '300余座史前陶瓮棺群（3D旋制）',
        description: '距今逾2500年的卵形与柱形陶瓮葬具，整齐分布于考古探方网格内。',
      },
      {
        id: 'f3',
        name: '双兽首玉耳饰与红玉髓珠',
        description: '出土自陶瓮内的珍贵黄金、软玉双兽首耳饰及红玉髓串珠随葬品。',
      },
      {
        id: 'f4',
        name: '考古探方绳网与测绘标桩',
        description: '用于精确记录每一件圈足陶器与随葬遗物三维坐标的考古测绘网格。',
      },
      {
        id: 'f5',
        name: '芹耶红树林支柱根与潮汐水道',
        description: '环绕史前高砂岗聚落的红树林生态系统与古潮汐航道。',
      },
    ],
  },
  'HCM-DT-011': {
    officialName: '觉林寺（Chùa Giác Lâm）',
    folkName: '锦山祖庭 / 山根寺',
    summary:
      '由居士李瑞龙于1744年创建，是西贡历史最悠久的禅宗祖庭古刹。寺内珍藏113尊百年金漆菠萝蜜木古佛像、98根铁力木楹联大柱以及巍峨的七层舍利宝塔。',
    chronology: '1744年（始建）- 1798年（扩建）- 1900年（重修）',
    architect: '临济宗禅门高僧与南方古建匠师',
    architecturalStyle: '南方传统“三”字形佛寺格局',
    conservationNotes: '18世纪金漆木雕古佛像与屋脊古青花瓷盘装饰均按原状供奉保存。',
    materials: ['百年菠萝蜜木', '铁力木大柱', '阴阳瓦', '贴金生漆'],
    dimensionsDescription: '“三”字形三进院落，正殿由98根雕刻汉文楹联的古木柱支撑。',
    address: {
      houseNumber: '565',
      street: 'Lạc Long Quân',
      ward: '第10坊',
      district: '新平郡',
      city: '胡志明市',
    },
    openingHours: '06:00 - 12:00 & 13:30 - 20:00（每日开放）',
    ticketPrices: '免费开放礼佛与参观',
    regulations: ['大雄宝殿内请保持轻声肃穆', '进入内殿请按指示脱鞋'],
    managementUnit: '越南佛教教会新平郡治事委员会',
    milestones: [
      { year: '1744', event: '于锦山高坡创建觉林古寺' },
      { year: '1988', event: '被评定为国家级建筑艺术遗迹' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '七层六角舍利宝塔',
        description: '耸立于山门前院的七层六角宝塔，供奉佛陀舍利，飞檐翘角庄严宏伟。',
      },
      {
        id: 'f2',
        name: '百年古菩提树（1953年迎请）',
        description: '前院枝繁叶茂的古菩提树，由斯里兰卡圣菩提树分枝移植而来。',
      },
      {
        id: 'f3',
        name: '“三”字形三进殿堂与阴阳瓦顶',
        description: '前殿、大雄宝殿与祖堂沿中轴线次第展开，覆以古朴南方阴阳瓦。',
      },
      {
        id: 'f4',
        name: '98根铁力木楹联大柱与贴金横匾',
        description: '殿内林立98根安放于青石柱础上的铁力木巨柱，精雕松鹤与汉文楹联。',
      },
      {
        id: 'f5',
        name: '阿弥陀佛主坛与十八罗汉木雕',
        description: '18尊菠萝蜜木贴金罗汉像分列两侧，拱卫中央庄严的阿弥陀佛像。',
      },
    ],
  },
  'HCM-DT-012': {
    officialName: '义安会馆（关帝庙 / Chùa Ông - Miếu Nghĩa An）',
    folkName: '潮州义安会馆 / 堤岸关帝庙',
    summary:
      '19世纪初由旅居堤岸的潮州华侨社群集资兴建，主祀忠义仁勇的关圣帝君。会馆以富丽堂皇的潮州金漆木雕、梅山窑琉璃陶塑屋脊及高达3米的朱漆木雕门神闻名遐迩。',
    chronology: '约1820年（始建）- 1902年（大修）- 2010年（保护修缮）',
    architect: '潮州木雕与陶瓷雕塑大师',
    architecturalStyle: '潮州传统四合院式会馆与庙宇建筑',
    conservationNotes: '雕刻《三国演义》典故的透雕金漆木挂落与石狮香炉均完好保存。',
    materials: ['贴金生漆铁力木', '梅山窑彩釉陶塑', '福建青石柱'],
    dimensionsDescription: '中轴对称四合院加天井格局，涵盖前殿、天井、拜亭与正殿。',
    address: {
      houseNumber: '678',
      street: 'Nguyễn Trãi',
      ward: '第11坊',
      district: '第五郡（堤岸）',
      city: '胡志明市',
    },
    openingHours: '07:00 - 17:30（每日开放）',
    ticketPrices: '免费开放',
    regulations: ['尊重信众祭祀礼仪', '请勿触摸金漆木雕与神龛文物'],
    managementUnit: '潮州义安会馆理事会',
    milestones: [
      { year: '1820', event: '作为堤岸潮州华商联谊与信仰中心建成' },
      { year: '1993', event: '被认定为国家级建筑艺术遗迹' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '碧绿琉璃筒瓦与梅山窑陶塑屋脊',
        description: '潮州特色燕尾屋脊覆以翠绿琉璃瓦，并饰有精美的梅山窑戏剧人物群塑。',
      },
      {
        id: 'f2',
        name: '天井采光庭院与悬空盘香',
        description: '位于前殿与正殿之间的开阔天井，阳光透过袅袅盘香洒落在青石地面。',
      },
      {
        id: 'f3',
        name: '朱漆赤兔宝马木雕',
        description: '供奉于前殿左侧的等比例赤兔马木雕，寄托信众钻马腹祈求顺遂的民俗。',
      },
      {
        id: 'f4',
        name: '关圣帝君正殿与潮州金漆木雕挂落',
        description: '正殿神龛饰有多层镂空贴金潮州木雕挂落与古铜香炉，气势威严。',
      },
      {
        id: 'f5',
        name: '古铜大洪钟与祭祀大鼓',
        description: '悬挂于右翼木架上的百年青铜古钟与庆典大鼓。',
      },
    ],
  },
  'BRVT-DT-001': {
    officialName: '白宫 - Villa Blanche（头顿白宫 / Bạch Dinh）',
    folkName: '头顿总督避暑行宫 / Villa Blanche',
    summary:
      '建于1898年至1902年间，坐落于头顿大山（Núi Lớn）海拔27.7米的临海山坡上。这座纯白法式新古典主义三层行宫外墙镶嵌古希腊名人胸像与彩瓷马赛克，曾是越南爱国皇帝成泰帝被软禁之地。',
    chronology: '1898年 - 1902年',
    architect: '法属印度支那公共工程建筑师',
    architecturalStyle: '19世纪末法国新古典主义别墅建筑',
    conservationNotes: '百年鸡蛋花古树林、外立面欧洲古典彩瓷雕塑及槟榔屿海底出水古瓷器特展均完好保存。',
    materials: ['实心红砖砌体', '马赛红瓦', '欧洲彩釉马赛克瓷砖', '柚木百叶窗'],
    dimensionsDescription: '长28米，宽15米，高19米，共3层（地下室、接待层与起居层），俯瞰头顿前滩海湾。',
    address: {
      houseNumber: '04',
      street: 'Trần Phú',
      ward: '第1坊',
      district: '头顿市',
      city: '巴地 - 头顿省',
    },
    openingHours: '07:00 - 17:00（每日开放）',
    ticketPrices: '15,000 越南盾 / 人',
    regulations: ['爱护百年鸡蛋花林景观', '请勿触摸馆藏出水古瓷与历史陈列品'],
    managementUnit: '巴地 - 头顿省博物馆',
    milestones: [
      { year: '1898', event: '法国总督保罗·杜美（Paul Doumer）选址头顿大山兴建行宫' },
      { year: '1907', event: '爱国皇帝成泰帝曾在此被软禁十年（1907-1916）' },
      { year: '1992', event: '被列为国家级历史文化遗迹' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '法式新古典主义拱廊立面与马赛红瓦顶',
        description: '三层象牙白行宫建筑，配有法式半圆拱廊、石质宝瓶栏杆与马赛红瓦屋顶。',
      },
      {
        id: 'f2',
        name: '面海19门古火炮阵地',
        description: '沿前庭石栏排列的19门古炮，居高临下俯瞰头顿前滩海湾。',
      },
      {
        id: 'f3',
        name: '檐口8尊古希腊罗马彩瓷胸像',
        description: '镶嵌在三层檐口圆形壁龛内的8尊欧洲古典人物彩釉陶塑胸像。',
      },
      {
        id: 'f4',
        name: '槟榔屿海底沉船康熙青花瓷展厅',
        description: '三层内厅陈列从槟榔屿海域古沉船打捞出水的清代康熙青花瓷珍品。',
      },
      {
        id: 'f5',
        name: '古木旋转楼梯与大山鸡蛋花林',
        description: '二层典雅的实木旋转楼梯，窗外环绕着头顿大山苍翠的百年鸡蛋花古树。',
      },
    ],
  },
  'BRVT-DT-002': {
    officialName: '龙山大屋（陈爷庙 / Nhà Lớn Long Sơn）',
    folkName: '龙山陈爷祖庭（Đền Ông Trần）',
    summary:
      '由黎文谋先生（尊称陈爷 Ông Trần）率领乡民于1910年至1929年间兴建，是一处占地2公顷的纯榫卯名贵硬木古建筑群，集祭祀殿堂、免费学堂、集市、粮仓与会馆客房于一体。',
    chronology: '1910年 - 1929年',
    architect: '陈爷（黎文谋）与龙山木工匠师',
    architecturalStyle: '越南南部传统穿斗榫卯木结构群落',
    conservationNotes: '古木楼阁、螺钿镶嵌祭器及独特的“穿黑婆衫、束发髻”传统生活习俗传承至今。',
    materials: ['名贵油木与格木', '阴阳瓦', '螺钿镶嵌红木家具'],
    dimensionsDescription: '占地约2公顷，分为祭祀区、公共生活服务区与陈爷陵墓区三大板块。',
    address: {
      houseNumber: 'Thôn 5',
      street: 'Đường vào Nhà Lớn',
      ward: '龙山社',
      district: '头顿市',
      city: '巴地 - 头顿省',
    },
    openingHours: '06:00 - 17:00（每日开放）',
    ticketPrices: '免费参观',
    regulations: ['请着端庄服饰入内', '尊重当地陈爷信众的传统礼俗'],
    managementUnit: '龙山大屋遗迹保护管理委员会',
    milestones: [
      { year: '1910', event: '黎文谋先生率民众开发龙山岛并营造大屋建筑群' },
      { year: '1991', event: '被列为国家级历史文化与建筑遗迹' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '圣堂正殿（三进重檐叠屋）',
        description: '前殿、中殿、后殿三进相连，设格木格子门、6座螺钿镶嵌祭坛与贴金楹联。',
      },
      {
        id: 'f2',
        name: '双层古楼（仙楼·禁楼）与会馆长屋',
        description: '两座双层木楼与重檐龙亭通过阴阳瓦木廊与后方会馆长屋紧密相连。',
      },
      {
        id: 'f3',
        name: '青石庭院、石雕香鼎与储水陶瓮阵',
        description: '铺设青石板的开阔庭院，中央立石雕香鼎，廊前整齐排列传统储雨水陶瓮。',
      },
      {
        id: 'f4',
        name: '后殿与传统大灶厨房（Nhà Lò）',
        description: '依山而建的传统砖砌大灶与巨型铜锅，展现大屋免费招待四方宾客的习俗。',
      },
      {
        id: 'f5',
        name: '1900年开荒古木船亭（Ghe Sấm）',
        description: '完整保存陈爷当年率领家族跨越海湾开拓龙山岛时所乘的传统大木船。',
      },
      {
        id: 'f6',
        name: '永不落锁的青石柱大门',
        description: '象征龙山大屋昼夜敞开、广迎天下宾客的开放式青石柱门廊。',
      },
    ],
  },
  'BRVT-DT-003': {
    officialName: '龙福地道历史遗迹（Địa đạo Long Phước）',
    folkName: '巴地抗战钢铁堡垒',
    summary:
      '始建于1948年并于1963年扩建贯通，龙福地道以独特的“鱼骨式”主干道串联全社5个村落，拥有地下救护站、储粮窖与射击暗堡，与古芝地道及铁三角地道共同构成东南部地下防御传奇。',
    chronology: '1948年 - 1975年',
    architect: '龙福社武装力量与人民',
    architecturalStyle: '地下军事防御交通壕与暗堡体系',
    conservationNotes: '北村主干地道段、地面交通壕及烈士纪念碑已修缮开放。',
    materials: ['红土铁盘黏土', '加固砖石与竹木'],
    dimensionsDescription: '主干地道距地面深3-6米，通道高1.6-1.8米，宽0.7-0.8米。',
    address: {
      houseNumber: 'Ấp Bắc',
      street: 'Hương lộ 2',
      ward: '龙福社',
      district: '巴地市',
      city: '巴地 - 头顿省',
    },
    openingHours: '07:30 - 17:00（每日开放）',
    ticketPrices: '免费参观',
    regulations: ['参观地下通道请遵循安全指引', '在纪念馆区请保持肃穆'],
    managementUnit: '巴地市历史遗迹管理处',
    milestones: [
      { year: '1948', event: '龙福军民挖掘首批抗战秘密地下掩体' },
      { year: '1990', event: '被认定为国家级历史遗迹' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '双层蜿蜒地下主干地道网',
        description: '深入巴地玄武岩红土层地下3至6米的双层立体蜿蜒地道纵剖面。',
      },
      {
        id: 'f2',
        name: 'A字形原木加固防炮掩体',
        description: '采用坚固A字形木架与横梁加固的地下防炮击战斗掩体。',
      },
      {
        id: 'f3',
        name: '地下党支部会议室与油灯指挥室',
        description: '通过垂直竖井直接连通下层主干地道的地下指挥与会议空间。',
      },
      {
        id: 'f4',
        name: '战地军医救护室（侧面剖视）',
        description: '设于深层地道的战地救护站，配备竹榻与战地医疗药柜。',
      },
      {
        id: 'f5',
        name: '地面竹丛、白蚁丘与秘密伪装暗门',
        description: '地面茂密竹丛与白蚁丘完美掩护下的秘密地道入口与单兵射击工事。',
      },
    ],
  },
  'BD-DT-001': {
    officialName: '陈公黄金雕古宅（Nhà cổ Trần Công Vàng）',
    folkName: '富强百年木雕古厝',
    summary:
      '建于1889年至1892年的平阳土龙木市，是一座典型的南方五间两厢“丁”字形穿斗木构豪宅。全屋由48根名贵格木与酸枝木大柱支撑，汇聚了土龙木木雕艺人的镂空贴金“四时花鸟”绝技。',
    chronology: '1889年 - 1892年',
    architect: '土龙木传统木雕匠师行会',
    architecturalStyle: '南方传统五间两厢“丁”字形木构古宅',
    conservationNotes: '历经130余年风雨，48根硬木立柱、汉字贴金横匾楹联与雕花挂落依然完好如初。',
    materials: ['酸枝木、格木、红木', '阴阳瓦', '六角红地砖'],
    dimensionsDescription: '宅院占地逾1,300平方米，主体为五开间加两耳房。',
    address: {
      houseNumber: '18',
      street: 'Bạch Đằng',
      ward: '富强坊',
      district: '土龙木市',
      city: '平阳省',
    },
    openingHours: '08:00 - 17:00（每日开放）',
    ticketPrices: '20,000 越南盾 / 人',
    regulations: ['请勿随意触碰古董家具与宗祠神龛', '在家族祠堂区请保持安静'],
    managementUnit: '陈氏家族后人 & 平阳省博物馆',
    milestones: [
      { year: '1892', event: '历时三年精心雕琢建成' },
      { year: '1993', event: '被列为国家级建筑艺术遗迹' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '五间两厢“丁”字形穿斗木构古宅',
        description: '西贡河畔百年名木古宅全景，覆以传统阴阳瓦顶与青石台基。',
      },
      {
        id: 'f2',
        name: '36根格木圆桩与莲花青石柱础',
        description: '立于莲花浮雕青石础上的光亮格木立柱，承托起整座传统穿斗木梁架。',
      },
      {
        id: 'f3',
        name: '土龙木镂空贴金“四灵”木雕挂落',
        description: '由土龙木木雕名匠精雕细琢的龙、麟、龟、凤贴金透雕挂落与横匾。',
      },
      {
        id: 'f4',
        name: '祖宗神龛与螺钿镶嵌木屏风',
        description: '正厅中央庄严陈列的百年螺钿镶嵌祭祀柜与雕花屏风。',
      },
      {
        id: 'f5',
        name: '螺钿罗汉床客堂与古盆景庭院',
        description: '正厅两侧镶嵌螺钿的待客长榻，通向铺设红砖的古典盆景庭院。',
      },
    ],
  },
  'BD-DT-002': {
    officialName: '铁三角地道 - 槟吉西南抗战基地（Địa đạo Tam Giác Sắt）',
    folkName: '安田 - 安西 - 富安三社地下城',
    summary:
      '位于西贡河畔槟吉西南战略要冲，串联安田、安西、富安三社，总长逾100公里的三层地下地道网络与河对岸的古芝地道遥相呼应，守护西贡-嘉定北方门户。',
    chronology: '1948年 - 1975年',
    architect: '槟吉西南三社军民',
    architecturalStyle: '三层立体地下军事堡垒',
    conservationNotes: '占地23公顷的纪念园区保留了复原地道体验段、展览馆与西贡河畔纪念碑。',
    materials: ['红土铁盘黏土', '钢筋混凝土纪念碑'],
    dimensionsDescription: '干线与支线地道总长逾100公里，深达地下9米，设三层攻防结构。',
    address: {
      houseNumber: 'Ấp Phú Thuận',
      street: 'ĐT 744',
      ward: '富安坊',
      district: '槟吉市',
      city: '平阳省',
    },
    openingHours: '07:30 - 17:00（每日开放）',
    ticketPrices: '免费参观',
    regulations: ['体验地下通道请遵循园区安全规范'],
    managementUnit: '槟吉市历史遗迹管理委员会',
    milestones: [
      { year: '1948', event: '三社军民开始挖掘抗战地下交通网' },
      { year: '1996', event: '被列为国家级历史文化遗迹' },
    ],
    hotspots: [
      {
        id: 'f1',
        name: '西贡河畔红色防线与槟吉橡胶林',
        description: '紧邻西贡河湾与槟吉橡胶林的铁三角三层地道立体剖面沙盘。',
      },
      {
        id: 'f2',
        name: '地下指挥所与3D作战沙盘室',
        description: '设于地下一层的指挥室，重现当年反击“雪松瀑布行动”的作战沙盘与电台。',
      },
      {
        id: 'f3',
        name: '槟吉西南地下军火武器库',
        description: '深藏于红土铁盘层之下的轻武器与弹药储备窖。',
      },
      {
        id: 'f4',
        name: '黄琴无烟灶与地下散烟管道',
        description: '利用蜿蜒地下土槽冷却并分散炊烟的隐蔽炉灶系统，躲避空中侦察。',
      },
      {
        id: 'f5',
        name: '临江秘密脱险口与战壕网络',
        description: '直通西贡河渡口并与对岸古芝地道遥相呼应的深层水道脱险口。',
      },
    ],
  },
};

/**
 * DỮ LIỆU DỊCH ANH - VIỆT CHO 7 TUYẾN DI SẢN CHỦ ĐỀ & LIÊN VÙNG
 */
export const TOUR_TRANSLATIONS: Record<string, TourTranslation> = {
  'TOUR-01': {
    title: 'Route 01 — Heart of Saigon Heritage (District 1)',
    subtitle: 'Independence Palace → Notre-Dame Cathedral → Central Post Office → Opera House → Ben Thanh Market → Nha Rong Wharf',
    theme: 'Urban Architecture & Historic Core',
    estimatedDuration: '3.5 hours (Walking & Buggy)',
    description:
      'A seamless District 1 loop uniting six defining architectural and historical landmarks: from Ngo Viet Thu’s tropical modernist Independence Palace and the French beaux-arts ensemble around Paris Commune Square to Ben Thanh Market and Nha Rong Wharf.',
    highlights: [
      'Admire Ngo Viet Thu’s stylized bamboo brise-soleil and grand ceremonial halls at Independence Palace',
      'Toulouse red brick masonry of Notre-Dame Cathedral and Gustave Eiffel vaulted ironwork at the Post Office',
      'Beaux-Arts Saigon Opera House, Ben Thanh Market clock tower, and historic Nha Rong Wharf',
    ],
  },
  'TOUR-02': {
    title: 'Route 02 — Cho Lon Memories & Gia Dinh Temples',
    subtitle: 'Nghia An Guild Hall → Giac Lam Pagoda → Mausoleum of General Le Van Duyet',
    theme: 'Spiritual Heritage & Old Gia Dinh',
    estimatedDuration: '4 hours',
    description:
      'A cultural trail from historic Cho Lon through Tan Binh to old Gia Dinh: gilded Teochew woodcarvings at Nghia An Temple, the 1744 patriarch Giac Lam Pagoda, and imperial ceramic mosaic shrines at Lang Ong Ba Chieu.',
    highlights: [
      'Teochew gilded woodcarving and Mei Shan ceramic roof ridges at Nghia An Guild Hall',
      'Tam-character timber layout and 113 gilded jackfruit-wood statues at Giac Lam Pagoda (1744)',
      'Porcelain-inlaid triple gate and royal altar chambers at Lang Ta quan Le Van Duyet',
    ],
  },
  'TOUR-03': {
    title: 'Route 03 — Iron Triangle & Eastern Resistance Belt',
    subtitle: 'Cu Chi Tunnels → Iron Triangle Tunnels (Ben Cat)',
    theme: 'Subterranean Engineering & Wartime History',
    estimatedDuration: '6 hours (Northwest Corridor)',
    description:
      'A continuous cross-river subterranean corridor linking two legendary laterite-clay tunnel fortresses on opposite banks of the Saigon River: Cu Chi Tunnels and the Ben Cat Iron Triangle.',
    highlights: [
      '3-level subterranean cross-section (-3m to -10m) and Hoang Cam smokeless stove at Cu Chi',
      'Strategic Saigon River crossing linking Cu Chi with An Tay – An Dien – Phu An in Ben Cat',
      'Natural laterite clay ventilation shafts and camouflaged trapdoors',
    ],
  },
  'TOUR-04': {
    title: 'Route 04 — Binh Duong Timber Architecture Heritage',
    subtitle: 'Tran Cong Vang Ancient House (Thu Dau Mot) → Iron Triangle Tunnels',
    theme: 'Vernacular Timber Craft & Binh Duong',
    estimatedDuration: '5 hours',
    description:
      'Discover Binh Duong’s architectural heritage from the 64-pillar Dinh-shaped wooden mansion of Tran Cong Vang (1889–1892) in Thu Dau Mot up to the Ben Cat underground network.',
    highlights: [
      '64 precious ironwood pillars and mortise-and-tenon joinery at Tran Cong Vang Ancient House',
      'Exquisite Four-Sacred-Beasts woodcarving tradition of old Thu Dau Mot',
      'Subterranean tunnel chambers along the eastern bank of the Saigon River',
    ],
  },
  'TOUR-05': {
    title: 'Route 05 — Vung Tau Coastline & Big Mountain Trail',
    subtitle: 'Villa Blanche (Bach Dinh) → Long Son Big House → Long Phuoc Tunnels',
    theme: 'Coastal Heritage & Ba Ria - Vung Tau',
    estimatedDuration: '1 Day (7 hours)',
    description:
      'A scenic coastal route through Ba Ria - Vung Tau: from French Neo-Classical Villa Blanche overlooking Front Beach, across Long Son Island’s 2-hectare wooden sanctuary, to the Long Phuoc tunnel network.',
    highlights: [
      'Oceanfront Villa Blanche (1898) and the Hon Cau shipwreck antique porcelain collection',
      'Traditional timber mortise-and-tenon assembly built without iron nails at Long Son Big House',
      'Fishbone subterranean tunnel arteries and bunkers at Long Phuoc Tunnels',
    ],
  },
  'TOUR-06': {
    title: 'Route 06 — Can Gio Archaeology & Mangrove Reserve',
    subtitle: 'Giong Ca Vo Archaeological Site',
    theme: 'Prehistoric Archaeology & Biosphere',
    estimatedDuration: '4.5 hours (Eco-Archaeology)',
    description:
      'An expedition to the 2,500-year-old coastal trading necropolis of Giong Ca Vo nestled deep inside the UNESCO-recognized Can Gio Mangrove Biosphere Reserve.',
    highlights: [
      'Prehistoric jar burials and coastal maritime settlement stratigraphy (~2,500 years BP)',
      'Double-headed animal nephrite jade earrings proving ancient South China Sea trade',
      'Guided waterway passage through the Can Gio mangrove core zone',
    ],
  },
  'TOUR-07': {
    title: 'Route 07 — Trans-Regional Southeast Vietnam Journey',
    subtitle: 'Independence Palace → Cu Chi Tunnels → Tran Cong Vang Ancient House → Villa Blanche (Bach Dinh)',
    theme: 'Inter-Regional Corridor (HCMC – Binh Duong – Vung Tau)',
    estimatedDuration: '1–2 Days (3 Provinces)',
    description:
      'A flagship inter-regional GIS corridor connecting four iconic monuments across all three Southeast provinces: from Independence Palace in downtown Ho Chi Minh City to Cu Chi Tunnels, across to Tran Cong Vang’s 64-pillar wooden mansion in Binh Duong, and down to coastal Villa Blanche in Vung Tau.',
    highlights: [
      'Unites all 3 heritage regions — Ho Chi Minh City, Binh Duong, and Ba Ria - Vung Tau — on one continuous GIS axis',
      'Contrasts tropical modernist architecture, 3-level laterite tunnels, and traditional 19th-century southern timber joinery',
      'Concludes at Neo-Classical Villa Blanche perched on Big Mountain overlooking Vung Tau Front Beach',
    ],
  },
};

/**
 * DỮ LIỆU DỊCH TIẾNG TRUNG (ZH) CHO 7 TUYẾN DI SẢN ĐỊA LÝ LIỀN MẠCH
 */
export const TOUR_TRANSLATIONS_ZH: Record<string, TourTranslation> = {
  'TOUR-01': {
    title: '路线 01 — 西贡遗产之心（第一郡）',
    subtitle: '独立宫 → 红教堂 → 中央邮局 → 市政大剧院 → 槟城市场 → 龙屋码头',
    theme: '城市建筑与核心历史区',
    estimatedDuration: '3.5小时（步行与电瓶车）',
    description:
      '串联西贡第一郡核心区六大代表性地标：从热带现代主义独立宫、巴黎公社广场法式建筑群延伸至百年槟城市场与西贡河畔龙屋码头。',
    highlights: [
      '鉴赏建筑师吴曰树设计的独立宫“吉”字竹节遮阳花窗与庆典大厅',
      '圣母大教堂红砖双塔与中央邮局埃菲尔锻铁拱顶',
      '胡志明市大剧院学院派立面、槟城市场四面钟楼及龙屋码头',
    ],
  },
  'TOUR-02': {
    title: '路线 02 — 堤岸记忆与嘉定古刹',
    subtitle: '义安会馆 → 觉林古寺 → 左军黎文悦陵',
    theme: '宗教信仰与古嘉定历史',
    estimatedDuration: '4小时',
    description:
      '从第五郡堤岸商埠走向古嘉定腹地：探访潮州金漆木雕杰作义安会馆、1744年创建的觉林古寺，以及融合宫廷镶嵌瓷艺的翁婆沼陵。',
    highlights: [
      '第五郡义安会馆的潮州金漆木雕与陶塑屋脊艺术',
      '觉林古寺“三”字形古建与113尊菠萝蜜木雕古佛像',
      '左军黎文悦陵三观门楼、龙虎照壁与碎瓷镶嵌正殿',
    ],
  },
  'TOUR-03': {
    title: '路线 03 — 钢铁地带与东南部抗战防线',
    subtitle: '古芝地道 → 槟吉铁三角地道',
    theme: '地下军事工程与抗战遗址',
    estimatedDuration: '6小时（西北防线走廊）',
    description:
      '沿西贡河两岸红壤粘土带衔接两大地下钢铁堡垒：从胡志明市古芝地道跨河直连平阳省槟吉西南铁三角地道。',
    highlights: [
      '透视古芝地道三层立体结构（-3米至-10米）与无烟黄琴灶',
      '考察连接古芝与平阳三社的西贡河战略渡口及地道网络',
      '对比天然红壤硬土层中的伪装通气孔与A字掩体',
    ],
  },
  'TOUR-04': {
    title: '路线 04 — 平阳传统木构建筑遗产',
    subtitle: '陈公黄古宅（土龙木） → 铁三角地道',
    theme: '南方木构工艺与土龙木文脉',
    estimatedDuration: '5小时',
    description:
      '纵览平阳省代表性人文与历史遗迹：从土龙木市1892年建成的六十四柱“丁”字形陈公黄古宅出发，延伸至槟吉西南铁三角地道遗址。',
    highlights: [
      '细品陈公黄古宅64根铁木大柱榫卯结构与“四灵”镂空木雕',
      '领略传统土龙木木雕工艺与南方开垦文化',
      '探访西贡河东岸铁三角地下防御网络',
    ],
  },
  'TOUR-05': {
    title: '路线 05 — 头顿山海与龙山岛探索之旅',
    subtitle: '白宫（Villa Blanche） → 龙山大屋 → 龙福地道',
    theme: '海滨遗产与巴地头顿',
    estimatedDuration: '1天（7小时）',
    description:
      '串联巴地头顿省山海精华路线：从头顿大山面向前滩的新古典主义白宫出发，渡至龙山岛参观纯木榫卯龙山大屋，再赴巴地龙福地道。',
    highlights: [
      '俯瞰前滩的法式白宫（1898年）及头顿沉船古代外销瓷特展',
      '占地2公顷、全程不用一颗铁钉的龙山大屋古木建筑群',
      '巴地龙福地道特有的“鱼骨式”主干地道与战斗掩体',
    ],
  },
  'TOUR-06': {
    title: '路线 06 — 芹耶史前考古与红树林生态',
    subtitle: '榕嘎喔（Giồng Cá Vồ）考古遗址',
    theme: '史前考古与生物圈保护区',
    estimatedDuration: '4.5小时（生态考古）',
    description:
      '深入联合国教科文组织芹耶红树林生物圈保护区腹地，考察距今约2500年的南海古海港瓮棺葬考古遗址——榕嘎喔。',
    highlights: [
      '考察2500年前史前瓮棺葬地层与古代沿海聚落遗存',
      '鉴赏见证南海海上丝路交流的双兽首软玉耳饰文物',
      '乘船穿梭世界级芹耶红树林生态水道',
    ],
  },
  'TOUR-07': {
    title: '路线 07 — 越南东南部跨省遗产纵贯线',
    subtitle: '独立宫 → 古芝地道 → 陈公黄古宅 → 头顿白宫',
    theme: '胡志明市－平阳－巴地头顿跨区走廊',
    estimatedDuration: '1–2天（跨越三省市）',
    description:
      '串联越南东南部三省市四大标志性遗产地标的黄金走廊：从胡志明市中心独立宫北上古芝地道，东行探访平阳土龙木六十四柱陈公黄古宅，最终南下直抵巴地头顿海滨白宫。',
    highlights: [
      '在单一GIS地理轴线上贯通胡志明市、平阳与巴地头顿三大遗产区',
      '对比热带现代主义、三层红壤地道与十九世纪南方榫卯木构工艺',
      '在俯瞰头顿前滩的法式新古典主义白宫圆满收官',
    ],
  },
};

/**
 * HELPER: Lấy dữ liệu di tích theo ngôn ngữ đang chọn (vi | en | zh)
 * Tự động gắn cờ isPendingTranslation nếu thiếu bản dịch
 */
function readRuntimeSiteTranslationOverride(
  siteId: string,
  lang: 'en' | 'zh'
): { officialName?: string; summary?: string; architecturalStyle?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('dau_an_viet_site_translations_v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const entry = parsed?.[siteId]?.[lang];
    return entry && typeof entry === 'object' ? entry : null;
  } catch {
    return null;
  }
}

export function getLocalizedSite(site: HeritageSite, lang: Language) {
  if (lang === 'vi') {
    return {
      ...site,
      hotspots: undefined as SiteTranslation['hotspots'],
      photoCaptions: undefined as string[] | undefined,
      isPendingTranslation: false,
    };
  }

  const dict = lang === 'zh' ? SITE_TRANSLATIONS_ZH : SITE_TRANSLATIONS;
  const transData = dict[site.id] || SITE_TRANSLATIONS[site.id];
  const runtimeOverride = readRuntimeSiteTranslationOverride(site.id, lang);

  if (!transData && !runtimeOverride) {
    return {
      ...site,
      hotspots: undefined as SiteTranslation['hotspots'],
      photoCaptions: undefined as string[] | undefined,
      isPendingTranslation: true,
    };
  }

  const defaultCity =
    lang === 'zh'
      ? site.address.city.includes('Bà Rịa')
        ? '巴地 - 头顿省'
        : site.address.city.includes('Bình Dương')
        ? '平阳省'
        : '胡志明市'
      : site.address.city.includes('Bà Rịa')
      ? 'Ba Ria - Vung Tau'
      : site.address.city.includes('Bình Dương')
      ? 'Binh Duong'
      : 'Ho Chi Minh City';

  const localizedAddress = transData?.address
    ? {
        ...site.address,
        district: transData.address.district || formatDistrict(site.address.district, lang),
        ward: transData.address.ward || site.address.ward,
        city: transData.address.city || defaultCity,
      }
    : {
        ...site.address,
        district: formatDistrict(site.address.district, lang),
        city: defaultCity,
      };

  return {
    ...site,
    officialName: runtimeOverride?.officialName || transData?.officialName || site.officialName,
    folkName: transData?.folkName || site.folkName,
    summary: runtimeOverride?.summary || transData?.summary || site.summary,
    chronology: transData?.chronology || site.chronology,
    architect: transData?.architect || site.architect,
    architecturalStyle:
      runtimeOverride?.architecturalStyle ||
      transData?.architecturalStyle ||
      site.architecturalStyle,
    conservationNotes: transData?.conservationNotes || site.conservationNotes,
    materials: transData?.materials || site.materials,
    dimensionsDescription: transData?.dimensionsDescription || site.dimensionsDescription,
    address: localizedAddress,
    openingHours: transData?.openingHours || site.openingHours,
    ticketPrices: transData?.ticketPrices || site.ticketPrices,
    regulations: transData?.regulations || site.regulations,
    managementUnit: transData?.managementUnit || site.managementUnit,
    milestones: transData?.milestones || site.milestones,
    hotspots: transData?.hotspots,
    photoCaptions: transData?.photoCaptions,
    isPendingTranslation: false,
  };
}

/**
 * HELPER: Lấy dữ liệu tuyến di sản theo ngôn ngữ đang chọn (vi | en | zh)
 */
export function getLocalizedTour(tour: TourRoute, lang: Language) {
  if (lang === 'vi') {
    return {
      ...tour,
      isPendingTranslation: false,
    };
  }

  const dict = lang === 'zh' ? TOUR_TRANSLATIONS_ZH : TOUR_TRANSLATIONS;
  const transData = dict[tour.id] || TOUR_TRANSLATIONS[tour.id];
  if (!transData) {
    return {
      ...tour,
      isPendingTranslation: true,
    };
  }

  return {
    ...tour,
    title: transData.title || tour.title,
    subtitle: transData.subtitle || tour.subtitle,
    theme: transData.theme || tour.theme,
    estimatedDuration: transData.estimatedDuration || tour.estimatedDuration,
    description: transData.description || tour.description,
    highlights: transData.highlights || tour.highlights,
    isPendingTranslation: false,
  };
}
