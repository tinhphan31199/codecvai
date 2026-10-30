"use client";

import { useCallback, useEffect, useState } from "react";
import type { Candidate, Finding, Position } from "@/data/codecv";
import {
  authToken,
  clearSession,
  saveSession,
  saveSessionUser,
  type AuthUser,
  type UserRole,
} from "@/lib/auth";
import { getLang, translate } from "@/lib/i18n";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");

// ---- Types ----

export interface Stats {
  total: number;
  completed: number;
  review: number;
  processing: number;
  failed: number;
  archived: number;
  positions: number;
  updated: string;
  updatedAt: string;
}

export interface Workspace {
  twoFactor: boolean;
  sessionHours: number;
  notifyReview: boolean;
  notifyDone: boolean;
  notifyDigest: boolean;
}

export interface Report {
  id: string;
  candidateId: string;
  candidate: string;
  position: string;
  version: number;
  status: "exported" | "review" | "failed";
  reviewer: string;
  created: string;
}

export interface TeamMember {
  name: string;
  initials: string;
  role: string;
  email: string;
  hue: number;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  note: string;
  active: boolean;
  apiKey?: string;
  apiKeySet?: boolean;
  apiKeyHint?: string;
}

export interface GeminiModel {
  id: string;
  displayName: string;
}

export interface ServiceConfig {
  id: string;
  kind: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  apiKeySet?: boolean;
  apiKeyHint?: string;
  sort: number;
}

export interface UploadStage {
  id: number;
  label: string;
  detail: string;
}

export interface Level {
  name: string;
  rank: number;
}

export interface Team {
  name: string;
  rank: number;
}

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  authSource: "google" | "password";
  createdAt: string;
}

export interface AnalysisQueueItem {
  id: string;
  file: string;
  candidate: string;
  position: string;
  level: string;
  status: string;
  criteria: number;
  analyzedAt: string;
}

export interface TreeNode {
  name: string;
  type: "folder" | "file";
  active?: boolean;
  children?: TreeNode[];
}

export interface ArchitectureLayer {
  id: string;
  label: string;
  tech: string;
  evidence: number;
  path: string;
  nodes: string[];
}

export interface RepoAnalysis {
  candidateId: string;
  repo: string;
  repoBranch: string;
  commit: string;
  repoState: string;
  tree: TreeNode[];
  layers: ArchitectureLayer[];
  findings: Finding[];
}

export interface Dashboard {
  review: Candidate[];
  processing: Candidate[];
  recent: Candidate[];
  positions: Position[];
}

const EMPTY_STATS: Stats = {
  total: 0,
  completed: 0,
  review: 0,
  processing: 0,
  failed: 0,
  archived: 0,
  positions: 0,
  updated: "",
  updatedAt: "",
};

const EMPTY_WORKSPACE: Workspace = {
  twoFactor: false,
  sessionHours: 0,
  notifyReview: false,
  notifyDone: false,
  notifyDigest: false,
};

// ---- Cache & fetch ----

const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

function invalidate(path: string) {
  cache.delete(path);
  inflight.delete(path);
}

