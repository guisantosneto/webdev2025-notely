const { app, BrowserWindow } = require('electron');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false
        }
    });

    // Carrega a sua aplicação que está a correr na porta 3000
    win.loadURL('http://localhost:3000');
}

app.whenReady().then(createWindow);