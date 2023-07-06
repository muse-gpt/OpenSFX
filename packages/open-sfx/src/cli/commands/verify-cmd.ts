import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Cli } from '@wae/commander';

import { listInstrumentPresets, listPatterns, listPresets, renderInstrumentPreset, renderPatternPreset, renderPreset } from '../../index.js';

/** One post-render contract check. */
interface Check {
    name: string;
    ok: boolean;
    detail: string;
}

/** The three shipped asset kinds, each with its own catalogue and renderer. */
type Kind = 'sfx' | 'instrument' | 'pattern';

const KINDS: Kind[] = ['sfx', 'instrument', 'pattern'];

/**
 * Renders one preset into a temporary WAV and checks the delivery facts.
 *
 * Every asset kind goes through the same gate: a preset from the SFX, instrument
 * or pattern catalogue, or the first catalogue entry when no name is given.
 * Checks cover container, channel count, sample rate, audibility and
 * byte-for-byte reproducibility. The files are deleted afterwards, so this is a
 * gate rather than an export; use `render`, `instrument` or `pattern` when the
 * WAV itself is the deliverable.
 */
export function registerVerifyCommand(cli: Cli): void {
    cli.command('verify', 'cli.cmd.verify')
        .option('--kind <sfx|instrument|pattern>', 'cli.opt.kind')
        .option('--json', 'cli.opt.json')
        .action((options) => {
            const kind = resolveKind(options.kind);
            if (kind === undefined) {
                console.error(`usage: open-sfx verify <preset> --kind <${KINDS.join('|')}>`);
                return 2;
            }
            const catalogue = kind === 'instrument' ? listInstrumentPresets() : kind === 'pattern' ? listPatterns() : listPresets();
            const preset = typeof options._[0] === 'string' ? options._[0] : kind === 'sfx' ? 'tick-clean' : catalogue[0];
            if (!preset) {
                console.error(`open-sfx: the ${kind} catalogue is empty`);
                return 1;
            }
            const dir = mkdtempSync(join(tmpdir(), 'open-sfx-verify-'));
            const out = join(dir, 'verify.wav');
            const repeat = join(dir, 'verify-repeat.wav');
            try {
                const result = render(kind, preset, out);
                const again = render(kind, preset, repeat);
                const wav = readFileSync(out);
                const peak = peakFullScale(wav);
                const channels = wav.readUInt16LE(22);
                const checks: Check[] = [
                    { name: 'container', ok: wav.toString('ascii', 0, 4) === 'RIFF' && wav.toString('ascii', 8, 12) === 'WAVE', detail: 'RIFF/WAVE' },
                    { name: 'channels', ok: channels === expectedChannels(kind), detail: `${channels} channels` },
                    { name: 'sample-rate', ok: wav.readUInt32LE(24) === 44_100, detail: `${wav.readUInt32LE(24)} Hz` },
                    { name: 'render', ok: result.bytes > 44, detail: `${result.bytes} bytes (${describe(kind, result)})` },
                    { name: 'audible', ok: peak > 0, detail: `peak ${peak.toFixed(3)} full scale` },
                    {
                        name: 'reproducible',
                        ok: result.fingerprint === again.fingerprint,
                        detail: result.fingerprint,
                    },
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

/** The result fields every renderer shares, plus the kind-specific detail. */
interface Rendered {
    out: string;
    bytes: number;
    fingerprint: string;
    family?: string;
    instrument?: string;
    bpm?: number;
    seconds?: number;
}

/** Defaults to the SFX catalogue; an unknown `--kind` is a usage error. */
function resolveKind(value: unknown): Kind | undefined {
    if (value === undefined) {
        return 'sfx';
    }
    return typeof value === 'string' && (KINDS as string[]).includes(value) ? (value as Kind) : undefined;
}

/** Renders one preset of the requested kind; each catalogue owns its own entry. */
function render(kind: Kind, preset: string, out: string): Rendered {
    if (kind === 'instrument') {
        return renderInstrumentPreset(preset, out);
    }
    if (kind === 'pattern') {
        return renderPatternPreset(preset, out);
    }
    return renderPreset(preset, out);
}

/** Stereo is the contract for every shipped asset kind. */
function expectedChannels(_kind: Kind): number {
    return 2;
}

/** The kind-specific label shown next to the byte count. */
function describe(kind: Kind, result: Rendered): string {
    if (kind === 'instrument') {
        return result.instrument ?? 'instrument';
    }
    if (kind === 'pattern') {
        return `${result.bpm ?? 0} BPM, ${(result.seconds ?? 0).toFixed(2)}s`;
    }
    return result.family ?? 'sfx';
}
