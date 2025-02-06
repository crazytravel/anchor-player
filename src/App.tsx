import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { fetch } from '@tauri-apps/plugin-http';

import './App.css';
import bg from './assets/bg.png';

import { listen } from '@tauri-apps/api/event';
import { PlayState, MusicFile, MusicInfo, MusicInfoRes, MusicMeta, MusicSetting, MusicError } from './declare.ts';
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
    id,
    playState: music,
    musicInfo,
    musicMeta,
    musicTitle,
    musicArtist,
    musicAlbum,
    musicImage,
    play,
    infoDisplay,
    openedFiles,
    musicList,
    volume,
    previousVolume,
    isMuted,
    sequenceType,
    errors,
    setId,
    setPlayState,
    setMusicInfo,
    setMusicMeta,
    setMusicTitle,
    setMusicArtist,
    setMusicAlbum,
    setMusicImage,
    setPlay,
    setInfoDisplay,
    setOpenedFiles,
    setMusicList,
    setVolume,
    setPreviousVolume,
    setIsMuted,
    setSequencType,
    setErrors
  } = useMusicStore();

  function debounce<T extends (...args: any[]) => Promise<any>>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;
    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        await func.apply(this, args);
      }, wait);
    };
  }

  const fetchMusicInfo = async (keyword: string) => {
    // Send a GET request
    const response = await fetch(`https://itunes.apple.com/cn/search?term=${keyword}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (response.status !== 200) {
      return;
    }
    const resBody: MusicInfoRes = await response.json();
    console.log(resBody);
    if (resBody.resultCount !== 0) {
      // filter kind: song, wrapperType: track, sort releaseDate with desc and trackNumber with asc and get the first one
      const results = resBody.results
        .filter((body) => body.kind.toLowerCase() === 'song' && body.wrapperType.toLowerCase() === 'track')
        .sort((a, b) => {
          return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
        });
      if (results.length === 0) {
        return;
      }
      const result = results[0];
      if (result.artworkUrl100) {
        const url = result.artworkUrl100.replace('100x100', '600x600');
        console.log('url:', url)
        console.log('musicImage:', musicImage)
        if (url !== musicImage) {
          setMusicImage(url);
        }
      }
      setMusicArtist(result.artistName);
      setMusicAlbum(result.collectionName);
      console.log('musicMeta:', musicMeta)
    } else {
      setMusicImage(bg);
      setMusicArtist(undefined);
      setMusicAlbum(undefined);
    }
  }

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
    // split with last '.' and get the first part
    const fullFilename = parts[parts.length - 1];
    const index = fullFilename.lastIndexOf('.');
    const filename = fullFilename.substring(0, index);
    return filename;
  };

  const start = async (id: number) => {
    console.log('start:', id)
    try {
      // setMusicArtist(undefined);
      // setMusicAlbum(undefined);
      // setMusicImage(bg);
      setMusicInfo(undefined);
      // setId(id);
      await invoke('play', { id });
      // setPlay(true);
    } catch (error) {
      console.error('Failed to start playback:', error);
      // setPlay(false);
    }
  };

  async function pause() {
    setPlay(false);
    calculateProgress('0:00:00.0', '0:00:00.0');
    await invoke('pause');
  }

  async function stop() {
    setPlay(false);
    setId(-1);
    setMusicInfo(undefined);
    setMusicMeta(undefined);
    setMusicTitle(undefined);
    setMusicArtist(undefined);
    setMusicAlbum(undefined);
    setPlayState(undefined);
    setMusicImage(bg);
    calculateProgress('0:00:00.0', '0:00:00.0');
    await invoke('pause');
  }

  const finishPlay = async () => {
  };

  async function playControl() {
    console.log('playControl:', play)
    if (play) {
      await pause();
      return;
    }
    if (openedFiles && openedFiles.length > 0) {
      await start(-1);
    }
  }

  const playPrevious = async () => {
    setMusicArtist(undefined);
    setMusicAlbum(undefined);
    await invoke('play_previous', {});
  };

  const playNext = async () => {
    setMusicArtist(undefined);
    setMusicAlbum(undefined);
    await invoke('play_next', {});
  };

  const startPlayPrevious = async () => {
    if (!openedFiles || openedFiles.length <= 0) {
      return;
    }
    setPlay(true);
    setMusicImage(bg);
    await playPrevious();
  }

  const startPlayNext = async () => {
    if (!openedFiles || openedFiles.length <= 0) {
      return;
    }
    setPlay(true);
    setMusicImage(bg);
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

  const initFiles = (files: string[], initialNo: number): MusicFile[] => {
    return files.map((file, index) => {
      return { id: index + initialNo, name: extractMusicName(file), path: file }
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
    if (files) {
      console.log('musicList:', musicList)
      const maxId = musicList.length > 0 ? musicList[musicList.length - 1].id + 1 : 0;
      setOpenedFiles([...openedFiles, ...files]);
      const musicFiles = initFiles(files, maxId);
      console.log('musicFiles:', musicFiles)
      setMusicList([...musicList, ...musicFiles]);
      await invoke('playlist_add', { musicFiles: [...musicList, ...musicFiles] })
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
        const maxId = musicList.length > 0 ? musicList[musicList.length - 1].id + 1 : 0;
        setOpenedFiles([...openedFiles, ...files]);
        const musicFiles = initFiles(files, maxId);
        setMusicList([...musicList, ...musicFiles]);
        await invoke('playlist_add', { musicFiles: [...musicList, ...musicFiles] })
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
    console.log('index:', index)
    const id = musicList[index].id;
    console.log('id:', id)
    await start(id);
  };

  const deleteFromPlayList = async (index: number) => {
    const newFiles = [...openedFiles];
    newFiles.splice(index, 1);
    setOpenedFiles(newFiles);
    const newList = [...musicList];
    const theId = newList[index].id;
    newList.splice(index, 1);
    setMusicList(newList);
    await invoke('delete_from_playlist', { id: theId });
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
    await invoke('play', { id: -1, time: newTime }).catch(console.error);
  }

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
    if (!openedFiles || openedFiles.length === 0) {
      return;
    }
    await stop();
    setOpenedFiles([]);
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
      setId(error.id);
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
      setId(event.payload.id);
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
      await fetchMusicInfo(keyword);
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
      setOpenedFiles(playlist.map((file) => file.path));
      setMusicList(playlist);
    }
    const loadPlayState = async () => {
      const playState = await invoke<PlayState>('load_play_state', {});
      console.log("playState:", playState);
      if (!playState) return;
      setId(playState.id);
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
    if (id === -1) {
      return;
    }
    let index = musicList.findIndex((music) => music.id === id);
    if (itemRefs.current[index]) {
      itemRefs.current[index].scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [id]);

  // const debouncedChangeMusic = debounce(changeMusic, 300);
  // const debouncedSeek = debounce(seek, 300);
  // const debouncedStartPlayPrevious = debounce(startPlayPrevious, 300);
  // const debouncedStartPlayNext = debounce(startPlayNext, 300);
  // const debouncedPlayControl = debounce(playControl, 300);

  return (
    <div className="flex flex-col w-full h-full m-0 p-0 relative">
      <div
        className="absolute inset-0 bg-cover bg-center blur-3xl"
        style={{
          backgroundImage: `url(${musicImage})`,
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
              {openedFiles?.map((file, index) => (
                <li
                  key={index}
                  ref={(el) => (itemRefs.current[index] = el)}
                  className={(musicList[index].id === id && 'text-active') || ''}
                >
                  <div
                    onDoubleClick={() => changeMusic(index)}
                    className="file-name cursor-default"
                  >
                    {file.split('/')[file.split('/').length - 1]}
                  </div>
                  <div className="statusIcon">
                    {(musicList[index].id !== id || !play) && <DeleteIcon onClick={async () => deleteFromPlayList(index)} />}
                    {musicList[index].id === id && play && (
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
                {musicImage ? (
                  <img src={musicImage} className="logo" alt="music" />
                ) : (
                  <img src={bg} className="logo" alt="music" />
                )}
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
