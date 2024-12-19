import { type Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    fontFamily: {
      sans: [
        "-apple-system",
        "BlinkMacSystemFont",
        "Segoe UI",
        "Roboto",
        "Oxygen-Sans",
        "Ubuntu",
        "Cantarell",
        "Helvetica Neue",
        "sans-serif",
      ],
    },
    screens: {
      "screen-max-sm": { raw: "screen and (max-width: 480px)" },
      "screen-min-sm": { raw: "screen and (min-width: 480px)" },
      "screen-min-lg": { raw: "screen and (min-width: 780px)" },
      "screen-max-lg": { raw: "screen and (max-width: 780px)" },
      sm: "480px",
      md: "680px",
      lg: "780px",
    },
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Gray Scale
        white: "#fff",
        silver: "#f3f3f4",
        grey: "#aaa",
        black: "#111",
        "grey-10": "#d9dadb",
        "grey-15": "#cacbcd",
        "grey-30": "#b3b5b8",
        "grey-50": "#8e9095",
        // Custom colors
        "cs-pink": "#ec3360",
        "cs-pink-light": "#ff658c",
        "cs-blue-dark": "#30353e",
        "cs-blue": "#4d76ba",
        "cs-grey": "#f3f3f4",
        "cs-green": "#56af8a",

        // Semantic colors
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsla(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        tertiary: {
          DEFAULT: "hsl(var(--tertiary))",
          foreground: "hsl(var(--tertiary-foreground))",
        },
        disabled: "#b3b5b8", // $grey30
        bad: "#ff4136", // $red
        good: "#56af8a", // $cs-green
        info: "#0074d9", // $blue
        warning: "#ff851b", // $orange
        subtle: "#aaa", // $grey

        // shad?
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        border: {
          DEFAULT: "hsl(var(--border))",
          input: "hsl(var(--border-input))",
          card: "hsl(var(--border-card))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        label: "hsl(var(--label))",
        link: "hsl(var(--secondary))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        DEFAULT: "5px",
        btn: "5px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      spacing: {
        DEFAULT: "20px",
        unit: "4px",
      },
      lineHeight: {
        consistent: "50px",
      },
      boxShadow: {
        DEFAULT:
          "0 5px 15px 0 rgba(0, 0, 0, 0.07), 0 15px 35px 0 rgba(49, 49, 93, 0.1)",
        demo: "0 2px 10px rgba(0,0,0,.1), 0 0 30px rgba(0,0,0,.2)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
