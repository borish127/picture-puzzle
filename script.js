document.addEventListener('DOMContentLoaded', () => {
    const CONTAINER_SIZE = 400;
    const GRID_SIZE = 4;
    const TILE_COUNT = GRID_SIZE * GRID_SIZE;
    const TILE_SIZE = CONTAINER_SIZE / GRID_SIZE;
    const CONFETTI_COUNT = 50; // Cantidad de piezas de confeti

    const container = document.getElementById('puzzle-container');
    const message = document.getElementById('message');
    const shuffleButton = document.getElementById('shuffle-button');
    const externalLinkButton = document.getElementById('external-link-button');
    const confettiContainer = container.querySelector('.confetti-container');

    const pieceElements = {}; 
    let tiles = [];
    let isGameActive = false;

    const solvedState = Array.from({ length: TILE_COUNT - 1 }, (_, i) => i + 1).concat(0);
    const fullState = Array.from({ length: TILE_COUNT }, (_, i) => i + 1);

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
        clearConfetti(); // Limpia confeti anterior
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
            
            // --- ACTIVAR ANIMACIONES DE VICTORIA Y CONFETI ---
            updatePositions(); // Asegura que la última pieza se muestre en su lugar
            container.classList.add('solved'); // Activa la animación de rebote y desvanecimiento de bordes
            generateConfetti(); // Genera el confeti
            
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
        clearConfetti(); // Limpia confeti si se vuelve a mezclar
        
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

    // --- FUNCIONES DE CONFETI ---
    function generateConfetti() {
        clearConfetti();
        const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'];
        
        for (let i = 0; i < CONFETTI_COUNT; i++) {
            const piece = document.createElement('div');
            piece.classList.add('confetti-piece');
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            
            const startX = Math.random() * CONTAINER_SIZE * 2 - CONTAINER_SIZE / 2; // Rango más amplio
            const startY = -Math.random() * 50; // Desde arriba
            const endX = Math.random() * CONTAINER_SIZE * 1.5 - CONTAINER_SIZE / 4; // Cae dentro del rango
            const endY = CONTAINER_SIZE + Math.random() * 50; // Cae por debajo

            piece.style.setProperty('--start-x', `${startX}px`);
            piece.style.setProperty('--start-y', `${startY}px`);
            piece.style.setProperty('--end-x', `${endX}px`);
            piece.style.setProperty('--end-y', `${endY}px`);

            piece.style.animationDelay = `${Math.random() * 0.5}s`; // Pequeño retraso para dispersión
            piece.style.animationDuration = `${2 + Math.random() * 1}s`; // Duración variable

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

    createPieces();
    initPuzzle();
    shuffleButton.addEventListener('click', shuffleAndStart);
});