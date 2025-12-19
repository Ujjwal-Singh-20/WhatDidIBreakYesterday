# What Did I Break Yesterday?
A Motia‑powered daily digest that helps developers revisit what they shipped yesterday: merged PRs, direct commits, TODO/FIXME debt, and errors that occurred after their changes. It is built to be safe to use on a shared hosted backend (tokens stay in the browser) while still showcasing Motia’s unified runtime (API steps, state, and workflows).

---

## Live demo
### Frontend (Vercel):

https://wdiby-736ii6hml-ujjwal-singhs-projects-4476a310.vercel.app/

### Backend (Motia on Cloud Run):

https://wdyb-motia-327801006985.europe-west1.run.app/

#### Hosted files can be found in this github repo:

https://github.com/Ujjwal-Singh-20/WDIBY-hosted.git

---

## How the hosted version works

### The frontend:
You open the Vercel URL.

You provide:

- Your GitHub PAT (stays only in your browser).

- owner and repo.

- A date (defaults to yesterday).

The frontend calls the Cloud Run backend:

`POST /digest/run` -> generates a per‑developer digest for that repo/date.

(Optional) You or your app can call `POST /track-error` to attach errors to specific commits.

### The backend:

Reads from the GitHub REST API (PRs, commits, PR files).​

Reads tracked errors from Motia state.​

Returns a digest grouped per developer (PRs, commits, TODOs, failures).

### The frontend renders:

A summary header per developer (PRs, commits, failures, TODOs).

Sections for PRs, Commits, and Failures, with direct GitHub links.

---

## Security posture of hosted demo:

GitHub token is kept in localStorage on the client only and sent with each digest request; it is not stored in Motia state.

Motia state is used only for errors and digest snapshots, which are keyed by repo/owner/date, not by secrets.​

This lets multiple users safely share the same backend instance while still demonstrating Motia’s state capabilities.

> Multiple developers can point the frontend at the same backend and collaboratively see the same error and digest history per repo, while each keeps their own PAT and workspace config local and private.

---

## Problem & solution
### Problem:

Developers ship code, switch context, and the next day:

Forget which PRs/commits they merged.

Lose track of TODO/FIXME/HACK comments they just created.

Only discover breakages when someone pings them or CI dashboards are manually checked.

Lack of fast, targeted feedback and context is a known productivity killer for dev teams.

### Solution:

What Did I Break Yesterday gives each developer a daily or on‑demand “yesterday digest” for any GitHub repo:

List of merged PRs and direct commits for a given date.

Extracted TODO/FIXME/HACK debt from the PR diffs.

Failures (errors) that happened for specific commits, sent via `/track-error` and joined by commit SHA.​

This turns a scattered set of tools (GitHub, logs, error trackers) into a single reflection surface that makes it easy to clean up and iterate at the start of the day.

---

## Features
### For developers:

Per‑dev summary header

PR count, commit count, failure count, and TODO count for the selected date.

Pull Requests section

All PRs merged that day, with:

Number, title, link to GitHub.

Nested TODO/FIXME/HACK lines with file names.

Commits section

Direct commits (even without PRs), with short SHA, subject line, and GitHub link.

Failures section (“what broke”)

Errors tied to specific commits via /track-error, with message, time, endpoint, and service.​

### For teams / backend systems:

Error tracking lightweight API

`POST /track-error` accepts { owner, repo, commitSha, message, date?, endpoint?, service? }.

Stores entries in Motia state under ("errors", owner/repo:date:sha).​

Digest snapshots

`POST /digest/run` computes devDigests and also stores them under ("digest", owner/repo:date) for potential preview or caching.

---

## Architecture & Motia usage
### High‑level flow
#### Frontend (static HTML/JS on Vercel):

Collects owner, repo, token, date.

Sends requests to the Motia backend on Cloud Run.

Motia backend (Cloud Run container):

API Steps:

`/digest/run` (main digest).

`/track-error` (error ingestion).

`/workspace/config` and `/workspace/config/get` (used in local/dev, optional in production).

#### Motia state groups:

"errors": arrays of error entries per owner/repo:date:sha.

"digest": last computed devDigests per owner/repo:date.​

- `/digest/run` (core backend logic)

    - Given { owner, repo, token, date }:

        Uses GitHub REST APIs:

            List closed PRs and filter by merged_at in [dateT00:00Z, dateT23:59Z].​

            List commits with since/until window for that date.​

            For each PR, list changed files and parse patch for added lines containing TODO|FIXME|HACK. ​

            Reads errors from Motia state:

            For each commit SHA, does state.get("errors", owner/repo:date:sha) and attaches any entries into a failures[] list.​

            Groups everything by developer (author) into devDigests[]

    - Each devDigest contains:

        - author (GitHub login or author name).

        - prs[] with number, title, mergedAt, htmlUrl, todos[].

        - commits[] with sha, message, htmlUrl.

        - failures[] with commitSha, message, endpoint, service, at.

    - Finally, it:

        - Stores devDigests in state.set("digest", owner/repo:date, devDigests).​

        - Returns a JSON body with repo/date counts and devDigests.

