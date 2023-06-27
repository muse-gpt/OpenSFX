/**
 * Install-state verification for `@wae/open-sfx`.
 *
 * Run this against an isolated directory that installed the packed tarballs
 * (no repository sources, no previously built `.node` inside):
 *
 *   node scripts/verify-install.mjs <installDir> [outDir]
 *
 * It imports the installed package by path and asserts the contracts the
 * migration froze: every family renders, the same spec plus seed renders
 * byte-identical twice (the reproducibility contract), the result `family`
 * is the kebab-case upstream spelling, the CLI and the API produce the same
 * bytes for one preset, and every invalid input rejects with an explicit
 * `invalid_input:` prefix instead of a silent clamp. WAV headers, durations
 * and audibility are checked independently by scripts/verify-wav.ps1.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [, , installDirRaw, outDirRaw = 'out'] = process.argv;
if (!installDirRaw) {
    console.error('usage: node scripts/verify-install.mjs <installDir> [outDir]');
    process.exit(1);
}

const installDir = resolve(installDirRaw);
const outDir = resolve(outDirRaw);
mkdirSync(outDir, { recursive: true });

const packageEntry = pathToFileURL(resolve(installDir, 'node_modules/@wae/open-sfx/dist/index.js'));
const nativeEntry = pathToFileURL(resolve(installDir, 'node_modules/@wae/open-sfx/dist/native.js'));
const { renderSfx, renderPreset, listPresets, nativeVersion } = await import(packageEntry);
const { native } = await import(nativeEntry);

let failures = 0;
function check(name, ok, detail) {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures += 1;
}

function expectInvalid(name, run) {
    try {
        run();
        check(name, false, 'no error thrown');
    }
    catch (error) {
        check(name, String(error.message).startsWith('invalid_input'), error.message);
    }
}

check('native version is reported', typeof nativeVersion() === 'string' && nativeVersion().length > 0, nativeVersion());

const catalogue = [
    'whoosh-soft', 'whoosh-metal', 'impact-deep', 'impact-snap', 'riser-tension',
    'tick-clean', 'glitch-data', 'sub-drop', 'ambience-night', 'sparkle-rise',
];
const listed = listPresets();
check('listPresets returns the upstream catalogue in order', JSON.stringify(listed) === JSON.stringify(catalogue), listed.join(','));

const families = ['whoosh', 'impact', 'riser', 'tick', 'glitch', 'sub', 'ambience', 'sparkle'];
for (const family of families) {
    const spec = { family, duration: 0.6, seed: 7 };
    const a = renderSfx(spec, join(outDir, `${family}-a.wav`));
    const b = renderSfx(spec, join(outDir, `${family}-b.wav`));
    const bytesA = readFileSync(a.out);
    const bytesB = readFileSync(b.out);
    check(`${family}: same spec and seed render byte-identical`, bytesA.equals(bytesB), `${bytesA.length} bytes`);
    check(`${family}: result family is kebab-case`, a.family === family, a.family);
}

for (const name of catalogue) {
    const result = renderPreset(name, join(outDir, `preset-${name}.wav`));
    check(`preset ${name} renders non-empty`, result.bytes > 44, `${result.bytes} bytes, family ${result.family}`);
}

const cliOut = join(outDir, 'cli-tick-clean.wav');
execFileSync(process.execPath, [
    resolve(installDir, 'node_modules/@wae/open-sfx/dist/cli.js'), 'render', 'tick-clean', cliOut,
], { stdio: 'inherit' });
check(
    'CLI and API render the same preset byte-identically',
    readFileSync(cliOut).equals(readFileSync(join(outDir, 'preset-tick-clean.wav'))),
);

expectInvalid('duration below 0.01 s rejects', () => renderSfx({ family: 'tick', duration: 0.005 }, join(outDir, 'bad-duration.wav')));
expectInvalid('pitch below 0.05 rejects', () => renderSfx({ family: 'tick', duration: 0.5, pitch: 0.01 }, join(outDir, 'bad-pitch.wav')));
expectInvalid('brightness above 1 rejects', () => renderSfx({ family: 'tick', duration: 0.5, brightness: 1.5 }, join(outDir, 'bad-brightness.wav')));
expectInvalid('unknown family rejects', () => renderSfx({ family: 'zap', duration: 0.5 }, join(outDir, 'bad-family.wav')));
expectInvalid('unknown preset rejects', () => renderPreset('nope-not-a-preset', join(outDir, 'bad-preset.wav')));
expectInvalid('missing duration rejects', () => renderSfx({ family: 'tick' }, join(outDir, 'bad-missing.wav')));
expectInvalid('preset and spec together reject (no precedence)', () => native.renderSfx({ preset: 'tick-clean', spec: '{"family":"tick","duration":0.5}', out: join(outDir, 'bad-both.wav') }));
expectInvalid('neither preset nor spec rejects', () => native.renderSfx({ out: join(outDir, 'bad-none.wav') }));
expectInvalid('malformed spec JSON rejects', () => native.renderSfx({ spec: '{family', out: join(outDir, 'bad-json.wav') }));

console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
