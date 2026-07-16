# WebGL Rendering Optimizations for MitreHeatmap

This handoff report details the analysis of `src/components/MitreHeatmap.jsx` and proposes a comprehensive optimization design to transition to demand-based rendering. These optimizations will drastically reduce idle CPU scripting overhead and GPU rendering usage.

---

## 1. Observation

Direct observations and analysis of the current implementation in `src/components/MitreHeatmap.jsx`:

### A. Continuous Rendering Loop
The `<Canvas>` component does not specify a `frameloop` option, defaulting to continuous 60fps (or display refresh rate) rendering:
```jsx
// src/components/MitreHeatmap.jsx:1290-1294
<Canvas 
  dpr={[1, 1]} 
  camera={{ position: [0, 0, 16], fov: 60 }}
  gl={{ antialias: false, powerPreference: "high-performance" }}
>
```

### B. High CPU Scripting Overhead from `useFrame` Multiplicity
The `TechNode` component is rendered for every technique under an active tactic (typically 30–80 instances). Each instance mounts its own `useFrame` hook:
```jsx
// src/components/MitreHeatmap.jsx:367-399
useFrame((state, delta) => {
  hoverScale.current = THREE.MathUtils.lerp(hoverScale.current, isHovered ? 1 : 0, delta * 12);
  testedFade.current = THREE.MathUtils.lerp(testedFade.current, isTested ? 1 : 0, delta * 8);

  if (groupRef.current) {
    const baseScale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.15;
    groupRef.current.scale.setScalar(baseScale * Math.max(0, 1 - hoverScale.current * 1.5));
    groupRef.current.rotation.y += delta;
  }

  if (solidMatRef.current) {
    solidMatRef.current.opacity = isVisible ? testedFade.current : 0.1 * testedFade.current;
    solidMatRef.current.emissiveIntensity = testedFade.current * 6.0;
    solidMatRef.current.color.set(color);
    solidMatRef.current.emissive.set(color);
  }

  if (wireMatRef.current) {
    wireMatRef.current.opacity = isVisible ? (0.45 * (1 - testedFade.current)) : 0.08 * (1 - testedFade.current);
    wireMatRef.current.color.set(color);
    wireMatRef.current.emissive.set(color);
  }

  if (fieldRef.current) {
      fieldRef.current.rotation.y -= delta * 1.5;
      fieldRef.current.rotation.x += delta * 0.8;
      const pulse = Math.sin(state.clock.elapsedTime * 8) * 0.05;
      fieldRef.current.scale.setScalar(hoverScale.current * (1 + pulse));
      fieldRef.current.material.opacity = hoverScale.current * 0.45;
      fieldRef.current.material.color.set(color);
      fieldRef.current.material.emissive.set(color);
   }
});
```
This causes major performance issues:
- **Call-stack overhead:** R3F must schedule, update context, and invoke 30–80 independent functions on every frame.
- **Redundant Math:** Every instance calculates independent `Math.sin` expressions based on `elapsedTime`.
- **Continuous Rotations:** The line `groupRef.current.rotation.y += delta` forces the node to rotate continuously, meaning a redraw is always required.

### C. Continuous Slow Rotation in Parent Components
- **`RotatingStars`** uses `useFrame` (lines 531-537) to slowly rotate the starfield:
  ```jsx
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y -= 0.00005;
      groupRef.current.rotation.x += 0.00002;
    }
  });
  ```
- **`Scene`** uses `useFrame` (lines 668-689) to slowly rotate the globe group when not zoomed into a tactic:
  ```jsx
  if (!activeTactic && groupRef.current) {
     groupRef.current.rotation.y += 0.0006;
     groupRef.current.rotation.x += 0.0003;
  }
  ```
- **`PulsingWireframe`** uses `useFrame` (lines 182-186) to update the shader's `time` uniform:
  ```jsx
  useFrame((state) => {
      if (matRef.current) {
         matRef.current.uniforms.time.value = state.clock.elapsedTime;
      }
  });
  ```

---

## 2. Logic Chain

1. **Continuous 60fps loop is wasteful:** Since the heatmap is primarily static while the user reads technique details, constant 60fps rendering wastes battery, generates heat, and drives up idle CPU/GPU usage.
2. **Transitioning to `frameloop="demand"` eliminates idle rendering:** Setting this canvas option tells R3F to only render when changes occur. However, animations (`useFrame` loops) will freeze unless a mechanism invalidates frames during active transitions.
3. **Consolidating `useFrame` reduces scripting overhead:** Moving 80 individual loops into a single registry iteration reduces fiber call-stack traversal and redundant JS execution.
4. **Disabling continuous idle rotation is required for 0fps idle:** If individual nodes continuously rotate on the Y-axis (`groupRef.current.rotation.y += delta`), we can never drop to 0fps. Removing this continuous rotation (or restricting it to hovered elements) allows the render loop to sleep when the user is not interacting.
5. **Slow globe drift can be throttled and suspended:** The slow drift of the stars/globe is purely cosmetic. Throttling updates to 20-30 FPS, suspending updates when the tab is backgrounded (Page Visibility API), and suspending updates after a period of user inactivity (Inactivity Timeout) allows the page to go to sleep completely.

