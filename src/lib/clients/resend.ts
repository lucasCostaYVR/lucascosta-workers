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
