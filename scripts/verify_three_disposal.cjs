const assert = require('assert');

// 1. Mock THREE and SphereGeometry to track lifecycles
const createdGeometries = [];
const disposedGeometries = [];

class MockSphereGeometry {
    constructor(radius, widthSegments, heightSegments) {
        this.radius = radius;
        this.widthSegments = widthSegments;
        this.heightSegments = heightSegments;
        this.attributes = {};
        this.isDisposed = false;
        this.id = createdGeometries.length + 1;
        createdGeometries.push(this);
    }
    
    setAttribute(name, attribute) {
        this.attributes[name] = attribute;
    }
    
    getAttribute(name) {
        return { count: 100 }; // mock attribute count
    }
    
    dispose() {
        if (this.isDisposed) {
            throw new Error(`Double dispose detected on geometry ID: ${this.id}`);
        }
        this.isDisposed = true;
        disposedGeometries.push(this);
    }
}

const THREE = {
    SphereGeometry: MockSphereGeometry,
    Float32BufferAttribute: class {},
    Vector3: class {
        fromBufferAttribute() { return this; }
        distanceTo() { return 1.0; }
    },
    Color: class {
        clone() { return this; }
        lerp() {}
    }
};

// Mock React Hooks Behavior
function simulateComponentLifecycle() {
    console.log("Starting simulation of MitreHeatmap GradientSphere lifecycle...");

    // Store effect cleanups
    let currentCleanup = null;
    let memoizedGeometry = null;

    // Helper to run "useMemo" hook
    const runUseMemo = (nodes) => {
        // Simple mock useMemo logic: if nodes change, recreate
        console.log(`- useMemo executing for nodes: ${JSON.stringify(nodes)}`);
        const geom = new THREE.SphereGeometry(6.9, 64, 64);
        memoizedGeometry = geom;
        return geom;
    };

    // Helper to run "useEffect" hook (disposal logic)
    const runUseEffect = (geom) => {
        // React cleanup function
        const cleanup = () => {
            console.log(`- Running useEffect cleanup for geometry ID: ${geom.id}`);
            geom.dispose();
        };
        currentCleanup = cleanup;
    };

    // --- RENDER 1 (Initial Mount) ---
    console.log("\n--- Render 1: Mount ---");
    let nodes1 = ["Node A"];
    let geom1 = runUseMemo(nodes1);
    runUseEffect(geom1);
    
    assert.strictEqual(createdGeometries.length, 1);
    assert.strictEqual(disposedGeometries.length, 0);
    assert.strictEqual(geom1.isDisposed, false);
    console.log(`- Geometry 1 (ID: ${geom1.id}) created and not disposed.`);

    // --- RENDER 2 (Nodes dependency changes) ---
    console.log("\n--- Render 2: Dependency Changes ---");
    let nodes2 = ["Node A", "Node B"];
    
    // Simulate cleanup of previous render's effect (React does this before running new effect)
    if (currentCleanup) {
        currentCleanup();
    }
    
    let geom2 = runUseMemo(nodes2);
    runUseEffect(geom2);

    assert.strictEqual(createdGeometries.length, 2);
    assert.strictEqual(disposedGeometries.length, 1);
    assert.strictEqual(geom1.isDisposed, true);
    assert.strictEqual(geom2.isDisposed, false);
    console.log(`- Geometry 1 (ID: ${geom1.id}) correctly disposed.`);
    console.log(`- Geometry 2 (ID: ${geom2.id}) created and active.`);

    // --- UNMOUNT ---
    console.log("\n--- Component Unmount ---");
    if (currentCleanup) {
        currentCleanup();
    }

    assert.strictEqual(createdGeometries.length, 2);
    assert.strictEqual(disposedGeometries.length, 2);
    assert.strictEqual(geom2.isDisposed, true);
    console.log(`- Geometry 2 (ID: ${geom2.id}) correctly disposed.`);

    console.log("\nLIFECYCLE SIMULATION COMPLETED SUCCESSFULLY!");
}

simulateComponentLifecycle();
process.exit(0);
