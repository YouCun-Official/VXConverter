/**
 * 媒体格式工具类
 */
class FormatUtils {
  // 支持的图片格式
  static IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];

  // 支持的视频格式
  static VIDEO_FORMATS = ['mp4', 'avi', 'mov', 'flv', 'wmv', 'mkv'];

  // 支持的音频格式
  static AUDIO_FORMATS = ['mp3', 'aac', 'wav', 'ogg', 'm4a', 'flac'];

  /**
   * 获取文件扩展名
   */
  static getFileExtension(filePath) {
    return filePath.split('.').pop().toLowerCase();
  }

  /**
   * 检查是否为图片
   */
  static isImage(filePath) {
    const ext = this.getFileExtension(filePath);
    return this.IMAGE_FORMATS.includes(ext);
  }

  /**
   * 检查是否为视频
   */
  static isVideo(filePath) {
    const ext = this.getFileExtension(filePath);
    return this.VIDEO_FORMATS.includes(ext);
  }

  /**
   * 检查是否为音频
   */
  static isAudio(filePath) {
    const ext = this.getFileExtension(filePath);
    return this.AUDIO_FORMATS.includes(ext);
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  }

  /**
   * 格式化时长（秒 → mm:ss）
   */
  static formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * 获取MIME类型
   */
  static getMimeType(format) {
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif',
      'bmp': 'image/bmp'
    };
    return mimeTypes[format.toLowerCase()] || 'image/jpeg';
  }
}

module.exports = FormatUtils;
