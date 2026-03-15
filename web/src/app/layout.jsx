import './globals.css';
import '../styles/tokens.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export const metadata = {
  title: {
    default: 'theory.golf',
    template: '%s — theory.golf',
  },
  description: 'The intelligence layer for collegiate golf.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/*
          Flash-prevention: runs synchronously before first paint.
          If user has saved a light preference, applies it instantly
          so there's no dark→light flicker on page load.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('tg-theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
