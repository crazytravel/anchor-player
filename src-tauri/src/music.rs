use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize)]
pub struct MusicError {
    pub id: Option<String>,
    pub name: String,
    pub message: String,
}

impl MusicError {
    pub fn new(id: Option<String>, name: String, message: String) -> Self {
        Self { id, name, message }
    }
}

#[derive(Clone, Debug, Serialize, Default)]
pub struct MusicInfo {
    pub codec: String,
    pub codec_short: String,
    pub sample_rate: String,
    pub start_time: String,
    pub duration: String,
    pub frames: String,
    pub sample_format: String,
    pub bits_per_sample: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PlayState {
    pub id: Option<String>,
    pub name: Option<String>,
    pub path: Option<String>,
    pub progress: Option<String>,
    pub left_duration: Option<String>,
}

impl PlayState {
    pub fn new(
        id: String,
        name: String,
        path: String,
        progress: String,
        left_duration: String,
    ) -> Self {
        Self {
            id: Some(id),
            name: Some(name),
            path: Some(path),
            progress: Some(progress),
            left_duration: Some(left_duration),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct MusicMeta {
    pub title: String,
    pub artist: String,
    pub album: String,
}

impl MusicMeta {
    pub fn new(title: String) -> Self {
        Self {
            title,
            artist: String::new(),
            album: String::new(),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct MusicImage {
    pub image: String,
}

impl MusicImage {
    pub fn new(image: String) -> Self {
        Self { image }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicFile {
    pub id: String,
    pub name: String,
    pub path: String,
    pub image_path: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
}

impl MusicFile {
    pub fn new(
        id: String,
        name: String,
        path: String,
        image_path: Option<String>,
        artist: Option<String>,
        album: Option<String>,
    ) -> Self {
        Self {
            id,
            name,
            path,
            image_path,
            artist,
            album,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MusicSetting {
    pub volume: f32,
    pub sequence_type: u32,
}

impl Default for MusicSetting {
    fn default() -> Self {
        Self {
            volume: 1.0,
            sequence_type: 1,
        }
    }
}

impl MusicSetting {
    pub fn with_volume(&self, volume: f32) -> Self {
        Self {
            volume,
            sequence_type: self.sequence_type,
        }
    }
    pub fn with_sequence_type(&self, sequence_type: u32) -> Self {
        Self {
            volume: self.volume,
            sequence_type,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MusicMap {
    pub name: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub image_path: String,
}

impl MusicMap {
    pub fn new(
        name: String,
        title: String,
        artist: String,
        album: String,
        image_path: String,
    ) -> Self {
        Self {
            name,
            title,
            artist,
            album,
            image_path,
        }
    }
}
