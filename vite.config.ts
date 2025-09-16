import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve, dirname } from 'path';
import { promises as fs } from 'fs';

const renameHtmlPlugin = (): Plugin => ({
  name: 'rename-extension-html',
  async writeBundle(options, bundle) {
    const outDir = options.dir ?? 'dist';
    const htmlFiles = Object.keys(bundle).filter(
      (fileName) => fileName.startsWith('src/') && fileName.endsWith('.html')
    );

    await Promise.all(
      htmlFiles.map(async (fileName) => {
        const sourcePath = resolve(outDir, fileName);
        const targetFileName = fileName.replace(/^src\//, '');
        const targetPath = resolve(outDir, targetFileName);

        await fs.mkdir(dirname(targetPath), { recursive: true });
        await fs.rename(sourcePath, targetPath);
      })
    );

    // Clean up empty src directory after moving HTML files
    await fs.rm(resolve(outDir, 'src'), { recursive: true, force: true });
  }
});

export default defineConfig({
  plugins: [react(), renameHtmlPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        'popup/index': resolve(__dirname, 'src/popup/index.html'),
        'analysis/index': resolve(__dirname, 'src/analysis/index.html'),
        background: resolve(__dirname, 'src/background/index.ts')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
});
