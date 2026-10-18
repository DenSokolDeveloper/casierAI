import sharp from 'sharp';

const MAX_DIMENSION = 480;
const JPEG_QUALITY = 80;

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
export const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function resizeToJpegDataUri(buffer: Buffer): Promise<string> {
  const resized = await sharp(buffer)
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  return `data:image/jpeg;base64,${resized.toString('base64')}`;
}
