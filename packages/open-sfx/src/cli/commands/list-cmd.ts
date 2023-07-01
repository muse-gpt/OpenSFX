import type { Cli } from '@wae/commander';

import { listPresets } from '../../index.js';

export function registerListCommand(cli: Cli): void {
    cli.command('list', 'cli.cmd.list')
        .action(() => {
            for (const name of listPresets()) {
                console.log(name);
            }
            return 0;
        });
}
