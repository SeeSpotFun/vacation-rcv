// admin.js - Admin Page JS v0.008 (Ballot Journey for Each Voter Shows Eliminations/Why)

const ADMIN_CODE = "shane2025"; // Updated admin code!
let voterDocs = [];
let optionDocs = [];
let latestBallotJourneys = {}; // { voterName: [ { round, forOption, action, eliminated, because } ] }

function checkAdminLogin() {
    const input = document.getElementById('adminPassword');
    const panel = document.getElementById('adminPanel');
    const loginDiv = document.getElementById('adminLogin');
    const err = document.getElementById('loginError');
    if (input.value.trim() === ADMIN_CODE) {
        panel.style.display = 'block';
        loginDiv.style.display = 'none';
        err.textContent = '';
        fetchOptions();
        fetchVoters();
    } else {
        err.textContent = "Incorrect admin code!";
    }
}
const pwInput = document.getElementById('adminPassword');
const loginBtn = document.getElementById('loginBtn');
if (pwInput && loginBtn) {
    pwInput.addEventListener('keypress', function(e){
        if(e.key === 'Enter'){ window.checkAdminLogin(); }
    });
    loginBtn.addEventListener('click', window.checkAdminLogin);
} else {
    setTimeout(function() {
        const pwInput2 = document.getElementById('adminPassword');
        const loginBtn2 = document.getElementById('loginBtn');
        if (pwInput2 && loginBtn2) {
            pwInput2.addEventListener('keypress', function(e){
                if(e.key === 'Enter'){ window.checkAdminLogin(); }
            });
            loginBtn2.addEventListener('click', window.checkAdminLogin);
        }
    }, 200);
}

// == OPTION (CHOICE) MANAGEMENT ==
function fetchOptions(callback) {
    db.collection("options").orderBy("name").get().then((querySnapshot) => {
        optionDocs = [];
        let html = "<tr><th>Name</th><th>Description</th><th>Actions</th></tr>";
        querySnapshot.forEach((doc) => {
            const o = doc.data();
            optionDocs.push({ id: doc.id, data: o });
            html += `
                <tr>
                    <td><input value="${o.name || ""}" onchange="window.editOption('${doc.id}',this.value,null)" style="width:180px;"></td>
                    <td><input value="${o.description || ""}" onchange="window.editOption('${doc.id}',null,this.value)" style="width:340px;"></td>
                    <td>
                        <button onclick="window.deleteOption('${doc.id}')" class="danger">Delete</button>
                    </td>
                </tr>
            `;
        });
        document.getElementById('optionsTable').innerHTML = html;
        if (callback) callback();
    });
}
function addOption() {
    const name = document.getElementById('newOptionName').value.trim();
    const desc = document.getElementById('newOptionDesc').value.trim();
    if (!name) { alert("Name required!"); return; }
    db.collection("options").add({ name, description: desc }).then(() => {
        document.getElementById('newOptionName').value = "";
        document.getElementById('newOptionDesc').value = "";
        fetchOptions();
    });
}
function editOption(docId, newName, newDesc) {
    const docRef = db.collection("options").doc(docId);
    const o = optionDocs.find(x => x.id === docId)?.data || {};
    docRef.update({
        name: newName !== null ? newName : o.name,
        description: newDesc !== null ? newDesc : o.description
    }).then(fetchOptions);
}
function deleteOption(docId) {
    if (!confirm("Delete this option for all voters?")) return;
    db.collection("options").doc(docId).delete().then(fetchOptions);
}

// == VOTER MANAGEMENT ==
function fetchVoters() {
    db.collection("options").get().then((optionSnapshot) => {
        let optionMap = {};
        optionSnapshot.forEach(optDoc => {
            optionMap[optDoc.id] = optDoc.data().name;
        });
        db.collection("votes").get().then((querySnapshot) => {
            voterDocs = [];
            let allVotesData = {};
            let html = "<tr><th>Name</th><th>Ranking</th><th>Submitted</th><th>Action</th><th>Journey</th></tr>\n";
            let count = 0;
            querySnapshot.forEach((doc) => {
                const v = doc.data();
                voterDocs.push({ id: doc.id, data: v });
                let rankingNames = (v.rankings || []).map(id => optionMap[id] || id).join(", ");
                allVotesData[v.name] = Array.isArray(v.rankings) ? v.rankings : [];
                html += `<tr>
                    <td>${v.name || "(no name)"}</td>
                    <td>${rankingNames || "—"}</td>
                    <td>${v.timestamp ? new Date(v.timestamp.seconds*1000).toLocaleString() : ""}</td>
                    <td><button class='danger' onclick='window.deleteVoter("${doc.id}")'>Delete</button></td>
                    <td><button class='btn gray' onclick="window.showVoterJourney('${v.name.replace(/'/g,"\\'") || ""}')">Show Journey</button></td>
                </tr>`;
                count++;
            });
            document.getElementById("votersTable").innerHTML = html;
            document.getElementById("voterCount").textContent = count;
            calculateAllBallotJourneysForAdmin(optionDocs, allVotesData);
        });
    });
}

