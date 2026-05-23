import { connect, connection } from 'mongoose'

const MONGO_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/blog'

async function main() {
  await connect(MONGO_URI)
  const db = connection.db
  if (!db) throw new Error('No DB connection')
  const result = await db.collection('posts').deleteMany({})
  console.log(`Deleted ${result.deletedCount} posts`)
  await connection.close()
}

main().catch(console.error)
