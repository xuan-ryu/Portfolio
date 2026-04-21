import * as React from "react"
import { useEffect, useRef } from "react"
import * as THREE from "three"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

/**
 * AboutHero — 水墨粒子背景 + 双语标题 hero
 *
 * 结构（呼应首页的 brand-corner / hero-copy / side-text / hint）
 *   ┌─ eyebrow（左上）        brand-corner（右上）─┐
 *   │                                              │
 *   │   Hero title (serif, 2 lines)                │  side-text
 *   │   subtitle                                   │  (vertical)
 *   │   name strip                                 │
 *   │                                              │
 *   └─ scroll hint                       location ─┘
 *
 * Three.js：复用首页墨山着色器，去掉 scroll-driven dispersal —
 * 静态山影 + 12 只飞鸟 + 轻微 twinkle，移动端降级为 SVG。
 *
 * Framer canvas 模式跳过 Three.js init，只渲染静态文字，
 * 保证编辑面板里不卡顿。
 */

type BirdDatum = {
    baseX: number
    baseY: number
    baseZ: number
    speed: number
}

type Props = {
    eyebrow: string
    eyebrowZh: string
    titleLine1: string
    titleLine2: string
    subtitle: string
    nameZh: string
    nameEn: string
    brandCornerZh: string
    brandCornerEn: string
    sideText: string
    scrollHint: string
    loadingPhrase: string
    location: string
    period: string
    showBirds: boolean
    showSideText: boolean
    showBrandCorner: boolean
    inkColor: string
}

// ──────────────────────────────────────────────────────────────
// SHADERS
// ──────────────────────────────────────────────────────────────
const mountainVert = `
  precision mediump float;
  uniform float uTime;
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vec3 pos = position;
    float phase = fract(sin(dot(pos.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
    float twinkle = 0.7 + 0.6 * sin(uTime * 1.4 + phase);
    pos.y += sin(uTime * 0.28 + pos.x * 0.008) * 0.5;
    vec4 mv = viewMatrix * modelMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aSize * (1000.0 / -mv.z);
    gl_PointSize = clamp(size * (0.85 + 0.15 * twinkle), 1.0, 140.0);
    vAlpha = aAlpha * twinkle;
  }
`

const mountainFrag = `
  precision mediump float;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float shape = smoothstep(0.5, 0.12, d);
    float a = vAlpha * shape;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`

const birdVert = `
  precision mediump float;
  uniform float uTime;
  attribute float aSize;
  varying float vDepth;
  void main() {
    vec3 pos = position;
    pos.y += sin(uTime * 3.0 + pos.x * 0.05) * 8.0;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vDepth = smoothstep(-2500.0, -500.0, mv.z);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (1000.0 / -mv.z);
  }
`

const birdFrag = `
  precision mediump float;
  uniform vec3 uColor;
  varying float vDepth;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float v = abs(uv.x * 1.5) + uv.y * 0.8;
    float shape = smoothstep(0.4, 0.05, abs(v - 0.1));
    if (shape < 0.01) discard;
    float a = shape * mix(0.25, 0.9, vDepth);
    gl_FragColor = vec4(uColor, a);
  }
`

// ──────────────────────────────────────────────────────────────
// TERRAIN MATH (CPU-side, builds particle positions once)
// ──────────────────────────────────────────────────────────────
const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t
const clamp = (x: number, a: number, b: number) =>
    Math.max(a, Math.min(b, x))
