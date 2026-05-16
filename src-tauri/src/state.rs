use serde::{Deserialize, Serialize};
use symphonia::core::units::Time;

use crate::music::MusicFile;

#[derive(Debug, Clone, Default)]
pub struct IdState(Option<String>);

impl IdState {
    pub fn set(&mut self, id: Option<String>) {
        self.0 = id;
    }
    pub fn get(&self) -> Option<String> {
        self.0.clone()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EventSource {
    Play,
    Pause,
    PlayNext,
    PlayPrev,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payload {
    pub id: String,
    pub time_position: Option<f64>,
}

impl Payload {
    pub fn new(id: String, time_position: Option<f64>) -> Self {
        Self { id, time_position }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PauseState {
    pub pause: bool,
    pub event_source: Option<EventSource>,
    pub payload: Option<Payload>,
}

impl Default for PauseState {
    fn default() -> Self {
        Self {
            pause: true,
            event_source: None,
            payload: None,
        }
    }
}

impl PauseState {
    pub fn set(
        &mut self,
        pause: bool,
        event_source: Option<EventSource>,
        payload: Option<Payload>,
    ) {
        self.pause = pause;
        self.event_source = event_source;
        self.payload = payload;
    }
}

#[derive(Debug, Clone)]
pub struct VolumeState(f32);

impl Default for VolumeState {
    fn default() -> Self {
        Self(1.0)
    }
}

impl VolumeState {
    pub fn set(&mut self, volume: f32) {
        self.0 = volume;
    }
    pub fn get(&self) -> f32 {
        self.0
    }
}

#[derive(Debug, Clone, Default)]
pub struct MusicFilesState(Vec<MusicFile>);

impl MusicFilesState {
    pub fn set(&mut self, music_files: Vec<MusicFile>) {
        self.0 = music_files;
    }
    pub fn get(&self) -> &[MusicFile] {
        &self.0
    }
    pub fn get_cloned(&self) -> Vec<MusicFile> {
        self.0.clone()
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u32)]
pub enum SequenceType {
    #[default]
    Repeat = 1,
    RepeatOne = 2,
    Random = 3,
}

impl SequenceType {
    pub fn from_u32(value: u32) -> Self {
        match value {
            2 => Self::RepeatOne,
            3 => Self::Random,
            _ => Self::Repeat,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct SequenceTypeState(SequenceType);

impl SequenceTypeState {
    pub fn set(&mut self, sequence_type: SequenceType) {
        self.0 = sequence_type;
    }
    pub fn get(&self) -> SequenceType {
        self.0
    }
}

#[derive(Debug, Clone, Default)]
pub struct TimePositionState(Option<Time>);

impl TimePositionState {
    pub fn set(&mut self, time_position: Option<Time>) {
        self.0 = time_position;
    }
    pub fn get(&self) -> Option<Time> {
        self.0
    }
}
