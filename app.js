// app.js

// Family Vacation Voting App | JS v0.020 - Ballot Journey Now Explains Eliminations & Why
(function () {
    const tag = document.getElementById("jsVersionTag");
    if (tag) tag.textContent = "v0.020";
    console.log("Vacation Voting App JS version v0.020 loaded");
})();

let appState = {
    currentSection: 'registration',
    currentVoter: null,
    voteSubmitted: false,
    votes: {},
    results: null,
    options: []
};

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => section.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
    appState.currentSection = sectionId;
}

function loadOptions(callback) {
    db.collection("options").orderBy("name").get().then((querySnapshot) => {
        appState.options = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            appState.options.push({
                id: doc.id,
                name: data.name || "",
                description: data.description || ""
            });
        });
        if (callback) callback();
    });
}

function registerVoter() {
    const nameInput = document.getElementById('voterName');
    if (!nameInput) { alert('Input not found!'); return; }
    const name = nameInput.value.trim();
    if (name === '') { alert('Please enter your name'); return; }
    appState.currentVoter = name;
    checkIfAlreadyVoted(name, (alreadyVoted) => {
        if (alreadyVoted) {
            alert("It looks like you've already voted! Only one vote per name is allowed.");
        } else {
            showSection('voting');
            setupVotingInterface();
        }
    });
}
function checkIfAlreadyVoted(name, callback) {
    db.collection("votes")
        .where("name", "==", name)
        .get()
        .then((querySnapshot) => {
            callback(!querySnapshot.empty);
        });
}
function setupVotingInterface() {
    document.getElementById('currentVoterName').textContent = `Ranking for ${appState.currentVoter}`;
    const shuffledOptions = [...appState.options].sort(() => Math.random() - 0.5);
    createRankingList(shuffledOptions);
    document.getElementById("submitVoteBtn").textContent = "Submit My Ranking";
    document.getElementById("submitVoteBtn").style.display = "inline-flex";
}
function createRankingList(options) {
    const rankingList = document.getElementById('rankingList');
    rankingList.innerHTML = options.map((option, index) => `
        <div class="ranking-item" draggable="true" data-id="${option.id}">
            <div class="ranking-header">
                <div class="rank-number">${index + 1}</div>
                <div class="rank-controls">
                    <button class="rank-btn" onclick="window.moveUp('${option.id}')" ${index === 0 ? 'disabled' : ''}>↑</button>
                    <button class="rank-btn" onclick="window.moveDown('${option.id}')" ${index === options.length - 1 ? 'disabled' : ''}>↓</button>
                </div>
            </div>
            <div class="vacation-name">${option.name}</div>
            <div class="vacation-description">${option.description}</div>
        </div>
    `).join('');
    setupDragAndDrop();
}
function clearRankingList() {
    const rankingList = document.getElementById('rankingList');
    if (rankingList) rankingList.innerHTML = '';
}
function moveUp(optionId) {
    const items = Array.from(document.querySelectorAll('.ranking-item'));
    const currentIndex = items.findIndex(item => item.dataset.id === optionId);
    if (currentIndex > 0) {
        const item = items[currentIndex];
        const prevItem = items[currentIndex - 1];
        item.parentNode.insertBefore(item, prevItem);
        updateRankNumbers();
    }
}
function moveDown(optionId) {
    const items = Array.from(document.querySelectorAll('.ranking-item'));
    const currentIndex = items.findIndex(item => item.dataset.id === optionId);
    if (currentIndex < items.length - 1) {
        const item = items[currentIndex];
        const nextItem = items[currentIndex + 1];
        item.parentNode.insertBefore(nextItem, item);
        updateRankNumbers();
    }
}
function updateRankNumbers() {
    const items = document.querySelectorAll('.ranking-item');
    items.forEach((item, index) => {
        item.querySelector('.rank-number').textContent = index + 1;
        item.querySelector('.rank-btn:first-child').disabled = index === 0;
        item.querySelector('.rank-btn:last-child').disabled = index === items.length - 1;
    });
}
function setupDragAndDrop() {
    const items = document.querySelectorAll('.ranking-item');
    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
    });
}
let draggedElement = null;
function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this !== draggedElement) this.classList.add('drag-over');
}
function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    if (this !== draggedElement) {
        const allItems = Array.from(document.querySelectorAll('.ranking-item'));
        const draggedIndex = allItems.indexOf(draggedElement);
        const targetIndex = allItems.indexOf(this);
        if (draggedIndex < targetIndex) {
            this.parentNode.insertBefore(draggedElement, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedElement, this);
        }
        updateRankNumbers();
    }
}
function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.ranking-item').forEach(item => item.classList.remove('drag-over'));
    draggedElement = null;
}
function submitVote() {
    if (appState.voteSubmitted) {
        alert("You have already voted. Thank you!");
        return;
    }
    const items = document.querySelectorAll('.ranking-item');
    const ranking = Array.from(items).map(item => item.dataset.id);
    if (!appState.currentVoter) {
        alert("Please enter your name before voting.");
        return;
    }
    db.collection("votes").add({
        name: appState.currentVoter,
        rankings: ranking,
        timestamp: new Date()
    }).then(() => {
        appState.voteSubmitted = true;
        fetchAllVotesFromFirebase(() => {
            showSection('results');
            displayResults();
        });
    }).catch((error) => {
        alert("Error submitting vote: " + error);
    });
}
function fetchAllVotesFromFirebase(callback) {
    db.collection("votes").get().then((querySnapshot) => {
        appState.votes = {};
        querySnapshot.forEach((doc) => {
            const voteData = doc.data();
            appState.votes[voteData.name] = Array.isArray(voteData.rankings)
                ? voteData.rankings.filter(id => typeof id === "string" && id.length > 0)
                : [];
        });
        if (callback) callback();
    });
}

