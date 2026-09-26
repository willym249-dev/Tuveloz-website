type BackupTriggerEnv = {
  BACKUP_WORKFLOW: { create(options: { id: string }): Promise<unknown> };
};

// Standard Worker Cron Triggers are available on Workers Free. Native
// Workflow schedules require Workers Paid, so only launch the durable job here.
const privateBackupWorker = {
  fetch() {
    return new Response("Not found", { status: 404 });
  },
  async scheduled(event: { scheduledTime: number }, env: BackupTriggerEnv) {
    // A retried delivery must not create a second export for the same firing.
    await env.BACKUP_WORKFLOW.create({ id: `scheduled-backup-${event.scheduledTime}` });
  },
};

export default privateBackupWorker;
