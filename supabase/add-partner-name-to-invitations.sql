-- Add partner_structure_name column to invitations table
-- This allows unauthenticated users to see the partner name without querying the partners table

ALTER TABLE invitations 
ADD COLUMN partner_structure_name TEXT;

-- Update existing invitations with the structure_name from partners
UPDATE invitations 
SET partner_structure_name = partners.structure_name
FROM partners
WHERE invitations.partner_uuid = partners.partner_uuid;

-- Create a trigger to automatically populate partner_structure_name when invitation is created
CREATE OR REPLACE FUNCTION set_invitation_partner_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the structure_name from partners table
  SELECT structure_name INTO NEW.partner_structure_name
  FROM partners
  WHERE partner_uuid = NEW.partner_uuid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_invitation_partner_name ON invitations;
CREATE TRIGGER trigger_set_invitation_partner_name
  BEFORE INSERT OR UPDATE OF partner_uuid ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION set_invitation_partner_name();

-- Verify the update worked
SELECT invitation_uuid, invited_email, partner_uuid, partner_structure_name 
FROM invitations 
WHERE partner_uuid = 'bc08255b-3ae9-49da-a403-c9453f58847f';
