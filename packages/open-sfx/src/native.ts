/**
 * Native binding loader for `@wae/open-sfx`.
 *
 * The N-API module is the only implementation path. A missing binary produces
 * an actionable error instead of silently degrading to a JS implementation.
 */
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Family } from './index.js';

const require = createRequire(import.meta.url);

export type PlatformKey = 'win32-x64' | 'linux-x64' | 'darwin-x64' | 'darwin-arm64';

export interface RenderSfxResult {
    out: string;
    bytes: number;
    fingerprint: string;
    family: Family;
}

export interface RenderInstrumentResult {
    out: string;
    bytes: number;
    fingerprint: string;
    instrument: string;
}

export interface RenderPatternResult {
    out: string;
    bytes: number;
    fingerprint: string;
    bpm: number;
    seconds: number;
}

export interface NativeBinding {
    version(): string;
    listPresets(): string[];
    listInstruments(): string[];
    listInstrumentPresets(): string[];
    listPatterns(): string[];
    renderSfx(options: { preset?: string; spec?: string; out: string }): RenderSfxResult;
    renderInstrument(options: { preset?: string; spec?: string; out: string }): RenderInstrumentResult;
    renderPattern(options: { preset?: string; spec?: string; out: string }): RenderPatternResult;
}

/** Map Node platform and arch to the optionalDependency package suffix. */
export function platformKey(platform = process.platform, arch = process.arch): PlatformKey | null {
    if (platform === 'win32' && arch === 'x64') return 'win32-x64';
    if (platform === 'linux' && arch === 'x64') return 'linux-x64';
    if (platform === 'darwin' && arch === 'x64') return 'darwin-x64';
    if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64';
    return null;
}

function candidates(key: PlatformKey): string[] {
    const override = process.env.OPEN_SFX_NATIVE;
    const scoped = `@wae/open-sfx-${key}`;
    const here = path.dirname(fileURLToPath(import.meta.url));
    const local = path.resolve(here, '..', '..', `open-sfx-${key}`);
    const packages = [scoped, local];
    return override ? [override, ...packages] : packages;
}

function load(): NativeBinding {
    const key = platformKey();
    if (!key) {
        throw new Error(
            `OpenSFX native binding is not available for ${os.platform()}-${os.arch()}.\n` +
                `Supported hosts: win32-x64, linux-x64, darwin-x64, darwin-arm64.\n` +
                `Set OPEN_SFX_NATIVE to a built .node file when staging outside the optional-dep layout.`,
        );
    }
    const errors: string[] = [];
    for (const candidate of candidates(key)) {
        try {
            return require(candidate) as NativeBinding;
        }
        catch (error) {
            errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    throw new Error(
        `OpenSFX native binding is not available for ${key}.\n` +
            `Set OPEN_SFX_NATIVE to a built .node file, or install @wae/open-sfx-${key}.\n` +
            `Tried:\n${errors.map((line) => `  - ${line}`).join('\n')}`,
    );
}

export const native = load();
