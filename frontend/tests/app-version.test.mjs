import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ensureCurrentAppVersion } from '../src/utils/appVersion.js'

const fixture = (version = 'build-new') => {
  const values = new Map([['solar_token', 'keep-login'], ['solar_user', 'keep-user']])
  const replaced = [], historyCalls = [], requests = []
  return {
    values, replaced, historyCalls, requests,
    options: {
      currentVersion: 'build-new', now: () => 1234,
      location: { href: 'https://example.invalid/dashboard/admin?tab=enquiries#details', replace: url => replaced.push(url) },
      history: { state: { existing: true }, replaceState: (...args) => historyCalls.push(args) },
      getStorage: () => ({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }),
      fetchImpl: async (...args) => { requests.push(args); return { ok: true, json: async () => ({ version }) } },
    },
  }
}

test('current build renders without reload and fetches uncached same-origin metadata', async () => {
  const f = fixture()
  assert.equal(await ensureCurrentAppVersion(f.options), 'ready')
  assert.equal(f.replaced.length, 0)
  assert.equal(f.requests[0][0], '/version.json?check=1234')
  assert.equal(f.requests[0][1].cache, 'no-store')
  assert.equal(f.requests[0][1].credentials, 'omit')
  assert.equal(f.values.get('solar_token'), 'keep-login')
  assert.equal(f.values.get('solar_user'), 'keep-user')
})

test('stale build reloads once, preserving the page, filters and hash', async () => {
  const f = fixture()
  f.options.currentVersion = 'build-old'
  assert.equal(await ensureCurrentAppVersion(f.options), 'reloading')
  const url = new URL(f.replaced[0])
  assert.equal(url.pathname, '/dashboard/admin')
  assert.equal(url.searchParams.get('tab'), 'enquiries')
  assert.equal(url.searchParams.get('__app_build'), 'build-new')
  assert.equal(url.hash, '#details')
  assert.equal(await ensureCurrentAppVersion(f.options), 'outdated')
  assert.equal(f.replaced.length, 1)
  assert.equal(f.values.get('solar_token'), 'keep-login')
})

test('successful update cleans only its own marker and preserves navigation state', async () => {
  const f = fixture()
  f.values.set('solar_build_reload', 'build-new')
  f.options.location.href = 'https://example.invalid/dashboard/admin?tab=enquiries&__app_build=build-new#details'
  assert.equal(await ensureCurrentAppVersion(f.options), 'ready')
  assert.deepEqual(f.historyCalls, [[{ existing: true }, '', '/dashboard/admin?tab=enquiries#details']])
  assert.equal(f.values.has('solar_build_reload'), false)
  assert.equal(f.values.get('solar_user'), 'keep-user')
})

test('URL guard prevents repeated reloads when browser storage is disabled', async () => {
  const f = fixture()
  f.options.currentVersion = 'build-old'
  f.options.getStorage = () => { throw new Error('Storage blocked') }
  assert.equal(await ensureCurrentAppVersion(f.options), 'reloading')
  f.options.location.href = f.replaced[0]
  assert.equal(await ensureCurrentAppVersion(f.options), 'outdated')
  assert.equal(f.replaced.length, 1)
})

test('missing/invalid version metadata or offline network does not block startup', async () => {
  for (const fetchImpl of [
    async () => ({ ok: false }),
    async () => { throw new Error('Offline') },
    async () => ({ ok: true, json: async () => { throw new Error('HTML fallback') } }),
    async () => ({ ok: true, json: async () => ({ version: '../../unexpected' }) }),
    async () => ({ ok: true, json: async () => ({}) }),
  ]) {
    const f = fixture()
    assert.equal(await ensureCurrentAppVersion({ ...f.options, fetchImpl }), 'unavailable')
    assert.equal(f.replaced.length, 0)
  }
})

test('slow metadata request is aborted so startup is not held indefinitely', async () => {
  const f = fixture()
  const fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Timed out')), { once: true })
  })
  assert.equal(await ensureCurrentAppVersion({ ...f.options, fetchImpl, timeoutMs: 10 }), 'unavailable')
})

test('deployment changes and rollbacks both trigger version replacement', async () => {
  const f = fixture('previous-release')
  assert.equal(await ensureCurrentAppVersion(f.options), 'reloading')
  assert.ok(f.replaced[0].includes('__app_build=previous-release'))
})

test('Vercel rules bypass caching for app documents and metadata, retain hashed assets', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  const headersFor = path => config.headers.filter(rule => new RegExp(`^${rule.source}$`).test(path)).flatMap(rule => rule.headers)
  for (const path of ['/', '/index.html', '/login', '/dashboard', '/dashboard/enquiries', '/version.json']) {
    const headers = headersFor(path)
    assert.ok(headers.some(header => header.key === 'Cache-Control' && header.value.includes('no-store')), path)
    assert.ok(headers.some(header => header.key === 'Vercel-CDN-Cache-Control' && header.value === 'no-store'), path)
  }
  const assets = headersFor('/assets/index-version.js')
  assert.equal(assets.length, 1)
  assert.ok(assets[0].value.includes('immutable'))
  const rewrite = new RegExp(`^${config.rewrites[0].source}$`)
  assert.equal(rewrite.test('/dashboard/enquiries'), true)
  assert.equal(rewrite.test('/assets/missing.js'), false)
  assert.equal(rewrite.test('/version.json'), false)
})
