type TrackErrorBody = {
  owner: string;
  repo: string;
  commitSha: string;
  message: string;
  date?: string;      // make optional, normalize
  endpoint?: string;
  service?: string;
};

export const config = {
  name: "track-error-api",
  type: "api",
  path: "/track-error",
  flows: ['daily-digest-flow'],
  emits: [],
  method: "POST",
} as const;

export const handler = async (
  req: { body: TrackErrorBody },
  { logger, state }: any
) => {
  try {
    const { owner, repo, commitSha, message, date, endpoint, service } =
      req.body || {};

    if (!owner || !repo || !commitSha || !message) {
      return {
        status: 400,
        body: { ok: false, error: "owner, repo, commitSha, message required" },
      };
    }

    const now = new Date();
    const dateStr =
      (date && date.slice(0, 10)) || now.toISOString().slice(0, 10); // YYYY-MM-DD

    const groupId = "errors";
    const key = `${owner}/${repo}:${dateStr}:${commitSha}`;

    logger.info("track-error-api: about to read state", { groupId, key });

    const existing =
      ((await state.get(groupId, key)) as {
        message: string;
        endpoint?: string | null;
        service?: string | null;
        at: string;
      }[]) || [];

    const entry = {
      message,
      endpoint: endpoint ?? null,
      service: service ?? null,
      at: now.toISOString(),
    };

    const updated = [...existing, entry];

    logger.info("track-error-api: about to write state", {
      groupId,
      key,
      newCount: updated.length,
    });

    await state.set(groupId, key, updated);

    logger.info("Tracked error", {
      owner,
      repo,
      commitSha,
      date: dateStr,
      count: updated.length,
    });

    return {
      status: 200,
      body: { ok: true },
    };
  } catch (err: any) {
    logger.error("track-error-api failed", {
      message: err?.message,
      stack: err?.stack,
    });
    return {
      status: 500,
      body: { ok: false, error: "internal error" },
    };
  }
};
