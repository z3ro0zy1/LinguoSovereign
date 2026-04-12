# Nginx 从零上手操作手册

这份手册是给完全没碰过 Nginx 的人写的。  
目标只有一个：

- 让你知道部署 LinguoSovereign 时，`Next.js`、`systemd`、`Nginx` 各自负责什么
- 按顺序一步一步操作，不容易乱

这不是“原理课”，而是一份真正可执行的上手手册。

---

## 0. 先记住一句话

你的网站上线后，链路一般是这样的：

```text
浏览器 -> Nginx -> Next.js -> Prisma -> PostgreSQL -> AI API
```

也就是说：

- `Nginx` 是门口的接待员
- `Next.js` 是真正干活的网站应用
- `PostgreSQL` 是数据库

你不需要让用户直接访问 Next.js 的 3000 端口。  
用户应该只访问：

- `80` 端口
- `443` 端口

而这两个端口通常由 `Nginx` 来接。

---

## 1. 你现在手上已经有什么？

我已经帮你在项目里准备好了这些文件：

- [linguosovereign.conf](/Users/ronaldlee/Desktop/LinguoSovereign/deploy/nginx/linguosovereign.conf)
- [linguosovereign.service](/Users/ronaldlee/Desktop/LinguoSovereign/deploy/systemd/linguosovereign.service)
- [Nginx自托管部署说明.md](/Users/ronaldlee/Desktop/LinguoSovereign/docs/Nginx自托管部署说明.md)

你现在这份手册，是在前一份说明文档基础上的“具体操作版”。

---

## 2. 这套方案默认适合什么场景？

默认适合：

- 你有一台 Linux 服务器
- 你准备自己部署
- 项目是 `Next.js + Prisma + PostgreSQL`
- 你希望用 `Nginx` 做反向代理

如果你用的是：

- Vercel
- Railway
- Render

这种平台，通常不需要自己配 Nginx。

---

## 3. 先准备什么？

在开始之前，你最好确认这几件事：

### 3.1 你有一台服务器

通常是 Ubuntu，例如：

- Ubuntu 22.04
- Ubuntu 24.04

### 3.2 你有域名

例如：

- `yourdomain.com`

并且它已经解析到你的服务器 IP。

### 3.3 你已经把项目放到服务器上

例如放在：

```bash
/var/www/linguosovereign
```

### 3.4 你已经准备好生产环境变量

例如：

```bash
/var/www/linguosovereign/.env.production
```

里面至少要有：

```env
DATABASE_URL=...
DATABASE_POOL_MAX=20
DATABASE_POOL_MIN=0
DATABASE_POOL_IDLE_TIMEOUT_MS=30000
DATABASE_POOL_CONNECTION_TIMEOUT_MS=5000

NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://yourdomain.com

OPENAI_API_KEY=...
OPENAI_BASE_URL=...
OPENAI_MODEL=...

GEMINI_API_KEY=...
GEMINI_SPEAKING_MODEL=gemini-3.1-flash-lite-preview
GEMINI_SPEAKING_EVAL_MODEL=gemini-3.1-flash-lite-preview
```

---

## 4. 先把网站应用本身跑起来

先别急着碰 Nginx。  
正确顺序是：先确认 Next.js 本体能跑，再接 Nginx。

进入项目目录：

```bash
cd /var/www/linguosovereign
```

安装依赖：

```bash
npm install
```

构建生产版本：

```bash
npm run build
```

手动启动一次应用：

```bash
npm run start -- --hostname 127.0.0.1 --port 3000
```

这条命令的意思是：

- 启动 Next.js 生产服务
- 只监听本机
- 端口是 `3000`

如果启动成功，你应该看到类似：

```bash
Ready on http://127.0.0.1:3000
```

然后你可以在服务器上本机测试：

```bash
curl http://127.0.0.1:3000
```

如果这里就不通，先别碰 Nginx。  
先解决应用本身的问题。

---

## 5. 用 systemd 管理 Next.js

为什么需要 `systemd`？

因为你不能靠：

- 开一个 terminal
- 手动运行 `npm run start`

来当生产部署。  
一关 terminal，进程就没了。

### 5.1 复制 service 文件

把项目里的 service 文件复制到系统目录：

```bash
sudo cp /var/www/linguosovereign/deploy/systemd/linguosovereign.service /etc/systemd/system/linguosovereign.service
```

### 5.2 编辑 service 文件

打开它：

