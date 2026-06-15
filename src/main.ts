import { config } from 'dotenv';
import { google } from 'googleapis';

config({ path: '.env', quiet: true });

async function main() {
  try {
    const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: 'Rahul P!A6:Z',
    });

    const rows = result.data.values;

    if (!rows || rows.length === 0) {
      console.log('No data found');
      return;
    }

    // Check

    console.log('Data: ', rows);
  } catch (err) {
    console.log('Failed to get data');
    console.log('Error: ', err);
  }
}

main();
