/** Starts the inbox folder watcher when the Node server starts (not during builds). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { startInboxWatcher } = await import("./lib/import/inbox");
  await startInboxWatcher().catch((err) => console.error("[inbox] could not start:", err));
}
