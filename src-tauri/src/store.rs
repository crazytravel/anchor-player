use log::warn;
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

pub fn store_playlist(app: &AppHandle, playlist: &[MusicFile]) {
    match app.store(PLAYLIST_STORE_FILENAME) {
        Ok(store) => store.set(PLAYLIST_STORE_KEY, json!(playlist)),
        Err(err) => warn!("failed to save playlist: {}", err),
    }
}

pub fn load_playlist(app: &AppHandle) -> Vec<MusicFile> {
    match app.store(PLAYLIST_STORE_FILENAME) {
        Ok(store) => match store.get(PLAYLIST_STORE_KEY) {
            Some(data) => serde_json::from_value(data).unwrap_or_default(),
            None => Vec::new(),
        },
        Err(err) => {
            warn!("failed to load playlist: {}", err);
            Vec::new()
        }
    }
}

pub fn store_play_state(app: &AppHandle, play_state: Option<PlayState>) {
    match app.store(PLAY_STATE_STORE_FILENAME) {
        Ok(store) => store.set(PLAY_STATE_STORE_KEY, json!(play_state)),
        Err(err) => warn!("failed to save play state: {}", err),
    }
}

pub fn load_play_state(app: &AppHandle) -> Option<PlayState> {
    match app.store(PLAY_STATE_STORE_FILENAME) {
        Ok(store) => store
            .get(PLAY_STATE_STORE_KEY)
            .and_then(|data| serde_json::from_value(data).ok()),
        Err(err) => {
            warn!("failed to load play state: {}", err);
            None
        }
    }
}

pub fn store_settings(app: &AppHandle, settings: MusicSetting) {
    match app.store(SETTINGS_STORE_FILENAME) {
        Ok(store) => store.set(SETTINGS_STORE_KEY, json!(settings)),
        Err(err) => warn!("failed to save settings: {}", err),
    }
}

pub fn load_settings(app: &AppHandle) -> MusicSetting {
    match app.store(SETTINGS_STORE_FILENAME) {
        Ok(store) => store
            .get(SETTINGS_STORE_KEY)
            .and_then(|data| serde_json::from_value(data).ok())
            .unwrap_or_default(),
        Err(err) => {
            warn!("failed to load settings: {}", err);
            MusicSetting::default()
        }
    }
}
