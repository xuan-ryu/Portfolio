import * as React from "react"
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

type Props = {
    imageSrc: string
    profilePhoto: string
    eyebrow: string
    titleLine1: string
    titleLine2: string
    titleZh: string
    subtitle: string
    signatureNote: string
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

function renderRevealCharacters(text: string) {
    let charIndex = 0

    return Array.from(text).map((char, index) => {
        if (char === " ") {
            return <span key={`space-${index}`} className="hyf-reveal-space" />
        }

        return (
            <span key={`${char}-${index}`} className="hyf-reveal-char-slot">
                <span
                    className="hyf-reveal-char"
                    style={
                        {
                            ["--char-index" as any]: charIndex++,
                        } as React.CSSProperties
                    }
                >
                    {char}
                </span>
            </span>
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
        profilePhoto,
        eyebrow,
        titleLine1,
        titleLine2,
        titleZh,
        subtitle,
        signatureNote,
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
    const signatureRef = useRef<HTMLDivElement>(null)
    const signatureNoteRef = useRef<HTMLParagraphElement>(null)
    const avatarRef = useRef<HTMLDivElement>(null)
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

        const pxCanvas = document.createElement("canvas")
        const pxCtx = pxCanvas.getContext("2d", { alpha: true })
        if (!pxCtx) return
        let pxImgData: ImageData | null = null
        let pxPixels: Uint8ClampedArray | null = null

        const isCanvas = RenderTarget.current() === RenderTarget.canvas
        const touchCapable = "ontouchstart" in window
        const cores = navigator.hardwareConcurrency || 2
        const mem = (navigator as any).deviceMemory || 4
        const dpr = window.devicePixelRatio || 1
        const motionQuery = window.matchMedia
            ? window.matchMedia("(prefers-reduced-motion: reduce)")
            : null
        const reducedMotion = !!(motionQuery && motionQuery.matches)
        const connection =
            (navigator as any).connection ||
            (navigator as any).mozConnection ||
            (navigator as any).webkitConnection
        const saveData = !!(connection && connection.saveData)

        const estimateMaxTier = (
            width = window.innerWidth,
            height = window.innerHeight
        ) => {
            if (saveData || reducedMotion) return 0

            let nextTier = cores >= 10 && mem >= 8 ? 2 : cores >= 6 && mem >= 4 ? 1 : 0
            const shortEdge = Math.min(width, height)
            const area = Math.max(width * height, 1)

            if (touchCapable) nextTier = Math.min(nextTier, 1)
            if (shortEdge <= 480 || area <= 430000) nextTier = 0
            if (dpr >= 2.2 && area >= 2560 * 1440) {
                nextTier = Math.max(0, nextTier - 1)
            }

            return nextTier
        }

        let maxTier = estimateMaxTier()
        let tier = maxTier
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
        let fastFrames = 0
        let lastNow = 0
        let titleReadyFrame = 0
        let scrollMax = 1
        let lastDrift = -1
        let lastSmoothMX = -9999
        let lastSmoothMY = -9999

        const TIER_CFG = [
            {
                sampleLong: 170,
                sampleLongMax: 220,
                dprCap: 1,
                glowOn: false,
                glowOpacity: 0,
                moteCount: 0,
                sampleStep: 2,
                hoverOn: false,
                hoverRadius: 0,
                hoverPush: 0,
                spread: 10,
                parallaxX: 0.004,
                parallaxY: 0.08,
                baseYOffset: 0.16,
                igniteLift: 16,
                glowThreshold: 1,
                pxScale: 0.5,
                twinkle: false,
            },
            {
                sampleLong: 300,
                sampleLongMax: 420,
                dprCap: 1.25,
                glowOn: true,
                glowOpacity: 0.12,
                moteCount: 12,
                sampleStep: 2,
                hoverOn: true,
                hoverRadius: 84,
                hoverPush: 20,
                spread: 13,
                parallaxX: 0.006,
                parallaxY: 0.1,
                baseYOffset: 0.17,
                igniteLift: 18,
                glowThreshold: 0.76,
                pxScale: 1,
                twinkle: true,
            },
            {
                sampleLong: 440,
                sampleLongMax: 620,
                dprCap: 1.75,
                glowOn: true,
                glowOpacity: 0.18,
                moteCount: 24,
                sampleStep: 1,
                hoverOn: true,
                hoverRadius: 110,
                hoverPush: 34,
                spread: 16,
                parallaxX: 0.008,
                parallaxY: 0.12,
                baseYOffset: 0.18,
                igniteLift: 22,
                glowThreshold: 0.68,
                pxScale: 1,
                twinkle: true,
            },
        ]

        const syncUIText = (progress: number) => {
            const textT = smoothstep(0.12, 0.48, progress)
            const signatureReady = progress >= 0.58
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
                signatureRef.current,
                "color",
                mixColor([0, 0, 0, 0.88], [255, 255, 255, 0.94], textT)
            )
            setStyleIfChanged(
                signatureNoteRef.current,
                "color",
                mixColor([0, 0, 0, 0.62], [255, 255, 255, 0.82], textT)
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
            signatureRef.current?.classList.toggle("is-visible", signatureReady)
            signatureNoteRef.current?.classList.toggle("is-visible", signatureReady)
        }

        const buildMotes = () => {
            const cfg = TIER_CFG[tier]
            motes = Array.from(
                { length: cfg.moteCount },
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
                ? Math.round(cfg.sampleLong * (reducedMotion ? 0.58 : 0.72))
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

            const spacing = TIER_CFG[tier].sampleStep

            for (let y = 0; y < sampleHeight; y += spacing) {
                for (let x = 0; x < sampleWidth; x += spacing) {
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

        const drawFog = (time: number, drift: number) => {
            const fogStrength = smoothstep(0.48, 0.02, drift)
            if (fogStrength < 0.005) return
            const fogLift = smoothstep(0.02, 0.4, drift) * H * 0.24

            const layers = [
                { yFrac: 0.64, ryFrac: 0.11, rxMult: 8.6, speed: 0.011, phase: 0.0, alpha: 0.14, lift: 0.36 },
                { yFrac: 0.76, ryFrac: 0.14, rxMult: 7.8, speed: -0.009, phase: 2.1, alpha: 0.18, lift: 0.58 },
                { yFrac: 0.88, ryFrac: 0.17, rxMult: 7.1, speed: 0.007, phase: 4.4, alpha: 0.24, lift: 0.82 },
                { yFrac: 0.99, ryFrac: 0.21, rxMult: 6.5, speed: -0.005, phase: 1.7, alpha: 0.30, lift: 1.0 },
            ]

            for (const l of layers) {
                const ry = l.ryFrac * H
                const rx = ry * l.rxMult
                const cx = W * 0.5 + Math.sin(time * l.speed + l.phase) * W * 0.10
                const cy = l.yFrac * H - fogLift * l.lift
                const breathe = 0.88 + Math.sin(time * 0.36 + l.phase) * 0.12
                const a = l.alpha * fogStrength * breathe

                ctx.save()
                ctx.translate(cx, cy)
                ctx.scale(rx / ry, 1)
                const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry)
                g.addColorStop(0, `rgba(248,246,242,${a})`)
                g.addColorStop(0.55, `rgba(248,246,242,${a * 0.38})`)
                g.addColorStop(1, "rgba(248,246,242,0)")
                ctx.fillStyle = g
                ctx.beginPath()
                ctx.arc(0, 0, ry, 0, Math.PI * 2)
                ctx.fill()
                ctx.restore()
            }

            const blanketTop = H * 0.46 - fogLift * 0.18
            const blanket = ctx.createLinearGradient(0, blanketTop, 0, H)
            blanket.addColorStop(0, "rgba(248,246,242,0)")
            blanket.addColorStop(0.38, `rgba(248,246,242,${0.14 * fogStrength})`)
            blanket.addColorStop(0.78, `rgba(248,246,242,${0.24 * fogStrength})`)
            blanket.addColorStop(1, `rgba(248,246,242,${0.38 * fogStrength})`)
            ctx.fillStyle = blanket
            ctx.fillRect(0, blanketTop, W, H - blanketTop)

            const base = ctx.createLinearGradient(0, H * 0.70 - fogLift * 0.28, 0, H)
            base.addColorStop(0, "rgba(248,246,242,0)")
            base.addColorStop(0.42, `rgba(248,246,242,${0.18 * fogStrength})`)
            base.addColorStop(1, `rgba(248,246,242,${0.56 * fogStrength})`)
            ctx.fillStyle = base
            ctx.fillRect(0, H * 0.70 - fogLift * 0.28, W, H * 0.30 + fogLift * 0.28)
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

                ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
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
            if (!pxPixels || !pxImgData) return
            const pixels = pxPixels as Uint8ClampedArray
            const imgData = pxImgData as ImageData
            const cfg = TIER_CFG[tier]
            const ignite = smoothstep(0.02, 0.68, drift)
            const bwReveal = smoothstep(0.03, 0.34, drift)
            const isMobile = W < 768 || touchCapable
            const spread = smoothstep(0.12, 1, drift) * cfg.spread
            const colorSat = smoothstep(0.0, 0.5, drift)
            const parallaxX = smoothY * cfg.parallaxX
            const parallaxY = smoothY * cfg.parallaxY
            const baseYOffset = H * cfg.baseYOffset
            const HOVER_R = cfg.hoverRadius
            const HOVER_R2 = HOVER_R * HOVER_R
            const MAX_PUSH = cfg.hoverPush
            const hoverEnabled =
                cfg.hoverOn && !reducedMotion && mx > -9000 && my > -9000

            const useGlow = cfg.glowOn && drift > 0.08
            if (useGlow) glowCtx.clearRect(0, 0, W, H)

            const ps = cfg.pxScale
            const PW = pxCanvas.width
            const PH = pxCanvas.height
            pixels.fill(0)

            for (const p of imageParticles) {
                const particleSeed = (p.twinkle / (Math.PI * 2)) % 1
                const heightBias = clamp((p.y / Math.max(H, 1) - 0.22) / 0.78, 0, 1)
                const densityFloor = reducedMotion ? 0.46 : isMobile ? 0.40 : 0.32
                const densityGate = Math.min(
                    1,
                    densityFloor + bwReveal * (1 - densityFloor) + heightBias * 0.22
                )
                if (particleSeed > densityGate) continue

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
                    ignite * (cfg.igniteLift * 0.55 + p.z * cfg.igniteLift)

                if (hoverEnabled) {
                    const dx = px - mx
                    const dy = py - my
                    const d2 = dx * dx + dy * dy
                    if (d2 < HOVER_R2 && d2 > 0.01) {
                        const d = Math.sqrt(d2)
                        const t = 1 - d / HOVER_R
                        const push = t * t * MAX_PUSH
                        px += (dx / d) * push
                        py += (dy / d) * push
                    }
                }

                if (px < -8 || px > W + 8 || py < -8 || py > H + 8) continue

                const twinkle = cfg.twinkle
                    ? 0.84 + Math.sin(time * 1.15 + p.twinkle) * 0.16
                    : 0.92
                const radius =
                    p.radius *
                    twinkle *
                    (0.8 + bwReveal * 0.2) *
                    (1 + ignite * p.luma * 0.08) *
                    (0.7 + p.z * 0.5)
                const alphaLift = 0.30 + bwReveal * 0.70
                const alpha =
                    p.alpha *
                    twinkle *
                    alphaLift *
                    (0.58 + heightBias * 0.16 + p.z * 0.26)
                const pr = Math.round(p.sr * colorSat)
                const pg = Math.round(p.sg * colorSat)
                const pb = Math.round(p.sb * colorSat)
                const pA = Math.round(alpha * 255)

                const bx = (px * ps) | 0
                const by = (py * ps) | 0
                const br = Math.max(1, Math.ceil(radius * ps))
                const br2 = radius * ps * (radius * ps)
                for (let dy = -br; dy <= br; dy++) {
                    const y2 = dy * dy
                    if (y2 > br2) continue
                    const row = by + dy
                    if (row < 0 || row >= PH) continue
                    const rowOff = (row * PW) << 2
                    for (let dx = -br; dx <= br; dx++) {
                        if (dx * dx + y2 > br2) continue
                        const col = bx + dx
                        if (col < 0 || col >= PW) continue
                        const i = rowOff + (col << 2)
                        pxPixels[i] = pr
                        pxPixels[i + 1] = pg
                        pxPixels[i + 2] = pb
                        pxPixels[i + 3] = pA
                    }
                }

                if (useGlow && p.luma > cfg.glowThreshold) {
                    glowCtx.fillStyle = `rgba(${pr},${pg},${pb},${alpha * 0.3})`
                    glowCtx.beginPath()
                    glowCtx.arc(px, py, radius * 5, 0, Math.PI * 2)
                    glowCtx.fill()
                }
            }

            pxCtx.putImageData(imgData, 0, 0)
            ctx.drawImage(pxCanvas, 0, 0, W, H)
        }

        const resize = () => {
            W = Math.max(rootEl.clientWidth, 1)
            H = Math.max(stageEl.getBoundingClientRect().height, 1)
            maxTier = estimateMaxTier(W, H)
            if (tier > maxTier) tier = maxTier

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
            glowCanvasEl.style.opacity = TIER_CFG[tier].glowOn
                ? String(TIER_CFG[tier].glowOpacity)
                : "0"

            scrollMax = Math.max(rootEl.offsetHeight - H, 1)
            const ps0 = TIER_CFG[tier].pxScale
            pxCanvas.width = Math.ceil(W * ps0)
            pxCanvas.height = Math.ceil(H * ps0)
            pxImgData = pxCtx.createImageData(pxCanvas.width, pxCanvas.height)
            pxPixels = pxImgData.data
            lastDrift = -1
            buildMotes()
            buildImageParticles()
        }

        const applyTier = () => {
            const cfg = TIER_CFG[tier]
            glowCanvasEl.style.opacity = cfg.glowOn ? String(cfg.glowOpacity) : "0"
            const ps = cfg.pxScale
            pxCanvas.width = Math.ceil(W * ps)
            pxCanvas.height = Math.ceil(H * ps)
            pxImgData = pxCtx.createImageData(pxCanvas.width, pxCanvas.height)
            pxPixels = pxImgData.data
            lastDrift = -1
            buildMotes()
            const snapTier = tier
            const rebuild = () => { if (tier === snapTier) buildImageParticles() }
            if ((window as any).requestIdleCallback) (window as any).requestIdleCallback(rebuild)
            else setTimeout(rebuild, 0)
        }

        const syncProgress = () => {
            const rawScroll = isCanvas
                ? clamp(scrollDemoRef.current, 0, 1) * scrollMax
                : clamp(-rootEl.getBoundingClientRect().top, 0, scrollMax)
            const progress = clamp(rawScroll / (scrollMax * 0.72), 0, 1)
            currentScrollPx = rawScroll
            syncUIText(progress)
        }

        const render = (now: number) => {
            const dt = now - lastNow
            lastNow = now

            if (dt > 0 && dt < 1000) {
                if (dt > 28 && tier > 0) {
                    slowFrames += 1
                    fastFrames = 0
                    if (slowFrames > 45) {
                        tier -= 1
                        applyTier()
                        slowFrames = 0
                    }
                } else if (dt < 17 && tier < maxTier) {
                    fastFrames += 1
                    slowFrames = Math.max(0, slowFrames - 2)
                    if (fastFrames > 180) {
                        tier += 1
                        applyTier()
                        fastFrames = 0
                    }
                } else {
                    slowFrames = Math.max(0, slowFrames - 1)
                    fastFrames = Math.max(0, fastFrames - 1)
                }
            }

            const time = now * 0.001
            if (isCanvas) {
                currentScrollPx = clamp(scrollDemoRef.current, 0, 1) * scrollMax
            }
            const drift = clamp(currentScrollPx / (scrollMax * 0.72), 0, 1)

            const scrollEase = reducedMotion ? 0.18 : 0.07
            smoothY += (currentScrollPx - smoothY) * scrollEase
            smoothMX += (mouseX - smoothMX) * 0.12
            smoothMY += (mouseY - smoothMY) * 0.12

            if (
                !TIER_CFG[tier].twinkle &&
                lastDrift >= 0 &&
                Math.abs(drift - lastDrift) < 0.0005 &&
                Math.abs(smoothMX - lastSmoothMX) < 1 &&
                Math.abs(smoothMY - lastSmoothMY) < 1
            ) {
                fastFrames = 0
                rafId = requestAnimationFrame(render)
                return
            }
            lastDrift = drift
            lastSmoothMX = smoothMX
            lastSmoothMY = smoothMY

            syncUIText(drift)
            ctx.clearRect(0, 0, W, H)
            drawBackdrop(drift)
            drawImageParticles(time, drift, smoothMX, smoothMY)
            drawFog(time, drift)
            drawMotes(drift)

            rafId = requestAnimationFrame(render)
        }

        const handlePointerMove = (event: MouseEvent) => {
            if (!TIER_CFG[tier].hoverOn || reducedMotion) return
            mouseX = event.clientX
            mouseY = event.clientY
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

        window.addEventListener("resize", handleResize)
        window.addEventListener("scroll", syncProgress, { passive: true })
        window.addEventListener("mousemove", handlePointerMove, {
            passive: true,
        })
        window.addEventListener("touchstart", handlePointerLeave, {
            passive: true,
        })
        window.addEventListener("mouseleave", handlePointerLeave)
        window.addEventListener("touchend", handlePointerLeave)
        document.addEventListener("visibilitychange", handleVisibility)

        titleRef.current?.classList.remove("is-ready")
        titleReadyFrame = requestAnimationFrame(() => {
            titleRef.current?.classList.add("is-ready")
            ;[
                avatarRef.current,
                eyebrowRef.current,
                zhRef.current,
                subRef.current,
            ].forEach((el) => {
                el?.classList.add("is-visible")
            })
        })

        const start = () => {
            tier = Math.min(tier, maxTier)
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
            window.removeEventListener("touchstart", handlePointerLeave)
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
                    height: 100svh;
                    height: 100dvh;
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

                .hyf-stage canvas {
                    position: absolute;
                    inset: 0;
                    z-index: 0;
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
                    width: 100%;
                    height: 100%;
                    margin: 0 auto;
                    padding:
                        calc(clamp(30px, 4.6vw, 72px) + env(safe-area-inset-top, 0px))
                        calc(clamp(30px, 4.6vw, 72px) + env(safe-area-inset-right, 0px))
                        0
                        calc(clamp(30px, 4.6vw, 72px) + env(safe-area-inset-left, 0px));
                    display: grid;
                    grid-template-rows: auto 1fr auto;
                    pointer-events: none;
                }

                .hyf-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 24px;
                    font-size: 13px;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    color: rgba(0, 0, 0, 0.52);
                }

                .hyf-eyebrow {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    font-weight: 400;
                }

                .hyf-eyebrow::before {
                    content: "";
                    width: 36px;
                    height: 1px;
                    background: currentColor;
                    opacity: 0.45;
                }

                .hyf-hero {
                    width: 100%;
                    align-self: center;
                    justify-self: center;
                    padding-bottom: clamp(56px, 8vh, 96px);
                }

                .hyf-hero h1 {
                    margin: 0 0 0.14em;
                    font-family: "Cormorant Garamond", "ZCOOL XiaoWei", "Noto Serif SC", Georgia, serif;
                    font-size: clamp(82px, 12vw, 168px);
                    line-height: 0.88;
                    font-weight: 300;
                    letter-spacing: 0.015em;
                    color: rgba(0, 0, 0, 0.95);
                    text-transform: none;
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

                .hyf-avatar {
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    overflow: hidden;
                    margin: 0 0 28px;
                    opacity: 0;
                    transform: translateY(12px) scale(0.92);
                    filter: blur(4px);
                    transition: opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1),
                                transform 0.9s cubic-bezier(0.16, 1, 0.3, 1),
                                filter 0.9s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .hyf-avatar.is-visible {
                    opacity: 1;
                    transform: none;
                    filter: none;
                }

                .hyf-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }

                .hyf-zh {
                    margin: 0 0 22px;
                    font-family: "Cormorant Garamond", "ZCOOL XiaoWei", "Noto Serif SC", Georgia, serif;
                    font-size: clamp(14px, 1.25vw, 18px);
                    font-weight: 500;
                    letter-spacing: 0.18em;
                    color: rgba(0, 0, 0, 0.42);
                    text-shadow: 0 2px 12px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.12);
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

                .hyf-reveal-char-copy {
                    opacity: 0;
                    visibility: hidden;
                }

                .hyf-reveal-char-copy.is-visible {
                    opacity: 1;
                    visibility: visible;
                }

                .hyf-reveal-char-slot {
                    display: inline-block;
                    overflow: hidden;
                    vertical-align: bottom;
                    padding-bottom: 0.04em;
                    margin-bottom: -0.04em;
                }

                .hyf-reveal-char {
                    display: inline-block;
                    opacity: 0;
                    transform: translateY(118%);
                    filter: blur(6px);
                    will-change: transform, opacity, filter;
                }

                .hyf-reveal-char-copy.is-visible .hyf-reveal-char {
                    animation: hyfSignatureReveal 0.92s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    animation-delay: calc(var(--reveal-delay, 0ms) + (var(--char-index) * 52ms));
                }

                .hyf-reveal-space {
                    display: inline-block;
                    width: 0.34em;
                }

                @keyframes hyfSignatureReveal {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                        filter: blur(0);
                    }
                }

                .hyf-sub {
                    margin: 0;
                    font-family: "Murecho", "Inter", system-ui, sans-serif;
                    font-size: clamp(16px, 1.5vw, 22px);
                    font-weight: 400;
                    line-height: 1.55;
                    letter-spacing: -0.01em;
                    color: rgba(0, 0, 0, 0.50);
                    text-shadow: 0 2px 12px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.12);
                    white-space: pre-line;
                }

                .hyf-bottom {
                    width: 100%;
                    display: flex;
                    justify-content: flex-start;
                    align-items: flex-end;
                    padding-bottom: 0;
                }

                .hyf-signature-row {
                    display: flex;
                    align-items: flex-end;
                    gap: clamp(12px, 1.8vw, 26px);
                    flex-wrap: wrap;
                }

                .hyf-signature {
                    width: auto;
                    margin: 0;
                    text-align: left;
                    font-family: "Murecho", "Inter", system-ui, sans-serif;
                    font-size: clamp(42px, 10.8vw, 214px);
                    line-height: 0.76;
                    font-weight: 300;
                    letter-spacing: clamp(0.08em, 0.55vw, 0.24em);
                    text-transform: uppercase;
                    white-space: nowrap;
                    color: rgba(0, 0, 0, 0.88);
                    pointer-events: none;
                }

                .hyf-signature-note {
                    margin: 0 0 0.18em;
                    font-family: "Murecho", "Inter", system-ui, sans-serif;
                    font-size: clamp(12px, 1vw, 15px);
                    font-weight: 400;
                    line-height: 1.35;
                    letter-spacing: 0.08em;
                    color: rgba(0, 0, 0, 0.62);
                    white-space: nowrap;
                    pointer-events: none;
                }

                @media (max-width: 768px) {
                    .hyf-ui {
                        padding:
                            calc(24px + env(safe-area-inset-top, 0px))
                            calc(20px + env(safe-area-inset-right, 0px))
                            0
                            calc(20px + env(safe-area-inset-left, 0px));
                    }

                    .hyf-hero {
                        width: 100%;
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
                        font-size: 14px;
                        line-height: 1.5;
                    }

                    .hyf-top {
                        font-size: 11px;
                        letter-spacing: 0.14em;
                    }

                    .hyf-signature {
                        font-size: clamp(34px, 11vw, 88px);
                        letter-spacing: clamp(0.08em, 0.9vw, 0.15em);
                    }

                    .hyf-signature-row {
                        gap: 10px;
                    }

                    .hyf-signature-note {
                        margin-bottom: 0.14em;
                        font-size: 11px;
                        letter-spacing: 0.06em;
                    }
                }

                @media (max-height: 760px) {
                    .hyf-ui {
                        padding-top: max(22px, env(safe-area-inset-top, 0px));
                        padding-bottom: 0;
                    }

                    .hyf-hero {
                        width: 100%;
                        padding-bottom: 28px;
                    }

                    .hyf-hero h1 {
                        font-size: clamp(62px, 10vw, 128px);
                    }

                    .hyf-zh {
                        margin-bottom: 14px;
                    }

                    .hyf-sub {
                        font-size: clamp(14px, 1.3vw, 18px);
                    }
                }

                @media (max-width: 900px) and (orientation: landscape) {
                    .hyf-ui {
                        padding:
                            calc(18px + env(safe-area-inset-top, 0px))
                            calc(18px + env(safe-area-inset-right, 0px))
                            0
                            calc(18px + env(safe-area-inset-left, 0px));
                    }

                    .hyf-hero {
                        width: 100%;
                        align-self: end;
                        padding-bottom: 16px;
                    }

                    .hyf-hero h1 {
                        font-size: clamp(42px, 8vw, 78px);
                    }

                    .hyf-sub {
                        font-size: 13px;
                    }

                    .hyf-top {
                        font-size: 10px;
                    }

                    .hyf-signature {
                        font-size: clamp(40px, 8vw, 108px);
                    }

                    .hyf-signature-note {
                        margin-bottom: 0.08em;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .hyf-title-line,
                    .hyf-reveal-word,
                    .hyf-reveal-char {
                        opacity: 1;
                        transform: none;
                        filter: none;
                        animation: none !important;
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
                        font-size: 13px;
                    }

                    .hyf-top {
                        gap: 12px;
                    }

                    .hyf-eyebrow {
                        display: none;
                    }

                    .hyf-signature {
                        font-size: clamp(30px, 10.5vw, 64px);
                        letter-spacing: clamp(0.06em, 0.7vw, 0.12em);
                    }

                    .hyf-signature-note {
                        font-size: 10px;
                        letter-spacing: 0.05em;
                    }
                }
            `}</style>

            <div ref={stageRef} className="hyf-stage">
                <img
                    ref={sourceImageRef}
                    className="hyf-source-image"
                    src={imageSrc}
                    crossOrigin="anonymous"
                    alt=""
                />
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
                        {profilePhoto && (
                            <div ref={avatarRef} className="hyf-avatar hyf-reveal-copy">
                                <img src={profilePhoto} alt="" />
                            </div>
                        )}
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
                        <div className="hyf-signature-row">
                            <div
                                ref={signatureRef}
                                className="hyf-signature hyf-reveal-char-copy"
                                style={{ ["--reveal-delay" as any]: "180ms" }}
                            >
                                {renderRevealCharacters("XUYUAN LIU")}
                            </div>
                            <p
                                ref={signatureNoteRef}
                                className="hyf-signature-note hyf-reveal-copy"
                                style={{ ["--reveal-delay" as any]: "760ms" }}
                            >
                                {renderRevealText(signatureNote)}
                            </p>
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
    profilePhoto: "",
    eyebrow: "Profile",
    titleLine1: "About",
    titleLine2: "Me.",
    titleZh: "",
    subtitle:
        "I'm a curious generalist with too many tabs open.\nI know a little about a lot, chase odd possibilities for fun, and lately I've been building with AI to see which ideas deserve to become real.",
    signatureNote: "This nightscape is my hometown, Chongqing.",
    scrollDemo: 0,
}

addPropertyControls(HongyadongFramer, {
    imageSrc: {
        type: ControlType.Image,
        title: "Particle Src",
    },
    profilePhoto: {
        type: ControlType.Image,
        title: "Profile Photo",
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
    signatureNote: {
        type: ControlType.String,
        title: "Note",
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
