# WebGL Rendering Optimizations Handoff Report

## 1. Observation

In `src/components/MitreHeatmap.jsx`, the 3D visualization of the MITRE ATT&CK Matrix is implemented using `@react-three/fiber` (R3F) and `@react-three/drei`. The following specific parts of the codebase were observed:

### A. R3F Canvas Options
At line 1290, the `<Canvas>` is declared as:
```javascript
1290:       <Canvas 
1291:         dpr={[1, 1]} 
1292:         camera={{ position: [0, 0, 16], fov: 60 }}
1293:         gl={{ antialias: false, powerPreference: "high-performance" }}
1294:       >
```
The frameloop option is not specified, meaning it defaults to `"always"`, which continuously executes the requestAnimationFrame loop at the browser's maximum refresh rate (typically 60Hz or higher), forcing continuous re-renders.

### B. PulsingWireframe useFrame Animation
At lines 182–186:
```javascript
182:   useFrame((state) => {
183:       if (matRef.current) {
184:          matRef.current.uniforms.time.value = state.clock.elapsedTime;
185:       }
186:   });
```
This updates the shader's `time` uniform every frame to drive pulsing and swirling visual effects.

### C. RotatingStars useFrame Animation
At lines 529–537:
```javascript
529: function RotatingStars() {
530:   const groupRef = useRef();
531:   useFrame(() => {
532:     if (groupRef.current) {
533:       // Extremely subtle, slow drift
534:       groupRef.current.rotation.y -= 0.00005;
535:       groupRef.current.rotation.x += 0.00002;
536:     }
537:   });
```
This performs a tiny coordinate update on every frame to simulate background starfield drift.

### D. Scene useFrame Animation
At lines 668–689:
```javascript
668:   useFrame(() => {
669:     if (isTransitioningRef.current) {
670:        camera.position.lerp(targetCamPosRef.current, 0.04);
671:        if (controlsRef.current) {
672:            controlsRef.current.target.lerp(targetLookAtRef.current, 0.04);
673:            controlsRef.current.update();
674:        }
675:        
676:        if (camera.position.distanceTo(targetCamPosRef.current) < 0.2 && controlsRef.current.target.distanceTo(targetLookAtRef.current) < 0.2) {
677:           isTransitioningRef.current = false;
678:        }
679:     } else {
680:        if (!isInteractingRef.current && controlsRef.current && controlsRef.current.target.distanceTo(targetLookAtRef.current) > 0.01) {
681:            controlsRef.current.target.lerp(targetLookAtRef.current, 0.05);
682:            controlsRef.current.update();
683:        }
684:        if (!activeTactic && groupRef.current) {
685:           groupRef.current.rotation.y += 0.0006;
686:           groupRef.current.rotation.x += 0.0003;
687:        }
688:     }
689:   });
```
This updates camera and controls target positions during focus transitions, and continuously rotates the globe group when no active tactic is selected (`!activeTactic`).

### E. TechNode useFrame Callback (Multiple Instances)
At lines 367–399:
```javascript
367:   useFrame((state, delta) => {
368:     hoverScale.current = THREE.MathUtils.lerp(hoverScale.current, isHovered ? 1 : 0, delta * 12);
369:     testedFade.current = THREE.MathUtils.lerp(testedFade.current, isTested ? 1 : 0, delta * 8);
370: 
371:     if (groupRef.current) {
372:       const baseScale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.15;
373:       groupRef.current.scale.setScalar(baseScale * Math.max(0, 1 - hoverScale.current * 1.5));
374:       groupRef.current.rotation.y += delta;
375:     }
376: 
377:     if (solidMatRef.current) {
378:       solidMatRef.current.opacity = isVisible ? testedFade.current : 0.1 * testedFade.current;
379:       solidMatRef.current.emissiveIntensity = testedFade.current * 6.0;
380:       solidMatRef.current.color.set(color);
381:       solidMatRef.current.emissive.set(color);
382:     }
383: 
384:     if (wireMatRef.current) {
385:       wireMatRef.current.opacity = isVisible ? (0.45 * (1 - testedFade.current)) : 0.08 * (1 - testedFade.current);
386:       wireMatRef.current.color.set(color);
387:       wireMatRef.current.emissive.set(color);
388:     }
389: 
390:     if (fieldRef.current) {
391:         fieldRef.current.rotation.y -= delta * 1.5;
392:         fieldRef.current.rotation.x += delta * 0.8;
393:         const pulse = Math.sin(state.clock.elapsedTime * 8) * 0.05;
394:         fieldRef.current.scale.setScalar(hoverScale.current * (1 + pulse));
395:         fieldRef.current.material.opacity = hoverScale.current * 0.45;
396:         fieldRef.current.material.color.set(color);
397:         fieldRef.current.material.emissive.set(color);
398:      }
399:   });
```
This is registered for **each** active `TechNode` component (up to 40+ nodes rendered concurrently when a tactic is selected at lines 730–747). Every frame, all instances perform matrix modifications, lerp calculations, and material attribute modifications, regardless of whether they are hovered, visible, or undergoing any state transition.