const smoothstep = (e0: number, e1: number, x: number) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)
}
const hash = (n: number) => {
    const s = Math.sin(n) * 43758.5453
    return s - Math.floor(s)
}
const noise2D = (x: number, z: number) => {
    const ix = Math.floor(x),
        iz = Math.floor(z)
    const fx = x - ix,
        fz = z - iz
    const ux = fx * fx * (3 - 2 * fx)
    return mix(
        mix(hash(ix + iz * 57), hash(ix + 1 + iz * 57), ux),
        mix(hash(ix + (iz + 1) * 57), hash(ix + 1 + (iz + 1) * 57), ux),
        fz
    )
}
const fbm = (x: number, z: number, oct = 4) => {
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
const ridge1D = (x: number) => {
    let n = fbm(x * 0.0014, 10, 5)
    let r = 1 - Math.abs(n - 0.5) * 2
    r = Math.pow(Math.max(0, r), 2.2)
    return r * smoothstep(0.2, 0.8, fbm(x * 0.0042, 200, 3))
}
const bandMask = (z: number, c: number, w: number) => {
    const d = Math.abs(z - c) / w
    return Math.pow(Math.max(0, 1 - d), 2)
}

const getTerrainData = (x: number, z: number) => {
    const near = bandMask(z, 180, 480)
    const far = bandMask(z, -620, 760)
    const sNear = ridge1D(x + 60) * 220
    const sFar = ridge1D(x - 380) * 380
    const texN = fbm(x * 0.003, z * 0.004, 4)
    const texR = Math.pow(Math.max(0, 1 - Math.abs(texN - 0.5) * 2), 2.6)
    let h = near * (sNear + texR * 120) + far * (sFar + texR * 110)
    h -= z * 0.22
    h -= 440
    return { h, ridge: texR, near, far }
}

// ──────────────────────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────────────────────
export default function AboutHero({
    eyebrow = "About",
    eyebrowZh = "关于",
    titleLine1 = "Product Designer.",
    titleLine2 = "& Creative Development.",
    subtitle = "Building at the intersection of humanities and creative engineering. Crafting digital experiences with an oriental aesthetic and modern precision.",
    nameZh = "徐 源",
    nameEn = "Xuyuan Liu · Cornell Information Science",
    brandCornerZh = "徐 源",
    brandCornerEn = "Xuyuan Liu · 刘栩源",
    sideText = "观 象 取 意",
    scrollHint = "向下滚动 / Scroll to read",
    loadingPhrase = "知 行 合 一",
    location = "Ithaca, NY",
    period = "2024 — Present",
    showBirds = true,
    showSideText = true,
    showBrandCorner = true,
    inkColor = "#2A2A2A",
}: Props) {
    const heroRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLDivElement>(null)
    const fillRef = useRef<HTMLDivElement>(null)
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    useEffect(() => {
        const heroEl = heroRef.current
        const containerEl = canvasRef.current
        if (!heroEl || !containerEl) return

        // Framer canvas: skip Three.js, show static state
        if (isCanvas) {
            heroEl.classList.add("ah-loaded")
            return
        }

        const isMobile = window.innerWidth <= 768
        const isLowEnd =
            isMobile &&
            (((navigator as any).deviceMemory &&
                (navigator as any).deviceMemory <= 2) ||
                (navigator.hardwareConcurrency &&
                    navigator.hardwareConcurrency <= 2))

        // ── Low-end / no-WebGL: SVG ink silhouette fallback
        if (isLowEnd || !window.WebGLRenderingContext) {
            heroEl.classList.add("ah-loaded")
            containerEl.innerHTML =
                '<svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" ' +
                'style="width:100%;height:100%;position:absolute;inset:0;opacity:0.55">' +
                '<defs><filter id="ah-blur"><feGaussianBlur stdDeviation="2.5"/></filter></defs>' +
                '<path d="M0,420 Q60,350 130,380 Q200,320 280,340 Q340,260 420,290 Q500,180 560,220 Q610,140 680,170 Q740,100 800,130 Q860,80 920,110 Q980,50 1040,80 Q1100,60 1200,90 L1200,600 L0,600 Z" fill="#2a2a2a" opacity="0.12" filter="url(#ah-blur)"/>' +
                '<path d="M0,480 Q80,430 160,450 Q260,390 360,420 Q440,360 520,380 Q600,320 680,350 Q760,300 840,330 Q920,270 1000,300 Q1100,260 1200,280 L1200,600 L0,600 Z" fill="#1a1a1a" opacity="0.18" filter="url(#ah-blur)"/>' +
                '<path d="M0,540 Q100,510 200,520 Q300,490 400,505 Q500,480 600,490 Q700,470 800,485 Q900,460 1000,475 Q1100,455 1200,465 L1200,600 L0,600 Z" fill="#111" opacity="0.25"/>' +
                "</svg>"
            return
        }

        // ── Three.js setup ──────────────────────────────────
        const scene = new THREE.Scene()
        scene.fog = new THREE.FogExp2(0xffffff, 0.00009)

        let w = heroEl.offsetWidth
        let h = heroEl.offsetHeight || 600
        const camera = new THREE.PerspectiveCamera(48, w / h, 1, 7000)
        camera.position.set(0, 220, 2500)
        camera.lookAt(0, -80, 0)

        const renderer = new THREE.WebGLRenderer({
            antialias: false,
            alpha: true,
            powerPreference: "high-performance",
        })
        renderer.setPixelRatio(
            Math.min(isMobile ? 0.75 : 1.5, window.devicePixelRatio || 1)
        )
        renderer.setSize(w, h)
        renderer.setClearColor(0xffffff, 0)
        containerEl.appendChild(renderer.domElement)

        const inkColorObj = new THREE.Color(inkColor)
        let mountainMat: THREE.ShaderMaterial | null = null
        let mountainMesh: THREE.Points | null = null
        let birdMesh: THREE.Points | null = null
        let birdGeo: THREE.BufferGeometry | null = null
        let bMatRef: THREE.ShaderMaterial | null = null
        let rafId = 0
        let cancelled = false
        const birdData: BirdDatum[] = []

        // Build particle field (yields between rows for loading bar)
        const build = async () => {
            const positions: number[] = []
            const sizes: number[] = []
            const alphas: number[] = []
            const extX = 2600,
                minZ = -900,
                maxZ = 700
            const cell = isMobile ? 26 : 14
            const density = isMobile ? 10 : 45
            const totalSteps = Math.floor((extX * 2) / cell)
            let lastYield = performance.now()

            for (let cx = -extX, step = 0; cx <= extX; cx += cell, step++) {
                if (cancelled) return
                for (let cz = minZ; cz <= maxZ; cz += cell) {
                    const tx = cx + cell / 2,
                        tz = cz + cell / 2
                    const t = getTerrainData(tx, tz)
                    if (t.h < -360) continue
                    const depth = smoothstep(minZ, maxZ, cz)
                    let prob = Math.pow(t.ridge, 3.0) * 1.8 + 0.15
                    prob *= mix(0.3, 1.25, depth)
                    const count = Math.min(
                        Math.floor(prob * density),
                        isMobile ? 5 : 20
                    )
                    for (let p = 0; p < count; p++) {
                        const px = cx + Math.random() * cell
                        const pz = cz + Math.random() * cell
                        positions.push(px, getTerrainData(px, pz).h, pz)
                        sizes.push(
                            mix(1.3, 3.8, depth) + Math.pow(t.ridge, 2) * 2
                        )
                        alphas.push(
                            clamp(
                                mix(0.08, 0.55, depth) * Math.min(prob, 1.2),
                                0.05,
                                1
                            )
                        )
                    }
                }
                if (performance.now() - lastYield > 24) {
                    const pct = Math.floor((step / totalSteps) * 100)
                    if (fillRef.current)
                        fillRef.current.style.width = pct + "%"
                    await new Promise((r) => setTimeout(r, 0))
                    lastYield = performance.now()
                }
            }
            if (cancelled) return

            const geo = new THREE.BufferGeometry()
            geo.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(positions, 3)
            )
            geo.setAttribute(
                "aSize",
                new THREE.Float32BufferAttribute(sizes, 1)
            )
            geo.setAttribute(
                "aAlpha",
                new THREE.Float32BufferAttribute(alphas, 1)
            )
            mountainMat = new THREE.ShaderMaterial({
                vertexShader: mountainVert,
                fragmentShader: mountainFrag,
                uniforms: {
                    uTime: { value: 0 },
                    uColor: { value: inkColorObj },
                },
                transparent: true,
                blending: THREE.NormalBlending,
                depthWrite: false,
            })
            mountainMesh = new THREE.Points(geo, mountainMat)
            scene.add(mountainMesh)

            // ── Birds (desktop only)
            const BIRDS = isMobile || !showBirds ? 0 : 12
            if (BIRDS > 0) {
                const bPos = new Float32Array(BIRDS * 3)
                const bSize = new Float32Array(BIRDS)
                const flockZ = -600 - Math.random() * 600
                const flockY = 260 + Math.random() * 140
                const flockSpeed = 0.9 + Math.random() * 0.3
                for (let b = 0; b < BIRDS; b++) {
                    bSize[b] = 12 + Math.random() * 8
                    birdData.push({
                        baseX: -2800 + b * (55 + Math.random() * 30),
                        baseY: flockY + (Math.random() - 0.5) * 50,
                        baseZ: flockZ + (Math.random() - 0.5) * 120,
                        speed: flockSpeed,
                    })
                }
                birdGeo = new THREE.BufferGeometry()
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
                bMatRef = new THREE.ShaderMaterial({
                    vertexShader: birdVert,
                    fragmentShader: birdFrag,
                    uniforms: {
                        uTime: { value: 0 },
                        uColor: { value: new THREE.Color(0x222222) },
                    },
                    transparent: true,
                    depthWrite: false,
                })
                birdMesh = new THREE.Points(birdGeo, bMatRef)
                birdMesh.renderOrder = 90
                scene.add(birdMesh)
            }

            heroEl.classList.add("ah-loaded")

            // ── Animate
            let lastT = performance.now()
            const frameInterval = isMobile ? 1000 / 30 : 0
            let lastFrame = 0
            const animate = (ts: number) => {
                rafId = requestAnimationFrame(animate)
                if (isMobile && ts - lastFrame < frameInterval) return
                lastFrame = ts
                const now = performance.now()
                const dt = Math.min(0.033, (now - lastT) / 1000)
                lastT = now
                const t = now * 0.001
                if (mountainMat) mountainMat.uniforms.uTime.value = t
                if (birdMesh && birdGeo && bMatRef) {
                    const arr = (
                        birdGeo.attributes.position as THREE.BufferAttribute
                    ).array as Float32Array
                    for (let i = 0; i < birdData.length; i++) {
                        const d = birdData[i],
                            i3 = i * 3
                        d.baseX += d.speed * dt * 60
                        if (d.baseX > 2600)
                            d.baseX = -3200 - Math.random() * 1200
                        arr[i3] = d.baseX
                        arr[i3 + 1] = d.baseY
                        arr[i3 + 2] = d.baseZ
                    }
                    birdGeo.attributes.position.needsUpdate = true
                    bMatRef.uniforms.uTime.value = t
                }
                renderer.render(scene, camera)
            }
            rafId = requestAnimationFrame(animate)
        }
        build()

        // ── Resize observer (scoped to hero, not window)
        const ro = new ResizeObserver(() => {
            w = heroEl.offsetWidth
            h = heroEl.offsetHeight || 600
            if (w <= 0 || h <= 0) return
            camera.aspect = w / h
            camera.updateProjectionMatrix()
            const mob = w <= 768
            renderer.setPixelRatio(
                Math.min(mob ? 1 : 1.5, window.devicePixelRatio || 1)
            )
            renderer.setSize(w, h)
        })
        ro.observe(heroEl)

        // ── Cleanup
        return () => {
            cancelled = true
            if (rafId) cancelAnimationFrame(rafId)
            ro.disconnect()
            if (mountainMesh) {
                scene.remove(mountainMesh)
                mountainMesh.geometry.dispose()
            }
            if (mountainMat) mountainMat.dispose()
            if (birdMesh) {
                scene.remove(birdMesh)
            }
            if (birdGeo) birdGeo.dispose()
            if (bMatRef) bMatRef.dispose()
            renderer.dispose()
            if (renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(
                    renderer.domElement
                )
            }
        }
    }, [isCanvas, showBirds, inkColor])

    return (
        <>
            <style>{styles}</style>
            <section ref={heroRef} className="ah-hero">
                <div ref={canvasRef} className="ah-canvas" />

                <div className="ah-loading">
                    <div className="ah-tip-zh">{loadingPhrase}</div>
                    <div className="ah-tip-bar">
                        <div ref={fillRef} className="ah-tip-fill" />
                    </div>
                </div>

                <div className="ah-ui">
                    {/* Top row */}
                    <div className="ah-top-row">
                        <p className="ah-eyebrow">
                            {eyebrow}
                            {eyebrowZh && (
                                <span className="ah-eyebrow-zh">
                                    {eyebrowZh}
                                </span>
                            )}
                        </p>
                        {showBrandCorner && (
                            <div className="ah-brand-corner">
                                <strong>{brandCornerZh}</strong>
                                {brandCornerEn}
                            </div>
                        )}
                    </div>

                    {/* Center: title */}
                    <div className="ah-content">
                        <h1
                            className="ah-title"
                            aria-label={`${titleLine1} ${titleLine2}`}
                        >
                            <span className="ah-line">{titleLine1}</span>
                            <span className="ah-line">{titleLine2}</span>
                        </h1>
                        {subtitle && <p className="ah-sub">{subtitle}</p>}
                        <div className="ah-name">
                            {nameZh && (
                                <span className="ah-name-zh">{nameZh}</span>
                            )}
                            {nameZh && nameEn && (
                                <span className="ah-name-divider" />
                            )}
                            {nameEn && (
                                <span className="ah-name-en">{nameEn}</span>
                            )}
                        </div>
                    </div>

                    {/* Vertical right text */}
                    {showSideText && sideText && (
                        <div className="ah-side-text">{sideText}</div>
                    )}

                    {/* Bottom row */}
                    <div className="ah-bottom-row">
                        <div className="ah-hint">{scrollHint}</div>
                        <div className="ah-meta">
                            {location}
                            {location && period && <br />}
                            {period}
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}

// ──────────────────────────────────────────────────────────────
// STYLES
// ──────────────────────────────────────────────────────────────
const styles = `
.ah-hero {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 620px;
  overflow: hidden;
  background: #ffffff;
  isolation: isolate;
  font-family: 'Murecho', 'Inter', system-ui, sans-serif;
}
.ah-canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 0;
  transition: opacity 1.4s ease-in;
  pointer-events: none;
}
.ah-canvas canvas { display: block; }

.ah-loading {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  z-index: 5;
  display: flex; flex-direction: column;
  align-items: center; gap: 14px;
  user-select: none;
  transition: opacity 0.6s ease-out;
  pointer-events: none;
}
.ah-tip-zh {
  font-family: 'Cormorant Garamond','ZCOOL XiaoWei','Noto Serif SC','Songti SC',Georgia,serif;
  font-size: 13px;
  letter-spacing: 0.5em;
  color: #333;
}
.ah-tip-bar {
  width: 160px; height: 1px;
  background: #eee;
  overflow: hidden;
  position: relative;
}
.ah-tip-fill {
  position: absolute; left: 0; top: 0;
  width: 0%; height: 100%;
  background: #111;
}
.ah-hero.ah-loaded .ah-loading { opacity: 0; }
.ah-hero.ah-loaded .ah-canvas  { opacity: 1; }

.ah-ui {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: clamp(56px, 9vh, 96px) clamp(24px, 6vw, 72px);
  display: grid;
  grid-template-rows: auto 1fr auto;
  pointer-events: none;
}

.ah-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.ah-eyebrow {
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #888;
  display: flex; align-items: center; gap: 12px;
  margin: 0;
}
.ah-eyebrow::before {
  content: '';
  width: 28px; height: 1px; background: #888; opacity: 0.5;
}
.ah-eyebrow-zh {
  font-family: 'Cormorant Garamond','ZCOOL XiaoWei','Noto Serif SC','Songti SC',Georgia,serif;
  font-size: 13px;
  letter-spacing: 0.3em;
  color: #444;
  text-transform: none;
}
.ah-brand-corner {
  text-align: right;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #999;
  line-height: 1.7;
}
.ah-brand-corner strong {
  display: block;
  font-family: 'Cormorant Garamond','ZCOOL XiaoWei','Noto Serif SC','Songti SC',Georgia,serif;
  font-size: 20px;
  letter-spacing: 0.35em;
  color: #222;
  font-weight: 500;
  text-transform: none;
  margin-bottom: 6px;
}

.ah-content {
  align-self: center;
  max-width: 760px;
  pointer-events: none;
}
.ah-title {
  font-family: 'Cormorant Garamond','ZCOOL XiaoWei','Noto Serif SC','Songti SC',Georgia,serif;
  font-weight: 400;
  font-size: clamp(46px, 6.4vw, 94px);
  line-height: 1.02;
  letter-spacing: -0.005em;
  color: #111;
  margin: 0 0 28px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ah-line {
  display: block;
  opacity: 0;
  transform: translate3d(0, 14px, 0);
  filter: blur(3px);
  animation: ahLineIn 1.15s cubic-bezier(.2,.9,.2,1) forwards;
}
.ah-line:nth-child(1) { animation-delay: 0.25s; }
.ah-line:nth-child(2) {
  animation-delay: 0.6s;
  font-style: italic;
  color: #2a2a2a;
}
@keyframes ahLineIn {
  0%   { opacity: 0; transform: translate3d(0,14px,0); filter: blur(3px); }
  70%  { opacity: 0.95; filter: blur(0); }
  100% { opacity: 1; transform: translate3d(0,0,0); filter: blur(0); }
}
.ah-sub {
  font-size: 13.5px;
  line-height: 1.85;
  letter-spacing: 0.02em;
  color: #666;
  max-width: 500px;
  margin: 0 0 40px 0;
  font-weight: 300;
  opacity: 0;
  animation: ahLineIn 1.2s cubic-bezier(.2,.9,.2,1) 1s forwards;
}
.ah-name {
  display: inline-flex;
  align-items: center;
  gap: 16px;
  opacity: 0;
  animation: ahLineIn 1.2s cubic-bezier(.2,.9,.2,1) 1.2s forwards;
}
.ah-name-zh {
  font-family: 'Cormorant Garamond','ZCOOL XiaoWei','Noto Serif SC','Songti SC',Georgia,serif;
  font-size: 22px;
  letter-spacing: 0.2em;
  color: #111;
  font-weight: 500;
}
.ah-name-divider {
  width: 32px;
  height: 1px;
  background: #888;
}
.ah-name-en {
  font-size: 10px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #666;
}

.ah-side-text {
  position: absolute;
  top: 50%; right: clamp(16px, 3vw, 42px);
  transform: translateY(-50%);
  writing-mode: vertical-rl;
  font-family: 'Cormorant Garamond','ZCOOL XiaoWei','Noto Serif SC','Songti SC',Georgia,serif;
  font-size: 14px;
  letter-spacing: 1.2em;
  color: #333;
  opacity: 0;
  animation: ahLineIn 1.3s cubic-bezier(.2,.9,.2,1) 1.4s forwards;
  pointer-events: none;
  z-index: 11;
}

.ah-bottom-row {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 24px;
}
.ah-hint {
  font-size: 10px;
  letter-spacing: 0.22em;
  color: #888;
  display: flex; align-items: center; gap: 12px;
  text-transform: uppercase;
  opacity: 0;
  animation: ahLineIn 1.2s cubic-bezier(.2,.9,.2,1) 1.6s forwards;
}
.ah-hint::after {
  content: '';
  width: 40px; height: 1px;
  background: #888;
  opacity: 0.5;
}
.ah-meta {
  font-size: 10px;
  letter-spacing: 0.2em;
  color: #999;
  text-transform: uppercase;
  text-align: right;
  line-height: 1.8;
  opacity: 0;
  animation: ahLineIn 1.2s cubic-bezier(.2,.9,.2,1) 1.7s forwards;
}

@media (max-width: 780px) {
  .ah-hero { min-height: 92vh; }
  .ah-side-text { display: none; }
  .ah-brand-corner { display: none; }
  .ah-meta { display: none; }
  .ah-title { font-size: clamp(40px, 11vw, 64px); }
  .ah-ui { padding: 72px 24px 40px; }
}

@media (prefers-reduced-motion: reduce) {
  .ah-line, .ah-sub, .ah-name, .ah-side-text, .ah-hint, .ah-meta {
    animation: none; opacity: 1; transform: none; filter: none;
  }
}
`

// ──────────────────────────────────────────────────────────────
// FRAMER PROPERTY CONTROLS
// ──────────────────────────────────────────────────────────────
addPropertyControls(AboutHero, {
    eyebrow: {
        type: ControlType.String,
        title: "Eyebrow",
        defaultValue: "About",
    },
    eyebrowZh: {
        type: ControlType.String,
        title: "Eyebrow (中文)",
        defaultValue: "关于",
    },
    titleLine1: {
        type: ControlType.String,
        title: "Title — Line 1",
        defaultValue: "Product Designer.",
    },
    titleLine2: {
        type: ControlType.String,
        title: "Title — Line 2",
        defaultValue: "& Creative Development.",
    },
    subtitle: {
        type: ControlType.String,
        title: "Subtitle",
        defaultValue:
            "Building at the intersection of humanities and creative engineering. Crafting digital experiences with an oriental aesthetic and modern precision.",
        displayTextArea: true,
    },
    nameZh: {
        type: ControlType.String,
        title: "Name (中文)",
        defaultValue: "徐 源",
    },
    nameEn: {
        type: ControlType.String,
        title: "Name (EN)",
        defaultValue: "Xuyuan Liu · Cornell Information Science",
    },
    showBrandCorner: {
        type: ControlType.Boolean,
        title: "Brand Corner",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },
    brandCornerZh: {
        type: ControlType.String,
        title: "Brand — 中文",
        defaultValue: "徐 源",
        hidden: (props: Props) => !props.showBrandCorner,
    },
    brandCornerEn: {
        type: ControlType.String,
        title: "Brand — EN",
        defaultValue: "Xuyuan Liu · 刘栩源",
        hidden: (props: Props) => !props.showBrandCorner,
    },
    showSideText: {
        type: ControlType.Boolean,
        title: "Side Text",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },
    sideText: {
        type: ControlType.String,
        title: "Side (vertical)",
        defaultValue: "观 象 取 意",
        hidden: (props: Props) => !props.showSideText,
    },
    scrollHint: {
        type: ControlType.String,
        title: "Scroll Hint",
        defaultValue: "向下滚动 / Scroll to read",
    },
    loadingPhrase: {
        type: ControlType.String,
        title: "Loading Phrase",
        defaultValue: "知 行 合 一",
    },
    location: {
        type: ControlType.String,
        title: "Location",
        defaultValue: "Ithaca, NY",
    },
    period: {
        type: ControlType.String,
        title: "Period",
        defaultValue: "2024 — Present",
    },
    showBirds: {
        type: ControlType.Boolean,
        title: "Birds",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    inkColor: {
        type: ControlType.Color,
        title: "Ink Color",
        defaultValue: "#2A2A2A",
    },
})
