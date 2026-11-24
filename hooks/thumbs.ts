import type { SessionContextBreakdown, SessionMessage } from 'claude-code'

import type { Thumb } from '../types'
import { FONT_CHARS } from './scenes.js'

// Characters the scene's stroke font can draw; anything else becomes a space.
const DRAWABLE = new Set([...FONT_CHARS, ' '])
const WRAP = 46 // characters in a full thumbnail line
const MAX_LINES = 6
const MAX_ITEMS = 44

export function labelOf(text: string, max = 16): string {
  const flat = text
    .replace(/[`*#>_[\]{}|~^$\\"]/g, ' ')
    .toUpperCase()
    .split('')
    .map(c => (DRAWABLE.has(c) ? c : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  return flat.slice(0, max).trim()
}

const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path

/**
 * The silhouette of a text: its first lines, wrapped as a thumbnail would wrap them,
 * each as a fraction of a full line. Lines in a fenced block keep their indent.
 */
export function shapeOf(text: string): { lines: number[]; indents?: number[]; hasCode: boolean } {
  const lines: number[] = []
  const indents: number[] = []
  let inFence = false
  let hasCode = false
  for (const raw of text.split('\n')) {
    if (lines.length >= MAX_LINES) break
    if (/^\s*```/.test(raw)) {
      inFence = !inFence
      hasCode = true
      continue
    }
    const trimmed = raw.trimEnd()
    if (trimmed.trim() === '') continue
    const indent = inFence ? Math.floor((trimmed.length - trimmed.trimStart().length) / 2) : 0
    let rest = trimmed.trim().length
    // a long paragraph wraps into several thumbnail lines
    while (rest > 0 && lines.length < MAX_LINES) {
      lines.push(Math.round(Math.min(1, rest / WRAP) * 100) / 100)
      indents.push(indent)
      rest -= WRAP
    }
  }
  if (lines.length === 0) lines.push(0.3)
  return hasCode ? { lines, indents, hasCode } : { lines, hasCode }
}

// A tool call's label: the tool and what it touched, as a person would name it.
export function toolLabel(tool: string, input: Record<string, unknown>): string {
  const str = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '')
  const path = str('file_path') || str('path') || str('notebook_path')
  if (path) return labelOf(`${tool} ${basename(path)}`)
  if (str('command')) return labelOf(`${tool} ${str('command')}`)
  if (str('pattern')) return labelOf(`${tool} ${str('pattern')}`)
  if (str('url')) return labelOf(`${tool} ${str('url').replace(/^https?:\/\//, '')}`)
  if (str('description')) return labelOf(`${tool} ${str('description')}`)
  return labelOf(tool)
}

/** The context as thumbnails, oldest first: what loads at the start, then the conversation. */
export function thumbsFrom(messages: readonly SessionMessage[], breakdown?: SessionContextBreakdown): Thumb[] {
  const fixed: Thumb[] = []
  for (const file of breakdown?.memoryFiles ?? []) {
    // no need to read the file: its size sets the length of the silhouette
    const n = Math.max(2, Math.min(MAX_LINES, Math.round(file.tokens / 400)))
    fixed.push({ kind: 'doc', label: labelOf(basename(file.path)), lines: Array.from({ length: n }, (_, i) => (i % 3 === 2 ? 0.55 : 0.92)) })
  }
  const used = (breakdown?.categories ?? []).filter(c => c.kind === 'used')
  if (used.some(c => /system prompt/i.test(c.name))) fixed.push({ kind: 'code', label: 'SYSTEM PROMPT', lines: [0.9, 0.7, 0.95, 0.5], indents: [0, 1, 1, 0] })
  if (used.some(c => /tool/i.test(c.name))) fixed.push({ kind: 'tool', label: 'TOOLS', lines: [0.6, 0.8, 0.5] })
  for (const server of new Set((breakdown?.mcpTools ?? []).map(t => t.serverName))) {
    fixed.push({ kind: 'tool', label: labelOf(`MCP ${server}`), lines: [0.7, 0.5] })
  }
  if (used.some(c => /skill/i.test(c.name))) fixed.push({ kind: 'code', label: 'SKILLS', lines: [0.8, 0.6, 0.7] })

  const results = new Map<string, string>()
  for (const m of messages) for (const r of m.toolResults ?? []) results.set(r.tool_use_id, r.text)

  const convo: Thumb[] = []
  for (const m of messages) {
    const text = m.text.trim()
    // reminders and command wrappers the engine injects are not what the person wrote
    const isInjected = text.startsWith('<')
    if (text !== '' && !isInjected) {
      const shape = shapeOf(text)
      const kind = m.role === 'user' ? 'user' : shape.hasCode ? 'code' : 'chat'
      convo.push({ kind, label: labelOf(text), lines: shape.lines, ...(shape.indents ? { indents: shape.indents } : {}) })
    }
    for (const use of m.toolUses) {
      const out = shapeOf(results.get(use.tool_use_id) ?? '')
      convo.push({ kind: 'tool', label: toolLabel(use.tool, use.input), lines: out.lines })
    }
  }
  return [...fixed, ...convo.slice(-Math.max(0, MAX_ITEMS - fixed.length))]
}
