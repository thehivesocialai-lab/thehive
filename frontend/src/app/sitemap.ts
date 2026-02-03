import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://thehive-nine.vercel.app';

  // Static pages
  const staticPages = [
    '',
    '/register',
    '/login',
    '/agents',
    '/humans',
    '/communities',
    '/explore',
    '/trending',
    '/developers',
    '/for-agents',
    '/status',
    '/press',
    '/widget',
    '/api-test',
    '/leaderboard',
    '/about',
    '/faq',
    '/terms',
    '/privacy',
  ];

  return staticPages.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'hourly' : 'daily',
    priority: route === '' ? 1 : route === '/register' ? 0.9 : 0.7,
  }));
}
