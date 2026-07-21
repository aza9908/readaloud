/** GAME-01: canvas firework burst on book completion. Self-cleaning. */
import { useEffect, useRef } from "react";

const COLORS = ["#7c3aed", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899"];

export function Fireworks({ onDone }: { onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface P { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }
    const particles: P[] = [];
    const burst = (cx: number, cy: number) => {
      for (let i = 0; i < 60; i++) {
        const angle = (Math.PI * 2 * i) / 60 + Math.random() * 0.2;
        const speed = 2 + Math.random() * 5;
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 2 + Math.random() * 3,
        });
      }
    };

    const W = canvas.width, H = canvas.height;
    const bursts = [
      [W * 0.5, H * 0.3], [W * 0.25, H * 0.45], [W * 0.75, H * 0.4],
      [W * 0.4, H * 0.25], [W * 0.6, H * 0.5],
    ] as const;
    bursts.forEach(([x, y], i) => setTimeout(() => burst(x, y), i * 350));

    let raf = 0;
    const started = Date.now();
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        if (p.life <= 0) continue;
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.06; p.life -= 0.014;
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      if (Date.now() - started < 4200) raf = requestAnimationFrame(tick);
      else onDone?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[90] pointer-events-none"
      aria-hidden="true"
    />
  );
}
