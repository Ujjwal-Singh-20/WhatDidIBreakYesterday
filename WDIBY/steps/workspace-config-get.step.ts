type GetConfigBody = {
    workspaceId: string;
}

export const config = {
  name: "get-workspace-config",
  type: "api",
  path: "/workspace/config/get",
  flows: ['daily-digest-flow'],
  emits: [],
  method: "POST",
} as const;

export const handler = async (
  req: { body: GetConfigBody },
  { logger, state }: any
) => {
  const { workspaceId } = req.body || {};

  if (!workspaceId) {
    return {
      status: 400,
      body: { ok: false, error: "workspaceId is required" },
    };
  }

  const workspaceConfig = await state.get("workspaces", workspaceId);

  if (!workspaceConfig) {
    return {
      status: 404,
      body: { ok: false, error: "Workspace config not found" },
    };
  }

  logger.info("Retrieved workspace config", { workspaceId });

  return {
    status: 200,
    body: { ok: true, workspaceConfig },
  };
};