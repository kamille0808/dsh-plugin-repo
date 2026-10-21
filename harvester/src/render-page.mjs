/**
 * 渲染静态浏览页（契约 §8「随索引发布一个静态浏览页」）。
 *
 * 导出物卫生（契约 §4.5）：只含公共字段 + 收录来源 + 安装命令；
 * 不含 PG 内部字段、ratings、本地数据、凭据与本机路径。
 */
import { log } from './log.mjs'
import { parseContractId } from './normalize.mjs'

/** 生成浏览页所需的公开条目。 */
export function buildBrowseData(catalog) {
  const categories = catalog.categories.map((c) => ({
    id: c.id,
    titleZh: c.title_zh,
    titleEn: c.title_en,
  }))
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  const plugins = catalog.plugins
    .filter((p) => p.status !== 'gone')
    .map((p) => {
      const parsed = parseContractId(p.id)
      const version = (p.npm_versions ?? [])[0]?.ver ?? ''
      return {
        id: p.id,
        name: p.name,
        npm: p.npm,
        github: p.github,
        subPath: parsed?.subPath ?? '',
        category: p.category_id,
        categoryTitle: categoryMap.get(p.category_id)?.titleZh || categoryMap.get(p.category_id)?.titleEn || '',
        desc: p.desc_zh || p.desc_en,
        stars: p.stars,
        votes: p.consensus_votes,
        version,
        lastPushAt: p.last_push_at,
        status: p.status,
        sources: p.sources,
        install: p.install_spec,
      }
    })
    .sort((a, b) => b.votes - a.votes || b.stars - a.stars || a.id.localeCompare(b.id))

  return { categories, plugins }
}

