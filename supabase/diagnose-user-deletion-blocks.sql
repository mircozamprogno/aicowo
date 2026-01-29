-- ============================================
-- SQL Diagnostic Query: Find Foreign Key Constraints Blocking User Deletion
-- ============================================
-- This query identifies all foreign key constraints that reference auth.users or profile table
-- Run this in Supabase SQL Editor to diagnose deletion issues

-- Part 1: Find all foreign keys referencing auth.users
SELECT
    'FK to auth.users' AS constraint_type,
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    rc.delete_rule,
    CASE 
        WHEN rc.delete_rule = 'CASCADE' THEN '✅ Will auto-delete'
        WHEN rc.delete_rule = 'RESTRICT' THEN '❌ BLOCKS deletion'
        WHEN rc.delete_rule = 'SET NULL' THEN '⚠️ Will set to NULL'
        WHEN rc.delete_rule = 'NO ACTION' THEN '❌ BLOCKS deletion'
        ELSE rc.delete_rule
    END AS impact
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'users'
    AND ccu.table_schema = 'auth'
ORDER BY 
    CASE rc.delete_rule 
        WHEN 'RESTRICT' THEN 1
        WHEN 'NO ACTION' THEN 2
        WHEN 'SET NULL' THEN 3
        WHEN 'CASCADE' THEN 4
    END,
    tc.table_name;

-- Part 2: Find all foreign keys referencing profile table
SELECT
    'FK to profile' AS constraint_type,
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    rc.delete_rule,
    CASE 
        WHEN rc.delete_rule = 'CASCADE' THEN '✅ Will auto-delete'
        WHEN rc.delete_rule = 'RESTRICT' THEN '❌ BLOCKS deletion'
        WHEN rc.delete_rule = 'SET NULL' THEN '⚠️ Will set to NULL'
        WHEN rc.delete_rule = 'NO ACTION' THEN '❌ BLOCKS deletion'
        ELSE rc.delete_rule
    END AS impact
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'profile'
    AND ccu.table_schema = 'public'
ORDER BY 
    CASE rc.delete_rule 
        WHEN 'RESTRICT' THEN 1
        WHEN 'NO ACTION' THEN 2
        WHEN 'SET NULL' THEN 3
        WHEN 'CASCADE' THEN 4
    END,
    tc.table_name;

-- Part 3: Check for specific user's related data
-- Replace 'USER_ID_HERE' with the actual auth user ID you're trying to delete
/*
SELECT 
    'profile' AS table_name,
    COUNT(*) AS record_count
FROM profile
WHERE id = 'USER_ID_HERE'

UNION ALL

SELECT 
    'customers' AS table_name,
    COUNT(*) AS record_count
FROM customers
WHERE user_id = (SELECT id FROM profile WHERE id = 'USER_ID_HERE')

UNION ALL

SELECT 
    'contracts' AS table_name,
    COUNT(*) AS record_count
FROM contracts
WHERE customer_id IN (SELECT id FROM customers WHERE user_id = (SELECT id FROM profile WHERE id = 'USER_ID_HERE'))

UNION ALL

SELECT 
    'bookings' AS table_name,
    COUNT(*) AS record_count
FROM bookings
WHERE customer_id IN (SELECT id FROM customers WHERE user_id = (SELECT id FROM profile WHERE id = 'USER_ID_HERE'))

UNION ALL

SELECT 
    'package_reservations' AS table_name,
    COUNT(*) AS record_count
FROM package_reservations
WHERE contract_id IN (
    SELECT id FROM contracts 
    WHERE customer_id IN (SELECT id FROM customers WHERE user_id = (SELECT id FROM profile WHERE id = 'USER_ID_HERE'))
)

UNION ALL

SELECT 
    'activity_logs' AS table_name,
    COUNT(*) AS record_count
FROM activity_logs
WHERE user_id = 'USER_ID_HERE';
*/
