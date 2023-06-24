/**
 * `@wae/open-sfx` — describe a sound with a spec, get a WAV.
 *
 * A sound is data: the same spec and seed always render the same samples, so a
 * catalogue can be generated at build time instead of shipping audio blobs.
 */
import { native } from './native.js';

/** Families share a synthesis routine but differ in attack, spectrum and tail. */
export type Family =
    | 'whoosh'
    | 'impact'
    | 'riser'
    | 'tick'
    | 'glitch'
    | 'sub'
    | 'ambience'
    | 'sparkle';

export interface SfxSpec {
    family: Family;
    duration: number;
    seed?: number;
    /** Pitch multiplier, 1.0 is the family default. */
    pitch?: number;
    /** 0 dark and muffled, 1 bright and hissy. */
    brightness?: number;
    intensity?: number;
    /** -1 left to 1 right. */
    pan?: number;
}

export interface RenderedSfx {
    out: string;
    bytes: number;
    family: string;
}

/** Renders a spec into a WAV at `out`. */
export function renderSfx(spec: SfxSpec, out: string): RenderedSfx {
    return native.renderSfx({ spec, out });
}

/** Renders a shipped preset by name into a WAV at `out`. */
export function renderPreset(preset: string, out: string): RenderedSfx {
    return native.renderSfx({ preset, out });
}

/** Every shipped preset name, in catalogue order. */
export function listPresets(): string[] {
    return native.listPresets();
}

/** Native library version, used by hosts to verify the binary. */
export function nativeVersion(): string {
    return native.version();
}
