// Mock for Web Audio API
global.AudioContext = class AudioContext {
  constructor() {
    this.destination = {};
    this.currentTime = 0;
  }
  
  createGain() {
    return {
      connect: jest.fn(),
      gain: { value: 0 }
    };
  }
  
  createOscillator() {
    return {
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      frequency: { value: 0 }
    };
  }
};

// Mock for WebGL/Three.js
global.HTMLCanvasElement.prototype.getContext = function() {
  return {
    drawImage: jest.fn(),
    getImageData: jest.fn(),
    putImageData: jest.fn(),
    createImageData: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    clearRect: jest.fn(),
    drawArrays: jest.fn(),
    drawElements: jest.fn(),
    viewport: jest.fn(),
    bufferData: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn(),
    createShader: jest.fn(),
    createProgram: jest.fn(),
    linkProgram: jest.fn(),
  };
};

// Performance API mock
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => [])
};

// Replace console with mocked implementations to suppress all output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}; 