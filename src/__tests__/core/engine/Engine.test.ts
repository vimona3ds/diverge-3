import { Engine, RecoveryStrategy } from '../../../../src/core/engine/Engine';
import { IGraph, ProcessContext } from '../../../../src/core/types/node';
import { ErrorHandler } from '../../../../src/core/utils/ErrorHandler';
import { MemoryMonitor } from '../../../../src/core/utils/MemoryMonitor';
import { Profiler } from '../../../../src/core/utils/Profiler';

// Mock dependencies
jest.mock('../../../../src/core/utils/ErrorHandler', () => ({
  ErrorHandler: {
    getInstance: jest.fn().mockReturnValue({
      addListener: jest.fn(),
      report: jest.fn(),
      removeAllListeners: jest.fn()
    })
  }
}));

jest.mock('../../../../src/core/utils/MemoryMonitor', () => ({
  MemoryMonitor: {
    getInstance: jest.fn().mockReturnValue({
      addListener: jest.fn(),
      removeAllListeners: jest.fn(),
      check: jest.fn(),
      enable: jest.fn(),
      disable: jest.fn()
    })
  }
}));

jest.mock('../../../../src/core/utils/Profiler', () => ({
  Profiler: {
    getInstance: jest.fn().mockReturnValue({
      start: jest.fn(),
      end: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({}),
      enable: jest.fn(),
      disable: jest.fn()
    })
  }
}));

jest.mock('../../../../src/services/asset-manager/AssetManager', () => {
  return {
    AssetManager: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue({}),
      setAudioContext: jest.fn(),
      getAssetByPath: jest.fn(),
      loadAsset: jest.fn(),
      cleanUnusedAssets: jest.fn(),
      dispose: jest.fn().mockResolvedValue({})
    }))
  };
});

jest.mock('../../../../src/services/scheduler/Scheduler', () => {
  return {
    Scheduler: jest.fn().mockImplementation(() => ({
      initialize: jest.fn(),
      schedule: jest.fn(),
      update: jest.fn(),
      dispose: jest.fn()
    }))
  };
});

jest.mock('../../../../src/core/engine/NodeProcessor', () => {
  return {
    NodeProcessor: jest.fn().mockImplementation(() => ({
      setGraph: jest.fn(),
      process: jest.fn()
    }))
  };
});

jest.mock('../../../../src/systems/visual/VisualSystem', () => {
  return {
    VisualSystem: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue({}),
      render: jest.fn(),
      cleanResourcePools: jest.fn(),
      dispose: jest.fn().mockResolvedValue({})
    }))
  };
});

jest.mock('../../../../src/systems/audio/AudioSystem', () => {
  return {
    AudioSystem: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue({}),
      update: jest.fn(),
      getContext: jest.fn().mockReturnValue({}),
      dispose: jest.fn().mockResolvedValue({})
    }))
  };
});

