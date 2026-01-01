import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/lachmajun_cards/",
  plugins: [react()],
  server: {
    proxy: {
      // ✅ what the React app calls in DEV:
      "/api": {
        target: "https://dilen-digital.co.il",
        changeOrigin: true,
        secure: true,
        // ✅ IMPORTANT: rewrite "/api/..." -> "/lachmajun_cards/lachmajun/projects/..."
        rewrite: (path) => path.replace(/^\/api/, "/lachmajun_cards/projects/"),
      },
    },
  },
});
// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react";

// export default defineConfig({
//   base: "/lachmajun_cards/",
//   plugins: [react()],
// });
