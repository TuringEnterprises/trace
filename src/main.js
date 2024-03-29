// src/main.js

const { app, BrowserWindow, ipcMain, Menu, desktopCapturer, dialog } = require('electron');
const ffmpeg = require('fluent-ffmpeg');
var ffmpegStatic = require('ffmpeg-static-electron');
ffmpeg.setFfmpegPath(ffmpegStatic.path.replace("app.asar", "app.asar.unpacked"));
const path = require('path');
const fs = require('fs');
const JSZip = require('jszip');
const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const Keylogger = require('./keylogger.js');
let keylogger;
const isDev = process.env.MODE === 'development';
const sasUrl = process.env.BLOB_STORAGE_URL;

if (require('electron-squirrel-startup')) {
  app.quit();
}

const logToFile = (message, error) => {
  const logFilePath = path.join(app.getPath('userData'), 'app.log');
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage);
  if (error)
    fs.appendFileSync(logFilePath, error);
  if (isDev)
    console.log(logMessage);
};

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
      x: 2560,
      y: 291,
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
	logToFile("SUCCESS : MAIN : APPLICATION_STARTUP : application started successfully")
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
    logToFile("ERROR : MAIN : context-menu > ", error);
    throw error;
  }
});

ipcMain.handle('get-video-sources', async () => {
  try {
    return await desktopCapturer.getSources({ types: ['screen'] });
  } catch (error) {
    logToFile("ERROR : MAIN : get-video-sources > ", error);
    throw error;
  }
});

ipcMain.on('start-keystrokes-logging', () => {
  keylogger = new Keylogger('/Users/suraj/Downloads/key-logs.txt');
  keylogger.startLogging();
});

ipcMain.handle('stop-keystrokes-logging', async (event) => {
  if (keylogger) {
    const logContent = keylogger.stopLogging();
    return { logContent, keyLogFileName: `${keylogger.startTime}-keystrokes.txt` };
  }
});

ipcMain.handle('save-keystrokes-file', async (event, logContent) => {
  if (keylogger) {
    const downloadsPath = app.getPath('downloads');
    const defaultPath = `${downloadsPath}/${keylogger.startTime}-keystrokes.txt`;
    const { filePath } = await dialog.showSaveDialog({
      buttonLabel: 'Save log',
      defaultPath: defaultPath,
    });
    if (filePath) {
      fs.writeFileSync(filePath, logContent);
    }
    const directoryPath = path.dirname(filePath);
    return { directoryPath };
  }
});

function remuxVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
          .output(outputPath)
          .videoFilters('setpts=N/FRAME_RATE/TB')
          .noAudio()
          .format('mp4')
          .on('end', () => {
              logToFile('Video remuxing completed.');
              resolve();
          })
          .on('error', (err) => {
              logToFile(`FFmpeg Error: ${err.message}`);
              if (err.stack) logToFile(`FFmpeg Stack: ${err.stack}`);
              reject(err);
          })
          .run();
  });
}

function convertVideoToMp4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
          .output(outputPath)
          .withVideoCodec('libx264')
          .noAudio()
          .addOptions([
              '-preset superfast',
              '-crf 35'
          ])
          .toFormat('mp4')
          .on('end', () => {
              logToFile('Video conversion to MP4 completed.');
              resolve();
          })
          .on('error', (err) => {
              logToFile(`FFmpeg Error: ${err.message}`);
              if (err.stack) logToFile(`FFmpeg Stack: ${err.stack}`);
              reject(err);
          })
          .run();
  });
}

ipcMain.handle('remux-video-file', async (event, uint8Array) => {
  let tempInputPath, tempOutputPath;
    try {
      const buffer = Buffer.from(uint8Array);
      const downloadsPath = app.getPath('downloads');
      tempInputPath = `${downloadsPath}/temp-input-${keylogger.startTime}-video.webm`;
      tempOutputPath = `${downloadsPath}/temp-output-${keylogger.startTime}-video.mp4`;
      fs.writeFileSync(tempInputPath, buffer);

      let videoFileName;
      const startTime = Date.now();
      await remuxVideo(tempInputPath, tempOutputPath);
      videoFileName = `${keylogger.startTime}-video.mp4`;
      const timeTakenToConvert = Date.now() - startTime;
      logToFile(`Video conversion took ${timeTakenToConvert/(1000)} seconds.`);
      fs.unlinkSync(tempInputPath);
      return { videoFileName, tempOutputPath };
    } catch (error) {
      logToFile(`Failed to remux the file, Error: ${JSON.stringify(error) || error}`);
      if (fs.existsSync(tempInputPath)) {
          fs.unlinkSync(tempInputPath);
      }
      if (fs.existsSync(tempOutputPath)) {
          fs.unlinkSync(tempOutputPath);
      }
      return `ERROR: check logs at ${path.join(app.getPath('userData'), 'app.log')}`;
    }
})

ipcMain.handle('save-video-file', async (e, videoFileName, tempOutputPath) => {
    try {
      const downloadsPath = app.getPath('downloads');
      let filePath = await dialog.showSaveDialog({
        title: 'Save Recorded Video',
        defaultPath: `${downloadsPath}/${videoFileName}`,
        filters: [{ name: 'MP4', extensions: ['mp4'] }]
      });

      if (!filePath.canceled && filePath.filePath) {
        fs.renameSync(tempOutputPath, filePath.filePath);
        return filePath.filePath;
      } else {
        fs.unlinkSync(tempOutputPath);
        return null;
      }
    } catch (error) {
      logToFile(`Failed to save the video file, Error: ${JSON.stringify(error) || error}`);
      if (fs.existsSync(tempOutputPath)) {
        fs.unlinkSync(tempOutputPath);
      }
      return `ERROR: check logs at ${path.join(app.getPath('userData'), 'app.log')}`;
    }
});

ipcMain.handle('discard-video-file', async (e, filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logToFile('Video file discarded.', filePath);
      }
    } catch (error) {
      logToFile(`Failed to discard the video file, Error: ${JSON.stringify(error) || error}`);
      return `ERROR: check logs at ${path.join(app.getPath('userData'), 'app.log')}`;
    }
});

const uploadZipFile = async (content) => {
  console.log('Uploading zip file...');
  if (isDev) {
    return await new Promise(resolve => {
      setTimeout(() => {
        resolve(JSON.stringify({ status: 'Uploaded', zipFileName: '8c3862ee-56c6-4403-b16d-eb8181302a43.zip' }));
      }, 3000);
    });
  } else {
      if (!sasUrl) throw new Error('Missing BLOB_STORAGE_URL environment variable');

      const blobServiceClient = new BlobServiceClient(sasUrl);
      const containerClient = blobServiceClient.getContainerClient('turing-videos');
      const blobName = `${uuidv4()}.zip`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.uploadData(content);

      console.log('Upload complete:', blobName);
      return JSON.stringify({ status: 'Uploaded', zipFileName: blobName });
  }
}

ipcMain.handle('upload-zip-file', async (e, videoFilePath, logFilePath) => {
  try {
    const zip = new JSZip();
    zip.file(path.basename(videoFilePath), fs.readFileSync(videoFilePath));
    zip.file(path.basename(logFilePath), fs.readFileSync(logFilePath));
    const content = await zip.generateAsync({type: "nodebuffer"});
    const uploadResponse = await uploadZipFile(content);
    return uploadResponse;
  } catch (error) {
    logToFile(`Failed to upload the zip file, Error: ${JSON.stringify(error) || error}`);
    return `ERROR: check logs at ${path.join(app.getPath('userData'), 'app.log')}`;
  }
})
