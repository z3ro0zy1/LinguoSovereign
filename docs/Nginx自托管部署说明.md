# Nginx 自托管部署说明

这份文档是给第一次自己部署网站的人写的。  
目标不是讲概念，而是让你知道：

- 为什么要加 Nginx
- 你的 Next.js 项目和 Nginx 各负责什么
- 现在仓库里新增的配置文件该怎么用
- 一步一步怎么把 LinguoSovereign 跑起来

---

## 1. 先理解：为什么要加 Nginx？

你这个项目本身是一个 `Next.js` 应用。  
Next.js 生产启动命令是：

```bash
npm run build
npm run start
```

如果你直接运行它，应用通常会监听一个端口，比如：

- `3000`

这当然能工作，但生产环境里还差一层“门卫”。

这层门卫就是 `Nginx`。

Nginx 的作用可以简单理解成：

1. 对外暴露 80 / 443 端口
2. 处理域名和 HTTPS 证书
3. 把请求转发给你真正的应用进程
4. 处理缓存、限流、上传大小、WebSocket 升级

所以职责分工是：

- `Next.js`
  负责真正的页面渲染、API、登录、数据库访问、AI 调用
- `Nginx`
  负责外层网络入口和请求转发

---

## 2. 现在仓库里新增了什么？

我已经在项目里帮你加了两份部署模板：

- [linguosovereign.conf](/Users/ronaldlee/Desktop/LinguoSovereign/deploy/nginx/linguosovereign.conf)
- [linguosovereign.service](/Users/ronaldlee/Desktop/LinguoSovereign/deploy/systemd/linguosovereign.service)

它们分别是：

### 2.1 `deploy/nginx/linguosovereign.conf`

这是 `Nginx` 的反向代理配置。

它做了这些事：

- 把 `http` 自动跳转到 `https`
- 把外部请求转发到本机 `127.0.0.1:3000`
- 为 `/_next/static/` 设置长缓存
- 为 `/uploads/` 设置缓存
- 给高成本 AI 接口加基础限流
- 允许 `WebSocket` / 长连接升级

### 2.2 `deploy/systemd/linguosovereign.service`

这是 Linux 服务器上的服务管理配置。

它做了这些事：

- 让你的 Next.js 应用变成系统服务
- 服务器重启后自动启动
- 进程崩了自动重启
- 统一写日志到指定文件

---

## 3. 这套部署默认假设什么？

当前模板默认假设：

1. 你的服务器是 Linux
2. 你用 `systemd`
3. 项目部署目录是：

```bash
/var/www/linguosovereign
```

4. Next.js 生产端口是：

```bash
127.0.0.1:3000
```

5. 域名是：

```bash
example.com
```

你以后只需要把这些地方替换成自己的真实值。

---

## 4. 为什么 Next.js 只监听 `127.0.0.1:3000`？

这是一个很常见的生产做法。

意思是：

- Next.js 不直接对公网开放
- 它只接受本机请求
- 真正对公网开放的是 Nginx

好处：

- 更安全
- 结构更清晰
- 所有 HTTPS、限流、缓存都统一交给 Nginx

---

## 5. `linguosovereign.conf` 里面每块是在干什么？

下面按块解释。

### 5.1 `map $http_upgrade $connection_upgrade`

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

用途：

- 如果浏览器发起的是 WebSocket 升级请求，就告诉 Nginx 用 `upgrade`
- 否则普通请求就用 `close`

为什么你要这个：

- 你的项目有口语自由对话、长连接、实时语音链路
- 这类请求不能只按普通 HTTP 来转发

---

### 5.2 `limit_req_zone`

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
```

用途：

- 给每个 IP 做基础限流

通俗理解：

- 同一个 IP 每秒不要打太多高成本请求

为什么你要这个：

- `/api/speaking/live`
- `/api/eval/subjective`
- `/api/reading/analysis`

这些接口都比较贵，因为它们会调用外部 AI 或做更重的服务端处理。

如果没有限流：

- 误操作可能把接口打爆
- 恶意请求更容易消耗你的额度

---

### 5.3 80 端口跳转到 443

```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}
```

用途：

- 用户输 `http://你的域名`
- 自动跳到 `https://你的域名`

为什么这样做：

- 生产网站通常都应该统一走 HTTPS

---

### 5.4 443 主服务块

