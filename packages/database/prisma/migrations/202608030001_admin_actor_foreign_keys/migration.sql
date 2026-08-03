ALTER TABLE "operator_role_assignments"
  ADD CONSTRAINT "operator_role_assignments_assigned_by_user_id_fkey"
  FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tariff_versions"
  ADD CONSTRAINT "tariff_versions_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "operator_role_assignments_assigned_by_user_id_idx"
  ON "operator_role_assignments"("assigned_by_user_id");

CREATE INDEX "tariff_versions_created_by_user_id_idx"
  ON "tariff_versions"("created_by_user_id");
