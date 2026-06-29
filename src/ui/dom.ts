// src/ui/dom — tiny, typed DOM helpers shared by every widget and editor.
//
// Replaces the legacy app's scattered `document.createElement` + innerHTML string
// soup with a couple of safe, composable primitives. No globals; pure functions.

/** Create an element with props/attrs and children in one call. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Partial<Omit<HTMLElementTagNameMap[K], 'style' | 'dataset'>> & {
    style?: string;
    class?: string;
    dataset?: Record<string, string>;
  },
  children?: Array<Node | string>,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props) {
    const { style, class: cls, dataset, ...rest } = props;
    if (style) node.setAttribute('style', style);
    if (cls) node.className = cls;
    if (dataset) for (const [k, v] of Object.entries(dataset)) node.dataset[k] = v;
    Object.assign(node, rest);
  }
  if (children) for (const c of children) node.append(c);
  return node;
}

/** Inject a `<style>` block once, keyed by id (port of core.js addStyles). */
export function addStyles(id: string, cssText: string): void {
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = cssText;
  document.head.appendChild(s);
}

/** querySelector that throws instead of returning null — callers get a non-null type (G1). */
export function qs<T extends Element = HTMLElement>(root: ParentNode, sel: string): T {
  const found = root.querySelector<T>(sel);
  if (!found) throw new Error(`qs: no element matches ${sel}`);
  return found;
}

/** 2D context guard (G5): get a non-null context or bail once per canvas. */
export function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext('2d');
}
