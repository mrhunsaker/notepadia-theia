/**
 * Synchronised scrolling math for split view (C3 step 4). Pure and
 * dependency-free so the mapping rules are unit-testable; the event wiring
 * lives in notepadia-sync-scroll.ts.
 *
 * Two editors showing the same document scroll identically, but two editors
 * showing *different* documents cannot: the same document offset means
 * something different in each. Notepad++ therefore mirrors by percentage of
 * scrollable height, so the top of one document lines up with the top of the
 * other and the bottom with the bottom.
 */

/** Smallest scrollable height we treat as real. Below this, mapping is degenerate. */
const MIN_SCROLLABLE_HEIGHT = 1;

/**
 * Clamp a value into a range, tolerating an inverted range (which happens
 * momentarily while a pane is resizing) by collapsing it to the minimum.
 */
export function clamp(value: number, min: number, max: number): number {
    if (max < min) {
        return min;
    }
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
}

/** How far a scroll can travel in a pane of the given total height. */
export function scrollableHeight(totalHeight: number, viewportHeight: number): number {
    return Math.max(0, totalHeight - viewportHeight);
}

/**
 * Mirror a source scroll position onto a target pane by percentage of scroll
 * range, then clamp the result to what the target can actually reach.
 *
 * When both panes have the same scrollable height this is the identity for any
 * in-range offset, so synchronised scrolling of one document stays exact
 * rather than drifting through rounding.
 */
export function mirrorScrollTop(params: {
    sourceScrollTop: number;
    sourceTotalHeight: number;
    sourceViewportHeight: number;
    targetTotalHeight: number;
    targetViewportHeight: number;
}): number {
    const sourceRange = scrollableHeight(params.sourceTotalHeight, params.sourceViewportHeight);
    const targetRange = scrollableHeight(params.targetTotalHeight, params.targetViewportHeight);
    if (sourceRange < MIN_SCROLLABLE_HEIGHT) {
        return 0;
    }
    if (targetRange < MIN_SCROLLABLE_HEIGHT) {
        return 0;
    }
    if (sourceRange === targetRange) {
        return clamp(params.sourceScrollTop, 0, targetRange);
    }
    const ratio = clamp(params.sourceScrollTop, 0, sourceRange) / sourceRange;
    return clamp(Math.round(ratio * targetRange), 0, targetRange);
}

/**
 * The same mapping for the horizontal axis, which matters for documents with
 * no wrapping (Notepad++ files) where the horizontal extent differs per line.
 */
export function mirrorScrollLeft(params: {
    sourceScrollLeft: number;
    sourceScrollWidth: number;
    sourceViewportWidth: number;
    targetScrollWidth: number;
    targetViewportWidth: number;
}): number {
    const sourceRange = scrollableHeight(params.sourceScrollWidth, params.sourceViewportWidth);
    const targetRange = scrollableHeight(params.targetScrollWidth, params.targetViewportWidth);
    if (sourceRange < MIN_SCROLLABLE_HEIGHT) {
        return 0;
    }
    if (targetRange < MIN_SCROLLABLE_HEIGHT) {
        return 0;
    }
    if (sourceRange === targetRange) {
        return clamp(params.sourceScrollLeft, 0, targetRange);
    }
    const ratio = clamp(params.sourceScrollLeft, 0, sourceRange) / sourceRange;
    return clamp(Math.round(ratio * targetRange), 0, targetRange);
}

/**
 * Whether a scroll event is worth acting on.
 *
 * Scrolling one pane moves the other, which raises a scroll event of its own.
 * Without a guard that second event would be mirrored straight back and the two
 * panes would oscillate forever. The live wiring guards on identity, but this
 * helper also drops sub-pixel movement, which keeps a browser's fractional
 * scroll chatter from causing needless writes.
 *
 * Offsets are rounded to whole pixels before comparison because browsers report
 * them as fractional values, so strict equality would report a difference every
 * time even when the panes are visually aligned.
 */
export function shouldMirrorScroll(params: {
    targetScrollTop: number;
    mirroredScrollTop: number;
}): boolean {
    return Math.round(params.targetScrollTop) !== Math.round(params.mirroredScrollTop);
}

/**
 * Compute the full mirror decision for one axis and report whether it should be
 * applied. Returns the target offset to write, which is the current target
 * offset when no update is needed, so callers can use it unconditionally.
 */
export function resolveMirrorTop(params: {
    enabled: boolean;
    sourceScrollTop: number;
    targetScrollTop: number;
    sourceTotalHeight: number;
    sourceViewportHeight: number;
    targetTotalHeight: number;
    targetViewportHeight: number;
}): { scrollTop: number; apply: boolean } {
    if (!params.enabled) {
        return { scrollTop: params.targetScrollTop, apply: false };
    }
    const mirrored = mirrorScrollTop({
        sourceScrollTop: params.sourceScrollTop,
        sourceTotalHeight: params.sourceTotalHeight,
        sourceViewportHeight: params.sourceViewportHeight,
        targetTotalHeight: params.targetTotalHeight,
        targetViewportHeight: params.targetViewportHeight
    });
    return {
        scrollTop: mirrored,
        apply: shouldMirrorScroll({
            targetScrollTop: params.targetScrollTop,
            mirroredScrollTop: mirrored
        })
    };
}

/** The horizontal counterpart of resolveMirrorTop. */
export function resolveMirrorLeft(params: {
    enabled: boolean;
    sourceScrollLeft: number;
    targetScrollLeft: number;
    sourceScrollWidth: number;
    sourceViewportWidth: number;
    targetScrollWidth: number;
    targetViewportWidth: number;
}): { scrollLeft: number; apply: boolean } {
    if (!params.enabled) {
        return { scrollLeft: params.targetScrollLeft, apply: false };
    }
    const mirrored = mirrorScrollLeft({
        sourceScrollLeft: params.sourceScrollLeft,
        sourceScrollWidth: params.sourceScrollWidth,
        sourceViewportWidth: params.sourceViewportWidth,
        targetScrollWidth: params.targetScrollWidth,
        targetViewportWidth: params.targetViewportWidth
    });
    return {
        scrollLeft: mirrored,
        apply: shouldMirrorScroll({
            targetScrollTop: params.targetScrollLeft,
            mirroredScrollTop: mirrored
        })
    };
}