import { eq } from "drizzle-orm";
import { aiVideoJobs, type InsertAiVideoJob } from "../../drizzle/schema";
import { getDb } from "../db";

export async function createVideoJob(
  data: Omit<InsertAiVideoJob, "id" | "createdAt" | "updatedAt">,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(aiVideoJobs).values(data);
  return (result[0] as { insertId: number }).insertId;
}

export async function getVideoJob(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(aiVideoJobs)
    .where(eq(aiVideoJobs.id, id))
    .limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

export async function updateVideoJob(
  id: number,
  fields: Partial<Pick<InsertAiVideoJob, "status" | "resultUrl" | "errorMessage" | "providerJobId">>,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(aiVideoJobs).set(fields).where(eq(aiVideoJobs.id, id));
}
