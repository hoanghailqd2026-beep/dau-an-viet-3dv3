export interface SitePhotoCaptionSet {
  vi: [string, string];
  en: [string, string];
  zh: [string, string];
}

/**
 * 34 URL anh chup thuc te do phan giai cao (>= 1000px, kho ngang) tu Wikimedia Commons
 * duoc luu cung vao ma nguon tinh de chong mat du lieu anh khi Remix sang du an moi.
 */
export const DEFAULT_SITE_PHOTOS_BY_ID: Record<string, [string, string]> = {
  'HCM-DT-001': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/Palacio_de_la_Reunificaci%C3%B3n%2C_Ciudad_Ho_Chi_Minh%2C_Vietnam%2C_2013-08-14%2C_DD_03.JPG/1920px-Palacio_de_la_Reunificaci%C3%B3n%2C_Ciudad_Ho_Chi_Minh%2C_Vietnam%2C_2013-08-14%2C_DD_03.JPG',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2c/2023-12-10_Interiors_of_Independence_Palace%2C_Saigon_03.jpg/1920px-2023-12-10_Interiors_of_Independence_Palace%2C_Saigon_03.jpg',
  ],
  'HCM-DT-002': [
    'https://upload.wikimedia.org/wikipedia/commons/5/55/Saigon_Opera_House%2C_front.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/45/%C3%93pera%2C_Ciudad_Ho_Chi_Minh%2C_Vietnam%2C_2013-08-14%2C_DD_01.JPG/1920px-%C3%93pera%2C_Ciudad_Ho_Chi_Minh%2C_Vietnam%2C_2013-08-14%2C_DD_01.JPG',
  ],
  'HCM-DT-003': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/48/Saigon_Central_Post_Office_2014.jpg/1920px-Saigon_Central_Post_Office_2014.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/e/eb/Saigon_Central_Post_Office_Lobby.jpg',
  ],
  'HCM-DT-004': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/Ben_Thanh%2C_Ciudad_Ho_Chi_Minh%2C_Vietnam%2C_2013-08-14%2C_DD_01.JPG/1920px-Ben_Thanh%2C_Ciudad_Ho_Chi_Minh%2C_Vietnam%2C_2013-08-14%2C_DD_01.JPG',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/34/Ben_Thanh_Market%2C_2023_%2806%29.jpg/1920px-Ben_Thanh_Market%2C_2023_%2806%29.jpg',
  ],
  'HCM-DT-005': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Saigon_Notre-Dame_Basilica_Side.JPG/1920px-Saigon_Notre-Dame_Basilica_Side.JPG',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/88/Saigon_Notre-Dame_Basilica.jpg/1920px-Saigon_Notre-Dame_Basilica.jpg',
  ],
  'HCM-DT-006': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7a/Museum_of_Vietnamese_History%2C_Ho_Chi_Minh_City_-_20121014-02.JPG/1920px-Museum_of_Vietnamese_History%2C_Ho_Chi_Minh_City_-_20121014-02.JPG',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/Indra_statue%2C_Museum_of_Vietnamese_History%2C_Ho_Chi_Minh_City_-_20100603.jpg/1920px-Indra_statue%2C_Museum_of_Vietnamese_History%2C_Ho_Chi_Minh_City_-_20100603.jpg',
  ],
  'HCM-DT-007': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Ho_Chi_Minh_Museum%2C_Saigon.jpg/1920px-Ho_Chi_Minh_Museum%2C_Saigon.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/c/cd/Saigon_-_Entree_de_l%27Arroyo_de_Cholon.jpg',
  ],
  'HCM-DT-008': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/C%E1%BB%95ng_ch%C3%ADnh_L%C4%83ng_%C3%94ng_B%C3%A0_Chi%E1%BB%83u.jpg/1920px-C%E1%BB%95ng_ch%C3%ADnh_L%C4%83ng_%C3%94ng_B%C3%A0_Chi%E1%BB%83u.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Lang_ong_Ba_Chieu_Binh_thanh_-_panoramio.jpg/1920px-Lang_ong_Ba_Chieu_Binh_thanh_-_panoramio.jpg',
  ],
  'HCM-DT-009': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c8/Cu_Chi_Tunnels_Vietnam_war.jpg/1920px-Cu_Chi_Tunnels_Vietnam_war.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Lascar_Booby-trap_-_Cu_Chi_tunnels_%284607383295%29.jpg/1920px-Lascar_Booby-trap_-_Cu_Chi_tunnels_%284607383295%29.jpg',
  ],
  'HCM-DT-010': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1b/CangioBioReserve.JPG/1920px-CangioBioReserve.JPG',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/Oc_Eo_Culture_Gold_Coin_1.jpg/1920px-Oc_Eo_Culture_Gold_Coin_1.jpg',
  ],
  'HCM-DT-011': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Chua_Giac_Lam_Gate.JPG/1920px-Chua_Giac_Lam_Gate.JPG',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/Ch%C3%B9a_Gi%C3%A1c_L%C3%A2m%2C_th%C3%A1ng_01_n%C4%83m_2022_%28th%C3%A1p_x%C3%A1_l%E1%BB%A3i%29_%284%29.jpg/1920px-Ch%C3%B9a_Gi%C3%A1c_L%C3%A2m%2C_th%C3%A1ng_01_n%C4%83m_2022_%28th%C3%A1p_x%C3%A1_l%E1%BB%A3i%29_%284%29.jpg',
  ],
  'HCM-DT-012': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Nghia_An_Hoi_Quan_Pagoda_%2810018215816%29.jpg/1920px-Nghia_An_Hoi_Quan_Pagoda_%2810018215816%29.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Nghia_An_Hoi_Quan_Pagoda_%2810018333403%29.jpg/1920px-Nghia_An_Hoi_Quan_Pagoda_%2810018333403%29.jpg',
  ],
  'BRVT-DT-001': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Vung_Tau_Bach_Dinh.JPG/1920px-Vung_Tau_Bach_Dinh.JPG',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/VN-vungtau-bach-dinh-1.jpg/1920px-VN-vungtau-bach-dinh-1.jpg',
  ],
  'BRVT-DT-002': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Nh%C3%A0_L%E1%BB%9Bn_Long_S%C6%A1n.jpg/1920px-Nh%C3%A0_L%E1%BB%9Bn_Long_S%C6%A1n.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Cau_Long_son%2C_ba_ria_vung_tau_-_panoramio.jpg/1920px-Cau_Long_son%2C_ba_ria_vung_tau_-_panoramio.jpg',
  ],
  'BRVT-DT-003': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/Vong_xoay_Dai_Liet_sy-_Duong_thi_sach%2C_Phuong_Thang_tam%2C_tp_vungtau%2C_vn_-_panoramio.jpg/1920px-Vong_xoay_Dai_Liet_sy-_Duong_thi_sach%2C_Phuong_Thang_tam%2C_tp_vungtau%2C_vn_-_panoramio.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/C%E1%BB%A7_Chi_tunnels_entrance.JPG/1920px-C%E1%BB%A7_Chi_tunnels_entrance.JPG',
  ],
  'BD-DT-001': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Hoi_Khanh_Pagoda_in_Binh_Duong.jpg/1920px-Hoi_Khanh_Pagoda_in_Binh_Duong.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Thu_Dau_Mot%2C_Binh_Duong%2C_Vietnam_2013.jpg/1920px-Thu_Dau_Mot%2C_Binh_Duong%2C_Vietnam_2013.jpg',
  ],
  'BD-DT-002': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Nh%C3%A0_t%C3%B9_Ph%C3%BA_L%E1%BB%A3i%2C_l%E1%BB%91i_v%C3%A0o_di_t%C3%ADch_nh%C3%A0_t%C3%B9.jpg/1920px-Nh%C3%A0_t%C3%B9_Ph%C3%BA_L%E1%BB%A3i%2C_l%E1%BB%91i_v%C3%A0o_di_t%C3%ADch_nh%C3%A0_t%C3%B9.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/3/34/US_infantry_guard_VC_prisoners%2C_Operation_Cedar_Falls%2C_19_January_1967.jpg',
  ],
};

