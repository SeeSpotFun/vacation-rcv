// admin.js v0.100 SECURE - Vacation Ballot Admin (Firebase 10.5 compat)

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyApFSFEI4NaFHM1DDQhq6SDjGjNaNFcKmo",
  authDomain: "vacation-rcv.firebaseapp.com",
  projectId: "vacation-rcv",
  storageBucket: "vacation-rcv.appspot.com",
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

googleSignInBtn.onclick = function () {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => alert("Sign-in failed: " + err.message));
};

// Escape/encode helpers
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Admin Controls / UI ---
document.getElementById('refreshBtn').onclick = loadEverything;

function loadEverything() {
  fetchOptions();
  fetchVoters();
  fetchJourneys();
  fetchResults();
}

// --- CRUD for Vacation Options ---
function fetchOptions() {
  db.collection("options").orderBy("name").get().then((querySnapshot) => {
    let html = `<table><thead><tr><th>Name</th><th>Description</th><th>Edit</th><th>Delete</th></tr></thead><tbody>`;
    querySnapshot.forEach((doc) => {
      const o = doc.data();
      html += `<tr data-id="${doc.id}">
        <td>${escapeHtml(o.name)}</td>
        <td>${escapeHtml(o.description)}</td>
        <td><button class="editOptionBtn" data-id="${doc.id}" data-name="${escapeHtml(o.name)}" data-desc="${escapeHtml(o.description)}">Edit</button></td>
        <td><button class="deleteOptionBtn" data-id="${doc.id}">Delete</button></td>
      </tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById('optionsList').innerHTML = html;
    bindOptionEditDelete();
  });
}

// Bind edit/delete for options
function bindOptionEditDelete() {
  document.querySelectorAll('.editOptionBtn').forEach(btn => {
    btn.onclick = function () {
      openEditOptionDialog(btn.dataset.id, btn.dataset.name, btn.dataset.desc);
    };
  });
  document.querySelectorAll('.deleteOptionBtn').forEach(btn => {
    btn.onclick = function () {
      const docId = btn.dataset.id;
      if (confirm("Delete this option? This cannot be undone.")) {
        db.collection("options").doc(docId).delete().then(fetchOptions);
      }
    };
  });
}

document.getElementById('addOptionBtn').onclick = function () {
  const name = document.getElementById('optionNameInput').value.trim();
  const desc = document.getElementById('optionDescInput').value.trim();
  if (!name) { alert("Option name required."); return; }
  db.collection("options").add({ name, description: desc }).then(() => {
    document.getElementById('optionNameInput').value = "";
    document.getElementById('optionDescInput').value = "";
    fetchOptions();
  }).catch(e => alert("Add failed: " + e.message));
};

function openEditOptionDialog(id, name, desc) {
  const dialog = document.getElementById('editOptionDialog');
  document.getElementById('editOptionName').value = name;
  document.getElementById('editOptionDesc').value = desc;
  dialog.showModal();

  dialog.onsubmit = function (e) {
    e.preventDefault();
    db.collection("options").doc(id).set({
      name: document.getElementById('editOptionName').value.trim(),
      description: document.getElementById('editOptionDesc').value.trim()
    }).then(() => {
      dialog.close();
      fetchOptions();
    }).catch(err => alert("Edit failed: " + err.message));
  };
}

function closeEditOptionDialog() {
  document.getElementById('editOptionDialog').close();
}

// --- Delete All (reset) ---
document.getElementById('resetBtn').onclick = function () {
  if (!confirm("Delete ALL options and votes? This cannot be undone!")) return;
  function batchDelete(collection) {
    return db.collection(collection).get().then(snap => {
      const batch = db.batch();
      snap.forEach(doc => batch.delete(doc.ref));
      return batch.commit();
    });
  }
  Promise.all([
    batchDelete("options"),
    batchDelete("votes"),
    batchDelete("ballotJourneys")
  ]).then(loadEverything).catch(e => alert("Reset failed: " + e.message));
};

// --- View Voters/Ballots ---
function fetchVoters() {
  db.collection("votes").orderBy("timestamp", "desc").get().then(snap => {
    let html = `<table><thead><tr><th>Name</th><th>Ballot</th><th>Timestamp</th><th>Delete</th></tr></thead><tbody>`;
    snap.forEach(doc => {
      const d = doc.data();
      html += `<tr>
        <td>${escapeHtml(d.name)}</td>
        <td>${Array.isArray(d.ranking) ? d.ranking.map(x => escapeHtml(x)).join(", ") : ''}</td>
        <td>${d.timestamp ? new Date(d.timestamp.seconds * 1000).toLocaleString() : "?"}</td>
        <td><button class="deleteVoteBtn" data-id="${doc.id}">Delete</button></td>
      </tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById('votersList').innerHTML = html;
    bindDeleteVote();
  });
}

function bindDeleteVote() {
  document.querySelectorAll('.deleteVoteBtn').forEach(btn => {
    btn.onclick = function () {
      if (confirm("Delete this ballot?")) {
        db.collection("votes").doc(btn.dataset.id).delete().then(fetchVoters);
      }
    }
  });
}

// --- View Ballot Journeys ---
function fetchJourneys() {
  db.collection("ballotJourneys").get().then(snap => {
    let html = "";
    snap.forEach(doc => {
      const j = doc.data();
      html += `<div class="expanded-journey"><strong>${escapeHtml(doc.id)}</strong>: <pre>${JSON.stringify(j, null, 2)}</pre></div>`;
    });
    document.getElementById('allJourneys').innerHTML = html;
  });
}

// --- View Results (Simple Table for now) ---
function fetchResults() {
  // Display a summary of rankings
  db.collection("votes").get().then(snap => {
    let tally = {};
    snap.forEach(doc => {
      const data = doc.data();
      (data.ranking || []).forEach((id, idx) => {
        if (!tally[id]) tally[id] = {count: 0, ranks: []};
        tally[id].count += (appState.options && appState.options.find(o => o.id === id)) ? 1 : 0;
        tally[id].ranks.push(idx + 1);
      });
    });
    let html = `<table><thead><tr><th>Option ID</th><th># Ballots Ranked</th><th>All Ranks</th></tr></thead><tbody>`;
    for (const id in tally) {
      html += `<tr>
        <td>${escapeHtml(id)}</td>
        <td>${tally[id].count}</td>
        <td>${tally[id].ranks.join(', ')}</td>
      </tr>`;
    }
    html += `</tbody></table>`;
    document.getElementById('resultsContent').innerHTML = html;
  });
}

// Export close handler for dialog
window.closeEditOptionDialog = closeEditOptionDialog;