// ----- RESULTS CALC/NARRATIVE/BALLOT JOURNEY + EXPLANATION ------
function calculateResults() {
    const options = appState.options;
    const totalVoters = Object.keys(appState.votes).length;
    const greaterThanHalf = Math.floor(totalVoters / 2) + 1;
    let remainingOptions = [...options];
    let rounds = [];
    let safety = 0;
    let allBallotJourneys = {};
    Object.keys(appState.votes).forEach(voterName => {
        allBallotJourneys[voterName] = [];
    });

    let eliminatedHistory = [];
    let eliminatedNamesByRound = [];
    while (remainingOptions.length > 1 && safety < 30) {
        safety++;
        const voteCounts = {};
        remainingOptions.forEach(option => {
            voteCounts[option.id] = 0;
        });

        // Tally votes and build pre-round map for ballot journey logic
        const currentChoicesByVoter = {};

        Object.entries(appState.votes).forEach(([voterName, rankingList]) => {
            const filtered = rankingList.filter(id =>
                remainingOptions.find(opt => opt.id === id));
            if (filtered.length > 0) {
                voteCounts[filtered[0]]++;
                currentChoicesByVoter[voterName] = filtered[0];
            } else {
                currentChoicesByVoter[voterName] = null;
            }
        });

        // Elimination step:
        const sortedResults = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
        if (sortedResults.length === 0) break;
        const [topId, topCount] = sortedResults[0];

        // Prepare elimination info
        let roundEliminated = [];
        let reason = "";
        let tie = false;
        if (topCount >= greaterThanHalf) {
            roundEliminated = [];
        } else {
            const fewestVotes = sortedResults[sortedResults.length - 1][1];
            roundEliminated = sortedResults
                .filter(([, count]) => count === fewestVotes)
                .map(([id]) => id);
            if (roundEliminated.length === remainingOptions.length) {
                tie = true;
            }
        }
        eliminatedNamesByRound.push(
            roundEliminated.map(eid =>
                (options.find(o => o.id === eid)?.name) || '(unknown)'
            )
        );

        // Ballot journey explanations
        Object.entries(appState.votes).forEach(([voterName, rankingList]) => {
            const thisChoice = currentChoicesByVoter[voterName];
            let journeyArr = allBallotJourneys[voterName];
            let previous = journeyArr.length ? journeyArr[journeyArr.length - 1] : null;
            // Decide what happened this round
            if (thisChoice === null) {
                // exhausted
                journeyArr.push({
                    round: safety,
                    forOption: null,
                    action: 'exhausted',
                    eliminated: roundEliminated,
                    because: roundEliminated.length
                        ? `All your ranked choices were eliminated this round: ${roundEliminated.map(id => options.find(o=>o.id===id)?.name||"(unknown)").join(', ')}.`
                        : "All your ranked choices were already out."
                });
            } else if (!previous) {
                journeyArr.push({
                    round: safety,
                    forOption: thisChoice,
                    action: 'original',
                    eliminated: roundEliminated,
                    because: ""
                });
            } else if (thisChoice === previous.forOption) {
                // Stayed with the same candidate
                journeyArr.push({
                    round: safety,
                    forOption: thisChoice,
                    action: 'stay',
                    eliminated: roundEliminated,
                    because:
                        roundEliminated.length
                            ? `Eliminated: ${roundEliminated.map(id => options.find(o=>o.id===id)?.name||"(unknown)").join(', ')} for having the fewest votes.`
                            : ''
                });
            } else {
                // Transferred to another candidate
                let prevRanked = null;
                for (let id of rankingList) {
                    if (
                        previous.forOption &&
                        id === previous.forOption &&
                        roundEliminated.includes(id)
                    ) {
                        prevRanked = id;
                        break;
                    }
                }
                let reasonText = "";
                if (prevRanked) {
                    reasonText =
                        `${options.find(o=>o.id===prevRanked)?.name}: your higher-ranked choice, was eliminated for having the fewest votes this round.`;
                } else {
                    reasonText =
                        `Your vote moved to ${options.find(o=>o.id===thisChoice)?.name||thisChoice}.`;
                }
                journeyArr.push({
                    round: safety,
                    forOption: thisChoice,
                    action: 'transferred',
                    eliminated: roundEliminated,
                    because: reasonText
                });
            }
        });

        // Winner or tie?
        if (topCount >= greaterThanHalf) {
            rounds.push({
                round: rounds.length + 1,
                votes: voteCounts,
                winner: topId,
                eliminated: null
            });
            appState.results = {
                winner: topId,
                rounds,
                narrative: buildNarrative(rounds, options, true, totalVoters, greaterThanHalf),
                ballotJourneys: allBallotJourneys
            };
            return;
        }
        if (roundEliminated.length === remainingOptions.length) {
            // Tie! Add to rounds and finish.
            rounds.push({
                round: rounds.length + 1,
                votes: voteCounts,
                winner: null,
                eliminated: null,
                tie: true,
                tiedOptions: roundEliminated
            });
            appState.results = {
                winner: null,
                tiedOptions: roundEliminated,
                rounds,
                narrative: buildNarrative(rounds, options, false, totalVoters, greaterThanHalf),
                ballotJourneys: allBallotJourneys
            };
            return;
        }

        rounds.push({
            round: rounds.length + 1,
            votes: voteCounts,
            winner: null,
            eliminated: roundEliminated
        });
        remainingOptions = remainingOptions.filter(opt => !roundEliminated.includes(opt.id));
        if (remainingOptions.length === 0) break;
    }
    if (remainingOptions.length === 1) {
        appState.results = {
            winner: remainingOptions[0].id,
            rounds,
            narrative: buildNarrative(rounds, options, true, totalVoters, greaterThanHalf, true),
            ballotJourneys: allBallotJourneys
        };
        return;
    } else if (remainingOptions.length > 1) {
        appState.results = {
            winner: null,
            tiedOptions: remainingOptions.map(opt => opt.id),
            rounds,
            narrative: buildNarrative(rounds, options, false, totalVoters, greaterThanHalf),
            ballotJourneys: allBallotJourneys
        };
        return;
    } else if (rounds.length) {
        const lastRound = rounds[rounds.length - 1];
        let winnerKey = null;
        let winnerVotes = -1;
        for (const [optionId, count] of Object.entries(lastRound.votes || {})) {
            if (count > winnerVotes) {
                winnerKey = optionId;
                winnerVotes = count;
            }
        }
        if (winnerKey) {
            appState.results = {
                winner: winnerKey,
                rounds,
                narrative: buildNarrative(rounds, options, true, totalVoters, greaterThanHalf),
                ballotJourneys: allBallotJourneys
            };
            return;
        }
    }
    appState.results = {
        winner: null,
        rounds,
        narrative: "No valid vacation option could be determined as the winner from the submitted rankings.",
        ballotJourneys: allBallotJourneys
    };
}

