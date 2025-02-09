/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1F2A3D',
        list: 'rgba(29, 29, 29, 0.6)',
        font: '#E4E4E4',
        active: '#D34B60',
        hover: '#FF7B8E',
        toolbar: 'rgba(29, 29, 29, 0.8)',
        panel: 'rgba(29, 29, 29, 0.95)',
        'top-panel': 'rgba(0, 0, 0, 0.9)',
        tertiary: '#A6D600',
        quaternary: '#666666',
        quinary: '#222222',
        senary: '#333333',
        septenary: '#535bf2',
        octonary: '#646cff',
        denary: '#292B36',
        btn: '#4A90E2',
        'btn-hover': '#6AAEE'
      }
    },
  },
  variants: {
    fill: ['hover', 'focus'], // this line does the trick
  },
  plugins: [],
};
