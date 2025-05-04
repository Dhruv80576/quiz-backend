import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';

const isDevelopment = process.env.NODE_ENV === 'development';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
  },
  ...(isDevelopment && {
    endpoint: 'http://localhost:9000',
    forcePathStyle: true, // needed for MinIO
  }),
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'quiz-app';

export const uploadToS3 = async (
  file: Express.Multer.File,
  folder: string
): Promise<{ url: string; key: string }> => {
  try {
    const fileExtension = file.originalname.split('.').pop();
    const key = `${folder}/${uuidv4()}.${fileExtension}`;

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      },
      queueSize: 4, // Number of concurrent uploads
      partSize: 1024 * 1024 * 5, // 5MB part size
      leavePartsOnError: false, // Clean up failed uploads
    });

    // Add progress tracking
    upload.on('httpUploadProgress', (progress) => {
      console.log(`Upload progress: ${progress.loaded}/${progress.total}`);
    });

    await upload.done();
    
    // Construct URL based on environment
    const url = isDevelopment
      ? `http://localhost:9000/${BUCKET_NAME}/${key}`
      : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return { url, key };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload file to S3');
  }
};

export const deleteFromS3 = async (key: string): Promise<void> => {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error('Failed to delete file from S3');
  }
};

export default s3Client; 