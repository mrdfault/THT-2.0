// --- Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Global Variables ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app, db, auth;
let userId = 'anonymous';

// --- Game State ---
let players = [];
let matches = [];
let currentRound = 1;
let roundHistory = [];
const K_FACTOR = 32;

// --- DOM Elements ---
const numPlayersPage = document.getElementById('numPlayersPage');
const playerDetailsPage = document.getElementById('playerDetailsPage');
const matchmakingPage = document.getElementById('matchmakingPage');
const dashboardPage = document.getElementById('dashboardPage');
const historyPage = document.getElementById('historyPage');
const numPlayersInput = document.getElementById('numPlayers');
const numPlayersError = document.getElementById('numPlayersError');
const nextToPlayerDetailsBtn = document.getElementById('nextToPlayerDetails');
const playerInputsContainer = document.getElementById('playerInputs');
const nextToMatchmakingBtn = document.getElementById('nextToMatchmaking');
const allMatchedPlayedBtn = document.getElementById('allMatchedPlayedBtn');
const currentRoundDisplay = document.getElementById('currentRoundDisplay');
const matchesContainer = document.getElementById('matchesContainer');
const rankingsContainer = document.getElementById('rankingsContainer');
const matchmakingTabBtn = document.getElementById('matchmakingTabBtn');
const dashboardTabBtn = document.getElementById('dashboardTabBtn');
const historyTabBtn = document.getElementById('historyTabBtn');
const copyMatchesBtn = document.getElementById('copyMatchesBtn');
const copyMatchesMessage = document.getElementById('copyMatchesMessage');
const copyRankingsBtn = document.getElementById('copyRankingsBtn');
const copyRankingsMessage = document.getElementById('copyRankingsMessage');
const historyRoundList = document.getElementById('historyRoundList');
const historyDetailsContainer = document.getElementById('historyDetailsContainer');
const historyDefaultMessage = document.getElementById('historyDefaultMessage');
const historyMatchesView = document.getElementById('historyMatchesView');
const historyRankingsView = document.getElementById('historyRankingsView');
const historyRoundMatchesDisplay = document.getElementById('historyRoundMatchesDisplay');
const historyRoundRankingsDisplay = document.getElementById('historyRoundRankingsDisplay');
const historyMatchesTable = document.getElementById('historyMatchesTable');
const historyRankingsTable = document.getElementById('historyRankingsTable');
const customModal = document.getElementById('customModal');
const modalMessage = document.getElementById('modalMessage');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const bulkPasteTextarea = document.getElementById('bulkPasteTextarea');
const bulkPastePreviewBtn = document.getElementById('bulkPastePreviewBtn');
const bulkPastePreview = document.getElementById('bulkPastePreview');
const bulkPasteApproveBtn = document.getElementById('bulkPasteApproveBtn');

// --- Options ---
const allianceOptions = ['AoW', 'BER', 'HtH', 'SOh', 'REB', 'RIS'];
const levelOptions = ['FC-8', 'FC-7', 'FC-6', 'FC-5', 'FC-4', 'FC-3', 'FC-2', 'FC-1'];
const allianceColors = {
    'AoW': '#FF5733',
    'REB': '#33FF57',
    'HtH': '#3357FF',
    'BER': '#FF33DA',
    'SOh': '#F4D03F',
    'RIS': '#8A2BE2'
};

// --- Page Navigation ---
function showPage(pageToShow) {
    [numPlayersPage, playerDetailsPage, matchmakingPage, dashboardPage, historyPage].forEach(page => page.classList.remove('active'));
    pageToShow.classList.add('active');
    [matchmakingTabBtn, dashboardTabBtn, historyTabBtn].forEach(btn => {
        btn.classList.remove('active-tab');
        btn.classList.add('tab-btn-inactive');
    });
    if (pageToShow === matchmakingPage) {
        matchmakingTabBtn.classList.add('active-tab');
        matchmakingTabBtn.classList.remove('tab-btn-inactive');
    } else if (pageToShow === dashboardPage) {
        dashboardTabBtn.classList.add('active-tab');
        dashboardTabBtn.classList.remove('tab-btn-inactive');
    } else if (pageToShow === historyPage) {
        historyTabBtn.classList.add('active-tab');
        historyTabBtn.classList.remove('tab-btn-inactive');
        renderRoundList();
    }
}

