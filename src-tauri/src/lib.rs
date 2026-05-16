use log::{debug, error};
use rand::Rng;
use state::{
    EventSource, IdState, MusicFilesState, PauseState, Payload, SequenceType, SequenceTypeState,
    TimePositionState, VolumeState,
};
use std::{
    path::PathBuf,
    sync::{Mutex, mpsc::channel},
    thread,
};
use store::{PLAY_STATE_STORE_FILENAME, PLAYLIST_STORE_FILENAME, SETTINGS_STORE_FILENAME};
use symphonia::core::units::Time;
use tauri_plugin_store::StoreExt;
use uuid::Uuid;

use music::{MusicError, MusicFile, MusicImage, MusicInfo, MusicMap, MusicSetting, PlayState};
use tauri::{AppHandle, Emitter, Manager, State};

mod cache;
mod file_reader;
mod music;
mod output;
mod player;
#[cfg(not(target_os = "linux"))]
mod resampler;
mod state;
mod store;

fn play_music(id: String, position: Option<Time>, app: AppHandle) {
    debug!("play_music id={}", id);
    {
        if let Ok(mut id_state) = app.state::<Mutex<IdState>>().lock() {
            id_state.set(Some(id.clone()));
        }
    }
    {
        if let Ok(mut pause_state) = app.state::<Mutex<PauseState>>().lock() {
            pause_state.set(false, None, None);
        }
    }

    let app_info = app.clone();
    let app_play_state = app.clone();
    let app_store = app.clone();
    let app_image = app.clone();
    let app_cache = app.clone();
    let (play_state_tx, play_state_rx) = channel::<PlayState>();
    let (store_state_tx, store_state_rx) = channel::<PlayState>();
    let (music_info_tx, music_info_rx) = channel::<MusicInfo>();
    let (music_image_tx, music_image_rx) = channel::<MusicImage>();

    let music_file = {
        let music_files_state = app.state::<Mutex<MusicFilesState>>();
        let Ok(state) = music_files_state.lock() else {
            return;
        };
        state.get().iter().find(|f| f.id == id).cloned()
    };

    let Some(music_file) = music_file else {
        return;
    };

    let path = music_file.path.clone();
    let needs_cache = music_file.image_path.is_none();
    let cache_music_file = music_file.clone();

    thread::spawn(move || {
        let code = player::start_play(
            &app,
            position,
            path.as_str(),
            &play_state_tx,
            &store_state_tx,
            &music_info_tx,
            &music_image_tx,
        )
        .unwrap_or_else(|err| {
            let msg = err.to_string().to_lowercase();
            error!("playback error: {}", msg);
            let _ = app.emit(
                "error",
                MusicError::new(Some(id.clone()), music_file.name.clone(), msg),
            );
            -1
        });

        if code == 100 {
            let _ = app.emit("finished", id.clone());
            if let Ok(mut time_pos) = app.state::<Mutex<TimePositionState>>().lock() {
                time_pos.set(None);
            }

            let next_id = {
                let seq_state = app.state::<Mutex<SequenceTypeState>>();
                let sequence_type = seq_state.lock().map(|s| s.get()).unwrap_or_default();
                let mfs_state = app.state::<Mutex<MusicFilesState>>();
                let Ok(state) = mfs_state.lock() else {
                    return;
                };
                let music_files = state.get();

                if music_files.is_empty() {
                    return;
                }

                match sequence_type {
                    SequenceType::RepeatOne => id.clone(),
                    SequenceType::Random => {
                        let index = rand::thread_rng().gen_range(0..music_files.len());
                        music_files[index].id.clone()
                    }
                    SequenceType::Repeat => {
                        let index = music_files.iter().position(|f| f.id == id).unwrap_or(0);
                        let next_index = (index + 1) % music_files.len();
                        music_files[next_index].id.clone()
                    }
                }
            };
            play_music(next_id, None, app);
        } else if code == 0 {
            debug!("paused");
            if let Ok(ps) = app.state::<Mutex<PauseState>>().lock() {
                let _ = app.emit("paused-action", ps.clone());
            }
        }
    });

    if needs_cache {
        spawn_cache_update(app_cache, cache_music_file);
    }

    thread::spawn(move || {
        for music_info in music_info_rx {
            let _ = app_info.emit("music-info", music_info);
        }
    });

    thread::spawn(move || {
        let mut last_emit_time = std::time::Instant::now();
        let mut latest_state: Option<PlayState> = None;
        for play_state in play_state_rx {
            latest_state = Some(play_state);
            let now = std::time::Instant::now();
            if now.duration_since(last_emit_time).as_millis() >= 250 {
                if let Some(ref state) = latest_state {
                    let _ = app_play_state.emit("play-state", state.clone());
                }
                last_emit_time = now;
            }
        }
        if let Some(state) = latest_state {
            let _ = app_play_state.emit("play-state", state);
        }
    });

    thread::spawn(move || {
        for music_image in music_image_rx {
            let _ = app_image.emit("music-image", music_image);
        }
    });

    thread::spawn(move || {
        let mut last_store_time = std::time::Instant::now();
        for play_state in store_state_rx {
            let now = std::time::Instant::now();
            if now.duration_since(last_store_time).as_secs() >= 1 {
                store::store_play_state(&app_store, Some(play_state));
                last_store_time = now;
            }
        }
    });
}

