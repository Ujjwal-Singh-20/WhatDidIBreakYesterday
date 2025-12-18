export const config = {
  name: "digest-preview-api",
  type: "api",
  path: "/digest/preview",
  emits: [],
  flows: ['daily-digest-flow'],
  method: "POST", // changed to POST
} as const;

type DigestPreviewBody = {
  owner: string;
  repo: string;
  date: string;
};

export const handler = async (
  req: { body: DigestPreviewBody },
  { state }: any
) => {
  const { owner, repo, date } = req.body || {};

  if (!owner || !repo || !date) {
    return {
      status: 400,
      body: { ok: false, error: "owner, repo, date required" },
    };
  }

  const key = `digest:${owner}/${repo}:${date}`;

  const devDigests = (await state.get(key)) || null;

  return {
    status: 200,
    body: {
      ok: true,
      date,
      repo: `${owner}/${repo}`,
      devDigests,
    },
  };
};
