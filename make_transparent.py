from PIL import Image, ImageDraw

def remove_bg(img_path):
    img = Image.open(img_path).convert("RGBA")
    
    width, height = img.size
    
    # Fill corners with magenta to identify background
    ImageDraw.floodfill(img, (0, 0), (255, 0, 255, 255), thresh=15)
    ImageDraw.floodfill(img, (width-1, 0), (255, 0, 255, 255), thresh=15)
    ImageDraw.floodfill(img, (0, height-1), (255, 0, 255, 255), thresh=15)
    ImageDraw.floodfill(img, (width-1, height-1), (255, 0, 255, 255), thresh=15)

    data = img.getdata()
    new_data = []
    for item in data:
        if item[0] == 255 and item[1] == 0 and item[2] == 255:
            new_data.append((0, 0, 0, 0))
        else:
            # We could also soften the edges here, but a basic transparent background is a start.
            new_data.append(item)
            
    img.putdata(new_data)
    img.save(img_path)

remove_bg("public/drift_emblem.png")
remove_bg("src/assets/drift_emblem.png")
print("Done")