fn spawn_cache_update(app: AppHandle, music_file: MusicFile) {
    let (tx, rx) = channel::<MusicMap>();
    let playlists = vec![music_file];

    let cloned_app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Ok(cache_dir) = init_cache_dir(&cloned_app)
            && let Err(err) = cache::init_cache(cache_dir, playlists, &tx).await
        {
            let _ = cloned_app.emit("error", err);
        }
    });

    thread::spawn(move || {
        process_cache_results(rx, &app);
    });
}

fn process_cache_results(rx: std::sync::mpsc::Receiver<MusicMap>, app: &AppHandle) {
    for music_map in rx {
        let music_files_state = app.state::<Mutex<MusicFilesState>>();
        let Ok(mut state) = music_files_state.lock() else {
            continue;
        };
        let mut music_files = state.get_cloned();

        if let Some(music) = music_files.iter_mut().find(|m| m.name == music_map.name) {
            music.artist = Some(music_map.artist.clone());
            music.album = Some(music_map.album.clone());
            music.image_path = Some(music_map.image_path.clone());
            let returned_music_file = music.clone();
            state.set(music_files.clone());
            store::store_playlist(app, &music_files);
            let _ = app.emit("music_data_completion", returned_music_file);
        }
    }
}

fn init_cache_dir(app: &AppHandle) -> Result<PathBuf, ()> {
    app.path().app_cache_dir().map_err(|err| {
        let _ = app.emit(
            "error",
            MusicError::new(
                None,
                "cache dir".to_string(),
                err.to_string().to_lowercase(),
            ),
        );
    })
}

#[tauri::command]
fn clear_cache(music_files_state: State<'_, Mutex<MusicFilesState>>, app: AppHandle) {
    if let Ok(cache_dir) = init_cache_dir(&app) {
        if let Err(err) = cache::clear_cache(cache_dir) {
            let _ = app.emit("error", err);
        } else if let Ok(mut state) = music_files_state.lock() {
            let mut playlist = state.get_cloned();
            for music in playlist.iter_mut() {
                music.image_path = None;
            }
            state.set(playlist.clone());
            store::store_playlist(&app, &playlist);
        }
    }
}

#[tauri::command]
fn pause_action(pause_state: PauseState, app: AppHandle) {
    if let Some(event_source) = pause_state.event_source {
        match event_source {
            EventSource::Play => {
                if let Some(payload) = pause_state.payload {
                    let position = payload.time_position.map(convert_to_time);
                    play_music(payload.id, position, app);
                }
            }
            EventSource::PlayNext | EventSource::PlayPrev => {
                if let Some(payload) = pause_state.payload {
                    play_music(payload.id, None, app);
                }
            }
            EventSource::Pause => {}
        }
    }
}

