import * as React from "react"
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

type Props = {
    imageSrc: string
    eyebrow: string
    titleLine1: string
    titleLine2: string
    titleZh: string
    subtitle: string
    hint: string
    scrollDemo: number
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value))
}

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t
}

function smoothstep(edge0: number, edge1: number, x: number) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)
}

function hash(n: number) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123
    return s - Math.floor(s)
}

function mixColor(
    from: [number, number, number, number],
    to: [number, number, number, number],
    t: number
) {
    return `rgba(${Math.round(lerp(from[0], to[0], t))}, ${Math.round(
        lerp(from[1], to[1], t)
    )}, ${Math.round(lerp(from[2], to[2], t))}, ${lerp(
        from[3],
        to[3],
        t
    ).toFixed(3)})`
}

function setStyleIfChanged(
    el: HTMLElement | null,
    property: string,
    value: string
) {
    if (!el) return
    if ((el.style as any)[property] !== value) {
        ;(el.style as any)[property] = value
    }
}

function tokenizeRevealLine(line: string) {
    const normalized = line.replace(/\s+/g, " ").trim()
    if (!normalized) return []
    if (/\s/.test(normalized)) return normalized.split(" ")
    if (/[\u3400-\u9fff]/.test(normalized)) return Array.from(normalized)
    return [normalized]
}

function renderRevealText(text: string) {
    const lines = text.split("\n")
    let wordIndex = 0

    return lines.map((line, lineIndex) => {
        const tokens = tokenizeRevealLine(line)

        return (
            <React.Fragment key={`${line}-${lineIndex}`}>
                <span className="hyf-reveal-line">
                    {tokens.map((token, tokenIndex) => {
                        const currentIndex = wordIndex++
                        return (
                            <React.Fragment
                                key={`${token}-${lineIndex}-${tokenIndex}`}
                            >
                                <span
                                    className="hyf-reveal-word"
                                    style={
                                        {
                                            ["--word-index" as any]:
                                                currentIndex,
                                        } as React.CSSProperties
                                    }
                                >
                                    {token}
                                </span>
                                {tokenIndex < tokens.length - 1 ? " " : null}
                            </React.Fragment>
                        )
                    })}
                </span>
                {lineIndex < lines.length - 1 ? <br /> : null}
            </React.Fragment>
        )
    })
}

type ImageParticle = {
    x: number
    y: number
    ox: number
    oy: number
    z: number
    twinkle: number
    radius: number
    alpha: number
    luma: number
    sr: number
    sg: number
    sb: number
}

type Mote = {
    x: number
    y: number
    vy: number
    r: number
    a: number
    warm: boolean
}

