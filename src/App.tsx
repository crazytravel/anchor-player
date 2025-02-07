import { useEffect, useRef } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

import './App.css';
import bg from './assets/bg.png';

import { listen } from '@tauri-apps/api/event';
import { PlayState, MusicFile, MusicInfo, MusicMeta, MusicSetting, MusicError } from './declare.ts';
import Info from './info';
import {
  AlbumIcon,
  DeleteIcon,
  ClearAllIcon,
  InfoIcon,
  NextIcon,
  OpenFileIcon,
  OpenFolderIcon,
  PlayIcon,
  PreviousIcon,
  RandomIcon,
  RepeatIcon,
  RepeatOneIcon,
  PauseIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMuteIcon,
} from './icon';

import { SEQUENCE_TYPES, SUPPORTED_FORMATS } from './constants';
import { useMusicStore } from './store';
import { Message } from './components.tsx';


function App() {
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const {
    activeId,
    playState: music,
    musicInfo,
    musicTitle,
    musicArtist,
    musicAlbum,
    play,
    infoDisplay,
    musicList,
    volume,
    previousVolume,
    isMuted,
    sequenceType,
    errors,
    setActiveId,
    setPlayState,
    setMusicInfo,
    setMusicMeta,
    setMusicTitle,
    setMusicArtist,
    setMusicAlbum,
    setMusicImage,
    setPlay,
    setInfoDisplay,
    setMusicList,
    setVolume,
    setPreviousVolume,
    setIsMuted,
    setSequencType,
    setErrors
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

  async function pause() {
    setPlay(false);
    calculateProgress('0:00:00.0', '0:00:00.0');
    await invoke('pause');
  }


  const finishPlay = async () => {
  };

  async function playControl() {
    if (play) {
      await pause();
      return;
    }
    if (musicList && musicList.length > 0) {
      console.log('hello:', musicList)
      try {
        setMusicInfo(undefined);
        await invoke('play', {});
      } catch (e) {
        console.error('Failed to play:', e)
        const error = e as MusicError;
        setErrors([...errors, error])
      }
    }
  }

  const startPlayPrevious = async () => {
    if (!musicList || musicList.length <= 0) {
      return;
    }
    setPlay(true);
    setMusicArtist(undefined);
    setMusicAlbum(undefined);
    try {
      await invoke('play_previous', {});
    } catch (e) {
      console.error('Failed to play previous one:', e)
      const error = e as MusicError;
      setErrors([...errors, error])
    }
  }

  const startPlayNext = async () => {
    if (!musicList || musicList.length <= 0) {
      return;
    }
    setPlay(true);
    setMusicArtist(undefined);
    setMusicAlbum(undefined);
    try {
      await invoke('play_next', {});
    } catch (e) {
      console.error('Failed to play next one:', e)
      const error = e as MusicError;
      setErrors([...errors, error])
    }
  }


  const switchMusic = async (index: number) => {
    if (!musicList || musicList.length === 0) {
      return;
    }
    console.log('index:', index)
    const id = musicList[index].id;
    console.log('id:', id)
    try {
      await invoke('switch', { id });
    } catch (e) {
      console.error('Failed to switch:', e)
      const error = e as MusicError;
      setErrors([...errors, error])
    }
  };

  const seek = async (rect: DOMRect, clientX: number) => {
    if (!music || !music?.left_duration) {
      return;
    }

    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    const progressSeconds = timeToSeconds(
      music?.progress || '0:00:00.0',
    );
    const leftDurationSeconds = timeToSeconds(
      music?.left_duration || '0:00:00.0',
    );
    setPlay(true);
    const newTime = (percentage / 100) * (progressSeconds + leftDurationSeconds);
    try {
      await invoke('seek', { time: newTime })
    } catch (e) {
      console.error('Failed to seek:', e)
      const error = e as MusicError;
      setErrors([...errors, error])
    }
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

  const calculateProgress = (progress?: string, left_duration?: string): number => {
    if (!progress || !left_duration) return 0;

    // Convert time string to seconds
    const progressSeconds = timeToSeconds(progress);
    const leftDurationSeconds = timeToSeconds(left_duration);

    if (leftDurationSeconds === 0) return 0;
    return (progressSeconds / (progressSeconds + leftDurationSeconds)) * 100;
  };

  const calDuration = (progress?: string, left_duration?: string): string => {
    if (!progress || !left_duration) return '0:00:00';
    const progressSeconds = timeToSeconds(progress);
    const leftDurationSeconds = timeToSeconds(left_duration);
    const duration = progressSeconds + leftDurationSeconds;
    return formatSeconds(duration);
  }

  const formatSeconds = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(secs).padStart(2, '0');

    return `${hours}:${formattedMinutes}:${formattedSeconds}`;
  }

  // const initFiles = async (mFiles: MusicFile[]) => {
  //   const musicFiles: MusicFile[] = [];
  //   for (const file of mFiles) {
  //     const name = file.name;
  //     const path = await invoke<string>('get_image_path', { name });
  //     // Convert to URL that can be used in frontend
  //     const imagePath = convertFileSrc(path);
  //     file.imagePath = imagePath
  //     musicFiles.push(file);
  //   }
  //   return musicFiles;
  // }

  const addPlaylist = async (files: string[]) => {
    const musics = await invoke<MusicFile[]>('playlist_add', { files })
    console.log('musics:', musics)
    setMusicList(musics);
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
    if (files) {
      await addPlaylist(files)
    }
  };

  const openFolder = async () => {
    const paths = await open({
      multiple: true,
      directory: true,
    });
    if (paths) {
      const files = await invoke<string[]>('list_files', { dirs: paths });
      if (files.length > 0) {
        await addPlaylist(files)
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

  const deleteFromPlayList = async (index: number) => {
    const newList = [...musicList];
    const theId = newList[index].id;
    newList.splice(index, 1);
    setMusicList(newList);
    await invoke('delete_from_playlist', { id: theId });
  };


  const formatTime = (time: string): string => {
    return time.split('.')[0];
  };

  const registerShortcuts = async () => {
    // await register(['CommandOrControl+ARROWLEFT', 'CommandOrControl+ARROWRIGHT', 'SPACE'], (event) => {
    //   if (event.state === "Pressed") {
    //     if (event.shortcut === 'CommandOrControl+ARROWLEFT') {
    //       startPlayPrevious();
    //     } else if (event.shortcut === 'CommandOrControl+ARROWRIGHT') {
    //       startPlayNext();
    //     } else if (event.shortcut === 'SPACE') {
    //       playControl();
    //     }
    //   }
    // });
  }

  const clearList = async () => {
    if (!musicList || musicList.length === 0) {
      return;
    }
    setPlay(false);
    setActiveId(undefined);
    setMusicInfo(undefined);
    setMusicMeta(undefined);
    setMusicTitle(undefined);
    setMusicArtist(undefined);
    setMusicAlbum(undefined);
    setPlayState(undefined);
    setMusicImage(bg);
    calculateProgress('0:00:00.0', '0:00:00.0');
    setMusicList([]);
    await invoke('clear_playlist', {});
  }

  useEffect(() => {

    const unPauseActionListen = listen('paused-action', async (event) => {
      console.log('event from paused-action: ', event)
      await invoke('pause_action', { pauseState: event.payload })
    });

    const unErrorListen = listen<MusicError>('error', (event) => {
      const error = event.payload;
      setActiveId(error.id);
      setMusicTitle(error.name);
      setPlay(false);
      setMusicInfo(undefined);
      setMusicMeta(undefined);
      setMusicTitle(undefined);
      setMusicArtist(undefined);
      setMusicAlbum(undefined);
      setErrors([...errors, error]);
    });

    const unMusicInfoListen = listen<MusicInfo>('music-info', (event) => {
      setPlay(true);
      setMusicInfo(event.payload);
    });

    const unMusicListen = listen<PlayState>('play-state', (event) => {
      setActiveId(event.payload.id);
      setPlayState(event.payload);
      calculateProgress(event.payload.progress, event.payload.left_duration);
    });

    const unFinishedListen = listen<number>('finished', async (event) => {
      console.log('event from finished:', event.payload)
      // setMusicImage(bg);
      await finishPlay();
    });

    const unListenedMeta = listen<MusicMeta>('music-meta', async (event) => {
      console.log('event from music-meta:', event.payload)
      if (!event.payload.title) return;
      setMusicTitle(event.payload.title);
      setMusicMeta(event.payload);
      if (event.payload.artist) {
        setMusicArtist(event.payload.artist);
      }
      if (event.payload.album) {
        setMusicAlbum(event.payload.album);
      }
      let keyword = event.payload.title;
      if (event.payload.album) {
        keyword = event.payload.album + '+' + keyword;
      }
      if (event.payload.artist) {
        keyword = event.payload.artist + '+' + keyword;
      }
      // await fetchMusicInfo(keyword);
    });

    // const unListenedImage = listen<string>('music-image', (event) => {
    //   // console.log("Received event:", event.payload);
    //   setMusicImage(event.payload);
    // });

    const showWindow = async () => {
      await invoke('show_main_window', {});
    }

    const loadSettings = async () => {
      const settings = await invoke<MusicSetting>('load_settings', {});
      console.log('settings:', settings);
      setVolume(settings.volume);
      console.log('settings.sequenceType:', settings.sequence_type)
      setSequencType(settings.sequence_type)
    }
    const loadPlaylist = async () => {
      const playlist = await invoke<MusicFile[]>('load_playlist', {});
      console.log('playlist:', playlist)
      setMusicList(playlist);
    }
    const loadPlayState = async () => {
      const playState = await invoke<PlayState>('load_play_state', {});
      console.log("playState:", playState);
      if (!playState) return;
      setActiveId(playState.id);
      setPlayState(playState);
      let musicInfo: MusicInfo = {
        duration: calDuration(playState.progress, playState.left_duration)
      }
      setMusicInfo(musicInfo);
      setMusicTitle(playState.name);
    }

    showWindow();
    registerShortcuts();
    // Production environment, cancel right-click menu
    if (!import.meta.env.DEV) {
      document.oncontextmenu = (event) => {
        event.preventDefault()
      }
    }
    loadSettings();
    loadPlaylist();
    loadPlayState();

    return () => {
      unPauseActionListen.then(f => f());
      unMusicInfoListen.then(f => f());
      unMusicListen.then(f => f());
      unFinishedListen.then(f => f());
      unListenedMeta.then(f => f());
      // unListenedImage.then(f => f());
      unErrorListen.then(f => f());
    }
  }, []);

  useEffect(() => {
    // Clear errors after 5 seconds
    errors.forEach((_error, index) => {
      setTimeout(() => {
        errors.pop()
        setErrors([...errors])
      }, (index + 1) * 5000)
    })
  }, [errors]);

  useEffect(() => {
    if (!activeId) {
      return;
    }
    let index = musicList.findIndex((music) => music.id === activeId);
    if (itemRefs.current[index]) {
      itemRefs.current[index].scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeId]);


  return (
    <div className="flex flex-col w-full h-full m-0 p-0 relative">
      <div
        className="absolute inset-0 bg-cover bg-center blur-3xl"
        style={{
          backgroundImage: `url(${musicList.find(music => music.id == activeId)?.imagePath
            ? convertFileSrc(musicList.find(music => music.id == activeId)?.imagePath!)
            : bg})`,
        }}
      ></div>
      <header
        className="relative z-10 h-8 w-full text-center p-2 cursor-default app-name"
        data-tauri-drag-region="true"
      >
        Anchor Player - Lossless Music Player
      </header>
      <main className="relative z-10 h-0 flex-1 flex flex-col p-4">
        <div className="play-container">
          <div className="list-wrapper">
            <div className="toolbar">
              <div className='flex'>
                <OpenFolderIcon onClick={openFolder} />
                <div className="w-3" />
                <OpenFileIcon onClick={openFile} />
              </div>
              <div>
                <ClearAllIcon onClick={clearList} />
              </div>
            </div>
            <ul className="list">
              {musicList?.map((music, index) => (
                <li
                  key={index}
                  ref={(el) => (itemRefs.current[index] = el)}
                  className={(music.id === activeId && 'text-active') || ''}
                >
                  <div
                    onDoubleClick={() => switchMusic(index)}
                    className="file-name cursor-default"
                  >
                    {music.name}
                  </div>
                  <div className="statusIcon">
                    {(music.id !== activeId || !play) && <DeleteIcon onClick={async () => deleteFromPlayList(index)} />}
                    {music.id === activeId && play && (
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
              <div className="title">{musicTitle}</div>
              <div className="p-2">{musicArtist}</div>
              <div>{musicAlbum}</div>
            </div>
            <div className="img-container">
              <div className={play ? 'img-wrapper rotate' : 'img-wrapper'}>
                <img src={musicList.find(music => music.id == activeId)?.imagePath
                  ? convertFileSrc(musicList.find(music => music.id == activeId)?.imagePath!)
                  : bg} className="logo" alt="music" />
              </div>
            </div>
            <div className="short-info">
              <div>{musicInfo?.codec_short}</div>
              <div>
                {musicInfo?.sample_rate && `${parseInt(musicInfo?.sample_rate) / 1000} kHz`}
              </div>
              <div>
                {musicInfo?.bits_per_sample &&
                  `${musicInfo?.bits_per_sample} bit`}
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
              seek(rect, e.clientX)
            }}
          >
            <div
              className="progress-bar"
              style={{
                width: `${calculateProgress(music?.progress, music?.left_duration)}% `,
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
                  {musicInfo?.duration ? formatTime(musicInfo?.duration) : '0:00:00'}
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
              <div className="previous" onClick={startPlayPrevious}>
                <PreviousIcon />
              </div>
              <div className="play" onClick={playControl}>
                {play ? <PauseIcon size={50} /> : <PlayIcon size={50} />}
              </div>
              <div className="next" onClick={startPlayNext}>
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
        {
          infoDisplay && <Info
            onClick={() => setInfoDisplay(false)}
            musicInfo={musicInfo}
            className="music-info bg-panel"
          />
        }

        <div className='absolute z-10 right-0 top-0'>
          {
            errors.map((error, index) => (
              <Message key={index} message={error} onClose={() => {
                setErrors([...errors.slice(0, index), ...errors.slice(index + 1)])
              }} />
            ))
          }
        </div>
      </main >
    </div >
  );
}

export default App;
