import type { Cli } from '@wae/commander';

import { renderPattern, renderPatternPreset } from '../../index.js';
import type { DrumPattern } from '../../index.js';
import { readSpecFile } from '../spec-file.js';
import { emit } from './render-cmd.js';

export function registerPatternCommand(cli: Cli): void {
    cli.command('pattern', 'cli.cmd.pattern')
        .option('--spec <file>', 'cli.opt.spec')
        .option('--json', 'cli.opt.json')
        .action((options) => {
            const specFile = options.spec as string | undefined;
            if (specFile) {
                const out = options._[0];
                if (!out) {
                    console.error('usage: open-sfx pattern --spec <spec.json> <out.wav>');
                    return 2;
                }
                return emit(options, () => renderPattern(readSpecFile<DrumPattern>(specFile), out));
            }
            const [preset, out] = options._;
            if (!preset || !out) {
                console.error('usage: open-sfx pattern <preset> <out.wav> | open-sfx pattern --spec <spec.json> <out.wav>');
                return 2;
            }
            return emit(options, () => renderPatternPreset(preset, out));
        });
}
