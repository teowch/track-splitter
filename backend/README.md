# Music Track Separator - Backend

The backend service for Music Track Separator, built with Flask. It handles file uploads, YouTube downloads, and audio source separation using Demucs.

## 🛠️ Tech Stack

- **Framework**: Flask
- **Audio Separation**: `demucs` (Hybrid Transformer Demucs)
- **YouTube Download**: `yt-dlp`
- **Audio Separation**: `demucs` (Hybrid Transformer Demucs)
- **YouTube Download**: `yt-dlp`
- **Audio Processing**: `soundfile`, `numpy`, `wave` (for unification)
- **CORS**: `flask-cors`

## ⚙️ Setup & Installation

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv .venv
   ```

3. **Activate the virtual environment:**
   - **Windows:** `.venv\Scripts\activate`
   - **macOS/Linux:** `source .venv/bin/activate`

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Install FFmpeg:**
   - FFmpeg is required for audio processing. Ensure it is installed and added to your system's PATH.

## ▶️ Running the Server

```bash
python api.py
```
The server will start on `http://localhost:5000`.

## 🔌 API Endpoints

### 🎵 Audio Processing

- **`GET /api/modules`**
    - List available processing modules.

- **`POST /api/process`**
    - Upload an audio file to process.
    - **Body**: `form-data` with `file`, `modules` (JSON string).

- **`POST /api/process-url`**
    - Download and process audio from a YouTube URL.
    - **Body**: JSON `{ "url": "...", "modules": [...] }`

- **`POST /api/unify`**
    - Combine selected stems into a new track.
    - **Body**: JSON `{ "id": "folder_id", "tracks": ["vocals.wav", "drums.wav"] }`
    - **Returns**: Name of the new unified track.

### 📂 File Access & History

- **`GET /api/history`**
    - List all processed tracks.

- **`GET /api/download/<folder_id>/<filename>`**
    - Download a specific stem file.

- **`GET /api/zip/<folder_id>`**
    - Download all stems for a track as a ZIP archive.

- **`POST /api/zip-selected`**
    - Download a partial ZIP containing specific stems.
    - **Body**: JSON `{ "id": "folder_id", "tracks": ["vocals.wav", "drums.wav"] }`

## 📁 Directory Structure

- **`api.py`**: Main application entry point and logic.
- **`uploads/`**: (Created at runtime) Stores temporary uploaded raw files.
- **`Library/`**: (Created at runtime) Stores processed audio stems, organized by timestamp and song title.
