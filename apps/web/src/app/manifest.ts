import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ONYX — Assistance routière',
    short_name: 'ONYX',
    description: 'Trouvez des mécaniciens de confiance. Continuez votre route.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#000000',
    theme_color: '#000000',
    lang: 'fr',
    categories: ['travel', 'utilities', 'navigation'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Trouver un mécanicien', short_name: 'Trouver', url: '/technicians' },
      { name: 'Assistant', short_name: 'Assistant', url: '/assistant' },
      { name: 'Hors ligne', short_name: 'Hors ligne', url: '/offline' },
    ],
  };
}
