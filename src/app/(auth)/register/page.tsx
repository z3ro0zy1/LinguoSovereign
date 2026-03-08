"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * RegisterPage Component
 * A client-side component for creating new user accounts.
 * Interfaces with the `/api/register` backend route.
 */
export default function RegisterPage() {
  const router = useRouter();

  // --- Form State ---
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(""); // Captures validation errors or server-side "User exists" messages
  const [loading, setLoading] = useState(false); // Manages registration submission state

  /**
   * handleSubmit
   * Processes the account creation request.
   * 1. Validates input consistency.
   * 2. POSTs data to /api/register.
   * 3. On success, redirects user to login page with a success flag.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Send user data payload to registration API
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handled server-side errors (e.g., duplicated email)
        setError(data.error || "注册失败");
        setLoading(false);
      } else {
        // Success: Redirect to login with query param to trigger success notification
        router.push("/login?registered=true");
      }
    } catch (e) {
      // General network/endpoint failure
      setError("网络错误，请稍后重试");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f2f4f8] to-[#e8eaf6] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-300/30 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-300/20 rounded-full blur-[150px] pointer-events-none -z-10"></div>

      <div className="w-full max-w-md bg-white/60 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.05)] border border-white/60 p-10 relative">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-sm mb-4">
            LS
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            欢迎加入
          </h1>
          <p className="text-sm font-medium text-gray-500 mt-2">
            创建您的 LinguoSovereign 账户
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm font-semibold p-3 rounded-xl mb-6 text-center border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-widest">
              姓名 / 昵称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-14 px-4 rounded-2xl bg-white/50 border border-white/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all text-gray-900 font-medium"
              placeholder="Candidate"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-widest">
              邮箱地址
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-14 px-4 rounded-2xl bg-white/50 border border-white/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all text-gray-900 font-medium"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-widest">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-14 px-4 rounded-2xl bg-white/50 border border-white/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all text-gray-900 font-medium"
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-14 mt-4 rounded-2xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-lg shadow-xl shadow-gray-900/10 transition-all"
          >
            {loading ? "注册中..." : "立即注册"}
          </Button>
        </form>

        <p className="text-center text-sm font-medium text-gray-500 mt-8">
          已有账号？{" "}
          <Link
            href="/login"
            className="text-blue-600 font-bold hover:underline"
          >
            直接登录
          </Link>
        </p>
      </div>
    </div>
  );
}