- `/track-error` (what broke, API)
    - Given { owner, repo, commitSha, message, date?, endpoint?, service? }:

        - Normalizes date to YYYY-MM-DD (or defaults to today).

        - Appends an error entry to Motia state key ("errors", owner/repo:date:sha).​

        - On the next `/digest/run` for that date, those errors show up under the corresponding dev.

        - This pattern mirrors how GitHub‑linked error tracking tools associate failures with commit ownership.​

---

## Cloning & local setup
#### You can run the project locally with your own Motia instance.

1. Clone the repository

```bash
git clone https://github.com/Ujjwal-Singh-20/WhatDidIBreakYesterday.git

cd WhatDidIBreakYesterday
```

2. Install dependencies
Assuming Node.js LTS is installed:

```bash
cd WDIBY # to get inside backend folder

npm install
```

3. Set environment variables
Create a .env in the project root for local dev:

[Optional] demo env for cron



    DEMO_OWNER="your-github-username-or-org"

    DEMO_REPO="your-repo-name"

    DEMO_TOKEN="ghp_xxx"  # read-only PAT


- #### Any other env your Motia setup uses
    - For normal API usage, `/digest/run` takes owner, repo, and token from the request body, 

        so .env is mainly for demo/cron.


4. Run Motia backend locally


`npm run dev` or `npx motia dev`

This starts:

Motia server (APIs on http://localhost:3000)

Motia Workbench (visual flows, logs) at http://localhost:3000.

5. Serve the frontend locally

`cd frontend`

`npx serve -l 5000`

Then in app.js, point BASE_URL to your local backend:

```js
const BASE_URL = "http://localhost:3000";
```

Open http://localhost:5000 (or whatever serve port) and use the app.

---

## Cloud deployment (what’s already done)
### Backend: Motia on Google Cloud Run
Built a Docker image for the Motia project using `npx motia docker setup` setup as per Motia’s self‑hosted guide.​

Pushed the image to Google Artifact Registry.

Deployed to Cloud Run with:

`Port: 3000`

`Min instances: 1 (stay warm).`

`Appropriate memory/CPU.`

This results in a backend URL: 

`https://wdyb-motia-327801006985.europe-west1.run.app/`

### Frontend: static site on Vercel
Hosted index.html, styles.css, app.js on Vercel as a static site.

Set in app.js:

```js
const BASE_URL = "https://wdyb-motia-327801006985.europe-west1.run.app/";
```

Now the Vercel frontend can call the Motia backend for any user.

---

## Using the APIs directly
Run a digest (curl):

```bash
curl -X POST https://wdyb-motia-327801006985.europe-west1.run.app/digest/run \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "OWNER",
    "repo": "REPO",
    "token": "GITHUB_PAT",
    "date": "2025-12-18"
  }'
```

Response includes devDigests grouped per author, with PRs, commits, TODOs, and failures.

Track an error for a commit

```bash
curl -X POST https://wdyb-motia-327801006985.europe-west1.run.app/track-error \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "OWNER",
    "repo": "REPO",
    "commitSha": "FULL_COMMIT_SHA",
    "message": "Demo error in /api/foo",
    "endpoint": "/api/foo",
    "service": "demo",
    "date": "2025-12-18"
  }'
```
On the next /digest/run for that repo/date, the dev who authored that commit sees this error in their failures[].

---

## Design decisions: localStorage vs Motia state
Why secrets are in localStorage, 
    
  >GitHub PATs are sensitive.


- To safely support multiple users on one hosted backend:

        Tokens are stored only in localStorage and sent per request from the browser.

        They are not stored in Motia state on the server.

        This keeps the shared Cloud Run backend stateless with respect to user secrets and avoids multi‑tenant secret leakage risks.

- Where Motia state shines

        Errors: Motia state is the “error inbox”, keyed by repo/date/commitSha (errors group).​

        Digests: Motia state stores latest devDigests snapshots (digest group) for potential replay or preview.

        (In local/dev) Workspace config may also live in a workspaces group, demonstrating how config and credentials could be managed in a more controlled, team‑internal environment.

##### This split shows a careful, real‑world trade‑off: 

    Motia state is used for durable operational data, while secrets remain user‑side.

---

## Learning Journey
- Iterative implementation:

    - Started from “list yesterday’s PRs”.

    - Added commits (for people who don’t always use PRs).

    - Extracted TODO/FIXME/HACK from patches.

    - Introduced /track-error and Motia state to answer “what broke yesterday?”.

Shows understanding of GitHub’s REST model (merged_at, since/until) and Motia’s state semantics.​

---

## Developer Experience
- Simple APIs with predictable shapes:

    `/digest/run` and `/track-error` accept plain JSON with clear required fields.

- Intuitive frontend:

    - Single page with form + per‑dev cards, no extra logins.

    - “Just paste your PAT, owner, repo, pick a date, and see what you broke yesterday.”

---

## AI Assistance

This project used generative AI tools for brainstorming, code review, and documentation. All architectural decisions, wiring, and debugging were verified and implemented by me.
