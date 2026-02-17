#!/usr/bin/env node

/**
 * Partner Data Cleanup Script
 * 
 * Deletes all data associated with a specific partner UUID
 * 
 * Usage:
 *   node scripts/cleanup-partner.js <partner-uuid> [--dry-run]
 * 
 * Examples:
 *   node scripts/cleanup-partner.js 0b5ef92c-ac1e-4f84-b082-e02b5daf282f --dry-run
 *   node scripts/cleanup-partner.js 0b5ef92c-ac1e-4f84-b082-e02b5daf282f
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import readline from 'readline';

// ANSI color codes for better output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

const log = {
    info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
    section: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
    detail: (msg) => console.log(`  ${colors.gray}${msg}${colors.reset}`),
};

// Parse command line arguments
const args = process.argv.slice(2);
const partnerUuid = args[0];
const isDryRun = args.includes('--dry-run');

if (!partnerUuid) {
    console.error(`${colors.red}Error: Partner UUID is required${colors.reset}`);
    console.log('\nUsage: node scripts/cleanup-partner.js <partner-uuid> [--dry-run]');
    process.exit(1);
}

// Validate UUID format
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(partnerUuid)) {
    log.error('Invalid UUID format');
    process.exit(1);
}

// Initialize Supabase client with service role key
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    log.error('Missing environment variables: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Helper function to ask for confirmation
function askConfirmation(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${colors.yellow}${question} (yes/no): ${colors.reset}`, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes');
        });
    });
}

// Main cleanup function
async function cleanupPartnerData() {
    log.section('═══════════════════════════════════════════════════════');
    log.section('  PARTNER DATA CLEANUP SCRIPT');
    log.section('═══════════════════════════════════════════════════════');
    console.log();

    if (isDryRun) {
        log.warning('DRY RUN MODE - No data will be deleted');
        console.log();
    }

    // Step 1: Validate partner exists and get info
    log.section('Step 1: Validating Partner');
    const { data: partner, error: partnerError } = await supabase
        .from('partners')
        .select('partner_uuid, company_name, first_name, second_name, email')
        .eq('partner_uuid', partnerUuid)
        .single();

    if (partnerError || !partner) {
        log.error(`Partner UUID ${partnerUuid} not found!`);
        process.exit(1);
    }

    const partnerName = partner.company_name || `${partner.first_name} ${partner.second_name || ''}`.trim();
    log.success(`Found partner: ${colors.bright}${partnerName}${colors.reset}`);
    log.detail(`Email: ${partner.email}`);
    log.detail(`UUID: ${partnerUuid}`);

    // Step 2: Count records to be deleted
    log.section('Step 2: Analyzing Data');

    const counts = {};
    const tables = [
        'customers',
        'contracts',
        'bookings',
        'package_reservations',
        'services',
        'locations',
        'location_resources',
        'location_images',
        'location_operating_schedules',
        'resource_operating_schedules',
        'operating_closures',
        'email_templates',
        'customers_discount_codes',
        'partner_resource_types',
        'invitations',
        'notifications',
        'notification_templates',
        'partners_payments',
        'partners_contracts',
        'partners_customer_activity_log',
        'activity_logs',
    ];

    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq('partner_uuid', partnerUuid);

        if (!error && count > 0) {
            counts[table] = count;
            log.detail(`${table}: ${colors.yellow}${count}${colors.reset} records`);
        }
    }

    const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0);

    if (totalRecords === 0) {
        log.warning('No records found for this partner');
        return;
    }

    console.log();
    log.info(`Total records to delete: ${colors.bright}${colors.red}${totalRecords}${colors.reset}`);
    console.log();

    // Step 3: Confirm deletion
    if (!isDryRun) {
        log.section('Step 3: Confirmation');
        log.warning('⚠️  THIS ACTION CANNOT BE UNDONE! ⚠️');
        console.log();

        const confirmed = await askConfirmation(`Are you sure you want to delete ALL data for "${partnerName}"?`);

        if (!confirmed) {
            log.info('Operation cancelled by user');
            process.exit(0);
        }
        console.log();
    }

    // Step 4: Delete data
    log.section(isDryRun ? 'Step 3: Dry Run Summary' : 'Step 4: Deleting Data');

    if (isDryRun) {
        log.info('The following deletions would be performed:');
        for (const [table, count] of Object.entries(counts)) {
            log.detail(`Would delete ${count} records from ${table}`);
        }
        log.success('Dry run completed successfully');
        return;
    }

    const deletionOrder = [
        // Delete child records first
        { table: 'package_reservations', column: 'partner_uuid' },
        { table: 'bookings', column: 'partner_uuid' },
        { table: 'contract_fattureincloud_uploads', subquery: 'contract_id IN (SELECT id FROM contracts WHERE partner_uuid = $1)' },
        { table: 'contract_renewal_log', subquery: 'original_contract_id IN (SELECT id FROM contracts WHERE partner_uuid = $1)' },
        { table: 'contracts', column: 'partner_uuid' },
        { table: 'customers_discount_codes', column: 'partner_uuid' },
        { table: 'customers', column: 'partner_uuid' },
        { table: 'notification_views', subquery: 'notification_id IN (SELECT id FROM notifications WHERE partner_uuid = $1)' },
        { table: 'notification_recipients', subquery: 'notification_id IN (SELECT id FROM notifications WHERE partner_uuid = $1)' },
        { table: 'notifications', column: 'partner_uuid' },
        { table: 'notification_templates', column: 'partner_uuid' },
        { table: 'location_images', subquery: 'location_id IN (SELECT id FROM locations WHERE partner_uuid = $1)' },
        { table: 'location_operating_schedules', subquery: 'location_id IN (SELECT id FROM locations WHERE partner_uuid = $1)' },
        { table: 'operating_closures', subquery: 'location_id IN (SELECT id FROM locations WHERE partner_uuid = $1)' },
        { table: 'resource_operating_schedules', column: 'partner_uuid' },
        { table: 'location_resources', subquery: 'location_id IN (SELECT id FROM locations WHERE partner_uuid = $1)' },
        { table: 'services', column: 'partner_uuid' },
        { table: 'locations', column: 'partner_uuid' },
        { table: 'partner_resource_types', column: 'partner_uuid' },
        { table: 'email_templates', column: 'partner_uuid' },
        { table: 'calendar_tokens', subquery: 'user_id IN (SELECT id FROM profiles WHERE partner_uuid = $1)' },
        { table: 'activity_logs', column: 'partner_uuid' },
        { table: 'partners_customer_activity_log', column: 'partner_uuid' },
        { table: 'partners_payments', column: 'partner_uuid' },
        { table: 'partners_contracts', column: 'partner_uuid' },
        { table: 'invitations', column: 'partner_uuid' },
        // Finally delete the partner
        { table: 'partners', column: 'partner_uuid' },
    ];

    let deletedCount = 0;

    for (const { table, column, subquery } of deletionOrder) {
        try {
            if (subquery) {
                // For complex subqueries, we need to use RPC or raw SQL
                // For now, skip these as they're handled by CASCADE
                continue;
            }

            const { error, count } = await supabase
                .from(table)
                .delete({ count: 'exact' })
                .eq(column, partnerUuid);

            if (error) {
                // Ignore errors for tables that might not exist or have no records
                if (!error.message.includes('does not exist')) {
                    log.warning(`Error deleting from ${table}: ${error.message}`);
                }
            } else if (count && count > 0) {
                log.success(`Deleted ${count} records from ${table}`);
                deletedCount += count;
            }
        } catch (err) {
            log.warning(`Error deleting from ${table}: ${err.message}`);
        }
    }

    // Step 5: Verify deletion
    log.section('Step 5: Verification');
    const { data: verifyPartner } = await supabase
        .from('partners')
        .select('partner_uuid')
        .eq('partner_uuid', partnerUuid)
        .single();

    if (verifyPartner) {
        log.error('Partner record still exists! Deletion may have failed.');
        process.exit(1);
    }

    log.section('═══════════════════════════════════════════════════════');
    log.success('Partner data deleted successfully!');
    log.section('═══════════════════════════════════════════════════════');
    log.info(`Total records deleted: ${deletedCount}`);
    console.log();
}

// Run the script
cleanupPartnerData().catch((error) => {
    log.error(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
});
