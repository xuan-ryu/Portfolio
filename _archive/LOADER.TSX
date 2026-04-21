import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react"

const AUTO_EXIT_DELAY_MS = 2700
const BROADCAST_DELAY_MS = 450
const NAME_WORDS = ["XUYUAN", "LIU"]

const containerStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
    zIndex: 9999,
    cursor: "pointer",
}

const textContainerStyle: CSSProperties = {
    fontSize: "min(8vw, 56px)",
    fontWeight: 300,
    color: "#FFFFFF",
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

export default function EfficientLoader() {
    const [isVisible, setIsVisible] = useState(true)
    const isExitingRef = useRef(false)
    const autoExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const broadcastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const restoreBodyRef = useRef<(() => void) | null>(null)

    const unlockBody = useCallback(() => {
        restoreBodyRef.current?.()
        restoreBodyRef.current = null
    }, [])

    const exitLoader = useCallback(() => {
        if (isExitingRef.current) return
        isExitingRef.current = true

        if (autoExitTimerRef.current) {
            clearTimeout(autoExitTimerRef.current)
            autoExitTimerRef.current = null
        }

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
        autoExitTimerRef.current = setTimeout(exitLoader, AUTO_EXIT_DELAY_MS)

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") exitLoader()
        }

        window.addEventListener("keydown", handleKeyDown)

        return () => {
            if (autoExitTimerRef.current) {
                clearTimeout(autoExitTimerRef.current)
                autoExitTimerRef.current = null
            }
            if (broadcastTimerRef.current) {
                clearTimeout(broadcastTimerRef.current)
                broadcastTimerRef.current = null
            }
            window.removeEventListener("keydown", handleKeyDown)
            unlockBody()
        }
    }, [exitLoader, unlockBody])

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
                    <motion.div
                        style={textContainerStyle}
                        exit={{
                            opacity: 0,
                            y: -20,
                            filter: "blur(6px)",
                            transition: { duration: 0.45 },
                        }}
                    >
                        {(() => {
                            let charIndex = 0

                            return NAME_WORDS.map((word, wordIndex) => (
                                <span
                                    key={word}
                                    style={{ display: "flex", gap: 0 }}
                                >
                                    {word.split("").map((char) => {
                                        const currentIndex = charIndex++

                                        return (
                                            <motion.span
                                                key={`${wordIndex}-${currentIndex}-${char}`}
                                                initial={{
                                                    opacity: 0,
                                                    y: -32,
                                                    filter: "blur(12px)",
                                                }}
                                                animate={{
                                                    opacity: [0, 0.5, 1],
                                                    y: [-32, 4, 0],
                                                    filter: [
                                                        "blur(12px)",
                                                        "blur(5px)",
                                                        "blur(0px)",
                                                    ],
                                                }}
                                                transition={{
                                                    duration: 0.52,
                                                    times: [0, 0.65, 1],
                                                    ease: [0.22, 1, 0.36, 1],
                                                    delay:
                                                        currentIndex * 0.09 + 0.18,
                                                }}
                                                style={{
                                                    display: "inline-block",
                                                    willChange:
                                                        "transform, filter, opacity",
                                                }}
                                            >
                                                {char}
                                            </motion.span>
                                        )
                                    })}
                                </span>
                            ))
                        })()}
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                        transition={{ delay: 1 }}
                        style={hintStyle}
                    >
                        CLICK OR ESC TO SKIP
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
