#!/usr/bin/env python3
"""List available models to find the correct image generation model name."""

import google.genai as genai
import os
import sys

api_key = os.environ.get('GOOGLE_API_KEY')
if not api_key:
    print("ERROR: GOOGLE_API_KEY environment variable not set")
    sys.exit(1)

client = genai.Client(api_key=api_key)

# List all available models
print("Listing available models...")
for model in client.models.list():
    if hasattr(model, 'name'):
        print(f"  {model.name}")
        if hasattr(model, 'supported_methods'):
            print(f"    Methods: {model.supported_methods}")