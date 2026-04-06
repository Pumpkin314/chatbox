import { sentryVitePlugin } from '@sentry/vite-plugin'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import fs from 'fs'
import path, { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import type { Plugin, ViteDevServer } from 'vite'
import packageJson from './release/app/package.json'
/**
 * Vite plugin to serve and copy chatbridge app HTML files.
 * Source of truth: src/renderer/chatbridge/apps/
 * - Dev: serves app HTML via configureServer middleware
 * - Build: copies app HTML to output dir in writeBundle hook
 */
export function chatbridgeAppsPlugin(): Plugin {
  const appsSource = resolve(__dirname, 'src/renderer/chatbridge/apps')
  const chatbridgeSource = resolve(__dirname, 'src/renderer/chatbridge')

  return {
    name: 'chatbridge-apps',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        // Serve /auth/callback.html from chatbridge source directory
        if (req.url && req.url.startsWith('/auth/')) {
          const authFile = req.url.replace('/auth/', '')
          // Map callback.html -> oauth-callback.html
          const mappedFile = authFile === 'callback.html' ? 'oauth-callback.html' : authFile
          const filePath = resolve(chatbridgeSource, mappedFile)
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.setHeader('Content-Type', 'text/html')
            fs.createReadStream(filePath).pipe(res)
            return
          }
        }
        if (req.url && req.url.startsWith('/apps/')) {
          const filePath = resolve(appsSource, req.url.replace('/apps/', ''))
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.setHeader('Content-Type', 'text/html')
            fs.createReadStream(filePath).pipe(res)
            return
          }
        }
        next()
      })
    },
    writeBundle(options) {
      const outDir = options.dir || resolve(__dirname, 'release/app/dist/renderer')
      const destApps = resolve(outDir, 'apps')

      // Recursively copy app HTML files (skip __tests__ directories)
      function copyDir(src: string, dest: string) {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true })
        }
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
          if (entry.name === '__tests__' || entry.name.startsWith('.')) continue
          const srcPath = resolve(src, entry.name)
          const destPath = resolve(dest, entry.name)
          if (entry.isDirectory()) {
            copyDir(srcPath, destPath)
          } else {
            fs.copyFileSync(srcPath, destPath)
          }
        }
      }

      copyDir(appsSource, destApps)

      // Copy oauth-callback.html to auth/callback.html in output
      const authDir = resolve(outDir, 'auth')
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true })
      }
      const oauthSrc = resolve(chatbridgeSource, 'oauth-callback.html')
      if (fs.existsSync(oauthSrc)) {
        fs.copyFileSync(oauthSrc, resolve(authDir, 'callback.html'))
      }
    },
  }
}

/**
 * Vite plugin to inject <base href="/"> for web builds
 * This ensures relative paths resolve correctly for SPA routes like /session/xxx
 */
export function injectBaseTag(): Plugin {
  return {
    name: 'inject-base-tag',
    transformIndexHtml() {
      return [
        {
          tag: 'base',
          attrs: { href: '/' },
          injectTo: 'head-prepend', // Inject at the beginning of <head>
        },
      ]
    },
  }
}

/**
 * Vite plugin to inject window.chatbox_release_date for web builds
 */
