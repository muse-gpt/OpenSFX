# @wae/open-sfx

Facade for procedural sound effects, instruments, and drum grooves. Import this package only — platform `.node` sidecars resolve automatically.

## Exports

| Export | Role |
|--------|------|
| `renderSfx` / `renderPreset` / `listPresets` | Sound-effect families and named presets → WAV |
| `renderInstrument` / `renderInstrumentPreset` / `listInstruments` | Single instrument hits |
| `renderPattern` / `renderPatternPreset` / `listPatterns` | Drum grooves |
| `nativeVersion` | Native library version string |
| `open-sfx` CLI | `list`, `render`, `pack`, `instruments`, `instrument`, `patterns`, `pattern` |

## Example

```ts
import { renderSfx, renderPreset } from '@wae/open-sfx';

renderPreset('impact-deep', 'out/impact.wav');
renderSfx({ family: 'whoosh', duration: 0.6, seed: 7, brightness: 0.8 }, 'out/whoosh.wav');
```

## Related packages

Platform sidecars (`@wae/open-sfx-win32-x64`, `linux-x64`, `darwin-x64`, `darwin-arm64`) are optional dependencies — do not import them directly.

[Product overview](https://github.com/muse-gpt/OpenSFX/blob/dev/README.md)
