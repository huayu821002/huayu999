/**
 * 选品 Agent —— AI 客户端层
 *
 * 通道设计（按优先级自动降级）：
 *   1. MiniMax 官方 API（api.minimaxi.com）—— 直连、无网关 41k 上下文开销
 *      key 来自 ~/.openclaw/agents/main/agent/auth-profiles.json 的 minimax:cn
 *      ★ 注意：minimax:global 这个 key 余额不足，minimax:cn 在 api.minimax.io 上
 *        是 invalid key —— 唯一可用组合是 minimax:cn + api.minimaxi.com
 *   2. OpenClaw 网关（127.0.0.1:12904）—— 兜底，但每次带 41k 系统提示，批量场景很贵
 *
 * 模型选择（重要）：
 *   - MiniMax-M3        → 主力。**支持视觉**，选品必须看图
 *   - MiniMax-M3.1-Flash → 便宜快的视觉档，用于大批量粗筛
 *   - MiniMax-M2.7      → 纯文本，不支持图片！不要拿它做选品视觉判断
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const MM_BASE = 'https://api.minimaxi.com'
export type AiProvider = {
  name: string
  chat: (messages: any[], opts?: { model?: string; maxTokens?: number; temperature?: number }) => Promise<string>
  vision: boolean
}

function readMinimaxKey(): string | null {
  // 1) 环境变量优先（生产环境用：Hostinger 的 /hbuilds/config/.env）
  const envKey =
    process.env.MINIMAX_API_KEY ||
    process.env.SELECTION_AI_KEY ||
    process.env.DASHSCOPE_API_KEY
  if (envKey && envKey.startsWith('sk-')) return envKey

  // 2) 本机 openclaw 的 auth-profiles
  const p = path.join(os.homedir(), '.openclaw/agents/main/agent/auth-profiles.json')
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
    const key = raw?.profiles?.['minimax:cn']?.key
    if (typeof key === 'string' && key.startsWith('sk-')) return key
  } catch {}
  return null
}

/** 走 OpenAI 兼容协议时用的 baseUrl（可配） */
function readBaseUrl(): string {
  return (
    process.env.SELECTION_AI_BASE_URL ||
    process.env.DASHSCOPE_BASE_URL ||
    'https://api.minimaxi.com'
  )
}

/** 模型名可配（方便换 Qwen / 其它供应商） */
function readDefaultModel(): string {
  return process.env.SELECTION_AI_MODEL || 'MiniMax-M3'
}

function gatewayToken(): string | null {
  const p = path.join(os.homedir(), '.openclaw/openclaw.json')
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
    const t = raw?.gateway?.auth?.token
    if (typeof t === 'string' && t) return t
  } catch {}
  return null
}

async function httpJson(
  url: string,
  headers: Record<string, string>,
  body: any,
  timeoutMs = 180000
): Promise<any> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    const text = await res.text()
    if (!res.ok) {
      let msg = text.slice(0, 300)
      try {
        const j = JSON.parse(text)
        msg = j?.error?.message || j?.message || msg
      } catch {}
      throw new Error(`HTTP ${res.status}: ${msg}`)
    }
    return JSON.parse(text)
  } finally {
    clearTimeout(timer)
  }
}

