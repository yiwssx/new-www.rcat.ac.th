ALTER TABLE carousel_slides ADD COLUMN image_fit TEXT NOT NULL DEFAULT 'fit-blur' CHECK (image_fit IN ('fill', 'fit', 'fit-blur'));
ALTER TABLE carousel_slides ADD COLUMN focal_point_x REAL NOT NULL DEFAULT 50 CHECK (focal_point_x BETWEEN 0 AND 100);
ALTER TABLE carousel_slides ADD COLUMN focal_point_y REAL NOT NULL DEFAULT 50 CHECK (focal_point_y BETWEEN 0 AND 100);
ALTER TABLE carousel_slides ADD COLUMN mobile_image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE carousel_slides ADD COLUMN background_color TEXT NOT NULL DEFAULT '';
ALTER TABLE carousel_slides ADD COLUMN open_in_new_tab INTEGER NOT NULL DEFAULT 0 CHECK (open_in_new_tab IN (0, 1));
