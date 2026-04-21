import { motion, AnimatePresence, useAnimate } from "framer-motion"
import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react"

const DOT_D = 10
const DOT_R = DOT_D / 2
const STAGGER = 160
const WORDS = ["XUYUAN", "LIU"]
const TOTAL = WORDS.join("").length
const I_IDX = WORDS[0].length + 1
const BROADCAST_DELAY_MS = 450

const containerStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    zIndex: 9999,
    cursor: "pointer",
    pointerEvents: "all",
    overflow: "hidden",
}

const textContainerStyle: CSSProperties = {
    fontSize: "min(8vw, 56px)",
    fontWeight: 300,
    color: "#fff",
    display: "flex",
    gap: "1.2rem",
    fontFamily: "'Murecho', sans-serif",
    letterSpacing: "0.4em",
    textTransform: "uppercase",
    userSelect: "none",
}

const hintStyle: CSSProperties = {
    position: "absolute",
    bottom: "40px",
    fontSize: "10px",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: "0.1em",
}

export default function LoaderDot() {
    const [isVisible, setIsVisible] = useState(true)
    const [dotRef, animateDot] = useAnimate()
    const letterRefs = useRef<(HTMLSpanElement | null)[]>([])
    const abortRef = useRef(false)
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
    const broadcastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const restoreBodyRef = useRef<(() => void) | null>(null)

    const unlockBody = useCallback(() => {
        restoreBodyRef.current?.()
        restoreBodyRef.current = null
    }, [])

    const exitLoader = useCallback(() => {
        if (abortRef.current) return
        abortRef.current = true
        timersRef.current.forEach(clearTimeout)
        timersRef.current = []

        if (broadcastTimerRef.current) {
            clearTimeout(broadcastTimerRef.current)
        }

        setIsVisible(false)

        broadcastTimerRef.current = setTimeout(() => {
            window.dispatchEvent(new CustomEvent("loaderFinished"))
            broadcastTimerRef.current = null
        }, BROADCAST_DELAY_MS)
    }, [])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") exitLoader()
        }

        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [exitLoader])

    useEffect(() => {
        const originalOverflow = document.body.style.overflow
        const originalTouchAction = document.body.style.touchAction

        document.body.style.overflow = "hidden"
        document.body.style.touchAction = "none"

        restoreBodyRef.current = () => {
            document.body.style.overflow = originalOverflow
            document.body.style.touchAction = originalTouchAction
        }

        return unlockBody
    }, [unlockBody])

    const getLetterCenter = useCallback((idx: number) => {
        const el = letterRefs.current[idx]
        if (!el) return null

        const rect = el.getBoundingClientRect()
        const letterSpacing =
            parseFloat(window.getComputedStyle(el).letterSpacing) || 0

        return {
            x: rect.left + (rect.width - letterSpacing) / 2 - DOT_R,
            y: rect.top - DOT_D - 6,
        }
    }, [])

    useEffect(() => {
        const addTimer = (fn: () => void, ms: number) => {
            const id = setTimeout(fn, ms)
            timersRef.current.push(id)
        }

        const revealLetter = (
            idx: number,
            duration = 0.42
        ) => {
            const el = letterRefs.current[idx]
            if (!el) return

            animateDot(
                el,
                {
                    opacity: [0, 0.5, 1],
                    y: [-32, 4, 0],
                    filter: ["blur(12px)", "blur(5px)", "blur(0px)"],
                    scale: [0.98, 1],
                },
                {
                    duration,
                    times: [0, 0.65, 1],
                    ease: [0.22, 1, 0.36, 1],
                } as any
            )
        }

        const arcOffsets = Array.from({ length: TOTAL }, () => ({
            dx: (Math.random() - 0.5) * 280,
            dy: 120 + Math.random() * 80,
        }))

        for (let i = 0; i < TOTAL; i++) {
            if (i === I_IDX) continue

            const { dx, dy } = arcOffsets[i]
            const t = i * STAGGER + 60

            if (i === 0) {
                addTimer(() => {
                    if (abortRef.current) return
                    const p = getLetterCenter(0)
                    if (!p) return

                    animateDot(
                        dotRef.current,
                        { x: p.x, y: p.y, opacity: 1 },
                        { duration: 0.01 }
                    )
                    revealLetter(0)
                }, t)
                continue
            }

            addTimer(() => {
                if (abortRef.current) return
                const p = getLetterCenter(i)
                if (!p) return

                animateDot(
                    dotRef.current,
                    { x: p.x + dx, y: p.y - dy },
                    { type: "spring", stiffness: 420, damping: 16 } as any
                )
                revealLetter(i)
            }, t)

            addTimer(() => {
                if (abortRef.current) return
                const p = getLetterCenter(i)
                if (!p) return

                animateDot(
                    dotRef.current,
                    { x: p.x, y: p.y },
                    {
                        x: { type: "spring", stiffness: 720, damping: 36 },
                        y: { type: "spring", stiffness: 560, damping: 30 },
                    } as any
                )
            }, t + 90)
        }

        addTimer(async () => {
            if (abortRef.current) return

            revealLetter(I_IDX, 0.5)

            await new Promise<void>((resolve) => {
                const waitId = setTimeout(resolve, 60)
                timersRef.current.push(waitId)
            })
            if (abortRef.current) return

            const p = getLetterCenter(I_IDX)
            if (!p) return

            await animateDot(
                dotRef.current,
                { x: p.x, y: p.y - 110 },
                { type: "spring", stiffness: 560, damping: 22 } as any
            )
            if (abortRef.current) return

            const p2 = getLetterCenter(I_IDX) ?? p

            await animateDot(
                dotRef.current,
                { y: p2.y },
                { type: "spring", stiffness: 680, damping: 18 } as any
            )
            if (abortRef.current) return

            await animateDot(
                dotRef.current,
                { scaleX: 1.35, scaleY: 0.68 },
                { duration: 0.07 }
            )
            await animateDot(
                dotRef.current,
                { scaleX: 1, scaleY: 1 },
                { duration: 0.14, ease: "easeOut" }
            )
            if (abortRef.current) return

            await new Promise<void>((resolve) => {
                const waitId = setTimeout(resolve, 380)
                timersRef.current.push(waitId)
            })
            if (abortRef.current) return

            const el = dotRef.current
            if (!el) return

            const rect = el.getBoundingClientRect()
            const cx = rect.left + DOT_R
            const cy = rect.top + DOT_R
            const maxDist = Math.max(
                Math.hypot(cx, cy),
                Math.hypot(window.innerWidth - cx, cy),
                Math.hypot(cx, window.innerHeight - cy),
                Math.hypot(window.innerWidth - cx, window.innerHeight - cy)
            )

            await animateDot(
                el,
                { scale: (maxDist / DOT_R) * 1.15 },
                {
                    duration: 0.55,
                    ease: [0.55, 0, 0.45, 1],
                }
            )
            if (abortRef.current) return

            exitLoader()
        }, TOTAL * STAGGER + 260)

        addTimer(exitLoader, 5500)

        return () => {
            abortRef.current = true
            timersRef.current.forEach(clearTimeout)
            timersRef.current = []

            if (broadcastTimerRef.current) {
                clearTimeout(broadcastTimerRef.current)
                broadcastTimerRef.current = null
            }
        }
    }, [animateDot, dotRef, exitLoader, getLetterCenter])

    let ci = 0

    return (
        <AnimatePresence onExitComplete={unlockBody}>
            {isVisible && (
                <motion.div
                    key="loader-container"
                    initial={{ y: 0 }}
                    exit={{
                        y: "-100%",
                        transition: { duration: 0.9, ease: [0.82, 0, 0.18, 1] },
                    }}
                    style={containerStyle}
                    onClick={exitLoader}
                >
                    <div
                        ref={dotRef}
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: DOT_D,
                            height: DOT_D,
                            borderRadius: "50%",
                            background: "#fff",
                            opacity: 0,
                            pointerEvents: "none",
                            zIndex: 10,
                        }}
                    />

                    <motion.div
                        style={textContainerStyle}
                        exit={{
                            opacity: 0,
                            y: -20,
                            filter: "blur(6px)",
                            transition: { duration: 0.45 },
                        }}
                    >
                        {WORDS.map((word, wIdx) => (
                            <span key={wIdx} style={{ display: "flex" }}>
                                {word.split("").map((char) => {
                                    const idx = ci++
                                    return (
                                        <motion.span
                                            key={idx}
                                            ref={(el: HTMLSpanElement | null) => {
                                                letterRefs.current[idx] = el
                                            }}
                                            initial={{
                                                opacity: 0,
                                                y: -32,
                                                scale: 0.98,
                                                filter: "blur(12px)",
                                            }}
                                            style={{
                                                display: "inline-block",
                                                willChange: "transform, filter, opacity",
                                            }}
                                        >
                                            {char}
                                        </motion.span>
                                    )
                                })}
                            </span>
                        ))}
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                        transition={{ delay: 1.5 }}
                        style={hintStyle}
                    >
                        CLICK OR ESC TO SKIP
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
