const BASE_URL = "http://localhost:3000"; //for local usage

const form = document.getElementById("digest-form");
const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const resultsEl = document.getElementById("results");
const failuresContainer = document.getElementById("failures-container");

const ownerEl = document.getElementById("owner");
const repoEl = document.getElementById("repo");
const tokenEl = document.getElementById("token");
const dateEl = document.getElementById("date");
const workspaceIdEl = document.getElementById("workspace-id");
const saveWorkspaceBtn = document.getElementById("save-workspace");
const loadWorkspaceBtn = document.getElementById("load-workspace");


const STORAGE_KEY = "wdyb-workspaces"; // stores { [workspaceId]: { owner, repo, token } }

function loadAllWorkspaces() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAllWorkspaces(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function saveWorkspaceLocally(workspaceId, owner, repo, token) {
  const all = loadAllWorkspaces();
  all[workspaceId] = { owner, repo, token };
  saveAllWorkspaces(all);
}

function getWorkspaceLocally(workspaceId) {
  const all = loadAllWorkspaces();
  return all[workspaceId] || null;
}


dateEl.value = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

// Prefill first stored workspace if exists
const existingWorkspaces = loadAllWorkspaces();
const firstId = Object.keys(existingWorkspaces)[0];
if (firstId) {
  const ws = existingWorkspaces[firstId];
  workspaceIdEl.value = firstId;
  ownerEl.value = ws.owner || "";
  repoEl.value = ws.repo || "";
  // token stays empty intentionally
}


function renderSummary(data) {
  summaryEl.innerHTML = `
    <div class="summary-grid">
      <div><strong>Repo</strong><br>${data.repo}</div>
      <div><strong>Date</strong><br>${data.date}</div>
      <div><strong>Merged PRs</strong><br>${data.totalMerged}</div>
      <div><strong>Commits</strong><br>${data.totalCommits}</div>
      <div><strong>Developers</strong><br>${data.devCount}</div>
    </div>
  `;
}

function renderDevDigest(dev) {
  const card = document.createElement("div");
  card.className = "dev-card";

  const prCount = dev.prs?.length || 0;
  const commitCount = dev.commits?.length || 0;
  const failureCount = dev.failures?.length || 0;
  const todoCount =
    dev.prs?.reduce((sum, pr) => sum + (pr.todos?.length || 0), 0) || 0;

  card.innerHTML = `
    <h2>${dev.author}</h2>
    <p class="dev-summary">
      PRs: ${prCount} · Commits: ${commitCount} · Failures: ${failureCount} · TODOs: ${todoCount}
    </p>
  `;

  if (dev.prs && dev.prs.length > 0) {
    const prSection = document.createElement("div");
    prSection.className = "section";
    prSection.innerHTML = "<h3>Pull Requests</h3>";

    const ul = document.createElement("ul");
    dev.prs.forEach((pr) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="${pr.htmlUrl}" target="_blank">
          #${pr.number} — ${pr.title}
        </a>
      `;

      if (pr.todos && pr.todos.length > 0) {
        const todoUl = document.createElement("ul");
        pr.todos.forEach((todo) => {
          const tli = document.createElement("li");
          tli.className = "todo";
          tli.textContent = `${todo.filename}: ${todo.text}`;
          todoUl.appendChild(tli);
        });
        li.appendChild(todoUl);
      }

      ul.appendChild(li);
    });
    prSection.appendChild(ul);
    card.appendChild(prSection);
  }

  if (dev.commits && dev.commits.length > 0) {
    const commitSection = document.createElement("div");
    commitSection.className = "section";
    commitSection.innerHTML = "<h3>Commits</h3>";

    const ul = document.createElement("ul");
    dev.commits.forEach((c) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="${c.htmlUrl}" target="_blank">
          ${c.sha.slice(0, 7)}
        </a>
        — ${c.message.split("\n")[0]}
      `;
      ul.appendChild(li);
    });
    commitSection.appendChild(ul);
    card.appendChild(commitSection);
  }

  return card;
}

