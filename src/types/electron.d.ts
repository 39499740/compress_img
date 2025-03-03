interface ImageFile {
  path: string;
  relativePath: string;
  name: string;
  size: number;
  extension: string;
  selected?: boolean;
}

interface CompressResult {
  original: string;
  compressed: string;
  originalSize: number;
  compressedSize: number;
  savedPercentage: number;
  success: boolean;
  message?: string;
  error?: string;
}

interface Window {
  ipcRenderer: {
    on(channel: string, listener: (...args: any[]) => void): void;
    off(channel: string, listener: (...args: any[]) => void): void;
    send(channel: string, ...args: any[]): void;
    invoke(channel: string, ...args: any[]): Promise<any>;
  };
  
  imageCompressor: {
    selectFolder: () => Promise<{ canceled: boolean; folderPath?: string }>;
    scanImages: (folderPath: string) => Promise<{ success: boolean; images?: ImageFile[]; error?: string }>;
    compressImages: (params: { images: ImageFile[]; quality: number; outputDir: string }) => Promise<{ success: boolean; results?: CompressResult[]; error?: string }>;
    selectOutputDir: () => Promise<{ canceled: boolean; outputDir?: string }>;
    saveFailedList: (failedContent: string, outputDir: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    onProgress: (callback: (progress: number) => void) => void;
    offProgress: () => void;
  };
} 