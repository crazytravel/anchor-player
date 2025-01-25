import { create } from "zustand";
import { SEQUENCE_TYPES } from "./constants";
import { Music, MusicImage, MusicInfo, MusicMeta } from "./declare";

type MusicStore = {
  music?: Music
  musicInfo?: MusicInfo
  musicMeta?: MusicMeta
  musicImage?: MusicImage
  musicPath?: string
  play: boolean
  infoDisplay: boolean
  manuallyStopped: boolean
  openedFiles: string[]
  playIndex: number
  volume: number
  previousVolume: number
  isMuted: boolean
  sequenceType: number

  setMusic: (music?: Music) => void
  setMusicInfo: (musicInfo?: MusicInfo) => void
  setMusicMeta: (musicMeta?: MusicMeta) => void
  setMusicImage: (musicImage?: MusicImage) => void
  setMusicPath: (musicPath?: string) => void
  setPlay: (play: boolean) => void
  setInfoDisplay: (infoDisplay: boolean) => void
  setManuallyStopped: (manuallyStopped: boolean) => void
  setOpenedFiles: (openedFiles: string[]) => void
  setPlayIndex: (playIndex: number) => void
  setVolume: (volume: number) => void
  setPreviousVolume: (previousVolume: number) => void
  setIsMuted: (isMuted: boolean) => void
  setSequenceType: (sequenceType: number) => void
}

export const useMusicStore = create<MusicStore>((set) => ({
  music: undefined,
  musicInfo: undefined,
  musicMeta: undefined,
  musicImage: undefined,
  musicPath: undefined,
  play: false,
  infoDisplay: false,
  manuallyStopped: false,
  openedFiles: [],
  playIndex: 0,
  volume: 1, // 0 - 1
  previousVolume: 1,
  isMuted: false,
  sequenceType: SEQUENCE_TYPES.REPEAT,

  setMusic: (music?: Music) => set({ music }),
  setMusicInfo: (musicInfo?: MusicInfo) => set({ musicInfo }),
  setMusicMeta: (musicMeta?: MusicMeta) => set({ musicMeta }),
  setMusicImage: (musicImage?: MusicImage) => set({ musicImage }),
  setMusicPath: (musicPath?: string) => set({ musicPath }),
  setPlay: (play: boolean) => set({ play }),
  setInfoDisplay: (infoDisplay: boolean) => set({ infoDisplay }),
  setManuallyStopped: (manuallyStopped: boolean) => set({ manuallyStopped }),
  setOpenedFiles: (openedFiles: string[]) => set({ openedFiles }),
  setPlayIndex: (playIndex: number) => set({ playIndex }),
  setVolume: (volume: number) => set({ volume }),
  setPreviousVolume: (previousVolume: number) => set({ previousVolume }),
  setIsMuted: (isMuted: boolean) => set({ isMuted }),
  setSequenceType: (sequenceType: number) => set({ sequenceType }),
}))
