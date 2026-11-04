import { SELFIE_JPEG_QUALITY, selfieTargetSize } from './staffClockUtils'

export async function compressSelfie(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const { width, height } = selfieTargetSize(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not compress selfie.')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const jpeg = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('JPEG encode failed.'))),
      'image/jpeg',
      SELFIE_JPEG_QUALITY
    )
  })
  return jpeg
}

export async function captureVideoFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 720
  canvas.height = video.videoHeight || 720
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not capture selfie.')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Could not capture selfie.'))),
      'image/jpeg',
      0.92
    )
  })
  return blob
}
