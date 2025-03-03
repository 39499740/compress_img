import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
// 使用sharp库进行图片处理
const sharp = require('sharp')
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 定义接口
interface ImageFile {
  path: string
  relativePath: string
  name: string
  size: number
  extension: string
  selected?: boolean
}

interface CompressResult {
  original: string
  compressed: string
  originalSize: number
  compressedSize: number
  savedPercentage: number
  success: boolean
  message?: string
  error?: string
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1000,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: '图片压缩工具',
    autoHideMenuBar: true,
  })

  // 隐藏菜单栏
  win.setMenuBarVisibility(false)

  // 允许拖放文件
  win.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()
  
  // 处理文件夹拖放
  ipcMain.handle('select-folder', async () => {
    if (!win) return { canceled: true }
    
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    
    if (result.canceled) return { canceled: true }
    
    return { 
      canceled: false, 
      folderPath: result.filePaths[0] 
    }
  })
  
  // 扫描文件夹中的图片
  ipcMain.handle('scan-images', async (_, folderPath: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff']
    const imageFiles: ImageFile[] = []
    
    // 递归扫描文件夹
    const scanDir = (dir: string, baseDir: string) => {
      const files = fs.readdirSync(dir)
      
      for (const file of files) {
        const filePath = path.join(dir, file)
        const stat = fs.statSync(filePath)
        
        if (stat.isDirectory()) {
          scanDir(filePath, baseDir)
        } else {
          const ext = path.extname(file).toLowerCase()
          if (imageExtensions.includes(ext)) {
            // 计算相对路径
            const relativePath = path.relative(baseDir, filePath)
            imageFiles.push({
              path: filePath,
              relativePath,
              name: file,
              size: stat.size,
              extension: ext
            })
          }
        }
      }
    }
    
    try {
      scanDir(folderPath, folderPath)
      return { success: true, images: imageFiles }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  // 压缩图片
  ipcMain.handle('compress-images', async (_, { images, quality, outputDir }) => {
    try {
      const results: CompressResult[] = []
      
      // 确保质量参数是整数
      const qualityInt = parseInt(quality, 10)
      
      for (let i = 0; i < images.length; i++) {
        try {
          const image = images[i]
          // 提取需要的属性，避免传递整个对象
          const imagePath = image.path
          const imageRelativePath = image.relativePath
          
          // 通知进度
          if (win) {
            win.webContents.send('compression-progress', i + 1)
          }
          
          // 创建输出目录（保持相对路径结构）
          const outputPath = path.join(outputDir, imageRelativePath)
          const outputDirPath = path.dirname(outputPath)
          
          if (!fs.existsSync(outputDirPath)) {
            fs.mkdirSync(outputDirPath, { recursive: true })
          }
          
          // 获取原始文件大小
          const originalSize = fs.statSync(imagePath).size
          
          // 根据文件扩展名选择合适的压缩方法
          const ext = path.extname(imagePath).toLowerCase()
          
          // 使用sharp进行图片处理
          if (ext === '.jpg' || ext === '.jpeg') {
            await sharp(imagePath)
              .jpeg({ quality: qualityInt })
              .toFile(outputPath);
          } else if (ext === '.png') {
            await sharp(imagePath)
              .png({ quality: qualityInt })
              .toFile(outputPath);
          } else if (ext === '.webp') {
            await sharp(imagePath)
              .webp({ quality: qualityInt })
              .toFile(outputPath);
          } else {
            // 对于其他格式，尝试转换为jpeg
            await sharp(imagePath)
              .jpeg({ quality: qualityInt })
              .toFile(outputPath);
          }
          
          // 获取压缩后的文件大小
          const compressedSize = fs.statSync(outputPath).size
          const savedPercentage = ((originalSize - compressedSize) / originalSize * 100).toFixed(2)
          
          // 只返回简单的字符串属性
          results.push({
            original: imagePath,
            compressed: outputPath,
            originalSize,
            compressedSize,
            savedPercentage: parseFloat(savedPercentage),
            success: true,
            message: `已压缩，质量设置为 ${qualityInt}%，节省了 ${savedPercentage}% 的空间`
          })
        } catch (err: any) {
          console.error(`处理图片失败: ${images[i].path}`, err)
          
          // 确保错误对象可以被序列化
          results.push({
            original: images[i].path,
            compressed: '',
            originalSize: 0,
            compressedSize: 0,
            savedPercentage: 0,
            success: false,
            error: err.toString()
          })
        }
      }
      
      return { success: true, results }
    } catch (error: any) {
      console.error('处理过程出错:', error)
      // 确保错误对象可以被序列化
      return { success: false, error: error.toString() }
    }
  })
  
  // 保存失败文件列表
  ipcMain.handle('save-failed-list', async (_, failedContent: string, outputDir: string) => {
    try {
      const failedFilePath = path.join(outputDir, 'failed_files.txt')
      fs.writeFileSync(failedFilePath, failedContent, 'utf8')
      return { success: true, path: failedFilePath }
    } catch (error: any) {
      console.error('保存失败文件列表出错:', error)
      return { success: false, error: error.toString() }
    }
  })
  
  // 选择输出目录
  ipcMain.handle('select-output-dir', async () => {
    if (!win) return { canceled: true }
    
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    
    if (result.canceled) return { canceled: true }
    
    return { 
      canceled: false, 
      outputDir: result.filePaths[0] 
    }
  })
})
