//! Node-API surface for OpenSFX.
//!
//! Thin binding only: the host names a preset or sends a spec as JSON, this
//! layer maps those values into `media.synthesis` ([`media_synthesis::preset`]
//! or a serde-deserialized [`media_synthesis::SfxSpec`]) and hands the spec to
//! the scene-free `media.render` sfx export entry, which renders, quantizes to
//! PCM16 and writes the WAV through `media.codec`. Every domain rule — family
//! name resolution, the parameter range contract, the seed default, the
//! deterministic synthesis and the project sample rate — lives upstream;
//! nothing here re-implements, clamps or swallows them.
//!
//! The returned `family` is the upstream kebab-case spelling
//! ([`media_synthesis::Family::as_str`]), the same spelling a spec is written
//! with. The old binding returned the Rust `Debug` PascalCase form, which was
//! asymmetric with its own hand-rolled input parsing; both are gone.

#![deny(missing_docs)]

use media_synthesis::{
    DrumPattern, Instrument, InstrumentSpec, instrument_preset, instrument_preset_names, pattern_preset,
    pattern_preset_names, preset, preset_names, SfxSpec,
};
use media_types::SAMPLE_RATE;
use wae::{CallContext, Env, Error, JsValue, Result, function, register_module};

/// Library version used by `@wae/open-sfx` to verify the native binary.
#[function]
fn version(ctx: CallContext) -> Result<JsValue> {
    ctx.env().string(env!("CARGO_PKG_VERSION"))
}

/// Every shipped preset name, in upstream catalogue order.
#[function(js_name = "listPresets")]
fn list_presets(ctx: CallContext) -> Result<JsValue> {
    let names = preset_names();
    let array = ctx.env().array_with_length(names.len())?;
    for (index, name) in names.iter().enumerate() {
        array.set_element(index as u32, ctx.env().string(name)?)?;
    }
    Ok(array)
}

/// Every playable instrument name, in upstream order.
#[function(js_name = "listInstruments")]
fn list_instruments(ctx: CallContext) -> Result<JsValue> {
    let array = ctx.env().array_with_length(Instrument::ALL.len())?;
    for (index, instrument) in Instrument::ALL.iter().enumerate() {
        array.set_element(index as u32, ctx.env().string(instrument.as_str())?)?;
    }
    Ok(array)
}

/// Every shipped instrument preset name, in upstream catalogue order.
#[function(js_name = "listInstrumentPresets")]
fn list_instrument_presets(ctx: CallContext) -> Result<JsValue> {
    let names = instrument_preset_names();
    let array = ctx.env().array_with_length(names.len())?;
    for (index, name) in names.iter().enumerate() {
        array.set_element(index as u32, ctx.env().string(name)?)?;
    }
    Ok(array)
}

/// Every shipped drum-groove preset name, in upstream catalogue order.
#[function(js_name = "listPatterns")]
fn list_patterns(ctx: CallContext) -> Result<JsValue> {
    let names = pattern_preset_names();
    let array = ctx.env().array_with_length(names.len())?;
    for (index, name) in names.iter().enumerate() {
        array.set_element(index as u32, ctx.env().string(name)?)?;
    }
    Ok(array)
}

/// Renders one instrument preset or instrument spec into a WAV file.
///
/// Argument: `{ out: string, preset?: string, spec?: string }` — exactly one
/// of the two. Spec JSON follows the upstream `InstrumentSpec` shape
/// (kebab-case `instrument`, camelCase fields).
#[function(js_name = "renderInstrument")]
fn render_instrument(ctx: CallContext) -> Result<JsValue> {
    let arg = ctx
        .args()
        .first()
        .copied()
        .ok_or_else(|| Error::new("renderInstrument requires an options object"))?;
    let out = arg.get_named("out")?.as_string()?;
    let spec = match (optional_string(&arg, "preset")?, optional_string(&arg, "spec")?) {
        (Some(name), None) => instrument_preset(&name).ok_or_else(|| {
            map_domain_error(media_types::Error::invalid_input(format!("unknown instrument preset: {name}")))
        })?,
        (None, Some(json)) => serde_json::from_value::<InstrumentSpec>(domain_value(&json)?).map_err(|e| map_domain_error(media_types::Error::invalid_input(format!("spec: {e}"))))?,
        (Some(_), Some(_)) => {
            return Err(map_domain_error(media_types::Error::invalid_input(
                "provide either preset or spec, not both",
            )));
        }
        (None, None) => {
            return Err(map_domain_error(media_types::Error::invalid_input(
                "renderInstrument requires either a preset name or a spec JSON",
            )));
        }
    };
    prepare_parent(&out)?;
    media_render::write_instrument(&spec, &out, SAMPLE_RATE).map_err(map_domain_error)?;
    let written = read_back(&out)?;
    json_to_js(
        ctx.env(),
        &serde_json::json!({
            "out": out,
            "bytes": written.len() as u64,
            "fingerprint": fnv1a(&written),
            "instrument": spec.instrument.as_str(),
        }),
    )
}