// --- Bulk Paste Feature ---
let bulkPlayers = [];
bulkPastePreviewBtn.addEventListener('click', () => {
    const text = bulkPasteTextarea.value.trim();
    if (!text) return;
    let lines = text.split(/\n/).filter(line => line.trim());
    bulkPlayers = [];
    for (let line of lines) {
        let parts = line.trim().split(/\s+/);
        if (parts.length < 4) continue;
        let troopsLevel = parts.pop();
        let fcLevel = parts.pop();
        let alliance = parts.pop();
        let name = parts.join(' ');
        bulkPlayers.push({ name, alliance, fcLevel, troopsLevel });
    }
    if (bulkPlayers.length > 0) {
        let previewHtml = `<table class="min-w-full bg-white rounded-lg shadow-md"><thead><tr>
            <th>Name</th><th>Alliance</th><th>FC Level</th><th>Troops Level</th></tr></thead><tbody>`;
        bulkPlayers.forEach(p => {
            previewHtml += `<tr>
                <td>${p.name}</td>
                <td>${p.alliance}</td>
                <td>${p.fcLevel}</td>
                <td>${p.troopsLevel}</td>
            </tr>`;
        });
        previewHtml += `</tbody></table>`;
        bulkPastePreview.innerHTML = previewHtml;
        bulkPasteApproveBtn.classList.remove('hidden');
    } else {
        bulkPastePreview.innerHTML = `<p class="text-red-400">Could not parse player data. Please check formatting.</p>`;
        bulkPasteApproveBtn.classList.add('hidden');
    }
});
bulkPasteApproveBtn.addEventListener('click', () => {
    numPlayersInput.value = bulkPlayers.length;
    generatePlayerInputs(bulkPlayers.length);
    bulkPlayers.forEach((p, i) => {
        document.getElementById(`playerName${i}`).value = p.name;
        document.getElementById(`playerAlliance${i}`).value = p.alliance;
        document.getElementById(`playerFcLvl${i}`).value = p.fcLevel;
        document.getElementById(`playerTroopsLvl${i}`).value = p.troopsLevel;
        document.getElementById(`playerAlliance${i}`).dispatchEvent(new Event('change'));
        document.getElementById(`playerFcLvl${i}`).dispatchEvent(new Event('change'));
        document.getElementById(`playerTroopsLvl${i}`).dispatchEvent(new Event('change'));
    });
    bulkPastePreview.innerHTML = `<p class="text-green-400">Inputs filled! Please review and click "Start Matchmaking" when ready.</p>`;
    bulkPasteApproveBtn.classList.add('hidden');
    checkAllPlayerInputsValidity();
});

