// Helper to parse images from JSON string or array format
export function parseProductImages(images: string | string[] | null | undefined): string[] {
  if (!images) return []
  if (Array.isArray(images)) return images
  try { return JSON.parse(images) } catch { return [images] }
}

// Helper to parse single image URL (for modelImage, featuredImage, etc.)
export function parseImageUrl(image: string | null | undefined): string | null {
  if (!image) return null
  if (typeof image === 'string') {
    try { return JSON.parse(image) } catch { return image }
  }
  return image
}
