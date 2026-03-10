/**
 * 数据库客户端配置文件 (Database Client Configuration)
 * 作用：初始化 Prisma 客户端，让代码可以与 PostgreSQL 数据库通信。
 */

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg"; // PostgreSQL 连接池工具
import { PrismaPg } from "@prisma/adapter-pg"; // Prisma 的 PostgreSQL 适配器

// 1. 检查环境变量：确保数据库连接字符串已配置
// 如果没有设置 DATABASE_URL (在 .env 文件中)，程序会报错并停止，防止运行出错。
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

const connectionString = process.env.DATABASE_URL;

// 2. 创建数据库连接池 (Pool)
// 连接池可以复用数据库连接，提高性能，避免频繁创建和销毁连接。
const pool = new Pool({ connectionString });

// 3. 创建适配器
// 将底层的 pg 连接池包装成 Prisma 可以理解的形式。
const adapter = new PrismaPg(pool);

/**
 * 4. 防止开发环境下创建过多的 Prisma 实例
 * 在 Next.js 开发模式下，每次修改代码都会导致文件重新加载。
 * 如果直接 new PrismaClient()，会产生几百个连接导致数据库崩溃。
 * 解决方案：将实例挂载到全局变量 (globalThis) 上。
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 如果全局已经有名为 prisma 的实例了，就用它；否则创建一个新的。
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// 如果不是生产环境 (也就是开发环境)，就把创建好的实例存到全局变量里。
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
