-- Manual deletion SQL for user: c5ab4b54-5c56-471d-94b9-2ea957a386c3
-- Run these statements in order in Supabase SQL Editor

-- Step 1: Delete customers_discount_codes created by this user
-- This is the constraint that was blocking deletion
DELETE FROM customers_discount_codes 
WHERE created_by_user_id = 'c5ab4b54-5c56-471d-94b9-2ea957a386c3';

-- Step 2: Delete activity_logs for this user
DELETE FROM activity_logs 
WHERE user_id = 'c5ab4b54-5c56-471d-94b9-2ea957a386c3';

-- Step 3: Find and delete all customer records for this user
-- First, let's see what we're deleting
SELECT id, first_name, second_name, email 
FROM customers 
WHERE user_id = 'c5ab4b54-5c56-471d-94b9-2ea957a386c3';

-- Then delete the customers (contracts/bookings should cascade if set up correctly)
DELETE FROM customers 
WHERE user_id = 'c5ab4b54-5c56-471d-94b9-2ea957a386c3';

-- Step 4: Delete the profile
DELETE FROM profile 
WHERE id = 'c5ab4b54-5c56-471d-94b9-2ea957a386c3';

-- Step 5: Delete from auth.users (requires admin privileges)
-- You'll need to do this from the Supabase Dashboard:
-- 1. Go to Authentication → Users
-- 2. Find user with ID: c5ab4b54-5c56-471d-94b9-2ea957a386c3
-- 3. Click the three dots → Delete user

-- OR run this if you have the necessary permissions:
-- Note: This might not work from SQL Editor, you may need to use the Dashboard
-- DELETE FROM auth.users WHERE id = 'c5ab4b54-5c56-471d-94b9-2ea957a386c3';

-- Verification: Check if everything is deleted
SELECT 'customers_discount_codes' as table_name, COUNT(*) as remaining
FROM customers_discount_codes 
WHERE created_by_user_id = 'c5ab4b54-5c56-471d-94b9-2ea957a386c3'
UNION ALL
SELECT 'activity_logs', COUNT(*)
FROM activity_logs 
WHERE user_id = 'c5ab4b54-5c56-471d-94b9-2ea957a386c3'
UNION ALL
SELECT 'customers', COUNT(*)
FROM customers 
WHERE user_id = 'c5ab4b54-5c56-471d-94b9-2ea957a386c3'
UNION ALL
SELECT 'profile', COUNT(*)
FROM profile 
WHERE id = 'c5ab4b54-5c56-471d-94b9-2ea957a386c3';