```bash
sudo nano /etc/systemd/system/linguosovereign.service
```

你至少要改这几处：

#### `User`

例如：

```ini
User=www-data
```

或者你的部署用户，比如：

```ini
User=ubuntu
```

#### `Group`

例如：

```ini
Group=www-data
```

#### `WorkingDirectory`

改成你的项目目录：

```ini
WorkingDirectory=/var/www/linguosovereign
```

#### `EnvironmentFile`

改成你的生产环境变量文件：

```ini
EnvironmentFile=/var/www/linguosovereign/.env.production
```

### 5.3 准备日志目录

因为 service 里默认写日志到：

```bash
/var/log/linguosovereign/app.log
/var/log/linguosovereign/app-error.log
```

所以先创建目录：

```bash
sudo mkdir -p /var/log/linguosovereign
sudo touch /var/log/linguosovereign/app.log
sudo touch /var/log/linguosovereign/app-error.log
```

给权限：

```bash
sudo chown -R www-data:www-data /var/log/linguosovereign
```

如果你 service 里的用户不是 `www-data`，这里就换成对应用户。

### 5.4 重载并启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable linguosovereign
sudo systemctl start linguosovereign
```

### 5.5 看状态

```bash
sudo systemctl status linguosovereign
```

如果正常，你会看到：

- `active (running)`

### 5.6 看日志

```bash
tail -f /var/log/linguosovereign/app.log
```

或者：

```bash
tail -f /var/log/linguosovereign/app-error.log
```

如果这一步不正常，不要继续配 Nginx。  
先把应用服务跑通。

---

## 6. 安装 Nginx

在 Ubuntu 上：

```bash
sudo apt update
sudo apt install nginx
```

安装后检查版本：

```bash
nginx -v
```

查看服务状态：

```bash
sudo systemctl status nginx
```

一般会看到：

- `active (running)`

---

## 7. 理解：Nginx 到底怎么接你的项目？

现在你的 Next.js 应用在：

```text
127.0.0.1:3000
```

而 Nginx 会对外监听：

```text
80
443
```

所以用户访问：

```text
https://yourdomain.com
```

Nginx 会把请求转发到：

```text
http://127.0.0.1:3000
```

这就叫反向代理。

---

## 8. 配置 Nginx

### 8.1 复制配置文件

```bash
sudo cp /var/www/linguosovereign/deploy/nginx/linguosovereign.conf /etc/nginx/sites-available/linguosovereign
```

### 8.2 编辑配置文件

```bash
sudo nano /etc/nginx/sites-available/linguosovereign
```

你需要改的内容有：

#### 域名

把：

```nginx
server_name example.com www.example.com;
```

改成你的真实域名，例如：

```nginx
server_name yourdomain.com www.yourdomain.com;
```

#### 证书路径

你会看到：

```nginx
ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
```

这两行先不用乱改，等证书申请好了再填真实路径。

---

## 9. 启用 Nginx 站点

### 9.1 建立软链接

```bash
sudo ln -s /etc/nginx/sites-available/linguosovereign /etc/nginx/sites-enabled/linguosovereign
```

### 9.2 如果有默认站点，建议关掉

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

### 9.3 检查配置

```bash
sudo nginx -t
```

如果结果是：

```bash
syntax is ok
test is successful
```

说明 Nginx 配置语法没问题。

### 9.4 重载 Nginx

```bash
sudo systemctl reload nginx
```

---

## 10. 先不带 HTTPS，怎么测？

如果你还没上证书，可以临时只测 HTTP。

但注意：你现在模板里是默认：

- 80 自动跳 443
- 443 需要 SSL 证书

所以如果你还没证书，临时测试方法是：

### 方法一：先申请证书再测

这是推荐方式。

### 方法二：临时改掉 HTTPS 强跳

你可以先把 80 端口的 server 改成直接代理：

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

等确认站点能通后，再切回 HTTPS 配置。

---

## 11. 申请 HTTPS 证书

最常见是 `Let's Encrypt + certbot`。

安装：

```bash
sudo apt install certbot python3-certbot-nginx
```

申请证书：

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

这条命令会：

- 申请证书
- 自动验证域名
- 部分情况下还能帮你写入 SSL 配置

申请成功后，你就会有类似这样的路径：

