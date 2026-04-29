import { Router } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { firebaseAuth, AuthRequest } from '../middleware/firebaseAuth';

const router = Router();

const REGION = process.env.AWS_REGION ?? process.env.AWS_REGION_NAME ?? 'us-east-1';
const s3 = new S3Client({ region: REGION });
const BUCKET = process.env.S3_BUCKET ?? 'epigenesis-profile-photos';

// Returns a pre-signed PUT URL the client uses to upload directly to S3.
// After uploading, the client saves the resulting public URL to the profile.
router.post('/profile-photo', firebaseAuth, async (req, res) => {
  const uid = (req as AuthRequest).uid;
  const { contentType = 'image/jpeg' } = req.body as { contentType?: string };

  const key = `profile-photos/${uid}.jpg`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  try {
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const publicUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
    res.json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error('Failed to generate pre-signed URL:', err);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

export default router;
