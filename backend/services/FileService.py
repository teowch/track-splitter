import os
import zipfile
import shutil
from typing import List, Optional

class FileService:
    def __init__(self, project_service, upload_folder: str):
        self.project_service = project_service
        self.upload_folder = upload_folder
        os.makedirs(self.upload_folder, exist_ok=True)

    def get_file_path(self, project_id: str, filename: str) -> Optional[str]:
        project_path = self.project_service.get_project_path(project_id)
        if not project_path:
            return None
        
        file_path = os.path.join(project_path, filename)
        if os.path.exists(file_path):
            return file_path
        return None

    def create_zip(self, project_id: str, selected_tracks: List[str] = None) -> str:
        """
        Creates a zip file for the project. If selected_tracks is provided, only zips those.
        Returns the path to the zip file.
        """
        project_path = self.project_service.get_project_path(project_id)
        if not project_path:
            raise FileNotFoundError("Project not found")
        
        suffix = "_selected" if selected_tracks else ""
        zip_filename = f"{project_id}{suffix}.zip"
        zip_path = os.path.join(self.upload_folder, zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            if selected_tracks:
                 for name in selected_tracks:
                    p = os.path.join(project_path, name)
                    if os.path.exists(p):
                        zipf.write(p, name)
            else:
                for root, dirs, files in os.walk(project_path):
                    for file in files:
                        zipf.write(os.path.join(root, file), file)
        
        return zip_path
