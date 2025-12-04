#!/usr/bin/env python3
"""
Load Directus Schema Script

This script fetches the schema from directus.bounteer.com and saves it to reference/schema.json.
It can be used to keep a local reference of the CMS schema for development purposes.

Usage:
    python scripts/load_schema.py

Environment Variables:
    DIRECTUS_URL: Base URL of the Directus instance (default: https://directus.bounteer.com)
    DIRECTUS_TOKEN: API token for authentication (required)
"""

import json
import os
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


def load_schema():
    """Fetch schema from Directus and save to reference/schema.json"""

    # Configuration
    directus_url = os.getenv("DIRECTUS_URL", "https://directus.bounteer.com")
    directus_token = os.getenv("DIRECTUS_TOKEN")

    if not directus_token:
        print("❌ ERROR: DIRECTUS_TOKEN environment variable is not set")
        print("\n📋 TODO - Directus Configuration Required:")
        print("=" * 60)
        print("1. Create a static API token in your Directus instance:")
        print("   - Go to: https://directus.bounteer.com/admin/settings/access-tokens")
        print("   - Click 'Create Token'")
        print("   - Name: 'Schema Export' (or similar)")
        print("   - Set appropriate permissions:")
        print("     • Read access to system collections")
        print("     • Schema read permissions")
        print("   - Copy the generated token")
        print()
        print("2. Set the token as an environment variable:")
        print("   export DIRECTUS_TOKEN='your-token-here'")
        print()
        print("3. Re-run this script:")
        print("   python scripts/load_schema.py")
        print("=" * 60)
        return False

    # Prepare API request
    schema_url = f"{directus_url}/server/specs/oas"
    print(f"🔍 Fetching schema from: {schema_url}")

    try:
        # Create request with authentication
        request = Request(schema_url)
        request.add_header("Authorization", f"Bearer {directus_token}")
        request.add_header("Accept", "application/json")

        # Fetch schema
        with urlopen(request, timeout=30) as response:
            if response.status != 200:
                print(f"❌ ERROR: Received status code {response.status}")
                return False

            full_spec = json.loads(response.read().decode("utf-8"))

        # Extract only the schemas from components
        schema_data = full_spec.get("components", {}).get("schemas", {})
        
        if not schema_data:
            print("❌ ERROR: No schemas found in the OpenAPI specification")
            return False

        # Ensure reference directory exists
        reference_dir = Path(__file__).parent.parent / "reference"
        reference_dir.mkdir(exist_ok=True)

        # Save schema to file
        schema_file = reference_dir / "schema.json"
        with open(schema_file, "w", encoding="utf-8") as f:
            json.dump(schema_data, f, indent=2, ensure_ascii=False)

        print(f"✅ Schema successfully saved to: {schema_file}")
        print(f"📊 Schema contains {len(schema_data)} schemas")

        return True

    except HTTPError as e:
        print(f"❌ HTTP Error: {e.code} - {e.reason}")
        if e.code == 401:
            print("\n📋 TODO - Authentication Error:")
            print("=" * 60)
            print("Your DIRECTUS_TOKEN appears to be invalid or expired.")
            print("Please check the following:")
            print("1. Token is correctly copied (no extra spaces)")
            print("2. Token has not expired")
            print("3. Token has appropriate permissions:")
            print("   - System collections read access")
            print("   - Schema read permissions")
            print()
            print("Generate a new token at:")
            print("https://directus.bounteer.com/admin/settings/access-tokens")
            print("=" * 60)
        elif e.code == 403:
            print("\n📋 TODO - Permission Error:")
            print("=" * 60)
            print("Your token does not have sufficient permissions.")
            print("Please update the token permissions to include:")
            print("- System collections: Read access")
            print("- Schema endpoint: Read access")
            print("=" * 60)
        return False

    except URLError as e:
        print(f"❌ Connection Error: {e.reason}")
        print("\n📋 TODO - Connection Issue:")
        print("=" * 60)
        print("Unable to connect to Directus instance.")
        print("Please check:")
        print("1. Directus URL is correct: https://directus.bounteer.com")
        print("2. Directus instance is running and accessible")
        print("3. Your network connection is working")
        print("4. No firewall is blocking the connection")
        print("=" * 60)
        return False

    except Exception as e:
        print(f"❌ Unexpected Error: {type(e).__name__}: {e}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Directus Schema Loader")
    print("=" * 60)
    print()

    success = load_schema()

    print()
    print("=" * 60)

    sys.exit(0 if success else 1)
