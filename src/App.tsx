import {useEffect, useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {open} from '@tauri-apps/plugin-dialog';

import "./App.css";

import {listen} from "@tauri-apps/api/event";
import {Music, MusicImage, MusicInfo, MusicMeta} from "./declare.ts";
import Info from "./info";
import {InfoIcon, NextIcon, OpenFileIcon, OpenFolderIcon, PlayIcon, PreviousIcon, StopIcon} from "./icon";

function App() {
    const [musicInfo, setMusicInfo] = useState<MusicInfo>();
    const [music, setMusic] = useState<Music>();
    const [play, setPlay] = useState(false);
    const [infoDisplay, setInfoDisplay] = useState(false);
    const [musicMeta, setMusicMeta] = useState<MusicMeta>();
    const [musicImage, setMusicImage] = useState<MusicImage>();
    const [openedFiles, setOpenedFiles] = useState<string[]>();
    const [musicPath, setMusicPath] = useState("");

    // async function stopPlay() {
    //     setPlay(false);
    //     setMusicImage(undefined);
    //     setMusicMeta(undefined);
    //     try {
    //         calculateProgress("0:00:00.0", "0:00:00.0");
    //         await invoke("pause");
    //     } catch (error) {
    //         console.error("Error invoking pause:", error);
    //     }
    // }

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
            unListened = await listen<MusicInfo>("music-Index", (event) => {
                // console.log("Received event:", event.payload);
                setMusicInfo(event.payload);
            });
        } catch (error) {
            console.error("Error setting up listener:", error);
        }
    };

    const setupProgressListener = async () => {
        try {
            unListened = await listen<Music>("music", (event) => {
                // console.log("Received event:", event.payload);
                setMusic(event.payload);
                calculateProgress(event.payload.progress, event.payload.duration);
            });
        } catch (error) {
            console.error("Error setting up listener:", error);
        }
    };

    const setupFinishedListener = async () => {
        try {
            unListenedFinished = await listen<boolean>("finished", (event) => {
                // console.log("Received event:", event.payload);
                if (event.payload) {
                    setPlay(false);
                }
            });
        } catch (error) {
            console.error("Error setting up listener:", error);
        }
    };

    const setupMetaListener = async () => {
        try {
            unListenedMeta = await listen<MusicMeta>("music-meta", (event) => {
                // console.log("Received event:", event.payload);
                setMusicMeta(event.payload);
            });
        } catch (error) {
            console.error("Error setting up listener:", error);
        }
    };

    const setupImageListener = async () => {
        try {
            unListenedImage = await listen<MusicImage>("music-image", (event) => {
                // console.log("Received event:", event.payload);
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

    const openFile = async () => {
        // Open a dialog
        const files = await open({
            multiple: true,
            directory: false,
            filters: [{
                extensions: ['flac', 'mp3', 'wav', 'aac', 'ogg', 'riff', 'mkv', 'caf', 'isomp4'],
                name: ""
            }]
        });
        console.log(files);
        if (files) {
            setOpenedFiles(files);
        }
    }

    const openFolder = async () => {
        // when using `"withGlobalTauri": true`, you may use
        // const { open } = window.__TAURI__.dialog;

        // Open a dialog
        const file = await open({
            multiple: true,
            directory: true,
        });
        console.log(file);
        // Prints file path or URI
    }

    const changeMusic = async (file: string) => {
        console.log("the file path", file)
        setMusicPath(file);
    }

    useEffect(() => {
        const playMusic = async () => {
            await startPlay();
        };
        if (musicPath) {
            playMusic();
        }
    }, [musicPath]);

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
                    <div className="toolbar">
                        <OpenFileIcon onClick={openFile}/>
                        <OpenFolderIcon onClick={openFolder}/>
                    </div>
                    <ul className="list">
                        {
                            openedFiles?.map((file, index) => (
                                <li key={index} className={file === musicPath && play ? 'active' : ''}>
                                    <div className="fileName">
                                        {file}
                                    </div>
                                    <div className="statusIcon" onClick={() => changeMusic(file)}>
                                        {file === musicPath && play ? <StopIcon/> : <PlayIcon/>}
                                    </div>
                                </li>
                            ))
                        }
                    </ul>
                </div>
                <div className="play-wrapper">
                    <div className="title">
                        <div>Title: {musicMeta?.title || 'Unknown'}</div>
                        <div>Artist: {musicMeta?.artist || 'Unknown'}</div>
                        <div>Album: {musicMeta?.album || 'Unknown'}</div>
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
                            <PreviousIcon/>
                        </div>
                        <div className="play" onClick={startPlay}>
                            {play ? <StopIcon size={60}/> : <PlayIcon size={60}/>}
                        </div>
                        <div className="next" onClick={() => startPlayNext()}>
                            <NextIcon/>
                        </div>
                    </div>
                    <div className="info-wrapper">
                        <div className="short-info">
                            <div>{musicInfo?.codec_short}</div>
                            <div>{musicInfo?.sample_rate}Hz</div>
                            <div>{musicInfo?.bits_per_sample}bit</div>
                        </div>
                        <div className="info" onClick={() => setInfoDisplay(!infoDisplay)}>
                            <InfoIcon/>
                        </div>
                    </div>
                </div>
            </div>
            <Info onClick={() => setInfoDisplay(false)} musicInfo={musicInfo}
                  className={infoDisplay ? "music-info" : "music-info hide"}/>
        </main>
    );
}

export default App;
