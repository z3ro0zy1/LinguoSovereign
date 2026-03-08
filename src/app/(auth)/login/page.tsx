"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * LoginPage Component
 * A client-side component providing the user interface and logic for authenticating users.
 * Uses NextAuth.js for session management and credential-based login.
 */
export default function LoginPage() {
  const router = useRouter();

  // --- UI State ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(""); // Tracks validation or auth-related error messages
  const [loading, setLoading] = useState(false); // Controls button loading state and prevents double submission

  /**
   * handleSubmit
   * Logic for processing the login form submission.
   * 1. Prevents default form event.
   * 2. Calls NextAuth `signIn` with 'credentials' provider.
   * 3. Configures redirect: false to handle errors locally on the same page.
   * 4. On success, redirects to the application root.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      redirect: false, // Prevent NextAuth from automatically redirecting
      email,
      password,
    });

    if (res?.error) {
      // Common error: Incorrect email or password
      setError("登录失败：邮箱或密码错误");
      setLoading(false);
    } else {
      // Success: Redirect to dashboard and refresh state
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f2f4f8] to-[#e8eaf6] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Ambient background for frosted glass contrast */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-300/30 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-300/20 rounded-full blur-[150px] pointer-events-none -z-10"></div>

      <div className="w-full max-w-md bg-white/60 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.05)] border border-white/60 p-10 relative">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-sm mb-4">
            LS
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            欢迎回来
          </h1>
          <p className="text-sm font-medium text-gray-500 mt-2">
            登录 LinguoSovereign 语言主权
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
            <label className="text-xs font-bold text-gray-600 uppercase tracking-widest flex justify-between">
              <span>密码</span>
              <a
                href="#"
                className="text-blue-600 hover:text-blue-700 capitalize tracking-normal"
              >
                忘记密码?
              </a>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-14 px-4 rounded-2xl bg-white/50 border border-white/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all text-gray-900 font-medium"
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-14 mt-4 rounded-2xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-lg shadow-xl shadow-gray-900/10 transition-all"
          >
            {loading ? "验证中..." : "登录"}
          </Button>
        </form>

        <p className="text-center text-sm font-medium text-gray-500 mt-8">
          还没有账号？{" "}
          <Link
            href="/register"
            className="text-blue-600 font-bold hover:underline"
          >
            立即免费注册
          </Link>
        </p>
      </div>
    </div>
  );
}
