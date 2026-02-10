import { UserRole } from '../types/roles';

export interface ManagedProfile {
  firstName: string;
  lastName: string;
}

export interface ManagedSecurity {
  blocked: boolean;
  forcePasswordChange: boolean;
  lastAccessAt: number | null;
}

const ROLES_STORAGE_KEY = 'gdp_user_roles';
const USER_PROFILES_STORAGE_KEY = 'gdp_user_profiles';
const USER_PASSWORDS_STORAGE_KEY = 'gdp_user_passwords';
const USER_SECURITY_STORAGE_KEY = 'gdp_user_security';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const loadUserRoles = (): Record<string, UserRole> => {
  try {
    const stored = localStorage.getItem(ROLES_STORAGE_KEY);
    if (stored) return JSON.parse(stored) as Record<string, UserRole>;
  } catch {
    // ignore
  }
  return { 'mguzmanahumada@gmail.com': 'admin' };
};

export const saveUserRoles = (roles: Record<string, UserRole>) => {
  localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(roles));
};

export const loadUserProfiles = (): Record<string, ManagedProfile> => {
  try {
    const raw = localStorage.getItem(USER_PROFILES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ManagedProfile>;
    return Object.entries(parsed).reduce<Record<string, ManagedProfile>>((acc, [email, p]) => {
      acc[normalizeEmail(email)] = {
        firstName: String(p?.firstName || '').trim(),
        lastName: String(p?.lastName || '').trim(),
      };
      return acc;
    }, {});
  } catch {
    return {};
  }
};

export const saveUserProfiles = (profiles: Record<string, ManagedProfile>) => {
  localStorage.setItem(USER_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
};

export const loadUserPasswords = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(USER_PASSWORDS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.entries(parsed).reduce<Record<string, string>>((acc, [email, pwd]) => {
      acc[normalizeEmail(email)] = String(pwd || '');
      return acc;
    }, {});
  } catch {
    return {};
  }
};

export const saveUserPasswords = (passwords: Record<string, string>) => {
  localStorage.setItem(USER_PASSWORDS_STORAGE_KEY, JSON.stringify(passwords));
};

export const loadUserSecurity = (): Record<string, ManagedSecurity> => {
  try {
    const raw = localStorage.getItem(USER_SECURITY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ManagedSecurity>;
    return Object.entries(parsed).reduce<Record<string, ManagedSecurity>>((acc, [email, sec]) => {
      acc[normalizeEmail(email)] = {
        blocked: Boolean(sec?.blocked),
        forcePasswordChange: Boolean(sec?.forcePasswordChange),
        lastAccessAt: typeof sec?.lastAccessAt === 'number' ? sec.lastAccessAt : null,
      };
      return acc;
    }, {});
  } catch {
    return {};
  }
};

export const saveUserSecurity = (security: Record<string, ManagedSecurity>) => {
  localStorage.setItem(USER_SECURITY_STORAGE_KEY, JSON.stringify(security));
};

export const getUserSecurityByEmail = (email: string): ManagedSecurity => {
  const sec = loadUserSecurity()[normalizeEmail(email)];
  return sec || { blocked: false, forcePasswordChange: false, lastAccessAt: null };
};

export const touchUserLastAccess = (email: string) => {
  const normalized = normalizeEmail(email);
  const all = loadUserSecurity();
  const prev = all[normalized] || { blocked: false, forcePasswordChange: false, lastAccessAt: null };
  all[normalized] = { ...prev, lastAccessAt: Date.now() };
  saveUserSecurity(all);
};

export const updateUserSecurity = (email: string, partial: Partial<ManagedSecurity>) => {
  const normalized = normalizeEmail(email);
  const all = loadUserSecurity();
  const prev = all[normalized] || { blocked: false, forcePasswordChange: false, lastAccessAt: null };
  all[normalized] = { ...prev, ...partial };
  saveUserSecurity(all);
};
