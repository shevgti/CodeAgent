import test from 'node:test'
import assert from 'node:assert/strict'
import { parseUiIntent, parsePlacement } from '../src/voice/intents.mjs'

test('intents: github/internet не перехватываются как экран', () => {
  assert.equal(parseUiIntent('зайди на github посмотри что там'), null)
  assert.equal(parseUiIntent('Зайди на github Посмотри как у меня там дела'), null)
  assert.equal(parseUiIntent('выйди в интернет можешь?'), null)
  assert.equal(parseUiIntent('открой гугл и найди погоду'), null)
})

test('intents: вопросы про экран распознаются', () => {
  assert.equal(parseUiIntent('что на экране?')?.calls?.[0]?.name, 'ui_snapshot')
  assert.equal(parseUiIntent('что там в блоках?')?.calls?.[0]?.name, 'ui_list')
})

test('placement: правый верхний угол', () => {
  assert.equal(parsePlacement('поставь в правый верхний угол'), 'top-right')
  assert.equal(parsePlacement('в правый угол'), 'top-right')
  assert.equal(parsePlacement('слева внизу'), 'bottom-left')
})

test('intents: погодный виджет не перехватывает веб-поиск', () => {
  assert.equal(parseUiIntent('загугли погоду в москве'), null)
  assert.equal(parseUiIntent('найди в интернете прогноз погоды'), null)
})

test('intents: локальная погода остаётся виджетом', () => {
  const r = parseUiIntent('покажи погоду в Москве')
  assert.equal(r?.calls?.[0]?.name, 'ui_set')
  assert.equal(r?.calls?.[0]?.args?.type, 'weather')
})

test('intents: время в правый верхний угол', () => {
  const r = parseUiIntent('поставь время в правый верхний угол')
  assert.equal(r?.calls?.[0]?.name, 'ui_set')
  assert.equal(r?.calls?.[0]?.args?.placement, 'top-right')
  assert.equal(r?.calls?.[0]?.args?.type, 'clock')
})

test('intents: smalltalk/greetings are not UI intents', () => {
  assert.equal(parseUiIntent('привет'), null)
  assert.equal(parseUiIntent('Привет, как дела?'), null)
  assert.equal(parseUiIntent('как дела с твоими настройками'), null)
  assert.equal(parseUiIntent('расскажи анекдот'), null)
})

test('intents: chat/link formatting is not UI color intent', () => {
  assert.equal(parseUiIntent('сделай её как ссылку синего цвета чтобы на неё можно было нажать и переместиться на сайт'), null)
  assert.equal(parseUiIntent('сделай эту ссылку красной'), null)
})

test('intents: memory/skills/web questions are not UI intents', () => {
  assert.equal(parseUiIntent('Зайди в свою память найди там папки какие-то например там будет написано инструменты по-английски или навыки'), null)
  assert.equal(parseUiIntent('посмотри какие у тебя есть навыки и инструменты'), null)
  assert.equal(parseUiIntent('а у тебя есть память'), null)
  assert.equal(parseUiIntent('Выйди в интернет в Google на в поиске Посмотри как выглядит ссылки'), null)
})

test('intents: resize widget by type', () => {
  const r = parseUiIntent('увеличь виджет таймера')
  assert.equal(r?.calls?.[0]?.name, 'ui_resize')
  assert.equal(r?.calls?.[0]?.args?.id, 'timer')
  assert.equal(r?.calls?.[0]?.args?.delta, 0.2)
})

test('intents: shrink clock widget', () => {
  const r = parseUiIntent('уменьши виджет часов')
  assert.equal(r?.calls?.[0]?.name, 'ui_resize')
  assert.equal(r?.calls?.[0]?.args?.id, 'clock')
  assert.equal(r?.calls?.[0]?.args?.delta, -0.2)
})

test('intents: hide weather widget', () => {
  const r = parseUiIntent('спрячь виджет погоды')
  assert.equal(r?.calls?.[0]?.name, 'ui_hide')
  assert.equal(r?.calls?.[0]?.args?.id, 'weather')
})

test('intents: show all widgets', () => {
  const r = parseUiIntent('покажи все виджеты')
  assert.equal(r?.calls?.[0]?.name, 'ui_show')
  assert.equal(r?.calls?.[0]?.args?.all, true)
})

test('intents: relative move down', () => {
  const r = parseUiIntent('сдвинь часы чуть ниже')
  assert.equal(r?.calls?.[0]?.name, 'ui_move')
  assert.equal(r?.calls?.[0]?.args?.id, 'clock')
  assert.ok((r?.calls?.[0]?.args?.dy || 0) > 0)
})

test('intents: resize numbered widget', () => {
  const r = parseUiIntent('увеличь 1 виджет')
  assert.equal(r?.calls?.[0]?.name, 'ui_resize')
  assert.equal(r?.calls?.[0]?.args?.id, '1')
  assert.equal(r?.calls?.[0]?.args?.delta, 0.2)
})

test('intents: resize ordinal widget', () => {
  const r = parseUiIntent('уменьши первый виджет')
  assert.equal(r?.calls?.[0]?.name, 'ui_resize')
  assert.equal(r?.calls?.[0]?.args?.id, '1')
  assert.equal(r?.calls?.[0]?.args?.delta, -0.2)
})
