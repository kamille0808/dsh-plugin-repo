#!/usr/bin/env bash
# DSH 插件仓库发现器 · ECS 上线前自检
#
# 用法：
#   sudo bash preflight.sh [环境变量文件路径]
#   默认检查 /etc/dsh-harvester/harvester.env
#
# 退出码 0 = 全部通过；非 0 = 有 FAIL 项。
# 只读检查，不改任何东西、不发任何写操作。

set -uo pipefail

ENV_FILE="${1:-/etc/dsh-harvester/harvester.env}"
FAIL=0
WARN=0

ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAIL=$((FAIL+1)); }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$1"; WARN=$((WARN+1)); }
sec()  { printf '\n\033[1m%s\033[0m\n' "$1"; }

sec "1. 运行环境"
if command -v node >/dev/null 2>&1; then
  NODE_V="$(node -v)"
  NODE_MAJOR="$(printf '%s' "$NODE_V" | sed 's/^v//' | cut -d. -f1)"
  if [ "${NODE_MAJOR:-0}" -ge 24 ]; then
    ok "node $NODE_V"
  else
    bad "node $NODE_V —— 需要 ≥ 24（NODE_USE_ENV_PROXY 与部分 fetch 行为依赖它）"
  fi
  node -e "console.log('     undici', process.versions.undici)"
else
  bad "找不到 node"
fi

sec "2. 环境变量文件"
if [ -r "$ENV_FILE" ]; then
  ok "可读：$ENV_FILE"
  PERM="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || echo '?')"
  if [ "$PERM" = "600" ]; then
    ok "权限 $PERM（含 PG 口令，600 是对的）"
  elif [ "$PERM" = "400" ]; then
    ok "权限 $PERM（含 PG 口令，400 是对的）"
  else
    warn "权限 $PERM —— 里面有 PG 口令，建议 chmod 600 $ENV_FILE"
  fi

  # 按 systemd EnvironmentFile 的口径解析：KEY=VALUE，其余全是字面量。
  # 绝不能用 `source`——DATABASE_URL 里的 `&sslrootcert=` 会被 shell 当操作符，
  # 而 systemd 不会。这正是脚本自己会警告的那种写法。
  # BOM 检测：Windows 编辑器容易带 UTF-8 BOM，systemd 不认，
  # 会让第一行变量（往往就是 DATABASE_URL）整个失效。
  SRC="$ENV_FILE"
  if head -c 3 "$ENV_FILE" | od -An -tx1 2>/dev/null | grep -q 'ef bb bf'; then
    warn "文件带 UTF-8 BOM —— systemd 不认这个标记，第一行变量会失效。"
    warn "  修：sed -i '1s/^\xEF\xBB\xBF//' $ENV_FILE"
    # 仍然从去掉 BOM 的副本里取值，这样本脚本能照常检查完（只是 systemd 那边要修）
    TMP_ENV="$(mktemp)"
    tail -c +4 "$ENV_FILE" > "$TMP_ENV"
    SRC="$TMP_ENV"
  fi

  env_get() {
    [ -f "$SRC" ] || return 0
    local v
    v="$(sed -n "s/^$1=//p" "$SRC" | tail -n1)"
    v="${v%$'\r'}"
    v="${v%\"}"; v="${v#\"}"
    v="${v%\'}"; v="${v#\'}"
    printf '%s' "$v"
  }
  DATABASE_URL="$(env_get DATABASE_URL)"
  HARVESTER_PUBLISHER="$(env_get HARVESTER_PUBLISHER)"
  HARVESTER_NGINX_ROOT="$(env_get HARVESTER_NGINX_ROOT)"
  HARVESTER_INDEX_BASE_URL="$(env_get HARVESTER_INDEX_BASE_URL)"
  HARVESTER_NGINX_PROBE_URL="$(env_get HARVESTER_NGINX_PROBE_URL)"
  HTTPS_PROXY="$(env_get HTTPS_PROXY)"
  HTTP_PROXY="$(env_get HTTP_PROXY)"
  NODE_USE_ENV_PROXY="$(env_get NODE_USE_ENV_PROXY)"

  for k in DATABASE_URL HARVESTER_PUBLISHER HARVESTER_NGINX_ROOT HARVESTER_INDEX_BASE_URL; do
    if [ -n "${!k:-}" ]; then
      case "$k" in
        DATABASE_URL) ok "$k 已配置（值不显示）" ;;
        *) ok "$k = ${!k}" ;;
      esac
    else
      bad "$k 未配置"
    fi
  done
  # 连接串里不该出现 sslmode=require
  case "${DATABASE_URL:-}" in
    *sslmode=require*) warn "DATABASE_URL 用了 sslmode=require —— 新版 pg 当 verify-full 处理，RDS 私有 CA 会报 self-signed；联调用 no-verify，正式用 verify-full&sslrootcert=<CA>" ;;
  esac
  if [[ "${DATABASE_URL:-}" == *"sslmode=verify-full"* && "${DATABASE_URL:-}" != *"sslrootcert="* ]]; then
    bad "sslmode=verify-full 但没给 sslrootcert=<RDS CA 路径>"
  fi
