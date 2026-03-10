"""Find top-level namespace boundaries in a JSON file."""
import json

def find_top_level_keys_with_lines(path):
    lines = open(path, encoding='utf-8').readlines()
    result = {}
    
    # Parse the JSON to get key order
    class Tracker:
        def __init__(self):
            self.depth = 0
            self.top_keys = []
        
    # Use json with pairs to get key order
    top_keys = []
    def hook(pairs):
        return dict(pairs)
    
    data = json.loads(''.join(lines), object_pairs_hook=hook)
    top_keys = list(data.keys())
    
    # Find line numbers for each top-level key
    import re
    for key in top_keys:
        for i, line in enumerate(lines, 1):
            if re.match(r'^  "' + re.escape(key) + r'"\s*:', line):
                result[key] = i
                break
    
    print("Top-level keys with start lines:")
    prev_key = None
    prev_line = None
    for key, line in result.items():
        if prev_key:
            print(f"  {prev_key}: lines {prev_line} - {line-1}")
        prev_key = key
        prev_line = line
    if prev_key:
        print(f"  {prev_key}: lines {prev_line} - {len(lines)}")

find_top_level_keys_with_lines('messages/ja.json')
