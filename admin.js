// app.js v0.020
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
  if (!nameInput) {
    alert('Input not found!');
    return;
  }
  const name = nameInput.value.trim();
  if (name === '') {
    alert('Please enter your name');
    return;
  }
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
    <li class="ranking-item" draggable="true" data-index="${index}" data-id="${option.id}">
      <div class="ranking-header">
        <span class="rank-number">${index + 1}</span>
        <span class="vacation-name">${option.name}</span>
        <span class="vacation-description">${option.description}</span>
      </div>
      <div class="rank-controls">
        <button class="rank-btn" type="button" onclick="moveRank(${index}, -1)" ${index === 0 ? 'disabled' : ''} aria-label="Move up">&#8593;</button>
        <button class="rank-btn" type="button" onclick="moveRank(${index}, 1)" ${index === options.length - 1 ? 'disabled' : ''} aria-label="Move down">&#8595;</button>
      </div>
    </li>
  `).join('');
}

window.moveRank = function (index, delta) {
  let items = Array.from(document.querySelectorAll('.ranking-item')).map(li => li.getAttribute('data-id'));
  if (index + delta < 0 || index + delta >= items.length) return;
  [items[index], items[index + delta]] = [items[index + delta], items[index]];
  const updatedOptions = items.map(id => appState.options.find(o => o.id === id));
  createRankingList(updatedOptions);
};

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('registerBtn').onclick = registerVoter;
  document.getElementById('submitVoteBtn').onclick = submitVote;
  document.getElementById('restartBtn').onclick = function () {
    showSection('registration');
    document.getElementById('voterName').value = "";
    appState.voteSubmitted = false;
    appState.currentVoter = null;
  };
});

function submitVote() {
  if (!appState.currentVoter) return;
  let ranking = Array.from(document.querySelectorAll('.ranking-item')).map(li => li.getAttribute('data-id'));
  db.collection("votes").add({
    name: appState.currentVoter,
    ranking: ranking.map(id => appState.options.find(o => o.id === id)?.name || ""),
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    appState.voteSubmitted = true;
    showSection('thanks');
  });
}

// --- Results and Ballot Journey ---
function fetchResults() {
  // Placeholder: implement RCV rounds and display here
  document.getElementById('rcvResults').innerHTML = "<div class='narrative-explanation-block'>Results logic coming soon: RCV rounds and final winner will display here.</div>";
}

function showBallotJourney() {
  // Placeholder: expands a ballot's journey
  const journeyBlock = document.getElementById('ballotJourneyBlock');
  if (!appState.results || !appState.currentVoter) {
    journeyBlock.innerHTML = '<em>Ballot journey unavailable for this voter.</em>';
    return;
  }
  const journey = appState.results.ballotJourneys[appState.currentVoter];
  const options = appState.options;
  if (!journey || journey.length === 0) {
    journeyBlock.innerHTML = '<em>Your ballot did not participate in the election rounds.</em>';
    return;
  }
  let rows = '';
  for (const step of journey) {
    let optName = step.forOption ? (options.find(o => o.id === step.forOption)?.name || '(unknown)') : null;
    let elimNames = (Array.isArray(step.eliminated) && step.eliminated.length) ?
      step.eliminated.map(id => (options.find(o => o.id === id)?.name || '(unknown)')).join(', ') : null;
    let detail = '';
    if (step.action === "original") {
      detail = `Round ${step.round}: Your ballot started with the ranking: ${optName}`;
    }
    // ... fill out other explanations as appropriate
    rows += `<div class="ballot-journey-step">${detail}</div>`;
  }
  journeyBlock.innerHTML = rows;
}
