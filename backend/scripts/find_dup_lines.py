import re

def find_dup_lines(path, keys):
    lines = open(path, encoding='utf-8').readlines()
    for key in keys:
        hits = []
        pattern = '"' + key + '"' + r'\s*:'
        for i, line in enumerate(lines, 1):
            if re.search(pattern, line):
                hits.append((i, line.rstrip()))
        if len(hits) > 1:
            print(f'{path} - key [{key}]:')
            for ln, txt in hits:
                print(f'  line {ln}: {txt[:100]}')

find_dup_lines('messages/zh-TW.json', ['searchPlaceholder', 'featured', 'Errors'])
print('---')
find_dup_lines('messages/ja.json', ['enterprise', 'share', 'provision', 'organization', 'function', 'account'])
