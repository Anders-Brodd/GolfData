import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const b2 = new S3Client({
  endpoint: process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com',
  region: 'us-east-005',
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || '',
    secretAccessKey: process.env.B2_APPLICATION_KEY || ''
  }
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME || 'JessesGolfData';

export const uploadData = async (filename: string, data: any) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: filename,
    Body: JSON.stringify(data),
    ContentType: 'application/json'
  });
  
  try {
    const response = await b2.send(command);
    console.log(`Successfully uploaded ${filename} to B2.`);
    return response;
  } catch (err) {
    console.error(`Failed to upload ${filename}:`, err);
    throw err;
  }
};

export const getData = async (filename: string) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: filename,
  });

  try {
    const response = await b2.send(command);
    
    // Convert stream to string
    const streamToString = (stream: Readable) =>
      new Promise<string>((resolve, reject) => {
        const chunks: any[] = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      });

    const bodyContents = await streamToString(response.Body as Readable);
    return JSON.parse(bodyContents);
  } catch (err) {
    console.error(`Failed to download ${filename}:`, err);
    throw err;
  }
};
