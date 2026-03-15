'use client'

import { useState, useRef, useCallback } from 'react'

interface SwipeState {
  startX: number
  startY: number
  deltaX: number
  deltaY: number
  isSwiping: boolean
}

interface UseSwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  threshold?: number
}

export function useSwipe(options: UseSwipeOptions = {}) {
  const { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold = 50 } = options
  
  const [swipeState, setSwipeState] = useState<SwipeState>({
    startX: 0,
    startY: 0,
    deltaX: 0,
    deltaY: 0,
    isSwiping: false
  })
  
  const elementRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    setSwipeState({
      startX: clientX,
      startY: clientY,
      deltaX: 0,
      deltaY: 0,
      isSwiping: true
    })
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!swipeState.isSwiping) return
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    setSwipeState(prev => ({
      ...prev,
      deltaX: clientX - prev.startX,
      deltaY: clientY - prev.startY
    }))
  }, [swipeState.isSwiping])

  const handleTouchEnd = useCallback(() => {
    if (!swipeState.isSwiping) return
    
    const { deltaX, deltaY } = swipeState
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)
    
    // Horizontal swipe
    if (absX > absY && absX > threshold) {
      if (deltaX > 0) {
        onSwipeRight?.()
      } else {
        onSwipeLeft?.()
      }
    }
    // Vertical swipe
    else if (absY > absX && absY > threshold) {
      if (deltaY > 0) {
        onSwipeDown?.()
      } else {
        onSwipeUp?.()
      }
    }
    
    setSwipeState(prev => ({
      ...prev,
      isSwiping: false,
      deltaX: 0,
      deltaY: 0
    }))
  }, [swipeState, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown])

  return {
    ref: elementRef,
    swipeState,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onMouseDown: handleTouchStart,
      onMouseMove: handleTouchMove,
      onMouseUp: handleTouchEnd,
      onMouseLeave: handleTouchEnd
    }
  }
}
