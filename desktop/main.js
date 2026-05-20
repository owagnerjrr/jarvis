import { app, BrowserWindow, shell } from "electron";

let mainWindow;
let stopServer;

async function createWindow() {
  process.env.JARVIS_DATA_DIR = app.getPath("userData");
  const serverModule = await import("../server.js");
  stopServer = serverModule.stopServer;
  const { startServer } = serverModule;
  const { port } = await startServer({ host: "127.0.0.1", port: process.env.PORT || 5185 });

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 920,
    minHeight: 620,
    backgroundColor: "#101418",
    title: "Jarvis",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  if (stopServer) await stopServer();
});
