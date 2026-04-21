import * as React from "react"
import { useEffect, useRef } from "react"
import * as THREE from "three"
import { RenderTarget, addPropertyControls, ControlType } from "framer"

type BirdDatum = {
    baseX: number
    baseY: number
    baseZ: number
    speed: number
    scatterVX: number
    scatterVY: number
    scatterVZ: number
    scatterX: number
    scatterY: number
    scatterZ: number
}

type Props = {
    sealComponent?: React.ReactNode
    mobileBgUrl?: string
    heroWord1: string
    heroWord2: string
    heroWord3: string
    heroSubtitle: string
    rightVerticalText: string
    quoteLine: string
    scrollHint: string
    page2Title?: string
    page2Subtitle?: string
    page2BrandLine?: string
    page2Footer?: string
    photoUrl?: string
    photoComponent?: React.ReactNode
    isLoaded?: boolean
    scrollDemo?: number
}

function round3(value: number) {
    return Math.round(value * 1000) / 1000
}

function setInlineStyle(
    el: HTMLElement | null,
    property: string,
    value: string
) {
    if (!el) return
    if (el.style.getPropertyValue(property) !== value) {
        el.style.setProperty(property, value)
    }
}

function setClassState(el: Element | null, className: string, enabled: boolean) {
    if (!el) return
    if (el.classList.contains(className) !== enabled) {
        el.classList.toggle(className, enabled)
    }
}

// 顶点着色器 — 墨山粒子：云海涌动 + 鼠标聚光
const mountainVert = `
  precision mediump float;
  uniform float uTime;
  uniform float uScroll;
  uniform float uVelocity;
  uniform vec2 uMouse;
  uniform float uMouseActive;
  uniform float uFlatMode;
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  varying float vSpotlight;

  void main() {
    vec3 pos = position;
    float randVal = fract(sin(dot(pos.xz, vec2(12.9898, 78.233))) * 43758.5453);
    float phase = randVal * 6.2831;
    float twinkle = uFlatMode > 0.5 ? 1.0 : (0.6 + 0.8 * sin(uTime * 1.3 + phase));
    if (uFlatMode < 0.5) pos.y += sin(uTime * 0.35 + pos.x * 0.008) * 6.0;

    float normY = clamp((position.y + 520.0) / 1050.0, 0.0, 1.0);
    float dRand = fract(sin(dot(position.xz, vec2(127.1, 311.7))) * 43758.5453);
    float dissolveStart = 0.25 + normY * 0.15 + dRand * 0.05;
    float dissolveT = smoothstep(dissolveStart, dissolveStart + 0.30, uScroll);
    float scatter = smoothstep(0.0, 1.0, dissolveT);

    // 山体向下塌缩：未散射部分随滚动整体下沉
    float mountainSink = smoothstep(0.20, 0.40, uScroll) * -1800.0;
    pos.y += mountainSink * (1.0 - scatter);

    // 粒子升华至星场目标坐标（确定性 hash）
    float hashX = fract(sin(dot(position.xz, vec2(45.1, 91.7))) * 43758.5453);
    float hashZ = fract(sin(dot(position.xz, vec2(23.3, 67.9))) * 43758.5453);
    float starTargetY = 200.0 + (dRand * 2.0 - 1.0) * 800.0;
    float starTargetX = (hashX * 2.0 - 1.0) * 3000.0;
    float starTargetZ = -100.0 - hashZ * 2000.0;

    // pow(scatter, 1.5) 产生加速升华感
    float lift = pow(scatter, 1.5);
    pos.y = mix(pos.y, starTargetY, lift);
    pos.x = mix(pos.x, starTargetX, lift);
    pos.z = mix(pos.z, starTargetZ, lift);

    // 用原始坐标计算遮罩（不受偏移影响）
    vec4 origWorldPos = modelMatrix * vec4(position, 1.0);
    float valleyMask = smoothstep(100.0, -200.0, origWorldPos.z);
    float seaLevel = uFlatMode > 0.5 ? 100.0
        : (100.0 + sin(origWorldPos.x * 0.002 + uTime * 0.5) * cos(origWorldPos.z * 0.002) * 1000.0);
    float bottomFade = smoothstep(seaLevel - 60.0, seaLevel + 120.0, origWorldPos.y);

    vec4 mvPosition = viewMatrix * modelMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float scatterShrink = mix(1.0, 0.15 + dRand * 0.15, scatter);
    float size = aSize * (1000.0 / -mvPosition.z);
    float maxSz = mix(70.0, 8.0, scatter);
    gl_PointSize = clamp(size * scatterShrink * (uFlatMode > 0.5 ? 1.0 : twinkle) * (1.0 + uVelocity * 0.5), 0.5, maxSz);

    float alphaFade = smoothstep(0.45, 0.65, uScroll);
    vAlpha = aAlpha * mix(1.0, bottomFade, valleyMask) * (1.0 - alphaFade);

    if (uFlatMode > 0.5) {
      vSpotlight = 0.0;
    } else {
      vec2 screenPos = gl_Position.xy / gl_Position.w;
      vSpotlight = uMouseActive * (1.0 - scatter) * smoothstep(0.18, 0.02, length(screenPos - uMouse));
    }
  }
`

const mountainFrag = `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uScroll;
  varying float vAlpha;
  varying float vSpotlight;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float shape = smoothstep(0.5, 0.14, d);
    float a = clamp(vAlpha * shape + vSpotlight * 0.45 * shape, 0.0, 1.0);
    if (a < 0.02) discard;

    float colorMix = smoothstep(0.18, 0.48, uScroll);
    // 纯白星光色 — 散射粒子过渡到星星外观
    vec3 targetColor = vec3(1.0, 1.0, 1.0);
    vec3 finalColor = mix(uColor, targetColor, colorMix) + vSpotlight * 0.08;
    // 预乘 Alpha：防止透明画布在黑背景上产生边缘杂色
    gl_FragColor = vec4(finalColor * a, a);
  }
`

const birdVert = `
  attribute float aSize;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uMouseActive;
  varying float vDepth;
  varying float vSpotlight;
  void main(){
    vec3 pos = position;
    pos.y += sin(uTime * 3.0 + pos.x * 0.05) * 8.0;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vDepth = smoothstep(-2500.0, -500.0, mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    float size = aSize * (1000.0 / -mvPosition.z);
    gl_PointSize = clamp(size, 0.5, 60.0);
    vec2 screenPos = gl_Position.xy / gl_Position.w;
    float distToMouse = length(screenPos - uMouse);
    vSpotlight = uMouseActive * smoothstep(0.25, 0.03, distToMouse);
  }
`

const birdFrag = `
  uniform vec3 uColor;
  uniform float uScroll;
  varying float vDepth;
  varying float vSpotlight;
  void main(){
    vec2 uv = gl_PointCoord - vec2(0.5);
    float v = abs(uv.x * 1.5) + uv.y * 0.8;
    float shape = smoothstep(0.4, 0.05, abs(v - 0.1));
    if (shape < 0.02) discard;
    float colorMix = smoothstep(0.18, 0.48, uScroll);
    vec3 targetColor = vec3(0.9, 0.9, 0.95);
    vec3 finalColor = mix(uColor, targetColor, colorMix);
    float scatterDim = 1.0 - vSpotlight * 0.3;
    float birdA = mix(0.2, 0.9, vDepth) * scatterDim;
    float dissolveTB = smoothstep(0.32, 0.52, uScroll);
    birdA *= (1.0 - dissolveTB);
    gl_FragColor = vec4(finalColor, shape * birdA);
  }
`

const starVert = `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uScroll;
  varying float vStarA;
  void main() {
    float twinkle = 0.55 + 0.45 * sin(uTime * 2.1 + aPhase);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // 固定像素大小：星星不随距离缩放（天体效果）
    gl_PointSize = clamp(aSize * twinkle, 1.0, 8.0);
    float starT = smoothstep(0.25, 0.44, uScroll);
    vStarA = starT * twinkle;
  }
`

const starFrag = `
  varying float vStarA;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float shape = smoothstep(0.5, 0.08, d);
    float a = vStarA * shape;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vec3(1.0) * a, a);
  }
`

