import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from '@tauri-apps/plugin-dialog';

import "./App.css";
import bg from './assets/bg.png';

import { listen } from "@tauri-apps/api/event";
import { Music, MusicImage, MusicInfo, MusicMeta } from "./declare.ts";
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
  StopIcon,
  DeleteIcon,
} from "./icon";

const SEQUENCE_TYPES = {
  REPEAT: 1,
  REPEAT_ONE: 2,
  RANDOM: 3,
} as const;

const SUPPORTED_FORMATS = ['flac', 'mp3', 'wav', 'aac', 'ogg', 'riff', 'mkv', 'caf', 'isomp4'];

function App() {
  const [musicInfo, setMusicInfo] = useState<MusicInfo>();
  const [music, setMusic] = useState<Music>();
  const [play, setPlay] = useState(false);
  const [infoDisplay, setInfoDisplay] = useState(false);
  const [musicMeta, setMusicMeta] = useState<MusicMeta>();
  const [musicImage, setMusicImage] = useState<MusicImage>();
  const [openedFiles, setOpenedFiles] = useState<string[]>();
  const [musicPath, setMusicPath] = useState<string>();
  const [sequenceType, setSequenceType] = useState<number>(SEQUENCE_TYPES.REPEAT.valueOf());    // 1: repeat, 2: repeat one, 3: random
  const [playIndex, setPlayIndex] = useState<number>(-1);

  const extractMusicName = (path: string): string => {
    const parts = path.split('/');
    return parts[parts.length - 1].split('.')[0];
  };

  const start = async () => {
    try {
      setPlay(true);
      if (musicPath) {
        const musicName = extractMusicName(musicPath);
        setMusicMeta({ title: musicName, artist: '', album: '' });
      }
      setMusicImage(undefined);
      setMusicInfo(undefined);
      await invoke('play', { musicPath });
    } catch (error) {
      console.error('Failed to start playback:', error);
      setPlay(false);
    }
  };

  async function stop() {
    setPlay(() => false);
    calculateProgress("0:00:00.0", "0:00:00.0");
    await invoke('pause');
  }

  async function playManagement() {
    if (!musicPath) {
      if (openedFiles && openedFiles.length > 0) {
        setMusicPath(() => openedFiles[0]);
        setPlayIndex(0);
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
    if (!openedFiles || playIndex <= 0) return;
    const newIndex = playIndex - 1;
    setMusicPath(openedFiles[newIndex]);
    setPlayIndex(newIndex);
  }

  function startPlayNext() {
    if (!openedFiles) return;
    if (playIndex === openedFiles.length - 1) return;
    setMusicPath(openedFiles[playIndex + 1]);
    setPlayIndex(playIndex + 1);
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
              setPlayIndex(index);
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
        extensions: SUPPORTED_FORMATS,
        name: ""
      }]
    });
    console.log(files);
    if (files) {
      setMusicPath(undefined);
      setPlayIndex(-1);
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

  const changeMusic = async (index: number) => {
    if (!openedFiles) {
      return;
    }
    if (index === playIndex) {
      return;
    }
    setMusicPath(openedFiles[index]);
    setPlayIndex(index);
  }

  const changeSeq = () => {
    if (sequenceType === 3) {
      setSequenceType(1);
    } else {
      setSequenceType(sequenceType => sequenceType + 1);
    }
  }

  const deleteFromPlayList = (index: number) => {
    setOpenedFiles((files) => {
      if (!files) return files;
      // Create a new array copy and then splice
      const newFiles = [...files];
      newFiles.splice(index, 1);
      return newFiles;
    });
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
    <div className="flex flex-col w-full h-full m-0 p-0">
      <header className="h-8 w-full text-center p-2 cursor-default app-name" data-tauri-drag-region="true">Anchor
        Player
      </header>
      <main className="flex-1 flex flex-col p-4">
        <div className="play-container">
          <div className="list-wrapper">
            <div className="toolbar">
              <OpenFileIcon onClick={openFile} />
              <OpenFolderIcon onClick={openFolder} />
            </div>
            <ul className="list">
              {openedFiles?.map((file, index) => (
                <li key={index} className={file === musicPath && play ? 'active' : ''}
                  onDoubleClick={() => changeMusic(index)}>
                  <div
                    className="fileName cursor-default">{file.split('/')[file.split('/').length - 1]}</div>
                  <div className="statusIcon" onClick={() => deleteFromPlayList(index)}>
                    {(playIndex != index || !play) && <DeleteIcon />}
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
              <div className={play ? "img-wrapper rotate" : "img-wrapper"}>
                {musicImage?.image ? (<img src={musicImage.image} className="logo" alt="music" />) : (
                  <img src={bg} className="logo" alt="music" />)}
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
              invoke("seek", { position: newTime }).catch(console.error);
            }}
          >
            <div
              className="progress-bar"
              style={{ width: `${calculateProgress(music?.progress, music?.duration)}%` }}
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
                {sequenceType === 1 && <RepeatIcon />}
                {sequenceType === 2 && <RepeatOneIcon />}
                {sequenceType === 3 && <RandomIcon />}
              </div>
            </div>
            <div className="btn">
              <div className="previous" onClick={() => startPlayPrevious()}>
                <PreviousIcon />
              </div>
              <div className="play" onClick={playManagement}>
                {play ? <StopIcon size={60} /> : <PlayIcon size={60} />}
              </div>
              <div className="next" onClick={() => startPlayNext()}>
                <NextIcon />
              </div>
            </div>
            <div className="info-wrapper">
              <div className="short-info">
                <div>{musicInfo?.codec_short}</div>
                <div>{musicInfo?.sample_rate && `${musicInfo?.sample_rate}Hz`}</div>
                <div>{musicInfo?.bits_per_sample && `${musicInfo?.bits_per_sample}bit`}</div>
              </div>
              <div className="info" onClick={() => setInfoDisplay(!infoDisplay)}>
                <InfoIcon />
              </div>
            </div>
          </div>
        </div>
        <Info onClick={() => setInfoDisplay(false)} musicInfo={musicInfo}
          className={infoDisplay ? "music-info" : "music-info hide"} />
      </main>
    </div>
  );
}

export default App;
