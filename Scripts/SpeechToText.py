import whisper
import os
import json

audio_folder = r"audios"
json_folder = r"jsons"
model_dir = r"C:\Users\uday raj nkashyap\RAG Project\models"

os.makedirs(json_folder, exist_ok=True)

model = whisper.load_model("small", download_root=model_dir)

files = os.listdir(audio_folder)

for file in files:
    if file.endswith(".mp3"):
        audio_path = os.path.join(audio_folder, file)
        
        result = model.transcribe(audio=audio_path, task="translate", word_timestamps=False, fp16=False)
        
        chunks = []
        
        for i, segment in enumerate(result["segments"]):
            chunks.append({
                "number": str(i + 1),
                "title": file.replace(".mp3", ""),
                "start": segment["start"],
                "end": segment["end"],
                "text": segment["text"].strip()
            })
        
        final_data = {
            "segments": chunks,
            "text": result["text"].strip()
        }
        
        json_file_name = file.replace(".mp3", ".json")
        json_path = os.path.join(json_folder, json_file_name)
        
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(final_data, f, indent=4, ensure_ascii=False)
        
        print(f"{file} done")

print("All files processed successfully")