function hash(n: number) {
    return Math.abs(Math.sin(n) * 10000.0) % 1.0
}
function mixF(a: number, b: number, t: number) {
    return a + (b - a) * t
}
function clampF(x: number, a: number, b: number) {
    return x < a ? a : x > b ? b : x
}
function smoothstepF(edge0: number, edge1: number, x: number) {
    let t = (x - edge0) / (edge1 - edge0)
    if (t < 0) t = 0
    else if (t > 1) t = 1
    return t * t * (3 - 2 * t)
}
function noise2D(x: number, z: number) {
    const ix = Math.floor(x),
        iz = Math.floor(z),
        fx = x - ix,
        fz = z - iz,
        ux = fx * fx * (3.0 - 2.0 * fx)
    const k = ix + iz * 57,
        n00 = hash(k),
        n10 = hash(k + 1),
        n01 = hash(k + 57),
        n11 = hash(k + 58)
    return mixF(mixF(n00, n10, ux), mixF(n01, n11, ux), fz)
}
function fbm(x: number, z: number, oct: number) {
    let v = 0,
        a = 0.5
    for (let i = 0; i < oct; i++) {
        v += a * noise2D(x, z)
        x = x * 2.05 + 100
        z = z * 2.25 + 100
        a *= 0.5
    }
    return v
}
function ridge1D(x: number) {
    let n = fbm(x * 0.0012, 10.0, 5),
        r = 1.0 - Math.abs(n - 0.5) * 2.0
    r = r > 0 ? Math.pow(r, 2.2) : 0
    let cut = fbm(x * 0.004, 200.0, 3)
    cut = smoothstepF(0.25, 0.75, cut)
    return r * cut
}
function bandMask(z: number, center: number, width: number) {
    let d = Math.abs(z - center) / width
    d = 1.0 - d
    return d > 0 ? d * d : 0
}
function centralMistFactor(x: number) {
    const r = x / 520.0
    return 1.0 - Math.exp(-(r * r))
}
function computeXCache(x: number) {
    return {
        fgCut: smoothstepF(100.0, 1200.0, x),
        rightBank: Math.max(0, 1.0 - Math.pow((x - 1400) / 800, 2)) * 380.0,
        sFg: ridge1D(x - 900) * 120,
        sNear: ridge1D(x + 80) * 240,
        sMid: ridge1D(x - 220) * 720,
        sFar: ridge1D(x + 520) * 420,
        cm: centralMistFactor(x),
    }
}
const _td = { h: 0, ridge: 0, cm: 0, fg: 0, far: 0 }
function getTerrainData(
    x: number,
    z: number,
    xc?: ReturnType<typeof computeXCache>
) {
    const fg = bandMask(z, 1000, 350),
        near = bandMask(z, 220, 460),
        mid = bandMask(z, -160, 560),
        far = bandMask(z, -720, 720)
    let fgCut: number,
        sFg: number,
        sNear: number,
        sMid: number,
        sFar: number,
        cm: number
    if (xc) {
        fgCut = xc.fgCut
        sFg = xc.sFg + xc.rightBank
        sNear = xc.sNear
        sMid = xc.sMid
        sFar = xc.sFar
        cm = xc.cm
    } else {
        fgCut = smoothstepF(100.0, 1200.0, x)
        const rightBank =
            Math.max(0, 1.0 - Math.pow((x - 1400) / 800, 2)) * 380.0
        sFg = ridge1D(x - 900) * 120 + rightBank
        sNear = ridge1D(x + 80) * 240
        sMid = ridge1D(x - 220) * 720
        sFar = ridge1D(x + 520) * 420
        cm = centralMistFactor(x)
    }
    let texN = fbm(x * 0.003, z * 0.004, 4),
        texR = 1.0 - Math.abs(texN - 0.5) * 2.0
    texR = texR > 0 ? Math.pow(texR, 2.8) : 0
    let h =
        fg * fgCut * (sFg + texR * 120) +
        near * (sNear + texR * 140) +
        mid * (sMid + texR * 240) +
        far * (sFar + texR * 120)
    const cmFinal = mixF(cm, 1.0, fg * 0.8)
    h *= cmFinal * 0.65 + 0.35
    h -= z * 0.25
    let baseH = h - 520.0
    baseH += fg * fgCut * 350.0
    _td.h = baseH
    _td.ridge = texR
    _td.cm = cm
    _td.fg = fg * fgCut
    _td.far = far
    return _td
}

