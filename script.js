<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Visualizador Pro V6</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="style.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>

    <div id="start-screen">
        <button id="btn-init" class="neon-btn">ATIVAR SISTEMA</button>
    </div>

    <div id="player-ui" class="ui-visible">
        <div id="track-info">Nenhum arquivo</div>
        <div class="controls">
            <label for="file-input" class="btn-icon"><i class="fas fa-folder-open"></i></label>
            <input type="file" id="file-input" accept="*/*">
            <button id="btn-play" class="btn-play"><i class="fas fa-play"></i></button>
        </div>
    </div>

    <div id="canvas-container"></div>

    <audio id="audio-source" playsinline webkit-playsinline crossorigin="anonymous"></audio>

    <script src="script.js"></script>
</body>
</html>
