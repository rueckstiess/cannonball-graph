import typescript from 'rollup-plugin-typescript2';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

const isProd = process.env.BUILD === 'production';

const banner =
  `/*
 * My TypeScript Library
 * (c) ${new Date().getFullYear()}
 */
`;

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'auto',
      banner,
      sourcemap: !isProd
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      banner,
      sourcemap: !isProd
    }
  ],
  plugins: [
    typescript({
      tsconfig: 'tsconfig.json',
    }),
    nodeResolve(),
    commonjs(),
    isProd && terser()
  ],
  external: [] // Add external dependencies here
};