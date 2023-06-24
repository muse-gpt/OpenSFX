//! Node-API surface for OpenSFX.
//!
//! Hosts describe a sound with plain JSON and get either a WAV path or the raw
//! sample buffer back. Everything is rendered by the Rust library, never in JS.

#![deny(missing_docs)]

use opensfx::{Family, SfxSpec};
use serde_json::json;
use wae::{CallContext, Env, Error, JsValue, Result, function, register_module};

/// Library version used by `@wae/open-sfx` to verify the native binary.
#[function]
fn version(ctx: CallContext) -> Result<JsValue> {
    ctx.env().string(env!("CARGO_PKG_VERSION"))
}

/// Every shipped preset name, in catalogue order.
#[function(js_name = "listPresets")]
fn list_presets(ctx: CallContext) -> Result<JsValue> {
    let names = opensfx::preset_names();
    let array = ctx.env().array_with_length(names.len())?;
    for (index, name) in names.iter().enumerate() {
        array.set_element(index as u32, ctx.env().string(name)?)?;
    }
    Ok(array)
}

/// Renders a spec or preset into a WAV file.
///
/// Argument: `{ preset?: string, spec?: object, out: string }`.
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
    opensfx::write(&spec, &out).map_err(|e| Error::new(format!("{}: {e}", e.code())))?;
    let bytes = std::fs::metadata(&out).map(|m| m.len()).unwrap_or(0);
    let value = json!({ "out": out, "bytes": bytes, "family": format!("{:?}", spec.family) });
    json_to_js(ctx.env(), &value)
}

fn resolve_spec(arg: &JsValue) -> Result<SfxSpec> {
    if let Ok(name) = arg.get_named("preset").and_then(|v| v.as_string()) {
        return opensfx::preset(&name)
            .ok_or_else(|| Error::new(format!("unknown preset: {name}")));
    }
    let spec = arg
        .get_named("spec")
        .map_err(|_| Error::new("renderSfx needs either `preset` or `spec`"))?;
    let family = match spec.get_named("family")?.as_string()?.as_str() {
        "whoosh" => Family::Whoosh,
        "impact" => Family::Impact,
        "riser" => Family::Riser,
        "tick" => Family::Tick,
        "glitch" => Family::Glitch,
        "sub" => Family::Sub,
        "ambience" => Family::Ambience,
        "sparkle" => Family::Sparkle,
        other => return Err(Error::new(format!("unknown family: {other}"))),
    };
    let duration = number(&spec, "duration", 0.5).max(0.01) as f32;
    Ok(SfxSpec {
        family,
        seed: number(&spec, "seed", 1.0) as u32,
        duration,
        pitch: number(&spec, "pitch", 1.0).max(0.05) as f32,
        brightness: number(&spec, "brightness", 0.5).clamp(0.0, 1.0) as f32,
        intensity: number(&spec, "intensity", 1.0).clamp(0.0, 1.0) as f32,
        pan: number(&spec, "pan", 0.0).clamp(-1.0, 1.0) as f32,
    })
}

/// Reads an optional numeric property, falling back when it is absent.
fn number(object: &JsValue, name: &str, fallback: f64) -> f64 {
    match object.get_named(name) {
        Ok(value) if !value.is_undefined().unwrap_or(true) => value.as_f64().unwrap_or(fallback),
        _ => fallback,
    }
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
