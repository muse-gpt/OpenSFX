import type { Cli } from '@wae/commander';

import { listPresets, renderPreset } from '../../index.js';

export function registerPackCommand(cli: Cli): void {
    cli.command('pack', 'cli.cmd.pack')
        .action((options) => {
            const directory = options._[0] ?? 'out';
            for (const name of listPresets()) {
                const result = renderPreset(name, `${directory}/${name}.wav`);
                console.log(`${result.out} ${result.bytes} bytes`);
            }
            return 0;
        });
}
