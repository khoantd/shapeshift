"use client";

import Link from "next/link";
import { LoaderCircle, Sparkles } from "lucide-react";
import type { NewsBriefStats, RankedNewsStat } from "@/lib/newsStats";
import type { IntentStats } from "@/lib/intentStats";

function pct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function scoreLabel(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function ToneBar({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const width = total > 0 ? Math.max(count > 0 ? 4 : 0, (count / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="font-medium text-ink-2 capitalize">{label}</span>
        <span className="tabular-nums text-muted-foreground">{count}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-200 ease-out"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border bg-background px-3 py-2.5">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="text-[20px] leading-6 font-[550] tabular-nums tracking-tight">{value}</span>
      {hint ? <span className="text-[12px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function RankRow({
  row,
  rank,
  hasQuery,
  onSelect,
}: {
  row: RankedNewsStat;
  rank: number;
  hasQuery: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(row.id)}
        className="group flex w-full cursor-pointer items-start gap-3 rounded-lg border bg-background px-3 py-2.5 text-start transition-[background-color,border-color] duration-150 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="mt-0.5 w-5 shrink-0 text-center text-[12px] font-medium tabular-nums text-muted-foreground">
          {rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] leading-5 font-medium text-balance group-hover:text-foreground">
            {row.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
            {row.sourceDisplayName ? <span>{row.sourceDisplayName}</span> : null}
            <span className="capitalize">{row.tone}</span>
            <span className="tabular-nums">
              {hasQuery ? `rel ${row.relevance.toFixed(2)}` : `urg ${row.urgency.toFixed(2)}`}
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}

type Props = {
  news: NewsBriefStats;
  hasQuery: boolean;
  scoring: boolean;
  onScoreUnscored: () => void;
  onSelectStory: (id: string) => void;
  intent: IntentStats;
};

export function NewsStatsPanel({
  news,
  hasQuery,
  scoring,
  onScoreUnscored,
  onSelectStory,
  intent,
}: Props) {
  const coverage = news.total > 0 ? news.briefed / news.total : null;
  const canScore = news.unscored > 0 && !scoring;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="news-intel-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="news-intel-heading" className="text-[17px] font-[550] tracking-tight">
              News intelligence
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Jev brief scores for the current feed
              {hasQuery ? " (ranked by relevance)" : " (ranked by urgency)"}.
            </p>
          </div>
          <button
            type="button"
            onClick={onScoreUnscored}
            disabled={!canScore}
            aria-busy={scoring}
            title={
              news.unscored === 0
                ? "All visible stories already scored"
                : `Score up to 10 unscored stories via Jev`
            }
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2.5 text-[13px] font-medium text-muted-foreground transition-[color,background-color,scale] duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50"
          >
            {scoring ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            {scoring ? "Scoring…" : "Score unscored"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi
            label="Briefed"
            value={news.total === 0 ? "—" : `${news.briefed}/${news.total}`}
            hint={coverage !== null ? `${pct(coverage)} coverage` : undefined}
          />
          <Kpi label="Avg urgency" value={scoreLabel(news.avgUrgency)} />
          <Kpi label="Avg relevance" value={scoreLabel(news.avgRelevance)} />
          <Kpi
            label="Unscored"
            value={String(news.unscored)}
            hint={news.unscored > 0 ? "Open reader or score above" : undefined}
          />
        </div>

        <div className="rounded-lg border bg-background px-3 py-3">
          <h3 className="mb-3 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            Tone mix
          </h3>
          {news.briefed === 0 ? (
            <p className="text-[13px] text-muted-foreground">No briefs yet — score stories to see tone.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              <ToneBar label="neutral" count={news.tone.neutral} total={news.briefed} />
              <ToneBar label="caution" count={news.tone.caution} total={news.briefed} />
              <ToneBar label="opportunity" count={news.tone.opportunity} total={news.briefed} />
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            Top ranked
          </h3>
          {news.ranked.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-[13px] text-muted-foreground">
              No scored stories in this view yet.
            </p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {news.ranked.map((row, i) => (
                <RankRow
                  key={row.id}
                  row={row}
                  rank={i + 1}
                  hasQuery={hasQuery}
                  onSelect={onSelectStory}
                />
              ))}
            </ol>
          )}
        </div>
      </section>

      <section aria-labelledby="intent-stats-heading" className="flex flex-col gap-4 border-t pt-8">
        <div>
          <h2 id="intent-stats-heading" className="text-[17px] font-[550] tracking-tight">
            Intent morphing
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Recent classify results from this browser (demo sessions).
          </p>
        </div>

        {intent.total === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-[13px] leading-5 text-muted-foreground">
            No classify events yet. Try the{" "}
            <Link
              href="/demo"
              className="font-medium text-foreground underline underline-offset-2 transition-colors duration-150 hover:text-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              demo
            </Link>{" "}
            to populate rankings.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Kpi label="Events" value={String(intent.total)} hint="Last 50 max" />
              <Kpi label="Avg confidence" value={scoreLabel(intent.avgConfidence)} />
              <Kpi label="None share" value={pct(intent.noneShare)} />
              <Kpi label="Low confidence" value={pct(intent.lowConfidenceShare)} />
            </div>
            <div className="rounded-lg border bg-background px-3 py-3">
              <h3 className="mb-3 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                Top intents
              </h3>
              <ul className="flex flex-col gap-2">
                {intent.topIntents.map((row) => {
                  const width = intent.total > 0 ? (row.count / intent.total) * 100 : 0;
                  return (
                    <li key={row.intent} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2 text-[13px]">
                        <span className="font-medium text-ink-2">{row.intent}</span>
                        <span className="tabular-nums text-muted-foreground">{row.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div
                          className="h-full rounded-full bg-foreground/70"
                          style={{ width: `${Math.max(width, row.count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