```nginx
server {
    listen 443 ssl http2;
    ...
}
```

这是正式的生产入口。

这里面处理：

- HTTPS 证书
- 安全头
- 缓存
- 代理转发

---

### 5.5 `client_max_body_size 10m`

```nginx
client_max_body_size 10m;
```

意思：

- 单次上传请求最大 10MB

为什么你需要它：

- 你现在有头像上传
- 以后如果还有音频/图片上传，也会受它影响

如果不配，有时会出现：

- 前端看起来发起成功
- 但 Nginx 直接返回 `413 Request Entity Too Large`

---

### 5.6 `location /_next/static/`

```nginx
location /_next/static/ {
    ...
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

这块是给 Next.js 编译后的静态资源做缓存。

包括：

- js
- css
- chunk

为什么适合长缓存：

- 这些文件名通常带 hash
- 文件一变，URL 也会变
- 所以可以放心缓存很久

好处：

- 页面访问更快
- Node 压力更小

---

### 5.7 `location /uploads/`

```nginx
location /uploads/ {
    ...
    expires 7d;
}
```

这块是给你当前项目里的头像上传资源准备的。

你的上传接口在：

- [route.ts](/Users/ronaldlee/Desktop/LinguoSovereign/src/app/api/upload/route.ts)

它会把文件存到：

```bash
public/uploads
```

并返回 URL：

```bash
/uploads/xxx.png
```

所以这里专门给 `/uploads/` 配一层缓存是合适的。

---

### 5.8 高成本 API 限流块

```nginx
location ~ ^/api/(speaking/live|eval/subjective|reading/analysis) {
    limit_req zone=api_limit burst=20 nodelay;
    ...
}
```

这是最重要的一块之一。

它只对这些高成本接口生效：

- `/api/speaking/live`
- `/api/eval/subjective`
- `/api/reading/analysis`

目的：

- 不让某个 IP 在短时间内疯狂打这些贵接口

为什么不是对所有 API 一刀切：

- 登录、普通查询接口和 AI 接口成本差异很大
- 高成本接口更需要优先保护

---

### 5.9 `proxy_set_header Upgrade` / `Connection`

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
```

这是 WebSocket / 升级连接必须保留的头。

如果少了它，常见结果是：

- 页面能打开
- 普通请求正常
- 但实时口语、长连接、WebSocket 异常

所以这一块对你的口语自由对话很关键。

---

## 6. `linguosovereign.service` 在做什么？

这是 Linux 的 `systemd` 服务文件。

关键配置如下：

```ini
WorkingDirectory=/var/www/linguosovereign
EnvironmentFile=/var/www/linguosovereign/.env.production
ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1 --port 3000
Restart=always
```

意思是：

- 在项目目录里启动应用
- 读取 `.env.production`
- 让 Next.js 只监听本机 3000
- 如果进程崩了，就自动拉起

---

## 7. 推荐的目录结构

建议你的服务器目录是这样：

```bash
/var/www/linguosovereign
├── .env.production
├── .next
├── node_modules
├── package.json
├── public
├── prisma
├── src
└── deploy
```

日志目录建议：

```bash
/var/log/linguosovereign
├── app.log
└── app-error.log
```

---

## 8. 真正部署时的顺序

下面是建议顺序。

### 第一步：把项目传到服务器

比如：

```bash
git clone <你的仓库地址> /var/www/linguosovereign
cd /var/www/linguosovereign
```

### 第二步：安装依赖

```bash
npm install
```

### 第三步：准备生产环境变量

创建：

```bash
/var/www/linguosovereign/.env.production
```

至少要包含你生产环境需要的变量，例如：

```env
DATABASE_URL=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://example.com
OPENAI_API_KEY=...
OPENAI_BASE_URL=...
OPENAI_MODEL=...
GEMINI_API_KEY=...
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
```

注意：

- `NEXTAUTH_URL` 在生产必须改成真实域名
- 数据库也要换成生产数据库

### 第四步：构建 Next.js

```bash
npm run build
```

### 第五步：复制 systemd 服务文件

```bash
sudo cp deploy/systemd/linguosovereign.service /etc/systemd/system/linguosovereign.service
```

然后根据你的实际情况修改里面的：

- `User`
- `Group`
- `WorkingDirectory`
- `EnvironmentFile`

### 第六步：启动并设置开机自启

