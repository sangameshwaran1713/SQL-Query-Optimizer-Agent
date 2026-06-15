/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg:       "rgb(var(--brand-bg) / <alpha-value>)",
          surface:  "rgb(var(--brand-surface) / <alpha-value>)",
          border:   "rgb(var(--brand-border) / <alpha-value>)",
          primary:  "rgb(var(--brand-primary) / <alpha-value>)",
          primaryHover: "rgb(var(--brand-primary-hover) / <alpha-value>)",
          secondary: "rgb(var(--brand-secondary) / <alpha-value>)",
          secondaryHover: "rgb(var(--brand-secondary-hover) / <alpha-value>)",
          text:     "rgb(var(--brand-text) / <alpha-value>)",
          muted:    "rgb(var(--brand-muted) / <alpha-value>)",
          faint:    "rgb(var(--brand-faint) / <alpha-value>)",
        }
      },
      fontFamily: {
        sans: ['"Inter"', '"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"Fira Code"', '"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
        'btn': '0 1px 3px 0 rgba(99,102,241,0.5)',
      },
    },
  },
  plugins: [],
}
