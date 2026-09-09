CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  store_id uuid REFERENCES stores(id),
  action varchar(128) NOT NULL,
  resource_type varchar(128) NOT NULL,
  resource_id uuid,
  timestamp timestamptz NOT NULL DEFAULT now(),
  request_id varchar(64),
  before_data jsonb,
  after_data jsonb
);

CREATE INDEX audit_logs_actor_user_id_idx ON audit_logs (actor_user_id);
CREATE INDEX audit_logs_store_id_idx ON audit_logs (store_id);
CREATE INDEX audit_logs_action_idx ON audit_logs (action);
CREATE INDEX audit_logs_timestamp_idx ON audit_logs (timestamp);
