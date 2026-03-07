import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: { DEFAULT: "#ffffff", subtle: "#fafafa" },
        ink: { DEFAULT: "#1a1a1a", soft: "#737373", muted: "#a3a3a3" },
        accent: { DEFAULT: "#1a1a1a", hover: "#404040", soft: "#f5f5f5" },
        line: { DEFAULT: "#e8e8e8", soft: "#f0f0f0" }
      },
      fontFamily: {
        sans: ["'Inter'", "-apple-system", "BlinkMacSystemFont", "sans-serif"]
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }]
      },
      borderRadius: {
        DEFAULT: "8px"
      }
    }
  }
} satisfies Config;
