"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Edit3,
  Headphones,
  List as ListIcon,
  type LucideIcon,
  Mic,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIELTSTitle } from "@/lib/utils";

type DashboardTab =
  | "home"
  | "Reading"
  | "Listening"
  | "Writing"
  | "Speaking"
  | "FullTest";

type ModuleTab = Exclude<DashboardTab, "home" | "FullTest">;

type DashboardUnit = {
  id: string;
  title: string;
  category: string;
  createdAt?: string | Date;
};

type HistoryEntry = {
  id: string;
  unitId: string;
  category: ModuleTab;
  unitTitle: string;
  score: number;
  date: string;
  timeSpent?: number;
};

type AnalyticsPayload = {
  history?: HistoryEntry[];
};

type ModuleConfig = {
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  soft: string;
};

const MODULES: Record<ModuleTab, ModuleConfig> = {
  Reading: {
    label: "模考阅读",
    short: "Reading",
    description: "精确定位段落、同义替换与题型策略。",
    icon: BookOpen,
    accent: "text-sky-700",
    soft: "from-sky-100 via-white to-cyan-50",
  },
  Listening: {
    label: "自动听力",
    short: "Listening",
    description: "原声材料、转录联动与复盘更顺滑。",
    icon: Headphones,
    accent: "text-indigo-700",
    soft: "from-indigo-100 via-white to-blue-50",
  },
  Writing: {
    label: "精批写作",
    short: "Writing",
    description: "TR / CC / LR / GRA 维度反馈直达问题。",
    icon: Edit3,
    accent: "text-emerald-700",
    soft: "from-emerald-100 via-white to-teal-50",
  },
  Speaking: {
    label: "流式口语",
    short: "Speaking",
    description: "实时录入、机考式作答与答后点评。",
    icon: Mic,
    accent: "text-amber-700",
    soft: "from-amber-100 via-white to-orange-50",
  },
};

function getBookLabel(title: string) {
  const match = title.match(/(?:剑|C)(\d+)/i);
  return match ? `Cambridge ${match[1]}` : "Other";
}

function getTestLabel(title: string) {
  const match = title.match(/(?:Test|T)[\s-]*(\d+)/i);
  return match ? `Test ${match[1]}` : "Independent";
}

function getNumericSuffix(value: string) {
  return Number.parseInt(value.replace(/[^0-9]/g, ""), 10) || 0;
}

function formatScore(score: number | null | undefined) {
  if (score === null || score === undefined || Number.isNaN(score)) return "--";
  return (Math.round(score * 2) / 2).toFixed(1);
}

function formatHistoryDate(value: string) {
  return new Date(value).toLocaleString();
}

function isUnitInModule(unit: DashboardUnit, tab: DashboardTab) {
  if (tab === "Reading") {
    return unit.category === "Reading/Listening" && unit.title.includes("Passage");
  }
  if (tab === "Listening") {
    return unit.category === "Reading/Listening" && unit.title.includes("Part");
  }
  if (tab === "Writing") return unit.category === "Writing";
  if (tab === "Speaking") return unit.category === "Speaking";
  return true;
}

function getUnitShortTitle(title: string) {
  const formatted = formatIELTSTitle(title);
  return formatted.replace(/Cambridge \d+ Test \d+ /i, "").trim() || formatted;
}

function getGroupedTests(units: DashboardUnit[]) {
  const groups = new Map<string, DashboardUnit[]>();

  units.forEach((unit) => {
    const testLabel = getTestLabel(unit.title);
    const current = groups.get(testLabel) || [];
    current.push(unit);
    groups.set(testLabel, current);
  });

  return Array.from(groups.entries()).sort((a, b) => {
    const numericDiff = getNumericSuffix(a[0]) - getNumericSuffix(b[0]);
    if (numericDiff !== 0) return numericDiff;
    return a[0].localeCompare(b[0], undefined, { numeric: true });
  });
}

function HeroMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1.75rem] border border-white/70 bg-white/70 px-5 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function ModuleShortcut({
  tab,
  active,
  count,
  onClick,
}: {
  tab: ModuleTab;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const config = MODULES[tab];
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-[1.8rem] border p-5 text-left transition-all ${
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-[0_22px_45px_rgba(15,23,42,0.22)]"
          : `border-white/70 bg-gradient-to-br ${config.soft} shadow-[0_18px_40px_rgba(15,23,42,0.06)] hover:-translate-y-0.5`
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`rounded-2xl p-3 ${active ? "bg-white/12" : "bg-white/80"}`}>
          <Icon className={`h-5 w-5 ${active ? "text-white" : config.accent}`} />
        </div>
        <Badge className={active ? "bg-white/12 text-white hover:bg-white/12" : "bg-slate-900 text-white hover:bg-slate-900"}>
          {count} 套
        </Badge>
      </div>
      <h3 className="mt-6 text-xl font-black tracking-tight">{config.label}</h3>
      <p className={`mt-2 text-sm ${active ? "text-white/72" : "text-slate-600"}`}>{config.description}</p>
    </button>
  );
}