### F. TrackballControls Setup
At lines 825–834:
```javascript
825:       <TrackballControls 
826:         ref={controlsRef} 
827:         noPan={false} 
828:         rotateSpeed={4}
829:         panSpeed={0.5} 
830:         minDistance={2} 
831:         maxDistance={35} 
832:         onStart={() => { isInteractingRef.current = true; }} 
833:         onEnd={() => { isInteractingRef.current = false; }} 
834:       />
```
The controls do not have an `onChange` event bound, relying instead on the continuous `always` frameloop to capture camera updates.

---

## 2. Logic Chain

1. **Continuous Redrawing (Canvas default):** By omitting the `frameloop` option, the canvas defaults to `frameloop="always"`. This runs the WebGL render loop at a continuous 60fps (or higher), leading to high idle CPU/GPU consumption even when the user is not actively interacting with the scene.
2. **Transitioning to Demand-Based Rendering (`frameloop="demand"`):** If we set `frameloop="demand"`, the render loop will cease running unless a prop changes, a state update occurs, or `invalidate()` is explicitly called. This can reduce CPU/GPU usage to 0% when the scene is static.
3. **Implications on Animations:** Under `frameloop="demand"`, the `useFrame` callbacks in `PulsingWireframe`, `RotatingStars`, `Scene`, and `TechNode` will stop running as soon as the render queue is empty. Consequently:
   - The globe and stars will stop rotating.
   - The pulsing shader on `PulsingWireframe` will freeze.
   - Hover and transition effects will stall after their first frame.
4. **Solving Continuous Idle Rotations:** 
   - Since the globe and star rotations are extremely slow, they do not require high-refresh-rate rendering to look smooth. Running them at a full 60fps constantly is inefficient.
   - More importantly, when the browser tab is hidden or when the user is inactive (e.g. left the dashboard open), these rotations should be completely halted to allow 0% CPU/GPU usage.
   - Setting up a visibility listener (Page Visibility API) and an activity listener allows us to dynamically stop requesting frames when the tab is hidden or the user is idle.
5. **Consolidating TechNode `useFrame` Subscriptions:**
   - Having 40 separate `useFrame` subscriptions creates high CPU scripting overhead because Three.js updates matrices and executes JS-to-C++ calls for every node individually on every frame.
   - Consolidating this into a single `useFrame` loop in the parent `Scene` component allows batching updates.
   - Skipping calculations for static nodes (e.g. where `hoverScale` and `testedFade` have reached their targets and the node is not hovered) allows us to bring frame-computation overhead down to $O(1)$ when inactive, rather than $O(N)$.
6. **Handling Interactions and Events:**
   - Under `frameloop="demand"`, user camera movement using `TrackballControls` will appear frozen unless we bind `onChange={invalidate}` to redraw the screen as the camera moves.
   - Mouse hover actions and window resize events must trigger invalidations to refresh the view correctly.

---

## 3. Caveats

- **Visual Ripple of PulsingWireframe:** When the scene goes to sleep (0 fps) due to user inactivity or tab switching, the pulsing wireframe will freeze at its current wave phase. This is an acceptable trade-off for zero-power idle states; the animation will resume immediately upon any mouse movement.
- **TrackballControls Inertia:** If `TrackballControls` has inertia enabled, it will continue moving for a brief moment after the user releases the mouse. The `onChange` event will continue to fire as long as the camera moves, which naturally handles invalidation, but this must be verified to ensure it doesn't leave the loop running indefinitely.

