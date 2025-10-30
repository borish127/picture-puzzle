document.addEventListener('DOMContentLoaded', () => {
    // --- MAPA DE IMÁGENES CORREGIDO ---
    // Ahora coincide con los nombres de tus archivos.
    const imageMap = {
        'default': 'pictures/default.webp',
        'd1': 'pictures/d1.webp',
        'd2': 'pictures/d2.webp',
        'd3': 'pictures/d3.webp',
        'd4': 'pictures/d4.webp',
        'd5': 'pictures/d5.webp',
        'd6': 'pictures/d6.webp',
        'd7': 'pictures/d7.webp'
    };
    // --- FIN DE LA CORRECCIÓN ---

    const CONTAINER_SIZE = 400;
    const GRID_SIZE = 4;
    const TILE_COUNT = GRID_SIZE * GRID_SIZE;
    const TILE_SIZE = CONTAINER_SIZE / GRID_SIZE;

    const container = document.getElementById('puzzle-container');
    const message = document.getElementById('message');
    const shuffleButton = document.getElementById('shuffle-button');
    const externalLinkButton = document.getElementById('external-link-button');
    const confettiContainer = container.querySelector('.confetti-container');
    
    const pieceElements = {}; 
    let tiles = [];
    let isGameActive = false;
    const colorThief = new ColorThief();

    const solvedState = Array.from({ length: TILE_COUNT - 1 }, (_, i) => i + 1).concat(0);
    const fullState = Array.from({ length: TILE_COUNT }, (_, i) => i + 1);

    function setPuzzleImage(imageUrl) {
        const urlWithPath = `url('${imageUrl}')`;
        document.documentElement.style.setProperty('--puzzle-image', urlWithPath);

        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = imageUrl;

        img.onload = () => {
            try {
                const dominantColor = colorThief.getColor(img);
                const colorRgb = `rgb(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]})`;
                
                shuffleButton.style.backgroundColor = colorRgb;
                
                const luminance = (0.299 * dominantColor[0] + 0.587 * dominantColor[1] + 0.114 * dominantColor[2]) / 255;
                shuffleButton.style.color = luminance > 0.5 ? '#000' : '#fff';
            } catch (e) {
                console.error("Error al procesar el color de la imagen:", e);
                shuffleButton.style.backgroundColor = '#007bff';
                shuffleButton.style.color = '#fff';
            }
        };
        img.onerror = () => {
            console.error("No se pudo cargar la imagen:", imageUrl);
            // Si una imagen falla, carga la de por defecto para que el juego no se rompa
            if (imageUrl !== imageMap['default']) {
                setPuzzleImage(imageMap['default']);
            }
        };

        initPuzzle();
    }
    
    function getImageUrlFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const imageId = urlParams.get('id');
        return imageMap[imageId] || imageMap['default'];
    }

    function createPieces() {
        for (let i = 1; i <= TILE_COUNT; i++) {
            const piece = document.createElement('div');
            piece.classList.add('tile');
            
            const { row, col } = getRowCol(i - 1);
            piece.style.backgroundPosition = `-${col * TILE_SIZE}px -${row * TILE_SIZE}px`;
            
            pieceElements[i] = piece;
            container.appendChild(piece);
        }
    }

    function updatePositions() {
        tiles.forEach((pieceId, index) => {
            if (pieceId === 0) return;
            
            const pieceElement = pieceElements[pieceId];
            const { row, col } = getRowCol(index);
            
            pieceElement.style.top = `${row * TILE_SIZE}px`;
            pieceElement.style.left = `${col * TILE_SIZE}px`;
        });
    }

    function initPuzzle() {
        isGameActive = false;
        container.classList.remove('solved');
        shuffleButton.classList.remove('hidden');
        externalLinkButton.classList.add('hidden');
        
        tiles = [...fullState];
        Object.values(pieceElements).forEach(el => el.style.display = 'block');
        updatePositions();
        clearConfetti();
    }

    function moveTile(clickedIndex) {
        if (!isGameActive) return;

        const emptyIndex = tiles.indexOf(0);
        const { row: clickedRow, col: clickedCol } = getRowCol(clickedIndex);
        const { row: emptyRow, col: emptyCol } = getRowCol(emptyIndex);
        
        if (clickedRow === emptyRow) {
            const step = (clickedIndex < emptyIndex) ? 1 : -1;
            for (let i = emptyIndex; i !== clickedIndex; i -= step) {
                tiles[i] = tiles[i - step];
            }
        } else if (clickedCol === emptyCol) {
            const step = (clickedIndex < emptyIndex) ? GRID_SIZE : -GRID_SIZE;
            for (let i = emptyIndex; i !== clickedIndex; i -= step) {
                tiles[i] = tiles[i - step];
            }
        } else {
            return;
        }

        tiles[clickedIndex] = 0;
        updatePositions();
        checkForWin();
    }

    function getRowCol(index) {
        return {
            row: Math.floor(index / GRID_SIZE),
            col: index % GRID_SIZE,
        };
    }

    function checkForWin() {
        if (JSON.stringify(tiles) === JSON.stringify(solvedState)) {
            message.textContent = '¡Ganaste! 🎉';
            isGameActive = false;
            
            pieceElements[TILE_COUNT].style.display = 'block';
            
            container.classList.add('solved');
            generateConfetti();
            
            shuffleButton.classList.remove('hidden');
            externalLinkButton.classList.remove('hidden');
        } else {
            message.textContent = '';
        }
    }

    function shuffleAndStart() {
        isGameActive = true;
        container.classList.remove('solved');
        shuffleButton.classList.add('hidden');
        externalLinkButton.classList.add('hidden');
        clearConfetti();
        
        pieceElements[TILE_COUNT].style.display = 'none';
        tiles = [...solvedState];

        for (let i = 0; i < 300; i++) {
            const emptyIndex = tiles.indexOf(0);
            const movableIndices = getMovableTiles(emptyIndex);
            const randomIndex = movableIndices[Math.floor(Math.random() * movableIndices.length)];
            [tiles[randomIndex], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[randomIndex]];
        }
        
        updatePositions();
        message.textContent = '';
    }

    function getMovableTiles(emptyIndex) {
        const movable = [];
        const { row, col } = getRowCol(emptyIndex);
        if (row > 0) movable.push(emptyIndex - GRID_SIZE);
        if (row < GRID_SIZE - 1) movable.push(emptyIndex + GRID_SIZE);
        if (col > 0) movable.push(emptyIndex - 1);
        if (col < GRID_SIZE - 1) movable.push(emptyIndex + 1);
        return movable;
    }

    function generateConfetti() {
        clearConfetti();
        const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'];
        
        for (let i = 0; i < 50; i++) {
            const piece = document.createElement('div');
            piece.classList.add('confetti-piece');
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            
            const startX = Math.random() * CONTAINER_SIZE * 2 - CONTAINER_SIZE / 2;
            const startY = -Math.random() * 50;
            const endX = Math.random() * CONTAINER_SIZE * 1.5 - CONTAINER_SIZE / 4;
            const endY = CONTAINER_SIZE + Math.random() * 50;

            piece.style.setProperty('--start-x', `${startX}px`);
            piece.style.setProperty('--start-y', `${startY}px`);
            piece.style.setProperty('--end-x', `${endX}px`);
            piece.style.setProperty('--end-y', `${endY}px`);

            piece.style.animationDelay = `${Math.random() * 0.5}s`;
            piece.style.animationDuration = `${2 + Math.random() * 1}s`;

            confettiContainer.appendChild(piece);
        }
    }

    function clearConfetti() {
        confettiContainer.innerHTML = '';
    }

    container.addEventListener('click', (event) => {
        if (!isGameActive) return;
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);
        const clickedIndex = row * GRID_SIZE + col;
        moveTile(clickedIndex);
    });

    shuffleButton.addEventListener('click', shuffleAndStart);
    
    createPieces();
    const initialImageUrl = getImageUrlFromUrl();
    setPuzzleImage(initialImageUrl);
});