```bash
sudo systemctl daemon-reload
sudo systemctl enable linguosovereign
sudo systemctl start linguosovereign
```

查看状态：

```bash
sudo systemctl status linguosovereign
```

### 第七步：复制 Nginx 配置

```bash
sudo cp deploy/nginx/linguosovereign.conf /etc/nginx/sites-available/linguosovereign
```

建立软链接：

```bash
sudo ln -s /etc/nginx/sites-available/linguosovereign /etc/nginx/sites-enabled/linguosovereign
```

### 第八步：修改域名和证书路径

把配置里的：

- `example.com`
- `www.example.com`
- `/etc/letsencrypt/live/example.com/...`

都替换成你的真实值。

### 第九步：检查 Nginx 配置

```bash
sudo nginx -t
```

如果输出类似：

```bash
syntax is ok
test is successful
```

说明配置没问题。

### 第十步：重启 Nginx

```bash
sudo systemctl reload nginx
```

---

## 9. HTTPS 证书怎么来？

最常见的是用 `Let's Encrypt + certbot`。

例如：

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

然后：

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

这一步会：

- 自动申请证书
- 自动帮你写入大部分 SSL 配置

如果你已经有证书，也可以手动把路径填进 `nginx.conf`。

---

## 10. 口语实时功能为什么特别要注意 Nginx？

因为你的项目有自由对话、实时语音、长连接。

这类请求和普通页面请求不一样：

- 持续时间更长
- 连接更敏感
- 更怕代理层丢升级头
- 更怕超时过短

所以配置里我专门加了：

- `proxy_read_timeout 300s`
- `proxy_send_timeout 300s`
- `Upgrade`
- `Connection`

如果以后你发现：

- 页面能开
- 但实时语音总断

优先先看 Nginx 的这一层。

---

## 11. 什么时候需要改限流？

现在配置里是：

```nginx
rate=10r/s
burst=20
```

这只是一个保守起点，不是唯一正确答案。

如果后面发现：

- 正常用户也经常被挡住

就把它放宽一点。

如果后面发现：

- AI 接口被刷
- 额度消耗太快

就把它收紧一点。

所以这块是“运营策略”，不是一次写死。

---

## 12. 常见问题

### 问：我是不是有了 Nginx 就自动高并发了？

不是。

Nginx 只是外层入口更稳了。

真正并发能力还取决于：

- Next.js 应用本身
- 数据库连接池
- 外部 AI 接口时延
- 服务器 CPU / 内存

### 问：是不是必须有 Nginx？

不是。

但如果你是自己买 VPS、自托管，我建议有。

### 问：Vercel / Railway 还要不要这个？

通常不用自己配这份 `nginx.conf`，因为平台已经替你做了很多网关层工作。

### 问：我现在是小白，要不要先用平台托管？

如果你只是先上线验证产品，平台托管更省事。  
如果你是准备长期自己掌控环境，自托管 + Nginx 更适合。

---

## 13. 你现在最少需要改哪几处？

如果你准备真的拿这套配置上线，最少改这些：

### `deploy/nginx/linguosovereign.conf`

替换：

- `example.com`
- `www.example.com`
- 证书路径

### `deploy/systemd/linguosovereign.service`

替换：

- `User`
- `Group`
- `WorkingDirectory`
- `EnvironmentFile`

### `.env.production`

确认：

- 数据库是生产库
- `NEXTAUTH_URL` 是生产域名
- 所有 AI key 都是生产环境可用值

---

## 14. 我建议你的最稳上线顺序

1. 先本地 `npm run build`
2. 再上测试服务器
3. 先跑 `systemd`
4. 再接 `Nginx`
5. 再接 HTTPS
6. 最后再开公网域名

不要一上来把：

- 域名
- HTTPS
- Nginx
- 数据库
- AI key
- 应用构建

全部一起调。  
这样出问题时你很难知道是哪一层坏了。

---

## 15. 下一步可以继续做什么？

如果你后面真的准备上线，我建议继续补这三样：

1. 数据库连接和 Prisma 生产配置说明
2. `pm2` 方案和 `systemd` 方案对比
3. Docker 版本的部署模板

当前这份文档先把最核心的：

- Nginx
- Next.js
- systemd
- HTTPS
- WebSocket
- 上传目录

这一整套跑通。
