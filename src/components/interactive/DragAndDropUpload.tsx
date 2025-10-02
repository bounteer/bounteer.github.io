"use client";

import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, Check } from "lucide-react";

type PreviousSubmission = {
  id: number;
  cv_file: string;
  date_created: string;
  job_description?: {
    role_name?: string;
    company_name?: string;
  };
};

interface DragAndDropUploadProps {
  onFileSelect: (file: File | null) => void;
  lastSubmission?: PreviousSubmission | null;
  selectedPreviousCV?: string | null;
  onSelectLastCV?: () => void;
}

export default function DragAndDropUpload({ onFileSelect, lastSubmission, selectedPreviousCV, onSelectLastCV }: DragAndDropUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (f.type !== "application/pdf") {
      alert("Only PDF files are allowed.");
      return;
    }
    setFile(f);
    onFileSelect(f);
  };

  return (
    <Card
      className={`p-6 border-2 border-dashed text-center cursor-pointer transition h-full min-h-[300px] flex flex-col ${isDragging ? "border-primary bg-primary/5" : "border-gray-300"
        }`}
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <CardContent className="flex flex-col items-center gap-4 flex-1 justify-center">
        {/* Show last CV option if available */}
        {lastSubmission && (
          <div className="w-full mb-4">
            <p className="text-sm text-gray-600 mb-2">Use last CV:</p>
            <div
              className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${selectedPreviousCV === lastSubmission.cv_file
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
                }`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectLastCV?.();
              }}
            >
              <FileText className="h-4 w-4 text-gray-500 mr-2" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {lastSubmission.job_description?.role_name
                    ? `CV for ${lastSubmission.job_description.role_name}${lastSubmission.job_description.company_name ? ` at ${lastSubmission.job_description.company_name}` : ''}`
                    : 'Last uploaded CV'
                  }
                </p>
                <p className="text-xs text-gray-500">
                  Uploaded on {new Date(lastSubmission.date_created).toLocaleDateString()}
                </p>
              </div>
              {selectedPreviousCV === lastSubmission.cv_file && (
                <Check className="h-4 w-4 text-primary-600" />
              )}
            </div>
            <div className="text-center my-3">
              <span className="text-xs text-gray-400">OR</span>
            </div>
          </div>
        )}

        <Upload className="h-10 w-10 text-gray-400" />
        <p className="text-sm text-gray-600">
          Drag & drop your CV here <br /> or click to select a file
        </p>

        {/* Native hidden input for file picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {file && <p className="text-sm font-medium">📄 {file.name}</p>}
      </CardContent>
    </Card>
  );
}
