export const MAX_PRODUCT_IMAGE_DIMENSION = 1200
export const PRODUCT_IMAGE_WEBP_QUALITY = 0.82

export function fitProductImageDimensions(width, height, maxDimension = MAX_PRODUCT_IMAGE_DIMENSION) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Dimensi gambar tidak valid.')
  }

  const scale = Math.min(1, maxDimension / width, maxDimension / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Gambar tidak dapat dibuka untuk dikompres.'))
    }
    image.src = url
  })
}

function canvasToWebp(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Browser gagal mengompres gambar produk.'))
          return
        }
        if (blob.type !== 'image/webp') {
          reject(new Error('Browser ini belum mendukung kompresi WebP. Coba gunakan browser yang lebih baru.'))
          return
        }
        resolve(blob)
      }, 'image/webp', PRODUCT_IMAGE_WEBP_QUALITY)
    } catch (error) {
      reject(new Error('Browser gagal mengompres gambar produk: ' + error.message))
    }
  })
}

export async function compressProductImage(file) {
  let source
  let closeSource = false

  if (typeof createImageBitmap === 'function') {
    try {
      source = await createImageBitmap(file)
      closeSource = true
    } catch {
      source = await loadImage(file)
    }
  } else {
    source = await loadImage(file)
  }

  try {
    const dimensions = fitProductImageDimensions(source.width || source.naturalWidth, source.height || source.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = dimensions.width
    canvas.height = dimensions.height

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Browser gagal menyiapkan kanvas untuk gambar.')
    context.drawImage(source, 0, 0, dimensions.width, dimensions.height)

    const blob = await canvasToWebp(canvas)
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'gambar-produk'
    return new File([blob], baseName + '.webp', {
      type: 'image/webp',
      lastModified: file.lastModified
    })
  } finally {
    if (closeSource) source.close()
  }
}
