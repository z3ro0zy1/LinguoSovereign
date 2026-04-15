/**
 * 仪表盘核心页面 (Dashboard Client Component)
 * 作用：这是用户登录后看到的第一个大页面，负责题目展示、分类筛选、进度追踪等所有核心功能。
 * 类型：前端客户端组件 ("use client")
 */

"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { signOut, useSession } from "next-auth/react"; // 身份验证相关：注销、获取当前用户信息
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ChevronDown,
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
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLocale } from "@/components/LocaleProvider";

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

function getModules(locale: "zh" | "en"): Record<ModuleTab, ModuleConfig> {
  return {
    Reading: {
      label: locale === "zh" ? "模考阅读" : "Reading Drills",
      short: "Reading",
      description:
        locale === "zh"
          ? "精确定位段落、同义替换与题型策略。"
          : "Sharpen passage targeting, paraphrase tracking, and question strategy.",
      icon: BookOpen,
      accent: "text-sky-700",
      soft: "from-sky-100 via-white to-cyan-50",
    },
    Listening: {
      label: locale === "zh" ? "自动听力" : "Listening Lab",
      short: "Listening",
      description:
        locale === "zh"
          ? "原声材料、转录联动与复盘更顺滑。"
          : "Native audio, transcript linkage, and smoother review loops.",
      icon: Headphones,
      accent: "text-indigo-700",
      soft: "from-indigo-100 via-white to-blue-50",
    },
    Writing: {
      label: locale === "zh" ? "精批写作" : "Writing Review",
      short: "Writing",
      description:
        locale === "zh"
          ? "TR / CC / LR / GRA 维度反馈直达问题。"
          : "TR / CC / LR / GRA feedback points directly to the problem.",
      icon: Edit3,
      accent: "text-emerald-700",
      soft: "from-emerald-100 via-white to-teal-50",
    },
    Speaking: {
      label: locale === "zh" ? "流式口语" : "Speaking Flow",
      short: "Speaking",
      description:
        locale === "zh"
          ? "实时录入、机考式作答与答后点评。"
          : "Live capture, exam-style response, and post-answer review.",
      icon: Mic,
      accent: "text-amber-700",
      soft: "from-amber-100 via-white to-orange-50",
    },
  };
}

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

