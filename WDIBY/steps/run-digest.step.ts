import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the parent parent parent folder
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { Octokit } from "octokit";

type DigestRunPayload = {
  date: string; // YYYY-MM-DD
};

type DevDigest = {
  author: string;
  prs: {
    number: number;
    title: string;
    mergedAt: string | null;
    htmlUrl: string;
  }[];
};

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const owner = process.env.GITHUB_OWNER!;
const repo = process.env.GITHUB_REPO!;

export const config = {
  name: "run-digest",
  type: "event",
  subscribes: ["digest.run"],
  flows: ['daily-digest-flow'],
  emits: ["digest.per-user"],          // new topic
} as const;

export const handler = async (
  input: DigestRunPayload,
  { logger, emit }: any
) => {
  const { date } = input;
  logger.info("run-digest started", { date, owner, repo });

  if (!process.env.GITHUB_TOKEN || !owner || !repo) {
    logger.error("Missing GitHub env vars");
    return { ok: false, error: "Missing GitHub env vars" };
  }

  const from = `${date}T00:00:00Z`;
  const to = `${date}T23:59:59Z`;

  const prsResp = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "closed",
    per_page: 100,
  }); // list/filters per GitHub REST docs.[web:89]

  const mergedYesterday = prsResp.data.filter((pr) => {
    if (!pr.merged_at) return false;
    const mergedAt = new Date(pr.merged_at).toISOString();
    return mergedAt >= from && mergedAt <= to;
  });

  logger.info("Found merged PRs", {
    count: mergedYesterday.length,
  });

  // Group by author
  const byAuthor = new Map<string, DevDigest>();

  for (const pr of mergedYesterday) {
    const author = pr.user?.login ?? "unknown";
    if (!byAuthor.has(author)) {
      byAuthor.set(author, { author, prs: [] });
    }
    byAuthor.get(author)!.prs.push({
      number: pr.number,
      title: pr.title,
      mergedAt: pr.merged_at,
      htmlUrl: pr.html_url,
    });
  }

  const devDigests = Array.from(byAuthor.values());

  // Emit one event with all digests (simpler for now)
  await emit({
    topic: "digest.per-user",
    data: {
      date,
      repo: `${owner}/${repo}`,
      devDigests,
    },
  });

  return {
    ok: true,
    date,
    repo: `${owner}/${repo}`,
    totalMerged: mergedYesterday.length,
    devCount: devDigests.length,
  };
};