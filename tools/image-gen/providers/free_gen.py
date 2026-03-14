"""Free image generation using placeholder services."""

import requests
from pathlib import Path
from typing import Optional
import hashlib


def generate_image(
    prompt: str,
    output_path: str,
    width: int = 512,
    height: int = 512
) -> None:
    """Generate a placeholder image with text."""
    # Create a deterministic color from the prompt
    prompt_hash = hashlib.md5(prompt.encode()).hexdigest()
    bg_color = prompt_hash[:6]
    fg_color = "ffffff" if int(bg_color, 16) < 8388608 else "000000"  # Black or white text
    
    # Use placeholder service
    url = f"https://via.placeholder.com/{width}x{height}/{bg_color}/{fg_color}"
    params = {
        "text": prompt[:30]  # Limit text length
    }
    
    print(f"Generating placeholder image: {prompt}")
    
    response = requests.get(url, params=params)
    if response.status_code != 200:
        raise Exception(f"Failed to generate image: {response.status_code}")
    
    # Save the image
    Path(output_path).write_bytes(response.content)
    print(f"Placeholder image saved to: {output_path}")