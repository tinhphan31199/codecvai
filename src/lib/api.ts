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
  createdAt: string;
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

export interface BuilderExperienceInput {
  company: string;
  role: string;
  period: string;
  description: string;
}

export interface BuilderEducationInput {
  school: string;
  degree: string;
  period: string;
}

export interface BuilderProjectInput {
  name: string;
  role: string;
  period: string;
  description: string;
}

export interface BuilderInput {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
  position: string;
  level: string;
  years: number;
  skills: string[];
  experiences: BuilderExperienceInput[];
  education: BuilderEducationInput[];
  projects: BuilderProjectInput[];
  certifications: string[];
  languages: string[];
  notes: string;
  sourceCandidateId?: string;
}

export interface GeneratedExperience {
  company: string;
  role: string;
  period: string;
  location?: string;
  bullets: string[];
}

export interface GeneratedEducation {
  school: string;
  degree?: string;
  period?: string;
  detail?: string;
}

export interface GeneratedProject {
  name: string;
  role?: string;
  period?: string;
  link?: string;
  bullets: string[];
}

export interface GeneratedSkillGroup {
  group: string;
  items: string[];
}

export interface GeneratedCertification {
  name: string;
  issuer?: string;
  year?: string;
}

export interface GeneratedLanguage {
  name: string;
  level?: string;
}

export interface GeneratedCVContent {
  summary: string;
  experience: GeneratedExperience[];
  education: GeneratedEducation[];
  projects: GeneratedProject[];
  skills: GeneratedSkillGroup[];
  certifications: GeneratedCertification[];
  languages: GeneratedLanguage[];
}

export type GeneratedTemplate = "classic" | "sidebar" | "compact";
export type GeneratedAccent = "sky" | "slate" | "emerald" | "amber";

export interface GenerateCVPayload {
  modelId?: string;
  language: "vi" | "en";
  template?: string;
  accent?: string;
  feedback?: string;
  input: BuilderInput;
}

export interface GeneratedCVResult {
  input: BuilderInput;
  content: GeneratedCVContent;
  template: GeneratedTemplate;
  accent: GeneratedAccent;
  modelId: string;
  provider: string;
}

