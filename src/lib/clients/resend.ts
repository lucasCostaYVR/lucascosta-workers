export interface ResendContactData {
  user_id: string;
  first_name?: string;
  last_name?: string;
  [key: string]: any; // Allow custom attributes
}

export async function addContactToResend(
  apiKey: string, 
  email: string, 
  profileId: string, 
  audienceId: string
) {
  const response = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      unsubscribed: false,
      data: {
        user_id: profileId // <--- The Magic Key (Resend property)
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  return response.json();
}

/**
 * Sync or update a contact in Resend with custom attributes
 * Uses upsert logic - creates if doesn't exist, updates if exists
 */
export async function syncContactToResend(
  apiKey: string,
  email: string,
  audienceId: string,
  attributes: ResendContactData
): Promise<{ id: string; email: string }> {
  const response = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      unsubscribed: false,
      ...attributes.first_name && { first_name: attributes.first_name },
      ...attributes.last_name && { last_name: attributes.last_name },
      data: attributes
    })
  });

  // Resend returns 400 if contact already exists, we need to update instead
  if (response.status === 400) {
    const errorBody = await response.json() as any;
    
    // Check if it's a duplicate contact error
    if (errorBody.message?.includes('already exists') || errorBody.message?.includes('duplicate')) {
      // Contact exists, update it instead
      return updateContactInResend(apiKey, email, audienceId, attributes);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend sync failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

/**
 * Update an existing contact in Resend by email
 */
async function updateContactInResend(
  apiKey: string,
  email: string,
  audienceId: string,
  attributes: ResendContactData
): Promise<{ id: string; email: string }> {
  // First, get the contact ID by email
  const contactId = await getContactIdByEmail(apiKey, audienceId, email);
  
  if (!contactId) {
    throw new Error(`Contact not found for email: ${email}`);
  }

  const response = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts/${contactId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...attributes.first_name && { first_name: attributes.first_name },
      ...attributes.last_name && { last_name: attributes.last_name },
      data: attributes
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend update failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

/**
 * Get contact ID by email from Resend audience
 */
async function getContactIdByEmail(
  apiKey: string,
  audienceId: string,
  email: string
): Promise<string | null> {
  const response = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts?email=${encodeURIComponent(email)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as any;
  
  // Resend returns { data: [{ id, email, ... }] }
  if (data.data && data.data.length > 0) {
    return data.data[0].id;
  }

  return null;
}
