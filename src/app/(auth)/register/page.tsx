"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLocale } from "@/components/LocaleProvider";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error || t("registerFailed"));
        setLoading(false);
        return;
      }

      router.push("/login?registered=true");
    } catch (error) {
      console.error(error);
      setError(t("networkErrorRetry"));
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#edf2f7] px-6 py-12 text-slate-900">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_32%),radial-gradient(circle_at_10%_80%,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]" />
      <div className="absolute right-6 top-6 z-10"><LanguageToggle /></div>
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/78 shadow-[0_30px_80px_rgba(15,23,42,0.1)] backdrop-blur-2xl lg:grid-cols-[1fr_460px]">
        <div className="hidden border-r border-white/70 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 p-10 text-white lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/55">{t("candidateOnboarding")}</p>
          <h1 className="mt-5 text-5xl font-black leading-tight">{t("registerHeroTitle")}</h1>
          <div className="mt-10 space-y-4 text-sm leading-7 text-white/72">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
{t("registerTip1")}
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
{t("registerTip2")}
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
{t("registerTip3")}
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10 lg:p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-lg font-black text-white shadow-lg shadow-slate-900/15">
              LS
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{t("createAccount")}</p>
              <h2 className="text-lg font-black text-slate-900">{t("joinApp")}</h2>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                <User className="h-4 w-4" /> {t("nickname")}
              </span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                placeholder="Candidate"
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 font-medium text-slate-900 outline-none transition-all focus:border-sky-400 focus:ring-4 focus:ring-sky-400/15"
              />
            </label>

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                <Mail className="h-4 w-4" /> {t("emailAddress")}
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
                <KeyRound className="h-4 w-4" /> {t("newPassword")}
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                placeholder={t("atLeast6")}
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 font-medium text-slate-900 outline-none transition-all focus:border-sky-400 focus:ring-4 focus:ring-sky-400/15"
              />
            </label>

            <Button type="submit" disabled={loading} className="h-14 w-full rounded-2xl bg-slate-900 text-base font-bold text-white hover:bg-slate-800">
              {loading ? t("registering") : t("createAccount")}
            </Button>
          </form>

          <p className="mt-8 text-sm font-medium text-slate-500">
            {t("existingAccount")}
            <Link href="/login" className="ml-2 font-bold text-sky-600 hover:text-sky-700">
              {t("returnToLogin")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
