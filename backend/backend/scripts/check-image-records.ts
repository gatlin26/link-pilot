import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { imageRecord } from '../src/db/schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema: { imageRecord } });

async function checkRecords() {
  try {
    const records = await db.select().from(imageRecord).limit(5);
    console.log(`Total image records: ${records.length}`);
    if (records.length > 0) {
      console.log('Sample records:', JSON.stringify(records, null, 2));
    } else {
      console.log('No image records found in database.');
      console.log('You need to generate some images first.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkRecords();