function EmptyState({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-white/75 px-6 text-center shadow-[0_15px_35px_rgba(15,23,42,0.04)] backdrop-blur-xl">
      <div className="mb-5 rounded-full border border-slate-200 bg-slate-50 p-4">{icon}</div>
      <p className="text-base font-semibold text-slate-600">{title}</p>
    </div>
  );
}

function TestGroupedView({
  units,
  history,
}: {
  units: DashboardUnit[];
  history: HistoryEntry[];
}) {
  if (!units.length) {
    return <EmptyState title="当前筛选条件下没有对应题组。" icon={<Sparkles className="h-5 w-5 text-slate-500" />} />;
  }

  const groups = getGroupedTests(units);

  return (
    <div className="space-y-6">
      {groups.map(([testLabel, items]) => (
        <section
          key={testLabel}
          className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/78 shadow-[0_24px_60px_rgba(15,23,42,0.07)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Module Batch</p>
              <h3 className="mt-1 text-xl font-black text-slate-900">{testLabel}</h3>
            </div>
            <Badge className="bg-slate-900 text-white hover:bg-slate-900">{items.length} 项</Badge>
          </div>
          <div className="divide-y divide-slate-100">
            {items
              .slice()
              .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))
              .map((unit) => {
                const attempts = history
                  .filter((entry) => entry.unitId === unit.id)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const latest = attempts[0];

                return (
                  <div key={unit.id} className="grid gap-5 px-6 py-5 lg:grid-cols-[minmax(0,1.2fr)_200px_180px_220px] lg:items-center">
                    <div>
                      <p className="text-sm font-semibold text-slate-400">{formatIELTSTitle(unit.title)}</p>
                      <h4 className="mt-1 text-lg font-bold text-slate-900">{getUnitShortTitle(unit.title)}</h4>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Latest Score</p>
                      <p className="mt-2 text-xl font-black text-slate-900">{latest ? formatScore(latest.score) : "--"}</p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Attempt History</p>
                      <div className="mt-2 text-sm text-slate-600">
                        {attempts.length ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button type="button" className="font-semibold text-slate-900 underline decoration-dashed underline-offset-4">
                                {attempts.length} 次练习记录
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-xl rounded-[2rem] border-white/70 bg-white/92 backdrop-blur-2xl">
                              <DialogHeader>
                                <DialogTitle>{formatIELTSTitle(unit.title)}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-3">
                                {attempts.map((attempt, index) => (
                                  <div key={attempt.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                                    <div>
                                      <p className="font-semibold text-slate-900">第 {attempts.length - index} 次练习</p>
                                      <p className="text-sm text-slate-500">{formatHistoryDate(attempt.date)}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <span className="text-sm font-bold text-slate-800">Band {formatScore(attempt.score)}</span>
                                      <Link href={`/review/${unit.id}?submissionId=${attempt.id}`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                                        查看详解
                                      </Link>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <span className="font-medium text-slate-400">未作答</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-start gap-3 lg:justify-end">
                      <Link href={`/eval/${unit.id}`}>
                        <Button className="rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800">
                          {latest ? "继续作答" : "开始作答"}
                        </Button>
                      </Link>
                      <Link href={`/review/${unit.id}`}>
                        <Button variant="outline" className="rounded-full px-5">
                          <ListIcon className="mr-2 h-4 w-4" /> 详解
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}

function FullTestGroupedView({ units }: { units: DashboardUnit[] }) {
  if (!units.length) {
    return <EmptyState title="当前卷册下没有完整模考组合。" icon={<BarChart3 className="h-5 w-5 text-slate-500" />} />;
  }

  const groups = getGroupedTests(units);

  return (
    <div className="space-y-6">
      {groups.map(([testLabel, items]) => {
        const listening = items.find((unit) => isUnitInModule(unit, "Listening"));
        const reading = items.find((unit) => isUnitInModule(unit, "Reading"));
        const writing = items.find((unit) => isUnitInModule(unit, "Writing"));
        const speaking = items.find((unit) => isUnitInModule(unit, "Speaking"));

        const flowIds = items
          .filter((unit) => unit.category !== "Speaking")
          .slice()
          .sort((a, b) => {
            const weight = (value: DashboardUnit) => {
              if (isUnitInModule(value, "Listening")) return 1;
              if (isUnitInModule(value, "Reading")) return 2;
              if (isUnitInModule(value, "Writing")) return 3;
              return 4;
            };
            const diff = weight(a) - weight(b);
            if (diff !== 0) return diff;
            return a.title.localeCompare(b.title, undefined, { numeric: true });
          })
          .map((unit) => unit.id);

        const flowHref = flowIds.length ? `/eval/${flowIds[0]}?flow=${flowIds.join(",")}` : "#";

        return (
          <section
            key={testLabel}
            className="rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.07)] backdrop-blur-xl"
          >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Full Test Engine</p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">{testLabel}</h3>
              </div>
              {flowIds.length > 0 && (
                <Link href={flowHref}>
                  <Button className="rounded-full bg-slate-900 px-6 text-white hover:bg-slate-800">
                    启动完整模考 <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {([
                ["Listening", listening],
                ["Reading", reading],
                ["Writing", writing],
                ["Speaking", speaking],
              ] as Array<[ModuleTab, DashboardUnit | undefined]>).map(([tab, unit]) => {
                const config = MODULES[tab];
                const Icon = config.icon;

                return unit ? (
                  <Link
                    key={tab}
                    href={`/eval/${unit.id}`}
                    className={`rounded-[1.75rem] border border-white/70 bg-gradient-to-br ${config.soft} p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)] transition-transform hover:-translate-y-0.5`}
                  >
                    <Icon className={`h-6 w-6 ${config.accent}`} />
                    <h4 className="mt-5 text-lg font-black text-slate-900">{config.short}</h4>
                    <p className="mt-2 text-sm text-slate-600">{getUnitShortTitle(unit.title)}</p>
                    <span className="mt-5 inline-flex items-center text-sm font-semibold text-slate-900">
                      进入单模块 <ArrowRight className="ml-2 h-4 w-4" />
                    </span>
                  </Link>
                ) : (
                  <div key={tab} className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50/80 p-5 text-slate-400">
                    <Icon className="h-6 w-6" />
                    <h4 className="mt-5 text-lg font-black">{config.short}</h4>
                    <p className="mt-2 text-sm">暂无模块</p>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function DashboardClient({ allUnits }: { allUnits: DashboardUnit[] }) {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<DashboardTab>("home");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [selectedBook, setSelectedBook] = useState<string>(getBookLabel(allUnits[0]?.title || "Other"));

  useEffect(() => {
    if (!session?.user) return;

    const controller = new AbortController();

    fetch("/api/analytics", { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: AnalyticsPayload) => {
        setHistory(payload.history ?? []);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error(error);
      });

    return () => controller.abort();
  }, [session]);

  const books = useMemo(() => {
    const found = new Set(allUnits.map((unit) => getBookLabel(unit.title)));
    return Array.from(found).sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return getNumericSuffix(a) - getNumericSuffix(b);
    });
  }, [allUnits]);

  const effectiveSelectedBook = books.includes(selectedBook) ? selectedBook : books[0] || "Other";

  const bankStats = useMemo(
    () => ({
      Reading: allUnits.filter((unit) => isUnitInModule(unit, "Reading")).length,
      Listening: allUnits.filter((unit) => isUnitInModule(unit, "Listening")).length,
      Writing: allUnits.filter((unit) => isUnitInModule(unit, "Writing")).length,
      Speaking: allUnits.filter((unit) => isUnitInModule(unit, "Speaking")).length,
    }),
    [allUnits],
  );

  const unitsByBook = useMemo(
    () => allUnits.filter((unit) => getBookLabel(unit.title) === effectiveSelectedBook),
    [allUnits, effectiveSelectedBook],
  );

  const filteredUnits = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return unitsByBook.filter((unit) => {
      const matchesTab = activeTab === "home" || activeTab === "FullTest" ? true : isUnitInModule(unit, activeTab);
      const matchesQuery =
        !normalizedQuery || formatIELTSTitle(unit.title).toLowerCase().includes(normalizedQuery);
      return matchesTab && matchesQuery;
    });
  }, [activeTab, query, unitsByBook]);

  const currentStats = useMemo(() => {
    const scopedHistory =
      activeTab === "home" || activeTab === "FullTest"
        ? history
        : history.filter((entry) => entry.category === activeTab);

    return {
      total: scopedHistory.length,
      best: scopedHistory.length
        ? Math.max(...scopedHistory.map((entry) => Number(entry.score) || 0))
        : 0,
    };
  }, [activeTab, history]);

  const greeting = session?.user?.name || session?.user?.email?.split("@")[0] || "Scholar";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eef2f7] pb-20 text-slate-900 selection:bg-sky-200/70">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_34%),radial-gradient(circle_at_80%_15%,_rgba(251,191,36,0.18),_transparent_28%),linear-gradient(180deg,#f7fafc_0%,#edf2f7_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:42px_42px]" />

      <nav className="sticky top-0 z-40 border-b border-white/60 bg-white/72 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => setActiveTab("home")} className="flex items-center gap-3 text-left">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-lg font-black text-white shadow-lg shadow-slate-900/15">
              LS
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.34em] text-slate-500">LinguoSovereign</p>
              <p className="text-sm font-semibold text-slate-900">AI IELTS Studio</p>
            </div>
          </button>

          <div className="hidden items-center gap-2 xl:flex">
            {(["Reading", "Listening", "Writing", "Speaking", "FullTest"] as DashboardTab[]).map((tab) => (
              <Button
                key={tab}
                variant="ghost"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-4 ${activeTab === tab ? "bg-slate-900 text-white hover:bg-slate-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
              >
                {tab === "FullTest" ? "全真考" : MODULES[tab as ModuleTab].label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {status === "loading" ? (
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            ) : session ? (
              <>
                <div className="hidden text-right md:block">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Current Candidate</p>
                  <p className="text-sm font-semibold text-slate-900">{greeting}</p>
                </div>
                <Link href="/dashboard/analytics">
                  <Button variant="outline" className="rounded-full">
                    <BarChart3 className="mr-2 h-4 w-4" /> 数据面板
                  </Button>
                </Link>
                <Link href="/profile">
                  <Button variant="ghost" className="rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                    <Settings className="mr-2 h-4 w-4" /> 资料
                  </Button>
                </Link>
                <Button onClick={() => signOut()} variant="ghost" className="rounded-full text-red-600 hover:bg-red-50 hover:text-red-700">
                  登出
                </Button>
              </>
            ) : (
              <>
                <Link href="/register">
                  <Button variant="ghost" className="rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                    注册
                  </Button>
                </Link>
                <Link href="/login">
                  <Button className="rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800">登入题库</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[1380px] px-4 pt-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 xl:hidden">
          {(["home", "Reading", "Listening", "Writing", "Speaking", "FullTest"] as DashboardTab[]).map((tab) => (
            <Button
              key={tab}
              variant="ghost"
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 rounded-full px-4 ${activeTab === tab ? "bg-slate-900 text-white hover:bg-slate-900" : "bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900"}`}
            >
              {tab === "home" ? "首页" : tab === "FullTest" ? "全真考" : MODULES[tab as ModuleTab].label}
            </Button>
          ))}
        </div>

        {activeTab === "home" ? (
          <>
            <section className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_440px] lg:items-center">
              <div>
                <Badge className="rounded-full bg-slate-900 px-4 py-1 text-white hover:bg-slate-900">
                  Brand-led IELTS Workspace
                </Badge>
                <h1 className="mt-6 max-w-3xl text-3xl font-black leading-[1.15] tracking-tight text-slate-950 md:text-4xl xl:text-[52px]">
                  更安静地组织真题、评分与复盘。
                  <span className="mt-2 block bg-gradient-to-r from-sky-600 via-indigo-600 to-amber-500 bg-clip-text text-transparent">
                    让每次练习都更连贯一点。
                  </span>
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                  LinguoSovereign 把 Cambridge 真题、客观题批改、主观题反馈和历史追踪放进同一条练习路径里，界面更克制，推进也更顺手。
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button onClick={() => setActiveTab("FullTest")} className="rounded-full bg-slate-900 px-6 text-white hover:bg-slate-800">
                    开启完整模考 <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Link href="/dashboard/analytics">
                    <Button variant="outline" className="rounded-full px-6">
                      查看我的数据
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <HeroMetric label="Reading Sets" value={bankStats.Reading} />
                <HeroMetric label="Listening Sets" value={bankStats.Listening} />
                <HeroMetric label="Writing Tasks" value={bankStats.Writing} />
                <HeroMetric label="Speaking Parts" value={bankStats.Speaking} />
              </div>
            </section>

            <section className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {(Object.keys(MODULES) as ModuleTab[]).map((tab) => (
                <ModuleShortcut
                  key={tab}
                  tab={tab}
                  count={bankStats[tab]}
                  active={false}
                  onClick={() => setActiveTab(tab)}
                />
              ))}
            </section>

            <section className="mt-12 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.07)] backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Quick Start</p>
                    <h2 className="mt-1 text-2xl font-black text-slate-900">先选模块，再直接开做</h2>
                  </div>
                  <Badge className="bg-amber-500 text-slate-950 hover:bg-amber-500">No Duplicate Cards</Badge>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-5 text-sm leading-7 text-slate-600">
                    上面四张模块卡已经是首页主入口。
                    进入后可按书册筛选、按题名搜索，并在题组中直接查看历史记录与详解；如果要完整模考，就直接点上方“开启完整模考”。
                  </div>
                  <div className="flex flex-col gap-3">
                    <Button onClick={() => setActiveTab("FullTest")} className="h-12 rounded-full bg-slate-900 text-white hover:bg-slate-800">
                      开启完整模考 <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Link href="/dashboard/analytics">
                      <Button variant="outline" className="h-12 w-full rounded-full">
                        查看历史与数据
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-900 bg-slate-900 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.3)]">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/55">Candidate Snapshot</p>
                <h2 className="mt-2 text-3xl font-black">{greeting}</h2>
                <p className="mt-3 text-sm leading-6 text-white/72">
                  从首页进入任一模块后，可以按书册筛选、按题名搜索，并在题组内直接查看历史记录与详解。
                </p>
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/50">Attempts</p>
                    <p className="mt-2 text-2xl font-black">{history.length}</p>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/50">Best Band</p>
                    <p className="mt-2 text-2xl font-black">{formatScore(currentStats.best)}</p>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.07)] backdrop-blur-xl">
                <div className="flex flex-wrap items-end justify-between gap-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                      {activeTab === "FullTest" ? "Full Test Engine" : MODULES[activeTab as ModuleTab].short}
                    </p>
                    <h1 className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">
                      {activeTab === "FullTest" ? "完整模考路径" : MODULES[activeTab as ModuleTab].label}
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                      {activeTab === "FullTest"
                        ? "先选择书册，再决定是直接进入单模块，还是按 Listening → Reading → Writing 的顺序启动完整模考。"
                        : MODULES[activeTab as ModuleTab].description}
                    </p>
                  </div>
                  <Badge className="rounded-full bg-slate-900 px-4 py-1 text-white hover:bg-slate-900">{effectiveSelectedBook}</Badge>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <label className="flex items-center gap-3 rounded-[1.4rem] border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索题目，如 Passage 2 / Task 1 / Cambridge 18"
                      className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </label>

                  <Select value={effectiveSelectedBook} onValueChange={setSelectedBook}>
                    <SelectTrigger className="h-12 rounded-[1.4rem] border-slate-200 bg-slate-50/80 text-base font-semibold shadow-none">
                      <SelectValue placeholder="选择书册" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {books.map((book) => (
                        <SelectItem key={book} value={book} className="rounded-xl py-2">
                          {book}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {(Object.keys(MODULES) as ModuleTab[]).map((tab) => (
                  <ModuleShortcut
                    key={tab}
                    tab={tab}
                    count={bankStats[tab]}
                    active={activeTab === tab}
                    onClick={() => setActiveTab(tab)}
                  />
                ))}
              </div>

              <div className="mt-8">
                {activeTab === "FullTest" ? (
                  <FullTestGroupedView units={filteredUnits} />
                ) : (
                  <TestGroupedView units={filteredUnits} history={history} />
                )}
              </div>
            </div>

            <aside className="space-y-6 xl:sticky xl:top-28 xl:self-start">
              <div className="rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.07)] backdrop-blur-xl">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Workspace Stats</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">{greeting}</h2>
                <div className="mt-6 grid gap-4">
                  <div className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Current Module Attempts</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{currentStats.total}</p>
                  </div>
                  <div className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Best Band</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{formatScore(currentStats.best)}</p>
                  </div>
                  <div className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Visible Units</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{filteredUnits.length}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-900 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.3)]">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/55">Review Loop</p>
                <h3 className="mt-2 text-2xl font-black">做完一套，立即复盘</h3>
                <p className="mt-3 text-sm leading-7 text-white/72">
                  完成练习后，直接去数据面板或 Review 页面检查 Band、答案差异和最近一次提交记录。
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <Link href="/dashboard/analytics">
                    <Button className="w-full rounded-full bg-white text-slate-900 hover:bg-white/90">
                      <BrainCircuit className="mr-2 h-4 w-4" /> 查看数据面板
                    </Button>
                  </Link>
                  <Link href="/profile">
                    <Button variant="outline" className="w-full rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                      <Settings className="mr-2 h-4 w-4" /> 管理个人资料
                    </Button>
                  </Link>
                </div>
              </div>
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}
