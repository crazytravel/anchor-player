/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1F2A3D',
        list: '#1D1D1D',
        secondary: '#E4E4E4',
        tertiary: '#A6D600',
        quaternary: '#666666',
        quinary: '#222222',
        senary: '#333333',
        septenary: '#535bf2',
        octonary: '#646cff',
        nonary: '#D34B60',
        denary: '#292B36',
        elevenary: '#D34B60',
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
