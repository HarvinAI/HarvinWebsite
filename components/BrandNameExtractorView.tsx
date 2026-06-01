'use client';

import { useCallback, useMemo, useState } from 'react';
import { Upload, Download, Loader2, Check, AlertCircle, Tag } from 'lucide-react';

type ExtractRow = {
  domain: string;
  brandName: string;
  source: string;
  cached: boolean;
  category?: string | null;
  subCategory?: string | null;
  categorySource?: string;
};

type Stats = {
  total: number;
  cached: number;
  scraped: number;
  fallback: number;
  elapsedMs: number;
};

const BATCH_SIZE = 200;            // smaller batches fit comfortably under the 300s function timeout
const BATCH_RETRIES = 2;            // retry a failed batch this many times before giving up
const BATCH_RETRY_BACKOFF_MS = 1500;
const ADMIN_TOKEN_HEADER = 'x-admin-token';

export default function BrandNameExtractorView({
  showToast,
}: {
  showToast: (msg: string, variant?: 'success' | 'error') => void;
}) {
  const [rawInput, setRawInput] = useState('');
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<ExtractRow[]>([]);
  const [aggregateStats, setAggregateStats] = useState<Stats>({
    total: 0, cached: 0, scraped: 0, fallback: 0, elapsedMs: 0,
  });
  const [adminToken, setAdminToken] = useState('');
  const [search, setSearch] = useState('');

  const parseStats = useMemo(() => {
    // Split on any whitespace, commas, semicolons, tabs, pipes — so tab-separated
    // pastes and CSV columns all work, not just newlines/commas.
    const raw = rawInput
      .split(/[\s,;|]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const normalized = raw.map(d => {
      let s = d.toLowerCase();
      // Strip surrounding quotes / brackets from CSV cells
      s = s.replace(/^[<"'(\[]+|[>"')\]]+$/g, '');
      // Strip protocol
      s = s.replace(/^https?:\/\//i, '');
      // Strip leading www. or www2., m. etc.
      s = s.replace(/^(?:www\d*|m|mobile)\./i, '');
      // Strip everything after the first /, ?, # — paths, queries, anchors
      s = s.split(/[/?#]/)[0];
      // Strip port
      s = s.replace(/:\d+$/, '');
      // Strip trailing dots
      s = s.replace(/\.+$/, '');
      return s;
    });

    const valid: string[] = [];
    const invalid: string[] = [];
    for (const d of normalized) {
      if (d && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)) valid.push(d);
      else if (d) invalid.push(d);
    }

    // Surface how many input slots are repeats so the user knows their list
    // contains duplicates — but we keep every occurrence and process them all.
    const seenCount = new Map<string, number>();
    for (const d of valid) seenCount.set(d, (seenCount.get(d) || 0) + 1);
    const duplicates = [...seenCount.entries()]
      .filter(([, n]) => n > 1)
      .map(([d, n]) => ({ domain: d, count: n }))
      .sort((a, b) => b.count - a.count);
    const repeatSlots = valid.length - seenCount.size;

    return {
      raw: raw.length,
      valid,
      invalid,
      duplicates,
      repeatSlots,
    };
  }, [rawInput]);

  const parsedDomains = parseStats.valid;

  const onFile = useCallback(async (file: File) => {
    const text = await file.text();
    setRawInput(prev => (prev ? prev + '\n' + text : text));
  }, []);

  const onExtract = useCallback(async () => {
    if (running) return;
    if (!adminToken) {
      showToast('Admin token required', 'error');
      return;
    }
    if (parsedDomains.length === 0) {
      showToast('Paste at least one domain', 'error');
      return;
    }

    // Defensively strip whitespace/newlines that often hitchhike along when
    // copy-pasting tokens (especially from terminals or markdown blocks).
    const cleanToken = adminToken.replace(/\s+/g, '');
    if (!cleanToken) {
      showToast('Token is empty after stripping whitespace — paste again', 'error');
      return;
    }
    if (!/^[A-Fa-f0-9]{32,}$/.test(cleanToken)) {
      showToast(`Token doesn't look right — expected hex, got ${cleanToken.length} chars including non-hex`, 'error');
      return;
    }

    setRunning(true);
    setDone(0);
    setTotal(parsedDomains.length);
    setRows([]);
    const stats: Stats = { total: 0, cached: 0, scraped: 0, fallback: 0, elapsedMs: 0 };
    const failedBatches: number[] = [];

    const totalBatches = Math.ceil(parsedDomains.length / BATCH_SIZE);
    let aborted = false;

    for (let i = 0; i < parsedDomains.length; i += BATCH_SIZE) {
      const batchIdx = Math.floor(i / BATCH_SIZE) + 1;
      const batch = parsedDomains.slice(i, i + BATCH_SIZE);

      let success = false;
      let lastErr = '';
      for (let attempt = 1; attempt <= BATCH_RETRIES + 1; attempt++) {
        try {
          const res = await fetch('/api/admin/extract-brand-names', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              [ADMIN_TOKEN_HEADER]: cleanToken,
            },
            body: JSON.stringify({ domains: batch }),
          });

          // 401 is fatal — token won't suddenly become valid
          if (res.status === 401) {
            showToast('Admin token rejected — aborting', 'error');
            aborted = true;
            break;
          }

          if (!res.ok) {
            lastErr = (await res.text()).slice(0, 120);
            if (attempt <= BATCH_RETRIES) {
              await new Promise(r => setTimeout(r, BATCH_RETRY_BACKOFF_MS * attempt));
              continue;
            }
            break;
          }

          const data = await res.json() as { results: ExtractRow[]; stats: Stats };
          setRows(prev => [...prev, ...data.results]);
          stats.total += data.stats.total;
          stats.cached += data.stats.cached;
          stats.scraped += data.stats.scraped;
          stats.fallback += data.stats.fallback;
          stats.elapsedMs += data.stats.elapsedMs;
          setAggregateStats({ ...stats });
          setDone(prev => prev + data.results.length);
          success = true;
          break;
        } catch (err) {
          lastErr = (err as Error).message || 'network error';
          if (attempt <= BATCH_RETRIES) {
            await new Promise(r => setTimeout(r, BATCH_RETRY_BACKOFF_MS * attempt));
          }
        }
      }

      if (aborted) break;

      if (!success) {
        // Don't abort the whole run — record the failure and keep going.
        failedBatches.push(batchIdx);
        // Treat the failed batch's domains as "done" for progress purposes so
        // the bar reflects reality and the user can tell the run isn't stuck.
        setDone(prev => prev + batch.length);
        showToast(`Batch ${batchIdx}/${totalBatches} failed after retries: ${lastErr}`, 'error');
      }
    }

    setRunning(false);
    if (aborted) {
      // toast already shown
    } else if (failedBatches.length > 0) {
      const failedDomainCount = failedBatches.length * BATCH_SIZE;
      showToast(
        `Done with ${failedBatches.length} failed batch${failedBatches.length === 1 ? '' : 'es'} ` +
        `(~${failedDomainCount} domains skipped). Re-paste those to retry.`,
        'error',
      );
    } else {
      showToast(`Done — ${stats.total} domains processed`, 'success');
    }
  }, [running, adminToken, parsedDomains, showToast]);

  const downloadCsv = useCallback(() => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = 'domain,brandName,category,subCategory,source,categorySource,cached\n';
    const csv = header + rows.map(r => [
      escape(r.domain),
      escape(r.brandName),
      escape(r.category ?? ''),
      escape(r.subCategory ?? ''),
      escape(r.source),
      escape(r.categorySource ?? ''),
      r.cached,
    ].join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brand-names-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.domain.includes(q)
      || r.brandName.toLowerCase().includes(q)
      || (r.category?.toLowerCase().includes(q) ?? false)
      || (r.subCategory?.toLowerCase().includes(q) ?? false)
    );
  }, [rows, search]);

  const categorySourceColor = (src?: string) => {
    if (src === 'cached')       return 'text-blue-600 dark:text-blue-400';
    if (src === 'known-brand')  return 'text-emerald-600 dark:text-emerald-400';
    if (src === 'heuristic')    return 'text-amber-600 dark:text-amber-400';
    if (src === 'ai')           return 'text-purple-600 dark:text-purple-400';
    return 'text-slate-400 dark:text-neutral-500';
  };

  const sourceColor = (source: string) => {
    if (source === 'cached')              return 'text-blue-600 dark:text-blue-400';
    if (source.startsWith('og:'))         return 'text-emerald-600 dark:text-emerald-400';
    if (source === 'application-name')    return 'text-emerald-600 dark:text-emerald-400';
    if (source === 'title')               return 'text-amber-600 dark:text-amber-400';
    if (source.startsWith('fallback'))    return 'text-red-500 dark:text-red-400';
    return 'text-slate-500 dark:text-neutral-400';
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-2">
        <Tag size={22} className="text-ember-500" />
        <h2 className="text-[20px] font-bold text-slate-900 dark:text-white">Brand Name Extractor</h2>
      </div>
      <p className="text-[13px] text-slate-500 dark:text-neutral-400 mb-6">
        Paste up to 50,000 domains (one per line). For each, we&apos;ll resolve the
        <strong className="text-slate-700 dark:text-neutral-200"> brand name</strong>,
        <strong className="text-slate-700 dark:text-neutral-200"> category</strong>, and
        <strong className="text-slate-700 dark:text-neutral-200"> subcategory</strong>.
        Brand name comes from cached <code className="text-[12px] bg-slate-100 dark:bg-white/[0.06] px-1 rounded">company_meta</code> →
        scraped <code className="text-[12px] bg-slate-100 dark:bg-white/[0.06] px-1 rounded">og:site_name</code>/<code className="text-[12px] bg-slate-100 dark:bg-white/[0.06] px-1 rounded">og:title</code>/<code className="text-[12px] bg-slate-100 dark:bg-white/[0.06] px-1 rounded">&lt;title&gt;</code> →
        domain-stem fallback. Category/subcategory comes from cached <code className="text-[12px] bg-slate-100 dark:bg-white/[0.06] px-1 rounded">company_meta</code> →
        known-brand registry → Groq AI fallback for unknown domains.
      </p>

      {/* ── Inputs ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Admin token */}
        <div>
          <label className="text-[12px] font-semibold text-slate-500 dark:text-neutral-400 mb-1.5 block">
            Admin token
          </label>
          <input
            type="password"
            value={adminToken}
            onChange={e => setAdminToken(e.target.value)}
            placeholder="Paste your ADMIN_API_TOKEN here"
            className="w-full px-3 py-2 rounded-lg text-[13px] font-mono
                       bg-white dark:bg-white/[0.04]
                       border border-slate-200 dark:border-white/[0.1]
                       text-slate-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-ember-500"
          />
          <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-1">
            Same token used by Cloud Scheduler — kept in session memory only, not persisted.
          </p>
        </div>

        {/* File upload */}
        <div>
          <label className="text-[12px] font-semibold text-slate-500 dark:text-neutral-400 mb-1.5 block">
            Or upload a file (CSV / TXT, one domain per line)
          </label>
          <label className="cursor-pointer w-full px-3 py-2 rounded-lg text-[13px] font-medium
                            border border-dashed border-slate-300 dark:border-white/[0.15]
                            hover:border-ember-400 hover:bg-ember-50/30 dark:hover:bg-ember-500/[0.05]
                            text-slate-600 dark:text-neutral-300
                            inline-flex items-center justify-center gap-2 transition-all">
            <Upload size={14} />
            <span>Choose file…</span>
            <input
              type="file"
              accept=".csv,.txt,text/plain,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />
          </label>
        </div>
      </div>

      {/* Textarea */}
      <div className="mb-4">
        <label className="text-[12px] font-semibold text-slate-500 dark:text-neutral-400 mb-1.5 block flex items-center gap-2 flex-wrap">
          <span>Domains</span>
          <span className="text-slate-400 dark:text-neutral-500 font-normal">
            · {parseStats.raw} pasted →
            {' '}<span className="text-slate-700 dark:text-neutral-200 font-semibold">{parsedDomains.length} will be processed</span>
            {parseStats.repeatSlots > 0 && (
              <> · <span className="text-blue-600 dark:text-blue-400">{parseStats.repeatSlots} repeats kept</span></>
            )}
            {parseStats.invalid.length > 0 && (
              <> · <span className="text-red-600 dark:text-red-400" title={parseStats.invalid.slice(0, 20).join('\n')}>
                {parseStats.invalid.length} invalid (hover to see)
              </span></>
            )}
          </span>
        </label>
        <textarea
          value={rawInput}
          onChange={e => setRawInput(e.target.value)}
          placeholder={'hotstar.com\ntv9telugu.com\nnykaa.com\n...'}
          rows={8}
          className="w-full px-3 py-2 rounded-lg text-[13px] font-mono
                     bg-white dark:bg-white/[0.04]
                     border border-slate-200 dark:border-white/[0.1]
                     text-slate-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-ember-500"
        />
        {parseStats.invalid.length > 0 && (
          <details className="mt-1.5 text-[11px]">
            <summary className="cursor-pointer text-red-600 dark:text-red-400 hover:underline">
              Show {parseStats.invalid.length} rejected rows
            </summary>
            <div className="mt-1.5 p-2 rounded bg-red-50 dark:bg-red-950/20
                            border border-red-200 dark:border-red-900/40
                            font-mono text-[11px] text-red-700 dark:text-red-300
                            max-h-32 overflow-auto">
              {parseStats.invalid.map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
          </details>
        )}
        {parseStats.duplicates.length > 0 && (
          <details className="mt-1.5 text-[11px]">
            <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
              {parseStats.duplicates.length} domain{parseStats.duplicates.length === 1 ? '' : 's'} repeat in your list ({parseStats.repeatSlots} extra row{parseStats.repeatSlots === 1 ? '' : 's'})
            </summary>
            <div className="mt-1.5 p-2 rounded bg-blue-50 dark:bg-blue-950/20
                            border border-blue-200 dark:border-blue-900/40
                            font-mono text-[11px] text-blue-700 dark:text-blue-300
                            max-h-32 overflow-auto">
              {parseStats.duplicates.map(({ domain, count }) => (
                <div key={domain} className="flex justify-between gap-4">
                  <span>{domain}</span>
                  <span className="text-blue-500 dark:text-blue-400">×{count}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ── Actions ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onExtract}
          disabled={running || parsedDomains.length === 0 || !adminToken}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold
                     text-white bg-ember-500 hover:bg-ember-400 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors shadow-sm"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {running ? `Extracting… (${done}/${total})` : `Extract ${parsedDomains.length} domains`}
        </button>

        {rows.length > 0 && (
          <button
            onClick={downloadCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold
                       text-slate-700 dark:text-neutral-200
                       border border-slate-300 dark:border-white/[0.15]
                       hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors"
          >
            <Download size={14} />
            Download CSV ({rows.length})
          </button>
        )}

        {running && total > 0 && (
          <span className="text-[12px] text-slate-500 dark:text-neutral-400">
            {Math.round((done / total) * 100)}% · {Math.ceil((total - done) * 0.6)}s remaining (rough estimate)
          </span>
        )}
      </div>

      {/* ── Progress bar ───────────────────────────────────────────── */}
      {running && total > 0 && (
        <div className="mb-6">
          <div className="w-full h-1.5 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-ember-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* ── Stats ──────────────────────────────────────────────────── */}
      {(rows.length > 0 || running) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total" value={aggregateStats.total} />
          <StatCard label="From cache (DB)" value={aggregateStats.cached} hint="brandName already in company_meta" />
          <StatCard label="Scraped fresh" value={aggregateStats.scraped} hint="resolved from homepage HTML" />
          <StatCard label="Fallback" value={aggregateStats.fallback} hint="couldn't scrape — used domain stem" />
        </div>
      )}

      {/* ── Results table ──────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-200 dark:border-white/[0.08]
                          bg-slate-50 dark:bg-white/[0.02] flex items-center justify-between">
            <span className="text-[12px] font-semibold text-slate-600 dark:text-neutral-300">
              Results · {filteredRows.length}{search ? ` of ${rows.length}` : ''}
            </span>
            <input
              type="text"
              placeholder="Filter rows…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-[12px] px-2.5 py-1 rounded-md
                         bg-white dark:bg-white/[0.04]
                         border border-slate-200 dark:border-white/[0.1]
                         w-48"
            />
          </div>
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50 dark:bg-white/[0.02] sticky top-0">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                  <th className="px-4 py-2">Domain</th>
                  <th className="px-4 py-2">Brand Name</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Subcategory</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2">Cat. Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {filteredRows.map((r, i) => (
                  <tr key={`${r.domain}-${i}`} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-2 font-mono text-slate-600 dark:text-neutral-300">{r.domain}</td>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{r.brandName}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-neutral-200">
                      {r.category ?? <span className="text-slate-400 dark:text-neutral-500">—</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-neutral-300">
                      {r.subCategory ?? <span className="text-slate-400 dark:text-neutral-500">—</span>}
                    </td>
                    <td className={`px-4 py-2 text-[11px] font-mono ${sourceColor(r.source)}`}>{r.source}</td>
                    <td className={`px-4 py-2 text-[11px] font-mono ${categorySourceColor(r.categorySource)}`}>
                      {r.categorySource ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty hint ─────────────────────────────────────────────── */}
      {rows.length === 0 && !running && (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08]
                        p-8 text-center text-slate-400 dark:text-neutral-500">
          <AlertCircle size={20} className="mx-auto mb-2 opacity-50" />
          <p className="text-[13px]">
            Paste domains and click <strong>Extract</strong> to begin. Results will stream in batches of {BATCH_SIZE}.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-white/[0.08] p-3 bg-white dark:bg-white/[0.02]">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-neutral-400">{label}</div>
      <div className="text-[20px] font-bold text-slate-900 dark:text-white mt-0.5">{value.toLocaleString()}</div>
      {hint && <div className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5">{hint}</div>}
    </div>
  );
}
