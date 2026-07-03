import Particles, { ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

export default function ParticlesBackground() {
  return (
    <ParticlesProvider init={loadSlim}>
      <Particles
        id="tsparticles"
        className="fixed inset-0 -z-10 pointer-events-none"
        options={{
          fullScreen: { enable: true, zIndex: -10 },
          fpsLimit: 30,
          particles: {
            number: { value: 50, density: { enable: true } },
            color: { value: ["#ec4899", "#06b6d4", "#8b5cf6", "#f59e0b"] },
            opacity: {
              value: 0.1,
              animation: { enable: true, speed: 0.4, minimumValue: 0.03, sync: false },
            },
            size: {
              value: { min: 1, max: 3.5 },
              animation: { enable: true, speed: 0.6, minimumValue: 0.3, sync: false },
            },
            move: {
              enable: true,
              speed: 0.3,
              direction: "none" as const,
              random: true,
              straight: false,
              outModes: "bounce" as const,
            },
            links: {
              enable: true,
              distance: 180,
              color: "#ec4899",
              opacity: 0.05,
              width: 0.5,
            },
          },
          interactivity: {
            events: { onHover: { enable: true, mode: "grab" } },
            modes: { grab: { distance: 220, links: { opacity: 0.12, color: "#06b6d4" } } },
          },
          detectRetina: true,
        }}
      />
    </ParticlesProvider>
  );
}
