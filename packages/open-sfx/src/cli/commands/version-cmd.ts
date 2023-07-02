import type { Cli } from '@wae/commander';

import { nativeVersion } from '../../index.js';

/** Prints the native library version, so hosts and CI can verify the binary. */
export function registerVersionCommand(cli: Cli): void {
    cli.command('version', 'cli.cmd.version')
        .option('--json', 'cli.opt.json')
        .action((options) => {
            const version = nativeVersion();
            console.log(options.json === true ? JSON.stringify({ version }) : version);
            return 0;
        });
}
