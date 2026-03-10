/**
 * 仪表盘核心页面 (Dashboard Client Component)
 * 作用：这是用户登录后看到的第一个大页面，负责题目展示、分类筛选、进度追踪等所有核心功能。
 * 类型：前端客户端组件 ("use client")
 */

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { signOut, useSession } from "next-auth/react"; // 身份验证相关：注销、获取当前用户信息
import Link from "next/link";
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
} from "lucide-react"; // UI 图标库
import { Badge } from "@/components/ui/badge"; // 小徽章组件
import { Button } from "@/components/ui/button"; // 按钮组件
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"; // 弹窗组件
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // 下拉选择框组件
import { formatIELTSTitle } from "@/lib/utils"; // 引入之前写好的题目名字格式化工具

// --- 类型定义 (小白可以理解为给数据打的“标签”，防止写错) ---

// 1. 顶部选项卡的分类
type DashboardTab =
  | "home" // 首页
  | "Reading" // 阅读
  | "Listening" // 听力
  | "Writing" // 写作
  | "Speaking" // 口语
  | "FullTest"; // 完整模考

// 2. 纯学科模块的分类（排除掉首页和全真考）
type ModuleTab = Exclude<DashboardTab, "home" | "FullTest">;

// 3. 题目单元的结构
type DashboardUnit = {
  id: string;
  title: string;
  category: string;
  createdAt?: string | Date;
};

// 4. 做题历史记录的结构
type HistoryEntry = {
  id: string;
  unitId: string;
  category: ModuleTab;
  unitTitle: string;
  score: number; // 分数
  date: string; // 提交时间
  timeSpent?: number; // 耗时
  evaluated?: boolean; // 是否已经 AI 评分了
};

// 5. API 返回的数据包结构
type AnalyticsPayload = {
  history?: HistoryEntry[];
};

// 6. 各模块展示用的配置信息（颜色、图标、描述）
type ModuleConfig = {
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  soft: string;
};

// --- 各个模块的“性格”配置 (颜色、文案等) ---
const MODULES: Record<ModuleTab, ModuleConfig> = {
  Reading: {
    label: "模考阅读",
    short: "Reading",
    description: "精确定位段落、同义替换与题型策略。",
    icon: BookOpen,
    accent: "text-sky-700", // 文字主色调：天蓝色
    soft: "from-sky-100 via-white to-cyan-50", // 背景渐变色
  },
  Listening: {
    label: "自动听力",
    short: "Listening",
    description: "原声材料、转录联动与复盘更顺滑。",
    icon: Headphones,
    accent: "text-indigo-700", // 文字主色调：靛蓝色
    soft: "from-indigo-100 via-white to-blue-50",
  },
  Writing: {
    label: "精批写作",
    short: "Writing",
    description: "TR / CC / LR / GRA 维度反馈直达问题。",
    icon: Edit3,
    accent: "text-emerald-700", // 文字主色调：翠绿色
    soft: "from-emerald-100 via-white to-teal-50",
  },
  Speaking: {
    label: "流式口语",
    short: "Speaking",
    description: "实时录入、机考式作答与答后点评。",
    icon: Mic,
    accent: "text-amber-700", // 文字主色调：琥珀色
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
    return (
      unit.category === "Reading/Listening" && unit.title.includes("Passage")
    );
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

function HeroMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[1.75rem] border border-white/70 bg-white/70 px-5 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">
        {value}
      </p>
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
        <div
          className={`rounded-2xl p-3 ${active ? "bg-white/12" : "bg-white/80"}`}
        >
          <Icon
            className={`h-5 w-5 ${active ? "text-white" : config.accent}`}
          />
        </div>
        <Badge
          className={
            active
              ? "bg-white/12 text-white hover:bg-white/12"
              : "bg-slate-900 text-white hover:bg-slate-900"
          }
        >
          {count} 套
        </Badge>
      </div>
      <h3 className="mt-6 text-xl font-black tracking-tight">{config.label}</h3>
      <p
        className={`mt-2 text-sm ${active ? "text-white/72" : "text-slate-600"}`}
      >
        {config.description}
      </p>
    </button>
  );
}

