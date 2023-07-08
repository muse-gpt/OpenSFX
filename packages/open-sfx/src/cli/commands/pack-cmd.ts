import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Cli } from '@wae/commander';

import {
    listInstrumentPresets,
    listPatterns,
    listPresets,
    renderInstrumentPreset,
    renderPatternPreset,
    renderPreset,
} from '../../index.js';

/** The three shipped asset kinds, each with its own catalogue and renderer. */
type Kind = 'sfx' | 'instrument' | 'pattern';

const KINDS: Kind[] = ['sfx', 'instrument', 'pattern'];

/** One rendered asset as recorded in the delivery manifest. */
interface ManifestFile {
    name: string;
    file: string;
    bytes: number;
    fingerprint: string;
    /** Family, instrument or groove detail depending on the kind. */
    detail: string;
}

/** The delivery manifest written next to the rendered WAVs. */
interface Manifest {
    kind: Kind;
    presets: number;
    bytes: number;
    files: ManifestFile[];
}

/**
 * Renders a whole catalogue into a directory and records a manifest.
 *
 * `--kind` selects the SFX (default), instrument or pattern catalogue. The
 * manifest is the auditable counterpart of the WAVs: every file carries its
 * name, byte count, kind-specific detail and the same FNV-1a fingerprint
 * `render` prints, so a delivery can be compared without listening to it.
 */
export function registerPackCommand(cli: Cli): void {
    cli.command('pack', 'cli.cmd.pack')
        .option('--kind <sfx|instrument|pattern>', 'cli.opt.kind')
        .option('--json', 'cli.opt.json')
        .action((options) => {
            const kind = resolveKind(options.kind);
            if (kind === undefined) {
                console.error(`usage: open-sfx pack <dir> --kind <${KINDS.join('|')}>`);
                return 2;
            }
            const directory = typeof options._[0] === 'string' ? options._[0] : 'out';
            const catalogue = kind === 'instrument' ? listInstrumentPresets() : kind === 'pattern' ? listPatterns() : listPresets();
            const files: ManifestFile[] = [];
            for (const name of catalogue) {
                const file = `${name}.wav`;
                const result = render(kind, name, join(directory, file));
                files.push({
                    name,
                    file,
                    bytes: result.bytes,
                    fingerprint: result.fingerprint,
                    detail: detailOf(kind, result),
                });
                if (options.json !== true) {
                    console.log(`${result.out} ${result.bytes} bytes (${result.fingerprint})`);
                }
            }
            const manifest: Manifest = {
                kind,
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
                console.log(`manifest: ${path} (${kind}, ${manifest.presets} presets, ${manifest.bytes} bytes)`);
            }
            return 0;
        });
}

/** Defaults to the SFX catalogue; an unknown `--kind` is a usage error. */
function resolveKind(value: unknown): Kind | undefined {
    if (value === undefined) {
        return 'sfx';
    }
    return typeof value === 'string' && (KINDS as string[]).includes(value) ? (value as Kind) : undefined;
}

/** Renders one catalogue entry through the renderer that owns the kind. */
function render(kind: Kind, name: string, out: string): { out: string; bytes: number; fingerprint: string; family?: string; instrument?: string; bpm?: number; seconds?: number } {
    if (kind === 'instrument') {
        return renderInstrumentPreset(name, out);
    }
    if (kind === 'pattern') {
        return renderPatternPreset(name, out);
    }
    return renderPreset(name, out);
}

/** The kind-specific label recorded next to the byte count. */
function detailOf(
    kind: Kind,
    result: { family?: string; instrument?: string; bpm?: number; seconds?: number },
): string {
    if (kind === 'instrument') {
        return result.instrument ?? 'instrument';
    }
    if (kind === 'pattern') {
        return `${result.bpm ?? 0} BPM, ${(result.seconds ?? 0).toFixed(2)}s`;
    }
    return result.family ?? 'sfx';
}
