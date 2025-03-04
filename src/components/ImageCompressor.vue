<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

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

// 状态变量
const folderPath = ref<string>('')
const images = ref<ImageFile[]>([])
const isLoading = ref<boolean>(false)
const quality = ref<number>(80)
const compressStatus = ref<'idle' | 'compressing' | 'completed' | 'error'>('idle')
const compressResults = ref<CompressResult[]>([])
const errorMessage = ref<string>('')
const dropActive = ref<boolean>(false)
const outputDir = ref<string>('')
const processedCount = ref<number>(0)
const totalCount = ref<number>(0)
const failedCount = ref<number>(0)
const successCount = ref<number>(0)
const originalTotalSize = ref<number>(0)
const compressedTotalSize = ref<number>(0)

// 日期相关选项
const dateOption = ref<'preserve' | 'current' | 'custom'>('preserve')
const customDate = ref<string>(new Date().toISOString().split('T')[0]) // 默认为今天
const customTime = ref<string>(
  new Date().toTimeString().split(' ')[0].substring(0, 8)
) // 默认为当前时间 HH:MM:SS

// 计算属性
const selectedImages = computed(() => {
  return images.value.filter(img => img.selected)
})

const totalSize = computed(() => {
  return images.value.reduce((total, img) => total + img.size, 0)
})

const formattedSize = computed(() => {
  return formatFileSize(totalSize.value)
})

const selectedCount = computed(() => {
  return selectedImages.value.length
})

const progressPercentage = computed(() => {
  if (totalCount.value === 0) return 0
  return Math.round((processedCount.value / totalCount.value) * 100)
})

const savedSizePercentage = computed(() => {
  if (originalTotalSize.value === 0) return 0
  return ((originalTotalSize.value - compressedTotalSize.value) / originalTotalSize.value * 100).toFixed(2)
})

// 选择文件夹
async function selectFolder() {
  try {
    const result = await window.imageCompressor.selectFolder()
    if (!result.canceled && result.folderPath) {
      folderPath.value = result.folderPath
      await scanImages(result.folderPath)
    }
  } catch (error: any) {
    console.error('选择文件夹出错:', error)
    errorMessage.value = `选择文件夹出错: ${error.message || error}`
  }
}

// 扫描图片
async function scanImages(path: string) {
  try {
    isLoading.value = true
    errorMessage.value = ''
    
    const result = await window.imageCompressor.scanImages(path)
    
    if (result.success && result.images) {
      images.value = result.images.map(img => ({
        ...img,
        selected: true
      }))
      originalTotalSize.value = totalSize.value
    } else {
      errorMessage.value = result.error || '扫描图片失败'
    }
  } catch (error: any) {
    console.error('扫描图片出错:', error)
    errorMessage.value = `扫描图片出错: ${error.message || error}`
  } finally {
    isLoading.value = false
  }
}

// 选择全部图片
function selectAll() {
  images.value.forEach(img => img.selected = true)
}

// 取消选择全部图片
function deselectAll() {
  images.value.forEach(img => img.selected = false)
}

// 监听压缩进度
onMounted(() => {
  window.imageCompressor.onProgress((progress: number) => {
    processedCount.value = progress
  })
})

// 移除进度监听
onUnmounted(() => {
  window.imageCompressor.offProgress()
})

// 开始压缩
async function startCompression() {
  try {
    // 选择输出目录
    const dirResult = await window.imageCompressor.selectOutputDir()
    if (dirResult.canceled || !dirResult.outputDir) {
      return
    }
    
    outputDir.value = dirResult.outputDir
    compressStatus.value = 'compressing'
    errorMessage.value = ''
    processedCount.value = 0
    failedCount.value = 0
    successCount.value = 0
    compressedTotalSize.value = 0
    
    // 创建一个简化版的图片对象数组，只包含必要的属性
    const imagesToCompress = selectedImages.value.map(img => ({
      path: img.path,
      relativePath: img.relativePath,
      name: img.name,
      size: img.size,
      extension: img.extension
    }))
    
    if (imagesToCompress.length === 0) {
      errorMessage.value = '请选择至少一张图片进行压缩'
      compressStatus.value = 'error'
      return
    }
    
    totalCount.value = imagesToCompress.length
    
    // 准备日期选项
    let dateToUse: string | null = null;
    if (dateOption.value === 'current') {
      dateToUse = new Date().toISOString();
    } else if (dateOption.value === 'custom' && customDate.value) {
      // 将日期和时间字符串组合并转换为 ISO 格式
      const dateTimeStr = `${customDate.value}T${customTime.value}`;
      dateToUse = new Date(dateTimeStr).toISOString();
    }
    
    const result = await window.imageCompressor.compressImages({
      images: imagesToCompress,
      quality: quality.value,
      outputDir: outputDir.value,
      dateOption: dateOption.value,
      customDate: dateToUse
    })
    
    if (result.success && result.results) {
      compressResults.value = result.results
      
      // 计算成功和失败的数量
      successCount.value = result.results.filter(r => r.success).length
      failedCount.value = result.results.filter(r => !r.success).length
      
      // 计算压缩后的总大小
      compressedTotalSize.value = result.results.reduce((total, r) => {
        return total + (r.success ? r.compressedSize : 0)
      }, 0)
      
      // 导出失败文件列表
      if (failedCount.value > 0) {
        const failedFiles = result.results
          .filter(r => !r.success)
          .map(r => `${r.original} - 错误: ${r.error || '未知错误'}`)
          .join('\n')
        
        await window.imageCompressor.saveFailedList(failedFiles, outputDir.value)
      }
      
      compressStatus.value = 'completed'
    } else {
      errorMessage.value = result.error || '压缩图片失败'
      compressStatus.value = 'error'
    }
  } catch (error: any) {
    console.error('压缩图片出错:', error)
    // 确保错误信息是字符串
    errorMessage.value = `压缩图片出错: ${error.toString()}`
    compressStatus.value = 'error'
  }
}

