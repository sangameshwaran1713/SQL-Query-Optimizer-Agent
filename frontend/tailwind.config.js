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
          dark: "#0b0f19",
          card: "#151b2a",
          border: "#1e293b",
          primary: "#6366f1", // Indigo
          secondary: "#14b8a6", // Teal
          accent: "#f43f5e", // Rose
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        mono: ['"Fira Code"', 'monospace'],
      }
    },
  },
  plugins: [],
}

