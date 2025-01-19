use serde::Serialize;

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
pub struct Music {
    pub duration: String,
    pub progress: String,
}

impl Music {
    pub fn new(duration: String, progress: String) -> Self {
        Self { duration, progress }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct MusicMeta {
    pub title: String,
    pub artist: String,
    pub album: String,
}

impl MusicMeta {
    pub fn new() -> Self {
        Self {
            title: "".to_string(),
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