use std::{
    fs,
    io::Error,
    path::{Path, PathBuf},
    sync::mpsc::Sender,
};

use chrono::{DateTime, Utc};
use futures::future::join_all;
use log::warn;
use serde::{Deserialize, Serialize};
use tauri_plugin_http::reqwest;

use crate::{
    music::{MusicError, MusicFile, MusicMap},
    player,
};

const CACHE_DIR: &str = "cache";
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3";

pub async fn init_cache(
    cache_dir: PathBuf,
    music_files: Vec<MusicFile>,
    tx: &Sender<MusicMap>,
) -> Result<(), MusicError> {
    let cache_dir = cache_dir.join(CACHE_DIR);
    if !cache_dir.exists() {
        fs::create_dir_all(&cache_dir).map_err(|e| {
            MusicError::new(
                None,
                "cache".to_string(),
                format!("failed to create cache dir: {}", e),
            )
        })?;
    }

    let mut filtered_music_files = music_files.clone();
    for music_file in &music_files {
        let music_name = &music_file.name;
        if let Some(meta_path) = load_meta_cache(&cache_dir, music_name) {
            filtered_music_files.retain(|music| music.name != *music_name);
            if let Ok(meta) = fs::read_to_string(meta_path)
                && let Ok(music_map) = serde_json::from_str::<MusicMap>(&meta)
            {
                let _ = tx.send(music_map);
            }
        }
    }

    let results = request_music_data(filtered_music_files).await;

    let futures = results
        .into_iter()
        .filter_map(|result| result.ok())
        .filter_map(|music_data_res| {
            let mut filtered_results: Vec<&Body> = music_data_res
                .results
                .iter()
                .filter(|music_data| {
                    music_data.kind.as_deref() == Some("song")
                        && music_data.wrapper_type.as_deref() == Some("track")
                })
                .collect();

            filtered_results.sort_by(|a, b| {
                let a_date = a
                    .release_date
                    .as_deref()
                    .and_then(|s| s.parse::<DateTime<Utc>>().ok());
                let b_date = b
                    .release_date
                    .as_deref()
                    .and_then(|s| s.parse::<DateTime<Utc>>().ok());
                a_date.cmp(&b_date)
            });

            let music_data = filtered_results.first()?;
            let title = music_data
                .track_name
                .as_deref()
                .unwrap_or_default()
                .to_string();
            let artist = music_data
                .artist_name
                .as_deref()
                .unwrap_or_default()
                .to_string();
            let album = music_data
                .collection_name
                .as_deref()
                .unwrap_or_default()
                .to_string();
            let artwork_url = music_data.artwork_url100.as_ref()?;
            let url = artwork_url.replace("100x100", "1000x1000");
            let hashed_filename = format!("{:x}", md5::compute(&title));
            let filename = format!("{}.webp", hashed_filename);
            let cache_dir = cache_dir.clone();
            let tx = tx.clone();
            let music_name = music_data_res.music_name;

            Some(async move {
                if let Ok(path) = save_img_to_cache(&url, &filename, &cache_dir).await {
                    let music_map =
                        MusicMap::new(music_name, title, artist, album, path.display().to_string());
                    save_meta_to_cache(&music_map, &cache_dir);
                    let _ = tx.send(music_map);
                }
            })
        })
        .collect::<Vec<_>>();

    join_all(futures).await;
    Ok(())
}

pub fn clear_cache(cache_dir: PathBuf) -> Result<(), MusicError> {
    let cache_dir = cache_dir.join(CACHE_DIR);
    if cache_dir.exists() {
        fs::remove_dir_all(&cache_dir).map_err(|e| {
            MusicError::new(
                None,
                "cache".to_string(),
                format!("failed to clear cache: {}", e),
            )
        })?;
    }
    Ok(())
}

fn load_meta_cache(cache_dir: &Path, music_name: &str) -> Option<PathBuf> {
    let hash_name = format!("{:x}", md5::compute(music_name));
    let filename = format!("{}.json", hash_name);
    let path = cache_dir.join(&filename);
    path.exists().then_some(path)
}