export function injectReleaseDate(): Plugin {
  const releaseDate = new Date().toISOString().slice(0, 10)
  return {
    name: 'inject-release-date',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          children: `window.chatbox_release_date="${releaseDate}";`,
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

/**
 * Vite plugin to replace Plausible data-domain for web builds
 */
export function replacePlausibleDomain(): Plugin {
  return {
    name: 'replace-plausible-domain',
    transformIndexHtml(html) {
      return html.replace('data-domain="app.chatboxai.app"', 'data-domain="web.chatboxai.app"')
    },
  }
}

/**
 * Vite plugin to replace dvh units with vh units
 * This replaces the webpack string-replace-loader functionality
 */
export function dvhToVh(): Plugin {
  return {
    name: 'dvh-to-vh',
    transform(code, id) {
      if (id.endsWith('.css') || id.endsWith('.scss') || id.endsWith('.sass')) {
        return {
          code: code.replace(/(\d+)dvh/g, '$1vh'),
          map: null,
        }
      }
      return null
    },
  }
}

const inferredRelease = process.env.SENTRY_RELEASE || packageJson.version
const inferredDist = process.env.SENTRY_DIST || undefined

process.env.SENTRY_RELEASE = inferredRelease
if (inferredDist) {
  process.env.SENTRY_DIST = inferredDist
}

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  const isWeb = process.env.CHATBOX_BUILD_PLATFORM === 'web'

  return {
    main: {
      plugins: [
        ...(isProduction
          ? [
              visualizer({
                filename: 'release/app/dist/main/stats.html',
                open: false,
                title: 'Main Process Dependency Analysis',
              }),
            ]
          : [externalizeDepsPlugin()]),
        process.env.SENTRY_AUTH_TOKEN
          ? sentryVitePlugin({
              authToken: process.env.SENTRY_AUTH_TOKEN,
              org: 'sentry',
              project: 'chatbox',
              url: 'https://sentry.midway.run/',
              release: {
                name: inferredRelease,
                ...(inferredDist ? { dist: inferredDist } : {}),
              },
              sourcemaps: {
                assets: isProduction ? 'release/app/dist/main/**' : 'output/main/**',
              },
              telemetry: false,
            })
          : undefined,
      ].filter(Boolean),
      build: {
        outDir: isProduction ? 'release/app/dist/main' : undefined,
        lib: {
          entry: resolve(__dirname, 'src/main/main.ts'),
        },
        sourcemap: isProduction ? 'hidden' : true,
        minify: isProduction,
        rollupOptions: {
          external: Object.keys(packageJson.dependencies || {}),
          output: {
            entryFileNames: '[name].js',
            inlineDynamicImports: true,
          },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src/renderer'),
          'src/shared': path.resolve(__dirname, './src/shared'),
        },
      },
      define: {
        'process.type': '"browser"',
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        'process.env.CHATBOX_BUILD_TARGET': JSON.stringify(process.env.CHATBOX_BUILD_TARGET || 'unknown'),
        'process.env.CHATBOX_BUILD_PLATFORM': JSON.stringify(process.env.CHATBOX_BUILD_PLATFORM || 'unknown'),
        'process.env.CHATBOX_BUILD_CHANNEL': JSON.stringify(process.env.CHATBOX_BUILD_CHANNEL || 'unknown'),
        'process.env.USE_LOCAL_API': JSON.stringify(process.env.USE_LOCAL_API || ''),
        'process.env.USE_BETA_API': JSON.stringify(process.env.USE_BETA_API || ''),
      },
    },
    preload: {
      plugins: [
        visualizer({
          filename: 'release/app/dist/preload/stats.html',
          open: false,
          title: 'Preload Process Dependency Analysis',
        }),
      ],
      build: {
        outDir: isProduction ? 'release/app/dist/preload' : undefined,
        lib: {
          entry: resolve(__dirname, 'src/preload/index.ts'),
        },
        sourcemap: isProduction ? 'hidden' : true,
        minify: isProduction,
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src/renderer'),
          'src/shared': path.resolve(__dirname, './src/shared'),
        },
      },
    },
    renderer: {
      publicDir: resolve(__dirname, 'src/renderer/public'),
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src/renderer'),
          '@shared': path.resolve(__dirname, 'src/shared'),
        },
      },
      plugins: [
        TanStackRouterVite({
          target: 'react',
          autoCodeSplitting: true,
          routesDirectory: './src/renderer/routes',
          generatedRouteTree: './src/renderer/routeTree.gen.ts',
        }),
        react({}),
        chatbridgeAppsPlugin(),
        dvhToVh(),
        isWeb ? injectBaseTag() : undefined,
        injectReleaseDate(),
        isWeb ? replacePlausibleDomain() : undefined,
        visualizer({
          filename: 'release/app/dist/renderer/stats.html',
          open: false,
          title: 'Renderer Process Dependency Analysis',
        }),
        process.env.SENTRY_AUTH_TOKEN
          ? sentryVitePlugin({
              authToken: process.env.SENTRY_AUTH_TOKEN,
              org: 'sentry',
              project: 'chatbox',
              url: 'https://sentry.midway.run/',
              release: {
                name: inferredRelease,
                ...(inferredDist ? { dist: inferredDist } : {}),
              },
              sourcemaps: {
                assets: isProduction ? 'release/app/dist/renderer/**' : 'output/renderer/**',
              },
              telemetry: false,
            })
          : undefined,
      ].filter(Boolean),
      build: {
        outDir: isProduction ? 'release/app/dist/renderer' : undefined,
        target: 'es2020', // Avoid static initialization blocks for browser compatibility
        sourcemap: isProduction ? 'hidden' : true,
        minify: isProduction ? 'esbuild' : false, // Use esbuild for faster, less memory-intensive minification
        rollupOptions: {
          output: {
            entryFileNames: 'js/[name].[hash].js',
            chunkFileNames: 'js/[name].[hash].js',
            assetFileNames: (assetInfo) => {
              if (assetInfo.name?.endsWith('.css')) {
                return 'styles/[name].[hash][extname]'
              }
              if (/\.(woff|woff2|eot|ttf|otf)$/i.test(assetInfo.name || '')) {
                return 'fonts/[name].[hash][extname]'
              }
              if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(assetInfo.name || '')) {
                return 'images/[name].[hash][extname]'
              }
              return 'assets/[name].[hash][extname]'
            },
            // Optimize chunk splitting to reduce memory usage during build
            manualChunks(id) {
              if (id.includes('node_modules')) {
                // Split large vendor chunks
                if (id.includes('@ai-sdk') || id.includes('ai/')) {
                  return 'vendor-ai'
                }
                if (id.includes('@mantine') || id.includes('@tabler')) {
                  return 'vendor-ui'
                }
                if (id.includes('mermaid') || id.includes('d3')) {
                  return 'vendor-charts'
                }
              }
            },
          },
        },
      },
      css: {
        modules: {
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
        postcss: './postcss.config.cjs',
      },
      server: {
        port: 1212,
        strictPort: true,
      },
      define: {
        'process.type': '"renderer"',
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        'process.env.CHATBOX_BUILD_TARGET': JSON.stringify(process.env.CHATBOX_BUILD_TARGET || 'unknown'),
        'process.env.CHATBOX_BUILD_PLATFORM': JSON.stringify(process.env.CHATBOX_BUILD_PLATFORM || 'unknown'),
        'process.env.CHATBOX_BUILD_CHANNEL': JSON.stringify(process.env.CHATBOX_BUILD_CHANNEL || 'unknown'),
        'process.env.USE_LOCAL_API': JSON.stringify(process.env.USE_LOCAL_API || ''),
        'process.env.USE_BETA_API': JSON.stringify(process.env.USE_BETA_API || ''),
      },
      optimizeDeps: {
        include: ['mermaid'],
        esbuildOptions: {
          target: 'es2015',
        },
      },
    },
  }
})
