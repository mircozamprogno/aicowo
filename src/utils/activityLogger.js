// src/utils/activityLogger.js

import { supabase } from '../services/supabase';
import logger from './logger';

/**
 * Valid activity categories (must match database ENUM)
 */
export const ACTIVITY_CATEGORIES = {
  CONTRACT: 'contract',
  BOOKING: 'booking',
  CUSTOMER: 'customer',
  EMAIL: 'email',
  PAYMENT: 'payment',
  SERVICE: 'service',
  SPACE: 'space',
  USER: 'user',
  SYSTEM: 'system',
  LOCATION: 'location',
  PACKAGE: 'package',
  AUTH: 'auth',
  NOTIFICATION: 'notification'  // ADD THIS
};

/**
 * Valid activity actions (must match database ENUM)
 */
export const ACTIVITY_ACTIONS = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  SENT: 'sent',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  RENEWED: 'renewed',
  IMPORTED: 'imported',
  EXPORTED: 'exported',
  ARCHIVED: 'archived',
  RESTORED: 'restored',
  ACTIVATED: 'activated',
  DEACTIVATED: 'deactivated',
  SUSPENDED: 'suspended',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RECEIVED: 'received',
  UPLOADED: 'uploaded',
  DOWNLOADED: 'downloaded',
  LOGIN: 'login',
  LOGOUT: 'logout',
  IMAGE_DELETED: 'image_deleted',
  IMAGES_UPLOADED: 'images_uploaded',
  RESOURCES_ADDED: 'resources_added',
  RESOURCES_UPDATED: 'resources_updated',
  RESOURCES_DELETED: 'resources_deleted',
  STATUS_CHANGED: 'status_changed',
  ASSIGNED: 'assigned',
  UNASSIGNED: 'unassigned',
  PUBLISHED: 'published',        // ADD THIS
  DRAFTED: 'drafted'             // ADD THIS
};

/**
 * Log user activity to activity_logs table
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
    const { data: { session } } = await supabase.auth.getSession();
    
    logger.log('🔍 Session:', session?.user?.id);
    
    if (!session?.user) {
      logger.error('❌ No session found for activity logging');
      return;
    }

    // Get partner_uuid from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('partner_uuid')
      .eq('id', session.user.id)
      .single();

    logger.log('🔍 Profile:', profile, 'Error:', profileError);

    if (!profile?.partner_uuid) {
      logger.error('❌ No partner_uuid found for user');
      return;
    }

    const logData = {
      partner_uuid: profile.partner_uuid,
      user_id: session.user.id,
      action_category,
      action_type,
      entity_id: entity_id ? String(entity_id) : null,
      entity_type,
      description,
      metadata: metadata || {}
    };

    logger.log('📝 Attempting to insert activity log:', logData);

    // Insert activity log
    const { data, error } = await supabase
      .from('activity_logs')
      .insert(logData)
      .select();

    if (error) {
      logger.error('❌ Activity log error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        logData: logData
      });
      throw error;
    }

    logger.log('✅ Activity logged successfully:', data);

  } catch (error) {
    logger.error('💥 Activity log failed:', error);
    // Don't throw - logging failures shouldn't break the main flow
  }
}