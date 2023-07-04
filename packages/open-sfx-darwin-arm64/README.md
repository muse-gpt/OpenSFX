# @wae/open-sfx-darwin-arm64

Prebuilt native artifact for macOS Apple Silicon. **Not a public import target.**

Pulled automatically when installing `@wae/open-sfx` on matching hosts.

## Example

```ts
import { renderPreset } from '@wae/open-sfx';

const result = renderPreset('tick-clean', 'out/tick.wav');
console.log(result.out, result.bytes);
```
