#![warn(rust_2018_idioms)]
#![forbid(unsafe_code)]
#![allow(clippy::needless_update)]

use std::fs::File;
use std::path::Path;
use std::sync::mpsc::Sender;
use std::sync::Mutex;

use base64::engine::general_purpose;
use base64::Engine;
use symphonia::core::codecs::{DecoderOptions, FinalizeResult, CODEC_TYPE_NULL};
use symphonia::core::errors::{Error, Result};
use symphonia::core::formats::{FormatReader, SeekMode, SeekTo, Track};
use symphonia::core::io::{MediaSource, MediaSourceStream, ReadOnlySource};
use symphonia::core::meta::{MetadataOptions, MetadataRevision, StandardTagKey, Tag, Visual};
use symphonia::core::probe::{Hint, ProbeResult};
use symphonia::core::units::{Time, TimeBase};
use tauri::{AppHandle, Manager};

use crate::music::{MusicImage, MusicMeta, PlayState};
use crate::state::{IdState, MusicFilesState, PauseState, TimePositionState};
use crate::{music, output};
use log::{info, warn};
use music::MusicInfo;

// // Player struct
// pub struct Player {
//     pub output: Box<dyn output::AudioOutput>,
//     pub play_state_tx: Sender<PlayState>,
// }

// impl Player {
//     pub fn new(play_state_tx: Sender<PlayState>) -> Self {
//         Self {
//             output,
//             play_state_tx,
//         }
//     }
// }
//

pub fn load_metadata(
    app: &AppHandle,
    music_path: &str,
    music_info_tx: &Sender<MusicInfo>,
    music_meta_tx: &Sender<MusicMeta>,
    music_image_tx: &Sender<MusicImage>,
) -> Result<()> {
    let path = Path::new(music_path);
    // Create a hint to help the format registry guess what format reader is appropriate.
    let hint = Hint::new();
    let source = Box::new(File::open(path)?);

    // Create the media source stream using the boxed media source from above.
    let mss: MediaSourceStream = MediaSourceStream::new(source, Default::default());

    // Use the default options for format readers other than for gapless playback.
    let format_opts = Default::default();

    // Use the default options for metadata readers.
    let metadata_opts: MetadataOptions = Default::default();

    // Probe the media source stream for metadata and get the format reader.
    match symphonia::default::get_probe().format(&hint, mss, &format_opts, &metadata_opts) {
        Ok(mut probed) => {
            dump_visuals(&mut probed, music_image_tx);

            let tracks = probed.format.tracks();
            if !tracks.is_empty() {
                for track in tracks.iter() {
                    let params = &track.codec_params;

                    let mut music_info = MusicInfo::new();
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
                    if let Some(tb) = params.time_base {
                        music_info.time_base = tb.to_string();
                    }
                    if let Some(padding) = params.delay {
                        music_info.encoder_delay = padding.to_string();
                    }
                    if let Some(padding) = params.padding {
                        music_info.encoder_padding = padding.to_string();
                    }
                    if let Some(sample_format) = params.sample_format {
                        music_info.sample_format = format!("{:?}", sample_format);
                    }
                    if let Some(bits_per) = params.bits_per_sample {
                        music_info.bits_per_sample = bits_per.to_string();
                    }
                    if let Some(chan) = params.channels {
                        music_info.channel = chan.count().to_string();
                        music_info.channel_map = chan.to_string();
                    }
                    if let Some(channel_layout) = params.channel_layout {
                        music_info.channel_layout = format!("{:?}", channel_layout);
                    }
                    if let Some(language) = &track.language {
                        music_info.language = language.to_string();
                    }
                    music_info_tx
                        .send(music_info)
                        .expect("send the msg to frontend failed!");
                }
            }
            // Playback mode.
            print_format(&mut probed, music_meta_tx, app);
            Ok(())
        }
        Err(err) => {
            // The input was not supported by any format reader.
            info!("the input is not supported");
            Err(err)
        }
    }
}

