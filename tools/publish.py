import json
from datetime import datetime, timedelta

def publish_puzzles():
    print("📦 Reading review_queue.json...")
    
    try:
        with open("review_queue.json", "r", encoding="utf-8") as f:
            new_data = json.load(f)
    except FileNotFoundError:
        print("❌ Error: review_queue.json not found!")
        return

    output_path = "api/puzzles.json"
    existing_puzzles = []
    
    # 1. READ THE ARCHIVE 
    try:
        with open(output_path, "r", encoding="utf-8") as f:
            existing_puzzles = json.load(f)
            
        if existing_puzzles:
            print(f"📂 Found {len(existing_puzzles)} existing puzzles. Appending new batch...")
            # Find the very last puzzle in the array to continue the sequence
            last_puzzle = existing_puzzles[-1]
            next_id = last_puzzle["id"] + 1
            
            # Parse the last date and add exactly 1 day
            last_date_obj = datetime.strptime(last_puzzle["date"], "%Y-%m-%d")
            start_date = last_date_obj + timedelta(days=1)
        else:
            print("📂 api/puzzles.json is empty. Starting fresh...")
            start_date = datetime(2026, 8, 24)
            next_id = 1
            
    except (FileNotFoundError, json.JSONDecodeError):
        print("📂 No existing api/puzzles.json found (or it is invalid). Starting fresh...")
        start_date = datetime(2026, 8, 24)
        next_id = 1

    print("⚙️ Compiling and formatting for React Engine...")
    
    # 2. PROCESS THE NEW BATCH
    production_puzzles = []
    for puz_index, puz in enumerate(new_data.get("puzzles", [])):
        prod_puz = {
            "id": next_id + puz_index,
            "date": (start_date + timedelta(days=puz_index)).strftime("%Y-%m-%d"),
            "title": puz["category_title"],
            "unit": puz["metric"],
            "topLabel": "HIGHEST", 
            "bottomLabel": "LOWEST",
            "items": []
        }
        
        for item_index, item in enumerate(puz["items"]):
            prod_puz["items"].append({
                "id": str(item_index + 1),
                "title": item["name"],
                "displayValue": item["label"],
                "numericValue": item["value"]
            })
            
        production_puzzles.append(prod_puz)

    # 3. MERGE AND SAVE
    combined_puzzles = existing_puzzles + production_puzzles
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(combined_puzzles, f, indent=2)

    print(f"✅ Success! Added {len(production_puzzles)} new puzzles. Total archive is now {len(combined_puzzles)} puzzles.")

if __name__ == "__main__":
    publish_puzzles()