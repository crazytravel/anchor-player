#![warn(rust_2018_idioms)]
#![forbid(unsafe_code)]
#![allow(clippy::needless_update)]

use std::fs::File;
use std::path::Path;
use std::sync::Mutex;
use std::sync::mpsc::Sender;

use base64::Engine;
use base64::engine::general_purpose;
use log::{debug, info, warn};
use symphonia::core::codecs::{CODEC_TYPE_NULL, DecoderOptions, FinalizeResult};
use symphonia::core::errors::{Error, Result};
use symphonia::core::formats::{FormatReader, SeekMode, SeekTo, Track};
use symphonia::core::io::{MediaSource, MediaSourceStream, ReadOnlySource};
use symphonia::core::meta::{MetadataOptions, StandardTagKey, Visual};
use symphonia::core::probe::{Hint, ProbeResult};
use symphonia::core::units::{Time, TimeBase};
use tauri::{AppHandle, Manager};

use crate::music::{MusicImage, MusicInfo, MusicMeta, PlayState};
use crate::output;
use crate::state::{IdState, MusicFilesState, PauseState, TimePositionState};

const DIRTY_DATA: &str = "【熊猫无损音乐www.xmwav.com】更多打包资源下载";

pub fn load_metadata(music_path: &str) -> Option<MusicMeta> {
    let path = Path::new(music_path);
    let hint = Hint::new();
    let source = File::open(path).ok()?;
    let mss = MediaSourceStream::new(Box::new(source), Default::default());

    let mut probed = symphonia::default::get_probe()
        .format(&hint, mss, &Default::default(), &Default::default())
        .ok()?;

    let format_metadata = probed.format.metadata();
    let format_current = format_metadata.current();
    let metadata_rev = probed.metadata.get();

    let tags = if let Some(metadata_rev) = format_current {
        metadata_rev.tags()
    } else if let Some(current) = metadata_rev.as_ref().and_then(|m| m.current()) {
        current.tags()
    } else {
        return None;
    };

    if tags.is_empty() {
        return None;
    }

    let mut music_meta = MusicMeta::new(String::new());
    for tag in tags.iter().filter(|tag| tag.is_known()) {
        if let Some(std_key) = tag.std_key {
            match std_key {
                StandardTagKey::Album => {
                    music_meta.album = tag.value.to_string().replace(DIRTY_DATA, "");
                }
                StandardTagKey::Artist => {
                    music_meta.artist = tag.value.to_string().replace(DIRTY_DATA, "");
                }
                StandardTagKey::TrackTitle => {
                    music_meta.title = tag.value.to_string().replace(DIRTY_DATA, "");
                }
                _ => {}
            }
        }
    }
    Some(music_meta)
}

pub fn start_play(
    app: &AppHandle,
    time_position: Option<Time>,
    music_path: &str,
    play_state: &Sender<PlayState>,
    store_state: &Sender<PlayState>,
    music_info_tx: &Sender<MusicInfo>,
    music_image_tx: &Sender<MusicImage>,
) -> Result<i32> {
    let path = Path::new(music_path);
    let mut hint = Hint::new();

    let source: Box<dyn MediaSource> = if path.as_os_str() == "-" {
        Box::new(ReadOnlySource::new(std::io::stdin()))
    } else {
        if let Some(extension) = path.extension()
            && let Some(extension_str) = extension.to_str()
        {
            hint.with_extension(extension_str);
        }
        Box::new(File::open(path)?)
    };

    let mss = MediaSourceStream::new(source, Default::default());
    let format_opts = Default::default();
    let metadata_opts: MetadataOptions = Default::default();

    match symphonia::default::get_probe().format(&hint, mss, &format_opts, &metadata_opts) {
        Ok(mut probed) => {
            dump_visuals(&mut probed, music_image_tx);

            let tracks = probed.format.tracks();
            if !tracks.is_empty() {
                for track in tracks.iter() {
                    let params = &track.codec_params;
                    let mut music_info = MusicInfo::default();

                    if let Some(codec) = symphonia::default::get_codecs().get_codec(params.codec) {
                        music_info.codec = codec.long_name.to_string();
                        music_info.codec_short = codec.short_name.to_string();
                    }
                    if let Some(rate) = params.sample_rate {
                        music_info.sample_rate = rate.to_string();
                    }
                    if params.start_ts > 0 {
                        if let Some(tb) = params.time_base {
                            music_info.start_time =
                                format!("{} ({})", fmt_time(params.start_ts, tb), params.start_ts);
                        } else {
                            music_info.start_time = params.start_ts.to_string();
                        }
                    }
                    if let Some(n_frames) = params.n_frames {
                        if let Some(tb) = params.time_base {
                            music_info.duration =
                                format!("{} ({})", fmt_time(n_frames, tb), n_frames);
                        } else {
                            music_info.frames = n_frames.to_string();
                        }
                    }
                    if let Some(sample_format) = params.sample_format {
                        music_info.sample_format = format!("{:?}", sample_format);
                    }
                    if let Some(bits_per) = params.bits_per_sample {
                        music_info.bits_per_sample = bits_per.to_string();
                    }
                    let _ = music_info_tx.send(music_info);
                }
            }

            let decode_opts = Default::default();
            play(
                probed.format,
                None,
                time_position,
                &decode_opts,
                play_state,
                store_state,
                app,
            )
        }
        Err(err) => {
            info!("the input is not supported: {}", err);
            Err(err)
        }
    }
}

