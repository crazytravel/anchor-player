import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

import './App.css';
import bg from './assets/bg.png';

import { listen } from '@tauri-apps/api/event';
import { Music, MusicImage, MusicInfo, MusicMeta } from './declare.ts';
import Info from './info';
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
  AlbumIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMuteIcon,
} from './icon';

import { SUPPORTED_FORMATS, SEQUENCE_TYPES } from './constants';
import { useMusicStore } from './store';


function App() {

  const {
    music,
    musicInfo,
    musicMeta,
    musicImage,
    musicPath,
    play,
    infoDisplay,
    manuallyStopped,
    openedFiles,
    playIndex,
    volume,
    previousVolume,
    isMuted,
    sequenceType,
    setMusic,
    setMusicInfo,
    setMusicMeta,
    setMusicImage,
    setMusicPath,
    setPlay,
    setInfoDisplay,
    setManuallyStopped,
    setOpenedFiles,
    setPlayIndex,
    setVolume,
    setPreviousVolume,
    setIsMuted,
    setSequenceType
  } = useMusicStore();
  // Add volume control functions
  const handleVolumeChange = async (newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    await invoke('set_volume', { volume: newVolume });
  };

  const toggleMute = async () => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(previousVolume);
      await invoke('set_volume', { volume: previousVolume });
    } else {
      setIsMuted(true);
      setPreviousVolume(volume);
      setVolume(0);
      await invoke('set_volume', { volume: 0 });
    }
  };

  const extractMusicName = (path: string): string => {
    const parts = path.split('/');
    return parts[parts.length - 1].split('.')[0];
  };

  const start = async () => {
    try {
      if (musicPath) {
        setPlay(true);
        const musicName = extractMusicName(musicPath);
        setMusicMeta({ title: musicName, artist: '', album: '' });
        setMusicImage(undefined);
        setMusicInfo(undefined);
        await invoke('play', { musicPath });
      }
    } catch (error) {
      console.error('Failed to start playback:', error);
      setPlay(false);
    }
  };

  async function stop() {
    setPlay(false);
    calculateProgress('0:00:00.0', '0:00:00.0');
    await invoke('pause');
  }

  async function playManagement() {
    if (!musicPath) {
      if (openedFiles && openedFiles.length > 0) {
        setMusicPath(openedFiles[0]);
        setPlayIndex(0);
      }
      return;
    }
    setMusicImage(undefined);
    setMusicMeta(undefined);
    if (play) {
      setManuallyStopped(true);
      await stop();
      return;
    }
    await start();
  }

  async function repeatOnePlay() {
    if (musicPath) {
      await start();
    }
  }

  function startPlayPrevious() {
    if (!openedFiles) return;
    let newIndex: number;
    if (playIndex === 0) {
      newIndex = openedFiles.length - 1;
    } else {
      newIndex = playIndex - 1;
    }
    setMusicPath(openedFiles[newIndex]);
    setPlayIndex(newIndex);
  }

  function startPlayNext() {
    console.log('下一曲');
    console.log('openedFiles', openedFiles);
    if (!openedFiles) return;
    let newIndex: number;
    if (playIndex === openedFiles.length - 1) {
      newIndex = 0;
    } else {
      newIndex = playIndex + 1;
    }
    console.log('newIndex', newIndex);
    setMusicPath(openedFiles[newIndex]);
    setPlayIndex(newIndex);
  }

  let unListened: () => void;
  let unListenedProgress: () => void;
  let unListenedFinished: () => void;
  let unListenedMeta: () => void;
  let unListenedImage: () => void;

  const setupListener = async () => {
    try {
      unListened = await listen<MusicInfo>('music-info', (event) => {
        // console.log("Received event:", event.payload);
        setMusicInfo(event.payload);
      });
    } catch (error) {
      console.error('Error setting up listener:', error);
    }
  };

  const setupProgressListener = async () => {
    try {
      unListened = await listen<Music>('music', (event) => {
        // console.log("Received event:", event.payload);
        setMusic(event.payload);
        calculateProgress(event.payload.progress, event.payload.duration);
      });
    } catch (error) {
      console.error('Error setting up listener:', error);
    }
  };

  const setupFinishedListener = async () => {
    try {
      unListenedFinished = await listen<boolean>('finished', (event) => {
        if (event.payload) {
          console.log('Finished event triggered');
          console.log('Current openedFiles:', openedFiles);
          console.log('Current playIndex:', playIndex);

          setPlay(false);
          if (manuallyStopped) {
            setManuallyStopped(false);
            return;
          }
          console.log('sequenceType', sequenceType);
          console.log('sequence type enum', SEQUENCE_TYPES.REPEAT);
          console.log(
            'sequenceType equals',
            sequenceType === SEQUENCE_TYPES.REPEAT,
          );
          // repeat
          if (sequenceType === SEQUENCE_TYPES.REPEAT) {
            startPlayNext();
            // repeat one
          } else if (sequenceType === SEQUENCE_TYPES.REPEAT_ONE) {
            repeatOnePlay();
            // random
          } else if (sequenceType === SEQUENCE_TYPES.RANDOM) {
            if (openedFiles) {
              const index = Math.floor(Math.random() * openedFiles.length);
              setMusicPath(openedFiles[index]);
              setPlayIndex(index);
            }
          }
        }
      });
    } catch (error) {
      console.error('Error setting up listener:', error);
    }
  };

  const setupMetaListener = async () => {
    try {
      unListenedMeta = await listen<MusicMeta>('music-meta', (event) => {
        if (!event.payload.title) return;
        setMusicMeta(event.payload);
      });
    } catch (error) {
      console.error('Error setting up listener:', error);
    }
  };

  const setupImageListener = async () => {
    try {
      unListenedImage = await listen<MusicImage>('music-image', (event) => {
        // console.log("Received event:", event.payload);
        setMusicImage(event.payload);
      });
    } catch (error) {
      console.error('Error setting up listener:', error);
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
      filters: [
        {
          extensions: SUPPORTED_FORMATS,
          name: '',
        },
      ],
    });
    console.log(files);
    if (files) {
      setMusicPath(undefined);
      setPlayIndex(0);
      setOpenedFiles([...files]);
    }
  };

  const openFolder = async () => {
    // when using `"withGlobalTauri": true`, you may use
    // const { open } = window.__TAURI__.dialog;

    // Open a dialog
    const paths = await open({
      multiple: true,
      directory: true,
    });
    console.log(paths);
    if (paths) {
      const files = await invoke<string[]>('list_files', { dirs: paths });
      if (files.length > 0) {
        setMusicPath(undefined);
        setPlayIndex(0);
        setOpenedFiles([...files]);
      }
    }
  };

  const changeMusic = async (index: number) => {
    if (!openedFiles) {
      return;
    }
    if (index === playIndex) {
      return;
    }
    setMusicPath(openedFiles[index]);
    setPlayIndex(index);
  };

  const changeSeq = () => {
    if (sequenceType === 3) {
      setSequenceType(1);
    } else {
      setSequenceType(sequenceType + 1);
    }
  };

  const deleteFromPlayList = (index: number) => {
    if (!openedFiles) return openedFiles;
    // Create a new array copy and then splice
    const newFiles = [...openedFiles];
    newFiles.splice(index, 1);
    setOpenedFiles(newFiles);
    setMusicPath(undefined);
  };

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
    };
  }, []);

  return (
    <div className="flex flex-col w-full h-full m-0 p-0">
      <header
        className="h-8 w-full text-center p-2 cursor-default app-name"
        data-tauri-drag-region="true"
      >
        Anchor Player
      </header>
      <main className="h-0 flex-1 flex flex-col p-4">
        <div className="play-container">
          <div className="list-wrapper">
            <div className="toolbar">
              <OpenFileIcon onClick={openFile} />
              <OpenFolderIcon onClick={openFolder} />
            </div>
            <ul className="list">
              {openedFiles?.map((file, index) => (
                <li
                  key={index}
                  className={(play && index === playIndex && 'active') || ''}
                >
                  <div
                    onDoubleClick={() => changeMusic(index)}
                    className="file-name cursor-default"
                  >
                    {file.split('/')[file.split('/').length - 1]}
                  </div>
                  <div
                    className="statusIcon"
                    onClick={() => deleteFromPlayList(index)}
                  >
                    {(playIndex != index || !play) && <DeleteIcon />}
                    {playIndex === index && play && (
                      <span className="rotate">
                        <AlbumIcon />
                      </span>
                    )}
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
              <div className={play ? 'img-wrapper rotate' : 'img-wrapper'}>
                {musicImage?.image ? (
                  <img src={musicImage.image} className="logo" alt="music" />
                ) : (
                  <img src={bg} className="logo" alt="music" />
                )}
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

              const durationSeconds = timeToSeconds(
                music?.duration || '0:00:00.0',
              );
              const newTime = (percentage / 100) * durationSeconds;

              // Invoke your Rust function to seek to the new position
              invoke('seek', { position: newTime }).catch(console.error);
            }}
          >
            <div
              className="progress-bar"
              style={{
                width: `${calculateProgress(music?.progress, music?.duration)}%`,
              }}
            />
          </div>
          <div className="play-bar-container">
            <div className="time-container">
              <div className="time-wrapper">
                <div className="progress">
                  {music?.progress ? music.progress : '0:00:00.0'}
                </div>
                &nbsp;/&nbsp;
                <div className="duration">
                  {music?.duration ? music.duration : '0:00:00.0'}
                </div>
              </div>
              <div className="seq-wrapper" onClick={changeSeq}>
                {sequenceType === SEQUENCE_TYPES.REPEAT && <RepeatIcon />}
                {sequenceType === SEQUENCE_TYPES.REPEAT_ONE && (
                  <RepeatOneIcon />
                )}
                {sequenceType === SEQUENCE_TYPES.RANDOM && <RandomIcon />}
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
                <div>
                  {musicInfo?.sample_rate && `${musicInfo?.sample_rate}Hz`}
                </div>
                <div>
                  {musicInfo?.bits_per_sample &&
                    `${musicInfo?.bits_per_sample}bit`}
                </div>
              </div>
              <div className="volume-control">
                <div className="volume-icon" onClick={toggleMute}>
                  {volume === 0 || isMuted ? (
                    <VolumeMuteIcon />
                  ) : volume < 0.5 ? (
                    <VolumeLowIcon />
                  ) : (
                    <VolumeHighIcon />
                  )}
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  className="volume-slider"
                  onChange={(e) =>
                    handleVolumeChange(parseFloat(e.target.value))
                  }
                />
              </div>
              <div
                className="info"
                onClick={() => setInfoDisplay(!infoDisplay)}
              >
                <InfoIcon />
              </div>
            </div>
          </div>
        </div>
        <Info
          onClick={() => setInfoDisplay(false)}
          musicInfo={musicInfo}
          className={infoDisplay ? 'music-info' : 'music-info hide'}
        />
      </main>
    </div>
  );
}

export default App;
