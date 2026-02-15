// pages/tools/video-compress/config.js

const COMPRESS_CONFIG = {
  // 质量预设
  qualityPresets: [
    { label: '高清', value: 'high', icon: '⭐' },
    { label: '标准', value: 'standard', icon: '✓', recommended: true },
    { label: '省空间', value: 'low', icon: '📦' },
    { label: '极限', value: 'ultralow', icon: '🗜️' }
  ],

  // 分辨率选项
  resolutionOptions: [
    { label: '保持原分辨率', value: 'original' },
    { label: '1080P', value: '1080p', maxWidth: 1920, maxHeight: 1080 },
    { label: '720P', value: '720p', maxWidth: 1280, maxHeight: 720 },
    { label: '480P', value: '480p', maxWidth: 854, maxHeight: 480 }
  ],

  // 码率选项
  bitrateOptions: [
    { label: '智能选择', value: 'auto', icon: '🤖' },
    { label: '高码率 (8Mbps)', value: '8000k', icon: '⚡' },
    { label: '中码率 (4Mbps)', value: '4000k', icon: '✓' },
    { label: '低码率 (2Mbps)', value: '2000k', icon: '📦' }
  ],

  // 默认配置
  defaults: {
    quality: 'standard',
    resolution: 'original',
    bitrate: 'auto'
  }
};

module.exports = COMPRESS_CONFIG;
