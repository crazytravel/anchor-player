use mpsc::channel;
use std::{
    sync::mpsc::{self, Receiver},
    thread,
};

use crate::music::Music;
use log::error;
use music::MusicInfo;
use serde::Serialize;
use tauri::{AppHandle, Emitter, TitleBarStyle, WebviewUrl, WebviewWindowBuilder};

mod music;
mod output;
mod player;
#[cfg(not(target_os = "linux"))]
mod resampler;

#[tauri::command]
fn play(music_path: &str, app: AppHandle) {
    let path = music_path.to_string();
    let (music_tx, music_rx) = channel::<Music>();
    let (music_info_tx, music_info_rx) = channel::<MusicInfo>();
    let finished_app = app.clone();
    let music_info_app = app.clone();
    thread::spawn(move || {
        let code = player::start_play(path.as_str(), &music_tx, &music_info_tx).unwrap_or_else(|err| {
            error!("{}", err.to_string().to_lowercase());
            -1
        });
        if code != -1 {
            finished_app.emit("finished", true).unwrap();
        }
    });
    thread::spawn(move || {
        for music_info in music_info_rx {
            music_info_app.emit("music-info", music_info).unwrap();
        }
    });
    thread::spawn(move || {
        for music in music_rx {
            app.emit("music", music).unwrap();
        }
    });
}

#[tauri::command]
fn pause() {
    player::pause();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let win_builder =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                    .title("Anchor Player")
                    .inner_size(1024.0, 600.0);

            // set transparent title bar only when building for macOS
            #[cfg(target_os = "macos")]
            let win_builder = win_builder.title_bar_style(TitleBarStyle::Transparent);

            let window = win_builder.build().unwrap();

            // set background color only when building for macOS
            #[cfg(target_os = "macos")]
            {
                use cocoa::appkit::{NSColor, NSWindow};
                use cocoa::base::{id, nil};

                let ns_window = window.ns_window().unwrap() as id;
                unsafe {
                    let bg_color = NSColor::colorWithRed_green_blue_alpha_(
                        nil,
                        222.0 / 255.0,
                        227.0 / 255.0,
                        232.0 / 255.0,
                        1.0,
                    );
                    ns_window.setBackgroundColor_(bg_color);
                }
            }

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![play, pause])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
