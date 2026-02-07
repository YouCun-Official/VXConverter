// pages/tools/image-compress/config.js

const COMPRESS_CONFIG = {
  // 质量预设
  qualityPresets: [
    { label: '高清', value: 0.95, icon: '⭐' },
    { label: '标准', value: 0.80, icon: '✓', recommended: true },
    { label: '省空间', value: 0.60, icon: '📦' },
    { label: '极限', value: 0.40, icon: '🗜️' }
  ],

  // 尺寸选项
  resizeOptions: [
    { label: '保持原尺寸', value: 'original' },
    { label: '1080P', value: 'fhd', maxWidth: 1920, maxHeight: 1080 },
    { label: '720P', value: 'hd', maxWidth: 1280, maxHeight: 720 },
    { label: '480P', value: 'sd', maxWidth: 854, maxHeight: 480 }
  ],

  // 格式选项
  formatOptions: [
    { label: '智能选择', value: 'auto', icon: '🤖' },
    { label: 'JPG', value: 'jpg', icon: '🖼️' },
    { label: 'PNG', value: 'png', icon: '🎨' }
  ],

  // 默认配置
  defaults: {
    quality: 0.80,
    resize: 'original',
    format: 'auto'
  }
};

module.exports = COMPRESS_CONFIG;
