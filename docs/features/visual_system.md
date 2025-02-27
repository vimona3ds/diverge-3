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
  - ✅ FeedbackLoop implementation with transformations and blending
  - ✅ FractalNoise implementation with FBM and various noise types
- ✅ Test files for visual system components:
  - ✅ ViewportRenderer tests
  - ✅ BaseTechnique tests
  - ✅ Metaballs technique tests
  - ✅ ReactionDiffusion tests
  - ✅ Lenia tests
  - ✅ FluidSimulation tests
  - ✅ FeedbackLoop tests
  - ✅ FractalNoise tests
- ✅ Fixed linter errors:
  - ✅ Fixed Metaballs test by properly using 'customColorA'/'customColorB' instead of 'color1'/'color2'
  - ✅ Added missing 'colorMapping' property in Metaballs.test.ts test parameters
  - ✅ Fixed FluidSimulation test by removing duplicate 'u_curl' property (renamed to 'u_curlStrength')
  - ✅ Fixed type issues in FluidSimulation with createShaderMaterial helper
  - ✅ Fixed IUniformWithUpdate interface to ensure 'type' property is never undefined
- ✅ Shader implementations for all visual techniques:
  - ✅ Vertex and fragment shaders for Metaballs with organic texture and color mapping
  - ✅ Vertex and fragment shaders for Reaction-Diffusion including Gray-Scott model implementation
  - ✅ Vertex and fragment shaders for Lenia with kernel texture generation and continuous cellular automata
  - ✅ Complete fluid simulation shaders based on Navier-Stokes equations
  - ✅ Feedback loop shaders with transformations and various blend modes
  - ✅ Fractal noise shaders with multiple noise types and domain transformations
- ✅ Test coverage confirms:
  - ✅ All techniques follow proper resource management practices
  - ✅ Each technique correctly implements initialization, rendering, and disposal
  - ✅ Parameters can be properly updated during runtime
  - ✅ Render target management works correctly with ping-pong buffers
  - ✅ Each technique successfully renders to appropriate targets
- ✅ Visual node definitions:
  - ✅ Test file for visual node registration and functionality
  - ✅ MetaballsNode implementation with appropriate inputs, outputs, and parameters
  - ✅ ReactionDiffusionNode implementation 
  - ✅ LeniaNode implementation (basic structure)
  - ✅ Fixed type errors in LeniaNode.ts for initialPattern parameter
  - ✅ FluidSimulationNode implementation
  - ✅ FeedbackLoopNode implementation
  - ✅ FractalNoiseNode implementation
  - ✅ index.ts file to export all visual nodes
- ✅ Integration with node system:
  - ✅ Created VisualNodeIntegration class to bridge node system and visual system
  - ✅ Implemented texture data flow between nodes
  - ✅ Added topological sorting for correct processing order
  - ✅ Implemented proper WebGL resource management and cleanup
  - ✅ Added comprehensive tests for node integration
  - ✅ Created index files for proper organization and exports

**Incomplete:**
- ❌ Performance optimizations for visual rendering
- ❌ Complete TODOs in some test files to improve coverage
- ❌ More specific type safety for some parameter interfaces
- ❌ Edge case and error handling tests

**Notes:**
- The implementation now includes shader code for all six main visual techniques.
- All techniques follow the same pattern:
  - Extending BaseTechnique
  - Using ping-pong rendering for simulations
  - Consistent parameter interfaces
  - Proper resource management
- Test files have been created for all visual components with detailed test cases
- Test files follow TDD approach, clearly defining expected behavior for each technique
- Each test uses helper classes to access protected/private properties for testing
- Mocking approach is consistent across all test files for THREE.js objects
- All linter errors have been fixed:
  - Fixed Metaballs test by properly using 'customColorA'/'customColorB' instead of 'color1'/'color2'
  - Added required 'colorMapping' property to properly comply with MetaballParams interface
  - Fixed FluidSimulation test by removing duplicate 'u_curl' property (renamed to 'u_curlStrength')
  - Fixed type issues in FluidSimulation with a custom helper function to properly convert THREE.ShaderMaterial to IShaderMaterial
  - Updated the IUniformWithUpdate interface to make 'type' property required instead of optional
- TODOs are clearly marked throughout the codebase
- Completed all planned shader implementations:
  - FluidSimulation is fully implemented with all shader constants defined
  - FeedbackLoop includes ping-pong rendering with transformations and custom blend modes
  - FractalNoise includes multiple noise implementations (simplex, perlin, worley, value) with domain transformations

