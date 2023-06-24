/**
 * `open-sfx` CLI: render one preset or the whole catalogue.
 *
 *   open-sfx list
 *   open-sfx render whoosh-soft ./out/whoosh.wav
 *   open-sfx pack ./out
 */
import { listPresets, renderPreset } from './index.js';

const [command = 'list', ...rest] = process.argv.slice(2);

if (command === 'list') {
    for (const name of listPresets()) {
        console.log(name);
    }
}
else if (command === 'render') {
    const [preset, out] = rest;
    if (!preset || !out) {
        console.error('usage: open-sfx render <preset> <out.wav>');
        process.exit(1);
    }
    const result = renderPreset(preset, out);
    console.log(`${result.out} ${result.bytes} bytes`);
}
else if (command === 'pack') {
    const directory = rest[0] ?? 'out';
    for (const name of listPresets()) {
        const result = renderPreset(name, `${directory}/${name}.wav`);
        console.log(`${result.out} ${result.bytes} bytes`);
    }
}
else {
    console.error(`unknown command: ${command}`);
    process.exit(1);
}
