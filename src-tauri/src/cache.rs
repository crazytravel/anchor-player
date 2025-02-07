use std::{
    fs,
    io::{Error, ErrorKind},
    path::PathBuf,
};

use chrono::{DateTime, Utc};
use futures::future::join_all;
use serde::{Deserialize, Serialize};
use serde_json::from_str;
use tauri_plugin_http::reqwest;

use crate::music::{MusicError, MusicFile};

const CASH_DIR: &str = "cache";

pub async fn init_cache(cache_dir: PathBuf, music_files: Vec<MusicFile>) -> Result<(), MusicError> {
    let cache_dir = cache_dir.join(CASH_DIR);
    println!("cache_dir>>>>>{:#?}", cache_dir);
    if !cache_dir.exists() {
        std::fs::create_dir_all(&cache_dir).unwrap();
    }
    let results = request_music_data(music_files).await;
    let cache_dir = cache_dir.clone();

    let futures = results
        .into_iter()
        .filter_map(|result| result.ok())
        .filter_map(|mut music_data_res| {
            music_data_res.results.sort_by(|a, b| {
                let a: DateTime<Utc> = a
                    .release_date
                    .parse()
                    .expect("Failed to parse ISO datetime");
                let b: DateTime<Utc> = b
                    .release_date
                    .parse()
                    .expect("Failed to parse ISO datetime");
                a.cmp(&b)
            });

            music_data_res.results.first().map(|music_data| {
                let artwork_url100 = music_data.artwork_url100.clone();
                let url = artwork_url100.replace("100x100", "600x600");
                let extension = url.split('.').last().unwrap();
                let filename = format!("{}.{}", music_data_res.music_name, extension);
                let cache_dir = cache_dir.clone();

                async move {
                    if let Err(e) = save_img_to_cache(url, filename, cache_dir).await {
                        println!("Failed to save image to cache: {}", e);
                    }
                }
            })
        })
        .collect::<Vec<_>>();

    join_all(futures).await;
    Ok(())
}

pub fn clear_cache(cache_dir: PathBuf) -> Result<(), MusicError> {
    let cache_dir = cache_dir.join(CASH_DIR);
    if cache_dir.exists() {
        std::fs::remove_dir_all(&cache_dir).unwrap();
    }
    Ok(())
}

pub fn load_cache(cache_dir: PathBuf, music_name: String) -> PathBuf {
    // search file by music_name without extension from cache folder
    let cache_dir = cache_dir.join(CASH_DIR);
    if cache_dir.exists() {
        let files = fs::read_dir(&cache_dir).unwrap();
        for file in files {
            let file = file.unwrap();
            let filename = file.file_name();
            let filename = filename.to_str().unwrap();
            if filename.starts_with(&music_name) {
                return file.path();
            }
        }
    }
    cache_dir
}

async fn request_music_data(music_files: Vec<MusicFile>) -> Vec<Result<MusicDataRes, Error>> {
    let futures = music_files.iter().map(|music_file| async move {
        let url = format!(
            "https://itunes.apple.com/cn/search?term={}",
            music_file.name
        );

        let res = reqwest::get(&url)
            .await
            .map_err(|e| Error::new(ErrorKind::Other, format!("Request failed: {}", e)))?;

        let text = res.text().await.map_err(|e| {
            Error::new(
                ErrorKind::Other,
                format!("Failed to get response text: {}", e),
            )
        })?;

        let mut music_info: MusicDataRes = from_str(&text).map_err(|e| {
            println!("error：{:#?}", e);
            Error::new(
                ErrorKind::InvalidData,
                format!("Failed to parse response: {}", e),
            )
        })?;
        music_info.music_name = music_file.name.clone();

        Ok::<MusicDataRes, Error>(music_info)
    });

    join_all(futures).await
}

async fn save_img_to_cache(url: String, filename: String, cache_dir: PathBuf) -> Result<(), Error> {
    let file_path = cache_dir.join(filename);
    if fs::metadata(&file_path).is_ok() {
        return Ok(());
    }
    let res = reqwest::get(&url)
        .await
        .map_err(|e| Error::new(ErrorKind::Other, format!("{}", e)))?;
    let bytes = res
        .bytes()
        .await
        .map_err(|e| Error::new(ErrorKind::Other, format!("{}", e)))?;
    fs::write(&file_path, &bytes)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicDataRes {
    #[serde(skip)]
    pub music_name: String,
    pub result_count: i32,
    pub results: Vec<Body>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Body {
    pub wrapper_type: String,
    pub kind: String,
    pub artist_id: i64,
    pub collection_id: i64,
    pub track_id: i64,
    pub artist_name: String,
    pub collection_name: String,
    pub track_name: String,
    pub collection_censored_name: String,
    pub track_censored_name: String,
    pub artist_view_url: String,
    pub collection_view_url: String,
    pub track_view_url: String,
    pub preview_url: String,
    pub artwork_url30: String,
    pub artwork_url60: String,
    pub artwork_url100: String,
    pub release_date: String,
    pub collection_explicitness: String,
    pub track_explicitness: String,
    pub disc_count: i32,
    pub disc_number: i32,
    pub track_count: i32,
    pub track_number: i32,
    pub track_time_millis: i64,
    pub country: String,
    pub currency: String,
    pub primary_genre_name: String,
    pub is_streamable: bool,
}
