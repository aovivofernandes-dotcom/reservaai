import app from "./app";
import { logger } from "./lib/logger";
import {
  db,
  whatsappSessionsTable,
  onboardingSubmissionsTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import { startReminderJob } from "./lib/whatsapp-reminder";
import { startSurveyJob } from "./lib/whatsapp-survey";

/**
 * One-time idempotent cleanup: removes seeded demo/test data that was
 * accidentally inserted into production. Safe to run on every startup —
 * once the rows are gone subsequent runs delete 0 rows and do nothing.
 */
async function cleanupDemoData(): Promise<void> {
  const FAKE_PHONES = [
    "5511990010001",
    "5521980010002",
    "5511970010003",
  ];
  const FAKE_SUBMISSION_IDS = [
    "4ffab85a-e8d5-4f3d-9732-03c2ce095a58",
    "51fd49c2-f79a-4bcf-9684-0643d6b680b2",
    "5aaec1d2-6ae0-4397-968d-22bccb1a626f",
    "037a361c-5958-426c-aa09-7cf25a47bfd7",
    "bfcafb6c-31ca-43ae-a376-fdef7f4aa00b",
    "69cd31d1-88a0-4aa5-9fad-4fcb823721a7",
  ];

  try {
    // Messages are cascade-deleted when their session is deleted
    await db
      .delete(whatsappSessionsTable)
      .where(inArray(whatsappSessionsTable.phone, FAKE_PHONES));

    await db
      .delete(onboardingSubmissionsTable)
      .where(inArray(onboardingSubmissionsTable.id, FAKE_SUBMISSION_IDS));

    logger.info("cleanupDemoData: seeded test data removed (or already clean)");
  } catch (err) {
    logger.warn({ err }, "cleanupDemoData: non-critical error, skipping");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Fire-and-forget: clean up any seeded demo data on every startup
  void cleanupDemoData();

  // Start the 24h appointment reminder background job
  startReminderJob();

  // Start the satisfaction survey background job (sends survey 1h after appointment)
  startSurveyJob();
});
