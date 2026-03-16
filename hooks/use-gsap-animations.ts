'use client'

import { useCallback, useRef } from 'react'
import gsap from 'gsap'

// Material Design-inspired easing curves
// Standard: quick acceleration, smooth deceleration (for things entering/moving)
// Decelerate: starts fast, lands gently (for things appearing)
// Accelerate: starts slow, exits fast (for things leaving)
const EASE = {
    standard: 'power2.out',
    decelerate: 'power3.out',
    accelerate: 'power2.in',
    bounce: 'back.out(1.2)',
    smooth: 'power4.out',
    snap: 'power4.out',
} as const

export function useGsapAnimations() {
    const timelineRef = useRef<gsap.core.Timeline | null>(null)

    // Kill any running animation
    const killActive = useCallback(() => {
        if (timelineRef.current) {
            timelineRef.current.kill()
            timelineRef.current = null
        }
    }, [])

    // Page transition — slide + fade with quick landing
    const animatePageTransition = useCallback((
        container: HTMLElement | null,
        direction: 'left' | 'right'
    ) => {
        if (!container) return
        killActive()

        const xFrom = direction === 'left' ? 60 : -60

        timelineRef.current = gsap.timeline()
        timelineRef.current
            .fromTo(container,
                { x: xFrom, opacity: 0.3, scale: 0.97 },
                { x: 0, opacity: 1, scale: 1, duration: 0.4, ease: EASE.smooth }
            )
    }, [killActive])

    // Thumbnail panel slide up + stagger children
    const animateThumbnailPanel = useCallback((panel: HTMLElement | null) => {
        if (!panel) return

        gsap.fromTo(panel,
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.35, ease: EASE.decelerate }
        )

        // Stagger the thumbnail buttons
        const thumbs = panel.querySelectorAll('button')
        if (thumbs.length > 0) {
            gsap.fromTo(thumbs,
                { y: 12, opacity: 0, scale: 0.92 },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    duration: 0.3,
                    stagger: 0.025,
                    ease: EASE.decelerate,
                    delay: 0.1,
                }
            )
        }
    }, [])

    // Chrome header/footer fade in
    const animateChromeIn = useCallback((element: HTMLElement | null) => {
        if (!element) return
        gsap.fromTo(element,
            { y: -10, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.3, ease: EASE.decelerate }
        )
    }, [])

    // Ambient glow crossfade
    const animateGlowTransition = useCallback((element: HTMLElement | null) => {
        if (!element) return
        gsap.fromTo(element,
            { opacity: 0, scale: 1.2 },
            { opacity: 0.5, scale: 1.15, duration: 1.2, ease: EASE.smooth }
        )
    }, [])

    // Page counter number change
    const animatePageNumber = useCallback((element: HTMLElement | null) => {
        if (!element) return
        gsap.fromTo(element,
            { y: -8, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.25, ease: EASE.decelerate }
        )
    }, [])

    // Button press micro-animation
    const animateButtonPress = useCallback((element: HTMLElement | null) => {
        if (!element) return
        gsap.timeline()
            .to(element, { scale: 0.92, duration: 0.1, ease: EASE.accelerate })
            .to(element, { scale: 1, duration: 0.25, ease: EASE.bounce })
    }, [])

    // Progress bar fill animation
    const animateProgressBar = useCallback((element: HTMLElement | null, progress: number) => {
        if (!element) return
        gsap.to(element, {
            width: `${progress}%`,
            duration: 0.4,
            ease: EASE.standard,
        })
    }, [])

    // Stagger fade-in for lists (dropdown items, etc)
    const animateStaggerIn = useCallback((elements: NodeListOf<Element> | HTMLElement[]) => {
        if (!elements || elements.length === 0) return
        gsap.fromTo(elements,
            { y: 8, opacity: 0 },
            {
                y: 0,
                opacity: 1,
                duration: 0.25,
                stagger: 0.04,
                ease: EASE.decelerate,
            }
        )
    }, [])

    // Zoom pop for active indicators
    const animateZoomPop = useCallback((element: HTMLElement | null) => {
        if (!element) return
        gsap.fromTo(element,
            { scale: 0.8, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.3, ease: EASE.bounce }
        )
    }, [])

    return {
        animatePageTransition,
        animateThumbnailPanel,
        animateChromeIn,
        animateGlowTransition,
        animatePageNumber,
        animateButtonPress,
        animateProgressBar,
        animateStaggerIn,
        animateZoomPop,
        killActive,
    }
}