#[tauri::command]
fn seek(
    time: f64,
    id_state: State<'_, Mutex<IdState>>,
    pause_state: State<'_, Mutex<PauseState>>,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
    app: AppHandle,
) -> Result<(), String> {
    let id = get_current_or_first_track_id(&id_state, &music_files_state)
        .ok_or_else(|| "No track available to seek".to_string())?;

    let is_paused = pause_state
        .lock()
        .map_err(|e| format!("Failed to access pause state: {}", e))?
        .pause;

    if is_paused {
        let time = convert_to_time(time);
        play_music(id, Some(time), app);
    } else {
        pause_state
            .lock()
            .map_err(|e| format!("Failed to update pause state: {}", e))?
            .set(
                true,
                Some(EventSource::Play),
                Some(Payload::new(id, Some(time))),
            );
    }

    Ok(())
}

#[tauri::command]
fn switch(id: String, pause_state: State<'_, Mutex<PauseState>>, app: AppHandle) {
    if let Ok(mut time_pos) = app.state::<Mutex<TimePositionState>>().lock() {
        time_pos.set(None);
    }

    let pause = pause_state.lock().map(|s| s.pause).unwrap_or(true);

    if pause {
        play_music(id, None, app);
    } else if let Ok(mut ps) = pause_state.lock() {
        ps.set(true, Some(EventSource::Play), Some(Payload::new(id, None)));
    }
}

#[tauri::command]
fn play(
    app: AppHandle,
    id_state: State<'_, Mutex<IdState>>,
    pause_state: State<'_, Mutex<PauseState>>,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
    time_position_state: State<'_, Mutex<TimePositionState>>,
) -> Result<(), String> {
    let id = get_current_or_first_track_id(&id_state, &music_files_state)
        .ok_or_else(|| "No track available to play".to_string())?;

    let pause = pause_state.lock().map(|s| s.pause).unwrap_or(true);

    if pause {
        let time = time_position_state.lock().ok().and_then(|s| s.get());
        play_music(id, time, app);
    }

    Ok(())
}

#[tauri::command]
fn play_next(
    id_state: State<'_, Mutex<IdState>>,
    pause_state: State<'_, Mutex<PauseState>>,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
    time_position_state: State<'_, Mutex<TimePositionState>>,
    app: AppHandle,
) -> Result<(), String> {
    let current_id = id_state.lock().ok().and_then(|s| s.get());
    let music_files = music_files_state
        .lock()
        .map_err(|e| format!("Failed to access music files: {}", e))?
        .get_cloned();

    if music_files.is_empty() {
        return Err("Music files list is empty".to_string());
    }

    let next_id = if let Some(current_id) = current_id {
        let current_index = music_files
            .iter()
            .position(|f| f.id == current_id)
            .unwrap_or(0);
        let next_index = (current_index + 1) % music_files.len();
        music_files[next_index].id.clone()
    } else {
        music_files[0].id.clone()
    };

    if let Ok(mut time_pos) = time_position_state.lock() {
        time_pos.set(None);
    }

    let pause = pause_state.lock().map(|s| s.pause).unwrap_or(true);
    if pause {
        play_music(next_id, None, app);
    } else if let Ok(mut ps) = pause_state.lock() {
        ps.set(
            true,
            Some(EventSource::PlayNext),
            Some(Payload::new(next_id, None)),
        );
    }

    Ok(())
}

#[tauri::command]
fn play_previous(
    id_state: State<'_, Mutex<IdState>>,
    pause_state: State<'_, Mutex<PauseState>>,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
    time_position_state: State<'_, Mutex<TimePositionState>>,
    app: AppHandle,
) -> Result<(), String> {
    let current_id = id_state.lock().ok().and_then(|s| s.get());
    let music_files = music_files_state
        .lock()
        .map_err(|e| format!("Failed to access music files: {}", e))?
        .get_cloned();

    if music_files.is_empty() {
        return Err("Music files list is empty".to_string());
    }

    let previous_id = if let Some(current_id) = current_id {
        let current_index = music_files
            .iter()
            .position(|f| f.id == current_id)
            .unwrap_or(0);
        let previous_index = if current_index == 0 {
            music_files.len() - 1
        } else {
            current_index - 1
        };
        music_files[previous_index].id.clone()
    } else {
        music_files[0].id.clone()
    };

    if let Ok(mut time_pos) = time_position_state.lock() {
        time_pos.set(None);
    }

    let pause = pause_state.lock().map(|s| s.pause).unwrap_or(true);
    if pause {
        play_music(previous_id, None, app);
    } else if let Ok(mut ps) = pause_state.lock() {
        ps.set(
            true,
            Some(EventSource::PlayPrev),
            Some(Payload::new(previous_id, None)),
        );
    }

    Ok(())
}

