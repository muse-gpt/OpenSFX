import type { Cli } from '@wae/commander';

import { renderPattern, renderPatternPreset } from '../../index.js';
import type { DrumPattern } from '../../index.js';
import { readSpecFile } from '../spec-file.js';

export function registerPatternCommand(cli: Cli): void {
    cli.command('pattern', 'cli.cmd.pattern')
        .option('--spec <file>', 'cli.opt.spec')
        .action((options) => {
            const specFile = options.spec as string | undefined;
            if (specFile) {
                const out = options._[0];
                if (!out) {
                    console.error('usage: open-sfx pattern --spec <spec.json> <out.wav>');
                    return 2;
                }
                const result = renderPattern(readSpecFile<DrumPattern>(specFile), out);
                console.log(`${result.out} ${result.bytes} bytes (${result.bpm} BPM, ${result.seconds.toFixed(2)}s)`);
                return 0;
            }
            const [preset, out] = options._;
            if (!preset || !out) {
                console.error('usage: open-sfx pattern <preset> <out.wav> | open-sfx pattern --spec <spec.json> <out.wav>');
                return 2;
            }
            const result = renderPatternPreset(preset, out);
            console.log(`${result.out} ${result.bytes} bytes (${result.bpm} BPM, ${result.seconds.toFixed(2)}s)`);
            return 0;
        });
}
