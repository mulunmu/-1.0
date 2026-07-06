/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#050508",
        foreground: "#fafafa",
        card: {
          DEFAULT: "transparent",
          foreground: "#fafafa",
        },
      },
    },
  },
  plugins: [],
};
