import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

import './App.css';
import bg from './assets/bg.png';

import { listen } from '@tauri-apps/api/event';
import { Music, MusicFile, MusicImage, MusicInfo, MusicMeta } from './declare.ts';
import Info from './info';
import {
  AlbumIcon,
  DeleteIcon,
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
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMuteIcon,
} from './icon';

import { SEQUENCE_TYPES, SUPPORTED_FORMATS } from './constants';
import { useMusicStore } from './store';


function App() {

  const {
    id,
    music,
    musicInfo,
    musicMeta,
    musicImage,
    play,
    infoDisplay,
    openedFiles,
    volume,
    previousVolume,
    isMuted,
    sequenceType,
    setId,
    setMusic,
    setMusicInfo,
    setMusicMeta,
    setMusicImage,
    setPlay,
    setInfoDisplay,
    setOpenedFiles,
    setVolume,
    setPreviousVolume,
    setIsMuted,
    setSequencType,
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

  const start = async (id: number) => {
    try {
      setPlay(true);
      setMusicImage(undefined);
      setMusicInfo(undefined);
      setId(id);
      await invoke('play', { id });
    } catch (error) {
      console.error('Failed to start playback:', error);
      setPlay(false);
    }
  };

  async function stop() {
    setPlay(false);
    setId(-1);
    calculateProgress('0:00:00.0', '0:00:00.0');
    await invoke('pause');
  }

  const finishPlay = async () => {
  };

  async function playControl() {
    if (play) {
      await stop();
      return;
    }
    if (openedFiles && openedFiles.length > 0) {
      await start(-1);
    }
  }

  const playPrevious = async () => {
    await invoke('play_prevois', {});
  };

  const playNext = async () => {
    await invoke('play_next', {});
  };

  const startPlayPrevious = async () => {
    if (!openedFiles || openedFiles.length <= 0) {
      return;
    }
    setPlay(true);
    setMusicImage(undefined);
    await playPrevious();
  }

  const startPlayNext = async () => {
    if (!openedFiles || openedFiles.length <= 0) {
      return;
    }
    setPlay(true);
    setMusicImage(undefined);
    await playNext();
  }

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

  const initFiles = (files: string[]): MusicFile[] => {
    return files.map((file, index) => {
      return { id: index, name: extractMusicName(file), path: file }
    })
  }

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
      setOpenedFiles([...files]);
      const musicFiles = initFiles(files);
      console.log('music files:', musicFiles);
      await invoke('set_music_files', { musicFiles: musicFiles })
    }
  };

  const openFolder = async () => {
    const paths = await open({
      multiple: true,
      directory: true,
    });
    console.log(paths);
    if (paths) {
      const files = await invoke<string[]>('list_files', { dirs: paths });
      if (files.length > 0) {
        setOpenedFiles([...files]);
        const musicFiles = initFiles(files);
        await invoke('set_music_files', { musicFiles: musicFiles })
      }
    }
  };

  const changeSequenceType = async () => {
    if (sequenceType === SEQUENCE_TYPES.REPEAT) {
      setSequencType(SEQUENCE_TYPES.REPEAT_ONE);
      await invoke('change_sequence_type', { sequenceType: SEQUENCE_TYPES.REPEAT_ONE });
      return;
    }
    if (sequenceType === SEQUENCE_TYPES.REPEAT_ONE) {
      setSequencType(SEQUENCE_TYPES.RANDOM);
      await invoke('change_sequence_type', { sequenceType: SEQUENCE_TYPES.RANDOM });
      return;
    }
    if (sequenceType === SEQUENCE_TYPES.RANDOM) {
      setSequencType(SEQUENCE_TYPES.REPEAT);
      await invoke('change_sequence_type', { sequenceType: SEQUENCE_TYPES.REPEAT });
      return;
    }
  }

  const changeMusic = async (index: number) => {
    if (!openedFiles || openedFiles.length === 0) {
      return;
    }
    await start(index);
  };

  const deleteFromPlayList = async (index: number) => {
    const newFiles = [...openedFiles];
    newFiles.splice(index, 1);
    setOpenedFiles(newFiles);
    await invoke('delete_from_playlist', { id: index });
  };

  const formatTime = (time: string): string => {
    return time.split('.')[0];
  };

  useEffect(() => {
    const unMusicInfoListen = listen<MusicInfo>('music-info', (event) => {
      setMusicInfo(event.payload);
    });

    const unMusicListen = listen<Music>('music', (event) => {
      setId(event.payload.id);
      setMusic(event.payload);
      calculateProgress(event.payload.progress, event.payload.duration);
    });

    const unFinishedListen = listen<number>('finished', async (event) => {
      console.log('event from finished:', event.payload)
      setMusicImage(undefined);
      await finishPlay();
    });

    const unListenedMeta = listen<MusicMeta>('music-meta', (event) => {
      if (!event.payload.title) return;
      setMusicMeta(event.payload);
    });

    const unListenedImage = listen<MusicImage>('music-image', (event) => {
      // console.log("Received event:", event.payload);
      setMusicImage(event.payload);
    });
    return () => {
      unMusicInfoListen.then(f => f());
      unMusicListen.then(f => f());
      unFinishedListen.then(f => f());
      unListenedMeta.then(f => f());
      unListenedImage.then(f => f());
    }
  }, []);

  return (
    <div className="flex flex-col w-full h-full m-0 p-0">
      <header
        className="h-8 w-full text-center p-2 cursor-default app-name"
        data-tauri-drag-region="true"
      >
        Anchor Player - HiFi Music Player
      </header>
      <main className="h-0 flex-1 flex flex-col p-4">
        <div className="play-container">
          <div className="list-wrapper">
            <div className="toolbar">
              <OpenFileIcon onClick={openFile} />
              <div className="w-3" />
              <OpenFolderIcon onClick={openFolder} />
            </div>
            <ul className="list">
              {openedFiles?.map((file, index) => (
                <li
                  key={index}
                  className={(play && index === id && 'active') || ''}
                >
                  <div
                    onDoubleClick={() => changeMusic(index)}
                    className="file-name cursor-default"
                  >
                    {file.split('/')[file.split('/').length - 1]}
                  </div>
                  <div
                    className="statusIcon"
                    onClick={async () => deleteFromPlayList(index)}
                  >
                    {(id != index || !play) && <DeleteIcon />}
                    {id === index && play && (
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
            <div className="short-info">
              <div>{musicInfo?.codec_short}</div>
              <div>
                {musicInfo?.sample_rate && `${parseInt(musicInfo?.sample_rate) / 1000}kHz`}
              </div>
              <div>
                {musicInfo?.bits_per_sample &&
                  `${musicInfo?.bits_per_sample}bit`}
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
                  {music?.progress ? formatTime(music.progress) : '0:00:00'}
                </div>
                &nbsp;/&nbsp;
                <div className="duration">
                  {music?.duration ? formatTime(music.duration) : '0:00:00'}
                </div>
              </div>
              <div className="seq-wrapper" onClick={changeSequenceType}>
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
              <div className="play" onClick={playControl}>
                {play ? <StopIcon size={60} /> : <PlayIcon size={60} />}
              </div>
              <div className="next" onClick={() => startPlayNext()}>
                <NextIcon />
              </div>
            </div>
            <div className="info-wrapper">
              <div className="volume-control">
                <div className="icon" onClick={toggleMute}>
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
              <div className="info"
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
          className={infoDisplay ? 'music-info bg-quinary' : 'music-info bg-quinary hide'}
        />
      </main >
    </div >
  );
}

export default App;
