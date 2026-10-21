# 发现器部署到阿里云 ECS

部署形态已确认：**发现器与 nginx 同机**，每轮把产物原子替换写入 nginx 的 root 目录，不需要 rsync。

## 文件

| 文件 | 用途 |
| --- | --- |
| `harvester.env.example` | 环境变量模板 → `/etc/dsh-harvester/harvester.env` |
| `dsh-harvester.service` | systemd oneshot 服务 |
| `dsh-harvester.timer` | systemd 定时器（每天 03:15 / 15:15） |
| `nginx-server-block.conf.example` | nginx 配置（方案 A 独立站点 / 方案 B 并入已有站点） |
| `preflight.sh` | 上线前自检脚本 |

## 步骤

### 1. 放代码

```bash
sudo mkdir -p /opt/dsh-plugin-repo
sudo chown -R $USER /opt/dsh-plugin-repo
# 从 Codeup 拉
git clone <codeup-repo-url> /opt/dsh-plugin-repo
cd /opt/dsh-plugin-repo/harvester && npm ci
```

### 2. 建运行用户

发现器不需要 root，但需要能写 nginx 的产物目录。

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin dsh
sudo chown -R dsh:dsh /opt/dsh-plugin-repo
```

### 3. 配环境变量

```bash
sudo mkdir -p /etc/dsh-harvester
sudo cp /opt/dsh-plugin-repo/harvester/deploy/harvester.env.example /etc/dsh-harvester/harvester.env
sudo chmod 600 /etc/dsh-harvester/harvester.env
sudo vi /etc/dsh-harvester/harvester.env
```

至少要改这四个：

```sh
DATABASE_URL=postgres://dsh_plugin_harvester_rw:<口令>@47.101.216.5:5432/dsh_plugin_repo_dev?sslmode=no-verify
HARVESTER_NGINX_ROOT=/var/www/<你的站点目录>
HARVESTER_INDEX_BASE_URL=https://<你的域名>
HARVESTER_NGINX_PROBE_URL=https://<你的域名>
```

> **`sslmode` 不要用 `require`**——新版 `pg-connection-string` 按 verify-full 处理，
> RDS 私有 CA 会报 self-signed。联调 `no-verify`，正式
> `verify-full&sslrootcert=/etc/dsh-harvester/rds-ca.pem`（先下载 RDS CA 证书）。

> **口令不要贴进对话或 issue。** 要在本机改的话用
> `node src/cli.mjs set-secret`（隐藏输入，写进 gitignored 的 `.env.local`）；
> 但在 ECS 上 systemd 走 `EnvironmentFile`，所以更直接的做法是编辑
> `harvester.env`（属主 root、权限 600）。

### 4. 配 nginx

按站点现状选方案（见 `nginx-server-block.conf.example` 里的注释）：

- **方案 A**：站点根目录专用于本项目——新建 server 块，`root` 指向产物目录。
- **方案 B**：已有站点——往现有 server 块里加两个 `location`。

```bash
sudo vi /etc/nginx/conf.d/dsh-plugins.conf   # 或 sites-available
sudo nginx -t && sudo systemctl reload nginx
```

### 5. 授权产物目录

```bash
sudo mkdir -p /var/www/<你的站点目录>
sudo chown dsh:dsh /var/www/<你的站点目录>
```

nginx 需要能**读**这些文件——发现器写出的文件权限是 0644，
`www-data` 通常能读；但如果父目录权限过窄（缺 `o+x`）就读不到，
用 `ls -ld` 确认一遍。

### 6. 装 systemd

```bash
sudo cp /opt/dsh-plugin-repo/harvester/deploy/dsh-harvester.service /etc/systemd/system/
sudo cp /opt/dsh-plugin-repo/harvester/deploy/dsh-harvester.timer  /etc/systemd/system/
sudo systemctl daemon-reload
```

> `.service` 里的 `ReadWritePaths=/var/www` 和 `ProtectSystem=strict` 是加固项，
> 如果你的产物目录不在 `/var/www` 下，要把它加进 `ReadWritePaths`，
> 否则 systemd 会因为写不进去而拒绝执行。

### 7. 自检

```bash
sudo bash /opt/dsh-plugin-repo/harvester/deploy/preflight.sh
```

会逐项检查：Node 版本、环境变量文件权限、TLS 参数写法、产物目录可写性、
代理开关一致性、6 个信源的实际可达性、数据库连通性、公开地址。

**信源可达性那一节最值得看**——ECS 在国内时，出网到 `raw.githubusercontent.com`
和 `cdn.jsdelivr.net` 经常连不上（表现是 15 秒超时）。如果那里报 FAIL，
就得配出网代理，见下一节。

### 8. 手动跑一轮

```bash
sudo systemctl start dsh-harvester.service
journalctl -u dsh-harvester.service -f
```

一轮 5-12 分钟（26MB 的 vbarter 注册表索引是下载大头）。跑完检查产物：

```bash
ls -l /var/www/<你的站点目录>/
curl -s https://<你的域名>/index.json | head -c 200
```

### 9. 开定时

```bash
sudo systemctl enable --now dsh-harvester.timer
systemctl list-timers dsh-harvester.timer
```

## 出网代理（ECS 在国内时）

Node 的 `fetch` **默认不认** `HTTP(S)_PROXY`。必须显式开 `NODE_USE_ENV_PROXY=1`
（Node ≥ 24 / undici v7 起）。不配这个开关的现象是「连接超时」，
而不是「连不上代理」，极难排查——发现器启动日志里会主动警告这件事。

```sh
# /etc/dsh-harvester/harvester.env
HTTPS_PROXY=http://127.0.0.1:7890
NODE_USE_ENV_PROXY=1
NO_PROXY=127.0.0.1,localhost,47.101.216.5
```

`NO_PROXY` 要把数据库地址列进去，否则连 PG 也会绕代理。

如果 ECS 在香港/新加坡等海外节点，出网通常正常，这几项可以不填。

## 出问题看哪里

| 现象 | 查什么 |
| --- | --- |
| 服务起不来 | `journalctl -u dsh-harvester.service -n 100` |
| `信源大面积失败，跳过本轮发布` | 正常，是保险丝；看 `harvester_state` 或日志里哪个源挂了 |
| 公开地址 404 | nginx 的 `root`/`alias` 与 `HARVESTER_NGINX_ROOT` 对不上 |
| 公开地址 403 | 产物目录或父目录权限，nginx 用户读不到 |
| 连接超时 | 出网代理没配或 `NODE_USE_ENV_PROXY` 没开 |
| `28P01 password authentication failed` | PG 口令不对（不是网络问题） |
| `self-signed certificate` | `sslmode` 用错了，见上面 |

## 两条安全底线

1. **`/etc/dsh-harvester/harvester.env` 权限必须是 600、属主 root**——里面有 PG 口令。
2. **`harvester.env` 不要进 git。** 仓库里只有 `.example` 模板。
   `harvester/.env.local`（本地开发用的凭据文件）已被 gitignore。
