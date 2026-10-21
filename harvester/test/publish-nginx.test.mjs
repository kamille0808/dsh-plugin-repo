/**
 * nginx 静态托管发布路径。
 *
 * 重点验证「原子替换」：nginx 直接对外提供 3MB 的 index.json，
 * 写到一半被下载到的话，DSH「发现」页会当场解析失败。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { publish } from '../src/publish.mjs'

async function tmpDir() {
  return mkdtemp(path.join(tmpdir(), 'dsh-harvester-publish-'))
}

const FILES = () => new Map([
  ['index.json', '{"format":1,"plugins":[]}'],
  ['index.html', '<!doctype html><title>x</title>'],
])

test('publisher=nginx：写进指定的 nginx 根目录', async () => {
  const dir = await tmpDir()
  try {
    const result = await publish({
      publisher: 'nginx',
      nginxRoot: dir,
      outDir: path.join(dir, 'unused'),
      indexBaseUrl: 'https://plugins.example.com',
    }, FILES())

    assert.equal(result.localDir, dir)
    assert.deepEqual(result.written.sort(), ['index.html', 'index.json'])
    assert.match(await readFile(path.join(dir, 'index.json'), 'utf8'), /"format":1/)
    assert.match(await readFile(path.join(dir, 'index.html'), 'utf8'), /doctype html/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('publisher=nginx：重复发布是覆盖而不是叠加，目录里不留临时文件', async () => {
  const dir = await tmpDir()
  try {
    const config = {
      publisher: 'nginx',
      nginxRoot: dir,
      outDir: dir,
      indexBaseUrl: 'https://plugins.example.com',
    }
    await publish(config, FILES())
    await publish(config, new Map([['index.json', '{"format":1,"plugins":[1,2]}'], ['index.html', 'v2']]))

    const entries = await readdir(dir)
    assert.deepEqual(entries.sort(), ['index.html', 'index.json'])
    assert.match(await readFile(path.join(dir, 'index.json'), 'utf8'), /\[1,2\]/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('publisher=nginx：未配置 nginxRoot 时退回 outDir', async () => {
  const dir = await tmpDir()
  try {
    const outDir = path.join(dir, 'dist')
    const result = await publish({
      publisher: 'nginx',
      nginxRoot: '',
      outDir,
      indexBaseUrl: 'https://plugins.example.com',
    }, FILES())
    assert.equal(result.localDir, outDir)
    await stat(path.join(outDir, 'index.json'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('publisher=file：也走原子替换，不留临时文件', async () => {
  const dir = await tmpDir()
  try {
    const result = await publish({ publisher: 'file', outDir: dir }, FILES())
    assert.equal(result.target, dir)
    const entries = await readdir(dir)
    assert.deepEqual(entries.sort(), ['index.html', 'index.json'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('未知 publisher 直接报错，不静默跳过', async () => {
  const dir = await tmpDir()
  try {
    await assert.rejects(
      () => publish({ publisher: 'ftp', outDir: dir }, FILES()),
      /未知的 publisher/,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('发布后回源自检：确认公开地址拿到的就是本轮产物', async () => {
  const dir = await tmpDir()
  const server = http.createServer((req, res) => {
    if (req.url === '/index.json') {
      const body = Buffer.from('{"format":1,"plugins":[],"中文":"测试"}', 'utf8')
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': body.length })
      res.end(body)
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    const result = await publish({
      publisher: 'nginx',
      nginxRoot: dir,
      outDir: dir,
      indexBaseUrl: `http://127.0.0.1:${port}`,
      nginxProbeUrl: `http://127.0.0.1:${port}`,
    }, FILES())

    assert.equal(result.probe.ok, true)
    assert.equal(result.probe.status, 200)
    // 期望值按 UTF-8 字节数算，不是字符串长度
    assert.equal(result.probe.expectedBytes, Buffer.byteLength('{"format":1,"plugins":[]}', 'utf8'))
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})

test('发布后回源自检：公开地址不通时记警告，不抛异常', async () => {
  const dir = await tmpDir()
  try {
    const result = await publish({
      publisher: 'nginx',
      nginxRoot: dir,
      outDir: dir,
      indexBaseUrl: 'https://example.invalid',
      // 指向一个必定连不通的端口
      nginxProbeUrl: 'http://127.0.0.1:1',
      nginxProbeAttempts: 2,
      nginxProbeDelayMs: 10,
    }, FILES())

    assert.equal(result.probe.ok, false)
    assert.ok(result.probe.error)
    // 文件本身照样落盘了
    await stat(path.join(dir, 'index.json'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
