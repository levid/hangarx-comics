'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import gsap from 'gsap'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Film,
  BookOpen,
  Maximize2,
  Minimize2,
  Columns2,
  Loader2,
  PlayCircle,
  PauseCircle,
  Keyboard,
  Library,
  Bookmark,
  BookmarkCheck,
  Share2,
  Sun,
  Volume2,
  VolumeX,
  ArrowLeftRight,
  ScrollText,
  Copy,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ComicPage } from './comic-page'
import { useSwipe } from '@/hooks/use-swipe'
import { useGsapAnimations } from '@/hooks/use-gsap-animations'
import { useReadingProgress } from '@/hooks/use-reading-progress'
import { usePagePreloader } from '@/hooks/use-page-preloader'
import { useBookmarks } from '@/hooks/use-bookmarks'
import type { ComicPage as ComicPageType } from '@/lib/comic-data'
import { cn } from '@/lib/utils'

interface ComicViewerProps {
  volume?: string
  episode?: string
}

interface ComicManifest {
  title: string
  volume: string
  episode: string
  pages: ComicPageType[]
}

interface EpisodeInfo {
  id: string
  label: string
  pageCount: number
}

interface VolumeInfo {
  id: string
  label: string
  episodes: EpisodeInfo[]
}

// Default hold time for static pages during auto-play (ms)
const STATIC_PAGE_DURATION = 4000
// Chrome auto-hide delay (ms)
const CHROME_HIDE_DELAY = 3000