export default function DigitalLandscape(props: Props) {
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const enableMouseSpotlight = true
    const {
        sealComponent,
        mobileBgUrl,
        heroWord1,
        heroWord2,
        heroWord3,
        heroSubtitle,
        rightVerticalText,
        isLoaded = true,
        quoteLine,
        scrollHint,
        scrollDemo,
        page2Title = "",
        page2Subtitle = "",
        page2BrandLine = "",
        page2Footer = "",
        photoUrl,
        photoComponent,
    } = props

    const scrollDemoRef = useRef<number | undefined>(scrollDemo)

    const backgroundRef = useRef<HTMLDivElement | null>(null)
    const wrapperRef = useRef<HTMLDivElement | null>(null)
    const mountRef = useRef<HTMLDivElement | null>(null)
    const uiRef = useRef<HTMLDivElement | null>(null)
    const nightOverlayRef = useRef<HTMLDivElement | null>(null)
    const blackPageRef = useRef<HTMLDivElement | null>(null)
    const page2ActiveRef = useRef(false)
    const photoWrapperRef = useRef<HTMLDivElement | null>(null)
    const sceneReadyRef = useRef(false)
    const isLoadedRef = useRef(isLoaded !== false)
    const fontsReadyRef = useRef(false)
    const mobileBgRef = useRef(mobileBgUrl)

    useEffect(() => {
        if (typeof document === "undefined") return
        if (document.querySelector('[data-xy-fonts]')) return
        const frag = document.createDocumentFragment()
        const pc1 = document.createElement('link')
        pc1.rel = 'preconnect'; pc1.href = 'https://fonts.googleapis.com'
        const pc2 = document.createElement('link')
        pc2.rel = 'preconnect'; pc2.href = 'https://fonts.gstatic.com'
        ;(pc2 as any).crossOrigin = ''
        const lk = document.createElement('link')
        lk.rel = 'stylesheet'
        lk.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Murecho:wght@100..900&display=swap'
        lk.setAttribute('data-xy-fonts', '1')
        frag.append(pc1, pc2, lk)
        document.head.appendChild(frag)
    }, [])

    useEffect(() => {
        isLoadedRef.current = isLoaded !== false
        if (
            isLoadedRef.current &&
            sceneReadyRef.current &&
            fontsReadyRef.current
        ) {
            uiRef.current?.classList.add("scene-loaded")
        }
    }, [isLoaded])

    useEffect(() => {
        scrollDemoRef.current = scrollDemo
        // In Framer canvas, window.scrollY is always 0 — sync night overlay manually
        if (isCanvas && scrollDemo !== undefined && nightOverlayRef.current) {
            const nightT = smoothstepF(0.2, 0.55, scrollDemo)
            setInlineStyle(
                nightOverlayRef.current,
                "opacity",
                String(round3(nightT))
            )
        }
        // Also sync DOM state (hero fade + profile) that handleScroll normally drives
        if (isCanvas && scrollDemo !== undefined) {
            const p = scrollDemo
            const winH = window.innerHeight
            // scrollDemo is progress 0→1 = equivalent to 0→winH px scroll
            const scrollY = p * winH
            if (uiRef.current)
                setInlineStyle(
                    uiRef.current,
                    "opacity",
                    String(round3(Math.max(1 - p * 1.8, 0)))
                )
            if (blackPageRef.current) {
                const p2Opacity = Math.max(0, Math.min(1, (scrollY - winH * 0.80) / (winH * 0.20)))
                setInlineStyle(blackPageRef.current, "opacity", String(round3(p2Opacity)))
                setInlineStyle(blackPageRef.current, "pointer-events", p2Opacity > 0.01 ? "auto" : "none")
            }
        }
    }, [scrollDemo])

    useEffect(() => {
        if (typeof window === "undefined") return
        let isMounted = true
        let animationFrameId = 0
        let cleanupAnimation: (() => void) | undefined = undefined

        // 3D tilt on avatar
        const photoEl = photoWrapperRef.current
        let tiltRaf = 0
        let cachedPhotoRect: DOMRect | null = photoEl ? photoEl.getBoundingClientRect() : null
        const refreshPhotoRect = () => { if (photoEl) cachedPhotoRect = photoEl.getBoundingClientRect() }
        window.addEventListener("resize", refreshPhotoRect, { passive: true })
        const onTiltMove = (e: MouseEvent) => {
            if (tiltRaf) return
            tiltRaf = requestAnimationFrame(() => {
                tiltRaf = 0
                if (!photoEl || !cachedPhotoRect) return
                const x = (e.clientX - (cachedPhotoRect.left + cachedPhotoRect.width  / 2)) / (cachedPhotoRect.width  / 2)
                const y = (e.clientY - (cachedPhotoRect.top  + cachedPhotoRect.height / 2)) / (cachedPhotoRect.height / 2)
                photoEl.style.setProperty("--rx", `${y * -7}deg`)
                photoEl.style.setProperty("--ry", `${x *  7}deg`)
            })
        }
        const onTiltLeave = () => {
            if (tiltRaf) { cancelAnimationFrame(tiltRaf); tiltRaf = 0 }
            photoEl?.style.setProperty("--rx", "0deg")
            photoEl?.style.setProperty("--ry", "0deg")
        }
        if (photoEl) {
            photoEl.addEventListener("mousemove", onTiltMove, { passive: true })
            photoEl.addEventListener("mouseleave", onTiltLeave)
        }

        // Fonts gate: ensure web fonts are loaded before text animations fire
        const tryReveal = () => {
            if (
                sceneReadyRef.current &&
                isLoadedRef.current &&
                fontsReadyRef.current
            ) {
                uiRef.current?.classList.add("scene-loaded")
            }
        }
        if (document.fonts) {
            document.fonts.ready.then(() => {
                if (!isMounted) return
                fontsReadyRef.current = true
                tryReveal()
            })
        } else {
            fontsReadyRef.current = true
        }

        // If isLoaded is false, wait for loader to signal completion
        const onLoaderDone = () => {
            isLoadedRef.current = true
            tryReveal()
        }
        if (!isLoadedRef.current) {
            window.addEventListener("loaderFinished", onLoaderDone, {
                once: true,
            })
        }

        let scene: THREE.Scene,
            camera: THREE.PerspectiveCamera,
            renderer: THREE.WebGLRenderer
        let mountainMat: THREE.ShaderMaterial, mountain: THREE.Points
        let starMesh: THREE.Points
        let birdGeo: THREE.BufferGeometry,
            birdMesh: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
        const birdData: BirdDatum[] = []
        let scrollProgress = 0
        let isSceneVisible = true
        let winHeight = window.innerHeight
        let winWidth = window.innerWidth
        let resumeSceneAnimation: (() => void) | null = null

        const mouseNDC = { x: 0, y: 0 }
        let mouseActive = 0,
            pendingMouse = false
        let lastClientX = 0,
            lastClientY = 0

        const handleMouseMove = (e: MouseEvent) => {
            if (scrollProgress > 0.5) {
                mouseActive = 0
                return
            }
            lastClientX = e.clientX
            lastClientY = e.clientY
            mouseActive = 1
            if (pendingMouse) return
            pendingMouse = true
            requestAnimationFrame(() => {
                pendingMouse = false
                mouseNDC.x = (lastClientX / winWidth) * 2 - 1
                mouseNDC.y = -(lastClientY / winHeight) * 2 + 1
            })
        }
        const handleMouseLeave = () => {
            mouseActive = 0
        }
        if (enableMouseSpotlight) {
            window.addEventListener("mousemove", handleMouseMove, {
                passive: true,
            })
            window.addEventListener("mouseleave", handleMouseLeave, {
                passive: true,
            })
        }

        // Shared scroll value: handleScroll writes this, animation loop reads it.
        // Decouples the animation loop from getScrollY() — which may return 0
        // when isCanvas is misdetected in Framer live-preview frames.
        const scrollForAnimation = { current: 0 }

        // 一旦确认 window.scrollY 可用，永久走快路径跳过昂贵的 fallback
        let _scrollFast = false
        const getScrollY = (): number => {
            if (_scrollFast) {
                return (
                    window.scrollY ||
                    window.pageYOffset ||
                    (document.documentElement &&
                        document.documentElement.scrollTop) ||
                    (document.body && document.body.scrollTop) ||
                    0
                )
            }
            // 1. window scroll — Framer Fixed overlay + standard browsers
            const winY =
                window.scrollY ||
                window.pageYOffset ||
                (document.documentElement &&
                    document.documentElement.scrollTop) ||
                (document.body && document.body.scrollTop) ||
                0
            if (winY > 0) {
                _scrollFast = true  // 发布版走这里，后续跳过所有 fallback
                return winY
            }
            // 2. getBoundingClientRect — component in document flow
            if (backgroundRef.current) {
                const top = backgroundRef.current.getBoundingClientRect().top
                if (top < -1) return -top
            }
            // 3. scan ancestor scrollTop — Framer div scroll container
            if (backgroundRef.current) {
                let el: Element | null = backgroundRef.current.parentElement
                while (el && el !== document.documentElement) {
                    if (el.scrollTop > 0) return el.scrollTop
                    el = el.parentElement
                }
            }
            return 0
        }

        const handleScroll = () => {
            if (!isMounted) return
            const componentTop =
                backgroundRef.current?.getBoundingClientRect().top ?? 0
            const viewportFollowY = Math.max(0, -componentTop)
            const fallbackScrollY = getScrollY()
            const currentScrollY =
                viewportFollowY > 0.5
                    ? viewportFollowY
                    : componentTop > 0
                      ? 0
                      : fallbackScrollY
            const progress = Math.min(
                currentScrollY / (winHeight * 1.0),
                1
            )
            scrollProgress = progress
            scrollForAnimation.current = progress
            const wrapperEl = wrapperRef.current
            const uiEl = uiRef.current
            const overlayEl = nightOverlayRef.current
            const blackPageEl = blackPageRef.current

            // page2: fade in profile once stars are mostly formed
            const p2Opacity = Math.max(0, Math.min(1,
                (currentScrollY - winHeight * 0.80) / (winHeight * 0.20)
            ))
            if (blackPageEl) {
                setInlineStyle(blackPageEl, "opacity", String(round3(p2Opacity)))
                setInlineStyle(blackPageEl, "pointer-events", p2Opacity > 0.01 ? "auto" : "none")
            }
            if (!page2ActiveRef.current && p2Opacity > 0) {
                page2ActiveRef.current = true
                if (blackPageEl) setClassState(blackPageEl, "page2-active", true)
            }

            if (wrapperEl) {
                if (componentTop > winHeight) {
                    // 组件完全在视口下方（尚未滚动到），隐藏 fixed canvas 避免叠在其他页面内容上
                    setInlineStyle(wrapperEl, "opacity", "0")
                } else {
                    const canvasFadeStart = winHeight * 2.2
                    const canvasFadeEnd = winHeight * 2.4
                    const canvasFade =
                        currentScrollY <= canvasFadeStart
                            ? 1
                            : Math.max(
                                  0,
                                  1 -
                                      (currentScrollY - canvasFadeStart) /
                                          (canvasFadeEnd - canvasFadeStart)
                              )
                    setInlineStyle(
                        wrapperEl,
                        "opacity",
                        String(round3(canvasFade))
                    )
                }
            }
            if (uiEl)
                setInlineStyle(
                    uiEl,
                    "opacity",
                    String(round3(Math.max(1 - progress * 1.8, 0)))
                )

            // Smooth day→night — opacity overlay（compositor-only，不触发 repaint）
            const nightT = smoothstepF(0.2, 0.55, progress)
            if (overlayEl)
                setInlineStyle(
                    overlayEl,
                    "opacity",
                    String(round3(nightT))
                )

            const wasSceneVisible = isSceneVisible
            isSceneVisible = currentScrollY < winHeight * 2.5
            if (isSceneVisible && !wasSceneVisible) {
                resumeSceneAnimation?.()
            }

            // Hide the fixed canvas entirely when past the Three.js zone
            // Prevents the last rendered star frame from bleeding into work cards / other pages
            if (wrapperEl) {
                setInlineStyle(
                    wrapperEl,
                    "visibility",
                    isSceneVisible ? "" : "hidden"
                )
            }

        }

        let scrollRaf = 0
        const onScrollRaf = () => {
            if (scrollRaf) return
            scrollRaf = requestAnimationFrame(() => {
                scrollRaf = 0
                handleScroll()
            })
        }
        document.addEventListener("scroll", onScrollRaf, {
            passive: true,
            capture: true,
        })
        handleScroll()

        // ── RAF poll: Framer published/preview never fires DOM scroll events.
        //    Read getBoundingClientRect at ~30fps — works with any scroll container.
        //    Stops automatically once window.scrollY is confirmed working (_scrollFast).
        let scrollPollRaf = 0
        let lastPollY = -1
        let lastBcrTime = 0
        let compInView = true  // controlled by IO below
        const scrollPollFn = () => {
            scrollPollRaf = 0
            if (!isMounted || isCanvas || document.hidden || !compInView) return
            if (_scrollFast) return  // window.scroll event handles it; stop poll
            scrollPollRaf = requestAnimationFrame(scrollPollFn)
            const now = performance.now()
            if (now - lastBcrTime < 33) return  // ~30fps throttle
            lastBcrTime = now
            const currentTop = backgroundRef.current?.getBoundingClientRect().top ?? 0
            if (Math.abs(currentTop - lastPollY) > 0.5) {
                lastPollY = currentTop
                handleScroll()
            }
        }
        scrollPollRaf = requestAnimationFrame(scrollPollFn)

        // Resume scroll poll when page becomes visible again or regains focus
        const resumeScrollPoll = () => {
            if (!document.hidden && compInView && !scrollPollRaf && !isCanvas) {
                lastPollY = -1  // force re-check scroll position
                scrollPollRaf = requestAnimationFrame(scrollPollFn)
            }
        }
        document.addEventListener("visibilitychange", resumeScrollPoll)
        window.addEventListener("focus", resumeScrollPoll, { passive: true })

        // Stop scroll poll when component exits viewport entirely (e.g. user on different page)
        const pollIO = typeof IntersectionObserver !== "undefined" && backgroundRef.current
            ? new IntersectionObserver((entries) => {
                compInView = !!(entries[0]?.isIntersecting)
                if (compInView) resumeScrollPoll()
            }, { threshold: 0 })
            : null
        if (pollIO && backgroundRef.current) pollIO.observe(backgroundRef.current)

        // ── Mobile / 低端设备: skip Three.js entirely, use CSS ink fallback ──
        const isLowEndDevice =
            window.innerWidth <= 768 ||
            (navigator.hardwareConcurrency || 4) <= 2 ||
            ((navigator as any).deviceMemory || 4) <= 2
        if (isLowEndDevice) {
            if (mountRef.current) {
                const bg = mobileBgRef.current
                mountRef.current.innerHTML = bg
                    ? `<img src="${bg}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 60%;" />`
                    : `<svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice"
                         style="position:absolute;inset:0;width:100%;height:100%">
                        <defs>
                          <filter id="inkblur"><feGaussianBlur stdDeviation="3"/></filter>
                          <filter id="inkblur2"><feGaussianBlur stdDeviation="1.5"/></filter>
                        </defs>
                        <path class="ink-layer ink-far"
                          d="M0,400 Q120,240 280,300 Q440,160 600,210 Q760,110 920,155 Q1060,80 1200,115 L1200,600 L0,600 Z"
                          fill="#2a2a2a" opacity="0.07" filter="url(#inkblur)"/>
                        <path class="ink-layer ink-mid"
                          d="M0,450 Q100,310 260,360 Q420,240 580,290 Q720,190 900,240 Q1050,170 1200,205 L1200,600 L0,600 Z"
                          fill="#1a1a1a" opacity="0.13" filter="url(#inkblur2)"/>
                        <path class="ink-layer ink-near"
                          d="M0,505 Q80,430 210,460 Q380,390 540,420 Q700,370 870,400 Q1020,360 1200,380 L1200,600 L0,600 Z"
                          fill="#111" opacity="0.22"/>
                        <path class="ink-layer ink-fg"
                          d="M-20,560 Q60,530 180,548 Q340,518 520,538 Q700,510 900,528 Q1060,508 1220,520 L1220,600 L-20,600 Z"
                          fill="#0d0d0d" opacity="0.32"/>
                      </svg>`
                mountRef.current.style.opacity = "1"
            }
            sceneReadyRef.current = true
            tryReveal()
            return () => {
                cancelAnimationFrame(scrollPollRaf)
                document.removeEventListener("scroll", onScrollRaf, {
                    capture: true,
                })
                document.removeEventListener("visibilitychange", resumeScrollPoll)
                window.removeEventListener("focus", resumeScrollPoll)
                pollIO?.disconnect()
                if (enableMouseSpotlight) {
                    window.removeEventListener("mousemove", handleMouseMove)
                    window.removeEventListener("mouseleave", handleMouseLeave)
                }
                window.removeEventListener("loaderFinished", onLoaderDone)
            }
        }

        async function init3D() {
            try {
                scene = new THREE.Scene()
                scene.fog = new THREE.FogExp2(0xffffff, 0.0001)
                const containerW =
                    mountRef.current?.offsetWidth || window.innerWidth
                camera = new THREE.PerspectiveCamera(
                    54,
                    containerW / window.innerHeight,
                    1,
                    7000
                )
                camera.position.set(0, 200, 2200)

                const isMobile = window.innerWidth <= 768
                const hwCores = navigator.hardwareConcurrency || 4
                const deviceMemory = (navigator as any).deviceMemory || 4
                // 低端设备已被早返回拦截；此处 isLowEnd 仅作防御性一致
                const isLowEnd = isMobile || hwCores <= 2 || deviceMemory <= 2
                // 0 = mobile/low-end (handled by early return above), 1 = mid/canvas, 2 = high-end desktop
                const qualityTier: 0 | 1 | 2 = isLowEnd
                    ? 0
                    : isCanvas || hwCores <= 4 || deviceMemory <= 4
                      ? 1
                      : 2

                renderer = new THREE.WebGLRenderer({
                    antialias: false,
                    alpha: true,
                    powerPreference:
                        qualityTier === 0 ? "default" : "high-performance",
                })
                renderer.setPixelRatio(
                    Math.min(
                        qualityTier === 0
                            ? 0.6
                            : qualityTier === 1
                              ? 1.0
                              : 1.25,
                        window.devicePixelRatio || 1
                    )
                )
                renderer.setSize(containerW, window.innerHeight)
                renderer.setClearColor(0xffffff, 0)
                mountRef.current?.appendChild(renderer.domElement)

                const lx = -0.8,
                    ly = 0.4,
                    lz = -0.4,
                    extX = qualityTier === 0 ? 1200 : 2600,
                    minZ = -1200,
                    maxZ = 1200
                const cellSize =
                    qualityTier === 0 ? 40.0 : qualityTier === 1 ? 22.0 : 15.0
                const density =
                    qualityTier === 0 ? 3.0 : qualityTier === 1 ? 16.0 : 30.0
                const maxPoints =
                    qualityTier === 0
                        ? 8000
                        : qualityTier === 1
                          ? 80000
                          : 180000
                const yieldInterval =
                    qualityTier === 0 ? 14 : qualityTier === 1 ? 24 : 40
                const positions = new Float32Array(maxPoints * 3)
                const sizes = new Float32Array(maxPoints)
                const alphas = new Float32Array(maxPoints)
                let pIdx = 0
                let lastYield = performance.now()

                for (let cx = -extX; cx <= extX; cx += cellSize) {
                    if (!isMounted) return
                    const tx = cx + cellSize / 2
                    const xc = computeXCache(tx)
                    const eps = 4.0
                    for (let cz = minZ; cz <= maxZ; cz += cellSize) {
                        const tz = cz + cellSize / 2
                        const t = getTerrainData(tx, tz, xc)
                        const th = t.h,
                            tRidge = t.ridge,
                            tCm = t.cm,
                            tFg = t.fg
                        if (th < -330 && tFg < 0.1) continue
                        const hx = getTerrainData(tx + eps, tz, xc).h
                        const hz = getTerrainData(tx, tz + eps, xc).h
                        let nx = -(hx - th) / eps,
                            nz = -(hz - th) / eps,
                            ny = 1.0
                        const nlen = Math.sqrt(nx * nx + ny * ny + nz * nz)
                        nx /= nlen
                        ny /= nlen
                        nz /= nlen
                        const dotLight = nx * lx + ny * ly + nz * lz
                        const shadow = Math.pow(
                            smoothstepF(0.1, -0.6, dotLight),
                            2.5
                        )
                        const depth = smoothstepF(minZ, maxZ, cz)
                        let count = 0
                        if (tFg > 0.05) {
                            const vegetation =
                                smoothstepF(50, 400, th) *
                                smoothstepF(0.85, 0.98, ny)
                            let prob =
                                shadow * 1.3 +
                                Math.pow(tRidge, 3.0) * 1.5 +
                                vegetation * 3.0
                            prob *=
                                1.0 - smoothstepF(-0.1, 0.5, dotLight) * 0.95
                            prob *= mixF(0.1, 1.4, depth) * tFg * 1.5
                            count = Math.min(
                                Math.floor(prob * density * 1.2),
                                qualityTier === 0
                                    ? 10
                                    : qualityTier === 1
                                      ? 26
                                      : 40
                            )
                            const sizeBase =
                                mixF(1.5, 4.5, depth) +
                                shadow * 2.0 +
                                vegetation * 6.0
                            const alphaBase = mixF(
                                0.1,
                                0.9,
                                depth * Math.min(prob, 1.2)
                            )
                            for (let p = 0; p < count; p++) {
                                if (pIdx >= maxPoints) break
                                const px = cx + Math.random() * cellSize,
                                    pz = cz + Math.random() * cellSize
                                positions[pIdx * 3] = px
                                positions[pIdx * 3 + 1] = getTerrainData(
                                    px,
                                    pz,
                                    xc
                                ).h
                                positions[pIdx * 3 + 2] = pz
                                sizes[pIdx] = sizeBase
                                alphas[pIdx] = alphaBase
                                pIdx++
                            }
                        } else {
                            const farFactor = smoothstepF(-100.0, -1000.0, cz),
                                isPeak = smoothstepF(100.0, 500.0, th)
                            let probStructure =
                                Math.pow(tRidge, 2.6) * 3.5 + shadow * 1.15
                            probStructure *= 0.5 + 0.5 * tCm
                            probStructure *=
                                mixF(0.25, 1.15, depth) *
                                mixF(0.55, 1.0, smoothstepF(-260, 220, th))
                            probStructure *= 1.0 + farFactor * isPeak * 4.5
                            count = Math.min(
                                Math.floor(probStructure * density),
                                qualityTier === 0
                                    ? 6
                                    : qualityTier === 1
                                      ? 18
                                      : 26
                            )
                            let sBase =
                                mixF(1.2, 3.6, depth) +
                                shadow * 2.0 +
                                Math.pow(tRidge, 2.0) * 1.5
                            if (farFactor > 0.1)
                                sBase += 15.0 * farFactor * isPeak
                            let aBase =
                                mixF(0.1, 0.6, depth) *
                                (0.55 + 0.45 * tCm) *
                                mixF(0.85, 1.0, shadow)
                            if (farFactor > 0.1)
                                aBase += 1.4 * farFactor * isPeak
                            for (let p = 0; p < count; p++) {
                                if (pIdx >= maxPoints) break
                                const sid =
                                    (Math.floor(tx / 18) +
                                        Math.floor(tz / 18) * 911) *
                                        37.1 +
                                    p * 13.7
                                const px = cx + hash(sid * 1.3) * cellSize,
                                    pz = cz + hash(sid * 7.9) * cellSize
                                positions[pIdx * 3] = px
                                positions[pIdx * 3 + 1] = getTerrainData(
                                    px,
                                    pz,
                                    xc
                                ).h
                                positions[pIdx * 3 + 2] = pz
                                sizes[pIdx] = sBase
                                alphas[pIdx] = clampF(aBase, 0.05, 1.0)
                                pIdx++
                            }
                        }
                    }

                    // 🌟 极速生成，不再渲染任何 Loading 界面，仅仅是防止主线程卡死
                    if (performance.now() - lastYield > yieldInterval) {
                        await new Promise((r) => requestAnimationFrame(r))
                        lastYield = performance.now()
                    }
                }

                if (!isMounted) return

                const geo = new THREE.BufferGeometry()
                geo.setAttribute(
                    "position",
                    new THREE.BufferAttribute(positions.slice(0, pIdx * 3), 3)
                )
                geo.setAttribute(
                    "aSize",
                    new THREE.BufferAttribute(sizes.slice(0, pIdx), 1)
                )
                geo.setAttribute(
                    "aAlpha",
                    new THREE.BufferAttribute(alphas.slice(0, pIdx), 1)
                )

                mountainMat = new THREE.ShaderMaterial({
                    vertexShader: mountainVert,
                    fragmentShader: mountainFrag,
                    uniforms: {
                        uTime: { value: 0 },
                        uColor: { value: new THREE.Color(0x2a2a2a) },
                        uScroll: { value: 0 },
                        uVelocity: { value: 0 },
                        uMouse: { value: new THREE.Vector2(0, 0) },
                        uMouseActive: { value: 0 },
                        uFlatMode: { value: 0.0 }, // mobile handled by early return above
                    },
                    transparent: true,
                    blending: THREE.NormalBlending,
                    depthWrite: false,
                })
                mountain = new THREE.Points(geo, mountainMat)
                mountain.renderOrder = 30
                mountain.frustumCulled = false
                scene.add(mountain)

                // — Star field ——————————————————————————————————————
                const starCount = qualityTier === 1 ? 400 : 800
                const starPos = new Float32Array(starCount * 3)
                const starSizes = new Float32Array(starCount)
                const starPhases = new Float32Array(starCount)
                // 按第二页相机最终位置反推世界坐标，铺满整个视口
                const targetCamZ = 1940,
                    targetCamY = 200
                const aspect = containerW / window.innerHeight
                for (let i = 0; i < starCount; i++) {
                    const z = -100 - Math.random() * 1800 // Z: -100 ~ -1900
                    const depth = targetCamZ - z
                    const halfH = depth * 0.5095 // tan(27°)
                    const halfW = halfH * aspect
                    const ndcY = (Math.random() - 0.5) * 2.3 // ±1.15 — 铺满全屏 + 边缘溢出
                    const ndcX = (Math.random() - 0.5) * 2.3 // ±1.15 — 铺满全屏 + 边缘溢出
                    starPos[i * 3] = ndcX * halfW
                    starPos[i * 3 + 1] = targetCamY + ndcY * halfH
                    starPos[i * 3 + 2] = z
                    starSizes[i] =
                        Math.random() < 0.8
                            ? 2.0 + Math.random() * 2.0
                            : 4.0 + Math.random() * 3.0
                    starPhases[i] = Math.random() * 6.2831
                }
                const starGeo = new THREE.BufferGeometry()
                starGeo.setAttribute(
                    "position",
                    new THREE.BufferAttribute(starPos, 3)
                )
                starGeo.setAttribute(
                    "aSize",
                    new THREE.BufferAttribute(starSizes, 1)
                )
                starGeo.setAttribute(
                    "aPhase",
                    new THREE.BufferAttribute(starPhases, 1)
                )
                const starMat = new THREE.ShaderMaterial({
                    vertexShader: starVert,
                    fragmentShader: starFrag,
                    uniforms: {
                        uTime: { value: 0 },
                        uScroll: { value: 0 },
                    },
                    transparent: true,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending,
                })
                starMesh = new THREE.Points(starGeo, starMat)
                starMesh.renderOrder = 40
                starMesh.frustumCulled = false
                scene.add(starMesh)
                // ——————————————————————————————————————————————————

                const flockCount =
                        qualityTier === 0 ? 0 : qualityTier === 1 ? 2 : 3,
                    birdsPerFlock = 15,
                    totalBirds = flockCount * birdsPerFlock
                const bPos = new Float32Array(totalBirds * 3),
                    bSize = new Float32Array(totalBirds)
                for (let f = 0; f < flockCount; f++) {
                    const flockZ = -500 - Math.random() * 1500,
                        flockY = 300 + Math.random() * 400
                    const flockSpeed = 0.8 + Math.random() * 0.5,
                        startXOffset = f * 2500 + Math.random() * 2000
                    for (let b = 0; b < birdsPerFlock; b++) {
                        const offsetX = b * (30 + Math.random() * 20),
                            offsetZ =
                                (Math.random() - 0.5) * 150 * (b * 0.1 + 1)
                        bSize[f * birdsPerFlock + b] = 15 + Math.random() * 10
                        birdData.push({
                            baseX: -2500 - startXOffset + offsetX,
                            baseY: flockY + (Math.random() - 0.5) * 50,
                            baseZ: flockZ + offsetZ,
                            speed: flockSpeed,
                            scatterVX: 0,
                            scatterVY: 0,
                            scatterVZ: 0,
                            scatterX: 0,
                            scatterY: 0,
                            scatterZ: 0,
                        })
                    }
                }
                birdGeo = new THREE.BufferGeometry()
                if (totalBirds > 0) {
                    birdGeo.setAttribute(
                        "position",
                        new THREE.BufferAttribute(bPos, 3).setUsage(
                            THREE.DynamicDrawUsage
                        )
                    )
                    birdGeo.setAttribute(
                        "aSize",
                        new THREE.BufferAttribute(bSize, 1)
                    )
                }

                const birdMat = new THREE.ShaderMaterial({
                    vertexShader: birdVert,
                    fragmentShader: birdFrag,
                    uniforms: {
                        uColor: { value: new THREE.Color(0x111111) },
                        uTime: { value: 0 },
                        uScroll: { value: 0 },
                        uMouse: { value: new THREE.Vector2(0, 0) },
                        uMouseActive: { value: 0 },
                    },
                    transparent: true,
                    depthWrite: false,
                })
                birdMesh = new THREE.Points(birdGeo, birdMat)
                birdMesh.renderOrder = 90
                birdMesh.frustumCulled = false
                scene.add(birdMesh)

                // 生成完毕，显示画布并触发文字入场
                if (mountRef.current) mountRef.current.style.opacity = "1"
                sceneReadyRef.current = true
                tryReveal()

                cleanupAnimation = startAnimation(
                    scene,
                    camera,
                    renderer,
                    mountainMat,
                    mountain,
                    birdMesh,
                    birdGeo,
                    birdData,
                    () =>
                        isCanvas
                            ? (scrollDemoRef.current ?? 0) > 0
                                ? (scrollDemoRef.current ?? 0)
                                : scrollForAnimation.current
                            : scrollForAnimation.current,
                    () => isSceneVisible,
                    () =>
                        enableMouseSpotlight && scrollProgress < 0.25
                            ? mouseActive
                            : 0,
                    qualityTier,
                    false, // forceVisible: use IO — pauses WebGL when component exits viewport
                    () => isCanvas,
                    backgroundRef.current,
                    starMat
                )
                if (!isMounted) {
                    cleanupAnimation()
                    cleanupAnimation = undefined
                }
            } catch (e) {
                console.error("Three.js Error:", e)
            }
        }

        function startAnimation(
            sceneArg: any,
            cameraArg: any,
            rendererArg: any,
            mountainMatArg: any,
            mountainMeshArg: any,
            birdMeshArg: any,
            birdGeoArg: any,
            birdDataArg: BirdDatum[],
            getScroll: () => number,
            getVisible: () => boolean,
            getMouseActive: () => number,
            qualityTierArg: number,
            forceVisible: boolean,
            getIsDemo: () => boolean,
            backgroundEl: HTMLElement | null,
            starMatArg: any
        ): () => void {
            const baseFogColor = new THREE.Color(0xffffff)
            const targetFogColor = new THREE.Color(0x000000) // pure black — 水墨夜
            let lastTime = performance.now()
            let lastRenderTime = 0
            let lastFogScroll = -1
            let smoothScroll = 0
            let scrollSpring = 0
            const scatterRadius = 0.4,
                scatterForce = 80,
                scatterDamping = 0.92,
                returnForce = 0.035,
                maxScatter = 120,
                maxVelocity = 8
            const scatterRadiusSq = scatterRadius * scatterRadius
            const maxScatterSq = maxScatter * maxScatter
            const maxVelocitySq = maxVelocity * maxVelocity
            const projVec = new THREE.Vector4(),
                vpMatrix = new THREE.Matrix4()

            // ── Visibility / pause system ──────────────────────────────────
            let isRunning = false
            let isPageVisible =
                !document.hidden && document.visibilityState === "visible"
            let isInViewport = true // optimistic start; IO will pause if out of view

            const updateState = () => {
                const shouldRun = isPageVisible && isInViewport
                if (shouldRun === isRunning) return
                isRunning = shouldRun
                if (isRunning) {
                    lastTime = performance.now()
                    animationFrameId = requestAnimationFrame(animate)
                } else {
                    cancelAnimationFrame(animationFrameId)
                    animationFrameId = 0
                }
            }
            const onVisChange = () => {
                isPageVisible =
                    !document.hidden && document.visibilityState === "visible"
                updateState()
            }
            const onBlur = () => {
                isPageVisible = false
                updateState()
            }
            const onFocus = () => {
                isPageVisible =
                    !document.hidden && document.visibilityState === "visible"
                updateState()
            }
            const onPageHide = () => {
                isPageVisible = false
                updateState()
            }
            const onPageShow = () => {
                isPageVisible =
                    !document.hidden && document.visibilityState === "visible"
                updateState()
            }
            document.addEventListener("visibilitychange", onVisChange)
            window.addEventListener("blur", onBlur, { passive: true })
            window.addEventListener("focus", onFocus, { passive: true })
            window.addEventListener("pagehide", onPageHide, { passive: true })
            window.addEventListener("pageshow", onPageShow, { passive: true })

            let io: IntersectionObserver | null = null
            if (
                !forceVisible &&
                "IntersectionObserver" in window &&
                backgroundEl
            ) {
                io = new IntersectionObserver(
                    (entries) => {
                        isInViewport = !!entries[0] && entries[0].isIntersecting
                        updateState()
                    },
                    { threshold: 0 }
                )
                io.observe(backgroundEl)
            }
            const ensureRunning = () => {
                if (!getVisible()) return
                updateState()
            }
            resumeSceneAnimation = ensureRunning
            // Pre-compile shaders before first render — eliminates first-frame GPU compile stutter
            renderer.compile(scene, camera)
            // Start immediately — IO will pause if scrolled out of view
            updateState()
            // ──────────────────────────────────────────────────────────────

            function animate() {
                if (!isRunning) return
                // Check scroll-based visibility BEFORE scheduling — stops RAF entirely
                // past 320vh instead of looping with early returns every frame.
                // The IO (enabled by forceVisible:false) will restart via updateState().
                if (!getVisible()) {
                    isRunning = false
                    animationFrameId = 0
                    return
                }
                animationFrameId = requestAnimationFrame(animate)
                const now = performance.now()
                const dt = Math.min(0.033, (now - lastTime) / 1000)
                lastTime = now
                const scrollNow = getScroll()
                // Frame-rate independent spring: stable on 60/120/144Hz panels.
                const fpsRatio = Math.min(dt / 0.01666, 3.0)
                if (getIsDemo()) {
                    smoothScroll = scrollNow
                    scrollSpring = 0
                } else {
                    scrollSpring +=
                        (scrollNow - smoothScroll) * (0.14 * fpsRatio)
                    scrollSpring *= Math.pow(0.30, fpsRatio)
                    smoothScroll = Math.min(
                        Math.max(smoothScroll + scrollSpring, 0),
                        1
                    )
                }
                const sceneTransitionScroll = smoothScroll
                const velMag = Math.min(Math.abs(scrollSpring) * 30, 1.0)

                // Throttle to ~30fps during the dark reading zone (scroll > 72%)
                if (
                    scrollNow > 0.72 &&
                    scrollNow < 0.95 &&
                    now - lastRenderTime < 33
                )
                    return
                // Global FPS cap for mid/low-end devices
                const fpsCap = qualityTierArg === 1 ? 33 : 0
                if (fpsCap > 0 && now - lastRenderTime < fpsCap) return
                lastRenderTime = now
                const t = now * 0.001

                const activeMouse =
                    enableMouseSpotlight && getMouseActive() > 0.5 ? 1 : 0
                // 山粒子 alphaFade 在 scroll=0.65 全部归零 — 提前隐藏 mesh 跳过 GPU vertex shader
                const mountainFullyGone = sceneTransitionScroll >= 0.65
                if (mountainMeshArg.visible === mountainFullyGone) {
                    mountainMeshArg.visible = !mountainFullyGone
                }
                if (!mountainFullyGone) {
                    mountainMatArg.uniforms.uTime.value = t
                    mountainMatArg.uniforms.uScroll.value = sceneTransitionScroll
                    mountainMatArg.uniforms.uVelocity.value = velMag
                    mountainMatArg.uniforms.uMouse.value.set(mouseNDC.x, mouseNDC.y)
                    mountainMatArg.uniforms.uMouseActive.value = activeMouse
                }
                starMatArg.uniforms.uTime.value = t
                starMatArg.uniforms.uScroll.value = sceneTransitionScroll

                const active = activeMouse > 0.5
                if (active) {
                    vpMatrix.multiplyMatrices(
                        cameraArg.projectionMatrix,
                        cameraArg.matrixWorldInverse
                    )
                }

                // Birds dissolve completely at scroll 0.52 — skip CPU physics + GPU upload after that
                const birdsGone = birdDataArg.length === 0 || sceneTransitionScroll >= 0.58
                if (birdMeshArg.visible === birdsGone) birdMeshArg.visible = !birdsGone
                if (!birdsGone) {
                const posArr = birdGeoArg.attributes.position
                    .array as Float32Array
                for (let i = 0; i < birdDataArg.length; i++) {
                    const i3 = i * 3
                    const d = birdDataArg[i]
                    d.baseX += d.speed * dt * 60.0
                    if (d.baseX > 2500) d.baseX = -4500 - Math.random() * 3000

                    if (qualityTierArg >= 1 && active) {
                        const bx = d.baseX + d.scatterX,
                            by = d.baseY + d.scatterY,
                            bz = d.baseZ + d.scatterZ
                        projVec.set(bx, by, bz, 1.0).applyMatrix4(vpMatrix)
                        if (projVec.w > 0) {
                            const ndcX = projVec.x / projVec.w,
                                ndcY = projVec.y / projVec.w
                            const sdx = ndcX - mouseNDC.x,
                                sdy = ndcY - mouseNDC.y
                            const screenDistSq = sdx * sdx + sdy * sdy
                            if (screenDistSq < scatterRadiusSq) {
                                const screenDist = Math.sqrt(screenDistSq)
                                const ndcLen = screenDist || 0.001
                                const dirX = sdx / ndcLen,
                                    dirY = sdy / ndcLen
                                const proximity =
                                    1.0 - screenDist / scatterRadius
                                const strength =
                                    scatterForce * proximity * proximity * dt
                                d.scatterVX += dirX * strength * 1.5
                                d.scatterVY +=
                                    dirY * strength * 1.2 + strength * 0.2
                                d.scatterVZ +=
                                    (Math.random() - 0.5) * strength * 0.4
                            }
                        }
                    }
                    d.scatterVX *= scatterDamping
                    d.scatterVY *= scatterDamping
                    d.scatterVZ *= scatterDamping
                    const velSq = d.scatterVX * d.scatterVX + d.scatterVY * d.scatterVY + d.scatterVZ * d.scatterVZ
                    if (velSq > maxVelocitySq) {
                        const vel = Math.sqrt(velSq)
                        const s = maxVelocity / vel
                        d.scatterVX *= s
                        d.scatterVY *= s
                        d.scatterVZ *= s
                    }
                    d.scatterVX -= d.scatterX * returnForce
                    d.scatterVY -= d.scatterY * returnForce
                    d.scatterVZ -= d.scatterZ * returnForce
                    d.scatterX += d.scatterVX
                    d.scatterY += d.scatterVY
                    d.scatterZ += d.scatterVZ
                    const dispSq = d.scatterX * d.scatterX + d.scatterY * d.scatterY + d.scatterZ * d.scatterZ
                    if (dispSq > maxScatterSq) {
                        const disp = Math.sqrt(dispSq)
                        const cs = maxScatter / disp
                        d.scatterX *= cs
                        d.scatterY *= cs
                        d.scatterZ *= cs
                        d.scatterVX *= 0.5
                        d.scatterVY *= 0.5
                        d.scatterVZ *= 0.5
                    }
                    posArr[i3] = d.baseX + d.scatterX
                    posArr[i3 + 1] = d.baseY + d.scatterY
                    posArr[i3 + 2] = d.baseZ + d.scatterZ
                }
                birdGeoArg.attributes.position.needsUpdate = true
                birdMeshArg.material.uniforms.uTime.value = t
                birdMeshArg.material.uniforms.uScroll.value =
                    sceneTransitionScroll
                birdMeshArg.material.uniforms.uMouse.value.set(
                    mouseNDC.x,
                    mouseNDC.y
                )
                birdMeshArg.material.uniforms.uMouseActive.value = activeMouse
                } // end if (!birdsGone)
                if (Math.abs(sceneTransitionScroll - lastFogScroll) > 0.004) {
                    sceneArg.fog.color
                        .copy(baseFogColor)
                        .lerp(
                            targetFogColor,
                            smoothstepF(0.25, 0.55, sceneTransitionScroll)
                        )
                    lastFogScroll = sceneTransitionScroll
                }

                // Cinematic camera: smooth lerp dolly + mouse-driven parallax tilt
                const camT = smoothstepF(0.0, 0.65, smoothScroll)
                const targetZ = 2200 - camT * 260
                const targetY = 200 + camT * 130
                const targetX = scrollNow < 0.45 ? mouseNDC.x * 38 : 0
                cameraArg.position.x += (targetX - cameraArg.position.x) * 0.04
                cameraArg.position.y += (targetY - cameraArg.position.y) * 0.055
                cameraArg.position.z += (targetZ - cameraArg.position.z) * 0.055

                rendererArg.render(sceneArg, cameraArg)
            }

            return () => {
                cancelAnimationFrame(animationFrameId)
                animationFrameId = 0
                document.removeEventListener("visibilitychange", onVisChange)
                window.removeEventListener("blur", onBlur)
                window.removeEventListener("focus", onFocus)
                window.removeEventListener("pagehide", onPageHide)
                window.removeEventListener("pageshow", onPageShow)
                io?.disconnect()
                if (resumeSceneAnimation === ensureRunning) {
                    resumeSceneAnimation = null
                }
            }
        }

        let resizeRaf = 0
        const handleResize = () => {
            if (resizeRaf) return
            resizeRaf = requestAnimationFrame(() => {
                resizeRaf = 0
                winHeight = window.innerHeight
                winWidth = window.innerWidth
                if (!camera || !renderer) return
                const containerW =
                    mountRef.current?.offsetWidth || winWidth
                camera.aspect = containerW / winHeight
                camera.updateProjectionMatrix()
                renderer.setSize(containerW, winHeight)
            })
        }

        window.addEventListener("resize", handleResize, { passive: true })
        init3D()

        return () => {
            isMounted = false
            cancelAnimationFrame(scrollPollRaf)
            document.removeEventListener("scroll", onScrollRaf, {
                capture: true,
            })
            document.removeEventListener("visibilitychange", resumeScrollPoll)
            window.removeEventListener("focus", resumeScrollPoll)
            pollIO?.disconnect()
            if (enableMouseSpotlight) {
                window.removeEventListener("mousemove", handleMouseMove)
                window.removeEventListener("mouseleave", handleMouseLeave)
            }
            window.removeEventListener("loaderFinished", onLoaderDone)
            window.removeEventListener("resize", handleResize)
            window.removeEventListener("resize", refreshPhotoRect)
            if (tiltRaf) cancelAnimationFrame(tiltRaf)
            if (photoEl) {
                photoEl.removeEventListener("mousemove", onTiltMove)
                photoEl.removeEventListener("mouseleave", onTiltLeave)
            }
            if (resizeRaf) cancelAnimationFrame(resizeRaf)
            cancelAnimationFrame(animationFrameId)
            cleanupAnimation?.()
            if (renderer && mountRef.current?.contains(renderer.domElement))
                mountRef.current.removeChild(renderer.domElement)
            mountain?.geometry.dispose()
            mountain?.material.dispose()
            starMesh?.geometry.dispose()
            ;(starMesh?.material as THREE.ShaderMaterial | undefined)?.dispose()
            birdMesh?.geometry.dispose()
            birdMesh?.material.dispose()
            renderer?.dispose()
        }
    }, [])

    return (
        <div
            ref={backgroundRef}
            style={{
                width: "100%",
                // Flow-based height: 100vh (p1 spacer) + 170vh (p2 zone) = 270vh total
                // maxScrollY = 170vh → progress = 170/165 = 1.03, safely reaches 1.0
                position: "relative",
                minHeight: "260vh",
                backgroundColor: "#FFFFFF",
            }}
        >
            <style
                dangerouslySetInnerHTML={{
                    __html: `
            *, *::before, *::after { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; box-sizing: border-box; }
            
            .noise-overlay {
                position: absolute; inset: 0; z-index: 10; pointer-events: none;
                background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');
                opacity: 0.05; 
            }

            /* ── Page 1 hero text: held invisible until scene-loaded class fires ── */
            .framer-xy-hero h1 {
                font-family: 'Cormorant Garamond', serif;
                font-size: clamp(48px, 6vw, 82px);
                letter-spacing: 0.04em;
                font-weight: 200;
                margin: 0 0 20px 0;
                line-height: 1;
                display: flex; flex-wrap: wrap; gap: 16px; align-items: baseline;
            }
            .framer-xy-hero .w {
                display: inline-block;
                opacity: 0;
                transform: translateY(10px) scale(0.96);
                filter: blur(6px);
                will-change: transform, opacity, filter;
            }
            .scene-loaded .framer-xy-hero .w {
                animation: appleReveal 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .scene-loaded .framer-xy-hero .w:nth-child(1) { animation-delay: 0.00s; }
            .scene-loaded .framer-xy-hero .w:nth-child(2) { animation-delay: 0.10s; }
            .scene-loaded .framer-xy-hero .w:nth-child(3) { animation-delay: 0.22s; }

            @keyframes appleReveal {
                to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px); }
            }

            .framer-xy-sub {
                font-family: 'Cormorant Garamond', serif;
                font-size: 16px; color: #666; letter-spacing: 0.02em; line-height: 1.6; max-width: 440px; font-weight: 200; white-space: pre-line;
                opacity: 0; transform: translateY(7px); filter: blur(4px);
                will-change: transform, opacity, filter;
            }
            .scene-loaded .framer-xy-sub { animation: appleRevealSub 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.55s; }

            @keyframes appleRevealSub {
                to { opacity: 1; transform: translateY(0); filter: blur(0px); }
            }

            /* Quote, scroll-hint, right vertical — gated the same way */
            .hero-quote { opacity: 0; transform: translateY(6px); filter: blur(3px); }
            .scene-loaded .hero-quote { animation: appleRevealSub 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.80s; }
            .hero-scroll-hint { opacity: 0; transform: translateY(4px); }
            .scene-loaded .hero-scroll-hint { animation: appleRevealHint 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards 1.00s; }
            @keyframes appleRevealHint {
                to { opacity: 1; transform: translateY(0); }
            }
            .hero-right-vertical { opacity: 0; transition: opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.30s; }
            .scene-loaded .hero-right-vertical { opacity: 0.9; }
            
            /* Page 2 — centered layout, generous spacing */
            .page2-center-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                gap: 0;
                width: 100%;
                max-width: 860px;
                margin: 0 auto;
                transform: translateY(0);
            }

            /* Sky wash — 全屏氛围光晕染，真实星星由 WebGL canvas 提供 */
            .page2-sky-wash {
                position: absolute;
                inset: 0;
                pointer-events: none;
                z-index: 2;
                background:
                    radial-gradient(ellipse 54% 36% at 50% 42%, rgba(175, 200, 255, 0.06), transparent 62%),
                    radial-gradient(ellipse 78% 60% at 50% 48%, rgba(255,255,255,0.02), transparent 58%),
                    radial-gradient(ellipse 100% 88% at 50% 50%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.10) 72%, rgba(0,0,0,0.28) 100%);
            }

            /* Spring bounce reveal */
            .p2-fade {
                opacity: 0;
                transform: translateY(20px) scale(0.98);
                transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                            transform 0.7s cubic-bezier(0.34, 1.52, 0.64, 1);
                will-change: opacity, transform;
            }
            .page2-active .p2-fade { opacity: 1; transform: translateY(0) scale(1); }
            .page2-photo-wrapper.p2-fade {
                transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                            transform 1.0s cubic-bezier(0.34, 1.65, 0.64, 1);
            }
            .delay-1 { transition-delay: 0.00s; }
            .delay-2 { transition-delay: 0.07s; }
            .delay-3 { transition-delay: 0.15s; }
            .delay-4 { transition-delay: 0.26s; }
            .delay-5 { transition-delay: 0.36s; }
            .delay-6 { transition-delay: 0.46s; }

            /* Avatar wrapper */
            .page2-photo-wrapper {
                position: relative; border-radius: 50%; margin-bottom: 36px;
                padding: 0; background: none; border: none;
                --rx: 0deg; --ry: 0deg;
            }

            /* Rotating shimmer arc — appears on hover */
            @keyframes avatarShimmer { to { transform: rotate(360deg); } }
            .page2-photo-wrapper::before {
                content: '';
                position: absolute; inset: -3px; border-radius: 50%;
                background: conic-gradient(
                    from 0deg,
                    transparent 0%, rgba(255,255,255,0.5) 18%,
                    rgba(255,255,255,0.88) 28%, rgba(255,255,255,0.5) 38%,
                    transparent 55%
                );
                -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px));
                mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px));
                animation: avatarShimmer 3.5s linear infinite;
                opacity: 0;
                transition: opacity 0.6s ease;
                pointer-events: none;
                z-index: 3;
            }
            .page2-photo-wrapper:hover::before { opacity: 1; }

            /* Photo — 3D tilt driven by JS CSS vars */
            .page2-photo {
                width: clamp(160px, 22vw, 220px); height: clamp(160px, 22vw, 220px);
                overflow: hidden; position: relative; border-radius: 50%;
                box-shadow: 0 16px 50px rgba(0,0,0,0.65);
                filter: grayscale(10%) contrast(1.06);
                z-index: 2;
                transform: perspective(700px) rotateX(var(--rx)) rotateY(var(--ry));
                transition: transform 0.18s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.4s ease;
                will-change: transform;
            }
            .page2-photo-wrapper:hover .page2-photo {
                box-shadow: 0 22px 60px rgba(0,0,0,0.78);
            }
            .page2-photo img { object-fit: cover !important; width: 100% !important; height: 100% !important; object-position: center !important; }
            .framer-photo-container > * { width: 100% !important; height: 100% !important; border-radius: 50% !important; }

            /* Name block — title + expanding rule + subtitle as one visual unit */
            .page2-name-block { display: flex; flex-direction: column; align-items: center; gap: 0; margin-bottom: 28px; }

            @keyframes titleBreath { 0%,100% { text-shadow: 0 2px 12px rgba(0,0,0,0.6); } 50% { text-shadow: 0 2px 12px rgba(0,0,0,0.6), 0 0 50px rgba(255,255,255,0.06); } }
            .page2-title {
                font-family: 'Cormorant Garamond', serif;
                font-size: clamp(32px, 4.8vw, 62px); letter-spacing: 0.01em; line-height: 1.2;
                font-weight: 300; color: #FFFFFF; text-shadow: 0 2px 12px rgba(0,0,0,0.6);
                margin-bottom: 18px; overflow: hidden;
            }
            .page2-active .page2-title { animation: titleBreath 5s ease-in-out infinite 1s; }

            /* Clip-path word reveal — each word slides up from mask */
            .page2-word {
                display: inline-block;
                opacity: 0;
                transform: translateY(0.75em);
                transition: opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1),
                            transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
            }
            .page2-active .page2-word { opacity: 1; transform: translateY(0); }

            /* Expanding rule beneath the name */
            .page2-name-rule {
                width: 0; height: 1px;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                margin-bottom: 18px;
                transition: width 0.9s cubic-bezier(0.4, 0, 0.2, 1) 0.25s;
            }
            .page2-active .page2-name-rule { width: 280px; }

            .page2-subtitle {
                font-family: 'Cormorant Garamond', serif;
                font-size: clamp(15px, 1.8vw, 19px); font-weight: 300; font-style: italic;
                letter-spacing: 0.015em; line-height: 1.5; color: rgba(255,255,255,0.6);
                white-space: pre-line;
            }

            /* Brand row */
            .page2-brand-row { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 24px; }
            .page2-brand-line { height: 1px; width: 36px; background: linear-gradient(90deg, rgba(255,255,255,0.22), rgba(255,255,255,0)); transform-origin: left; transform: scaleX(0); transition: transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) 0.5s; }
            .page2-brand-line.left { background: linear-gradient(270deg, rgba(255,255,255,0.22), rgba(255,255,255,0)); transform-origin: right; }
            .page2-active .page2-brand-line { transform: scaleX(1); }
            .scramble-text { contain: layout paint; }

            .page2-footer { font-family: 'Murecho', sans-serif; font-size: 10px; font-weight: 300; letter-spacing: 0.06em; color: rgba(255,255,255,0.28); line-height: 1.8; white-space: pre-line; }

            /* ─── Bridge Section ─── */
            .bridge-panel {
                position: sticky; top: 0; width: 100%; height: 100vh;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                pointer-events: none; overflow: hidden;
            }

            /* Radial moonlight glow */
            .bridge-glow {
                position: absolute; inset: 0; z-index: 1; pointer-events: none;
                background: radial-gradient(ellipse 55% 38% at 50% 52%, rgba(190,210,255,0.055), transparent);
                opacity: 0;
                transition: opacity 1.8s ease;
            }
            .bridge-active .bridge-glow { opacity: 1; }

            /* Chapter label — crossfade between 01/02 */
            .ch-02 { position: absolute; right: 0; opacity: 0; transition: opacity 0.6s ease; }
            .chapter-profile .ch-01 { opacity: 0; transition: opacity 0.6s ease; }
            .chapter-profile .ch-02 { opacity: 1; }

            @keyframes glowPulse { 0%,100% { opacity:0.7; } 50% { opacity:1; } }
            .bridge-active .bridge-glow { animation: glowPulse 6s ease-in-out infinite 2s; }

            @keyframes inkBreathe {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.7; }
            }
            @keyframes inkRise {
              0% { transform: translateY(4px); }
              100% { transform: translateY(-4px); }
            }
            .ink-far  { animation: inkBreathe 8s ease-in-out infinite; }
            .ink-mid  { animation: inkBreathe 6s ease-in-out infinite 1s, inkRise 10s ease-in-out infinite alternate; }
            .ink-near { animation: inkBreathe 5s ease-in-out infinite 0.5s; }
            .ink-fg   { animation: inkRise 12s ease-in-out infinite alternate; }

            @media (max-width: 768px) {
              .framer-xy-hero h1 { font-size: clamp(28px, 9vw, 42px); gap: 10px; margin: 0 0 14px 0; }
              .framer-xy-sub { font-size: 13px; line-height: 1.7; }
              .hero-quote { font-size: 13px; max-width: 88vw; }
              .hero-right-vertical { display: none; }
              .page2-center-container { max-width: 92vw; transform: translateY(0); }
              .page2-sky-wash {
                  background:
                      radial-gradient(ellipse 68% 40% at 50% 36%, rgba(175, 200, 255, 0.1), transparent 62%),
                      radial-gradient(ellipse 110% 88% at 50% 46%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.22) 72%, rgba(0,0,0,0.5) 100%);
              }
              .page2-tag { margin-bottom: 22px; }
              .page2-photo { width: clamp(132px, 38vw, 180px); height: clamp(132px, 38vw, 180px); }
              .page2-name-block { margin-bottom: 20px; }
              .page2-title { font-size: clamp(28px, 8.8vw, 42px); margin-bottom: 14px; }
              .page2-name-rule { margin-bottom: 14px; }
              .page2-active .page2-name-rule { width: min(70vw, 240px); }
              .page2-subtitle { font-size: 14px; line-height: 1.6; }
              .page2-brand-row { gap: 10px; margin-bottom: 18px; }
              .page2-brand-line { width: 24px; }
              .page2-footer { font-size: 9px; line-height: 1.7; }
            }
            @media (prefers-reduced-motion: reduce) {
                .framer-xy-hero .w, .framer-xy-sub, .hero-quote, .hero-scroll-hint, .p2-fade { animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important; }
                .hero-right-vertical { opacity: 0.9 !important; transition: none !important; }
            }

`,
                }}
            />

            {/* Night overlay — opacity 0→1，只走 Compositor，替代 backgroundColor repaint */}
            <div
                ref={nightOverlayRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "#000",
                    opacity: 0,
                    pointerEvents: "none",
                    zIndex: 0,
                    willChange: "opacity",
                }}
            />

            {/* 第一页 WebGL Wrapper — fixed 跳出 Framer 祖先 layout，消除 sticky 弹跳 */}
            <div
                ref={wrapperRef}
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100vh",
                    zIndex: 1,
                    willChange: "opacity",
                    pointerEvents: "none",
                    overflow: "hidden",
                }}
            >
                <div
                    ref={mountRef}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        zIndex: 1,
                        opacity: 0,
                        transition: "opacity 1.5s ease-in",
                        pointerEvents: "none",
                    }}
                />

                <div
                    ref={uiRef}
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 6,
                        color: "#111",
                        pointerEvents: "none",
                        transition: "opacity 0.1s linear",
                        willChange: "opacity",
                    }}
                >
                    <div
                        className="framer-xy-hero"
                        style={{
                            position: "absolute",
                            left: "6vw",
                            top: "50%",
                            transform: "translateY(-50%)",
                            maxWidth: "520px",
                        }}
                    >
                        <h1
                            aria-label={`${heroWord1}, ${heroWord2}, ${heroWord3}`}
                        >
                            <span className="w">{heroWord1}</span>
                            <span className="w">{heroWord2}</span>
                            <span className="w">{heroWord3}</span>
                        </h1>
                        <div className="framer-xy-sub">{heroSubtitle}</div>
                    </div>
                    <div
                        style={{
                            position: "absolute",
                            top: "50%",
                            right: "6vw",
                            transform: "translateY(-50%)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "24px",
                        }}
                    >
                        <div
                            className="hero-right-vertical"
                            style={{
                                writingMode: "vertical-rl",
                                letterSpacing: "1.2em",
                                fontWeight: 200,
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize: "16px",
                                whiteSpace: "pre-line",
                                textAlign: "center",
                            }}
                        >
                            {rightVerticalText}
                        </div>
                        {sealComponent && (
                            <div
                                style={{ pointerEvents: "auto", opacity: 0.95 }}
                            >
                                {sealComponent}
                            </div>
                        )}
                    </div>
                    <div
                        style={{
                            position: "absolute",
                            left: "6vw",
                            bottom: "36px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "20px",
                            pointerEvents: "none",
                        }}
                    >
                        <div
                            className="hero-quote"
                            style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontStyle: "italic",
                                fontSize: "16px",
                                letterSpacing: "0.03em",
                                fontWeight: 200,
                                color: "#777",
                                maxWidth: "480px",
                                lineHeight: "1.6",
                                whiteSpace: "pre-line",
                            }}
                        >
                            {quoteLine}
                        </div>
                        <div
                            className="hero-scroll-hint"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                fontFamily: "'Murecho', sans-serif",
                                fontSize: "10px",
                                fontWeight: 300,
                                letterSpacing: "0.2em",
                                color: "#888",
                                textTransform: "uppercase",
                            }}
                        >
                            <div
                                style={{
                                    width: "40px",
                                    height: "1px",
                                    background: "#888",
                                    opacity: 0.5,
                                }}
                            />
                            {scrollHint}
                        </div>
                    </div>
                </div>

            </div>

            {/* Hero spacer — 组件前 100vh 保持英雄动画 */}
            <div style={{ height: "100vh", pointerEvents: "none" }} />

            {/* Profile zone — 160vh，星空固定 canvas 为背景 */}
            <div style={{ position: "relative", height: "160vh", zIndex: 10 }}>
                <div
                    ref={blackPageRef}
                    style={{
                        position: "sticky",
                        top: 0,
                        width: "100%",
                        height: "100vh",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        paddingBottom: "12vh",
                        color: "#F5F5F5",
                        opacity: 0,
                        pointerEvents: "none",
                        willChange: "opacity",
                    }}
                >
                    <div className="page2-sky-wash" />
                    <div className="noise-overlay" />
                    <div
                        className="page2-center-container"
                        style={{ position: "relative", zIndex: 12 }}
                    >
                        {(photoUrl || photoComponent) && (
                            <div
                                className="page2-photo-wrapper p2-fade delay-2"
                                ref={photoWrapperRef}
                            >
                                <div
                                    className="page2-photo"
                                    style={{ pointerEvents: "auto" }}
                                >
                                    {photoUrl ? (
                                        <img
                                            className="page2-card-image"
                                            src={photoUrl}
                                            alt=""
                                            loading="eager"
                                            decoding="async"
                                        />
                                    ) : (
                                        <div
                                            className="framer-photo-container"
                                            style={{
                                                position: "absolute",
                                                inset: 0,
                                                display: "flex",
                                                justifyContent: "center",
                                                alignItems: "center",
                                            }}
                                        >
                                            {React.isValidElement(photoComponent)
                                                ? React.cloneElement(
                                                      photoComponent as React.ReactElement<any>,
                                                      {
                                                          style: {
                                                              ...((photoComponent as React.ReactElement<any>).props?.style || {}),
                                                              width: "100%",
                                                              height: "100%",
                                                              objectFit: "cover",
                                                              borderRadius: "50%",
                                                          },
                                                      }
                                                  )
                                                : photoComponent}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="page2-name-block p2-fade delay-3">
                            <div className="page2-title">
                                {page2Title.split(" ").map((word, i) => (
                                    <span
                                        key={i}
                                        className="page2-word"
                                        style={{
                                            transitionDelay: `${0.02 + i * 0.05}s`,
                                            marginRight: "0.26em",
                                        }}
                                    >
                                        {word}
                                    </span>
                                ))}
                            </div>
                            <div className="page2-name-rule" />
                            <div className="page2-subtitle">{page2Subtitle}</div>
                        </div>
                        <div className="page2-brand-row p2-fade delay-4">
                            <div className="page2-brand-line left" />
                            <div
                                style={{
                                    fontFamily: "'Murecho', sans-serif",
                                    fontSize: "11px",
                                    fontWeight: 200,
                                    letterSpacing: "0.25em",
                                    textTransform: "uppercase",
                                    color: "rgba(255,255,255,0.85)",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {page2BrandLine}
                            </div>
                            <div className="page2-brand-line" />
                        </div>
                        <div className="page2-footer p2-fade delay-6">
                            {page2Footer}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

DigitalLandscape.defaultProps = {
    heroWord1: "Welcome,",
    heroWord2: "歡迎,",
    heroWord3: "こんにちは",
    heroSubtitle:
        "Product Designer & Creative Development.\nCrafting digital experiences with an aesthetic and modern design.",
    rightVerticalText: "先行先聽 萬縷歸心",
    quoteLine:
        "Foreground bank, distant peaks, mist breathes, birds stitch the hush, and moss remembers the ink.",
    scrollHint: "Scroll down to explore",
    page2Title: "Hi, I'm Xuyuan. I design for intuition.",
    page2Subtitle:
        "Building at the intersection of humanities and creative engineering.\nI partner with AI through Vibe Coding to shape digital spaces that breathe.",
    page2BrandLine: "GAWAIN · UX STRATEGY × VIBE CODING",
    page2Footer: "Keep scrolling. The true craft lives in the transitions.",
}

addPropertyControls(DigitalLandscape, {
    mobileBgUrl: { type: ControlType.Image, title: "Mobile BG" },
    sealComponent: { type: ControlType.ComponentInstance, title: "Seal" },
    photoComponent: { type: ControlType.ComponentInstance, title: "Photo Comp" },
    photoUrl: { type: ControlType.Image, title: "Photo URL" },
    page2Title: { type: ControlType.String, title: "P2 Title", displayTextArea: true },
    page2Subtitle: { type: ControlType.String, title: "P2 Sub", displayTextArea: true },
    page2BrandLine: { type: ControlType.String, title: "P2 Brand" },
    page2Footer: { type: ControlType.String, title: "P2 Footer", displayTextArea: true },
    heroWord1: { type: ControlType.String, title: "Hero 1" },
    heroWord2: { type: ControlType.String, title: "Hero 2" },
    heroWord3: { type: ControlType.String, title: "Hero 3" },
    heroSubtitle: {
        type: ControlType.String,
        title: "Hero Sub",
        displayTextArea: true,
    },
    rightVerticalText: {
        type: ControlType.String,
        title: "Vertical",
        displayTextArea: true,
    },
    quoteLine: {
        type: ControlType.String,
        title: "Quote",
        displayTextArea: true,
    },
    scrollHint: { type: ControlType.String, title: "Scroll Hint" },
    isLoaded: {
        type: ControlType.Boolean,
        title: "Is Loaded",
        defaultValue: true,
    },
    scrollDemo: {
        type: ControlType.Number,
        title: "Preview Scroll",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0,
        description:
            "Drag to preview scroll animation in canvas (0=start, 1=end)",
    },
})
