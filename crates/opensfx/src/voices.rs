//! One synthesis routine per family.
//!
//! Every voice is a pure function of `(spec, sample_rate)`: no clock, no global
//! RNG, no lookahead. That is what makes the catalogue reproducible.

use crate::dsp::{Biquad, Rng, env_ad, glide, pan_gains};
use crate::spec::{Family, SfxSpec};

/// Renders `spec` into interleaved stereo float samples.
#[must_use]
pub fn render(spec: &SfxSpec, sample_rate: f32) -> Vec<[f32; 2]> {
    let frames = (spec.duration.max(0.01) * sample_rate).round().max(1.0) as usize;
    let mono = render_mono(spec, sample_rate, frames);
    let (left, right) = pan_gains(spec.pan);
    mono.into_iter()
        .map(|sample| [sample * left * spec.intensity, sample * right * spec.intensity])
        .collect()
}

fn render_mono(spec: &SfxSpec, sample_rate: f32, frames: usize) -> Vec<f32> {
    match spec.family {
        Family::Whoosh => whoosh(spec, sample_rate, frames),
        Family::Impact => impact(spec, sample_rate, frames),
        Family::Riser => riser(spec, sample_rate, frames),
        Family::Tick => tick(spec, sample_rate, frames),
        Family::Glitch => glitch(spec, sample_rate, frames),
        Family::Sub => sub(spec, sample_rate, frames),
        Family::Ambience => ambience(spec, sample_rate, frames),
        Family::Sparkle => sparkle(spec, sample_rate, frames),
    }
}

/// Moves air: band-passed noise whose centre sweeps upward, then falls away.
fn whoosh(spec: &SfxSpec, sample_rate: f32, frames: usize) -> Vec<f32> {
    let mut rng = Rng::new(spec.seed);
    let duration = spec.duration.max(0.01);
    let mut out = Vec::with_capacity(frames);
    let mut band = Biquad::band_pass(400.0 * spec.pitch, 1.1, sample_rate);
    let mut low = Biquad::low_pass(6000.0, 0.7, sample_rate);
    let mut noise = 0.0f32;
    for i in 0..frames {
        let t = i as f32 / sample_rate;
        let k = t / duration;
        // Re-create the filter every 64 samples so the sweep is audible without
        // recomputing coefficients per sample.
        if i % 64 == 0 {
            let centre = glide(k, 1.0, 320.0, 1900.0) * spec.pitch;
            band = Biquad::band_pass(centre, 1.1, sample_rate);
        }
        let white = rng.bipolar();
        // A touch of smoothed noise underneath keeps it from sounding thin.
        noise = noise * 0.995 + white * 0.005;
        let body = band.process(white) * (0.55 + spec.brightness * 0.6);
        let air = low.process(noise) * (0.5 - spec.brightness * 0.3);
        let envelope = env_ad(t, duration * 0.45, duration * 0.52);
        out.push((body + air) * envelope);
    }
    out
}

/// Lands a hit: sine drop plus a short filtered noise transient.
fn impact(spec: &SfxSpec, sample_rate: f32, frames: usize) -> Vec<f32> {
    let mut rng = Rng::new(spec.seed);
    let duration = spec.duration.max(0.01);
    let mut low = Biquad::low_pass(900.0 + spec.brightness * 2600.0, 0.8, sample_rate);
    let mut out = Vec::with_capacity(frames);
    let mut phase = 0.0f32;
    for i in 0..frames {
        let t = i as f32 / sample_rate;
        let frequency = glide(t, duration, 118.0, 36.0) * spec.pitch;
        phase = (phase + std::f32::consts::TAU * frequency / sample_rate) % std::f32::consts::TAU;
        let tone = phase.sin() * env_ad(t, 0.002, duration * 0.55);
        let crack = low.process(rng.bipolar()) * env_ad(t, 0.001, 0.09) * spec.brightness;
        out.push(tone * 0.85 + crack * 0.7);
    }
    out
}

/// Builds tension: pitch climbs and the noise floor rises with it.
fn riser(spec: &SfxSpec, sample_rate: f32, frames: usize) -> Vec<f32> {
    let mut rng = Rng::new(spec.seed);
    let duration = spec.duration.max(0.01);
    let mut band = Biquad::band_pass(800.0, 0.9, sample_rate);
    let mut out = Vec::with_capacity(frames);
    let mut phase = 0.0f32;
    for i in 0..frames {
        let t = i as f32 / sample_rate;
        let k = t / duration;
        if i % 64 == 0 {
            band = Biquad::band_pass(glide(k, 1.0, 420.0, 3200.0) * spec.pitch, 0.9, sample_rate);
        }
        let frequency = glide(k, 1.0, 160.0, 900.0) * spec.pitch;
        phase = (phase + std::f32::consts::TAU * frequency / sample_rate) % std::f32::consts::TAU;
        // A saw-ish stack reads as a rising tone rather than as one thin sine.
        let tone = phase.sin() * 0.35 + (phase * 2.0).sin() * 0.12;
        let hiss = band.process(rng.bipolar()) * (0.25 + spec.brightness * 0.5);
        let envelope = k.powf(1.6);
        let tail = if duration - t < 0.03 { ((duration - t) / 0.03).max(0.0) } else { 1.0 };
        out.push((tone + hiss) * envelope * tail);
    }
    out
}