export interface GeneratedCVSummary {
  id: string;
  name: string;
  targetPosition: string;
  level: string;
  language: "vi" | "en";
  template: GeneratedTemplate;
  accent: GeneratedAccent;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedCV extends GeneratedCVSummary {
  content: GeneratedCVContent;
  input: BuilderInput;
  modelId?: string;
  provider?: string;
}

export interface SaveGeneratedCVPayload {
  name?: string;
  language: "vi" | "en";
  template?: string;
  accent?: string;
  content: GeneratedCVContent;
  input: BuilderInput;
  modelId?: string;
  provider?: string;
}

export interface MarketCV {
  id: string;
  name: string;
  initials: string;
  hue: number;
  title: string;
  email: string;
  phone: string;
  location: string;
  years: number;
  category: string;
  level: string;
  summary: string;
  skills: string[];
  highlights: string[];
  fileName?: string;
  hasCv: boolean;
  model?: string;
  ownerId?: string;
  uploadedBy?: string;
  visibility: "public" | "private";
  saved: boolean;
  canEdit: boolean;
  createdAt: string;
}

export interface MarketUploadResponse {
  cv: MarketCV;
  provider: string;
  durationMs: number;
}

export interface TreeNode {
  name: string;
  type: "folder" | "file";
  active?: boolean;
  sha?: string;
  size?: number;
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

export interface RepoRecord {
  url: string;
  label: string;
  kind: "repo" | "profile" | "link";
  status: "pending" | "analyzing" | "analyzed" | "unavailable" | "skipped";
  context: string;
  detail: string;
  source: string;
  updatedAt: string;
  hasTree: boolean;
  findingsState: "pending" | "analyzing" | "analyzed" | "failed" | "";
  findingsDetail: string;
}

export interface RepoLanguage {
  name: string;
  percent: number;
}

export interface RepoCommit {
  sha: string;
  message: string;
  date: string;
}

export interface RepoDetails {
  fullName: string;
  description: string;
  language: string;
  languages: RepoLanguage[];
  topics: string[];
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  sizeKb: number;
  defaultBranch: string;
  pushedAt: string;
  createdAt: string;
  homepage: string;
  license: string;
  fork: boolean;
  archived: boolean;
  readme: string;
  readmeChars: number;
  fileCount: number;
  treeTruncated: boolean;
  commits: RepoCommit[];
}

export interface RepoFile {
  path: string;
  content: string;
  truncated: boolean;
}

export interface RepoModule {
  name: string;
  files: number;
}

export interface RepoFileType {
  ext: string;
  count: number;
}

export interface RepoKeyFile {
  path: string;
  kind: string;
}

export interface RepoSummary {
  files: number;
  folders: number;
  sizeKb: number;
  tests: number;
  flags: string[];
  modules: RepoModule[];
  fileTypes: RepoFileType[];
  keyFiles: RepoKeyFile[];
  entrypoints: string[];
}

export interface RepoAnalysis {
  candidateId: string;
  repo: string;
  repoBranch: string;
  commit: string;
  repoState: string;
  tree: TreeNode[];
  layers: ArchitectureLayer[];
  details: RepoDetails | null;
  summary: RepoSummary | null;
  findings: Finding[];
  repositories: RepoRecord[];
}

export interface RepositoryChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface RepositoryChatHistory {
  repo: string;
  messages: RepositoryChatMessage[];
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

// Paginated hooks key the cache by their full query string, so mutations need
// to drop every variant under the same endpoint prefix.
function invalidatePrefix(prefix: string) {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
  for (const key of Array.from(inflight.keys())) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
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
  refresh: () => void;
}

function useQuery<T>(path: string | null): QueryResult<T> {
  const [data, setData] = useState<T | null>(
    path && cache.has(path) ? (cache.get(path) as T) : null,
  );
  const [loading, setLoading] = useState(path ? !cache.has(path) : false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
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
    if (!path) return;
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

  // refresh cập nhật dữ liệu tại chỗ, không bật loading để không nháy màn hình.
  const refresh = useCallback(async () => {
    if (!path) return;
    try {
      const json = await requestJSON<T>(path);
      cache.set(path, json);
      setData(json);
    } catch {
      // Giữ dữ liệu cũ; lần poll sau sẽ thử lại.
    }
  }, [path]);

  return { data, loading, error, refetch, refresh };
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

export interface CandidateQuery {
  q?: string;
  status?: string;
  position?: string;
  evidence?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface CandidatePage {
  candidates: Candidate[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; verified: number; gap: number };
  positions: string[];
}

export function useCandidatesPage(
  query: CandidateQuery = {},
): QueryResult<CandidatePage> {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.status && query.status !== "all") params.set("status", query.status);
  if (query.position && query.position !== "all")
    params.set("position", query.position);
  if (query.evidence && query.evidence !== "all")
    params.set("evidence", query.evidence);
  if (query.sort && query.sort !== "recent") params.set("sort", query.sort);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize ?? 8));
  return useQuery<CandidatePage>(`/api/candidates?${params.toString()}`);
}

// Screens that only need a picker (Reports, Interview, Repository) keep the
// flat list; the table uses useCandidatesPage instead.
export function useCandidates(): QueryResult<Candidate[]> {
  const result = useQuery<CandidatePage>("/api/candidates?pageSize=200");
  return { ...result, data: result.data ? result.data.candidates : null };
}

export function useCandidate(id: string): QueryResult<Candidate> {
  return useQuery<Candidate>(`/api/candidates/${encodeURIComponent(id)}`);
}

export interface MarketCVQuery {
  q?: string;
  category?: string;
  level?: string;
  years?: string;
  sort?: string;
  scope?: string;
  page?: number;
  pageSize?: number;
}

export interface MarketCVPage {
  items: MarketCV[];
  total: number;
  page: number;
  pageSize: number;
  scopeCounts: { all: number; saved: number; mine: number };
  categoryCounts: Record<string, number>;
  levels: string[];
}

export function useMarketCVs(
  query: MarketCVQuery = {},
): QueryResult<MarketCVPage> {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.category && query.category !== "all")
    params.set("category", query.category);
  if (query.level && query.level !== "all") params.set("level", query.level);
  if (query.years && query.years !== "all") params.set("years", query.years);
  if (query.sort && query.sort !== "recent") params.set("sort", query.sort);
  if (query.scope && query.scope !== "all") params.set("scope", query.scope);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize ?? 12));
  return useQuery<MarketCVPage>(`/api/market/cvs?${params.toString()}`);
}

