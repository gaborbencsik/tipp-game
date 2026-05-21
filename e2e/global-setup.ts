import { ensureUser, deleteAllMyGroups } from './helpers/api.js'

export default async function globalSetup(): Promise<void> {
  await ensureUser()
  await deleteAllMyGroups()
}
