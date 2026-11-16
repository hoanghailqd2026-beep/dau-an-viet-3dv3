import React, { useState, useRef, useEffect } from 'react';
import { HeritageSite } from '../../types/heritage';
import { useI18n } from '../../i18n/I18nContext';
import {
  CustomPhotosMap,
  PhotoSlotIndex,
  WIKIMEDIA_SITE_CONFIG,
  compressImageFileToDataUrl,
  fetchWikipediaPhotoForSite,
  getDefaultSitePhotoCaption,
  getSitePhotoCaption,
  getSitePhotoCaptionOverride,
  removeSitePhotoCaptionOverrides,
  resolveSitePhotoSlots,
  saveSitePhotoCaptionsBulk,
  useHeritageRealPhotos,
} from '../../utils/wikimediaPhotoService';
import { HeritageTypographicPlate } from '../common/HeritageTypographicPlate';
import { HeritageSmoothImage } from '../common/HeritageSmoothImage';
import {
  Camera,
  Upload,
  Link2,
  RotateCcw,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface CustomPhotoManagerModalProps {
  site: HeritageSite;
  hasCustomPhoto: boolean;
  customPhotosMap?: CustomPhotosMap;
  onClose: () => void;
  onSaveCustomPhoto: (siteId: string, photoDataOrUrl: string, slot?: PhotoSlotIndex) => void;
  onRestoreDefaultPhoto: (siteId: string, slot?: PhotoSlotIndex) => void;
  onRestoreAllDefaultPhotos?: () => void;
}

export const CustomPhotoManagerModal: React.FC<CustomPhotoManagerModalProps> = ({
  site,
  customPhotosMap: propCustomPhotosMap,
  onClose,
  onSaveCustomPhoto,
  onRestoreDefaultPhoto,
  onRestoreAllDefaultPhotos,
}) => {
  const { lang, getLocalizedSite } = useI18n();
  const locSite = getLocalizedSite(site);
  const wikiConfig = WIKIMEDIA_SITE_CONFIG[site.id];
  const { customPhotosMap: liveCustomMap, wikimediaCacheMap } = useHeritageRealPhotos();
  const effectiveCustomMap = propCustomPhotosMap ?? liveCustomMap;

  const [activeSlot, setActiveSlot] = useState<PhotoSlotIndex>(0);
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [captionVi, setCaptionVi] = useState<string>('');
  const [captionEn, setCaptionEn] = useState<string>('');
  const [captionZh, setCaptionZh] = useState<string>('');
  const [previewFailed, setPreviewFailed] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isFetchingWiki, setIsFetchingWiki] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const slotInfo = resolveSitePhotoSlots(site.id, effectiveCustomMap, wikimediaCacheMap);
  const activePreviewPhoto = slotInfo.slots[activeSlot] || '';
  const activeSource = slotInfo.sources[activeSlot];
  const activeCustomUrl = slotInfo.customUrls[activeSlot];
  const activeCaption = getSitePhotoCaption(site, activeSlot, lang);

  useEffect(() => {
    setActiveSlot(0);
    setPreviewFailed(false);
    setStatusMessage(null);
  }, [site.id]);

  useEffect(() => {
    setImageUrlInput(activeCustomUrl || '');
    setCaptionVi(
      getSitePhotoCaptionOverride(site.id, activeSlot, 'vi') ||
        getDefaultSitePhotoCaption(site, activeSlot, 'vi')
    );
    setCaptionEn(
      getSitePhotoCaptionOverride(site.id, activeSlot, 'en') ||
        getDefaultSitePhotoCaption(site, activeSlot, 'en')
    );
    setCaptionZh(
      getSitePhotoCaptionOverride(site.id, activeSlot, 'zh') ||
        getDefaultSitePhotoCaption(site, activeSlot, 'zh')
    );
    setPreviewFailed(false);
  }, [site, activeSlot, activeCustomUrl]);

  const slotHumanLabel = (slot: PhotoSlotIndex) =>
    lang === 'en'
      ? `Photo 0${slot + 1}`
      : lang === 'zh'
      ? `照片 0${slot + 1}`
      : `Ảnh 0${slot + 1}`;

  const slotRoleLabel = (slot: PhotoSlotIndex) =>
    slot === 0
      ? lang === 'en'
        ? 'Architectural Overview'
        : lang === 'zh'
        ? '建筑立面全景'
        : 'Toàn cảnh kiến trúc'
      : lang === 'en'
      ? 'Interior / Detail View'
      : lang === 'zh'
      ? '内部档案 / 建筑特写'
      : 'Góc nhìn tư liệu / Cận cảnh';

  const commitCaptionsForActiveSlot = (showSuccessToast: boolean) => {
    const defVi = getDefaultSitePhotoCaption(site, activeSlot, 'vi').trim();
    const defEn = getDefaultSitePhotoCaption(site, activeSlot, 'en').trim();
    const defZh = getDefaultSitePhotoCaption(site, activeSlot, 'zh').trim();

    saveSitePhotoCaptionsBulk(site.id, activeSlot, {
      vi: captionVi.trim() === defVi ? '' : captionVi.trim(),
      en: captionEn.trim() === defEn ? '' : captionEn.trim(),
      zh: captionZh.trim() === defZh ? '' : captionZh.trim(),
    });

    if (showSuccessToast) {
      setStatusMessage({
        type: 'success',
        text:
          lang === 'en'
            ? `Saved VI/EN/ZH captions for ${slotHumanLabel(activeSlot)}.`
            : lang === 'zh'
            ? `已保存${slotHumanLabel(activeSlot)}的越/英/中三语图注。`
            : `Đã lưu & đồng bộ chú thích VI/EN/ZH cho ${slotHumanLabel(activeSlot)}.`,
      });
    }
  };

  const handleResetCaptions = () => {
    removeSitePhotoCaptionOverrides(site.id, activeSlot);
    setCaptionVi(getDefaultSitePhotoCaption(site, activeSlot, 'vi'));
    setCaptionEn(getDefaultSitePhotoCaption(site, activeSlot, 'en'));
    setCaptionZh(getDefaultSitePhotoCaption(site, activeSlot, 'zh'));
    setStatusMessage({
      type: 'success',
      text:
        lang === 'en'
          ? `Reset ${slotHumanLabel(activeSlot)} captions to archive defaults.`
          : lang === 'zh'
          ? `已将${slotHumanLabel(activeSlot)}图注恢复为档案默认说明。`
          : `Đã khôi phục chú thích mặc định cho ${slotHumanLabel(activeSlot)}.`,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatusMessage({
        type: 'error',
        text:
          lang === 'en'
            ? 'Please select a valid image file (.JPG, .PNG, .WEBP).'
            : lang === 'zh'
            ? '请选择有效的图片文件（.JPG, .PNG, .WEBP）。'
            : 'Vui lòng chọn tệp hình ảnh hợp lệ (.JPG, .PNG, .WEBP).',
      });
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 1600, 0.88);
      setPreviewFailed(false);
      onSaveCustomPhoto(site.id, dataUrl, activeSlot);
      setStatusMessage({
        type: 'success',
        text:
          lang === 'en'
            ? `Uploaded & synced ${slotHumanLabel(activeSlot)} across all views.`
            : lang === 'zh'
            ? `已上传并同步${slotHumanLabel(activeSlot)}至全站。`
            : `Đã tải lên & đồng bộ ${slotHumanLabel(activeSlot)} trên toàn hệ thống.`,
      });
    } catch {
      setStatusMessage({
        type: 'error',
        text:
          lang === 'en'
            ? 'Failed to process image file.'
            : lang === 'zh'
            ? '无法处理所选图片文件。'
            : 'Không thể xử lý tệp ảnh vừa chọn.',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    if (
      !trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('data:image/')
    ) {
      setStatusMessage({
        type: 'error',
        text:
          lang === 'en'
            ? 'Please enter a valid http:// or https:// image URL.'
            : lang === 'zh'
            ? '请输入有效的 https:// 或 http:// 图片链接。'
            : 'Vui lòng nhập đường dẫn URL ảnh hợp lệ bắt đầu bằng https:// hoặc http://',
      });
      return;
    }

    setPreviewFailed(false);
    onSaveCustomPhoto(site.id, trimmed, activeSlot);
    setStatusMessage({
      type: 'success',
      text:
        lang === 'en'
          ? `Saved & synced ${slotHumanLabel(activeSlot)} URL.`
          : lang === 'zh'
          ? `已保存并同步${slotHumanLabel(activeSlot)}链接。`
          : `Đã lưu & đồng bộ liên kết ${slotHumanLabel(activeSlot)} lên hệ thống.`,
    });
  };

  const handleFetchFromWikimediaApi = async () => {
    setIsFetchingWiki(true);
    setStatusMessage(null);
    try {
      const apiPhoto = await fetchWikipediaPhotoForSite(site.id, activeSlot);
      if (apiPhoto) {
        setPreviewFailed(false);
        setStatusMessage({
          type: 'success',
          text:
            lang === 'en'
              ? `Refreshed ${slotHumanLabel(activeSlot)} in HD from Wikimedia Commons API.`
              : lang === 'zh'
              ? `已从 Wikimedia Commons API 刷新${slotHumanLabel(activeSlot)}高清图片。`
              : `Đã tải lại ${slotHumanLabel(activeSlot)} độ phân giải cao từ Wikimedia Commons.`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text:
            lang === 'en'
              ? 'Could not retrieve image from Wikimedia Commons API right now.'
              : lang === 'zh'
              ? '暂无法从 Wikimedia Commons API 获取新图片，请稍后重试。'
              : 'Chưa lấy được ảnh mới từ Wikimedia Commons API, vui lòng thử lại sau.',
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text:
          lang === 'en'
            ? 'Connection error to Wikimedia Commons API.'
            : lang === 'zh'
            ? 'Wikimedia Commons API 连接失败。'
            : 'Lỗi kết nối tới Wikimedia Commons API.',
      });
    } finally {
      setIsFetchingWiki(false);
    }
  };

  const handleRestoreDefault = () => {
    onRestoreDefaultPhoto(site.id, activeSlot);
    setImageUrlInput('');
    setPreviewFailed(false);
    setStatusMessage({
      type: 'success',
      text:
        lang === 'en'
          ? `Restored ${slotHumanLabel(activeSlot)} to original Wikimedia Commons photo.`
          : lang === 'zh'
          ? `已将${slotHumanLabel(activeSlot)}恢复为 Wikimedia Commons 原图。`
          : `Đã khôi phục ${slotHumanLabel(activeSlot)} về ảnh gốc Wikimedia Commons.`,
    });
  };

  const handleSaveAndClose = () => {
    commitCaptionsForActiveSlot(false);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        lang === 'en'
          ? `Manage 2 Real Photos: ${locSite.officialName}`
          : lang === 'zh'
          ? `管理 2 张实景图片：${locSite.officialName}`
          : `Quản lý 2 Ảnh Thực Tế Di Tích: ${locSite.officialName}`
      }
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center p-2 sm:p-4 bg-[#171817]/75 backdrop-blur-sm overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[94vw] md:w-full max-w-4xl max-h-[88dvh] overflow-y-auto bg-[#F4EFE6] border border-[#171817]/20 rounded-sm shadow-2xl p-4 md:p-6 text-[#171817] my-auto modal-scrollbar"
        style={{ borderTop: '4px solid #A94F3D' }}
      >
        {/* Editorial Museum Archive Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#171817]/15">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-[#A94F3D]">
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span>
                {lang === 'en'
                  ? 'ARCHIVE PHOTOGRAPHY CURATION · WIKIMEDIA COMMONS'
                  : lang === 'zh'
                  ? '馆藏实景影像管理 · WIKIMEDIA COMMONS'
                  : 'QUẢN LÝ TƯ LIỆU HÌNH ẢNH · WIKIMEDIA COMMONS'}
              </span>
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#171817] leading-snug break-words">
              {locSite.officialName}
            </h3>
            <div className="flex flex-wrap items-center gap-2 font-sans text-xs text-[#171817]/70 tabular-nums">
              <span className="px-2 py-0.5 rounded-sm bg-[#171817] text-[#C9A46A] font-semibold">
                {site.identifierCode}
              </span>
              <span>
                {lang === 'en'
                  ? 'Dual 1600px landscape archive frames (16:9)'
                  : lang === 'zh'
                  ? '双幅 1600px 横向档案馆藏图框（16:9）'
                  : 'Cặp tư liệu ảnh ngang chuẩn bảo tàng (1600px · 16:9)'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'en' ? 'Close' : lang === 'zh' ? '关闭' : 'Đóng'}
            className="w-9 h-9 rounded-sm border border-[#171817]/25 bg-[#F4EFE6] hover:bg-[#171817] text-[#171817] hover:text-[#D8C9A9] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slot Tabs (2 Cards · No Text Truncation) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-5">
          {([0, 1] as const).map((slotIdx) => {
            const isSelected = activeSlot === slotIdx;
            const thumbUrl = slotInfo.slots[slotIdx] || '';
            const srcTag = slotInfo.sources[slotIdx];
            return (
              <button
                key={slotIdx}
                type="button"
                onClick={() => {
                  commitCaptionsForActiveSlot(false);
                  setActiveSlot(slotIdx);
                }}
                className={`p-3 rounded-sm border text-left flex items-center gap-3 transition-colors cursor-pointer min-w-0 ${
                  isSelected
                    ? 'bg-[#171817] text-[#D8C9A9] border-[#C9A46A]'
                    : 'bg-[#EDE4D0] text-[#171817] border-[#171817]/20 hover:border-[#171817]/50'
                }`}
              >
                <div className="w-14 h-10 rounded-sm overflow-hidden border border-[#C9A46A]/40 bg-[#171817] shrink-0 flex items-center justify-center">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={slotHumanLabel(slotIdx)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="w-4 h-4 text-[#C9A46A]" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="font-sans text-xs font-bold">
                      {slotHumanLabel(slotIdx)}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-sm text-[10px] font-semibold uppercase tracking-wide ${
                        srcTag === 'custom'
                          ? 'bg-[#A94F3D] text-[#D8C9A9]'
                          : srcTag === 'wikimedia'
                          ? 'bg-[#47796D] text-[#D8C9A9]'
                          : 'bg-[#171817]/20 text-current'
                      }`}
                    >
                      {srcTag === 'custom'
                        ? 'Admin URL'
                        : srcTag === 'wikimedia'
                        ? 'Wikimedia HD'
                        : 'Pending'}
                    </span>
                  </div>
                  <div
                    className={`text-[11px] leading-snug break-words ${
                      isSelected ? 'text-[#D8C9A9]/80' : 'text-[#171817]/75'
                    }`}
                  >
                    {slotRoleLabel(slotIdx)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`mb-4 px-3.5 py-2.5 rounded-sm border font-sans text-xs flex items-center gap-2 break-words ${
              statusMessage.type === 'success'
                ? 'bg-[#47796D]/15 border-[#47796D] text-[#171817]'
                : 'bg-[#A94F3D]/15 border-[#A94F3D] text-[#A94F3D]'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-[#47796D] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#A94F3D] shrink-0" />
            )}
            <span className="font-medium leading-relaxed">{statusMessage.text}</span>
          </div>
        )}

        {/* Main 12-Column Editorial Workspace */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start text-left">
          {/* Left 7 Cols: High-Res 16:9 Preview + Upload Dropzone */}
          <div className="md:col-span-7 space-y-4 min-w-0">
            <div className="relative aspect-video w-full bg-[#171817] border border-[#171817]/25 rounded-sm overflow-hidden">
              {activePreviewPhoto && !previewFailed ? (
                <HeritageSmoothImage
                  src={activePreviewPhoto}
                  alt={activeCaption}
                  waitTone="dark"
                  onError={() => setPreviewFailed(true)}
                  className="w-full h-full object-cover contrast-[1.04]"
                />
              ) : (
                <HeritageTypographicPlate site={site} variant="catalog" />
              )}
              <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-sm bg-[#171817]/90 border border-[#C9A46A]/60 font-sans text-[11px] font-semibold text-[#D8C9A9]">
                {activeSource === 'custom' && activePreviewPhoto && !previewFailed
                  ? lang === 'en'
                    ? `Admin Archive · 0${activeSlot + 1}`
                    : lang === 'zh'
                    ? `管理员自定义 · 0${activeSlot + 1}`
                    : `Ảnh Admin · Vị trí 0${activeSlot + 1}`
                  : activeSource === 'wikimedia' && activePreviewPhoto && !previewFailed
                  ? lang === 'en'
                    ? `Wikimedia HD · 0${activeSlot + 1}`
                    : lang === 'zh'
                    ? `Wikimedia 高清 · 0${activeSlot + 1}`
                    : `Wikimedia HD · Vị trí 0${activeSlot + 1}`
                  : lang === 'en'
                  ? 'Typographic Archive Plate'
                  : lang === 'zh'
                  ? '馆藏文字底版'
                  : 'Bảng tư liệu mặc định'}
              </div>
            </div>

            {/* Active Caption Preview & Search Hint */}
            <div className="p-3.5 rounded-sm bg-[#EDE4D0] border border-[#171817]/15 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-[#A94F3D]">
                <span>
                  {site.identifierCode} · {slotHumanLabel(activeSlot)}
                </span>
                {wikiConfig && (
                  <span className="font-sans font-normal text-[#171817]/70 break-all">
                    Commons: {(activeSlot === 0 ? wikiConfig.photo1Queries[0] : wikiConfig.photo2Queries[0]) || wikiConfig.searchQueries[0]}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#171817]/85 leading-relaxed break-words">
                {activeCaption}
              </p>
            </div>

            {/* Upload Local File */}
            <div className="p-4 rounded-sm border border-dashed border-[#171817]/35 bg-[#EDE4D0]/75 space-y-3">
              <div className="flex items-start gap-2 text-xs font-semibold text-[#171817]">
                <Upload className="w-4 h-4 text-[#A94F3D] shrink-0 mt-0.5" />
                <span className="leading-snug break-words">
                  {lang === 'en'
                    ? `Upload ${slotHumanLabel(activeSlot)} from device (.JPG, .PNG, .WEBP · Auto-scaled up to 1600px)`
                    : lang === 'zh'
                    ? `从本地设备上传${slotHumanLabel(activeSlot)}（.JPG / .PNG / .WEBP · 自动优化至 1600px）`
                    : `Tải lên ${slotHumanLabel(activeSlot)} từ máy tính (.JPG, .PNG, .WEBP · Tự động chuẩn hóa 1600px)`}
                </span>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id={`custom-photo-upload-${site.id}-${activeSlot}`}
                />
                <label
                  htmlFor={`custom-photo-upload-${site.id}-${activeSlot}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-[#171817] hover:bg-[#A94F3D] text-[#D8C9A9] font-sans text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isUploading
                      ? lang === 'en'
                        ? 'Processing Image...'
                        : lang === 'zh'
                        ? '正在处理图片...'
                        : 'Đang xử lý ảnh...'
                      : lang === 'en'
                      ? 'Choose Photo From Computer'
                      : lang === 'zh'
                      ? '从本地选择实景照片'
                      : 'Chọn ảnh chụp thật từ máy tính'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Caption Editor (VI/EN/ZH) + URL Input + Action Buttons */}
          <div className="md:col-span-5 min-w-0 flex flex-col justify-between space-y-4 break-words">
            {/* Editorial Caption Editor */}
            <div className="p-4 rounded-sm bg-[#EDE4D0] border border-[#171817]/15 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans text-xs font-bold text-[#171817] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#A94F3D] shrink-0" />
                  <span>
                    {lang === 'en'
                      ? `Curatorial Captions · ${slotHumanLabel(activeSlot)}`
                      : lang === 'zh'
                      ? `多语种档案图注 · ${slotHumanLabel(activeSlot)}`
                      : `Chú thích ảnh · ${slotHumanLabel(activeSlot)}`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleResetCaptions}
                  className="text-[11px] font-medium text-[#526D8B] hover:text-[#A94F3D] underline underline-offset-2 cursor-pointer"
                >
                  {lang === 'en' ? 'Default' : lang === 'zh' ? '默认' : 'Mặc định'}
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label
                    htmlFor={`caption-vi-${site.id}-${activeSlot}`}
                    className="block text-[11px] font-semibold text-[#171817]/75"
                  >
                    Tiếng Việt (VI)
                  </label>
                  <textarea
                    id={`caption-vi-${site.id}-${activeSlot}`}
                    rows={2}
                    value={captionVi}
                    onChange={(e) => setCaptionVi(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-sm bg-[#F4EFE6] border border-[#171817]/20 focus:border-[#A94F3D] text-xs text-[#171817] leading-relaxed focus:outline-none resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor={`caption-en-${site.id}-${activeSlot}`}
                    className="block text-[11px] font-semibold text-[#171817]/75"
                  >
                    English (EN)
                  </label>
                  <textarea
                    id={`caption-en-${site.id}-${activeSlot}`}
                    rows={2}
                    value={captionEn}
                    onChange={(e) => setCaptionEn(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-sm bg-[#F4EFE6] border border-[#171817]/20 focus:border-[#A94F3D] text-xs text-[#171817] leading-relaxed focus:outline-none resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor={`caption-zh-${site.id}-${activeSlot}`}
                    className="block text-[11px] font-semibold text-[#171817]/75"
                  >
                    中文 (ZH)
                  </label>
                  <textarea
                    id={`caption-zh-${site.id}-${activeSlot}`}
                    rows={2}
                    value={captionZh}
                    onChange={(e) => setCaptionZh(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-sm bg-[#F4EFE6] border border-[#171817]/20 focus:border-[#A94F3D] text-xs text-[#171817] leading-relaxed focus:outline-none resize-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => commitCaptionsForActiveSlot(true)}
                  className="w-full py-2 px-3 rounded-sm bg-[#47796D] hover:bg-[#3A645A] text-[#D8C9A9] text-xs font-semibold transition-colors cursor-pointer"
                >
                  {lang === 'en'
                    ? 'Save VI / EN / ZH Captions'
                    : lang === 'zh'
                    ? '保存三语图注'
                    : 'Lưu chú thích VI / EN / ZH'}
                </button>
              </div>
            </div>

            {/* External URL Paste Box */}
            <form
              onSubmit={handleApplyUrl}
              className="p-4 rounded-sm bg-[#EDE4D0] border border-[#171817]/15 space-y-2.5"
            >
              <label
                htmlFor={`photo-url-input-${site.id}-${activeSlot}`}
                className="font-sans text-xs font-bold text-[#526D8B] flex items-center gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {lang === 'en'
                    ? `Paste HD Photo URL (${slotHumanLabel(activeSlot)})`
                    : lang === 'zh'
                    ? `粘贴高清实景链接（${slotHumanLabel(activeSlot)}）`
                    : `Dán đường dẫn ảnh thực tế (${slotHumanLabel(activeSlot)})`}
                </span>
              </label>

              <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch gap-2">
                <input
                  id={`photo-url-input-${site.id}-${activeSlot}`}
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://upload.wikimedia.org/wikipedia/commons/..."
                  className="flex-1 min-w-0 px-3 py-2 rounded-sm bg-[#F4EFE6] border border-[#171817]/20 focus:border-[#A94F3D] text-xs text-[#171817] placeholder-[#171817]/45 focus:outline-none font-sans"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-sm bg-[#171817] hover:bg-[#526D8B] text-[#D8C9A9] font-sans text-xs font-semibold transition-colors cursor-pointer shrink-0"
                >
                  {lang === 'en' ? 'Apply' : lang === 'zh' ? '应用' : 'Áp dụng'}
                </button>
              </div>
            </form>

            {/* Quick Wikimedia Refresh & Slot Reset */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleFetchFromWikimediaApi}
                disabled={isFetchingWiki}
                className="w-full px-3.5 py-2 rounded-sm border border-[#47796D] bg-[#47796D] hover:bg-[#3A645A] text-[#D8C9A9] font-sans text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isFetchingWiki ? 'animate-spin' : ''}`} />
                <span>
                  {lang === 'en'
                    ? 'Fetch HD Photo from Wikimedia'
                    : lang === 'zh'
                    ? '从 Wikimedia 重新获取高清图'
                    : 'Tải lại ảnh HD từ Wikimedia'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleRestoreDefault}
                className="w-full px-3.5 py-2 rounded-sm border border-[#171817]/25 bg-[#F4EFE6] hover:border-[#A94F3D] text-[#171817] hover:text-[#A94F3D] font-sans text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {lang === 'en'
                    ? 'Restore Original Photo for This Slot'
                    : lang === 'zh'
                    ? '恢复此槽位 Wikimedia 原图'
                    : 'Khôi phục ảnh gốc vị trí này'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-[#171817]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {onRestoreAllDefaultPhotos ? (
            <button
              type="button"
              onClick={() => {
                onRestoreAllDefaultPhotos();
                setImageUrlInput('');
                setPreviewFailed(false);
                setStatusMessage({
                  type: 'success',
                  text:
                    lang === 'en'
                      ? 'Restored all 17 monuments to original Wikimedia Commons HD photos.'
                      : lang === 'zh'
                      ? '已将全部 17 处遗迹恢复为 Wikimedia Commons 高清原图。'
                      : 'Đã khôi phục toàn bộ 17 di tích về ảnh gốc Wikimedia Commons.',
                });
              }}
              className="font-sans text-xs text-[#171817]/75 hover:text-[#A94F3D] underline underline-offset-4 cursor-pointer text-left"
            >
              {lang === 'en'
                ? 'Restore all 17 monuments to original Wikimedia photos'
                : lang === 'zh'
                ? '将全部 17 处遗迹恢复为 Wikimedia 原图'
                : 'Khôi phục toàn bộ 17 di tích về ảnh gốc Wikimedia'}
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-5 py-2.5 rounded-sm bg-[#171817] hover:bg-[#A94F3D] text-[#D8C9A9] font-sans text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            {lang === 'en'
              ? 'Save Changes & Close'
              : lang === 'zh'
              ? '保存更改并关闭'
              : 'Lưu thay đổi & Đóng'}
          </button>
        </div>
      </div>
    </div>
  );
};
