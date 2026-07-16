# Handoff Report — WebGL Optimization

## 1. Observation
- File `src/components/MitreHeatmap.jsx` was modified to optimize WebGL performance.
- We observed high GPU/CPU rendering load due to:
  1. High segment sphere geometry in `GradientSphere` (originally 256x256, 65k vertices).
  2. Continuous callback rendering inside `useFrame` for each individual `TechNode` component (causing many context updates and rendering calculations per frame).
  3. No user idle-detection or tab visibility throttle mechanism to suspend R3F canvas's automatic loop.
- File `tests/webgl-perf.spec.js` was modified to add robust assertions for `<canvas>` component mounting, visibility, and size.
- Vite build and Playwright test commands were executed and verified:
  - Command `npm run build` completed successfully:
    ```
    ✓ built in 11.40s
    ```
  - Command `npx playwright test tests/webgl-perf.spec.js` ran successfully, with CPU Scripting Time at `351.78 ms` and Rendering Time at `17.69 ms`, both well within specified limits:
    ```
    CPU Scripting Time: 351.78 ms
    Layout rendering:   0.00 ms
    Style recalculation:17.69 ms
    Total Rendering:    17.69 ms
    Total CPU Task Time:1141.54 ms
    ```

## 2. Logic Chain
- Transitioning the `<Canvas>` to `frameloop="demand"` shifts R3F's update loop from continuous rendering to event-driven manual invalidations, eliminating idle redraws.
- Registering each `TechNode`'s mesh and materials to a registry ref in `Scene` allows a single `useFrame` loop to iterate over all active nodes and apply lerps/scales/rotations in one loop. Calling `state.invalidate()` inside this loop only when nodes are in transition prevents redraws when the UI is stable.
- Disabling the rotation of unhovered `TechNode` objects eliminates ongoing state changes and unnecessary canvas updates.
- Implementing the `FrameloopScheduler` triggers throttled invalidations at 20 FPS (50ms) for cosmetic movements (like RotatingStars and slow globe drift) only when the document visibility is `visible` and user activity is detected (with a 30-second idle timeout). This suspends loop execution when backgrounded or inactive.
- Adding canvas assertions to `tests/webgl-perf.spec.js` ensures that the tests actively verify the canvas node's existence, visibility, and non-empty rendering viewport dimensions.

## 3. Caveats
- Browser-specific hardware acceleration issues or custom WebGL disable flags could fallback to the `<WebGLFallbackBoundary>` component. The performance measurement was executed under headless Chromium where GPU rendering is simulated via software.

## 4. Conclusion
- All five WebGL optimization requirements have been implemented successfully: R3F Canvas is on `demand` rendering; individual `useFrame` calls are consolidated into a parent registry loop; unhovered TechNode rotations are removed; an activity and visibility-aware `FrameloopScheduler` is active; and TrackballControls invalidates on change.
- Playwright tests were updated to enforce element-based canvas mounting validation and all assertions have successfully passed.

## 5. Verification Method
- Execute the build command:
  ```powershell
  npm run build
  ```
- Run the WebGL performance e2e test suite:
  ```powershell
  npx playwright test tests/webgl-perf.spec.js
  ```
- Inspect file `src/components/MitreHeatmap.jsx` to verify definition and usage of `FrameloopScheduler` and registry mapping.
