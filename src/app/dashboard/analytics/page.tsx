"use client";

import { useEffect, useState } from "react";
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

/**
 * AnalyticsDashboard
 * A visually rich, glassmorphism-style dashboard that displays user performance over time.
 * - StatMetricCards: High-level KPIs (Total tests, time, avg scores).
 * - LineChart: Visualizes progress across 4 IELTS categories.
 * - History Table: List of all previous submissions with links to detail view.
 */
export default function AnalyticsDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null); // Stores processed analytics from API
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Basic auth guard
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      // Fetch user specific analytics
      fetch("/api/analytics")
        .then((res) => res.json())
        .then((json) => {
          setData(json);
          setLoading(false);
        });
    }
  }, [status, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  const { averageScores, totalTests, totalTimeSpent, timeline } = data;

  return (
    <div className="min-h-screen bg-[#f5f5f7] relative pb-24 font-sans selection:bg-blue-200 p-6 md:p-12">
      {/* Visual background elements (Apple-style blur blobs) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-gradient-to-br from-[#f2f4f8] to-[#e8eaf6]">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-300/30 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-300/20 rounded-full blur-[150px]"></div>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <Link href="/">
              <Button
                variant="ghost"
                className="mb-4 text-gray-500 hover:text-gray-900 hover:bg-black/5 -ml-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回主页
              </Button>
            </Link>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600">
              数据控制台
            </h1>
            <p className="text-gray-500 font-medium mt-1">
              Hello, {session?.user?.name || session?.user?.email} · 你的 AI
              备考报告
            </p>
          </div>
        </div>

        {/* Global Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatMetricCard
            title="总练习次数"
            value={totalTests}
            icon={<Activity className="w-5 h-5" />}
            color="text-blue-600"
          />
          <StatMetricCard
            title="专注时长"
            value={`${Math.round(totalTimeSpent / 60)} 分钟`}
            icon={<Clock className="w-5 h-5" />}
            color="text-indigo-600"
          />
          <StatMetricCard
            title="阅读估分"
            value={averageScores.Reading}
            icon={<Target className="w-5 h-5" />}
            color="text-emerald-600"
            subtitle="雅思标准(均分)"
          />
          <StatMetricCard
            title="写作估分"
            value={averageScores.Writing}
            icon={<BrainCircuit className="w-5 h-5" />}
            color="text-purple-600"
            subtitle="AI 深度评估(均分)"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Timeline Chart */}
          <div className="bg-white/60 backdrop-blur-2xl rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              成长轨迹 (最近测试)
            </h3>
            <div className="h-[300px] w-full mt-10">
              {timeline.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={timeline}
                    margin={{ top: 5, right: 20, bottom: 5, left: -20 }}
                  >
                    {/* Visual markers for 0-9 IELTS band score scale */}
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#E5E7EB"
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#6B7280" }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#6B7280" }}
                      dx={-10}
                      domain={[0, 9]}
                      tickCount={10}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "1rem",
                        border: "none",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: "20px" }} />
                    {/* Multiple lines representing different skill categories */}
                    <Line
                      type="monotone"
                      dataKey="Reading"
                      name="阅读"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="Listening"
                      name="听力"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="Writing"
                      name="写作"
                      stroke="#a855f7"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="Speaking"
                      name="口语"
                      stroke="#ec4899"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 font-medium">
                  暂无数据记录
                </div>
              )}
            </div>
          </div>

          {/* Dimensions Radar / Detailed breakdown */}
          <div className="bg-white/60 backdrop-blur-2xl rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 flex flex-col justify-center">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              模考模块均分
            </h3>
            <div className="space-y-6">
              <ProgressRow
                label="阅读 (Reading)"
                score={averageScores.Reading}
                total={9.0}
                color="bg-blue-500"
              />
              <ProgressRow
                label="听力 (Listening)"
                score={averageScores.Listening}
                total={9.0}
                color="bg-indigo-500"
              />
              <ProgressRow
                label="写作 (Writing)"
                score={averageScores.Writing}
                total={9.0}
                color="bg-purple-500"
              />
              <ProgressRow
                label="口语 (Speaking)"
                score={averageScores.Speaking}
                total={9.0}
                color="bg-pink-500"
              />
            </div>
          </div>
        </div>

        {/**
         * --- DETAILED RECORD TABLE ---
         * Lists every individual test submission with its score, category, and time spent.
         * Provides a link to the detailed /review/[id] page for in-depth analysis.
         */}
        <div className="mt-8 bg-white/60 backdrop-blur-2xl rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 mb-10">
          <h3 className="text-xl font-bold text-gray-900 mb-6">详细练习记录</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-sm font-semibold uppercase tracking-wider">
                  <th className="pb-3 px-4 w-[180px]">交卷时间</th>
                  <th className="pb-3 px-4 w-[120px]">模块</th>
                  <th className="pb-3 px-4">卷宗题目</th>
                  <th className="pb-3 px-4 text-center w-[100px]">雅思估分</th>
                  <th className="pb-3 px-4 text-center w-[120px]">耗时</th>
                  <th className="pb-3 px-4 text-center w-[100px]">详情</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-gray-700 divide-y divide-gray-100">
                {data.history && data.history.length > 0 ? (
                  data.history.map((record: any) => (
                    <tr
                      key={record.id}
                      className="hover:bg-white/50 transition-colors"
                    >
                      {/* Formatted absolute time for the submission */}
                      <td className="py-4 px-4 whitespace-nowrap text-gray-500">
                        {new Date(record.date).toLocaleString("zh-CN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      {/* Skill Category badge with skill-specific color coding */}
                      <td className="py-4 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
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
                      <td
                        className="py-4 px-4 text-gray-900 font-bold truncate max-w-[300px]"
                        title={formatIELTSTitle(record.unitTitle)}
                      >
                        {formatIELTSTitle(record.unitTitle)
                          .replace(/Cambridge \d+ Test \d+ /i, "")
                          .trim() || formatIELTSTitle(record.unitTitle)}
                      </td>
                      {/* Large band score for immediate readability */}
                      <td className="py-4 px-4 text-center font-black text-gray-900 text-base">
                        {record.score}
                      </td>
                      {/* Time taken formatted as MM:SS */}
                      <td className="py-4 px-4 text-center text-gray-500 font-semibold font-mono">
                        {Math.floor(record.timeSpent / 60)}:
                        {String(record.timeSpent % 60).padStart(2, "0")}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <Link
                          href={`/review/${record.id}`}
                          className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors inline-block"
                        >
                          详解
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
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

/**
 * StatMetricCard Component
 * Displays a single key performance indicator inside a glassmorphism card.
 */
function StatMetricCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: any;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white/60 backdrop-blur-md rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white/60 hover:shadow-[0_8px_40px_rgb(0,0,0,0.06)] transition-all">
      {/* Icon container with shadow for depth */}
      <div
        className={`w-10 h-10 rounded-xl mb-4 flex items-center justify-center bg-white shadow-sm ${color}`}
      >
        {icon}
      </div>
      <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1">
        {title}
      </p>
      <h4 className="text-3xl font-black text-gray-900 tracking-tight">
        {value}
      </h4>
      {subtitle && (
        <p className="text-xs text-gray-400 mt-2 font-medium">{subtitle}</p>
      )}
    </div>
  );
}

/**
 * ProgressRow Component
 * A stylized progress bar representing a score relative to a total (usually 9.0 for IELTS).
 */
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
      <div className="flex justify-between text-sm font-bold text-gray-700 mb-2">
        <span>{label}</span>
        <span>
          {score} / {total}
        </span>
      </div>
      <div className="w-full h-3 bg-white/50 rounded-full overflow-hidden border border-white/40 shadow-inner">
        {/* The progress bar width is controlled via inline style to allow CSS transitions */}
        <div
          className={`h-full ${color} rounded-full transition-all duration-1000`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}
