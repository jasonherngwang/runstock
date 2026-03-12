CREATE TABLE gpu_events (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  gpu_type TEXT NOT NULL,
  region TEXT NOT NULL,
  service_tier TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  current_price REAL NOT NULL
);
CREATE INDEX idx_gpu_time ON gpu_events(gpu_type, timestamp);
CREATE UNIQUE INDEX idx_gpu_events_idempotency ON gpu_events(idempotency_key);

CREATE TABLE gpu_state (
  gpu_type TEXT NOT NULL,
  region TEXT NOT NULL,
  service_tier TEXT NOT NULL,
  status TEXT NOT NULL,
  current_price REAL NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  gpu_id TEXT,
  datacenter_id TEXT,
  spot_price REAL,
  cluster_price REAL,
  memory_in_gb INTEGER,
  manufacturer TEXT,
  cuda_cores INTEGER,
  max_instances INTEGER,
  max_gpu_count INTEGER,
  min_pod_gpu_count INTEGER,
  throughput INTEGER,
  one_week_price REAL,
  one_month_price REAL,
  three_month_price REAL,
  six_month_price REAL,
  node_group_gpu_sizes TEXT,
  lowest_price TEXT,
  stock_status TEXT,
  min_vcpu INTEGER,
  min_memory_gb INTEGER,
  min_vcpu_floor INTEGER,
  min_memory_gb_floor INTEGER,
  lowest_price_country_code TEXT,
  us_cheapest_price REAL,
  us_cheapest_spot REAL,
  min_disk INTEGER,
  min_download INTEGER,
  min_upload INTEGER,
  available_gpu_counts TEXT,
  datacenter_global_network INTEGER,
  datacenter_storage_support INTEGER,
  datacenter_listed INTEGER,
  datacenter_compliance TEXT,
  gpu_availability TEXT,
  PRIMARY KEY (gpu_type, region, service_tier)
);

CREATE TABLE gpu_price_samples (
  timestamp DATETIME NOT NULL,
  gpu_type TEXT NOT NULL,
  region TEXT NOT NULL,
  service_tier TEXT NOT NULL,
  price REAL NOT NULL,
  spot_price REAL,
  status TEXT NOT NULL
);
CREATE INDEX idx_samples_slot_time ON gpu_price_samples(gpu_type, region, service_tier, timestamp);
CREATE INDEX idx_samples_time ON gpu_price_samples(timestamp);
CREATE UNIQUE INDEX idx_samples_slot_minute ON gpu_price_samples(
  gpu_type, region, service_tier, strftime('%Y-%m-%d %H:%M', timestamp)
);