/** 从可能带 <think> 的回复里剥掉思维链 */
export function stripThink(s: string): string {
  return String(s || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim()
}

/** 从模型输出里抠出 JSON（容忍 ```json 包裹和前后废话） */
export function extractJson<T = any>(raw: string): T {
  const s = stripThink(raw)
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1] : s
  try {
    return JSON.parse(body)
  } catch {}
  const start = body.search(/[[{]/)
  if (start < 0) throw new Error('模型输出里找不到 JSON')
  // 从 start 起逐字符尝试闭合
  for (let end = body.length; end > start; end--) {
    const slice = body.slice(start, end)
    try {
      return JSON.parse(slice)
    } catch {}
  }
  throw new Error('模型输出的 JSON 解析失败: ' + s.slice(0, 200))
}

/** MiniMax 直连 */
export function minimaxProvider(): AiProvider | null {
  const key = readMinimaxKey()
  if (!key) return null
  const url = `${readBaseUrl()}/v1/chat/completions`
  return {
    name: 'minimax-direct',
    vision: true,
    async chat(messages, opts = {}) {
      const model = opts.model || readDefaultModel()
      const out = await httpJson(
        url,
        { authorization: `Bearer ${key}` },
        {
          model,
          max_tokens: opts.maxTokens ?? 2000,
          temperature: opts.temperature ?? 0.3,
          // ★ 关键 1：不关 thinking，模型会先输出 <think>…</think> 把 max_tokens 吃光，
          //   导致 JSON 被截断、解析失败。
          // ★ 关键 2：MiniMax-M3.1-Flash **强制要求** thinking.type=adaptive，
          //   传 disabled 会直接 400（实测）。所以按模型分流。
          thinking: model.includes('M3.1-Flash')
            ? { type: 'adaptive', effort: 'low' }
            : { type: 'disabled' },
          messages,
        }
      )
      const c = out?.choices?.[0]?.message?.content
      return typeof c === 'string' ? stripThink(c) : ''
    },
  }
}

/** OpenClaw 网关兜底（贵，但永不失联） */
export function gatewayProvider(): AiProvider | null {
  const token = gatewayToken()
  if (!token) return null
  const url = 'http://127.0.0.1:12904/v1/chat/completions'
  return {
    name: 'openclaw-gateway',
    vision: true,
    async chat(messages, opts = {}) {
      const out = await httpJson(
        url,
        { authorization: `Bearer ${token}` },
        {
          model: 'openclaw/selector',
          max_tokens: opts.maxTokens ?? 2000,
          messages,
        }
      )
      if (out?.error) throw new Error(out.error.message || 'gateway error')
      const c = out?.choices?.[0]?.message?.content
      return typeof c === 'string' ? stripThink(c) : ''
    },
  }
}

let cached: AiProvider | null = null

export function getProvider(force?: 'minimax-direct' | 'openclaw-gateway'): AiProvider {
  if (force) {
    const p = force === 'minimax-direct' ? minimaxProvider() : gatewayProvider()
    if (!p) throw new Error(`provider ${force} 不可用`)
    return p
  }
  if (cached) return cached
  const mm = minimaxProvider()
  if (mm) {
    cached = mm
    return cached
  }
  const gw = gatewayProvider()
  if (gw) {
    cached = gw
    return cached
  }
  throw new Error('没有任何可用 AI 通道')
}

/** 带自动降级的一次调用 */
export async function aiChat(
  messages: any[],
  opts: { model?: string; maxTokens?: number; temperature?: number; provider?: 'minimax-direct' | 'openclaw-gateway' } = {}
): Promise<string> {
  const tries: Array<'minimax-direct' | 'openclaw-gateway'> = opts.provider
    ? [opts.provider]
    : ['minimax-direct', 'openclaw-gateway']
  let lastErr: any = null
  for (const name of tries) {
    const p = getProvider(name)
    try {
      return await p.chat(messages, opts)
    } catch (e: any) {
      lastErr = e
    }
  }
  throw lastErr
}

/**
 * 带图片的调用（视觉）
 *
 * ★ 坑：MiniMax 多模态要求**图片在文本之前**，所以 system 提示词必须作为
 *   独立的 system message 传，不能拼进 content 数组。
 *   之前把 system 拼到 content 里 → 模型完全无视格式要求，输出一大篇散文。
 */
export async function aiVision(
  text: string,
  images: Array<{ url?: string; b64?: string; mime?: string }>,
  opts: {
    model?: string
    maxTokens?: number
    temperature?: number
    system?: string
    provider?: 'minimax-direct' | 'openclaw-gateway'
  } = {}
): Promise<string> {
  const content: any[] = []
  for (const img of images) {
    if (img.b64) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${img.mime || 'image/jpeg'};base64,${img.b64}` },
      })
    } else if (img.url) {
      content.push({ type: 'image_url', image_url: { url: img.url } })
    }
  }
  // 文本放最后（图片在前）
  content.push({ type: 'text', text })

  const messages: any[] = []
  if (opts.system) messages.push({ role: 'system', content: opts.system })
  messages.push({ role: 'user', content })

  return aiChat(messages, opts)
}

export const MODELS = {
  /** 主力：支持视觉，深度判断（实测能准确读图） */
  main: 'MiniMax-M3',
  /** 快档：支持视觉，用于批量粗筛（需 adaptive thinking） */
  fast: 'MiniMax-M3.1-Flash',
  /** 纯文本，**不支持图片** —— 只用于翻译/格式化类任务 */
  text: 'MiniMax-M2.7',
}

/**
 * 实测结论（2026-11-05，本机真实跑）
 *
 * 模型          看图    选品用?
 * M3            ✅      ✅ 主力
 * M3.1-Flash    ✅      ✅ 批量粗筛（需 thinking.type=adaptive）
 * M2.7          ❌      ❌ 会答"no image attached"
 * M2.5          ❌      ❌ 同上
 *
 * 视觉任务**必须**用 M3 / M3.1-Flash，其它模型会假装看了图然后瞎编。
 */