function percent(count, total) {
    return total > 0 ? Math.round(count / total * 100) + "%" : "0%";
}
function buildNarrative(rounds, options, hasWinner, totalVoters, greaterThanHalf, onlyOneLeft) {
    if (!rounds || rounds.length === 0) return "";
    let out = [];
    let eliminated = [];
    let winnerName = "";
    for (let round of rounds) {
        let desc = `Round ${round.round}: `;
        if (round.eliminated) {
            let elimNames = Array.isArray(round.eliminated)
                ? round.eliminated.map(id => (options.find(opt => opt.id === id) || { name: id }).name)
                : [(options.find(opt => opt.id === round.eliminated) || { name: round.eliminated }).name];
            eliminated = eliminated.concat(elimNames);
            desc += `Eliminated ${elimNames.join(", ")}.`;
        } else if (round.tie && round.tiedOptions) {
            let tieNames = round.tiedOptions.map(id => (options.find(opt => opt.id === id) || { name: id }).name);
            desc += `Unbreakable tie between ${tieNames.join(", ")} (all with equal votes).`;
        } else if (round.winner) {
            winnerName = (options.find(opt => opt.id === round.winner) || { name: round.winner }).name;
            const votes = round.votes[round.winner];
            const perc = percent(votes, totalVoters);
            desc += `Winner found: ${winnerName} received ${votes} vote${votes !== 1 ? 's' : ''} (${perc}), which is greater than 50% of all ballots.`;
        }
        out.push(desc);
    }
    if (hasWinner && onlyOneLeft && winnerName) {
        out.push(`${winnerName} was declared the winner after all other options were eliminated, as is standard in Ranked Choice Voting when only one option remains—even if they have less than or equal to 50% of original first-choice votes.`);
    }
    if (!hasWinner && eliminated.length > 0) {
        out.push("Despite eliminations and redistributions, no option received greater than 50% of the votes and a tie or deadlock occurred.");
    }
    return out.join(" ");
}

