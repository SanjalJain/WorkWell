import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { env } from "./env";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageService {
  getSignedUploadUrl(key: string, contentType: string): Promise<string>;
  getSignedDownloadUrl(key: string): Promise<string>;
  saveBuffer(key: string, buffer: Buffer, contentType: string): Promise<string>;
}

class LocalStorageService implements StorageService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR);
  }

  private generateToken(key: string, expiresAt: number): string {
    const hmac = crypto.createHmac("sha256", env.SESSION_SECRET);
    hmac.update(`${key}:${expiresAt}`);
    return hmac.digest("hex");
  }

  async getSignedUploadUrl(key: string): Promise<string> {
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins
    const token = this.generateToken(key, expiresAt);
    return `${env.APP_URL}/api/storage/upload?key=${encodeURIComponent(key)}&expires=${expiresAt}&token=${token}`;
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
    const token = this.generateToken(key, expiresAt);
    return `${env.APP_URL}/api/storage/download?key=${encodeURIComponent(key)}&expires=${expiresAt}&token=${token}`;
  }

  async saveBuffer(key: string, buffer: Buffer): Promise<string> {
    const filePath = path.resolve(this.baseDir, key);
    if (!filePath.startsWith(this.baseDir + path.sep)) {
      throw new Error("Invalid storage path key");
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return this.getSignedDownloadUrl(key);
  }
}

class S3StorageService implements StorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = env.AWS_S3_BUCKET || "workwell-storage";
    this.client = new S3Client({
      region: env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID || "test",
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY || "test",
      },
    });
  }

  async getSignedUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: 900 });
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }

  async saveBuffer(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });
    await this.client.send(command);
    return this.getSignedDownloadUrl(key);
  }
}

export const storage: StorageService =
  env.STORAGE_PROVIDER === "s3" ? new S3StorageService() : new LocalStorageService();
