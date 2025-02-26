import * as THREE from 'three';
import { ViewportRenderer } from '../ViewportRenderer';
import { Renderer } from '../Renderer';

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

// Mock Renderer
jest.mock('../Renderer', () => {
  return {
    Renderer: jest.fn().mockImplementation(() => ({
      getDomElement: jest.fn().mockReturnValue(document.createElement('canvas')),
      render: jest.fn(),
      dispose: jest.fn(),
      setSize: jest.fn(),
      setAnimationLoop: jest.fn()
    }))
  };
});

describe('ViewportRenderer', () => {
  let container: HTMLDivElement;
  let renderer: ViewportRenderer;
  let mockThreeRenderer: Renderer;
  
  beforeEach(() => {
    // Create a container element
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create a renderer instance
    mockThreeRenderer = new Renderer();
    renderer = new ViewportRenderer(mockThreeRenderer);
    
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
    expect(renderer).toBeInstanceOf(ViewportRenderer);
  });
  
  test('should attach renderer to container element', () => {
    renderer.attach(container);
    
    // Test implementation would check if the renderer's DOM element is in the container
    expect((renderer as any).container).toBe(container);
  });
  
  test('should detach renderer from container element', () => {
    renderer.attach(container);
    renderer.detach();
    
    expect((renderer as any).container).toBeNull();
  });
  
  test('should set content by texture', () => {
    // Create a mock texture
    const mockTexture = new THREE.Texture();
    
    // Set content
    renderer.setContent(mockTexture);
    
    // Verify mesh material was updated with texture
    const mesh = (renderer as any).scene.children[0];
    expect(mesh.material.map).toBe(mockTexture);
    expect(mesh.material.needsUpdate).toBe(true);
  });
  
  test('should set material', () => {
    // Create a mock material
    const mockMaterial = new THREE.MeshBasicMaterial();
    
    // Set material
    renderer.setMaterial(mockMaterial);
    
    // Verify mesh material was updated
    const mesh = (renderer as any).scene.children[0];
    expect(mesh.material).toBe(mockMaterial);
  });
  
  test('should render content', () => {
    // Call render
    renderer.render();
    
    // In a complete test, we'd verify that the renderer.render method was called
  });
  
  test('should dispose resources correctly', () => {
    // Mock scene child
    const mockMesh = {
      geometry: {
        dispose: jest.fn()
      },
      material: {
        dispose: jest.fn()
      }
    };
    
    (renderer as any).scene = {
      children: [mockMesh]
    };
    
    // Call dispose
    renderer.dispose();
    
    // Verify resources were disposed
    expect(mockMesh.geometry.dispose).toHaveBeenCalled();
    expect(mockMesh.material.dispose).toHaveBeenCalled();
  });
}); 