```bash
/etc/letsencrypt/live/yourdomain.com/fullchain.pem
/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

然后把 Nginx 配置里的证书路径改成真实值。

再执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 12. 怎么验证 Nginx 是否真的生效了？

### 方法一：浏览器直接访问域名

看是否能打开：

```text
https://yourdomain.com
```

### 方法二：看 Nginx 状态

```bash
sudo systemctl status nginx
```

### 方法三：看应用服务状态

```bash
sudo systemctl status linguosovereign
```

### 方法四：本机测试反向代理

在服务器上执行：

```bash
curl -I https://yourdomain.com
```

如果配置成功，你应该能看到正常响应头。

---

## 13. 如果打不开，按这个顺序排查

这个顺序非常重要。  
不要乱查。

### 第一步：应用本身能不能跑？

看：

```bash
sudo systemctl status linguosovereign
```

如果应用服务本身没起来，Nginx 再正确也没用。

### 第二步：本机 3000 端口通不通？

```bash
curl http://127.0.0.1:3000
```

如果这里不通，问题在 Next.js，不在 Nginx。

### 第三步：Nginx 配置语法对不对？

```bash
sudo nginx -t
```

### 第四步：Nginx 服务有没有运行？

```bash
sudo systemctl status nginx
```

### 第五步：域名有没有解析到服务器？

在你本机执行：

```bash
nslookup yourdomain.com
```

看返回的 IP 是不是你的服务器 IP。

### 第六步：服务器防火墙有没有放行？

比如 Ubuntu 常见：

```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
```

查看状态：

```bash
sudo ufw status
```

---

## 14. 你的项目里哪些路径是 Nginx 特别要照顾的？

### `/_next/static/`

这是 Next.js 编译后的静态资源。

适合做强缓存。

### `/uploads/`

这是你项目现在的头像上传目录，对应：

- [route.ts](/Users/ronaldlee/Desktop/LinguoSovereign/src/app/api/upload/route.ts)

Nginx 配了缓存后，重复访问头像时更省资源。

### `/api/speaking/live`

这是高成本接口。  
Nginx 里已经单独配了限流和长超时。

### `/api/eval/subjective`

写作/口语主观评分接口，也属于高成本。

### `/api/reading/analysis`

阅读 AI 分析接口，也是高成本。

---

## 15. 为什么 Nginx 配置里会有 WebSocket / Upgrade 那些头？

因为你项目里有实时语音、自由对话这类长连接需求。

这些请求和普通网页请求不一样。

如果 Nginx 不保留这些头：

- 页面能打开
- 普通 API 也正常
- 但实时语音、长连接会异常

所以看到这些配置不用慌，它们是必须的：

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
```

---

## 16. 你以后如果想“多人同时用”，现在这套够吗？

这套是一个很好的第一版生产结构：

- Nginx 在前
- Next.js 在后
- PostgreSQL 独立管理

对早期用户和中小流量已经够用。

但它不是“最终无限并发架构”。

后面如果用户更多，还会继续做：

- 多实例
- Nginx upstream 负载均衡
- PgBouncer
- 更细的限流和缓存

现在先别上来就把架构搞太重。

---

## 17. 最小可执行流程总结

如果你今天只想把网站跑起来，按这个顺序：

1. 把项目上传到服务器
2. 准备 `.env.production`
3. `npm install`
4. `npm run build`
5. 先手动 `npm run start -- --hostname 127.0.0.1 --port 3000`
6. 确认 `curl http://127.0.0.1:3000` 通
7. 配 `systemd`
8. 启动 `linguosovereign` 服务
9. 安装 `nginx`
10. 复制并修改 `nginx.conf`
11. `nginx -t`
12. `systemctl reload nginx`
13. 上证书
14. 访问域名验证

这就是最稳的顺序。

---

## 18. 你现在最容易犯的错误

### 错误 1：应用本身没跑通，就先配 Nginx

不对。  
应该先保证 3000 端口本机能通。

### 错误 2：域名没解析好，就开始折腾证书

不对。  
域名不通，证书验证也过不了。

### 错误 3：把 Nginx 当成项目内部 npm 工具

不对。  
Nginx 是 Linux 服务器上的系统服务。

### 错误 4：看到报错就同时改很多层

不对。  
一次只排查一层：

- Next.js
- systemd
- Nginx
- 域名
- HTTPS

---

## 19. 如果你下一步还想继续

我建议接下来再补两份东西：

1. Ubuntu 服务器从零初始化清单
2. 多实例 + Nginx upstream 的进阶手册

这样你从“单机上线”到“多人访问扩容”就有完整路径了。
