process.loadEnvFile(".env.local");
import { runAgent } from "../src/lib/slack-agent";

const q = process.argv[2] ?? "今後の予約を一覧で教えて";
runAgent(q)
  .then((r) => {
    console.log("Q:", q);
    console.log("A:", r);
    process.exit(0);
  })
  .catch((e) => {
    console.error("ERR:", e);
    process.exit(1);
  });
