const SEQUENCE_TYPES = {
  REPEAT: 1,
  REPEAT_ONE: 2,
  RANDOM: 3,
} as const;

const SUPPORTED_FORMATS = [
  'flac',
  'mp3',
  'wav',
  'aac',
  'ogg',
  'riff',
  'aiff',
  'mkv',
  'caf',
  'mp4',
  'm4a',
  'mp2',
  'alac',
  'wma',
];

export { SEQUENCE_TYPES, SUPPORTED_FORMATS };
