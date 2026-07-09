import { Logger } from "@nestjs/common";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const logger = new Logger("GoogleCredentials");

export function configureGoogleApplicationCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;

  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credentialsJson) return;

  try {
    JSON.parse(credentialsJson);
    const credentialsPath = path.join(os.tmpdir(), "google-credentials.json");
    fs.writeFileSync(credentialsPath, credentialsJson, { mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
    logger.log("GOOGLE_APPLICATION_CREDENTIALS configured from JSON env");
  } catch (error) {
    logger.warn(
      `Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON: ${(error as Error).message}`,
    );
  }
}
