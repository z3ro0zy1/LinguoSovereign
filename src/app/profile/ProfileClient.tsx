"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  User,
  Mail,
  Image as ImageIcon,
  Lock,
  ArrowLeft,
  Loader2,
  Save,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface ProfileClientProps {
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export default function ProfileClient({ user }: ProfileClientProps) {
  const router = useRouter();
  const { update } = useSession(); // Utility to update the front-end session without a full page reload

  // --- STATE MANAGEMENT ---
  const [name, setName] = useState(user.name || "");
  const [image, setImage] = useState(user.image || "");
  const [password, setPassword] = useState(""); // Only filled if user wants to change password
  const [loading, setLoading] = useState(false); // Controls the main "Save" button state
  const [uploadingImage, setUploadingImage] = useState(false); // Controls the "Upload" button state
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  /**
   * handleImageUpload
   * Triggers when user selects a local file.
   * 1. Sends file to /api/upload (likely an S3 or Vercel Blob proxy).
   * 2. Receives a public URL.
   * 3. Sets the local state `image` so the preview updates.
   */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setImage(data.url);
        setMessage({
          type: "success",
          text: "Image uploaded! Click Save internally.",
        });
      } else {
        setMessage({ type: "error", text: data.error || "Upload failed." });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Image upload completely failed." });
    }
    setUploadingImage(false);
  };

  /**
   * handleSubmit
   * Persistence logic for name, avatar URL, and password.
   * 1. PUT request to /api/profile.
   * 2. Updates the client-side session (NextAuth) so the Navbar reflects changes immediately.
   * 3. Refreshes the router to ensure server-side props are in sync.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error || "Failed to update profile.",
        });
      } else {
        setMessage({ type: "success", text: "Profile updated successfully!" });
        setPassword(""); // Clear password field after success for security

        // CRITICAL: Update the session token so name/image changes are "live"
        await update({ name, image });

        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <Link href="/">
        <Button
          variant="ghost"
          className="mb-4 -ml-4 text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> 返回控制台 (Back to Dashboard)
        </Button>
      </Link>

      <Card className="shadow-lg border-white/50 bg-white/80 backdrop-blur-xl rounded-3xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          <CardContent className="p-8 sm:p-12">
            {/* Avatar Preview Section */}
            <div className="flex flex-col items-center mb-10">
              <div className="w-32 h-32 rounded-full bg-gray-200 border-4 border-white shadow-xl overflow-hidden flex items-center justify-center mb-4">
                {image ? (
                  <img
                    src={image}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-bold text-gray-400">
                    {name ? name.charAt(0).toUpperCase() : "U"}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-500">
                Your current avatar
              </p>
            </div>

            {message && (
              <div
                className={`p-4 rounded-xl mb-6 text-sm font-bold ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}
              >
                {message.text}
              </div>
            )}

            <div className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500" /> 昵称 (Nickname)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-12 bg-gray-50/50 border border-gray-200 rounded-xl px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium text-gray-900"
                  placeholder="Enter your display name"
                />
              </div>

              {/* Email (Readonly) */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-500" /> 邮箱 (Email
                  Address)
                </label>
                <input
                  type="email"
                  value={user.email || ""}
                  readOnly
                  className="w-full h-12 bg-gray-100 border border-gray-200 rounded-xl px-4 text-gray-500 font-medium cursor-not-allowed"
                />
                <p className="text-xs text-gray-400">
                  Email cannot be changed.
                </p>
              </div>

              {/* Avatar Upload */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-purple-500" /> 头像 (Avatar
                  Upload)
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative overflow-hidden">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingImage}
                      className="h-12 px-6 rounded-xl border-gray-200 bg-white shadow-sm hover:bg-gray-50 flex items-center gap-2 font-bold"
                    >
                      {uploadingImage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Upload New Image
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                  {image && (
                    <span className="text-xs text-gray-500 truncate max-w-[200px]">
                      {image}
                    </span>
                  )}
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2 pt-4 border-t border-gray-100">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-red-500" /> 修改密码 (New
                  Password)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 bg-gray-50/50 border border-gray-200 rounded-xl px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium text-gray-900"
                  placeholder="Leave blank to keep current password"
                />
              </div>
            </div>

            <div className="mt-10 flex justify-end">
              <Button
                type="submit"
                disabled={loading}
                size="lg"
                className="w-full sm:w-auto h-12 px-8 rounded-xl font-bold bg-gray-900 hover:bg-gray-800 text-white shadow-lg flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
