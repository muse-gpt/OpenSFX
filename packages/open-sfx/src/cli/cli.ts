import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCli } from '@wae/commander';

import { registerInstrumentCommand } from './commands/instrument-cmd.js';
import { registerInstrumentsCommand } from './commands/instruments-cmd.js';
import { registerListCommand } from './commands/list-cmd.js';
import { registerPackCommand } from './commands/pack-cmd.js';
import { registerPatternCommand } from './commands/pattern-cmd.js';
import { registerPatternsCommand } from './commands/patterns-cmd.js';
import { registerRenderCommand } from './commands/render-cmd.js';

export function localesRoot(): string {
    return join(dirname(fileURLToPath(import.meta.url)), '../../locales');
}

/** Build the `open-sfx` command tree (@wae/commander, one command per file). */
export function buildSfxCli() {
    const cli = createCli('open-sfx')
        .locales(localesRoot(), { envKeys: ['OPEN_SFX_LOCALE', 'LOCALE', 'LANG', 'LC_ALL'] })
        .intro('cli.intro');

    registerListCommand(cli);
    registerRenderCommand(cli);
    registerPackCommand(cli);
    registerInstrumentsCommand(cli);
    registerInstrumentCommand(cli);
    registerPatternsCommand(cli);
    registerPatternCommand(cli);

    return cli;
}
