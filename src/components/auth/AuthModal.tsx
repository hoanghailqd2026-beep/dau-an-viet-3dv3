import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Mail,
  User as UserIcon,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import {
  useAuth,
  AuthProviderType,
  PRIMARY_ADMIN_EMAIL,
  normalizeEmail,
} from '../../contexts/AuthContext';
import {
  VISITORS_UPDATED_EVENT,
  fetchUsersFromCloudApi,
} from '../../utils/adminPlatformStore';
import { useI18n } from '../../i18n/I18nContext';

interface GoogleAccountsApi {
  oauth2?: {
    initTokenClient: (config: {
      client_id: string;
      scope: string;
      callback: (response: { access_token?: string; error?: string }) => void;
    }) => { requestAccessToken: () => void };
  };
}

interface FacebookSdkApi {
  init: (config: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
  login: (
    callback: (response: { authResponse?: { accessToken?: string } }) => void,
    options?: { scope: string }
  ) => void;
  api: (
    path: string,
    params: { fields: string },
    callback: (user: { id?: string; name?: string; email?: string }) => void
  ) => void;
}

declare global {
  interface Window {
    google?: { accounts?: GoogleAccountsApi };
    FB?: FacebookSdkApi;
  }
}

function loadExternalScript(src: string, id: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(false);
      return;
    }
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export const AuthModal: React.FC = () => {
  const { lang } = useI18n();
  const {
    isAuthModalOpen,
    authGatePrompt,
    closeAuthModal,
    checkAccountPasswordExists,
    loginWithGoogle,
    loginWithFacebook,
    completeOAuthLogin,
    loginAsJudge,
    loginWithTransferCode,
  } = useAuth();

  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const facebookAppId = (import.meta.env.VITE_FACEBOOK_APP_ID || '').trim();

  const [selectedProvider, setSelectedProvider] = useState<AuthProviderType | null>('google');
  const [isTransferMode, setIsTransferMode] = useState(false);
  const [transferCodeInput, setTransferCodeInput] = useState('');
  const [credentialSyncTick, setCredentialSyncTick] = useState(0);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googlePassword, setGooglePassword] = useState('');

