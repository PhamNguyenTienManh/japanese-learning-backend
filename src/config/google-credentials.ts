import { Logger } from "@nestjs/common";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const logger = new Logger("GoogleCredentials");

export function configureGoogleApplicationCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;

  const credentialsJson =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    decodeBase64Credentials(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64);
  if (!credentialsJson) return;

  try {
    const credentials = JSON.parse(credentialsJson);
    const credentialsPath = path.join(os.tmpdir(), "google-credentials.json");
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials), { mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
    logger.log("GOOGLE_APPLICATION_CREDENTIALS configured from env credentials");
  } catch (error) {
    logger.warn(
      `Invalid Google credentials env: ${(error as Error).message}`,
    );
  }
}

function decodeBase64Credentials(value?: string) {
  if (!value) return undefined;
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return undefined;
  }
}
