export interface MusicInfo {
  codec?: string;
  codec_short?: string;
  sample_rate?: string;
  start_time?: string;
  duration?: string;
  frames?: string;
  time_base?: string;
  encoder_delay?: string;
  encoder_padding?: string;
  sample_format?: string;
  bits_per_sample?: string;
  channel?: string;
  channel_map?: string;
  channel_layout?: string;
  language?: string;
}

export interface PlayState {
  id: string;
  name: string;
  path: string;
  left_duration: string;
  progress: string;
}

export interface MusicMeta {
  title: string;
  artist: string;
  album: string;
}

export interface MusicFile {
  id: string;
  name: string;
  path: string;
  imagePath?: string;
  artist?: string;
  album?: string;
}

export interface MusicSetting {
  volume: number;
  sequence_type: number;
}

export interface MusicError {
  id: string;
  name: string;
  message: string;
}
