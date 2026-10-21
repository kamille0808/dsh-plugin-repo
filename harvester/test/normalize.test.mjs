/**
 * 归一化与门槛的单测：契约 §2 / §4 的口径。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseGithubUrl, contractId, idFromGithubUrl, buildInstallSpec, isValidInstallSpec,
  slugifyCategory, resolveCategoryId, isValidNpmName, isValidSemver,
  normalizeNpmVersions, latestVersion, parseContractId, signalsHash,
} from '../src/normalize.mjs'
import { applyAdmissionGate, mergeCandidates } from '../src/catalog.mjs'
import { syntheticNpmName, syntheticVersion } from '../src/collect.mjs'

test('parseGithubUrl 解析仓库与 monorepo 子路径', () => {
  const plain = parseGithubUrl('https://github.com/omdsh-dev/dsh-notification')
  assert.equal(plain.owner, 'omdsh-dev')
  assert.equal(plain.repo, 'dsh-notification')
  assert.equal(plain.subPath, '')

  const mono = parseGithubUrl('https://github.com/john-walks-slow/dsh-proactive/tree/main/packages/dsh-proactive')
  assert.equal(mono.owner, 'john-walks-slow')
  assert.equal(mono.repo, 'dsh-proactive')
  assert.equal(mono.subPath, 'packages/dsh-proactive')

  assert.equal(parseGithubUrl('https://example.com/foo/bar'), null)
  assert.equal(parseGithubUrl(''), null)
})

test('contractId 小写规范化 + #path: 记法', () => {
  assert.equal(contractId('AnonyJcy', 'DSH-J-Space', ''), 'anonyjcy/dsh-j-space')
  assert.equal(
    contractId('Jonah-Wu23', 'dsh-gungnir', 'packages/dsh-plugin'),
    'jonah-wu23/dsh-gungnir#path:/packages/dsh-plugin',
  )
  assert.equal(idFromGithubUrl('https://github.com/Aisland-SJL/dsh-worktable'), 'aisland-sjl/dsh-worktable')
})

test('parseContractId 可反解 id', () => {
  assert.deepEqual(parseContractId('owner/repo'), { owner: 'owner', repo: 'repo', subPath: '' })
  assert.deepEqual(parseContractId('owner/repo#path:/a/b'), { owner: 'owner', repo: 'repo', subPath: 'a/b' })
  assert.equal(parseContractId('broken'), null)
})

test('install_spec 走官方 parseInstallSpec 口径', () => {
  assert.equal(buildInstallSpec({ npm: 'dsh-notification', owner: 'a', repo: 'b' }), 'dsh-notification')
  assert.equal(buildInstallSpec({ npm: '', owner: 'a', repo: 'b' }), 'github:a/b')
  assert.equal(
    buildInstallSpec({ npm: '', owner: 'a', repo: 'b', subPath: 'packages/x' }),
    'github:a/b#path:/packages/x',
  )
  // 非法 npm 名（不以字母数字开头）应被官方口径拒绝
  assert.equal(buildInstallSpec({ npm: '.bad', owner: 'a', repo: 'b' }), 'github:a/b')
  assert.equal(buildInstallSpec({ npm: '', owner: '', repo: '' }), null)
  assert.ok(isValidInstallSpec('github:owner/repo'))
  assert.ok(isValidInstallSpec('@scope/pkg'))
  assert.ok(!isValidInstallSpec('owner/repo'))
})

test('分类 slug 与 alias 归一', () => {
  assert.equal(slugifyCategory('Usage & Billing'), 'usage-billing')
  assert.equal(slugifyCategory('WSL & Windows Interop'), 'wsl-windows-interop')
  assert.equal(slugifyCategory('AGI Architecture Exploration'), 'agi-architecture-exploration')
  assert.equal(resolveCategoryId('UI Enhancements', {}), 'ui-enhancements')
  assert.equal(resolveCategoryId('interface', { interface: 'ui-enhancements' }), 'ui-enhancements')
  assert.equal(resolveCategoryId('Tools & Capabilities', {}), 'tools-capabilities')
  assert.equal(resolveCategoryId('', {}), '')
})

test('分类白名单：章节标题不会被当成插件分类', () => {
  const known = ['ui-enhancements', 'memory']
  // 社区清单的章节标题不是插件分类
  assert.equal(resolveCategoryId('Hot Plugins', {}, known), '')
  assert.equal(resolveCategoryId('Install and Discover Plugins', {}, known), '')
  assert.equal(resolveCategoryId('⭐ Awesome DeepSeek Harness Plugins', {}, known), '')
  // 契约内的分类照常归一
  assert.equal(resolveCategoryId('UI Enhancements', {}, known), 'ui-enhancements')
  assert.equal(resolveCategoryId('interface', { interface: 'ui-enhancements' }, known), 'ui-enhancements')
})

test('npm 名与 SemVer 合法性（format-1 口径）', () => {
  assert.ok(isValidNpmName('dsh-notification'))
  assert.ok(isValidNpmName('@yolk_vat-y/dsh-project-memory'))
  assert.ok(!isValidNpmName('Owner/Repo'))
  assert.ok(!isValidNpmName('.leading-dot'))
  assert.ok(!isValidNpmName(''))
  assert.ok(isValidSemver('1.2.3'))
  assert.ok(isValidSemver('0.1.0-rc.12'))
  assert.ok(!isValidSemver('1.2'))
  assert.ok(!isValidSemver('v1.2.3'))
})

test('npm_versions 按时间倒序维护（时间未知的排在最后）', () => {
  const versions = normalizeNpmVersions([
    { ver: '1.0.0', time: '2026-01-01T00:00:00.000Z' },
    { ver: '2.0.0', time: '2026-03-01T00:00:00.000Z' },
    { ver: '1.5.0', time: null },
  ])
  assert.deepEqual(versions.map((v) => v.ver), ['2.0.0', '1.0.0', '1.5.0'])
  // 「最新版本」按 semver 判定（契约 §6 的 update-available 比的是版本号，不是时间）
  assert.equal(latestVersion(versions), '2.0.0')
})

test('合成 npm 名与版本可用于 git 源条目', () => {
  const name = syntheticNpmName('Omdsh-Dev', 'dsh-notification', '')
  assert.equal(name, '@omdsh-dev/dsh-notification')
  assert.ok(isValidNpmName(name))

  const mono = syntheticNpmName('owner', 'repo', 'packages/x')
  assert.ok(isValidNpmName(mono))
  assert.ok(mono.includes('packages.x'))

  const version = syntheticVersion('main', 'abcdef1234567890abcdef1234567890abcdef12')
  assert.ok(isValidSemver(version))
  assert.equal(version, '0.0.0-main.abcdef1')
})

test('入库门槛：install_spec 不合法则拒绝', () => {
  const result = applyAdmissionGate({
    id: 'owner/repo', owner: '', repo: '', npm: '', name: 'x', votes: 0, versions: [],
  })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'install-spec-invalid')
})

test('入库门槛：候选池需 bundle 声明或策展收录', () => {
  const base = {
    id: 'owner/repo', owner: 'owner', repo: 'repo', npm: 'dsh-x',
    name: 'X', votes: 0, versions: [], descEn: '', descZh: '',
  }
  assert.equal(applyAdmissionGate(base, { requiresBundleDeclaration: true }).ok, false)
  assert.equal(applyAdmissionGate(base, { requiresBundleDeclaration: true, hasBundleDeclaration: true }).ok, true)
  assert.equal(applyAdmissionGate(base, { requiresBundleDeclaration: true, curated: true }).ok, true)
})

test('合并候选：多源收录累加共识票', () => {
  const entries = [{
    parsed: { owner: 'Owner', repo: 'Repo', subPath: '' },
    displayName: 'Repo', description: 'desc', categoryTitle: 'UI Enhancements',
  }]
  const collected = [
    { source: { source_id: 'awesome', votes: true }, entries },
    { source: { source_id: 'beancookie', votes: true }, entries },
    { source: { source_id: 'dsh-plugin-catalog', votes: false }, entries: [] },
  ]
  const candidates = mergeCandidates(collected, {})
  assert.equal(candidates.size, 1)
  const candidate = [...candidates.values()][0]
  assert.equal(candidate.id, 'owner/repo')
  assert.equal(candidate.votes, 2)
  assert.equal(candidate.categoryId, 'ui-enhancements')
  assert.deepEqual([...candidate.sources].sort(), ['awesome', 'beancookie'])
})

test('signalsHash 稳定且对内容敏感', () => {
  assert.equal(signalsHash({ a: 1, b: 2 }), signalsHash({ a: 1, b: 2 }))
  assert.notEqual(signalsHash({ a: 1 }), signalsHash({ a: 2 }))
})
