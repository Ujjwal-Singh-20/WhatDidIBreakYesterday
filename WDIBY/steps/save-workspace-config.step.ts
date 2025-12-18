type SaveConfigBody = {
  owner: string;
  repo: string;
  token: string;
};

export const config = {
  name: "save-workspace-config",
  type: "api",
  path: "/workspace/config",
  method: "POST",
  flows: ['daily-digest-flow'],
  emits: ["workspace.config.save"],
} as const;

export const handler = async (
  req: { body: SaveConfigBody },
  { logger, state }: any
) => {
  const { owner, repo, token } = req.body || {};
  if (!owner || !repo || !token) {
    return { status: 400, body: { ok: false, required: "owner, repo, token" } };
  }

  const workspaceId = `${owner}-${repo}`; 

  await state.set("workspaces", workspaceId, {
  owner,
  repo,
  token,
  });


  logger.info("Saved workspace config", { workspaceId });

  return {
    status: 200,
    body: { ok: true, workspaceId },
  };
};


// // steps/typescript/save-workspace-config.step.ts
// // steps/typescript/save-workspace-config.step.ts
// // steps/typescript/save-workspace-config.step.ts
// type SaveConfigBody = {
//   owner: string;
//   repo: string;
//   token: string;
// };

// export const config = {
//   name: "save-workspace-config",
//   type: "api",
//   path: "/workspace/config",
//   method: "POST",
//   emits: ["workspace.config.save"],
// } as const;

// export const handler = async (
//   req: { body: SaveConfigBody },
//   { logger, emit }: any
// ) => {
//   const { owner, repo, token } = req.body || {};

//   if (!owner || !repo || !token) {
//     return {
//       status: 400,
//       body: { ok: false, error: "owner, repo, token required" },
//     };
//   }

//   const workspaceId = `${owner}-${repo}`;

//   await emit({
//     topic: "workspace.config.save",
//     data: {
//       workspaceId,
//       owner,
//       repo,
//       token,
//     },
//   });

//   logger.info("Emitted workspace.config.save", { workspaceId });

//   return {
//     status: 200,
//     body: { ok: true, workspaceId },
//   };
// };
