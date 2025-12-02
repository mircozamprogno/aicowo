// Enhanced Supabase service with image management for locations
import logger from '../utils/logger';
import { supabase } from './supabase';

export const imageService = {
  // Upload image to Supabase storage
  async uploadLocationImage(file, partnerUuid, locationId, category, options = {}) {
    try {
      // Validate file
      if (!file || file.size === 0) {
        throw new Error('No file provided');
      }

      // Check file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('File size must be less than 5MB');
      }

      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Only JPG, PNG, and WebP images are allowed');
      }

      // Generate unique filename with more randomness
      const fileExtension = file.name.split('.').pop();
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const additionalRandom = Math.random().toString(36).substring(2, 8);
      const fileName = `${category}_${timestamp}_${randomString}_${additionalRandom}.${fileExtension}`;
      
      // Storage path: partners/<partner_uuid>/locations/<location_id>/<category>/filename
      const storagePath = `${partnerUuid}/locations/${locationId}/${category}/${fileName}`;

      // Upload file with upsert false to prevent overwrites
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('partners')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('partners')
        .getPublicUrl(storagePath);

      // Save to database
      const imageData = {
        location_id: locationId,
        partner_uuid: partnerUuid,
        resource_type: category === 'exterior' ? null : category,
        image_category: category,
        image_name: file.name,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
        display_order: options.displayOrder || 0,
        alt_text: options.altText || `${category} image for location`,
        created_by: (await supabase.auth.getUser()).data.user?.id
      };

      const { data: dbData, error: dbError } = await supabase
        .from('location_images')
        .insert([imageData])
        .select()
        .single();

      if (dbError) {
        // If database insert fails, try to delete the uploaded file
        await supabase.storage
          .from('partners')
          .remove([storagePath]);
        throw dbError;
      }

      return {
        success: true,
        data: {
          ...dbData,
          public_url: urlData.publicUrl
        }
      };

    } catch (error) {
      logger.error('Error uploading image:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Upload multiple images
  async uploadLocationImages(files, partnerUuid, locationId, category, options = {}) {
    const results = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileOptions = {
        ...options,
        displayOrder: (options.startOrder || 0) + i
      };
      
      const result = await this.uploadLocationImage(file, partnerUuid, locationId, category, fileOptions);
      results.push({
        file: file.name,
        ...result
      });
    }
    
    return results;
  },

  // Get images for a location
  async getLocationImages(locationId, category = null) {
    try {
      let query = supabase
        .from('location_images')
        .select('*')
        .eq('location_id', locationId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (category) {
        query = query.eq('image_category', category);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Add public URLs
      const imagesWithUrls = data.map(image => ({
        ...image,
        public_url: supabase.storage
          .from('partners')
          .getPublicUrl(image.storage_path).data.publicUrl
      }));

      return {
        success: true,
        data: imagesWithUrls
      };

    } catch (error) {
      logger.error('Error fetching location images:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Delete image
  async deleteLocationImage(imageId) {
    try {
      // First get the image data to know the storage path
      const { data: imageData, error: fetchError } = await supabase
        .from('location_images')
        .select('storage_path')
        .eq('id', imageId)
        .single();

      if (fetchError) throw fetchError;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('partners')
        .remove([imageData.storage_path]);

      if (storageError) {
        logger.warn('Error deleting from storage:', storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('location_images')
        .delete()
        .eq('id', imageId);

      if (dbError) throw dbError;

      return {
        success: true
      };

    } catch (error) {
      logger.error('Error deleting image:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Update image order
  async updateImageOrder(imageId, newOrder) {
    try {
      const { data, error } = await supabase
        .from('location_images')
        .update({ 
          display_order: newOrder,
          updated_at: new Date().toISOString()
        })
        .eq('id', imageId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data
      };

    } catch (error) {
      logger.error('Error updating image order:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Update image metadata
  async updateImageMetadata(imageId, updates) {
    try {
      const allowedUpdates = ['alt_text', 'display_order'];
      const filteredUpdates = Object.keys(updates)
        .filter(key => allowedUpdates.includes(key))
        .reduce((obj, key) => {
          obj[key] = updates[key];
          return obj;
        }, {});

      filteredUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('location_images')
        .update(filteredUpdates)
        .eq('id', imageId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data
      };

    } catch (error) {
      logger.error('Error updating image metadata:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Get images grouped by category
  async getLocationImagesGrouped(locationId) {
    try {
      const result = await this.getLocationImages(locationId);
      
      if (!result.success) {
        return result;
      }

      const grouped = {
        exterior: [],
        scrivania: [],
        sala_riunioni: []
      };

      result.data.forEach(image => {
        if (grouped[image.image_category]) {
          grouped[image.image_category].push(image);
        }
      });

      return {
        success: true,
        data: grouped
      };

    } catch (error) {
      logger.error('Error grouping location images:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Bulk reorder images within a category
  async reorderImages(imageIds, locationId, category) {
    try {
      const updates = imageIds.map((imageId, index) => 
        this.updateImageOrder(imageId, index)
      );

      const results = await Promise.all(updates);
      
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        throw new Error(`Failed to reorder ${failed.length} images`);
      }

      return {
        success: true,
        data: results
      };

    } catch (error) {
      logger.error('Error reordering images:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Get storage usage for a location
  async getLocationStorageUsage(locationId) {
    try {
      const { data, error } = await supabase
        .from('location_images')
        .select('file_size, image_category')
        .eq('location_id', locationId);

      if (error) throw error;

      const usage = {
        total_size: 0,
        total_images: data.length,
        by_category: {
          exterior: { size: 0, count: 0 },
          scrivania: { size: 0, count: 0 },
          sala_riunioni: { size: 0, count: 0 }
        }
      };

      data.forEach(image => {
        const size = image.file_size || 0;
        usage.total_size += size;
        
        if (usage.by_category[image.image_category]) {
          usage.by_category[image.image_category].size += size;
          usage.by_category[image.image_category].count += 1;
        }
      });

      return {
        success: true,
        data: usage
      };

    } catch (error) {
      logger.error('Error getting storage usage:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};