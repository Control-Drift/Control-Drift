import os
from PIL import Image

def crop_favicon(filepath):
    try:
        img = Image.open(filepath).convert("RGBA")
        bbox = img.getbbox()
        if bbox:
            cropped_img = img.crop(bbox)
            cropped_img.save(filepath)
            print(f"Successfully cropped {filepath} to bbox: {bbox}")
        else:
            print(f"Could not find bounding box for {filepath}. Image might be completely transparent.")
    except Exception as e:
        print(f"Error cropping image: {e}")

if __name__ == '__main__':
    target = r"C:\Users\thoma\.gemini\antigravity\scratch\control-drift\public\favicon.png"
    crop_favicon(target)
