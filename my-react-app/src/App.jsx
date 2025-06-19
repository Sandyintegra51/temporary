import { useRef, useState } from 'react';
import './App.css';

const sampleData = [
  { field: 'Name', value: 'John Doe' },
  { field: 'Document Number', value: '1234 5678 9012' },
  { field: 'Date of Birth', value: '01/01/1990' },
  { field: 'Address', value: '123 Main Street, City, State',  },
  { field: 'Phone Number', value: '+91 9876543210',  }
];

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [error, setError] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  let rawOcrText = '';
  const fileInputRef = useRef();

  const validateFile = (file) => {
    setError(null); // Clear any previous errors
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      setError('File size exceeds 10MB limit');
      return false;
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf',];
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPG, JPEG, PNG AND PDF files are allowed');
      return false;
    }

    return true;
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (validateFile(file)) {
        setSelectedFile(file);
        setFileInfo({
          name: file.name,
          size: (file.size / 1024 / 1024).toFixed(2)
        });
        setExtracted(false);
      } else {
        setSelectedFile(null);
        setFileInfo(null);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (validateFile(file)) {
        setSelectedFile(file);
        setFileInfo({
          name: file.name,
          size: (file.size / 1024 / 1024).toFixed(2)
        });
        setExtracted(false);
      } else {
        setSelectedFile(null);
        setFileInfo(null);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const processDocument = async () => {
    if (!selectedFile) return;
    setProcessing(true);
    setExtracted(false);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // Choose endpoint based on file type
      let endpoint = '';
      if (selectedFile.type === 'application/pdf') {
        endpoint = 'upload-scanned-pdf';
      } else if (
        selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        endpoint = 'upload-docx';
      } else {
        endpoint = 'upload-image';
      }

      const response = await fetch(`http://localhost:5000/api/${endpoint}`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Failed to process document');
      }
      
      const data = await response.json();
      console.log('API response:', data);
      // Try to get the raw OCR text from the most likely property
      let ocrText = '';
      if (typeof data.extractedText === 'string') {
        ocrText = data.extractedText;
      } else if (typeof data.raw_text === 'string') {
        ocrText = data.raw_text;
      } else if (data.extractedText && typeof data.extractedText.raw_text === 'string') {
        ocrText = data.extractedText.raw_text;
      } else {
        ocrText = JSON.stringify(data.extractedText || data.raw_text || data);
      }
      console.log('Extracted OCR Text:', ocrText);
      setExtractedText(ocrText);
      setProcessing(false);
      setExtracted(true);
    } catch (error) {
      console.error('Error:', error);
      setProcessing(false);
      setError(error.message || 'Failed to process document. Please try again.');
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Document Data Extractor</h1>
        <p>Upload your documents to extract key information automatically</p>
      </div>
      <div
        className="upload-section"
        onClick={() => fileInputRef.current.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{ cursor: 'pointer' }}
      >
        <div className="upload-area">
          <div className="upload-icon">📄</div>
          <div className="upload-text">Click to upload or drag and drop (Only one Document)</div>
          <div className="upload-subtext">Supports WORD, PDF, JPG, JPEG, PNG files (Max 10MB)</div>
        </div>
        <input
          type="file"
          id="fileInput"
          className="file-input"
          accept=".pdf,.jpg,.jpeg,.png,.docx"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <div className="file-preview" id="filePreview" style={{ display: fileInfo ? 'block' : 'none' }}>
          <div className="file-info" id="fileInfo">
            {fileInfo && (
              <>
                <span role="img" aria-label="file">📄</span>
                <span><strong>{fileInfo.name}</strong> ({fileInfo.size} MB)</span>
              </>
            )}
          </div>
        </div>
        <button
          className="process-btn"
          id="processBtn"
          onClick={(e) => {
            e.stopPropagation();  // Stop the click from reaching the parent div
            processDocument();
          }}
          disabled={!selectedFile || processing}
          style={{ display: selectedFile ? 'inline-block' : 'none' }}
        >
          {processing ? 'Processing...' : 'Extract Data'}
        </button>
      </div>
      {error && (
        <div className="error-message" style={{
          color: '#dc2626',
          backgroundColor: '#fee2e2',
          padding: '0.75rem',
          borderRadius: '0.375rem',
          marginTop: '1rem',
          textAlign: 'center'
        }}>
          ⚠️ {error}
        </div>
      )}
      <div className="results-section" id="resultsSection" style={{ display: (extracted) ? 'block' : 'none' }}>
        <h2 className="results-title">Extracted Information</h2>
        <div id="processingStatus">
          {processing && <span className="status processing">Processing Document...</span>}
          {extracted && <span className="status complete">Extraction Complete</span>}
        </div>
        {/* Only show extracted text, remove table and processedResults references */}
        {extracted && extractedText && (
          <div className="extracted-text-section">
            <h3>Data</h3>
            <div className="extracted-text-content">
              {(() => {
                let obj = null;
                try {
                  obj = JSON.parse(extractedText);
                } catch (e) {
                  return extractedText;
                }
                if (obj && typeof obj === 'object') {
                  if (Object.keys(obj).length === 1 && typeof Object.values(obj)[0] === 'object') {
                    obj = Object.values(obj)[0];
                  }
                  return Object.entries(obj).map(([key, value]) => (
                    <div key={key}>
                      {key.replace(/"/g, '')} : {typeof value === 'string' ? value : JSON.stringify(value)}
                    </div>
                  ));
                }
                return extractedText;
              })()}
            </div>
            {/* Table for Field/Value pairs */}
            {(() => {
              let obj = null;
              try {
                obj = JSON.parse(extractedText);
              } catch (e) {
                return null;
              }
              if (obj && typeof obj === 'object') {
                if (Object.keys(obj).length === 1 && typeof Object.values(obj)[0] === 'object') {
                  obj = Object.values(obj)[0];
                }
                return (
                  <table className="data-table" style={{marginTop: '1rem'}}>
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(obj).map(([key, value]) => (
                        <tr key={key}>
                          <td>{key.replace(/"/g, '')}</td>
                          <td>{typeof value === 'string' ? value.replace(/^"|"$/g, '') : JSON.stringify(value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              }
              return null;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
