# Technical Design Document: Node-Based Audiovisual Experience Playground

## 1. System Overview

### 1.1 Purpose
To provide a desktop web application where users can create real-time audiovisual experiences using node-based editing of parameters for techniques described in the paper, including metaballs, reaction-diffusion, Lenia, feedback loops, and fractal noise for visuals, coupled with procedural and sample-based audio synthesis.

### 1.2 Scope
- Desktop-only web application
- No mobile optimization
- No automatic quality adjustment
- No export/sharing features
- No code editing, parameter adjustment only
- No explanatory/educational components

## 2. System Architecture

### 2.1 High-Level Components
- **Node Editor Canvas**: The central workspace where users connect nodes
- **Rendering Pipeline**: WebGL/THREE.js pipeline for visual processing
- **Audio Pipeline**: Web Audio API pipeline for sound generation
- **Asset Manager**: For handling uploaded audio samples
- **Parameter Storage**: For managing node configurations

### 2.2 Component Interactions
```
[Node Editor Canvas] ↔ [Parameter Storage]
       ↓                       ↓
[Rendering Pipeline] ← → [Audio Pipeline]
       ↑                       ↑
       └───────→ [Asset Manager] ←───┘
```

## 3. Node-Based Editor Design

### 3.1 Node Categories
1. **Source Nodes**
   - Visual Sources (base patterns, noise generators)
   - Audio Sources (oscillators, noise generators, sample players)
   
2. **Processing Nodes**
   - Visual Processing (metaballs, reaction-diffusion, Lenia, etc.)
   - Audio Processing (filters, effects, etc.)
   
3. **Parameter Nodes**
   - Mathematical operations
   - Time-based modulation
   - Random generators
   
4. **Bridge Nodes**
   - Visual-to-Audio converters
   - Audio-to-Parameter mappers
   
5. **Output Nodes**
   - Visual Display
   - Audio Output

### 3.2 Node Connectivity
- Nodes will have typed inputs/outputs (Float, Vector2, Vector3, Color, Texture, AudioBuffer, etc.)
- Type checking will prevent invalid connections
- Multiple outputs can connect to multiple inputs of compatible types
- Circular dependencies will be detected and prevented

## 4. Visual Processing System

### 4.1 Visual Techniques Implementation

#### 4.1.1 Metaball System
- **Parameters**: Position, radius, strength, threshold, color for each metaball
- **Implementation**: GLSL shader using inverse-square field functions
- **Node Types**: 
  - Metaball Generator
  - Metaball Field Combiner
  - Metaball Visualizer

#### 4.1.2 Reaction-Diffusion System
- **Parameters**: Feed rate, kill rate, diffusion rates, initial conditions
- **Implementation**: Gray-Scott model in GLSL using ping-pong textures
- **Node Types**:
  - RD Simulator
  - RD Parameter Controller
  - RD Initializer (patterns)

#### 4.1.3 Lenia (Continuous Cellular Automata)
- **Parameters**: Growth mapping, kernel settings, time step
- **Implementation**: Extended CA model with continuous states
- **Node Types**:
  - Lenia Simulator
  - Lenia Kernel Editor
  - Lenia State Initializer

#### 4.1.4 Feedback Loop System
- **Parameters**: Feedback strength, transform (translation, rotation, scaling)
- **Implementation**: Framebuffer feedback with transformations
- **Node Types**:
  - Feedback Processor
  - Transform Controller

#### 4.1.5 Fractal Noise System
- **Parameters**: Scale, octaves, persistence, lacunarity
- **Implementation**: FBM (Fractal Brownian Motion) in GLSL
- **Node Types**:
  - Noise Generator (Perlin, Simplex, etc.)
  - Fractal Combiner
  - Domain Warper

### 4.2 Visual Pipeline
1. Generate base textures/fields (metaballs, noise, etc.)
2. Process through simulation nodes (RD, Lenia)
3. Apply transformations and feedback
4. Output to display

## 5. Audio Processing System

### 5.1 Audio Synthesis Nodes

#### 5.1.1 Oscillator Nodes
- **Parameters**: Type (sine, square, saw, triangle), frequency, amplitude
- **Implementation**: Web Audio OscillatorNode
- **Node Types**:
  - Basic Oscillator
  - FM Synthesizer
  - Granular Synthesizer

#### 5.1.2 Noise Generators
- **Parameters**: Type (white, pink, brown), amplitude
- **Implementation**: AudioWorklet-based noise generators
- **Node Types**:
  - Noise Generator
  - Filtered Noise

#### 5.1.3 Sample-Based Audio
- **Parameters**: Playback rate, loop points, volume
- **Implementation**: AudioBufferSourceNode with uploaded files
- **Node Types**:
  - Sample Player
  - Sample Granulator
  - Sample Looper

### 5.2 Audio Processing Nodes

#### 5.2.1 Filter Nodes
- **Parameters**: Type, cutoff, resonance
- **Implementation**: BiquadFilterNode
- **Node Types**:
  - Low/High/Band-pass Filter
  - Formant Filter

