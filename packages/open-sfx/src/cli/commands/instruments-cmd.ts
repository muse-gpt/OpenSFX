import type { Cli } from '@wae/commander';

import { listInstruments } from '../../index.js';

export function registerInstrumentsCommand(cli: Cli): void {
    cli.command('instruments', 'cli.cmd.instruments')
        .action(() => {
            for (const name of listInstruments()) {
                console.log(name);
            }
            return 0;
        });
}