/**
 * Chu thich da ngon ngu (VI / EN / ZH) mac dinh cho tung buc anh (Anh 01 & Anh 02)
 * cua toan bo 17 di tich, duoc luu cung cung bo URL anh tinh.
 */
export const DEFAULT_SITE_PHOTO_CAPTIONS: Record<string, SitePhotoCaptionSet> = {
  'HCM-DT-001': {
    vi: [
      'Toàn cảnh kiến trúc mặt tiền Dinh Độc Lập và khuôn viên trục đường Lê Duẩn',
      'Không gian nội thất đại sảnh khánh tiết và kiến trúc bên trong Dinh Độc Lập',
    ],
    en: [
      'Exterior facade architecture and grand grounds of the Independence Palace',
      'Ceremonial interior hall and modernist timber spaces inside the palace',
    ],
    zh: [
      '独立宫正立面全景与庭院建筑景观',
      '独立宫内部礼仪大厅与现代主义室内空间',
    ],
  },
  'HCM-DT-002': {
    vi: [
      'Toàn cảnh mặt tiền kiến trúc Beaux-Arts Nhà hát Thành phố Hồ Chí Minh',
      'Cận cảnh kiến trúc vòm cửa và phù điêu nghệ thuật Nhà hát Sài Gòn',
    ],
    en: [
      'Flamboyant French Third Republic facade of Saigon Municipal Theatre',
      'Architectural relief detailing and grand entrance arches of the Opera House',
    ],
    zh: [
      '胡志明市大剧院法式华丽风正立面全景',
      '西贡歌剧院标志性门廊拱顶与浮雕建筑细节',
    ],
  },
  'HCM-DT-003': {
    vi: [
      'Mặt đứng kiến trúc tân cổ điển vàng kem và đồng hồ Bưu điện Trung tâm Sài Gòn',
      'Không gian đại sảnh vòm thép Gustave Eiffel bên trong Bưu điện Sài Gòn',
    ],
    en: [
      'Neoclassical ochre exterior facade of Saigon Central Post Office',
      'Vaulted iron-frame interior concourse designed with Gustave Eiffel trusses',
    ],
    zh: [
      '西贡中心邮局新古典主义外立面与中央时钟',
      '西贡中心邮局内部古斯塔夫·埃菲尔铁艺拱顶大厅',
    ],
  },
  'HCM-DT-004': {
    vi: [
      'Toàn cảnh mặt tiền tháp đồng hồ Cửa Nam — biểu tượng Chợ Bến Thành',
      'Không gian kiến trúc mái cao và giao thương truyền thống bên trong Chợ Bến Thành',
    ],
    en: [
      'South Gate clock tower exterior facade of historic Ben Thanh Market',
      'Interior structural bays and traditional market architecture of Ben Thanh',
    ],
    zh: [
      '滨城市场南门钟楼经典立面全景',
      '滨城市场高挑屋架内部空间与传统市集建筑风貌',
    ],
  },
  'HCM-DT-005': {
    vi: [
      'Toàn cảnh kiến trúc gạch trần Toulouse Nhà thờ Chính tòa Đức Bà Sài Gòn',
      'Cận cảnh đôi tháp chuông Roman-Gothic vươn cao tại Công xã Paris',
    ],
    en: [
      'Toulouse red-brick exterior of Notre-Dame Cathedral Basilica of Saigon',
      'Twin Romanesque-Gothic bell towers rising over Cong Xa Paris Square',
    ],
    zh: [
      '西贡圣母大教堂图卢兹红砖建筑外景全貌',
      '西贡圣母大教堂双座罗马-哥特式钟楼近景特写',
    ],
  },
  'HCM-DT-006': {
    vi: [
      'Toàn cảnh mặt tiền tháp bát giác Đông Dương Bảo tàng Lịch sử TP.HCM',
      'Không gian sân vườn cổ thụ và trưng bày cổ vật Champa bên trong bảo tàng',
    ],
    en: [
      'Indochine octagonal pavilion exterior of the Museum of Vietnamese History',
      'Courtyard garden architecture and Champa sandstone galleries inside the museum',
    ],
    zh: [
      '胡志明市历史博物馆印支风格八角楼外立面全景',
      '历史博物馆庭院建筑与占婆砂岩文物展陈空间',
    ],
  },
  'HCM-DT-007': {
    vi: [
      'Toàn cảnh di tích Bến Nhà Rồng — Bảo tàng Hồ Chí Minh tại ngã ba sông',
      'Kiến trúc mái ngói âm dương với cặp Lưỡng Long chầu nguyệt ven sông Sài Gòn',
    ],
    en: [
      'Exterior view of Nha Rong Wharf (Dragon House) at the Saigon River confluence',
      'Waterfront colonial facade crowned by traditional twin dragon roof finials',
    ],
    zh: [
      '西贡河口芽龙港（胡志明博物馆）历史建筑全景',
      '临江法式柱廊与屋顶双龙朝月传统脊饰细部',
    ],
  },
  'HCM-DT-008': {
    vi: [
      'Cổng tam quan uy nghi tại khu di tích Lăng Ông Bà Chiểu (Lăng Tả quân)',
      'Cận cảnh mái ngói khảm sành sứ tinh xảo và điện thờ Lăng Ông Bà Chiểu',
    ],
    en: [
      'Ceremonial triple gate entrance at the Tomb of Marshal Le Van Duyet',
      'Intricate ceramic-mosaic roof ridges and temple courtyard of Lang Ong Ba Chieu',
    ],
    zh: [
      '黎文悦陵（嘉定翁陵）庄严三门牌坊正面全景',
      '黎文悦陵嵌瓷屋脊与传统祠堂建筑细节',
    ],
  },
  'HCM-DT-009': {
    vi: [
      'Toàn cảnh khu rừng di tích và cửa hầm bí mật Địa đạo Củ Chi',
      'Không gian địa đạo lòng đất và công sự chiến đấu tại Củ Chi',
    ],
    en: [
      'Camouflaged forest entrance hatch to the subterranean Cu Chi Tunnels',
      'Underground bunker gallery and historic wartime earthworks at Cu Chi',
    ],
    zh: [
      '古芝地道林间伪装入口与地表遗址区全景',
      '古芝地道地下掩体与抗战地道内部结构实景',
    ],
  },
  'HCM-DT-010': {
    vi: [
      'Cảnh quan vùng giồng cát rừng ngập mặn Cần Giờ quanh di chỉ Giồng Cá Vồ',
      'Hiện vật khảo cổ tiền Óc Eo — tư liệu khai quật từ khu mộ chum Cần Giờ',
    ],
    en: [
      'Coastal mangrove mound landscape surrounding Giong Ca Vo in Can Gio',
      'Prehistoric Oc Eo period artifacts preserved from southern coastal excavations',
    ],
    zh: [
      '芹苴红树林沙丘湿地——永嘉波考古遗址周边生态风貌',
      '南部沿海遗址出土的早期奥埃文化珍贵文物展品',
    ],
  },
  'HCM-DT-011': {
    vi: [
      'Cổng tam quan và mặt tiền cổ tự Chùa Giác Lâm (khởi dựng 1744)',
      'Kiến trúc Bảo tháp Xá Lợi 7 tầng và mái ngói truyền thống Chùa Giác Lâm',
    ],
    en: [
      'Historic entrance gate and grounds of Giac Lam Pagoda (est. 1744)',
      'Seven-tier Relics Stupa and timber temple roofs of Giac Lam Pagoda',
    ],
    zh: [
      '觉林寺三门山门与古刹正面全景（始建于1744年）',
      '觉林寺七层舍利宝塔与传统瓦顶建筑特写',
    ],
  },
  'HCM-DT-012': {
    vi: [
      'Toàn cảnh mặt tiền Hội quán Nghĩa An (Chùa Ông) tại khu Chợ Lớn',
      'Cận cảnh kiến trúc bờ nóc khảm gốm sứ Triều Châu và không gian nội tự',
    ],
    en: [
      'Main ceremonial hall facade of Nghia An Assembly Hall in historic Cholon',
      'Porcelain-mosaic Teochew roof craftsmanship and interior altar sanctuary',
    ],
    zh: [
      '堤岸义安会馆（关帝庙）传统建筑正立面全景',
      '义安会馆精致潮州嵌瓷屋脊与内部雕梁殿堂细部',
    ],
  },
  'BRVT-DT-001': {
    vi: [
      'Toàn cảnh ngoại thất biệt thự Bạch Dinh (Dinh Bảo Đại) trên sườn Núi Lớn',
      'Chi tiết ban công vòm cung kiểu Pháp và hành lang hướng vịnh Bãi Trước',
    ],
    en: [
      'Exterior view of Villa Blanche (Bach Dinh / White Palace) on Big Mountain',
      'Arched colonial veranda and balcony architecture overlooking Vung Tau Bay',
    ],
    zh: [
      '头顿大山白宫（保大行宫）法式外立面全景',
      '白宫经典法式拱券阳台与眺望前滩海湾走廊细节',
    ],
  },
  'BRVT-DT-002': {
    vi: [
      'Quần thể kiến trúc gỗ truyền thống Đền Ông Trần tại Nhà Lớn Long Sơn',
      'Không gian đảo Long Sơn và quần thể đình đài cổ kính Bà Rịa - Vũng Tàu',
    ],
    en: [
      'Traditional Southern wooden architectural complex of Nha Lon Long Son',
      'Historic island landscape and communal wooden pavilions of Long Son',
    ],
    zh: [
      '龙山岛大屋（翁陈庙）南部传统木构建筑群全景',
      '巴地头顿龙山岛传统亭台院落与海岛风貌',
    ],
  },
  'BRVT-DT-003': {
    vi: [
      'Di tích lịch sử cách mạng miền Đông tại vùng đất Bà Rịa - Vũng Tàu',
      'Cảnh quan vùng đất Long Phước — Bà Rịa gắn với hệ thống địa đạo kháng chiến',
    ],
    en: [
      'Revolutionary historical monument landscape in Ba Ria - Vung Tau',
      'Subterranean resistance base terrain of Long Phuoc in Ba Ria - Vung Tau',
    ],
    zh: [
      '巴地头顿省革命历史遗迹与纪念地标全景',
      '巴地龙福抗战地道遗址周边红土与生态地理景观',
    ],
  },
  'BD-DT-001': {
    vi: [
      'Di sản kiến trúc truyền thống vùng Thủ Dầu Một, Bình Dương',
      'Cảnh quan đô thị di sản Thủ Dầu Một — không gian gắn với Nhà cổ Trần Công Vàng',
    ],
    en: [
      'Traditional Southern architectural heritage in historic Thu Dau Mot, Binh Duong',
      'Historic urban landscape of Thu Dau Mot surrounding the Tran Cong Vang House',
    ],
    zh: [
      '平阳省土龙木地区传统东方木构建筑遗产风貌',
      '土龙木历史城区风貌——陈公黄古宅所在地标区域',
    ],
  },
  'BD-DT-002': {
    vi: [
      'Di tích lịch sử kháng chiến tiêu biểu tại tỉnh Bình Dương',
      'Tư liệu thực địa chiến khu Tam Giác Sắt — Tây Nam Bến Cát, Bình Dương',
    ],
    en: [
      'Preserved wartime historical memorial architecture in Binh Duong Province',
      'Historical archival field view of the Iron Triangle sector in Ben Cat, Binh Duong',
    ],
    zh: [
      '平阳省抗战历史纪念遗迹主体建筑实景',
      '平阳省槟吉“铁三角”地下抗战战区历史档案影像',
    ],
  },
};
