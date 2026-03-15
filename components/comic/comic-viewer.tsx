'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
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
  Keyboard
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { ComicPage } from './comic-page'
import { useSwipe } from '@/hooks/use-swipe'
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

// Default hold time for static pages during auto-play (ms)
const STATIC_PAGE_DURATION = 4000

export function ComicViewer({ volume = 'vol1', episode = 'ep2' }: ComicViewerProps) {
  // currentPage is a page INDEX (0-based) — always advances by 1
  const [currentPage, setCurrentPage] = useState(0)
  const [isVideoMode, setIsVideoMode] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [flipDirection, setFlipDirection] = useState<'left' | 'right' | null>(null)
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
  const [forceSinglePage, setForceSinglePage] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const staticAnimFrameRef = useRef<number | null>(null)
  const thumbnailScrollRef = useRef<HTMLDivElement>(null)

  // Handle clicking a page to toggle its audio
  const handlePageAudioFocus = useCallback((pageId: number) => {
    setAudioFocusPageId(prev => prev === pageId ? null : pageId)
  }, [])

  // Fetch comic manifest from API
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/comic?vol=${encodeURIComponent(volume)}&ep=${encodeURIComponent(episode)}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load comic: ${res.statusText}`)
        return res.json()
      })
      .then((data: ComicManifest) => {
        setManifest(data)
        setCurrentPage(0)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [volume, episode])

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const pages = manifest?.pages ?? []
  // Cover page (P0 / id === 0) is always shown solo
  const isCoverPage = pages[currentPage]?.id === 0
  // How many pages to DISPLAY at once (1 or 2)
  const pagesPerView = (isMobile || isFullscreen || forceSinglePage || isCoverPage) ? 1 : 2
  const isSinglePage = pagesPerView === 1
  // Total steps = total pages (always advance 1 at a time)
  const totalSteps = pages.length
  // Clamp currentPage so it doesn't go past the last valid start
  const maxPage = Math.max(0, pages.length - 1)

  const goToNextPage = useCallback(() => {
    if (currentPage < maxPage) {
      setFlipDirection('left')
      setVideoEndedCount(0)
      setTimeout(() => {
        setCurrentPage(prev => Math.min(prev + 1, maxPage))
        setFlipDirection(null)
      }, 150)
    } else if (isAutoPlay) {
      setIsAutoPlay(false)
    }
  }, [currentPage, maxPage, isAutoPlay])

  const goToPrevPage = useCallback(() => {
    if (currentPage > 0) {
      setFlipDirection('right')
      setVideoEndedCount(0)
      setTimeout(() => {
        setCurrentPage(prev => Math.max(prev - 1, 0))
        setFlipDirection(null)
      }, 150)
    }
  }, [currentPage])

  const goToPage = useCallback((pageIndex: number) => {
    setCurrentPage(Math.max(0, Math.min(pageIndex, maxPage)))
    setVideoEndedCount(0)
    setShowThumbnailPanel(false)
  }, [maxPage])

  // Swipe handlers
  const { handlers: swipeHandlers } = useSwipe({
    onSwipeLeft: goToNextPage,
    onSwipeRight: goToPrevPage,
    threshold: 50
  })

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        goToNextPage()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        goToPrevPage()
      } else if (e.key === 'Escape') {
        setIsFullscreen(false)
        setIsAutoPlay(false)
      } else if (e.key === 'f') {
        setIsFullscreen(prev => !prev)
      } else if (e.key === 'v') {
        setIsVideoMode(prev => !prev)
      } else if (e.key === ' ') {
        e.preventDefault()
        setIsAutoPlay(prev => !prev)
      } else if (e.key === 't') {
        setShowThumbnailPanel(prev => !prev)
      } else if (e.key === '?') {
        setShowShortcuts(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToNextPage, goToPrevPage])

  // Current visible pages: starting at currentPage, show pagesPerView
  const currentPages = useMemo(() => {
    return pages.slice(currentPage, Math.min(currentPage + pagesPerView, pages.length))
  }, [pages, currentPage, pagesPerView])

  // Active page indices
  const activePageIndices = useMemo(() => {
    const indices = new Set<number>()
    for (let i = currentPage; i < currentPage + pagesPerView && i < pages.length; i++) {
      indices.add(i)
    }
    return indices
  }, [currentPage, pagesPerView, pages.length])

  // Preload adjacent pages
  const preloadPageIndices = useMemo(() => {
    const indices = new Set<number>()
    // Previous page
    if (currentPage - 1 >= 0 && !activePageIndices.has(currentPage - 1)) {
      indices.add(currentPage - 1)
    }
    // Next pages beyond the current view
    const nextStart = currentPage + pagesPerView
    for (let i = nextStart; i < nextStart + pagesPerView && i < pages.length; i++) {
      if (!activePageIndices.has(i)) indices.add(i)
    }
    return indices
  }, [currentPage, pagesPerView, pages.length, activePageIndices])

  // Count videos on the currently visible pages (the first page drives auto-play)
  const currentPageHasVideo = useMemo(() => {
    if (!isVideoMode) return false
    const page = pages[currentPage]
    return page ? !!page.video : false
  }, [pages, currentPage, isVideoMode])

  // Auto-play logic: only waits for the CURRENT page's video
  useEffect(() => {
    if (!isAutoPlay) {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current)
        autoPlayTimerRef.current = null
      }
      return
    }

    if (currentPageHasVideo) {
      // Wait for the current page's video to end
      if (videoEndedCount < 1) return
      goToNextPage()
      return
    }

    // Static page — use timer
    autoPlayTimerRef.current = setTimeout(() => {
      goToNextPage()
    }, STATIC_PAGE_DURATION)

    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current)
        autoPlayTimerRef.current = null
      }
    }
  }, [isAutoPlay, currentPage, currentPageHasVideo, videoEndedCount, goToNextPage])

  const handleVideoEnded = useCallback(() => {
    setVideoEndedCount(prev => prev + 1)
  }, [])

  // Video progress for segmented bar
  const handleVideoProgress = useCallback((prog: number) => {
    setPageProgress(prog)
  }, [])

  // Reset progress on page change
  useEffect(() => {
    setVideoEndedCount(0)
    setPageProgress(0)
  }, [currentPage])

  // Auto-unmute the current video page during auto-play + motion mode
  useEffect(() => {
    if (isAutoPlay && isVideoMode) {
      const page = pages[currentPage]
      if (page?.video) {
        setAudioFocusPageId(page.id)
      }
    }
  }, [isAutoPlay, isVideoMode, currentPage, pages])

  // Animate static page progress during auto-play
  useEffect(() => {
    if (!isAutoPlay || currentPageHasVideo) {
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
  }, [isAutoPlay, currentPageHasVideo, currentPage])

  // Auto-scroll thumbnail panel to current page
  useEffect(() => {
    if (showThumbnailPanel && thumbnailScrollRef.current) {
      const activeThumb = thumbnailScrollRef.current.querySelector('[data-active="true"]')
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  }, [showThumbnailPanel, currentPage])

  // Progress percentage
  const progress = totalSteps > 0 ? ((currentPage + 1) / totalSteps) * 100 : 0

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading comic…</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !manifest) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-background">
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
        'flex flex-col bg-background transition-all duration-300',
        isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-screen'
      )}
    >
      {/* Header — hidden in fullscreen */}
      {!isFullscreen && (
        <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-lg font-bold text-foreground">{manifest.title}</h1>
              <p className="text-xs text-muted-foreground">
                {manifest.volume} — {manifest.episode} · {pages.length} pages
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-play toggle */}
            <Button
              variant={isAutoPlay ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsAutoPlay(!isAutoPlay)}
              className="gap-2"
              title={isAutoPlay ? 'Pause auto-play (Space)' : 'Auto-play (Space)'}
            >
              {isAutoPlay ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
              <span className="hidden sm:inline">{isAutoPlay ? 'Pause' : 'Auto Play'}</span>
            </Button>

            {/* Mode segmented toggle */}
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setIsVideoMode(false)}
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
                onClick={() => setIsVideoMode(true)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-colors border-l border-border',
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
                  onClick={() => setForceSinglePage(true)}
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
                  onClick={() => setForceSinglePage(false)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-colors border-l border-border',
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

            {/* Fullscreen toggle */}
            <Button
              variant={isFullscreen ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen single-page (F)'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </header>
      )}

      {/* Floating controls in fullscreen */}
      {isFullscreen && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
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
                'flex items-center px-2 py-1.5 transition-colors border-l border-border',
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

      {/* Main viewer area */}
      <main
        className="flex-1 relative overflow-hidden select-none"
        {...swipeHandlers}
      >
        {/* Book wrapper */}
        <div className={cn(
          'absolute flex items-center justify-center',
          isFullscreen ? 'inset-2' : 'inset-4 md:inset-8'
        )}>
          {/* Page spread container */}
          <div
            className={cn(
              'relative flex gap-1 md:gap-2 h-full max-h-[85vh] transition-transform duration-300',
              flipDirection === 'left' && 'animate-flip-left',
              flipDirection === 'right' && 'animate-flip-right'
            )}
            style={{
              aspectRatio: isSinglePage ? '3/4' : '4/3',
              perspective: '2000px'
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
                    isMuted={audioFocusPageId !== page.id}
                    onAudioFocus={() => handlePageAudioFocus(page.id)}
                    onVideoEnded={isAutoPlay ? handleVideoEnded : undefined}
                    onVideoProgress={handleVideoProgress}
                    onToggleMotion={() => setIsVideoMode(false)}
                    autoPlayActive={isAutoPlay}
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

        {/* Navigation buttons */}
        <button
          onClick={goToPrevPage}
          disabled={currentPage === 0}
          className={cn(
            'absolute left-2 md:left-4 top-1/2 -translate-y-1/2 p-2 md:p-3 rounded-full',
            'bg-card/80 backdrop-blur-sm border border-border shadow-lg',
            'text-foreground hover:bg-card hover:scale-110 transition-all',
            'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100'
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
        </button>

        <button
          onClick={goToNextPage}
          disabled={currentPage >= maxPage}
          className={cn(
            'absolute right-2 md:right-4 top-1/2 -translate-y-1/2 p-2 md:p-3 rounded-full',
            'bg-card/80 backdrop-blur-sm border border-border shadow-lg',
            'text-foreground hover:bg-card hover:scale-110 transition-all',
            'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100'
          )}
          aria-label="Next page"
        >
          <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
        </button>

        {/* Page indicator — hidden in fullscreen */}
        {!isFullscreen && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full bg-card/80 backdrop-blur-sm border border-border">
            <span className="text-sm text-foreground font-medium">
              {currentPage + 1}{currentPages.length > 1 ? `–${currentPage + currentPages.length}` : ''} / {pages.length}
            </span>
          </div>
        )}
      </main>

      {/* Segmented progress bar — one segment per page */}
      <div className="flex h-1.5 bg-muted gap-px">
        {pages.map((page, index) => {
          const isPast = index < currentPage
          const isCurrent = index === currentPage
          const hasVideoIndicator = !!page.video

          return (
            <button
              key={page.id}
              className={cn(
                'relative flex-1 h-full cursor-pointer',
                'hover:brightness-125',
                isPast ? 'bg-primary' : 'bg-muted'
              )}
              onClick={() => goToPage(index)}
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
              {hasVideoIndicator && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-foreground/60" />
              )}
            </button>
          )
        })}
      </div>

      {/* Collapsible thumbnail panel — hidden in fullscreen */}
      {!isFullscreen && (
        <div
          className={cn(
            'border-t border-border bg-card/95 backdrop-blur-sm transition-all duration-300 overflow-hidden',
            showThumbnailPanel ? 'max-h-[160px]' : 'max-h-8'
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
              <><ChevronUp className="w-3.5 h-3.5" /><span>Show pages · {currentPage + 1} / {pages.length}</span></>
            )}
          </button>

          {/* Scrollable thumbnails */}
          {showThumbnailPanel && (
            <div
              ref={thumbnailScrollRef}
              className="flex gap-2 px-3 pb-3 overflow-x-auto"
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
                    <img
                      src={page.image}
                      alt={page.title || `Page ${page.id}`}
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

      {/* Keyboard shortcuts button + dialog */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogTrigger asChild>
          <button
            className="absolute bottom-6 right-4 hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-card/80 backdrop-blur-sm border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shadow-sm"
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
        </DialogContent>
      </Dialog>
    </div>
  )
}
