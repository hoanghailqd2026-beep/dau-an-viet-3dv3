import { TourRoute } from '../types/heritage';

export const TOUR_ROUTES: TourRoute[] = [
  {
    id: 'TOUR-01',
    title: 'Tuyến 01 — Trái tim Di sản Sài Gòn (Quận 1)',
    subtitle: 'Dinh Độc Lập → Nhà thờ Đức Bà → Bưu điện Trung tâm → Nhà hát Thành phố → Chợ Bến Thành → Bến Nhà Rồng',
    theme: 'Kiến trúc Đô thị & Lịch sử Trung tâm',
    estimatedDuration: '3.5 giờ (Đi bộ & Xe điện)',
    distanceKm: 4.5,
    sites: [
      'HCM-DT-001', // Dinh Độc Lập
      'HCM-DT-005', // Nhà thờ Đức Bà
      'HCM-DT-003', // Bưu điện Trung tâm Sài Gòn
      'HCM-DT-002', // Nhà hát Thành phố
      'HCM-DT-004', // Chợ Bến Thành
      'HCM-DT-007', // Bến Nhà Rồng
    ],
    description:
      'Hành trình liền mạch ngay trong lòng Quận 1 kết nối 6 biểu tượng kiến trúc và lịch sử bậc nhất Sài Gòn: từ Dinh Độc Lập hiện đại nhiệt đới, cụm kiến trúc Pháp Công trường Công xã Paris đến Chợ Bến Thành và Bến Nhà Rồng bên sông Sài Gòn.',
    highlights: [
      'Chiêm ngưỡng mặt tiền rèm hoa đá đốt trúc của KTS. Ngô Viết Thụ tại Dinh Độc Lập',
      'Cụm di sản gạch đỏ Toulouse Nhà thờ Đức Bà và vòm sắt Gustave Eiffel tại Bưu điện Trung tâm',
      'Mặt đứng Beaux-Arts Nhà hát Thành phố, tháp đồng hồ Chợ Bến Thành và Bến Nhà Rồng lịch sử',
    ],
  },
  {
    id: 'TOUR-02',
    title: 'Tuyến 02 — Ký ức Chợ Lớn & Cổ tự Gia Định',
    subtitle: 'Hội quán Nghĩa An → Chùa Giác Lâm → Lăng Tả quân Lê Văn Duyệt',
    theme: 'Di sản Tín ngưỡng & Gia Định Xưa',
    estimatedDuration: '4 giờ',
    distanceKm: 11.2,
    sites: [
      'HCM-DT-012', // Hội quán Nghĩa An
      'HCM-DT-011', // Chùa Giác Lâm
      'HCM-DT-008', // Lăng Tả quân Lê Văn Duyệt
    ],
    description:
      'Cung đường văn hóa – tín ngưỡng xuôi từ thương cảng Chợ Lớn qua Tân Bình tới vùng đất Gia Định xưa: khám phá nghệ thuật chạm gỗ sơn son thếp vàng Triều Châu tại Hội quán Nghĩa An, Tổ đình Giác Lâm (1744) và nghệ thuật khảm sành sứ tại Lăng Ông Bà Chiểu.',
    highlights: [
      'Nghệ thuật điêu khắc gỗ thếp vàng và gốm mai hoa tại Hội quán Nghĩa An (Quận 5)',
      'Kiến trúc chữ Tam và 113 pho tượng gỗ mít cổ tại Chùa Giác Lâm (1744)',
      'Quần thể Tam quan – Bình phong – Điện thờ khảm sành sứ tại Lăng Tả quân Lê Văn Duyệt',
    ],
  },
  {
    id: 'TOUR-03',
    title: 'Tuyến 03 — Vành đai Đất Thép & Chiến khu Miền Đông',
    subtitle: 'Địa đạo Củ Chi → Địa đạo Tam Giác Sắt (Bến Cát)',
    theme: 'Quân sự Ngầm & Chiến khu Cách mạng',
    estimatedDuration: '6 giờ (Liên vùng Tây Bắc)',
    distanceKm: 14.5,
    sites: [
      'HCM-DT-009', // Địa đạo Củ Chi
      'BD-DT-002',  // Địa đạo Tam Giác Sắt - Tây Nam Bến Cát
    ],
    description:
      'Tuyến chuyên đề liền mạch hai bờ sông Sài Gòn kết nối hai hệ thống địa đạo huyền thoại nằm trên tầng địa chất đất sét pha đá ong: từ Địa đạo Củ Chi (TP.HCM) vượt sông sang Địa đạo Tam Giác Sắt – Tây Nam Bến Cát (Bình Dương).',
    highlights: [
      'Giải phẫu mặt cắt 3 tầng ngầm (3m – 6m – 10m) và Bếp Hoàng Cầm tại Địa đạo Củ Chi',
      'Kết nối trục chiến lược vượt sông Sài Gòn tới cụm địa đạo 3 xã An Tây – An Điền – Phú An (Bến Cát)',
      'Đối sánh kỹ thuật thông hơi ngụy trang và hầm chữ A trong tầng đất laterite tự nhiên',
    ],
  },
  {
    id: 'TOUR-04',
    title: 'Tuyến 04 — Di sản Kiến trúc Gỗ Bình Dương',
    subtitle: 'Nhà cổ Trần Công Vàng (Thủ Dầu Một) → Địa đạo Tam Giác Sắt',
    theme: 'Kiến trúc Gỗ Cổ truyền & Đất Thủ',
    estimatedDuration: '5 giờ',
    distanceKm: 21.0,
    sites: [
      'BD-DT-001', // Nhà cổ Trần Công Vàng
      'BD-DT-002', // Địa đạo Tam Giác Sắt
    ],
    description:
      'Hành trình khám phá tinh hoa vùng đất Thủ Dầu Một – Bến Cát (Bình Dương): khởi đầu tại kiệt tác nhà rường chữ Đinh 64 cột gỗ quý Trần Công Vàng (1889–1892) và kết nối lên chiến khu Tây Nam Bến Cát.',
    highlights: [
      'Chiêm ngưỡng kết cấu mộng chốt 64 cột gỗ căm xe và bao lam chạm lộng Tứ linh tại Nhà cổ Trần Công Vàng',
      'Tìm hiểu nghệ thuật chạm khắc gỗ Thủ Dầu Một giao hòa lịch sử khẩn hoang miền Đông',
      'Khảo sát mạng lưới địa đạo Tam Giác Sắt bên hữu ngạn sông Sài Gòn',
    ],
  },
  {
    id: 'TOUR-05',
    title: 'Tuyến 05 — Hành trình Biển Đảo & Núi Lớn Vũng Tàu',
    subtitle: 'Bạch Dinh → Nhà Lớn Long Sơn → Địa đạo Long Phước',
    theme: 'Di sản Biển Đảo & Bà Rịa - Vũng Tàu',
    estimatedDuration: '1 ngày (7 giờ)',
    distanceKm: 31.5,
    sites: [
      'BRVT-DT-001', // Bạch Dinh - Villa Blanche
      'BRVT-DT-002', // Quần thể kiến trúc Nhà Lớn Long Sơn
      'BRVT-DT-003', // Khu di tích Địa đạo Long Phước
    ],
    description:
      'Cung đường ven biển liên hoàn tại tỉnh Bà Rịa - Vũng Tàu: từ dinh thự Tân Cổ điển Bạch Dinh trên sườn Núi Lớn nhìn ra Bãi Trước, qua đảo Long Sơn thăm quần thể Nhà Lớn bằng gỗ mộng cổ truyền, và tiếp nối về Địa đạo Long Phước tại Bà Rịa.',
    highlights: [
      'Bạch Dinh (Villa Blanche 1898) với phù điêu gốm men cổ điển và bộ sưu tập gốm Hòn Cau',
      'Quần thể Nhà Lớn Long Sơn rộng 2ha bằng gỗ quý lắp ghép mộng chốt hoàn toàn không đinh sắt',
      'Hệ thống đường hầm xương cá và công sự chiến đấu liên ấp tại Địa đạo Long Phước',
    ],
  },
  {
    id: 'TOUR-06',
    title: 'Tuyến 06 — Khảo cổ & Rừng ngập mặn Cần Giờ',
    subtitle: 'Khu Di tích Khảo cổ học Giồng Cá Vồ',
    theme: 'Khảo cổ học Tiền sử & Sinh quyển',
    estimatedDuration: '4.5 giờ (Sinh thái & Khảo cổ)',
    distanceKm: 2.5,
    sites: [
      'HCM-DT-010', // Khu Di tích Khảo cổ học Giồng Cá Vồ
    ],
    description:
      'Chuyến khảo sát chuyên sâu về cội nguồn cư dân tiền – sơ sử vùng cửa biển Đông Nam Bộ tại Khu Di tích Khảo cổ học Giồng Cá Vồ (niên đại ~2.500 năm) nằm giữa Khu Dự trữ Sinh quyển Rừng ngập mặn Cần Giờ.',
    highlights: [
      'Khảo sát địa tầng mộ chum gốm nguyên thủy và di cốt cư dân cảng thị cổ cách đây 2.500 năm',
      'Ngắm hiện vật khuyên tai hai đầu thú bằng đá ngọc nephrite – dấu tích giao thương biển Đông',
      'Trải nghiệm tuyến đường thủy qua vùng lõi rừng đước Cần Giờ',
    ],
  },
  {
    id: 'TOUR-07',
    title: 'Tuyến 07 — Hành trình Xuyên Vùng Đông Nam Bộ',
    subtitle: 'Dinh Độc Lập → Địa đạo Củ Chi → Nhà cổ Trần Công Vàng → Bạch Dinh',
    theme: 'Hành trình Liên vùng TP.HCM – Bình Dương – Bà Rịa Vũng Tàu',
    estimatedDuration: '1–2 ngày (Liên vùng 3 địa phương)',
    distanceKm: 204.0,
    sites: [
      'HCM-DT-001', // 01. Dinh Độc Lập (TP.HCM)
      'HCM-DT-009', // 06. Địa đạo Củ Chi (TP.HCM)
      'BD-DT-001',  // Nhà cổ Trần Công Vàng (Bình Dương)
      'BRVT-DT-001', // Bạch Dinh - Villa Blanche (Bà Rịa - Vũng Tàu)
    ],
    description:
      'Tuyến di sản trục xương sống kết nối 4 công trình biểu tượng của cả 3 địa phương Đông Nam Bộ: từ Dinh Độc Lập (trung tâm TP.HCM), ngược lên vùng đất thép Địa đạo Củ Chi, sang kiệt tác nhà gỗ 64 cột Trần Công Vàng tại Thủ Dầu Một (Bình Dương) và xuôi về Bạch Dinh hướng biển tại TP. Vũng Tàu.',
    highlights: [
      'Kết nối trọn vẹn 3 vùng di sản TP. Hồ Chí Minh – Bình Dương – Bà Rịa Vũng Tàu trên một trục GIS liên hoàn',
      'Đối sánh kiến trúc Hiện đại Nhiệt đới Dinh Độc Lập, địa đạo 3 tầng Củ Chi và nhà rường gỗ cổ truyền Bình Dương',
      'Khép lại hành trình tại dinh thự Tân Cổ điển Bạch Dinh trên sườn Núi Lớn nhìn ra Bãi Trước Vũng Tàu',
    ],
  },
];
