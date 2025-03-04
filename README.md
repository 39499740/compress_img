# 图片压缩工具

一个简单易用的图片压缩工具，基于 Electron 和 Vue 开发。

## 功能特点

- 支持文件夹拖放，快速导入图片
- 支持批量压缩图片
- 可调节压缩质量
- 保持原始文件夹结构
- 显示压缩进度和结果统计
- 导出失败文件列表

## 使用方法

1. 启动应用程序
2. 拖放文件夹到应用程序窗口，或点击"选择文件夹"按钮
3. 调整压缩质量（默认为 80%）
4. 点击"开始压缩"按钮
5. 选择输出目录
6. 等待压缩完成，查看结果统计

## 开发

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建应用程序

#### macOS

```bash
npm run build
```

#### Windows

```bash
npm run build:win
```

## 技术栈

- Electron
- Vue 3
- TypeScript


## 许可证

MIT
