import { atom, read, update } from 'claude-code'
import type { EngineInterface as Dollar, Register, SessionMessage, ThemeSetArgs } from 'claude-code'

import type { StyleKey } from '../types'
import { makeColors } from './make-colors.js'
import { STYLES, buildScene, heatColor, heatFromPercent, mix } from './scenes.js'
import { thumbsFrom } from './thumbs'

const P = 'event-horizon'
const KEYS = Object.keys(STYLES) as StyleKey[]
const DEFAULT_STYLE: StyleKey = 'space'

const pctAtom = atom({ plugin: 'event-horizon', key: 'pct' } as const, null)
const testAtom = atom({ plugin: 'event-horizon', key: 'test' } as const, null)
const thumbsAtom = atom({ plugin: 'event-horizon', key: 'thumbs' } as const, null)
const seedAtom = atom({ plugin: 'event-horizon', key: 'seed' } as const, 0)
const cometAtom = atom({ plugin: 'event-horizon', key: 'cometAt' } as const, null)
const COMET_CYCLE_MS = 95000
const styleAtom = atom({ plugin: 'event-horizon', key: 'style' } as const, DEFAULT_STYLE)
const onAtom = atom({ plugin: 'event-horizon', key: 'isOn' } as const, true)

const isStyle = (v: unknown): v is StyleKey => typeof v === 'string' && (KEYS as string[]).includes(v)

const stageOf = (pct: number) =>
  pct >= 90 ? 'critical' : pct >= 75 ? 'hot' : pct >= 50 ? 'warming' : 'calm'

/** The whole look for one style at one heat. Only the accent family and surfaces move with heat. */
export function lookFor(style: StyleKey, heat: number): { look: ThemeSetArgs; problems: string[] } {
  const s = STYLES[style]
  // surfaces take the style's hue, and pick up a little ember as heat rises
  const base = mix(mix(s.bg1, '#000000', 0.1), '#2a0707', heat * 0.45)
  const surf = (k: number) => mix(mix(base, s.a, 0.022 * k), '#ffffff', 0.028 * k)
  const { theme, problems } = makeColors({
    label: `${STYLES[style].name} (${P})`,
    only: 'dark',
    roles: {
      accent: heatColor(s.a, heat),
      pro: heatColor(s.b, heat * 0.9),
      danger: '#ff4d5e',
      success: '#3ddc84',
      warning: '#ffb020',
    },
    dark: {
      gray: {
        anchors: {
          'surface-0': base,
          'surface-1': surf(1),
          'surface-2': surf(2),
          'surface-3': surf(2.6),
          'text-primary': mix('#eef1f6', s.a, 0.05),
          'text-secondary': mix('#c5ccd7', s.a, 0.07),
          'text-muted': mix('#a3acba', s.a, 0.08),
        },
      },
    },
  })
  return {
    problems,
    look: {
      colors: theme,
      overrideColorScheme: 'dark',
      backdrop: { scene: style, glass: { blur: 14, tint: base, opacity: 0.5 } },
    },
  }
}

// The last look sent, so a fill that doesn't move the colour isn't re-sent.
let sentKey = ''

async function effectivePct($: Dollar) {
  return (await read($, testAtom)) ?? (await read($, pctAtom))
}

async function applyLook($: Dollar, force = false) {
  if (!(await read($, onAtom))) return
  const style = await read($, styleAtom)
  const pct = await effectivePct($)
  const heat = heatFromPercent(pct)
  // 2.5% heat steps: fine enough to read as a smooth drift, coarse enough to not spam sets
  const key = `${style}:${Math.round(heat * 40)}`
  if (key === sentKey && !force) return
  sentKey = key
  const { look, problems } = lookFor(style, Math.round(heat * 40) / 40)
  const blocker = problems.find(line => line.startsWith("Desktop won't paint"))
  if (blocker !== undefined) $.ui.log(blocker)
  try {
    const set = await $.theme.set(look)
    if (!set.isDrawn) $.ui.log(`theme not drawn: ${set.reason}`)
  } catch (error) {
    $.ui.log(String(error))
  }
}

async function showStatus($: Dollar) {
  const pct = await effectivePct($)
  const isTest = (await read($, testAtom)) !== null
  if (pct == null) {
    $.ui.status('Context --')
    return
  }
  const stage = stageOf(pct)
  $.ui.status(`Context ${Math.round(pct)}%${stage === 'calm' ? '' : ` - ${stage}`}${isTest ? ' (test)' : ''}`)
}

