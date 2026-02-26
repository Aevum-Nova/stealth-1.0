import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#fafafa",
        ink: "#111827",
        accent: "#111827",
        accentSoft: "#f3f4f6",
        moss: "#374151"
      },
      fontFamily: {
        heading: ["'Space Grotesk'", "sans-serif"],
        body: ["'IBM Plex Sans'", "sans-serif"]
      }
    }
  }
} satisfies Config;