export function useRepository(
  id: string,
  repo?: string,
): QueryResult<RepoAnalysis> {
  const query = repo ? `?repo=${encodeURIComponent(repo)}` : "";
  return useQuery<RepoAnalysis>(
    `/api/candidates/${encodeURIComponent(id)}/repository${query}`,
  );
}

export function useRepositoryFile(
  id: string,
  path: string | null,
  repo?: string,
): QueryResult<RepoFile> {
  const query = repo ? `&repo=${encodeURIComponent(repo)}` : "";
  return useQuery<RepoFile>(
    path
      ? `/api/candidates/${encodeURIComponent(id)}/repository/file?path=${encodeURIComponent(path)}${query}`
      : null,
  );
}

export function useRepositoryChat(
  id: string,
  repo?: string,
): QueryResult<RepositoryChatMessage[]> {
  const query = repo ? `?repo=${encodeURIComponent(repo)}` : "";
  const result = useQuery<RepositoryChatHistory>(
    `/api/candidates/${encodeURIComponent(id)}/repository/chat${query}`,
  );
  return { ...result, data: result.data ? result.data.messages : null };
}

export function usePositions(): QueryResult<Position[]> {
  const result = useQuery<{ positions: Position[] }>("/api/positions");
  return { ...result, data: result.data ? result.data.positions : null };
}

export function useReports(): QueryResult<Report[]> {
  const result = useQuery<{ reports: Report[] }>("/api/reports");
  return { ...result, data: result.data ? result.data.reports : null };
}

export async function patchReportStatus(
  id: string,
  status: Report["status"],
): Promise<Report> {
  const updated = await requestJSON<Report>(
    `/api/reports/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify({ status }) },
  );
  invalidate("/api/reports");
  return updated;
}

export function useTeam(): QueryResult<TeamMember[]> {
  const result = useQuery<{ members: TeamMember[] }>("/api/team");
  return { ...result, data: result.data ? result.data.members : null };
}

export function useModels(): QueryResult<AIModel[]> {
  const result = useQuery<{ models: AIModel[] }>("/api/models");
  return { ...result, data: result.data ? result.data.models : null };
}

export function useGeneratedCVs(): QueryResult<GeneratedCVSummary[]> {
  const result = useQuery<{ cvs: GeneratedCVSummary[] }>(
    "/api/cv-builder/cvs",
  );
  return { ...result, data: result.data ? result.data.cvs : null };
}

export function useGeneratedCV(id: string | null): QueryResult<GeneratedCV> {
  const result = useQuery<{ cv: GeneratedCV }>(
    id ? `/api/cv-builder/cvs/${encodeURIComponent(id)}` : null,
  );
  return { ...result, data: result.data ? result.data.cv : null };
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

export async function downloadMarketCV(id: string): Promise<void> {
  const token = authToken();
  const response = await fetch(
    `${API_BASE}/api/market/cvs/${encodeURIComponent(id)}/cv`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (response.status === 401) {
    clearSession();
  }
  if (!response.ok) {
    throw new Error(translate(getLang(), "market.downloadError"));
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

export async function saveMarketCV(
  id: string,
  saved: boolean,
): Promise<{ saved: boolean }> {
  const result = await requestJSON<{ saved: boolean }>(
    `/api/market/cvs/${encodeURIComponent(id)}/save`,
    { method: saved ? "POST" : "DELETE" },
  );
  invalidatePrefix("/api/market/cvs?");
  return result;
}

export async function setMarketCVVisibility(
  id: string,
  visibility: "public" | "private",
): Promise<MarketCV> {
  const updated = await requestJSON<MarketCV>(
    `/api/market/cvs/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify({ visibility }) },
  );
  invalidatePrefix("/api/market/cvs?");
  return updated;
}

