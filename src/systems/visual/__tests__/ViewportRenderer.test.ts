import * as THREE from 'three';
import { ViewportRenderer } from '../ViewportRenderer';

// Mock THREE.js WebGLRenderer
jest.mock('three', () => {
  const originalModule = jest.requireActual('three');
  
  return {
    ...originalModule,
    WebGLRenderer: jest.fn().mockImplementation(() => ({
      setSize: jest.fn(),
      setPixelRatio: jest.fn(),
      domElement: document.createElement('canvas'),
      render: jest.fn(),
      dispose: jest.fn(),
      setAnimationLoop: jest.fn(),
      setClearColor: jest.fn(),
      clear: jest.fn()
    }))
  };
});

describe('ViewportRenderer', () => {
  let container: HTMLDivElement;
  let renderer: ViewportRenderer;
  
  beforeEach(() => {
    // Create a container element
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create a renderer instance
    renderer = new ViewportRenderer();
    
    // Clear mocks
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up
    if (renderer) {
      renderer.dispose();
    }
    
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  test('should create a ViewportRenderer instance', () => {
    // TODO: Implement test that verifies the creation of the renderer instance
    expect(renderer).toBeInstanceOf(ViewportRenderer);
  });
  
  test('should attach renderer to container element', () => {
    // TODO: Implement test that verifies the attach method
    // works correctly by adding the THREE.WebGLRenderer's 
    // domElement to the container
    renderer.attach(container);
    
    expect(container.children.length).toBe(1);
    expect(container.children[0]).toBe((renderer as any).renderer.domElement);
    expect((renderer as any).attached).toBe(true);
  });
  
  test('should detach renderer from container element', () => {
    // TODO: Implement test that verifies the detach method correctly
    // removes the renderer's domElement from the container
    renderer.attach(container);
    renderer.detach();
    
    expect(container.children.length).toBe(0);
    expect((renderer as any).attached).toBe(false);
  });
  
  test('should set content by technique id', () => {
    // TODO: Implement test that verifies setting content by technique ID
    const mockTechnique = {
      id: 'test-technique',
      createMaterial: jest.fn().mockReturnValue({}),
      getUniformUpdaters: jest.fn().mockReturnValue({})
    };
    
    (renderer as any).techniqueRegistry = {
      getTechniqueById: jest.fn().mockReturnValue(mockTechnique)
    };
    
    renderer.setContentByTechniqueId('test-technique', {});
    
    expect((renderer as any).techniqueRegistry.getTechniqueById).toHaveBeenCalledWith('test-technique');
    expect(mockTechnique.createMaterial).toHaveBeenCalled();
    expect((renderer as any).currentTechnique).toBe(mockTechnique);
  });
  
  test('should handle resize events', () => {
    // TODO: Implement test that verifies the resize method correctly
    // updates the renderer size based on the container dimensions
    const width = 800;
    const height = 600;
    
    // Mock getBoundingClientRect
    container.getBoundingClientRect = jest.fn().mockReturnValue({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height
    });
    
    renderer.attach(container);
    renderer.resize();
    
    expect((renderer as any).renderer.setSize).toHaveBeenCalledWith(width, height, false);
  });
  
  test('should start and stop rendering loop', () => {
    // TODO: Implement test that verifies the startRenderLoop and
    // stopRenderLoop methods work correctly
    renderer.startRenderLoop();
    
    expect((renderer as any).renderer.setAnimationLoop).toHaveBeenCalled();
    
    renderer.stopRenderLoop();
    
    expect((renderer as any).renderer.setAnimationLoop).toHaveBeenCalledWith(null);
  });
  
  test('should render a frame', () => {
    // TODO: Implement test that verifies the render method
    // correctly renders a frame with the current technique
    const mockTechnique = {
      id: 'test-technique',
      render: jest.fn(),
      getUniformUpdaters: jest.fn().mockReturnValue({})
    };
    
    (renderer as any).currentTechnique = mockTechnique;
    (renderer as any).renderer = {
      render: jest.fn(),
      domElement: document.createElement('canvas'),
      setAnimationLoop: jest.fn()
    };
    
    renderer.render(1000);
    
    expect(mockTechnique.render).toHaveBeenCalled();
  });
  
  test('should update uniforms based on time', () => {
    // TODO: Implement test that verifies uniform updaters 
    // are called with the correct time values
    const mockUpdater = jest.fn();
    
    (renderer as any).uniformUpdaters = {
      'test-uniform': mockUpdater
    };
    
    const time = 1000;
    (renderer as any).lastFrameTime = 900;
    renderer.render(time);
    
    expect(mockUpdater).toHaveBeenCalledWith(time, 100);
  });
  
  test('should dispose resources correctly', () => {
    // TODO: Implement test that verifies dispose method
    // correctly cleans up all resources
    const mockTechnique = {
      id: 'test-technique',
      dispose: jest.fn()
    };
    
    (renderer as any).currentTechnique = mockTechnique;
    (renderer as any).renderer = {
      dispose: jest.fn(),
      setAnimationLoop: jest.fn()
    };
    
    renderer.dispose();
    
    expect(mockTechnique.dispose).toHaveBeenCalled();
    expect((renderer as any).renderer.dispose).toHaveBeenCalled();
    expect((renderer as any).renderer.setAnimationLoop).toHaveBeenCalledWith(null);
    expect((renderer as any).renderer).toBeNull();
    expect((renderer as any).currentTechnique).toBeNull();
  });
}); 