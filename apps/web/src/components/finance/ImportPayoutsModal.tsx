import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Upload, FileText, Loader2, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ImportPayoutsModalProps {
  open: boolean;
  onClose: () => void;
}

interface PDFReport {
  channel: 'airbnb' | 'vrbo';
  reportPeriod: string;
  totalGrossEarnings: number;
  totalNetEarnings: number;
  properties: {
    propertyName: string;
    grossEarnings: number;
    totalEarnings: number;
    nightsBooked?: number;
  }[];
}

interface PDFParseResponse {
  needsMapping: boolean;
  report: PDFReport;
}

export function ImportPayoutsModal({ open, onClose }: ImportPayoutsModalProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'success'>('upload');
  const [propertyId, setPropertyId] = useState('');
  const [channel, setChannel] = useState<'airbnb' | 'vrbo' | ''>('');
  const [fileContent, setFileContent] = useState('');
  const [fileType, setFileType] = useState<'csv' | 'pdf'>('csv');
  const [fileName, setFileName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [pdfReport, setPdfReport] = useState<PDFReport | null>(null);
  const [propertyMappings, setPropertyMappings] = useState<{ pdfPropertyName: string; propertyId: string }[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);

  const queryClient = useQueryClient();

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/properties'),
  });

  // CSV import mutation
  const csvMutation = useMutation({
    mutationFn: (data: { csvContent: string; propertyId: string; channel?: 'airbnb' | 'vrbo' }) =>
      api.post<{ imported: number; skipped: number; total: number }>('/finance/import', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['import-status'] });
      setImportResult(data);
      setStep('success');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Import failed');
    },
  });

  // PDF parse mutation (first step)
  const pdfParseMutation = useMutation({
    mutationFn: (data: { pdfBase64: string }) =>
      api.post<PDFParseResponse>('/finance/import/pdf', data),
    onSuccess: (data) => {
      if (data.needsMapping && data.report) {
        setPdfReport(data.report);
        // Initialize mappings
        setPropertyMappings(
          data.report.properties.map((p) => ({ pdfPropertyName: p.propertyName, propertyId: '' }))
        );
        setStep('mapping');
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to parse PDF');
    },
  });

  // PDF import mutation (after mapping)
  const pdfImportMutation = useMutation({
    mutationFn: (data: { pdfBase64: string; propertyMappings: { pdfPropertyName: string; propertyId: string }[] }) =>
      api.post<{ imported: number; skipped: number; total: number }>('/finance/import/pdf', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['import-status'] });
      setImportResult(data);
      setStep('success');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Import failed');
    },
  });

  const mutation = csvMutation; // For backward compatibility

  const handleClose = () => {
    setStep('upload');
    setPropertyId('');
    setChannel('');
    setFileContent('');
    setFileType('csv');
    setFileName('');
    setError('');
    setPdfReport(null);
    setPropertyMappings([]);
    setImportResult(null);
    csvMutation.reset();
    pdfParseMutation.reset();
    pdfImportMutation.reset();
    onClose();
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const isPDF = file.name.toLowerCase().endsWith('.pdf');
    const isCSV = file.name.toLowerCase().endsWith('.csv');

    if (!isPDF && !isCSV) {
      setError('Please upload a CSV or PDF file');
      return;
    }

    setFileName(file.name);
    setError('');
    setFileType(isPDF ? 'pdf' : 'csv');

    // Auto-detect channel from filename
    const lowerName = file.name.toLowerCase();
    if (lowerName.includes('airbnb')) {
      setChannel('airbnb');
    } else if (lowerName.includes('vrbo') || lowerName.includes('homeaway')) {
      setChannel('vrbo');
    }

    const reader = new FileReader();
    
    if (isPDF) {
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        setFileContent(base64);
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setFileContent(content);
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fileContent) {
      setError('Please upload a file');
      return;
    }

    if (fileType === 'pdf') {
      // For PDF, first parse it to get property list
      pdfParseMutation.mutate({ pdfBase64: fileContent });
    } else {
      // For CSV, we need a property selected
      if (!propertyId) {
        setError('Please select a property');
        return;
      }

      csvMutation.mutate({
        csvContent: fileContent,
        propertyId,
        channel: channel || undefined,
      });
    }
  };

  const handleMappingSubmit = () => {
    setError('');

    // Validate all mappings are set
    const unmapped = propertyMappings.filter((m) => !m.propertyId);
    if (unmapped.length > 0) {
      setError(`Please map all properties. ${unmapped.length} still need mapping.`);
      return;
    }

    pdfImportMutation.mutate({
      pdfBase64: fileContent,
      propertyMappings,
    });
  };

  const updateMapping = (pdfPropertyName: string, propertyId: string) => {
    setPropertyMappings((prev) =>
      prev.map((m) => (m.pdfPropertyName === pdfPropertyName ? { ...m, propertyId } : m))
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-card rounded-xl border border-border w-full max-w-lg p-6 animate-in">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-accent transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-display font-bold mb-2">Import Payouts</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Upload your earnings PDF or payout CSV from Airbnb or Vrbo
        </p>

        {step === 'success' && importResult ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Import Complete!</h3>
            <p className="text-muted-foreground mb-4">
              {importResult.imported} payouts imported, {importResult.skipped} duplicates skipped
            </p>
            <button
              onClick={handleClose}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Done
            </button>
          </div>
        ) : step === 'mapping' && pdfReport ? (
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* Report Summary */}
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                PDF Parsed Successfully!
              </p>
              <p className="text-sm text-muted-foreground">
                Found {pdfReport.properties.length} properties with ${pdfReport.totalNetEarnings.toLocaleString()} total earnings
              </p>
              {pdfReport.reportPeriod && (
                <p className="text-xs text-muted-foreground mt-1">Period: {pdfReport.reportPeriod}</p>
              )}
            </div>

            {/* Property Mapping */}
            <div>
              <label className="block text-sm font-medium mb-3">
                Map PDF properties to your UnifiedStay properties:
              </label>
              <div className="space-y-3">
                {pdfReport.properties.map((pdfProp) => (
                  <div key={pdfProp.propertyName} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{pdfProp.propertyName}</p>
                      <p className="text-xs text-muted-foreground">
                        ${pdfProp.totalEarnings.toLocaleString()} earned
                        {pdfProp.nightsBooked && ` • ${pdfProp.nightsBooked} nights`}
                      </p>
                    </div>
                    <ArrowRight size={16} className="text-muted-foreground" />
                    <select
                      value={propertyMappings.find((m) => m.pdfPropertyName === pdfProp.propertyName)?.propertyId || ''}
                      onChange={(e) => updateMapping(pdfProp.propertyName, e.target.value)}
                      className="w-40 px-3 py-2 rounded-lg border border-input bg-background text-sm"
                    >
                      <option value="">Select property...</option>
                      {properties?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="flex-1 py-2.5 rounded-lg border border-border font-medium hover:bg-accent transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleMappingSubmit}
                disabled={pdfImportMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {pdfImportMutation.isPending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import Earnings'
                )}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* Property Selection (only shown for CSV files) */}
            {fileType === 'csv' && (
              <div>
                <label className="block text-sm font-medium mb-2">Property</label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                >
                  <option value="">Select a property</option>
                  {properties?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Channel Selection (only for CSV files, PDF auto-detects) */}
            {fileType === 'csv' && (
              <div>
                <label className="block text-sm font-medium mb-2">Platform (auto-detected)</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel('airbnb')}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg border-2 font-medium transition-colors',
                      channel === 'airbnb'
                        ? 'border-[#FF5A5F] bg-[#FF5A5F]/10 text-[#FF5A5F]'
                        : 'border-border hover:border-[#FF5A5F]/50'
                    )}
                  >
                    Airbnb
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('vrbo')}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg border-2 font-medium transition-colors',
                      channel === 'vrbo'
                        ? 'border-[#3D67FF] bg-[#3D67FF]/10 text-[#3D67FF]'
                        : 'border-border hover:border-[#3D67FF]/50'
                    )}
                  >
                    Vrbo
                  </button>
                </div>
              </div>
            )}

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">Earnings Report (PDF or CSV)</label>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                  dragActive
                    ? 'border-primary bg-primary/5'
                    : fileName
                    ? 'border-green-500 bg-green-500/5'
                    : 'border-border hover:border-primary/50'
                )}
              >
                {fileName ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-green-500" />
                      <span className="font-medium">{fileName}</span>
                    </div>
                    {fileType === 'pdf' && (
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                        PDF - Will auto-detect properties
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Drag & drop your PDF or CSV file here, or
                    </p>
                    <label className="inline-block px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium cursor-pointer hover:bg-primary/20 transition-colors">
                      Browse Files
                      <input
                        type="file"
                        accept=".csv,.pdf"
                        onChange={handleFileInput}
                        className="hidden"
                      />
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Help Text */}
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium mb-2">How to get your earnings report:</p>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <strong>Airbnb PDF:</strong> Earnings → View Earnings Report → Download PDF
                  <span className="text-xs block text-green-600 mt-0.5">✓ Recommended - includes all properties</span>
                </li>
                <li>
                  <strong>Airbnb CSV:</strong> Earnings → Transaction History → Download CSV
                </li>
                <li>
                  <strong>Vrbo:</strong> Financials → Statements → Export
                </li>
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-lg border border-border font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  (csvMutation.isPending || pdfParseMutation.isPending) || 
                  !fileContent || 
                  (fileType === 'csv' && !propertyId)
                }
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {(csvMutation.isPending || pdfParseMutation.isPending) ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {fileType === 'pdf' ? 'Parsing PDF...' : 'Importing...'}
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    {fileType === 'pdf' ? 'Parse PDF' : 'Import Payouts'}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

