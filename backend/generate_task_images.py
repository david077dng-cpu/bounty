#!/usr/bin/env python3
"""
Generate cover images for Skill Bounty tasks using Google Gemini Imagen 3.
Set GOOGLE_API_KEY environment variable before running.
"""

import google.genai as genai
from google.genai.types import GenerateImagesConfig
import os
import sys
from pathlib import Path

# Configure output directory
OUTPUT_DIR = Path(__file__).parent.parent / "frontend/public/images/tasks"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Task category image prompts based on the seed data
TASK_PROMPTS = {
    # Mystery/Detective category
    "M001": "A dimly lit study room in an old manor, a grandfather clock showing 3:15, a piece of paper with number 13 on the desk, mysterious atmosphere, digital art in dark blue tones, themed as a detective mystery",
    "M002": "Five silhouettes of people in a game of deception, spotlights on each person, one light brighter than others, abstract minimalist, dark purple tones, logic puzzle",
    
    # Association/创造力 category
    "A001": "Five connected symbols - ocean wave, music note, heartbeat, wheat stalk, sleeping moon connected in a flowing pattern showing rhythm and waves, minimalist art, soft blue and gold colors",
    "A002": "Abstract diagram showing analogies - brain connected to thought, gene connected to evolution, black hole connected to money/finance, connecting arrows on dark background, information visualization, purple and cyan colors",
    
    # Coding category
    "C001": "Python code on computer screen with red bug highlight, dark theme IDE, close-up of function second_largest, tech minimalist, green and blue colors",
    "C002": "Algorithm complexity graph with three different curves labeled brute force, two pointers, hash table, data visualization on dark background, coding theme, orange and blue",
    
    # Math category
    "N001": "Birthday cake with 23 candles arranged randomly on a table, probability concept, soft lighting, mathematics theme, warm brown and cream colors",
    "N002": "Infinite hotel hallway with numbered doors stretching to infinity, surreal art, mathematics infinity concept, cool gray and blue",
    
    # Science category
    "S001": "Piano tuning wrench on top of a grand piano, close-up, warm lighting, acoustic music instrument, jazz age Chicago feel",
    "S002": "Blue sky with sunset gradient from blue at top to red at horizon, showing Rayleigh scattering effect, scientific visualization, clear and beautiful",
    
    # Logic category
    "L001": "Three people standing in line wearing red and blue hats, one in front one in middle one in back, logic puzzle, minimalist geometric, brown and red colors",
    "L002": "One hundred open drawers in a grid, each with a number inside, 100 prisoners problem, mathematical puzzle, organized geometric composition",
    
    # Evolution/Game theory category
    "E001": "DNA double helix with interacting shapes playing the prisoner's dilemma game, evolutionary game theory, abstract biology, green and blue colors",
    "GT01": "Two bubble tea cups with price tags on them, strategic game theory intersection, street food casual, purple and yellow colors",
    "GT02": "Window air conditioner in a college dorm room, two roommates perspective, game theory, warm summer tones",
    
    # Critical Thinking category
    "CT01": "Brain with question marks and a magnifying glass examining arguments, critical thinking concept, dark background with bright highlights, orange and gray",
    "CT02": "Text highlighting arguments, conclusions and explanations, argument diagram, analytical concept, clean minimalist, blue and white",
    "CT03": "Venn diagram showing fuzzy boundaries vs sharp boundaries for concepts, language clarity, philosophical logic, soft colors",
    "CT04": "CEO speaking on television with a medicine bottle, question mark over credibility, information evaluation concept, journalistic style",
    "CT05": "Ironic sarcastic text in quotes highlighting reverse meaning, rhetoric, persuasion, text art, dark background yellow accents",
    "CT06": "Person born into a religious family background, question mark on belief, appeal to tradition fallacy, philosophical, muted colors",
    "CT07": "Aristotelian syllogism diagram with three circles labeled mammal, whale, lung, logical deduction, classic philosophy",
    "CT08": "Three taxis in Beijing, hasty generalization from small sample, critical thinking, map composition",
    "CT09": "Two fallacy examples - ad hominem and bandwagon, two panel diagram, logic concepts, simple clear style",
    "CT10": "Slippery slope arrow going from same-sex marriage to bestiality, fallacy diagram, critical thinking, red warning accents",
    "CT11": "Ice cream cones and drowning people connected by a common cause arrow (sun/heat), correlation vs causation, statistics concept, blue and orange",
    "CT12": "Law book scales of justice vs morality scales, separating legal and moral judgment, ethics concept, balanced composition, brown and gold",
}

def generate_image(task_id, prompt):
    """Generate an image for a task using Imagen 4."""
    print(f"Generating image for {task_id}: {prompt[:80]}...")
    
    try:
        # Use Imagen 4 (available on Google AI Studio API)
        response = client.models.generate_images(
            model='imagen-4.0-generate-001',
            prompt=prompt,
            config=GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio='16:9',
            )
        )
        
        if not response.generated_images or len(response.generated_images) == 0:
            print(f"  No images generated")
            return False
        
        image_bytes = response.generated_images[0].image.image_bytes
        output_path = OUTPUT_DIR / f"{task_id}.png"
        with open(output_path, 'wb') as f:
            f.write(image_bytes)
        print(f"  Saved to {output_path} ({len(image_bytes)/1024:.1f} KB)")
        return True
        
    except Exception as e:
        print(f"  Error generating image: {e}")
        return False

def main():
    api_key = os.environ.get('GOOGLE_API_KEY')
    if not api_key:
        print("ERROR: GOOGLE_API_KEY environment variable not set")
        print("Usage: export GOOGLE_API_KEY=*** && python generate_task_images.py")
        sys.exit(1)
    
    global client
    client = genai.Client(api_key=api_key)
    
    print(f"Generating {len(TASK_PROMPTS)} images for Skill Bounty tasks...")
    print(f"Output directory: {OUTPUT_DIR}")
    
    success = 0
    failed = 0
    
    for task_id, prompt in TASK_PROMPTS.items():
        if generate_image(task_id, prompt):
            success += 1
        else:
            failed += 1
    
    print(f"\nComplete! Generated {success} images, {failed} failed.")

if __name__ == "__main__":
    main()