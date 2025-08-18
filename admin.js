// admin.js - Secure Google Auth RCV Admin Panel with Full Feature Set

// === Firebase Config ===
const firebaseConfig = {
  apiKey: "AIzaSyApFSFEI4NaFHM1DDQhq6SDjGjNaNFcKmo",
  authDomain: "vacation-rcv.firebaseapp.com",
  projectId: "vacation-rcv",
  storageBucket: "vacation-rcv.firebasestorage.app",
  messagingSenderId: "996338082046",
  appId: "1:996338082046:web:18912786289e84da2205af"
};

// Admins: Update this with ALL accounts you wish to allow
const ADMIN_EMAILS = [
  "thisismygameaddress@gmail.com"
];

// === Firebase Initialization ===
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// === DOM Elements ===
const adminPanel = document.getElementById('adminPanel');
const authSection = document.getElementById('authSection');
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

// Auth state
auth.onAuthStateChanged((user) => {
  if (user) {
    setSignedInUI(user);
    if (ADMIN_EMAILS.includes(user.email)) {
      showAdminPanel(true);
      fetchOptions();
      fetchVoters();
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

// === Admin Panel Logic ===

// -- Option (Choice) Management --
function fetchOptions() {
  db.collection("options").orderBy("name").get().then((querySnapshot) => {
    let html = "<ul>";
    querySnapshot.forEach((doc) => {
      const { name, description } = doc.data();
      html += `<li>
        <b>${name}</b> <span style="color:#888;">${description||""}</span>
        <button onclick="deleteOption('${doc.id}')" class="danger" title="Delete">&#10060;</button>
      </li>`;
    });
    html += "</ul>";
    document.getElementById('optionsList').innerHTML = html;
  });
}

window.deleteOption = function(optionId) {
  if (confirm("Delete this option?")) {
    db.collection("options").doc(optionId).delete().then(fetchOptions);
  }
};
document.getElementById('addOptionBtn').onclick = function() {
  const val = document.getElementById('optionNameInput').value.trim();
  if (!val) return;
  db.collection("options").add({ name: val, description: "" })
    .then(() => { document.getElementById('optionNameInput').value = ""; fetchOptions(); });
};

// -- Voters & Ballots Management --
function fetchVoters() {
  db.collection("votes").orderBy("name").get().then((querySnapshot) => {
    let html = `<table>
      <tr><th>Name</th><th>Ballot</th><th>Submitted</th><th>Show Journey</th></tr>`;
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      html += `<tr>
        <td>${data.name}</td>
        <td>${Array.isArray(data.ranking) ? data.ranking.join(", ") : ''}</td>
        <td>${data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString() : "?"}</td>
        <td><button onclick="viewBallotJourney('${doc.data().name}')" class="btn--primary">View</button></td>
      </tr>`;
    });
    html += "</table>";
    document.getElementById('votersList').innerHTML = html;
  });
}

// -- Ballot Journey Display --
window.viewBallotJourney = function(voterName) {
  // Retrieve and render ballot journey for this voter
  db.collection("ballotJourneys").doc(voterName).get().then((doc) => {
    if (!doc.exists || !doc.data() || !doc.data().steps) {
      document.getElementById('journeyDialogContent').innerHTML =
        "<b>No journey found for this ballot.</b>";
      document.getElementById('journeyDialog').showModal();
      return;
    }
    const steps = doc.data().steps;
    let rows = '';
    for (const step of steps) {
      let elim = step.eliminated ? `<span style="color:#ee3d3d;">Eliminated: ${Array.isArray(step.eliminated)?step.eliminated.join(", "):step.eliminated}</span>` : '';
      let line = `<div style="padding-bottom:4px;">
        <b>Round ${step.round}</b>: Voted for <b>${step.forOption}</b> — ${step.action||''} ${elim}
        ${step.because ? "<br><i>" + step.because + "</i>" : ""}
      </div>`;
      rows += line;
    }
    document.getElementById('journeyDialogContent').innerHTML = rows;
    document.getElementById('journeyDialog').showModal();
  });
};
