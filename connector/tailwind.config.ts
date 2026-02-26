import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f6f2e8",
        ink: "#1f2a44",
        accent: "#d94f04",
        accentSoft: "#f6d8c3",
        moss: "#35524a"
      },
      fontFamily: {
        heading: ["'Space Grotesk'", "sans-serif"],
        body: ["'IBM Plex Sans'", "sans-serif"]
      }
    }
  }
} satisfies Config;
