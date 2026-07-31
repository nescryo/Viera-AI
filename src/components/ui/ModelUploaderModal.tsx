import React, { useState } from 'react';
import { X, UploadCloud, FileCode, CheckCircle } from 'lucide-react';

interface ModelUploaderModalProps {
  onLoadModelFile: (file: File) => void;
  onClose: () => void;
}

export const ModelUploaderModal: React.FC<ModelUploaderModalProps> = ({
  onLoadModelFile,
  onClose
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleConfirm = () => {
    if (selectedFile) {
      onLoadModelFile(selectedFile);
      onClose();
    }
  };

  return (
    <div className="modal-backdrop glass-panel fade-in">
      <div className="modal-container glass-panel uploader-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <UploadCloud className="modal-icon" size={20} />
            <h3>Load 3D Character Model</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div 
          className={`dropzone-box ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
        >
          <input 
            type="file" 
            accept=".vrm,.glb,.gltf,.pmx" 
            id="vrm-file-input" 
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />

          <label htmlFor="vrm-file-input" className="dropzone-label">
            <UploadCloud size={48} className="dropzone-icon" />
            <span className="drop-title">Drag & Drop your 3D model here</span>
            <span className="drop-subtitle">Supports open VRM (`.vrm`), GLTF/GLB (`.glb`), or MMD (`.pmx`) format</span>
            <span className="browse-btn">Browse Local Files</span>
          </label>

          {selectedFile && (
            <div className="file-preview-card fade-in">
              <FileCode size={24} className="file-icon" />
              <div className="file-info">
                <span className="file-name">{selectedFile.name}</span>
                <span className="file-size">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
              <CheckCircle size={20} color="#23a55a" />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
          <button 
            type="button" 
            disabled={!selectedFile}
            onClick={handleConfirm}
            className="btn-save"
          >
            Load 3D Model into Viewport
          </button>
        </div>
      </div>
    </div>
  );
};
