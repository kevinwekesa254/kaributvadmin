/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("./tailwind.preset.js")],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: { screens: { xs: "420px" } } },
  plugins: [],
};
