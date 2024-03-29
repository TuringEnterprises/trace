<!-- README.md -->

# Trace - Screen Recorder

Welcome to Trace, the intuitive, cross-platform screen recording application that not only captures your screen but also records your clicks and keystrokes to provide a comprehensive viewing experience.

![screenshot](ss.png)

## Features

- Cross-Platform: Runs on Windows, macOS, and Linux.
- Screen Recording: Capture your entire screen.
- Clicks and Keystrokes: Records all mouse clicks and keystrokes alongside the video.
- Simple Interface: Start and stop recording with just a click of a button.

## Download and Installation

To get started with Trace, please visit the [Releases page](https://github.com/suraj-turing/trace/releases) on our GitHub repository.

Depending on your operating system, download the respective executable:

- For Windows: `Trace-Setup-x.x.x.exe`
- For macOS: `Trace-x.x.x.dmg`
- For Linux: `Trace_x.x.x_amd64.deb` for Debian-based distributions, and `Trace-x.x.x.x86_64.rpm` for Red Hat-based distributions.

After downloading the correct file for your operating system, run the installer or executable to install Trace on your machine.

## How to Use Trace

1. Open Trace.
2. Click on the "Choose a Video Source" button to select your video source.
3. Once the video source is selected, the "Start" button will be enabled.
4. Click "Start" to begin recording your screen.
5. Click "Stop" to end the recording. You will be prompted to choose a location to save your video file.
6. After saving the video, you will also be asked to save the keystroke log file for your session.

## Getting Started

Follow these instructions to get the project up and running on your local machine for development and testing.

### Prerequisites

- [Node.js](https://nodejs.org/)
- [Yarn](https://yarnpkg.com/)

### Environment Setup

Before running the application, set up the necessary environment variables:

1. Clone the repository
   ```
   git clone https://github.com/suraj-turing/trace.git
   cd trace
   ```
2. Create a `.env` file in the root directory of the project.
3. Add the following variables to the `.env` file (modify values as needed):
   ```plaintext
   BLOB_STORAGE_URL=your_blob_storage_url_here
   MODE=development or production  # development mode will skip uploading files to cloud storage.
   ```
   development mode will skip uploading files to cloud storage.
4. Run the application
    ```
    yarn install
    yarn start
    ```

## Contributing

Contributions to Trace are always welcome! If you would like to contribute, please fork the repository and submit a pull request, or open an issue with your ideas and suggestions.

## Support

If you encounter any issues or have any questions about using Trace, please file an issue on our GitHub repository.

Thank you for using Trace – Happy Recording!
