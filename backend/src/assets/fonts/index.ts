import { Inter, JetBrains_Mono, Sora } from 'next/font/google';

/**
 * 1. Fonts Documentation
 * https://mksaas.com/docs/fonts
 *
 * 2. This file shows how to customize the font by using local font or google font
 *
 * [1] use local font
 *
 * - Get font file from https://gwfh.mranftl.com/fonts
 * - Add font file to the assets/fonts folder
 * - Add font variable to the font object
 */

/**
 * [2] use google font
 *
 * - You can browser fonts at Google Fonts
 * https://fonts.google.com
 *
 * - CSS and font files are downloaded at build time and self-hosted with the rest of your static assets.
 * https://nextjs.org/docs/app/building-your-application/optimizing/fonts#google-fonts
 */

// https://fonts.google.com/specimen/Inter
// Inter Variable Font for body text - professional and highly readable
export const fontInter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
});

// https://fonts.google.com/specimen/Sora
// Sora for headings - modern, geometric, professional
export const fontSora = Sora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sora',
  weight: ['400', '500', '600', '700'],
});

// https://fonts.google.com/specimen/JetBrains+Mono
// JetBrains Mono for code and auxiliary text
export const fontJetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
  weight: ['400', '500'],
});