else
  bad "读不到 $ENV_FILE"
fi

sec "3. nginx 产物目录"
if [ -n "${HARVESTER_NGINX_ROOT:-}" ]; then
  ROOT="$HARVESTER_NGINX_ROOT"
  if [ -d "$ROOT" ]; then
    ok "目录存在：$ROOT"
    if [ -w "$ROOT" ]; then
      ok "当前用户可写"
    else
      bad "当前用户不可写 —— 发现器发布时会被拒绝。修：sudo chown -R <运行用户> $ROOT"
    fi
    if [ -f "$ROOT/index.json" ]; then
      ok "已有 index.json（$(stat -c '%s bytes' "$ROOT/index.json" 2>/dev/null || echo '?')）"
    else
      warn "还没有 index.json —— 首次运行后才有"
    fi
  else
    bad "目录不存在：$ROOT —— 修：sudo mkdir -p $ROOT && sudo chown <运行用户> $ROOT"
  fi
else
  bad "HARVESTER_NGINX_ROOT 未配置"
fi

sec "4. 出网代理"
if [ -n "${HTTPS_PROXY:-}" ] || [ -n "${HTTP_PROXY:-}" ]; then
  if [ -n "${NODE_USE_ENV_PROXY:-}" ]; then
    ok "代理已配置且 NODE_USE_ENV_PROXY 已开启"
  else
    bad "配了 HTTP(S)_PROXY 但没开 NODE_USE_ENV_PROXY=1 —— Node 的 fetch 默认忽略代理变量，表现为连接超时"
  fi
else
  echo "  ----  未配置代理"
  if echo "${HARVESTER_INDEX_BASE_URL:-}" | grep -q 'https://'; then
    echo "        （用 https:// 说明域名有证书，与出网代理无关）"
  fi
fi

sec "5. 信源可达性（各 15 秒超时）"
for u in \
  "https://raw.githubusercontent.com/awesome-dsh-plugin/awesome-dsh-plugin/main/README.md" \
  "https://raw.githubusercontent.com/vbarter/dsh-plugin-registry/main/data/plugins.json" \
  "https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json" \
  "https://dshopen.org/index.json" \
  "https://registry.npmjs.org" \
  "https://api.github.com" ; do
  host="$(printf '%s' "$u" | cut -d/ -f3)"
  if command -v curl >/dev/null 2>&1; then
    # 注意：curl 连不上时自己就会输出 000，再加 `|| echo 000` 会拼成 000000
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$u" 2>/dev/null)"
    [ -z "$code" ] && code="000"
    case "$code" in
      2*|3*) ok "$host → HTTP $code" ;;
      000)  bad "$host → 连不上（15 秒超时）。ECS 在国内时通常需要配出网代理" ;;
      429)  warn "$host → HTTP 429（限流，不算不通）" ;;
      *)    warn "$host → HTTP $code" ;;
    esac
  else
    warn "没有 curl，跳过 $host 的探测"
    break
  fi
done

sec "6. 数据库连通性"
if command -v node >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ]; then
  REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  if [ -f "$REPO_DIR/src/cli.mjs" ]; then
    if (cd "$REPO_DIR" && node src/cli.mjs check-db >/tmp/dsh-checkdb.log 2>&1); then
      ok "check-db 通过"
      sed -n '1,40p' /tmp/dsh-checkdb.log | sed 's/^/     /'
    else
      bad "check-db 失败："
      sed -n '1,20p' /tmp/dsh-checkdb.log | sed 's/^/     /'
    fi
  else
    warn "找不到 $REPO_DIR/src/cli.mjs，跳过"
  fi
else
  warn "没有 node 或 DATABASE_URL，跳过"
fi

sec "7. 公开地址自检（发布过一次之后才有效）"
if [ -n "${HARVESTER_NGINX_PROBE_URL:-}" ]; then
  URL="${HARVESTER_NGINX_PROBE_URL%/}/index.json"
  if command -v curl >/dev/null 2>&1; then
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$URL" 2>/dev/null || echo "000")"
    case "$code" in
      2*) ok "$URL → HTTP $code" ;;
      000) warn "$URL → 还连不上（首次发布前正常）" ;;
      *) warn "$URL → HTTP $code" ;;
    esac
  fi
else
  warn "HARVESTER_NGINX_PROBE_URL 未配置"
fi

sec "汇总"
printf '  FAIL %s 项，WARN %s 项\n' "$FAIL" "$WARN"
if [ "$FAIL" -gt 0 ]; then
  echo "  有 FAIL 项，先修掉再上线。"
  exit 1
fi
echo "  全部通过。可以启动：sudo systemctl start dsh-harvester.service"
exit 0
