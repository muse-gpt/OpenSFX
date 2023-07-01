import type { Cli } from '@wae/commander';

import { renderPreset, renderSfx } from '../../index.js';
import type { SfxSpec } from '../../index.js';
import { readSpecFile } from '../spec-file.js';

export function registerRenderCommand(cli: Cli): void {
    cli.command('render', 'cli.cmd.render')
        .option('--spec <file>', 'cli.opt.spec')
        .action((options) => {
            const specFile = options.spec as string | undefined;
            if (specFile) {
                const out = options._[0];
                if (!out) {
                    console.error('usage: open-sfx render --spec <spec.json> <out.wav>');
                    return 2;
                }
                const result = renderSfx(readSpecFile<SfxSpec>(specFile), out);
                console.log(`${result.out} ${result.bytes} bytes (${result.family})`);
                return 0;
            }
            const [preset, out] = options._;
            if (!preset || !out) {
                console.error('usage: open-sfx render <preset> <out.wav> | open-sfx render --spec <spec.json> <out.wav>');
                return 2;
            }
            const result = renderPreset(preset, out);
            console.log(`${result.out} ${result.bytes} bytes`);
            return 0;
        });
}
