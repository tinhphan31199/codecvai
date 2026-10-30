"use client";

import { useSyncExternalStore } from "react";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email?: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = "codecv.auth.token";
const USER_KEY = "codecv.auth.user";

let session: AuthSession | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): AuthSession | null {
  try {
    const token = window.localStorage.getItem(TOKEN_KEY);
    const raw = window.localStorage.getItem(USER_KEY);
    if (!token || !raw) return null;
    const user = JSON.parse(raw) as AuthUser;
    if (!user?.id || !user.username) return null;
    return { token, user };
  } catch {
    return null;
  }
}

function snapshot(): AuthSession | null {
  if (!hydrated && typeof window !== "undefined") {
    session = readStorage();
    hydrated = true;
  }
  return session;
}

function persist() {
  try {
    if (session) {
      window.localStorage.setItem(TOKEN_KEY, session.token);
      window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
    }
  } catch {
    // storage bị chặn (chế độ riêng tư): giữ phiên trong bộ nhớ
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeAuth(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function authToken(): string | null {
  return snapshot()?.token ?? null;
}

export function saveSession(token: string, user: AuthUser) {
  session = { token, user };
  hydrated = true;
  persist();
  emit();
}

export function saveSessionUser(user: AuthUser) {
  if (!session) return;
  session = { ...session, user };
  persist();
  emit();
}

export function clearSession() {
  if (!session) return;
  session = null;
  hydrated = true;
  persist();
  emit();
}

export function useAuthSession(): AuthSession | null {
  return useSyncExternalStore(
    subscribeAuth,
    snapshot,
    () => null,
  );
}

// false on the server/first hydration pass, true once the client owns the tree.
export function useAuthReady(): boolean {
  return useSyncExternalStore(
    subscribeAuth,
    () => true,
    () => false,
  );
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

export function hueOf(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return hash;
}
