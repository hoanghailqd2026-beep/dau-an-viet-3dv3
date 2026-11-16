import React, { useEffect, useMemo, useState } from 'react';
import { HeritageSite } from '../../types/heritage';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import {
  FEEDBACK_HIGHLIGHT_TAGS,
  REVIEWS_UPDATED_EVENT,
  VisitorReviewRecord,
  checkAndRecordSubmissionRate,
  enrichVisitorReviewWithGeminiReply,
  listVisitorReviews,
  submitVisitorReview,
} from '../../utils/adminPlatformStore';
import {
  X,
  Star,
  Sparkles,
  CheckCircle2,
  Send,
  Landmark,
  MessageSquareHeart,
  ShieldCheck,
} from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: HeritageSite[];
  defaultSiteId?: string;
}

const STAR_LABELS: Record<1 | 2 | 3 | 4 | 5, { vi: string; en: string; zh: string }> = {
  1: { vi: 'Cần cải thiện', en: 'Needs improvement', zh: '需要改进' },
  2: { vi: 'Tạm ổn', en: 'Fair', zh: '一般' },
  3: { vi: 'Hài lòng', en: 'Satisfied', zh: '满意' },
  4: { vi: 'Rất tốt', en: 'Very good', zh: '很好' },
  5: { vi: 'Trải nghiệm xuất sắc', en: 'Outstanding experience', zh: '卓越体验' },
};

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  sites,
  defaultSiteId,
}) => {
  const { lang, getLocalizedSite } = useI18n();
  const { user } = useAuth();

  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([FEEDBACK_HIGHLIGHT_TAGS[0]]);
  const [favoriteSiteId, setFavoriteSiteId] = useState<string>(
    defaultSiteId || sites[0]?.id || 'HCM-DT-001'
  );
  const [comment, setComment] = useState<string>('');
  const [submittedReview, setSubmittedReview] = useState<VisitorReviewRecord | null>(null);
  const [myReviews, setMyReviews] = useState<VisitorReviewRecord[]>([]);
  const [spamError, setSpamError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (defaultSiteId && sites.some((s) => s.id === defaultSiteId)) {
      setFavoriteSiteId(defaultSiteId);
    } else if (!sites.some((s) => s.id === favoriteSiteId) && sites[0]) {
      setFavoriteSiteId(sites[0].id);
    }
  }, [isOpen, defaultSiteId, sites, favoriteSiteId]);

  useEffect(() => {
    setSubmittedReview(null);
    setComment('');
    setSpamError(null);
  }, [user?.userId]);

  useEffect(() => {
    if (!isOpen || !user) return;
    const syncMyReviews = () => {
      const all = listVisitorReviews();
      setMyReviews(all.filter((r) => r.userId === user.userId));
    };
    syncMyReviews();
    window.addEventListener(REVIEWS_UPDATED_EVENT, syncMyReviews);
    return () => window.removeEventListener(REVIEWS_UPDATED_EVENT, syncMyReviews);
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const activeStarValue = (hoverRating ?? rating) as 1 | 2 | 3 | 4 | 5;
  const starLabel = STAR_LABELS[activeStarValue][lang];

  const favoriteSiteObj = useMemo(
    () => sites.find((s) => s.id === favoriteSiteId) || sites[0],
    [sites, favoriteSiteId]
  );

  if (!isOpen || !user) return null;

  const accountChannelDisplay =
    user.authMethod === 'judge_quick_access'
      ? 'Google · Ban Giám Khảo (Demo)'
      : user.email
      ? `${user.provider === 'google' ? 'Google' : 'Facebook'} · ${user.email}`
      : `${user.provider === 'google' ? 'Google' : 'Facebook'} · ${user.displayName}`;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSpamError(null);
    const rate = checkAndRecordSubmissionRate('feedback', accountChannelDisplay);
    if (!rate.allowed) {
      setSpamError(
        rate.threatLevel === 2
          ? `Lá chắn An ninh Mức 2: Phát hiện gửi đánh giá dồn dập bất thường. AI đã bật Lá chắn Bảo vệ Khẩn cấp, tạm khóa ${rate.retryAfterSec} giây và gửi email báo động tới Quản trị viên.`
          : `Lá chắn chống Spam Mức 1: Bạn đang gửi đánh giá quá nhanh liên tiếp. Hệ thống đã lọc spam, tạm khóa ${rate.retryAfterSec} giây và gửi báo cáo tới Quản trị viên.`
      );
      return;
    }
    const localizedFav = favoriteSiteObj ? getLocalizedSite(favoriteSiteObj) : null;
    const created = submitVisitorReview({
      userId: user.userId,
      visitorName: user.displayName,
      provider: user.provider,
      contactDisplay: accountChannelDisplay,
      rating,
      tags: selectedTags,
      favoriteSiteId: favoriteSiteObj?.id || favoriteSiteId,
      favoriteSiteName:
        localizedFav?.officialName || favoriteSiteObj?.officialName || 'Dinh Độc Lập',
      comment:
        comment.trim() ||
        (selectedTags.length > 0
          ? `Ấn tượng với ${selectedTags.join(', ')}.`
          : STAR_LABELS[rating].vi),
    });
    setSubmittedReview(created);
    setComment('');
    void enrichVisitorReviewWithGeminiReply(created.id).then((updated) => {
      if (updated) {
        setSubmittedReview(updated);
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Đánh giá trải nghiệm sau tham quan"
      onClick={onClose}
      className="fixed inset-0 z-[1220] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-2xl overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-[28px] bg-[#141417]/98 border border-white/[0.14] shadow-[0_32px_100px_rgba(0,0,0,0.92)] overflow-hidden text-[#F5F5F7] animate-apple-sheet my-auto"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] bg-gradient-to-r from-[#1D1A13] via-[#17171B] to-[#141417] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C5A059]">
              <MessageSquareHeart className="w-3.5 h-3.5 shrink-0" />
              <span>Đánh giá Trải nghiệm Du khách · Dấu Ấn Việt 3D</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-semibold text-[#F5F5F7] tracking-tight mt-1">
              {submittedReview
                ? 'Cảm ơn bạn đã gửi đánh giá!'
                : 'Đánh giá Trải nghiệm Dấu Ấn Việt 3D'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại đánh giá"
            className="w-8 h-8 rounded-full bg-white/[0.07] hover:bg-white/[0.15] text-[#8E8E93] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto modal-scrollbar">
          {/* Authenticated Reviewer Identity Bar */}
          <div className="rounded-2xl bg-black/45 border border-white/[0.08] px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  user.role === 'admin'
                    ? 'bg-[#C5A059] text-black'
                    : 'bg-[#0071E3] text-white'
                }`}
              >
                {user.avatarInitials}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#F5F5F7] truncate">
                  {user.displayName}
                </div>
                <div className="text-[11px] font-sans text-[#86868B] truncate">
                  {accountChannelDisplay}
                </div>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0 ${
                user.provider === 'google'
                  ? 'bg-white/10 text-white'
                  : 'bg-[#1877F2]/25 text-[#60A5FA]'
              }`}
            >
              {user.provider === 'google' ? 'Google' : 'Facebook'}
            </span>
          </div>

          {submittedReview ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#C5A059]/55 bg-gradient-to-br from-[#231D12] via-[#171614] to-[#121215] p-5 space-y-3">
                <div className="flex items-center gap-2.5 text-emerald-300 text-sm font-semibold">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>Đánh giá của bạn đã được đồng bộ trực tiếp về Ban Quản lý (Admin Studio)</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= submittedReview.rating
                            ? 'text-[#C5A059] fill-[#C5A059]'
                            : 'text-white/20'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium text-[#C5A059]">
                    {STAR_LABELS[submittedReview.rating].vi}
                  </span>
                  <span className="text-[11px] font-sans tabular-nums text-[#86868B]">
                    · {new Date(submittedReview.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                <div className="text-xs text-[#D1D1D6]">
                  Di tích yêu thích: <strong className="text-[#F5F5F7]">{submittedReview.favoriteSiteName}</strong>
                </div>
                {submittedReview.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {submittedReview.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-full bg-[#C5A059]/15 border border-[#C5A059]/40 text-[11px] text-[#E8CA68]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs sm:text-sm text-[#F5F5F7]/90 leading-relaxed bg-black/35 rounded-xl p-3 border border-white/[0.06]">
                  “{submittedReview.comment}”
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSubmittedReview(null)}
                  className="px-4 py-2.5 rounded-full bg-white/[0.07] hover:bg-white/[0.14] text-xs font-medium text-[#F5F5F7] cursor-pointer transition-colors"
                >
                  Gửi thêm đánh giá khác
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-full bg-[#C5A059] hover:bg-[#D4B06A] text-black text-xs font-bold cursor-pointer transition-colors"
                >
                  Quay lại tham quan
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 1. Star Rating 1-5 */}
              <div className="rounded-2xl bg-black/35 border border-white/[0.08] p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-[#C5A059]">
                    1. Mức độ hài lòng tổng thể
                  </label>
                  <span className="px-3 py-1 rounded-full bg-[#C5A059]/18 border border-[#C5A059]/45 text-xs font-semibold text-[#E8CA68] transition-all">
                    {activeStarValue}★ · {starLabel}
                  </span>
                </div>

                <div
                  className="flex items-center justify-center sm:justify-start gap-2.5 py-1"
                  onMouseLeave={() => setHoverRating(null)}
                >
                  {([1, 2, 3, 4, 5] as const).map((star) => {
                    const isFilled = star <= activeStarValue;
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onClick={() => setRating(star)}
                        aria-label={`Chấm ${star} sao — ${STAR_LABELS[star].vi}`}
                        className={`p-2 rounded-2xl border transition-all duration-200 cursor-pointer ${
                          isFilled
                            ? 'bg-[#C5A059]/18 border-[#C5A059]/65 scale-105 shadow-[0_0_20px_rgba(197,160,89,0.22)]'
                            : 'bg-white/[0.03] border-white/[0.08] hover:border-white/25'
                        }`}
                      >
                        <Star
                          className={`w-7 h-7 sm:w-8 sm:h-8 transition-transform duration-200 ${
                            isFilled
                              ? 'text-[#C5A059] fill-[#C5A059]'
                              : 'text-[#636366]'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Multi-select Highlight Tags */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-[#A1A1A6]">
                  2. Điểm bạn ấn tượng nhất (Có thể chọn nhiều)
                </label>
                <div className="flex flex-wrap gap-2">
                  {FEEDBACK_HIGHLIGHT_TAGS.map((tag) => {
                    const active = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-3.5 py-2 rounded-full text-xs font-medium border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                          active
                            ? 'bg-[#C5A059] text-black border-[#C5A059] font-semibold shadow-sm'
                            : 'bg-white/[0.04] text-[#D1D1D6] border-white/[0.1] hover:border-[#C5A059]/50 hover:text-white'
                        }`}
                      >
                        <Sparkles className={`w-3 h-3 ${active ? 'text-black' : 'text-[#C5A059]'}`} />
                        <span>{tag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Favorite Heritage Site */}
              <div className="space-y-2">
                <label
                  htmlFor="feedback-favorite-site"
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#A1A1A6]"
                >
                  <Landmark className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>3. Di tích bạn yêu thích nhất ({sites.length} di tích)</span>
                </label>
                <select
                  id="feedback-favorite-site"
                  value={favoriteSiteId}
                  onChange={(e) => setFavoriteSiteId(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-black/60 border border-white/[0.14] text-xs sm:text-sm text-[#F5F5F7] focus:border-[#C5A059] focus:outline-none cursor-pointer"
                >
                  {sites.map((site, idx) => {
                    const loc = getLocalizedSite(site);
                    return (
                      <option key={site.id} value={site.id}>
                        {String(idx + 1).padStart(2, '0')}. {loc.officialName} ({site.address.district})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 4. Detailed Comment */}
              <div className="space-y-2">
                <label
                  htmlFor="feedback-comment-input"
                  className="block text-xs font-semibold text-[#A1A1A6]"
                >
                  4. Nhận xét &amp; góp ý chi tiết của bạn
                </label>
                <textarea
                  id="feedback-comment-input"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Chia sẻ cảm nhận về mô hình 3D, bản đồ cổ 1815, thuyết minh AI hoặc đề xuất cải thiện cho Ban Quản lý..."
                  className="w-full p-3.5 rounded-2xl bg-black/55 border border-white/[0.12] text-xs sm:text-sm text-[#F5F5F7] placeholder:text-[#636366] focus:border-[#C5A059] focus:outline-none resize-none"
                />
              </div>

              {spamError && (
                <div className="rounded-xl bg-[#FF453A]/15 border border-[#FF453A]/45 px-3.5 py-2.5 text-xs text-[#FF8A80]">
                  {spamError}
                </div>
              )}

              <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] text-[#86868B] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                  <span>Đồng bộ trực tiếp về Admin Studio</span>
                </span>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-full bg-[#C5A059] hover:bg-[#D4B06A] text-black text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-all shadow-lg"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi đánh giá về Ban Quản lý</span>
                </button>
              </div>
            </form>
          )}

          {/* Previous Reviews Submitted by this Visitor (including Admin Replies!) */}
          {myReviews.length > 0 && (
            <div className="pt-4 border-t border-white/[0.08] space-y-3">
              <div className="text-xs font-medium text-[#86868B]">
                Lịch sử đánh giá của bạn ({myReviews.length})
              </div>
              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 modal-scrollbar">
                {myReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3.5 rounded-2xl bg-black/40 border border-white/[0.07] space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3 h-3 ${
                              s <= rev.rating
                                ? 'text-[#C5A059] fill-[#C5A059]'
                                : 'text-white/15'
                            }`}
                          />
                        ))}
                        <span className="text-[11px] font-medium text-[#E5E5EA] ml-1">
                          {rev.favoriteSiteName}
                        </span>
                      </div>
                      <span className="text-[11px] font-sans tabular-nums text-[#636366]">
                        {new Date(rev.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <p className="text-xs text-[#D1D1D6]">{rev.comment}</p>
                    {rev.adminReply && (
                      <div className="p-2.5 rounded-xl bg-[#C5A059]/10 border border-[#C5A059]/35 text-xs space-y-1">
                        <div className="text-[11px] font-sans text-[#C5A059] font-semibold">
                          Phản hồi từ Ban Quản lý Bảo tàng Số
                        </div>
                        <div className="text-[#F5EFE6]">{rev.adminReply}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
