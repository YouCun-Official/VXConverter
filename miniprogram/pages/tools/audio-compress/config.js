// pages/tools/audio-compress/config.js

const COMPRESS_CONFIG = {
  qualityPresets: [
    { label: '高清', value: 0.95, icon: '⭐' },
    { label: '标准', value: 0.80, icon: '✓', recommended: true },
    { label: '省空间', value: 0.60, icon: '📦' },
    { label: '极限', value: 0.40, icon: '🗜️' }
  ],

  resizeOptions: [
    { label: '保持原比特率', value: 'original', bitrate: '' },
    { label: '320 kbps', value: '320k', bitrate: '320k' },
    { label: '192 kbps', value: '192k', bitrate: '192k' },
    { label: '128 kbps', value: '128k', bitrate: '128k' },
    { label: '96 kbps', value: '96k', bitrate: '96k' }
  ],

  formatOptions: [
    { label: '智能选择', value: 'auto', icon: '🤖' },
    { label: 'MP3', value: 'mp3', icon: '🎵' },
    { label: 'AAC', value: 'aac', icon: '🎶' },
    { label: 'WAV', value: 'wav', icon: '🎼' }
  ],

  defaults: {
    quality: 0.80,
    resize: 'original',
    format: 'auto'
  }
};

module.exports = COMPRESS_CONFIG;
