// pages/tools/pdf-merge/index.js

Page({
  data: {
    // PDF文件列表
    pdfFiles: [], // { tempFilePath, name, size, pageCount, id }

    // 拖动状态
    isDragging: false,
    dragIndex: -1,

    // 合并状态
    isMerging: false,
    mergeProgress: 0,

    // 结果
    mergedFileID: null
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
      count: 10,
      type: 'file',
      extension: ['pdf'],
      success: async (res) => {
        wx.showLoading({
          title: '加载中...',
          mask: true
        });

        try {
          const files = res.tempFiles;
          const pdfList = [];

          for (let file of files) {
            // 检查文件类型
            if (!file.name.toLowerCase().endsWith('.pdf')) {
              continue;
            }

            // 检查文件大小（限制50MB）
            if (file.size > 50 * 1024 * 1024) {
              wx.showToast({
                title: `${file.name} 超过50MB`,
                icon: 'none'
              });
              continue;
            }

            pdfList.push({
              tempFilePath: file.path,
              name: file.name,
              size: file.size,
              id: Date.now() + Math.random(),
              pageCount: '计算中...'
            });
          }

          // 添加到列表
          this.setData({
            pdfFiles: this.data.pdfFiles.concat(pdfList)
          });

          wx.hideLoading();

          if (pdfList.length > 0) {
            wx.showToast({
              title: `已添加 ${pdfList.length} 个PDF`,
              icon: 'success'
            });
          } else {
            wx.showToast({
              title: '未选择有效的PDF文件',
              icon: 'none'
            });
          }
        } catch (error) {
          wx.hideLoading();
          wx.showToast({
            title: '加载失败',
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
  deletePDF(e) {
    const index = e.currentTarget.dataset.index;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个PDF文件吗？',
      success: (res) => {
        if (res.confirm) {
          const pdfFiles = this.data.pdfFiles;
          pdfFiles.splice(index, 1);

          this.setData({ pdfFiles });

          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 清空列表
   */
  clearAll() {
    if (this.data.pdfFiles.length === 0) {
      return;
    }

    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有PDF文件吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            pdfFiles: [],
            mergedFileID: null
          });

          wx.showToast({
            title: '已清空',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 长按开始拖动
   */
  onLongPress(e) {
    const index = e.currentTarget.dataset.index;

    this.setData({
      isDragging: true,
      dragIndex: index
    });

    wx.vibrateShort({
      type: 'medium'
    });

    wx.showToast({
      title: '可以拖动调整顺序',
      icon: 'none',
      duration: 1500
    });
  },

  /**
   * 拖动移动
   */
  onTouchMove(e) {
    if (!this.data.isDragging) return;

    const touch = e.touches[0];
    const query = wx.createSelectorQuery();

    query.selectAll('.pdf-card').boundingClientRect();
    query.exec((res) => {
      if (!res[0]) return;

      const cards = res[0];
      let targetIndex = -1;

      // 找到当前触摸点对应的卡片
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (touch.pageY >= card.top && touch.pageY <= card.bottom) {
          targetIndex = i;
          break;
        }
      }

      // 如果找到目标位置且不是当前位置，则交换
      if (targetIndex !== -1 && targetIndex !== this.data.dragIndex) {
        this.swapCards(this.data.dragIndex, targetIndex);
        this.setData({ dragIndex: targetIndex });
      }
    });
  },

  /**
   * 结束拖动
   */
  onTouchEnd() {
    if (this.data.isDragging) {
      this.setData({
        isDragging: false,
        dragIndex: -1
      });

      wx.showToast({
        title: '顺序已调整',
        icon: 'success'
      });
    }
  },

  /**
   * 交换卡片位置
   */
  swapCards(fromIndex, toIndex) {
    const pdfFiles = [...this.data.pdfFiles];
    const [movedItem] = pdfFiles.splice(fromIndex, 1);
    pdfFiles.splice(toIndex, 0, movedItem);

    this.setData({ pdfFiles });
  },

  /**
   * 上移
   */
  moveUp(e) {
    const index = e.currentTarget.dataset.index;
    if (index === 0) return;

    this.swapCards(index, index - 1);
  },

  /**
   * 下移
   */
  moveDown(e) {
    const index = e.currentTarget.dataset.index;
    if (index === this.data.pdfFiles.length - 1) return;

    this.swapCards(index, index + 1);
  },

  /**
   * 开始合并
   */
  async startMerge() {
    if (this.data.pdfFiles.length < 2) {
      wx.showToast({
        title: '至少需要2个PDF文件',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认合并',
      content: `将按当前顺序合并 ${this.data.pdfFiles.length} 个PDF文件`,
      success: async (res) => {
        if (res.confirm) {
          await this.mergePDFs();
        }
      }
    });
  },

  /**
   * 合并PDF
   */
  async mergePDFs() {
    this.setData({ isMerging: true, mergeProgress: 0 });

    wx.showLoading({
      title: '上传中...',
      mask: true
    });

    try {
      // 1. 上传所有PDF到云存储
      const fileIDs = [];
      for (let i = 0; i < this.data.pdfFiles.length; i++) {
        const file = this.data.pdfFiles[i];

        this.setData({
          mergeProgress: Math.round((i / this.data.pdfFiles.length) * 50)
        });

        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `pdf-merge/input/${Date.now()}_${i}.pdf`,
          filePath: file.tempFilePath
        });

        fileIDs.push(uploadRes.fileID);
      }

      // 2. 调用云函数合并
      wx.showLoading({ title: '合并中...' });
      this.setData({ mergeProgress: 60 });

      const cloudRes = await wx.cloud.callFunction({
        name: 'pdfMerge',
        data: {
          fileIDs: fileIDs
        }
      });

      wx.hideLoading();

      if (cloudRes.result.success) {
        this.setData({
          isMerging: false,
          mergeProgress: 100,
          mergedFileID: cloudRes.result.fileID
        });

        wx.showModal({
          title: '合并成功',
          content: `已合并 ${this.data.pdfFiles.length} 个PDF文件`,
          showCancel: false,
          success: () => {
            // 可以选择下载或分享
          }
        });
      } else {
        throw new Error(cloudRes.result.error || '合并失败');
      }

    } catch (error) {
      console.error('合并失败:', error);

      wx.hideLoading();
      this.setData({ isMerging: false });

      wx.showModal({
        title: '合并失败',
        content: error.message || '请重试',
        showCancel: false
      });
    }
  },

  /**
   * 下载合并后的PDF
   */
  async downloadMerged() {
    if (!this.data.mergedFileID) {
      wx.showToast({
        title: '请先合并PDF',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '准备下载...' });

    try {
      // 下载文件
      const downloadRes = await wx.cloud.downloadFile({
        fileID: this.data.mergedFileID
      });

      wx.hideLoading();

      // 打开文件
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
   * 分享合并后的PDF
   */
  shareMerged() {
    if (!this.data.mergedFileID) {
      wx.showToast({
        title: '请先合并PDF',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '分享文件',
      content: '请使用"下载"功能后通过系统分享',
      showCancel: false
    });
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
