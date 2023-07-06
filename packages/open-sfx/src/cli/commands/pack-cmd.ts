import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Cli } from '@wae/commander';

import { listPresets, renderPreset } from '../../index.js';

/** One rendered preset as recorded in the delivery manifest. */
interface ManifestFile {
    preset: string;
    file: string;
    bytes: number;
    fingerprint: string;
    family: string;
}

/** The delivery manifest written next to the rendered WAVs. */
interface Manifest {
    presets: number;
    bytes: number;
    files: ManifestFile[];
}

/**
 * Renders the whole preset catalogue into a directory and records a manifest.
 *
 * The manifest is the auditable counterpart of the WAVs: every file carries the
 * preset name, byte count, family and the same FNV-1a fingerprint `render`
 * prints, so a delivery can be compared without listening to it. It also serves
 * as the pack-wide reproducibility record.
 */
export function registerPackCommand(cli: Cli): void {
    cli.command('pack', 'cli.cmd.pack')
        .option('--json', 'cli.opt.json')
        .action((options) => {
            const directory = typeof options._[0] === 'string' ? options._[0] : 'out';
            const files: ManifestFile[] = [];
            for (const name of listPresets()) {
                const file = `${name}.wav`;
                const result = renderPreset(name, join(directory, file));
                files.push({
                    preset: name,
                    file,
                    bytes: result.bytes,
                    fingerprint: result.fingerprint,
                    family: result.family,
                });
                if (options.json !== true) {
                    console.log(`${result.out} ${result.bytes} bytes (${result.fingerprint})`);
                }
            }
            const manifest: Manifest = {
                presets: files.length,
                bytes: files.reduce((total, entry) => total + entry.bytes, 0),
                files,
            };
            const path = join(directory, 'manifest.json');
            writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
            if (options.json === true) {
                console.log(JSON.stringify({ path, ...manifest }, null, 2));
            }
            else {
                console.log(`manifest: ${path} (${manifest.presets} presets, ${manifest.bytes} bytes)`);
            }
            return 0;
        });
}
