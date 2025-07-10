import React, { useState, useCallback } from 'react';
import { RenameMethod, type ProcessedFile, FileProcessStatus, type LogEntry } from './types';
import FileUploader from './components/FileUploader';
import SettingsPanel from './components/SettingsPanel';
import ActionButtons from './components/ActionButtons';
import ResultsTable from './components/ResultsTable';
import LogArea from './components/LogArea';
import { extractTextFromPdf } from './services/pdfService';
import { getNewFilename } from './services/renameService';

// Declare JSZip for TypeScript since it's loaded from a CDN
declare const JSZip: any;


export default function App() {
  const [results, setResults] = useState<ProcessedFile[]>([]);
  const [renameMethod, setRenameMethod] = useState<RenameMethod>(RenameMethod.AI);
  const [customPattern, setCustomPattern] = useState<string>("Invoice No:\\s*([A-Z0-9-]+)");
  const [aiInstructions, setAiInstructions] = useState<string>("From the document text, find the primary identifier such as an invoice number, account number, or reference ID. The filename should be clean and not contain spaces or special characters, use hyphens instead.");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), message, type }]);
  };

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    const newResults: ProcessedFile[] = files.map(file => ({
      id: `${file.name}-${file.lastModified}`,
      originalFile: file,
      originalName: file.name,
      newName: '',
      status: FileProcessStatus.Idle,
    }));
    setResults(newResults);
    setLogs([]);
    addLog(`Loaded ${files.length} PDF file(s). Ready for processing.`);
  };
  
  const clearAll = () => {
    setResults([]);
    setLogs([]);
  };

  const processFiles = useCallback(async (previewOnly: boolean) => {
    if (results.length === 0) {
      addLog("No files to process. Please upload PDFs first.", "error");
      return;
    }

    setIsProcessing(true);
    if (previewOnly) {
      addLog("Starting rename PREVIEW...");
    } else {
      addLog("Starting file processing for download...");
    }

    const updatedResults: ProcessedFile[] = [...results];

    for (let i = 0; i < updatedResults.length; i++) {
      const result = updatedResults[i];
      
      // Reset status for re-processing
      result.status = FileProcessStatus.Processing;
      result.newName = '';
      setResults([...updatedResults]);

      addLog(`Processing: ${result.originalName}`);

      try {
        const text = await extractTextFromPdf(result.originalFile);
        if(!text) {
          throw new Error("Could not extract text from PDF.");
        }

        const newName = await getNewFilename(text, renameMethod, { customPattern, aiInstructions });

        if (newName) {
          result.newName = `${newName}.pdf`;
          result.status = FileProcessStatus.Success;
          addLog(`Found name for ${result.originalName} -> ${result.newName}`, 'success');
        } else {
          result.status = FileProcessStatus.NoMatch;
          addLog(`No match found for: ${result.originalName}`, 'error');
        }
      } catch (error) {
        result.status = FileProcessStatus.Error;
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        result.message = errorMessage;
        addLog(`Error processing ${result.originalName}: ${errorMessage}`, 'error');
      }
      setResults([...updatedResults]);
    }
    
    addLog("Processing complete.");
    setIsProcessing(false);
    
    if(!previewOnly) {
      handleDownloadZip();
    }
  }, [results, renameMethod, customPattern, aiInstructions]);


  const handleDownloadZip = async () => {
    const filesToZip = results.filter(r => r.status === FileProcessStatus.Success);
    if (filesToZip.length === 0) {
      addLog("No files were successfully renamed to include in a ZIP.", "error");
      return;
    }

    addLog(`Creating ZIP archive with ${filesToZip.length} files...`);
    setIsProcessing(true);

    try {
      const zip = new JSZip();
      
      // Handle potential duplicate new names
      const nameCounts: { [key: string]: number } = {};
      
      for(const result of filesToZip) {
          let finalName = result.newName;
          if (nameCounts[finalName]) {
              const count = nameCounts[finalName];
              const nameWithoutExt = finalName.replace(/\.pdf$/, '');
              finalName = `${nameWithoutExt}_${count}.pdf`;
              nameCounts[result.newName]++;
          } else {
              nameCounts[result.newName] = 1;
          }
          zip.file(finalName, result.originalFile);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `renamed_pdfs_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addLog("ZIP file download initiated.", "success");
    } catch(error) {
       const errorMessage = error instanceof Error ? error.message : "An unknown ZIP error occurred.";
       addLog(`Failed to create ZIP file: ${errorMessage}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <div className="min-h-screen bg-dark-100 text-dark-content">
      <main className="container mx-auto p-4 md:p-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-500">
            AI-Powered PDF Renamer
          </h1>
          <p className="mt-2 text-lg text-slate-400">
            Bulk rename PDFs intelligently using custom rules or Gemini AI.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
                 <div className="bg-dark-200 p-6 rounded-lg border border-dark-300">
                    <h2 className="text-xl font-semibold mb-4 text-slate-200">1. Upload Files</h2>
                    <FileUploader onFilesSelected={handleFilesSelected} isProcessing={isProcessing} />
                </div>
                <div className="bg-dark-200 p-6 rounded-lg border border-dark-300">
                    <h2 className="text-xl font-semibold mb-4 text-slate-200">2. Configure</h2>
                    <SettingsPanel
                        renameMethod={renameMethod}
                        setRenameMethod={setRenameMethod}
                        customPattern={customPattern}
                        setCustomPattern={setCustomPattern}
                        aiInstructions={aiInstructions}
                        setAiInstructions={setAiInstructions}
                        isProcessing={isProcessing}
                    />
                </div>
                <div className="bg-dark-200 p-6 rounded-lg border border-dark-300">
                    <h2 className="text-xl font-semibold mb-4 text-slate-200">3. Execute</h2>
                    <ActionButtons
                      onPreview={() => processFiles(true)}
                      onDownload={() => processFiles(false)}
                      onClear={clearAll}
                      isProcessing={isProcessing}
                      hasFiles={results.length > 0}
                    />
                </div>
            </div>

            <div className="lg:col-span-8">
                <div className="bg-dark-200 p-1 rounded-lg border border-dark-300 min-h-[600px] flex flex-col">
                    <div className="flex-grow">
                        <ResultsTable results={results} />
                    </div>
                    <div className="flex-shrink-0 border-t border-dark-300">
                         <LogArea logs={logs} />
                    </div>
                </div>
            </div>
        </div>
        
        <footer className="text-center mt-12 text-slate-500">
            <p>Powered by React, Tailwind CSS, and Google Gemini</p>
        </footer>
      </main>
    </div>
  );
}