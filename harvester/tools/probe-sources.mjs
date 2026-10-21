#!/usr/bin/env node
/**
 * 信源探针：拿几份真实清单，验证解析器假设（行格式、分类标题、条目数）。
 * 一次性排障脚本，不参与发现器运行。
 */
import { readFile } from 'node:fs/promises'

const ENTRY = /^- \[([^\]]*)\]\(([^)]+)\)\s*-\s*(.*)$/

function parseAwesome(md) {
  const out = []
  let category = ''
  for (const line of md.split(/\r?\n/)) {
    if (line.startsWith('### ')) { category = line.slice(4).trim(); continue }
    if (line.startsWith('## ')) { category = ''; continue }
    const m = ENTRY.exec(line)
    if (m) out.push({ category, name: m[1], url: m[2], desc: m[3] })
  }
  return out
}

const file = process.argv[2]
const md = await readFile(file, 'utf8')
const rows = parseAwesome(md)
console.log(`file: ${file}`)
console.log(`entries: ${rows.length}`)
const cats = new Map()
for (const r of rows) cats.set(r.category, (cats.get(r.category) ?? 0) + 1)
console.log('categories:')
for (const [k, v] of cats) console.log(`  ${v}\t${k}`)
console.log('sample urls:')
for (const r of rows.slice(0, 3)) console.log('  ', JSON.stringify(r.url))
const nonGh = rows.filter((r) => !/^https?:\/\/github\.com\//i.test(r.url))
console.log(`non-github urls: ${nonGh.length}`)
for (const r of nonGh.slice(0, 10)) console.log('  ', r.url)
const tree = rows.filter((r) => /\/tree\//.test(r.url))
console.log(`monorepo (tree) urls: ${tree.length}`)
for (const r of tree.slice(0, 5)) console.log('  ', r.url)
const dup = rows.length - new Set(rows.map((r) => r.url)).size
console.log(`duplicate urls: ${dup}`)
