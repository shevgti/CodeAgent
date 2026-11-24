import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { parseRepoUrl, loadGithubAliases } from '../src/github-sync.mjs'

test('github-sync: разбирает только публичные GitHub-URL', () => {
  assert.deepEqual(parseRepoUrl('https://github.com/shevgti/CodeAgent'), {
    owner: 'shevgti', repo: 'CodeAgent', slug: 'shevgti__codeagent',
  })
  assert.deepEqual(parseRepoUrl('https://github.com/shevgti/CodeAgent.git'), {
    owner: 'shevgti', repo: 'CodeAgent', slug: 'shevgti__codeagent',
  })
  assert.equal(parseRepoUrl('git@github.com:shevgti/CodeAgent.git'), null)
  assert.equal(parseRepoUrl('https://gitlab.com/shevgti/CodeAgent'), null)
  assert.equal(parseRepoUrl(''), null)
})

test('github-sync: поднимает алиасы из уже скачанного манифеста', () => {
  const aliases = loadGithubAliases(process.cwd())
  const byName = new Map(aliases.map((a) => [a.name, a]))
  assert.equal(byName.get('gh_problem_calc')?.alias, 'calc')
  assert.equal(byName.get('gh_problem_test')?.alias, 'npm_test')
  assert.equal(byName.get('gh_problem_search')?.alias, 'web_search')
  assert.equal(byName.get('gh_problem_calc')?.parameters.properties.expr.type, 'string')
})

test('github-sync: манифест не содержит произвольных команд', () => {
  for (const a of loadGithubAliases(process.cwd())) {
    assert.ok(/^[a-z0-9_]+$/i.test(a.name))
    assert.ok(/^[a-z0-9_]+$/i.test(a.alias))
  }
})