function renderResults(devDigests) {
  resultsEl.innerHTML = "";
  if (!devDigests || devDigests.length === 0) {
    resultsEl.textContent = "No activity for this date.";
    return;
  }
  devDigests.forEach((dev) => {
    resultsEl.appendChild(renderDevDigest(dev));
  });
}

function renderFailures(devDigests) {
  failuresContainer.innerHTML = "";
  devDigests.forEach((dev) => {
    if (dev.failures && dev.failures.length > 0) {
      const authorSection = document.createElement("div");
      authorSection.innerHTML = `<h3>Failures by ${dev.author}</h3>`;
      const failureList = document.createElement("ul");
      dev.failures.forEach((failure) => {
        const failureItem = document.createElement("li");
        failureItem.innerHTML = `
          <strong>Commit SHA:</strong>
          <a href="https://github.com/${ownerEl.value}/${repoEl.value}/commit/${failure.commitSha}" target="_blank">
            ${failure.commitSha}
          </a><br>
          <strong>Message:</strong> ${failure.message}<br>
          <strong>Occurred At:</strong> ${new Date(failure.at).toLocaleString()}<br>
          <strong>Endpoint:</strong> ${failure.endpoint || "N/A"}<br>
          <strong>Service:</strong> ${failure.service || "N/A"}
        `;
        failureList.appendChild(failureItem);
      });
      authorSection.appendChild(failureList);
      failuresContainer.appendChild(authorSection);
    }
  });
}


// Save workspace (owner/repo/token)
saveWorkspaceBtn.addEventListener("click", async () => {
  statusEl.textContent = "Saving workspace config…";

  try {
    const res = await fetch(`${BASE_URL}/workspace/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: ownerEl.value,
        repo: repoEl.value,
        token: tokenEl.value,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to save workspace");
    }

    const workspaceId = data.workspaceId;
    workspaceIdEl.value = workspaceId;

    // Save workspace config in localStorage
    saveWorkspaceLocally(workspaceId, ownerEl.value, repoEl.value, tokenEl.value);

    statusEl.textContent = `Workspace saved (id: ${workspaceId}).`;
  } catch (err) {
    statusEl.textContent = "Error saving workspace: " + err.message;
  }
});

// Load workspace from localStorage only
loadWorkspaceBtn.addEventListener("click", async () => {
  const id = workspaceIdEl.value.trim();
  if (!id) {
    statusEl.textContent = "Please enter a workspace ID to load.";
    return;
  }

  const config = getWorkspaceLocally(id);
  if (!config) {
    statusEl.textContent = "Workspace not found in local storage.";
    return;
  }

  ownerEl.value = config.owner || "";
  repoEl.value = config.repo || "";
  // tokenEl.value left blank intentionally

  statusEl.textContent = "Workspace loaded.";
});


form.addEventListener("submit", async (e) => {
  e.preventDefault();

  statusEl.textContent = "Running digest…";
  summaryEl.innerHTML = "";
  resultsEl.innerHTML = "";
  failuresContainer.innerHTML = "";

  let owner = ownerEl.value;
  let repo = repoEl.value;
  let token = tokenEl.value;
  const date = dateEl.value;

  try {
    const wsId = workspaceIdEl.value.trim();
    if (wsId && !token) {
      const localCfg = getWorkspaceLocally(wsId);
      if (!localCfg) throw new Error("Workspace not found in local storage");
      owner = localCfg.owner;
      repo = localCfg.repo;
      token = localCfg.token;

      ownerEl.value = owner;
      repoEl.value = repo;
    }

    const res = await fetch(`${BASE_URL}/digest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, repo, token, date }),
    });

    const data = await res.json();
    console.log(data);

    if (!res.ok || !data.ok) throw new Error(data.error || "Digest failed");

    statusEl.textContent = "Done.";
    renderSummary(data);
    renderResults(data.devDigests);
    renderFailures(data.devDigests);
  } catch (err) {
    statusEl.textContent = "Error: " + err.message;
  }
});
