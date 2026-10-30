import type { CriterionKind } from "@/data/codecv";

export type CvEvidenceStatus = "verified" | "inferred" | "missing";

export interface CvCandidateProfile {
  name: string;
  email: string;
  phone: string;
  location: string;
  currentTitle: string;
  yearsExperience: number;
}

export interface CvCriterionEvaluation {
  label: string;
  kind: CriterionKind;
  status: CvEvidenceStatus;
  quote: string;
  note: string;
}

export interface CvInterviewQuestion {
  question: string;
  topic: string;
  rationale: string;
}

export type CvRepositoryKind = "repo" | "profile" | "link";
export type CvRepositoryStatus = "analyzed" | "unavailable" | "skipped";

export interface CvRepository {
  url: string;
  label: string;
  kind: CvRepositoryKind;
  status: CvRepositoryStatus;
  context: string;
  detail: string;
}

export interface CvGithubMeta {
  targets: number;
  analyzed: number;
  publicRepos: number;
}

export interface CvAnalysis {
  candidate: CvCandidateProfile;
  summary: string;
  repositories: CvRepository[];
  criteria: CvCriterionEvaluation[];
  strengths: string[];
  gaps: string[];
  questions: CvInterviewQuestion[];
}

export interface CvAnalysisMeta {
  model: string;
  pages: number | null;
  characters: number;
  durationMs: number;
  truncated: boolean;
  github: CvGithubMeta;
  repositoryQueue?: number;
}

export interface CvAnalysisResponse {
  analysis: CvAnalysis;
  meta: CvAnalysisMeta;
}

export type AnalyzeCvErrorCode =
  | "bad_request"
  | "too_large"
  | "unsupported_type"
  | "no_text"
  | "missing_key"
  | "upstream_error"
  | "invalid_output"
  | "server_error";

export interface AnalyzeCvErrorBody {
  error: {
    code: AnalyzeCvErrorCode;
    message: string;
  };
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
