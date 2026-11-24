import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveInside, resolveAllowedPath, defaultAllowedRoots } from '../src/sandbox.mjs'
import { Skills } from '../src/skills.mjs'
import { Memory } from '../src/memory.mjs'
import { Tools } from '../src/tools.mjs'
import { createMockModel } from '../src/model.mjs'
import { runAgent, compact, buildSystemPrompt } from '../src/loop.mjs'
import { loadConfig } from '../src/config.mjs'
import { parseUiIntent, parsePlacement } from '../src/voice/intents.mjs'
import { RealtimeSessions } from '../src/voice/realtime.mjs'

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'la-test-'))
}

test('sandbox не пускает за пределы root', () => {
  const root = tmp()
  assert.equal(resolveInside(root, 'a/b.txt'), path.join(root, 'a/b.txt'))
  assert.throws(() => resolveInside(root, '../outside.txt'))
  assert.throws(() => resolveInside(root, path.join(root, '..', 'x.txt')))
})

test('sandbox three-zone: разрешённые корни и path traversal', () => {
  const root = tmp()
  const data = path.join(root, 'data')
  fs.mkdirSync(data, { recursive: true })
  const roots = [root, data, path.join(os.tmpdir(), 'shevagent-allowed')]
  assert.equal(resolveAllowedPath('a/b.txt', { roots }), path.join(root, 'a/b.txt'))
  assert.equal(resolveAllowedPath(path.join(data, 'mem.json'), { roots }), path.join(data, 'mem.json'))
  const t = path.join(os.tmpdir(), 'shevagent-allowed', 'x.txt')
  assert.equal(resolveAllowedPath(t, { roots }), path.normalize(t))
  // path traversal и выход вне разрешённых зон
  assert.throws(() => resolveAllowedPath('../escape.txt', { roots }))
  assert.throws(() => resolveAllowedPath(path.join(root, '..', '..', 'evil.txt'), { roots }))
  const outside = path.join(path.parse(root).root, 'shevagent-outside-zone.txt')
  assert.throws(() => resolveAllowedPath(outside, { roots }))
  assert.equal(resolveAllowedPath(outside, { roots, allowOutside: true }), path.normalize(outside))
})

test('skills парсит frontmatter и загружает тело', () => {
  const dir = tmp()
  const skillDir = path.join(dir, 'demo')
  fs.mkdirSync(skillDir)
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: Demo\ndescription: тестовый навык\n---\n\nИнструкция')
  const skills = new Skills([dir])
  assert.equal(skills.list()[0].id, 'demo')
  assert.equal(skills.list()[0].description, 'тестовый навык')
  assert.match(skills.load('demo'), /Инструкция/)
  assert.throws(() => skills.load('нет'))
})

test('memory сохраняет и ищет факты', () => {
  const dir = tmp()
  const m = new Memory(dir, 't1')
  m.remember('пользователь предпочитает TypeScript для агентов')
  assert.equal(m.recall('TypeScript').length, 1)
  m.append('tool', 'read package.json')
  assert.equal(m.recent(5).length, 1)
})

test('tools: grep и write работают в песочнице', async () => {
  const root = tmp()
  const cfg = loadConfig(root, { root: '.' })
  cfg.rootAbs = path.resolve(root)
  const skills = new Skills([])
  const memory = new Memory(path.join(root, 'data'), 't')
  const tools = new Tools(cfg, skills, memory)
  const w = await tools.execute('write', { path: 'a.txt', content: 'hello world\nneedle here' })
  assert.equal(w.ok, true)
  const g = await tools.execute('grep', { pattern: 'needle', limit: 5 })
  assert.equal(g.matches.length, 1)
  // вне всех разрешённых зон — должно блокироваться
  const outside = path.join(path.parse(root).root, 'shevagent-test-escape-nope.txt')
  const bad = await tools.execute('write', { path: outside, content: 'x' })
  assert.equal(bad.ok, false)
  // внутри выделенного shevagent temp — допустимо
  const shevTmp = path.join(os.tmpdir(), 'shevagent')
  fs.mkdirSync(shevTmp, { recursive: true })
  const inTmp = path.join(shevTmp, 'sandbox-ok-' + Date.now() + '.txt')
  const okTmp = await tools.execute('write', { path: inTmp, content: 'ok' })
  assert.equal(okTmp.ok, true)
  try { fs.unlinkSync(inTmp) } catch {}
})

test('loop проходит цикл tool call → финальный текст', async () => {
  const root = tmp()
  const cfg = loadConfig(root)
  cfg.rootAbs = path.resolve(root)
  const skills = new Skills([])
  const memory = new Memory(path.join(root, 'data'), 't')
  const tools = new Tools(cfg, skills, memory)
  const model = createMockModel([
    { toolCalls: [{ name: 'write', args: { path: 'x.txt', content: 'ok' } }] },
    { text: 'Файл создан' },
  ])
  const r = await runAgent({ task: 'создай файл', cfg, model, tools, skills, memory })
  assert.match(r.text, /Файл создан/)
  assert.equal(r.toolCalls, 1)
  assert.equal(fs.readFileSync(path.join(root, 'x.txt'), 'utf8'), 'ok')
})

test('compact сжимает длинную историю', () => {
  const msgs = [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'a'.repeat(200) },
    { role: 'assistant', content: 'b'.repeat(200) },
    { role: 'tool', content: 'c'.repeat(200) },
    { role: 'assistant', content: 'd'.repeat(200) },
    { role: 'user', content: 'последнее' },
  ]
  const before = msgs.length
  const res = compact(msgs, 100)
  assert.ok(res)
  assert.ok(res === true || res.compacted === true)
  assert.ok(msgs.length < before)
  assert.match(msgs[1].content, /СЖАТИЕ/)
})

