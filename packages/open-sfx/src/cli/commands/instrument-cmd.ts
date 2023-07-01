import type { Cli } from '@wae/commander';

import { renderInstrumentPreset } from '../../index.js';

export function registerInstrumentCommand(cli: Cli): void {
    cli.command('instrument', 'cli.cmd.instrument')
        .action((options) => {
            const [preset, out] = options._;
            if (!preset || !out) {
                console.error('usage: open-sfx instrument <preset> <out.wav>');
                return 2;
            }
            const result = renderInstrumentPreset(preset, out);
            console.log(`${result.out} ${result.bytes} bytes (${result.instrument})`);
            return 0;
        });
}