pub fn start_play(
    app: &AppHandle,
    time_position: Option<Time>,
    music_path: &str,
    play_state: &Sender<PlayState>,
    music_info_tx: &Sender<MusicInfo>,
    music_meta_tx: &Sender<MusicMeta>,
    music_image_tx: &Sender<MusicImage>,
) -> Result<i32> {
    let path = Path::new(music_path);
    // Create a hint to help the format registry guess what format reader is appropriate.
    let mut hint = Hint::new();

    // If the path string is '-' then read from standard input.
    let source = if path.as_os_str() == "-" {
        Box::new(ReadOnlySource::new(std::io::stdin())) as Box<dyn MediaSource>
    } else {
        // Otherwise, get a Path from the path string.

        // Provide the file extension as a hint.
        if let Some(extension) = path.extension() {
            if let Some(extension_str) = extension.to_str() {
                hint.with_extension(extension_str);
            }
        }
        Box::new(File::open(path)?)
    };

    // Create the media source stream using the boxed media source from above.
    let mss: MediaSourceStream = MediaSourceStream::new(source, Default::default());

    // Use the default options for format readers other than for gapless playback.
    let format_opts = Default::default();

    // Use the default options for metadata readers.
    let metadata_opts: MetadataOptions = Default::default();

    // Get the value of the track option, if provided.
    let track = None;

    let no_progress = false;

    // Probe the media source stream for metadata and get the format reader.
    match symphonia::default::get_probe().format(&hint, mss, &format_opts, &metadata_opts) {
        Ok(mut probed) => {
            dump_visuals(&mut probed, music_image_tx);

            let tracks = probed.format.tracks();
            if !tracks.is_empty() {
                for track in tracks.iter() {
                    let params = &track.codec_params;

                    let mut music_info = MusicInfo::new();
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
                    if let Some(tb) = params.time_base {
                        music_info.time_base = tb.to_string();
                    }
                    if let Some(padding) = params.delay {
                        music_info.encoder_delay = padding.to_string();
                    }
                    if let Some(padding) = params.padding {
                        music_info.encoder_padding = padding.to_string();
                    }
                    if let Some(sample_format) = params.sample_format {
                        music_info.sample_format = format!("{:?}", sample_format);
                    }
                    if let Some(bits_per) = params.bits_per_sample {
                        music_info.bits_per_sample = bits_per.to_string();
                    }
                    if let Some(chan) = params.channels {
                        music_info.channel = chan.count().to_string();
                        music_info.channel_map = chan.to_string();
                    }
                    if let Some(channel_layout) = params.channel_layout {
                        music_info.channel_layout = format!("{:?}", channel_layout);
                    }
                    if let Some(language) = &track.language {
                        music_info.language = language.to_string();
                    }
                    music_info_tx
                        .send(music_info)
                        .expect("send the msg to frontend failed!");
                }
            }
            // Playback mode.
            print_format(&mut probed, music_meta_tx, app);
            // Set the decoder options.
            let decode_opts = Default::default();
            // Play it!
            play(
                probed.format,
                track,
                time_position,
                &decode_opts,
                no_progress,
                play_state,
                music_meta_tx,
                app,
            )
        }
        Err(err) => {
            // The input was not supported by any format reader.
            info!("the input is not supported");
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
    no_progress: bool,
    play_state_tx: &Sender<PlayState>,
    music_meta_tx: &Sender<MusicMeta>,
    app: &AppHandle,
) -> Result<i32> {
    // If the user provided a track number, select that track if it exists, otherwise, select the
    // first track with a known codec.
    let track = track_num
        .and_then(|t| reader.tracks().get(t))
        .or_else(|| first_supported_track(reader.tracks()));

    let mut track_id = match track {
        Some(track) => track.id,
        _ => return Ok(0),
    };

    // If seeking, seek the reader to the time or timestamp specified and get the timestamp of the
    // seeked position. All packets with a timestamp < the seeked position will not be played.
    //
    // Note: This is a half-baked approach to seeking! After seeking the reader, packets should be
    // decoded and *samples* discarded up-to the exact *sample* indicated by required_ts. The
    // current approach will discard excess samples if seeking to a sample within a packet.
    let seek_ts = if let Some(seek) = seek {
        let seek_to = SeekTo::Time {
            time: seek,
            track_id: Some(track_id),
        };

        // Attempt the seek. If the seek fails, ignore the error and return a seek timestamp of 0 so
        // that no samples are trimmed.
        match reader.seek(SeekMode::Accurate, seek_to) {
            Ok(seeked_to) => seeked_to.required_ts,
            Err(Error::ResetRequired) => {
                track_id = first_supported_track(reader.tracks()).unwrap().id;
                0
            }
            Err(err) => {
                // Don't give-up on a seek error.
                warn!("seek error: {}", err);
                0
            }
        }
    } else {
        // If not seeking, the seek timestamp is 0.
        0
    };

    // The audio output device.
    let mut audio_output = None;

    let mut track_info = PlayTrackOptions { track_id, seek_ts };

    let result = loop {
        match play_track(
            &mut reader,
            &mut audio_output,
            track_info,
            decode_opts,
            no_progress,
            play_state_tx,
            music_meta_tx,
            app,
        ) {
            Err(Error::ResetRequired) => {
                // The demuxer indicated that a reset is required. This is sometimes seen with
                // streaming OGG (e.g., Icecast) wherein the entire contents of the container change
                // (new tracks, codecs, metadata, etc.). Therefore, we must select a new track and
                // recreate the decoder.

                // Select the first supported track since the user's selected track number might no
                // longer be valid or make sense.
                let track_id = first_supported_track(reader.tracks()).unwrap().id;
                track_info = PlayTrackOptions {
                    track_id,
                    seek_ts: 0,
                };
            }
            res => break res,
        }
    };

    // Flush the audio output to finish playing back any leftover samples.
    if let Some(audio_output) = audio_output.as_mut() {
        audio_output.flush();
        let pause_state = app.state::<Mutex<PauseState>>();
        let pause_state = pause_state.lock().unwrap();
        if pause_state.pause {
            return Ok(0);
        }
        return Ok(100);
    }
    result
}

fn play_track(
    reader: &mut Box<dyn FormatReader>,
    audio_output: &mut Option<Box<dyn output::AudioOutput>>,
    play_opts: PlayTrackOptions,
    decode_opts: &DecoderOptions,
    no_progress: bool,
    play_state_tx: &Sender<PlayState>,
    music_meta_tx: &Sender<MusicMeta>,
    app: &AppHandle,
) -> Result<i32> {
    // Get the selected track using the track ID.
    let track = match reader
        .tracks()
        .iter()
        .find(|track| track.id == play_opts.track_id)
    {
        Some(track) => track,
        _ => return Ok(0),
    };

    // Create a decoder for the track.
    let mut decoder = symphonia::default::get_codecs().make(&track.codec_params, decode_opts)?;

    // Get the selected track's timebase and duration.
    let tb = track.codec_params.time_base;
    let dur = track
        .codec_params
        .n_frames
        .map(|frames| track.codec_params.start_ts + frames);

    // Decode and play the packets belonging to the selected track.
    let result = loop {
        {
            let pause_state = app.state::<Mutex<PauseState>>();
            let pause_state = pause_state.lock().unwrap();
            if pause_state.pause {
                break Ok(());
            }
        }

        // Get the next packet from the format reader.
        let packet = match reader.next_packet() {
            Ok(packet) => packet,
            Err(err) => break Err(err),
        };

        // If the packet does not belong to the selected track, skip it.
        if packet.track_id() != play_opts.track_id {
            continue;
        }

        //Print out new metadata.
        while !reader.metadata().is_latest() {
            reader.metadata().pop();

            if let Some(rev) = reader.metadata().current() {
                print_update(rev, music_meta_tx);
            }
        }

        // Decode the packet into audio samples.
        match decoder.decode(&packet) {
            Ok(decoded) => {
                // If the audio output is not open, try to open it.
                if audio_output.is_none() {
                    // Get the audio buffer specification. This is a description of the decoded
                    // audio buffer's sample format and sample rate.
                    let spec = *decoded.spec();

                    // Get the capacity of the decoded buffer. Note that this is capacity, not
                    // length! The capacity of the decoded buffer is constant for the life of the
                    // decoder, but the length is not.
                    let duration = decoded.capacity() as u64;

                    // Try to open the audio output.
                    audio_output.replace(output::try_open(spec, duration).unwrap());
                } else {
                    // TODO: Check the audio spec. and duration hasn't changed.
                }

                // Write the decoded audio samples to the audio output if the presentation timestamp
                // for the packet is >= the seeked position (0 if not seeking).
                if packet.ts() >= play_opts.seek_ts {
                    if !no_progress {
                        // let paused;
                        let music_id;
                        let music_name;
                        let music_path;
                        {
                            let id_state = app.state::<Mutex<IdState>>();
                            let id_state = id_state.lock().unwrap();
                            music_id = id_state.get();
                            if music_id == -1 {
                                music_name = "".to_string();
                                music_path = "".to_string();
                            } else {
                                let music_files_state = app.state::<Mutex<MusicFilesState>>();
                                let music_files_state = music_files_state.lock().unwrap();
                                let music_files = music_files_state.get();
                                let music_file = music_files
                                    .iter()
                                    .find(|&music_file| music_file.id == music_id)
                                    .cloned();
                                if let Some(music_file) = music_file {
                                    music_name = music_file.name.clone();
                                    music_path = music_file.path.clone();
                                } else {
                                    music_name = "".to_string();
                                    music_path = "".to_string();
                                }
                            }
                        }
                        let ts = packet.ts();
                        let mut progress = "".to_string();
                        let mut left_duration = "".to_string();
                        if let Some(tb) = tb {
                            let t = tb.calc_time(ts);

                            let hours = t.seconds / (60 * 60);
                            let mins = (t.seconds % (60 * 60)) / 60;
                            let secs = f64::from((t.seconds % 60) as u32) + t.frac;

                            progress = format!("{:}:{:0>2}:{:0>4.1}", hours, mins, secs);

                            if let Some(dur) = dur {
                                let t = tb.calc_time(dur.saturating_sub(ts));

                                let hours = t.seconds / (60 * 60);
                                let mins = (t.seconds % (60 * 60)) / 60;
                                let secs = f64::from((t.seconds % 60) as u32) + t.frac;

                                left_duration = format!("{:}:{:0>2}:{:0>4.1}", hours, mins, secs);
                            }

                            {
                                let time_position_state = app.state::<Mutex<TimePositionState>>();
                                let mut time_position_state = time_position_state.lock().unwrap();
                                time_position_state.set(Some(t));
                            }
                        }
                        play_state_tx
                            .send(PlayState::new(
                                music_id,
                                music_name,
                                music_path,
                                progress,
                                left_duration,
                            ))
                            .expect("send the msg to frontend failed!");
                    }
                    if let Some(audio_output) = audio_output {
                        audio_output.write(decoded, app).unwrap()
                    }
                }
            }
            Err(Error::DecodeError(err)) => {
                // Decode errors are not fatal. Print the error message and try to decode the next
                // packet as usual.
                warn!("decode error: {}", err);
            }
            Err(err) => break Err(err),
        }
    };

    // Return if a fatal error occured.
    ignore_end_of_stream_error(result)?;

    // Finalize the decoder and return the verification result if it's been enabled.
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
            // Do not treat "end of stream" as a fatal error. It's the currently only way a
            // format reader can indicate the media is complete.
            Ok(())
        }
        _ => result,
    }
}

