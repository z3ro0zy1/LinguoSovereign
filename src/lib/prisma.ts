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

/**
 * 2. 读取连接池参数
 * 这些参数的目标不是把数据库“开到无限大”，而是让应用对连接数有明确控制。
 *
 * 为什么要配：
 * - 多用户同时访问时，数据库瓶颈通常首先出现在连接数，而不是 SQL 语句本身。
 * - 如果完全不设边界，应用实例一多，很容易把 PostgreSQL 连接打满。
 * - 对个人项目/中小流量应用，明确的连接池上限比“无限放大”更稳。
 */
const DEFAULT_POOL_MAX =
  process.env.NODE_ENV === "production" ? 20 : 5;
const poolMax = Number.parseInt(
  process.env.DATABASE_POOL_MAX ?? `${DEFAULT_POOL_MAX}`,
  10,
);
const poolMin = Number.parseInt(process.env.DATABASE_POOL_MIN ?? "0", 10);
const idleTimeoutMillis = Number.parseInt(
  process.env.DATABASE_POOL_IDLE_TIMEOUT_MS ?? "30000",
  10,
);
const connectionTimeoutMillis = Number.parseInt(
  process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS ?? "5000",
  10,
);

/**
 * 3. 防止开发环境下创建过多的 Prisma / Pool 实例
 * 在 Next.js 开发模式下，每次修改代码都会导致文件重新加载。
 * 如果 Pool 和 PrismaClient 都直接 new，会产生越来越多的空闲连接。
 *
 * 这次不仅缓存 PrismaClient，也缓存底层 pg Pool。
 * 这样：
 * - 开发环境热更新不会一直新增 Pool
 * - 生产环境模块只初始化一次
 * - Prisma 和底层连接池共享同一套生命周期
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaPool: Pool | undefined;
};

const pool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString,
    max: Number.isNaN(poolMax) ? DEFAULT_POOL_MAX : poolMax,
    min: Number.isNaN(poolMin) ? 0 : poolMin,
    idleTimeoutMillis: Number.isNaN(idleTimeoutMillis)
      ? 30000
      : idleTimeoutMillis,
    connectionTimeoutMillis: Number.isNaN(connectionTimeoutMillis)
      ? 5000
      : connectionTimeoutMillis,
  });

/**
 * 4. 监听连接池底层错误
 * 这类错误如果完全吞掉，线上会表现成“偶发查库失败但日志没有上下文”。
 */
pool.on("error", (error) => {
  console.error("[db] PostgreSQL pool error:", error);
});

// 5. 创建适配器：把 pg Pool 包装成 Prisma 可使用的适配层。
const adapter = new PrismaPg(pool);

// 6. 如果全局已经有 Prisma 实例就复用，否则创建新的。
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

// 7. 开发环境缓存到 globalThis，避免热重载不断新增连接池和 Prisma 实例。
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaPool = pool;
}
