# RunStock

Tracking Runpod GPU availability and price to see _general trends_ of when GPUs are available (from any region), in response to users claiming unavailability of GPUs when they want them. For exact current data, refer to the Runpod console instead.

![RunStock](runstock.jpg)

A Cloudflare Worker 5-min cron job hitting Runpod's GraphQL API, storing the latest snapshot in KV and a few selected fields (for charting) in D1.