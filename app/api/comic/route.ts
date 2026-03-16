import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { assetUrl } from '@/lib/cdn'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm'])

function extractPageNumber(filename: string): number | null {
    const match = filename.match(/^P(\d+)\./i)
    return match ? parseInt(match[1], 10) : null
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const vol = searchParams.get('vol') || 'vol1'
    const ep = searchParams.get('ep') || 'ep2'

    // Sanitize to prevent directory traversal
    const safeVol = vol.replace(/[^a-zA-Z0-9_-]/g, '')
    const safeEp = ep.replace(/[^a-zA-Z0-9_-]/g, '')

    const publicDir = path.join(process.cwd(), 'public')
    const comicDir = path.join(publicDir, 'comic', safeVol, safeEp)
    const videoDir = path.join(publicDir, 'video', safeVol, safeEp)

    // Read image files
    const imageMap = new Map<number, string>()
    try {
        const comicFiles = fs.readdirSync(comicDir)
        for (const file of comicFiles) {
            const ext = path.extname(file).toLowerCase()
            if (IMAGE_EXTENSIONS.has(ext)) {
                const pageNum = extractPageNumber(file)
                if (pageNum !== null) {
                    imageMap.set(pageNum, assetUrl(`/comic/${safeVol}/${safeEp}/${file}`))
                }
            }
        }
    } catch {
        return NextResponse.json(
            { error: `Comic directory not found: comic/${safeVol}/${safeEp}` },
            { status: 404 }
        )
    }

    // Read video files
    const videoMap = new Map<number, string>()
    try {
        const videoFiles = fs.readdirSync(videoDir)
        for (const file of videoFiles) {
            const ext = path.extname(file).toLowerCase()
            if (VIDEO_EXTENSIONS.has(ext)) {
                const pageNum = extractPageNumber(file)
                if (pageNum !== null) {
                    videoMap.set(pageNum, assetUrl(`/video/${safeVol}/${safeEp}/${file}`))
                }
            }
        }
    } catch {
        // Video directory may not exist — that's fine, just no videos
    }

    // Build sorted pages array
    const pageNumbers = Array.from(imageMap.keys()).sort((a, b) => a - b)
    const pages = pageNumbers.map((num) => ({
        id: num,
        image: imageMap.get(num)!,
        video: videoMap.get(num) || null,
        title: `Page ${num}`,
    }))

    return NextResponse.json({
        title: `${safeVol.toUpperCase()} — ${safeEp.toUpperCase()}`,
        volume: safeVol,
        episode: safeEp,
        pages,
    })
}
