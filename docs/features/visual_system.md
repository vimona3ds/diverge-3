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
  - ✅ ViewportRenderer tests (with TODOs)
  - ✅ BaseTechnique tests
  - ✅ Metaballs technique tests

**Incomplete:**
- ❌ Actual shader implementations for each technique
  - ❌ Vertex and fragment shaders for Metaballs
  - ❌ Vertex and fragment shaders for Reaction-Diffusion
  - ❌ Vertex and fragment shaders for Lenia
  - ❌ Vertex and fragment shaders for Fluid Simulation
- ❌ Remaining technique implementations:
  - ❌ Feedback loop system
  - ❌ Fractal noise system
- ❌ Remaining test files:
  - ❌ ReactionDiffusion tests
  - ❌ Lenia tests
  - ❌ FluidSimulation tests
- ❌ Visual node definitions
- ❌ Integration with node system
- ❌ Performance optimizations for visual rendering

**Notes:**
- The implementation now includes skeleton files for all the main visual techniques, but with placeholder shader code.
- All techniques follow the same pattern:
  - Extending BaseTechnique
  - Using ping-pong rendering for simulations
  - Consistent parameter interfaces
  - Proper resource management
- Test files need to be completed for all components
- Linter errors to fix:
  - ViewportRenderer test has several issues with method signatures
  - Metaballs test has property name issues (color1/color2 vs customColorA/customColorB)
- TODOs are clearly marked throughout the codebase

## Implementation Notes:
- ✅ Create minimal placeholder skeleton files first with clear TODOs
- ✅ Follow the project's existing directory structure for components and tests
- ✅ Tests should be added to `src/__tests__/systems/visual/` following existing patterns
- ✅ Initial placeholder files focus on interfaces and basic structure, NOT implementation details

## Next Steps:
1. Fix the linter errors in test files
2. Complete the test files for ReactionDiffusion, Lenia, and FluidSimulation
3. Implement the actual shader code for each technique
4. Create visual node definitions that connect to the node system
5. Implement the remaining visual techniques (feedback loop, fractal noise)
6. Add performance optimizations for high-resolution simulations
7. Create documentation for each technique and its parameters