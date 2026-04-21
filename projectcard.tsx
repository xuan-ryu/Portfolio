import * as React from "react"
import { useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

// Edit 7: 瀛椾綋鍗曚緥娉ㄥ叆锛岄伩鍏嶆瘡娆?render 閲嶅瑙﹀彂 @import
if (typeof document !== "undefined" && !document.getElementById("pc-fonts")) {
    const link = document.createElement("link")
    link.id = "pc-fonts"
    link.rel = "stylesheet"
    link.href =
        "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Murecho:wght@200;300;400&display=swap"
    document.head.appendChild(link)
}

type Props = {
    title: string
    category: string
    year: string
    coverImage: string
    videoUrl?: string
    description: string
}

export default function ProjectCard(props: Props) {
    const { title, category, year, coverImage, videoUrl, description } = props
    const videoRef = useRef<HTMLVideoElement>(null)

    const microTypeStyle: React.CSSProperties = {
        fontFamily: "'Murecho', sans-serif",
        fontSize: "clamp(9px, 0.75vw, 11px)",
        fontWeight: 300,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        lineHeight: 1,
    }

    // 妫€娴嬬紪杈戝櫒鐜
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    // Edit 2: prefers-reduced-motion 妫€娴?
    const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches

    // Edit 3: 瑙︽懜璁惧妫€娴?
    const isTouchDevice =
        typeof window !== "undefined" &&
        ("ontouchstart" in window || navigator.maxTouchPoints > 0)

    // Edit 5: 楂樻€ц兘璁惧妫€娴嬶紙touch 璁惧涓?鈮? 鏍镐篃鍚敤 blur锛?
    const hwCores =
        typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4
    const useBackdropBlur = !isTouchDevice || hwCores >= 8

    const handleMouseEnter = useCallback(() => {
        if (videoRef.current) {
            videoRef.current.play().catch(() => {})
        }
    }, [])

    const handleMouseLeave = useCallback(() => {
        if (videoRef.current) {
            videoRef.current.pause()
        }
    }, [])


    // 缃戞牸绾挎潯鍔ㄧ敾 variants
    const lineVariants = {
        rest: { backgroundColor: "rgba(255,255,255,0.12)" },
        hover: { backgroundColor: "rgba(255,255,255,0.20)" },
    }

    const animDuration = prefersReducedMotion ? 0 : 0.8
    const fastDuration = prefersReducedMotion ? 0 : 0.4
    const enterDuration = prefersReducedMotion ? 0 : 0.9

    return (
        <>
            <style>
                {`
                    /* 涓ヨ皑鐨?2 琛屾埅鏂?*/
                    .gallery-desc {
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    /* 璐濆紡鑷€傚簲寤虹瓚缃戞牸 (The Responsive Grid) */
                    .card-bottom-area {
                        display: flex;
                        flex-direction: column;
                        width: 100%;
                        flex-shrink: 0;
                        flex-grow: 1;
                    }

                    .card-meta-area {
                        display: flex;
                        flex-direction: row;
                        justify-content: space-between;
                        align-items: center;
                        width: 100%;
                        padding: clamp(12px, 1.8vw, 24px) clamp(16px, 2.5vw, 32px);
                    }

                    .meta-text-group {
                        display: flex;
                        flex-direction: row;
                        gap: 20px;
                    }

                    .divider-dynamic {
                        width: 100%;
                        height: 1px;
                    }

                    /* 妗岄潰绔柇鐐?(> 810px) */
                    @media (min-width: 810px) {
                        .card-bottom-area {
                            flex-direction: row;
                        }
                        .card-meta-area {
                            width: 160px;
                            flex-direction: column;
                            padding: clamp(16px, 2.5vw, 32px) clamp(12px, 1.8vw, 24px);
                            flex-shrink: 0;
                        }
                        .meta-text-group {
                            flex-direction: column;
                            gap: 12px;
                        }
                        .divider-dynamic {
                            width: 1px;
                            height: auto;
                        }
                    }
                `}
            </style>

            {/* Edit 1: 澶栧眰璐熻矗杩涘満鍔ㄧ敾锛屽唴灞傝礋璐?hover 浜や簰锛屾秷闄ゅ弻閲?initial 鍐茬獊 */}
            <motion.div
                initial={isCanvas ? false : { opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: enterDuration, ease: [0.22, 1, 0.36, 1] }}
                style={{
                    width: "100%",
                    // Edit 6: will-change 鎻愮ず鍚堟垚灞?
                    willChange: prefersReducedMotion ? "auto" : "opacity, transform",
                }}
            >
                <motion.div
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    whileHover="hover"
                    initial="rest"
                    animate="rest"
                    variants={{
                        rest: {
                            y: 0,
                            borderColor: "rgba(255,255,255,0.12)",
                            backgroundColor: "rgba(28,28,30,0.65)",
                            boxShadow: "0px 8px 24px rgba(0,0,0,0.35)",
                        },
                        hover: {
                            y: prefersReducedMotion ? 0 : -8,
                            borderColor: "rgba(255,255,255,0.22)",
                            backgroundColor: "rgba(44,44,46,0.85)",
                            boxShadow: "0px 20px 48px rgba(0,0,0,0.55)",
                        },
                    }}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        textDecoration: "none",
                        cursor: isTouchDevice ? "default" : "pointer",
                        borderRadius: "0px",
                        borderWidth: "1px",
                        borderStyle: "solid",
                        // Edit 5: 绉诲姩绔檷绾?backdropFilter
                        backdropFilter: useBackdropBlur ? "blur(16px)" : "none",
                        overflow: "hidden",
                        // Edit 6: will-change for hover transform
                        willChange: prefersReducedMotion ? "auto" : "transform",
                    }}
                >
                    {/* 1. 濯掍綋褰卞儚鍖?*/}
                    <div
                        style={{
                            width: "100%",
                            aspectRatio: "16/10",
                            overflow: "hidden",
                            backgroundColor: "#050505",
                            position: "relative",
                            flexShrink: 0,
                        }}
                    >
                        <motion.div
                            variants={{
                                rest: {
                                    scale: 1.0,
                                    filter: "grayscale(55%) brightness(0.72) contrast(1.05)",
                                },
                                hover: {
                                    scale: prefersReducedMotion ? 1.0 : 1.04,
                                    filter: "grayscale(0%) brightness(1.0) contrast(1.0)",
                                },
                            }}
                            transition={{ duration: animDuration, ease: [0.22, 1, 0.36, 1] }}
                            style={{
                                width: "100%",
                                height: "100%",
                                position: "absolute",
                                inset: 0,
                                // Edit 6: will-change for scale+filter
                                willChange: prefersReducedMotion
                                    ? "auto"
                                    : "transform, filter",
                            }}
                        >
                            {videoUrl ? (
                                <video
                                    ref={videoRef}
                                    src={videoUrl}
                                    poster={coverImage}
                                    muted
                                    loop
                                    playsInline
                                    autoPlay={isTouchDevice}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        display: "block",
                                    }}
                                />
                            ) : (
                                // Edit 4: lazy loading + async decoding
                                <img
                                    src={coverImage}
                                    alt={title}
                                    loading="lazy"
                                    decoding="async"
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        display: "block",
                                    }}
                                />
                            )}
                        </motion.div>
                        {/* hover 娣卞害娓愬彉 鈥?搴曢儴鏆楄 */}
                        <motion.div
                            variants={{
                                rest: { opacity: 0 },
                                hover: { opacity: 1 },
                            }}
                            transition={{ duration: animDuration, ease: [0.22, 1, 0.36, 1] }}
                            style={{
                                position: "absolute",
                                inset: 0,
                                background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 55%)",
                                zIndex: 2,
                                pointerEvents: "none",
                            }}
                        />
                        {/* 瑙︽懜璁惧锛氶€忔槑鎷︽埅灞傞樆姝㈠浘鐗囧尯璇Е瀵艰埅 */}
                        {isTouchDevice && (
                            <div
                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault() }}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    zIndex: 10,
                                    cursor: "default",
                                }}
                            />
                        )}
                    </div>

                    {/* 璐┛鍏ㄥ鐨勬按骞冲垎鍓茬嚎 */}
                    <motion.div
                        variants={lineVariants}
                        transition={{ duration: fastDuration }}
                        style={{ width: "100%", height: "1px" }}
                    />

                    {/* 2. 搴曢儴缃戞牸鎺掔増鍖?鈥?瑙︽懜璁惧鐨勫疄闄呯偣鍑诲尯 */}
                    <div className="card-bottom-area" style={{ cursor: "pointer" }}>
                        {/* 宸︿晶锛氫汉鏂囨劅琛ㄨ揪 (鏍囬 + 鎻忚堪) */}
                        <div
                            style={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                gap: "clamp(8px, 1.2vw, 16px)",
                                padding: "clamp(16px, 2.5vw, 32px)",
                            }}
                        >
                            {/* Eyebrow 鈥?category badge */}
                            <motion.div
                                variants={{
                                    rest: { borderColor: "rgba(255,255,255,0.14)", color: "rgba(235,235,245,0.55)" },
                                    hover: { borderColor: "rgba(255,255,255,0.26)", color: "rgba(235,235,245,0.82)" },
                                }}
                                transition={{ duration: fastDuration }}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    alignSelf: "flex-start",
                                    height: "26px",
                                    padding: "0 10px",
                                    borderRadius: "4px",
                                    border: "1px solid",
                                    boxSizing: "border-box",
                                    ...microTypeStyle,
                                }}
                            >
                                {category}
                            </motion.div>

                            <motion.h3
                                variants={{
                                    rest: { color: "#f5f5f7" },
                                    hover: { color: "#ffffff" },
                                }}
                                transition={{ duration: fastDuration }}
                                style={{
                                    margin: 0,
                                    fontFamily: "'EB Garamond', serif",
                                    fontSize: "clamp(16px, 2.5vw, 36px)",
                                    fontWeight: 400,
                                    letterSpacing: "0.02em",
                                    lineHeight: 1.1,
                                }}
                            >
                                {title}
                            </motion.h3>
                            {description && (
                                <motion.p
                                    className="gallery-desc"
                                    variants={{
                                        rest: { color: "rgba(235,235,245,0.60)" },
                                        hover: { color: "rgba(235,235,245,0.80)" },
                                    }}
                                    transition={{ duration: fastDuration }}
                                    style={{
                                        margin: 0,
                                        fontFamily: "'Murecho', sans-serif",
                                        fontSize: "clamp(11px, 1.1vw, 14px)",
                                        fontWeight: 300,
                                        lineHeight: 1.7,
                                        letterSpacing: "0.03em",
                                    }}
                                >
                                    {description}
                                </motion.p>
                            )}
                        </div>

                        {/* 鍔ㄦ€佸垎鍓茬嚎 */}
                        <motion.div
                            className="divider-dynamic"
                            variants={lineVariants}
                            transition={{ duration: fastDuration }}
                        />

                        {/* 鍙充晶锛氱悊鎬х殑鏁版嵁涓庝氦浜掑尯 */}
                        <div className="card-meta-area">
                            <div className="meta-text-group">
                                <span
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        minHeight: "26px",
                                        color: "rgba(235,235,245,0.38)",
                                        ...microTypeStyle,
                                    }}
                                >
                                    {year}
                                </span>
                            </div>

                            {/* CTA 鈥?Apple 灞曞紑 Pill */}
                            <motion.div
                                variants={{
                                    rest: {
                                        paddingLeft: "10px",
                                        paddingRight: "10px",
                                        borderColor: "rgba(255,255,255,0.18)",
                                        backgroundColor: "rgba(255,255,255,0)",
                                    },
                                    hover: {
                                        paddingLeft: "16px",
                                        paddingRight: "16px",
                                        borderColor: "rgba(255,255,255,0.30)",
                                        backgroundColor: "rgba(255,255,255,0.08)",
                                    },
                                }}
                                transition={{ duration: fastDuration, ease: [0.22, 1, 0.36, 1] }}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    height: "34px",
                                    minWidth: "34px",
                                    borderRadius: "100px",
                                    border: "1px solid",
                                    overflow: "hidden",
                                    flexShrink: 0,
                                    boxSizing: "border-box",
                                }}
                            >
                                {/* "VIEW" 鏂囧瓧 鈥?hover 鏃跺睍寮€锛宼ouch 璁惧濮嬬粓鍙 */}
                                <motion.span
                                    variants={{
                                        rest: {
                                            maxWidth: isTouchDevice ? "56px" : 0,
                                            opacity: isTouchDevice ? 1 : 0,
                                            marginRight: isTouchDevice ? "6px" : "0px",
                                        },
                                        hover: {
                                            maxWidth: "56px",
                                            opacity: 1,
                                            marginRight: "6px",
                                        },
                                    }}
                                    transition={{ duration: prefersReducedMotion ? 0 : fastDuration, ease: [0.22, 1, 0.36, 1] }}
                                    style={{
                                        overflow: "hidden",
                                        whiteSpace: "nowrap",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "rgba(235,235,245,0.75)",
                                        ...microTypeStyle,
                                    }}
                                >
                                    VIEW
                                </motion.span>
                                {/* 绠ご */}
                                <motion.span
                                    variants={{
                                        rest: { x: 0, color: "rgba(235,235,245,0.48)" },
                                        hover: { x: prefersReducedMotion ? 0 : 3, color: "rgba(255,255,255,1.0)" },
                                    }}
                                    transition={{ duration: fastDuration, ease: [0.22, 1, 0.36, 1] }}
                                    style={{
                                        width: "14px",
                                        height: "14px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 12 12"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                        aria-hidden="true"
                                    >
                                        <path
                                            d="M2 6H10M10 6L6.5 2.5M10 6L6.5 9.5"
                                            stroke="currentColor"
                                            strokeWidth="1"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </motion.span>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </>
    )
}

ProjectCard.defaultProps = {
    title: "Digital Orientalism",
    category: "UX / DEV",
    year: "2026",
    coverImage:
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop",
    videoUrl: "",
    description:
        "Bridging the gap between poetic eastern aesthetics and rigorous technical implementation. Exploring boundaries.",
}

addPropertyControls(ProjectCard, {
    title: { type: ControlType.String, title: "Title" },
    category: { type: ControlType.String, title: "Category" },
    year: { type: ControlType.String, title: "Year" },
    description: {
        type: ControlType.String,
        title: "Description",
        displayTextArea: true,
    },
    coverImage: { type: ControlType.Image, title: "Cover Image" },
    videoUrl: {
        type: ControlType.File,
        title: "Video (Opt)",
        allowedFileTypes: ["mp4", "webm"],
    },
})
