# Visual System

**Goal:** Implement a flexible rendering system for various visual techniques (metaballs, reaction-diffusion, etc.) that can be composed through the node system.

**Completed:**
- ✅ Basic Renderer setup with Three.js
- ✅ ResourcePool implementation for efficient WebGL resource management
- ✅ VisualSystem class that manages the rendering pipeline
- ✅ Implementation of skeleton files for core structures:
  - ✅ ViewportRenderer for DOM attachment and rendering
  - ✅ BaseTechnique abstract class with shared functionality
- ✅ Implementation of skeleton files for visual techniques:
  - ✅ Metaballs implementation with configurable parameters
  - ✅ Reaction-Diffusion system with ping-pong rendering
  - ✅ Lenia (continuous cellular automata) with kernel texture generation
  - ✅ Fluid Simulation based on Navier-Stokes equations
- ✅ Test files for visual system components:
  - ✅ ViewportRenderer tests
  - ✅ BaseTechnique tests
  - ✅ Metaballs technique tests
  - ✅ ReactionDiffusion tests
  - ✅ Lenia tests
  - ✅ FluidSimulation tests
- ✅ Fixed linter errors:
  - ✅ Fixed Metaballs.test.ts references to 'color1'/'color2' properties (replaced with 'customColorA'/'customColorB')
  - ✅ Added missing 'colorMapping' property in Metaballs.test.ts test parameters
  - ✅ Fixed duplicate 'u_curl' property in FluidSimulation.test.ts mock uniforms (renamed second to 'u_curlStrength')
- ✅ Shader implementations for several techniques:
  - ✅ Vertex and fragment shaders for Metaballs with organic texture and color mapping
  - ✅ Vertex and fragment shaders for Reaction-Diffusion including Gray-Scott model implementation
  - ✅ Vertex and fragment shaders for Lenia with kernel texture generation and continuous cellular automata
- ✅ Implementation progress on FluidSimulation:
  - ✅ Core simulation methods implemented (initialize, createRenderTargets, reset)
  - ✅ Parameter handling and update methods
  - ✅ Simulation step pipeline based on Navier-Stokes equations
  - ✅ Rendering methods for visualization

**Incomplete:**
- ❌ Remaining shader implementations:
  - ❌ Complete shader constants for Fluid Simulation
  - ❌ Fix type issues in Fluid Simulation shader materials
- ❌ Remaining technique implementations:
  - ❌ Feedback loop system
  - ❌ Fractal noise system
- ❌ Visual node definitions
- ❌ Integration with node system
- ❌ Performance optimizations for visual rendering

**Notes:**
- The implementation now includes shader code for three of the four main visual techniques.
- All techniques follow the same pattern:
  - Extending BaseTechnique
  - Using ping-pong rendering for simulations
  - Consistent parameter interfaces
  - Proper resource management
- Test files have been created for all visual components with detailed test cases
- Test files follow TDD approach, clearly defining expected behavior for each technique
- Each test uses helper classes to access protected/private properties for testing
- Mocking approach is consistent across all test files for THREE.js objects
- All linter errors have been fixed in test files:
  - Fixed Metaballs test by properly using 'customColorA'/'customColorB' instead of 'color1'/'color2'
  - Added required 'colorMapping' property to properly comply with MetaballParams interface
  - Fixed FluidSimulation test by removing duplicate 'u_curl' property (renamed to 'u_curlStrength')
- TODOs are clearly marked throughout the codebase
- FluidSimulation implementation has progressed significantly:
  - Core structure and methods are in place
  - Render targets and ping-pong buffers are implemented
  - Simulation steps following Navier-Stokes equations are defined
  - Still need to finish defining shader constants and fixing type issues

## Implementation Notes:
- ✅ Create minimal placeholder skeleton files with clear TODOs
- ✅ Follow the project's existing directory structure for components and tests
- ✅ Tests added to `src/systems/visual/__tests__/` following existing patterns
- ✅ Placeholder files focus on interfaces and basic structure
- ✅ All tests use a testable subclass to expose protected/private properties
- ✅ Tests verify expected behavior for all techniques without actual implementation
- ✅ Fixed all linter errors in test files
- ✅ Implemented comprehensive shader code for Metaballs, Reaction-Diffusion, and Lenia techniques
- ✅ Started implementation of FluidSimulation shaders and simulation pipeline

## Shader Implementation Details:
- **Metaballs**: Implemented using inverse-square falloff field function with custom threshold and color mapping. Added subtle noise and pulsing effects for a more organic appearance.
- **Reaction-Diffusion**: Implemented Gray-Scott model with customizable feed and kill rates, discrete Laplacian approximation, and ping-pong buffer technique for simulation steps.
- **Lenia**: Implemented continuous cellular automata with customizable kernel functions, growth patterns, and visualization options. Includes efficient kernel texture generation.
- **Fluid Simulation**: Implementing NavierStokes equations with velocity and pressure fields, vorticity confinement, and divergence-free projection. Using ping-pong rendering for simulation steps including advection, pressure solving, and gradient subtraction.

## Next Steps:
1. Fix the linter errors in FluidSimulation implementation:
   - Define all missing shader constants (BASE_VERTEX_SHADER, CLEAR_FRAG_SHADER, etc.)
   - Add missing property declarations (baseMaterial, addForcesMaterial, addDyeMaterial)
   - Resolve type issues between ShaderMaterial and IShaderMaterial
2. Complete the Fluid Simulation shader implementation
3. Implement the remaining visual techniques (feedback loop, fractal noise)
4. Create visual node definitions that connect to the node system
5. Add performance optimizations for high-resolution simulations
6. Create documentation for each technique and its parameters

## Development Insights:
- Using type assertion with `(this as any)` is an effective way to test private properties
- Mock objects should carefully replicate the structure of THREE.js objects
- Duplicate property names in object literals cause linter errors and must be avoided
- Parameter interfaces need to be consistent between implementation and tests
- All tests should clear mocks in beforeEach to ensure isolation between tests
- Test files should validate both basic functionality and edge cases
- When updating test files, ensure all required properties from interfaces are included in test objects
- Properly named properties in test mocks should match the actual implementation to avoid confusion
- When fixing code in test files, watch for cascading type errors that may require additional fixes
- Shader implementations require careful WebGL resource management to avoid memory leaks
- Ping-pong rendering technique is essential for simulation-based techniques
- Adding a `webGLRenderer` property to techniques prevents linter errors with renderer access
- Properly storing and releasing WebGL resources in the `dispose` method is critical
- Initialization materials should be created separately from simulation materials
- Organic visual effects can be achieved by adding subtle noise and time-based animations
- For FluidSimulation, properties must be declared in the class before use in methods
- IShaderMaterial interface requires type definition for uniform values, which differs from THREE.ShaderMaterial
- Shader constants need to be defined at the module level rather than inline in methods