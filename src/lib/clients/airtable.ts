/**
 * Airtable API Client
 * Handles fetching and transforming Airtable records
 */

export interface AirtableRecord<T = any> {
  id: string;
  createdTime: string;
  fields: T;
}

export interface AirtableBannerFields {
  'Status': 'Draft' | 'Active' | 'Scheduled' | 'Expired';
  'Type': 'info' | 'warning' | 'success' | 'promo';
  'Message': string;
  'Link'?: string;
  'Link Text'?: string;
  'Dismissible': boolean;
  'Start Date'?: string;
  'End Date'?: string;
  'Priority'?: number;
  'Is Active Now'?: boolean;
}

export interface AirtableClient {
  apiKey: string;
  baseId: string;
}

/**
 * Fetch records from an Airtable table
 */
export async function fetchAirtableRecords<T = any>(
  client: AirtableClient,
  tableId: string,
  options?: {
    filterByFormula?: string;
    sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
    maxRecords?: number;
  }
): Promise<AirtableRecord<T>[]> {
  const params = new URLSearchParams();
  
  if (options?.filterByFormula) {
    params.append('filterByFormula', options.filterByFormula);
  }
  
  if (options?.sort) {
    options.sort.forEach((s, i) => {
      params.append(`sort[${i}][field]`, s.field);
      params.append(`sort[${i}][direction]`, s.direction);
    });
  }
  
  if (options?.maxRecords) {
    params.append('maxRecords', options.maxRecords.toString());
  }

  const url = `https://api.airtable.com/v0/${client.baseId}/${encodeURIComponent(tableId)}?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${client.apiKey}`,
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Airtable API error: ${error}`);
  }

  const data = await response.json() as { records: AirtableRecord<T>[] };
  return data.records;
}

/**
 * Get the active banner from Airtable
 * Looks for Status="Active" and checks if current date is within Start/End dates
 */
export async function getActiveBannerFromAirtable(
  client: AirtableClient,
  tableId: string
): Promise<AirtableBannerFields | null> {
  // Fetch active banners sorted by priority (highest first)
  const records = await fetchAirtableRecords<AirtableBannerFields>(client, tableId, {
    filterByFormula: `{Status} = 'Active'`,
    sort: [{ field: 'Priority', direction: 'desc' }],
    maxRecords: 1,
  });

  if (records.length === 0) {
    return null;
  }

  const banner = records[0].fields;
  
  // Check date range
  const now = new Date();
  
  if (banner['Start Date']) {
    const startDate = new Date(banner['Start Date']);
    if (now < startDate) {
      return null; // Not started yet
    }
  }
  
  if (banner['End Date']) {
    const endDate = new Date(banner['End Date']);
    if (now > endDate) {
      return null; // Already expired
    }
  }

  return banner;
}
