# 这是一个“多阶段构建”(Multi-stage) 的 Dockerfile。
# 它的核心逻辑是：先在一个“工人容器”里安装、打包代码；然后提取出有用的成品放进“启动容器”。
# 这样做能极大地减小最终镜像的体积！

# ----------------- 阶段 1：依赖安装阶段 -----------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# 为了加速安装，仅复制包描述文件
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile


# ----------------- 阶段 2：编译构建阶段 -----------------
FROM node:20-alpine AS builder
# Prisma 需要 OpenSSL 来运行其引擎
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# 复制所有源代码 (但由于 .dockerignore 的存在，1.8GB 的 public 音频不会被复制)
COPY . .

# 如果你的 Prisma scheme 依赖数据库才能 push/generate，可以在 build 阶段设置临时的 ENV。
# 通常我们会在这里生成 Prisma Client，然后再 Build Next.js
RUN npx prisma generate
RUN corepack enable pnpm && pnpm run build


# ----------------- 阶段 3：生产运行阶段 (最终留下的成品) -----------------
FROM node:20-alpine AS runner
WORKDIR /app

# 设置生产环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 复制 Next.js standalone 所需的最少文件
COPY --from=builder /app/public ./public
# 拷贝 standalone 包
COPY --from=builder /app/.next/standalone ./
# 拷贝 standalone 需要的 static 文件
COPY --from=builder /app/.next/static ./.next/static
# 拷贝 prisma 相关的生成文件夹以便后续能跑 migration/db push
COPY --from=builder /app/prisma ./prisma

# 暴露 3000 端口
EXPOSE 3000

# 启动服务器！(因为我们在 standalone 模式下，所以直接运行 server.js)
CMD ["node", "server.js"]
