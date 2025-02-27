import * as THREE from 'three';

// Create a more robust THREE.js mock for visual system tests
const mockMaterial = {
  dispose: jest.fn(),
  uniforms: {
    u_time: { value: 0.0 }
  },
  vertexShader: 'mock vertex shader',
  fragmentShader: 'mock fragment shader',
  needsUpdate: false
};

const mockGeometry = {
  dispose: jest.fn()
};

const mockMesh = {
  material: mockMaterial,
  geometry: mockGeometry
};

const mockScene = {
  add: jest.fn(),
  remove: jest.fn(),
  children: [mockMesh]
};

// Create a proper camera mock with position object
const mockCameraPosition = {
  z: 0,
  x: 0,
  y: 0
};

const mockCamera = {
  position: mockCameraPosition
};

const mockRenderTarget = {
  dispose: jest.fn(),
  texture: { 
    dispose: jest.fn() 
  }
};

const mockRenderer = {
  render: jest.fn(),
  dispose: jest.fn(),
  setRenderTarget: jest.fn(),
  setClearColor: jest.fn(),
  clear: jest.fn(),
  setSize: jest.fn(),
  setPixelRatio: jest.fn(),
  domElement: document.createElement('canvas'),
  setAnimationLoop: jest.fn()
};

// Helper function to clear all the mocks
const clearAllMocks = () => {
  mockMaterial.dispose.mockClear();
  mockGeometry.dispose.mockClear();
  mockScene.add.mockClear();
  mockScene.remove.mockClear();
  mockRenderer.render.mockClear();
  mockRenderer.setRenderTarget.mockClear();
  mockRenderTarget.dispose.mockClear();
  
  // Reset camera position
  mockCameraPosition.z = 0;
  mockCameraPosition.x = 0;
  mockCameraPosition.y = 0;
  
  // Reset material needsUpdate
  mockMaterial.needsUpdate = false;
};

// Create constructors
const SceneMock = jest.fn().mockImplementation(() => mockScene);
const MeshMock = jest.fn().mockImplementation(() => {
  mockScene.add(mockMesh); // Simulate adding mesh to scene
  return mockMesh;
});
const ShaderMaterialMock = jest.fn().mockImplementation(() => mockMaterial);
const OrthoMock = jest.fn().mockImplementation(() => mockCamera);
const RendererMock = jest.fn().mockImplementation(() => mockRenderer);
const RTMock = jest.fn().mockImplementation(() => mockRenderTarget);

// Mock THREE objects
jest.mock('three', () => {
  const originalModule = jest.requireActual('three');
  
  return {
    ...originalModule,
    WebGLRenderer: RendererMock,
    ShaderMaterial: ShaderMaterialMock,
    PlaneGeometry: jest.fn().mockImplementation(() => mockGeometry),
    Mesh: MeshMock,
    Scene: SceneMock,
    OrthographicCamera: OrthoMock,
    WebGLRenderTarget: RTMock,
    Texture: jest.fn().mockImplementation(() => ({})),
    Color: jest.fn().mockImplementation(() => ({})),
    Vector2: jest.fn().mockImplementation(() => ({})),
    MeshBasicMaterial: jest.fn().mockImplementation(() => ({})),
    // Add our helper
    __clearAllMocks: clearAllMocks,
    __mockCamera: mockCamera,
    __mockRenderer: mockRenderer,
    __mockScene: mockScene,
    __mockMesh: mockMesh
  };
});

// Also mock ResizeObserver for ViewportRenderer
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

export default THREE; 