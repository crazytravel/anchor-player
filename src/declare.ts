export interface MusicInfo {
  codec: string;
  codec_short: string;
  sample_rate: string;
  start_time: string;
  duration: string;
  frames: string;
  time_base: string;
  encoder_delay: string;
  encoder_padding: string;
  sample_format: string;
  bits_per_sample: string;
  channel: string;
  channel_map: string;
  channel_layout: string;
  language: string;
}

export interface Music {
  id: number;
  name: string;
  path: string;
  duration: string;
  progress: string;
}

export interface MusicMeta {
  title: string;
  artist: string;
  album: string;
}

export interface MusicFile {
  id: number
  name: string
  path: string
}

export interface MusicState {
  id: number
  state: 'FINISHED' | 'PLAYING' | 'PAUSED' | 'STOPPED'
}

export interface MusicInfoRes {
  resultCount: number;
  results: Result[];
}

export interface Result {
  wrapperType: string;
  kind: string;
  artistId: number;
  collectionId: number;
  trackId: number;
  artistName: string;
  collectionName: string;
  trackName: string;
  collectionCensoredName: string;
  trackCensoredName: string;
  artistViewUrl: string;
  collectionViewUrl: string;
  trackViewUrl: string;
  previewUrl: string;
  artworkUrl30: string;
  artworkUrl60: string;
  artworkUrl100: string;
  releaseDate: Date;
  collectionExplicitness: string;
  trackExplicitness: string;
  discCount: number;
  discNumber: number;
  trackCount: number;
  trackNumber: number;
  trackTimeMillis: number;
  country: string;
  currency: string;
  primaryGenreName: string;
  isStreamable: boolean;
}
