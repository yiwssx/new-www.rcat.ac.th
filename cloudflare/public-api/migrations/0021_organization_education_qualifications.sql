-- Optional academic qualifications on the canonical personnel profile.
-- Empty means 'not supplied'; it is only public for department assignments.
-- No personnel data is changed by this additive migration.
ALTER TABLE personnel ADD COLUMN education_qualifications TEXT NOT NULL DEFAULT ''
  CHECK (length(education_qualifications) <= 1000);
