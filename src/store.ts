import { create } from 'zustand';
import { SEQUENCE_TYPES } from './constants';
import { Music, MusicImage, MusicInfo, MusicMeta } from './declare';

type MusicStore = {
  id: number
  music?: Music
  musicInfo?: MusicInfo
  musicMeta?: MusicMeta
  musicImage?: MusicImage
  play: boolean
  infoDisplay: boolean
  openedFiles: string[]
  volume: number
  previousVolume: number
  isMuted: boolean
  sequenceType: number

  setId: (id: number) => void
  setMusic: (music?: Music) => void
  setMusicInfo: (musicInfo?: MusicInfo) => void
  setMusicMeta: (musicMeta?: MusicMeta) => void
  setMusicImage: (musicImage?: MusicImage) => void
  setPlay: (play: boolean) => void
  setInfoDisplay: (infoDisplay: boolean) => void
  setOpenedFiles: (openedFiles: string[]) => void
  setVolume: (volume: number) => void
  setPreviousVolume: (previousVolume: number) => void
  setIsMuted: (isMuted: boolean) => void
  setSequencType: (sequenceType: number) => void
}

export const useMusicStore = create<MusicStore>((set) => ({
  id: 0,
  music: undefined,
  musicInfo: undefined,
  musicMeta: undefined,
  musicImage: undefined,
  play: false,
  infoDisplay: false,
  openedFiles: [],
  volume: 1, // 0 - 1
  previousVolume: 1,
  isMuted: false,
  sequenceType: SEQUENCE_TYPES.REPEAT,

  setId: (id: number) => set(() => {
    return {
      id
    }
  }),
  setMusic: (music?: Music) => set({ music }),
  setMusicInfo: (musicInfo?: MusicInfo) => set({ musicInfo }),
  setMusicMeta: (musicMeta?: MusicMeta) => set({ musicMeta }),
  setMusicImage: (musicImage?: MusicImage) => set({ musicImage }),
  setInfoDisplay: (infoDisplay: boolean) => set({ infoDisplay }),
  setPlay: (play: boolean) => set(() => {
    return { play };
  }),
  setOpenedFiles: (openedFiles: string[]) => set(() => {
    return { openedFiles };
  }),
  setVolume: (volume: number) => set({ volume }),
  setPreviousVolume: (previousVolume: number) => set({ previousVolume }),
  setIsMuted: (isMuted: boolean) => set({ isMuted }),
  setSequencType: (sequenceType: number) => set(() => {
    return { sequenceType };
  }),
}));
