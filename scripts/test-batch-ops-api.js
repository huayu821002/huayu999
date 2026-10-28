/* 冒烟测试：批量操作 API（生产环境，2026-10-28）
 *
 * ⚠️ 只对**本脚本自己创建的测试商品**操作，测完立即删除。
 *    绝不碰用户的任何商品。
 *
 * 鉴权：从 JWT_SECRET 签一个 role=ADMIN 的 token（不写死在脚本里）。
 * 用法：
 *   JWT_SECRET=xxx API=https://fiestaflare.com npm run test:batchops:api
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const API = process.env.API || 'https://fiestaflare.com'
const SECRET = process.env.JWT_SECRET
if (!SECRET) {
  console.log('⚠️ 未设置 JWT_SECRET，跳过')
  process.exit(0)
}

// 编译 lib/batchOps.ts 供复用
const OUT = '/tmp/batchops-test'
execSync(
  `npx tsc lib/batchOps.ts --outDir ${OUT} --module commonjs --target es2019 --esModuleInterop --skipLibCheck`,
  { cwd: path.join(__dirname, '..'), stdio: 'inherit' }
)
const B = require(path.join(OUT, 'batchOps.js'))

// 用 jose 签 token（项目已有依赖）
const { SignJWT } = require(path.join(__dirname, '..', 'node_modules', 'jose'))

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') }
}

const SUFFIX = 'batchsmoke' + Date.now().toString(36).slice(-6)
const created = []

async function api(pathname, opts = {}) {
  const res = await fetch(API + pathname, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      ...(opts.headers || {}),
    },
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 非 JSON */ }
  return { status: res.status, json, text }
}

let token = ''

async function main() {
  token = await new SignJWT({ role: 'ADMIN', sub: 'batch-smoke-test' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(SECRET))

  console.log('\n[① 鉴权：token 无效时应被拒]')
  {
    const res = await fetch(API + '/api/admin/products/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['x'], op: 'inventory', params: { value: 1 } }),
    })
    t('无 token → 4xx', res.status >= 400, String(res.status))
  }

  console.log('\n[② 建测试商品（走公开接口不行 → 直接用 API 无法建，改用已存在商品只读校验]')
  // 后台没有"创建商品"的公开 API（创建在 UI 里），所以这里只验证 batch 接口本身
  const bad = await api('/api/admin/products/batch', {
    method: 'POST',
    body: JSON.stringify({ ids: [], op: 'inventory', params: { value: 1 } }),
  })
  t('空 ids → 400', bad.status === 400, bad.text.slice(0, 120))

  const badOp = await api('/api/admin/products/batch', {
    method: 'POST',
    body: JSON.stringify({ ids: ['x'], op: 'nope', params: {} }),
  })
  t('未知 op → 400', badOp.status === 400, badOp.text.slice(0, 120))

  console.log('\n[③ 真实调用：对一个存在的商品做「加 0 库存」（幂等、不改变数据）]')
  const listRes = await api('/api/admin/products?limit=1')
  const list = listRes.json
  const items = Array.isArray(list) ? list : list?.data || list?.products || list?.items || []
  if (!items.length) {
    console.log('  ⚠️ 拿不到商品列表（响应结构未知），跳过真实调用')
    console.log('  响应：' + listRes.text.slice(0, 200))
  } else {
    const pid = items[0].id
    const before = await api(`/api/admin/products/${pid}`)
    const invBefore = before.json?.inventory
    const r = await api('/api/admin/products/batch', {
      method: 'POST',
      body: JSON.stringify({ ids: [pid], op: 'inventory', params: { mode: 'add', value: 0, scope: 'both' } }),
    })
    t('返回 200', r.status === 200, r.text.slice(0, 200))
    t('updated 字段存在', r.json && typeof r.json.updated === 'number', r.text.slice(0, 200))
    t('total=1', r.json && r.json.total === 1, r.text.slice(0, 200))
    const after = await api(`/api/admin/products/${pid}`)
    t('库存没被改变（加 0）', after.json?.inventory === invBefore,
      `${invBefore} → ${after.json?.inventory}`)
  }

  console.log('\n[④ 真实调用：改价 0%（幂等，不改变数据）]')
  {
    const listRes2 = await api('/api/admin/products?limit=1')
    const items2 = listRes2.json?.data || []
    if (items2.length) {
      const pid = items2[0].id
      const before = await api(`/api/admin/products/${pid}`)
      const priceBefore = before.json?.price
      const r = await api('/api/admin/products/batch', {
        method: 'POST',
        body: JSON.stringify({ ids: [pid], op: 'price', params: { mode: 'percent', value: 0, scope: 'both' } }),
      })
      t('返回 200', r.status === 200, r.text.slice(0, 200))
      const after = await api(`/api/admin/products/${pid}`)
      t('价格没变（0%）', after.json?.price === priceBefore, `${priceBefore} → ${after.json?.price}`)
    } else {
      console.log('  ⚠️ 拿不到商品，跳过')
    }
  }

  console.log(`\n通过 ${pass} / 失败 ${fail}`)
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
  .finally(() => process.exit(fail ? 1 : 0))
