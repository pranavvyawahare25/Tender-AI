/**
 * TenderUpload — Drag-and-drop tender file upload.
 */
import { useState, useRef } from 'react';

export default function TenderUpload({ onUpload }) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  const handleSelect = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
  };

  const handleSubmit = () => {
    if (selectedFile) onUpload(selectedFile);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="upload-container">
      <div
        className={`upload-zone ${dragOver ? 'dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <div className="upload-zone-icon">📄</div>
        <p className="upload-zone-text">
          <strong>Click to upload</strong> or drag and drop<br />
          PDF, Images (PNG/JPG), or DOCX files
        </p>
      </div>

      <input
        type="file"
        ref={fileRef}
        className="file-input-hidden"
        accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp,.docx"
        onChange={handleSelect}
      />

      {selectedFile && (
        <div className="selected-file fade-in">
          <div className="selected-file-info">
            <span className="selected-file-icon">📎</span>
            <div>
              <div className="selected-file-name">{selectedFile.name}</div>
              <div className="selected-file-size">{formatSize(selectedFile.size)}</div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleSubmit}>
            Upload & Analyze →
          </button>
        </div>
      )}
    </div>
  );
}
