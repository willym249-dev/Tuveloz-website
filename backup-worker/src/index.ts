import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
  type WorkflowStepConfig,
} from "cloudflare:workers";
import {
  beginD1Export,
  copySourceObject,
  enforceBackupRetention,
  finishD1Export,
  listSourceObjects,
  validateBackupSettings,
  writeBackupManifest,
  type BackupBucket,
  type CopiedObject,
} from "../../lib/production-backup";

type BackupEnv = {
  BACKUP_ACCOUNT_ID: string;
  BACKUP_DATABASE_ID: string;
  BACKUP_RETENTION_DAYS: string;
  D1_BACKUP_API_TOKEN: string;
  SOURCE_BUCKET: BackupBucket;
  BACKUP_BUCKET: BackupBucket;
};

const RETRY = {
  retries: { limit: 20, delay: "10 seconds", backoff: "exponential" },
  timeout: "10 minutes",
} satisfies WorkflowStepConfig;

export class TuvelozBackupWorkflow extends WorkflowEntrypoint<BackupEnv> {
  async run(event: Readonly<WorkflowEvent<unknown>>, step: WorkflowStep) {
    const createdAt = event.timestamp;
    const settings = validateBackupSettings({
      accountId: this.env.BACKUP_ACCOUNT_ID,
      databaseId: this.env.BACKUP_DATABASE_ID,
      apiToken: this.env.D1_BACKUP_API_TOKEN,
      retentionDays: this.env.BACKUP_RETENTION_DAYS,
    });

    const bookmark = await step.do(
      "Start the D1 export",
      RETRY,
      () => beginD1Export(fetch, settings),
    );
    const database = await step.do(
      "Store the D1 export in the private backup bucket",
      RETRY,
      () => finishD1Export(fetch, settings, bookmark, this.env.BACKUP_BUCKET, createdAt),
    );
    const sourceObjects = await step.do(
      "Inventory the private upload bucket",
      RETRY,
      () => listSourceObjects(this.env.SOURCE_BUCKET),
    );
    const copiedObjects: CopiedObject[] = [];
    for (let index = 0; index < sourceObjects.length; index += 1) {
      const descriptor = sourceObjects[index];
      const copied = await step.do(
        `Copy private object ${index + 1} of ${sourceObjects.length}`,
        RETRY,
        () => copySourceObject(this.env.SOURCE_BUCKET, this.env.BACKUP_BUCKET, descriptor),
      );
      copiedObjects.push(copied);
    }
    const record = await step.do(
      "Write the backup manifest",
      RETRY,
      () => writeBackupManifest(
        this.env.BACKUP_BUCKET,
        event.instanceId,
        createdAt,
        settings.retentionDays,
        database,
        copiedObjects,
      ),
    );
    const retention = await step.do(
      "Remove backup versions outside the approved recovery window",
      RETRY,
      () => enforceBackupRetention(this.env.BACKUP_BUCKET, createdAt, settings.retentionDays),
    );
    return {
      manifestKey: record.key,
      databaseKey: database.backupKey,
      copiedObjects: copiedObjects.length,
      retention,
    };
  }
}

export { default } from "./trigger";
