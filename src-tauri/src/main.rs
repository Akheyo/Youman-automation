// Beim Release-Build kein Konsolen-Fenster anzeigen
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    daev_margin_tool_lib::run()
}
