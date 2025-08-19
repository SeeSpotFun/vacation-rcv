// admin.js - Full Secure Admin Panel: RCV Results, Resets, and Journey Expansion

// === Firebase Config ===
const firebaseConfig = {
  apiKey: "AIzaSyApFSFEI4NaFHM1DDQhq6SDjGjNaNFcKmo",
  authDomain: "vacation-rcv.firebaseapp.com",
  projectId: "vacation-rcv",
  storageBucket: "vacation-rcv.firebasestorage.app",
  messagingSenderId: "996338082046",
  appId: "1:996338082046:web:18912786289e84da2205af"
};
const ADMIN_EMAILS = [
  "thisismygameaddress@gmail.com"
];
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const adminPanel = document.getElementById('adminPanel');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const userEmailDiv = document.getElementById('userEmail');
const nonAdminMsg = document.getElementById('nonAdminMsg');

// --- Auth/Access Control ---
function setSignedInUI(user) {
  userEmailDiv.textContent = `Signed in as: ${user.email}`;
  googleSignInBtn.style.display = 'none';
}
function showAdminPanel(show) {
  adminPanel.style.display = show ? 'block' : 'none';
  nonAdminMsg.style.display = show ? 'none' : 'block';
}
auth.onAuthStateChanged((user) => {
  if (user) {
    setSignedInUI(user);
    if (ADMIN_EMAILS.includes(user.email)) {
      showAdminPanel(true);
      loadEverything();
    } else {
      showAdminPanel(false);
    }
  } else {
    adminPanel.style.display = 'none';
    nonAdminMsg.style.display = 'none';
    userEmailDiv.textContent = "";
    googleSignInBtn.style.display = '';
  }
});
googleSignInBtn.onclick = function() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => alert("Sign-in failed: " + err.message));
};
// -- Utility --
function htmlDecode(input){
  var e = document.createElement('textarea');
  e.innerHTML = input;
  return e.value;
}
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;")
             .replace(/'/g, "&#39;")
             .replace(/"/g, "&quot;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;");
}
// --- Admin Controls ---

document.getElementById('refreshBtn').onclick = loadEverything;

function loadEverything() {
  fetchOptions();
  fetchVoters();
  fetchJourneys();
  fetchResults();
}

// --- Vacation Options CRUD ---
function fetchOptions() {
  db.collection("options").orderBy("name").get().then((querySnapshot) => {
    let html = "<table style='width:100%;'>";
    html += "<tr><th>Name</th><th>Description</th><th>Edit</th><th>Delete</th></tr>";
    querySnapshot.forEach((doc) => {
      const { name, description = "" } = doc.data();
      html += `<tr>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(description)}</td>
        <td><button onclick="showEditOptionDialog('${doc.id}', '${escapeHtml(name)}', '${escapeHtml(description)}')">Edit</button></td>
        <td><button onclick="deleteOption('${doc.id}')" class="danger" title="Delete">&#10060;</button></td>
      </tr>`;
    });
    html += "</table>";
    document.getElementById('optionsList').innerHTML = html;
  });
}
document.getElementById('addOptionBtn').onclick = function() {
  const nameVal = document.getElementById('optionNameInput').value.trim();
  const descVal = document.getElementById('optionDescInput').value.trim();
  if (!nameVal) return alert("Please enter an option name.");
  db.collection("options").add({ name: nameVal, description: descVal })
    .then(() => {
      document.getElementById('optionNameInput').value = "";
      document.getElementById('optionDescInput').value = "";
      fetchOptions();
      fetchResults();
    });
};
window.deleteOption = function(optionId) {
  if (confirm("Delete this option?")) {
    db.collection("options").doc(optionId).delete().then(() => {fetchOptions(); fetchResults();});
  }
};
// Edit Option
window.showEditOptionDialog = function(optionId, optionName, optionDesc) {
  const dialog = document.getElementById('editOptionDialog');
  document.getElementById('editOptionName').value = htmlDecode(optionName);
  document.getElementById('editOptionDesc').value = htmlDecode(optionDesc);

  dialog.returnValue = "";
  dialog.showModal();

  dialog.onsubmit = function(e) {
    e.preventDefault();
    const newName = document.getElementById('editOptionName').value.trim();
    const newDesc = document.getElementById('editOptionDesc').value.trim();
    if (!newName) return alert("Please enter a name.");
    db.collection("options").doc(optionId).update({ name: newName, description: newDesc })
      .then(() => {
        dialog.close();
        fetchOptions();
        fetchResults();
      });
  };
};
window.closeEditOptionDialog = function() {
  const dialog = document.getElementById('editOptionDialog');
  dialog.close();
};

// --- Delete All/Reset Button ---
document.getElementById('resetBtn').onclick = function() {
  if (confirm("Are you ABSOLUTELY SURE you want to DELETE ALL options, votes, and ballot journeys? There is NO UNDO.")) {
    Promise.all([
      deleteAllFromCollection("options"),
      deleteAllFromCollection("votes"),
      deleteAllFromCollection("ballotJourneys")
    ]).then(loadEverything);
  }
};
function deleteAllFromCollection(colName) {
  return db.collection(colName).get().then((snap) => 
    Promise.all(snap.docs.map(doc => doc.ref.delete()))
  );
}

// --- Voters & Ballots ---
function fetchVoters() {
  db.collection("votes").orderBy("name").get().then((querySnapshot) => {
    let html = `<table>
      <tr><th>Name</th><th>Ballot</th><th>Submitted</th><th>Show Journey</th><th>Delete</th></tr>`;
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      html += `<tr>
        <td>${escapeHtml(data.name)}</td>
        <td>${Array.isArray(data.ranking) ? data.ranking.join(", ") : ''}</td>
        <td>${data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString() : "?"}</td>
        <td><button onclick="viewBallotJourney('${escapeHtml(doc.data().name)}')" class="btn--primary">View</button></td>
        <td><button onclick="deleteUserBallot('${doc.id}')" class="danger">&#10060;</button></td>
      </tr>`;
    });
    html += "</table>";
    document.getElementById('votersList').innerHTML = html;
  });
}
window.deleteUserBallot = function(voteId) {
  if (confirm("Delete this voter's ballot? This removes their vote and ballot journey.")) {
    db.collection("votes").doc(voteId).get().then((voteDoc) => {
      if (voteDoc.exists && voteDoc.data().name) {
        db.collection("ballotJourneys").doc(voteDoc.data().name).delete();
      }
    }).then(() => db.collection("votes").doc(voteId).delete())
      .then(() => {fetchVoters(); fetchJourneys(); fetchResults();});
  }
};
// -- Ballot Journeys: Expanded for All --
function fetchJourneys() {
  db.collection("ballotJourneys").get().then((querySnapshot) => {
    let html = "";
    querySnapshot.forEach((doc) => {
      const d = doc.data();
      html += `<div class="expanded-journey"><b>${escapeHtml(doc.id)}</b><br>`;
      if (d && Array.isArray(d.steps) && d.steps.length > 0) {
        d.steps.forEach((step) => {
          let elim = step.eliminated ? `<span style="color:#ee3d3d;">Eliminated: ${Array.isArray(step.eliminated)?step.eliminated.join(", "):step.eliminated}</span>` : '';
          html += `<div style="margin-left:1em; font-size:0.98em;">
            <b>Round ${step.round}</b>: <b>${escapeHtml(step.forOption)}</b> — ${escapeHtml(step.action||"")}${elim?" · "+elim:""}
            ${step.because ? "<br><i>" + escapeHtml(step.because) + "</i>" : ""}
          </div>`;
        });
      } else {
         html += `<div>No journey found for this ballot.</div>`;
      }
      html += `</div>`;
    });
    document.getElementById('allJourneys').innerHTML = html;
  });
};