  const [facebookName, setFacebookName] = useState('');
  const [facebookEmail, setFacebookEmail] = useState('');
  const [facebookPassword, setFacebookPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isJudgeSubmitting, setIsJudgeSubmitting] = useState(false);
  const [oauthPendingProvider, setOauthPendingProvider] = useState<AuthProviderType | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthModalOpen) return;
    const onVisitorsSync = () => setCredentialSyncTick((t) => t + 1);
    window.addEventListener(VISITORS_UPDATED_EVENT, onVisitorsSync);
    return () => {
      window.removeEventListener(VISITORS_UPDATED_EVENT, onVisitorsSync);
    };
  }, [isAuthModalOpen]);

  useEffect(() => {
    if (!isAuthModalOpen) {
      setSelectedProvider('google');
      setIsTransferMode(false);
      setTransferCodeInput('');
      setErrorMsg(null);
      setShowPassword(false);
      setIsSubmitting(false);
      setIsJudgeSubmitting(false);
      setOauthPendingProvider(null);
      setGooglePassword('');
      setFacebookPassword('');
      void fetchUsersFromCloudApi().then(() => {
        setCredentialSyncTick((v) => v + 1);
      });
    }
  }, [isAuthModalOpen]);

  useEffect(() => {
    if (!isAuthModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  const normalizedGoogleEmail = useMemo(() => normalizeEmail(googleEmail), [googleEmail]);
  const isGoogleEmailAdmin = normalizedGoogleEmail === PRIMARY_ADMIN_EMAIL;
  const googleHasExistingPassword = useMemo(
    () =>
      normalizedGoogleEmail.length >= 2
        ? checkAccountPasswordExists('google', normalizedGoogleEmail)
        : false,
    [normalizedGoogleEmail, checkAccountPasswordExists, credentialSyncTick]
  );

  const facebookIdentifier = useMemo(
    () => normalizeEmail(facebookEmail || facebookName),
    [facebookEmail, facebookName]
  );
  const facebookHasExistingPassword = useMemo(
    () =>
      facebookIdentifier.length >= 2
        ? checkAccountPasswordExists('facebook', facebookIdentifier)
        : false,
    [facebookIdentifier, checkAccountPasswordExists, credentialSyncTick]
  );

  if (!isAuthModalOpen) return null;

  const handleTriggerGoogleButton = async () => {
    setErrorMsg(null);
    setIsTransferMode(false);
    if (googleClientId && window.top === window.self) {
      setOauthPendingProvider('google');
      const loaded = await loadExternalScript(
        'https://accounts.google.com/gsi/client',
        'google-gsi-sdk'
      );
      if (loaded && window.google?.accounts?.oauth2) {
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: googleClientId,
            scope: 'openid email profile',
            callback: async (resp) => {
              if (!resp.access_token) {
                setOauthPendingProvider(null);
                setSelectedProvider('google');
                return;
              }
              try {
                const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${resp.access_token}` },
                });
                const profile = (await profileRes.json()) as {
                  email?: string;
                  name?: string;
                };
                if (profile.email) {
                  if (normalizeEmail(profile.email) === PRIMARY_ADMIN_EMAIL) {
                    setGoogleEmail(profile.email);
                    setGoogleName(profile.name || '');
                    setOauthPendingProvider(null);
                    setSelectedProvider('google');
                    return;
                  }
                  await completeOAuthLogin({
                    provider: 'google',
                    identifier: profile.email,
                    email: profile.email,
                    displayName: profile.name || profile.email,
                  });
                  setOauthPendingProvider(null);
                  return;
                }
              } catch {
                // fallback to inline form
              }
              setOauthPendingProvider(null);
              setSelectedProvider('google');
            },
          });
          client.requestAccessToken();
          return;
        } catch {
          setOauthPendingProvider(null);
        }
      }
      setOauthPendingProvider(null);
    }

    setSelectedProvider('google');
  };

  const handleTriggerFacebookButton = async () => {
    setErrorMsg(null);
    setIsTransferMode(false);
    if (facebookAppId && window.top === window.self) {
      setOauthPendingProvider('facebook');
      const loaded = await loadExternalScript(
        'https://connect.facebook.net/en_US/sdk.js',
        'facebook-jssdk'
      );
      if (loaded && window.FB) {
        try {
          window.FB.init({
            appId: facebookAppId,
            cookie: true,
            xfbml: false,
            version: 'v19.0',
          });
          window.FB.login(
            (resp) => {
              if (!resp.authResponse?.accessToken || !window.FB) {
                setOauthPendingProvider(null);
                setSelectedProvider('facebook');
                return;
              }
              window.FB.api(
                '/me',
                { fields: 'id,name,email' },
                async (fbUser) => {
                  if (fbUser?.name) {
                    await completeOAuthLogin({
                      provider: 'facebook',
                      identifier: fbUser.email || fbUser.id || fbUser.name,
                      email: fbUser.email,
                      displayName: fbUser.name,
                    });
                    setOauthPendingProvider(null);
                    return;
                  }
                  setOauthPendingProvider(null);
                  setSelectedProvider('facebook');
                }
              );
            },
            { scope: 'public_profile,email' }
          );
          return;
        } catch {
          setOauthPendingProvider(null);
        }
      }
      setOauthPendingProvider(null);
    }

    setSelectedProvider('facebook');
  };

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await loginWithGoogle(googleEmail, googlePassword, googleName);
      if (!res.ok) {
        setErrorMsg(res.error || 'Không thể đăng nhập tài khoản.');
      } else {
        setGoogleEmail('');
        setGoogleName('');
        setGooglePassword('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFacebookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await loginWithFacebook(facebookName, facebookPassword, facebookEmail);
      if (!res.ok) {
        setErrorMsg(res.error || 'Không thể đăng nhập Facebook.');
      } else {
        setFacebookName('');
        setFacebookEmail('');
        setFacebookPassword('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJudgeQuickLogin = async () => {
    setErrorMsg(null);
    setIsJudgeSubmitting(true);
    try {
      const res = await loginAsJudge();
      if (!res.ok) {
        setErrorMsg(res.error || 'Không thể kích hoạt chế độ trải nghiệm nhanh.');
      }
    } finally {
      setIsJudgeSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        lang === 'zh'
          ? '登录 / 注册 Dấu Ấn Việt 3D'
          : lang === 'en'
          ? 'Sign in / Register to Dấu Ấn Việt 3D'
          : 'Đăng ký / Đăng nhập Dấu Ấn Việt 3D'
      }
      onClick={closeAuthModal}
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-[#171817]/85"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[94vw] sm:w-full max-w-md max-h-[88dvh] flex flex-col bg-[#171817] border border-[#C9A46A]/45 rounded-2xl overflow-hidden text-[#D8C9A9] animate-apple-sheet"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#C9A46A]/20 bg-[#171817] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {isTransferMode && (
              <button
                type="button"
                onClick={() => {
                  setIsTransferMode(false);
                  setSelectedProvider('google');
                  setErrorMsg(null);
                }}
                className="w-7 h-7 rounded-full bg-[#D8C9A9]/10 hover:bg-[#D8C9A9]/20 text-[#D8C9A9] flex items-center justify-center cursor-pointer transition-colors shrink-0"
                aria-label={lang === 'en' ? 'Back' : lang === 'zh' ? '返回' : 'Quay lại'}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-[#C9A46A] block">
                {lang === 'zh'
                  ? 'Dấu Ấn Việt 3D · 云端即时同步'
                  : lang === 'en'
                  ? 'Dấu Ấn Việt 3D · Instant Cloud Sync'
                  : 'Dấu Ấn Việt 3D · Đồng bộ đa thiết bị'}
              </span>
              <h2 className="text-lg font-serif font-semibold text-[#D8C9A9] truncate">
                {isTransferMode
                  ? lang === 'en'
                    ? 'Restore via Sync Code'
                    : lang === 'zh'
                    ? '通过同步码恢复'
                    : 'Khôi phục bằng Mã Đồng Bộ'
                  : lang === 'zh'
                  ? '快速注册 / 登录账户'
                  : lang === 'en'
                  ? 'Instant Register / Sign In'
                  : 'Đăng ký / Đăng nhập tức thì'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={closeAuthModal}
            className="w-8 h-8 rounded-full bg-[#D8C9A9]/10 hover:bg-[#A94F3D] text-[#D8C9A9] flex items-center justify-center cursor-pointer transition-colors shrink-0"
            aria-label={lang === 'en' ? 'Close' : lang === 'zh' ? '关闭' : 'Đóng'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 flex-1 min-h-0 overflow-y-auto modal-scrollbar">
          {/* Mandatory Auth Gate Notice */}
          <div className="rounded-2xl bg-[#C5A059]/12 border border-[#C5A059]/45 px-4 py-2.5 flex items-start gap-3">
            <Lock className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs font-medium text-[#F5EFE6] leading-relaxed">
                Nhập Tên + Email (hoặc tên tài khoản) + Mật khẩu để vào thẳng hệ thống và đồng bộ vé số giữa máy tính &amp; điện thoại.
              </p>
              {authGatePrompt && (
                <div className="text-[11px] font-sans text-[#C5A059]">
                  Khu vực đang mở: {authGatePrompt}
                </div>
              )}
            </div>
          </div>

          {/* Provider Switcher Tabs */}
          {!isTransferMode && (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/45 border border-white/[0.08]">
              <button
                type="button"
                onClick={handleTriggerGoogleButton}
                className={`h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedProvider !== 'facebook'
                    ? 'bg-white text-[#1D1D1F] shadow-sm'
                    : 'text-[#A1A1A6] hover:text-[#F5F5F7]'
                }`}
              >
                {oauthPendingProvider === 'google' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4285F4]" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                    />
                  </svg>
                )}
                <span>Email / Google</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerFacebookButton}
                className={`h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedProvider === 'facebook'
                    ? 'bg-[#1877F2] text-white shadow-sm'
                    : 'text-[#A1A1A6] hover:text-[#F5F5F7]'
                }`}
              >
                {oauthPendingProvider === 'facebook' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                  </svg>
                )}
                <span>Facebook</span>
              </button>
            </div>
          )}

          {isTransferMode ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErrorMsg(null);
                setIsSubmitting(true);
                try {
                  const res = await loginWithTransferCode(transferCodeInput);
                  if (!res.ok) {
                    setErrorMsg(res.error || 'Không thể khôi phục tài khoản từ mã đã nhập.');
                  } else {
                    setTransferCodeInput('');
                    setIsTransferMode(false);
                  }
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="auth-transfer-code"
                  className="block text-xs font-medium text-[#C9A46A]"
                >
                  {lang === 'en'
                    ? 'Account Sync Code (DAV3D-...) *'
                    : lang === 'zh'
                    ? '跨设备同步码（DAV3D-...）*'
                    : 'Mã Đồng Bộ Tài Khoản (DAV3D-...) *'}
                </label>
                <textarea
                  id="auth-transfer-code"
                  required
                  autoFocus
                  rows={4}
                  value={transferCodeInput}
                  onChange={(e) => setTransferCodeInput(e.target.value)}
                  placeholder={
                    lang === 'en'
                      ? 'Paste the DAV3D-... sync code from My Tickets & Journey on your previous device...'
                      : lang === 'zh'
                      ? '请粘贴原设备“我的门票与行程”页面生成的 DAV3D-... 同步码...'
                      : 'Dán chuỗi mã DAV3D-... từ mục Vé & Hành trình của tôi trên thiết bị cũ...'
                  }
                  className="w-full p-3 rounded-xl bg-black/50 border border-[#C9A46A]/35 focus:border-[#C9A46A] focus:outline-none text-xs font-sans tabular-nums text-[#D8C9A9] placeholder:text-[#D8C9A9]/45 resize-none"
                />
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-[#A94F3D]/20 border border-[#A94F3D]/55 px-3.5 py-2.5 text-xs text-[#D8C9A9]">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !transferCodeInput.trim()}
                className="w-full h-11 rounded-full bg-[#C9A46A] hover:bg-[#D8C9A9] text-[#171817] text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  {lang === 'en'
                    ? 'Activate Now'
                    : lang === 'zh'
                    ? '立即激活'
                    : 'Kích hoạt ngay'}
                </span>
              </button>
            </form>
          ) : selectedProvider === 'facebook' ? (
            <form onSubmit={handleFacebookSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label
                  htmlFor="auth-facebook-name"
                  className="block text-xs font-medium text-[#C5A059]"
                >
                  Họ và tên / Tên tài khoản Facebook *
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-facebook-name"
                    type="text"
                    required
                    autoFocus
                    value={facebookName}
                    onChange={(e) => setFacebookName(e.target.value)}
                    placeholder="VD: Trần Gia Huy"
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-black/50 border border-white/[0.14] focus:border-[#0071E3] focus:outline-none text-sm text-[#F5F5F7] placeholder:text-[#636366]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="auth-facebook-email"
                  className="block text-xs font-medium text-[#86868B]"
                >
                  Email hoặc Tên đăng nhập (tùy chọn)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-facebook-email"
                    type="text"
                    value={facebookEmail}
                    onChange={(e) => setFacebookEmail(e.target.value)}
                    placeholder="name@example.com hoặc tên tài khoản"
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-black/50 border border-white/[0.14] focus:border-[#0071E3] focus:outline-none text-sm text-[#F5F5F7] placeholder:text-[#636366]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="auth-facebook-password"
                    className="block text-xs font-medium text-[#C5A059]"
                  >
                    Mật khẩu *
                  </label>
                  <span className="text-[11px] font-medium text-emerald-400">
                    {facebookHasExistingPassword ? 'Tài khoản đã có' : 'Đăng ký / Đăng nhập ngay'}
                  </span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-facebook-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={facebookPassword}
                    onChange={(e) => setFacebookPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full h-11 pl-10 pr-10 rounded-xl bg-black/50 border border-white/[0.14] focus:border-[#0071E3] focus:outline-none text-sm text-[#F5F5F7] placeholder:text-[#636366]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#F5F5F7] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-[#FF453A]/12 border border-[#FF453A]/35 px-3.5 py-2.5 text-xs text-[#FF8A80]">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-full bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Đăng ký / Đăng nhập ngay</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleGoogleSubmit} className="space-y-3.5">
              {!isGoogleEmailAdmin && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="auth-google-name"
                    className="block text-xs font-medium text-[#C5A059]"
                  >
                    Họ và tên hiển thị (in lên Vé &amp; Chứng nhận)
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-google-name"
                      type="text"
                      value={googleName}
                      onChange={(e) => setGoogleName(e.target.value)}
                      placeholder="VD: Nguyễn Minh Anh"
                      className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-black/50 border border-white/[0.14] focus:border-[#C5A059] focus:outline-none text-sm text-[#F5F5F7] placeholder:text-[#636366]"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="auth-google-email"
                  className="block text-xs font-medium text-[#C5A059]"
                >
                  Email hoặc Tên tài khoản *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-google-email"
                    type="text"
                    required
                    autoFocus
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    placeholder="name@gmail.com hoặc tên tài khoản"
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-black/50 border border-white/[0.14] focus:border-[#C5A059] focus:outline-none text-sm text-[#F5F5F7] placeholder:text-[#636366]"
                  />
                </div>
              </div>

              {isGoogleEmailAdmin && (
                <div className="rounded-xl bg-[#C5A059]/12 border border-[#C5A059]/45 px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-[#F5EFE6]">
                  <KeyRound className="w-4 h-4 text-[#C5A059] shrink-0" />
                  <span>
                    Tài khoản Quản trị viên cao nhất: Nhập <strong>Mật khẩu Admin</strong> để mở khóa Admin Studio.
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="auth-google-password"
                    className="block text-xs font-medium text-[#C5A059]"
                  >
                    {isGoogleEmailAdmin ? 'Mật khẩu Admin *' : 'Mật khẩu *'}
                  </label>
                  {!isGoogleEmailAdmin && (
                    <span className="text-[11px] font-medium text-emerald-400">
                      {googleHasExistingPassword ? 'Tài khoản đã có' : 'Vào thẳng ngay lập tức'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-google-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={googlePassword}
                    onChange={(e) => setGooglePassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full h-11 pl-10 pr-10 rounded-xl bg-black/50 border border-white/[0.14] focus:border-[#C5A059] focus:outline-none text-sm text-[#F5F5F7] placeholder:text-[#636366]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#F5F5F7] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-[#FF453A]/12 border border-[#FF453A]/35 px-3.5 py-2.5 text-xs text-[#FF8A80]">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  {isGoogleEmailAdmin
                    ? 'Đăng nhập & Mở khóa Admin Studio'
                    : 'Đăng ký / Đăng nhập'}
                </span>
              </button>
            </form>
          )}

          {/* Secondary Quick Actions */}
          <div className="pt-3 border-t border-white/[0.08] space-y-2.5 text-[11px] text-[#86868B]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {!isTransferMode && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setIsTransferMode(true);
                  }}
                  className="px-3 py-1.5 rounded-full bg-[#D8C9A9]/8 hover:bg-[#D8C9A9]/15 border border-[#C9A46A]/35 text-[11px] text-[#D8C9A9] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Smartphone className="w-3 h-3 text-[#C9A46A]" />
                  <span>
                    {lang === 'en'
                      ? 'Restore via Sync Code'
                      : lang === 'zh'
                      ? '通过同步码恢复'
                      : 'Khôi phục bằng Mã Đồng Bộ'}
                  </span>
                </button>
              )}

              <button
                type="button"
                disabled={isJudgeSubmitting || oauthPendingProvider !== null}
                onClick={handleJudgeQuickLogin}
                className="px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.1] hover:border-[#C5A059]/50 text-[11px] text-[#A1A1A6] hover:text-[#F5EFE6] inline-flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 ml-auto"
              >
                {isJudgeSubmitting ? (
                  <Loader2 className="w-3 h-3 animate-spin text-[#C5A059]" />
                ) : (
                  <Sparkles className="w-3 h-3 text-[#C5A059]" />
                )}
                <span>Trải nghiệm nhanh (Ban Giám Khảo)</span>
              </button>
            </div>

            <div className="flex items-start gap-2 text-[10px] text-[#86868B]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059] shrink-0 mt-0.5" />
              <span>
                Đồng bộ đám mây tức thì giữa máy tính và điện thoại — không cần mã OTP hay chờ duyệt.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
