import type { StyleKey, Thumb } from '../types'

export const STYLES: Record<StyleKey, { name: string; bg0: string; bg1: string; a: string; b: string }>
export const FONT_CHARS: string
export function mix(a: string, b: string, t: number): string
export function heatFromPercent(p: number | null | undefined): number
export function heatColor(base: string, h: number): string
export function speedFor(h: number): number
export function holeRadius(pct: number | null | undefined): number
export function vtext(str: string, x: number, y: number, size?: number): string
export function sampleThumbs(pct: number | null | undefined): Thumb[]
export function buildScene(
  kind: StyleKey,
  heat?: number,
  opts?: { pct?: number | null; showPct?: boolean; thumbs?: Thumb[]; seed?: number; cometDelay?: number },
): string
