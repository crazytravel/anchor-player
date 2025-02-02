use super::Result;
use std::sync::RwLock;
use symphonia::core::audio::*;
use symphonia::core::units::Duration;

use crate::output::{AudioOutput, AudioOutputError};
use libpulse_binding as pulse;
use libpulse_simple_binding as psimple;

use crate::AppState;
use log::{error, warn};
use tauri::Manager;

pub struct PulseAudioOutput {
    pa: psimple::Simple,
    sample_buf: RawSampleBuffer<f32>,
}

impl PulseAudioOutput {
    pub fn try_open(spec: SignalSpec, duration: Duration) -> Result<Box<dyn AudioOutput>> {
        // An interleaved buffer is required to send data to PulseAudio. Use a SampleBuffer to
        // move data between Symphonia AudioBuffers and the byte buffers required by PulseAudio.
        let sample_buf = RawSampleBuffer::<f32>::new(duration, spec);

        // Create a PulseAudio stream specification.
        let pa_spec = pulse::sample::Spec {
            format: pulse::sample::Format::FLOAT32NE,
            channels: spec.channels.count() as u8,
            rate: spec.rate,
        };

        assert!(pa_spec.is_valid());

        let pa_ch_map = map_channels_to_pa_channelmap(spec.channels);

        // PulseAudio seems to not play very short audio buffers, use these custom buffer
        // attributes for very short audio streams.
        //
        // let pa_buf_attr = pulse::def::BufferAttr {
        //     maxlength: u32::MAX,
        //     tlength: 1024,
        //     prebuf: u32::MAX,
        //     minreq: u32::MAX,
        //     fragsize: u32::MAX,
        // };

        // Create a PulseAudio connection.
        let pa_result = psimple::Simple::new(
            None,                               // Use default server
            "Anchor Player",                    // Application name
            pulse::stream::Direction::Playback, // Playback stream
            None,                               // Default playback device
            "Music",                            // Description of the stream
            &pa_spec,                           // Signal specification
            pa_ch_map.as_ref(),                 // Channel map
            None,                               // Custom buffering attributes
        );

        match pa_result {
            Ok(pa) => Ok(Box::new(PulseAudioOutput { pa, sample_buf })),
            Err(err) => {
                error!("audio output stream open error: {}", err);

                Err(AudioOutputError::OpenStreamError)
            }
        }
    }

    fn handle_stream_state(&self, app: &tauri::AppHandle) {
        let state_handle = app.state::<RwLock<AppState>>();
        let state = state_handle.read().unwrap();
        if state.paused {
            let _ = self.pa.drain();
        }
    }
}

impl AudioOutput for PulseAudioOutput {
    fn write(&mut self, decoded: AudioBufferRef<'_>, app: &tauri::AppHandle) -> Result<()> {
        // Do nothing if there are no audio frames.
        if decoded.frames() == 0 {
            return Ok(());
        }

        self.handle_stream_state(app);

        // If paused, just return without writing
        let state_handle = app.state::<RwLock<AppState>>();
        let state = state_handle.read().unwrap();
        if state.paused {
            return Ok(());
        }

        // Interleave samples from the audio buffer into the sample buffer.
        self.sample_buf.copy_interleaved_ref(decoded);

        // Apply volume scaling.
        let state_handle = app.state::<RwLock<AppState>>();
        let state = state_handle.read().unwrap();
        let volume = state.volume;
        if volume != 1.0 {
            let mut samples = self.sample_buf.as_bytes();
            for sample in samples.chunks_exact_mut(4) {
                if let Ok(value) = sample.try_into() {
                    let mut float_sample = f32::from_le_bytes(value);
                    float_sample *= volume;
                    sample.copy_from_slice(&float_sample.to_le_bytes());
                }
            }
        }

        // Write interleaved samples to PulseAudio.
        match self.pa.write(self.sample_buf.as_bytes()) {
            Err(err) => {
                error!("audio output stream write error: {}", err);

                Err(AudioOutputError::StreamClosedError)
            }
            _ => Ok(()),
        }
    }

    fn flush(&mut self) {
        // Flush is best-effort, ignore the returned result.
        let _ = self.pa.drain();
    }
}

/// Maps a set of Symphonia `Channels` to a PulseAudio channel map.
fn map_channels_to_pa_channelmap(channels: Channels) -> Option<pulse::channelmap::Map> {
    let mut map: pulse::channelmap::Map = Default::default();
    map.init();
    map.set_len(channels.count() as u8);

    let is_mono = channels.count() == 1;

    for (i, channel) in channels.iter().enumerate() {
        map.get_mut()[i] = match channel {
            Channels::FRONT_LEFT if is_mono => pulse::channelmap::Position::Mono,
            Channels::FRONT_LEFT => pulse::channelmap::Position::FrontLeft,
            Channels::FRONT_RIGHT => pulse::channelmap::Position::FrontRight,
            Channels::FRONT_CENTRE => pulse::channelmap::Position::FrontCenter,
            Channels::REAR_LEFT => pulse::channelmap::Position::RearLeft,
            Channels::REAR_CENTRE => pulse::channelmap::Position::RearCenter,
            Channels::REAR_RIGHT => pulse::channelmap::Position::RearRight,
            Channels::LFE1 => pulse::channelmap::Position::Lfe,
            Channels::FRONT_LEFT_CENTRE => pulse::channelmap::Position::FrontLeftOfCenter,
            Channels::FRONT_RIGHT_CENTRE => pulse::channelmap::Position::FrontRightOfCenter,
            Channels::SIDE_LEFT => pulse::channelmap::Position::SideLeft,
            Channels::SIDE_RIGHT => pulse::channelmap::Position::SideRight,
            Channels::TOP_CENTRE => pulse::channelmap::Position::TopCenter,
            Channels::TOP_FRONT_LEFT => pulse::channelmap::Position::TopFrontLeft,
            Channels::TOP_FRONT_CENTRE => pulse::channelmap::Position::TopFrontCenter,
            Channels::TOP_FRONT_RIGHT => pulse::channelmap::Position::TopFrontRight,
            Channels::TOP_REAR_LEFT => pulse::channelmap::Position::TopRearLeft,
            Channels::TOP_REAR_CENTRE => pulse::channelmap::Position::TopRearCenter,
            Channels::TOP_REAR_RIGHT => pulse::channelmap::Position::TopRearRight,
            _ => {
                // If a Symphonia channel cannot map to a PulseAudio position then return None
                // because PulseAudio will not be able to open a stream with invalid channels.
                warn!("failed to map channel {:?} to output", channel);
                return None;
            }
        }
    }

    Some(map)
}

pub fn try_open(spec: SignalSpec, duration: Duration) -> Result<Box<dyn AudioOutput>> {
    PulseAudioOutput::try_open(spec, duration)
}
