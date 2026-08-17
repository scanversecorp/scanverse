-- Route all vendor dispatch SMS/call alerts to owner test mobile during QA.

ALTER TABLE vendor_partners DROP CONSTRAINT IF EXISTS vendor_partners_phone_key;

UPDATE vendor_partners
SET phone = '8484850288', updated_at = now()
WHERE phone IS DISTINCT FROM '8484850288';
