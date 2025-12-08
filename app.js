// Application State
const state = {
    mode: 'practice', // 'practice' or 'rally'
    isRunning: false,
    settings: {
        pauseTime: 2500, // milliseconds
        shotsPerRally: 15,
        rallyPause: 10, // seconds
        rallySpeed: 600, // milliseconds between shots in rally mode
        sequenceMode: 'random', // 'random', 'sequential', or 'custom'
        customSequence: [], // Custom sequence of zones
    },
    session: {
        currentZone: null,
        lastZone: null,
        intervalId: null,
        timeoutId: null,
        rallyCount: 0,
        shotCount: 0,
    },
    volume: true,
    zonesEnabled: {
        1: true,
        2: true,
        3: true,
        4: true,
        5: true,
        6: true,
    },
};

// Zone Configuration (Half Court - 6 zones)
const zones = [1, 2, 3, 4, 5, 6];
let sequenceIndex = 0;

// Get Next Zone Based on Sequence Mode
function getNextZone() {
    const enabledZones = zones.filter(z => state.zonesEnabled[z]);
    
    if (enabledZones.length === 0) return null;
    
    let nextZone;
    
    switch (state.settings.sequenceMode) {
        case 'sequential':
            // Go through zones 1, 2, 3, 4, 5, 6 in order
            const enabledInOrder = enabledZones.sort((a, b) => a - b);
            sequenceIndex = (sequenceIndex + 1) % enabledInOrder.length;
            nextZone = enabledInOrder[sequenceIndex];
            break;
            
        case 'custom':
            // Use custom sequence
            if (state.settings.customSequence.length > 0) {
                const validSequence = state.settings.customSequence.filter(z => state.zonesEnabled[z]);
                if (validSequence.length > 0) {
                    sequenceIndex = (sequenceIndex + 1) % validSequence.length;
                    nextZone = validSequence[sequenceIndex];
                } else {
                    // Fallback to random if no valid zones in custom sequence
                    const availableZones = enabledZones.filter(z => z !== state.session.lastZone);
                    const zonesToChooseFrom = availableZones.length > 0 ? availableZones : enabledZones;
                    nextZone = zonesToChooseFrom[Math.floor(Math.random() * zonesToChooseFrom.length)];
                }
            } else {
                // Fallback to random if no custom sequence defined
                const availableZones = enabledZones.filter(z => z !== state.session.lastZone);
                const zonesToChooseFrom = availableZones.length > 0 ? availableZones : enabledZones;
                nextZone = zonesToChooseFrom[Math.floor(Math.random() * zonesToChooseFrom.length)];
            }
            break;
            
        case 'random':
        default:
            // Random (avoid immediate repeat)
            const availableZones = enabledZones.filter(z => z !== state.session.lastZone);
            const zonesToChooseFrom = availableZones.length > 0 ? availableZones : enabledZones;
            nextZone = zonesToChooseFrom[Math.floor(Math.random() * zonesToChooseFrom.length)];
            break;
    }
    
    return nextZone;
}

// DOM Elements
const elements = {
    tabs: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    startBtn: document.getElementById('startBtn'),
    pauseTimeInput: document.getElementById('pauseTime'),
    shotsPerRallyInput: document.getElementById('shotsPerRally'),
    rallyPauseInput: document.getElementById('rallyPause'),
    rallySpeedInput: document.getElementById('rallySpeed'),
    sequenceModeSelect: document.getElementById('sequenceMode'),
    customSequenceInput: document.getElementById('customSequence'),
    controlBtns: document.querySelectorAll('.control-btn'),
    zoneElements: document.querySelectorAll('.zone'),
    helpBtn: document.getElementById('helpBtn'),
    volumeBtn: document.getElementById('volumeBtn'),
    legalBtn: document.getElementById('legalBtn'),
    helpModal: document.getElementById('helpModal'),
    legalModal: document.getElementById('legalModal'),
    closeHelp: document.getElementById('closeHelp'),
    closeLegal: document.getElementById('closeLegal'),
};

// Initialize Application
function init() {
    setupEventListeners();
    updateSettingsFromInputs();
    initializeZones();
}

// Initialize Zones
function initializeZones() {
    zones.forEach(zoneNumber => {
        updateZoneVisualState(zoneNumber);
    });
}

