from PIL import Image

def crop_to_content(img_path):
    img = Image.open(img_path).convert("RGBA")
    
    # getbbox() returns the bounding box of the non-zero alpha regions 
    # if we split the alpha channel.
    # For a transparent background, the alpha channel is 0.
    
    # Extract alpha channel to use as mask for getbbox()
    alpha = img.split()[-1]
    bbox = alpha.getbbox()
    
    if bbox:
        # Crop the image to the bounding box
        img = img.crop(bbox)
        
        # Save the cropped image
        img.save(img_path)
        print(f"Cropped {img_path} to {bbox}")
    else:
        print(f"No bounding box found for {img_path}, it might be fully transparent.")

crop_to_content("public/drift_emblem.png")
crop_to_content("src/assets/drift_emblem.png")
print("Done")
