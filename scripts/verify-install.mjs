#!/usr/bin/env node
/**
 * Installed-state verification for OpenSFX.
 *
 * Loads the library through its public entry (so the loader, the optional
 * platform package and the staged `.node` are all exercised), renders one
 * preset into a temporary WAV and checks the container plus the samples.
 * Exit code is 0 only when every fact holds.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { nativeVersion, renderPreset } from '../packages/open-sfx/dist/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(path.join(tmpdir(), 'open-sfx-verify-'));
const out = path.join(dir, 'tick.wav');

let failed = false;
const check = (name, ok, detail) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${detail}`);
    failed ||= !ok;
};

try {
    check('module', path.basename(root) === 'OpenSFX', root);
    const version = nativeVersion();
    check('version', typeof version === 'string' && version.length > 0, version);

    const result = renderPreset('tick-clean', out);
    check('render', result.bytes > 44 && result.out === out, `${result.bytes} bytes -> ${result.out}`);

    const wav = readFileSync(out);
    const riff = wav.toString('ascii', 0, 4);
    const wave = wav.toString('ascii', 8, 12);
    check('container', riff === 'RIFF' && wave === 'WAVE', `${riff}/${wave}`);

    // Sample data starts after the canonical 44-byte PCM header.
    let peak = 0;
    for (let i = 44; i + 1 < wav.length; i += 2) {
        peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
    }
    check('audible', peak > 0, `peak ${(peak / 32768).toFixed(3)} full scale`);
}
catch (error) {
    check('load', false, error instanceof Error ? error.message : String(error));
}
finally {
    rmSync(dir, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
