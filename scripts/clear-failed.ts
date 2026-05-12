import "dotenv/config";
import { adminDb } from "@/lib/firebase/admin";

async function main() {
  const snap = await adminDb.collection("jobs").get();
  console.log(`Total jobs: ${snap.size}`);
  const batch = adminDb.batch();
  let removed = 0;
  snap.docs.forEach((d) => {
    const data = d.data();
    console.log(`  ${d.id}  status=${data.status}  progress=${data.progress}`);
    if (data.status === "failed" || data.status === "queued") {
      batch.delete(d.ref);
      removed++;
    }
  });
  if (removed > 0) {
    await batch.commit();
    console.log(`\n→ removidos ${removed} jobs (queued/failed)`);
  }
  process.exit(0);
}

main();
