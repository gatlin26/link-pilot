"""Fix duplicate keys in zh-TW.json and ja.json."""
import json

# ─────────────────────────────────────────────
# 1. Fix zh-TW.json
# ─────────────────────────────────────────────
with open('messages/zh-TW.json', encoding='utf-8') as f:
    lines = f.readlines()

# Lines to remove (1-indexed), sorted descending so removals don't shift indices
# Line 235: duplicate "searchPlaceholder"
# Line 236: duplicate "featured"
# Lines 1118-1127: second "Errors" block (flat strings, less structured than first)
# But we need to also include the closing } and trailing comma of the second Errors block.
# Let's find the extent of the second Errors block.

# Find line 1118 (second Errors) and its closing }
# The second Errors block is lines 1118-1127 based on earlier read:
#   1118:  "Errors": {
#   1119-1126: content
#   1127:  },    <- might have comma
# Let's find the actual end

def find_block_end(lines, start_0indexed):
    """Find the closing } line (0-indexed) of the JSON object starting at start_0indexed."""
    depth = 0
    for i in range(start_0indexed, len(lines)):
        depth += lines[i].count('{') - lines[i].count('}')
        if depth <= 0 and i > start_0indexed:
            return i
    return len(lines) - 1

# Find second Errors block (around line 1118, 0-indexed = 1117)
second_errors_start = 1117  # 0-indexed
second_errors_end = find_block_end(lines, second_errors_start)

print(f'zh-TW: second Errors block: lines {second_errors_start+1}-{second_errors_end+1}')
print(f'  start: {lines[second_errors_start].rstrip()}')
print(f'  end  : {lines[second_errors_end].rstrip()}')

# Check if line before second Errors (i.e., end of Loading block) has a comma
# After removal, the line before second_errors_start should NOT end with comma
# if the Errors block was the last key (or we check what comes after)

# Lines to remove (0-indexed): second Errors block + lines 234, 235 (0-indexed for 235, 236)
lines_to_remove = set(range(second_errors_start, second_errors_end + 1))
lines_to_remove.add(234)  # line 235 (0-indexed 234): duplicate searchPlaceholder
lines_to_remove.add(235)  # line 236 (0-indexed 235): duplicate featured

print(f'Removing {len(lines_to_remove)} lines from zh-TW.json')

new_lines = []
for i, line in enumerate(lines):
    if i in lines_to_remove:
        continue
    new_lines.append(line)

# Validate JSON
try:
    json.loads(''.join(new_lines))
    print('zh-TW.json: valid JSON after fix')
except json.JSONDecodeError as e:
    print(f'zh-TW.json: JSON error after fix: {e}')

with open('messages/zh-TW.json', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

# ─────────────────────────────────────────────
# 2. Fix ja.json
# ─────────────────────────────────────────────
with open('messages/ja.json', encoding='utf-8') as f:
    lines = f.readlines()

# Lines to remove (1-indexed → 0-indexed by -1):
# Duplicates within Common (21-1432):
# finish:1056, contrast:754, provision:599, partial:1146, share:528,
# record:933, create:943, block:785, on:1103, reach:1008, look:928,
# approach:1017, enterprise:358, account:690, close:1019, expert:1115,
# type:936, constant:1286, gain:1003, division:760, view:1316,
# print:937, grasp:1415, organization:627, function:636, draft:941
ja_remove_lines_1indexed = [
    1056, 754, 599, 1146, 528, 933, 943, 785, 1103, 1008,
    928, 1017, 358, 690, 1019, 1115, 936, 1286, 1003, 760,
    1316, 937, 1415, 627, 636, 941
]

ja_remove_set = set(i - 1 for i in ja_remove_lines_1indexed)

print(f'\nRemoving {len(ja_remove_set)} lines from ja.json')

# Quick verify what we're removing
for idx in sorted(ja_remove_set):
    print(f'  line {idx+1}: {lines[idx].rstrip()[:80]}')

new_lines = []
for i, line in enumerate(lines):
    if i in ja_remove_set:
        continue
    new_lines.append(line)

# Validate JSON
try:
    json.loads(''.join(new_lines))
    print('ja.json: valid JSON after fix')
except json.JSONDecodeError as e:
    print(f'ja.json: JSON error after fix: {e}')
    # Find the error position
    content = ''.join(new_lines)
    # Print lines around the error
    err_line = e.lineno
    print(f'Error at line {err_line}:')
    for i in range(max(0, err_line-3), min(len(new_lines), err_line+3)):
        print(f'  {i+1}: {new_lines[i].rstrip()}')

with open('messages/ja.json', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('\nDone! Running dup check...')
