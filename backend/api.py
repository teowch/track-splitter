import os
import sys
import shutil
import zipfile
import wave
import json
import uuid
import threading
from datetime import datetime
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import numpy as np
import soundfile as sf

import static_ffmpeg
static_ffmpeg.add_paths()

# Import AudioProcessor
from AudioProcessor import AudioProcessor

app = Flask(__name__)
CORS(app)

# ==========================================
# CONSTANTS & CONFIG
# ==========================================
# ==========================================
# CONSTANTS & CONFIG
# ==========================================
# Use "Library" folder at the project root (level up from backend if running from backend)
# The user wants "Library" on root. 
# Current working directory when running `python api.py` is usually `e:\dev\track-splitter\backend`
# So project root is `..`.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
# However, if user runs from root, we need to be careful.
# Let's assume Library is sibling to backend folder structure-wise or just at project root.
# Construct path relative to this file to be safe.
LIBRARY_FOLDER = os.path.join(PROJECT_ROOT, 'Library')

UPLOAD_FOLDER = os.path.abspath('uploads')
# OUTPUT_FOLDER is now LIBRARY_FOLDER for history scanning
OUTPUT_FOLDER = LIBRARY_FOLDER 

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ==========================================
# IN-MEMORY STATE (Session History)
# ==========================================
# Maps folder_id -> { 'path': absolute_path_to_temp_dir, 'metadata': track_data_obj }
TRACK_SESSIONS = {}
SESSION_HISTORY = []

# ==========================================
# HELPER FUNCTIONS
# ==========================================

def load_history_from_disk():
    """Scans OUTPUT_FOLDER (Library) and populates SESSION_HISTORY and TRACK_SESSIONS."""
    print(f"Scanning for existing history in {OUTPUT_FOLDER}...")
    if not os.path.exists(OUTPUT_FOLDER):
        return

    # Clear existing to avoid duplicates if called multiple times (though mainly for startup)
    global SESSION_HISTORY
    SESSION_HISTORY = []
    
    found_folders = []
    for folder_name in os.listdir(OUTPUT_FOLDER):
        folder_path = os.path.join(OUTPUT_FOLDER, folder_name)
        if os.path.isdir(folder_path):
            try:
                # Expecting format: YYYYMMDD_HHMMSS_Name
                parts = folder_name.split('_', 2)
                if len(parts) < 2: continue # Skip invalid folders
                
                timestamp_str = f"{parts[0]}_{parts[1]}"
                original_name = parts[2] if len(parts) > 2 else folder_name
                
                # Scan stems
                stems_list = []
                original_file = None
                
                # Let's list all audio files
                all_audio = []
                for f in os.listdir(folder_path):
                    if f.endswith('.wav') or f.endswith('.mp3') or f.endswith('.flac'):
                        all_audio.append(f)
                
                # Try to find original
                for f in all_audio:
                    # If filename matches the folder suffix roughly
                    if os.path.splitext(f)[0] == original_name:
                         original_file = f
                    elif secure_filename(os.path.splitext(f)[0]) == original_name:
                         original_file = f
                
                # Populate stems list
                for f in all_audio:
                    if f == original_file: continue
                    stems_list.append(f)
                
                stems_list = sorted(stems_list)
                
                track_data = {
                    'id': folder_name,
                    'name': original_name,
                    'date': timestamp_str,
                    'stems': stems_list,
                }
                if original_file:
                    track_data['original'] = original_file

                found_folders.append(track_data)
                
                # Register in TRACK_SESSIONS so downloads work
                TRACK_SESSIONS[folder_name] = {
                    'path': folder_path,
                    'original': original_file
                }
                
            except Exception as e:
                print(f"Error loading {folder_name}: {e}")
                continue

    # Sort by date desc
    found_folders.sort(key=lambda x: x['id'], reverse=True)
    SESSION_HISTORY.extend(found_folders)
    print(f"Loaded {len(found_folders)} tracks from disk.")

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in {'wav', 'mp3', 'ogg', 'flac'}

def get_track_data(folder_id, name, timestamp, absolute_path):
    """
    Constructs the track object expected by the frontend.
    Scans the directory to find current stems.
    """
    stems = []
    original_file = None
    
    if os.path.exists(absolute_path):
        for f in os.listdir(absolute_path):
            if f.endswith('.wav') or f.endswith('.mp3'):
                # Try to identify original
                # In AudioProcessor, inputs are not necessarily copied to output unless we do it.
                # But we should handle 'original' logic.
                
                # Check if this file is the original
                # Heuristic: matches name? 
                
                # We will explicitly track original filename in metadata if possible.
                # For now, just list everything.
                stems.append({
                    'name': f,
                    'url': f'/api/download/{folder_id}/{f}'
                })
    
    # Sort stems
    stems.sort(key=lambda x: x['name'])
    
    return {
        'id': folder_id,
        'name': name,
        'date': timestamp,
        'stems': stems,
        # 'original': ... # We need to handle original file tracking
    }

