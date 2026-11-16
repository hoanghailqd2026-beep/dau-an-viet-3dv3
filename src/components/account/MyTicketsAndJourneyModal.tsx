import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { HeritageSite } from '../../types/heritage';
import { TOUR_ROUTES } from '../../data/tours';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import {
  IssuedPassRecord,
  PASSES_UPDATED_EVENT,
  RegisteredVisitorRecord,
  VISITORS_UPDATED_EVENT,
  buildAccountTransferCode,
  fetchUsersFromCloudApi,
  getUserIssuedPasses,
  getVisitorRecord,
} from '../../utils/adminPlatformStore';
import {
  X,
  Ticket,
  Compass,
  Box,
  Route,
  CheckCircle2,
  ArrowUpRight,
  ShieldCheck,
  QrCode,
  Copy,
  Smartphone,
} from 'lucide-react';

interface MyTicketsAndJourneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: HeritageSite[];
  onOpen3D: (site: HeritageSite) => void;
  onOpenMapRoutes: () => void;
  onGoToTickets: () => void;
}

export const MyTicketsAndJourneyModal: React.FC<MyTicketsAndJourneyModalProps> = ({
  isOpen,
  onClose,
  sites,
  onOpen3D,
  onOpenMapRoutes,
  onGoToTickets,
}) => {
  const { lang, getLocalizedSite, getLocalizedTour } = useI18n();
  const { user, isAdmin, isTesterPro, userTier } = useAuth();

  const [passes, setPasses] = useState<IssuedPassRecord[]>(() =>
    getUserIssuedPasses(user?.userId, user?.email)
  );
  const [visitorRecord, setVisitorRecord] = useState<RegisteredVisitorRecord | null>(() =>
    getVisitorRecord(user?.userId)
  );
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [transferCodeCopied, setTransferCodeCopied] = useState(false);
  const [generatedTransferCode, setGeneratedTransferCode] = useState<string>('');

  useEffect(() => {
    setPasses(getUserIssuedPasses(user?.userId, user?.email));
    setVisitorRecord(getVisitorRecord(user?.userId));
    setQrMap({});
    setTransferCodeCopied(false);
    setGeneratedTransferCode('');
  }, [user?.userId, user?.email]);

  useEffect(() => {
    if (!isOpen) return;
    const syncPasses = () => setPasses(getUserIssuedPasses(user?.userId, user?.email));
    const syncVisitor = () => setVisitorRecord(getVisitorRecord(user?.userId));
    syncPasses();
    syncVisitor();
    void fetchUsersFromCloudApi().then(() => {
      syncPasses();
      syncVisitor();
    });
    window.addEventListener(PASSES_UPDATED_EVENT, syncPasses);
    window.addEventListener(VISITORS_UPDATED_EVENT, syncVisitor);
    return () => {
      window.removeEventListener(PASSES_UPDATED_EVENT, syncPasses);
      window.removeEventListener(VISITORS_UPDATED_EVENT, syncVisitor);
    };
  }, [isOpen, user?.userId, user?.email]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const myPasses = useMemo(() => {
    if (!user) return [];
    return passes;
  }, [passes, user]);

  useEffect(() => {
    if (!isOpen || myPasses.length === 0) return;
    let cancelled = false;
    const generateAll = async () => {
      const next: Record<string, string> = {};
      for (const pass of myPasses) {
        try {
          const payload = JSON.stringify({
            app: 'DAU-AN-VIET-3D',
            code: pass.code,
            holder: pass.ownerName,
            contact: pass.ownerContactMasked,
            route: pass.routeTitle || pass.label,
            status: pass.status,
            issuedAt: pass.issuedAt,
          });
          next[pass.id] = await QRCode.toDataURL(payload, {
            width: 180,
            margin: 1,
            color: { dark: '#171817', light: '#F4EFE4' },
          });
        } catch {
          // ignore QR generation failure
        }
      }
      if (!cancelled) {
        setQrMap(next);
      }
    };
    void generateAll();
    return () => {
      cancelled = true;
    };
  }, [isOpen, myPasses]);

  if (!isOpen || !user) return null;

  const exploredIds = visitorRecord?.exploredSiteIds || [];
  const completedRouteIds = visitorRecord?.completedRouteIds || [];
  const exploredSites = sites.filter((s) => exploredIds.includes(s.id));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'en' ? 'My Tickets & Journey' : lang === 'zh' ? '我的门票与行程' : 'Vé & Hành trình của tôi'}
      onClick={onClose}
      className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-4 bg-[#171817]/80"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[94vw] sm:w-full max-w-4xl max-h-[88dvh] bg-[#D8C9A9] border border-[#171817]/25 rounded-sm flex flex-col overflow-hidden text-[#171817] animate-apple-sheet"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#171817]/20 bg-[#EDE3CE] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-[#C9A46A] text-[#171817] border border-[#171817]/20">
              {user.avatarInitials}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#A94F3D]">
                {lang === 'en'
                  ? 'Personal Heritage Account'
                  : lang === 'zh'
                  ? '个人遗产护照与行程记录'
                  : 'Hồ sơ du khách · Đồng bộ Admin Studio'}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <h2 className="text-base sm:text-xl font-serif font-semibold text-[#171817] truncate">
                  {lang === 'en'
                    ? `My Tickets & Journey — ${user.displayName}`
                    : lang === 'zh'
                    ? `我的门票与探索历程 — ${user.displayName}`
                    : `Vé & Hành trình của tôi — ${user.displayName}`}
                </h2>
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
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'en' ? 'Close' : lang === 'zh' ? '关闭' : 'Đóng'}
            className="w-8 h-8 rounded-sm bg-[#D8C9A9] hover:bg-[#A94F3D] text-[#171817] hover:text-[#D8C9A9] border border-[#171817]/20 flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto modal-scrollbar p-5 sm:p-6 space-y-6 bg-[#D8C9A9]">
          {/* Account Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-sm bg-[#EDE3CE] border border-[#171817]/18 space-y-1">
              <span className="text-xs font-medium text-[#171817]/75">
                Vé &amp; Chứng nhận đã lưu
              </span>
              <div className="text-2xl font-serif font-semibold text-[#A94F3D] tabular-nums">
                {myPasses.length}
              </div>
              <div className="text-[11px] text-[#171817]/70 truncate">
                {user.authMethod === 'judge_quick_access'
                  ? 'Chế độ Ban Giám Khảo'
                  : `${user.provider === 'google' ? 'Google' : 'Facebook'}${user.email ? ` · ${user.email}` : ''}`}
              </div>
            </div>

            <div className="p-4 rounded-sm bg-[#EDE3CE] border border-[#171817]/18 space-y-1">
              <span className="text-xs font-medium text-[#171817]/75">
                Mô hình 3D đã tham quan
              </span>
              <div className="text-2xl font-serif font-semibold text-[#171817] tabular-nums">
                {exploredSites.length} / {sites.length}
              </div>
              <div className="h-1.5 rounded-sm bg-[#171817]/15 overflow-hidden mt-1">
                <div
                  className="h-full bg-[#526D8B] transition-all"
                  style={{
                    width: `${Math.round((exploredSites.length / Math.max(1, sites.length)) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="p-4 rounded-sm bg-[#EDE3CE] border border-[#171817]/18 space-y-1">
              <span className="text-xs font-medium text-[#171817]/75">
                Tuyến di sản đã hoàn thành
              </span>
              <div className="text-2xl font-serif font-semibold text-[#47796D] tabular-nums">
                {completedRouteIds.length} / {TOUR_ROUTES.length}
              </div>
              <div className="h-1.5 rounded-sm bg-[#171817]/15 overflow-hidden mt-1">
                <div
                  className="h-full bg-[#47796D] transition-all"
                  style={{
                    width: `${Math.round((completedRouteIds.length / TOUR_ROUTES.length) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* SECTION: CROSS-DEVICE ACCOUNT SYNC CODE (DAV3D-...) */}
          <section className="rounded-sm bg-[#EDE3CE] border border-[#171817]/18 p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-sm bg-[#C9A46A] border border-[#171817]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Smartphone className="w-4 h-4 text-[#171817]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-serif font-semibold text-[#171817]">
                    {lang === 'en'
                      ? 'Cross-Device Account Sync Code'
                      : lang === 'zh'
                      ? '跨设备账户同步码'
                      : 'Mã Đồng Bộ Tài Khoản Liên Thiết Bị'}
                  </h3>
                  <p className="text-xs text-[#171817]/75 leading-relaxed mt-0.5">
                    {lang === 'en'
                      ? 'Export a portable DAV3D- code containing your tier badge (Plus/Pro), QR tickets, certificates, and exploration progress.'
                      : lang === 'zh'
                      ? '将您的账户等级（Plus/Pro）、二维码门票、证书与探索进度打包为 DAV3D- 同步码，立即恢复到其他设备。'
                      : 'Đóng gói toàn bộ hồ sơ, hạng tài khoản (Plus/Pro), vé QR, chứng nhận và tiến độ tham quan thành mã DAV3D- để kích hoạt trên thiết bị khác.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const code = buildAccountTransferCode({
                    id: user.id,
                    userId: user.userId,
                    provider: user.provider,
                    email: user.email,
                    displayName: user.displayName,
                    role: user.role,
                    isPrimaryAdmin: user.isPrimaryAdmin,
                    authMethod: user.authMethod,
                  });
                  setGeneratedTransferCode(code);
                  try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      await navigator.clipboard.writeText(code);
                    }
                  } catch {
                    // fallback code box stays visible below
                  }
                  setTransferCodeCopied(true);
                  window.setTimeout(() => setTransferCodeCopied(false), 4000);
                }}
                className="px-4 py-2 rounded-sm bg-[#171817] hover:bg-[#A94F3D] text-[#D8C9A9] text-xs font-semibold inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-colors"
              >
                {transferCodeCopied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'en'
                        ? 'Sync Code Copied'
                        : lang === 'zh'
                        ? '已复制同步码'
                        : 'Đã sao chép Mã Đồng Bộ'}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'en'
                        ? 'Generate & Copy Sync Code'
                        : lang === 'zh'
                        ? '生成并复制同步码'
                        : 'Tạo & Sao chép Mã Đồng Bộ'}
                    </span>
                  </>
                )}
              </button>
            </div>

            {generatedTransferCode && (
              <div className="pt-2 border-t border-[#171817]/15 space-y-1.5">
                <div className="text-[11px] text-[#171817]/75">
                  {lang === 'en' ? (
                    <>Paste the code below into <strong className="text-[#171817]">Restore via Sync Code</strong> on your phone or another browser:</>
                  ) : lang === 'zh' ? (
                    <>将下方同步码粘贴至新设备登录窗口的 <strong className="text-[#171817]">通过同步码恢复</strong> 栏位：</>
                  ) : (
                    <>Dán chuỗi mã bên dưới vào mục <strong className="text-[#171817]">Khôi phục bằng Mã Đồng Bộ</strong> tại cổng Đăng nhập trên thiết bị mới:</>
                  )}
                </div>
                <input
                  type="text"
                  readOnly
                  value={generatedTransferCode}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={lang === 'en' ? 'Cross-device account sync code' : lang === 'zh' ? '跨设备账户同步码' : 'Mã Đồng Bộ Tài Khoản Liên Thiết Bị'}
                  className="w-full px-3 py-2 rounded-sm bg-[#F4EFE4] border border-[#171817]/20 font-sans text-xs tabular-nums text-[#171817] focus:outline-none focus:border-[#A94F3D]"
                />
              </div>
            )}
          </section>

          {/* SECTION 1: MY QR TICKETS & CERTIFICATES */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-[#A94F3D]" />
                <h3 className="text-sm font-serif font-semibold text-[#171817]">
                  Vé Tham Quan QR &amp; Chứng Nhận Đã Cấp ({myPasses.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoToTickets();
                }}
                className="px-3.5 py-1.5 rounded-sm bg-[#A94F3D] hover:bg-[#8E3F30] text-[#D8C9A9] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Mua thêm vé</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {myPasses.length === 0 ? (
              <div className="rounded-sm border border-dashed border-[#171817]/25 bg-[#EDE3CE] p-6 text-center space-y-3">
                <QrCode className="w-8 h-8 text-[#A94F3D] mx-auto" />
                <p className="text-xs sm:text-sm text-[#171817]/80">
                  Tài khoản của bạn chưa có vé tham quan hoặc chứng nhận nào. Đặt vé trong mục{' '}
                  <strong className="text-[#171817]">Vé &amp; Học liệu</strong> để nhận mã QR định danh riêng.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onGoToTickets();
                  }}
                  className="px-5 py-2 rounded-sm bg-[#171817] hover:bg-[#A94F3D] text-[#D8C9A9] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Đặt vé &amp; Nhận mã QR ngay
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {myPasses.map((pass) => (
                  <div
                    key={pass.id}
                    className="rounded-sm bg-[#EDE3CE] border border-[#171817]/20 p-4 flex items-center gap-4"
                  >
                    <div className="w-24 h-24 rounded-sm bg-[#F4EFE4] p-1.5 border border-[#C9A46A] shrink-0 flex items-center justify-center overflow-hidden">
                      {qrMap[pass.id] ? (
                        <img
                          src={qrMap[pass.id]}
                          alt={`QR ${pass.code}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <QrCode className="w-14 h-14 text-[#171817]" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-sans font-bold tabular-nums text-[#A94F3D]">
                          {pass.code}
                        </span>
                        <span className="text-[#171817]/40">·</span>
                        <span
                          className={`text-[11px] font-semibold ${
                            pass.status === 'verified'
                              ? 'text-[#47796D]'
                              : pass.status === 'revoked'
                              ? 'text-[#A94F3D]'
                              : 'text-[#526D8B]'
                          }`}
                        >
                          {pass.status === 'verified'
                            ? '✓ Đã xác thực'
                            : pass.status === 'revoked'
                            ? '✕ Đã thu hồi'
                            : 'Đang hiệu lực'}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-[#171817] line-clamp-1">
                        {pass.routeTitle || pass.label}
                      </div>

                      <div className="text-[11px] text-[#171817]/75 truncate">
                        Chủ vé: <strong className="text-[#171817]">{pass.ownerName}</strong> ({pass.ownerContactMasked})
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px] font-sans tabular-nums text-[#171817]/70 pt-0.5">
                        <span className="text-[#A94F3D] font-semibold">{pass.amountLabel}</span>
                        <span>{new Date(pass.issuedAt).toLocaleString('vi-VN')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SECTION 2: 3D MODELS EXPLORED */}
          <section className="space-y-3 pt-4 border-t border-[#171817]/18">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-[#526D8B]" />
                <h3 className="text-sm font-serif font-semibold text-[#171817]">
                  Nhật ký Tham quan 17 Mô hình 3D ({exploredSites.length}/{sites.length})
                </h3>
              </div>
              <span className="text-[11px] font-sans text-[#171817]/70 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#47796D]" />
                <span>Tự động ghi nhận</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sites.map((site) => {
                const visited = exploredIds.includes(site.id);
                const loc = getLocalizedSite(site);
                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpen3D(site);
                    }}
                    className={`p-3 rounded-sm border text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      visited
                        ? 'bg-[#47796D]/15 border-[#47796D] hover:bg-[#47796D]/25'
                        : 'bg-[#EDE3CE] border-[#171817]/18 hover:border-[#171817]/45'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-sans tabular-nums text-[#171817]/65">{site.id}</div>
                      <div className="text-xs font-medium text-[#171817] truncate">
                        {loc.officialName}
                      </div>
                    </div>
                    {visited ? (
                      <CheckCircle2 className="w-4 h-4 text-[#47796D] shrink-0" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#171817]/60 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* SECTION 3: COMPLETED TOUR ROUTES */}
          <section className="space-y-3 pt-4 border-t border-[#171817]/18">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-[#47796D]" />
                <h3 className="text-sm font-serif font-semibold text-[#171817]">
                  Tuyến Di sản Liên vùng ({completedRouteIds.length}/{TOUR_ROUTES.length} hoàn thành)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMapRoutes();
                }}
                className="text-xs font-semibold text-[#A94F3D] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Mở Bản đồ &amp; Tuyến</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TOUR_ROUTES.map((tour) => {
                const done = completedRouteIds.includes(tour.id);
                const locTour = getLocalizedTour(tour);
                return (
                  <div
                    key={tour.id}
                    className={`p-3.5 rounded-sm border flex items-center justify-between gap-3 ${
                      done
                        ? 'bg-[#47796D]/15 border-[#47796D]'
                        : 'bg-[#EDE3CE] border-[#171817]/18'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#171817] truncate">
                        {locTour.title}
                      </div>
                      <div className="text-[11px] font-sans text-[#171817]/70 mt-0.5 tabular-nums">
                        {tour.sites.length} trạm · ~{tour.distanceKm} km
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-sans font-semibold shrink-0 ${
                        done ? 'text-[#47796D]' : 'text-[#171817]/60'
                      }`}
                    >
                      {done ? '✓ Hoàn thành' : 'Chưa xong'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
