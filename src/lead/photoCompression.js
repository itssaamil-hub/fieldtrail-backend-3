// Compress in the browser before including a photo in the existing Add Lead API.
export const MAX_LEAD_PHOTO_BYTES = 150 * 1024;
export async function compressLeadPhoto(file) {
  if (!file || !String(file.type || '').startsWith('image/')) throw new Error('Choose a photo from Camera or Gallery.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Choose a photo smaller than 15 MB.');
  if (typeof createImageBitmap !== 'function') throw new Error('Image compression is unavailable on this device.');
  const image = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 1024 / image.width, 768 / image.height);
    let fallback = null;
    outer: for (let level = 0; level < 6; level++) {
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Photo compression is unavailable.');
      ctx.drawImage(image, 0, 0, width, height);
      for (const quality of [0.75, 0.68, 0.60, 0.52, 0.44]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
        if (blob && blob.type === 'image/webp' && blob.size <= MAX_LEAD_PHOTO_BYTES) {
          fallback = {blob, width, height};
          // Aim for around 80-100 KB. Never exceed the 150 KB cap.
          if (blob.size <= 100 * 1024) break outer;
        }
      }
      scale *= 0.8;
    }
    if (!fallback) throw new Error('This photo cannot be reduced below 150 KB. Please select another photo.');
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = () => reject(new Error('Could not read compressed photo.'));
      reader.readAsDataURL(fallback.blob);
    });
    return {base64, bytes:fallback.blob.size, width:fallback.width, height:fallback.height};
  } finally {
    image.close?.();
  }
}