function getAvatarSource(image: string | null | undefined) {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  if (image.startsWith("/")) return image;
  return `/${image}`;
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

function ModuleShortcut({
  tab,
  active,
  onClick,
}: {
  tab: ModuleTab;
  active: boolean;
  onClick: () => void;
}) {
  const { locale } = useLocale();
  const MODULES = getModules(locale);
  const config = MODULES[tab];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative inline-flex min-w-0 items-center gap-3 rounded-full px-4 py-2.5 text-left transition-all duration-300 ${
        active
          ? "bg-black text-white shadow-[0_8px_22px_rgba(0,0,0,0.08)]"
          : "bg-[rgba(245,242,239,0.82)] text-[#4e4e4e] hover:bg-white hover:text-black"
      }`}
    >
      <span
        className={`pointer-events-none absolute inset-0 rounded-full ring-1 transition-all ${
          active
            ? "ring-[rgba(0,0,0,0.08)]"
            : "ring-[rgba(0,0,0,0.06)] group-hover:ring-[rgba(0,0,0,0.08)]"
        }`}
      ></span>
      <span
        className={`relative h-2 w-2 rounded-full transition-colors ${
          active ? "bg-[#f5f2ef]" : "bg-[#b4aea3] group-hover:bg-[#777169]"
        }`}
      ></span>
      <span className="relative truncate text-[14px] font-medium tracking-[-0.02em]">
        {config.label}
      </span>
    </button>
  );
}

function HomeSignal({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="border-t border-[rgba(0,0,0,0.06)] pt-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-[#777169]">
        {label}
      </p>
      <p className="mt-2 text-[30px] font-medium tracking-[-0.05em] text-black">
        {value}
      </p>
    </div>
  );
}

function EmptyState({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[24px] border border-[rgba(0,0,0,0.06)] bg-white px-6 text-center shadow-[rgba(0,0,0,0.04)_0px_4px_4px,rgba(0,0,0,0.06)_0px_0px_0px_1px]">
      <div className="mb-5 rounded-full border border-[rgba(0,0,0,0.06)] bg-[#f5f2ef] p-4">
        {icon}
      </div>
      <p className="text-base font-medium text-[#4e4e4e]">{title}</p>
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
  const { locale } = useLocale();
  if (!units.length) {
    return (
      <EmptyState
        title={
          locale === "zh"
            ? "当前筛选条件下没有对应题组。"
            : "No matching sets under the current filters."
        }
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
          className="overflow-hidden rounded-[28px] border border-[rgba(0,0,0,0.06)] bg-white shadow-[rgba(0,0,0,0.04)_0px_4px_4px,rgba(0,0,0,0.06)_0px_0px_0px_1px]"
        >
          <div className="flex items-center justify-between border-b border-[rgba(0,0,0,0.05)] px-8 py-6">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#777169]">
                {locale === "zh" ? "题组批次" : "Module Batch"}
              </p>
              <h3 className="mt-2 text-[2.1rem] font-semibold tracking-[-0.05em] text-black">
                {testLabel}
              </h3>
            </div>
            <Badge className="rounded-full bg-black px-4 py-1.5 text-white hover:bg-black">
              {items.length} {locale === "zh" ? "项" : "items"}
            </Badge>
          </div>
          <div className="divide-y divide-[rgba(0,0,0,0.05)]">
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
                const isSpeakingUnit = unit.category === "Speaking";

                return (
                  <div
                    key={unit.id}
                    className={`group grid gap-6 px-8 py-8 transition-colors duration-300 hover:bg-[#fbfaf8] ${
                      isSpeakingUnit
                        ? "xl:grid-cols-[minmax(0,1.35fr)_190px_180px_300px]"
                        : "xl:grid-cols-[minmax(0,1.28fr)_220px_180px_236px]"
                    } lg:items-center`}
                  >
                    <div className="relative pl-6 before:absolute before:left-0 before:top-1 before:h-[calc(100%-0.5rem)] before:w-px before:bg-[rgba(0,0,0,0.08)]">
                      <p className="text-sm font-medium text-[#8a847a]">
                        {formatIELTSTitle(unit.title)}
                      </p>
                      <h4 className="mt-3 text-[2rem] font-semibold tracking-[-0.05em] text-black">
                        {getUnitShortTitle(unit.title)}
                      </h4>
                    </div>

                    <div className="rounded-[20px] border border-[rgba(0,0,0,0.06)] bg-[#fbfaf8] px-5 py-5">
                      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#777169]">
                        {locale === "zh" ? "最新分数" : "Latest Score"}
                      </p>
                      <p className="mt-3 text-[2rem] font-semibold tracking-[-0.05em] text-black">
                        {latest
                          ? latest.evaluated === false
                            ? locale === "zh"
                              ? "未评估"
                              : "Not Evaluated"
                            : formatScore(latest.score)
                          : "--"}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#777169]">
                        {locale === "zh" ? "答题历史" : "Attempt History"}
                      </p>
                      <div className="mt-2 text-sm text-[#4e4e4e]">
                        {isSpeakingUnit ? (
                          <span className="font-medium leading-7 text-slate-500">
                            {latest
                              ? latest.evaluated === false
                                ? locale === "zh"
                                  ? "最近一次未评估"
                                  : "Latest attempt not evaluated"
                                : `${locale === "zh" ? "最近评分" : "Latest band"} ${formatScore(latest.score)}`
                              : locale === "zh"
                                ? "暂无练习记录"
                                : "No practice records"}
                          </span>
                        ) : attempts.length ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button
                                type="button"
                                className="rounded-full border border-[#e0d6c7] bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 transition-colors hover:border-[#cdb89a] hover:bg-[#fcfaf6]"
                              >
                                {attempts.length}{" "}
                                {locale === "zh" ? "次提交" : "attempts"}
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
                                        {locale === "zh"
                                          ? `第 ${attempts.length - index} 次练习`
                                          : `Attempt ${attempts.length - index}`}
                                      </p>
                                      <p className="text-sm text-slate-500">
                                        {formatHistoryDate(attempt.date)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <span className="text-sm font-bold text-slate-800">
                                        {attempt.evaluated === false
                                          ? locale === "zh"
                                            ? "已保存，未评估"
                                            : "Saved, not evaluated"
                                          : `Band ${formatScore(attempt.score)}`}
                                      </span>
                                      <Link
                                        href={`/review/${unit.id}?submissionId=${attempt.id}`}
                                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                                      >
                                        {locale === "zh"
                                          ? "查看详解"
                                          : "View Review"}
                                      </Link>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <span className="font-medium text-slate-400">
                            {locale === "zh"
                              ? "暂无练习记录"
                              : "No practice records"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-start gap-3 lg:justify-end">
                      {isSpeakingUnit ? (
                        <div className="w-full max-w-[300px] rounded-[1.6rem] border border-[#e7dfd3] bg-white/82 p-3 shadow-sm">
                          <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                            {locale === "zh" ? "训练模式" : "Practice Modes"}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <Link href={getStartHref(unit)}>
                              <Button className="w-full rounded-[1rem] bg-[#0f172a] text-white hover:bg-[#0b1220]">
                                {locale === "zh" ? "转录评分" : "Transcript"}
                              </Button>
                            </Link>
                            <Link href={getStartHref(unit, "ai")}>
                              <Button
                                variant="outline"
                                className="w-full rounded-[1rem] border-[#e0d6c7] bg-white hover:bg-[#fcfaf6]"
                              >
                                {locale === "zh" ? "自由对话" : "Live Voice"}
                              </Button>
                            </Link>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full rounded-[1rem] border-[#e0d6c7] bg-white hover:bg-[#fcfaf6]"
                                >
                                  {locale === "zh"
                                    ? "历史评分"
                                    : "Score History"}
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-xl rounded-[2rem] border-white/70 bg-white/92 backdrop-blur-2xl">
                                <DialogHeader>
                                  <DialogTitle>
                                    {formatIELTSTitle(unit.title)}
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-3">
                                  {attempts.length ? (
                                    attempts.map((attempt, index) => (
                                      <div
                                        key={attempt.id}
                                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
                                      >
                                        <div>
                                          <p className="font-semibold text-slate-900">
                                            {locale === "zh"
                                              ? `第 ${attempts.length - index} 次评分`
                                              : `Scored attempt ${attempts.length - index}`}
                                          </p>
                                          <p className="text-sm text-slate-500">
                                            {formatHistoryDate(attempt.date)}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <span className="text-sm font-bold text-slate-800">
                                            {attempt.evaluated === false
                                              ? locale === "zh"
                                                ? "已保存，未评估"
                                                : "Saved, not evaluated"
                                              : `Band ${formatScore(attempt.score)}`}
                                          </span>
                                          <Link
                                            href={`/review/${unit.id}?submissionId=${attempt.id}`}
                                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                                          >
                                            {locale === "zh"
                                              ? "查看评分"
                                              : "View Review"}
                                          </Link>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-500">
                                      {locale === "zh"
                                        ? "暂无历史评分记录"
                                        : "No scoring history yet"}
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Link href={`/review/${unit.id}`}>
                              <Button
                                variant="outline"
                                className="w-full rounded-[1rem] border-[#e0d6c7] bg-white px-5 hover:bg-[#fcfaf6]"
                              >
                                <ListIcon className="mr-2 h-4 w-4" />{" "}
                                {locale === "zh" ? "详解" : "Reference"}
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <Link href={getStartHref(unit)}>
                          <Button className="rounded-full bg-[#0f172a] px-6 text-white hover:bg-[#0b1220]">
                            {latest
                              ? locale === "zh"
                                ? "继续作答"
                                : "Resume"
                              : locale === "zh"
                                ? "开始作答"
                                : "Start"}
                          </Button>
                        </Link>
                      )}
                      {!isSpeakingUnit ? (
                        <>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                className="rounded-full border-[#e0d6c7] bg-white px-5 hover:bg-[#fcfaf6]"
                              >
                                <BarChart3 className="mr-2 h-4 w-4" />{" "}
                                {locale === "zh" ? "历史记录" : "History"}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-xl rounded-[2rem] border-white/70 bg-white/92 backdrop-blur-2xl">
                              <DialogHeader>
                                <DialogTitle>
                                  {formatIELTSTitle(unit.title)}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-3">
                                {attempts.length ? (
                                  attempts.map((attempt, index) => (
                                    <div
                                      key={attempt.id}
                                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
                                    >
                                      <div>
                                        <p className="font-semibold text-slate-900">
                                          {locale === "zh"
                                            ? `第 ${attempts.length - index} 次练习`
                                            : `Attempt ${attempts.length - index}`}
                                        </p>
                                        <p className="text-sm text-slate-500">
                                          {formatHistoryDate(attempt.date)}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <span className="text-sm font-bold text-slate-800">
                                          {attempt.evaluated === false
                                            ? locale === "zh"
                                              ? "已保存，未评估"
                                              : "Saved, not evaluated"
                                            : `Band ${formatScore(attempt.score)}`}
                                        </span>
                                        <Link
                                          href={`/review/${unit.id}?submissionId=${attempt.id}`}
                                          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                                        >
                                          {locale === "zh"
                                            ? "查看记录"
                                            : "View Review"}
                                        </Link>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-500">
                                    {locale === "zh"
                                      ? "暂无历史记录"
                                      : "No history yet"}
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Link href={`/review/${unit.id}`}>
                            <Button
                              variant="outline"
                              className="rounded-full border-[#e0d6c7] bg-white px-5 hover:bg-[#fcfaf6]"
                            >
                              <ListIcon className="mr-2 h-4 w-4" />{" "}
                              {locale === "zh" ? "详解" : "Reference"}
                            </Button>
                          </Link>
                        </>
                      ) : null}
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
  const { locale } = useLocale();
  const MODULES = getModules(locale);
  if (!units.length) {
    return (
      <EmptyState
        title={
          locale === "zh"
            ? "当前卷册下没有完整模考组合。"
            : "No complete mock bundle under this book."
        }
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
            className="rounded-[28px] border border-[rgba(0,0,0,0.06)] bg-white p-7 shadow-[rgba(0,0,0,0.04)_0px_4px_4px,rgba(0,0,0,0.06)_0px_0px_0px_1px]"
          >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#777169]">
                  {locale === "zh" ? "完整模考引擎" : "Full Test Engine"}
                </p>
                <h3 className="mt-2 text-[2.1rem] font-semibold tracking-[-0.05em] text-black">
                  {testLabel}
                </h3>
              </div>
              {/* 一键启动三连考按钮 */}
              {flowIds.length > 0 && (
                <Link href={flowHref}>
                  <Button className="rounded-full bg-black px-6 text-white hover:bg-black">
                    {locale === "zh" ? "启动完整模考" : "Launch Full Test"}{" "}
                    <ArrowRight className="ml-2 h-4 w-4" />
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
                    className="group rounded-[20px] border border-[rgba(0,0,0,0.06)] bg-[#fbfaf8] p-5 transition-colors hover:bg-[#f5f2ef]"
                  >
                    <Icon className={`h-6 w-6 ${config.accent}`} />
                    <h4 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-black">
                      {config.short}
                    </h4>
                    <p className="mt-2 text-sm text-[#4e4e4e]">
                      {getUnitShortTitle(unit.title)}
                    </p>
                    <span className="mt-5 inline-flex items-center text-sm font-medium text-black transition-transform group-hover:translate-x-1">
                      {locale === "zh" ? "进入单模块" : "Open Module"}{" "}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </span>
                  </Link>
                ) : (
                  <div
                    key={tab}
                    className="rounded-[20px] border border-dashed border-[rgba(0,0,0,0.08)] bg-[#fbfaf8] p-5 text-[#8a847a]"
                  >
                    <Icon className="h-6 w-6" />
                    <h4 className="mt-5 text-lg font-black">{config.short}</h4>
                    <p className="mt-2 text-sm">
                      {locale === "zh" ? "暂无模块" : "No module"}
                    </p>
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
  const { locale } = useLocale();
  const MODULES = useMemo(() => getModules(locale), [locale]);
  const [activeTab, setActiveTab] = useState<DashboardTab>("home"); // 当前选中的分类（首页/听/说/读/写/全考）
  const [history, setHistory] = useState<HistoryEntry[]>([]); // 用户的做题历史
  const [query, setQuery] = useState(""); // 搜索框输入的文字
  const [selectedBook, setSelectedBook] = useState<string>(
    getBookLabel(allUnits[0]?.title || "Other"), // 默认选中第一本书
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

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
        console.error(
          locale === "zh" ? "加载分析数据失败:" : "Failed to load analytics:",
          error,
        );
      });

    return () => controller.abort();
  }, [locale, session]);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!accountMenuRef.current) return;
      if (!accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [accountMenuOpen]);

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
    session?.user?.name ||
    session?.user?.email?.split("@")[0] ||
    (locale === "zh" ? "学员" : "Scholar");
  const userInitial = greeting.slice(0, 1).toUpperCase();
  const avatarSrc = getAvatarSource(session?.user?.image);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f5f5] pb-20 text-black selection:bg-[#ece5da]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(180deg,#ffffff_0%,#f5f5f5_100%)]" />

      {/* 顶部导航栏 (Sticky 粘性定位) */}
      <nav className="sticky top-0 z-40 border-b border-[rgba(0,0,0,0.05)] bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          {/* Logo 区 */}
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-lg font-black text-white">
              LS
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.34em] text-[#777169]">
                LinguoSovereign
              </p>
              <p className="text-sm font-medium text-black">AI IELTS Studio</p>
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
                className={`rounded-full px-4 ${activeTab === tab ? "bg-black text-white hover:bg-black" : "text-[#4e4e4e] hover:bg-[#f5f2ef] hover:text-black"}`}
              >
                {tab === "FullTest"
                  ? locale === "zh"
                    ? "全真考"
                    : "Full Test"
                  : MODULES[tab as ModuleTab].label}
              </Button>
            ))}
          </div>

          {/* 用户账户区 */}
          <div className="flex items-center gap-3">
            <LanguageToggle />
            {status === "loading" ? (
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            ) : session ? (
              <>
                <div ref={accountMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen((value) => !value)}
                    className="flex items-center gap-3 rounded-full border border-[rgba(0,0,0,0.08)] bg-white px-2.5 py-2 shadow-[rgba(0,0,0,0.04)_0px_4px_4px] transition-colors hover:bg-[#f5f2ef]"
                  >
                    <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-sm font-black text-white">
                      {avatarSrc ? (
                        <Image
                          src={avatarSrc}
                          alt={session.user?.name || "Avatar"}
                          fill
                          className="object-cover"
                          sizes="36px"
                        />
                      ) : (
                        userInitial
                      )}
                    </div>
                    <div className="hidden pr-1 text-left md:block">
                      <p className="text-sm font-medium text-black">
                        {greeting}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-[#777169] transition-transform ${
                        accountMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {accountMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-60 overflow-hidden rounded-[20px] border border-[rgba(0,0,0,0.06)] bg-white p-2 shadow-[rgba(0,0,0,0.06)_0px_18px_44px]">
                      <div className="border-b border-[rgba(0,0,0,0.05)] px-3 py-3">
                        <p className="text-sm font-medium text-black">
                          {greeting}
                        </p>
                        <p className="mt-1 text-xs text-[#777169]">
                          {session.user?.email ||
                            (locale === "zh" ? "已登录用户" : "Signed-in user")}
                        </p>
                      </div>
                      <div className="space-y-1 p-2">
                        <Link
                          href="/dashboard/analytics"
                          onClick={() => setAccountMenuOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#4e4e4e] transition-colors hover:bg-[#f5f2ef] hover:text-black"
                        >
                          <BarChart3 className="h-4 w-4" />
                          {locale === "zh" ? "数据面板" : "Analytics"}
                        </Link>
                        <Link
                          href="/profile"
                          onClick={() => setAccountMenuOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#4e4e4e] transition-colors hover:bg-[#f5f2ef] hover:text-black"
                        >
                          <Settings className="h-4 w-4" />
                          {locale === "zh" ? "个人资料" : "Profile"}
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setAccountMenuOpen(false);
                            void signOut();
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-black transition-colors hover:bg-[#f5f2ef]"
                        >
                          <ArrowRight className="h-4 w-4" />
                          {locale === "zh" ? "登出" : "Sign Out"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              // 未登录显示的注册/登录按钮
              <>
                <Link href="/register">
                  <Button
                    variant="ghost"
                    className="rounded-full text-[#4e4e4e] hover:bg-[#f5f2ef] hover:text-black"
                  >
                    {locale === "zh" ? "注册" : "Register"}
                  </Button>
                </Link>
                <Link href="/login">
                  <Button className="rounded-full bg-black px-5 text-white hover:bg-black">
                    {locale === "zh" ? "登入题库" : "Sign In"}
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
              className={`shrink-0 rounded-full px-4 ${activeTab === tab ? "bg-black text-white hover:bg-black" : "bg-[rgba(245,242,239,0.82)] text-[#4e4e4e] hover:bg-white hover:text-black"}`}
            >
              {tab === "home"
                ? locale === "zh"
                  ? "首页"
                  : "Home"
                : tab === "FullTest"
                  ? locale === "zh"
                    ? "全真考"
                    : "Full Test"
                  : MODULES[tab as ModuleTab].label}
            </Button>
          ))}
        </div>

        {/* 条件渲染：首页视图 or 学科/模考视图 */}
        {activeTab === "home" ? (
          <>
            <section className="-mx-4 overflow-hidden sm:-mx-6 lg:-mx-8">
              <div className="relative border-y border-[rgba(0,0,0,0.05)] bg-white">
                <div className="relative mx-auto max-w-[1540px] px-6 py-12 sm:px-8 lg:px-12 lg:py-16">
                  <div className="mx-auto flex max-w-[1080px] flex-col items-center py-10 text-center lg:py-20">
                    <p className="text-[11px] font-medium uppercase tracking-[0.42em] text-[#777169]">
                      LinguoSovereign
                    </p>
                    <p className="mt-5 text-[12px] font-medium uppercase tracking-[0.24em] text-[#777169]">
                      {locale === "zh"
                        ? "AI IELTS Study System"
                        : "AI IELTS Study System"}
                    </p>
                    <h1 className="mt-12 max-w-[900px] text-balance text-[44px] font-semibold leading-[0.92] tracking-[-0.065em] text-black md:text-[74px] xl:text-[112px]">
                      {locale === "zh" ? (
                        <>
                          Linguo Sovereign
                          <br />
                          Improve your English capacity
                        </>
                      ) : (
                        <>
                          Build a calmer surface
                          <br />
                          for serious IELTS study.
                        </>
                      )}
                    </h1>
                    <p className="mt-9 max-w-[620px] text-[16px] leading-8 text-[#4e4e4e] md:text-[18px]">
                      {locale === "zh"
                        ? "题库、历史记录与 AI 反馈被收进同一个系统里。阅读、听力、写作与口语不再被拆散。"
                        : "The library, history, and AI feedback stay inside one system. Reading, listening, writing, and speaking no longer live apart."}
                    </p>
                    <div className="mt-10 flex flex-wrap justify-center gap-3">
                      <Button
                        onClick={() => setActiveTab("FullTest")}
                        className="rounded-full bg-black px-7 py-6 text-[15px] font-medium text-white hover:bg-black"
                      >
                        {locale === "zh" ? "进入完整模考" : "Launch Full Test"}{" "}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab("Speaking")}
                        className="rounded-full border-[rgba(0,0,0,0.08)] bg-[rgba(245,242,239,0.82)] px-7 py-6 text-[15px] font-medium text-black hover:bg-white"
                      >
                        {locale === "zh"
                          ? "打开流式口语"
                          : "Open Speaking Flow"}
                      </Button>
                    </div>

                    <div className="mt-16 grid w-full max-w-[760px] gap-8 border-t border-[rgba(0,0,0,0.06)] pt-8 md:grid-cols-3">
                      <HomeSignal
                        label={locale === "zh" ? "练习总数" : "Attempts"}
                        value={history.length}
                      />
                      <HomeSignal
                        label={locale === "zh" ? "最佳 Band" : "Best Band"}
                        value={formatScore(currentStats.best)}
                      />
                      <HomeSignal
                        label={locale === "zh" ? "题组规模" : "Library"}
                        value={allUnits.length}
                      />
                    </div>
                  </div>

                  <div className="mt-16 overflow-hidden rounded-[28px] border border-[rgba(0,0,0,0.06)] bg-white shadow-[rgba(0,0,0,0.04)_0px_4px_4px,rgba(0,0,0,0.06)_0px_0px_0px_1px]">
                    <div className="grid gap-px bg-[rgba(0,0,0,0.06)] lg:grid-cols-4">
                      {(Object.keys(MODULES) as ModuleTab[]).map((tab) => {
                        const config = MODULES[tab];
                        const Icon = config.icon;
                        return (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className="group bg-white px-6 py-6 text-left transition-colors duration-300 hover:bg-[#fbfaf8]"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(0,0,0,0.06)] bg-[#f5f2ef]">
                                <Icon className={`h-4 w-4 ${config.accent}`} />
                              </div>
                              <ArrowRight className="h-4 w-4 text-[#b3aba0] transition-transform duration-300 group-hover:translate-x-1 group-hover:text-black" />
                            </div>
                            <p className="mt-5 text-[1.7rem] font-semibold tracking-[-0.05em] text-black">
                              {config.label}
                            </p>
                            <p className="mt-2 text-sm leading-7 text-[#4e4e4e]">
                              {config.description}
                            </p>
                            <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.24em] text-[#777169]">
                              {bankStats[tab]}{" "}
                              {locale === "zh" ? "组内容" : "sets available"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          // 非首页情况：展示具体的模块目录页
          <section className="space-y-6">
            <div className="rounded-[28px] border border-[rgba(0,0,0,0.06)] bg-white p-8 shadow-[rgba(0,0,0,0.04)_0px_4px_4px,rgba(0,0,0,0.06)_0px_0px_0px_1px]">
              <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-[#777169]">
                    {activeTab === "FullTest"
                      ? "Full Test Engine"
                      : MODULES[activeTab as ModuleTab].short}
                  </p>
                  <h1 className="mt-3 text-[2.9rem] font-semibold tracking-[-0.06em] text-black md:text-[4rem]">
                    {activeTab === "FullTest"
                      ? "把一整场考试串成一条路径。"
                      : `${MODULES[activeTab as ModuleTab].label}，按题组逐套推进。`}
                  </h1>
                  <p className="mt-4 max-w-3xl text-[16px] leading-8 text-[#4e4e4e]">
                    {activeTab === "FullTest"
                      ? "先定书册，再决定是单独进入模块，还是按 Listening → Reading → Writing 的顺序启动整场模考。"
                      : MODULES[activeTab as ModuleTab].description}
                  </p>

                  <div className="mt-8 grid gap-4 md:grid-cols-3">
                    <HomeSignal
                      label={
                        locale === "zh"
                          ? "当前模块记录"
                          : "Current Module Attempts"
                      }
                      value={currentStats.total}
                    />
                    <HomeSignal
                      label={locale === "zh" ? "最佳 Band" : "Best Band"}
                      value={formatScore(currentStats.best)}
                    />
                    <HomeSignal
                      label={locale === "zh" ? "可见题组" : "Visible Units"}
                      value={filteredUnits.length}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Badge className="rounded-full bg-black px-4 py-1.5 text-white hover:bg-black">
                    {effectiveSelectedBook}
                  </Badge>
                  <label className="flex items-center gap-3 rounded-[20px] border border-[rgba(0,0,0,0.06)] bg-[#fbfaf8] px-4 py-3">
                    <Search className="h-4 w-4 text-[#777169]" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索题目，如 Passage 2 / Task 1 / Cambridge 18"
                      className="w-full bg-transparent text-sm font-medium text-black outline-none placeholder:text-[#9d958b]"
                    />
                  </label>
                  <Select
                    value={effectiveSelectedBook}
                    onValueChange={setSelectedBook}
                  >
                    <SelectTrigger className="h-12 rounded-[20px] border-[rgba(0,0,0,0.06)] bg-[#fbfaf8] text-base font-medium">
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
            </div>

            {activeTab !== "FullTest" ? (
              <div className="overflow-x-auto">
                <div className="inline-flex min-w-full flex-col gap-3 rounded-[24px] border border-[rgba(0,0,0,0.06)] bg-white p-4 shadow-[rgba(0,0,0,0.04)_0px_4px_4px,rgba(0,0,0,0.06)_0px_0px_0px_1px]">
                  <p className="px-1 text-[11px] font-medium uppercase tracking-[0.28em] text-[#777169]">
                    {locale === "zh" ? "模块切换" : "Module Switch"}
                  </p>
                  <div className="flex min-w-max flex-wrap items-center gap-3">
                    {(Object.keys(MODULES) as ModuleTab[]).map((tab) => (
                      <ModuleShortcut
                        key={tab}
                        tab={tab}
                        active={activeTab === tab}
                        onClick={() => setActiveTab(tab)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

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
          </section>
        )}
      </main>
    </div>
  );
}
