let audioCtx, analyser, dataArray, source;
let scene, camera, renderer, sphere;
let originalPositions = [];
let isInit = false;

// Elementos
const canvasDiv = document.getElementById('canvas-container');
const startScreen = document.getElementById('start-screen');
const audioEl = document.getElementById('audio-source');
const btnPlay = document.getElementById('btn-play');
const ui = document.getElementById('player-ui');

// --- 1. INICIAR ---
document.getElementById('btn-init').addEventListener('click', () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512; // Mais detalhe para pegar claps
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    source = audioCtx.createMediaElementSource(audioEl);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    if(audioCtx.state === 'suspended') audioCtx.resume();

    init3D();
    
    // Fade out start screen
    startScreen.style.opacity = 0;
    setTimeout(() => startScreen.style.display = 'none', 500);
    
    // Estado inicial: Blur (pois está pausado)
    canvasDiv.classList.add('canvas-blur');
    
    isInit = true;
});

// --- 2. 3D SETUP ---
function init3D() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.z = window.innerWidth < 768 ? 80 : 60;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasDiv.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 10, 10);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    // Geometria com mais detalhes para os "espinhos"
    const geo = new THREE.IcosahedronGeometry(14, 4);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        wireframe: true,
        roughness: 0.4,
        metalness: 0.6
    });

    sphere = new THREE.Mesh(geo, mat);
    scene.add(sphere);

    // Salvar posições
    const pos = geo.attributes.position;
    for(let i=0; i<pos.count; i++){
        originalPositions.push({ x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) });
    }

    animate();
}

// --- 3. LOOP PRINCIPAL (AQUI ESTÁ A MÁGICA DO SOM) ---
function animate() {
    requestAnimationFrame(animate);

    let bass = 0, mid = 0, treble = 0;

    if(isInit && !audioEl.paused) {
        analyser.getByteFrequencyData(dataArray);
        
        // Separação de Frequências (Aproximada)
        const bassEnd = 20;
        const midEnd = 100;
        const trebleEnd = 200;

        // 1. Graves (Bass) - Batida forte
        let bSum = 0;
        for(let i=0; i<bassEnd; i++) bSum += dataArray[i];
        bass = (bSum / bassEnd) / 255;

        // 2. Médios (Mid) - Vozes e Melodia
        let mSum = 0;
        for(let i=bassEnd; i<midEnd; i++) mSum += dataArray[i];
        mid = (mSum / (midEnd - bassEnd)) / 255;

        // 3. Agudos (Treble) - Claps e Hi-hats
        let tSum = 0;
        for(let i=midEnd; i<trebleEnd; i++) tSum += dataArray[i];
        treble = (tSum / (trebleEnd - midEnd)) / 255;
    }

    if(sphere) {
        const time = Date.now() * 0.001;

        // COR: Agudos deixam branco, Graves deixam verde/azul
        // Se tiver muito 'Treble' (clap), brilha forte
        const hue = 0.4 - (bass * 0.2); // Verde para Azul
        const lightness = 0.5 + (treble * 0.5); // Brilha no clap
        sphere.material.color.setHSL(hue, 1.0, lightness);

        // ROTAÇÃO: Acelerada pelos médios
        sphere.rotation.y += 0.002 + (mid * 0.02);
        sphere.rotation.z += 0.001 + (treble * 0.01);

        // DEFORMAÇÃO
        const positions = sphere.geometry.attributes.position;
        
        for(let i=0; i<positions.count; i++) {
            const o = originalPositions[i];
            
            // Onda Base (Líquido suave)
            const fluid = Math.sin(o.x * 0.5 + time) * Math.cos(o.y * 0.5 + time);
            
            // Espinhos (Agudos/Claps)
            // Usamos seno de alta frequência para criar pontas
            const spike = Math.sin(o.x * 5 + time * 10) * treble; 

            // Batida (Bass) - Expande tudo
            const pulse = bass * 4.0;

            // Calcular distância final
            // Base(14) + Liquido + Batida + Espinhos
            const dist = 14 + (fluid * 2) + pulse + (spike * 3);

            // Normalizar e aplicar
            const len = Math.sqrt(o.x*o.x + o.y*o.y + o.z*o.z);
            positions.setXYZ(i, (o.x/len)*dist, (o.y/len)*dist, (o.z/len)*dist);
        }
        positions.needsUpdate = true;
    }

    renderer.render(scene, camera);
}

// --- EVENTOS ---
document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    audioEl.src = URL.createObjectURL(file);
    document.getElementById('track-info').innerText = file.name;
    
    playAudio();
});

btnPlay.addEventListener('click', () => {
    if(audioEl.paused) playAudio();
    else pauseAudio();
});

function playAudio() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    audioEl.play();
    btnPlay.innerHTML = '<i class="fas fa-pause"></i>';
    
    // EFEITO: Tira o blur e foca na esfera
    canvasDiv.classList.remove('canvas-blur');
    canvasDiv.classList.add('canvas-focus');
    
    // Opcional: Esconde UI levemente
    // ui.classList.remove('ui-visible');
    // ui.classList.add('ui-hidden');
}

function pauseAudio() {
    audioEl.pause();
    btnPlay.innerHTML = '<i class="fas fa-play"></i>';
    
    // EFEITO: Coloca blur e escurece
    canvasDiv.classList.remove('canvas-focus');
    canvasDiv.classList.add('canvas-blur');
    
    // Mostra UI
    // ui.classList.remove('ui-hidden');
    // ui.classList.add('ui-visible');
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