// Event Listeners
function setupEventListeners() {
    // Tab switching
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => handleTabSwitch(tab));
    });

    // Start/Stop button
    elements.startBtn.addEventListener('click', toggleTraining);

    // Control buttons (+/-)
    elements.controlBtns.forEach(btn => {
        btn.addEventListener('click', () => handleControlBtn(btn));
    });

    // Input changes
    elements.pauseTimeInput.addEventListener('change', updateSettingsFromInputs);
    elements.shotsPerRallyInput.addEventListener('change', updateSettingsFromInputs);
    elements.rallyPauseInput.addEventListener('change', updateSettingsFromInputs);
    elements.rallySpeedInput.addEventListener('change', updateSettingsFromInputs);
    elements.sequenceModeSelect.addEventListener('change', updateSettingsFromInputs);
    elements.customSequenceInput.addEventListener('change', updateSettingsFromInputs);

    // Footer buttons
    elements.helpBtn.addEventListener('click', () => openModal('help'));
    elements.legalBtn.addEventListener('click', () => openModal('legal'));
    elements.volumeBtn.addEventListener('click', toggleVolume);

    // Modal close buttons
    elements.closeHelp.addEventListener('click', () => closeModal('help'));
    elements.closeLegal.addEventListener('click', () => closeModal('legal'));

    // Close modals on background click
    elements.helpModal.addEventListener('click', (e) => {
        if (e.target === elements.helpModal) closeModal('help');
    });
    elements.legalModal.addEventListener('click', (e) => {
        if (e.target === elements.legalModal) closeModal('legal');
    });

    // Zone click handlers for enable/disable
    elements.zoneElements.forEach(zone => {
        zone.addEventListener('click', () => handleZoneClick(zone));

        // Drag handlers - Mouse
        zone.addEventListener('mousedown', (e) => handleDragStart(e, zone));
        
        // Drag handlers - Touch
        zone.addEventListener('touchstart', (e) => {
            handleDragStart(e, zone);
        }, { passive: false });
    });

    // Global drag handlers - Mouse
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    
    // Global drag handlers - Touch
    document.addEventListener('touchmove', (e) => {
        if (dragState.isDragging) {
            handleDragMove(e);
        }
    }, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
    document.addEventListener('touchcancel', handleDragEnd);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
}

// Drag State
let dragState = {
    isDragging: false,
    wasDragging: false,
    hasMoved: false,
    currentZone: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
};

// Handle Drag Start
function handleDragStart(e, zoneElement) {
    // Don't allow dragging during training
    if (state.isRunning) return;

    // Prevent click event from firing
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();

    dragState.isDragging = true;
    dragState.hasMoved = false;
    dragState.currentZone = zoneElement;
    
    // Support both touch and mouse events
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : 0);
    
    dragState.startX = clientX;
    dragState.startY = clientY;

    const rect = zoneElement.getBoundingClientRect();
    dragState.offsetX = clientX - rect.left;
    dragState.offsetY = clientY - rect.top;

    zoneElement.style.cursor = 'grabbing';
    zoneElement.style.zIndex = '1000';
}

// Handle Drag Move
function handleDragMove(e) {
    if (!dragState.isDragging || !dragState.currentZone) return;

    // Support both touch and mouse events
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : 0);

    // Check if moved more than threshold (10 pixels for touch, 5 for mouse)
    const threshold = e.touches ? 10 : 5;
    const moveDistance = Math.abs(clientX - dragState.startX) + Math.abs(clientY - dragState.startY);
    if (moveDistance > threshold) {
        dragState.hasMoved = true;
    }

    if (!dragState.hasMoved) return;

    if (e.preventDefault) e.preventDefault();

    const courtContainer = document.querySelector('.court-container');
    const courtRect = courtContainer.getBoundingClientRect();

    // Calculate new position relative to court
    let newX = clientX - courtRect.left - dragState.offsetX;
    let newY = clientY - courtRect.top - dragState.offsetY;

    // Convert to percentage
    const percentX = (newX / courtRect.width) * 100;
    const percentY = (newY / courtRect.height) * 100;

    // Constrain to court boundaries (with some margin)
    const constrainedX = Math.max(5, Math.min(95, percentX));
    const constrainedY = Math.max(5, Math.min(95, percentY));

    // Update position
    dragState.currentZone.style.left = `${constrainedX}%`;
    dragState.currentZone.style.top = `${constrainedY}%`;
    dragState.currentZone.style.right = 'auto';
    dragState.currentZone.style.bottom = 'auto';
    dragState.currentZone.style.transform = 'none';
}

