import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          bg: "#F7F3EA",
          soft: "#FAF6EC",
        },
        brand: {
          blue: "#0F3155",
          "blue-dark": "#0B3763",
        },
        paper: {
          DEFAULT: "#FFFDF6",
          warm: "#FEFAEF",
          yellow: "#F6E8BD",
        },
        text: {
          primary: "#211A16",
          secondary: "#7A756B",
          tertiary: "#8A8278",
          inactive: "#8C887E",
        },
        border: {
          paper: "#E7DDC8",
          warm: "#D4C2A3",
        },
        danger: {
          soft: "#C44E4E",
        },
        sync: {
          green: "#7FA27F",
        },
      },
      borderRadius: {
        card: "28px",
        "card-lg": "36px",
        button: "999px",
        input: "999px",
        tag: "999px",
      },
      boxShadow: {
        card: "0 2px 16px rgba(15, 49, 85, 0.06)",
        "card-hover": "0 4px 20px rgba(15, 49, 85, 0.08)",
        button: "0 3px 10px rgba(15, 49, 85, 0.12)",
        "bottom-bar": "0 -1px 0 rgba(15, 49, 85, 0.08)",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "\"PingFang SC\"",
          "\"Microsoft YaHei\"",
          "sans-serif",
        ],
        serif: ["Georgia", "\"Songti SC\"", "\"STSong\"", "serif"],
      },
      maxWidth: {
        mobile: "430px",
      },
      minWidth: {
        touch: "44px",
      },
      minHeight: {
        touch: "44px",
      },
      padding: {
        "safe-bottom": "env(safe-area-inset-bottom, 0px)",
      },
    },
  },
  plugins: [],
};

export default config;
