// app.js v0.100 SECURE - Family Vacation Voting App (Firebase 10.5 compat)

const firebaseConfig = {
  apiKey: "AIzaSyApFSFEI4NaFHM1DDQhq6SDjGjNaNFcKmo",
  authDomain: "vacation-rcv.firebaseapp.com",
  projectId: "vacation-rcv",
  storageBucket: "vacation-rcv.appspot.com",
  messagingSenderId: "996338082046",
  appId: "1:996338082046:web:18912786289e84da2205af"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const appState = {
  currentSection: 'registration',
  currentVoter: null,
  voteSubmitted: false,
  votes: [],
  options: [],
  results: null,
  ranking: [],
};

// Show only the desired section
function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(section => section.classList.add('hidden'));
  document.getElementById(sectionId).classList.remove('hidden');
  appState.currentSection = sectionId;
}

// Load all vacation options
function loadOptions(callback) {
  db.collection("options").orderBy("name").get().then(querySnapshot => {
    appState.options = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      appState.options.push({ id: doc.id, name: data.name || "", description: data.description || "" });
    });
    if (callback) callback();
  });
}

// Handle registration form submit
function registerVoter() {
  const nameInput = document.getElementById('voterName');
  if (!nameInput) { alert('Input not found!'); return; }
  const name = nameInput.value.trim();
  if (name === '') { alert('Please enter your name.'); return; }
  appState.currentVoter = name;
  checkIfAlreadyVoted(name, alreadyVoted => {
    if (alreadyVoted) {
      alert("It looks like you've already voted! Only one vote per name is allowed.");
    } else {
      showSection('voting');
      setupVotingInterface();
    }
  });
}

function checkIfAlreadyVoted(name, callback) {
  db.collection("votes").where("name", "==", name).get().then(querySnapshot => {
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
  appState.ranking = options.map(option => option.id);
  const rankingList = document.getElementById('rankingList');
  rankingList.innerHTML = options.map((option, index) =>
    `<li draggable="true" data-id="${option.id}" class="ranking-item">
      <span class="ranking-rank">${index + 1}</span>
      <span class="ranking-option">${option.name}</span>
      <span class="ranking-description" style="color:#b2b7be;font-size:87%;">${option.description}</span>
    </li>`).join("");
  enableDragDropRanking(rankingList, options);
}

function enableDragDropRanking(rankingList, options) {
  let dragged;
  rankingList.querySelectorAll('li').forEach(item => {
    item.draggable = true;
    item.ondragstart = function (e) { dragged = this; this.style.opacity = 0.5; };
    item.ondragend = function (e) { dragged = null; this.style.opacity = ""; };
    item.ondragover = function (e) { e.preventDefault(); };
    item.ondrop = function (e) {
      e.preventDefault();
      if (dragged && dragged !== this) {
        rankingList.insertBefore(dragged, this.nextSibling);
        updateRankingFromDOM(rankingList);
      }
    };
  });
}

function updateRankingFromDOM(rankingList) {
  appState.ranking = Array.from(rankingList.children).map(li => li.getAttribute('data-id'));
}

function submitVote() {
  const name = appState.currentVoter;
  if (!name) return alert("Error: No name found.");
  if (!Array.isArray(appState.ranking) || appState.ranking.length !== appState.options.length) {
    return alert("Please rank all options.");
  }
  const ranking = appState.ranking;
  db.collection("votes").add({
    name,
    ranking,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  })
    .then(() => {
      appState.voteSubmitted = true;
      showSection("thanks");
    })
    .catch((e) => alert("Failed to submit vote: " + e.message));
}

function resetBallot() {
  appState.currentVoter = null;
  appState.ranking = [];
  appState.voteSubmitted = false;
  showSection('registration');
}

// Event listeners and initial setup
window.addEventListener('DOMContentLoaded', () => {
  const tag = document.getElementById("jsVersionTag");
  if (tag) tag.textContent = "JS v0.100 SECURE";
  showSection('registration');
  loadOptions();

  // Registration flow
  document.getElementById('registerBtn').onclick = (e) => {
    e.preventDefault();
    registerVoter();
  };

  // Voting submit button
  document.getElementById('submitVoteBtn').onclick = (e) => {
    e.preventDefault();
    updateRankingFromDOM(document.getElementById('rankingList'));
    submitVote();
  };

  // Thanks "Return to Ballot"
  document.getElementById('restartBtn').onclick = resetBallot;
});
