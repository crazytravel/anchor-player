use mpsc::channel;
use std::{
    sync::mpsc::{self, Receiver},
    thread,
};

use crate::music::{Music, MusicImage, MusicMeta};
use log::error;
use music::MusicInfo;
use serde::Serialize;
use tauri::{AppHandle, Emitter, TitleBarStyle, WebviewUrl, WebviewWindowBuilder};

mod file_reader;
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
    let (music_meta_tx, music_meta_rx) = channel::<MusicMeta>();
    let (music_image_tx, music_image_rx) = channel::<MusicImage>();
    let finished_app = app.clone();
    let music_info_app = app.clone();
    let music_meta_app = app.clone();
    let music_image_app = app.clone();
    thread::spawn(move || {
        let code = player::start_play(
            path.as_str(),
            &music_tx,
            &music_info_tx,
            &music_meta_tx,
            &music_image_tx,
        )
        .unwrap_or_else(|err| {
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
    thread::spawn(move || {
        for music_meta in music_meta_rx {
            music_meta_app.emit("music-meta", music_meta).unwrap();
        }
    });
    thread::spawn(move || {
        for music_image in music_image_rx {
            music_image_app.emit("music-image", music_image).unwrap();
        }
    });
}

#[tauri::command]
fn pause() {
    player::pause();
}

#[tauri::command]
fn list_files(dirs: Vec<String>) -> Vec<String> {
    let files = file_reader::read_directory_files(dirs).unwrap_or_else(|err| {
        error!("{}", err.to_string().to_lowercase());
        Vec::new()
    });
    files
}

#[tauri::command]
fn set_volume(volume: f32) {
    output::set_volume(volume);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            play, pause, list_files, set_volume
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