async function requestJSON<T>(
  path: string,
  init?: RequestInit,
  options: { anonymous?: boolean } = {},
): Promise<T> {
  const token = options.anonymous ? null : authToken();
  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let message = translate(getLang(), "state.serverError", {
      status: response.status,
    });
    let code = "";
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      if (body?.error?.message) {
        message = body.error.message;
      }
      code = body?.error?.code ?? "";
    } catch {
      // body không phải JSON, giữ thông điệp mặc định
    }
    // A 401 from a credential check (e.g. an invalid Google token) leaves the
    // session intact; only the auth middleware's "unauthorized" ends it.
    if (
      response.status === 401 &&
      !options.anonymous &&
      (code === "" || code === "unauthorized")
    ) {
      clearSession();
    }
    throw new Error(message);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export interface QueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useQuery<T>(path: string): QueryResult<T> {
  const [data, setData] = useState<T | null>(
    cache.has(path) ? (cache.get(path) as T) : null,
  );
  const [loading, setLoading] = useState(!cache.has(path));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const cached = cache.get(path) as T | undefined;
    if (cached !== undefined) {
      setData(cached);
      setLoading(false);
    }
    let pending = inflight.get(path) as Promise<T> | undefined;
    if (!pending) {
      pending = requestJSON<T>(path)
        .then((json) => {
          cache.set(path, json);
          inflight.delete(path);
          return json;
        })
        .catch((err) => {
          inflight.delete(path);
          throw err;
        });
      inflight.set(path, pending);
    }
    if (cached === undefined) setLoading(true);
    try {
      setData(await pending);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  const refetch = useCallback(async () => {
    invalidate(path);
    setLoading(true);
    try {
      const json = await requestJSON<T>(path);
      cache.set(path, json);
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [path]);

  return { data, loading, error, refetch };
}

// ---- Hooks ----

export function useWorkspaceQuery(): QueryResult<Workspace> {
  return useQuery<Workspace>("/api/workspace");
}

export function useWorkspace(): Workspace {
  const { data } = useWorkspaceQuery();
  return data ?? EMPTY_WORKSPACE;
}

export function useStatsQuery(): QueryResult<Stats> {
  return useQuery<Stats>("/api/stats");
}

export function useStats(): Stats {
  const { data } = useStatsQuery();
  return data ?? EMPTY_STATS;
}

export function useDashboard(): QueryResult<Dashboard> {
  return useQuery<Dashboard>("/api/dashboard");
}

export function useCandidates(): QueryResult<Candidate[]> {
  const result = useQuery<{ candidates: Candidate[]; total: number }>(
    "/api/candidates?limit=200",
  );
  return { ...result, data: result.data ? result.data.candidates : null };
}

export function useCandidate(id: string): QueryResult<Candidate> {
  return useQuery<Candidate>(`/api/candidates/${encodeURIComponent(id)}`);
}

export function useRepository(id: string): QueryResult<RepoAnalysis> {
  return useQuery<RepoAnalysis>(
    `/api/candidates/${encodeURIComponent(id)}/repository`,
  );
}

export function usePositions(): QueryResult<Position[]> {
  const result = useQuery<{ positions: Position[] }>("/api/positions");
  return { ...result, data: result.data ? result.data.positions : null };
}

export function useReports(): QueryResult<Report[]> {
  const result = useQuery<{ reports: Report[] }>("/api/reports");
  return { ...result, data: result.data ? result.data.reports : null };
}

export function useTeam(): QueryResult<TeamMember[]> {
  const result = useQuery<{ members: TeamMember[] }>("/api/team");
  return { ...result, data: result.data ? result.data.members : null };
}

export function useModels(): QueryResult<AIModel[]> {
  const result = useQuery<{ models: AIModel[] }>("/api/models");
  return { ...result, data: result.data ? result.data.models : null };
}

export function useServiceConfigs(): QueryResult<ServiceConfig[]> {
  const result = useQuery<{ configs: ServiceConfig[] }>("/api/service-configs");
  return { ...result, data: result.data ? result.data.configs : null };
}

export function useStages(): QueryResult<UploadStage[]> {
  const result = useQuery<{ stages: UploadStage[] }>("/api/stages");
  return { ...result, data: result.data ? result.data.stages : null };
}

export function useLevels(): QueryResult<Level[]> {
  const result = useQuery<{ levels: Level[] }>("/api/levels");
  return { ...result, data: result.data ? result.data.levels : null };
}

export function useTeams(): QueryResult<Team[]> {
  const result = useQuery<{ teams: Team[] }>("/api/teams");
  return { ...result, data: result.data ? result.data.teams : null };
}

export function useUsers(): QueryResult<AppUser[]> {
  const result = useQuery<{ users: AppUser[] }>("/api/users");
  return { ...result, data: result.data ? result.data.users : null };
}

export function useAnalysisQueue(limit = 5): QueryResult<AnalysisQueueItem[]> {
  const result = useQuery<{ items: AnalysisQueueItem[] }>(
    `/api/analysis-queue?limit=${limit}`,
  );
  return { ...result, data: result.data ? result.data.items : null };
}

// ---- Auth ----

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

export function clearApiCache() {
  cache.clear();
  inflight.clear();
}

export async function loginUser(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const result = await requestJSON<AuthResponse>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ username, password }) },
    { anonymous: true },
  );
  saveSession(result.token, result.user);
  return result;
}