fn do_verification(finalization: FinalizeResult) -> Result<i32> {
    match finalization.verify_ok {
        Some(is_ok) => {
            // Got a verification result.
            println!("verification: {}", if is_ok { "passed" } else { "failed" });

            Ok(i32::from(!is_ok))
        }
        // Verification not enabled by user, or unsupported by the codec.
        _ => Ok(0),
    }
}

fn dump_visual(visual: &Visual, music_image_tx: &Sender<MusicImage>) {
    let content_type = visual.media_type.to_lowercase();
    // convert the image to base64
    let image = format!(
        "data:{};base64, {}",
        content_type,
        general_purpose::STANDARD.encode(&visual.data)
    );

    music_image_tx
        .send(MusicImage::new(image))
        .expect("send the msg to frontend failed!");
}

fn dump_visuals(probed: &mut ProbeResult, music_image_tx: &Sender<MusicImage>) {
    if let Some(metadata) = probed.format.metadata().current() {
        for visual in metadata.visuals().iter() {
            dump_visual(visual, music_image_tx);
        }

        // Warn that certain visuals are preferred.
        if probed.metadata.get().as_ref().is_some() {
            info!("visuals that are part of the container format are preferentially dumped.");
            info!("not dumping additional visuals that were found while probing.");
        }
    } else if let Some(metadata) = probed.metadata.get().as_ref().and_then(|m| m.current()) {
        for visual in metadata.visuals().iter() {
            dump_visual(visual, music_image_tx);
        }
    }
}

