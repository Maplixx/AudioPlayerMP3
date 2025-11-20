// --- VARIÁVEIS GLOBAIS ---
let audioCtx, analyser, sourceNode, dataArray;
let scene, camera, renderer, sphere;
let originalPositions = []; // Armazena a forma original da bola
let isInitialized = false;

// --- ELEMENTOS DO DOM ---
const btnInit = document.getElementById('btn-init');
const startScreen = document.getElementById('start-screen');
const playerUi = document.getElementById('player-ui');
const audioEl = document.getElementById('audio-source');
const fileInput = document.getElementById('file-input');
const btnPlay = document.getElementById('btn-play');
const debugLog = document.getElementById('debug-log');
const trackInfo = document.getElementById('track-info');

// --- SISTEMA DE LOG DE ERRO (MOBILE) ---
window.onerror = function(msg, url, line) {
    debugLog.style.display = 'block';
    debugLog.innerHTML += `Erro: ${msg} (Linha ${line})<br>`;
};

// --- 1. INICIALIZAR TUDO (No clique do usuário) ---
btnInit.addEventListener('click', () => {
    try {
        // A. Configurar Áudio (Contexto precisa de interação)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128; // Leve e rápido
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Conectar elemento HTML ao WebAudio
        sourceNode = audioCtx.createMediaElementSource(audioEl);
        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);

        // Retomar se estiver suspenso (Bug comum iOS)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        // B. Iniciar 3D
        initThreeJS();

        // C. Transição de Tela
        startScreen.style.opacity = '0';
        setTimeout(() => {
            startScreen.style.display = 'none';
            playerUi.style.display = 'flex';
        }, 500);

        isInitialized = true;

    } catch (e) {
        alert("Erro ao iniciar: " + e.message);
    }
});

// --- 2. CONFIGURAÇÃO THREE.JS ---
function initThreeJS() {
    // Cena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Câmera
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Ajuste para Mobile (Afasta a câmera se a tela for estreita)
    camera.position.z = window.innerWidth < 768 ? 90 : 60;

    // Renderizador
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Otimização Retina
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Luzes
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 10, 10);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    // Objeto: Esfera
    const geometry = new THREE.IcosahedronGeometry(15, 3); // Tamanho 15, Detalhe 3
    const material = new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        wireframe: true,
        roughness: 0.5,
        metalness: 0.5
    });

    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Salvar posições originais dos vértices
    const posAttribute = geometry.attributes.position;
    for (let i = 0; i < posAttribute.count; i++) {
        originalPositions.push({
            x: posAttribute.getX(i),
            y: posAttribute.getY(i),
            z: posAttribute.getZ(i)
        });
    }

    // Loop de Animação
    animate();
}

// --- 3. LOOP DE ANIMAÇÃO ---
function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.002;
    let bass = 0;

    // Analisar Áudio se estiver tocando
    if (isInitialized && !audioEl.paused) {
        analyser.getByteFrequencyData(dataArray);
        
        // Pega a média dos graves (primeiros 5 índices)
        let sum = 0;
        for(let i = 0; i < 5; i++) {
            sum += dataArray[i];
        }
        bass = (sum / 5) / 255; // Normalizado 0.0 a 1.0
    }

    if (sphere) {
        // Rotação Constante
        sphere.rotation.y += 0.004;
        sphere.rotation.z += 0.002;

        // Efeito 1: Cor (Verde -> Azul na batida)
        const hue = 0.35 + (bass * 0.3);
        sphere.material.color.setHSL(hue, 1.0, 0.5);

        // Efeito 2: Deformação "Líquida"
        const positions = sphere.geometry.attributes.position;
        const amp = 1.0 + (bass * 10.0); // Intensidade da explosão

        for (let i = 0; i < positions.count; i++) {
            const o = originalPositions[i];
            
            // Matemática de onda simples (sem bibliotecas pesadas)
            const wave = Math.sin(o.x * 0.3 + time) + Math.cos(o.y * 0.3 + time);
            
            // Direção do vértice (Normal)
            const len = Math.sqrt(o.x*o.x + o.y*o.y + o.z*o.z);
            const nx = o.x/len; 
            const ny = o.y/len; 
            const nz = o.z/len;
            
            // Calcula nova distância
            const dist = 15 + (wave * 0.5 * amp) + (bass * 3);

            positions.setXYZ(i, nx*dist, ny*dist, nz*dist);
        }
        
        positions.needsUpdate = true;
    }

    renderer.render(scene, camera);
}

// --- 4. EVENTOS DE UI ---

// Upload de Arquivo
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    audioEl.src = url;
    trackInfo.innerText = file.name;

    // Tentar tocar
    audioEl.play()
        .then(() => updatePlayIcon(true))
        .catch(() => {
            console.log("Autoplay bloqueado, aguardando clique.");
            updatePlayIcon(false);
        });
});

// Play / Pause
btnPlay.addEventListener('click', () => {
    // Garante contexto ativo no iOS
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    if (audioEl.paused) {
        audioEl.play();
        updatePlayIcon(true);
    } else {
        audioEl.pause();
        updatePlayIcon(false);
    }
});

function updatePlayIcon(isPlaying) {
    const icon = btnPlay.querySelector('i');
    if (isPlaying) {
        icon.className = 'fas fa-pause';
    } else {
        icon.className = 'fas fa-play';
    }
}

// Redimensionamento da Tela
window.addEventListener('resize', () => {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});
