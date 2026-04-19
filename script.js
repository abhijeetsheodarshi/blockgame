// Game variables
let camera, scene, renderer;
let gameEnded = false;
let gameStarted = false;
let score = 0;
let blocks = [];
let fallingBlocks = [];

// DOM Elements
const scoreElement = document.getElementById("score");
const gameOverElement = document.getElementById("game-over");
const finalScoreElement = document.getElementById("final-score");
const tryAgainBtn = document.getElementById("try-again");

// Constants
const originalBoxSize = 3;
let boxHeight = 1;
const speedDeceleration = 0.005; // To slow down as game progresses or keep constant
let currentSpeed = 0.15;
const maxSpeed = 0.30;

init();
animate();

function init() {
    // 1. Scene setup
    scene = new THREE.Scene();

    // 2. Camera setup - Orthographic for isometric look
    const aspect = window.innerWidth / window.innerHeight;
    const d = 10;
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 100);
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);

    // 3. Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement); // add canvas

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 0);
    scene.add(dirLight);

    // Initial event listeners
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("mousedown", onAction);
    window.addEventListener("touchstart", onAction, { passive: false });
    tryAgainBtn.addEventListener("click", resetGame);
    
    // Start with foundation
    resetGame();
}

function resetGame() {
    gameEnded = false;
    gameStarted = false;
    score = 0;
    currentSpeed = 0.15;
    scoreElement.innerText = score;
    gameOverElement.classList.add("hidden");

    // Remove old blocks
    blocks.forEach(b => scene.remove(b));
    fallingBlocks.forEach(b => scene.remove(b));
    blocks = [];
    fallingBlocks = [];

    // Reset Camera
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);

    // Add foundation block
    addLayer(0, 0, originalBoxSize, originalBoxSize);
    
    // Add first moving block
    addLayer(0, 0, originalBoxSize, originalBoxSize, "x");
}

function addLayer(x, z, width, depth, direction) {
    const y = boxHeight * blocks.length; // Calculate height
    
    const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color(`hsl(${(blocks.length * 5) % 360}, 100%, 65%)`)
    });
    
    const geometry = new THREE.BoxGeometry(width, boxHeight, depth);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    
    mesh.userData = {
        width: width,
        depth: depth,
        direction: direction,
        state: direction ? "Moving" : "Stopped",
        speed: currentSpeed
    };

    if (direction) {
        // Place it far out
        mesh.position[direction] = -15; // Start off screen
    }

    scene.add(mesh);
    blocks.push(mesh);
}

function onAction(event) {
    if (event.type === 'touchstart') event.preventDefault();
    
    if (gameEnded) return;

    if (!gameStarted) {
        gameStarted = true;
        return; // Just let block move
    }

    const topBlock = blocks[blocks.length - 1];
    const prevBlock = blocks[blocks.length - 2];

    const dir = topBlock.userData.direction;

    // Calculate overlap
    let overlap = topBlock.position[dir] - prevBlock.position[dir];
    let size = dir === 'x' ? topBlock.userData.width : topBlock.userData.depth;

    topBlock.userData.state = "Stopped";

    if (Math.abs(overlap) < 0.1) {
        // PERFECT MATCH
        topBlock.position[dir] = prevBlock.position[dir];
        handlePerfectMatch();
    } else if (Math.abs(overlap) < size) {
        // CUT
        handleCut(topBlock, prevBlock, overlap, dir, size);
    } else {
        // MISS
        gameEnded = true;
        
        // Add to falling to make it animate dropping
        handleMiss(topBlock, dir);
        showGameOver();
        return;
    }

    // Success logic
    score++;
    scoreElement.innerText = score;
    
    // Scale speed
    if (currentSpeed < maxSpeed) currentSpeed += 0.005;

    // Move camera up smoothly by animating slowly over frames?
    // We will do rigid translation for now:
    // camera.position.y += boxHeight; // Will smoothly interpolate in animate!

    // Add next block
    const nextDir = dir === 'x' ? 'z' : 'x';
    addLayer(
        topBlock.position.x,
        topBlock.position.z,
        topBlock.userData.width,
        topBlock.userData.depth,
        nextDir
    );
}