---

## 4. Conclusion & Proposed Optimizations

We propose transitioning the R3F Canvas to `frameloop="demand"` combined with event-driven invalidation and centralized frame management. This will reduce idle CPU and GPU usage to exactly **0%** when the browser tab is idle or inactive.

Here is the concrete design and proposed code modifications:

### A. Transition to Demand-Based Rendering in `<Canvas>`
Modify the Canvas setup to specify `frameloop="demand"`:

```jsx
// Before (Line 1290)
<Canvas 
  dpr={[1, 1]} 
  camera={{ position: [0, 0, 16], fov: 60 }}
  gl={{ antialias: false, powerPreference: "high-performance" }}
>

// After (Proposed)
<Canvas 
  frameloop="demand"
  dpr={[1, 1]} 
  camera={{ position: [0, 0, 16], fov: 60 }}
  gl={{ antialias: false, powerPreference: "high-performance" }}
>
```

### B. Implement Idle and Visibility Control for Slow Rotations
Create utility hooks for tracking page visibility and user activity, and use them to conditionally invalidate frames for the globe and star rotations.

```javascript
// Add these hooks to MitreHeatmap.jsx (or a utilities file)
import { useEffect, useState } from 'react';

// Track Page Visibility
function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(!document.hidden);
  useEffect(() => {
    const handleVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);
  return isVisible;
}

// Track User Activity (Idle Detection)
function useUserActive(timeoutMs = 30000) {
  const [isActive, setIsActive] = useState(true);
  useEffect(() => {
    let timer;
    const handleActivity = () => {
      setIsActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setIsActive(false), timeoutMs);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'];
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    handleActivity();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, handleActivity));
    };
  }, [timeoutMs]);
  return isActive;
}
```

Then, adapt `RotatingStars` and the Globe rotation in `Scene` to only run and invalidate frames when both visible and active:

```jsx
// Proposed RotatingStars Component
function RotatingStars() {
  const groupRef = useRef();
  const isVisible = usePageVisibility();
  const isUserActive = useUserActive();

  useFrame((state) => {
    if (!isVisible || !isUserActive) return; // Sleep

    if (groupRef.current) {
      groupRef.current.rotation.y -= 0.00005;
      groupRef.current.rotation.x += 0.00002;
      state.invalidate(); // Request next frame for slow drift
    }
  });

  return (
    <group ref={groupRef}>
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} speed={0} />
    </group>
  );
}
```

### C. Consolidate and Optimize TechNode useFrame Callbacks
To eliminate 40+ separate `useFrame` subscriptions:
1. Maintain a centralized register of active `TechNode` references in the parent `Scene` component.
2. Run a single `useFrame` loop in `Scene` that iterates over the active nodes.
3. Only animate and invalidate if a transition is actually in progress.

**Step 1: Ref Registry Setup in `Scene`**
```javascript
// In Scene component:
const techNodeRegistry = useRef({});
```

