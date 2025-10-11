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
  showLastCVOption?: boolean;
}

export default function DragAndDropUpload({ onFileSelect, lastSubmission, selectedPreviousCV, onSelectLastCV, showLastCVOption = true }: DragAndDropUploadProps) {
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
      className={`p-2 sm:p-4 border-2 border-dashed text-center cursor-pointer transition h-[300px] flex flex-col ${isDragging ? "border-primary bg-primary/5" : "border-gray-300"
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
      <CardContent className="flex flex-col items-center gap-1 sm:gap-2 flex-1 justify-center">
        {/* Show last CV option if available and enabled */}
        {lastSubmission && showLastCVOption && (
          <div className="w-full mb-2">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Use last CV:</p>
            <div
              className={`flex items-center p-2 sm:p-3 border rounded cursor-pointer transition-colors ${selectedPreviousCV === lastSubmission.cv_file
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
                }`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectLastCV?.();
              }}
            >
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 mr-1 sm:mr-2 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                  {lastSubmission.job_description?.role_name
                    ? `${lastSubmission.job_description.role_name}${lastSubmission.job_description.company_name ? ` - ${lastSubmission.job_description.company_name}` : ''}`
                    : 'Last CV'
                  }
                </p>
                <p className="text-xs text-gray-500 hidden sm:block">
                  {new Date(lastSubmission.date_created).toLocaleDateString()}
                </p>
              </div>
              {selectedPreviousCV === lastSubmission.cv_file && (
                <Check className="h-3 w-3 sm:h-4 sm:w-4 text-primary-600 flex-shrink-0" />
              )}
            </div>
            <div className="text-center my-2">
              <span className="text-xs text-gray-400">OR</span>
            </div>
          </div>
        )}

        <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
        <p className="text-xs text-gray-600 leading-tight">
          Drag & drop CV or <span className="sm:hidden">tap</span><span className="hidden sm:inline">click</span> to select
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
