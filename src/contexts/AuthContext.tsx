import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  PRIMARY_ADMIN_EMAIL,
  ADMIN_EMAILS_STORAGE_KEY,
  ADMIN_EMAILS_UPDATED_EVENT,
  AUTH_SESSION_STORAGE_KEY,
  ACCOUNT_LOCKS_STORAGE_KEY,
  ACCOUNT_LOCKS_UPDATED_EVENT,
  authenticateWithPassword,
  changeAdminPasswordHash,
  deriveStableUserId,
  ensureAdminPasswordHashSeeded,
  fetchUsersFromCloudApi,
  hasRegisteredUserPassword,
  isAccountIdentifierLocked,
  isUserAccountLocked,
  pushSyncPatchToServer,
  registerOAuthVerifiedSession,
  registerQuickJudgeSession,
  restoreAccountFromTransferCode,
  syncLocalBootstrapSnapshotToServer,
  syncStateFromServer,
  appendAuditLog,
  resetLoginShieldStatus,
  getVisitorRecord,
  VISITORS_UPDATED_EVENT,
  PASSES_UPDATED_EVENT,
  TESTER_ALLOWLIST_UPDATED_EVENT,
  SUBSCRIPTION_TIER_UPDATED_EVENT,
  UserEntitlementsSnapshot,
  UserAccountTier,
  getEffectiveUserEntitlements,
  isEmailTesterAllowlisted,
  setLocalTesterModeEnabled,
  persistSimpleUserTier,
  ACCOUNTS_DB_UPDATED_EVENT,
  SUBSCRIPTION_TIER_STORAGE_KEY,
} from '../utils/adminPlatformStore';

export { PRIMARY_ADMIN_EMAIL, ADMIN_EMAILS_STORAGE_KEY, AUTH_SESSION_STORAGE_KEY };

export type AuthProviderType = 'google' | 'facebook';
export type UserRole = 'admin' | 'visitor';
export type TesterActivationSource = 'allowlist' | 'beta' | null;

export interface AuthUser {
  id: string;
  userId: string;
  provider: AuthProviderType;
  email: string;
  displayName: string;
  avatarInitials: string;
  role: UserRole;
  isPrimaryAdmin: boolean;
  isBetaTester: boolean;
  loggedInAt: string;
  authMethod: 'password_verified' | 'oauth_sdk' | 'judge_quick_access';
}

export interface AuthLoginResult {
  ok: boolean;
  error?: string;
  user?: AuthUser;
  isNewAccount?: boolean;
}

export interface OpenAuthModalOptions {
  prompt?: string;
  onSuccess?: (user: AuthUser) => void;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
  isTesterPro: boolean;
  testerModeSource: TesterActivationSource;
  userTier: UserAccountTier;
  entitlements: UserEntitlementsSnapshot;
  refreshEntitlements: () => void;
  primaryAdminEmail: string;
  secondaryAdminEmails: string[];
  isAuthModalOpen: boolean;
  authGatePrompt: string | null;
  openAuthModal: (options?: OpenAuthModalOptions | unknown) => void;
  closeAuthModal: () => void;
  checkAccountPasswordExists: (provider: AuthProviderType, identifier: string) => boolean;
  loginWithGoogle: (
    emailInput: string,
    passwordInput: string,
    displayNameInput?: string
  ) => Promise<AuthLoginResult>;
  loginWithFacebook: (
    accountNameInput: string,
    passwordInput: string,
    emailInput?: string
  ) => Promise<AuthLoginResult>;
  completeOAuthLogin: (params: {
    provider: AuthProviderType;
    identifier: string;
    email?: string;
    displayName: string;
  }) => Promise<AuthLoginResult>;
  loginAsJudge: () => Promise<AuthLoginResult>;
  loginWithTransferCode: (transferCode: string) => Promise<AuthLoginResult>;
  changeAdminPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  addAdminEmail: (emailInput: string) => { ok: boolean; error?: string };
  removeAdminEmail: (emailInput: string) => { ok: boolean; error?: string };
}

const AuthContext = createContext<AuthContextType | null>(null);

export function normalizeEmail(value: string): string {
  return value.toLowerCase().trim();
}

