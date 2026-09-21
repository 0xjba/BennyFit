// The parts of StPageFlip (page-flip 2.0.7, MIT) this project uses. The package ships
// TypeScript sources but no declarations.
declare module 'page-flip/dist/js/page-flip.module.js' {
  export interface FlipSetting {
    width: number;
    height: number;
    size: 'fixed' | 'stretch';
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    showCover: boolean;
    usePortrait: boolean;
    drawShadow: boolean;
    maxShadowOpacity: number;
    flippingTime: number;
    mobileScrollSupport: boolean;
    showPageCorners: boolean;
    autoSize: boolean;
    startPage: number;
  }
  export class PageFlip {
    constructor(element: HTMLElement, settings: Partial<FlipSetting>);
    loadFromImages(images: string[]): void;
    loadFromHTML(items: HTMLElement[]): void;
    flipNext(): void;
    flipPrev(): void;
    flip(page: number): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    on(event: 'flip' | 'init' | 'changeOrientation', callback: (e: { data: unknown }) => void): void;
    destroy(): void;
  }
}
