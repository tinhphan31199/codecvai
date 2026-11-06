"use client";

import type { CvAnalysisResponse } from "@/lib/cv-analysis";
import { useT } from "@/lib/i18n";
import { EvidenceMeter, EvidencePill } from "../ui";

export default function CVReview({
  review,
  title,
  note,
  modelName,
}: {
  review: CvAnalysisResponse;
  title?: string;
  note?: string;
  modelName?: (id: string) => string;
}) {
  const t = useT();
  const criteria = review.analysis.criteria ?? [];
  const verified = criteria.filter((item) => item.status === "verified").length;
  const inferred = criteria.filter((item) => item.status === "inferred").length;
  const missing = criteria.filter((item) => item.status === "missing").length;
  const covered = verified + inferred;

  return (
    <div className="builder-review">
      <div className="builder-review-head">
        <h3 className="mini-title">{title ?? t("builder.reviewTitle")}</h3>
        <span className="builder-review-meta num">
          {t("builder.reviewMeta", {
            model: modelName ? modelName(review.meta.model) : review.meta.model,
            seconds: (review.meta.durationMs / 1000).toFixed(1),
          })}
        </span>
      </div>
      {review.analysis.summary ? (
        <p className="lede">{review.analysis.summary}</p>
      ) : null}
      {criteria.length ? (
        <>
          <div className="result-evidence">
            <div className="result-evidence-head">
              <span className="health-label">
                {t("builder.reviewEvidence")}
              </span>
              <span className="health-value num">
                {covered}/{criteria.length}
              </span>
            </div>
            <EvidenceMeter
              verified={verified}
              inferred={inferred}
              missing={missing}
              total={criteria.length}
            />
            <span className="result-evidence-note">
              {t("evidence.legend", {
                verified,
                inferred,
                missing,
              })}
            </span>
          </div>
          <div className="analysis-block">
            <h3 className="mini-title">{t("builder.reviewCriteria")}</h3>
            <ol className="analysis-criteria">
              {criteria.map((criterion) => (
                <li className="analysis-criterion" key={criterion.label}>
                  <div className="analysis-criterion-head">
                    <span className="criterion-label">{criterion.label}</span>
                    <span
                      className={`criterion-kind${criterion.kind === "must" ? " is-must" : ""}`}
                    >
                      {criterion.kind === "must"
                        ? t("upload.criteriaMust")
                        : t("upload.criteriaNice")}
                    </span>
                    <EvidencePill state={criterion.status} />
                  </div>
                  {criterion.quote ? (
                    <blockquote className="analysis-quote">
                      {criterion.quote}
                    </blockquote>
                  ) : null}
                  {criterion.note ? (
                    <p className="criterion-note">{criterion.note}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : null}
      {review.analysis.strengths.length || review.analysis.gaps.length ? (
        <div className="split-lists result-lists">
          <div className="split-col">
            <h3 className="mini-title">{t("builder.reviewStrengths")}</h3>
            <ul className="plain-list">
              {review.analysis.strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="split-col">
            <h3 className="mini-title">{t("builder.reviewGaps")}</h3>
            <ul className="plain-list is-warn">
              {review.analysis.gaps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      <p className="builder-hint">{note ?? t("builder.reviewNote")}</p>
    </div>
  );
}