async fn request_music_data(music_files: Vec<MusicFile>) -> Vec<Result<MusicDataRes, Error>> {
    let futures = music_files.iter().map(|music_file| async move {
        let music_path = &music_file.path;
        let music_meta = player::load_metadata(music_path);
        let keyword = music_meta
            .map(|meta| format!("{} + {}", meta.artist, meta.title))
            .unwrap_or_else(|| music_file.name.replace('-', " + "));
        let encoded_keyword = urlencoding::encode(&keyword);
        let url = format!(
            "https://itunes.apple.com/cn/search?term={}",
            encoded_keyword
        );

        let client = reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .build()
            .map_err(|e| Error::other(format!("failed to build client: {}", e)))?;

        let text = client
            .get(&url)
            .send()
            .await
            .map_err(|e| Error::other(format!("request failed: {}", e)))?
            .text()
            .await
            .map_err(|e| Error::other(format!("failed to read response: {}", e)))?;

        let mut music_info: MusicDataRes = serde_json::from_str(&text)
            .map_err(|e| Error::other(format!("failed to parse response: {}", e)))?;
        music_info.music_name = music_file.name.clone();
        Ok::<MusicDataRes, Error>(music_info)
    });

    join_all(futures).await
}

async fn save_img_to_cache(url: &str, filename: &str, cache_dir: &Path) -> Result<PathBuf, Error> {
    let file_path = cache_dir.join(filename);
    if file_path.exists() {
        return Ok(file_path);
    }

    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| Error::other(format!("failed to build client: {}", e)))?;

    let bytes = client
        .get(url)
        .send()
        .await
        .map_err(|e| Error::other(format!("request failed: {}", e)))?
        .bytes()
        .await
        .map_err(|e| Error::other(format!("failed to read bytes: {}", e)))?;

    fs::write(&file_path, &bytes)?;
    Ok(file_path)
}

fn save_meta_to_cache(music_map: &MusicMap, cache_dir: &Path) {
    if let Ok(json) = serde_json::to_string(music_map)
        && let Err(e) = fs::write(
            cache_dir.join(format!("{:x}.json", md5::compute(&music_map.name))),
            json,
        )
    {
        warn!("failed to save meta cache: {}", e);
    }
}

fn calculate_dir_size(dir: &Path) -> u64 {
    let mut total_size = 0u64;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    total_size += metadata.len();
                } else if metadata.is_dir() {
                    total_size += calculate_dir_size(&entry.path());
                }
            }
        }
    }
    total_size
}

pub fn get_cache_dir_size(cache_dir: PathBuf) -> String {
    let size_mb = calculate_dir_size(&cache_dir) as f64 / (1024.0 * 1024.0);
    format!("{:.2}", size_mb)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicDataRes {
    #[serde(skip)]
    pub music_name: String,
    pub result_count: u32,
    pub results: Vec<Body>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Body {
    pub wrapper_type: Option<String>,
    pub kind: Option<String>,
    pub artist_id: Option<i64>,
    pub collection_id: Option<i64>,
    pub track_id: Option<i64>,
    pub artist_name: Option<String>,
    pub collection_name: Option<String>,
    pub track_name: Option<String>,
    pub collection_censored_name: Option<String>,
    pub track_censored_name: Option<String>,
    pub artist_view_url: Option<String>,
    pub collection_view_url: Option<String>,
    pub track_view_url: Option<String>,
    pub preview_url: Option<String>,
    pub artwork_url30: Option<String>,
    pub artwork_url60: Option<String>,
    pub artwork_url100: Option<String>,
    pub release_date: Option<String>,
    pub collection_explicitness: Option<String>,
    pub track_explicitness: Option<String>,
    pub disc_count: Option<i32>,
    pub disc_number: Option<i32>,
    pub track_count: Option<i32>,
    pub track_number: Option<i32>,
    pub track_time_millis: Option<i64>,
    pub country: Option<String>,
    pub currency: Option<String>,
    pub primary_genre_name: Option<String>,
    pub is_streamable: Option<bool>,
}
