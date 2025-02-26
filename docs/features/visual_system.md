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

**Incomplete:**
- ❌ Fix remaining linter errors:
  - ❌ Metaballs.test.ts still has a reference to 'color1'/'color2' properties
  - ❌ FluidSimulation.test.ts has duplicate 'u_curl' property in mock uniforms
- ❌ Actual shader implementations for each technique
  - ❌ Vertex and fragment shaders for Metaballs
  - ❌ Vertex and fragment shaders for Reaction-Diffusion
  - ❌ Vertex and fragment shaders for Lenia
  - ❌ Vertex and fragment shaders for Fluid Simulation
- ❌ Remaining technique implementations:
  - ❌ Feedback loop system
  - ❌ Fractal noise system
- ❌ Visual node definitions
- ❌ Integration with node system
- ❌ Performance optimizations for visual rendering

**Notes:**
- The implementation now includes skeleton files for all the main visual techniques, with placeholder shader code.
- All techniques follow the same pattern:
  - Extending BaseTechnique
  - Using ping-pong rendering for simulations
  - Consistent parameter interfaces
  - Proper resource management
- Test files have been created for all visual components with detailed test cases
- Test files follow TDD approach, clearly defining expected behavior for each technique
- Each test uses helper classes to access protected/private properties for testing
- Mocking approach is consistent across all test files for THREE.js objects
- Linter errors to fix:
  - Metaballs test still has a reference to 'color1'/'color2' instead of 'customColorA'/'customColorB'
  - FluidSimulation test has a duplicate property 'u_curl' in the mock uniforms
- TODOs are clearly marked throughout the codebase

## Implementation Notes:
- ✅ Create minimal placeholder skeleton files with clear TODOs
- ✅ Follow the project's existing directory structure for components and tests
- ✅ Tests added to `src/systems/visual/__tests__/` following existing patterns
- ✅ Placeholder files focus on interfaces and basic structure
- ✅ All tests use a testable subclass to expose protected/private properties
- ✅ Tests verify expected behavior for all techniques without actual implementation

## Next Steps:
1. Fix the remaining linter errors in test files
2. Implement the actual shader code for each technique, starting with Metaballs
3. Create visual node definitions that connect to the node system
4. Implement the remaining visual techniques (feedback loop, fractal noise)
5. Add performance optimizations for high-resolution simulations
6. Create documentation for each technique and its parameters

## Development Insights:
- Using type assertion with `(this as any)` is an effective way to test private properties
- Mock objects should carefully replicate the structure of THREE.js objects
- Duplicate property names in object literals cause linter errors and must be avoided
- Parameter interfaces need to be consistent between implementation and tests
- All tests should clear mocks in beforeEach to ensure isolation between tests
- Test files should validate both basic functionality and edge cases