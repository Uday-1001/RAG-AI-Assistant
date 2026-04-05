import os
import subprocess

files = os.listdir("videos_inMP4")
for file in files:
    file_no = file.split(". ")[0][1]
    video_name = file.split(". ")[1].split(".")[0]
    subprocess.run(["ffmpeg" , "-i" , f"videos_inMP4/{file}" , f"audios/{file_no}_{video_name}.mp3"])

folder = "audios"

files = [f for f in os.listdir(folder) if f.endswith(".mp3")]

files.sort(key=lambda x: int(x.split("_")[0]))

temp_names = []

for i, file in enumerate(files):
    old_path = os.path.join(folder, file)
    temp_name = f"temp_{i}.mp3"
    temp_path = os.path.join(folder, temp_name)
    os.rename(old_path, temp_path)
    temp_names.append((temp_name, file))

for i, (temp_name, original_file) in enumerate(temp_names):
    parts = original_file.split("_", 1)
    
    if len(parts) > 1:
        new_name = f"{i}_{parts[1]}"
    else:
        new_name = f"{i}_{original_file}"
    
    old_path = os.path.join(folder, temp_name)
    new_path = os.path.join(folder, new_name)
    
    os.rename(old_path, new_path)
    print(f"{original_file} -> {new_name}")