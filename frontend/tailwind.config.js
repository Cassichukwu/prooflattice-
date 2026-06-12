/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mantle: {
          DEFAULT: "#000000",
          50: "#f6f6f6",
          900: "#0a0a0a",
        },
        lattice: {
          DEFAULT: "#00d4aa",
          glow: "#7effd4",
        },
        bounty: {
          red: "#ff3860",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      animation: {
        "pulse-glow": "pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(0, 212, 170, 0.7)" },
          "50%": { boxShadow: "0 0 20px 10px rgba(0, 212, 170, 0)" },
        },
      },
    },
  },
  plugins: [],
};
