import { create } from 'zustand';
import { SEQUENCE_TYPES } from './constants';
import { PlayState, MusicFile, MusicInfo, MusicMeta, MusicError } from './declare';
import bg from './assets/bg.png';

type MusicStore = {
  activeId?: string
  playState?: PlayState
  musicInfo?: MusicInfo
  musicMeta?: MusicMeta
  musicTitle?: string
  musicArtist?: string
  musicAlbum?: string
  musicImage?: string
  play: boolean
  infoDisplay: boolean
  settingDisplay: boolean
  openedFiles: string[]
  musicList: MusicFile[]
  volume: number
  previousVolume: number
  isMuted: boolean
  sequenceType: number
  errors: MusicError[]

  setActiveId: (activeId?: string) => void
  setPlayState: (playState?: PlayState) => void
  setMusicInfo: (musicInfo?: MusicInfo) => void
  setMusicMeta: (musicMeta?: MusicMeta) => void
  setMusicTitle: (musicTitle?: string) => void
  setMusicArtist: (musicArtist?: string) => void
  setMusicAlbum: (musicAlbum?: string) => void
  setMusicImage: (musicImage?: string) => void
  setPlay: (play: boolean) => void
  setInfoDisplay: (infoDisplay: boolean) => void
  setSettingDisplay: (settingDisplay: boolean) => void
  setOpenedFiles: (openedFiles: string[]) => void
  setMusicList: (musicList: MusicFile[]) => void
  setVolume: (volume: number) => void
  setPreviousVolume: (previousVolume: number) => void
  setIsMuted: (isMuted: boolean) => void
  setSequencType: (sequenceType: number) => void
  setErrors: (errors: MusicError[]) => void
}

export const useMusicStore = create<MusicStore>((set) => ({
  activeId: undefined,
  playState: undefined,
  musicInfo: undefined,
  musicMeta: undefined,
  musicTitle: undefined,
  musicArtist: undefined,
  musicAlbum: undefined,
  musicImage: bg,
  play: false,
  infoDisplay: false,
  settingDisplay: false,
  openedFiles: [],
  musicList: [],
  volume: 1, // 0 - 1
  previousVolume: 1,
  isMuted: false,
  sequenceType: SEQUENCE_TYPES.REPEAT,
  errors: [],

  setActiveId: (activeId?: string) => set(() => {
    return {
      activeId
    }
  }),
  setPlayState: (playState?: PlayState) => set({ playState: playState }),
  setMusicInfo: (musicInfo?: MusicInfo) => set({ musicInfo }),
  setMusicMeta: (musicMeta?: MusicMeta) => set(() => { return { musicMeta } }),
  setMusicTitle: (musicTitle?: string) => set(() => { return { musicTitle } }),
  setMusicArtist: (musicArtist?: string) => set(() => { return { musicArtist } }),
  setMusicAlbum: (musicAlbum?: string) => set(() => { return { musicAlbum } }),
  setMusicImage: (musicImage?: string) => set({ musicImage }),
  setInfoDisplay: (infoDisplay: boolean) => set({ infoDisplay }),
  setSettingDisplay: (settingDisplay: boolean) => set({ settingDisplay }),
  setPlay: (play: boolean) => set(() => {
    return { play };
  }),
  setOpenedFiles: (openedFiles: string[]) => set(() => {
    return { openedFiles };
  }),
  setMusicList: (musicList: MusicFile[]) => set(() => {
    return { musicList };
  }),
  setVolume: (volume: number) => set({ volume }),
  setPreviousVolume: (previousVolume: number) => set({ previousVolume }),
  setIsMuted: (isMuted: boolean) => set({ isMuted }),
  setSequencType: (sequenceType: number) => set(() => {
    return { sequenceType };
  }),
  setErrors: (errors: MusicError[]) => set(() => {
    return { errors };
  })
}));
