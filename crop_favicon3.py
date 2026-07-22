import os
import numpy as np
from PIL import Image

def crop_favicon_vertical(filepath, threshold=50):
    try:
        img = Image.open(filepath).convert("RGBA")
        data = np.array(img)
        alpha = data[:, :, 3]
        rows = np.any(alpha > threshold, axis=1)
        cols = np.any(alpha > threshold, axis=0)
        
        if not np.any(rows) or not np.any(cols):
            print("No opaque pixels found!")
            return
            
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        
        width = cmax - cmin + 1
        height = rmax - rmin + 1
        
        # We want the icon to appear large. The logo is much wider than it is tall.
        # If we pad the height to match the width, the core becomes tiny.
        # Instead, let's crop the width to match a slightly padded height!
        # The tips of the orbits will be cut off, but the core will be HUGE.
        
        # Add 10% padding to the height so it doesn't touch the very edges of the tab
        padded_height = int(height * 1.2)
        size = padded_height
        
        center_x = cmin + width // 2
        center_y = rmin + height // 2
        
        cmin_sq = center_x - size // 2
        rmin_sq = center_y - size // 2
        cmax_sq = cmin_sq + size
        rmax_sq = rmin_sq + size
        
        # We might go out of bounds if the image is small, but PIL handles crop out of bounds by filling with transparency!
        cropped_img = img.crop((cmin_sq, rmin_sq, cmax_sq, rmax_sq))
        cropped_img.save(filepath)
        print(f"Successfully cropped {filepath} to square height bounds: {(cmin_sq, rmin_sq, cmax_sq, rmax_sq)}")
        
    except Exception as e:
        print(f"Error cropping image: {e}")

if __name__ == '__main__':
    target = r"C:\Users\thoma\.gemini\antigravity\scratch\control-drift\public\favicon.png"
    crop_favicon_vertical(target)
