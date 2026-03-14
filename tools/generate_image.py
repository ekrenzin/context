#!/usr/bin/env python3
"""Quick image generation script."""

import sys
import os
from pathlib import Path

# Add image-gen to path
sys.path.insert(0, str(Path(__file__).parent / "image-gen"))

from providers import free_gen
import argparse


def main():
    parser = argparse.ArgumentParser(description="Generate an image")
    parser.add_argument("prompt", help="Image description")
    parser.add_argument("-o", "--output", default="playground/images/generated.png", 
                       help="Output path")
    parser.add_argument("-w", "--width", type=int, default=512, help="Width")
    parser.add_argument("-h", "--height", type=int, default=512, help="Height")
    
    args = parser.parse_args()
    
    # Ensure output directory exists
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Generate image
    free_gen.generate_image(args.prompt, str(output_path), args.width, args.height)
    
    # Return the path for preview
    print(f"\nGenerated image at: {output_path.absolute()}")


if __name__ == "__main__":
    main()