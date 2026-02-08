document.addEventListener('DOMContentLoaded', () => {
    const imageMap = {
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

    // const CONTAINER_SIZE = 400; // Removed fixed size
    const GRID_SIZE = 4;
    const TILE_COUNT = GRID_SIZE * GRID_SIZE;
    // const TILE_SIZE = CONTAINER_SIZE / GRID_SIZE; // Removed fixed size

    const container = document.getElementById('puzzle-container');
    const message = document.getElementById('message');
    const shuffleButton = document.getElementById('shuffle-button');
    const externalLinkButton = document.getElementById('external-link-button');
    const countdownElement = document.getElementById('countdown-timer');
    const confettiContainer = container.querySelector('.confetti-container');
    const gameContainer = document.querySelector('.game-container');
    const hintElement = document.getElementById('preview-hint');

    const pieceElements = {};
    let tiles = [];
    let isGameActive = false;
    let hasWonOnce = false;
    let countdownTimeout;
    let countdownInterval;
    let previewPressStartTime = 0;
    let hintTimeout;
    const colorThief = new ColorThief();

    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;
    }

    const solvedState = Array.from({ length: TILE_COUNT - 1 }, (_, i) => i + 1).concat(0);
    const fullState = Array.from({ length: TILE_COUNT }, (_, i) => i + 1);

    let touchStartX = 0;
    let touchStartY = 0;
    const SWIPE_THRESHOLD = 30;

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
            // Use percentages for background position
            const xPercent = col * 100 / (GRID_SIZE - 1);
            const yPercent = row * 100 / (GRID_SIZE - 1);
            piece.style.backgroundPosition = `${xPercent}% ${yPercent}%`;

            pieceElements[i] = piece;
            container.appendChild(piece);
        }
    }

    function updatePositions() {

        Object.values(pieceElements).forEach(el => {
            el.classList.remove('top-left-corner', 'top-right-corner', 'bottom-left-corner', 'bottom-right-corner');
        });

        tiles.forEach((pieceId, index) => {
            if (pieceId === 0) return;

            const pieceElement = pieceElements[pieceId];
            const { row, col } = getRowCol(index);

            // Use percentages for positioning
            pieceElement.style.top = `${row * 100 / GRID_SIZE}%`;
            pieceElement.style.left = `${col * 100 / GRID_SIZE}%`;

            if (index === 0) {
                pieceElement.classList.add('top-left-corner');
            } else if (index === GRID_SIZE - 1) {
                pieceElement.classList.add('top-right-corner');
            } else if (index === TILE_COUNT - GRID_SIZE) {
                pieceElement.classList.add('bottom-left-corner');
            } else if (index === TILE_COUNT - 1) {
                pieceElement.classList.add('bottom-right-corner');
            }
        });
    }

    function initPuzzle() {
        isGameActive = false;
        container.classList.remove('solved');
        container.classList.remove('show-preview');
        message.classList.remove('message-highlight');
        shuffleButton.classList.remove('hidden');
        hintElement.classList.remove('visible');
        clearTimeout(hintTimeout);
        shuffleButton.textContent = 'Mezclar y Jugar';
        externalLinkButton.classList.add('hidden');
        countdownElement.classList.add('hidden');
        clearTimeout(countdownTimeout);
        clearInterval(countdownInterval);

        tiles = [...fullState];
        Object.values(pieceElements).forEach(el => {
            el.style.display = 'block';
            el.style.transform = 'none';
            el.style.zIndex = '0';
        });
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
            isGameActive = false;
            hasWonOnce = true;
            shuffleButton.textContent = 'Mezclar y Jugar';

            clearTimeout(countdownTimeout);
            clearInterval(countdownInterval);
            countdownElement.classList.add('hidden');

            // --- ANIMATION START (Simplified FLIP) ---
            // 1. Capture Start Position of the PUZZLE (not wrapper)
            const firstRect = container.getBoundingClientRect();

            // 2. State Change: Apply class AND unhide buttons
            container.classList.add('solved');

            pieceElements[TILE_COUNT].style.display = 'block';
            pieceElements[TILE_COUNT].classList.add('bottom-right-corner');

            // Hide countdown
            countdownElement.classList.add('hidden');

            // Unhide buttons immediately (Opacity 0) to trigger full layout expansion
            shuffleButton.classList.remove('hidden');
            shuffleButton.style.opacity = '0';

            // Check if it is NOT Series D to apply layout change
            const urlParams = new URLSearchParams(window.location.search);
            const imageId = urlParams.get('id');
            const isSeriesD = imageId && imageMap[imageId] && imageId !== 'default' && !imageId.startsWith('c');
            const isSeriesC = imageId && imageId.startsWith('c');

            if (!isSeriesD) {
                gameContainer.classList.add('layout-solved');
            }

            if (isSeriesC || !isSeriesD) {
                // Keep external link hidden initially, will animate in
                externalLinkButton.classList.add('hidden');
                externalLinkButton.classList.remove('visible'); // Reset animation
            }

            // 3. Capture End Position of the PUZZLE
            const lastRect = container.getBoundingClientRect();
            const deltaX = firstRect.left - lastRect.left;
            const deltaY = firstRect.top - lastRect.top;

            // 4. Invert & Play
            const triggerWinState = () => {
                // Message
                message.textContent = winMessageText;
                if (isSeriesC) message.classList.add('message-highlight');

                // Show message (animates via CSS .visible)
                message.style.visibility = 'visible';
                setTimeout(() => message.classList.add('visible'), 100);

                // Show external link (animates via CSS .visible)
                const linkDelay = isSeriesC ? 4000 : 600;
                setTimeout(() => {
                    externalLinkButton.classList.remove('hidden');
                    externalLinkButton.classList.add('visible');
                }, linkDelay);

                // Show shuffle button
                shuffleButton.classList.remove('hidden');
                // Ensure it's visible if we messed with opacity before
                shuffleButton.style.opacity = '1';
            };

            // Only run WAAPI animation on Desktop (non-mobile)
            if (!isMobileDevice() && (deltaX !== 0 || deltaY !== 0)) {
                const animation = container.animate([
                    { transform: `translate(${deltaX}px, ${deltaY}px)` },
                    { transform: 'none' }
                ], { duration: 800, easing: 'ease-in-out' });
                animation.onfinish = triggerWinState;
            } else {
                // Mobile or no movement
                triggerWinState();
            }
            // --- ANIMATION END ---

            // Message handling: Hide initially, show after animation
            message.style.opacity = '0';
            message.style.visibility = 'hidden';
            message.style.transition = 'opacity 0.5s ease-in-out';
            message.textContent = winMessageText; // Set text but keep hidden

            if (isSeriesC) {
                message.classList.add('message-highlight');
            }

            // Delay message appearance until after puzzle move (approx 800ms)
            setTimeout(() => {
                message.style.visibility = 'visible';
                message.style.opacity = '1';

                // Show link button logic (chained after message)
                if (isSeriesC) {
                    setTimeout(() => {
                        externalLinkButton.classList.remove('hidden');
                    }, 4000); // 4s AFTER message appears
                } else {
                    // For others, show immediately with message or slightly after
                    externalLinkButton.classList.remove('hidden');
                }

                shuffleButton.classList.remove('hidden');

            }, 800); // Matches animation duration

            generateConfetti();

            Object.values(pieceElements).forEach(el => {
                el.style.transform = 'scale(1.005) translateZ(0)';
                el.style.zIndex = '1';
            });
        } else {
            if (!hasWonOnce) {
                message.textContent = '';
            }
        }
    }

    function shuffleAndStart() {
        isGameActive = true;
        shuffleButton.textContent = 'Preview';
        container.classList.remove('solved');
        container.classList.remove('show-preview');
        hintElement.classList.remove('visible');
        clearTimeout(hintTimeout);
        message.classList.remove('message-highlight');
        gameContainer.classList.remove('layout-solved');

        Object.values(pieceElements).forEach(el => {
            el.style.transform = 'none';
            el.style.zIndex = '0';
        });

        clearConfetti();
        clearTimeout(countdownTimeout);
        clearInterval(countdownInterval);
        countdownElement.classList.add('hidden');

        // Start countdown logic only if the user hasn't won yet AND it is Series D
        const urlParams = new URLSearchParams(window.location.search);
        const imageId = urlParams.get('id');
        const isSeriesD = imageId && imageMap[imageId] && imageId !== 'default' && !imageId.startsWith('c');

        if (!hasWonOnce && isSeriesD) {
            countdownTimeout = setTimeout(() => {
                startCountdown();
            }, 60000); // 1 minute delay
        }

        pieceElements[TILE_COUNT].style.display = 'none';
        tiles = [...solvedState];

        for (let i = 0; i < 300; i++) {
            const emptyIndex = tiles.indexOf(0);
            const movableIndices = getMovableTiles(emptyIndex);
            const randomIndex = movableIndices[Math.floor(Math.random() * movableIndices.length)];
            [tiles[randomIndex], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[randomIndex]];
        }

        updatePositions();
        if (!hasWonOnce) {
            message.textContent = '';
        }
    }

    function startCountdown() {
        let timeLeft = 60; // 1 minute in seconds
        countdownElement.classList.remove('hidden');
        updateCountdownText(timeLeft);

        countdownInterval = setInterval(() => {
            timeLeft--;
            updateCountdownText(timeLeft);

            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                countdownElement.classList.add('hidden');
                externalLinkButton.classList.remove('hidden');
            }
        }, 1000);
    }

    function updateCountdownText(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const timeString = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        countdownElement.textContent = `Link disponible en: ${timeString}`;
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

        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;

        for (let i = 0; i < 50; i++) {
            const piece = document.createElement('div');
            piece.classList.add('confetti-piece');
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

            const startX = Math.random() * containerWidth * 2 - containerWidth / 2;
            const startY = -Math.random() * 50;
            const endX = Math.random() * containerWidth * 1.5 - containerWidth / 4;
            const endY = containerHeight + Math.random() * 50;

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

    function isTouchInside(event, element) {
        if (!event.changedTouches || event.changedTouches.length === 0) {
            return false;
        }
        const touch = event.changedTouches[0];
        const rect = element.getBoundingClientRect();

        return (
            touch.clientX >= rect.left &&
            touch.clientX <= rect.right &&
            touch.clientY >= rect.top &&
            touch.clientY <= rect.bottom
        );
    }

    container.addEventListener('touchstart', (event) => {
        if (!isMobileDevice()) return;
        if (!isGameActive) return;
        if (event.changedTouches.length > 0) {
            touchStartX = event.changedTouches[0].clientX;
            touchStartY = event.changedTouches[0].clientY;
        }
    }, { passive: false });

    container.addEventListener('touchend', (event) => {
        if (!isMobileDevice()) return;
        if (!isGameActive || event.changedTouches.length === 0) return;

        const touchEndX = event.changedTouches[0].clientX;
        const touchEndY = event.changedTouches[0].clientY;

        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        if (Math.abs(deltaX) < SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_THRESHOLD) {
            return;
        }

        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        const rect = container.getBoundingClientRect();
        const startRelX = touchStartX - rect.left;
        const startRelY = touchStartY - rect.top;

        // Ensure start touch was inside container
        if (startRelX < 0 || startRelX > rect.width || startRelY < 0 || startRelY > rect.height) return;

        const dynamicTileSize = rect.width / GRID_SIZE;

        const col = Math.floor(startRelX / dynamicTileSize);
        const row = Math.floor(startRelY / dynamicTileSize);
        const index = row * GRID_SIZE + col;

        if (index < 0 || index >= TILE_COUNT) return;

        const emptyIndex = tiles.indexOf(0);
        const { row: emptyRow, col: emptyCol } = getRowCol(emptyIndex);
        const { row: tileRow, col: tileCol } = getRowCol(index);

        const dRow = emptyRow - tileRow;
        const dCol = emptyCol - tileCol;

        // Check if move is valid (adjacent)
        const isAdjacent = (Math.abs(dRow) + Math.abs(dCol)) === 1;
        if (!isAdjacent) return;

        // Check if swipe direction matches move direction
        let matches = false;
        if (absX > absY) {
            // Horizontal swipe
            if (deltaX > 0 && dCol > 0) matches = true; // Swipe Right, Empty is Right
            if (deltaX < 0 && dCol < 0) matches = true; // Swipe Left, Empty is Left
        } else {
            // Vertical swipe
            if (deltaY > 0 && dRow > 0) matches = true; // Swipe Down, Empty is Down
            if (deltaY < 0 && dRow < 0) matches = true; // Swipe Up, Empty is Up
        }

        if (matches) {
            event.preventDefault(); // Prevent click
            moveTile(index);
        }
    });

    container.addEventListener('click', (event) => {
        if (!isGameActive) return;
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const dynamicTileSize = rect.width / GRID_SIZE;
        const col = Math.floor(x / dynamicTileSize);
        const row = Math.floor(y / dynamicTileSize);
        const clickedIndex = row * GRID_SIZE + col;
        moveTile(clickedIndex);
    });

    shuffleButton.addEventListener('click', () => {
        if (!isGameActive) {
            shuffleAndStart();
        }
    });

    shuffleButton.addEventListener('mousedown', () => {
        if (isGameActive) {
            container.classList.add('show-preview');
            previewPressStartTime = Date.now();
            hintElement.classList.remove('visible');
            clearTimeout(hintTimeout);
        }
    });

    shuffleButton.addEventListener('mouseup', () => {
        if (isGameActive) {
            container.classList.remove('show-preview');
            const duration = Date.now() - previewPressStartTime;
            if (duration < 100) {
                hintElement.classList.add('visible');
                clearTimeout(hintTimeout);
                hintTimeout = setTimeout(() => {
                    hintElement.classList.remove('visible');
                }, 1000);
            }
        }
    });

    shuffleButton.addEventListener('mouseleave', () => {
        if (isGameActive) {
            container.classList.remove('show-preview');
        }
    });

    shuffleButton.addEventListener('touchstart', (event) => {
        event.preventDefault();
        shuffleButton.classList.add('button-active');
        if (isGameActive) {
            container.classList.add('show-preview');
            previewPressStartTime = Date.now();
            hintElement.classList.remove('visible');
            clearTimeout(hintTimeout);
        }
    }, { passive: false });

    shuffleButton.addEventListener('touchend', (event) => {
        shuffleButton.classList.remove('button-active');
        const touchWasInside = isTouchInside(event, shuffleButton);
        if (isGameActive) {
            container.classList.remove('show-preview');
            const duration = Date.now() - previewPressStartTime;
            if (duration < 100) {
                hintElement.classList.add('visible');
                clearTimeout(hintTimeout);
                hintTimeout = setTimeout(() => {
                    hintElement.classList.remove('visible');
                }, 1000);
            }
        } else if (touchWasInside) {
            shuffleAndStart();
        }
    });

    shuffleButton.addEventListener('touchcancel', (event) => {
        shuffleButton.classList.remove('button-active');
        if (isGameActive) {
            container.classList.remove('show-preview');
        }
    });

    window.addEventListener('pageshow', () => {
        shuffleButton.blur();
        externalLinkButton.blur();
        shuffleButton.classList.remove('button-active');
        externalLinkButton.classList.remove('button-active');
    });

    externalLinkButton.addEventListener('touchstart', (event) => {
        event.preventDefault();
        externalLinkButton.classList.add('button-active');
    }, { passive: false });

    externalLinkButton.addEventListener('touchend', (event) => {
        event.preventDefault();
        externalLinkButton.classList.remove('button-active');
        const touchWasInside = isTouchInside(event, externalLinkButton);
        if (touchWasInside) {
            const url = externalLinkButton.href;
            setTimeout(() => {
                window.location.href = url;
            }, 100);
        }
    });

    externalLinkButton.addEventListener('touchcancel', (event) => {
        event.preventDefault();
        externalLinkButton.classList.remove('button-active');
    });

    createPieces();

    const urlParams = new URLSearchParams(window.location.search);
    const imageId = urlParams.get('id');

    let winMessageText = '';
    const linkParaSerieD = "https://borish127.github.io/invitacion-boda/?grupo=damas";
    const linkParaSerieC = "https://borish127.github.io/invitacion-boda/?grupo=caballeros";
    const linkParaDefault = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

    const textoParaSerieD = "";
    const textoParaSerieC = "Felicitaciones!! Si llegaste hasta aquí es porque has sido invitado a ser Caballero de Honor de Boris.\n Visita el link para ver la invitación completa.";
    const textoParaDefault = "¡Juego Completado!";

    if (imageId && imageId.startsWith('c')) {
        externalLinkButton.href = linkParaSerieC;
        winMessageText = textoParaSerieC;
    } else if (imageId && imageMap[imageId] && imageId !== 'default') {
        externalLinkButton.href = linkParaSerieD;
        winMessageText = textoParaSerieD;
    } else {
        externalLinkButton.href = linkParaDefault;
        winMessageText = textoParaDefault;
    }

    const initialImageUrl = getImageUrlFromUrl();
    setPuzzleImage(initialImageUrl);
});