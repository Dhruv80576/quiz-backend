const Minio = require('minio');

const minioClient = new Minio.Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin'
});

const BUCKET_NAME = 'quiz-app';

async function initMinio() {
  try {
    // Check if bucket exists
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    
    if (!exists) {
      // Create bucket
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log('Bucket created successfully');
    } else {
      console.log('Bucket already exists');
    }

    // Set bucket policy to public
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`]
        }
      ]
    };

    await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
    console.log('Bucket policy set successfully');

    console.log('MinIO bucket initialized successfully!');
  } catch (error) {
    console.error('Error initializing MinIO:', error);
    process.exit(1);
  }
}

// Wait for MinIO to be ready
setTimeout(() => {
  initMinio();
}, 5000); 