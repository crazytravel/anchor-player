use crate::player::PAUSED;
use atomic_float::AtomicF32;
use std::result;
use std::sync::atomic::Ordering;
use symphonia::core::audio::AudioBufferRef;

pub static VOLUME: AtomicF32 = AtomicF32::new(1.0);

pub trait AudioOutput {
    fn write(&mut self, decoded: AudioBufferRef<'_>) -> Result<()>;
    fn flush(&mut self);
}

#[allow(dead_code)]
#[allow(clippy::enum_variant_names)]
#[derive(Debug)]
pub enum AudioOutputError {
    OpenStreamError,
    PlayStreamError,
    StreamClosedError,
}

pub type Result<T> = result::Result<T, AudioOutputError>;

pub fn try_pause() {
    PAUSED.store(true, Ordering::SeqCst);
}

pub fn set_volume(volume: f32) {
    let clamped = volume.clamp(0.0, 1.0);
    VOLUME.store(clamped, Ordering::SeqCst);
}

// Platform-specific implementation
#[cfg(target_os = "linux")]
mod linux;
#[cfg(not(target_os = "linux"))]
mod default;

#[cfg(not(target_os = "linux"))]
pub use default::try_open;
#[cfg(target_os = "linux")]
pub use linux::try_open;
