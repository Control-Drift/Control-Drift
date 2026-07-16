# WebGL Rendering Optimizations Analysis Report

This report outlines the proposed WebGL rendering optimizations for `src/components/MitreHeatmap.jsx` to drastically reduce idle CPU and GPU usage down to 0% when the user is inactive or the tab is backgrounded.

---

## 1. Observation

In `src/components/MitreHeatmap.jsx`, the current rendering architecture relies on default React Three Fiber (R3F) behaviors and multiple per-instance animation loops:

1. **Continuous 60FPS Render Loop**: The `<Canvas>` is declared without the `frameloop` option, defaulting to `always` (forcing R3F to request frames at 60fps or the display's refresh rate continuously):
   - **Line 1290**:
     ```javascript
     <Canvas 
       dpr={[1, 1]} 
       camera={{ position: [0, 0, 16], fov: 60 }}
       gl={{ antialias: false, powerPreference: "high-performance" }}
     >
     ```
2. **Unconsolidated per-instance `useFrame` in `TechNode`**: When zooming into a tactic, a `TechNode` component is rendered for every technique. Each `TechNode` contains its own `useFrame` hook callback:
   - **Line 367-399**:
     ```javascript
     useFrame((state, delta) => {
       hoverScale.current = THREE.MathUtils.lerp(hoverScale.current, isHovered ? 1 : 0, delta * 12);
       testedFade.current = THREE.MathUtils.lerp(testedFade.current, isTested ? 1 : 0, delta * 8);

       if (groupRef.current) {
         const baseScale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.15;
         groupRef.current.scale.setScalar(baseScale * Math.max(0, 1 - hoverScale.current * 1.5));
         groupRef.current.rotation.y += delta;
       }
       // ... updates solidMatRef, wireMatRef, fieldRef on every frame
     ```
   If a tactic contains 40 techniques, this registers **40 separate `useFrame` subscription callbacks** run by R3F on every single frame, leading to high CPU scripting overhead even when the scene is static.
3. **Continuous Shader Animation in `PulsingWireframe`**:
   - **Line 182-186**:
     ```javascript
     useFrame((state) => {
         if (matRef.current) {
            matRef.current.uniforms.time.value = state.clock.elapsedTime;
         }
     });
     ```
4. **Continuous Auto-Rotation in `RotatingStars` and `Scene`**:
   - **Line 531-537 (`RotatingStars`)**:
     ```javascript
     useFrame(() => {
       if (groupRef.current) {
         groupRef.current.rotation.y -= 0.00005;
         groupRef.current.rotation.x += 0.00002;
       }
     });
     ```
   - **Line 684-687 (`Scene`)**:
     ```javascript
     if (!activeTactic && groupRef.current) {
        groupRef.current.rotation.y += 0.0006;
        groupRef.current.rotation.x += 0.0003;
     }
     ```

---

## 2. Logic Chain

1. **Constant Rendering Cost**: R3F's default `frameloop="always"` keeps the GPU executing render passes and post-processing passes (EffectComposer/Bloom) every 16.6ms (at 60Hz), even if the scene is completely static.
2. **Idle CPU Scripting Overhead**: The 50+ individual `useFrame` callbacks registered by `TechNode` instances execute JS lerping math, update matrix states, and modify material uniform properties every frame. This creates substantial scripting overhead on the React thread.
3. **Demand Rendering Transition**: Transitioning to `frameloop="demand"` instructs R3F to only render when props/state change or when `invalidate()` is explicitly called. However, this causes all continuous animations (pulsing, rotations, shader time updates) to stop immediately unless they are driven by a mechanism that requests frames.
4. **External Loop for Slow Auto-Rotation**: To maintain the slow, continuous auto-rotation of the globe and stars *without* constant 60fps renders when idle:
   - We must control the auto-rotation loop using an external `requestAnimationFrame` (rAF) scheduler.
   - We can listen to `visibilitychange` via the **Visibility API** to stop the loop entirely when the browser tab is backgrounded.
   - We can track user interaction events (e.g. mouse, pointer, wheel events) and trigger an **idle timeout** (e.g. 30 seconds). If no interaction is detected, the rotation animation is suspended.
   - To reduce active GPU usage, we can cap this idle auto-rotation loop to **30 FPS** (or even 24 FPS) by checking elapsed delta time. This reduces GPU overhead by 50% while maintaining the slow visual drift.
5. **Consolidating `TechNode` Animation**:
   - We can replace individual `useFrame` callbacks on `TechNode` instances by rendering them via a parent `<TechNodesManager>` component that subscribes to a **single `useFrame` callback**.
   - The manager will iterate over a flat array of refs to update positions, scales, and materials in a single JS loop.
   - To allow the canvas to sleep when the user is idle, we must **eliminate idle pulsing and individual rotation** for static, unhovered nodes.
   - The manager will only request frame updates (`invalidate()`) if a transition is active (lerping `hoverScale` or `testedFade`) or if a node is currently hovered. Once transitions finish, the manager stops calling `invalidate()`, allowing the frame loop to enter a complete sleep state.

---

## 3. Caveats

- **Scope**: The investigation was strictly read-only and restricted to `src/components/MitreHeatmap.jsx`. Similar WebGL optimization patterns may be needed in `src/components/BattleGlobe.jsx` or other 3D views, which were not analyzed.
- **Hardware/Browser Damping**: TrackballControls uses damping, which is automatically handled by the control library's internal change hooks, but requires explicit verification to ensure R3F continues rendering until the camera comes to rest.

---

## 4. Conclusion & Actionable Design Proposals

### Step 1: Canvas Transition to Demand Rendering
Modify `<Canvas>` inside `MitreHeatmap` to enable `frameloop="demand"`. Capping the device pixel ratio (DPR) to `[1, 1]` is already done and should be kept to minimize GPU fragment fill-rate.
```jsx
// C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\src\components\MitreHeatmap.jsx (Line 1290)
<Canvas 
  frameloop="demand"
  dpr={[1, 1]} 
  camera={{ position: [0, 0, 16], fov: 60 }}
  gl={{ antialias: false, powerPreference: "high-performance" }}
>
```

### Step 2: Implement Throttled Auto-Rotation Loop with Idle/Visibility Suspends
In `Scene`, replace the continuous rotation inside `useFrame` with an external `requestAnimationFrame` loop. Hook it up to track window events for idle suspend, document visibility, and a 30 FPS render throttle.
```javascript
// Inside Scene component:
const { invalidate } = useThree();
const autoRotationLoopRef = useRef(null);
const isUserIdleRef = useRef(false);
const lastInteractionTimeRef = useRef(Date.now());
const starsRef = useRef(); // Pass to <RotatingStars ref={starsRef} />

useEffect(() => {
  let active = true;
  let lastTime = 0;
  const fps = 30;
  const interval = 1000 / fps;

  const handleInteraction = () => {
    lastInteractionTimeRef.current = Date.now();
    if (isUserIdleRef.current) {
      isUserIdleRef.current = false;
      if (!autoRotationLoopRef.current && document.visibilityState === 'visible') {
        autoRotationLoopRef.current = requestAnimationFrame(animate);
      }
    }
  };

  // Attach window event listeners to monitor user activity
  const events = ['mousemove', 'pointermove', 'mousedown', 'click', 'wheel', 'touchstart'];
  events.forEach(evt => window.addEventListener(evt, handleInteraction, { passive: true }));

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      if (autoRotationLoopRef.current) {
        cancelAnimationFrame(autoRotationLoopRef.current);
        autoRotationLoopRef.current = null;
      }
    } else if (!isUserIdleRef.current && !autoRotationLoopRef.current) {
      autoRotationLoopRef.current = requestAnimationFrame(animate);
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  function animate(time) {
    if (!active) return;

    // Suspend loop if user is idle for more than 30 seconds
    if (Date.now() - lastInteractionTimeRef.current > 30000) {
      isUserIdleRef.current = true;
      autoRotationLoopRef.current = null;
      return;
    }

    if (document.visibilityState === 'hidden') {
      autoRotationLoopRef.current = null;
      return;
    }

    autoRotationLoopRef.current = requestAnimationFrame(animate);

    const delta = time - lastTime;
    if (delta >= interval) {
      lastTime = time - (delta % interval);
      const deltaMultiplier = delta / 16.67; // Normalize speeds to 60fps equivalent

      // Rotate Globe
      if (!activeTactic && groupRef.current) {
        groupRef.current.rotation.y += 0.0006 * deltaMultiplier;
        groupRef.current.rotation.x += 0.0003 * deltaMultiplier;
      }

      // Rotate Stars
      if (starsRef.current) {
        starsRef.current.rotation.y -= 0.00005 * deltaMultiplier;
        starsRef.current.rotation.x += 0.00002 * deltaMultiplier;
      }

      // Update PulsingWireframe time uniform (removes its internal useFrame)
      if (pulsingWireframeMaterialRef.current) {
        pulsingWireframeMaterialRef.current.uniforms.time.value = time / 1000;
      }

      invalidate();
    }
  }

  // Initial loop start
  autoRotationLoopRef.current = requestAnimationFrame(animate);

  return () => {
    active = false;
    if (autoRotationLoopRef.current) cancelAnimationFrame(autoRotationLoopRef.current);
    events.forEach(evt => window.removeEventListener(evt, handleInteraction));
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [activeTactic, invalidate]);
```

### Step 3: Consolidate `TechNode` `useFrame` Callbacks
Define a single `<TechNodesManager>` component inside `MitreHeatmap.jsx` to coordinate all technique nodes. Share low-polygon geometries globally to reduce GPU draw call memory allocations.

```javascript
// Shared Geometries defined once at module or component parent level
const octahedronGeom = new THREE.OctahedronGeometry(0.035, 0);
const icosahedronGeom = new THREE.IcosahedronGeometry(0.2, 1);
const interactionTargetGeom = new THREE.SphereGeometry(0.08, 8, 8); // Capped at 8x8 segments

function TechNodesManager({ nodes, hoveredTech, onHover, onUnhover, onClick, quickFilter }) {
  const nodesRef = useRef([]);
  const { invalidate } = useThree();

  useEffect(() => {
    nodesRef.current = nodesRef.current.slice(0, nodes.length);
  }, [nodes]);

  useFrame((state, delta) => {
    let needsFrame = false;

    nodes.forEach((node, i) => {
      const refs = nodesRef.current[i];
      if (!refs) return;

      const isHovered = hoveredTech === node;
      const isTested = node.info.status !== 'unknown' && node.info.status !== 'na';
      const color = statusColors[node.info.status] || statusColors.unknown;

      let isVisible = true;
      if (quickFilter === 'critical') isVisible = (node.info.status === 'low' || node.info.status === 'minimal');
      if (quickFilter === 'tested') isVisible = isTested;
      if (quickFilter === 'untested') isVisible = node.info.status === 'unknown';

      // Lerping transitions
      const targetHover = isHovered ? 1 : 0;
      const targetFade = isTested ? 1 : 0;

      const hoverDiff = targetHover - refs.hoverScale;
      const fadeDiff = targetFade - refs.testedFade;

      if (Math.abs(hoverDiff) > 0.001) {
        refs.hoverScale += hoverDiff * delta * 12;
        needsFrame = true;
      } else {
        refs.hoverScale = targetHover;
      }

      if (Math.abs(fadeDiff) > 0.001) {
        refs.testedFade += fadeDiff * delta * 8;
        needsFrame = true;
      } else {
        refs.testedFade = targetFade;
      }

      // Update Node scale and local Y rotation
      if (refs.group) {
        const pulse = isHovered ? Math.sin(state.clock.elapsedTime * 4) * 0.15 : 0;
        refs.group.scale.setScalar((1 + pulse) * Math.max(0, 1 - refs.hoverScale * 1.5));
        
        if (isHovered) {
          refs.group.rotation.y += delta;
          needsFrame = true;
        }
      }

      // Update Materials
      if (refs.solidMat) {
        refs.solidMat.opacity = isVisible ? refs.testedFade : 0.1 * refs.testedFade;
        refs.solidMat.emissiveIntensity = refs.testedFade * 6.0;
        refs.solidMat.color.set(color);
        refs.solidMat.emissive.set(color);
      }

      if (refs.wireMat) {
        refs.wireMat.opacity = isVisible ? (0.45 * (1 - refs.testedFade)) : 0.08 * (1 - refs.testedFade);
        refs.wireMat.color.set(color);
        refs.wireMat.emissive.set(color);
      }

      // Update Hover Forcefield
      if (refs.fieldMesh && refs.fieldMat) {
        if (refs.hoverScale > 0.001) {
          refs.fieldMesh.rotation.y -= delta * 1.5;
          refs.fieldMesh.rotation.x += delta * 0.8;
          const pulse = Math.sin(state.clock.elapsedTime * 8) * 0.05;
          refs.fieldMesh.scale.setScalar(refs.hoverScale * (1 + pulse));
          refs.fieldMat.opacity = refs.hoverScale * 0.45;
          refs.fieldMat.color.set(color);
          refs.fieldMat.emissive.set(color);
          needsFrame = true;
        } else {
          refs.fieldMesh.scale.setScalar(0);
          refs.fieldMat.opacity = 0;
        }
      }
    });

    if (needsFrame) {
      invalidate();
    }
  });

  return (
    <>
      {nodes.map((node, i) => (
        <TechNodeInstance
          key={node.label}
          node={node}
          index={i}
          nodesRef={nodesRef}
          onClick={onClick}
          onHover={onHover}
          onUnhover={onUnhover}
        />
      ))}
    </>
  );
}

const TechNodeInstance = React.memo(function TechNodeInstance({ node, index, nodesRef, onClick, onHover, onUnhover }) {
  const groupRef = useRef();
  const fieldMeshRef = useRef();
  const fieldMatRef = useRef();
  const solidMatRef = useRef();
  const wireMatRef = useRef();

  useEffect(() => {
    const isTested = node.info.status !== 'unknown' && node.info.status !== 'na';
    nodesRef.current[index] = {
      group: groupRef.current,
      fieldMesh: fieldMeshRef.current,
      fieldMat: fieldMatRef.current,
      solidMat: solidMatRef.current,
      wireMat: wireMatRef.current,
      hoverScale: 0,
      testedFade: isTested ? 1 : 0
    };
    return () => {
      nodesRef.current[index] = null;
    };
  }, [node, index, nodesRef]);

  const handleClick = useCallback((e) => {
     e.stopPropagation();
     onClick(node.techFull);
  }, [node.techFull, onClick]);

  const handlePointerOver = useCallback((e) => {
     e.stopPropagation();
     onHover(node);
     document.body.style.cursor = 'pointer';
  }, [node, onHover]);

  const handlePointerOut = useCallback((e) => {
     e.stopPropagation();
     onUnhover();
     document.body.style.cursor = 'default';
  }, [onUnhover]);

  return (
    <group position={node.position.clone().multiplyScalar(1.02)}>
      <mesh onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} geometry={interactionTargetGeom}>
         <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={groupRef}>
        <mesh geometry={octahedronGeom}>
          <meshStandardMaterial ref={solidMatRef} transparent depthWrite={false} />
        </mesh>
        <mesh geometry={octahedronGeom}>
           <meshStandardMaterial ref={wireMatRef} wireframe transparent depthWrite={false} emissiveIntensity={1.0} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      
      <mesh ref={fieldMeshRef} geometry={icosahedronGeom}>
         <meshPhysicalMaterial 
            ref={fieldMatRef}
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

### Step 4: Refactor Controls, Hover, and Resize Invalidation in `Scene`
1. **Camera/Target Transitions**: Update the `useFrame` callback of the `Scene` component to call `invalidate()` only while camera lerp interpolation or target transitions are active.
   ```javascript
   useFrame(() => {
     let needsFrame = false;
     if (isTransitioningRef.current) {
        camera.position.lerp(targetCamPosRef.current, 0.04);
        if (controlsRef.current) {
            controlsRef.current.target.lerp(targetLookAtRef.current, 0.04);
            controlsRef.current.update();
        }
        needsFrame = true;
        
        if (camera.position.distanceTo(targetCamPosRef.current) < 0.2 && controlsRef.current.target.distanceTo(targetLookAtRef.current) < 0.2) {
           isTransitioningRef.current = false;
        }
     } else {
        if (!isInteractingRef.current && controlsRef.current && controlsRef.current.target.distanceTo(targetLookAtRef.current) > 0.01) {
            controlsRef.current.target.lerp(targetLookAtRef.current, 0.05);
            controlsRef.current.update();
            needsFrame = true;
        }
     }

     if (needsFrame) {
       invalidate();
     }
   });
   ```
2. **TrackballControls Change event**: Explicitly trigger `invalidate()` on change.
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
     onChange={() => invalidate()}
   />
   ```
3. **Geometry optimization for static meshes**: Reduce segment counts for the base dark sphere in `innerGlobeRef` to avoid processing unlit vertices:
   ```jsx
   // Reduce from 64x64 to 24x24 segments
   <sphereGeometry args={[radius * 0.99, 24, 24]} />
   ```
   Reduce segment count for the pulsing wireframe:
   ```jsx
   // Reduce from 48x48 to 32x32 segments
   <sphereGeometry args={[radius, 32, 32]} />
   ```

---

## 5. Verification Method

To verify these changes:
1. **Compilation Check**: Run the build step to confirm no syntax or React build errors.
   - Command: `npm run build` or similar bundler command.
2. **Static Frame Rate Audit**:
   - Open the app in a browser and navigate to the MITRE Heatmap tab.
   - Open Chrome DevTools > Rendering panel, and tick **Show ad frames** or **FPS Meter**.
   - Observe that the rendering frame rate goes to **0 FPS** when the user is idle for > 30 seconds or the tab is hidden.
   - When the mouse enters the canvas or when the globe is rotated, the frame rate rises to active status (30fps for idle auto-rotation, 60fps for active user panning/zooming/transitions) and goes back to **0 FPS** as soon as interaction stops.
3. **Visual Quality Checklist**:
   - Verify that the slow auto-rotation looks smooth at 30 FPS.
   - Zoom in and hover over different `TechNode`s to ensure they scale and reveal their forcefields dynamically.
   - Verify that clicking a tactic node correctly centers the camera on the target and stops.
4. **Performance Measurement Script**:
   - Run the headless performance profiler (e.g. `node tests/webgl-perf.spec.js`) to compare active and idle scripting times. Confirm that the idle scripting time is zero.
