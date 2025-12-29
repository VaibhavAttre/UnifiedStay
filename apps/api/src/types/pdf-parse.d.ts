declare module 'pdf-parse' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: {
      PDFFormatVersion: string;
      IsAcroFormPresent: boolean;
      IsXFAPresent: boolean;
      Title?: string;
      Author?: string;
      Creator?: string;
      Producer?: string;
      CreationDate?: string;
      ModDate?: string;
    };
    metadata: Record<string, unknown> | null;
    text: string;
    version: string;
  }

  function parse(dataBuffer: Buffer, options?: Record<string, unknown>): Promise<PDFData>;

  export = parse;
}

