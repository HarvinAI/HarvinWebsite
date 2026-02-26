'use client';

import { useEffect, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';

const MAX_MONTH = 13;
const MAX_LEADS = 50;
const RELEASE_LEADS = 48;
const RELEASE_PROGRESS = 0.84;

const MARKER_X = 32;   // compact graph — matches sr.mov reference
const MONTH_STEP = 13; // % per month — labels never crowd

const styles = `
  @keyframes graphGlow {
    0% { opacity: 0.24; }
    50% { opacity: 0.46; }
    100% { opacity: 0.24; }
  }
  .animate-graph-glow {
    animation: graphGlow 3.4s ease-in-out infinite;
  }

  @keyframes tailSweep {
    0% { transform: translateX(-120%); opacity: 0; }
    20% { opacity: 0.32; }
    80% { opacity: 0.32; }
    100% { transform: translateX(120%); opacity: 0; }
  }
  .animate-tail-sweep {
    animation: tailSweep 1.4s linear infinite;
  }
`;

type Milestone = { month: number; label: string; chip: string };

// Scroll-phase milestones (months 1–13)
const MILESTONES: Milestone[] = [
  { month: 4,  label: 'D2C watchlists activated',      chip: 'WATCHLIST' },
  { month: 7,  label: 'Funding & hiring signals live',  chip: 'SIGNALS'   },
  { month: 9,  label: 'Intent scores calibrated',       chip: 'INTENT'    },
  { month: 12, label: 'Outreach pipeline automated',    chip: 'PIPELINE'  },
];

// Auto-phase milestones keyed to the month when that lead count is first reached
// month = MAX_MONTH + ln(target / MAX_LEADS) / AUTO_GROWTH_RATE
const AUTO_GROWTH_RATE = 0.01346;
const AUTO_MILESTONES: Milestone[] = [
  { month: 65,  label: '100 D2C opportunities / mo',  chip: '100 OPPS'  },
  { month: 184, label: '500 D2C opportunities / mo',  chip: '500 OPPS'  },
  { month: 354, label: '5K D2C opportunities / mo',   chip: '5K OPPS'   },
  { month: 526, label: '50K D2C opportunities / mo',  chip: '50K OPPS'  },
  { month: 630, label: '2.5L qualified brands / mo',  chip: '2.5L OPPS' },
  { month: 712, label: '10L qualified brands / mo',   chip: '10L OPPS'  },
];

// Cycle length: months until leads hit 10 lakh, then reset
const AUTO_CYCLE_MONTHS = Math.ceil(Math.log(1_000_000 / MAX_LEADS) / AUTO_GROWTH_RATE);
// Month axis: slow (0.3 /sec) so every label is readable
const MONTH_DISPLAY_SPEED = 0.3;
// Lead counter: fast (10× equivalent) for an impressive climbing number
const LEAD_COUNT_SPEED = 10;

export default function TheData() {
  const containerRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  // Single elapsed-seconds timer; month axis + lead counter derive at different speeds
  const [autoElapsed, setAutoElapsed] = useState(-1);

  useEffect(() => {
    const onScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) { setProgress(0); return; }
      setProgress(Math.min(Math.max(-rect.top, 0), scrollable) / scrollable);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const isScrollComplete = progress >= 1;
  useEffect(() => {
    if (!isScrollComplete) { setAutoElapsed(-1); return; }
    const startTime = Date.now();
    let handle: number;
    const tick = () => {
      setAutoElapsed((Date.now() - startTime) / 1000);
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [isScrollComplete]);

  // ── Scroll-driven values ──────────────────────────────────────────────────
  const pinnedProgress = Math.min(progress / RELEASE_PROGRESS, 1);
  const eased = 1 - Math.pow(1 - pinnedProgress, 2.15);
  const tailProgress = progress <= RELEASE_PROGRESS
    ? 0
    : (progress - RELEASE_PROGRESS) / (1 - RELEASE_PROGRESS);
  const monthFloat = 1 + eased * (MAX_MONTH - 1);
  const month = Math.min(MAX_MONTH, Math.max(1, Math.floor(monthFloat)));
  const pinnedLeads = Math.round(eased * RELEASE_LEADS);
  const leadCount = Math.min(MAX_LEADS, pinnedLeads + Math.round(tailProgress * (MAX_LEADS - RELEASE_LEADS)));

  // Graph shape — fills up as eased → 1
  const leftTop  = 72 - 8  * eased;
  const rightTop = 66 - 28 * eased - 9 * tailProgress;

  // ── Auto-phase display values ─────────────────────────────────────────────
  const isAuto = autoElapsed >= 0;

  // Month axis moves slowly — readable
  const autoMonthFloat = isAuto
    ? MAX_MONTH + (autoElapsed * MONTH_DISPLAY_SPEED) % AUTO_CYCLE_MONTHS
    : 0;
  // Lead counter runs fast — impressive
  const autoLeadMonth = isAuto
    ? MAX_MONTH + (autoElapsed * LEAD_COUNT_SPEED) % AUTO_CYCLE_MONTHS
    : MAX_MONTH;

  const displayMonthFloat = isAuto ? autoMonthFloat  : monthFloat;
  const displayMonth      = isAuto ? Math.floor(autoMonthFloat) : month;
  const displayLeadCount  = isAuto
    ? Math.round(MAX_LEADS * Math.exp(AUTO_GROWTH_RATE * (autoLeadMonth - MAX_MONTH)))
    : leadCount;
  const displayLeadStr = displayLeadCount >= 1000
    ? displayLeadCount.toLocaleString()
    : String(displayLeadCount);

  const getMonthLabelX = (m: number) => MARKER_X + (m - displayMonthFloat) * MONTH_STEP;

  const activeMilestone = MILESTONES.reduce((acc, item, idx) =>
    month >= item.month ? idx : acc, 0);
  const activeItem   = MILESTONES[Math.max(0, activeMilestone)];
  const signalCount  = Math.round(44 + eased * 206);
  const sequenceCount = Math.round(6 + eased * 54);
  // Monthly new leads in auto phase (exponential delta per month)
  const monthlyNewLeads = isAuto
    ? Math.max(1, Math.round(displayLeadCount * (1 - Math.exp(-AUTO_GROWTH_RATE))))
    : 0;
  const monthlyNewLeadsStr = monthlyNewLeads >= 1000
    ? monthlyNewLeads.toLocaleString()
    : String(monthlyNewLeads);

  // Which milestones to render — scroll phase vs auto phase
  const visibleMilestones: (Milestone & { isCurrent: boolean; isPast: boolean })[] = isAuto
    ? AUTO_MILESTONES.map((item) => ({
        ...item,
        isCurrent: Math.abs(item.month - autoMonthFloat) < 0.6,
        isPast: item.month < autoMonthFloat,
      }))
    : MILESTONES.map((item) => ({
        ...item,
        isCurrent: month === item.month,
        isPast: month > item.month,
      }));

  return (
    <section
      ref={containerRef}
      className="relative border-t border-slate-200 bg-slate-50 dark:border-white/[0.06] dark:bg-[#040404]"
      style={{ height: '250vh' }}
    >
      <div className="sticky top-[64px] h-[calc(100vh-64px)] overflow-hidden px-6 py-8 md:px-10 lg:px-16 lg:py-10">
        <style>{styles}</style>

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(201,76,30,0.07),transparent_45%)] dark:bg-[radial-gradient(circle_at_18%_24%,rgba(201,76,30,0.14),transparent_45%)]" />

        <div className="relative mx-auto mt-0 flex h-full w-full max-w-[1280px] flex-col">

          {/* Header */}
          <div className="flex flex-col gap-7 md:flex-row md:items-start md:justify-between">
            <div className="max-w-[620px]">
              <h2 className="text-[36px] font-semibold leading-[1.03] tracking-[-0.025em] text-slate-900 dark:text-white md:text-[44px]">
                The longer it runs,<br />the stronger it gets
              </h2>
              <p className="mt-4 max-w-[620px] text-[18px] leading-relaxed text-slate-700 dark:text-white/64 md:text-[16px]">
                More D2C brands tracked, more funding signals captured, more buying windows identified. Every month Harvin compounds your pipeline.
              </p>
            </div>
            <div className="md:pt-2 md:text-right">
              <p className="font-display text-[40px] leading-none tracking-[-0.03em] text-slate-900 dark:text-white md:text-[44px]">
                {displayLeadStr}+
              </p>
              <p className="text-[18px] font-medium leading-none text-slate-700 dark:text-white/72 md:text-[24px]">D2C opportunities / month</p>
              <p className="mt-2 text-[12px] text-slate-500 dark:text-white/32 md:text-[16px]">Identified by Month {displayMonth}</p>
            </div>
          </div>

          {/* Graph */}
          <div className="relative mt-4 flex-1 min-h-0 h-[300px] md:h-[330px] lg:h-[370px]">

            {/* Baseline */}
            <div className="absolute bottom-14 left-0 right-0 h-px bg-slate-400/45 dark:bg-white/[0.14]" />

            {/* Filled area */}
            <div
              className="absolute bottom-14 left-0 h-[58%] overflow-hidden"
              style={{
                width: `${MARKER_X}%`,
                clipPath: `polygon(0% ${leftTop}%, 0% 100%, 100% 100%, 100% ${rightTop}%)`,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-[#C94C1E]/85 via-[#A93D18]/72 to-[#5E220E]/28 dark:from-[#C94C1E]/82 dark:via-[#A93D18]/72 dark:to-[#3D160A]/22" />
              <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-white/10 to-transparent dark:from-black/70 dark:via-black/30" />
              <div className="animate-graph-glow absolute inset-0 bg-gradient-to-r from-transparent via-[#F48E56]/30 to-transparent" />
              {tailProgress > 0 && (
                <div
                  className="animate-tail-sweep absolute inset-y-0 w-[36%] bg-gradient-to-r from-transparent via-[#FDBA74]/42 to-transparent"
                  style={{ left: `${58 + tailProgress * 28}%` }}
                />
              )}
            </div>

            {/* Marker — dashed line + dot */}
            <div
              className="absolute bottom-14 h-[58%] w-px border-l border-dashed border-slate-400/60 dark:border-white/30"
              style={{ left: `${MARKER_X}%` }}
            />
            <div
              className="absolute bottom-[calc(58%+14px)] h-2 w-2 -translate-x-1/2 rounded-full bg-slate-500/60 dark:bg-white/52"
              style={{ left: `${MARKER_X}%` }}
            />

            {/* Milestone chips — scroll with month axis, shown in both phases */}
            {visibleMilestones.map((item) => {
              const x = MARKER_X + (item.month - displayMonthFloat) * MONTH_STEP;
              if (x < -18 || x > 112) return null;
              const opacity = item.isCurrent ? 1 : item.isPast ? 0.1 : 0.32;

              return (
                <div
                  key={item.month}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${x}%`, bottom: 'calc(58% + 10px)', opacity }}
                >
                  {/* Connector pointer line from chip down to graph top */}
                  <div className="mx-auto mb-1 w-px bg-slate-400/50 dark:bg-white/25" style={{ height: '14px' }} />

                  <div className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] ${
                    item.isCurrent
                      ? 'bg-[#C94C1E] text-white shadow-[0_2px_8px_rgba(201,76,30,0.35)]'
                      : 'border border-slate-300/60 bg-slate-100/80 text-slate-500 dark:border-white/15 dark:bg-white/8 dark:text-white/55'
                  }`}>
                    {item.chip}
                  </div>

                  {/* Label — only for current and future (not past) */}
                  {!item.isPast && (
                    <p className={`mt-0.5 whitespace-nowrap text-[12px] font-medium ${
                      item.isCurrent
                        ? 'text-slate-800 dark:text-white'
                        : 'text-slate-400 dark:text-white/38'
                    }`}>
                      {item.label}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Link2 icon */}
            <div className="absolute bottom-[20%] left-[4%] flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300/70 bg-white/70 text-slate-700 shadow-[0_0_18px_rgba(201,76,30,0.3)] dark:border-white/18 dark:bg-black/42 dark:text-white/80">
              <Link2 size={18} strokeWidth={1.8} />
            </div>

            {/* Scrolling month labels */}
            <div className="absolute bottom-0 left-0 right-0 overflow-hidden" style={{ height: '56px' }}>
              {(() => {
                const center = Math.round(displayMonthFloat);
                return Array.from({ length: 13 }, (_, i) => center - 6 + i)
                  .filter((m) => m >= 1)
                  .map((m) => {
                    const x = getMonthLabelX(m);
                    if (x < -10 || x > 110) return null;
                    const isCurrent = m === center;
                    const isPast = m < displayMonthFloat;
                    return (
                      <span
                        key={m}
                        className={[
                          'absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-[13px] tracking-[0.04em]',
                          isCurrent
                            ? 'font-semibold text-slate-900 dark:text-white'
                            : isPast
                              ? 'font-medium text-slate-400/55 dark:text-white/18'
                              : 'font-medium text-slate-500/70 dark:text-white/30',
                        ].join(' ')}
                        style={{ left: `${x}%` }}
                      >
                        MONTH {m}
                      </span>
                    );
                  });
              })()}
            </div>

            {/* Scroll-phase text overlays */}
            {!isAuto && (
              <>
                <div
                  className="absolute bottom-[calc(58%+86px)] text-[28px] font-semibold text-slate-900 dark:text-white"
                  style={{ left: `${MARKER_X + 5}%` }}
                >
                  {signalCount} D2C buying signals detected
                </div>
                <div className="absolute bottom-[calc(58%+62px)] left-[2%] text-[13px] text-slate-600 dark:text-white/52">
                  Month {activeItem.month}: {activeItem.label.toLowerCase()}
                </div>
                <div
                  className="absolute bottom-[calc(58%+48px)] text-[13px] text-slate-500 dark:text-white/44"
                  style={{ left: `${MARKER_X + 5}%` }}
                >
                  {sequenceCount} outreach sequences launched
                </div>
              </>
            )}

            {/* Auto-phase new leads overlay */}
            {isAuto && (
              <div
                className="absolute bottom-[calc(58%+62px)] text-slate-900 dark:text-white"
                style={{ left: `${MARKER_X + 5}%` }}
              >
                <span className="text-[28px] font-semibold">+{monthlyNewLeadsStr}</span>
                <span className="ml-2 text-[14px] font-medium text-slate-500 dark:text-white/50">New Leads</span>
                <p className="mt-0.5 text-[13px] text-slate-400 dark:text-white/36">Month {displayMonth}</p>
              </div>
            )}

            {/* Boost phase badge */}
            {displayLeadCount >= RELEASE_LEADS && (
              <div className="absolute right-0 top-0 rounded-full border border-[#C94C1E]/40 bg-[#C94C1E]/10 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-[#C94C1E] dark:text-[#F48E56]">
                BOOST PHASE
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  );
}
