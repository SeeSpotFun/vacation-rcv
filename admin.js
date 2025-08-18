// admin.js - Secure Google Auth RCV Admin Panel with full add/edit option functionality

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

// Option management (add, edit, delete)
function fetchOptions() {
  db.collection("options").orderBy("name").get().then((querySnapshot) => {
    let html = "<table style='width:100%;'><tr><th>Name</th><th>Description</th><th>Edit</th><th>Delete</th></tr>";
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
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;")
             .replace(/'/g, "&#39;")
             .replace(/"/g, "&quot;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;");
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
    });
};
window.deleteOption = function(optionId) {
  if (confirm("Delete this option?")) {
    db.collection("options").doc(optionId).delete().then(fetchOptions);
  }
};

// Edit Option functions
window.showEditOptionDialog = function(optionId, optionName, optionDesc) {
  document.getElementById('editOptionName').value = htmlDecode(optionName);
  document.getElementById('editOptionDesc').value = htmlDecode(optionDesc);
  const dialog = document.getElementById('editOptionDialog');
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
      });
  };
};
window.closeEditOptionDialog = function() {
  document.getElementById('editOptionDialog').close();
};
function htmlDecode(input){
  var e = document.createElement('textarea');
  e.innerHTML = input;
  return e.value;
}

// Voters & Ballots
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
window.viewBallotJourney = function(voterName) {
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