// -------- UI: Results, Rounds, Journey Tabs --------
function displayResults() {
    calculateResults();
    const options = appState.options;
    const { winner, tiedOptions, narrative } = appState.results;
    const winnerDiv = document.getElementById('winnerDisplay');
    if (winner) {
        const winnerOption = options.find(opt => opt.id === winner);
        winnerDiv.innerHTML = winnerOption
            ? `<div class="winner-name">${winnerOption.name}</div><div class="winner-description">${winnerOption.description}</div>`
            : `<div style="color:#c00;">Unknown winner</div>`;
    } else if (tiedOptions && tiedOptions.length > 0) {
        const tiedNames = tiedOptions.map(id => {
            const opt = options.find(o => o.id === id);
            return opt ? opt.name : "(unknown)";
        }).join(", ");
        winnerDiv.innerHTML = `<div style="color:#c00;">No winner&mdash;tie between:</div>
            <div class="winner-name">${tiedNames}</div>`;
    } else {
        winnerDiv.innerHTML = `<div style="color:#c00;">No winner could be determined</div>`;
    }
    displayEliminationRounds();
    displayIndividualRankings();
    displayBallotJourney();
    const existingNarrative = document.getElementById('narrativeExplanation');
    let target = document.querySelector('#results .section-actions');
    if (existingNarrative) existingNarrative.remove();
    if (target) {
        let para = document.createElement('div');
        para.id = 'narrativeExplanation';
        para.className = 'narrative-explanation-block';
        para.textContent = (narrative && narrative.length > 0)
            ? "How the winner was decided: " + narrative
            : "How the winner was decided: After ranked eliminations, the final vacation option with the strongest remaining support was selected.";
        target.parentNode.insertBefore(para, target.nextSibling);
    }
}

// Ballot Journey shows what was eliminated and why!
function displayBallotJourney() {
    // Only show for current session voter if present!
    const journeyTab = document.getElementById('journeyTab');
    const journeyBlock = document.getElementById('ballotJourney');
    if (!appState.currentVoter || !journeyTab || !journeyBlock || !appState.results) {
        if (journeyBlock) journeyBlock.innerHTML = '<p>Ballot journey unavailable for this voter.</p>';
        return;
    }
    const journey = appState.results.ballotJourneys[appState.currentVoter];
    const options = appState.options;
    if (!journey || journey.length === 0) {
        journeyBlock.innerHTML = '<p>Your ballot did not participate in the election rounds.</p>';
        return;
    }
    let rows = '';
    for (const step of journey) {
        let optName = step.forOption ? (options.find(o => o.id === step.forOption)?.name || '(unknown)') : null;
        let elimNames = (Array.isArray(step.eliminated) && step.eliminated.length)
            ? step.eliminated.map(id => (options.find(o => o.id === id)?.name || '(unknown)')).join(', ')
            : null;
        let detail = '';
        if (step.action === "original") {
            detail = `Round ${step.round}: Your ballot started with <strong>${optName}</strong>.`;
            if (elimNames) detail += ` (Eliminated: ${elimNames})`;
        } else if (step.action === "stay") {
            detail = `Round ${step.round}: Your ballot stayed with <strong>${optName}</strong>.`;
            if (elimNames) detail += ` (Eliminated: ${elimNames})`;
            if (step.because) detail += ` Reason: ${step.because}`;
        } else if (step.action === "transferred") {
            detail = `Round ${step.round}: Your ballot transferred to <strong>${optName}</strong> because ${step.because}`;
            if (elimNames) detail += ` (Eliminated: ${elimNames})`;
        } else if (step.action === "exhausted") {
            detail = `Round ${step.round}: Your ballot became exhausted. ${step.because}`;
        } else {
            detail = `Round ${step.round}: [No data]`;
        }
        rows += `<div class="ballot-journey-step">${detail}</div>`;
    }
    journeyBlock.innerHTML = rows;
}