#[derive(Copy, Clone)]
struct PlayTrackOptions {
    track_id: u32,
    seek_ts: u64,
}

fn play(
    mut reader: Box<dyn FormatReader>,
    track_num: Option<usize>,
    seek: Option<Time>,
    decode_opts: &DecoderOptions,
    play_state_tx: &Sender<PlayState>,
    store_state_tx: &Sender<PlayState>,
    app: &AppHandle,
) -> Result<i32> {
    let track = track_num
        .and_then(|t| reader.tracks().get(t))
        .or_else(|| first_supported_track(reader.tracks()));

    let mut track_id = match track {
        Some(track) => track.id,
        _ => return Ok(0),
    };

    let seek_ts = if let Some(seek) = seek {
        let seek_to = SeekTo::Time {
            time: seek,
            track_id: Some(track_id),
        };

        match reader.seek(SeekMode::Accurate, seek_to) {
            Ok(seeked_to) => seeked_to.required_ts,
            Err(Error::ResetRequired) => {
                track_id = first_supported_track(reader.tracks()).unwrap().id;
                0
            }
            Err(err) => {
                warn!("seek error: {}", err);
                0
            }
        }
    } else {
        0
    };

    let mut audio_output = None;
    let mut track_info = PlayTrackOptions { track_id, seek_ts };

    let result = loop {
        match play_track(
            &mut reader,
            &mut audio_output,
            track_info,
            decode_opts,
            play_state_tx,
            store_state_tx,
            app,
        ) {
            Err(Error::ResetRequired) => {
                let track_id = first_supported_track(reader.tracks()).unwrap().id;
                track_info = PlayTrackOptions {
                    track_id,
                    seek_ts: 0,
                };
            }
            res => break res,
        }
    };

    if let Some(audio_output) = audio_output.as_mut() {
        audio_output.flush();
        let is_paused = app
            .state::<Mutex<PauseState>>()
            .lock()
            .map(|s| s.pause)
            .unwrap_or(false);
        if is_paused {
            return Ok(0);
        }
        return Ok(100);
    }
    result
}

struct TrackContext {
    id: Option<String>,
    name: String,
    path: String,
}

fn get_track_context(app: &AppHandle) -> Option<TrackContext> {
    let id_state = app.state::<Mutex<IdState>>();
    let id = id_state.lock().ok()?.get()?;

    let music_files_state = app.state::<Mutex<MusicFilesState>>();
    let state = music_files_state.lock().ok()?;
    let file = state.get().iter().find(|f| f.id == id).cloned();

    file.map(|f| TrackContext {
        id: Some(f.id),
        name: f.name,
        path: f.path,
    })
}

