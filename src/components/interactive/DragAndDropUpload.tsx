"use client";

import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Upload } from "lucide-react";

interface DragAndDropUploadProps {
  onFileSelect: (file: File | null) => void;
}

export default function DragAndDropUpload({ onFileSelect }: DragAndDropUploadProps) {
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
      className={`p-6 border-2 border-dashed text-center cursor-pointer transition h-full flex flex-col justify-center ${isDragging ? "border-primary bg-primary/5" : "border-gray-300"
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
      <CardContent className="flex flex-col items-center gap-4">
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
