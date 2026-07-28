-- Stable cursor pagination and bounded driver-history filtering.
CREATE INDEX "charging_sessions_user_id_started_at_id_idx"
  ON "charging_sessions"("user_id", "started_at", "id");

CREATE INDEX "charging_sessions_user_id_status_started_at_id_idx"
  ON "charging_sessions"("user_id", "status", "started_at", "id");

CREATE INDEX "charging_sessions_user_id_vehicle_id_started_at_id_idx"
  ON "charging_sessions"("user_id", "vehicle_id", "started_at", "id");

CREATE INDEX "charging_sessions_user_id_station_id_started_at_id_idx"
  ON "charging_sessions"("user_id", "station_id", "started_at", "id");

CREATE INDEX "charging_sessions_user_id_connector_id_started_at_id_idx"
  ON "charging_sessions"("user_id", "connector_id", "started_at", "id");
