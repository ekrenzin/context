"""OpenAI DALL-E image generation provider."""

import os
from pathlib import Path
from typing import Optional
import requests


def generate_image(
    prompt: str,
    output_path: str,
    model: str = "dall-e-3",
    api_key: Optional[str] = None
) -> None:
    """Generate an image using OpenAI's DALL-E API."""
    api_key = api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable or --api-key required")
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024" if model == "dall-e-3" else "512x512"
    }
    
    print(f"Generating image with {model}: {prompt}")
    
    response = requests.post(
        "https://api.openai.com/v1/images/generations",
        headers=headers,
        json=data
    )
    
    if response.status_code != 200:
        raise Exception(f"API error: {response.status_code} - {response.text}")
    
    result = response.json()
    image_url = result["data"][0]["url"]
    
    # Download the image
    img_response = requests.get(image_url)
    if img_response.status_code != 200:
        raise Exception(f"Failed to download image: {img_response.status_code}")
    
    # Save the image
    Path(output_path).write_bytes(img_response.content)
    print(f"Image saved to: {output_path}")