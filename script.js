/* ===================================================================
   Picture Puzzle – Refactored Game Engine
   Module pattern, consolidated state, M3 visual feedback
   =================================================================== */

const PuzzleGame = (() => {
    'use strict';

    // ── CONFIG ──────────────────────────────────────────────────────
    const CONFIG = {
        GRID_SIZE: 4,
        TILE_COUNT: 16, // GRID_SIZE * GRID_SIZE
        SWIPE_THRESHOLD: 30,
        SHUFFLE_ITERATIONS: 300,
        COUNTDOWN_DELAY_MS: 60000,
        COUNTDOWN_DURATION_S: 60,
        HINT_DISPLAY_MS: 1000,
        SHORT_PRESS_THRESHOLD_MS: 100,
        SERIES_C_LINK_DELAY_MS: 4000,
    };

    const IMAGE_MAP = {
        'default': 'pictures/default.webp',
        'd1': 'pictures/d1.webp',
        'd2': 'pictures/d2.webp',
        'd3': 'pictures/d3.webp',
        'd4': 'pictures/d4.webp',
        'd5': 'pictures/d5.webp',
        'd6': 'pictures/d6.webp',
        'd7': 'pictures/d7.webp',
        'd8': 'pictures/d8.webp',
        'c1': 'pictures/c1.webp',
        'c2': 'pictures/c2.webp',
        'c3': 'pictures/c3.webp',
        'c4': 'pictures/c4.webp',
        'c5': 'pictures/c5.webp',
        'c6': 'pictures/c6.webp',
    };

    // Pre-computed solved state: [1, 2, 3, ..., 15, 0]
    const SOLVED_STATE = Array.from({ length: CONFIG.TILE_COUNT - 1 }, (_, i) => i + 1).concat(0);
    // Full state for initial display: [1, 2, 3, ..., 16]
    const FULL_STATE = Array.from({ length: CONFIG.TILE_COUNT }, (_, i) => i + 1);

    // ── STATE ───────────────────────────────────────────────────────
    const state = {
        tiles: [],
        isGameActive: false,
        hasWonOnce: false,
        countdownTimeout: null,
        countdownInterval: null,
        previewPressStartTime: 0,
        hintTimeout: null,
        touchStartX: 0,
        touchStartY: 0,
        winMessageText: '',
        imageId: null,
        isSeriesD: false,
        isSeriesC: false,
    };

    // ── DOM REFS ────────────────────────────────────────────────────
    const dom = {};

    // ── UTILITIES ───────────────────────────────────────────────────
    function getRowCol(index) {
        return {
            row: Math.floor(index / CONFIG.GRID_SIZE),
            col: index % CONFIG.GRID_SIZE,
        };
    }

    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || navigator.maxTouchPoints > 0;
    }

    function isTouchInside(event, element) {
        if (!event.changedTouches || event.changedTouches.length === 0) return false;
        const touch = event.changedTouches[0];
        const rect = element.getBoundingClientRect();
        return (
            touch.clientX >= rect.left &&
            touch.clientX <= rect.right &&
            touch.clientY >= rect.top &&
            touch.clientY <= rect.bottom
        );
    }

    function isSolved() {
        for (let i = 0; i < CONFIG.TILE_COUNT; i++) {
            if (state.tiles[i] !== SOLVED_STATE[i]) return false;
        }
        return true;
    }

    // ── IMAGE SETUP ─────────────────────────────────────────────────
    function getImageUrlFromParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        return IMAGE_MAP[id] || IMAGE_MAP['default'];
    }

    function setPuzzleImage(imageUrl) {
        document.documentElement.style.setProperty('--puzzle-image', `url('${imageUrl}')`);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;

        // Timeout fallback if image never loads
        const imgTimeout = setTimeout(() => {
            applyFallbackButtonColor();
        }, 8000);

        img.onload = () => {
            clearTimeout(imgTimeout);
            try {
                const colorThief = new ColorThief();
                const [r, g, b] = colorThief.getColor(img);
                dom.shuffleButton.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                dom.shuffleButton.style.color = luminance > 0.5 ? '#1a1a2e' : '#ffffff';
            } catch (e) {
                console.error('Error al procesar el color de la imagen:', e);
                applyFallbackButtonColor();
            }
        };

        img.onerror = () => {
            clearTimeout(imgTimeout);
            console.error('No se pudo cargar la imagen:', imageUrl);
            if (imageUrl !== IMAGE_MAP['default']) {
                setPuzzleImage(IMAGE_MAP['default']);
                return;
            }
            applyFallbackButtonColor();
        };

        initPuzzle();
    }

    function applyFallbackButtonColor() {
        dom.shuffleButton.style.backgroundColor = '#007bff';
        dom.shuffleButton.style.color = '#ffffff';
    }

    // ── PUZZLE PIECES ───────────────────────────────────────────────
    const pieceElements = {};

    function createPieces() {
        for (let i = 1; i <= CONFIG.TILE_COUNT; i++) {
            const piece = document.createElement('div');
            piece.classList.add('tile');

            const { row, col } = getRowCol(i - 1);
            const xPercent = col * 100 / (CONFIG.GRID_SIZE - 1);
            const yPercent = row * 100 / (CONFIG.GRID_SIZE - 1);
            piece.style.backgroundPosition = `${xPercent}% ${yPercent}%`;

            pieceElements[i] = piece;
            dom.container.appendChild(piece);
        }
    }

    function updatePositions() {
        // Clear corner classes
        Object.values(pieceElements).forEach(el => {
            el.classList.remove('top-left-corner', 'top-right-corner', 'bottom-left-corner', 'bottom-right-corner');
        });

        state.tiles.forEach((pieceId, index) => {
            if (pieceId === 0) return;

            const pieceElement = pieceElements[pieceId];
            const { row, col } = getRowCol(index);

            pieceElement.style.top = `${row * 100 / CONFIG.GRID_SIZE}%`;
            pieceElement.style.left = `${col * 100 / CONFIG.GRID_SIZE}%`;

            // Assign corner classes
            if (index === 0) {
                pieceElement.classList.add('top-left-corner');
            } else if (index === CONFIG.GRID_SIZE - 1) {
                pieceElement.classList.add('top-right-corner');
            } else if (index === CONFIG.TILE_COUNT - CONFIG.GRID_SIZE) {
                pieceElement.classList.add('bottom-left-corner');
            } else if (index === CONFIG.TILE_COUNT - 1) {
                pieceElement.classList.add('bottom-right-corner');
            }
        });
    }



    // ── GAME LOGIC ──────────────────────────────────────────────────
    function initPuzzle() {
        state.isGameActive = false;
        dom.container.classList.remove('solved', 'show-preview');
        dom.message.classList.remove('message-highlight');
        dom.shuffleButton.classList.remove('hidden');
        dom.hintElement.classList.remove('visible');
        clearTimeout(state.hintTimeout);
        dom.shuffleButton.textContent = 'Mezclar y Jugar';
        dom.externalLinkButton.classList.add('hidden');
        dom.countdownElement.classList.add('hidden');
        clearTimeout(state.countdownTimeout);
        clearInterval(state.countdownInterval);

        state.tiles = [...FULL_STATE];
        Object.values(pieceElements).forEach(el => {
            el.style.display = 'block';
            el.style.transform = 'none';
            el.style.zIndex = '0';
        });
        updatePositions();
        clearConfetti();
    }

    function moveTile(clickedIndex) {
        if (!state.isGameActive) return;

        const emptyIndex = state.tiles.indexOf(0);
        const { row: clickedRow, col: clickedCol } = getRowCol(clickedIndex);
        const { row: emptyRow, col: emptyCol } = getRowCol(emptyIndex);

        let moved = false;

        if (clickedRow === emptyRow) {
            // Same row — slide horizontally
            const step = (clickedIndex < emptyIndex) ? 1 : -1;
            for (let i = emptyIndex; i !== clickedIndex; i -= step) {
                state.tiles[i] = state.tiles[i - step];
            }
            moved = true;
        } else if (clickedCol === emptyCol) {
            // Same column — slide vertically
            const step = (clickedIndex < emptyIndex) ? CONFIG.GRID_SIZE : -CONFIG.GRID_SIZE;
            for (let i = emptyIndex; i !== clickedIndex; i -= step) {
                state.tiles[i] = state.tiles[i - step];
            }
            moved = true;
        }

        if (!moved) return;

        state.tiles[clickedIndex] = 0;
        updatePositions();
        checkForWin();
    }

    function getMovableTiles(emptyIndex) {
        const movable = [];
        const { row, col } = getRowCol(emptyIndex);
        if (row > 0) movable.push(emptyIndex - CONFIG.GRID_SIZE);
        if (row < CONFIG.GRID_SIZE - 1) movable.push(emptyIndex + CONFIG.GRID_SIZE);
        if (col > 0) movable.push(emptyIndex - 1);
        if (col < CONFIG.GRID_SIZE - 1) movable.push(emptyIndex + 1);
        return movable;
    }

    // ── WIN LOGIC ───────────────────────────────────────────────────
    function checkForWin() {
        if (!isSolved()) {
            if (!state.hasWonOnce) {
                dom.message.textContent = '';
            }
            return;
        }

        state.isGameActive = false;
        state.hasWonOnce = true;
        dom.shuffleButton.textContent = 'Mezclar y Jugar';

        // Stop countdowns
        clearTimeout(state.countdownTimeout);
        clearInterval(state.countdownInterval);
        dom.countdownElement.classList.add('hidden');

        // --- FLIP ANIMATION ---
        const firstRect = dom.container.getBoundingClientRect();

        // Apply solved visual state
        dom.container.classList.add('solved');
        pieceElements[CONFIG.TILE_COUNT].style.display = 'block';
        pieceElements[CONFIG.TILE_COUNT].classList.add('bottom-right-corner');



        // Prepare buttons (hidden but in layout for measurement)
        dom.shuffleButton.classList.remove('hidden');
        dom.shuffleButton.style.opacity = '0';

        // Layout class for non-Series-D
        if (!state.isSeriesD) {
            dom.gameContainer.classList.add('layout-solved');
        }

        if (state.isSeriesC || !state.isSeriesD) {
            dom.externalLinkButton.classList.add('hidden');
            dom.externalLinkButton.classList.remove('visible');
        }

        // Capture end position
        const lastRect = dom.container.getBoundingClientRect();
        const deltaX = firstRect.left - lastRect.left;
        const deltaY = firstRect.top - lastRect.top;

        // Consolidated win-state trigger — called exactly once
        const triggerWinState = () => {
            // Message
            dom.message.textContent = state.winMessageText;
            if (state.isSeriesC) dom.message.classList.add('message-highlight');

            dom.message.style.visibility = 'visible';
            dom.message.style.opacity = '1';

            // External link visibility (delayed for Series C)
            const linkDelay = state.isSeriesC ? CONFIG.SERIES_C_LINK_DELAY_MS : 600;
            setTimeout(() => {
                dom.externalLinkButton.classList.remove('hidden');
                dom.externalLinkButton.classList.add('visible');
            }, linkDelay);

            // Show shuffle button
            dom.shuffleButton.classList.remove('hidden');
            dom.shuffleButton.style.opacity = '1';
        };

        // Prepare message (hidden until animation finishes)
        dom.message.style.opacity = '0';
        dom.message.style.visibility = 'hidden';
        dom.message.style.transition = 'opacity 0.5s ease-in-out';
        dom.message.textContent = state.winMessageText;

        if (state.isSeriesC) {
            dom.message.classList.add('message-highlight');
        }

        // WAAPI animation only on desktop if there's movement
        if (!isMobileDevice() && (deltaX !== 0 || deltaY !== 0)) {
            const animation = dom.container.animate([
                { transform: `translate(${deltaX}px, ${deltaY}px)` },
                { transform: 'none' }
            ], { duration: 800, easing: 'ease-in-out' });
            animation.onfinish = triggerWinState;
        } else {
            triggerWinState();
        }

        generateConfetti();


    }

    // ── SHUFFLE & START ─────────────────────────────────────────────
    function shuffleAndStart() {
        state.isGameActive = true;
        dom.shuffleButton.textContent = 'Preview';
        dom.container.classList.remove('solved', 'show-preview');
        dom.hintElement.classList.remove('visible');
        clearTimeout(state.hintTimeout);
        dom.message.classList.remove('message-highlight');
        dom.gameContainer.classList.remove('layout-solved');

        Object.values(pieceElements).forEach(el => {
            el.style.transform = 'none';
            el.style.zIndex = '0';
        });

        clearConfetti();
        clearTimeout(state.countdownTimeout);
        clearInterval(state.countdownInterval);
        dom.countdownElement.classList.add('hidden');

        // Countdown only for Series D (first win)
        if (!state.hasWonOnce && state.isSeriesD) {
            state.countdownTimeout = setTimeout(() => {
                startCountdown();
            }, CONFIG.COUNTDOWN_DELAY_MS);
        }

        pieceElements[CONFIG.TILE_COUNT].style.display = 'none';
        state.tiles = [...SOLVED_STATE];

        // Fisher-Yates-like random moves to ensure solvability
        for (let i = 0; i < CONFIG.SHUFFLE_ITERATIONS; i++) {
            const emptyIndex = state.tiles.indexOf(0);
            const movableIndices = getMovableTiles(emptyIndex);
            const randomIndex = movableIndices[Math.floor(Math.random() * movableIndices.length)];
            [state.tiles[randomIndex], state.tiles[emptyIndex]] = [state.tiles[emptyIndex], state.tiles[randomIndex]];
        }

        updatePositions();

        if (!state.hasWonOnce) {
            dom.message.textContent = '';
        }
    }

    // ── COUNTDOWN ───────────────────────────────────────────────────
    function startCountdown() {
        let timeLeft = CONFIG.COUNTDOWN_DURATION_S;
        dom.countdownElement.classList.remove('hidden');
        updateCountdownText(timeLeft);

        state.countdownInterval = setInterval(() => {
            timeLeft--;
            updateCountdownText(timeLeft);

            if (timeLeft <= 0) {
                clearInterval(state.countdownInterval);
                dom.countdownElement.classList.add('hidden');
                dom.externalLinkButton.classList.remove('hidden');
            }
        }, 1000);
    }

    function updateCountdownText(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remaining = seconds % 60;
        dom.countdownElement.textContent = `Link disponible en: ${minutes}:${remaining.toString().padStart(2, '0')}`;
    }

    // ── CONFETTI ────────────────────────────────────────────────────
    const CONFETTI_COLORS = [
        '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
        '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50',
        '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722',
    ];

    function generateConfetti() {
        clearConfetti();
        const containerWidth = dom.container.offsetWidth;
        const containerHeight = dom.container.offsetHeight;

        for (let i = 0; i < 50; i++) {
            const piece = document.createElement('div');
            piece.classList.add('confetti-piece');
            piece.style.backgroundColor = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];

            const startX = Math.random() * containerWidth * 2 - containerWidth / 2;
            const startY = -Math.random() * 50;
            const endX = Math.random() * containerWidth * 1.5 - containerWidth / 4;
            const endY = containerHeight + Math.random() * 50;

            piece.style.setProperty('--start-x', `${startX}px`);
            piece.style.setProperty('--start-y', `${startY}px`);
            piece.style.setProperty('--end-x', `${endX}px`);
            piece.style.setProperty('--end-y', `${endY}px`);

            piece.style.animationDelay = `${Math.random() * 0.5}s`;
            piece.style.animationDuration = `${2 + Math.random()}s`;

            dom.confettiContainer.appendChild(piece);
        }
    }

    function clearConfetti() {
        dom.confettiContainer.innerHTML = '';
    }

    // ── EVENT HANDLERS ──────────────────────────────────────────────

    // Touch: Swipe to move tiles
    function onContainerTouchStart(event) {
        if (!isMobileDevice() || !state.isGameActive) return;
        if (event.changedTouches.length > 0) {
            state.touchStartX = event.changedTouches[0].clientX;
            state.touchStartY = event.changedTouches[0].clientY;
        }
    }

    function onContainerTouchEnd(event) {
        if (!isMobileDevice() || !state.isGameActive || event.changedTouches.length === 0) return;

        const touchEndX = event.changedTouches[0].clientX;
        const touchEndY = event.changedTouches[0].clientY;
        const deltaX = touchEndX - state.touchStartX;
        const deltaY = touchEndY - state.touchStartY;

        if (Math.abs(deltaX) < CONFIG.SWIPE_THRESHOLD && Math.abs(deltaY) < CONFIG.SWIPE_THRESHOLD) return;

        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        const rect = dom.container.getBoundingClientRect();
        const startRelX = state.touchStartX - rect.left;
        const startRelY = state.touchStartY - rect.top;

        if (startRelX < 0 || startRelX > rect.width || startRelY < 0 || startRelY > rect.height) return;

        const dynamicTileSize = rect.width / CONFIG.GRID_SIZE;
        const col = Math.floor(startRelX / dynamicTileSize);
        const row = Math.floor(startRelY / dynamicTileSize);
        const index = row * CONFIG.GRID_SIZE + col;

        if (index < 0 || index >= CONFIG.TILE_COUNT) return;

        const emptyIndex = state.tiles.indexOf(0);
        const { row: emptyRow, col: emptyCol } = getRowCol(emptyIndex);
        const { row: tileRow, col: tileCol } = getRowCol(index);

        const dRow = emptyRow - tileRow;
        const dCol = emptyCol - tileCol;

        if ((Math.abs(dRow) + Math.abs(dCol)) !== 1) return;

        let matches = false;
        if (absX > absY) {
            if (deltaX > 0 && dCol > 0) matches = true;
            if (deltaX < 0 && dCol < 0) matches = true;
        } else {
            if (deltaY > 0 && dRow > 0) matches = true;
            if (deltaY < 0 && dRow < 0) matches = true;
        }

        if (matches) {
            event.preventDefault();
            moveTile(index);
        }
    }

    // Click: Desktop tile movement
    function onContainerClick(event) {
        if (!state.isGameActive) return;
        const rect = dom.container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const dynamicTileSize = rect.width / CONFIG.GRID_SIZE;
        const col = Math.floor(x / dynamicTileSize);
        const row = Math.floor(y / dynamicTileSize);
        const clickedIndex = row * CONFIG.GRID_SIZE + col;
        moveTile(clickedIndex);
    }

    // Shuffle button: click
    function onShuffleClick() {
        if (!state.isGameActive) {
            shuffleAndStart();
        }
    }

    // Preview: mouse hold
    function onShuffleMouseDown() {
        if (state.isGameActive) {
            dom.container.classList.add('show-preview');
            state.previewPressStartTime = Date.now();
            dom.hintElement.classList.remove('visible');
            clearTimeout(state.hintTimeout);
        }
    }

    function onShuffleMouseUp() {
        if (state.isGameActive) {
            dom.container.classList.remove('show-preview');
            const duration = Date.now() - state.previewPressStartTime;
            if (duration < CONFIG.SHORT_PRESS_THRESHOLD_MS) {
                showHintBriefly();
            }
        }
    }

    function onShuffleMouseLeave() {
        if (state.isGameActive) {
            dom.container.classList.remove('show-preview');
        }
    }

    // Preview: touch hold
    function onShuffleTouchStart(event) {
        event.preventDefault();
        dom.shuffleButton.classList.add('button-active');
        if (state.isGameActive) {
            dom.container.classList.add('show-preview');
            state.previewPressStartTime = Date.now();
            dom.hintElement.classList.remove('visible');
            clearTimeout(state.hintTimeout);
        }
    }

    function onShuffleTouchEnd(event) {
        dom.shuffleButton.classList.remove('button-active');
        const touchWasInside = isTouchInside(event, dom.shuffleButton);
        if (state.isGameActive) {
            dom.container.classList.remove('show-preview');
            const duration = Date.now() - state.previewPressStartTime;
            if (duration < CONFIG.SHORT_PRESS_THRESHOLD_MS) {
                showHintBriefly();
            }
        } else if (touchWasInside) {
            shuffleAndStart();
        }
    }

    function onShuffleTouchCancel() {
        dom.shuffleButton.classList.remove('button-active');
        if (state.isGameActive) {
            dom.container.classList.remove('show-preview');
        }
    }

    function showHintBriefly() {
        dom.hintElement.classList.add('visible');
        clearTimeout(state.hintTimeout);
        state.hintTimeout = setTimeout(() => {
            dom.hintElement.classList.remove('visible');
        }, CONFIG.HINT_DISPLAY_MS);
    }

    // External link button: touch
    function onExternalTouchStart(event) {
        event.preventDefault();
        dom.externalLinkButton.classList.add('button-active');
    }

    function onExternalTouchEnd(event) {
        event.preventDefault();
        dom.externalLinkButton.classList.remove('button-active');
        if (isTouchInside(event, dom.externalLinkButton)) {
            const url = dom.externalLinkButton.href;
            setTimeout(() => { window.location.href = url; }, 100);
        }
    }

    function onExternalTouchCancel(event) {
        event.preventDefault();
        dom.externalLinkButton.classList.remove('button-active');
    }

    // Page show: reset button states
    function onPageShow() {
        dom.shuffleButton.blur();
        dom.externalLinkButton.blur();
        dom.shuffleButton.classList.remove('button-active');
        dom.externalLinkButton.classList.remove('button-active');
    }

    // ── INITIALIZATION ──────────────────────────────────────────────
    function init() {
        // Cache DOM references
        dom.container = document.getElementById('puzzle-container');
        dom.message = document.getElementById('message');
        dom.shuffleButton = document.getElementById('shuffle-button');
        dom.externalLinkButton = document.getElementById('external-link-button');
        dom.countdownElement = document.getElementById('countdown-timer');
        dom.confettiContainer = dom.container.querySelector('.confetti-container');
        dom.gameContainer = document.querySelector('.game-container');
        dom.hintElement = document.getElementById('preview-hint');

        // Determine series from URL
        const urlParams = new URLSearchParams(window.location.search);
        state.imageId = urlParams.get('id');
        state.isSeriesD = !!(state.imageId && IMAGE_MAP[state.imageId] && state.imageId !== 'default' && !state.imageId.startsWith('c'));
        state.isSeriesC = !!(state.imageId && state.imageId.startsWith('c'));

        // Determine win text & link
        const linkParaSerieD = 'https://borish127.github.io/invitacion-boda/?grupo=damas';
        const linkParaSerieC = 'https://borish127.github.io/invitacion-boda/?grupo=caballeros';
        const linkParaDefault = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

        const textoParaSerieD = '';
        const textoParaSerieC = 'Felicitaciones!! Si llegaste hasta aquí es porque has sido invitado a ser Caballero de Honor de Boris.\n Visita el link para ver la invitación completa.';
        const textoParaDefault = '¡Juego Completado!';

        if (state.isSeriesC) {
            dom.externalLinkButton.href = linkParaSerieC;
            state.winMessageText = textoParaSerieC;
        } else if (state.isSeriesD) {
            dom.externalLinkButton.href = linkParaSerieD;
            state.winMessageText = textoParaSerieD;
        } else {
            dom.externalLinkButton.href = linkParaDefault;
            state.winMessageText = textoParaDefault;
        }

        // Create pieces and set image
        createPieces();
        const initialImageUrl = getImageUrlFromParams();
        setPuzzleImage(initialImageUrl);

        // Bind events
        dom.container.addEventListener('touchstart', onContainerTouchStart, { passive: false });
        dom.container.addEventListener('touchend', onContainerTouchEnd);
        dom.container.addEventListener('click', onContainerClick);

        dom.shuffleButton.addEventListener('click', onShuffleClick);
        dom.shuffleButton.addEventListener('mousedown', onShuffleMouseDown);
        dom.shuffleButton.addEventListener('mouseup', onShuffleMouseUp);
        dom.shuffleButton.addEventListener('mouseleave', onShuffleMouseLeave);
        dom.shuffleButton.addEventListener('touchstart', onShuffleTouchStart, { passive: false });
        dom.shuffleButton.addEventListener('touchend', onShuffleTouchEnd);
        dom.shuffleButton.addEventListener('touchcancel', onShuffleTouchCancel);

        dom.externalLinkButton.addEventListener('touchstart', onExternalTouchStart, { passive: false });
        dom.externalLinkButton.addEventListener('touchend', onExternalTouchEnd);
        dom.externalLinkButton.addEventListener('touchcancel', onExternalTouchCancel);

        window.addEventListener('pageshow', onPageShow);
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', PuzzleGame.init);