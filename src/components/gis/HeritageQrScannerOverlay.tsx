import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Camera,
  Upload,
  QrCode,
  X,
  CheckCircle2,
  AlertCircle,
  Volume2,
  FileText,
  Download,
  ScanLine,
  RefreshCw,
  Search,
  ChevronRight,
} from 'lucide-react';
import { HeritageSite } from '../../types/heritage';
import { useI18n } from '../../i18n/I18nContext';
import { HeritageTypographicPlate } from '../common/HeritageTypographicPlate';
import { HeritageSmoothImage } from '../common/HeritageSmoothImage';
import {
  buildHeritagePlaqueQrPayload,
  decodeQrFromFile,
  decodeQrFromImageData,
  decodeQrFromImageElement,
  resolveHeritageSiteFromQrPayload,
} from '../../utils/heritageQrPlaque';

export type QrScannerMode = 'camera' | 'upload' | 'plaque';

interface HeritageQrScannerOverlayProps {
  isOpen: boolean;
  sites: HeritageSite[];
  initialSelectedSite?: HeritageSite | null;
  onClose: () => void;
  onScanMatched: (site: HeritageSite) => void;
}

export const HeritageQrScannerOverlay: React.FC<HeritageQrScannerOverlayProps> = ({
  isOpen,
  sites,
  initialSelectedSite,
  onClose,
  onScanMatched,
}) => {
  const { lang, formatDistrictName, getLocalizedSite } = useI18n();

  const [scannerMode, setScannerMode] = useState<QrScannerMode>('camera');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraStatus, setCameraStatus] = useState<
    'idle' | 'starting' | 'active' | 'denied' | 'unavailable' | 'error'
  >('idle');
  const [cameraResolution, setCameraResolution] = useState<string>('');
  const [lastRawDecoded, setLastRawDecoded] = useState<string | null>(null);
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null);

  // Upload photo state
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [isDecodingUpload, setIsDecodingUpload] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  // Physical plaque simulator & manual code entry
  const [manualCodeInput, setManualCodeInput] = useState<string>('');
  const [plaqueSiteId, setPlaqueSiteId] = useState<string>(
    () => initialSelectedSite?.id || sites[0]?.id || ''
  );

  // Matched site confirmation state
  const [matchedSite, setMatchedSite] = useState<HeritageSite | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const plaqueCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const matchTimerRef = useRef<number | null>(null);
  const uploadedPreviewUrlRef = useRef<string | null>(null);

  const selectedPlaqueSite = useMemo(
    () => sites.find((s) => s.id === plaqueSiteId) || initialSelectedSite || sites[0],
    [sites, plaqueSiteId, initialSelectedSite]
  );

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore track stop error
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const clearUploadedPreview = useCallback(() => {
    if (uploadedPreviewUrlRef.current) {
      try {
        URL.revokeObjectURL(uploadedPreviewUrlRef.current);
      } catch {
        // ignore
      }
      uploadedPreviewUrlRef.current = null;
    }
    setUploadedPreviewUrl(null);
  }, []);

  const handleCloseClean = useCallback(() => {
    if (matchTimerRef.current !== null) {
      window.clearTimeout(matchTimerRef.current);
      matchTimerRef.current = null;
    }
    stopCamera();
    clearUploadedPreview();
    setMatchedSite(null);
    setScanErrorMessage(null);
    setLastRawDecoded(null);
    onClose();
  }, [stopCamera, clearUploadedPreview, onClose]);

  const completeScanWithSite = useCallback(
    (site: HeritageSite, rawPayload: string) => {
      if (matchTimerRef.current !== null) {
        window.clearTimeout(matchTimerRef.current);
      }
      stopCamera();
      setLastRawDecoded(rawPayload);
      setScanErrorMessage(null);
      setMatchedSite(site);

      matchTimerRef.current = window.setTimeout(() => {
        matchTimerRef.current = null;
        clearUploadedPreview();
        setMatchedSite(null);
        onScanMatched(site);
      }, 420);
    },
    [stopCamera, clearUploadedPreview, onScanMatched]
  );

  const handleDecodedRawText = useCallback(
    (rawText: string) => {
      const resolved = resolveHeritageSiteFromQrPayload(rawText, sites);
      if (resolved) {
        completeScanWithSite(resolved, rawText);
        return true;
      }

      setLastRawDecoded(rawText);
      setScanErrorMessage(
        lang === 'zh'
          ? `已读取二维码内容 “${rawText.slice(0, 64)}”，但未匹配到系统中的 17 处遗产地铭牌。`
          : lang === 'en'
          ? `Detected QR content "${rawText.slice(0, 64)}", but it does not match any of the 17 heritage plaques.`
          : `Đã đọc mã QR "${rawText.slice(0, 64)}" nhưng chưa khớp với mã bia của 17 di tích trong hệ thống.`
      );
      return false;
    },
    [sites, completeScanWithSite, lang]
  );

  // Sync default plaque preview to currently selected map site when overlay opens
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedSite?.id) {
        setPlaqueSiteId(initialSelectedSite.id);
      }
      setMatchedSite(null);
      setScanErrorMessage(null);
      setLastRawDecoded(null);
    } else {
      stopCamera();
      clearUploadedPreview();
      if (matchTimerRef.current !== null) {
        window.clearTimeout(matchTimerRef.current);
        matchTimerRef.current = null;
      }
    }
  }, [isOpen, initialSelectedSite?.id, stopCamera, clearUploadedPreview]);

  // ESC key closes overlay cleanly
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleCloseClean();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, handleCloseClean]);

  // Live Camera & Frame Decoding Lifecycle
  useEffect(() => {
    if (!isOpen || scannerMode !== 'camera' || matchedSite) {
      stopCamera();
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        setCameraStatus('unavailable');
        return;
      }

      setCameraStatus('starting');
      setScanErrorMessage(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const videoEl = videoRef.current;
        if (videoEl) {
          videoEl.srcObject = stream;
          await videoEl.play().catch(() => {});
          if (!cancelled) {
            setCameraStatus('active');
            if (videoEl.videoWidth && videoEl.videoHeight) {
              setCameraResolution(`${videoEl.videoWidth}×${videoEl.videoHeight}`);
            }
          }
        }

        if (!scanCanvasRef.current) {
          scanCanvasRef.current = document.createElement('canvas');
        }

        // Native BarcodeDetector if supported (fast hardware path in Chromium)
        const win = window as unknown as {
          BarcodeDetector?: new (opts?: { formats?: string[] }) => {
            detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
          };
        };
        const barcodeDetector =
          typeof win.BarcodeDetector === 'function'
            ? new win.BarcodeDetector({ formats: ['qr_code'] })
            : null;

        let isScanningFrame = false;

        scanTimerRef.current = window.setInterval(async () => {
          if (cancelled || isScanningFrame) return;
          const vid = videoRef.current;
          const offCanvas = scanCanvasRef.current;
          if (!vid || !offCanvas || vid.readyState < 2 || vid.videoWidth === 0) return;

          isScanningFrame = true;
          try {
            if (!cameraResolution && vid.videoWidth && vid.videoHeight) {
              setCameraResolution(`${vid.videoWidth}×${vid.videoHeight}`);
            }

            const scale = Math.min(1, 720 / Math.max(vid.videoWidth, vid.videoHeight));
            const targetW = Math.max(1, Math.round(vid.videoWidth * scale));
            const targetH = Math.max(1, Math.round(vid.videoHeight * scale));

            if (offCanvas.width !== targetW || offCanvas.height !== targetH) {
              offCanvas.width = targetW;
              offCanvas.height = targetH;
            }

            const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;

            ctx.drawImage(vid, 0, 0, targetW, targetH);

            let decoded: string | null = null;

            if (barcodeDetector) {
              try {
                const hits = await barcodeDetector.detect(offCanvas);
                const firstVal = hits.find((h) => Boolean(h.rawValue))?.rawValue;
                if (firstVal) decoded = firstVal.trim();
              } catch {
                // fallback to jsQR below
              }
            }

            if (!decoded) {
              const imageData = ctx.getImageData(0, 0, targetW, targetH);
              decoded = decodeQrFromImageData(imageData);
            }

            if (decoded && !cancelled) {
              handleDecodedRawText(decoded);
            }
          } finally {
            isScanningFrame = false;
          }
        }, 140);
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setCameraStatus('denied');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setCameraStatus('unavailable');
        } else {
          setCameraStatus('error');
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, scannerMode, facingMode, matchedSite, stopCamera, handleDecodedRawText, cameraResolution]);

  // Render real scannable QR code onto plaque canvas when in plaque simulator mode
  useEffect(() => {
    if (!isOpen || scannerMode !== 'plaque' || !selectedPlaqueSite || !plaqueCanvasRef.current) {
      return;
    }

    const payload = buildHeritagePlaqueQrPayload(selectedPlaqueSite);
    QRCode.toCanvas(plaqueCanvasRef.current, payload, {
      width: 196,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#171817',
        light: '#F4EFE4',
      },
    }).catch(() => {});
  }, [isOpen, scannerMode, selectedPlaqueSite]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      clearUploadedPreview();
      if (matchTimerRef.current !== null) {
        window.clearTimeout(matchTimerRef.current);
      }
    };
  }, [stopCamera, clearUploadedPreview]);

  const processUploadedFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setScanErrorMessage(
          lang === 'zh'
            ? '请上传 PNG、JPG 或 WEBP 格式的铭牌照片。'
            : lang === 'en'
            ? 'Please upload a PNG, JPG, or WEBP image of the heritage plaque.'
            : 'Vui lòng chọn tệp ảnh PNG, JPG hoặc WEBP chụp bia di tích.'
        );
        return;
      }

      clearUploadedPreview();
      const preview = URL.createObjectURL(file);
      uploadedPreviewUrlRef.current = preview;
      setUploadedPreviewUrl(preview);
      setIsDecodingUpload(true);
      setScanErrorMessage(null);
      setLastRawDecoded(null);

      try {
        const decoded = await decodeQrFromFile(file);
        if (!decoded) {
          setScanErrorMessage(
            lang === 'zh'
              ? '未在图片中检测到清晰的二维码，请靠近拍摄或使用下方铭牌代码。'
              : lang === 'en'
              ? 'No clear QR matrix found in this photo. Try cropping closer or use the Plaque Simulator tab.'
              : 'Không phát hiện thấy mã QR rõ nét trong ảnh. Hãy chụp cận cảnh bia di tích hoặc thử trong mục Bia mẫu.'
          );
          return;
        }
        handleDecodedRawText(decoded);
      } catch {
        setScanErrorMessage(
          lang === 'zh'
            ? '无法读取该图片，请重试。'
            : lang === 'en'
            ? 'Unable to read this image file. Please try another photo.'
            : 'Không thể đọc tệp ảnh này. Vui lòng thử lại với ảnh khác.'
        );
      } finally {
        setIsDecodingUpload(false);
      }
    },
    [clearUploadedPreview, handleDecodedRawText, lang]
  );

  const handleManualResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCodeInput.trim()) return;
    handleDecodedRawText(manualCodeInput.trim());
  };

  const handleSimulateOpticalPlaqueScan = async () => {
    if (!plaqueCanvasRef.current || !selectedPlaqueSite) return;
    const decoded = await decodeQrFromImageElement(plaqueCanvasRef.current, 512);
    if (decoded) {
      handleDecodedRawText(decoded);
    } else {
      handleDecodedRawText(buildHeritagePlaqueQrPayload(selectedPlaqueSite));
    }
  };

  const handleDownloadPlaquePng = () => {
    if (!plaqueCanvasRef.current || !selectedPlaqueSite) return;
    const dataUrl = plaqueCanvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `QR-Bia-Di-Tich-${selectedPlaqueSite.identifierCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  const matchedLocalized = matchedSite ? getLocalizedSite(matchedSite) : null;
  const plaqueLocalized = selectedPlaqueSite ? getLocalizedSite(selectedPlaqueSite) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        lang === 'zh'
          ? '扫描遗产铭牌二维码'
          : lang === 'en'
          ? 'Heritage Plaque QR Scanner'
          : 'Quét mã QR Bia Di tích'
      }
      onClick={handleCloseClean}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-[#171817]/70 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#F4EFE4] border border-[#171817]/20 rounded-t-[28px] sm:rounded-[28px] shadow-[0_32px_90px_rgba(23,24,23,0.45)] overflow-hidden flex flex-col max-h-[92dvh] text-[#171817] animate-apple-sheet"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#171817]/15 bg-[#EDE4D0] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#A94F3D] text-[#D8C9A9] flex items-center justify-center shrink-0">
              <QrCode className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-serif font-semibold tracking-tight text-[#171817] truncate">
                {lang === 'zh'
                  ? '遗产地铭牌二维码扫描'
                  : lang === 'en'
                  ? 'Heritage Plaque QR Scanner'
                  : 'Quét QR Bia Di tích Thực địa'}
              </h2>
              <p className="text-[11px] text-[#171817]/65 truncate">
                {lang === 'zh'
                  ? '识别铭牌后自动开启数字档案并播放语音导览'
                  : lang === 'en'
                  ? 'Instant digital dossier & automatic audio guide launch'
                  : 'Tự động mở Hồ sơ Di tích & phát Thuyết minh ngay khi khớp mã'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseClean}
            className="w-8 h-8 rounded-full bg-[#D8C9A9] hover:bg-[#171817] text-[#171817] hover:text-[#D8C9A9] flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-[#171817]/15"
            aria-label={lang === 'en' ? 'Close scanner' : 'Đóng trình quét QR'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        {!matchedSite && (
          <div className="px-5 sm:px-6 pt-3.5 pb-2 bg-[#EDE4D0]/60 border-b border-[#171817]/12 shrink-0">
            <div className="grid grid-cols-3 p-1 rounded-2xl bg-[#D8C9A9] border border-[#171817]/15 gap-1">
              <button
                type="button"
                onClick={() => {
                  setScannerMode('camera');
                  setScanErrorMessage(null);
                }}
                className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  scannerMode === 'camera'
                    ? 'bg-[#A94F3D] text-[#D8C9A9] shadow-sm'
                    : 'text-[#171817]/75 hover:text-[#171817]'
                }`}
              >
                <Camera className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {lang === 'zh' ? '相机扫描' : lang === 'en' ? 'Live Camera' : 'Camera quét QR'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScannerMode('upload');
                  setScanErrorMessage(null);
                }}
                className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  scannerMode === 'upload'
                    ? 'bg-[#47796D] text-[#171817] shadow-sm'
                    : 'text-[#171817]/75 hover:text-[#171817]'
                }`}
              >
                <Upload className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {lang === 'zh' ? '上传铭牌图' : lang === 'en' ? 'Scan Photo' : 'Ảnh chụp bia'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScannerMode('plaque');
                  setScanErrorMessage(null);
                }}
                className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  scannerMode === 'plaque'
                    ? 'bg-[#C9A46A] text-[#171817] shadow-sm'
                    : 'text-[#171817]/75 hover:text-[#171817]'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {lang === 'zh' ? '铭牌代码/测试' : lang === 'en' ? 'Plaque / Test' : 'Bia mẫu & Mã'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-4 ar-modal-scrollbar bg-[#F4EFE4]">
          {/* MATCHED SITE INSTANT VERIFICATION STATE */}
          {matchedSite && matchedLocalized ? (
            <div className="rounded-[22px] bg-[#EDE4D0] border border-[#171817]/20 overflow-hidden shadow-lg">
              <div className="relative aspect-video w-full bg-[#171817] overflow-hidden">
                {matchedSite.photos?.[0] ? (
                  <HeritageSmoothImage
                    src={matchedSite.photos[0]}
                    alt={matchedLocalized.officialName}
                    waitTone="dark"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <HeritageTypographicPlate site={matchedSite} variant="catalog" className="pb-10" />
                )}
              </div>

              <div className="px-5 py-2.5 bg-[#47796D] text-[#171817] flex items-center justify-between gap-2 border-b border-[#171817]/15">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-semibold">
                    {lang === 'zh'
                      ? '铭牌核验成功'
                      : lang === 'en'
                      ? 'Plaque Verified'
                      : 'Đã nhận diện bia di tích'}
                  </span>
                </div>
                <span className="font-sans text-[11px] font-semibold tabular-nums">
                  {matchedSite.identifierCode}
                </span>
              </div>

              <div className="p-5 space-y-3">
                <div>
                  <h3 className="text-lg sm:text-xl font-serif font-semibold text-[#171817]">
                    {matchedLocalized.officialName}
                  </h3>
                  <p className="text-xs text-[#171817]/70 mt-1">
                    {matchedSite.address.street} · {formatDistrictName(matchedSite.address.district)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#171817]/15 text-xs text-[#A94F3D] font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    {lang === 'zh'
                      ? '正在开启数字档案'
                      : lang === 'en'
                      ? 'Opening digital dossier'
                      : 'Đang mở Hồ sơ Di sản'}
                  </span>
                  <span className="text-[#171817]/30">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5" />
                    {lang === 'zh'
                      ? '启动语音导览'
                      : lang === 'en'
                      ? 'Launching audio guide'
                      : 'Kích hoạt Thuyết minh'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (matchTimerRef.current !== null) {
                      window.clearTimeout(matchTimerRef.current);
                      matchTimerRef.current = null;
                    }
                    const target = matchedSite;
                    clearUploadedPreview();
                    setMatchedSite(null);
                    onScanMatched(target);
                  }}
                  className="w-full h-10 rounded-full bg-[#A94F3D] hover:bg-[#934232] text-[#D8C9A9] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>
                    {lang === 'zh'
                      ? '立即进入档案与语音导览'
                      : lang === 'en'
                      ? 'Open Dossier & Play Now'
                      : 'Mở Hồ sơ & Phát Thuyết minh ngay'}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : null}

          {/* TAB 1: LIVE CAMERA VIEWFINDER */}
          {!matchedSite && scannerMode === 'camera' && (
            <div className="space-y-3.5">
              <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full rounded-[22px] overflow-hidden bg-[#171817] border border-[#171817]/20 shadow-inner">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`w-full h-full object-cover ${
                    cameraStatus === 'active' ? 'opacity-100' : 'opacity-0'
                  } transition-opacity duration-300`}
                />

                {/* Viewfinder Overlay when Camera Active or Starting */}
                {(cameraStatus === 'active' || cameraStatus === 'starting') && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="relative w-52 h-52 sm:w-60 sm:h-60">
                      <span className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-[#C9A46A] rounded-tl-xl" />
                      <span className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-[#C9A46A] rounded-tr-xl" />
                      <span className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-[#C9A46A] rounded-bl-xl" />
                      <span className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-[#C9A46A] rounded-br-xl" />

                      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-[1.5px] bg-gradient-to-r from-transparent via-[#C9A46A] to-transparent" />
                    </div>

                    <div className="mt-4 px-3 py-1 rounded-lg bg-[#171817]/85 border border-[#C9A46A]/40 text-[11px] font-sans text-[#D8C9A9] tabular-nums">
                      {cameraStatus === 'starting'
                        ? lang === 'zh'
                          ? '正在启动相机...'
                          : lang === 'en'
                          ? 'Initializing camera...'
                          : 'Đang khởi động camera...'
                        : lang === 'zh'
                        ? `将铭牌二维码置于框内${cameraResolution ? ` · ${cameraResolution}` : ''}`
                        : lang === 'en'
                        ? `Align heritage plaque QR inside frame${cameraResolution ? ` · ${cameraResolution}` : ''}`
                        : `Đưa mã QR trên bia di tích vào khung${cameraResolution ? ` · ${cameraResolution}` : ''}`}
                    </div>
                  </div>
                )}

                {/* Switch camera button when active */}
                {cameraStatus === 'active' && (
                  <button
                    type="button"
                    onClick={() =>
                      setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                    }
                    className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-[#F4EFE4] hover:bg-[#EDE4D0] border border-[#171817]/20 text-[11px] font-semibold text-[#171817] flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#A94F3D]" />
                    <span>{lang === 'zh' ? '切换镜头' : lang === 'en' ? 'Flip' : 'Đổi camera'}</span>
                  </button>
                )}

                {/* Camera Unavailable / Denied Fallback Card */}
                {(cameraStatus === 'denied' ||
                  cameraStatus === 'unavailable' ||
                  cameraStatus === 'error') && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#EDE4D0]">
                    <div className="w-12 h-12 rounded-2xl bg-[#A94F3D] text-[#D8C9A9] flex items-center justify-center mb-3">
                      <Camera className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm sm:text-base font-semibold text-[#171817]">
                      {cameraStatus === 'denied'
                        ? lang === 'zh'
                          ? '相机权限已被拒绝'
                          : lang === 'en'
                          ? 'Camera Permission Denied'
                          : 'Chưa được cấp quyền Camera'
                        : lang === 'zh'
                        ? '未检测到可用摄像头'
                        : lang === 'en'
                        ? 'No Camera Detected'
                        : 'Không tìm thấy Camera khả dụng'}
                    </h3>
                    <p className="text-xs text-[#171817]/75 max-w-sm mt-1.5 leading-relaxed">
                      {lang === 'zh'
                        ? '您可以上传现场铭牌照片进行识别，或使用“铭牌代码/测试”验证 17 处遗产地二维码。'
                        : lang === 'en'
                        ? 'You can upload a photo of any heritage plaque to decode it, or open Plaque / Test to scan a real generated plaque.'
                        : 'Bạn có thể tải ảnh chụp bia di tích để giải mã QR ngay, hoặc mở mục Bia mẫu & Mã để quét thử bia thật của 17 di tích.'}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
                      <button
                        type="button"
                        onClick={() => setScannerMode('upload')}
                        className="px-4 py-2 rounded-full bg-[#A94F3D] hover:bg-[#934232] text-[#D8C9A9] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'zh'
                            ? '上传铭牌照片'
                            : lang === 'en'
                            ? 'Upload Plaque Photo'
                            : 'Tải ảnh bia di tích'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setScannerMode('plaque')}
                        className="px-4 py-2 rounded-full bg-[#47796D] hover:bg-[#3B665B] text-[#171817] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'zh'
                            ? '打开铭牌模拟器'
                            : lang === 'en'
                            ? 'Open Plaque Simulator'
                            : 'Mở Bia mẫu & Nhập mã'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD PLAQUE PHOTO */}
          {!matchedSite && scannerMode === 'upload' && (
            <div className="space-y-3.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    processUploadedFile(file);
                  }
                  e.target.value = '';
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) processUploadedFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`relative rounded-[22px] border-2 border-dashed p-6 sm:p-8 text-center cursor-pointer transition-all ${
                  isDraggingFile
                    ? 'border-[#A94F3D] bg-[#C9A46A]/20'
                    : 'border-[#171817]/25 hover:border-[#A94F3D] bg-[#EDE4D0]'
                }`}
              >
                {uploadedPreviewUrl ? (
                  <div className="space-y-3">
                    <img
                      src={uploadedPreviewUrl}
                      alt="Uploaded plaque preview"
                      className="max-h-52 mx-auto rounded-xl border border-[#171817]/20 object-contain bg-[#171817]"
                    />
                    <p className="text-xs text-[#171817]/75">
                      {isDecodingUpload
                        ? lang === 'zh'
                          ? '正在解析铭牌二维码...'
                          : lang === 'en'
                          ? 'Decoding QR matrix...'
                          : 'Đang giải mã QR từ ảnh bia...'
                        : lang === 'zh'
                        ? '点击或拖放以更换另一张铭牌照片'
                        : lang === 'en'
                        ? 'Click or drop another plaque photo to scan again'
                        : 'Bấm hoặc kéo thả ảnh bia khác để quét lại'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-[#47796D] text-[#171817] flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-[#171817]">
                      {lang === 'zh'
                        ? '选择或拖放遗产铭牌照片'
                        : lang === 'en'
                        ? 'Select or Drop a Heritage Plaque Photo'
                        : 'Chọn hoặc kéo thả ảnh chụp Bia Di tích'}
                    </h3>
                    <p className="text-xs text-[#171817]/70 max-w-md mx-auto">
                      {lang === 'zh'
                        ? '支持 PNG / JPG / WEBP。浏览器本地实时解码二维码，不上传图片至外部服务器。'
                        : lang === 'en'
                        ? 'Supports PNG, JPG, and WEBP. Decodes directly in your browser without external upload.'
                        : 'Hỗ trợ PNG, JPG, WEBP. Giải mã trực tiếp trên trình duyệt theo chuẩn QR bia di sản.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PLAQUE CODE ENTRY & REAL QR PLAQUE SIMULATOR */}
          {!matchedSite && scannerMode === 'plaque' && (
            <div className="space-y-4">
              {/* Manual Code / URL Input */}
              <form onSubmit={handleManualResolve} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#171817]/60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={manualCodeInput}
                    onChange={(e) => setManualCodeInput(e.target.value)}
                    placeholder={
                      lang === 'zh'
                        ? '输入铭牌编号（如 HCM-Q1-LSKT-001）或二维码链接'
                        : lang === 'en'
                        ? 'Enter plaque code (e.g. HCM-Q1-LSKT-001) or QR URL'
                        : 'Nhập mã bia (VD: HCM-Q1-LSKT-001, 01..17) hoặc URL QR'
                    }
                    className="w-full h-10 pl-10 pr-3 rounded-xl bg-[#EDE4D0] border border-[#171817]/20 focus:border-[#A94F3D] focus:outline-none text-xs text-[#171817] placeholder:text-[#171817]/50 font-sans tabular-nums"
                  />
                </div>
                <button
                  type="submit"
                  className="h-10 px-4 rounded-xl bg-[#A94F3D] hover:bg-[#934232] text-[#D8C9A9] text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  {lang === 'zh' ? '立即识别' : lang === 'en' ? 'Resolve Code' : 'Mở theo mã'}
                </button>
              </form>

              {/* Site selector + Physical Heritage Plaque Preview */}
              {selectedPlaqueSite && plaqueLocalized && (
                <div className="rounded-[22px] bg-[#EDE4D0] border border-[#171817]/20 p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <label
                      htmlFor="qr-plaque-site-select"
                      className="text-xs text-[#A94F3D] font-bold"
                    >
                      {lang === 'zh'
                        ? '选择 17 处遗产地铭牌预览'
                        : lang === 'en'
                        ? 'Physical Plaque Preview (17 Sites)'
                        : 'Mẫu Bia Di tích Gắn mã QR (17 Di tích)'}
                    </label>

                    <select
                      id="qr-plaque-site-select"
                      value={selectedPlaqueSite.id}
                      onChange={(e) => {
                        setPlaqueSiteId(e.target.value);
                        setScanErrorMessage(null);
                      }}
                      className="h-9 px-3 rounded-xl bg-[#F4EFE4] border border-[#171817]/20 text-xs text-[#171817] focus:border-[#A94F3D] focus:outline-none max-w-full sm:max-w-[300px]"
                    >
                      {sites.map((s, idx) => {
                        const loc = getLocalizedSite(s);
                        return (
                          <option key={s.id} value={s.id}>
                            {String(idx + 1).padStart(2, '0')} · {loc.officialName} ({s.identifierCode})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Charcoal & Heritage Gold Plaque Card with Real Canvas QR */}
                  <div className="rounded-2xl bg-[#171817] border border-[#C9A46A] p-4 flex flex-col sm:flex-row items-center gap-4 text-[#D8C9A9]">
                    <div className="p-2 rounded-xl bg-[#F4EFE4] shadow-lg shrink-0">
                      <canvas
                        ref={plaqueCanvasRef}
                        width={196}
                        height={196}
                        className="w-36 h-36 sm:w-40 sm:h-40 block"
                      />
                    </div>

                    <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
                      <div className="font-sans text-xs font-semibold text-[#C9A46A] tabular-nums">
                        {selectedPlaqueSite.identifierCode} · {selectedPlaqueSite.id}
                      </div>
                      <h4 className="text-base font-serif font-semibold text-[#D8C9A9] leading-snug">
                        {plaqueLocalized.officialName}
                      </h4>
                      <p className="text-[11px] text-[#D8C9A9]/80 truncate">
                        {selectedPlaqueSite.address.street} · {formatDistrictName(selectedPlaqueSite.address.district)}
                      </p>
                      <p className="text-[11px] font-sans text-[#D8C9A9]/65 break-all">
                        {buildHeritagePlaqueQrPayload(selectedPlaqueSite)}
                      </p>

                      <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <button
                          type="button"
                          onClick={handleSimulateOpticalPlaqueScan}
                          className="h-9 px-4 rounded-full bg-[#C9A46A] hover:bg-[#d7b57c] text-[#171817] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <ScanLine className="w-3.5 h-3.5" />
                          <span>
                            {lang === 'zh'
                              ? '模拟扫码并开启导览'
                              : lang === 'en'
                              ? 'Scan Plaque & Launch Audio'
                              : 'Quét thử bia & Mở Thuyết minh'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={handleDownloadPlaquePng}
                          className="h-9 px-3.5 rounded-full bg-[#D8C9A9] hover:bg-[#EDE4D0] text-[#171817] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>
                            {lang === 'zh'
                              ? '下载铭牌 PNG'
                              : lang === 'en'
                              ? 'Save PNG'
                              : 'Tải ảnh QR'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Diagnostic Error Banner */}
          {!matchedSite && scanErrorMessage && (
            <div className="rounded-2xl bg-[#A94F3D] text-[#D8C9A9] px-4 py-3 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 text-xs leading-relaxed">
                <p>{scanErrorMessage}</p>
                {lastRawDecoded && (
                  <p className="mt-1 font-sans text-[11px] opacity-80 break-all">
                    Payload: {lastRawDecoded}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setScanErrorMessage(null);
                  setLastRawDecoded(null);
                }}
                className="text-xs text-[#D8C9A9] hover:opacity-80 cursor-pointer"
                aria-label="Dismiss error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
