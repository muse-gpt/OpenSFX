# OpenSFX

[![CI](https://github.com/muse-gpt/OpenSFX/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/muse-gpt/OpenSFX/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40wae%2Fopen-sfx.svg)](https://www.npmjs.com/package/@wae/open-sfx)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## 💡 What is OpenSFX?

OpenSFX turns a small sound **spec** into a WAV. Eight effect families, playable instruments, and drum grooves are synthesized procedurally — same inputs and seed always produce the same samples — so a catalogue can be generated at build time instead of shipping audio blobs.

It is a library first (`@wae/open-sfx`); the `open-sfx` CLI is a thin shell over the same APIs. Pair it with vocal synthesis when you need both sound design and singing in one pipeline.

OpenSFX is **not** a sample pack, a DAW, or a neural audio model. There are no shipped waveforms or weights — only deterministic synthesis and named presets.

## 🚀 Getting started

### 1. Agent / prompt (recommended)

Ask your coding agent to install `@wae/open-sfx` and render a preset or a family spec to WAV. Useful prompts:

- Install `@wae/open-sfx` and write a short script that renders `tick-clean` to `out/tick.wav`.
- Render an `impact` family hit (0.4 s, seed 7) and a `four-on-floor` groove to WAV, then list available presets.

### 2. Manual install

```bash
pnpm add @wae/open-sfx
```

```ts
import { renderPreset, renderSfx, listPresets } from '@wae/open-sfx';

listPresets();
renderPreset('tick-clean', './out/tick.wav');
renderSfx({ family: 'whoosh', duration: 0.6, seed: 7 }, './out/whoosh.wav');
```

```bash
pnpm exec open-sfx list
pnpm exec open-sfx render tick-clean ./out/tick.wav
pnpm exec open-sfx instrument kick-808 ./out/kick.wav
pnpm exec open-sfx pattern four-on-floor ./out/groove.wav
```

Custom specs can be passed as JSON files instead of preset names:

```bash
# spec.json: { "family": "riser", "duration": 0.8, "seed": 7, "brightness": 0.8 }
pnpm exec open-sfx render --spec spec.json ./out/riser.wav

# hit.json: { "instrument": "bass", "duration": 0.4, "note": 40, "decay": 0.3 }
pnpm exec open-sfx instrument --spec hit.json ./out/bass.wav

# groove.json: { "bpm": 120, "bars": 1, "tracks": [{ "instrument": "kick", "steps": [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0] }] }
pnpm exec open-sfx pattern --spec groove.json ./out/groove.wav
```

Prebuilt natives resolve automatically for **Windows x64**, **macOS Intel**, **macOS Apple Silicon**, **Linux x64**, and **Linux arm64**.

## ✨ Highlights

- **Eight effect families** — whoosh, impact, riser, tick, glitch, sub, ambience, sparkle — with shared parameters (duration, seed, pitch, brightness, intensity, pan).
- **Instruments and grooves** — drum kit and pitched instruments, plus named drum patterns such as `four-on-floor` and `breakbeat`.
- **Deterministic WAV export** — identical spec + seed → byte-identical PCM16 stereo files; invalid input fails with an explicit `invalid_input:` error instead of silent clamping.
- **Library + CLI** — import small functions in Node, or drive the same catalogue from `open-sfx` commands.

## 🧪 Examples

| Goal | Entry |
| --- | --- |
| Named SFX preset → WAV | `renderPreset('impact-deep', './out/hit.wav')` or `open-sfx render impact-deep ./out/hit.wav` |
| Custom family spec | `renderSfx({ family: 'riser', duration: 1.2, seed: 3, brightness: 0.8 }, './out/riser.wav')` or `open-sfx render --spec riser.json ./out/riser.wav` |
| Instrument hit | `open-sfx instrument kick-808 ./out/kick.wav` |
| Drum groove | `open-sfx pattern four-on-floor ./out/groove.wav` |
| Catalogue dump | `open-sfx list` · `open-sfx instruments` · `open-sfx patterns` |

## 📜 License

[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)
