import { useEffect, useRef, useState, useMemo } from "react";
import { DirectedGraph } from "graphology";
import Sigma from "sigma";
import Papa from "papaparse";
import forceAtlas2 from "graphology-layout-forceatlas2";
import noverlap from "graphology-layout-noverlap";
import { EdgeCurvedArrowProgram } from "@sigma/edge-curve";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CSVRow {
  [key: string]: string;
}

interface NodeData {
  label: string;
  size: number;
  x: number;
  y: number;
  color: string;
}

interface ProcessedRow {
  index: number;
  fromValue: string;
  toValue: string;
  enabled: boolean;
  date?: Date;
}

export function CareerGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fromColumn, setFromColumn] = useState<string>("");
  const [toColumn, setToColumn] = useState<string>("");
  const [dateColumn, setDateColumn] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [enabledRows, setEnabledRows] = useState<Set<number>>(new Set());
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);

  // Helper function to parse various date formats
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr || dateStr.trim() === '') return null;

    const trimmed = dateStr.trim();
    const parsed = new Date(trimmed);

    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    return null;
  };

  // Handle CSV file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
        if (results.data.length > 0) {
          const cols = Object.keys(results.data[0]);
          setColumns(cols);
          // Auto-select first two columns as default
          if (cols.length >= 2) {
            setFromColumn(cols[0]);
            setToColumn(cols[1]);
          }
          // Enable all rows by default
          const allIndices = new Set(results.data.map((_, i) => i));
          setEnabledRows(allIndices);
        }
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        alert("Error parsing CSV file");
      },
    });
  };

  // Process CSV data to filter valid transitions
  const processedData = useMemo((): ProcessedRow[] => {
    if (!fromColumn || !toColumn) return [];

    const processed = csvData
      .map((row, index) => {
        const fromValue = row[fromColumn]?.trim();
        const toValue = row[toColumn]?.trim();
        const dateValue = dateColumn ? parseDate(row[dateColumn]) : null;

        return {
          index,
          fromValue,
          toValue,
          enabled: enabledRows.has(index),
          date: dateValue || undefined,
        };
      })
      .filter((row) => {
        // Filter out empty values and same-company transitions
        return row.fromValue && row.toValue && row.fromValue !== row.toValue;
      });

    // Update date range if date column is selected
    if (dateColumn && processed.length > 0) {
      const dates = processed.map(r => r.date).filter(Boolean) as Date[];
      if (dates.length > 0) {
        const min = new Date(Math.min(...dates.map(d => d.getTime())));
        const max = new Date(Math.max(...dates.map(d => d.getTime())));

        // Only update if changed to avoid infinite loops
        if (!minDate || min.getTime() !== minDate.getTime()) {
          setMinDate(min);
        }
        if (!maxDate || max.getTime() !== maxDate.getTime()) {
          setMaxDate(max);
        }
        if (!dateRange[0] || !dateRange[1]) {
          setDateRange([min, max]);
        }
      }
    }

    return processed;
  }, [csvData, fromColumn, toColumn, dateColumn, enabledRows]);

  // Filter processed data by search text and date range
  const filteredData = useMemo((): ProcessedRow[] => {
    let filtered = processedData;

    // Filter by search text
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter((row) => {
        return (
          row.fromValue.toLowerCase().includes(search) ||
          row.toValue.toLowerCase().includes(search)
        );
      });
    }

    // Filter by date range if date column is selected
    if (dateColumn && dateRange[0] && dateRange[1]) {
      filtered = filtered.filter((row) => {
        if (!row.date) return false;
        return row.date >= dateRange[0]! && row.date <= dateRange[1]!;
      });
    }

    return filtered;
  }, [processedData, searchText, dateColumn, dateRange]);

  // Toggle row enabled state
  const toggleRow = (index: number) => {
    setEnabledRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Export graph as PNG (drawing buffer is now preserved)
  const exportAsPNG = () => {
    if (!sigmaRef.current || !containerRef.current) return;

    setIsExporting(true);

    try {
      // Trigger a fresh render
      sigmaRef.current.refresh();

      // Wait for render to complete
      setTimeout(() => {
        try {
          const canvases = Array.from(containerRef.current!.querySelectorAll('canvas')) as HTMLCanvasElement[];

          if (canvases.length === 0) {
            alert('No graph to export');
            setIsExporting(false);
            return;
          }

          // Get dimensions from first canvas
          const width = canvases[0].width;
          const height = canvases[0].height;

          // Create export canvas
          const exportCanvas = document.createElement('canvas');
          exportCanvas.width = width;
          exportCanvas.height = height;
          const ctx = exportCanvas.getContext('2d');

          if (!ctx) {
            setIsExporting(false);
            return;
          }

          // Fill white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);

          // Draw all canvas layers (preserveDrawingBuffer is now true)
          canvases.forEach((canvas) => {
            ctx.drawImage(canvas, 0, 0);
          });

          // Convert to blob and download
          exportCanvas.toBlob((blob) => {
            if (!blob) {
              alert('Failed to generate image');
              setIsExporting(false);
              return;
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().split('T')[0];
            link.download = `career-graph-${timestamp}.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            setIsExporting(false);
          }, 'image/png');
        } catch (error) {
          console.error('Error in export:', error);
          alert('Failed to export graph');
          setIsExporting(false);
        }
      }, 100);
    } catch (error) {
      console.error('Error exporting graph:', error);
      alert('Failed to export graph');
      setIsExporting(false);
    }
  };

  // Build and render graph when data or column selection changes
  useEffect(() => {
    if (!filteredData.length || !containerRef.current) {
      return;
    }

    // Clean up existing sigma instance
    if (sigmaRef.current) {
      sigmaRef.current.kill();
      sigmaRef.current = null;
    }

    // Clear the container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    // Patch WebGL context creation to preserve drawing buffer for export
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, attributes: any) {
      if (type === 'webgl' || type === 'webgl2') {
        attributes = attributes || {};
        attributes.preserveDrawingBuffer = true;
      }
      return originalGetContext.call(this, type as any, attributes);
    } as any;

    // Create new directed graph for clearer arrows
    const graph = new DirectedGraph();

    // Track company appearances for node sizing
    const companyCount = new Map<string, number>();
    // Track edges for transition counts
    const edgeMap = new Map<string, number>();

    // Process only enabled rows from filtered data
    filteredData.forEach((row) => {
      if (!row.enabled) return;

      const fromCompany = row.fromValue;
      const toCompany = row.toValue;

      // Count company appearances
      companyCount.set(fromCompany, (companyCount.get(fromCompany) || 0) + 1);
      companyCount.set(toCompany, (companyCount.get(toCompany) || 0) + 1);

      // Count transitions (edges)
      const edgeKey = `${fromCompany}→${toCompany}`;
      edgeMap.set(edgeKey, (edgeMap.get(edgeKey) || 0) + 1);
    });

    // Add nodes to graph with random initial positions
    const companies = Array.from(companyCount.keys());
    const maxCount = Math.max(...companyCount.values());

    // Vibrant color palette
    const colorPalette = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52C7B8',
      '#FF8B94', '#A8E6CF', '#FFD3B6', '#FFAAA5', '#FF8C94',
      '#C7CEEA', '#B4F8C8', '#FBE7C6', '#A0E7E5', '#FFAEBC',
    ];

    companies.forEach((company, index) => {
      const count = companyCount.get(company) || 0;

      // Random initial positions for force layout
      const x = (Math.random() - 0.5) * 10;
      const y = (Math.random() - 0.5) * 10;

      // Use color palette or generate vibrant HSL color
      const color = colorPalette[index % colorPalette.length] ||
        `hsl(${(index * 137.5) % 360}, 85%, 65%)`; // Golden angle distribution

      graph.addNode(company, {
        label: company,
        size: Math.max(5, (count / maxCount) * 30), // Scale size between 5 and 30
        x,
        y,
        color,
      } as NodeData);
    });

    // Check for bidirectional edges
    const bidirectionalPairs = new Set<string>();
    edgeMap.forEach((_, edgeKey) => {
      const [from, to] = edgeKey.split("→");
      const reverseKey = `${to}→${from}`;
      if (edgeMap.has(reverseKey)) {
        // Store pairs in a consistent order to avoid duplicates
        const pair = [from, to].sort().join("↔");
        bidirectionalPairs.add(pair);
      }
    });

    // Add edges to graph with weights
    const maxEdgeCount = Math.max(...edgeMap.values());
    edgeMap.forEach((count, edgeKey) => {
      const [from, to] = edgeKey.split("→");
      if (graph.hasNode(from) && graph.hasNode(to)) {
        try {
          // Check if this edge is part of a bidirectional pair
          const pair = [from, to].sort().join("↔");
          const isBidirectional = bidirectionalPairs.has(pair);

          const edgeAttributes: any = {
            size: Math.max(0.5, (count / maxEdgeCount) * 3), // Thinner edges: 0.5 to 3
            color: "#888",
            label: `${count}`,
            weight: count, // Edge weight for force layout
            type: isBidirectional ? "curved" : "arrow", // Curved for bidirectional
          };

          // Add curvature for bidirectional edges
          if (isBidirectional) {
            edgeAttributes.curvature = 0.15; // Slight curve to separate overlapping edges
          }

          graph.addEdge(from, to, edgeAttributes);
        } catch (e) {
          // Edge might already exist, ignore
        }
      }
    });

    // Apply ForceAtlas2 layout to spread nodes based on connections
    forceAtlas2.assign(graph, {
      iterations: 500,
      settings: {
        gravity: 1,
        scalingRatio: 10,
        strongGravityMode: false,
        barnesHutOptimize: true,
        barnesHutTheta: 0.5,
        slowDown: 1,
        edgeWeightInfluence: 1.5, // Higher value = edge weights have more influence
      },
    });

    // Apply NoOverlap to prevent nodes from overlapping
    noverlap.assign(graph, {
      maxIterations: 100,
      settings: {
        ratio: 1.5, // Spacing ratio
        margin: 5, // Minimum margin between nodes
      },
    });

    // Render with Sigma
    try {
      const sigma = new Sigma(graph, containerRef.current, {
        renderEdgeLabels: true,
        defaultNodeColor: "#999",
        defaultEdgeColor: "#888",
        edgeLabelSize: 12,
        edgeLabelColor: { color: "#666" },
        labelSize: 14,
        labelWeight: "bold",
        labelColor: { color: "#000" },
        // Enable arrow rendering for directed edges
        enableEdgeEvents: true,
        defaultEdgeType: "arrow",
        // Register curved arrow program for bidirectional edges
        edgeProgramClasses: {
          curved: EdgeCurvedArrowProgram,
        },
      });

      // Restore original getContext
      HTMLCanvasElement.prototype.getContext = originalGetContext;

      sigmaRef.current = sigma;

      // Enable node dragging
      let draggedNode: string | null = null;
      let isDragging = false;

      // Change cursor on node hover
      sigma.on("enterNode", () => {
        if (containerRef.current) {
          containerRef.current.style.cursor = "grab";
        }
      });

      sigma.on("leaveNode", () => {
        if (containerRef.current && !isDragging) {
          containerRef.current.style.cursor = "default";
        }
      });

      // Mouse down - start dragging
      sigma.on("downNode", (e) => {
        isDragging = true;
        draggedNode = e.node;
        graph.setNodeAttribute(e.node, "highlighted", true);
        if (containerRef.current) {
          containerRef.current.style.cursor = "grabbing";
        }
      });

      // Mouse move - update node position
      sigma.getMouseCaptor().on("mousemovebody", (e) => {
        if (!isDragging || !draggedNode) return;

        // Get new position
        const pos = sigma.viewportToGraph(e);

        // Update node position
        graph.setNodeAttribute(draggedNode, "x", pos.x);
        graph.setNodeAttribute(draggedNode, "y", pos.y);

        // Prevent sigma from dragging the stage
        e.preventSigmaDefault();
        e.original.preventDefault();
        e.original.stopPropagation();
      });

      // Mouse up - stop dragging
      sigma.getMouseCaptor().on("mouseup", () => {
        if (draggedNode) {
          graph.removeNodeAttribute(draggedNode, "highlighted");
          draggedNode = null;
        }
        isDragging = false;
        if (containerRef.current) {
          containerRef.current.style.cursor = "default";
        }
      });

      // Handle mouse leaving the canvas
      sigma.getMouseCaptor().on("mouseleave", () => {
        if (draggedNode) {
          graph.removeNodeAttribute(draggedNode, "highlighted");
          draggedNode = null;
        }
        isDragging = false;
        if (containerRef.current) {
          containerRef.current.style.cursor = "default";
        }
      });
    } catch (error) {
      console.error("Error creating Sigma instance:", error);
      // Restore original getContext even on error
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }

    // Cleanup on unmount
    return () => {
      if (sigmaRef.current) {
        sigmaRef.current.kill();
        sigmaRef.current = null;
      }
    };
  }, [filteredData]);

  return (
    <div className="space-y-6">
      {/* Graph Container */}
      <Card className="p-4 relative">
        {/* Export Button */}
        {processedData.length > 0 && (
          <button
            onClick={exportAsPNG}
            disabled={isExporting}
            className="absolute top-6 right-6 z-10 px-4 py-2 bg-black hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-md shadow-md transition-colors flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Exporting...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export PNG
              </>
            )}
          </button>
        )}
        <div
          ref={containerRef}
          className="w-full h-[600px] bg-white rounded border flex items-center justify-center"
        >
          {csvData.length === 0 && (
            <div className="text-center text-slate-400">
              <p className="text-xl font-semibold mb-2">No data loaded</p>
              <p className="text-sm">Please upload a CSV file below to visualize career transitions</p>
            </div>
          )}
        </div>
      </Card>

      {/* Upload Section */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="csv-upload" className="text-lg font-semibold">
              Upload CSV File
            </Label>
            <div className="flex items-center gap-4 mt-2">
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              {fileName && (
                <span className="text-sm text-slate-600">
                  Loaded: {fileName}
                </span>
              )}
            </div>
          </div>

          {/* Column Selectors */}
          {columns.length > 0 && (
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <Label htmlFor="from-column" className="font-semibold">
                  From Company Column
                </Label>
                <select
                  id="from-column"
                  value={fromColumn}
                  onChange={(e) => setFromColumn(e.target.value)}
                  className="w-full mt-2 px-3 py-2 border rounded-md bg-white"
                >
                  <option value="">Select column...</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="to-column" className="font-semibold">
                  To Company Column
                </Label>
                <select
                  id="to-column"
                  value={toColumn}
                  onChange={(e) => setToColumn(e.target.value)}
                  className="w-full mt-2 px-3 py-2 border rounded-md bg-white"
                >
                  <option value="">Select column...</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="date-column" className="font-semibold">
                  Date Column (Optional)
                </Label>
                <select
                  id="date-column"
                  value={dateColumn}
                  onChange={(e) => {
                    setDateColumn(e.target.value);
                    if (!e.target.value) {
                      setDateRange([null, null]);
                      setMinDate(null);
                      setMaxDate(null);
                    }
                  }}
                  className="w-full mt-2 px-3 py-2 border rounded-md bg-white"
                >
                  <option value="">None</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Date Range Slider */}
          {dateColumn && minDate && maxDate && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <Label className="font-semibold">
                  Time Range Filter
                </Label>
                <button
                  onClick={() => setDateRange([minDate, maxDate])}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Reset
                </button>
              </div>
              <div className="space-y-6">
                {/* Date range display */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    {minDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-2 text-blue-700 font-medium">
                    <span>
                      {dateRange[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span>
                      {dateRange[1]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <span className="text-slate-600">
                    {maxDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {/* Timeline visualization */}
                <div className="relative px-2 pt-2 pb-3">
                  {/* Track */}
                  <div className="absolute top-3 left-2 right-2 h-1 bg-slate-200 rounded-full" />

                  {/* Active range */}
                  <div
                    className="absolute top-3 h-1 bg-blue-500 rounded-full"
                    style={{
                      left: `${((dateRange[0]?.getTime() || minDate.getTime()) - minDate.getTime()) / (maxDate.getTime() - minDate.getTime()) * 100}%`,
                      right: `${100 - ((dateRange[1]?.getTime() || maxDate.getTime()) - minDate.getTime()) / (maxDate.getTime() - minDate.getTime()) * 100}%`,
                    }}
                  />

                  {/* Start handle */}
                  <input
                    type="range"
                    min={minDate.getTime()}
                    max={maxDate.getTime()}
                    value={dateRange[0]?.getTime() || minDate.getTime()}
                    onChange={(e) => {
                      const newStartTime = parseInt(e.target.value);
                      const endTime = dateRange[1]?.getTime() || maxDate.getTime();
                      if (newStartTime <= endTime) {
                        setDateRange([new Date(newStartTime), dateRange[1] || maxDate]);
                      }
                    }}
                    className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white"
                  />

                  {/* End handle */}
                  <input
                    type="range"
                    min={minDate.getTime()}
                    max={maxDate.getTime()}
                    value={dateRange[1]?.getTime() || maxDate.getTime()}
                    onChange={(e) => {
                      const newEndTime = parseInt(e.target.value);
                      const startTime = dateRange[0]?.getTime() || minDate.getTime();
                      if (newEndTime >= startTime) {
                        setDateRange([dateRange[0] || minDate, new Date(newEndTime)]);
                      }
                    }}
                    className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          {processedData.length > 0 && (
            <div className="pt-4 border-t space-y-1">
              <p className="text-sm text-slate-600">
                Loaded {csvData.length} rows from {fileName} ({processedData.length} valid transitions, {processedData.filter(r => r.enabled).length} enabled)
              </p>
              <p className="text-sm text-slate-600">
                Visualizing transitions: <strong>{fromColumn}</strong> →{" "}
                <strong>{toColumn}</strong>
                {dateColumn && <> • Date: <strong>{dateColumn}</strong></>}
              </p>
              {dateColumn && dateRange[0] && dateRange[1] && (
                <p className="text-sm text-slate-600">
                  Currently showing: <strong>{filteredData.filter(r => r.enabled).length}</strong> transitions
                  {filteredData.filter(r => r.enabled).length !== processedData.filter(r => r.enabled).length &&
                    <> (filtered by date range)</>
                  }
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* CSV Data Table */}
      {processedData.length > 0 && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">CSV Data Preview</h2>
              <div className="w-64">
                <Input
                  type="text"
                  placeholder="Search companies..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="max-h-[400px] overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Enable</TableHead>
                    <TableHead className="font-bold">{fromColumn}</TableHead>
                    <TableHead className="font-bold">{toColumn}</TableHead>
                    {dateColumn && <TableHead className="font-bold">{dateColumn}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((row) => (
                    <TableRow key={row.index}>
                      <TableCell>
                        <Checkbox
                          checked={row.enabled}
                          onCheckedChange={() => toggleRow(row.index)}
                        />
                      </TableCell>
                      <TableCell>{row.fromValue}</TableCell>
                      <TableCell>{row.toValue}</TableCell>
                      {dateColumn && (
                        <TableCell className="text-slate-600">
                          {row.date ? row.date.toLocaleDateString() : 'N/A'}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-sm text-slate-600">
              Showing {filteredData.length} of {processedData.length} transitions
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
