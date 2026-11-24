import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSystemPrompt } from '../src/loop.mjs'
import { loadConfig } from '../src/config.mjs'
import { Skills } from '../src/skills.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'shev-beh-'))
}

test('buildSystemPrompt forbids canned greeting templates', () => {
  const dir = tmp()
  const skills = new Skills([path.join(dir, 'skills')], path.join(dir, 'learned'))
  const p = buildSystemPrompt(loadConfig(dir), skills, '', 'привет')
  assert.match(p, /Чем могу помочь сегодня\?/i)
  assert.match(p, /по-живому и по-разному/i)
  assert.match(p, /не бот поддержки/i)
})

test('buildSystemPrompt keeps UI verification rules', () => {
  const dir = tmp()
  const skills = new Skills([path.join(dir, 'skills')], path.join(dir, 'learned'))
  const p = buildSystemPrompt(loadConfig(dir), skills)
  assert.match(p, /ui_snapshot/i)
  assert.match(p, /НИКОГДА не пиши «сделано»/i)
})
