import re

def find_keys_in_file(path, targets):
    lines = open(path, encoding='utf-8').readlines()
    for i, line in enumerate(lines, 1):
        for t in targets:
            pattern = '"' + t + '"' + r'\s*[:{]'
            if re.search(pattern, line):
                print(f'line {i}: {line.rstrip()[:100]}')
                break

# Find Common namespace boundaries and legitimate keys in ja.json
targets = ['table', 'toggleMobileMenu', 'allRightsReserved', 'noImage', 'PricingPage', 'ImageTask', 'Metadata', 'PricePlans']
find_keys_in_file('messages/ja.json', targets)
