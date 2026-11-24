export type StyleKey = 'space' | 'rain' | 'grid' | 'circuit' | 'radar' | 'plasma'

export type ThumbKind = 'user' | 'chat' | 'code' | 'doc' | 'tool'

/**
 * One item of the context drawn as a thumbnail: its label (real words, cut short),
 * and the shape of its first lines as fractions of a full line.
 */
export type Thumb = { kind: ThumbKind; label: string; lines: number[]; indents?: number[] }

declare module 'claude-code' {
  interface PluginState {
    'event-horizon': {
      /** Context window fill, 0-100, as the status line has it; null before the first response. */
      pct: number | null
      /** A simulated fill set by `/backdrop test <n>`, which wins over `pct`. */
      test: number | null
      /** The context as thumbnails, oldest first; null until measured. */
      thumbs: Thumb[] | null
      /** How many messages the session holds, which re-rolls the comet's path. */
      seed: number
      /** When `/backdrop comet` last asked for a comet, as a clock time in ms. */
      cometAt: number | null
      style: StyleKey
      isOn: boolean
    }
  }
}
