import { AssetManager } from '../../../../src/services/asset-manager/AssetManager';
import { IGraph, INode } from '../../../../src/core/types/node';

describe('AssetManager', () => {
  let assetManager: AssetManager;
  let originalFileReader: typeof FileReader;
  
  beforeEach(() => {
    // Save original FileReader
    originalFileReader = global.FileReader;
    
    // Mock FileReader implementation
    const mockImplementation = function(this: any) {
      this.readAsArrayBuffer = jest.fn().mockImplementation((blob: Blob) => {
        setTimeout(() => {
          this.result = new ArrayBuffer(0);
          this.readyState = mockImplementation.DONE;
          if (this.onload) this.onload(null as any);
        }, 0);
      });
      
      this.readAsText = jest.fn().mockImplementation((blob: Blob) => {
        setTimeout(() => {
          this.result = '';
          this.readyState = mockImplementation.DONE;
          if (this.onload) this.onload(null as any);
        }, 0);
      });
      
      this.abort = jest.fn();
      this.result = null;
      this.error = null;
      this.onload = null;
      this.onerror = null;
      this.readyState = mockImplementation.EMPTY;
      
      return this;
    };
    
    // Add static properties
    Object.defineProperties(mockImplementation, {
      EMPTY: { value: 0 },
      LOADING: { value: 1 },
      DONE: { value: 2 }
    });
    
    // Replace global FileReader
    global.FileReader = mockImplementation as unknown as typeof FileReader;
    
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
      expect(result.data).toBe('');
    });
    
    it('should load binary assets', async () => {
      const mockFile = new Blob([new ArrayBuffer(8)], { type: 'application/octet-stream' });
      const result = await assetManager.loadAsset('test.bin', mockFile);
      
      expect(result).toBeDefined();
      expect(result.type).toBe('binary');
      expect(result.data instanceof ArrayBuffer).toBe(true);
    });
    
    it('should handle load errors', async () => {
      const mockFile = new Blob([''], { type: 'text/plain' });
      
      // Mock FileReader to simulate error
      const mockFileReader = new FileReader();
      setTimeout(() => {
        mockFileReader.error = new Error('Mock error');
        if (mockFileReader.onerror) mockFileReader.onerror(null as any);
      }, 0);
      
      await expect(assetManager.loadAsset('test.txt', mockFile)).rejects.toThrow();
    });
  });
  
  describe('asset management', () => {
    it('should track loaded assets', async () => {
      const mockFile = new Blob(['test'], { type: 'text/plain' });
      const asset = await assetManager.loadAsset('test.txt', mockFile);
      
      expect(assetManager.getAssetByPath('test.txt')).toBe(asset);
    });
    
    it('should clean up unused assets', () => {
      const mockAsset = { type: 'text', data: 'test' };
      (assetManager as any).assets.set('unused.txt', mockAsset);
      
      assetManager.cleanUnusedAssets({ nodes: {}, connections: {} });
      
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