function handlePerfectMatch() {
    // Optional: flash white briefly or sound
}

function handleCut(topBlock, prevBlock, overlap, dir, size) {
    // new size
    const newSize = size - Math.abs(overlap);
    const cutSize = Math.abs(overlap);
    
    // update placement block dimensions
    const newGeo = new THREE.BoxGeometry(
        dir === 'x' ? newSize : topBlock.userData.width,
        boxHeight,
        dir === 'z' ? newSize : topBlock.userData.depth
    );
    topBlock.geometry.dispose(); // clean up
    topBlock.geometry = newGeo;

    // adjust position of placed block
    const placedCenter = prevBlock.position[dir] + (overlap / 2);
    topBlock.position[dir] = placedCenter;
    
    if (dir === 'x') {
        topBlock.userData.width = newSize;
    } else {
        topBlock.userData.depth = newSize;
    }

    // CREATE FALLING BLOCK (the cutoff)
    const cutOffset = placedCenter + (size / 2) * Math.sign(overlap);
    const fallGeo = new THREE.BoxGeometry(
        dir === 'x' ? cutSize : topBlock.userData.width,
        boxHeight,
        dir === 'z' ? cutSize : topBlock.userData.depth
    );
    const fallMaterial = topBlock.material.clone();
    const fallMesh = new THREE.Mesh(fallGeo, fallMaterial);
    
    fallMesh.position.copy(topBlock.position);
    fallMesh.position[dir] = cutOffset;
    
    // physics state
    fallMesh.userData = {
        velocity: new THREE.Vector3(
            // push out a bit
            dir === 'x' ? Math.sign(overlap) * 0.1 : 0,
            0,
            dir === 'z' ? Math.sign(overlap) * 0.1 : 0
        ),
        rotationVec: new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1
        )
    };

    scene.add(fallMesh);
    fallingBlocks.push(fallMesh);
}

function handleMiss(topBlock, dir) {
    topBlock.userData.velocity = new THREE.Vector3(
        dir === 'x' ? topBlock.userData.speed * Math.sign(topBlock.position.x) : 0,
        0,
        dir === 'z' ? topBlock.userData.speed * Math.sign(topBlock.position.z) : 0
    );
    topBlock.userData.rotationVec = new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2
    );
    fallingBlocks.push(topBlock);
}

function showGameOver() {
    finalScoreElement.innerText = score;
    gameOverElement.classList.remove("hidden");
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const d = 10;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    if (gameStarted && !gameEnded) {
        const topBlock = blocks[blocks.length - 1];
        if (topBlock && topBlock.userData.state === "Moving") {
            const dir = topBlock.userData.direction;
            topBlock.position[dir] += topBlock.userData.speed;
            
            // bounce back and forth
            if (topBlock.position[dir] > 15 || topBlock.position[dir] < -15) {
                topBlock.userData.speed *= -1; // reverse direction
            }
        }
    }

    // Animate falling blocks
    for (let i = fallingBlocks.length - 1; i >= 0; i--) {
        const chunk = fallingBlocks[i];
        
        // Basic gravity
        chunk.userData.velocity.y -= 0.01; 
        
        chunk.position.add(chunk.userData.velocity);
        chunk.rotation.x += chunk.userData.rotationVec.x;
        chunk.rotation.y += chunk.userData.rotationVec.y;
        chunk.rotation.z += chunk.userData.rotationVec.z;

        // remove if out of bounds
        if (chunk.position.y < -30) {
            scene.remove(chunk);
            fallingBlocks.splice(i, 1);
        }
    }

    // Smooth camera panning logic
    if (blocks.length > 2) {
        const targetY = (blocks.length - 1) * boxHeight + 10;
        camera.position.y += (targetY - camera.position.y) * 0.1;
    }

    renderer.render(scene, camera);
}
