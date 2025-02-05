use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize)]
pub struct MusicError {
    pub id: i32,
    pub name: String,
    pub message: String,
}

impl MusicError {
    pub fn new(id: i32, name: String, message: String) -> Self {
        Self { id, name, message }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct MusicInfo {
    pub codec: String,
    pub codec_short: String,
    pub sample_rate: String,
    pub start_time: String,
    pub duration: String,
    pub frames: String,
    pub time_base: String,
    pub encoder_delay: String,
    pub encoder_padding: String,
    pub sample_format: String,
    pub bits_per_sample: String,
    pub channel: String,
    pub channel_map: String,
    pub channel_layout: String,
    pub language: String,
}

impl MusicInfo {
    pub fn new() -> Self {
        Self {
            codec: "".to_string(),
            codec_short: "".to_string(),
            sample_rate: "".to_string(),
            start_time: "".to_string(),
            duration: "".to_string(),
            frames: "".to_string(),
            time_base: "".to_string(),
            encoder_delay: "".to_string(),
            encoder_padding: "".to_string(),
            sample_format: "".to_string(),
            bits_per_sample: "".to_string(),
            channel: "".to_string(),
            channel_map: "".to_string(),
            channel_layout: "".to_string(),
            language: "".to_string(),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct PlayState {
    pub id: i32,
    pub name: String,
    pub path: String,
    pub progress: String,
    pub left_duration: String,
}

impl PlayState {
    pub fn new(
        id: i32,
        name: String,
        path: String,
        progress: String,
        left_duration: String,
    ) -> Self {
        Self {
            id,
            name,
            path,
            progress,
            left_duration,
        }
    }
    pub fn from_json(json: &serde_json::Value) -> Self {
        let id = match json["id"].as_i64() {
            Some(id) => id as i32,
            None => 0,
        };
        let name = match json["name"].as_str() {
            Some(name) => name.to_string(),
            None => "".to_string(),
        };
        let path = match json["path"].as_str() {
            Some(path) => path.to_string(),
            None => "".to_string(),
        };
        let progress = match json["progress"].as_str() {
            Some(progress) => progress.to_string(),
            None => "".to_string(),
        };
        let left_duration = match json["left_duration"].as_str() {
            Some(duration) => duration.to_string(),
            None => "".to_string(),
        };
        Self {
            id,
            name,
            path,
            progress,
            left_duration,
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
            artist: "".to_string(),
            album: "".to_string(),
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
pub struct MusicFile {
    pub id: i32,
    pub name: String,
    pub path: String,
}

impl MusicFile {
    pub fn new(id: i32, name: String, path: String) -> Self {
        Self { id, name, path }
    }

    pub fn from_json(json: &serde_json::Value) -> Self {
        let id = match json["id"].as_i64() {
            Some(id) => id as i32,
            None => 0,
        };
        let name = match json["name"].as_str() {
            Some(name) => name.to_string(),
            None => "".to_string(),
        };
        let path = match json["path"].as_str() {
            Some(path) => path.to_string(),
            None => "".to_string(),
        };
        Self { id, name, path }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MusicSetting {
    pub volume: f32,
    pub sequence_type: u32,
}

impl MusicSetting {
    pub fn default() -> Self {
        Self {
            volume: 1.0,
            sequence_type: 1,
        }
    }
    pub fn from_json(json: &serde_json::Value) -> Self {
        let volume = match json["volume"].as_f64() {
            Some(volume) => volume as f32,
            None => 1.0,
        };
        let sequence_type = match json["sequence_type"].as_u64() {
            Some(sequence_type) => sequence_type as u32,
            None => 1,
        };
        Self {
            volume,
            sequence_type,
        }
    }
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
