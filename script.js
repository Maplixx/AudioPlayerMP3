// Globais
let audioCtx, analyser, dataArray, source;
let scene, camera, renderer, sphere, particles;
let originalPositions = [];
let isInitialized = false;

// Elementos
const ui = document.getElementById('player-ui');
const startScreen = document.getElementById('start-screen');
const canvasDiv = document.getElementById('canvas-container');
const audioEl = document.getElementById('audio-source');
const btnPlay = document.getElementById('btn-play');
const trackName = document.getElementById('track-name');

// --- 1. INICIALIZAÇÃO ---
document.getElementById('btn-init').addEventListener('click', () => {
    // Configura Audio Context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512; // Precisão média
    analyser.smoothingTimeConstant = 0.7; // Suavização (0 = travado, 1 = lento)
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    source = audioCtx.createMediaElementSource(audioEl);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    if(audioCtx.state === 'suspended') audioCtx.resume();

    // Configura 3D
    init3D();
    
    // Animação de entrada
    startScreen.style.opacity = 0;
    setTimeout(() => startScreen.style.display = 'none', 600);
    
    // Mostra UI e define estado inicial (Blur)
    ui.classList.remove('ui-hidden');
    ui.classList.add('ui-visible');
    canvasDiv.classList.add('blur-mode');

    isInitialized = true;
});

// --- 2. VISUAIS 3D (COM PARTÍCULAS) ---
function init3D() {
    scene = new THREE.Scene();
    // Fundo transparente para ver o degradê do CSS
    
    camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.z = window.innerWidth < 768 ? 85 : 60;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasDiv.appendChild(renderer.domElement);

    // Luzes
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0x00ff88, 1.5);
    dirLight.position.set(10, 20, 20);
    scene.add(dirLight);

    // ESFERA PRINCIPAL
    const geo = new THREE.IcosahedronGeometry(16, 3);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        wireframe: true,
        roughness: 0.2,
        metalness: 0.8,
        emissive: 0x003311,
        emissiveIntensity: 0.2
    });
    sphere = new THREE.Mesh(geo, mat);
    scene.add(sphere);

    // Salva posições originais
    const pos = geo.attributes.position;
    for(let i=0; i<pos.count; i++){
        originalPositions.push({ x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) });
    }

    // SISTEMA DE PARTÍCULAS (Poeira Estelar)
    const partGeo = new THREE.BufferGeometry();
    const partCount = 800;
    const posArray = new Float32Array(partCount * 3);

    for(let i=0; i<partCount * 3; i++) {
        // Espalha partículas numa área grande
        posArray[i] = (Math.random() - 0.5) * 200; 
    }
    partGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const partMat = new THREE.PointsMaterial({
        size: 0.8,
        color: 0xffffff,
        transparent: true,
        opacity: 0.6
    });
    particles = new THREE.Points(partGeo, partMat);
    scene.add(particles);

    animate();
}

// --- 3. LOOP DE ANIMAÇÃO REFINADO ---
function animate() {
    requestAnimationFrame(animate);

    let bass = 0, high = 0;

    if(isInitialized && !audioEl.paused) {
        analyser.getByteFrequencyData(dataArray);
        
        // Detecção de Grave (Bass) - 0 a 10
        let bSum = 0;
        for(let i=0; i<10; i++) bSum += dataArray[i];
        let rawBass = (bSum / 10) / 255;
        
        // FÓRMULA DE "KICK": 
        // Ignora sons baixos (menos de 0.3) e amplifica os altos exponencialmente
        // Isso faz a batida ficar "seca" e forte
        bass = Math.max(0, (rawBass - 0.25)) * 2.5; 
        
        // Detecção de Agudos (High) - 100 a 150
        let hSum = 0;
        for(let i=100; i<150; i++) hSum += dataArray[i];
        high = (hSum / 50) / 255;
    }

    const time = Date.now() * 0.001;

    if(sphere) {
        // Rotação
        sphere.rotation.y += 0.003 + (bass * 0.02);
        sphere.rotation.z += 0.001;

        // Cor e Brilho (Reage ao Kick)
        // Verde base (0.35) até Ciano/Branco no pico
        const hue = 0.35 + (bass * 0.1); 
        sphere.material.color.setHSL(hue, 1.0, 0.5 + (bass * 0.3));
        sphere.material.emissiveIntensity = 0.2 + (bass * 1.5); // Brilha forte na batida

        // Deformação dos Vértices
        const positions = sphere.geometry.attributes.position;
        
        // Intensidade da distorção
        const impact = bass * 6.0; // Força da explosão
        const wobble = Math.sin(time * 2) * 0.5; // Respiração suave

        for(let i=0; i<positions.count; i++) {
            const o = originalPositions[i];
            const len = Math.sqrt(o.x*o.x + o.y*o.y + o.z*o.z);
            
            // Direção normalizada
            const nx = o.x/len; const ny = o.y/len; const nz = o.z/len;

            // Onda complexa para textura
            const wave = Math.sin(o.x * 0.4 + time * 3) * Math.cos(o.y * 0.4 + time * 2);
            
            // Distância Final: Raio Base(16) + Respiração + Batida + Onda
            // A batida (impact) multiplica a onda para deixar pontudo quando bate
            const dist = 16 + wobble + (impact * 2) + (wave * (1 + impact));

            positions.setXYZ(i, nx*dist, ny*dist, nz*dist);
        }
        positions.needsUpdate = true;
    }

    // Animação das Partículas
    if(particles) {
        particles.rotation.y = -time * 0.1; // Gira o universo devagar
        // Partículas pulam com o som
        particles.scale.setScalar(1 + (bass * 0.3)); 
    }

    renderer.render(scene, camera);
}

// --- 4. CONTROLE DE ARQUIVO E UI ---
document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    audioEl.src = URL.createObjectURL(file);
    trackName.innerText = file.name;
    
    // Tenta autoplay
    playFunc();
});

btnPlay.addEventListener('click', () => {
    if(audioEl.paused) playFunc();
    else pauseFunc();
});

function playFunc() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    
    audioEl.play().then(() => {
        // Muda ícone
        btnPlay.innerHTML = '<i class="fas fa-pause"></i>';
        
        // Efeito VISUAL: Remove Blur, Foca na bola
        canvasDiv.classList.remove('blur-mode');
        canvasDiv.classList.add('focus-mode');
        
        // Diminui opacidade da UI pra focar no show
        ui.style.opacity = 0.6; 
        
    }).catch(err => console.log("Erro play:", err));
}

function pauseFunc() {
    audioEl.pause();
    btnPlay.innerHTML = '<i class="fas fa-play"></i>';
    
    // Efeito VISUAL: Adiciona Blur, Desfoca
    canvasDiv.classList.remove('focus-mode');
    canvasDiv.classList.add('blur-mode');
    
    // Restaura UI
    ui.style.opacity = 1;
}

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
