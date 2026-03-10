"""Find actual duplicate keys within the same JSON object, with their line numbers."""
import json

def find_real_dups(path):
    raw = open(path, encoding='utf-8').readlines()
    
    real_dups = []
    
    class D:
        def __call__(self, pairs):
            seen = {}
            for k, v in pairs:
                if k in seen:
                    real_dups.append(k)
                seen[k] = v
            return seen
    
    dc = D()
    json.loads(''.join(raw), object_pairs_hook=dc)
    
    if real_dups:
        print(f'{path} - real dups: {real_dups}')
        # Find line numbers for each duplicate
        for key in set(real_dups):
            hits = []
            for i, line in enumerate(raw, 1):
                import re
                if re.search(r'^\s+"' + re.escape(key) + r'"\s*:', line):
                    hits.append(i)
            if len(hits) > 1:
                print(f'  key "{key}": lines {hits}')
    else:
        print(f'{path}: no real dups')

find_real_dups('messages/zh-TW.json')
find_real_dups('messages/ja.json')
