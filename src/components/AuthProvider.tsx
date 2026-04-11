/**
 * 身份验证包裹组件 (Authentication Provider)
 * 作用：像一把“大雨伞”一样罩住整个网站。
 * 只有被它罩住的页面，才能使用“获取当前登录用户”的功能。
 */

"use client"; // 声明这是一个前端组件（浏览器运行）

import { SessionProvider } from "next-auth/react"; // 引入 NextAuth 提供的会话供应者
import { LocaleProvider } from "@/components/LocaleProvider";

/**
 * AuthProvider 组件
 * @param children 代表被包裹在里面的所有其他组件（通常是整个网站的内容）
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // SessionProvider 会自动处理登录状态的获取和同步
  // 有了它，你在网站的任何地方都可以通过 useSession() 拿到用户名字、头像等信息
  return (
    <SessionProvider>
      <LocaleProvider>{children}</LocaleProvider>
    </SessionProvider>
  );
}
