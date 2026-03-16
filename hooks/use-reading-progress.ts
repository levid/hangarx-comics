'use client'

import { useCallback, useRef } from 'react'

const STORAGE_KEY = 'hangarx-reading-progress'

interface ReadingProgress {
    [key: string]: {
        page: number
        timestamp: number
    }
}

function getKey(vol: string, ep: string): string {
    return `${vol}:${ep}`
}

function loadAll(): ReadingProgress {
    if (typeof window === 'undefined') return {}
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : {}
    } catch {
        return {}
    }
}

function saveAll(data: ReadingProgress) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
        // quota exceeded — silently fail
    }
}

export function useReadingProgress() {
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    const saveProgress = useCallback((vol: string, ep: string, page: number) => {
        // Debounce writes to avoid thrashing localStorage on rapid page turns
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            const all = loadAll()
            all[getKey(vol, ep)] = { page, timestamp: Date.now() }
            saveAll(all)
        }, 300)
    }, [])

    const getProgress = useCallback((vol: string, ep: string): number | null => {
        const all = loadAll()
        const entry = all[getKey(vol, ep)]
        return entry ? entry.page : null
    }, [])

    const clearProgress = useCallback((vol: string, ep: string) => {
        const all = loadAll()
        delete all[getKey(vol, ep)]
        saveAll(all)
    }, [])

    return { saveProgress, getProgress, clearProgress }
}
