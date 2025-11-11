// /src/utils/activityLogger.js

import { supabase } from '../services/supabase';

/**
 * Log user activity to activity_logs table
 * @param {Object} params
 * @param {string} params.action_category - Category: 'contract', 'booking', 'customer', 'email', etc.
 * @param {string} params.action_type - Type: 'created', 'updated', 'deleted', 'sent', etc.
 * @param {string} params.entity_id - UUID of the entity affected
 * @param {string} params.entity_type - Type of entity (table name)
 * @param {string} params.description - Human-readable description
 * @param {Object} params.metadata - Additional data (optional)
 */
export async function logActivity({
  action_category,
  action_type,
  entity_id = null,
  entity_type = null,
  description,
  metadata = {}
}) {
  try {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return // Silent fail if no session

    // Get partner_uuid from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('partner_uuid')
      .eq('id', session.user.id)
      .single()

    if (!profile?.partner_uuid) return // Silent fail if no partner

    // Insert activity log
    await supabase.from('activity_logs').insert({
      partner_uuid: profile.partner_uuid,
      user_id: session.user.id,
      action_category,
      action_type,
      entity_id,
      entity_type,
      description,
      metadata
    })

  } catch (error) {
    // Silent fail - logging should never break the app
    console.error('Activity log failed:', error)
  }
}