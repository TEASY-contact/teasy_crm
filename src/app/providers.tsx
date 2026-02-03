// src/app/providers.tsx
'use client'

import { useState } from 'react'
import { CacheProvider } from '@chakra-ui/next-js'
import { ChakraProvider } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { theme } from '@/theme/theme'

import { AuthProvider } from '@/context/AuthContext'

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 0, // Ensure fresh data on every request/invalidation
                gcTime: 1000 * 60 * 10, // 10 minutes (Optimization: Free memory faster)
                refetchOnWindowFocus: false,
            },
        },
    }))

    return (
        <QueryClientProvider client={queryClient}>
            <CacheProvider>
                <ChakraProvider theme={theme}>
                    <AuthProvider>
                        {children}
                    </AuthProvider>
                </ChakraProvider>
            </CacheProvider>
        </QueryClientProvider>
    )
}
