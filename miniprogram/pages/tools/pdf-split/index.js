// pages/tools/pdf-split/index.js

Page({
  data: {
    // PDF文件
    pdfFile: null,  // { tempFilePath, name, size }
    pageCount: 0,   // 总页数

    // 拆分模式
    splitMode: 'range',  // range: 范围拆分, single: 单页, average: 平均, oddeven: 奇偶
    modeOptions: [
      { label: '范围拆分', value: 'range', icon: '📑' },
      { label: '单页拆分', value: 'single', icon: '📄' },
      { label: '平均拆分', value: 'average', icon: '⚖️' },
      { label: '奇偶拆分', value: 'oddeven', icon: '🔀' }
    ],

    // 范围拆分参数
    ranges: [],  // [{ start: 1, end: 3, name: '第1-3页' }]
    startPage: 1,
    endPage: 1,

    // 平均拆分参数
    splitCount: 2,  // 拆分成几份

    // 奇偶拆分参数
    oddEvenMode: 'odd',  // odd: 奇数页, even: 偶数页

    // 处理状态
    isProcessing: false,
    processProgress: 0,

    // 结果
    resultFiles: []  // [{ fileID, name, pageRange }]
  },

  /**
   * 页面加载
   */
  onLoad(options) {
    // 初始化
  },

  /**
   * 选择PDF文件
   */
  choosePDF() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf'],
      success: async (res) => {
        const file = res.tempFiles[0];

        // 检查文件类型
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          wx.showToast({
            title: '请选择PDF文件',
            icon: 'none'
          });
          return;
        }

        // 检查文件大小（限制100MB）
        if (file.size > 100 * 1024 * 1024) {
          wx.showToast({
            title: '文件不能超过100MB',
            icon: 'none'
          });
          return;
        }

        wx.showLoading({ title: '分析PDF...' });

        try {
          // 本地读取PDF二进制，提取页数（无需云函数）
          const pageCount = await this.getPageCountLocally(file.path);

          // 上传PDF到云存储
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: `pdf-split/input/${Date.now()}_${file.name}`,
            filePath: file.path
          });

          wx.hideLoading();

          this.setData({
            pdfFile: {
              tempFilePath: file.path,
              name: file.name,
              size: file.size,
              fileID: uploadRes.fileID
            },
            pageCount: pageCount,
            endPage: pageCount,
            ranges: [],
            resultFiles: []
          });

          wx.showToast({
            title: `PDF共${pageCount}页`,
            icon: 'success'
          });

        } catch (error) {
          wx.hideLoading();
          console.error('文件处理失败:', error);
          wx.showToast({
            title: '文件处理失败',
            icon: 'none'
          });
        }
      },
      fail: (error) => {
        console.error('选择文件失败:', error);
      }
    });
  },

  /**
   * 删除PDF文件
   */
  deletePDF() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除已选择的PDF文件吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            pdfFile: null,
            pageCount: 0,
            ranges: [],
            resultFiles: []
          });

          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 本地解析PDF页数（读取二进制，匹配 /Count N 字段）
   * 避免为获取页数而额外调用云函数
   */
  getPageCountLocally(filePath) {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      fs.readFile({
        filePath,
        encoding: 'binary',
        success: (res) => {
          try {
            const content = res.data;
            // PDF 页数保存在页树的 /Count N 中，取最大值即为总页数
            const matches = content.match(/\/Count\s+(\d+)/g) || [];
            if (matches.length === 0) {
              resolve(1);
              return;
            }
            const counts = matches.map(m => parseInt(m.replace(/\/Count\s+/, ''), 10));
            const pageCount = Math.max(...counts);
            resolve(pageCount > 0 ? pageCount : 1);
          } catch (e) {
            console.warn('本地解析页数失败，默认1页:', e);
            resolve(1);
          }
        },
        fail: (err) => {
          console.warn('读取PDF文件失败:', err);
          resolve(1);
        }
      });
    });
  },

  /**
   * 切换拆分模式
   */
  onModeChange(e) {
    this.setData({
      splitMode: e.detail.value,
      ranges: []
    });
  },

  /**
   * 起始页输入
   */
  onStartPageInput(e) {
    const value = parseInt(e.detail.value) || 1;
    this.setData({
      startPage: Math.max(1, Math.min(value, this.data.pageCount))
    });
  },

  /**
   * 结束页输入
   */
  onEndPageInput(e) {
    const value = parseInt(e.detail.value) || 1;
    this.setData({
      endPage: Math.max(1, Math.min(value, this.data.pageCount))
    });
  },

  /**
   * 添加拆分范围
   */
  addRange() {
    const { startPage, endPage, ranges } = this.data;

    if (startPage > endPage) {
      wx.showToast({
        title: '起始页不能大于结束页',
        icon: 'none'
      });
      return;
    }

    // 检查是否重叠
    for (let range of ranges) {
      if (!(endPage < range.start || startPage > range.end)) {
        wx.showToast({
          title: '页码范围重叠',
          icon: 'none'
        });
        return;
      }
    }

    const newRange = {
      id: Date.now(),
      start: startPage,
      end: endPage,
      name: startPage === endPage ? `第${startPage}页` : `第${startPage}-${endPage}页`
    };

    ranges.push(newRange);
    ranges.sort((a, b) => a.start - b.start);

    this.setData({
      ranges: ranges
    });

    wx.showToast({
      title: '已添加范围',
      icon: 'success'
    });
  },

  /**
   * 删除范围
   */
  deleteRange(e) {
    const id = e.currentTarget.dataset.id;
    const ranges = this.data.ranges.filter(r => r.id !== id);

    this.setData({ ranges });

    wx.showToast({
      title: '已删除',
      icon: 'success'
    });
  },

  /**
   * 清空范围
   */
  clearRanges() {
    if (this.data.ranges.length === 0) return;

    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有拆分范围吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ ranges: [] });
          wx.showToast({
            title: '已清空',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 拆分份数调整
   */
  onSplitCountChange(e) {
    this.setData({
      splitCount: parseInt(e.detail.value)
    });
  },

  /**
   * 奇偶模式切换
   */
  onOddEvenChange(e) {
    this.setData({
      oddEvenMode: e.detail.value
    });
  },

  /**
   * 开始拆分
   */
  async startSplit() {
    if (!this.data.pdfFile) {
      wx.showToast({
        title: '请先选择PDF文件',
        icon: 'none'
      });
      return;
    }

    const { splitMode, ranges, splitCount, oddEvenMode, pageCount } = this.data;

    // 验证参数
    if (splitMode === 'range' && ranges.length === 0) {
      wx.showToast({
        title: '请添加拆分范围',
        icon: 'none'
      });
      return;
    }

    if (splitMode === 'average' && (splitCount < 2 || splitCount > pageCount)) {
      wx.showToast({
        title: '拆分份数无效',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认拆分',
      content: this.getSplitConfirmMessage(),
      success: async (res) => {
        if (res.confirm) {
          await this.executeSplit();
        }
      }
    });
  },

  /**
   * 获取确认信息
   */
  getSplitConfirmMessage() {
    const { splitMode, ranges, splitCount, oddEvenMode, pageCount } = this.data;

    switch (splitMode) {
      case 'range':
        return `将拆分为 ${ranges.length} 个PDF文件`;
      case 'single':
        return `将拆分为 ${pageCount} 个PDF文件（每页一个）`;
      case 'average':
        return `将平均拆分为 ${splitCount} 个PDF文件`;
      case 'oddeven':
        const mode = oddEvenMode === 'odd' ? '奇数' : '偶数';
        return `将提取所有${mode}页`;
      default:
        return '确认拆分？';
    }
  },

  /**
   * 执行拆分
   */
  async executeSplit() {
    this.setData({ isProcessing: true, processProgress: 0 });

    wx.showLoading({ title: '拆分中...' });

    try {
      // 构建拆分参数
      const splitData = {
        action: 'split',
        fileID: this.data.pdfFile.fileID,
        mode: this.data.splitMode
      };

      if (this.data.splitMode === 'range') {
        splitData.ranges = this.data.ranges.map(r => ({
          start: r.start,
          end: r.end
        }));
      } else if (this.data.splitMode === 'average') {
        splitData.splitCount = this.data.splitCount;
      } else if (this.data.splitMode === 'oddeven') {
        splitData.oddEvenMode = this.data.oddEvenMode;
      }

      // 调用云函数拆分
      const cloudRes = await wx.cloud.callFunction({
        name: 'pdfSplit',
        data: splitData
      });

      wx.hideLoading();

      if (cloudRes.result.success) {
        this.setData({
          isProcessing: false,
          processProgress: 100,
          resultFiles: cloudRes.result.files
        });

        wx.showModal({
          title: '拆分成功',
          content: `已生成 ${cloudRes.result.files.length} 个PDF文件`,
          showCancel: false
        });
      } else {
        throw new Error(cloudRes.result.error || '拆分失败');
      }

    } catch (error) {
      console.error('拆分失败:', error);

      wx.hideLoading();
      this.setData({ isProcessing: false });

      wx.showModal({
        title: '拆分失败',
        content: error.message || '请重试',
        showCancel: false
      });
    }
  },

  /**
   * 下载单个文件
   */
  async downloadFile(e) {
    const index = e.currentTarget.dataset.index;
    const file = this.data.resultFiles[index];

    wx.showLoading({ title: '准备下载...' });

    try {
      const downloadRes = await wx.cloud.downloadFile({
        fileID: file.fileID
      });

      wx.hideLoading();

      wx.openDocument({
        filePath: downloadRes.tempFilePath,
        fileType: 'pdf',
        showMenu: true,
        success: () => {
          console.log('打开PDF成功');
        },
        fail: (error) => {
          console.error('打开PDF失败:', error);
          wx.showToast({
            title: '打开失败',
            icon: 'none'
          });
        }
      });

    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: '下载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 格式化文件大小
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  }
});
