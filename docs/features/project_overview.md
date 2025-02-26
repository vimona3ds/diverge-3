# Audiovisual Node Playground Project Overview

## Project Overview

This project aims to create a desktop web application where users can create real-time audiovisual experiences using a node-based editor. It leverages techniques like metaballs, reaction-diffusion, feedback loops, and fractal mathematics for visuals, combined with procedural and sample-based audio synthesis through the Web Audio API.

## Current Project Status (As of March 28, 2024)

The project is in early development with the basic architectural framework implemented. The core infrastructure including the main application layout, engine, node editor system, and basic type definitions are in place. However, specific visual and audio technique implementations (metaballs, reaction-diffusion, granular synthesis, etc.) have not yet been started.

### Environment and Setup
- Basic React application structure is set up with TypeScript
- Webpack configuration is in place for development and production builds
- Core dependencies are installed (React, Three.js, Tone.js, UUID)
- Jest and ts-jest are set up for unit testing

## Implementation Priorities

Based on the current state, here are the recommended next steps in order of priority:

1. **Complete Core Test Suite**: Finish fixing the test failures in Scheduler and other services to ensure the engine is stable.
2. **Complete Visual Techniques**: Implement at least one visual technique (metaballs) with shaders to have a visible output.
3. **Complete Audio Techniques**: Implement basic oscillator and effect nodes to have audible output.
4. **Implement Bridge System**: Create the visual-audio synchronization to demonstrate the core concept.
5. **Add Viewport Controls**: Implement play/pause and reset controls for the renderer.
6. **Polish UI**: Enhance the user interface for better usability.
7. **Optimization**: Apply performance monitoring and optimization strategies to ensure smooth operation.

## Technical Observations

- The project follows a clean architecture with clear separation of concerns.
- The type system is well-defined, following the specifications in the technical design document.
- The node-based approach allows for extension with new techniques without major refactoring.
- The React components and core systems are built to be loosely coupled.
- The project uses modern JavaScript features and TypeScript for type safety.
- The Core Engine is now very robust with comprehensive error handling, performance monitoring, and resource management.
- The Node Editor system has been significantly enhanced with group and parameter functionality, making it more user-friendly.
- Circular dependencies and infinite recursion patterns have been eliminated through careful refactoring and cycle detection.

## Testing Strategy and Progress

### Testing Approach
- Jest is used as the primary testing framework with ts-jest for TypeScript support
- Tests are structured in `__tests__` directories parallel to the code they test
- Core modules have unit tests to ensure functionality and prevent regressions
- Mocks are extensively used for browser APIs (WebGL, Audio API, Performance API)

### Current Test Status
- Core engine components have comprehensive test coverage
- Utility classes (Profiler, ErrorHandler, MemoryMonitor) are thoroughly tested
- Node processor tests include edge cases like cycles and error conditions
- Services like Scheduler and AssetManager have basic test coverage

### Recent Improvements
- Implemented global console mocking to suppress console.log, warn, and error messages during tests
- This prevents test output pollution while still allowing assertion of console behavior
- Test output is now cleaner and focused on actual test results

### Testing Challenges
- Mocking browser APIs requires careful implementation and maintenance
- Some components are tightly coupled with DOM or WebGL, making testing complex
- Asynchronous operations and timers require special testing considerations
- Testing audio and visual output quality remains a challenge

### Next Steps for Testing
- Implement visual regression testing for UI components
- Add performance benchmark tests for critical path operations
- Increase code coverage, especially for edge cases
- Set up integration tests for complete workflows

## Reference Information

### Key Dependencies
- React/ReactDOM for UI
- Three.js for WebGL rendering
- Tone.js for audio synthesis
- UUID for unique identifiers

### Building and Running
```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

### Directory Structure
```
/src
  /components - React components
  /core - Core engine and type definitions
  /systems - Subsystems (visual, audio, bridge, node-editor)
  /services - Service layer
  /shaders - GLSL shader code
  /workers - Web Workers
  /worklets - Audio Worklets
  /styles - Global styles
```

## Issues and Challenges

- **Performance**: Real-time audio-visual synchronization will be challenging on lower-end devices.
- **Browser Compatibility**: WebGL2 and AudioWorklet support varies across browsers.
- **Resource Management**: WebGL resources need careful management to avoid memory leaks.
- **UI Complexity**: The node editor requires complex interaction patterns.
- **Testing Challenges**: Mocking browser APIs (especially FileReader, AudioContext) requires careful implementation.
- **Circular Dependencies**: Need to be vigilant about avoiding circular imports between modules.
- **Cyclic Node Graphs**: Must handle user-created circular node connections gracefully. 