## Implementation Notes:
- ✅ Create minimal placeholder skeleton files with clear TODOs
- ✅ Follow the project's existing directory structure for components and tests
- ✅ Tests added to `src/systems/visual/__tests__/` following existing patterns
- ✅ Placeholder files focus on interfaces and basic structure
- ✅ All tests use a testable subclass to expose protected/private properties
- ✅ Tests verify expected behavior for all techniques without actual implementation
- ✅ Fixed all linter errors in test files
- ✅ Implemented comprehensive shader code for all six visual techniques
- ✅ Completed the implementation of all planned visual techniques
- ✅ All techniques properly implement WebGL resource management with dispose methods
- ✅ Created visual node definitions for connecting techniques to the node system (completed)

## Shader Implementation Details:
- **Metaballs**: Implemented using inverse-square falloff field function with custom threshold and color mapping. Added subtle noise and pulsing effects for a more organic appearance.
- **Reaction-Diffusion**: Implemented Gray-Scott model with customizable feed and kill rates, discrete Laplacian approximation, and ping-pong buffer technique for simulation steps.
- **Lenia**: Implemented continuous cellular automata with customizable kernel functions, growth patterns, and visualization options. Includes efficient kernel texture generation.
- **Fluid Simulation**: Implemented NavierStokes equations with velocity and pressure fields, vorticity confinement, and divergence-free projection. Using ping-pong rendering for simulation steps including advection, pressure solving, and gradient subtraction.
- **FeedbackLoop**: Implemented frame buffer feedback with transformations (translation, rotation, scaling) and various blend modes (add, multiply, screen, overlay). Added color shifting and decay effects for interesting visual patterns.
- **FractalNoise**: Implemented Fractal Brownian Motion (FBM) with multiple noise types (simplex, perlin, worley, value) and domain transformations (ridged, turbulent, terraced). Includes customizable color modes with grayscale, rainbow, and custom gradient options.

## Current Progress on Node Integration:
- ✅ Created VisualNodeIntegration class that bridges the node system and visual system
- ✅ Implemented texture data flow between nodes via input/output methods
- ✅ Added topological sorting algorithm for correct node processing order
- ✅ Implemented proper resource management with type-safe dispose method
- ✅ Created comprehensive tests for integration functionality
- ✅ Added proper type safety with TechniqueWithDispose interface and type guards
- ✅ Created index files for organization and exports:
  - ✅ src/systems/integration/index.ts - Exports integration components
  - ✅ src/core/nodes/definitions/index.ts - Exports node definitions 
  - ✅ src/core/nodes/index.ts - Exports node system components
- ✅ All visual nodes are now properly registered with the NodeRegistry

## Integration Features Implemented:
- Visual techniques can now be connected through the node graph
- Texture data flows between nodes via connections
- Nodes are processed in the correct order based on their dependencies
- WebGL resources are properly managed and cleaned up
- Testing verifies node registration, context extension, data flow, and resource cleanup

## Next Steps:
1. Complete performance optimizations for the visual rendering system
2. Address TODOs in test files to improve coverage
3. Enhance type safety for parameter interfaces
4. Add comprehensive error handling for edge cases
5. Test the integration in the actual node editor
6. Document the node parameters and usage

## Development Insights:
- Type guards are essential for safe handling of unknown technique objects
- TDD approach was very effective for defining expected behavior before implementation
- Topological sorting algorithm ensures proper node processing order
- The integration layer effectively bridges two complex systems
- Using Maps for output data storage provides efficient lookup
- Careful WebGL resource management is critical to prevent memory leaks
- Proper disposal of resources requires type-safe checks
- Index files help organize and expose components correctly

## Issues and Lessons Learned:
- TypeScript type safety requires careful attention, especially with WebGL resources
- The `unknown` type with type guards provides safer handling than `any`
- Circular dependencies between modules can cause subtle issues
- When implementing integration layers, clear interface boundaries are essential
- Testing complex systems requires careful mocking of dependencies
- Maintaining type safety while allowing flexible node connections requires careful design
- Using the proper PortType enum values helps catch type errors at compile time
- Property paths like `node.state.technique.dispose()` need type checking at each level
- Testing visual node integration requires understanding of both systems being connected