type DevPR = {
  number: number;
  title: string;
  mergedAt: string | null;
  htmlUrl: string;
};

type DevDigest = {
  author: string;
  prs: DevPR[];
};

type PerUserEvent = {
  date: string;
  repo: string;
  devDigests: DevDigest[];
};

export const config = {
  name: "format-dev-digests",
  type: "event",
  subscribes: ["digest.per-user"],
  flows: ['daily-digest-flow'],
  emits: ["digest.ready-to-notify"],
} as const;

export const handler = async (
  input: PerUserEvent,
  { logger, emit }: any
) => {
  const { date, repo, devDigests } = input;
  logger.info("format-dev-digests received", {
    date,
    repo,
    devCount: devDigests.length,
  });

  const messages = devDigests.map((dev) => {
    const header = `Digest for @${dev.author} on ${date} (${repo})`;
    const lines = dev.prs.map(
      (pr) => `• #${pr.number} - ${pr.title} (${pr.htmlUrl})`
    );
    const body =
      lines.length > 0
        ? [header, "", ...lines].join("\n")
        : `${header}\n\nNo merged PRs.`;

    return {
      author: dev.author,
      text: body,
    };
  });

  await emit({
    topic: "digest.ready-to-notify",
    data: {
      date,
      repo,
      messages,
    },
  });

  return {
    ok: true,
    date,
    repo,
    messageCount: messages.length,
  };
};
