import { useEffect, useRef, useState } from 'react'

export default function SecondsProgress({
    seconds = 0,
    secondsLeft = 0,
    title = 'seconds_left',
    barColor = 'bg-green-600',
    trackColor = 'bg-gray-300',
}) {
    const total = Number(seconds) || 0
    const [leftMs, setLeftMs] = useState(Math.max(0, Number(secondsLeft) * 1000))
    const lastTsRef = useRef(0)

    useEffect(() => {
        setLeftMs(Math.max(0, Number(secondsLeft) * 1000))
    }, [secondsLeft, seconds])

    useEffect(() => {
        let rafId
        const tick = (ts) => {
            if (!lastTsRef.current) lastTsRef.current = ts
            const delta = ts - lastTsRef.current
            lastTsRef.current = ts
            setLeftMs((prev) => Math.max(0, prev - delta))
            rafId = requestAnimationFrame(tick)
        }
        rafId = requestAnimationFrame(tick)
        return () => {
            if (rafId) cancelAnimationFrame(rafId)
            lastTsRef.current = 0
        }
    }, [])

    const totalMs = Math.max(0, total * 1000)
    const percent = totalMs > 0 ? Math.max(0, Math.min(100, (leftMs / totalMs) * 100)) : 0
    const leftLabel = (leftMs / 1000).toFixed(2)

    return (
        <div>
            <div className="flex items-center justify-between text-xs text-black mb-1">
                <span>{title}</span>
                <span className="font-semibold">{leftLabel}s</span>
            </div>
            <div className={`h-3 w-full rounded ${trackColor} overflow-hidden`}>
                <div className={`h-full ${barColor} transition-all`} style={{ width: `${percent}%` }} />
            </div>
        </div>
    )
}


