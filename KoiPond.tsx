import * as React from "react"
import { useEffect, useMemo, useRef } from "react"
import { addPropertyControls, ControlType } from "framer"

type Props = {
    eyebrow: string
    titleMain: string
    titleSub: string
    tag: string
    feedText: string
    showScrollTip: boolean
    introDurationMs: number
    heroBoxXvw: number
}

export default function InkKoiEcosystem(props: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const fishCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const padCanvasRef = useRef<HTMLCanvasElement | null>(null)

    const uiBoxRef = useRef<HTMLDivElement | null>(null)
    const scrollTipRef = useRef<HTMLDivElement | null>(null)

    const feedCursorRef = useRef<HTMLDivElement | null>(null)
    const feedBtnRef = useRef<HTMLDivElement | null>(null)

    // 🌟 统一引入字体库
    const fontHref = useMemo(
        () =>
            "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Murecho:wght@300;400;500&family=Noto+Serif+SC:wght@200;300;400;500;600&family=JetBrains+Mono:wght@100..800&display=swap",
        []
    )

    useEffect(() => {
        const id = "ink-koi-fonts"
        if (!document.getElementById(id)) {
            const link = document.createElement("link")
            link.id = id
            link.rel = "stylesheet"
            link.href = fontHref
            document.head.appendChild(link)
        }
    }, [fontHref])

    useEffect(() => {
        const container = containerRef.current
        const canvas = fishCanvasRef.current
        const padCanvas = padCanvasRef.current

        const uiBox = uiBoxRef.current
        const scrollTip = scrollTipRef.current

        const feedCursor = feedCursorRef.current
        const feedBtn = feedBtnRef.current

        if (
            !container ||
            !canvas ||
            !padCanvas ||
            !uiBox ||
            !feedCursor ||
            !feedBtn
        )
            return

        // 🌟 乱码解码涌现动效 (Text Scramble)
        const doScramble = (el: HTMLElement) => {
            const original = el.getAttribute("data-text") || el.innerText
            if (!el.getAttribute("data-text"))
                el.setAttribute("data-text", original)
            const chars = "01X*$%&?<>[]+/"
            let frame = 0
            const maxFrames = 25
            const tick = () => {
                // 如果已经触发跳过，直接显示原文并终止
                if (el.getAttribute("data-skip") === "true") {
                    el.innerText = original
                    return
                }
                let current = ""
                for (let i = 0; i < original.length; i++) {
                    if (original[i] === " ") {
                        current += " "
                        continue
                    }
                    if (frame > maxFrames * (i / original.length)) {
                        current += original[i]
                    } else {
                        current +=
                            chars[Math.floor(Math.random() * chars.length)]
                    }
                }
                el.innerText = current
                frame++
                if (frame <= maxFrames) requestAnimationFrame(tick)
                else el.innerText = original
            }
            tick()
        }

        // 入场时触发乱码动画
        setTimeout(() => {
            if (uiBoxRef.current) {
                const scrambleEls =
                    uiBoxRef.current.querySelectorAll(".koi-scramble")
                scrambleEls.forEach((el) => doScramble(el as HTMLElement))
            }
        }, 500)

        // =========================
        // Utils
        // =========================
        const TWO_PI = Math.PI * 2
        const clamp = (v: number, a: number, b: number) =>
            Math.max(a, Math.min(b, v))
        const rand = (a: number, b: number) => a + Math.random() * (b - a)
        const dist = (ax: number, ay: number, bx: number, by: number) =>
            Math.hypot(ax - bx, ay - by)

        function angleDelta(a: number, b: number) {
            let d = b - a
            if (d > Math.PI) d -= TWO_PI
            if (d < -Math.PI) d += TWO_PI
            return d
        }
        function lerpAngle(a: number, b: number, t: number) {
            return a + angleDelta(a, b) * t
        }

        // =========================
        // Intro animation (JS Driven)
        // =========================
        function updateScrollEffects(scrollY: number) {
            const fishProgress = clamp(scrollY / 100, 0, 1)
            canvas.style.opacity = String(1 - Math.pow(1 - fishProgress, 2))

            const padProgress = clamp(scrollY / 160, 0, 1)
            padCanvas.style.opacity = String(1 - Math.pow(1 - padProgress, 2))

            if (scrollTip)
                scrollTip.style.opacity = String(Math.max(0, 1 - scrollY / 120))
        }

        // =========================
        // ✨ 新增：跳过动画逻辑
        // =========================
        let introSkipped = false
        const forceSkipIntro = () => {
            if (introSkipped) return
            introSkipped = true
            // 强制将滚动效果拉满 (280)
            updateScrollEffects(280)
            // 强制结束乱码
            if (uiBoxRef.current) {
                const scrambleEls =
                    uiBoxRef.current.querySelectorAll(".koi-scramble")
                scrambleEls.forEach((el) => {
                    el.setAttribute("data-skip", "true")
                    const original = el.getAttribute("data-text")
                    if (original) el.innerHTML = original
                })
            }
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") forceSkipIntro()
        }
        window.addEventListener("keydown", handleKeyDown)

        // =========================
        // Feed mode
        // =========================
        let feedMode = false
        let feedIntroShown = true
        const syncFeedUi = () => {
            container.classList.toggle("feed-mode", feedMode)
            feedCursor.style.display = feedMode ? "block" : "none"
            feedCursor.style.opacity = feedMode ? "1" : "0"
        }
        const setFeedCursorPosition = (x: number, y: number) => {
            feedCursor.style.left = x + "px"
            feedCursor.style.top = y + "px"
        }
        const onFeedClick = (e: MouseEvent) => {
            e.stopPropagation()
            if (feedIntroShown) {
                feedIntroShown = false
                uiBox.classList.add("dismissed")
                feedMode = true
            } else {
                feedMode = !feedMode
            }
            syncFeedUi()
            if (feedMode) setFeedCursorPosition(target.x, target.y)
        }
        const onFeedPointerDown = (e: PointerEvent) => {
            e.stopPropagation()
        }
        feedBtn.addEventListener("click", onFeedClick)
        feedBtn.addEventListener("pointerdown", onFeedPointerDown)

        // =========================
        // Canvas setup + quality
        // =========================
        const ctx = canvas.getContext("2d", { alpha: false })
        const padCtx = padCanvas.getContext("2d", { alpha: true })
        if (!ctx || !padCtx) return

        const hwCores = navigator.hardwareConcurrency || 4
        const deviceMemory =
            "deviceMemory" in navigator
                ? (navigator as any).deviceMemory || 4
                : 4
        const connection =
            "connection" in navigator
                ? (navigator as any).connection
                : undefined
        const saveData = !!connection?.saveData
        const isMobile = /Mobi|Android/i.test(navigator.userAgent)
        const prefersReduce =
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        const viewportArea = window.innerWidth * window.innerHeight
        let qualityTier: 0 | 1 | 2 = 2

        {
            let score = 0
            if (!isMobile)          score += 2
            if (hwCores >= 8)       score += 2
            else if (hwCores >= 6)  score += 1
            if (deviceMemory >= 8)      score += 2
            else if (deviceMemory >= 6) score += 1
            if (viewportArea <= 2_000_000) score += 1

            if (prefersReduce || saveData) {
                qualityTier = 0
            } else if (score >= 6) {
                qualityTier = 2
            } else if (score >= 3) {
                qualityTier = 1
            } else {
                qualityTier = 0
            }
        }

        let width = 0,
            height = 0,
            centerX = 0,
            centerY = 0,
            DPR = 1,
            viewScale = 1

        function applyCanvasFilter() {
            // DPR 已降低（tier2: 1.2, tier1: 0.9），物理像素更少，相同 blur 半径 GPU 工作量大幅减少
            // blur 从原来 3.2px 降到 1.5px，配合低 DPR，视觉模糊感相近但开销约少 5×
            canvas.style.filter =
                qualityTier >= 2
                    ? "blur(1.5px) contrast(1.15) brightness(0.93)"
                    : qualityTier === 1
                      ? "blur(0.8px) contrast(1.12) brightness(0.94)"
                      : "contrast(1.08) brightness(0.96)"
        }

        // =========================
        // Lily pads
        // =========================
        let lilyPads: any[] = []
        const lilyConfig = [
            // — right-top-center (偏内侧上方) —
            { x: 0.70, y: 0.04, r: 0.130, alpha: 0.44, rot: -0.28, seed: 27.7 },
            { x: 0.78, y: 0.13, r: 0.100, alpha: 0.38, rot: 0.32,  seed: 52.1 },
            { x: 0.65, y: 0.20, r: 0.080, alpha: 0.32, rot: -0.12, seed: 63.4 },
            { x: 0.73, y: 0.27, r: 0.064, alpha: 0.26, rot: 0.20,  seed: 41.6 },
            { x: 0.62, y: 0.32, r: 0.050, alpha: 0.21, rot: -0.42, seed: 92.3 },
            { x: 0.69, y: 0.38, r: 0.040, alpha: 0.16, rot: 0.14,  seed: 84.5 },
            // — right-top-corner (贴右上角) —
            { x: 0.93, y: 0.04, r: 0.110, alpha: 0.42, rot: 0.16,  seed: 11.2 },
            { x: 0.99, y: 0.13, r: 0.086, alpha: 0.36, rot: -0.38, seed: 44.8 },
            { x: 0.87, y: 0.19, r: 0.068, alpha: 0.30, rot: 0.44,  seed: 88.6 },
            { x: 0.95, y: 0.26, r: 0.054, alpha: 0.24, rot: -0.18, seed: 73.2 },
            { x: 0.84, y: 0.31, r: 0.042, alpha: 0.19, rot: 0.56,  seed: 18.9 },
            { x: 0.92, y: 0.37, r: 0.032, alpha: 0.14, rot: -0.30, seed: 35.7 },
            // — right-edge (右侧中部) —
            { x: 0.92, y: 0.42, r: 0.116, alpha: 0.40, rot: 0.48,  seed: 19.1 },
            { x: 0.99, y: 0.51, r: 0.090, alpha: 0.34, rot: -0.08, seed: 37.5 },
            { x: 0.86, y: 0.57, r: 0.072, alpha: 0.28, rot: 0.22,  seed: 15.6 },
            { x: 0.94, y: 0.64, r: 0.058, alpha: 0.22, rot: -0.34, seed: 56.4 },
            { x: 0.82, y: 0.69, r: 0.046, alpha: 0.17, rot: 0.38,  seed: 29.7 },
            { x: 0.89, y: 0.74, r: 0.034, alpha: 0.13, rot: -0.22, seed: 66.1 },
            // — right-bottom-corner (右下角) —
            { x: 0.90, y: 0.79, r: 0.112, alpha: 0.40, rot: 0.40,  seed: 77.3 },
            { x: 0.97, y: 0.88, r: 0.088, alpha: 0.34, rot: -0.20, seed: 71.9 },
            { x: 0.85, y: 0.93, r: 0.070, alpha: 0.28, rot: 0.18,  seed: 33.3 },
            { x: 0.99, y: 0.97, r: 0.056, alpha: 0.22, rot: -0.44, seed: 62.8 },
            { x: 0.81, y: 0.87, r: 0.044, alpha: 0.17, rot: 0.26,  seed: 47.1 },
            { x: 0.93, y: 0.98, r: 0.034, alpha: 0.13, rot: -0.12, seed: 53.9 },
        ]

        function rebuildLilyPads() {
            lilyPads = []
            const base = Math.min(width, height)
            for (const c of lilyConfig) {
                const r = base * c.r
                const rippleMax = 1.045
                const shadowFactor =
                    qualityTier >= 2 ? 0.18 : qualityTier === 1 ? 0.12 : 0.08
                const xEdgeInset = r * 0.92
                const yEdgeInsetRaw = r * (rippleMax + shadowFactor) + 2
                const yEdgeInset = Math.min(
                    Math.max(2, yEdgeInsetRaw),
                    Math.max(2, height * 0.5 - 2)
                )
                lilyPads.push({
                    x: clamp(width * c.x, xEdgeInset, width - xEdgeInset),
                    y: clamp(height * c.y, yEdgeInset, height - yEdgeInset),
                    r,
                    alpha: c.alpha,
                    phase: rand(0, TWO_PI),
                    speed: rand(0.0012, 0.0022),
                    seed: c.seed,
                    rotation: c.rot,
                    xMin: xEdgeInset,
                    xMax: width - xEdgeInset,
                    yMin: yEdgeInset,
                    yMax: height - yEdgeInset,
                })
            }

            for (let pass = 0; pass < 8; pass++) {
                for (let i = 0; i < lilyPads.length; i++) {
                    const a = lilyPads[i]
                    for (let j = i + 1; j < lilyPads.length; j++) {
                        const b = lilyPads[j]
                        const dx = b.x - a.x,
                            dy = b.y - a.y,
                            d = Math.hypot(dx, dy),
                            minD = (a.r + b.r) * 0.96
                        if (d >= minD) continue
                        let ux = 1,
                            uy = 0
                        if (d > 1e-4) {
                            ux = dx / d
                            uy = dy / d
                        } else {
                            const ang = rand(0, TWO_PI)
                            ux = Math.cos(ang)
                            uy = Math.sin(ang)
                        }
                        const push = (minD - d) * 0.5
                        a.x -= ux * push
                        a.y -= uy * push
                        b.x += ux * push
                        b.y += uy * push
                    }
                }
                for (const p of lilyPads) {
                    p.x = clamp(p.x, p.xMin, p.xMax)
                    p.y = clamp(p.y, p.yMin, p.yMax)
                }
            }
        }

        function resize() {
            const prevW = width, prevH = height

            // 降 DPR 上限：CSS 将画布拉伸到 100%，浏览器双线性插值产生自然柔化，替代原来的 CSS blur
            DPR =
                qualityTier >= 2
                    ? Math.min(1.2, window.devicePixelRatio || 1)
                    : qualityTier === 1
                      ? Math.min(0.9, window.devicePixelRatio || 1)
                      : 0.75
            const r = container.getBoundingClientRect()
            width = r.width
            height = r.height
            viewScale = Math.min(1.8, Math.max(0.45, Math.min(width, height) / 700))
            canvas.width = Math.floor(width * DPR)
            canvas.height = Math.floor(height * DPR)
            canvas.style.width = width + "px"
            canvas.style.height = height + "px"
            padCanvas.width = Math.floor(width * DPR)
            padCanvas.height = Math.floor(height * DPR)
            padCanvas.style.width = width + "px"
            padCanvas.style.height = height + "px"
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
            padCtx.setTransform(DPR, 0, 0, DPR, 0, 0)
            centerX = width / 2
            centerY = height / 2
            applyCanvasFilter()

            // 按比例重算所有活跃实体的位置（首次调用时 prevW=0，跳过）
            if (prevW > 0 && prevH > 0) {
                const rx = width / prevW, ry = height / prevH
                for (const f of fishes)        { f.x *= rx; f.y *= ry }
                for (const p of foodParticles) { p.x *= rx; p.y *= ry }
                for (const e of eggs)          { e.x *= rx; e.y *= ry }
            }

            rebuildLilyPads()
        }

        const onResize = () => resize()
        window.addEventListener("resize", onResize, { passive: true })
        resize()

        let target = { x: centerX, y: centerY, hasMoved: false }
        const getPointerPos = (clientX: number, clientY: number) => {
            const rect = container.getBoundingClientRect()
            return { x: clientX - rect.left, y: clientY - rect.top }
        }
        const onPointerMove = (e: PointerEvent) => {
            const pos = getPointerPos(e.clientX, e.clientY)
            target.x = pos.x
            target.y = pos.y
            target.hasMoved = true
            if (feedMode) {
                feedCursor.style.opacity = "1"
                setFeedCursorPosition(pos.x, pos.y)
            }
        }
        const onPointerLeave = () => {
            if (feedMode) feedCursor.style.opacity = "0"
        }
        container.addEventListener("pointermove", onPointerMove, {
            passive: true,
        })
        container.addEventListener("pointerleave", onPointerLeave)

        const currentAt = (now: number, x: number, y: number) => {
            const t = now * 0.001
            const cx =
                Math.sin(t * 0.35 + x * 0.003) * 0.22 +
                Math.sin(t * 0.12 + y * 0.002) * 0.12
            const cy =
                Math.cos(t * 0.28 + y * 0.003) * 0.1 +
                Math.sin(t * 0.15 + x * 0.002) * 0.06
            return { cx, cy }
        }

        class FoodParticle {
            x: number
            y: number
            vx: number
            vy: number
            r: number
            wob: number
            alive: boolean
            dropScale: number
            birthTime: number
            lifeMs: number
            constructor(x: number, y: number) {
                this.x = x
                this.y = y
                this.vx = rand(-0.65, 0.65)
                this.vy = rand(0.55, 1.65)
                this.r = rand(2.8, 4.2)
                this.wob = rand(0, TWO_PI)
                this.alive = true
                this.dropScale = 2.5
                this.birthTime = performance.now()
                this.lifeMs = rand(7000, 11000)
            }
            update(now: number, dt: number) {
                this.wob += 0.05 * dt
                const c = currentAt(now, this.x, this.y)
                this.vx += (Math.sin(this.wob) * 0.01 + c.cx * 0.06) * dt
                this.vy += c.cy * 0.02 * dt
                this.vx *= 1 - (1 - 0.965) * dt
                this.vy *= 1 - (1 - 0.965) * dt
                this.vy += 0.012 * dt
                this.x += this.vx * dt
                this.y += (this.vy + Math.sin(this.wob) * 0.05) * dt
                if (this.dropScale > 1.0) this.dropScale -= 0.1 * dt
                if (this.y > height - 18) {
                    this.y = height - 18
                    this.vy *= 0.25
                    this.vx *= 0.85
                }
                if (this.x < 16) {
                    this.x = 16
                    this.vx *= -0.25
                }
                if (this.x > width - 16) {
                    this.x = width - 16
                    this.vx *= -0.25
                }
                if (now - this.birthTime > this.lifeMs) this.alive = false
            }
            draw(now: number) {
                if (!this.alive) return
                const currentR = this.r * Math.max(1, this.dropScale),
                    age = now - this.birthTime
                const fade = clamp(
                    1 - (age - (this.lifeMs - 1200)) / 1200,
                    0,
                    1
                )
                ctx.save()
                ctx.globalCompositeOperation = "source-over"
                ctx.globalAlpha = 0.92 * fade
                ctx.fillStyle = "#d0d0d0"
                ctx.beginPath()
                ctx.arc(this.x, this.y, currentR, 0, TWO_PI)
                ctx.fill()
                ctx.globalAlpha = 0.72 * fade
                ctx.fillStyle = "#ffffff"
                ctx.beginPath()
                ctx.arc(
                    this.x - currentR * 0.25,
                    this.y - currentR * 0.3,
                    currentR * 0.4,
                    0,
                    TWO_PI
                )
                ctx.fill()
                ctx.restore()
            }
        }

        class Egg {
            x: number
            y: number
            r: number
            vx: number
            vy: number
            wob: number
            typeHint: string
            pulse: number
            birthTime: number
            constructor(x: number, y: number, typeHint = "yamabuki") {
                this.x = x
                this.y = y
                this.r = rand(10, 14)
                this.vx = rand(-0.08, 0.08)
                this.vy = rand(-0.1, 0.12)
                this.wob = rand(0, TWO_PI)
                this.typeHint = typeHint
                this.pulse = rand(0, TWO_PI)
                this.birthTime = performance.now()
            }
            hitTest(px: number, py: number) {
                return dist(this.x, this.y, px, py) <= this.r * 2.0
            }
            update() {
                this.wob += 0.02
                this.pulse += 0.045
                this.x += this.vx + Math.sin(this.wob) * 0.08
                this.y += this.vy + Math.cos(this.wob) * 0.06
                const m = 50
                this.x = clamp(this.x, m, width - m)
                this.y = clamp(this.y, m, height - m)
            }
            draw() {
                const glow = 0.35 + 0.2 * Math.sin(this.pulse)
                ctx.save()
                ctx.globalCompositeOperation = "screen"
                ctx.fillStyle = `rgba(240, 235, 225, ${0.1 + glow * 0.1})`
                ctx.beginPath()
                ctx.arc(this.x, this.y, this.r * 2.1, 0, TWO_PI)
                ctx.fill()
                ctx.globalCompositeOperation = "source-over"
                ctx.fillStyle = `rgba(235, 232, 225, 0.55)`
                ctx.strokeStyle = `rgba(255,255,255, ${0.18 + glow * 0.08})`
                ctx.lineWidth = 1.1
                ctx.beginPath()
                ctx.ellipse(
                    this.x,
                    this.y,
                    this.r * 1.05,
                    this.r * 0.85,
                    0.2,
                    0,
                    TWO_PI
                )
                ctx.fill()
                ctx.stroke()
                ctx.globalCompositeOperation = "screen"
                ctx.fillStyle = `rgba(220, 220, 220, ${0.1 + glow * 0.1})`
                ctx.beginPath()
                ctx.ellipse(
                    this.x + this.r * 0.15,
                    this.y + this.r * 0.1,
                    this.r * 0.52,
                    this.r * 0.4,
                    -0.15,
                    0,
                    TWO_PI
                )
                ctx.fill()
                ctx.restore()
            }
        }

        class Koi {
            x: number
            y: number
            angle: number
            numSegments: number
            segments: any[]
            baseScale: number
            fat: number
            fatTarget: number
            segLength: number
            baseProfile: number[]
            baseRadii: number[]
            isBig!: boolean
            isSmall!: boolean
            _bodyPts!: {x:number,y:number}[]
            _bodyPath: Path2D = new Path2D()
            _cachedRadii: number[] = []
            _lastFatForRadii: number = -999
            baseSpeed: number
            chaseSpeed: number
            currentSpeed: number
            turnLerp: number
            maxTurnPerFrame: number
            swimCycle: number
            wanderPhase: number
            targetFood: any
            eatRadius: number
            finPhase: number
            retargetTick: number
            type: string
            colors: any
            patterns: any[]
            feedingStyle: "precise" | "rush"
            missCooldown: number
            loopTimer: number
            loopDir: 1 | -1
            loopRadius: number

            constructor(x: number, y: number, type: string, scale = 1) {
                this.x = x
                this.y = y
                this.angle = Math.random() * TWO_PI
                this.numSegments = 24
                this._bodyPts = Array.from({ length: 48 }, () => ({ x: 0, y: 0 }))
                this.segments = Array.from(
                    { length: this.numSegments },
                    () => ({ x, y, angle: 0 })
                )
                this.baseScale = scale * 0.7
                this.fat = 0.92
                this.fatTarget = 0.92
                const elongation = 1 + Math.max(0, this.baseScale - 0.7) * 0.08
                this.segLength = 6.2 * this.baseScale * elongation
                this.baseProfile = [
                    7.2, 10.1, 13.2, 16.6, 19.2, 21.0, 22.4, 23.3, 23.9, 24.3,
                    24.7, 24.9, 24.8, 24.2, 23.0, 21.2, 19.0, 16.7, 14.6, 12.7,
                    11.0, 9.5, 8.2, 7.1,
                ]
                const slimMult = Math.min(0.96, 0.82 + this.baseScale * 0.18)
                this.baseRadii = this.baseProfile.map(
                    (r) => r * this.baseScale * slimMult
                )

                this.isBig   = this.baseScale >= 1.5
                this.isSmall = this.baseScale < 0.65
                this.baseSpeed  = Math.max(0.42, 1.0 - this.baseScale * 0.26)
                this.chaseSpeed = Math.max(1.5,  2.1 - this.baseScale * 0.20)
                this.currentSpeed = this.baseSpeed
                // ✨ 略微增加转身灵活性
                this.turnLerp = 0.08
                this.maxTurnPerFrame = 0.05

                this.swimCycle = Math.random() * 100
                this.wanderPhase = Math.random() * 100
                this.targetFood = null
                this.eatRadius = Math.max(12, 32 - this.baseScale * 14)
                this.finPhase = rand(0, TWO_PI)
                this.retargetTick = Math.floor(rand(0, 3))

                if (type === "kohaku") {
                    this.type = "kohaku"
                    this.colors = {
                        base: "rgba(235, 234, 228, 0.95)",
                        pattern: "rgba(195, 42, 42, 0.9)",
                        fin: "rgba(252, 252, 250, 0.58)",
                        finEdge: "rgba(255,255,255,0.25)",
                        inkEdge: "rgba(10, 14, 18, 0.20)",
                    }
                } else if (type === "sanke") {
                    this.type = "sanke"
                    this.colors = {
                        base: "rgba(240, 238, 234, 0.95)",
                        pattern: "rgba(190, 42, 42, 0.9)",
                        fin: "rgba(252, 252, 250, 0.50)",
                        finEdge: "rgba(255,255,255,0.25)",
                        inkEdge: "rgba(8, 10, 14, 0.26)",
                    }
                } else if (type === "showa") {
                    this.type = "showa"
                    this.colors = {
                        base: "rgba(22, 18, 24, 0.96)",
                        pattern: "rgba(185, 38, 38, 0.92)",
                        fin: "rgba(88, 78, 108, 0.65)",
                        finEdge: "rgba(210, 220, 240, 0.30)",
                        inkEdge: "rgba(255,255,255,0.06)",
                        rimLight: "rgba(180, 210, 255, 0.90)",
                    }
                } else {
                    this.type = "yamabuki"
                    this.colors = {
                        base: "rgba(244, 240, 232, 0.95)",
                        pattern: "rgba(215, 150, 45, 0.9)",
                        fin: "rgba(252, 252, 248, 0.58)",
                        finEdge: "rgba(255,255,255,0.25)",
                        inkEdge: "rgba(10, 14, 18, 0.18)",
                    }
                }
                this.patterns = this._genPatterns(this.type)
                this.feedingStyle = this.isBig ? "precise" : this.isSmall ? "rush" : (Math.random() < 0.55 ? "precise" : "rush")
                this.missCooldown = 0
                this.loopTimer = 0
                this.loopDir = Math.random() < 0.5 ? 1 : -1
                this.loopRadius = 60 * this.scale
            }

            _genPatterns(type: string) {
                const spots: any[] = []
                const n = Math.floor(rand(2, 5))
                for (let i = 0; i < n; i++) {
                    const zStart = 3 + (i * 16) / n
                    const segIdx = clamp(
                        Math.floor(rand(zStart, zStart + 16 / n)),
                        3,
                        19
                    )
                    const col =
                        type === "yamabuki"
                            ? "rgba(215, 150, 45, 0.9)"
                            : "rgba(195, 42, 42, 0.9)"
                    spots.push({
                        seg: segIdx,
                        size: rand(1.0, 1.6),
                        seed: rand(0, 100),
                        color: col,
                    })
                }
                if (type === "sanke") {
                    const m = Math.floor(rand(1, 3))
                    for (let i = 0; i < m; i++)
                        spots.push({
                            seg: Math.floor(rand(4, 18)),
                            size: rand(0.5, 0.85),
                            seed: rand(0, 100),
                            color: "rgba(16, 16, 22, 0.82)",
                        })
                }
                if (type === "showa") {
                    const rn = Math.floor(rand(2, 4))
                    for (let i = 0; i < rn; i++) {
                        spots.push({
                            seg: clamp(
                                Math.floor(
                                    rand(
                                        3 + (i * 14) / rn,
                                        3 + (i * 14) / rn + 14 / rn
                                    )
                                ),
                                3,
                                18
                            ),
                            size: rand(0.9, 1.6),
                            seed: rand(0, 100),
                            color: "rgba(185, 38, 38, 0.92)",
                        })
                    }
                    const yn = Math.floor(rand(1, 3))
                    for (let i = 0; i < yn; i++)
                        spots.push({
                            seg: Math.floor(rand(4, 17)),
                            size: rand(0.7, 1.2),
                            seed: rand(0, 100),
                            color: "rgba(215, 165, 30, 0.88)",
                        })
                }
                return spots
            }

            get scale() {
                return this.baseScale
            }
            get radii() {
                if (Math.abs(this.fat - this._lastFatForRadii) < 0.0015) return this._cachedRadii
                const f = this.fat,
                    n = this.numSegments - 1
                this._cachedRadii = this.baseRadii.map((r, i) => {
                    const t = i / n,
                        bodyT = clamp((t - 0.08) / 0.84, 0, 1),
                        bellyT = clamp((t - 0.22) / 0.58, 0, 1)
                    const bodyCurve = Math.sin(Math.PI * bodyT),
                        bellyCurve = Math.sin(Math.PI * bellyT)
                    const headKeep = clamp((t - 0.1) / 0.22, 0, 1)
                    const fatInfluence = 0.25 + 0.75 * headKeep
                    return (
                        r *
                        (1 +
                            (f - 1) *
                                (0.42 + 0.18 * bodyCurve + 0.42 * bellyCurve) *
                                (0.98 + fatInfluence * 0.02))
                    )
                })
                this._lastFatForRadii = this.fat
                return this._cachedRadii
            }

            chooseFood(foodParticles: any[]) {
                let best = null,
                    bestD = Infinity
                const detectRange = this.isBig ? 2400 * this.scale : this.isSmall ? 900 * this.scale : 1700 * this.scale
                for (const p of foodParticles) {
                    if (!p.alive) continue
                    const d = dist(this.x, this.y, p.x, p.y)
                    if (d < bestD && d < detectRange) {
                        bestD = d
                        best = p
                    }
                }
                return best
            }

            update(
                fishes: any[],
                foodParticles: any[],
                eggs: any[],
                now: number,
                dt: number
            ) {
                this.fat += (this.fatTarget - this.fat) * 0.04 * dt
                this.missCooldown = Math.max(0, this.missCooldown - dt)
                this.loopTimer = Math.max(0, this.loopTimer - dt)

                const tr = this.isBig
                    ? Math.max(0.018, 0.055 - this.baseScale * 0.018)
                    : this.isSmall
                        ? Math.max(0.055, 0.14 - this.baseScale * 0.04)
                        : Math.max(0.028, 0.086 - this.baseScale * 0.042)
                let desiredAngle = this.angle,
                    desiredSpeed = this.baseSpeed,
                    isHunting = false
                let edgeTurn = false
                const targetCX = centerX,
                    targetCY = centerY
                const safeMargin = Math.max(90, 120 * this.scale)

                if (
                    this.x < safeMargin ||
                    this.x > width - safeMargin ||
                    this.y < safeMargin ||
                    this.y > height - safeMargin
                )
                    edgeTurn = true

                this.retargetTick = (this.retargetTick + 1) % 2
                if (
                    !this.targetFood ||
                    !this.targetFood.alive ||
                    this.retargetTick === 0
                ) {
                    const cand = this.chooseFood(foodParticles)
                    if (!this.targetFood || !this.targetFood.alive)
                        this.targetFood = cand
                    else if (cand && cand.alive) {
                        const curD = dist(
                            this.x,
                            this.y,
                            this.targetFood.x,
                            this.targetFood.y
                        )
                        const newD = dist(this.x, this.y, cand.x, cand.y)
                        if (newD < curD * 0.85) this.targetFood = cand
                    }
                }

                if (edgeTurn) {
                    const centerAngle = Math.atan2(
                        targetCY - this.y,
                        targetCX - this.x
                    )
                    this.maxTurnPerFrame = tr * 1.9
                    this.turnLerp = tr * 1.6
                    if (this.targetFood && this.targetFood.alive) {
                        isHunting = true
                        const foodAngle = Math.atan2(
                            this.targetFood.y - this.y,
                            this.targetFood.x - this.x
                        )
                        desiredAngle = lerpAngle(foodAngle, centerAngle, 0.35)
                        desiredSpeed = this.chaseSpeed * 0.85
                    } else {
                        desiredAngle = lerpAngle(this.angle, centerAngle, 0.15)
                        desiredSpeed = this.baseSpeed * 0.8
                    }
                } else if (this.targetFood) {
                    isHunting = true
                    const dx = this.targetFood.x - this.x,
                        dy = this.targetFood.y - this.y
                    const d = Math.hypot(dx, dy),
                        targetAngle = Math.atan2(dy, dx)
                    const farD = 520 * this.scale,
                        midD = 240 * this.scale,
                        nearD = 110 * this.scale

                    if (this.feedingStyle === "precise") {
                        const nearTurnBoost = clamp((nearD - d) / nearD, 0, 1)
                        this.maxTurnPerFrame =
                            tr * (1.35 + nearTurnBoost * 1.25)
                        this.turnLerp = tr * (1.0 + nearTurnBoost * 0.9)
                        if (d > farD) {
                            desiredAngle = targetAngle
                            desiredSpeed = this.chaseSpeed * 1.55
                        } else if (d > midD) {
                            const k = clamp((d - midD) / (farD - midD), 0, 1)
                            desiredAngle = targetAngle
                            desiredSpeed = this.chaseSpeed * (1.12 + 0.42 * k)
                        } else if (d > nearD) {
                            const k = clamp((d - nearD) / (midD - nearD), 0, 1)
                            desiredAngle = targetAngle
                            desiredSpeed = this.chaseSpeed * (0.86 + 0.38 * k)
                        } else {
                            desiredAngle =
                                targetAngle +
                                Math.sin(this.swimCycle * 1.6) * 0.06
                            desiredSpeed = Math.max(
                                this.baseSpeed * 0.35,
                                this.chaseSpeed * 0.48
                            )
                        }
                    } else {
                        if (this.loopTimer > 0) {
                            const cx = this.targetFood.x,
                                cy = this.targetFood.y
                            const angToCenter = Math.atan2(
                                this.y - cy,
                                this.x - cx
                            )
                            desiredAngle = lerpAngle(
                                angToCenter + (this.loopDir * Math.PI) / 2,
                                Math.atan2(cy - this.y, cx - this.x),
                                0.08
                            )
                            desiredSpeed = this.chaseSpeed * 1.18
                            this.maxTurnPerFrame = tr * 1.1
                            this.turnLerp = tr * 0.85
                        } else {
                            this.maxTurnPerFrame = tr * 1.05
                            this.turnLerp = tr * 0.75
                            if (d > farD) {
                                desiredAngle = targetAngle
                                desiredSpeed = this.chaseSpeed * 1.75
                            } else if (d > midD) {
                                desiredAngle = targetAngle
                                desiredSpeed =
                                    this.chaseSpeed *
                                    (1.2 +
                                        0.55 *
                                            clamp(
                                                (d - midD) / (farD - midD),
                                                0,
                                                1
                                            ))
                            } else {
                                desiredAngle = targetAngle
                                desiredSpeed = this.chaseSpeed * 1.16
                            }
                        }
                    }
                } else {
                    this.maxTurnPerFrame = tr * 0.85
                    this.turnLerp = tr * 0.7
                    const dx = target.x - this.x,
                        dy = target.y - this.y,
                        d = Math.hypot(dx, dy)
                    if (feedMode && target.hasMoved && d < 380) {
                        desiredAngle = Math.atan2(dy, dx)
                        desiredSpeed =
                            d < 90
                                ? this.baseSpeed * 0.4
                                : this.baseSpeed + 0.05
                    } else {
                        this.wanderPhase += 0.005 * dt
                        const w =
                            Math.sin(this.wanderPhase) * 0.18 +
                            Math.sin(this.wanderPhase * 0.47) * 0.1
                        desiredAngle = this.angle + w * 0.06
                        desiredSpeed = this.baseSpeed
                    }
                }

                if (this.targetFood && this.targetFood.alive) {
                    const _fd = dist(
                        this.x,
                        this.y,
                        this.targetFood.x,
                        this.targetFood.y
                    )
                    if (_fd < this.eatRadius) {
                        if (
                            this.feedingStyle === "rush" &&
                            this.missCooldown === 0
                        ) {
                            if (
                                this.currentSpeed > this.chaseSpeed * 1.15 &&
                                Math.random() < 0.55
                            ) {
                                this.loopTimer = Math.floor(rand(45, 85))
                                this.loopRadius = 60 * this.scale
                                this.missCooldown = 28
                                this.currentSpeed = Math.max(
                                    this.currentSpeed,
                                    this.chaseSpeed * 1.12
                                )
                                return
                            }
                        }
                        this.targetFood.alive = false
                        this.targetFood = null
                        const maturity = clamp(
                            (this.baseScale - 1.4) / 1.0,
                            0,
                            1
                        )
                        const fatGain =
                            rand(0.0015, 0.0045) + maturity * rand(0.007, 0.014)
                        this.fatTarget = clamp(
                            this.fatTarget + fatGain,
                            1.0,
                            1.25 + maturity * 0.95
                        )
                        this.baseScale += 0.008 / Math.max(0.8, this.baseScale)
                        this.segLength =
                            6.2 *
                            this.baseScale *
                            (1 + Math.max(0, this.baseScale - 0.7) * 0.08)

                        this.isBig   = this.baseScale >= 1.5
                        this.isSmall = this.baseScale < 0.65
                        this.baseSpeed  = Math.max(0.42, 1.0 - this.baseScale * 0.26)
                        this.chaseSpeed = Math.max(1.5,  2.1 - this.baseScale * 0.20)

                        this.eatRadius = Math.max(10, 36 - this.baseScale * 12)
                        this.baseRadii = this.baseProfile.map(
                            (r) =>
                                r *
                                this.baseScale *
                                Math.min(0.96, 0.82 + this.baseScale * 0.18)
                        )
                        this._lastFatForRadii = -999 // invalidate radii cache

                        if (this.fatTarget >= 1.18 && this.baseScale >= 0.75) {
                            const extra = clamp(
                                (this.baseScale - 0.9) / 0.45,
                                0,
                                3
                            )
                            const eggCount =
                                1 +
                                Math.floor(
                                    extra + (Math.random() < 0.6 ? 1 : 0)
                                )
                            const canAdd = Math.max(
                                0,
                                Math.min(
                                    eggCount,
                                    maxFishCount - fishes.length,
                                    eggCap - eggs.length
                                )
                            )
                            for (let k = 0; k < canAdd; k++) {
                                eggs.push(
                                    new Egg(
                                        this.x + rand(-15, 15),
                                        this.y + rand(-15, 15),
                                        this.type
                                    )
                                )
                            }
                            this.fatTarget -=
                                0.12 + 0.04 * Math.min(2, Math.floor(extra))
                        }
                    }
                }

                let sepX = 0,
                    sepY = 0,
                    sepStr = 0
                for (const other of fishes) {
                    if (other === this) continue
                    const dx = this.x - other.x, dy = this.y - other.y
                    const minD = (this.scale + other.scale) * 55
                    // AABB fast-reject: skip hypot if both axes exceed minD
                    if (Math.abs(dx) > minD && Math.abs(dy) > minD) continue
                    const d = Math.hypot(dx, dy)
                    if (d > 0 && d < minD) {
                        const s = Math.pow((minD - d) / minD, 1.5)
                        sepX += (dx / d) * s
                        sepY += (dy / d) * s
                        sepStr = Math.max(sepStr, s)
                    }
                    // Small fish flee from big fish
                    if (this.isSmall && !other.isSmall) {
                        const fleeD = (this.scale + other.scale) * 120
                        if (d > 0 && d < fleeD) {
                            const fs = Math.pow((fleeD - d) / fleeD, 1.2) * 0.6
                            sepX += (dx / d) * fs
                            sepY += (dy / d) * fs
                            sepStr = Math.max(sepStr, fs)
                        }
                    }
                }
                if (sepStr > 0) {
                    const mix = (isHunting ? 0.22 : 0.12) * (0.4 + sepStr)
                    desiredAngle = lerpAngle(
                        desiredAngle,
                        Math.atan2(sepY, sepX),
                        clamp(mix, 0, 0.26)
                    )
                    desiredSpeed *= 1 + sepStr * 0.03
                }

                const dA = angleDelta(this.angle, desiredAngle)
                this.angle += clamp(
                    dA * this.turnLerp * dt,
                    -this.maxTurnPerFrame * dt,
                    this.maxTurnPerFrame * dt
                )

                const sDiff = desiredSpeed - this.currentSpeed
                this.currentSpeed += sDiff * (sDiff > 0 ? 0.2 : 0.05) * dt

                this.x += Math.cos(this.angle) * this.currentSpeed * dt
                this.y += Math.sin(this.angle) * this.currentSpeed * dt
                this.x = clamp(this.x, -50, width + 50)
                this.y = clamp(this.y, -50, height + 50)

                const speedRatio = clamp(
                    this.currentSpeed / this.baseSpeed,
                    0.5,
                    4.0
                )
                const tailFreq = this.isBig ? 0.75 : this.isSmall ? 1.4 : 1.0
                this.swimCycle +=
                    (isHunting ? 0.05 : 0.035) *
                    tailFreq *
                    speedRatio *
                    (1 + Math.max(0, this.fat - 1.0) * 0.55) *
                    dt

                this.segments[0].x = this.x
                this.segments[0].y = this.y
                this.segments[0].angle = this.angle

                for (let i = 1; i < this.numSegments; i++) {
                    const prev = this.segments[i - 1],
                        curr = this.segments[i],
                        t = i / (this.numSegments - 1)
                    let a = Math.atan2(prev.y - curr.y, prev.x - curr.x)
                    let bend = angleDelta(prev.angle, a),
                        MAX_BEND = Math.max(0.14, 0.3 - this.baseScale * 0.1)
                    if (Math.abs(bend) > MAX_BEND)
                        a = prev.angle + Math.sign(bend) * MAX_BEND
                    a += Math.sin(this.swimCycle - t * 3.5) * (t * 0.035)
                    curr.x = prev.x - Math.cos(a) * this.segLength
                    curr.y = prev.y - Math.sin(a) * this.segLength
                    curr.angle = a
                }
                // Cache body outline once per update — reused 2-3× in drawBody
                this._buildBodyPts()
            }

            draw() {
                this.drawFins()
                this.drawBody()
                this.drawDorsalFin()
                this.drawCaudalFin()
                this.drawEye()
            }

            // Build body outline points once per frame (called from update())
            _buildBodyPts() {
                const radii = this.radii
                const n = this.numSegments
                const pts = this._bodyPts
                for (let i = 0; i < n; i++) {
                    const s = this.segments[i], r = radii[i]
                    const pc = Math.cos(s.angle + Math.PI / 2)
                    const ps = Math.sin(s.angle + Math.PI / 2)
                    pts[i].x = s.x + pc * r
                    pts[i].y = s.y + ps * r
                    const li = 2 * n - 1 - i
                    pts[li].x = s.x - pc * r
                    pts[li].y = s.y - ps * r
                }
                // Build Path2D once — reused 3× in drawBody instead of _tracePath each time
                const path = new Path2D()
                const end = pts.length - 1
                path.moveTo(pts[0].x, pts[0].y)
                for (let i = 1; i < end; i++)
                    path.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i+1].x) / 2, (pts[i].y + pts[i+1].y) / 2)
                path.quadraticCurveTo(pts[end].x, pts[end].y, pts[0].x, pts[0].y)
                this._bodyPath = path
            }

drawBody() {
                ctx.save()
                ctx.globalCompositeOperation = "source-over"
                ctx.lineJoin = "round"
                ctx.lineCap = "round"
                // 1. 边缘光晕（最外层，昭和专属）
                if (this.colors.rimLight && qualityTier >= 2) {
                    ctx.save()
                    ctx.strokeStyle = this.colors.rimLight
                    ctx.lineJoin = "round"
                    ctx.lineCap = "round"
                    ctx.globalAlpha = 0.10
                    ctx.lineWidth = 10 * this.scale
                    ctx.stroke(this._bodyPath)
                    ctx.globalAlpha = 0.22
                    ctx.lineWidth = 5 * this.scale
                    ctx.stroke(this._bodyPath)
                    ctx.globalAlpha = 0.50
                    ctx.lineWidth = 2 * this.scale
                    ctx.stroke(this._bodyPath)
                    ctx.restore()
                }
                // 2. 鱼体底色
                ctx.fillStyle = this.colors.base
                ctx.fill(this._bodyPath)
                // 3. 花纹 — clip 用缓存的 Path2D，省去路径重新遍历；背景不透明故 source-atop 无效
                ctx.save()
                ctx.clip(this._bodyPath)
                const patternLimit = qualityTier === 0 ? 2 : this.patterns.length
                for (let pi = 0; pi < patternLimit; pi++) {
                    const p = this.patterns[pi]
                    ctx.fillStyle = p.color
                    this.drawOrganicSpot(this.segments[p.seg], p.size, p.seed)
                }
                ctx.restore()
                // 4. 墨边描边
                ctx.strokeStyle = this.colors.inkEdge
                ctx.lineWidth = 1.0 * this.scale
                ctx.stroke(this._bodyPath)
                ctx.restore()
            }

            drawOrganicSpot(seg: any, sizeMult: number, seed: number) {
                const baseSize = 13 * this.scale * sizeMult
                ctx.beginPath()
                ctx.ellipse(seg.x, seg.y, baseSize, baseSize * 0.72, seg.angle, 0, TWO_PI)
                if (qualityTier > 0) {
                    const rr = (o: number) => Math.sin(seed + o) * baseSize * 0.36
                    ctx.ellipse(seg.x + rr(1), seg.y + rr(2), baseSize * 0.85, baseSize * 1.1, seg.angle + 0.35, 0, TWO_PI)
                    ctx.ellipse(seg.x + rr(3), seg.y + rr(4), baseSize * 1.05, baseSize * 0.62, seg.angle - 0.55, 0, TWO_PI)
                }
                ctx.fill()
            }

            finSwayAmp() {
                return (
                    0.15 +
                    clamp(
                        (this.currentSpeed - this.baseSpeed) /
                            (this.chaseSpeed - this.baseSpeed + 1e-6),
                        0,
                        1
                    ) *
                        0.2
                )
            }

            drawFins() {
                ctx.save()
                ctx.globalCompositeOperation = "source-over"
                ctx.fillStyle = this.colors.fin
                ctx.strokeStyle = this.colors.finEdge
                ctx.lineWidth = 1.15 * this.scale
                ctx.lineJoin = "round"
                ctx.lineCap = "round"
                const amp = this.finSwayAmp(),
                    t = this.swimCycle,
                    ph = this.finPhase
                this.drawPectoralFin(this.segments[6], true, amp, ph, t)
                this.drawPectoralFin(this.segments[6], false, amp, ph, t)
                this.drawPelvicFin(this.segments[13], true, amp, ph, t)
                this.drawPelvicFin(this.segments[13], false, amp, ph, t)
                ctx.restore()
            }

            drawPectoralFin(
                seg: any,
                isRight: boolean,
                amp: number,
                ph: number,
                t: number
            ) {
                const len = 48 * this.scale * (1 + (this.fat - 1.25) * 0.65),
                    dir = isRight ? 1 : -1
                const angle =
                    seg.angle +
                    Math.PI * 0.75 * dir +
                    Math.sin(t * 1.2 + ph) * amp * dir
                const rootX = seg.x,
                    rootY = seg.y
                const leadA = angle - 0.3 * dir,
                    leadX = rootX + Math.cos(leadA) * len * 0.95,
                    leadY = rootY + Math.sin(leadA) * len * 0.95
                const cpLeadX = rootX + Math.cos(angle - 0.6 * dir) * len * 0.7,
                    cpLeadY = rootY + Math.sin(angle - 0.6 * dir) * len * 0.7
                const trailA = angle + 0.4 * dir,
                    trailX = rootX + Math.cos(trailA) * len * 0.65,
                    trailY = rootY + Math.sin(trailA) * len * 0.65
                const cpTrailX =
                        rootX + Math.cos(angle + 0.6 * dir) * len * 0.35,
                    cpTrailY = rootY + Math.sin(angle + 0.6 * dir) * len * 0.35
                const tipX = rootX + Math.cos(angle) * len * 1.1,
                    tipY = rootY + Math.sin(angle) * len * 1.1
                ctx.beginPath()
                ctx.moveTo(rootX, rootY)
                ctx.quadraticCurveTo(cpLeadX, cpLeadY, leadX, leadY)
                ctx.quadraticCurveTo(tipX, tipY, trailX, trailY)
                ctx.quadraticCurveTo(cpTrailX, cpTrailY, rootX, rootY)
                ctx.closePath()
                ctx.fill()
                ctx.stroke()
                if (qualityTier === 0) return
                ctx.save()
                ctx.globalAlpha = 0.25
                ctx.lineWidth = 1.0 * this.scale
                ctx.beginPath()
                for (let i = 0; i <= 5; i++) {
                    const rt = i / 5,
                        rayA = leadA + (trailA - leadA) * rt,
                        rayLen = len * (0.7 + Math.sin(rt * Math.PI) * 0.35)
                    const flex =
                        Math.sin(this.swimCycle * 1.5 + i * 0.2) * 0.05 * dir
                    const rx = rootX + Math.cos(rayA + flex) * rayLen,
                        ry = rootY + Math.sin(rayA + flex) * rayLen
                    ctx.moveTo(rootX, rootY)
                    ctx.quadraticCurveTo(
                        rootX + Math.cos(rayA + flex * 2) * rayLen * 0.5,
                        rootY + Math.sin(rayA + flex * 2) * rayLen * 0.5,
                        rx,
                        ry
                    )
                }
                ctx.stroke()
                ctx.restore()
            }

            drawPelvicFin(
                seg: any,
                isRight: boolean,
                amp: number,
                ph: number,
                t: number
            ) {
                const len = 26 * this.scale * (1 + (this.fat - 1.25) * 0.55),
                    dir = isRight ? 1 : -1
                const angle =
                    seg.angle +
                    Math.PI * 0.85 * dir +
                    Math.sin(t * 1.15 + ph + 0.9) * (amp * 0.55) * dir
                const rootX = seg.x,
                    rootY = seg.y,
                    leadX = rootX + Math.cos(angle - 0.25 * dir) * len,
                    leadY = rootY + Math.sin(angle - 0.25 * dir) * len
                const trailX = rootX + Math.cos(angle + 0.25 * dir) * len * 0.8,
                    trailY = rootY + Math.sin(angle + 0.25 * dir) * len * 0.8
                ctx.beginPath()
                ctx.moveTo(rootX, rootY)
                ctx.quadraticCurveTo(
                    rootX + Math.cos(angle - 0.4 * dir) * len * 0.6,
                    rootY + Math.sin(angle - 0.4 * dir) * len * 0.6,
                    leadX,
                    leadY
                )
                ctx.quadraticCurveTo(
                    rootX + Math.cos(angle) * len * 1.1,
                    rootY + Math.sin(angle) * len * 1.1,
                    trailX,
                    trailY
                )
                ctx.quadraticCurveTo(
                    rootX + Math.cos(angle + 0.4 * dir) * len * 0.4,
                    rootY + Math.sin(angle + 0.4 * dir) * len * 0.4,
                    rootX,
                    rootY
                )
                ctx.fill()
                ctx.stroke()
            }

            drawDorsalFin() {
                const S0 = 6,
                    S1 = 16,
                    n = S1 - S0,
                    t = this.swimCycle
                const sway =
                    Math.sin(t * 0.95 + this.finPhase) *
                    this.finSwayAmp() *
                    0.42
                const maxH = (18 - Math.max(0, this.fat - 1.0) * 3) * this.scale
                const hPro = [
                    0, 0.45, 0.8, 1.0, 0.95, 0.82, 0.65, 0.48, 0.28, 0.1, 0,
                ]
                const bx: number[] = [],
                    by: number[] = [],
                    rx: number[] = [],
                    ry: number[] = []
                for (let i = 0; i <= n; i++) {
                    const seg = this.segments[S0 + i],
                        h = maxH * hPro[i],
                        upA = seg.angle - Math.PI / 2 + sway * hPro[i]
                    bx.push(seg.x)
                    by.push(seg.y)
                    rx.push(seg.x + Math.cos(upA) * h)
                    ry.push(seg.y + Math.sin(upA) * h)
                }
                ctx.save()
                ctx.fillStyle = this.colors.fin
                ctx.strokeStyle = this.colors.finEdge
                ctx.lineWidth = 0.9 * this.scale
                ctx.globalAlpha = 0.6
                ctx.lineJoin = "round"
                ctx.lineCap = "round"
                ctx.beginPath()
                ctx.moveTo(bx[0], by[0])
                ctx.lineTo((rx[0] + rx[1]) * 0.5, (ry[0] + ry[1]) * 0.5)
                for (let i = 1; i < n; i++)
                    ctx.quadraticCurveTo(
                        rx[i],
                        ry[i],
                        (rx[i] + rx[i + 1]) * 0.5,
                        (ry[i] + ry[i + 1]) * 0.5
                    )
                ctx.lineTo(rx[n], ry[n])
                for (let i = n - 1; i >= 0; i--) ctx.lineTo(bx[i], by[i])
                ctx.closePath()
                ctx.fill()
                ctx.stroke()
                if (qualityTier > 0) {
                    ctx.save()
                    ctx.globalAlpha = 0.2
                    ctx.lineWidth = 0.72 * this.scale
                    ctx.beginPath()
                    for (let i = 1; i < n; i++) {
                        if (hPro[i] > 0.12) {
                            ctx.moveTo(bx[i], by[i])
                            ctx.lineTo(rx[i], ry[i])
                        }
                    }
                    ctx.stroke()
                    ctx.restore()
                }
                ctx.restore()
            }

            drawCaudalFin() {
                const tail = this.segments[this.numSegments - 1],
                    ped = this.segments[this.numSegments - 2]
                const len = 38 * this.scale,
                    wave = Math.sin(this.swimCycle - 1.0) * 0.08,
                    angle = tail.angle + Math.PI - wave
                const ax = (tail.x + ped.x) * 0.5,
                    ay = (tail.y + ped.y) * 0.5
                ctx.save()
                ctx.fillStyle = this.colors.fin
                ctx.strokeStyle = this.colors.finEdge
                ctx.lineWidth = 1.35 * this.scale
                const spread =
                    0.85 +
                    Math.sin(this.swimCycle * 1.05 + this.finPhase) * 0.04
                ctx.beginPath()
                ctx.moveTo(ax, ay)
                ctx.quadraticCurveTo(
                    ax + Math.cos(angle - 0.85 * spread) * len * 0.88,
                    ay + Math.sin(angle - 0.85 * spread) * len * 0.88,
                    ax + Math.cos(angle - 0.25 * spread) * len,
                    ay + Math.sin(angle - 0.25 * spread) * len
                )
                ctx.quadraticCurveTo(
                    ax + Math.cos(angle) * len * 0.78,
                    ay + Math.sin(angle) * len * 0.78,
                    ax + Math.cos(angle + 0.25 * spread) * len,
                    ay + Math.sin(angle + 0.25 * spread) * len
                )
                ctx.quadraticCurveTo(
                    ax + Math.cos(angle + 0.85 * spread) * len * 0.88,
                    ay + Math.sin(angle + 0.85 * spread) * len * 0.88,
                    ax,
                    ay
                )
                ctx.closePath()
                ctx.fill()
                ctx.stroke()
                if (qualityTier === 0) { ctx.restore(); return }
                ctx.save()
                ctx.globalAlpha = 0.22
                ctx.lineWidth = 0.9 * this.scale
                ctx.beginPath()
                for (let i = 0; i < 7; i++) {
                    const a = angle + ((i / 6) * 0.9 - 0.45) * 0.75,
                        l = len * (0.78 + Math.sin(this.swimCycle + i) * 0.015)
                    ctx.moveTo(ax, ay)
                    ctx.lineTo(ax + Math.cos(a) * l, ay + Math.sin(a) * l)
                }
                ctx.stroke()
                ctx.restore()
                ctx.restore()
            }

            drawEye() {
                const head = this.segments[2]
                const ex =
                    head.x +
                    Math.cos(head.angle) * 6 * this.scale +
                    Math.cos(head.angle + Math.PI / 2) * 4 * this.scale
                const ey =
                    head.y +
                    Math.sin(head.angle) * 6 * this.scale +
                    Math.sin(head.angle + Math.PI / 2) * 4 * this.scale
                ctx.save()
                ctx.globalCompositeOperation = "source-over"
                ctx.fillStyle = "rgba(10, 12, 14, 0.42)"
                ctx.beginPath()
                ctx.arc(ex, ey, 1.7 * this.scale, 0, TWO_PI)
                ctx.fill()
                ctx.globalCompositeOperation = "screen"
                ctx.fillStyle = "rgba(255,255,255,0.12)"
                ctx.beginPath()
                ctx.arc(
                    ex - 0.8 * this.scale,
                    ey - 0.7 * this.scale,
                    0.9 * this.scale,
                    0,
                    TWO_PI
                )
                ctx.fill()
                ctx.restore()
            }
        }

        const maxFishCount = qualityTier >= 2 ? 24 : qualityTier === 1 ? 16 : 12
        const eggCap = qualityTier >= 2 ? 28 : qualityTier === 1 ? 18 : 10
        const foodCap = qualityTier >= 2 ? 180 : qualityTier === 1 ? 120 : 72
        const foodBurstMin = qualityTier >= 2 ? 7 : qualityTier === 1 ? 5 : 4
        const foodBurstMax = qualityTier >= 2 ? 14 : qualityTier === 1 ? 10 : 7
        const initialFishConfigs = [
            [0.35, 0.45, "showa", 1.25],
            [0.6, 0.55, "kohaku", 1.2],
            [0.28, 0.52, "showa", 0.85],
            [0.62, 0.42, "kohaku", 0.78],
            [0.44, 0.68, "yamabuki", 0.75],
            [0.76, 0.62, "sanke", 0.68],
            [0.38, 0.32, "kohaku", 0.62],
            [0.58, 0.78, "yamabuki", 0.55],
            [0.18, 0.72, "sanke", 0.28],
            [0.82, 0.28, "kohaku", 0.25],
        ] as const
        const initialFishLimit =
            qualityTier >= 2
                ? initialFishConfigs.length
                : qualityTier === 1
                  ? 8
                  : 6
        const fishes: any[] = initialFishConfigs
            .slice(0, initialFishLimit)
            .map(
                ([fx, fy, type, scale]) =>
                    new Koi(width * fx, height * fy, type, scale * viewScale)
            )

        if (qualityTier >= 1) {
            const mat1 = new Koi(width * 0.52, height * 0.38, "kohaku", 1.35 * viewScale)
            mat1.fat = 1.12
            mat1.fatTarget = 1.28
            fishes.push(mat1)
        }
        if (qualityTier >= 2) {
            const mat2 = new Koi(width * 0.46, height * 0.6, "showa", 1.45 * viewScale)
            mat2.fat = 1.14
            mat2.fatTarget = 1.3
            fishes.push(mat2)
        }

        const foodParticles: any[] = []
        const eggs: any[] = []

        function spawnFoodBurst(x: number, y: number) {
            const count = Math.floor(rand(foodBurstMin, foodBurstMax))
            for (let i = 0; i < count; i++)
                foodParticles.push(
                    new FoodParticle(x + rand(-18, 18), y + rand(-12, 12))
                )
            if (foodParticles.length > foodCap)
                foodParticles.splice(0, foodParticles.length - foodCap)
        }

        function hatchEgg(egg: any) {
            const _types = ["kohaku", "yamabuki", "sanke", "showa"]
            const baby = new Koi(
                egg.x + rand(-18, 18),
                egg.y + rand(-18, 18),
                _types[Math.floor(Math.random() * 4)],
                rand(0.35, 0.45)
            )
            baby.fat = 1.25
            baby.fatTarget = 1.25
            if (fishes.length < maxFishCount) fishes.push(baby)
        }

        const onPointerDown = (e: PointerEvent) => {
            if (e.button !== 0) return

            // ✨ 新增：点击屏幕跳过入场动画
            if (
                !introSkipped &&
                performance.now() - introStart < introDuration
            ) {
                forceSkipIntro()
            }

            const pos = getPointerPos(e.clientX, e.clientY)
            for (let i = eggs.length - 1; i >= 0; i--) {
                if (eggs[i].hitTest(pos.x, pos.y)) {
                    hatchEgg(eggs.splice(i, 1)[0])
                    return
                }
            }
            if (feedMode) spawnFoodBurst(pos.x, pos.y)
            else {
                for (const f of fishes) {
                    const dHead = dist(f.x, f.y, pos.x, pos.y),
                        dMid = dist(
                            f.segments[11].x,
                            f.segments[11].y,
                            pos.x,
                            pos.y
                        )
                    if (Math.min(dHead, dMid) < f.baseScale * 60 + 18) {
                        f.angle = Math.atan2(f.y - pos.y, f.x - pos.x)
                        f.currentSpeed = f.chaseSpeed * 1.6
                        f.targetFood = null
                    }
                }
            }
        }

        container.addEventListener("pointerdown", onPointerDown)

        function drawBackground() {
            ctx.globalCompositeOperation = "source-over"
            ctx.fillStyle = "#020305"
            ctx.fillRect(0, 0, width, height)
        }

        function drawLilyPads() {
            padCtx.clearRect(0, 0, width, height)
            const SEGS = qualityTier >= 2 ? 52 : qualityTier === 1 ? 36 : 24
            padCtx.save()
            padCtx.globalCompositeOperation = "screen"
            const padLimit = qualityTier === 0 ? 12 : qualityTier === 1 ? 18 : lilyPads.length
            for (const pad of lilyPads.slice(0, padLimit)) {
                pad.phase += pad.speed
                padCtx.save()
                padCtx.translate(pad.x, pad.y)
                padCtx.rotate(pad.rotation)
                padCtx.fillStyle = `rgba(170,215,155,${pad.alpha})`
                padCtx.shadowColor = `rgba(170,215,155,${pad.alpha})`
                padCtx.shadowBlur = 0
                padCtx.beginPath()
                for (let i = 0; i <= SEGS; i++) {
                    const a = (i / SEGS) * TWO_PI,
                        notch = 1 - Math.pow(Math.cos(a / 2), 20) * 0.3
                    const ripple =
                        1 +
                        Math.sin(a * 4 + pad.seed + pad.phase) * 0.03 +
                        Math.sin(a * 7 + pad.seed * 1.5 - pad.phase * 0.7) *
                            0.015
                    const rr = pad.r * ripple * notch,
                        x = Math.cos(a) * rr,
                        y = Math.sin(a) * rr
                    if (i === 0) padCtx.moveTo(x, y)
                    else padCtx.lineTo(x, y)
                }
                padCtx.closePath()
                padCtx.fill()
                padCtx.shadowBlur = 0
                padCtx.lineWidth =
                    qualityTier >= 2 ? 0.55 : qualityTier === 1 ? 0.42 : 0.3
                padCtx.strokeStyle = `rgba(200,240,180,${pad.alpha * 0.55})`
                const numVeins = qualityTier === 0 ? 7 : qualityTier === 1 ? 9 : 11,
                    skipAngle = 0.42,
                    veinsSpan = TWO_PI - skipAngle * 2
                padCtx.beginPath()
                for (let v = 0; v < numVeins; v++) {
                    const va = skipAngle + ((v + 0.5) / numVeins) * veinsSpan,
                        vNotch = 1 - Math.pow(Math.cos(va / 2), 20) * 0.3
                    const vRipple =
                        1 +
                        Math.sin(va * 4 + pad.seed + pad.phase) * 0.03 +
                        Math.sin(va * 7 + pad.seed * 1.5 - pad.phase * 0.7) *
                            0.015
                    const edgeR = pad.r * vRipple * vNotch * 0.83,
                        cpA = va + Math.sin(v * 1.7 + pad.seed) * 0.07
                    padCtx.moveTo(0, 0)
                    padCtx.quadraticCurveTo(
                        Math.cos(cpA) * edgeR * 0.48,
                        Math.sin(cpA) * edgeR * 0.48,
                        Math.cos(va) * edgeR,
                        Math.sin(va) * edgeR
                    )
                }
                padCtx.stroke()
                padCtx.restore()
            }
            padCtx.restore()
        }

        const introDuration = Math.max(200, props.introDurationMs | 0)
        const introStart = performance.now()
        const padFrameInterval = prefersReduce
            ? 160
            : qualityTier >= 2
              ? 56
              : qualityTier === 1
                ? 80
                : 133

        const msPerFrame = qualityTier === 0 ? 1000 / 30 : qualityTier === 1 ? 1000 / 45 : 1000 / 60
        let lastFrameTime = performance.now()
        let raf = 0,
            isRunning = false,
            isInViewport = false   // start paused; IO or fallback will start it
        let isPageVisible =
            !document.hidden && document.visibilityState === "visible"
        let lastPadDrawAt = -Infinity
        const computeViewportVisibility = () => {
            const rect = container.getBoundingClientRect()
            const visibleArea =
                Math.max(
                    0,
                    Math.min(rect.right, window.innerWidth) -
                        Math.max(rect.left, 0)
                ) *
                Math.max(
                    0,
                    Math.min(rect.bottom, window.innerHeight) -
                        Math.max(rect.top, 0)
                )
            const totalArea =
                Math.max(1, rect.width || container.clientWidth || 1) *
                Math.max(1, rect.height || container.clientHeight || 1)
            return visibleArea / totalArea > 0.08
        }
        function animate(now: number) {
            if (!isRunning) return
            if (msPerFrame > 0 && now - lastFrameTime < msPerFrame) {
                raf = requestAnimationFrame(animate)
                return
            }
            // Delta-time normalised to 60 fps (dt=1.0). Capped at 3× to prevent
            // position explosions after tab-switch pauses.
            const dt = Math.min((now - lastFrameTime) / 16.667, 3.0)
            lastFrameTime = now

            let t = clamp((now - introStart) / introDuration, 0, 1)

            // ✨ 新增：如果跳过了，强制 t=1
            if (introSkipped) t = 1

            updateScrollEffects(t * 280)
            drawBackground()
            for (let i = foodParticles.length - 1; i >= 0; i--) {
                const p = foodParticles[i]
                p.update(now, dt)
                if (!p.alive) foodParticles.splice(i, 1)
            }
            for (const p of foodParticles) p.draw(now)
            for (let i = eggs.length - 1; i >= 0; i--) {
                const egg = eggs[i]
                egg.update()
                egg.draw()
                if (now - egg.birthTime >= 5000) {
                    hatchEgg(egg)
                    eggs.splice(i, 1)
                }
            }
            for (const f of fishes) {
                f.update(fishes, foodParticles, eggs, now, dt)
                f.draw()
            }
            if (now - lastPadDrawAt >= padFrameInterval) {
                drawLilyPads()
                lastPadDrawAt = now
            }
            raf = requestAnimationFrame(animate)
        }

        const updateAnimationState = () => {
            const shouldRun = isPageVisible && isInViewport
            if (shouldRun === isRunning) return
            isRunning = shouldRun
            if (isRunning) {
                lastPadDrawAt = -Infinity
                lastFrameTime = performance.now()  // reset dt on resume to prevent spike
                raf = requestAnimationFrame(animate)
            } else if (raf) {
                cancelAnimationFrame(raf)
                raf = 0
            }
        }

        const onVisibilityChange = () => {
            isPageVisible =
                !document.hidden && document.visibilityState === "visible"
            updateAnimationState()
        }
        const onWindowBlur = () => {
            isPageVisible = false
            updateAnimationState()
        }
        const onWindowFocus = () => {
            isPageVisible =
                !document.hidden && document.visibilityState === "visible"
            isInViewport = computeViewportVisibility()
            updateAnimationState()
        }
        const onPageHide = () => {
            isPageVisible = false
            updateAnimationState()
        }
        const onPageShow = () => {
            isPageVisible =
                !document.hidden && document.visibilityState === "visible"
            isInViewport = computeViewportVisibility()
            updateAnimationState()
        }
        const onViewportChange = () => {
            isInViewport = computeViewportVisibility()
            updateAnimationState()
        }

        document.addEventListener("visibilitychange", onVisibilityChange)
        window.addEventListener("blur", onWindowBlur, { passive: true })
        window.addEventListener("focus", onWindowFocus, { passive: true })
        window.addEventListener("pagehide", onPageHide, { passive: true })
        window.addEventListener("pageshow", onPageShow, { passive: true })
        window.addEventListener("scroll", onViewportChange, { passive: true })

        let viewportObserver: IntersectionObserver | null = null
        if ("IntersectionObserver" in window) {
            viewportObserver = new IntersectionObserver(
                (entries) => {
                    const entry = entries[0]
                    isInViewport =
                        !!entry &&
                        entry.isIntersecting &&
                        entry.intersectionRatio > 0.08
                    updateAnimationState()
                },
                { threshold: [0, 0.08, 0.2, 0.4] }
            )
            viewportObserver.observe(container)
        } else {
            // IO not supported — assume visible and start
            isInViewport = true
        }
        // Start immediately; IntersectionObserver will pause if scrolled out of view
        updateAnimationState()

        return () => {
            cancelAnimationFrame(raf)
            document.removeEventListener("visibilitychange", onVisibilityChange)
            window.removeEventListener("blur", onWindowBlur)
            window.removeEventListener("focus", onWindowFocus)
            window.removeEventListener("pagehide", onPageHide)
            window.removeEventListener("pageshow", onPageShow)
            window.removeEventListener("scroll", onViewportChange)
            window.removeEventListener("keydown", handleKeyDown) // ✨ 清理事件
            viewportObserver?.disconnect()
            window.removeEventListener("resize", onResize)
            container.removeEventListener("pointermove", onPointerMove)
            container.removeEventListener("pointerleave", onPointerLeave)
            container.removeEventListener("pointerdown", onPointerDown)
            feedBtn.removeEventListener("click", onFeedClick)
            feedBtn.removeEventListener("pointerdown", onFeedPointerDown)
            container.classList.remove("feed-mode")
        }
    }, [props.introDurationMs])

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                background: "#020305",
                overflow: "hidden",
                ["--koi-hero-x" as string]: String(props.heroBoxXvw),
            }}
        >
            <style>{`
            .koi-container{
              position:absolute; inset:0; width:100%; height:100%;
              overflow:hidden; cursor:default; z-index:0;
              position: relative;
              isolation: isolate;
            }
            #fishCanvas{
              display:block; width:100%; height:100%;
              opacity:0; will-change: opacity;
            }
            #padCanvas{
              position:absolute; inset:0; width:100%; height:100%;
              display:block; pointer-events:none;
              opacity:0; will-change: opacity;
            }
            
            /* 🌟 全局薄膜噪点，增加科技水墨画的极细颗粒质感 */
            .noise-overlay {
                position: absolute; inset: 0; z-index: 10; pointer-events: none;
                background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');
                opacity: 0.04; mix-blend-mode: overlay;
            }

            /* 🌟 电影级四角暗角渐晕 — 纯 CSS，无性能开销 */
            .vignette-overlay {
                position: absolute; inset: 0; z-index: 9; pointer-events: none;
                background: radial-gradient(ellipse 90% 90% at 50% 50%, transparent 38%, rgba(0,0,0,0.55) 100%);
            }

            /* Feed UI — intro center, then flies to corner */
            #hero-ui {
              position: absolute;
              top: 50%; left: 50%;
              transform: translate(-50%, -50%);
              pointer-events: auto;
              z-index: 30;
              will-change: transform, top, left;
              transition: top 0.65s cubic-bezier(0.4,0,0.2,1),
                          left 0.65s cubic-bezier(0.4,0,0.2,1),
                          transform 0.65s cubic-bezier(0.4,0,0.2,1);
              animation: feedIntroAppear 0.7s 0.9s ease both;
            }
            @keyframes feedIntroAppear {
              from { opacity:0; transform: translate(-50%, -40%); }
              to   { opacity:1; transform: translate(-50%, -50%); }
            }
            #hero-ui.dismissed {
              top: 20px; left: 20px;
              transform: translate(0,0) scale(0.85);
              transform-origin: top left;
              animation: none;
            }

            #scroll-tip {
              position:absolute; bottom:36px; left:50%; transform: translateX(-50%);
              display:flex; flex-direction:column; align-items:center; gap:10px;
              pointer-events:none; z-index:20;
            }
            .scroll-tip-label {
              font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 300;
              letter-spacing: 0.28em; color: rgba(255,255,255,0.35); text-transform: uppercase;
              animation: scrollTipPulse 3s ease-in-out infinite;
            }
            .scroll-tip-chevron {
              display: flex; flex-direction: column; align-items: center; gap: 3px;
              animation: scrollTipDrop 3s ease-in-out infinite;
            }
            .scroll-tip-chevron span {
              display: block; width: 8px; height: 1px;
              background: rgba(255,255,255,0.45);
            }
            .scroll-tip-chevron span:nth-child(1) { transform: rotate(35deg) translateX(3px); }
            .scroll-tip-chevron span:nth-child(2) { transform: rotate(-35deg) translateX(-3px); }
            @keyframes scrollTipPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
            @keyframes scrollTipDrop {
              0%,100%{ transform: translateY(0); opacity:0.5; }
              50%     { transform: translateY(5px); opacity:1; }
            }

            /* Feed button — responsive sizing via clamp() */
            #feed-ui {
              display: flex; align-items: center;
              gap: clamp(12px, 1.6vw, 22px);
              padding: clamp(14px, 2vh, 24px) clamp(22px, 2.8vw, 40px);
              min-height: clamp(56px, 8vh, 76px);
              background: rgba(20, 20, 22, 0.72);
              backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8);
              border: 0.5px solid rgba(255,255,255,0.14);
              border-radius: clamp(14px, 1.6vw, 20px);
              cursor: pointer; user-select: none; pointer-events: auto;
              transition: transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1),
                          background 0.15s ease, box-shadow 0.15s ease;
              box-shadow: 0 2px 12px rgba(0,0,0,0.40), 0 0 0 0 rgba(255,190,30,0);
              animation: feedButtonPulse 2.8s ease-in-out infinite;
            }
            #hero-ui.dismissed #feed-ui {
              padding: clamp(11px, 1.6vh, 18px) clamp(16px, 2vw, 28px);
              min-height: clamp(44px, 6vh, 58px);
              border-radius: clamp(12px, 1.2vw, 16px);
              animation: none;
            }
            @keyframes feedButtonPulse {
              0%,100% { box-shadow: 0 2px 12px rgba(0,0,0,0.40), 0 0 0 0 rgba(255,190,30,0); }
              50% { box-shadow: 0 2px 20px rgba(0,0,0,0.50), 0 0 16px 2px rgba(255,190,30,0.10); }
            }
            #feed-ui:hover { background: rgba(30, 30, 34, 0.82); border-color: rgba(255,255,255,0.22); }
            #feed-ui:active { transform: scale(0.97); }

            .feed-pellets { position:relative; width:clamp(36px, 4vw, 52px); height:clamp(36px, 4vw, 52px); flex-shrink:0; animation: pelletGlow 2.8s ease-in-out infinite; }
            /* Pellets scale with container via em-like ratios: base container = 40px */
            .pellet { position:absolute; border-radius:50em; background: linear-gradient(135deg, #ffe07a 0%, #d38010 100%); transition: filter 0.3s ease; }
            .pellet:nth-child(1){ width:57%; height:28%; top:3%;  left:0;    transform: rotate(-20deg); }
            .pellet:nth-child(2){ width:39%; height:21%; top:10%; left:60%;  transform: rotate(18deg); }
            .pellet:nth-child(3){ width:32%; height:18%; top:57%; left:18%;  transform: rotate(-6deg); }
            .pellet:nth-child(4){ width:25%; height:14%; top:63%; left:67%;  transform: rotate(26deg); }

            @keyframes pelletGlow{
              0%,100%{ filter: drop-shadow(0 0 4px rgba(220,155,15,0.85)) drop-shadow(0 0 10px rgba(220,155,15,0.45)); }
              50%{ filter: drop-shadow(0 0 6px rgba(255,190,30,1.00)) drop-shadow(0 0 18px rgba(220,155,15,0.70)); }
            }
            .feed-text {
              font-family: 'Murecho', -apple-system, sans-serif;
              font-size: clamp(15px, 1.5vw, 20px); letter-spacing: -0.01em;
              font-weight: 500; line-height: 1;
              color: rgba(255,255,255,0.82); transition: color 0.2s ease;
            }
            #feed-ui:hover .feed-pellets { filter: drop-shadow(0 0 7px rgba(255,190,30,1.00)) drop-shadow(0 0 20px rgba(220,155,15,0.80)); animation:none; }
            #feed-ui:hover .feed-text { color:#fff; }
            .koi-container.feed-mode #feed-ui { background: rgba(30, 30, 34, 0.86); border-color: rgba(255,200,60,0.28); }
            .koi-container.feed-mode #feed-ui .feed-pellets { animation:none; filter: drop-shadow(0 0 7px rgba(255,190,30,1.00)) drop-shadow(0 0 20px rgba(220,155,15,0.80)); }
            .koi-container.feed-mode #feed-ui .feed-text { color:#fff; }
            .koi-container.feed-mode { cursor:none; }

            #feed-cursor {
              position: absolute; pointer-events:none; z-index:1000;
              width:22px; height:22px; display:none; left: 0; top: 0; transform: translate(-50%, -50%);
            }
            #feed-cursor::before {
              content:''; position:absolute; inset:0; border-radius:50%;
              border: 1.5px solid rgba(255,255,255,0.78); box-shadow: 0 0 5px rgba(255,255,255,0.28);
            }
            #feed-cursor::after {
              content:''; position:absolute; width:4px; height:4px; border-radius:50%;
              background: rgba(255,255,255,0.92); top:50%; left:50%; transform: translate(-50%,-50%);
              box-shadow: 0 0 4px rgba(255,255,255,0.45);
            }
            .koi-container.feed-mode #feed-cursor { display:block; }
            `}</style>

            <div className="koi-container" ref={containerRef}>
                <div className="vignette-overlay" />
                <div className="noise-overlay" />
                <canvas id="fishCanvas" ref={fishCanvasRef} />
                <canvas id="padCanvas" ref={padCanvasRef} />
                <div id="feed-cursor" ref={feedCursorRef} />

                <div id="hero-ui" ref={uiBoxRef}>
                    <div id="feed-ui" ref={feedBtnRef}>
                        <div className="feed-pellets">
                            <span className="pellet" />
                            <span className="pellet" />
                            <span className="pellet" />
                            <span className="pellet" />
                        </div>
                        <div className="feed-text">{props.feedText}</div>
                    </div>
                </div>

                {props.showScrollTip && (
                    <div id="scroll-tip" ref={scrollTipRef}>
                        <div className="scroll-tip-label">Scroll</div>
                        <div className="scroll-tip-chevron">
                            <span /><span />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

InkKoiEcosystem.defaultProps = {
    eyebrow: "SYS.ROLE // UX_DESIGNER",
    titleMain: "PM-minded",
    titleSub: "Product Designer",
    tag: "先聽後行 · 以終為始",
    feedText: "Why not feed the fish?",
    showScrollTip: true,
    introDurationMs: 800, // ✨ 将默认时间稍微缩短了
    heroBoxXvw: 6,
}

addPropertyControls(InkKoiEcosystem, {
    eyebrow: { type: ControlType.String, title: "Eyebrow" },
    titleMain: { type: ControlType.String, title: "Title" },
    titleSub: { type: ControlType.String, title: "Sub" },
    tag: { type: ControlType.String, title: "Tag" },
    feedText: { type: ControlType.String, title: "Feed Text" },
    showScrollTip: { type: ControlType.Boolean, title: "Scroll Tip" },
    heroBoxXvw: {
        type: ControlType.Number,
        title: "Hero X",
        min: 0,
        max: 20,
        step: 0.5,
    },
    introDurationMs: {
        type: ControlType.Number,
        title: "Intro (ms)",
        min: 300,
        max: 4000,
        step: 50,
    },
})
