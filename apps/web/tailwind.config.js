/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0a1628",
          800: "#0d1f3c",
          700: "#122650",
          600: "#1a3566",
        },
        aegis: {
          cyan: "#00d4e8",
          blue: "#0077ff",
          amber: "#f59e0b",
          red: "#ef4444",
          green: "#10b981",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        sans: ["Inter", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "waveform": "waveform 1.2s ease-in-out infinite",
      },
      keyframes: {
        waveform: {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
    },
  },
  plugins: [],
};
