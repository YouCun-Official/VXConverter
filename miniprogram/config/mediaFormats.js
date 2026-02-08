/**
 * 媒体格式配置
 */

// 图片格式配置
const imageFormats = [
  {
    value: 'jpg',
    label: 'JPG',
    description: '通用格式，兼容性好',
    icon: '📷'
  },
  {
    value: 'png',
    label: 'PNG',
    description: '支持透明，无损压缩',
    icon: '🖼️'
  },
  {
    value: 'webp',
    label: 'WEBP',
    description: '体积小，质量高',
    icon: '🎨'
  }
];

// 图片质量预设
const qualityPresets = [
  {
    label: '高质量',
    value: 0.95,
    description: '最佳画质，文件较大'
  },
  {
    label: '标准',
    value: 0.85,
    description: '平衡质量和大小'
  },
  {
    label: '压缩',
    value: 0.70,
    description: '文件较小，略有损失'
  },
  {
    label: '极限压缩',
    value: 0.50,
    description: '最小文件，质量下降'
  }
];

// 尺寸调整选项
const resizeOptions = [
  {
    label: '保持原尺寸',
    value: 'original',
    maxWidth: null,
    maxHeight: null
  },
  {
    label: '1920x1080 (1080P)',
    value: '1080p',
    maxWidth: 1920,
    maxHeight: 1080
  },
  {
    label: '1280x720 (720P)',
    value: '720p',
    maxWidth: 1280,
    maxHeight: 720
  },
  {
    label: '800x600',
    value: '800x600',
    maxWidth: 800,
    maxHeight: 600
  },
  {
    label: '640x480',
    value: '640x480',
    maxWidth: 640,
    maxHeight: 480
  }
];

// 视频格式配置
const videoFormats = [
  {
    value: 'mp4',
    label: 'MP4',
    description: '最常用视频格式',
    icon: '🎬'
  },
  {
    value: 'avi',
    label: 'AVI',
    description: '经典视频格式',
    icon: '📹'
  },
  {
    value: 'mov',
    label: 'MOV',
    description: 'Apple QuickTime格式',
    icon: '🎥'
  }
];

// 音频格式配置
const audioFormats = [
  {
    value: 'mp3',
    label: 'MP3',
    description: '通用音频格式',
    icon: '🎵'
  },
  {
    value: 'aac',
    label: 'AAC',
    description: '高质量音频',
    icon: '🎶'
  },
  {
    value: 'wav',
    label: 'WAV',
    description: '无损音频',
    icon: '🎼'
  }
];

module.exports = {
  imageFormats,
  qualityPresets,
  resizeOptions,
  videoFormats,
  audioFormats
};
