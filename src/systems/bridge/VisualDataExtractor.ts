import * as THREE from 'three';
import { IPixelDataExtractor } from '../../core/types/visual';

/**
 * Extracts data from visual renders for audio processing
 */
export class VisualDataExtractor implements IPixelDataExtractor {
  private width: number = 1;
  private height: number = 1;
  private format: THREE.PixelFormat = THREE.RGBAFormat;
  private buffer: Float32Array | Uint8Array;
  private isFloat: boolean = false;
  
  constructor() {
    this.buffer = new Uint8Array(4); // Default 1x1 RGBA
  }
  
  /**
   * Setup the extractor with dimensions and format
   * @param width Width of the data to extract
   * @param height Height of the data to extract
   * @param format Pixel format to use
   * @param type Texture data type (float or byte)
   */
  public setup(
    width: number, 
    height: number, 
    format: THREE.PixelFormat, 
    type: THREE.TextureDataType = THREE.UnsignedByteType
  ): void {
    this.width = width;
    this.height = height;
    this.format = format;
    this.isFloat = type === THREE.FloatType || type === THREE.HalfFloatType;
    
    // Create appropriate buffer
    const bytesPerPixel = format === THREE.RGBAFormat ? 4 : 
                         format === THREE.RGBFormat ? 3 : 
                         format === THREE.LuminanceFormat ? 1 : 4;
    
    const totalBytes = width * height * bytesPerPixel;
    this.buffer = this.isFloat ? 
      new Float32Array(totalBytes) : 
      new Uint8Array(totalBytes);
  }
  
  /**
   * Extract data from a render target
   * @param renderer The WebGL renderer
   * @param target The render target to extract from
   * @returns Extracted pixel data as Float32Array
   */
  public extract(
    renderer: THREE.WebGLRenderer, 
    target: THREE.WebGLRenderTarget
  ): Float32Array {
    // Read pixels from render target
    renderer.readRenderTargetPixels(
      target,
      0, 0,
      this.width, this.height,
      this.buffer
    );
    
    // Convert to normalized Float32Array for consistent API
    if (!this.isFloat) {
      const floatBuffer = new Float32Array(this.buffer.length);
      // Normalize 0-255 to 0-1
      for (let i = 0; i < this.buffer.length; i++) {
        floatBuffer[i] = (this.buffer as Uint8Array)[i] / 255;
      }
      return floatBuffer;
    }
    
    return this.buffer as Float32Array;
  }
  
  /**
   * Extract average values from a render target
   * @param renderer The WebGL renderer
   * @param target The render target to extract from
   * @returns Average RGBA values normalized to 0-1
   */
  public extractAverage(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGLRenderTarget
  ): { r: number, g: number, b: number, a: number } {
    const data = this.extract(renderer, target);
    
    // Calculate average values
    let r = 0, g = 0, b = 0, a = 0;
    const pixelCount = this.width * this.height;
    const bytesPerPixel = this.format === THREE.RGBAFormat ? 4 : 
                         this.format === THREE.RGBFormat ? 3 : 
                         this.format === THREE.LuminanceFormat ? 1 : 4;
    
    for (let i = 0; i < pixelCount; i++) {
      const offset = i * bytesPerPixel;
      r += data[offset];
      
      if (bytesPerPixel > 1) {
        g += data[offset + 1];
        
        if (bytesPerPixel > 2) {
          b += data[offset + 2];
          
          if (bytesPerPixel > 3) {
            a += data[offset + 3];
          }
        }
      }
    }
    
    return {
      r: r / pixelCount,
      g: bytesPerPixel > 1 ? g / pixelCount : 0,
      b: bytesPerPixel > 2 ? b / pixelCount : 0,
      a: bytesPerPixel > 3 ? a / pixelCount : 1
    };
  }
} 