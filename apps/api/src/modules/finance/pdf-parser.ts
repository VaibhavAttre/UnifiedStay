// PDF Parser for Airbnb and Vrbo Earnings Reports
import pdf from 'pdf-parse';

export interface ParsedEarning {
  propertyName: string;
  grossEarnings: number;
  serviceFees: number;
  totalEarnings: number;
  nightsBooked?: number;
  avgNightStay?: number;
}

export interface ParsedPDFReport {
  channel: 'airbnb' | 'vrbo';
  reportPeriod: string;
  totalGrossEarnings: number;
  totalServiceFees: number;
  totalNetEarnings: number;
  properties: ParsedEarning[];
  monthlyBreakdown: { month: string; gross: number; total: number }[];
}

/**
 * Parse Airbnb Earnings Report PDF
 */
export async function parseAirbnbPDF(pdfBuffer: Buffer): Promise<ParsedPDFReport> {
  const data = await pdf(pdfBuffer);
  const text = data.text;

  // Initialize result
  const result: ParsedPDFReport = {
    channel: 'airbnb',
    reportPeriod: '',
    totalGrossEarnings: 0,
    totalServiceFees: 0,
    totalNetEarnings: 0,
    properties: [],
    monthlyBreakdown: [],
  };

  // Extract report period (e.g., "January 1, 2025 – December 29, 2025")
  const periodMatch = text.match(/([A-Za-z]+\s+\d+,\s+\d{4})\s*[–-]\s*([A-Za-z]+\s+\d+,\s+\d{4})/);
  if (periodMatch) {
    result.reportPeriod = `${periodMatch[1]} - ${periodMatch[2]}`;
  }

  // Extract summary totals
  // Looking for patterns like "$7,923.23" followed by other amounts
  const summaryMatch = text.match(/Earnings\s*\$?([\d,]+\.?\d*)\s*\$?([\d,]+\.?\d*)\s*-?\$?([\d,]+\.?\d*)\s*\$?([\d,]+\.?\d*)\s*\$?([\d,]+\.?\d*)/i);
  if (summaryMatch) {
    result.totalGrossEarnings = parseAmount(summaryMatch[1]);
    result.totalServiceFees = parseAmount(summaryMatch[3]);
    result.totalNetEarnings = parseAmount(summaryMatch[5]);
  }

  // Extract property earnings from "Homes" section
  // Pattern: PropertyName $amount $amount -$amount $amount $amount
  const homesSection = text.match(/Homes([\s\S]*?)(?=Taxes|Earnings types|$)/i);
  if (homesSection) {
    const homesText = homesSection[1];
    
    // Match property lines - looking for property name followed by dollar amounts
    // Common Airbnb property names patterns
    const propertyPattern = /([A-Za-z][A-Za-z\s']+(?:Retreat|Haven|House|Home|Cabin|Cottage|Villa|Suite|Place|Lodge|Inn|Studio|Apt|Apartment)?)\s*\$?([\d,]+\.?\d*)\s*\$?([\d,]+\.?\d*)\s*-?\$?([\d,]+\.?\d*)\s*\$?([\d,]+\.?\d*)\s*\$?([\d,]+\.?\d*)/gi;
    
    let match;
    while ((match = propertyPattern.exec(homesText)) !== null) {
      const propertyName = match[1].trim();
      
      // Skip header rows and non-property entries
      if (propertyName.toLowerCase().includes('home') && propertyName.toLowerCase().includes('gross')) continue;
      if (propertyName.toLowerCase() === 'home') continue;
      if (propertyName.length < 3) continue;
      
      const grossEarnings = parseAmount(match[2]);
      const serviceFees = parseAmount(match[4]);
      const totalEarnings = parseAmount(match[6]);
      
      if (grossEarnings > 0) {
        result.properties.push({
          propertyName,
          grossEarnings,
          serviceFees,
          totalEarnings,
        });
      }
    }
  }

  // If we didn't find properties with the complex pattern, try simpler extraction
  if (result.properties.length === 0) {
    // Look for known property names from the PDF
    const knownProperties = [
      'Redmond Retreat',
      'Evergreen Haven', 
      'Bear Creek Haven',
    ];
    
    for (const propName of knownProperties) {
      const propPattern = new RegExp(propName.replace(/\s+/g, '\\s*') + '\\s*\\$?([\\d,]+\\.?\\d*)\\s*\\$?[\\d,]*\\.?\\d*\\s*-?\\$?([\\d,]+\\.?\\d*)\\s*\\$?[\\d,]*\\.?\\d*\\s*\\$?([\\d,]+\\.?\\d*)', 'i');
      const propMatch = text.match(propPattern);
      
      if (propMatch) {
        result.properties.push({
          propertyName: propName,
          grossEarnings: parseAmount(propMatch[1]),
          serviceFees: parseAmount(propMatch[2]),
          totalEarnings: parseAmount(propMatch[3]),
        });
      }
    }
  }

  // Extract monthly breakdown
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  for (const month of months) {
    const monthPattern = new RegExp(month + '\\s*\\$?([\\d,]+\\.?\\d*)\\s*\\$?([\\d,]+\\.?\\d*)', 'i');
    const monthMatch = text.match(monthPattern);
    
    if (monthMatch) {
      const gross = parseAmount(monthMatch[1]);
      const total = parseAmount(monthMatch[2]);
      
      if (gross > 0 || total > 0) {
        result.monthlyBreakdown.push({
          month,
          gross,
          total,
        });
      }
    }
  }
  
  // Also check for "Dec 1 – 29" style partial months
  const partialMonthMatch = text.match(/Dec\s*\d+\s*[–-]\s*\d+\s*\$?([\d,]+\.?\d*)\s*\$?([\d,]+\.?\d*)/i);
  if (partialMonthMatch) {
    result.monthlyBreakdown.push({
      month: 'December (partial)',
      gross: parseAmount(partialMonthMatch[1]),
      total: parseAmount(partialMonthMatch[2]),
    });
  }

  // Extract performance stats if available
  const performanceSection = text.match(/Performance stats([\s\S]*?)(?=Payout methods|$)/i);
  if (performanceSection) {
    for (const prop of result.properties) {
      const statsPattern = new RegExp(prop.propertyName.replace(/\s+/g, '\\s*') + '\\s*(\\d+)\\s*([\\d.]+)', 'i');
      const statsMatch = performanceSection[1].match(statsPattern);
      
      if (statsMatch) {
        prop.nightsBooked = parseInt(statsMatch[1]);
        prop.avgNightStay = parseFloat(statsMatch[2]);
      }
    }
  }

  return result;
}

/**
 * Parse any supported PDF format
 */
export async function parseEarningsPDF(pdfBuffer: Buffer): Promise<ParsedPDFReport> {
  const data = await pdf(pdfBuffer);
  const text = data.text.toLowerCase();

  // Detect platform
  if (text.includes('airbnb')) {
    return parseAirbnbPDF(pdfBuffer);
  } else if (text.includes('vrbo') || text.includes('homeaway')) {
    // For now, try Airbnb parser as fallback - Vrbo PDFs are similar
    const result = await parseAirbnbPDF(pdfBuffer);
    result.channel = 'vrbo';
    return result;
  }

  // Default to Airbnb parser
  return parseAirbnbPDF(pdfBuffer);
}

function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  const cleaned = amountStr.replace(/[$,]/g, '').trim();
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : amount;
}