export async function registerUser(
  username: string,
  password: string,
  displayName: string,
): Promise<AuthResponse> {
  const result = await requestJSON<AuthResponse>(
    "/api/auth/register",
    { method: "POST", body: JSON.stringify({ username, password, displayName }) },
    { anonymous: true },
  );
  saveSession(result.token, result.user);
  return result;
}

export async function fetchMe(): Promise<AuthUser> {
  const result = await requestJSON<{ user: AuthUser }>("/api/auth/me");
  return result.user;
}

export async function fetchAuthConfig(): Promise<{ googleClientId: string }> {
  return requestJSON<{ googleClientId: string }>(
    "/api/auth/config",
    undefined,
    { anonymous: true },
  );
}

export async function loginWithGoogle(credential: string): Promise<AuthResponse> {
  const result = await requestJSON<AuthResponse>(
    "/api/auth/google",
    { method: "POST", body: JSON.stringify({ credential }) },
    { anonymous: true },
  );
  saveSession(result.token, result.user);
  clearApiCache();
  return result;
}

export async function linkGoogleAccount(
  credential: string,
): Promise<AuthUser> {
  const result = await requestJSON<{ user: AuthUser }>(
    "/api/auth/google/link",
    { method: "POST", body: JSON.stringify({ credential }) },
  );
  saveSessionUser(result.user);
  return result.user;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<AuthResponse> {
  const result = await requestJSON<AuthResponse>("/api/auth/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  saveSession(result.token, result.user);
  return result;
}

// ---- Mutations ----

export async function downloadCandidateCv(id: string): Promise<void> {
  const token = authToken();
  const response = await fetch(
    `${API_BASE}/api/candidates/${encodeURIComponent(id)}/cv`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (response.status === 401) {
    clearSession();
  }
  if (!response.ok) {
    throw new Error(translate(getLang(), "candidate.downloadCvError"));
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = match?.[1] ?? `CodeCV_${id}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function patchCandidate(
  id: string,
  patch: { status?: string; notes?: string; reviewer?: string; repo?: string },
): Promise<Candidate> {
  const updated = await requestJSON<Candidate>(
    `/api/candidates/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  invalidate(`/api/candidates/${encodeURIComponent(id)}`);
  invalidate("/api/candidates?limit=200");
  invalidate("/api/dashboard");
  return updated;
}

export async function createPosition(position: Position): Promise<Position> {
  const created = await requestJSON<Position>("/api/positions", {
    method: "POST",
    body: JSON.stringify(position),
  });
  invalidate("/api/positions");
  invalidate("/api/dashboard");
  return created;
}

export async function updatePosition(position: Position): Promise<Position> {
  const updated = await requestJSON<Position>(
    `/api/positions/${encodeURIComponent(position.id)}`,
    { method: "PUT", body: JSON.stringify(position) },
  );
  invalidate("/api/positions");
  invalidate("/api/dashboard");
  return updated;
}

export async function deletePosition(id: string): Promise<void> {
  await requestJSON(`/api/positions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  invalidate("/api/positions");
  invalidate("/api/dashboard");
}

export async function createTeamMember(member: TeamMember): Promise<TeamMember> {
  const created = await requestJSON<TeamMember>("/api/team", {
    method: "POST",
    body: JSON.stringify(member),
  });
  invalidate("/api/team");
  return created;
}

export async function updateTeamMember(
  originalName: string,
  member: TeamMember,
): Promise<TeamMember> {
  const updated = await requestJSON<TeamMember>(
    `/api/team/${encodeURIComponent(originalName)}`,
    { method: "PUT", body: JSON.stringify(member) },
  );
  invalidate("/api/team");
  return updated;
}

export async function deleteTeamMember(name: string): Promise<void> {
  await requestJSON(`/api/team/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  invalidate("/api/team");
}

export async function createModel(model: AIModel): Promise<AIModel> {
  const created = await requestJSON<AIModel>("/api/models", {
    method: "POST",
    body: JSON.stringify(model),
  });
  invalidate("/api/models");
  return created;
}

export async function updateModel(
  originalId: string,
  model: AIModel,
): Promise<AIModel> {
  const updated = await requestJSON<AIModel>(
    `/api/models/${encodeURIComponent(originalId)}`,
    { method: "PUT", body: JSON.stringify(model) },
  );
  invalidate("/api/models");
  return updated;
}

export async function deleteModel(id: string): Promise<void> {
  await requestJSON(`/api/models/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  invalidate("/api/models");
}

export async function updateServiceConfig(
  id: string,
  config: Pick<ServiceConfig, "baseUrl" | "apiKey">,
): Promise<ServiceConfig> {
  const updated = await requestJSON<ServiceConfig>(
    `/api/service-configs/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(config) },
  );
  invalidate("/api/service-configs");
  invalidate("/api/models");
  return updated;
}

export async function listGeminiModels(input: {
  apiKey?: string;
  modelId?: string;
}): Promise<GeminiModel[]> {
  const result = await requestJSON<{ models: GeminiModel[] }>(
    "/api/gemini/models",
    { method: "POST", body: JSON.stringify(input) },
  );
  return result.models;
}

export async function createStage(stage: UploadStage): Promise<UploadStage> {
  const created = await requestJSON<UploadStage>("/api/stages", {
    method: "POST",
    body: JSON.stringify(stage),
  });
  invalidate("/api/stages");
  return created;
}

export async function updateStage(
  originalId: number,
  stage: UploadStage,
): Promise<UploadStage> {
  const updated = await requestJSON<UploadStage>(`/api/stages/${originalId}`, {
    method: "PUT",
    body: JSON.stringify(stage),
  });
  invalidate("/api/stages");
  return updated;
}

export async function deleteStage(id: number): Promise<void> {
  await requestJSON(`/api/stages/${id}`, { method: "DELETE" });
  invalidate("/api/stages");
}

export async function createLevel(level: Level): Promise<Level> {
  const created = await requestJSON<Level>("/api/levels", {
    method: "POST",
    body: JSON.stringify(level),
  });
  invalidate("/api/levels");
  return created;
}

export async function updateLevel(
  originalName: string,
  level: Level,
): Promise<Level> {
  const updated = await requestJSON<Level>(
    `/api/levels/${encodeURIComponent(originalName)}`,
    { method: "PUT", body: JSON.stringify(level) },
  );
  invalidate("/api/levels");
  invalidate("/api/positions");
  invalidate("/api/candidates?limit=200");
  invalidate("/api/dashboard");
  return updated;
}

export async function deleteLevel(name: string): Promise<void> {
  await requestJSON(`/api/levels/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  invalidate("/api/levels");
}

export async function createTeam(team: Team): Promise<Team> {
  const created = await requestJSON<Team>("/api/teams", {
    method: "POST",
    body: JSON.stringify(team),
  });
  invalidate("/api/teams");
  return created;
}

export async function updateTeam(
  originalName: string,
  team: Team,
): Promise<Team> {
  const updated = await requestJSON<Team>(
    `/api/teams/${encodeURIComponent(originalName)}`,
    { method: "PUT", body: JSON.stringify(team) },
  );
  invalidate("/api/teams");
  invalidate("/api/positions");
  invalidate("/api/dashboard");
  return updated;
}

export async function deleteTeam(name: string): Promise<void> {
  await requestJSON(`/api/teams/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  invalidate("/api/teams");
}

export async function updateUserRole(
  id: string,
  role: UserRole,
): Promise<AppUser> {
  const updated = await requestJSON<AppUser>(
    `/api/users/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify({ role }) },
  );
  invalidate("/api/users");
  return updated;
}

export async function saveWorkspaceSettings(
  values: Record<string, string>,
): Promise<Workspace> {
  const updated = await requestJSON<Workspace>("/api/workspace", {
    method: "PUT",
    body: JSON.stringify(values),
  });
  invalidate("/api/workspace");
  invalidate("/api/dashboard");
  return updated;
}

export async function patchFinding(
  candidateId: string,
  findingId: string,
  state: string,
): Promise<void> {
  await requestJSON(
    `/api/candidates/${encodeURIComponent(candidateId)}/findings/${encodeURIComponent(findingId)}`,
    { method: "PATCH", body: JSON.stringify({ state }) },
  );
  invalidate(`/api/candidates/${encodeURIComponent(candidateId)}`);
  invalidate(`/api/candidates/${encodeURIComponent(candidateId)}/repository`);
}
