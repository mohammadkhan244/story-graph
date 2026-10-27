import './globals.css';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://story-graph-three.vercel.app'),
  title: 'Story Map',
  description: 'Find out what story is controlling your decisions. Write for ten minutes, see where your story lands.',
  openGraph: {
    title: 'Story Map · Find the story running your decisions',
    description: 'Pick a decision you’re facing. Write for ten minutes. See where your story lands among everyone else’s.',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gilda+Display&family=Josefin+Sans:wght@600&family=Lato:ital,wght@0,400;0,700;1,400&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
