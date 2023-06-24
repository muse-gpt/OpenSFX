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

use media_synthesis::{SfxSpec, preset, preset_names};
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

/// Renders a spec or preset into a WAV file.
///
/// Argument: `{ out: string, preset?: string, spec?: string }` — exactly one
/// of `preset` (a catalogue name resolved by `media.synthesis`) or `spec`
/// (JSON in the `media.synthesis` spec shape: kebab-case `family`, camelCase
/// fields, `seed` defaulting to 1) is required. Unknown preset names, unknown
/// families, missing or out-of-range parameters, non-finite values and
/// malformed JSON reject with the stable `invalid_input:` prefix; output
/// directory and write failures keep their `io:` code. The sample rate is the
/// project default from `media.types`, passed explicitly — hosts cannot pick
/// another rate through this binding.
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

    let bytes = std::fs::metadata(&out).map(|m| m.len()).unwrap_or(0);
    let value = serde_json::json!({
        "out": out,
        "bytes": bytes,
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
        (None, Some(json)) => serde_json::from_str::<SfxSpec>(&json).map_err(|e| {
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

register_module![version, list_presets, render_sfx];
