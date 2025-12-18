export const config = {
  name: "workspace-config-save",
  type: "event",
  subscribes: ["workspace.config.save"],
  flows: ['daily-digest-flow'],
  emits: [],//["workspace.config.run.saved"]
} as const;

type WorkspaceConfigEvent = {
  workspaceId: string;
  owner: string;
  repo: string;
  token: string;
};

export const handler = async (
  event: WorkspaceConfigEvent,
  { logger, state }: any
) => {
  // const bucket = state.bucket("workspaces");

  await state.set("workspaces", event.workspaceId, {
    owner: event.owner,
    repo: event.repo,
    token: event.token,
  });

  logger.info("Workspace config saved", {
    workspaceId: event.workspaceId,
  });

  return { ok: true };
};
