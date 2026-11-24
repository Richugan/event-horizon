import type { SessionContextBreakdown } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { buildScene, heatColor, heatFromPercent, holeRadius, sampleThumbs } from '../hooks/scenes.js'
import { labelOf, shapeOf, thumbsFrom } from '../hooks/thumbs'

const BREAKDOWN = {
  categories: [
    { name: 'System prompt', tokens: 4000, color: 'x', isDeferred: false, kind: 'used' },
    { name: 'System tools', tokens: 12000, color: 'x', isDeferred: false, kind: 'used' },
    { name: 'Memory files', tokens: 3000, color: 'x', isDeferred: false, kind: 'used' },
    { name: 'Messages', tokens: 50000, color: 'x', isDeferred: false, kind: 'used' },
    { name: 'Free space', tokens: 131000, color: 'x', isDeferred: false, kind: 'free' },
  ],
  totalTokens: 69000,
  maxTokens: 200000,
  rawMaxTokens: 200000,
} as const

const BAND = {
  hasSurvey: false,
  isCollapsed: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
} as const

function usageAt(percent: number) {
  return {
    startedAt: 0,
    rateLimits: [],
    context: { tokens: percent * 2000, window: 200000, percent, breakdown: BREAKDOWN as unknown as SessionContextBreakdown },
  }
}

test('heat rises continuously, with no jump at the stage edges', () => {
  let last = -1
  for (let p = 0; p <= 100; p += 0.25) {
    const h = heatFromPercent(p)
    expect(h).toBeGreaterThanOrEqual(last)
    // a quarter-percent step never moves heat by more than ~1%
    if (last >= 0) expect(h - last).toBeLessThan(0.01)
    last = h
  }
  expect(heatFromPercent(50)).toBe(0)
  expect(heatFromPercent(100)).toBe(1)
  // the stages land on the colours asked for: amber at 75, orange-red at 90, red at 100
  expect(heatColor('#2fe3ff', heatFromPercent(75))).toBe('#ffb020')
  expect(heatColor('#2fe3ff', heatFromPercent(90))).toBe('#ff5a1f')
})

test('the black hole grows with the fill', () => {
  expect(holeRadius(80)).toBeGreaterThan(holeRadius(40))
  expect(holeRadius(40)).toBeGreaterThan(holeRadius(0))
})

const MESSAGES = [
  { role: 'user', text: 'Fix the refund totals please', toolUses: [] },
  {
    role: 'assistant',
    text: 'Looking at the export first.',
    toolUses: [{ tool_use_id: 't1', tool: 'Read', input: { file_path: '/repo/api/export.php' } }],
  },
  { role: 'user', text: '', toolUses: [], toolResults: [{ tool_use_id: 't1', text: 'line one\nline two\nline three', isError: false }] },
  { role: 'user', text: '<system-reminder>ignore me</system-reminder>', toolUses: [] },
  { role: 'assistant', text: 'Here is the fix:\n```php\nif ($x) {\n  return 1;\n}\n```', toolUses: [] },
] as const

test('thumbnails follow the conversation, oldest first, with real labels', () => {
  const t = thumbsFrom(MESSAGES as never, BREAKDOWN as never)
  const convo = t.filter(x => x.kind !== 'doc' && x.label !== 'SYSTEM PROMPT' && x.label !== 'TOOLS')
  expect(convo.map(x => x.kind)).toEqual(['user', 'chat', 'tool', 'code'])
  expect(convo[0]?.label).toBe(labelOf('Fix the refund totals please'))
  // the tool card is named after the file it read, and shaped like its 3-line result
  expect(convo[2]?.label).toBe('READ EXPORT.PHP')
  expect(convo[2]?.lines.length).toBe(3)
  // the code card keeps its indent: the line inside the block sits one step in
  expect(convo[3]?.indents).toEqual([0, 0, 1, 0])
  // what loads at the start comes before the conversation
  expect(t[0]?.label).toBe('SYSTEM PROMPT')
})

test('a line is as long as its text, up to a full line', () => {
  const s = shapeOf('x'.repeat(23) + '\n' + 'y'.repeat(200))
  expect(s.lines[0]).toBe(0.5)
  // 200 characters at 46 a line: four full lines, then the rest
  expect(s.lines.slice(1)).toEqual([1, 1, 1, 1, Math.round(((200 - 4 * 46) / 46) * 100) / 100])
  expect(labelOf('héllo **wörld**')).toBe('H LLO W RLD')
})

test('every scene stays inside the size limit and pure vector at any fill', () => {
  for (const kind of ['space', 'rain', 'grid', 'circuit', 'radar', 'plasma'] as const) {
    for (const pct of [0, 60, 85, 100]) {
      const svg = buildScene(kind, heatFromPercent(pct), { pct, thumbs: kind === 'space' ? sampleThumbs(100).concat(sampleThumbs(100)) : undefined })
      expect(svg.length).toBeLessThan(131072)
      expect(svg).not.toMatch(/<image|<use|href|<text|<script/)
    }
  }
})

test('the backdrop draws on desktop, and the warning band shows past 90%', async ($, on) => {
  const looks: unknown[] = []
  on('command.register', () => ({ value: { command: 'backdrop' } }))
  on('theme.set', (_, e) => {
    looks.push(e)
    return { value: { isDrawn: true, requestId: 'r1' } }
  })
  on('session.usage', () => ({ value: usageAt(42) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const store = new Map<string, unknown>()
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => (store.set(e.key, e.value), { value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(looks.length).toBe(1)

  const bd = await $.ui.mount({
    plugin: 'event-horizon',
    surface: 'desktop',
    component: 'Backdrop',
    props: { scene: 'space', plugin: 'event-horizon', glass: { blur: 14, tint: '#000000', opacity: 0.5 } },
  })
  const svg = await bd.find({ type: 'Svg' })
  expect(svg).toBeDefined()
  await bd.unmount()

  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'event-horizon', surface, component: 'AbovePrompt', props: BAND })
    expect(await band.find({ type: 'Text', text: /full/ })).toBeUndefined()
    await band.unmount()
  }

  await $.command.run({
    command: 'backdrop',
    args: 'test 95',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'event-horizon', surface, component: 'AbovePrompt', props: BAND })
    expect((await band.find({ type: 'Text', text: /full/ }))?.text).toContain('95%')
    await band.unmount()
  }
  // the hot look went out with a red-shifted theme
  expect(looks.length).toBe(2)
})