export async function deleteMarketCV(id: string): Promise<void> {
  await requestJSON<void>(`/api/market/cvs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  invalidatePrefix("/api/market/cvs?");
}

export async function generateCV(
  payload: GenerateCVPayload,
): Promise<GeneratedCVResult> {
  return requestJSON<GeneratedCVResult>("/api/cv-builder/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createGeneratedCV(
  payload: SaveGeneratedCVPayload,
): Promise<GeneratedCV> {
  const result = await requestJSON<{ cv: GeneratedCV }>("/api/cv-builder/cvs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  invalidatePrefix("/api/cv-builder/cvs");
  return result.cv;
}

export async function updateGeneratedCV(
  id: string,
  payload: SaveGeneratedCVPayload,
): Promise<GeneratedCV> {
  const result = await requestJSON<{ cv: GeneratedCV }>(
    `/api/cv-builder/cvs/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
  invalidatePrefix("/api/cv-builder/cvs");
  return result.cv;
}

export async function deleteGeneratedCV(id: string): Promise<void> {
  await requestJSON<void>(`/api/cv-builder/cvs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  invalidatePrefix("/api/cv-builder/cvs");
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
  invalidatePrefix("/api/candidates?");
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
  invalidatePrefix("/api/candidates?");
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

export async function retryRepositories(
  candidateId: string,
  label?: string,
): Promise<number> {
  const result = await requestJSON<{ queued: number }>(
    `/api/candidates/${encodeURIComponent(candidateId)}/repositories/retry`,
    { method: "POST", body: JSON.stringify(label ? { label } : {}) },
  );
  invalidate(`/api/candidates/${encodeURIComponent(candidateId)}`);
  invalidate(`/api/candidates/${encodeURIComponent(candidateId)}/repository`);
  return result.queued;
}

export async function analyzeRepositoryFindings(
  candidateId: string,
  repo?: string,
): Promise<{ repo: string; queued: boolean }> {
  const result = await requestJSON<{ repo: string; queued: boolean }>(
    `/api/candidates/${encodeURIComponent(candidateId)}/repository/findings`,
    { method: "POST", body: JSON.stringify(repo ? { repo } : {}) },
  );
  invalidate(`/api/candidates/${encodeURIComponent(candidateId)}`);
  invalidate(`/api/candidates/${encodeURIComponent(candidateId)}/repository`);
  return result;
}

export async function sendRepositoryChatMessage(
  candidateId: string,
  repo: string | undefined,
  message: string,
): Promise<RepositoryChatMessage[]> {
  const query = repo ? `?repo=${encodeURIComponent(repo)}` : "";
  const result = await requestJSON<RepositoryChatHistory>(
    `/api/candidates/${encodeURIComponent(candidateId)}/repository/chat${query}`,
    {
      method: "POST",
      body: JSON.stringify(repo ? { repo, message } : { message }),
    },
  );
  // Lần mount sau tải lại lịch sử đầy đủ thay vì bản cache trước khi gửi.
  invalidate(
    `/api/candidates/${encodeURIComponent(candidateId)}/repository/chat${query}`,
  );
  return result.messages;
}
