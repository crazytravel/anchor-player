use mpsc::channel;
use std::{
    any::Any,
    sync::{
        mpsc::{self},
        RwLock,
    },
    thread::{self},
};
use store::{PLAYLIST_STORE_FILENAME, PLAY_STATE_STORE_FILENAME, SETTINGS_STORE_FILENAME};
use symphonia::core::units::Time;
use tauri_plugin_store::StoreExt;

use log::error;
use music::{MusicError, MusicFile, MusicImage, MusicInfo, MusicMeta, MusicSetting, PlayState};
use tauri::{AppHandle, Emitter, Manager};

mod file_reader;
mod music;
mod output;
mod player;
#[cfg(not(target_os = "linux"))]
mod resampler;
mod store;

#[derive(Clone, Debug)]
pub struct AppState {
    pub id: i32,
    pub paused: bool,
    pub volume: f32,
    pub music_files: Vec<MusicFile>,
    pub sequence_type: u32, // 1: repeat 2: repeat_one 3: random
    pub time_position: Option<Time>,
}

impl AppState {
    pub fn default() -> Self {
        Self {
            id: -1,
            paused: false,
            volume: 1.0,
            music_files: Vec::new(),
            sequence_type: 1,
            time_position: None,
        }
    }
}

fn play_music(id: i32, position: Option<Time>, app: AppHandle) {
    {
        let state_handle = app.state::<RwLock<AppState>>();
        let mut state = state_handle.write().unwrap();
        if !state.paused {
            state.paused = true;
        }
    }
    thread::sleep(std::time::Duration::from_millis(200));
    {
        let state_handle = app.state::<RwLock<AppState>>();
        let mut state = state_handle.write().unwrap();
        state.id = id;
        state.paused = false;
    }
    let app_player = app.clone();
    let app_info = app.clone();
    let app_play_state = app.clone();
    let app_meta = app.clone();
    let app_image = app.clone();
    let (play_state_tx, play_state_rx) = channel::<PlayState>();
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
                position,
                path.as_str(),
                &play_state_tx,
                &music_info_tx,
                &music_meta_tx,
                &music_image_tx,
            )
            .unwrap_or_else(|err| {
                error!("{}", err.to_string().to_lowercase());
                app_player
                    .emit(
                        "error",
                        MusicError::new(id, music_file.name, err.to_string().to_lowercase()),
                    )
                    .unwrap();
                -1
            });
            if code == 100 {
                let cloned_app = app_player.clone();
                app_player.emit("finished", id).unwrap();
                let next_id;
                {
                    let state_handle = app.state::<RwLock<AppState>>();
                    let mut state = state_handle.write().unwrap();
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
                    state.time_position = None;
                }
                play_music(next_id, None, cloned_app);
            }
        });
        thread::spawn(move || {
            for music_info in music_info_rx {
                app_info.emit("music-info", music_info).unwrap();
            }
        });
        thread::spawn(move || {
            for play_state in play_state_rx {
                let cloned_play_state = play_state.clone();
                app_play_state.emit("play-state", play_state).unwrap();
                store::store_play_state(&app_play_state, Some(cloned_play_state));
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
fn play(id: i32, time: Option<f64>, app: AppHandle) {
    if id != -1 {
        play_music(id, None, app);
        return;
    }
    let mut current_id;
    let position;
    {
        let cloned_app = app.clone();
        let state_handle = cloned_app.state::<RwLock<AppState>>();
        let state = state_handle.read().unwrap();
        if state.id == -1 {
            current_id = 0;
        } else {
            current_id = state.id;
        }
        let music_file = state
            .music_files
            .iter()
            .find(|&music_file| music_file.id == current_id);
        if music_file.is_none() {
            current_id = 0;
        }
        position = state.time_position;
    }
    if let Some(time) = time {
        let time = convert_to_time(time);
        println!("time:{:#?}", time);
        play_music(current_id, Some(time), app);
        return;
    }
    play_music(current_id, position, app);
}

#[tauri::command]
fn play_next(app: AppHandle) {
    let next_id;
    {
        let cloned_app = app.clone();
        let state_handle = cloned_app.state::<RwLock<AppState>>();
        let mut state = state_handle.write().unwrap();
        let id = state.id;
        let index = match state
            .music_files
            .iter()
            .position(|music_file| music_file.id == id)
        {
            Some(index) => index as i32,
            None => -1,
        };
        let next_index = index + 1;
        next_id = if next_index < state.music_files.len() as i32 {
            match state.music_files.get(next_index as usize) {
                Some(music_file) => music_file.id,
                None => 0,
            }
        } else {
            0
        };
        state.time_position = None;
    }
    play_music(next_id, Option::None, app);
}

#[tauri::command]
fn play_previous(app: AppHandle) {
    let prevois_id;
    {
        let cloned_app = app.clone();
        let state_handle = cloned_app.state::<RwLock<AppState>>();
        let mut state = state_handle.write().unwrap();
        let id = state.id;
        let index = match state
            .music_files
            .iter()
            .position(|music_file| music_file.id == id)
        {
            Some(index) => index as i32,
            None => 0,
        };
        let prevois_index = index - 1;
        prevois_id = if prevois_index >= 0 {
            match state.music_files.get(prevois_index as usize) {
                Some(music_file) => music_file.id,
                None => 0,
            }
        } else {
            state.music_files.len() as i32 - 1
        };
        state.time_position = None;
    }
    play_music(prevois_id, Option::None, app);
}

#[tauri::command]
fn pause(app: AppHandle) {
    let state_handle = app.state::<RwLock<AppState>>();
    let mut state = state_handle.write().unwrap();
    state.paused = true;
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
    store::store_settings(&app, MusicSetting::default().with_volume(state.volume));
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
    store::store_settings(
        &app,
        MusicSetting::default().with_sequence_type(sequence_type),
    );
}

#[tauri::command]
fn playlist_add(music_files: Vec<MusicFile>, app: AppHandle) {
    let state_handle = app.state::<RwLock<AppState>>();
    let mut state = state_handle.write().unwrap();
    state.music_files = music_files;
    store::store_playlist(&app, &state.music_files);
}

#[tauri::command]
fn delete_from_playlist(id: i32, app: AppHandle) {
    let state_handle = app.state::<RwLock<AppState>>();
    let mut state = state_handle.write().unwrap();
    state.music_files.retain(|music_file| music_file.id != id);
    store::store_playlist(&app, &state.music_files);
}

#[tauri::command]
fn clear_playlist(app: AppHandle) {
    let state_handle = app.state::<RwLock<AppState>>();
    let mut state = state_handle.write().unwrap();
    state.music_files.clear();
    store::store_playlist(&app, &state.music_files);
    store::store_play_state(&app, None);
}

#[tauri::command]
fn load_playlist(app: AppHandle) -> Vec<MusicFile> {
    let playlist = store::load_playlist(&app);
    let cloned_playlist = playlist.clone();
    let state_handle = app.state::<RwLock<AppState>>();
    let mut state = state_handle.write().unwrap();
    state.music_files = cloned_playlist;
    playlist
}

#[tauri::command]
fn load_settings(app: AppHandle) -> MusicSetting {
    let settings = store::load_settings(&app);
    let state_handle = app.state::<RwLock<AppState>>();
    let mut state = state_handle.write().unwrap();
    state.volume = settings.volume;
    state.sequence_type = settings.sequence_type;
    settings
}

#[tauri::command]
fn load_play_state(app: AppHandle) -> Option<PlayState> {
    let play_state = store::load_play_state(&app);
    println!("play_state:{:#?}", play_state);
    match play_state {
        Some(play_state) => {
            let cloned_play_state = play_state.clone();
            let state_handle = app.state::<RwLock<AppState>>();
            let mut state = state_handle.write().unwrap();
            state.id = cloned_play_state.id;
            state.time_position = Some(parse_str_time(cloned_play_state.progress));
            Some(play_state)
        }
        None => None,
    }
}

#[tauri::command]
fn show_main_window(window: tauri::Window) {
    window.get_webview_window("main").unwrap().show().unwrap();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(RwLock::new(AppState::default()))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            playlist_add,
            play,
            pause,
            play_next,
            play_previous,
            list_files,
            set_volume,
            get_current_music,
            change_sequence_type,
            delete_from_playlist,
            clear_playlist,
            show_main_window,
            load_playlist,
            load_settings,
            load_play_state
        ])
        // .setup(|app| {
        //     #[cfg(target_os = "macos")]
        //     {
        //         app.set_activation_policy(tauri::ActivationPolicy::Accessory);
        //     }
        //     Ok(())
        // })
        .setup(|app| {
            app.store(SETTINGS_STORE_FILENAME)?;
            app.store(PLAYLIST_STORE_FILENAME)?;
            app.store(PLAY_STATE_STORE_FILENAME)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// 0:00:00.0
fn parse_str_time(time: String) -> Time {
    let time = time.split(":").collect::<Vec<&str>>();
    let hour = time[0].parse::<f64>().unwrap();
    let minute = time[1].parse::<f64>().unwrap();
    let second_frac = time[2];
    let second_time = second_frac.split(".").collect::<Vec<&str>>();
    let second = second_time[0].parse::<f64>().unwrap();
    let fractional = second_time[1].parse::<f64>().unwrap();
    let num = hour * 3600.0 + minute * 60.0 + second + fractional;
    convert_to_time(num)
}

fn convert_to_time(time: f64) -> Time {
    let integer_part = time.floor() as u64;
    let fractional_part = time - integer_part as f64;
    Time::new(integer_part, fractional_part)
}
