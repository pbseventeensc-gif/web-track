/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Fira Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        heading: ['"Fira Code"', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        master: {
          primary: 'var(--color-primary)',
          'primary-soft': 'var(--color-primary-soft)',
          secondary: 'var(--color-secondary)',
          accent: 'var(--color-accent)',
          'accent-soft': 'var(--color-accent-soft)',
          bg: 'var(--color-background)',
          fg: 'var(--color-foreground)',
          card: 'var(--color-card)',
          'card-fg': 'var(--color-card-foreground)',
          muted: 'var(--color-muted)',
          'muted-fg': 'var(--color-muted-foreground)',
          border: 'var(--color-border)',
          destructive: 'var(--color-destructive)',
          'destructive-soft': 'var(--color-destructive-soft)',
          ring: 'var(--color-ring)',
        },
      },
      boxShadow: {
        'master-sm': 'var(--shadow-sm)',
        'master-md': 'var(--shadow-md)',
        'master-lg': 'var(--shadow-lg)',
        'master-xl': 'var(--shadow-xl)',
      },
    },
  },
  plugins: [],
}
