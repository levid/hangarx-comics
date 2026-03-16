'use client'

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'hangarx-bookmarks'

export interface Bookmark {
    vol: string
    ep: string
    page: number
    timestamp: number
}

function loadBookmarks(): Bookmark[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function saveBookmarks(bookmarks: Bookmark[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks))
    } catch {
        // silently fail
    }
}

function bookmarkKey(vol: string, ep: string, page: number): string {
    return `${vol}:${ep}:${page}`
}

export function useBookmarks() {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([])

    // Load on mount
    useEffect(() => {
        setBookmarks(loadBookmarks())
    }, [])

    const toggleBookmark = useCallback((vol: string, ep: string, page: number) => {
        setBookmarks(prev => {
            const key = bookmarkKey(vol, ep, page)
            const exists = prev.some(b => bookmarkKey(b.vol, b.ep, b.page) === key)
            const next = exists
                ? prev.filter(b => bookmarkKey(b.vol, b.ep, b.page) !== key)
                : [...prev, { vol, ep, page, timestamp: Date.now() }]
            saveBookmarks(next)
            return next
        })
    }, [])

    const isBookmarked = useCallback((vol: string, ep: string, page: number): boolean => {
        const key = bookmarkKey(vol, ep, page)
        return bookmarks.some(b => bookmarkKey(b.vol, b.ep, b.page) === key)
    }, [bookmarks])

    const getBookmarks = useCallback((): Bookmark[] => {
        return [...bookmarks].sort((a, b) => b.timestamp - a.timestamp)
    }, [bookmarks])

    return { bookmarks, toggleBookmark, isBookmarked, getBookmarks }
}
