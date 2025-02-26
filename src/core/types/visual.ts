import * as THREE from 'three';

export interface IRenderTarget {
  id: string;
  target: THREE.WebGLRenderTarget;
  width: number;
  height: number;
  format: THREE.PixelFormat;
  type: THREE.TextureDataType;
}

export interface IShaderMaterial extends THREE.ShaderMaterial {
  uniforms: {
    [key: string]: {
      value: any;
      type: string;
      update?: (time: number, deltaTime: number) => void;
    }
  }
}

export interface IVisualTechnique {
  id: string;
  name: string;
  initialize: (renderer: THREE.WebGLRenderer) => void;
  createMaterial: (params: any) => IShaderMaterial;
  getUniformUpdaters: (params: any) => Record<string, (time: number, deltaTime: number) => void>;
  render: (renderer: THREE.WebGLRenderer, target?: THREE.WebGLRenderTarget) => void;
  dispose: () => void;
}

export interface IPixelDataExtractor {
  extract: (renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget) => Float32Array;
  setup: (width: number, height: number, format: THREE.PixelFormat) => void;
} 