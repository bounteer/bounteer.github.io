"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SpaceSelector from "./SpaceSelector";
import { Upload, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { EXTERNAL } from "@/constant";
import { getUserProfile, getAuthHeaders } from "@/lib/utils";

type UploadStep = "select-space" | "upload-csv" | "select-column";

/**
 * Parse LinkedIn handle from URL or plain handle
 * Examples:
 * - http://www.linkedin.com/in/johan-starkenburg-b30a42128/XXYYZZ → johan-starkenburg-b30a42128
 * - https://linkedin.com/in/john-doe → john-doe
 * - john-doe → john-doe
 */
function parseLinkedInHandle(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    // Try to parse as URL
    const urlPattern = /linkedin\.com\/in\/([a-zA-Z0-9-]+)/i;
    const match = trimmed.match(urlPattern);

    if (match && match[1]) {
      return match[1].toLowerCase();
    }

    // If not a URL, treat as plain handle (permissive)
    // Remove any trailing slashes or special chars
    const cleanHandle = trimmed
      .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
      .replace(/[^a-zA-Z0-9-]/g, '') // Keep only alphanumeric and hyphens
      .toLowerCase();

    return cleanHandle || null;
  } catch (error) {
    console.error('Error parsing LinkedIn handle:', error);
    return null;
  }
}

/**
 * Build full LinkedIn URL from handle
 */
function buildLinkedInUrl(handle: string): string {
  return `https://www.linkedin.com/in/${handle}`;
}

