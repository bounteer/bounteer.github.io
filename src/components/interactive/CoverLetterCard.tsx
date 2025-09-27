"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ArrowUp } from "lucide-react";

type Report = {
  cover_letter?: string;
  submission?: {
    job_description?: {
      role_name?: string;
      company_name?: string;
    };
    user_created?: { first_name?: string; last_name?: string };
  };
};

interface CoverLetterCardProps {
  report: Report;
  candidateName: string;
  roleName: string;
  companyName: string;
}

export default function CoverLetterCard({ report, candidateName, roleName, companyName }: CoverLetterCardProps) {
  // Create a nicely formatted filename for the cover letter PDF
  const createCoverLetterFileName = () => {
    // Clean strings for filename (remove special characters, replace spaces with underscores, lowercase)
    const cleanString = (str: string) => str
      .replace(/[^\w\s]/g, '') // Remove special characters except word chars and spaces
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .toLowerCase() // Convert to lowercase
      .trim();
    
    const cleanCandidate = cleanString(candidateName);
    
    return `cover_letter_${cleanCandidate}`;
  };

  const generateCoverLetterPDF = () => {
    if (!report?.cover_letter) return;

    // Create a temporary div for the cover letter content
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = '210mm';
    tempDiv.style.padding = '20mm';
    tempDiv.style.fontFamily = 'Arial, sans-serif';
    tempDiv.style.fontSize = '12px';
    tempDiv.style.lineHeight = '1.6';
    tempDiv.style.color = 'black';
    tempDiv.style.backgroundColor = 'white';

    tempDiv.innerHTML = `
      <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Cover Letter</h1>
        <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">${candidateName} - ${roleName} @ ${companyName}</p>
      </div>
      <div style="white-space: pre-wrap; text-align: justify;">${report.cover_letter}</div>
    `;

    document.body.appendChild(tempDiv);

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${createCoverLetterFileName()}</title>
            <style>
              @media print {
                body { margin: 0; }
                @page { margin: 20mm; }
              }
            </style>
          </head>
          <body>
            ${tempDiv.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }

    // Clean up
    document.body.removeChild(tempDiv);
  };

  if (!report.cover_letter) return null;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-center text-lg">
          Cover Letter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-4">
            Personalized cover letter generated based on your profile and the job requirements.
          </p>
        </div>

        {/* Cover Letter Preview */}
        <h3 className="text-sm font-medium text-gray-900 mb-3">Preview</h3>
        <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {report.cover_letter}
          </div>
        </div>

        {/* Prompt Section */}
        <div className="filter grayscale opacity-50 pointer-events-none">
          <p className="text-sm text-gray-800 mb-3">
            Want to personalize your cover letter further? Use the prompt below to regenerate it with specific requirements or tone adjustments.
          </p>
          <div className="relative">
            <input
              type="text"
              placeholder="Coming soon... (e.g., 'Make it more formal', 'Add emphasis on leadership experience')"
              className="w-full px-4 py-3 pr-12 text-sm border rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-full focus:outline-none focus:ring-offset-2" disabled>
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-white px-4 py-2 rounded-full text-sm font-bold text-gray-800 shadow-lg border">
              Coming Soon
            </span>
          </div>
        </div>

        <Button
          onClick={generateCoverLetterPDF}
          className="flex items-center gap-2 mx-auto"
        >
          <Download className="h-4 w-4" />
          Download Cover Letter PDF
        </Button>
      </CardContent>
    </Card>
  );
}