function EmptyState({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-white/75 px-6 text-center shadow-[0_15px_35px_rgba(15,23,42,0.04)] backdrop-blur-xl">
      <div className="mb-5 rounded-full border border-slate-200 bg-slate-50 p-4">
        {icon}
      </div>
      <p className="text-base font-semibold text-slate-600">{title}</p>
    </div>
  );
}

function TestGroupedView({
  units,
  history,
  isAuthenticated,
}: {
  units: DashboardUnit[];
  history: HistoryEntry[];
  isAuthenticated: boolean;
}) {
  if (!units.length) {
    return (
      <EmptyState
        title="当前筛选条件下没有对应题组。"
        icon={<Sparkles className="h-5 w-5 text-slate-500" />}
      />
    );
  }

  const groups = getGroupedTests(units);
  const getStartHref = (unit: DashboardUnit, mode?: "ai") => {
    const evalHref = `/eval/${unit.id}${mode === "ai" ? "?mode=ai" : ""}`;
    if (
      isAuthenticated ||
      (unit.category !== "Writing" && unit.category !== "Speaking")
    ) {
      return evalHref;
    }
    return `/login?callbackUrl=${encodeURIComponent(evalHref)}`;
  };

  return (
    <div className="space-y-6">
      {groups.map(([testLabel, items]) => (
        <section
          key={testLabel}
          className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/78 shadow-[0_24px_60px_rgba(15,23,42,0.07)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                Module Batch
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-900">
                {testLabel}
              </h3>
            </div>
            <Badge className="bg-slate-900 text-white hover:bg-slate-900">
              {items.length} 项
            </Badge>
          </div>
          <div className="divide-y divide-slate-100">
            {items
              .slice()
              .sort((a, b) =>
                a.title.localeCompare(b.title, undefined, { numeric: true }),
              )
              .map((unit) => {
                const attempts = history
                  .filter((entry) => entry.unitId === unit.id)
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime(),
                  );
                const latest = attempts[0];

                return (
                  <div
                    key={unit.id}
                    className="grid gap-5 px-6 py-5 lg:grid-cols-[minmax(0,1.2fr)_200px_180px_220px] lg:items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-400">
                        {formatIELTSTitle(unit.title)}
                      </p>
                      <h4 className="mt-1 text-lg font-bold text-slate-900">
                        {getUnitShortTitle(unit.title)}
                      </h4>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        Latest Score
                      </p>
                      <p className="mt-2 text-xl font-black text-slate-900">
                        {latest
                          ? latest.evaluated === false
                            ? "未评估"
                            : formatScore(latest.score)
                          : "--"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        Attempt History
                      </p>
                      <div className="mt-2 text-sm text-slate-600">
                        {attempts.length ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button
                                type="button"
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-300 hover:bg-slate-50"
                              >
                                {attempts.length} 次提交
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-xl rounded-[2rem] border-white/70 bg-white/92 backdrop-blur-2xl">
                              <DialogHeader>
                                <DialogTitle>
                                  {formatIELTSTitle(unit.title)}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-3">
                                {attempts.map((attempt, index) => (
                                  <div
                                    key={attempt.id}
                                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
                                  >
                                    <div>
                                      <p className="font-semibold text-slate-900">
                                        第 {attempts.length - index} 次练习
                                      </p>
                                      <p className="text-sm text-slate-500">
                                        {formatHistoryDate(attempt.date)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <span className="text-sm font-bold text-slate-800">
                                        {attempt.evaluated === false
                                          ? "已保存，未评估"
                                          : `Band ${formatScore(attempt.score)}`}
                                      </span>
                                      <Link
                                        href={`/review/${unit.id}?submissionId=${attempt.id}`}
                                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                                      >
                                        查看详解
                                      </Link>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <span className="font-medium text-slate-400">
                            未作答
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-start gap-3 lg:justify-end">
                      {unit.category === "Speaking" ? (
                        <>
                          <Link href={getStartHref(unit)}>
                            <Button className="rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800">
                              开始训练
                            </Button>
                          </Link>
                          <Link href={getStartHref(unit, "ai")}>
                            <Button
                              variant="outline"
                              className="rounded-full px-5"
                            >
                              AI 模式
                            </Button>
                          </Link>
                        </>
                      ) : (
                        <Link href={getStartHref(unit)}>
                          <Button className="rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800">
                            {latest ? "继续作答" : "开始作答"}
                          </Button>
                        </Link>
                      )}
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

/**
 * 完整模考分组视图 (Full Test Grouped View)
 * 作用：把属于同一个 Test 的听、读、写组合在一起，形成一个“模考包”。
 */
function FullTestGroupedView({ units }: { units: DashboardUnit[] }) {
  if (!units.length) {
    return (
      <EmptyState
        title="当前卷册下没有完整模考组合。"
        icon={<BarChart3 className="h-5 w-5 text-slate-500" />}
      />
    );
  }

  const groups = getGroupedTests(units); // 同样按 Test 分组

  return (
    <div className="space-y-6">
      {groups.map(([testLabel, items]) => {
        // 在这组题里，分别找出听、说、读、写各一份
        const listening = items.find((unit) =>
          isUnitInModule(unit, "Listening"),
        );
        const reading = items.find((unit) => isUnitInModule(unit, "Reading"));
        const writing = items.find((unit) => isUnitInModule(unit, "Writing"));
        const speaking = items.find((unit) => isUnitInModule(unit, "Speaking"));

        // 核心功能：模考流 (Flow)
        // 把听、读、写按照顺序串联起来，生成一个长的链接，实现“做完一个自动跳下一个”
        const flowIds = items
          .filter((unit) => unit.category !== "Speaking") // 口语通常单独考，不进连考流
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

        // 生成带 ?flow= 参数的链接
        const flowHref = flowIds.length
          ? `/eval/${flowIds[0]}?flow=${flowIds.join(",")}`
          : "#";

        return (
          <section
            key={testLabel}
            className="rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.07)] backdrop-blur-xl"
          >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                  Full Test Engine
                </p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">
                  {testLabel}
                </h3>
              </div>
              {/* 一键启动三连考按钮 */}
              {flowIds.length > 0 && (
                <Link href={flowHref}>
                  <Button className="rounded-full bg-slate-900 px-6 text-white hover:bg-slate-800">
                    启动完整模考 <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>

            {/* 四个模块的小卡片展示 */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  ["Listening", listening],
                  ["Reading", reading],
                  ["Writing", writing],
                  ["Speaking", speaking],
                ] as Array<[ModuleTab, DashboardUnit | undefined]>
              ).map(([tab, unit]) => {
                const config = MODULES[tab];
                const Icon = config.icon;

                return unit ? (
                  <Link
                    key={tab}
                    href={`/eval/${unit.id}`}
                    className={`rounded-[1.75rem] border border-white/70 bg-gradient-to-br ${config.soft} p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)] transition-transform hover:-translate-y-0.5`}
                  >
                    <Icon className={`h-6 w-6 ${config.accent}`} />
                    <h4 className="mt-5 text-lg font-black text-slate-900">
                      {config.short}
                    </h4>
                    <p className="mt-2 text-sm text-slate-600">
                      {getUnitShortTitle(unit.title)}
                    </p>
                    <span className="mt-5 inline-flex items-center text-sm font-semibold text-slate-900">
                      进入单模块 <ArrowRight className="ml-2 h-4 w-4" />
                    </span>
                  </Link>
                ) : (
                  <div
                    key={tab}
                    className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50/80 p-5 text-slate-400"
                  >
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

/**
 * 仪表盘主组件 (Main Dashboard)
 */
export default function DashboardClient({
  allUnits, // 所有的题目原始数据
}: {
  allUnits: DashboardUnit[];
}) {
  const { data: session, status } = useSession(); // 获取当前用户登录状态
  const [activeTab, setActiveTab] = useState<DashboardTab>("home"); // 当前选中的分类（首页/听/说/读/写/全考）
  const [history, setHistory] = useState<HistoryEntry[]>([]); // 用户的做题历史
  const [query, setQuery] = useState(""); // 搜索框输入的文字
  const [selectedBook, setSelectedBook] = useState<string>(
    getBookLabel(allUnits[0]?.title || "Other"), // 默认选中第一本书
  );

  /**
   * 当用户登录时，请求后端接口获取他们的“做题足迹”（历史分数等）
   */
  useEffect(() => {
    if (!session?.user) return; // 没登录就不领这份数了

    const controller = new AbortController(); // 用于取消请求

    fetch("/api/analytics", { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: AnalyticsPayload) => {
        setHistory(payload.history ?? []); // 更新历史记录状态
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        console.error("加载分析数据失败:", error);
      });

    return () => controller.abort();
  }, [session]);

  /**
   * 自动计算当前题库里一共有多少本书（剑 1 ~ 剑 18 等）
   */
  const books = useMemo(() => {
    const found = new Set(allUnits.map((unit) => getBookLabel(unit.title)));
    return Array.from(found).sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return getNumericSuffix(a) - getNumericSuffix(b); // 按数字排，18 比 17 大
    });
  }, [allUnits]);

  // 处理如果切换分类导致当前选的分卷不存在的情况
  const effectiveSelectedBook = books.includes(selectedBook)
    ? selectedBook
    : books[0] || "Other";

  /**
   * 统计每个科目下总共有多少题
   */
  const bankStats = useMemo(
    () => ({
      Reading: allUnits.filter((unit) => isUnitInModule(unit, "Reading"))
        .length,
      Listening: allUnits.filter((unit) => isUnitInModule(unit, "Listening"))
        .length,
      Writing: allUnits.filter((unit) => isUnitInModule(unit, "Writing"))
        .length,
      Speaking: allUnits.filter((unit) => isUnitInModule(unit, "Speaking"))
        .length,
    }),
    [allUnits],
  );

  /**
   * 根据选中的书册（如 Cambridge 18）过滤出一组题
   */
  const unitsByBook = useMemo(
    () =>
      allUnits.filter(
        (unit) => getBookLabel(unit.title) === effectiveSelectedBook,
      ),
    [allUnits, effectiveSelectedBook],
  );

  /**
   * 根据搜索关键词和顶部选项卡进一过滤题目
   */
  const filteredUnits = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return unitsByBook.filter((unit) => {
      const matchesTab =
        activeTab === "home" || activeTab === "FullTest"
          ? true
          : isUnitInModule(unit, activeTab);
      const matchesQuery =
        !normalizedQuery ||
        formatIELTSTitle(unit.title).toLowerCase().includes(normalizedQuery);
      return matchesTab && matchesQuery;
    });
  }, [activeTab, query, unitsByBook]);

  /**
   * 计算当前模块下的个人统计数据（比如最高 Band 分）
   */
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

  // 给用户的称呼
  const greeting =
    session?.user?.name || session?.user?.email?.split("@")[0] || "Scholar";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eef2f7] pb-20 text-slate-900 selection:bg-sky-200/70">
      {/* 背景装饰：渐变球与方格纹理 */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_34%),radial-gradient(circle_at_80%_15%,_rgba(251,191,36,0.18),_transparent_28%),linear-gradient(180deg,#f7fafc_0%,#edf2f7_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:42px_42px]" />

      {/* 顶部导航栏 (Sticky 粘性定位) */}
      <nav className="sticky top-0 z-40 border-b border-white/60 bg-white/72 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          {/* Logo 区 */}
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-lg font-black text-white shadow-lg shadow-slate-900/15">
              LS
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.34em] text-slate-500">
                LinguoSovereign
              </p>
              <p className="text-sm font-semibold text-slate-900">
                AI IELTS Studio
              </p>
            </div>
          </button>

          {/* 桌面端导航菜单 (学科分类) */}
          <div className="hidden items-center gap-2 xl:flex">
            {(
              [
                "Reading",
                "Listening",
                "Writing",
                "Speaking",
                "FullTest",
              ] as DashboardTab[]
            ).map((tab) => (
              <Button
                key={tab}
                variant="ghost"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-4 ${activeTab === tab ? "bg-slate-900 text-white hover:bg-slate-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
              >
                {tab === "FullTest"
                  ? "全真考"
                  : MODULES[tab as ModuleTab].label}
              </Button>
            ))}
          </div>

          {/* 用户账户区 */}
          <div className="flex items-center gap-3">
            {status === "loading" ? (
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            ) : session ? (
              <>
                <div className="hidden text-right md:block">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    Current Candidate
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {greeting}
                  </p>
                </div>
                <Link href="/dashboard/analytics">
                  <Button variant="outline" className="rounded-full">
                    <BarChart3 className="mr-2 h-4 w-4" /> 数据面板
                  </Button>
                </Link>
                <Link href="/profile">
                  <Button
                    variant="ghost"
                    className="rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Settings className="mr-2 h-4 w-4" /> 资料
                  </Button>
                </Link>
                <Button
                  onClick={() => signOut()}
                  variant="ghost"
                  className="rounded-full text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  登出
                </Button>
              </>
            ) : (
              // 未登录显示的注册/登录按钮
              <>
                <Link href="/register">
                  <Button
                    variant="ghost"
                    className="rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    注册
                  </Button>
                </Link>
                <Link href="/login">
                  <Button className="rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800">
                    登入题库
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* 主体内容区 */}
      <main className="mx-auto max-w-[1380px] px-4 pt-8 sm:px-6 lg:px-8">
        {/* 移动端用的滑动式导航栏 */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 xl:hidden">
          {(
            [
              "home",
              "Reading",
              "Listening",
              "Writing",
              "Speaking",
              "FullTest",
            ] as DashboardTab[]
          ).map((tab) => (
            <Button
              key={tab}
              variant="ghost"
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 rounded-full px-4 ${activeTab === tab ? "bg-slate-900 text-white hover:bg-slate-900" : "bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900"}`}
            >
              {tab === "home"
                ? "首页"
                : tab === "FullTest"
                  ? "全真考"
                  : MODULES[tab as ModuleTab].label}
            </Button>
          ))}
        </div>

        {/* 条件渲染：首页视图 or 学科/模考视图 */}
        {activeTab === "home" ? (
          <>
            {/* 顶部的欢迎条和 Slogan */}
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
                  LinguoSovereign 把 Cambridge
                  真题、客观题批改、主观题反馈和历史追踪放进同一条练习路径里，界面更克制，推进也更顺手。
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button
                    onClick={() => setActiveTab("FullTest")}
                    className="rounded-full bg-slate-900 px-6 text-white hover:bg-slate-800"
                  >
                    开启完整模考 <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Link href="/dashboard/analytics">
                    <Button variant="outline" className="rounded-full px-6">
                      查看我的数据
                    </Button>
                  </Link>
                </div>
              </div>

              {/* 首页右侧的四个总分统计 */}
              <div className="grid gap-4 md:grid-cols-2">
                <HeroMetric label="Reading Sets" value={bankStats.Reading} />
                <HeroMetric
                  label="Listening Sets"
                  value={bankStats.Listening}
                />
                <HeroMetric label="Writing Tasks" value={bankStats.Writing} />
                <HeroMetric label="Speaking Parts" value={bankStats.Speaking} />
              </div>
            </section>

            {/* 模块磁卡区域 (阅读/听力/写作/口语入口) */}
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

            {/* 首页底部的指引和快照 */}
            <section className="mt-12 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.07)] backdrop-blur-xl">
                <div className="border-b border-slate-100 pb-5">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                    Quick Start
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    先选模块，再直接开做
                  </h2>
                </div>
                <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-5 text-sm leading-7 text-slate-600">
                  上面四张模块卡已经是首页主入口。进入后可按书册筛选、按题名搜索，并在题组中直接查看历史记录与详解；如果要完整模考，直接使用上方主区里的“开启完整模考”和“查看我的数据”即可。
                </div>
              </div>

              {/* 黑色用户信息快照 */}
              <div className="rounded-[2rem] border border-slate-900 bg-slate-900 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.3)]">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/55">
                  Candidate Snapshot
                </p>
                <h2 className="mt-2 text-3xl font-black">{greeting}</h2>
                <p className="mt-3 text-sm leading-6 text-white/72">
                  从首页进入任一模块后，可以按书册筛选、按题名搜索，并在题组内直接查看历史记录与详解。
                </p>
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                      Attempts
                    </p>
                    <p className="mt-2 text-2xl font-black">{history.length}</p>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                      Best Band
                    </p>
                    <p className="mt-2 text-2xl font-black">
                      {formatScore(currentStats.best)}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          // 非首页情况：展示具体的模块内容（比如阅读列表）
          <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              {/* 列表头部的标题、搜索、筛选区 */}
              <div className="rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.07)] backdrop-blur-xl">
                <div className="flex flex-wrap items-end justify-between gap-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                      {activeTab === "FullTest"
                        ? "Full Test Engine"
                        : MODULES[activeTab as ModuleTab].short}
                    </p>
                    <h1 className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">
                      {activeTab === "FullTest"
                        ? "完整模考路径"
                        : MODULES[activeTab as ModuleTab].label}
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                      {activeTab === "FullTest"
                        ? "先选择书册，再决定是直接进入单模块，还是按 Listening → Reading → Writing 的顺序启动完整模考。"
                        : MODULES[activeTab as ModuleTab].description}
                    </p>
                  </div>
                  <Badge className="rounded-full bg-slate-900 px-4 py-1 text-white hover:bg-slate-900">
                    {effectiveSelectedBook}
                  </Badge>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  {/* 搜索框 */}
                  <label className="flex items-center gap-3 rounded-[1.4rem] border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索题目，如 Passage 2 / Task 1 / Cambridge 18"
                      className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </label>

                  {/* 分卷选择器 (剑桥系列选择) */}
                  <Select
                    value={effectiveSelectedBook}
                    onValueChange={setSelectedBook}
                  >
                    <SelectTrigger className="h-12 rounded-[1.4rem] border-slate-200 bg-slate-50/80 text-base font-semibold shadow-none">
                      <SelectValue placeholder="选择书册" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {books.map((book) => (
                        <SelectItem
                          key={book}
                          value={book}
                          className="rounded-xl py-2"
                        >
                          {book}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 学科切换的小横条 */}
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

              {/* 核心题目列表区域 */}
              <div className="mt-8">
                {activeTab === "FullTest" ? (
                  <FullTestGroupedView units={filteredUnits} />
                ) : (
                  <TestGroupedView
                    units={filteredUnits}
                    history={history}
                    isAuthenticated={Boolean(session?.user)}
                  />
                )}
              </div>
            </div>

            {/* 右侧侧边栏：当前模块的统计指标 */}
            <aside className="space-y-6 xl:sticky xl:top-28 xl:self-start">
              <div className="rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.07)] backdrop-blur-xl">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                  Workspace Stats
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">
                  {greeting}
                </h2>
                <div className="mt-6 grid gap-4">
                  <div className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Current Module Attempts
                    </p>
                    <p className="mt-2 text-3xl font-black text-slate-900">
                      {currentStats.total}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Best Band
                    </p>
                    <p className="mt-2 text-3xl font-black text-slate-900">
                      {formatScore(currentStats.best)}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Visible Units
                    </p>
                    <p className="mt-2 text-3xl font-black text-slate-900">
                      {filteredUnits.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* 复盘小卡片 */}
              <div className="rounded-[2rem] border border-slate-900 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.3)]">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/55">
                  Review Loop
                </p>
                <h3 className="mt-2 text-2xl font-black">做完一套，立即复盘</h3>
                <p className="mt-3 text-sm leading-7 text-white/72">
                  完成练习后，直接去数据面板或 Review 页面检查
                  Band、答案差异和最近一次提交记录。
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <Link href="/dashboard/analytics">
                    <Button className="w-full rounded-full bg-white text-slate-900 hover:bg-white/90">
                      <BrainCircuit className="mr-2 h-4 w-4" /> 查看数据面板
                    </Button>
                  </Link>
                  <Link href="/profile">
                    <Button
                      variant="outline"
                      className="w-full rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                    >
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
