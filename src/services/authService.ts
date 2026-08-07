import type { UserProfile } from '../types';

const AUTH_USER_KEY = 'viera_auth_user';

export function getCurrentUser(): UserProfile | null {
  try {
    const data = localStorage.getItem(AUTH_USER_KEY);
    if (!data) return null;
    return JSON.parse(data) as UserProfile;
  } catch (e) {
    console.warn("Failed to parse viera_auth_user from localStorage:", e);
    return null;
  }
}

export function saveCurrentUser(user: UserProfile): void {
  try {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.error("Failed to save viera_auth_user to localStorage:", e);
  }
}

export function logoutUser(): void {
  try {
    localStorage.removeItem(AUTH_USER_KEY);
  } catch (e) {
    console.error("Failed to logout user:", e);
  }
}

/**
  Decodes standard Google OAuth JWT Credential payload (base64url) without external libraries
 */
export function parseGoogleJwtPayload(credential: string): { sub: string; email: string; name: string; picture: string } | null {
  try {
    const base64Url = credential.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    return {
      sub: parsed.sub || '',
      email: parsed.email || '',
      name: parsed.name || parsed.given_name || 'User',
      picture: parsed.picture || 'https://api.dicebear.com/7.x/bottts/svg?seed=viera'
    };
  } catch (err) {
    console.error("Failed to decode Google JWT token:", err);
    return null;
  }
}