// --- Generate Player Inputs ---
function generatePlayerInputs(num) {
    playerInputsContainer.innerHTML = '';
    for (let i = 0; i < num; i++) {
        const playerDiv = document.createElement('div');
        playerDiv.classList.add('p-4', 'border', 'border-gray-700', 'rounded-lg', 'shadow-lg', 'player-box');
        playerDiv.innerHTML = `
            <h3 class="text-xl font-semibold mb-4 text-gray-100">Player ${i + 1}</h3>
            <div class="mb-3">
                <label for="playerName${i}" class="block text-sm font-medium text-gray-200 mb-1">Name:</label>
                <input type="text" id="playerName${i}" class="input-field" placeholder="Player Name" required>
            </div>
            <div class="mb-3">
                <label for="playerAlliance${i}" class="block text-sm font-medium text-gray-200 mb-1">Alliance:</label>
                <select id="playerAlliance${i}" class="input-field alliance-select" required>
                    ${allianceOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                </select>
            </div>
            <div class="mb-3">
                <label for="playerFcLvl${i}" class="block text-sm font-medium text-gray-200 mb-1">FC Level:</label>
                <select id="playerFcLvl${i}" class="input-field" required>
                    ${levelOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                </select>
            </div>
            <div class="mb-3">
                <label for="playerTroopsLvl${i}" class="block text-sm font-medium text-gray-200 mb-1">Troops Level:</label>
                <select id="playerTroopsLvl${i}" class="input-field" required>
                    ${levelOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                </select>
                <p id="troopsLvlError${i}" class="text-red-400 text-sm mt-1 hidden">Troops level must be same as FC level or one level below.</p>
            </div>
        `;
        playerInputsContainer.appendChild(playerDiv);

        document.getElementById(`playerFcLvl${i}`).addEventListener('change', () => validateTroopsLevel(i));
        document.getElementById(`playerTroopsLvl${i}`).addEventListener('change', () => validateTroopsLevel(i));
        document.getElementById(`playerAlliance${i}`).addEventListener('change', (event) => {
            const selectedAlliance = event.target.value;
            event.target.style.backgroundColor = allianceColors[selectedAlliance] || getComputedStyle(document.documentElement).getPropertyValue('--bg-lighter-than-dark');
            event.target.style.color = (allianceColors[selectedAlliance] === '#F4D03F') ? 'black' : 'white';
        });
    }
    checkAllPlayerInputsValidity();
}
function validateTroopsLevel(playerIndex) {
    const fcLvlSelect = document.getElementById(`playerFcLvl${playerIndex}`);
    const troopsLvlSelect = document.getElementById(`playerTroopsLvl${playerIndex}`);
    const troopsLvlError = document.getElementById(`troopsLvlError${playerIndex}`);
    if (!fcLvlSelect || !troopsLvlSelect) return;
    const fcLvl = parseInt(fcLvlSelect.value.split('-')[1]);
    const troopsLvl = parseInt(troopsLvlSelect.value.split('-')[1]);
    if (troopsLvl > fcLvl || troopsLvl < fcLvl - 1) {
        troopsLvlError.classList.remove('hidden');
    } else {
        troopsLvlError.classList.add('hidden');
    }
    checkAllPlayerInputsValidity();
}
function checkAllPlayerInputsValidity() {
    const numPlayers = parseInt(numPlayersInput.value);
    let allValid = true;
    for (let i = 0; i < numPlayers; i++) {
        const playerNameInput = document.getElementById(`playerName${i}`);
        const playerAllianceSelect = document.getElementById(`playerAlliance${i}`);
        const playerFcLvlSelect = document.getElementById(`playerFcLvl${i}`);
        const playerTroopsLvlSelect = document.getElementById(`playerTroopsLvl${i}`);
        const troopsLvlError = document.getElementById(`troopsLvlError${i}`);
        if (!playerNameInput || playerNameInput.value.trim() === '' ||
            !playerAllianceSelect || playerAllianceSelect.value.trim() === '' ||
            !playerFcLvlSelect || playerFcLvlSelect.value.trim() === '' ||
            !playerTroopsLvlSelect || playerTroopsLvlSelect.value.trim() === '' ||
            (troopsLvlError && !troopsLvlError.classList.contains('hidden'))) {
            allValid = false;
            break;
        }
    }
    if (allValid) {
        nextToMatchmakingBtn.disabled = false;
        nextToMatchmakingBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        nextToMatchmakingBtn.disabled = true;
        nextToMatchmakingBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}
playerInputsContainer.addEventListener('input', checkAllPlayerInputsValidity);
playerInputsContainer.addEventListener('change', checkAllPlayerInputsValidity);

// --- Initial Rating ---
function getInitialRating(fcLevel, troopsLevel) {
    const fcRank = 8 - parseInt(fcLevel.split('-')[1]);
    const troopsRank = 8 - parseInt(troopsLevel.split('-')[1]);
    let rating = 1350;
    rating -= fcRank * 20;
    if (troopsRank === fcRank + 1) rating -= 10;
    return rating;
}

// --- Next Button for Player Details ---
nextToPlayerDetailsBtn.addEventListener('click', () => {
    const num = parseInt(numPlayersInput.value);
    if (isNaN(num) || num < 2 || num % 2 !== 0) {
        numPlayersError.classList.remove('hidden');
        showModal("Please enter a valid even number of participants (minimum 2).");
    } else {
        numPlayersError.classList.add('hidden');
        generatePlayerInputs(num);
        showPage(playerDetailsPage);
    }
});

// --- Start Matchmaking ---
nextToMatchmakingBtn.addEventListener('click', async () => {
    players = [];
    const numPlayers = parseInt(numPlayersInput.value);
    let allInputsValid = true;
    for (let i = 0; i < numPlayers; i++) {
        const playerNameInput = document.getElementById(`playerName${i}`);
        const playerAllianceSelect = document.getElementById(`playerAlliance${i}`);
        const playerFcLvlSelect = document.getElementById(`playerFcLvl${i}`);
        const playerTroopsLvlSelect = document.getElementById(`playerTroopsLvl${i}`);
        const troopsLvlError = document.getElementById(`troopsLvlError${i}`);
        if (!playerNameInput || playerNameInput.value.trim() === '' ||
            !playerAllianceSelect || playerAllianceSelect.value.trim() === '' ||
            !playerFcLvlSelect || playerFcLvlSelect.value.trim() === '' ||
            !playerTroopsLvlSelect || playerTroopsLvlSelect.value.trim() === '' ||
            (troopsLvlError && !troopsLvlError.classList.contains('hidden'))) {
            allInputsValid = false;
            showModal("Please ensure all player details are filled correctly and troops levels are valid.");
            break;
        }
        const fcLvl = playerFcLvlSelect.value;
        const troopsLvl = playerTroopsLvlSelect.value;
        const initialRating = getInitialRating(fcLvl, troopsLvl);
        players.push({
            id: `player_${Date.now()}_${i}`,
            name: playerNameInput.value.trim(),
            alliance: playerAllianceSelect.value,
            fcLevel: fcLvl,
            troopsLevel: troopsLvl,
            initialRating: initialRating,
            currentRating: initialRating,
            previousRating: initialRating,
            active: true
        });
    }
    if (allInputsValid) {
        players.sort((a, b) => b.currentRating - a.currentRating);
        currentRound = 1;
        roundHistory = [];
        await saveGameData();
        startRound();
        updateDashboard();
        showPage(matchmakingPage);
    }
});

// --- Matchmaking Logic ---
function startRound() {
    matches = [];
    const activePlayers = players.filter(p => p.active);
    activePlayers.sort((a, b) => b.currentRating - a.currentRating);
    for (let i = 0; i < activePlayers.length; i += 2) {
        if (i + 1 < activePlayers.length) {
            matches.push({
                player1: activePlayers[i],
                player2: activePlayers[i + 1],
                winner: null
            });
        }
    }
    renderMatches();
    checkAllMatchesPlayed();
}

// --- Render Matches ---
function renderMatches(matchesToDisplay = matches, roundNum = currentRound, containerElement = matchesContainer, isHistorical = false) {
    containerElement.innerHTML = '';
    if (matchesToDisplay.length === 0) {
        containerElement.innerHTML = `<p class="text-gray-300 text-center">No matches to display for Round ${roundNum}.</p>`;
        if (!isHistorical) {
            allMatchedPlayedBtn.disabled = true;
            allMatchedPlayedBtn.classList.add('opacity-50', 'cursor-not-allowed');
            copyMatchesBtn.disabled = true;
            copyMatchesBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        return;
    }
    if (containerElement === matchesContainer) {
        currentRoundDisplay.textContent = roundNum;
    } else if (containerElement === historyMatchesTable) {
        historyRoundMatchesDisplay.textContent = roundNum;
    }
    let tableHtml = `
        <table class="min-w-full bg-white rounded-lg shadow-md">
            <thead>
                <tr>
                    <th>Player 1 Name</th>
                    <th>Player 1 Alliance</th>
                    <th>Player 2 Name</th>
                    <th>Player 2 Alliance</th>
                    <th>Winner</th>
                </tr>
            </thead>
            <tbody>
    `;
    matchesToDisplay.forEach((match, index) => {
        const winnerOptions = `
            <option value="" ${match.winner === null ? 'selected' : ''}>Select Winner</option>
            <option value="player1" ${match.winner === 'player1' ? 'selected' : ''}>${match.player1.name}</option>
            <option value="player2" ${match.winner === 'player2' ? 'selected' : ''}>${match.player2.name}</option>
        `;
        tableHtml += `
            <tr>
                <td>${match.player1.name}</td>
                <td>${match.player1.alliance}</td>
                <td>${match.player2.name}</td>
                <td>${match.player2.alliance}</td>
                <td>
                    <select class="input-field w-auto" data-match-index="${index}" ${isHistorical ? 'disabled' : ''}>
                        ${winnerOptions}
                    </select>
                </td>
            </tr>
        `;
    });
    tableHtml += `
            </tbody>
        </table>
    `;
    containerElement.innerHTML = tableHtml;
    if (!isHistorical) {
        matchesToDisplay.forEach((match, index) => {
            const selectElement = containerElement.querySelector(`[data-match-index="${index}"]`);
            if (selectElement) {
                selectElement.addEventListener('change', () => selectMatchWinner(selectElement));
            }
        });
        checkAllMatchesPlayed();
        copyMatchesBtn.disabled = false;
        copyMatchesBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        historyDefaultMessage.classList.add('hidden');
        historyMatchesView.classList.remove('hidden');
    }
}

// --- Select Winner ---
function selectMatchWinner(selectElement) {
    const index = parseInt(selectElement.dataset.matchIndex);
    matches[index].winner = selectElement.value === "" ? null : selectElement.value;
    checkAllMatchesPlayed();
}

// --- Check All Matches Played ---
function checkAllMatchesPlayed() {
    const allWinnersSelected = matches.every(match => match.winner !== null && match.winner !== "");
    if (allWinnersSelected) {
        allMatchedPlayedBtn.disabled = false;
        allMatchedPlayedBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        allMatchedPlayedBtn.disabled = true;
        allMatchedPlayedBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

// --- Elo Calculation ---
function calculateElo(Ra, Rb, Sa) {
    const Ea = 1 / (1 + Math.pow(10, (Rb - Ra) / 400));
    const Eb = 1 / (1 + Math.pow(10, (Ra - Rb) / 400));
    const newRa = Ra + K_FACTOR * (Sa - Ea);
    const newRb = Rb + K_FACTOR * ((1 - Sa) - Eb);
    return [Math.round(newRa), Math.round(newRb)];
}

// --- Record Round History ---
function recordRoundHistory() {
    const matchesSnapshot = JSON.parse(JSON.stringify(matches));
    const playersSnapshot = JSON.parse(JSON.stringify(players));
    roundHistory.push({
        round: currentRound,
        matches: matchesSnapshot,
        playersSnapshot: playersSnapshot
    });
}

// --- All Matches Played Button ---
allMatchedPlayedBtn.addEventListener('click', async () => {
    matches.forEach(match => {
        const player1 = players.find(p => p.id === match.player1.id);
        const player2 = players.find(p => p.id === match.player2.id);
        if (player1 && player2) {
            player1.previousRating = player1.currentRating;
            player2.previousRating = player2.currentRating;
            let scoreP1 = 0;
            if (match.winner === 'player1') scoreP1 = 1;
            else if (match.winner === 'player2') scoreP1 = 0;
            const [newRatingP1, newRatingP2] = calculateElo(player1.currentRating, player2.currentRating, scoreP1);
            player1.currentRating = newRatingP1;
            player2.currentRating = newRatingP2;
        }
    });
    recordRoundHistory();
    currentRound++;
    await saveGameData();
    updateDashboard();
    if (players.length >= 2) {
        startRound();
    } else {
        showModal("All rounds complete! Not enough players for further matches. Please check the Dashboard for final rankings.");
        matchesContainer.innerHTML = '<p class="text-gray-300 text-center text-lg mt-8">Game finished! Check the Dashboard for final rankings.</p>';
        allMatchedPlayedBtn.disabled = true;
        allMatchedPlayedBtn.classList.add('opacity-50', 'cursor-not-allowed');
        copyMatchesBtn.disabled = true;
        copyMatchesBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
});

// --- Dashboard ---
function updateDashboard(playersToDisplay = players, roundNumberToDisplay = currentRound, containerElement = rankingsContainer, isHistorical = false) {
    const sortedPlayers = [...playersToDisplay].sort((a, b) => b.currentRating - a.currentRating);
    let tableHtml = `<table class="min-w-full bg-white rounded-lg shadow-md">
    <thead>
    <tr>
    <th>Rank</th><th>Name</th><th>Alliance</th><th>FC Level</th><th>Troops Level</th><th>Rating</th>${!isHistorical?'<th>Action</th>':''}
    </tr>
    </thead><tbody>`;
    sortedPlayers.forEach((player, index) => {
        let rowClass = '';
        if (!player.active) {
            rowClass = 'inactive-row';
        } else if (index === 0) rowClass = 'rank-1-row';
        else if (index === 1 || index === 2) rowClass = 'rank-2-3-row';
        else if (index >= 3 && index <= 9) rowClass = 'rank-4-10-row';
        else if (index >= 10 && index <= 19) rowClass = 'rank-11-20-row';
        else rowClass = 'rank-20-plus-row';

        let ratingChangeIndicator = '';
        if (!isHistorical && player.previousRating !== undefined) {
            if (player.currentRating > player.previousRating) {
                ratingChangeIndicator = `<span class="rating-arrow rating-up">&#9650;</span>`;
            } else if (player.currentRating < player.previousRating) {
                ratingChangeIndicator = `<span class="rating-arrow rating-down">&#9660;</span>`;
            }
        }

        tableHtml += `<tr class="${rowClass}">
        <td>${index+1}</td><td>${player.name}</td><td>${player.alliance}</td><td>${player.fcLevel}</td><td>${player.troopsLevel}</td><td>${player.currentRating} ${ratingChangeIndicator}</td>`;
        if (!isHistorical) {
            if (player.active) {
                tableHtml += `<td><button class='btn-secondary' onclick="dropPlayer('${player.id}')">Drop</button></td>`;
            } else {
                tableHtml += `<td><button class='btn-secondary' onclick="reactivatePlayer('${player.id}')">Re-activate</button></td>`;
            }
        }
        tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    containerElement.innerHTML = tableHtml;
}

// --- Drop / Reactivate ---
window.dropPlayer = function(id) {
    const player = players.find(p => p.id === id);
    if (player) {
        player.active = false;
        updateDashboard();
        startRound();
        saveGameData();
    }
};
window.reactivatePlayer = function(id) {
    const player = players.find(p => p.id === id);
    if (player) {
        player.active = true;
        updateDashboard();
        startRound();
        saveGameData();
    }
};

// --- History ---
function renderRoundList() {
    historyRoundList.innerHTML = '';
    if (roundHistory.length === 0) {
        historyRoundList.innerHTML = '<p class="text-gray-400">No rounds played yet.</p>';
        historyDefaultMessage.classList.remove('hidden');
        historyMatchesView.classList.add('hidden');
        historyRankingsView.classList.add('hidden');
        return;
    }
    roundHistory.forEach((roundData, index) => {
        const button = document.createElement('button');
        button.classList.add('history-round-btn');
        button.textContent = `Round ${roundData.round}`;
        button.dataset.roundIndex = index;
        button.addEventListener('click', () => displayHistoricalRound(index));
        historyRoundList.appendChild(button);
    });
    if (roundHistory.length > 0) {
        displayHistoricalRound(roundHistory.length - 1);
    }
}
function displayHistoricalRound(index) {
    document.querySelectorAll('.history-round-btn').forEach(btn => btn.classList.remove('active-round'));
    const selectedButton = document.querySelector(`.history-round-btn[data-round-index="${index}"]`);
    if (selectedButton) selectedButton.classList.add('active-round');
    const roundData = roundHistory[index];
    if (roundData) {
        historyDefaultMessage.classList.add('hidden');
        historyMatchesView.classList.remove('hidden');
        historyRankingsView.classList.remove('hidden');
        renderMatches(roundData.matches, roundData.round, historyMatchesTable, true);
        updateDashboard(roundData.playersSnapshot, roundData.round, historyRankingsTable, true);
    } else {
        showModal("Historical round data not found.");
    }
}

// --- Copy Buttons ---
function copyToClipboard(textToCopy, messageElement) {
    const tempInput = document.createElement('textarea');
    tempInput.value = textToCopy;
    tempInput.style.position = 'absolute';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
        document.execCommand('copy');
    } catch (err) {}
    document.body.removeChild(tempInput);
    messageElement.classList.remove('hidden');
    setTimeout(() => {
        messageElement.classList.add('hidden');
    }, 2000);
}
copyMatchesBtn.addEventListener('click', () => {
    let text = `Round ${currentRound}\n`;
    matches.forEach(match => {
        text += `${match.player1.name} (${match.player1.alliance}) vs ${match.player2.name} (${match.player2.alliance})\n`;
    });
    copyToClipboard(text.trim(), copyMatchesMessage);
});
copyRankingsBtn.addEventListener('click', () => {
    const sortedPlayers = [...players].sort((a, b) => b.currentRating - a.currentRating);
    let text = `Players Ranking up to round ${currentRound}\n`;
    sortedPlayers.forEach((player, index) => {
        text += `${index + 1}, ${player.name} (${player.alliance}), ${player.currentRating}\n`;
    });
    copyToClipboard(text.trim(), copyRankingsMessage);
});

// --- Tab Navigation ---
matchmakingTabBtn.addEventListener('click', () => showPage(matchmakingPage));
dashboardTabBtn.addEventListener('click', () => {
    updateDashboard();
    showPage(dashboardPage);
});
historyTabBtn.addEventListener('click', () => showPage(historyPage));

// --- Modal ---
function showModal(message) {
    modalMessage.textContent = message;
    customModal.classList.remove('hidden');
}
function hideModal() {
    customModal.classList.add('hidden');
}
modalCloseBtn.addEventListener('click', hideModal);

// --- Firebase Save/Load ---
const COLLECTION_NAME = 'eloRatingGames';
async function saveGameData() {
    if (!db || userId === 'anonymous') return;
    const gameDocRef = doc(db, "artifacts", appId, "users", userId, COLLECTION_NAME, "gameState");
    let retries = 0;
    const MAX_RETRIES = 5;
    const BASE_DELAY_MS = 1000;
    while (retries < MAX_RETRIES) {
        try {
            await setDoc(gameDocRef, {
                players: players,
                currentRound: currentRound,
                roundHistory: roundHistory,
                lastUpdated: serverTimestamp()
            }, { merge: true });
            return;
        } catch (e) {
            retries++;
            const delay = BASE_DELAY_MS * Math.pow(2, retries - 1);
            if (retries < MAX_RETRIES) await new Promise(res => setTimeout(res, delay));
        }
    }
}
async function loadGameData() {
    if (!db || userId === 'anonymous') {
        showPage(numPlayersPage);
        return;
    }
    const gameDocRef = doc(db, "artifacts", appId, "users", userId, COLLECTION_NAME, "gameState");
    let retries = 0;
    const MAX_RETRIES = 5;
    const BASE_DELAY_MS = 1000;
    while (retries < MAX_RETRIES) {
        try {
            const docSnap = await getDoc(gameDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                players = data.players || [];
                currentRound = data.currentRound || 1;
                roundHistory = data.roundHistory || [];
                if (players.length > 0) {
                    startRound();
                    updateDashboard();
                    showPage(matchmakingPage);
                } else {
                    showPage(numPlayersPage);
                }
            } else {
                showPage(numPlayersPage);
            }
            return;
        } catch (e) {
            retries++;
            const delay = BASE_DELAY_MS * Math.pow(2, retries - 1);
            if (retries < MAX_RETRIES) await new Promise(res => setTimeout(res, delay));
            else showPage(numPlayersPage);
        }
    }
}

// --- Firebase Initialization ---
window.onload = async function() {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                await loadGameData();
            } else {
                await signInAnonymously(auth);
            }
        });
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        }
    } catch (error) {
        showModal("If I use this tool, I promise to join SOh, don't forget you made a promise.");
        showPage(numPlayersPage);
    }
};