test('intents: тема, очистка и блоки распознаются детерминированно', () => {
  const theme = parseUiIntent('Смени оформление на аврора')
  assert.deepEqual(theme.calls, [{ name: 'ui_settings', args: { theme: 'aurora' } }])

  const ember = parseUiIntent('сделай тему ember')
  assert.equal(ember.calls[0].args.theme, 'ember')

  const clear = parseUiIntent('убери все блоки с экрана')
  assert.deepEqual(clear.calls, [{ name: 'ui_clear', args: {} }])

  const clock = parseUiIntent('покажи часы')
  assert.equal(clock.calls[0].args.type, 'clock')

  const weather = parseUiIntent('покажи погоду в Казани')
  assert.equal(weather.calls[0].args.type, 'weather')
  assert.equal(weather.calls[0].args.location, 'Казань')

  const progress = parseUiIntent('покажи прогресс 75% с подписью Прогресс')
  assert.equal(progress.calls[0].args.percent, 75)

  const combo = parseUiIntent('смени тему на аврора и убери все блоки')
  assert.equal(combo.calls.length, 2)

  const many = parseUiIntent('покажи часы, погоду в Москве и полосу прогресса 60%')
  assert.equal(many.calls.length, 3)
  assert.deepEqual(many.calls.map((c) => c.args.type).sort(), ['clock', 'progress', 'weather'])

  const note = parseUiIntent('добавь заметку: не забыть про документы')
  assert.equal(note.calls[0].args.type, 'note')
  assert.match(note.calls[0].args.text, /документы/)

  const mem = parseUiIntent('Меня зовут Марина. Запомни это.')
  assert.equal(mem.calls[0].name, 'remember')
  assert.match(mem.calls[0].args.text, /Марина/)

  assert.equal(parsePlacement('сверху'), 'top')
  assert.equal(parsePlacement('над чатом'), 'top')
  assert.equal(parsePlacement('снизу'), 'bottom')
  assert.equal(parsePlacement('под чатом'), 'bottom')
  assert.equal(parsePlacement('покажи часы'), null)

  assert.equal(parseUiIntent('как дела?'), null)
  assert.equal(parseUiIntent('какая тема сейчас?'), null)
})

test('system prompt содержит список инструментов и навыков', () => {
  const skills = new Skills([])
  const p = buildSystemPrompt(loadConfig(tmp()), skills)
  assert.match(p, /load_skill/)
  assert.match(p, /НАВЫКИ/)
})

test('realtime: часы и погода ставятся сразу, перемещение понимаетлево/право/посередине', async () => {
  const dir = tmp()
  const executed = []
  const widgetState = new Map()
  const getList = (key = 'placement-test') => [...(widgetState.get(key) || [])]
  const setList = (key, list) => widgetState.set(key, list)
  const widgets = {
    get(key = 'placement-test') { return { widgets: getList(key), settings: { layout: 'free' } } },
  }
  const tools = {
    widgets,
    async visibleWidgets(key = 'placement-test') { return getList(key) },
    execute: async (name, args) => {
      executed.push({ name, args })
      const key = 'placement-test'
      const list = getList(key)
      if (name === 'ui_set') {
        const i = list.findIndex((w) => w.id === args.id)
        const w = { id: args.id, type: args.type, title: args.title || args.type, placement: args.placement || 'top', text: args.text || '', ...args }
        if (i >= 0) list[i] = { ...list[i], ...w }
        else list.push(w)
        setList(key, list)
        return { ok: true, widget: w }
      }
      if (name === 'ui_move') {
        const i = list.findIndex((w) => w.id === args.id)
        if (i < 0) return { ok: false, moved: false }
        list[i] = { ...list[i], placement: args.placement }
        setList(key, list)
        return { ok: true, moved: true }
      }
      if (name === 'ui_list') return { widgets: getList(key) }
      if (name === 'ui_snapshot') return { widgets: getList(key) }
      return { ok: true }
    },
  }
  const sessions = new RealtimeSessions(
    { projectDir: dir, limits: { maxSteps: 1, contextChars: 26000 } },
    createMockModel(), tools, new Skills([]), null,
  )
  const collect = async (text, id) => {
    const events = []
    await sessions.stream({ id, text, conversationId: 'placement-test', onEvent: (e) => events.push(e) }).next()
    return events
  }

  const clocks = await collect('покажи часы', 'p1')
  const clockReply = clocks.find((e) => e.type === 'delta')?.text || clocks.find((e) => e.type === 'done')?.text || ''
  assert.match(clockReply, /часы|время|экран/i)
  const clockSet = executed.find((c) => c.name === 'ui_set' && c.args?.type === 'clock')
  assert.ok(clockSet, 'ожидался ui_set для часов')
  assert.equal(clockSet.args.placement, 'top')

  for (const [phrase, placement] of [
    ['перемести погоду справа', 'top-right'],
    ['перемести погоду слева', 'top-left'],
    ['перемести погоду посередине', 'top'],
    ['перемести погоду вниз слева', 'bottom-left'],
  ]) {
    const before = executed.length
    const events = await collect(phrase, `p-${placement}`)
    const done = events.find((e) => e.type === 'done')
    assert.ok(done, `нет события done для «${phrase}»`)
    const call = [...executed.slice(before)].reverse().find((c) => c.name === 'ui_move')
    assert.ok(call, `«${phrase}» должно быть ui_move`)
    assert.equal(call.args.placement, placement, `«${phrase}» → ${placement}`)
  }
})