// 重置状态
function reset() {
  folderPath.value = ''
  images.value = []
  compressStatus.value = 'idle'
  compressResults.value = []
  errorMessage.value = ''
  outputDir.value = ''
  processedCount.value = 0
  totalCount.value = 0
  failedCount.value = 0
  successCount.value = 0
  originalTotalSize.value = 0
  compressedTotalSize.value = 0
}

// 处理拖放
function handleDragOver(event: DragEvent) {
  event.preventDefault()
  dropActive.value = true
}

function handleDragLeave() {
  dropActive.value = false
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  dropActive.value = false
  
  if (!event.dataTransfer) return
  
  const items = event.dataTransfer.items
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry()
      
      if (entry && entry.isDirectory) {
        // 获取文件系统目录路径
        const file = event.dataTransfer.files[i]
        folderPath.value = file.path
        await scanImages(file.path)
        break
      }
    }
  }
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

// 声明全局接口
declare global {
  interface Window {
    imageCompressor: {
      selectFolder: () => Promise<{ canceled: boolean; folderPath?: string }>
      scanImages: (folderPath: string) => Promise<{ success: boolean; images?: ImageFile[]; error?: string }>
      compressImages: (params: { images: ImageFile[]; quality: number; outputDir: string }) => Promise<{ success: boolean; results?: CompressResult[]; error?: string }>
      selectOutputDir: () => Promise<{ canceled: boolean; outputDir?: string }>
      saveFailedList: (failedContent: string, outputDir: string) => Promise<{ success: boolean; path?: string; error?: string }>
      onProgress: (callback: (progress: number) => void) => void
      offProgress: () => void
    }
  }
}
</script>

