import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config.js";

function client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  });
}

export async function uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<string> {
  await client().send(
    new PutObjectCommand({
      Bucket: config.r2Bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return `${config.r2PublicUrl}/${key}`;
}
