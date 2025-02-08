use rand::Rng;
use state::{
    EventSource, IdState, MusicFilesState, PauseState, Payload, SequenceTypeState,
    TimePositionState, VolumeState,
};
use std::{
    path::PathBuf,
    sync::{mpsc::channel, Mutex},
    thread::{self},
};
use store::{PLAYLIST_STORE_FILENAME, PLAY_STATE_STORE_FILENAME, SETTINGS_STORE_FILENAME};
use symphonia::core::units::Time;
use tauri_plugin_store::StoreExt;
use uuid::Uuid;

use log::error;
use music::{
    MusicError, MusicFile, MusicImage, MusicInfo, MusicMap, MusicMeta, MusicSetting, PlayState,
};
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
    println!("current_id:{:#?}", id);
    {
        let id_state = app.state::<Mutex<IdState>>();
        let mut id_state = id_state.lock().unwrap();
        id_state.set(Some(id.clone()));
    }
    {
        let pause_state = app.state::<Mutex<PauseState>>();
        let mut pause_state = pause_state.lock().unwrap();
        pause_state.set(false, None, None);
    }
    let app_info = app.clone();
    let app_play_state = app.clone();
    let app_store = app.clone();
    let app_meta = app.clone();
    let app_image = app.clone();
    let app_cache = app.clone();
    let (play_state_tx, play_state_rx) = channel::<PlayState>();
    let (store_state_tx, store_state_rx) = channel::<PlayState>();
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
        let cloned_music_file = music_file.clone();
        let path = music_file.path.clone();
        println!("the path: {:#?}", path);
        thread::spawn(move || {
            let code = player::start_play(
                &app,
                position,
                path.as_str(),
                &play_state_tx,
                &store_state_tx,
                &music_info_tx,
                &music_meta_tx,
                &music_image_tx,
            )
            .unwrap_or_else(|err| {
                error!("{}", err.to_string().to_lowercase());
                app.emit(
                    "error",
                    MusicError::new(
                        Some(id.clone()),
                        music_file.name,
                        err.to_string().to_lowercase(),
                    ),
                )
                .unwrap();
                -1
            });
            if code == 100 {
                app.emit("finished", id.clone()).unwrap();
                // reset time position
                {
                    let time_position_state = app.state::<Mutex<TimePositionState>>();
                    let mut time_position_state = time_position_state.lock().unwrap();
                    time_position_state.set(None);
                }
                let next_id = {
                    let sequence_type = app
                        .state::<Mutex<SequenceTypeState>>()
                        .lock()
                        .unwrap()
                        .get();
                    let music_files = app.state::<Mutex<MusicFilesState>>().lock().unwrap().get();

                    // repeat one
                    if sequence_type == 2 {
                        id
                    // random
                    } else if sequence_type == 3 {
                        let index = rand::thread_rng().gen_range(0..music_files.len());
                        music_files.get(index).unwrap().id.clone()
                    // repeat playlist
                    } else {
                        // get current id index
                        let index = music_files
                            .iter()
                            .position(|music_file| music_file.id == id)
                            .unwrap_or(0);
                        let next_index = (index + 1) % music_files.len();
                        music_files.get(next_index).unwrap().id.clone()
                    }
                };
                play_music(next_id, None, app);
            } else if code == 0 {
                println!("pause success:{}", code);
                let pause_state = { app.state::<Mutex<PauseState>>().lock().unwrap().clone() };
                app.emit("paused-action", pause_state).unwrap();
            }
        });

        // Get music meta data if not already cached
        if music_file.image_path.is_none() {
            let playlist = cloned_music_file.clone();
            thread::spawn(move || {
                let playlists = vec![playlist.clone()];
                let (tx, rx) = channel::<MusicMap>();
                let cloned_app = app_cache.clone();

                // Initialize cache
                tauri::async_runtime::spawn(async move {
                    println!("Executing async task");
                    let the_app = cloned_app.clone();
                    if let Ok(cache_dir) = init_cache_dir(cloned_app) {
                        if let Err(err) = cache::init_cache(cache_dir, playlists, &tx).await {
                            println!("err:{:#?}", err);
                            the_app.emit("error", err).unwrap();
                        }
                    }
                });

                let cloned_app = app_cache.clone();
                thread::spawn(move || {
                    for music_map in rx {
                        let name = music_map.name;
                        let artist = music_map.artist;
                        let album = music_map.album;
                        let image_path = music_map.image_path;
                        let music_files_state = cloned_app.state::<Mutex<MusicFilesState>>();
                        // Lock the state and modify it
                        let mut state = music_files_state.lock().unwrap();
                        let mut music_files = state.get();

                        if let Some(music) = music_files.iter_mut().find(|m| m.name == name) {
                            music.artist = Some(artist.clone());
                            music.album = Some(album.clone());
                            music.image_path = Some(image_path.clone());
                            let returned_music_file = music.clone();
                            // Update the state with modified music_files
                            state.set(music_files.clone());

                            // Store the updated playlist
                            store::store_playlist(&cloned_app, &music_files);

                            // Emit the update event
                            cloned_app
                                .emit("music_data_completion", returned_music_file)
                                .unwrap();
                        }
                    }
                });
            });
        }

        thread::spawn(move || {
            for music_info in music_info_rx {
                app_info.emit("music-info", music_info).unwrap();
            }
        });

        thread::spawn(move || {
            for play_state in play_state_rx {
                app_play_state.emit("play-state", play_state).unwrap();
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

        thread::spawn(move || {
            let mut last_store_time = std::time::Instant::now();
            for play_state in store_state_rx {
                // Store play state if 1 second has passed
                let now = std::time::Instant::now();
                if now.duration_since(last_store_time).as_secs() >= 1 {
                    store::store_play_state(&app_store, Some(play_state));
                    last_store_time = now;
                }
            }
        });
    }
}

fn init_cache_dir(app: AppHandle) -> Result<PathBuf, ()> {
    let cache_dir = app.path().app_cache_dir();
    match cache_dir {
        Ok(cache_dir) => Ok(cache_dir),
        Err(err) => {
            app.emit(
                "error",
                MusicError::new(
                    None,
                    "cache dir".to_string(),
                    err.to_string().to_lowercase(),
                ),
            )
            .unwrap();
            Err(())
        }
    }
}

#[tauri::command]
fn clear_cache(music_files_state: State<'_, Mutex<MusicFilesState>>, app: AppHandle) {
    let cloned_app = app.clone();
    let result = init_cache_dir(cloned_app);
    if let Ok(cache_dir) = result {
        let result = cache::clear_cache(cache_dir);
        if let Err(err) = result {
            app.emit("error", err).unwrap();
        } else {
            let playlist = {
                let playlist = music_files_state.lock().unwrap().get();
                let mut playlist = playlist.clone();
                for music in playlist.iter_mut() {
                    music.image_path = None;
                }
                music_files_state.lock().unwrap().set(playlist.clone());
                playlist
            };
            store::store_playlist(&app, &playlist);
        }
    }
}

#[tauri::command]
fn pause_action(pause_state: PauseState, app: AppHandle) {
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
fn seek(
    time: f64,
    id_state: State<'_, Mutex<IdState>>,
    pause_state: State<'_, Mutex<PauseState>>,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
    app: AppHandle,
) -> Result<(), String> {
    // Get current track ID or first track if none selected
    let id = get_current_or_first_track_id(&id_state, &music_files_state)
        .ok_or_else(|| "No track available to seek".to_string())?;

    // Get current pause state
    let is_paused = pause_state
        .lock()
        .map_err(|e| format!("Failed to access pause state: {}", e))?
        .pause;

    if is_paused {
        // If paused, start playing from new position
        let time = convert_to_time(time);
        play_music(id.clone(), Some(time), app);
    } else {
        // If playing, update pause state with new position
        pause_state
            .lock()
            .map_err(|e| format!("Failed to update pause state: {}", e))?
            .set(
                true,
                Some(EventSource::Play("PLAY".to_string())),
                Some(Payload::new(id, Some(time))),
            );
    }

    Ok(())
}

#[tauri::command]
fn switch(id: String, pause_state: State<'_, Mutex<PauseState>>, app: AppHandle) {
    // reset time position
    {
        let time_position_state = app.state::<Mutex<TimePositionState>>();
        let mut time_position_state = time_position_state.lock().unwrap();
        time_position_state.set(None);
    }
    let pause = {
        let pause_state = pause_state.lock().unwrap();
        pause_state.pause
    };
    if pause {
        play_music(id, None, app);
    } else {
        pause_state.lock().unwrap().set(
            true,
            Some(EventSource::Play("PLAY".to_string())),
            Some(Payload::new(id, None)),
        );
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

    println!("current_id>>:{}", id);
    let pause = {
        let pause_state = pause_state.lock().unwrap();
        pause_state.pause
    };
    println!("pause:{}", pause);
    if pause {
        let time = { time_position_state.lock().unwrap().get() };
        println!("time:{:#?}", time);
        play_music(id, time, app);
        return Ok(());
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
    let current_id = { id_state.lock().unwrap().get() };
    let music_files = { music_files_state.lock().unwrap().get() };
    if music_files.is_empty() {
        return Err("Music files list is empty".to_string());
    }
    // Get next track ID
    let next_id = {
        // Find current track index and calculate next
        if let Some(current_id) = current_id {
            let current_index = music_files
                .iter()
                .position(|music_file| music_file.id == current_id)
                .unwrap_or(0);

            // Handle wrapping around to the beginning of the playlist
            let next_index = (current_index + 1) % music_files.len();

            music_files
                .get(next_index)
                .map(|music_file| music_file.id.clone())
                .ok_or("Failed to get next track ID".to_string())?
        } else {
            music_files
                .first()
                .map(|music_file| music_file.id.clone())
                .ok_or("Failed to get next track ID".to_string())?
        }
    };

    // reset time position
    {
        time_position_state.lock().unwrap().set(None);
    }

    // Handle playback state
    let pause = { pause_state.lock().unwrap().pause };
    if pause {
        play_music(next_id, None, app);
    } else {
        pause_state.lock().unwrap().set(
            true,
            Some(EventSource::PlayNext("PLAY_NEXT".to_string())),
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
    // Get previous track ID
    let current_id = { id_state.lock().unwrap().get() };
    let music_files = { music_files_state.lock().unwrap().get() };
    if music_files.is_empty() {
        return Err("Music files list is empty".to_string());
    }
    let previous_id = {
        // Find current track index and calculate previous
        if let Some(current_id) = current_id {
            let current_index = music_files
                .iter()
                .position(|music_file| music_file.id == current_id)
                .unwrap_or(0);

            // Handle wrapping around to the end of the playlist
            let previous_index = if current_index == 0 {
                music_files.len() - 1
            } else {
                current_index - 1
            };

            music_files
                .get(previous_index)
                .map(|music_file| music_file.id.clone())
                .ok_or("Failed to get previous track ID".to_string())?
        } else {
            music_files
                .first()
                .map(|music_file| music_file.id.clone())
                .ok_or("Failed to get previous track ID".to_string())?
        }
    };

    // reset time position
    {
        time_position_state.lock().unwrap().set(None);
    }

    let pause = { pause_state.lock().unwrap().pause };
    // Handle playback state
    if pause {
        play_music(previous_id.clone(), None, app);
    } else {
        pause_state.lock().unwrap().set(
            true,
            Some(EventSource::PlayPrev("PLAY_PREV".to_string())),
            Some(Payload::new(previous_id, None)),
        );
    }

    Ok(())
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
    files: Vec<String>,
    app: AppHandle,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
) -> Result<Vec<MusicFile>, ()> {
    // Create music files from input files
    let music_files: Vec<MusicFile> = files
        .into_iter()
        .map(|file| {
            MusicFile::new(
                Uuid::new_v4().to_string(),
                extract_name_with_path(file.clone()),
                file,
                None,
                None,
                None,
            )
        })
        .collect();

    // Update state and store playlist
    let playlist = store::load_playlist(&app);
    let mut playlist = playlist.clone();
    // merge playlist
    playlist.extend(music_files);
    let playlist_store = playlist.clone();
    let playlist_state = playlist.clone();

    let mut state = music_files_state.lock().unwrap();
    state.set(playlist_state);
    store::store_playlist(&app, &playlist_store);

    Ok(playlist)
}

#[tauri::command]
fn delete_from_playlist(
    id: String,
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
fn clear_playlist(
    app: AppHandle,
    id_state: State<'_, Mutex<IdState>>,
    pause_state: State<'_, Mutex<PauseState>>,
    time_position_state: State<'_, Mutex<TimePositionState>>,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
) {
    {
        pause_state.lock().unwrap().set(true, None, None);
        time_position_state.lock().unwrap().set(None);
        id_state.lock().unwrap().set(None);
    }
    let mut music_files_state = music_files_state.lock().unwrap();
    music_files_state.set(vec![]);
    let music_files_state = music_files_state.get();
    store::store_playlist(&app, &music_files_state);
    store::store_play_state(&app, None);
}

#[tauri::command]
fn init_playlist(
    app: AppHandle,
    music_files_state: State<'_, Mutex<MusicFilesState>>,
) -> Vec<MusicFile> {
    let playlist = store::load_playlist(&app);
    let cloned_playlist = playlist.clone();
    let mut music_files_state = music_files_state.lock().unwrap();
    music_files_state.set(cloned_playlist);

    let (tx, rx) = channel::<MusicMap>();
    let cloned_app = app.clone();
    let filtered_playlist = playlist
        .clone()
        .into_iter()
        .filter(|music| music.image_path.is_none())
        .collect();

    // Initialize cache
    tauri::async_runtime::spawn(async move {
        println!("Executing async task");
        let the_app = cloned_app.clone();
        if let Ok(cache_dir) = init_cache_dir(cloned_app) {
            if let Err(err) = cache::init_cache(cache_dir, filtered_playlist, &tx).await {
                println!("err:{:#?}", err);
                the_app.emit("error", err).unwrap();
            }
        }
    });

    let cloned_app = app.clone();
    thread::spawn(move || {
        for music_map in rx {
            let name = music_map.name;
            let artist = music_map.artist;
            let album = music_map.album;
            let image_path = music_map.image_path;
            let music_files_state = cloned_app.state::<Mutex<MusicFilesState>>();
            // Lock the state and modify it
            let mut state = music_files_state.lock().unwrap();
            let mut music_files = state.get();

            if let Some(music) = music_files.iter_mut().find(|m| m.name == name) {
                music.artist = Some(artist.clone());
                music.album = Some(album.clone());
                music.image_path = Some(image_path.clone());
                let returned_music_file = music.clone();
                // Update the state with modified music_files
                state.set(music_files.clone());

                // Store the updated playlist
                store::store_playlist(&cloned_app, &music_files);

                // Emit the update event
                cloned_app
                    .emit("music_data_completion", returned_music_file)
                    .unwrap();
            }
        }
    });

    playlist
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
    match play_state {
        Some(play_state) => {
            let cloned_play_state = play_state.clone();
            let mut id_state = id_state.lock().unwrap();
            id_state.set(play_state.id.clone());
            let mut time_position_state = time_position_state.lock().unwrap();
            if let Some(time_position) = play_state.progress {
                time_position_state.set(Some(parse_str_time(time_position)));
            }
            Some(cloned_play_state)
        }
        None => None,
    }
}

#[tauri::command]
fn show_main_window(window: tauri::Window) {
    window.get_webview_window("main").unwrap().show().unwrap();
}

#[tauri::command]
fn get_cache_size(app: AppHandle) -> String {
    let cache_dir = app.path().app_cache_dir().unwrap();
    cache::get_cache_dir_size(cache_dir)
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

// Helper function to get current track ID or first available track
fn get_current_or_first_track_id(
    id_state: &State<Mutex<IdState>>,
    music_files_state: &State<Mutex<MusicFilesState>>,
) -> Option<String> {
    let id_state = id_state.lock().ok()?;

    match id_state.get() {
        Some(id) => Some(id),
        None => {
            let music_files = music_files_state.lock().ok()?.get();
            music_files.first().map(|file| file.id.clone())
        }
    }
}

fn extract_name_with_path(path: String) -> String {
    // extract name from path
    let path = PathBuf::from(path);
    let name = path.file_stem().unwrap().to_str().unwrap();
    name.to_string()
}

fn get_image_path(name: String, app: AppHandle) -> Option<String> {
    let cache_dir = app.path().app_cache_dir().unwrap();
    let path = cache::load_cache(cache_dir, name);
    if path.exists() {
        return Some(path.to_str().unwrap().to_string());
    }
    None
}
