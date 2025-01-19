import {useEffect, useState} from "react";
import coverImg from "./assets/1.jpg";
import {invoke} from "@tauri-apps/api/core";
import "./App.css";

import {listen} from "@tauri-apps/api/event";

interface MusicInfo {
    codec: string;
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

function App() {
    const [musicInfo, setMusicInfo] = useState<MusicInfo>();
    const [music, setMusic] = useState<Music>();
    const [play, setPlay] = useState(false);
    const [musicPath, setMusicPath] = useState("/Users/shuo/Downloads/1.wav");

    async function startPlay() {
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
            await invoke("play", {musicPath});
        } catch (error) {
            console.error("Error invoking play:", error);
        }
    }

    let unListened: () => void;
    let unListenedProgress: () => void;
    let unListenedFinished: () => void;

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
        }
    }, []);

    return (
        <main className="container">
            <h1>Anchor Player</h1>
            <form
                className="form"
                onSubmit={(e) => {
                    e.preventDefault();
                    startPlay();
                }}
            >
                <input
                    id="greet-input"
                    className="path"
                    onChange={(e) => setMusicPath(e.currentTarget.value)}
                    placeholder="Enter a path..."
                    value={musicPath}
                />
                <button type="submit">{play ? 'Stop' : 'Play'}</button>
            </form>
            <div className="form">
                <img
                    src={coverImg}
                    className={play ? "logo react rotate" : "logo react"}
                    alt="React logo"
                />
            </div>
            <div className="time-wrapper">
                <div className="progress">{music?.progress}</div>
                &nbsp;/&nbsp;
                <div className="duration">{music?.duration}</div>
            </div>
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
            <div className="row">
                <div className="label">Codec:</div>
                <div className="col">{musicInfo?.codec}</div>
            </div>
            <div className="row">
                <div className="label">Sample Rate:</div>
                <div className="col">{musicInfo?.sample_rate}</div>
            </div>
            <div className="row">
                <div className="label">Start Time:</div>
                <div className="col">{musicInfo?.start_time}</div>
            </div>
            <div className="row">
                <div className="label">Duration:</div>
                <div className="col">{musicInfo?.duration}</div>
            </div>
            <div className="row">
                <div className="label">Frames:</div>
                <div className="col">{musicInfo?.frames}</div>
            </div>
            <div className="row">
                <div className="label">Time Base:</div>
                <div className="col">{musicInfo?.time_base}</div>
            </div>
            <div className="row">
                <div className="label">Encoder Delay:</div>
                <div className="col">{musicInfo?.encoder_delay}</div>
            </div>
            <div className="row">
                <div className="label">Encoder Padding:</div>
                <div className="col">{musicInfo?.encoder_padding}</div>
            </div>
            <div className="row">
                <div className="label">Sample Format:</div>
                <div className="col">{musicInfo?.sample_format}</div>
            </div>
            <div className="row">
                <div className="label">Bits per Sample:</div>
                <div className="col">{musicInfo?.bits_per_sample}</div>
            </div>
            <div className="row">
                <div className="label">Channel:</div>
                <div className="col">{musicInfo?.channel}</div>
            </div>
            <div className="row">
                <div className="label">Channel Map:</div>
                <div className="col">{musicInfo?.channel_map}</div>
            </div>
            <div className="row">
                <div className="label">Channel Layout:</div>
                <div className="col">{musicInfo?.channel_layout}</div>
            </div>
            <div className="row">
                <div className="label">Language:</div>
                <div className="col">{musicInfo?.language}</div>
            </div>
        </main>
    );
}

export default App;