// Handle Drag End
function handleDragEnd(e) {
    if (!dragState.isDragging) return;

    if (dragState.currentZone) {
        dragState.currentZone.style.cursor = 'pointer';
        dragState.currentZone.style.zIndex = '';
    }

    dragState.wasDragging = dragState.hasMoved;
    dragState.isDragging = false;
    dragState.currentZone = null;
    dragState.hasMoved = false;
    
    if (dragState.wasDragging) {
        setTimeout(() => { dragState.wasDragging = false; }, 100);
    }
}

// Handle Zone Click (Toggle Enable/Disable)
function handleZoneClick(zoneElement) {
    // Small delay to check if it was actually a drag
    setTimeout(() => {
        if (state.isRunning || dragState.wasDragging) {
            dragState.wasDragging = false;
            return;
        }

        const zoneNumber = parseInt(zoneElement.dataset.zone);

        // Toggle zone enabled state
        state.zonesEnabled[zoneNumber] = !state.zonesEnabled[zoneNumber];

        // Update visual state
        updateZoneVisualState(zoneNumber);
    }, 50);
}

// Update Zone Visual State
function updateZoneVisualState(zoneNumber) {
    const zoneElement = document.querySelector(`[data-zone="${zoneNumber}"]`);
    if (!zoneElement) return;

    if (state.zonesEnabled[zoneNumber]) {
        zoneElement.classList.remove('disabled');
        zoneElement.classList.add('enabled');
    } else {
        zoneElement.classList.remove('enabled');
        zoneElement.classList.add('disabled');
    }
}

