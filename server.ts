import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Proxy API for 30S Lottery History
  app.get("/api/history/30s", async (req, res) => {
    try {
      const response = await fetch('https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json');
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Proxy 30S Error:", error);
      res.status(500).json({ error: "Failed to fetch 30S history" });
    }
  });

  // Proxy API for 1M Lottery History
  app.get("/api/history/1m", async (req, res) => {
    try {
      const response = await fetch('https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json');
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Proxy 1M Error:", error);
      res.status(500).json({ error: "Failed to fetch 1M history" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
