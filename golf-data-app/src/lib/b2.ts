import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const b2 = new S3Client({
  endpoint: process.env.B2_ENDPOINT || '',
  region: 'us-east-005',
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || '',
    secretAccessKey: process.env.B2_APPLICATION_KEY || ''
  }
});

export const uploadData = async (filename: string, data: any) => {
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME || 'JessesGolfData',
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
