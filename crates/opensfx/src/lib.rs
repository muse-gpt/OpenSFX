//! OpenSFX — procedural sound effects.
//!
//! A sound is a spec, not a binary: `SfxSpec` plus a seed always renders the
//! same samples, so a catalogue can be regenerated at build time and shipped as
//! WAVs without keeping audio assets in the repository.
//!
//! ```rust
//! use opensfx::{Family, SfxSpec, render};
//! let spec = SfxSpec::new(Family::Whoosh, 0.9);
//! let samples = render(&spec, 44_100.0);
//! assert!(samples.len() > 1000);
//! ```

pub mod dsp;
pub mod spec;
pub mod voices;

pub use spec::{Family, PRESETS, Preset, SfxSpec, preset, preset_names};
pub use voices::render;

use media::types::SAMPLE_RATE;

/// Renders `spec` at the shared sample rate and writes it as a PCM16 WAV.
pub fn write(spec: &SfxSpec, path: &str) -> Result<(), media::Error> {
    let samples = render(spec, SAMPLE_RATE as f32);
    let pcm: Vec<i16> = samples
        .iter()
        .flat_map(|frame| {
            frame
                .iter()
                .map(|sample| (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
        })
        .collect();
    media::audio::write_wav(path, &pcm)
}

/// Renders every shipped preset into `directory`, one WAV per preset.
///
/// Returns the written paths in catalogue order.
pub fn write_catalogue(directory: &str) -> Result<Vec<String>, media::Error> {
    std::fs::create_dir_all(directory).map_err(|e| media::Error::io(format!("{directory}: {e}")))?;
    let mut written = Vec::new();
    for entry in PRESETS {
        let path = format!("{directory}/{}.wav", entry.name);
        write(&entry.spec, &path)?;
        written.push(path);
    }
    Ok(written)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rendering_is_deterministic_per_seed() {
        let spec = SfxSpec::new(Family::Whoosh, 0.5).with(7, 1.0, 0.5);
        let a = render(&spec, 44_100.0);
        let b = render(&spec, 44_100.0);
        assert_eq!(a.len(), b.len());
        assert!(a.iter().zip(&b).all(|(x, y)| x == y));
    }

    #[test]
    fn different_seeds_change_the_noise() {
        let a = render(&SfxSpec::new(Family::Whoosh, 0.4).with(1, 1.0, 0.5), 44_100.0);
        let b = render(&SfxSpec::new(Family::Whoosh, 0.4).with(2, 1.0, 0.5), 44_100.0);
        assert!(a.iter().zip(&b).any(|(x, y)| x != y));
    }

    #[test]
    fn every_family_produces_audible_samples() {
        for family in [
            Family::Whoosh,
            Family::Impact,
            Family::Riser,
            Family::Tick,
            Family::Glitch,
            Family::Sub,
            Family::Ambience,
            Family::Sparkle,
        ] {
            let samples = render(&SfxSpec::new(family, 0.6), 44_100.0);
            let peak = samples
                .iter()
                .flat_map(|s| s.iter())
                .fold(0.0f32, |a, b| a.max(b.abs()));
            assert!(peak > 0.02, "{family:?} too quiet: {peak}");
            assert!(peak <= 1.01, "{family:?} clipped: {peak}");
        }
    }

    #[test]
    fn duration_controls_length() {
        let samples = render(&SfxSpec::new(Family::Tick, 0.25), 44_100.0);
        assert_eq!(samples.len(), 11_025);
    }

    #[test]
    fn presets_are_unique_and_renderable() {
        let names = preset_names();
        let unique: std::collections::BTreeSet<_> = names.iter().collect();
        assert_eq!(unique.len(), names.len());
        for name in names {
            let spec = preset(name).expect("preset resolves");
            assert!(spec.duration > 0.0);
        }
    }
}
