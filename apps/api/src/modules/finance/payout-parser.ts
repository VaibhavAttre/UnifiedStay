// Payout CSV parsers for Airbnb and Vrbo

export interface ParsedPayout {
  date: Date;
  amount: number;
  description: string;
  channel: 'airbnb' | 'vrbo';
  reservationRef?: string;
  guestName?: string;
}

/**
 * Parse Airbnb Transaction History CSV
 * Columns typically: Date, Type, Confirmation Code, Start Date, Nights, Guest, Listing, Details, Reference, Currency, Amount, Paid Out, Service Fee, Gross Earnings
 */
export function parseAirbnbCSV(csvContent: string): ParsedPayout[] {
  const lines = csvContent.split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const payouts: ParsedPayout[] = [];

  // Find column indices (Airbnb CSV format)
  const dateIdx = findColumnIndex(headers, ['date', 'payout date', 'transaction date']);
  const amountIdx = findColumnIndex(headers, ['amount', 'paid out', 'payout', 'gross earnings']);
  const guestIdx = findColumnIndex(headers, ['guest', 'guest name']);
  const confirmationIdx = findColumnIndex(headers, ['confirmation code', 'confirmation', 'reference']);
  const typeIdx = findColumnIndex(headers, ['type', 'transaction type']);
  const listingIdx = findColumnIndex(headers, ['listing', 'listing name']);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    
    // Parse date
    const dateStr = values[dateIdx];
    if (!dateStr) continue;
    
    const date = parseDate(dateStr);
    if (!date) continue;

    // Parse amount (remove currency symbols, handle negatives)
    const amountStr = values[amountIdx];
    const amount = parseAmount(amountStr);
    if (amount === 0) continue;

    // Only include payouts (positive amounts) or specific transaction types
    const type = typeIdx >= 0 ? values[typeIdx]?.toLowerCase() : '';
    if (type && (type.includes('resolution') || type.includes('adjustment'))) {
      // Include adjustments but mark them
    }

    const guestName = guestIdx >= 0 ? values[guestIdx] : undefined;
    const reservationRef = confirmationIdx >= 0 ? values[confirmationIdx] : undefined;
    const listing = listingIdx >= 0 ? values[listingIdx] : '';

    payouts.push({
      date,
      amount: Math.abs(amount), // Store as positive
      description: `Airbnb payout${listing ? ` - ${listing}` : ''}${guestName ? ` (${guestName})` : ''}`,
      channel: 'airbnb',
      reservationRef,
      guestName,
    });
  }

  return payouts;
}

/**
 * Parse Vrbo/VRBO Owner Statement CSV
 * Format varies but typically includes: Date, Description, Amount, etc.
 */
export function parseVrboCSV(csvContent: string): ParsedPayout[] {
  const lines = csvContent.split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const payouts: ParsedPayout[] = [];

  // Find column indices (Vrbo CSV format)
  const dateIdx = findColumnIndex(headers, ['date', 'payment date', 'transaction date', 'payout date']);
  const amountIdx = findColumnIndex(headers, ['amount', 'payout amount', 'total', 'net amount', 'owner payout']);
  const guestIdx = findColumnIndex(headers, ['guest', 'guest name', 'traveler', 'traveler name']);
  const reservationIdx = findColumnIndex(headers, ['reservation', 'reservation id', 'confirmation', 'booking id']);
  const descIdx = findColumnIndex(headers, ['description', 'type', 'transaction type']);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    
    const dateStr = values[dateIdx];
    if (!dateStr) continue;
    
    const date = parseDate(dateStr);
    if (!date) continue;

    const amountStr = values[amountIdx];
    const amount = parseAmount(amountStr);
    if (amount === 0) continue;

    const guestName = guestIdx >= 0 ? values[guestIdx] : undefined;
    const reservationRef = reservationIdx >= 0 ? values[reservationIdx] : undefined;
    const desc = descIdx >= 0 ? values[descIdx] : '';

    payouts.push({
      date,
      amount: Math.abs(amount),
      description: `Vrbo payout${desc ? ` - ${desc}` : ''}${guestName ? ` (${guestName})` : ''}`,
      channel: 'vrbo',
      reservationRef,
      guestName,
    });
  }

  return payouts;
}

/**
 * Auto-detect CSV format and parse
 */
export function parsePayoutCSV(csvContent: string, channel?: 'airbnb' | 'vrbo'): ParsedPayout[] {
  const firstLine = csvContent.split('\n')[0].toLowerCase();
  
  // Auto-detect based on headers
  if (channel === 'airbnb' || firstLine.includes('confirmation code') || firstLine.includes('airbnb')) {
    return parseAirbnbCSV(csvContent);
  } else if (channel === 'vrbo' || firstLine.includes('vrbo') || firstLine.includes('owner payout')) {
    return parseVrboCSV(csvContent);
  }
  
  // Try both and return whichever gets more results
  const airbnbResults = parseAirbnbCSV(csvContent);
  const vrboResults = parseVrboCSV(csvContent);
  
  return airbnbResults.length >= vrboResults.length ? airbnbResults : vrboResults;
}

// Helper functions

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase().trim();
    if (possibleNames.some(name => header.includes(name))) {
      return i;
    }
  }
  return -1;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try various date formats
  const formats = [
    // MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{2})-(\d{2})$/,
    // DD/MM/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // Mon DD, YYYY
    /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/,
  ];
  
  // Try standard Date parsing first
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  return null;
}

function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  
  // Remove currency symbols, spaces, and handle parentheses for negatives
  let cleaned = amountStr
    .replace(/[$€£¥]/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();
  
  // Handle parentheses as negative (accounting format)
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegative) {
    cleaned = cleaned.slice(1, -1);
  }
  
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : (isNegative ? -amount : amount);
}

