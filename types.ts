export enum RenameMethod {
  BankAccount = "bank_account",
  Custom = "custom",
  AI = "ai",
}

export enum FileProcessStatus {
  Idle = "Idle",
  Processing = "Processing",
  Success = "Success",
  Error = "Error",
  NoMatch = "No Match Found",
}

export interface ProcessedFile {
  id: string;
  originalFile: File;
  originalName: string;
  newName: string;
  status: FileProcessStatus;
  message?: string;
}

export type LogEntry = {
  id: number;
  message: string;
  type: 'info' | 'error' | 'success';
};