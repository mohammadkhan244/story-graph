import './globals.css';

export const metadata = {
  title: 'Story Map',
  description: 'Write a short story about the future and see where it lands among everyone else\'s.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Newsreader:ital,wght@0,400;0,500;1,500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
