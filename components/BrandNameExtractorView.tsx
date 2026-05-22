'use client';

import { useCallback, useMemo, useState } from 'react';
import { Upload, Download, Loader2, Check, AlertCircle, Tag } from 'lucide-react';

type ExtractRow = {
  domain: string;
  brandName: string;
  source: string;
  cached: boolean;
};

type Stats = {
  total: number;
  cached: number;
  scraped: number;
  fallback: number;
  elapsedMs: number;
};

const BATCH_SIZE = 500;
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

  const parsedDomains = useMemo(() => {
    const raw = rawInput
      .split(/[\n,]/)
      .map(s => s.trim())
      .filter(Boolean);
    // Light client-side normalization for the preview count
    const normalized = raw.map(d =>
      d.replace(/^https?:\/\//i, '').replace(/^www\d*\./i, '').replace(/\/.*$/, '').toLowerCase()
    );
    return [...new Set(normalized)].filter(d => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d));
  }, [rawInput]);

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

    setRunning(true);
    setDone(0);
    setTotal(parsedDomains.length);
    setRows([]);
    const stats: Stats = { total: 0, cached: 0, scraped: 0, fallback: 0, elapsedMs: 0 };

    try {
      for (let i = 0; i < parsedDomains.length; i += BATCH_SIZE) {
        const batch = parsedDomains.slice(i, i + BATCH_SIZE);
        const res = await fetch('/api/admin/extract-brand-names', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [ADMIN_TOKEN_HEADER]: adminToken,
          },
          body: JSON.stringify({ domains: batch }),
        });
        if (res.status === 401) {
          showToast('Admin token rejected', 'error');
          setRunning(false);
          return;
        }
        if (!res.ok) {
          const errText = await res.text();
          showToast(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${errText.slice(0, 120)}`, 'error');
          setRunning(false);
          return;
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
      }
      showToast(`Done — ${stats.total} domains processed`, 'success');
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`, 'error');
    } finally {
      setRunning(false);
    }
  }, [running, adminToken, parsedDomains, showToast]);

  const downloadCsv = useCallback(() => {
    const header = 'domain,brandName,source,cached\n';
    const csv = header + rows.map(r =>
      `"${r.domain}","${r.brandName.replace(/"/g, '""')}","${r.source}",${r.cached}`
    ).join('\n');
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
    return rows.filter(r => r.domain.includes(q) || r.brandName.toLowerCase().includes(q));
  }, [rows, search]);

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
        Paste up to 10,000 domains (one per line). For each, we&apos;ll resolve the real company name —
        scraping <code className="text-[12px] bg-slate-100 dark:bg-white/[0.06] px-1 rounded">og:site_name</code> → <code className="text-[12px] bg-slate-100 dark:bg-white/[0.06] px-1 rounded">og:title</code> → <code className="text-[12px] bg-slate-100 dark:bg-white/[0.06] px-1 rounded">&lt;title&gt;</code>,
        cleaning publisher trails, and falling back to title-case of the domain stem when scraping fails.
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
        <label className="text-[12px] font-semibold text-slate-500 dark:text-neutral-400 mb-1.5 block">
          Domains  <span className="text-slate-400 dark:text-neutral-500">·  {parsedDomains.length} valid, deduped</span>
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
                  <th className="px-4 py-2">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {filteredRows.map((r) => (
                  <tr key={r.domain} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-2 font-mono text-slate-600 dark:text-neutral-300">{r.domain}</td>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{r.brandName}</td>
                    <td className={`px-4 py-2 text-[11px] font-mono ${sourceColor(r.source)}`}>{r.source}</td>
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
