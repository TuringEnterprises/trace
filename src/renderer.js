// src/renderer.js

const startButton = document.getElementById('startButton')
const stopButton = document.getElementById('stopButton')
const videoSelectBtn = document.getElementById('videoSelectBtn')

async function openContextMenu(sources) {
  try {
    await window.electronAPI.invokeContextMenu(JSON.stringify(sources));
  } catch (error) {
    console.log("ERROR : RENDERER : openContextMenu > ", error);
    throw error;
  }
}

async function fetchVideoSources() {
  try {
    return await window.electronAPI.getVideoSources();
  } catch (error) {
    console.log("ERROR : RENDERER : fetchVideoSources > ", error);
    throw error;
  }
}

videoSelectBtn.addEventListener('click', async () => {
  const sources = await fetchVideoSources();
  console.log("SUCCESS : RENDERER : getVideoSources > ", JSON.stringify(sources));
  await openContextMenu(sources);
})

const playVideo = async (source) => {
  try {
    videoSelectBtn.textContent = source.name
    
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id
        }
      }
    });
    const videoElement = document.querySelector('video')
    videoElement.srcObject = stream
    videoElement.play()
    const startButton = document.querySelector('#startButton')
    startButton.disabled = false
    const videoPlaceholder = document.getElementById('videoPlaceholder');
    videoElement.classList.remove('hidden');
    videoPlaceholder.classList.add('hidden');
  } catch (error) {
    console.log("ERROR : RENDERER : playVideo > ", error);
    throw error;
  }
}

window.electronAPI.selectSource(async (event, value) => {
  const source = value
  console.log("SUCCESS : RENDERER : selectSource callback : selected source > ", source);
  await playVideo(source);
  console.log("SUCCESS : RENDERER : playVideo > ", source);
  enableButton(startButton);
})

let mediaRecorder;
let recordedChunks = [];
let recordingStartTime;
let intervalId;

function formatTime(time) {
  return time.toString().padStart(2, '0');
}

function updateRecordingTime() {
  const elapsedTime = Date.now() - recordingStartTime;
  const seconds = Math.floor((elapsedTime / 1000) % 60);
  const minutes = Math.floor((elapsedTime / (1000 * 60)) % 60);
  const hours = Math.floor((elapsedTime / (1000 * 60 * 60)));

  const hoursStr = formatTime(hours);
  const minutesStr = formatTime(minutes);
  const secondsStr = formatTime(seconds);

  document.getElementById('recordingTime').textContent = `${hoursStr}:${minutesStr}:${secondsStr}`;
}

let videoFileName, tempOutputPath;
const recordVideo = async () => {
  const videoElement = document.querySelector('video');
  const stream = videoElement.srcObject;

  if (!stream) {
    console.error('No stream found to record.');
    return;
  }

  const options = {
    mimeType: 'video/webm; codecs=H264',
    bitsPerSecond: 3000000
  };
  mediaRecorder = new MediaRecorder(stream, options);

  mediaRecorder.ondataavailable = event => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    clearInterval(intervalId);
    document.getElementById('recordingTime').textContent = '00:00:00';
    document.querySelector('.recording-dot').classList.remove('is-recording');  

    console.log('mediaRecorder stopped');
    show('loadingOverlay');
    hide('main');
    const blob = new Blob(recordedChunks, { type: 'video/webm; codecs=H264' });
    const arrayBuffer = await blob.arrayBuffer();
    const { logContent, keyLogFileName } = await electronAPI.stopKeystrokesLogging();
    const res = await electronAPI.remuxVideoFile(new Uint8Array(arrayBuffer));
    videoFileName = res.videoFileName;
    tempOutputPath = res.tempOutputPath;
    hide('loadingOverlay');

    displayFileOptions(logContent, keyLogFileName, videoFileName, tempOutputPath);

    recordedChunks = [];
  };
  
  recordingStartTime = Date.now();
  intervalId = setInterval(updateRecordingTime, 1000);
  document.querySelector('.recording-dot').classList.add('is-recording');
  electronAPI.startKeystrokesLogging();
  mediaRecorder.start();
};

startButton.addEventListener('click', async () => {
  console.log("SUCCESS : RENDERER : startButton > clicked");
  const stopButton = document.querySelector('#stopButton')
  enableButton(stopButton)
  disableButton(startButton)
  disableButton(videoSelectBtn);
  await recordVideo()
})

function show (e) {
  document.getElementById(e).classList.remove('hidden');
}

function hide (e) {
  document.getElementById(e).classList.add('hidden');
}

stopButton.addEventListener('click', async () => {
  console.log("SUCCESS : RENDERER : stopButton > clicked");
  const stopButton = document.querySelector('#stopButton')
  enableButton(startButton)
  enableButton(videoSelectBtn);
  disableButton(stopButton)

  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    console.log("Recording stopped");
  }
})

function disableButton(button) {
  button.disabled = true;
  button.classList.add('opacity-50', 'cursor-not-allowed');
}

function enableButton(button) {
  button.disabled = false;
  button.classList.remove('opacity-50', 'cursor-not-allowed');
}

let videoFileProcessed = false;
let logFileProcessed = false;

function checkFilesProcessed() {
  if (videoFileProcessed && logFileProcessed) {
    hide('fileOptions');
    show('main');
    videoFileProcessed = false;
    logFileProcessed = false;
  }
}

