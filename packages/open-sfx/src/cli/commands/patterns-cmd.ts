import type { Cli } from '@wae/commander';

import { listPatterns } from '../../index.js';

export function registerPatternsCommand(cli: Cli): void {
    cli.command('patterns', 'cli.cmd.patterns')
        .action(() => {
            for (const name of listPatterns()) {
                console.log(name);
            }
            return 0;
        });
}
