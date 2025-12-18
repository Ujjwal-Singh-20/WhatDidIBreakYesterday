import { Octokit } from "octokit";

type ManualDigestBody = {
  date?: string; // defaults to yesterday
  owner: string;
  repo: string;
  token: string;
};

export const config = {
  name: "manual-digest-api",
  type: "api",
  path: "/digest/run",
  flows: ['daily-digest-flow'],
  emits: [],
  method: "POST",
} as const; // emits removed since we do everything here

function extractTodosFromPatch(
  patch: string | null | undefined,
  filename: string
) {
  if (!patch) return [];
  const lines = patch.split("\n");
  const todos: { filename: string; line: string; text: string }[] = [];

  for (const line of lines) {
    if (!line.startsWith("+")) continue; // only added lines
    const raw = line.slice(1);
    if (/TODO|FIXME|HACK/i.test(raw)) {
      todos.push({
        filename,
        line: raw,
        text: raw.trim(),
      });
    }
  }
  return todos;
}

export const handler = async (
  req: { body: ManualDigestBody },
  { logger, state }: any
) => {
  const { owner, repo, token } = req.body || {};

  if (!owner || !repo || !token) {
    return {
      status: 400,
      body: { ok: false, error: "owner, repo, token are required" },
    };
  }

  const date =
    req.body.date ??
    new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

  logger.info("manual-digest-api called", { owner, repo, date });

  const octokit = new Octokit({ auth: token });

  const from = `${date}T00:00:00Z`;
  const to = `${date}T23:59:59Z`;

  // fetch closed PRs and filter by merged_at
  const prsResp = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "closed",
    per_page: 100,
  }); // GitHub PR REST API.[web:89][web:90]

  const mergedYesterday = prsResp.data.filter((pr) => {
    if (!pr.merged_at) return false;
    const mergedAt = new Date(pr.merged_at).toISOString();
    return mergedAt >= from && mergedAt <= to;
  });

  //Fetch files for each PR and extract TODOs
  const prFilesByNumber = new Map<
    number,
    { filename: string; patch?: string | null }[]
  >();

  for (const pr of mergedYesterday) {
    const filesResp = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
      per_page: 100,
    }); // PR files API.[web:89]

    prFilesByNumber.set(
      pr.number,
      filesResp.data.map((f) => ({
        filename: f.filename,
        patch: f.patch,
      }))
    );
  }

  // fetch commits for the window
  const commitsResp = await octokit.rest.repos.listCommits({
    owner,
    repo,
    per_page: 100,
    since: from,
    until: to,
  }); // Commit listing API with since/until.[web:93]

  const commits = commitsResp.data.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    author: c.author?.login ?? c.commit.author?.name ?? "unknown",
    htmlUrl: c.html_url,
  }));

  // Build error map using same groupId/key as /track-error
  const errorMap = new Map<
    string,
    {
      message: string;
      endpoint?: string | null;
      service?: string | null;
      at: string;
    }[]
  >();

  const errorGroupId = "errors";

  for (const c of commits) {
    const key = `${owner}/${repo}:${date}:${c.sha}`;
    const entries =
      ((await state.get(errorGroupId, key)) as {
        message: string;
        endpoint?: string | null;
        service?: string | null;
        at: string;
      }[]) || [];
    // const entries =
    //   (await state.get(errorGroupId, key))|| [];

    if (Array.isArray(entries) && entries.length > 0) {
      logger.info("Loaded errors for commit", {
        sha: c.sha,
        count: entries.length,
      });
      errorMap.set(c.sha, entries);
    }
  }

  // Group PRs + commits + failures by author
  const prsByAuthor = new Map<
    string,
    {
      author: string;
      prs: {
        number: number;
        title: string;
        mergedAt: string | null;
        htmlUrl: string;
        todos: { filename: string; line: string; text: string }[];
      }[];
      commits: {
        sha: string;
        message: string;
        htmlUrl: string;
      }[];
      failures: {
        commitSha: string;
        message: string;
        endpoint?: string | null;
        service?: string | null;
        at: string;
      }[];
    }
  >();

  // Seed PRs
  for (const pr of mergedYesterday) {
    const authorLogin = pr.user?.login ?? "unknown";
    const author = authorLogin.endsWith("[bot]")
      ? "bot:" + authorLogin
      : authorLogin;

    if (!prsByAuthor.has(author)) {
      prsByAuthor.set(author, { author, prs: [], commits: [], failures: [] });
    }

    const files = prFilesByNumber.get(pr.number) ?? [];
    let todos: { filename: string; line: string; text: string }[] = [];
    for (const f of files) {
      todos = todos.concat(extractTodosFromPatch(f.patch, f.filename));
    }

    prsByAuthor.get(author)!.prs.push({
      number: pr.number,
      title: pr.title,
      mergedAt: pr.merged_at,
      htmlUrl: pr.html_url,
      todos,
    });
  }

  // Add commits and failures
  for (const c of commits) {
    const author = c.author ?? "unknown";
    if (!prsByAuthor.has(author)) {
      prsByAuthor.set(author, { author, prs: [], commits: [], failures: [] });
    }
    const authorEntry = prsByAuthor.get(author)!;

    authorEntry.commits.push({
      sha: c.sha,
      message: c.message,
      htmlUrl: c.htmlUrl,
    });

    const errs = errorMap.get(c.sha) ?? [];
    for (const e of errs) {
      authorEntry.failures.push({
        commitSha: c.sha,
        message: e.message ?? "unknown error",
        endpoint: e.endpoint ?? null,
        service: e.service ?? null,
        at: e.at ?? new Date().toISOString(),
      });
    }
  }

  const devDigests = Array.from(prsByAuthor.values());

  // store digest snapshot in state (optional but good for preview)
  const digestGroupId = "digest";
  const digestKey = `${owner}/${repo}:${date}`;
  await state.set(digestGroupId, digestKey, devDigests); // groupId,key,value per Motia docs.[web:59][web:110]

  return {
    status: 200,
    body: {
      ok: true,
      date,
      repo: `${owner}/${repo}`,
      totalMerged: mergedYesterday.length,
      totalCommits: commits.length,
      devCount: devDigests.length,
      devDigests,
    },
  };
};
