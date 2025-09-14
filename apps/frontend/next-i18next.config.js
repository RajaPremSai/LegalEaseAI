module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar'],
    localePath: './public/locales',
    localeDetection: true,
  },
  reloadOnPrerender: process.env.NODE_ENV === 'development',
};