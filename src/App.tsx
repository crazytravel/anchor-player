import { useEffect, useRef } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { register } from '@tauri-apps/plugin-global-shortcut';
import { open } from '@tauri-apps/plugin-dialog';

import './App.css';
import bg from './assets/bg.png';

import { listen } from '@tauri-apps/api/event';
import { PlayState, MusicFile, MusicInfo, MusicSetting, MusicError } from './declare.ts';
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
  SettingIcon,
} from './icon';

import { SEQUENCE_TYPES, SUPPORTED_FORMATS } from './constants';
import { useMusicStore } from './store';
import Message from './components/message.tsx';
import Setting from './setting.tsx';


function App() {
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const playStateRef = useRef<(string | null)>();
  const volumeRef = useRef<number>(0);
  const {
    activeId,
    playState,
    musicInfo,
    musicTitle,
    musicImage,
    musicArtist,
    musicAlbum,
    play,
    infoDisplay,
    settingDisplay,
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
    setSettingDisplay,
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
    await invoke('pause');
  }


  const finishPlay = async () => {
  };

  async function playControl() {
    console.log("state:", playStateRef.current)
    if (playStateRef.current === 'true') {
      await pause();
      return;
    }
    if (itemRefs.current && itemRefs.current.length > 0) {
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
    if (!itemRefs.current || itemRefs.current.length <= 0) {
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
    if (!itemRefs.current || itemRefs.current.length <= 0) {
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
    if (!playState || !playState?.left_duration) {
      return;
    }

    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    const progressSeconds = timeToSeconds(
      playState?.progress || '0:00:00.0',
    );
    const leftDurationSeconds = timeToSeconds(
      playState?.left_duration || '0:00:00.0',
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

  const addPlaylist = async (files: string[]) => {
    const musics = await invoke<MusicFile[]>('playlist_add', { files })
    console.log('musics:', musics)
    await initPlaylist();
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
    await register(['CommandOrControl+F8', 'MediaPlayPause'], async (event) => {
      if (event.state === "Pressed") {
        console.log('play-pause')
        await playControl();
      }
    });
    await register(['CommandOrControl+F7', 'MediaTrackPrevious'], async (event) => {
      if (event.state === "Pressed") {
        console.log('previos')
        await startPlayPrevious();
      }
    });
    await register(['CommandOrControl+F9', 'MediaTrackNext'], async (event) => {
      if (event.state === "Pressed") {
        console.log('next')
        await startPlayNext();
      }
    });
    await register(['CommandOrControl+F10'], async (event) => {
      if (event.state === "Pressed") {
        await handleVolumeChange(0)
      }
    });
    await register(['CommandOrControl+F11'], async (event) => {
      if (event.state === "Pressed") {
        let changedVolume = volumeRef.current - 0.1;
        if (changedVolume < 0) {
          changedVolume = 0;
        }
        if (changedVolume > 1) {
          changedVolume = 1;
        }
        setVolume(changedVolume);
        await handleVolumeChange(changedVolume);
      }
    });
    await register(['CommandOrControl+F12'], async (event) => {
      if (event.state === "Pressed") {
        let changedVolume = volumeRef.current + 0.1;
        if (changedVolume < 0) {
          changedVolume = 0;
        }
        if (changedVolume > 1) {
          changedVolume = 1;
        }
        setVolume(changedVolume);
        await handleVolumeChange(changedVolume);
      }
    });
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
    setMusicList([]);
    await invoke('clear_playlist', {});
  }


  const initPlaylist = async () => {
    const playlist = await invoke<MusicFile[]>('init_playlist', {});
    console.log('playlist:', playlist)
    setMusicList(playlist);
  }

  const loadPlaylist = async () => {
    const playlist = await invoke<MusicFile[]>('load_playlist', {});
    console.log('playlist:', playlist)
    setMusicList(playlist);
  }

  useEffect(() => {

    const unMusicDataCompletionListen = listen<MusicFile>('music_data_completion', async (event) => {
      console.log('event from music_data_completion: ', event)
      // let music = event.payload;
      await loadPlaylist();
    });

    const unPauseActionListen = listen('paused-action', async (event) => {
      console.log('event from paused-action: ', event)
      await invoke('pause_action', { pauseState: event.payload })
    });

    const unErrorListen = listen<MusicError>('error', (event) => {
      const error = event.payload;
      setActiveId(error.id);
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
    });

    const unFinishedListen = listen<number>('finished', async (event) => {
      console.log('event from finished:', event.payload)
      // setMusicImage(bg);
      await finishPlay();
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
      // setMusicTitle(playState.name);
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
    initPlaylist();
    loadPlayState();

    return () => {
      unMusicDataCompletionListen.then(f => f());
      unPauseActionListen.then(f => f());
      unMusicInfoListen.then(f => f());
      unMusicListen.then(f => f());
      unFinishedListen.then(f => f());
      // unListenedMeta.then(f => f());
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

    const music = musicList.find(music => music.id === activeId)
    if (!music) return

    if (music.imagePath) {
      const assetUrl = convertFileSrc(music.imagePath)
      setMusicImage(assetUrl)
    } else {
      setMusicImage(bg)
    }

    setMusicImage(music.imagePath ? convertFileSrc(music.imagePath) : bg)
    setMusicTitle(music.name || '')
    setMusicArtist(music.artist || '')
    setMusicAlbum(music.album || '')
  }, [activeId, musicList]);

  useEffect(() => {
    if (!activeId) {
      return;
    }
    console.log("activeId", activeId)
    setTimeout(() => {
      let index = musicList.findIndex((music) => music.id === activeId);
      if (itemRefs.current[index]) {
        console.log("scrollIntoView")
        itemRefs.current[index].scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 500)
  }, [activeId])

  return (
    <div className="flex flex-col w-full h-full m-0 p-0 relative">
      <div
        className="absolute w-full h-full z-0 inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${musicImage})`,
          filter: 'blur(1.3em)',
        }}
      ></div>
      <header
        className="relative z-10 h-8 w-full text-center p-2 cursor-default app-name"
        data-tauri-drag-region="true"
      />
      <main className="relative z-10 h-0 flex-1 flex flex-col px-4 pb-4">
        <div className='absolute right-4 top-0 z-10'>
          <SettingIcon onClick={() => setSettingDisplay(true)} />
        </div>
        <div className="play-container">
          <div className="list-wrapper">
            <div className='flex items-center pb-2'>
              <img src={bg} className='w-10 h-10' />
              <div className='mx-3'>
                <div className='font-bold '>
                  Anchor Player
                </div>
                <div className='text-xs'>Lossless Music Player</div>
              </div>
            </div>
            <div className="toolbar">
              <div className='flex'>

                <OpenFolderIcon onClick={openFolder} />
                <div className="w-3" />
                <OpenFileIcon onClick={openFile} />
              </div>
              <div className='flex'>
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
                    className="cursor-default flex items-center w-full"
                  >
                    <div><img src={music.imagePath ? convertFileSrc(music.imagePath) : bg} className={`w-10 h-10 p-0.5 bg-panel rounded-full ${play && activeId === music.id && "rotate"}`} /></div>
                    <div className='flex-1 ml-2 w-0 truncate'>{music.name}</div>
                  </div>
                  <div className="statusIcon">
                    {(music.id !== activeId || !play) && <DeleteIcon onClick={async () => deleteFromPlayList(index)} />}
                    {music.id === activeId && play && (
                      <AlbumIcon onClick={() => setInfoDisplay(true)} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="play-wrapper">
            <div className="title-wrapper">
              <div className="title truncate">{musicTitle}</div>
              <div className="p-2 truncate">{musicArtist}</div>
              <div className='truncate'>{musicAlbum}</div>
            </div>
            <div className="img-container">
              <div className={play ? 'img-wrapper rotate' : 'img-wrapper'} data-play={play} ref={(el) => (playStateRef.current = el?.dataset.play)}>
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
                width: `${calculateProgress(playState?.progress, playState?.left_duration)}% `,
              }}
            />
          </div>
          <div className="play-bar-container">
            <div className="time-container">
              <div className="time-wrapper">
                <div className="progress">
                  {playState?.progress ? formatTime(playState.progress) : '0:00:00'}
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
                  ref={(el) => volumeRef.current = el ? parseFloat(el.value) : 0}
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
            onClose={() => setInfoDisplay(false)}
            musicInfo={musicInfo}
          />
        }
        {
          settingDisplay && <Setting onClose={() => setSettingDisplay(false)} onClearCache={initPlaylist} />
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
