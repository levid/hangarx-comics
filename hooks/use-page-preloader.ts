'use client'

import { useEffect, useRef } from 'react'
import type { ComicPage } from '@/lib/comic-data'

const PRELOAD_COUNT = 3

export function usePagePreloader(pages: ComicPage[], currentPage: number) {
    const preloadedRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        // Preload the next N page images
        for (let i = 1; i <= PRELOAD_COUNT; i++) {
            const targetIndex = currentPage + i
            if (targetIndex >= pages.length) break

            const page = pages[targetIndex]
            if (!page?.image) continue

            const src = page.image
            if (preloadedRef.current.has(src)) continue

            const img = new window.Image()
            img.src = src
            preloadedRef.current.add(src)
        }

        // Also preload 1 page behind (for back-navigation)
        if (currentPage > 0) {
            const prevPage = pages[currentPage - 1]
            if (prevPage?.image && !preloadedRef.current.has(prevPage.image)) {
                const img = new window.Image()
                img.src = prevPage.image
                preloadedRef.current.add(prevPage.image)
            }
        }
    }, [currentPage, pages])
}
