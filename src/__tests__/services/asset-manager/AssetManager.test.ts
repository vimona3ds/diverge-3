import { AssetManager, Asset } from '../../../services/asset-manager/AssetManager';
import { IGraph } from '../../../core/types/node';

// Patch for the tests using FileReader
declare global {
  interface FileReader {
    // Use the same type as the DOM definition for consistency with readonly modifier
    readonly error: DOMException | null;
  }
}

// Create constants for the FileReader static properties
const READER_STATES = {
  EMPTY: 0,
  LOADING: 1,
  DONE: 2
} as const;

// Skip TypeScript errors for testing purposes
// @ts-ignore
class MockFileReader {
  static readonly EMPTY = 0;
  static readonly LOADING = 1;
  static readonly DONE = 2;
  
  readAsArrayBuffer: jest.Mock;
  readAsText: jest.Mock;
  readAsBinaryString: jest.Mock;
  readAsDataURL: jest.Mock;
  abort: jest.Mock;
  result: any = null;
  readyState: 0 | 1 | 2 = 0;
  
  onload: ((evt: ProgressEvent<FileReader>) => any) | null = null;
  onerror: ((evt: ProgressEvent<FileReader>) => any) | null = null;
  onloadend: ((evt: ProgressEvent<FileReader>) => any) | null = null;
  onloadstart: ((evt: ProgressEvent<FileReader>) => any) | null = null;
  onprogress: ((evt: ProgressEvent<FileReader>) => any) | null = null;
  onabort: ((evt: ProgressEvent<FileReader>) => any) | null = null;
  
  error: DOMException | null = null;
  
  constructor() {
    this.readAsArrayBuffer = jest.fn((blob: Blob) => {
      setTimeout(() => {
        this.result = new ArrayBuffer(0);
        this.readyState = 2;
        // Create event without target property in constructor
        const event = new ProgressEvent('load');
        // Then manually set the target afterward
        Object.defineProperty(event, 'target', { value: this });
        if (this.onload) this.onload(event as ProgressEvent<FileReader>);
      }, 0);
    });
    
    this.readAsText = jest.fn((blob: Blob) => {
      setTimeout(() => {
        this.result = '';
        this.readyState = 2;
        // Create event without target property in constructor
        const event = new ProgressEvent('load');
        // Then manually set the target afterward
        Object.defineProperty(event, 'target', { value: this });
        if (this.onload) this.onload(event as ProgressEvent<FileReader>);
      }, 0);
    });
    
    this.readAsBinaryString = jest.fn();
    this.readAsDataURL = jest.fn();
    this.abort = jest.fn();
  }
}

describe('AssetManager', () => {
  let assetManager: AssetManager;
  let originalFileReader: typeof FileReader;
  
  beforeEach(() => {
    // Save original FileReader
    originalFileReader = global.FileReader;
    
    // Replace global FileReader with the mock
    // @ts-ignore - TypeScript complains but this works for testing
    global.FileReader = MockFileReader;
    
    assetManager = new AssetManager();
  });
  
  afterEach(() => {
    // Restore original FileReader
    global.FileReader = originalFileReader;
    jest.restoreAllMocks();
  });
  
  describe('asset loading', () => {
    it('should load text assets', async () => {
      const mockFile = new Blob(['test content'], { type: 'text/plain' });
      const result = await assetManager.loadAsset('test.txt', mockFile);
      
      expect(result).toBeDefined();
      expect(result.type).toBe('text');
      expect(result.data).toBeDefined();
    });
    
    it('should load binary assets', async () => {
      const mockFile = new Blob([new ArrayBuffer(8)], { type: 'application/octet-stream' });
      const result = await assetManager.loadAsset('test.bin', mockFile);
      
      expect(result).toBeDefined();
      expect(result.type).toBe('binary');
      expect(result.data).toBeDefined();
    });
    
    it('should handle load errors', async () => {
      const mockFile = new Blob([''], { type: 'text/plain' });
      
      // Mock the FileReader to simulate an error
      const mockFileReader = {
        readAsText: jest.fn().mockImplementation(function(this: any, blob: Blob) {
          setTimeout(() => {
            // Create and dispatch error event
            this.error = new DOMException('Mock error', 'NotReadableError');
            if (this.onerror) {
              const event = new ProgressEvent('error');
              Object.defineProperty(event, 'target', { value: this });
              this.onerror(event);
            }
          }, 0);
        }),
        addEventListener: jest.fn((type: string, handler: EventListener) => {
          if (type === 'error') {
            mockFileReader.onerror = handler;
          } else if (type === 'load') {
            mockFileReader.onload = handler;
          }
        }),
        onerror: null as ((event: Event) => void) | null,
        onload: null as ((event: Event) => void) | null
      };
      
      // Replace the global FileReader constructor
      const originalFileReader = global.FileReader;
      global.FileReader = jest.fn(() => mockFileReader) as any;
      
      // The loadAsset should reject with an error
      await expect(assetManager.loadAsset('test.txt', mockFile)).rejects.toThrow();
      
      // Restore the original FileReader
      global.FileReader = originalFileReader;
    });
  });
  
  describe('asset management', () => {
    it('should track loaded assets', async () => {
      const mockFile = new Blob(['test'], { type: 'text/plain' });
      const asset = await assetManager.loadAsset('test.txt', mockFile);
      
      expect(assetManager.getAssetByPath('test.txt')).toBeDefined();
    });
    
    it('should clean up unused assets', () => {
      // Create a mock asset and manually add it to the asset manager
      const mockAsset: Asset = { 
        id: 'test-id', 
        type: 'text', 
        name: 'unused.txt', 
        data: 'test', 
        lastUsed: Date.now() - 120000 // Set as used 2 minutes ago
      };
      
      // Add the asset to the manager's private assets map
      (assetManager as any).assets.set(mockAsset.id, mockAsset);
      (assetManager as any).assetPaths.set('unused.txt', mockAsset.id);
      
      // Create a mock graph with no assets referenced
      const mockGraph: IGraph = { nodes: {}, connections: {} };
      
      // Run cleanup
      assetManager.cleanUnusedAssets(mockGraph);
      
      // The asset should be removed
      expect(assetManager.getAssetByPath('unused.txt')).toBeUndefined();
    });
  });
  
  describe('audio context handling', () => {
    it('should set audio context', () => {
      const mockContext = {} as AudioContext;
      assetManager.setAudioContext(mockContext);
      expect((assetManager as any).audioContext).toBe(mockContext);
    });
  });
}); 