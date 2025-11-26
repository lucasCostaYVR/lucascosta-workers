# Weekly Traffic Pulse - Notion Database Setup

## Columns to Create

Go to your **Weekly Traffic Pulse** database in Notion and add these columns:

| Column Name | Type | Description |
|-------------|------|-------------|
| **Period** | Title | The time period (e.g., "Last 7 Days") |
| **Page Views** | Number | Total page views this week |
| **Active Users** | Number | Unique visitors |
| **New Subscribers** | Number | Newsletter signups |
| **Views Growth** | Number | Change vs previous week |
| **Subs Growth** | Number | Subscriber change vs previous week |

## How to Add Columns

1. Open your Weekly Traffic Pulse database in Notion
2. Click the `+` button at the far right of the header row
3. Name the column exactly as shown above
4. Select the type from the dropdown
5. Repeat for all 6 columns

## Testing

Once you've added all columns, run:

```bash
node scripts/test_weekly_pulse_export.js
```

This will create a test entry in your database with real data from Supabase!
