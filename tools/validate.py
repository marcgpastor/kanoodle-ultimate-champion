import json,os
HERE=os.path.dirname(os.path.abspath(__file__))
from collections import Counter, defaultdict, deque
SIZES={'A':4,'B':5,'C':5,'D':5,'E':5,'F':3,'G':5,'H':5,'I':5,'J':4,'K':4,'L':5}
d=json.load(open(os.path.join(HERE,'puzzles_raw.json')))
bad=[]
# 2D
for n,rows in d['2d'].items():
    cnt=Counter(''.join(rows).replace('.',''))
    for L,c in cnt.items():
        if c!=SIZES[L]: bad.append(('2d',n,'size',L,c))
    # connectivity
    cells=defaultdict(list)
    for r,row in enumerate(rows):
        for c,ch in enumerate(row):
            if ch!='.': cells[ch].append((r,c))
    for L,pts in cells.items():
        s=set(pts); q=deque([pts[0]]); seen={pts[0]}
        while q:
            r,c=q.popleft()
            for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
                if (r+dr,c+dc) in s and (r+dr,c+dc) not in seen:
                    seen.add((r+dr,c+dc)); q.append((r+dr,c+dc))
        if len(seen)!=len(pts): bad.append(('2d',n,'disconnected',L))
# 3D
for n,layers in d['3d'].items():
    flat=''.join(''.join(l) for l in layers)
    cnt=Counter(flat.replace('.',''))
    for L,c in cnt.items():
        if c!=SIZES[L]: bad.append(('3d',n,'size',L,c))
    if len(flat)!=55: bad.append(('3d',n,'len',len(flat)))
print('problems:',len(bad))
for b in bad[:40]: print(b)
# stats
print('2d empty cells hist', Counter(''.join(r).count('.') for rows in d['2d'].values() for r in [rows]).most_common(5) if False else '')
print('2d pieces per puzzle', Counter(len(set(''.join(v))-{'.'}) for v in d['2d'].values()).most_common())
print('3d pieces per puzzle', Counter(len(set(''.join(''.join(l) for l in v))-{'.'}) for v in d['3d'].values()).most_common())