fn play_track(
    reader: &mut Box<dyn FormatReader>,
    audio_output: &mut Option<Box<dyn output::AudioOutput>>,
    play_opts: PlayTrackOptions,
    decode_opts: &DecoderOptions,
    play_state_tx: &Sender<PlayState>,
    store_state_tx: &Sender<PlayState>,
    app: &AppHandle,
) -> Result<i32> {
    let track = match reader
        .tracks()
        .iter()
        .find(|track| track.id == play_opts.track_id)
    {
        Some(track) => track,
        _ => return Ok(0),
    };

    let mut decoder = symphonia::default::get_codecs().make(&track.codec_params, decode_opts)?;

    let tb = track.codec_params.time_base;
    let dur = track
        .codec_params
        .n_frames
        .map(|frames| track.codec_params.start_ts + frames);

    let result = loop {
        {
            let is_paused = app
                .state::<Mutex<PauseState>>()
                .lock()
                .map(|s| s.pause)
                .unwrap_or(false);
            if is_paused {
                break Ok(());
            }
        }

        let packet = match reader.next_packet() {
            Ok(packet) => packet,
            Err(err) => break Err(err),
        };

        if packet.track_id() != play_opts.track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(decoded) => {
                if audio_output.is_none() {
                    let spec = *decoded.spec();
                    let duration = decoded.capacity() as u64;
                    audio_output.replace(output::try_open(spec, duration).unwrap());
                }

                if packet.ts() >= play_opts.seek_ts {
                    if let Some(tb) = tb {
                        let ctx = get_track_context(app);
                        if let Some(ctx) = ctx {
                            let ts = packet.ts();
                            let t = tb.calc_time(ts);

                            let hours = t.seconds / (60 * 60);
                            let mins = (t.seconds % (60 * 60)) / 60;
                            let secs = f64::from((t.seconds % 60) as u32) + t.frac;
                            let progress = format!("{:}:{:0>2}:{:0>4.1}", hours, mins, secs);

                            let left_duration = dur
                                .map(|dur| {
                                    let t = tb.calc_time(dur.saturating_sub(ts));
                                    let hours = t.seconds / (60 * 60);
                                    let mins = (t.seconds % (60 * 60)) / 60;
                                    let secs = f64::from((t.seconds % 60) as u32) + t.frac;
                                    format!("{:}:{:0>2}:{:0>4.1}", hours, mins, secs)
                                })
                                .unwrap_or_default();

                            if let Ok(mut time_pos) = app.state::<Mutex<TimePositionState>>().lock()
                            {
                                time_pos.set(Some(t));
                            }

                            let state = PlayState::new(
                                ctx.id.clone().unwrap_or_default(),
                                ctx.name.clone(),
                                ctx.path.clone(),
                                progress.clone(),
                                left_duration.clone(),
                            );
                            let _ = play_state_tx.send(state.clone());
                            let _ = store_state_tx.send(state);
                        } else {
                            return Ok(-1);
                        }
                    }

                    if let Some(audio_output) = audio_output {
                        audio_output.write(decoded, app).unwrap()
                    }
                }
            }
            Err(Error::DecodeError(err)) => {
                warn!("decode error: {}", err);
            }
            Err(err) => break Err(err),
        }
    };

    ignore_end_of_stream_error(result)?;
    do_verification(decoder.finalize())
}

fn first_supported_track(tracks: &[Track]) -> Option<&Track> {
    tracks
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
}

fn ignore_end_of_stream_error(result: Result<()>) -> Result<()> {
    match result {
        Err(Error::IoError(err))
            if err.kind() == std::io::ErrorKind::UnexpectedEof
                && err.to_string() == "end of stream" =>
        {
            Ok(())
        }
        _ => result,
    }
}

fn do_verification(finalization: FinalizeResult) -> Result<i32> {
    match finalization.verify_ok {
        Some(is_ok) => {
            debug!("verification: {}", if is_ok { "passed" } else { "failed" });
            Ok(i32::from(!is_ok))
        }
        _ => Ok(0),
    }
}

fn dump_visual(visual: &Visual, music_image_tx: &Sender<MusicImage>) {
    let content_type = visual.media_type.to_lowercase();
    let image = format!(
        "data:{};base64, {}",
        content_type,
        general_purpose::STANDARD.encode(&visual.data)
    );
    let _ = music_image_tx.send(MusicImage::new(image));
}

fn dump_visuals(probed: &mut ProbeResult, music_image_tx: &Sender<MusicImage>) {
    if let Some(metadata) = probed.format.metadata().current() {
        for visual in metadata.visuals().iter() {
            dump_visual(visual, music_image_tx);
        }

        if probed.metadata.get().as_ref().is_some() {
            info!(
                "visuals from container format are preferred; skipping additional probed visuals"
            );
        }
    } else if let Some(metadata) = probed.metadata.get().as_ref().and_then(|m| m.current()) {
        for visual in metadata.visuals().iter() {
            dump_visual(visual, music_image_tx);
        }
    }
}

fn fmt_time(ts: u64, tb: TimeBase) -> String {
    let time = tb.calc_time(ts);
    let hours = time.seconds / (60 * 60);
    let mins = (time.seconds % (60 * 60)) / 60;
    let secs = f64::from((time.seconds % 60) as u32) + time.frac;
    format!("{}:{:0>2}:{:0>6.3}", hours, mins, secs)
}
