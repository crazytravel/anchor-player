use serde::{Deserialize, Serialize};
use symphonia::core::units::Time;

use crate::music::{MusicFile, PlayState};

#[derive(Debug, Clone)]
pub struct IdState(i32);

impl IdState {
    fn new(id: i32) -> Self {
        Self(id)
    }
    pub fn default() -> Self {
        Self::new(-1)
    }
    pub fn set(&mut self, id: i32) {
        self.0 = id;
    }
    pub fn get(&self) -> i32 {
        self.0
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventSource {
    Play(String),
    Pause(String),
    PlayNext(String),
    PlayPrev(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payload {
    pub id: i32,
    pub time_position: Option<f64>,
}

impl Payload {
    pub fn new(id: i32, time_position: Option<f64>) -> Self {
        Self { id, time_position }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PauseState {
    pub pause: bool,
    pub event_source: Option<EventSource>,
    pub payload: Option<Payload>,
}

impl PauseState {
    pub fn default() -> Self {
        Self {
            pause: true,
            event_source: None,
            payload: None,
        }
    }
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

impl VolumeState {
    fn new(volume: f32) -> Self {
        Self(volume)
    }
    pub fn default() -> Self {
        Self::new(1.0)
    }
    pub fn set(&mut self, volume: f32) {
        self.0 = volume;
    }
    pub fn get(&self) -> f32 {
        self.0
    }
}

#[derive(Debug, Clone)]
pub struct MusicFilesState(Vec<MusicFile>);

impl MusicFilesState {
    fn new(music_files: Vec<MusicFile>) -> Self {
        Self(music_files)
    }
    pub fn default() -> Self {
        Self::new(vec![])
    }
    pub fn set(&mut self, music_files: Vec<MusicFile>) {
        self.0 = music_files;
    }
    pub fn get(&self) -> Vec<MusicFile> {
        self.0.clone()
    }
}

#[derive(Debug, Clone)]
pub struct SequenceTypeState(u32); // 1: repeat 2: repeat_one 3: random

impl SequenceTypeState {
    fn new(sequence_type: u32) -> Self {
        Self(sequence_type)
    }
    pub fn default() -> Self {
        Self::new(1)
    }
    pub fn set(&mut self, sequence_type: u32) {
        self.0 = sequence_type;
    }
    pub fn get(&self) -> u32 {
        self.0
    }
}

#[derive(Debug, Clone)]
pub struct TimePositionState(Option<Time>);

impl TimePositionState {
    fn new(time_position: Option<Time>) -> Self {
        Self(time_position)
    }
    pub fn default() -> Self {
        Self::new(None)
    }
    pub fn set(&mut self, time_position: Option<Time>) {
        self.0 = time_position;
    }
    pub fn get(&self) -> Option<Time> {
        self.0
    }
}
