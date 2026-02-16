// config.js - 证件照规格配置

/**
 * 标准证件照规格
 * 单位：毫米(mm)，像素按300DPI计算
 * 1英寸 = 25.4mm
 * 像素 = (mm / 25.4) * dpi
 */
const ID_PHOTO_SPECS = [
  {
    id: 'one_inch',
    name: '1寸照片',
    description: '常用于简历、证件',
    widthMM: 25,
    heightMM: 35,
    widthPX: 295,
    heightPX: 413,
    icon: '📄'
  },
  {
    id: 'small_one_inch',
    name: '小1寸照片',
    description: '驾驶证、身份证等',
    widthMM: 22,
    heightMM: 32,
    widthPX: 260,
    heightPX: 378,
    icon: '🪪'
  },
  {
    id: 'two_inch',
    name: '2寸照片',
    description: '护照、签证等',
    widthMM: 35,
    heightMM: 45,
    widthPX: 413,
    heightPX: 531,
    icon: '📋'
  },
  {
    id: 'two_inch_small',
    name: '小2寸照片',
    description: '护照等',
    widthMM: 35,
    heightMM: 49,
    widthPX: 413,
    heightPX: 579,
    icon: '🎫'
  },
  {
    id: 'id_card',
    name: '身份证照片',
    description: '26×32mm',
    widthMM: 26,
    heightMM: 32,
    widthPX: 307,
    heightPX: 378,
    icon: '🆔'
  },
  {
    id: 'passport_china',
    name: '中国护照',
    description: '33×48mm',
    widthMM: 33,
    heightMM: 48,
    widthPX: 390,
    heightPX: 567,
    icon: '🛂'
  },
  {
    id: 'passport_intl',
    name: '国际护照',
    description: '35×45mm',
    widthMM: 35,
    heightMM: 45,
    widthPX: 413,
    heightPX: 531,
    icon: '✈️'
  },
  {
    id: 'driver_license',
    name: '驾驶证',
    description: '22×32mm',
    widthMM: 22,
    heightMM: 32,
    widthPX: 260,
    heightPX: 378,
    icon: '🚗'
  },
  {
    id: 'social_security',
    name: '社保卡',
    description: '26×32mm',
    widthMM: 26,
    heightMM: 32,
    widthPX: 307,
    heightPX: 378,
    icon: '💳'
  },
  {
    id: 'visa_usa',
    name: '美国签证',
    description: '51×51mm',
    widthMM: 51,
    heightMM: 51,
    widthPX: 600,
    heightPX: 600,
    icon: '🗽'
  },
  {
    id: 'custom',
    name: '自定义尺寸',
    description: '输入自定义宽高',
    widthMM: 35,
    heightMM: 45,
    widthPX: 413,
    heightPX: 531,
    icon: '⚙️',
    isCustom: true
  }
];

/**
 * 背景颜色选项
 */
const BACKGROUND_COLORS = [
  {
    id: 'none',
    name: '保持原背景',
    color: null,
    hex: null,
    icon: '🚫'
  },
  {
    id: 'white',
    name: '白色',
    color: '#FFFFFF',
    hex: '#FFFFFF',
    icon: '⚪'
  },
  {
    id: 'red',
    name: '红色',
    color: '#E74C3C',
    hex: '#E74C3C',
    icon: '🔴'
  },
  {
    id: 'blue',
    name: '蓝色',
    color: '#3498DB',
    hex: '#3498DB',
    icon: '🔵'
  },
  {
    id: 'light_blue',
    name: '浅蓝色',
    color: '#5DADE2',
    hex: '#5DADE2',
    icon: '💙'
  }
];

/**
 * 输出分辨率选项 (DPI)
 */
const DPI_OPTIONS = [
  {
    id: 'standard',
    name: '标准 (300 DPI)',
    value: 300,
    description: '适合打印'
  },
  {
    id: 'high',
    name: '高清 (600 DPI)',
    value: 600,
    description: '高质量打印'
  },
  {
    id: 'web',
    name: '网络 (150 DPI)',
    value: 150,
    description: '适合网络上传'
  }
];

/**
 * 图片质量选项
 */
const QUALITY_OPTIONS = [
  {
    id: 'high',
    name: '高质量',
    value: 1.0
  },
  {
    id: 'medium',
    name: '中等',
    value: 0.9
  },
  {
    id: 'low',
    name: '低质量',
    value: 0.8
  }
];

module.exports = {
  ID_PHOTO_SPECS,
  BACKGROUND_COLORS,
  DPI_OPTIONS,
  QUALITY_OPTIONS
};
