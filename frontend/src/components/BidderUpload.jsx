/**
 * BidderUpload — Upload documents for multiple bidders.
 */
import { useState, useRef } from 'react';

export default function BidderUpload({ onUpload, bidders }) {
  const [bidderName, setBidderName] = useState('');
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...dropped]);
  };

  const handleSelect = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 0) {
      setFiles(prev => [...prev, ...selected]);
    }
    // Reset input value so the same file can be re-selected
    e.target.value = '';
  };

  const handleRemoveFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!files.length || !bidderName.trim()) return;
    await onUpload(files, bidderName.trim());
    setBidderName('');
    setFiles([]);
    // Reset file input so it can be reused
    if (fileRef.current) fileRef.current.value = '';
  };

  const bidderList = Object.values(bidders);

  return (
    <div>
      <div className="bidder-upload-form glass-card">
        <input
          type="text"
          className="bidder-name-input"
          placeholder="Enter Bidder Name (e.g., TechVision Solutions)"
          value={bidderName}
          onChange={(e) => setBidderName(e.target.value)}
        />

        <div
          className={`upload-zone ${dragOver ? 'dragover' : ''}`}
          style={{ padding: '24px' }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <div className="upload-zone-icon">📁</div>
          <p className="upload-zone-text">
            <strong>Drop bidder documents</strong> here or click to browse<br />
            You can upload multiple files per bidder
          </p>
        </div>

        <input
          type="file"
          ref={fileRef}
          className="file-input-hidden"
          accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp,.docx"
          multiple
          onChange={handleSelect}
        />

        {files.length > 0 && (
          <div className="flex flex-col gap-sm fade-in">
            {files.map((f, i) => (
              <div key={i} className="selected-file" style={{ padding: '8px 12px' }}>
                <div className="selected-file-info">
                  <span className="selected-file-icon">📎</span>
                  <span className="selected-file-name text-sm">{f.name}</span>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleRemoveFile(i)}>✕</button>
              </div>
            ))}
          </div>
        )}

        <button
          className="btn btn-primary w-full"
          onClick={handleSubmit}
          disabled={!files.length || !bidderName.trim()}
        >
          📤 Upload & Extract Bidder Data
        </button>
      </div>

      {/* Uploaded bidders */}
      {bidderList.length > 0 && (
        <div className="uploaded-bidders mt-lg">
          <h3 className="text-sm font-semibold mb-md" style={{ color: 'var(--text-secondary)' }}>
            Uploaded Bidders ({bidderList.length})
          </h3>
          <div className="flex" style={{ flexWrap: 'wrap' }}>
            {bidderList.map((b) => (
              <div key={b.bidder_id} className="bidder-chip">
                <span className="bidder-chip-icon">🏢</span>
                <span>{b.bidder_name}</span>
                <span className="bidder-chip-status" title={b.status}></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
