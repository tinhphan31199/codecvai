"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import {
  BriefcaseBusiness,
  Check,
  CircleAlert,
  GitCompare,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { Screen } from "@/data/codecv";
import {
  compareCVs,
  useDebouncedValue,
  useGeneratedCVs,
  useMarketCVs,
  useModels,
  type CompareCVProfile,
  type CompareCVsResponse,
  type MarketCV,
} from "@/lib/api";
import { useLang, useT, type MessageKey } from "@/lib/i18n";
import { Avatar, CardHead, EmptyState, LoadError, PageHead } from "../ui";

const MAX_MARKET_PICKS = 3;
const MARKET_PAGE_SIZE = 6;

type ComparisonResult = CompareCVsResponse & { signature: string };

export default function Compare({
  go,
}: {
  go: (screen: Screen, id?: string) => void;
}) {
  const t = useT();
  const lang = useLang();

  const savedCvs = useGeneratedCVs();
  const cvs = savedCvs.data ?? [];
  const modelsQuery = useModels();
  const activeModels = useMemo(
    () => (modelsQuery.data ?? []).filter((model) => model.active),
    [modelsQuery.data],
  );

  const [myCvChoice, setMyCvChoice] = useState("");
  const myCvId = cvs.some((cv) => cv.id === myCvChoice)
    ? myCvChoice
    : (cvs[0]?.id ?? "");

  const [modelChoice, setModelChoice] = useState("");
  const modelId = activeModels.some((model) => model.id === modelChoice)
    ? modelChoice
    : (activeModels[0]?.id ?? "");

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const market = useMarketCVs({ q: debouncedQuery, pageSize: MARKET_PAGE_SIZE });
  const marketItems = market.data?.items ?? [];
  const marketTotal = market.data?.total ?? 0;

  const [selected, setSelected] = useState<MarketCV[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  const full = selected.length >= MAX_MARKET_PICKS;

  const signature = useMemo(
    () =>
      [
        myCvId,
        modelId,
        lang,
        selected
          .map((cv) => cv.id)
          .sort()
          .join(","),
      ].join("|"),
    [myCvId, modelId, lang, selected],
  );

  const toggleMarket = (cv: MarketCV) => {
    setSelected((current) => {
      if (current.some((item) => item.id === cv.id)) {
        return current.filter((item) => item.id !== cv.id);
      }
      if (current.length >= MAX_MARKET_PICKS) return current;
      return [...current, cv];
    });
  };

  const run = async () => {
    if (busy) return;
    if (!myCvId) {
      setError(t("compare.selectMine"));
      return;
    }
    if (!selected.length) {
      setError(t("compare.selectMarket"));
      return;
    }
    if (!modelId) {
      setError(t("compare.noModelError"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await compareCVs({
        modelId,
        language: lang,
        myCvId,
        marketCvIds: selected.map((cv) => cv.id),
      });
      setResult({ ...response, signature });
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("compare.errorTitle"),
      );
    } finally {
      setBusy(false);
    }
  };

  const noModels = !modelsQuery.loading && activeModels.length === 0;
  const noSaved = !savedCvs.loading && !savedCvs.error && cvs.length === 0;

  return (
    <div className="screen">
      <PageHead title={t("screen.compare")} sub={t("compare.sub")} />

      <div className="compare-layout">
        <section className="card compare-setup">
          <CardHead
            title={t("compare.setupTitle")}
            meta={t("compare.setupMeta")}
          />

          {savedCvs.loading && !cvs.length ? (
            <p className="saved-cv-loading">
              <Loader2 className="spin" size={15} aria-hidden="true" />
              {t("state.loading")}
            </p>
          ) : null}

          {savedCvs.error ? (
            <LoadError message={savedCvs.error} onRetry={savedCvs.refetch} />
          ) : null}

          {noSaved ? (
            <EmptyState
              title={t("compare.noMyCvTitle")}
              detail={t("compare.noMyCvDetail")}
              action={
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => go("builder")}
                >
                  <Sparkles size={14} aria-hidden="true" />
                  {t("compare.noMyCvAction")}
                </button>
              }
            />
          ) : null}

          {cvs.length ? (
            <label className="field">
              <span className="field-label">{t("compare.myCvLabel")}</span>
              <select
                value={myCvId}
                onChange={(event) => setMyCvChoice(event.target.value)}
              >
                {cvs.map((cv) => (
                  <option key={cv.id} value={cv.id}>
                    {cv.name}
                    {cv.targetPosition ? ` · ${cv.targetPosition}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {activeModels.length ? (
            <label className="field">
              <span className="field-label">{t("compare.modelLabel")}</span>
              <select
                value={modelId}
                onChange={(event) => setModelChoice(event.target.value)}
              >
                {activeModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <span className="field-hint">{t("compare.modelHint")}</span>
            </label>
          ) : noModels ? (
            <p className="compare-note is-warn">{t("compare.noModel")}</p>
          ) : null}

          {error ? (
            <div className="callout callout-negative compare-callout" role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              <div>
                <p className="callout-title">{t("compare.errorTitle")}</p>
                <p className="callout-body">{error}</p>
              </div>
            </div>
          ) : null}

          <div className="compare-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void run()}
            >
              {busy ? (
                <Loader2 className="spin" size={15} aria-hidden="true" />
              ) : (
                <GitCompare size={15} aria-hidden="true" />
              )}
              {busy ? t("compare.comparing") : t("compare.start")}
            </button>
            <p className="compare-note">{t("compare.note")}</p>
          </div>
        </section>

        <section className="card compare-picker">
          <CardHead
            title={t("compare.pickTitle")}
            meta={t("compare.pickMeta", { count: marketTotal })}
            action={
              selected.length ? (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => setSelected([])}
                >
                  {t("compare.clearSelection")}
                </button>
              ) : null
            }
          />

          <div className="filter-bar">
            <div className="filter-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("compare.searchPlaceholder")}
                aria-label={t("compare.searchAria")}
              />
              {query ? (
                <button
                  type="button"
                  className="filter-clear"
                  aria-label={t("compare.clearSelection")}
                  onClick={() => setQuery("")}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
            <span className="result-count">
              {t("compare.selectedMeta", { count: selected.length })}
            </span>
          </div>

          {selected.length ? (
            <div className="compare-picked">
              {selected.map((cv) => (
                <button
                  key={cv.id}
                  type="button"
                  className="chip is-on compare-picked-chip"
                  onClick={() => toggleMarket(cv)}
                  aria-label={`${cv.name} — ${t("compare.clearSelection")}`}
                >
                  {cv.name}
                  <X size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <p className="compare-note">{t("compare.pickHint")}</p>
          )}

          {market.loading && !marketItems.length ? (
            <p className="saved-cv-loading">
              <Loader2 className="spin" size={15} aria-hidden="true" />
              {t("compare.marketLoading")}
            </p>
          ) : null}

          {market.error ? (
            <LoadError message={market.error} onRetry={market.refetch} />
          ) : null}

          {!market.loading && !market.error && marketItems.length === 0 ? (
            <EmptyState
              title={t("compare.emptyMarketTitle")}
              detail={t("compare.emptyMarketDetail")}
            />
          ) : null}

          {marketItems.length ? (
            <div className="compare-market-grid">
              {marketItems.map((cv) => {
                const on = selected.some((item) => item.id === cv.id);
                return (
                  <button
                    key={cv.id}
                    type="button"
                    className={`compare-pick-card${on ? " is-on" : ""}`}
                    aria-pressed={on}
                    disabled={!on && full}
                    onClick={() => toggleMarket(cv)}
                  >
                    <span className="compare-pick-check" aria-hidden="true">
                      {on ? <Check size={12} /> : null}
                    </span>
                    <Avatar
                      initials={cv.initials}
                      hue={cv.hue}
                      size={34}
                      name={cv.name}
                    />
                    <span className="compare-pick-main">
                      <span className="compare-pick-name">{cv.name}</span>
                      <span className="compare-pick-title">
                        {cv.title || t("market.noTitle")}
                      </span>
                      <span className="compare-pick-meta">
                        {cv.level ? (
                          <span className="pill pill-info">{cv.level}</span>
                        ) : null}
                        {cv.years > 0 ? (
                          <span>
                            <BriefcaseBusiness size={12} aria-hidden="true" />
                            {t("compare.years", { years: cv.years })}
                          </span>
                        ) : null}
                      </span>
                      {cv.skills.length ? (
                        <span className="compare-pick-skills">
                          {cv.skills.slice(0, 3).map((skill) => (
                            <span className="market-skill" key={skill}>
                              {skill}
                            </span>
                          ))}
                          {cv.skills.length > 3 ? (
                            <span className="market-skill">
                              +{cv.skills.length - 3}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>

      {result ? (
        <ComparisonBoard
          result={result}
          stale={result.signature !== signature}
          sectionRef={resultRef}
        />
      ) : null}
    </div>
  );
}

function ComparisonBoard({
  result,
  stale,
  sectionRef,
}: {
  result: ComparisonResult;
  stale: boolean;
  sectionRef: RefObject<HTMLElement | null>;
}) {
  const t = useT();
  const profiles = [result.mine, ...result.others];
  const minutes = (result.meta.durationMs / 1000).toFixed(1);
  const mineSkills = new Set(
    result.mine.skills.map((skill) => skill.toLowerCase()),
  );
  const best = profiles.find(
    (profile) => profile.id === result.analysis.bestCvId,
  );

  const empty = <span className="compare-empty">{t("compare.emptyValue")}</span>;

  const rows: {
    label: MessageKey;
    render: (profile: CompareCVProfile) => ReactNode;
  }[] = [
    {
      label: "compare.rowTitle",
      render: (profile) => profile.title || empty,
    },
    {
      label: "compare.rowLevel",
      render: (profile) =>
        profile.level ? (
          <span className="pill pill-info">{profile.level}</span>
        ) : (
          empty
        ),
    },
    {
      label: "compare.rowYears",
      render: (profile) =>
        profile.years > 0
          ? t("compare.years", { years: profile.years })
          : empty,
    },
    {
      label: "compare.rowCategory",
      render: (profile) => profile.category || empty,
    },
    {
      label: "compare.rowSkills",
      render: (profile) =>
        profile.skills.length ? (
          <span className="compare-skill-row">
            {profile.skills.map((skill) => {
              const extra =
                profile.source === "market" &&
                !mineSkills.has(skill.toLowerCase());
              return (
                <span
                  key={skill}
                  className={`market-skill${extra ? " is-extra" : ""}`}
                >
                  {skill}
                </span>
              );
            })}
          </span>
        ) : (
          empty
        ),
    },
    {
      label: "compare.rowSummary",
      render: (profile) =>
        profile.summary ? (
          <p className="compare-cell-text">{profile.summary}</p>
        ) : (
          empty
        ),
    },
    {
      label: "compare.rowHighlights",
      render: (profile) =>
        profile.highlights.length ? (
          <ul className="compare-highlights">
            {profile.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          empty
        ),
    },
  ];

  return (
    <>
      <section className="card compare-result" ref={sectionRef}>
        <CardHead
          title={t("compare.resultTitle")}
          meta={t("compare.resultMeta", {
            model: result.meta.model || result.meta.provider,
            seconds: minutes,
          })}
          action={
            stale ? (
              <span className="compare-stale">{t("compare.stale")}</span>
            ) : null
          }
        />

        <div className="compare-table-wrap">
          <table
            className="compare-table"
            style={{ "--compare-cols": profiles.length } as CSSProperties}
          >
            <thead>
              <tr>
                <th scope="col" className="compare-criterion">
                  {t("compare.criterion")}
                </th>
                {profiles.map((profile) => (
                  <th scope="col" key={profile.id}>
                    <span
                      className={`compare-source${
                        profile.source === "mine" ? " is-mine" : ""
                      }`}
                    >
                      {profile.source === "mine"
                        ? t("compare.sourceMine")
                        : t("compare.sourceMarket")}
                    </span>
                    <span className="compare-col-name">{profile.name}</span>
                    <span className="compare-col-title">
                      {profile.title || t("compare.emptyValue")}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="compare-criterion">
                    {t(row.label)}
                  </th>
                  {profiles.map((profile) => (
                    <td key={profile.id}>{row.render(profile)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="compare-legend">{t("compare.skillsLegend")}</p>
      </section>

      <section className="card compare-verdict">
        <CardHead
          title={t("compare.verdictTitle")}
          meta={t("compare.verdictMeta", {
            count: profiles.length,
            seconds: minutes,
          })}
          action={<Sparkles size={16} className="compare-verdict-icon" />}
        />

        {result.analysis.summary ? (
          <p className="lede">{result.analysis.summary}</p>
        ) : null}

        {best ? (
          <div className="compare-best">
            <div className="compare-best-head">
              <span className="compare-best-tag">
                <Sparkles size={12} aria-hidden="true" />
                {t("compare.bestPick")}
              </span>
              <strong>{best.name}</strong>
              <span
                className={`compare-source${
                  best.source === "mine" ? " is-mine" : ""
                }`}
              >
                {best.source === "mine"
                  ? t("compare.sourceMine")
                  : t("compare.sourceMarket")}
              </span>
            </div>
            {result.analysis.bestReasons.length ? (
              <ul className="plain-list">
                {result.analysis.bestReasons.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {result.analysis.myStrengths.length || result.analysis.myGaps.length ? (
          <div className="split-lists">
            {result.analysis.myStrengths.length ? (
              <section>
                <h3 className="mini-title">{t("compare.myStrengths")}</h3>
                <ul className="plain-list">
                  {result.analysis.myStrengths.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {result.analysis.myGaps.length ? (
              <section>
                <h3 className="mini-title">{t("compare.myGaps")}</h3>
                <ul className="plain-list is-warn">
                  {result.analysis.myGaps.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}

        {result.analysis.marketHighlights.length ? (
          <div className="compare-market-lessons">
            <h3 className="mini-title">{t("compare.marketHighlights")}</h3>
            <ul className="plain-list">
              {result.analysis.marketHighlights.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </>
  );
}