/// Renders one drum-groove preset or groove spec into a WAV file.
///
/// Argument: `{ out: string, preset?: string, spec?: string }` — exactly one
/// of the two. Spec JSON follows the upstream `DrumPattern` shape.
#[function(js_name = "renderPattern")]
fn render_pattern(ctx: CallContext) -> Result<JsValue> {
    let arg = ctx
        .args()
        .first()
        .copied()
        .ok_or_else(|| Error::new("renderPattern requires an options object"))?;
    let out = arg.get_named("out")?.as_string()?;
    let pattern = match (optional_string(&arg, "preset")?, optional_string(&arg, "spec")?) {
        (Some(name), None) => pattern_preset(&name).ok_or_else(|| {
            map_domain_error(media_types::Error::invalid_input(format!("unknown pattern preset: {name}")))
        })?,
        (None, Some(json)) => serde_json::from_value::<DrumPattern>(domain_value(&json)?).map_err(|e| map_domain_error(media_types::Error::invalid_input(format!("spec: {e}"))))?,
        (Some(_), Some(_)) => {
            return Err(map_domain_error(media_types::Error::invalid_input(
                "provide either preset or spec, not both",
            )));
        }
        (None, None) => {
            return Err(map_domain_error(media_types::Error::invalid_input(
                "renderPattern requires either a preset name or a spec JSON",
            )));
        }
    };
    prepare_parent(&out)?;
    media_render::write_pattern(&pattern, &out, SAMPLE_RATE).map_err(map_domain_error)?;
    let written = read_back(&out)?;
    json_to_js(
        ctx.env(),
        &serde_json::json!({
            "out": out,
            "bytes": written.len() as u64,
            "fingerprint": fnv1a(&written),
            "bpm": pattern.bpm,
            "seconds": pattern.duration_seconds(),
        }),
    )
}

/// Reads the written file back so `bytes` and `fingerprint` describe the exact
/// asset on disk rather than the request that produced it.
fn read_back(out: &str) -> Result<Vec<u8>> {
    std::fs::read(out).map_err(|e| Error::new(format!("cannot read back {out}: {e}")))
}

/// FNV-1a 64 of the written file, in the same `016x` form as the other hashes.
fn fnv1a(bytes: &[u8]) -> String {
    let mut state = 0xcbf2_9ce4_8422_2325_u64;
    for byte in bytes {
        state ^= u64::from(*byte);
        state = state.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{state:016x}")
}

fn prepare_parent(out: &str) -> Result<()> {
    if let Some(parent) = std::path::Path::new(out).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| Error::new(format!("cannot create output directory: {e}")))?;
        }
    }
    Ok(())
}

/// Renders a spec or preset into a WAV file.
///
/// Argument: `{ out: string, preset?: string, spec?: string }` — exactly one
/// of `preset` (a catalogue name resolved by `media.synthesis`) or `spec`
/// (JSON with JS-style camelCase keys, mapped to the domain's snake_case
/// fields by this binding). Unknown preset names, unknown families, missing
/// or out-of-range parameters, non-finite values and malformed JSON reject
/// with the stable `invalid_input:` prefix; output directory and write
/// failures keep their `io:` code. The sample rate is the project default from
/// `media.types`, passed explicitly — hosts cannot pick another rate here.
#[function(js_name = "renderSfx")]
fn render_sfx(ctx: CallContext) -> Result<JsValue> {
    let arg = ctx
        .args()
        .first()
        .copied()
        .ok_or_else(|| Error::new("renderSfx requires an options object"))?;
    let out = arg.get_named("out")?.as_string()?;
    let spec = resolve_spec(&arg)?;

    if let Some(parent) = std::path::Path::new(&out).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| Error::new(format!("cannot create output directory: {e}")))?;
        }
    }

    media_render::write_sfx(&spec, &out, SAMPLE_RATE).map_err(map_domain_error)?;

    let written = read_back(&out)?;
    let value = serde_json::json!({
        "out": out,
        "bytes": written.len() as u64,
        "fingerprint": fnv1a(&written),
        "family": spec.family.as_str(),
    });
    json_to_js(ctx.env(), &value)
}

