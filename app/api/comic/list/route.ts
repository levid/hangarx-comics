import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

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

export async function GET() {
    const comicDir = path.join(process.cwd(), 'public', 'comic')

    const volumes: VolumeInfo[] = []

    try {
        const volDirs = fs.readdirSync(comicDir)
            .filter(d => fs.statSync(path.join(comicDir, d)).isDirectory() && d.startsWith('vol'))
            .sort()

        for (const vol of volDirs) {
            const volPath = path.join(comicDir, vol)
            const epDirs = fs.readdirSync(volPath)
                .filter(d => fs.statSync(path.join(volPath, d)).isDirectory() && d.startsWith('ep'))
                .sort((a, b) => {
                    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0
                    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0
                    return numA - numB
                })

            const episodes: EpisodeInfo[] = epDirs.map(ep => {
                const epPath = path.join(volPath, ep)
                const files = fs.readdirSync(epPath)
                const pageCount = files.filter(f => /^P\d+\.(jpg|jpeg|png|webp)$/i.test(f)).length
                const epNum = ep.replace(/\D/g, '')
                return {
                    id: ep,
                    label: `Episode ${epNum}`,
                    pageCount
                }
            })

            const volNum = vol.replace(/\D/g, '')
            volumes.push({
                id: vol,
                label: `Volume ${volNum}`,
                episodes
            })
        }
    } catch {
        // Directory may not exist
    }

    return NextResponse.json({ volumes })
}
