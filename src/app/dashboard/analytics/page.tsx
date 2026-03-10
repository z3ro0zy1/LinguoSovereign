"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ArrowLeft, Clock, Target, Activity, BrainCircuit } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatIELTSTitle } from "@/lib/utils";

type AnalyticsRecord = {
  id: string;
  unitId: string;
  date: string;
  category: "Reading" | "Listening" | "Writing" | "Speaking";
  unitTitle: string;
  score: number;
  timeSpent: number;
  evaluated?: boolean;
};

type TimelinePoint = {
  date: string;
  Reading?: number;
  Listening?: number;
  Writing?: number;
  Speaking?: number;
};

type AnalyticsData = {
  averageScores: Record<"Reading" | "Listening" | "Writing" | "Speaking", number>;
  totalTests: number;
  totalTimeSpent: number;
  timeline: TimelinePoint[];
  history: AnalyticsRecord[];
};

const EMPTY_DATA: AnalyticsData = {
  averageScores: { Reading: 0, Listening: 0, Writing: 0, Speaking: 0 },
  totalTests: 0,
  totalTimeSpent: 0,
  timeline: [],
  history: [],
};

export default function AnalyticsDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (status === "authenticated") {
      fetch("/api/analytics")
        .then((res) => res.json())
        .then((json: Partial<AnalyticsData>) => {
          setData({ ...EMPTY_DATA, ...json, averageScores: { ...EMPTY_DATA.averageScores, ...json.averageScores } });
          setLoading(false);
        });
    }
  }, [status, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  const { averageScores, totalTests, totalTimeSpent, timeline, history } = data;

  return (
    <div className="relative min-h-screen bg-[#f5f5f7] p-6 pb-24 font-sans selection:bg-blue-200 md:p-12">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-[#f2f4f8] to-[#e8eaf6]">
        <div className="absolute right-[-10%] top-[-10%] h-[50%] w-[50%] rounded-full bg-blue-300/30 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[60%] w-[60%] rounded-full bg-purple-300/20 blur-[150px]" />
      </div>

      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <Link href="/">
              <Button variant="ghost" className="-ml-4 mb-4 text-gray-500 hover:bg-black/5 hover:text-gray-900">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回主页
              </Button>
            </Link>
            <h1 className="bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-4xl font-black tracking-tight text-transparent">
              数据控制台
            </h1>
            <p className="mt-1 font-medium text-gray-500">
              Hello, {session?.user?.name || session?.user?.email} · 你的 AI 备考报告
            </p>
          </div>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatMetricCard title="总练习次数" value={totalTests} icon={<Activity className="h-5 w-5" />} color="text-blue-600" />
          <StatMetricCard title="专注时长" value={`${Math.round(totalTimeSpent / 60)} 分钟`} icon={<Clock className="h-5 w-5" />} color="text-indigo-600" />
          <StatMetricCard title="阅读估分" value={averageScores.Reading} icon={<Target className="h-5 w-5" />} color="text-emerald-600" subtitle="雅思标准(均分)" />
          <StatMetricCard title="写作估分" value={averageScores.Writing} icon={<BrainCircuit className="h-5 w-5" />} color="text-purple-600" subtitle="AI 深度评估(均分)" />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/60 bg-white/60 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl">
            <h3 className="mb-6 text-xl font-bold text-gray-900">成长轨迹 (最近测试)</h3>
            <div className="mt-10 h-[300px] w-full">
              {timeline.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeline} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6B7280" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6B7280" }} dx={-10} domain={[0, 9]} tickCount={10} />
                    <Tooltip contentStyle={{ borderRadius: "1rem", border: "none", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }} />
                    <Legend wrapperStyle={{ paddingTop: "20px" }} />
                    <Line type="monotone" dataKey="Reading" name="阅读" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                    <Line type="monotone" dataKey="Listening" name="听力" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                    <Line type="monotone" dataKey="Writing" name="写作" stroke="#a855f7" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                    <Line type="monotone" dataKey="Speaking" name="口语" stroke="#ec4899" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center font-medium text-gray-400">暂无数据记录</div>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-3xl border border-white/60 bg-white/60 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl">
            <h3 className="mb-6 text-xl font-bold text-gray-900">模考模块均分</h3>
            <div className="space-y-6">
              <ProgressRow label="阅读 (Reading)" score={averageScores.Reading} total={9} color="bg-blue-500" />
              <ProgressRow label="听力 (Listening)" score={averageScores.Listening} total={9} color="bg-indigo-500" />
              <ProgressRow label="写作 (Writing)" score={averageScores.Writing} total={9} color="bg-purple-500" />
              <ProgressRow label="口语 (Speaking)" score={averageScores.Speaking} total={9} color="bg-pink-500" />
            </div>
          </div>
        </div>

        <div className="mb-10 mt-8 rounded-3xl border border-white/60 bg-white/60 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl">
          <h3 className="mb-6 text-xl font-bold text-gray-900">详细练习记录</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-200 text-sm font-semibold uppercase tracking-wider text-gray-500">
                  <th className="w-[180px] px-4 pb-3">交卷时间</th>
                  <th className="w-[120px] px-4 pb-3">模块</th>
                  <th className="px-4 pb-3">卷宗题目</th>
                  <th className="w-[100px] px-4 pb-3 text-center">雅思估分</th>
                  <th className="w-[120px] px-4 pb-3 text-center">耗时</th>
                  <th className="w-[100px] px-4 pb-3 text-center">详情</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm font-medium text-gray-700">
                {history.length > 0 ? (
                  history.map((record) => (
                    <tr key={record.id} className="transition-colors hover:bg-white/50">
                      <td className="whitespace-nowrap px-4 py-4 text-gray-500">
                        {new Date(record.date).toLocaleString("zh-CN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                            record.category === "Reading"
                              ? "bg-blue-100 text-blue-700"
                              : record.category === "Listening"
                                ? "bg-indigo-100 text-indigo-700"
                                : record.category === "Writing"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-pink-100 text-pink-700"
                          }`}
                        >
                          {record.category === "Reading"
                            ? "阅读"
                            : record.category === "Listening"
                              ? "听力"
                              : record.category === "Writing"
                                ? "写作"
                                : "口语"}
                        </span>
                      </td>
                      <td className="max-w-[300px] truncate px-4 py-4 font-bold text-gray-900" title={formatIELTSTitle(record.unitTitle)}>
                        {formatIELTSTitle(record.unitTitle).replace(/Cambridge \d+ Test \d+ /i, "").trim() || formatIELTSTitle(record.unitTitle)}
                      </td>
                      <td className="px-4 py-4 text-center text-base font-black text-gray-900">
                        {record.evaluated === false ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700">
                            未评估
                          </span>
                        ) : (
                          record.score
                        )}
                      </td>
                      <td className="px-4 py-4 text-center font-mono font-semibold text-gray-500">
                        {Math.floor(record.timeSpent / 60)}:{String(record.timeSpent % 60).padStart(2, "0")}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Link
                          href={`/review/${record.unitId}?submissionId=${record.id}`}
                          className="inline-block rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-800"
                        >
                          详解
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      暂无考卷提交记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatMetricCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-[2rem] border border-white/60 bg-white/60 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] backdrop-blur-md transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.06)]">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ${color}`}>{icon}</div>
      <p className="mb-1 text-sm font-semibold uppercase tracking-widest text-gray-500">{title}</p>
      <h4 className="text-3xl font-black tracking-tight text-gray-900">{value}</h4>
      {subtitle && <p className="mt-2 text-xs font-medium text-gray-400">{subtitle}</p>}
    </div>
  );
}

function ProgressRow({
  label,
  score,
  total,
  color,
}: {
  label: string;
  score: number;
  total: number;
  color: string;
}) {
  const percentage = Math.min(100, Math.max(0, (score / total) * 100));
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm font-bold text-gray-700">
        <span>{label}</span>
        <span>
          {score} / {total}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full border border-white/40 bg-white/50 shadow-inner">
        <div className={`h-full rounded-full ${color} transition-all duration-1000`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