#[tauri::command]
fn pause(pause_state: State<'_, Mutex<PauseState>>) {
    if let Ok(mut ps) = pause_state.lock() {
        ps.set(true, Some(EventSource::Pause), None);
    }
}

#[tauri::command]
fn list_files(dirs: Vec<String>) -> Vec<String> {
    file_reader::read_directory_files(dirs).unwrap_or_else(|err| {
        error!("failed to read directory: {}", err);
        Vec::new()
    })
}

#[tauri::command]
fn set_volume(volume: f32, app: AppHandle, volume_state: State<'_, Mutex<VolumeState>>) {
    let clamped = volume.clamp(0.0, 1.0);
    if let Ok(mut vs) = volume_state.lock() {
        vs.set(clamped);
    }
    let current_settings = store::load_settings(&app);
    store::store_settings(&app, current_settings.with_volume(clamped));
}

#[tauri::command]
fn change_sequence_type(
    sequence_type: u32,
    app: AppHandle,
    sequence_type_state: State<'_, Mutex<SequenceTypeState>>,
) {
    let seq_type = SequenceType::from_u32(sequence_type);
    if let Ok(mut st) = sequence_type_state.lock() {
        st.set(seq_type);
    }
    let current_settings = store::load_settings(&app);
    store::store_settings(&app, current_settings.with_sequence_type(sequence_type));
}

#[tauri::command]
fn playlist_add(
    files: Vec<String>,
    app: AppHandle,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
) -> Result<Vec<MusicFile>, ()> {
    let new_files: Vec<MusicFile> = files
        .into_iter()
        .map(|file| {
            let name = extract_name_from_path(&file);
            MusicFile::new(Uuid::new_v4().to_string(), name, file, None, None, None)
        })
        .collect();

    let mut playlist = store::load_playlist(&app);
    playlist.extend(new_files);

    if let Ok(mut state) = music_files_state.lock() {
        state.set(playlist.clone());
    }
    store::store_playlist(&app, &playlist);

    Ok(playlist)
}

#[tauri::command]
fn delete_from_playlist(
    id: String,
    app: AppHandle,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
) {
    if let Ok(mut state) = music_files_state.lock() {
        let mut music_files = state.get_cloned();
        music_files.retain(|f| f.id != id);
        state.set(music_files.clone());
        store::store_playlist(&app, &music_files);
    }
}

#[tauri::command]
fn clear_playlist(
    app: AppHandle,
    id_state: State<'_, Mutex<IdState>>,
    pause_state: State<'_, Mutex<PauseState>>,
    time_position_state: State<'_, Mutex<TimePositionState>>,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
) {
    if let Ok(mut ps) = pause_state.lock() {
        ps.set(true, None, None);
    }
    if let Ok(mut tp) = time_position_state.lock() {
        tp.set(None);
    }
    if let Ok(mut ids) = id_state.lock() {
        ids.set(None);
    }
    if let Ok(mut mfs) = music_files_state.lock() {
        mfs.set(vec![]);
    }
    store::store_playlist(&app, &[]);
    store::store_play_state(&app, None);
}

#[tauri::command]
fn init_playlist(
    app: AppHandle,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
) -> Vec<MusicFile> {
    let playlist = store::load_playlist(&app);
    if let Ok(mut state) = music_files_state.lock() {
        state.set(playlist.clone());
    }

    let filtered_playlist: Vec<MusicFile> = playlist
        .iter()
        .filter(|music| music.image_path.is_none())
        .cloned()
        .collect();

    let (tx, rx) = channel::<MusicMap>();
    let cloned_app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Ok(cache_dir) = init_cache_dir(&cloned_app)
            && let Err(err) = cache::init_cache(cache_dir, filtered_playlist, &tx).await
        {
            let _ = cloned_app.emit("error", err);
        }
    });

    let cloned_app = app.clone();
    thread::spawn(move || {
        process_cache_results(rx, &cloned_app);
    });

    playlist
}

