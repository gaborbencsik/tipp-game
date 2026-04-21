import { db } from '../db/client.js'
import { waitlistEntries } from '../db/schema/index.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 255
}

export async function addToWaitlist(email: string, source: 'hero' | 'footer'): Promise<void> {
  await db
    .insert(waitlistEntries)
    .values({ email: email.toLowerCase().trim(), source })
    .onConflictDoNothing()
}
