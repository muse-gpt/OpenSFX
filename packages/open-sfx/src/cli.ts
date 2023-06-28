/**
 * `open-sfx` CLI: render one preset or the whole catalogue.
 *
 *   open-sfx list
 *   open-sfx render whoosh-soft ./out/whoosh.wav
 *   open-sfx pack ./out
 *   open-sfx instruments | instrument kick-808 ./out/kick.wav
 *   open-sfx patterns    | pattern rock ./out/rock.wav
 */
import {
    listInstrumentPresets,
    listInstruments,
    listPatterns,
    listPresets,
    renderInstrumentPreset,
    renderPatternPreset,
    renderPreset,
} from './index.js';

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
else if (command === 'instruments') {
    for (const name of listInstruments()) {
        console.log(name);
    }
}
else if (command === 'instrument') {
    const [preset, out] = rest;
    if (!preset || !out) {
        console.error('usage: open-sfx instrument <preset> <out.wav>');
        process.exit(1);
    }
    const result = renderInstrumentPreset(preset, out);
    console.log(`${result.out} ${result.bytes} bytes (${result.instrument})`);
}
else if (command === 'patterns') {
    for (const name of listPatterns()) {
        console.log(name);
    }
}
else if (command === 'pattern') {
    const [preset, out] = rest;
    if (!preset || !out) {
        console.error('usage: open-sfx pattern <preset> <out.wav>');
        process.exit(1);
    }
    const result = renderPatternPreset(preset, out);
    console.log(`${result.out} ${result.bytes} bytes (${result.bpm} BPM, ${result.seconds.toFixed(2)}s)`);
}
else {
    console.error(`unknown command: ${command}`);
    process.exit(1);
}