function deleteVoter(docId) {
    if (!confirm("Delete this voter and their vote?")) return;
    db.collection("votes").doc(docId).delete().then(fetchVoters);
}
function resetAllVotes() {
    if (!confirm("Delete ALL votes? This cannot be undone!")) return;
    db.collection("votes").get().then((querySnapshot) => {
        const batch = db.batch();
        querySnapshot.forEach((doc) => { batch.delete(doc.ref); });
        batch.commit().then(() => fetchVoters());
    });
}

// Ballot journey calculation mirrors updated app.js explanations
function calculateAllBallotJourneysForAdmin(optionsList, allVotes) {
    const options = optionsList.map(doc => ({ id: doc.id, name: doc.data.name }));
    const votesObj = allVotes;
    const voterNames = Object.keys(votesObj);
    const totalVoters = voterNames.length;
    let remainingOptions = [...options];
    let safety = 0;
    let allBallotJourneys = {};
    voterNames.forEach(name => { allBallotJourneys[name] = []; });
    let eliminatedHistory = [];
    let eliminatedNamesByRound = [];

    while (remainingOptions.length > 1 && safety < 30) {
        safety++;
        const voteCounts = {};
        remainingOptions.forEach(option => {
            voteCounts[option.id] = 0;
        });
        const currentChoicesByVoter = {};
        Object.entries(votesObj).forEach(([voterName, rankingList]) => {
            const filtered = (rankingList||[]).filter(id =>
                remainingOptions.find(opt => opt.id === id));
            if (filtered.length > 0) {
                voteCounts[filtered[0]]++;
                currentChoicesByVoter[voterName] = filtered[0];
            } else {
                currentChoicesByVoter[voterName] = null;
            }
        });

        // Elimination logic
        const sortedResults = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
        if (sortedResults.length === 0) break;
        const [topId, topCount] = sortedResults[0];
        let roundEliminated = [];
        let tie = false;
        if (topCount >= Math.floor(totalVoters / 2) + 1) {
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
        Object.entries(votesObj).forEach(([voterName, rankingList]) => {
            const thisChoice = currentChoicesByVoter[voterName];
            let journeyArr = allBallotJourneys[voterName];
            let previous = journeyArr.length ? journeyArr[journeyArr.length - 1] : null;
            if (thisChoice === null) {
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
        if (topCount >= Math.floor(totalVoters / 2) + 1) break;
        if (roundEliminated.length === remainingOptions.length) break;
        eliminatedHistory.push(...roundEliminated);
        remainingOptions = remainingOptions.filter(opt => !roundEliminated.includes(opt.id));
        if (remainingOptions.length === 0) break;
    }
    latestBallotJourneys = allBallotJourneys;
}

// Admin display for modal
function showVoterJourney(name) {
    const optionsList = optionDocs.map(doc => ({ id: doc.id, name: doc.data.name }));
    if (!name || !latestBallotJourneys[name]) {
        document.getElementById('adminBallotJourney').innerHTML = '<p>No journey found for this ballot.</p>';
        document.getElementById('journeyDialog').showModal();
        return;
    }
    const steps = latestBallotJourneys[name];
    let rows = '';
    for (const step of steps) {
        let optName = step.forOption ? (optionsList.find(o => o.id === step.forOption)?.name || '(unknown)') : null;
        let elimNames = (Array.isArray(step.eliminated) && step.eliminated.length)
            ? step.eliminated.map(id => (optionsList.find(o => o.id === id)?.name || '(unknown)')).join(', ')
            : null;
        let detail = '';
        if (step.action === "original") {
            detail = `Round ${step.round}: Ballot started with <strong>${optName}</strong>.`;
            if (elimNames) detail += ` (Eliminated: ${elimNames})`;
        } else if (step.action === "stay") {
            detail = `Round ${step.round}: Ballot stayed with <strong>${optName}</strong>.`;
            if (elimNames) detail += ` (Eliminated: ${elimNames})`;
            if (step.because) detail += ` Reason: ${step.because}`;
        } else if (step.action === "transferred") {
            detail = `Round ${step.round}: Ballot transferred to <strong>${optName}</strong> because ${step.because}`;
            if (elimNames) detail += ` (Eliminated: ${elimNames})`;
        } else if (step.action === "exhausted") {
            detail = `Round ${step.round}: Ballot became exhausted. ${step.because}`;
        } else {
            detail = `Round ${step.round}: [No data]`;
        }
        rows += `<div class="ballot-journey-step">${detail}</div>`;
    }
    document.getElementById('adminBallotJourney').innerHTML = rows;
    document.getElementById('journeyDialog').showModal();
}

window.checkAdminLogin = checkAdminLogin;
window.editOption = editOption;
window.addOption = addOption;
window.deleteOption = deleteOption;
window.fetchOptions = fetchOptions;
window.deleteVoter = deleteVoter;
window.resetAllVotes = resetAllVotes;
window.showVoterJourney = showVoterJourney;