export default function OrbitPulse() {
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<UploadStep>("select-space");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [uploadResults, setUploadResults] = useState<{
    total: number;
    successful: number;
    failed: number;
    duplicates: number;
  } | null>(null);

  const handleSpaceChange = (spaceId: string | null) => {
    setSelectedSpaceId(spaceId);
    if (spaceId) {
      setCurrentStep("upload-csv");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }

    setCsvFile(file);

    // Parse CSV
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        alert('CSV file is empty');
        return;
      }

      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'));

      // Parse data rows (first 10 for preview)
      const data = lines.slice(1, 11).map(line => {
        // Simple CSV parsing (handles basic cases)
        return line.split(',').map(cell => cell.trim().replace(/^"(.*)"$/, '$1'));
      });

      setCsvHeaders(headers);
      setCsvData(data);
      setCurrentStep("select-column");
    };

    reader.readAsText(file);
  };

  const handleColumnSelect = (column: string) => {
    setSelectedColumn(column);
  };

  const handleSubmit = async () => {
    if (!selectedColumn || !selectedSpaceId) {
      alert('Please select a column and space');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Extracting LinkedIn handles from CSV...');
    setUploadResults(null);

    try {
      // Get column index
      const columnIndex = csvHeaders.indexOf(selectedColumn);
      if (columnIndex === -1) {
        throw new Error('Selected column not found');
      }

      // Read full CSV file to get all rows (not just preview)
      const text = await csvFile!.text();
      const lines = text.split('\n').filter(line => line.trim());
      const allData = lines.slice(1).map(line => {
        return line.split(',').map(cell => cell.trim().replace(/^"(.*)"$/, '$1'));
      });

      // Extract and parse LinkedIn handles
      const handles = new Set<string>();
      allData.forEach(row => {
        const cell = row[columnIndex];
        if (cell) {
          const handle = parseLinkedInHandle(cell);
          if (handle) {
            handles.add(handle);
          }
        }
      });

      const uniqueHandles = Array.from(handles);
      console.log(`Found ${uniqueHandles.length} unique LinkedIn handles`);

      if (uniqueHandles.length === 0) {
        alert('No valid LinkedIn URLs or handles found in the selected column');
        setIsProcessing(false);
        return;
      }

      setProcessingStatus(`Uploading ${uniqueHandles.length} candidate references...`);

      // Get user auth
      const user = await getUserProfile(EXTERNAL.directus_url);
      const authHeaders = getAuthHeaders(user);

      let successful = 0;
      let failed = 0;
      let duplicates = 0;

      // Upload each candidate reference
      for (let i = 0; i < uniqueHandles.length; i++) {
        const handle = uniqueHandles[i];
        const linkedinUrl = buildLinkedInUrl(handle);

        setProcessingStatus(
          `Uploading ${i + 1} of ${uniqueHandles.length}: ${handle}...`
        );

        try {
          // Create candidate_reference
          const candidateRefResponse = await fetch(
            `${EXTERNAL.directus_url}/items/candidate_reference`,
            {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
              },
              body: JSON.stringify({
                linkedin_handle: handle,
              }),
            }
          );

          if (!candidateRefResponse.ok) {
            const errorText = await candidateRefResponse.text();
            console.error(`Failed to create candidate_reference for ${handle}:`, errorText);

            // Check if it's a duplicate error
            if (errorText.includes('duplicate') || candidateRefResponse.status === 409) {
              duplicates++;
            } else {
              failed++;
            }
            continue;
          }

          const candidateRefData = await candidateRefResponse.json();
          const candidateRefId = candidateRefData.data.id;

          // Create space_candidate_reference link
          const spaceLinkResponse = await fetch(
            `${EXTERNAL.directus_url}/items/space_candidate_reference`,
            {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
              },
              body: JSON.stringify({
                space: parseInt(selectedSpaceId),
                candidate_reference: candidateRefId,
              }),
            }
          );

          if (!spaceLinkResponse.ok) {
            const errorText = await spaceLinkResponse.text();
            console.error(`Failed to link candidate_reference ${candidateRefId} to space:`, errorText);

            // Check if it's a duplicate error
            if (errorText.includes('duplicate') || spaceLinkResponse.status === 409) {
              duplicates++;
            } else {
              failed++;
            }
            continue;
          }

          successful++;
        } catch (error) {
          console.error(`Error processing handle ${handle}:`, error);
          failed++;
        }
      }

      setUploadResults({
        total: uniqueHandles.length,
        successful,
        failed,
        duplicates,
      });

      setProcessingStatus('Upload complete!');
    } catch (error) {
      console.error('Error processing CSV:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orbit Pulse</h1>
        <p className="text-muted-foreground mt-2">
          Upload LinkedIn profiles and enrich them with career insights
        </p>
      </div>

      {/* Step 1: Space Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {selectedSpaceId && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            <span>1. Select Space</span>
          </CardTitle>
          <CardDescription>
            Choose the workspace where you want to process LinkedIn profiles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SpaceSelector
            onSpaceChange={handleSpaceChange}
            selectedSpaceId={selectedSpaceId}
            requireWriteAccess={true}
            variant="default"
            label="Workspace"
          />
        </CardContent>
      </Card>

      {/* Step 2: CSV Upload */}
      {currentStep !== "select-space" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {csvFile && <CheckCircle2 className="h-5 w-5 text-green-600" />}
              <span>2. Upload CSV File</span>
            </CardTitle>
            <CardDescription>
              Upload a CSV file containing LinkedIn URLs or profile handles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="csv-upload" className="sr-only">
                  Upload CSV
                </Label>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="cursor-pointer"
                />
              </div>
              {csvFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{csvFile.name}</span>
                </div>
              )}
            </div>

            {!csvFile && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  Click above to select a CSV file
                </p>
                <p className="text-xs text-muted-foreground">
                  Supported format: CSV with LinkedIn URLs or handles
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Column Selection */}
      {currentStep === "select-column" && csvHeaders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {selectedColumn && <CheckCircle2 className="h-5 w-5 text-green-600" />}
              <span>3. Select LinkedIn Column</span>
            </CardTitle>
            <CardDescription>
              Choose the column that contains LinkedIn URLs or profile handles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="column-select">LinkedIn Column</Label>
              <Select value={selectedColumn} onValueChange={handleColumnSelect}>
                <SelectTrigger id="column-select" className="w-full">
                  <SelectValue placeholder="Select a column" />
                </SelectTrigger>
                <SelectContent>
                  {csvHeaders.map((header, index) => (
                    <SelectItem key={index} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* CSV Preview */}
            <div>
              <Label className="mb-2 block">Preview (first 10 rows)</Label>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {csvHeaders.map((header, index) => (
                          <TableHead
                            key={index}
                            className={
                              selectedColumn === header
                                ? "bg-blue-50 font-semibold"
                                : ""
                            }
                          >
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <TableCell
                              key={cellIndex}
                              className={
                                selectedColumn === csvHeaders[cellIndex]
                                  ? "bg-blue-50/50"
                                  : ""
                              }
                            >
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSubmit}
                disabled={!selectedColumn || isProcessing}
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  `Process Profiles`
                )}
              </Button>
            </div>

            {/* Processing Status */}
            {isProcessing && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <p className="text-sm text-blue-700">{processingStatus}</p>
                </div>
              </div>
            )}

            {/* Upload Results */}
            {uploadResults && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Upload Complete</h3>
                <div className="space-y-1 text-sm text-green-700">
                  <p>Total handles: {uploadResults.total}</p>
                  <p className="text-green-600 font-medium">✓ Successfully uploaded: {uploadResults.successful}</p>
                  {uploadResults.duplicates > 0 && (
                    <p className="text-yellow-600">⚠ Duplicates skipped: {uploadResults.duplicates}</p>
                  )}
                  {uploadResults.failed > 0 && (
                    <p className="text-red-600">✗ Failed: {uploadResults.failed}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
