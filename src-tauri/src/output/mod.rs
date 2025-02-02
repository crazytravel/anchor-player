use std::result;
use symphonia::core::audio::AudioBufferRef;

pub trait AudioOutput {
    fn write(&mut self, decoded: AudioBufferRef<'_>, app: &AppHandle) -> Result<()>;
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

// Platform-specific implementation
#[cfg(not(target_os = "linux"))]
mod default;
#[cfg(target_os = "linux")]
mod linux;

#[cfg(not(target_os = "linux"))]
pub use default::try_open;
#[cfg(target_os = "linux")]
pub use linux::try_open;
use tauri::AppHandle;