async function measure($: Dollar) {
  try {
    const usage = await $.session.usage({ breakdown: 'summary' })
    await update($, pctAtom, () => usage.context.percent ?? null)
    const found: unknown = await $.session.messages({ last: 80 })
    const messages = Array.isArray(found) ? (found as SessionMessage[]) : []
    await update($, thumbsAtom, () => thumbsFrom(messages, usage.context.breakdown))
    await update($, seedAtom, () => messages.length)
  } catch (error) {
    $.ui.log(`usage: ${String(error)}`)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'backdrop',
      description: 'Switch backdrop (space, rain, grid, circuit, radar, plasma), or: comet | test <0-100> | test off | off | on',
    })
    const stored = await $.store.get('style')
    if (isStyle(stored)) await update($, styleAtom, () => stored)
    const storedOn = await $.store.get('isOn')
    if (storedOn === false) await update($, onAtom, () => false)
    await measure($)
    await applyLook($, true)
    await showStatus($)
    return result
  })

  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    if (e.changed.includes('context')) {
      await update($, pctAtom, () => e.context.percent ?? null)
      await showStatus($)
      await applyLook($)
      await measure($)
    }
    return result
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.plugin !== P) {
      return next(e)
    }
    const style = isStyle(e.props.scene) ? e.props.scene : await read($, styleAtom)
    const pct = await effectivePct($)
    const thumbs = await read($, thumbsAtom)
    const seed = await read($, seedAtom)
    // after /backdrop comet, align the comet's cycle so it crossed at that moment
    const cometAt = await read($, cometAtom)
    const since = cometAt === null ? null : (await $.clock.now()) - cometAt
    const cometDelay = since !== null && since < COMET_CYCLE_MS ? -since / 1000 : undefined
    const { Svg } = $.ui.resolve(e)
    const source = buildScene(style, heatFromPercent(pct), {
      pct: pct ?? 0,
      seed,
      ...(cometDelay !== undefined ? { cometDelay } : {}),
      // never the preview's example cards: only what this conversation really holds
      thumbs: thumbs ?? [],
    })
    const alt =
      style === 'space'
        ? `A black hole feeding on thumbnails of this conversation, among constellations, ${Math.round(pct ?? 0)}% full`
        : `${STYLES[style].name} backdrop, context ${Math.round(pct ?? 0)}% full`
    return <Svg source={source} alt={alt} isInteractive />
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const pct = await effectivePct($)
    if (e.props.hasSurvey || pct == null || pct < 90) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text color="error" weight="bold">
          Context {Math.round(pct)}% full.{' '}
        </Text>
        <Text dimColor>Older turns will be summarized soon. </Text>
        <Button
          key="compact"
          label="Compact now"
          onPress={async () => {
            await $.session.compact()
          }}
        />
      </Box>
    )
  })

  on('command.run', { command: 'backdrop' }, async ($, e) => {
    const [word = '', arg = ''] = e.args.trim().toLowerCase().split(/\s+/)
    const list = KEYS.map(k => `${k} (${STYLES[k].name})`).join(', ')

    if (word === '') {
      const style = await read($, styleAtom)
      return { text: `Backdrop: ${STYLES[style].name}. Styles: ${list}. Also: /backdrop comet, test <0-100>, test off, off, on.` }
    }
    if (isStyle(word)) {
      await update($, styleAtom, () => word)
      await $.store.set('style', word)
      await update($, onAtom, () => true)
      await $.store.set('isOn', true)
      await applyLook($, true)
      return { text: `Backdrop set to ${STYLES[word].name}.` }
    }
    if (word === 'test') {
      if (arg === 'off' || arg === '') {
        await update($, testAtom, () => null)
        await applyLook($)
        await showStatus($)
        return { text: 'Test fill cleared; showing the real context fill.' }
      }
      const n = Number(arg)
      if (!Number.isFinite(n) || n < 0 || n > 100) return { text: 'Give a fill from 0 to 100, e.g. /backdrop test 92.' }
      await update($, testAtom, () => n)
      await applyLook($)
      await showStatus($)
      return { text: `Simulating ${n}% context fill. /backdrop test off to stop.` }
    }
    if (word === 'comet') {
      if ((await read($, styleAtom)) !== 'space') return { text: 'The comet flies in the space backdrop: /backdrop space first.' }
      const now = await $.clock.now()
      await update($, cometAtom, () => now)
      return { text: 'Comet incoming: it crosses the top of the sky over the next ~12 seconds.' }
    }
    if (word === 'off') {
      await update($, onAtom, () => false)
      await $.store.set('isOn', false)
      sentKey = ''
      await $.theme.clear()
      return { text: 'Backdrop and theme off. /backdrop on to bring them back.' }
    }
    if (word === 'on') {
      await update($, onAtom, () => true)
      await $.store.set('isOn', true)
      await applyLook($, true)
      return { text: 'Backdrop on.' }
    }
    return { text: `Unknown option "${word}". Styles: ${list}.` }
  })
}
