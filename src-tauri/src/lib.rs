use mpsc::channel;
use std::{
    sync::{
        mpsc::{self},
        RwLock,
    },
    thread::{self},
};

use crate::music::{Music, MusicImage, MusicMeta};
use log::error;
use music::{MusicFile, MusicInfo};
use tauri::{AppHandle, Emitter, Manager};

mod file_reader;
mod music;
mod output;
mod player;
#[cfg(not(target_os = "linux"))]
mod resampler;

#[derive(Clone, Debug)]
pub struct AppState {
    pub id: i32,
    pub paused: bool,
    pub volume: f32,
    pub music_files: Vec<MusicFile>,
    pub sequence_type: u32, // 1: repeat 2: repeat_one 3: random
    pub time_position: f64,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            id: -1,
            paused: false,
            volume: 1.0,
            music_files: Vec::new(),
            sequence_type: 1,
            time_position: 0.0,
        }
    }
}

fn play_music(id: i32, app: AppHandle) {
    {
        let state_handle = app.state::<RwLock<AppState>>();
        let mut state = state_handle.write().unwrap();
        if !state.paused {
            state.paused = true;
        }
    }
    thread::sleep(std::time::Duration::from_millis(100));
    {
        let state_handle = app.state::<RwLock<AppState>>();
        let mut state = state_handle.write().unwrap();
        state.id = id;
        state.paused = false;
    }
    let app_player = app.clone();
    let app_info = app.clone();
    let app_music = app.clone();
    let app_meta = app.clone();
    let app_image = app.clone();
    let (music_tx, music_rx) = channel::<Music>();
    let (music_info_tx, music_info_rx) = channel::<MusicInfo>();
    let (music_meta_tx, music_meta_rx) = channel::<MusicMeta>();
    let (music_image_tx, music_image_rx) = channel::<MusicImage>();

    // Find the music file outside of the lock
    let music_file = {
        let state_handle = app.state::<RwLock<AppState>>();
        let state = state_handle.read().unwrap();
        state
            .music_files
            .iter()
            .find(|&music_file| music_file.id == id)
            .cloned()
    };

    if let Some(music_file) = music_file {
        let path = music_file.path.clone();
        println!("the path: {:#?}", path);
        thread::spawn(move || {
            let code = player::start_play(
                &app_player,
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
            if code == 100 {
                let cloned_app = app_player.clone();
                app_player.emit("finished", id).unwrap();
                let next_id;
                {
                    let state_handle = app.state::<RwLock<AppState>>();
                    let state = state_handle.read().unwrap();
                    if state.sequence_type == 2 {
                        next_id = id;
                    } else if state.sequence_type == 3 {
                        let id = rand::random::<i32>() % state.music_files.len() as i32;
                        next_id = id;
                    } else {
                        next_id = if id + 1 < state.music_files.len() as i32 {
                            id + 1
                        } else {
                            0
                        };
                    }
                }
                play_music(next_id, cloned_app);
            };
        });
        thread::spawn(move || {
            for music_info in music_info_rx {
                app_info.emit("music-info", music_info).unwrap();
            }
        });
        thread::spawn(move || {
            for music in music_rx {
                app_music.emit("music", music).unwrap();
            }
        });
        thread::spawn(move || {
            for music_meta in music_meta_rx {
                app_meta.emit("music-meta", music_meta).unwrap();
            }
        });
        thread::spawn(move || {
            for music_image in music_image_rx {
                app_image.emit("music-image", music_image).unwrap();
            }
        });
    }
}

#[tauri::command]
fn set_music_files(music_files: Vec<MusicFile>, app: AppHandle) {
    let state_handle = app.state::<RwLock<AppState>>();
    let mut state = state_handle.write().unwrap();
    state.music_files = music_files;
}

#[tauri::command]
fn play(id: i32, app: AppHandle) {
    if id != -1 {
        play_music(id, app);
        return;
    }
    let current_id;
    {
        let cloned_app = app.clone();
        let state_handle = cloned_app.state::<RwLock<AppState>>();
        let state = state_handle.read().unwrap();
        if state.id == -1 {
            current_id = 0;
        } else {
            current_id = state.id;
        }
    }
    play_music(current_id, app);
}

#[tauri::command]
fn play_next(app: AppHandle) {
    let next_id;
    {
        let cloned_app = app.clone();
        let state_handle = cloned_app.state::<RwLock<AppState>>();
        let state = state_handle.read().unwrap();
        let id = state.id;
        next_id = if id + 1 < state.music_files.len() as i32 {
            id + 1
        } else {
            0
        };
    }
    play_music(next_id, app);
}

#[tauri::command]
fn play_prevois(app: AppHandle) {
    let prevois_id;
    {
        let cloned_app = app.clone();
        let state_handle = cloned_app.state::<RwLock<AppState>>();
        let state = state_handle.read().unwrap();
        let id = state.id;
        prevois_id = if id - 1 >= 0 {
            id - 1
        } else {
            state.music_files.len() as i32 - 1
        };
    }
    play_music(prevois_id, app);
}

#[tauri::command]
fn pause(app: AppHandle) {
    // player::pause(&app);
    let state_handle = app.state::<RwLock<AppState>>();
    let mut state = state_handle.write().unwrap();
    state.paused = true;
    state.id = -1;
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
fn set_volume(volume: f32, app: AppHandle) {
    let clamped = volume.clamp(0.0, 1.0);
    let state_handle = app.state::<RwLock<AppState>>();
    let mut state = state_handle.write().unwrap();
    state.volume = clamped;
}

#[tauri::command]
fn get_current_music(app: AppHandle) -> Option<MusicFile> {
    let state_handle = app.state::<RwLock<AppState>>();
    let state = state_handle.read().unwrap();
    state
        .music_files
        .iter()
        .find(|&music_file| music_file.id == state.id)
        .cloned()
}

#[tauri::command]
fn change_sequence_type(sequence_type: u32, app: AppHandle) {
    let state_handle = app.state::<RwLock<AppState>>();
    let mut state = state_handle.write().unwrap();
    state.sequence_type = sequence_type;
}

#[tauri::command]
fn delete_from_playlist(id: i32, app: AppHandle) {
    let state_handle = app.state::<RwLock<AppState>>();
    let mut state = state_handle.write().unwrap();
    state.music_files.retain(|music_file| music_file.id != id);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RwLock::new(AppState::new()))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            set_music_files,
            play,
            pause,
            play_next,
            play_prevois,
            list_files,
            set_volume,
            get_current_music,
            change_sequence_type,
            delete_from_playlist
        ])
        // .setup(|app| {
        //     #[cfg(target_os = "macos")]
        //     {
        //         app.set_activation_policy(tauri::ActivationPolicy::Accessory);
        //     }
        //     Ok(())
        // })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
