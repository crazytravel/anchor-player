import {useEffect, useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import "./App.css";

import {listen} from "@tauri-apps/api/event";

interface MusicInfo {
    codec: string;
    codec_short: string;
    sample_rate: string;
    start_time: string;
    duration: string;
    frames: string;
    time_base: string;
    encoder_delay: string;
    encoder_padding: string;
    sample_format: string;
    bits_per_sample: string;
    channel: string;
    channel_map: string;
    channel_layout: string;
    language: string;
}

interface Music {
    duration: string;
    progress: string;
}

interface MusicMeta {
    title: String;
    artist: String;
    album: String;
}

interface MusicImage {
    image: string;
}

function App() {
    const [musicInfo, setMusicInfo] = useState<MusicInfo>();
    const [music, setMusic] = useState<Music>();
    const [play, setPlay] = useState(false);
    const [infoDisplay, setInfoDisplay] = useState(false);
    const [musicPath, setMusicPath] = useState("/Users/shuo/Downloads/1.wav");
    const [musicMeta, setMusicMeta] = useState<MusicMeta>();
    const [musicImage, setMusicImage] = useState<MusicImage>();

    async function startPlay() {
        setPlay(!play);
        setMusicImage(undefined);
        setMusicMeta(undefined);
        if (play) {
            try {
                calculateProgress("0:00:00.0", "0:00:00.0");
                await invoke("pause");
            } catch (error) {
                console.error("Error invoking pause:", error);
            }
            return;
        }
        try {
            await invoke("play", {musicPath});
        } catch (error) {
            console.error("Error invoking play:", error);
        }
    }

    async function startPlayPrevious() {
        setPlay(!play);
        if (play) {
            try {
                calculateProgress("0:00:00.0", "0:00:00.0");
                await invoke("pause");
            } catch (error) {
                console.error("Error invoking pause:", error);
            }
            return;
        }
        try {
            await invoke("play-previous", {musicPath});
        } catch (error) {
            console.error("Error invoking play:", error);
        }
    }

    async function startPlayNext() {
        setPlay(!play);
        if (play) {
            try {
                calculateProgress("0:00:00.0", "0:00:00.0");
                await invoke("pause");
            } catch (error) {
                console.error("Error invoking pause:", error);
            }
            return;
        }
        try {
            await invoke("play-next", {musicPath});
        } catch (error) {
            console.error("Error invoking play:", error);
        }
    }

    let unListened: () => void;
    let unListenedProgress: () => void;
    let unListenedFinished: () => void;
    let unListenedMeta: () => void;
    let unListenedImage: () => void;

    const setupListener = async () => {
        try {
            unListened = await listen<MusicInfo>("music-info", (event) => {
                console.log("Received event:", event.payload);
                setMusicInfo(event.payload);
            });
        } catch (error) {
            console.error("Error setting up listener:", error);
        }
    };

    const setupProgressListener = async () => {
        try {
            unListened = await listen<Music>("music", (event) => {
                console.log("Received event:", event.payload);
                setMusic(event.payload);
                calculateProgress(event.payload.progress, event.payload.duration);
            });
        } catch (error) {
            console.error("Error setting up listener:", error);
        }
    };

    const setupFinishedListener = async () => {
        try {
            unListenedFinished = await listen<MusicInfo>("finished", (event) => {
                console.log("Received event:", event.payload);
                setPlay(false);
            });
        } catch (error) {
            console.error("Error setting up listener:", error);
        }
    };

    const setupMetaListener = async () => {
        try {
            unListenedMeta = await listen<MusicMeta>("music-meta", (event) => {
                console.log("Received event:", event.payload);
                setMusicMeta(event.payload);
            });
        } catch (error) {
            console.error("Error setting up listener:", error);
        }
    };

    const setupImageListener = async () => {
        try {
            unListenedImage = await listen<MusicImage>("music-image", (event) => {
                console.log("Received event:", event.payload);
                setMusicImage(event.payload);
            });
        } catch (error) {
            console.error("Error setting up listener:", error);
        }
    };

    const timeToSeconds = (timeStr: string): number => {
        const parts = timeStr.split(':');
        if (parts.length !== 3) return 0;

        const [hours, minutes, secondsPart] = parts;
        const [seconds, milliseconds] = secondsPart.split('.');

        return (
            parseInt(hours) * 3600 +
            parseInt(minutes) * 60 +
            parseInt(seconds) +
            (milliseconds ? parseFloat(`0.${milliseconds}`) : 0)
        );
    };

    const calculateProgress = (progress?: string, duration?: string): number => {
        if (!progress || !duration) return 0;

        // Convert time string to seconds
        const progressSeconds = timeToSeconds(progress);
        const durationSeconds = timeToSeconds(duration);

        if (durationSeconds === 0) return 0;
        return (progressSeconds / (progressSeconds + durationSeconds)) * 100;
    };

    useEffect(() => {
        setupListener();
        setupProgressListener();
        setupFinishedListener();
        setupMetaListener();
        setupImageListener();
        return () => {
            if (unListened) {
                unListened();
            }
            if (unListenedProgress) {
                unListenedProgress();
            }
            if (unListenedFinished) {
                unListenedFinished();
            }
            if (unListenedMeta) {
                unListenedMeta();
            }
            if (unListenedImage) {
                unListenedImage();
            }
        }
    }, []);

    return (
        <main className="container">
            <div className="play-container">
                <div className="list-wrapper">
                    <input
                        className="path"
                        onChange={(e) => setMusicPath(e.currentTarget.value)}
                        placeholder="Enter a path..."
                        value={musicPath}
                    />
                    <ul>
                        <li>1.</li>
                        <li>2.</li>
                        <li>3.</li>
                        <li>4.</li>
                        <li>5.</li>
                    </ul>
                </div>
                <div className="play-wrapper">
                    <div className="title">
                        <div>Title: {musicMeta?.title}</div>
                        <div>Artist: {musicMeta?.artist}</div>
                        <div>Album: {musicMeta?.album}</div>
                    </div>
                    <div className="img-container">
                        <div className={play ? "img-wrapper rotate" : "img-wrapper"}>
                            {
                                musicImage?.image ? (<img
                                    src={musicImage.image}
                                    className="logo"
                                    alt="music"
                                />) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"
                                         fill="#666666"
                                         className="logo"
                                    >
                                        <path
                                            d="M400-240q50 0 85-35t35-85v-280h120v-80H460v256q-14-8-29-12t-31-4q-50 0-85 35t-35 85q0 50 35 85t85 35Zm80 160q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
                                    </svg>)
                            }
                        </div>
                    </div>
                </div>
            </div>
            <div className="bottom-container">
                <div
                    className="progress-bar-container"
                    onClick={(e) => {
                        const container = e.currentTarget;
                        const rect = container.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const percentage = (x / rect.width) * 100;

                        const durationSeconds = timeToSeconds(music?.duration || "0:00:00.0");
                        const newTime = (percentage / 100) * durationSeconds;

                        // Invoke your Rust function to seek to the new position
                        invoke("seek", {position: newTime}).catch(console.error);
                    }}
                >
                    <div
                        className="progress-bar"
                        style={{
                            width: `${calculateProgress(music?.progress, music?.duration)}%`
                        }}
                    />
                </div>
                <div className="play-bar-container">
                    <div className="time">
                        <div className="progress">{music?.progress ? music.progress : '0:00:00.0'}</div>
                        &nbsp;/&nbsp;
                        <div className="duration">{music?.duration ? music.duration : '0:00:00.0'}</div>
                    </div>
                    <div className="btn">
                        <div className="prevous" onClick={() => startPlayPrevious()}>
                            <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px"
                                 fill="#666666">
                                <path
                                    d="M220-240v-480h60v480h-60Zm520 0L394-480l346-240v480Zm-60-240Zm0 125v-250L499-480l181 125Z"/>
                            </svg>
                        </div>
                        <div className="play" onClick={() => startPlay()}>
                            {play ? (
                                <svg xmlns="http://www.w3.org/2000/svg" height="60px" viewBox="0 -960 960 960"
                                     width="60px"
                                     fill="#666666">
                                    <path
                                        d="M320-320h320v-320H320v320ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" height="60px" viewBox="0 -960 960 960"
                                     width="60px"
                                     fill="#666666">
                                    <path
                                        d="m380-300 280-180-280-180v360ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
                                </svg>
                            )}
                        </div>
                        <div className="next" onClick={() => startPlayNext()}>
                            <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px"
                                 fill="#666666">
                                <path
                                    d="M680-240v-480h60v480h-60Zm-460 0v-480l346 240-346 240Zm60-240Zm0 125 181-125-181-125v250Z"/>
                            </svg>
                        </div>
                    </div>
                    <div className="info-wrapper">
                        <div className="short-info">
                            <div>{musicInfo?.codec_short}</div>
                            <div>{musicInfo?.sample_rate}Hz</div>
                            <div>{musicInfo?.bits_per_sample}bit</div>
                        </div>
                        <div className="info" onClick={() => setInfoDisplay(!infoDisplay)}>
                            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"
                                 fill="#666666">
                                <path
                                    d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
            <div className={infoDisplay ? "music-info" : "music-info hide"}>
                <div className="info-bar">
                    <span onClick={() => setInfoDisplay(!infoDisplay)}>{infoDisplay ? 'x' : '^'}</span>
                </div>
                <div className="row">
                    <div className="label">Codec:</div>
                    <div className="col">{musicInfo?.codec}</div>
                </div>
                <div className="row">
                    <div className="label">Sample Rate:</div>
                    <div className="col">{musicInfo?.sample_rate}Hz</div>
                </div>
                {/*<div className="row">*/}
                {/*    <div className="label">Start Time:</div>*/}
                {/*    <div className="col">{musicInfo?.start_time}</div>*/}
                {/*</div>*/}
                <div className="row">
                    <div className="label">Duration:</div>
                    <div className="col">{musicInfo?.duration}</div>
                </div>
                {/*<div className="row">*/}
                {/*    <div className="label">Frames:</div>*/}
                {/*    <div className="col">{musicInfo?.frames}</div>*/}
                {/*</div>*/}
                <div className="row">
                    <div className="label">Time Base:</div>
                    <div className="col">{musicInfo?.time_base}</div>
                </div>
                {/*<div className="row">*/}
                {/*    <div className="label">Encoder Delay:</div>*/}
                {/*    <div className="col">{musicInfo?.encoder_delay}</div>*/}
                {/*</div>*/}
                {/*<div className="row">*/}
                {/*    <div className="label">Encoder Padding:</div>*/}
                {/*    <div className="col">{musicInfo?.encoder_padding}</div>*/}
                {/*</div>*/}
                {/*<div className="row">*/}
                {/*    <div className="label">Sample Format:</div>*/}
                {/*    <div className="col">{musicInfo?.sample_format}</div>*/}
                {/*</div>*/}
                <div className="row">
                    <div className="label">Bits per Sample:</div>
                    <div className="col">{musicInfo?.bits_per_sample}bit</div>
                </div>
                <div className="row">
                    <div className="label">Channel:</div>
                    <div className="col">{musicInfo?.channel}</div>
                </div>
                {/*<div className="row">*/}
                {/*    <div className="label">Channel Map:</div>*/}
                {/*    <div className="col">{musicInfo?.channel_map}</div>*/}
                {/*</div>*/}
                {/*<div className="row">*/}
                {/*    <div className="label">Channel Layout:</div>*/}
                {/*    <div className="col">{musicInfo?.channel_layout}</div>*/}
                {/*</div>*/}
                {/*<div className="row">*/}
                {/*    <div className="label">Language:</div>*/}
                {/*    <div className="col">{musicInfo?.language}</div>*/}
                {/*</div>*/}
            </div>
        </main>
    );
}

export default App;
