import { AssetManager, Asset } from '../../../../src/services/asset-manager/AssetManager';
import { IGraph, INode } from '../../../../src/core/types/node';

describe('AssetManager', () => {
  let assetManager: AssetManager;
  
  beforeEach(() => {
    assetManager = new AssetManager();
  });
  
  describe('audio context handling', () => {
    it('should allow setting the audio context', () => {
      const mockContext = {} as AudioContext;
      assetManager.setAudioContext(mockContext);
      
      // Implementation detail: we're testing that no error was thrown
      expect(true).toBe(true);
    });
  });
  
  describe('asset loading', () => {
    it('should throw an error when loading audio without an audio context', async () => {
      const mockFile = new File([''], 'audio.mp3', { type: 'audio/mp3' });
      
      await expect(assetManager.loadAudio(mockFile)).rejects.toThrow('Audio context not initialized');
    });
    
    it('should load audio files when audio context is set', async () => {
      // Setup mock audio context
      const mockDecodeAudioData = jest.fn().mockResolvedValue({
        duration: 60,
        sampleRate: 44100,
        numberOfChannels: 2
      });
      
      const mockContext = {
        decodeAudioData: mockDecodeAudioData
      } as unknown as AudioContext;
      
      assetManager.setAudioContext(mockContext);
      
      // Mock FileReader
      const mockFileReaderInstance = {
        readAsArrayBuffer: jest.fn(),
        onload: null as any,
        onerror: null as any
      };
      
      global.FileReader = jest.fn().mockImplementation(() => mockFileReaderInstance);
      
      // Mock file and its data
      const mockFile = new File(['mock-audio-data'], 'test-audio.mp3', { type: 'audio/mp3' });
      
      // Start the load process
      const loadPromise = assetManager.loadAudio(mockFile);
      
      // Simulate successful file read
      mockFileReaderInstance.onload({ target: { result: new ArrayBuffer(0) } });
      
      // Wait for resolution
      const asset = await loadPromise;
      
      // Verify asset was created correctly
      expect(asset).toBeDefined();
      expect(asset.type).toBe('audio');
      expect(asset.name).toBe('test-audio.mp3');
      expect(asset.metadata).toEqual({
        duration: 60,
        sampleRate: 44100,
        numberOfChannels: 2,
        size: mockFile.size
      });
      
      // Verify the asset was stored
      expect(assetManager.getAsset(asset.id)).toBe(asset);
    });
    
    it('should handle audio decoding errors', async () => {
      // Setup mock audio context that rejects
      const mockDecodeAudioData = jest.fn().mockRejectedValue(new Error('Decoding error'));
      
      const mockContext = {
        decodeAudioData: mockDecodeAudioData
      } as unknown as AudioContext;
      
      assetManager.setAudioContext(mockContext);
      
      // Mock FileReader
      const mockFileReaderInstance = {
        readAsArrayBuffer: jest.fn(),
        onload: null as any,
        onerror: null as any
      };
      
      global.FileReader = jest.fn().mockImplementation(() => mockFileReaderInstance);
      
      // Mock file and its data
      const mockFile = new File(['mock-audio-data'], 'test-audio.mp3', { type: 'audio/mp3' });
      
      // Start the load process
      const loadPromise = assetManager.loadAudio(mockFile);
      
      // Simulate successful file read but failed decoding
      mockFileReaderInstance.onload({ target: { result: new ArrayBuffer(0) } });
      
      // Expect promise to reject
      await expect(loadPromise).rejects.toThrow('Decoding error');
    });
    
    it('should load image files', async () => {
      // Mock Image
      const mockImageInstance = {
        src: '',
        onload: null as any,
        onerror: null as any,
        width: 800,
        height: 600
      };
      
      global.Image = jest.fn().mockImplementation(() => mockImageInstance);
      
      // Mock FileReader
      const mockFileReaderInstance = {
        readAsDataURL: jest.fn(),
        onload: null as any,
        onerror: null as any
      };
      
      global.FileReader = jest.fn().mockImplementation(() => mockFileReaderInstance);
      
      // Mock file and its data
      const mockFile = new File(['mock-image-data'], 'test-image.png', { type: 'image/png' });
      
      // Start the load process
      const loadPromise = assetManager.loadImage(mockFile);
      
      // Simulate successful file read
      mockFileReaderInstance.onload({ target: { result: 'data:image/png;base64,abc123' } });
      
      // Simulate successful image load
      mockImageInstance.onload();
      
      // Wait for resolution
      const asset = await loadPromise;
      
      // Verify asset was created correctly
      expect(asset).toBeDefined();
      expect(asset.type).toBe('image');
      expect(asset.name).toBe('test-image.png');
      expect(asset.metadata).toEqual({
        width: 800,
        height: 600,
        size: mockFile.size
      });
      
      // Verify the asset was stored
      expect(assetManager.getAsset(asset.id)).toBe(asset);
    });
    
    it('should handle image loading errors', async () => {
      // Mock Image
      const mockImageInstance = {
        src: '',
        onload: null as any,
        onerror: null as any
      };
      
      global.Image = jest.fn().mockImplementation(() => mockImageInstance);
      
      // Mock FileReader
      const mockFileReaderInstance = {
        readAsDataURL: jest.fn(),
        onload: null as any,
        onerror: null as any
      };
      
      global.FileReader = jest.fn().mockImplementation(() => mockFileReaderInstance);
      
      // Mock file and its data
      const mockFile = new File(['mock-image-data'], 'test-image.png', { type: 'image/png' });
      
      // Start the load process
      const loadPromise = assetManager.loadImage(mockFile);
      
      // Simulate successful file read but failed image load
      mockFileReaderInstance.onload({ target: { result: 'data:image/png;base64,abc123' } });
      mockImageInstance.onerror();
      
      // Expect promise to reject
      await expect(loadPromise).rejects.toThrow('Failed to load image');
    });
  });
  
  describe('asset management', () => {
    it('should update lastUsed timestamp when getting an asset', () => {
      // Create a mock asset
      const asset: Asset = {
        id: 'test-asset',
        type: 'other',
        name: 'Test Asset',
        data: { test: true },
        lastUsed: Date.now() - 10000 // 10 seconds ago
      };
      
      // Add it directly to the assets map
      (assetManager as any).assets.set('test-asset', asset);
      
      // Get the asset
      const retrievedAsset = assetManager.getAsset('test-asset');
      
      // Verify lastUsed was updated
      expect(retrievedAsset).toBeDefined();
      expect(retrievedAsset!.lastUsed).toBeGreaterThan(asset.lastUsed!);
    });
    
    it('should return undefined for non-existent assets', () => {
      const asset = assetManager.getAsset('non-existent');
      expect(asset).toBeUndefined();
    });
    
    it('should get all assets', () => {
      // Create mock assets
      const asset1: Asset = {
        id: 'asset1',
        type: 'image',
        name: 'Asset 1',
        data: {}
      };
      
      const asset2: Asset = {
        id: 'asset2',
        type: 'audio',
        name: 'Asset 2',
        data: {}
      };
      
      // Add directly to the assets map
      (assetManager as any).assets.set('asset1', asset1);
      (assetManager as any).assets.set('asset2', asset2);
      
      // Get all assets
      const assets = assetManager.getAllAssets();
      
      // Verify
      expect(assets.length).toBe(2);
      expect(assets).toContainEqual(asset1);
      expect(assets).toContainEqual(asset2);
    });
    
    it('should get assets by type', () => {
      // Create mock assets
      const asset1: Asset = {
        id: 'asset1',
        type: 'image',
        name: 'Asset 1',
        data: {}
      };
      
      const asset2: Asset = {
        id: 'asset2',
        type: 'audio',
        name: 'Asset 2',
        data: {}
      };
      
      const asset3: Asset = {
        id: 'asset3',
        type: 'image',
        name: 'Asset 3',
        data: {}
      };
      
      // Add directly to the assets map
      (assetManager as any).assets.set('asset1', asset1);
      (assetManager as any).assets.set('asset2', asset2);
      (assetManager as any).assets.set('asset3', asset3);
      
      // Get by type
      const imageAssets = assetManager.getAssetsByType('image');
      
      // Verify
      expect(imageAssets.length).toBe(2);
      expect(imageAssets).toContainEqual(asset1);
      expect(imageAssets).toContainEqual(asset3);
      expect(imageAssets).not.toContainEqual(asset2);
    });
    
    it('should remove an asset', () => {
      // Create a mock asset
      const asset: Asset = {
        id: 'test-asset',
        type: 'other',
        name: 'Test Asset',
        data: {}
      };
      
      // Add directly to the assets map
      (assetManager as any).assets.set('test-asset', asset);
      
      // Remove the asset
      const removed = assetManager.removeAsset('test-asset');
      
      // Verify
      expect(removed).toBe(true);
      expect(assetManager.getAsset('test-asset')).toBeUndefined();
    });
    
    it('should return false when removing a non-existent asset', () => {
      const removed = assetManager.removeAsset('non-existent');
      expect(removed).toBe(false);
    });
  });
  
  describe('asset cleanup', () => {
    let mockGraph: IGraph;
    
    beforeEach(() => {
      // Create a mock graph with some asset references
      mockGraph = {
        nodes: {
          'node1': {
            id: 'node1',
            type: 'audioNode',
            position: { x: 0, y: 0 },
            inputs: {},
            outputs: {},
            params: {
              audioSource: 'asset:audio1'
            },
            state: {},
            processed: false
          },
          'node2': {
            id: 'node2',
            type: 'imageNode',
            position: { x: 100, y: 0 },
            inputs: {},
            outputs: {},
            params: {},
            state: {
              image: 'asset:image1'
            },
            processed: false
          }
        },
        connections: {}
      };
      
      // Configure unused threshold to a smaller value for testing
      assetManager.setUnusedThreshold(100); // 100ms
    });
    
    it('should find assets in use in the graph', () => {
      // Create mock assets
      const audioAsset: Asset = {
        id: 'audio1',
        type: 'audio',
        name: 'Audio 1',
        data: {}
      };
      
      const imageAsset: Asset = {
        id: 'image1',
        type: 'image',
        name: 'Image 1',
        data: {}
      };
      
      const unusedAsset: Asset = {
        id: 'unused1',
        type: 'image',
        name: 'Unused 1',
        data: {}
      };
      
      // Add directly to the assets map
      (assetManager as any).assets.set('audio1', audioAsset);
      (assetManager as any).assets.set('image1', imageAsset);
      (assetManager as any).assets.set('unused1', unusedAsset);
      
      // Find assets in use (private method)
      const usedAssets = (assetManager as any).findAssetsInUse(mockGraph);
      
      // Verify
      expect(usedAssets.size).toBe(2);
      expect(usedAssets.has('audio1')).toBe(true);
      expect(usedAssets.has('image1')).toBe(true);
      expect(usedAssets.has('unused1')).toBe(false);
    });
    
    it('should clean up unused assets', () => {
      // Create mock assets with lastUsed timestamps
      const now = Date.now();
      
      // Used assets
      const audioAsset: Asset = {
        id: 'audio1',
        type: 'audio',
        name: 'Audio 1',
        data: {},
        lastUsed: now
      };
      
      const imageAsset: Asset = {
        id: 'image1',
        type: 'image',
        name: 'Image 1',
        data: {},
        lastUsed: now
      };
      
      // Unused assets with old timestamps
      const unusedAsset1: Asset = {
        id: 'unused1',
        type: 'image',
        name: 'Unused 1',
        data: {},
        lastUsed: now - 1000 // 1 second ago (older than the threshold)
      };
      
      const unusedAsset2: Asset = {
        id: 'unused2',
        type: 'audio',
        name: 'Unused 2',
        data: {},
        lastUsed: now - 500 // 500ms ago (older than the threshold)
      };
      
      // Unused asset with recent timestamp
      const recentUnusedAsset: Asset = {
        id: 'recent',
        type: 'image',
        name: 'Recent',
        data: {},
        lastUsed: now - 50 // 50ms ago (newer than the threshold)
      };
      
      // Add directly to the assets map
      (assetManager as any).assets.set('audio1', audioAsset);
      (assetManager as any).assets.set('image1', imageAsset);
      (assetManager as any).assets.set('unused1', unusedAsset1);
      (assetManager as any).assets.set('unused2', unusedAsset2);
      (assetManager as any).assets.set('recent', recentUnusedAsset);
      
      // Clean up unused assets
      const removedCount = assetManager.cleanUnusedAssets(mockGraph);
      
      // Verify
      expect(removedCount).toBe(2); // Only the two old unused assets should be removed
      
      // Used assets should still be there
      expect(assetManager.getAsset('audio1')).toBeDefined();
      expect(assetManager.getAsset('image1')).toBeDefined();
      
      // Unused old assets should be removed
      expect(assetManager.getAsset('unused1')).toBeUndefined();
      expect(assetManager.getAsset('unused2')).toBeUndefined();
      
      // Recent unused asset should still be there
      expect(assetManager.getAsset('recent')).toBeDefined();
    });
    
    it('should enforce a minimum threshold for unused assets', () => {
      // Try to set a very small threshold
      assetManager.setUnusedThreshold(1);
      
      // Should enforce a minimum of 5000ms (5 seconds)
      expect((assetManager as any).unusedThreshold).toBe(5000);
    });
  });
  
  describe('disposal', () => {
    it('should clear all assets when disposed', () => {
      // Add some assets
      const asset1: Asset = {
        id: 'asset1',
        type: 'image',
        name: 'Asset 1',
        data: {}
      };
      
      const asset2: Asset = {
        id: 'asset2',
        type: 'audio',
        name: 'Asset 2',
        data: {}
      };
      
      (assetManager as any).assets.set('asset1', asset1);
      (assetManager as any).assets.set('asset2', asset2);
      
      // Set audio context
      const mockContext = {} as AudioContext;
      assetManager.setAudioContext(mockContext);
      
      // Dispose
      assetManager.dispose();
      
      // Verify assets are cleared
      expect(assetManager.getAllAssets().length).toBe(0);
      
      // Verify audio context is cleared
      expect((assetManager as any).audioContext).toBeNull();
    });
  });
}); 