def sort_stems(stems):
    # Basic sorting
    return sorted(stems, key=lambda x: x['name'])

# ==========================================
# ROUTES
# ==========================================

@app.route('/api/history', methods=['GET'])
def list_history():
    # Return the in-memory history list
    return jsonify(SESSION_HISTORY)

@app.route('/api/separate', methods=['POST'])
def separate_audio():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if file and allowed_file(file.filename):
        try:
            filename = secure_filename(file.filename)
            temp_input_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(temp_input_path)
            
            # Prepare Output Folder in Library
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename_no_ext = os.path.splitext(filename)[0]
            folder_id = f"{timestamp}_{filename_no_ext}" 
            output_dir = os.path.join(LIBRARY_FOLDER, folder_id)

            # Initialize AudioProcessor with specific output dir
            processor = AudioProcessor(temp_input_path, output_dir=output_dir)
            
            # Run Enriched Separation Logic
            # 1. Vocals vs Instrumental
            processor.extract_vocals_instrumental()
            
            # 2. Lead vs Backing (requires vocals)
            processor.extract_lead_backing()
            
            # 3. Instruments (Demucs)
            processor.extract_instruments()
            
            # Post-Processing:
            # We need to ensure the 'original' file is also in the output folder
            shutil.copy(temp_input_path, os.path.join(processor.output_folder, filename))
            
            # Clean up upload input
            try:
                os.remove(temp_input_path)
            except:
                pass

            # Register in Session
            TRACK_SESSIONS[folder_id] = {
                'path': processor.output_folder,
                'original': filename
            }
            
            # Scan for stems
            stems_list = []
            for f in os.listdir(processor.output_folder):
                if f == filename: continue # valid original
                if f.endswith('.wav') or f.endswith('.mp3') or f.endswith('.flac'):
                    stems_list.append(f)
            
            stems_list = sorted(stems_list)
            
            track_data = {
                'id': folder_id,
                'name': filename_no_ext, # Display name
                'date': timestamp,
                'stems': stems_list,
                'original': filename
            }
            
            # Prepend to history
            SESSION_HISTORY.insert(0, track_data)
            
            resp_stems = [{'name': s, 'url': f'/api/download/{folder_id}/{s}'} for s in stems_list]

            return jsonify({
                'message': 'Separation successful',
                'id': folder_id,
                'stems': resp_stems 
            })

        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500
            
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/separate-url', methods=['POST'])
def separate_url():
    data = request.json
    url = data.get('url')
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
        
    try:
        # 1. Download (Reuse logic from app.py)
        import yt_dlp
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(UPLOAD_FOLDER, '%(title)s.%(ext)s'),
            'postprocessors': [{'key': 'FFmpegExtractAudio','preferredcodec': 'mp3','preferredquality': '192'}],
            'prefer_ffmpeg': True,
            'keepvideo': False,
            'quiet': True
        }
        
        filename = None
        downloaded_filepath = None
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            temp_name = ydl.prepare_filename(info)
            base, _ = os.path.splitext(temp_name)
            downloaded_filepath = base + ".mp3"
            filename = os.path.basename(downloaded_filepath)

        if not os.path.exists(downloaded_filepath):
             return jsonify({'error': 'Download failed'}), 500

        # Prepare Output Folder in Library
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename_no_ext = os.path.splitext(filename)[0]
        folder_id = f"{timestamp}_{secure_filename(filename_no_ext)}"
        output_dir = os.path.join(LIBRARY_FOLDER, folder_id)

        # 2. Process
        processor = AudioProcessor(downloaded_filepath, output_dir=output_dir)
        processor.extract_vocals_instrumental()
        processor.extract_lead_backing()
        processor.extract_instruments()
        
        # Copy original
        shutil.copy(downloaded_filepath, os.path.join(processor.output_folder, filename))
        
        # Cleanup upload
        try: os.remove(downloaded_filepath)
        except: pass

        # 3. Register Session
        TRACK_SESSIONS[folder_id] = {
            'path': processor.output_folder,
            'original': filename
        }
        
        stems_list = []
        for f in os.listdir(processor.output_folder):
            if f == filename: continue
            if f.endswith('.wav') or f.endswith('.mp3') or f.endswith('.flac'):
                stems_list.append(f)
        
        stems_list = sorted(stems_list)
        
        track_data = {
            'id': folder_id,
            'name': filename_no_ext,
            'date': timestamp,
            'stems': stems_list,
            'original': filename
        }
        
        SESSION_HISTORY.insert(0, track_data)
        
        resp_stems = [{'name': s, 'url': f'/api/download/{folder_id}/{s}'} for s in stems_list]
        
        return jsonify({
            'message': 'Separation successful',
            'id': folder_id,
            'stems': resp_stems
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/<folder_id>/<filename>', methods=['GET'])
def download_file(folder_id, filename):
    if folder_id not in TRACK_SESSIONS:
        # Check if it exists on disk even if not in memory (e.g. after restart)
        # Should have been loaded by load_history_from_disk
        return jsonify({'error': 'Track session expired or not found'}), 404
    
    directory = TRACK_SESSIONS[folder_id]['path']
    return send_from_directory(directory, filename, as_attachment=True)

@app.route('/api/unify', methods=['POST'])
def unify_tracks():
    data = request.json
    folder_id = data.get('id')
    track_names = data.get('tracks')

    if not folder_id or not track_names:
        return jsonify({'error': 'Missing data'}), 400
        
    if folder_id not in TRACK_SESSIONS:
        return jsonify({'error': 'Session not found'}), 404
        
    directory = TRACK_SESSIONS[folder_id]['path']
    
    # --- UNIFY LOGIC (SoundFile) ---
    try:
        data_list = []
        sr = None
        
        # 1. Read all files (supports FLAC, WAV, etc.)
        for p in inputs:
            try:
                data, samplerate = sf.read(p)
                
                if sr is None: 
                    sr = samplerate
                elif sr != samplerate: 
                    return jsonify({'error': f'Sample rate mismatch: {os.path.basename(p)} is {samplerate}, expected {sr}'}), 400
                
                # Normalize shapes: ensure (N, channels)
                if data.ndim == 1:
                    data = data[:, np.newaxis]
                    
                data_list.append(data)
            except Exception as e:
                return jsonify({'error': f"Failed to read {os.path.basename(p)}: {str(e)}"}), 400

        if not data_list: 
             return jsonify({'error': 'No audio data read'}), 500

        # 2. Mix
        # Determine max length and max channels
        max_len = max(len(d) for d in data_list)
        max_ch = max(d.shape[1] for d in data_list)
        
        # Initialize accumulator
        mixed = np.zeros((max_len, max_ch), dtype=np.float32)
        
        for d in data_list:
            length, channels = d.shape
            
            # Expand channels if mono->stereo
            if channels == 1 and max_ch > 1:
                d = np.tile(d, (1, max_ch))
            elif channels != max_ch:
                return jsonify({'error': 'Channel mismatch (non-mono)'}), 400
            
            # Add to mix
            mixed[:length, :] += d

        # 3. Clip to avoid distortion (Soft clip or Hard clip?)
        # Simple hard clip to starts with
        mixed = np.clip(mixed, -1.0, 1.0)
        
        # 4. Write output (WAV or FLAC based on extension, typically .wav here)
        sf.write(output_path, mixed, sr)

        # Update History Item stems list
        for item in SESSION_HISTORY:
            if item['id'] == folder_id:
                exists = False
                for s in item['stems']:
                    if s == new_stem_name: exists = True
                if not exists:
                    item['stems'].append(new_stem_name)
                    item['stems'] = sorted(item['stems'])
                break

        return jsonify({'message': 'Unify successful', 'new_track': new_stem_name})

    except Exception as e:
        if os.path.exists(output_path):
             try: os.remove(output_path)
             except: pass
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/zip/<folder_id>', methods=['GET'])
def download_zip(folder_id):
    if folder_id not in TRACK_SESSIONS:
        return jsonify({'error': 'Session not found'}), 404
    
    directory = TRACK_SESSIONS[folder_id]['path']
    zip_filename = f"{folder_id}.zip"
    zip_path = os.path.join(UPLOAD_FOLDER, zip_filename)
    
    try:
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for root, dirs, files in os.walk(directory):
                for file in files:
                    zipf.write(os.path.join(root, file), file)
        return send_file(zip_path, as_attachment=True)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/zip-selected', methods=['POST'])
def download_zip_selected():
    data = request.json
    folder_id = data.get('id')
    track_names = data.get('tracks')
    
    if not folder_id or not track_names: return jsonify({'error': 'Missing data'}), 400
    if folder_id not in TRACK_SESSIONS: return jsonify({'error': 'Session not found'}), 404
    
    directory = TRACK_SESSIONS[folder_id]['path']
    zip_filename = f"{folder_id}_selected.zip"
    zip_path = os.path.join(UPLOAD_FOLDER, zip_filename)
    
    try:
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for name in track_names:
                p = os.path.join(directory, name)
                if os.path.exists(p):
                    zipf.write(p, name)
        return send_file(zip_path, as_attachment=True)
    except Exception as e:
         return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    load_history_from_disk()
    port = 5000
    print(f"Starting API on port {port}...")
    app.run(debug=True, port=port)
