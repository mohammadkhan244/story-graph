export default function manifest() {
  return {
    name: 'Story Map',
    short_name: 'Story Map',
    description: "Write a short story about the future and see where it lands among everyone else's.",
    start_url: '/',
    display: 'standalone',
    background_color: '#0d4a6a',
    theme_color: '#0d4a6a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
