/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        google: {
          blue:    "#1a73e8",
          "blue-dark": "#1557b0",
          "blue-light": "#e8f0fe",
          red:     "#d93025",
          yellow:  "#f9ab00",
          green:   "#1e8e3e",
          gray:    "#5f6368",
          "gray-light": "#f8f9fa",
          "gray-border": "#dadce0",
          surface: "#ffffff",
        },
      },
      fontFamily: {
        sans: ["Google Sans", "Roboto", "Arial", "sans-serif"],
        mono: ["Roboto Mono", "monospace"],
      },
      boxShadow: {
        google: "0 1px 2px 0 rgba(60,64,67,.3),0 2px 6px 2px rgba(60,64,67,.15)",
        "google-sm": "0 1px 2px 0 rgba(60,64,67,.3)",
      },
      animation: {
        "thinking": "thinking 1.4s ease-in-out infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        thinking: {
          "0%, 80%, 100%": { transform: "scale(0.6)", opacity: "0.4" },
          "40%": { transform: "scale(1)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
