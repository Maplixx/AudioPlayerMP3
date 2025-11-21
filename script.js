let audioCtx, analyser, dataArray, source;
let scene, camera, renderer, sphere, particles;
let originalPositions = [];
let isInit = false;

const ui = document.getElementById('player-ui');
const startScreen = document.getElementById('start-screen');
const canvasDiv = document.getElementById('canvas-container');
const audioEl = document.getElementById('audio-source');
const btnPlay = document.getElementById('btn-play');
const trackName = document.getElementById('track-name');

function iniciarSistema() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        if(!source) {
            source = audioCtx.createMediaElementSource(audioEl);
            source.connect(analyser);
            analyser.connect(audioCtx.destination);
        }

        if(audioCtx.state === 'suspended') audioCtx.resume();

        if(!isInit) {
            init3D();
            isInit = true;
        }
        
        startScreen.style.opacity = 0;
        setTimeout(() => {
            startScreen.style.display = 'none';
            ui.style.display = 'flex';
        }, 500);

    } catch (e) {
        alert("Erro: " + e.message);
    }
}

function carregarArquivo(input) {
    const file = input.files[0];
    if(!file) return;
    
    const url = URL.createObjectURL(file);
    audioEl.src = url;
    trackName.innerText = file.name;
    
    audioEl.play()
        .then(() => {
            atualizarBotaoPlay(true);
            if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        })
        .catch(err => {
            atualizarBotaoPlay(false);
        });
}

function alternarPlay() {
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    if(audioEl.paused) {
        audioEl.play();
        atualizarBotaoPlay(true);
    } else {
        audioEl.pause();
        atualizarBotaoPlay(false);
    }
}

function atualizarBotaoPlay(tocando) {
    if(tocando) {
        btnPlay.innerHTML = '<i class="fas fa-pause"></i>';
        canvasDiv.classList.remove('blur-mode');
        canvasDiv.classList.add('focus-mode');
    } else {
        btnPlay.innerHTML = '<i class="fas fa-play"></i>';
        canvasDiv.classList.remove('focus-mode');
        canvasDiv.classList.add('blur-mode');
    }
}

function init3D() {
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.z = window.innerWidth < 768 ? 100 : 70;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasDiv.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dl = new THREE.DirectionalLight(0x00ff88, 1.5);
    dl.position.set(10, 10, 10);
    scene.add(dl);

    const geo = new THREE.IcosahedronGeometry(16, 3);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x00ff88, wireframe: true, roughness: 0.4, metalness: 0.6
    });
    sphere = new THREE.Mesh(geo, mat);
    scene.add(sphere);

    const pos = geo.attributes.position;
    for(let i=0; i<pos.count; i++) originalPositions.push({x:pos.getX(i), y:pos.getY(i), z:pos.getZ(i)});

    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(600 * 3);
    for(let i=0; i<600*3; i++) pPos[i] = (Math.random()-0.5) * 250;
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ size: 0.6, color: 0xffffff, transparent: true, opacity: 0.5 });
    particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    
    let bass = 0, treble = 0;

    if(isInit && !audioEl.paused && analyser) {
        analyser.getByteFrequencyData(dataArray);
        
        let bSum = 0;
        for(let i=0; i<15; i++) bSum += dataArray[i];
        bass = (bSum / 15) / 255;

        let tSum = 0;
        for(let i=100; i<150; i++) tSum += dataArray[i];
        treble = (tSum / 50) / 255;
    }

    const time = Date.now() * 0.0015;

    if(sphere) {
        sphere.rotation.y += 0.003 + (bass * 0.04);
        sphere.rotation.z += 0.001;

        const hue = 0.35 + (bass * 0.1);
        sphere.material.color.setHSL(hue, 1.0, 0.5 + (treble * 0.4));
        sphere.material.emissive.setHSL(hue, 1.0, bass * 0.4);

        const pos = sphere.geometry.attributes.position;
        const intensity = bass * 2.5; 

        for(let i=0; i<pos.count; i++) {
            const o = originalPositions[i];
            const wave = Math.sin(o.x*0.4 + time*2) * Math.cos(o.y*0.4 + time);
            const spike = Math.sin(o.x*8 + time*8) * treble;
            
            const dist = 16 + wave + (intensity * 2) + (spike * 1.5);
            
            const len = Math.sqrt(o.x*o.x + o.y*o.y + o.z*o.z);
            pos.setXYZ(i, (o.x/len)*dist, (o.y/len)*dist, (o.z/len)*dist);
        }
        pos.needsUpdate = true;
    }
    
    if(particles) {
        particles.rotation.y = -time * 0.05;
        particles.scale.setScalar(1 + (bass * 0.2));
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    if(camera && renderer) {
        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.position.z = window.innerWidth < 768 ? 100 : 70;
    }
});
