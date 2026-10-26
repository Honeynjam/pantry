// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(debug_assertions)]
mod spike;

fn main() {
    let builder = tauri::Builder::default();

    // Debug builds only: the spike's evidence hooks (terminal log, optional auto sign-in, snapshot).
    #[cfg(debug_assertions)]
    let builder = builder
        .invoke_handler(tauri::generate_handler![spike::spike_report, spike::spike_snapshot])
        .on_page_load(spike::on_page_load);

    builder
        .run(tauri::generate_context!())
        .expect("error while running the Pantry app");
}
