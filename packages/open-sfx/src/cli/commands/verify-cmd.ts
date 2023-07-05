import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Cli } from '@wae/commander';

import { renderPreset } from '../../index.js';

/** One post-render contract check. */
interface Check {
    name: string;
    ok: boolean;
    detail: string;
}

/**
 * Renders one preset into a temporary WAV and checks the delivery facts.
 *
 * The file is deleted afterwards, so this is a gate rather than an export:
 * container, channel count, sample rate and audibility. Use `render` when the
 * WAV itself is the deliverable.
 */
export function registerVerifyCommand(cli: Cli): void {
    cli.command('verify', 'cli.cmd.verify')
        .option('--json', 'cli.opt.json')
        .action((options) => {
            const preset = typeof options._[0] === 'string' ? options._[0] : 'tick-clean';
            const dir = mkdtempSync(join(tmpdir(), 'open-sfx-verify-'));
            const out = join(dir, 'verify.wav');
            try {
                const result = renderPreset(preset, out);
                const wav = readFileSync(out);
                const peak = peakFullScale(wav);
                const checks: Check[] = [
                    { name: 'container', ok: wav.toString('ascii', 0, 4) === 'RIFF' && wav.toString('ascii', 8, 12) === 'WAVE', detail: 'RIFF/WAVE' },
                    { name: 'channels', ok: wav.readUInt16LE(22) === 2, detail: `${wav.readUInt16LE(22)} channels` },
                    { name: 'sample-rate', ok: wav.readUInt32LE(24) === 44_100, detail: `${wav.readUInt32LE(24)} Hz` },
                    { name: 'render', ok: result.bytes > 44, detail: `${result.bytes} bytes (${result.family})` },
                    { name: 'audible', ok: peak > 0, detail: `peak ${peak.toFixed(3)} full scale` },
                ];
                const ok = checks.every((check) => check.ok);
                if (options.json === true) {
                    console.log(JSON.stringify({ ok, checks, result }, null, 2));
                }
                else {
                    for (const check of checks) {
                        console.log(`${check.ok ? 'ok  ' : 'FAIL'} ${check.name}: ${check.detail}`);
                    }
                }
                return ok ? 0 : 1;
            }
            catch (error) {
                console.error(`open-sfx: ${error instanceof Error ? error.message : String(error)}`);
                return 1;
            }
            finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });
}

/** Peak sample of a canonical PCM16 WAV whose data starts after the 44-byte header. */
function peakFullScale(wav: Buffer): number {
    let peak = 0;
    for (let i = 44; i + 1 < wav.length; i += 2) {
        peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
    }
    return peak / 32_768;
}
