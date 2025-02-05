use serde_json::json;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::music::{MusicFile, MusicSetting, PlayState};

pub const PLAYLIST_STORE_FILENAME: &str = "playlist_store.json";
pub const PLAYLIST_STORE_KEY: &str = "playlist";

pub const PLAY_STATE_STORE_FILENAME: &str = "play_state_store.json";
pub const PLAY_STATE_STORE_KEY: &str = "play_state";

pub const SETTINGS_STORE_FILENAME: &str = "settings_store.json";
pub const SETTINGS_STORE_KEY: &str = "settings";

pub fn store_playlist(app: &AppHandle, playlist: &Vec<MusicFile>) {
    let playlist_store = app.store(PLAYLIST_STORE_FILENAME);
    match playlist_store {
        Ok(store) => store.set(PLAYLIST_STORE_KEY, json!(playlist)),
        Err(err) => println!("error while saving playlist:{:#?}", err),
    }
}

pub fn load_playlist(app: &AppHandle) -> Vec<MusicFile> {
    let playlist_store = app.store(PLAYLIST_STORE_FILENAME);
    match playlist_store {
        Ok(store) => match store.get(PLAYLIST_STORE_KEY) {
            Some(data) => match data.as_array() {
                Some(playlist) => playlist
                    .iter()
                    .map(|music| MusicFile::from_json(music))
                    .collect(),
                None => Vec::new(),
            },
            None => Vec::new(),
        },
        Err(err) => {
            println!("error while loading playlist:{:#?}", err);
            Vec::new()
        }
    }
}

pub fn store_play_state(app: &AppHandle, play_state: Option<PlayState>) {
    let playlist_store = app.store(PLAY_STATE_STORE_FILENAME);
    match playlist_store {
        Ok(store) => store.set(PLAY_STATE_STORE_KEY, json!(play_state)),
        Err(err) => println!("error while saving play state:{:#?}", err),
    }
}

pub fn load_play_state(app: &AppHandle) -> Option<PlayState> {
    let play_state_store = app.store(PLAY_STATE_STORE_FILENAME);
    match play_state_store {
        Ok(store) => match store.get(PLAY_STATE_STORE_KEY) {
            Some(data) => {
                if data.is_null() {
                    return None;
                }
                Some(PlayState::from_json(&data))
            }
            None => None,
        },
        Err(err) => {
            println!("error while loading play state:{:#?}", err);
            None
        }
    }
}

pub fn store_settings(app: &AppHandle, settings: MusicSetting) {
    let settings_store = app.store(SETTINGS_STORE_FILENAME);
    match settings_store {
        Ok(store) => store.set(SETTINGS_STORE_KEY, json!(settings)),
        Err(err) => println!("error while saving settings:{:#?}", err),
    }
}

pub fn load_settings(app: &AppHandle) -> MusicSetting {
    let settings_store = app.store(SETTINGS_STORE_FILENAME);
    match settings_store {
        Ok(store) => match store.get(SETTINGS_STORE_KEY) {
            Some(data) => {
                if data.is_null() {
                    return MusicSetting::default();
                }
                MusicSetting::from_json(&data)
            }
            None => MusicSetting::default(),
        },
        Err(err) => {
            println!("error while loading settings:{:#?}", err);
            MusicSetting::default()
        }
    }
}
