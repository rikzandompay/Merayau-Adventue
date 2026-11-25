import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  css: ['~/assets/css/editorial.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  app: {
    head: {
      title: 'Merayau Adventure · Perlengkapan Gunung & Open Trip Pontianak',
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
        },
      ],
      script: [
        {
          innerHTML:
            "try{var t=localStorage.getItem('merayau-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;}catch(e){}",
        },
      ],
    },
  },
  runtimeConfig: {
    authSecret: process.env.AUTH_SECRET || 'dev-merayau-secret',
    databaseUrl: process.env.DATABASE_URL || '',
    dbHost: process.env.DB_HOST || '127.0.0.1',
    dbPort: Number(process.env.DB_PORT || 3307),
    dbUser: process.env.DB_USER || 'merayau',
    dbPassword: process.env.DB_PASSWORD || '',
    dbName: process.env.DB_NAME || 'merayau_outdoor',
    dbSsl: process.env.DB_SSL || '',
    blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN || '',
  },
})