---

## 3. Caveats

- **Shader freezing:** Under `frameloop="demand"`, the wireframe shader pulse in `PulsingWireframe` will freeze when the scene goes to sleep. This is correct behavior for power-saving, but the visual transition must be acceptable to designers.
- **Damping on controls:** `TrackballControls` has inertia (damping). If invalidation stops too early, the camera movement will snap to a halt. We must ensure `onChange={invalidate}` is correctly registered so that it continues to invalidate frames until the camera comes to a complete rest.
- **Occlusion calculations:** `TacticNode` uses the `<Html>` helper from `@react-three/drei` with occlusion enabled (`occlude={globeRef ? [globeRef] : undefined}`). R3F's HTML helper performs occlusion calculations on render. If the scene is asleep, occlusion will not recalculate, which is correct since the camera and globe are static.

---

## 4. Conclusion & Optimization Proposals

### A. Transition Canvas to Demand-Based Rendering
Modify the `<Canvas>` component to use the demand frameloop:
```jsx
// Proposed Change in MitreHeatmap.jsx
<Canvas 
  frameloop="demand"
  dpr={[1, 1]} 
  camera={{ position: [0, 0, 16], fov: 60 }}
  gl={{ antialias: false, powerPreference: "high-performance" }}
>
```

### B. Consolidate `TechNode` `useFrame` Loops
To eliminate 30–80 individual `useFrame` calls, implement a centralized registry pattern.

1. **Create Registry in Parent `Scene`:**
```javascript
// In Scene component:
const techNodesRegistryRef = useRef([]);

// Batch update all registered nodes in a single useFrame
useFrame((state, delta) => {
  const time = state.clock.elapsedTime;
  const baseScaleSin = 1 + Math.sin(time * 4) * 0.15;
  const pulseSin = 1 + Math.sin(time * 8) * 0.05;
  
  let isAnimating = false;
  
  techNodesRegistryRef.current.forEach((t) => {
    const targetHover = t.isHovered ? 1 : 0;
    const targetFade = t.isTested ? 1 : 0;
    
    // Check if lerp targets are reached
    if (Math.abs(t.hoverScale - targetHover) > 0.001 || Math.abs(t.testedFade - targetFade) > 0.001) {
      isAnimating = true;
    }
    
    // Lerping calculations
    t.hoverScale = THREE.MathUtils.lerp(t.hoverScale, targetHover, delta * 12);
    t.testedFade = THREE.MathUtils.lerp(t.testedFade, targetFade, delta * 8);

    // Apply transformations
    if (t.group) {
      t.group.scale.setScalar(baseScaleSin * Math.max(0, 1 - t.hoverScale * 1.5));
      // NOTE: Removed continuous rotation to allow 0fps idle sleep
    }

    if (t.solidMat) {
      t.solidMat.opacity = t.isVisible ? t.testedFade : 0.1 * t.testedFade;
      t.solidMat.emissiveIntensity = t.testedFade * 6.0;
      t.solidMat.color.set(t.color);
      t.solidMat.emissive.set(t.color);
    }

    if (t.wireMat) {
      t.wireMat.opacity = t.isVisible ? (0.45 * (1 - t.testedFade)) : 0.08 * (1 - t.testedFade);
      t.wireMat.color.set(t.color);
      t.wireMat.emissive.set(t.color);
    }

    if (t.field) {
      if (t.hoverScale > 0.001) {
        t.field.rotation.y -= delta * 1.5;
        t.field.rotation.x += delta * 0.8;
        t.field.scale.setScalar(t.hoverScale * pulseSin);
        t.field.material.opacity = t.hoverScale * 0.45;
        t.field.material.color.set(t.color);
        t.field.material.emissive.set(t.color);
      } else {
        t.field.material.opacity = 0;
      }
    }
  });

  // Keep frame loop alive during active animations or camera transitions
  if (isTransitioningRef.current || isAnimating) {
    state.invalidate();
  }
});
```

