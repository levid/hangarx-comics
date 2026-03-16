'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Play, Info, Volume2, VolumeX } from 'lucide-react'
import type { ComicPage as ComicPageType, InteractiveElement } from '@/lib/comic-data'
import { cn } from '@/lib/utils'

interface ComicPageProps {
  page: ComicPageType
  isVideoMode: boolean
  isActive: boolean
  shouldPreload: boolean
  isMuted?: boolean
  onAudioFocus?: () => void
  onVideoEnded?: () => void
  onVideoProgress?: (progress: number) => void
  onToggleMotion?: () => void
  autoPlayActive?: boolean
  className?: string
}

function InteractiveHotspot({ element, onClick }: { element: InteractiveElement; onClick: () => void }) {
  const [isHovered, setIsHovered] = useState(false)

  const IconComponent = {
    'play-sound': Volume2,
    'show-info': Info,
    'zoom': Play
  }[element.action || 'show-info']

  return (
    <button
      className={cn(
        'absolute rounded-lg border-2 border-primary/50 transition-all duration-300 cursor-pointer',
        'hover:border-primary hover:bg-primary/20',
        isHovered && 'bg-primary/30 scale-105'
      )}
      style={{
        left: `${element.x}%`,
        top: `${element.y}%`,
        width: `${element.width}%`,
        height: `${element.height}%`
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      aria-label={element.content}
    >
      <div className={cn(
        'absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-md',
        'bg-card/90 backdrop-blur-sm text-xs text-foreground opacity-0 transition-opacity',
        isHovered && 'opacity-100'
      )}>
        <IconComponent className="w-3 h-3" />
        <span className="whitespace-nowrap">Click to interact</span>
      </div>
    </button>
  )
}

export function ComicPage({ page, isVideoMode, isActive, shouldPreload, isMuted = true, onAudioFocus, onVideoEnded, onVideoProgress, onToggleMotion, autoPlayActive = false, className }: ComicPageProps) {
  const [showPopup, setShowPopup] = useState<string | null>(null)
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const hasVideo = !!page.video
  const showVideo = isVideoMode && hasVideo

  // Control video playback based on isActive
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (showVideo && isActive) {
      // Reset to start when entering the page (for auto-play replays)
      video.currentTime = 0
      video.play().catch(() => {
        // Autoplay may be blocked; that's ok
      })
    } else {
      // Pause when not active or not in video mode
      video.pause()
    }
  }, [showVideo, isActive])

  // Wire up the onended handler for auto-play
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleEnded = () => {
      onVideoEnded?.()
    }

    if (autoPlayActive && showVideo && isActive) {
      video.addEventListener('ended', handleEnded)
    }

    return () => {
      video.removeEventListener('ended', handleEnded)
    }
  }, [autoPlayActive, showVideo, isActive, onVideoEnded])

  // Report video progress for animated progress bar
  useEffect(() => {
    const video = videoRef.current
    if (!video || !showVideo || !isActive || !onVideoProgress) return

    const handleTimeUpdate = () => {
      if (video.duration && video.duration > 0) {
        onVideoProgress(video.currentTime / video.duration)
      }
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => video.removeEventListener('timeupdate', handleTimeUpdate)
  }, [showVideo, isActive, onVideoProgress])

  // Sync muted state to video element
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = isMuted
  }, [isMuted])

  const handleInteraction = (element: InteractiveElement) => {
    setShowPopup(element.id)
    setTimeout(() => setShowPopup(null), 3000)
  }

  const activeElement = page.interactiveElements?.find(el => el.id === showPopup)

  return (
    <div className={cn(
      'relative w-full h-full bg-card overflow-hidden rounded-sm',
      'shadow-[0_0_20px_rgba(0,0,0,0.5)]',
      className
    )}>
      {/* Page content */}
      <div className="relative w-full h-full">
        {showVideo ? (
          /* Motion mode — real video playback */
          <div
            className="relative w-full h-full bg-muted cursor-pointer"
            onClick={onAudioFocus}
            role="button"
            tabIndex={0}
            aria-label={isMuted ? 'Click to unmute' : 'Click to mute'}
          >
            {/* Static image as background / poster fallback */}
            <Image
              src={page.image}
              alt={page.title || `Page ${page.id}`}
              fill
              className="object-contain md:object-cover"
              priority
            />
            {/* Video overlay */}
            <video
              ref={videoRef}
              src={page.video!}
              poster={page.image}
              muted={isMuted}
              loop={!autoPlayActive}
              playsInline
              preload={isActive || shouldPreload ? 'auto' : 'none'}
              className="absolute inset-0 w-full h-full object-contain md:object-cover z-[1]"
            />
            {/* Audio state indicator */}
            <button
              className="absolute top-2 right-2 sm:top-4 sm:right-4 flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full bg-background/70 backdrop-blur-sm text-foreground text-[10px] sm:text-xs z-[2] hover:bg-background/90 transition-colors"
              onClick={(e) => { e.stopPropagation(); onAudioFocus?.() }}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <><VolumeX className="w-3.5 h-3.5" /><span>Click for audio</span></>
              ) : (
                <><Volume2 className="w-3.5 h-3.5 text-primary" /><span>Playing</span></>
              )}
            </button>

          </div>
        ) : shouldPreload && hasVideo ? (
          /* Preload-only: render offscreen video for caching + show the static image */
          <>
            <Image
              src={page.image}
              alt={page.title || `Page ${page.id}`}
              fill
              className={cn(
                'object-contain md:object-cover transition-opacity duration-500',
                isImageLoaded ? 'opacity-100' : 'opacity-0'
              )}
              onLoad={() => setIsImageLoaded(true)}
              priority={false}
            />
            {/* Hidden preload video */}
            <video
              src={page.video!}
              muted
              preload="auto"
              className="absolute w-0 h-0 opacity-0 pointer-events-none"
              tabIndex={-1}
              aria-hidden
            />
            {!isImageLoaded && (
              <div className="absolute inset-0 bg-muted animate-pulse" />
            )}
          </>
        ) : (
          /* Static mode */
          <>
            <Image
              src={page.image}
              alt={page.title || `Page ${page.id}`}
              fill
              className={cn(
                'object-contain md:object-cover transition-opacity duration-500',
                isImageLoaded ? 'opacity-100' : 'opacity-0'
              )}
              onLoad={() => setIsImageLoaded(true)}
              priority
            />

            {/* Loading skeleton */}
            {!isImageLoaded && (
              <div className="absolute inset-0 bg-muted animate-pulse" />
            )}

            {/* Interactive elements */}
            {isImageLoaded && page.interactiveElements?.map(element => (
              <InteractiveHotspot
                key={element.id}
                element={element}
                onClick={() => handleInteraction(element)}
              />
            ))}
          </>
        )}
      </div>

      {/* Info popup */}
      {activeElement && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[80%] px-4 py-3 rounded-lg bg-card/95 backdrop-blur-md border border-border shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <p className="text-sm text-foreground">{activeElement.content}</p>
        </div>
      )}

      {/* Page number indicator */}
      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-background/80 text-xs text-muted-foreground z-[3]">
        {page.id}
      </div>
    </div>
  )
}
