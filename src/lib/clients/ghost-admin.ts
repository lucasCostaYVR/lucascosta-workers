import { SignJWT } from 'jose';
import type { Bindings } from '../../types';

/**
 * Generates a Ghost Admin API JWT token
 */
async function generateGhostToken(key: string): Promise<string> {
  const [id, secret] = key.split(':');
  
  const secretBytes = Uint8Array.from(
    secret.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', kid: id, typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .setAudience('/admin/')
    .sign(secretBytes);

  return token;
}

/**
 * Unsubscribes a member from all newsletters in Ghost
 */
export async function unsubscribeGhostMember(env: Bindings, email: string): Promise<void> {
    if (!env.GHOST_ADMIN_API_KEY || !env.GHOST_API_URL) {
        console.warn('Ghost Admin API credentials not configured');
        return;
    }

    const token = await generateGhostToken(env.GHOST_ADMIN_API_KEY);
    
    // 1. Find member by email to get ID
    const searchUrl = `${env.GHOST_API_URL}/ghost/api/admin/members/?filter=email:'${email}'`;
    
    const searchRes = await fetch(searchUrl, {
        headers: {
            'Authorization': `Ghost ${token}`
        }
    });
    
    if (!searchRes.ok) {
        throw new Error(`Failed to search Ghost member: ${searchRes.statusText}`);
    }
    
    const searchData = await searchRes.json() as { members: { id: string, newsletters: any[] }[] };
    const member = searchData.members[0];
    
    if (!member) {
        console.warn(`Ghost member not found for email: ${email}`);
        return;
    }
    
    // 2. Update member to unsubscribe from all newsletters
    const updateUrl = `${env.GHOST_API_URL}/ghost/api/admin/members/${member.id}/`;
    
    const updateRes = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `Ghost ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            members: [{
                newsletters: [] // Empty array to unsubscribe from all
            }]
        })
    });
    
    if (!updateRes.ok) {
        throw new Error(`Failed to unsubscribe Ghost member: ${updateRes.statusText}`);
    }
    
    console.info(`Successfully unsubscribed Ghost member: ${email}`);
}
