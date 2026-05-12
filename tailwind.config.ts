import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-fira-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-fira-code)", "monospace"],
      },
      colors: {
        bg: {
          base: "#07070D",
          panel: "#0F0F23",
          card: "rgba(30,27,75,0.4)",
        },
        accent: {
          DEFAULT: "#E11D48",
          dark: "#BE123C",
          soft: "#FB7185",
        },
        ink: {
          DEFAULT: "#F8FAFC",
          soft: "#CBD5E1",
          muted: "#94A3B8",
          dim: "#64748B",
          deep: "#475569",
        },
      },
      borderRadius: {
        lg: "16px",
        md: "12px",
        sm: "8px",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 250ms ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
