import type { Cli } from '@wae/commander';

import { renderPreset, renderSfx } from '../../index.js';
import type { SfxSpec } from '../../index.js';
import { readSpecFile } from '../spec-file.js';

export function registerRenderCommand(cli: Cli): void {
    cli.command('render', 'cli.cmd.render')
        .option('--spec <file>', 'cli.opt.spec')
        .option('--json', 'cli.opt.json')
        .action((options) => {
            const specFile = options.spec as string | undefined;
            if (specFile) {
                const out = options._[0];
                if (!out) {
                    console.error('usage: open-sfx render --spec <spec.json> <out.wav>');
                    return 2;
                }
                return emit(options, () => renderSfx(readSpecFile<SfxSpec>(specFile), out));
            }
            const [preset, out] = options._;
            if (!preset || !out) {
                console.error('usage: open-sfx render <preset> <out.wav> | open-sfx render --spec <spec.json> <out.wav>');
                return 2;
            }
            return emit(options, () => renderPreset(preset, out));
        });
}

/** Fields every render result carries, plus an optional human detail. */
export interface Emittable {
    out: string;
    bytes: number;
    fingerprint: string;
    family?: string;
    instrument?: string;
    bpm?: number;
    seconds?: number;
}

/** Prints the result, or the stable `invalid_input:`/`io:` message on failure. */
export function emit(options: Record<string, unknown>, run: () => Emittable): number {
    try {
        const result = run();
        if (options.json === true) {
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            console.log(`${result.out} ${result.bytes} bytes${describe(result)}`);
            console.log(`fingerprint: ${result.fingerprint}`);
        }
        return 0;
    }
    catch (error) {
        console.error(`open-sfx: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }
}

function describe(result: Emittable): string {
    if (result.family) {
        return ` (${result.family})`;
    }
    if (result.instrument) {
        return ` (${result.instrument})`;
    }
    if (result.bpm !== undefined && result.seconds !== undefined) {
        return ` (${result.bpm} BPM, ${result.seconds.toFixed(2)}s)`;
    }
    return '';
}
