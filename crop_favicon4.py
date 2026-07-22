import os
import numpy as np
from PIL import Image

def crop_favicon_balanced(filepath, threshold=50):
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
        
        # The user felt the previous vertical crop chopped the sides too much.
        # The full width made it too tiny.
        # Let's find the perfect middle ground: 85% of the width.
        # This will slightly trim the extreme fading edges of the orbit rings,
        # but keep the recognizable shape, while still allowing the core to be larger!
        size = int(width * 0.85)
        
        center_x = cmin + width // 2
        center_y = rmin + height // 2
        
        cmin_sq = center_x - size // 2
        rmin_sq = center_y - size // 2
        cmax_sq = cmin_sq + size
        rmax_sq = rmin_sq + size
        
        cropped_img = img.crop((cmin_sq, rmin_sq, cmax_sq, rmax_sq))
        cropped_img.save(filepath)
        print(f"Successfully cropped {filepath} to balanced square bounds: {(cmin_sq, rmin_sq, cmax_sq, rmax_sq)}")
        
    except Exception as e:
        print(f"Error cropping image: {e}")

if __name__ == '__main__':
    target = r"C:\Users\thoma\.gemini\antigravity\scratch\control-drift\public\favicon.png"
    crop_favicon_balanced(target)
