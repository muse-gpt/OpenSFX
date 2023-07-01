import type { Cli } from '@wae/commander';

import { renderInstrument, renderInstrumentPreset } from '../../index.js';
import type { InstrumentSpec } from '../../index.js';
import { readSpecFile } from '../spec-file.js';

export function registerInstrumentCommand(cli: Cli): void {
    cli.command('instrument', 'cli.cmd.instrument')
        .option('--spec <file>', 'cli.opt.spec')
        .action((options) => {
            const specFile = options.spec as string | undefined;
            if (specFile) {
                const out = options._[0];
                if (!out) {
                    console.error('usage: open-sfx instrument --spec <spec.json> <out.wav>');
                    return 2;
                }
                const result = renderInstrument(readSpecFile<InstrumentSpec>(specFile), out);
                console.log(`${result.out} ${result.bytes} bytes (${result.instrument})`);
                return 0;
            }
            const [preset, out] = options._;
            if (!preset || !out) {
                console.error('usage: open-sfx instrument <preset> <out.wav> | open-sfx instrument --spec <spec.json> <out.wav>');
                return 2;
            }
            const result = renderInstrumentPreset(preset, out);
            console.log(`${result.out} ${result.bytes} bytes (${result.instrument})`);
            return 0;
        });
}
