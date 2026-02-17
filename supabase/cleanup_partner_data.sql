-- =====================================================
-- Partner Data Cleanup Script
-- =====================================================
-- This script deletes ALL data related to a specific partner_uuid
-- WARNING: This is a DESTRUCTIVE operation and CANNOT be undone!
-- 
-- Usage:
--   1. Replace 'YOUR_PARTNER_UUID_HERE' on line 21 with the actual partner UUID
--   2. Review the script carefully before executing
--   3. Consider creating a backup before running
--   4. Run this script as a superadmin or service_role user
--   5. Review the output, then uncomment COMMIT or ROLLBACK at the end
-- =====================================================

-- Start transaction for safety
BEGIN;

DO $$
DECLARE
    -- ⚠️ REPLACE THIS UUID WITH THE PARTNER YOU WANT TO DELETE ⚠️
    v_partner_uuid UUID := 'YOUR_PARTNER_UUID_HERE';
    
    v_partner_name TEXT;
    v_customer_count INT;
    v_contract_count INT;
    v_booking_count INT;
    v_service_count INT;
    v_location_count INT;
    v_deleted_count INT;
BEGIN
    -- =====================================================
    -- STEP 0: Validate and display summary
    -- =====================================================
    
    -- Get partner info
    SELECT COALESCE(company_name, first_name || ' ' || COALESCE(second_name, ''))
    INTO v_partner_name
    FROM partners
    WHERE partner_uuid = v_partner_uuid;
    
    IF v_partner_name IS NULL THEN
        RAISE EXCEPTION 'Partner UUID % not found!', v_partner_uuid;
    END IF;
    
    -- Count records
    SELECT COUNT(*) INTO v_customer_count FROM customers WHERE partner_uuid = v_partner_uuid;
    SELECT COUNT(*) INTO v_contract_count FROM contracts WHERE partner_uuid = v_partner_uuid;
    SELECT COUNT(*) INTO v_booking_count FROM bookings WHERE partner_uuid = v_partner_uuid;
    SELECT COUNT(*) INTO v_service_count FROM services WHERE partner_uuid = v_partner_uuid;
    SELECT COUNT(*) INTO v_location_count FROM locations WHERE partner_uuid = v_partner_uuid;
    
    RAISE NOTICE '================================================';
    RAISE NOTICE 'PARTNER DATA CLEANUP SUMMARY';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Partner: %', v_partner_name;
    RAISE NOTICE 'UUID: %', v_partner_uuid;
    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE 'Records to be deleted:';
    RAISE NOTICE '  - Customers: %', v_customer_count;
    RAISE NOTICE '  - Contracts: %', v_contract_count;
    RAISE NOTICE '  - Bookings: %', v_booking_count;
    RAISE NOTICE '  - Services: %', v_service_count;
    RAISE NOTICE '  - Locations: %', v_location_count;
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    
    -- =====================================================
    -- STEP 1: Delete child records (in dependency order)
    -- =====================================================
    
    -- Delete bookings-related data
    RAISE NOTICE 'Deleting bookings and package reservations...';
    DELETE FROM package_reservations WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % package reservations', v_deleted_count;
    
    DELETE FROM bookings WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % bookings', v_deleted_count;
    
    -- Delete contract-related data
    RAISE NOTICE 'Deleting contract-related records...';
    DELETE FROM contract_fattureincloud_uploads WHERE contract_id IN (
        SELECT id FROM contracts WHERE partner_uuid = v_partner_uuid
    );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % FattureInCloud uploads', v_deleted_count;
    
    DELETE FROM contract_renewal_log WHERE original_contract_id IN (
        SELECT id FROM contracts WHERE partner_uuid = v_partner_uuid
    );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % contract renewal logs', v_deleted_count;
    
    -- Note: contract_status_update_log has no contract_id or partner_uuid, it's a global log
    -- So we skip deleting from it
    
    -- Delete contracts (will cascade to related records)
    RAISE NOTICE 'Deleting contracts...';
    DELETE FROM contracts WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % contracts', v_deleted_count;
    
    -- Delete customer-related data (discount codes are partner-level, not customer-level)
    RAISE NOTICE 'Deleting customer discount codes...';
    DELETE FROM customers_discount_codes WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % customer discount codes', v_deleted_count;
    
    -- Delete customers (will cascade to related records)
    RAISE NOTICE 'Deleting customers...';
    DELETE FROM customers WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % customers', v_deleted_count;
    
    -- Delete notifications
    RAISE NOTICE 'Deleting notifications...';
    DELETE FROM notification_views WHERE notification_id IN (
        SELECT id FROM notifications WHERE partner_uuid = v_partner_uuid
    );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % notification views', v_deleted_count;
    
    DELETE FROM notification_recipients WHERE notification_id IN (
        SELECT id FROM notifications WHERE partner_uuid = v_partner_uuid
    );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % notification recipients', v_deleted_count;
    
    DELETE FROM notifications WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % notifications', v_deleted_count;
    
    DELETE FROM notification_templates WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % notification templates', v_deleted_count;
    
    -- Delete location-related data
    RAISE NOTICE 'Deleting location-related records...';
    DELETE FROM location_images WHERE location_id IN (
        SELECT id FROM locations WHERE partner_uuid = v_partner_uuid
    );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % location images', v_deleted_count;
    
    DELETE FROM location_operating_schedules WHERE location_id IN (
        SELECT id FROM locations WHERE partner_uuid = v_partner_uuid
    );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % location operating schedules', v_deleted_count;
    
    DELETE FROM operating_closures WHERE location_id IN (
        SELECT id FROM locations WHERE partner_uuid = v_partner_uuid
    );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % operating closures', v_deleted_count;
    
    -- Delete resource-related data
    RAISE NOTICE 'Deleting resource-related records...';
    DELETE FROM resource_operating_schedules WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % resource operating schedules', v_deleted_count;
    
    DELETE FROM location_resources WHERE location_id IN (
        SELECT id FROM locations WHERE partner_uuid = v_partner_uuid
    );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % location resources', v_deleted_count;
    
    -- Delete services (must be before locations due to FK constraints)
    RAISE NOTICE 'Deleting services...';
    DELETE FROM services WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % services', v_deleted_count;
    
    -- Delete locations
    RAISE NOTICE 'Deleting locations...';
    DELETE FROM locations WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % locations', v_deleted_count;
    
    -- Delete partner-specific configurations
    RAISE NOTICE 'Deleting partner configurations...';
    DELETE FROM partner_resource_types WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % partner resource types', v_deleted_count;
    
    DELETE FROM email_templates WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % email templates', v_deleted_count;
    
    -- Note: partners_discount_codes has no partner_uuid, it's a global superadmin table
    -- So we skip deleting from it
    
    DELETE FROM calendar_tokens WHERE user_id IN (
        SELECT id FROM profiles WHERE partner_uuid = v_partner_uuid
    );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % calendar tokens', v_deleted_count;
    
    -- Delete activity logs
    RAISE NOTICE 'Deleting activity logs...';
    DELETE FROM activity_logs WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % activity logs', v_deleted_count;
    
    DELETE FROM partners_customer_activity_log WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % customer activity logs', v_deleted_count;
    
    -- Delete partner billing data
    RAISE NOTICE 'Deleting partner billing data...';
    -- partners_payments has partner_uuid directly
    DELETE FROM partners_payments WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % partner payments', v_deleted_count;
    
    -- Note: partners_billing_executions is a global audit log with no partner reference
    -- So we skip deleting from it
    
    -- Delete partner contracts (has ON DELETE RESTRICT, so delete after payments)
    DELETE FROM partners_contracts WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % partner contracts', v_deleted_count;
    
    -- Delete invitations
    RAISE NOTICE 'Deleting invitations...';
    DELETE FROM invitations WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % invitations', v_deleted_count;
    
    -- Note: We skip deleting profiles because auth.users must be deleted manually
    -- Deleting only from profiles would leave orphaned auth records
    RAISE NOTICE 'Skipping profiles deletion (auth.users must be deleted manually)';
    
    -- =====================================================
    -- STEP 2: Delete the partner record itself
    -- =====================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Deleting partner record...';
    DELETE FROM partners WHERE partner_uuid = v_partner_uuid;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted partner record';
    
    -- =====================================================
    -- FINAL VERIFICATION
    -- =====================================================
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'SUCCESS: Partner data deleted successfully!';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Review the output above';
    RAISE NOTICE '⚠️  Then uncomment either COMMIT or ROLLBACK';
    RAISE NOTICE '';
    
END $$;

-- =====================================================
-- COMMIT OR ROLLBACK
-- =====================================================
-- IMPORTANT: Review the output above before committing!
-- To commit the changes, uncomment the next line:
-- COMMIT;

-- To rollback (undo) all changes, uncomment the next line:
-- ROLLBACK;

-- By default, the transaction is left open for manual review
-- You MUST either COMMIT or ROLLBACK manually
