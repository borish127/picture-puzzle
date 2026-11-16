/* ===================================================================
   Picture Puzzle – Game Engine
   Module pattern, Pointer Events, Spatial Keyboard Navigation,
   WCAG Contrast, Popover Hint & Trusted-Types-Safe DOM Updates
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
        HINT_DISPLAY_MS: 1800,
        SHORT_PRESS_THRESHOLD_MS: 100,
        SERIES_C_LINK_DELAY_MS: 4000,
        WCAG_LUMINANCE_THRESHOLD: 0.17913,
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
        linkRevealTimeout: null,
        previewPressStartTime: 0,
        hintTimeout: null,
        activePointerId: null,
        pointerStartX: 0,
        pointerStartY: 0,
        pointerStartTileIndex: -1,
        suppressNextBoardClick: false,
        shufflePointerId: null,
        keyboardPreviewActive: false,
        rovingPieceId: 1,
        winMessageText: '',
        imageId: null,
        isSeriesD: false,
        isSeriesC: false,
        supportsPopover: false,
        supportsAnchorPos: false,
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

    function prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function getRelativeLuminance(r, g, b) {
        const [lr, lg, lb] = [r, g, b].map((channel) => {
            const s = channel / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
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
        return (id && Object.hasOwn(IMAGE_MAP, id)) ? IMAGE_MAP[id] : IMAGE_MAP['default'];
    }

    function setPuzzleImage(imageUrl) {
        document.documentElement.style.setProperty('--puzzle-image', `url('${imageUrl}')`);

        const img = new Image();
        img.fetchPriority = 'high';
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
                const bg = `rgb(${r} ${g} ${b})`;
                const fg = getRelativeLuminance(r, g, b) > CONFIG.WCAG_LUMINANCE_THRESHOLD
                    ? '#1a1a2e'
                    : '#ffffff';
                dom.shuffleButton.style.setProperty('--shuffle-bg', bg);
                dom.shuffleButton.style.setProperty('--shuffle-fg', fg);
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
        dom.shuffleButton.style.removeProperty('--shuffle-bg');
        dom.shuffleButton.style.removeProperty('--shuffle-fg');
    }

    // ── PUZZLE PIECES ───────────────────────────────────────────────
    const pieceElements = {};

    function createPieces() {
        const fragment = document.createDocumentFragment();
        for (let i = 1; i <= CONFIG.TILE_COUNT; i++) {
            const isPlayable = i < CONFIG.TILE_COUNT;
            const piece = document.createElement(isPlayable ? 'button' : 'div');
            if (isPlayable) {
                piece.type = 'button';
                piece.disabled = true;
                piece.tabIndex = i === 1 ? 0 : -1;
            } else {
                piece.setAttribute('aria-hidden', 'true');
            }
            piece.classList.add('tile');
            piece.dataset.pieceId = String(i);

            const { row, col } = getRowCol(i - 1);
            const xPercent = (col * 100) / (CONFIG.GRID_SIZE - 1);
            const yPercent = (row * 100) / (CONFIG.GRID_SIZE - 1);
            piece.style.backgroundPosition = `${xPercent}% ${yPercent}%`;

            pieceElements[i] = piece;
            fragment.appendChild(piece);
        }
        dom.container.appendChild(fragment);
    }

    function setTilesEnabled(enabled) {
        for (let i = 1; i < CONFIG.TILE_COUNT; i++) {
            pieceElements[i].disabled = !enabled;
        }
    }

    function setRovingFocus(pieceId) {
        if (!pieceElements[pieceId] || pieceId === CONFIG.TILE_COUNT) return;
        for (let i = 1; i < CONFIG.TILE_COUNT; i++) {
            pieceElements[i].tabIndex = i === pieceId ? 0 : -1;
        }
        state.rovingPieceId = pieceId;
    }

    function updatePositions() {
        Object.values(pieceElements).forEach((el) => {
            el.classList.remove('top-left-corner', 'top-right-corner', 'bottom-left-corner', 'bottom-right-corner');
        });

        state.tiles.forEach((pieceId, index) => {
            if (pieceId === 0) return;

            const pieceElement = pieceElements[pieceId];
            const { row, col } = getRowCol(index);

            pieceElement.style.setProperty('--row', String(row));
            pieceElement.style.setProperty('--col', String(col));
            pieceElement.dataset.index = String(index);

            if (pieceId < CONFIG.TILE_COUNT) {
                pieceElement.setAttribute(
                    'aria-label',
                    `Pieza ${pieceId}, fila ${row + 1}, columna ${col + 1}`,
                );
            }

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
        dom.message.classList.remove('message-highlight', 'is-pending');
        dom.shuffleButton.hidden = false;
        dom.shuffleButton.removeAttribute('aria-describedby');
        delete dom.shuffleButton.dataset.mode;
        dom.shuffleButton.textContent = 'Mezclar y Jugar';
        hideHint();
        clearTimeout(state.hintTimeout);
        clearTimeout(state.linkRevealTimeout);
        dom.externalLinkButton.hidden = true;
        dom.countdownElement.hidden = true;
        clearTimeout(state.countdownTimeout);
        clearInterval(state.countdownInterval);

        state.tiles = [...FULL_STATE];
        setTilesEnabled(false);
        Object.values(pieceElements).forEach((el) => {
            el.hidden = false;
            el.style.zIndex = '0';
        });
        updatePositions();
        clearConfetti();
    }

    function moveTile(clickedIndex) {
        if (!state.isGameActive || clickedIndex < 0 || clickedIndex >= CONFIG.TILE_COUNT) return;

        const emptyIndex = state.tiles.indexOf(0);
        const { row: clickedRow, col: clickedCol } = getRowCol(clickedIndex);
        const { row: emptyRow, col: emptyCol } = getRowCol(emptyIndex);

        let moved = false;

        if (clickedRow === emptyRow) {
            const step = clickedIndex < emptyIndex ? 1 : -1;
            for (let i = emptyIndex; i !== clickedIndex; i -= step) {
                state.tiles[i] = state.tiles[i - step];
            }
            moved = true;
        } else if (clickedCol === emptyCol) {
            const step = clickedIndex < emptyIndex ? CONFIG.GRID_SIZE : -CONFIG.GRID_SIZE;
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
        setTilesEnabled(false);
        hidePreview();
        hideHint();
        dom.shuffleButton.removeAttribute('aria-describedby');
        delete dom.shuffleButton.dataset.mode;
        dom.shuffleButton.textContent = 'Mezclar y Jugar';

        clearTimeout(state.countdownTimeout);
        clearInterval(state.countdownInterval);
        clearTimeout(state.linkRevealTimeout);
        dom.countdownElement.hidden = true;

        // --- FLIP ANIMATION ---
        const firstRect = dom.container.getBoundingClientRect();

        dom.container.classList.add('solved');
        pieceElements[CONFIG.TILE_COUNT].hidden = false;
        pieceElements[CONFIG.TILE_COUNT].classList.add('bottom-right-corner');

        if (!state.isSeriesD) {
            dom.gameContainer.classList.add('layout-solved');
        }

        if (state.isSeriesC || !state.isSeriesD) {
            dom.externalLinkButton.hidden = true;
        }

        const lastRect = dom.container.getBoundingClientRect();
        const deltaX = firstRect.left - lastRect.left;
        const deltaY = firstRect.top - lastRect.top;

        const triggerWinState = () => {
            dom.message.classList.remove('is-pending');
            dom.message.textContent = state.winMessageText;
            if (state.isSeriesC) {
                dom.message.classList.add('message-highlight');
            }

            const linkDelay = state.isSeriesC ? CONFIG.SERIES_C_LINK_DELAY_MS : 600;
            state.linkRevealTimeout = setTimeout(() => {
                dom.externalLinkButton.hidden = false;
            }, linkDelay);

            dom.shuffleButton.disabled = false;
            dom.shuffleButton.style.removeProperty('opacity');
        };

        dom.message.classList.add('is-pending');
        dom.message.textContent = state.winMessageText;
        if (state.isSeriesC) {
            dom.message.classList.add('message-highlight');
        }

        if (!prefersReducedMotion() && (deltaX !== 0 || deltaY !== 0)) {
            dom.shuffleButton.disabled = true;
            dom.shuffleButton.style.opacity = '0';
            const animation = dom.container.animate(
                [
                    { transform: `translate(${deltaX}px, ${deltaY}px)` },
                    { transform: 'none' },
                ],
                { duration: 800, easing: 'ease-in-out' },
            );
            animation.onfinish = triggerWinState;
            animation.oncancel = triggerWinState;
        } else {
            triggerWinState();
        }

        if (!prefersReducedMotion()) {
            generateConfetti();
        }
    }

    // ── SHUFFLE & START ─────────────────────────────────────────────
    function shuffleAndStart() {
        state.isGameActive = true;
        dom.shuffleButton.textContent = 'Preview';
        dom.shuffleButton.dataset.mode = 'preview';
        dom.shuffleButton.setAttribute('aria-describedby', 'preview-hint');
        dom.container.classList.remove('solved', 'show-preview');
        hideHint();
        clearTimeout(state.hintTimeout);
        clearTimeout(state.linkRevealTimeout);
        dom.message.classList.remove('message-highlight', 'is-pending');
        dom.gameContainer.classList.remove('layout-solved');

        Object.values(pieceElements).forEach((el) => {
            el.style.zIndex = '0';
        });

        clearConfetti();
        clearTimeout(state.countdownTimeout);
        clearInterval(state.countdownInterval);
        dom.countdownElement.hidden = true;

        if (!state.hasWonOnce && state.isSeriesD) {
            state.countdownTimeout = setTimeout(() => {
                startCountdown();
            }, CONFIG.COUNTDOWN_DELAY_MS);
        }

        pieceElements[CONFIG.TILE_COUNT].hidden = true;
        state.tiles = [...SOLVED_STATE];

        // Random valid moves from solved state guarantee solvability
        for (let i = 0; i < CONFIG.SHUFFLE_ITERATIONS; i++) {
            const emptyIndex = state.tiles.indexOf(0);
            const movableIndices = getMovableTiles(emptyIndex);
            const randomIndex = movableIndices[Math.floor(Math.random() * movableIndices.length)];
            [state.tiles[randomIndex], state.tiles[emptyIndex]] = [state.tiles[emptyIndex], state.tiles[randomIndex]];
        }

        setTilesEnabled(true);
        setRovingFocus(state.tiles.find((id) => id > 0) || 1);
        updatePositions();

        if (!state.hasWonOnce) {
            dom.message.textContent = '';
        }
    }

    // ── COUNTDOWN ───────────────────────────────────────────────────
    function startCountdown() {
        let timeLeft = CONFIG.COUNTDOWN_DURATION_S;
        dom.countdownElement.hidden = false;
        updateCountdownText(timeLeft);

        state.countdownInterval = setInterval(() => {
            timeLeft--;
            updateCountdownText(timeLeft);

            if (timeLeft <= 0) {
                clearInterval(state.countdownInterval);
                dom.countdownElement.hidden = true;
                dom.externalLinkButton.hidden = false;
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
        const fragment = document.createDocumentFragment();

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

            fragment.appendChild(piece);
        }
        dom.confettiContainer.appendChild(fragment);
    }

    function clearConfetti() {
        dom.confettiContainer.replaceChildren();
    }

    // ── PREVIEW & TOOLTIP HELPERS ───────────────────────────────────
    function showPreview() {
        if (!state.isGameActive) return;
        dom.container.classList.add('show-preview');
        hideHint();
        clearTimeout(state.hintTimeout);
    }

    function hidePreview() {
        dom.container.classList.remove('show-preview');
    }

    function positionHintFallback() {
        if (!state.supportsPopover || state.supportsAnchorPos) return;
        const rect = dom.shuffleButton.getBoundingClientRect();
        dom.hintElement.style.setProperty('--hint-top', `${rect.top}px`);
        dom.hintElement.style.setProperty('--hint-left', `${rect.left + rect.width / 2}px`);
    }

    function showHint() {
        if (!state.isGameActive) return;
        positionHintFallback();
        if (state.supportsPopover) {
            if (!dom.hintElement.matches(':popover-open')) {
                dom.hintElement.showPopover();
            }
        } else {
            dom.hintElement.hidden = false;
            dom.hintElement.classList.add('fallback-open');
        }
    }

    function hideHint() {
        clearTimeout(state.hintTimeout);
        if (state.supportsPopover) {
            if (dom.hintElement.matches(':popover-open')) {
                dom.hintElement.hidePopover();
            }
        } else {
            dom.hintElement.classList.remove('fallback-open');
            dom.hintElement.hidden = true;
        }
    }

    function showHintBriefly() {
        showHint();
        clearTimeout(state.hintTimeout);
        state.hintTimeout = setTimeout(() => {
            hideHint();
        }, CONFIG.HINT_DISPLAY_MS);
    }

    // ── SPATIAL KEYBOARD NAVIGATION ─────────────────────────────────
    function findSpatialCandidate(current, direction) {
        const candidates = Array.from(
            dom.container.querySelectorAll('button.tile:not(:disabled)'),
        ).filter((el) => el !== current && (typeof el.checkVisibility !== 'function' || el.checkVisibility()));

        if (candidates.length === 0) return null;

        const curRect = current.getBoundingClientRect();
        const curCenterX = (curRect.left + curRect.right) / 2;
        const curCenterY = (curRect.top + curRect.bottom) / 2;
        const tolerance = 2;

        const directional = [];
        for (const el of candidates) {
            const rect = el.getBoundingClientRect();
            let gap = -1;
            let overlaps = false;
            let perpOffset = 0;

            if (direction === 'ArrowRight' && rect.left >= curRect.right - tolerance) {
                gap = Math.max(0, rect.left - curRect.right);
                overlaps = curRect.top < rect.bottom - tolerance && rect.top < curRect.bottom - tolerance;
                perpOffset = Math.abs((rect.top + rect.bottom) / 2 - curCenterY);
            } else if (direction === 'ArrowLeft' && rect.right <= curRect.left + tolerance) {
                gap = Math.max(0, curRect.left - rect.right);
                overlaps = curRect.top < rect.bottom - tolerance && rect.top < curRect.bottom - tolerance;
                perpOffset = Math.abs((rect.top + rect.bottom) / 2 - curCenterY);
            } else if (direction === 'ArrowDown' && rect.top >= curRect.bottom - tolerance) {
                gap = Math.max(0, rect.top - curRect.bottom);
                overlaps = curRect.left < rect.right - tolerance && rect.left < curRect.right - tolerance;
                perpOffset = Math.abs((rect.left + rect.right) / 2 - curCenterX);
            } else if (direction === 'ArrowUp' && rect.bottom <= curRect.top + tolerance) {
                gap = Math.max(0, curRect.top - rect.bottom);
                overlaps = curRect.left < rect.right - tolerance && rect.left < curRect.right - tolerance;
                perpOffset = Math.abs((rect.left + rect.right) / 2 - curCenterX);
            }

            if (gap >= 0) {
                directional.push({ el, gap, overlaps, perpOffset });
            }
        }

        if (directional.length === 0) return null;

        const aligned = directional.filter((c) => c.overlaps);
        if (aligned.length > 0) {
            aligned.sort((a, b) => (a.gap - b.gap) || (a.perpOffset - b.perpOffset));
            return aligned[0].el;
        }

        directional.sort((a, b) => (a.gap + 2 * a.perpOffset) - (b.gap + 2 * b.perpOffset));
        return directional[0].el;
    }

    function onContainerKeyDown(event) {
        if (
            !state.isGameActive ||
            event.defaultPrevented ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey
        ) {
            return;
        }

        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            return;
        }

        const current = event.composedPath()[0];
        if (!(current instanceof HTMLButtonElement) || !current.classList.contains('tile')) {
            return;
        }

        const nextTile = findSpatialCandidate(current, event.key);
        if (!nextTile) return;

        event.preventDefault();
        setRovingFocus(Number(nextTile.dataset.pieceId));
        nextTile.focus();
        nextTile.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    // ── POINTER & CLICK HANDLERS ────────────────────────────────────
    function getBoardIndexFromPoint(clientX, clientY) {
        const rect = dom.container.getBoundingClientRect();
        const relX = clientX - rect.left;
        const relY = clientY - rect.top;
        if (relX < 0 || relX >= rect.width || relY < 0 || relY >= rect.height) {
            return -1;
        }
        const tileSize = rect.width / CONFIG.GRID_SIZE;
        const col = Math.floor(relX / tileSize);
        const row = Math.floor(relY / tileSize);
        const index = row * CONFIG.GRID_SIZE + col;
        return index >= 0 && index < CONFIG.TILE_COUNT ? index : -1;
    }

    function onContainerPointerDown(event) {
        if (!state.isGameActive || !event.isPrimary) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        state.activePointerId = event.pointerId;
        state.pointerStartX = event.clientX;
        state.pointerStartY = event.clientY;
        state.pointerStartTileIndex = getBoardIndexFromPoint(event.clientX, event.clientY);
    }

    function onContainerPointerUp(event) {
        if (!state.isGameActive || event.pointerId !== state.activePointerId) return;
        state.activePointerId = null;

        const deltaX = event.clientX - state.pointerStartX;
        const deltaY = event.clientY - state.pointerStartY;
        if (Math.abs(deltaX) < CONFIG.SWIPE_THRESHOLD && Math.abs(deltaY) < CONFIG.SWIPE_THRESHOLD) {
            return;
        }

        const index = state.pointerStartTileIndex;
        if (index < 0 || index >= CONFIG.TILE_COUNT) return;

        const emptyIndex = state.tiles.indexOf(0);
        const { row: emptyRow, col: emptyCol } = getRowCol(emptyIndex);
        const { row: tileRow, col: tileCol } = getRowCol(index);

        const dRow = emptyRow - tileRow;
        const dCol = emptyCol - tileCol;
        if (Math.abs(dRow) + Math.abs(dCol) !== 1) return;

        let matches = false;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 0 && dCol > 0) matches = true;
            if (deltaX < 0 && dCol < 0) matches = true;
        } else {
            if (deltaY > 0 && dRow > 0) matches = true;
            if (deltaY < 0 && dRow < 0) matches = true;
        }

        if (matches) {
            state.suppressNextBoardClick = true;
            queueMicrotask(() => { state.suppressNextBoardClick = false; });
            const pieceId = state.tiles[index];
            if (pieceId > 0) setRovingFocus(pieceId);
            moveTile(index);
        }
    }

    function onContainerPointerCancel(event) {
        if (event.pointerId === state.activePointerId) {
            state.activePointerId = null;
        }
    }

    function onContainerClick(event) {
        if (state.suppressNextBoardClick) {
            state.suppressNextBoardClick = false;
            return;
        }
        if (!state.isGameActive) return;

        const tileBtn = event.target.closest('button.tile');
        if (!tileBtn || !dom.container.contains(tileBtn)) return;

        const pieceId = Number(tileBtn.dataset.pieceId);
        const clickedIndex = Number(tileBtn.dataset.index);
        setRovingFocus(pieceId);
        moveTile(clickedIndex);
    }

    // ── SHUFFLE / PREVIEW BUTTON HANDLERS ───────────────────────────
    function onShuffleClick() {
        if (!state.isGameActive) {
            shuffleAndStart();
        }
    }

    function onShufflePointerDown(event) {
        if (!event.isPrimary) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        state.shufflePointerId = event.pointerId;
        dom.shuffleButton.classList.add('button-active');
        try {
            dom.shuffleButton.setPointerCapture(event.pointerId);
        } catch {
            // Ignore if synthetic pointer cannot be captured
        }

        if (state.isGameActive) {
            state.previewPressStartTime = performance.now();
            showPreview();
        }
    }

    function onShufflePointerUp(event) {
        if (event.pointerId !== state.shufflePointerId) return;
        state.shufflePointerId = null;
        dom.shuffleButton.classList.remove('button-active');

        if (state.isGameActive) {
            hidePreview();
            const duration = performance.now() - state.previewPressStartTime;
            if (duration < CONFIG.SHORT_PRESS_THRESHOLD_MS) {
                showHintBriefly();
            }
        }
    }

    function onShufflePointerCancel(event) {
        if (event.pointerId !== state.shufflePointerId) return;
        state.shufflePointerId = null;
        dom.shuffleButton.classList.remove('button-active');
        hidePreview();
    }

    function onShuffleKeyDown(event) {
        if (!state.isGameActive) return;
        if (event.key === 'Escape') {
            hideHint();
            return;
        }
        if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
            if (event.key === ' ') event.preventDefault();
            state.keyboardPreviewActive = true;
            dom.shuffleButton.classList.add('button-active');
            showPreview();
        }
    }

    function onShuffleKeyUp(event) {
        if (!state.keyboardPreviewActive) return;
        if (event.key === ' ' || event.key === 'Enter') {
            state.keyboardPreviewActive = false;
            dom.shuffleButton.classList.remove('button-active');
            hidePreview();
        }
    }

    function onShuffleBlur() {
        state.keyboardPreviewActive = false;
        dom.shuffleButton.classList.remove('button-active');
        hidePreview();
        hideHint();
    }

    function onDocumentKeyDown(event) {
        if (event.key === 'Escape') {
            hideHint();
        }
    }

    function onPageShow() {
        dom.shuffleButton.blur();
        dom.externalLinkButton.blur();
        dom.shuffleButton.classList.remove('button-active');
        dom.externalLinkButton.classList.remove('button-active');
    }

    // ── POPOVER HINT FEATURE SETUP ──────────────────────────────────
    function setupHintPopover() {
        state.supportsPopover = Object.hasOwn(HTMLElement.prototype, 'popover');
        state.supportsAnchorPos = typeof CSS !== 'undefined' &&
            typeof CSS.supports === 'function' &&
            CSS.supports('position-area: block-start') &&
            CSS.supports('anchor-name: --preview-trigger');

        if (!state.supportsPopover) {
            dom.hintElement.removeAttribute('popover');
            dom.hintElement.hidden = true;
            return;
        }

        // Fallback for browsers with Popover API but without popover="hint" (e.g., Safari)
        const probe = document.createElement('div');
        probe.popover = 'hint';
        if (probe.popover !== 'hint') {
            document.addEventListener('beforetoggle', (event) => {
                if (event.target === dom.hintElement && event.newState === 'open') {
                    dom.hintElement.popover = 'auto';
                }
            }, true);
        }
    }

    // ── INITIALIZATION ──────────────────────────────────────────────
    function init() {
        dom.container = document.getElementById('puzzle-container');
        dom.message = document.getElementById('message');
        dom.shuffleButton = document.getElementById('shuffle-button');
        dom.externalLinkButton = document.getElementById('external-link-button');
        dom.countdownElement = document.getElementById('countdown-timer');
        dom.confettiContainer = dom.container.querySelector('.confetti-container');
        dom.gameContainer = document.querySelector('.game-container');
        dom.hintElement = document.getElementById('preview-hint');

        setupHintPopover();

        // Determine series from URL safely (own-property check avoids prototype lookups)
        const urlParams = new URLSearchParams(window.location.search);
        state.imageId = urlParams.get('id');
        const hasValidId = !!(state.imageId && Object.hasOwn(IMAGE_MAP, state.imageId));
        state.isSeriesC = hasValidId && state.imageId.startsWith('c');
        state.isSeriesD = hasValidId && state.imageId !== 'default' && !state.isSeriesC;

        const linkParaSerieD = 'https://kelly-boris-boda.borish127.com/?grupo=damas';
        const linkParaSerieC = 'https://kelly-boris-boda.borish127.com/?grupo=caballeros';
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

        createPieces();
        const initialImageUrl = getImageUrlFromParams();
        setPuzzleImage(initialImageUrl);

        // Board events
        dom.container.addEventListener('pointerdown', onContainerPointerDown);
        dom.container.addEventListener('pointerup', onContainerPointerUp);
        dom.container.addEventListener('pointercancel', onContainerPointerCancel);
        dom.container.addEventListener('click', onContainerClick);
        dom.container.addEventListener('keydown', onContainerKeyDown);

        // Shuffle / Preview button events
        dom.shuffleButton.addEventListener('click', onShuffleClick);
        dom.shuffleButton.addEventListener('pointerdown', onShufflePointerDown);
        dom.shuffleButton.addEventListener('pointerup', onShufflePointerUp);
        dom.shuffleButton.addEventListener('pointercancel', onShufflePointerCancel);
        dom.shuffleButton.addEventListener('touchstart', (event) => {
            if (state.isGameActive) {
                event.preventDefault();
            }
        }, { passive: false });
        dom.shuffleButton.addEventListener('contextmenu', (event) => {
            if (state.isGameActive) {
                event.preventDefault();
            }
        });
        dom.shuffleButton.addEventListener('keydown', onShuffleKeyDown);
        dom.shuffleButton.addEventListener('keyup', onShuffleKeyUp);
        dom.shuffleButton.addEventListener('blur', onShuffleBlur);

        // Keep tooltip hoverable & keyboard-focusable (WCAG 1.4.13)
        dom.shuffleButton.addEventListener('pointerenter', (event) => {
            if (state.isGameActive && event.pointerType === 'mouse') {
                showHint();
            }
        });
        dom.shuffleButton.addEventListener('focus', () => {
            if (state.isGameActive && dom.shuffleButton.matches(':focus-visible')) {
                showHint();
            }
        });
        dom.shuffleButton.addEventListener('pointerleave', (event) => {
            if (event.pointerType === 'mouse') {
                setTimeout(() => {
                    if (!dom.hintElement.matches(':hover') && !dom.shuffleButton.matches(':hover')) {
                        hideHint();
                    }
                }, 100);
            }
        });
        dom.hintElement.addEventListener('pointerleave', (event) => {
            if (event.pointerType === 'mouse' && !dom.shuffleButton.matches(':hover')) {
                hideHint();
            }
        });

        document.addEventListener('keydown', onDocumentKeyDown);
        window.addEventListener('pageshow', onPageShow);
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', PuzzleGame.init);
