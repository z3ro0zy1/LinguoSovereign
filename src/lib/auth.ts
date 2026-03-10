/**
 * 身份验证配置文件 (Authentication Configuration)
 * 作用：负责处理用户的登录、会话管理和权限校验。
 * 后端框架：NextAuth.js
 */

import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials"; // 邮箱/密码登录方式
import { PrismaAdapter } from "@auth/prisma-adapter"; // 连接数据库的适配器
import { prisma } from "@/lib/prisma"; // 数据库客户端实例
import bcrypt from "bcryptjs"; // 用于加密和校验密码的工具

// 导出 NextAuth 的配置项
export const authOptions: NextAuthOptions = {
  // 1. 数据库适配器：将用户信息存储在 Prisma 数据库中
  adapter: PrismaAdapter(prisma),

  // 2. 身份验证提供者 (Providers)：定义用户可以如何登录
  providers: [
    CredentialsProvider({
      name: "Credentials", // 登录界面的标题名称
      // 定义登录表单需要的字段
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "test@example.com",
        },
        password: { label: "Password", type: "password" },
      },
      /**
       * 授权逻辑 (authorize)
       * 当用户提交登录表单时，这个函数会自动运行。
       * @param credentials 用户输入的邮箱和密码
       */
      async authorize(credentials) {
        // 校验输入是否完整
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password"); // 缺少邮箱或密码
        }

        // 在数据库中查找是否存在该用户
        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email,
          },
        });

        // 如果用户不存在，或者用户没有设置密码（比如是用第三方登录创建的）
        if (!user || !user.password) {
          throw new Error("No user found"); // 用户不存在
        }

        // 校验密码是否正确 (对比输入的明文密码和数据库里的加密密码)
        const isValid = await bcrypt.compare(
          credentials.password,
          user.password,
        );

        if (!isValid) {
          throw new Error("Invalid password"); // 密码错误
        }

        // 验证成功，返回用户信息。这些信息会被保存到 JWT 会话中
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],

  // 3. 会话策略：使用 JWT (JSON Web Token)
  // 这意味着用户的会话信息保存在浏览器端加密的 cookie 中，而不是服务器数据库里。
  session: {
    strategy: "jwt",
  },

  // 4. 自定义页面配置
  pages: {
    signIn: "/login", // 如果用户未登录访问保护页面，重定向到登录页
  },

  // 5. 安全密钥：用于加密 Cookie 和 JWT
  secret: process.env.NEXTAUTH_SECRET || "fallback_secret_for_local_dev",

  // 6. 回调函数 (Callbacks)：在身份验证流程的不同阶段自定义行为
  callbacks: {
    /**
     * JWT 回调：当 JWT 被创建或更新时运行（比如用户登录、或手动刷新）
     * 作用：把数据库里的额外信息（如 ID）放进加密的 Token 里
     */
    async jwt({ token, user, trigger, session }) {
      // 第一次登录时，把 user 的信息放进 token
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.picture = user.image;
      }

      // 处理用户资料更新 (例如在个人中心修改了名字)
      if (trigger === "update" && session) {
        if (session.name !== undefined) token.name = session.name;
        if (session.image !== undefined) token.picture = session.image;
      }

      // 实时同步数据库数据：除非是刚才更新的，否则尝试从数据库获取最新名字和头像
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
          // 容错处理
        }
      }

      return token;
    },

    /**
     * Session 回调：当前端组件调用 useSession() 时，决定返回什么数据给前端
     */
    async session({ session, token }) {
      if (token && session.user) {
        // 把 token 里的 id 暴露给 session，方便前端获取当前用户 ID
        (session.user as { id: string }).id = token.id as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string | null | undefined;
      }
      return session;
    },
  },
};
