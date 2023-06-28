/**
 * `@wae/open-sfx` — describe a sound with a spec, get a WAV.
 *
 * A sound is data: the same spec and seed always render the same samples, so a
 * catalogue can be generated at build time instead of shipping audio blobs.
 * All synthesis, preset resolution and input validation run in the native
 * library (the upstream `media.synthesis` core); this module only types and
 * forwards.
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
    /** Length in seconds; must be at least 0.01. */
    duration: number;
    /** Deterministic noise seed; defaults to 1 when omitted. */
    seed?: number;
    /** Pitch multiplier, 1.0 is the family default; must be at least 0.05. */
    pitch?: number;
    /** 0 dark and muffled, 1 bright and hissy; must be within 0..1. */
    brightness?: number;
    /** Output gain; must be within 0..1. */
    intensity?: number;
    /** -1 left to 1 right. */
    pan?: number;
}

export interface RenderedSfx {
    out: string;
    bytes: number;
    /** Kebab-case family name — the same spelling the spec is written with. */
    family: Family;
}

/**
 * Renders a spec into a WAV at `out`.
 *
 * Invalid input is rejected, never clamped: an unknown family, a missing or
 * non-finite number, a duration below 0.01 s, a pitch below 0.05 or a
 * brightness/intensity outside 0..1 throws with an `invalid_input:`-prefixed
 * error.
 */
export function renderSfx(spec: SfxSpec, out: string): RenderedSfx {
    return native.renderSfx({ spec: JSON.stringify(spec), out });
}

/**
 * Renders a shipped preset by name into a WAV at `out`.
 *
 * An unknown name throws with an `invalid_input:`-prefixed error.
 */
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

/** Every playable instrument name (drums and pitched instruments). */
export type Instrument =
    | 'kick'
    | 'snare'
    | 'clap'
    | 'hat-closed'
    | 'hat-open'
    | 'tom'
    | 'rim'
    | 'shaker'
    | 'crash'
    | 'bass'
    | 'pluck'
    | 'pad'
    | 'lead'
    | 'bell'
    | 'marimba'
    | 'keys'
    | 'strings';

/** One instrument hit; `note` is a MIDI number (A4 = 69). */
export interface InstrumentSpec {
    instrument: Instrument;
    duration: number;
    note?: number;
    seed?: number;
    /** Tail length, 0 tight … 1 long; within 0..1. */
    decay?: number;
    /** Brightness, 0 dark … 1 bright; within 0..1. */
    tone?: number;
    gain?: number;
    pan?: number;
}

/** One groove track: step velocities, 0 is a rest. */
export interface PatternTrack {
    instrument: Instrument;
    steps: number[];
    note?: number;
    tone?: number;
    decay?: number;
    pan?: number;
}

/** One renderable groove. */
export interface DrumPattern {
    bpm: number;
    stepsPerBar?: number;
    bars?: number;
    tracks: PatternTrack[];
}

export interface RenderedInstrument {
    out: string;
    bytes: number;
    instrument: string;
}

export interface RenderedPattern {
    out: string;
    bytes: number;
    bpm: number;
    seconds: number;
}

/** Renders one instrument hit spec into a WAV at `out`. */
export function renderInstrument(spec: InstrumentSpec, out: string): RenderedInstrument {
    return native.renderInstrument({ spec: JSON.stringify(spec), out });
}

/** Renders a shipped instrument preset by name into a WAV at `out`. */
export function renderInstrumentPreset(preset: string, out: string): RenderedInstrument {
    return native.renderInstrument({ preset, out });
}

/** Renders one groove spec into a WAV at `out`. */
export function renderPattern(spec: DrumPattern, out: string): RenderedPattern {
    return native.renderPattern({ spec: JSON.stringify(spec), out });
}

/** Renders a shipped groove preset by name into a WAV at `out`. */
export function renderPatternPreset(preset: string, out: string): RenderedPattern {
    return native.renderPattern({ preset, out });
}

/** Every instrument name, in catalogue order. */
export function listInstruments(): string[] {
    return native.listInstruments();
}

/** Every shipped instrument preset name. */
export function listInstrumentPresets(): string[] {
    return native.listInstrumentPresets();
}

/** Every shipped drum-groove preset name. */
export function listPatterns(): string[] {
    return native.listPatterns();
}