function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function deriveInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'DA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function deriveDisplayNameFromEmail(email: string): string {
  const local = email.split('@')[0] || 'Khách tham quan';
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return email;
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function readSecondaryAdminEmailsFromStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ADMIN_EMAILS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const unique = new Set<string>();
    for (const item of parsed) {
      if (typeof item === 'string') {
        const norm = normalizeEmail(item);
        if (norm && norm !== PRIMARY_ADMIN_EMAIL && isValidEmailFormat(norm)) {
          unique.add(norm);
        }
      }
    }
    return Array.from(unique);
  } catch {
    return [];
  }
}

function writeSecondaryAdminEmailsToStorage(emails: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ADMIN_EMAILS_STORAGE_KEY, JSON.stringify(emails));
  } catch {
    // ignore storage quota errors
  }
}

function resolveUserRole(
  provider: AuthProviderType,
  normalizedEmail: string,
  secondaryAdminEmails: string[]
): { role: UserRole; isPrimaryAdmin: boolean } {
  if (provider !== 'google' || !normalizedEmail) {
    return { role: 'visitor', isPrimaryAdmin: false };
  }
  if (normalizedEmail === PRIMARY_ADMIN_EMAIL) {
    return { role: 'admin', isPrimaryAdmin: true };
  }
  if (secondaryAdminEmails.includes(normalizedEmail)) {
    return { role: 'admin', isPrimaryAdmin: false };
  }
  return { role: 'visitor', isPrimaryAdmin: false };
}

function readPersistedSession(secondaryAdminEmails: string[]): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser> | null;
    if (!parsed || (parsed.provider !== 'google' && parsed.provider !== 'facebook')) {
      return null;
    }
    // Enforce that legacy unverified sessions cannot bypass SHA-256 verification
    if (
      !parsed.userId ||
      (parsed.authMethod !== 'password_verified' &&
        parsed.authMethod !== 'oauth_sdk' &&
        parsed.authMethod !== 'judge_quick_access')
    ) {
      return null;
    }
    const normalizedEmail = typeof parsed.email === 'string' ? normalizeEmail(parsed.email) : '';
    const displayName =
      typeof parsed.displayName === 'string' && parsed.displayName.trim()
        ? parsed.displayName.trim()
        : deriveDisplayNameFromEmail(normalizedEmail || 'Du khách');

    const { role, isPrimaryAdmin } = resolveUserRole(
      parsed.provider,
      normalizedEmail,
      secondaryAdminEmails
    );

    if (!isPrimaryAdmin && normalizedEmail !== PRIMARY_ADMIN_EMAIL && isUserAccountLocked(parsed.userId)) {
      return null;
    }

    const visitorRec = getVisitorRecord(parsed.userId);
    const isBetaTester =
      role === 'admin' || Boolean(visitorRec?.isBetaTester ?? parsed.isBetaTester);

    return {
      id: typeof parsed.id === 'string' && parsed.id ? parsed.id : parsed.userId,
      userId: parsed.userId,
      provider: parsed.provider,
      email: normalizedEmail,
      displayName,
      avatarInitials: deriveInitials(displayName),
      role,
      isPrimaryAdmin,
      isBetaTester,
      loggedInAt:
        typeof parsed.loggedInAt === 'string' ? parsed.loggedInAt : new Date().toISOString(),
      authMethod: parsed.authMethod,
    };
  } catch {
    return null;
  }
}

