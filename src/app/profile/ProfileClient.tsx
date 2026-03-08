"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Image as ImageIcon,
  Loader2,
  Lock,
  Mail,
  Save,
  Upload,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ProfileClientProps {
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export default function ProfileClient({ user }: ProfileClientProps) {
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState(user.name || "");
  const [image, setImage] = useState(user.image || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "只支持上传图片文件。" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "图片请控制在 5MB 以内。" });
      return;
    }

    setUploadingImage(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !data.url) {
        setMessage({ type: "error", text: data.error || "头像上传失败。" });
        return;
      }

      setImage(data.url);
      setMessage({ type: "success", text: "头像上传成功，保存后会同步到导航栏。" });
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "上传过程出现异常，请稍后重试。" });
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image, password }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "资料更新失败。" });
        return;
      }

      await update({ name, image });
      setPassword("");
      setMessage({ type: "success", text: "资料已更新。" });
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "保存失败，请稍后重试。" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <Link href="/">
        <Button variant="ghost" className="-ml-4 rounded-full text-slate-500 hover:bg-white/70 hover:text-slate-900">
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回控制台
        </Button>
      </Link>

      <Card className="overflow-hidden rounded-[2rem] border-white/70 bg-white/82 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
        <form onSubmit={handleSubmit}>
          <CardContent className="grid gap-10 p-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-10">
            <div className="rounded-[1.75rem] border border-slate-100 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/55">Profile Preview</p>
              <div className="mt-6 flex flex-col items-center text-center">
                <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-white/15 bg-white/5 shadow-xl">
                  {image ? (
                    <Image src={image} alt="Avatar" fill className="object-cover" sizes="128px" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl font-black text-white/72">
                      {name ? name.charAt(0).toUpperCase() : "U"}
                    </div>
                  )}
                </div>
                <h2 className="mt-5 text-2xl font-black">{name || "Unnamed user"}</h2>
                <p className="mt-2 text-sm text-white/65">{user.email || "No email"}</p>
              </div>

              <div className="mt-8 space-y-3 text-sm text-white/72">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  支持本地头像上传，保存后会即时刷新导航栏显示。
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  建议使用 1:1 比例图片，文件大小控制在 5MB 以内。
                </div>
              </div>
            </div>

            <div>
              {message && (
                <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                  {message.text}
                </div>
              )}

              <div className="grid gap-6">
                <div className="grid gap-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <User className="h-4 w-4 text-sky-600" /> 昵称
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="输入展示名称"
                    className="h-12 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 font-medium text-slate-900 outline-none transition-all focus:border-sky-400 focus:ring-4 focus:ring-sky-400/15"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Mail className="h-4 w-4 text-indigo-600" /> 邮箱
                  </label>
                  <input
                    type="email"
                    value={user.email || ""}
                    readOnly
                    className="h-12 cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 font-medium text-slate-500"
                  />
                  <p className="text-xs text-slate-400">邮箱作为登录标识，不在此页面修改。</p>
                </div>

                <div className="grid gap-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <ImageIcon className="h-4 w-4 text-amber-600" /> 头像上传
                  </label>
                  <div className="flex flex-wrap items-center gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="relative overflow-hidden">
                      <Button type="button" variant="outline" disabled={uploadingImage} className="rounded-full px-5">
                        {uploadingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        上传图片
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </div>
                    <p className="text-sm text-slate-500">支持 JPG / PNG / WEBP，最大 5MB。</p>
                  </div>
                </div>

                <div className="grid gap-2 border-t border-slate-100 pt-6">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Lock className="h-4 w-4 text-rose-600" /> 新密码
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="留空则保持当前密码"
                    className="h-12 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 font-medium text-slate-900 outline-none transition-all focus:border-sky-400 focus:ring-4 focus:ring-sky-400/15"
                  />
                </div>
              </div>

              <div className="mt-10 flex justify-end">
                <Button type="submit" disabled={loading} className="rounded-full bg-slate-900 px-8 text-white hover:bg-slate-800">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  保存资料
                </Button>
              </div>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
