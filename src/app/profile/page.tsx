import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ProfileClient from "./ProfileClient";

export const metadata = {
  title: "Personal Profile - LinguoSovereign",
};

/**
 * ProfilePage - Server Component
 * Responsible for:
 * 1. Validating the user session via NextAuth.
 * 2. Fetching the latest user metadata (name, email, avatar) from the database.
 * 3. Providing a high-level layout with aesthetic background effects.
 */
export default async function ProfilePage() {
  // Retrieve session from server-side (safer than client-side for initial load)
  const session = await getServerSession(authOptions);

  // Guard: Redirect to login if session is invalid or user ID is missing
  if (!session || !session.user || !("id" in session.user)) {
    redirect("/login");
  }

  const userId = (session.user as { id: string }).id;

  // Fetch fresh user data directly from Prisma to ensure the UI shows current state
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      image: true,
    },
  });

  if (!dbUser) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] relative font-sans">
      {/* Background blur effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-gradient-to-br from-[#f2f4f8] to-[#e8eaf6]">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-300/30 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-300/20 rounded-full blur-[150px]"></div>
      </div>

      <div className="container mx-auto px-6 py-12 max-w-3xl">
        <header className="mb-10">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">
            个人资料 (Profile)
          </h1>
          <p className="mt-2 text-gray-500 font-medium tracking-wide">
            Manage your account settings, avatar, and nickname.
          </p>
        </header>

        <ProfileClient user={dbUser} />
      </div>
    </div>
  );
}