function displayFileOptions(logContent, keyLogFileName, videoFileName, tempOutputPath) {
  const fileOptionsDiv = document.getElementById('fileOptions');
  fileOptionsDiv.innerHTML = `
    <div class="flex flex-col justify-center items-center">
      <div class="flex items-center justify-between w-full max-w-xl rounded-lg border-[1px] border-indigo-600 m-4 mt-12 p-4">
        <span class="text-l ml-3">${videoFileName}</span>
        <div class="flex items-center">
          <button id="saveVideoBtn" class="bg-indigo-600 rounded-md px-4 py-3 text-white mx-3">Save</button>
          <button id="discardVideoBtn" class="bg-red-600 rounded-md px-4 py-3 text-white mx-3">Discard</button>
        </div>
      </div>
      <div class="flex items-center justify-between w-full max-w-xl rounded-lg border-[1px] border-indigo-600 m-4 p-4">
        <span class="text-l ml-3">${keyLogFileName}</span>
        <div class="flex items-center">
          <button id="saveLogBtn" class="bg-indigo-600 rounded-md px-4 py-3 text-white mx-3">Save</button>
          <button id="discardLogBtn" class="bg-red-600 rounded-md px-4 py-3 text-white mx-3">Discard</button>
        </div>
      </div>
    </div>
  `;
  show('fileOptions');

  document.getElementById('saveVideoBtn').addEventListener('click', () => {
    if (!videoFileProcessed) {
      electronAPI.saveVideoFile(videoFileName, tempOutputPath).then(() => {
        videoFileProcessed = true;
        disableButton(document.getElementById('saveVideoBtn'));
        disableButton(document.getElementById('discardVideoBtn'));
        checkFilesProcessed();
      })
    }
  });
  document.getElementById('discardVideoBtn').addEventListener('click', () => {
    if (!videoFileProcessed) {
      electronAPI.discardVideoFile(tempOutputPath).then(() => {
        videoFileProcessed = true;
        disableButton(document.getElementById('saveVideoBtn'));
        disableButton(document.getElementById('discardVideoBtn'));
        checkFilesProcessed();
      })
    }
  });
  document.getElementById('saveLogBtn').addEventListener('click', () => {
    if (!logFileProcessed) {
      electronAPI.saveKeystrokesFile(logContent).then(() => {
        logFileProcessed = true;
        disableButton(document.getElementById('saveLogBtn'));
        disableButton(document.getElementById('discardLogBtn'));
        checkFilesProcessed();
      })
    }
  });
  document.getElementById('discardLogBtn').addEventListener('click', () => {
    logFileProcessed = true;
    disableButton(document.getElementById('saveLogBtn'));
    disableButton(document.getElementById('discardLogBtn'));
    checkFilesProcessed();
  })
}

document.getElementById('uploadButton').addEventListener('click', () => {
  document.getElementById('mp4FileName').textContent = '';
  document.getElementById('logFileName').textContent =  '';
  document.getElementById('mp4FileInput').value = '';
  document.getElementById('logFileInput').value = '';
  document.getElementById('uploadOverlay').classList.remove('hidden');
});

document.getElementById('uploadOverlay').addEventListener('click', function(event) {
  if (!document.getElementById('uploadLoadingOverlay').classList.contains('hidden')) {
      return;
  }

  if (event.target === this) {
      this.classList.add('hidden');
      if (!document.getElementById('uploadSuccessOverlay').classList.contains('hidden')) {
          document.getElementById('uploadSuccessOverlay').classList.add('hidden');
      }
      document.getElementById('uploadModal').classList.remove('hidden');
  }
});

document.getElementById('mp4FileInput').addEventListener('change', function() {
  const fileNameSpan = document.getElementById('mp4FileName');
  fileNameSpan.textContent = this.files[0] ? this.files[0].name : '';
});

document.getElementById('logFileInput').addEventListener('change', function() {
  const fileNameSpan = document.getElementById('logFileName');
  fileNameSpan.textContent = this.files[0] ? this.files[0].name : '';
});

document.getElementById('startUploadBtn').addEventListener('click', async () => {
  const mp4File = document.getElementById('mp4FileInput').files[0];
  const logFile = document.getElementById('logFileInput').files[0];

  if (!mp4File || !logFile) {
      alert('Please select both MP4 and TXT files');
      return;
  }

  if (mp4File.type !== 'video/mp4' || logFile.type !== 'text/plain') {
      alert('Invalid file format. Please upload a MP4 video and a TXT file.');
      return;
  }

  document.getElementById('uploadModal').classList.add('hidden');
  document.getElementById('uploadLoadingOverlay').classList.remove('hidden');

  try {
      const res = JSON.parse(await electronAPI.uploadFiles(mp4File.path, logFile.path));
      if (res.status === 'Uploaded') {
        document.getElementById('zipFileName').innerText = `${res.zipFileName}`;
        document.getElementById('uploadLoadingOverlay').classList.add('hidden');
        document.getElementById('uploadSuccessOverlay').classList.remove('hidden');
      } else {
        document.getElementById('uploadLoadingOverlay').classList.add('hidden');
        document.getElementById('uploadOverlay').classList.add('hidden');
        alert('Failed to upload files.');
      }
  } catch (error) {
      console.error('Error during file upload:', error);
      document.getElementById('uploadLoadingOverlay').classList.add('hidden');
      document.getElementById('uploadModal').classList.remove('hidden');
      document.getElementById('uploadOverlay').classList.add('hidden');
      alert('Failed to upload files. Please try uploading again after some time.');
  }
});
