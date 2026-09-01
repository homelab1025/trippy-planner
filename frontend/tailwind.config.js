import daisyui from 'daisyui';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        alpine: {
          primary: '#256a4e',
          'primary-content': '#ffffff',
          secondary: '#48663f',
          'secondary-content': '#ffffff',
          neutral: '#2b3234',
          'neutral-content': '#ebf2f4',
          'base-100': '#ffffff',
          'base-200': '#eef5f7',
          'base-300': '#bfc9c1',
          'base-content': '#161d1f',
          error: '#ba1a1a',
          'error-content': '#ffffff',
          '--rounded-box': '0.75rem',
          '--rounded-btn': '0.375rem',
        },
      },
    ],
  },
};
