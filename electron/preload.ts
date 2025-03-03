import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

// 暴露图片压缩相关的 API
contextBridge.exposeInMainWorld('imageCompressor', {
  // 选择文件夹
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // 扫描图片
  scanImages: (folderPath: string) => ipcRenderer.invoke('scan-images', folderPath),
  
  // 压缩图片
  compressImages: (params: any) => ipcRenderer.invoke('compress-images', params),
  
  // 选择输出目录
  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),
  
  // 保存失败文件列表
  saveFailedList: (failedContent: string, outputDir: string) => 
    ipcRenderer.invoke('save-failed-list', failedContent, outputDir),
  
  // 监听压缩进度
  onProgress: (callback: (progress: number) => void) => {
    ipcRenderer.on('compression-progress', (_, progress) => {
      callback(progress)
    })
  },
  
  // 移除进度监听
  offProgress: () => {
    ipcRenderer.removeAllListeners('compression-progress')
  }
})
