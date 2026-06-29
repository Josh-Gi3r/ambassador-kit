import * as React from "react";

// Tailwind-aligned plus an explicit iPad-mini bucket so we can target
// the 768–834 portrait-tablet range without bleeding into desktop.
export const BREAKPOINTS = {
  xs: 0,
  sm: 480,
  md: 640,
  ipadMini: 768,
  ipad: 1024,
  lg: 1280,
  xl: 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

type State = {
  width: number;
  height: number;
  isMobile: boolean;
  isTabletPortrait: boolean;
  isTabletLandscape: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  isStandalone: boolean;
};

function read(): State {
  if (typeof window === "undefined") {
    return {
      width: 1280,
      height: 800,
      isMobile: false,
      isTabletPortrait: false,
      isTabletLandscape: false,
      isDesktop: true,
      isTouch: false,
      isStandalone: false,
    };
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    width: w,
    height: h,
    isMobile: w < BREAKPOINTS.ipadMini,
    isTabletPortrait: w >= BREAKPOINTS.ipadMini && w < BREAKPOINTS.ipad,
    isTabletLandscape: w >= BREAKPOINTS.ipad && w < BREAKPOINTS.lg && isTouch,
    isDesktop: w >= BREAKPOINTS.ipad && !isTouch,
    isTouch,
    isStandalone,
  };
}

export function useBreakpoint(): State {
  const [s, setS] = React.useState<State>(() => read());
  React.useEffect(() => {
    const onChange = () => setS(read());
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);
  return s;
}

export function useIsMobile() {
  return useBreakpoint().isMobile;
}

export function useIsTablet() {
  const s = useBreakpoint();
  return s.isTabletPortrait || s.isTabletLandscape;
}
