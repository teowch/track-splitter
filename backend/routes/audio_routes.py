from flask import Blueprint, jsonify, request
from services.container import audio_service, project_service, file_service
from modules import MODULE_REGISTRY, validate_modules
from werkzeug.utils import secure_filename
import os
from datetime import datetime

audio_bp = Blueprint('audio', __name__)

# Re-expose MODULE_REGISTRY map as alias WORKFLOW_MAP for compatibility if needed
WORKFLOW_MAP = MODULE_REGISTRY

@audio_bp.route('/modules', methods=['GET'])
def get_modules():
    modules = []
    for module_id, config in MODULE_REGISTRY.items():
        modules.append({
            'id': module_id,
            'description': config.get('description', ''),
            'category': config.get('category', 'Uncategorized'),
            'depends_on': config.get('depends_on')
        })
    return jsonify({'modules': modules}), 200

@audio_bp.route('/process', methods=['POST'])
def process_audio():
    import json
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    modules_json = request.form.get('modules')
    if not modules_json:
        return jsonify({'error': 'modules field is required'}), 400
        
    try:
        modules_to_run = json.loads(modules_json)
    except:
        return jsonify({'error': 'modules must be valid JSON'}), 400
        
    invalid = validate_modules(modules_to_run)
    if invalid:
        return jsonify({'error': f'Invalid modules: {invalid}'}), 400

    filename = secure_filename(file.filename)
    filename_no_ext = os.path.splitext(filename)[0]
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    folder_id = f"{timestamp}_{filename_no_ext[0:2]}" 
    
    # Create folder and save file
    # We must do this before calling AudioService because AudioService expects file to exist?
    # Actually AudioService logic in 'process_separation' expects the file in the project folder.
    
    output_folder = project_service.create_project_folder(folder_id)
    original_path = os.path.join(output_folder, filename)
    file.save(original_path)
    
    try:
        result = audio_service.process_separation(folder_id, filename, modules_to_run)
        return jsonify(result), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@audio_bp.route('/process-url', methods=['POST'])
def process_url():
    data = request.json
    url = data.get('url')
    modules_to_run = data.get('modules', [])
    
    if not url: return jsonify({'error': 'No URL provided'}), 400
    if not modules_to_run: return jsonify({'error': 'modules required'}), 400
    
    # Validations...
    
    try:
        import yt_dlp
        
        # We need a temp folder for download before moving to project folder, 
        # OR we create project folder after download.
        # Let's use upload folder from FileService as temp
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(file_service.upload_folder, '%(title)s.%(ext)s'),
            'postprocessors': [{'key': 'FFmpegExtractAudio','preferredcodec': 'wav','preferredquality': '192'}],
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
            downloaded_filepath = base + ".wav" 
            filename = os.path.basename(downloaded_filepath)

        if not os.path.exists(downloaded_filepath):
             return jsonify({'error': 'Download failed'}), 500

        # Create Project
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename_no_ext = os.path.splitext(filename)[0]
        folder_id = f"{timestamp}_{filename_no_ext[0:2]}"
        
        output_folder = project_service.create_project_folder(folder_id)
        persistent_filepath = os.path.join(output_folder, filename)
        
        import shutil
        shutil.move(downloaded_filepath, persistent_filepath)
        
        result = audio_service.process_separation(folder_id, filename, modules_to_run)
        return jsonify(result), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@audio_bp.route('/project/<project_id>/run-modules', methods=['POST'])
def run_additional_modules(project_id):
    data = request.json
    modules_to_run = data.get('modules', [])
    
    project_path = project_service.get_project_path(project_id)
    if not project_path:
        return jsonify({'error': 'Project not found'}), 404
        
    project_metadata = project_service.get_project_metadata(project_id)
    if not project_metadata:
         # Try to recover if disk exists but memory doesn't? ProjectService should handle?
         # ProjectService.get_project_metadata relies on memory scan.
         pass
         
    # We need the filename.
    # If project_metadata is missing (e.g. freshly started and history not synced yet?), use ProjectService to find it?
    # Actually ProjectService loads history on init.
    
    filename = project_metadata.get('original') if project_metadata else None
    
    # If we can't find filename in metadata, we might need to look at folder.
    # But let's assume metadata is correct.
    if not filename:
         return jsonify({'error': 'Original file unknown'}), 500
         
    try:
        result = audio_service.process_separation(project_id, filename, modules_to_run)
         # Note: process_separation does "load_or_create" AudioProject, runs modules, and updates metadata.
         # It effectively handles "run additional" too because AudioProject skips completed modules.
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@audio_bp.route('/unify', methods=['POST'])
def unify_tracks():
    data = request.json
    folder_id = data.get('id')
    track_names = data.get('tracks')
    
    try:
        new_track = audio_service.unify_tracks(folder_id, track_names)
        return jsonify({'message': 'Unify successful', 'new_track': new_track}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