/// Marks time: a very short click, bright by design.
fn tick(spec: &SfxSpec, sample_rate: f32, frames: usize) -> Vec<f32> {
    let mut rng = Rng::new(spec.seed);
    let mut high = Biquad::high_pass(2600.0 * spec.pitch, 0.9, sample_rate);
    let mut out = Vec::with_capacity(frames);
    let mut phase = 0.0f32;
    let frequency = 2400.0 * spec.pitch;
    for i in 0..frames {
        let t = i as f32 / sample_rate;
        phase = (phase + std::f32::consts::TAU * frequency / sample_rate) % std::f32::consts::TAU;
        let body = high.process(rng.bipolar()) * env_ad(t, 0.0005, 0.012);
        let tone = phase.sin() * env_ad(t, 0.0003, 0.008) * 0.5;
        out.push(body * 0.8 + tone);
    }
    out
}

/// Breaks the stream: gated, quantised noise bursts on a random grid.
fn glitch(spec: &SfxSpec, sample_rate: f32, frames: usize) -> Vec<f32> {
    let mut rng = Rng::new(spec.seed);
    let mut band = Biquad::band_pass(1400.0 + spec.brightness * 2600.0, 0.8, sample_rate);
    let mut out = Vec::with_capacity(frames);
    let mut gate = 0.0f32;
    let mut held = 0.0f32;
    let mut countdown = 0u32;
    for _ in 0..frames {
        if countdown == 0 {
            countdown = (sample_rate * (0.02 + rng.unit() * 0.09)) as u32 + 1;
            gate = if rng.unit() > 0.35 { 1.0 } else { 0.0 };
            held = rng.bipolar();
        }
        countdown -= 1;
        let sample = if gate > 0.5 {
            (band.process(held) * 3.0).clamp(-1.0, 1.0).round() * 0.35
        } else {
            0.0
        };
        out.push(sample);
    }
    out
}

/// Falls away: a low sine dropping out of hearing.
fn sub(spec: &SfxSpec, sample_rate: f32, frames: usize) -> Vec<f32> {
    let duration = spec.duration.max(0.01);
    let mut out = Vec::with_capacity(frames);
    let mut phase = 0.0f32;
    for i in 0..frames {
        let t = i as f32 / sample_rate;
        let frequency = glide(t, duration, 74.0, 28.0) * spec.pitch;
        phase = (phase + std::f32::consts::TAU * frequency / sample_rate) % std::f32::consts::TAU;
        out.push(phase.sin() * env_ad(t, 0.01, duration * 0.5));
    }
    out
}

/// Holds a room: low-passed noise with a slow swell, plus a distant tone.
fn ambience(spec: &SfxSpec, sample_rate: f32, frames: usize) -> Vec<f32> {
    let mut rng = Rng::new(spec.seed);
    let duration = spec.duration.max(0.01);
    let mut low = Biquad::low_pass(700.0 + spec.brightness * 900.0, 0.6, sample_rate);
    let mut out = Vec::with_capacity(frames);
    let mut phase = 0.0f32;
    for i in 0..frames {
        let t = i as f32 / sample_rate;
        let swell = 0.55 + 0.45 * (t * 0.35).sin();
        let noise = low.process(rng.bipolar()) * 0.16;
        phase = (phase + std::f32::consts::TAU * 110.0 * spec.pitch / sample_rate) % std::f32::consts::TAU;
        let tone = phase.sin() * 0.02 * (1.0 + (t * 0.6).sin());
        let edge = if t < 0.6 { t / 0.6 } else { ((duration - t) / 0.6).clamp(0.0, 1.0) };
        out.push((noise + tone) * swell * edge);
    }
    out
}

/// Scatters light: a handful of high pings on a pentatonic set.
fn sparkle(spec: &SfxSpec, sample_rate: f32, frames: usize) -> Vec<f32> {
    let mut rng = Rng::new(spec.seed);
    let duration = spec.duration.max(0.01);
    const STEPS: [f32; 5] = [0.0, 2.0, 4.0, 7.0, 9.0];
    let mut pings: Vec<(f32, f32)> = Vec::new();
    for _ in 0..6 {
        let at = rng.unit() * duration * 0.85;
        let step = STEPS[(rng.unit() * STEPS.len() as f32) as usize % STEPS.len()];
        let frequency = 880.0 * (step / 12.0).exp2() * spec.pitch;
        pings.push((at, frequency));
    }
    let mut out = vec![0.0f32; frames];
    for (at, frequency) in pings {
        let start = (at * sample_rate) as usize;
        let mut phase = 0.0f32;
        for i in start..frames {
            let t = (i - start) as f32 / sample_rate;
            let envelope = env_ad(t, 0.002, 0.35);
            if t > 0.05 && envelope < 1e-4 {
                break;
            }
            phase = (phase + std::f32::consts::TAU * frequency / sample_rate) % std::f32::consts::TAU;
            out[i] += phase.sin() * envelope * 0.22;
        }
    }
    out
}
