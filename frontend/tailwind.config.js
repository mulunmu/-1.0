/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0a0e17",
        foreground: "#e2e8f0",
        card: {
          DEFAULT: "#111827",
          foreground: "#e2e8f0",
        },
      },
    },
  },
  plugins: [],
};
