use std::{
    fs,
    io::{Error, ErrorKind},
    path::PathBuf,
    sync::mpsc::Sender,
};

use chrono::{DateTime, Utc};
use futures::future::join_all;
use serde::{Deserialize, Serialize};
use serde_json::from_str;
use tauri_plugin_http::reqwest;

use crate::{
    music::{MusicError, MusicFile, MusicMap},
    player,
};

const CASH_DIR: &str = "cache";
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3";

pub async fn init_cache(
    cache_dir: PathBuf,
    music_files: Vec<MusicFile>,
    tx: &Sender<MusicMap>,
) -> Result<(), MusicError> {
    let cache_dir = cache_dir.join(CASH_DIR);
    println!("cache_dir>>>>>{:#?}", cache_dir);
    if !cache_dir.exists() {
        std::fs::create_dir_all(&cache_dir).unwrap();
    }
    let mut filtered_music_files = music_files.clone();
    for music_file in &music_files {
        let cache_dir = cache_dir.clone();
        let music_name = music_file.name.clone();
        let tx = tx.clone();
        let meta_path = load_meta_cache(cache_dir, music_name.clone());
        if let Some(meta_path) = meta_path {
            // load image from cache, filter out the music that has been cached
            filtered_music_files.retain(|music| music.name != music_name);
            // load meta from cache, send message to update playlist
            let meta = fs::read_to_string(meta_path).unwrap();
            let music_map: MusicMap = serde_json::from_str(&meta).unwrap();
            tx.send(music_map).expect("failed send image");
        }
    }

    let results = request_music_data(filtered_music_files).await;
    let cache_dir = cache_dir.clone();

    let futures = results
        .into_iter()
        .filter_map(|result| result.ok())
        .filter_map(|music_data_res| {
            let mut filtered_results: Vec<&Body> = music_data_res
                .results
                .iter()
                .filter(|music_data| {
                    music_data.kind == Some("song".to_string())
                        && music_data.wrapper_type == Some("track".to_string())
                })
                .collect();

            filtered_results.sort_by(|a, b| {
                if a.release_date.is_none() || b.release_date.is_none() {
                    return std::cmp::Ordering::Equal;
                }
                let a_parse = a.release_date.as_ref().unwrap().clone().parse();
                let b_parse = b.release_date.as_ref().unwrap().clone().parse();
                if a_parse.is_err() || b_parse.is_err() {
                    return std::cmp::Ordering::Equal;
                }
                let a: DateTime<Utc> = a_parse.unwrap();
                let b: DateTime<Utc> = b_parse.unwrap();
                a.cmp(&b)
            });

            filtered_results.first().and_then(|music_data| {
                let title = music_data
                    .track_name
                    .as_ref()
                    .map_or("".to_string(), |s| s.to_string());
                let artist = music_data
                    .artist_name
                    .as_ref()
                    .map_or("".to_string(), |s| s.to_string());
                let album = music_data
                    .collection_name
                    .as_ref()
                    .map_or("".to_string(), |s| s.to_string());
                music_data.artwork_url100.as_ref().map(|artwork_url100| {
                    let url = artwork_url100.to_string().replace("100x100", "1000x1000");
                    // let extension = url.split('.').last().unwrap();
                    // let filename = format!("{}.{}", music_data_res.music_name, extension);
                    let hashed_filename = md5::compute(title.clone());
                    let hashed_filename = format!("{:x}", hashed_filename);
                    let filename = format!("{}.webp", hashed_filename);
                    let cache_dir = cache_dir.clone();

                    async move {
                        if let Ok(path) = save_img_to_cache(url, filename, cache_dir.clone()).await
                        {
                            let music_map = MusicMap::new(
                                music_data_res.music_name,
                                title,
                                artist,
                                album,
                                path.display().to_string(),
                            );
                            save_meta_to_cache(music_map.clone(), cache_dir);
                            tx.send(music_map).expect("failed send image");
                        }
                    }
                })
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

// fn load_image_cache(cache_dir: PathBuf, music_name: String) -> Option<PathBuf> {
//     let hash_name = md5::compute(music_name.clone());
//     let hash_name = format!("{:x}", hash_name);
//     let filename = format!("{}.webp", hash_name);
//     load_cache(cache_dir, filename)
// }

fn load_meta_cache(cache_dir: PathBuf, music_name: String) -> Option<PathBuf> {
    let hash_name = md5::compute(music_name);
    let hash_name = format!("{:x}", hash_name);
    let filename = format!("{}.json", hash_name);
    load_cache(cache_dir, filename)
}

fn load_cache(cache_dir: PathBuf, search_filename: String) -> Option<PathBuf> {
    // search file by music_name without extension from cache folder
    if cache_dir.exists() {
        let files = fs::read_dir(&cache_dir).unwrap();
        for file in files {
            let file = file.unwrap();
            let filename = file.file_name();
            let filename = filename.to_str().unwrap();
            if filename == search_filename {
                return Some(file.path());
            }
        }
    }
    None
}

async fn request_music_data(music_files: Vec<MusicFile>) -> Vec<Result<MusicDataRes, Error>> {
    let futures = music_files.iter().map(|music_file| async move {
        // parse music data from source file
        let music_path = music_file.path.clone();
        let music_meta = player::load_metadata(&music_path);
        let keyword = music_meta
            .map(|meta| format!("{} + {}", meta.artist, meta.title))
            .unwrap_or(music_file.name.clone().replace("-", " + "));
        let url = format!("https://itunes.apple.com/cn/search?term={}", keyword);
        println!("request url: {:#?}", url);
        let client = reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .build()
            .map_err(|e| Error::new(ErrorKind::Other, format!("Failed to build client: {}", e)))?;
        let res = client
            .get(&url)
            .send()
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

async fn save_img_to_cache(
    url: String,
    filename: String,
    cache_dir: PathBuf,
) -> Result<PathBuf, Error> {
    let file_path = cache_dir.join(filename);
    if fs::metadata(&file_path).is_ok() {
        return Ok(file_path);
    }
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| Error::new(ErrorKind::Other, format!("Failed to build client: {}", e)))?;
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| Error::new(ErrorKind::Other, format!("Request failed: {}", e)))?;
    let bytes = res
        .bytes()
        .await
        .map_err(|e| Error::new(ErrorKind::Other, format!("{}", e)))?;
    fs::write(&file_path, &bytes)?;
    Ok(file_path)
}

fn save_meta_to_cache(music_map: MusicMap, cache_dir: PathBuf) {
    let filename = music_map.name.clone();
    let hash_name = md5::compute(filename);
    let hash_name = format!("{:x}", hash_name);
    let filename = format!("{}.json", hash_name);
    let file_path = cache_dir.join(filename);
    let json = serde_json::to_string(&music_map).unwrap();
    fs::write(&file_path, json).unwrap();
}

fn calculate_dir_size(dir: &PathBuf) -> f64 {
    let mut total_size = 0.0;
    if dir.exists() {
        if let Ok(entries) = fs::read_dir(dir) {
            entries.for_each(|entry| {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if let Ok(metadata) = entry.metadata() {
                        if metadata.is_file() {
                            total_size += metadata.len() as f64;
                        } else if metadata.is_dir() {
                            // Recursively calculate size for subdirectories
                            total_size += calculate_dir_size(&path);
                        }
                    }
                }
            });
        }
    }

    total_size
}

pub fn get_cache_dir_size(cache_dir: PathBuf) -> String {
    println!("cache dir: {:#?}", cache_dir);
    let size = calculate_dir_size(&cache_dir) / (1024.0 * 1024.0);
    format!("{:.2}", size)
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
