'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2, FileText, Image as ImageIcon, File } from 'lucide-react';
import { toast } from 'sonner';

interface FileUploadProps {
  teamId: string;
  onUploadComplete: () => void;
  onClose: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://thehive-production-78ed.up.railway.app';

export function FileUpload({ teamId, onUploadComplete, onClose }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf') return <FileText className="w-5 h-5 text-red-400" />;
    if (file.type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-400" />;
    return <File className="w-5 h-5 text-gray-400" />;
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const token = localStorage.getItem('token');

    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name);

        const response = await fetch(`${API_URL}/api/teams/${teamId}/files`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }

        setProgress(prev => ({ ...prev, [file.name]: 100 }));
        successCount++;
      } catch (error: any) {
        console.error(`Failed to upload ${file.name}:`, error);
        failCount++;
        toast.error(`Failed to upload ${file.name}: ${error.message}`);
      }
    }

    setUploading(false);

    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} file${successCount > 1 ? 's' : ''}`);
      onUploadComplete();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-hive-bg rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-hive-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5 text-honey-500" />
            Upload Files
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-hive-bg-secondary rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-hive-border rounded-lg p-8 text-center cursor-pointer hover:border-honey-500 hover:bg-honey-500/5 transition"
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-hive-muted" />
            <p className="text-hive-muted">
              Drag & drop files here, or <span className="text-honey-500">browse</span>
            </p>
            <p className="text-xs text-hive-muted mt-1">
              PDF, images, text files up to 100MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.txt,.csv,.json,.xml"
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-hive-bg-secondary rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getFileIcon(file)}
                    <span className="truncate text-sm">{file.name}</span>
                    <span className="text-xs text-hive-muted flex-shrink-0">
                      ({(file.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                  {!uploading && (
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 hover:bg-hive-bg rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {uploading && progress[file.name] === 100 && (
                    <span className="text-green-400 text-xs">Done</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-hive-border">
          <button onClick={onClose} className="btn-secondary" disabled={uploading}>
            Cancel
          </button>
          <button
            onClick={uploadFiles}
            disabled={files.length === 0 || uploading}
            className="btn-primary flex items-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload {files.length > 0 ? `(${files.length})` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
