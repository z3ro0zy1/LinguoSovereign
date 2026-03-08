import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "test@example.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email,
          },
        });

        if (!user || !user.password) {
          throw new Error("No user found");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password,
        );

        if (!isValid) {
          throw new Error("Invalid password");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback_secret_for_local_dev",
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // On initial sign-in, populate token from user object
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.picture = user.image;
      }

      // Handle explicit update() call from client (e.g. after profile save)
      if (trigger === "update" && session) {
        if (session.name !== undefined) token.name = session.name;
        if (session.image !== undefined) token.picture = session.image;
      }

      // Always re-fetch the latest name/image from DB so profile changes
      // are reflected on next page load even without calling update()
      if (token.id && trigger !== "update") {
        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { name: true, image: true },
          });
          if (freshUser) {
            token.name = freshUser.name;
            token.picture = freshUser.image;
          }
        } catch {
          // If DB lookup fails, keep cached values — non-fatal
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as { id: string }).id = token.id as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string | null | undefined;
      }
      return session;
    },
  },
};
