//! Renders the shipped catalogue to WAV files.
//!
//! `cargo run -p opensfx --example render_pack -- ./out`

fn main() {
    let directory = std::env::args().nth(1).unwrap_or_else(|| "out".to_string());
    let written = opensfx::write_catalogue(&directory).expect("render catalogue");
    for path in &written {
        println!("{path}");
    }
    println!("{} presets -> {directory}", written.len());
}
