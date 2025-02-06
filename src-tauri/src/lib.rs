use state::{
    EventSource, IdState, MusicFilesState, PauseState, Payload, SequenceTypeState,
    TimePositionState, VolumeState,
};
use std::{
    sync::{mpsc::channel, Mutex},
    thread::{self},
};
use store::{PLAYLIST_STORE_FILENAME, PLAY_STATE_STORE_FILENAME, SETTINGS_STORE_FILENAME};
use symphonia::core::units::Time;
use tauri_plugin_store::StoreExt;

use log::error;
use music::{MusicError, MusicFile, MusicImage, MusicInfo, MusicMeta, MusicSetting, PlayState};
use tauri::{AppHandle, Emitter, Manager, State};

mod file_reader;
mod music;
mod output;
mod player;
#[cfg(not(target_os = "linux"))]
mod resampler;
mod state;
mod store;

fn play_music(id: i32, position: Option<Time>, app: AppHandle) {
    {
        let id_state = app.state::<Mutex<IdState>>();
        let mut id_state = id_state.lock().unwrap();
        id_state.set(id);
    }
    {
        let pause_state = app.state::<Mutex<PauseState>>();
        let mut pause_state = pause_state.lock().unwrap();
        pause_state.set(false, None, None);
    }
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
        let music_files_state = app.state::<Mutex<MusicFilesState>>();
        let music_files_state = music_files_state.lock().unwrap();
        music_files_state
            .get()
            .iter()
            .find(|&music_file| music_file.id == id)
            .cloned()
    };

    if let Some(music_file) = music_file {
        let path = music_file.path.clone();
        println!("the path: {:#?}", path);
        thread::spawn(move || {
            let code = player::start_play(
                &app,
                position,
                path.as_str(),
                &play_state_tx,
                &music_info_tx,
                &music_meta_tx,
                &music_image_tx,
            )
            .unwrap_or_else(|err| {
                error!("{}", err.to_string().to_lowercase());
                app.emit(
                    "error",
                    MusicError::new(id, music_file.name, err.to_string().to_lowercase()),
                )
                .unwrap();
                -1
            });
            if code == 100 {
                app.emit("finished", id).unwrap();
                let next_id;
                {
                    let sequence_type_state = app.state::<Mutex<SequenceTypeState>>();
                    let sequence_type_state = sequence_type_state.lock().unwrap();
                    let sequence_type = sequence_type_state.get();
                    let music_files_state = app.state::<Mutex<MusicFilesState>>();
                    let music_files_state = music_files_state.lock().unwrap();
                    let music_files = music_files_state.get();

                    if sequence_type == 2 {
                        next_id = id;
                    } else if sequence_type == 3 {
                        let id = rand::random::<i32>() % music_files.len() as i32;
                        next_id = id;
                    } else {
                        next_id = if id + 1 < music_files.len() as i32 {
                            id + 1
                        } else {
                            0
                        };
                    }
                    let time_position_state = app.state::<Mutex<TimePositionState>>();
                    let mut time_position_state = time_position_state.lock().unwrap();
                    time_position_state.set(None);
                }
                play_music(next_id, None, app);
            } else if code == 0 {
                println!("pause success:{}", code);
                let pause_state = { app.state::<Mutex<PauseState>>().lock().unwrap().clone() };
                app.emit("paused-action", pause_state).unwrap();
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
fn pause_action(pause_state: PauseState, app: AppHandle) {
    println!("pause_state:{:#?}", pause_state);
    if let Some(event_source) = pause_state.event_source {
        match event_source {
            EventSource::Play(_) => {
                if let Some(payload) = pause_state.payload {
                    let id = payload.id;
                    if let Some(time_position) = payload.time_position {
                        let position = convert_to_time(time_position);
                        play_music(id, Some(position), app);
                    } else {
                        play_music(id, None, app);
                    }
                }
            }
            EventSource::PlayNext(_) => {
                if let Some(payload) = pause_state.payload {
                    play_music(payload.id, None, app);
                }
            }
            EventSource::PlayPrev(_) => {
                if let Some(payload) = pause_state.payload {
                    play_music(payload.id, None, app);
                }
            }
            EventSource::Pause(_) => {}
        }
    }
}

#[tauri::command]
fn play(
    id: i32,
    time: Option<f64>,
    app: AppHandle,
    id_state: State<'_, Mutex<IdState>>,
    pause_state: State<'_, Mutex<PauseState>>,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
    time_position_state: State<'_, Mutex<TimePositionState>>,
) {
    if id != -1 {
        play_music(id, None, app);
        return;
    }
    let mut current_id;
    let position;
    {
        let id_state = id_state.lock().unwrap();
        if id_state.get() == -1 {
            current_id = 0;
        } else {
            current_id = id_state.get();
        }
        let music_files_state = music_files_state.lock().unwrap();
        let music_files_state = music_files_state.get();
        let music_file = music_files_state
            .iter()
            .find(|&music_file| music_file.id == current_id);
        if music_file.is_none() {
            current_id = 0;
        }
        let time_position_state = time_position_state.lock().unwrap();
        position = time_position_state.get();
    }
    let pause = {
        let pause_state = pause_state.lock().unwrap();
        pause_state.pause
    };
    if pause {
        if let Some(time) = time {
            let time = convert_to_time(time);
            play_music(current_id, Some(time), app);
            return;
        }
        if let Some(position) = position {
            play_music(current_id, Some(position), app);
            return;
        }
        play_music(current_id, None, app);
        return;
    }

    if let Some(time) = time {
        let mut pause_state = pause_state.lock().unwrap();
        pause_state.set(
            true,
            Some(EventSource::Play("PLAY".to_string())),
            Some(Payload::new(current_id, Some(time))),
        );
        return;
    }
    if let Some(position) = position {
        let mut pause_state = pause_state.lock().unwrap();
        pause_state.set(
            true,
            Some(EventSource::Play("PLAY".to_string())),
            Some(Payload::new(current_id, Some(convert_to_fload(position)))),
        );
    }
    // play_music(current_id, position, app);
}

#[tauri::command]
fn play_next(
    id_state: State<'_, Mutex<IdState>>,
    pause_state: State<'_, Mutex<PauseState>>,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
    time_position_state: State<'_, Mutex<TimePositionState>>,
    app: AppHandle,
) {
    let next_id;
    {
        let id_state = id_state.lock().unwrap();
        let id = id_state.get();
        let music_files_state = music_files_state.lock().unwrap();
        let music_files_state = music_files_state.get();
        let index = match music_files_state
            .iter()
            .position(|music_file| music_file.id == id)
        {
            Some(index) => index as i32,
            None => -1,
        };
        let next_index = index + 1;
        next_id = if next_index < music_files_state.len() as i32 {
            match music_files_state.get(next_index as usize) {
                Some(music_file) => music_file.id,
                None => 0,
            }
        } else {
            0
        };
    }
    {
        let mut time_position_state = time_position_state.lock().unwrap();
        time_position_state.set(None);
    }
    {
        let mut pause_state = pause_state.lock().unwrap();
        if pause_state.pause {
            play_music(next_id, None, app);
            return;
        }
        pause_state.set(
            true,
            Some(EventSource::PlayNext("PLAY_NEXT".to_string())),
            Some(Payload::new(next_id, None)),
        );
    }
}

#[tauri::command]
fn play_previous(
    id_state: State<'_, Mutex<IdState>>,
    pause_state: State<'_, Mutex<PauseState>>,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
    time_position_state: State<'_, Mutex<TimePositionState>>,
    app: AppHandle,
) {
    let prevois_id;
    {
        let id_state = id_state.lock().unwrap();
        let id = id_state.get();
        let music_files_state = music_files_state.lock().unwrap();
        let music_files_state = music_files_state.get();
        let index = match music_files_state
            .iter()
            .position(|music_file| music_file.id == id)
        {
            Some(index) => index as i32,
            None => 0,
        };
        let prevois_index = index - 1;
        prevois_id = if prevois_index >= 0 {
            match music_files_state.get(prevois_index as usize) {
                Some(music_file) => music_file.id,
                None => 0,
            }
        } else {
            music_files_state.len() as i32 - 1
        };
    }
    {
        let mut time_position_state = time_position_state.lock().unwrap();
        time_position_state.set(None);
    }
    {
        let mut pause_state = pause_state.lock().unwrap();
        if pause_state.pause {
            play_music(prevois_id, None, app);
            return;
        }
        pause_state.set(
            true,
            Some(EventSource::PlayPrev("PLAY_PREV".to_string())),
            Some(Payload::new(prevois_id, None)),
        );
    }
}

#[tauri::command]
fn pause(pause_state: State<'_, Mutex<PauseState>>) {
    let mut pause_state = pause_state.lock().unwrap();
    pause_state.set(true, Some(EventSource::Pause("PAUSE".to_string())), None);
}

#[tauri::command]
fn list_files(dirs: Vec<String>) -> Vec<String> {
    file_reader::read_directory_files(dirs).unwrap_or_else(|err| {
        error!("{}", err.to_string().to_lowercase());
        Vec::new()
    })
}

#[tauri::command]
fn set_volume(volume: f32, app: AppHandle, volume_state: State<'_, Mutex<VolumeState>>) {
    let clamped = volume.clamp(0.0, 1.0);
    let mut volume_state = volume_state.lock().unwrap();
    volume_state.set(clamped);
    store::store_settings(&app, MusicSetting::default().with_volume(clamped));
}

#[tauri::command]
fn get_current_music(
    id_state: State<'_, Mutex<IdState>>,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
) -> Option<MusicFile> {
    let music_files_state = music_files_state.lock().unwrap();
    let music_files_state = music_files_state.get();
    let id_state = id_state.lock().unwrap();
    let id = id_state.get();
    music_files_state
        .iter()
        .find(|&music_file| music_file.id == id)
        .cloned()
}

#[tauri::command]
fn change_sequence_type(
    sequence_type: u32,
    app: AppHandle,
    sequence_type_state: State<'_, Mutex<SequenceTypeState>>,
) {
    let mut sequence_type_state = sequence_type_state.lock().unwrap();
    sequence_type_state.set(sequence_type);
    store::store_settings(
        &app,
        MusicSetting::default().with_sequence_type(sequence_type),
    );
}

#[tauri::command]
fn playlist_add(
    music_files: Vec<MusicFile>,
    app: AppHandle,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
) {
    let mut music_files_state = music_files_state.lock().unwrap();
    music_files_state.set(music_files.clone());
    store::store_playlist(&app, &music_files);
}

#[tauri::command]
fn delete_from_playlist(
    id: i32,
    app: AppHandle,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
) {
    let mut music_files_state = music_files_state.lock().unwrap();
    let mut music_files = music_files_state.get();
    music_files.retain(|music_file| music_file.id != id);
    music_files_state.set(music_files.clone());
    store::store_playlist(&app, &music_files);
}

#[tauri::command]
fn clear_playlist(app: AppHandle, music_files_state: State<'_, Mutex<MusicFilesState>>) {
    let mut music_files_state = music_files_state.lock().unwrap();
    music_files_state.set(vec![]);
    let music_files_state = music_files_state.get();
    store::store_playlist(&app, &music_files_state);
    store::store_play_state(&app, None);
}

#[tauri::command]
fn load_playlist(
    app: AppHandle,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
) -> Vec<MusicFile> {
    let playlist = store::load_playlist(&app);
    let cloned_playlist = playlist.clone();
    let mut music_files_state = music_files_state.lock().unwrap();
    music_files_state.set(cloned_playlist);
    playlist
}

#[tauri::command]
fn load_settings(
    app: AppHandle,
    volume_state: State<'_, Mutex<VolumeState>>,
    sequence_type_state: State<'_, Mutex<SequenceTypeState>>,
) -> MusicSetting {
    let settings = store::load_settings(&app);
    let mut volume_state = volume_state.lock().unwrap();
    let mut sequence_type_state = sequence_type_state.lock().unwrap();
    volume_state.set(settings.volume);
    sequence_type_state.set(settings.sequence_type);
    settings
}

#[tauri::command]
fn load_play_state(
    app: AppHandle,
    id_state: State<'_, Mutex<IdState>>,
    time_position_state: State<'_, Mutex<TimePositionState>>,
) -> Option<PlayState> {
    let play_state = store::load_play_state(&app);
    println!("play_state:{:#?}", play_state);
    match play_state {
        Some(play_state) => {
            let mut id_state = id_state.lock().unwrap();
            id_state.set(play_state.id);
            let mut time_position_state = time_position_state.lock().unwrap();
            time_position_state.set(Some(parse_str_time(play_state.progress.clone())));
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
        .manage(Mutex::new(IdState::default()))
        .manage(Mutex::new(PauseState::default()))
        .manage(Mutex::new(VolumeState::default()))
        .manage(Mutex::new(MusicFilesState::default()))
        .manage(Mutex::new(SequenceTypeState::default()))
        .manage(Mutex::new(TimePositionState::default()))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            pause_action,
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

fn convert_to_fload(time: Time) -> f64 {
    let seconds = time.seconds;
    let fractional = time.frac;
    seconds as f64 + fractional
}
