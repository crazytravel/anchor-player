interface MusicInfo {
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

interface Music {
  id: number;
  name: string;
  path: string;
  duration: string;
  progress: string;
}

interface MusicMeta {
  title: String;
  artist: String;
  album: String;
}

interface MusicImage {
  image: string;
}

interface MusicFile {
  id: number
  name: string
  path: string
}

interface MusicState {
  id: number
  state: 'FINISHED' | 'PLAYING' | 'PAUSED' | 'STOPPED'
}

export type { MusicInfo, Music, MusicMeta, MusicImage, MusicFile, MusicState };