// -- Quick Ballot Journey Modal for Voters Table --
window.viewBallotJourney = function(voterName) {
  db.collection("ballotJourneys").doc(voterName).get().then((doc) => {
    if (!doc.exists || !doc.data() || !doc.data().steps) {
      alert("No journey found for this ballot.");
      return;
    }
    const steps = doc.data().steps;
    let rows = '';
    for (const step of steps) {
      let elim = step.eliminated ? `<span style="color:#ee3d3d;">Eliminated: ${Array.isArray(step.eliminated)?step.eliminated.join(", "):step.eliminated}</span>` : '';
      let line = `<div style="padding-bottom:4px;">
        <b>Round ${step.round}</b>: Voted for <b>${escapeHtml(step.forOption)}</b> — ${escapeHtml(step.action||'')}${elim?" · "+elim:""}
        ${step.because ? "<br><i>" + escapeHtml(step.because) + "</i>" : ""}
      </div>`;
      rows += line;
    }
    alert(rows.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n').replace(/^\n/, ''));
  });
};

// --- RCV Results inside Admin ---
async function fetchResults() {
  // Get live data
  const optionsSnap = await db.collection("options").get();
  const votesSnap = await db.collection("votes").get();

  const options = [];
  optionsSnap.forEach(doc => options.push({ id: doc.id, ...doc.data() }));
  const optionNames = options.map(o => o.name);

  const votes = [];
  votesSnap.forEach(doc => {
    const d = doc.data();
    votes.push({
      ranking: Array.isArray(d.ranking) ? d.ranking : [],
      name: d.name || "",
      timestamp: d.timestamp
    });
  });

  // Tabs UI like the public app
  const tabs = [
    { id: "elims", label: "Elimination Rounds" },
    { id: "indiv", label: "Individual Rankings" },
    { id: "journeys", label: "Your Ballot Journey" }
  ];
  let tabHtml = "";
  tabs.forEach((tab, i) => {
    tabHtml += `<button data-tab='${tab.id}' class='resultTabBtn' ${i==0?"style='font-weight:bold'":""}>${tab.label}</button>`;
  });
  document.getElementById('resultsTabs').innerHTML = tabHtml;
  showResultsTab("elims", options, votes);

  Array.from(document.getElementsByClassName('resultTabBtn')).forEach(btn => {
    btn.onclick = function() {
      Array.from(document.getElementsByClassName('resultTabBtn')).forEach(b=>b.style.fontWeight="");
      this.style.fontWeight="bold";
      showResultsTab(this.getAttribute('data-tab'), options, votes);
    };
  });
}
function showResultsTab(tab, options, votes) {
  if (tab=="elims") {
    document.getElementById('resultsContent').innerHTML = renderRCVElims(options, votes);
  } else if (tab=="indiv") {
    document.getElementById('resultsContent').innerHTML = renderRCVIndividual(votes, options);
  } else if (tab=="journeys") {
    document.getElementById('resultsContent').innerHTML = `<i>See "All Ballot Journeys" section above for all journeys in detail.</i>`;
  }
}
// RCV Elimination calculation -- simplified from original app logic
function renderRCVElims(options, votes) {
  if (options.length === 0) return '<i>No options available.</i>';
  if (votes.length === 0) return '<i>No votes yet.</i>';

  let results = votingRounds(options.map(o=>o.name), votes.map(v=>v.ranking));
  let html = "<b>Round-by-Round Results</b><br><div>";
  results.rounds.forEach((r, i) => {
    html += `<div style="margin:1em 0;"><b>Round ${i+1} - ${r.isWinner?"Winner Determined!":"Results"}</b><br>`;
    // List options and votes
    for(const c of r.counts) {
      html += `<div style="margin-left:1em;margin-bottom:2px;">
        ${escapeHtml(c.option)}
        ${r.isWinner && c.votes === r.maxVotes ? " 🏆" : ""}
        <span style="float:right;">${c.votes} vote${c.votes!==1?'s':''} (${Math.round((c.votes/results.totalVotes)*100)}%)</span>
      </div>`;
    }
    html += "</div>";
  });
  html += "</div>";
  return html;
}
// Helper for simple RCV
function votingRounds(optionNames, rankingsArr) {
  let rounds = [];
  let stillRunning = [...optionNames];
  let voteObjs = rankingsArr.map(arr => ({remaining: arr.filter(o=>optionNames.includes(o))}));
  let winner = null, roundNum = 1;
  let totalVotes = voteObjs.length;

  while(!winner && stillRunning.length>0) {
    // Tally
    let counts = stillRunning.map(o => ({
      option: o,
      votes: voteObjs.filter(v=>v.remaining[0]===o).length
    }));
    let maxVotes = Math.max(...counts.map(c=>c.votes));
    let minVotes = Math.min(...counts.map(c=>c.votes));
    let possibleWinners = counts.filter(c=>c.votes === maxVotes);
    // Check for winner: >50% of total
    if (maxVotes > totalVotes/2 && possibleWinners.length === 1) {
      rounds.push({counts, maxVotes, isWinner: true});
      winner = possibleWinners[0].option;
      break;
    }
    // If all tied or only 1 left
    if (maxVotes === minVotes) {
      rounds.push({counts, maxVotes, isWinner: true});
      winner = possibleWinners[0].option;
      break;
    }
    rounds.push({counts, maxVotes, isWinner:false});
    // Eliminate lowest
    let minOptions = counts.filter(c=>c.votes===minVotes).map(c=>c.option);
    stillRunning = stillRunning.filter(o=>!minOptions.includes(o));
    voteObjs.forEach(v=>{
      v.remaining = v.remaining.filter(o=>!minOptions.includes(o));
    });
    roundNum++;
  }
  return { rounds, totalVotes };
}
function renderRCVIndividual(votes, options) {
  let html = "<b>Individual Ballots</b><br><table><tr><th>Name</th>";
  options.forEach(o=>html+=`<th>${escapeHtml(o.name)}</th>`);
  html+="</tr>";
  votes.forEach((v) => {
    html += `<tr><td>${escapeHtml(v.name)}</td>`;
    options.forEach((o)=>{
      let idx = v.ranking.indexOf(o.name);
      html += `<td>${idx>=0?(idx+1):""}</td>`;
    });
    html += "</tr>";
  });
  html+="</table>";
  return html;
}