export function ComicViewer({ volume: initialVolume = 'vol1', episode: initialEpisode = 'ep2' }: ComicViewerProps) {
  // Read URL params on mount for deep linking
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const urlVol = urlParams?.get('vol') || initialVolume
  const urlEp = urlParams?.get('ep') || initialEpisode
  const urlPage = urlParams?.get('page') ? parseInt(urlParams.get('page')!, 10) - 1 : null // 1-indexed in URL

  // Active volume/episode (state-driven for in-viewer navigation)
  const [activeVolume, setActiveVolume] = useState(urlVol)
  const [activeEpisode, setActiveEpisode] = useState(urlEp)
  // Volume/episode listing for the dropdown
  const [volumeList, setVolumeList] = useState<VolumeInfo[]>([])
  // Which volumes are expanded in the tree view
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(() => new Set([urlVol]))
  // Which episodes are expanded in the tree view (keyed as "vol:ep")
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<string>>(() => new Set([`${urlVol}:${urlEp}`]))

  // currentPage is a page INDEX (0-based) — always advances by 1
  const [currentPage, setCurrentPage] = useState(0)
  const [isVideoMode, setIsVideoMode] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [manifest, setManifest] = useState<ComicManifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [audioFocusPageId, setAudioFocusPageId] = useState<number | null>(null)
  const [isAutoPlay, setIsAutoPlay] = useState(false)
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [videoEndedCount, setVideoEndedCount] = useState(0)
  const [pageProgress, setPageProgress] = useState(0)
  const [showThumbnailPanel, setShowThumbnailPanel] = useState(false)
  // Which slot in the spread is currently auto-playing (0 = first/left, 1 = second/right)
  const [autoPlaySlot, setAutoPlaySlot] = useState(0)
  const [forceSinglePage, setForceSinglePage] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [scrollMode, setScrollMode] = useState(false)
  const [readingDirection, setReadingDirection] = useState<'ltr' | 'rtl'>('ltr')
  const [brightness, setBrightness] = useState(1)
  const [globalMute, setGlobalMute] = useState(false)
  const [showBookmarksPanel, setShowBookmarksPanel] = useState(false)
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [shareLinkCopied, setShareLinkCopied] = useState(false)
  const toastRef = useRef<HTMLDivElement>(null)
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)
  const staticAnimFrameRef = useRef<number | null>(null)
  const thumbnailScrollRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const pageCounterRef = useRef<HTMLSpanElement>(null)
  const pageContainerRef = useRef<HTMLDivElement>(null)
  const lastTouchDistRef = useRef<number | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pendingPageRef = useRef<number | null>(urlPage)

  // Hooks
  const { saveProgress, getProgress } = useReadingProgress()
  const { toggleBookmark, isBookmarked, getBookmarks } = useBookmarks()

  // GSAP animation hook
  const {
    animatePageTransition,
    animateThumbnailPanel,
    animateGlowTransition,
    animatePageNumber,
  } = useGsapAnimations()

  // Toast notification
  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToastMessage(message)
    requestAnimationFrame(() => {
      if (toastRef.current) {
        gsap.killTweensOf(toastRef.current)
        gsap.fromTo(toastRef.current,
          { y: 10, opacity: 0, scale: 0.95 },
          { y: 0, opacity: 1, scale: 1, duration: 0.25, ease: 'power3.out' }
        )
      }
    })
    toastTimerRef.current = setTimeout(() => {
      if (toastRef.current) {
        gsap.to(toastRef.current, {
          y: -6, opacity: 0, scale: 0.97, duration: 0.2, ease: 'power2.in',
          onComplete: () => setToastMessage(null)
        })
      }
    }, 1500)
  }, [])

  // Auto-hiding chrome
  const [chromeVisible, setChromeVisible] = useState(true)
  const chromeTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [zoomScale, setZoomScale] = useState(1)
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 })

  // Handle clicking a page to toggle its audio
  const handlePageAudioFocus = useCallback((pageId: number) => {
    setAudioFocusPageId(prev => prev === pageId ? null : pageId)
  }, [])

  // Read URL deep-link params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const vol = params.get('vol')
    const ep = params.get('ep')
    const page = params.get('page')
    if (vol) setActiveVolume(vol)
    if (ep) setActiveEpisode(ep)
    if (vol) setExpandedVolumes(new Set([vol]))
    if (vol && ep) setExpandedEpisodes(new Set([`${vol}:${ep}`]))
    if (page) {
      const pageNum = parseInt(page, 10)
      if (!isNaN(pageNum) && pageNum >= 0) setCurrentPage(pageNum)
    }
  }, [])

  // Fetch volume/episode listing
  useEffect(() => {
    fetch('/api/comic/list')
      .then(res => res.json())
      .then(data => setVolumeList(data.volumes || []))
      .catch(() => { })
  }, [])

  // Fetch comic manifest from API
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/comic?vol=${encodeURIComponent(activeVolume)}&ep=${encodeURIComponent(activeEpisode)}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load comic: ${res.statusText}`)
        return res.json()
      })
      .then((data: ComicManifest) => {
        setManifest(data)
        // Check for pending page navigation (from dropdown)
        if (pendingPageRef.current !== null && pendingPageRef.current < data.pages.length) {
          setCurrentPage(pendingPageRef.current)
          pendingPageRef.current = null
        } else {
          // Restore reading progress or start at 0
          const savedPage = getProgress(activeVolume, activeEpisode)
          if (savedPage !== null && savedPage > 0 && savedPage < data.pages.length) {
            setCurrentPage(savedPage)
            setTimeout(() => showToast(`Resumed at page ${savedPage + 1}`), 500)
          } else {
            setCurrentPage(0)
          }
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [activeVolume, activeEpisode, getProgress, showToast])

  // Sync URL with current reading position for shareable links
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('vol', activeVolume)
    params.set('ep', activeEpisode)
    params.set('page', String(currentPage + 1)) // 1-indexed for humans
    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState(null, '', newUrl)
  }, [activeVolume, activeEpisode, currentPage])

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const pages = manifest?.pages ?? []
  // Cover page (P0 / id === 0) and last page are always shown solo
  const isCoverPage = pages[currentPage]?.id === 0
  const isLastPage = currentPage === pages.length - 1
  // How many pages to DISPLAY at once (1 or 2)
  const pagesPerView = (isMobile || isFullscreen || forceSinglePage || isCoverPage || isLastPage) ? 1 : 2
  const isSinglePage = pagesPerView === 1
  // Total steps = total pages (always advance 1 at a time)
  const totalSteps = pages.length
  // Clamp currentPage so it doesn't go past the last valid start
  const maxPage = Math.max(0, pages.length - 1)

  // --- Chrome auto-hide ---
  const resetChromeTimer = useCallback(() => {
    setChromeVisible(true)
    if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current)
    chromeTimerRef.current = setTimeout(() => {
      setChromeVisible(false)
    }, CHROME_HIDE_DELAY)
  }, [])

  const toggleChrome = useCallback(() => {
    if (chromeVisible) {
      setChromeVisible(false)
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current)
    } else {
      resetChromeTimer()
    }
  }, [chromeVisible, resetChromeTimer])

  // Start chrome timer on mount, reset on navigation
  useEffect(() => {
    resetChromeTimer()
    return () => {
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current)
    }
  }, [currentPage, resetChromeTimer])

  // Reset chrome timer on mouse movement (desktop)
  useEffect(() => {
    const handleMove = () => resetChromeTimer()
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [resetChromeTimer])

  const goToNextPage = useCallback(() => {
    const step = pagesPerView
    const nextPage = Math.min(currentPage + step, maxPage)
    if (nextPage > currentPage) {
      setVideoEndedCount(0)
      setAutoPlaySlot(0)
      setZoomScale(1)
      setCurrentPage(nextPage)
      animatePageTransition(pageContainerRef.current, readingDirection === 'rtl' ? 'right' : 'left')
      animateGlowTransition(glowRef.current)
      animatePageNumber(pageCounterRef.current)
      if (scrollMode && scrollContainerRef.current) {
        const container = scrollContainerRef.current
        const child = container.children[nextPage] as HTMLElement
        if (child) {
          gsap.killTweensOf(container)
          gsap.to(container, { scrollTop: child.offsetTop, duration: 0.8, ease: 'power2.inOut' })
        }
      }
    } else if (isAutoPlay) {
      setIsAutoPlay(false)
    }
  }, [currentPage, maxPage, isAutoPlay, pagesPerView, readingDirection, animatePageTransition, animateGlowTransition, animatePageNumber])

  const goToPrevPage = useCallback(() => {
    if (currentPage > 0) {
      const step = pagesPerView
      setVideoEndedCount(0)
      setAutoPlaySlot(0)
      setZoomScale(1)
      setCurrentPage(prev => Math.max(prev - step, 0))
      animatePageTransition(pageContainerRef.current, readingDirection === 'rtl' ? 'left' : 'right')
      animateGlowTransition(glowRef.current)
      animatePageNumber(pageCounterRef.current)
    }
  }, [currentPage, pagesPerView, readingDirection, animatePageTransition, animateGlowTransition, animatePageNumber])

  const goToPage = useCallback((pageIndex: number) => {
    const targetPage = Math.max(0, Math.min(pageIndex, maxPage))
    setCurrentPage(targetPage)
    setVideoEndedCount(0)
    setAutoPlaySlot(0)
    setShowThumbnailPanel(false)
    setZoomScale(1)
    if (scrollMode && scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const child = container.children[targetPage] as HTMLElement
      if (child) {
        gsap.killTweensOf(container)
        gsap.to(container, { scrollTop: child.offsetTop, duration: 0.8, ease: 'power2.inOut' })
      }
    } else {
      const direction = targetPage > currentPage ? 'left' : 'right'
      animatePageTransition(pageContainerRef.current, direction)
      animateGlowTransition(glowRef.current)
      animatePageNumber(pageCounterRef.current)
    }
  }, [maxPage, currentPage, scrollMode, animatePageTransition, animateGlowTransition, animatePageNumber])

  // --- Tap zones ---
  const handleTapZone = useCallback((e: React.MouseEvent<HTMLElement>) => {
    // Don't handle taps when zoomed in
    if (zoomScale > 1) return

    // Don't intercept clicks on interactive elements (buttons, links, etc.)
    const target = e.target as HTMLElement
    if (target.closest('button, a, [role="button"], input, select, textarea, video')) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width

    if (x < 0.3) {
      // Left 30% — go back
      goToPrevPage()
    } else if (x > 0.7) {
      // Right 30% — go forward
      goToNextPage()
    } else {
      // Center 40% — toggle chrome
      toggleChrome()
    }
  }, [goToPrevPage, goToNextPage, toggleChrome, zoomScale])

  // --- Pinch-to-zoom ---
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastTouchDistRef.current = Math.hypot(dx, dy)

      // Set zoom origin to midpoint
      const container = pageContainerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        const midX = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) / rect.width * 100
        const midY = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) / rect.height * 100
        setZoomOrigin({ x: midX, y: midY })
      }
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const scaleDelta = dist / lastTouchDistRef.current

      setZoomScale(prev => {
        const next = prev * scaleDelta
        return Math.max(1, Math.min(next, 4)) // Clamp between 1x and 4x
      })
      lastTouchDistRef.current = dist
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    lastTouchDistRef.current = null
    // Snap back to 1x if close
    setZoomScale(prev => prev < 1.1 ? 1 : prev)
  }, [])

  // Double-tap to reset zoom (desktop double-click)
  const handleDoubleClick = useCallback(() => {
    if (zoomScale > 1) {
      setZoomScale(1)
    } else {
      setZoomScale(2.5)
      setZoomOrigin({ x: 50, y: 50 })
    }
  }, [zoomScale])

  // Swipe handlers
  const { handlers: swipeHandlers } = useSwipe({
    onSwipeLeft: goToNextPage,
    onSwipeRight: goToPrevPage,
    threshold: 50
  })

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (scrollMode && scrollContainerRef.current) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault()
          const container = scrollContainerRef.current
          const nextIdx = Math.min(currentPage + 1, pages.length - 1)
          const child = container.children[nextIdx] as HTMLElement
          if (child) {
            gsap.killTweensOf(container)
            gsap.to(container, { scrollTop: child.offsetTop, duration: 0.8, ease: 'power2.inOut' })
          }
          return
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault()
          const container = scrollContainerRef.current
          const prevIdx = Math.max(currentPage - 1, 0)
          const child = container.children[prevIdx] as HTMLElement
          if (child) {
            gsap.killTweensOf(container)
            gsap.to(container, { scrollTop: child.offsetTop, duration: 0.8, ease: 'power2.inOut' })
          }
          return
        }
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        goToNextPage()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        goToPrevPage()
      } else if (e.key === 'Escape') {
        setIsFullscreen(false)
        setIsAutoPlay(false)
        setZoomScale(1)
      } else if (e.key === 'f') {
        setIsFullscreen(prev => {
          if (!prev) setChromeVisible(false)
          else resetChromeTimer()
          return !prev
        })
      } else if (e.key === 'v') {
        setIsVideoMode(prev => {
          showToast(!prev ? 'Motion mode' : 'Static mode')
          return !prev
        })
      } else if (e.key === ' ') {
        e.preventDefault()
        setIsAutoPlay(prev => {
          showToast(!prev ? 'Autoplay enabled' : 'Autoplay paused')
          return !prev
        })
      } else if (e.key === 't') {
        setShowThumbnailPanel(prev => !prev)
      } else if (e.key === '?') {
        setShowShortcuts(prev => !prev)
      } else if (e.key === 'z') {
        setZoomScale(prev => {
          if (prev === 1) { showToast('Fit to width'); return 1.5 }
          showToast('Fit to page'); return 1
        })
      } else if (e.key === 'b') {
        toggleBookmark(activeVolume, activeEpisode, currentPage)
        showToast(isBookmarked(activeVolume, activeEpisode, currentPage) ? 'Bookmark removed' : 'Page bookmarked')
      } else if (e.key === 's') {
        setScrollMode(prev => {
          showToast(!prev ? 'Scroll mode' : 'Page mode')
          return !prev
        })
      } else if (e.key === 'd') {
        setReadingDirection(prev => {
          const next = prev === 'ltr' ? 'rtl' : 'ltr'
          showToast(next === 'rtl' ? 'Right-to-left' : 'Left-to-right')
          return next
        })
      } else if (e.key === 'm') {
        setGlobalMute(prev => {
          if (!prev) {
            setAudioFocusPageId(null)
          } else {
            const page = pages[currentPage]
            if (page) setAudioFocusPageId(page.id)
          }
          showToast(!prev ? 'Muted' : 'Unmuted')
          return !prev
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToNextPage, goToPrevPage, resetChromeTimer, showToast, toggleBookmark, isBookmarked, activeVolume, activeEpisode, currentPage])

  // Current visible pages
  const currentPages = useMemo(() => {
    return pages.slice(currentPage, Math.min(currentPage + pagesPerView, pages.length))
  }, [pages, currentPage, pagesPerView])

  const activePageIndices = useMemo(() => {
    const indices = new Set<number>()
    for (let i = currentPage; i < currentPage + pagesPerView && i < pages.length; i++) {
      indices.add(i)
    }
    return indices
  }, [currentPage, pagesPerView, pages.length])

  const preloadPageIndices = useMemo(() => {
    const indices = new Set<number>()
    if (currentPage - 1 >= 0 && !activePageIndices.has(currentPage - 1)) {
      indices.add(currentPage - 1)
    }
    const nextStart = currentPage + pagesPerView
    for (let i = nextStart; i < nextStart + pagesPerView && i < pages.length; i++) {
      if (!activePageIndices.has(i)) indices.add(i)
    }
    return indices
  }, [currentPage, pagesPerView, pages.length, activePageIndices])

  // Auto-play: determine which slot's page has video
  const autoPlaySlotPage = useMemo(() => {
    const idx = currentPage + autoPlaySlot
    return idx < pages.length ? pages[idx] : null
  }, [pages, currentPage, autoPlaySlot])

  const autoPlaySlotHasVideo = useMemo(() => {
    if (!isVideoMode) return false
    return autoPlaySlotPage ? !!autoPlaySlotPage.video : false
  }, [isVideoMode, autoPlaySlotPage])

  // Auto-play logic — sequential slot-based
  useEffect(() => {
    if (!isAutoPlay) {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current)
        autoPlayTimerRef.current = null
      }
      return
    }

    // Current slot has video? Wait for it to finish
    if (autoPlaySlotHasVideo) {
      if (videoEndedCount < 1) return
      // Video ended — move to next slot or advance
      if (autoPlaySlot < pagesPerView - 1 && currentPage + autoPlaySlot + 1 < pages.length) {
        // Move to next slot in the spread
        setAutoPlaySlot(prev => prev + 1)
        setVideoEndedCount(0)
        setPageProgress(0)
      } else {
        // All slots done — advance to next spread
        goToNextPage()
      }
      return
    }

    // Static page — use timer, then move to next slot or advance
    autoPlayTimerRef.current = setTimeout(() => {
      if (autoPlaySlot < pagesPerView - 1 && currentPage + autoPlaySlot + 1 < pages.length) {
        setAutoPlaySlot(prev => prev + 1)
        setVideoEndedCount(0)
        setPageProgress(0)
      } else {
        goToNextPage()
      }
    }, STATIC_PAGE_DURATION)

    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current)
        autoPlayTimerRef.current = null
      }
    }
  }, [isAutoPlay, currentPage, autoPlaySlot, autoPlaySlotHasVideo, videoEndedCount, goToNextPage, pagesPerView, pages.length])

  const handleVideoEnded = useCallback(() => {
    setVideoEndedCount(prev => prev + 1)
  }, [])

  const handleVideoProgress = useCallback((prog: number) => {
    setPageProgress(prog)
  }, [])

  // Reset progress and slot on page change
  useEffect(() => {
    setVideoEndedCount(0)
    setPageProgress(0)
    setAutoPlaySlot(0)
  }, [currentPage])

  // Scroll to current page when entering scroll mode
  useEffect(() => {
    if (scrollMode && scrollContainerRef.current) {
      requestAnimationFrame(() => {
        const container = scrollContainerRef.current
        if (container) {
          const child = container.children[currentPage] as HTMLElement
          if (child) container.scrollTop = child.offsetTop
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollMode])

  // Auto-unmute: in motion mode, audio follows the current page
  useEffect(() => {
    if (isVideoMode) {
      const targetPage = isAutoPlay ? pages[currentPage + autoPlaySlot] : pages[currentPage]
      if (targetPage?.video) {
        setAudioFocusPageId(targetPage.id)
      }
    }
  }, [isVideoMode, isAutoPlay, currentPage, autoPlaySlot, pages])

  // Animate static page progress during auto-play
  useEffect(() => {
    if (!isAutoPlay || autoPlaySlotHasVideo) {
      if (staticAnimFrameRef.current) {
        cancelAnimationFrame(staticAnimFrameRef.current)
        staticAnimFrameRef.current = null
      }
      return
    }

    const startTime = performance.now()
    const animate = (now: number) => {
      const elapsed = now - startTime
      const frac = Math.min(elapsed / STATIC_PAGE_DURATION, 1)
      setPageProgress(frac)
      if (frac < 1) {
        staticAnimFrameRef.current = requestAnimationFrame(animate)
      }
    }
    staticAnimFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (staticAnimFrameRef.current) {
        cancelAnimationFrame(staticAnimFrameRef.current)
        staticAnimFrameRef.current = null
      }
    }
  }, [isAutoPlay, autoPlaySlotHasVideo, currentPage, autoPlaySlot])

  // Auto-scroll thumbnail panel + animate thumbnails
  useEffect(() => {
    if (showThumbnailPanel && thumbnailScrollRef.current) {
      // Animate thumbnails staggering in
      animateThumbnailPanel(thumbnailScrollRef.current)
      // Scroll to active thumbnail
      const activeThumb = thumbnailScrollRef.current.querySelector('[data-active="true"]')
      if (activeThumb) {
        setTimeout(() => {
          activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        }, 100)
      }
    }
  }, [showThumbnailPanel, animateThumbnailPanel])

  // Page preloader
  usePagePreloader(pages, currentPage)

  // Save reading progress on page change
  useEffect(() => {
    if (pages.length > 0 && currentPage > 0) {
      saveProgress(activeVolume, activeEpisode, currentPage)
    }
  }, [currentPage, activeVolume, activeEpisode, pages.length, saveProgress])



  // Loading skeleton
  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-black">
        <div className="flex items-center gap-2">
          <div className="w-[280px] md:w-[400px] aspect-[2/3] rounded-lg bg-white/[0.04] animate-pulse" />
          <div className="hidden md:block w-[280px] md:w-[400px] aspect-[2/3] rounded-lg bg-white/[0.03] animate-pulse" style={{ animationDelay: '150ms' }} />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/[0.04] animate-pulse" />
      </div>
    )
  }

  // Error state
  if (error || !manifest) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-black">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <BookOpen className="w-10 h-10 text-destructive" />
          <p className="text-foreground font-medium">Failed to load comic</p>
          <p className="text-muted-foreground text-sm">{error || 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col bg-black/60 transition-all duration-300',
        isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-screen'
      )}
    >
      {/* Header — hidden in fullscreen, auto-hides with chrome */}
      {!isFullscreen && (
        <header
          className={cn(
            'flex items-center justify-between px-4 md:px-6 border-b border-white/10 bg-black/30 backdrop-blur-xl transition-all duration-500 z-10 overflow-hidden',
            chromeVisible ? 'py-3 max-h-20 opacity-100' : 'py-0 max-h-0 opacity-0 border-transparent pointer-events-none'
          )}
        >
          <div className="flex items-center gap-5">
            {/* HangarX logo */}
            <a href="https://www.hangarx.ai" target="_blank" rel="noopener noreferrer" title="HangarX">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 118" className="w-6 h-[22px] hover:opacity-70 transition-opacity" fill="white">
                <g transform="translate(0,118) scale(0.1,-0.1)">
                  <path d="M270 1052 c0 -4 21 -79 46 -167 70 -244 73 -225 -85 -543 -72 -144 -131 -265 -131 -267 0 -22 53 34 276 288 141 160 259 293 263 295 4 1 123 -130 265 -293 142 -162 264 -295 272 -295 9 0 -35 98 -118 265 -163 328 -160 308 -90 553 29 102 45 172 38 172 -6 0 -89 -88 -184 -195 -95 -107 -176 -195 -181 -195 -4 0 -85 88 -180 195 -157 177 -191 210 -191 187z"/>
                </g>
              </svg>
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:bg-white/5 rounded-xl px-2 py-1.5 -ml-2 transition-colors group focus:outline-none">
                  <span className="text-sm font-semibold text-foreground tracking-wide uppercase">
                    {activeVolume.replace('vol', 'Vol ')} — {activeEpisode.replace('ep', 'Ep ')}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                alignOffset={-24}
                className="w-64 max-h-[70vh] overflow-y-auto p-1.5 bg-black/85 backdrop-blur-2xl border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50"
              >
                {volumeList.map((vol, volIdx) => {
                  const isActiveVol = vol.id === activeVolume
                  const isExpanded = expandedVolumes.has(vol.id)
                  const isLastVol = volIdx === volumeList.length - 1

                  return (
                    <div key={vol.id}>
                      {/* Volume header */}
                      <DropdownMenuItem
                        className={cn(
                          'flex items-center gap-2 text-[13px] font-semibold cursor-pointer rounded-lg py-2.5 px-3 focus:outline-none',
                          isActiveVol ? 'text-foreground' : 'text-foreground/60'
                        )}
                        onSelect={(e) => {
                          e.preventDefault()
                          setExpandedVolumes(prev => {
                            const next = new Set(prev)
                            if (next.has(vol.id)) next.delete(vol.id)
                            else next.add(vol.id)
                            return next
                          })
                        }}
                      >
                        <ChevronRight className={cn(
                          'w-3 h-3 transition-transform duration-200 shrink-0',
                          isExpanded ? 'rotate-90 text-foreground/60' : 'text-foreground/30'
                        )} />
                        <span className="flex-1">{vol.label}</span>
                        {isActiveVol && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                        <span className="text-[10px] text-foreground/25 font-normal tabular-nums">
                          {vol.episodes.length}
                        </span>
                      </DropdownMenuItem>

                      {/* Episodes */}
                      {isExpanded && (
                        <div className="pb-1">
                          {vol.episodes.map((ep) => {
                            const isActiveEp = isActiveVol && ep.id === activeEpisode
                            const epKey = `${vol.id}:${ep.id}`
                            const isEpExpanded = expandedEpisodes.has(epKey)

                            return (
                              <div key={ep.id}>
                                <DropdownMenuItem
                                  className={cn(
                                    'flex items-center gap-2 text-[12px] ml-4 mr-1 rounded-lg py-2 px-2.5 cursor-pointer focus:outline-none',
                                    isActiveEp
                                      ? 'bg-white/[0.08] text-foreground font-medium'
                                      : 'text-foreground/45 hover:text-foreground/75'
                                  )}
                                  onSelect={(e) => {
                                    e.preventDefault()
                                    setExpandedEpisodes(prev => {
                                      const next = new Set(prev)
                                      if (next.has(epKey)) next.delete(epKey)
                                      else next.add(epKey)
                                      return next
                                    })
                                    if (!isActiveEp) {
                                      setActiveVolume(vol.id)
                                      setActiveEpisode(ep.id)
                                    }
                                  }}
                                >
                                  <ChevronRight className={cn(
                                    'w-2.5 h-2.5 transition-transform duration-200 shrink-0',
                                    isEpExpanded ? 'rotate-90 text-foreground/50' : 'text-foreground/20'
                                  )} />
                                  <span className="flex-1">{ep.label}</span>
                                  <span className="text-[10px] text-foreground/20 font-normal tabular-nums">
                                    {ep.pageCount}
                                  </span>
                                </DropdownMenuItem>

                                {/* Page grid */}
                                {isEpExpanded && ep.pageCount > 0 && (
                                  <div className="page-grid-container ml-9 mr-2 py-1.5 pb-2">
                                    <div className="grid grid-cols-5 gap-1">
                                      {Array.from({ length: ep.pageCount }, (_, i) => {
                                        const isActivePage = isActiveEp && i === currentPage
                                        return (
                                          <button
                                            key={i}
                                            onClick={() => {
                                              if (!isActiveEp) {
                                                setActiveVolume(vol.id)
                                                setActiveEpisode(ep.id)
                                                pendingPageRef.current = i
                                              } else {
                                                goToPage(i)
                                              }
                                              setShowThumbnailPanel(false)
                                            }}
                                            className={cn(
                                              'text-[10px] py-1 rounded text-center transition-all tabular-nums focus:outline-none',
                                              isActivePage
                                                ? 'bg-primary text-primary-foreground font-semibold'
                                                : 'bg-white/[0.03] hover:bg-white/[0.08] text-foreground/30 hover:text-foreground/60'
                                            )}
                                          >
                                            {i + 1}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {!isLastVol && <DropdownMenuSeparator className="my-1 bg-white/[0.04]" />}
                    </div>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Centered page counter */}
          <span ref={pageCounterRef} className="absolute left-1/2 -translate-x-1/2 text-xs text-foreground/70 font-medium tabular-nums">
            {currentPage + 1}{currentPages.length > 1 ? `–${currentPage + currentPages.length}` : ''} / {pages.length}
          </span>

          <div className="flex items-center gap-2">
            {/* Auto-play toggle */}
            <Button
              variant={isAutoPlay ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const next = !isAutoPlay
                setIsAutoPlay(next)
                showToast(next ? 'Autoplay enabled' : 'Autoplay paused')
              }}
              className="gap-2"
              title={isAutoPlay ? 'Pause auto-play (Space)' : 'Auto-play (Space)'}
            >
              {isAutoPlay ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
              <span className="hidden sm:inline">{isAutoPlay ? 'Pause' : 'Auto Play'}</span>
            </Button>

            {/* Mode segmented toggle */}
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => {
                  setIsVideoMode(false)
                  showToast('Static mode')
                }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-colors',
                  !isVideoMode
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Static</span>
              </button>
              <button
                onClick={() => {
                  setIsVideoMode(true)
                  showToast('Motion mode')
                }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-colors',
                  isVideoMode
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Film className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Motion</span>
              </button>
            </div>

            {/* Layout segmented toggle */}
            {!isMobile && (
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  onClick={() => {
                    setForceSinglePage(true)
                    showToast('Single page view')
                  }}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-colors',
                    forceSinglePage
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  title="Single page"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Single</span>
                </button>
                <button
                  onClick={() => {
                    setForceSinglePage(false)
                    showToast('Split page view')
                  }}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-colors',
                    !forceSinglePage
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  title="Two-page spread"
                >
                  <Columns2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Split</span>
                </button>
              </div>
            )}

            {/* Global mute toggle */}
            <button
              onClick={() => {
                setGlobalMute(prev => {
                  if (!prev) {
                    setAudioFocusPageId(null)
                  } else {
                    // Unmuting — restore audio to current page
                    const page = pages[currentPage]
                    if (page) setAudioFocusPageId(page.id)
                  }
                  showToast(!prev ? 'Muted' : 'Unmuted')
                  return !prev
                })
              }}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                globalMute
                  ? 'text-red-400 hover:bg-muted'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              title={globalMute ? 'Unmute all audio' : 'Mute all audio'}
            >
              {globalMute ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            {/* Reading direction toggle */}
            <button
              onClick={() => {
                setReadingDirection(prev => {
                  const next = prev === 'ltr' ? 'rtl' : 'ltr'
                  showToast(next === 'rtl' ? 'Right-to-left' : 'Left-to-right')
                  return next
                })
              }}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                readingDirection === 'rtl'
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              title={`Reading direction: ${readingDirection.toUpperCase()} (D)`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            {/* Scroll mode toggle */}
            <button
              onClick={() => {
                setScrollMode(prev => {
                  showToast(!prev ? 'Scroll mode' : 'Page mode')
                  return !prev
                })
              }}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                scrollMode
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              title={scrollMode ? 'Switch to page mode (S)' : 'Switch to scroll mode (S)'}
            >
              <ScrollText className="w-3.5 h-3.5" />
            </button>

            {/* Bookmark toggle */}
            <button
              onClick={() => {
                toggleBookmark(activeVolume, activeEpisode, currentPage)
                showToast(isBookmarked(activeVolume, activeEpisode, currentPage) ? 'Bookmark removed' : 'Page bookmarked')
              }}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                isBookmarked(activeVolume, activeEpisode, currentPage)
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              title="Bookmark this page (B)"
            >
              {isBookmarked(activeVolume, activeEpisode, currentPage)
                ? <BookmarkCheck className="w-3.5 h-3.5" />
                : <Bookmark className="w-3.5 h-3.5" />
              }
            </button>

            {/* Share link */}
            <button
              onClick={() => {
                setShowShareDialog(true)
                setShareLinkCopied(false)
              }}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Share page link"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            {/* Fullscreen toggle */}
            <Button
              variant={isFullscreen ? 'default' : 'outline'}
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => {
                setIsFullscreen(!isFullscreen)
                if (!isFullscreen) {
                  setChromeVisible(false)
                  if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current)
                } else {
                  resetChromeTimer()
                }
              }}
              title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen single-page (F)'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </header>
      )}

      {/* Floating controls in fullscreen — auto-hide with chrome */}
      {isFullscreen && (
        <div
          className={cn(
            'absolute top-4 right-4 z-20 flex items-center gap-2 transition-opacity duration-500',
            chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAutoPlay(!isAutoPlay)}
            className="gap-1.5 bg-card/80 backdrop-blur-sm border border-border shadow-lg"
          >
            {isAutoPlay ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
          </Button>
          <div className="flex rounded-md border border-border overflow-hidden bg-card/80 backdrop-blur-sm shadow-lg">
            <button
              onClick={() => setIsVideoMode(false)}
              className={cn(
                'flex items-center px-2 py-1.5 transition-colors',
                !isVideoMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsVideoMode(true)}
              className={cn(
                'flex items-center px-2 py-1.5 transition-colors',
                isVideoMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Film className="w-3.5 h-3.5" />
            </button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsFullscreen(false)}
            className="bg-card/80 backdrop-blur-sm border border-border shadow-lg"
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Main viewer area — with tap zones */}
      <main
        className="flex-1 relative overflow-hidden select-none"
        style={{ filter: brightness !== 1 ? `brightness(${brightness})` : undefined }}
        onClick={handleTapZone}
        onDoubleClick={handleDoubleClick}
        onTouchStart={(e) => {
          handleTouchStart(e)
          swipeHandlers.onTouchStart(e)
        }}
        onTouchMove={(e) => {
          handleTouchMove(e)
          swipeHandlers.onTouchMove(e)
        }}
        onTouchEnd={() => {
          handleTouchEnd()
          swipeHandlers.onTouchEnd()
        }}
        onMouseDown={swipeHandlers.onMouseDown}
        onMouseMove={swipeHandlers.onMouseMove}
        onMouseUp={swipeHandlers.onMouseUp}
        onMouseLeave={swipeHandlers.onMouseLeave}
      >

        {/* Ambient backlight glow — dynamically matches current page colors */}
        {!scrollMode && pages[currentPage]?.image && (
          <div
            ref={glowRef}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
            style={{ opacity: 0.5 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={currentPage}
              src={pages[currentPage].image}
              alt=""
              className="w-full h-full object-contain"
              style={{
                filter: 'blur(60px) saturate(1.8)',
                transform: 'scale(1.15)',
                willChange: 'transform',
              }}
            />
          </div>
        )}

        {scrollMode ? (
          /* Vertical scroll mode — continuous reading */
          <div
            ref={scrollContainerRef}
            className="absolute inset-0 overflow-y-auto"
            style={{ scrollSnapType: undefined }}
            onScroll={(e) => {
              const target = e.currentTarget
              const scrollTop = target.scrollTop
              const pageHeight = target.clientHeight
              const newPage = Math.round(scrollTop / pageHeight)
              if (newPage !== currentPage && newPage >= 0 && newPage < pages.length) {
                setCurrentPage(newPage)
              }
            }}
          >
            {pages.map((page, index) => (
              <div
                key={page.id}
                className="w-full flex items-center justify-center"
                style={{
                  minHeight: '100%',
                  scrollSnapAlign: 'start',
                }}
              >
                <div className="relative w-full max-w-2xl mx-auto" style={{ aspectRatio: '3/4' }}>
                  <ComicPage
                    page={page}
                    isVideoMode={isVideoMode}
                    isActive={index === currentPage}
                    shouldPreload={Math.abs(index - currentPage) <= 3}
                    isMuted={globalMute || audioFocusPageId !== page.id}
                    onAudioFocus={() => handlePageAudioFocus(page.id)}
                    onToggleMotion={() => setIsVideoMode(false)}
                    autoPlayActive={false}
                    forceContain={page.id === 0}
                    className="rounded-none"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Paginated mode — default */
          <>
            {/* Book wrapper */}
            <div className={cn(
              'absolute flex items-center justify-center z-[1]',
              isFullscreen ? 'inset-1' : 'inset-2 sm:inset-4 md:inset-8'
            )}>
              {/* Page spread container with zoom */}
              <div
                ref={pageContainerRef}
                className={cn(
                  'relative flex gap-0.5 sm:gap-1 md:gap-2 h-full max-w-full',
                  isSinglePage ? 'max-h-full' : 'max-h-[85vh]'
                )}
                style={{
                  aspectRatio: isSinglePage ? '3/4' : '4/3',
                  perspective: '2000px',
                  direction: readingDirection,
                  transform: zoomScale > 1 ? `scale(${zoomScale})` : undefined,
                  transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                  transition: zoomScale === 1 ? 'transform 0.3s ease' : undefined
                }}
              >
                {currentPages.map((page, index) => {
                  const globalIndex = currentPage + index
                  return (
                    <div
                      key={page.id}
                      className={cn(
                        'relative h-full transition-all duration-300',
                        isSinglePage ? 'w-full' : 'w-1/2'
                      )}
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      <ComicPage
                        page={page}
                        isVideoMode={isVideoMode}
                        isActive={activePageIndices.has(globalIndex)}
                        shouldPreload={false}
                        isMuted={globalMute || audioFocusPageId !== page.id}
                        onAudioFocus={() => handlePageAudioFocus(page.id)}
                        onVideoEnded={isAutoPlay && index === autoPlaySlot ? handleVideoEnded : undefined}
                        onVideoProgress={index === autoPlaySlot ? handleVideoProgress : undefined}
                        onToggleMotion={() => setIsVideoMode(false)}
                        autoPlayActive={isAutoPlay && index === autoPlaySlot}
                        forceContain={isCoverPage}
                        className={cn(
                          !isSinglePage && index === 0 && 'rounded-r-none',
                          !isSinglePage && index === 1 && 'rounded-l-none'
                        )}
                      />
                    </div>
                  )
                })}

                {/* Book spine effect for two-page spread */}
                {!isSinglePage && currentPages.length === 2 && (
                  <div className="absolute left-1/2 top-0 bottom-0 w-2 -translate-x-1/2 bg-gradient-to-r from-black/30 via-black/10 to-black/30 z-10 pointer-events-none" />
                )}
              </div>
            </div>
          </>
        )}

        {/* Preload adjacent pages (hidden) */}
        <div className="hidden">
          {Array.from(preloadPageIndices).map(idx => {
            const page = pages[idx]
            if (!page?.video) return null
            return (
              <ComicPage
                key={`preload-${page.id}`}
                page={page}
                isVideoMode={isVideoMode}
                isActive={false}
                shouldPreload={true}
                isMuted={true}
              />
            )
          })}
        </div>

        {/* Navigation arrows — auto-hide with chrome, hidden in scroll mode */}
        {!scrollMode && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevPage() }}
              disabled={currentPage === 0}
              className={cn(
                'absolute left-2 md:left-4 top-1/2 -translate-y-1/2 p-2 md:p-3 rounded-full z-20',
                'bg-card/80 backdrop-blur-sm border border-border shadow-lg',
                'text-foreground hover:bg-card hover:scale-110 transition-all',
                'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100',
                chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
                'transition-opacity duration-500'
              )}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); goToNextPage() }}
              disabled={currentPage >= maxPage}
              className={cn(
                'absolute right-2 md:right-4 top-1/2 -translate-y-1/2 p-2 md:p-3 rounded-full z-20',
                'bg-card/80 backdrop-blur-sm border border-border shadow-lg',
                'text-foreground hover:bg-card hover:scale-110 transition-all',
                'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100',
                chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
                'transition-opacity duration-500'
              )}
              aria-label="Next page"
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </>
        )}

        {/* Scroll down indicator in scroll mode */}
        {scrollMode && currentPage === 0 && (
          <div
            className={cn(
              'absolute bottom-14 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 pointer-events-none transition-opacity duration-500',
              chromeVisible ? 'opacity-70' : 'opacity-0'
            )}
          >
            <span className="text-[11px] text-foreground/60 font-medium tracking-wide mb-1">SCROLL</span>
            <ChevronDown className="w-5 h-5 text-foreground/40 animate-bounce" />
          </div>
        )}


        {/* Zoom indicator */}
        {zoomScale > 1 && (
          <div className="absolute top-4 left-4 px-2.5 py-1 rounded-md bg-card/80 backdrop-blur-sm border border-border text-xs text-foreground z-20">
            {Math.round(zoomScale * 100)}%
          </div>
        )}
      </main>

      {/* Segmented progress bar — always visible */}
      <div className="group/progress relative" onMouseLeave={() => setHoveredSegment(null)}>
        {/* Invisible hover target for easier interaction */}
        <div className="absolute -top-3 inset-x-0 h-3" />
        <div className="flex bg-muted gap-px h-[2px] group-hover/progress:h-[6px] transition-all duration-200">
        {pages.map((page, index) => {
          const isPast = index < currentPage
          const isCurrent = index === currentPage
          const hasVideoIndicator = !!page.video
          const isPageBookmarked = isBookmarked(activeVolume, activeEpisode, index)
          const dist = hoveredSegment !== null ? Math.abs(index - hoveredSegment) : -1
          const flexGrow = hoveredSegment === null ? 1 : dist === 0 ? 3 : dist === 1 ? 2 : dist === 2 ? 1.5 : 1

          return (
            <button
              key={page.id}
              className={cn(
                'relative h-full cursor-pointer focus:outline-none transition-all duration-150',
                hoveredSegment === index ? 'bg-red-900' : isPast ? 'bg-primary' : 'bg-muted'
              )}
              style={{ flexGrow }}
              onClick={() => goToPage(index)}
              onMouseEnter={() => setHoveredSegment(index)}
              title={page.title || `Page ${page.id}`}
            >
              {isCurrent && (
                <div
                  className="absolute inset-0 bg-primary origin-left"
                  style={{
                    transform: `scaleX(${isAutoPlay ? pageProgress : 1})`,
                    transition: isAutoPlay ? 'none' : 'transform 0.3s ease'
                  }}
                />
              )}
              {isPageBookmarked && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-500" />
              )}
            </button>
          )
        })}
      </div>
      </div>

      {/* Collapsible thumbnail panel — hidden in fullscreen, auto-hide with chrome */}
      {!isFullscreen && (
        <div
          className={cn(
            'border-t border-border bg-card/95 backdrop-blur-sm transition-all duration-300 overflow-hidden',
            showThumbnailPanel ? 'max-h-[160px]' : 'max-h-8',
            !chromeVisible && !showThumbnailPanel ? 'max-h-0 border-t-0' : ''
          )}
        >
          {/* Toggle bar */}
          <button
            className="w-full h-8 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            onClick={() => setShowThumbnailPanel(!showThumbnailPanel)}
          >
            {showThumbnailPanel ? (
              <><ChevronDown className="w-3.5 h-3.5" /><span>Hide pages</span></>
            ) : (
              <><ChevronUp className="w-3.5 h-3.5" /><span ref={pageCounterRef}>Show pages · {currentPage + 1} / {pages.length}</span></>
            )}
          </button>

          {/* Scrollable thumbnails */}
          {showThumbnailPanel && (
            <div
              ref={thumbnailScrollRef}
              className="flex gap-2 px-3 pb-3 overflow-x-auto"
              style={{ willChange: 'transform' }}
            >
              {pages.map((page, index) => {
                const isCurrentThumb = index === currentPage
                return (
                  <button
                    key={page.id}
                    data-active={isCurrentThumb}
                    onClick={() => goToPage(index)}
                    className={cn(
                      'relative flex-shrink-0 w-16 md:w-20 aspect-[3/4] rounded overflow-hidden border-2 transition-all',
                      isCurrentThumb
                        ? 'border-primary ring-2 ring-primary/30 scale-105'
                        : 'border-border/50 hover:border-primary/50 opacity-70 hover:opacity-100'
                    )}
                  >
                    <Image
                      src={page.image}
                      alt={page.title || `Page ${page.id}`}
                      width={80}
                      height={107}
                      sizes="80px"
                      quality={30}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {page.video && (
                      <Film className="absolute top-1 right-1 w-2.5 h-2.5 text-primary drop-shadow" />
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1 py-0.5">
                      <span className="text-[10px] text-white font-medium">{page.id}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Share link dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md bg-black/90 backdrop-blur-2xl border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-foreground">Share this page</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-2">
            <input
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?vol=${activeVolume}&ep=${activeEpisode}&page=${currentPage + 1}`}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 select-all"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={() => {
                const url = `${window.location.origin}/?vol=${activeVolume}&ep=${activeEpisode}&page=${currentPage + 1}`
                navigator.clipboard.writeText(url).then(() => {
                  setShareLinkCopied(true)
                  setTimeout(() => setShareLinkCopied(false), 2000)
                })
              }}
              className={cn(
                'p-2 rounded-lg transition-colors',
                shareLinkCopied
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground'
              )}
              title="Copy link"
            >
              {shareLinkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Keyboard shortcuts button + dialog */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogTrigger asChild>
          <button
            className={cn(
              showThumbnailPanel ? 'absolute bottom-44 right-4 hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-card/80 backdrop-blur-sm border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all shadow-sm z-20' : 'absolute bottom-12 right-4 hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-card/80 backdrop-blur-sm border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all shadow-sm z-20',
              chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
              'duration-500'
            )}
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Shortcuts</span>
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {[
              { keys: ['←', '→'], desc: 'Navigate pages' },
              { keys: ['Space'], desc: 'Toggle auto-play' },
              { keys: ['V'], desc: 'Toggle motion / static' },
              { keys: ['F'], desc: 'Toggle fullscreen' },
              { keys: ['T'], desc: 'Toggle thumbnail panel' },
              { keys: ['Z'], desc: 'Zoom fit-width / fit-page' },
              { keys: ['B'], desc: 'Bookmark current page' },
              { keys: ['S'], desc: 'Toggle scroll / page mode' },
              { keys: ['D'], desc: 'Toggle reading direction (LTR/RTL)' },
              { keys: ['Esc'], desc: 'Exit fullscreen / stop auto-play' },
              { keys: ['?'], desc: 'Show this dialog' },
            ].map(({ keys, desc }) => (
              <div key={desc} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{desc}</span>
                <div className="flex items-center gap-1">
                  {keys.map(k => (
                    <kbd key={k} className="px-2 py-1 rounded bg-muted border border-border text-xs font-mono text-muted-foreground min-w-[28px] text-center">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Tap left/right edges to navigate · Center tap to show/hide UI · Double-tap to zoom · Pinch to zoom on mobile
          </p>
        </DialogContent>
      </Dialog>

      {/* Toast notification */}
      {toastMessage && (
        <div
          ref={toastRef}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-black/70 backdrop-blur-xl border border-white/[0.08] text-xs text-foreground/80 font-medium shadow-lg pointer-events-none whitespace-nowrap"
        >
          {toastMessage}
        </div>
      )}
    </div>
  )
}