// --- Rounds and Rankings tabs (UNCHANGED) ---
function displayEliminationRounds() {
    const options = appState.options;
    const totalVoters = Object.keys(appState.votes).length;
    const roundsContainer = document.getElementById('eliminationRounds');
    roundsContainer.innerHTML = appState.results.rounds.map(round => {
        const roundResults = Object.entries(round.votes)
            .sort((a, b) => b[1] - a[1])
            .map(([optionId, votes]) => {
                const option = options.find(opt => opt.id === optionId);
                const isEliminated = Array.isArray(round.eliminated)
                    ? round.eliminated && round.eliminated.includes(optionId)
                    : round.eliminated === optionId;
                const isWinner = round.winner === optionId;
                return option ? `
                    <div class="result-item ${isEliminated ? 'eliminated' : ''}">
                        <span>${option.name} ${isWinner ? '🏆' : ''}</span>
                        <span>${votes} vote${votes !== 1 ? 's' : ''} <span class="votes-percent">(${percent(votes, totalVoters)})</span></span>
                    </div>
                ` : '';
            }).join('');
        const eliminatedNames = Array.isArray(round.eliminated)
            ? round.eliminated.map(eid => {
                const eo = options.find(o => o.id === eid);
                return eo ? eo.name : "";
            }).filter(Boolean).join(', ')
            : (round.eliminated
                ? (options.find(o => o.id === round.eliminated) || { name: "" }).name
                : null);
        return `
            <div class="elimination-round">
                <div class="round-header">
                    Round ${round.round}
                    ${
                        round.tie && round.tiedOptions && round.tiedOptions.length
                        ? " - Tie between: " +
                            round.tiedOptions.map(tid => {
                                const t = options.find(o => o.id === tid);
                                return t ? t.name : "(unknown)";
                            }).join(", ")
                        : eliminatedNames
                            ? " - Eliminated: " + eliminatedNames
                            : (round.winner ? " - Winner Determined!" : "")
                    }
                </div>
                <div class="round-results">
                    ${roundResults}
                </div>
            </div>
        `;
    }).join('');
}
function displayIndividualRankings() {
    const options = appState.options;
    const individualContainer = document.getElementById('individualRankings');
    individualContainer.innerHTML = Object.keys(appState.votes).map(voter => {
        const voterRanking = appState.votes[voter];
        const rankingItems = voterRanking.map((optionId, index) => {
            const option = options.find(opt => opt.id === optionId);
            return option ? `
                <div class="voter-ranking-item">
                    <div class="voter-rank-number">${index + 1}</div>
                    <span>${option.name}</span>
                </div>
            ` : '';
        }).join('');
        return `
            <div class="individual-voter">
                <div class="voter-header">${voter}</div>
                <div class="voter-rankings">
                    ${rankingItems}
                </div>
            </div>
        `;
    }).join('');
}
function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    document.querySelector(`[onclick="window.showTab('${tabName}')"]`).classList.add('active');
    document.getElementById(tabName + 'Tab').classList.remove('hidden');
}
function resetApp() {
    appState = {
        currentSection: 'registration',
        currentVoter: null,
        voteSubmitted: false,
        votes: {},
        results: null,
        options: appState.options
    };
    showSection('registration');
    document.getElementById('voterName').value = '';
    clearRankingList();
    updateVotedNamesList();
}
function updateVotedNamesList() {
    db.collection("votes").get().then((querySnapshot) => {
        const names = [];
        querySnapshot.forEach((doc) => {
            const voteData = doc.data();
            if (voteData.name) names.push(voteData.name);
        });
        const list = document.getElementById('votedNamesList');
        if (list) {
            list.innerHTML = names.length
                ? names.map(name => `<li>${name}</li>`).join('')
                : `<li style="color: #888;">No one has voted yet</li>`;
        }
    });
}
window.registerVoter = registerVoter;
window.submitVote = submitVote;
window.showTab = showTab;
window.resetApp = resetApp;
window.moveUp = moveUp;
window.moveDown = moveDown;
updateVotedNamesList();
setInterval(updateVotedNamesList, 10000);
document.addEventListener('DOMContentLoaded', function() {
    loadOptions(function(){
        showSection('registration');
        let resetButton = document.querySelector('#results .section-actions .btn.btn--secondary');
        if (resetButton) resetButton.textContent = "Let Another Member Vote";
    });
});
console.log("JS code for Family Vacation Voting loaded (v0.020)");
