# event-horizon

Animated hi-tech backdrops for the Claude desktop and mobile apps, with app colors that overheat as the context window fills.

The default backdrop is a black hole that feeds on your context. Each part of the context (messages, tool definitions, system prompt and skills, memory files) is a small card orbiting the hole and spiralling in, about one card per 2.5% of the window. The hole grows as the window fills and shrinks after a compaction.

## Install

In Claude Code, run:

```
/plugin install event-horizon --marketplace Richugan/event-horizon
```

Answer `y` to add the marketplace, then pick a scope. The backdrop and colors show in the Claude desktop and mobile apps.

## Overheat

| Context | Look |
| --- | --- |
| 0-50% | calm style colors |
| 50-75% | blends toward amber, motion about 15% faster |
| 75-90% | orange-red, faster pulses, faint flicker |
| 90%+ | full red, pulsing red vignette, warning band with a Compact button |

Colors blend continuously, so nothing jumps at a boundary. The status line always shows `Context N%`.

## Commands

- `/backdrop`: show the current style and options
- `/backdrop space | rain | grid | circuit | radar | plasma`: switch style (remembered across sessions)
- `/backdrop test 92`: simulate a context fill to preview the stages; `/backdrop test off` to stop
- `/backdrop off` / `/backdrop on`

Scenes are pure SVG with CSS animation (no script, no per-frame redraw). With reduced motion on, each scene draws still. The terminal draws no backdrop or theme, but still shows the status line.

## Privacy

To draw the thumbnails, the mod reads the current conversation through Claude Code's plugin API: message text, tool names and the files or commands they touched, and the memory files listed in the context. It uses them only to draw the backdrop on your own screen. Nothing is stored beyond the session or sent anywhere.

`/backdrop comet` sends a comet across the sky right away, to see it without waiting for its cycle.