#[tauri::command]
fn load_playlist(
    app: AppHandle,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
) -> Vec<MusicFile> {
    let playlist = store::load_playlist(&app);
    if let Ok(mut state) = music_files_state.lock() {
        state.set(playlist.clone());
    }
    playlist
}

#[tauri::command]
fn load_settings(
    app: AppHandle,
    volume_state: State<'_, Mutex<VolumeState>>,
    sequence_type_state: State<'_, Mutex<SequenceTypeState>>,
) -> MusicSetting {
    let settings = store::load_settings(&app);
    if let Ok(mut vs) = volume_state.lock() {
        vs.set(settings.volume);
    }
    if let Ok(mut st) = sequence_type_state.lock() {
        st.set(SequenceType::from_u32(settings.sequence_type));
    }
    settings
}

#[tauri::command]
fn load_play_state(
    app: AppHandle,
    id_state: State<'_, Mutex<IdState>>,
    time_position_state: State<'_, Mutex<TimePositionState>>,
) -> Option<PlayState> {
    let play_state = store::load_play_state(&app)?;
    if let Ok(mut ids) = id_state.lock() {
        ids.set(play_state.id.clone());
    }
    if let Some(ref progress) = play_state.progress
        && let Ok(mut tp) = time_position_state.lock()
    {
        tp.set(Some(parse_str_time(progress)));
    }
    Some(play_state)
}

#[tauri::command]
fn show_main_window(window: tauri::Window) {
    if let Some(main_window) = window.get_webview_window("main") {
        let _ = main_window.show();
    }
}

#[tauri::command]
fn get_cache_size(app: AppHandle) -> String {
    match app.path().app_cache_dir() {
        Ok(cache_dir) => cache::get_cache_dir_size(cache_dir),
        Err(_) => "0.00".to_string(),
    }
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
            clear_cache,
            pause_action,
            playlist_add,
            play,
            seek,
            pause,
            play_next,
            play_previous,
            switch,
            list_files,
            set_volume,
            change_sequence_type,
            delete_from_playlist,
            clear_playlist,
            show_main_window,
            init_playlist,
            load_playlist,
            load_settings,
            load_play_state,
            get_cache_size
        ])
        .setup(|app| {
            app.store(SETTINGS_STORE_FILENAME)?;
            app.store(PLAYLIST_STORE_FILENAME)?;
            app.store(PLAY_STATE_STORE_FILENAME)?;
            Ok(())
        })
        .on_window_event(|win, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                #[cfg(not(target_os = "macos"))]
                {
                    let _ = win.hide();
                }

                #[cfg(target_os = "macos")]
                {
                    let _ = tauri::AppHandle::hide(win.app_handle());
                }
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn parse_str_time(time: &str) -> Time {
    let parts: Vec<&str> = time.split(':').collect();
    if parts.len() != 3 {
        return Time::new(0, 0.0);
    }
    let hour = parts[0].parse::<f64>().unwrap_or(0.0);
    let minute = parts[1].parse::<f64>().unwrap_or(0.0);
    let second_parts: Vec<&str> = parts[2].split('.').collect();
    let second = second_parts[0].parse::<f64>().unwrap_or(0.0);
    let fractional = if second_parts.len() > 1 {
        format!("0.{}", second_parts[1])
            .parse::<f64>()
            .unwrap_or(0.0)
    } else {
        0.0
    };
    let num = hour * 3600.0 + minute * 60.0 + second + fractional;
    convert_to_time(num)
}

fn convert_to_time(time: f64) -> Time {
    let integer_part = time.floor() as u64;
    let fractional_part = time - integer_part as f64;
    Time::new(integer_part, fractional_part)
}

fn get_current_or_first_track_id(
    id_state: &State<Mutex<IdState>>,
    music_files_state: &State<Mutex<MusicFilesState>>,
) -> Option<String> {
    let id_state = id_state.lock().ok()?;

    match id_state.get() {
        Some(id) => Some(id),
        None => {
            let state = music_files_state.lock().ok()?;
            state.get().first().map(|file| file.id.clone())
        }
    }
}

fn extract_name_from_path(path: &str) -> String {
    PathBuf::from(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string()
}