2. **Register Individual Nodes via `useEffect`:**
Remove the `useFrame` callback inside `TechNode` and register the refs to the parent instead:
```javascript
// In TechNode component:
useEffect(() => {
  const nodeRef = {
    id: node.label,
    group: groupRef.current,
    solidMat: solidMatRef.current,
    wireMat: wireMatRef.current,
    field: fieldRef.current,
    hoverScale: 0,
    testedFade: isTested ? 1 : 0,
    isHovered,
    isTested,
    color: new THREE.Color(color),
    isVisible
  };
  
  registry.current.push(nodeRef);
  return () => {
    registry.current = registry.current.filter(n => n.id !== node.label);
  };
}, [node.label, isHovered, isTested, color, isVisible, registry]);
```

### C. Visibility & Activity-Aware Continuous Invalidation Scheduler
For the slow globe and star rotations, implement a throttled, tab-visibility aware, and user-inactivity aware scheduler component inside the `Canvas`:

```javascript
import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';

export function FrameloopScheduler({ activeTactic, idleTimeoutMs = 30000, targetFps = 20 }) {
  const { invalidate } = useThree();
  const lastActivityTimeRef = useRef(performance.now());
  const isActiveTacticActive = !!activeTactic;

  useEffect(() => {
    // Globe does not rotate when activeTactic is active, so we don't schedule idle frames
    if (isActiveTacticActive) return;

    let frameId;
    let lastRenderTime = performance.now();
    const interval = 1000 / targetFps;

    // Monitor global user activity
    const handleActivity = () => {
      lastActivityTimeRef.current = performance.now();
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'];
    activityEvents.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));

    const tick = (now) => {
      frameId = requestAnimationFrame(tick);
      
      const timeSinceLastActivity = now - lastActivityTimeRef.current;
      const isVisible = document.visibilityState === 'visible';

      // Sleep if user is idle or page is hidden
      if (timeSinceLastActivity > idleTimeoutMs || !isVisible) {
        return;
      }

      // Throttled render
      const elapsed = now - lastRenderTime;
      if (elapsed >= interval) {
        lastRenderTime = now - (elapsed % interval);
        invalidate();
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      activityEvents.forEach(evt => window.removeEventListener(evt, handleActivity));
    };
  }, [invalidate, isActiveTacticActive, idleTimeoutMs, targetFps]);

  return null;
}
```
Mount this component inside `<Canvas>`:
```jsx
<Canvas frameloop="demand" ...>
  <FrameloopScheduler activeTactic={activeTactic} />
  {/* ... other elements ... */}
</Canvas>
```

### D. Event-Driven Frame Invalidation
1. **TrackballControls:**
   Pass the `onChange` callback to controls to trigger invalidations during pan, tilt, zoom, and inertial glide:
   ```jsx
   <TrackballControls 
     ref={controlsRef} 
     noPan={false} 
     rotateSpeed={4}
     panSpeed={0.5} 
     minDistance={2} 
     maxDistance={35} 
     onStart={() => { isInteractingRef.current = true; }} 
     onEnd={() => { isInteractingRef.current = false; }} 
     onChange={invalidate} // Triggers rendering on camera changes
   />
   ```
2. **Hover States & Transitions:**
   As shown in the consolidated `useFrame` logic (Proposal B), check if `hoverScale` has reached its target value (1 or 0). If it has not, call `invalidate()` to draw the next transition frame. Once the scale lands on the target, stop calling `invalidate()`, allowing the scene to freeze at 0fps.
3. **Window Resize Events:**
   No additional code is needed; R3F Canvas handles window resize events natively under `frameloop="demand"`, triggering resize invalidation automatically.

---

## 5. Verification Method

To verify these performance improvements:

### A. Chrome DevTools Performance Profiling
1. Open the application in Chrome.
2. Open **Chrome DevTools** -> **Performance** tab.
3. Click **Record** and leave the page completely idle for 10 seconds.
4. Click **Stop**.
5. **Expected result (Before):** Constant scripting blocks (CPU execution) and continuous GPU rendering cycles.
6. **Expected result (After):** CPU execution drops to ~0ms/frame, and GPU activity vanishes (0 FPS) during idle states.

### B. Frame Rate (FPS) Invalidation Monitoring
Insert a console log or use a ThreeJS stats helper (like `stats.js` or `r3f-perf`) to verify rendering events.
1. When the mouse is static and no animations are active, the rendering/draw calls should completely freeze (0 updates).
2. Hovering over a node should trigger exactly $N$ frames until the transition animation completes, then immediately freeze again.
3. Dragging/paning the camera should render smoothly, then stop rendering immediately when the damping completes.

### C. Tab Inactivity Verification
1. Open **Chrome DevTools** -> **Rendering** tab.
2. Check **Frame Rendering Stats** (shows real-time FPS overlay).
3. Switch tabs, wait 10 seconds, and switch back. Verify that no GPU frames were rendered while the tab was hidden.
