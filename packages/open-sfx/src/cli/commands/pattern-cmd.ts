import type { Cli } from '@wae/commander';

import { renderPatternPreset } from '../../index.js';

export function registerPatternCommand(cli: Cli): void {
    cli.command('pattern', 'cli.cmd.pattern')
        .action((options) => {
            const [preset, out] = options._;
            if (!preset || !out) {
                console.error('usage: open-sfx pattern <preset> <out.wav>');
                return 2;
            }
            const result = renderPatternPreset(preset, out);
            console.log(`${result.out} ${result.bytes} bytes (${result.bpm} BPM, ${result.seconds.toFixed(2)}s)`);
            return 0;
        });
}
