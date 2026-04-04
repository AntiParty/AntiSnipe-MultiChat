// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve("src/shared")
      }
    },
    build: {
      outDir: "out/main",
      rollupOptions: {
        input: {
          index: resolve("src/main/index.ts")
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve("src/shared")
      }
    },
    build: {
      outDir: "out/preload",
      rollupOptions: {
        input: {
          index: resolve("src/main/preload.ts")
        }
      }
    }
  },
  renderer: {
    root: "src/renderer",
    plugins: [react(), tsconfigPaths()],
    resolve: {
      alias: {
        "@": resolve("src/renderer"),
        "@shared": resolve("src/shared")
      }
    },
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: {
          index: resolve("src/renderer/index.html")
        }
      }
    },
    css: {
      modules: {
        localsConvention: "camelCase"
      }
    }
  }
});
export {
  electron_vite_config_default as default
};