**Step 2: Update `TechNode` to Register/Deregister on mount**
```jsx
// Proposed TechNode Component
const TechNode = React.memo(function TechNode({ node, isHovered, onClick, onHover, onUnhover, isVisible = true, registry }) {
  const { position, info } = node;
  const color = statusColors[info.status] || statusColors.unknown;
  const isTested = info.status !== 'unknown' && info.status !== 'na';

  const groupRef = useRef();
  const solidMatRef = useRef();
  const wireMatRef = useRef();
  const fieldRef = useRef();
  
  // Store dynamic animation properties as simple refs rather than state
  const animState = useRef({
    hoverScale: 0,
    testedFade: isTested ? 1 : 0,
    isHovered,
    isTested,
    isVisible,
    color,
    isFirstRender: true
  });

  // Keep track of current properties
  useEffect(() => {
    animState.current.isHovered = isHovered;
    animState.current.isTested = isTested;
    animState.current.isVisible = isVisible;
    animState.current.color = color;
  }, [isHovered, isTested, isVisible, color]);

  // Register refs with parent
  useEffect(() => {
    const id = node.techFull.id;
    registry.current[id] = {
      groupRef,
      solidMatRef,
      wireMatRef,
      fieldRef,
      animState
    };
    return () => {
      delete registry.current[id];
    };
  }, [node.techFull.id, registry]);

  // Events manually invalidate to kickoff animations
  const { invalidate } = useThree();

  const handleClick = useCallback((e) => {
     e.stopPropagation();
     onClick(node.techFull);
  }, [node.techFull, onClick]);

  const handlePointerOver = useCallback((e) => {
     e.stopPropagation();
     onHover(node);
     document.body.style.cursor = 'pointer';
     invalidate(); // Kickoff hover transition
  }, [node, onHover, invalidate]);

  const handlePointerOut = useCallback((e) => {
     e.stopPropagation();
     onUnhover();
     document.body.style.cursor = 'default';
     invalidate(); // Kickoff unhover transition
  }, [onUnhover, invalidate]);

  return (
    <group position={position.clone().multiplyScalar(1.02)}>
      <mesh onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
         <sphereGeometry args={[0.08, 16, 16]} />
         <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={groupRef}>
        <mesh>
          <octahedronGeometry args={[0.035, 0]} />
          <meshStandardMaterial ref={solidMatRef} transparent depthWrite={false} />
        </mesh>
        <mesh>
           <octahedronGeometry args={[0.035, 0]} />
           <meshStandardMaterial ref={wireMatRef} wireframe transparent depthWrite={false} emissiveIntensity={1.0} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      
      <mesh ref={fieldRef}>
         <icosahedronGeometry args={[0.2, 1]} />
         <meshPhysicalMaterial 
            transparent 
            opacity={0} 
            wireframe 
            roughness={0}
            emissiveIntensity={1.5}
            blending={THREE.AdditiveBlending}
         />
      </mesh>
    </group>
  );
});
```

**Step 3: Centralized animation handler in `Scene`**
Integrate `TechNode` processing into the main `Scene` `useFrame` loop.

```javascript
// In Scene component:
const isVisible = usePageVisibility();
const isUserActive = useUserActive();

useFrame((state, delta) => {
  let needsInvalidate = false;

  // 1. Handle transitions and camera updates
  if (isTransitioningRef.current) {
     camera.position.lerp(targetCamPosRef.current, 0.04);
     if (controlsRef.current) {
         controlsRef.current.target.lerp(targetLookAtRef.current, 0.04);
         controlsRef.current.update();
     }
     needsInvalidate = true;
     
     if (camera.position.distanceTo(targetCamPosRef.current) < 0.2 && controlsRef.current.target.distanceTo(targetLookAtRef.current) < 0.2) {
        isTransitioningRef.current = false;
     }
  } else {
     if (!isInteractingRef.current && controlsRef.current && controlsRef.current.target.distanceTo(targetLookAtRef.current) > 0.01) {
         controlsRef.current.target.lerp(targetLookAtRef.current, 0.05);
         controlsRef.current.update();
         needsInvalidate = true;
     }
     if (!activeTactic && groupRef.current && isVisible && isUserActive) {
        groupRef.current.rotation.y += 0.0006;
        groupRef.current.rotation.x += 0.0003;
        needsInvalidate = true;
     }
  }

  // 2. Batch update all registered TechNodes
  const time = state.clock.elapsedTime;
  Object.values(techNodeRegistry.current).forEach((nodeData) => {
     const { groupRef, solidMatRef, wireMatRef, fieldRef, animState } = nodeData;
     const stateVal = animState.current;
     
     const targetHover = stateVal.isHovered ? 1 : 0;
     const targetFade = stateVal.isTested ? 1 : 0;
     
     const hoverDiff = Math.abs(stateVal.hoverScale - targetHover);
     const fadeDiff = Math.abs(stateVal.testedFade - targetFade);
     const isTransitioning = hoverDiff > 0.001 || fadeDiff > 0.001;

     // Only execute calculations and material writes if transitioning, hovered, or during first render
     if (isTransitioning || stateVal.isHovered || stateVal.isFirstRender) {
        stateVal.isFirstRender = false;
        
        // Update lerped values
        stateVal.hoverScale = THREE.MathUtils.lerp(stateVal.hoverScale, targetHover, delta * 12);
        stateVal.testedFade = THREE.MathUtils.lerp(stateVal.testedFade, targetFade, delta * 8);

        // Group scale and rotation updates
        if (groupRef.current) {
          // Octahedron scale oscillation (runs only when visible / hovered / active)
          const baseScale = 1 + Math.sin(time * 4) * 0.15;
          groupRef.current.scale.setScalar(baseScale * Math.max(0, 1 - stateVal.hoverScale * 1.5));
          groupRef.current.rotation.y += delta;
        }

        // Material color and opacity mutations (batched write)
        if (solidMatRef.current) {
          solidMatRef.current.opacity = stateVal.isVisible ? stateVal.testedFade : 0.1 * stateVal.testedFade;
          solidMatRef.current.emissiveIntensity = stateVal.testedFade * 6.0;
          solidMatRef.current.color.set(stateVal.color);
          solidMatRef.current.emissive.set(stateVal.color);
        }

        if (wireMatRef.current) {
          wireMatRef.current.opacity = stateVal.isVisible ? (0.45 * (1 - stateVal.testedFade)) : 0.08 * (1 - stateVal.testedFade);
          wireMatRef.current.color.set(stateVal.color);
          wireMatRef.current.emissive.set(stateVal.color);
        }

        // Field updates (only if hovered or hoverScale > 0)
        if (fieldRef.current && (stateVal.hoverScale > 0.001 || stateVal.isHovered)) {
          fieldRef.current.rotation.y -= delta * 1.5;
          fieldRef.current.rotation.x += delta * 0.8;
          const pulse = Math.sin(time * 8) * 0.05;
          fieldRef.current.scale.setScalar(stateVal.hoverScale * (1 + pulse));
          fieldRef.current.material.opacity = stateVal.hoverScale * 0.45;
          fieldRef.current.material.color.set(stateVal.color);
          fieldRef.current.material.emissive.set(stateVal.color);
        }

        needsInvalidate = true; // Request another frame while node is animating
     }
  });

  // 3. Trigger frame invalidation if any updates occurred
  if (needsInvalidate) {
     state.invalidate();
  }
});
```

