import { app } from './app.js'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from './db/client.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT ?? '3000', 10)

async function start(): Promise<void> {
  try {
    console.log('Running migrations...')
    await migrate(db, {
      migrationsFolder: path.join(__dirname, 'db', 'migrations'),
    })
    console.log('Migrations complete.')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  }

  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`)
  })
}

start()
