import test from 'node:test'
import assert from 'node:assert/strict'
import { createFallbackModel } from '../src/model.mjs'

function mock(name, behavior) {
  return {
    name,
    calls: 0,
    async chat(messages, tools) {
      this.calls++
      return behavior.chat ? behavior.chat(messages, tools) : { text: name, toolCalls: [], raw: null }
    },
    async chatStream(messages, tools, onDelta, signal) {
      this.calls++
      if (behavior.stream) return behavior.stream(messages, tools, onDelta, signal)
      onDelta(name)
      return { text: name, toolCalls: [], raw: null }
    },
    async ping() { return [name] },
  }
}

test('fallback model uses primary when healthy', async () => {
  const p = mock('primary', { chat: async () => ({ text: 'ok', toolCalls: [], raw: null }) })
  const f = mock('fallback', { chat: async () => ({ text: 'fb', toolCalls: [], raw: null }) })
  const m = createFallbackModel(p, f)
  const r = await m.chat([], [])
  assert.equal(r.text, 'ok')
  assert.equal(p.calls, 1)
  assert.equal(f.calls, 0)
})

test('fallback model falls back on timeout/network error', async () => {
  const p = mock('primary', { chat: async () => { throw new Error('timeout after 180000ms') } })
  const f = mock('fallback', { chat: async () => ({ text: 'from-fallback', toolCalls: [], raw: null }) })
  const m = createFallbackModel(p, f)
  const r = await m.chat([], [])
  assert.equal(r.text, 'from-fallback')
  assert.equal(r.fallbackFrom, 'primary')
  assert.equal(p.calls, 1)
  assert.equal(f.calls, 1)
})

test('fallback model does not fallback on non-retryable error', async () => {
  const p = mock('primary', { chat: async () => { throw new Error('bad request 400') } })
  const f = mock('fallback', { chat: async () => ({ text: 'fb', toolCalls: [], raw: null }) })
  const m = createFallbackModel(p, f)
  await assert.rejects(() => m.chat([], []), /bad request 400/)
  assert.equal(f.calls, 0)
})

test('fallback model stream falls back only before output', async () => {
  const p = mock('primary', { stream: async () => { throw new Error('network error') } })
  const f = mock('fallback', { stream: async (m,t,onDelta) => { onDelta('fb'); return { text: 'fb', toolCalls: [], raw: null } } })
  const m = createFallbackModel(p, f)
  const r = await m.chatStream([], [], () => {})
  assert.equal(r.text, 'fb')
  assert.equal(f.calls, 1)
})

test('fallback model stream does not fallback after partial output', async () => {
  const p = mock('primary', { stream: async (m,t,onDelta) => { onDelta('partial'); throw new Error('network error') } })
  const f = mock('fallback', { stream: async (m,t,onDelta) => { onDelta('fb'); return { text: 'fb', toolCalls: [], raw: null } } })
  const m = createFallbackModel(p, f)
  await assert.rejects(() => m.chatStream([], [], () => {}), /network error/)
  assert.equal(f.calls, 0)
})