fn print_format(probed: &mut ProbeResult, music_meta_tx: &Sender<MusicMeta>, app: &AppHandle) {
    // Prefer metadata that's provided in the container format, over other tags found during the
    // probe operation.
    if let Some(metadata_rev) = probed.format.metadata().current() {
        print_tags(metadata_rev.tags(), music_meta_tx);

        // Warn that certain tags are preferred.
        if probed.metadata.get().as_ref().is_some() {
            info!("tags that are part of the container format are preferentially printed.");
            info!("not printing additional tags that were found while probing.");
        }
    } else if let Some(metadata_rev) = probed.metadata.get().as_ref().and_then(|m| m.current()) {
        print_tags(metadata_rev.tags(), music_meta_tx);
    } else {
        let title;
        {
            let music_files_state = app.state::<Mutex<MusicFilesState>>();
            let music_files_state = music_files_state.lock().unwrap();
            let music_files = music_files_state.get();
            let id_state = app.state::<Mutex<IdState>>();
            let id_state = id_state.lock().unwrap();
            let id = id_state.get();
            let index = music_files
                .iter()
                .position(|music_file| music_file.id == id)
                .unwrap_or(0);
            title = music_files[index].name.clone();
        }
        let music_meta = MusicMeta::new(title);
        music_meta_tx
            .send(music_meta)
            .expect("send the msg to frontend failed!");
    }
}