describe('Engine', () => {
  let engine: Engine;
  
  beforeEach(() => {
    jest.clearAllMocks();
    engine = new Engine();
    // Prevent requestAnimationFrame from running
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      return 0;
    });
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('initialization', () => {
    it('should initialize all systems properly', async () => {
      await engine.initialize();
      
      // The initialize method should be called for each system
      const visualSystem = (engine as any).visualSystem;
      const audioSystem = (engine as any).audioSystem;
      const assetManager = (engine as any).assetManager;
      const scheduler = (engine as any).scheduler;
      
      expect(visualSystem.initialize).toHaveBeenCalled();
      expect(audioSystem.initialize).toHaveBeenCalled();
      expect(assetManager.initialize).toHaveBeenCalled();
      expect(scheduler.initialize).toHaveBeenCalled();
      
      // Profiler should be used to measure initialization time
      expect(Profiler.getInstance().start).toHaveBeenCalledWith('engine-initialization');
      expect(Profiler.getInstance().end).toHaveBeenCalledWith('engine-initialization');
    });
    
    it('should not re-initialize if already initialized', async () => {
      await engine.initialize();
      
      // Clear the mocks to check if they're called again
      jest.clearAllMocks();
      
      await engine.initialize();
      
      const visualSystem = (engine as any).visualSystem;
      expect(visualSystem.initialize).not.toHaveBeenCalled();
    });
  });
  
  describe('graph management', () => {
    it('should set and retrieve the graph correctly', () => {
      const mockGraph: IGraph = {
        nodes: { 'node1': { id: 'node1', type: 'test', position: { x: 0, y: 0 }, inputs: {}, outputs: {}, params: {}, state: {}, processed: false } },
        connections: {}
      };
      
      engine.setGraph(mockGraph);
      const retrievedGraph = engine.getGraph();
      
      expect(retrievedGraph).toEqual(mockGraph);
      
      // NodeProcessor should receive the graph
      const nodeProcessor = (engine as any).nodeProcessor;
      expect(nodeProcessor.setGraph).toHaveBeenCalledWith(mockGraph);
    });
  });
  
  describe('error recovery', () => {
    it('should apply error recovery configuration correctly', () => {
      const config = {
        maxRetries: 5,
        nodeProcessingErrors: RecoveryStrategy.RETRY,
        visualSystemErrors: RecoveryStrategy.RESET,
        audioSystemErrors: RecoveryStrategy.CONTINUE
      };
      
      engine.setErrorRecoveryConfig(config);
      
      // Check internal state reflects the config
      expect((engine as any).recoveryConfig.maxRetries).toBe(5);
      expect((engine as any).recoveryConfig.nodeProcessingErrors).toBe(RecoveryStrategy.RETRY);
      expect((engine as any).recoveryConfig.visualSystemErrors).toBe(RecoveryStrategy.RESET);
      expect((engine as any).recoveryConfig.audioSystemErrors).toBe(RecoveryStrategy.CONTINUE);
    });
  });
  
  describe('lifecycle management', () => {
    it('should start and stop properly', () => {
      engine.start();
      expect((engine as any).running).toBe(true);
      expect(window.requestAnimationFrame).toHaveBeenCalled();
      
      engine.stop();
      expect((engine as any).running).toBe(false);
    });
    
    it('should clean up resources when disposed', async () => {
      await engine.dispose();
      
      const visualSystem = (engine as any).visualSystem;
      const audioSystem = (engine as any).audioSystem;
      const assetManager = (engine as any).assetManager;
      const errorHandler = ErrorHandler.getInstance();
      const memoryMonitor = MemoryMonitor.getInstance();
      
      expect(visualSystem.dispose).toHaveBeenCalled();
      expect(audioSystem.dispose).toHaveBeenCalled();
      expect(assetManager.dispose).toHaveBeenCalled();
      expect(errorHandler.removeAllListeners).toHaveBeenCalled();
      expect(memoryMonitor.removeAllListeners).toHaveBeenCalled();
      expect((engine as any).running).toBe(false);
    });
  });
  
  describe('update cycle', () => {
    it('should update all systems during the update cycle', () => {
      // Manually trigger an update
      const time = 1000;
      (engine as any).update(time);
      
      const nodeProcessor = (engine as any).nodeProcessor;
      const visualSystem = (engine as any).visualSystem;
      const audioSystem = (engine as any).audioSystem;
      const scheduler = (engine as any).scheduler;
      const profiler = Profiler.getInstance();
      
      // Check that all required components are updated
      expect(profiler.start).toHaveBeenCalledWith('frame-total');
      expect(nodeProcessor.process).toHaveBeenCalled();
      expect(visualSystem.render).toHaveBeenCalled();
      expect(audioSystem.update).toHaveBeenCalled();
      expect(scheduler.update).toHaveBeenCalled();
      expect(profiler.end).toHaveBeenCalledWith('frame-total');
    });
    
    it('should handle errors during update without crashing', () => {
      const nodeProcessor = (engine as any).nodeProcessor;
      nodeProcessor.process.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // This should not throw
      (engine as any).update(1000);
      
      // Error handler should be called
      const errorHandler = ErrorHandler.getInstance();
      expect(errorHandler.report).toHaveBeenCalled();
    });
  });
  
  describe('performance monitoring', () => {
    it('should return performance metrics', () => {
      const metrics = engine.getPerformanceMetrics();
      expect(Profiler.getInstance().getMetrics).toHaveBeenCalled();
      expect(metrics).toBeDefined();
    });
  });
}); 