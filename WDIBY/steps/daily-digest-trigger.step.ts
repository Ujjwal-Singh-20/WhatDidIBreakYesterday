import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the parent parent parent folder
dotenv.config({ path: path.resolve(__dirname, "../../.env") });



export const config = {
  name: "daily-digest-trigger",
  type: "cron",
  cron: "0 6 * * *",
  emits: [],
  flows: ['daily-digest-flow']

} as const;

export const handler = async (_input: unknown, { logger, emit }: any) => {
  const owner = process.env.DEMO_OWNER;
  const repo = process.env.DEMO_REPO;
  const token = process.env.DEMO_TOKEN;

  if (!owner || !repo || !token) {
    logger.warn("DEMO_* envs not set, skipping cron digest");
    return;
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);


  logger.info("daily-digest-trigger firing for demo workspace", {
    owner,
    repo,
    date: yesterday,
  });

  await emit({
    topic: "digest.run.demo",
    data: { owner, repo, token, date: yesterday },
  });

  return { ok: true };
};