// Tab Switching
function handleTabSwitch(tab) {
    const targetTab = tab.dataset.tab;

    // Update active tab
    elements.tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Update tab content
    elements.tabContents.forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${targetTab}-tab`).classList.add('active');

    // Update mode
    state.mode = targetTab;

    // Stop current session if running
    if (state.isRunning) {
        stopTraining();
    }
}

// Control Buttons (+/-)
function handleControlBtn(btn) {
    const action = btn.dataset.action;
    const target = btn.dataset.target;
    const input = document.getElementById(target);
    const step = parseFloat(input.step) || 1;
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || Infinity;

    let value = parseFloat(input.value);

    if (action === 'increase') {
        value = Math.min(value + step, max);
    } else {
        value = Math.max(value - step, min);
    }

    input.value = value;
    updateSettingsFromInputs();
}

// Update Settings from Inputs
function updateSettingsFromInputs() {
    state.settings.pauseTime = parseInt(elements.pauseTimeInput.value);
    state.settings.shotsPerRally = parseInt(elements.shotsPerRallyInput.value);
    state.settings.rallyPause = parseInt(elements.rallyPauseInput.value);
    state.settings.rallySpeed = parseInt(elements.rallySpeedInput.value);
    state.settings.sequenceMode = elements.sequenceModeSelect.value;
    
    // Parse custom sequence
    if (state.settings.sequenceMode === 'custom') {
        const sequenceStr = elements.customSequenceInput.value.trim();
        if (sequenceStr) {
            state.settings.customSequence = sequenceStr.split(',')
                .map(n => parseInt(n.trim()))
                .filter(n => n >= 1 && n <= 6);
        }
    }
    
    // Show/hide custom sequence input
    const customInput = document.getElementById('customSequenceGroup');
    if (customInput) {
        customInput.style.display = state.settings.sequenceMode === 'custom' ? 'block' : 'none';
    }
}

// Toggle Training
function toggleTraining() {
    if (state.isRunning) {
        stopTraining();
    } else {
        startTraining();
    }
}

// Start Training
function startTraining() {
    state.isRunning = true;
    elements.startBtn.classList.add('active');
    elements.startBtn.querySelector('.btn-text').textContent = 'STOP';

    // Reset session
    state.session.rallyCount = 0;
    state.session.shotCount = 0;

    if (state.mode === 'practice') {
        startPracticeMode();
    } else {
        startRallyMode();
    }
}

// Stop Training
function stopTraining() {
    state.isRunning = false;
    elements.startBtn.classList.remove('active');
    elements.startBtn.querySelector('.btn-text').textContent = 'START';

    // Clear intervals and timeouts
    if (state.session.intervalId) {
        clearInterval(state.session.intervalId);
        state.session.intervalId = null;
    }
    if (state.session.timeoutId) {
        clearTimeout(state.session.timeoutId);
        state.session.timeoutId = null;
    }

    // Clear all zones
    clearAllZones();
    
    // Clean up rally mode displays
    const countdown = document.getElementById('countdown-display');
    if (countdown) countdown.remove();
    hideRallyShotCounter();
}

// Practice Mode
function startPracticeMode() {
    const highlightNextZone = () => {
        if (!state.isRunning) return;

        // Clear previous zone
        clearAllZones();

        // Get next zone based on sequence mode
        const nextZone = getNextZone();
        
        if (nextZone === null) {
            stopTraining();
            alert('Please enable at least one zone!');
            return;
        }

        // Highlight zone
        highlightZone(nextZone);
        state.session.currentZone = nextZone;
        state.session.lastZone = nextZone;

        // Show checkmark after a brief moment
        state.session.timeoutId = setTimeout(() => {
            showZoneIndicator(nextZone, 'checkmark');
        }, state.settings.pauseTime * 0.8);
    };

    // Start immediately
    highlightNextZone();

    // Continue at intervals
    state.session.intervalId = setInterval(highlightNextZone, state.settings.pauseTime);
}

// Rally Mode
function startRallyMode() {
    const executeRally = () => {
        if (!state.isRunning) return;

        state.session.rallyCount++;

        // Calculate shots for this rally (±30%)
        const baseShots = state.settings.shotsPerRally;
        const variation = Math.floor(baseShots * 0.3);
        const shotsInRally = baseShots + Math.floor(Math.random() * (variation * 2 + 1)) - variation;

        let shotIndex = 0;

        const executeShot = () => {
            if (!state.isRunning || shotIndex >= shotsInRally) {
                if (state.isRunning && shotIndex >= shotsInRally) {
                    // Rally complete, pause before next rally
                    clearAllZones();
                    hideRallyShotCounter();
                    startCountdown(() => executeRally());
                }
                return;
            }

            // Clear previous zone
            clearAllZones();

            // Get next zone based on sequence mode
            const nextZone = getNextZone();
            
            if (nextZone === null) {
                stopTraining();
                alert('Please enable at least one zone!');
                return;
            }

            // Highlight zone
            highlightZone(nextZone);
            state.session.currentZone = nextZone;
            state.session.lastZone = nextZone;
            state.session.shotCount++;

            shotIndex++;

            // Update shot counter
            updateRallyShotCounter(shotIndex, shotsInRally);

            // Next shot using configured speed
            state.session.timeoutId = setTimeout(executeShot, state.settings.rallySpeed);
        };

        executeShot();
    };

    executeRally();
}

// Zone Highlighting
function highlightZone(zoneNumber) {
    const zoneElement = document.querySelector(`[data-zone="${zoneNumber}"]`);
    if (zoneElement) {
        zoneElement.classList.add('active');
        playSound('beep');
        speakZoneNumber(zoneNumber);
    }
}

// Text-to-Speech for Zone Numbers
function speakZoneNumber(zoneNumber) {
    if (!state.volume) {
        console.log('Volume is muted, skipping speech');
        return;
    }

    // Check if browser supports speech synthesis
    if ('speechSynthesis' in window) {
        console.log('Speaking zone:', zoneNumber);

        // Small delay to ensure speech works
        setTimeout(() => {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            // Create utterance
            const utterance = new SpeechSynthesisUtterance(zoneNumber.toString());

            // Configure voice settings
            utterance.rate = 1.0; // Normal speed
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            utterance.lang = 'en-US';

            // Add event listeners for debugging
            utterance.onstart = () => console.log('Speech started:', zoneNumber);
            utterance.onend = () => console.log('Speech ended:', zoneNumber);
            utterance.onerror = (e) => console.error('Speech error:', e);

            // Speak
            window.speechSynthesis.speak(utterance);
        }, 50);
    } else {
        console.error('Speech synthesis not supported in this browser');
    }
}

function showZoneIndicator(zoneNumber, type) {
    const zoneElement = document.querySelector(`[data-zone="${zoneNumber}"]`);
    if (zoneElement) {
        if (type === 'checkmark') {
            zoneElement.classList.add('show-checkmark');
        } else if (type === 'cross') {
            zoneElement.classList.add('show-cross');
        }
    }
}

function clearAllZones() {
    elements.zoneElements.forEach(zone => {
        zone.classList.remove('active', 'show-checkmark', 'show-cross');
    });
}

// Countdown Between Rallies
function startCountdown(callback) {
    let timeLeft = state.settings.rallyPause;
    
    const countdownDisplay = document.createElement('div');
    countdownDisplay.id = 'countdown-display';
    countdownDisplay.className = 'countdown-display';
    document.querySelector('.court-container').appendChild(countdownDisplay);

    const doCountdown = () => {
        if (!state.isRunning || timeLeft <= 0) {
            countdownDisplay.remove();
            if (state.isRunning && timeLeft <= 0) {
                callback();
            }
            return;
        }

        countdownDisplay.textContent = timeLeft;
        speakNumber(timeLeft);
        timeLeft--;
        state.session.timeoutId = setTimeout(doCountdown, 1000);
    };

    doCountdown();
}

// Update Rally Shot Counter
function updateRallyShotCounter(current, total) {
    let counter = document.getElementById('rally-shot-counter');
    if (!counter) {
        counter = document.createElement('div');
        counter.id = 'rally-shot-counter';
        counter.className = 'rally-shot-counter';
        document.querySelector('.court-container').appendChild(counter);
    }
    counter.textContent = `${current} / ${total}`;
    counter.style.display = 'block';
}

// Hide Rally Shot Counter
function hideRallyShotCounter() {
    const counter = document.getElementById('rally-shot-counter');
    if (counter) {
        counter.style.display = 'none';
    }
}

// Speak Number (for countdown)
function speakNumber(number) {
    if (!state.volume) return;

    if ('speechSynthesis' in window) {
        setTimeout(() => {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(number.toString());
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            utterance.lang = 'en-US';
            window.speechSynthesis.speak(utterance);
        }, 50);
    }
}

// Sound Effects (placeholder)
function playSound(type) {
    if (!state.volume) return;

    // In a real implementation, you would play actual audio files
    // For now, this is a placeholder
    // Example: new Audio(`sounds / ${ type }.mp3`).play();
}

// Volume Toggle
function toggleVolume() {
    state.volume = !state.volume;

    const volumeOn = elements.volumeBtn.querySelector('.volume-on');
    const volumeOff = elements.volumeBtn.querySelector('.volume-off');

    if (state.volume) {
        volumeOn.style.display = 'block';
        volumeOff.style.display = 'none';
    } else {
        volumeOn.style.display = 'none';
        volumeOff.style.display = 'block';
    }
}

// Modal Management
function openModal(type) {
    if (type === 'help') {
        elements.helpModal.classList.add('active');
    } else if (type === 'legal') {
        elements.legalModal.classList.add('active');
    }
}

function closeModal(type) {
    if (type === 'help') {
        elements.helpModal.classList.remove('active');
    } else if (type === 'legal') {
        elements.legalModal.classList.remove('active');
    }
}

// Keyboard Shortcuts
function handleKeyboard(e) {
    // Space: Start/Stop
    if (e.code === 'Space' && !e.target.matches('input')) {
        e.preventDefault();
        toggleTraining();
    }

    // Escape: Close modals or stop training
    if (e.code === 'Escape') {
        if (elements.helpModal.classList.contains('active')) {
            closeModal('help');
        } else if (elements.legalModal.classList.contains('active')) {
            closeModal('legal');
        } else if (state.isRunning) {
            stopTraining();
        }
    }

    // 1-2: Switch tabs
    if (e.code === 'Digit1') {
        handleTabSwitch(elements.tabs[0]);
    } else if (e.code === 'Digit2') {
        handleTabSwitch(elements.tabs[1]);
    }

    // H: Help
    if (e.code === 'KeyH' && !e.target.matches('input')) {
        openModal('help');
    }

    // M: Mute/Unmute
    if (e.code === 'KeyM' && !e.target.matches('input')) {
        toggleVolume();
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', init);