#### 5.2.2 Effect Nodes
- **Parameters**: Specific to effect type
- **Implementation**: Various Web Audio nodes
- **Node Types**:
  - Delay
  - Reverb
  - Distortion
  - Compression

### 5.3 Audio-Visual Bridge Nodes
- **Parameters**: Mapping function, scaling, offset
- **Implementation**: Custom analysis and parameter extraction
- **Node Types**:
  - Texture Analyzer (extracts visual data for audio)
  - Event Detector (detects visual events)
  - Parameter Mapper (maps visual data to audio parameters)

### 5.4 Audio Pipeline
1. Generate base audio (oscillators, samples, noise)
2. Process through effects chain
3. Apply visual-to-audio mapping
4. Output to speakers

## 6. Implementation Technologies

### 6.1 Core Technologies
- **Frontend Framework**: React for UI components
- **Node Editor**: Custom implementation or adapted library (e.g., Rete.js)
- **Graphics**: THREE.js with custom WebGL shaders
- **Audio**: Web Audio API with custom AudioWorklets
- **Asset Management**: Browser's FileReader API and IndexedDB

### 6.2 Key Libraries
- **THREE.js**: For WebGL rendering
- **Rete.js** (or similar): For node editor foundation
- **Tone.js**: For higher-level audio manipulation

## 7. Data Flow & Processing

### 7.1 Real-time Processing Loop
```
function processFrame() {
  // 1. Process node graph to update all parameters
  updateNodeGraph();
  
  // 2. Execute visual processing chain
  executeVisualNodes();
  
  // 3. Extract data for audio
  extractVisualData();
  
  // 4. Update audio parameters
  updateAudioNodes();
  
  // 5. Schedule next frame
  requestAnimationFrame(processFrame);
}
```

### 7.2 Visual-Audio Synchronization
- Visual data extraction via WebGL readPixels (minimized for performance)
- Parameter updates synchronized in single frame
- Audio scheduled with precise timing using AudioContext.currentTime

## 8. Detailed Component Specifications

### 8.1 Node Editor Interface

#### 8.1.1 Workspace
- Infinite canvas with pan/zoom
- Node categorization by color and shape
- Connection visualization with data-type coding

#### 8.1.2 Node Inspector
- Parameter controls appear when node is selected
- Controls appropriate to parameter type (sliders, color pickers, etc.)
- Live update of parameters

### 8.2 Visual Rendering System

#### 8.2.1 THREE.js Scene Setup
- Fullscreen render quad for shader effects
- Multiple render targets for technique combinations
- Custom shader materials for each technique

#### 8.2.2 Shader Management
- Dynamic shader compilation based on node configuration
- Shader chunk library for technique implementations
- Uniform management tied to node parameters

### 8.3 Audio System

#### 8.3.1 Web Audio Graph
- Dynamic audio node creation/connection
- Parameter automation with AudioParam
- Custom processing with AudioWorklets

#### 8.3.2 Sample Management
- Local file loading via drag & drop
- Sample preprocessing (normalization, analysis)
- Buffer management for efficient memory usage

### 8.4 Visual-Audio Bridge

#### 8.4.1 Data Extraction
- Minimal texture readback (1-4 pixels where possible)
- Feature extraction: intensity, motion, color, events
- Efficient data formatting for audio consumption

#### 8.4.2 Parameter Mapping
- User-defined mapping functions
- Scaling, offset, and curve adjustments
- Event detection with hysteresis

## 9. Performance Considerations

### 9.1 GPU Optimization
- Limit render target size for complex effects
- Minimize shader complexity when possible
- Efficient texture management (reuse, appropriate formats)

### 9.2 CPU Optimization
- Minimize main thread work
- Use WebWorkers for heavy computation
- AudioWorklets for audio processing
- Throttle node graph evaluation when possible

### 9.3 Memory Management
- Texture pool for render targets
- Buffer reuse for audio processing
- Garbage collection minimization

## 10. Technical Limitations & Constraints

### 10.1 Browser Capabilities
- WebGL2 required for most visual techniques
- AudioWorklet support required for advanced audio
- High-end desktop performance assumed

### 10.2 Processing Limits
- Maximum number of nodes based on complexity
- FPS target of 60, degrading gracefully with complexity
- Audio latency minimized but not guaranteed below ~10ms

## 11. Implementation Phases

### 11.1 Phase 1: Core Framework
- Node editor foundation
- Basic visual techniques (metaballs, feedback)
- Basic audio synthesis (oscillators, effects)
- Simple visual-audio bridging

### 11.2 Phase 2: Advanced Techniques
- Reaction-diffusion implementation
- Lenia implementation
- Fractal noise system
- Advanced audio synthesis (granular, FM)

### 11.3 Phase 3: Integration & Optimization
- Complete visual-audio bridging
- Performance optimization
- UI refinement
- Sample library support

## 12. Conclusion

This technical design outlines a desktop-focused, node-based audiovisual playground that implements the techniques described in the paper. Users will have fine control over visual and audio parameters through a node-based interface, with the ability to create complex combinations of techniques without needing to understand the underlying code. The system is designed for performance on desktop browsers, with a focus on real-time interaction and creative exploration.
