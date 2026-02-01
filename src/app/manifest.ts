import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'TEASY CRM',
        short_name: 'TEASY',
        description: 'Educational Technology CRM',
        start_url: '/',
        display: 'standalone', // PWA Standalone Mode (v122.0)
        background_color: '#ffffff',
        theme_color: '#805AD5',
        icons: [
            {
                src: '/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
            },
        ],
    }
}
