import os
import json
import time
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel, Field

# 1. Load the hidden variables from your .env.local file
load_dotenv(".env.local")

# 2. Securely pull the key from the environment
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("❌ Error: GEMINI_API_KEY not found in .env.local file.")
    exit(1)

client = genai.Client(api_key=api_key)

# --- SCHEMA DEFINITIONS ---
class PuzzleItem(BaseModel):
    name: str = Field(description="The name of the item (e.g., Cheetah, Usain Bolt, Haitian Revolution).")
    value: float = Field(description="The exact numeric value for this item (e.g., 75.0, 27.78, 1791.0).")
    label: str = Field(description="The formatted display text on the tile (e.g., '75 mph', '27.78 mph', 'Year 1791').")
    tile_type: str = Field(description="Must be 'Baseline' or the exact name of the Special Tile used (e.g., 'Trojan Horse', 'Conditional').")
    knowledge_tier: str = Field(description="Must be exactly 'Popular' or 'Niche'.")

class DailyPuzzle(BaseModel):
    category_title: str = Field(description="The overarching theme (e.g., 'Blockbuster Run-times', 'Deep-Sea Trench Depths').")
    metric: str = Field(description="What the player is sorting by (e.g., 'Minutes', 'Meters Below Sea Level', 'Gross Revenue').")
    theme_scope: str = Field(description="Must be exactly 'Broad Theme', 'Niche Theme', or 'Freaky Friday Special'.")
    format_type: str = Field(description="Must be 'Standard 3/3 Split' OR the exact name of the Freaky Friday Special Edition used.")
    items: list[PuzzleItem] = Field(description="Exactly 6 items tailored to the format rules.")

class PuzzleBatch(BaseModel):
    puzzles: list[DailyPuzzle] = Field(description="A batch of exactly 30 daily puzzles.")

# --- THE MASTER PROMPT ---
SYSTEM_PROMPT = """
You are the Lead Puzzle Architect for 'SORTA', a viral daily deduction game.
Your job is to generate a batch of exactly 30 daily puzzles (a full month of content).

RULE 1: THE MACRO SCHEDULE (PACING & STAGGERING)
- Every 7th puzzle (Puzzles #7, #14, #21, #28) MUST be a "Freaky Friday Special Edition".
- For the remaining 26 standard puzzles, strictly ALTERNATE the overarching theme scope:
    * Standard Odd Days (Puzzles #1, #3, #5, #9, etc.): MUST be a "Broad Theme".
    * Standard Even Days (Puzzles #2, #4, #6, #8, etc.): MUST be a "Niche Theme".

RULE 2: THEME SCOPE DEFINITIONS
1. BROAD THEMES (Accessible / Mainstream):
   - Focus on topics rooted in universally shared experiences, popular culture, everyday commerce, food, sports, and common general knowledge.
   - Players should intuitively recognize the domain without needing specialized background knowledge.
2. NICHE THEMES (Specialist / Deep-Dive):
   - Focus on focused academic, historical, scientific, or subculture topics (e.g., specialized historical milestones, marine geology, architectural feats, aviation records).
   - The puzzle must still remain deductible through logic, scale differences, and tile context clues rather than pure blind guesswork.

RULE 3: THE STANDARD DAILY FORMAT (6 ITEMS PER PUZZLE)
For all 26 standard puzzles, you must strictly enforce:
1. ZERO ANCHORS: No obvious, freebie top or bottom items.
2. THE 4/2 KNOWLEDGE SPLIT: Regardless of whether the theme is Broad or Niche, exactly 4 items must be universally recognized ('Popular') and exactly 2 items must be deep cuts ('Niche').
3. THE 3/3 MECHANICAL SPLIT: Exactly 3 items must be 'Baseline' tiles, and exactly 3 items must be 'Special' tiles.
4. THE TWO & ONE RULE: The 3 Special tiles MUST consist of a "Pair" (2 of the same special type) and a "Wildcard" (1 of a different special type).

RULE 4: THE SPECIAL TILE GLOSSARY
Special tiles must be chosen from and strictly adhere to these definitions:
- Trojan Horse: An item that seems intuitively high or low to the average person, but hard data proves the opposite.
- Conditional: An item whose value drastically changes based on a specific condition stated directly in the label.
- Human Anchor: An everyday, relatable human metric used to ground abstract or massive numbers.
- Aggregate: A combined collection of smaller units grouped together to create a surprising total.
- Doppelgänger: Two items in the same puzzle that sound very similar but yield vastly different values.
- Familiarity Trap: A famous entity whose true metric is commonly and widely misunderstood.

RULE 5: THE FREAKY FRIDAY SPECIAL EDITIONS
For Puzzles #7, #14, #21, and #28, set theme_scope to 'Freaky Friday Special' and format_type to the selected concept. IGNORE the 3/3 mechanical split (keep the 4/2 knowledge split). Pick a different concept for each Friday from this list:
1. Pop-Culture Collisions
2. The Zero/Negative Trap
3. The Micro-Scale Sort
4. The Time Capsule Sort
5. The Near-Miss Gauntlet
6. The Money Illusion
7. The Dunning-Kruger Trap
8. The Stroop Inversion
9. The Echo Chamber
10. The David vs. Goliath
11. The Probability Paradox
12. The Lifespan Lottery

RULE 6: THE ENCYCLOPEDIA MANDATE
- Maintain complete topical variety across all 30 puzzles.
- Never repeat any specific entity, historical event, animal, or person across the entire 30-puzzle batch.

Output exactly 30 puzzles adhering strictly to this schema and blueprint.
"""

def generate_puzzles():
    print("🤖 Consulting Gemini to design 30 signature SORTA puzzles...")
    print("🔄 Staggering Macro Themes: Alternating Broad vs. Niche days...")
    print("🌍 Enforcing the 4/2 Knowledge Split & 3/3 Mechanical Split...")
    print("🎰 Scheduling 4 Freaky Friday Special Editions...")
    
    max_retries = 3
    base_delay = 5
    
    for attempt in range(max_retries):
        try:
            print(f"📡 Requesting generation from Gemini 3.6 Flash (Attempt {attempt + 1}/{max_retries})...")
            
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=SYSTEM_PROMPT,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": PuzzleBatch,
                    "temperature": 0.85
                }
            )
            
            output_file = "review_queue.json"
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(response.text)
                
            print(f"✅ Success! 30 weaponized, staggered puzzles saved to {output_file}.")
            return 
            
        except Exception as e:
            error_msg = str(e)
            if "503" in error_msg or "429" in error_msg:
                print(f"⚠️ Server high load. Retrying in {base_delay}s...")
                time.sleep(base_delay)
                base_delay *= 2
            else:
                print(f"❌ Critical API Error: {error_msg}")
                break
                
    print("❌ Generation failed after retries. Please check API status.")

if __name__ == "__main__":
    generate_puzzles()

    #python tools/generator.py
    #python tools/publish.py