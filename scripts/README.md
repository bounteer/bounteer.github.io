# Scripts

Utility scripts for the Bounteer project.

## load_schema.py

Fetches the schema from directus.bounteer.com and saves it to `reference/schema.json`.

### Prerequisites

1. Python 3.x installed
2. Directus API token with appropriate permissions

### Usage

```bash
# Set your Directus token
export DIRECTUS_TOKEN='your-token-here'

# Run the script
python scripts/load_schema.py
```

### First Time Setup

If you haven't created a Directus API token yet, the script will provide detailed instructions on how to set it up.

Run the script once without a token to see the setup instructions:

```bash
python scripts/load_schema.py
```
