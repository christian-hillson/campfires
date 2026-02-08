import type { RenderState } from './types.js';
export declare function enterAltScreen(): void;
export declare function exitAltScreen(): void;
/**
 * Debounced render — coalesces rapid updates into a single frame.
 */
export declare function render(state: RenderState): void;
/**
 * Immediate render — bypasses debouncing (for initial draw and cleanup).
 */
export declare function renderImmediate(state: RenderState): void;
//# sourceMappingURL=renderer.d.ts.map