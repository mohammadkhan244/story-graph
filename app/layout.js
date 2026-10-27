import './globals.css';

export const metadata = {
  title: 'Story Map',
  description: 'Find out what story is controlling your decisions. Write for ten minutes, see where your story lands.',
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
