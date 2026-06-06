/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // All tokens are stored as RGB channels in index.css.
        // `:root` = light theme, `.dark` overrides to dark values.
        // The <alpha-value> placeholder enables opacity modifiers:
        //   bg-surface-2/80, border-border/40, text-fg-muted/60, etc.
        surface: {
          0: "rgb(var(--surface-0) / <alpha-value>)",
          1: "rgb(var(--surface-1) / <alpha-value>)",
          2: "rgb(var(--surface-2) / <alpha-value>)",
          3: "rgb(var(--surface-3) / <alpha-value>)",
          4: "rgb(var(--surface-4) / <alpha-value>)",
          5: "rgb(var(--surface-5) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)",
          light:   "rgb(var(--border-light) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          hover:   "rgb(var(--accent-hover) / <alpha-value>)",
        },
        fg: {
          base:  "rgb(var(--text-primary) / <alpha-value>)",
          muted: "rgb(var(--text-muted)   / <alpha-value>)",
          dim:   "rgb(var(--text-dim)     / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["'Inter'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Fira Code'", "Consolas", "monospace"],
      },
      boxShadow: {
        card:     "var(--card-shadow)",
        elevated: "var(--elevated-shadow)",
        accent:   "var(--accent-glow)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in":    "fadeIn  0.22s ease-out",
        "slide-up":   "slideUp 0.22s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