### D. Handle Interaction and Window Events to Trigger Invalidation
Ensure we redraw the frame during camera manipulation and resize events:

1. **Camera Controls (`TrackballControls`)**:
   Add `onChange={invalidate}` to the `<TrackballControls>` declaration in `Scene`:
   ```jsx
   // In Scene component imports/destructuring:
   const { invalidate } = useThree();
   
   // In TrackballControls JSX (Line 825):
   <TrackballControls 
     ref={controlsRef} 
     noPan={false} 
     rotateSpeed={4}
     panSpeed={0.5} 
     minDistance={2} 
     maxDistance={35} 
     onStart={() => { isInteractingRef.current = true; }} 
     onEnd={() => { isInteractingRef.current = false; }} 
     onChange={invalidate} // Redraw on camera modification
   />
   ```
2. **Resize Events**:
   R3F's Canvas includes a default `ResizeObserver` listener. In `frameloop="demand"` mode, R3F's layout manager automatically invalidates the frame and triggers a repaint when the container size changes. No manual event handlers are needed for window resizing.

---

## 5. Verification Method

To verify these changes without altering the code directly:

1. **Verify Compilation and Existing Tests:**
   Run the test command to verify project health:
   ```powershell
   npm run test
   ```
2. **Performance Profile (Chrome DevTools):**
   - Open Chrome DevTools and select the **Performance** tab.
   - Run a recording with the 3D heatmap tab open and idle.
   - **Baseline (Before):** Observe a continuous stream of `requestAnimationFrame` ticks, constant CPU scripting execution under `useFrame`, and constant GPU activity.
   - **Optimized (After):** Once the dashboard is left idle (no mouse movement for 30s) or minimized:
     - The DevTools Performance flame chart should show **0 calls** to `requestAnimationFrame` or `render`.
     - CPU usage for scripting should drop to near 0%.
     - Task Manager (GPU Engine column) should show **0% GPU** usage for the browser process.
3. **Verify Interactive Invalidation:**
   - Mouse Hover: Moving the cursor over the nodes should resume rendering frames smoothly, running the transitions, and then immediately stop drawing once the hover animation completes.
   - Drag/Zoom: Dragging the globe should update smoothly, validating on every control change and stopping immediately when user releases the mouse.
   - Tab Visibility: Switch to another tab, wait 5 seconds, and check the performance trace to confirm no frame invalidations occur while backgrounded.