fn print_update(rev: &MetadataRevision, music_meta_tx: &Sender<MusicMeta>) {
    print_tags(rev.tags(), music_meta_tx);
}

fn print_tags(tags: &[Tag], music_meta_tx: &Sender<MusicMeta>) {
    if !tags.is_empty() {
        let mut music_meta = MusicMeta::new("".to_string());
        // Print tags with a standard tag key first, these are the most common tags.
        for tag in tags.iter().filter(|tag| tag.is_known()) {
            if let Some(std_key) = tag.std_key {
                match std_key {
                    StandardTagKey::Album => {
                        music_meta.album = tag.value.to_string();
                    }
                    StandardTagKey::Artist => {
                        music_meta.artist = tag.value.to_string();
                    }
                    StandardTagKey::TrackTitle => {
                        music_meta.title = tag.value.to_string();
                    }
                    _ => {}
                }
            }
        }
        music_meta_tx
            .send(music_meta)
            .expect("send the msg to frontend failed!");
    }
}

fn fmt_time(ts: u64, tb: TimeBase) -> String {
    let time = tb.calc_time(ts);

    let hours = time.seconds / (60 * 60);
    let mins = (time.seconds % (60 * 60)) / 60;
    let secs = f64::from((time.seconds % 60) as u32) + time.frac;

    format!("{}:{:0>2}:{:0>6.3}", hours, mins, secs)
}
