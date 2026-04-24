/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bauBlack: "#141414",
        bauCream: "#f3efe2",
        bauRed: "#d64933",
        bauBlue: "#2654c4",
        bauYellow: "#f2c230",
        bauGray: "#d6d2c4",
      },
      fontFamily: {
        sans: ['"League Spartan"', '"Avenir Next"', '"Segoe UI"', "sans-serif"],
        mono: ['"IBM Plex Mono"', '"SFMono-Regular"', "monospace"],
      },
      boxShadow: {
        bauHard: "10px 10px 0 #141414",
      },
    },
  },
  plugins: [],
};
