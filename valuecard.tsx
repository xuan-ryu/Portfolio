import * as React from "react"
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

type Props = {
    title: string
    subtitle: string
    bodyText: string
}

export default function ProductionVibeCardv2({
    title = "THE COMPASS",
    subtitle = "DISTILLING SIGNALS INTO DIRECTION",
    bodyText = "I look for the 'why' before the 'how.' By blending deep user empathy with AI-assisted pattern recognition, I filter through the noise to uncover true user needs—ensuring our next move is intentional, not just reactive.",
}: Props) {
    const cardRef = useRef<HTMLDivElement>(null)
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    useEffect(() => {
        const el = cardRef.current
        if (!el) return

        // Entry reveal — double-RAF ensures CSS opacity:0 has painted before animation fires
        if (isCanvas) {
            el.classList.add("card-revealed")
        } else {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    el.classList.add("card-revealed")
                })
            })
        }

        // RAF-throttled mouse handler — avoids layout thrash on fast moves
        let raf = 0

        const onMove = (e: MouseEvent) => {
            if (raf) return
            raf = requestAnimationFrame(() => {
                raf = 0
                const rect = el.getBoundingClientRect()
                const x = e.clientX - rect.left
                const y = e.clientY - rect.top
                const cx = rect.width / 2
                const cy = rect.height / 2
                const nx = (x - cx) / cx  // -1 to 1
                const ny = (y - cy) / cy  // -1 to 1
                el.style.setProperty("--x", `${x}px`)
                el.style.setProperty("--y", `${y}px`)
                el.style.setProperty("--rotX", `${-ny * 4}deg`)
                el.style.setProperty("--rotY", `${nx * 4}deg`)
                // Magnetic translate: card drifts toward cursor (±6px)
                el.style.setProperty("--tx", `${nx * 6}px`)
                el.style.setProperty("--ty", `${ny * 6}px`)
                el.style.setProperty("--active", "1")
            })
        }

        const onLeave = () => {
            if (raf) { cancelAnimationFrame(raf); raf = 0 }
            el.style.setProperty("--rotX", "0deg")
            el.style.setProperty("--rotY", "0deg")
            el.style.setProperty("--tx", "0px")
            el.style.setProperty("--ty", "0px")
            el.style.setProperty("--x", "50%")
            el.style.setProperty("--y", "50%")
            el.style.setProperty("--active", "0")
        }

        // Press feedback
        const onDown = () => el.style.setProperty("--pressed", "1")
        const onUp   = () => el.style.setProperty("--pressed", "0")

        // Touch tilt — same calculation as mouse
        const onTouch = (e: TouchEvent) => {
            if (raf) return
            const touch = e.touches[0]
            if (!touch) return
            raf = requestAnimationFrame(() => {
                raf = 0
                const rect = el.getBoundingClientRect()
                const x = touch.clientX - rect.left
                const y = touch.clientY - rect.top
                const cx = rect.width / 2
                const cy = rect.height / 2
                const nx = (x - cx) / cx
                const ny = (y - cy) / cy
                el.style.setProperty("--x", `${x}px`)
                el.style.setProperty("--y", `${y}px`)
                el.style.setProperty("--rotX", `${-ny * 4}deg`)
                el.style.setProperty("--rotY", `${nx * 4}deg`)
                el.style.setProperty("--tx", `${nx * 6}px`)
                el.style.setProperty("--ty", `${ny * 6}px`)
                el.style.setProperty("--active", "1")
            })
        }
        const onTouchEnd = () => {
            if (raf) { cancelAnimationFrame(raf); raf = 0 }
            el.style.setProperty("--rotX", "0deg")
            el.style.setProperty("--rotY", "0deg")
            el.style.setProperty("--tx", "0px")
            el.style.setProperty("--ty", "0px")
            el.style.setProperty("--x", "50%")
            el.style.setProperty("--y", "50%")
            el.style.setProperty("--active", "0")
        }

        el.addEventListener("mousemove", onMove, { passive: true })
        el.addEventListener("mouseleave", onLeave)
        el.addEventListener("mousedown", onDown)
        el.addEventListener("mouseup", onUp)
        el.addEventListener("touchmove", onTouch, { passive: true })
        el.addEventListener("touchend", onTouchEnd)
        el.addEventListener("touchcancel", onTouchEnd)

        return () => {
            if (raf) cancelAnimationFrame(raf)
            el.removeEventListener("mousemove", onMove)
            el.removeEventListener("mouseleave", onLeave)
            el.removeEventListener("mousedown", onDown)
            el.removeEventListener("mouseup", onUp)
            el.removeEventListener("touchmove", onTouch)
            el.removeEventListener("touchend", onTouchEnd)
            el.removeEventListener("touchcancel", onTouchEnd)
        }
    // isCanvas 来自 RenderTarget.current()，在 Framer 中每次渲染结果固定，不会变化，故安全省略
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div style={{
            perspective: "1500px",
            WebkitPerspective: "1500px",
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
        }}>
            <div
                ref={cardRef}
                className={isCanvas ? undefined : "vibe-card"}
                style={{
                    width: "100%",
                    height: "100%",
                    maxWidth: "480px",
                    position: "relative",
                    borderRadius: "clamp(24px, 4vw, 32px)",
                    padding: "clamp(32px, 6vw, 48px) clamp(28px, 5vw, 42px)",
                    overflow: "hidden",
                    cursor: "pointer",
                    boxSizing: "border-box",

                    background: "rgba(16, 16, 16, 0.5)",
                    backdropFilter: "blur(28px) saturate(130%) contrast(1.1)",
                    WebkitBackdropFilter: "blur(28px) saturate(130%) contrast(1.1)",

                    boxShadow: "0 24px 60px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.15)",

                    transformStyle: "preserve-3d",
                    WebkitTransformStyle: "preserve-3d",
                    transform: "translateX(var(--tx)) translateY(var(--ty)) rotateX(var(--rotX)) rotateY(var(--rotY)) scale(calc(1 + var(--active) * 0.02 - var(--pressed) * 0.03))",
                    transition: isCanvas ? "none" : "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                    willChange: "transform",

                    ...({
                        "--x": "50%",
                        "--y": "50%",
                        "--rotX": "0deg",
                        "--rotY": "0deg",
                        "--tx": "0px",
                        "--ty": "0px",
                        "--active": "0",
                        "--pressed": "0",
                    } as React.CSSProperties),
                }}
            >
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Murecho:wght@100..900&display=swap');

                    /* Entry animation */
                    @keyframes cardReveal {
                        from { opacity: 0; transform: translateY(14px) scale(0.97); }
                        to   { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    .vibe-card { opacity: 0; }
                    .vibe-card.card-revealed {
                        animation: cardReveal 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }

                    /* Rim light — follows cursor */
                    .production-glow::before {
                        content: '';
                        position: absolute;
                        inset: 0;
                        border-radius: inherit;
                        padding: 1px;
                        background: radial-gradient(
                            150% circle at var(--x) var(--y),
                            rgba(255, 255, 255, 0.45),
                            transparent 35%
                        ), rgba(255, 255, 255, 0.06);
                        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                        -webkit-mask-composite: xor;
                        mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                        mask-composite: exclude;
                        pointer-events: none;
                        z-index: 10;
                    }

                    /* Internal spotlight */
                    .production-glow::after {
                        content: '';
                        position: absolute;
                        inset: 0;
                        background: radial-gradient(
                            120% circle at var(--x) var(--y),
                            rgba(255, 255, 255, 0.04),
                            transparent 50%
                        );
                        opacity: var(--active);
                        transition: opacity 0.5s ease;
                        pointer-events: none;
                        z-index: -1;
                    }

                    /* Text lift on hover */
                    .text-bloom {
                        opacity: calc(0.8 + var(--active) * 0.2);
                        transform: translateY(calc(1px - var(--active) * 1px));
                        transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                    }

                    /* Subtitle vertical bar — scaleY animates on hover */
                    .vibe-sub-bar {
                        width: 2px;
                        align-self: stretch;
                        flex-shrink: 0;
                        background: rgba(255, 255, 255, 0.25);
                        margin-right: 12px;
                        transform-origin: top;
                        transform: scaleY(calc(0.35 + var(--active) * 0.65));
                        transition: transform 0.55s cubic-bezier(0.16, 1, 0.3, 1);
                    }

                    /* Grain texture */
                    .vibe-grain {
                        position: absolute;
                        inset: 0;
                        pointer-events: none;
                        z-index: 1;
                        opacity: 0.035;
                        border-radius: inherit;
                        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
                    }
                `}</style>

                {/* Grain texture */}
                <div className="vibe-grain" />

                {/* Rim light + internal spotlight */}
                <div className="production-glow" style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: "inherit" }} />

                {/* Content */}
                <div style={{
                    position: "relative",
                    zIndex: 2,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "clamp(20px, 4vw, 28px)"
                }}>
                    <h3 style={{
                        margin: 0,
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: "clamp(24px, 5vw, 32px)",
                        fontWeight: 400,
                        letterSpacing: "0.06em",
                        color: "#FFFFFF",
                        textTransform: "uppercase",
                        textShadow: "none",
                    }}>
                        {title}
                    </h3>

                    <div style={{ display: "flex", alignItems: "center" }}>
                        <span className="vibe-sub-bar" />
                        <span style={{
                            fontFamily: "'Murecho', sans-serif",
                            fontSize: "11px",
                            fontWeight: 400,
                            letterSpacing: "0.15em",
                            color: "rgba(255, 255, 255, 0.85)",
                            textTransform: "uppercase",
                            textShadow: "none",
                        }}>
                            {subtitle}
                        </span>
                    </div>

                    <p className="text-bloom" style={{
                        margin: 0,
                        fontFamily: "'Murecho', sans-serif",
                        fontSize: "clamp(13px, 3vw, 15px)",
                        fontWeight: 300,
                        lineHeight: 1.7,
                        color: "rgba(255, 255, 255, 0.95)",
                        textShadow: "none",
                        willChange: "opacity, transform",
                    }}>
                        {bodyText}
                    </p>
                </div>
            </div>
        </div>
    )
}

addPropertyControls(ProductionVibeCardv2, {
    title: { type: ControlType.String, title: "Title" },
    subtitle: { type: ControlType.String, title: "Subtitle" },
    bodyText: { type: ControlType.String, title: "Body Text", displayTextArea: true },
})
