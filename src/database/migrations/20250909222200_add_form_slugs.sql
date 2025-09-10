-- Add slug column as nullable first
ALTER TABLE "booking_forms" ADD COLUMN "slug" text;

-- Create a function to generate slugs from form names
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT) RETURNS TEXT AS $$
DECLARE
    slug TEXT;
BEGIN
    -- Convert to lowercase, replace spaces with hyphens, remove special characters
    slug := lower(regexp_replace(input_text, '[^a-zA-Z0-9\s-]', '', 'g'));
    slug := regexp_replace(slug, '\s+', '-', 'g');
    -- Remove leading/trailing hyphens
    slug := regexp_replace(slug, '^-+|-+$', '', 'g');
    -- Ensure it's not empty
    IF slug = '' THEN
        slug := 'form';
    END IF;
    RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- Update existing forms with slugs generated from their names
UPDATE "booking_forms" 
SET "slug" = generate_slug("name") || '-' || substr("id", 1, 8)
WHERE "slug" IS NULL;

-- Make slug column NOT NULL now that all records have values
ALTER TABLE "booking_forms" ALTER COLUMN "slug" SET NOT NULL;

-- Drop the temporary function
DROP FUNCTION generate_slug(TEXT);