function writePersistedSession(user: AuthUser | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!user) {
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(user));
    }
  } catch {
    // ignore storage quota errors
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [secondaryAdminEmails, setSecondaryAdminEmails] = useState<string[]>(() =>
    readSecondaryAdminEmailsFromStorage()
  );
  const [user, setUser] = useState<AuthUser | null>(() =>
    readPersistedSession(readSecondaryAdminEmailsFromStorage())
  );
  const [entitlementRevision, setEntitlementRevision] = useState<number>(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authGatePrompt, setAuthGatePrompt] = useState<string | null>(null);
  const pendingAuthActionRef = useRef<((loggedInUser: AuthUser) => void) | null>(null);

  // Seed default Admin SHA-256 digest cleanly on startup and clear any visitor tester-mode toggle
  useEffect(() => {
    void ensureAdminPasswordHashSeeded();
    setLocalTesterModeEnabled(false);
  }, []);

  // Sync permission changes across tabs or when secondary admin list changes
  useEffect(() => {
    setUser((prev) => {
      if (!prev) return null;
      if (prev.authMethod === 'judge_quick_access') return prev;
      const { role, isPrimaryAdmin } = resolveUserRole(
        prev.provider,
        prev.email,
        secondaryAdminEmails
      );
      if (prev.role === role && prev.isPrimaryAdmin === isPrimaryAdmin) {
        return prev;
      }
      const updated: AuthUser = { ...prev, role, isPrimaryAdmin };
      writePersistedSession(updated);
      return updated;
    });
  }, [secondaryAdminEmails]);

  useEffect(() => {
    const syncAccountLockState = () => {
      setUser((prev) => {
        if (!prev || prev.isPrimaryAdmin || prev.email === PRIMARY_ADMIN_EMAIL) return prev;
        if (isUserAccountLocked(prev.userId)) {
          writePersistedSession(null);
          return null;
        }
        return prev;
      });
    };
    const syncBetaTesterFromRegistry = () => {
      setUser((prev) => {
        if (!prev) return prev;
        if (prev.authMethod === 'judge_quick_access') return prev;
        const visitorRec = getVisitorRecord(prev.userId);
        const nextBeta = prev.role === 'admin' || Boolean(visitorRec?.isBetaTester);
        if (prev.isBetaTester === nextBeta) return prev;
        const updated: AuthUser = { ...prev, isBetaTester: nextBeta };
        writePersistedSession(updated);
        return updated;
      });
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === ADMIN_EMAILS_STORAGE_KEY) {
        const nextAdmins = readSecondaryAdminEmailsFromStorage();
        setSecondaryAdminEmails(nextAdmins);
      } else if (e.key === AUTH_SESSION_STORAGE_KEY) {
        const currentAdmins = readSecondaryAdminEmailsFromStorage();
        setUser(readPersistedSession(currentAdmins));
      } else if (e.key === ACCOUNT_LOCKS_STORAGE_KEY) {
        syncAccountLockState();
      } else if (e.key === 'dau_an_viet_visitors_registry_v1') {
        syncBetaTesterFromRegistry();
      } else if (
        e.key === SUBSCRIPTION_TIER_STORAGE_KEY ||
        e.key === 'dau_an_viet_accounts_db_v1'
      ) {
        setEntitlementRevision((r) => r + 1);
      }
    };
    const bumpEntitlements = () => setEntitlementRevision((r) => r + 1);
    window.addEventListener('storage', onStorage);
    window.addEventListener(ACCOUNT_LOCKS_UPDATED_EVENT, syncAccountLockState);
    window.addEventListener(VISITORS_UPDATED_EVENT, syncBetaTesterFromRegistry);
    window.addEventListener(PASSES_UPDATED_EVENT, bumpEntitlements);
    window.addEventListener(TESTER_ALLOWLIST_UPDATED_EVENT, bumpEntitlements);
    window.addEventListener(SUBSCRIPTION_TIER_UPDATED_EVENT, bumpEntitlements);
    window.addEventListener(ACCOUNTS_DB_UPDATED_EVENT, bumpEntitlements);
    const syncAdminsFromServer = () => {
      setSecondaryAdminEmails(readSecondaryAdminEmailsFromStorage());
    };
    window.addEventListener(ADMIN_EMAILS_UPDATED_EVENT, syncAdminsFromServer);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(ACCOUNT_LOCKS_UPDATED_EVENT, syncAccountLockState);
      window.removeEventListener(VISITORS_UPDATED_EVENT, syncBetaTesterFromRegistry);
      window.removeEventListener(PASSES_UPDATED_EVENT, bumpEntitlements);
      window.removeEventListener(TESTER_ALLOWLIST_UPDATED_EVENT, bumpEntitlements);
      window.removeEventListener(SUBSCRIPTION_TIER_UPDATED_EVENT, bumpEntitlements);
      window.removeEventListener(ACCOUNTS_DB_UPDATED_EVENT, bumpEntitlements);
      window.removeEventListener(ADMIN_EMAILS_UPDATED_EVENT, syncAdminsFromServer);
    };
  }, []);

  const openAuthModal = useCallback((options?: OpenAuthModalOptions | unknown) => {
    void syncStateFromServer();
    if (
      options &&
      typeof options === 'object' &&
      !('nativeEvent' in options) &&
      ('prompt' in options || 'onSuccess' in options)
    ) {
      const opts = options as OpenAuthModalOptions;
      setAuthGatePrompt(opts.prompt || null);
      pendingAuthActionRef.current = opts.onSuccess || null;
    } else {
      setAuthGatePrompt(null);
      pendingAuthActionRef.current = null;
    }
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setAuthGatePrompt(null);
    pendingAuthActionRef.current = null;
  }, []);

  const finalizeAuthenticatedUser = useCallback((nextUser: AuthUser) => {
    setUser(nextUser);
    writePersistedSession(nextUser);
    setIsAuthModalOpen(false);
    setAuthGatePrompt(null);
    const pendingCb = pendingAuthActionRef.current;
    pendingAuthActionRef.current = null;
    if (pendingCb) {
      pendingCb(nextUser);
    }
  }, []);

  const checkAccountPasswordExists = useCallback(
    (provider: AuthProviderType, identifier: string): boolean => {
      return hasRegisteredUserPassword(provider, identifier);
    },
    []
  );

  const loginWithGoogle = useCallback(
    async (
      emailInput: string,
      passwordInput: string,
      displayNameInput?: string
    ): Promise<AuthLoginResult> => {
      const normalized = normalizeEmail(emailInput);
      if (!normalized || normalized.length < 2) {
        return {
          ok: false,
          error: 'Vui lòng nhập Email hoặc Tên tài khoản của bạn.',
        };
      }

      // Fetch latest users from CLOUD_API_URL first so cross-device accounts, tickets & roles are restored
      await fetchUsersFromCloudApi();
      const latestSecondaryAdmins = readSecondaryAdminEmailsFromStorage();
      setSecondaryAdminEmails(latestSecondaryAdmins);

      const fallbackDisplayName =
        displayNameInput?.trim() ||
        (normalized === PRIMARY_ADMIN_EMAIL
          ? 'Quản trị viên Dấu Ấn Việt'
          : deriveDisplayNameFromEmail(normalized));

      const { role, isPrimaryAdmin } = resolveUserRole(
        'google',
        normalized,
        latestSecondaryAdmins
      );

      const authRes = await authenticateWithPassword({
        provider: 'google',
        identifier: normalized,
        email: normalized,
        displayName: fallbackDisplayName,
        password: passwordInput,
        role,
        isPrimaryAdmin,
      });

      if (!authRes.ok || !authRes.userId) {
        return {
          ok: false,
          error: authRes.error || 'Mật khẩu tài khoản không chính xác.',
        };
      }

      resetLoginShieldStatus();

      const resolvedDisplayName =
        displayNameInput?.trim() || authRes.displayName || fallbackDisplayName;
      const resolvedRole: UserRole =
        isPrimaryAdmin || authRes.role === 'admin' || role === 'admin' ? 'admin' : 'visitor';

      const visitorRec = getVisitorRecord(authRes.userId);
      const nextUser: AuthUser = {
        id: authRes.userId,
        userId: authRes.userId,
        provider: 'google',
        email: normalized,
        displayName: resolvedDisplayName,
        avatarInitials: deriveInitials(resolvedDisplayName),
        role: resolvedRole,
        isPrimaryAdmin,
        isBetaTester: resolvedRole === 'admin' || Boolean(visitorRec?.isBetaTester),
        loggedInAt: new Date().toISOString(),
        authMethod: 'password_verified',
      };

      finalizeAuthenticatedUser(nextUser);

      if (resolvedRole === 'admin') {
        appendAuditLog({
          adminEmail: normalized,
          action: isPrimaryAdmin ? 'Đăng nhập Super Admin' : 'Đăng nhập Quản trị viên',
          detail: 'Xác thực thành công qua cổng SHA-256 Admin Portal',
        });
      }

      return { ok: true, user: nextUser, isNewAccount: authRes.isNewAccount };
    },
    [secondaryAdminEmails, finalizeAuthenticatedUser]
  );

  const loginWithFacebook = useCallback(
    async (
      accountNameInput: string,
      passwordInput: string,
      emailInput?: string
    ): Promise<AuthLoginResult> => {
      const trimmedName = accountNameInput.trim();
      const normalizedOptionalEmail = emailInput ? normalizeEmail(emailInput) : '';
      const identifier = normalizedOptionalEmail || trimmedName.toLowerCase();

      if (identifier.length < 2) {
        return {
          ok: false,
          error: 'Vui lòng nhập Tên tài khoản hoặc Email của bạn.',
        };
      }

      // Fetch latest users from CLOUD_API_URL first so cross-device accounts & tickets are restored
      await fetchUsersFromCloudApi();

      const fallbackDisplayName =
        trimmedName || deriveDisplayNameFromEmail(normalizedOptionalEmail || identifier);

      const authRes = await authenticateWithPassword({
        provider: 'facebook',
        identifier,
        email: normalizedOptionalEmail || identifier,
        displayName: fallbackDisplayName,
        password: passwordInput,
        role: 'visitor',
        isPrimaryAdmin: false,
      });

      if (!authRes.ok || !authRes.userId) {
        return {
          ok: false,
          error: authRes.error || 'Mật khẩu tài khoản không chính xác.',
        };
      }

      resetLoginShieldStatus();

      const resolvedDisplayName =
        trimmedName || authRes.displayName || fallbackDisplayName;

      const visitorRec = getVisitorRecord(authRes.userId);
      const resolvedFbRole: UserRole = authRes.role === 'admin' ? 'admin' : 'visitor';
      const nextUser: AuthUser = {
        id: authRes.userId,
        userId: authRes.userId,
        provider: 'facebook',
        email: normalizedOptionalEmail || identifier,
        displayName: resolvedDisplayName,
        avatarInitials: deriveInitials(resolvedDisplayName),
        role: resolvedFbRole,
        isPrimaryAdmin: false,
        isBetaTester: resolvedFbRole === 'admin' || Boolean(visitorRec?.isBetaTester),
        loggedInAt: new Date().toISOString(),
        authMethod: 'password_verified',
      };

      finalizeAuthenticatedUser(nextUser);
      return { ok: true, user: nextUser, isNewAccount: authRes.isNewAccount };
    },
    [finalizeAuthenticatedUser]
  );

  const completeOAuthLogin = useCallback(
    async (params: {
      provider: AuthProviderType;
      identifier: string;
      email?: string;
      displayName: string;
    }): Promise<AuthLoginResult> => {
      await syncStateFromServer();
      const latestSecondaryAdmins = readSecondaryAdminEmailsFromStorage();
      setSecondaryAdminEmails(latestSecondaryAdmins);
      const normalizedEmail = params.email ? normalizeEmail(params.email) : '';
      const { role, isPrimaryAdmin } = resolveUserRole(
        params.provider,
        normalizedEmail,
        latestSecondaryAdmins
      );
      if (
        !isPrimaryAdmin &&
        normalizedEmail !== PRIMARY_ADMIN_EMAIL &&
        (await isAccountIdentifierLocked(params.provider, params.identifier))
      ) {
        return {
          ok: false,
          error: `Tài khoản này đang bị tạm khóa bởi Quản trị viên. Vui lòng liên hệ Ban Quản lý (${PRIMARY_ADMIN_EMAIL}) để được hỗ trợ mở khóa.`,
        };
      }
      const userId =
        (await registerOAuthVerifiedSession({
          provider: params.provider,
          identifier: params.identifier,
          email: normalizedEmail,
          displayName: params.displayName,
          role,
          isPrimaryAdmin,
        })) || (await deriveStableUserId(params.provider, params.identifier));

      const visitorRec = getVisitorRecord(userId);
      const nextUser: AuthUser = {
        id: userId,
        userId,
        provider: params.provider,
        email: normalizedEmail,
        displayName: params.displayName,
        avatarInitials: deriveInitials(params.displayName),
        role,
        isPrimaryAdmin,
        isBetaTester: role === 'admin' || Boolean(visitorRec?.isBetaTester),
        loggedInAt: new Date().toISOString(),
        authMethod: 'oauth_sdk',
      };

      finalizeAuthenticatedUser(nextUser);
      return { ok: true, user: nextUser };
    },
    [finalizeAuthenticatedUser]
  );

  const loginAsJudge = useCallback(async (): Promise<AuthLoginResult> => {
    const userId = registerQuickJudgeSession();
    const nextUser: AuthUser = {
      id: userId,
      userId,
      provider: 'google',
      email: 'giamkhao@dauanviet3d.vn',
      displayName: 'Ban Giám Khảo',
      avatarInitials: 'GK',
      role: 'visitor',
      isPrimaryAdmin: false,
      isBetaTester: false,
      loggedInAt: new Date().toISOString(),
      authMethod: 'judge_quick_access',
    };
    finalizeAuthenticatedUser(nextUser);
    return { ok: true, user: nextUser };
  }, [finalizeAuthenticatedUser]);

  const loginWithTransferCode = useCallback(
    async (transferCode: string): Promise<AuthLoginResult> => {
      await syncStateFromServer();
      const restored = await restoreAccountFromTransferCode(transferCode);
      if (!restored.ok || !restored.user) {
        return {
          ok: false,
          error: restored.error || 'Không thể khôi phục tài khoản từ mã chuyển thiết bị.',
        };
      }

      const latestAdmins = readSecondaryAdminEmailsFromStorage();
      setSecondaryAdminEmails(latestAdmins);
      const normEmail = normalizeEmail(restored.user.email || '');
      const resolvedRole = resolveUserRole(restored.user.provider, normEmail, latestAdmins);

      if (
        !resolvedRole.isPrimaryAdmin &&
        normEmail !== PRIMARY_ADMIN_EMAIL &&
        isUserAccountLocked(restored.user.userId)
      ) {
        return {
          ok: false,
          error: `Tài khoản này đang bị tạm khóa bởi Quản trị viên. Vui lòng liên hệ Ban Quản lý (${PRIMARY_ADMIN_EMAIL}).`,
        };
      }

      const visitorRec = getVisitorRecord(restored.user.userId);
      const nextUser: AuthUser = {
        id: restored.user.id || restored.user.userId,
        userId: restored.user.userId,
        provider: restored.user.provider,
        email: normEmail,
        displayName: restored.user.displayName,
        avatarInitials: deriveInitials(restored.user.displayName),
        role: resolvedRole.role,
        isPrimaryAdmin: resolvedRole.isPrimaryAdmin,
        isBetaTester:
          resolvedRole.role === 'admin' ||
          Boolean(visitorRec?.isBetaTester ?? restored.user.isBetaTester),
        loggedInAt: new Date().toISOString(),
        authMethod: restored.user.authMethod || 'password_verified',
      };

      finalizeAuthenticatedUser(nextUser);
      void syncLocalBootstrapSnapshotToServer();
      return { ok: true, user: nextUser };
    },
    [finalizeAuthenticatedUser]
  );

  const changeAdminPassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!user || user.role !== 'admin') {
        return { ok: false, error: 'Chỉ Quản trị viên mới có quyền đổi mật khẩu hệ thống.' };
      }
      const res = await changeAdminPasswordHash(currentPassword, newPassword);
      if (res.ok) {
        appendAuditLog({
          adminEmail: user.email,
          action: 'Cập nhật mật khẩu Quản trị viên',
          detail: 'Mã hóa lại hàm băm SHA-256 cho tài khoản Super Admin',
        });
      }
      return res;
    },
    [user]
  );

  const logout = useCallback(() => {
    setUser(null);
    writePersistedSession(null);
    persistSimpleUserTier('free');
  }, []);

  const addAdminEmail = useCallback(
    (emailInput: string): { ok: boolean; error?: string } => {
      if (!user || user.role !== 'admin') {
        return { ok: false, error: 'Bạn không có quyền thực hiện thao tác quản trị này.' };
      }

      const normalized = normalizeEmail(emailInput);
      if (!normalized || !isValidEmailFormat(normalized)) {
        return { ok: false, error: 'Địa chỉ email không hợp lệ.' };
      }
      if (normalized === PRIMARY_ADMIN_EMAIL) {
        return { ok: false, error: `${PRIMARY_ADMIN_EMAIL} đã là Quản trị viên gốc.` };
      }
      if (secondaryAdminEmails.includes(normalized)) {
        return { ok: false, error: 'Email này đã có quyền Quản trị viên.' };
      }

      const nextList = [...secondaryAdminEmails, normalized];
      setSecondaryAdminEmails(nextList);
      writeSecondaryAdminEmailsToStorage(nextList);
      void pushSyncPatchToServer({
        secondaryAdminEmails: nextList,
        secondaryAdminEmailsUpdatedAt: new Date().toISOString(),
      });
      appendAuditLog({
        adminEmail: user.email,
        action: 'Cấp quyền Đồng Quản trị viên',
        detail: `Thêm ${normalized} vào danh sách Admin Studio`,
      });
      return { ok: true };
    },
    [user, secondaryAdminEmails]
  );

  const removeAdminEmail = useCallback(
    (emailInput: string): { ok: boolean; error?: string } => {
      if (!user || user.role !== 'admin') {
        return { ok: false, error: 'Bạn không có quyền thực hiện thao tác quản trị này.' };
      }

      const normalized = normalizeEmail(emailInput);
      if (normalized === PRIMARY_ADMIN_EMAIL) {
        return { ok: false, error: 'Không thể thu hồi quyền của Quản trị viên gốc.' };
      }

      const nextList = secondaryAdminEmails.filter((item) => item !== normalized);
      setSecondaryAdminEmails(nextList);
      writeSecondaryAdminEmailsToStorage(nextList);
      void pushSyncPatchToServer({
        secondaryAdminEmails: nextList,
        secondaryAdminEmailsUpdatedAt: new Date().toISOString(),
      });
      appendAuditLog({
        adminEmail: user.email,
        action: 'Thu hồi quyền Đồng Quản trị viên',
        detail: `Gỡ quyền Admin đối với ${normalized}`,
      });
      return { ok: true };
    },
    [user, secondaryAdminEmails]
  );

  const refreshEntitlements = useCallback(() => {
    setEntitlementRevision((r) => r + 1);
  }, []);

  const isAdmin = user?.role === 'admin';

  const { isTesterPro, testerModeSource } = useMemo<{
    isTesterPro: boolean;
    testerModeSource: TesterActivationSource;
  }>(() => {
    if (isAdmin) {
      return { isTesterPro: false, testerModeSource: null };
    }
    if (user?.email && isEmailTesterAllowlisted(user.email)) {
      return { isTesterPro: true, testerModeSource: 'allowlist' };
    }
    if (user?.isBetaTester) {
      return { isTesterPro: true, testerModeSource: 'beta' };
    }
    return { isTesterPro: false, testerModeSource: null };
  }, [isAdmin, user, entitlementRevision]);

  const entitlements = useMemo<UserEntitlementsSnapshot>(
    () =>
      getEffectiveUserEntitlements({
        userId: user?.userId,
        userEmail: user?.email,
        isAdmin,
        isTesterPro,
      }),
    [user?.userId, user?.email, isAdmin, isTesterPro, entitlementRevision]
  );

  useEffect(() => {
    persistSimpleUserTier(user ? entitlements.userTier : 'free');
  }, [user, entitlements.userTier]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isAdmin,
      isPrimaryAdmin: Boolean(user?.isPrimaryAdmin),
      isTesterPro,
      testerModeSource,
      userTier: entitlements.userTier,
      entitlements,
      refreshEntitlements,
      primaryAdminEmail: PRIMARY_ADMIN_EMAIL,
      secondaryAdminEmails,
      isAuthModalOpen,
      authGatePrompt,
      openAuthModal,
      closeAuthModal,
      checkAccountPasswordExists,
      loginWithGoogle,
      loginWithFacebook,
      completeOAuthLogin,
      loginAsJudge,
      loginWithTransferCode,
      changeAdminPassword,
      logout,
      addAdminEmail,
      removeAdminEmail,
    }),
    [
      user,
      isAdmin,
      isTesterPro,
      testerModeSource,
      entitlements,
      refreshEntitlements,
      secondaryAdminEmails,
      isAuthModalOpen,
      authGatePrompt,
      openAuthModal,
      closeAuthModal,
      checkAccountPasswordExists,
      loginWithGoogle,
      loginWithFacebook,
      completeOAuthLogin,
      loginAsJudge,
      loginWithTransferCode,
      changeAdminPassword,
      logout,
      addAdminEmail,
      removeAdminEmail,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
