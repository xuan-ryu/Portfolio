import * as React from "react"
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from "react"
import { motion, useReducedMotion } from "framer-motion"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

type BlurSnapshot = {
    filter?: string
    opacity?: number
    x?: number
    y?: number
    scale?: number
}

type BlurTextProps = {
    text?: string
    delay?: number
    className?: string
    animateBy?: "characters" | "words"
    direction?: "top" | "bottom"
    threshold?: number
    rootMargin?: string
    animationFrom?: BlurSnapshot
    animationTo?: BlurSnapshot[]
    easing?: number[] | "easeOut" | "easeIn" | "easeInOut" | "linear"
    onAnimationComplete?: () => void
    stepDuration?: number
    as?: keyof React.JSX.IntrinsicElements
    style?: CSSProperties
}

function buildKeyframes(from: BlurSnapshot, steps: BlurSnapshot[]) {
    const keys = new Set<keyof BlurSnapshot>([
        ...Object.keys(from),
        ...steps.flatMap((step) => Object.keys(step)),
    ] as (keyof BlurSnapshot)[])

    const keyframes: Record<string, Array<string | number | undefined>> = {}

    keys.forEach((key) => {
        keyframes[key] = [from[key], ...steps.map((step) => step[key])]
    })

    return keyframes
}

export default function BlurText({
    text = "Blur Text",
    delay = 70,
    className = "",
    animateBy = "characters",
    direction = "top",
    threshold = 0.1,
    rootMargin = "0px",
    animationFrom,
    animationTo,
    easing = [0.22, 1, 0.36, 1],
    onAnimationComplete,
    stepDuration = 0.18,
    as = "p",
    style,
}: BlurTextProps) {
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const [inView, setInView] = useState(isCanvas)
    const ref = useRef<HTMLElement | null>(null)
    const hasCompletedRef = useRef(false)
    const prefersReducedMotion = useReducedMotion()

    useEffect(() => {
        hasCompletedRef.current = false
    }, [text, animateBy, onAnimationComplete])

    useEffect(() => {
        const node = ref.current
        if (!node) return

        if (isCanvas) {
            setInView(true)
            return
        }

        if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
            setInView(true)
            return
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return
                setInView(true)
                observer.unobserve(node)
            },
            { threshold, rootMargin }
        )

        observer.observe(node)

        return () => observer.disconnect()
    }, [isCanvas, threshold, rootMargin])

    const segments = useMemo(() => {
        if (!text) return []
        return animateBy === "words" ? text.split(" ") : Array.from(text)
    }, [animateBy, text])

    const defaultFrom = useMemo<BlurSnapshot>(() => {
        if (direction === "bottom") {
            return { filter: "blur(10px)", opacity: 0, y: 32 }
        }

        return { filter: "blur(10px)", opacity: 0, y: -32 }
    }, [direction])

    const defaultTo = useMemo<BlurSnapshot[]>(() => {
        const overshoot = direction === "bottom" ? -4 : 4
        return [
            { filter: "blur(5px)", opacity: 0.5, y: overshoot },
            { filter: "blur(0px)", opacity: 1, y: 0 },
        ]
    }, [direction])

    const fromSnapshot = animationFrom ?? defaultFrom
    const toSnapshots = animationTo ?? defaultTo

    const animateKeyframes = useMemo(
        () => buildKeyframes(fromSnapshot, toSnapshots),
        [fromSnapshot, toSnapshots]
    )

    const stepCount = toSnapshots.length + 1
    const totalDuration = prefersReducedMotion
        ? 0
        : stepDuration * Math.max(stepCount - 1, 0)
    const times = useMemo(
        () =>
            Array.from({ length: stepCount }, (_, i) =>
                stepCount <= 1 ? 0 : i / (stepCount - 1)
            ),
        [stepCount]
    )

    const handleLastAnimationComplete = () => {
        if (hasCompletedRef.current) return
        hasCompletedRef.current = true
        onAnimationComplete?.()
    }

    const Component = as as keyof React.JSX.IntrinsicElements

    return React.createElement(
        Component,
        {
            ref,
            className,
            style: {
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-start",
                width: "100%",
                ...style,
            },
        },
        segments.map((segment, index) => {
            const isWhitespace = segment === " "
            const isLast = index === segments.length - 1

            return (
                <motion.span
                    key={`${segment}-${index}`}
                    initial={fromSnapshot}
                    animate={inView ? animateKeyframes : fromSnapshot}
                    transition={{
                        duration: totalDuration,
                        times,
                        delay: prefersReducedMotion ? 0 : (index * delay) / 1000,
                        ease: easing,
                    }}
                    onAnimationComplete={
                        isLast ? handleLastAnimationComplete : undefined
                    }
                    style={{
                        display: "inline-block",
                        whiteSpace: "pre",
                        willChange: "transform, filter, opacity",
                    }}
                >
                    {animateBy === "words"
                        ? `${segment}${index < segments.length - 1 ? "\u00A0" : ""}`
                        : isWhitespace
                          ? "\u00A0"
                          : segment}
                </motion.span>
            )
        })
    )
}

BlurText.defaultProps = {
    text: "Blur Text",
    delay: 70,
    animateBy: "characters",
    direction: "top",
    threshold: 0.1,
    rootMargin: "0px",
    stepDuration: 0.18,
}

addPropertyControls(BlurText, {
    text: {
        type: ControlType.String,
        title: "Text",
        displayTextArea: true,
    },
    delay: {
        type: ControlType.Number,
        title: "Delay",
        min: 0,
        max: 400,
        step: 10,
        unit: "ms",
    },
    animateBy: {
        type: ControlType.Enum,
        title: "Animate",
        options: ["characters", "words"],
        optionTitles: ["Characters", "Words"],
    },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["top", "bottom"],
        optionTitles: ["Top", "Bottom"],
    },
    stepDuration: {
        type: ControlType.Number,
        title: "Step",
        min: 0.05,
        max: 1,
        step: 0.01,
        unit: "s",
    },
    threshold: {
        type: ControlType.Number,
        title: "Threshold",
        min: 0,
        max: 1,
        step: 0.05,
    },
})
