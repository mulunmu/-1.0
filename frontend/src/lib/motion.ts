/** 方案 C — 统一动效层：路由切换 + 区块错落入场 */

export const MOTION_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
export const MOTION_ROUTE_MS = 240;
export const MOTION_STAGGER_MS = 48;
export const MOTION_BLOCK_MS = 200;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 路由页淡入 + 轻微上浮 */
export function revealRoute(el: HTMLElement | null) {
  if (!el || prefersReducedMotion()) return;

  el.style.opacity = "0";
  el.style.transform = "translateY(8px)";
  el.style.transition = `opacity ${MOTION_ROUTE_MS}ms ${MOTION_EASE}, transform ${MOTION_ROUTE_MS}ms ${MOTION_EASE}`;

  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });
}

/** 页面区块错落入场 */
export function revealStagger(container: HTMLElement | null, selector = "[data-reveal]") {
  if (!container || prefersReducedMotion()) return;

  const items = container.querySelectorAll<HTMLElement>(selector);
  if (!items.length) return;

  items.forEach((el, i) => {
    const delay = i * MOTION_STAGGER_MS;
    el.style.opacity = "0";
    el.style.transform = "translateY(10px)";
    el.style.transition = `opacity ${MOTION_BLOCK_MS}ms ${MOTION_EASE} ${delay}ms, transform ${MOTION_BLOCK_MS}ms ${MOTION_EASE} ${delay}ms`;

    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
  });
}

/** 路由进入：整页淡入 + 内部 data-reveal 错落 */
export function runPageEnter(root: HTMLElement | null) {
  if (!root) return;
  revealRoute(root);
  window.setTimeout(() => revealStagger(root), 16);
}
