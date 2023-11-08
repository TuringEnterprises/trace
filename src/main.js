const { app, BrowserWindow, ipcMain, Menu, desktopCapturer, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegStatic);
require('dotenv').config();
const isDev = process.env.MODE === 'development'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;
const iconExtension = process.platform === 'win32' ? 'ico' : (process.platform === 'darwin' ? 'icns' : 'png');
let iconPath = path.join(__dirname, `assets/icons/icon.${iconExtension}`);
let preloadPath = path.join(__dirname, 'preload.js');
const createWindow = () => {
  if (!isDev) {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 1000,
      icon: iconPath,
      webPreferences: {
        preload: preloadPath
      },
    });   
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  } else {
    mainWindow = new BrowserWindow({
      x: 2560, // for local devt
      y: 291, // for local devt
      width: 1200,
      height: 1000,
      icon: iconPath,
      webPreferences: {
        preload: preloadPath
      }
    })
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.webContents.openDevTools();
  }
};

app.whenReady().then(() => {
  createWindow()
	console.log("SUCCESS : MAIN : APPLICATION_STARTUP : application started successfully")
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('context-menu', async (event, sources) => {
  try {
    const template = JSON.parse(sources).map((item) => ({
      label: item.name.length > 30 ? item.name.slice(0, 30) + '...' : item.name,
      click: () => mainWindow.webContents.send('select-source', item)
    }));
    const contextMenu = Menu.buildFromTemplate(template);
    contextMenu.popup();
  } catch (error) {
    console.log("ERROR : MAIN : context-menu > ", error);
    throw error;
  }
});

ipcMain.handle('get-video-sources', async () => {
  try {
    return await desktopCapturer.getSources({ types: ['screen'] });
  } catch (error) {
    console.log("ERROR : MAIN : get-video-sources > ", error);
    throw error;
  }
});

ipcMain.handle('convert-video', async (event, buffer) => {
  return new Promise((resolve, reject) => {
    const tempFilePath = path.join(app.getPath('temp'), 'temp-video.webm');
    fs.writeFileSync(tempFilePath, Buffer.from(buffer));

    // Convert the file first
    const convertedTempPath = path.join(app.getPath('temp'), `converted-${new Date().getTime()}.mp4`);

    ffmpeg(tempFilePath)
      .outputFormat('mp4')
      .videoCodec('libx264')
      .audioCodec('aac')
      .save(convertedTempPath)
      .on('end', async () => {
        console.log('File has been converted successfully');

        // After conversion, ask the user where to save the file
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { // mainWindow is your BrowserWindow instance
          title: 'Save your recorded video',
          defaultPath: `recorded-video-${new Date().getTime()}.mp4`,
          buttonLabel: 'Save Video',
          filters: [
            { name: 'Movies', extensions: ['mp4'] }
          ]
        });

        // If the user cancels, or doesn't provide a filePath, clean up the temp file
        if (canceled || !filePath) {
          fs.unlinkSync(convertedTempPath); // Remove the converted file from temp
          reject(new Error('Save dialog was cancelled.'));
        } else {
          // If they choose a location, move the temp file to the chosen location
          fs.renameSync(convertedTempPath, filePath);
          resolve(filePath);
        }
        
        fs.unlinkSync(tempFilePath); // Clean up the original temp file
      })
      .on('error', (err) => {
        console.error('An error occurred: ' + err.message);
        fs.unlinkSync(tempFilePath); // Clean up the original temp file
        fs.unlinkSync(convertedTempPath); // Remove the converted file from temp
        reject(err);
      });
  });
});
