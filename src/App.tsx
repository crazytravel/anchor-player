import {useEffect, useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {open} from '@tauri-apps/plugin-dialog';

import "./App.css";
import bg from './assets/bg.png';

import {listen} from "@tauri-apps/api/event";
import {Music, MusicImage, MusicInfo, MusicMeta} from "./declare.ts";
import Info from "./info";
import {
    InfoIcon,
    NextIcon,
    OpenFileIcon,
    OpenFolderIcon,
    PlayIcon,
    PreviousIcon,
    RandomIcon,
    RepeatIcon,
    RepeatOneIcon,
    StopIcon
} from "./icon";

function App() {
    const [musicInfo, setMusicInfo] = useState<MusicInfo>();
    const [music, setMusic] = useState<Music>();
    const [play, setPlay] = useState(false);
    const [infoDisplay, setInfoDisplay] = useState(false);
    const [musicMeta, setMusicMeta] = useState<MusicMeta>();
    const [musicImage, setMusicImage] = useState<MusicImage>();
    const [openedFiles, setOpenedFiles] = useState<string[]>();
    const [musicPath, setMusicPath] = useState<string>();
    const [sequenceType, setSequenceType] = useState(1);    // 1: repeat, 2: repeat one, 3: random

    async function start() {
        setPlay(() => true);
        if (musicPath) {
            const musicNameArr = musicPath.split('/');
            let musicName = musicNameArr[musicNameArr.length - 1];
            musicName = musicName.split('.')[0];
            console.log('musicName:', musicName);
            setMusicMeta({title: musicName, artist: '', album: ''});
        }
        await invoke('play', {musicPath});
    }

    async function stop() {
        setPlay(() => false);
        calculateProgress("0:00:00.0", "0:00:00.0");
        await invoke('pause');
    }

    async function playManagement() {
        if (!musicPath) {
            if (openedFiles && openedFiles.length > 0) {
                setMusicPath(() => openedFiles[0]);
            }
            return;
        }
        setMusicImage(undefined);
        setMusicMeta(undefined);
        if (play) {
            await stop();
            return;
        }
        await start();
    }

    async function repeatOnePlay() {
        await start();
    }

    function startPlayPrevious() {
        openedFiles?.forEach((file, index) => {
            if (file === musicPath) {
                if (index - 1 >= 0) {
                    setMusicPath(() => openedFiles[index - 1]);
                } else {
                    setMusicPath(() => openedFiles[openedFiles.length - 1]);
                }
            }
        });
    }

    function startPlayNext() {
        openedFiles?.forEach((file, index) => {
            if (file === musicPath) {
                if (index + 1 < openedFiles.length) {
                    setMusicPath(() => openedFiles[index + 1]);
                } else {
                    setMusicPath(() => openedFiles[0]);
                }
            }
        });
    }

    let unListened: () => void;
    let unListenedProgress: () => void;
    let unListenedFinished: () => void;
    let unListenedMeta: () => void;
    let unListenedImage: () => void;

    const setupListener = async () => {
        try {
            unListened = await listen<MusicInfo>("music-info", (event) => {
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
                console.log("Received finish event:", event.payload);
                if (event.payload) {
                    setPlay(false);
                    // repeat
                    if (sequenceType === 1) {
                        startPlayNext();
                    // repeat one
                    } else if (sequenceType === 2) {
                        repeatOnePlay();
                    // random
                    } else {
                        if (openedFiles) {
                            const index = Math.floor(Math.random() * openedFiles.length);
                            setMusicPath(() => openedFiles[index]);
                        }
                    }
                }
            });
        } catch (error) {
            console.error("Error setting up listener:", error);
        }
    };

    const setupMetaListener = async () => {
        try {
            unListenedMeta = await listen<MusicMeta>("music-meta", (event) => {
                if (!event.payload.title) return;
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
            setMusicPath(undefined);
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
        if (file === musicPath) {
            if (play) {
                await stop();
            } else {
                await start();
            }
            return;
        }
        setMusicPath(file);
    }

    const changeSeq = () => {
        if (sequenceType === 3) {
            setSequenceType(1);
        } else {
            setSequenceType(sequenceType => sequenceType + 1);
        }
    }

    useEffect(() => {
        async function changeState() {
            if (musicPath) {
                await stop();
                setTimeout(async () => {
                    await start();
                }, 200);
            }
        }
        changeState();
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
                        {openedFiles?.map((file, index) => (
                            <li key={index} className={file === musicPath && play ? 'active' : ''}>
                                <div className="fileName">{file.split('/')[file.split('/').length - 1]}</div>
                                <div className="statusIcon" onClick={() => changeMusic(file)}>
                                    {file === musicPath && play ? <StopIcon/> : <PlayIcon/>}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="play-wrapper">
                    <div className="title-wrapper">
                        <div className="title">{musicMeta?.title}</div>
                        <div className="artist">{musicMeta?.artist}</div>
                        <div className="album">{musicMeta?.album}</div>
                    </div>
                    <div className="img-container">
                        <div className={play ? "img-wrapper rotate" : "img-wrapper"} >
                            {musicImage?.image ? (<img src={musicImage.image} className="logo" alt="music" />) : (<img src={bg} className="logo" alt="music" />)}
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
                        style={{width: `${calculateProgress(music?.progress, music?.duration)}%`}}
                    />
                </div>
                <div className="play-bar-container">
                    <div className="time-container">
                        <div className="time-wrapper">
                            <div className="progress">{music?.progress ? music.progress : '0:00:00.0'}</div>
                            &nbsp;/&nbsp;
                            <div className="duration">{music?.duration ? music.duration : '0:00:00.0'}</div>
                        </div>
                        <div className="seq-wrapper" onClick={changeSeq}>
                            {sequenceType === 1 && <RepeatIcon/>}
                            {sequenceType === 2 && <RepeatOneIcon/>}
                            {sequenceType === 3 && <RandomIcon/>}
                        </div>
                    </div>
                    <div className="btn">
                        <div className="prevous" onClick={() => startPlayPrevious()}>
                            <PreviousIcon/>
                        </div>
                        <div className="play" onClick={playManagement}>
                            {play ? <StopIcon size={60}/> : <PlayIcon size={60}/>}
                        </div>
                        <div className="next" onClick={() => startPlayNext()}>
                            <NextIcon/>
                        </div>
                    </div>
                    <div className="info-wrapper">
                        <div className="short-info">
                            <div>{musicInfo?.codec_short}</div>
                            <div>{musicInfo?.sample_rate && `${musicInfo?.sample_rate}Hz`}</div>
                            <div>{musicInfo?.bits_per_sample && `${musicInfo?.bits_per_sample}bit`}</div>
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
