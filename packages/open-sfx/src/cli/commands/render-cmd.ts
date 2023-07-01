import type { Cli } from '@wae/commander';

import { renderPreset } from '../../index.js';

export function registerRenderCommand(cli: Cli): void {
    cli.command('render', 'cli.cmd.render')
        .action((options) => {
            const [preset, out] = options._;
            if (!preset || !out) {
                console.error('usage: open-sfx render <preset> <out.wav>');
                return 2;
            }
            const result = renderPreset(preset, out);
            console.log(`${result.out} ${result.bytes} bytes`);
            return 0;
        });
}