/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function HongyadongFramer(props: Props) {
    const {
        imageSrc,
        eyebrow,
        titleLine1,
        titleLine2,
        titleZh,
        subtitle,
        hint,
        scrollDemo,
    } = props

    const rootRef = useRef<HTMLDivElement>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const glowCanvasRef = useRef<HTMLCanvasElement>(null)
    const sourceImageRef = useRef<HTMLImageElement>(null)
    const topRef = useRef<HTMLDivElement>(null)
    const bottomRef = useRef<HTMLDivElement>(null)
    const eyebrowRef = useRef<HTMLDivElement>(null)
    const hintRef = useRef<HTMLDivElement>(null)
    const titleRef = useRef<HTMLHeadingElement>(null)
    const zhRef = useRef<HTMLDivElement>(null)
    const subRef = useRef<HTMLParagraphElement>(null)
    const scrollDemoRef = useRef(scrollDemo)

    useEffect(() => {
        scrollDemoRef.current = scrollDemo
    }, [scrollDemo])

    useEffect(() => {
        const rootEl = rootRef.current
        const stageEl = stageRef.current
        const canvasEl = canvasRef.current
        const glowCanvasEl = glowCanvasRef.current
        const sourceImageEl = sourceImageRef.current
        const ctx = canvasEl?.getContext("2d")
        const glowCtx = glowCanvasEl?.getContext("2d")

        if (
            !rootEl ||
            !stageEl ||
            !canvasEl ||
            !glowCanvasEl ||
            !ctx ||
            !glowCtx ||
            !sourceImageEl
        ) {
            return
        }

        const offscreen = document.createElement("canvas")
        const offCtx = offscreen.getContext("2d", { willReadFrequently: true })
        if (!offCtx) return

        const isCanvas = RenderTarget.current() === RenderTarget.canvas
        const touchCapable = "ontouchstart" in window
        const cores = navigator.hardwareConcurrency || 2
        const mem = (navigator as any).deviceMemory || 4

        let tier = cores >= 8 && mem >= 4 ? 2 : cores >= 4 ? 1 : 0
        let W = 0
        let H = 0
        let currentScrollPx = 0
        let smoothY = 0
        let mouseX = -9999
        let mouseY = -9999
        let smoothMX = -9999
        let smoothMY = -9999
        let rafId = 0
        let resizeTimer = 0
        let imageParticles: ImageParticle[] = []
        let motes: Mote[] = []
        let slowFrames = 0
        let lastNow = 0
        let copyVisible = false
        let titleReadyFrame = 0

        const TIER_CFG = [
            {
                sampleLong: 200,
                sampleLongMax: 260,
                dprCap: 1,
                glowOn: false,
                moteCount: 0,
            },
            {
                sampleLong: 340,
                sampleLongMax: 500,
                dprCap: 1.5,
                glowOn: true,
                moteCount: 24,
            },
            {
                sampleLong: 500,
                sampleLongMax: 680,
                dprCap: 2,
                glowOn: true,
                moteCount: 40,
            },
        ]

        const COPY_REVEAL_THRESHOLD = 0.24

        const syncUIText = (progress: number) => {
            const textT = smoothstep(0.12, 0.48, progress)
            setStyleIfChanged(
                topRef.current,
                "color",
                mixColor([0, 0, 0, 0.52], [255, 255, 255, 0.82], textT)
            )
            setStyleIfChanged(
                bottomRef.current,
                "color",
                mixColor([0, 0, 0, 0.44], [255, 255, 255, 0.78], textT)
            )
            setStyleIfChanged(
                eyebrowRef.current,
                "color",
                mixColor([0, 0, 0, 0.52], [255, 255, 255, 0.82], textT)
            )
            setStyleIfChanged(
                hintRef.current,
                "color",
                mixColor([0, 0, 0, 0.44], [255, 255, 255, 0.78], textT)
            )
            setStyleIfChanged(
                titleRef.current,
                "color",
                mixColor([0, 0, 0, 0.95], [255, 255, 255, 0.98], textT)
            )
            setStyleIfChanged(
                zhRef.current,
                "color",
                mixColor([0, 0, 0, 0.42], [255, 255, 255, 0.72], textT)
            )
            setStyleIfChanged(
                subRef.current,
                "color",
                mixColor([0, 0, 0, 0.5], [255, 255, 255, 0.8], textT)
            )

            const shouldShowCopy = progress >= COPY_REVEAL_THRESHOLD
            if (shouldShowCopy !== copyVisible) {
                copyVisible = shouldShowCopy
                ;[
                    eyebrowRef.current,
                    zhRef.current,
                    subRef.current,
                    hintRef.current,
                ].forEach((el) => {
                    el?.classList.toggle("is-visible", shouldShowCopy)
                })
            }
        }

        const buildMotes = () => {
            motes = Array.from(
                { length: TIER_CFG[tier].moteCount },
                (_, i): Mote => ({
                    x: hash(i * 3 + 1) * W,
                    y: hash(i * 3 + 2) * H,
                    vy: 0.18 + hash(i * 3 + 3) * 0.32,
                    r: 0.6 + hash(i * 7 + 1) * 1.8,
                    a: 0.18 + hash(i * 7 + 2) * 0.44,
                    warm: hash(i * 7 + 3) > 0.72,
                })
            )
        }

        const getTargetSampleLong = () => {
            const cfg = TIER_CFG[tier]
            const isMobile = W < 768 || touchCapable
            const baseLong = isMobile
                ? Math.round(cfg.sampleLong * 0.68)
                : cfg.sampleLong

            if (isMobile) return baseLong

            const referenceArea = 1440 * 900
            const viewportArea = Math.max(W * H, 1)
            const areaBoost = clamp(
                Math.sqrt(viewportArea / referenceArea),
                1,
                1.32
            )
            const wideBoost = clamp(
                Math.sqrt(W / Math.max(H, 1) / (16 / 10)),
                1,
                1.08
            )

            return Math.round(
                clamp(
                    baseLong * areaBoost * wideBoost,
                    baseLong,
                    cfg.sampleLongMax
                )
            )
        }

        const getCoverCrop = (
            imageWidth: number,
            imageHeight: number,
            frameWidth: number,
            frameHeight: number,
            positionY = 0.6
        ) => {
            const scale = Math.max(
                frameWidth / imageWidth,
                frameHeight / imageHeight
            )
            const drawWidth = imageWidth * scale
            const drawHeight = imageHeight * scale
            const offsetX = (frameWidth - drawWidth) * 0.5
            const offsetY = (frameHeight - drawHeight) * positionY
            return { drawWidth, drawHeight, offsetX, offsetY }
        }

        const buildImageParticles = () => {
            imageParticles = []
            if (
                !sourceImageEl.complete ||
                !sourceImageEl.naturalWidth ||
                !sourceImageEl.naturalHeight
            ) {
                return
            }

            const isMobile = W < 768 || touchCapable
            const sampleLong = getTargetSampleLong()
            const aspect = W / Math.max(H, 1)
            const sampleWidth =
                aspect >= 1 ? sampleLong : Math.round(sampleLong * aspect)
            const sampleHeight =
                aspect >= 1 ? Math.round(sampleLong / aspect) : sampleLong
            const uScale = W / Math.max(sampleWidth, 1)

            offscreen.width = sampleWidth
            offscreen.height = sampleHeight
            offCtx.clearRect(0, 0, sampleWidth, sampleHeight)

            const crop = getCoverCrop(
                sourceImageEl.naturalWidth,
                sourceImageEl.naturalHeight,
                sampleWidth,
                sampleHeight
            )

            offCtx.drawImage(
                sourceImageEl,
                crop.offsetX,
                crop.offsetY,
                crop.drawWidth,
                crop.drawHeight
            )

            let imageData: Uint8ClampedArray
            try {
                imageData = offCtx.getImageData(
                    0,
                    0,
                    sampleWidth,
                    sampleHeight
                ).data
            } catch {
                return
            }

            for (let y = 0; y < sampleHeight; y += 1) {
                for (let x = 0; x < sampleWidth; x += 1) {
                    const idx = (y * sampleWidth + x) * 4
                    const r = imageData[idx]
                    const g = imageData[idx + 1]
                    const b = imageData[idx + 2]
                    const a = imageData[idx + 3] / 255
                    if (a < 0.02) continue

                    const luma =
                        (r * 0.299 + g * 0.587 + b * 0.114) / 255
                    const sid = x * 0.173 + y * 0.247
                    const warmHit = r > 155 && g > 75
                    const coolHit = b > 125
                    const minLuma = warmHit ? 0.05 : coolHit ? 0.07 : 0.09
                    if (luma < minLuma) continue

                    const importance =
                        0.14 +
                        Math.pow(Math.max(luma, 0.02), 1.05) +
                        (warmHit ? 0.18 : 0) +
                        (coolHit ? 0.1 : 0)

                    if (
                        hash(sid + 19) >
                        Math.min(0.99, importance * 1.35 + 0.1)
                    ) {
                        continue
                    }

                    const luma8 = Math.round(luma * 255)
                    const rFinal = warmHit
                        ? Math.min(255, Math.round(r * 1.08))
                        : r
                    const SAT = 1.6
                    const sat = (v: number) =>
                        Math.max(
                            0,
                            Math.min(
                                255,
                                Math.round(luma8 + (v - luma8) * SAT)
                            )
                        )

                    imageParticles.push({
                        x: x * uScale,
                        y: y * uScale,
                        ox: (hash(sid + 7) - 0.5) * uScale * 0.45,
                        oy: (hash(sid + 11) - 0.5) * uScale * 0.45,
                        z:
                            0.08 +
                            (y / sampleHeight) * 0.84 +
                            hash(sid + 23) * 0.08,
                        twinkle: hash(sid + 31) * Math.PI * 2,
                        radius:
                            (1.2 + luma * 1.6 + hash(sid + 41) * 0.6) *
                            (isMobile ? 0.85 : 1.0),
                        alpha: clamp(0.82 + luma * 0.16, 0.82, 0.98),
                        luma,
                        sr: sat(rFinal),
                        sg: sat(g),
                        sb: sat(b),
                    })
                }
            }
        }

        const drawMotes = (drift: number) => {
            for (const p of motes) {
                p.y -= p.vy
                if (p.y < -10) {
                    p.y = H + 10
                    p.x = Math.random() * W
                }

                const edge =
                    Math.min(p.y / (H * 0.18), 1) *
                    Math.min((H - p.y) / (H * 0.14), 1)
                const alpha = p.a * Math.max(0, edge)
                if (alpha < 0.015) continue

                const blackAmount = 1 - drift
                const colorAmount = drift
                let r = 0
                let g = 0
                let b = 0

                if (p.warm) {
                    r = Math.round(255 * colorAmount)
                    g = Math.round(195 * colorAmount)
                    b = Math.round(62 * colorAmount)
                } else {
                    r = Math.round(210 * colorAmount)
                    g = Math.round(228 * colorAmount)
                    b = Math.round(255 * colorAmount)
                }

                ctx.fillStyle = `rgba(${Math.round(
                    r * colorAmount + 0 * blackAmount
                )},${Math.round(g * colorAmount + 0 * blackAmount)},${Math.round(
                    b * colorAmount + 0 * blackAmount
                )},${alpha})`
                ctx.beginPath()
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
                ctx.fill()
            }
        }

        const drawBackdrop = (drift: number) => {
            const whiteAmount = 1 - drift
            const blackAmount = drift
            const bg = ctx.createLinearGradient(0, 0, 0, H)

            const topR = Math.round(255 * whiteAmount + 8 * blackAmount)
            const topG = Math.round(255 * whiteAmount + 5 * blackAmount)
            const topB = Math.round(255 * whiteAmount + 8 * blackAmount)
            const midR = Math.round(255 * whiteAmount + 12 * blackAmount)
            const midG = Math.round(255 * whiteAmount + 8 * blackAmount)
            const midB = Math.round(255 * whiteAmount + 15 * blackAmount)
            const botR = Math.round(255 * whiteAmount + 3 * blackAmount)
            const botG = Math.round(255 * whiteAmount + 2 * blackAmount)
            const botB = Math.round(255 * whiteAmount + 6 * blackAmount)

            bg.addColorStop(0, `rgba(${topR},${topG},${topB},0.96)`)
            bg.addColorStop(0.55, `rgba(${midR},${midG},${midB},0.92)`)
            bg.addColorStop(1, `rgba(${botR},${botG},${botB},0.98)`)
            ctx.fillStyle = bg
            ctx.fillRect(0, 0, W, H)

            if (drift > 0.1) {
                const riverGlow = ctx.createRadialGradient(
                    W * 0.56,
                    H * 0.77,
                    0,
                    W * 0.56,
                    H * 0.77,
                    W * 0.32
                )
                riverGlow.addColorStop(
                    0,
                    `rgba(255,182,118,${0.18 * drift})`
                )
                riverGlow.addColorStop(
                    0.52,
                    `rgba(255,72,72,${0.06 * drift})`
                )
                riverGlow.addColorStop(1, "rgba(0,0,0,0)")
                ctx.fillStyle = riverGlow
                ctx.fillRect(0, 0, W, H)
            }
        }

        const drawImageParticles = (
            time: number,
            drift: number,
            mx: number,
            my: number
        ) => {
            const ignite = smoothstep(0.02, 0.68, drift)
            const spread = smoothstep(0.12, 1, drift) * 16
            const colorSat = smoothstep(0.0, 0.5, drift)
            const parallaxX = smoothY * 0.008
            const parallaxY = smoothY * 0.12
            const baseYOffset = H * 0.18
            const HOVER_R = 110
            const HOVER_R2 = HOVER_R * HOVER_R
            const MAX_PUSH = 38

            if (TIER_CFG[tier].glowOn) {
                glowCtx.clearRect(0, 0, W, H)
            }

            for (const p of imageParticles) {
                const layerDepth = 1 + p.z * 0.22
                let px =
                    p.x +
                    p.ox -
                    parallaxX * layerDepth +
                    p.luma * spread * 0.16
                let py =
                    p.y +
                    p.oy +
                    baseYOffset -
                    parallaxY * (0.2 + p.z * 0.5) -
                    ignite * (12 + p.z * 22.0)

                const dx = px - mx
                const dy = py - my
                const d2 = dx * dx + dy * dy
                if (d2 < HOVER_R2 && d2 > 0.01) {
                    const d = Math.sqrt(d2)
                    const push = Math.pow(1 - d / HOVER_R, 2) * MAX_PUSH
                    px += (dx / d) * push
                    py += (dy / d) * push
                }

                if (px < -8 || px > W + 8 || py < -8 || py > H + 8) continue

                const twinkle = 0.84 + Math.sin(time * 1.15 + p.twinkle) * 0.16
                const radius =
                    p.radius *
                    twinkle *
                    (1 + ignite * p.luma * 0.08) *
                    (0.7 + p.z * 0.5)
                const alpha = p.alpha * twinkle * (0.65 + p.z * 0.35)
                const pr = Math.round(lerp(0, p.sr, colorSat))
                const pg = Math.round(lerp(0, p.sg, colorSat))
                const pb = Math.round(lerp(0, p.sb, colorSat))

                ctx.fillStyle = `rgba(${pr},${pg},${pb},${alpha})`
                ctx.beginPath()
                ctx.arc(px, py, radius, 0, Math.PI * 2)
                ctx.fill()

                if (TIER_CFG[tier].glowOn && p.luma > 0.68) {
                    glowCtx.fillStyle = `rgba(${pr},${pg},${pb},${alpha * 0.3})`
                    glowCtx.beginPath()
                    glowCtx.arc(px, py, radius * 5, 0, Math.PI * 2)
                    glowCtx.fill()
                }
            }
        }

        const resize = () => {
            W = Math.max(rootEl.clientWidth, 1)
            H = Math.max(stageEl.getBoundingClientRect().height, 1)

            const DPR = Math.min(
                window.devicePixelRatio || 1,
                TIER_CFG[tier].dprCap
            )

            canvasEl.width = Math.floor(W * DPR)
            canvasEl.height = Math.floor(H * DPR)
            canvasEl.style.width = `${W}px`
            canvasEl.style.height = `${H}px`
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0)

            const glowDPR = DPR * 0.5
            glowCanvasEl.width = Math.floor(W * glowDPR)
            glowCanvasEl.height = Math.floor(H * glowDPR)
            glowCanvasEl.style.width = `${W}px`
            glowCanvasEl.style.height = `${H}px`
            glowCtx.setTransform(glowDPR, 0, 0, glowDPR, 0, 0)
            glowCanvasEl.style.opacity = TIER_CFG[tier].glowOn ? "0.2" : "0"

            buildMotes()
            buildImageParticles()
        }

        const applyTier = () => {
            glowCanvasEl.style.opacity = TIER_CFG[tier].glowOn ? "0.2" : "0"
            buildMotes()
            buildImageParticles()
        }

        const syncProgress = () => {
            const maxScroll = Math.max(rootEl.offsetHeight - H, 1)
            const rawScroll = isCanvas
                ? clamp(scrollDemoRef.current, 0, 1) * maxScroll
                : clamp(-rootEl.getBoundingClientRect().top, 0, maxScroll)
            const progress = clamp(rawScroll / (maxScroll * 0.72), 0, 1)
            currentScrollPx = rawScroll
            syncUIText(progress)
        }

        const render = (now: number) => {
            const dt = now - lastNow
            lastNow = now

            if (dt > 0 && dt < 1000) {
                if (dt > 26 && tier > 0) {
                    slowFrames += 1
                    if (slowFrames > 90) {
                        tier -= 1
                        applyTier()
                        slowFrames = 0
                    }
                } else {
                    slowFrames = Math.max(0, slowFrames - 1)
                }
            }

            const time = now * 0.001
            const maxScroll = Math.max(rootEl.offsetHeight - H, 1)
            if (isCanvas) {
                currentScrollPx = clamp(scrollDemoRef.current, 0, 1) * maxScroll
            }
            const drift = clamp(currentScrollPx / (maxScroll * 0.72), 0, 1)

            smoothY += (currentScrollPx - smoothY) * 0.07
            smoothMX += (mouseX - smoothMX) * 0.12
            smoothMY += (mouseY - smoothMY) * 0.12

            syncUIText(drift)
            ctx.clearRect(0, 0, W, H)
            drawBackdrop(drift)
            drawImageParticles(time, drift, smoothMX, smoothMY)
            drawMotes(drift)

            rafId = requestAnimationFrame(render)
        }

        const handlePointerMove = (event: MouseEvent | TouchEvent) => {
            const point =
                "touches" in event && event.touches.length > 0
                    ? event.touches[0]
                    : (event as MouseEvent)
            mouseX = point.clientX
            mouseY = point.clientY
        }

        const handlePointerLeave = () => {
            mouseX = -9999
            mouseY = -9999
        }

        const handleResize = () => {
            window.clearTimeout(resizeTimer)
            resizeTimer = window.setTimeout(() => {
                resize()
                syncProgress()
            }, 120)
        }

        const handleVisibility = () => {
            if (document.hidden) {
                cancelAnimationFrame(rafId)
                rafId = 0
            } else if (!rafId) {
                rafId = requestAnimationFrame(render)
            }
        }

        if ((touchCapable || W < 768) && tier > 1) {
            tier = 1
        }

        window.addEventListener("resize", handleResize)
        window.addEventListener("scroll", syncProgress, { passive: true })
        window.addEventListener("mousemove", handlePointerMove, {
            passive: true,
        })
        window.addEventListener("touchmove", handlePointerMove, {
            passive: true,
        })
        window.addEventListener("mouseleave", handlePointerLeave)
        window.addEventListener("touchend", handlePointerLeave)
        document.addEventListener("visibilitychange", handleVisibility)

        titleRef.current?.classList.remove("is-ready")
        titleReadyFrame = requestAnimationFrame(() => {
            titleRef.current?.classList.add("is-ready")
        })

        const start = () => {
            resize()
            syncProgress()
            if (!rafId) {
                rafId = requestAnimationFrame(render)
            }
        }

        if (
            sourceImageEl.complete &&
            (!imageSrc || sourceImageEl.naturalWidth > 0)
        ) {
            start()
        } else {
            sourceImageEl.addEventListener("load", start, { once: true })
            sourceImageEl.addEventListener("error", start, { once: true })
        }

        return () => {
            cancelAnimationFrame(rafId)
            cancelAnimationFrame(titleReadyFrame)
            window.clearTimeout(resizeTimer)
            window.removeEventListener("resize", handleResize)
            window.removeEventListener("scroll", syncProgress)
            window.removeEventListener("mousemove", handlePointerMove)
            window.removeEventListener("touchmove", handlePointerMove)
            window.removeEventListener("mouseleave", handlePointerLeave)
            window.removeEventListener("touchend", handlePointerLeave)
            document.removeEventListener("visibilitychange", handleVisibility)
            sourceImageEl.removeEventListener("load", start)
            sourceImageEl.removeEventListener("error", start)
        }
    }, [imageSrc])

    return (
        <div
            ref={rootRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minHeight: 1800,
                overflow: "visible",
                background: "#fff",
                color: "#000",
            }}
        >
            <style>{`
                .hyf-stage {
                    position: sticky;
                    top: 0;
                    height: 100vh;
                    overflow: hidden;
                    isolation: isolate;
                    background: #fff;
                }

                .hyf-source-image {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    opacity: 0;
                    pointer-events: none;
                    user-select: none;
                }

                .hyf-fog {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    background:
                        linear-gradient(
                            to bottom,
                            rgba(4, 2, 8, 0.55) 0%,
                            rgba(4, 2, 8, 0.10) 16%,
                            transparent 38%,
                            transparent 56%,
                            rgba(4, 2, 8, 0.42) 78%,
                            rgba(2, 0, 4, 0.82) 100%
                        );
                }

                .hyf-stage canvas {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    display: block;
                }

                .hyf-glow {
                    filter: blur(8px);
                    mix-blend-mode: screen;
                    opacity: 0.2;
                }

                .hyf-ui {
                    position: relative;
                    z-index: 2;
                    width: min(1280px, 100%);
                    height: 100%;
                    margin: 0 auto;
                    padding: clamp(30px, 4.6vw, 72px);
                    display: grid;
                    grid-template-rows: auto 1fr auto;
                    pointer-events: none;
                }

                .hyf-top,
                .hyf-bottom {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 24px;
                    font-size: 13px;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    color: rgba(0, 0, 0, 0.52);
                }

                .hyf-eyebrow,
                .hyf-hint {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    font-weight: 400;
                }

                .hyf-eyebrow::before,
                .hyf-hint::before {
                    content: "";
                    width: 36px;
                    height: 1px;
                    background: currentColor;
                    opacity: 0.45;
                }

                .hyf-hero {
                    align-self: center;
                    max-width: min(860px, 78vw);
                    padding-bottom: clamp(56px, 8vh, 96px);
                }

                .hyf-hero h1 {
                    margin: 0 0 0.14em;
                    font-family: "Cormorant Garamond", "ZCOOL XiaoWei", "Noto Serif SC", Georgia, serif;
                    font-size: clamp(82px, 12vw, 168px);
                    line-height: 0.88;
                    font-weight: 600;
                    letter-spacing: 0.01em;
                    color: rgba(0, 0, 0, 0.95);
                    text-transform: uppercase;
                }

                .hyf-title-line {
                    display: block;
                    opacity: 0;
                    transform: translateY(38px);
                    filter: blur(8px);
                }

                .hyf-title.is-ready .hyf-title-line {
                    animation: hyfTitleReveal 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }

                .hyf-title.is-ready .hyf-title-line:nth-child(1) {
                    animation-delay: 0.06s;
                }

                .hyf-title.is-ready .hyf-title-line:nth-child(2) {
                    animation-delay: 0.18s;
                }

                @keyframes hyfTitleReveal {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                        filter: blur(0);
                    }
                }

                .hyf-zh {
                    margin: 0 0 22px;
                    font-family: "Cormorant Garamond", "ZCOOL XiaoWei", "Noto Serif SC", Georgia, serif;
                    font-size: clamp(14px, 1.25vw, 18px);
                    font-weight: 500;
                    letter-spacing: 0.18em;
                    color: rgba(0, 0, 0, 0.42);
                }

                .hyf-reveal-copy {
                    opacity: 0;
                    visibility: hidden;
                }

                .hyf-reveal-copy.is-visible {
                    opacity: 1;
                    visibility: visible;
                }

                .hyf-reveal-line {
                    display: block;
                }

                .hyf-reveal-word {
                    display: inline-block;
                    opacity: 0;
                    transform: translateY(18px);
                    filter: blur(6px);
                    will-change: transform, opacity, filter;
                }

                .hyf-reveal-copy.is-visible .hyf-reveal-word {
                    animation: hyfCopyReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    animation-delay: calc(var(--reveal-delay, 0ms) + (var(--word-index) * 70ms));
                }

                @keyframes hyfCopyReveal {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                        filter: blur(0);
                    }
                }

                .hyf-sub {
                    margin: 0;
                    max-width: 620px;
                    font-family: "Murecho", "Inter", system-ui, sans-serif;
                    font-size: clamp(16px, 1.5vw, 22px);
                    font-weight: 400;
                    line-height: 1.55;
                    letter-spacing: -0.01em;
                    color: rgba(0, 0, 0, 0.50);
                    white-space: pre-line;
                }

                .hyf-bottom {
                    align-items: flex-end;
                    padding-bottom: 2px;
                }

                @media (max-width: 768px) {
                    .hyf-ui {
                        padding: 24px 20px 28px;
                    }

                    .hyf-hero {
                        max-width: 92vw;
                        padding-bottom: 40px;
                    }

                    .hyf-hero h1 {
                        font-size: clamp(54px, 15vw, 104px);
                    }

                    .hyf-zh {
                        margin: 0 0 16px;
                        font-size: 13px;
                        letter-spacing: 0.14em;
                    }

                    .hyf-sub {
                        max-width: 360px;
                        font-size: 14px;
                        line-height: 1.5;
                    }

                    .hyf-top,
                    .hyf-bottom {
                        font-size: 11px;
                        letter-spacing: 0.14em;
                    }
                }

                @media (max-width: 480px) {
                    .hyf-hero h1 {
                        font-size: clamp(44px, 14vw, 80px);
                    }

                    .hyf-zh {
                        margin: 0 0 14px;
                        font-size: 12px;
                        letter-spacing: 0.12em;
                    }

                    .hyf-sub {
                        max-width: 100%;
                        font-size: 13px;
                    }

                    .hyf-top {
                        gap: 12px;
                    }

                    .hyf-eyebrow {
                        display: none;
                    }
                }
            `}</style>

            <div ref={stageRef} className="hyf-stage">
                <img
                    ref={sourceImageRef}
                    className="hyf-source-image"
                    src={imageSrc}
                    alt=""
                />
                <div className="hyf-fog" />
                <canvas ref={canvasRef} />
                <canvas ref={glowCanvasRef} className="hyf-glow" />

                <div className="hyf-ui">
                    <div ref={topRef} className="hyf-top">
                        <div
                            ref={eyebrowRef}
                            className="hyf-eyebrow hyf-reveal-copy"
                            style={{ ["--reveal-delay" as any]: "40ms" }}
                        >
                            {renderRevealText(eyebrow)}
                        </div>
                    </div>

                    <div className="hyf-hero">
                        <h1 ref={titleRef} className="hyf-title">
                            <span className="hyf-title-line">{titleLine1}</span>
                            <span className="hyf-title-line">{titleLine2}</span>
                        </h1>
                        <div
                            ref={zhRef}
                            className="hyf-zh hyf-reveal-copy"
                            style={{ ["--reveal-delay" as any]: "80ms" }}
                        >
                            {renderRevealText(titleZh)}
                        </div>
                        <p
                            ref={subRef}
                            className="hyf-sub hyf-reveal-copy"
                            style={{ ["--reveal-delay" as any]: "120ms" }}
                        >
                            {renderRevealText(subtitle)}
                        </p>
                    </div>

                    <div ref={bottomRef} className="hyf-bottom">
                        <div
                            ref={hintRef}
                            className="hyf-hint hyf-reveal-copy"
                            style={{ ["--reveal-delay" as any]: "180ms" }}
                        >
                            {renderRevealText(hint)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

HongyadongFramer.defaultProps = {
    width: 1200,
    height: 2400,
    imageSrc: "hero.png",
    eyebrow: "Profile",
    titleLine1: "ABOUT",
    titleLine2: "ME",
    titleZh: "",
    subtitle:
        "Product designer & creative developer.\nI design for intuition - building at the intersection of humanities and creative engineering.",
    hint: "Scroll to explore",
    scrollDemo: 0,
}

addPropertyControls(HongyadongFramer, {
    imageSrc: {
        type: ControlType.Image,
        title: "Image",
    },
    eyebrow: {
        type: ControlType.String,
        title: "Eyebrow",
    },
    titleLine1: {
        type: ControlType.String,
        title: "Title 1",
    },
    titleLine2: {
        type: ControlType.String,
        title: "Title 2",
    },
    titleZh: {
        type: ControlType.String,
        title: "Subhead",
    },
    subtitle: {
        type: ControlType.String,
        title: "Body",
        displayTextArea: true,
    },
    hint: {
        type: ControlType.String,
        title: "Hint",
    },
    scrollDemo: {
        type: ControlType.Number,
        title: "Scroll",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0,
    },
})