/// Resolves exactly one of `preset` / `spec` into an upstream [`SfxSpec`].
///
/// Preset lookup and JSON deserialization are the authoritative entries; this
/// layer only maps their failures. There is no preset-over-spec precedence and
/// no silent fallback: both, neither or a malformed value is an explicit
/// `invalid_input`.
fn resolve_spec(arg: &JsValue) -> Result<SfxSpec> {
    match (optional_string(arg, "preset")?, optional_string(arg, "spec")?) {
        (Some(name), None) => preset(&name).ok_or_else(|| {
            map_domain_error(media_types::Error::invalid_input(format!("unknown preset: {name}")))
        }),
        (None, Some(json)) => serde_json::from_value::<SfxSpec>(domain_value(&json)?).map_err(|e| {
            map_domain_error(media_types::Error::invalid_input(format!("spec: {e}")))
        }),
        (Some(_), Some(_)) => Err(map_domain_error(media_types::Error::invalid_input(
            "provide either preset or spec, not both",
        ))),
        (None, None) => Err(map_domain_error(media_types::Error::invalid_input(
            "renderSfx requires either a preset name or a spec JSON",
        ))),
    }
}

/// Reads one optional string property: absent or undefined is `None`, a
/// present non-string value rejects explicitly instead of falling back.
fn optional_string(object: &JsValue, name: &str) -> Result<Option<String>> {
    let value = object.get_named(name)?;
    if value.is_undefined().unwrap_or(true) {
        return Ok(None);
    }
    value.as_string().map(Some).map_err(|_| {
        map_domain_error(media_types::Error::invalid_input(format!("{name}: expected a string")))
    })
}

/// Parses JS-style JSON into the domain wire shape.
///
/// The media.rs contract is Rust snake_case; the TypeScript authoring surface
/// is camelCase. That translation is this binding's job and happens here, at
/// the only place JS values enter the domain — the Rust domain keeps its
/// native field names for every other language binding.
fn domain_value(raw: &str) -> Result<serde_json::Value> {
    let value: serde_json::Value = serde_json::from_str(raw)
        .map_err(|e| map_domain_error(media_types::Error::invalid_input(format!("spec: {e}"))))?;
    Ok(snake_keys(value))
}

fn snake_keys(value: serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(map) => serde_json::Value::Object(
            map.into_iter().map(|(key, inner)| (camel_to_snake(&key), snake_keys(inner))).collect(),
        ),
        serde_json::Value::Array(items) => serde_json::Value::Array(items.into_iter().map(snake_keys).collect()),
        other => other,
    }
}

fn camel_to_snake(key: &str) -> String {
    let mut out = String::with_capacity(key.len() + 4);
    for letter in key.chars() {
        if letter.is_ascii_uppercase() {
            out.push('_');
            out.push(letter.to_ascii_lowercase());
        } else {
            out.push(letter);
        }
    }
    out
}

/// Maps a `media.types` domain error onto a host error, keeping the stable
/// code (`invalid_input`, `io`, …) as the message prefix so JS callers can
/// attribute failures without parsing prose.
fn map_domain_error(error: media_types::Error) -> Error {
    Error::new(format!("{}: {error}", error.code()))
}

fn json_to_js(env: Env, value: &serde_json::Value) -> Result<JsValue> {
    match value {
        serde_json::Value::Null => env.null(),
        serde_json::Value::Bool(inner) => env.boolean(*inner),
        serde_json::Value::Number(number) => {
            if let Some(integer) = number.as_i64() {
                env.int64(integer)
            } else {
                env.double(number.as_f64().unwrap_or(0.0))
            }
        }
        serde_json::Value::String(text) => env.string(text),
        serde_json::Value::Array(items) => {
            let array = env.array_with_length(items.len())?;
            for (index, item) in items.iter().enumerate() {
                array.set_element(index as u32, json_to_js(env, item)?)?;
            }
            Ok(array)
        }
        serde_json::Value::Object(map) => {
            let object = env.object()?;
            for (key, item) in map {
                object.set_named(key, json_to_js(env, item)?)?;
            }
            Ok(object)
        }
    }
}

register_module![
    version,
    list_presets,
    list_instruments,
    list_instrument_presets,
    list_patterns,
    render_sfx,
    render_instrument,
    render_pattern
];
