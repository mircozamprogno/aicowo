# Partner Data Cleanup Script

This script safely deletes all data associated with a specific partner UUID from the database.

## Features

- ✅ **Dry-run mode** - Test without deleting anything
- ✅ **Interactive confirmation** - Asks for confirmation before deleting
- ✅ **Colored output** - Easy-to-read console output with colors
- ✅ **Detailed logging** - Shows exactly what's being deleted
- ✅ **Safe deletion order** - Deletes in correct order to respect foreign keys
- ✅ **Verification** - Confirms deletion was successful

## Prerequisites

You need the **Supabase Service Role Key** to run this script. 

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the **service_role** key (NOT the anon key!)
4. Add it to your `.env` file:

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

⚠️ **Warning**: The service role key bypasses Row Level Security. Keep it secret!

## Usage

### Dry Run (Recommended First)

Test the script without deleting anything:

```bash
node scripts/cleanup-partner.js <partner-uuid> --dry-run
```

Example:
```bash
node scripts/cleanup-partner.js 0b5ef92c-ac1e-4f84-b082-e02b5daf282f --dry-run
```

This will show you:
- Partner information
- How many records will be deleted from each table
- Total records to be deleted

### Actual Deletion

Once you've verified with dry-run, remove the `--dry-run` flag:

```bash
node scripts/cleanup-partner.js <partner-uuid>
```

The script will:
1. Validate the partner exists
2. Show you what will be deleted
3. Ask for confirmation (type `yes` to proceed)
4. Delete all data
5. Verify the deletion was successful

## What Gets Deleted

The script deletes data from these tables (in order):

**Bookings & Reservations:**
- `package_reservations`
- `bookings`

**Contracts:**
- `contract_fattureincloud_uploads`
- `contract_renewal_log`
- `contracts`

**Customers:**
- `customers_discount_codes`
- `customers`

**Notifications:**
- `notification_views`
- `notification_recipients`
- `notifications`
- `notification_templates`

**Locations & Resources:**
- `location_images`
- `location_operating_schedules`
- `operating_closures`
- `resource_operating_schedules`
- `location_resources`
- `services`
- `locations`

**Partner Configuration:**
- `partner_resource_types`
- `email_templates`
- `calendar_tokens`

**Activity & Billing:**
- `activity_logs`
- `partners_customer_activity_log`
- `partners_payments`
- `partners_contracts`

**Invitations:**
- `invitations`

**Partner Record:**
- `partners`

## What Does NOT Get Deleted

- **User profiles** - Must be deleted manually from Supabase Auth
- **Global tables** - Tables without partner references (e.g., `partners_discount_codes`, `contract_status_update_log`, `partners_billing_executions`)

## Example Output

```
═══════════════════════════════════════════════════════════
  PARTNER DATA CLEANUP SCRIPT
═══════════════════════════════════════════════════════════

⚠ DRY RUN MODE - No data will be deleted

Step 1: Validating Partner
✓ Found partner: Acme Corporation
  Email: acme@example.com
  UUID: 0b5ef92c-ac1e-4f84-b082-e02b5daf282f

Step 2: Analyzing Data
  customers: 15 records
  contracts: 23 records
  bookings: 45 records
  services: 8 records
  locations: 3 records

ℹ Total records to delete: 94

Step 3: Dry Run Summary
ℹ The following deletions would be performed:
  Would delete 15 records from customers
  Would delete 23 records from contracts
  Would delete 45 records from bookings
  Would delete 8 records from services
  Would delete 3 records from locations
✓ Dry run completed successfully
```

## Troubleshooting

**Error: Missing environment variables**
- Make sure `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are in your `.env` file

**Error: Partner UUID not found**
- Double-check the UUID is correct
- Make sure you're using the partner_uuid, not the partner ID

**Error: Permission denied**
- Make sure you're using the **service_role** key, not the anon key
- The service role key is required to bypass RLS

## Safety Notes

⚠️ **This operation is IRREVERSIBLE!**

- Always run with `--dry-run` first
- Double-check the partner UUID
- Consider creating a database backup before running
- The script will ask for confirmation before deleting

## Manual Cleanup Required

After running this script, you may need to manually:

1. **Delete auth users** - Go to Supabase Dashboard → Authentication → Users
2. **Review global logs** - Some audit logs are kept for compliance
