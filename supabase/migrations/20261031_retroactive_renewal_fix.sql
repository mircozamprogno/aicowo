-- Retroactive renewal fix (2026-10-31)
--
-- Six contracts for partner bc08255b-3ae9-49da-a403-c9453f58847f failed to
-- auto-renew between May and September 2026 because services 36/37 had no
-- location_resource_id.  The code bug is fixed in 20261031_fix_auto_renew_no_resource.sql.
-- This script repairs the data: applies the correct number of renewal cycles
-- to each contract so its end_date lands in the future, restores contract_status
-- to 'active', un-archives the three archived contracts, and creates the
-- corresponding payment rows.
--
-- Renewal-log rows are inserted with email_sent_at already stamped so the
-- contract-renewal-confirmation edge function does NOT send retroactive emails.

DO $$
DECLARE
  v_now             timestamptz := now();
  v_system_user_id  uuid        := '11111111-1111-1111-1111-111111111111';
  v_partner_uuid    uuid        := 'bc08255b-3ae9-49da-a403-c9453f58847f';
BEGIN

  -- ──────────────────────────────────────────────────────────────────
  -- 146  CONT-20260316-9969  service 36  90 days  3 cycles
  --   2026-05-01 → 2026-07-30 → 2026-10-28 → 2027-01-26
  -- ──────────────────────────────────────────────────────────────────
  UPDATE contracts SET
    end_date              = '2027-01-26',
    contract_status       = 'active',
    is_archived           = false,
    renewal_count         = 3,
    renewal_alert_sent_at = null,
    updated_at            = v_now,
    notes = coalesce(notes || E'\n\n', '') ||
      'Retroactive renewal fix on ' || v_now::date ||
      ': 3 missed cycles applied (2026-05-01 → 2027-01-26)'
  WHERE id = 146;

  INSERT INTO payments (contract_id, partner_uuid, amount, currency, payment_method,
    payment_status, payment_type, payment_date, due_date, period_start, period_end,
    notes, created_by, created_at, updated_at)
  VALUES
    (146, v_partner_uuid, 675.00, 'EUR', 'bank_transfer', 'pending', 'full',
     null, '2026-06-01', '2026-05-02', '2026-07-30',
     'Retroactive: missed cycle ending 2026-07-30', v_system_user_id, v_now, v_now),
    (146, v_partner_uuid, 675.00, 'EUR', 'bank_transfer', 'pending', 'full',
     null, '2026-08-30', '2026-07-31', '2026-10-28',
     'Retroactive: missed cycle ending 2026-10-28', v_system_user_id, v_now, v_now),
    (146, v_partner_uuid, 675.00, 'EUR', 'bank_transfer', 'pending', 'full',
     null, '2026-11-28', '2026-10-29', '2027-01-26',
     'Retroactive: renewal cycle ending 2027-01-26', v_system_user_id, v_now, v_now);

  INSERT INTO contract_renewal_log (original_contract_id, original_contract_number,
    renewal_attempt_date, renewal_status, new_contract_id, new_contract_number,
    resource_availability_details, partner_uuid, email_sent_at)
  VALUES
    (146, 'CONT-20260316-9969', '2026-05-01 04:00:00+02', 'success_no_booking',
     146, 'CONT-20260316-9969', '{"reason":"retroactive_fix","cycle":1}', v_partner_uuid, v_now),
    (146, 'CONT-20260316-9969', '2026-07-30 04:00:00+02', 'success_no_booking',
     146, 'CONT-20260316-9969', '{"reason":"retroactive_fix","cycle":2}', v_partner_uuid, v_now),
    (146, 'CONT-20260316-9969', '2026-10-28 04:00:00+02', 'success_no_booking',
     146, 'CONT-20260316-9969', '{"reason":"retroactive_fix","cycle":3}', v_partner_uuid, v_now);

  -- ──────────────────────────────────────────────────────────────────
  -- 210  CONT-20260709-3602  service 36  90 days  2 cycles
  --   2026-08-01 → 2026-10-30 → 2027-01-28
  -- ──────────────────────────────────────────────────────────────────
  UPDATE contracts SET
    end_date              = '2027-01-28',
    contract_status       = 'active',
    is_archived           = false,
    renewal_count         = 2,
    renewal_alert_sent_at = null,
    updated_at            = v_now,
    notes = coalesce(notes || E'\n\n', '') ||
      'Retroactive renewal fix on ' || v_now::date ||
      ': 2 missed cycles applied (2026-08-01 → 2027-01-28)'
  WHERE id = 210;

  INSERT INTO payments (contract_id, partner_uuid, amount, currency, payment_method,
    payment_status, payment_type, payment_date, due_date, period_start, period_end,
    notes, created_by, created_at, updated_at)
  VALUES
    (210, v_partner_uuid, 675.00, 'EUR', 'bank_transfer', 'pending', 'full',
     null, '2026-09-01', '2026-08-02', '2026-10-30',
     'Retroactive: missed cycle ending 2026-10-30', v_system_user_id, v_now, v_now),
    (210, v_partner_uuid, 675.00, 'EUR', 'bank_transfer', 'pending', 'full',
     null, '2026-11-30', '2026-10-31', '2027-01-28',
     'Retroactive: renewal cycle ending 2027-01-28', v_system_user_id, v_now, v_now);

  INSERT INTO contract_renewal_log (original_contract_id, original_contract_number,
    renewal_attempt_date, renewal_status, new_contract_id, new_contract_number,
    resource_availability_details, partner_uuid, email_sent_at)
  VALUES
    (210, 'CONT-20260709-3602', '2026-08-01 04:00:00+02', 'success_no_booking',
     210, 'CONT-20260709-3602', '{"reason":"retroactive_fix","cycle":1}', v_partner_uuid, v_now),
    (210, 'CONT-20260709-3602', '2026-10-30 04:00:00+02', 'success_no_booking',
     210, 'CONT-20260709-3602', '{"reason":"retroactive_fix","cycle":2}', v_partner_uuid, v_now);

  -- ──────────────────────────────────────────────────────────────────
  -- 211  CONT-20260709-1524  service 37  180 days  1 cycle
  --   2026-08-15 → 2027-02-11
  -- ──────────────────────────────────────────────────────────────────
  UPDATE contracts SET
    end_date              = '2027-02-11',
    contract_status       = 'active',
    is_archived           = false,
    renewal_count         = 1,
    renewal_alert_sent_at = null,
    updated_at            = v_now,
    notes = coalesce(notes || E'\n\n', '') ||
      'Retroactive renewal fix on ' || v_now::date ||
      ': 1 missed cycle applied (2026-08-15 → 2027-02-11)'
  WHERE id = 211;

  INSERT INTO payments (contract_id, partner_uuid, amount, currency, payment_method,
    payment_status, payment_type, payment_date, due_date, period_start, period_end,
    notes, created_by, created_at, updated_at)
  VALUES (211, v_partner_uuid, 1200.00, 'EUR', 'bank_transfer', 'pending', 'full',
    null, '2026-09-15', '2026-08-16', '2027-02-11',
    'Retroactive: missed cycle ending 2027-02-11', v_system_user_id, v_now, v_now);

  INSERT INTO contract_renewal_log (original_contract_id, original_contract_number,
    renewal_attempt_date, renewal_status, new_contract_id, new_contract_number,
    resource_availability_details, partner_uuid, email_sent_at)
  VALUES (211, 'CONT-20260709-1524', '2026-08-15 04:00:00+02', 'success_no_booking',
    211, 'CONT-20260709-1524', '{"reason":"retroactive_fix","cycle":1}', v_partner_uuid, v_now);

  -- ──────────────────────────────────────────────────────────────────
  -- 212  CONT-20260709-6158  service 37  180 days  1 cycle
  --   2026-08-17 → 2027-02-13
  -- ──────────────────────────────────────────────────────────────────
  UPDATE contracts SET
    end_date              = '2027-02-13',
    contract_status       = 'active',
    is_archived           = false,
    renewal_count         = 1,
    renewal_alert_sent_at = null,
    updated_at            = v_now,
    notes = coalesce(notes || E'\n\n', '') ||
      'Retroactive renewal fix on ' || v_now::date ||
      ': 1 missed cycle applied (2026-08-17 → 2027-02-13)'
  WHERE id = 212;

  INSERT INTO payments (contract_id, partner_uuid, amount, currency, payment_method,
    payment_status, payment_type, payment_date, due_date, period_start, period_end,
    notes, created_by, created_at, updated_at)
  VALUES (212, v_partner_uuid, 1200.00, 'EUR', 'bank_transfer', 'pending', 'full',
    null, '2026-09-17', '2026-08-18', '2027-02-13',
    'Retroactive: missed cycle ending 2027-02-13', v_system_user_id, v_now, v_now);

  INSERT INTO contract_renewal_log (original_contract_id, original_contract_number,
    renewal_attempt_date, renewal_status, new_contract_id, new_contract_number,
    resource_availability_details, partner_uuid, email_sent_at)
  VALUES (212, 'CONT-20260709-6158', '2026-08-17 04:00:00+02', 'success_no_booking',
    212, 'CONT-20260709-6158', '{"reason":"retroactive_fix","cycle":1}', v_partner_uuid, v_now);

  -- ──────────────────────────────────────────────────────────────────
  -- 213  CONT-20260709-3762  service 36  90 days  1 cycle
  --   2026-09-18 → 2026-12-17
  -- ──────────────────────────────────────────────────────────────────
  UPDATE contracts SET
    end_date              = '2026-12-17',
    contract_status       = 'active',
    is_archived           = false,
    renewal_count         = 1,
    renewal_alert_sent_at = null,
    updated_at            = v_now,
    notes = coalesce(notes || E'\n\n', '') ||
      'Retroactive renewal fix on ' || v_now::date ||
      ': 1 missed cycle applied (2026-09-18 → 2026-12-17)'
  WHERE id = 213;

  INSERT INTO payments (contract_id, partner_uuid, amount, currency, payment_method,
    payment_status, payment_type, payment_date, due_date, period_start, period_end,
    notes, created_by, created_at, updated_at)
  VALUES (213, v_partner_uuid, 675.00, 'EUR', 'bank_transfer', 'pending', 'full',
    null, '2026-10-19', '2026-09-19', '2026-12-17',
    'Retroactive: missed cycle ending 2026-12-17', v_system_user_id, v_now, v_now);

  INSERT INTO contract_renewal_log (original_contract_id, original_contract_number,
    renewal_attempt_date, renewal_status, new_contract_id, new_contract_number,
    resource_availability_details, partner_uuid, email_sent_at)
  VALUES (213, 'CONT-20260709-3762', '2026-09-18 04:00:00+02', 'success_no_booking',
    213, 'CONT-20260709-3762', '{"reason":"retroactive_fix","cycle":1}', v_partner_uuid, v_now);

  -- ──────────────────────────────────────────────────────────────────
  -- 214  CONT-20260709-2608  service 37  180 days  1 cycle
  --   2026-09-22 → 2027-03-21
  -- ──────────────────────────────────────────────────────────────────
  UPDATE contracts SET
    end_date              = '2027-03-21',
    contract_status       = 'active',
    is_archived           = false,
    renewal_count         = 1,
    renewal_alert_sent_at = null,
    updated_at            = v_now,
    notes = coalesce(notes || E'\n\n', '') ||
      'Retroactive renewal fix on ' || v_now::date ||
      ': 1 missed cycle applied (2026-09-22 → 2027-03-21)'
  WHERE id = 214;

  INSERT INTO payments (contract_id, partner_uuid, amount, currency, payment_method,
    payment_status, payment_type, payment_date, due_date, period_start, period_end,
    notes, created_by, created_at, updated_at)
  VALUES (214, v_partner_uuid, 1200.00, 'EUR', 'bank_transfer', 'pending', 'full',
    null, '2026-10-23', '2026-09-23', '2027-03-21',
    'Retroactive: missed cycle ending 2027-03-21', v_system_user_id, v_now, v_now);

  INSERT INTO contract_renewal_log (original_contract_id, original_contract_number,
    renewal_attempt_date, renewal_status, new_contract_id, new_contract_number,
    resource_availability_details, partner_uuid, email_sent_at)
  VALUES (214, 'CONT-20260709-2608', '2026-09-22 04:00:00+02', 'success_no_booking',
    214, 'CONT-20260709-2608', '{"reason":"retroactive_fix","cycle":1}', v_partner_uuid, v_now);

END $$;
