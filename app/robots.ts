import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/checkout/', '/account/'],
    },
    sitemap: 'https://huayu-ebon.vercel.app/sitemap.xml',
  }
}
