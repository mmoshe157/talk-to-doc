import { useEffect, useRef } from "react";

interface AvatarCanvasProps {
  /** 0–1 from useGeminiLive.volumeLevel — drives mouth opening */
  volumeLevel: number;
  /** true while AI is speaking, false otherwise */
  isSpeaking: boolean;
  size?: number;
}

export function AvatarCanvas({ volumeLevel, isSpeaking, size = 240 }: AvatarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const stateRef = useRef({
    blinkT: 0,       // countdown to next blink (frames)
    blinkOpen: 1,    // 0 = closed, 1 = open (interpolated)
    breathT: 0,      // breathing cycle counter
    bobT: 0,         // head-bob cycle
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stateRef.current;
    s.blinkT = 90 + Math.random() * 90; // first blink in 1.5–3 s

    function draw(volumeLevel: number, speaking: boolean) {
      const W = canvas!.width;
      const H = canvas!.height;
      const cx = W / 2;
      const cy = H / 2 - 10;

      // Advance animations
      s.breathT += 0.02;
      s.bobT += 0.015;
      s.blinkT--;

      if (s.blinkT <= 0) {
        // Trigger a blink
        s.blinkOpen = 0;
        s.blinkT = 100 + Math.random() * 120; // next blink in 1.7–3.7 s
      }
      // Quickly re-open after blink
      if (s.blinkOpen < 1) {
        s.blinkOpen = Math.min(1, s.blinkOpen + 0.15);
      }

      // Subtle idle bob (only when not speaking)
      const bob = speaking ? 0 : Math.sin(s.bobT) * 2;
      const breathScale = 1 + Math.sin(s.breathT) * 0.003;

      ctx!.clearRect(0, 0, W, H);

      ctx!.save();
      ctx!.translate(cx, cy + bob);
      ctx!.scale(breathScale, breathScale);

      // ── Neck ──────────────────────────────────────────────────────────────
      ctx!.fillStyle = "#D4956A";
      ctx!.fillRect(-14, 58, 28, 28);

      // ── Shoulders / shirt ─────────────────────────────────────────────────
      ctx!.fillStyle = "#1A73E8"; // Google Blue shirt
      const shirtPath = new Path2D();
      shirtPath.moveTo(-55, 120);
      shirtPath.quadraticCurveTo(-55, 80, -18, 72);
      shirtPath.lineTo(18, 72);
      shirtPath.quadraticCurveTo(55, 80, 55, 120);
      shirtPath.closePath();
      ctx!.fill(shirtPath);

      // Collar
      ctx!.fillStyle = "#fff";
      ctx!.beginPath();
      ctx!.moveTo(-10, 72);
      ctx!.lineTo(0, 90);
      ctx!.lineTo(10, 72);
      ctx!.closePath();
      ctx!.fill();

      // ── Head ──────────────────────────────────────────────────────────────
      ctx!.fillStyle = "#D4956A";
      ctx!.beginPath();
      ctx!.ellipse(0, 0, 46, 54, 0, 0, Math.PI * 2);
      ctx!.fill();

      // ── Hair ──────────────────────────────────────────────────────────────
      ctx!.fillStyle = "#3D2B1F";
      ctx!.beginPath();
      ctx!.ellipse(0, -32, 46, 28, 0, Math.PI, 0);
      ctx!.fill();
      // Side hair
      ctx!.fillRect(-46, -38, 10, 26);
      ctx!.fillRect(36, -38, 10, 26);

      // ── Ears ──────────────────────────────────────────────────────────────
      ctx!.fillStyle = "#C4855A";
      ctx!.beginPath();
      ctx!.ellipse(-47, 4, 7, 9, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.beginPath();
      ctx!.ellipse(47, 4, 7, 9, 0, 0, Math.PI * 2);
      ctx!.fill();

      // ── Eyebrows ──────────────────────────────────────────────────────────
      ctx!.strokeStyle = "#3D2B1F";
      ctx!.lineWidth = 3;
      ctx!.lineCap = "round";
      // Left
      ctx!.beginPath();
      ctx!.moveTo(-26, -22);
      ctx!.quadraticCurveTo(-18, -26, -10, -22);
      ctx!.stroke();
      // Right
      ctx!.beginPath();
      ctx!.moveTo(10, -22);
      ctx!.quadraticCurveTo(18, -26, 26, -22);
      ctx!.stroke();

      // ── Eyes ──────────────────────────────────────────────────────────────
      const eyeOpenness = s.blinkOpen; // 0 = closed, 1 = fully open

      // Eye whites
      ctx!.fillStyle = "#fff";
      // Left
      ctx!.beginPath();
      ctx!.ellipse(-18, -10, 11, 8 * eyeOpenness + 0.5, 0, 0, Math.PI * 2);
      ctx!.fill();
      // Right
      ctx!.beginPath();
      ctx!.ellipse(18, -10, 11, 8 * eyeOpenness + 0.5, 0, 0, Math.PI * 2);
      ctx!.fill();

      if (eyeOpenness > 0.2) {
        // Irises
        ctx!.fillStyle = "#4A3728";
        ctx!.beginPath();
        ctx!.ellipse(-18, -10, 6, 6 * eyeOpenness, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.beginPath();
        ctx!.ellipse(18, -10, 6, 6 * eyeOpenness, 0, 0, Math.PI * 2);
        ctx!.fill();

        // Pupils
        ctx!.fillStyle = "#111";
        ctx!.beginPath();
        ctx!.ellipse(-18, -10, 3, 3 * eyeOpenness, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.beginPath();
        ctx!.ellipse(18, -10, 3, 3 * eyeOpenness, 0, 0, Math.PI * 2);
        ctx!.fill();

        // Highlights
        ctx!.fillStyle = "rgba(255,255,255,0.7)";
        ctx!.beginPath();
        ctx!.ellipse(-16, -12, 2, 2 * eyeOpenness, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.beginPath();
        ctx!.ellipse(20, -12, 2, 2 * eyeOpenness, 0, 0, Math.PI * 2);
        ctx!.fill();
      }

      // ── Nose ──────────────────────────────────────────────────────────────
      ctx!.strokeStyle = "#B37850";
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.moveTo(-5, 4);
      ctx!.quadraticCurveTo(-9, 14, -6, 16);
      ctx!.quadraticCurveTo(0, 18, 6, 16);
      ctx!.quadraticCurveTo(9, 14, 5, 4);
      ctx!.stroke();

      // ── Mouth ─────────────────────────────────────────────────────────────
      // Map volume → mouth open height (0 = closed smile, 1 = wide open)
      const mouthOpen = speaking ? Math.min(1, volumeLevel * 2.5) : 0;
      const mouthW = 22;
      const mouthH = 4 + mouthOpen * 14;
      const mouthY = 30;

      // Outer mouth / lips
      ctx!.fillStyle = "#C06060";
      ctx!.beginPath();
      ctx!.ellipse(0, mouthY, mouthW, mouthH / 2 + 2, 0, 0, Math.PI);
      ctx!.fill();

      // Upper lip
      ctx!.fillStyle = "#B04040";
      ctx!.beginPath();
      ctx!.moveTo(-mouthW, mouthY);
      ctx!.quadraticCurveTo(-mouthW / 2, mouthY - 5, 0, mouthY - 4);
      ctx!.quadraticCurveTo(mouthW / 2, mouthY - 5, mouthW, mouthY);
      ctx!.closePath();
      ctx!.fill();

      if (mouthOpen > 0.05) {
        // Inside mouth / teeth visible when open
        ctx!.fillStyle = "#1A1A1A";
        ctx!.beginPath();
        ctx!.ellipse(0, mouthY + 1, mouthW - 4, mouthH / 2, 0, 0, Math.PI);
        ctx!.fill();

        // Teeth
        ctx!.fillStyle = "#F5F5F0";
        ctx!.beginPath();
        ctx!.ellipse(0, mouthY + 1, mouthW - 6, mouthH / 2 - 1, 0, 0, Math.PI * 0.6);
        ctx!.fill();
      } else {
        // Closed smile
        ctx!.strokeStyle = "#B04040";
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        ctx!.moveTo(-mouthW, mouthY);
        ctx!.quadraticCurveTo(0, mouthY + 8, mouthW, mouthY);
        ctx!.stroke();
      }

      // ── Speaking glow ring ─────────────────────────────────────────────────
      if (speaking && volumeLevel > 0.05) {
        const alpha = Math.min(0.4, volumeLevel * 0.5);
        ctx!.save();
        ctx!.shadowColor = "rgba(26, 115, 232, 0.6)";
        ctx!.shadowBlur = 20 + volumeLevel * 20;
        ctx!.strokeStyle = `rgba(26, 115, 232, ${alpha})`;
        ctx!.lineWidth = 3;
        ctx!.beginPath();
        ctx!.ellipse(0, 0, 50, 58, 0, 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.restore();
      }

      ctx!.restore();
    }

    let lastVolume = 0;
    let lastSpeaking = false;

    function loop() {
      // Access the latest prop values via closure ref
      draw(lastVolume, lastSpeaking);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    // Expose setter for the component to push new values each render
    (canvas as HTMLCanvasElement & { _setAvatarState?: (v: number, s: boolean) => void })._setAvatarState = (v, s) => {
      lastVolume = v;
      lastSpeaking = s;
    };

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push latest prop values into the animation loop on every render
  useEffect(() => {
    const canvas = canvasRef.current as (HTMLCanvasElement & { _setAvatarState?: (v: number, s: boolean) => void }) | null;
    canvas?._setAvatarState?.(volumeLevel, isSpeaking);
  }, [volumeLevel, isSpeaking]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size + 60}
      style={{ width: size, height: size + 60 }}
      className="rounded-full"
    />
  );
}