<template>
  <div 
    class="image-compressor"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    :class="{ 'drop-active': dropActive }"
  >
    <div v-if="!folderPath" class="drop-area">
      <div class="drop-message">
        <h2>拖放文件夹到此处</h2>
        <p>或者</p>
        <button @click="selectFolder" class="select-btn">选择文件夹</button>
      </div>
    </div>
    
    <div v-else class="compressor-container">
      <div class="header">
        <h2>图片压缩</h2>
        <div class="folder-info">
          <span>文件夹: {{ folderPath }}</span>
          <button @click="reset" class="reset-btn">重置</button>
        </div>
      </div>
      
      <div v-if="isLoading" class="loading">
        <p>正在扫描图片...</p>
      </div>
      
      <div v-else-if="errorMessage" class="error">
        <p>{{ errorMessage }}</p>
      </div>
      
      <div v-else-if="images.length === 0" class="no-images">
        <p>未找到图片文件</p>
      </div>
      
      <div v-else class="content">
        <div class="controls">
          <div class="selection-controls">
            <button @click="selectAll" class="control-btn">全选</button>
            <button @click="deselectAll" class="control-btn">取消全选</button>
            <div class="stats">
              <div class="stat-item">
                <span>图片总数: {{ images.length }}</span>
              </div>
              <div class="stat-item">
                <span>已选择: {{ selectedCount }}</span>
              </div>
              <div class="stat-item">
                <span>总大小: {{ formattedSize }}</span>
              </div>
            </div>
          </div>
          
          <div class="quality-control">
            <label for="quality">压缩质量: {{ quality }}%</label>
            <input 
              type="range" 
              id="quality" 
              v-model="quality" 
              min="1" 
              max="100" 
              :disabled="compressStatus === 'compressing'"
            />
          </div>
          
          <div class="date-control">
            <div class="date-option-title">文件创建日期:</div>
            <div class="date-options">
              <div class="date-option">
                <input 
                  type="radio" 
                  id="preserve-date" 
                  value="preserve" 
                  v-model="dateOption"
                  :disabled="compressStatus === 'compressing'"
                />
                <label for="preserve-date">保留原始日期</label>
              </div>
              
              <div class="date-option">
                <input 
                  type="radio" 
                  id="current-date" 
                  value="current" 
                  v-model="dateOption"
                  :disabled="compressStatus === 'compressing'"
                />
                <label for="current-date">使用当前日期</label>
              </div>
              
              <div class="date-option">
                <input 
                  type="radio" 
                  id="custom-date" 
                  value="custom" 
                  v-model="dateOption"
                  :disabled="compressStatus === 'compressing'"
                />
                <label for="custom-date">自定义日期:</label>
                <div class="date-time-inputs">
                  <input 
                    type="date" 
                    v-model="customDate" 
                    :disabled="dateOption !== 'custom' || compressStatus === 'compressing'"
                  />
                  <input 
                    type="time" 
                    v-model="customTime" 
                    step="1"
                    :disabled="dateOption !== 'custom' || compressStatus === 'compressing'"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <button 
            @click="startCompression" 
            class="compress-btn"
            :disabled="compressStatus === 'compressing' || selectedCount === 0"
          >
            {{ compressStatus === 'compressing' ? '压缩中...' : '开始压缩' }}
          </button>
        </div>
        
        <div v-if="compressStatus === 'compressing'" class="progress-container">
          <div class="progress-info">
            <span>处理进度: {{ processedCount }} / {{ totalCount }}</span>
            <span>{{ progressPercentage }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${progressPercentage}%` }"></div>
          </div>
        </div>
        
        <div v-if="compressStatus === 'completed'" class="results">
          <h3>压缩完成!</h3>
          <p>已将压缩后的图片保存到: {{ outputDir }}</p>
          
          <div class="summary">
            <div class="summary-item">
              <div class="summary-label">总图片数</div>
              <div class="summary-value">{{ totalCount }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">成功</div>
              <div class="summary-value success">{{ successCount }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">失败</div>
              <div class="summary-value" :class="{ 'error': failedCount > 0 }">{{ failedCount }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">原始大小</div>
              <div class="summary-value">{{ formatFileSize(originalTotalSize) }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">压缩后大小</div>
              <div class="summary-value">{{ formatFileSize(compressedTotalSize) }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">节省空间</div>
              <div class="summary-value saved-space">{{ savedSizePercentage }}%</div>
            </div>
          </div>
          
          <div v-if="failedCount > 0" class="failed-notice">
            <p>有 {{ failedCount }} 个文件压缩失败，失败列表已保存到 {{ outputDir }}/failed_files.txt</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-compressor {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
  box-sizing: border-box;
}

.drop-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px dashed #ccc;
  border-radius: 10px;
  background-color: #f9f9f9;
  transition: all 0.3s;
}

.drop-active {
  border-color: #4caf50;
  background-color: rgba(76, 175, 80, 0.1);
}

.drop-message {
  text-align: center;
}

.select-btn {
  padding: 10px 20px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  margin-top: 10px;
}

.select-btn:hover {
  background-color: #45a049;
}

.compressor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header {
  margin-bottom: 20px;
}

.folder-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.reset-btn {
  padding: 5px 10px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.reset-btn:hover {
  background-color: #d32f2f;
}

.loading, .error, .no-images {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error {
  color: #f44336;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.controls {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 5px;
}

.selection-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-left: auto;
}

.stat-item {
  background-color: #e0e0e0;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 0.9em;
}

.control-btn {
  padding: 5px 10px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.control-btn:hover {
  background-color: #0b7dda;
}

.quality-control {
  margin-bottom: 15px;
}

.quality-control input {
  width: 100%;
  margin-top: 5px;
}

.date-control {
  margin: 15px 0;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 5px;
  background-color: #f9f9f9;
}

.date-option-title {
  font-size: 0.9em;
  font-weight: bold;
  color: #555;
  margin-bottom: 10px;
}

.date-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.date-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-option input[type="radio"] {
  margin: 0;
}

.date-time-inputs {
  display: flex;
  gap: 5px;
  align-items: center;
}

.date-option input[type="date"],
.date-option input[type="time"] {
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.date-option input[type="date"]:disabled,
.date-option input[type="time"]:disabled {
  background-color: #f0f0f0;
  color: #999;
}

.compress-btn {
  padding: 10px 20px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  width: 100%;
}

.compress-btn:hover:not(:disabled) {
  background-color: #45a049;
}

.compress-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.progress-container {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 5px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.progress-bar {
  height: 20px;
  background-color: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #4caf50;
  transition: width 0.3s ease;
}

.results {
  margin-top: 20px;
  padding: 15px;
  background-color: #e8f5e9;
  border-radius: 5px;
}

.results h3 {
  margin-top: 0;
  color: #2e7d32;
}

.summary {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 15px;
  margin-top: 20px;
  width: 100%;
}

.summary-item {
  background-color: white;
  padding: 15px;
  border-radius: 5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.summary-label {
  font-size: 0.9em;
  color: #666;
  margin-bottom: 5px;
}

.summary-value {
  font-size: 1.2em;
  font-weight: bold;
}

.success {
  color: #2e7d32;
}

.saved-space {
  color: #2e7d32;
}

.error {
  color: #f44336;
}

.failed-notice {
  margin-top: 20px;
  padding: 10px;
  background-color: #ffebee;
  border-left: 4px solid #f44336;
  border-radius: 4px;
}
</style> 