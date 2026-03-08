"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Headphones,
  Settings,
  Mic,
  Edit3,
  ArrowRight,
  List as ListIcon,
} from "lucide-react";
import { formatIELTSTitle } from "@/lib/utils";
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
import { Button } from "@/components/ui/button";

/**
 * DashboardClient Component
 *
 * The main landing interface for authenticated users. It serves as a central orchestrator for:
 * 1. Navigating between IELTS modules (Reading, Listening, Writing, Speaking).
 * 2. Browsing and filtering the question bank by Cambridge 'Book' and 'Test' numbers.
 * 3. Viewing high-level engagement stats and personal records.
 */
export default function DashboardClient({ allUnits }: { allUnits: any[] }) {
  const { data: session, status } = useSession();

  // Tab definitions for the internal routing of the dashboard
  type TabType =
    | "home"
    | "Reading"
    | "Listening"
    | "Writing"
    | "Speaking"
    | "FullTest";
  const [activeTab, setActiveTab] = useState<TabType>("home");

  const categories = ["Reading", "Listening", "Writing", "Speaking"];

  // Local state for user's past submission history, used for "Last Attempt" displays
  const [history, setHistory] = useState<any[]>([]);

  // Fetch performance data on mount or session change
  useEffect(() => {
    if (session?.user) {
      fetch("/api/analytics")
        .then((r) => r.json())
        .then((d) => {
          if (d.history) setHistory(d.history);
        })
        .catch(console.error);
    }
  }, [session]);

  /**
   * currentStats: Calculates contextual stats based on the currently selected tab.
   * e.g., if on the 'Reading' tab, it shows total 'Reading' tests and the personal best.
   */
  const currentStats = useMemo(() => {
    let filteredHistory = history;
    if (activeTab === "Reading") {
      filteredHistory = history.filter(
        (h) => h.category === "Reading" || h.category === "Reading/Listening",
      );
    } else if (activeTab === "Listening") {
      filteredHistory = history.filter(
        (h) => h.category === "Listening" || h.category === "Reading/Listening",
      );
    } else if (activeTab === "Writing") {
      filteredHistory = history.filter((h) => h.category === "Writing");
    } else if (activeTab === "Speaking") {
      filteredHistory = history.filter((h) => h.category === "Speaking");
    }

    const testCount = filteredHistory.length;
    let bestScore = 0;
    filteredHistory.forEach((h) => {
      const score = parseFloat(h.score);
      if (!isNaN(score) && score > bestScore) {
        bestScore = score;
      }
    });

    return {
      count: testCount || "0",
      best: bestScore > 0 ? bestScore : "暂无",
    };
  }, [history, activeTab]);

  // Global statistics for the question bank (calculated from the full JSON payload)
  const stats = useMemo(() => {
    return {
      reading: allUnits.filter(
        (u) =>
          u.category === "Reading/Listening" && u.title.includes("Passage"),
      ).length,
      listening: allUnits.filter(
        (u) => u.category === "Reading/Listening" && u.title.includes("Part"),
      ).length,
      writing: allUnits.filter((u) => u.category === "Writing").length,
      speaking: allUnits.filter((u) => u.category === "Speaking").length,
    };
  }, [allUnits]);

  /**
   * books: Extracts all unique 'Cambridge Book' titles (e.g., C15, C16)
   * used to populate the main filter dropdown.
   */
  const books = useMemo(() => {
    const bookSet = new Set<string>();
    allUnits.forEach((u) => {
      const bookMatch = u.title.match(/(?:剑|C)(\d+)/i);
      if (bookMatch) {
        bookSet.add(`Cambridge ${bookMatch[1]}`);
      } else {
        bookSet.add("Other");
      }
    });

    const sortedList = Array.from(bookSet).sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, "")) || 0;
      const numB = parseInt(b.replace(/[^0-9]/g, "")) || 0;
      return numA - numB;
    });

    if (sortedList.includes("Other")) {
      const withouthOther = sortedList.filter((b) => b !== "Other");
      return [...withouthOther, "Other"];
    }
    return sortedList;
  }, [allUnits]);

  // Selected filter state for the book selector
  const [selectedBook, setSelectedBook] = useState<string>(books[0] || "Other");

  // A memoized list of units belonging to the currently selected book.
  const activeUnits = useMemo(() => {
    return allUnits.filter((u) => {
      const bookMatch = u.title.match(/(?:剑|C)(\d+)/i);
      const b = bookMatch ? `Cambridge ${bookMatch[1]}` : "Other";
      return b === selectedBook;
    });
  }, [allUnits, selectedBook]);

  return (
    <div className="min-h-screen bg-[#f5f5f7] relative pb-24 font-sans selection:bg-blue-200">
      {/* Ambient background for frosted glass contrast (Apple-style localized glowing orbs) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-gradient-to-br from-[#f2f4f8] to-[#e8eaf6]">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-300/30 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-300/20 rounded-full blur-[150px]"></div>
        <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] bg-purple-200/30 rounded-full blur-[100px]"></div>
      </div>

      {/* Top Navigation - Apple Glassmorphism */}
      <nav className="fixed top-0 z-50 w-full bg-white/50 backdrop-blur-2xl border-b border-white/40 px-8 py-4 flex items-center justify-between shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => setActiveTab("home")}
        >
          <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm">
            LS
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-black tracking-[0.2em] text-gray-900 leading-tight">
              LINGUOSOVEREIGN
            </span>
            <span className="text-[11px] font-medium text-gray-500 tracking-widest leading-tight">
              语言主权 AI赋能
            </span>
          </div>
        </div>

        <div className="hidden lg:flex gap-10 text-sm font-semibold text-gray-500">
          <span
            onClick={() => setActiveTab("Reading")}
            className={`cursor-pointer transition ${activeTab === "Reading" ? "text-blue-600 font-bold" : "hover:text-gray-900"}`}
          >
            模考阅读
          </span>
          <span
            onClick={() => setActiveTab("Listening")}
            className={`cursor-pointer transition ${activeTab === "Listening" ? "text-blue-600 font-bold" : "hover:text-gray-900"}`}
          >
            自动听力
          </span>
          <span
            onClick={() => setActiveTab("Writing")}
            className={`cursor-pointer transition ${activeTab === "Writing" ? "text-blue-600 font-bold" : "hover:text-gray-900"}`}
          >
            精批写作
          </span>
          <span
            onClick={() => setActiveTab("Speaking")}
            className={`cursor-pointer transition ${activeTab === "Speaking" ? "text-blue-600 font-bold" : "hover:text-gray-900"}`}
          >
            流式口语
          </span>
          <span
            onClick={() => setActiveTab("FullTest")}
            className={`cursor-pointer transition ${activeTab === "FullTest" ? "text-blue-600 font-bold" : "hover:text-gray-900"}`}
          >
            全真考
          </span>
        </div>

        <div className="flex gap-4">
          {status === "loading" ? (
            <div className="w-10 h-10 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
          ) : session ? (
            <div className="flex items-center gap-6">
              <Link
                href="/profile"
                className="font-bold text-blue-600 hover:text-blue-800 transition-colors text-sm flex items-center gap-1"
              >
                <Settings className="w-4 h-4" /> 个人资料
              </Link>
              <div className="h-4 w-px bg-gray-300"></div>
              <span className="font-bold text-gray-700">
                Hi,{" "}
                {session.user?.name ||
                  session.user?.email?.split("@")[0] ||
                  "User"}
              </span>
              <Link href="/dashboard/analytics">
                <Button
                  variant="outline"
                  className="font-bold rounded-xl border-gray-300 bg-white/50 text-gray-700 hover:bg-white shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
                >
                  数据面板
                </Button>
              </Link>
              <Button
                onClick={() => signOut()}
                variant="ghost"
                className="font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl"
              >
                登出
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link href="/register">
                <Button
                  variant="ghost"
                  className="font-bold text-gray-600 hover:text-gray-900 hover:bg-black/5 rounded-xl"
                >
                  注册
                </Button>
              </Link>
              <Link href="/login">
                <Button className="bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl shadow-md border border-gray-800">
                  登入题库
                </Button>
              </Link>
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-[1280px] mx-auto pt-40 px-6">
        {/* Dynamic Main View Rendering based on Active Tab */}
        {activeTab === "home" && (
          <>
            {/* Hero Section */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-16 items-center mb-24 animate-in slide-in-from-bottom-3 duration-500">
              <div className="flex flex-col gap-8">
                <h1 className="text-5xl md:text-6xl lg:text-[72px] font-extrabold text-gray-900 leading-[1.1] tracking-tight">
                  让真题、评分标准和语音交互真正服务于你的
                  <span className="text-blue-600 relative">
                    雅思提分
                    <svg
                      className="absolute w-full h-3 -bottom-1 left-0 text-blue-200 -z-10"
                      viewBox="0 0 100 10"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M0 5 Q 50 10 100 5"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                      />
                    </svg>
                  </span>
                  。
                </h1>
                <p className="text-lg text-gray-500 leading-relaxed max-w-2xl font-medium">
                  LinguoSovereign 搭载海量本地优质库，与最先进的大语言模型
                  (LLMs)
                  无缝集成。通过智能批改、流式化语音录入及自适应提示词工程
                  (Prompt)，我们正重新定义考培闭环。
                </p>
                <div className="flex flex-wrap gap-4 mt-2">
                  <Button
                    size="lg"
                    onClick={() => setActiveTab("FullTest")}
                    className="rounded-full px-8 h-14 bg-gray-900 hover:bg-gray-800 text-white text-base font-semibold shadow-xl shadow-gray-900/20"
                  >
                    开启模考 <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                  <Link href="/dashboard/analytics">
                    <Button
                      size="lg"
                      variant="outline"
                      className="rounded-full px-8 h-14 border-gray-300 text-gray-700 hover:bg-gray-50 text-base font-semibold shadow-sm"
                    >
                      查看我的数据
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Stats Section matching reference (Glassmorphism) */}
              <div className="bg-white/60 backdrop-blur-3xl rounded-[2.5rem] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.05)] border border-white/60 relative overflow-hidden">
                <div className="flex flex-col gap-4">
                  <StatCard
                    title="阅读"
                    desc="全真阅读篇段"
                    count={stats.reading}
                  />
                  <StatCard
                    title="听力"
                    desc="原声听力录音"
                    count={stats.listening}
                  />
                  <StatCard
                    title="写作"
                    desc="大作文 / 小作文"
                    count={stats.writing}
                  />
                  <StatCard
                    title="口语"
                    desc="Part 1-3 语料"
                    count={stats.speaking}
                  />
                </div>
              </div>
            </div>

            {/* Learning Insights Section */}
            <div className="mt-10 animate-in slide-in-from-bottom-5 duration-700">
              <div className="mb-10">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600">
                  今日学习指北
                </h2>
                <p className="text-gray-500 font-medium">
                  高效备考，拒绝盲目刷题。看看系统为您推荐的策略。
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-blue-50/50 backdrop-blur-xl p-8 rounded-[2rem] border border-blue-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
                      <BookOpen className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      阅读提分策略
                    </h3>
                    <p className="text-gray-600 text-[15px] leading-relaxed mb-6 font-medium">
                      中国考生最易提分的模块。重点在于掌握「同义替换」与「定位词」技巧。建议每天保持2篇泛读，1篇精读。
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-xl w-full border-blue-200 text-blue-700 hover:bg-blue-100 font-bold"
                    onClick={() => setActiveTab("Reading")}
                  >
                    去刷阅读
                  </Button>
                </div>
                <div className="bg-indigo-50/50 backdrop-blur-xl p-8 rounded-[2rem] border border-indigo-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
                      <Headphones className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      听力磨耳朵
                    </h3>
                    <p className="text-gray-600 text-[15px] leading-relaxed mb-6 font-medium">
                      每天利用碎片时间泛听历年真题录音，培养语感。针对 Part 3&4
                      的长单句，推荐使用倍速播放进行高压抗干扰训练。
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-xl w-full border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold"
                    onClick={() => setActiveTab("Listening")}
                  >
                    自动听力
                  </Button>
                </div>
                <div className="bg-purple-50/50 backdrop-blur-xl p-8 rounded-[2rem] border border-purple-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
                      <Edit3 className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      写作逐句批改
                    </h3>
                    <p className="text-gray-600 text-[15px] leading-relaxed mb-6 font-medium">
                      不仅看总分，系统能依据四大官方评分维度(TR, CC, LR,
                      GRA)为您指出语法错误和高级词汇替换，告别废话写作。
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-xl w-full border-purple-200 text-purple-700 hover:bg-purple-100 font-bold"
                    onClick={() => setActiveTab("Writing")}
                  >
                    写作专训
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Modular / Full Test Views */}
        {activeTab !== "home" && (
          <div className="mt-8 animate-in fade-in duration-500 flex flex-col lg:flex-row gap-8">
            {/* LEFT MAIN AREA: Test Listings */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
                <div>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600">
                    {activeTab === "FullTest" ? "全真考引擎" : "单项突破舱"}
                  </h2>
                  <p className="text-gray-500 font-medium">
                    {activeTab === "FullTest"
                      ? "在这里，您可以像正式机考一样连续完成一套完整的剑桥雅思测试。"
                      : "在下方选择您想要攻克的剑桥雅思卷宗。"}
                  </p>
                </div>

                <Select value={selectedBook} onValueChange={setSelectedBook}>
                  <SelectTrigger className="w-[240px] h-12 text-base rounded-2xl border-white/50 bg-white/60 backdrop-blur-md font-bold shadow-sm focus:ring-blue-500/30">
                    <SelectValue placeholder="Select a Book" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {books.map((book) => (
                      <SelectItem
                        key={book}
                        value={book}
                        className="text-base py-2 cursor-pointer font-medium rounded-lg"
                      >
                        {book}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Content Rendering By Active Tab */}
              {activeTab === "Reading" && (
                <TestGroupedView
                  units={activeUnits.filter(
                    (u) =>
                      u.category === "Reading/Listening" &&
                      u.title.includes("Passage"),
                  )}
                  icon={<BookOpen className="w-5 h-5 text-gray-700" />}
                  history={history}
                />
              )}
              {activeTab === "Listening" && (
                <TestGroupedView
                  units={activeUnits.filter(
                    (u) =>
                      u.category === "Reading/Listening" &&
                      u.title.includes("Part"),
                  )}
                  icon={<Headphones className="w-5 h-5 text-gray-700" />}
                  history={history}
                />
              )}
              {activeTab === "Writing" && (
                <TestGroupedView
                  units={activeUnits.filter((u) => u.category === "Writing")}
                  icon={<Edit3 className="w-5 h-5 text-gray-700" />}
                  history={history}
                />
              )}
              {activeTab === "Speaking" && (
                <TestGroupedView
                  units={activeUnits.filter((u) => u.category === "Speaking")}
                  icon={<Mic className="w-5 h-5 text-gray-700" />}
                  history={history}
                />
              )}
              {activeTab === "FullTest" && (
                <FullTestGroupedView units={activeUnits} />
              )}
            </div>

            {/* RIGHT SIDEBAR: User Profile & Stats */}
            <div className="w-full lg:w-[320px] flex flex-col gap-6 shrink-0 mt-2 lg:mt-[90px]">
              <div className="bg-white/60 backdrop-blur-2xl rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 p-[3px] mb-4 shadow-md">
                  <div className="w-full h-full bg-white rounded-full flex items-center justify-center font-black text-2xl text-gray-800">
                    {session?.user?.name?.[0]?.toUpperCase() ||
                      session?.user?.email?.[0]?.toUpperCase() ||
                      "U"}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {session?.user?.name ||
                    session?.user?.email?.split("@")[0] ||
                    "User"}
                </h3>

                <div className="w-full h-px bg-gray-200/60 my-6"></div>

                <div className="w-full flex justify-between px-2 mb-6">
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-gray-900">
                      {currentStats.count}
                    </span>
                    <span className="text-xs font-medium text-gray-500">
                      累计考试
                    </span>
                  </div>
                  <div className="w-px h-10 bg-gray-200/60"></div>
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-gray-900">
                      {currentStats.best}
                    </span>
                    <span className="text-xs font-medium text-gray-500">
                      历史最高
                    </span>
                  </div>
                </div>

                <Link href="/dashboard/analytics" className="w-full">
                  <Button
                    variant="outline"
                    className="w-full rounded-xl border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 font-bold transition-colors"
                  >
                    模考记录
                  </Button>
                </Link>
              </div>

              <div className="bg-gray-900 rounded-3xl p-6 shadow-xl relative overflow-hidden group cursor-pointer transition-transform hover:-translate-y-1">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-yellow-400/20 to-transparent rounded-full blur-2xl"></div>
                <h4 className="text-white font-black text-lg mb-2 z-10 relative">
                  LinguoSovereign VIP
                </h4>
                <p className="text-gray-400 text-xs font-medium mb-6 z-10 relative">
                  全库题源解析、口语答案畅听特权
                </p>
                <Button className="bg-[#D4B37F] hover:bg-[#c2a16d] text-gray-900 font-bold rounded-full h-9 px-6 text-xs z-10 relative">
                  立即开通
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * StatCard Helper Component
 * Used in the sidebar/hero to show a count of available resources.
 */
function StatCard({
  title,
  desc,
  count,
}: {
  title: string;
  desc: string;
  count: number;
}) {
  return (
    <div className="bg-white/50 hover:bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_4px_15px_rgba(0,0,0,0.02)] transition-all duration-300 rounded-2xl p-6 flex justify-between items-center group">
      <div className="flex flex-col gap-1">
        <span className="text-gray-900 font-extrabold text-lg">{title}</span>
        <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
          {desc}
        </span>
      </div>
      {/* Dynamic gradient text for the numbers */}
      <div className="text-4xl font-black text-gray-900 tracking-tighter group-hover:scale-105 transition-transform duration-300 bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-500">
        {count}
      </div>
    </div>
  );
}

/**
 * TestGroupedView Helper Component
 * Renders a list of units grouped by 'Test' number (e.g., Test 1, Test 2).
 * Each row shows the short title, completion status, last score, and action buttons.
 */
function TestGroupedView({
  units,
  icon,
  history,
}: {
  units: any[];
  icon: React.ReactNode;
  history?: any[];
}) {
  if (!units || units.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white border border-gray-100 rounded-3xl shadow-sm">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
          {icon}
        </div>
        <p className="text-gray-500 font-semibold">该卷宗下暂无对应模块</p>
      </div>
    );
  }

  const grouped: Record<string, any[]> = {};

  units.forEach((u) => {
    let test = "General / Independent Task";
    const testMatch = u.title.match(/(?:Test|T)[\s-]*(\d+)/i);
    if (testMatch) test = `Test ${testMatch[1]}`;

    if (!grouped[test]) grouped[test] = [];

    const shortTitle =
      formatIELTSTitle(u.title)
        .replace(/Cambridge \d+ Test \d+ /i, "")
        .trim() || formatIELTSTitle(u.title);
    grouped[test].push({ ...u, shortTitle });
  });

  return (
    <div className="flex flex-col gap-8">
      {Object.keys(grouped)
        .sort()
        .map((test) => (
          <div
            key={test}
            className="bg-white/60 backdrop-blur-2xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 overflow-hidden"
          >
            {/* Table Header Wrapper */}
            <div className="bg-gray-50/80 px-6 py-4 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-3 w-1/4">
                <div className="w-1.5 h-5 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">
                  {test}
                </h3>
              </div>
              <div className="flex-1 hidden md:flex items-center text-sm font-bold text-gray-400">
                <div className="flex-1 text-center">场景</div>
                <div className="flex-1 text-center">练习记录</div>
                <div className="flex-1 text-center">上次练习</div>
                <div className="flex-1 text-center">练习答题</div>
              </div>
            </div>

            {/* Table Body (Rows) */}
            <div className="flex flex-col">
              {grouped[test].map((u, i) => {
                // Infer unit stats from history
                const unitHistory =
                  history?.filter((h) => h.unitId === u.id) || [];
                const sortedHistory = [...unitHistory].sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime(),
                );
                const lastAttempt = sortedHistory[0];

                const totalAttempts = unitHistory.length;
                let scoreDisplay = "- -";
                if (lastAttempt && lastAttempt.score) {
                  // Round to nearest 0.5 for IELTS standard
                  const rawScore = parseFloat(lastAttempt.score);
                  const ieltsScore = (Math.round(rawScore * 2) / 2).toFixed(1);
                  scoreDisplay = `Score: ${ieltsScore}`;
                }

                return (
                  <div
                    key={u.id}
                    className={`flex flex-col md:flex-row items-start md:items-center px-6 py-5 hover:bg-blue-50/30 transition-colors ${i !== grouped[test].length - 1 ? "border-b border-gray-100" : ""}`}
                  >
                    <div className="w-full md:w-1/4 mb-4 md:mb-0">
                      <span
                        className="font-bold text-[15px] text-blue-600 truncate block cursor-pointer hover:underline"
                        title={u.title}
                      >
                        {formatIELTSTitle(u.title)}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col md:flex-row w-full items-center text-sm font-medium text-gray-600">
                      <div className="flex-1 text-center w-full md:w-auto mb-2 md:mb-0 py-1">
                        综合/学术
                      </div>
                      <div className="flex-1 text-center w-full md:w-auto mb-2 md:mb-0 py-1">
                        {totalAttempts > 0 ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
                                {scoreDisplay}{" "}
                                <span className="text-xs text-gray-400 underline decoration-dashed">
                                  ({totalAttempts}次)
                                </span>
                              </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle>练习记录详请</DialogTitle>
                              </DialogHeader>
                              <div className="mt-4 space-y-3">
                                {sortedHistory.map(
                                  (attempt: any, idx: number) => {
                                    const rawScore = attempt.score
                                      ? parseFloat(attempt.score)
                                      : 0;
                                    const ieltsScore = (
                                      Math.round(rawScore * 2) / 2
                                    ).toFixed(1);
                                    return (
                                      <div
                                        key={attempt.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                                      >
                                        <div>
                                          <div className="text-sm font-semibold text-gray-800">
                                            第 {sortedHistory.length - idx}{" "}
                                            次练习
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {new Date(
                                              attempt.createdAt,
                                            ).toLocaleString()}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <span className="text-sm font-bold text-gray-700">
                                            Score: {ieltsScore}
                                          </span>
                                          {/* Pass submission ID optionally to review instead of unit, or keep unit for standard flow */}
                                          <Link
                                            href={`/review/${u.id}?submissionId=${attempt.id}`}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                                          >
                                            详解
                                          </Link>
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <span className="text-gray-400">{scoreDisplay}</span>
                        )}
                      </div>
                      <div className="flex-1 text-center w-full md:w-auto mb-2 md:mb-0 py-1">
                        {lastAttempt
                          ? `已答: ${new Date(lastAttempt.createdAt).toLocaleDateString()}`
                          : "未作答"}
                      </div>
                      <div className="flex-1 flex justify-center items-center gap-4 w-full md:w-auto py-1">
                        <Link
                          href={`/eval/${u.id}`}
                          className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 transition-colors group"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>{lastAttempt ? "继续作答" : "开始作答"}</span>
                        </Link>
                        <Link
                          href={`/review/${u.id}`}
                          className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 transition-colors group"
                        >
                          <ListIcon className="w-4 h-4" />
                          <span>详解</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}

function FullTestGroupedView({ units }: { units: any[] }) {
  if (!units || units.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white border border-gray-100 rounded-3xl shadow-sm">
        <p className="text-gray-500 font-semibold">该卷宗下暂无试题数据</p>
      </div>
    );
  }

  const testGroups: Record<string, any[]> = {};
  units.forEach((u) => {
    let testName = "General / Unknown Test";
    const testMatch = u.title.match(/(?:Test|T)[\s-]*(\d+)/i);
    if (testMatch) testName = `Test ${testMatch[1]}`;
    if (!testGroups[testName]) testGroups[testName] = [];
    testGroups[testName].push(u);
  });

  return (
    <div className="flex flex-col gap-8">
      {Object.keys(testGroups)
        .sort()
        .map((testKey) => {
          const testItems = testGroups[testKey];
          // Get representative ID for starting the test flow.
          // A real flow would redirect to an Eval entry point that queues them up.
          // For now, we'll map them horizontally as large cards.

          let listUnit = testItems.find(
            (u) =>
              u.category === "Reading/Listening" && u.title.includes("Part"),
          );
          let readUnit = testItems.find(
            (u) =>
              u.category === "Reading/Listening" && u.title.includes("Passage"),
          );
          let writUnit = testItems.find((u) => u.category === "Writing");
          let speakUnit = testItems.find((u) => u.category === "Speaking");

          // Build a full continuous test sequence omitting speaking
          const orderWeight = (title: string, category: string) => {
            if (category === "Reading/Listening" && title.includes("Part"))
              return 1;
            if (category === "Reading/Listening" && title.includes("Passage"))
              return 2;
            if (category === "Writing") return 3;
            if (category === "Speaking") return 4;
            return 5;
          };

          const flowSequence = testItems
            .filter((u) => u.category !== "Speaking")
            .sort((a, b) => {
              const weightDiff =
                orderWeight(a.title, a.category) -
                orderWeight(b.title, b.category);
              if (weightDiff !== 0) return weightDiff;
              // Sub sort algebraically
              return a.title.localeCompare(b.title);
            })
            .map((u) => u.id);

          let flowHref = "";
          if (flowSequence.length > 0) {
            const firstId = flowSequence[0];
            const allIds = flowSequence.join(",");
            flowHref = `/eval/${firstId}?flow=${allIds}`;
          }

          return (
            <div
              key={testKey}
              className="bg-white/60 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 p-8 flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-6 bg-red-500 rounded-full"></div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                    {testKey}{" "}
                    <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded ml-2 align-middle">
                      NEW
                    </span>
                  </h3>
                </div>
                {listUnit && flowHref && (
                  <Link href={flowHref}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full font-bold text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      模拟考试
                    </Button>
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Listening Card */}
                {listUnit ? (
                  <Link href={`/eval/${listUnit.id}`}>
                    <div className="bg-red-50/50 hover:bg-red-50 border border-red-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center h-40 transition-all cursor-pointer group">
                      <Headphones className="w-8 h-8 text-red-300 mb-3 group-hover:text-red-500 transition-colors" />
                      <span className="font-bold text-gray-800 mb-2">
                        Listening
                      </span>
                      <Button
                        size="sm"
                        className="bg-red-500 hover:bg-red-600 text-white rounded-full px-6 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-4"
                      >
                        开始考试
                      </Button>
                    </div>
                  </Link>
                ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center h-40 opacity-50">
                    <Headphones className="w-8 h-8 text-gray-300 mb-3" />
                    <span className="font-bold text-gray-400 mb-2">
                      Listening
                    </span>
                  </div>
                )}

                {/* Reading Card */}
                {readUnit ? (
                  <Link href={`/eval/${readUnit.id}`}>
                    <div className="bg-red-50/50 hover:bg-red-50 border border-red-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center h-40 transition-all cursor-pointer group relative">
                      <BookOpen className="w-8 h-8 text-red-300 mb-3 group-hover:text-red-500 transition-colors" />
                      <span className="font-bold text-gray-800 mb-2">
                        Reading
                      </span>
                      <Button
                        size="sm"
                        className="bg-red-500 hover:bg-red-600 text-white rounded-full px-6 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-4"
                      >
                        开始考试
                      </Button>
                    </div>
                  </Link>
                ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center h-40 opacity-50">
                    <BookOpen className="w-8 h-8 text-gray-300 mb-3" />
                    <span className="font-bold text-gray-400 mb-2">
                      Reading
                    </span>
                  </div>
                )}

                {/* Writing Card */}
                {writUnit ? (
                  <Link href={`/eval/${writUnit.id}`}>
                    <div className="bg-red-50/50 hover:bg-red-50 border border-red-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center h-40 transition-all cursor-pointer group relative">
                      <Edit3 className="w-8 h-8 text-red-300 mb-3 group-hover:text-red-500 transition-colors" />
                      <span className="font-bold text-gray-800 mb-2">
                        Writing
                      </span>
                      <Button
                        size="sm"
                        className="bg-red-500 hover:bg-red-600 text-white rounded-full px-6 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-4"
                      >
                        开始考试
                      </Button>
                    </div>
                  </Link>
                ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center h-40 opacity-50">
                    <Edit3 className="w-8 h-8 text-gray-300 mb-3" />
                    <span className="font-bold text-gray-400 mb-2">
                      Writing
                    </span>
                  </div>
                )}

                {/* Speaking Card (Special Styling) */}
                {speakUnit ? (
                  <Link href={`/eval/${speakUnit.id}`}>
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-100 hover:from-indigo-100 hover:to-blue-200 border border-blue-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center h-40 transition-all cursor-pointer">
                      <span className="font-black text-indigo-900 text-xl mb-1 mt-2">
                        Speaking
                      </span>
                      <span className="text-xs text-indigo-600 font-medium mb-3">
                        专业1v1口语机考
                      </span>
                      <Button
                        size="sm"
                        className="bg-[#3800B0] hover:bg-[#2A0088] text-white rounded-full px-6 w-full"
                      >
                        立即测试
                      </Button>
                    </div>
                  </Link>
                ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center h-40 opacity-50">
                    <Mic className="w-8 h-8 text-gray-300 mb-3" />
                    <span className="font-bold text-gray-400 mb-2">
                      Speaking
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