/** 渲染自包含的 HTML 浏览页（无外部依赖，静态托管即可）。 */
export function renderBrowsePage(data, meta = {}) {
  const generatedAt = meta.generatedAt ?? new Date().toISOString()
  const payload = JSON.stringify({ ...data, generatedAt }).replace(/</g, '\\u003c')
  const title = 'DSH 插件仓库 · 浏览'
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="DSH（DeepSeek Harness）社区插件目录：搜索、分类筛选、复制安装命令。收录不代表安全审计结论。">
<style>
  :root {
    --bg: #0f1115; --panel: #171a21; --line: #262b35; --fg: #e6e8ec; --muted: #98a2b3;
    --accent: #6aa9ff; --warn: #ffb454;
  }
  @media (prefers-color-scheme: light) {
    :root { --bg:#f6f7f9; --panel:#fff; --line:#e3e6ea; --fg:#1a1d22; --muted:#5b6472; --accent:#2f6fd0; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
    font: 14px/1.6 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
  header { padding: 28px 20px 16px; border-bottom: 1px solid var(--line); }
  .wrap { max-width: 1080px; margin: 0 auto; }
  h1 { margin: 0 0 6px; font-size: 20px; }
  .sub { color: var(--muted); font-size: 13px; }
  .notice { margin-top: 12px; padding: 10px 12px; border: 1px solid var(--line); border-left: 3px solid var(--warn);
    border-radius: 6px; background: var(--panel); color: var(--muted); font-size: 12.5px; }
  .bar { display: flex; gap: 10px; flex-wrap: wrap; padding: 16px 0; }
  input, select { padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel);
    color: var(--fg); font-size: 13px; }
  input { flex: 1 1 260px; }
  .count { color: var(--muted); font-size: 12.5px; align-self: center; }
  ul { list-style: none; margin: 0; padding: 0 0 40px; }
  li { border: 1px solid var(--line); border-radius: 8px; background: var(--panel); padding: 14px 16px; margin-bottom: 10px; }
  .row { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
  .nm { font-weight: 600; }
  .tag { font-size: 11.5px; padding: 1px 7px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); }
  .votes { color: var(--accent); }
  .desc { color: var(--muted); margin: 6px 0 10px; }
  .meta { font-size: 12px; color: var(--muted); display: flex; gap: 14px; flex-wrap: wrap; }
  code { background: rgba(127,127,127,.14); padding: 1px 6px; border-radius: 4px; font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
  .srcs { font-size: 11.5px; color: var(--muted); }
  a { color: var(--accent); }
  .empty { color: var(--muted); padding: 30px 0; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>DSH 插件仓库</h1>
    <div class="sub">社区插件目录 · 由发现器（Harvester）从公开策展清单聚合 · 生成于 <span id="gen"></span></div>
    <div class="notice">
      <b>收录 ≠ 背书。</b>安装插件等于在本机以你的权限执行第三方代码——它可以读取文件、使用凭据、访问网络。
      工具审批不构成沙箱。请先阅读源码；这里的评分与票数只是聚合信号，<b>不是安全审计结论</b>。
    </div>
  </header>
  <div class="wrap">
    <div class="bar">
      <input id="q" type="search" placeholder="搜索名称 / 包名 / 描述 / 仓库…" autocomplete="off">
      <select id="cat"><option value="">全部分类</option></select>
      <span class="count" id="count"></span>
    </div>
    <ul id="list"></ul>
  </div>
</div>
<script id="data" type="application/json">${payload}</script>
<script>
(function () {
  var DATA = JSON.parse(document.getElementById('data').textContent);
  document.getElementById('gen').textContent = DATA.generatedAt;
  var list = document.getElementById('list');
  var count = document.getElementById('count');
  var q = document.getElementById('q');
  var cat = document.getElementById('cat');
  var cats = DATA.categories.slice().sort(function (a, b) {
    return (a.titleZh || a.titleEn || '').localeCompare(b.titleZh || b.titleEn || '');
  });
  var counts = {};
  DATA.plugins.forEach(function (p) { if (p.category) counts[p.category] = (counts[p.category] || 0) + 1; });
  cats.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c.id;
    o.textContent = (c.titleZh || c.titleEn || c.id) + ' (' + (counts[c.id] || 0) + ')';
    cat.appendChild(o);
  });
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function render() {
    var text = q.value.trim().toLowerCase();
    var wantCat = cat.value;
    var rows = DATA.plugins.filter(function (p) {
      if (wantCat && p.category !== wantCat) return false;
      if (!text) return true;
      return (p.name + ' ' + p.npm + ' ' + p.id + ' ' + p.desc + ' ' + p.github).toLowerCase().indexOf(text) >= 0;
    });
    count.textContent = rows.length + ' / ' + DATA.plugins.length + ' 个插件';
    if (!rows.length) {
      list.innerHTML = '<div class="empty">没有匹配的插件。</div>';
      return;
    }
    list.innerHTML = rows.map(function (p) {
      var bits = [];
      if (p.version) bits.push('<span>版本 ' + esc(p.version) + '</span>');
      if (p.stars) bits.push('<span>★ ' + p.stars + '</span>');
      if (p.lastPushAt) bits.push('<span>最近推送 ' + esc(String(p.lastPushAt).slice(0, 10)) + '</span>');
      if (p.status === 'archived') bits.push('<span class="tag">已归档</span>');
      if (p.votes > 0) bits.push('<span class="votes">共识 ' + p.votes + ' 票</span>');
      var install = p.install ? 'dsh plugin --profile web add ' + p.install : '';
      return '<li>'
        + '<div class="row"><span class="nm">' + esc(p.name) + '</span>'
        + (p.npm ? '<span class="tag">' + esc(p.npm) + '</span>' : '')
        + (p.categoryTitle ? '<span class="tag">' + esc(p.categoryTitle) + '</span>' : '')
        + '</div>'
        + (p.desc ? '<div class="desc">' + esc(p.desc) + '</div>' : '')
        + '<div class="meta">' + bits.join('') + '</div>'
        + (install ? '<div class="meta"><code>' + esc(install) + '</code></div>' : '')
        + '<div class="meta"><a href="' + esc(p.github) + '" rel="noopener noreferrer">源码仓库</a>'
        + (p.sources && p.sources.length ? '<span class="srcs">收录来源：' + esc(p.sources.join('、')) + '</span>' : '')
        + '</div></li>';
    }).join('');
  }
  q.addEventListener('input', render);
  cat.addEventListener('change', render);
  render();
})();
</script>
</body>
</html>
`
}
