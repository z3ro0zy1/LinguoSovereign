"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowLeft, ArrowRight, Home, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell registered={false} callbackUrl="/" />}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  return (
    <LoginShell
      registered={searchParams.get("registered") === "true"}
      callbackUrl={searchParams.get("callbackUrl") || "/"}
    />
  );
}

function LoginShell({ registered, callbackUrl }: { registered: boolean; callbackUrl: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => (registered ? "注册成功，继续登录" : "欢迎回到 LinguoSovereign"), [registered]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl,
    });

    if (response?.error) {
      setError("登录失败：邮箱或密码错误。");
      setLoading(false);
      return;
    }

    router.replace(callbackUrl);
    router.refresh();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#edf2f7] px-6 py-12 text-slate-900">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_34%),radial-gradient(circle_at_80%_20%,_rgba(245,158,11,0.18),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]" />
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/78 shadow-[0_30px_80px_rgba(15,23,42,0.1)] backdrop-blur-2xl lg:grid-cols-[1fr_460px]">
        <div className="hidden border-r border-white/70 bg-slate-900 p-10 text-white lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/55">AI IELTS Studio</p>
          <h1 className="mt-5 text-5xl font-black leading-tight">登入后，直接回到你的练习工作台。</h1>
          <p className="mt-6 text-sm leading-7 text-white/72">
            保留最近进度、历史评分和题组复盘，让单次训练真正变成可连续推进的工作流。
          </p>
          <div className="mt-10 space-y-4">
            {[
              { icon: Mail, heading: "统一入口", description: "登录后直接进入 Dashboard 与数据面板。" },
              { icon: ShieldCheck, heading: "会话同步", description: "更新资料后，头像与昵称能即时反馈到前端。" },
              { icon: ArrowRight, heading: "连续练习", description: "支持从模块页继续进入下一套或下一部分。" },
            ].map(({ icon: Icon, heading, description }) => (
              <div key={heading} className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                <Icon className="h-5 w-5 text-white/75" />
                <h2 className="mt-3 text-lg font-black">{heading}</h2>
                <p className="mt-2 text-sm text-white/65">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 sm:p-10 lg:p-12">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-lg font-black text-white shadow-lg shadow-slate-900/15">
                LS
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Secure Access</p>
                <h2 className="text-3xl font-black leading-tight text-slate-900 sm:text-[2.1rem]">{title}</h2>
              </div>
            </div>
            <div className="hidden flex-wrap gap-2 sm:flex">
              <Button type="button" variant="ghost" onClick={() => router.back()} className="rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                <ArrowLeft className="mr-2 h-4 w-4" /> 返回上一页
              </Button>
              <Link href="/">
                <Button type="button" variant="outline" className="rounded-full">
                  <Home className="mr-2 h-4 w-4" /> 回到首页
                </Button>
              </Link>
            </div>
          </div>
          <div className="mt-5 flex gap-2 sm:hidden">
            <Button type="button" variant="ghost" onClick={() => router.back()} className="flex-1 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              <ArrowLeft className="mr-2 h-4 w-4" /> 返回
            </Button>
            <Link href="/" className="flex-1">
              <Button type="button" variant="outline" className="w-full rounded-full">
                <Home className="mr-2 h-4 w-4" /> 首页
              </Button>
            </Link>
          </div>

          {registered && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              账户已创建，现在可以用刚刚的邮箱和密码登录。
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                <Mail className="h-4 w-4" /> 邮箱地址
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="you@example.com"
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 font-medium text-slate-900 outline-none transition-all focus:border-sky-400 focus:ring-4 focus:ring-sky-400/15"
              />
            </label>

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                <KeyRound className="h-4 w-4" /> 密码
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="••••••••"
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 font-medium text-slate-900 outline-none transition-all focus:border-sky-400 focus:ring-4 focus:ring-sky-400/15"
              />
            </label>

            <Button type="submit" disabled={loading} className="h-14 w-full rounded-2xl bg-slate-900 text-base font-bold text-white hover:bg-slate-800">
              {loading ? "验证中..." : "登录并进入工作台"}
            </Button>
          </form>

          <p className="mt-8 text-sm font-medium text-slate-500">
            还没有账号？
            <Link href="/register" className="ml-2 font-bold text-sky-600 hover:text-sky-700">
              创建新账户
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
