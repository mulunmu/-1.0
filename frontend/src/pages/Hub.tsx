import { useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import CosmicShaderBackground, { type CosmicFocus } from "@/components/background/CosmicShaderBackground";
import SolarNav from "@/components/nav/SolarNav";
import MockDataBanner from "@/components/MockDataBanner";

export default function Hub() {
  const location = useLocation();
  const [focus, setFocus] = useState<CosmicFocus>({ x: 0.5, y: 0.5, strength: 0.18 });
  const [bgPaused, setBgPaused] = useState(false);

  const handleFocusChange = useCallback((next: CosmicFocus) => {
    setFocus(next);
  }, []);

  useEffect(() => {
    setBgPaused(false);
    setFocus({ x: 0.5, y: 0.5, strength: 0.18 });
  }, [location.key]);

  return (
    <div className="relative isolate min-h-screen flex flex-col overflow-x-hidden">
      <CosmicShaderBackground
        key={`hub-bg-${location.key}`}
        variant="hub"
        focus={focus}
        paused={bgPaused}
        fixed
      />

      <MockDataBanner />

      <div className="absolute inset-0 pointer-events-none z-[1] cosmic-edge-vignette opacity-35" />

      <div key={`hub-nav-${location.key}`} className="relative z-10 w-full min-h-screen">
        <SolarNav
          mode="hub"
          onFocusChange={handleFocusChange}
          onExitStart={() => setBgPaused(true)}
        />
      </div>
    </div>
  );
}
