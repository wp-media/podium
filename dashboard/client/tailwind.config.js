/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tokens are stored as RGB channels in index.css (":root" / ".dark")
        // and referenced with the <alpha-value> placeholder so opacity
        // modifiers like bg-accent/15 and border-border/40 work in both themes.
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
          light: "rgb(var(--border-light) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
          // Already a finished rgba — used directly, no alpha modifier.
          muted: "var(--accent-muted)",
        },
        fg: {
          base: "rgb(var(--text-primary) / <alpha-value>)",
          muted: "rgb(var(--text-muted) / <alpha-value>)",
          dim: "rgb(var(--text-dim) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["'Whitney HTF Medium'", "'Inter'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Fira Code'", "Consolas", "monospace"],
      },
      // Backdrop-blur scale tuned for the glassmorphism surfaces. The named
      // tokens map to the blur radii used by .card (xl), .glass-panel, and
      // .card-glass (2xl) in index.css so utilities stay in sync.
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        DEFAULT: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "28px",
        "3xl": "40px",
      },
      backdropSaturate: {
        125: "1.25",
        150: "1.5",
        170: "1.7",
        200: "2",
      },
      // Glass tints exposed as utilities (bg-glass, border-glass, ...) for
      // ad-hoc surfaces that want the frosted look without the full .card class.
      backgroundColor: {
        glass: "var(--glass-bg)",
        "glass-strong": "var(--glass-bg-strong)",
      },
      borderColor: {
        glass: "var(--glass-border)",
        "glass-soft": "var(--glass-border-soft)",
      },
      boxShadow: {
        glass: "var(--glass-shadow)",
        "glass-strong": "var(--glass-shadow-strong)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
